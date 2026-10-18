/**
 * Backlog provider-native task-history workspace foundation.
 *
 * This is the direct, Backlog-specific ordinary-Git seam for plan slice 2A:
 * it selects the task-history remote, creates or verifies the disconnected
 * `refs/heads/prime-claw/tasks` history, and prepares the primary checkout's
 * ignored independent nested Backlog clone at the explicit validated built-in
 * task-store location, checked out on that task branch, with Backlog
 * code-repository auto-commit disabled through supported native behavior.
 *
 * Boundary: ordinary Git only. No force overwrite, no shared code ancestry
 * accepted as task authority, no submodules, no linked nested worktrees, no
 * alternate indexes, no same-root custom Git work trees, no separate hosted
 * repository, and no coordinator or service. Episode-worktree preparation,
 * the fetch/reconcile/commit/push mutation loop, Beads transport, ownership
 * and receipt fields, and task-data migration are later slices.
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, realpathSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  type CommandRunner,
  ProcessCommandRunner,
} from "./project-initialization.ts";
import { detectTaskProvider } from "./task-providers.ts";

/** The disconnected task-history branch Prime Claw manages. */
export const TASK_HISTORY_REF = "refs/heads/prime-claw/tasks";
const TASK_HISTORY_BRANCH = "prime-claw/tasks";
/** Built-in task-store locations (relative to the primary checkout root). */
const BUILT_IN_TASK_STORE_DIRS = ["backlog", ".backlog"] as const;
const INITIAL_COMMIT_MESSAGE = "prime-claw: initialize task history";
const INITIAL_FILE = "TASKS.md";
const INITIAL_FILE_CONTENT = "# Prime Claw task history\n\nThis disconnected branch carries the provider-native Backlog task store.\n";

export interface TaskHistoryWorkspaceInput {
  /** Absolute path of the canonical primary checkout (never an Episode worktree). */
  primaryRoot: string;
  runner?: CommandRunner;
}

export type TaskHistoryRemoteSelection =
  | { status: "selected"; name: string; via: "branch-upstream" | "sole-remote" }
  | { status: "blocked"; code: "no-remote" | "ambiguous-remotes"; detail: string; remediation: string };

export type TaskHistoryBranchState =
  | { status: "verified"; head: string }
  | { status: "created"; head: string }
  | { status: "blocked"; code: "shared-ancestry" | "remote-advanced" | "unreadable"; detail: string; remediation: string };

export type TaskHistoryWorkspace =
  | {
      status: "prepared";
      remote: string;
      remoteVia: "branch-upstream" | "sole-remote";
      branch: typeof TASK_HISTORY_BRANCH;
      branchState: "verified" | "created";
      head: string;
      storeDir: string;
      configEvidence: "root" | "folder";
      autoCommit: false;
    }
  | {
      status: "blocked";
      code:
        | "not-primary-checkout"
        | "provider-not-backlog"
        | "no-remote"
        | "ambiguous-remotes"
        | "shared-ancestry"
        | "remote-advanced"
        | "unreadable"
        | "unsafe-store-location"
        | "uncommitted-task-content"
        | "backlog-cli";
      detail: string;
      remediation: string;
    };

function runGit(runner: CommandRunner, cwd: string, args: string[]) {
  return runner.run("git", ["-C", cwd, ...args], { allowFailure: true });
}

