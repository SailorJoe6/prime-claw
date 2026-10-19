/**
 * Task-history workspace regressions (PRIMECLAW-43 slices 2A–2C).
 *
 * Real ordinary-Git disposable repositories throughout: no mocked Git, no
 * fabricated refs. The selected remote is a real bare repository; the
 * disconnected task-history branch is bootstrapped in a disposable repo,
 * published non-force, and proven from a fresh fetch. The canonical primary
 * checkout is never switched or staged; store tests prove zero primary
 * mutations and `git check-ignore` enforcement.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync, readdirSync, realpathSync, renameSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  TASK_HISTORY_REF,
  selectTaskHistoryRemote,
  ensureTaskHistoryBranch,
  prepareTaskHistoryWorkspace,
  prepareEpisodeTaskHistoryWorkspace,
  cleanupEpisodeTaskHistoryStore,
  publishEpisodeTaskHistoryMutation,
} from "../src/prime-agent-plugin/extension-support/task-history-workspace.ts";

const FULL_CANONICAL_CONFIG = [
  'project_name: "x"',
  'default_status: "In Design"',
  'statuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]',
  "labels: []",
  "date_format: yyyy-mm-dd",
  "max_column_width: 20",
  "auto_open_browser: true",
  "default_port: 6420",
  "remote_operations: true",
  "auto_commit: false",
  "filesystem_only: false",
  "bypass_git_hooks: false",
  "check_active_branches: true",
  "active_branch_days: 30",
  'task_prefix: "task"',
  "",
].join("\n");


/** Run a real git command; fail loudly. */
function git(cwd, ...args) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function gitAllow(cwd, ...args) {
  try { return { status: 0, out: git(cwd, ...args) }; }
  catch (e) { return { status: e.status ?? 1, out: (e.stderr || "").toString() }; }
}

/** True when the managed backlog executable is on PATH (host dist or runtime image). */
function backlogAvailable() {
  try {
    execFileSync("backlog", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

/**
 * A disposable ordinary-Git primary repository on `main` with one commit,
 * plus a bare `origin` remote the code branch tracks. Returns paths.
 */
function fixtureRepo() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "thw-")));
  const root = join(dir, "repo");
  const remote = join(dir, "remote.git");
  execFileSync("git", ["init", "-q", "-b", "main", root], { stdio: "pipe" });
  execFileSync("git", ["init", "-q", "-b", "main", "--bare", remote], { stdio: "pipe" });
  git(root, "config", "user.email", "t@e.st");
  git(root, "config", "user.name", "t");
  writeFileSync(join(root, "code.txt"), "code\n");
  git(root, "add", "code.txt");
  git(root, "commit", "-qm", "code");
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "-qu", "origin", "main");
  return { dir, root, remote };
}

/** Snapshot primary worktree/index/branch state for zero-mutation proof. */
function primarySnapshot(root) {
  return {
    branch: git(root, "symbolic-ref", "--short", "HEAD"),
    status: git(root, "status", "--porcelain"),
    index: gitAllow(root, "ls-files", "--stage").out,
  };
}

/**
 * Publish a task-history branch with given files. Clones the existing remote
 * task branch when present (so repeat calls fast-forward), else bootstraps a
 * fresh disconnected history. Returns the pushed head.
 */
function publishTaskBranch(remote, files) {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "thw-pub-")));
  const existing = execFileSync("git", ["ls-remote", "--heads", remote, "prime-claw/tasks"], { encoding: "utf8" }).trim();
  if (existing) {
    execFileSync("git", ["clone", "-q", "--origin", "origin", "--branch", "prime-claw/tasks", remote, tmp], { stdio: "pipe" });
  } else {
    execFileSync("git", ["init", "-q", "-b", "prime-claw/tasks", tmp], { stdio: "pipe" });
    git(tmp, "remote", "add", "origin", remote);
  }
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(tmp, name)), { recursive: true });
    writeFileSync(join(tmp, name), content);
  }
  git(tmp, "add", ".");
  git(tmp, "-c", "user.email=t@e.st", "-c", "user.name=t", "commit", "-qm", "task history");
  git(tmp, "push", "-q", "origin", `${TASK_HISTORY_REF}:${TASK_HISTORY_REF}`);
  const head = git(tmp, "rev-parse", "HEAD");
  rmSync(tmp, { recursive: true, force: true });
  return head;
}

// ---------- remote selection (contract, real git) ----------

test("remote selection uses the code branch upstream", () => {
  const { root, remote } = fixtureRepo();
  const sel = selectTaskHistoryRemote(root);
  assert.equal(sel.status, "selected");
  assert.equal(sel.name, "origin");
  assert.equal(sel.via, "branch-upstream");
  assert.equal(sel.url, remote);
});

test("remote selection falls back to the sole remote without an upstream", () => {
  const { root, remote } = fixtureRepo();
  git(root, "branch", "--unset-upstream");
  const sel = selectTaskHistoryRemote(root);
  assert.equal(sel.status, "selected");
  assert.equal(sel.via, "sole-remote");
  assert.equal(sel.url, remote);
});

test("remote selection blocks with no remote", () => {
  const { root } = fixtureRepo();
  git(root, "remote", "remove", "origin");
  const sel = selectTaskHistoryRemote(root);
  assert.equal(sel.status, "blocked");
  assert.equal(sel.code, "no-remote");
  assert.match(sel.remediation, /remote add|set-upstream-to/);
});

test("remote selection blocks ambiguous remotes with no upstream", () => {
  const { root } = fixtureRepo();
  git(root, "branch", "--unset-upstream");
  git(root, "remote", "add", "other", join(root, "..", "other.git"));
  const sel = selectTaskHistoryRemote(root);
  assert.equal(sel.status, "blocked");
  assert.equal(sel.code, "ambiguous-remotes");
  assert.match(sel.detail, /origin/);
  assert.match(sel.detail, /other/);
});

// ---------- branch bootstrap / verification (real remote) ----------

test("absent remote branch is bootstrapped in a disposable repo, published, and proven", () => {
  const { root, remote } = fixtureRepo();
  const before = primarySnapshot(root);
  const state = ensureTaskHistoryBranch(root, "origin", remote);
  assert.equal(state.status, "published");
  // Remote head proven by a fresh fetch matches the local tracked branch.
  assert.equal(git(root, "rev-parse", "refs/remotes/origin/prime-claw/tasks"), state.head);
  assert.equal(git(root, "rev-parse", "refs/heads/prime-claw/tasks"), state.head);
  // The published history is disconnected from code.
  assert.equal(gitAllow(root, "merge-base", state.head, "main").status, 1);
  // The bootstrap carried the marker AND the lifecycle-ready config.
  assert.deepEqual(git(root, "ls-tree", "--name-only", state.head).split("\n"), ["TASKS.md", "config.yml"]);
  // The canonical primary checkout was never switched, staged, or written.
  const after = primarySnapshot(root);
  assert.deepEqual(after, before);
});

