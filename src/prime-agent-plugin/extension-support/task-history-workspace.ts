/**
 * Backlog provider-native task-history workspace foundation.
 *
 * This is the direct, Backlog-specific ordinary-Git seam for plan slice 2A.
 * The selected repository remote is the task-history authority: the seam
 * fetches the exact task ref from that remote before deciding anything,
 * bootstraps the disconnected `refs/heads/prime-claw/tasks` history in a
 * disposable temporary ordinary-Git repository (never the primary checkout),
 * publishes it with an ordinary non-force push, and prepares the primary
 * checkout's ignored independent nested Backlog clone from the remote's own
 * transport URL at the validated built-in task-store location, checked out
 * on the published task branch with Backlog code-repository auto-commit
 * disabled through supported native behavior.
 *
 * The canonical primary checkout is never mutated: no branch switch, no
 * orphan checkout, no index or worktree touch — preparation only appends an
 * ignore rule for the store directory, which is proven with
 * `git check-ignore` before the nested repository is created.
 *
 * Boundary: ordinary Git and native Backlog behavior only. No force push or
 * overwrite, no shared code ancestry accepted as task authority, no
 * submodules, no linked nested worktrees, no alternate indexes, no same-root
 * custom Git work trees, no separate hosted repository, and no coordinator
 * or service. Slice 2B adds Episode-worktree preparation and guarded
 * nested-store cleanup (see `prepareEpisodeTaskHistoryWorkspace` and
 * `cleanupEpisodeTaskHistoryStore`). Slice 2C adds one exact Backlog-native
 * task edit with ordinary commit/non-force publication and bounded factual
 * race evidence. Beads transport, lifecycle wiring, ownership/receipt fields,
 * and task-data migration remain later slices.
 */

import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  type CommandRunner,
  ProcessCommandRunner,
} from "./project-initialization.ts";
import {
  checkBacklogCapabilities,
  detectTaskProvider,
  resolveProviderTask,
  type ProviderTaskResolution,
} from "./task-providers.ts";

/** The disconnected task-history branch Prime Claw manages. */
export const TASK_HISTORY_REF = "refs/heads/prime-claw/tasks";
const TASK_HISTORY_BRANCH = "prime-claw/tasks";
/** Built-in task-store locations (relative to the primary checkout root). */
const BUILT_IN_TASK_STORE_DIRS = [".backlog", "backlog"] as const;
const INITIAL_COMMIT_MESSAGE = "prime-claw: initialize task history";
const INITIAL_FILE = "TASKS.md";
const INITIAL_FILE_CONTENT = "# Prime Claw task history\n\nThis disconnected branch carries the provider-native Backlog task store.\n";
/** The exact ordered canonical lifecycle the capability gate requires. */
const CANONICAL_STATUSES = ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"] as const;

/**
 * The lifecycle-ready folder configuration the bootstrap publishes (the same
 * content the accepted native initializer establishes): the exact six ordered
 * canonical statuses, default `In Design`, and `auto_commit: false`. The store
 * is therefore lifecycle-ready from the first published commit and never
 * returned as an untracked/unpublished local config write.
 */
export function initialTaskStoreConfig(projectName: string): string {
  const statuses = CANONICAL_STATUSES.map((status) => `"${status}"`).join(", ");
  // The full canonical default configuration (the same keys upstream's
  // `backlog init` writes) with the exact ordered lifecycle and
  // auto_commit: false — so the published store is already normalized and
  // native commands never rewrite it in place.
  return [
    `project_name: "${projectName}"`,
    `default_status: "In Design"`,
    `statuses: [${statuses}]`,
    `labels: []`,
    `date_format: yyyy-mm-dd`,
    `max_column_width: 20`,
    `auto_open_browser: true`,
    `default_port: 6420`,
    `remote_operations: true`,
    `auto_commit: false`,
    `filesystem_only: false`,
    `bypass_git_hooks: false`,
    `check_active_branches: true`,
    `active_branch_days: 30`,
    `task_prefix: "task"`,
    ``,
  ].join("\n");
}

export interface TaskHistoryWorkspaceInput {
  /** Absolute path of the canonical primary checkout (never an Episode worktree). */
  primaryRoot: string;
  runner?: CommandRunner;
  /** Explicit operator choice to retain unpublished local-only history when no remote exists. */
  unpublishedLocalOnly?: boolean;
}

export type TaskHistoryRemoteSelection =
  | { status: "selected"; name: string; url: string; via: "branch-upstream" | "sole-remote" }
  | { status: "blocked"; code: "no-remote" | "ambiguous-remotes"; detail: string; remediation: string };

export type TaskHistoryBranchState =
  | { status: "verified"; head: string }
  | { status: "published"; head: string }
  | {
      status: "blocked";
      code: "remote-unavailable" | "shared-ancestry" | "remote-advanced" | "local-ahead" | "unreadable";
      detail: string;
      remediation: string;
    };

