import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep, win32 } from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

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
  type BacklogTaskSelection,
} from "./reviewed-plan-support.ts";

export interface TaskEpisodeReservationGit {
  repositoryRoot(cwd: string): string;
  head(repo: string): string;
  commitPaths(repo: string, ref: string): string[];
  pathStatus(repo: string, path: string): string;
}

export interface TaskEpisodeReservationStore {
  read(projectRoot: string): EpisodeOwnershipRecord | null;
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
}

export interface TaskEpisodeReservationDependencies {
  git?: TaskEpisodeReservationGit;
  ownership?: TaskEpisodeReservationStore;
  taskResolver?: (cwd: string, taskId: string) => BacklogTaskSelection | null;
  now?: () => string;
}

export interface LegacyTaskOwnershipTransitionInput {
  projectRoot: string;
  sourceLocation: string;
  taskId: string;
  ownerSessionId: string;
  expectedMainHead: string;
  expectedEpisodeHead: string;
  confirmedReady: boolean;
}

export interface LegacyTaskOwnershipTransitionGit {
  repositoryRoot(cwd: string): string;
  isPrimaryWorktree(repo: string): boolean;
  branch(repo: string): string;
  head(repo: string): string;
  upstreamHead(repo: string): string;
  status(repo: string): string;
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
  record: TaskEpisodeOwnershipRecord;
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
  const lines = status.split(/\r?\n/).filter(Boolean);
  return lines.length === 1 && lines[0] === "?? .prime-claw/ownership.json";
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
  if (!TRANSITION_GIT_OID.test(input.expectedMainHead) || !TRANSITION_GIT_OID.test(input.expectedEpisodeHead)) {
    throw new Error("Ownership transition requires exact main and Episode Git heads");
  }

  const git = dependencies.git ?? new CliLegacyTaskOwnershipTransitionGit();
  const ownership = dependencies.ownership ?? defaultOwnership;
  const resolver = dependencies.taskResolver ?? resolveBacklogTask;
  const requestedRoot = realpathSync(input.projectRoot);
  const root = git.repositoryRoot(requestedRoot);
  if (root !== requestedRoot) throw new Error("Ownership transition must run from the repository root");
  if (!git.isPrimaryWorktree(root) || git.branch(root) !== "main") {
    throw new Error("Ownership transition must run from the canonical primary main checkout");
  }
  if (git.head(root) !== input.expectedMainHead || git.upstreamHead(root) !== input.expectedMainHead) {
    throw new Error("Canonical main HEAD or upstream drifted from the reviewed transition evidence");
  }
  if (!canonicalMainStatusIsSafe(git.status(root))) throw new Error("Canonical main is dirty beyond its exact ownership record; ownership transition made no change");

  const { selection, taskPath } = exactTransitionTask(root, input, resolver);
  const initial = ownership.read(root);
  if (!initial) throw new Error("Exact Episode ownership is missing before ownership transition");
  if (initial.status !== "active") throw new Error(`Ownership transition requires active ownership; found ${initial.status}`);
  if (initial.ownerSessionId !== input.ownerSessionId) throw new Error("Ownership transition requires the exact owner Conversation");

  if (isLegacyEpisodeOwnership(initial)) {
    if (initial.sourceLocation !== input.sourceLocation) throw new Error("Ownership transition source location does not match active ownership");
  } else {
    if (initial.taskId !== input.taskId || initial.taskPath !== taskPath) {
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
    taskId: input.taskId,
    taskPath,
    updatedAt: dependencies.now?.() ?? new Date().toISOString(),
  }) as TaskEpisodeOwnershipRecord;

  if (git.head(root) !== input.expectedMainHead || git.upstreamHead(root) !== input.expectedMainHead || !canonicalMainStatusIsSafe(git.status(root))
    || git.head(episodeRoot) !== input.expectedEpisodeHead || git.upstreamHead(episodeRoot) !== input.expectedEpisodeHead || git.status(episodeRoot) !== "") {
    throw new Error("Git state changed during ownership transition validation");
  }
  const beforeWrite = ownership.read(root);
  if (!sameOwnership(beforeWrite, initial)) throw new Error("Episode ownership changed during transition validation");

  try { ownership.write(root, target); }
  catch (error) {
    let afterFailure: EpisodeOwnershipRecord | null = null;
    try { afterFailure = ownership.read(root); } catch { /* fail closed below */ }
    if (!sameOwnership(afterFailure, target)) {
      throw new Error(`Ownership transition write did not complete atomically: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const stored = ownership.read(root);
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
): TaskEpisodeOwnershipRecord {
  const git = dependencies.git ?? new CliTaskEpisodeReservationGit();
  const ownership = dependencies.ownership ?? defaultOwnership;
  if (!input.taskId || /\s/.test(input.taskId) || input.taskId.startsWith("-")) {
    throw new Error("Task-native Episode reservation requires a canonical Backlog task ID");
  }
  const requestedRoot = realpathSync(input.projectRoot);
  const selection = (dependencies.taskResolver ?? resolveBacklogTask)(requestedRoot, input.taskId);
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

  const baseRef = git.head(projectRoot);
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(baseRef)) throw new Error("Task-native Episode reservation requires an exact Git status-commit SHA");
  const committedPaths = git.commitPaths(projectRoot, baseRef);
  if (committedPaths.length !== 1 || committedPaths[0] !== taskPathRelative) {
    throw new Error("Task-native Episode status commit must contain only the exact Backlog task path");
  }
  if (git.pathStatus(projectRoot, taskPathRelative) !== "") {
    throw new Error("Task-native Episode task changed after its status commit");
  }

  const existing = ownership.read(projectRoot);
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
  const record: TaskEpisodeOwnershipRecord = {
    version: 2,
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
