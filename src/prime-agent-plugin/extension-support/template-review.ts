import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ProcessCommandRunner,
  TEMPLATE_REVIEW_STATE,
  acquireProjectMutationLock,
  fsyncDirectory,
  episodeWorktreeActivity,
  loadAssetInventory,
  resolveNearestProjectRoot,
  type CommandRunner,
} from "./project-initialization.ts";

interface ReviewState {
  schemaVersion: 1;
  projectRoot: string;
  assetId: string;
  destination: string;
  originalSha256: string;
  upstreamSha256: string;
  selector: string;
  status: "prepared" | "held" | "interrupted";
  startedAt: string;
}

export interface ReviewOptions {
  pluginRoot?: string;
  home?: string;
  runner?: CommandRunner;
  isActiveEpisode?: (projectRoot: string) => boolean;
}

function digest(bytes: Buffer | string): string { return createHash("sha256").update(bytes).digest("hex"); }

function statePath(root: string): string { return join(root, TEMPLATE_REVIEW_STATE); }

function writeState(path: string, state: ReviewState): void {
  const tmp = join(dirname(path), `.template-review.tmp-${process.pid}-${randomUUID()}`);
  const fd = openSync(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { writeFileSync(fd, `${JSON.stringify(state, null, 2)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(tmp, path);
  fsyncDirectory(dirname(path));
}

function readState(root: string): ReviewState {
  const path = statePath(root);
  if (!existsSync(path)) throw new Error("no Prime Claw template review is active");
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("template review state is not a regular file");
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!value || value.schemaVersion !== 1 || value.projectRoot !== root || typeof value.assetId !== "string") throw new Error("template review state is invalid");
  return value as ReviewState;
}

function run(runner: CommandRunner, command: string, args: string[], cwd: string, allowFailure = false) {
  return runner.run(command, args, { cwd, allowFailure });
}

function assertCleanTrackedRegular(root: string, destination: string, runner: CommandRunner): void {
  const stat = lstatSync(destination);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("template review requires a tracked regular file");
  const rel = relative(root, destination);
  if (run(runner, "git", ["-C", root, "ls-files", "--error-unmatch", "--", rel], root, true).status !== 0) throw new Error("template review requires a tracked file");
  if (run(runner, "git", ["-C", root, "diff", "--quiet", "--", rel], root, true).status !== 0
    || run(runner, "git", ["-C", root, "diff", "--cached", "--quiet", "--", rel], root, true).status !== 0) {
    throw new Error("template review refuses a staged or unstaged file");
  }
}

function restoreHeld(root: string, state: ReviewState, runner: CommandRunner): void {
  const destination = join(root, state.destination);
  const current = digest(readFileSync(destination));
  if (current !== state.upstreamSha256) {
    writeState(statePath(root), { ...state, status: "interrupted" });
    throw new Error("template review content changed while held; preserved for explicit keep or restore decision");
  }
  const restored = run(runner, "git", ["-C", root, "restore", "--worktree", "--", state.destination], root, true);
  if (restored.status !== 0) {
    writeState(statePath(root), { ...state, status: "interrupted" });
    throw new Error(`template review restore failed; preserved recovery state: ${restored.stderr.trim()}`);
  }
  fsyncDirectory(dirname(destination));
  if (run(runner, "git", ["-C", root, "diff", "--quiet", "--", state.destination], root, true).status !== 0
    || run(runner, "git", ["-C", root, "diff", "--cached", "--quiet", "--", state.destination], root, true).status !== 0
    || digest(readFileSync(destination)) !== state.originalSha256) {
    writeState(statePath(root), { ...state, status: "interrupted" });
    throw new Error("template review restore did not recover the exact original bytes and clean index");
  }
  unlinkSync(statePath(root));
  fsyncDirectory(dirname(statePath(root)));
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
  const { project, asset, destination } = selectedAsset(cwd, assetId, options);
  if (existsSync(statePath(project.root))) throw new Error("another template review requires completion or recovery");
  if (!existsSync(destination)) throw new Error("template review destination is missing");
  return {
    projectRoot: project.root,
    assetId,
    destination: asset.destination,
    message: `Review will temporarily overwrite ${asset.destination} with the upstream template and foreground its Orca worktree. Say ready to continue or cancel to make no change.`,
  };
}

export function startTemplateReview(cwd: string, assetId: string, confirmedReady: boolean, options: ReviewOptions = {}) {
  if (!confirmedReady) throw new Error("template review requires the operator's explicit ready confirmation");
  const { runner, project, pluginRoot, asset, destination } = selectedAsset(cwd, assetId, options);
  if (options.isActiveEpisode?.(project.root) ?? (episodeWorktreeActivity(project.root, project.kind, runner) !== "inactive")) throw new Error("active or uncertain Episode worktree retains its starting template snapshot");
  const release = acquireProjectMutationLock(project.root);
  try {
    if (options.isActiveEpisode?.(project.root) ?? (episodeWorktreeActivity(project.root, project.kind, runner) !== "inactive")) throw new Error("active or uncertain Episode worktree retains its starting template snapshot");
    const path = statePath(project.root);
    if (existsSync(path)) throw new Error("another template review requires completion or recovery");
    assertCleanTrackedRegular(project.root, destination, runner);
    const original = readFileSync(destination);
    const upstream = readFileSync(join(pluginRoot, asset.source));
    const state: ReviewState = {
      schemaVersion: 1,
      projectRoot: project.root,
      assetId,
      destination: asset.destination,
      originalSha256: digest(original),
      upstreamSha256: digest(upstream),
      selector: `path:${project.root}`,
      status: "prepared",
      startedAt: new Date().toISOString(),
    };
    const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
    try { writeFileSync(fd, `${JSON.stringify(state, null, 2)}
`); fsyncSync(fd); } finally { closeSync(fd); }
    fsyncDirectory(dirname(path));
    const tmp = join(dirname(destination), `.prime-claw-review-${randomUUID()}`);
    try {
      const out = openSync(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o644);
      try { writeFileSync(out, upstream); fsyncSync(out); } finally { closeSync(out); }
      renameSync(tmp, destination);
      fsyncDirectory(dirname(destination));
      writeState(path, { ...state, status: "held" });
      const opened = run(runner, "orca", ["file", "diff", asset.destination, "--worktree", state.selector, "--focus", "--json"], project.root, true);
      if (opened.status !== 0) {
        const fallback = run(runner, "git", ["-C", project.root, "diff", "--no-ext-diff", "--", asset.destination], project.root, true);
        const diff = fallback.stdout || fallback.stderr;
        restoreHeld(project.root, { ...state, status: "held" }, runner);
        return { held: false, restored: true, fallback: "git-diff", diff, error: opened.stderr.trim() || "Orca diff unavailable" };
      }
      return { held: true, projectRoot: project.root, assetId, destination: asset.destination, selector: state.selector, opened: opened.stdout.trim(), message: "Upstream overwrite is held. Confirm the comparison is visible, then explicitly complete or cancel review." };
    } catch (error) {
      try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* best effort */ }
      if (existsSync(path)) {
        const current = existsSync(destination) ? digest(readFileSync(destination)) : "missing";
        if (current === state.upstreamSha256) restoreHeld(project.root, { ...state, status: "held" }, runner);
        else writeState(path, { ...state, status: "interrupted" });
      }
      throw error;
    }
  } finally { release(); }
}

export function finishTemplateReview(cwd: string, action: "complete" | "cancel", visibleConfirmed: boolean, options: ReviewOptions = {}) {
  const runner = options.runner ?? new ProcessCommandRunner();
  const project = resolveNearestProjectRoot(cwd, options.home, runner);
  const release = acquireProjectMutationLock(project.root);
  try {
    if (action === "cancel" && !existsSync(statePath(project.root))) return { restored: false, cancelled: true, noOp: true };
    const state = readState(project.root);
    if (state.status !== "held") throw new Error("template review is interrupted; choose explicit restore or keep recovery");
    if (action === "complete" && !visibleConfirmed) throw new Error("completion requires the operator to confirm the focused comparison was visible");
    restoreHeld(project.root, state, runner);
    return { restored: true, clean: true, action, assetId: state.assetId };
  } finally { release(); }
}

export function recoverTemplateReview(cwd: string, action: "restore" | "keep", options: ReviewOptions = {}) {
  const runner = options.runner ?? new ProcessCommandRunner();
  const project = resolveNearestProjectRoot(cwd, options.home, runner);
  const release = acquireProjectMutationLock(project.root);
  try {
    const state = readState(project.root);
    if (state.status === "held") throw new Error("normal held review must complete or cancel; recovery is only for interrupted preparation");
    if (action === "keep") {
      unlinkSync(statePath(project.root));
      fsyncDirectory(dirname(statePath(project.root)));
      return { kept: true, assetId: state.assetId, destination: state.destination, message: "Current bytes were kept without staging or committing; reconcile will preserve them as customization." };
    }
    const restored = run(runner, "git", ["-C", project.root, "restore", "--worktree", "--", state.destination], project.root, true);
    if (restored.status !== 0) throw new Error(`explicit template restore failed: ${restored.stderr.trim()}`);
    const destination = join(project.root, state.destination);
    fsyncDirectory(dirname(destination));
    if (run(runner, "git", ["-C", project.root, "diff", "--quiet", "--", state.destination], project.root, true).status !== 0
      || run(runner, "git", ["-C", project.root, "diff", "--cached", "--quiet", "--", state.destination], project.root, true).status !== 0
      || digest(readFileSync(destination)) !== state.originalSha256) {
      throw new Error("explicit template restore did not recover the exact original bytes and clean index");
    }
    unlinkSync(statePath(project.root));
    fsyncDirectory(dirname(statePath(project.root)));
    return { restored: true, clean: true, assetId: state.assetId };
  } finally { release(); }
}
