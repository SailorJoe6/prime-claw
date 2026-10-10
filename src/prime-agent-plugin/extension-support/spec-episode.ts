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

import { canonicalSkillPrompt } from "./handoff-prompts.ts";
import {
  episodeOwnershipPath,
  parseEpisodeOwnership,
  readEpisodeOwnership,
  writeEpisodeOwnership,
  type EpisodeOwnershipRecord,
} from "./episode-ownership.ts";
import { validateFutureLocation, wrapCanonicalSkill } from "./reviewed-plan-support.ts";

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

export type EpisodeIdentity = EpisodeOwnershipRecord;
export type EpisodeResult = EpisodeOwnershipRecord & { reused: boolean };

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
  commitPromotion(worktree: string, slug: string): string;
  removeCreatedWorktree(repo: string, branch: string, worktree: string): void;
}
export interface FilesystemAdapter {
  exists(path: string): boolean;
  promoteBundle(worktree: string, slug: string, canonicalFolder: string, expectedDigest: string): void;
}
export interface EpisodeOwnershipStore {
  read(projectRoot: string): EpisodeOwnershipRecord | null;
  write(projectRoot: string, record: EpisodeOwnershipRecord): void;
}
export interface SessionPublisher {
  list(): Promise<SessionSummary[]>;
  getState(activeSessionId: string): Promise<EpisodeSessionState>;
  createFresh(options: { worktree: string; sessionName: string; model?: { provider: string; id: string }; onAllocated?: (identity: { sessionId: string; sessionFile: string }) => void | Promise<void> }): Promise<PublishedSession>;
  reopen(options: { sessionFile: string; sessionId: string; worktree: string; sessionName: string; model?: { provider: string; id: string } }): Promise<PublishedSession>;
  deliverExecute(activeSessionId: string, prompt: string): Promise<void>;
  deliverHandoff(activeSessionId: string, handoffPrompt: string, executePrompt: string, onHandoffAdmitted?: () => void | Promise<void>, queueHandoffIfBusy?: boolean): Promise<void>;
  kill(activeSessionId: string): Promise<boolean>;
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
export interface EpisodeCreationOptions { host?: string; approvedBundleDigest?: string }

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
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
  commitPromotion(worktree: string, slug: string): string {
    this.runner(worktree, ["add", "-A"]);
    this.runner(worktree, ["commit", "--allow-empty", "-m", `chore: promote ${slug} specification`]);
    return this.head(worktree);
  }
  removeCreatedWorktree(repo: string, branch: string, worktree: string): void {
    this.runner(repo, ["worktree", "remove", "--force", worktree]);
    this.runner(repo, ["branch", "-D", branch]);
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
  }
}
const defaultOwnershipStore: EpisodeOwnershipStore = { read: readEpisodeOwnership, write: writeEpisodeOwnership };