function gitOk(runner: CommandRunner, cwd: string, args: string[], label: string): string {
  const result = runGit(runner, cwd, args);
  if (result.status !== 0) {
    throw new Error(`${label} failed: ${result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`}`);
  }
  return result.stdout.trim();
}

function refHead(runner: CommandRunner, root: string, ref: string): string | null {
  const result = runGit(runner, root, ["rev-parse", "--verify", "--quiet", ref]);
  if (result.status !== 0) return null;
  const head = result.stdout.trim();
  return /^[0-9a-f]{40}$/.test(head) ? head : null;
}

function refExists(runner: CommandRunner, root: string, ref: string): boolean {
  return runGit(runner, root, ["show-ref", "--verify", ref]).status === 0;
}

/** True when `ancestor` is an ancestor of (or equal to) `descendant`. */
function isAncestor(runner: CommandRunner, root: string, ancestor: string, descendant: string): boolean {
  return runGit(runner, root, ["merge-base", "--is-ancestor", ancestor, descendant]).status === 0;
}

/** True when the task-history commit shares any ancestor with any local code branch. */
function sharesCodeAncestry(runner: CommandRunner, root: string, taskHead: string): boolean {
  const branches = runGit(runner, root, ["for-each-ref", "--format=%(refname)", "refs/heads"]);
  if (branches.status !== 0) return true; // uncertain: treat as shared rather than silently accept
  for (const line of branches.stdout.split(/\r?\n/)) {
    const ref = line.trim();
    if (!ref || ref === TASK_HISTORY_REF) continue;
    if (runGit(runner, root, ["merge-base", taskHead, ref]).status === 0) return true;
  }
  return false;
}

/**
 * Select the task-history remote: the canonical primary code branch's
 * upstream when one exists, otherwise the sole repository remote. No remote
 * or ambiguous remotes block with exact remediation; this seam never guesses.
 */
export function selectTaskHistoryRemote(
  primaryRoot: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): TaskHistoryRemoteSelection {
  const branch = gitOk(runner, primaryRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"], "read the current branch");
  if (!branch) {
    throw new Error("the canonical primary checkout has a detached HEAD; cannot select the code branch upstream");
  }
  const upstream = runGit(runner, primaryRoot, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  if (upstream.status === 0) {
    const name = upstream.stdout.trim().split("/")[0];
    if (!name) {
      throw new Error(`the upstream for ${branch} has no remote name: ${upstream.stdout.trim()}`);
    }
    return { status: "selected", name, via: "branch-upstream" };
  }
  const remotes = runGit(runner, primaryRoot, ["remote"]);
  if (remotes.status !== 0) {
    throw new Error(`git remote failed: ${remotes.stderr.trim() || `exit ${remotes.status}`}`);
  }
  const names = remotes.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (names.length === 1) return { status: "selected", name: names[0], via: "sole-remote" };
  if (names.length === 0) {
    return {
      status: "blocked",
      code: "no-remote",
      detail: `the canonical primary branch ${branch} has no upstream and the repository has no remote`,
      remediation: `add the task-history remote (for example \`git remote add origin <url>\`) or set the branch upstream (\`git branch --set-upstream-to <remote>/${branch}\`)`,
    };
  }
  return {
    status: "blocked",
    code: "ambiguous-remotes",
    detail: `the canonical primary branch ${branch} has no upstream and the repository has multiple remotes: ${names.join(", ")}`,
    remediation: `set the branch upstream (\`git branch --set-upstream-to <remote>/${branch}\`) or remove the extra remotes so exactly one remains`,
  };
}

/**
 * Create or verify the disconnected task-history branch using ordinary Git.
 * An existing local or selected-remote branch must not share code ancestry
 * (shared ancestry is never task authority); a diverged remote ref blocks
 * rather than force-overwriting. Creation uses `git switch --orphan` plus an
 * ordinary commit — never plumbing that fabricates history, never force.
 */
