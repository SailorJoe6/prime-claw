import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import test from "node:test";

import {
  isLegacyEpisodeOwnership,
  isTaskEpisodeOwnership,
  parseEpisodeOwnership,
  parseEpisodeOwnershipRegistry,
  readAllEpisodeOwnership,
  readEpisodeOwnership,
  readEpisodeOwnershipRegistry,
  writeEpisodeOwnership,
} from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";
import {
  CliLegacyTaskOwnershipTransitionGit,
  reserveTaskEpisodeOwnership,
  transitionLegacyEpisodeOwnershipToTask,
} from "../src/prime-agent-plugin/extension-support/task-episode-ownership.ts";

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

function taskOwnership(ownerSessionId, taskId, taskPath = `backlog/tasks/${taskId}.md`) {
  return parseEpisodeOwnership({
    version: 2,
    status: "provisioning",
    operationId: `operation-${ownerSessionId}`,
    engine: "local",
    ownerSessionId,
    taskId,
    taskPath,
    baseRef: "a".repeat(40),
    createdAt: "2026-10-18T12:00:00.000Z",
    updatedAt: "2026-10-18T12:00:00.000Z",
  });
}

function legacyOwnership(ownerSessionId, sourceLocation) {
  const slug = sourceLocation.split("/").at(-1);
  return parseEpisodeOwnership({
    version: 1,
    status: "provisioning",
    operationId: `operation-${ownerSessionId}`,
    engine: "local",
    ownerSessionId,
    sourceLocation,
    slug,
    bundleDigest: "b".repeat(64),
    baseRef: "main",
    createdAt: "2026-10-18T12:00:00.000Z",
    updatedAt: "2026-10-18T12:00:00.000Z",
  });
}