export function parseEpisodeIdentity(value: unknown, path = "episode ownership"): EpisodeIdentity { return parseEpisodeOwnership(value, path); }
export function episodeIdentityPath(projectRoot: string, _slug?: string): string { return episodeOwnershipPath(projectRoot); }
export function episodeBootstrapReady(identity: EpisodeIdentity): boolean { return identity.status === "active"; }

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
      const acknowledge = ["create", "prompt", "kill"].includes(commandType);
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
  create(cwd: string): { getSessionFile(): string | undefined; getSessionId(): string };
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
  async createFresh(options: { worktree: string; sessionName: string; model?: { provider: string; id: string }; onAllocated?: (identity: { sessionId: string; sessionFile: string }) => void | Promise<void> }): Promise<PublishedSession> {
    if (!this.SessionManager) throw new Error("Episode publication is missing the runtime SessionManager");
    const manager = this.SessionManager.create(options.worktree);
    const sessionFile = manager.getSessionFile();
    if (!sessionFile) throw new Error("Prime Agent created an in-memory Episode session");
    const sessionId = manager.getSessionId();
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
    try {
      requireSuccess(await this.client.request({
        type: "prompt", activeSessionId, message: handoffPrompt,
        ...(queueHandoffIfBusy ? { streamingBehavior: "followUp", queueIfBusy: true } : { queueIfBusy: false }),
        expandPromptTemplates: false, source: "extension",
      }), "handoff delivery");
    } catch (error) {
      if (isUncertainMutation(error)) throw new EpisodeStateUncertainError("Handoff admission is uncertain; inspect before another transition.", { cause: error });
      throw error;
    }
    await onHandoffAdmitted?.();
    try {
      requireSuccess(await this.client.request({ type: "prompt", activeSessionId, message: executePrompt, streamingBehavior: "followUp", queueIfBusy: true, expandPromptTemplates: false, source: "extension" }), "execute follow-up delivery");
    } catch (error) {
      if (isUncertainMutation(error)) throw new EpisodeStateUncertainError("Execute follow-up admission is uncertain after handoff; inspect before another transition.", { cause: error });
      throw new HandoffFollowUpRejectedError(`Handoff was admitted, but canonical execute follow-up could not be queued: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
  async kill(activeSessionId: string): Promise<boolean> {
    requireSuccess(await this.client.request({ type: "kill", activeSessionId }), "episode cleanup kill"); return true;
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
  async listReadySetups(projectRoot: string): Promise<OrcaProjectSetup[]> {
    let localResult: JsonObject;
    try { localResult = this.json(["project", "setups"], "Orca project setup inventory"); }
    catch (error) { throw new OrcaUnavailableError("Orca CLI/runtime is unavailable before Episode mutation", { cause: error }); }
    const localRows = Array.isArray(localResult.setups) ? localResult.setups.map((value) => object(value, "Orca setup")) : [];
    const localProjects = localRows.filter((row) => typeof row.path === "string" && samePath(row.path, projectRoot));
    if (localProjects.length === 0) return [];
    const projectIds = new Set(localProjects.map((row) => stringField(row, "projectId", "Orca setup")));
    if (projectIds.size !== 1) throw new Error("Orca has conflicting project identities for the exact local path");
    const projectId = [...projectIds][0];
    const setups: OrcaProjectSetup[] = localProjects.filter((row) => row.setupState === "ready").map((row) => this.setup(row, "local", "local"));
    let environments: JsonObject;
    try { environments = this.json(["environment", "list"], "Orca environment inventory"); }
    catch (error) { throw new Error(`Orca host inventory is incomplete: ${error instanceof Error ? error.message : String(error)}`); }
    for (const value of Array.isArray(environments.environments) ? environments.environments : []) {
      const environment = object(value, "Orca environment");
      const id = stringField(environment, "id", "Orca environment");
      const label = typeof environment.name === "string" && environment.name ? environment.name : `runtime:${id}`;
      let remote: JsonObject;
      try { remote = this.json(["project", "setups", "--project", projectId, "--host", `runtime:${id}`], "remote Orca project setup inventory"); }
      catch (error) { throw new Error(`Orca host inventory is incomplete for runtime:${id}: ${error instanceof Error ? error.message : String(error)}`); }
      for (const rowValue of Array.isArray(remote.setups) ? remote.setups : []) {
        const row = object(rowValue, "remote Orca setup");
        if (row.setupState === "ready" && row.projectId === projectId) setups.push(this.setup(row, label, `runtime:${id}`, id));
      }
    }
    return setups;
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
function sessionIsBusy(session: SessionSummary): boolean {
  return session.isSessionActive === true || session.isStreaming === true || session.isCompacting === true || (session.queuedCount ?? 0) > 0;
}
function assertIdleEpisodeState(state: EpisodeSessionState, identity: EpisodeIdentity, activeSessionId: string): void {
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
function exactOwnedRecord(record: EpisodeOwnershipRecord, location: string, ownerSessionId: string): void {
  if (record.sourceLocation !== location) throw new Error("Existing episode ownership conflicts on sourceLocation");
  if (record.ownerSessionId !== ownerSessionId) throw new Error("Existing episode ownership conflicts on ownerSessionId");
}
function validateWorktreeRecord(record: EpisodeOwnershipRecord, git: GitAdapter, filesystem: FilesystemAdapter, repo: string): void {
  if (!record.worktree || !record.branch || !filesystem.exists(record.worktree)) throw new Error("Episode ownership references a missing worktree");
  const worktree = git.worktrees(repo).find((entry) => samePath(entry.path, record.worktree));
  if (!worktree || worktree.branch !== record.branch) throw new Error("Episode ownership references a missing or different worktree");
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
function newRecord(options: {
  selected: { slug: string; location: string };
  ownerSessionId: string;
  operationId: string;
  engine: "orca" | "local";
  baseRef: string;
  bundleDigest: string;
  setup?: OrcaProjectSetup;
  worktreeName: string;
}): EpisodeOwnershipRecord {
  const now = new Date().toISOString();
  return {
    version: 1, status: "provisioning", operationId: options.operationId, engine: options.engine,
    ownerSessionId: options.ownerSessionId, sourceLocation: options.selected.location, slug: options.selected.slug,
    baseRef: options.baseRef, bundleDigest: options.bundleDigest, createdAt: now, updatedAt: now, worktreeName: options.worktreeName,
    ...(options.setup ? { projectSetupId: options.setup.id, ...(options.setup.routingEnvironmentId ? { routingEnvironmentId: options.setup.routingEnvironmentId } : {}) } : {}),
  };
}
function updated(record: EpisodeOwnershipRecord, patch: Partial<EpisodeOwnershipRecord>): EpisodeOwnershipRecord {
  return { ...record, ...patch, updatedAt: new Date().toISOString() };
}
function markUncertain(store: EpisodeOwnershipStore, repo: string, record: EpisodeOwnershipRecord, error: unknown): EpisodeOwnershipRecord {
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
async function reopenIfNeeded(
  record: EpisodeOwnershipRecord,
  session: SessionSummary,
  ctx: ExtensionContext,
  publisher: SessionPublisher,
  store: EpisodeOwnershipStore,
  repo: string,
): Promise<{ record: EpisodeOwnershipRecord; activeSessionId: string }> {
  let activeSessionId = session.activeSessionId;
  let current = record;
  if (!activeSessionId) {
    const model = ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined;
    const reopened = await publisher.reopen({ sessionFile: record.episodeSessionFile!, sessionId: record.episodeId!, worktree: record.worktree!, sessionName: `${record.slug}-episode`, model });
    activeSessionId = reopened.activeSessionId;
    current = updated(record, { episodeActiveSessionId: activeSessionId });
    store.write(repo, current);
  }
  if (!activeSessionId) throw new EpisodeStateUncertainError("Episode has no usable active routing identity");
  return { record: current, activeSessionId };
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
    const selected = validateFutureLocation(ctx.cwd, rawLocation);
    if (!selected) throw new Error("Invalid future-plan folder");
    const repo = git.repositoryRoot(selected.projectRoot);
    if (resolve(repo) !== resolve(selected.projectRoot)) throw new Error("The operation must run from the repository root");
    if ((ctx.sessionManager.getHeader().rlmDepth ?? 0) !== 0) throw new Error("Episode handoff is available only from a top-level project Conversation");
    const record = store.read(repo);
    if (!record) throw new Error(`No durable episode ownership exists for ${selected.location}`);
    exactOwnedRecord(record, selected.location, ctx.sessionManager.getSessionId());
    if (record.status !== "active") throw new Error(`Episode ownership is ${record.status}; inspect it before handoff`);
    validateWorktreeRecord(record, git, filesystem, repo);
    if (record.engine === "orca") {
      const worktree = await orca.showWorktree(record.worktreeId!, record.routingEnvironmentId);
      if (worktree.identity !== record.worktreeIdentity || !samePath(worktree.path, record.worktree!)) throw new Error("Orca worktree identity no longer matches Episode ownership");
    }
    publisher ??= new PrimeSessionPublisher();
    const session = await durableSession(record, publisher);
    if (sessionIsBusy(session)) throw new Error("Owned Episode is busy; handoff requires an idle Episode with an empty queue");
    const handoffPrompt = canonicalSkillPrompt(record.worktree!, "handoff", guidance.trim());
    if (!handoffPrompt) throw new Error("Episode worktree is missing .prime-claw/workflows/handoff.md");
    const executePrompt = canonicalSkillPrompt(record.worktree!, "execute");
    if (!executePrompt) throw new Error("Episode worktree is missing .agents/skills/execute/SKILL.md");
    const route = await reopenIfNeeded(record, session, ctx, publisher, store, repo);
    const state = await publisher.getState(route.activeSessionId);
    assertIdleEpisodeState(state, route.record, route.activeSessionId);
    await publisher.deliverHandoff(route.activeSessionId, handoffPrompt, executePrompt);
    return { admitted: true, sourceLocation: selected.location, episodeId: record.episodeId!, episodeActiveSessionId: route.activeSessionId, handoffDelivery: "prompt", executeDelivery: "followUp" };
  } finally { try { publisher?.close(); } catch { /* do not mask lifecycle result */ } }
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
  let record: EpisodeOwnershipRecord | undefined;
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
    const existing = store.read(repo);
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
    const executePromptAtRoot = wrapCanonicalSkill(repo, "execute", "operator-episode-source", selected.location);
    if (!executePromptAtRoot) throw new Error("Project is missing .agents/skills/execute/SKILL.md");

    let setups: OrcaProjectSetup[];
    try { setups = await orca.listReadySetups(repo); }
    catch (error) {
      if (!(error instanceof OrcaUnavailableError)) throw error;
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
      const head = git.commitPromotion(worktree, selected.slug);
      if (git.head(repo) !== baseRef) throw new EpisodeStateUncertainError("Canonical checkout changed during local Episode promotion");
      const executePrompt = wrapCanonicalSkill(worktree, "execute", "operator-episode-source", selected.location);
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
    const promotedHead = git.commitPromotion(worktree.path, selected.slug);
    if (git.head(repo) !== baseRef) throw new EpisodeStateUncertainError("Canonical checkout changed during Orca Episode promotion");
    record = updated(record, { head: promotedHead }); store.write(repo, record);
    const executePrompt = wrapCanonicalSkill(worktree.path, "execute", "operator-episode-source", selected.location);
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
