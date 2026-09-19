import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  rmdirSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TSchema } from "typebox";

/**
 * Native specification interviews plus the trusted, durable disposition bridge.
 *
 * Slice 1 established durable preflight. Slice 2 executes only the approved
 * future-incubation transaction under a project lock. Episode disposition
 * remains preflight-only until the later allocation slices.
 */

const CONTEXT_TAG = "operator-specification-context";
const CONTROL_DIR = "prime-claw";
const MAX_DOCUMENT_CHARS = 2_000_000;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;
const SAFE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const SAFE_BRANCH = /^(?:feature|spec|poc)\/[a-z0-9](?:[a-z0-9._\/-]{0,125}[a-z0-9])?$/;
const GIT_OID = /^[0-9a-f]{40,64}$/;
const SECURE_FS_HELPER = fileURLToPath(new URL("../helpers/specification-episode-fs.py", import.meta.url));

function secureFs<T extends Record<string, unknown>>(request: Record<string, unknown>): T {
  try {
    const output = execFileSync("python3", [SECURE_FS_HELPER], {
      encoding: "utf8",
      input: canonicalJson(request),
      maxBuffer: 16 * 1024 * 1024,
      timeout: 30_000,
    });
    const result = object(JSON.parse(output), "secure filesystem helper result");
    if (result.ok !== true) throw new Error(typeof result.error === "string" ? result.error : "unknown helper failure");
    return result as T;
  } catch (error) {
    const failure = error as { stderr?: string; stdout?: string };
    const stderr = failure.stderr?.trim();
    let diagnostic = stderr || failure.stdout?.trim() || errorMessage(error);
    try {
      const parsed = object(JSON.parse(failure.stdout ?? ""), "secure filesystem helper failure");
      if (typeof parsed.error === "string") diagnostic = parsed.error;
    } catch {
      // Keep the process diagnostic when stdout is not structured JSON.
    }
    throw new Error(`secure filesystem helper failed: ${diagnostic}`);
  }
}

function secureRelative(root: string, path: string): string {
  const rel = relative(root, path);
  if (!rel || rel.startsWith("..") || rel.startsWith("/")) throw new Error(`secure path escapes root: ${path}`);
  return rel.split("\\").join("/");
}

export interface DispositionParams {
  request_id: string;
  confirmed_by_operator: boolean;
  decision: {
    kind: "future" | "episode";
    slug: string;
    branch_name?: string;
  };
  documents: {
    specification_markdown: string;
    requirements_markdown: string;
    decisions_markdown: string;
  };
  recovery_action?: "inspect" | "continue" | "remove-owned-uncommitted";
}

// Raw JSON Schema avoids a runtime dependency for ordinary Node acceptance
// tests. It is equivalent to TypeBox output. An enum plus trusted cross-field
// validation is used instead of Type.Union/Type.Literal, which Prime Agent 0.9.5
// documents as incompatible with Google tool schemas.
export const dispositionParameters = {
  type: "object",
  properties: {
    request_id: {
      type: "string",
      minLength: 8,
      maxLength: 128,
      description: "Stable caller request identifier for retry and collision detection",
    },
    confirmed_by_operator: {
      type: "boolean",
      description: "Must be true only after the operator explicitly chooses a disposition",
    },
    decision: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["future", "episode"],
          description: "The operator's explicit disposition",
        },
        slug: { type: "string", minLength: 1, maxLength: 63 },
        branch_name: {
          type: "string",
          minLength: 3,
          maxLength: 128,
          description: "Required only for episode disposition",
        },
      },
      required: ["kind", "slug"],
      additionalProperties: false,
    },
    recovery_action: {
      type: "string",
      enum: ["inspect", "continue", "remove-owned-uncommitted"],
      description: "Explicit operator-approved recovery for an interrupted future transaction",
    },
    documents: {
      type: "object",
      properties: {
        specification_markdown: { type: "string", minLength: 1, maxLength: MAX_DOCUMENT_CHARS },
        requirements_markdown: { type: "string", minLength: 1, maxLength: MAX_DOCUMENT_CHARS },
        decisions_markdown: { type: "string", minLength: 1, maxLength: MAX_DOCUMENT_CHARS },
      },
      required: ["specification_markdown", "requirements_markdown", "decisions_markdown"],
      additionalProperties: false,
    },
  },
  required: ["request_id", "confirmed_by_operator", "decision", "documents"],
  additionalProperties: false,
} as const;

function skillMarkdown(cwd: string, name: "design" | "spec-it-out"): { path: string; body: string } | null {
  const path = join(cwd, ".ralph", "skills", name, "SKILL.md");
  if (!existsSync(path)) return null;
  return { path, body: readFileSync(path, "utf8") };
}

function injectSkill(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  name: "design" | "spec-it-out",
  operatorContext: string,
): void {
  const skill = skillMarkdown(ctx.cwd, name);
  if (!skill) {
    ctx.ui.notify(`specification-episodes: .ralph/skills/${name}/SKILL.md not found`, "warning");
    return;
  }
  const wrapped = `<skill name="${name}" location="${skill.path}">
References are relative to ${dirname(skill.path)}.

${skill.body}
</skill>`;
  const context = operatorContext.trim();
  const contextBlock = context
    ? `\n\n<${CONTEXT_TAG}>\n${context}\n</${CONTEXT_TAG}>`
    : "";
  pi.sendUserMessage(`${wrapped}${contextBlock}`);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: string[], label: string): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length) throw new Error(`${label} contains unsupported field(s): ${unexpected.join(", ")}`);
}

function requiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || value.includes("\0")) {
    throw new Error(`${label} must be a non-empty string of at most ${maxLength} characters without NUL bytes`);
  }
  return value;
}

