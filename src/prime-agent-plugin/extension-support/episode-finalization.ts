import { accessSync, closeSync, constants as fsConstants, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { PrimeSessionPublisher, parseEpisodeIdentity, type EpisodeIdentity } from "./spec-episode.ts";
import type { OversightDisposition, OversightMarker } from "./conversation-oversight.ts";

const SAFE_LOCATION = /^\.ralph\/plans\/future\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const RECEIPT_VERSION = 2;
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const SESSION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FinalizationState = "authorized" | "completing" | "completed";

export type FinalizationReceipt = {
  version: 2;
  state: FinalizationState;
  sourceLocation: string;
  slug: string;
  disposition: OversightDisposition;
  ownerSessionId: string;
  episodeId: string;
  episodeActiveSessionId: string;
  episodeSessionFile: string;
  episodeBranch: string;
  episodeWorktree: string;
  sessionName: string;
  identityVersion: 1 | 2;
  admission: string;
  episodeCommit: string;
  targetBranch: string;
  targetRef: string;
  targetCommitAtAuthorization: string;
  authorizedAt: string;
  completingAt?: string;
  completedAt?: string;
};

export interface FinalizationDependencies {
  listSessions(): Promise<SessionSummary[]>;
  close(): void;
  repositoryRoot(cwd: string): string;
  worktrees(repo: string): Array<{ path: string; branch?: string }>;
  currentBranch(repo: string): string;
  commit(repo: string, ref: string): string;
  isAncestor(repo: string, ancestor: string, descendant: string): boolean;
  exists(path: string): boolean;
  readJson(path: string): unknown;
  writeJson(path: string, value: unknown): void;
  remove(path: string): void;
  now(): string;
  acquireLock(path: string, options?: FinalizationLockOptions): Promise<FinalizationLockHandle | (() => Promise<void>)>;
}

export type FinalizationLockHandle = (() => Promise<void>) & {
  assertHeld(): void;
  lost: Promise<Error>;
  release(): Promise<void>;
};

export type FinalizationLockOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
  pythonExecutable?: string;
};

type LockAttempt =
  | { state: "ready"; child: ChildProcessWithoutNullStreams }
  | { state: "contended"; child: ChildProcessWithoutNullStreams };

const LOCK_RETRY_MS = 20;
const LOCK_TIMEOUT_MS = 10_000;
const LOCK_HELPER_SCRIPT = String.raw`import json, os, stat, sys
try:
    import fcntl
    flags = os.O_CREAT | os.O_RDWR
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    fd = os.open(sys.argv[1], flags, 0o600)
    if not stat.S_ISREG(os.fstat(fd).st_mode):
        raise OSError("lock object is not a regular file")
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        print(json.dumps({"state":"contended"}), flush=True)
        sys.exit(75)
except Exception as error:
    print(json.dumps({"state":"fatal","error":f"{type(error).__name__}: {error}"}), flush=True)
    sys.exit(70)
print(json.dumps({"state":"ready"}), flush=True)
sys.stdin.buffer.read()
os.close(fd)`;

function assertLockPathReady(path: string): void {
  const parent = dirname(path);
  mkdirSync(parent, { recursive: true });
  const parentStat = lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error(`Finalization lock parent is not a real directory: ${parent}`);
  }
  accessSync(parent, fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK);
  if (!existsSync(path)) return;
  const lockStat = lstatSync(path);
  if (lockStat.isSymbolicLink() || !lockStat.isFile()) {
    throw new Error(`Finalization lock object is not a regular file: ${path}`);
  }
  accessSync(path, fsConstants.R_OK | fsConstants.W_OK);
}

function lockWaitError(kind: "cancelled" | "timed out", path: string): Error {
  return new Error(`Finalization lock acquisition ${kind}: ${path}`);
}

function waitForChildExit(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise<boolean>((resolveExit) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener("exit", onExit);
      resolveExit(value);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once("exit", onExit);
    if (child.exitCode !== null || child.signalCode !== null) finish(true);
  });
}

