import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  TASK_HISTORY_REF,
  ensureTaskHistoryBranch,
  prepareTaskHistoryWorkspace,
  selectTaskHistoryRemote,
} from "../src/prime-agent-plugin/extension-support/task-history-workspace.ts";

function git(cwd, ...args) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function tryGit(cwd, ...args) {
  try {
    return { status: 0, stdout: git(cwd, ...args) };
  } catch (error) {
    return { status: error.status ?? 1, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? "") };
  }
}

/** Disposable repository with one committed code file on main. */
function fixtureRepo({ bare = true, upstream = true } = {}) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-taskws-")));
  const root = join(base, "repo");
  mkdirSync(root, { recursive: true });
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  git(root, "config", "user.email", "fixture@example.invalid");
  git(root, "config", "user.name", "Fixture");
  writeFileSync(join(root, "app.txt"), "code\n");
  git(root, "add", "app.txt");
  git(root, "commit", "-qm", "code init");
  let remote = null;
  if (bare) {
    remote = join(base, "remote.git");
    execFileSync("git", ["init", "-q", "-b", "main", "--bare", remote]);
    git(root, "remote", "add", "origin", remote);
    if (upstream) git(root, "push", "-q", "-u", "origin", "main");
  }
  return { root, remote };
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

function writeFolderConfig(root, dir = "backlog") {
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, "config.yml"), `project_name: "fixture"\nstatuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]\n`);
}

// --- remote selection ---

test("remote selection uses the canonical branch upstream", () => {
  const { root } = fixtureRepo();
  const result = selectTaskHistoryRemote(root);
  assert.deepEqual(result, { status: "selected", name: "origin", via: "branch-upstream" });
});

test("remote selection falls back to the sole repository remote", () => {
  const { root } = fixtureRepo({ upstream: false });
  const result = selectTaskHistoryRemote(root);
  assert.deepEqual(result, { status: "selected", name: "origin", via: "sole-remote" });
});

test("remote selection blocks with no remote", () => {
  const { root } = fixtureRepo({ bare: false });
  const result = selectTaskHistoryRemote(root);
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "no-remote");
  assert.match(result.detail, /no upstream.*no remote/);
  assert.match(result.remediation, /git remote add/);
});

test("remote selection blocks on ambiguous remotes", () => {
  const { root } = fixtureRepo({ upstream: false });
  git(root, "remote", "add", "backup", join(root, "..", "backup.git"));
  const result = selectTaskHistoryRemote(root);
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "ambiguous-remotes");
  assert.match(result.detail, /multiple remotes: backup, origin/);
  assert.match(result.remediation, /set the branch upstream/);
});

// --- branch creation/verification ---

test("branch creation makes a disconnected task-history branch and restores the code branch", () => {
  const { root } = fixtureRepo();
  const state = ensureTaskHistoryBranch(root, "origin");
  assert.equal(state.status, "created");
  assert.match(state.head, /^[0-9a-f]{40}$/);
  assert.equal(git(root, "branch", "--show-current"), "main");
  assert.equal(tryGit(root, "merge-base", TASK_HISTORY_REF, "main").status, 1, "no shared ancestry");
  assert.equal(git(root, "log", "-1", "--format=%P", TASK_HISTORY_REF), "", "orphan: zero parents");
  assert.equal(git(root, "ls-tree", "--name-only", TASK_HISTORY_REF), "TASKS.md");
  assert.equal(git(root, "status", "--porcelain"), "");
});

test("branch verification is idempotent for a clean disconnected branch", () => {
  const { root } = fixtureRepo();
  const first = ensureTaskHistoryBranch(root, "origin");
  const second = ensureTaskHistoryBranch(root, "origin");
  assert.equal(second.status, "verified");
  assert.equal(second.head, first.head);
});

test("branch verification blocks when the task branch shares code ancestry", () => {
  const { root } = fixtureRepo();
  git(root, "branch", "prime-claw/tasks", "main");
  const state = ensureTaskHistoryBranch(root, "origin");
  assert.equal(state.status, "blocked");
  assert.equal(state.code, "shared-ancestry");
  assert.match(state.remediation, /branch -D prime-claw\/tasks/);
  git(root, "branch", "-D", "prime-claw/tasks");
});

