import { closeSync, lstatSync, openSync } from "node:fs";
import { join } from "node:path";

export type LegacyPlanFiles = {
  specification: string;
  implementation: string;
};

function readableNonEmptyRegularFile(path: string): boolean {
  let descriptor: number | undefined;
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) return false;
    descriptor = openSync(path, "r");
    return true;
  } catch {
    return false;
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* readability was already proven */ }
    }
  }
}

/** Resolve the promoted active legacy pair. IMPLEMENTATION_PLAN.md is the
 * compatibility name; EXECUTION_PLAN.md is the retained Prime Claw spelling. */
export function activeLegacyPlanFiles(worktreeRoot: string): LegacyPlanFiles | null {
  const plans = join(worktreeRoot, ".ralph", "plans");
  const specification = join(plans, "SPECIFICATION.md");
  if (!readableNonEmptyRegularFile(specification)) return null;
  for (const name of ["IMPLEMENTATION_PLAN.md", "EXECUTION_PLAN.md"]) {
    const implementation = join(plans, name);
    if (readableNonEmptyRegularFile(implementation)) return { specification, implementation };
  }
  return null;
}

export function assertLiveLegacyEpisodeFiles(
  record: { version: number; status: string; worktree?: string },
  label = "Legacy Episode",
): LegacyPlanFiles {
  if (record.version !== 1 || record.status !== "active" || !record.worktree) {
    throw new Error(`${label} requires exact active version-1 ownership with a recorded worktree`);
  }
  const files = activeLegacyPlanFiles(record.worktree);
  if (!files) {
    throw new Error(`${label} ownership is not live: the recorded Episode worktree is missing its readable non-empty active specification and implementation plan`);
  }
  return files;
}