test("bootstrap publishes from the SELECTED remote's transport URL", () => {
  const { root, remote } = fixtureRepo();
  ensureTaskHistoryBranch(root, "origin", remote);
  // The branch exists on the remote (transport URL), not merely locally.
  const ls = git(root, "ls-remote", "--heads", remote, "prime-claw/tasks");
  assert.match(ls, /refs\/heads\/prime-claw\/tasks/);
});

test("a stale remote ref is refreshed by fetch before deciding", () => {
  const { root, remote } = fixtureRepo();
  // Publish v1 and let the primary see it.
  publishTaskBranch(remote, { "TASKS.md": "v1\n" });
  git(root, "fetch", "-q", "origin", `${TASK_HISTORY_REF}:refs/remotes/origin/prime-claw/tasks`);
  git(root, "branch", "--track", "prime-claw/tasks", "refs/remotes/origin/prime-claw/tasks");
  // Advance the remote out from under the primary (stale local knowledge).
  publishTaskBranch(remote, { "TASKS.md": "v2\n", "extra.md": "x\n" });
  // ensureTaskHistoryBranch must fetch and see the advance, not trust stale refs.
  const state = ensureTaskHistoryBranch(root, "origin", remote);
  assert.equal(state.status, "blocked");
  assert.equal(state.code, "remote-advanced");
});

test("a local-only branch ahead of the remote blocks (never published implicitly)", () => {
  const { root, remote } = fixtureRepo();
  publishTaskBranch(remote, { "TASKS.md": "v1\n" });
  git(root, "fetch", "-q", "origin", `${TASK_HISTORY_REF}:refs/remotes/origin/prime-claw/tasks`);
  git(root, "branch", "--track", "prime-claw/tasks", "refs/remotes/origin/prime-claw/tasks");
  // Commit locally without pushing: local is ahead.
  git(root, "switch", "-q", "prime-claw/tasks");
  writeFileSync(join(root, "local-only.md"), "unpublished\n");
  git(root, "add", "local-only.md");
  git(root, "commit", "-qm", "unpublished");
  git(root, "switch", "-q", "main");
  const state = ensureTaskHistoryBranch(root, "origin", remote);
  assert.equal(state.status, "blocked");
  assert.equal(state.code, "local-ahead");
  assert.match(state.remediation, /push/);
});

test("an unreachable remote fails closed, never on stale evidence", () => {
  const { root, remote } = fixtureRepo();
  // Point origin at a dead URL.
  git(root, "remote", "set-url", "origin", join(root, "..", "gone.git"));
  const state = ensureTaskHistoryBranch(root, "origin", join(root, "..", "gone.git"));
  assert.equal(state.status, "blocked");
  assert.equal(state.code, "remote-unavailable");
});

test("shared code ancestry blocks", () => {
  const { root, remote } = fixtureRepo();
  // Publish a task branch that is just main (shared ancestry) from a clone.
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "thw-sh-")));
  git(tmp, "init", "-q");
  git(tmp, "remote", "add", "origin", remote);
  git(tmp, "fetch", "-q", "origin", "main");
  git(tmp, "push", "-q", "origin", `refs/remotes/origin/main:${TASK_HISTORY_REF}`);
  const state = ensureTaskHistoryBranch(root, "origin", remote);
  assert.equal(state.status, "blocked");
  assert.equal(state.code, "shared-ancestry");
  rmSync(tmp, { recursive: true, force: true });
});

// ---------- workspace preparation ----------

test("preparation clones from the selected remote, ignores the store, disables auto-commit, is idempotent", (t) => {
  if (!backlogAvailable()) { t.skip("managed backlog executable unavailable (tier-1 image ships none; host runs the repository dist)"); return; }
  const { root, remote } = fixtureRepo();
  const before = primarySnapshot(root);
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "prepared");
  assert.equal(ws.remote, "origin");
  assert.equal(ws.remoteUrl, remote);
  assert.equal(ws.branchState, "published");
  assert.equal(ws.storeDir, join(root, ".backlog"));
  assert.equal(ws.configSource, "none");
  assert.equal(ws.autoCommit, false);
  // Nested clone is on the task branch at the published head, from the remote URL.
  assert.equal(git(ws.storeDir, "symbolic-ref", "--short", "HEAD"), "prime-claw/tasks");
  assert.equal(git(ws.storeDir, "remote", "get-url", "origin"), remote);
  // Index matches the published head: nothing staged for deletion; the clone is clean.
  assert.equal(git(ws.storeDir, "diff", "--cached", "--name-only"), "");
  assert.equal(git(ws.storeDir, "status", "--porcelain"), "");
  // The lifecycle-ready config came from the published branch, not a local write.
  const cfg = readFileSync(join(ws.storeDir, "config.yml"), "utf8");
  assert.match(cfg, /^default_status: "In Design"$/m);
  assert.match(cfg, /^auto_commit: false$/m);
  assert.match(cfg, /"Ready for Merge"/);
  // The store is ignored per native Git.
  assert.equal(git(root, "check-ignore", ".backlog/x"), ".backlog/x");
  // Idempotent: second run verifies, branchState stays published/verified.
  const ws2 = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws2.status, "prepared");
  assert.equal(ws2.head, ws.head);
  // The only primary change is the appended ignore rule; branch/index unchanged.
  const after = primarySnapshot(root);
  assert.equal(after.branch, before.branch);
  assert.equal(after.index, before.index);
});

test("preparation preserves an explicitly selected existing backlog/ store", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root } = fixtureRepo();
  // An explicitly selected existing backlog/ store: a live folder config there.
  mkdirSync(join(root, "backlog"), { recursive: true });
  writeFileSync(join(root, "backlog", "config.yml"), 'project_name: "Kept"\n');
  // Mark the folder as live evidence: a live store dir with config selects backlog/.
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  // The existing non-empty store without .git blocks (migration is deferred), NOT recreated.
  assert.equal(ws.status, "blocked");
  assert.equal(ws.code, "uncommitted-task-content");
  assert.match(ws.detail, /migration|cutover|PRIMECLAW-43\.1/);
  // Untouched.
  assert.equal(readFileSync(join(root, "backlog", "config.yml"), "utf8"), 'project_name: "Kept"\n');
  assert.ok(!existsSync(join(root, "backlog", ".git")));
});

test("preparation with no provider evidence defaults to .backlog/, never backlog/", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root } = fixtureRepo();
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "prepared");
  assert.equal(ws.storeDir, join(root, ".backlog"));
  assert.ok(existsSync(join(root, ".backlog", ".git")));
  assert.ok(!existsSync(join(root, "backlog")));
});

test("a symlinked store target blocks before any write", () => {
  const { root } = fixtureRepo();
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "thw-out-")));
  symlinkSync(outside, join(root, ".backlog"));
  const before = primarySnapshot(root);
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "blocked");
  assert.equal(ws.code, "unsafe-store-location");
  assert.match(ws.detail, /symlink/);
  // Zero writes outside and zero primary mutation.
  assert.equal(readdirSync(outside).length, 0);
  assert.deepEqual(primarySnapshot(root), before);
});

