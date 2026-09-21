import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createConnection, type Socket } from "node:net";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

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
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EpisodeStateUncertainError";
  }
}

function isUncertainMutation(error: unknown): boolean {
  return error instanceof DaemonMutationUncertainError || error instanceof EpisodeStateUncertainError;
}

export interface EpisodeIdentity {
  version: 1;
  slug: string;
  sourceLocation: string;
  ownerSessionId: string;
  episodeId: string;
  episodeActiveSessionId: string;
  episodeSessionFile: string;
  branch: string;
  worktree: string;
  sessionName: string;
  executeDelivered: true;
}

export interface EpisodeResult extends EpisodeIdentity {
  reused: boolean;
}

export interface SessionSummary {
  activeSessionId?: string;
  id?: string;
  sessionId?: string;
  sessionFile?: string;
  sessionName?: string;
  cwd?: string;
}

export interface PublishedSession {
  activeSessionId: string;
  sessionId: string;
  sessionFile: string;
}

export function episodeResultText(result: Pick<EpisodeResult, "episodeId" | "branch" | "worktree" | "sessionName" | "reused"> & {
  episodeActiveSessionId?: string;
}): string {
  return `Episode ${result.reused ? "reused" : "created"}: ${JSON.stringify({
    episodeId: result.episodeId,
    ...(result.episodeActiveSessionId ? { episodeActiveSessionId: result.episodeActiveSessionId } : {}),
    branch: result.branch,
    worktree: result.worktree,
    sessionName: result.sessionName,
    reused: result.reused,
  })}`;
}

export interface GitAdapter {
  repositoryRoot(cwd: string): string;
  hasBranch(repo: string, branch: string): boolean;
  worktrees(repo: string): Array<{ path: string; branch?: string }>;
  createWorktree(repo: string, branch: string, worktree: string): void;
  commitPromotion(worktree: string, slug: string): void;
  removeCreatedWorktree(repo: string, branch: string, worktree: string): void;
}

export interface FilesystemAdapter {
  exists(path: string): boolean;
  promoteBundle(worktree: string, slug: string, canonicalFolder: string): void;
  readIdentity(path: string): EpisodeIdentity | null;
  writeIdentity(path: string, identity: EpisodeIdentity): void;
  removeFile(path: string): void;
}

export interface SessionPublisher {
  list(): Promise<SessionSummary[]>;
  forkAndPublish(options: {
    sourceSessionFile: string;
    worktree: string;
    sessionName: string;
    branch: string;
    toolCallId: string;
    model?: { provider: string; id: string };
  }): Promise<PublishedSession>;
  reopen(options: {
    sessionFile: string;
    sessionId: string;
    worktree: string;
    sessionName: string;
    model?: { provider: string; id: string };
  }): Promise<PublishedSession>;
  deliverExecute(activeSessionId: string, prompt: string): Promise<void>;
  kill(activeSessionId: string): Promise<boolean>;
  close(): void;
}