async function terminateLockHelper(child: ChildProcessWithoutNullStreams): Promise<void> {
  child.stdin.destroy();
  if (await waitForChildExit(child, 100)) return;
  child.kill("SIGTERM");
  if (await waitForChildExit(child, 500)) return;
  child.kill("SIGKILL");
  if (!await waitForChildExit(child, 500)) throw new Error("Finalization lock helper could not be terminated");
}

function heldNativeLock(child: ChildProcessWithoutNullStreams, path: string): FinalizationLockHandle {
  let releasing = false;
  let releasePromise: Promise<void> | null = null;
  let loss: Error | null = null;
  let resolveLost!: (error: Error) => void;
  const lost = new Promise<Error>((resolveLoss) => { resolveLost = resolveLoss; });
  const recordLoss = (detail: string) => {
    if (releasing || loss) return;
    loss = new Error(`Finalization lock helper was lost while holding ${path}: ${detail}`);
    resolveLost(loss);
  };
  child.once("error", (error) => recordLoss(error.message));
  child.once("exit", (code, signal) => recordLoss(String(code ?? signal ?? "unknown exit")));
  if (child.exitCode !== null || child.signalCode !== null) recordLoss(String(child.exitCode ?? child.signalCode));
  const assertHeld = () => {
    if (loss) throw loss;
    if (child.exitCode !== null || child.signalCode !== null) {
      recordLoss(String(child.exitCode ?? child.signalCode));
      throw loss ?? new Error(`Finalization lock helper was lost while holding ${path}`);
    }
  };
  const release = async () => {
    if (releasePromise) return releasePromise;
    releasePromise = (async () => {
      let priorLoss = loss;
      try { assertHeld(); } catch (error) { priorLoss = error instanceof Error ? error : new Error(String(error)); }
      releasing = true;
      if (child.exitCode === null && child.signalCode === null) child.stdin.end();
      if (!await waitForChildExit(child, 500)) await terminateLockHelper(child);
      child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
      if (priorLoss) throw priorLoss;
    })();
    return releasePromise;
  };
  return Object.assign(release, { lost, assertHeld, release });
}

function normalizeLockHandle(value: FinalizationLockHandle | (() => Promise<void>)): FinalizationLockHandle {
  if ("assertHeld" in value && "lost" in value && "release" in value) return value as FinalizationLockHandle;
  const release = value;
  return Object.assign(release, { assertHeld() {}, lost: new Promise<Error>(() => {}), release });
}

async function whileLockHeld<T>(lock: FinalizationLockHandle, work: Promise<T>): Promise<T> {
  const value = await Promise.race([work, lock.lost.then((error) => { throw error; })]);
  lock.assertHeld();
  return value;
}

async function startLockAttempt(
  path: string,
  pythonExecutable: string,
  signal: AbortSignal | undefined,
  remainingMs: number,
): Promise<LockAttempt> {
  const child: ChildProcessWithoutNullStreams = spawn(
    pythonExecutable,
    ["-c", LOCK_HELPER_SCRIPT, path],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  try {
    return await new Promise<LockAttempt>((resolveAttempt, rejectAttempt) => {
      let settled = false;
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => fail(lockWaitError("timed out", path), true), remainingMs);
      const onAbort = () => fail(lockWaitError("cancelled", path), true);
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        child.removeListener("error", onError);
        child.removeListener("close", onClose);
        child.stdout.removeListener("data", onStdout);
        child.stderr.removeListener("data", onStderr);
      };
      const fail = (error: Error, terminate = false) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (terminate && child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
        child.stdin.destroy();
        child.stdout.destroy();
        child.stderr.destroy();
        rejectAttempt(error);
      };
      const finish = (value: LockAttempt) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolveAttempt(value);
      };
      const parseLine = () => {
        const newline = stdout.indexOf("\n");
        if (newline < 0 || settled) return;
        const line = stdout.slice(0, newline);
        let message: { state?: unknown; error?: unknown };
        try { message = JSON.parse(line) as { state?: unknown; error?: unknown }; }
        catch { return fail(new Error(`Finalization lock helper returned invalid startup output: ${line}`), true); }
        if (message.state === "ready") return finish({ state: "ready", child });
        if (message.state === "contended") return finish({ state: "contended", child });
        if (message.state === "fatal" && typeof message.error === "string") {
          return fail(new Error(`Finalization lock helper failed: ${message.error}`));
        }
        return fail(new Error(`Finalization lock helper returned an unknown startup state: ${line}`), true);
      };
      const onStdout = (chunk: Buffer | string) => { stdout += String(chunk); parseLine(); };
      const onStderr = (chunk: Buffer | string) => { if (stderr.length < 4096) stderr += String(chunk).slice(0, 4096 - stderr.length); };
      const onError = (error: Error) => fail(new Error(`Finalization lock helper could not start: ${error.message}`));
      const onClose = (code: number | null, exitSignal: NodeJS.Signals | null) => {
        if (!settled) fail(new Error(`Finalization lock helper exited before readiness (${code ?? exitSignal ?? "unknown"})${stderr.trim() ? `: ${stderr.trim()}` : ""}`));
      };
      child.on("error", onError);
      child.on("close", onClose);
      child.stdout.on("data", onStdout);
      child.stderr.on("data", onStderr);
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  } catch (error) {
    await terminateLockHelper(child);
    throw error;
  }
}