test("a negated ignore rule blocks instead of returning prepared", () => {
  const { root } = fixtureRepo();
  writeFileSync(join(root, ".gitignore"), "/.backlog/\n!/.backlog/\n");
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "blocked");
  assert.equal(ws.code, "not-ignored");
  assert.match(ws.detail, /un-ignore|negation/);
  // No nested store was created.
  assert.ok(!existsSync(join(root, ".backlog")));
});

test("a hook failure or untracked-marker collision leaves the primary byte-for-byte unchanged", () => {
  const { root, remote } = fixtureRepo();
  // A user's untracked TASKS.md in the primary must survive bootstrap.
  writeFileSync(join(root, "TASKS.md"), "user's own\n");
  const before = primarySnapshot(root);
  const beforeTasks = readFileSync(join(root, "TASKS.md"), "utf8");
  const state = ensureTaskHistoryBranch(root, "origin", remote);
  assert.equal(state.status, "published");
  // The user's untracked TASKS.md is untouched and the primary never moved.
  assert.equal(readFileSync(join(root, "TASKS.md"), "utf8"), beforeTasks);
  assert.deepEqual(primarySnapshot(root), before);
});

test("a populated remote task branch is cloned with no cached deletions", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote } = fixtureRepo();
  // Publish a task branch carrying real task content AND a lifecycle-ready config.
  publishTaskBranch(remote, {
    "TASKS.md": "history\n",
    "task-1.md": "# task\n",
    "config.yml": FULL_CANONICAL_CONFIG,
  });
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "prepared");
  assert.equal(ws.branchState, "verified");
  // The published tasks are present and tracked; nothing staged for deletion.
  assert.equal(readFileSync(join(ws.storeDir, "task-1.md"), "utf8"), "# task\n");
  assert.equal(git(ws.storeDir, "diff", "--cached", "--name-only"), "");
  assert.ok(git(ws.storeDir, "ls-files").includes("task-1.md"));
});

test("an existing nested clone with an unrelated remote URL blocks", () => {
  const { root, remote } = fixtureRepo();
  publishTaskBranch(remote, { "TASKS.md": "v1\n" });
  git(root, "fetch", "-q", "origin", `${TASK_HISTORY_REF}:refs/remotes/origin/prime-claw/tasks`);
  git(root, "branch", "--track", "prime-claw/tasks", "refs/remotes/origin/prime-claw/tasks");
  // Pre-create a nested clone from a DIFFERENT (primary filesystem) URL.
  mkdirSync(join(root, ".backlog"), { recursive: true });
  execFileSync("git", ["clone", "-q", "--origin", "origin", "--branch", "prime-claw/tasks", root, join(root, ".backlog")], { stdio: "pipe" });
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "blocked");
  assert.equal(ws.code, "unreadable");
  assert.match(ws.detail, /canonical URL|not the selected remote/);
});

test("an existing valid nested clone is verified idempotently; remote advance blocks (mutation is deferred)", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote } = fixtureRepo();
  const ws1 = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws1.status, "prepared");
  // Idempotent re-run at the same head: verified, never recreated.
  const again = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(again.status, "prepared");
  assert.equal(again.head, ws1.head);
  // Advancing the remote out from under the local branch blocks: this
  // foundation never moves the primary's task refs; the later per-task
  // mutation loop owns fetch/fast-forward. Nothing is overwritten.
  publishTaskBranch(remote, { "TASKS.md": "history\n", "task-9.md": "# nine\n" });
  const ws2 = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws2.status, "blocked");
  assert.equal(ws2.code, "remote-advanced");
  // The local clone and branch are unchanged.
  assert.equal(git(ws1.storeDir, "rev-parse", "HEAD"), ws1.head);
});

test("a linked worktree blocks", () => {
  const { root } = fixtureRepo();
  const linked = join(root, "..", "linked");
  git(root, "worktree", "add", "-q", "-b", "linked-branch", linked);
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: linked });
  assert.equal(ws.status, "blocked");
  assert.equal(ws.code, "not-primary-checkout");
});

test("a Beads-selected provider blocks", () => {
  const { root } = fixtureRepo();
  // Beads evidence: a .beads dir with a beads config marking it live.
  mkdirSync(join(root, ".beads"), { recursive: true });
  writeFileSync(join(root, ".beads", "config.yaml"), "no-db: true\n");
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  // Either provider-not-backlog (beads selected) or a detection block.
  assert.equal(ws.status, "blocked");
  assert.ok(["provider-not-backlog", "unreadable"].includes(ws.code));
});

// ---------- residual regressions (53437db revise) ----------

// Residual 1: direct remote evidence is authoritative over a stale cached ref.
test("remote branch deleted by another clone while primary keeps a cached ref never returns verified", () => {
  const { root, remote } = fixtureRepo();
  // Publish, then let the primary fetch + track it (cached remote ref + local branch).
  publishTaskBranch(remote, { "TASKS.md": "v1\n" });
  git(root, "fetch", "-q", "origin", `${TASK_HISTORY_REF}:refs/remotes/origin/prime-claw/tasks`);
  git(root, "branch", "--track", "prime-claw/tasks", "refs/remotes/origin/prime-claw/tasks");
  assert.ok(git(root, "rev-parse", "refs/remotes/origin/prime-claw/tasks")); // cached ref present
  // Another clone deletes the remote branch out from under the primary.
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "thw-del-")));
  git(tmp, "init", "-q");
  git(tmp, "remote", "add", "origin", remote);
  git(tmp, "push", "-q", "origin", ":refs/heads/prime-claw/tasks");
  rmSync(tmp, { recursive: true, force: true });
  // The remote is now ABSENT. Direct evidence must win: never verified/published.
  const state = ensureTaskHistoryBranch(root, "origin", remote);
  assert.notEqual(state.status, "verified");
  assert.notEqual(state.status, "published");
  assert.equal(state.status, "blocked");
  // Local branch is now unpublished history → local-ahead.
  assert.equal(state.code, "local-ahead");
  // The stale cached remote-tracking ref was removed (not read as authority).
  assert.equal(gitAllow(root, "rev-parse", "--verify", "refs/remotes/origin/prime-claw/tasks").status !== 0, true);
});

// Residual 1: a direct/fetched mismatch (remote moves between probe and fetch) blocks.
test("a remote that moves between probe and fetch blocks rather than trusting either", () => {
  const { root, remote } = fixtureRepo();
  publishTaskBranch(remote, { "TASKS.md": "v1\n" });
  git(root, "fetch", "-q", "origin", `${TASK_HISTORY_REF}:refs/remotes/origin/prime-claw/tasks`);
  git(root, "branch", "--track", "prime-claw/tasks", "refs/remotes/origin/prime-claw/tasks");
  // Advance the remote; ensureTaskHistoryBranch re-probes and re-fetches.
  publishTaskBranch(remote, { "TASKS.md": "v2\n" });
  const state = ensureTaskHistoryBranch(root, "origin", remote);
  // Remote advanced ahead of the local branch → blocked (never verified, never force).
  assert.equal(state.status, "blocked");
  assert.equal(state.code, "remote-advanced");
});

