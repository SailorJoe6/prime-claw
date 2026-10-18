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
 * or service. Episode-worktree preparation, the per-task
 * fetch/reconcile/commit/push mutation loop, Beads transport, ownership and
 * receipt fields, and task-data migration are later slices.
 */

import { appendFileSync, existsSync, lstatSync, mkdtempSync, readdirSync, realpathSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  type CommandRunner,
  ProcessCommandRunner,
} from "./project-initialization.ts";
import { checkBacklogCapabilities, detectTaskProvider } from "./task-providers.ts";

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
function initialTaskStoreConfig(projectName: string): string {
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
      return {
        status: "blocked",
        code: "remote-advanced",
        detail: `the remote ${remote}/${TASK_HISTORY_BRANCH} (${remoteHead.slice(0, 12)}) has commits the local task branch does not (${localHead.slice(0, 12)}); refusing to overwrite`,
        remediation: `fetch and fast-forward the local task branch from ${remote} (never force), then re-run preparation`,
      };
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
    writeFileSync(join(temp, "config.yml"), initialTaskStoreConfig(basename(primaryRoot)));
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
      const parts = rel.split(sep);
      if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`) || parts.length !== 1 || !(BUILT_IN_TASK_STORE_DIRS as readonly string[]).includes(parts[0])) {
        return {
          blocked: {
            status: "blocked", code: "unsafe-store-location",
            detail: `the live Backlog store directory ${storeDir} is not a built-in task-store location (.backlog/ or backlog/) directly under the primary checkout`,
            remediation: "normalize the Backlog store to the built-in .backlog/ or backlog/ location (root configuration may still select it) before preparing the workspace",
          },
        };
      }
      dir = parts[0];
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
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`) || rel === "" || rel.includes(sep)) {
    return {
      status: "blocked", code: "unsafe-store-location",
      detail: `the task-store target ${storeDir} is not directly inside the primary root ${primaryRoot}`,
      remediation: "the store location is resolved by the provider seam; report this layout and repair the repository configuration",
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
  if (remoteSelection.status === "blocked") {
    return { status: "blocked", code: remoteSelection.code, detail: remoteSelection.detail, remediation: remoteSelection.remediation };
  }
  const { name: remote, url: remoteUrl } = remoteSelection;

  const { detection, blocked: detectionBlocked } = providerEvidence(primaryRoot);
  if (detectionBlocked) return detectionBlocked;
  if (detection!.kind === "blocked") {
    return { status: "blocked", code: "provider-not-backlog", detail: detection!.detail, remediation: detection!.remediation };
  }
  if (detection!.kind === "selected" && detection!.evidence.provider !== "backlog") {
    return {
      status: "blocked", code: "provider-not-backlog",
      detail: "the selected provider is Beads; the Backlog workspace seam does not prepare a task store for it",
      remediation: "the Beads workspace transport is a later slice; no Backlog clone is prepared",
    };
  }

  // Root-config layouts block BEFORE any ignore/branch/clone/config mutation.
  // Backlog's native config discovery walks UP from the nested store directory
  // and resolves the primary's root backlog.config.yml; any native
  // `backlog config` write from the nested clone would rewrite the PRIMARY
  // root configuration while the published folder config stays unchanged —
  // and mere folder-config existence is not preservation. Moving that
  // authority is the deferred cutover (PRIMECLAW-43.1).
  if (detection!.kind === "selected" && detection!.evidence.provider === "backlog" && detection!.evidence.configSource === "root") {
    return {
      status: "blocked", code: "config-not-preserved",
      detail: `the repository's Backlog authority is the root configuration ${detection!.evidence.configPath}; native config resolution from the nested store would rewrite that root config, so preparation refuses to proceed`,
      remediation: "root-config authority relocation is part of the deferred cutover (PRIMECLAW-43.1); re-run preparation after it lands",
    };
  }

  const location = selectStoreLocation(primaryRoot, detection!);
  if ("blocked" in location) return location.blocked;
  const storeDir = location.storeDir;

  // Containment and symlink safety before ANY branch or store mutation.
  const containment = validateContainment(primaryRoot, storeDir);
  if (containment) return containment;

  if (hasTrackedTaskContent(runner, primaryRoot, storeDir)) {
    return {
      status: "blocked", code: "uncommitted-task-content",
      detail: `${relative(primaryRoot, storeDir)} has files tracked by the code repository; preparing the nested clone would split task authority`,
      remediation: `remove the tracked files from the code branch (\`git -C ${primaryRoot} rm -r --cached ${relative(primaryRoot, storeDir)}\` and commit) so the store is ignored before preparation`,
    };
  }

  // Prove the ignore rule before creating the nested repository, so an
  // ordinary `git add .` can never stage it as a forbidden gitlink.
  const ignoreBlock = ensureIgnored(runner, primaryRoot, storeDir);
  if (ignoreBlock) return ignoreBlock;

  const branchState = ensureTaskHistoryBranch(primaryRoot, remote, remoteUrl, runner);
  if (branchState.status === "blocked") {
    return { status: "blocked", code: branchState.code, detail: branchState.detail, remediation: branchState.remediation };
  }

  const nestedGit = join(storeDir, ".git");
  const storeExists = existsSync(storeDir);

  if (existsSync(nestedGit)) {
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
      return {
        status: "blocked", code: "remote-advanced",
        detail: `the nested clone (${innerHead.slice(0, 12)}) is not at the remote task branch head (${innerRemoteHead.slice(0, 12)})`,
        remediation: "reconcile the nested clone with the remote task branch (fetch/fast-forward only, never force) or remove it and re-run preparation",
      };
    }
    const finalHead = refHead(runner, storeDir, "HEAD");
    if (finalHead !== branchState.head) {
      return {
        status: "blocked", code: "unreadable",
        detail: `the nested clone head ${finalHead ?? "unreadable"} does not match the task-history head ${branchState.head}`,
        remediation: "inspect the nested clone refs and re-run preparation",
      };
    }
  } else if (storeExists && statSync(storeDir).isDirectory() && readdirSync(storeDir).length > 0) {
    // A non-empty store directory without .git is an existing live store. It
    // is never overwritten or discarded, and safe adoption onto the published
    // canonical history is the deferred migration/reconciliation work — so
    // this foundation blocks before any mutation and leaves it untouched.
    return {
      status: "blocked", code: "uncommitted-task-content",
      detail: `${storeDir} has live Backlog content and no .git; adopting it onto the published task-history branch is the deferred task-data migration slice`,
      remediation: "this repo's cutover (adopting the existing store onto the published task-history branch) is PRIMECLAW-43.1; run it before preparing the workspace here",
    };
  } else {
    // Fresh nested clone FROM THE SELECTED REMOTE'S TRANSPORT URL — never
    // from the primary checkout's filesystem path — onto the published task
    // branch, with tracking configured by the clone itself.
    gitOk(runner, primaryRoot, ["clone", "-q", "--origin", remote, "--branch", TASK_HISTORY_BRANCH, remoteUrl, storeDir], "clone the nested task store from the selected remote");
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

  // The folder configuration lives ON the published task-history branch (the
  // bootstrap publishes the exact lifecycle-ready config). The nested clone
  // checks it out tracked; this seam NEVER writes an untracked, unpublished,
  // or non-lifecycle-ready local config.
  const nestedConfigCandidates = [join(storeDir, "config.yml"), join(storeDir, "config.yaml")];
  if (!nestedConfigCandidates.some((path) => existsSync(path))) {
    return {
      status: "blocked", code: "config-not-preserved",
      detail: `the published task-history branch carries no folder configuration in ${storeDir}; establishing one locally would be an untracked, unpublished, non-lifecycle-ready config, which this seam never returns as prepared`,
      remediation: "publish the lifecycle-ready task store config (the deferred cutover PRIMECLAW-43.1 owns existing stores), then re-run preparation",
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
  return {
    status: "prepared",
    remote,
    remoteUrl,
    remoteVia: remoteSelection.via,
    branch: TASK_HISTORY_BRANCH,
    branchState: branchState.status,
    head: branchState.head,
    storeDir,
    configSource,
    autoCommit: false,
  };
}