/**
 * Hold a crash-released advisory flock in a helper whose stdin is owned by this
 * process. A stale regular lock file is harmless. Contenders never unlink it or
 * signal another holder. Only an explicit contention response is retried;
 * invalid paths, unsupported Python/flock runtimes, helper failures, timeout,
 * and cancellation fail visibly.
 */
export async function acquireNativeFinalizationLock(
  path: string,
  options: FinalizationLockOptions = {},
): Promise<FinalizationLockHandle> {
  const timeoutMs = options.timeoutMs ?? LOCK_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Finalization lock timeout must be a positive finite number");
  assertLockPathReady(path);
  const monotonicMs = () => Number(process.hrtime.bigint() / 1_000_000n);
  const deadline = monotonicMs() + timeoutMs;
  for (;;) {
    if (options.signal?.aborted) throw lockWaitError("cancelled", path);
    const remaining = deadline - monotonicMs();
    if (remaining <= 0) throw lockWaitError("timed out", path);
    const attempt = await startLockAttempt(path, options.pythonExecutable ?? "python3", options.signal, remaining);
    if (attempt.state === "ready") return heldNativeLock(attempt.child, path);
    await terminateLockHelper(attempt.child);
    const retryRemaining = deadline - monotonicMs();
    if (retryRemaining <= 0) throw lockWaitError("timed out", path);
    await new Promise<void>((resolveRetry, rejectRetry) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(wait);
        options.signal?.removeEventListener("abort", onAbort);
        if (error) rejectRetry(error); else resolveRetry();
      };
      const onAbort = () => finish(lockWaitError("cancelled", path));
      const wait = setTimeout(() => finish(), Math.min(LOCK_RETRY_MS, retryRemaining));
      options.signal?.addEventListener("abort", onAbort, { once: true });
      if (options.signal?.aborted) onAbort();
    });
  }
}

