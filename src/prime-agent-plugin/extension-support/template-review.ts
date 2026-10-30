import { existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ProcessCommandRunner,
  TEMPLATE_REVIEW_STATE,
  acquireProjectMutationLock,
  assertSafePathAncestors,
  fsyncDirectory,
  loadAssetInventory,
  resolveNearestProjectRoot,
  type CommandRunner,
} from "./project-initialization.ts";

// Read only: retained evidence from the former actual-file overwrite workflow.
interface ReviewState {
  schemaVersion: 1;
  projectRoot: string;
  assetId: string;
  destination: string;
  originalSha256: string;
  upstreamSha256: string;
  status: "prepared" | "held" | "interrupted";
}

export interface ReviewOptions {
  pluginRoot?: string;
  home?: string;
  runner?: CommandRunner;
}

function digest(bytes: Buffer | string): string { return createHash("sha256").update(bytes).digest("hex"); }
function statePath(root: string): string { return join(root, TEMPLATE_REVIEW_STATE); }
function lstatIfPresent(path: string) {
  try { return lstatSync(path); }
  catch (error: any) { if (error?.code === "ENOENT") return null; throw error; }
}

function readState(root: string): ReviewState {
  const path = statePath(root);
  assertSafePathAncestors(root, path);
  const stat = lstatIfPresent(path);
  if (!stat) throw new Error("no legacy Prime Claw template review requires recovery");
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("template review state is not a regular file");
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!value || value.schemaVersion !== 1 || value.projectRoot !== root
    || typeof value.assetId !== "string" || typeof value.destination !== "string"
    || !["prepared", "held", "interrupted"].includes(value.status)
    || !/^[a-f0-9]{64}$/.test(value.originalSha256)
    || !/^[a-f0-9]{64}$/.test(value.upstreamSha256)) throw new Error("template review state is invalid");
  assertSafePathAncestors(root, join(root, value.destination));
  return value as ReviewState;
}

function selectedAsset(cwd: string, assetId: string, options: ReviewOptions) {
  const runner = options.runner ?? new ProcessCommandRunner();
  const project = resolveNearestProjectRoot(cwd, options.home, runner);
  const pluginRoot = resolve(options.pluginRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
  const asset = loadAssetInventory(pluginRoot).assets.find((item) => item.scope === "project" && item.id === assetId);
  if (!asset) throw new Error(`unknown project asset: ${assetId}`);
  return { runner, project, pluginRoot, asset, destination: join(project.root, asset.destination) };
}

export function requestTemplateReview(cwd: string, assetId: string, options: ReviewOptions = {}) {
  const { runner, project, pluginRoot, asset, destination } = selectedAsset(cwd, assetId, options);
  assertSafePathAncestors(project.root, statePath(project.root));
  if (lstatIfPresent(statePath(project.root))) throw new Error("legacy interrupted template review requires an explicit keep or restore decision before comparison");
  assertSafePathAncestors(project.root, destination);
  if (!existsSync(destination)) throw new Error("template review destination is missing");
  const stat = lstatSync(destination);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("template review destination is not a regular file");
  const original = readFileSync(destination);
  const upstream = readFileSync(join(pluginRoot, asset.source));
  // Git reads copies only. Neither the real worktree nor its index is an input
  // workspace, even when the asset has staged and unstaged changes at once.
  const scratch = mkdtempSync(join(tmpdir(), "prime-claw-template-diff-"));
  try {
    const before = `a/${asset.destination}`, after = `b/${asset.destination}`;
    for (const [path, bytes] of [[before, original], [after, upstream]] as const) {
      mkdirSync(dirname(join(scratch, path)), { recursive: true });
      writeFileSync(join(scratch, path), bytes, { mode: 0o600 });
    }
    const result = runner.run("git", ["--no-pager", "diff", "--no-index", "--no-ext-diff", "--no-textconv", "--no-color", "--text", "--src-prefix=", "--dst-prefix=", "--", before, after], { cwd: scratch, allowFailure: true });
    if (result.status !== 0 && result.status !== 1) throw new Error(`template comparison failed: ${result.stderr.trim()}`);
    return {
      projectRoot: project.root, assetId, destination: asset.destination, diff: result.stdout,
      message: "Text comparison only: current project bytes to upstream template. Worktree and index are unchanged. Viewing this patch accepts no override or reset.",
    };
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

export function recoverTemplateReview(cwd: string, action: "restore" | "keep", options: ReviewOptions = {}) {
  const runner = options.runner ?? new ProcessCommandRunner();
  const project = resolveNearestProjectRoot(cwd, options.home, runner);
  const release = acquireProjectMutationLock(project.root);
  try {
    const state = readState(project.root);
    if (action === "keep") {
      unlinkSync(statePath(project.root));
      fsyncDirectory(dirname(statePath(project.root)));
      return { kept: true, assetId: state.assetId, destination: state.destination, message: "Current bytes were kept without staging or committing; reconcile will preserve them as customization." };
    }
    const destination = join(project.root, state.destination);
    const stat = lstatIfPresent(destination);
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error("legacy template restore destination is not a regular file");
    // The old workflow admitted only a clean tracked asset. Prove its original
    // bytes still exist in the index before any explicit worktree restore.
    const indexed = runner.run("git", ["-C", project.root, "show", `:${state.destination}`], { cwd: project.root, allowFailure: true });
    if (indexed.status !== 0 || digest(indexed.stdout) !== state.originalSha256) {
      throw new Error("legacy template restore cannot prove original bytes in the index; recovery evidence and current bytes were preserved");
    }
    // Unlike restore --worktree, checkout-index without --index does not
    // refresh cached stat data or rewrite the real index while restoring bytes.
    const restored = runner.run("git", ["-C", project.root, "checkout-index", "--force", "--", state.destination], { cwd: project.root, allowFailure: true });
    if (restored.status !== 0) throw new Error(`explicit template restore failed: ${restored.stderr.trim()}`);
    fsyncDirectory(dirname(destination));
    if (digest(readFileSync(destination)) !== state.originalSha256) throw new Error("explicit template restore did not recover the exact original bytes; recovery evidence was preserved");
    unlinkSync(statePath(project.root));
    fsyncDirectory(dirname(statePath(project.root)));
    return { restored: true, assetId: state.assetId };
  } finally { release(); }
}
