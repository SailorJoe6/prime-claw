import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  isLegacyEpisodeOwnership,
  isTaskEpisodeOwnership,
  parseEpisodeOwnership,
  readEpisodeOwnership,
} from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";
import { reserveTaskEpisodeOwnership } from "../src/prime-agent-plugin/extension-support/task-episode-ownership.ts";

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function fixture({ extraStatusPath = false } = {}) {
  const rawRoot = mkdtempSync(join(tmpdir(), "prime-claw-task-ownership-"));
  execFileSync("git", ["init", "-q", rawRoot]);
  const root = realpathSync(rawRoot);
  git(root, "config", "user.name", "Prime Claw Test");
  git(root, "config", "user.email", "prime-claw@example.invalid");
  const relative = "backlog/tasks/primeclaw-10.38 - Task-native fixture.md";
  const taskPath = join(root, relative);
  mkdirSync(join(root, "backlog", "tasks"), { recursive: true });
  writeFileSync(taskPath, "status: In Planning\nplan: implement the exact bounded change\n");
  git(root, "add", "--", relative);
  git(root, "commit", "-q", "-m", "seed task");
  writeFileSync(taskPath, "status: In Progress\nplan: implement the exact bounded change\n");
  git(root, "add", "--", relative);
  if (extraStatusPath) {
    writeFileSync(join(root, "extra.txt"), "not part of task status\n");
    git(root, "add", "--", "extra.txt");
  }
  git(root, "commit", "-q", "-m", "admit exact task");
  const selection = {
    taskId: "PRIMECLAW-10.38",
    title: "Task-native fixture",
    status: "In Progress",
    implementationPlan: "1. Implement the exact bounded change.\n2. Verify it.",
    projectRoot: root,
    taskPath,
    taskPathRelative: relative,
  };
  return { root, relative, taskPath, selection };
}

function reserve(f, overrides = {}, dependencies = {}) {
  const { selection = {}, ...inputOverrides } = overrides;
  const resolved = { ...f.selection, ...selection };
  return reserveTaskEpisodeOwnership({
    projectRoot: f.root,
    taskId: f.selection.taskId,
    ownerSessionId: "owner-session",
    engine: "local",
    operationId: "operation-1234",
    ...inputOverrides,
  }, {
    taskResolver: () => resolved,
    now: () => "2026-10-13T08:00:00.000Z",
    ...dependencies,
  });
}

test("exact status commit becomes one durable task-native provisioning reservation before resources", () => {
  const f = fixture();
  const record = reserve(f);
  assert.equal(record.version, 2);
  assert.equal(record.status, "provisioning");
  assert.equal(record.taskId, "PRIMECLAW-10.38");
  assert.equal(record.taskPath, f.relative);
  assert.equal(record.baseRef, git(f.root, "rev-parse", "HEAD"));
  for (const removedAuthority of ["sourceLocation", "slug", "bundleDigest"]) assert.equal(record[removedAuthority], undefined);
  for (const futureResource of [
    "worktreeName", "worktreeId", "worktreeIdentity", "worktree", "branch", "head",
    "episodeId", "episodeSessionFile", "episodeActiveSessionId", "terminalHandle",
    "launchAutomationName", "launchAutomationId", "launchRunId",
  ]) assert.equal(record[futureResource], undefined);
  assert.deepEqual(readEpisodeOwnership(f.root), record);
  assert.equal(isTaskEpisodeOwnership(parseEpisodeOwnership(JSON.parse(readFileSync(join(f.root, ".prime-claw", "ownership.json"), "utf8")))), true);
});


test("reservation re-resolves the exact canonical task at the trusted boundary", () => {
  const f = fixture(); const calls = [];
  const record = reserve(f, {}, { taskResolver(cwd, taskId) { calls.push({ cwd, taskId }); return f.selection; } });
  assert.deepEqual(calls, [{ cwd: f.root, taskId: "PRIMECLAW-10.38" }]);
  assert.equal(record.taskId, "PRIMECLAW-10.38");

  const missing = fixture();
  assert.throws(() => reserve(missing, {}, { taskResolver: () => null }), /is unavailable/);
  assert.equal(readEpisodeOwnership(missing.root), null);
});