class NativeFinalizationDependencies implements FinalizationDependencies {
  private publisher = new PrimeSessionPublisher();
  listSessions() { return this.publisher.list(); }
  close() { this.publisher.close(); }
  repositoryRoot(cwd: string) {
    return execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  }
  worktrees(repo: string) {
    const out = execFileSync("git", ["-C", repo, "worktree", "list", "--porcelain"], { encoding: "utf8" });
    const entries: Array<{ path: string; branch?: string }> = [];
    let current: { path: string; branch?: string } | undefined;
    for (const line of out.split("\n")) {
      if (line.startsWith("worktree ")) { current = { path: line.slice(9) }; entries.push(current); }
      else if (current && line.startsWith("branch refs/heads/")) current.branch = line.slice(18);
    }
    return entries;
  }
  currentBranch(repo: string) {
    try {
      const branch = execFileSync("git", ["-C", repo, "symbolic-ref", "--quiet", "--short", "HEAD"], { encoding: "utf8" }).trim();
      if (!branch) throw new Error("empty branch");
      return branch;
    } catch (error) {
      throw new Error(`Finalization requires an attached target branch: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  commit(repo: string, ref: string) {
    const value = execFileSync("git", ["-C", repo, "rev-parse", "--verify", `${ref}^{commit}`], { encoding: "utf8" }).trim();
    if (!OBJECT_ID.test(value)) throw new Error(`Git ref ${ref} did not resolve to a commit object`);
    return value;
  }
  isAncestor(repo: string, ancestor: string, descendant: string) {
    try {
      execFileSync("git", ["-C", repo, "merge-base", "--is-ancestor", ancestor, descendant], { stdio: "pipe" });
      return true;
    } catch (error) {
      if (typeof error === "object" && error !== null && "status" in error && error.status === 1) return false;
      throw new Error(`Git ancestry check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  exists(path: string) { return existsSync(path); }
  readJson(path: string) { return JSON.parse(readFileSync(path, "utf8")); }
  writeJson(path: string, value: unknown) {
    mkdirSync(dirname(path), { recursive: true });
    let temporary: string | undefined;
    try {
      temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
      const valueFd = openSync(temporary, "wx", 0o600);
      try {
        writeFileSync(valueFd, `${JSON.stringify(value, null, 2)}\n`);
        fsyncSync(valueFd);
      } finally { closeSync(valueFd); }
      renameSync(temporary, path);
      temporary = undefined;
      const directoryFd = openSync(dirname(path), "r");
      try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
    } finally {
      if (temporary) rmSync(temporary, { force: true });
    }
  }
  remove(path: string) { rmSync(path, { force: true }); }
  now() { return new Date().toISOString(); }
  acquireLock(path: string, options?: FinalizationLockOptions) { return acquireNativeFinalizationLock(path, options); }
}

function paths(repo: string, slug: string) {
  const base = resolve(repo, ".prime", "agent", "state", "spec-episodes", slug);
  return { identity: `${base}.json`, receipt: `${base}.finalization.json` };
}
function parseLocation(cwd: string, raw: string, deps: FinalizationDependencies) {
  const sourceLocation = raw.trim();
  const match = SAFE_LOCATION.exec(sourceLocation);
  if (!match) throw new Error("Invalid future-plan folder location");
  const repo = deps.repositoryRoot(cwd);
  return { sourceLocation, slug: match[1], repo, ...paths(repo, match[1]) };
}
function identity(value: unknown): EpisodeIdentity {
  return parseEpisodeIdentity(value, "episode identity");
}
function nonempty(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
export function parseFinalizationReceipt(value: unknown): FinalizationReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Finalization receipt is missing or corrupt");
  const data = value as Record<string, unknown>;
  const state = data.state;
  const baseKeys = ["version", "state", "sourceLocation", "slug", "disposition", "ownerSessionId", "episodeId",
    "episodeActiveSessionId", "episodeSessionFile", "episodeBranch", "episodeWorktree", "sessionName", "identityVersion", "admission",
    "episodeCommit", "targetBranch", "targetRef",
    "targetCommitAtAuthorization", "authorizedAt"];
  const allowed = new Set([...baseKeys, ...(state === "completing" || state === "completed" ? ["completingAt"] : []),
    ...(state === "completed" ? ["completedAt"] : [])]);
  if (
    data.version !== RECEIPT_VERSION
    || (state !== "authorized" && state !== "completing" && state !== "completed")
    || (data.disposition !== "merged" && data.disposition !== "abandoned")
    || baseKeys.slice(2).filter((key) => !["disposition", "identityVersion"].includes(key)).some((key) => !nonempty(data[key]))
    || (data.identityVersion !== 1 && data.identityVersion !== 2)
    || data.sourceLocation !== `.ralph/plans/future/${data.slug}`
    || data.episodeBranch !== `episode/${data.slug}` || data.sessionName !== `${data.slug}-episode`
    || (data.identityVersion === 1
      ? !["pending", "uncertain", "delivered"].includes(String(data.admission))
      : !["handoff-pending", "handoff-uncertain", "execute-pending", "execute-rejected", "execute-uncertain", "delivered"].includes(String(data.admission)))
    || [...Object.keys(data)].some((key) => !allowed.has(key))
    || [...allowed].some((key) => !(key in data))
    || !SESSION_UUID.test(String(data.episodeId))
    || !OBJECT_ID.test(String(data.episodeCommit))
    || !OBJECT_ID.test(String(data.targetCommitAtAuthorization))
    || data.targetRef !== `refs/heads/${data.targetBranch}`
  ) throw new Error("Finalization receipt is missing or corrupt");
  return data as unknown as FinalizationReceipt;
}
function assertExactOwner(record: EpisodeIdentity, ctx: ExtensionContext, sourceLocation: string): void {
  if (record.ownerSessionId !== ctx.sessionManager.getSessionId()) throw new Error("Episode finalization owner mismatch");
  if (record.sourceLocation !== sourceLocation) throw new Error("Episode finalization location mismatch");
}
function samePath(a: string | undefined, b: string): boolean {
  return typeof a === "string" && resolve(a) === resolve(b);
}
function assertExactMarker(marker: OversightMarker, binding: {
  ownerSessionId: string; sourceLocation: string; slug: string; episodeId: string; episodeActiveSessionId: string;
  episodeSessionFile: string; episodeBranch?: string; branch?: string; episodeWorktree?: string; worktree?: string;
  sessionName: string; identityVersion: 1 | 2; admission: string;
}, permitted: Array<OversightMarker["status"]>): void {
  if (!marker || marker.markerVersion !== 2 || !permitted.includes(marker.status)
    || marker.ownerSessionId !== binding.ownerSessionId || marker.sourceLocation !== binding.sourceLocation
    || marker.slug !== binding.slug || marker.episodeId !== binding.episodeId
    || !samePath(marker.episodeSessionFile, binding.episodeSessionFile)
    || marker.branch !== (binding.episodeBranch ?? binding.branch)
    || !samePath(marker.worktree, binding.episodeWorktree ?? binding.worktree ?? "")
    || marker.sessionName !== binding.sessionName || marker.identityVersion !== binding.identityVersion
    || marker.admission !== binding.admission) {
    throw new Error("Exact oversight marker does not match the finalization state");
  }
}
function markerBindingFromIdentity(record: EpisodeIdentity) {
  return {
    ownerSessionId: record.ownerSessionId, sourceLocation: record.sourceLocation, slug: record.slug,
    episodeId: record.episodeId, episodeActiveSessionId: record.episodeActiveSessionId,
    episodeSessionFile: record.episodeSessionFile, branch: record.branch, worktree: record.worktree,
    sessionName: record.sessionName, identityVersion: record.version,
    admission: record.version === 1 ? record.executeAdmission : record.bootstrapAdmission,
  };
}
function receiptMatchesIdentity(value: FinalizationReceipt, record: EpisodeIdentity): boolean {
  return value.ownerSessionId === record.ownerSessionId && value.episodeId === record.episodeId
    && value.sourceLocation === record.sourceLocation && value.slug === record.slug
    && value.episodeActiveSessionId === record.episodeActiveSessionId
    && samePath(value.episodeSessionFile, record.episodeSessionFile)
    && value.episodeBranch === record.branch && samePath(value.episodeWorktree, record.worktree)
    && value.sessionName === record.sessionName && value.identityVersion === record.version
    && value.admission === (record.version === 1 ? record.executeAdmission : record.bootstrapAdmission);
}
function assertLifecycleShape(state: FinalizationState, identityExists: boolean, markerStatus: OversightMarker["status"]): void {
  const exact = state === "authorized"
    ? identityExists && markerStatus === "active"
    : state === "completing"
      ? (markerStatus === "active" || markerStatus === "inactive")
      : !identityExists && markerStatus === "inactive";
  if (!exact) throw new Error(`Finalization ${state} state does not match an exact recoverable crash boundary`);
}
function assertRequest(value: FinalizationReceipt, sourceLocation: string, slug: string,
  disposition: OversightDisposition, ownerSessionId: string): void {
  if (value.sourceLocation !== sourceLocation || value.slug !== slug || value.disposition !== disposition
    || value.ownerSessionId !== ownerSessionId) throw new Error("A different terminal authorization receipt already exists");
}

export async function authorizeEpisodeFinalization(
  rawLocation: string,
  disposition: OversightDisposition,
  ctx: ExtensionContext,
  confirm: (title: string, message: string) => Promise<boolean>,
  marker: OversightMarker,
  supplied?: FinalizationDependencies,
  lockOptions?: FinalizationLockOptions,
): Promise<{ receipt: FinalizationReceipt; reused: boolean }> {
  const deps = supplied ?? new NativeFinalizationDependencies();
  try {
    if (disposition !== "merged" && disposition !== "abandoned") throw new Error("Disposition must be merged or abandoned");
    const selected = parseLocation(ctx.cwd, rawLocation, deps);
    const lockPath = `${selected.receipt}.transaction.lock`;
    const existingResult = (): { receipt: FinalizationReceipt; reused: true } | null => {
      if (!deps.exists(selected.receipt)) return null;
      const existing = parseFinalizationReceipt(deps.readJson(selected.receipt));
      assertRequest(existing, selected.sourceLocation, selected.slug, disposition, ctx.sessionManager.getSessionId());
      const identityExists = deps.exists(selected.identity);
      if (identityExists) {
        const existingIdentity = identity(deps.readJson(selected.identity));
        assertExactOwner(existingIdentity, ctx, selected.sourceLocation);
        if (!receiptMatchesIdentity(existing, existingIdentity)) throw new Error("Finalization receipt does not match the exact owned episode");
      }
      assertExactMarker(marker, existing, existing.state === "completed" ? ["active", "inactive"]
        : existing.state === "authorized" ? ["active"] : ["active", "inactive"]);
      assertLifecycleShape(existing.state, identityExists, existing.state === "completed" ? "inactive" : marker.status);
      return { receipt: existing, reused: true };
    };

    let value: FinalizationReceipt;
    let lock = normalizeLockHandle(await deps.acquireLock(lockPath, lockOptions));
    try {
      const existing = existingResult(); if (existing) return existing;
      const record = identity(deps.readJson(selected.identity));
      assertExactOwner(record, ctx, selected.sourceLocation);
      if (record.slug !== selected.slug) throw new Error("Episode finalization slug mismatch");
      assertExactMarker(marker, markerBindingFromIdentity(record), ["active"]);
      const targetBranch = deps.currentBranch(selected.repo);
      if (targetBranch === record.branch) throw new Error("Episode branch cannot be the finalization target branch");
      const episodeCommit = deps.commit(selected.repo, record.branch);
      const targetCommitAtAuthorization = deps.commit(selected.repo, `refs/heads/${targetBranch}`);
      value = {
        version: RECEIPT_VERSION, state: "authorized", sourceLocation: selected.sourceLocation, slug: selected.slug,
        disposition, ownerSessionId: record.ownerSessionId, episodeId: record.episodeId,
        episodeActiveSessionId: record.episodeActiveSessionId, episodeSessionFile: record.episodeSessionFile,
        episodeBranch: record.branch, episodeWorktree: record.worktree, sessionName: record.sessionName,
        identityVersion: record.version, admission: record.version === 1 ? record.executeAdmission : record.bootstrapAdmission,
        episodeCommit, targetBranch, targetRef: `refs/heads/${targetBranch}`, targetCommitAtAuthorization,
        authorizedAt: deps.now(),
      };
      lock.assertHeld();
    } finally { await lock.release(); }

    const approved = await confirm(
      `Authorize ${disposition} episode finalization?`,
      `Record the operator decision for ${selected.sourceLocation}. Target: ${value.targetBranch} (${value.targetRef}) at ${value.targetCommitAtAuthorization}. Exact episode tip: ${value.episodeCommit}. This performs no Git, session, worktree, branch, or cleanup mutation.`,
    );
    if (!approved) throw new Error("Episode finalization authorization was cancelled");

    lock = normalizeLockHandle(await deps.acquireLock(lockPath, lockOptions));
    try {
      const newer = existingResult(); if (newer) return newer;
      const refreshed = identity(deps.readJson(selected.identity));
      assertExactOwner(refreshed, ctx, selected.sourceLocation);
      if (!receiptMatchesIdentity(value, refreshed)) throw new Error("Episode identity changed during finalization confirmation");
      if (deps.currentBranch(selected.repo) !== value.targetBranch
        || deps.commit(selected.repo, refreshed.branch) !== value.episodeCommit
        || deps.commit(selected.repo, value.targetRef) !== value.targetCommitAtAuthorization) {
        throw new Error("Finalization facts changed during operator confirmation");
      }
      lock.assertHeld();
      deps.writeJson(selected.receipt, value);
      return { receipt: value, reused: false };
    } finally { await lock.release(); }
  } finally { deps.close(); }
}

function validateSessions(rows: unknown, authorization: FinalizationReceipt): void {
  if (!Array.isArray(rows)) throw new Error("Daemon session list is malformed");
  for (const raw of rows) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Daemon session row is malformed");
    const data = raw as Record<string, unknown>;
    const supplied = (key: "sessionId" | "id" | "activeSessionId" | "sessionFile") => Object.prototype.hasOwnProperty.call(data, key);
    for (const key of ["sessionId", "id", "activeSessionId", "sessionFile"] as const) {
      if (supplied(key) && !nonempty(data[key])) throw new Error(`Daemon session row has an invalid ${key}`);
    }
    const ids = [supplied("sessionId") ? data.sessionId as string : undefined, supplied("id") ? data.id as string : undefined]
      .filter((value): value is string => value !== undefined);
    if (ids.length === 0 || !supplied("sessionFile")) throw new Error("Daemon session row is partial or malformed");
    if (ids.some((value) => !SESSION_UUID.test(value))) throw new Error("Daemon session row has an invalid session UUID");
    if (new Set(ids).size !== 1) throw new Error("Daemon session row has conflicting sessionId/id fields");

    const uuidMatch = ids[0] === authorization.episodeId;
    const routeMatch = supplied("activeSessionId") && data.activeSessionId === authorization.episodeActiveSessionId;
    const fileMatch = samePath(data.sessionFile as string, authorization.episodeSessionFile);
    if (uuidMatch && routeMatch && fileMatch) throw new Error("Episode session is still addressable");
    if (uuidMatch || routeMatch || fileMatch) {
      throw new Error("Daemon session row partially or conflictingly matches the exact episode UUID, route, or file");
    }
  }
}
function validateWorktrees(rows: unknown, authorization: FinalizationReceipt): void {
  if (!Array.isArray(rows)) throw new Error("Git worktree list is malformed");
  for (const raw of rows) {
    if (!raw || typeof raw !== "object" || !nonempty((raw as { path?: unknown }).path)) throw new Error("Git worktree row is malformed");
    const row = raw as { path: string; branch?: unknown };
    if (row.branch !== undefined && !nonempty(row.branch)) throw new Error("Git worktree row is malformed");
    if (samePath(row.path, authorization.episodeWorktree) || row.branch === authorization.episodeBranch) {
      throw new Error("Episode worktree is still present or addressable");
    }
  }
}
async function validateTerminalFacts(selected: ReturnType<typeof parseLocation>, authorization: FinalizationReceipt,
  disposition: OversightDisposition, deps: FinalizationDependencies): Promise<void> {
  if (deps.currentBranch(selected.repo) !== authorization.targetBranch) throw new Error("Finalization target branch mismatch");
  const episodeTip = deps.commit(selected.repo, authorization.episodeBranch);
  if (episodeTip !== authorization.episodeCommit) throw new Error("Episode branch advanced after authorization");
  const authorizedEpisodeCommit = deps.commit(selected.repo, authorization.episodeCommit);
  if (authorizedEpisodeCommit !== authorization.episodeCommit) throw new Error("Authorized episode commit is corrupt");
  const originalTargetCommit = deps.commit(selected.repo, authorization.targetCommitAtAuthorization);
  if (originalTargetCommit !== authorization.targetCommitAtAuthorization) throw new Error("Authorized target commit is corrupt");
  const targetTip = deps.commit(selected.repo, authorization.targetRef);
  if (!deps.isAncestor(selected.repo, authorization.targetCommitAtAuthorization, targetTip)) {
    throw new Error("Finalization target branch no longer descends from the authorized target commit");
  }
  const merged = deps.isAncestor(selected.repo, authorization.episodeCommit, targetTip);
  if (disposition === "merged" && !merged) throw new Error("Authorized episode commit is not merged into the target branch");
  if (disposition === "abandoned" && merged) throw new Error("Abandoned episode commit is already merged into the target branch");
  validateSessions(await deps.listSessions(), authorization);
  if (deps.exists(authorization.episodeWorktree)) throw new Error("Episode worktree is still present");
  validateWorktrees(deps.worktrees(selected.repo), authorization);
}

export async function completeEpisodeFinalization(
  rawLocation: string,
  disposition: OversightDisposition,
  ctx: ExtensionContext,
  appendTransition: (status: "inactive", marker: OversightMarker) => void,
  marker: OversightMarker,
  supplied?: FinalizationDependencies,
  lockOptions?: FinalizationLockOptions,
): Promise<FinalizationReceipt> {
  const deps = supplied ?? new NativeFinalizationDependencies();
  try {
    if (disposition !== "merged" && disposition !== "abandoned") throw new Error("Disposition must be merged or abandoned");
    const selected = parseLocation(ctx.cwd, rawLocation, deps);
    const lock = normalizeLockHandle(await deps.acquireLock(`${selected.receipt}.transaction.lock`, lockOptions));
    try {
    let authorization = parseFinalizationReceipt(deps.readJson(selected.receipt));
    assertRequest(authorization, selected.sourceLocation, selected.slug, disposition, ctx.sessionManager.getSessionId());
    const identityExists = deps.exists(selected.identity);
    if (identityExists) {
      const record = identity(deps.readJson(selected.identity));
      assertExactOwner(record, ctx, selected.sourceLocation);
      if (!receiptMatchesIdentity(authorization, record)) throw new Error("Finalization receipt does not match the exact owned episode");
    }
    assertExactMarker(marker, authorization, authorization.state === "completed" ? ["active", "inactive"]
      : authorization.state === "authorized" ? ["active"] : ["active", "inactive"]);
    assertLifecycleShape(authorization.state, identityExists, authorization.state === "completed" ? "inactive" : marker.status);
    if (authorization.state === "completed") return authorization;

    await whileLockHeld(lock, validateTerminalFacts(selected, authorization, disposition, deps));

    if (authorization.state === "authorized") {
      authorization = { ...authorization, state: "completing", completingAt: deps.now() };
      lock.assertHeld();
      deps.writeJson(selected.receipt, authorization);
    }
    lock.assertHeld();
    if (marker.status === "active") appendTransition("inactive", { ...marker, status: "inactive" });
    lock.assertHeld();
    deps.remove(selected.identity);
    const completed: FinalizationReceipt = { ...authorization, state: "completed", completedAt: deps.now() };
    lock.assertHeld();
    deps.writeJson(selected.receipt, completed);
    return completed;
    } finally { await lock.release(); }
  } catch (error) {
    throw new Error(`Finalization is blocked with durable recovery evidence preserved: ${error instanceof Error ? error.message : String(error)}`);
  } finally { deps.close(); }
}

export async function recoverCompletingEpisodeFinalization(
  ctx: ExtensionContext,
  appendTransition: (status: "inactive", marker: OversightMarker) => void,
  marker: OversightMarker,
  supplied?: FinalizationDependencies,
  lockOptions?: FinalizationLockOptions,
): Promise<FinalizationReceipt | null> {
  const deps = supplied ?? new NativeFinalizationDependencies();
  let delegated = false;
  try {
    const selected = parseLocation(ctx.cwd, marker.sourceLocation, deps);
    if (!deps.exists(selected.receipt)) return null;
    const receipt = parseFinalizationReceipt(deps.readJson(selected.receipt));
    if (receipt.state !== "completing") return null;
    delegated = true;
    return await completeEpisodeFinalization(
      marker.sourceLocation,
      receipt.disposition,
      ctx,
      appendTransition,
      marker,
      deps,
      lockOptions,
    );
  } finally {
    if (!delegated) deps.close();
  }
}
