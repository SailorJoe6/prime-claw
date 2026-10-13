import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import type { CommandRunner } from "./project-initialization.ts";
import { ProcessCommandRunner } from "./project-initialization.ts";
import {
  CliGitAdapter,
  PrimeSessionPublisher,
  type EpisodeSessionState,
  type SessionPublisher,
  type TaskEpisodeCleanupAdapter,
  type TaskEpisodeCleanupSnapshot,
  type TaskEpisodeCleanupResourceIdentity,
} from "./spec-episode.ts";
import type { TaskEpisodeOwnershipRecord } from "./task-episode-ownership.ts";

function samePath(a: string | undefined, b: string): boolean {
  if (typeof a !== "string") return false;
  const canonical = (path: string) => existsSync(path) ? realpathSync(path) : resolve(path);
  return canonical(a) === canonical(b);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} is malformed`);
  return value as Record<string, unknown>;
}

function exactResources(record: TaskEpisodeOwnershipRecord, head: string): TaskEpisodeCleanupResourceIdentity {
  return {
    engine: record.engine,
    worktree: record.worktree!,
    branch: record.branch!,
    head,
    episodeId: record.episodeId!,
    episodeSessionFile: record.episodeSessionFile!,
    episodeActiveSessionId: record.episodeActiveSessionId!,
    ...(record.projectSetupId ? { projectSetupId: record.projectSetupId } : {}),
    ...(record.routingEnvironmentId ? { routingEnvironmentId: record.routingEnvironmentId } : {}),
    ...(record.worktreeId ? { worktreeId: record.worktreeId } : {}),
    ...(record.worktreeIdentity ? { worktreeIdentity: record.worktreeIdentity } : {}),
    ...(record.terminalHandle ? { terminalHandle: record.terminalHandle } : {}),
    ...(record.terminalHandles ? { terminalHandles: [...record.terminalHandles] } : {}),
    ...(record.worktreeName ? { worktreeName: record.worktreeName } : {}),
    ...(record.launchAutomationName ? { launchAutomationName: record.launchAutomationName } : {}),
    ...(record.launchAutomationId ? { launchAutomationId: record.launchAutomationId } : {}),
    ...(record.launchRunId ? { launchRunId: record.launchRunId } : {}),
  };
}

function idleState(state: EpisodeSessionState, record: TaskEpisodeOwnershipRecord): boolean {
  const actions = state.sessionActions;
  const exact = state.activeSessionId === record.episodeActiveSessionId
    && state.sessionId === record.episodeId
    && samePath(state.sessionFile, record.episodeSessionFile!)
    && samePath(state.cwd, record.worktree!);
  return exact && state.isSessionActive === false && state.isStreaming === false
    && state.isCompacting === false && state.isBashRunning === false
    && state.isRunningTools === false && state.hasRunningRlmChildren === false
    && state.unfinishedActionCount === 0 && actions?.queuedCount === 0
    && Array.isArray(actions.steering) && actions.steering.length === 0
    && Array.isArray(actions.followUps) && actions.followUps.length === 0
    && actions.active == null;
}

type OrcaWorktreeSnapshot = {
  id: string; identity: string; path: string; branch: string; head: string; projectSetupId: string;
};
type OrcaTerminalSnapshot = {
  handle: string; worktreeId?: string; worktreePath?: string; agentIdentity?: string;
};

/**
 * Production cleanup adapter. It uses only the Prime Agent daemon protocol,
 * Orca CLI, and Git CLI boundaries already supported by the host runtimes.
 */
export class CliTaskEpisodeCleanupAdapter implements TaskEpisodeCleanupAdapter {
  private readonly sessions: SessionPublisher;
  private readonly runner: CommandRunner;
  private readonly git: CliGitAdapter;
  private readonly projectRoot: string;
  private readonly expectedHead: string;
  private readonly ownsSessions: boolean;

  constructor(projectRoot: string, expectedHead: string, options: { sessions?: SessionPublisher; runner?: CommandRunner; git?: CliGitAdapter } = {}) {
    if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(expectedHead)) {
      throw new Error("Task Episode cleanup host adapter requires the exact terminal Episode head");
    }
    this.projectRoot = realpathSync(projectRoot);
    this.expectedHead = expectedHead;
    this.ownsSessions = !options.sessions;
    this.sessions = options.sessions ?? new PrimeSessionPublisher();
    this.runner = options.runner ?? new ProcessCommandRunner();
    this.git = options.git ?? new CliGitAdapter();
  }

  async inspect(record: TaskEpisodeOwnershipRecord): Promise<TaskEpisodeCleanupSnapshot> {
    if (!record.worktree || !record.branch || !record.episodeId || !record.episodeSessionFile
      || !record.episodeActiveSessionId) {
      throw new Error("Task Episode cleanup host adapter requires every exact core resource identity");
    }
    const projectRoot = this.projectRoot;
    const gitWorktree = this.git.worktrees(projectRoot).find((entry) => samePath(entry.path, record.worktree!));
    const orcaWorktree = record.engine === "orca" ? this.orcaWorktree(record) : null;
    if (gitWorktree && record.engine === "orca" && !orcaWorktree) {
      throw new Error("Task Episode cleanup found the owned Git worktree missing from Orca");
    }
    if (orcaWorktree && (!samePath(orcaWorktree.path, record.worktree)
      || orcaWorktree.identity !== record.worktreeIdentity
      || orcaWorktree.id !== record.worktreeId
      || orcaWorktree.branch !== record.branch
      || orcaWorktree.projectSetupId !== record.projectSetupId)) {
      throw new Error("Task Episode cleanup found a foreign Orca worktree identity");
    }
    const worktreePresent = Boolean(gitWorktree || orcaWorktree || existsSync(record.worktree));
    if (worktreePresent && !gitWorktree) {
      throw new Error("Task Episode cleanup found an unmanaged or partially removed worktree");
    }
    const worktreeHead = gitWorktree ? this.git.head(record.worktree) : undefined;
    if (orcaWorktree && orcaWorktree.head !== worktreeHead) {
      throw new Error("Task Episode cleanup found changed Orca worktree head metadata");
    }
    const branch = this.branchHead(projectRoot, record.branch);
    if ((worktreeHead && worktreeHead !== this.expectedHead) || (branch && branch.head !== this.expectedHead)) {
      throw new Error("Task Episode cleanup found a changed terminal worktree or branch head");
    }
    const sessions = await this.sessions.list();
    const exactSessions = sessions.filter((entry) => entry.sessionId === record.episodeId
      && samePath(entry.sessionFile, record.episodeSessionFile!)
      && samePath(entry.cwd, record.worktree!));
    const boundCollision = sessions.find((entry) => (
      entry.activeSessionId === record.episodeActiveSessionId
      || entry.sessionId === record.episodeId
      || samePath(entry.sessionFile, record.episodeSessionFile!)
      || samePath(entry.cwd, record.worktree!)
    ) && !exactSessions.includes(entry));
    if (boundCollision || exactSessions.length > 1) {
      throw new Error("Task Episode cleanup found a foreign or duplicate Prime Agent session identity");
    }
    const session = exactSessions[0];
    if (!session && existsSync(record.episodeSessionFile)) {
      throw new Error("Task Episode cleanup found an untracked saved-session file");
    }
    let sessionIdle = true;
    if (session?.activeSessionId) {
      if (session.activeSessionId !== record.episodeActiveSessionId) {
        throw new Error("Task Episode cleanup found a changed Prime Agent routing identity");
      }
      sessionIdle = idleState(await this.sessions.getState(session.activeSessionId), record);
    }

    let exactTerminal: OrcaTerminalSnapshot | undefined;
    if (record.engine === "orca" && orcaWorktree) {
      const terminals = this.orcaTerminals(record);
      exactTerminal = terminals.find((terminal) => terminal.handle === record.terminalHandle);
      const ownedHandles = new Set(record.terminalHandles ?? [record.terminalHandle!]);
      if (terminals.some((terminal) => !ownedHandles.has(terminal.handle))) {
        throw new Error("Task Episode cleanup found a foreign Orca terminal in the owned worktree");
      }
      if (terminals.some((terminal) => terminal.worktreeId !== record.worktreeId
        || (terminal.worktreePath !== undefined && !samePath(terminal.worktreePath, record.worktree)))) {
        throw new Error("Task Episode cleanup found a foreign Orca terminal identity");
      }
      if (exactTerminal && exactTerminal.agentIdentity !== "prime-agent") {
        throw new Error("Task Episode cleanup found a foreign primary Orca terminal identity");
      }
    }
    // Orca owns terminal teardown as part of its exact non-force worktree removal.
    // Keeping the pane out of the Prime runtime stage avoids retiring its durable
    // surface before Orca has proved the PTY stopped.
    const runtimePresent = Boolean(session || existsSync(record.episodeSessionFile));
    const head = worktreeHead ?? branch?.head;
    if (runtimePresent && !head) {
      throw new Error("Task Episode cleanup found runtime state after both worktree and branch disappeared");
    }
    const resources = head ? exactResources(record, head) : undefined;
    return {
      ...(runtimePresent ? {
        runtime: { resources: resources!, cwd: record.worktree, idle: sessionIdle },
      } : {}),
      ...(gitWorktree ? {
        worktree: {
          path: realpathSync(record.worktree),
          branch: gitWorktree.branch ?? "",
          head: worktreeHead!,
          clean: this.status(record.worktree) === "",
        },
      } : {}),
      ...(branch ? { branch: { name: record.branch, head: branch.head } } : {}),
    };
  }

  async removeRuntime(record: TaskEpisodeOwnershipRecord): Promise<void> {
    const before = await this.inspect(record);
    if (!before.runtime || !before.runtime.idle) throw new Error("Task Episode cleanup runtime removal requires the exact idle runtime");
    const sessions = await this.sessions.list();
    const exact = sessions.filter((entry) => entry.sessionId === record.episodeId
      && samePath(entry.sessionFile, record.episodeSessionFile!)
      && samePath(entry.cwd, record.worktree!));
    const collision = sessions.find((entry) => (
      entry.activeSessionId === record.episodeActiveSessionId
      || entry.sessionId === record.episodeId
      || samePath(entry.sessionFile, record.episodeSessionFile!)
      || samePath(entry.cwd, record.worktree!)
    ) && !exact.includes(entry));
    if (collision || exact.length > 1) throw new Error("Task Episode cleanup found foreign or duplicate Prime Agent sessions");
    if (exact.length === 0 && existsSync(record.episodeSessionFile!)) {
      throw new Error("Task Episode cleanup refuses an untracked saved-session file");
    }
    const session = exact[0];
    if (session?.activeSessionId) {
      if (session.activeSessionId !== record.episodeActiveSessionId) {
        throw new Error("Task Episode cleanup refuses to kill a changed Prime Agent route");
      }
      if (!idleState(await this.sessions.getState(session.activeSessionId), record)) {
        throw new Error("Task Episode cleanup refuses to kill a busy Prime Agent session");
      }
      if (!this.sessions.kill) throw new Error("Prime Agent runtime does not support exact session kill");
      await this.sessions.kill(session.activeSessionId);
      const afterKill = await this.sessions.list();
      if (afterKill.some((entry) => entry.activeSessionId === session.activeSessionId)) {
        throw new Error("Prime Agent did not confirm exact Episode session termination");
      }
    }
    if (existsSync(record.episodeSessionFile!) || exact.length > 0) {
      if (!this.sessions.deleteSaved) throw new Error("Prime Agent runtime does not support saved-session deletion");
      await this.sessions.deleteSaved(record.episodeSessionFile!);
      const afterDelete = await this.sessions.list();
      if (existsSync(record.episodeSessionFile!) || afterDelete.some((entry) => entry.sessionId === record.episodeId
        || samePath(entry.sessionFile, record.episodeSessionFile!))) {
        throw new Error("Prime Agent did not confirm exact saved-session deletion");
      }
    }
  }

  async removeWorktree(record: TaskEpisodeOwnershipRecord): Promise<void> {
    const before = await this.inspect(record);
    if (before.runtime || !before.worktree || !before.branch) {
      throw new Error("Task Episode cleanup worktree removal requires runtime absence and exact worktree/branch identity");
    }
    if (record.engine === "orca") {
      const worktree = this.orcaWorktree(record);
      if (worktree) {
        if (worktree.id !== record.worktreeId
          || worktree.identity !== record.worktreeIdentity
          || !samePath(worktree.path, record.worktree!)
          || worktree.branch !== record.branch
          || worktree.head !== this.expectedHead
          || worktree.projectSetupId !== record.projectSetupId) {
          throw new Error("Task Episode cleanup refuses to remove a changed Orca worktree");
        }
        const terminals = this.orcaTerminals(record);
        const ownedHandles = new Set(record.terminalHandles ?? [record.terminalHandle!]);
        const primary = terminals.find((terminal) => terminal.handle === record.terminalHandle);
        if (terminals.some((terminal) => !ownedHandles.has(terminal.handle))
          || terminals.some((terminal) => terminal.worktreeId !== record.worktreeId
            || (terminal.worktreePath !== undefined && !samePath(terminal.worktreePath, record.worktree!)))
          || (primary && primary.agentIdentity !== "prime-agent")) {
          throw new Error("Task Episode cleanup refuses to remove an Orca worktree with foreign terminals");
        }
        this.orcaMutation(
          ["worktree", "rm", "--worktree", `id:${record.worktreeId}`],
          "Orca worktree removal",
        );
      }
      return;
    }
    if (existsSync(record.worktree!)) {
      const registered = this.git.worktrees(this.projectRoot).filter((entry) => samePath(entry.path, record.worktree!));
      const branch = this.branchHead(this.projectRoot, record.branch!);
      if (registered.length !== 1 || registered[0].branch !== record.branch
        || this.git.head(record.worktree!) !== this.expectedHead || branch?.head !== this.expectedHead) {
        throw new Error("Task Episode cleanup refuses to remove a changed local worktree");
      }
      this.git.assertCleanWorktree(record.worktree!);
      const result = this.runner.run("git", ["worktree", "remove", "--", record.worktree!], {
        cwd: this.projectRoot, allowFailure: true,
      });
      if (result.status !== 0) throw new Error(`Git worktree removal failed: ${result.stderr.trim() || result.stdout.trim()}`);
    }
  }

  async removeBranch(record: TaskEpisodeOwnershipRecord): Promise<void> {
    const before = await this.inspect(record);
    if (before.runtime || before.worktree || !before.branch) {
      throw new Error("Task Episode cleanup branch removal requires only the exact terminal branch to remain");
    }
    const branch = this.branchHead(this.projectRoot, record.branch!);
    if (!branch) return;
    if (branch.head !== this.expectedHead) {
      throw new Error("Task Episode cleanup refuses to delete a changed terminal branch");
    }
    const result = this.runner.run("git", ["branch", "-D", "--", record.branch!], {
      cwd: this.projectRoot, allowFailure: true,
    });
    if (result.status !== 0) throw new Error(`Git branch removal failed: ${result.stderr.trim() || result.stdout.trim()}`);
  }

  close(): void {
    if (!this.ownsSessions) return;
    try { this.sessions.close(); } catch { /* do not mask the lifecycle result */ }
  }

  private status(cwd: string): string {
    const result = this.runner.run("git", ["status", "--porcelain", "--untracked-files=all"], { cwd, allowFailure: true });
    if (result.status !== 0) throw new Error(`Git worktree status failed: ${result.stderr.trim()}`);
    return result.stdout.trim();
  }

  private branchHead(projectRoot: string, branch: string): { head: string } | null {
    const format = this.runner.run("git", ["check-ref-format", "--branch", branch], { cwd: projectRoot, allowFailure: true });
    if (format.status !== 0) throw new Error("Task Episode cleanup ownership contains an invalid branch ref");
    const exists = this.runner.run("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
      cwd: projectRoot, allowFailure: true,
    });
    if (exists.status === 1) return null;
    if (exists.status !== 0) throw new Error(`Git branch inspection failed: ${exists.stderr.trim() || `exit ${exists.status}`}`);
    const result = this.runner.run("git", ["show-ref", "--hash", "--verify", `refs/heads/${branch}`], {
      cwd: projectRoot, allowFailure: true,
    });
    if (result.status !== 0) throw new Error(`Git branch inspection failed: ${result.stderr.trim()}`);
    const head = result.stdout.trim();
    if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(head)) throw new Error("Git returned a malformed Episode branch head");
    return { head };
  }

  private orcaWorktree(record: TaskEpisodeOwnershipRecord): OrcaWorktreeSnapshot | null {
    const result = this.orcaJson(
      ["worktree", "show", "--worktree", `id:${record.worktreeId}`],
      "Orca worktree lookup",
      true,
    );
    if (!result) return null;
    const row = object(result.worktree ?? result, "Orca worktree");
    const identity = object(row.identity, "Orca worktree identity");
    return {
      id: String(row.id ?? ""),
      identity: String(identity.key ?? ""),
      path: String(row.path ?? ""),
      branch: String(row.branch ?? "").replace(/^refs\/heads\//, ""),
      head: String(row.head ?? ""),
      projectSetupId: String(row.projectHostSetupId ?? ""),
    };
  }

  private orcaTerminals(record: TaskEpisodeOwnershipRecord): OrcaTerminalSnapshot[] {
    const result = this.orcaJson(
      ["terminal", "list", "--worktree", `id:${record.worktreeId}`, "--include-visual-layouts"],
      "Orca terminal inventory",
      false,
    )!;
    return (Array.isArray(result.terminals) ? result.terminals : []).map((value) => {
      const row = object(value, "Orca terminal");
      return {
        handle: String(row.handle ?? ""),
        ...(typeof row.worktreeId === "string" ? { worktreeId: row.worktreeId } : {}),
        ...(typeof row.worktreePath === "string" ? { worktreePath: row.worktreePath } : {}),
        ...(typeof row.agentIdentity === "string" ? { agentIdentity: row.agentIdentity } : {}),
      };
    });
  }

  private orcaMutation(args: string[], label: string): void {
    this.orcaJson(args, label, false);
  }

  private orcaJson(args: string[], label: string, absentAllowed: boolean): Record<string, unknown> | null {
    const command = this.runner.run("orca", [...args, "--json"], { allowFailure: true });
    let envelope: Record<string, unknown>;
    try { envelope = object(JSON.parse(command.stdout), label); }
    catch (error) {
      throw new Error(`${label} returned malformed JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (command.status !== 0 || envelope.ok !== true) {
      const detail = envelope.error && typeof envelope.error === "object" && !Array.isArray(envelope.error)
        ? envelope.error as Record<string, unknown>
        : {};
      if (absentAllowed && detail.code === "selector_not_found") return null;
      throw new Error(`${label} failed: ${String(detail.message ?? command.stderr.trim() ?? "unknown error")}`);
    }
    return object(envelope.result, `${label}.result`);
  }
}
