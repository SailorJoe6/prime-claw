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
import { basename, dirname, join, relative, resolve } from "node:path";
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
  writeEpisodeOwnership,
  type EpisodeOwnershipRecord,
  type LegacyEpisodeOwnershipRecord,
  type TaskEpisodeOwnershipRecord,
} from "./episode-ownership.ts";
import {
  resolveBacklogTask,
  validateFutureLocation,
  type BacklogTaskSelection,
} from "./reviewed-plan-support.ts";
import {
  ProcessCommandRunner,
  resolveNearestProjectRoot,
  type CommandRunner,
} from "./project-initialization.ts";
import { activeLegacyPlanFiles } from "./legacy-workflow.ts";
import {
  meaningfulTaskImplementationPlan,
  reserveTaskEpisodeOwnership,
  type TaskEpisodeReservationInput,
} from "./task-episode-ownership.ts";

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
  read(projectRoot: string): EpisodeOwnershipRecord | null;
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
export interface TaskEpisodeLifecycleGit extends TaskEpisodeAdmissionGit {
  upstreamHead(worktree: string): string;
  pathChangedBetween(worktree: string, fromRef: string, toRef: string, path: string): boolean;
}
export interface TaskEpisodeReviewGit extends TaskEpisodeLifecycleGit {
  isAncestor(repo: string, ancestor: string, descendant: string): boolean;
  mergeMain(worktree: string, mainHead: string, taskPath: string): void;
  restoreTaskFromHead(worktree: string, taskPath: string): void;
  stagePath(worktree: string, taskPath: string): void;
  commitMerge(worktree: string, message: string): string;
  abortMerge(worktree: string): void;
  parents(repo: string, ref: string): string[];
}
export type GitWorktreeChange = { status: string; path: string };
export interface TaskEpisodeMergeGit extends TaskEpisodeReviewGit {
  fastForward(repo: string, candidateHead: string): void;
  worktreeChanges(repo: string): GitWorktreeChange[];
}
export interface TaskEpisodeAbandonmentGit extends TaskEpisodeMergeGit {
  pathTrackedAtRef(repo: string, ref: string, path: string): boolean;
  restorePathFromRef(repo: string, ref: string, path: string): void;
  commitOnlyPaths(repo: string, paths: string[], message: string): string;
}
export type TaskReviewSnapshot = {
  taskId: string;
  taskPath: string;
  parentTaskId: string | null;
  status: string;
  implementationPlan: string | null;
  contentDigest: string;
};
export interface TaskEpisodeLifecycleDependencies extends TaskEpisodeHandoffDependencies {
  lifecycleGit?: TaskEpisodeLifecycleGit;
  lifecycleRunner?: CommandRunner;
}
export interface TaskEpisodeReadyForMergeDependencies extends TaskEpisodeLifecycleDependencies {
  reviewGit?: TaskEpisodeReviewGit;
  mergeGit?: TaskEpisodeMergeGit;
  taskSnapshotResolver?: (cwd: string, taskId: string) => TaskReviewSnapshot;
}
export type TaskAbandonmentSnapshot = TaskReviewSnapshot & {
  finalSummary: string | null;
  abandonmentContentDigest: string;
};
export type TaskAbandonmentFileSnapshot = {
  status: string;
  finalSummary: string | null;
  contentDigest: string;
};
export interface TaskEpisodeAbandonmentDependencies extends TaskEpisodeReadyForMergeDependencies {
  abandonmentGit?: TaskEpisodeAbandonmentGit;
  abandonmentSnapshotResolver?: (cwd: string, taskId: string) => TaskAbandonmentSnapshot;
  abandonmentFileSnapshotResolver?: (cwd: string, taskPath: string) => TaskAbandonmentFileSnapshot;
  assertNoArchiveCleanupTargets?: (cwd: string, taskId: string, taskPath: string) => void;
}
export type TaskEpisodeLifecycleResult = {
  taskId: string;
  status: "Blocked" | "In Progress" | "Ready for Merge";
  commit: string;
  episodeHead: string;
  pushError?: string;
};
export type TaskEpisodeReadyPublicationResult = TaskEpisodeLifecycleResult & {
  status: "Ready for Merge";
  parentTaskId: string | null;
  episodeTaskContentDigest: string;
};
export type TaskEpisodeReadyIntegrationResult = {
  taskId: string;
  readyCommit: string;
  acceptedEpisodeHead: string;
  integratedMainHead: string;
  refreshedEpisodeHead: string;
  parentTaskId: string | null;
  episodeTaskContentDigest: string;
  pushError?: string;
};
export type TaskEpisodeReadyVerificationResult = {
  verified: true;
  taskId: string;
  mainHead: string;
  refreshedEpisodeHead: string;
};
export type TaskEpisodeReadyHandshakeEvidence = {
  publication: TaskEpisodeReadyPublicationResult;
  integration: TaskEpisodeReadyIntegrationResult;
  verification: TaskEpisodeReadyVerificationResult;
};
export type TaskEpisodeDelayResult = TaskEpisodeReadyVerificationResult & {
  outcome: "delayed";
};
export type TaskEpisodeChangesPublicationResult = TaskEpisodeLifecycleResult & {
  status: "In Progress";
  parentTaskId: string | null;
  episodeTaskContentDigest: string;
};
export type TaskEpisodeChangesIntegrationResult = {
  taskId: string;
  changesCommit: string;
  previousRefreshedEpisodeHead: string;
  integratedMainHead: string;
  refreshedEpisodeHead: string;
  parentTaskId: string | null;
  episodeTaskContentDigest: string;
  pushError?: string;
};
export type TaskEpisodeChangesVerificationResult = {
  verified: true;
  taskId: string;
  mainHead: string;
  refreshedEpisodeHead: string;
  status: "In Progress";
};
export type TaskEpisodeChangesResumeResult = {
  verification: TaskEpisodeChangesVerificationResult;
  handoff: TaskEpisodeHandoffResult;
};
export type TaskEpisodeMergeDecision = {
  operatorDecision: "merge";
  taskId: string;
  mainHead: string;
  refreshedEpisodeHead: string;
};
export type TaskEpisodeMergeResult = {
  verified: true;
  outcome: "merged";
  taskId: string;
  status: "Done";
  priorMainHead: string;
  mergedHead: string;
  doneCommit: string;
  parentTaskId: string | null;
  episodeTaskContentDigest: string;
  pushError?: string;
};
export type TaskEpisodeAbandonmentDecision = {
  operatorDecision: "abandon";
  taskId: string;
  taskPath: string;
  mainHead: string;
  episodeHead: string;
  mainStatus: string;
  candidateMainRelationship: "same" | "main-ancestor" | "episode-ancestor" | "diverged";
  parentTaskId: string | null;
  episodeTaskContentDigest: string;
  finalSummary: string;
};
export type TaskEpisodeAbandonmentResult = {
  verified: true;
  outcome: "abandoned";
  taskId: string;
  status: string;
  priorMainHead: string;
  episodeHead: string;
  archiveCommit: string;
  archivedTaskPath: string;
  parentTaskId: string | null;
  episodeTaskContentDigest: string;
  archivedTaskFileDigest: string;
  resourcesRetained: true;
  pushError?: string;
};
export type TaskEpisodeCleanupResourceIdentity = {
  engine: "orca" | "local";
  worktree: string;
  branch: string;
  head: string;
  episodeId: string;
  episodeSessionFile: string;
  episodeActiveSessionId: string;
  projectSetupId?: string;
  routingEnvironmentId?: string;
  worktreeId?: string;
  worktreeIdentity?: string;
  terminalHandle?: string;
  terminalHandles?: string[];
  worktreeName?: string;
  launchAutomationName?: string;
  launchAutomationId?: string;
  launchRunId?: string;
};
export type TaskEpisodeCleanupDecision = {
  operatorDecision: "cleanup";
  taskId: string;
  taskPath: string;
  ownerSessionId: string;
  episodeHead: string;
  terminalOutcome: "merged" | "abandoned";
  terminalCommit: string;
  resources: TaskEpisodeCleanupResourceIdentity;
};
export type TaskEpisodeTerminalEvidence =
  | { outcome: "merged"; result: TaskEpisodeMergeResult }
  | { outcome: "abandoned"; decision: TaskEpisodeAbandonmentDecision; result: TaskEpisodeAbandonmentResult };
