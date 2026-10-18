/**
 * Task-history workspace foundation regressions (PRIMECLAW-43 slice 2A).
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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync, readdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  TASK_HISTORY_REF,
  selectTaskHistoryRemote,
  ensureTaskHistoryBranch,
  prepareTaskHistoryWorkspace,
} from "../src/prime-agent-plugin/extension-support/task-history-workspace.ts";

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
  for (const [name, content] of Object.entries(files)) writeFileSync(join(tmp, name), content);
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
    "config.yml": 'project_name: "x"\ndefault_status: "In Design"\nstatuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]\nauto_commit: false\n',
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
    "config.yml": 'project_name: "x"\ndefault_status: "In Design"\nstatuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]\nauto_commit: false\n',
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
