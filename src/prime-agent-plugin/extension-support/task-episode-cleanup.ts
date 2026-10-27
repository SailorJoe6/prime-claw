import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import type { CommandRunner } from "./project-initialization.ts";
import { ProcessCommandRunner } from "./project-initialization.ts";
import {
  CliGitAdapter,
  PrimeSessionPublisher,
  type SessionPublisher,
  type SessionSummary,
  type TaskEpisodeCleanupAdapter,
  type TaskEpisodeCleanupSnapshot,
} from "./spec-episode.ts";
import type { TaskEpisodeOwnershipRecord } from "./episode-ownership.ts";

function samePath(a: string | undefined, b: string): boolean {
  if (typeof a !== "string") return false;
  const canonical = (path: string) => existsSync(path) ? realpathSync(path) : resolve(path);
  return canonical(a) === canonical(b);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} is malformed`);
  return value as Record<string, unknown>;
}

function quiescentState(state: SessionSummary): boolean {
  const actions = state.sessionActions;
  return state.isSessionActive === false
    && state.activity !== "working"
    && state.isStreaming === false
    && state.isCompacting === false
    && state.isBashRunning !== true
    && state.isRunningTools !== true
    && state.hasRunningRlmChildren !== true
    && state.hasActiveHeartbeat !== true
    && state.hasRegisteredHeartbeat !== true
    && state.hasRegisteredCronJob !== true
    && (state.attachedClients ?? 0) === 0
    && (state.directAttachedClients ?? 0) === 0
    && (state.unfinishedActionCount ?? 0) === 0
    && (state.queuedCount ?? 0) === 0
    && actions?.queuedCount === 0
    && Array.isArray(actions.steering) && actions.steering.length === 0
    && Array.isArray(actions.followUps) && actions.followUps.length === 0
    && actions.active == null
    && state.lifecycle !== "draft"
    && state.statusLabel === undefined
    && !["starting", "recovering", "stopping", "failed"].includes(state.workerState ?? "ready");
}

function rosterScheduleQuiescent(summary: SessionSummary): boolean {
  return summary.hasActiveHeartbeat !== true
    && summary.hasRegisteredHeartbeat !== true
    && summary.hasRegisteredCronJob !== true;
}

type OwnedEpisodeSession = { summary: SessionSummary; depth: number };
type EpisodeSessionTree = { root: OwnedEpisodeSession; descendants: OwnedEpisodeSession[]; idle: boolean };

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
  // Invocation-local only: provider/native branch deletion can erase Git configuration.
  private resolvedUpstream?: { branch: string; remote: string; ref: string; destination: string };

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

  private exactSession(summary: SessionSummary, expected: SessionSummary): boolean {
    return summary.sessionId === expected.sessionId
      && typeof summary.sessionFile === "string"
      && typeof expected.sessionFile === "string"
      && samePath(summary.sessionFile, expected.sessionFile)
      && ((summary.cwd === undefined && expected.cwd === undefined)
        || (typeof summary.cwd === "string" && typeof expected.cwd === "string"
          && samePath(summary.cwd, expected.cwd)))
      && summary.activeSessionId === expected.activeSessionId
      && summary.parentSessionId === expected.parentSessionId
      && ((summary.parentSessionPath === undefined && expected.parentSessionPath === undefined)
        || (typeof summary.parentSessionPath === "string" && typeof expected.parentSessionPath === "string"
          && samePath(summary.parentSessionPath, expected.parentSessionPath)));
  }

  private validateSessionIdentity(summary: SessionSummary, record: TaskEpisodeOwnershipRecord, child: boolean): void {
    if (!summary.sessionId || !summary.sessionFile || !existsSync(summary.sessionFile)) {
      throw new Error("Task Episode cleanup found a malformed or missing Prime Agent session identity");
    }
    if (!child && !samePath(summary.cwd, record.worktree!)) {
      throw new Error("Task Episode cleanup found a changed Prime Agent root worktree identity");
    }
  }

  private async sessionTree(record: TaskEpisodeOwnershipRecord, sessions: SessionSummary[]): Promise<EpisodeSessionTree | null> {
    const rootRows = sessions.filter((entry) => entry.sessionId === record.episodeId
      && samePath(entry.sessionFile, record.episodeSessionFile!)
      && samePath(entry.cwd, record.worktree!));
    if (rootRows.length > 1) {
      throw new Error("Task Episode cleanup found a foreign or duplicate Prime Agent session identity");
    }
    const root = rootRows[0];
    if (!root) {
      const collision = sessions.find((entry) => entry.activeSessionId === record.episodeActiveSessionId
        || entry.sessionId === record.episodeId
        || samePath(entry.sessionFile, record.episodeSessionFile!)
        || samePath(entry.cwd, record.worktree!));
      if (collision) throw new Error("Task Episode cleanup found a foreign or duplicate Prime Agent session identity");
      if (sessions.some((entry) => entry.parentSessionId === record.episodeId
        || samePath(entry.parentSessionPath, record.episodeSessionFile!))) {
        throw new Error("Task Episode cleanup found an explicit descendant without its recorded root session");
      }
      if (existsSync(record.episodeSessionFile!)) {
        throw new Error("Task Episode cleanup found an untracked saved-session file");
      }
      return null;
    }
    this.validateSessionIdentity(root, record, false);
    if (root.activeSessionId !== undefined && root.activeSessionId !== record.episodeActiveSessionId) {
      throw new Error("Task Episode cleanup found a changed Prime Agent routing identity");
    }

    const owned = new Set<SessionSummary>([root]);
    const nodes: OwnedEpisodeSession[] = [{ summary: root, depth: 0 }];
    for (let index = 0; index < nodes.length; index += 1) {
      const parent = nodes[index]!;
      const parentId = parent.summary.sessionId!;
      const parentFile = parent.summary.sessionFile!;
      for (const candidate of sessions) {
        if (owned.has(candidate)) continue;
        const parentIdPresent = candidate.parentSessionId !== undefined;
        const idMatch = candidate.parentSessionId === parentId;
        const pathMatch = samePath(candidate.parentSessionPath, parentFile);
        if (!idMatch && !pathMatch) continue;
        if ((parentIdPresent && !idMatch)
          || (candidate.parentSessionPath !== undefined && !pathMatch)) {
          throw new Error("Task Episode cleanup found an ambiguous Prime Agent descendant parent chain");
        }
        this.validateSessionIdentity(candidate, record, true);
        owned.add(candidate);
        nodes.push({ summary: candidate, depth: parent.depth + 1 });
      }
    }

    const identities = nodes.map((node) => node.summary);
    for (const summary of identities) {
      const duplicates = sessions.filter((candidate) => candidate.sessionId === summary.sessionId
        || samePath(candidate.sessionFile, summary.sessionFile!)
        || (summary.activeSessionId !== undefined && candidate.activeSessionId === summary.activeSessionId));
      if (duplicates.some((candidate) => !owned.has(candidate)) || duplicates.length > 1) {
        throw new Error("Task Episode cleanup found a foreign or duplicate Prime Agent session identity");
      }
    }
    const foreign = sessions.find((candidate) => !owned.has(candidate) && (
      samePath(candidate.cwd, record.worktree!)
      || identities.some((summary) => candidate.parentSessionId === summary.sessionId
        || samePath(candidate.parentSessionPath, summary.sessionFile!))
    ));
    if (foreign) {
      throw new Error("Task Episode cleanup found a foreign or duplicate Prime Agent session identity");
    }

    let idle = true;
    for (const node of nodes) {
      let state: SessionSummary = node.summary;
      if (node.summary.activeSessionId) {
        state = await this.sessions.getState(node.summary.activeSessionId);
        if (!this.exactSession(state, node.summary)) {
          throw new Error("Task Episode cleanup found changed Prime Agent session identity during state inspection");
        }
      }
      if (!quiescentState(state) || !rosterScheduleQuiescent(node.summary)) idle = false;
    }
    return { root: nodes[0]!, descendants: nodes.slice(1), idle };
  }

  private async removeSession(summary: SessionSummary): Promise<void> {
    const sessionId = summary.sessionId!;
    const sessionFile = summary.sessionFile!;
    const activeSessionId = summary.activeSessionId;
    if (activeSessionId) {
      const listedRows = (await this.sessions.list()).filter((entry) => entry.sessionId === sessionId
        || samePath(entry.sessionFile, sessionFile)
        || entry.activeSessionId === activeSessionId);
      const listed = listedRows[0];
      const state = await this.sessions.getState(activeSessionId);
      if (listedRows.length !== 1 || !listed || !this.exactSession(listed, summary)
        || !rosterScheduleQuiescent(listed)
        || !this.exactSession(state, summary) || !quiescentState(state)) {
        throw new Error("Task Episode cleanup refuses to remove a changed or busy Prime Agent session");
      }
      if (!this.sessions.kill) throw new Error("Prime Agent runtime does not support exact session kill");
      await this.sessions.kill(activeSessionId);
      const afterKill = await this.sessions.list();
      if (afterKill.some((entry) => entry.activeSessionId === activeSessionId)) {
        throw new Error("Prime Agent did not confirm exact Episode session termination");
      }
    }
    const beforeDelete = await this.sessions.list();
    const savedRows = beforeDelete.filter((entry) => entry.sessionId === sessionId
      || samePath(entry.sessionFile, sessionFile)
      || (activeSessionId !== undefined && entry.activeSessionId === activeSessionId));
    if (activeSessionId === undefined) {
      const listed = savedRows[0];
      if (savedRows.length !== 1 || !listed || !this.exactSession(listed, summary)
        || !rosterScheduleQuiescent(listed) || !quiescentState(listed)) {
        throw new Error("Task Episode cleanup refuses to remove a changed or busy Prime Agent session");
      }
    }
    const savedPresent = existsSync(sessionFile) || savedRows.length > 0;
    if (savedPresent) {
      if (!this.sessions.deleteSaved) throw new Error("Prime Agent runtime does not support saved-session deletion");
      await this.sessions.deleteSaved(sessionFile);
    }
    const afterDelete = await this.sessions.list();
    if (existsSync(sessionFile) || afterDelete.some((entry) => entry.sessionId === sessionId
      || samePath(entry.sessionFile, sessionFile)
      || (activeSessionId !== undefined && entry.activeSessionId === activeSessionId))) {
      throw new Error("Prime Agent did not confirm exact saved-session deletion");
    }
  }

  async inspect(record: TaskEpisodeOwnershipRecord): Promise<TaskEpisodeCleanupSnapshot> {
    if (!record.worktree || !record.branch || !record.episodeId || !record.episodeSessionFile
      || !record.episodeActiveSessionId) {
      throw new Error("Task Episode cleanup host adapter requires every exact core resource identity");
    }
    const projectRoot = this.projectRoot;
    const gitWorktrees = this.git.worktrees(projectRoot);
    if (gitWorktrees.some((entry) => entry.branch === record.branch && !samePath(entry.path, record.worktree!))) {
      throw new Error("Task Episode cleanup found the Episode branch in another worktree");
    }
    const gitWorktree = gitWorktrees.find((entry) => samePath(entry.path, record.worktree!));
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
    const sessionTree = await this.sessionTree(record, sessions);
    const sessionIdle = sessionTree?.idle ?? true;
    const upstream = this.configuredUpstream(record.branch, Boolean(branch));
    const upstreamHead = this.remoteHead(upstream);
    if (upstreamHead && upstreamHead !== this.expectedHead) {
      throw new Error("Task Episode cleanup found a changed terminal upstream head");
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
    // Orca owns terminal teardown as part of its exact, verified-clean worktree removal.
    // Keeping the pane out of the Prime runtime stage avoids retiring its durable
    // surface before Orca has proved the PTY stopped.
    const runtimePresent = Boolean(sessionTree || existsSync(record.episodeSessionFile));
    return {
      ...(runtimePresent ? {
        runtime: { cwd: record.worktree, idle: sessionIdle },
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
      ...(upstreamHead ? { upstream: { remote: upstream.remote, ref: upstream.ref, head: upstreamHead } } : {}),
    };
  }

  async removeRuntime(record: TaskEpisodeOwnershipRecord): Promise<void> {
    const before = await this.inspect(record);
    if (!before.runtime || !before.runtime.idle) throw new Error("The Episode has not completed its work: cleanup requires the exact idle runtime and descendants");
    const initial = await this.sessionTree(record, await this.sessions.list());
    if (!initial || !initial.idle) throw new Error("Task Episode cleanup runtime changed before removal");
    const plannedDescendants = [...initial.descendants].sort((left, right) =>
      right.depth - left.depth || left.summary.sessionFile!.localeCompare(right.summary.sessionFile!),
    );
    for (const planned of plannedDescendants) {
      const fresh = await this.sessionTree(record, await this.sessions.list());
      if (!fresh || !fresh.idle) throw new Error("Task Episode cleanup session tree changed or became busy during removal");
      const current = fresh.descendants.find((node) => node.summary.sessionId === planned.summary.sessionId
        && samePath(node.summary.sessionFile, planned.summary.sessionFile!));
      if (!current) continue;
      await this.removeSession(current.summary);
    }
    const beforeRoot = await this.sessionTree(record, await this.sessions.list());
    if (!beforeRoot || !beforeRoot.idle || beforeRoot.descendants.length !== 0) {
      throw new Error("Task Episode cleanup found changed descendants before parent runtime removal");
    }
    await this.removeSession(beforeRoot.root.summary);
    const after = await this.sessionTree(record, await this.sessions.list());
    if (after) throw new Error("Task Episode cleanup did not remove the exact Episode session tree");
  }

  async removeWorktree(record: TaskEpisodeOwnershipRecord): Promise<void> {
    const before = await this.inspect(record);
    if (before.runtime || before.upstream || !before.worktree || !before.worktree.clean
      || before.worktree.branch !== record.branch) {
      throw new Error("Task Episode cleanup worktree removal requires runtime/upstream absence and exact clean worktree identity");
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
        if (this.status(record.worktree!) !== "") {
          throw new Error("Task Episode cleanup refuses to force-remove a dirty Orca worktree");
        }
        this.orcaMutation(
          ["worktree", "rm", "--worktree", `id:${record.worktreeId}`, "--force"],
          "Orca worktree removal",
        );
      }
      return;
    }
    if (existsSync(record.worktree!)) {
      const registered = this.git.worktrees(this.projectRoot).filter((entry) => samePath(entry.path, record.worktree!));
      const branch = this.branchHead(this.projectRoot, record.branch!);
      if (registered.length !== 1 || registered[0].branch !== record.branch
        || this.git.head(record.worktree!) !== this.expectedHead || (branch && branch.head !== this.expectedHead)) {
        throw new Error("Task Episode cleanup refuses to remove a changed local worktree");
      }
      this.git.assertCleanWorktree(record.worktree!);
      const result = this.runner.run("git", ["worktree", "remove", "--", record.worktree!], {
        cwd: this.projectRoot, allowFailure: true,
      });
      if (result.status !== 0) throw new Error(`Git worktree removal failed: ${result.stderr.trim() || result.stdout.trim()}`);
    }
  }

  async removeUpstream(record: TaskEpisodeOwnershipRecord): Promise<void> {
    const before = await this.inspect(record);
    if (before.runtime || (before.worktree && (!before.worktree.clean || before.worktree.branch !== record.branch))) {
      throw new Error("Task Episode cleanup upstream removal requires runtime absence and an exact clean worktree if present");
    }
    const upstream = this.resolvedUpstream!;
    if (before.upstream) {
      const result = this.runner.run("git", ["push", "--porcelain",
        `--force-with-lease=${upstream.ref}:${this.expectedHead}`, "--", upstream.destination, `:${upstream.ref}`], {
        cwd: this.projectRoot, allowFailure: true,
      });
      if (result.status !== 0) throw new Error(`Git upstream removal failed: ${(result.stderr.trim() || result.stdout.trim()).replaceAll(upstream.destination, "[configured upstream]")}`);
    }
    if (this.remoteHead(upstream)) {
      throw new Error("Git did not confirm exact upstream ref absence; local branch retained");
    }
  }

  async removeBranch(record: TaskEpisodeOwnershipRecord): Promise<void> {
    const before = await this.inspect(record);
    if (before.runtime || before.worktree) {
      throw new Error("Task Episode cleanup branch removal requires runtime and worktree absence");
    }
    if (before.upstream) await this.removeUpstream(record);
    const branch = this.branchHead(this.projectRoot, record.branch!);
    if (!branch) return;
    if (branch.head !== this.expectedHead) {
      throw new Error("Task Episode cleanup refuses to delete a changed terminal branch");
    }
    const result = this.runner.run("git", ["update-ref", "-d", "--no-deref", `refs/heads/${record.branch}`, this.expectedHead], {
      cwd: this.projectRoot, allowFailure: true,
    });
    if (result.status !== 0) throw new Error(`Git branch removal failed: ${result.stderr.trim() || result.stdout.trim()}`);
    if (this.branchHead(this.projectRoot, record.branch!)) {
      throw new Error("Git did not confirm exact local branch absence");
    }
  }

  close(): void {
    if (!this.ownsSessions) return;
    try { this.sessions.close(); } catch { /* do not mask the lifecycle result */ }
  }

  private status(cwd: string): string {
    const result = this.runner.run("git", ["status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"], { cwd, allowFailure: true });
    if (result.status !== 0) throw new Error(`Git worktree status failed: ${result.stderr.trim()}`);
    return result.stdout.trim();
  }

  private configuredUpstream(branch: string, branchPresent: boolean): { remote: string; ref: string; destination: string } {
    const config = (key: string): string | undefined => {
      const result = this.runner.run("git", ["config", "--get-all", `branch.${branch}.${key}`], {
        cwd: this.projectRoot, allowFailure: true,
      });
      if (result.status === 1 && result.stdout === "") return undefined;
      if (result.status !== 0) throw new Error(`Git upstream configuration lookup failed: ${result.stderr.trim()}`);
      const values = result.stdout.replace(/\r?\n$/, "").split(/\r?\n/);
      if (values.length !== 1 || !values[0]) throw new Error("Task Episode cleanup found ambiguous upstream configuration");
      return values[0];
    };
    const remote = config("remote"), ref = config("merge");
    if (remote === undefined && ref === undefined && !branchPresent && this.resolvedUpstream?.branch === branch) {
      return this.resolvedUpstream;
    }
    if (!remote || !ref) {
      throw new Error("Task Episode cleanup cannot prove the exact configured upstream identity; ownership retained");
    }
    if (remote === "." || remote.startsWith("-") || /\s/.test(remote) || !ref.startsWith("refs/heads/")) {
      throw new Error("Task Episode cleanup requires one exact configured remote branch");
    }
    const validRef = this.runner.run("git", ["check-ref-format", ref], { cwd: this.projectRoot, allowFailure: true });
    const urls = (push: boolean): string[] => {
      const result = this.runner.run("git", ["remote", "get-url", ...(push ? ["--push"] : []), "--all", "--", remote], {
        cwd: this.projectRoot, allowFailure: true,
      });
      if (result.status !== 0) throw new Error("Task Episode cleanup cannot resolve the configured upstream destination");
      return result.stdout.replace(/\r?\n$/, "").split(/\r?\n/);
    };
    const fetchUrls = urls(false), pushUrls = urls(true);
    if (validRef.status !== 0 || fetchUrls.length !== 1 || pushUrls.length !== 1
      || !fetchUrls[0] || fetchUrls[0] !== pushUrls[0]) {
      throw new Error("Task Episode cleanup requires one unambiguous upstream fetch/push destination and ref");
    }
    const destination = fetchUrls[0];
    if (this.resolvedUpstream && (this.resolvedUpstream.branch !== branch
      || this.resolvedUpstream.remote !== remote || this.resolvedUpstream.ref !== ref
      || this.resolvedUpstream.destination !== destination)) {
      throw new Error("Task Episode cleanup found changed upstream configuration during cleanup");
    }
    this.resolvedUpstream = { branch, remote, ref, destination };
    return this.resolvedUpstream;
  }

  private remoteHead(upstream: { destination: string; ref: string }): string | undefined {
    const result = this.runner.run("git", ["ls-remote", "--refs", "--", upstream.destination, upstream.ref], {
      cwd: this.projectRoot, allowFailure: true,
    });
    if (result.status !== 0) throw new Error(`Git upstream inspection failed: ${result.stderr.trim().replaceAll(upstream.destination, "[configured upstream]")}`);
    const output = result.stdout.trim();
    if (!output) return undefined;
    const rows = output.split(/\r?\n/);
    const fields = rows[0]!.split("\t");
    const [head, ref] = fields;
    if (rows.length !== 1 || fields.length !== 2 || ref !== upstream.ref || !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(head ?? "")) {
      throw new Error("Git returned an ambiguous upstream ref or malformed head");
    }
    return head;
  }

  private branchHead(projectRoot: string, branch: string): { head: string } | null {
    const format = this.runner.run("git", ["check-ref-format", "--branch", branch], { cwd: projectRoot, allowFailure: true });
    if (format.status !== 0) throw new Error("Task Episode cleanup ownership contains an invalid branch ref");
    const symbolic = this.runner.run("git", ["symbolic-ref", "--quiet", `refs/heads/${branch}`], {
      cwd: projectRoot, allowFailure: true,
    });
    if (symbolic.status === 0) throw new Error("Task Episode cleanup refuses a symbolic Episode branch ref");
    if (symbolic.status !== 1) throw new Error("Git could not prove a direct Episode branch ref");
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
