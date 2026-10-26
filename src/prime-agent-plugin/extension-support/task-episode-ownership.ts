import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep, win32 } from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

import {
  isBacklogTaskEpisodeOwnership,
  isBeadsTaskEpisodeOwnership,
  isLegacyEpisodeOwnership,
  isTaskEpisodeOwnership,
  mutateEpisodeOwnership,
  parseEpisodeOwnership,
  readEpisodeOwnership,
  writeEpisodeOwnership,
  type BacklogTaskEpisodeOwnershipRecord,
  type BeadsTaskEpisodeOwnershipRecord,
  type EpisodeOwnershipMutation,
  type EpisodeOwnershipRecord,
  type LegacyBacklogTaskEpisodeOwnershipRecord,
  type LegacyEpisodeOwnershipRecord,
} from "./episode-ownership.ts";
import {
  ProcessCommandRunner,
  type CommandRunner,
} from "./project-initialization.ts";
import {
  type BacklogTaskSelection,
} from "./reviewed-plan-support.ts";
import {
  detectTaskProvider,
  prepareBeadsWorkspaceTransport,
  requireBacklogTaskSelection,
  resolveProviderTask,
  type BeadsTaskMutationPublication,
  type BeadsWorkspaceTransportPreparation,
  type ProviderTaskResolution,
} from "./task-providers.ts";

/**
 * Default resolver: provider-aware task resolution narrowed to the existing
 * Backlog selection contract these ownership paths still require. A Beads
 * store resolves the task with no Markdown path, so these file-bound paths
 * reject it explicitly until their own provider slice lands.
 */
function defaultOwnershipTaskResolver(cwd: string, rawTaskId: string): BacklogTaskSelection | null {
  return requireBacklogTaskSelection(
    resolveProviderTask(cwd, rawTaskId),
    "this Episode ownership path",
  );
}

export interface TaskEpisodeReservationGit {
  repositoryRoot(cwd: string): string;
  head(repo: string): string;
  commitPaths(repo: string, ref: string): string[];
  pathStatus(repo: string, path: string): string;
}

export interface TaskEpisodeReservationStore {
  read(projectRoot: string, ownerSessionId?: string): EpisodeOwnershipRecord | null;
  write(projectRoot: string, record: EpisodeOwnershipRecord): void;
}

export interface TaskEpisodeReservationInput {
  projectRoot: string;
  taskId: string;
  ownerSessionId: string;
  engine: "orca" | "local";
  projectSetupId?: string;
  routingEnvironmentId?: string;
  operationId?: string;
  /** Exact verified In Progress admission commit supplied by the public admission boundary. */
  baseRef?: string;
}

export interface TaskEpisodeReservationDependencies {
  git?: TaskEpisodeReservationGit;
  ownership?: TaskEpisodeReservationStore;
  taskResolver?: (cwd: string, taskId: string) => BacklogTaskSelection | null;
  now?: () => string;
}

export interface BeadsTaskEpisodeReservationGit {
  repositoryRoot(cwd: string): string;
  head(repo: string): string;
  status(repo: string): string;
}

export interface BeadsTaskEpisodeReservationInput {
  projectRoot: string;
  publication: BeadsTaskMutationPublication;
  ownerSessionId: string;
  engine: "orca" | "local";
  projectSetupId?: string;
  routingEnvironmentId?: string;
  operationId?: string;
  /** Exact clean code HEAD that this reservation binds as baseRef. */
  baseRef: string;
}

export interface BeadsTaskEpisodeReservationDependencies {
  git?: BeadsTaskEpisodeReservationGit;
  ownership?: TaskEpisodeReservationStore;
  now?: () => string;
}

/** Factual provider-native observations that may refresh one existing active Beads owner. */
export interface BeadsTaskEvidenceAdvancementInput {
  /** Canonical primary checkout that contains the existing ownership registry. */
  projectRoot: string;
  ownerSessionId: string;
  taskId: string;
  previousProviderRevision: string;
  previousTaskEvidence: Record<string, unknown>;
  episodeHead: string;
}

export interface BeadsTaskEvidenceAdvancementGit {
  repositoryRoot(cwd: string): string;
  branch(repo: string): string;
  head(repo: string): string;
  upstreamHead(repo: string): string;
  directRemoteHead(repo: string, branch: string): string;
  status(repo: string): string;
  operationInProgress(repo: string): boolean;
  isAncestor(repo: string, ancestor: string, descendant: string): boolean;
}

export interface BeadsTaskEvidenceAdvancementStore {
  read(projectRoot: string, ownerSessionId: string): EpisodeOwnershipRecord | null;
  mutate(projectRoot: string, ownerSessionId: string, mutation: EpisodeOwnershipMutation): EpisodeOwnershipRecord | null;
}

export interface BeadsTaskEvidenceAdvancementDependencies {
  git?: BeadsTaskEvidenceAdvancementGit;
  ownership?: BeadsTaskEvidenceAdvancementStore;
  runner?: CommandRunner;
  detectProvider?: typeof detectTaskProvider;
  synchronize?: (cwd: string, runner: CommandRunner) => { stdout: string; stderr: string; status: number };
  prepareTransport?: (cwd: string, runner: CommandRunner) => BeadsWorkspaceTransportPreparation;
  pairTransport?: (cwd: string, runner: CommandRunner) => BeadsWorkspaceTransportPreparation;
  resolveTask?: (cwd: string, taskId: string, runner: CommandRunner) => ProviderTaskResolution | null;
  providerRevisionIsAncestor?: (
    cwd: string, ancestor: string, descendant: string, runner: CommandRunner,
  ) => boolean;
  now?: () => string;
}

export interface BeadsTaskEvidenceAdvancementResult {
  record: BeadsTaskEpisodeOwnershipRecord;
  previousProviderRevision: string;
  publishedProviderRevision: string;
  previousTaskEvidence: Record<string, unknown>;
  currentTaskEvidence: Record<string, unknown>;
  commit: () => BeadsTaskEpisodeOwnershipRecord;
}

export interface LegacyTaskOwnershipTransitionInput {
  projectRoot: string;
  sourceLocation: string;
  taskId: string;
  ownerSessionId: string;
  expectedMainHead: string;
  expectedEpisodeHead: string;
  expectedPreviousEpisodeActiveSessionId: string;
  verifiedCurrentEpisodeActiveSessionId: string;
  confirmedReady: boolean;
}