export function ensureTaskHistoryBranch(
  primaryRoot: string,
  remote: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): TaskHistoryBranchState {
  const localHead = refHead(runner, primaryRoot, TASK_HISTORY_REF);
  const remoteRef = `refs/remotes/${remote}/${TASK_HISTORY_BRANCH}`;
  const remoteHead = refHead(runner, primaryRoot, remoteRef);
  const remoteRefPresent = refExists(runner, primaryRoot, remoteRef);

  const current = gitOk(runner, primaryRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"], "read the current branch");
  if (current === TASK_HISTORY_BRANCH) {
    return {
      status: "blocked",
      code: "unreadable",
      detail: `the canonical primary checkout is currently ON ${TASK_HISTORY_BRANCH}; refusing to prepare it as the primary checkout`,
      remediation: `switch the primary checkout back to its code branch (for example \`git -C ${primaryRoot} switch -\`)`,
    };
  }

  if (localHead) {
    if (sharesCodeAncestry(runner, primaryRoot, localHead)) {
      return {
        status: "blocked",
        code: "shared-ancestry",
        detail: `${TASK_HISTORY_REF} shares history with a code branch and is not a disconnected task history`,
        remediation: `inspect \`git -C ${primaryRoot} log ${TASK_HISTORY_BRANCH}\`; retire the wrongly created branch (\`git -C ${primaryRoot} branch -D ${TASK_HISTORY_BRANCH}\`) and re-run preparation`,
      };
    }
    if (remoteRefPresent) {
      if (!remoteHead) {
        return { status: "blocked", code: "unreadable", detail: `${remoteRef} exists but its head could not be read`, remediation: "inspect the remote ref and repair the repository refs" };
      }
      // The remote may only be at or behind the local head. Remote ahead (or
      // diverged) means commits exist that the local branch lacks; refuse
      // rather than overwrite. A fast-forward catch-up is the later mutation
      // loop's job; this foundation never moves refs.
      if (remoteHead !== localHead && !isAncestor(runner, primaryRoot, remoteHead, localHead)) {
        return {
          status: "blocked",
          code: "remote-advanced",
          detail: `${remoteRef} has commits the local ${TASK_HISTORY_BRANCH} does not; refusing to overwrite`,
          remediation: `fetch and fast-forward the local task branch from ${remote} (never force), then re-run preparation`,
        };
      }
    }
    return { status: "verified", head: localHead };
  }

  if (remoteRefPresent) {
    if (!remoteHead) {
      return { status: "blocked", code: "unreadable", detail: `${remoteRef} exists but its head could not be read`, remediation: "inspect the remote ref and repair the repository refs" };
    }
    if (sharesCodeAncestry(runner, primaryRoot, remoteHead)) {
      return {
        status: "blocked",
        code: "shared-ancestry",
        detail: `the remote task branch ${remote}/${TASK_HISTORY_BRANCH} shares history with a code branch and is not a disconnected task history`,
        remediation: `inspect \`git -C ${primaryRoot} log ${remote}/${TASK_HISTORY_BRANCH}\` and retire the wrongly created branch before re-running preparation`,
      };
    }
    const track = runGit(runner, primaryRoot, ["branch", "--track", TASK_HISTORY_BRANCH, remoteRef]);
    if (track.status !== 0) {
      throw new Error(`creating the local task branch from ${remoteRef} failed: ${track.stderr.trim() || `exit ${track.status}`}`);
    }
    const head = refHead(runner, primaryRoot, TASK_HISTORY_REF);
    if (!head || head !== remoteHead) {
      throw new Error(`the tracked task branch head did not match ${remoteRef}`);
    }
    return { status: "verified", head };
  }

  // Create the disconnected history with ordinary Git: an orphan checkout
  // whose initial commit has no parents, then switch back. Nothing is forced.
  const switchResult = runGit(runner, primaryRoot, ["switch", "--orphan", TASK_HISTORY_BRANCH]);
  if (switchResult.status !== 0) {
    throw new Error(`git switch --orphan ${TASK_HISTORY_BRANCH} failed: ${switchResult.stderr.trim() || `exit ${switchResult.status}`}`);
  }
  try {
    // The orphan checkout seeds the index from HEAD; empty it so the initial
    // commit carries only the task-history marker, never code content.
    gitOk(runner, primaryRoot, ["rm", "-rf", "--cached", "--ignore-unmatch", "."], "empty the orphan index");
    writeFileSync(join(primaryRoot, INITIAL_FILE), INITIAL_FILE_CONTENT);
    gitOk(runner, primaryRoot, ["add", INITIAL_FILE], "stage the task-history marker");
    gitOk(runner, primaryRoot, ["commit", "-m", INITIAL_COMMIT_MESSAGE], "create the initial task-history commit");
  } finally {
    const back = runGit(runner, primaryRoot, ["switch", current]);
    if (back.status !== 0) {
      throw new Error(`switching back to ${current} failed after orphan preparation: ${back.stderr.trim() || `exit ${back.status}`}; the checkout may still be on ${TASK_HISTORY_BRANCH}`);
    }
  }
  const head = refHead(runner, primaryRoot, TASK_HISTORY_REF);
  if (!head) throw new Error(`the new ${TASK_HISTORY_REF} head could not be read after creation`);
  if (sharesCodeAncestry(runner, primaryRoot, head)) {
    return {
      status: "blocked",
      code: "shared-ancestry",
      detail: `the newly created ${TASK_HISTORY_REF} unexpectedly shares history with a code branch`,
      remediation: `inspect \`git -C ${primaryRoot} log ${TASK_HISTORY_BRANCH}\`; this should be impossible for an orphan commit`,
    };
  }
  const restored = gitOk(runner, primaryRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"], "verify the restored branch");
  if (restored !== current) {
    throw new Error(`the primary checkout did not return to ${current} after task-history creation (now on ${restored})`);
  }
  return { status: "created", head };
}

/**
 * The built-in task-store location for the nested clone: an existing live
 * Backlog store directory (per native detection) wins; otherwise the default
 * `backlog/`. Any other location, or any path that escapes the primary root,
 * blocks.
 */
function selectStoreLocation(
  primaryRoot: string,
): { storeDir: string; blocked?: undefined } | { storeDir: ""; blocked: TaskHistoryWorkspace & { status: "blocked" } } {
  let detection;
  try {
    detection = detectTaskProvider(primaryRoot);
  } catch (error) {
    return {
      storeDir: "",
      blocked: {
        status: "blocked", code: "unreadable",
        detail: `provider detection unavailable: ${error instanceof Error ? error.message : String(error)}`,
        remediation: "repair the repository provider evidence and re-run preparation",
      },
    };
  }
  if (detection.kind === "blocked") {
    return {
      storeDir: "",
      blocked: { status: "blocked", code: "provider-not-backlog", detail: detection.detail, remediation: detection.remediation },
    };
  }
  if (detection.kind === "selected" && detection.evidence.provider !== "backlog") {
    return {
      storeDir: "",
      blocked: {
        status: "blocked", code: "provider-not-backlog",
        detail: "the selected provider is Beads; the Backlog workspace seam does not prepare a task store for it",
        remediation: "the Beads workspace transport is a later slice; no Backlog clone is prepared",
      },
    };
  }
  let dir: string = BUILT_IN_TASK_STORE_DIRS[0];
  if (detection.kind === "selected" && detection.evidence.provider === "backlog") {
    const storeDir = detection.evidence.storeDir;
    if (storeDir) {
      const rel = relative(primaryRoot, storeDir);
      const parts = rel.split(sep);
      if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`) || parts.length !== 1 || !(BUILT_IN_TASK_STORE_DIRS as readonly string[]).includes(parts[0])) {
        return {
          storeDir: "",
          blocked: {
            status: "blocked", code: "unsafe-store-location",
            detail: `the live Backlog store directory ${storeDir} is not a built-in task-store location (backlog/ or .backlog/) directly under the primary checkout`,
            remediation: "normalize the Backlog store to the built-in backlog/ or .backlog/ location (root configuration may still select it) before preparing the workspace",
          },
        };
      }
      dir = parts[0];
    } else if (detection.evidence.configSource === "root") {
      // Root config without a materialized store: mirror the native built-in
      // precedence (backlog/ first, then .backlog/).
      dir = existsSync(join(primaryRoot, ".backlog")) ? ".backlog" : "backlog";
    }
  }
  return { storeDir: join(primaryRoot, dir) };
}

function ensureIgnored(primaryRoot: string, storeDir: string): void {
  const rel = relative(primaryRoot, storeDir).split(sep).join("/");
  const pattern = `/${rel}/`;
  const gitignorePath = join(primaryRoot, ".gitignore");
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
  const lines = existing.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes(pattern) || lines.includes(rel) || lines.includes(`${rel}/`) || lines.includes(pattern.slice(1))) return;
  const prefix = existing.length && !existing.endsWith("\n") ? "\n" : "";
  appendFileSync(gitignorePath, `${prefix}${pattern}\n`);
}

function hasTrackedTaskContent(runner: CommandRunner, primaryRoot: string, storeDir: string): boolean {
  const rel = relative(primaryRoot, storeDir).split(sep).join("/");
  const result = runGit(runner, primaryRoot, ["ls-files", "-z", "--", rel]);
  if (result.status !== 0) {
    throw new Error(`git ls-files failed for ${rel}: ${result.stderr.trim() || `exit ${result.status}`}`);
  }
  return result.stdout.length > 0;
}

/**
 * Prepare the primary checkout's ignored independent nested Backlog clone at
 * the validated built-in task-store location, checked out on the
 * disconnected task-history branch, with Backlog code-repository auto-commit
 * disabled through supported native behavior. Idempotent: a prepared clone
 * is verified, never recreated; any deviation blocks with exact remediation.
 */
export function prepareTaskHistoryWorkspace(input: TaskHistoryWorkspaceInput): TaskHistoryWorkspace {
  const runner = input.runner ?? new ProcessCommandRunner();
  const primaryRoot = realpathSync(resolve(input.primaryRoot));

  // The foundation serves the canonical primary checkout only, never a linked
  // worktree (whose git dir differs from the common dir).
  const gitDirRaw = gitOk(runner, primaryRoot, ["rev-parse", "--git-dir"], "read the git directory");
  const commonRaw = gitOk(runner, primaryRoot, ["rev-parse", "--git-common-dir"], "read the common git directory");
  const gitDir = realpathSync(resolve(primaryRoot, gitDirRaw));
  const commonDir = realpathSync(resolve(primaryRoot, commonRaw));
  if (gitDir !== commonDir) {
    return {
      status: "blocked", code: "not-primary-checkout",
      detail: `${primaryRoot} is a linked worktree (its git directory ${gitDir} differs from the common directory ${commonDir}); the task-history workspace prepares only the canonical primary checkout`,
      remediation: "run preparation from the canonical primary checkout; Episode-worktree preparation is a later slice",
    };
  }

  const remoteSelection = selectTaskHistoryRemote(primaryRoot, runner);
  if (remoteSelection.status === "blocked") {
    return { status: "blocked", code: remoteSelection.code, detail: remoteSelection.detail, remediation: remoteSelection.remediation };
  }
  const remote = remoteSelection.name;

  const location = selectStoreLocation(primaryRoot);
  if (location.blocked) return location.blocked;
  const storeDir = location.storeDir;

  if (hasTrackedTaskContent(runner, primaryRoot, storeDir)) {
    return {
      status: "blocked", code: "uncommitted-task-content",
      detail: `${relative(primaryRoot, storeDir)} has files tracked by the code repository; preparing the nested clone would split task authority`,
      remediation: `remove the tracked files from the code branch (\`git -C ${primaryRoot} rm -r --cached ${relative(primaryRoot, storeDir)}\` and commit) so the store is ignored before preparation`,
    };
  }

  const branchState = ensureTaskHistoryBranch(primaryRoot, remote, runner);
  if (branchState.status === "blocked") {
    return { status: "blocked", code: branchState.code, detail: branchState.detail, remediation: branchState.remediation };
  }

  const nestedGit = join(storeDir, ".git");
  if (!existsSync(nestedGit) && existsSync(storeDir) && statSync(storeDir).isDirectory() && readdirSync(storeDir).length > 0) {
    // A live Backlog store directory without .git is adopted onto the
    // task-history branch with ordinary Git — never discarded. The branch is
    // empty before the first task commit, so the adoption checkout starts
    // with an empty index and keeps the store's files as untracked content;
    // the later mutation loop owns committing them.
    // `git clone` refuses a non-empty destination, so adoption uses ordinary
    // `git init` plus a remote add pointed at the primary repository — an
    // independent repository over the existing store content, never a
    // submodule, worktree, or alternate index.
    gitOk(runner, storeDir, ["init", "-q"], "initialize the adopted task store repository");
    const remoteUrl = gitOk(runner, primaryRoot, ["rev-parse", "--show-toplevel"], "resolve the primary repository path");
    gitOk(runner, storeDir, ["remote", "add", remote, remoteUrl], "point the adopted clone at the primary repository");
    gitOk(runner, storeDir, ["fetch", "-q", remote, `${TASK_HISTORY_REF}:${TASK_HISTORY_REF}`], "fetch the task-history branch into the adopted clone");
    gitOk(runner, storeDir, ["symbolic-ref", "HEAD", TASK_HISTORY_REF], "point the adopted clone at the task-history branch");
    // Start with an empty index: the branch's tracked tree must not appear as
    // staged deletions, and the store's existing files stay untracked until
    // the later mutation loop commits them.
    gitOk(runner, storeDir, ["read-tree", "--empty"], "start the adopted clone with an empty index");
    const cloneHead = refHead(runner, storeDir, "HEAD");
    if (cloneHead !== branchState.head) {
      return {
        status: "blocked", code: "unreadable",
        detail: `the adopted nested clone head ${cloneHead ?? "unreadable"} does not match the task-history head ${branchState.head}`,
        remediation: "inspect the nested clone refs and re-run preparation",
      };
    }
  }
  if (existsSync(nestedGit)) {
    // Existing nested clone: verify it exactly, never recreate.
    const stat = statSync(nestedGit);
    if (!stat.isDirectory()) {
      return {
        status: "blocked", code: "unsafe-store-location",
        detail: `${nestedGit} exists but is not a directory (a gitfile would make this a linked worktree, which this seam never creates)`,
        remediation: `remove ${nestedGit} and re-run preparation so an independent nested clone can be created`,
      };
    }
    const innerRemotes = gitOk(runner, storeDir, ["remote"], "read the nested clone remotes").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (innerRemotes.length !== 1 || innerRemotes[0] !== remote) {
      return {
        status: "blocked", code: "unreadable",
        detail: `the nested clone remotes are ${innerRemotes.join(", ") || "none"}; expected exactly ${remote}`,
        remediation: `remove ${storeDir} and re-run preparation, or repair its remote to exactly ${remote}`,
      };
    }
    const innerBranch = gitOk(runner, storeDir, ["symbolic-ref", "--quiet", "--short", "HEAD"], "read the nested clone branch");
    if (innerBranch !== TASK_HISTORY_BRANCH) {
      return {
        status: "blocked", code: "unreadable",
        detail: `the nested clone is on branch ${innerBranch}; expected ${TASK_HISTORY_BRANCH}`,
        remediation: `switch the nested clone to ${TASK_HISTORY_BRANCH} (\`git -C ${storeDir} switch ${TASK_HISTORY_BRANCH}\`) or remove ${storeDir} and re-run preparation`,
      };
    }
    const innerHead = refHead(runner, storeDir, "HEAD");
    if (!innerHead || innerHead !== branchState.head) {
      return {
        status: "blocked", code: "unreadable",
        detail: `the nested clone head ${innerHead ?? "unreadable"} does not match the local task-history head ${branchState.head}`,
        remediation: "reconcile the nested clone with the task-history branch (fetch/fast-forward only, never force) or remove it and re-run preparation",
      };
    }
  } else {
    if (existsSync(storeDir)) {
      if (!statSync(storeDir).isDirectory()) {
        return {
          status: "blocked", code: "unsafe-store-location",
          detail: `${storeDir} exists but is not a directory`,
          remediation: `remove the non-directory at ${storeDir} and re-run preparation`,
        };
      }
      // The initializer may have materialized an empty store skeleton; only an
      // empty directory may become the clone target. This seam never discards
      // unowned content.
      const entries = readdirSync(storeDir);
      if (entries.length > 0) {
        return {
          status: "blocked", code: "unsafe-store-location",
          detail: `${storeDir} is not empty and has no .git; refusing to overwrite existing content (${entries.slice(0, 5).join(", ")}${entries.length > 5 ? ", …" : ""})`,
          remediation: "move the existing content aside or remove it, then re-run preparation; this seam never discards unowned content",
        };
      }
    } else {
      mkdirSync(storeDir, { recursive: true });
    }
    gitOk(runner, primaryRoot, ["clone", "--no-checkout", "--origin", remote, primaryRoot, storeDir], "clone the nested task store");
    gitOk(runner, storeDir, ["switch", TASK_HISTORY_BRANCH], "check out the task-history branch in the nested clone");
  }

  ensureIgnored(primaryRoot, storeDir);

  // A freshly cloned task-history branch has no Backlog folder configuration
  // yet; native `backlog config` commands require one. Preserve the primary
  // checkout's root/folder configuration evidence: copy the folder
  // configuration when one exists, otherwise write the minimal valid folder
  // configuration (project name plus the canonical lifecycle) that the
  // existing capability gate already proves. The task-history clone is where
  // the live store materializes; the root configuration is never modified.
  const nestedConfigPath = join(storeDir, "config.yml");
  if (!existsSync(nestedConfigPath)) {
    const rootConfigPath = join(primaryRoot, "backlog.config.yml");
    const folderConfig = ["backlog", ".backlog"]
      .map((dir) => join(primaryRoot, dir, "config.yml"))
      .find((candidate) => candidate !== nestedConfigPath && existsSync(candidate) && statSync(candidate).isFile());
    if (folderConfig) {
      writeFileSync(nestedConfigPath, readFileSync(folderConfig, "utf8"));
    } else if (existsSync(rootConfigPath)) {
      const projectName = /^project_name:\s*"?([^"\n]+)"?/m.exec(readFileSync(rootConfigPath, "utf8"))?.[1]?.trim();
      if (!projectName) {
        return {
          status: "blocked", code: "unreadable",
          detail: `${rootConfigPath} has no project_name; cannot derive the nested folder configuration`,
          remediation: "repair the root configuration's project_name and re-run preparation",
        };
      }
      writeFileSync(nestedConfigPath, `project_name: "${projectName}"\nstatuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]\ndefault_status: "In Design"\n`);
    } else {
      writeFileSync(nestedConfigPath, `project_name: "${basename(primaryRoot)}"\nstatuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]\ndefault_status: "In Design"\n`);
    }
  }

  // Disable Backlog code-repository auto-commit through the supported native
  // configuration surface, then prove the stored value natively.
  const setResult = runner.run("backlog", ["config", "set", "autoCommit", "false"], { cwd: storeDir, allowFailure: true });
  if (setResult.status !== 0) {
    return {
      status: "blocked", code: "backlog-cli",
      detail: `\`backlog config set autoCommit false\` failed in ${storeDir}: ${setResult.stderr.trim() || setResult.stdout.trim() || `exit ${setResult.status}`}`,
      remediation: "repair the managed Backlog executable or the nested clone configuration and re-run preparation",
    };
  }
  const getResult = runner.run("backlog", ["config", "get", "autoCommit"], { cwd: storeDir, allowFailure: true });
  if (getResult.status !== 0 || getResult.stdout.trim() !== "false") {
    return {
      status: "blocked", code: "backlog-cli",
      detail: `the nested clone did not record autoCommit=false (\`backlog config get autoCommit\` returned ${JSON.stringify(getResult.stdout.trim())})`,
      remediation: `set the value manually in ${storeDir} (\`backlog config set autoCommit false\`) and re-run preparation`,
    };
  }

  const configEvidence = existsSync(join(primaryRoot, "backlog.config.yml")) ? "root" as const : "folder" as const;
  return {
    status: "prepared",
    remote,
    remoteVia: remoteSelection.via,
    branch: TASK_HISTORY_BRANCH,
    branchState: branchState.status,
    head: branchState.head,
    storeDir,
    configEvidence,
    autoCommit: false,
  };
}