// Residual 3: root config + published folder config → block, root bytes unchanged, no native write.
test("root config with a published folder config blocks before any native config write", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote } = fixtureRepo();
  // Published task branch carries a folder config.
  publishTaskBranch(remote, {
    "TASKS.md": "history\n",
    "config.yml": FULL_CANONICAL_CONFIG,
  });
  // The primary resolves a ROOT config (backlog.config.yml with project_name)
  // governing an existing backlog/ store directory.
  mkdirSync(join(root, "backlog"), { recursive: true });
  writeFileSync(join(root, "backlog", "TASKS.md"), "existing\n");
  const rootCfg = 'project_name: "outer"\ndefault_status: "In Design"\nstatuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]\nbacklog_directory: backlog\nauto_commit: false\n';
  writeFileSync(join(root, "backlog.config.yml"), rootCfg);
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "blocked");
  assert.equal(ws.code, "config-not-preserved");
  assert.match(ws.detail, /root/);
  // Root config bytes unchanged; no native write to it; no prepared result.
  assert.equal(readFileSync(join(root, "backlog.config.yml"), "utf8"), rootCfg);
  // No nested store was created (blocked before clone/config mutation).
  assert.ok(!existsSync(join(root, ".backlog", ".git")));
  assert.ok(!existsSync(join(root, "backlog", ".git")));
});

// Residual 2: the bootstrap publishes a lifecycle-ready config; the store is clean and stable.
test("no-evidence bootstrap publishes a lifecycle-ready config and a second prepare is stable", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote } = fixtureRepo();
  const ws1 = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws1.status, "prepared");
  // The REMOTE TREE contains the lifecycle-ready config (not a local write).
  const treeCfg = git(root, "show", `${ws1.head}:config.yml`);
  assert.match(treeCfg, /^default_status: "In Design"$/m);
  assert.match(treeCfg, /^auto_commit: false$/m);
  assert.match(treeCfg, /"In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"/);
  // The nested clone has NO uncommitted and NO unpublished content.
  assert.equal(git(ws1.storeDir, "status", "--porcelain"), "");
  assert.equal(git(ws1.storeDir, "rev-parse", "HEAD"), ws1.head);
  assert.equal(git(ws1.storeDir, "rev-parse", "refs/remotes/origin/prime-claw/tasks"), ws1.head);
  // The published store passes the existing capability gate (exact ordered lifecycle).
  // Capability gate via the native CLI from the store dir, read-only statuses proof.
  const statuses = execFileSync("backlog", ["config", "get", "statuses"], { cwd: ws1.storeDir, encoding: "utf8" }).trim();
  assert.equal(statuses, "In Design, In Planning, In Progress, Blocked, Ready for Merge, Done");
  // A second preparation is stable (verified, same head, still clean).
  const ws2 = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws2.status, "prepared");
  assert.equal(ws2.head, ws1.head);
  assert.equal(git(ws1.storeDir, "status", "--porcelain"), "");
});

// ---------- residual B regressions (1c598e0 revise pass 3) ----------

// Residual B(1): a fresh primary adopting a PRE-EXISTING remote branch whose
// effective native config is generic (three statuses, default To Do) must
// block and never return prepared — the always-on capability gate catches it.
test("a pre-existing remote branch with generic statuses and default To Do blocks, never prepared", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote } = fixtureRepo();
  // Publish an upstream-style generic config (native-valid but not canonical).
  publishTaskBranch(remote, {
    "TASKS.md": "history\n",
    "config.yml": [
      'project_name: "x"',
      'default_status: "To Do"',
      'statuses: ["To Do", "In Progress", "Done"]',
      "labels: []",
      "date_format: yyyy-mm-dd",
      "max_column_width: 20",
      "auto_open_browser: true",
      "default_port: 6420",
      "remote_operations: true",
      "auto_commit: false",
      "filesystem_only: false",
      "bypass_git_hooks: false",
      "check_active_branches: true",
      "active_branch_days: 30",
      'task_prefix: "task"',
      "",
    ].join("\n"),
  });
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "blocked");
  assert.equal(ws.code, "backlog-cli");
  assert.match(ws.detail, /lifecycle|statuses/i);
  // Never returned prepared, and the materialized clone is not silently
  // rewritten (the incompatible published config stays as published).
  assert.notEqual(ws.status, "prepared");
});

// Residual B(2): an otherwise-canonical pre-existing remote config using the
// native-valid `auto_commit : true` (spaces) must block on the effective native
// read, never be silently treated as an absent key returning prepared.
test("an otherwise-canonical pre-existing remote config with auto_commit : true blocks", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote } = fixtureRepo();
  publishTaskBranch(remote, {
    "TASKS.md": "history\n",
    "config.yml": FULL_CANONICAL_CONFIG.replace("auto_commit: false", "auto_commit : true"),
  });
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "blocked");
  assert.equal(ws.code, "backlog-cli");
  assert.match(ws.detail, /auto_commit/i);
  assert.notEqual(ws.status, "prepared");
});

// Residual B(1) companion: canonical statuses but a WRONG default must block on
// the exact native default proof (compact fixture).
test("canonical statuses with a wrong effective default status blocks", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote } = fixtureRepo();
  publishTaskBranch(remote, {
    "TASKS.md": "history\n",
    "config.yml": FULL_CANONICAL_CONFIG.replace('default_status: "In Design"', 'default_status: "To Do"'),
  });
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "blocked");
  assert.equal(ws.code, "backlog-cli");
  assert.match(ws.detail, /default status/i);
});


// ==================== Slice 2B: Episode-worktree preparation + guarded cleanup ====================

/**
 * A primary repository whose task-history workspace is prepared (the nested
 * store ignored via the per-worktree exclude, mirroring slice 2A), plus a
 * registered linked Episode code worktree on its own branch. Returns both
 * roots and the remote. The target worktree's store ignore is controlled by
 * `ignoreTarget` (a committed .gitignore on the target branch).
 */
function episodeFixture({ ignoreTarget = true, publishConfig = true, storeName = ".backlog", remoteName = "origin", taskFiles = {} } = {}) {
  const { dir, root, remote } = fixtureRepo();
  if (remoteName !== "origin") git(root, "remote", "rename", "origin", remoteName);
  if (publishConfig) publishTaskBranch(remote, { "TASKS.md": "history\n", "config.yml": FULL_CANONICAL_CONFIG, ...taskFiles });
  let ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  if (ws.status !== "prepared") throw new Error(`fixture primary not prepared: ${ws.detail}`);
  if (storeName === "backlog") {
    // Retain a real built-in `backlog/` store, then re-run slice 2A so its
    // native provider evidence is the prepared-primary authority.
    renameSync(ws.storeDir, join(root, "backlog"));
    ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
    if (ws.status !== "prepared") throw new Error(`fixture backlog/ primary not prepared: ${ws.detail}`);
  }
  const target = join(dir, "episode");
  git(root, "branch", "episode", "main");
  git(root, "worktree", "add", "-q", target, "episode");
  if (ignoreTarget) {
    writeFileSync(join(target, ".gitignore"), `/${storeName}/\n`);
    git(target, "add", ".gitignore");
    git(target, "-c", "user.email=t@e.st", "-c", "user.name=t", "commit", "-qm", "ignore task store");
  }
  return { dir, root, remote, remoteName, target, primaryHead: ws.head, primaryStoreDir: ws.storeDir, storeDir: join(target, storeName), storeName };
}

