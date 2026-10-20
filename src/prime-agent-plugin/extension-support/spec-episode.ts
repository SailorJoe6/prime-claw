import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  lstatSync,
  readFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createConnection, type Socket } from "node:net";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  admitWorkflowChain,
  canonicalWorkflowPrompt,
} from "./workflow-chain.ts";
import {
  isLegacyEpisodeOwnership,
  isTaskEpisodeOwnership,
  parseEpisodeOwnership,
  readEpisodeOwnership,
  withEpisodeAdmissionLock,
  writeEpisodeOwnership,
  type EpisodeOwnershipRecord,
  type LegacyEpisodeOwnershipRecord,
  type TaskEpisodeOwnershipRecord,
} from "./episode-ownership.ts";
import {
  resolveFutureLocationSyntax,
  validateFutureLocation,
  type BacklogTaskSelection,
} from "./reviewed-plan-support.ts";
import {
  detectTaskProvider,
  mutateAndPublishBeadsTaskStatus,
  mutateProviderTaskStatus,
  requireBacklogTaskSelection,
  resolveProviderTask,
  type BeadsTaskMutationPublication,
} from "./task-providers.ts";
import {
  ProcessCommandRunner,
  resolveNearestProjectRoot,
  type CommandRunner,
} from "./project-initialization.ts";
import { activeLegacyPlanFiles, restoreBlockedLegacyPlanFiles } from "./legacy-workflow.ts";
import {
  meaningfulTaskImplementationPlan,
  reserveTaskEpisodeOwnership,
  transitionLegacyEpisodeOwnershipToTask,
  type LegacyTaskOwnershipTransitionGit,
  type LegacyTaskOwnershipTransitionResult,
  type TaskEpisodeReservationInput,
} from "./task-episode-ownership.ts";

/**
 * Default task resolver for the Episode lifecycle paths in this module:
 * provider-aware resolution narrowed to the existing Backlog selection
 * contract these paths still require. A Beads store resolves the task with
 * no Markdown path, so the file-bound admission/cleanup choreography here
 * rejects it explicitly until its own provider slice lands; task resolution
 * and status mutation themselves already run through the selected provider.
 */
function defaultEpisodeTaskResolver(runner: CommandRunner) {
  return (cwd: string, exactTaskId: string): BacklogTaskSelection | null =>
    requireBacklogTaskSelection(
      resolveProviderTask(cwd, exactTaskId, runner),
      "this Episode lifecycle path",
    );
}

const PROTOCOL_NAME = "prime-agent.daemon";
const MAX_PROTOCOL_VERSION = 7;
const RESERVED_PLAN_DIRECTORIES = new Set(["future", "archive", "blocked"]);

export class DaemonMutationUncertainError extends Error {
  readonly operation: string;
  constructor(operation: string, message: string) {
    super(`${operation} outcome is uncertain: ${message}`);
    this.operation = operation;
    this.name = "DaemonMutationUncertainError";
  }
}
export class EpisodeStateUncertainError extends Error {
  constructor(message: string, options?: { cause?: unknown }) { super(message, options); this.name = "EpisodeStateUncertainError"; }
}
export class HandoffFollowUpRejectedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) { super(message, options); this.name = "HandoffFollowUpRejectedError"; }
}
export class OrcaUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) { super(message, options); this.name = "OrcaUnavailableError"; }
}
export class OrcaMutationUncertainError extends Error {
  readonly operation: string;
  constructor(operation: string, message: string, options?: { cause?: unknown }) {
    super(`${operation} outcome is uncertain: ${message}`, options);
    this.operation = operation;
    this.name = "OrcaMutationUncertainError";
  }
}

function isUncertainMutation(error: unknown): boolean {
  return error instanceof DaemonMutationUncertainError
    || error instanceof EpisodeStateUncertainError
    || error instanceof OrcaMutationUncertainError;
}

export type EpisodeResult = LegacyEpisodeOwnershipRecord & { reused: boolean };
export type TaskEpisodeResult = TaskEpisodeOwnershipRecord & { reused: boolean };

export interface SessionSummary {
  activeSessionId?: string; id?: string; sessionId?: string; sessionFile?: string;
  sessionName?: string; cwd?: string; isSessionActive?: boolean; isStreaming?: boolean;
  isCompacting?: boolean; queuedCount?: number;
}
export interface EpisodeSessionState extends SessionSummary {
  isBashRunning?: boolean; isRunningTools?: boolean; hasRunningRlmChildren?: boolean;
  unfinishedActionCount?: number;
  sessionActions?: { queuedCount?: number; steering?: unknown[]; followUps?: unknown[]; active?: unknown };
}
export interface EpisodeHandoffResult {
  admitted: true; sourceLocation: string; episodeId: string; episodeActiveSessionId: string;
  handoffDelivery: "prompt"; executeDelivery: "followUp";
}
export interface BlockedLegacyRestoreResult {
  restored: true; sourceLocation: string; episodeId: string; worktree: string;
  specification: string; implementation: string;
}
export interface TaskEpisodeHandoffResult {
  admitted: true; taskId: string; episodeId: string; episodeActiveSessionId: string;
  handoffDelivery: "prompt"; executeDelivery: "followUp";
}
export interface PublishedSession { activeSessionId: string; sessionId: string; sessionFile: string }

export function episodeResultText(result: EpisodeResult): string {
  return `Episode ${result.reused ? "reused" : "created"}: ${JSON.stringify({
    episodeId: result.episodeId,
    episodeActiveSessionId: result.episodeActiveSessionId,
    engine: result.engine,
    projectSetupId: result.projectSetupId,
    worktreeId: result.worktreeId,
    branch: result.branch,
    worktree: result.worktree,
    status: result.status,
    reused: result.reused,
  })}`;
}

export interface GitAdapter {
  repositoryRoot(cwd: string): string;
  head(repo: string): string;
  branch(worktree: string): string;
  worktrees(repo: string): Array<{ path: string; branch?: string }>;
  createWorktree(repo: string, branch: string, worktree: string, baseRef: string): void;
  assertCleanWorktree(worktree: string): void;
  pathStatus(worktree: string, path: string): string;
  commitPromotion(worktree: string, slug: string): string;
}
export interface FilesystemAdapter {
  exists(path: string): boolean;
  hasActiveLegacyPlanFiles(worktree: string): boolean;
  promoteBundle(worktree: string, slug: string, canonicalFolder: string, expectedDigest: string): void;
}
export interface EpisodeOwnershipStore {
  read(projectRoot: string, ownerSessionId?: string): EpisodeOwnershipRecord | null;
  write(projectRoot: string, record: EpisodeOwnershipRecord): void;
}
export interface SessionPublisher {
  list(): Promise<SessionSummary[]>;
  getState(activeSessionId: string): Promise<EpisodeSessionState>;
  kill?(activeSessionId: string): Promise<void>;
  deleteSaved?(sessionFile: string): Promise<void>;
  createFresh(options: { worktree: string; sessionName: string; model?: { provider: string; id: string }; onAllocated?: (identity: { sessionId: string; sessionFile: string }) => void | Promise<void> }): Promise<PublishedSession>;
  reopen(options: { sessionFile: string; sessionId: string; worktree: string; sessionName: string; model?: { provider: string; id: string } }): Promise<PublishedSession>;
  deliverExecute(activeSessionId: string, prompt: string): Promise<void>;
  deliverHandoff(activeSessionId: string, handoffPrompt: string, executePrompt: string, onHandoffAdmitted?: () => void | Promise<void>, queueHandoffIfBusy?: boolean): Promise<void>;
  close(): void;
}
export interface OrcaProjectSetup {
  id: string; projectId: string; hostId: string; path: string; displayName: string;
  environmentLabel: string; platform?: string; routingEnvironmentId?: string;
}
export interface OrcaWorktree {
  id: string; identity: string; path: string; branch: string; head: string; projectSetupId: string;
}
export interface OrcaTerminal {
  handle: string; connected: boolean; writable: boolean; agentIdentity?: string; worktreeId: string;
  tabId?: string; leafId?: string; worktreePath?: string; visible: boolean;
}
export interface OrcaAdapter {
  listReadySetups(projectRoot: string): Promise<OrcaProjectSetup[]>;
  createWorktree(options: { setup: OrcaProjectSetup; name: string; baseRef: string }): Promise<OrcaWorktree>;
  showWorktree(worktreeId: string, routingEnvironmentId?: string): Promise<OrcaWorktree>;
  createLaunchAutomation(options: { worktreeId: string; name: string; prompt: string; routingEnvironmentId?: string }): Promise<string>;
  runAutomation(id: string, routingEnvironmentId?: string): Promise<string>;
  removeAutomation(id: string, routingEnvironmentId?: string): Promise<void>;
  listTerminals(worktreeId: string, routingEnvironmentId?: string): Promise<OrcaTerminal[]>;
  readTerminalScreen(handle: string, routingEnvironmentId?: string): Promise<{ source: string; text: string }>;
}
export interface EpisodeDependencies {
  git?: GitAdapter;
  filesystem?: FilesystemAdapter;
  ownership?: EpisodeOwnershipStore;
  publisher?: SessionPublisher;
  orca?: OrcaAdapter;
  guideRoot?: string;
  wait?: (ms: number) => Promise<void>;
  bindingAttempts?: number;
}
export interface TaskEpisodeHandoffDependencies extends EpisodeDependencies {
  taskRunner?: CommandRunner;
  taskResolver?: (cwd: string, taskId: string) => BacklogTaskSelection | null;
}
export interface EpisodeOwnershipTransitionDependencies extends EpisodeDependencies {
  transitionGit?: LegacyTaskOwnershipTransitionGit;
  taskRunner?: CommandRunner;
  taskResolver?: (cwd: string, taskId: string) => BacklogTaskSelection | null;
  transitionNow?: () => string;
  transitionOwnership?: typeof transitionLegacyEpisodeOwnershipToTask;
}

export interface EpisodeCreationOptions { host?: string; approvedBundleDigest?: string }

export interface TaskEpisodeAdmissionGit {
  repositoryRoot(cwd: string): string;
  branch(repo: string): string;
  head(repo: string): string;
  commitPaths(repo: string, ref: string): string[];
  pathStatus(repo: string, path: string): string;
  commitOnlyPath(repo: string, path: string, message: string): string;
  push(repo: string): void;
}

export interface TaskEpisodeAdmissionOptions {
  engine: "orca" | "local";
  projectSetupId?: string;
  routingEnvironmentId?: string;
}

export type TaskEpisodeCreationResult = TaskEpisodeResult & {
  admissionPushError?: string;
};

export interface TaskEpisodeCreationDependencies extends EpisodeDependencies {
  admissionGit?: TaskEpisodeAdmissionGit;
  admissionRunner?: CommandRunner;
  taskResolver?: (cwd: string, taskId: string) => BacklogTaskSelection | null;
  reserveTaskOwnership?: typeof reserveTaskEpisodeOwnership;
  allocateTaskEpisode?: typeof allocateReservedTaskEpisode;
  reservationOperationId?: string;
  now?: () => string;
}
export interface TaskEpisodeCleanupGit {
  repositoryRoot(cwd: string): string;
  branch(repo: string): string;
  head(repo: string): string;
  upstreamHead(repo: string): string;
  branchUpstreamHead(repo: string, branch: string): string;
  assertCleanWorktree(repo: string): void;
  isAncestor(repo: string, ancestor: string, descendant: string): boolean;
  pathTrackedAtRef(repo: string, ref: string, path: string): boolean;
}

export type TaskEpisodeCleanupOutcome = "merged" | "abandoned";
export type TaskEpisodeCleanupSnapshot = {
  runtime?: { cwd: string; idle: boolean };
  worktree?: { path: string; branch: string; head: string; clean: boolean };
  branch?: { name: string; head: string };
};
export interface TaskEpisodeCleanupAdapter {
  inspect(record: TaskEpisodeOwnershipRecord): Promise<TaskEpisodeCleanupSnapshot>;
  removeRuntime(record: TaskEpisodeOwnershipRecord): Promise<void>;
  removeWorktree(record: TaskEpisodeOwnershipRecord): Promise<void>;
  removeBranch(record: TaskEpisodeOwnershipRecord): Promise<void>;
}
export interface TaskEpisodeCleanupDependencies {
  ownership?: EpisodeOwnershipStore;
  cleanupGit?: TaskEpisodeCleanupGit;
  cleanup: TaskEpisodeCleanupAdapter;
  taskRunner?: CommandRunner;
  taskResolver?: (cwd: string, taskId: string) => BacklogTaskSelection | null;
  now?: () => string;
}
export type TaskEpisodeCleanupResult = {
  verified: true;
  outcome: TaskEpisodeCleanupOutcome;
  taskId: string;
  episodeHead: string;
  resourcesRemoved: true;
  ownershipStatus: "inactive";
  reused: boolean;
};