function transitionFixture() {
  const rawRoot = mkdtempSync(join(tmpdir(), "prime-claw-transition-main-"));
  execFileSync("git", ["init", "-q", "-b", "main", rawRoot]);
  const root = realpathSync(rawRoot);
  const remote = mkdtempSync(join(tmpdir(), "prime-claw-transition-remote-"));
  execFileSync("git", ["init", "-q", "--bare", remote]);
  git(root, "remote", "add", "origin", remote);
  git(root, "config", "user.name", "Prime Claw Test");
  git(root, "config", "user.email", "prime-claw@example.invalid");
  const relative = "backlog/tasks/primeclaw-10.38 - Transition fixture.md";
  mkdirSync(join(root, "backlog", "tasks"), { recursive: true });
  writeFileSync(join(root, relative), "status: In Planning\nplan: implement transition fixture\n");
  git(root, "add", relative);
  git(root, "commit", "-q", "-m", "seed transition fixture");
  writeFileSync(join(root, relative), "status: In Progress\nplan: implement transition fixture\n");
  git(root, "add", "--", relative);
  git(root, "commit", "-q", "-m", "admit exact transition task");
  const baseRef = git(root, "rev-parse", "HEAD");
  git(root, "push", "-q", "-u", "origin", "main");
  const legacyHeadRoot = join(mkdtempSync(join(tmpdir(), "prime-claw-transition-legacy-head-")), "legacy");
  execFileSync("git", ["-C", root, "worktree", "add", "-q", "-b", "legacy-promotion", legacyHeadRoot, baseRef]);
  writeFileSync(join(legacyHeadRoot, "legacy-promotion.txt"), "historical promotion head\n");
  git(legacyHeadRoot, "add", "legacy-promotion.txt");
  git(legacyHeadRoot, "commit", "-q", "-m", "historical legacy promotion");
  const legacyHead = git(legacyHeadRoot, "rev-parse", "HEAD");
  execFileSync("git", ["-C", root, "worktree", "remove", "-f", legacyHeadRoot]);

  const episodeRaw = mkdtempSync(join(tmpdir(), "prime-claw-transition-episode-parent-"));
  const episodeRoot = join(episodeRaw, "episode");
  execFileSync("git", ["-C", root, "worktree", "add", "-q", "-b", "episode-transition", episodeRoot, baseRef]);
  mkdirSync(join(episodeRoot, ".ralph", "plans"), { recursive: true });
  writeFileSync(join(episodeRoot, ".ralph", "plans", "SPECIFICATION.md"), "Superseded by PRIMECLAW-10.38\n");
  writeFileSync(join(episodeRoot, ".ralph", "plans", "EXECUTION_PLAN.md"), "Complete bridge candidate plan\n");
  writeFileSync(join(episodeRoot, relative), "status: In Progress\nplan: complete bridge candidate with evidence\n");
  git(episodeRoot, "add", ".ralph/plans/SPECIFICATION.md", ".ralph/plans/EXECUTION_PLAN.md", relative);
  git(episodeRoot, "commit", "-q", "-m", "bridge candidate");
  const episodeHead = git(episodeRoot, "rev-parse", "HEAD");
  git(episodeRoot, "push", "-q", "-u", "origin", "episode-transition");
  git(root, "merge", "-q", "--no-ff", "episode-transition", "-m", "merge bridge candidate");
  const mainHead = git(root, "rev-parse", "HEAD");
  git(root, "push", "-q", "origin", "main");

  const transcript = join(mkdtempSync(join(tmpdir(), "prime-claw-transition-session-")), "episode.jsonl");
  writeFileSync(transcript, "{\"session\":\"episode\"}\n");
  const legacy = {
    version: 1, status: "active", operationId: "operation-transition", engine: "local", ownerSessionId: "owner-session",
    sourceLocation: ".ralph/plans/future/replace-ralph-plans-with-backlog", slug: "replace-ralph-plans-with-backlog",
    baseRef, bundleDigest: "a".repeat(64), createdAt: "2026-10-13T08:00:00.000Z", updatedAt: "2026-10-14T08:00:00.000Z",
    worktreeName: "episode-transition", worktree: realpathSync(episodeRoot), branch: "episode-transition", head: legacyHead,
    episodeId: "episode-id", episodeSessionFile: transcript, episodeActiveSessionId: "active-session-id",
  };
  writeEpisodeOwnership(root, legacy);
  const selection = {
    taskId: "PRIMECLAW-10.38", title: "Transition fixture", status: "In Progress",
    implementationPlan: "Complete bridge candidate plan",
    references: ["legacy-episode-source=.ralph/plans/future/replace-ralph-plans-with-backlog; superseded-by=PRIMECLAW-10.38"], projectRoot: root,
    taskPath: realpathSync(join(root, relative)), taskPathRelative: relative,
  };
  return { root, relative, episodeRoot: realpathSync(episodeRoot), baseRef, legacyHead, episodeHead, mainHead, transcript, legacy, selection };
}

function transition(f, overrides = {}, dependencies = {}) {
  return transitionLegacyEpisodeOwnershipToTask({
    projectRoot: f.root,
    sourceLocation: f.legacy.sourceLocation,
    taskId: f.selection.taskId,
    ownerSessionId: f.legacy.ownerSessionId,
    expectedMainHead: f.mainHead,
    expectedEpisodeHead: f.episodeHead,
    expectedPreviousEpisodeActiveSessionId: f.legacy.episodeActiveSessionId,
    verifiedCurrentEpisodeActiveSessionId: f.legacy.episodeActiveSessionId,
    confirmedReady: true,
    ...overrides,
  }, {
    taskResolver: () => f.selection,
    now: () => "2026-10-14T09:00:00.000Z",
    ...dependencies,
  });
}

