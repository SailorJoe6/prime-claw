import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, lstatSync, readlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { ProcessCommandRunner, episodeWorktreeActivity } from "../src/prime-agent-plugin/extension-support/project-initialization.ts";
import { initialTaskStoreConfig, TASK_HISTORY_REF } from "../src/prime-agent-plugin/extension-support/task-history-workspace.ts";
import { createProjectInitializationExtension } from "../src/prime-agent-plugin/extensions/project-initialization.ts";
import { writeEpisodeOwnership, readEpisodeOwnership } from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";
import { handoffTaskEpisode } from "../src/prime-agent-plugin/extension-support/spec-episode.ts";

// Docker-only pytest entry point below uses the image's pinned native Backlog CLI.
const PLUGIN = resolve("src/prime-agent-plugin");
const BACKLOG = "/usr/local/bin/backlog";
const TASK_HISTORY_BRANCH = TASK_HISTORY_REF.replace(/^refs\/heads\//, "");
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const backlog = (cwd, ...args) => execFileSync(BACKLOG, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
function init(root) {
  mkdirSync(root, { recursive: true });
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "Disposable Test");
  git(root, "config", "user.email", "test@example.invalid");
}
function fixture(t, { layout = "backlog", independent = false, provider = "backlog", status = "active", unrelated = false } = {}) {
  const outer = mkdtempSync(join(tmpdir(), "pc44-active-init-"));
  t.after(() => rmSync(outer, { recursive: true, force: true }));
  const root = join(outer, "repo"), remote = join(outer, "remote.git"), episode = join(outer, "episode");
  init(root);
  execFileSync("git", ["init", "-q", "--bare", remote]);
  git(root, "remote", "add", "origin", remote);
  writeFileSync(join(root, "README.md"), "original code\n");
  const config = initialTaskStoreConfig("active-init-fixture") + (layout.includes("/") ? `backlog_directory: "${layout}"\n` : "");
  const store = join(root, layout);
  if (independent) {
    const seed = join(outer, "seed"); init(seed);
    writeFileSync(join(seed, "config.yml"), config);
    git(seed, "add", "."); git(seed, "commit", "-qm", "disconnected native task history");
    git(seed, "branch", "-m", TASK_HISTORY_BRANCH);
    git(seed, "remote", "add", "origin", remote);
    git(seed, "push", "-qu", "origin", TASK_HISTORY_BRANCH);
    mkdirSync(join(store, ".."), { recursive: true });
    execFileSync("git", ["clone", "-q", "--branch", TASK_HISTORY_BRANCH, remote, store]);
    git(store, "config", "user.name", "Disposable Test"); git(store, "config", "user.email", "test@example.invalid");
    writeFileSync(join(root, ".gitignore"), `/${layout}/\n`);
  } else {
    mkdirSync(join(store, "tasks"), { recursive: true });
    writeFileSync(join(store, "config.yml"), config);
  }
  if (layout.includes("/")) writeFileSync(join(root, "backlog.config.yml"), config);
  const output = backlog(root, "task", "create", "Active task", "--status", "In Progress", "--description", "Approved bounded work", "--plan", "1. Implement the bounded change.\n2. Verify exact results.", "--no-dod-defaults", "--plain");
  const id = output.match(/TASK-\d+/i)?.[0];
  assert.ok(id, `native task create did not return an ID: ${output}`);
  const view = cwd => JSON.parse(backlog(cwd, "task", "view", "--json", "--", id));
  const task = view(root);
  assert.ok(task.task.path.startsWith(`${layout}/tasks/`), JSON.stringify(task));
  if (independent) {
    git(store, "add", "."); git(store, "commit", "-qm", "publish active task"); git(store, "push", "-q");
  }
  git(root, "add", "."); git(root, "commit", "-qm", "original task layout"); git(root, "push", "-qu", "origin", "main");
  git(root, "worktree", "add", "-qb", "episode", episode); git(episode, "push", "-qu", "origin", "episode");
  const head = git(root, "rev-parse", "HEAD");
  const record = {
    version: 2, ...(provider ? { provider } : {}), status, operationId: "fixture-operation", engine: "local", ownerSessionId: "fixture-owner",
    taskId: task.task.id, taskPath: unrelated ? `${layout}-other/tasks/unrelated.md` : task.task.path, baseRef: head, head,
    createdAt: "2026-10-30T00:00:00Z", updatedAt: "2026-10-30T00:00:00Z", worktree: episode, branch: "episode",
    episodeId: "fixture-episode", episodeSessionFile: join(outer, "session.jsonl"), episodeActiveSessionId: "fixture-runtime",
  };
  if (independent) Object.assign(record, { providerRevision: git(store, "rev-parse", "HEAD"), taskEvidence: task });
  if (provider === "beads") {
    delete record.taskPath;
    Object.assign(record, { taskId: "fixture-beads", providerRevision: "a".repeat(32), taskEvidence: { id: "fixture-beads", title: "Unrelated Beads owner", status: "in_progress" } });
  }
  writeFileSync(record.episodeSessionFile, "{}\n");
  writeEpisodeOwnership(root, record);
  // Warm Git's stat cache before the exact index-byte preservation assertion.
  git(root, "status", "--porcelain");
  if (independent) git(store, "status", "--porcelain");
  const commands = [];
  const native = new ProcessCommandRunner();
  const runner = { run(command, args, options = {}) {
    commands.push([command, ...args]);
    if (command === "orca") {
      assert.deepEqual(args, ["repo", "list", "--json"], "reconcile must not contact an Orca runtime");
      return { stdout: JSON.stringify({ result: { repos: [{ id: "fixture", path: root, displayName: "fixture" }] } }), stderr: "", status: 0 };
    }
    return native.run(command === "backlog" ? BACKLOG : command, args, options);
  } };
  let tool;
  createProjectInitializationExtension({ pluginRoot: PLUGIN, home: outer, runner })({ registerTool(value) { tool = value; }, on() {} });
  assert.equal(tool.name, "initialize_prime_claw");
  const reconcile = async () => {
    const action = await tool.execute("disposable-regression", { action: "reconcile" }, undefined, undefined, { cwd: root });
    assert.notEqual(action.isError, true, JSON.stringify(action));
    return action.details;
  };
  return { root, remote, episode, store, record, view, reconcile, commands, independent, layout };
}
function entry(path) {
  if (!existsSync(path)) return null;
  if (lstatSync(path).isSymbolicLink()) return { link: readlinkSync(path) };
  return readFileSync(path).toString("base64");
}
function nativeTree(root, relative = "") {
  return readdirSync(join(root, relative)).sort().filter(name => name !== ".git").flatMap(name => {
    const path = join(relative, name), absolute = join(root, path);
    return lstatSync(absolute).isDirectory() ? nativeTree(root, path) : [[path, entry(absolute)]];
  });
}
function snapshot(f) {
  return {
    owner: entry(join(f.root, ".prime-claw", "ownership.json")),
    index: entry(join(f.root, ".git", "index")), head: git(f.root, "rev-parse", "HEAD"),
    tracked: git(f.root, "ls-files", "--stage"), store: nativeTree(f.store),
    ignore: entry(join(f.root, ".gitignore")), rootConfig: entry(join(f.root, "backlog.config.yml")),
    refs: git(f.root, "for-each-ref", "--format=%(refname) %(objectname)"),
    published: git(f.root, "ls-remote", "--heads", f.remote),
    task: f.view(f.root),
    nestedGit: existsSync(join(f.store, ".git")) ? {
      head: git(f.store, "rev-parse", "HEAD"), index: entry(join(f.store, ".git", "index")),
      refs: git(f.store, "for-each-ref", "--format=%(refname) %(objectname)"), status: git(f.store, "status", "--porcelain"),
    } : null,
  };
}
async function reachesOrdinaryHandoffPublisher(f) {
  let reached = 0, closed = 0;
  const sentinel = new Error("DISPOSABLE PUBLISHER SENTINEL: no runtime contact");
  await assert.rejects(handoffTaskEpisode(f.record.taskId, "", {
    cwd: f.root, sessionManager: { getSessionId: () => f.record.ownerSessionId, getHeader: () => ({ rlmDepth: 0 }) },
  }, { publisher: { list() { reached++; throw sentinel; }, close() { closed++; } } }), error => error === sentinel,
  "ordinary handoff must pass exact main/Episode task path, status, plan and Git validation");
  assert.equal(reached, 1); assert.equal(closed, 1);
}

for (const scenario of [
  { label: "provider-absent ordinary backlog", provider: null },
  { label: "explicit Backlog ordinary backlog", provider: "backlog" },
  { label: "ordinary hidden same-path authority", layout: ".backlog" },
  { label: "ordinary custom same-path authority", layout: "planning/task-store" },
  { label: "provisioning owner", status: "provisioning" },
  { label: "uncertain owner", status: "uncertain" },
  { label: "published independent backlog relocation", independent: true },
]) {
  test(`primary reconcile preserves affected ${scenario.label} before adoption`, async t => {
    const f = fixture(t, scenario);
    assert.equal(episodeWorktreeActivity(f.root, "primary"), "inactive", "primary must exercise provider preparation, not the Episode skip");
    if (!f.independent) assert.equal(f.view(f.episode).task.path, f.record.taskPath);
    if (!f.independent && f.record.status === "active") await reachesOrdinaryHandoffPublisher(f);
    const before = snapshot(f);
    const result = await f.reconcile();
    assert.equal(result.skippedActiveEpisode, false);
    assert.equal(result.taskProvider.status, "blocked", JSON.stringify(result.taskProvider));
    assert.equal(result.taskProvider.code, "task-history");
    assert.ok(result.taskProvider.detail.startsWith("unsafe-store-location:"), result.taskProvider.detail);
    for (const exact of [f.record.ownerSessionId, f.record.taskId, f.record.taskPath]) {
      assert.ok(result.taskProvider.detail.includes(exact), `refusal must identify exact binding ${exact}: ${result.taskProvider.detail}`);
    }
    assert.match(result.taskProvider.detail, f.layout === "backlog" ? /relocate its exact task path/ : /detach its existing task authority/);
    assert.match(result.taskProvider.remediation, /leave this store and ownership binding unchanged/);
    assert.match(result.taskProvider.remediation, /existing lifecycle/);
    assert.deepEqual(snapshot(f), before, "blocked adoption must preserve store, task, owner, code index/HEAD and local/remote publication refs");
    assert.deepEqual(readEpisodeOwnership(f.root, f.record.ownerSessionId), f.record);
    assert.equal(existsSync(join(f.root, ".backlog")), f.layout === ".backlog", "refusal must not create a relocated destination");
    assert.equal(f.commands.some(([command, ...args]) => command === "git" && args.some(arg => ["subtree", "clone", "push", "fetch", "update-ref"].includes(arg))), false,
      "refusal must precede task history extraction/publication/clone operations");
    if (!f.independent && f.record.status === "active") {
      assert.equal(f.view(f.episode).task.path, f.record.taskPath);
      await reachesOrdinaryHandoffPublisher(f);
      assert.deepEqual(readEpisodeOwnership(f.root, f.record.ownerSessionId), f.record);
    }
  });
}

for (const scenario of [
  { label: "inactive exact-path owner", status: "inactive" },
  { label: "unrelated path-prefix owner", unrelated: true },
  { label: "Beads owner", provider: "beads" },
  { label: "active published hidden clone", independent: true, layout: ".backlog" },
  { label: "active published custom clone", independent: true, layout: "planning/task-store" },
]) {
  test(`primary reconcile does not blanket-ban ${scenario.label}`, async t => {
    const f = fixture(t, scenario);
    const owner = entry(join(f.root, ".prime-claw", "ownership.json"));
    const before = f.view(f.root).task;
    const result = await f.reconcile();
    assert.equal(result.skippedActiveEpisode, false);
    assert.equal(result.taskProvider.status, "selected", JSON.stringify(result.taskProvider));
    assert.equal(result.taskProvider.provider, "backlog");
    assert.ok(result.taskProvider.taskHistoryHead, "unaffected store must retain real published task authority");
    assert.equal(entry(join(f.root, ".prime-claw", "ownership.json")), owner);
    const after = f.view(f.root).task;
    assert.equal(after.id, before.id); assert.equal(after.status, before.status);
    assert.equal(after.path, scenario.independent ? before.path : before.path.replace(/^backlog\//, ".backlog/"));
    assert.equal(git(join(f.root, scenario.independent ? f.layout : ".backlog"), "rev-parse", "HEAD"), result.taskProvider.taskHistoryHead);
    assert.match(git(f.root, "ls-remote", "--heads", f.remote, TASK_HISTORY_REF), new RegExp(`^${result.taskProvider.taskHistoryHead}\\s`));
  });
}