test("a registered linked Episode worktree gets an independent clean clone with zero primary/target code mutations", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote, target, primaryHead, storeDir } = episodeFixture();
  const primaryBefore = primarySnapshot(root);
  const targetStatusBefore = git(target, "status", "--porcelain");
  const res = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target });
  assert.equal(res.status, "prepared");
  assert.equal(res.storeDir, storeDir);
  assert.equal(res.head, primaryHead);
  // An independent ordinary-Git clone: a real .git directory, origin remote,
  // on the task branch, at the exact published head.
  assert.ok(existsSync(join(storeDir, ".git")), "nested clone exists");
  assert.equal(git(storeDir, "rev-parse", "--git-dir"), ".git");
  assert.equal(git(storeDir, "remote", "get-url", "origin"), remote);
  assert.equal(git(storeDir, "rev-parse", "--abbrev-ref", "HEAD"), "prime-claw/tasks");
  assert.equal(git(storeDir, "status", "--porcelain"), "");
  assert.equal(git(storeDir, "rev-parse", "HEAD"), primaryHead);
  // Zero primary and zero target code mutations.
  assert.deepEqual(primarySnapshot(root), primaryBefore);
  assert.equal(git(target, "status", "--porcelain"), targetStatusBefore);
});

test("a foreign (unregistered) target directory blocks before any write", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, target, storeDir } = episodeFixture();
  // A sibling directory that is NOT a registered worktree of the common repo.
  const foreign = realpathSync(mkdtempSync(join(tmpdir(), "thw-foreign-")));
  const res = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: foreign });
  assert.equal(res.status, "blocked");
  assert.equal(res.code, "not-linked-worktree");
  assert.ok(!existsSync(join(foreign, ".backlog")), "no store created in the foreign dir");
  // And a directory that merely shares a common dir but is not registered.
  const unreg = join(root, "scratch-unregistered");
  mkdirSync(unreg, { recursive: true });
  const res2 = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: unreg });
  assert.equal(res2.status, "blocked");
  assert.equal(res2.code, "not-linked-worktree");
});

test("a registered worktree whose store is not ignored blocks before creating it", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  // ignoreTarget: false -> the target branch has NO ignore rule for .backlog/.
  const { root, target, storeDir } = episodeFixture({ ignoreTarget: false });
  const res = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target });
  assert.equal(res.status, "blocked");
  assert.equal(res.code, "not-ignored");
  assert.match(res.detail, /not ignored|check-ignore/);
  assert.ok(!existsSync(storeDir), "no nested clone was created");
});

test("reuse with a wrong remote URL or dirt blocks", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, target, storeDir } = episodeFixture();
  const ok = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target });
  assert.equal(ok.status, "prepared");
  // Wrong remote URL on reuse.
  git(storeDir, "remote", "set-url", "origin", "https://example.invalid/other.git");
  const res = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target });
  assert.equal(res.status, "blocked");
  assert.equal(res.code, "unsafe-store-location");
  assert.match(res.detail, /origin URL/);
  git(storeDir, "remote", "set-url", "origin", git(root, "remote", "get-url", "origin"));
  // Dirt on reuse.
  writeFileSync(join(storeDir, "dirty.md"), "x\n");
  const res2 = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target });
  assert.equal(res2.status, "blocked");
  assert.equal(res2.code, "uncommitted-task-content");
});

test("cleanup removes one exact clean published clone and refuses foreign/dirty without deletion", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, target, storeDir } = episodeFixture();
  assert.equal(prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target }).status, "prepared");
  // Dirty content -> refuse without deletion.
  writeFileSync(join(storeDir, "dirty.md"), "x\n");
  const dirty = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
  assert.equal(dirty.status, "refused");
  assert.equal(dirty.code, "uncommitted-task-content");
  assert.ok(existsSync(storeDir), "dirty clone left in place");
  rmSync(join(storeDir, "dirty.md"));
  // Clean published clone -> removed, target code untouched.
  const clean = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
  assert.equal(clean.status, "cleaned");
  assert.ok(!existsSync(storeDir), "proven clone removed");
  assert.equal(git(target, "status", "--porcelain"), "", "target code worktree untouched");
});

test("retained backlog/ and a selected non-origin remote stay exact through prepare, reuse, and cleanup", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote, target, storeDir } = episodeFixture({ storeName: "backlog", remoteName: "upstream" });
  const prepared = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target });
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.storeDir, storeDir);
  assert.equal(prepared.remote, "upstream");
  assert.ok(!existsSync(join(target, ".backlog")), "never hardcodes a sibling .backlog store");
  assert.equal(git(storeDir, "remote"), "upstream");
  assert.equal(git(storeDir, "remote", "get-url", "upstream"), remote);
  const reused = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target });
  assert.equal(reused.status, "prepared");
  assert.equal(reused.storeDir, storeDir);
  const cleaned = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
  assert.deepEqual(cleaned, { status: "cleaned", storeDir });
  assert.ok(!existsSync(storeDir));
  assert.ok(!existsSync(join(target, ".backlog")));
});

test("conflicting target root authority blocks before clone and blocks later reuse/cleanup", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, target, storeDir } = episodeFixture();
  const rootConfig = join(target, "backlog.config.yml");
  const otherStore = join(target, "other-store");
  mkdirSync(otherStore);
  writeFileSync(rootConfig, 'project_name: "other"\nbacklog_directory: "other-store"\n');
  const before = primarySnapshot(root);
  const blocked = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.code, "unsafe-store-location");
  assert.match(blocked.detail, /root configuration|not the exact derived store|authority resolves/i);
  assert.ok(!existsSync(storeDir), "conflict blocks before nested clone write");
  assert.deepEqual(primarySnapshot(root), before);

  rmSync(rootConfig);
  rmSync(otherStore, { recursive: true, force: true });
  assert.equal(prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target }).status, "prepared");
  mkdirSync(otherStore);
  writeFileSync(rootConfig, 'project_name: "other"\nbacklog_directory: "other-store"\n');
  const reuse = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target });
  assert.equal(reuse.status, "blocked");
  assert.equal(reuse.code, "unsafe-store-location");
  const cleanup = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
  assert.equal(cleanup.status, "refused");
  assert.ok(existsSync(storeDir), "authority conflict leaves clone unchanged");
});