export type TaskHistoryWorkspace =
  | {
      status: "prepared";
      remote: string;
      remoteUrl: string;
      remoteVia: "branch-upstream" | "sole-remote";
      branch: typeof TASK_HISTORY_BRANCH;
      branchState: "verified" | "published";
      head: string;
      storeDir: string;
      configSource: "root" | "folder" | "none";
      autoCommit: false;
      layoutWarning?: string;
    }
  | {
      status: "prepared";
      remote: null;
      remoteUrl: null;
      remoteVia: "local-only";
      branch: typeof TASK_HISTORY_BRANCH;
      branchState: "local-only";
      head: string;
      storeDir: string;
      configSource: "root" | "folder" | "none";
      autoCommit: false;
      unpublished: true;
      layoutWarning?: string;
    }
  | {
      status: "blocked";
      code:
        | "not-primary-checkout"
        | "provider-not-backlog"
        | "no-remote"
        | "ambiguous-remotes"
        | "remote-unavailable"
        | "shared-ancestry"
        | "remote-advanced"
        | "local-ahead"
        | "unreadable"
        | "unsafe-store-location"
        | "uncommitted-task-content"
        | "config-not-preserved"
        | "not-ignored"
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
 * upstream when one exists, otherwise the sole repository remote. The
 * selected remote's transport URL is the clone/fetch authority; no remote
 * or ambiguous remotes block with exact remediation — this seam never
 * guesses.
 */
export function selectTaskHistoryRemote(
  primaryRoot: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): TaskHistoryRemoteSelection {
  const branch = gitOk(runner, primaryRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"], "read the current branch");
  if (!branch) {
    throw new Error("the canonical primary checkout has a detached HEAD; cannot select the code branch upstream");
  }
  const remoteUrl = (name: string) =>
    gitOk(runner, primaryRoot, ["remote", "get-url", name], `read the transport URL of remote ${name}`);
  const upstream = runGit(runner, primaryRoot, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  if (upstream.status === 0) {
    const name = upstream.stdout.trim().split("/")[0];
    if (!name) {
      throw new Error(`the upstream for ${branch} has no remote name: ${upstream.stdout.trim()}`);
    }
    return { status: "selected", name, url: remoteUrl(name), via: "branch-upstream" };
  }
  const remotes = runGit(runner, primaryRoot, ["remote"]);
  if (remotes.status !== 0) {
    throw new Error(`git remote failed: ${remotes.stderr.trim() || `exit ${remotes.status}`}`);
  }
  const names = remotes.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (names.length === 1) return { status: "selected", name: names[0], url: remoteUrl(names[0]), via: "sole-remote" };
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
 * Create or verify the disconnected task-history branch with the selected
 * remote as the sole authority. The remote ref is fetched first (stale or
 * absent remote evidence never decides); a live remote decides unreachable
 * state fails closed. An existing published branch is verified and adopted
 * locally by tracking (never recreated); a local-only branch blocks rather
 * than being silently trusted. A new disconnected history is bootstrapped
 * in a disposable temporary repository, published with an ordinary
 * non-force push, and adopted by tracking once the remote head is proven.
 */
export function ensureTaskHistoryBranch(
  primaryRoot: string,
  remote: string,
  remoteUrl: string,
  runner: CommandRunner = new ProcessCommandRunner(),
  initialConfig: string = initialTaskStoreConfig(basename(primaryRoot)),
): TaskHistoryBranchState {
  const current = gitOk(runner, primaryRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"], "read the current branch");
  if (current === TASK_HISTORY_BRANCH) {
    return {
      status: "blocked",
      code: "unreadable",
      detail: `the canonical primary checkout is currently ON ${TASK_HISTORY_BRANCH}; refusing to prepare it as the primary checkout`,
      remediation: `switch the primary checkout back to its code branch (for example \`git -C ${primaryRoot} switch -\`)`,
    };
  }

  // Refresh the exact task ref from the selected remote. A failed fetch is
  // failed-closed: without current remote evidence this seam cannot decide
  // absent/equal/ahead and never acts on stale knowledge.
  const remoteRef = `refs/remotes/${remote}/${TASK_HISTORY_BRANCH}`;
  // Direct remote evidence is the SOLE authority: parse the exact
  // `git ls-remote --heads <transport> refs/heads/prime-claw/tasks` result as
  // either absent or one well-formed OID/ref line. A cached remote-tracking
  // ref is never read as authority on its own.
  const probe = runGit(runner, primaryRoot, ["ls-remote", "--heads", remoteUrl, TASK_HISTORY_REF]);
  const probeOut = probe.stdout.trim();
  const probeErr = (probe.stderr || "").trim();
  let remoteOid: string | null;
  if (probe.status !== 0) {
    return {
      status: "blocked",
      code: "remote-unavailable",
      detail: `the selected remote ${remote} (${remoteUrl}) could not be reached: ${probeErr || `exit ${probe.status}`}`,
      remediation: "restore connectivity or credentials for the task-history remote and re-run preparation; this seam never decides on stale or absent remote evidence",
    };
  } else if (probeOut === "") {
    remoteOid = null; // the remote answers and has no task branch: ABSENT
  } else {
    const probeLines = probeOut.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const probeMatch = probeLines.length === 1 ? probeLines[0].match(/^([0-9a-f]{40})\trefs\/heads\/prime-claw\/tasks$/) : null;
    if (!probeMatch) {
      return {
        status: "blocked",
        code: "unreadable",
        detail: `\`git ls-remote --heads ${remoteUrl} ${TASK_HISTORY_REF}\` returned an unexpected result: ${JSON.stringify(probeOut)}`,
        remediation: "inspect the task-history remote; the task ref must be absent or exactly one well-formed OID/ref line",
      };
    }
    remoteOid = probeMatch[1];
  }

  // Refresh the primary's remote-tracking namespace and PROVE it equals the
  // direct evidence. When the direct response says ABSENT, never read a stale
  // cached ref: remove that cache and treat any local branch as unpublished.
  // A failed refresh or a direct/fetched mismatch blocks.
  let remoteHead: string | null = null;
  if (remoteOid === null) {
    runGit(runner, primaryRoot, ["update-ref", "-d", remoteRef]);
  } else {
    const fetch = runGit(runner, primaryRoot, ["fetch", "-q", remote, `${TASK_HISTORY_REF}:${remoteRef}`]);
    if (fetch.status !== 0) {
      return {
        status: "blocked",
        code: "remote-unavailable",
        detail: `refreshing ${remoteRef} from ${remote} failed after the remote answered: ${fetch.stderr.trim() || `exit ${fetch.status}`}`,
        remediation: "restore connectivity for the task-history remote and re-run preparation; this seam never decides on a failed refresh",
      };
    }
    const fetched = refHead(runner, primaryRoot, remoteRef);
    if (fetched !== remoteOid) {
      return {
        status: "blocked",
        code: "unreadable",
        detail: `the refreshed ${remoteRef} (${fetched ?? "unreadable"}) does not equal the direct remote evidence (${remoteOid}); the remote may have moved between probe and fetch`,
        remediation: "re-run preparation so a single consistent remote state is observed; never force or guess",
      };
    }
    remoteHead = fetched;
  }

  const localHead = refHead(runner, primaryRoot, TASK_HISTORY_REF);

  if (remoteHead) {
    if (sharesCodeAncestry(runner, primaryRoot, remoteHead)) {
      return {
        status: "blocked",
        code: "shared-ancestry",
        detail: `the remote task branch ${remote}/${TASK_HISTORY_BRANCH} shares history with a code branch and is not a disconnected task history`,
        remediation: `inspect \`git -C ${primaryRoot} log ${remote}/${TASK_HISTORY_BRANCH}\` and retire the wrongly created branch before re-running preparation`,
      };
    }
    if (localHead && localHead !== remoteHead) {
      if (isAncestor(runner, primaryRoot, remoteHead, localHead)) {
        return {
          status: "blocked",
          code: "local-ahead",
          detail: `the local ${TASK_HISTORY_BRANCH} (${localHead.slice(0, 12)}) has commits the selected remote ${remote} does not (${remoteHead.slice(0, 12)}); unpublished task history is never called verified`,
          remediation: `push the local task branch non-force (\`git -C ${primaryRoot} push ${remote} ${TASK_HISTORY_BRANCH}\`) or discard the unpublished local history, then re-run preparation`,
        };
      }
      if (!isAncestor(runner, primaryRoot, localHead, remoteHead)) {
        return {
          status: "blocked",
          code: "remote-advanced",
          detail: `the remote ${remote}/${TASK_HISTORY_BRANCH} (${remoteHead.slice(0, 12)}) and local task branch (${localHead.slice(0, 12)}) diverged; refusing to overwrite`,
          remediation: `inspect and reconcile the divergent task history through ordinary Git; never force`,
        };
      }
      const fastForward = runGit(runner, primaryRoot, ["update-ref", TASK_HISTORY_REF, remoteHead, localHead]);
      if (fastForward.status !== 0 || refHead(runner, primaryRoot, TASK_HISTORY_REF) !== remoteHead) {
        return {
          status: "blocked",
          code: "remote-advanced",
          detail: `the remote ${remote}/${TASK_HISTORY_BRANCH} advanced cleanly to ${remoteHead.slice(0, 12)}, but the unused local task ref could not be fast-forwarded from ${localHead.slice(0, 12)}: ${fastForward.stderr.trim() || `exit ${fastForward.status}`}`,
          remediation: `re-run preparation after the concurrent ref update settles; never force`,
        };
      }
    }
    if (!localHead) {
      const track = runGit(runner, primaryRoot, ["branch", "--track", TASK_HISTORY_BRANCH, remoteRef]);
      if (track.status !== 0) {
        throw new Error(`creating the local task branch from ${remoteRef} failed: ${track.stderr.trim() || `exit ${track.status}`}`);
      }
      const head = refHead(runner, primaryRoot, TASK_HISTORY_REF);
      if (!head || head !== remoteHead) {
        throw new Error(`the tracked task branch head did not match ${remoteRef}`);
      }
    }
    return { status: "verified", head: remoteHead };
  }

  // Direct remote evidence says the task branch is ABSENT (any stale cached
  // ref was removed above): the branch must be bootstrapped and published. A
  // local-only branch is unpublished local history with no authority and
  // blocks rather than being pushed silently.
  if (localHead) {
    return {
      status: "blocked",
      code: "local-ahead",
      detail: `the selected remote ${remote} has no task branch but the local ${TASK_HISTORY_BRANCH} exists (${localHead.slice(0, 12)}); unpublished local task history is never published implicitly or called verified`,
      remediation: `publish it explicitly (\`git -C ${primaryRoot} push ${remote} ${TASK_HISTORY_BRANCH}\`) or discard it (\`git -C ${primaryRoot} branch -D ${TASK_HISTORY_BRANCH}\`) so preparation can bootstrap the disconnected history`,
    };
  }

  // Bootstrap in a disposable temporary ordinary-Git repository. The
  // canonical primary checkout is never switched, staged, or written: the
  // orphan commit lives only in the temp clone and is published with an
  // ordinary non-force push.
  const temp = mkdtempSync(join(tmpdir(), "prime-claw-task-history-"));
  try {
    gitOk(runner, temp, ["init", "-q", "-b", TASK_HISTORY_BRANCH], "initialize the disposable bootstrap repository");
    gitOk(runner, temp, ["remote", "add", "origin", remoteUrl], "point the bootstrap repository at the selected remote");
    writeFileSync(join(temp, INITIAL_FILE), INITIAL_FILE_CONTENT);
    writeFileSync(join(temp, "config.yml"), initialConfig);
    gitOk(runner, temp, ["add", INITIAL_FILE, "config.yml"], "stage the task-history marker and lifecycle-ready config");
    gitOk(runner, temp, ["-c", "user.name=prime-claw", "-c", "user.email=prime-claw@localhost", "commit", "-q", "-m", INITIAL_COMMIT_MESSAGE], "create the initial task-history commit");
    const push = runGit(runner, temp, ["push", "origin", `${TASK_HISTORY_REF}:${TASK_HISTORY_REF}`]);
    if (push.status !== 0) {
      throw new Error(`publishing the task-history branch to ${remote} failed: ${push.stderr.trim() || `exit ${push.status}`}`);
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  // Prove the remote head from a fresh fetch; never trust the push output.
  gitOk(runner, primaryRoot, ["fetch", "-q", remote, `${TASK_HISTORY_REF}:${remoteRef}`], "re-fetch the published task branch");
  const published = refHead(runner, primaryRoot, remoteRef);
  if (!published) throw new Error(`the published ${remote}/${TASK_HISTORY_BRANCH} head could not be read after push`);
  if (sharesCodeAncestry(runner, primaryRoot, published)) {
    return {
      status: "blocked",
      code: "shared-ancestry",
      detail: `the newly published ${remote}/${TASK_HISTORY_BRANCH} unexpectedly shares history with a code branch`,
      remediation: `inspect \`git ls-remote ${remoteUrl} ${TASK_HISTORY_REF}\`; this should be impossible for an orphan commit`,
    };
  }
  const track = runGit(runner, primaryRoot, ["branch", "--track", TASK_HISTORY_BRANCH, remoteRef]);
  if (track.status !== 0) {
    throw new Error(`creating the local task branch from ${remoteRef} failed: ${track.stderr.trim() || `exit ${track.status}`}`);
  }
  const head = refHead(runner, primaryRoot, TASK_HISTORY_REF);
  if (!head || head !== published) throw new Error(`the tracked task branch head did not match ${remoteRef}`);
  return { status: "published", head: published };
}

/** The provider evidence that selects (or blocks) the built-in store location. */
function providerEvidence(primaryRoot: string) {
  try {
    return { detection: detectTaskProvider(primaryRoot), blocked: undefined };
  } catch (error) {
    return {
      detection: undefined,
      blocked: {
        status: "blocked" as const, code: "unreadable" as const,
        detail: `provider detection unavailable: ${error instanceof Error ? error.message : String(error)}`,
        remediation: "repair the repository provider evidence and re-run preparation",
      },
    };
  }
}

/**
 * The built-in task-store location for the nested clone. An existing live
 * Backlog store directory (per native detection) wins; with no live provider
 * evidence the default is `.backlog/` — never `backlog/`, which the primary
 * code repository may already use for an in-repo store. Any location that is
 * not directly inside the primary root blocks before any mutation.
 */
function selectStoreLocation(
  primaryRoot: string,
  detection: ReturnType<typeof detectTaskProvider>,
): { storeDir: string } | { blocked: TaskHistoryWorkspace & { status: "blocked" } } {
  let dir: string = BUILT_IN_TASK_STORE_DIRS[0]; // ".backlog"
  if (detection.kind === "selected" && detection.evidence.provider === "backlog") {
    const storeDir = detection.evidence.storeDir;
    if (storeDir) {
      const rel = relative(primaryRoot, storeDir);
      const parts = rel.split(sep).filter(Boolean);
      if (isAbsolute(rel) || rel === "" || rel === ".." || rel.startsWith(`..${sep}`)
          || parts.some((part) => part === "." || part === "..") || parts[0] === ".git") {
        return {
          blocked: {
            status: "blocked", code: "unsafe-store-location",
            detail: `the live Backlog store directory ${storeDir} is not a safe relative task-store location inside the primary checkout`,
            remediation: "set backlog_directory to a real relative directory inside the repository (never .git, an absolute path, or an escape) and retry",
          },
        };
      }
      dir = rel;
    }
  }
  return { storeDir: join(primaryRoot, dir) };
}

/**
 * Validate the store target before any mutation: the resolved path must be
 * directly inside the canonical primary root and no component (the target or
 * any ancestor up to the root) may be a symlink. A symlinked store or escape
 * blocks before anything is written.
 */
function validateContainment(
  primaryRoot: string,
  storeDir: string,
): TaskHistoryWorkspace & { status: "blocked" } | null {
  const rel = relative(primaryRoot, storeDir);
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`) || rel === "") {
    return {
      status: "blocked", code: "unsafe-store-location",
      detail: `the task-store target ${storeDir} is not inside the primary root ${primaryRoot}`,
      remediation: "the store location must be a safe relative path inside the repository; repair backlog_directory and retry",
    };
  }
  let cursor = storeDir;
  while (true) {
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      return {
        status: "blocked", code: "unsafe-store-location",
        detail: `the task-store path component ${cursor} is a symlink; the store must be a real directory inside the primary root`,
        remediation: `replace the symlink ${cursor} with a real directory inside ${primaryRoot} and re-run preparation`,
      };
    }
    if (cursor === primaryRoot) break;
    cursor = resolve(cursor, "..");
  }
  return null;
}

function taskStoreConfigPath(storeDir: string): string {
  return ["config.yml", "config.yaml"].map((name) => join(storeDir, name))
    .find((path) => existsSync(path)) ?? join(storeDir, "config.yml");
}

function directoryTreeHasMaterialContent(root: string): boolean {
  if (!existsSync(root)) return false;
  const entry = lstatSync(root);
  if (!entry.isDirectory() || entry.isSymbolicLink()) return true;
  for (const name of readdirSync(root)) {
    const child = join(root, name);
    const stat = lstatSync(child);
    if (!stat.isDirectory() || stat.isSymbolicLink() || directoryTreeHasMaterialContent(child)) return true;
  }
  return false;
}

function validateRootConfigCandidate(
  primaryRoot: string,
  content: string,
  storeDir: string,
  runner: CommandRunner,
): void {
  const temp = mkdtempSync(join(tmpdir(), "prime-claw-backlog-config-check-"));
  try {
    const rel = relative(primaryRoot, storeDir);
    mkdirSync(join(temp, rel), { recursive: true });
    writeFileSync(join(temp, "backlog.config.yml"), content);
    checkBacklogCapabilities(temp, runner);
    const defaultStatus = runner.run("backlog", ["config", "get", "defaultStatus"], { cwd: temp, allowFailure: true });
    const autoCommit = runner.run("backlog", ["config", "get", "autoCommit"], { cwd: temp, allowFailure: true });
    if (defaultStatus.status !== 0 || defaultStatus.stdout.trim() !== "In Design"
        || autoCommit.status !== 0 || autoCommit.stdout.trim() !== "false") {
      throw new Error(`effective defaultStatus/autoCommit must be exactly In Design/false (got ${JSON.stringify(defaultStatus.stdout.trim())}/${JSON.stringify(autoCommit.stdout.trim())})`);
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
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
 * Ensure the store directory is ignored by the primary checkout and PROVE it
 * with native Git. An existing but ineffective rule (for example `/.backlog/`
 * negated by a later `!/.backlog/`) blocks rather than returning prepared;
 * only an effective ignore — appended as a final anchored rule when absent —
 * passes `git check-ignore`, so an ordinary `git add .` can never stage the
 * nested repository as a forbidden gitlink.
 */
function ensureIgnored(
  runner: CommandRunner,
  primaryRoot: string,
  storeDir: string,
): TaskHistoryWorkspace & { status: "blocked" } | null {
  const rel = relative(primaryRoot, storeDir).split(sep).join("/");
  const pattern = `/${rel}/`;
  const ignored = () => runGit(runner, primaryRoot, ["check-ignore", "-q", "--", `${rel}/x`]).status === 0;
  if (ignored()) return null;
  const gitignorePath = join(primaryRoot, ".gitignore");
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
  // A negation targeting the store defeats any rule we append; refuse rather
  // than fight the operator's explicit un-ignore.
  const negated = existing.split(/\r?\n/).some((line) => {
    const t = line.trim();
    return t === `!${pattern}` || t === `!${pattern.slice(1)}` || t === `!/${rel}` || t === `!${rel}` || t === `!${rel}/`;
  });
  if (negated) {
    return {
      status: "blocked", code: "not-ignored",
      detail: `${gitignorePath} explicitly un-ignores ${rel}/ (a negation rule); the nested task store cannot be ignored safely`,
      remediation: `remove the \`!${rel}\` negation from ${gitignorePath} so the final anchored ${pattern} rule takes effect, then re-run preparation`,
    };
  }
  const prefix = existing.length && !existing.endsWith("\n") ? "\n" : "";
  appendFileSync(gitignorePath, `${prefix}${pattern}\n`);
  if (!ignored()) {
    return {
      status: "blocked", code: "not-ignored",
      detail: `${rel}/ is still not ignored after appending ${pattern} to ${gitignorePath} (another ignore source is in play)`,
      remediation: `make \`git -C ${primaryRoot} check-ignore ${rel}/x\` succeed (fix .gitignore, .git/info/exclude, or core.excludesFile), then re-run preparation`,
    };
  }
  return null;
}

/**
 * Refresh or repair the selected independent Backlog read workspace before an
 * admission/status read. Branch-local Backlog and Beads remain provider-native
 * and unchanged; only an already-selected independent Backlog topology uses
 * the existing primary/Episode preparation seams.
 */
export function resolveSynchronizedProviderTask(
  cwd: string,
  rawTaskId: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): ProviderTaskResolution | null {
  const topRaw = gitOk(runner, cwd, ["rev-parse", "--show-toplevel"], "resolve task-read worktree");
  const gitDirRaw = gitOk(runner, cwd, ["rev-parse", "--git-dir"], "resolve task-read git directory");
  const commonRaw = gitOk(runner, cwd, ["rev-parse", "--git-common-dir"], "resolve task-read common directory");
  const top = realpathSync(resolve(cwd, topRaw));
  const gitDir = realpathSync(resolve(cwd, gitDirRaw));
  const commonDir = realpathSync(resolve(cwd, commonRaw));
  const primaryRoot = gitDir === commonDir ? top : realpathSync(dirname(commonDir));
  const primaryDetection = detectTaskProvider(primaryRoot, runner);
  if (primaryDetection.kind === "blocked") {
    throw new Error(`task provider discovery blocked (${primaryDetection.code}): ${primaryDetection.detail}; ${primaryDetection.remediation}`);
  }
  if (primaryDetection.kind === "selected" && primaryDetection.evidence.provider === "backlog"
      && primaryDetection.evidence.storeDir && existsSync(join(primaryDetection.evidence.storeDir, ".git"))) {
    const prepared = gitDir === commonDir
      ? prepareTaskHistoryWorkspace({ primaryRoot, runner })
      : prepareEpisodeTaskHistoryWorkspace({ primaryRoot, targetWorktree: top, runner });
    if (prepared.status === "blocked") {
      throw new Error(`Backlog task-read workspace is blocked (${prepared.code}): ${prepared.detail}; ${prepared.remediation}`);
    }
  }
  return resolveProviderTask(top, rawTaskId, runner);
}

/**
 * Prepare the primary checkout's ignored independent nested Backlog clone at
 * the validated built-in task-store location, checked out on the published
 * disconnected task-history branch, with Backlog code-repository auto-commit
 * disabled through supported native behavior against the exact configuration
 * discovery selected. Idempotent: a prepared clone is verified, never
 * recreated; any deviation blocks with exact remediation.
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
  const localOnly = remoteSelection.status === "blocked" && remoteSelection.code === "no-remote"
    && input.unpublishedLocalOnly === true;
  if (remoteSelection.status === "blocked" && !localOnly) {
    return { status: "blocked", code: remoteSelection.code, detail: remoteSelection.detail, remediation: remoteSelection.remediation };
  }
  const remote = remoteSelection.status === "selected" ? remoteSelection.name : null;
  const remoteUrl = remoteSelection.status === "selected" ? remoteSelection.url : null;

  // A missing primary clone must not turn its retained root link into
  // no-provider evidence and bootstrap a different task-store location.
  const primaryRootConfig = join(primaryRoot, "backlog.config.yml");
  if (lstatIfPresent(primaryRootConfig)?.isSymbolicLink() && !existsSync(primaryRootConfig)) {
    return {
      status: "blocked", code: "config-not-preserved",
      detail: `the primary root configuration symlink ${primaryRootConfig} is dangling; its selected task store is unavailable`,
      remediation: "restore the exact published primary task-store clone before preparation; do not replace the retained root configuration",
    };
  }
  const { detection, blocked: detectionBlocked } = providerEvidence(primaryRoot);
  if (detectionBlocked) return detectionBlocked;
  if (detection!.kind === "blocked") {
    return { status: "blocked", code: "provider-not-backlog", detail: detection!.detail, remediation: detection!.remediation };
  }
  if (detection!.kind === "selected" && detection!.evidence.provider !== "backlog") {
    return {
      status: "blocked", code: "provider-not-backlog",
      detail: "the selected provider is Beads; the Backlog workspace seam does not prepare a task store for it",
      remediation: "use the provider-native Beads transport; no Backlog clone is prepared",
    };
  }

  const rootLayout = detection!.kind === "selected" && detection!.evidence.provider === "backlog"
    && detection!.evidence.configSource === "root" ? detection!.evidence : null;
  let rootConfigContent: string | null = null;
  let relocatedConfigContent: string | null = null;
  let customLayout = false;
  if (rootLayout) {
    if (!rootLayout.storeDir) {
      return {
        status: "blocked", code: "config-not-preserved",
        detail: "root configuration backlog.config.yml does not select a task store",
        remediation: "set backlog_directory to backlog, .backlog, or another safe relative directory before preparing independent task history",
      };
    }
    try {
      rootConfigContent = readFileSync(rootLayout.configPath, "utf8");
    } catch (error) {
      return {
        status: "blocked", code: "config-not-preserved",
        detail: `the selected root Backlog configuration cannot be read for relocation: ${error instanceof Error ? error.message : String(error)}`,
        remediation: "repair backlog.config.yml and retry; configuration relocation never guesses or rewrites unreadable bytes",
      };
    }
    customLayout = rootLayout.layout === "custom";
    // Root discovery reads the whole configuration, not a pointer overlay.
    // Keep both supported directory-key spellings and every other byte; the
    // relative root symlink below preserves the same native selection.
    relocatedConfigContent = rootConfigContent;
    // Validate the exact native configuration before any filesystem or Git
    // mutation. Relocation changes only discovery placement.
    try {
      validateRootConfigCandidate(primaryRoot, rootConfigContent, rootLayout.storeDir!, runner);
    } catch (error) {
      return {
        status: "blocked", code: "backlog-cli",
        detail: `the root Backlog configuration is not lifecycle-ready: ${error instanceof Error ? error.message : String(error)}`,
        remediation: "repair the native Backlog lifecycle configuration before relocating it into task history",
      };
    }
  }

  const location = selectStoreLocation(primaryRoot, detection!);
  if ("blocked" in location) return location.blocked;
  const storeDir = location.storeDir;

  // Containment and symlink safety before ANY branch or store mutation.
  const containment = validateContainment(primaryRoot, storeDir);
  if (containment) return containment;

  // Prove an existing root link before any task-branch publication or clone.
  // Native root configuration is whole-file authority; an alternate link must
  // not publish its target bytes before being refused.
  if (rootLayout && lstatIfPresent(rootLayout.configPath)?.isSymbolicLink()) {
    const expectedLink = relative(dirname(rootLayout.configPath), taskStoreConfigPath(storeDir)).split(sep).join("/");
    const actualLink = readlinkSync(rootLayout.configPath);
    if (isAbsolute(actualLink) || actualLink !== expectedLink) {
      return {
        status: "blocked", code: "config-not-preserved",
        detail: `root configuration symlink is ${JSON.stringify(actualLink)}, not the exact relative target ${JSON.stringify(expectedLink)}`,
        remediation: "retain only the exact relative root symlink into the selected published task configuration before preparation",
      };
    }
  }
  const nestedGit = join(storeDir, ".git");
  const storeExists = existsSync(storeDir);
  if (hasTrackedTaskContent(runner, primaryRoot, storeDir)) {
    return {
      status: "blocked", code: "uncommitted-task-content",
      detail: `${relative(primaryRoot, storeDir)} has files tracked by the code repository; preparing the nested clone would split task authority`,
      remediation: `remove the tracked files from the code branch (\`git -C ${primaryRoot} rm -r --cached ${relative(primaryRoot, storeDir)}\` and commit) so the store is ignored before preparation`,
    };
  }
  if (!existsSync(nestedGit) && storeExists) {
    if (!statSync(storeDir).isDirectory() || directoryTreeHasMaterialContent(storeDir)) {
      return {
        status: "blocked", code: "uncommitted-task-content",
        detail: `${storeDir} has live Backlog content and no .git; adopting task data onto the published task-history branch remains a separate migration`,
        remediation: "migrate the existing task data through the reviewed provider migration path before preparing this independent workspace",
      };
    }
    // Native root-config initialization creates an empty directory skeleton.
    // Removing only that proven-empty tree lets the ordinary clone materialize
    // at the same selected location without moving any task data.
    rmSync(storeDir, { recursive: true, force: true });
  }

  // Prove the ignore rule before creating the nested repository, so an
  // ordinary `git add .` can never stage it as a forbidden gitlink.
  const ignoreBlock = ensureIgnored(runner, primaryRoot, storeDir);
  if (ignoreBlock) return ignoreBlock;

  let branchState: { status: "verified" | "published" | "local-only"; head: string };
  if (localOnly) {
    if (existsSync(nestedGit)) {
      const identity = verifyIndependentTaskClone(storeDir, runner);
      if (identity.status === "blocked") {
        return { status: "blocked", code: identity.code === "unreadable" ? "unreadable" : "unsafe-store-location", detail: identity.detail, remediation: identity.remediation };
      }
      const remotes = gitOk(runner, storeDir, ["remote"], "read local-only task-store remotes");
      const branch = gitOk(runner, storeDir, ["symbolic-ref", "--quiet", "--short", "HEAD"], "read local-only task-store branch");
      const dirty = gitOk(runner, storeDir, ["status", "--porcelain", "--untracked-files=all"], "verify local-only task store is clean");
      const head = refHead(runner, storeDir, "HEAD");
      if (remotes !== "" || branch !== TASK_HISTORY_BRANCH || dirty !== "" || !head) {
        return {
          status: "blocked", code: dirty ? "uncommitted-task-content" : "unreadable",
          detail: `the explicit local-only task store is not one clean unpublished ${TASK_HISTORY_BRANCH} repository with no remotes`,
          remediation: "repair the local-only nested repository without publishing or forcing it, then retry",
        };
      }
      branchState = { status: "local-only", head };
    } else {
      mkdirSync(storeDir, { recursive: true });
      gitOk(runner, storeDir, ["init", "-q", "-b", TASK_HISTORY_BRANCH], "initialize explicit local-only task history");
      writeFileSync(join(storeDir, INITIAL_FILE), INITIAL_FILE_CONTENT);
      writeFileSync(join(storeDir, "config.yml"), relocatedConfigContent ?? initialTaskStoreConfig(basename(primaryRoot)));
      gitOk(runner, storeDir, ["add", INITIAL_FILE, "config.yml"], "stage local-only task history");
      gitOk(runner, storeDir, ["-c", "user.name=prime-claw", "-c", "user.email=prime-claw@localhost", "commit", "-q", "-m", INITIAL_COMMIT_MESSAGE], "commit local-only task history");
      const head = refHead(runner, storeDir, "HEAD");
      if (!head) throw new Error("the explicit local-only task-history head could not be read");
      branchState = { status: "local-only", head };
    }
  } else {
    const publishedState = ensureTaskHistoryBranch(
      primaryRoot,
      remote!,
      remoteUrl!,
      runner,
      relocatedConfigContent ?? initialTaskStoreConfig(basename(primaryRoot)),
    );
    if (publishedState.status === "blocked") {
      return { status: "blocked", code: publishedState.code, detail: publishedState.detail, remediation: publishedState.remediation };
    }
    branchState = publishedState;
  if (existsSync(nestedGit)) {
      // Existing nested clone: prove independent ordinary-Git identity before
      // any fetch, refresh, or native read. A symlinked/shared .git directory
      // must never be accepted as a second independent workspace.
      const identity = verifyIndependentTaskClone(storeDir, runner);
      if (identity.status === "blocked") {
        return {
          status: "blocked",
          code: identity.code === "unreadable" ? "unreadable" : "unsafe-store-location",
          detail: identity.detail,
          remediation: identity.remediation,
        };
      }
      // Existing nested clone: verify it exactly — remote name AND canonical
      // transport URL — never recreate.
      if (!statSync(nestedGit).isDirectory()) {
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
      const innerUrl = gitOk(runner, storeDir, ["remote", "get-url", remote], "read the nested clone remote URL");
      if (innerUrl !== remoteUrl) {
        return {
          status: "blocked", code: "unreadable",
          detail: `the nested clone remote ${remote} points at ${innerUrl}, not the selected remote's canonical URL ${remoteUrl}`,
          remediation: `remove ${storeDir} and re-run preparation, or repair its remote URL to ${remoteUrl}`,
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
      // Refresh from the selected remote (result-checked) into the tracking
      // namespace; a divergence blocks rather than being overwritten.
      gitOk(runner, storeDir, ["fetch", "-q", remote, `${TASK_HISTORY_REF}:refs/remotes/${remote}/${TASK_HISTORY_BRANCH}`], "refresh the nested clone task branch");
      const innerRemoteHead = refHead(runner, storeDir, `refs/remotes/${remote}/${TASK_HISTORY_BRANCH}`);
      const innerHead = refHead(runner, storeDir, "HEAD");
      if (!innerHead || !innerRemoteHead) {
        return {
          status: "blocked", code: "unreadable",
          detail: `the nested clone head (${innerHead ?? "unreadable"}) or remote ref (${innerRemoteHead ?? "unreadable"}) could not be read`,
          remediation: "inspect the nested clone refs and re-run preparation",
        };
      }
      // ensureTaskHistoryBranch already blocked a remote ahead of the primary's
      // local task branch, and a local-ahead branch blocks too; the nested clone
      // tracks the primary's branch, so innerHead === innerRemoteHead here. A
      // mismatch means divergence this foundation never reconciles.
      if (innerHead !== innerRemoteHead) {
        const nestedClean = runGit(runner, storeDir, ["--no-optional-locks", "status", "--porcelain", "--untracked-files=all"]);
        if (nestedClean.status !== 0 || nestedClean.stdout.trim() !== ""
            || !isAncestor(runner, storeDir, innerHead, innerRemoteHead)) {
          return {
            status: "blocked", code: nestedClean.status === 0 && nestedClean.stdout.trim() !== "" ? "uncommitted-task-content" : "remote-advanced",
            detail: `the nested clone (${innerHead.slice(0, 12)}) is not a clean fast-forward ancestor of the remote task branch (${innerRemoteHead.slice(0, 12)})`,
            remediation: "inspect and reconcile the nested clone with the remote task branch through ordinary Git; never force",
          };
        }
        const fastForward = runGit(runner, storeDir, ["merge", "--ff-only", `refs/remotes/${remote}/${TASK_HISTORY_BRANCH}`]);
        if (fastForward.status !== 0 || refHead(runner, storeDir, "HEAD") !== innerRemoteHead) {
          return {
            status: "blocked", code: "remote-advanced",
            detail: `the clean nested clone could not fast-forward to ${innerRemoteHead}: ${fastForward.stderr.trim() || `exit ${fastForward.status}`}`,
            remediation: "retry after concurrent publishers quiesce; never force",
          };
        }
      }
      const finalHead = refHead(runner, storeDir, "HEAD");
      if (finalHead !== branchState.head) {
        return {
          status: "blocked", code: "unreadable",
          detail: `the nested clone head ${finalHead ?? "unreadable"} does not match the task-history head ${branchState.head}`,
          remediation: "inspect the nested clone refs and re-run preparation",
        };
      }
    } else {
      // Fresh nested clone FROM THE SELECTED REMOTE'S TRANSPORT URL — never
      // from the primary checkout's filesystem path — onto the published task
      // branch, with tracking configured by the clone itself.
      gitOk(runner, primaryRoot, ["clone", "-q", "--origin", remote, "--branch", TASK_HISTORY_BRANCH, remoteUrl, storeDir], "clone the nested task store from the selected remote");
      const identity = verifyIndependentTaskClone(storeDir, runner);
      if (identity.status === "blocked") {
        return {
          status: "blocked",
          code: identity.code === "unreadable" ? "unreadable" : "unsafe-store-location",
          detail: identity.detail,
          remediation: identity.remediation,
        };
      }
      // Prove the published content is tracked, not staged for deletion: the
      // clone's cached diff against the published head must be empty.
      const innerHead = refHead(runner, storeDir, "HEAD");
      if (!innerHead || innerHead !== branchState.head) {
        return {
          status: "blocked", code: "unreadable",
          detail: `the nested clone head ${innerHead ?? "unreadable"} does not match the published task-history head ${branchState.head}`,
          remediation: "inspect the nested clone refs and re-run preparation",
        };
      }
      const cachedDiff = gitOk(runner, storeDir, ["diff", "--cached", "--name-only"], "verify the nested clone index matches the published task branch");
      if (cachedDiff.length > 0) {
        return {
          status: "blocked", code: "unreadable",
          detail: `the nested clone index does not match the published task branch (staged: ${cachedDiff.split(/\r?\n/).slice(0, 5).join(", ")})`,
          remediation: `remove ${storeDir} and re-run preparation`,
        };
      }
    }
  }

  // The folder configuration lives ON the published task-history branch (the
  // bootstrap publishes the exact lifecycle-ready config). The nested clone
  // checks it out tracked; this seam NEVER writes an untracked, unpublished,
  // or non-lifecycle-ready local config.
  const nestedConfigPath = taskStoreConfigPath(storeDir);
  if (!existsSync(nestedConfigPath)) {
    return {
      status: "blocked", code: "config-not-preserved",
      detail: `the published task-history branch carries no folder configuration in ${storeDir}; establishing one locally would be an untracked, unpublished, non-lifecycle-ready config, which this seam never returns as prepared`,
      remediation: "publish the lifecycle-ready task store config through a separately reviewed existing-store adoption, then re-run preparation",
    };
  }
  if (relocatedConfigContent !== null && readFileSync(nestedConfigPath, "utf8") !== relocatedConfigContent) {
    return {
      status: "blocked", code: "config-not-preserved",
      detail: `the published task-history configuration at ${nestedConfigPath} does not exactly preserve the selected root configuration semantics`,
      remediation: "publish the reviewed relocated configuration on the task-history branch or retire the conflicting branch; never overwrite it implicitly",
    };
  }
  const configSource: "root" | "folder" | "none" =
    detection!.kind === "selected" && detection!.evidence.provider === "backlog" ? detection!.evidence.configSource : "none";

  // Validate the prepared store's EFFECTIVE native Backlog configuration from
  // the canonical primary root on every path — regardless of the pre-clone
  // provider detection result and regardless of whether the task branch was
  // newly bootstrapped or pre-existing. Native config discovery walks up from
  // the nested store, so `primaryRoot` resolves the materialized nested clone.
  // These are the managed native CLI reads, not a custom byte parse.
  //
  // The existing capability gate proves the exact ordered canonical lifecycle
  // statuses; a pre-existing remote branch with generic statuses cannot pass.
  try {
    checkBacklogCapabilities(primaryRoot, runner);
  } catch (error) {
    return {
      status: "blocked", code: "backlog-cli",
      detail: `the task store's effective native configuration is not lifecycle-ready: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "the published task-store config must carry the exact ordered canonical lifecycle; this seam never rewrites a published config (remote mutation is deferred)",
    };
  }
  // Prove the effective native default status is exactly "In Design"; do not
  // rely only on generated config bytes.
  const defaultStatus = runner.run("backlog", ["config", "get", "defaultStatus"], { cwd: primaryRoot, allowFailure: true });
  if (defaultStatus.status !== 0 || defaultStatus.stdout.trim() !== "In Design") {
    return {
      status: "blocked", code: "backlog-cli",
      detail: `the task store's effective native default status is ${JSON.stringify(defaultStatus.stdout.trim())} (exit ${defaultStatus.status}), not exactly "In Design"`,
      remediation: "the published task-store config must set default_status to In Design; this seam never rewrites a published config (remote mutation is deferred)",
    };
  }
  // Read the effective auto_commit value natively; require the exact false
  // result. Never `config set` or locally rewrite the published config.
  const autoCommit = runner.run("backlog", ["config", "get", "autoCommit"], { cwd: primaryRoot, allowFailure: true });
  if (autoCommit.status !== 0 || autoCommit.stdout.trim() !== "false") {
    return {
      status: "blocked", code: "backlog-cli",
      detail: `the task store's effective native auto_commit is ${JSON.stringify(autoCommit.stdout.trim())} (exit ${autoCommit.status}), not exactly "false"; code-repository auto-commit must be disabled`,
      remediation: "disabling auto-commit in the published task-store config is part of the deferred mutation/cutover; this seam never writes the config locally",
    };
  }

  // Prove the nested clone is clean and exactly at the published head AFTER
  // the native reads above: any native normalization or write they performed
  // is caught here and BLOCKS rather than being certified clean.
  const dirty = gitOk(runner, storeDir, ["status", "--porcelain"], "verify the nested clone is clean");
  if (dirty.trim() !== "") {
    return {
      status: "blocked", code: "uncommitted-task-content",
      detail: `the nested clone ${storeDir} has uncommitted changes after preparation (native config reads may have normalized it): ${dirty.trim().split(/\r?\n/).slice(0, 5).join(", ")}`,
      remediation: "the nested clone must be clean; the published config must already be canonical so native reads never rewrite it; inspect and re-run preparation",
    };
  }
  const unpublishedCheck = refHead(runner, storeDir, "HEAD");
  if (unpublishedCheck !== branchState.head) {
    return {
      status: "blocked", code: "local-ahead",
      detail: `the nested clone HEAD (${unpublishedCheck ?? "unreadable"}) does not equal the published task-history head (${branchState.head}); unpublished task content is never returned as prepared`,
      remediation: "publish the nested clone's commits (the deferred mutation loop) or re-run preparation",
    };
  }
  let layoutWarning: string | undefined;
  if (rootLayout && rootConfigContent !== null) {
    const rootEntry = lstatIfPresent(rootLayout.configPath);
    if (!rootEntry) {
      return {
        status: "blocked", code: "config-not-preserved",
        detail: `the selected root configuration ${rootLayout.configPath} disappeared before relocation`,
        remediation: "restore the exact selected configuration and retry",
      };
    }
    let changedRoot = false;
    const expectedLink = relative(dirname(rootLayout.configPath), nestedConfigPath).split(sep).join("/");
    if (rootEntry.isSymbolicLink()) {
      const actualLink = readlinkSync(rootLayout.configPath);
      if (isAbsolute(actualLink) || actualLink !== expectedLink) {
        return {
          status: "blocked", code: "config-not-preserved",
          detail: `root configuration symlink is ${JSON.stringify(actualLink)}, not the exact relative target ${JSON.stringify(expectedLink)}`,
          remediation: `replace it with the relative symlink ${rootLayout.configPath} -> ${expectedLink}; absolute or alternate targets are refused`,
        };
      }
    } else if (rootEntry.isFile()) {
      unlinkSync(rootLayout.configPath);
      symlinkSync(expectedLink, rootLayout.configPath);
      changedRoot = true;
    } else {
      return {
        status: "blocked", code: "config-not-preserved",
        detail: `${rootLayout.configPath} is neither a regular configuration file nor the required relative symlink`,
        remediation: "restore a regular root configuration so Prime Claw can relocate it safely",
      };
    }
    if (customLayout) {
      layoutWarning = `custom Backlog layout retained through relative symlink ${relative(primaryRoot, rootLayout.configPath)} -> ${expectedLink}; this compatibility layout is more brittle than .backlog/ or backlog/`;
    }

    try {
      checkBacklogCapabilities(primaryRoot, runner);
      const relocatedDetection = detectTaskProvider(primaryRoot, runner);
      if (relocatedDetection.kind !== "selected" || relocatedDetection.evidence.provider !== "backlog"
          || !relocatedDetection.evidence.storeDir
          || realpathSync(relocatedDetection.evidence.storeDir) !== realpathSync(storeDir)) {
        throw new Error("native provider discovery no longer selects the exact relocated task store");
      }
      if (gitOk(runner, storeDir, ["status", "--porcelain"], "verify relocated task configuration is clean") !== ""
          || refHead(runner, storeDir, "HEAD") !== branchState.head) {
        throw new Error("relocation changed or advanced the published task-history clone");
      }
    } catch (error) {
      if (changedRoot) {
        const current = lstatIfPresent(rootLayout.configPath);
        if (current) unlinkSync(rootLayout.configPath);
        writeFileSync(rootLayout.configPath, rootConfigContent);
      }
      return {
        status: "blocked", code: "config-not-preserved",
        detail: `root configuration relocation did not preserve native authority: ${error instanceof Error ? error.message : String(error)}`,
        remediation: "inspect the unchanged published task config and retry after repairing native discovery; the original root config was restored",
      };
    }
  }

  const finalConfigSource = rootLayout ? "root" : configSource;
  if (localOnly) {
    return {
      status: "prepared",
      remote: null,
      remoteUrl: null,
      remoteVia: "local-only",
      branch: TASK_HISTORY_BRANCH,
      branchState: "local-only",
      head: branchState.head,
      storeDir,
      configSource: finalConfigSource,
      autoCommit: false,
      unpublished: true,
      ...(layoutWarning ? { layoutWarning } : {}),
    };
  }
  return {
    status: "prepared",
    remote: remote!,
    remoteUrl: remoteUrl!,
    remoteVia: remoteSelection.status === "selected" ? remoteSelection.via : "sole-remote",
    branch: TASK_HISTORY_BRANCH,
    branchState: branchState.status as "verified" | "published",
    head: branchState.head,
    storeDir,
    configSource: finalConfigSource,
    autoCommit: false,
    ...(layoutWarning ? { layoutWarning } : {}),
  };
}


// ---------------------------------------------------------------------------
// Slice 2B: Episode-worktree preparation + guarded nested-store cleanup
//
// The least-technology direct ordinary-Git/Backlog seams for ONE canonical
// primary checkout plus ONE exact target linked code worktree. This is Git
// identity/containment and ordinary clone/cleanup only: no ownership fields,
// no lifecycle wiring, no per-task mutation loop, no Beads transport, no
// provider-neutral framework. The accepted slice-2A behavior is unchanged.
// ---------------------------------------------------------------------------

export interface EpisodeTaskHistoryWorkspaceInput {
  /** Absolute path of the canonical primary checkout (never the target worktree). */
  primaryRoot: string;
  /** Absolute path of the target linked Episode code worktree. */
  targetWorktree: string;
  /** Optional owned published revision that must remain an ancestor at cleanup. */
  expectedRevision?: string;
  runner?: CommandRunner;
}

export type EpisodeTaskHistoryWorkspace =
  | {
      status: "prepared";
      primaryRoot: string;
      targetWorktree: string;
      storeDir: string;
      remote: string;
      remoteUrl: string;
      branch: typeof TASK_HISTORY_BRANCH;
      head: string;
    }
  | {
      status: "blocked";
      code:
        | "not-primary-checkout"
        | "not-linked-worktree"
        | "common-repo-mismatch"
        | "unsafe-store-location"
        | "not-ignored"
        | "no-remote"
        | "ambiguous-remotes"
        | "remote-unavailable"
        | "shared-ancestry"
        | "remote-advanced"
        | "local-ahead"
        | "unreadable"
        | "uncommitted-task-content"
        | "config-not-preserved"
        | "provider-not-backlog"
        | "dual-providers"
        | "backlog-cli";
      detail: string;
      remediation: string;
    };

export type EpisodeTaskHistoryCleanup =
  | { status: "cleaned"; storeDir: string }
  | {
      status: "refused";
      code:
        | "unsafe-store-location"
        | "not-linked-worktree"
        | "common-repo-mismatch"
        | "remote-unavailable"
        | "uncommitted-task-content"
        | "local-ahead"
        | "remote-advanced"
        | "unreadable"
        | "identity-mismatch"
        | "not-a-repository";
      detail: string;
      remediation: string;
    };

export type EpisodeTaskHistoryInspection =
  | { status: "ready"; storeDir: string; present: boolean }
  | Extract<EpisodeTaskHistoryCleanup, { status: "refused" }>;


/** One exact native Backlog edit to publish on the disconnected task-history branch. */
export interface EpisodeTaskHistoryMutationInput extends EpisodeTaskHistoryWorkspaceInput {
  /** Exact canonical task ID to resolve before and after the native mutation. */
  taskId: string;
  /** Native `backlog task edit` option/value pairs; positional IDs are impossible. */
  edits: Array<{ option: string; value?: string }>;
  /** Optional exact synchronized native source status required before mutation. */
  expectedTaskStatus?: string;
  /** Require a non-placeholder synchronized native Implementation Plan. */
  requireMeaningfulPlan?: boolean;
  /** Ordinary Git commit message; defaults to `prime-claw: update <taskId>`. */
  commitMessage?: string;
}

export type EpisodeTaskHistoryMutation =
  | {
      status: "published";
      storeDir: string;
      remote: string;
      branch: typeof TASK_HISTORY_BRANCH;
      baseHead: string;
      publishedHead: string;
      taskId: string;
      taskPath: string;
      nativeBefore: string;
      nativeAfter: string;
      diff: string;
    }
  | {
      status: "blocked";
      code:
        | "invalid-mutation"
        | "identity-mismatch"
        | "unsafe-store-location"
        | "remote-unavailable"
        | "remote-advanced"
        | "local-ahead"
        | "uncommitted-task-content"
        | "native-read-failed"
        | "native-mutation-failed"
        | "unexpected-task-change"
        | "commit-failed"
        | "push-failed"
        | "same-task-advanced"
        | "ambiguous-remote-advance"
        | "reconcile-failed"
        | "unreadable";
      detail: string;
      remediation: string;
      storeDir?: string;
      remote?: string;
      baseHead?: string;
      localHead?: string;
      remoteHead?: string;
      taskId: string;
      taskPath?: string;
      nativeBefore?: string;
      nativeAfter?: string;
      nativeRemote?: string;
      localDiff?: string;
      remoteDiff?: string;
    };

/**
 * Prove the primary checkout and the target worktree share the exact same Git
 * common repository and that the target is a REGISTERED linked worktree of it
 * (never the primary, an arbitrary directory, or a foreign repository). Git
 * identity/containment only; no ownership fields or lifecycle wiring.
 */
function verifyLinkedWorktree(
  primaryRoot: string,
  targetWorktree: string,
  runner: CommandRunner,
): EpisodeTaskHistoryWorkspace & { status: "blocked" } | null {
  const primaryReal = realpathSync(primaryRoot);
  const targetReal = realpathSync(targetWorktree);
  if (primaryReal === targetReal) {
    return {
      status: "blocked", code: "not-linked-worktree",
      detail: `the target ${targetWorktree} resolves to the primary checkout itself; an Episode-worktree workspace requires a distinct linked code worktree`,
      remediation: "create the Episode worktree with `git worktree add` and pass its path",
    };
  }
  const primaryCommon = gitOk(runner, primaryRoot, ["rev-parse", "--git-common-dir"], "resolve the primary's common Git directory");
  const primaryCommonReal = realpathSync(resolve(primaryRoot, primaryCommon));
  const targetCommonResult = runGit(runner, targetWorktree, ["rev-parse", "--git-common-dir"]);
  if (targetCommonResult.status !== 0) {
    return {
      status: "blocked", code: "not-linked-worktree",
      detail: `the target ${targetWorktree} is not a Git worktree: ${targetCommonResult.stderr.trim() || targetCommonResult.stdout.trim()}`,
      remediation: "the target must be a linked code worktree of the same repository as the primary checkout",
    };
  }
  const targetCommonReal = realpathSync(resolve(targetWorktree, targetCommonResult.stdout.trim()));
  if (targetCommonReal !== primaryCommonReal) {
    return {
      status: "blocked", code: "common-repo-mismatch",
      detail: `the target ${targetWorktree} shares no Git common repository with the primary checkout ${primaryRoot} (target common dir ${targetCommonReal}, primary ${primaryCommonReal}); this is a foreign repository`,
      remediation: "only a linked worktree of the SAME Git common repository is supported; pass an Episode worktree created from the primary checkout's repository",
    };
  }
  // The target must be a REGISTERED linked worktree of this common repository,
  // not merely a directory that happens to share a .git dir (or the primary).
  const worktreeList = gitOk(runner, primaryRoot, ["worktree", "list", "--porcelain"], "list registered worktrees");
  const registered = new Set(
    worktreeList.split(/\r?\n/).filter((l) => l.startsWith("worktree ")).map((l) => realpathSync(l.slice("worktree ".length).trim())),
  );
  const registeredLinked = new Set([...registered].filter((p) => p !== primaryReal));
  if (!registeredLinked.has(targetReal)) {
    return {
      status: "blocked", code: "not-linked-worktree",
      detail: `the target ${targetWorktree} is not a registered linked worktree of the common repository (registered linked worktrees: ${[...registeredLinked].join(", ") || "none"})`,
      remediation: "register the Episode worktree with `git worktree add` from the primary checkout's repository",
    };
  }
  return null;
}

type EpisodeAuthorityBlocked = EpisodeTaskHistoryWorkspace & { status: "blocked" };

type NonMutatingPrimaryTaskAuthority =
  | {
      status: "ready";
      primaryRoot: string;
      storeDir: string;
      storeName: string;
      remote: string;
      remoteUrl: string;
      head: string;
    }
  | EpisodeAuthorityBlocked;

/** Derive one exact built-in target store from the prepared primary result. */
function deriveTargetStore(
  primaryRoot: string,
  targetWorktree: string,
  primaryStoreDir: string,
): { storeDir: string; storeName: string } | { blocked: EpisodeAuthorityBlocked } {
  const primaryReal = realpathSync(primaryRoot);
  const rel = relative(primaryReal, resolve(primaryStoreDir));
  const parts = rel.split(sep).filter(Boolean);
  if (isAbsolute(rel) || rel === "" || rel === ".." || rel.startsWith(`..${sep}`)
      || parts.some((part) => part === "." || part === "..") || parts[0] === ".git") {
    return {
      blocked: {
        status: "blocked", code: "unsafe-store-location",
        detail: `the prepared primary store ${primaryStoreDir} is not one safe relative store inside ${primaryReal}`,
        remediation: "repair backlog_directory so the store is a relative in-repository path before preparing an Episode workspace",
      },
    };
  }
  const storeName = rel;
  return { storeName, storeDir: join(targetWorktree, storeName) };
}

/** Distinguish an absent path from any real filesystem entry (including a dangling symlink). */
function lstatIfPresent(path: string): ReturnType<typeof lstatSync> | null {
  try {
    return lstatSync(path);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return null;
    throw error;
  }
}

/**
 * Prove provider discovery from the target root resolves to the exact nested
 * Backlog store. Before a fresh clone, no provider evidence is also safe; any
 * evidence selecting another provider/store blocks before the clone write.
 */
function verifyTargetBacklogAuthority(
  targetWorktree: string,
  storeDir: string,
  runner: CommandRunner,
  allowNone: boolean,
): EpisodeAuthorityBlocked | null {
  const rootConfigPath = join(targetWorktree, "backlog.config.yml");
  let expectedDanglingRoot = false;
  if (lstatIfPresent(rootConfigPath)?.isSymbolicLink() && !existsSync(rootConfigPath)) {
    const link = readlinkSync(rootConfigPath);
    const expectedLinks = ["config.yml", "config.yaml"].map((name) =>
      relative(targetWorktree, join(storeDir, name)).split(sep).join("/"));
    expectedDanglingRoot = allowNone && expectedLinks.includes(link);
    if (!expectedDanglingRoot) {
      return {
        status: "blocked", code: "config-not-preserved",
        detail: `the target root configuration link ${JSON.stringify(link)} does not resolve to the derived published task configuration`,
        remediation: "retain the exact relative root link into this task store; a dangling link is allowed only while its clone is absent",
      };
    }
  }
  let detection: ReturnType<typeof detectTaskProvider>;
  try {
    detection = detectTaskProvider(targetWorktree, runner);
  } catch (error) {
    return {
      status: "blocked", code: "unreadable",
      detail: `target-native provider detection failed: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "repair the target worktree provider evidence before preparing or reusing its task-history store",
    };
  }
  if (detection.kind === "blocked") {
    return {
      status: "blocked", code: detection.code === "dual-providers" ? "dual-providers" : "unsafe-store-location",
      detail: `target-native provider authority is ambiguous or malformed: ${detection.detail}`,
      remediation: detection.remediation,
    };
  }
  let targetReal: string;
  let projectReal: string;
  try {
    targetReal = realpathSync(targetWorktree);
    projectReal = realpathSync(detection.projectRoot);
  } catch (error) {
    return {
      status: "blocked", code: "unreadable",
      detail: `target-native project-root identity could not be resolved: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "repair the target worktree identity before preparing or cleaning its nested task store",
    };
  }
  if (projectReal !== targetReal) {
    return {
      status: "blocked", code: "unsafe-store-location",
      detail: `target-native provider discovery resolved project root ${projectReal}, not the exact target worktree ${targetReal}`,
      remediation: "pass the exact registered target worktree root; provider authority from an ancestor or another checkout is refused",
    };
  }
  if (detection.kind === "none") {
    if (allowNone) return null;
    return {
      status: "blocked", code: "provider-not-backlog",
      detail: `target-native provider discovery found no Backlog authority at the derived store ${storeDir}`,
      remediation: "the materialized nested store must contain its published folder configuration so native Backlog discovery selects that exact store",
    };
  }
  if (detection.evidence.provider !== "backlog") {
    return {
      status: "blocked", code: "provider-not-backlog",
      detail: `target-native provider discovery selects Beads at ${detection.evidence.storeDir}, not the derived Backlog store ${storeDir}`,
      remediation: "complete or remove the conflicting target provider evidence before preparing the Backlog Episode workspace",
    };
  }
  // A competing built-in can be visible only until the exact clone arrives.
  // Project identity, Beads and dual-provider refusals above still apply.
  if (expectedDanglingRoot) return null;
  if (detection.evidence.configSource === "root") {
    const rootEntry = lstatIfPresent(detection.evidence.configPath);
    const expectedConfig = taskStoreConfigPath(storeDir);
    let exactRelativeLink = false;
    if (rootEntry?.isSymbolicLink()) {
      const target = readlinkSync(detection.evidence.configPath);
      try {
        exactRelativeLink = !isAbsolute(target)
          && realpathSync(resolve(dirname(detection.evidence.configPath), target)) === realpathSync(expectedConfig);
      } catch {
        exactRelativeLink = false;
      }
    }
    if (!exactRelativeLink) {
      return {
        status: "blocked", code: "unsafe-store-location",
        detail: `the target root configuration is not the exact relative Backlog compatibility symlink into ${expectedConfig}`,
        remediation: "retain custom layout only through the reviewed relative backlog.config.yml -> <store>/config.yml symlink; regular, absolute, dangling, or alternate targets are refused",
      };
    }
  }
  const selectedStore = detection.evidence.storeDir;
  let exactStore = false;
  if (selectedStore) {
    try {
      exactStore = realpathSync(selectedStore) === realpathSync(storeDir);
    } catch {
      exactStore = false;
    }
  }
  if (!selectedStore || !exactStore) {
    return {
      status: "blocked", code: "unsafe-store-location",
      detail: `target-native Backlog authority resolves to ${selectedStore ?? "no materialized store"}, not the exact derived store ${storeDir}`,
      remediation: "remove or repair the conflicting target root/folder configuration so native Backlog discovery selects the derived nested store",
    };
  }
  return null;
}

/**
 * Prove an existing store is one exact independent ordinary clone. The `.git`
 * entry itself must be a real directory (never a symlink/gitfile), Git's
 * canonical top level must be the store, and both Git directory identities
 * must be the real contained `<store>/.git`.
 */
function verifyIndependentTaskClone(
  storeDir: string,
  runner: CommandRunner,
): { status: "verified" } | EpisodeAuthorityBlocked {
  let storeStat: ReturnType<typeof lstatSync>;
  let dotGitStat: ReturnType<typeof lstatSync>;
  const dotGit = join(storeDir, ".git");
  try {
    storeStat = lstatSync(storeDir);
    dotGitStat = lstatSync(dotGit);
  } catch (error) {
    return {
      status: "blocked", code: "unsafe-store-location",
      detail: `the nested task store clone identity is incomplete: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "remove the incomplete/foreign store and re-run preparation; only an independent ordinary-Git clone is accepted",
    };
  }
  if (!storeStat.isDirectory() || storeStat.isSymbolicLink() || !dotGitStat.isDirectory() || dotGitStat.isSymbolicLink()) {
    return {
      status: "blocked", code: "unsafe-store-location",
      detail: `${storeDir} is not an independent ordinary-Git clone with a real contained .git directory (symlinks, gitfiles, and linked worktrees are refused)`,
      remediation: "remove the foreign store and re-run preparation; never reuse a symlinked .git, gitfile, linked worktree, or non-directory store",
    };
  }
  const top = runGit(runner, storeDir, ["rev-parse", "--show-toplevel"]);
  const gitDir = runGit(runner, storeDir, ["rev-parse", "--git-dir"]);
  const commonDir = runGit(runner, storeDir, ["rev-parse", "--git-common-dir"]);
  for (const [label, result] of [["top level", top], ["Git directory", gitDir], ["common Git directory", commonDir]] as const) {
    if (result.status !== 0 || result.stdout.trim() === "") {
      return {
        status: "blocked", code: "unreadable",
        detail: `the nested clone's ${label} proof failed: ${result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`}`,
        remediation: "repair or remove the unreadable/foreign nested repository; its identity must be proved before reuse or cleanup",
      };
    }
  }
  try {
    const storeReal = realpathSync(storeDir);
    const expectedGitReal = realpathSync(dotGit);
    const topReal = realpathSync(resolve(storeDir, top.stdout.trim()));
    const gitDirReal = realpathSync(resolve(storeDir, gitDir.stdout.trim()));
    const commonDirReal = realpathSync(resolve(storeDir, commonDir.stdout.trim()));
    if (expectedGitReal !== join(storeReal, ".git") || topReal !== storeReal || gitDirReal !== expectedGitReal || commonDirReal !== expectedGitReal) {
      return {
        status: "blocked", code: "unsafe-store-location",
        detail: `the nested clone has foreign/custom Git identity (top ${topReal}, git dir ${gitDirReal}, common dir ${commonDirReal}; expected top ${storeReal} and contained ${join(storeReal, ".git")})`,
        remediation: "remove the foreign/custom-work-tree store and re-run preparation; cleanup never follows external Git identity",
      };
    }
  } catch (error) {
    return {
      status: "blocked", code: "unreadable",
      detail: `the nested clone's canonical identity could not be resolved: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "repair or remove the unreadable nested repository; its canonical top/Git/common directories must be proved",
    };
  }
  return { status: "verified" };
}

/** Read the one exact published task ref directly, without fetch/update-ref. */
function readDirectTaskHead(
  primaryRoot: string,
  remote: string,
  remoteUrl: string,
  runner: CommandRunner,
): { status: "found"; head: string } | EpisodeAuthorityBlocked {
  const probe = runGit(runner, primaryRoot, ["ls-remote", "--heads", remoteUrl, TASK_HISTORY_REF]);
  if (probe.status !== 0) {
    return {
      status: "blocked", code: "remote-unavailable",
      detail: `the selected remote ${remote} (${remoteUrl}) could not be read directly: ${probe.stderr.trim() || probe.stdout.trim() || `exit ${probe.status}`}`,
      remediation: "restore connectivity/credentials and retry; cleanup never relies on stale local remote-tracking state",
    };
  }
  const lines = probe.stdout.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const match = lines.length === 1 ? lines[0].match(/^([0-9a-f]{40})\trefs\/heads\/prime-claw\/tasks$/) : null;
  if (!match) {
    return {
      status: "blocked", code: "unreadable",
      detail: `the selected remote ${remote} did not return one exact published ${TASK_HISTORY_REF} record: ${JSON.stringify(probe.stdout.trim())}`,
      remediation: `publish exactly ${TASK_HISTORY_REF} on the selected remote before cleanup; absent or malformed authority is never guessed`,
    };
  }
  return { status: "found", head: match[1] };
}

/**
 * Non-mutating primary authority proof for cleanup. Unlike primary preparation,
 * this never writes ignore rules, creates/clones a primary store, fetches, or
 * updates refs.
 */
function inspectPrimaryTaskAuthority(
  primaryRootInput: string,
  runner: CommandRunner,
): NonMutatingPrimaryTaskAuthority {
  const primaryRoot = realpathSync(resolve(primaryRootInput));
  const gitDir = gitOk(runner, primaryRoot, ["rev-parse", "--git-dir"], "read the primary Git directory");
  const commonDir = gitOk(runner, primaryRoot, ["rev-parse", "--git-common-dir"], "read the primary common Git directory");
  if (realpathSync(resolve(primaryRoot, gitDir)) !== realpathSync(resolve(primaryRoot, commonDir))) {
    return {
      status: "blocked", code: "not-primary-checkout",
      detail: `${primaryRoot} is a linked worktree; cleanup authority must come from the canonical primary checkout`,
      remediation: "pass the canonical primary checkout recorded for this Episode",
    };
  }
  const selected = selectTaskHistoryRemote(primaryRoot, runner);
  if (selected.status === "blocked") return { status: "blocked", code: selected.code, detail: selected.detail, remediation: selected.remediation };

  let detection: ReturnType<typeof detectTaskProvider>;
  try {
    detection = detectTaskProvider(primaryRoot, runner);
  } catch (error) {
    return {
      status: "blocked", code: "unreadable",
      detail: `primary provider detection unavailable: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "repair the primary provider evidence before retrying cleanup",
    };
  }
  if (detection.kind === "blocked") {
    return { status: "blocked", code: detection.code === "dual-providers" ? "dual-providers" : "unsafe-store-location", detail: detection.detail, remediation: detection.remediation };
  }
  let detectedRoot: string;
  try {
    detectedRoot = realpathSync(detection.projectRoot);
  } catch (error) {
    return {
      status: "blocked", code: "unreadable",
      detail: `the primary provider project root could not be resolved: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "repair the primary Git work-tree identity before retrying cleanup",
    };
  }
  if (detectedRoot !== primaryRoot) {
    return {
      status: "blocked", code: "unsafe-store-location",
      detail: `primary provider discovery resolved project root ${detectedRoot}, not the exact canonical primary ${primaryRoot}`,
      remediation: "remove the custom/external primary work-tree identity; cleanup accepts authority only from the exact canonical primary root",
    };
  }
  if (detection.kind === "selected" && detection.evidence.provider !== "backlog") {
    return {
      status: "blocked", code: "provider-not-backlog",
      detail: "the primary checkout selects Beads; the Backlog cleanup seam has no authority over it",
      remediation: "use the future provider-specific cleanup path; this seam removes only Backlog task-history clones",
    };
  }
  if (detection.kind === "selected" && detection.evidence.provider === "backlog" && detection.evidence.configSource === "root") {
    const configEntry = lstatIfPresent(detection.evidence.configPath);
    const expectedConfig = detection.evidence.storeDir ? taskStoreConfigPath(detection.evidence.storeDir) : "";
    let exactRelativeLink = false;
    if (configEntry?.isSymbolicLink() && expectedConfig) {
      const target = readlinkSync(detection.evidence.configPath);
      try {
        exactRelativeLink = !isAbsolute(target)
          && realpathSync(resolve(dirname(detection.evidence.configPath), target)) === realpathSync(expectedConfig);
      } catch {
        exactRelativeLink = false;
      }
    }
    if (!exactRelativeLink) {
      return {
        status: "blocked", code: "config-not-preserved",
        detail: `the primary custom-layout root configuration is not the exact relative symlink into its published nested store`,
        remediation: "re-run explicit initialization to relocate root configuration, or repair the reviewed relative symlink without changing task data",
      };
    }
  }
  const location = selectStoreLocation(primaryRoot, detection);
  if ("blocked" in location) return location.blocked;
  const containment = validateContainment(primaryRoot, location.storeDir);
  if (containment) return containment;
  const derived = deriveTargetStore(primaryRoot, primaryRoot, location.storeDir);
  if ("blocked" in derived) return derived.blocked;
  const direct = readDirectTaskHead(primaryRoot, selected.name, selected.url, runner);
  if (direct.status === "blocked") return direct;
  return {
    status: "ready",
    primaryRoot,
    storeDir: location.storeDir,
    storeName: derived.storeName,
    remote: selected.name,
    remoteUrl: selected.url,
    head: direct.head,
  };
}


/**
 * Prepare the Backlog task-history workspace inside one exact target linked
 * Episode code worktree: an independent nested ordinary-Git clone of the
 * published task-history branch at the canonical store location, derived from
 * the prepared primary checkout's selected remote and transport URL.
 */
export function prepareEpisodeTaskHistoryWorkspace(input: EpisodeTaskHistoryWorkspaceInput): EpisodeTaskHistoryWorkspace {
  const runner = input.runner ?? new ProcessCommandRunner();
  const identity = verifyLinkedWorktree(input.primaryRoot, input.targetWorktree, runner);
  if (identity) return identity;

  // Derive remote, URL, published head, and — critically — the exact built-in
  // store name from the prepared primary result. Never assume `.backlog`.
  const prepared = prepareTaskHistoryWorkspace({ primaryRoot: input.primaryRoot, runner });
  if (prepared.status === "blocked") {
    return {
      status: "blocked", code: prepared.code,
      detail: `the primary checkout is not a valid prepared task-history workspace: ${prepared.detail}`,
      remediation: prepared.remediation,
    };
  }
  const { remote, remoteUrl, head } = prepared;
  const derived = deriveTargetStore(input.primaryRoot, input.targetWorktree, prepared.storeDir);
  if ("blocked" in derived) return derived.blocked;
  const { storeDir } = derived;

  // Containment/ignore and target-native authority are preflighted before the
  // nested clone write. Existing evidence may select this exact store; no
  // evidence is valid for a fresh store; another provider/store always blocks.
  const storeEntry = lstatIfPresent(storeDir);
  if (storeEntry?.isSymbolicLink()) {
    return {
      status: "blocked", code: "unsafe-store-location",
      detail: `the derived target store ${storeDir} is a symlink (including a dangling symlink); preparation never follows or overwrites it`,
      remediation: "inspect and remove the foreign symlink before preparing the exact nested store",
    };
  }
  const containment = validateContainment(input.targetWorktree, storeDir);
  if (containment) return { status: "blocked", code: containment.code, detail: containment.detail, remediation: containment.remediation };
  const targetAuthorityBefore = verifyTargetBacklogAuthority(input.targetWorktree, storeDir, runner, storeEntry === null);
  if (targetAuthorityBefore) return targetAuthorityBefore;
  const storeRel = relative(input.targetWorktree, storeDir).split(sep).join("/");
  const ignore = runGit(runner, input.targetWorktree, ["check-ignore", "-q", "--", `${storeRel}/x`]);
  if (ignore.status !== 0) {
    return {
      status: "blocked", code: "not-ignored",
      detail: `the target worktree task-store path ${storeDir} is not ignored by the target code worktree (git check-ignore exit ${ignore.status}); preparation refuses to create it`,
      remediation: `the Episode worktree must already ignore /${storeRel}/; do not edit the target code worktree to establish ignore — repair the repository's ignore rules and re-run`,
    };
  }

  if (storeEntry === null) {
    // Preserve the selected remote's identity, not merely its transport URL.
    const clone = runner.run(
      "git",
      ["clone", "--quiet", "--origin", remote, "--branch", TASK_HISTORY_BRANCH, "--", remoteUrl, storeDir],
      { cwd: input.targetWorktree, allowFailure: true },
    );
    if (clone.status !== 0) {
      return {
        status: "blocked", code: "remote-unavailable",
        detail: `cloning ${remote}/${TASK_HISTORY_BRANCH} from ${remoteUrl} into ${storeDir} failed: ${clone.stderr.trim() || clone.stdout.trim() || `exit ${clone.status}`}`,
        remediation: `the selected remote ${remote} must be reachable and publish ${TASK_HISTORY_REF}; prepare the primary workspace first`,
      };
    }
  }

  // Fresh and reused stores must both prove exact independent-clone identity.
  const cloneIdentity = verifyIndependentTaskClone(storeDir, runner);
  if (cloneIdentity.status === "blocked") return cloneIdentity;

  const remotes = runGit(runner, storeDir, ["remote"]);
  if (remotes.status !== 0) {
    return {
      status: "blocked", code: "unreadable",
      detail: `reading the nested clone's remotes failed: ${remotes.stderr.trim() || remotes.stdout.trim() || `exit ${remotes.status}`}`,
      remediation: "repair or remove the unreadable nested clone and re-run preparation",
    };
  }
  const remoteNames = remotes.stdout.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
  if (remoteNames.length !== 1 || remoteNames[0] !== remote) {
    return {
      status: "blocked", code: "unsafe-store-location",
      detail: `the nested clone's remotes are ${JSON.stringify(remoteNames)}, not exactly the selected remote ${JSON.stringify(remote)}`,
      remediation: `the nested clone must contain only the selected remote ${remote}; remove the foreign clone and re-run preparation`,
    };
  }
  const cloneUrls = runGit(runner, storeDir, ["remote", "get-url", "--all", remote]);
  const urls = cloneUrls.stdout.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
  if (cloneUrls.status !== 0 || urls.length !== 1 || urls[0] !== remoteUrl) {
    return {
      status: "blocked", code: "unsafe-store-location",
      detail: `the nested clone's ${remote} URL proof is ${cloneUrls.status === 0 ? JSON.stringify(urls) : `unreadable (exit ${cloneUrls.status})`}, not exactly ${JSON.stringify(remoteUrl)}`,
      remediation: `the nested clone must track exactly ${remote} at the selected transport URL; remove the foreign clone and re-run preparation`,
    };
  }
  const branchResult = runGit(runner, storeDir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branchResult.status !== 0 || branchResult.stdout.trim() !== TASK_HISTORY_BRANCH) {
    return {
      status: "blocked", code: branchResult.status === 0 ? "unsafe-store-location" : "unreadable",
      detail: `the nested clone branch proof is ${branchResult.status === 0 ? JSON.stringify(branchResult.stdout.trim()) : `unreadable (exit ${branchResult.status})`}; expected ${TASK_HISTORY_BRANCH}`,
      remediation: "remove the drifted/unreadable clone and re-run preparation on the published task-history branch",
    };
  }
  const headResult = runGit(runner, storeDir, ["rev-parse", "--verify", "HEAD"]);
  const cloneHead = headResult.stdout.trim();
  if (headResult.status !== 0 || !/^[0-9a-f]{40}$/.test(cloneHead)) {
    return {
      status: "blocked", code: "unreadable",
      detail: `the nested clone HEAD proof failed: ${headResult.stderr.trim() || headResult.stdout.trim() || `exit ${headResult.status}`}`,
      remediation: "repair or remove the unreadable nested clone and re-run preparation",
    };
  }
  const dirty = runGit(runner, storeDir, ["--no-optional-locks", "status", "--porcelain", "--ignored", "--untracked-files=all"]);
  if (dirty.status !== 0) {
    return {
      status: "blocked", code: "unreadable",
      detail: `the nested clone cleanliness proof failed: ${dirty.stderr.trim() || dirty.stdout.trim() || `exit ${dirty.status}`}`,
      remediation: "repair or remove the unreadable nested clone; a failed status command is never treated as clean",
    };
  }
  if (dirty.stdout.trim() !== "") {
    return {
      status: "blocked", code: "uncommitted-task-content",
      detail: `the nested clone ${storeDir} has uncommitted or unpublished content: ${dirty.stdout.trim().split(/\r?\n/).slice(0, 5).join(", ")}`,
      remediation: "the nested clone must be clean; inspect it and re-run preparation",
    };
  }
  let preparedHead = cloneHead;
  if (cloneHead !== head) {
    const directBefore = readDirectTaskHead(input.primaryRoot, remote, remoteUrl, runner);
    if (directBefore.status === "blocked" || directBefore.head !== head) {
      return {
        status: "blocked", code: directBefore.status === "blocked" ? directBefore.code : "remote-advanced",
        detail: directBefore.status === "blocked" ? directBefore.detail : `the direct task-history head moved from prepared ${head} to ${directBefore.head}`,
        remediation: directBefore.status === "blocked" ? directBefore.remediation : "re-run preparation against one stable remote head; never guess or force",
      };
    }
    const trackingRef = `refs/remotes/${remote}/${TASK_HISTORY_BRANCH}`;
    const fetch = runGit(runner, storeDir, ["fetch", "--no-tags", remote, `${TASK_HISTORY_REF}:${trackingRef}`]);
    if (fetch.status !== 0) {
      return {
        status: "blocked", code: "remote-unavailable",
        detail: `fetching the exact task-history ref into the Episode clone failed: ${fetch.stderr.trim() || fetch.stdout.trim() || `exit ${fetch.status}`}`,
        remediation: "restore remote access or inspect a non-fast-forward tracking-ref refusal; never force",
      };
    }
    const directAfter = readDirectTaskHead(input.primaryRoot, remote, remoteUrl, runner);
    const tracking = runGit(runner, storeDir, ["rev-parse", "--verify", trackingRef]);
    const trackingHead = tracking.stdout.trim();
    if (directAfter.status === "blocked" || directAfter.head !== head
        || tracking.status !== 0 || trackingHead !== head) {
      return {
        status: "blocked", code: "remote-advanced",
        detail: `Episode task-history fetch did not preserve one exact prepared/direct/tracking head (${head}, ${directAfter.status === "found" ? directAfter.head : "unreadable"}, ${trackingHead || "unreadable"})`,
        remediation: "re-run preparation after concurrent publication settles; never force or guess",
      };
    }
    const descendant = runGit(runner, storeDir, ["merge-base", "--is-ancestor", cloneHead, head]);
    if (descendant.status !== 0) {
      const localAhead = runGit(runner, storeDir, ["merge-base", "--is-ancestor", head, cloneHead]);
      return {
        status: "blocked", code: localAhead.status === 0 ? "local-ahead" : "remote-advanced",
        detail: localAhead.status === 0
          ? `the Episode task-history clone ${cloneHead} contains unpublished commits beyond ${head}`
          : `the Episode task-history clone ${cloneHead} diverged from published head ${head}`,
        remediation: "inspect and reconcile the clone through ordinary Git; never overwrite or force",
      };
    }
    const fastForward = runGit(runner, storeDir, ["merge", "--ff-only", trackingRef]);
    const advanced = runGit(runner, storeDir, ["rev-parse", "--verify", "HEAD"]);
    preparedHead = advanced.stdout.trim();
    const cleanAfter = runGit(runner, storeDir, ["--no-optional-locks", "status", "--porcelain", "--ignored", "--untracked-files=all"]);
    if (fastForward.status !== 0 || advanced.status !== 0 || preparedHead !== head
        || cleanAfter.status !== 0 || cleanAfter.stdout.trim() !== "") {
      return {
        status: "blocked", code: "remote-advanced",
        detail: `the clean descendant Episode clone could not be fast-forwarded exactly to ${head}: ${fastForward.stderr.trim() || cleanAfter.stderr.trim() || `HEAD ${preparedHead || "unreadable"}`}`,
        remediation: "inspect the retained clone and re-run preparation; never reset, delete, or force",
      };
    }
  }

  // After materialization/reuse, native provider discovery must resolve to the
  // exact derived store before lifecycle/default/autoCommit reads are trusted.
  const targetAuthorityAfter = verifyTargetBacklogAuthority(input.targetWorktree, storeDir, runner, false);
  if (targetAuthorityAfter) return targetAuthorityAfter;
  try {
    checkBacklogCapabilities(input.targetWorktree, runner);
  } catch (error) {
    return {
      status: "blocked", code: "backlog-cli",
      detail: `the Episode-worktree task store's effective native configuration is not lifecycle-ready: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "the published task-store config must carry the exact ordered canonical lifecycle; this seam never rewrites a published config (remote mutation is deferred)",
    };
  }
  const defaultStatus = runner.run("backlog", ["config", "get", "defaultStatus"], { cwd: input.targetWorktree, allowFailure: true });
  if (defaultStatus.status !== 0 || defaultStatus.stdout.trim() !== "In Design") {
    return {
      status: "blocked", code: "backlog-cli",
      detail: `the Episode-worktree task store's effective native default status is ${JSON.stringify(defaultStatus.stdout.trim())} (exit ${defaultStatus.status}), not exactly "In Design"`,
      remediation: "the published task-store config must set default_status to In Design; this seam never rewrites a published config (remote mutation is deferred)",
    };
  }
  const autoCommit = runner.run("backlog", ["config", "get", "autoCommit"], { cwd: input.targetWorktree, allowFailure: true });
  if (autoCommit.status !== 0 || autoCommit.stdout.trim() !== "false") {
    return {
      status: "blocked", code: "backlog-cli",
      detail: `the Episode-worktree task store's effective native auto_commit is ${JSON.stringify(autoCommit.stdout.trim())} (exit ${autoCommit.status}), not exactly "false"`,
      remediation: "disabling auto-commit in the published task-store config is part of the deferred mutation/cutover; this seam never writes the config locally",
    };
  }

  // Re-prove clean/published after native reads; every Git proof must succeed.
  const finalDirty = runGit(runner, storeDir, ["--no-optional-locks", "status", "--porcelain", "--ignored", "--untracked-files=all"]);
  if (finalDirty.status !== 0) {
    return {
      status: "blocked", code: "unreadable",
      detail: `the final nested clone cleanliness proof failed: ${finalDirty.stderr.trim() || finalDirty.stdout.trim() || `exit ${finalDirty.status}`}`,
      remediation: "repair or remove the unreadable nested clone; a failed status command is never treated as clean",
    };
  }
  if (finalDirty.stdout.trim() !== "") {
    return {
      status: "blocked", code: "uncommitted-task-content",
      detail: `the nested clone ${storeDir} has uncommitted or unpublished content after native reads: ${finalDirty.stdout.trim().split(/\r?\n/).slice(0, 5).join(", ")}`,
      remediation: "the nested clone must be clean; inspect it and re-run preparation",
    };
  }
  const finalHeadResult = runGit(runner, storeDir, ["rev-parse", "--verify", "HEAD"]);
  const finalHead = finalHeadResult.stdout.trim();
  if (finalHeadResult.status !== 0 || !/^[0-9a-f]{40}$/.test(finalHead)) {
    return {
      status: "blocked", code: "unreadable",
      detail: `the final nested clone HEAD proof failed: ${finalHeadResult.stderr.trim() || finalHeadResult.stdout.trim() || `exit ${finalHeadResult.status}`}`,
      remediation: "repair or remove the unreadable nested clone and re-run preparation",
    };
  }
  if (finalHead !== head) {
    return {
      status: "blocked", code: "local-ahead",
      detail: `the nested clone HEAD (${finalHead}) does not equal the published task-history head (${head}); unpublished task content is never returned as prepared`,
      remediation: "publish the nested clone's commits (the deferred mutation loop) or re-run preparation",
    };
  }

  return { status: "prepared", primaryRoot: input.primaryRoot, targetWorktree: input.targetWorktree, storeDir, remote, remoteUrl, branch: TASK_HISTORY_BRANCH, head };
}


// ---------------------------------------------------------------------------
// Slice 2C: one exact native Backlog mutation + ordinary Git publication
//
// This stays provider-specific and deliberately has no lifecycle/ownership
// wiring, normalized task model, receipt, lock, checkpoint, or coordinator.
// ---------------------------------------------------------------------------

type NativeTaskView = { raw: string; id: string; path: string };
type MutationClone = {
  primaryRoot: string;
  targetWorktree: string;
  storeDir: string;
  storeName: string;
  remote: string;
  remoteUrl: string;
};

type MutationBlocked = Extract<EpisodeTaskHistoryMutation, { status: "blocked" }>;

function mutationBlocked(
  taskId: string,
  code: MutationBlocked["code"],
  detail: string,
  remediation: string,
  evidence: Omit<Partial<MutationBlocked>, "status" | "code" | "detail" | "remediation" | "taskId"> = {},
): MutationBlocked {
  return { status: "blocked", code, detail, remediation, taskId, ...evidence };
}

function strictCleanStatus(storeDir: string, runner: CommandRunner) {
  return runGit(runner, storeDir, ["--no-optional-locks", "status", "--porcelain", "--ignored", "--untracked-files=all"]);
}

function readNativeTask(
  cwd: string,
  taskId: string,
  runner: CommandRunner,
): NativeTaskView | { error: string } {
  const result = runner.run("backlog", ["task", "view", "--json", "--", taskId], { cwd, allowFailure: true });
  if (result.status !== 0) {
    return { error: result.stderr.trim() || result.stdout.trim() || `backlog task view exited ${result.status}` };
  }
  try {
    const parsed = JSON.parse(result.stdout) as { task?: { id?: unknown; path?: unknown } };
    if (typeof parsed.task?.id !== "string" || typeof parsed.task?.path !== "string" || parsed.task.path.trim() === "") {
      return { error: `native task view returned no exact string id/path: ${result.stdout.trim()}` };
    }
    return { raw: result.stdout, id: parsed.task.id, path: parsed.task.path };
  } catch (error) {
    return { error: `native task view was not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function storeRelativeTaskPath(
  targetWorktree: string,
  storeDir: string,
  nativePath: string,
): string | null {
  const absolute = resolve(targetWorktree, nativePath);
  const rel = relative(realpathSync(storeDir), absolute);
  if (isAbsolute(rel) || rel === "" || rel === ".." || rel.startsWith(`..${sep}`)) return null;
  return rel.split(sep).join("/");
}

type TaskFileIdentity =
  | { status: "verified"; storePath: string }
  | { status: "blocked"; detail: string };

/**
 * Prove one store-relative path is a tracked real regular file. Every path
 * component is lstat'd before realpath, so neither a file symlink nor a parent
 * symlink can make native Backlog escape the exact independent store.
 */
function proveTrackedRegularStorePath(
  storeDir: string,
  storePath: string,
  runner: CommandRunner,
): TaskFileIdentity {
  const normalized = storePath.split("/").join(sep);
  if (storePath === "" || isAbsolute(normalized) || normalized === ".." || normalized.startsWith(`..${sep}`)) {
    return { status: "blocked", detail: `task path ${JSON.stringify(storePath)} is not a contained relative store path` };
  }
  const storeReal = realpathSync(storeDir);
  const pieces = normalized.split(sep);
  let cursor = storeReal;
  for (let index = 0; index < pieces.length; index += 1) {
    const component = join(cursor, pieces[index]);
    let entry: ReturnType<typeof lstatSync>;
    try {
      entry = lstatSync(component);
    } catch (error) {
      return { status: "blocked", detail: `task path component ${component} is unreadable or absent: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (entry.isSymbolicLink()) {
      return { status: "blocked", detail: `task path component ${component} is a symlink` };
    }
    if (index < pieces.length - 1 && !entry.isDirectory()) {
      return { status: "blocked", detail: `task parent component ${component} is not a real directory` };
    }
    if (index === pieces.length - 1 && !entry.isFile()) {
      return { status: "blocked", detail: `task file ${component} is not a real regular file` };
    }
    let componentReal: string;
    try {
      componentReal = realpathSync(component);
    } catch (error) {
      return { status: "blocked", detail: `task path component ${component} has no stable real identity: ${error instanceof Error ? error.message : String(error)}` };
    }
    const realRel = relative(storeReal, componentReal);
    if (isAbsolute(realRel) || realRel === ".." || realRel.startsWith(`..${sep}`)) {
      return { status: "blocked", detail: `task path component ${component} resolves outside the exact store` };
    }
    cursor = component;
  }
  const staged = runGit(runner, storeDir, ["ls-files", "--stage", "-z", "--", storePath]);
  const entries = staged.stdout.split("\0").filter(Boolean);
  const match = entries.length === 1 ? /^(100644|100755) [0-9a-f]+ 0\t(.+)$/s.exec(entries[0]) : null;
  if (staged.status !== 0 || !match || match[2] !== storePath) {
    return { status: "blocked", detail: `task path ${JSON.stringify(storePath)} is not exactly one stage-0 tracked regular file` };
  }
  return { status: "verified", storePath };
}

function proveNativeTaskFileIdentity(
  targetWorktree: string,
  storeDir: string,
  nativePath: string,
  runner: CommandRunner,
): TaskFileIdentity {
  let storePath: string | null;
  try {
    storePath = storeRelativeTaskPath(targetWorktree, storeDir, nativePath);
  } catch (error) {
    return { status: "blocked", detail: `native task path identity is unreadable: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!storePath) {
    return { status: "blocked", detail: `native task path ${JSON.stringify(nativePath)} is not contained in the exact store` };
  }
  return proveTrackedRegularStorePath(storeDir, storePath, runner);
}

/** Refuse every unsafe tracked tasks/ identity before native task discovery. */
function proveTrackedTaskTreeSafety(storeDir: string, runner: CommandRunner): { status: "verified" } | { status: "blocked"; detail: string } {
  const listed = runGit(runner, storeDir, ["ls-files", "--stage", "-z", "--", "tasks"]);
  if (listed.status !== 0) return { status: "blocked", detail: `tracked task-tree proof failed (exit ${listed.status})` };
  for (const raw of listed.stdout.split("\0").filter(Boolean)) {
    const match = /^([0-9]+) [0-9a-f]+ ([0-3])\t(.+)$/s.exec(raw);
    if (!match || match[2] !== "0") return { status: "blocked", detail: "tracked task-tree index identity is malformed or unmerged" };
    const [, mode, , path] = match;
    if (mode !== "100644" && mode !== "100755") {
      return { status: "blocked", detail: `tracked task-tree path ${JSON.stringify(path)} has unsafe symlink/non-regular Git mode ${mode}` };
    }
    const identity = proveTrackedRegularStorePath(storeDir, path, runner);
    if (identity.status === "blocked") return identity;
  }
  return { status: "verified" };
}

/**
 * Inspect the already-prepared nested clone without creating/replacing it.
 * The direct remote ref is read by `inspectPrimaryTaskAuthority`; later sync
 * steps fetch and re-read it before native task reads or writes.
 */
function inspectMutationClone(
  input: EpisodeTaskHistoryMutationInput,
  runner: CommandRunner,
): MutationClone | MutationBlocked {
  let primaryRoot: string;
  let targetWorktree: string;
  try {
    primaryRoot = realpathSync(resolve(input.primaryRoot));
    targetWorktree = realpathSync(resolve(input.targetWorktree));
  } catch (error) {
    return mutationBlocked(input.taskId, "identity-mismatch", `task-history mutation roots are unavailable: ${error instanceof Error ? error.message : String(error)}`, "restore the exact canonical primary or registered Episode worktree before mutation");
  }
  const primaryMutation = primaryRoot === targetWorktree;
  if (!primaryMutation) {
    const identity = verifyLinkedWorktree(primaryRoot, targetWorktree, runner);
    if (identity) return mutationBlocked(input.taskId, "identity-mismatch", identity.detail, identity.remediation);
  }
  const authority = inspectPrimaryTaskAuthority(primaryRoot, runner);
  if (authority.status === "blocked") {
    const code: MutationBlocked["code"] = authority.code === "remote-unavailable"
      ? "remote-unavailable"
      : authority.code === "uncommitted-task-content"
        ? "uncommitted-task-content"
        : authority.code === "local-ahead"
          ? "local-ahead"
          : authority.code === "remote-advanced"
            ? "remote-advanced"
            : authority.code === "unsafe-store-location" || authority.code === "config-not-preserved"
              ? "unsafe-store-location"
              : "identity-mismatch";
    return mutationBlocked(input.taskId, code, authority.detail, authority.remediation);
  }
  const storeDir = primaryMutation ? authority.storeDir : join(targetWorktree, authority.storeName);
  const storeEntry = lstatIfPresent(storeDir);
  if (!storeEntry || storeEntry.isSymbolicLink()) {
    return mutationBlocked(
      input.taskId,
      "unsafe-store-location",
      `the required prepared nested clone ${storeDir} is ${storeEntry ? "a symlink" : "absent"}`,
      "prepare the exact independent Episode task-history clone before attempting a mutation",
      { storeDir, remote: authority.remote },
    );
  }
  const targetAuthority = verifyTargetBacklogAuthority(targetWorktree, storeDir, runner, false);
  if (targetAuthority) {
    return mutationBlocked(input.taskId, "identity-mismatch", targetAuthority.detail, targetAuthority.remediation, { storeDir, remote: authority.remote });
  }
  const cloneIdentity = verifyIndependentTaskClone(storeDir, runner);
  if (cloneIdentity.status === "blocked") {
    return mutationBlocked(input.taskId, "identity-mismatch", cloneIdentity.detail, cloneIdentity.remediation, { storeDir, remote: authority.remote });
  }
  const remotes = runGit(runner, storeDir, ["remote"]);
  const names = remotes.stdout.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
  if (remotes.status !== 0 || names.length !== 1 || names[0] !== authority.remote) {
    return mutationBlocked(
      input.taskId,
      remotes.status === 0 ? "identity-mismatch" : "unreadable",
      `the nested clone remote proof is ${remotes.status === 0 ? JSON.stringify(names) : `unreadable (exit ${remotes.status})`}, not exactly ${JSON.stringify(authority.remote)}`,
      "repair or re-prepare the exact selected-remote clone before mutation",
      { storeDir, remote: authority.remote },
    );
  }
  const urlsResult = runGit(runner, storeDir, ["remote", "get-url", "--all", authority.remote]);
  const urls = urlsResult.stdout.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
  if (urlsResult.status !== 0 || urls.length !== 1 || urls[0] !== authority.remoteUrl) {
    return mutationBlocked(
      input.taskId,
      urlsResult.status === 0 ? "identity-mismatch" : "unreadable",
      `the nested clone URL proof is ${urlsResult.status === 0 ? JSON.stringify(urls) : `unreadable (exit ${urlsResult.status})`}, not exactly ${JSON.stringify(authority.remoteUrl)}`,
      "repair or re-prepare the exact selected-remote clone before mutation",
      { storeDir, remote: authority.remote },
    );
  }
  const branch = runGit(runner, storeDir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch.status !== 0 || branch.stdout.trim() !== TASK_HISTORY_BRANCH) {
    return mutationBlocked(
      input.taskId,
      branch.status === 0 ? "identity-mismatch" : "unreadable",
      `the nested clone branch proof is ${branch.status === 0 ? JSON.stringify(branch.stdout.trim()) : `unreadable (exit ${branch.status})`}, not ${TASK_HISTORY_BRANCH}`,
      "restore the exact prepared task-history branch before mutation",
      { storeDir, remote: authority.remote },
    );
  }
  const ignore = runGit(runner, targetWorktree, ["check-ignore", "-q", "--", `${authority.storeName}/x`]);
  if (ignore.status !== 0) {
    return mutationBlocked(
      input.taskId,
      "identity-mismatch",
      `the prepared nested store ${storeDir} is no longer ignored by the target code worktree (git check-ignore exit ${ignore.status})`,
      "restore the accepted target ignore rule before mutation",
      { storeDir, remote: authority.remote },
    );
  }
  const clean = strictCleanStatus(storeDir, runner);
  if (clean.status !== 0 || clean.stdout.trim() !== "") {
    return mutationBlocked(
      input.taskId,
      clean.status === 0 ? "uncommitted-task-content" : "unreadable",
      clean.status === 0
        ? `the nested clone has unpublished content before mutation: ${clean.stdout.trim().split(/\r?\n/).slice(0, 5).join(", ")}`
        : `the nested clone cleanliness proof failed: ${clean.stderr.trim() || clean.stdout.trim() || `exit ${clean.status}`}`,
      "preserve and inspect the existing content; mutation starts only from an exact clean published clone",
      { storeDir, remote: authority.remote },
    );
  }
  return {
    primaryRoot: primaryRoot,
    targetWorktree: targetWorktree,
    storeDir,
    storeName: authority.storeName,
    remote: authority.remote,
    remoteUrl: authority.remoteUrl,
  };
}

export interface PublishedPrimaryTaskHistoryInspectionInput {
  primaryRoot: string;
  taskId: string;
  expectedRevision?: string;
  runner?: CommandRunner;
}

export type PublishedPrimaryTaskHistoryInspection =
  | { status: "ready"; storeDir: string; head: string }
  | MutationBlocked;

/**
 * Read-only proof that the primary independent Backlog clone is clean and its
 * exact HEAD equals one stable direct remote task-history head. Cleanup uses
 * this instead of fetching, repairing, or trusting a working native view.
 */
export function inspectPublishedPrimaryTaskHistory(
  input: PublishedPrimaryTaskHistoryInspectionInput,
): PublishedPrimaryTaskHistoryInspection {
  const runner = input.runner ?? new ProcessCommandRunner();
  const clone = inspectMutationClone({
    primaryRoot: input.primaryRoot,
    targetWorktree: input.primaryRoot,
    taskId: input.taskId,
    edits: [],
    runner,
  }, runner);
  if ("status" in clone) return clone;
  const before = readDirectTaskHead(clone.primaryRoot, clone.remote, clone.remoteUrl, runner);
  if (before.status === "blocked") {
    return mutationBlocked(input.taskId, before.code === "remote-unavailable" ? "remote-unavailable" : "unreadable", before.detail, before.remediation, { storeDir: clone.storeDir, remote: clone.remote });
  }
  const headResult = runGit(runner, clone.storeDir, ["rev-parse", "--verify", "HEAD"]);
  const head = headResult.stdout.trim();
  if (headResult.status !== 0 || !/^[0-9a-f]{40}$/.test(head) || head !== before.head) {
    return mutationBlocked(
      input.taskId,
      headResult.status === 0 ? "local-ahead" : "unreadable",
      `the clean primary task-history clone HEAD ${head || "unreadable"} does not equal direct published head ${before.head}`,
      "synchronize the primary clone through the ordinary preparation path before cleanup; cleanup never fetches, publishes, or repairs",
      { storeDir: clone.storeDir, remote: clone.remote, localHead: head || undefined, remoteHead: before.head },
    );
  }
  if (input.expectedRevision !== undefined
      && (!/^[0-9a-f]{40}$/.test(input.expectedRevision)
        || !isAncestor(runner, clone.storeDir, input.expectedRevision, head))) {
    return mutationBlocked(
      input.taskId,
      "identity-mismatch",
      `the directly published primary head ${head} is not proved to descend from owned revision ${input.expectedRevision}`,
      "inspect the task-history rewrite against ownership and recover through reviewed ordinary Git; never force cleanup",
      { storeDir: clone.storeDir, remote: clone.remote, localHead: head, remoteHead: before.head },
    );
  }
  const after = readDirectTaskHead(clone.primaryRoot, clone.remote, clone.remoteUrl, runner);
  if (after.status === "blocked" || after.head !== head) {
    return mutationBlocked(
      input.taskId,
      after.status === "blocked" && after.code === "remote-unavailable" ? "remote-unavailable" : "remote-advanced",
      after.status === "blocked" ? after.detail : `the direct task-history head moved from ${head} to ${after.head} during cleanup proof`,
      "retry after publication settles; cleanup never trusts a raced or stale task view",
      { storeDir: clone.storeDir, remote: clone.remote, localHead: head, remoteHead: after.status === "found" ? after.head : undefined },
    );
  }
  return { status: "ready", storeDir: clone.storeDir, head };
}

type FetchedHead = { status: "fetched"; head: string; trackingRef: string } | MutationBlocked;

/** Fresh direct-read + ordinary fetch, stable only when both name one head. */
function fetchDirectMutationHead(
  clone: MutationClone,
  taskId: string,
  runner: CommandRunner,
): FetchedHead {
  const trackingRef = `refs/remotes/${clone.remote}/${TASK_HISTORY_BRANCH}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = readDirectTaskHead(clone.primaryRoot, clone.remote, clone.remoteUrl, runner);
    if (before.status === "blocked") {
      return mutationBlocked(taskId, before.code === "remote-unavailable" ? "remote-unavailable" : "unreadable", before.detail, before.remediation, { storeDir: clone.storeDir, remote: clone.remote });
    }
    const fetch = runGit(runner, clone.storeDir, ["fetch", "--no-tags", clone.remote, `${TASK_HISTORY_REF}:${trackingRef}`]);
    if (fetch.status !== 0) {
      return mutationBlocked(
        taskId,
        "remote-unavailable",
        `fetching the exact task-history ref from ${clone.remote} failed: ${fetch.stderr.trim() || fetch.stdout.trim() || `exit ${fetch.status}`}`,
        "restore remote access or inspect a non-fast-forward tracking-ref refusal; existing local work is retained",
        { storeDir: clone.storeDir, remote: clone.remote, remoteHead: before.head },
      );
    }
    const after = readDirectTaskHead(clone.primaryRoot, clone.remote, clone.remoteUrl, runner);
    if (after.status === "blocked") {
      return mutationBlocked(taskId, after.code === "remote-unavailable" ? "remote-unavailable" : "unreadable", after.detail, after.remediation, { storeDir: clone.storeDir, remote: clone.remote });
    }
    const tracking = runGit(runner, clone.storeDir, ["rev-parse", "--verify", trackingRef]);
    const trackingHead = tracking.stdout.trim();
    if (tracking.status !== 0 || !/^[0-9a-f]{40}$/.test(trackingHead)) {
      return mutationBlocked(
        taskId,
        "unreadable",
        `the fetched tracking-head proof failed: ${tracking.stderr.trim() || tracking.stdout.trim() || `exit ${tracking.status}`}`,
        "repair the nested repository; no native mutation was attempted",
        { storeDir: clone.storeDir, remote: clone.remote },
      );
    }
    if (before.head === after.head && trackingHead === after.head) return { status: "fetched", head: after.head, trackingRef };
  }
  return mutationBlocked(
    taskId,
    "remote-advanced",
    `the direct ${TASK_HISTORY_REF} head kept changing while it was read and fetched`,
    "retry after concurrent task-history publishers quiesce; no native mutation was attempted",
    { storeDir: clone.storeDir, remote: clone.remote },
  );
}

/** Fast-forward one clean stale clone to the freshly fetched direct head. */
function synchronizeCleanMutationClone(
  clone: MutationClone,
  taskId: string,
  runner: CommandRunner,
): { status: "synchronized"; head: string } | MutationBlocked {
  const clean = strictCleanStatus(clone.storeDir, runner);
  if (clean.status !== 0 || clean.stdout.trim() !== "") {
    return mutationBlocked(
      taskId,
      clean.status === 0 ? "uncommitted-task-content" : "unreadable",
      clean.status === 0
        ? `the nested clone has unpublished content before remote synchronization: ${clean.stdout.trim().split(/\r?\n/).slice(0, 5).join(", ")}`
        : `the nested clone cleanliness proof failed before synchronization: ${clean.stderr.trim() || clean.stdout.trim() || `exit ${clean.status}`}`,
      "preserve and inspect the existing content; synchronization never overwrites it",
      { storeDir: clone.storeDir, remote: clone.remote },
    );
  }
  const fetched = fetchDirectMutationHead(clone, taskId, runner);
  if (fetched.status === "blocked") return fetched;
  const localResult = runGit(runner, clone.storeDir, ["rev-parse", "--verify", "HEAD"]);
  const localHead = localResult.stdout.trim();
  if (localResult.status !== 0 || !/^[0-9a-f]{40}$/.test(localHead)) {
    return mutationBlocked(taskId, "unreadable", "the nested clone HEAD could not be proved before synchronization", "repair the nested clone before mutation", { storeDir: clone.storeDir, remote: clone.remote });
  }
  if (localHead !== fetched.head) {
    if (!isAncestor(runner, clone.storeDir, localHead, fetched.head)) {
      return mutationBlocked(
        taskId,
        isAncestor(runner, clone.storeDir, fetched.head, localHead) ? "local-ahead" : "remote-advanced",
        `the nested clone HEAD ${localHead} cannot be cleanly fast-forwarded to direct remote head ${fetched.head}`,
        "publish/reconcile the retained local history through managed review; this seam never resets or overwrites it",
        { storeDir: clone.storeDir, remote: clone.remote, localHead, remoteHead: fetched.head },
      );
    }
    const ff = runGit(runner, clone.storeDir, ["merge", "--ff-only", fetched.trackingRef]);
    if (ff.status !== 0) {
      return mutationBlocked(
        taskId,
        "reconcile-failed",
        `ordinary fast-forward to direct remote head ${fetched.head} failed: ${ff.stderr.trim() || ff.stdout.trim() || `exit ${ff.status}`}`,
        "inspect the retained nested clone and retry only after its clean fast-forward state is understood",
        { storeDir: clone.storeDir, remote: clone.remote, localHead, remoteHead: fetched.head },
      );
    }
  }
  const finalHead = runGit(runner, clone.storeDir, ["rev-parse", "--verify", "HEAD"]);
  const finalClean = strictCleanStatus(clone.storeDir, runner);
  if (finalHead.status !== 0 || finalHead.stdout.trim() !== fetched.head || finalClean.status !== 0 || finalClean.stdout.trim() !== "") {
    return mutationBlocked(
      taskId,
      "reconcile-failed",
      `post-fast-forward proof failed (HEAD ${JSON.stringify(finalHead.stdout.trim())}, direct ${fetched.head}, clean exit ${finalClean.status}, status ${JSON.stringify(finalClean.stdout.trim())})`,
      "inspect the retained clone; native mutation was not started from an unproved state",
      { storeDir: clone.storeDir, remote: clone.remote, localHead: finalHead.stdout.trim() || localHead, remoteHead: fetched.head },
    );
  }
  return { status: "synchronized", head: fetched.head };
}

/** Exact ordinary-Git path evidence for one remote advance. */
type RemoteAdvanceChange = { status: string; path: string };

function remoteAdvancePaths(
  storeDir: string,
  fromHead: string,
  toHead: string,
  runner: CommandRunner,
): { changes: RemoteAdvanceChange[]; onlyAddedOrModified: boolean } | { error: string } {
  const changed = runGit(runner, storeDir, ["diff", "--name-status", "-z", "--no-renames", fromHead, toHead]);
  if (changed.status !== 0) {
    return { error: changed.stderr.trim() || `git diff status/path proof exited ${changed.status}` };
  }
  const fields = changed.stdout.split("\0");
  if (fields.at(-1) === "") fields.pop();
  if (fields.length % 2 !== 0) return { error: "git diff returned malformed status/path evidence" };
  const changes: RemoteAdvanceChange[] = [];
  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index];
    const path = fields[index + 1];
    if (!status || !path) return { error: "git diff returned an empty status or path" };
    changes.push({ status, path });
  }
  return {
    changes,
    onlyAddedOrModified: changes.length > 0 && changes.every(({ status }) => status === "A" || status === "M"),
  };
}

type SafeNativeTaskIndex = {
  target: NativeTaskView;
  byStorePath: Map<string, NativeTaskView>;
};

type SafeNativeTaskIndexResult =
  | { status: "verified"; index: SafeNativeTaskIndex }
  | { status: "blocked"; detail: string };

/** Read an exact-head native task index only after the entire tracked task tree is safe. */
function readSafeNativeTaskIndex(
  projectRoot: string,
  evidenceStore: string,
  taskId: string,
  taskPath: string,
  runner: CommandRunner,
): SafeNativeTaskIndexResult {
  const treeSafety = proveTrackedTaskTreeSafety(evidenceStore, runner);
  if (treeSafety.status === "blocked") {
    return { status: "blocked", detail: `tracked task tree is unsafe: ${treeSafety.detail}` };
  }

  const target = readNativeTask(projectRoot, taskId, runner);
  if ("error" in target) return { status: "blocked", detail: `exact native target ${taskId} could not be read` };
  if (target.id !== taskId || target.path !== taskPath) {
    return { status: "blocked", detail: `native target identity is ${target.id} at ${target.path}, not ${taskId} at ${taskPath}` };
  }
  const targetIdentity = proveNativeTaskFileIdentity(projectRoot, evidenceStore, target.path, runner);
  if (targetIdentity.status === "blocked") {
    return { status: "blocked", detail: `native target path is unsafe: ${targetIdentity.detail}` };
  }

  const listed = runner.run("backlog", ["task", "list", "--json"], { cwd: projectRoot, allowFailure: true });
  if (listed.status !== 0) return { status: "blocked", detail: "native task listing failed" };
  let taskIds: string[];
  try {
    const parsed = JSON.parse(listed.stdout) as { tasks?: Array<{ id?: unknown }> };
    if (!Array.isArray(parsed.tasks) || parsed.tasks.some((task) => typeof task?.id !== "string" || task.id.trim() === "")) {
      return { status: "blocked", detail: "native task listing returned malformed task identities" };
    }
    taskIds = parsed.tasks.map((task) => task.id as string);
  } catch {
    return { status: "blocked", detail: "native task listing was not valid JSON" };
  }
  if (new Set(taskIds).size !== taskIds.length) {
    return { status: "blocked", detail: "native task listing returned duplicate canonical IDs" };
  }

  const byStorePath = new Map<string, NativeTaskView>();
  for (const candidateId of taskIds) {
    const view = readNativeTask(projectRoot, candidateId, runner);
    if ("error" in view || view.id !== candidateId) {
      return { status: "blocked", detail: `native task ${candidateId} could not be resolved exactly` };
    }
    const identity = proveNativeTaskFileIdentity(projectRoot, evidenceStore, view.path, runner);
    if (identity.status === "blocked") {
      return { status: "blocked", detail: `native task ${candidateId} path is unsafe: ${identity.detail}` };
    }
    if (byStorePath.has(identity.storePath)) {
      return { status: "blocked", detail: `multiple canonical tasks resolve to ${JSON.stringify(identity.storePath)}` };
    }
    byStorePath.set(identity.storePath, view);
  }
  const indexedTarget = byStorePath.get(targetIdentity.storePath);
  if (!indexedTarget || indexedTarget.id !== taskId || indexedTarget.path !== taskPath) {
    return { status: "blocked", detail: "native target is absent or ambiguous in the exact task index" };
  }
  return { status: "verified", index: { target, byStorePath } };
}

type RemoteAdvanceNativeProof =
  | { status: "verified"; evidence: string }
  | { status: "blocked"; detail: string; evidence: string };

/**
 * Prove each A/M remote path against safe native task identities at both exact
 * heads. Modified paths must retain one canonical ID/path; added paths must be
 * absent before and resolve to one different-task identity after.
 */
function proveNativeRemoteAdvance(
  clone: MutationClone,
  priorHead: string,
  newHead: string,
  taskId: string,
  taskPath: string,
  changes: RemoteAdvanceChange[],
  runner: CommandRunner,
): RemoteAdvanceNativeProof {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-task-view-")));
  const projectRoot = join(temp, "project");
  const evidenceStore = join(projectRoot, clone.storeName);
  const safeEvidence: {
    priorHead: string;
    newHead: string;
    target?: { prior: string; next: string };
    changes: Array<{ status: string; path: string; prior: string | null; next: string }>;
  } = { priorHead, newHead, changes: [] };
  const evidence = () => [
    `priorHead: ${safeEvidence.priorHead}`,
    `newHead: ${safeEvidence.newHead}`,
    safeEvidence.target ? `prior target:
${safeEvidence.target.prior}
new target:
${safeEvidence.target.next}` : "",
    ...safeEvidence.changes.map((change) => [
      `${change.status} ${change.path}`,
      change.prior === null ? "prior: absent" : `prior:
${change.prior}`,
      `new:
${change.next}`,
    ].join("\n")),
  ].filter(Boolean).join("\n");
  try {
    mkdirSync(projectRoot);
    const copied = runner.run("git", ["clone", "--quiet", "--origin", clone.remote, "--branch", TASK_HISTORY_BRANCH, "--", clone.remoteUrl, evidenceStore], { allowFailure: true });
    if (copied.status !== 0) return { status: "blocked", detail: "the exact remote evidence clone could not be created", evidence: evidence() };

    const priorCheckout = runGit(runner, evidenceStore, ["checkout", "--quiet", "--detach", priorHead]);
    if (priorCheckout.status !== 0) {
      return { status: "blocked", detail: `prior remote head ${priorHead} could not be checked out for native evidence`, evidence: evidence() };
    }
    const prior = readSafeNativeTaskIndex(projectRoot, evidenceStore, taskId, taskPath, runner);
    if (prior.status === "blocked") {
      return { status: "blocked", detail: `prior remote native identity is unsafe or ambiguous: ${prior.detail}`, evidence: evidence() };
    }

    const newCheckout = runGit(runner, evidenceStore, ["checkout", "--quiet", "--detach", newHead]);
    if (newCheckout.status !== 0) {
      return { status: "blocked", detail: `new remote head ${newHead} could not be checked out for native evidence`, evidence: evidence() };
    }
    const next = readSafeNativeTaskIndex(projectRoot, evidenceStore, taskId, taskPath, runner);
    if (next.status === "blocked") {
      return { status: "blocked", detail: `new remote native identity is unsafe or ambiguous: ${next.detail}`, evidence: evidence() };
    }
    safeEvidence.target = { prior: prior.index.target.raw, next: next.index.target.raw };

    for (const change of changes) {
      if (change.status !== "A" && change.status !== "M") {
        return { status: "blocked", detail: `remote path ${JSON.stringify(change.path)} has disallowed Git status ${change.status}`, evidence: evidence() };
      }
      const priorView = prior.index.byStorePath.get(change.path);
      const nextView = next.index.byStorePath.get(change.path);
      if (change.status === "A") {
        const priorTree = runGit(runner, evidenceStore, ["ls-tree", "-z", "--full-tree", priorHead, "--", change.path]);
        if (priorTree.status !== 0 || priorTree.stdout !== "" || priorView) {
          return { status: "blocked", detail: `added remote path ${JSON.stringify(change.path)} is not proved absent at prior head ${priorHead}`, evidence: evidence() };
        }
        if (!nextView) {
          return { status: "blocked", detail: `added remote path ${JSON.stringify(change.path)} does not resolve to exactly one safe native task at new head ${newHead}`, evidence: evidence() };
        }
        safeEvidence.changes.push({ status: change.status, path: change.path, prior: null, next: nextView.raw });
        if (nextView.id === taskId || nextView.path === taskPath) {
          return { status: "blocked", detail: `added remote path ${JSON.stringify(change.path)} resolves to owner task ${taskId}`, evidence: evidence() };
        }
        continue;
      }

      if (!priorView || !nextView) {
        return { status: "blocked", detail: `modified remote path ${JSON.stringify(change.path)} does not resolve safely and natively at both exact heads`, evidence: evidence() };
      }
      safeEvidence.changes.push({ status: change.status, path: change.path, prior: priorView.raw, next: nextView.raw });
      if (priorView.id !== nextView.id || priorView.path !== nextView.path) {
        return { status: "blocked", detail: `modified remote path ${JSON.stringify(change.path)} changed canonical identity from ${priorView.id} at ${priorView.path} to ${nextView.id} at ${nextView.path}`, evidence: evidence() };
      }
      if (nextView.id === taskId || nextView.path === taskPath) {
        return { status: "blocked", detail: `modified remote path ${JSON.stringify(change.path)} resolves to owner task ${taskId}`, evidence: evidence() };
      }
    }
    return { status: "verified", evidence: evidence() };
  } catch (error) {
    return { status: "blocked", detail: `remote native evidence proof failed safely: ${error instanceof Error ? error.message : String(error)}`, evidence: evidence() };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

/** Re-prove every mutable/native invariant after an allowed ordinary merge. */
function reproveMergedMutationState(
  clone: MutationClone,
  taskId: string,
  taskPath: string,
  storeTaskPath: string,
  runner: CommandRunner,
): NativeTaskView | { error: string } {
  const targetAuthority = verifyTargetBacklogAuthority(clone.targetWorktree, clone.storeDir, runner, false);
  if (targetAuthority) return { error: `target authority failed: ${targetAuthority.detail}` };
  const cloneIdentity = verifyIndependentTaskClone(clone.storeDir, runner);
  if (cloneIdentity.status === "blocked") return { error: `independent clone identity failed: ${cloneIdentity.detail}` };
  try {
    checkBacklogCapabilities(clone.targetWorktree, runner);
  } catch (error) {
    return { error: `native capability proof failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  const autoCommit = runner.run("backlog", ["config", "get", "autoCommit"], { cwd: clone.targetWorktree, allowFailure: true });
  if (autoCommit.status !== 0 || autoCommit.stdout.trim() !== "false") {
    return { error: `effective native autoCommit is ${JSON.stringify(autoCommit.stdout.trim())} (exit ${autoCommit.status}), not exactly false` };
  }
  const viewed = readNativeTask(clone.targetWorktree, taskId, runner);
  if ("error" in viewed) return { error: `exact native task read failed: ${viewed.error}` };
  if (viewed.id !== taskId || viewed.path !== taskPath) {
    return { error: `native task identity is ${viewed.id} at ${viewed.path}, not ${taskId} at ${taskPath}` };
  }
  const taskFile = proveNativeTaskFileIdentity(clone.targetWorktree, clone.storeDir, viewed.path, runner);
  if (taskFile.status === "blocked" || taskFile.storePath !== storeTaskPath) {
    return { error: `native task file identity failed: ${taskFile.status === "blocked" ? taskFile.detail : `resolved path changed to ${taskFile.storePath}`}` };
  }
  const clean = strictCleanStatus(clone.storeDir, runner);
  if (clean.status !== 0 || clean.stdout.trim() !== "") {
    return { error: `strict cleanliness failed (exit ${clean.status}, status ${JSON.stringify(clean.stdout.trim())})` };
  }
  return viewed;
}

function changedPaths(storeDir: string, runner: CommandRunner): { paths: string[] } | { error: string } {
  const commands = [
    ["diff", "--name-only", "-z"],
    ["diff", "--cached", "--name-only", "-z"],
    ["ls-files", "--others", "--exclude-standard", "-z"],
    ["ls-files", "--others", "--ignored", "--exclude-standard", "-z"],
  ];
  const paths = new Set<string>();
  for (const args of commands) {
    const result = runGit(runner, storeDir, args);
    if (result.status !== 0) return { error: result.stderr.trim() || result.stdout.trim() || `git ${args[0]} exited ${result.status}` };
    for (const path of result.stdout.split("\0").filter(Boolean)) paths.add(path);
  }
  return { paths: [...paths].sort() };
}

/**
 * Publish one exact task edit through native Backlog and ordinary Git only.
 * Remote races are retried only when complete Git paths and native exact-head
 * views prove every remote change is a valid different-task file.
 */
function meaningfulNativeImplementationPlan(plan: unknown): boolean {
  if (typeof plan !== "string" || !plan.trim()) return false;
  const lines = plan.split(/\r?\n/).map((line) => line.trim()
    .replace(/^>\s*/, "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^\[[ xX]\]\s*/, "")
    .trim()).filter((line) => line !== "" && !/^```/.test(line));
  const framing = /^(?:implementation\s+plan|plan)[:.]?$/i;
  const placeholder = /^(?:todo|tbd|placeholder|none|n\/?a|to be determined|coming soon|insert (?:the )?(?:implementation )?plan(?: here)?)[:.!]?$/i;
  const placeholderInstruction = /^(?:todo|tbd)\s*[:\-]\s*(?:write|add|insert|complete|describe|provide|draft)\s+(?:the\s+|an?\s+)?(?:implementation\s+)?plan(?:\s+here)?[.!]?$/i;
  return lines.some((line) => !framing.test(line) && !placeholder.test(line) && !placeholderInstruction.test(line));
}

export function publishTaskHistoryMutation(input: EpisodeTaskHistoryMutationInput): EpisodeTaskHistoryMutation {
  const runner = input.runner ?? new ProcessCommandRunner();
  const validEdits = input.edits.length > 0 && input.edits.every(({ option }) => /^--?[A-Za-z][A-Za-z-]*$/.test(option) && option !== "--help" && option !== "-h" && option !== "--plain");
  if (input.taskId.trim() === "" || !validEdits) {
    return mutationBlocked(
      input.taskId,
      "invalid-mutation",
      "the mutation requires one exact non-empty task ID and non-empty native `backlog task edit` option/value pairs without help/plain/positional arguments",
      "pass supported native edit options as `{ option, value? }` pairs; this seam appends `--plain -- <taskId>` itself",
    );
  }

  let clone: MutationClone | MutationBlocked;
  try {
    clone = inspectMutationClone(input, runner);
  } catch (error) {
    return mutationBlocked(input.taskId, "unreadable", `mutation preflight failed: ${error instanceof Error ? error.message : String(error)}`, "repair the exact clone/authority evidence and retry; no native mutation was attempted");
  }
  if ("status" in clone) return clone;

  // A native read is accepted only when a second fresh direct-read/fetch says
  // the same head still governs. A clean pre-read advance is fast-forwarded
  // and the exact task is re-read; moving authority blocks after three rounds.
  let baseHead = "";
  let before: NativeTaskView | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const synchronized = synchronizeCleanMutationClone(clone, input.taskId, runner);
    if (synchronized.status === "blocked") return synchronized;
    try {
      checkBacklogCapabilities(clone.targetWorktree, runner);
    } catch (error) {
      return mutationBlocked(input.taskId, "native-read-failed", `native Backlog capability proof failed: ${error instanceof Error ? error.message : String(error)}`, "repair the published native Backlog configuration; no mutation was attempted", { storeDir: clone.storeDir, remote: clone.remote, baseHead: synchronized.head });
    }
    const autoCommit = runner.run("backlog", ["config", "get", "autoCommit"], { cwd: clone.targetWorktree, allowFailure: true });
    if (autoCommit.status !== 0 || autoCommit.stdout.trim() !== "false") {
      return mutationBlocked(input.taskId, "native-read-failed", `native Backlog autoCommit is ${JSON.stringify(autoCommit.stdout.trim())} (exit ${autoCommit.status}), not exactly false`, "publish auto_commit: false before using this seam; it never disables auto-commit ad hoc", { storeDir: clone.storeDir, remote: clone.remote, baseHead: synchronized.head });
    }
    const safeTaskTree = proveTrackedTaskTreeSafety(clone.storeDir, runner);
    if (safeTaskTree.status === "blocked") {
      return mutationBlocked(input.taskId, "identity-mismatch", `native task discovery is unsafe: ${safeTaskTree.detail}`, "restore tracked task files and all parents as real regular contained identities before any native task read or mutation", { storeDir: clone.storeDir, remote: clone.remote, baseHead: synchronized.head });
    }
    const viewed = readNativeTask(clone.targetWorktree, input.taskId, runner);
    if ("error" in viewed) {
      return mutationBlocked(input.taskId, "native-read-failed", `native resolution of ${input.taskId} failed: ${viewed.error}`, "repair the exact canonical task identity in the published store; no mutation was attempted", { storeDir: clone.storeDir, remote: clone.remote, baseHead: synchronized.head });
    }
    if (viewed.id !== input.taskId) {
      return mutationBlocked(input.taskId, "identity-mismatch", `native resolution returned canonical ID ${JSON.stringify(viewed.id)}, not exact requested ID ${JSON.stringify(input.taskId)}`, "use the exact canonical task ID; no mutation was attempted", { storeDir: clone.storeDir, remote: clone.remote, baseHead: synchronized.head, nativeBefore: viewed.raw });
    }
    const confirmed = synchronizeCleanMutationClone(clone, input.taskId, runner);
    if (confirmed.status === "blocked") return confirmed;
    if (confirmed.head === synchronized.head) {
      baseHead = confirmed.head;
      before = viewed;
      break;
    }
  }
  if (!before) {
    return mutationBlocked(input.taskId, "remote-advanced", `the exact task-history remote advanced during every native pre-mutation read`, "retry after concurrent publishers quiesce; no native mutation was attempted", { storeDir: clone.storeDir, remote: clone.remote });
  }
  if (input.expectedTaskStatus !== undefined || input.requireMeaningfulPlan) {
    let synchronizedTask: Record<string, unknown>;
    try {
      const parsed = JSON.parse(before.raw) as { task?: unknown };
      if (!parsed.task || typeof parsed.task !== "object" || Array.isArray(parsed.task)) throw new Error("missing task object");
      synchronizedTask = parsed.task as Record<string, unknown>;
    } catch (error) {
      return mutationBlocked(input.taskId, "native-read-failed", `synchronized native source-state evidence is malformed: ${error instanceof Error ? error.message : String(error)}`, "repair the exact native task view; no mutation was attempted", { storeDir: clone.storeDir, remote: clone.remote, baseHead, nativeBefore: before.raw });
    }
    if (input.expectedTaskStatus !== undefined && synchronizedTask.status !== input.expectedTaskStatus) {
      return mutationBlocked(input.taskId, "identity-mismatch", `synchronized native task status is ${JSON.stringify(synchronizedTask.status)}, not required ${JSON.stringify(input.expectedTaskStatus)}`, "reconcile the current published task lifecycle state before retrying; no mutation was attempted", { storeDir: clone.storeDir, remote: clone.remote, baseHead, nativeBefore: before.raw });
    }
    if (input.requireMeaningfulPlan && !meaningfulNativeImplementationPlan(synchronizedTask.implementationPlan)) {
      return mutationBlocked(input.taskId, "identity-mismatch", "synchronized native task no longer has a meaningful Implementation Plan", "restore and publish a meaningful plan before retrying; no mutation was attempted", { storeDir: clone.storeDir, remote: clone.remote, baseHead, nativeBefore: before.raw });
    }
  }

  const taskFile = proveNativeTaskFileIdentity(clone.targetWorktree, clone.storeDir, before.path, runner);
  if (taskFile.status === "blocked") {
    return mutationBlocked(
      input.taskId,
      "identity-mismatch",
      `the exact native task file identity is unsafe: ${taskFile.detail}`,
      "restore one tracked real regular non-symlink task file with only real contained parent directories before mutation",
      // Do not return the native view: an unsafe symlink may have caused the
      // provider to read arbitrary external bytes while resolving the path.
      { storeDir: clone.storeDir, remote: clone.remote, baseHead, taskPath: before.path },
    );
  }
  const storeTaskPath = taskFile.storePath;

  const nativeEditArgs = input.edits.flatMap(({ option, value }) => value === undefined ? [option] : [option, value]);
  const mutated = runner.run("backlog", ["task", "edit", ...nativeEditArgs, "--plain", "--", input.taskId], { cwd: clone.targetWorktree, allowFailure: true });
  if (mutated.status !== 0) {
    const localDiff = runGit(runner, clone.storeDir, ["diff", "--no-ext-diff", "--", storeTaskPath]);
    return mutationBlocked(
      input.taskId,
      "native-mutation-failed",
      `native Backlog mutation failed: ${mutated.stderr.trim() || mutated.stdout.trim() || `exit ${mutated.status}`}`,
      "inspect and retain any partial local task change before retrying; this seam never deletes failed mutation evidence",
      { storeDir: clone.storeDir, remote: clone.remote, baseHead, taskPath: before.path, nativeBefore: before.raw, localDiff: localDiff.stdout },
    );
  }
  let after = readNativeTask(clone.targetWorktree, input.taskId, runner);
  if ("error" in after) {
    const localDiff = runGit(runner, clone.storeDir, ["diff", "--no-ext-diff", "--", storeTaskPath]);
    return mutationBlocked(input.taskId, "native-read-failed", `post-mutation native resolution failed: ${after.error}`, "inspect and retain the local task change; do not publish without exact post-mutation identity", { storeDir: clone.storeDir, remote: clone.remote, baseHead, taskPath: before.path, nativeBefore: before.raw, localDiff: localDiff.stdout });
  }
  if (after.id !== input.taskId || after.path !== before.path) {
    const localDiff = runGit(runner, clone.storeDir, ["diff", "--no-ext-diff", "--", storeTaskPath]);
    return mutationBlocked(input.taskId, "identity-mismatch", `post-mutation native identity changed from ${before.id} at ${before.path} to ${after.id} at ${after.path}`, "retain and inspect the local mutation; only the same exact canonical task may be committed", { storeDir: clone.storeDir, remote: clone.remote, baseHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, localDiff: localDiff.stdout });
  }
  const taskFileAfter = proveNativeTaskFileIdentity(clone.targetWorktree, clone.storeDir, after.path, runner);
  if (taskFileAfter.status === "blocked" || taskFileAfter.storePath !== storeTaskPath) {
    const localDiff = runGit(runner, clone.storeDir, ["diff", "--no-ext-diff", "--", storeTaskPath]);
    return mutationBlocked(input.taskId, "identity-mismatch", `post-mutation task file identity is unsafe: ${taskFileAfter.status === "blocked" ? taskFileAfter.detail : `resolved path changed to ${taskFileAfter.storePath}`}`, "retain and inspect the local mutation without exposing an unsafe native view; only the same tracked real contained task file may be committed", { storeDir: clone.storeDir, remote: clone.remote, baseHead, taskPath: before.path, localDiff: localDiff.stdout });
  }

  const changed = changedPaths(clone.storeDir, runner);
  if ("error" in changed) {
    return mutationBlocked(input.taskId, "unreadable", `post-mutation changed-path proof failed: ${changed.error}`, "retain and inspect the local mutation; no commit was attempted", { storeDir: clone.storeDir, remote: clone.remote, baseHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw });
  }
  if (changed.paths.length !== 1 || changed.paths[0] !== storeTaskPath) {
    const allDiff = runGit(runner, clone.storeDir, ["diff", "--no-ext-diff"]);
    return mutationBlocked(input.taskId, "unexpected-task-change", `native mutation changed ${JSON.stringify(changed.paths)}, not exactly ${JSON.stringify(storeTaskPath)}`, "retain and inspect every local change; this seam commits only the exact resolved task file", { storeDir: clone.storeDir, remote: clone.remote, baseHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, localDiff: allDiff.stdout });
  }
  const localDiffBeforeCommit = runGit(runner, clone.storeDir, ["diff", "--no-ext-diff", "--", storeTaskPath]);
  if (localDiffBeforeCommit.status !== 0 || localDiffBeforeCommit.stdout.trim() === "") {
    return mutationBlocked(input.taskId, "unexpected-task-change", "native mutation produced no exact ordinary Git diff for the resolved task file", "retain and inspect the local task state; no empty or unproved change is committed", { storeDir: clone.storeDir, remote: clone.remote, baseHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, localDiff: localDiffBeforeCommit.stdout });
  }

  const add = runGit(runner, clone.storeDir, ["add", "--", storeTaskPath]);
  if (add.status !== 0) {
    return mutationBlocked(input.taskId, "commit-failed", `staging the exact task file failed: ${add.stderr.trim() || add.stdout.trim() || `exit ${add.status}`}`, "retain the local task change and repair Git before retrying", { storeDir: clone.storeDir, remote: clone.remote, baseHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, localDiff: localDiffBeforeCommit.stdout });
  }
  const commit = runGit(runner, clone.storeDir, ["commit", "-m", input.commitMessage ?? `prime-claw: update ${input.taskId}`, "--", storeTaskPath]);
  if (commit.status !== 0) {
    return mutationBlocked(input.taskId, "commit-failed", `ordinary Git commit failed: ${commit.stderr.trim() || commit.stdout.trim() || `exit ${commit.status}`}`, "retain the staged task change and repair Git identity/hooks before retrying", { storeDir: clone.storeDir, remote: clone.remote, baseHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, localDiff: localDiffBeforeCommit.stdout });
  }
  const committedHead = runGit(runner, clone.storeDir, ["rev-parse", "--verify", "HEAD"]);
  let localHead = committedHead.stdout.trim();
  const parent = runGit(runner, clone.storeDir, ["rev-parse", "--verify", "HEAD^"]);
  const committedClean = strictCleanStatus(clone.storeDir, runner);
  if (committedHead.status !== 0 || !/^[0-9a-f]{40}$/.test(localHead) || parent.status !== 0 || parent.stdout.trim() !== baseHead || committedClean.status !== 0 || committedClean.stdout.trim() !== "") {
    return mutationBlocked(input.taskId, "commit-failed", `post-commit proof failed (HEAD ${JSON.stringify(localHead)}, parent ${JSON.stringify(parent.stdout.trim())}, base ${baseHead}, clean ${JSON.stringify(committedClean.stdout.trim())})`, "retain the local commit/worktree and inspect it before any publication retry", { storeDir: clone.storeDir, remote: clone.remote, baseHead, localHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, localDiff: localDiffBeforeCommit.stdout });
  }

  let integratedRemoteHead = baseHead;
  for (let pushAttempt = 0; pushAttempt < 3; pushAttempt += 1) {
    const pushed = runGit(runner, clone.storeDir, ["push", "--porcelain", clone.remote, `HEAD:${TASK_HISTORY_REF}`]);
    if (pushed.status === 0) {
      const direct = readDirectTaskHead(clone.primaryRoot, clone.remote, clone.remoteUrl, runner);
      if (direct.status === "blocked") {
        return mutationBlocked(input.taskId, direct.code === "remote-unavailable" ? "remote-unavailable" : "unreadable", `push returned success but direct publication proof failed: ${direct.detail}`, "do not repush blindly; retain the local commit and verify the direct remote head before retrying", { storeDir: clone.storeDir, remote: clone.remote, baseHead, localHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, localDiff: localDiffBeforeCommit.stdout });
      }
      if (direct.head !== localHead) {
        return mutationBlocked(input.taskId, "remote-advanced", `push returned success but direct remote head ${direct.head} does not equal local published candidate ${localHead}`, "retain the local commit and inspect the exact remote advance; never force-push", { storeDir: clone.storeDir, remote: clone.remote, baseHead, localHead, remoteHead: direct.head, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, localDiff: localDiffBeforeCommit.stdout });
      }
      const diff = runGit(runner, clone.storeDir, ["diff", "--no-ext-diff", baseHead, localHead, "--", storeTaskPath]);
      if (diff.status !== 0) {
        return mutationBlocked(input.taskId, "unreadable", `publication succeeded but exact task diff proof failed: ${diff.stderr.trim() || diff.stdout.trim() || `exit ${diff.status}`}`, "retain the published clone and re-read exact Git evidence before managed reconciliation", { storeDir: clone.storeDir, remote: clone.remote, baseHead, localHead, remoteHead: direct.head, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw });
      }
      return { status: "published", storeDir: clone.storeDir, remote: clone.remote, branch: TASK_HISTORY_BRANCH, baseHead, publishedHead: localHead, taskId: input.taskId, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, diff: diff.stdout };
    }

    const fetched = fetchDirectMutationHead(clone, input.taskId, runner);
    if (fetched.status === "blocked") {
      return mutationBlocked(input.taskId, fetched.code === "remote-unavailable" ? "remote-unavailable" : "push-failed", `non-force push failed and fresh remote evidence is unavailable: ${pushed.stderr.trim() || pushed.stdout.trim() || `exit ${pushed.status}`}; ${fetched.detail}`, "retain the local commit and restore remote evidence before retrying; it was not called published", { storeDir: clone.storeDir, remote: clone.remote, baseHead, localHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, localDiff: localDiffBeforeCommit.stdout });
    }
    const remoteHead = fetched.head;
    if (remoteHead === integratedRemoteHead) {
      return mutationBlocked(input.taskId, "push-failed", `ordinary non-force push failed without a remote-head advance: ${pushed.stderr.trim() || pushed.stdout.trim() || `exit ${pushed.status}`}`, "retain the local commit and repair remote permissions/hooks/connectivity before retrying; never force-push", { storeDir: clone.storeDir, remote: clone.remote, baseHead, localHead, remoteHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, localDiff: localDiffBeforeCommit.stdout });
    }
    const remoteDiff = runGit(runner, clone.storeDir, ["diff", "--no-ext-diff", integratedRemoteHead, remoteHead]);
    const localDiff = runGit(runner, clone.storeDir, ["diff", "--no-ext-diff", integratedRemoteHead, localHead, "--", storeTaskPath]);
    const advancePaths = remoteAdvancePaths(clone.storeDir, integratedRemoteHead, remoteHead, runner);
    const nativeRemote: RemoteAdvanceNativeProof = "error" in advancePaths
      ? { status: "blocked", detail: advancePaths.error, evidence: JSON.stringify({ priorHead: integratedRemoteHead, newHead: remoteHead, changes: [] }) }
      : proveNativeRemoteAdvance(clone, integratedRemoteHead, remoteHead, input.taskId, before.path, advancePaths.changes, runner);
    const nativeRemoteEvidence = nativeRemote.evidence;

    if (!isAncestor(runner, clone.storeDir, integratedRemoteHead, remoteHead)) {
      return mutationBlocked(input.taskId, "ambiguous-remote-advance", `remote head changed from ${integratedRemoteHead} to non-descendant ${remoteHead}`, "retain the local commit and exact divergence evidence for managed judgment; never rewrite remote history", { storeDir: clone.storeDir, remote: clone.remote, baseHead, localHead, remoteHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, nativeRemote: nativeRemoteEvidence, localDiff: localDiff.stdout, remoteDiff: remoteDiff.stdout });
    }
    const taskChange = runGit(runner, clone.storeDir, ["diff", "--quiet", integratedRemoteHead, remoteHead, "--", storeTaskPath]);
    if (taskChange.status === 1) {
      return mutationBlocked(
        input.taskId,
        "same-task-advanced",
        `ordinary push rejected because remote head advanced from ${integratedRemoteHead} to ${remoteHead} and changed exact task path ${before.path}`,
        "retain the local commit plus exact native/Git evidence for later managed judgment; do not classify compatibility or force-push",
        { storeDir: clone.storeDir, remote: clone.remote, baseHead, localHead, remoteHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, nativeRemote: nativeRemoteEvidence, localDiff: localDiff.stdout, remoteDiff: remoteDiff.stdout },
      );
    }
    if (taskChange.status !== 0 || remoteDiff.status !== 0 || localDiff.status !== 0 || "error" in advancePaths || !advancePaths.onlyAddedOrModified || nativeRemote.status === "blocked") {
      const reason = "error" in advancePaths
        ? advancePaths.error
        : !advancePaths.onlyAddedOrModified
          ? "the remote path set includes deletion, rename, type change, or no file change"
          : nativeRemote.status === "blocked"
            ? nativeRemote.detail
            : "ordinary Git diff evidence was unreadable";
      return mutationBlocked(input.taskId, "ambiguous-remote-advance", `the remote advance from ${integratedRemoteHead} to ${remoteHead} is not proven valid other-task-file-only change: ${reason}`, "retain the local commit and exact heads/native views/full Git diff for managed judgment; never auto-reconcile shared config, authority, non-task, malformed, same-task, or ambiguous changes", { storeDir: clone.storeDir, remote: clone.remote, baseHead, localHead, remoteHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, nativeRemote: nativeRemoteEvidence, localDiff: localDiff.stdout, remoteDiff: remoteDiff.stdout });
    }

    const merge = runGit(runner, clone.storeDir, ["merge", "--no-edit", fetched.trackingRef]);
    if (merge.status !== 0) {
      return mutationBlocked(input.taskId, "reconcile-failed", `ordinary merge of proven other-task-file-only remote head ${remoteHead} failed: ${merge.stderr.trim() || merge.stdout.trim() || `exit ${merge.status}`}`, "retain the local commit and any merge evidence/conflict for inspection; do not reset, delete, or force-push", { storeDir: clone.storeDir, remote: clone.remote, baseHead, localHead, remoteHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, nativeRemote: nativeRemoteEvidence, localDiff: localDiff.stdout, remoteDiff: remoteDiff.stdout });
    }
    const mergedHead = runGit(runner, clone.storeDir, ["rev-parse", "--verify", "HEAD"]);
    if (mergedHead.status !== 0 || !/^[0-9a-f]{40}$/.test(mergedHead.stdout.trim())) {
      return mutationBlocked(input.taskId, "reconcile-failed", `post-merge HEAD proof failed after other-task-file-only remote advance: ${mergedHead.stderr.trim() || mergedHead.stdout.trim() || `exit ${mergedHead.status}`}`, "retain the reconciled/local evidence and inspect it before retrying publication", { storeDir: clone.storeDir, remote: clone.remote, baseHead, localHead: mergedHead.stdout.trim() || localHead, remoteHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, nativeRemote: nativeRemoteEvidence, localDiff: localDiff.stdout, remoteDiff: remoteDiff.stdout });
    }
    const reconciledView = reproveMergedMutationState(clone, input.taskId, before.path, storeTaskPath, runner);
    if ("error" in reconciledView) {
      return mutationBlocked(input.taskId, "reconcile-failed", `post-merge authority/capability/cleanliness/task proof failed: ${reconciledView.error}`, "retain the ordinary merged history and exact evidence for inspection; do not publish without re-proving every target invariant", { storeDir: clone.storeDir, remote: clone.remote, baseHead, localHead: mergedHead.stdout.trim(), remoteHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, nativeRemote: nativeRemoteEvidence, localDiff: localDiff.stdout, remoteDiff: remoteDiff.stdout });
    }
    after = reconciledView;
    localHead = mergedHead.stdout.trim();
    integratedRemoteHead = remoteHead;
  }

  return mutationBlocked(input.taskId, "push-failed", "ordinary non-force publication lost three consecutive proven-unrelated races", "retain the reconciled local history and retry after concurrent publishers quiesce; never force-push", { storeDir: clone.storeDir, remote: clone.remote, baseHead, localHead, remoteHead: integratedRemoteHead, taskPath: before.path, nativeBefore: before.raw, nativeAfter: after.raw, localDiff: localDiffBeforeCommit.stdout });
}


/** Backward-compatible Episode-specific name for the shared primary/linked mutation seam. */
export function publishEpisodeTaskHistoryMutation(input: EpisodeTaskHistoryMutationInput): EpisodeTaskHistoryMutation {
  return publishTaskHistoryMutation(input);
}

/**
 * Guarded cleanup of the exact nested task-history clone inside one target
 * linked Episode code worktree. Before removal this freshly proves the direct
 * remote task ref, the exact clone identity/URL/branch, a clean
 * worktree/index, and HEAD equal to the authoritative remote head. It refuses
 * unchanged on any drift, divergence, or foreign identity and never deletes.
 * It removes ONLY the proven nested store directory — never the target code
 * branch/index/tracked files or the primary store. This is the plan's
 * clean/published cleanup guard, not operator-facing lifecycle cleanup.
 */
function inspectEpisodeTaskHistoryStoreInternal(input: EpisodeTaskHistoryWorkspaceInput): EpisodeTaskHistoryInspection {
  const runner = input.runner ?? new ProcessCommandRunner();
  let storeToRemove: string | null = null;
  type CleanupRefusal = Extract<EpisodeTaskHistoryCleanup, { status: "refused" }>;
  const refuse = (blocked: EpisodeAuthorityBlocked): CleanupRefusal => {
    const code: CleanupRefusal["code"] =
      blocked.code === "not-linked-worktree" || blocked.code === "common-repo-mismatch" || blocked.code === "remote-unavailable"
        || blocked.code === "uncommitted-task-content" || blocked.code === "local-ahead" || blocked.code === "remote-advanced"
        || blocked.code === "unreadable" || blocked.code === "unsafe-store-location"
        ? blocked.code
        : "identity-mismatch";
    return { status: "refused", code, detail: blocked.detail, remediation: blocked.remediation };
  };

  try {
    const identity = verifyLinkedWorktree(input.primaryRoot, input.targetWorktree, runner);
    if (identity) return refuse(identity);

    // Pure authority inspection only: no primary preparation, ignore write,
    // clone, fetch, update-ref, or local ref creation is permitted in cleanup.
    const authority = inspectPrimaryTaskAuthority(input.primaryRoot, runner);
    if (authority.status === "blocked") return refuse(authority);
    const storeDir = join(input.targetWorktree, authority.storeName);
    const storeEntry = lstatIfPresent(storeDir);
    if (storeEntry?.isSymbolicLink()) {
      return {
        status: "refused", code: "unsafe-store-location",
        detail: `the derived target store ${storeDir} is a symlink (including a dangling symlink); cleanup never follows or calls it absent`,
        remediation: "inspect the foreign symlink; cleanup removes only a proven real nested clone",
      };
    }
    const containment = validateContainment(input.targetWorktree, storeDir);
    if (containment) return refuse(containment);

    // Conflicting target provider/root evidence is never treated as an absent
    // clean store. When no evidence and no exact store exist, cleanup is an
    // idempotent no-op at the derived path.
    const targetAuthority = verifyTargetBacklogAuthority(input.targetWorktree, storeDir, runner, storeEntry === null);
    if (targetAuthority) return refuse(targetAuthority);
    if (storeEntry === null) {
      if (input.expectedRevision !== undefined
          && (!/^[0-9a-f]{40}$/.test(input.expectedRevision)
            || !isAncestor(runner, authority.storeDir, input.expectedRevision, authority.head))) {
        return {
          status: "refused", code: "identity-mismatch",
          detail: `the directly published task history ${authority.head} is not proved to descend from owned revision ${input.expectedRevision}; absent nested state never bypasses ownership ancestry`,
          remediation: "inspect the task-history rewrite against ownership and recover through reviewed ordinary Git; never force cleanup",
        };
      }
      return { status: "ready", storeDir, present: false };
    }

    const cloneIdentity = verifyIndependentTaskClone(storeDir, runner);
    if (cloneIdentity.status === "blocked") return refuse(cloneIdentity);

    // Exact selected remote NAME and URL. Every Git read is result-checked;
    // failed proofs refuse unchanged and empty stdout is never interpreted.
    const remotes = runGit(runner, storeDir, ["remote"]);
    if (remotes.status !== 0) {
      return {
        status: "refused", code: "unreadable",
        detail: `the nested clone remote-name proof failed: ${remotes.stderr.trim() || remotes.stdout.trim() || `exit ${remotes.status}`}`,
        remediation: "repair the nested repository; cleanup leaves it unchanged until its exact remote identity can be proved",
      };
    }
    const names = remotes.stdout.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
    if (names.length !== 1 || names[0] !== authority.remote) {
      return {
        status: "refused", code: "identity-mismatch",
        detail: `the nested clone remotes ${JSON.stringify(names)} do not equal the one selected primary remote ${JSON.stringify(authority.remote)}`,
        remediation: "cleanup removes only the exact selected-remote clone; leave this foreign/drifted store in place",
      };
    }
    const urlsResult = runGit(runner, storeDir, ["remote", "get-url", "--all", authority.remote]);
    const urls = urlsResult.stdout.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
    if (urlsResult.status !== 0) {
      return {
        status: "refused", code: "unreadable",
        detail: `the nested clone URL proof failed: ${urlsResult.stderr.trim() || urlsResult.stdout.trim() || `exit ${urlsResult.status}`}`,
        remediation: "repair the nested repository; cleanup leaves it unchanged until its exact URL can be proved",
      };
    }
    if (urls.length !== 1 || urls[0] !== authority.remoteUrl) {
      return {
        status: "refused", code: "identity-mismatch",
        detail: `the nested clone ${authority.remote} URLs ${JSON.stringify(urls)} do not equal the selected transport URL ${JSON.stringify(authority.remoteUrl)}`,
        remediation: "cleanup removes only the exact selected-remote clone; leave this foreign/drifted store in place",
      };
    }
    const branch = runGit(runner, storeDir, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (branch.status !== 0) {
      return {
        status: "refused", code: "unreadable",
        detail: `the nested clone branch proof failed: ${branch.stderr.trim() || branch.stdout.trim() || `exit ${branch.status}`}`,
        remediation: "repair the nested repository; cleanup leaves it unchanged until branch identity can be proved",
      };
    }
    if (branch.stdout.trim() !== TASK_HISTORY_BRANCH) {
      return {
        status: "refused", code: "identity-mismatch",
        detail: `the nested clone branch ${JSON.stringify(branch.stdout.trim())} is not ${TASK_HISTORY_BRANCH}`,
        remediation: "cleanup removes only the exact published task-history branch clone; leave this store in place",
      };
    }

    const dirty = runGit(runner, storeDir, ["--no-optional-locks", "status", "--porcelain", "--ignored", "--untracked-files=all"]);
    if (dirty.status !== 0) {
      return {
        status: "refused", code: "unreadable",
        detail: `the nested clone cleanliness proof failed: ${dirty.stderr.trim() || dirty.stdout.trim() || `exit ${dirty.status}`}`,
        remediation: "repair or inspect the nested repository; failed status proof is never clean and cleanup leaves all content unchanged",
      };
    }
    if (dirty.stdout.trim() !== "") {
      return {
        status: "refused", code: "uncommitted-task-content",
        detail: `the nested clone has uncommitted/untracked changes: ${dirty.stdout.trim().split(/\r?\n/).slice(0, 5).join(", ")}; cleanup never deletes unpublished or dirty task content`,
        remediation: "commit and publish the clone's changes (the deferred mutation loop) or inspect them; cleanup leaves the directory unchanged",
      };
    }

    const headResult = runGit(runner, storeDir, ["rev-parse", "--verify", "HEAD"]);
    const cloneHead = headResult.stdout.trim();
    if (headResult.status !== 0 || !/^[0-9a-f]{40}$/.test(cloneHead)) {
      return {
        status: "refused", code: "unreadable",
        detail: `the nested clone HEAD proof failed: ${headResult.stderr.trim() || headResult.stdout.trim() || `exit ${headResult.status}`}`,
        remediation: "repair the nested repository; cleanup leaves it unchanged until its exact HEAD can be proved",
      };
    }
    if (cloneHead !== authority.head) {
      // Classify without fetching/mutating: the clone-created tracking ref
      // records whether local HEAD moved or the direct remote moved.
      const trackingResult = runGit(runner, storeDir, ["rev-parse", "--verify", `refs/remotes/${authority.remote}/${TASK_HISTORY_BRANCH}`]);
      const trackingHead = trackingResult.stdout.trim();
      if (trackingResult.status !== 0 || !/^[0-9a-f]{40}$/.test(trackingHead)) {
        return {
          status: "refused", code: "unreadable",
          detail: `the nested clone tracking-head proof failed while classifying divergence: ${trackingResult.stderr.trim() || trackingResult.stdout.trim() || `exit ${trackingResult.status}`}`,
          remediation: "repair the nested repository; cleanup leaves it unchanged until local and remote heads can be proved",
        };
      }
      if (trackingHead === authority.head) {
        return {
          status: "refused", code: "local-ahead",
          detail: `the clean nested clone HEAD ${cloneHead} is ahead of/drifted from published head ${authority.head}; cleanup never deletes unpublished commits`,
          remediation: "publish or explicitly reconcile the local commits through the deferred mutation loop; cleanup leaves the store unchanged",
        };
      }
      if (trackingHead === cloneHead) {
        return {
          status: "refused", code: "remote-advanced",
          detail: `the selected remote advanced from the clone's recorded head ${cloneHead} to ${authority.head}; cleanup never deletes a stale clone without reconciliation`,
          remediation: "reconcile the clone with the remote through the deferred mutation loop; cleanup leaves the store unchanged",
        };
      }
      return {
        status: "refused", code: "identity-mismatch",
        detail: `the nested clone HEAD ${cloneHead}, recorded tracking head ${trackingHead}, and published head ${authority.head} diverge`,
        remediation: "inspect and reconcile the diverged clone; cleanup leaves the store unchanged",
      };
    }

    if (input.expectedRevision !== undefined) {
      if (!/^[0-9a-f]{40}$/.test(input.expectedRevision)
          || !isAncestor(runner, storeDir, input.expectedRevision, cloneHead)) {
        return {
          status: "refused", code: "identity-mismatch",
          detail: `the published nested history ${cloneHead} is not proved to descend from owned revision ${input.expectedRevision}; cleanup never accepts rewritten task authority`,
          remediation: "inspect the task-history rewrite against ownership and recover through reviewed ordinary Git; never force cleanup",
        };
      }
    }

    // Exit the proof-only region before beginning the first mutation.
    storeToRemove = storeDir;
  } catch (error) {
    return {
      status: "refused", code: "unreadable",
      detail: `cleanup proof failed before removal began: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "repair the unreadable identity/authority evidence and retry; no removal was attempted",
    };
  }

  if (!storeToRemove) {
    return {
      status: "refused", code: "unreadable",
      detail: "cleanup proof completed without an exact proven target store",
      remediation: "retry after inspecting the cleanup authority; no removal was attempted",
    };
  }
  return { status: "ready", storeDir: storeToRemove, present: true };
}

/** Read-only proof that nested task history is absent or safe to remove. */
export function inspectEpisodeTaskHistoryStore(input: EpisodeTaskHistoryWorkspaceInput): EpisodeTaskHistoryInspection {
  return inspectEpisodeTaskHistoryStoreInternal(input);
}

/** Remove only a nested task-history clone that passed the complete read-only proof. */
export function cleanupEpisodeTaskHistoryStore(input: EpisodeTaskHistoryWorkspaceInput): EpisodeTaskHistoryCleanup {
  const inspected = inspectEpisodeTaskHistoryStoreInternal(input);
  if (inspected.status === "refused") return inspected;
  if (!inspected.present) return { status: "cleaned", storeDir: inspected.storeDir };
  try {
    rmSync(inspected.storeDir, { recursive: true, force: true });
    return { status: "cleaned", storeDir: inspected.storeDir };
  } catch (error) {
    return {
      status: "refused", code: "unreadable",
      detail: `final removal of the proven store failed and may be partial: ${error instanceof Error ? error.message : String(error)}`,
      remediation: `inspect ${inspected.storeDir} before retrying; cleanup does not claim unchanged state after removal begins`,
    };
  }
}