export function validateDispositionParams(value: unknown): DispositionParams {
  const root = object(value, "spec_disposition input");
  exactKeys(root, ["request_id", "confirmed_by_operator", "decision", "documents", "recovery_action"], "spec_disposition input");

  const requestId = requiredString(root.request_id, "request_id", 128);
  if (!REQUEST_ID.test(requestId)) {
    throw new Error("request_id must be 8-128 safe characters: letters, digits, dot, underscore, or hyphen");
  }
  if (root.confirmed_by_operator !== true) {
    throw new Error("explicit operator confirmation is required before disposition preflight");
  }

  const decision = object(root.decision, "decision");
  exactKeys(decision, ["kind", "slug", "branch_name"], "decision");
  if (decision.kind !== "future" && decision.kind !== "episode") {
    throw new Error("decision.kind must be exactly future or episode");
  }
  const slug = requiredString(decision.slug, "decision.slug", 63);
  if (!SAFE_SLUG.test(slug)) {
    throw new Error("decision.slug must be a lowercase filesystem-safe slug without traversal or metacharacters");
  }

  let branchName: string | undefined;
  if (decision.kind === "future") {
    if (decision.branch_name !== undefined) {
      throw new Error("decision.branch_name is not allowed for future disposition");
    }
  } else {
    branchName = requiredString(decision.branch_name, "decision.branch_name", 128);
    if (!SAFE_BRANCH.test(branchName) || branchName.includes("..") || branchName.includes("//") || branchName.includes("@{")) {
      throw new Error("decision.branch_name must be a safe feature/, spec/, or poc/ branch name");
    }
  }

  let recoveryAction: DispositionParams["recovery_action"];
  if (root.recovery_action !== undefined) {
    if (!['inspect', 'continue', 'remove-owned-uncommitted'].includes(String(root.recovery_action))) {
      throw new Error("recovery_action must be inspect, continue, or remove-owned-uncommitted");
    }
    if (decision.kind !== "future") throw new Error("recovery_action is allowed only for future disposition");
    recoveryAction = root.recovery_action as DispositionParams["recovery_action"];
  }

  const documents = object(root.documents, "documents");
  exactKeys(
    documents,
    ["specification_markdown", "requirements_markdown", "decisions_markdown"],
    "documents",
  );

  return {
    request_id: requestId,
    confirmed_by_operator: true,
    decision: { kind: decision.kind, slug, ...(branchName ? { branch_name: branchName } : {}) },
    documents: {
      specification_markdown: requiredString(
        documents.specification_markdown,
        "documents.specification_markdown",
        MAX_DOCUMENT_CHARS,
      ),
      requirements_markdown: requiredString(
        documents.requirements_markdown,
        "documents.requirements_markdown",
        MAX_DOCUMENT_CHARS,
      ),
      decisions_markdown: requiredString(
        documents.decisions_markdown,
        "documents.decisions_markdown",
        MAX_DOCUMENT_CHARS,
      ),
    },
    ...(recoveryAction ? { recovery_action: recoveryAction } : {}),
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function controlLocation(path: string): { root: string; relativePath: string } {
  const marker = `/${CONTROL_DIR}/`;
  const normalized = path.split("\\").join("/");
  const index = normalized.lastIndexOf(marker);
  if (index <= 0) throw new Error(`path is not beneath the Prime Claw control root: ${path}`);
  return {
    root: normalized.slice(0, index),
    relativePath: normalized.slice(index + 1),
  };
}

function readDurableJson(path: string): Record<string, unknown> {
  try {
    const location = controlLocation(path);
    const result = secureFs<{ text: string }>({
      operation: "read-file",
      root: location.root,
      path: location.relativePath,
    });
    return object(JSON.parse(result.text), `durable receipt ${path}`);
  } catch (error) {
    throw new Error(`corrupt durable receipt at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

interface FilesystemIdentity {
  device: string;
  inode: string;
  birthtime_ns: string;
  ctime_ns: string;
}

function identity(value: unknown, label: string): FilesystemIdentity {
  const record = object(value, label);
  for (const key of ["device", "inode", "birthtime_ns", "ctime_ns"] as const) {
    if (typeof record[key] !== "string" || !/^[0-9]+$/.test(record[key] as string)) {
      throw new Error(`${label} is invalid`);
    }
  }
  return {
    device: record.device as string,
    inode: record.inode as string,
    birthtime_ns: record.birthtime_ns as string,
    ctime_ns: record.ctime_ns as string,
  };
}

function validateSessionFile(path: string, sessionId: string, cwd: string): string {
  let resolved: string;
  let header: Record<string, unknown>;
  try {
    resolved = realpathSync(path);
    const fd = openSync(resolved, "r");
    const buffer = Buffer.alloc(65_536);
    let bytesRead: number;
    try {
      bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
    } finally {
      closeSync(fd);
    }
    const prefix = buffer.subarray(0, bytesRead).toString("utf8");
    const newline = prefix.indexOf("\n");
    if (newline < 0) throw new Error("session header exceeds 65535 bytes or is incomplete");
    header = object(JSON.parse(prefix.slice(0, newline).replace(/\r$/, "")), "Prime Agent session header");
  } catch (error) {
    throw new Error(`persisted Prime Agent session file is missing or invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (header.type !== "session" || header.id !== sessionId) {
    throw new Error("persisted Prime Agent session header does not match the stable owner session ID");
  }
  if (typeof header.cwd !== "string" || realpathSync(header.cwd) !== cwd) {
    throw new Error("persisted Prime Agent session header does not match the canonical checkout CWD");
  }
  return resolved;
}

/** Create one complete JSON file without ever replacing an existing receipt. */
function createDurableJson(path: string, value: unknown): boolean {
  const location = controlLocation(path);
  const result = secureFs<{ created: boolean }>({
    operation: "create-json",
    root: location.root,
    path: location.relativePath,
    text: canonicalJson(value),
  });
  return result.created;
}

function ensureControlDirectory(commonDir: string, name?: string): string {
  const root = join(commonDir, CONTROL_DIR);
  if (existsSync(root) && lstatSync(root).isSymbolicLink()) {
    throw new Error("Prime Claw Git control root must not be a symlink");
  }
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const resolvedRoot = realpathSync(root);
  if (relative(commonDir, resolvedRoot).startsWith("..")) {
    throw new Error("Prime Claw Git control root escapes the Git common directory");
  }
  if (!name) return resolvedRoot;
  const child = join(resolvedRoot, name);
  if (existsSync(child) && lstatSync(child).isSymbolicLink()) {
    throw new Error(`Prime Claw control directory must not be a symlink: ${name}`);
  }
  mkdirSync(child, { recursive: true, mode: 0o700 });
  if (relative(resolvedRoot, realpathSync(child)).startsWith("..")) {
    throw new Error(`Prime Claw control directory escapes its root: ${name}`);
  }
  return child;
}

function controlFilePath(commonDir: string, child: string, filename: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) throw new Error("invalid Prime Claw control filename");
  return join(ensureControlDirectory(commonDir, child), filename);
}

function replaceDurableJson(path: string, value: unknown): void {
  const location = controlLocation(path);
  secureFs<Record<string, unknown>>({
    operation: "replace-json",
    root: location.root,
    path: location.relativePath,
    text: canonicalJson(value),
  });
}

function readDurableFile(path: string): string {
  const location = controlLocation(path);
  return secureFs<{ text: string }>({
    operation: "read-file",
    root: location.root,
    path: location.relativePath,
  }).text;
}

function removeDurableFile(path: string): void {
  const location = controlLocation(path);
  const expectedSha256 = sha256(readDurableFile(path));
  secureFs<Record<string, unknown>>({
    operation: "remove-file",
    root: location.root,
    path: location.relativePath,
    sha256: expectedSha256,
  });
}

async function testFault(pi: ExtensionAPI, phase: string): Promise<void> {
  const hook = (pi as ExtensionAPI & {
    __primeClawSpecificationFault?: (phase: string) => void | Promise<void>;
  }).__primeClawSpecificationFault;
  if (hook) await hook(phase);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ProjectLock {
  path: string;
  token: string;
  ownerPath: string;
}

class LockContentionError extends Error {
  readonly lockPath: string;
  readonly owner: Record<string, unknown> | null;

  constructor(lockPath: string, owner: Record<string, unknown> | null) {
    super(`project mutation lock is held at ${lockPath}`);
    this.lockPath = lockPath;
    this.owner = owner;
  }
}

function acquireProjectLock(
  lockPath: string,
  dispositionId: string,
  ownerSessionId: string,
): ProjectLock {
  mkdirSync(dirname(lockPath), { recursive: true, mode: 0o700 });
  const token = randomUUID();
  const location = controlLocation(lockPath);
  const created = secureFs<{ created: boolean }>({
    operation: "create-lock",
    root: location.root,
    path: location.relativePath,
  }).created;
  if (!created) {
    let owner: Record<string, unknown> | null = null;
    try {
      owner = readDurableJson(join(lockPath, "owner.json"));
    } catch {
      // Empty/corrupt lock metadata is still an owned-or-ambiguous lock. Never steal it.
    }
    throw new LockContentionError(lockPath, owner);
  }
  const ownerPath = join(lockPath, "owner.json");
  try {
    replaceDurableJson(ownerPath, {
      version: 1,
      token,
      disposition_id: dispositionId,
      owner_session_id: ownerSessionId,
      pid: process.pid,
      acquired_at: new Date().toISOString(),
    });
  } catch (error) {
    rmSync(lockPath, { recursive: true, force: true });
    throw error;
  }
  return { path: lockPath, token, ownerPath };
}

function releaseProjectLock(lock: ProjectLock): void {
  const owner = readDurableJson(lock.ownerPath);
  if (owner.token !== lock.token) {
    throw new Error(`refusing to release project mutation lock not owned by this invocation: ${lock.path}`);
  }
  const location = controlLocation(lock.path);
  secureFs<Record<string, unknown>>({
    operation: "remove-lock",
    root: location.root,
    path: location.relativePath,
    token: lock.token,
  });
}

function removeOwnedPrivateIndex(
  commonDir: string,
  dispositionId: string,
  transaction: Record<string, unknown>,
): void {
  const indexPath = controlFilePath(commonDir, "indexes", `${dispositionId}.index`);
  if (transaction.private_index_path !== undefined && transaction.private_index_path !== indexPath) {
    throw new Error("future transaction private-index path does not match the derived control path");
  }
  if (transaction.private_index_path === undefined) return;
  if (transaction.private_index_path !== indexPath || typeof transaction.private_index_sha256 !== "string"
    || !/^[0-9a-f]{64}$/.test(transaction.private_index_sha256)) {
    throw new Error("refusing to remove a private index without exact ownership evidence");
  }
  secureFs<Record<string, unknown>>({
    operation: "remove-index",
    root: commonDir,
    path: `${CONTROL_DIR}/indexes/${dispositionId}.index`,
    sha256: transaction.private_index_sha256,
  });
}

function sameStrings(actual: string[], expected: string[]): boolean {
  return [...actual].sort().join("\0") === [...expected].sort().join("\0");
}

function porcelainPaths(output: string): string[] {
  const records = output.split("\0").filter(Boolean);
  const paths: string[] = [];
  for (const record of records) {
    if (record.length >= 4 && record[2] === " ") paths.push(record.slice(3));
    else paths.push(record);
  }
  return paths;
}

function validateFutureTargetDirectory(futureRoot: string, targetDir: string): void {
  if (!existsSync(targetDir)) return;
  const stat = lstatSync(targetDir);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error("future bundle target must be a real directory, not a symlink or other file");
  }
  const resolved = realpathSync(targetDir);
  const rel = relative(futureRoot, resolved);
  if (rel.startsWith("..") || rel === "" || rel.startsWith("/") || rel.includes("/")) {
    throw new Error("future bundle target escapes its named directory");
  }
}

function validateOwnedBundle(
  futureRoot: string,
  targetDir: string,
  documents: DispositionParams["documents"],
): Record<string, string> {
  validateFutureTargetDirectory(futureRoot, targetDir);
  const expected: Record<string, string> = {
    "SPECIFICATION.md": documents.specification_markdown,
    "REQUIREMENTS.md": documents.requirements_markdown,
    "DECISIONS.md": documents.decisions_markdown,
  };
  const names = readdirSync(targetDir).sort();
  if (!sameStrings(names, Object.keys(expected))) {
    throw new Error(`future bundle contains unexpected or missing entries: ${names.join(", ") || "(empty)"}`);
  }
  const hashes: Record<string, string> = {};
  for (const [name, content] of Object.entries(expected)) {
    const path = join(targetDir, name);
    if (lstatSync(path).isSymbolicLink()) throw new Error(`future bundle file is a symlink: ${name}`);
    const actual = readFileSync(path, "utf8");
    if (actual !== content) throw new Error(`future bundle ownership mismatch for ${name}`);
    hashes[name] = sha256(actual);
  }
  return hashes;
}

function validateRemovableOwnedBundle(
  futureRoot: string,
  targetDir: string,
  documents: DispositionParams["documents"],
): void {
  validateFutureTargetDirectory(futureRoot, targetDir);
  const expected: Record<string, string> = {
    "SPECIFICATION.md": documents.specification_markdown,
    "REQUIREMENTS.md": documents.requirements_markdown,
    "DECISIONS.md": documents.decisions_markdown,
  };
  if (!existsSync(targetDir)) return;
  const names = readdirSync(targetDir);
  if (names.some((name) => !(name in expected))) {
    throw new Error(`future bundle contains non-owned entries: ${names.join(", ")}`);
  }
  for (const name of names) {
    const path = join(targetDir, name);
    if (lstatSync(path).isSymbolicLink() || readFileSync(path, "utf8") !== expected[name]) {
      throw new Error(`refusing to remove non-owned content: ${name}`);
    }
  }
}

function ensureFutureRoot(cwd: string, create = true): string {
  const ralphRootPath = join(cwd, ".ralph");
  const plansRootPath = join(ralphRootPath, "plans");
  if (lstatSync(ralphRootPath).isSymbolicLink() || lstatSync(plansRootPath).isSymbolicLink()) {
    throw new Error(".ralph and .ralph/plans must not be symlinks");
  }
  const plansRoot = realpathSync(plansRootPath);
  const plansRelative = relative(cwd, plansRoot);
  if (plansRelative.startsWith("..") || plansRelative.startsWith("/")) {
    throw new Error(".ralph/plans escapes the canonical checkout");
  }
  const futureRoot = join(plansRoot, "future");
  if (existsSync(futureRoot) && lstatSync(futureRoot).isSymbolicLink()) {
    throw new Error("future plans root must not be a symlink");
  }
  if (create) secureFs<Record<string, unknown>>({
    operation: "ensure-directory",
    repo: cwd,
    path: join(".ralph", "plans", "future").split("\\").join("/"),
  });
  const resolved = existsSync(futureRoot) ? realpathSync(futureRoot) : futureRoot;
  const rel = relative(plansRoot, resolved);
  if (rel.startsWith("..") || rel === "" || rel.startsWith("/")) {
    throw new Error("future plans root escapes .ralph/plans");
  }
  return resolved;
}

async function git(
  pi: ExtensionAPI,
  cwd: string,
  args: string[],
  signal: AbortSignal | undefined,
  env?: NodeJS.ProcessEnv,
): Promise<string> {
  if (signal?.aborted) throw new Error("spec_disposition cancelled before durable preflight");
  const result = await pi.exec("git", ["-C", cwd, ...args], {
    cwd,
    signal,
    timeout: args[0] === "push" ? 60_000 : 15_000,
    ...(env ? { env } : {}),
  });
  if (result.killed || result.code !== 0) {
    const diagnostic = (result.stderr || result.stdout).trim();
    throw new Error(`git ${args.join(" ")} failed (${result.code}): ${diagnostic || "no diagnostic"}`);
  }
  return result.stdout.trimEnd();
}

interface CanonicalState {
  repoRoot: string;
  commonDir: string;
  currentBranch: string;
  upstream: string;
  remote: string;
  remoteBranch: string;
  defaultRemoteBranch: string;
  head: string;
  upstreamHead: string;
  status: string;
}

async function inspectCanonicalRepository(
  pi: ExtensionAPI,
  cwd: string,
  signal: AbortSignal | undefined,
): Promise<CanonicalState> {
  const repoRoot = realpathSync((await git(pi, cwd, ["rev-parse", "--show-toplevel"], signal)).trim());
  if (repoRoot !== cwd) throw new Error("spec_disposition must run from the repository root");
  const commonDir = realpathSync((await git(
    pi, cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"], signal,
  )).trim());
  const gitDir = realpathSync((await git(
    pi, cwd, ["rev-parse", "--path-format=absolute", "--git-dir"], signal,
  )).trim());
  if (gitDir !== commonDir) {
    throw new Error("spec_disposition source must be the primary canonical checkout, not a linked worktree");
  }
  const currentBranch = (await git(pi, cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"], signal)).trim();
  const upstream = (await git(
    pi, cwd, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], signal,
  )).trim();
  const slash = upstream.indexOf("/");
  if (slash <= 0) throw new Error("canonical checkout upstream is not a remote-tracking branch");
  const remote = upstream.slice(0, slash);
  const remoteBranch = upstream.slice(slash + 1);
  const defaultRemoteBranch = (await git(
    pi, cwd, ["symbolic-ref", "--quiet", "--short", `refs/remotes/${remote}/HEAD`], signal,
  )).trim();
  if (upstream !== defaultRemoteBranch || currentBranch !== remoteBranch) {
    throw new Error(`spec_disposition source must be on configured remote default branch ${defaultRemoteBranch}`);
  }
  const head = (await git(pi, cwd, ["rev-parse", "HEAD"], signal)).trim();
  const upstreamHead = (await git(pi, cwd, ["rev-parse", "@{upstream}"], signal)).trim();
  const status = await git(pi, cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], signal);
  return {
    repoRoot, commonDir, currentBranch, upstream, remote, remoteBranch,
    defaultRemoteBranch, head, upstreamHead, status,
  };
}

async function gitIsAncestor(
  pi: ExtensionAPI,
  cwd: string,
  ancestor: string,
  descendant: string,
): Promise<boolean> {
  const result = await pi.exec("git", ["-C", cwd, "merge-base", "--is-ancestor", ancestor, descendant], {
    cwd, timeout: 15_000,
  });
  if (result.code === 0) return true;
  if (result.code === 1 && !result.killed) return false;
  throw new Error(`git merge-base --is-ancestor failed (${result.code}): ${(result.stderr || result.stdout).trim()}`);
}

async function remoteRefOid(
  pi: ExtensionAPI,
  cwd: string,
  remote: string,
  remoteBranch: string,
): Promise<string> {
  const output = await git(pi, cwd, ["ls-remote", "--refs", remote, `refs/heads/${remoteBranch}`], undefined);
  const lines = output.split("\n").filter(Boolean);
  if (lines.length !== 1) throw new Error(`configured remote branch ${remote}/${remoteBranch} did not resolve uniquely`);
  const [oid, ref] = lines[0].split(/\s+/);
  if (!/^[0-9a-f]{40,64}$/.test(oid) || ref !== `refs/heads/${remoteBranch}`) {
    throw new Error(`configured remote branch ${remote}/${remoteBranch} returned an invalid object ID`);
  }
  return oid;
}

async function commitPaths(pi: ExtensionAPI, cwd: string, commit: string): Promise<string[]> {
  const output = await git(pi, cwd, ["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", commit], undefined);
  return output.split("\0").filter(Boolean);
}

async function validateTreeBundle(
  pi: ExtensionAPI,
  cwd: string,
  treeish: string,
  ownedPaths: string[],
  documents: DispositionParams["documents"],
): Promise<void> {
  const treeOutput = await git(
    pi,
    cwd,
    ["ls-tree", "-r", "-z", "--full-tree", treeish, "--", ...ownedPaths.map((path) => `:(literal)${path}`)],
    undefined,
  );
  const treeEntries = treeOutput.split("\0").filter(Boolean).map((record) => {
    const tab = record.indexOf("\t");
    if (tab < 0) throw new Error("future tree returned an invalid entry");
    const [mode, type, oid] = record.slice(0, tab).split(" ");
    return { mode, type, oid, path: record.slice(tab + 1) };
  });
  if (!sameStrings(treeEntries.map((entry) => entry.path), ownedPaths)) {
    throw new Error("future tree does not contain exactly the owned bundle paths");
  }
  for (const entry of treeEntries) {
    if (entry.mode !== "100644" || entry.type !== "blob" || !GIT_OID.test(entry.oid)) {
      throw new Error(`future tree entry is not an approved regular file: ${entry.path}`);
    }
  }
  const expected = [
    documents.specification_markdown,
    documents.requirements_markdown,
    documents.decisions_markdown,
  ];
  for (let index = 0; index < ownedPaths.length; index += 1) {
    const result = await pi.exec("git", ["-C", cwd, "show", `${treeish}:${ownedPaths[index]}`], {
      cwd, timeout: 15_000,
    });
    if (result.killed || result.code !== 0 || result.stdout !== expected[index]) {
      throw new Error(`future tree content mismatch for ${ownedPaths[index]}`);
    }
  }
}

async function validateCommitBundle(
  pi: ExtensionAPI,
  cwd: string,
  commit: string,
  ownedPaths: string[],
  documents: DispositionParams["documents"],
): Promise<void> {
  if (!sameStrings(await commitPaths(pi, cwd, commit), ownedPaths)) {
    throw new Error("future commit does not contain exactly the owned bundle paths");
  }
  await validateTreeBundle(pi, cwd, commit, ownedPaths, documents);
}

async function findDispositionCommit(
  pi: ExtensionAPI,
  cwd: string,
  dispositionId: string,
  baseHead: string,
  ownedPaths: string[],
): Promise<string | null> {
  const output = await git(
    pi,
    cwd,
    ["log", "--all", "--format=%H", "--fixed-strings", `--grep=Prime-Claw-Disposition: ${dispositionId}`],
    undefined,
  );
  for (const candidate of output.split("\n").filter(Boolean)) {
    const parent = (await git(pi, cwd, ["rev-parse", `${candidate}^`], undefined)).trim();
    if (parent === baseHead && sameStrings(await commitPaths(pi, cwd, candidate), ownedPaths)) return candidate;
  }
  return null;
}

function transactionImmutableMatches(
  transaction: Record<string, unknown>,
  dispositionId: string,
  payloadFingerprint: string,
  params: DispositionParams,
  sessionId: string,
  repoRoot: string,
): boolean {
  const expectedDirectory = join(".ralph", "plans", "future", params.decision.slug);
  const expectedPaths = ["SPECIFICATION.md", "REQUIREMENTS.md", "DECISIONS.md"]
    .map((name) => join(expectedDirectory, name));
  const recordedPaths = Array.isArray(transaction.owned_paths) ? transaction.owned_paths : null;
  return transaction.disposition_id === dispositionId
    && transaction.payload_fingerprint === payloadFingerprint
    && transaction.disposition === "future"
    && transaction.slug === params.decision.slug
    && transaction.bundle_sha256 === sha256(canonicalJson(params.documents))
    && transaction.owner_session_id === sessionId
    && transaction.repository_root === repoRoot
    && (transaction.target_directory === undefined || transaction.target_directory === expectedDirectory)
    && (
      recordedPaths === null
      || (recordedPaths.every((path): path is string => typeof path === "string") && sameStrings(recordedPaths, expectedPaths))
    );
}

function validateFutureOwnershipReceipt(
  path: string,
  expected: {
    dispositionId: string;
    payloadFingerprint: string;
    ownerSessionId: string;
    repositoryRoot: string;
    baseHead: string;
    targetDirectory: string;
  },
): Record<string, unknown> {
  const receipt = readDurableJson(path);
  if (
    receipt.version !== 2
    || receipt.kind !== "future-directory-ownership"
    || receipt.disposition_id !== expected.dispositionId
    || receipt.payload_fingerprint !== expected.payloadFingerprint
    || receipt.owner_session_id !== expected.ownerSessionId
    || receipt.repository_root !== expected.repositoryRoot
    || receipt.base_head !== expected.baseHead
    || receipt.target_directory !== expected.targetDirectory
    || receipt.directory_created_exclusively !== true
  ) {
    throw new Error(`future directory ownership receipt does not match transaction identity: ${path}`);
  }
  identity(receipt.directory_identity, "future directory ownership identity");
  return receipt;
}

function validateCurrentDirectoryOwnership(
  receipt: Record<string, unknown>,
  targetDir: string,
): void {
  assertFilesystemIdentity(
    targetDir,
    receipt.directory_identity,
    "directory",
    "future directory ownership identity",
    false,
  );
}

function validateFileOwnershipReceipt(
  path: string,
  expected: {
    dispositionId: string;
    payloadFingerprint: string;
    ownerSessionId: string;
    repositoryRoot: string;
    targetDirectory: string;
    name: string;
    content: string;
  },
): Record<string, unknown> {
  const receipt = readDurableJson(path);
  if (
    receipt.version !== 1
    || receipt.kind !== "future-file-ownership"
    || receipt.disposition_id !== expected.dispositionId
    || receipt.payload_fingerprint !== expected.payloadFingerprint
    || receipt.owner_session_id !== expected.ownerSessionId
    || receipt.repository_root !== expected.repositoryRoot
    || receipt.target_directory !== expected.targetDirectory
    || receipt.name !== expected.name
    || receipt.sha256 !== sha256(expected.content)
  ) throw new Error(`future file ownership receipt does not match transaction identity: ${path}`);
  identity(receipt.filesystem_identity, `future file ownership identity ${expected.name}`);
  return receipt;
}

function validateBundleOwnershipReceipt(
  path: string,
  expected: {
    dispositionId: string;
    payloadFingerprint: string;
    ownerSessionId: string;
    repositoryRoot: string;
    targetDirectory: string;
    targetDir: string;
    documents: DispositionParams["documents"];
  },
  validateCurrentObjects = true,
): Record<string, unknown> {
  const receipt = readDurableJson(path);
  if (
    receipt.version !== 1
    || receipt.kind !== "future-bundle-ownership"
    || receipt.disposition_id !== expected.dispositionId
    || receipt.payload_fingerprint !== expected.payloadFingerprint
    || receipt.owner_session_id !== expected.ownerSessionId
    || receipt.repository_root !== expected.repositoryRoot
    || receipt.target_directory !== expected.targetDirectory
  ) throw new Error(`future bundle ownership receipt does not match transaction identity: ${path}`);
  identity(receipt.directory_identity, "future bundle directory identity");
  if (validateCurrentObjects) {
    assertFilesystemIdentity(
      expected.targetDir,
      receipt.directory_identity,
      "directory",
      "future bundle directory identity",
    );
  }
  const files = object(receipt.files, "future bundle file identities");
  const documentEntries: Array<[string, string]> = [
    ["SPECIFICATION.md", expected.documents.specification_markdown],
    ["REQUIREMENTS.md", expected.documents.requirements_markdown],
    ["DECISIONS.md", expected.documents.decisions_markdown],
  ];
  if (!sameStrings(Object.keys(files), documentEntries.map(([name]) => name))) {
    throw new Error("future bundle ownership receipt does not contain exactly the owned files");
  }
  for (const [name, content] of documentEntries) {
    const entry = object(files[name], `future bundle ownership entry ${name}`);
    if (entry.sha256 !== sha256(content)) throw new Error(`future bundle ownership hash mismatch: ${name}`);
    identity(entry.filesystem_identity, `future bundle file identity ${name}`);
    if (validateCurrentObjects) {
      assertFilesystemIdentity(
        join(expected.targetDir, name),
        entry.filesystem_identity,
        "file",
        `future bundle file identity ${name}`,
      );
    }
  }
  return receipt;
}

async function validateVerifiedFutureSuccess(
  pi: ExtensionAPI,
  cwd: string,
  state: CanonicalState,
  transaction: Record<string, unknown>,
  expected: {
    dispositionId: string;
    payloadFingerprint: string;
    ownerSessionId: string;
    repositoryRoot: string;
    baseHead: string;
    targetDirectory: string;
    ownershipPath: string;
    bundleOwnershipPath: string;
    indexPath: string;
    targetDir: string;
    ownedPaths: string[];
    documents: DispositionParams["documents"];
  },
): Promise<string> {
  const commit = transaction.commit_sha;
  const oidFields = [
    "base_head",
    "remote_base_head",
    "private_tree",
    "commit_object_sha",
    "commit_sha",
    "verified_head",
    "verified_upstream_head",
    "verified_remote_head",
    "remote_oid_before_push",
  ];
  for (const field of oidFields) {
    const value = transaction[field];
    if (value !== undefined && (typeof value !== "string" || !GIT_OID.test(value))) {
      throw new Error(`verified-success journal has an invalid ${field} object ID`);
    }
  }
  if (
    transaction.status !== "verified-success"
    || transaction.phase !== "pushed-and-clean"
    || typeof commit !== "string"
    || transaction.base_head !== expected.baseHead
    || transaction.remote_base_head !== expected.baseHead
    || transaction.commit_object_sha !== commit
    || transaction.verified_head !== commit
    || transaction.verified_upstream_head !== commit
    || transaction.verified_remote_head !== commit
    || (transaction.remote_oid_before_push !== undefined
      && transaction.remote_oid_before_push !== expected.baseHead
      && transaction.remote_oid_before_push !== commit)
    || typeof transaction.private_tree !== "string"
    || transaction.checkout_clean !== true
    || transaction.episode_resources_allocated !== false
    || transaction.ownership_receipt_path !== expected.ownershipPath
    || transaction.bundle_ownership_receipt_path !== expected.bundleOwnershipPath
    || transaction.private_index_path !== expected.indexPath
    || typeof transaction.private_index_sha256 !== "string"
    || !/^[0-9a-f]{64}$/.test(transaction.private_index_sha256)
  ) {
    throw new Error("verified-success journal is missing required success invariants");
  }
  validateFutureOwnershipReceipt(expected.ownershipPath, {
    dispositionId: expected.dispositionId,
    payloadFingerprint: expected.payloadFingerprint,
    ownerSessionId: expected.ownerSessionId,
    repositoryRoot: expected.repositoryRoot,
    baseHead: expected.baseHead,
    targetDirectory: expected.targetDirectory,
  });
  validateBundleOwnershipReceipt(expected.bundleOwnershipPath, {
    dispositionId: expected.dispositionId,
    payloadFingerprint: expected.payloadFingerprint,
    ownerSessionId: expected.ownerSessionId,
    repositoryRoot: expected.repositoryRoot,
    targetDirectory: expected.targetDirectory,
    targetDir: expected.targetDir,
    documents: expected.documents,
  }, false);
  const commitTree = (await git(pi, cwd, ["rev-parse", `${commit}^{tree}`], undefined)).trim();
  if (commitTree !== transaction.private_tree) {
    throw new Error("verified-success private tree does not equal the committed tree");
  }
  const hashes = object(transaction.document_hashes, "verified future document hashes");
  const expectedHashes: Record<string, string> = {
    "SPECIFICATION.md": sha256(expected.documents.specification_markdown),
    "REQUIREMENTS.md": sha256(expected.documents.requirements_markdown),
    "DECISIONS.md": sha256(expected.documents.decisions_markdown),
  };
  if (Object.entries(expectedHashes).some(([name, hash]) => hashes[name] !== hash)) {
    throw new Error("verified-success journal document hashes do not match the disposition bundle");
  }
  const parent = (await git(pi, cwd, ["rev-parse", `${commit}^`], undefined)).trim();
  if (parent !== expected.baseHead) throw new Error("verified future commit parent does not match recorded base");
  await validateCommitBundle(pi, cwd, commit, expected.ownedPaths, expected.documents);
  const remoteOid = await remoteRefOid(pi, cwd, state.remote, state.remoteBranch);
  if (remoteOid !== commit && !(await gitIsAncestor(pi, cwd, commit, remoteOid))) {
    throw new Error(`verified future commit ${commit} is not durable on actual remote ${remoteOid}`);
  }
  return remoteOid;
}

async function reconcileFutureState(
  pi: ExtensionAPI,
  cwd: string,
  transaction: Record<string, unknown>,
  ownedPaths: string[],
  documents: DispositionParams["documents"],
): Promise<Record<string, unknown>> {
  let state: CanonicalState | null = null;
  const observationErrors: string[] = [];
  try {
    state = await inspectCanonicalRepository(pi, cwd, undefined);
  } catch (error) {
    observationErrors.push(`repository: ${errorMessage(error)}`);
  }

  const observedFiles: Record<string, unknown> = {};
  const targetRelative = typeof transaction.target_directory === "string"
    ? transaction.target_directory
    : null;
  const target = targetRelative ? join(cwd, targetRelative) : null;
  let targetKind = "missing";
  let targetEntries: string[] = [];
  if (target && existsSync(target)) {
    try {
      const targetStat = lstatSync(target);
      if (targetStat.isSymbolicLink()) {
        targetKind = "symlink";
      } else if (!targetStat.isDirectory()) {
        targetKind = "other";
      } else {
        targetKind = "directory";
        targetEntries = readdirSync(target).sort();
        for (const name of targetEntries) {
          const path = join(target, name);
          const stat = lstatSync(path);
          const relativePath = join(targetRelative!, name);
          if (stat.isSymbolicLink()) observedFiles[relativePath] = { kind: "symlink" };
          else if (stat.isFile()) observedFiles[relativePath] = {
            kind: "file",
            size: stat.size,
            sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
          };
          else observedFiles[relativePath] = { kind: "other" };
        }
      }
    } catch (error) {
      observationErrors.push(`owned files: ${errorMessage(error)}`);
    }
  }

  const dispositionId = typeof transaction.disposition_id === "string" ? transaction.disposition_id : "unknown";
  let privateIndex: Record<string, unknown> = { exists: false };
  if (state && REQUEST_ID.test(dispositionId)) {
    try {
      const privateIndexPath = join(
        state.commonDir, CONTROL_DIR, "indexes", `${dispositionId}.index`,
      );
      const observed = secureFs<{ exists: boolean; size?: number; sha256?: string }>({
        operation: "read-file",
        root: state.commonDir,
        path: `${CONTROL_DIR}/indexes/${dispositionId}.index`,
        allow_missing: true,
      });
      privateIndex = observed.exists
        ? { exists: true, path: privateIndexPath, size: observed.size, sha256: observed.sha256 }
        : { exists: false };
    } catch (error) {
      observationErrors.push(`private index: ${errorMessage(error)}`);
    }
  }

  const commit = typeof transaction.commit_sha === "string"
    ? transaction.commit_sha
    : typeof transaction.commit_object_sha === "string"
      ? transaction.commit_object_sha
      : null;
  let commitObservation: Record<string, unknown> = { oid: commit, exists: false };
  if (commit) {
    try {
      await git(pi, cwd, ["cat-file", "-e", `${commit}^{commit}`], undefined);
      const paths = await commitPaths(pi, cwd, commit);
      let contentMatches = false;
      try {
        await validateCommitBundle(pi, cwd, commit, ownedPaths, documents);
        contentMatches = true;
      } catch (error) {
        observationErrors.push(`commit content: ${errorMessage(error)}`);
      }
      commitObservation = { oid: commit, exists: true, paths, content_matches: contentMatches };
    } catch (error) {
      observationErrors.push(`commit: ${errorMessage(error)}`);
    }
  }

  let finalState: CanonicalState | null = null;
  let finalRemoteOid: string | null = null;
  let finalStagedPaths: string[] = [];
  try {
    const beforeFinal = await inspectCanonicalRepository(pi, cwd, undefined);
    const beforeRemote = await remoteRefOid(pi, cwd, beforeFinal.remote, beforeFinal.remoteBranch);
    finalStagedPaths = (await git(
      pi, cwd, ["diff", "--cached", "--name-only", "-z"], undefined,
    )).split("\0").filter(Boolean);
    const afterFinal = await inspectCanonicalRepository(pi, cwd, undefined);
    const afterRemote = await remoteRefOid(pi, cwd, afterFinal.remote, afterFinal.remoteBranch);
    if (
      beforeFinal.head !== afterFinal.head
      || beforeFinal.upstreamHead !== afterFinal.upstreamHead
      || beforeFinal.status !== afterFinal.status
      || beforeRemote !== afterRemote
    ) throw new Error("repository or remote changed while collecting the final current-state observation");
    finalState = afterFinal;
    finalRemoteOid = afterRemote;
  } catch (error) {
    observationErrors.push(`final current state: ${errorMessage(error)}`);
  }
  const observedAt = new Date().toISOString();

  return {
    ...transaction,
    observed_at: observedAt,
    observed_head: finalState?.head ?? null,
    observed_upstream_head: finalState?.upstreamHead ?? null,
    observed_remote_head: finalRemoteOid,
    observed_status_paths: finalState ? porcelainPaths(finalState.status) : [],
    observed_staged_paths: finalStagedPaths,
    observed_target_kind: targetKind,
    observed_target_entries: targetEntries,
    observed_owned_paths: Object.keys(observedFiles),
    observed_owned_files: observedFiles,
    observed_private_index: privateIndex,
    observed_commit: commitObservation,
    observation_errors: observationErrors,
  };
}

async function executeFutureTransaction(
  pi: ExtensionAPI,
  params: DispositionParams,
  ctx: ExtensionContext,
  signal: AbortSignal | undefined,
  base: {
    sessionId: string;
    resolvedSessionFile: string;
    state: CanonicalState;
    dispositionId: string;
    payloadFingerprint: string;
    bundleSha256: string;
    requestKey: string;
    requestPath: string;
    requestCreated: boolean;
    receiptPath: string;
    receiptCreated: boolean;
  },
): Promise<Record<string, unknown>> {
  const { sessionId, resolvedSessionFile, dispositionId, payloadFingerprint, bundleSha256 } = base;
  const cwd = base.state.repoRoot;
  const controlRoot = ensureControlDirectory(base.state.commonDir);
  const transactionPath = join(ensureControlDirectory(base.state.commonDir, "future-transactions"), `${dispositionId}.json`);
  const attemptPath = join(ensureControlDirectory(base.state.commonDir, "future-attempts"), `${base.requestKey}.json`);
  const blockerPath = join(controlRoot, "future-mutation-blocked.json");
  const initialControlWrites = [
    ...(base.requestCreated ? [base.requestPath] : []),
    ...(base.receiptCreated ? [base.receiptPath] : []),
  ];
  const lockPath = join(ensureControlDirectory(base.state.commonDir, "locks"), "project-mutation.lock");
  const indexPath = join(controlRoot, "indexes", `${dispositionId}.index`);
  const ownershipPath = controlFilePath(base.state.commonDir, "future-ownership", `${dispositionId}.json`);
  const bundleOwnershipPath = controlFilePath(
    base.state.commonDir,
    "future-bundle-ownership",
    `${dispositionId}.json`,
  );
  const ownershipConsumedPath = join(
    ensureControlDirectory(base.state.commonDir, "future-ownership-consumed"),
    `${dispositionId}.json`,
  );
  const relativeDir = join(".ralph", "plans", "future", params.decision.slug);
  const targetDir = join(cwd, relativeDir);
  const documentEntries: Array<[string, string]> = [
    ["SPECIFICATION.md", params.documents.specification_markdown],
    ["REQUIREMENTS.md", params.documents.requirements_markdown],
    ["DECISIONS.md", params.documents.decisions_markdown],
  ];
  const ownedPaths = documentEntries.map(([name]) => join(relativeDir, name));
  const fileOwnershipPaths = Object.fromEntries(documentEntries.map(([name]) => [
    name,
    controlFilePath(base.state.commonDir, "future-file-ownership", `${dispositionId}.${name}.json`),
  ])) as Record<string, string>;
  let preserveSuccessEvidence = false;
  let transaction: Record<string, unknown> | null = existsSync(transactionPath)
    ? readDurableJson(transactionPath)
    : null;
  preserveSuccessEvidence = transaction?.status === "verified-success";
  if (transaction && transaction.status !== "verified-success" && !transactionImmutableMatches(
    transaction, dispositionId, payloadFingerprint, params, sessionId, cwd,
  )) {
    throw new Error(`future transaction collision at ${transactionPath}`);
  }

  const writeAttempt = (value: Record<string, unknown>) => replaceDurableJson(attemptPath, {
    version: 1,
    request_id: params.request_id,
    disposition_id: dispositionId,
    owner_session_id: sessionId,
    transaction_path: transactionPath,
    ...value,
  });

  let productMutated = false;
  let ownershipProven = false;
  let ownershipReceipt: Record<string, unknown> | null = null;
  let ownedDirectoryIdentity: FilesystemIdentity | null = null;
  let ownershipCreated = false;
  const fileOwnershipCreated: string[] = [];
  let bundleOwnershipCreated = false;
  let ownershipConsumedCreated = false;
  let lockReleaseError: string | null = null;
  const controlWrites = (...paths: string[]) => [
    ...initialControlWrites,
    ...(ownershipCreated ? [ownershipPath] : []),
    ...fileOwnershipCreated,
    ...(bundleOwnershipCreated ? [bundleOwnershipPath] : []),
    ...(ownershipConsumedCreated ? [ownershipConsumedPath] : []),
    ...paths,
  ];

  writeAttempt({ status: "waiting-for-lock", phase: transaction?.phase ?? "validated", observed_at: new Date().toISOString() });
  let lock: ProjectLock;
  try {
    lock = acquireProjectLock(lockPath, dispositionId, sessionId);
  } catch (error) {
    if (!(error instanceof LockContentionError)) throw error;
    writeAttempt({
      status: "lock-contention",
      phase: "lock-acquire",
      lock_path: error.lockPath,
      lock_owner: error.owner,
      next_safe_action: "retry only after the recorded owner releases the lock; never steal an ambiguous lock",
      observed_at: new Date().toISOString(),
    });
    return {
      status: "lock-contention",
      phase: "lock-acquire",
      disposition: "future",
      disposition_id: dispositionId,
      lock_path: error.lockPath,
      lock_owner: error.owner,
      attempt_path: attemptPath,
      preflight_receipt_path: base.receiptPath,
      product_resource_mutation_performed: false,
      next_safe_action: "retry only after the recorded owner releases the lock; never steal an ambiguous lock",
      control_state_writes_performed: controlWrites(attemptPath),
    };
  }

  try {
    const state = await inspectCanonicalRepository(pi, cwd, signal);
    if (state.commonDir !== base.state.commonDir) throw new Error("Git common directory changed while acquiring project lock");

    transaction = existsSync(transactionPath) ? readDurableJson(transactionPath) : null;
    if (transaction?.status === "recovered-clean") {
      const error = "this future transaction was explicitly removed; submit a new disposition identity to restart";
      if (!transactionImmutableMatches(
        transaction, dispositionId, payloadFingerprint, params, sessionId, cwd,
      )) {
        return {
          status: "failed",
          phase: "terminal-recovered-clean",
          error: `recovered-clean transaction identity does not match ${transactionPath}`,
          terminal_journal_preserved: true,
          preflight_receipt_path: base.receiptPath,
          transaction_path: transactionPath,
          attempt_path: attemptPath,
          product_resource_mutation_performed: false,
          control_state_writes_performed: controlWrites(attemptPath),
        };
      }
      writeAttempt({
        status: "terminal-recovered-clean",
        phase: "terminal-recovered-clean",
        error,
        observed_at: new Date().toISOString(),
      });
      return {
        ...transaction,
        status: "failed",
        phase: "terminal-recovered-clean",
        error,
        terminal_journal_preserved: true,
        product_resource_mutation_performed: false,
        preflight_receipt_path: base.receiptPath,
        transaction_path: transactionPath,
        attempt_path: attemptPath,
        deduplicated: true,
        control_state_writes_performed: controlWrites(attemptPath),
      };
    }
    if (transaction?.status === "verified-success") {
      // From this point the transaction journal is immutable evidence. Every
      // validation failure must write diagnostics only to the attempt record.
      preserveSuccessEvidence = true;
      let observed: Record<string, unknown> = {};
      try {
        if (!transactionImmutableMatches(
          transaction, dispositionId, payloadFingerprint, params, sessionId, cwd,
        )) throw new Error(`verified-success transaction identity does not match ${transactionPath}`);
        if (existsSync(blockerPath)) {
          const blocker = readDurableJson(blockerPath);
          if (blocker.disposition_id !== dispositionId) {
            throw new Error(`another future transaction requires recovery: ${blocker.disposition_id}`);
          }
        }
        const successBase = typeof transaction.base_head === "string" ? transaction.base_head : "";
        if (!GIT_OID.test(successBase)) throw new Error("verified-success journal has an invalid base object ID");
        await validateVerifiedFutureSuccess(pi, cwd, state, transaction, {
          dispositionId,
          payloadFingerprint,
          ownerSessionId: sessionId,
          repositoryRoot: cwd,
          baseHead: successBase,
          targetDirectory: relativeDir,
          ownershipPath,
          bundleOwnershipPath,
          indexPath,
          targetDir,
          ownedPaths,
          documents: params.documents,
        });
        // Only after all historical evidence is validated do we collect the
        // one snapshot allowed to describe current state.
        observed = await reconcileFutureState(pi, cwd, transaction, ownedPaths, params.documents);
        const observationErrors = Array.isArray(observed.observation_errors)
          ? observed.observation_errors
          : ["replay did not produce an observation error list"];
        if (observationErrors.length !== 0) {
          throw new Error(`verified-success replay observation failed: ${observationErrors.join("; ")}`);
        }
      } catch (error) {
        const failure = errorMessage(error);
        try {
          writeAttempt({
            status: "corrupt-success",
            phase: "success-validation-failed",
            error: failure,
            next_safe_action: "preserve the journal and blocker; inspect without normalizing success evidence",
            observed_at: new Date().toISOString(),
          });
        } catch {
          // The transaction journal and blocker remain immutable even when a
          // separate diagnostic receipt cannot be written safely.
        }
        const currentPaths = Array.isArray(observed.observed_status_paths)
          ? observed.observed_status_paths.filter((path): path is string => typeof path === "string")
          : [];
        return {
          status: "failed",
          phase: "success-validation-failed",
          error: failure,
          corrupt_success_journal_preserved: true,
          historical_status: transaction.status,
          checkout_clean: false,
          current_checkout_clean: false,
          current_status_paths: currentPaths,
          current_head: observed.observed_head ?? null,
          current_upstream_head: observed.observed_upstream_head ?? null,
          current_remote_head: observed.observed_remote_head ?? null,
          current_observed_at: observed.observed_at ?? null,
          observation_errors: observed.observation_errors ?? [],
          preflight_receipt_path: base.receiptPath,
          transaction_path: transactionPath,
          attempt_path: attemptPath,
          deduplicated: false,
          recovery_action_required: true,
          control_state_writes_performed: controlWrites(attemptPath),
        };
      }
      if (existsSync(blockerPath) && readDurableJson(blockerPath).disposition_id === dispositionId) {
        removeDurableFile(blockerPath);
      }
      writeAttempt({ status: "deduplicated-success", phase: "verified-success", observed_at: new Date().toISOString() });
      const currentPaths = (observed.observed_status_paths as string[]) ?? [];
      return {
        version: transaction.version,
        disposition_id: transaction.disposition_id,
        payload_fingerprint: transaction.payload_fingerprint,
        disposition: transaction.disposition,
        slug: transaction.slug,
        bundle_sha256: transaction.bundle_sha256,
        owner_session_id: transaction.owner_session_id,
        repository_root: transaction.repository_root,
        git_common_dir: transaction.git_common_dir,
        target_directory: transaction.target_directory,
        owned_paths: transaction.owned_paths,
        status: transaction.status,
        phase: transaction.phase,
        commit_sha: transaction.commit_sha,
        commit_object_sha: transaction.commit_object_sha,
        private_tree: transaction.private_tree,
        document_hashes: transaction.document_hashes,
        ownership_receipt_path: transaction.ownership_receipt_path,
        bundle_ownership_receipt_path: transaction.bundle_ownership_receipt_path,
        verified_head: transaction.verified_head,
        verified_upstream_head: transaction.verified_upstream_head,
        verified_remote_head: transaction.verified_remote_head,
        verified_at: transaction.verified_at,
        episode_resources_allocated: false,
        historical_checkout_clean: transaction.checkout_clean,
        checkout_clean: currentPaths.length === 0,
        current_checkout_clean: currentPaths.length === 0,
        current_status_paths: currentPaths,
        current_head: observed.observed_head,
        current_upstream_head: observed.observed_upstream_head,
        current_remote_head: observed.observed_remote_head,
        current_observed_at: observed.observed_at,
        preflight_receipt_path: base.receiptPath,
        transaction_path: transactionPath,
        attempt_path: attemptPath,
        deduplicated: true,
        control_state_writes_performed: controlWrites(attemptPath),
      };
    }

    if (transaction && !transactionImmutableMatches(
      transaction, dispositionId, payloadFingerprint, params, sessionId, cwd,
    )) throw new Error(`future transaction collision at ${transactionPath}`);
    if (existsSync(blockerPath)) {
      const blocker = readDurableJson(blockerPath);
      if (blocker.disposition_id !== dispositionId) {
        throw new Error(`another future transaction requires recovery: ${blocker.disposition_id}`);
      }
    }

    if (transaction?.ownership_receipt_path !== undefined && transaction.ownership_receipt_path !== ownershipPath) {
      throw new Error("future transaction ownership-receipt path does not match the derived control path");
    }
    if (transaction?.bundle_ownership_receipt_path !== undefined
      && transaction.bundle_ownership_receipt_path !== bundleOwnershipPath) {
      throw new Error("future transaction bundle-ownership path does not match the derived control path");
    }
    if (existsSync(ownershipPath)) {
      const ownershipBase = typeof transaction?.base_head === "string" ? transaction.base_head : state.head;
      ownershipReceipt = validateFutureOwnershipReceipt(ownershipPath, {
        dispositionId,
        payloadFingerprint,
        ownerSessionId: sessionId,
        repositoryRoot: cwd,
        baseHead: ownershipBase,
        targetDirectory: relativeDir,
      });
      ownedDirectoryIdentity = identity(ownershipReceipt.directory_identity, "future directory ownership identity");
      ownershipProven = true;
    }


    if (
      transaction
      && !ownershipProven
      && (typeof transaction.commit_sha === "string" || typeof transaction.commit_object_sha === "string")
    ) {
      productMutated = true;
      throw new Error("future transaction records a commit but its immutable directory ownership receipt is missing");
    }

    if (transaction && !params.recovery_action) {
      const observed = await reconcileFutureState(pi, cwd, transaction, ownedPaths, params.documents);
      const nextSafeAction = transaction.status === "running"
        ? "inspect or explicitly recover the interrupted transaction"
        : "inspect, continue, or remove-owned-uncommitted with explicit operator approval";
      writeAttempt({
        status: "recovery-required",
        phase: transaction.phase,
        recovery_action_required: true,
        next_safe_action: nextSafeAction,
        observed_at: new Date().toISOString(),
      });
      return {
        ...observed,
        status: "recovery-required",
        preflight_receipt_path: base.receiptPath,
        transaction_path: transactionPath,
        attempt_path: attemptPath,
        recovery_action_required: true,
        next_safe_action: nextSafeAction,
        deduplicated: true,
        control_state_writes_performed: controlWrites(attemptPath),
      };
    }

    if (params.recovery_action === "inspect") {
      if (!transaction) throw new Error("no interrupted future transaction exists to inspect");
      const observed = await reconcileFutureState(pi, cwd, transaction, ownedPaths, params.documents);
      writeAttempt({ status: "inspected", phase: transaction.phase, observed_at: new Date().toISOString() });
      return {
        ...observed,
        preflight_receipt_path: base.receiptPath,
        transaction_path: transactionPath,
        attempt_path: attemptPath,
        deduplicated: true,
        control_state_writes_performed: controlWrites(attemptPath),
      };
    }

    const futureRoot = ensureFutureRoot(cwd, false);
    const baseHead = typeof transaction?.base_head === "string" ? transaction.base_head : state.head;
    productMutated = ownershipProven && (
      existsSync(targetDir)
      || typeof transaction?.commit_sha === "string"
      || typeof transaction?.commit_object_sha === "string"
    );
    if (transaction?.private_index_path !== undefined && transaction.private_index_path !== indexPath) {
      throw new Error("future transaction private-index path does not match the derived control path");
    }
    if (!GIT_OID.test(baseHead)) throw new Error("future transaction has an invalid recorded base object ID");
    if (typeof transaction?.commit_sha === "string" && !GIT_OID.test(transaction.commit_sha)) {
      throw new Error("future transaction has an invalid recorded commit object ID");
    }
    if (typeof transaction?.commit_object_sha === "string" && !GIT_OID.test(transaction.commit_object_sha)) {
      throw new Error("future transaction has an invalid recorded commit-object ID");
    }

    if (params.recovery_action === "remove-owned-uncommitted") {
      if (!transaction) throw new Error("no interrupted future transaction exists to remove");
      if (transaction.status !== "failed" && transaction.status !== "running") {
        throw new Error("removal authority is not live for this completed or retired transaction");
      }
      const ownershipConsumedPreflight = controlFilePath(
        base.state.commonDir,
        "future-ownership-consumed",
        `${dispositionId}.json`,
      );
      if (ownershipConsumedPreflight !== ownershipConsumedPath) {
        throw new Error("derived ownership-consumption path changed");
      }
      if (existsSync(ownershipConsumedPreflight)) {
        throw new Error("removal authority for this transaction was already consumed");
      }
      if (!productMutated || !ownershipProven || !existsSync(ownershipPath)) {
        throw new Error("refusing removal without immutable file ownership proof and a directory mutation guard");
      }
      const directoryReceipt = validateFutureOwnershipReceipt(ownershipPath, {
        dispositionId,
        payloadFingerprint,
        ownerSessionId: sessionId,
        repositoryRoot: cwd,
        baseHead,
        targetDirectory: relativeDir,
      });
      if (transaction.bundle_ownership_receipt_path !== bundleOwnershipPath || !existsSync(bundleOwnershipPath)) {
        throw new Error("refusing removal without immutable proof of the owned file objects and directory guard");
      }
      let bundleReceipt = validateBundleOwnershipReceipt(bundleOwnershipPath, {
        dispositionId,
        payloadFingerprint,
        ownerSessionId: sessionId,
        repositoryRoot: cwd,
        targetDirectory: relativeDir,
        targetDir,
        documents: params.documents,
      }, false);
      if (typeof transaction.commit_sha === "string" || typeof transaction.commit_object_sha === "string") {
        throw new Error("cannot remove a future transaction after a commit object exists; inspect and reconcile the commit");
      }
      if (state.head !== baseHead) throw new Error("cannot remove owned files because HEAD changed from the recorded base");
      validateRemovableOwnedBundle(futureRoot, targetDir, params.documents);
      const dirty = porcelainPaths(state.status);
      if (dirty.some((path) => !ownedPaths.includes(path))) {
        throw new Error(`cannot remove while unrelated dirty paths exist: ${dirty.join(", ")}`);
      }
      const staged = (await git(pi, cwd, ["diff", "--cached", "--name-only", "-z"], undefined)).split("\0").filter(Boolean);
      if (staged.some((path) => !ownedPaths.includes(path))) {
        throw new Error(`cannot remove while unrelated staged paths exist: ${staged.join(", ")}`);
      }
      if (staged.length) await git(pi, cwd, ["restore", "--staged", "--", ...ownedPaths], undefined);

      // Re-resolve all destructive control children after the final awaited Git
      // boundary, then revalidate object-bound product ownership. No await occurs
      // again until the tombstone, product unlinks, and private-index unlink finish.
      const ownershipConsumedPathAtUse = controlFilePath(
        base.state.commonDir,
        "future-ownership-consumed",
        `${dispositionId}.json`,
      );
      if (ownershipConsumedPathAtUse !== ownershipConsumedPath) {
        throw new Error("derived ownership-consumption path changed");
      }
      controlFilePath(base.state.commonDir, "indexes", `${dispositionId}.index`);
      if (existsSync(ownershipConsumedPathAtUse)) {
        throw new Error("removal authority for this transaction was already consumed");
      }
      bundleReceipt = validateBundleOwnershipReceipt(bundleOwnershipPath, {
        dispositionId,
        payloadFingerprint,
        ownerSessionId: sessionId,
        repositoryRoot: cwd,
        targetDirectory: relativeDir,
        targetDir,
        documents: params.documents,
      }, false);
      const bundleFiles = object(bundleReceipt.files, "future bundle file identities");
      const removalFiles = documentEntries.map(([name, content]) => {
        const fileEntry = object(bundleFiles[name], `future bundle ownership entry ${name}`);
        return {
          name,
          content,
          identity: identity(fileEntry.filesystem_identity, `future bundle file identity ${name}`),
        };
      });
      if (typeof transaction.private_index_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(transaction.private_index_sha256)) {
        throw new Error("refusing removal without a valid private-index ownership hash");
      }
      const tombstone = {
        version: 1,
        kind: "future-directory-ownership-consumed",
        disposition_id: dispositionId,
        payload_fingerprint: payloadFingerprint,
        owner_session_id: sessionId,
        repository_root: cwd,
        target_directory: relativeDir,
        ownership_receipt_sha256: sha256(readDurableFile(ownershipPath)),
        bundle_ownership_receipt_sha256: sha256(readDurableFile(bundleOwnershipPath)),
        consumed_for: "remove-owned-uncommitted",
        consumed_at: new Date().toISOString(),
      };
      const removal = secureFs<{ consumed_created: boolean }>({
        operation: "remove-bundle",
        repo: cwd,
        common_dir: base.state.commonDir,
        target_path: relativeDir.split("\\").join("/"),
        directory_identity: identity(bundleReceipt.directory_identity, "future bundle directory identity"),
        files: removalFiles,
        consumed_name: `${dispositionId}.json`,
        tombstone_text: canonicalJson(tombstone),
        index_name: `${dispositionId}.index`,
        index_sha256: transaction.private_index_sha256,
      });
      ownershipConsumedCreated = removal.consumed_created;
      if (!ownershipConsumedCreated) throw new Error("removal authority was not consumed safely");
      // Keep the shared future-plan parent. Its earlier absence is an observation,
      // not transaction-specific proof that this transaction exclusively created it.
      const after = await inspectCanonicalRepository(pi, cwd, undefined);
      if (after.status.length !== 0 || after.head !== baseHead) {
        throw new Error("owned-file removal did not restore the recorded clean base");
      }
      transaction = {
        ...transaction,
        status: "recovered-clean",
        phase: "owned-uncommitted-removed",
        product_resource_mutation_performed: false,
        recovery_action: "remove-owned-uncommitted",
        ownership_consumed_path: ownershipConsumedPathAtUse,
        recovered_at: new Date().toISOString(),
        next_safe_action: "submit a new explicitly confirmed future disposition if incubation is still desired",
      };
      replaceDurableJson(transactionPath, transaction);
      if (existsSync(blockerPath) && readDurableJson(blockerPath).disposition_id === dispositionId) removeDurableFile(blockerPath);
      writeAttempt({ status: "recovered-clean", phase: "owned-uncommitted-removed", observed_at: new Date().toISOString() });
      return {
        ...transaction,
        preflight_receipt_path: base.receiptPath,
        transaction_path: transactionPath,
        attempt_path: attemptPath,
        deduplicated: false,
        control_state_writes_performed: controlWrites(transactionPath, attemptPath),
      };
    }

    if (transaction && params.recovery_action !== "continue") {
      throw new Error("interrupted future transaction requires an explicit recovery_action");
    }
    if (!transaction && params.recovery_action) {
      throw new Error("no interrupted future transaction exists to recover");
    }
    if (transaction && productMutated && transaction.ownership_receipt_path === undefined) {
      transaction = {
        ...transaction,
        ownership_receipt_path: ownershipPath,
        product_resource_mutation_performed: true,
      };
      replaceDurableJson(transactionPath, transaction);
    }

    if (transaction) {
      const recoveryDirty = porcelainPaths(state.status);
      if (productMutated) {
        if (recoveryDirty.some((path) => !ownedPaths.includes(path))) {
          throw new Error(`cannot continue while unrelated dirty paths exist: ${recoveryDirty.join(", ")}`);
        }
        validateFutureTargetDirectory(futureRoot, targetDir);
        const recoveryRemoteHead = await remoteRefOid(pi, cwd, state.remote, state.remoteBranch);
        const recordedCommit = typeof transaction.commit_sha === "string"
          ? transaction.commit_sha
          : typeof transaction.commit_object_sha === "string"
            ? transaction.commit_object_sha
            : null;
        const allowedRecoveryOids = recordedCommit ? [baseHead, recordedCommit] : [baseHead];
        if (
          !allowedRecoveryOids.includes(state.head)
          || !allowedRecoveryOids.includes(state.upstreamHead)
          || !allowedRecoveryOids.includes(recoveryRemoteHead)
        ) {
          throw new Error(
            `future recovery state diverged: HEAD=${state.head} upstream=${state.upstreamHead} remote=${recoveryRemoteHead}`,
          );
        }
      } else {
        if (recoveryDirty.length !== 0) {
          throw new Error(`canonical checkout still has pre-existing dirty paths: ${recoveryDirty.join(", ")}`);
        }
        if (state.head !== baseHead) {
          throw new Error(`canonical checkout HEAD ${state.head} changed from recorded recovery base ${baseHead}`);
        }
        if (state.head !== state.upstreamHead) {
          throw new Error(`canonical checkout HEAD ${state.head} differs from upstream ${state.upstreamHead}`);
        }
        const recoveryRemoteHead = await remoteRefOid(pi, cwd, state.remote, state.remoteBranch);
        if (state.head !== recoveryRemoteHead) {
          throw new Error(`canonical checkout HEAD ${state.head} differs from remote default ${recoveryRemoteHead}`);
        }
        if (existsSync(targetDir)) {
          throw new Error(`future bundle path exists without recorded product ownership: ${relativeDir}`);
        }
      }
    }

    if (!transaction) {
      if (state.status.length !== 0) {
        throw new Error(`canonical checkout has pre-existing dirty paths: ${porcelainPaths(state.status).join(", ")}`);
      }
      if (state.head !== state.upstreamHead) {
        throw new Error(`canonical checkout HEAD ${state.head} differs from upstream ${state.upstreamHead}`);
      }
      const remoteHead = await remoteRefOid(pi, cwd, state.remote, state.remoteBranch);
      if (state.head !== remoteHead) {
        throw new Error(`canonical checkout HEAD ${state.head} differs from remote default ${remoteHead}`);
      }
      if (existsSync(targetDir)) throw new Error(`future bundle path already exists: ${relativeDir}`);
      transaction = {
        version: 1,
        disposition_id: dispositionId,
        payload_fingerprint: payloadFingerprint,
        disposition: "future",
        slug: params.decision.slug,
        bundle_sha256: bundleSha256,
        owner_session_id: sessionId,
        owner_session_file: resolvedSessionFile,
        repository_root: cwd,
        git_common_dir: state.commonDir,
        current_branch: state.currentBranch,
        upstream_branch: state.upstream,
        remote_default_branch: state.defaultRemoteBranch,
        base_head: state.head,
        remote_base_head: remoteHead,
        target_directory: relativeDir,
        future_root_preexisting: existsSync(ensureFutureRoot(cwd, false)),
        owned_paths: ownedPaths,
        status: "running",
        phase: "journal-created",
        product_resource_mutation_performed: false,
        created_at: new Date().toISOString(),
        next_safe_action: "the owning invocation may continue under the project lock",
      };
      replaceDurableJson(transactionPath, transaction);
      await testFault(pi, "journal-created");
    } else {
      if (state.head !== baseHead && typeof transaction.commit_sha !== "string") {
        const recoveredCommit = await findDispositionCommit(pi, cwd, dispositionId, baseHead, ownedPaths);
        if (recoveredCommit) transaction = { ...transaction, commit_sha: recoveredCommit, phase: "commit-reconciled" };
        else throw new Error(`HEAD changed from recorded base ${baseHead}; refusing implicit recovery`);
      }
    }

    let commitSha = typeof transaction.commit_sha === "string" ? transaction.commit_sha : null;
    let commitObjectSha = typeof transaction.commit_object_sha === "string"
      ? transaction.commit_object_sha
      : commitSha;

    if (!commitObjectSha) {
      if (!existsSync(targetDir) && ownershipProven) {
        throw new Error("immutable ownership receipt exists but its directory is absent; refusing automatic recreation");
      }
      if (!existsSync(targetDir)) {
        ensureFutureRoot(cwd, true);
        const createdDirectory = secureFs<{ identity: unknown }>({
          operation: "create-directory",
          repo: cwd,
          path: relativeDir.split("\\").join("/"),
        });
        ownedDirectoryIdentity = identity(createdDirectory.identity, "created future directory identity");
        productMutated = true;
        ownershipCreated = createDurableJson(ownershipPath, {
          version: 2,
          kind: "future-directory-ownership",
          disposition_id: dispositionId,
          payload_fingerprint: payloadFingerprint,
          owner_session_id: sessionId,
          repository_root: cwd,
          base_head: baseHead,
          target_directory: relativeDir,
          directory_created_exclusively: true,
          directory_identity: ownedDirectoryIdentity,
          created_at: new Date().toISOString(),
        });
        if (!ownershipCreated) {
          throw new Error(`future directory ownership receipt already exists: ${ownershipPath}`);
        }
        transaction = {
          ...transaction,
          phase: "directory-created",
          product_resource_mutation_performed: true,
          ownership_receipt_path: ownershipPath,
        };
        replaceDurableJson(transactionPath, transaction);
        await testFault(pi, "directory-created");
      } else if (!productMutated) {
        throw new Error(`future bundle path already exists without transaction ownership: ${relativeDir}`);
      }

      if (!ownedDirectoryIdentity) throw new Error("owned directory identity is unavailable");
      for (const [name, content] of documentEntries) {
        validateFutureTargetDirectory(futureRoot, targetDir);
        const path = join(targetDir, name);
        const fileReceiptPath = fileOwnershipPaths[name];
        if (!existsSync(path)) {
          transaction = { ...transaction, phase: `writing-${name}` };
          replaceDurableJson(transactionPath, transaction);
          const createdFile = secureFs<{ identity: unknown }>({
            operation: "create-file",
            repo: cwd,
            path: join(relativeDir, name).split("\\").join("/"),
            content,
            directory_identity: ownedDirectoryIdentity,
          });
          const createdIdentity = identity(createdFile.identity, `created future file identity ${name}`);
          productMutated = true;
          if (!createDurableJson(fileReceiptPath, {
            version: 1,
            kind: "future-file-ownership",
            disposition_id: dispositionId,
            payload_fingerprint: payloadFingerprint,
            owner_session_id: sessionId,
            repository_root: cwd,
            target_directory: relativeDir,
            name,
            sha256: sha256(content),
            filesystem_identity: createdIdentity,
            created_at: new Date().toISOString(),
          })) throw new Error(`future file ownership receipt already exists: ${fileReceiptPath}`);
          fileOwnershipCreated.push(fileReceiptPath);
          transaction = { ...transaction, phase: `wrote-${name}`, product_resource_mutation_performed: true };
          replaceDurableJson(transactionPath, transaction);
          await testFault(pi, `file-written:${name}`);
        }
        if (!existsSync(fileReceiptPath)) {
          throw new Error(`future file exists without immutable creation evidence: ${name}`);
        }
        validateFileOwnershipReceipt(fileReceiptPath, {
          dispositionId,
          payloadFingerprint,
          ownerSessionId: sessionId,
          repositoryRoot: cwd,
          targetDirectory: relativeDir,
          name,
          content,
        });
      }
      const documentHashes = validateOwnedBundle(futureRoot, targetDir, params.documents);
      const fileIdentities: Record<string, unknown> = {};
      const snapshotFiles: Record<string, unknown>[] = [];
      for (const [name, content] of documentEntries) {
        const fileReceipt = validateFileOwnershipReceipt(fileOwnershipPaths[name], {
          dispositionId,
          payloadFingerprint,
          ownerSessionId: sessionId,
          repositoryRoot: cwd,
          targetDirectory: relativeDir,
          name,
          content,
        });
        const fileIdentity = identity(fileReceipt.filesystem_identity, `future file ownership identity ${name}`);
        fileIdentities[name] = { sha256: sha256(content), filesystem_identity: fileIdentity };
        snapshotFiles.push({ name, content, identity: fileIdentity });
      }
      const snapshot = secureFs<{ directory_identity: unknown }>({
        operation: "snapshot-bundle",
        repo: cwd,
        target_path: relativeDir.split("\\").join("/"),
        directory_identity: ownedDirectoryIdentity,
        files: snapshotFiles,
      });
      const finalDirectoryIdentity = identity(snapshot.directory_identity, "final future directory identity");
      if (existsSync(bundleOwnershipPath)) {
        const bundleReceipt = validateBundleOwnershipReceipt(bundleOwnershipPath, {
          dispositionId,
          payloadFingerprint,
          ownerSessionId: sessionId,
          repositoryRoot: cwd,
          targetDirectory: relativeDir,
          targetDir,
          documents: params.documents,
        }, false);
        const recordedDirectory = identity(bundleReceipt.directory_identity, "future bundle directory identity");
        if (canonicalJson(recordedDirectory) !== canonicalJson(finalDirectoryIdentity)) {
          throw new Error("future bundle directory identity changed from immutable evidence");
        }
      } else {
        bundleOwnershipCreated = createDurableJson(bundleOwnershipPath, {
          version: 1,
          kind: "future-bundle-ownership",
          disposition_id: dispositionId,
          payload_fingerprint: payloadFingerprint,
          owner_session_id: sessionId,
          repository_root: cwd,
          target_directory: relativeDir,
          directory_identity: finalDirectoryIdentity,
          files: fileIdentities,
          created_at: new Date().toISOString(),
        });
        if (!bundleOwnershipCreated) {
          throw new Error(`future bundle ownership receipt already exists: ${bundleOwnershipPath}`);
        }
        transaction = {
          ...transaction,
          phase: "bundle-ownership-recorded",
          bundle_ownership_receipt_path: bundleOwnershipPath,
        };
        replaceDurableJson(transactionPath, transaction);
      }
      if (transaction.bundle_ownership_receipt_path !== bundleOwnershipPath) {
        transaction = { ...transaction, bundle_ownership_receipt_path: bundleOwnershipPath };
        replaceDurableJson(transactionPath, transaction);
      }
      const current = await inspectCanonicalRepository(pi, cwd, undefined);
      const dirtyPaths = porcelainPaths(current.status);
      if (dirtyPaths.some((path) => !ownedPaths.includes(path))) {
        throw new Error(`unrelated dirty paths appeared during future transaction: ${dirtyPaths.join(", ")}`);
      }
      if (current.head !== baseHead) throw new Error("HEAD changed before building the future commit");

      ensureControlDirectory(base.state.commonDir, "indexes");
      removeOwnedPrivateIndex(base.state.commonDir, dispositionId, transaction);
      transaction = { ...transaction, phase: "building-private-index", document_hashes: documentHashes, private_index_path: indexPath };
      replaceDurableJson(transactionPath, transaction);
      await testFault(pi, "before-private-index-build");
      // The helper opens `indexes` with O_DIRECTORY|O_NOFOLLOW, changes into
      // that held directory object, and runs every private-index Git operation
      // with a relative GIT_INDEX_FILE. A pathname swap cannot redirect Git.
      ensureControlDirectory(base.state.commonDir, "indexes");
      const built = secureFs<Record<string, unknown>>({
        operation: "build-tree",
        common_dir: base.state.commonDir,
        base_head: baseHead,
        target_path: relativeDir.split("\\").join("/"),
        names: documentEntries.map(([name]) => name),
        contents: documentEntries.map(([, content]) => content),
      });
      if (typeof built.tree !== "string" || !GIT_OID.test(built.tree)) {
        throw new Error("secure exact-tree builder returned invalid evidence");
      }
      const tree = built.tree;
      const indexEvidence = {
        version: 1,
        kind: "future-tree-construction-evidence",
        disposition_id: dispositionId,
        base_head: baseHead,
        tree,
        bundle_sha256: bundleSha256,
        modes: Object.fromEntries(documentEntries.map(([name]) => [name, "100644 blob"])),
      };
      if (!createDurableJson(indexPath, indexEvidence)) {
        throw new Error("private tree-construction evidence already exists");
      }
      const indexEvidenceSha256 = sha256(canonicalJson(indexEvidence));
      validateOwnedBundle(futureRoot, targetDir, params.documents);
      await validateTreeBundle(pi, cwd, tree, ownedPaths, params.documents);

      transaction = {
        ...transaction,
        phase: "private-tree-built",
        private_tree: tree,
        private_index_sha256: indexEvidenceSha256,
      };
      replaceDurableJson(transactionPath, transaction);
      await testFault(pi, "private-tree-built");

      const message = `docs: incubate ${params.decision.slug} specification\n\nPrime-Claw-Disposition: ${dispositionId}`;
      commitObjectSha = (await git(
        pi, cwd, ["commit-tree", tree, "-p", baseHead, "-m", message], signal,
      )).trim();
      await validateCommitBundle(pi, cwd, commitObjectSha, ownedPaths, params.documents);
      transaction = { ...transaction, phase: "commit-object-created", commit_object_sha: commitObjectSha };
      replaceDurableJson(transactionPath, transaction);
      await testFault(pi, "commit-object-created");
    } else {
      const parent = (await git(pi, cwd, ["rev-parse", `${commitObjectSha}^`], undefined)).trim();
      if (parent !== baseHead) throw new Error("recorded future commit object is not based on the recorded HEAD");
      await validateCommitBundle(pi, cwd, commitObjectSha, ownedPaths, params.documents);
    }

    let afterObject = await inspectCanonicalRepository(pi, cwd, undefined);
    if (afterObject.head === baseHead) {
      transaction = { ...transaction, phase: "advancing-default-ref", commit_object_sha: commitObjectSha };
      replaceDurableJson(transactionPath, transaction);
      await git(
        pi,
        cwd,
        ["update-ref", `refs/heads/${afterObject.currentBranch}`, commitObjectSha, baseHead],
        signal,
      );
      await testFault(pi, "default-ref-advanced");
      afterObject = await inspectCanonicalRepository(pi, cwd, undefined);
    }
    if (afterObject.head !== commitObjectSha) {
      throw new Error(`canonical HEAD ${afterObject.head} is not the owned future commit ${commitObjectSha}`);
    }

    // The private index made the commit without absorbing the shared primary
    // index. Reconcile only the owned paths after the CAS ref update.
    const reconcileStatus = porcelainPaths(afterObject.status);
    if (reconcileStatus.some((path) => !ownedPaths.includes(path))) {
      throw new Error(`unrelated paths appeared before primary-index reconciliation: ${reconcileStatus.join(", ")}`);
    }
    await git(pi, cwd, ["add", "--", ...ownedPaths.map((path) => `:(literal)${path}`)], undefined);
    const primaryStaged = (await git(pi, cwd, ["diff", "--cached", "--name-only", "-z"], undefined)).split("\0").filter(Boolean);
    if (primaryStaged.length !== 0) {
      throw new Error(`primary index is not clean after owned-path reconciliation: ${primaryStaged.join(", ")}`);
    }
    await testFault(pi, "primary-index-reconciled");
    commitSha = commitObjectSha;
    transaction = { ...transaction, phase: "committed", commit_sha: commitSha };
    replaceDurableJson(transactionPath, transaction);
    removeOwnedPrivateIndex(base.state.commonDir, dispositionId, transaction);

    const beforePush = await inspectCanonicalRepository(pi, cwd, undefined);
    const remoteBeforePush = await remoteRefOid(pi, cwd, beforePush.remote, beforePush.remoteBranch);
    if (beforePush.status.length !== 0) {
      throw new Error(`canonical checkout is dirty before push: ${porcelainPaths(beforePush.status).join(", ")}`);
    }
    if (beforePush.head !== commitSha) {
      throw new Error(`canonical HEAD ${beforePush.head} moved away from owned future commit ${commitSha}`);
    }
    if (remoteBeforePush !== commitSha) {
      if (remoteBeforePush !== baseHead) {
        throw new Error(`remote default branch raced from recorded base ${baseHead} to ${remoteBeforePush}`);
      }
      transaction = {
        ...transaction,
        phase: "pushing",
        push_target: `${beforePush.remote}/${beforePush.remoteBranch}`,
        remote_oid_before_push: remoteBeforePush,
      };
      replaceDurableJson(transactionPath, transaction);
      await git(
        pi,
        cwd,
        ["push", "--porcelain", beforePush.remote, `${commitSha}:refs/heads/${beforePush.remoteBranch}`],
        signal,
      );
      await testFault(pi, "push-returned");
    }

    let verified = await inspectCanonicalRepository(pi, cwd, undefined);
    const remoteAfterPush = await remoteRefOid(pi, cwd, verified.remote, verified.remoteBranch);
    if (remoteAfterPush !== commitSha) {
      throw new Error(`remote default branch ${verified.remote}/${verified.remoteBranch} is ${remoteAfterPush}, expected ${commitSha}`);
    }
    if (!(await gitIsAncestor(pi, cwd, commitSha, verified.upstream))) {
      await git(
        pi,
        cwd,
        ["fetch", "--no-tags", verified.remote, `+refs/heads/${verified.remoteBranch}:refs/remotes/${verified.remote}/${verified.remoteBranch}`],
        undefined,
      );
      verified = await inspectCanonicalRepository(pi, cwd, undefined);
    }
    if (!(await gitIsAncestor(pi, cwd, commitSha, verified.upstream))) {
      throw new Error("future commit is not reachable from the configured upstream after remote reconciliation");
    }
    if (verified.head !== commitSha || verified.upstreamHead !== commitSha) {
      throw new Error(`verified canonical state is not exact: HEAD=${verified.head} upstream=${verified.upstreamHead} expected=${commitSha}`);
    }
    if (verified.status.length !== 0) {
      throw new Error(`canonical checkout is not clean after future push: ${porcelainPaths(verified.status).join(", ")}`);
    }
    if (!sameStrings(await commitPaths(pi, cwd, commitSha), ownedPaths)) {
      throw new Error("verified future commit path set no longer matches the owned bundle");
    }
    transaction = {
      ...transaction,
      status: "verified-success",
      phase: "pushed-and-clean",
      commit_sha: commitSha,
      verified_head: verified.head,
      verified_upstream_head: verified.upstreamHead,
      verified_remote_head: remoteAfterPush,
      checkout_clean: true,
      verified_at: new Date().toISOString(),
      product_resource_mutation_performed: true,
      next_safe_action: "future specification is durable; no episode resource was allocated",
      episode_resources_allocated: false,
    };
    replaceDurableJson(transactionPath, transaction);
    await testFault(pi, "success-journal-written");
    if (existsSync(blockerPath)) {
      const blocker = readDurableJson(blockerPath);
      if (blocker.disposition_id === dispositionId) removeDurableFile(blockerPath);
    }
    writeAttempt({ status: "verified-success", phase: "pushed-and-clean", commit_sha: commitSha, observed_at: new Date().toISOString() });
    return {
      ...transaction,
      preflight_receipt_path: base.receiptPath,
      transaction_path: transactionPath,
      attempt_path: attemptPath,
      deduplicated: false,
      control_state_writes_performed: controlWrites(transactionPath, attemptPath),
    };
  } catch (error) {
    const failure = errorMessage(error);
    if (preserveSuccessEvidence) {
      try {
        writeAttempt({
          status: "corrupt-success",
          phase: "success-preservation-guard",
          error: failure,
          next_safe_action: "preserve the journal and blocker; inspect without normalizing success evidence",
          observed_at: new Date().toISOString(),
        });
      } catch {
        // Preservation outranks diagnostic persistence.
      }
      return {
        status: "failed",
        phase: "success-preservation-guard",
        error: failure,
        corrupt_success_journal_preserved: true,
        preflight_receipt_path: base.receiptPath,
        transaction_path: transactionPath,
        attempt_path: attemptPath,
        deduplicated: false,
        recovery_action_required: true,
        control_state_writes_performed: controlWrites(attemptPath),
      };
    }
    const current = transaction ?? {
      version: 1,
      disposition_id: dispositionId,
      payload_fingerprint: payloadFingerprint,
      disposition: "future",
      slug: params.decision.slug,
      bundle_sha256: bundleSha256,
      owner_session_id: sessionId,
      owner_session_file: resolvedSessionFile,
      repository_root: cwd,
      git_common_dir: base.state.commonDir,
      current_branch: base.state.currentBranch,
      upstream_branch: base.state.upstream,
      remote_default_branch: base.state.defaultRemoteBranch,
      base_head: base.state.head,
      target_directory: relativeDir,
      owned_paths: ownedPaths,
      status: "failed",
      phase: "before-journal",
      product_resource_mutation_performed: productMutated,
    };
    let observed: Record<string, unknown> = current;
    try {
      observed = await reconcileFutureState(pi, cwd, current, ownedPaths, params.documents);
    } catch (observationError) {
      observed = { ...current, observation_error: errorMessage(observationError) };
    }
    transaction = {
      ...observed,
      status: "failed",
      error: failure,
      failed_at: new Date().toISOString(),
      product_resource_mutation_performed: productMutated,
      recovery_action_required: productMutated,
      next_safe_action: productMutated
        ? "inspect, then explicitly continue or remove only byte-identical owned uncommitted files"
        : "correct the reported precondition and submit a new explicitly confirmed disposition",
    };
    replaceDurableJson(transactionPath, transaction);
    if (productMutated) replaceDurableJson(blockerPath, {
      version: 1,
      disposition_id: dispositionId,
      transaction_path: transactionPath,
      blocked_at: new Date().toISOString(),
      reason: failure,
    });
    writeAttempt({
      status: "failed",
      phase: transaction.phase,
      error: failure,
      recovery_action_required: productMutated,
      next_safe_action: transaction.next_safe_action,
      observed_at: new Date().toISOString(),
    });
    return {
      ...transaction,
      preflight_receipt_path: base.receiptPath,
      transaction_path: transactionPath,
      attempt_path: attemptPath,
      deduplicated: false,
      control_state_writes_performed: controlWrites(transactionPath, attemptPath, ...(productMutated ? [blockerPath] : [])),
    };
  } finally {
    try {
      releaseProjectLock(lock);
    } catch (error) {
      lockReleaseError = errorMessage(error);
      writeAttempt({
        status: "lock-release-failed",
        phase: transaction?.phase ?? "unknown",
        error: lockReleaseError,
        lock_path: lock.path,
        next_safe_action: "inspect the token-matched lock before any further mutation",
        observed_at: new Date().toISOString(),
      });
      throw new Error(`future transaction lock release failed; receipt: ${attemptPath}; ${lockReleaseError}`);
    }
  }
}

async function executeDisposition(
  pi: ExtensionAPI,
  rawParams: unknown,
  signal: AbortSignal | undefined,
  ctx: ExtensionContext,
) {
  const params = validateDispositionParams(rawParams);
  if (signal?.aborted) throw new Error("spec_disposition cancelled before durable preflight");

  const sessionId = ctx.sessionManager.getSessionId();
  if (!REQUEST_ID.test(sessionId)) throw new Error("persisted Prime Agent session has an invalid stable session ID");
  const sessionFile = ctx.sessionManager.getSessionFile();
  if (!sessionFile) throw new Error("spec_disposition requires a persisted Prime Agent session");
  const managerCwd = realpathSync(ctx.sessionManager.getCwd());
  const cwd = realpathSync(ctx.cwd);
  if (managerCwd !== cwd) throw new Error("session CWD does not match the extension execution root");
  const resolvedSessionFile = validateSessionFile(sessionFile, sessionId, cwd);
  const state = await inspectCanonicalRepository(pi, cwd, signal);
  if (params.decision.kind === "episode") {
    await git(pi, cwd, ["check-ref-format", "--branch", params.decision.branch_name!], signal);
  }
  if (signal?.aborted) throw new Error("spec_disposition cancelled before durable preflight");

  const bundleSha256 = sha256(canonicalJson(params.documents));
  const semanticIdentity = {
    version: 1,
    owner_session_id: sessionId,
    repository_root: state.repoRoot,
    disposition: params.decision.kind,
    slug: params.decision.slug,
    branch_name: params.decision.branch_name ?? null,
    bundle_sha256: bundleSha256,
  };
  const payloadFingerprint = sha256(canonicalJson(semanticIdentity));
  const dispositionId = `disp-${payloadFingerprint.slice(0, 32)}`;
  const requestKey = sha256(canonicalJson({ owner_session_id: sessionId, request_id: params.request_id }));
  const controlRoot = ensureControlDirectory(state.commonDir);
  const requestPath = join(ensureControlDirectory(state.commonDir, "disposition-requests"), `${requestKey}.json`);
  const receiptPath = join(ensureControlDirectory(state.commonDir, "dispositions"), `${dispositionId}.json`);
  const requestRecord = {
    version: 1,
    request_id: params.request_id,
    owner_session_id: sessionId,
    payload_fingerprint: payloadFingerprint,
    disposition_id: dispositionId,
  };
  const requestCreated = createDurableJson(requestPath, requestRecord);
  if (!requestCreated) {
    const existing = readDurableJson(requestPath);
    if (
      existing.owner_session_id !== sessionId
      || existing.request_id !== params.request_id
      || existing.payload_fingerprint !== payloadFingerprint
      || existing.disposition_id !== dispositionId
    ) throw new Error(`request_id collision: ${params.request_id} is already bound to different disposition input`);
  }

  const receipt = {
    version: 1,
    disposition_id: dispositionId,
    payload_fingerprint: payloadFingerprint,
    status: "preflight-ready",
    phase: "validated",
    disposition: params.decision.kind,
    slug: params.decision.slug,
    branch_name: params.decision.branch_name ?? null,
    bundle_sha256: bundleSha256,
    owner_session_id: sessionId,
    owner_session_file: resolvedSessionFile,
    repository_root: state.repoRoot,
    git_common_dir: state.commonDir,
    current_branch: state.currentBranch,
    upstream_branch: state.upstream,
    remote_default_branch: state.defaultRemoteBranch,
    checkout_clean: state.status.length === 0,
    product_resource_mutation_performed: false,
    control_state_kind: "local-git-common-dir-receipt",
    implementation_boundary: params.decision.kind === "future"
      ? "slice-2-future-transaction"
      : "slice-1-preflight-only",
  };
  const receiptCreated = createDurableJson(receiptPath, receipt);
  let durableReceipt: Record<string, unknown> = receipt;
  if (!receiptCreated) {
    const existing = readDurableJson(receiptPath);
    const immutableKeys = [
      "version", "disposition_id", "payload_fingerprint", "status", "phase",
      "disposition", "slug", "branch_name", "bundle_sha256",
      "owner_session_id", "owner_session_file", "repository_root", "git_common_dir",
    ];
    if (immutableKeys.some((key) => existing[key] !== receipt[key])) {
      throw new Error(`disposition collision: durable receipt ${dispositionId} does not match validated input`);
    }
    durableReceipt = existing;
  }

  if (params.decision.kind === "future") {
    return executeFutureTransaction(pi, params, ctx, signal, {
      sessionId, resolvedSessionFile, state, dispositionId, payloadFingerprint,
      bundleSha256, requestKey, requestPath, requestCreated, receiptPath, receiptCreated,
    });
  }

  return {
    ...durableReceipt,
    receipt_path: receiptPath,
    deduplicated: !receiptCreated,
    control_state_writes_performed: [
      ...(requestCreated ? [requestPath] : []),
      ...(receiptCreated ? [receiptPath] : []),
    ],
  };
}

export default function specificationEpisodes(pi: ExtensionAPI): void {
  for (const name of ["design", "spec-it-out"] as const) {
    pi.registerCommand(name, {
      description: name === "design"
        ? "Discover requirements and design, then explicitly incubate or create an episode"
        : "Formalize developed context, then explicitly incubate or create an episode",
      handler: async (args, ctx) => injectSkill(pi, ctx, name, args),
    });
  }

  pi.registerTool({
    name: "spec_disposition",
    label: "Specification Disposition",
    description: "Execute an explicitly confirmed future incubation transaction, or persist an episode preflight. Interrupted future work requires an explicit recovery_action; ordinary retries only inspect durable state.",
    parameters: dispositionParameters as unknown as TSchema,
    executionMode: "sequential",
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const details = await executeDisposition(pi, params, signal, ctx);
      const summary = details.disposition === "future"
        ? `Future specification disposition result: ${String(details.status)}. No branch, worktree, daemon, or episode session was allocated.`
        : "Episode disposition preflight is ready. No product resource, checkout, Git ref/worktree, remote, daemon, or session mutation was performed.";
      return {
        content: [{ type: "text", text: `${summary}\n${JSON.stringify(details, null, 2)}` }],
        details,
      };
    },
  });
}