test("guarded transition replaces only the exact owner's legacy authority and preserves other owners", () => {
  const f = transitionFixture();
  const other = taskOwnership("other-owner", "PRIMECLAW-10.39");
  writeEpisodeOwnership(f.root, other);
  assert.equal(new CliLegacyTaskOwnershipTransitionGit().status(f.root), "?? .prime-claw/ownership.json");
  assert.throws(() => execFileSync("git", ["-C", f.root, "merge-base", "--is-ancestor", f.legacyHead, f.episodeHead], { stdio: "ignore" }));
  const result = transition(f);
  assert.equal(result.reused, false);
  assert.equal(result.mainHead, f.mainHead);
  assert.equal(result.episodeHead, f.episodeHead);
  assert.match(result.activeSpecification.blob, /^[0-9a-f]{40}$/);
  assert.match(result.activeImplementationPlan.blob, /^[0-9a-f]{40}$/);
  assert.equal(result.record.version, 2);
  assert.equal(result.record.taskId, f.selection.taskId);
  assert.equal(result.record.taskPath, f.relative);
  assert.equal(result.record.updatedAt, "2026-10-14T09:00:00.000Z");
  for (const removed of ["sourceLocation", "slug", "bundleDigest"]) assert.equal(result.record[removed], undefined);
  for (const preserved of [
    "status", "operationId", "engine", "ownerSessionId", "baseRef", "createdAt", "worktreeName",
    "worktree", "branch", "head", "episodeId", "episodeSessionFile", "episodeActiveSessionId",
  ]) assert.deepEqual(result.record[preserved], f.legacy[preserved]);
  assert.deepEqual(readEpisodeOwnership(f.root, f.legacy.ownerSessionId), result.record);
  assert.deepEqual(readEpisodeOwnership(f.root, "other-owner"), other);

  const replay = transition(f);
  assert.equal(replay.reused, true);
  assert.deepEqual(replay.record, result.record);
  assert.throws(() => transition(f, { sourceLocation: ".ralph/plans/future/different" }), /superseded legacy source binding/);
});

test("guarded transition atomically replaces an obsolete runtime route with the verified current route", () => {
  const f = transitionFixture();
  const currentRoute = "current-active-session-id";
  assert.throws(() => transition(f, {
    expectedPreviousEpisodeActiveSessionId: "foreign-previous-route",
    verifiedCurrentEpisodeActiveSessionId: currentRoute,
  }), /previous runtime route drifted/);
  assert.deepEqual(readEpisodeOwnership(f.root), f.legacy);

  const result = transition(f, { verifiedCurrentEpisodeActiveSessionId: currentRoute });
  assert.equal(result.record.episodeActiveSessionId, currentRoute);
  for (const preserved of [
    "status", "operationId", "engine", "ownerSessionId", "baseRef", "createdAt", "worktreeName",
    "worktree", "branch", "head", "episodeId", "episodeSessionFile",
  ]) assert.deepEqual(result.record[preserved], f.legacy[preserved]);
  assert.deepEqual(readEpisodeOwnership(f.root), result.record);

  const replay = transition(f, { verifiedCurrentEpisodeActiveSessionId: currentRoute });
  assert.equal(replay.reused, true);
  assert.deepEqual(replay.record, result.record);
});

test("guarded transition requires explicit readiness, exact owner, and exact bindings", () => {
  const unconfirmed = transitionFixture();
  assert.throws(() => transition(unconfirmed, { confirmedReady: false }), /explicit confirmation/);
  assert.deepEqual(readEpisodeOwnership(unconfirmed.root), unconfirmed.legacy);

  const foreign = transitionFixture();
  assert.throws(() => transition(foreign, { ownerSessionId: "foreign-owner" }), /ownership is missing/);
  assert.deepEqual(readEpisodeOwnership(foreign.root), foreign.legacy);

  const sourceDrift = transitionFixture();
  assert.throws(() => transition(sourceDrift, { sourceLocation: ".ralph/plans/future/different" }), /does not match active ownership/);
  assert.deepEqual(readEpisodeOwnership(sourceDrift.root), sourceDrift.legacy);

  const headDrift = transitionFixture();
  assert.throws(() => transition(headDrift, { expectedEpisodeHead: headDrift.baseRef }), /Episode HEAD or upstream drifted/);
  assert.deepEqual(readEpisodeOwnership(headDrift.root), headDrift.legacy);

  const mainHeadMismatch = transitionFixture();
  assert.throws(() => transition(mainHeadMismatch, { expectedMainHead: mainHeadMismatch.baseRef }), /Canonical main HEAD or upstream drifted/);
  assert.deepEqual(readEpisodeOwnership(mainHeadMismatch.root), mainHeadMismatch.legacy);

  const upstreamMismatch = transitionFixture();
  const baseGit = new CliLegacyTaskOwnershipTransitionGit();
  const gitProxy = new Proxy(baseGit, { get(target, property) {
    if (property === "upstreamHead") return (repo) => repo === upstreamMismatch.root ? upstreamMismatch.baseRef : target.upstreamHead(repo);
    const value = target[property];
    return typeof value === "function" ? value.bind(target) : value;
  } });
  assert.throws(() => transition(upstreamMismatch, {}, { git: gitProxy }), /Canonical main HEAD or upstream drifted/);
  assert.deepEqual(readEpisodeOwnership(upstreamMismatch.root), upstreamMismatch.legacy);
});