test("branch verification blocks when the remote task ref has advanced", () => {
  const { root, remote } = fixtureRepo();
  const first = ensureTaskHistoryBranch(root, "origin");
  assert.equal(first.status, "created");
  git(root, "push", "-q", "origin", "refs/heads/prime-claw/tasks:refs/heads/prime-claw/tasks");
  // Advance the remote behind the local branch's back via a second clone.
  const other = join(root, "..", "other");
  execFileSync("git", ["clone", "-q", "-b", "main", remote, other]);
  git(other, "config", "user.email", "fixture@example.invalid");
  git(other, "config", "user.name", "Fixture");
  git(other, "switch", "-q", "prime-claw/tasks");
  writeFileSync(join(other, "extra.md"), "remote advance\n");
  git(other, "add", "extra.md");
  git(other, "commit", "-qm", "remote advance");
  git(other, "push", "-q", "origin", "refs/heads/prime-claw/tasks:refs/heads/prime-claw/tasks");
  git(root, "fetch", "-q", "origin");
  const state = ensureTaskHistoryBranch(root, "origin");
  assert.equal(state.status, "blocked");
  assert.equal(state.code, "remote-advanced");
  assert.match(state.remediation, /never force/);
});

test("branch preparation adopts an existing remote task branch by tracking", () => {
  const { root, remote } = fixtureRepo();
  // Another clone creates and pushes the disconnected task branch first.
  const other = join(root, "..", "other");
  execFileSync("git", ["clone", "-q", "-b", "main", remote, other]);
  git(other, "config", "user.email", "fixture@example.invalid");
  git(other, "config", "user.name", "Fixture");
  const created = ensureTaskHistoryBranch(other, "origin");
  assert.equal(created.status, "created");
  git(other, "push", "-q", "origin", "refs/heads/prime-claw/tasks:refs/heads/prime-claw/tasks");
  git(root, "fetch", "-q", "origin");
  const state = ensureTaskHistoryBranch(root, "origin");
  assert.equal(state.status, "verified");
  assert.equal(state.head, created.head);
  assert.equal(git(root, "branch", "--show-current"), "main");
});

test("branch preparation blocks when the primary checkout is on the task branch", () => {
  const { root } = fixtureRepo();
  const created = ensureTaskHistoryBranch(root, "origin");
  assert.equal(created.status, "created");
  git(root, "switch", "-q", "prime-claw/tasks");
  const state = ensureTaskHistoryBranch(root, "origin");
  assert.equal(state.status, "blocked");
  assert.equal(state.code, "unreadable");
  git(root, "switch", "-q", "main");
});

// --- workspace preparation (real ordinary Git, disposable repositories) ---

test("workspace preparation clones the nested store, ignores it, disables auto-commit, and is idempotent", (t) => {
  if (!backlogAvailable()) { t.skip("managed backlog executable unavailable in this environment (tier-1 image ships none; host runs the repository dist)"); return; }
  const { root } = fixtureRepo();
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "prepared");
  assert.equal(ws.remote, "origin");
  assert.equal(ws.remoteVia, "branch-upstream");
  assert.equal(ws.branchState, "created");
  assert.equal(ws.storeDir, join(root, "backlog"));
  assert.equal(ws.configEvidence, "folder");
  assert.equal(ws.autoCommit, false);
  // Independent nested clone on the task branch.
  assert.ok(existsSync(join(root, "backlog", ".git")), "nested .git exists");
  assert.ok(statSyncIsDirectory(join(root, "backlog", ".git")), ".git is a directory, not a gitfile");
  assert.equal(git(join(root, "backlog"), "branch", "--show-current"), "prime-claw/tasks");
  assert.deepEqual(git(join(root, "backlog"), "remote"), "origin");
  // Ignored by the primary repository.
  assert.match(readFileSync(join(root, ".gitignore"), "utf8"), /^\/backlog\/$/m);
  assert.equal(tryGit(root, "check-ignore", "backlog").status, 0);
  // Main worktree untouched besides .gitignore; no code committed away.
  assert.equal(git(root, "branch", "--show-current"), "main");
  assert.equal(git(root, "status", "--porcelain"), "?? .gitignore");
  // Native Backlog auto-commit disabled in the clone.
  const config = readFileSync(join(root, "backlog", "config.yml"), "utf8");
  assert.match(config, /^auto_commit: false$/m);
  // Idempotent second run verifies rather than recreating.
  const second = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(second.status, "prepared");
  assert.equal(second.branchState, "verified");
  assert.equal(second.head, ws.head);
  assert.equal(readFileSync(join(root, ".gitignore"), "utf8").match(/^\/backlog\/$/gm).length, 1, "no duplicate ignore entry");
});

