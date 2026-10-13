import { lstatSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep, win32 } from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

import {
  parseEpisodeOwnership,
  readEpisodeOwnership,
  writeEpisodeOwnership,
  type EpisodeOwnershipRecord,
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