test("guarded transition allows unrelated untracked canonical-main paths", () => {
  const f = transitionFixture();
  writeFileSync(join(f.root, "unrelated-untracked.txt"), "unrelated\n");
  assert.match(new CliLegacyTaskOwnershipTransitionGit().status(f.root), /\?\? unrelated-untracked\.txt/);
  const result = transition(f);
  assert.equal(result.record.version, 2);
  assert.equal(result.record.taskId, f.selection.taskId);
});

test("guarded transition fails closed on staged or tracked state, missing evidence, and unsafe ancestry", () => {
  const trackedMain = transitionFixture();
  writeFileSync(join(trackedMain.root, trackedMain.relative), "tracked drift\n");
  assert.throws(() => transition(trackedMain), /staged or tracked working-tree changes/);
  assert.deepEqual(readEpisodeOwnership(trackedMain.root), trackedMain.legacy);

  const stagedMain = transitionFixture();
  writeFileSync(join(stagedMain.root, "staged.txt"), "staged\n");
  git(stagedMain.root, "add", "staged.txt");
  assert.throws(() => transition(stagedMain), /staged or tracked working-tree changes/);
  assert.deepEqual(readEpisodeOwnership(stagedMain.root), stagedMain.legacy);

  const dirtyEpisode = transitionFixture();
  writeFileSync(join(dirtyEpisode.episodeRoot, "dirty.txt"), "dirty\n");
  assert.throws(() => transition(dirtyEpisode), /Episode worktree is dirty/);
  assert.deepEqual(readEpisodeOwnership(dirtyEpisode.root), dirtyEpisode.legacy);

  const missingSession = transitionFixture();
  unlinkSync(missingSession.transcript);
  assert.throws(() => transition(missingSession), /session transcript/);
  assert.deepEqual(readEpisodeOwnership(missingSession.root), missingSession.legacy);

  const unsafe = transitionFixture();
  const baseGit = new CliLegacyTaskOwnershipTransitionGit();
  const gitProxy = new Proxy(baseGit, { get(target, property) {
    if (property === "isAncestor") return () => false;
    const value = target[property];
    return typeof value === "function" ? value.bind(target) : value;
  } });
  assert.throws(() => transition(unsafe, {}, { git: gitProxy }), /ancestry is unsafe/);
  assert.deepEqual(readEpisodeOwnership(unsafe.root), unsafe.legacy);
});

test("guarded transition rejects merge, rebase, cherry-pick, and revert state", () => {
  for (const marker of ["MERGE_HEAD", "rebase-merge", "CHERRY_PICK_HEAD", "REVERT_HEAD", "sequencer"]) {
    const f = transitionFixture();
    const markerPath = resolve(f.root, git(f.root, "rev-parse", "--git-path", marker));
    if (marker.startsWith("rebase-") || marker === "sequencer") mkdirSync(markerPath, { recursive: true });
    else writeFileSync(markerPath, `${f.mainHead}\n`);
    const adapter = new CliLegacyTaskOwnershipTransitionGit();
    assert.equal(adapter.operationInProgress(f.root), true, marker);
    assert.throws(() => transition(f), /merge, rebase, cherry-pick, or revert in progress/, marker);
    assert.deepEqual(readEpisodeOwnership(f.root), f.legacy, marker);
  }
});