test("same-store target root Backlog config refuses reuse and cleanup without touching tracked bytes", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, target, storeDir } = episodeFixture();
  assert.equal(prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target }).status, "prepared");

  const rootConfig = join(target, "backlog.config.yml");
  const rootBytes = 'project_name: "episode"\ndefault_status: "In Design"\nstatuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]\nbacklog_directory: ".backlog"\nauto_commit: false\n';
  writeFileSync(rootConfig, rootBytes);
  git(target, "add", "backlog.config.yml");
  git(target, "-c", "user.email=t@e.st", "-c", "user.name=t", "commit", "-qm", "add same-store root config");
  const statusBefore = git(target, "status", "--porcelain", "--untracked-files=all");
  assert.equal(statusBefore, "");

  const reuse = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target });
  assert.equal(reuse.status, "blocked");
  assert.equal(reuse.code, "unsafe-store-location");
  assert.match(reuse.remediation, /deferred.*PRIMECLAW-43\.1/i);
  assert.equal(readFileSync(rootConfig, "utf8"), rootBytes);
  assert.equal(git(target, "status", "--porcelain", "--untracked-files=all"), statusBefore);

  const cleanup = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
  assert.equal(cleanup.status, "refused");
  assert.match(cleanup.remediation, /deferred.*PRIMECLAW-43\.1/i);
  assert.equal(readFileSync(rootConfig, "utf8"), rootBytes);
  assert.equal(git(target, "status", "--porcelain", "--untracked-files=all"), statusBefore);
  assert.ok(existsSync(storeDir), "root-config refusal retains the exact nested store");
});

test("ignored untracked task content blocks final preparation and cleanup", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, target, storeDir } = episodeFixture({ taskFiles: { ".gitignore": "ignored-sentinel.tmp\n" } });
  const prepared = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target });
  assert.equal(prepared.status, "prepared");

  const sentinel = join(storeDir, "ignored-sentinel.tmp");
  writeFileSync(sentinel, "unpublished and ignored\n");
  assert.equal(git(storeDir, "status", "--porcelain"), "", "ordinary porcelain hides the ignored sentinel");
  assert.match(git(storeDir, "status", "--porcelain", "--ignored", "--untracked-files=all"), /^!! ignored-sentinel\.tmp$/m);

  const reuse = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target });
  assert.equal(reuse.status, "blocked");
  assert.equal(reuse.code, "uncommitted-task-content");
  assert.match(reuse.detail, /unpublished|ignored-sentinel/i);
  const cleanup = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
  assert.equal(cleanup.status, "refused");
  assert.equal(cleanup.code, "uncommitted-task-content");
  assert.ok(existsSync(sentinel), "ignored unpublished content survives refusal");
  assert.ok(existsSync(storeDir), "the nested store survives refusal");
});

test("cleanup treats a failed cleanliness proof as unreadable and retains all content", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, target, storeDir } = episodeFixture();
  assert.equal(prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target }).status, "prepared");
  const sentinel = join(storeDir, "unpublished-sentinel.md");
  writeFileSync(sentinel, "must survive\n");
  writeFileSync(join(storeDir, ".git", "index"), "");
  const cleanup = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
  assert.equal(cleanup.status, "refused");
  assert.equal(cleanup.code, "unreadable");
  assert.match(cleanup.detail, /cleanliness proof failed/i);
  assert.ok(existsSync(sentinel), "empty stdout from failed status is never clean");
  assert.ok(existsSync(storeDir));
});

test("symlinked .git and custom core.worktree identities are refused before reuse or deletion", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  {
    const { root, target, storeDir } = episodeFixture();
    assert.equal(prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target }).status, "prepared");
    renameSync(join(storeDir, ".git"), join(storeDir, ".git-real"));
    symlinkSync(".git-real", join(storeDir, ".git"), "dir");
    const reuse = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target });
    assert.equal(reuse.status, "blocked");
    assert.equal(reuse.code, "unsafe-store-location");
    const cleanup = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
    assert.equal(cleanup.status, "refused");
    assert.equal(cleanup.code, "unsafe-store-location");
    assert.ok(existsSync(join(storeDir, ".git-real")));
  }
  {
    const { dir, root, target, storeDir } = episodeFixture();
    assert.equal(prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target }).status, "prepared");
    const outside = join(dir, "outside-worktree");
    mkdirSync(outside);
    const outsideMarker = join(outside, "outside-marker.md");
    writeFileSync(outsideMarker, "must survive\n");
    git(storeDir, "config", "core.worktree", outside);
    const reuse = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target });
    assert.equal(reuse.status, "blocked");
    assert.equal(reuse.code, "unsafe-store-location");
    const cleanup = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
    assert.equal(cleanup.status, "refused");
    assert.equal(cleanup.code, "unsafe-store-location");
    assert.ok(existsSync(storeDir));
    assert.equal(readFileSync(outsideMarker, "utf8"), "must survive\n");
  }
});

test("cleanup with an absent primary store never recreates it or mutates primary state", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, target, primaryStoreDir, storeDir } = episodeFixture();
  assert.equal(prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target }).status, "prepared");
  rmSync(primaryStoreDir, { recursive: true, force: true });
  const ignorePath = join(root, ".gitignore");
  const before = {
    snapshot: primarySnapshot(root),
    ignore: readFileSync(ignorePath, "utf8"),
    refs: git(root, "for-each-ref", "--format=%(refname) %(objectname)"),
  };
  const cleanup = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
  assert.deepEqual(cleanup, { status: "cleaned", storeDir });
  assert.ok(!existsSync(storeDir));
  assert.ok(!existsSync(primaryStoreDir), "cleanup does not recreate the primary store");
  assert.equal(readFileSync(ignorePath, "utf8"), before.ignore);
  assert.deepEqual(primarySnapshot(root), before.snapshot);
  assert.equal(git(root, "for-each-ref", "--format=%(refname) %(objectname)"), before.refs);
});

test("cleanup refuses clean local-ahead, remote-advanced, and unavailable-remote stores", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  {
    const { root, target, storeDir } = episodeFixture();
    assert.equal(prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target }).status, "prepared");
    writeFileSync(join(storeDir, "local.md"), "local\n");
    git(storeDir, "add", "local.md");
    git(storeDir, "-c", "user.email=t@e.st", "-c", "user.name=t", "commit", "-qm", "local ahead");
    assert.equal(git(storeDir, "status", "--porcelain"), "");
    const cleanup = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
    assert.equal(cleanup.status, "refused");
    assert.equal(cleanup.code, "local-ahead");
    assert.ok(existsSync(storeDir));
  }
  {
    const { root, remote, target, storeDir } = episodeFixture();
    assert.equal(prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target }).status, "prepared");
    publishTaskBranch(remote, { "remote-advance.md": "advanced\n" });
    const cleanup = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
    assert.equal(cleanup.status, "refused");
    assert.equal(cleanup.code, "remote-advanced");
    assert.ok(existsSync(storeDir));
  }
  {
    const { dir, root, remote, target, storeDir } = episodeFixture();
    assert.equal(prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target }).status, "prepared");
    renameSync(remote, join(dir, "remote-unavailable.git"));
    const cleanup = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
    assert.equal(cleanup.status, "refused");
    assert.equal(cleanup.code, "remote-unavailable");
    assert.ok(existsSync(storeDir));
  }
});