export interface EpisodeDependencies {
  git: GitAdapter;
  filesystem: FilesystemAdapter;
  publisher: SessionPublisher;
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export class CliGitAdapter implements GitAdapter {
  repositoryRoot(cwd: string): string {
    return realpathSync(runGit(cwd, ["rev-parse", "--show-toplevel"]));
  }

  hasBranch(repo: string, branch: string): boolean {
    try {
      runGit(repo, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
      return true;
    } catch {
      return false;
    }
  }

  worktrees(repo: string): Array<{ path: string; branch?: string }> {
    const output = runGit(repo, ["worktree", "list", "--porcelain"]);
    if (!output) return [];
    return output.split("\n\n").map((block) => {
      const lines = block.split("\n");
      const path = lines.find((line) => line.startsWith("worktree "))?.slice(9) ?? "";
      const branchRef = lines.find((line) => line.startsWith("branch "))?.slice(7);
      return { path: resolve(path), branch: branchRef?.replace(/^refs\/heads\//, "") };
    }).filter((entry) => entry.path !== "");
  }

  createWorktree(repo: string, branch: string, worktree: string): void {
    runGit(repo, ["worktree", "add", "-b", branch, worktree, "HEAD"]);
  }

  commitPromotion(worktree: string, slug: string): void {
    runGit(worktree, ["add", "-A"]);
    runGit(worktree, ["commit", "-m", `chore: promote ${slug} specification`]);
  }

  removeCreatedWorktree(repo: string, branch: string, worktree: string): void {
    try { runGit(repo, ["worktree", "remove", "--force", worktree]); } catch { /* best effort */ }
    try { runGit(repo, ["branch", "-D", branch]); } catch { /* best effort */ }
  }
}

export class NodeFilesystemAdapter implements FilesystemAdapter {
  exists(path: string): boolean {
    return existsSync(path);
  }

  promoteBundle(worktree: string, slug: string, canonicalFolder: string): void {
    const plans = join(worktree, ".ralph", "plans");
    const source = join(plans, "future", slug);
    if (!existsSync(canonicalFolder) || !statSync(canonicalFolder).isDirectory()) {
      throw new Error(`Approved canonical future folder is missing: ${canonicalFolder}`);
    }
    rmSync(source, { recursive: true, force: true });
    mkdirSync(dirname(source), { recursive: true });
    cpSync(canonicalFolder, source, { recursive: true, errorOnExist: true, force: false });

    const bundleEntries = readdirSync(source, { withFileTypes: true });
    const reserved = bundleEntries.find((entry) => RESERVED_PLAN_DIRECTORIES.has(entry.name));
    if (reserved) {
      throw new Error(`Approved bundle conflicts with reserved plan lifecycle directory: ${reserved.name}`);
    }

    for (const entry of readdirSync(plans, { withFileTypes: true })) {
      if (RESERVED_PLAN_DIRECTORIES.has(entry.name)) continue;
      rmSync(join(plans, entry.name), { recursive: true, force: true });
    }
    for (const entry of bundleEntries) {
      cpSync(join(source, entry.name), join(plans, entry.name), {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
    }
    rmSync(source, { recursive: true, force: false });
  }

  readIdentity(path: string): EpisodeIdentity | null {
    if (!existsSync(path)) return null;
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      throw new Error(`Episode identity is unreadable: ${path}: ${String(error)}`);
    }
    if (!isEpisodeIdentity(value)) {
      throw new Error(`Episode identity has an unsupported shape: ${path}`);
    }
    return value;
  }

  writeIdentity(path: string, identity: EpisodeIdentity): void {
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(identity, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporary, path);
  }

  removeFile(path: string): void {
    rmSync(path, { force: true });
  }
}

function isEpisodeIdentity(value: unknown): value is EpisodeIdentity {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.version === 1
    && item.executeDelivered === true
    && [
      "slug", "sourceLocation", "ownerSessionId", "episodeId",
      "episodeActiveSessionId", "episodeSessionFile", "branch", "worktree", "sessionName",
    ].every((key) => typeof item[key] === "string" && item[key] !== "");
}

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
  forkFrom(sourceSessionFile: string, targetCwd: string): {
    getSessionFile(): string | undefined;
    getSessionId(): string;
    appendMessage(message: Record<string, unknown>): string;
  };
}

export function forkPrimeSession(
  SessionManager: PrimeSessionManagerClass,
  options: {
    sourceSessionFile: string;
    worktree: string;
    sessionName: string;
    branch: string;
    toolCallId: string;
  },
): { sessionFile: string; sessionId: string } {
  const fork = SessionManager.forkFrom(options.sourceSessionFile, options.worktree);
  const sessionFile = fork.getSessionFile();
  if (!sessionFile) throw new Error("Prime Agent created an in-memory episode fork");
  const sessionId = fork.getSessionId();
  const inheritedResult = episodeResultText({
    episodeId: sessionId,
    branch: options.branch,
    worktree: options.worktree,
    sessionName: options.sessionName,
    reused: false,
  });
  try {
    fork.appendMessage({
      role: "toolResult",
      toolCallId: options.toolCallId,
      toolName: "create_spec_episode",
      content: [{ type: "text", text: inheritedResult }],
      isError: false,
      timestamp: Date.now(),
    });
  } catch (error) {
    rmSync(sessionFile, { force: true });
    throw error;
  }
  return { sessionFile, sessionId };
}

export class PrimeSessionPublisher implements SessionPublisher {
  private readonly client: DaemonJsonlClient;

  constructor(client = new DaemonJsonlClient(daemonSocketPath())) {
    this.client = client;
  }

  async list(): Promise<SessionSummary[]> {
    const data = requireSuccess(await this.client.request({ type: "list", all: true }), "episode collision check");
    const sessions = data && typeof data === "object" ? (data as { sessions?: unknown }).sessions : undefined;
    return Array.isArray(sessions) ? sessions as SessionSummary[] : [];
  }

  async forkAndPublish(options: {
    sourceSessionFile: string;
    worktree: string;
    sessionName: string;
    branch: string;
    toolCallId: string;
    model?: { provider: string; id: string };
  }): Promise<PublishedSession> {
    const module = await import("@earendil-works/pi-coding-agent");
    const { sessionFile, sessionId } = forkPrimeSession(module.SessionManager, options);
    try {
      return await this.openResident({
        sessionFile,
        sessionId,
        worktree: options.worktree,
        sessionName: options.sessionName,
        model: options.model,
      });
    } catch (error) {
      if (isUncertainMutation(error)) {
        throw new EpisodeStateUncertainError(
          `Episode publication may have succeeded. Preserved session ${sessionFile} and Git resources for operator recovery.`,
          { cause: error },
        );
      }
      rmSync(sessionFile, { force: true });
      throw error;
    }
  }

  async reopen(options: {
    sessionFile: string;
    sessionId: string;
    worktree: string;
    sessionName: string;
    model?: { provider: string; id: string };
  }): Promise<PublishedSession> {
    try {
      return await this.openResident(options);
    } catch (error) {
      if (isUncertainMutation(error)) {
        throw new EpisodeStateUncertainError(
          `Episode reactivation may have succeeded. Preserved durable identity and resources for operator recovery.`,
          { cause: error },
        );
      }
      throw error;
    }
  }

  async deliverExecute(activeSessionId: string, prompt: string): Promise<void> {
    try {
      requireSuccess(await this.client.request({
        type: "prompt",
        activeSessionId,
        message: prompt,
        streamingBehavior: "followUp",
        queueIfBusy: true,
        expandPromptTemplates: false,
        source: "extension",
      }), "execute delivery");
    } catch (error) {
      if (isUncertainMutation(error)) {
        throw new EpisodeStateUncertainError(
          "Execute task admission is uncertain; preserve the episode until its daemon state is inspected.",
          { cause: error },
        );
      }
      throw error;
    }
  }

  async kill(activeSessionId: string): Promise<boolean> {
    const response = await this.client.request({ type: "kill", activeSessionId });
    requireSuccess(response, "episode cleanup kill");
    return true;
  }

  close(): void {
    this.client.close();
  }

  private async openResident(options: {
    sessionFile: string;
    sessionId: string;
    worktree: string;
    sessionName: string;
    model?: { provider: string; id: string };
  }): Promise<PublishedSession> {
    const data = requireSuccess(await this.client.request({
      type: "create",
      sessionPath: options.sessionFile,
      lifecycle: "resident",
      name: options.sessionName,
      launchEnv: daemonLaunchEnvironment(),
      config: {
        cwd: options.worktree,
        ...(options.model ? { provider: options.model.provider, model: options.model.id } : {}),
      },
    }, 120_000), "episode publication") as SessionSummary | undefined;
    const activeSessionId = data?.activeSessionId ?? data?.id;
    if (!activeSessionId) {
      throw new EpisodeStateUncertainError(
        "Episode publication succeeded without a usable active-session identity; resources were preserved.",
      );
    }
    const matches = data?.sessionId === options.sessionId
      && samePath(data.sessionFile, options.sessionFile)
      && samePath(data.cwd, options.worktree)
      && data.sessionName === options.sessionName;
    if (!matches) {
      try {
        await this.kill(activeSessionId);
      } catch (error) {
        throw new EpisodeStateUncertainError(
          "Episode publication returned mismatched identity and cleanup could not be confirmed; resources were preserved.",
          { cause: error },
        );
      }
      throw new Error("Episode publication returned identity that does not match the requested fork");
    }
    return { activeSessionId, sessionId: data.sessionId!, sessionFile: data.sessionFile! };
  }
}

function identityPath(projectRoot: string, slug: string): string {
  return join(projectRoot, ".prime", "agent", "state", "spec-episodes", `${slug}.json`);
}

function samePath(a: string | undefined, b: string): boolean {
  return typeof a === "string" && resolve(a) === resolve(b);
}

function validateExistingIdentity(
  identity: EpisodeIdentity,
  expected: Pick<EpisodeIdentity, "slug" | "sourceLocation" | "ownerSessionId" | "branch" | "worktree" | "sessionName">,
  sessions: SessionSummary[],
  git: GitAdapter,
  filesystem: FilesystemAdapter,
  repo: string,
): SessionSummary {
  for (const key of ["slug", "sourceLocation", "ownerSessionId", "branch", "worktree", "sessionName"] as const) {
    if (identity[key] !== expected[key]) throw new Error(`Existing episode identity conflicts on ${key}`);
  }
  if (!git.hasBranch(repo, identity.branch)) throw new Error("Existing episode identity references a missing branch");
  const worktree = git.worktrees(repo).find((entry) => samePath(entry.path, identity.worktree));
  if (!worktree || worktree.branch !== identity.branch || !filesystem.exists(identity.worktree)) {
    throw new Error("Existing episode identity references a missing or different worktree");
  }
  const session = sessions.find((entry) => entry.sessionId === identity.episodeId
    && samePath(entry.sessionFile, identity.episodeSessionFile));
  if (!session || session.sessionName !== identity.sessionName || !samePath(session.cwd, identity.worktree)) {
    throw new Error("Existing episode identity references a missing or different durable session");
  }
  return session;
}

export async function createSpecEpisode(
  rawLocation: string,
  toolCallId: string,
  ctx: ExtensionContext,
  dependencies?: EpisodeDependencies,
): Promise<EpisodeResult> {
  const git = dependencies?.git ?? new CliGitAdapter();
  const filesystem = dependencies?.filesystem ?? new NodeFilesystemAdapter();
  let publisher = dependencies?.publisher;
  let createdWorktree = false;
  let published: PublishedSession | undefined;
  try {
    const selected = validateFutureLocation(ctx.cwd, rawLocation);
    if (!selected) throw new Error("Invalid future-plan folder");
    const repo = git.repositoryRoot(selected.projectRoot);
    if (resolve(repo) !== resolve(selected.projectRoot)) {
      throw new Error("The command must run from the repository root");
    }
    const sourceSessionFile = ctx.sessionManager.getSessionFile();
    if (!sourceSessionFile) throw new Error("Episode creation requires a persisted owner session");
    if ((ctx.sessionManager.getHeader().rlmDepth ?? 0) !== 0) {
      throw new Error("Episode creation is available only from a top-level project conversation");
    }

    const branch = `episode/${selected.slug}`;
    const worktree = resolve(dirname(repo), `${basename(repo)}-${selected.slug}-episode`);
    const sessionName = `${selected.slug}-episode`;
    const ownerSessionId = ctx.sessionManager.getSessionId();
    const recordPath = identityPath(repo, selected.slug);
    const expected = {
      slug: selected.slug,
      sourceLocation: selected.location,
      ownerSessionId,
      branch,
      worktree,
      sessionName,
    };
    const model = ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined;
    publisher ??= new PrimeSessionPublisher();
    const sessions = await publisher.list();
    const existing = filesystem.readIdentity(recordPath);
    if (existing) {
      const durableSession = validateExistingIdentity(existing, expected, sessions, git, filesystem, repo);
      let activeSessionId = durableSession.activeSessionId;
      if (!activeSessionId) {
        const reopened = await publisher.reopen({
          sessionFile: existing.episodeSessionFile,
          sessionId: existing.episodeId,
          worktree: existing.worktree,
          sessionName: existing.sessionName,
          model,
        });
        activeSessionId = reopened.activeSessionId;
      }
      const refreshed = { ...existing, episodeActiveSessionId: activeSessionId };
      if (refreshed.episodeActiveSessionId !== existing.episodeActiveSessionId) {
        filesystem.writeIdentity(recordPath, refreshed);
      }
      return { ...refreshed, reused: true };
    }

    if (git.hasBranch(repo, branch)) throw new Error(`Episode branch already exists: ${branch}`);
    const worktreeCollision = git.worktrees(repo).find((entry) => samePath(entry.path, worktree));
    if (worktreeCollision || filesystem.exists(worktree)) {
      throw new Error(`Episode worktree path already exists: ${worktree}`);
    }
    const sessionCollision = sessions.find((entry) => entry.sessionName === sessionName);
    if (sessionCollision) throw new Error(`Episode session name already exists: ${sessionName}`);

    git.createWorktree(repo, branch, worktree);
    createdWorktree = true;
    filesystem.promoteBundle(worktree, selected.slug, selected.folder);
    git.commitPromotion(worktree, selected.slug);

    const executePrompt = wrapCanonicalSkill(worktree, "execute", "operator-episode-source", selected.location);
    if (!executePrompt) throw new Error("Episode worktree is missing .ralph/skills/execute/SKILL.md");

    published = await publisher.forkAndPublish({
      sourceSessionFile,
      worktree,
      sessionName,
      branch,
      toolCallId,
      model,
    });
    await publisher.deliverExecute(published.activeSessionId, executePrompt);

    const identity: EpisodeIdentity = {
      version: 1,
      ...expected,
      episodeId: published.sessionId,
      episodeActiveSessionId: published.activeSessionId,
      episodeSessionFile: published.sessionFile,
      executeDelivered: true,
    };
    filesystem.writeIdentity(recordPath, identity);
    return { ...identity, reused: false };
  } catch (error) {
    let failure: unknown = error;
    let cleanupConfirmed = !isUncertainMutation(error);
    if (published) {
      try {
        cleanupConfirmed = await publisher!.kill(published.activeSessionId);
      } catch (killError) {
        cleanupConfirmed = false;
        failure = new EpisodeStateUncertainError(
          `Episode cleanup could not be confirmed. Preserved session ${published.sessionFile}, branch, and worktree for operator recovery.`,
          { cause: killError },
        );
      }
      if (cleanupConfirmed) filesystem.removeFile(published.sessionFile);
    }
    if (createdWorktree && cleanupConfirmed) {
      const selected = validateFutureLocation(ctx.cwd, rawLocation);
      if (selected) {
        const repo = git.repositoryRoot(selected.projectRoot);
        const branch = `episode/${selected.slug}`;
        const worktree = resolve(dirname(repo), `${basename(repo)}-${selected.slug}-episode`);
        git.removeCreatedWorktree(repo, branch, worktree);
      }
    }
    if (!cleanupConfirmed && !(failure instanceof EpisodeStateUncertainError)) {
      failure = new EpisodeStateUncertainError(
        "Episode mutation outcome is uncertain. Preserved branch, worktree, and session artifacts for operator recovery.",
        { cause: failure },
      );
    }
    throw failure;
  } finally {
    try { publisher?.close(); } catch { /* a close error must not mask the operation result */ }
  }
}