test("legacy and task-native ownership schemas coexist without mixing authority", () => {
  const legacy = parseEpisodeOwnership({
    version: 1, status: "provisioning", operationId: "legacy", engine: "local", ownerSessionId: "owner",
    sourceLocation: ".ralph/plans/future/alpha", slug: "alpha", baseRef: "base", bundleDigest: "0".repeat(64),
    createdAt: "x", updatedAt: "x",
  });
  assert.equal(isLegacyEpisodeOwnership(legacy), true);
  assert.throws(() => parseEpisodeOwnership({ ...legacy, version: 2, taskId: "PRIMECLAW-1", taskPath: "backlog/tasks/task.md" }), /unsupported shape/);
  const f = fixture(); const task = reserve(f);
  assert.throws(() => parseEpisodeOwnership({ ...task, sourceLocation: ".ralph/plans/future/alpha" }), /unsupported shape/);
  assert.throws(() => parseEpisodeOwnership({ ...task, baseRef: "not-a-status-commit" }), /unsupported shape/);
  assert.throws(() => parseEpisodeOwnership({ ...task, implementationPlan: "shadow authority" }), /unsupported shape/);
  assert.throws(() => parseEpisodeOwnership({ ...legacy, taskNotes: "shadow authority" }), /unsupported shape/);
  const activeTask = {
    ...task, status: "active", worktree: "/tmp/task-wt", branch: "task-episode", head: task.baseRef,
    episodeId: "episode", episodeSessionFile: "/tmp/episode.jsonl", episodeActiveSessionId: "route",
  };
  assert.equal(parseEpisodeOwnership(activeTask).episodeActiveSessionId, "route");
  assert.throws(() => parseEpisodeOwnership({ ...activeTask, episodeActiveSessionId: undefined }), /missing active bindings/);
  const activeOrca = { ...activeTask, engine: "orca", projectSetupId: "setup", worktreeId: "wt", worktreeIdentity: "identity", terminalHandle: "term" };
  assert.equal(parseEpisodeOwnership(activeOrca).terminalHandle, "term");
  assert.throws(() => parseEpisodeOwnership({ ...activeOrca, terminalHandle: undefined }), /missing active Orca bindings/);
});

for (const [name, selection, pattern] of [
  ["pre-admission status", { status: "In Planning" }, /committed as In Progress/],
  ["blank plan", { implementationPlan: "   " }, /meaningful Implementation Plan/],
  ["placeholder plan", { implementationPlan: "TBD" }, /meaningful Implementation Plan/],
  ["TODO-prefixed placeholder plan", { implementationPlan: "TODO: write implementation plan" }, /meaningful Implementation Plan/],
  ["multiline placeholder plan", { implementationPlan: "TBD\nTODO" }, /meaningful Implementation Plan/],
  ["Markdown-framed placeholder plan", { implementationPlan: "# Implementation Plan\nTBD" }, /meaningful Implementation Plan/],
  ["noncanonical task id", { taskId: "--bad" }, /canonical Backlog task ID/],
]) test(`${name} cannot reserve ownership`, () => {
  const f = fixture();
  assert.throws(() => reserve(f, { selection }), pattern);
  assert.equal(readEpisodeOwnership(f.root), null);
});

test("status commit containing another path cannot reserve ownership", () => {
  const f = fixture({ extraStatusPath: true });
  assert.throws(() => reserve(f), /only the exact Backlog task path/);
  assert.equal(readEpisodeOwnership(f.root), null);
});

test("task mutation after status commit cannot reserve ownership", () => {
  const f = fixture();
  writeFileSync(f.taskPath, "status: Blocked\nplan: changed after commit\n");
  assert.throws(() => reserve(f), /changed after its status commit/);
  assert.equal(readEpisodeOwnership(f.root), null);
});

test("non-terminal ownership blocks replay before a second reservation write", () => {
  const f = fixture(); const first = reserve(f);
  assert.throws(() => reserve(f), /inspect it instead of reserving again/);
  assert.deepEqual(readEpisodeOwnership(f.root), first);
});

test("Orca reservation binds exact placement without creating a resource", () => {
  const f = fixture();
  const writes = [];
  const ownership = { read: () => null, write(_root, record) { writes.push(structuredClone(record)); } };
  const record = reserveTaskEpisodeOwnership({
    projectRoot: f.root,
    taskId: f.selection.taskId,
    ownerSessionId: "owner-session",
    engine: "orca",
    projectSetupId: "setup-id",
    operationId: "operation-5678",
  }, { ownership, taskResolver: () => f.selection, now: () => "2026-10-13T08:00:00.000Z" });
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], record);
  assert.equal(record.projectSetupId, "setup-id");
  assert.equal(record.worktreeName, undefined);
  assert.equal(record.worktreeId, undefined);
  assert.equal(record.worktree, undefined);
});
