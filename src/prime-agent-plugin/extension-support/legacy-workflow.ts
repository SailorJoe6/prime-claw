import { closeSync, lstatSync, openSync, renameSync } from "node:fs";
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
  const ralph = join(worktreeRoot, ".ralph");
  const plans = join(ralph, "plans");
  if (![worktreeRoot, ralph, plans].every(readableDirectoryWithoutSymlink)) return null;
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

function pathExists(path: string): boolean {
  try { lstatSync(path); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function readableDirectoryWithoutSymlink(path: string): boolean {
  try {
    const stat = lstatSync(path);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch { return false; }
}

/**
 * Restore one exact already-blocked legacy pair without treating it as live
 * before the move. The caller owns operator/ownership/worktree authorization
 * and must revalidate the ownership record and live identity afterwards.
 */
export function restoreBlockedLegacyPlanFiles(worktreeRoot: string): LegacyPlanFiles {
  const plans = join(worktreeRoot, ".ralph", "plans");
  const blocked = join(plans, "blocked");
  const specificationSource = join(blocked, "SPECIFICATION.md");
  const specification = join(plans, "SPECIFICATION.md");
  if (![join(worktreeRoot, ".ralph"), plans, blocked].every(readableDirectoryWithoutSymlink)) {
    throw new Error("Blocked legacy recovery requires real in-worktree lifecycle directories and follows no symlink");
  }
  const implementations = ["IMPLEMENTATION_PLAN.md", "EXECUTION_PLAN.md"]
    .filter((name) => pathExists(join(blocked, name)));

  if (!readableNonEmptyRegularFile(specificationSource) || implementations.length !== 1
    || !readableNonEmptyRegularFile(join(blocked, implementations[0]))) {
    throw new Error("Blocked legacy recovery requires one readable non-empty regular specification and exactly one implementation plan");
  }
  if ([specification, join(plans, "IMPLEMENTATION_PLAN.md"), join(plans, "EXECUTION_PLAN.md")].some(pathExists)) {
    throw new Error("Blocked legacy recovery refuses an active destination collision or partial active pair");
  }

  const implementationName = implementations[0];
  const implementationSource = join(blocked, implementationName);
  const implementation = join(plans, implementationName);
  let movedSpecification = false;
  let movedImplementation = false;
  try {
    renameSync(specificationSource, specification); movedSpecification = true;
    renameSync(implementationSource, implementation); movedImplementation = true;
    const active = activeLegacyPlanFiles(worktreeRoot);
    if (!active || active.specification !== specification || active.implementation !== implementation) {
      throw new Error("Blocked legacy recovery did not produce the exact active plan pair");
    }
    return active;
  } catch (error) {
    let rollbackFailed = false;
    try { if (movedImplementation && pathExists(implementation) && !pathExists(implementationSource)) renameSync(implementation, implementationSource); }
    catch { rollbackFailed = true; }
    try { if (movedSpecification && pathExists(specification) && !pathExists(specificationSource)) renameSync(specification, specificationSource); }
    catch { rollbackFailed = true; }
    if ((movedImplementation && (!pathExists(implementationSource) || pathExists(implementation)))
      || (movedSpecification && (!pathExists(specificationSource) || pathExists(specification)))) rollbackFailed = true;
    if (rollbackFailed) throw new Error("Blocked legacy recovery stopped in a partial uncertain state");
    throw error;
  }
}