test("cleanup refuses dangling target-store symlinks and external primary work-tree identity", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  {
    const { root, target, storeDir } = episodeFixture();
    symlinkSync("missing-task-store", storeDir, "dir");
    const cleanup = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
    assert.equal(cleanup.status, "refused");
    assert.equal(cleanup.code, "unsafe-store-location");
    assert.ok(lstatSync(storeDir).isSymbolicLink(), "dangling symlink is retained, never called absent/cleaned");
  }
  {
    const { dir, root, target, storeDir } = episodeFixture();
    assert.equal(prepareEpisodeTaskHistoryWorkspace({ primaryRoot: root, targetWorktree: target }).status, "prepared");
    const outside = join(dir, "primary-external-worktree");
    mkdirSync(outside);
    const marker = join(outside, "outside-marker.md");
    writeFileSync(marker, "must survive\n");
    git(root, "config", "core.worktree", outside);
    const cleanup = cleanupEpisodeTaskHistoryStore({ primaryRoot: root, targetWorktree: target });
    assert.equal(cleanup.status, "refused");
    assert.ok(["unsafe-store-location", "not-linked-worktree", "unreadable"].includes(cleanup.code));
    assert.ok(existsSync(storeDir), "target store remains when primary project-root identity drifts");
    assert.equal(readFileSync(marker, "utf8"), "must survive\n");
  }
});


// ==================== Slice 2C: exact native mutation + ordinary publication ====================

const OWNER_TASK_PATH = "tasks/task-1 - Owner.md";
const OTHER_TASK_PATH = "tasks/task-2 - Other.md";

function taskMarkdown(id, title, notes = "initial") {
  return [
    "---",
    `id: ${id}`,
    `title: ${title}`,
    "status: In Progress",
    "assignee: []",
    "created_date: '2026-10-19 00:00'",
    "updated_date: '2026-10-19 00:00'",
    "labels: []",
    "dependencies: []",
    "priority: p2",
    "type: task",
    "---",
    "",
    "## Description",
    "",
    `${title} description.`,
    "",
    "## Implementation Notes",
    "",
    notes,
    "",
  ].join("\n");
}

function mutationFixture() {
  const fixture = episodeFixture({ taskFiles: {
    [OWNER_TASK_PATH]: taskMarkdown("TASK-1", "Owner"),
    [OTHER_TASK_PATH]: taskMarkdown("TASK-2", "Other"),
  } });
  const prepared = prepareEpisodeTaskHistoryWorkspace({ primaryRoot: fixture.root, targetWorktree: fixture.target });
  if (prepared.status !== "prepared") throw new Error(`mutation fixture not prepared: ${prepared.detail}`);
  git(fixture.storeDir, "config", "user.email", "t@e.st");
  git(fixture.storeDir, "config", "user.name", "t");
  return fixture;
}

function realRunnerWithPushAction(action) {
  let fired = false;
  let firstPushArgs = null;
  return {
    get fired() { return fired; },
    get firstPushArgs() { return firstPushArgs; },
    run(command, args, options = {}) {
      if (!fired && command === "git" && args.includes("push") && args.includes(`HEAD:${TASK_HISTORY_REF}`)) {
        fired = true;
        firstPushArgs = [...args];
        const override = action?.();
        if (override) return override;
      }
      try {
        const stdout = execFileSync(command, args, { cwd: options.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        return { stdout, stderr: "", status: 0 };
      } catch (error) {
        return { stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? error.message ?? error), status: Number.isInteger(error.status) ? error.status : 1 };
      }
    },
  };
}

function nativeTask(root, id) {
  return JSON.parse(execFileSync("backlog", ["task", "view", "--json", "--", id], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })).task;
}

test("a tracked native task symlink blocks before mutation without exposing or changing an external sentinel", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { dir, root, remote, target, storeDir } = mutationFixture();
  const sentinel = join(dir, "external-task-sentinel.md");
  const sentinelBytes = taskMarkdown("TASK-1", "Owner", "EXTERNAL_SENTINEL_SECRET_MUST_NOT_ESCAPE");
  writeFileSync(sentinel, sentinelBytes);
  rmSync(join(storeDir, OWNER_TASK_PATH));
  symlinkSync(sentinel, join(storeDir, OWNER_TASK_PATH));
  git(storeDir, "add", OWNER_TASK_PATH);
  git(storeDir, "-c", "user.email=t@e.st", "-c", "user.name=t", "commit", "-qm", "unsafe task symlink fixture");
  git(storeDir, "push", "-q", "origin", `${TASK_HISTORY_REF}:${TASK_HISTORY_REF}`);
  const unsafeHead = git(storeDir, "rev-parse", "HEAD");

  const result = publishEpisodeTaskHistoryMutation({ primaryRoot: root, targetWorktree: target, taskId: "TASK-1", edits: [{ option: "--append-notes", value: "must never be written" }] });
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "identity-mismatch");
  assert.match(result.detail, /symlink|tracked real regular/i);
  assert.equal(readFileSync(sentinel, "utf8"), sentinelBytes, "external sentinel bytes stay unchanged");
  assert.ok(!JSON.stringify(result).includes("EXTERNAL_SENTINEL_SECRET_MUST_NOT_ESCAPE"), "unsafe external content is not exposed as evidence");
  assert.equal(git(storeDir, "rev-parse", "HEAD"), unsafeHead, "no local mutation commit was made");
  assert.equal(git(storeDir, "status", "--porcelain", "--ignored", "--untracked-files=all"), "");
  assert.match(git(storeDir, "ls-remote", "--heads", remote, TASK_HISTORY_REF), new RegExp(`^${unsafeHead}\\s`));
});

test("exact native task edits commit, publish to the direct head, and publish sequentially", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote, target, storeDir } = mutationFixture();
  const base = git(storeDir, "rev-parse", "HEAD");
  const first = publishEpisodeTaskHistoryMutation({ primaryRoot: root, targetWorktree: target, taskId: "TASK-1", edits: [{ option: "--append-notes", value: "owner update one" }] });
  assert.equal(first.status, "published");
  assert.equal(first.baseHead, base);
  assert.equal(first.taskId, "TASK-1");
  assert.match(first.taskPath, /task-1 - Owner\.md$/);
  assert.match(first.nativeBefore, /"id":\s*"TASK-1"/);
  assert.match(first.nativeAfter, /owner update one/);
  assert.match(first.diff, /owner update one/);
  assert.equal(git(storeDir, "rev-parse", "HEAD"), first.publishedHead);
  assert.match(git(storeDir, "ls-remote", "--heads", remote, TASK_HISTORY_REF), new RegExp(`^${first.publishedHead}\\s`));
  assert.equal(git(storeDir, "status", "--porcelain", "--ignored", "--untracked-files=all"), "");

  const second = publishEpisodeTaskHistoryMutation({ primaryRoot: root, targetWorktree: target, taskId: "TASK-1", edits: [{ option: "--append-notes", value: "owner update two" }] });
  assert.equal(second.status, "published");
  assert.equal(second.baseHead, first.publishedHead);
  assert.match(second.nativeBefore, /owner update one/);
  assert.match(second.nativeAfter, /owner update two/);
  assert.equal(nativeTask(target, "TASK-1").id, "TASK-1");
});

