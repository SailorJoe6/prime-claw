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
 * `cleanupEpisodeTaskHistoryStore`). The per-task fetch/reconcile/commit/push
 * mutation loop, Beads transport, ownership and receipt fields, and task-data
 * migration remain later slices.
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
      storeName: (typeof BUILT_IN_TASK_STORE_DIRS)[number];
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
): { storeDir: string; storeName: (typeof BUILT_IN_TASK_STORE_DIRS)[number] } | { blocked: EpisodeAuthorityBlocked } {
  const primaryReal = realpathSync(primaryRoot);
  const rel = relative(primaryReal, resolve(primaryStoreDir));
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`) || rel.includes(sep)
      || !(BUILT_IN_TASK_STORE_DIRS as readonly string[]).includes(rel)) {
    return {
      blocked: {
        status: "blocked", code: "unsafe-store-location",
        detail: `the prepared primary store ${primaryStoreDir} is not one exact built-in store directly under ${primaryReal}`,
        remediation: "repair the primary Backlog store so it resolves to exactly .backlog/ or backlog/ before preparing an Episode workspace",
      },
    };
  }
  const storeName = rel as (typeof BUILT_IN_TASK_STORE_DIRS)[number];
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
    return {
      status: "blocked", code: "config-not-preserved",
      detail: `the primary Backlog authority is root configuration ${detection.evidence.configPath}; slice-2A blocks this unpreserved layout`,
      remediation: "root-config authority relocation remains deferred to PRIMECLAW-43.1",
    };
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
  if (cloneHead !== head) {
    return {
      status: "blocked", code: "local-ahead",
      detail: `the nested clone HEAD (${cloneHead}) does not equal the published task-history head (${head}); drift or unpublished task content is never reused as prepared`,
      remediation: "publish the clone's commits (the deferred mutation loop) or remove the clone and re-run preparation",
    };
  }
  const dirty = runGit(runner, storeDir, ["status", "--porcelain"]);
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
      detail: `the nested clone ${storeDir} has uncommitted changes: ${dirty.stdout.trim().split(/\r?\n/).slice(0, 5).join(", ")}`,
      remediation: "the nested clone must be clean; inspect it and re-run preparation",
    };
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
  const finalDirty = runGit(runner, storeDir, ["status", "--porcelain"]);
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
      detail: `the nested clone ${storeDir} has uncommitted changes after native reads: ${finalDirty.stdout.trim().split(/\r?\n/).slice(0, 5).join(", ")}`,
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
export function cleanupEpisodeTaskHistoryStore(input: EpisodeTaskHistoryWorkspaceInput): EpisodeTaskHistoryCleanup {
  const runner = input.runner ?? new ProcessCommandRunner();
  let storeToRemove: string | null = null;
  type CleanupRefusal = Extract<EpisodeTaskHistoryCleanup, { status: "refused" }>;
  const refuse = (blocked: EpisodeAuthorityBlocked): EpisodeTaskHistoryCleanup => {
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
    if (storeEntry === null) return { status: "cleaned", storeDir };

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

    const dirty = runGit(runner, storeDir, ["--no-optional-locks", "status", "--porcelain"]);
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
      detail: "cleanup reached removal without an exact proven target store",
      remediation: "retry after inspecting the cleanup authority; no removal was attempted",
    };
  }
  try {
    rmSync(storeToRemove, { recursive: true, force: true });
    return { status: "cleaned", storeDir: storeToRemove };
  } catch (error) {
    return {
      status: "refused", code: "unreadable",
      detail: `final removal of the proven store failed and may be partial: ${error instanceof Error ? error.message : String(error)}`,
      remediation: `inspect ${storeToRemove} before retrying; cleanup does not claim unchanged state after removal begins`,
    };
  }
}
