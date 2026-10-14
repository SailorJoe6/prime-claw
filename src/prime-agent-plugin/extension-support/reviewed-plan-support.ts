import { existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep, win32 } from "node:path";
import {
  type CommandRunner,
  ProcessCommandRunner,
  resolveNearestProjectRoot,
} from "./project-initialization.ts";

export interface FutureLocation {
  location: string;
  slug: string;
  projectRoot: string;
  folder: string;
}

/**
 * The task fields needed by the reviewed lifecycle boundary. Backlog remains the
 * task model and Markdown owner; this selection is only the result of one
 * supported `backlog task view --json` lookup.
 */
export interface BacklogTaskSelection {
  taskId: string;
  title: string;
  status: string;
  implementationPlan: string | null;
  references?: string[];
  projectRoot: string;
  taskPath: string;
  taskPathRelative: string;
}

const SAFE_LOCATION = /^\.ralph\/plans\/future\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

function containedBy(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child);
  return pathFromParent !== ""
    && pathFromParent !== ".."
    && !pathFromParent.startsWith(`..${sep}`)
    && !isAbsolute(pathFromParent);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function parseTaskView(stdout: string, selectedTaskId: string): {
  taskId: string;
  title: string;
  status: string;
  implementationPlan: string | null;
  references?: string[];
  taskPathRelative: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Backlog returned invalid JSON for ${selectedTaskId}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const view = record(parsed, "Backlog task view");
  if (view.schemaVersion !== 1 || view.kind !== "task-view") {
    throw new Error(`Backlog returned an unsupported task-view schema for ${selectedTaskId}`);
  }
  const task = record(view.task, "Backlog task");
  if (typeof task.id !== "string" || !task.id.trim()) {
    throw new Error(`Backlog returned no canonical task ID for ${selectedTaskId}`);
  }
  if (typeof task.title !== "string" || !task.title.trim()) {
    throw new Error(`Backlog task ${selectedTaskId} has no title`);
  }
  if (typeof task.status !== "string" || !task.status.trim()) {
    throw new Error(`Backlog task ${selectedTaskId} has no status`);
  }
  if (task.implementationPlan !== null && typeof task.implementationPlan !== "string") {
    throw new Error(`Backlog task ${selectedTaskId} has an invalid implementation plan field`);
  }
  if (task.references !== undefined && (!Array.isArray(task.references)
    || task.references.some((reference) => typeof reference !== "string" || reference === ""))) {
    throw new Error(`Backlog task ${selectedTaskId} has an invalid references field`);
  }
  if (typeof task.path !== "string" || !task.path || isAbsolute(task.path) || win32.isAbsolute(task.path)) {
    throw new Error(`Backlog task ${selectedTaskId} has an invalid task path`);
  }
  return {
    taskId: task.id,
    title: task.title,
    status: task.status,
    implementationPlan: task.implementationPlan,
    ...(task.references === undefined ? {} : { references: task.references as string[] }),
    taskPathRelative: task.path,
  };
}

/** Resolve one explicit task through Backlog's supported JSON interface. */
export function resolveBacklogTask(
  cwd: string,
  rawTaskId: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): BacklogTaskSelection | null {
  const selectedTaskId = rawTaskId.trim();
  if (!selectedTaskId || /\s/.test(selectedTaskId) || selectedTaskId.startsWith("-")) return null;

  const projectRoot = resolveNearestProjectRoot(cwd).root;
  const result = runner.run("backlog", ["task", "view", "--json", "--", selectedTaskId], {
    cwd: projectRoot,
    allowFailure: true,
  });
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`;
    throw new Error(`Backlog could not resolve ${selectedTaskId}: ${detail}`);
  }

  const task = parseTaskView(result.stdout, selectedTaskId);
  const taskPath = resolve(projectRoot, task.taskPathRelative);
  if (!containedBy(projectRoot, taskPath) || !existsSync(taskPath)) {
    throw new Error(`Backlog task ${selectedTaskId} resolved outside the project or disappeared`);
  }
  const taskStat = lstatSync(taskPath);
  if (!taskStat.isFile() || taskStat.isSymbolicLink()) {
    throw new Error(`Backlog task ${selectedTaskId} path is not a regular file`);
  }
  const realTaskPath = realpathSync(taskPath);
  if (!containedBy(realpathSync(projectRoot), realTaskPath)) {
    throw new Error(`Backlog task ${selectedTaskId} resolved outside the project`);
  }

  return {
    ...task,
    projectRoot,
    taskPath: realTaskPath,
  };
}

export function validateFutureLocation(cwd: string, rawArgs: string): FutureLocation | null {
  const location = rawArgs.trim();
  if (!location || /\s/.test(location)) return null;
  if (isAbsolute(location) || win32.isAbsolute(location)) return null;
  const match = SAFE_LOCATION.exec(location);
  if (!match) return null;

  const projectRoot = resolveNearestProjectRoot(cwd).root;
  const futureRoot = resolve(projectRoot, ".ralph", "plans", "future");
  const folder = resolve(projectRoot, location);
  if (!containedBy(futureRoot, folder)) return null;
  if (!existsSync(folder) || !statSync(folder).isDirectory()) return null;

  const realFutureRoot = realpathSync(futureRoot);
  const realFolder = realpathSync(folder);
  if (!containedBy(realFutureRoot, realFolder)) return null;
  if (!containedBy(projectRoot, realFolder)) return null;

  return { location, slug: match[1], projectRoot, folder: realFolder };
}