function statSyncIsDirectory(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

test("workspace preparation preserves existing folder configuration evidence", (t) => {
  if (!backlogAvailable()) { t.skip("managed backlog executable unavailable in this environment (tier-1 image ships none; host runs the repository dist)"); return; }
  const { root } = fixtureRepo();
  writeFolderConfig(root, ".backlog");
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "prepared");
  assert.equal(ws.storeDir, join(root, ".backlog"), "existing .backlog folder config selects the built-in .backlog location");
  assert.match(readFileSync(join(root, "backlog".replace("backlog", ".backlog"), "config.yml"), "utf8"), /project_name: "fixture"/);
  assert.match(readFileSync(join(root, ".gitignore"), "utf8"), /^\/\.backlog\/$/m);
});

test("workspace preparation blocks when the live store is a custom directory", () => {
  const { root } = fixtureRepo();
  // Native root-config evidence with a custom directory: the directory must
  // exist for detection to surface it as live Backlog evidence.
  mkdirSync(join(root, "tasks", "custom"), { recursive: true });
  writeFileSync(join(root, "backlog.config.yml"), `project_name: "fixture"\nbacklog_directory: "tasks/custom"\n`);
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "blocked");
  assert.equal(ws.code, "unsafe-store-location");
  assert.match(ws.remediation, /built-in backlog\/ or \.backlog\//);
});

test("workspace preparation blocks when the store directory has tracked code-repository content", () => {
  const { root } = fixtureRepo();
  mkdirSync(join(root, "backlog"), { recursive: true });
  writeFileSync(join(root, "backlog", "task.md"), "tracked\n");
  git(root, "add", "backlog/task.md");
  git(root, "commit", "-qm", "tracked task content");
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "blocked");
  assert.equal(ws.code, "uncommitted-task-content");
  assert.match(ws.remediation, /rm -r --cached/);
  assert.ok(!existsSync(join(root, "backlog", ".git")), "no clone created");
});

test("workspace preparation adopts a non-empty store directory without discarding content", (t) => {
  if (!backlogAvailable()) { t.skip("managed backlog executable unavailable in this environment (tier-1 image ships none; host runs the repository dist)"); return; }
  const { root } = fixtureRepo();
  mkdirSync(join(root, "backlog"), { recursive: true });
  writeFileSync(join(root, "backlog", "stray.txt"), "unowned\n");
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "prepared");
  // Adoption keeps existing content untracked (never discarded); the later
  // mutation loop owns committing it.
  assert.equal(readFileSync(join(root, "backlog", "stray.txt"), "utf8"), "unowned\n");
  assert.equal(git(join(root, "backlog"), "branch", "--show-current"), "prime-claw/tasks");
  const status = git(join(root, "backlog"), "status", "--porcelain");
  assert.match(status, /^\?\? stray\.txt$/m, "existing content stays untracked");
  // The adopted clone starts with an empty index: nothing is staged, so no
  // branch content is staged for deletion and no store file is staged for
  // commit; the later mutation loop owns the first task commit.
  assert.equal(git(join(root, "backlog"), "ls-files"), "", "empty index");
});

test("workspace preparation blocks for a linked worktree", () => {
  const { root } = fixtureRepo();
  const linked = join(root, "..", "linked");
  git(root, "worktree", "add", "-q", "--detach", linked);
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: linked });
  assert.equal(ws.status, "blocked");
  assert.equal(ws.code, "not-primary-checkout");
  assert.match(ws.remediation, /canonical primary checkout/);
  git(root, "worktree", "remove", "--force", linked);
});

test("workspace preparation surfaces remote-selection blocks", () => {
  const { root } = fixtureRepo({ bare: false });
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "blocked");
  assert.equal(ws.code, "no-remote");
  assert.ok(!existsSync(join(root, "backlog")), "nothing prepared");
  assert.equal(tryGit(root, "rev-parse", "--verify", TASK_HISTORY_REF).status !== 0, true, "no task branch created");
});

test("workspace preparation blocks when the selected provider is Beads", () => {
  const { root } = fixtureRepo();
  mkdirSync(join(root, ".beads"), { recursive: true });
  writeFileSync(join(root, ".beads", "config.yaml"), "# beads\n");
  writeFileSync(join(root, ".beads", "metadata.json"), JSON.stringify({ database: "dolt", backend: "dolt", dolt_mode: "embedded", dolt_database: "fixture_db" }));
  const ws = prepareTaskHistoryWorkspace({ primaryRoot: root });
  assert.equal(ws.status, "blocked");
  assert.equal(ws.code, "provider-not-backlog");
});