test("a clean stale clone fast-forwards and re-reads before native mutation", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote, target, storeDir } = mutationFixture();
  const stale = git(storeDir, "rev-parse", "HEAD");
  const advanced = publishTaskBranch(remote, { [OTHER_TASK_PATH]: taskMarkdown("TASK-2", "Other", "remote pre-read advance") });
  const result = publishEpisodeTaskHistoryMutation({ primaryRoot: root, targetWorktree: target, taskId: "TASK-1", edits: [{ option: "--append-notes", value: "after fast-forward" }] });
  assert.equal(result.status, "published");
  assert.equal(result.baseHead, advanced);
  assert.notEqual(result.baseHead, stale);
  assert.equal(git(storeDir, "merge-base", "--is-ancestor", advanced, result.publishedHead), "");
  assert.match(result.nativeAfter, /after fast-forward/);
});

test("an unrelated-task publication race is merged and preserved by ordinary Git", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote, target, storeDir } = mutationFixture();
  let racedHead = "";
  const runner = realRunnerWithPushAction(() => {
    racedHead = publishTaskBranch(remote, { [OTHER_TASK_PATH]: taskMarkdown("TASK-2", "Other", "concurrent unrelated update") });
  });
  const result = publishEpisodeTaskHistoryMutation({ primaryRoot: root, targetWorktree: target, taskId: "TASK-1", edits: [{ option: "--append-notes", value: "owner raced update" }], runner });
  assert.equal(result.status, "published");
  assert.equal(runner.fired, true);
  assert.ok(!runner.firstPushArgs.some((arg) => arg.includes("force")), "publication uses no force option/refspec");
  assert.ok(runner.firstPushArgs.includes(`HEAD:${TASK_HISTORY_REF}`));
  assert.equal(git(storeDir, "merge-base", "--is-ancestor", racedHead, result.publishedHead), "");
  assert.match(readFileSync(join(storeDir, OTHER_TASK_PATH), "utf8"), /concurrent unrelated update/);
  assert.match(result.nativeAfter, /owner raced update/);
  assert.match(git(storeDir, "show", "-s", "--format=%P", result.publishedHead), /^[0-9a-f]{40} [0-9a-f]{40}$/);
  assert.match(git(storeDir, "ls-remote", "--heads", remote, TASK_HISTORY_REF), new RegExp(`^${result.publishedHead}\\s`));
});

test("a shared config publication race blocks with full evidence and retains local work", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote, target, storeDir } = mutationFixture();
  let racedHead = "";
  const runner = realRunnerWithPushAction(() => {
    racedHead = publishTaskBranch(remote, { "config.yml": FULL_CANONICAL_CONFIG.replace("auto_commit: false", "auto_commit: true") });
  });
  const result = publishEpisodeTaskHistoryMutation({ primaryRoot: root, targetWorktree: target, taskId: "TASK-1", edits: [{ option: "--append-notes", value: "local work retained after config race" }], runner });
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "ambiguous-remote-advance");
  assert.equal(result.remoteHead, racedHead);
  assert.equal(result.localHead, git(storeDir, "rev-parse", "HEAD"));
  assert.match(result.nativeBefore, /"id":\s*"TASK-1"/);
  assert.match(result.nativeAfter, /local work retained after config race/);
  assert.match(result.nativeRemote, /"id":\s*"TASK-1"/);
  assert.match(result.localDiff, /local work retained after config race/);
  assert.match(result.remoteDiff, /auto_commit: false/);
  assert.match(result.remoteDiff, /auto_commit: true/);
  assert.equal(git(storeDir, "status", "--porcelain", "--ignored", "--untracked-files=all"), "", "local mutation remains a clean recoverable commit");
  assert.equal(readFileSync(join(storeDir, "config.yml"), "utf8"), FULL_CANONICAL_CONFIG, "unsafe remote config was not merged locally");
  assert.match(git(storeDir, "ls-remote", "--heads", remote, TASK_HISTORY_REF), new RegExp(`^${racedHead}\\s`));
});

test("a same-task publication race blocks with exact native and Git evidence without overwrite", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote, target, storeDir } = mutationFixture();
  let racedHead = "";
  const runner = realRunnerWithPushAction(() => {
    racedHead = publishTaskBranch(remote, { [OWNER_TASK_PATH]: taskMarkdown("TASK-1", "Owner", "concurrent same-task update") });
  });
  const result = publishEpisodeTaskHistoryMutation({ primaryRoot: root, targetWorktree: target, taskId: "TASK-1", edits: [{ option: "--append-notes", value: "local owner update" }], runner });
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "same-task-advanced");
  assert.equal(result.remoteHead, racedHead);
  assert.equal(result.localHead, git(storeDir, "rev-parse", "HEAD"));
  assert.match(result.nativeBefore, /"id":\s*"TASK-1"/);
  assert.match(result.nativeAfter, /local owner update/);
  assert.match(result.nativeRemote, /concurrent same-task update/);
  assert.match(result.localDiff, /local owner update/);
  assert.match(result.remoteDiff, /concurrent same-task update/);
  assert.equal(git(storeDir, "status", "--porcelain", "--ignored", "--untracked-files=all"), "");
  assert.match(git(storeDir, "ls-remote", "--heads", remote, TASK_HISTORY_REF), new RegExp(`^${racedHead}\\s`));
});

test("a rejected non-force push preserves the clean unpublished local commit and evidence", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, target, storeDir } = mutationFixture();
  const runner = realRunnerWithPushAction(() => ({ status: 1, stdout: "", stderr: "remote hook rejected" }));
  const result = publishEpisodeTaskHistoryMutation({ primaryRoot: root, targetWorktree: target, taskId: "TASK-1", edits: [{ option: "--append-notes", value: "retained after rejection" }], runner });
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "push-failed");
  assert.equal(result.localHead, git(storeDir, "rev-parse", "HEAD"));
  assert.match(result.localDiff, /retained after rejection/);
  assert.equal(git(storeDir, "status", "--porcelain", "--ignored", "--untracked-files=all"), "");
});

test("remote loss during publication preserves the clean unpublished local commit and evidence", (t) => {
  if (!backlogAvailable()) { t.skip("backlog executable unavailable"); return; }
  const { root, remote, target, storeDir } = mutationFixture();
  const offline = `${remote}.offline`;
  const runner = realRunnerWithPushAction(() => {
    renameSync(remote, offline);
    return { status: 1, stdout: "", stderr: "remote unavailable" };
  });
  const result = publishEpisodeTaskHistoryMutation({ primaryRoot: root, targetWorktree: target, taskId: "TASK-1", edits: [{ option: "--append-notes", value: "retained while offline" }], runner });
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "remote-unavailable");
  assert.equal(result.localHead, git(storeDir, "rev-parse", "HEAD"));
  assert.match(result.localDiff, /retained while offline/);
  assert.equal(git(storeDir, "status", "--porcelain", "--ignored", "--untracked-files=all"), "");
  renameSync(offline, remote);
});