test("guarded transition requires the complete task plan to equal the active execution plan", () => {
  const f = transitionFixture();
  assert.throws(() => transition(f, {}, { taskResolver: () => ({ ...f.selection, implementationPlan: "stale partial plan" }) }), /does not exactly match/);
  assert.deepEqual(readEpisodeOwnership(f.root), f.legacy);
});

test("guarded transition detects ownership drift before its sole write", () => {
  const f = transitionFixture();
  let reads = 0, writes = 0;
  const ownership = {
    read() { reads += 1; return reads === 1 ? f.legacy : { ...f.legacy, updatedAt: "concurrent-drift" }; },
    write() { writes += 1; },
  };
  assert.throws(() => transition(f, {}, { ownership }), /changed during transition validation/);
  assert.equal(writes, 0);
});

test("guarded transition rechecks operation state before its sole write", () => {
  const f = transitionFixture();
  const baseGit = new CliLegacyTaskOwnershipTransitionGit();
  let operationChecks = 0, writes = 0;
  const gitProxy = new Proxy(baseGit, { get(target, property) {
    if (property === "operationInProgress") return () => ++operationChecks === 2;
    const value = target[property];
    return typeof value === "function" ? value.bind(target) : value;
  } });
  const ownership = {
    read() { return structuredClone(f.legacy); },
    write() { writes += 1; },
  };
  assert.throws(() => transition(f, {}, { git: gitProxy, ownership }), /Git state changed during ownership transition validation/);
  assert.equal(operationChecks, 2);
  assert.equal(writes, 0);
});

test("guarded transition fails cleanly when an atomic write leaves the exact old record", () => {
  const f = transitionFixture();
  const ownership = {
    read() { return structuredClone(f.legacy); },
    write() { throw new Error("pre-rename interruption"); },
  };
  assert.throws(() => transition(f, {}, { ownership }), /did not complete atomically/);
  assert.deepEqual(ownership.read(), f.legacy);
});

test("guarded transition treats an atomic write that completed before an error as success", () => {
  const f = transitionFixture();
  let current = f.legacy;
  const ownership = {
    read() { return structuredClone(current); },
    write(_root, record) { current = structuredClone(record); throw new Error("post-rename interruption"); },
  };
  const result = transition(f, {}, { ownership });
  assert.equal(result.reused, false);
  assert.equal(result.record.version, 2);
  assert.equal(current.taskId, f.selection.taskId);
});

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
  assert.deepEqual(readEpisodeOwnership(f.root, "owner-session"), record);
  const registry = parseEpisodeOwnershipRegistry(JSON.parse(readFileSync(join(f.root, ".prime-claw", "ownership.json"), "utf8")));
  assert.equal(isTaskEpisodeOwnership(registry.owners["owner-session"]), true);
});


test("legacy direct ownership is migration input and the next write preserves it in the registry", () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-ownership-migration-"));
  const legacy = legacyOwnership("legacy-owner", ".ralph/plans/future/legacy-source");
  mkdirSync(join(root, ".prime-claw"), { recursive: true });
  writeFileSync(join(root, ".prime-claw", "ownership.json"), `${JSON.stringify(legacy, null, 2)}
`);

  assert.deepEqual(readEpisodeOwnership(root, "legacy-owner"), legacy);
  const task = taskOwnership("task-owner", "PRIMECLAW-43");
  writeEpisodeOwnership(root, task);

  const raw = JSON.parse(readFileSync(join(root, ".prime-claw", "ownership.json"), "utf8"));
  assert.equal(raw.schemaVersion, 1);
  assert.deepEqual(Object.keys(raw.owners), ["legacy-owner", "task-owner"]);
  assert.deepEqual(readEpisodeOwnership(root, "legacy-owner"), legacy);
  assert.deepEqual(readEpisodeOwnership(root, "task-owner"), task);
  assert.throws(() => readEpisodeOwnership(root), /exact ownerSessionId is required/);
});