function runGitRaw(cwd: string, args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function runGit(cwd: string, args: string[]): string {
  return runGitRaw(cwd, args).trim();
}
export class CliGitAdapter implements GitAdapter {
  private readonly runner: (cwd: string, args: string[]) => string;
  constructor(runner: (cwd: string, args: string[]) => string = runGit) { this.runner = runner; }
  repositoryRoot(cwd: string): string { return realpathSync(this.runner(cwd, ["rev-parse", "--show-toplevel"])); }
  head(repo: string): string { return this.runner(repo, ["rev-parse", "HEAD"]); }
  branch(worktree: string): string { return this.runner(worktree, ["symbolic-ref", "--short", "HEAD"]); }
  worktrees(repo: string): Array<{ path: string; branch?: string }> {
    const output = this.runner(repo, ["worktree", "list", "--porcelain"]);
    if (!output) return [];
    return output.split("\n\n").map((block) => {
      const lines = block.split("\n");
      const path = lines.find((line) => line.startsWith("worktree "))?.slice(9) ?? "";
      const branchRef = lines.find((line) => line.startsWith("branch "))?.slice(7);
      return { path: resolve(path), branch: branchRef?.replace(/^refs\/heads\//, "") };
    }).filter((entry) => entry.path !== "");
  }
  createWorktree(repo: string, branch: string, worktree: string, baseRef: string): void {
    this.runner(repo, ["worktree", "add", "-b", branch, worktree, baseRef]);
  }
  assertCleanWorktree(worktree: string): void {
    const status = this.runner(worktree, ["status", "--porcelain"]);
    if (status !== "") throw new Error(`New episode worktree is not clean: ${status}`);
  }
  pathStatus(worktree: string, path: string): string {
    return this.runner(worktree, ["status", "--porcelain", "--untracked-files=all", "--", path]);
  }
  commitPromotion(worktree: string, slug: string): string {
    this.runner(worktree, ["add", "-A"]);
    this.runner(worktree, ["commit", "--allow-empty", "-m", `chore: promote ${slug} specification`]);
    return this.head(worktree);
  }
}
export class CliTaskEpisodeAdmissionGit implements TaskEpisodeAdmissionGit {
  repositoryRoot(cwd: string): string { return realpathSync(runGit(cwd, ["rev-parse", "--show-toplevel"])); }
  branch(repo: string): string { return runGit(repo, ["symbolic-ref", "--short", "HEAD"]); }
  head(repo: string): string { return runGit(repo, ["rev-parse", "HEAD"]); }
  commitPaths(repo: string, ref: string): string[] {
    const output = runGit(repo, ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", ref, "--"]);
    return output ? output.split(/\r?\n/).filter(Boolean) : [];
  }
  pathStatus(repo: string, path: string): string { return runGit(repo, ["status", "--porcelain", "--", path]); }
  commitOnlyPath(repo: string, path: string, message: string): string {
    runGit(repo, ["add", "--", path]);
    runGit(repo, ["commit", "--only", "-m", message, "--", path]);
    return this.head(repo);
  }
  push(repo: string): void { runGit(repo, ["push"]); }
}

export class CliTaskEpisodeCleanupGit implements TaskEpisodeCleanupGit {
  repositoryRoot(cwd: string): string { return realpathSync(runGit(cwd, ["rev-parse", "--show-toplevel"])); }
  branch(repo: string): string { return runGit(repo, ["symbolic-ref", "--short", "HEAD"]); }
  head(repo: string): string { return runGit(repo, ["rev-parse", "HEAD"]); }
  upstreamHead(repo: string): string { return runGit(repo, ["rev-parse", "@{upstream}"]); }
  branchUpstreamHead(repo: string, branch: string): string {
    return runGit(repo, ["rev-parse", `${branch}@{upstream}`]);
  }
  assertCleanWorktree(repo: string): void {
    if (runGitRaw(repo, ["status", "--porcelain=v1", "--untracked-files=no"]).trim()) {
      throw new Error("Task Episode cleanup requires canonical main without staged or tracked changes");
    }
  }
  isAncestor(repo: string, ancestor: string, descendant: string): boolean {
    try { runGit(repo, ["merge-base", "--is-ancestor", ancestor, descendant]); return true; }
    catch { return false; }
  }
  pathTrackedAtRef(repo: string, ref: string, path: string): boolean {
    return runGitRaw(repo, ["ls-tree", "-z", "--name-only", ref, "--", path])
      .split("\0").filter(Boolean).includes(path);
  }
}

export function bundleContentDigest(folder: string, topNames?: string[]): string {
  const hash = createHash("sha256");
  const walk = (absolute: string, relativePath: string): void => {
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
      throw new Error(`Approved bundle contains unsupported entry: ${relativePath || "."}`);
    }
    const kind = stat.isDirectory() ? "directory" : "file";
    hash.update(`${kind}\0${Buffer.byteLength(relativePath)}\0${relativePath}\0`);
    if (stat.isFile()) {
      const bytes = readFileSync(absolute);
      hash.update(`${bytes.length}\0`); hash.update(bytes); return;
    }
    const names = relativePath === "" && topNames ? [...topNames].sort() : readdirSync(absolute).sort();
    for (const name of names) walk(join(absolute, name), relativePath ? `${relativePath}/${name}` : name);
  };
  if (!existsSync(folder) || !statSync(folder).isDirectory()) throw new Error(`Approved bundle folder is missing: ${folder}`);
  walk(folder, "");
  return hash.digest("hex");
}

export class NodeFilesystemAdapter implements FilesystemAdapter {
  exists(path: string): boolean { return existsSync(path); }
  hasActiveLegacyPlanFiles(worktree: string): boolean { return activeLegacyPlanFiles(worktree) !== null; }
  promoteBundle(worktree: string, slug: string, canonicalFolder: string, expectedDigest: string): void {
    const plans = join(worktree, ".ralph", "plans");
    const source = join(plans, "future", slug);
    if (bundleContentDigest(canonicalFolder) !== expectedDigest) throw new Error("Approved bundle changed after implementation admission");
    rmSync(source, { recursive: true, force: true });
    mkdirSync(dirname(source), { recursive: true });
    cpSync(canonicalFolder, source, { recursive: true, errorOnExist: true, force: false });
    if (bundleContentDigest(source) !== expectedDigest) throw new Error("Approved bundle copy did not preserve exact content");
    const bundleEntries = readdirSync(source, { withFileTypes: true });
    const reserved = bundleEntries.find((entry) => RESERVED_PLAN_DIRECTORIES.has(entry.name));
    if (reserved) throw new Error(`Approved bundle conflicts with reserved plan lifecycle directory: ${reserved.name}`);
    for (const entry of readdirSync(plans, { withFileTypes: true })) {
      if (RESERVED_PLAN_DIRECTORIES.has(entry.name)) continue;
      rmSync(join(plans, entry.name), { recursive: true, force: true });
    }
    const names = bundleEntries.map((entry) => entry.name);
    for (const entry of bundleEntries) cpSync(join(source, entry.name), join(plans, entry.name), { recursive: true, errorOnExist: true, force: false });
    if (bundleContentDigest(plans, names) !== expectedDigest) throw new Error("Promoted active plan does not match the approved bundle");
    if (bundleContentDigest(canonicalFolder) !== expectedDigest) throw new Error("Approved bundle changed during promotion");
    rmSync(source, { recursive: true, force: false });
    if (!this.hasActiveLegacyPlanFiles(worktree)) {
      throw new Error("Promoted legacy Episode is missing its readable non-empty active specification and implementation plan");
    }
  }
}
const defaultOwnershipStore: EpisodeOwnershipStore = { read: readEpisodeOwnership, write: writeEpisodeOwnership };

interface DaemonResponse {
  id?: string;
  success?: boolean;
  error?: string;
  errorInfo?: { code?: string; clientId?: string; commandId?: string };
  data?: unknown;
  type?: string;
  protocol?: { name?: string; version?: number };
}

export class DaemonJsonlClient {
  private socket?: Socket;
  private protocolVersion?: number;
  private lineBuffer = "";
  private helloResolve?: () => void;
  private helloReject?: (error: Error) => void;
  private pending = new Map<string, {
    resolve: (response: DaemonResponse) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    acknowledge: boolean;
    commandType: string;
  }>();
  private readonly clientId = `spec-episode:${randomUUID()}`;

  private readonly socketPath: string;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  async connect(timeoutMs = 3000): Promise<void> {
    if (this.socket) return;
    const socket = createConnection(this.socketPath);
    this.socket = socket;
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => this.onData(chunk));
    socket.on("error", (error) => this.failAll(error));
    socket.on("close", () => this.failAll(new Error("Prime Agent daemon connection closed")));

    await new Promise<void>((resolveConnect, rejectConnect) => {
      const timer = setTimeout(() => rejectConnect(new Error("Timed out connecting to Prime Agent daemon")), timeoutMs);
      socket.once("connect", () => { clearTimeout(timer); resolveConnect(); });
      socket.once("error", (error) => { clearTimeout(timer); rejectConnect(error); });
    });
    if (!this.protocolVersion) {
      await new Promise<void>((resolveHello, rejectHello) => {
        const timer = setTimeout(() => rejectHello(new Error("Timed out waiting for Prime Agent daemon handshake")), timeoutMs);
        this.helloResolve = () => { clearTimeout(timer); resolveHello(); };
        this.helloReject = (error) => { clearTimeout(timer); rejectHello(error); };
        if (this.protocolVersion) this.helloResolve();
      });
    }
  }

  async request(command: Record<string, unknown>, timeoutMs = 30_000): Promise<DaemonResponse> {
    await this.connect();
    const id = `spec_episode_${randomUUID()}`;
    const commandWithId = { ...command, id };
    const wire = {
      type: "command",
      id,
      protocol: { name: PROTOCOL_NAME, version: this.protocolVersion },
      clientId: this.clientId,
      command: commandWithId,
    };
    return new Promise<DaemonResponse>((resolveResponse, rejectResponse) => {
      const commandType = String(command.type);
      const acknowledge = ["create", "prompt", "kill", "delete_saved_session"].includes(commandType);
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectResponse(acknowledge
          ? new DaemonMutationUncertainError(commandType, `timed out after ${timeoutMs}ms`)
          : new Error(`Timed out waiting for daemon command ${commandType}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolveResponse, reject: rejectResponse, timer, acknowledge, commandType });
      try {
        this.socket!.write(`${JSON.stringify(wire)}\n`);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        rejectResponse(acknowledge
          ? new DaemonMutationUncertainError(commandType, String(error))
          : error);
      }
    });
  }

  close(): void {
    this.socket?.end();
    this.socket?.destroy();
    this.socket = undefined;
  }

  private onData(chunk: string): void {
    this.lineBuffer += chunk;
    while (true) {
      const newline = this.lineBuffer.indexOf("\n");
      if (newline < 0) break;
      const line = this.lineBuffer.slice(0, newline);
      this.lineBuffer = this.lineBuffer.slice(newline + 1);
      let message: DaemonResponse;
      try { message = JSON.parse(line); } catch { continue; }
      if (message.type === "daemon_hello") {
        const version = message.protocol?.version;
        if (message.protocol?.name !== PROTOCOL_NAME || typeof version !== "number" || version < 7) {
          this.helloReject?.(new Error("Unsupported Prime Agent daemon protocol"));
          continue;
        }
        this.protocolVersion = Math.min(version, MAX_PROTOCOL_VERSION);
        this.helloResolve?.();
        this.helloResolve = undefined;
        this.helloReject = undefined;
        continue;
      }
      if (!message.id) continue;
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      pending.resolve(message);
      if (pending.acknowledge) this.acknowledge(message.id);
    }
  }

  private acknowledge(commandId: string): void {
    if (!this.socket || !this.protocolVersion) return;
    const id = `spec_episode_ack_${randomUUID()}`;
    const command = { id, type: "ack_result", commandId };
    this.socket.write(`${JSON.stringify({
      type: "command",
      id,
      protocol: { name: PROTOCOL_NAME, version: this.protocolVersion },
      clientId: this.clientId,
      command,
    })}\n`);
  }

  private failAll(error: Error): void {
    this.helloReject?.(error);
    this.helloResolve = undefined;
    this.helloReject = undefined;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(pending.acknowledge
        ? new DaemonMutationUncertainError(pending.commandType, error.message)
        : error);
    }
    this.pending.clear();
  }
}

function daemonSocketPath(): string {
  const socketPath = process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET;
  if (!socketPath) {
    throw new Error("Episode creation requires a daemon-backed Prime Agent session");
  }
  return socketPath;
}

function requireSuccess(response: DaemonResponse, operation: string): unknown {
  if (response.success !== true) {
    if (response.errorInfo?.code === "command_result_uncertain") {
      throw new DaemonMutationUncertainError(operation, response.error ?? "daemon reported an uncertain mutation");
    }
    throw new Error(`${operation} failed: ${response.error ?? "unknown daemon error"}`);
  }
  return response.data;
}

function daemonLaunchEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined && !entry[0].startsWith("PRIME_AGENT_INTERNAL_"),
    ),
  );
}


export interface PrimeSessionManagerClass {
  create(cwd: string): { getSessionFile(): string | undefined; getSessionId(): string; flushNow(): void };
}
export function runtimeSessionManagerClass(sessionManager: object): PrimeSessionManagerClass {
  const candidate = Object.getPrototypeOf(sessionManager)?.constructor as Partial<PrimeSessionManagerClass> | undefined;
  if (!candidate || typeof candidate.create !== "function") throw new Error("Prime Agent did not expose a runtime SessionManager with create");
  return candidate as PrimeSessionManagerClass;
}
export class PrimeSessionPublisher implements SessionPublisher {
  private readonly client: DaemonJsonlClient;
  private readonly SessionManager?: PrimeSessionManagerClass;
  constructor(client = new DaemonJsonlClient(daemonSocketPath()), SessionManager?: PrimeSessionManagerClass) {
    this.client = client;
    this.SessionManager = SessionManager;
  }
  async list(): Promise<SessionSummary[]> {
    const data = requireSuccess(await this.client.request({ type: "list", all: true }), "episode session list");
    const sessions = data && typeof data === "object" ? (data as { sessions?: unknown }).sessions : undefined;
    if (!Array.isArray(sessions)) throw new Error("Episode session list returned a malformed sessions payload");
    return sessions as SessionSummary[];
  }
  async getState(activeSessionId: string): Promise<EpisodeSessionState> {
    const data = requireSuccess(await this.client.request({ type: "get_state", activeSessionId }), "episode state check");
    if (!data || typeof data !== "object") throw new Error("Episode state check returned no usable state");
    return data as EpisodeSessionState;
  }
  async kill(activeSessionId: string): Promise<void> {
    requireSuccess(await this.client.request({ type: "kill", activeSessionId }), "episode session kill");
  }
  async deleteSaved(sessionFile: string): Promise<void> {
    const data = requireSuccess(
      await this.client.request({ type: "delete_saved_session", sessionPath: sessionFile }),
      "episode saved-session delete",
    );
    if (!data || typeof data !== "object" || (data as { ok?: unknown }).ok !== true) {
      const error = data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : "daemon did not confirm deletion";
      throw new Error(`episode saved-session delete failed: ${error}`);
    }
  }
  async createFresh(options: { worktree: string; sessionName: string; model?: { provider: string; id: string }; onAllocated?: (identity: { sessionId: string; sessionFile: string }) => void | Promise<void> }): Promise<PublishedSession> {
    if (!this.SessionManager) throw new Error("Episode publication is missing the runtime SessionManager");
    const manager = this.SessionManager.create(options.worktree);
    const sessionFile = manager.getSessionFile();
    if (!sessionFile) throw new Error("Prime Agent created an in-memory Episode session");
    const sessionId = manager.getSessionId();
    manager.flushNow();
    if (!existsSync(sessionFile)) throw new Error("Prime Agent did not persist the allocated Episode session");
    try { await options.onAllocated?.({ sessionId, sessionFile }); }
    catch (error) { rmSync(sessionFile, { force: true }); throw error; }
    try { return await this.openResident({ ...options, sessionFile, sessionId }); }
    catch (error) {
      throw new EpisodeStateUncertainError(`Fresh Episode publication did not complete. Preserved allocated session ${sessionFile} for exact reconciliation.`, { cause: error });
    }
  }
  async reopen(options: { sessionFile: string; sessionId: string; worktree: string; sessionName: string; model?: { provider: string; id: string } }): Promise<PublishedSession> {
    try { return await this.openResident(options); }
    catch (error) {
      if (isUncertainMutation(error)) throw new EpisodeStateUncertainError("Episode route publication may have succeeded; durable resources were preserved.", { cause: error });
      throw error;
    }
  }
  async deliverExecute(activeSessionId: string, prompt: string): Promise<void> {
    try {
      requireSuccess(await this.client.request({ type: "prompt", activeSessionId, message: prompt, streamingBehavior: "followUp", queueIfBusy: true, expandPromptTemplates: false, source: "extension" }), "execute delivery");
    } catch (error) {
      if (isUncertainMutation(error)) throw new EpisodeStateUncertainError("Execute task admission is uncertain; preserve the Episode until inspected.", { cause: error });
      throw error;
    }
  }
  async deliverHandoff(activeSessionId: string, handoffPrompt: string, executePrompt: string, onHandoffAdmitted?: () => void | Promise<void>, queueHandoffIfBusy = false): Promise<void> {
    const admission = await admitWorkflowChain({
      deliverFirst: async () => requireSuccess(await this.client.request({ type: "prompt", activeSessionId, message: handoffPrompt, ...(queueHandoffIfBusy ? { streamingBehavior: "followUp", queueIfBusy: true } : { queueIfBusy: false }), expandPromptTemplates: false, source: "extension" }), "handoff delivery"),
      afterFirst: onHandoffAdmitted,
      deliverFollowUp: async () => requireSuccess(await this.client.request({ type: "prompt", activeSessionId, message: executePrompt, streamingBehavior: "followUp", queueIfBusy: true, expandPromptTemplates: false, source: "extension" }), "execute follow-up delivery"),
    });
    if (admission.ok) return;
    const cause = admission.error;
    if (isUncertainMutation(cause)) {
      const message = admission.stage === "first"
        ? "Handoff admission is uncertain; inspect before another transition."
        : "Execute follow-up admission is uncertain after handoff; inspect before another transition.";
      throw new EpisodeStateUncertainError(message, { cause });
    }
    if (admission.stage === "first") throw cause;
    throw new HandoffFollowUpRejectedError(`Handoff was admitted, but canonical execute follow-up could not be queued: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
  close(): void { this.client.close(); }
  private async openResident(options: { sessionFile: string; sessionId: string; worktree: string; sessionName: string; model?: { provider: string; id: string } }): Promise<PublishedSession> {
    const data = requireSuccess(await this.client.request({
      type: "create", sessionPath: options.sessionFile, lifecycle: "resident", name: options.sessionName,
      launchEnv: daemonLaunchEnvironment(), config: { cwd: options.worktree, ...(options.model ? { provider: options.model.provider, model: options.model.id } : {}) },
    }, 120_000), "episode publication") as SessionSummary | undefined;
    const activeSessionId = data?.activeSessionId ?? data?.id;
    if (!activeSessionId) throw new EpisodeStateUncertainError("Episode publication succeeded without a usable active-session identity");
    const matches = data?.sessionId === options.sessionId && samePath(data.sessionFile, options.sessionFile)
      && samePath(data.cwd, options.worktree) && data.sessionName === options.sessionName;
    if (!matches) throw new EpisodeStateUncertainError("Episode publication returned mismatched identity; resources were preserved");
    return { activeSessionId, sessionId: data.sessionId!, sessionFile: data.sessionFile! };
  }
}

type JsonObject = Record<string, unknown>;
function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} is malformed`);
  return value as JsonObject;
}
function stringField(value: JsonObject, field: string, label: string): string {
  if (typeof value[field] !== "string" || value[field] === "") throw new Error(`${label}.${field} is malformed`);
  return value[field] as string;
}
function runOrcaCommand(args: string[]): string {
  return execFileSync("orca", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function commandIsDefinitelyMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
export class CliOrcaAdapter implements OrcaAdapter {
  private readonly runner: (args: string[]) => string;
  constructor(runner: (args: string[]) => string = runOrcaCommand) { this.runner = runner; }
  private json(args: string[], label: string): JsonObject {
    let raw: string;
    try { raw = this.runner([...args, "--json"]); }
    catch (error) { throw error; }
    let envelope: JsonObject;
    try { envelope = object(JSON.parse(raw), label); }
    catch (error) { throw new Error(`${label} returned malformed JSON: ${error instanceof Error ? error.message : String(error)}`); }
    if (envelope.ok !== true) throw new Error(`${label} failed: ${typeof envelope.error === "string" ? envelope.error : "unknown error"}`);
    return object(envelope.result, `${label}.result`);
  }
  private readyLocalSetups(projectRoot: string, localResult: JsonObject): OrcaProjectSetup[] {
    const localRows = Array.isArray(localResult.setups) ? localResult.setups.map((value) => object(value, "Orca setup")) : [];
    const localProjects = localRows.filter((row) => typeof row.path === "string" && samePath(row.path, projectRoot));
    if (localProjects.length === 0) return [];
    const projectIds = new Set(localProjects.map((row) => stringField(row, "projectId", "Orca setup")));
    if (projectIds.size !== 1) throw new Error("Orca has conflicting project identities for the exact local path");
    return localProjects
      .filter((row) => row.setupState === "ready")
      .map((row) => this.setup(row, "local", "local"));
  }
  async listReadySetups(projectRoot: string): Promise<OrcaProjectSetup[]> {
    let localResult: JsonObject;
    try { localResult = this.json(["project", "setups"], "Orca project setup inventory"); }
    catch (error) { throw new OrcaUnavailableError("Orca CLI/runtime is unavailable before Episode mutation", { cause: error }); }
    return this.readyLocalSetups(projectRoot, localResult);
  }
  async listReadyTaskPlacementSetups(projectRoot: string): Promise<OrcaProjectSetup[]> {
    let localResult: JsonObject;
    try { localResult = this.json(["project", "setups"], "Orca project setup inventory"); }
    catch (error) {
      if (commandIsDefinitelyMissing(error)) {
        throw new OrcaUnavailableError("Orca CLI is absent before task Episode placement", { cause: error });
      }
      throw error;
    }
    return this.readyLocalSetups(projectRoot, localResult);
  }
  async createWorktree(options: { setup: OrcaProjectSetup; name: string; baseRef: string }): Promise<OrcaWorktree> {
    try {
      const result = this.json([
        "worktree", "create", "--project-host-setup", options.setup.id, "--name", options.name,
        "--no-parent", "--setup", "skip", "--base-branch", options.baseRef,
      ], "Orca worktree creation");
      return this.worktree(object(result.worktree, "Orca worktree"));
    } catch (error) {
      throw new OrcaMutationUncertainError("Orca worktree creation", error instanceof Error ? error.message : String(error), { cause: error });
    }
  }
  async showWorktree(worktreeId: string, _routingEnvironmentId?: string): Promise<OrcaWorktree> {
    const result = this.json(["worktree", "show", "--worktree", `id:${worktreeId}`], "Orca worktree lookup");
    return this.worktree(object(result.worktree ?? result, "Orca worktree"));
  }
  async createLaunchAutomation(options: { worktreeId: string; name: string; prompt: string; routingEnvironmentId?: string }): Promise<string> {
    try {
      const result = this.json([
        "automations", "create", "--name", options.name, "--trigger", "weekly", "--day", "0", "--time", "23:59",
        "--prompt", options.prompt, "--provider", "prime-agent", "--workspace", `id:${options.worktreeId}`,
        "--reuse-session", "--disabled",
      ], "Orca launch automation creation");
      return stringField(object(result.automation, "Orca automation"), "id", "Orca automation");
    } catch (error) {
      throw new OrcaMutationUncertainError("Orca launch automation creation", error instanceof Error ? error.message : String(error), { cause: error });
    }
  }
  async runAutomation(id: string, _routingEnvironmentId?: string): Promise<string> {
    try {
      const result = this.json(["automations", "run", "--id", id], "Orca launch automation run");
      return stringField(object(result.run, "Orca automation run"), "id", "Orca automation run");
    } catch (error) { throw new OrcaMutationUncertainError("Orca launch automation run", error instanceof Error ? error.message : String(error), { cause: error }); }
  }
  async removeAutomation(id: string, _routingEnvironmentId?: string): Promise<void> {
    try { this.json(["automations", "remove", "--id", id], "Orca launch automation removal"); }
    catch (error) { throw new OrcaMutationUncertainError("Orca launch automation removal", error instanceof Error ? error.message : String(error), { cause: error }); }
  }
  async listTerminals(worktreeId: string, _routingEnvironmentId?: string): Promise<OrcaTerminal[]> {
    const result = this.json(["terminal", "list", "--worktree", `id:${worktreeId}`, "--include-visual-layouts"], "Orca terminal inventory");
    const layouts = Array.isArray(result.visualLayouts) ? result.visualLayouts : [];
    const layoutContains = (value: unknown, handle: string): boolean => {
      if (!value || typeof value !== "object") return false;
      if (Array.isArray(value)) return value.some((entry) => layoutContains(entry, handle));
      const row = value as JsonObject;
      return row.handle === handle || Object.values(row).some((entry) => layoutContains(entry, handle));
    };
    return (Array.isArray(result.terminals) ? result.terminals : []).map((value) => {
      const row = object(value, "Orca terminal");
      const handle = stringField(row, "handle", "Orca terminal");
      return {
        handle,
        worktreeId: stringField(row, "worktreeId", "Orca terminal"),
        connected: row.connected === true,
        writable: row.writable === true,
        visible: layouts.some((layout) => {
          const item = layout && typeof layout === "object" && !Array.isArray(layout) ? layout as JsonObject : undefined;
          return item?.worktreeId === worktreeId && layoutContains(item, handle);
        }),
        ...(typeof row.agentIdentity === "string" ? { agentIdentity: row.agentIdentity } : {}),
        ...(typeof row.tabId === "string" ? { tabId: row.tabId } : {}),
        ...(typeof row.leafId === "string" ? { leafId: row.leafId } : {}),
        ...(typeof row.worktreePath === "string" ? { worktreePath: row.worktreePath } : {}),
      };
    });
  }
  async readTerminalScreen(handle: string, _routingEnvironmentId?: string): Promise<{ source: string; text: string }> {
    const result = this.json(["terminal", "read", "--terminal", handle, "--screen"], "Orca terminal screen");
    const terminal = object(result.terminal, "Orca terminal screen");
    const tail = Array.isArray(terminal.tail) && terminal.tail.every((line) => typeof line === "string") ? terminal.tail as string[] : [];
    return { source: typeof terminal.source === "string" ? terminal.source : "", text: tail.join("\n") };
  }
  private setup(row: JsonObject, environmentLabel: string, hostId: string, routingEnvironmentId?: string): OrcaProjectSetup {
    return {
      id: stringField(row, "id", "Orca setup"), projectId: stringField(row, "projectId", "Orca setup"),
      hostId, path: stringField(row, "path", "Orca setup"),
      displayName: typeof row.displayName === "string" && row.displayName ? row.displayName : String(row.projectId),
      environmentLabel, ...(typeof row.platform === "string" ? { platform: row.platform } : {}),
      ...(routingEnvironmentId ? { routingEnvironmentId } : {}),
    };
  }
  private worktree(row: JsonObject): OrcaWorktree {
    const identity = object(row.identity, "Orca worktree identity");
    return {
      id: stringField(row, "id", "Orca worktree"), identity: stringField(identity, "key", "Orca worktree identity"),
      path: stringField(row, "path", "Orca worktree"),
      branch: stringField(row, "branch", "Orca worktree").replace(/^refs\/heads\//, ""),
      head: stringField(row, "head", "Orca worktree"),
      projectSetupId: stringField(row, "projectHostSetupId", "Orca worktree"),
    };
  }
}

function samePath(a: string | undefined, b: string): boolean {
  return typeof a === "string" && resolve(a) === resolve(b);
}
export type BlockedWorkflowAuthority =
  | { mode: "task"; taskId: string; taskPath: string; projectRoot: string }
  | { mode: "folder"; projectRoot: string };

/**
 * Select blocked-workflow authority before any skill follows folder fallback.
 * A task tag is only a candidate binding; active version-2 ownership and its
 * exact top-level owner remain authoritative.
 */
export function resolveBlockedWorkflowAuthority(
  rawTaskId: string | undefined,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeHandoffDependencies = {},
): BlockedWorkflowAuthority {
  const git = dependencies.git ?? new CliGitAdapter();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const runner = dependencies.taskRunner ?? new ProcessCommandRunner();
  const projectRoot = git.repositoryRoot(ctx.cwd);
  const record = store.read(projectRoot, ctx.sessionManager.getSessionId());
  // Persisted ownership decides before prompt text. A version-1 record keeps
  // the retained folder workflow even if a stale or conflicting task tag is
  // present; the tag is not parsed as a binding in that mode.
  if (record && isLegacyEpisodeOwnership(record)) {
    return { mode: "folder", projectRoot };
  }
  const requestedTaskId = rawTaskId?.trim();
  if (requestedTaskId !== undefined
    && (!requestedTaskId || /\s/.test(requestedTaskId) || requestedTaskId.startsWith("-"))) {
    throw new Error("Blocked workflow requires a canonical Backlog task ID");
  }
  if (!record) {
    if (requestedTaskId !== undefined) {
      throw new Error("Task-bound blocked workflow requires active version-2 Episode ownership");
    }
    return { mode: "folder", projectRoot };
  }
  if (record.status !== "active") {
    throw new Error(`Task-native blocked workflow requires active ownership; found ${record.status}`);
  }
  if (requestedTaskId !== undefined && record.taskId !== requestedTaskId) {
    throw new Error("Task-bound blocked workflow does not match the exact owned Backlog task");
  }
  if (!samePath(projectRoot, realpathSync(ctx.cwd))) {
    throw new Error("Task-native blocked workflow must run from the repository root");
  }
  const project = resolveNearestProjectRoot(ctx.cwd, process.env.HOME ?? "", runner);
  if (!samePath(project.root, projectRoot)
    || project.kind === "linked-worktree"
    || git.branch(projectRoot) !== "main") {
    throw new Error("Task-native blocked workflow must run from the canonical primary main checkout");
  }
  if (!ctx.sessionManager.getSessionFile()) {
    throw new Error("Task-native blocked workflow requires a persisted owner session");
  }
  if ((ctx.sessionManager.getHeader().rlmDepth ?? 0) !== 0) {
    throw new Error("Task-native blocked workflow is available only from a top-level project Conversation");
  }
  exactOwnedTaskRecord(record, record.taskId, ctx.sessionManager.getSessionId());
  return {
    mode: "task",
    taskId: record.taskId,
    taskPath: record.taskPath,
    projectRoot,
  };
}

function sessionIsBusy(session: SessionSummary): boolean {
  return session.isSessionActive === true || session.isStreaming === true || session.isCompacting === true || (session.queuedCount ?? 0) > 0;
}
function sessionRuntimeRoute(session: SessionSummary): string | undefined {
  return session.activeSessionId ?? session.id;
}
function assertIdleEpisodeState(state: EpisodeSessionState, identity: EpisodeOwnershipRecord, activeSessionId: string): void {
  const matches = state.activeSessionId === activeSessionId && state.sessionId === identity.episodeId && samePath(state.sessionFile, identity.episodeSessionFile);
  if (!matches) throw new Error("Episode state does not match the durable owned identity");
  const actions = state.sessionActions;
  const idle = state.isSessionActive === false && state.isStreaming === false && state.isCompacting === false
    && state.isBashRunning === false && state.isRunningTools === false && state.hasRunningRlmChildren === false
    && state.unfinishedActionCount === 0 && actions?.queuedCount === 0
    && Array.isArray(actions.steering) && actions.steering.length === 0
    && Array.isArray(actions.followUps) && actions.followUps.length === 0 && actions.active == null;
  if (!idle) throw new Error("Owned Episode is not quiescent; handoff requires no active turn, tools, compaction, children, or queued actions");
}
function exactOwnedRecord(
  record: EpisodeOwnershipRecord,
  location: string,
  ownerSessionId: string,
): asserts record is LegacyEpisodeOwnershipRecord {
  if (!isLegacyEpisodeOwnership(record)) throw new Error("Existing task-native episode ownership conflicts with future-folder admission");
  if (record.sourceLocation !== location) throw new Error("Existing episode ownership conflicts on sourceLocation");
  if (record.ownerSessionId !== ownerSessionId) throw new Error("Existing episode ownership conflicts on ownerSessionId");
}
function exactOwnedTaskRecord(
  record: EpisodeOwnershipRecord,
  taskId: string,
  ownerSessionId: string,
): asserts record is TaskEpisodeOwnershipRecord {
  if (!isTaskEpisodeOwnership(record)) throw new Error("Existing future-folder episode ownership conflicts with task-native allocation");
  if (record.taskId !== taskId) throw new Error("Existing episode ownership conflicts on taskId");
  if (record.ownerSessionId !== ownerSessionId) throw new Error("Existing episode ownership conflicts on ownerSessionId");
}
function safeTaskLabel(taskId: string): string {
  const label = taskId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!label) throw new Error("Task-native Episode allocation could not derive a safe task label");
  return label;
}
function taskReservationHasResourceIdentity(record: TaskEpisodeOwnershipRecord): boolean {
  return [
    record.worktreeName, record.worktreeId, record.worktreeIdentity, record.worktree,
    record.branch, record.head, record.episodeId, record.episodeSessionFile,
    record.episodeActiveSessionId, record.terminalHandle, record.terminalHandles, record.launchAutomationName,
    record.launchAutomationId, record.launchRunId,
  ].some((value) => value !== undefined);
}
function validateWorktreeBinding(record: EpisodeOwnershipRecord, git: GitAdapter, filesystem: FilesystemAdapter, repo: string): void {
  if (!record.worktree || !record.branch || !filesystem.exists(record.worktree)) throw new Error("Episode ownership references a missing worktree");
  const worktree = git.worktrees(repo).find((entry) => samePath(entry.path, record.worktree));
  if (!worktree || worktree.branch !== record.branch) throw new Error("Episode ownership references a missing or different worktree");
}
function validateWorktreeRecord(record: EpisodeOwnershipRecord, git: GitAdapter, filesystem: FilesystemAdapter, repo: string): void {
  validateWorktreeBinding(record, git, filesystem, repo);
  if (isLegacyEpisodeOwnership(record) && record.status === "active" && !filesystem.hasActiveLegacyPlanFiles(record.worktree!)) {
    throw new Error("Legacy Episode ownership is not live: the recorded worktree is missing its readable non-empty active specification and implementation plan");
  }
}
async function durableSession(record: EpisodeOwnershipRecord, publisher: SessionPublisher): Promise<SessionSummary> {
  const sessions = await publisher.list();
  const session = sessions.find((entry) => entry.sessionId === record.episodeId && samePath(entry.sessionFile, record.episodeSessionFile!));
  if (!session) throw new Error("Episode ownership references a missing or different durable session");
  return session;
}
async function selectSetup(setups: OrcaProjectSetup[], host: string | undefined, ctx: ExtensionContext): Promise<OrcaProjectSetup> {
  if (setups.length === 0) throw new Error("No ready Orca project-host setup exists for this project");
  let selected: OrcaProjectSetup | undefined;
  if (host !== undefined) {
    const match = /^id:([0-9a-f-]+)$/.exec(host);
    if (!match) throw new Error("Host selection must use --host id:<project-host-setup-id>");
    selected = setups.find((setup) => setup.id === match[1]);
    if (!selected) throw new Error(`No ready Orca project-host setup matches ${host}`);
  } else if (setups.length === 1) {
    selected = setups[0];
  } else {
    if (!ctx.hasUI) throw new Error("Multiple ready Orca project locations require --host id:<project-host-setup-id> in noninteractive mode");
    const labels = setups.map((setup) => [setup.displayName, setup.environmentLabel, setup.platform, setup.path, `[id:${setup.id}]`].filter(Boolean).join(" — "));
    const chosen = await ctx.ui.select("Select Episode location", labels);
    if (!chosen) throw new Error("Episode location selection was cancelled; nothing was created");
    selected = setups[labels.indexOf(chosen)];
  }
  if (!selected) throw new Error("Episode location selection did not resolve a setup");
  if (selected.hostId !== "local" || selected.routingEnvironmentId) {
    throw new Error("Remote Episode placement is disabled until exact approved-bundle transport is proven end to end");
  }
  return selected;
}
export interface TaskEpisodePlacementInventory {
  listReadyTaskPlacementSetups(projectRoot: string): Promise<OrcaProjectSetup[]>;
}
export interface TaskEpisodePlacementDependencies {
  orca?: TaskEpisodePlacementInventory;
}

/**
 * Resolve task-native Episode placement before any task, Git, ownership, or
 * resource mutation. Local worktree fallback is allowed only when Orca
 * inventory is proven unavailable and no explicit setup was requested.
 */
export async function resolveTaskEpisodePlacement(
  projectRoot: string,
  host: string | undefined,
  ctx: ExtensionContext,
  dependencies: TaskEpisodePlacementDependencies = {},
): Promise<TaskEpisodeAdmissionOptions> {
  const orca = dependencies.orca ?? new CliOrcaAdapter();
  let setups: OrcaProjectSetup[];
  try {
    setups = await orca.listReadyTaskPlacementSetups(projectRoot);
  } catch (error) {
    if (!(error instanceof OrcaUnavailableError)) throw error;
    if (host) {
      throw new Error(`Explicit Episode host ${host} could not be resolved because Orca inventory is unavailable`);
    }
    return { engine: "local" };
  }
  const setup = await selectSetup(setups, host, ctx);
  return {
    engine: "orca",
    projectSetupId: setup.id,
    ...(setup.routingEnvironmentId ? { routingEnvironmentId: setup.routingEnvironmentId } : {}),
  };
}

async function reservedTaskSetup(
  record: TaskEpisodeOwnershipRecord,
  repo: string,
  orca: OrcaAdapter,
): Promise<OrcaProjectSetup> {
  const setups = await orca.listReadySetups(repo);
  const setup = setups.find((candidate) => candidate.id === record.projectSetupId);
  if (!setup) throw new EpisodeStateUncertainError("Reserved Orca project setup is no longer ready; no allocation was attempted");
  if (setup.hostId !== "local" || setup.routingEnvironmentId) {
    throw new EpisodeStateUncertainError("Reserved task-native Episode placement is no longer an approved local setup");
  }
  if (record.routingEnvironmentId !== setup.routingEnvironmentId) {
    throw new EpisodeStateUncertainError("Reserved Orca routing identity changed before task-native allocation");
  }
  return setup;
}
function newRecord(options: {
  selected: { slug: string; location: string };
  ownerSessionId: string;
  operationId: string;
  engine: "orca" | "local";
  baseRef: string;
  bundleDigest: string;
  setup?: OrcaProjectSetup;
  worktreeName: string;
}): LegacyEpisodeOwnershipRecord {
  const now = new Date().toISOString();
  return {
    version: 1, status: "provisioning", operationId: options.operationId, engine: options.engine,
    ownerSessionId: options.ownerSessionId, sourceLocation: options.selected.location, slug: options.selected.slug,
    baseRef: options.baseRef, bundleDigest: options.bundleDigest, createdAt: now, updatedAt: now, worktreeName: options.worktreeName,
    ...(options.setup ? { projectSetupId: options.setup.id, ...(options.setup.routingEnvironmentId ? { routingEnvironmentId: options.setup.routingEnvironmentId } : {}) } : {}),
  };
}
function updated<T extends EpisodeOwnershipRecord>(record: T, patch: Partial<T>): T {
  return { ...record, ...patch, updatedAt: new Date().toISOString() };
}
function markUncertain<T extends EpisodeOwnershipRecord>(store: EpisodeOwnershipStore, repo: string, record: T, error: unknown): T {
  const uncertain = updated(record, {
    status: "uncertain",
    uncertaintyReason: error instanceof Error ? error.message : String(error),
  });
  try { store.write(repo, uncertain); } catch { /* preserve the last durable provisioning checkpoint */ }
  return uncertain;
}
async function waitForOrcaBinding(options: {
  before: Set<string>; worktree: OrcaWorktree; publisher: SessionPublisher; orca: OrcaAdapter;
  routingEnvironmentId?: string; wait: (ms: number) => Promise<void>; attempts: number;
}): Promise<{ published: PublishedSession; terminal: OrcaTerminal }> {
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    const sessions = await options.publisher.list();
    const candidates = sessions.filter((session) => session.sessionId && !options.before.has(session.sessionId)
      && samePath(session.cwd, options.worktree.path) && session.sessionFile);
    const visibleTerminals = (await options.orca.listTerminals(options.worktree.id, options.routingEnvironmentId))
      .filter((terminal) => terminal.worktreeId === options.worktree.id && terminal.connected && terminal.writable
        && terminal.agentIdentity === "prime-agent" && terminal.visible
        && Boolean(terminal.tabId) && Boolean(terminal.leafId)
        && samePath(terminal.worktreePath, options.worktree.path));
    const terminals: OrcaTerminal[] = [];
    for (const terminal of visibleTerminals) {
      try {
        const screen = await options.orca.readTerminalScreen(terminal.handle, options.routingEnvironmentId);
        if (screen.source === "screen" && screen.text.includes("← manage")) terminals.push(terminal);
      } catch { /* provider readiness can appear on a later bounded attempt */ }
    }
    if (candidates.length > 1 || visibleTerminals.length > 1 || terminals.length > 1) throw new EpisodeStateUncertainError("Orca launch produced multiple candidate Episode sessions or terminals");
    if (candidates.length === 1 && terminals.length === 1) {
      const session = candidates[0];
      return {
        published: { activeSessionId: session.activeSessionId ?? session.id ?? "", sessionId: session.sessionId!, sessionFile: session.sessionFile! },
        terminal: terminals[0],
      };
    }
    await options.wait(500);
  }
  throw new EpisodeStateUncertainError("Timed out binding the fresh Prime Agent session and connected Orca tab at the exact Episode CWD");
}
async function reopenIfNeeded<T extends EpisodeOwnershipRecord>(
  record: T,
  session: SessionSummary,
  ctx: ExtensionContext,
  publisher: SessionPublisher,
  store: EpisodeOwnershipStore,
  repo: string,
): Promise<{ record: T; activeSessionId: string }> {
  let activeSessionId = session.activeSessionId;
  let current = record;
  if (!activeSessionId) {
    const model = ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined;
    const label = isLegacyEpisodeOwnership(record) ? record.slug : safeTaskLabel(record.taskId);
    const reopened = await publisher.reopen({ sessionFile: record.episodeSessionFile!, sessionId: record.episodeId!, worktree: record.worktree!, sessionName: `${label}-episode`, model });
    activeSessionId = reopened.activeSessionId;
  }
  if (!activeSessionId) throw new EpisodeStateUncertainError("Episode has no usable active routing identity");
  if (record.episodeActiveSessionId !== activeSessionId) {
    current = updated(record, { episodeActiveSessionId: activeSessionId });
    store.write(repo, current);
  }
  return { record: current, activeSessionId };
}

async function deliverOwnedEpisodeHandoff(
  record: EpisodeOwnershipRecord,
  guidance: string,
  repo: string,
  ctx: ExtensionContext,
  git: GitAdapter,
  filesystem: FilesystemAdapter,
  orca: OrcaAdapter,
  publisher: SessionPublisher,
  store: EpisodeOwnershipStore,
  promptIdentity: { legacySnapshot?: boolean; taskId?: string; requireExactCwd?: boolean },
): Promise<string> {
  if (record.status !== "active") throw new Error(`Episode ownership is ${record.status}; inspect it before handoff`);
  validateWorktreeRecord(record, git, filesystem, repo);
  if (record.engine === "orca") {
    const worktree = await orca.showWorktree(record.worktreeId!, record.routingEnvironmentId);
    if (worktree.identity !== record.worktreeIdentity || !samePath(worktree.path, record.worktree!)) {
      throw new Error("Orca worktree identity no longer matches Episode ownership");
    }
  }
  const session = await durableSession(record, publisher);
  if (promptIdentity.requireExactCwd && (!session.cwd || !samePath(session.cwd, record.worktree!))) {
    throw new Error("Episode durable session is not rooted at the owned worktree");
  }
  if (sessionIsBusy(session)) throw new Error("Owned Episode is busy; handoff requires an idle Episode with an empty queue");
  const location = promptIdentity.taskId
    ? { tag: "operator-episode-task", value: promptIdentity.taskId }
    : undefined;
  const handoffPrompt = canonicalWorkflowPrompt(record.worktree!, "handoff", {
    guidance: guidance.trim(),
    legacySnapshot: promptIdentity.legacySnapshot,
    location,
    ownerSessionId: record.ownerSessionId,
  });
  if (!handoffPrompt) throw new Error("Episode worktree is missing .prime-claw/workflows/handoff.md");
  const executePrompt = canonicalWorkflowPrompt(record.worktree!, "execute", {
    legacySnapshot: promptIdentity.legacySnapshot,
    location,
    ownerSessionId: record.ownerSessionId,
  });
  if (!executePrompt) throw new Error("Episode worktree is missing .agents/skills/execute/SKILL.md");
  const route = await reopenIfNeeded(record, session, ctx, publisher, store, repo);
  const state = await publisher.getState(route.activeSessionId);
  assertIdleEpisodeState(state, route.record, route.activeSessionId);
  await publisher.deliverHandoff(route.activeSessionId, handoffPrompt, executePrompt);
  return route.activeSessionId;
}

export async function restoreBlockedSpecEpisode(
  rawLocation: string,
  operatorConfirmed: boolean,
  ctx: ExtensionContext,
  dependencies?: EpisodeDependencies,
): Promise<BlockedLegacyRestoreResult> {
  const git = dependencies?.git ?? new CliGitAdapter();
  const filesystem = dependencies?.filesystem ?? new NodeFilesystemAdapter();
  const store = dependencies?.ownership ?? defaultOwnershipStore;
  const orca = dependencies?.orca ?? new CliOrcaAdapter();
  if (operatorConfirmed !== true) throw new Error("Blocked legacy recovery requires the operator's explicit unblock decision");
  const selected = validateFutureLocation(ctx.cwd, rawLocation);
  if (!selected) throw new Error("Invalid future-plan folder");
  const repo = git.repositoryRoot(selected.projectRoot);
  if (!samePath(repo, realpathSync(ctx.cwd)) || git.branch(repo) !== "main") {
    throw new Error("Blocked legacy recovery must run from the canonical primary main checkout");
  }
  if ((ctx.sessionManager.getHeader().rlmDepth ?? 0) !== 0) {
    throw new Error("Blocked legacy recovery is available only from a top-level project Conversation");
  }
  const record = store.read(repo, ctx.sessionManager.getSessionId());
  if (!record) throw new Error(`No durable episode ownership exists for ${selected.location}`);
  exactOwnedRecord(record, selected.location, ctx.sessionManager.getSessionId());
  if (record.status !== "active") throw new Error(`Episode ownership is ${record.status}; blocked recovery requires active version-1 ownership`);
  validateWorktreeBinding(record, git, filesystem, repo);
  if (record.engine === "orca") {
    const current = await orca.showWorktree(record.worktreeId!, record.routingEnvironmentId);
    if (current.identity !== record.worktreeIdentity || !samePath(current.path, record.worktree!)) {
      throw new Error("Orca worktree identity no longer matches Episode ownership");
    }
  }
  if (filesystem.hasActiveLegacyPlanFiles(record.worktree!)) {
    throw new Error("Legacy Episode already has a live active plan pair; blocked recovery is not applicable");
  }

  const exactRecord = JSON.stringify(record);
  const restored = restoreBlockedLegacyPlanFiles(record.worktree!);
  const reloaded = store.read(repo, ctx.sessionManager.getSessionId());
  if (!reloaded) throw new Error("Episode ownership disappeared during blocked recovery");
  exactOwnedRecord(reloaded, selected.location, ctx.sessionManager.getSessionId());
  if (JSON.stringify(reloaded) !== exactRecord) throw new Error("Episode ownership changed during blocked recovery");
  validateWorktreeRecord(reloaded, git, filesystem, repo);
  if (reloaded.engine === "orca") {
    const current = await orca.showWorktree(reloaded.worktreeId!, reloaded.routingEnvironmentId);
    if (current.identity !== reloaded.worktreeIdentity || !samePath(current.path, reloaded.worktree!)) {
      throw new Error("Orca worktree identity changed during blocked recovery");
    }
  }
  return {
    restored: true,
    sourceLocation: reloaded.sourceLocation,
    episodeId: reloaded.episodeId!,
    worktree: reloaded.worktree!,
    specification: restored.specification,
    implementation: restored.implementation,
  };
}

export async function handoffSpecEpisode(
  rawLocation: string,
  guidance: string,
  ctx: ExtensionContext,
  dependencies?: EpisodeDependencies,
): Promise<EpisodeHandoffResult> {
  const git = dependencies?.git ?? new CliGitAdapter();
  const filesystem = dependencies?.filesystem ?? new NodeFilesystemAdapter();
  const store = dependencies?.ownership ?? defaultOwnershipStore;
  const orca = dependencies?.orca ?? new CliOrcaAdapter();
  let publisher = dependencies?.publisher;
  try {
    const selected = resolveFutureLocationSyntax(ctx.cwd, rawLocation);
    if (!selected) throw new Error("Invalid future-plan source location");
    const repo = git.repositoryRoot(selected.projectRoot);
    if (resolve(repo) !== resolve(selected.projectRoot)) throw new Error("The operation must run from the repository root");
    if ((ctx.sessionManager.getHeader().rlmDepth ?? 0) !== 0) throw new Error("Episode handoff is available only from a top-level project Conversation");
    const record = store.read(repo, ctx.sessionManager.getSessionId());
    if (!record) throw new Error(`No durable episode ownership exists for ${selected.location}`);
    exactOwnedRecord(record, selected.location, ctx.sessionManager.getSessionId());
    publisher ??= new PrimeSessionPublisher();
    const activeSessionId = await deliverOwnedEpisodeHandoff(
      record, guidance, repo, ctx, git, filesystem, orca, publisher, store,
      { legacySnapshot: true },
    );
    return {
      admitted: true,
      sourceLocation: selected.location,
      episodeId: record.episodeId!,
      episodeActiveSessionId: activeSessionId,
      handoffDelivery: "prompt",
      executeDelivery: "followUp",
    };
  } finally { try { publisher?.close(); } catch { /* do not mask lifecycle result */ } }
}

/**
 * Guard the one-way authority conversion with live Conversation, Episode,
 * session, and optional Orca evidence before the atomic record replacement.
 */
export async function transitionSpecEpisodeToTaskOwnership(
  sourceLocation: string,
  taskId: string,
  episodeHead: string,
  mainHead: string,
  confirmedReady: boolean,
  ctx: ExtensionContext,
  dependencies: EpisodeOwnershipTransitionDependencies = {},
): Promise<LegacyTaskOwnershipTransitionResult> {
  const git = dependencies.git ?? new CliGitAdapter();
  const filesystem = dependencies.filesystem ?? new NodeFilesystemAdapter();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const orca = dependencies.orca ?? new CliOrcaAdapter();
  const runner = dependencies.taskRunner ?? new ProcessCommandRunner();
  const resolveTask = dependencies.taskResolver
    ?? defaultEpisodeTaskResolver(runner);
  let publisher = dependencies.publisher;
  try {
    const repo = git.repositoryRoot(ctx.cwd);
    if (!samePath(repo, realpathSync(ctx.cwd))) throw new Error("Ownership transition must run from the repository root");
    const project = resolveNearestProjectRoot(ctx.cwd, process.env.HOME ?? "", runner);
    if (!samePath(project.root, repo) || project.kind === "linked-worktree" || git.branch(repo) !== "main") {
      throw new Error("Ownership transition must run from the canonical primary main checkout");
    }
    if ((ctx.sessionManager.getHeader().rlmDepth ?? 0) !== 0) {
      throw new Error("Ownership transition is available only from the top-level owning Conversation");
    }
    const record = store.read(repo, ctx.sessionManager.getSessionId());
    if (!record) throw new Error("Exact Episode ownership is missing before ownership transition");
    if (record.status !== "active") throw new Error(`Ownership transition requires active ownership; found ${record.status}`);
    if (record.ownerSessionId !== ctx.sessionManager.getSessionId()) {
      throw new Error("Ownership transition requires the exact owner Conversation");
    }
    if (isLegacyEpisodeOwnership(record)) {
      if (record.sourceLocation !== sourceLocation) throw new Error("Ownership transition source location does not match active ownership");
    } else if (record.taskId !== taskId) {
      throw new Error("Existing task-native ownership does not match the completed transition binding");
    }
    validateWorktreeRecord(record, git, filesystem, repo);

    if (record.engine === "orca") {
      const current = await orca.showWorktree(record.worktreeId!, record.routingEnvironmentId);
      if (current.id !== record.worktreeId || current.identity !== record.worktreeIdentity
        || !samePath(current.path, record.worktree!) || current.branch !== record.branch
        || current.head !== episodeHead || current.projectSetupId !== record.projectSetupId) {
        throw new Error("Ownership transition Orca worktree evidence no longer matches ownership and the reviewed Episode head");
      }
      const expectedHandles = new Set(record.terminalHandles ?? [record.terminalHandle!]);
      const currentHandles = new Set((await orca.listTerminals(record.worktreeId!, record.routingEnvironmentId))
        .filter((terminal) => terminal.worktreeId === record.worktreeId && terminal.connected && terminal.writable && terminal.visible)
        .map((terminal) => terminal.handle));
      if (expectedHandles.size === 0 || currentHandles.size !== expectedHandles.size
        || [...expectedHandles].some((handle) => !currentHandles.has(handle))) {
        throw new Error("Ownership transition Orca terminal evidence no longer matches the exact owned resources");
      }
    }

    publisher ??= new PrimeSessionPublisher(undefined, runtimeSessionManagerClass(ctx.sessionManager));
    const sessions = await publisher.list();
    const durableMatches = sessions.filter((session) => session.sessionId === record.episodeId);
    if (durableMatches.length !== 1) throw new Error("Ownership transition requires one unambiguous durable Episode session");
    const session = durableMatches[0];
    if (!session.sessionFile || !samePath(session.sessionFile, record.episodeSessionFile!)
      || !session.cwd || !samePath(session.cwd, record.worktree!)) {
      throw new Error("Ownership transition durable session file or CWD no longer matches ownership");
    }
    const currentRoute = sessionRuntimeRoute(session);
    if (!currentRoute) throw new Error("Ownership transition durable session has no verified current runtime route");
    if (currentRoute !== record.episodeActiveSessionId
      && sessions.some((candidate) => sessionRuntimeRoute(candidate) === record.episodeActiveSessionId)) {
      throw new Error("Ownership transition previous runtime route is still live alongside the current durable session");
    }
    if (sessionIsBusy(session)) throw new Error("Ownership transition requires the owned Episode to be idle");
    const state = await publisher.getState(currentRoute);
    assertIdleEpisodeState(state, record, currentRoute);

    const transition = dependencies.transitionOwnership ?? transitionLegacyEpisodeOwnershipToTask;
    return transition({
      projectRoot: repo,
      sourceLocation,
      taskId,
      ownerSessionId: ctx.sessionManager.getSessionId(),
      expectedMainHead: mainHead,
      expectedEpisodeHead: episodeHead,
      expectedPreviousEpisodeActiveSessionId: record.episodeActiveSessionId!,
      verifiedCurrentEpisodeActiveSessionId: currentRoute,
      confirmedReady,
    }, {
      ...(dependencies.transitionGit ? { git: dependencies.transitionGit } : {}),
      ownership: store,
      taskResolver: resolveTask,
      ...(dependencies.transitionNow ? { now: dependencies.transitionNow } : {}),
    });
  } finally { try { publisher?.close(); } catch { /* do not mask transition result */ } }
}

/**
 * Continue one exact active task-native Episode after the owning Conversation
 * has published the main task's resumable `In Progress` state. This internal
 * seam is the guarded ordinary-continuation path for the public task lifecycle.
 */
export async function handoffTaskEpisode(
  rawTaskId: string,
  guidance: string,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeHandoffDependencies = {},
): Promise<TaskEpisodeHandoffResult> {
  const git = dependencies.git ?? new CliGitAdapter();
  const filesystem = dependencies.filesystem ?? new NodeFilesystemAdapter();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const orca = dependencies.orca ?? new CliOrcaAdapter();
  const runner = dependencies.taskRunner ?? new ProcessCommandRunner();
  const resolveTask = dependencies.taskResolver
    ?? defaultEpisodeTaskResolver(runner);
  let publisher = dependencies.publisher;
  try {
    const taskId = rawTaskId.trim();
    if (!taskId || /\s/.test(taskId) || taskId.startsWith("-")) {
      throw new Error("Task-native Episode handoff requires a canonical Backlog task ID");
    }
    const repo = git.repositoryRoot(ctx.cwd);
    if (!samePath(repo, realpathSync(ctx.cwd))) {
      throw new Error("Task-native Episode handoff must run from the repository root");
    }
    const project = resolveNearestProjectRoot(ctx.cwd, process.env.HOME ?? "", runner);
    if (!samePath(project.root, repo) || project.kind === "linked-worktree" || git.branch(repo) !== "main") {
      throw new Error("Task-native Episode handoff must run from the canonical primary main checkout");
    }
    if ((ctx.sessionManager.getHeader().rlmDepth ?? 0) !== 0) {
      throw new Error("Episode handoff is available only from a top-level project Conversation");
    }
    const record = store.read(repo, ctx.sessionManager.getSessionId());
    if (!record) throw new Error(`No durable task-native Episode ownership exists for ${taskId}`);
    exactOwnedTaskRecord(record, taskId, ctx.sessionManager.getSessionId());
    if (record.status !== "active") {
      throw new Error(`Episode ownership is ${record.status}; inspect it before handoff`);
    }
    validateWorktreeRecord(record, git, filesystem, repo);
    git.assertCleanWorktree(record.worktree!);
    const mainTask = resolveTask(repo, taskId);
    if (!mainTask
      || mainTask.taskId !== record.taskId
      || !samePath(mainTask.projectRoot, repo)
      || mainTask.taskPathRelative !== record.taskPath) {
      throw new Error("Task-native Episode handoff does not match the exact owned Backlog task on main");
    }
    if (git.pathStatus(repo, record.taskPath) !== "") {
      throw new Error("Task-native Episode handoff requires the exact main task path to match committed HEAD");
    }
    if (mainTask.status !== "In Progress") {
      throw new Error(`Task-native Episode handoff requires main task status In Progress; found ${mainTask.status}`);
    }
    if (!meaningfulTaskImplementationPlan(mainTask.implementationPlan)) {
      throw new Error("Task-native Episode handoff requires a meaningful main-task Implementation Plan");
    }
    const episodeTask = resolveTask(record.worktree!, taskId);
    if (!episodeTask
      || episodeTask.taskId !== record.taskId
      || !samePath(episodeTask.projectRoot, record.worktree!)
      || episodeTask.taskPathRelative !== record.taskPath) {
      throw new Error("Task-native Episode handoff does not match the exact owned Backlog task in the Episode worktree");
    }
    if (episodeTask.status !== "In Progress") {
      throw new Error(`Task-native Episode handoff requires Episode task status In Progress; found ${episodeTask.status}`);
    }
    if (!meaningfulTaskImplementationPlan(episodeTask.implementationPlan)) {
      throw new Error("Task-native Episode handoff requires a meaningful Episode Implementation Plan");
    }
    publisher ??= new PrimeSessionPublisher();
    const activeSessionId = await deliverOwnedEpisodeHandoff(
      record, guidance, repo, ctx, git, filesystem, orca, publisher, store,
      { taskId: record.taskId, requireExactCwd: true },
    );
    return {
      admitted: true,
      taskId: record.taskId,
      episodeId: record.episodeId!,
      episodeActiveSessionId: activeSessionId,
      handoffDelivery: "prompt",
      executeDelivery: "followUp",
    };
  } finally { try { publisher?.close(); } catch { /* do not mask lifecycle result */ } }
}


/**
 * Allocate resources only after `reserveTaskEpisodeOwnership` has durably bound
 * one exact task and status-commit SHA. This remains an internal migration seam
 * until the status mutation and failure-publication transaction is complete.
 */
export async function allocateReservedTaskEpisode(
  rawTaskId: string,
  ctx: ExtensionContext,
  dependencies?: EpisodeDependencies,
): Promise<TaskEpisodeResult> {
  const git = dependencies?.git ?? new CliGitAdapter();
  const filesystem = dependencies?.filesystem ?? new NodeFilesystemAdapter();
  const store = dependencies?.ownership ?? defaultOwnershipStore;
  const orca = dependencies?.orca ?? new CliOrcaAdapter();
  let publisher = dependencies?.publisher;
  let record: TaskEpisodeOwnershipRecord | undefined;
  let repo = "";
  try {
    if (!rawTaskId || /\s/.test(rawTaskId) || rawTaskId.startsWith("-")) {
      throw new Error("Task-native Episode allocation requires a canonical Backlog task ID");
    }
    repo = git.repositoryRoot(ctx.cwd);
    if (resolve(repo) !== resolve(realpathSync(ctx.cwd))) throw new Error("Task-native Episode allocation must run from the repository root");
    if (!ctx.sessionManager.getSessionFile()) throw new Error("Episode allocation requires a persisted owner session");
    if ((ctx.sessionManager.getHeader().rlmDepth ?? 0) !== 0) throw new Error("Episode allocation is available only from a top-level project Conversation");
    const ownerSessionId = ctx.sessionManager.getSessionId();
    publisher ??= new PrimeSessionPublisher(undefined, runtimeSessionManagerClass(ctx.sessionManager));

    const existing = store.read(repo, ownerSessionId);
    if (!existing) throw new Error(`No durable task-native Episode reservation exists for ${rawTaskId}`);
    exactOwnedTaskRecord(existing, rawTaskId, ownerSessionId);
    if (existing.status === "active") {
      validateWorktreeRecord(existing, git, filesystem, repo);
      if (existing.engine === "orca") {
        const current = await orca.showWorktree(existing.worktreeId!, existing.routingEnvironmentId);
        if (current.identity !== existing.worktreeIdentity || !samePath(current.path, existing.worktree!)) {
          throw new Error("Existing Orca worktree does not match task-native Episode ownership");
        }
      }
      const session = await durableSession(existing, publisher);
      if (!samePath(session.cwd, existing.worktree!)) {
        throw new Error("Task-native Episode session is not rooted at the owned worktree");
      }
      const route = await reopenIfNeeded(existing, session, ctx, publisher, store, repo);
      return { ...route.record, reused: true };
    }
    if (existing.status !== "provisioning") {
      throw new EpisodeStateUncertainError(`Existing task-native Episode ownership is ${existing.status}; inspect exact resources before continuing. No assignment was replayed.`);
    }
    record = existing;
    if (taskReservationHasResourceIdentity(record)) {
      throw new EpisodeStateUncertainError("Task-native provisioning already contains resource identity; inspect exact resources instead of replaying allocation");
    }

    const taskLabel = safeTaskLabel(record.taskId);
    const worktreeName = `${basename(repo)}-${taskLabel}-episode-${record.operationId.slice(0, 8)}`;
    const executePromptAtRoot = canonicalWorkflowPrompt(repo, "execute", {
      location: { tag: "operator-episode-task", value: record.taskId },
      ownerSessionId: record.ownerSessionId,
    });
    if (!executePromptAtRoot) throw new Error("Project is missing .agents/skills/execute/SKILL.md");

    if (record.engine === "local") {
      const branch = `episode/${taskLabel}-${record.operationId.slice(0, 8)}`;
      const worktree = resolve(dirname(repo), worktreeName);
      if (filesystem.exists(worktree) || git.worktrees(repo).some((entry) => samePath(entry.path, worktree))) {
        throw new EpisodeStateUncertainError(`Task-native Episode worktree path already exists: ${worktree}`);
      }
      record = updated(record, { worktreeName, worktree, branch, head: record.baseRef });
      store.write(repo, record);
      git.createWorktree(repo, branch, worktree, record.baseRef);
      git.assertCleanWorktree(worktree);
      if (git.head(worktree) !== record.baseRef) throw new EpisodeStateUncertainError("Local task-native Episode did not start at the reserved status commit");
      const executePrompt = canonicalWorkflowPrompt(worktree, "execute", {
        location: { tag: "operator-episode-task", value: record.taskId },
        ownerSessionId: record.ownerSessionId,
      });
      if (!executePrompt) throw new Error("Episode worktree is missing .agents/skills/execute/SKILL.md");
      const model = ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined;
      const published = await publisher.createFresh({
        worktree, sessionName: `${taskLabel}-episode`, model,
        onAllocated: (identity) => {
          record = updated(record!, { episodeId: identity.sessionId, episodeSessionFile: identity.sessionFile });
          store.write(repo, record);
        },
      });
      record = updated(record, {
        episodeId: published.sessionId,
        episodeSessionFile: published.sessionFile,
        episodeActiveSessionId: published.activeSessionId,
      });
      store.write(repo, record);
      await publisher.deliverExecute(published.activeSessionId, executePrompt);
      record = updated(record, { status: "active", uncertaintyReason: undefined });
      store.write(repo, record);
      return { ...record, reused: false };
    }

    const setup = await reservedTaskSetup(record, repo, orca);
    record = updated(record, { worktreeName });
    store.write(repo, record);
    const worktree = await orca.createWorktree({ setup, name: worktreeName, baseRef: record.baseRef });
    if (worktree.projectSetupId !== setup.id || worktree.head !== record.baseRef) {
      throw new EpisodeStateUncertainError("Orca worktree binding does not match the reserved setup and status commit");
    }
    record = updated(record, {
      worktreeId: worktree.id,
      worktreeIdentity: worktree.identity,
      worktree: worktree.path,
      branch: worktree.branch,
      head: worktree.head,
    });
    store.write(repo, record);
    git.assertCleanWorktree(worktree.path);
    const executePrompt = canonicalWorkflowPrompt(worktree.path, "execute", {
      location: { tag: "operator-episode-task", value: record.taskId },
      ownerSessionId: record.ownerSessionId,
    });
    if (!executePrompt) throw new Error("Episode worktree is missing .agents/skills/execute/SKILL.md");
    const before = new Set((await publisher.list()).map((session) => session.sessionId).filter((value): value is string => Boolean(value)));
    const launchAutomationName = `prime-claw-launch-${record.operationId}`;
    record = updated(record, { launchAutomationName });
    store.write(repo, record);
    const automationId = await orca.createLaunchAutomation({
      worktreeId: worktree.id,
      name: launchAutomationName,
      prompt: executePrompt,
      routingEnvironmentId: setup.routingEnvironmentId,
    });
    record = updated(record, { launchAutomationId: automationId });
    store.write(repo, record);
    const runId = await orca.runAutomation(automationId, setup.routingEnvironmentId);
    record = updated(record, { launchRunId: runId });
    store.write(repo, record);
    const binding = await waitForOrcaBinding({
      before,
      worktree,
      publisher,
      orca,
      routingEnvironmentId: setup.routingEnvironmentId,
      wait: dependencies?.wait ?? ((ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms))),
      attempts: dependencies?.bindingAttempts ?? 240,
    });
    if (!binding.published.activeSessionId) throw new EpisodeStateUncertainError("Fresh Episode session has no active routing identity");
    record = updated(record, {
      episodeId: binding.published.sessionId,
      episodeSessionFile: binding.published.sessionFile,
      episodeActiveSessionId: binding.published.activeSessionId,
      terminalHandle: binding.terminal.handle,
    });
    store.write(repo, record);
    await orca.removeAutomation(automationId, setup.routingEnvironmentId);
    const retainedTerminals = await orca.listTerminals(worktree.id, setup.routingEnvironmentId);
    const retained = retainedTerminals
      .find((terminal) => terminal.handle === binding.terminal.handle && terminal.connected && terminal.writable
        && terminal.agentIdentity === "prime-agent" && terminal.visible
        && samePath(terminal.worktreePath, worktree.path)
        && terminal.tabId === binding.terminal.tabId && terminal.leafId === binding.terminal.leafId);
    if (!retained) throw new EpisodeStateUncertainError("Prime Agent tab was not retained after launch automation removal");
    if (retainedTerminals.some((terminal) => !terminal.handle
      || terminal.worktreeId !== worktree.id
      || (terminal.worktreePath !== undefined && !samePath(terminal.worktreePath, worktree.path)))) {
      throw new EpisodeStateUncertainError("Orca terminal inventory is not bound to the exact task Episode worktree");
    }
    const terminalHandles = [...new Set(retainedTerminals.map((terminal) => terminal.handle))].sort();
    record = updated(record, {
      status: "active",
      terminalHandles,
      launchAutomationId: undefined,
      launchRunId: undefined,
      uncertaintyReason: undefined,
    });
    store.write(repo, record);
    return { ...record, reused: false };
  } catch (error) {
    if (record && repo) markUncertain(store, repo, record, error);
    throw error;
  } finally {
    try { publisher?.close(); } catch { /* do not mask lifecycle result */ }
  }
}

function taskAdmissionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 1000) || "unknown failure";
}

function exactAdmissionTask(
  selection: BacklogTaskSelection | null,
  taskId: string,
  projectRoot: string,
  taskPath: string,
): BacklogTaskSelection {
  if (!selection || selection.taskId !== taskId) throw new Error(`Backlog task ${taskId} could not be re-resolved exactly`);
  if (!samePath(selection.projectRoot, projectRoot) || selection.taskPathRelative !== taskPath) {
    throw new Error(`Backlog task ${taskId} changed project or path during Episode admission`);
  }
  return selection;
}

export type ConversationTaskStatusCommitResult =
  | { selection: BacklogTaskSelection; commit: string }
  | BeadsTaskMutationPublication;

export function commitConversationTaskStatus(options: {
  taskId: string;
  projectRoot: string;
  taskPath: string;
  status: "In Progress" | "In Planning" | "Blocked";
  message: string;
  note?: string;
  runner: CommandRunner;
  git: TaskEpisodeAdmissionGit;
  resolveTask: (cwd: string, taskId: string) => BacklogTaskSelection | null;
}): ConversationTaskStatusCommitResult {
  const provider = detectTaskProvider(options.projectRoot, options.runner);
  if (provider.kind === "selected" && provider.evidence.provider === "beads") {
    return mutateAndPublishBeadsTaskStatus({
      projectRoot: options.projectRoot,
      taskId: options.taskId,
      status: options.status,
      runner: options.runner,
    });
  }

  // Preserve the ordinary Backlog task-file path exactly: native status edit,
  // exact task re-read, one task-file-only Git commit, and cleanliness proof.
  mutateProviderTaskStatus({
    projectRoot: options.projectRoot,
    taskId: options.taskId,
    status: options.status,
    ...(options.note ? { note: options.note } : {}),
    runner: options.runner,
  });
  const selection = exactAdmissionTask(
    options.resolveTask(options.projectRoot, options.taskId),
    options.taskId,
    options.projectRoot,
    options.taskPath,
  );
  if (selection.status !== options.status) {
    throw new Error(`Backlog task ${options.taskId} did not reach ${options.status}`);
  }
  const commit = options.git.commitOnlyPath(options.projectRoot, options.taskPath, options.message);
  const paths = options.git.commitPaths(options.projectRoot, commit);
  if (paths.length !== 1 || paths[0] !== options.taskPath) {
    throw new Error(`Task-native Episode status commit contains paths other than ${options.taskPath}`);
  }
  if (options.git.pathStatus(options.projectRoot, options.taskPath) !== "") {
    throw new Error(`Backlog task ${options.taskId} changed after its ${options.status} commit`);
  }
  return { selection, commit };
}

function bestEffortTaskPush(git: TaskEpisodeAdmissionGit, projectRoot: string): string | undefined {
  try { git.push(projectRoot); return undefined; }
  catch (error) { return taskAdmissionError(error); }
}

function expectedArchivedTaskPath(taskPath: string): string {
  const activeDirectory = dirname(taskPath);
  if (basename(activeDirectory) !== "tasks") {
    throw new Error("Task abandonment must archive the canonical Backlog active-task path");
  }
  return join(dirname(activeDirectory), "archive", "tasks", basename(taskPath));
}

function taskCleanupStage(
  snapshot: TaskEpisodeCleanupSnapshot,
  record: TaskEpisodeOwnershipRecord,
  episodeHead: string,
): number {
  if (snapshot.runtime && (!samePath(snapshot.runtime.cwd, record.worktree!) || !snapshot.runtime.idle)) {
    throw new Error("Task Episode cleanup runtime is busy or no longer exact");
  }
  if (snapshot.worktree && (!samePath(snapshot.worktree.path, record.worktree!)
    || snapshot.worktree.branch !== record.branch
    || snapshot.worktree.head !== episodeHead
    || !snapshot.worktree.clean)) {
    throw new Error("Task Episode cleanup worktree is dirty or no longer exact");
  }
  if (snapshot.branch && (snapshot.branch.name !== record.branch || snapshot.branch.head !== episodeHead)) {
    throw new Error("Task Episode cleanup branch is no longer exact");
  }
  const present = [Boolean(snapshot.runtime), Boolean(snapshot.worktree), Boolean(snapshot.branch)];
  if (present.every(Boolean)) return 0;
  if (!present[0] && present[1] && present[2]) return 1;
  if (!present[0] && !present[1] && present[2]) return 2;
  if (present.every((value) => !value)) return 3;
  throw new Error("Task Episode cleanup resources are missing in an unsafe order");
}

function verifyTaskEpisodeTerminalState(
  projectRoot: string,
  record: TaskEpisodeOwnershipRecord,
  episodeHead: string,
  outcome: TaskEpisodeCleanupOutcome,
  git: TaskEpisodeCleanupGit,
  resolveTask: (cwd: string, taskId: string) => BacklogTaskSelection | null,
): void {
  const mainHead = git.head(projectRoot);
  if (git.upstreamHead(projectRoot) !== mainHead) {
    throw new Error("Task Episode cleanup requires pushed canonical main");
  }
  if (outcome === "merged") {
    const task = exactAdmissionTask(resolveTask(projectRoot, record.taskId), record.taskId, projectRoot, record.taskPath);
    if (task.status !== "Done") throw new Error(`Task Episode cleanup requires ${record.taskId} to be Done after merge`);
    if (!git.isAncestor(projectRoot, episodeHead, mainHead)) {
      throw new Error("Task Episode cleanup requires the exact Episode candidate in canonical main history");
    }
    return;
  }
  const archivePath = expectedArchivedTaskPath(record.taskPath);
  if (git.pathTrackedAtRef(projectRoot, mainHead, record.taskPath)
    || !git.pathTrackedAtRef(projectRoot, mainHead, archivePath)) {
    throw new Error("Task Episode cleanup requires the exact task to be archived after abandonment");
  }
  if (git.isAncestor(projectRoot, episodeHead, mainHead)) {
    throw new Error("Task Episode cleanup found abandoned Episode code in canonical main history");
  }
}

export async function finalizeTaskEpisodeCleanup(
  rawTaskId: string,
  rawEpisodeHead: string,
  outcome: TaskEpisodeCleanupOutcome,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeCleanupDependencies,
): Promise<TaskEpisodeCleanupResult> {
  const taskId = rawTaskId.trim();
  const episodeHead = rawEpisodeHead.trim();
  if (!taskId || /\s/.test(taskId) || taskId.startsWith("-")) {
    throw new Error("Task Episode cleanup requires one exact canonical Backlog task ID");
  }
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(episodeHead)) {
    throw new Error("Task Episode cleanup requires the exact pushed Episode head");
  }
  if (outcome !== "merged" && outcome !== "abandoned") {
    throw new Error("Task Episode cleanup requires the exact terminal outcome");
  }
  if ((ctx.sessionManager.getHeader().rlmDepth ?? 0) !== 0 || !ctx.sessionManager.getSessionFile()) {
    throw new Error("Task Episode cleanup is available only to the persisted top-level owning Conversation");
  }
  const git = dependencies.cleanupGit ?? new CliTaskEpisodeCleanupGit();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const runner = dependencies.taskRunner ?? new ProcessCommandRunner();
  const resolveTask = dependencies.taskResolver
    ?? defaultEpisodeTaskResolver(runner);
  const projectRoot = git.repositoryRoot(ctx.cwd);
  if (!samePath(projectRoot, ctx.cwd) || git.branch(projectRoot) !== "main") {
    throw new Error("Task Episode cleanup must run from the canonical primary main checkout");
  }
  let record = store.read(projectRoot, ctx.sessionManager.getSessionId());
  if (!record) throw new Error(`No durable task-native Episode ownership exists for ${taskId}`);
  exactOwnedTaskRecord(record, taskId, ctx.sessionManager.getSessionId());
  if (record.status !== "active" && record.status !== "inactive") {
    throw new Error(`Task Episode cleanup cannot finalize ${record.status} ownership`);
  }
  if (record.cleanupHead && record.cleanupHead !== episodeHead) {
    throw new Error("Task Episode cleanup head differs from the durable cleanup binding");
  }
  let snapshot = await dependencies.cleanup.inspect(record);
  let stage = taskCleanupStage(snapshot, record, episodeHead);
  if (stage !== 3) {
    if (!git.isAncestor(projectRoot, record.baseRef, episodeHead)) {
      throw new Error("Task Episode cleanup head is not descended from the owned Episode base");
    }
    if (git.branchUpstreamHead(projectRoot, record.branch!) !== episodeHead) {
      throw new Error("Task Episode cleanup requires the exact Episode head to be pushed");
    }
  }
  git.assertCleanWorktree(projectRoot);
  verifyTaskEpisodeTerminalState(projectRoot, record, episodeHead, outcome, git, resolveTask);
  if (!record.cleanupHead) {
    const bound: TaskEpisodeOwnershipRecord = {
      ...record,
      cleanupHead: episodeHead,
      updatedAt: dependencies.now?.() ?? new Date().toISOString(),
    };
    store.write(projectRoot, bound);
    const verifiedBinding = store.read(projectRoot, ctx.sessionManager.getSessionId());
    if (!verifiedBinding || !isTaskEpisodeOwnership(verifiedBinding)
      || JSON.stringify(verifiedBinding) !== JSON.stringify(bound)) {
      throw new Error("Task Episode cleanup could not persist the exact cleanup head");
    }
    record = bound;
  }

  if (record.status === "inactive") {
    if (stage !== 3) throw new Error("Inactive task Episode ownership still has retained resources");
    return { verified: true, outcome, taskId, episodeHead, resourcesRemoved: true, ownershipStatus: "inactive", reused: true };
  }

  const advance = async (remove: () => Promise<void>, expectedStages: number[]): Promise<void> => {
    await remove();
    snapshot = await dependencies.cleanup.inspect(record);
    stage = taskCleanupStage(snapshot, record, episodeHead);
    if (!expectedStages.includes(stage)) throw new Error("Task Episode cleanup removal was not verified exactly");
  };
  if (stage === 0) await advance(() => dependencies.cleanup.removeRuntime(record), [1]);
  if (stage === 1) await advance(() => dependencies.cleanup.removeWorktree(record), [2, 3]);
  if (stage === 2) await advance(() => dependencies.cleanup.removeBranch(record), [3]);
  if (stage !== 3) throw new Error("Task Episode cleanup did not remove every exact resource");

  const retained = store.read(projectRoot, ctx.sessionManager.getSessionId());
  if (!retained || JSON.stringify(retained) !== JSON.stringify(record)) {
    throw new Error("Task Episode ownership changed during authorized cleanup");
  }
  const closed: TaskEpisodeOwnershipRecord = {
    ...record,
    status: "inactive",
    updatedAt: dependencies.now?.() ?? new Date().toISOString(),
  };
  store.write(projectRoot, closed);
  const verified = store.read(projectRoot, ctx.sessionManager.getSessionId());
  if (!verified || !isTaskEpisodeOwnership(verified) || JSON.stringify(verified) !== JSON.stringify(closed)) {
    throw new Error("Task Episode cleanup could not verify inactive ownership bookkeeping");
  }
  return { verified: true, outcome, taskId, episodeHead, resourcesRemoved: true, ownershipStatus: "inactive", reused: false };
}

export async function createTaskEpisode(
  rawTaskId: string,
  _toolCallId: string,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeCreationDependencies = {},
  options: TaskEpisodeAdmissionOptions,
): Promise<TaskEpisodeCreationResult> {
  const runner = dependencies.admissionRunner ?? new ProcessCommandRunner();
  const git = dependencies.admissionGit ?? new CliTaskEpisodeAdmissionGit();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const resolveTask = dependencies.taskResolver
    ?? defaultEpisodeTaskResolver(runner);
  const reserve = dependencies.reserveTaskOwnership ?? reserveTaskEpisodeOwnership;
  const allocate = dependencies.allocateTaskEpisode ?? allocateReservedTaskEpisode;
  const taskId = rawTaskId.trim();
  let projectRoot = "";
  let taskPath = "";
  let preAdmissionHead = "";
  let statusMutationStarted = false;
  let admissionPushError: string | undefined;

  try {
    if (!taskId || /\s/.test(taskId) || taskId.startsWith("-")) {
      throw new Error("Task-native Episode creation requires a canonical Backlog task ID");
    }
    projectRoot = git.repositoryRoot(ctx.cwd);
    if (!samePath(projectRoot, realpathSync(ctx.cwd))) {
      throw new Error("Task-native Episode creation must run from the repository root");
    }
    const project = resolveNearestProjectRoot(ctx.cwd, process.env.HOME ?? "", runner);
    if (!samePath(project.root, projectRoot)
      || project.kind === "linked-worktree"
      || git.branch(projectRoot) !== "main") {
      throw new Error("Task-native Episode creation must run from the canonical primary main checkout");
    }
    if (!ctx.sessionManager.getSessionFile()) throw new Error("Episode creation requires a persisted owner session");
    if ((ctx.sessionManager.getHeader().rlmDepth ?? 0) !== 0) {
      throw new Error("Episode creation is available only from a top-level project Conversation");
    }
    if (options.engine === "orca" && !options.projectSetupId) {
      throw new Error("Task-native Orca admission requires an exact project setup");
    }
    if (options.engine === "local" && (options.projectSetupId || options.routingEnvironmentId)) {
      throw new Error("Task-native local admission cannot carry Orca placement identity");
    }

    const selected = resolveTask(projectRoot, taskId);
    if (!selected || selected.taskId !== taskId) {
      throw new Error("Task-native Episode creation requires the exact canonical Backlog task ID");
    }
    if (!samePath(selected.projectRoot, projectRoot)) throw new Error("Task-native Episode task resolved in a different project");
    taskPath = selected.taskPathRelative;
    if (selected.status !== "In Planning") throw new Error("Task-native Episode creation requires the exact task to be In Planning");
    if (!meaningfulTaskImplementationPlan(selected.implementationPlan)) {
      throw new Error("Task-native Episode creation requires a meaningful Implementation Plan");
    }
    if (git.pathStatus(projectRoot, taskPath) !== "") {
      throw new Error("Task-native Episode creation requires the exact task path to be clean before status mutation");
    }
    const existing = store.read(projectRoot, ctx.sessionManager.getSessionId());
    if (existing && existing.status !== "inactive") {
      const identity = isTaskEpisodeOwnership(existing) ? existing.taskId : existing.sourceLocation;
      throw new Error(`Non-terminal Episode ownership already exists for ${identity}; inspect it instead of creating another Episode`);
    }
    preAdmissionHead = git.head(projectRoot);

    const admission = withEpisodeAdmissionLock(projectRoot, () => {
      const lockedTask = exactAdmissionTask(resolveTask(projectRoot, taskId), taskId, projectRoot, taskPath);
      if (lockedTask.status !== "In Planning") {
        throw new Error("Task-native Episode creation requires the exact task to remain In Planning at the serialized admission boundary");
      }
      if (!meaningfulTaskImplementationPlan(lockedTask.implementationPlan)) {
        throw new Error("Task-native Episode creation requires a meaningful Implementation Plan at the serialized admission boundary");
      }
      if (git.pathStatus(projectRoot, taskPath) !== "") {
        throw new Error("Task-native Episode creation requires the exact task path to remain clean at the serialized admission boundary");
      }
      const lockedExisting = store.read(projectRoot, ctx.sessionManager.getSessionId());
      if (lockedExisting && lockedExisting.status !== "inactive") {
        const identity = isTaskEpisodeOwnership(lockedExisting) ? lockedExisting.taskId : lockedExisting.sourceLocation;
        throw new Error(`Non-terminal Episode ownership already exists for ${identity}; inspect it instead of creating another Episode`);
      }
      statusMutationStarted = true;
      const admitted = commitConversationTaskStatus({
        taskId,
        projectRoot,
        taskPath,
        status: "In Progress",
        message: `chore: admit ${taskId} episode`,
        runner,
        git,
        resolveTask,
      }) as { selection: BacklogTaskSelection; commit: string };
      const reservationInput: TaskEpisodeReservationInput = {
        projectRoot,
        taskId,
        ownerSessionId: ctx.sessionManager.getSessionId(),
        engine: options.engine,
        baseRef: admitted.commit,
        ...(options.projectSetupId ? { projectSetupId: options.projectSetupId } : {}),
        ...(options.routingEnvironmentId ? { routingEnvironmentId: options.routingEnvironmentId } : {}),
        ...(dependencies.reservationOperationId ? { operationId: dependencies.reservationOperationId } : {}),
      };
      const reservation = reserve(reservationInput, {
        git,
        ownership: store,
        taskResolver: resolveTask,
        now: dependencies.now,
      });
      if (reservation.baseRef !== admitted.commit) {
        throw new Error("Task-native Episode reservation did not bind the exact In Progress status commit");
      }
      return { admitted, reservation };
    });
    const { admitted, reservation } = admission;
    admissionPushError = bestEffortTaskPush(git, projectRoot);

    const result = await allocate(taskId, ctx, dependencies);
    const storedActive = store.read(projectRoot, ctx.sessionManager.getSessionId());
    if (!storedActive) throw new Error("Task-native Episode allocation returned without durable ownership");
    const active = parseEpisodeOwnership(storedActive, "task-native Episode admission result");
    exactOwnedTaskRecord(active, taskId, ctx.sessionManager.getSessionId());
    if (active.status !== "active" || active.baseRef !== admitted.commit || active.operationId !== reservation.operationId) {
      throw new Error("Task-native Episode allocation returned without the exact active reservation identity");
    }
    const finalTask = exactAdmissionTask(resolveTask(projectRoot, taskId), taskId, projectRoot, taskPath);
    if (finalTask.status !== "In Progress" || git.pathStatus(projectRoot, taskPath) !== "") {
      throw new Error("Task-native Episode allocation did not preserve the exact committed In Progress task state");
    }
    return { ...active, reused: result.reused, ...(admissionPushError ? { admissionPushError } : {}) };
  } catch (error) {
    if (!statusMutationStarted || !projectRoot || !taskPath) throw error;
    const cause = taskAdmissionError(error);
    let ownership: EpisodeOwnershipRecord | null = null;
    let ownershipUncertain = false;
    try { ownership = store.read(projectRoot, ctx.sessionManager.getSessionId()); }
    catch { ownershipUncertain = true; }
    const recordedMutation = ownershipUncertain || Boolean(ownership && ownership.status !== "inactive");

    if (recordedMutation) {
      const note = [
        `Episode admission blocked after durable or uncertain mutation at ${dependencies.now?.() ?? new Date().toISOString()}.`,
        `Recovery condition: inspect .prime-claw/ownership.json and reconcile every recorded task, worktree, and session identity to ${taskId} before continuing; do not retry it as fresh creation.`,
        `Cause: ${cause}`,
      ].join("\n");
      try {
        withEpisodeAdmissionLock(projectRoot, () => {
          const lockedTask = exactAdmissionTask(resolveTask(projectRoot, taskId), taskId, projectRoot, taskPath);
          if (lockedTask.status !== "In Progress") {
            throw new Error(`Backlog task ${taskId} is not the In Progress admission being recovered`);
          }
          commitConversationTaskStatus({
            taskId,
            projectRoot,
            taskPath,
            status: "Blocked",
            message: `chore: block ${taskId} episode admission`,
            note,
            runner,
            git,
            resolveTask,
          });
        });
      } catch (recoveryError) {
        throw new Error(`Task-native Episode creation failed after durable or uncertain mutation, and Blocked publication failed. Preserve all evidence and recover ${taskId} manually. Cause: ${cause}. Publication failure: ${taskAdmissionError(recoveryError)}`);
      }
      const recoveryPushError = bestEffortTaskPush(git, projectRoot);
      throw new Error(`Task-native Episode creation failed after durable or uncertain mutation; ${taskId} is Blocked and requires exact recovery before retry. Cause: ${cause}${recoveryPushError ? ` Push also failed: ${recoveryPushError}` : ""}`);
    }

    let rollbackCommitted = false;
    try {
      rollbackCommitted = withEpisodeAdmissionLock(projectRoot, () => {
        const lockedTask = exactAdmissionTask(resolveTask(projectRoot, taskId), taskId, projectRoot, taskPath);
        const unchanged = lockedTask.status === "In Planning"
          && git.head(projectRoot) === preAdmissionHead
          && git.pathStatus(projectRoot, taskPath) === "";
        if (unchanged) return false;
        if (lockedTask.status !== "In Progress") {
          throw new Error(`Backlog task ${taskId} is not the In Progress admission being rolled back`);
        }
        commitConversationTaskStatus({
          taskId,
          projectRoot,
          taskPath,
          status: "In Planning",
          message: `chore: roll back ${taskId} episode admission`,
          runner,
          git,
          resolveTask,
        });
        return true;
      });
    } catch (recoveryError) {
      throw new Error(`Task-native Episode creation failed before ownership or resource mutation, and clean rollback failed. Preserve the checkout and recover ${taskId} manually. Cause: ${cause}. Rollback failure: ${taskAdmissionError(recoveryError)}`);
    }
    if (!rollbackCommitted) throw error;
    const recoveryPushError = bestEffortTaskPush(git, projectRoot);
    throw new Error(`Task-native Episode creation failed before ownership or resource mutation; ${taskId} was returned to In Planning. Cause: ${cause}${recoveryPushError ? ` Push also failed: ${recoveryPushError}` : ""}`);
  }
}

export async function createSpecEpisode(
  rawLocation: string,
  _toolCallId: string,
  ctx: ExtensionContext,
  dependencies?: EpisodeDependencies,
  options: EpisodeCreationOptions = {},
): Promise<EpisodeResult> {
  const git = dependencies?.git ?? new CliGitAdapter();
  const filesystem = dependencies?.filesystem ?? new NodeFilesystemAdapter();
  const store = dependencies?.ownership ?? defaultOwnershipStore;
  const orca = dependencies?.orca ?? new CliOrcaAdapter();
  let publisher = dependencies?.publisher;
  let record: LegacyEpisodeOwnershipRecord | undefined;
  let repo = "";
  try {
    const selected = validateFutureLocation(ctx.cwd, rawLocation);
    if (!selected) throw new Error("Invalid future-plan folder");
    repo = git.repositoryRoot(selected.projectRoot);
    if (resolve(repo) !== resolve(selected.projectRoot)) throw new Error("The command must run from the repository root");
    if (!ctx.sessionManager.getSessionFile()) throw new Error("Episode creation requires a persisted owner session");
    if ((ctx.sessionManager.getHeader().rlmDepth ?? 0) !== 0) throw new Error("Episode creation is available only from a top-level project Conversation");
    const ownerSessionId = ctx.sessionManager.getSessionId();
    publisher ??= new PrimeSessionPublisher(undefined, runtimeSessionManagerClass(ctx.sessionManager));
    const existing = store.read(repo, ownerSessionId);
    if (existing && existing.status !== "inactive") {
      exactOwnedRecord(existing, selected.location, ownerSessionId);
      if (existing.status !== "active") throw new EpisodeStateUncertainError(`Existing Episode ownership is ${existing.status}; inspect exact resources before continuing. No assignment was replayed.`);
      validateWorktreeRecord(existing, git, filesystem, repo);
      if (existing.engine === "orca") {
        const current = await orca.showWorktree(existing.worktreeId!, existing.routingEnvironmentId);
        if (current.identity !== existing.worktreeIdentity || !samePath(current.path, existing.worktree!)) throw new Error("Existing Orca worktree does not match Episode ownership");
      }
      const session = await durableSession(existing, publisher);
      const route = await reopenIfNeeded(existing, session, ctx, publisher, store, repo);
      return { ...route.record, reused: true };
    }
    const approvedBundleDigest = options.approvedBundleDigest;
    if (!approvedBundleDigest || !/^[0-9a-f]{64}$/.test(approvedBundleDigest)) throw new Error("Episode creation is missing the exact approved-bundle digest");
    if (bundleContentDigest(selected.folder) !== approvedBundleDigest) throw new Error("Approved bundle changed after /implement-spec admission; rerun readiness review");
    const baseRef = git.head(repo);
    const operationId = randomUUID();
    const worktreeName = `${basename(repo)}-${selected.slug}-episode-${operationId.slice(0, 8)}`;
    const executePromptAtRoot = canonicalWorkflowPrompt(repo, "execute", { location: { tag: "operator-episode-source", value: selected.location }, ownerSessionId });
    if (!executePromptAtRoot) throw new Error("Project is missing .agents/skills/execute/SKILL.md");

    let setups: OrcaProjectSetup[];
    try { setups = await orca.listReadySetups(repo); }
    catch (error) {
      if (!(error instanceof OrcaUnavailableError)) throw error;
      if (options.host) throw new Error(`Explicit Episode host ${options.host} could not be resolved because Orca inventory is unavailable`);
      const branch = `episode/${selected.slug}-${operationId.slice(0, 8)}`;
      const worktree = resolve(dirname(repo), worktreeName);
      if (filesystem.exists(worktree) || git.worktrees(repo).some((entry) => samePath(entry.path, worktree))) throw new Error(`Episode worktree path already exists: ${worktree}`);
      record = updated(
        newRecord({ selected, ownerSessionId, operationId, engine: "local", baseRef, bundleDigest: approvedBundleDigest, worktreeName }),
        { worktree, branch, head: baseRef },
      );
      store.write(repo, record);
      git.createWorktree(repo, branch, worktree, baseRef);
      git.assertCleanWorktree(worktree);
      filesystem.promoteBundle(worktree, selected.slug, selected.folder, approvedBundleDigest);
      if (!filesystem.hasActiveLegacyPlanFiles(worktree)) throw new Error("Promoted legacy Episode is missing its active specification and implementation plan");
      const head = git.commitPromotion(worktree, selected.slug);
      if (bundleContentDigest(selected.folder) !== approvedBundleDigest) {
        throw new EpisodeStateUncertainError("Approved bundle changed after local Episode promotion");
      }
      const executePrompt = canonicalWorkflowPrompt(worktree, "execute", { location: { tag: "operator-episode-source", value: selected.location }, ownerSessionId });
      if (!executePrompt) throw new Error("Episode worktree is missing .agents/skills/execute/SKILL.md");
      const model = ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined;
      const published = await publisher.createFresh({
        worktree, sessionName: `${selected.slug}-episode`, model,
        onAllocated: (identity) => {
          record = updated(record!, { head, episodeId: identity.sessionId, episodeSessionFile: identity.sessionFile });
          store.write(repo, record);
        },
      });
      record = updated(record, { head, episodeId: published.sessionId, episodeSessionFile: published.sessionFile, episodeActiveSessionId: published.activeSessionId });
      store.write(repo, record);
      await publisher.deliverExecute(published.activeSessionId, executePrompt);
      record = updated(record, { status: "active", uncertaintyReason: undefined }); store.write(repo, record);
      return { ...record, reused: false };
    }

    const setup = await selectSetup(setups, options.host, ctx);
    record = newRecord({ selected, ownerSessionId, operationId, engine: "orca", baseRef, bundleDigest: approvedBundleDigest, setup, worktreeName });
    store.write(repo, record);
    const worktree = await orca.createWorktree({ setup, name: worktreeName, baseRef });
    if (worktree.projectSetupId !== setup.id || worktree.head !== baseRef) throw new EpisodeStateUncertainError("Orca worktree binding does not match the selected setup and base ref");
    record = updated(record, {
      worktreeId: worktree.id, worktreeIdentity: worktree.identity, worktree: worktree.path,
      branch: worktree.branch, head: worktree.head,
    });
    store.write(repo, record);
    git.assertCleanWorktree(worktree.path);
    filesystem.promoteBundle(worktree.path, selected.slug, selected.folder, approvedBundleDigest);
    if (!filesystem.hasActiveLegacyPlanFiles(worktree.path)) throw new Error("Promoted legacy Episode is missing its active specification and implementation plan");
    const promotedHead = git.commitPromotion(worktree.path, selected.slug);
    if (bundleContentDigest(selected.folder) !== approvedBundleDigest) {
      throw new EpisodeStateUncertainError("Approved bundle changed after Orca Episode promotion");
    }
    record = updated(record, { head: promotedHead }); store.write(repo, record);
    const executePrompt = canonicalWorkflowPrompt(worktree.path, "execute", { location: { tag: "operator-episode-source", value: selected.location }, ownerSessionId });
    if (!executePrompt) throw new Error("Episode worktree is missing .agents/skills/execute/SKILL.md");
    const before = new Set((await publisher.list()).map((session) => session.sessionId).filter((value): value is string => Boolean(value)));
    const launchAutomationName = `prime-claw-launch-${operationId}`;
    record = updated(record, { launchAutomationName }); store.write(repo, record);
    const automationId = await orca.createLaunchAutomation({
      worktreeId: worktree.id, name: launchAutomationName, prompt: executePrompt,
      routingEnvironmentId: setup.routingEnvironmentId,
    });
    record = updated(record, { launchAutomationId: automationId }); store.write(repo, record);
    const runId = await orca.runAutomation(automationId, setup.routingEnvironmentId);
    record = updated(record, { launchRunId: runId }); store.write(repo, record);
    const binding = await waitForOrcaBinding({
      before, worktree, publisher, orca, routingEnvironmentId: setup.routingEnvironmentId,
      wait: dependencies?.wait ?? ((ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms))),
      attempts: dependencies?.bindingAttempts ?? 240,
    });
    if (!binding.published.activeSessionId) throw new EpisodeStateUncertainError("Fresh Episode session has no active routing identity");
    record = updated(record, {
      episodeId: binding.published.sessionId, episodeSessionFile: binding.published.sessionFile,
      episodeActiveSessionId: binding.published.activeSessionId, terminalHandle: binding.terminal.handle,
    });
    store.write(repo, record);
    await orca.removeAutomation(automationId, setup.routingEnvironmentId);
    const retained = (await orca.listTerminals(worktree.id, setup.routingEnvironmentId))
      .find((terminal) => terminal.handle === binding.terminal.handle && terminal.connected && terminal.writable
        && terminal.agentIdentity === "prime-agent" && terminal.visible
        && samePath(terminal.worktreePath, worktree.path)
        && terminal.tabId === binding.terminal.tabId && terminal.leafId === binding.terminal.leafId);
    if (!retained) throw new EpisodeStateUncertainError("Prime Agent tab was not retained after launch automation removal");
    record = updated(record, {
      status: "active", launchAutomationId: undefined, launchRunId: undefined, uncertaintyReason: undefined,
    });
    store.write(repo, record);
    return { ...record, reused: false };
  } catch (error) {
    if (record && repo) markUncertain(store, repo, record, error);
    throw error;
  } finally { try { publisher?.close(); } catch { /* do not mask lifecycle result */ } }
}