export type TaskEpisodeCleanupSnapshot = {
  runtime?: {
    resources: TaskEpisodeCleanupResourceIdentity;
    cwd: string;
    idle: boolean;
  };
  worktree?: { path: string; branch: string; head: string; clean: boolean };
  branch?: { name: string; head: string };
};
export interface TaskEpisodeCleanupAdapter {
  inspect(record: TaskEpisodeOwnershipRecord): Promise<TaskEpisodeCleanupSnapshot>;
  removeRuntime(record: TaskEpisodeOwnershipRecord): Promise<void>;
  removeWorktree(record: TaskEpisodeOwnershipRecord): Promise<void>;
  removeBranch(record: TaskEpisodeOwnershipRecord): Promise<void>;
}
export interface TaskEpisodeFinalizationDependencies extends TaskEpisodeAbandonmentDependencies {
  cleanup: TaskEpisodeCleanupAdapter;
  now?: () => string;
}
export type TaskEpisodeFinalizationResult = {
  verified: true;
  outcome: "merged" | "abandoned";
  taskId: string;
  terminalCommit: string;
  resourcesRemoved: true;
  ownershipStatus: "inactive";
  reused: boolean;
};
export type TaskEpisodeOperatorDecision =
  | { operatorDecision: "delay" }
  | { operatorDecision: "request-changes" };

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
  upstreamHead(worktree: string): string { return runGit(worktree, ["rev-parse", "@{upstream}"]); }
  pathChangedBetween(worktree: string, fromRef: string, toRef: string, path: string): boolean {
    const output = runGit(worktree, ["diff", "--name-only", `${fromRef}..${toRef}`, "--", path]);
    return output.split(/\r?\n/).filter(Boolean).includes(path);
  }
  isAncestor(repo: string, ancestor: string, descendant: string): boolean {
    try { runGit(repo, ["merge-base", "--is-ancestor", ancestor, descendant]); return true; }
    catch { return false; }
  }
  mergeMain(worktree: string, mainHead: string, taskPath: string): void {
    try { runGit(worktree, ["merge", "--no-ff", "--no-commit", mainHead]); }
    catch (error) {
      const conflicts = runGit(worktree, ["diff", "--name-only", "--diff-filter=U", "--"])
        .split(/\r?\n/).filter(Boolean);
      if (conflicts.length === 1 && conflicts[0] === taskPath) return;
      throw new Error(`Task-native review integration has conflicts outside ${taskPath}: ${conflicts.join(", ") || "unknown merge failure"}`, { cause: error });
    }
  }
  restoreTaskFromHead(worktree: string, taskPath: string): void {
    runGit(worktree, ["checkout", "HEAD", "--", taskPath]);
  }
  stagePath(worktree: string, taskPath: string): void { runGit(worktree, ["add", "--", taskPath]); }
  commitMerge(worktree: string, message: string): string {
    runGit(worktree, ["commit", "-m", message]);
    return this.head(worktree);
  }
  abortMerge(worktree: string): void { runGit(worktree, ["merge", "--abort"]); }
  parents(repo: string, ref: string): string[] {
    const values = runGit(repo, ["rev-list", "--parents", "-n", "1", ref]).split(/\s+/).filter(Boolean);
    return values.slice(1);
  }
  fastForward(repo: string, candidateHead: string): void {
    runGit(repo, ["merge", "--ff-only", candidateHead]);
  }
  pathTrackedAtRef(repo: string, ref: string, path: string): boolean {
    const output = runGitRaw(repo, ["ls-tree", "-z", "--name-only", ref, "--", path]);
    return output.split("\0").filter(Boolean).includes(path);
  }
  restorePathFromRef(repo: string, ref: string, path: string): void {
    runGit(repo, ["restore", `--source=${ref}`, "--worktree", "--", path]);
  }
  commitOnlyPaths(repo: string, paths: string[], message: string): string {
    if (paths.length < 2) throw new Error("Archival commit requires distinct active and archive paths");
    const parts = paths.map((path) => path.split("/").filter(Boolean));
    let shared = 0;
    while (parts.every((value) => value[shared] !== undefined && value[shared] === parts[0][shared])) shared += 1;
    const boundary = parts[0].slice(0, shared).join("/");
    if (!boundary) throw new Error("Archival paths do not share a project-relative boundary");
    runGit(repo, ["add", "-A", "--", boundary]);
    runGit(repo, ["commit", "-m", message]);
    return this.head(repo);
  }
  worktreeChanges(repo: string): GitWorktreeChange[] {
    const values = runGitRaw(repo, ["status", "--porcelain=v1", "-z", "--untracked-files=all"])
      .split("\0").filter(Boolean);
    const changes: GitWorktreeChange[] = [];
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      const status = value.slice(0, 2);
      const path = value.slice(3);
      if (status.includes("R") || status.includes("C")) {
        const destination = values[index + 1] ?? "";
        changes.push({ status, path: `${path} -> ${destination}` });
        index += 1;
      } else changes.push({ status, path });
    }
    return changes;
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
  const record = store.read(projectRoot);
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
function validateWorktreeRecord(record: EpisodeOwnershipRecord, git: GitAdapter, filesystem: FilesystemAdapter, repo: string): void {
  if (!record.worktree || !record.branch || !filesystem.exists(record.worktree)) throw new Error("Episode ownership references a missing worktree");
  const worktree = git.worktrees(repo).find((entry) => samePath(entry.path, record.worktree));
  if (!worktree || worktree.branch !== record.branch) throw new Error("Episode ownership references a missing or different worktree");
  if (isLegacyEpisodeOwnership(record) && record.status === "active" && !filesystem.hasActiveLegacyPlanFiles(record.worktree)) {
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
  });
  if (!handoffPrompt) throw new Error("Episode worktree is missing .prime-claw/workflows/handoff.md");
  const executePrompt = canonicalWorkflowPrompt(record.worktree!, "execute", {
    legacySnapshot: promptIdentity.legacySnapshot,
    location,
  });
  if (!executePrompt) throw new Error("Episode worktree is missing .agents/skills/execute/SKILL.md");
  const route = await reopenIfNeeded(record, session, ctx, publisher, store, repo);
  const state = await publisher.getState(route.activeSessionId);
  assertIdleEpisodeState(state, route.record, route.activeSessionId);
  await publisher.deliverHandoff(route.activeSessionId, handoffPrompt, executePrompt);
  return route.activeSessionId;
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
    ?? ((cwd: string, taskId: string) => resolveBacklogTask(cwd, taskId, runner));
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
    const record = store.read(repo);
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

    const existing = store.read(repo);
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

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function resolveTaskViewObject(
  cwd: string,
  taskId: string,
  runner: CommandRunner,
): Record<string, unknown> {
  const result = runner.run("backlog", ["task", "view", "--json", "--", taskId], { cwd });
  let parsed: unknown;
  try { parsed = JSON.parse(result.stdout); }
  catch (error) { throw new Error(`Backlog task ${taskId} returned invalid review JSON`, { cause: error }); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Backlog task ${taskId} returned invalid review payload`);
  }
  const task = (parsed as Record<string, unknown>).task;
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    throw new Error(`Backlog task ${taskId} review payload has no task object`);
  }
  const object = task as Record<string, unknown>;
  if (object.id !== taskId || typeof object.path !== "string" || !object.path
    || typeof object.status !== "string") {
    throw new Error(`Backlog task ${taskId} review identity is invalid`);
  }
  if (object.parentTaskId !== null && object.parentTaskId !== undefined
    && typeof object.parentTaskId !== "string") {
    throw new Error(`Backlog task ${taskId} review parent identity is invalid`);
  }
  if (object.implementationPlan !== null && object.implementationPlan !== undefined
    && typeof object.implementationPlan !== "string") {
    throw new Error(`Backlog task ${taskId} review plan is invalid`);
  }
  if (object.finalSummary !== null && object.finalSummary !== undefined
    && typeof object.finalSummary !== "string") {
    throw new Error(`Backlog task ${taskId} final summary is invalid`);
  }
  return object;
}

function taskContentObject(object: Record<string, unknown>): Record<string, unknown> {
  const episodeOwned = { ...object };
  delete episodeOwned.status;
  delete episodeOwned.updatedAt;
  for (const derived of [
    "isReady", "readiness", "dependencyGraph", "subtasks",
    "acceptanceCriteriaCompleted", "acceptanceCriteriaCount",
  ]) delete episodeOwned[derived];
  return episodeOwned;
}

export function resolveTaskReviewSnapshot(
  cwd: string,
  taskId: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): TaskReviewSnapshot {
  const object = resolveTaskViewObject(cwd, taskId, runner);
  const episodeOwned = taskContentObject(object);
  return {
    taskId,
    taskPath: object.path as string,
    parentTaskId: typeof object.parentTaskId === "string" ? object.parentTaskId : null,
    status: object.status as string,
    implementationPlan: typeof object.implementationPlan === "string" ? object.implementationPlan : null,
    contentDigest: createHash("sha256").update(stableJson(episodeOwned)).digest("hex"),
  };
}

export function resolveTaskAbandonmentSnapshot(
  cwd: string,
  taskId: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): TaskAbandonmentSnapshot {
  const object = resolveTaskViewObject(cwd, taskId, runner);
  const episodeOwned = taskContentObject(object);
  delete episodeOwned.finalSummary;
  delete episodeOwned.path;
  return {
    taskId,
    taskPath: object.path as string,
    parentTaskId: typeof object.parentTaskId === "string" ? object.parentTaskId : null,
    status: object.status as string,
    implementationPlan: typeof object.implementationPlan === "string" ? object.implementationPlan : null,
    contentDigest: createHash("sha256").update(stableJson(taskContentObject(object))).digest("hex"),
    finalSummary: typeof object.finalSummary === "string" ? object.finalSummary : null,
    abandonmentContentDigest: createHash("sha256").update(stableJson(episodeOwned)).digest("hex"),
  };
}

function unquoteBacklogScalar(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'"))
    || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function resolveTaskAbandonmentFileSnapshot(
  cwd: string,
  taskPath: string,
): TaskAbandonmentFileSnapshot {
  const absolute = resolve(cwd, taskPath);
  const root = realpathSync(cwd);
  const parent = realpathSync(dirname(absolute));
  const info = lstatSync(absolute);
  const realFile = realpathSync(absolute);
  if ((!samePath(parent, root) && !parent.startsWith(`${root}/`))
    || (!samePath(realFile, root) && !realFile.startsWith(`${root}/`))
    || !info.isFile() || info.isSymbolicLink()) {
    throw new Error("Abandonment task file is not a regular project file");
  }
  const raw = readFileSync(absolute, "utf8");
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw)?.[1];
  if (frontmatter === undefined) throw new Error("Abandonment task file has no Backlog frontmatter");
  const statusValue = /^status:\s*(.+)$/m.exec(frontmatter)?.[1];
  if (statusValue === undefined) throw new Error("Abandonment task file has no lifecycle status");
  const summaryMatch = /<!-- SECTION:FINAL_SUMMARY:BEGIN -->\r?\n([\s\S]*?)\r?\n<!-- SECTION:FINAL_SUMMARY:END -->/.exec(raw);
  const normalized = `${raw
    .replace(/^(status:)\s*.*$/m, "$1 <lifecycle-status>")
    .replace(/^updated_date:\s*.*(?:\r?\n)?/m, "")
    .replace(/\r?\n## Final Summary\r?\n\r?\n<!-- SECTION:FINAL_SUMMARY:BEGIN -->[\s\S]*?<!-- SECTION:FINAL_SUMMARY:END -->(?:\r?\n)?/, "\n")
    .trimEnd()}\n`;
  return {
    status: unquoteBacklogScalar(statusValue),
    finalSummary: summaryMatch ? summaryMatch[1].trim() : null,
    contentDigest: createHash("sha256").update(normalized).digest("hex"),
  };
}

function sameBacklogTaskIdentity(value: string, taskId: string, requirePrefix: boolean): boolean {
  const target = /^([a-z]+)-([0-9]+(?:\.[0-9]+)*)$/i.exec(taskId.trim());
  const candidate = /^(?:([a-z]+)-)?([0-9]+(?:\.[0-9]+)*)$/i.exec(value.trim());
  if (!target || !candidate || (requirePrefix && !candidate[1])) return false;
  if (candidate[1] && candidate[1].toLowerCase() !== target[1].toLowerCase()) return false;
  const canonical = (body: string) => body.split(".")
    .map((part) => part.replace(/^0+/, "") || "0").join(".");
  return canonical(candidate[2]) === canonical(target[2]);
}

export function assertNoTaskArchiveCleanupTargets(
  cwd: string,
  taskId: string,
  taskPath: string,
  runner: CommandRunner,
): void {
  const backlogRoot = dirname(dirname(resolve(cwd, taskPath)));
  const target = taskId.toUpperCase();
  for (const directory of [join(backlogRoot, "tasks"), join(backlogRoot, "completed")]) {
    if (!existsSync(directory)) continue;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const absolute = join(directory, entry.name);
      const info = lstatSync(absolute);
      if (!info.isFile() || info.isSymbolicLink()) {
        throw new Error("Abandonment preflight rejects non-regular Backlog task records");
      }
      const raw = readFileSync(absolute, "utf8");
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw)?.[1];
      const idValue = frontmatter ? /^id:\s*(.+)$/m.exec(frontmatter)?.[1] : undefined;
      if (!idValue) throw new Error(`Abandonment preflight could not identify ${entry.name}`);
      const id = unquoteBacklogScalar(idValue);
      if (id.toUpperCase() === target) continue;
      const object = resolveTaskViewObject(cwd, id, runner);
      const expectedPath = relative(cwd, absolute).split("\\").join("/");
      if (object.path !== expectedPath) {
        throw new Error(`Abandonment preflight found ambiguous Backlog identity ${id}`);
      }
      for (const field of ["dependencies", "references"] as const) {
        const values = object[field];
        if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
          throw new Error(`Abandonment preflight found invalid ${field} on ${id}`);
        }
        const requirePrefix = field === "references";
        if ((values as string[]).some((value) => sameBacklogTaskIdentity(value, taskId, requirePrefix))) {
          throw new Error(`Abandonment would rewrite ${field} on ${id}; remove that inbound link first`);
        }
      }
    }
  }
}

function commitConversationTaskStatus(options: {
  taskId: string;
  projectRoot: string;
  taskPath: string;
  status: "In Progress" | "In Planning" | "Blocked" | "Ready for Merge" | "Done";
  message: string;
  note?: string;
  runner: CommandRunner;
  git: TaskEpisodeAdmissionGit;
  resolveTask: (cwd: string, taskId: string) => BacklogTaskSelection | null;
}): { selection: BacklogTaskSelection; commit: string } {
  const args = ["task", "edit", "--status", options.status];
  if (options.note) args.push("--append-notes", options.note);
  args.push("--plain", "--", options.taskId);
  options.runner.run("backlog", args, { cwd: options.projectRoot });
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

type TaskEpisodeLifecycleTransition = {
  expectedMainStatus: "In Progress" | "Blocked" | "Ready for Merge";
  expectedEpisodeStatus?: "In Progress" | "Ready for Merge";
  expectedMainHead?: string;
  targetStatus: "Blocked" | "In Progress" | "Ready for Merge";
  message: string;
};

function publishTaskEpisodeLifecycleStatus(
  rawTaskId: string,
  rawEpisodeHead: string,
  ctx: ExtensionContext,
  transition: TaskEpisodeLifecycleTransition,
  dependencies: TaskEpisodeLifecycleDependencies = {},
): TaskEpisodeLifecycleResult {
  const git = dependencies.git ?? new CliGitAdapter();
  const lifecycleGit = dependencies.lifecycleGit ?? new CliTaskEpisodeAdmissionGit();
  const filesystem = dependencies.filesystem ?? new NodeFilesystemAdapter();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const runner = dependencies.lifecycleRunner ?? dependencies.taskRunner ?? new ProcessCommandRunner();
  const resolveTask = dependencies.taskResolver
    ?? ((cwd: string, taskId: string) => resolveBacklogTask(cwd, taskId, runner));
  const authority = resolveBlockedWorkflowAuthority(rawTaskId, ctx, {
    git,
    ownership: store,
    taskRunner: runner,
  });
  if (authority.mode !== "task") {
    throw new Error("Task-native lifecycle publication requires task-bound blocked-workflow authority");
  }
  const taskId = authority.taskId;
  const projectRoot = authority.projectRoot;
  const episodeHead = rawEpisodeHead.trim();
  if (!/^[0-9a-f]{40,64}$/.test(episodeHead)) {
    throw new Error("Task-native lifecycle publication requires the exact reported Episode commit");
  }
  if (!samePath(lifecycleGit.repositoryRoot(ctx.cwd), projectRoot)
    || lifecycleGit.branch(projectRoot) !== "main") {
    throw new Error("Task-native lifecycle publication status boundary does not match canonical primary main");
  }
  const record = store.read(projectRoot);
  if (!record) throw new Error(`No durable task-native Episode ownership exists for ${taskId}`);
  exactOwnedTaskRecord(record, taskId, ctx.sessionManager.getSessionId());
  if (record.status !== "active") {
    throw new Error(`Episode ownership is ${record.status}; inspect it before lifecycle publication`);
  }
  validateWorktreeRecord(record, git, filesystem, projectRoot);
  git.assertCleanWorktree(record.worktree!);

  const mainTask = exactAdmissionTask(
    resolveTask(projectRoot, taskId), taskId, projectRoot, record.taskPath,
  );
  if (lifecycleGit.pathStatus(projectRoot, record.taskPath) !== "") {
    throw new Error("Task-native lifecycle publication requires the exact main task path to match committed HEAD");
  }
  if (transition.expectedMainHead && lifecycleGit.head(projectRoot) !== transition.expectedMainHead) {
    throw new Error("Task-native lifecycle publication requires the previously verified exact main head");
  }
  if (mainTask.status !== transition.expectedMainStatus) {
    throw new Error(`Task-native lifecycle publication requires main task status ${transition.expectedMainStatus}; found ${mainTask.status}`);
  }
  if (!meaningfulTaskImplementationPlan(mainTask.implementationPlan)) {
    throw new Error("Task-native lifecycle publication requires a meaningful main-task Implementation Plan");
  }

  const episodeTask = exactAdmissionTask(
    resolveTask(record.worktree!, taskId), taskId, record.worktree!, record.taskPath,
  );
  const expectedEpisodeStatus = transition.expectedEpisodeStatus ?? "In Progress";
  if (episodeTask.status !== expectedEpisodeStatus) {
    throw new Error(`Task-native lifecycle publication requires Episode task status ${expectedEpisodeStatus}; found ${episodeTask.status}`);
  }
  if (!meaningfulTaskImplementationPlan(episodeTask.implementationPlan)) {
    throw new Error("Task-native lifecycle publication requires a meaningful Episode Implementation Plan");
  }
  if (lifecycleGit.pathStatus(record.worktree!, record.taskPath) !== "") {
    throw new Error("Task-native lifecycle publication requires committed Episode task content");
  }
  if (lifecycleGit.head(record.worktree!) !== episodeHead) {
    throw new Error("Task-native lifecycle publication does not match the exact reported Episode commit");
  }
  let upstreamHead: string;
  try { upstreamHead = lifecycleGit.upstreamHead(record.worktree!); }
  catch (error) {
    throw new Error("Task-native lifecycle publication requires the reported Episode commit to be pushed upstream", { cause: error });
  }
  if (upstreamHead !== episodeHead) {
    throw new Error("Task-native lifecycle publication requires upstream to contain the exact reported Episode commit");
  }
  if (!lifecycleGit.pathChangedBetween(record.worktree!, record.baseRef, episodeHead, record.taskPath)) {
    throw new Error("Task-native lifecycle publication requires committed Episode-owned task evidence after admission");
  }

  const published = commitConversationTaskStatus({
    taskId,
    projectRoot,
    taskPath: record.taskPath,
    status: transition.targetStatus,
    message: transition.message,
    runner,
    git: lifecycleGit,
    resolveTask,
  });
  const pushError = bestEffortTaskPush(lifecycleGit, projectRoot);
  return {
    taskId,
    status: transition.targetStatus,
    commit: published.commit,
    episodeHead,
    ...(pushError ? { pushError } : {}),
  };
}

/** Publish an accepted blocker report without copying Episode-owned task content. */
export function publishTaskEpisodeBlocked(
  taskId: string,
  episodeHead: string,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeLifecycleDependencies = {},
): TaskEpisodeLifecycleResult {
  return publishTaskEpisodeLifecycleStatus(taskId, episodeHead, ctx, {
    expectedMainStatus: "In Progress",
    targetStatus: "Blocked",
    message: `chore: block ${taskId.trim()} episode`,
  }, dependencies);
}

/** Publish an accepted unblock decision before continuing the same Episode. */
export function publishTaskEpisodeResumed(
  taskId: string,
  episodeHead: string,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeLifecycleDependencies = {},
): TaskEpisodeLifecycleResult {
  return publishTaskEpisodeLifecycleStatus(taskId, episodeHead, ctx, {
    expectedMainStatus: "Blocked",
    targetStatus: "In Progress",
    message: `chore: resume ${taskId.trim()} episode`,
  }, dependencies);
}

/** Publish the accepted exact candidate as Ready for Merge on main. */
export function publishTaskEpisodeReadyForMerge(
  taskId: string,
  episodeHead: string,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeReadyForMergeDependencies = {},
): TaskEpisodeReadyPublicationResult {
  const runner = dependencies.lifecycleRunner ?? dependencies.taskRunner ?? new ProcessCommandRunner();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const authority = resolveBlockedWorkflowAuthority(taskId, ctx, {
    git: dependencies.git,
    ownership: store,
    taskRunner: runner,
  });
  if (authority.mode !== "task") throw new Error("Ready-for-Merge publication requires task-native owner authority");
  const record = store.read(authority.projectRoot);
  if (!record) throw new Error(`No durable task-native Episode ownership exists for ${authority.taskId}`);
  exactOwnedTaskRecord(record, authority.taskId, ctx.sessionManager.getSessionId());
  const resolveSnapshot = dependencies.taskSnapshotResolver ?? ((cwd, id) => resolveTaskReviewSnapshot(cwd, id, runner));
  const mainSnapshot = resolveSnapshot(authority.projectRoot, authority.taskId);
  const snapshot = resolveSnapshot(record.worktree!, authority.taskId);
  if (snapshot.taskId !== authority.taskId || snapshot.taskPath !== record.taskPath
    || mainSnapshot.taskId !== authority.taskId || mainSnapshot.taskPath !== record.taskPath
    || mainSnapshot.parentTaskId !== snapshot.parentTaskId) {
    throw new Error("Ready-for-Merge publication does not match the exact task identity, path, and hierarchy in both checkouts");
  }
  if (snapshot.status !== "In Progress" || !meaningfulTaskImplementationPlan(snapshot.implementationPlan)) {
    throw new Error("Ready-for-Merge publication requires the complete Episode task to remain In Progress with a meaningful plan");
  }
  const published = publishTaskEpisodeLifecycleStatus(taskId, episodeHead, ctx, {
    expectedMainStatus: "In Progress",
    targetStatus: "Ready for Merge",
    message: `chore: mark ${taskId.trim()} ready for merge`,
  }, dependencies);
  return {
    ...published,
    status: "Ready for Merge",
    parentTaskId: snapshot.parentTaskId,
    episodeTaskContentDigest: snapshot.contentDigest,
  };
}

async function assertReadyIntegrationEpisodeIdle(
  record: TaskEpisodeOwnershipRecord,
  dependencies: TaskEpisodeReadyForMergeDependencies,
): Promise<void> {
  const publisher = dependencies.publisher ?? new PrimeSessionPublisher();
  const orca = dependencies.orca ?? new CliOrcaAdapter();
  try {
    if (record.engine === "orca") {
      const current = await orca.showWorktree(record.worktreeId!, record.routingEnvironmentId);
      if (current.identity !== record.worktreeIdentity || !samePath(current.path, record.worktree!)) {
        throw new Error("Ready-for-Merge integration Orca worktree identity no longer matches ownership");
      }
    }
    const session = await durableSession(record, publisher);
    if (!session.cwd || !samePath(session.cwd, record.worktree!)) {
      throw new Error("Ready-for-Merge integration durable session is not rooted at the owned worktree");
    }
    if (sessionIsBusy(session)) throw new Error("Ready-for-Merge integration requires the owned Episode to be idle");
    if (session.activeSessionId) {
      const state = await publisher.getState(session.activeSessionId);
      assertIdleEpisodeState(state, record, session.activeSessionId);
    }
  } finally { try { publisher.close(); } catch { /* do not mask integration preflight */ } }
}

/**
 * Merge current main into the same owned Episode worktree. The exact Episode
 * task is restored from the accepted candidate and only its Conversation-owned
 * lifecycle status is changed through Backlog before the merge commit.
 */
type TaskEpisodeReviewTransition = {
  label: "Ready-for-Merge" | "Request-Changes";
  taskId: string;
  statusCommit: string;
  baseEpisodeHead: string;
  expectedMainStatus: "Ready for Merge" | "In Progress";
  expectedEpisodeStatus: "In Progress" | "Ready for Merge";
  targetEpisodeStatus: "Ready for Merge" | "In Progress";
  parentTaskId: string | null;
  episodeTaskContentDigest: string;
  mergeMessage: string;
};
type TaskEpisodeReviewTransitionIntegration = {
  taskId: string;
  statusCommit: string;
  baseEpisodeHead: string;
  integratedMainHead: string;
  refreshedEpisodeHead: string;
  parentTaskId: string | null;
  episodeTaskContentDigest: string;
  pushError?: string;
};

async function integrateTaskEpisodeReviewTransition(
  transition: TaskEpisodeReviewTransition,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeReadyForMergeDependencies,
): Promise<TaskEpisodeReviewTransitionIntegration> {
  const git = dependencies.git ?? new CliGitAdapter();
  const reviewGit = dependencies.reviewGit ?? new CliTaskEpisodeAdmissionGit();
  const filesystem = dependencies.filesystem ?? new NodeFilesystemAdapter();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const runner = dependencies.lifecycleRunner ?? dependencies.taskRunner ?? new ProcessCommandRunner();
  const resolveTask = dependencies.taskResolver
    ?? ((cwd: string, id: string) => resolveBacklogTask(cwd, id, runner));
  const resolveSnapshot = dependencies.taskSnapshotResolver
    ?? ((cwd: string, id: string) => resolveTaskReviewSnapshot(cwd, id, runner));
  const authority = resolveBlockedWorkflowAuthority(transition.taskId, ctx, { git, ownership: store, taskRunner: runner });
  if (authority.mode !== "task") throw new Error(`${transition.label} integration requires task-native owner authority`);
  const projectRoot = authority.projectRoot;
  if (!samePath(reviewGit.repositoryRoot(ctx.cwd), projectRoot) || reviewGit.branch(projectRoot) !== "main") {
    throw new Error(`${transition.label} integration status boundary does not match canonical primary main`);
  }
  const record = store.read(projectRoot);
  if (!record) throw new Error(`No durable task-native Episode ownership exists for ${authority.taskId}`);
  exactOwnedTaskRecord(record, authority.taskId, ctx.sessionManager.getSessionId());
  if (record.status !== "active") throw new Error(`Episode ownership is ${record.status}; inspect it before review integration`);
  validateWorktreeRecord(record, git, filesystem, projectRoot);
  await assertReadyIntegrationEpisodeIdle(record, dependencies);
  git.assertCleanWorktree(record.worktree!);
  if (reviewGit.pathStatus(projectRoot, record.taskPath) !== "") {
    throw new Error(`${transition.label} integration requires the exact main task path to match committed HEAD`);
  }
  const mainTask = exactAdmissionTask(resolveTask(projectRoot, authority.taskId), authority.taskId, projectRoot, record.taskPath);
  const mainSnapshot = resolveSnapshot(projectRoot, authority.taskId);
  if (mainSnapshot.taskPath !== record.taskPath || mainSnapshot.parentTaskId !== transition.parentTaskId) {
    throw new Error(`${transition.label} integration main task identity or hierarchy changed after publication`);
  }
  if (mainTask.status !== transition.expectedMainStatus || mainSnapshot.status !== transition.expectedMainStatus) {
    throw new Error(`${transition.label} integration requires main task status ${transition.expectedMainStatus}; found ${mainTask.status}`);
  }
  const publicationPaths = reviewGit.commitPaths(projectRoot, transition.statusCommit);
  if (publicationPaths.length !== 1 || publicationPaths[0] !== record.taskPath) {
    throw new Error(`${transition.label} publication commit must contain only the exact task path`);
  }
  const mainHead = reviewGit.head(projectRoot);
  if (!reviewGit.isAncestor(projectRoot, transition.statusCommit, mainHead)) {
    throw new Error(`${transition.label} publication commit is not contained in current main`);
  }
  const episodeHead = reviewGit.head(record.worktree!);
  const upstreamHead = reviewGit.upstreamHead(record.worktree!);
  if (reviewGit.pathStatus(record.worktree!, record.taskPath) !== "") {
    throw new Error(`${transition.label} integration requires committed Episode task content`);
  }
  const episodeTask = exactAdmissionTask(
    resolveTask(record.worktree!, authority.taskId), authority.taskId, record.worktree!, record.taskPath,
  );
  const before = resolveSnapshot(record.worktree!, authority.taskId);

  if (episodeHead !== transition.baseEpisodeHead) {
    const parents = reviewGit.parents(record.worktree!, episodeHead);
    if (parents.length !== 2 || parents[0] !== transition.baseEpisodeHead || parents[1] !== mainHead
      || episodeTask.status !== transition.targetEpisodeStatus
      || before.status !== transition.targetEpisodeStatus
      || before.taskPath !== record.taskPath
      || before.parentTaskId !== transition.parentTaskId
      || before.contentDigest !== transition.episodeTaskContentDigest) {
      throw new Error(`${transition.label} integration local head is not the exact retryable two-parent candidate`);
    }
    if (upstreamHead !== transition.baseEpisodeHead && upstreamHead !== episodeHead) {
      throw new Error(`${transition.label} integration upstream head is neither the prior nor exact refreshed candidate`);
    }
    const pushError = upstreamHead === episodeHead ? undefined : bestEffortTaskPush(reviewGit, record.worktree!);
    return {
      taskId: authority.taskId,
      statusCommit: transition.statusCommit,
      baseEpisodeHead: transition.baseEpisodeHead,
      integratedMainHead: mainHead,
      refreshedEpisodeHead: episodeHead,
      parentTaskId: before.parentTaskId,
      episodeTaskContentDigest: before.contentDigest,
      ...(pushError ? { pushError } : {}),
    };
  }
  if (upstreamHead !== transition.baseEpisodeHead) {
    throw new Error(`${transition.label} integration requires the prior Episode candidate to remain exact and pushed`);
  }
  if (episodeTask.status !== transition.expectedEpisodeStatus) {
    throw new Error(`${transition.label} integration requires Episode status ${transition.expectedEpisodeStatus}; found ${episodeTask.status}`);
  }
  if (before.taskPath !== record.taskPath || before.parentTaskId !== transition.parentTaskId
    || before.contentDigest !== transition.episodeTaskContentDigest) {
    throw new Error(`${transition.label} integration candidate content or invariant identity changed after status publication`);
  }

  let mergeStarted = false;
  try {
    mergeStarted = true;
    reviewGit.mergeMain(record.worktree!, mainHead, record.taskPath);
    reviewGit.restoreTaskFromHead(record.worktree!, record.taskPath);
    runner.run("backlog", ["task", "edit", "--status", transition.targetEpisodeStatus, "--plain", "--", authority.taskId], { cwd: record.worktree! });
    const mergedTask = exactAdmissionTask(
      resolveTask(record.worktree!, authority.taskId), authority.taskId, record.worktree!, record.taskPath,
    );
    const after = resolveSnapshot(record.worktree!, authority.taskId);
    if (mergedTask.status !== transition.targetEpisodeStatus || after.status !== transition.targetEpisodeStatus) {
      throw new Error(`${transition.label} integration did not retain the Conversation-owned lifecycle status`);
    }
    if (after.parentTaskId !== before.parentTaskId || after.contentDigest !== before.contentDigest) {
      throw new Error(`${transition.label} integration changed Episode-owned task content or hierarchy`);
    }
    reviewGit.stagePath(record.worktree!, record.taskPath);
    const refreshedEpisodeHead = reviewGit.commitMerge(record.worktree!, transition.mergeMessage);
    mergeStarted = false;
    const parents = reviewGit.parents(record.worktree!, refreshedEpisodeHead);
    if (parents.length !== 2 || parents[0] !== transition.baseEpisodeHead || parents[1] !== mainHead) {
      throw new Error(`${transition.label} integration did not create the exact two-parent refreshed candidate`);
    }
    git.assertCleanWorktree(record.worktree!);
    const pushError = bestEffortTaskPush(reviewGit, record.worktree!);
    return {
      taskId: authority.taskId,
      statusCommit: transition.statusCommit,
      baseEpisodeHead: transition.baseEpisodeHead,
      integratedMainHead: mainHead,
      refreshedEpisodeHead,
      parentTaskId: after.parentTaskId,
      episodeTaskContentDigest: after.contentDigest,
      ...(pushError ? { pushError } : {}),
    };
  } catch (error) {
    if (mergeStarted) { try { reviewGit.abortMerge(record.worktree!); } catch { /* preserve original integration failure */ } }
    throw error;
  }
}

export async function integrateTaskEpisodeReadyForMerge(
  publication: TaskEpisodeReadyPublicationResult,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeReadyForMergeDependencies = {},
): Promise<TaskEpisodeReadyIntegrationResult> {
  if (publication.status !== "Ready for Merge") throw new Error("Ready-for-Merge integration requires its exact publication result");
  const integrated = await integrateTaskEpisodeReviewTransition({
    label: "Ready-for-Merge",
    taskId: publication.taskId,
    statusCommit: publication.commit,
    baseEpisodeHead: publication.episodeHead,
    expectedMainStatus: "Ready for Merge",
    expectedEpisodeStatus: "In Progress",
    targetEpisodeStatus: "Ready for Merge",
    parentTaskId: publication.parentTaskId,
    episodeTaskContentDigest: publication.episodeTaskContentDigest,
    mergeMessage: `chore: integrate main for ${publication.taskId} review`,
  }, ctx, dependencies);
  return {
    taskId: integrated.taskId,
    readyCommit: integrated.statusCommit,
    acceptedEpisodeHead: integrated.baseEpisodeHead,
    integratedMainHead: integrated.integratedMainHead,
    refreshedEpisodeHead: integrated.refreshedEpisodeHead,
    parentTaskId: integrated.parentTaskId,
    episodeTaskContentDigest: integrated.episodeTaskContentDigest,
    ...(integrated.pushError ? { pushError: integrated.pushError } : {}),
  };
}

/** Verify the pushed refreshed candidate before any operator merge decision. */
export function verifyTaskEpisodeReadyForMerge(
  publication: TaskEpisodeReadyPublicationResult,
  integration: TaskEpisodeReadyIntegrationResult,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeReadyForMergeDependencies = {},
): TaskEpisodeReadyVerificationResult {
  const git = dependencies.git ?? new CliGitAdapter();
  const reviewGit = dependencies.reviewGit ?? new CliTaskEpisodeAdmissionGit();
  const filesystem = dependencies.filesystem ?? new NodeFilesystemAdapter();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const runner = dependencies.lifecycleRunner ?? dependencies.taskRunner ?? new ProcessCommandRunner();
  const resolveTask = dependencies.taskResolver
    ?? ((cwd: string, id: string) => resolveBacklogTask(cwd, id, runner));
  const resolveSnapshot = dependencies.taskSnapshotResolver
    ?? ((cwd: string, id: string) => resolveTaskReviewSnapshot(cwd, id, runner));
  if (integration.taskId !== publication.taskId
    || integration.readyCommit !== publication.commit
    || integration.acceptedEpisodeHead !== publication.episodeHead
    || integration.parentTaskId !== publication.parentTaskId
    || integration.episodeTaskContentDigest !== publication.episodeTaskContentDigest) {
    throw new Error("Ready-for-Merge verification inputs do not describe one exact handshake");
  }
  const authority = resolveBlockedWorkflowAuthority(publication.taskId, ctx, { git, ownership: store, taskRunner: runner });
  if (authority.mode !== "task") throw new Error("Ready-for-Merge verification requires task-native owner authority");
  const projectRoot = authority.projectRoot;
  const record = store.read(projectRoot);
  if (!record) throw new Error(`No durable task-native Episode ownership exists for ${authority.taskId}`);
  exactOwnedTaskRecord(record, authority.taskId, ctx.sessionManager.getSessionId());
  if (record.status !== "active") throw new Error(`Episode ownership is ${record.status}; inspect it before review verification`);
  validateWorktreeRecord(record, git, filesystem, projectRoot);
  if (reviewGit.head(projectRoot) !== integration.integratedMainHead) {
    throw new Error("Ready-for-Merge verification requires a refreshed candidate against current main");
  }
  if (reviewGit.pathStatus(projectRoot, record.taskPath) !== "") {
    throw new Error("Ready-for-Merge verification requires committed main task content");
  }
  const mainTask = exactAdmissionTask(resolveTask(projectRoot, authority.taskId), authority.taskId, projectRoot, record.taskPath);
  const mainSnapshot = resolveSnapshot(projectRoot, authority.taskId);
  if (mainTask.status !== "Ready for Merge" || mainSnapshot.status !== "Ready for Merge") {
    throw new Error(`Ready-for-Merge verification requires main status Ready for Merge; found ${mainTask.status}`);
  }
  if (mainSnapshot.taskPath !== record.taskPath || mainSnapshot.parentTaskId !== publication.parentTaskId) {
    throw new Error("Ready-for-Merge verification found changed main task identity or hierarchy");
  }
  if (reviewGit.head(record.worktree!) !== integration.refreshedEpisodeHead
    || reviewGit.upstreamHead(record.worktree!) !== integration.refreshedEpisodeHead) {
    throw new Error("Ready-for-Merge verification requires the exact refreshed Episode candidate to be pushed");
  }
  git.assertCleanWorktree(record.worktree!);
  const episodeTask = exactAdmissionTask(
    resolveTask(record.worktree!, authority.taskId), authority.taskId, record.worktree!, record.taskPath,
  );
  const snapshot = resolveSnapshot(record.worktree!, authority.taskId);
  if (episodeTask.status !== "Ready for Merge" || snapshot.status !== "Ready for Merge"
    || snapshot.parentTaskId !== publication.parentTaskId
    || snapshot.contentDigest !== publication.episodeTaskContentDigest) {
    throw new Error("Ready-for-Merge refreshed candidate does not preserve exact task content, hierarchy, and status");
  }
  const parents = reviewGit.parents(record.worktree!, integration.refreshedEpisodeHead);
  if (parents.length !== 2 || parents[0] !== publication.episodeHead || parents[1] !== integration.integratedMainHead
    || !reviewGit.isAncestor(projectRoot, publication.commit, integration.integratedMainHead)
    || !reviewGit.isAncestor(record.worktree!, integration.integratedMainHead, integration.refreshedEpisodeHead)) {
    throw new Error("Ready-for-Merge refreshed candidate does not contain the exact accepted candidate and current main");
  }
  return {
    verified: true,
    taskId: authority.taskId,
    mainHead: integration.integratedMainHead,
    refreshedEpisodeHead: integration.refreshedEpisodeHead,
  };
}

async function verifyReadyOperatorDecision(
  evidence: TaskEpisodeReadyHandshakeEvidence,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeReadyForMergeDependencies,
): Promise<TaskEpisodeReadyVerificationResult> {
  const current = verifyTaskEpisodeReadyForMerge(evidence.publication, evidence.integration, ctx, dependencies);
  if (!evidence.verification.verified
    || evidence.verification.taskId !== current.taskId
    || evidence.verification.mainHead !== current.mainHead
    || evidence.verification.refreshedEpisodeHead !== current.refreshedEpisodeHead) {
    throw new Error("Operator outcome requires the previously verified exact refreshed candidate and current main");
  }
  const git = dependencies.git ?? new CliGitAdapter();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const runner = dependencies.lifecycleRunner ?? dependencies.taskRunner ?? new ProcessCommandRunner();
  const authority = resolveBlockedWorkflowAuthority(current.taskId, ctx, { git, ownership: store, taskRunner: runner });
  if (authority.mode !== "task") throw new Error("Operator outcome requires task-native owner authority");
  const record = store.read(authority.projectRoot);
  if (!record) throw new Error(`No durable task-native Episode ownership exists for ${authority.taskId}`);
  exactOwnedTaskRecord(record, authority.taskId, ctx.sessionManager.getSessionId());
  if (record.status !== "active") throw new Error(`Episode ownership is ${record.status}; inspect it before an operator outcome`);
  await assertReadyIntegrationEpisodeIdle(record, dependencies);
  return current;
}

/** Record the reversible Delay decision without mutating or transporting any state. */
export async function delayTaskEpisodeReadyForMerge(
  evidence: TaskEpisodeReadyHandshakeEvidence,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeReadyForMergeDependencies = {},
  decision: TaskEpisodeOperatorDecision,
): Promise<TaskEpisodeDelayResult> {
  if (decision.operatorDecision !== "delay") {
    throw new Error("Delay requires the explicit operator Delay decision");
  }
  const verified = await verifyReadyOperatorDecision(evidence, ctx, dependencies);
  return { ...verified, outcome: "delayed" };
}

/** Merge only an explicitly authorized exact candidate, then publish exact-task Done. */
export async function mergeTaskEpisodeReadyForMerge(
  evidence: TaskEpisodeReadyHandshakeEvidence,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeReadyForMergeDependencies = {},
  decision: TaskEpisodeMergeDecision,
): Promise<TaskEpisodeMergeResult> {
  if (decision.operatorDecision !== "merge") {
    throw new Error("Merge requires the explicit operator Merge decision");
  }
  const { publication, integration, verification } = evidence;
  if (publication.status !== "Ready for Merge"
    || integration.taskId !== publication.taskId
    || integration.readyCommit !== publication.commit
    || integration.acceptedEpisodeHead !== publication.episodeHead
    || integration.parentTaskId !== publication.parentTaskId
    || integration.episodeTaskContentDigest !== publication.episodeTaskContentDigest
    || !verification.verified
    || verification.taskId !== publication.taskId
    || verification.mainHead !== integration.integratedMainHead
    || verification.refreshedEpisodeHead !== integration.refreshedEpisodeHead) {
    throw new Error("Merge requires one exact previously verified Ready-for-Merge handshake");
  }
  if (decision.taskId !== verification.taskId
    || decision.mainHead !== verification.mainHead
    || decision.refreshedEpisodeHead !== verification.refreshedEpisodeHead) {
    throw new Error("Merge authority does not bind the exact verified task, main, and refreshed candidate");
  }
  const mergeGit = dependencies.mergeGit
    ?? (dependencies.reviewGit as TaskEpisodeMergeGit | undefined)
    ?? new CliTaskEpisodeAdmissionGit();
  if (typeof mergeGit.fastForward !== "function") {
    throw new Error("Task-native merge requires an exact fast-forward Git adapter");
  }
  const git = dependencies.git ?? new CliGitAdapter();
  const filesystem = dependencies.filesystem ?? new NodeFilesystemAdapter();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const runner = dependencies.lifecycleRunner ?? dependencies.taskRunner ?? new ProcessCommandRunner();
  const resolveTask = dependencies.taskResolver
    ?? ((cwd: string, id: string) => resolveBacklogTask(cwd, id, runner));
  const resolveSnapshot = dependencies.taskSnapshotResolver
    ?? ((cwd: string, id: string) => resolveTaskReviewSnapshot(cwd, id, runner));
  const authority = resolveBlockedWorkflowAuthority(verification.taskId, ctx, {
    git, ownership: store, taskRunner: runner,
  });
  if (authority.mode !== "task") throw new Error("Merge requires task-native owner authority");
  const projectRoot = authority.projectRoot;
  const record = store.read(projectRoot);
  if (!record) throw new Error(`No durable task-native Episode ownership exists for ${authority.taskId}`);
  exactOwnedTaskRecord(record, authority.taskId, ctx.sessionManager.getSessionId());
  if (record.status !== "active") throw new Error(`Episode ownership is ${record.status}; inspect it before merge`);
  validateWorktreeRecord(record, git, filesystem, projectRoot);
  await assertReadyIntegrationEpisodeIdle(record, { ...dependencies, reviewGit: mergeGit });
  const retainedOwnership = stableJson(record);

  git.assertCleanWorktree(record.worktree!);
  if (mergeGit.head(record.worktree!) !== verification.refreshedEpisodeHead
    || mergeGit.upstreamHead(record.worktree!) !== verification.refreshedEpisodeHead) {
    throw new Error("Merge requires the exact refreshed Episode candidate to remain pushed");
  }
  const episodeTask = exactAdmissionTask(
    resolveTask(record.worktree!, authority.taskId), authority.taskId, record.worktree!, record.taskPath,
  );
  const episodeSnapshot = resolveSnapshot(record.worktree!, authority.taskId);
  if (episodeTask.status !== "Ready for Merge" || episodeSnapshot.status !== "Ready for Merge"
    || episodeSnapshot.taskPath !== record.taskPath
    || episodeSnapshot.parentTaskId !== publication.parentTaskId
    || episodeSnapshot.contentDigest !== publication.episodeTaskContentDigest) {
    throw new Error("Merge candidate no longer preserves the exact reviewed task content, hierarchy, and status");
  }
  const candidateParents = mergeGit.parents(record.worktree!, verification.refreshedEpisodeHead);
  if (candidateParents.length !== 2
    || candidateParents[0] !== publication.episodeHead
    || candidateParents[1] !== verification.mainHead
    || !mergeGit.isAncestor(projectRoot, publication.commit, verification.mainHead)
    || !mergeGit.isAncestor(record.worktree!, verification.mainHead, verification.refreshedEpisodeHead)) {
    throw new Error("Merge candidate no longer has the exact reviewed ancestry");
  }

  let mainHead = mergeGit.head(projectRoot);
  let mainChanges = mergeGit.worktreeChanges(projectRoot);
  let recoverDirtyDone = false;
  if (mainChanges.length > 0) {
    const onlyTaskModification = mainHead === verification.refreshedEpisodeHead
      && mainChanges.length === 1
      && mainChanges[0].path === record.taskPath
      && /^[ M]{2}$/.test(mainChanges[0].status)
      && mainChanges[0].status.includes("M");
    if (!onlyTaskModification) {
      throw new Error("Merge recovery rejects canonical-main changes outside the exact modified task");
    }
    const partialTask = exactAdmissionTask(
      resolveTask(projectRoot, authority.taskId), authority.taskId, projectRoot, record.taskPath,
    );
    const partialSnapshot = resolveSnapshot(projectRoot, authority.taskId);
    if (partialTask.status !== "Done" || partialSnapshot.status !== "Done"
      || partialSnapshot.taskPath !== record.taskPath
      || partialSnapshot.parentTaskId !== publication.parentTaskId
      || partialSnapshot.contentDigest !== publication.episodeTaskContentDigest) {
      throw new Error("Dirty Done recovery does not preserve the exact task content, identity, and hierarchy");
    }
    recoverDirtyDone = true;
  } else git.assertCleanWorktree(projectRoot);

  let doneCommit: string | undefined;
  if (mainHead === verification.mainHead) {
    if (recoverDirtyDone || mergeGit.upstreamHead(projectRoot) !== verification.mainHead) {
      throw new Error("Merge requires canonical main and its upstream to remain at the exact verified head");
    }
    const mainTask = exactAdmissionTask(
      resolveTask(projectRoot, authority.taskId), authority.taskId, projectRoot, record.taskPath,
    );
    const mainSnapshot = resolveSnapshot(projectRoot, authority.taskId);
    if (mainTask.status !== "Ready for Merge" || mainSnapshot.status !== "Ready for Merge"
      || mainSnapshot.taskPath !== record.taskPath
      || mainSnapshot.parentTaskId !== publication.parentTaskId) {
      throw new Error("Merge requires the exact current Ready-for-Merge task on canonical main");
    }
    mergeGit.fastForward(projectRoot, verification.refreshedEpisodeHead);
    mainHead = mergeGit.head(projectRoot);
    if (mainHead !== verification.refreshedEpisodeHead) {
      throw new Error("Canonical main did not reach the exact reviewed candidate");
    }
    mainChanges = mergeGit.worktreeChanges(projectRoot);
    if (mainChanges.length > 0) {
      throw new Error("Canonical main became dirty after the exact candidate fast-forward");
    }
    git.assertCleanWorktree(projectRoot);
  }

  if (mainHead === verification.refreshedEpisodeHead) {
    const upstream = mergeGit.upstreamHead(projectRoot);
    if (upstream !== verification.mainHead && upstream !== verification.refreshedEpisodeHead) {
      throw new Error("Merged candidate recovery requires canonical main upstream at the prior main or exact candidate");
    }
    if (recoverDirtyDone) {
      doneCommit = mergeGit.commitOnlyPath(
        projectRoot, record.taskPath, `chore: complete ${authority.taskId}`,
      );
      mainHead = doneCommit;
    } else {
      const mergedTask = exactAdmissionTask(
        resolveTask(projectRoot, authority.taskId), authority.taskId, projectRoot, record.taskPath,
      );
      const mergedSnapshot = resolveSnapshot(projectRoot, authority.taskId);
      if (mergedTask.status !== "Ready for Merge" || mergedSnapshot.status !== "Ready for Merge"
        || mergedSnapshot.taskPath !== record.taskPath
        || mergedSnapshot.parentTaskId !== publication.parentTaskId
        || mergedSnapshot.contentDigest !== publication.episodeTaskContentDigest) {
        throw new Error("Merged candidate does not preserve the exact reviewed task content, hierarchy, and status");
      }
      const done = commitConversationTaskStatus({
        taskId: authority.taskId,
        projectRoot,
        taskPath: record.taskPath,
        status: "Done",
        message: `chore: complete ${authority.taskId}`,
        runner,
        git: mergeGit,
        resolveTask,
      });
      doneCommit = done.commit;
      mainHead = done.commit;
    }
  } else {
    if (recoverDirtyDone) {
      throw new Error("Dirty Done recovery requires canonical main at the exact merged candidate");
    }
    const parents = mergeGit.parents(projectRoot, mainHead);
    const paths = mergeGit.commitPaths(projectRoot, mainHead);
    if (parents.length !== 1 || parents[0] !== verification.refreshedEpisodeHead
      || paths.length !== 1 || paths[0] !== record.taskPath) {
      throw new Error("Canonical main is neither the verified pre-merge head, exact candidate, nor exact Done child");
    }
    doneCommit = mainHead;
  }

  const doneParents = mergeGit.parents(projectRoot, doneCommit);
  const donePaths = mergeGit.commitPaths(projectRoot, doneCommit);
  if (mergeGit.head(projectRoot) !== doneCommit
    || doneParents.length !== 1 || doneParents[0] !== verification.refreshedEpisodeHead
    || donePaths.length !== 1 || donePaths[0] !== record.taskPath) {
    throw new Error("Done publication does not directly follow the exact merged candidate as a one-task commit");
  }
  const doneTask = exactAdmissionTask(
    resolveTask(projectRoot, authority.taskId), authority.taskId, projectRoot, record.taskPath,
  );
  const doneSnapshot = resolveSnapshot(projectRoot, authority.taskId);
  if (doneTask.status !== "Done" || doneSnapshot.status !== "Done"
    || doneSnapshot.taskPath !== record.taskPath
    || doneSnapshot.parentTaskId !== publication.parentTaskId
    || doneSnapshot.contentDigest !== publication.episodeTaskContentDigest) {
    throw new Error("Done publication changed the exact task content, identity, or hierarchy");
  }
  git.assertCleanWorktree(projectRoot);
  const retained = store.read(projectRoot);
  if (!retained) throw new Error("Task-native ownership disappeared after merge");
  exactOwnedTaskRecord(retained, authority.taskId, ctx.sessionManager.getSessionId());
  if (retained.status !== "active" || stableJson(retained) !== retainedOwnership) {
    throw new Error("Merge and Done publication must retain the exact active Episode ownership and resources");
  }

  let pushError = bestEffortTaskPush(mergeGit, projectRoot);
  if (!pushError) {
    try {
      const observed = mergeGit.upstreamHead(projectRoot);
      if (observed !== doneCommit) {
        pushError = `Done push verification expected ${doneCommit} but observed ${observed}`;
      }
    } catch (error) {
      pushError = `Done push verification failed: ${taskAdmissionError(error)}`;
    }
  }
  return {
    verified: true,
    outcome: "merged",
    taskId: authority.taskId,
    status: "Done",
    priorMainHead: verification.mainHead,
    mergedHead: verification.refreshedEpisodeHead,
    doneCommit,
    parentTaskId: doneSnapshot.parentTaskId,
    episodeTaskContentDigest: doneSnapshot.contentDigest,
    ...(pushError ? { pushError } : {}),
  };
}

function expectedArchivedTaskPath(taskPath: string): string {
  const activeDirectory = dirname(taskPath);
  if (basename(activeDirectory) !== "tasks") {
    throw new Error("Task abandonment requires the canonical Backlog active-task path");
  }
  return join(dirname(activeDirectory), "archive", "tasks", basename(taskPath));
}

export function assertNoHistoricalTaskArchiveCollision(
  repo: string,
  boundMainHead: string,
  archivePath: string,
  git: Pick<TaskEpisodeAbandonmentGit, "pathTrackedAtRef">,
): void {
  if (git.pathTrackedAtRef(repo, boundMainHead, archivePath)) {
    throw new Error(`Abandonment archive destination already exists in bound main history: ${archivePath}`);
  }
}

function exactPathSet(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length
    && [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
}

function exactArchiveMoveChanges(
  changes: GitWorktreeChange[],
  activePath: string,
  archivePath: string,
): boolean {
  if (changes.length === 1 && changes[0].status.includes("R")) {
    const names = changes[0].path.split(" -> ");
    return exactPathSet(names, [activePath, archivePath]);
  }
  if (changes.length !== 2) return false;
  const active = changes.find((change) => change.path === activePath);
  const archived = changes.find((change) => change.path === archivePath);
  return Boolean(active && archived
    && active.status.includes("D")
    && (archived.status === "??" || archived.status.includes("A")));
}

export function prepareTaskEpisodeAbandonmentDecision(
  taskId: string,
  episodeHead: string,
  finalSummary: string,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeAbandonmentDependencies = {},
): TaskEpisodeAbandonmentDecision {
  if (!finalSummary.trim() || finalSummary !== finalSummary.trim()) {
    throw new Error("Task abandonment requires one normalized truthful non-empty Final Summary");
  }
  const git = dependencies.git ?? new CliGitAdapter();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const runner = dependencies.lifecycleRunner ?? dependencies.taskRunner ?? new ProcessCommandRunner();
  const abandonmentGit = dependencies.abandonmentGit
    ?? (dependencies.mergeGit as TaskEpisodeAbandonmentGit | undefined)
    ?? new CliTaskEpisodeAdmissionGit();
  const resolveAbandonment = dependencies.abandonmentSnapshotResolver
    ?? ((cwd: string, id: string) => resolveTaskAbandonmentSnapshot(cwd, id, runner));
  const authority = resolveBlockedWorkflowAuthority(taskId, ctx, {
    git, ownership: store, taskRunner: runner,
  });
  if (authority.mode !== "task") throw new Error("Task abandonment requires task-native owner authority");
  const record = store.read(authority.projectRoot);
  if (!record) throw new Error(`No durable task-native Episode ownership exists for ${authority.taskId}`);
  exactOwnedTaskRecord(record, authority.taskId, ctx.sessionManager.getSessionId());
  if (record.status !== "active") throw new Error(`Episode ownership is ${record.status}; inspect it before abandonment`);
  const mainHead = abandonmentGit.head(authority.projectRoot);
  const mainSnapshot = resolveAbandonment(authority.projectRoot, authority.taskId);
  const episodeSnapshot = resolveAbandonment(record.worktree!, authority.taskId);
  const relationship = mainHead === episodeHead
    ? "same"
    : abandonmentGit.isAncestor(authority.projectRoot, mainHead, episodeHead)
      ? "main-ancestor"
      : abandonmentGit.isAncestor(authority.projectRoot, episodeHead, mainHead)
        ? "episode-ancestor"
        : "diverged";
  return {
    operatorDecision: "abandon",
    taskId: authority.taskId,
    taskPath: record.taskPath,
    mainHead,
    episodeHead,
    mainStatus: mainSnapshot.status,
    candidateMainRelationship: relationship,
    parentTaskId: episodeSnapshot.parentTaskId,
    episodeTaskContentDigest: episodeSnapshot.abandonmentContentDigest,
    finalSummary,
  };
}

export async function abandonTaskEpisode(
  ctx: ExtensionContext,
  dependencies: TaskEpisodeAbandonmentDependencies = {},
  decision: TaskEpisodeAbandonmentDecision,
): Promise<TaskEpisodeAbandonmentResult> {
  if (decision.operatorDecision !== "abandon") {
    throw new Error("Task abandonment requires the explicit operator Abandon decision");
  }
  if (!decision.finalSummary.trim() || decision.finalSummary !== decision.finalSummary.trim()) {
    throw new Error("Task abandonment requires one normalized truthful non-empty Final Summary");
  }
  if (decision.mainStatus === "Done") {
    throw new Error("Task abandonment archives without publishing Done");
  }
  const git = dependencies.git ?? new CliGitAdapter();
  const filesystem = dependencies.filesystem ?? new NodeFilesystemAdapter();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const runner = dependencies.lifecycleRunner ?? dependencies.taskRunner ?? new ProcessCommandRunner();
  const resolveTask = dependencies.taskResolver
    ?? ((cwd: string, id: string) => resolveBacklogTask(cwd, id, runner));
  const resolveAbandonment = dependencies.abandonmentSnapshotResolver
    ?? ((cwd: string, id: string) => resolveTaskAbandonmentSnapshot(cwd, id, runner));
  const resolveFile = dependencies.abandonmentFileSnapshotResolver
    ?? ((cwd: string, path: string) => resolveTaskAbandonmentFileSnapshot(cwd, path));
  const assertNoCleanupTargets = dependencies.assertNoArchiveCleanupTargets
    ?? ((cwd: string, id: string, path: string) => assertNoTaskArchiveCleanupTargets(cwd, id, path, runner));
  const abandonmentGit = dependencies.abandonmentGit
    ?? (dependencies.mergeGit as TaskEpisodeAbandonmentGit | undefined)
    ?? new CliTaskEpisodeAdmissionGit();
  if (typeof abandonmentGit.pathTrackedAtRef !== "function"
    || typeof abandonmentGit.restorePathFromRef !== "function"
    || typeof abandonmentGit.commitOnlyPaths !== "function") {
    throw new Error("Task abandonment requires exact task-blob selection and archival Git support");
  }

  const authority = resolveBlockedWorkflowAuthority(decision.taskId, ctx, {
    git, ownership: store, taskRunner: runner,
  });
  if (authority.mode !== "task") throw new Error("Task abandonment requires task-native owner authority");
  const projectRoot = authority.projectRoot;
  const record = store.read(projectRoot);
  if (!record) throw new Error(`No durable task-native Episode ownership exists for ${authority.taskId}`);
  exactOwnedTaskRecord(record, authority.taskId, ctx.sessionManager.getSessionId());
  if (record.status !== "active") throw new Error(`Episode ownership is ${record.status}; inspect it before abandonment`);
  if (decision.taskPath !== record.taskPath || decision.parentTaskId === undefined) {
    throw new Error("Abandonment authority does not bind the exact owned task path and parent identity");
  }
  validateWorktreeRecord(record, git, filesystem, projectRoot);
  await assertReadyIntegrationEpisodeIdle(record, { ...dependencies, reviewGit: abandonmentGit });
  const retainedOwnership = stableJson(record);

  git.assertCleanWorktree(record.worktree!);
  if (abandonmentGit.head(record.worktree!) !== decision.episodeHead
    || abandonmentGit.upstreamHead(record.worktree!) !== decision.episodeHead) {
    throw new Error("Abandonment requires the exact Episode head to remain pushed");
  }
  const candidateMainRelationship = decision.mainHead === decision.episodeHead
    ? "same"
    : abandonmentGit.isAncestor(projectRoot, decision.mainHead, decision.episodeHead)
      ? "main-ancestor"
      : abandonmentGit.isAncestor(projectRoot, decision.episodeHead, decision.mainHead)
        ? "episode-ancestor"
        : "diverged";
  if (candidateMainRelationship !== decision.candidateMainRelationship) {
    throw new Error("Abandonment candidate/main relationship no longer matches the explicit authority");
  }
  const episodeTask = exactAdmissionTask(
    resolveTask(record.worktree!, authority.taskId), authority.taskId, record.worktree!, record.taskPath,
  );
  const episodeSnapshot = resolveAbandonment(record.worktree!, authority.taskId);
  const episodeFile = resolveFile(record.worktree!, record.taskPath);
  if (episodeTask.status === "Done" || episodeSnapshot.status === "Done" || episodeFile.status === "Done"
    || episodeSnapshot.taskPath !== record.taskPath
    || episodeSnapshot.parentTaskId !== decision.parentTaskId
    || episodeSnapshot.abandonmentContentDigest !== decision.episodeTaskContentDigest) {
    throw new Error("Abandonment Episode head does not preserve the exact bound task content and hierarchy");
  }

  const archivePath = expectedArchivedTaskPath(record.taskPath);
  assertNoHistoricalTaskArchiveCollision(projectRoot, decision.mainHead, archivePath, abandonmentGit);
  assertNoCleanupTargets(projectRoot, authority.taskId, record.taskPath);
  let mainHead = abandonmentGit.head(projectRoot);
  let changes = abandonmentGit.worktreeChanges(projectRoot);
  let archiveCommit: string | undefined;

  if (mainHead === decision.mainHead) {
    if (abandonmentGit.upstreamHead(projectRoot) !== decision.mainHead) {
      throw new Error("Abandonment requires canonical main and upstream at the exact bound head");
    }
    const alreadyArchived = exactArchiveMoveChanges(changes, record.taskPath, archivePath);
    if (!alreadyArchived) {
      const mainTask = exactAdmissionTask(
        resolveTask(projectRoot, authority.taskId), authority.taskId, projectRoot, record.taskPath,
      );
      const mainSnapshot = resolveAbandonment(projectRoot, authority.taskId);
      if (mainTask.status === "Done" || mainSnapshot.status === "Done"
        || mainSnapshot.taskPath !== record.taskPath
        || mainSnapshot.parentTaskId !== decision.parentTaskId) {
        throw new Error("Abandonment main task changed identity, path, status, or parent");
      }
      if (changes.length === 0) {
        if (mainSnapshot.status !== decision.mainStatus) {
          throw new Error("Abandonment main status no longer matches the captured lifecycle status");
        }
        abandonmentGit.restorePathFromRef(projectRoot, decision.episodeHead, record.taskPath);
      } else {
        const exactTaskChange = changes.length === 1
          && changes[0].path === record.taskPath
          && /^[ M]{2}$/.test(changes[0].status)
          && changes[0].status.includes("M");
        if (!exactTaskChange || mainSnapshot.abandonmentContentDigest !== decision.episodeTaskContentDigest) {
          throw new Error("Abandonment recovery rejects dirty canonical-main content outside the exact Episode task blob");
        }
      }
      runner.run("backlog", [
        "task", "edit", "--status", decision.mainStatus,
        "--final-summary", decision.finalSummary, "--plain", "--", authority.taskId,
      ], { cwd: projectRoot });
      const prepared = resolveAbandonment(projectRoot, authority.taskId);
      const preparedFile = resolveFile(projectRoot, record.taskPath);
      if (prepared.taskPath !== record.taskPath || prepared.status !== decision.mainStatus
        || prepared.parentTaskId !== decision.parentTaskId
        || prepared.abandonmentContentDigest !== decision.episodeTaskContentDigest
        || prepared.finalSummary !== decision.finalSummary
        || preparedFile.status !== decision.mainStatus
        || preparedFile.finalSummary !== decision.finalSummary
        || preparedFile.contentDigest !== episodeFile.contentDigest) {
        throw new Error("Abandonment task preparation did not preserve Episode content and captured lifecycle state");
      }
      changes = abandonmentGit.worktreeChanges(projectRoot);
      const exactPreparedChange = changes.length === 0
        || (changes.length === 1 && changes[0].path === record.taskPath
          && /^[ M]{2}$/.test(changes[0].status) && changes[0].status.includes("M"));
      if (!exactPreparedChange) {
        throw new Error("Abandonment task preparation changed paths outside the exact task");
      }
      mkdirSync(join(projectRoot, dirname(archivePath)), { recursive: true });
      runner.run("backlog", ["task", "archive", "--", authority.taskId], { cwd: projectRoot });
      changes = abandonmentGit.worktreeChanges(projectRoot);
    }
    if (!exactArchiveMoveChanges(changes, record.taskPath, archivePath)) {
      throw new Error("Abandonment archive must move only the exact task into Backlog archive");
    }
    const archivedFile = resolveFile(projectRoot, archivePath);
    if (archivedFile.status !== decision.mainStatus || archivedFile.status === "Done"
      || archivedFile.finalSummary !== decision.finalSummary
      || archivedFile.contentDigest !== episodeFile.contentDigest) {
      throw new Error("Archived abandonment task does not preserve the authorized content and lifecycle state");
    }
    archiveCommit = abandonmentGit.commitOnlyPaths(
      projectRoot, [record.taskPath, archivePath], `chore: abandon ${authority.taskId}`,
    );
    mainHead = archiveCommit;
  } else {
    if (changes.length !== 0) {
      throw new Error("Abandonment recovery rejects a dirty committed archival state");
    }
    const parents = abandonmentGit.parents(projectRoot, mainHead);
    const paths = abandonmentGit.commitPaths(projectRoot, mainHead);
    if (parents.length !== 1 || parents[0] !== decision.mainHead
      || !exactPathSet(paths, [record.taskPath, archivePath])) {
      throw new Error("Canonical main is neither the bound pre-abandonment head nor its exact archival child");
    }
    archiveCommit = mainHead;
  }

  const archiveParents = abandonmentGit.parents(projectRoot, archiveCommit);
  const archivePaths = abandonmentGit.commitPaths(projectRoot, archiveCommit);
  if (abandonmentGit.head(projectRoot) !== archiveCommit
    || archiveParents.length !== 1 || archiveParents[0] !== decision.mainHead
    || !exactPathSet(archivePaths, [record.taskPath, archivePath])) {
    throw new Error("Abandonment commit must directly archive only the exact bound task");
  }
  const archivedFile = resolveFile(projectRoot, archivePath);
  if (archivedFile.status !== decision.mainStatus || archivedFile.status === "Done"
    || archivedFile.finalSummary !== decision.finalSummary
    || archivedFile.contentDigest !== episodeFile.contentDigest) {
    throw new Error("Abandonment verification failed exact task content, lifecycle status, or summary");
  }
  git.assertCleanWorktree(projectRoot);
  const retained = store.read(projectRoot);
  if (!retained) throw new Error("Task-native ownership disappeared after abandonment");
  exactOwnedTaskRecord(retained, authority.taskId, ctx.sessionManager.getSessionId());
  if (retained.status !== "active" || stableJson(retained) !== retainedOwnership) {
    throw new Error("Abandonment must retain exact Episode ownership and every resource pending cleanup authority");
  }

  let pushError = bestEffortTaskPush(abandonmentGit, projectRoot);
  if (!pushError) {
    try {
      const observed = abandonmentGit.upstreamHead(projectRoot);
      if (observed !== archiveCommit) {
        pushError = `Abandonment push verification expected ${archiveCommit} but observed ${observed}`;
      }
    } catch (error) {
      pushError = `Abandonment push verification failed: ${taskAdmissionError(error)}`;
    }
  }
  return {
    verified: true,
    outcome: "abandoned",
    taskId: authority.taskId,
    status: decision.mainStatus,
    priorMainHead: decision.mainHead,
    episodeHead: decision.episodeHead,
    archiveCommit,
    archivedTaskPath: archivePath,
    parentTaskId: decision.parentTaskId,
    episodeTaskContentDigest: decision.episodeTaskContentDigest,
    archivedTaskFileDigest: archivedFile.contentDigest,
    resourcesRetained: true,
    ...(pushError ? { pushError } : {}),
  };
}


export function taskEpisodeCleanupResourceIdentity(
  record: TaskEpisodeOwnershipRecord,
  episodeHead: string,
): TaskEpisodeCleanupResourceIdentity {
  if (!record.worktree || !record.branch || !record.episodeId
    || !record.episodeSessionFile || !record.episodeActiveSessionId
    || !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(episodeHead)) {
    throw new Error("Task Episode cleanup requires every exact core resource binding");
  }
  return {
    engine: record.engine,
    worktree: record.worktree,
    branch: record.branch,
    head: episodeHead,
    episodeId: record.episodeId,
    episodeSessionFile: record.episodeSessionFile,
    episodeActiveSessionId: record.episodeActiveSessionId,
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

function taskCleanupStage(
  snapshot: TaskEpisodeCleanupSnapshot,
  resources: TaskEpisodeCleanupResourceIdentity,
): number {
  if (snapshot.runtime) {
    if (stableJson(snapshot.runtime.resources) !== stableJson(resources)
      || !samePath(snapshot.runtime.cwd, resources.worktree)
      || !snapshot.runtime.idle) {
      throw new Error("Task Episode cleanup runtime is busy, foreign, or no longer exact");
    }
  }
  if (snapshot.worktree
    && (!samePath(snapshot.worktree.path, resources.worktree)
      || snapshot.worktree.branch !== resources.branch
      || snapshot.worktree.head !== resources.head
      || !snapshot.worktree.clean)) {
    throw new Error("Task Episode cleanup worktree is dirty, foreign, or no longer exact");
  }
  if (snapshot.branch
    && (snapshot.branch.name !== resources.branch || snapshot.branch.head !== resources.head)) {
    throw new Error("Task Episode cleanup branch is foreign or no longer exact");
  }
  const present = [Boolean(snapshot.runtime), Boolean(snapshot.worktree), Boolean(snapshot.branch)];
  if (present.every(Boolean)) return 0;
  if (!present[0] && present[1] && present[2]) return 1;
  if (!present[0] && !present[1] && present[2]) return 2;
  if (present.every((value) => !value)) return 3;
  throw new Error("Task Episode cleanup resources are missing in an unsafe order");
}

function taskFinalizationTerminalCommit(evidence: TaskEpisodeTerminalEvidence): string {
  return evidence.outcome === "merged" ? evidence.result.doneCommit : evidence.result.archiveCommit;
}

function taskFinalizationEpisodeHead(evidence: TaskEpisodeTerminalEvidence): string {
  return evidence.outcome === "merged" ? evidence.result.mergedHead : evidence.result.episodeHead;
}

export function prepareTaskEpisodeCleanupDecision(
  taskId: string,
  evidence: TaskEpisodeTerminalEvidence,
  ctx: ExtensionContext,
  dependencies: Pick<TaskEpisodeFinalizationDependencies, "git" | "ownership"> = {},
): TaskEpisodeCleanupDecision {
  const git = dependencies.git ?? new CliGitAdapter();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const projectRoot = git.repositoryRoot(ctx.cwd);
  const record = store.read(projectRoot);
  if (!record) throw new Error(`No durable task-native Episode ownership exists for ${taskId}`);
  exactOwnedTaskRecord(record, taskId, ctx.sessionManager.getSessionId());
  if (record.status !== "active" && record.status !== "inactive") {
    throw new Error(`Task Episode cleanup cannot finalize ${record.status} ownership`);
  }
  const episodeHead = taskFinalizationEpisodeHead(evidence);
  return {
    operatorDecision: "cleanup",
    taskId: record.taskId,
    taskPath: record.taskPath,
    ownerSessionId: record.ownerSessionId,
    episodeHead,
    terminalOutcome: evidence.outcome,
    terminalCommit: taskFinalizationTerminalCommit(evidence),
    resources: taskEpisodeCleanupResourceIdentity(record, episodeHead),
  };
}

function verifyTaskEpisodeTerminalEvidence(
  projectRoot: string,
  record: TaskEpisodeOwnershipRecord,
  episodeHead: string,
  evidence: TaskEpisodeTerminalEvidence,
  git: TaskEpisodeAbandonmentGit,
  resolveTask: (cwd: string, taskId: string) => BacklogTaskSelection | null,
  resolveSnapshot: (cwd: string, taskId: string) => TaskReviewSnapshot,
  resolveFile: (cwd: string, taskPath: string) => TaskAbandonmentFileSnapshot,
): void {
  const currentHead = git.head(projectRoot);
  if (git.upstreamHead(projectRoot) !== currentHead) {
    throw new Error("Task Episode cleanup requires canonical main terminal work to be pushed and exact");
  }
  if (evidence.outcome === "merged") {
    const result = evidence.result;
    if (!result.verified || result.outcome !== "merged" || result.pushError
      || result.taskId !== record.taskId || result.status !== "Done"
      || result.mergedHead !== episodeHead) {
      throw new Error("Task Episode cleanup merge evidence does not bind the exact owned Episode");
    }
    if (!git.isAncestor(projectRoot, result.doneCommit, currentHead)
      || !exactPathSet(git.parents(projectRoot, result.doneCommit), [result.mergedHead])
      || !exactPathSet(git.commitPaths(projectRoot, result.doneCommit), [record.taskPath])) {
      throw new Error("Task Episode cleanup merge terminal commit is not the verified exact task child");
    }
    const task = exactAdmissionTask(resolveTask(projectRoot, record.taskId), record.taskId, projectRoot, record.taskPath);
    const snapshot = resolveSnapshot(projectRoot, record.taskId);
    if (task.status !== "Done" || snapshot.status !== "Done"
      || snapshot.taskPath !== record.taskPath
      || snapshot.parentTaskId !== result.parentTaskId
      || snapshot.contentDigest !== result.episodeTaskContentDigest) {
      throw new Error("Task Episode cleanup merge terminal task changed identity, hierarchy, status, or content");
    }
    return;
  }

  const { decision, result } = evidence;
  if (!result.verified || result.outcome !== "abandoned" || result.pushError
    || result.resourcesRetained !== true || decision.operatorDecision !== "abandon"
    || result.taskId !== record.taskId || decision.taskId !== record.taskId
    || decision.taskPath !== record.taskPath || result.episodeHead !== episodeHead
    || decision.episodeHead !== episodeHead || result.status !== decision.mainStatus
    || result.priorMainHead !== decision.mainHead
    || result.parentTaskId !== decision.parentTaskId
    || result.episodeTaskContentDigest !== decision.episodeTaskContentDigest) {
    throw new Error("Task Episode cleanup abandonment evidence does not bind the exact owned Episode");
  }
  const archivePath = expectedArchivedTaskPath(record.taskPath);
  if (result.archivedTaskPath !== archivePath
    || !git.isAncestor(projectRoot, result.archiveCommit, currentHead)
    || !exactPathSet(git.parents(projectRoot, result.archiveCommit), [decision.mainHead])
    || !exactPathSet(git.commitPaths(projectRoot, result.archiveCommit), [record.taskPath, archivePath])) {
    throw new Error("Task Episode cleanup abandonment terminal commit is not the verified exact archive child");
  }
  if (resolveTask(projectRoot, record.taskId) !== null) {
    throw new Error("Task Episode cleanup abandonment evidence conflicts with an active task");
  }
  const archived = resolveFile(projectRoot, archivePath);
  if (archived.status !== decision.mainStatus || archived.status === "Done"
    || archived.finalSummary !== decision.finalSummary
    || archived.contentDigest !== result.archivedTaskFileDigest) {
    throw new Error("Task Episode cleanup archived task changed status, summary, or content");
  }
}

export async function finalizeTaskEpisodeCleanup(
  ctx: ExtensionContext,
  dependencies: TaskEpisodeFinalizationDependencies,
  decision: TaskEpisodeCleanupDecision,
  terminalEvidence: TaskEpisodeTerminalEvidence,
): Promise<TaskEpisodeFinalizationResult> {
  if (decision.operatorDecision !== "cleanup") {
    throw new Error("Task Episode cleanup requires separate explicit operator cleanup authority");
  }
  if ((ctx.sessionManager.getHeader().rlmDepth ?? 0) !== 0) {
    throw new Error("Task Episode cleanup is available only to the top-level owning Conversation");
  }
  if (!ctx.sessionManager.getSessionFile()) {
    throw new Error("Task Episode cleanup requires a persisted owning Conversation session");
  }
  const git = dependencies.git ?? new CliGitAdapter();
  const terminalGit = dependencies.abandonmentGit
    ?? (dependencies.mergeGit as TaskEpisodeAbandonmentGit | undefined)
    ?? new CliTaskEpisodeAdmissionGit();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const runner = dependencies.lifecycleRunner ?? dependencies.taskRunner ?? new ProcessCommandRunner();
  const resolveTask = dependencies.taskResolver
    ?? ((cwd: string, id: string) => resolveBacklogTask(cwd, id, runner));
  const resolveSnapshot = dependencies.taskSnapshotResolver
    ?? ((cwd: string, id: string) => resolveTaskReviewSnapshot(cwd, id, runner));
  const resolveFile = dependencies.abandonmentFileSnapshotResolver
    ?? ((cwd: string, path: string) => resolveTaskAbandonmentFileSnapshot(cwd, path));
  const projectRoot = git.repositoryRoot(ctx.cwd);
  if (!samePath(projectRoot, ctx.cwd) || git.branch(projectRoot) !== "main") {
    throw new Error("Task Episode cleanup must run from the canonical primary main checkout");
  }
  const record = store.read(projectRoot);
  if (!record) throw new Error(`No durable task-native Episode ownership exists for ${decision.taskId}`);
  exactOwnedTaskRecord(record, decision.taskId, ctx.sessionManager.getSessionId());
  if (record.status !== "active" && record.status !== "inactive") {
    throw new Error(`Task Episode cleanup cannot finalize ${record.status} ownership`);
  }
  if (decision.ownerSessionId !== record.ownerSessionId || decision.taskPath !== record.taskPath) {
    throw new Error("Task Episode cleanup authority does not bind the exact owner and task path");
  }
  const episodeHead = taskFinalizationEpisodeHead(terminalEvidence);
  if (!terminalEvidence.result || terminalEvidence.result.taskId !== decision.taskId
    || terminalEvidence.outcome !== decision.terminalOutcome
    || taskFinalizationTerminalCommit(terminalEvidence) !== decision.terminalCommit
    || episodeHead !== decision.episodeHead) {
    throw new Error("Task Episode cleanup terminal evidence does not match the explicit cleanup authority");
  }
  const resources = taskEpisodeCleanupResourceIdentity(record, episodeHead);
  if (stableJson(decision.resources) !== stableJson(resources)) {
    throw new Error("Task Episode cleanup authority does not bind every exact Episode resource");
  }
  let snapshot = await dependencies.cleanup.inspect(record);
  let stage = taskCleanupStage(snapshot, resources);
  if (stage !== 3 && !terminalGit.isAncestor(projectRoot, record.baseRef, episodeHead)) {
    throw new Error("Task Episode cleanup terminal head is not descended from the owned Episode base");
  }
  git.assertCleanWorktree(projectRoot);
  verifyTaskEpisodeTerminalEvidence(
    projectRoot, record, episodeHead, terminalEvidence, terminalGit, resolveTask, resolveSnapshot, resolveFile,
  );

  if (record.status === "inactive") {
    if (stage !== 3) throw new Error("Inactive task Episode ownership still has retained resources");
    return {
      verified: true,
      outcome: terminalEvidence.outcome,
      taskId: record.taskId,
      terminalCommit: taskFinalizationTerminalCommit(terminalEvidence),
      resourcesRemoved: true,
      ownershipStatus: "inactive",
      reused: true,
    };
  }

  const advance = async (
    remove: () => Promise<void>,
    label: string,
    expectedStages: number[],
  ): Promise<void> => {
    await remove();
    snapshot = await dependencies.cleanup.inspect(record);
    stage = taskCleanupStage(snapshot, resources);
    if (!expectedStages.includes(stage)) throw new Error(`Task Episode cleanup ${label} was not verified exactly`);
  };
  if (stage === 0) await advance(() => dependencies.cleanup.removeRuntime(record), "runtime removal", [1]);
  if (stage === 1) await advance(() => dependencies.cleanup.removeWorktree(record), "worktree removal", [2, 3]);
  if (stage === 2) await advance(() => dependencies.cleanup.removeBranch(record), "branch removal", [3]);
  if (stage !== 3) throw new Error("Task Episode cleanup did not remove every exact resource");

  const retained = store.read(projectRoot);
  if (!retained || stableJson(retained) !== stableJson(record)) {
    throw new Error("Task Episode ownership changed during authorized cleanup");
  }
  const closed: TaskEpisodeOwnershipRecord = {
    ...record,
    status: "inactive",
    updatedAt: dependencies.now?.() ?? new Date().toISOString(),
  };
  store.write(projectRoot, closed);
  const verified = store.read(projectRoot);
  if (!verified || !isTaskEpisodeOwnership(verified) || verified.status !== "inactive"
    || stableJson(verified) !== stableJson(closed)) {
    throw new Error("Task Episode cleanup could not verify inactive ownership bookkeeping");
  }
  return {
    verified: true,
    outcome: terminalEvidence.outcome,
    taskId: record.taskId,
    terminalCommit: taskFinalizationTerminalCommit(terminalEvidence),
    resourcesRemoved: true,
    ownershipStatus: "inactive",
    reused: false,
  };
}

export function verifyTaskEpisodeChangesRequested(
  publication: TaskEpisodeChangesPublicationResult,
  integration: TaskEpisodeChangesIntegrationResult,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeReadyForMergeDependencies,
): TaskEpisodeChangesVerificationResult {
  const git = dependencies.git ?? new CliGitAdapter();
  const reviewGit = dependencies.reviewGit ?? new CliTaskEpisodeAdmissionGit();
  const filesystem = dependencies.filesystem ?? new NodeFilesystemAdapter();
  const store = dependencies.ownership ?? defaultOwnershipStore;
  const runner = dependencies.lifecycleRunner ?? dependencies.taskRunner ?? new ProcessCommandRunner();
  const resolveTask = dependencies.taskResolver
    ?? ((cwd: string, id: string) => resolveBacklogTask(cwd, id, runner));
  const resolveSnapshot = dependencies.taskSnapshotResolver
    ?? ((cwd: string, id: string) => resolveTaskReviewSnapshot(cwd, id, runner));
  if (publication.status !== "In Progress"
    || integration.taskId !== publication.taskId
    || integration.changesCommit !== publication.commit
    || integration.previousRefreshedEpisodeHead !== publication.episodeHead
    || integration.parentTaskId !== publication.parentTaskId
    || integration.episodeTaskContentDigest !== publication.episodeTaskContentDigest) {
    throw new Error("Request-Changes verification inputs do not describe one exact handshake");
  }
  const authority = resolveBlockedWorkflowAuthority(publication.taskId, ctx, { git, ownership: store, taskRunner: runner });
  if (authority.mode !== "task") throw new Error("Request-Changes verification requires task-native owner authority");
  const projectRoot = authority.projectRoot;
  const record = store.read(projectRoot);
  if (!record) throw new Error(`No durable task-native Episode ownership exists for ${authority.taskId}`);
  exactOwnedTaskRecord(record, authority.taskId, ctx.sessionManager.getSessionId());
  if (record.status !== "active") throw new Error(`Episode ownership is ${record.status}; inspect it before change verification`);
  validateWorktreeRecord(record, git, filesystem, projectRoot);
  if (reviewGit.head(projectRoot) !== integration.integratedMainHead) {
    throw new Error("Request-Changes verification requires a refreshed candidate against current main");
  }
  if (reviewGit.pathStatus(projectRoot, record.taskPath) !== "") {
    throw new Error("Request-Changes verification requires committed main task content");
  }
  const mainTask = exactAdmissionTask(resolveTask(projectRoot, authority.taskId), authority.taskId, projectRoot, record.taskPath);
  const mainSnapshot = resolveSnapshot(projectRoot, authority.taskId);
  if (mainTask.status !== "In Progress" || mainSnapshot.status !== "In Progress") {
    throw new Error(`Request-Changes verification requires main status In Progress; found ${mainTask.status}`);
  }
  if (mainSnapshot.taskPath !== record.taskPath || mainSnapshot.parentTaskId !== publication.parentTaskId) {
    throw new Error("Request-Changes verification found changed main task identity or hierarchy");
  }
  if (reviewGit.head(record.worktree!) !== integration.refreshedEpisodeHead
    || reviewGit.upstreamHead(record.worktree!) !== integration.refreshedEpisodeHead) {
    throw new Error("Request-Changes verification requires the exact refreshed Episode candidate to be pushed");
  }
  git.assertCleanWorktree(record.worktree!);
  const episodeTask = exactAdmissionTask(
    resolveTask(record.worktree!, authority.taskId), authority.taskId, record.worktree!, record.taskPath,
  );
  const snapshot = resolveSnapshot(record.worktree!, authority.taskId);
  if (episodeTask.status !== "In Progress" || snapshot.status !== "In Progress"
    || snapshot.parentTaskId !== publication.parentTaskId
    || snapshot.contentDigest !== publication.episodeTaskContentDigest) {
    throw new Error("Request-Changes refreshed candidate does not preserve exact task content, hierarchy, and status");
  }
  const parents = reviewGit.parents(record.worktree!, integration.refreshedEpisodeHead);
  if (parents.length !== 2
    || parents[0] !== integration.previousRefreshedEpisodeHead
    || parents[1] !== integration.integratedMainHead
    || !reviewGit.isAncestor(projectRoot, publication.commit, integration.integratedMainHead)
    || !reviewGit.isAncestor(record.worktree!, integration.previousRefreshedEpisodeHead, integration.refreshedEpisodeHead)) {
    throw new Error("Request-Changes refreshed candidate does not contain the exact verified candidate and current main");
  }
  return {
    verified: true,
    taskId: authority.taskId,
    mainHead: integration.integratedMainHead,
    refreshedEpisodeHead: integration.refreshedEpisodeHead,
    status: "In Progress",
  };
}

/** Publish an explicit Request Changes decision against exact verified review evidence. */
export async function publishTaskEpisodeChangesRequested(
  evidence: TaskEpisodeReadyHandshakeEvidence,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeReadyForMergeDependencies = {},
  decision: TaskEpisodeOperatorDecision,
): Promise<TaskEpisodeChangesPublicationResult> {
  if (decision.operatorDecision !== "request-changes") {
    throw new Error("Request Changes requires explicit operator authority");
  }
  const prior = await verifyReadyOperatorDecision(evidence, ctx, dependencies);
  const reversed = publishTaskEpisodeLifecycleStatus(prior.taskId, prior.refreshedEpisodeHead, ctx, {
    expectedMainStatus: "Ready for Merge",
    expectedEpisodeStatus: "Ready for Merge",
    expectedMainHead: prior.mainHead,
    targetStatus: "In Progress",
    message: `chore: request changes for ${prior.taskId}`,
  }, dependencies);
  return {
    ...reversed,
    status: "In Progress",
    parentTaskId: evidence.publication.parentTaskId,
    episodeTaskContentDigest: evidence.publication.episodeTaskContentDigest,
  };
}

/** Refresh the same Episode against the accepted Request Changes publication. */
export async function integrateTaskEpisodeChangesRequested(
  publication: TaskEpisodeChangesPublicationResult,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeReadyForMergeDependencies = {},
): Promise<TaskEpisodeChangesIntegrationResult> {
  if (publication.status !== "In Progress") {
    throw new Error("Request-Changes integration requires its exact In Progress publication result");
  }
  const integrated = await integrateTaskEpisodeReviewTransition({
    label: "Request-Changes",
    taskId: publication.taskId,
    statusCommit: publication.commit,
    baseEpisodeHead: publication.episodeHead,
    expectedMainStatus: "In Progress",
    expectedEpisodeStatus: "Ready for Merge",
    targetEpisodeStatus: "In Progress",
    parentTaskId: publication.parentTaskId,
    episodeTaskContentDigest: publication.episodeTaskContentDigest,
    mergeMessage: `chore: integrate requested changes for ${publication.taskId}`,
  }, ctx, dependencies);
  return {
    taskId: integrated.taskId,
    changesCommit: integrated.statusCommit,
    previousRefreshedEpisodeHead: integrated.baseEpisodeHead,
    integratedMainHead: integrated.integratedMainHead,
    refreshedEpisodeHead: integrated.refreshedEpisodeHead,
    parentTaskId: integrated.parentTaskId,
    episodeTaskContentDigest: integrated.episodeTaskContentDigest,
    ...(integrated.pushError ? { pushError: integrated.pushError } : {}),
  };
}

/** Verify the pushed revision candidate, then resume only through canonical handoff. */
export async function resumeTaskEpisodeChangesRequested(
  publication: TaskEpisodeChangesPublicationResult,
  integration: TaskEpisodeChangesIntegrationResult,
  guidance: string,
  ctx: ExtensionContext,
  dependencies: TaskEpisodeReadyForMergeDependencies = {},
): Promise<TaskEpisodeChangesResumeResult> {
  const verification = verifyTaskEpisodeChangesRequested(publication, integration, ctx, dependencies);
  const handoff = await handoffTaskEpisode(publication.taskId, guidance, ctx, dependencies);
  return { verification, handoff };
}

/**
 * Execute the trusted task-native admission transaction without exposing a
 * public command: exact status commit, durable reservation, then allocation.
 * Clean pre-reservation failures roll back; any recorded or uncertain mutation
 * is published as Blocked and cannot be replayed as fresh creation.
 */
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
    ?? ((cwd: string, taskId: string) => resolveBacklogTask(cwd, taskId, runner));
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
    const existing = store.read(projectRoot);
    if (existing && existing.status !== "inactive") {
      const identity = isTaskEpisodeOwnership(existing) ? existing.taskId : existing.sourceLocation;
      throw new Error(`Non-terminal Episode ownership already exists for ${identity}; inspect it instead of creating another Episode`);
    }
    preAdmissionHead = git.head(projectRoot);

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
    });
    admissionPushError = bestEffortTaskPush(git, projectRoot);

    const reservationInput: TaskEpisodeReservationInput = {
      projectRoot,
      taskId,
      ownerSessionId: ctx.sessionManager.getSessionId(),
      engine: options.engine,
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
    const result = await allocate(taskId, ctx, dependencies);
    const storedActive = store.read(projectRoot);
    if (!storedActive) throw new Error("Task-native Episode allocation returned without durable ownership");
    const active = parseEpisodeOwnership(storedActive, "task-native Episode admission result");
    exactOwnedTaskRecord(active, taskId, ctx.sessionManager.getSessionId());
    if (active.status !== "active" || active.baseRef !== admitted.commit || active.operationId !== reservation.operationId) {
      throw new Error("Task-native Episode allocation returned without the exact active reservation identity");
    }
    const finalTask = exactAdmissionTask(resolveTask(projectRoot, taskId), taskId, projectRoot, taskPath);
    if (finalTask.status !== "In Progress" || git.head(projectRoot) !== admitted.commit || git.pathStatus(projectRoot, taskPath) !== "") {
      throw new Error("Task-native Episode allocation did not preserve the exact committed In Progress task state");
    }
    return { ...active, reused: result.reused, ...(admissionPushError ? { admissionPushError } : {}) };
  } catch (error) {
    if (!statusMutationStarted || !projectRoot || !taskPath) throw error;
    const cause = taskAdmissionError(error);
    let ownership: EpisodeOwnershipRecord | null = null;
    let ownershipUncertain = false;
    try { ownership = store.read(projectRoot); }
    catch { ownershipUncertain = true; }
    const recordedMutation = ownershipUncertain || Boolean(ownership && ownership.status !== "inactive");

    if (recordedMutation) {
      const note = [
        `Episode admission blocked after durable or uncertain mutation at ${dependencies.now?.() ?? new Date().toISOString()}.`,
        `Recovery condition: inspect .prime-claw/ownership.json and reconcile every recorded task, worktree, and session identity to ${taskId} before continuing; do not retry it as fresh creation.`,
        `Cause: ${cause}`,
      ].join("\n");
      try {
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
      } catch (recoveryError) {
        throw new Error(`Task-native Episode creation failed after durable or uncertain mutation, and Blocked publication failed. Preserve all evidence and recover ${taskId} manually. Cause: ${cause}. Publication failure: ${taskAdmissionError(recoveryError)}`);
      }
      const recoveryPushError = bestEffortTaskPush(git, projectRoot);
      throw new Error(`Task-native Episode creation failed after durable or uncertain mutation; ${taskId} is Blocked and requires exact recovery before retry. Cause: ${cause}${recoveryPushError ? ` Push also failed: ${recoveryPushError}` : ""}`);
    }

    let current: BacklogTaskSelection | null = null;
    try { current = resolveTask(projectRoot, taskId); } catch { /* handled below */ }
    const unchanged = current?.taskId === taskId
      && current.status === "In Planning"
      && git.head(projectRoot) === preAdmissionHead
      && git.pathStatus(projectRoot, taskPath) === "";
    if (unchanged) throw error;
    try {
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
    } catch (recoveryError) {
      throw new Error(`Task-native Episode creation failed before ownership or resource mutation, and clean rollback failed. Preserve the checkout and recover ${taskId} manually. Cause: ${cause}. Rollback failure: ${taskAdmissionError(recoveryError)}`);
    }
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
    const executePromptAtRoot = canonicalWorkflowPrompt(repo, "execute", { location: { tag: "operator-episode-source", value: selected.location } });
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
      if (git.head(repo) !== baseRef) throw new EpisodeStateUncertainError("Canonical checkout changed during local Episode promotion");
      const executePrompt = canonicalWorkflowPrompt(worktree, "execute", { location: { tag: "operator-episode-source", value: selected.location } });
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
    if (git.head(repo) !== baseRef) throw new EpisodeStateUncertainError("Canonical checkout changed during Orca Episode promotion");
    record = updated(record, { head: promotedHead }); store.write(repo, record);
    const executePrompt = canonicalWorkflowPrompt(worktree.path, "execute", { location: { tag: "operator-episode-source", value: selected.location } });
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