export interface LegacyTaskOwnershipTransitionGit {
  repositoryRoot(cwd: string): string;
  isPrimaryWorktree(repo: string): boolean;
  branch(repo: string): string;
  head(repo: string): string;
  upstreamHead(repo: string): string;
  status(repo: string): string;
  operationInProgress(repo: string): boolean;
  worktrees(repo: string): Array<{ path: string; branch: string; head: string }>;
  isAncestor(repo: string, ancestor: string, descendant: string): boolean;
  commitPaths(repo: string, ref: string): string[];
  blobOid(repo: string, ref: string, path: string): string;
}

export interface LegacyTaskOwnershipTransitionDependencies {
  git?: LegacyTaskOwnershipTransitionGit;
  ownership?: TaskEpisodeReservationStore;
  taskResolver?: (cwd: string, taskId: string) => BacklogTaskSelection | null;
  now?: () => string;
}

export interface LegacyTaskOwnershipTransitionResult {
  record: LegacyBacklogTaskEpisodeOwnershipRecord | BacklogTaskEpisodeOwnershipRecord;
  reused: boolean;
  mainHead: string;
  episodeHead: string;
  activeSpecification: { path: ".ralph/plans/SPECIFICATION.md"; blob: string };
  activeImplementationPlan: { path: ".ralph/plans/EXECUTION_PLAN.md" | ".ralph/plans/IMPLEMENTATION_PLAN.md"; blob: string };
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export class CliTaskEpisodeReservationGit implements TaskEpisodeReservationGit {
  repositoryRoot(cwd: string): string { return realpathSync(runGit(cwd, ["rev-parse", "--show-toplevel"])); }
  head(repo: string): string { return runGit(repo, ["rev-parse", "HEAD"]); }
  commitPaths(repo: string, ref: string): string[] {
    const output = runGit(repo, ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", ref, "--"]);
    return output ? output.split(/\r?\n/).filter(Boolean) : [];
  }
  pathStatus(repo: string, path: string): string { return runGit(repo, ["status", "--porcelain", "--", path]); }
}

export class CliBeadsTaskEpisodeReservationGit implements BeadsTaskEpisodeReservationGit {
  repositoryRoot(cwd: string): string { return realpathSync(runGit(cwd, ["rev-parse", "--show-toplevel"])); }
  head(repo: string): string { return runGit(repo, ["rev-parse", "HEAD"]); }
  status(repo: string): string { return runGit(repo, ["status", "--porcelain=v1", "--untracked-files=no"]); }
}

export class CliBeadsTaskEvidenceAdvancementGit implements BeadsTaskEvidenceAdvancementGit {
  repositoryRoot(cwd: string): string { return realpathSync(runGit(cwd, ["rev-parse", "--show-toplevel"])); }
  branch(repo: string): string { return runGit(repo, ["symbolic-ref", "--short", "HEAD"]); }
  head(repo: string): string { return runGit(repo, ["rev-parse", "HEAD"]); }
  upstreamHead(repo: string): string { return runGit(repo, ["rev-parse", "@{upstream}"]); }
  directRemoteHead(repo: string, branch: string): string {
    const remote = runGit(repo, ["config", "--get", `branch.${branch}.remote`]);
    const mergeRef = runGit(repo, ["config", "--get", `branch.${branch}.merge`]);
    if (!remote || !mergeRef || mergeRef !== `refs/heads/${branch}`) {
      throw new Error("Beads evidence advancement requires the recorded branch's exact ordinary upstream");
    }
    const urls = runGit(repo, ["remote", "get-url", "--all", remote]).split(/\r?\n/).filter(Boolean);
    if (urls.length !== 1) {
      throw new Error("Beads evidence advancement requires one exact code remote transport");
    }
    const rows = runGit(repo, ["ls-remote", "--exit-code", "--heads", urls[0]!, mergeRef])
      .split(/\r?\n/).filter(Boolean);
    const match = rows.length === 1
      ? /^([0-9a-f]{40}|[0-9a-f]{64})\s+refs\/heads\/(.+)$/.exec(rows[0]!)
      : null;
    if (!match || match[2] !== branch) {
      throw new Error("Beads evidence advancement could not prove the exact direct-remote code head");
    }
    return match[1]!;
  }
  status(repo: string): string { return runGit(repo, ["status", "--porcelain=v1", "--untracked-files=all"]); }
  operationInProgress(repo: string): boolean {
    return ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply", "sequencer"]
      .some((marker) => existsSync(resolve(repo, runGit(repo, ["rev-parse", "--git-path", marker]))));
  }
  isAncestor(repo: string, ancestor: string, descendant: string): boolean {
    try {
      execFileSync("git", ["-C", repo, "merge-base", "--is-ancestor", ancestor, descendant], { stdio: "ignore" });
      return true;
    } catch (error) {
      if (typeof error === "object" && error !== null && "status" in error && error.status === 1) return false;
      throw error;
    }
  }
}

export class CliLegacyTaskOwnershipTransitionGit implements LegacyTaskOwnershipTransitionGit {
  repositoryRoot(cwd: string): string { return realpathSync(runGit(cwd, ["rev-parse", "--show-toplevel"])); }
  isPrimaryWorktree(repo: string): boolean {
    const gitDir = realpathSync(resolve(repo, runGit(repo, ["rev-parse", "--git-dir"])));
    const commonDir = realpathSync(resolve(repo, runGit(repo, ["rev-parse", "--git-common-dir"])));
    return gitDir === commonDir;
  }
  branch(repo: string): string { return runGit(repo, ["symbolic-ref", "--short", "HEAD"]); }
  head(repo: string): string { return runGit(repo, ["rev-parse", "HEAD"]); }
  upstreamHead(repo: string): string { return runGit(repo, ["rev-parse", "@{upstream}"]); }
  status(repo: string): string { return runGit(repo, ["status", "--porcelain=v1", "--untracked-files=all"]); }
  operationInProgress(repo: string): boolean {
    return ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply", "sequencer"]
      .some((marker) => existsSync(resolve(repo, runGit(repo, ["rev-parse", "--git-path", marker]))));
  }
  worktrees(repo: string): Array<{ path: string; branch: string; head: string }> {
    const output = runGit(repo, ["worktree", "list", "--porcelain"]);
    const rows: Array<{ path: string; branch: string; head: string }> = [];
    for (const block of output.split(/\r?\n\r?\n/).filter(Boolean)) {
      const fields = new Map(block.split(/\r?\n/).map((line) => {
        const split = line.indexOf(" ");
        return split === -1 ? [line, ""] : [line.slice(0, split), line.slice(split + 1)];
      }));
      const path = fields.get("worktree");
      const head = fields.get("HEAD");
      const branchRef = fields.get("branch");
      if (path && head && branchRef?.startsWith("refs/heads/")) {
        rows.push({ path: realpathSync(path), head, branch: branchRef.slice("refs/heads/".length) });
      }
    }
    return rows;
  }
  isAncestor(repo: string, ancestor: string, descendant: string): boolean {
    try {
      execFileSync("git", ["-C", repo, "merge-base", "--is-ancestor", ancestor, descendant], { stdio: "ignore" });
      return true;
    } catch (error) {
      if (typeof error === "object" && error !== null && "status" in error && error.status === 1) return false;
      throw error;
    }
  }
  commitPaths(repo: string, ref: string): string[] {
    const output = runGit(repo, ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", ref, "--"]);
    return output ? output.split(/\r?\n/).filter(Boolean) : [];
  }
  blobOid(repo: string, ref: string, path: string): string {
    return runGit(repo, ["rev-parse", "--verify", `${ref}:${path}`]);
  }
}

const defaultOwnership: TaskEpisodeReservationStore = {
  read: readEpisodeOwnership,
  write: writeEpisodeOwnership,
};

const defaultBeadsEvidenceAdvancementOwnership: BeadsTaskEvidenceAdvancementStore = {
  read: (projectRoot, ownerSessionId) => readEpisodeOwnership(projectRoot, ownerSessionId),
  mutate: mutateEpisodeOwnership,
};

function containedBy(parent: string, child: string): boolean {
  const fromParent = relative(parent, child);
  return fromParent !== "" && fromParent !== ".." && !fromParent.startsWith(`..${sep}`) && !isAbsolute(fromParent);
}

function portableRelativePath(projectRoot: string, taskPath: string): string {
  const path = relative(projectRoot, taskPath).split(sep).join("/");
  if (!path || path === ".." || path.startsWith("../") || isAbsolute(path) || win32.isAbsolute(path) || path.includes("\\")) {
    throw new Error("Task-native Episode reservation requires a contained project-relative task path");
  }
  return path;
}

export function meaningfulTaskImplementationPlan(plan: string | null): boolean {
  if (!plan || !plan.trim()) return false;
  const lines = plan.split(/\r?\n/).map((line) => line.trim()
    .replace(/^>\s*/, "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^\[[ xX]\]\s*/, "")
    .trim()).filter((line) => line !== "" && !/^```/.test(line));
  if (lines.length === 0) return false;
  const framing = /^(?:implementation\s+plan|plan)[:.]?$/i;
  const placeholder = /^(?:todo|tbd|placeholder|none|n\/?a|to be determined|coming soon|insert (?:the )?(?:implementation )?plan(?: here)?)[:.!]?$/i;
  const placeholderInstruction = /^(?:todo|tbd)\s*[:\-]\s*(?:write|add|insert|complete|describe|provide|draft)\s+(?:the\s+|an?\s+)?(?:implementation\s+)?plan(?:\s+here)?[.!]?$/i;
  return lines.some((line) => !framing.test(line) && !placeholder.test(line) && !placeholderInstruction.test(line));
}


const TRANSITION_GIT_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const ACTIVE_SPECIFICATION_PATH = ".ralph/plans/SPECIFICATION.md" as const;
const ACTIVE_IMPLEMENTATION_PATHS = [
  ".ralph/plans/EXECUTION_PLAN.md",
  ".ralph/plans/IMPLEMENTATION_PLAN.md",
] as const;

function assertRegularNonemptyFile(path: string, label: string): void {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0 || readFileSync(path).length === 0) throw new Error("invalid file");
  } catch {
    throw new Error(`${label} is not a readable non-empty regular file`);
  }
}

function exactTransitionTask(
  root: string,
  input: LegacyTaskOwnershipTransitionInput,
  resolver: (cwd: string, taskId: string) => BacklogTaskSelection | null,
): { selection: BacklogTaskSelection; taskPath: string } {
  const selection = resolver(root, input.taskId);
  if (!selection) throw new Error(`Backlog task ${input.taskId} is unavailable for ownership transition`);
  if (selection.taskId !== input.taskId) throw new Error("Ownership transition requires the exact canonical Backlog task ID");
  if (realpathSync(selection.projectRoot) !== root) throw new Error("Ownership transition task resolved in a different project");
  if (selection.status !== "In Progress") throw new Error("Ownership transition requires the committed main task to remain In Progress");
  if (!meaningfulTaskImplementationPlan(selection.implementationPlan)) {
    throw new Error("Ownership transition requires a meaningful committed-main Implementation Plan");
  }
  assertRegularNonemptyFile(selection.taskPath, "Ownership transition task");
  const taskPath = realpathSync(selection.taskPath);
  if (!containedBy(root, taskPath)) throw new Error("Ownership transition task escaped the project root");
  const relativePath = portableRelativePath(root, taskPath);
  if (relativePath !== selection.taskPathRelative) throw new Error("Ownership transition task path changed after Backlog resolution");
  return { selection, taskPath: relativePath };
}

function activePlanEvidence(
  record: EpisodeOwnershipRecord,
  git: LegacyTaskOwnershipTransitionGit,
  episodeHead: string,
): Pick<LegacyTaskOwnershipTransitionResult, "activeSpecification" | "activeImplementationPlan"> {
  const worktree = realpathSync(record.worktree!);
  assertRegularNonemptyFile(join(worktree, ACTIVE_SPECIFICATION_PATH), "Active Episode specification");
  const implementation = ACTIVE_IMPLEMENTATION_PATHS.filter((path) => {
    try { assertRegularNonemptyFile(join(worktree, path), "Active Episode implementation plan"); return true; }
    catch { return false; }
  });
  if (implementation.length !== 1) {
    throw new Error("Ownership transition requires exactly one readable non-empty active implementation plan");
  }
  const implementationPath = implementation[0]!;
  let specificationBlob: string;
  let implementationBlob: string;
  try {
    specificationBlob = git.blobOid(worktree, episodeHead, ACTIVE_SPECIFICATION_PATH);
    implementationBlob = git.blobOid(worktree, episodeHead, implementationPath);
  } catch {
    throw new Error("Ownership transition cannot bind the active plan pair to the exact Episode head");
  }
  if (!TRANSITION_GIT_OID.test(specificationBlob) || !TRANSITION_GIT_OID.test(implementationBlob)) {
    throw new Error("Ownership transition received invalid active-plan Git evidence");
  }
  return {
    activeSpecification: { path: ACTIVE_SPECIFICATION_PATH, blob: specificationBlob },
    activeImplementationPlan: { path: implementationPath, blob: implementationBlob },
  };
}

function sameOwnership(left: EpisodeOwnershipRecord | null, right: EpisodeOwnershipRecord): boolean {
  return left !== null && JSON.stringify(left) === JSON.stringify(right);
}

function canonicalMainStatusIsSafe(status: string): boolean {
  if (status === "") return true;
  return status.split(/\r?\n/).filter(Boolean).every((line) => line.startsWith("?? "));
}

/**
 * Replace one exact live version-1 authority binding with a task-native binding.
 * This is deliberately a post-review, post-merge, post-activation transition:
 * it creates no resources and changes no Git or task state.
 */
export function transitionLegacyEpisodeOwnershipToTask(
  input: LegacyTaskOwnershipTransitionInput,
  dependencies: LegacyTaskOwnershipTransitionDependencies = {},
): LegacyTaskOwnershipTransitionResult {
  if (!input.confirmedReady) {
    throw new Error("Ownership transition requires explicit confirmation after review, merge, activation, restart, and UAT");
  }
  if (!/^\.ralph\/plans\/future\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.sourceLocation)) {
    throw new Error("Ownership transition requires one exact retained future-plan source location");
  }
  if (!input.taskId || /\s/.test(input.taskId) || input.taskId.startsWith("-")) {
    throw new Error("Ownership transition requires one exact canonical Backlog task ID");
  }
  if (!input.ownerSessionId) throw new Error("Ownership transition requires the exact owner Conversation session");
  if (!input.expectedPreviousEpisodeActiveSessionId || !input.verifiedCurrentEpisodeActiveSessionId) {
    throw new Error("Ownership transition requires exact previous and verified current runtime routes");
  }
  if (!TRANSITION_GIT_OID.test(input.expectedMainHead) || !TRANSITION_GIT_OID.test(input.expectedEpisodeHead)) {
    throw new Error("Ownership transition requires exact main and Episode Git heads");
  }

  const git = dependencies.git ?? new CliLegacyTaskOwnershipTransitionGit();
  const ownership = dependencies.ownership ?? defaultOwnership;
  const resolver = dependencies.taskResolver ?? defaultOwnershipTaskResolver;
  const requestedRoot = realpathSync(input.projectRoot);
  const root = git.repositoryRoot(requestedRoot);
  if (root !== requestedRoot) throw new Error("Ownership transition must run from the repository root");
  if (!git.isPrimaryWorktree(root)) {
    throw new Error("Ownership transition must run from the canonical primary main checkout");
  }
  if (git.operationInProgress(root)) {
    throw new Error("Canonical main has a merge, rebase, cherry-pick, or revert in progress; ownership transition made no change");
  }
  if (git.branch(root) !== "main") {
    throw new Error("Ownership transition must run from the canonical primary main checkout");
  }
  if (git.head(root) !== input.expectedMainHead || git.upstreamHead(root) !== input.expectedMainHead) {
    throw new Error("Canonical main HEAD or upstream drifted from the reviewed transition evidence");
  }
  if (!canonicalMainStatusIsSafe(git.status(root))) throw new Error("Canonical main has staged or tracked working-tree changes; ownership transition made no change");

  const { selection, taskPath } = exactTransitionTask(root, input, resolver);
  const initial = ownership.read(root, input.ownerSessionId);
  if (!initial) throw new Error("Exact Episode ownership is missing before ownership transition");
  if (initial.status !== "active") throw new Error(`Ownership transition requires active ownership; found ${initial.status}`);
  if (initial.ownerSessionId !== input.ownerSessionId) throw new Error("Ownership transition requires the exact owner Conversation");

  if (isLegacyEpisodeOwnership(initial)) {
    if (initial.sourceLocation !== input.sourceLocation) throw new Error("Ownership transition source location does not match active ownership");
    if (initial.episodeActiveSessionId !== input.expectedPreviousEpisodeActiveSessionId) {
      throw new Error("Ownership transition previous runtime route drifted before atomic replacement");
    }
  } else {
    if (!isBacklogTaskEpisodeOwnership(initial)) {
      throw new Error("Legacy ownership transition replay does not yet support Beads ownership");
    }
    if (initial.taskId !== input.taskId || initial.taskPath !== taskPath
      || initial.episodeActiveSessionId !== input.verifiedCurrentEpisodeActiveSessionId) {
      throw new Error("Existing task-native ownership does not match the completed transition binding");
    }
  }

  const sourceReference = `legacy-episode-source=${input.sourceLocation}; superseded-by=${input.taskId}`;
  if (!selection.references?.includes(sourceReference)) {
    throw new Error("Ownership transition task does not preserve the exact superseded legacy source binding");
  }

  const requiredIdentity = [
    initial.operationId, initial.worktree, initial.branch, initial.head, initial.episodeId,
    initial.episodeSessionFile, initial.episodeActiveSessionId,
  ];
  if (requiredIdentity.some((value) => typeof value !== "string" || value === "")) {
    throw new Error("Ownership transition lacks complete operation, worktree, Episode, or session identity");
  }
  assertRegularNonemptyFile(initial.episodeSessionFile!, "Owned Episode session transcript");
  const episodeRoot = realpathSync(initial.worktree!);
  if (git.repositoryRoot(episodeRoot) !== episodeRoot) throw new Error("Owned Episode worktree is not a repository root");
  const worktree = git.worktrees(root).find((entry) => entry.path === episodeRoot);
  if (!worktree || worktree.branch !== initial.branch) throw new Error("Owned Episode worktree or branch no longer matches ownership");
  if (worktree.head !== input.expectedEpisodeHead || git.head(episodeRoot) !== input.expectedEpisodeHead
    || git.upstreamHead(episodeRoot) !== input.expectedEpisodeHead) {
    throw new Error("Owned Episode HEAD or upstream drifted from the reviewed transition evidence");
  }
  if (git.status(episodeRoot) !== "") throw new Error("Owned Episode worktree is dirty; ownership transition made no change");
  if (!TRANSITION_GIT_OID.test(initial.baseRef) || !TRANSITION_GIT_OID.test(initial.head!)) {
    throw new Error("Ownership transition lacks exact admission or resource-head evidence");
  }
  if (!git.isAncestor(root, initial.baseRef, initial.head!)
    || !git.isAncestor(root, initial.baseRef, input.expectedEpisodeHead)
    || !git.isAncestor(root, initial.baseRef, input.expectedMainHead)
    || !git.isAncestor(root, input.expectedEpisodeHead, input.expectedMainHead)) {
    throw new Error("Ownership transition branch or HEAD ancestry is unsafe");
  }
  const admissionPaths = git.commitPaths(root, initial.baseRef);
  if (admissionPaths.length !== 1 || admissionPaths[0] !== taskPath) {
    throw new Error("Ownership transition admission evidence is not the exact task-only status commit");
  }
  let mainTaskBlob: string;
  let episodeTaskBlob: string;
  try {
    mainTaskBlob = git.blobOid(root, input.expectedMainHead, taskPath);
    episodeTaskBlob = git.blobOid(episodeRoot, input.expectedEpisodeHead, taskPath);
  } catch {
    throw new Error("Ownership transition cannot prove the exact committed task on main and the Episode branch");
  }
  if (mainTaskBlob !== episodeTaskBlob || !TRANSITION_GIT_OID.test(mainTaskBlob)) {
    throw new Error("Committed main task evidence differs from the reviewed Episode task");
  }
  const plans = activePlanEvidence(initial, git, input.expectedEpisodeHead);
  const normalizePlan = (value: string) => value.replace(/\r\n/g, "\n").replace(/\n+$/, "");
  const activePlan = readFileSync(join(episodeRoot, plans.activeImplementationPlan.path), "utf8");
  if (!selection.implementationPlan || normalizePlan(selection.implementationPlan) !== normalizePlan(activePlan)) {
    throw new Error("Committed task Implementation Plan does not exactly match the active Episode execution plan");
  }

  if (isTaskEpisodeOwnership(initial)) {
    return { record: initial, reused: true, mainHead: input.expectedMainHead, episodeHead: input.expectedEpisodeHead, ...plans };
  }

  const { version: _version, sourceLocation: _sourceLocation, slug: _slug, bundleDigest: _bundleDigest, ...preserved } = initial;
  const target = parseEpisodeOwnership({
    ...preserved,
    version: 2,
    provider: "backlog",
    taskId: input.taskId,
    taskPath,
    episodeActiveSessionId: input.verifiedCurrentEpisodeActiveSessionId,
    updatedAt: dependencies.now?.() ?? new Date().toISOString(),
  }) as BacklogTaskEpisodeOwnershipRecord;

  if (git.operationInProgress(root) || git.head(root) !== input.expectedMainHead || git.upstreamHead(root) !== input.expectedMainHead
    || !canonicalMainStatusIsSafe(git.status(root)) || git.head(episodeRoot) !== input.expectedEpisodeHead
    || git.upstreamHead(episodeRoot) !== input.expectedEpisodeHead || git.status(episodeRoot) !== "") {
    throw new Error("Git state changed during ownership transition validation");
  }
  const beforeWrite = ownership.read(root, input.ownerSessionId);
  if (!sameOwnership(beforeWrite, initial)) throw new Error("Episode ownership changed during transition validation");

  try { ownership.write(root, target); }
  catch (error) {
    let afterFailure: EpisodeOwnershipRecord | null = null;
    try { afterFailure = ownership.read(root, input.ownerSessionId); } catch { /* fail closed below */ }
    if (!sameOwnership(afterFailure, target)) {
      throw new Error(`Ownership transition write did not complete atomically: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const stored = ownership.read(root, input.ownerSessionId);
  if (!sameOwnership(stored, target)) throw new Error("Ownership transition could not verify the exact completed binding");
  return { record: target, reused: false, mainHead: input.expectedMainHead, episodeHead: input.expectedEpisodeHead, ...plans };
}

/**
 * Persist the durable task-native provisioning boundary after the exact status
 * commit and before any branch, worktree, session, or assignment is created.
 */
export function reserveTaskEpisodeOwnership(
  input: TaskEpisodeReservationInput,
  dependencies: TaskEpisodeReservationDependencies = {},
): BacklogTaskEpisodeOwnershipRecord {
  const git = dependencies.git ?? new CliTaskEpisodeReservationGit();
  const ownership = dependencies.ownership ?? defaultOwnership;
  if (!input.taskId || /\s/.test(input.taskId) || input.taskId.startsWith("-")) {
    throw new Error("Task-native Episode reservation requires a canonical Backlog task ID");
  }
  const requestedRoot = realpathSync(input.projectRoot);
  const selection = (dependencies.taskResolver ?? defaultOwnershipTaskResolver)(requestedRoot, input.taskId);
  if (!selection) throw new Error(`Backlog task ${input.taskId} is unavailable for Episode reservation`);
  if (selection.taskId !== input.taskId) throw new Error("Task-native Episode reservation requires the exact canonical Backlog task ID");
  const projectRoot = realpathSync(selection.projectRoot);
  if (resolve(projectRoot) !== resolve(requestedRoot)) throw new Error("Task-native Episode reservation task resolved in a different project");
  const repositoryRoot = git.repositoryRoot(projectRoot);
  if (resolve(repositoryRoot) !== resolve(projectRoot)) throw new Error("Task-native Episode reservation must run from the repository root");
  if (!input.ownerSessionId) throw new Error("Task-native Episode reservation requires an exact owner session");
  if (selection.status !== "In Progress") throw new Error("Task-native Episode reservation requires the exact task to be committed as In Progress");
  if (!meaningfulTaskImplementationPlan(selection.implementationPlan)) throw new Error("Task-native Episode reservation requires a meaningful Implementation Plan");

  const selectedTaskPath = resolve(selection.taskPath);
  const stat = lstatSync(selectedTaskPath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Task-native Episode reservation task is not a regular file");
  const taskPath = realpathSync(selectedTaskPath);
  if (!containedBy(projectRoot, taskPath)) throw new Error("Task-native Episode reservation task escaped the project root");
  const taskPathRelative = portableRelativePath(projectRoot, taskPath);
  if (taskPathRelative !== selection.taskPathRelative) throw new Error("Task-native Episode reservation task path changed after Backlog resolution");

  const baseRef = input.baseRef ?? git.head(projectRoot);
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(baseRef)) throw new Error("Task-native Episode reservation requires an exact Git status-commit SHA");
  if (input.baseRef && git.head(projectRoot) !== baseRef) {
    throw new Error("Canonical main changed before the exact task-native Episode reservation");
  }
  const committedPaths = git.commitPaths(projectRoot, baseRef);
  if (committedPaths.length !== 1 || committedPaths[0] !== taskPathRelative) {
    throw new Error("Task-native Episode status commit must contain only the exact Backlog task path");
  }
  if (git.pathStatus(projectRoot, taskPathRelative) !== "") {
    throw new Error("Task-native Episode task changed after its status commit");
  }

  const existing = ownership.read(projectRoot, input.ownerSessionId);
  if (existing && existing.status !== "inactive") {
    const identity = existing.version === 2 ? existing.taskId : existing.sourceLocation;
    throw new Error(`Non-terminal Episode ownership already exists for ${identity}; inspect it instead of reserving again`);
  }
  if (input.engine === "orca" && !input.projectSetupId) {
    throw new Error("Task-native Orca reservation requires an exact project setup");
  }
  if (input.engine === "local" && (input.projectSetupId || input.routingEnvironmentId)) {
    throw new Error("Task-native local reservation cannot carry Orca placement identity");
  }

  const operationId = input.operationId ?? randomUUID();
  if (!/^[A-Za-z0-9-]+$/.test(operationId)) throw new Error("Task-native Episode reservation requires a safe operation ID");
  const now = dependencies.now?.() ?? new Date().toISOString();
  const record: BacklogTaskEpisodeOwnershipRecord = {
    version: 2,
    provider: "backlog",
    status: "provisioning",
    operationId,
    engine: input.engine,
    ownerSessionId: input.ownerSessionId,
    taskId: selection.taskId,
    taskPath: taskPathRelative,
    baseRef,
    createdAt: now,
    updatedAt: now,
    ...(input.projectSetupId ? { projectSetupId: input.projectSetupId } : {}),
    ...(input.routingEnvironmentId ? { routingEnvironmentId: input.routingEnvironmentId } : {}),
  };
  parseEpisodeOwnership(record);
  ownership.write(projectRoot, record);
  return record;
}


const BEADS_RESERVATION_REVISION = /^[0-9a-v]{32}$/;
const BEADS_IN_PROGRESS_STATUS = "in_progress";

/**
 * Persist one Beads task-native provisioning reservation from the already
 * published provider-native status result. The public admission path calls
 * this only after exact serialized provider publication proof.
 */
export function reservePublishedBeadsTaskEpisodeOwnership(
  input: BeadsTaskEpisodeReservationInput,
  dependencies: BeadsTaskEpisodeReservationDependencies = {},
): BeadsTaskEpisodeOwnershipRecord {
  if (input.publication.status !== "published") {
    throw new Error("Beads Episode reservation requires an already-published native status result");
  }
  const evidence = input.publication.evidence;
  if (evidence.provider !== "beads") {
    throw new Error("Beads Episode reservation requires exact provider-native publication evidence");
  }

  const requestedRoot = realpathSync(input.projectRoot);
  const publishedRoot = realpathSync(evidence.projectRoot);
  if (resolve(publishedRoot) !== resolve(requestedRoot)) {
    throw new Error("Beads Episode reservation publication resolved in a different project");
  }
  const git = dependencies.git ?? new CliBeadsTaskEpisodeReservationGit();
  const projectRoot = git.repositoryRoot(requestedRoot);
  if (resolve(projectRoot) !== resolve(requestedRoot)) {
    throw new Error("Beads Episode reservation must run from the exact repository root");
  }
  if (!evidence.taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(evidence.taskId)) {
    throw new Error("Beads Episode reservation requires the exact canonical published task ID");
  }
  if (!BEADS_RESERVATION_REVISION.test(evidence.publishedRevision)
      || evidence.committedRevision !== evidence.publishedRevision
      || evidence.localPublishedProof.revision !== evidence.publishedRevision
      || evidence.localPublishedProof.clean !== true
      || evidence.remotePublishedTask.revision !== evidence.publishedRevision) {
    throw new Error("Beads Episode reservation requires one exact clean published provider revision");
  }

  const publishedTask = evidence.taskPublished;
  const rawTask = publishedTask.nativeView;
  const remoteTask = evidence.remotePublishedTask.taskRow;
  if (publishedTask.taskId !== evidence.taskId
      || publishedTask.canonicalStatus !== "In Progress"
      || publishedTask.nativeStatus !== BEADS_IN_PROGRESS_STATUS
      || !rawTask || typeof rawTask !== "object" || Array.isArray(rawTask)
      || rawTask.id !== evidence.taskId
      || rawTask.title !== publishedTask.title
      || rawTask.status !== publishedTask.nativeStatus
      || !remoteTask || typeof remoteTask !== "object" || Array.isArray(remoteTask)
      || remoteTask.id !== rawTask.id
      || remoteTask.title !== rawTask.title
      || remoteTask.status !== rawTask.status) {
    throw new Error("Beads Episode reservation requires matching raw published In Progress task evidence");
  }

  if (!input.ownerSessionId) throw new Error("Beads Episode reservation requires an exact owner session");
  if (input.engine === "orca" && !input.projectSetupId) {
    throw new Error("Beads Orca reservation requires an exact project setup");
  }
  if (input.engine === "local" && (input.projectSetupId || input.routingEnvironmentId)) {
    throw new Error("Beads local reservation cannot carry Orca placement identity");
  }
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(input.baseRef)) {
    throw new Error("Beads Episode reservation requires an exact Git code HEAD");
  }
  if (git.head(projectRoot) !== input.baseRef || git.status(projectRoot) !== "") {
    throw new Error("Beads Episode reservation requires the exact clean Git code HEAD/baseRef");
  }

  const ownership = dependencies.ownership ?? defaultOwnership;
  const initial = ownership.read(projectRoot, input.ownerSessionId);
  if (initial && initial.status !== "inactive") {
    const identity = initial.version === 2 ? initial.taskId : initial.sourceLocation;
    throw new Error(`Non-terminal Episode ownership already exists for ${identity}; inspect it instead of reserving again`);
  }
  const operationId = input.operationId ?? randomUUID();
  if (!/^[A-Za-z0-9-]+$/.test(operationId)) {
    throw new Error("Beads Episode reservation requires a safe operation ID");
  }
  const now = dependencies.now?.() ?? new Date().toISOString();
  const record = parseEpisodeOwnership({
    version: 2,
    provider: "beads",
    status: "provisioning",
    operationId,
    engine: input.engine,
    ownerSessionId: input.ownerSessionId,
    taskId: evidence.taskId,
    providerRevision: evidence.publishedRevision,
    taskEvidence: rawTask,
    baseRef: input.baseRef,
    createdAt: now,
    updatedAt: now,
    ...(input.projectSetupId ? { projectSetupId: input.projectSetupId } : {}),
    ...(input.routingEnvironmentId ? { routingEnvironmentId: input.routingEnvironmentId } : {}),
  }) as BeadsTaskEpisodeOwnershipRecord;

  if (git.head(projectRoot) !== input.baseRef || git.status(projectRoot) !== "") {
    throw new Error("Git state changed during Beads Episode reservation validation");
  }
  const beforeWrite = ownership.read(projectRoot, input.ownerSessionId);
  if ((initial === null) !== (beforeWrite === null)
      || (initial !== null && beforeWrite !== null && JSON.stringify(initial) !== JSON.stringify(beforeWrite))) {
    throw new Error("Episode ownership changed during Beads reservation validation");
  }
  ownership.write(projectRoot, record);
  const stored = ownership.read(projectRoot, input.ownerSessionId);
  if (!sameOwnership(stored, record)) {
    throw new Error("Beads Episode reservation could not verify the exact completed binding");
  }
  return record;
}


function exactBeadsProviderRevisionAncestor(
  cwd: string,
  ancestor: string,
  descendant: string,
  runner: CommandRunner,
): boolean {
  if (ancestor === descendant) return true;
  const query = `SELECT dolt_merge_base('${ancestor}', '${descendant}') AS merge_base`;
  const result = runner.run("bd", ["--readonly", "sql", "--json", query], { cwd, allowFailure: true });
  if (result.status !== 0) {
    throw new Error(`Beads evidence advancement could not prove provider revision ancestry: ${result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`}`);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(result.stdout); }
  catch (error) {
    throw new Error(`Beads evidence advancement received invalid provider ancestry JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const row = Array.isArray(parsed) && parsed.length === 1 && parsed[0]
    && typeof parsed[0] === "object" && !Array.isArray(parsed[0])
    ? parsed[0] as Record<string, unknown>
    : null;
  if (!row || typeof row.merge_base !== "string" || !BEADS_RESERVATION_REVISION.test(row.merge_base)) {
    throw new Error("Beads evidence advancement received unsupported provider ancestry evidence");
  }
  return row.merge_base === ancestor;
}

function proveBeadsEpisodeCodeHead(
  record: BeadsTaskEpisodeOwnershipRecord,
  episodeHead: string,
  git: BeadsTaskEvidenceAdvancementGit,
): void {
  const episodeRoot = realpathSync(record.worktree!);
  if (git.repositoryRoot(episodeRoot) !== episodeRoot) {
    throw new Error("Beads evidence advancement requires the exact recorded Episode repository root");
  }
  if (git.operationInProgress(episodeRoot) || git.status(episodeRoot) !== "") {
    throw new Error("Beads evidence advancement requires a clean Episode worktree with no Git operation in progress");
  }
  if (git.branch(episodeRoot) !== record.branch) {
    throw new Error("Beads evidence advancement recorded Episode branch drifted");
  }
  const localHead = git.head(episodeRoot);
  const upstreamHead = git.upstreamHead(episodeRoot);
  const directRemoteHead = git.directRemoteHead(episodeRoot, record.branch!);
  if (localHead !== episodeHead || upstreamHead !== episodeHead || directRemoteHead !== episodeHead) {
    throw new Error("Beads evidence advancement requires the exact pushed local/upstream/direct-remote Episode head");
  }
  if (!record.head || !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(record.head)
      || !git.isAncestor(episodeRoot, record.baseRef, record.head)
      || !git.isAncestor(episodeRoot, record.head, episodeHead)
      || !git.isAncestor(episodeRoot, record.baseRef, episodeHead)) {
    throw new Error("Beads evidence advancement found unsafe Episode base/head ancestry");
  }
}

function activeForeignBeadsEvidenceCollision(
  retained: BeadsTaskEpisodeOwnershipRecord,
  allRecords: readonly EpisodeOwnershipRecord[],
): EpisodeOwnershipRecord | null {
  return allRecords.find((record) => record.ownerSessionId !== retained.ownerSessionId
    && record.status !== "inactive"
    && ((record.version === 2 && record.taskId === retained.taskId)
      || (record.episodeId !== undefined && record.episodeId === retained.episodeId)
      || (record.worktree !== undefined && record.worktree === retained.worktree)
      || (record.branch !== undefined && record.branch === retained.branch))) ?? null;
}

/**
 * Refresh factual provider/task/code observations on one retained active Beads
 * owner. This internal primitive creates no owner, task mutation, status
 * transition, lifecycle routing, semantic acceptance, or retry. Exact previous
 * and current native task views are returned for the existing Episode LLM.
 */
export function advancePublishedBeadsTaskEpisodeEvidence(
  input: BeadsTaskEvidenceAdvancementInput,
  dependencies: BeadsTaskEvidenceAdvancementDependencies = {},
): BeadsTaskEvidenceAdvancementResult {
  if (!input.ownerSessionId) throw new Error("Beads evidence advancement requires the exact requesting owner");
  const ownershipRoot = realpathSync(input.projectRoot);
  const ownership = dependencies.ownership ?? defaultBeadsEvidenceAdvancementOwnership;

  // The exact owner is selected before provider/task interpretation. Never scan
  // owners to infer a binding from task ID or placement.
  const selected = ownership.read(ownershipRoot, input.ownerSessionId);
  if (!selected) throw new Error("Beads evidence advancement found no ownership for the exact requesting owner");
  if (selected.ownerSessionId !== input.ownerSessionId) {
    throw new Error("Beads evidence advancement ownership does not match the exact requesting owner");
  }
  if (selected.version !== 2 || selected.status !== "active" || !isBeadsTaskEpisodeOwnership(selected)) {
    throw new Error("Beads evidence advancement requires one retained active provider-specific Beads owner");
  }
  if (selected.taskId !== input.taskId) {
    throw new Error("Beads evidence advancement task does not match the exact retained owner");
  }
  if (!BEADS_RESERVATION_REVISION.test(input.previousProviderRevision)
      || !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(input.episodeHead)) {
    throw new Error("Beads evidence advancement requires exact previous provider and Episode revisions");
  }
  if (!selected.worktree || !selected.branch || !selected.head || !selected.episodeId
      || !selected.episodeSessionFile || !selected.episodeActiveSessionId) {
    throw new Error("Beads evidence advancement requires complete retained Episode identity");
  }
  assertRegularNonemptyFile(selected.episodeSessionFile, "Owned Beads Episode session transcript");
  const episodeRoot = realpathSync(selected.worktree);

  // Validate the persisted observation without inventing a second task model.
  parseEpisodeOwnership({
    ...selected,
    providerRevision: input.previousProviderRevision,
    taskEvidence: input.previousTaskEvidence,
    head: input.episodeHead,
  }, "previous Beads evidence advancement input");
  if (input.previousProviderRevision !== selected.providerRevision
      || JSON.stringify(input.previousTaskEvidence) !== JSON.stringify(selected.taskEvidence)) {
    throw new Error("Beads evidence advancement input does not match the exact persisted provider observation");
  }
  if (input.previousTaskEvidence.id !== input.taskId) {
    throw new Error("Beads evidence advancement requires exact previous raw task identity");
  }

  const runner = dependencies.runner ?? new ProcessCommandRunner();
  const detectProvider = dependencies.detectProvider ?? detectTaskProvider;
  const primaryProvider = detectProvider(ownershipRoot, runner);
  const episodeProvider = detectProvider(episodeRoot, runner);
  const providerIdentityMatches = primaryProvider.kind === "selected"
    && episodeProvider.kind === "selected"
    && primaryProvider.evidence.provider === "beads"
    && episodeProvider.evidence.provider === "beads"
    && realpathSync(primaryProvider.projectRoot) === ownershipRoot
    && realpathSync(episodeProvider.projectRoot) === episodeRoot
    && realpathSync(primaryProvider.evidence.storeDir) === realpathSync(episodeProvider.evidence.storeDir)
    && realpathSync(primaryProvider.evidence.metadataPath) === realpathSync(episodeProvider.evidence.metadataPath)
    && realpathSync(primaryProvider.evidence.configPath) === realpathSync(episodeProvider.evidence.configPath)
    && primaryProvider.evidence.doltMode === episodeProvider.evidence.doltMode
    && primaryProvider.evidence.doltDatabase === episodeProvider.evidence.doltDatabase;
  if (!providerIdentityMatches) {
    throw new Error("Beads evidence advancement linked worktree does not resolve the exact canonical provider store and database");
  }
  const synchronization = dependencies.synchronize
    ? dependencies.synchronize(episodeRoot, runner)
    : runner.run("bd", ["dolt", "pull"], { cwd: episodeRoot, allowFailure: true });
  if (synchronization.status !== 0) {
    throw new Error(`Beads evidence advancement native synchronization failed; no evidence was changed: ${synchronization.stderr.trim() || synchronization.stdout.trim() || `exit ${synchronization.status}`}`);
  }
  const preparation = (dependencies.prepareTransport ?? prepareBeadsWorkspaceTransport)(ownershipRoot, runner);
  if (preparation.status !== "ready") {
    throw new Error(`Beads evidence advancement native publication proof is blocked (${preparation.code}): ${preparation.detail}`);
  }
  const prepared = preparation.evidence;
  if (realpathSync(prepared.projectRoot) !== ownershipRoot
      || prepared.provider !== "beads"
      || prepared.publishedRevision !== prepared.revision
      || !BEADS_RESERVATION_REVISION.test(prepared.publishedRevision)) {
    throw new Error("Beads evidence advancement publication proof does not match the exact recorded Episode project");
  }
  const currentTask = (dependencies.resolveTask ?? resolveProviderTask)(episodeRoot, input.taskId, runner);
  if (!currentTask || currentTask.provider !== "beads" || currentTask.taskId !== input.taskId
      || realpathSync(currentTask.projectRoot) !== episodeRoot) {
    throw new Error("Beads evidence advancement could not prove the exact native task identity and project");
  }

  // Pair the long raw task read with a second fresh native publication proof.
  // Provider movement or a dirty/unpublished store during that read is a real
  // transport-integrity failure, not a semantic approval state.
  const pairedPreparation = (dependencies.pairTransport ?? prepareBeadsWorkspaceTransport)(ownershipRoot, runner);
  if (pairedPreparation.status !== "ready") {
    throw new Error(`Beads evidence advancement paired publication proof is blocked (${pairedPreparation.code}): ${pairedPreparation.detail}`);
  }
  const paired = pairedPreparation.evidence;
  const pairedIdentityMatches = realpathSync(paired.projectRoot) === ownershipRoot
    && paired.provider === "beads"
    && paired.publishedRevision === paired.revision
    && BEADS_RESERVATION_REVISION.test(paired.publishedRevision)
    && paired.database === prepared.database
    && paired.branch === prepared.branch
    && paired.remoteName === prepared.remoteName
    && paired.remoteUrl === prepared.remoteUrl
    && paired.publicationRef === prepared.publicationRef
    && paired.publishedRevision === prepared.publishedRevision;
  if (!pairedIdentityMatches) {
    throw new Error("Beads evidence advancement publication identity changed during the paired native read");
  }
  if (currentTask.nativeStatus !== BEADS_IN_PROGRESS_STATUS || currentTask.status !== "In Progress"
      || !meaningfulTaskImplementationPlan(
        typeof currentTask.nativeView.design === "string" ? currentTask.nativeView.design : null,
      )) {
    throw new Error("Beads evidence advancement requires the exact current native In Progress task with a meaningful design before ownership mutation");
  }
  const revisionIsAncestor = dependencies.providerRevisionIsAncestor ?? exactBeadsProviderRevisionAncestor;
  if (!revisionIsAncestor(episodeRoot, input.previousProviderRevision, paired.publishedRevision, runner)) {
    throw new Error("Beads evidence advancement previous provider revision is not an ancestor of the current published revision");
  }

  const git = dependencies.git ?? new CliBeadsTaskEvidenceAdvancementGit();
  const target = parseEpisodeOwnership({
    ...selected,
    providerRevision: paired.publishedRevision,
    taskEvidence: currentTask.nativeView,
    head: input.episodeHead,
    updatedAt: dependencies.now?.() ?? new Date().toISOString(),
  }, "advanced Beads Episode evidence") as BeadsTaskEpisodeOwnershipRecord;

  const commit = (): BeadsTaskEpisodeOwnershipRecord => {
    let mutationResult: EpisodeOwnershipRecord | null;
    try {
      mutationResult = ownership.mutate(ownershipRoot, input.ownerSessionId, (current, allRecords) => {
        if (!sameOwnership(current, selected)) {
          throw new Error("Beads evidence advancement owner or binding drifted before atomic mutation");
        }
        if (activeForeignBeadsEvidenceCollision(selected, allRecords)) {
          throw new Error("Beads evidence advancement found a foreign active owner collision");
        }
        // Put the pushed-head proof immediately beside the sole ownership write.
        proveBeadsEpisodeCodeHead(selected, input.episodeHead, git);
        return target;
      });
    } catch (error) {
      let observed: EpisodeOwnershipRecord | null = null;
      try { observed = ownership.read(ownershipRoot, input.ownerSessionId); } catch { /* exact uncertainty below */ }
      if (sameOwnership(observed, target)) mutationResult = target;
      else if (sameOwnership(observed, selected)) throw error;
      else {
        throw new Error(`Beads evidence advancement write is uncertain and made no retry: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!sameOwnership(mutationResult, target)) {
      throw new Error("Beads evidence advancement atomic store returned unexpected ownership evidence");
    }
    const stored = ownership.read(ownershipRoot, input.ownerSessionId);
    if (!sameOwnership(stored, target)) {
      throw new Error("Beads evidence advancement could not re-read the exact persisted evidence");
    }
    return target;
  };
  return {
    record: target,
    previousProviderRevision: input.previousProviderRevision,
    publishedProviderRevision: paired.publishedRevision,
    previousTaskEvidence: input.previousTaskEvidence,
    currentTaskEvidence: currentTask.nativeView,
    commit,
  };
}