test("one Conversation cannot replace a different active Episode", () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-owner-cardinality-"));
  const first = taskOwnership("same-owner", "PRIMECLAW-43");
  writeEpisodeOwnership(root, first);
  assert.throws(
    () => writeEpisodeOwnership(root, taskOwnership("same-owner", "PRIMECLAW-10.39")),
    /already owns a different active Episode/,
  );
  assert.deepEqual(readEpisodeOwnership(root, "same-owner"), first);
});

test("active task and retained-source bindings stay unique across Conversations", () => {
  const taskRoot = mkdtempSync(join(tmpdir(), "prime-claw-task-collision-"));
  writeEpisodeOwnership(taskRoot, taskOwnership("owner-a", "PRIMECLAW-43", "backlog/tasks/43.md"));
  assert.throws(
    () => writeEpisodeOwnership(taskRoot, taskOwnership("owner-b", "PRIMECLAW-43", "backlog/tasks/other.md")),
    /task Episode binding collides/,
  );
  assert.throws(
    () => writeEpisodeOwnership(taskRoot, taskOwnership("owner-b", "PRIMECLAW-99", "backlog/tasks/43.md")),
    /task Episode binding collides/,
  );

  const sourceRoot = mkdtempSync(join(tmpdir(), "prime-claw-source-collision-"));
  const location = ".ralph/plans/future/shared-source";
  writeEpisodeOwnership(sourceRoot, legacyOwnership("owner-a", location));
  assert.throws(
    () => writeEpisodeOwnership(sourceRoot, legacyOwnership("owner-b", location)),
    /retained source binding collides/,
  );
});

test("serialized different-Conversation writes retain both reservations", async () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-ownership-concurrency-"));
  const moduleUrl = new URL("../src/prime-agent-plugin/extension-support/episode-ownership.ts", import.meta.url).href;
  const records = [
    taskOwnership("owner-a", "PRIMECLAW-43"),
    taskOwnership("owner-b", "PRIMECLAW-10.39"),
  ];
  const runWriter = (record) => new Promise((resolvePromise, rejectPromise) => {
    const code = `import { writeEpisodeOwnership } from ${JSON.stringify(moduleUrl)}; writeEpisodeOwnership(${JSON.stringify(root)}, ${JSON.stringify(record)});`;
    const child = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "--eval", code], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", rejectPromise);
    child.once("exit", (codeValue) => codeValue === 0 ? resolvePromise() : rejectPromise(new Error(stderr)));
  });

  await Promise.all(records.map(runWriter));
  assert.deepEqual(readAllEpisodeOwnership(root).map((record) => record.ownerSessionId), ["owner-a", "owner-b"]);
  assert.deepEqual(readEpisodeOwnershipRegistry(root).owners["owner-a"], records[0]);
  assert.deepEqual(readEpisodeOwnershipRegistry(root).owners["owner-b"], records[1]);
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

test("different Conversations reserve different tasks in one repository", () => {
  const f = fixture();
  const first = reserve(f, { ownerSessionId: "owner-a" });

  const secondId = "PRIMECLAW-10.39";
  const secondRelative = "backlog/tasks/primeclaw-10.39 - Second fixture.md";
  const secondPath = join(f.root, secondRelative);
  writeFileSync(secondPath, "status: In Planning\nplan: implement the second bounded change\n");
  git(f.root, "add", "--", secondRelative);
  git(f.root, "commit", "-q", "-m", "seed second task");
  writeFileSync(secondPath, "status: In Progress\nplan: implement the second bounded change\n");
  git(f.root, "add", "--", secondRelative);
  git(f.root, "commit", "-q", "-m", "admit second task");
  const secondSelection = {
    ...f.selection,
    taskId: secondId,
    title: "Second task-native fixture",
    taskPath: secondPath,
    taskPathRelative: secondRelative,
  };
  const second = reserve(f, {
    taskId: secondId,
    ownerSessionId: "owner-b",
    selection: secondSelection,
    operationId: "operation-second",
  });

  assert.equal(first.ownerSessionId, "owner-a");
  assert.equal(second.ownerSessionId, "owner-b");
  assert.deepEqual(readAllEpisodeOwnership(f.root).map((record) => record.taskId), ["PRIMECLAW-10.38", "PRIMECLAW-10.39"]);
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
