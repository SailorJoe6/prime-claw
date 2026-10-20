import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import test from "node:test";

import {
  isBacklogTaskEpisodeOwnership,
  isBeadsTaskEpisodeOwnership,
  isLegacyEpisodeOwnership,
  isTaskEpisodeOwnership,
  parseEpisodeOwnership,
  taskEpisodeProvider,
  parseEpisodeOwnershipRegistry,
  readAllEpisodeOwnership,
  readEpisodeOwnership,
  readEpisodeOwnershipRegistry,
  writeEpisodeOwnership,
} from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";
import {
  CliLegacyTaskOwnershipTransitionGit,
  advancePublishedBeadsTaskEpisodeEvidence,
  reservePublishedBeadsTaskEpisodeOwnership,
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

function beadsOwnership(ownerSessionId, taskId, revision = "c".repeat(32)) {
  return parseEpisodeOwnership({
    version: 2,
    provider: "beads",
    status: "provisioning",
    operationId: `operation-${ownerSessionId}`,
    engine: "local",
    ownerSessionId,
    taskId,
    providerRevision: revision,
    taskEvidence: {
      id: taskId,
      title: `Native ${taskId}`,
      status: "in_progress",
      comments: [{ body: "exact raw native evidence" }],
    },
    baseRef: "d".repeat(40),
    createdAt: "2026-10-20T12:00:00.000Z",
    updatedAt: "2026-10-20T12:00:00.000Z",
  });
}

function publishedBeadsStatus(f, overrides = {}) {
  const taskId = f.selection.taskId;
  const rawTask = { id: taskId, title: `Native ${taskId}`, status: "in_progress", comments: [] };
  const command = { command: "bd", args: [], status: 0, stdout: "", stderr: "" };
  const revision = "d".repeat(32);
  const evidence = {
    provider: "beads",
    projectRoot: f.root,
    taskId,
    remoteName: "origin",
    publicationRef: "refs/dolt/data",
    preparedRevision: "c".repeat(32),
    committedRevision: revision,
    publishedRevision: revision,
    publicationHead: "e".repeat(40),
    taskBefore: { taskId, title: rawTask.title, nativeStatus: "in_design", canonicalStatus: "In Design", nativeView: { ...rawTask, status: "in_design" } },
    taskPublished: { taskId, title: rawTask.title, nativeStatus: rawTask.status, canonicalStatus: "In Progress", nativeView: rawTask },
    postMutationProof: { revision, parentRevision: "c".repeat(32), clean: true, command },
    localPublishedProof: { revision, parentRevision: "c".repeat(32), clean: true, command },
    remotePublishedTask: {
      publicationHead: "e".repeat(40), revision, taskRow: { id: taskId, title: rawTask.title, status: rawTask.status },
      comments: [], refBefore: { command },
    },
    pull: command,
    mutation: command,
    push: command,
    ...overrides,
  };
  return { status: "published", evidence };
}

function reservePublishedBeads(f, overrides = {}, dependencies = {}) {
  return reservePublishedBeadsTaskEpisodeOwnership({
    projectRoot: f.root,
    publication: publishedBeadsStatus(f),
    ownerSessionId: "beads-owner",
    engine: "local",
    baseRef: git(f.root, "rev-parse", "HEAD"),
    operationId: "beads-operation-1234",
    ...overrides,
  }, {
    now: () => "2026-10-20T16:30:00.000Z",
    ...dependencies,
  });
}

function evidenceAdvancementFixture() {
  const rawRoot = mkdtempSync(join(tmpdir(), "prime-claw-beads-evidence-main-"));
  execFileSync("git", ["init", "-q", "-b", "main", rawRoot]);
  const root = realpathSync(rawRoot);
  const remote = mkdtempSync(join(tmpdir(), "prime-claw-beads-evidence-remote-"));
  execFileSync("git", ["init", "-q", "--bare", remote]);
  git(root, "remote", "add", "origin", remote);
  git(root, "config", "user.name", "Prime Claw Test");
  git(root, "config", "user.email", "prime-claw@example.invalid");
  writeFileSync(join(root, "README.md"), "evidence fixture\n");
  git(root, "add", "README.md");
  git(root, "commit", "-q", "-m", "base code");
  const baseRef = git(root, "rev-parse", "HEAD");
  git(root, "push", "-q", "-u", "origin", "main");

  const episodeParent = mkdtempSync(join(tmpdir(), "prime-claw-beads-evidence-episode-"));
  const episodeRoot = join(episodeParent, "episode");
  execFileSync("git", ["-C", root, "worktree", "add", "-q", "-b", "episode-evidence", episodeRoot, baseRef]);
  writeFileSync(join(episodeRoot, "candidate.txt"), "first candidate\n");
  git(episodeRoot, "add", "candidate.txt");
  git(episodeRoot, "commit", "-q", "-m", "first candidate");
  const previousHead = git(episodeRoot, "rev-parse", "HEAD");
  writeFileSync(join(episodeRoot, "candidate.txt"), "reviewed candidate\n");
  git(episodeRoot, "add", "candidate.txt");
  git(episodeRoot, "commit", "-q", "-m", "reviewed candidate");
  const reviewedHead = git(episodeRoot, "rev-parse", "HEAD");
  git(episodeRoot, "push", "-q", "-u", "origin", "episode-evidence");

  const sessionFile = join(mkdtempSync(join(tmpdir(), "prime-claw-beads-evidence-session-")), "episode.jsonl");
  writeFileSync(sessionFile, "{\"episode\":\"active\"}\n");
  const taskId = "PRIMECLAW-43";
  const oldTaskEvidence = {
    id: taskId, title: "Provider evidence fixture", status: "in_progress",
    design: "Implement the original bounded design", comments: [{ body: "original" }],
  };
  const reviewedTaskEvidence = {
    ...oldTaskEvidence,
    design: "Implement the reviewed owner-authored living-plan update",
    updated_at: "2026-10-20T21:00:00Z",
  };
  const owner = parseEpisodeOwnership({
    version: 2, provider: "beads", status: "active", operationId: "operation-evidence", engine: "local",
    ownerSessionId: "beads-owner", taskId, providerRevision: "a".repeat(32), taskEvidence: oldTaskEvidence,
    baseRef, head: previousHead, worktree: realpathSync(episodeRoot), branch: "episode-evidence",
    episodeId: "episode-evidence-id", episodeSessionFile: sessionFile, episodeActiveSessionId: "active-evidence-id",
    createdAt: "2026-10-20T20:00:00.000Z", updatedAt: "2026-10-20T20:00:00.000Z",
  });
  writeEpisodeOwnership(root, owner);
  const unrelated = taskOwnership("unrelated-owner", "PRIMECLAW-99");
  writeEpisodeOwnership(root, unrelated);
  return {
    root, episodeRoot: realpathSync(episodeRoot), taskId, owner, unrelated, reviewedHead,
    reviewedProviderRevision: "b".repeat(32), publishedProviderRevision: "c".repeat(32), reviewedTaskEvidence,
  };
}

function evidenceAdvancementProvider(f, overrides = {}) {
  const currentTaskEvidence = overrides.currentTaskEvidence ?? f.reviewedTaskEvidence;
  return {
    prepareTransport: () => ({
      status: "ready",
      evidence: {
        provider: "beads", projectRoot: f.root,
        revision: overrides.publishedProviderRevision ?? f.publishedProviderRevision,
        publishedRevision: overrides.publishedProviderRevision ?? f.publishedProviderRevision,
      },
    }),
    pairTransport: () => ({
      status: "ready",
      evidence: {
        provider: "beads", projectRoot: f.root,
        revision: overrides.publishedProviderRevision ?? f.publishedProviderRevision,
        publishedRevision: overrides.publishedProviderRevision ?? f.publishedProviderRevision,
      },
    }),
    resolveTask: () => ({
      provider: "beads", taskId: f.taskId, title: currentTaskEvidence.title,
      nativeStatus: currentTaskEvidence.status, status: overrides.canonicalStatus ?? "In Progress",
      projectRoot: overrides.taskProjectRoot ?? f.episodeRoot, nativeView: currentTaskEvidence,
    }),
    providerRevisionIsAncestor: overrides.providerRevisionIsAncestor ?? (() => true),
    now: () => "2026-10-20T22:00:00.000Z",
    ...overrides.dependencies,
  };
}

function advanceEvidence(f, inputOverrides = {}, dependencyOverrides = {}) {
  return advancePublishedBeadsTaskEpisodeEvidence({
    projectRoot: f.root,
    ownerSessionId: f.owner.ownerSessionId,
    taskId: f.taskId,
    reviewedProviderRevision: f.reviewedProviderRevision,
    reviewedTaskEvidence: f.reviewedTaskEvidence,
    reviewedEpisodeHead: f.reviewedHead,
    ...inputOverrides,
  }, {
    ...evidenceAdvancementProvider(f),
    ...dependencyOverrides,
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
  assert.equal(result.record.provider, "backlog");
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
  assert.equal(record.provider, "backlog");
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


test("version-2 ownership discriminates provider-native identity while preserving legacy Backlog records", () => {
  const legacyBacklog = taskOwnership("legacy-backlog", "PRIMECLAW-43");
  assert.equal(legacyBacklog.provider, undefined);
  assert.equal(taskEpisodeProvider(legacyBacklog), "backlog");
  assert.equal(isBacklogTaskEpisodeOwnership(legacyBacklog), true);

  const explicitBacklog = parseEpisodeOwnership({ ...legacyBacklog, provider: "backlog" });
  assert.equal(taskEpisodeProvider(explicitBacklog), "backlog");
  assert.equal(isBacklogTaskEpisodeOwnership(explicitBacklog), true);
  assert.equal(explicitBacklog.taskPath, "backlog/tasks/PRIMECLAW-43.md");
  assert.equal(explicitBacklog.providerRevision, undefined);
  assert.equal(explicitBacklog.taskEvidence, undefined);

  const beads = beadsOwnership("beads-owner", "PRIMECLAW-43");
  assert.equal(taskEpisodeProvider(beads), "beads");
  assert.equal(isBeadsTaskEpisodeOwnership(beads), true);
  assert.equal(beads.taskPath, undefined);
  assert.equal(beads.providerRevision, "c".repeat(32));
  assert.deepEqual(beads.taskEvidence.comments, [{ body: "exact raw native evidence" }]);
  assert.equal(beads.baseRef, "d".repeat(40));
});

test("version-2 ownership rejects mixed provider fields, ambiguous identity, and malformed revisions", () => {
  const legacyBacklog = taskOwnership("owner", "PRIMECLAW-43");
  const beads = beadsOwnership("owner", "PRIMECLAW-43");
  for (const invalid of [
    { ...legacyBacklog, provider: "backlog", providerRevision: "a".repeat(32) },
    { ...legacyBacklog, provider: "backlog", taskEvidence: { id: "PRIMECLAW-43", title: "x", status: "open" } },
    { ...legacyBacklog, provider: "beads", providerRevision: "a".repeat(32), taskEvidence: beads.taskEvidence },
    { ...beads, taskPath: "backlog/tasks/PRIMECLAW-43.md" },
    { ...beads, providerRevision: "a".repeat(31) },
    { ...beads, providerRevision: "z".repeat(32) },
    { ...beads, providerRevision: "A".repeat(32) },
    { ...beads, providerRevision: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"] },
    { ...beads, taskEvidence: { ...beads.taskEvidence, id: "PRIMECLAW-44" } },
    { ...beads, taskEvidence: { ...beads.taskEvidence, title: "   " } },
    { ...beads, taskEvidence: [{ id: "PRIMECLAW-43" }] },
    { ...beads, provider: "other" },
    { ...legacyBacklog, provider: undefined, taskPath: undefined },
  ]) assert.throws(() => parseEpisodeOwnership(invalid), /unsupported shape/);
});

test("published Beads evidence reserves one exact provider-native owner and preserves unrelated legacy Backlog identity", () => {
  const f = fixture();
  const unrelated = taskOwnership("unrelated-owner", "PRIMECLAW-99");
  writeEpisodeOwnership(f.root, unrelated);

  const record = reservePublishedBeads(f, {
    engine: "orca",
    projectSetupId: "setup-123",
    routingEnvironmentId: "environment-456",
  });

  assert.equal(record.provider, "beads");
  assert.equal(record.taskId, f.selection.taskId);
  assert.equal(record.providerRevision, "d".repeat(32));
  assert.deepEqual(record.taskEvidence, {
    id: f.selection.taskId,
    title: `Native ${f.selection.taskId}`,
    status: "in_progress",
    comments: [],
  });
  assert.equal(record.baseRef, git(f.root, "rev-parse", "HEAD"));
  assert.equal(record.projectSetupId, "setup-123");
  assert.equal(record.routingEnvironmentId, "environment-456");
  assert.deepEqual(readEpisodeOwnership(f.root, "beads-owner"), record);
  assert.deepEqual(readEpisodeOwnership(f.root, "unrelated-owner"), unrelated);
  assert.equal(taskEpisodeProvider(readEpisodeOwnership(f.root, "unrelated-owner")), "backlog");
});

test("Beads reservation rejects anything other than the proven published result before ownership write", () => {
  const f = fixture();
  assert.throws(() => reservePublishedBeads(f, {
    publication: {
      status: "review-required",
      code: "publication-proof-failed",
      phase: "publication-proof",
      detail: "raw provider review evidence",
      evidence: { provider: "beads", projectRoot: f.root, taskId: f.selection.taskId },
    },
  }), /already-published native status result/);
  assert.throws(() => reservePublishedBeads(f, {}, {
    git: {
      repositoryRoot: () => f.root,
      head: () => git(f.root, "rev-parse", "HEAD"),
      status: () => " M src/changed.ts",
    },
  }), /exact clean Git code HEAD\/baseRef/);
  assert.equal(readEpisodeOwnership(f.root, "beads-owner"), null);
});

test("Beads reservation preserves the global cross-provider task collision rule", () => {
  const f = fixture();
  const existing = taskOwnership("other-owner", f.selection.taskId);
  writeEpisodeOwnership(f.root, existing);

  assert.throws(() => reservePublishedBeads(f), /collides across Conversations/);
  assert.deepEqual(readEpisodeOwnership(f.root, "other-owner"), existing);
  assert.equal(readEpisodeOwnership(f.root, "beads-owner"), null);
});

test("provider-absent version-2 Backlog owners parse unchanged without registry rewrite", () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-provider-compatibility-"));
  mkdirSync(join(root, ".prime-claw"), { recursive: true });
  const oldOwner = taskOwnership("old-owner", "PRIMECLAW-43", "backlog/tasks/43.md");
  const unrelatedOwner = taskOwnership("unrelated-owner", "PRIMECLAW-99", "backlog/tasks/99.md");
  const raw = { schemaVersion: 1, owners: { "old-owner": oldOwner, "unrelated-owner": unrelatedOwner } };
  const path = join(root, ".prime-claw", "ownership.json");
  const bytes = `${JSON.stringify(raw, null, 2)}\n`;
  writeFileSync(path, bytes);

  const parsed = readEpisodeOwnershipRegistry(root);
  assert.deepEqual(parsed.owners["old-owner"], oldOwner);
  assert.deepEqual(parsed.owners["unrelated-owner"], unrelatedOwner);
  assert.equal(taskEpisodeProvider(parsed.owners["old-owner"]), "backlog");
  assert.equal(readFileSync(path, "utf8"), bytes);
});

test("Beads receipt evidence may advance without changing ownership identity", () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-beads-receipt-advance-"));
  const first = beadsOwnership("beads-owner", "PRIMECLAW-43", "a".repeat(32));
  writeEpisodeOwnership(root, first);
  const advanced = parseEpisodeOwnership({
    ...first,
    providerRevision: "b".repeat(32),
    taskEvidence: { ...first.taskEvidence, status: "blocked" },
    updatedAt: "2026-10-20T13:00:00.000Z",
  });
  writeEpisodeOwnership(root, advanced);
  assert.deepEqual(readEpisodeOwnership(root, "beads-owner"), advanced);

  assert.throws(
    () => writeEpisodeOwnership(root, parseEpisodeOwnership({
      ...taskOwnership("backlog-owner", "PRIMECLAW-43"), provider: "backlog",
    })),
    /task Episode binding collides/,
  );
});

test("reviewed Beads evidence advances only the same active owner's four evidence fields", () => {
  const f = evidenceAdvancementFixture();
  const ancestry = [];
  const result = advanceEvidence(f, {}, {
    providerRevisionIsAncestor: (cwd, ancestor, descendant) => {
      ancestry.push({ cwd, ancestor, descendant });
      return true;
    },
  });

  assert.equal(result.status, "advanced");
  assert.equal(result.reviewedProviderRevision, f.reviewedProviderRevision);
  assert.equal(result.publishedProviderRevision, f.publishedProviderRevision);
  assert.deepEqual(ancestry, [{
    cwd: f.episodeRoot,
    ancestor: f.reviewedProviderRevision,
    descendant: f.publishedProviderRevision,
  }]);
  const changed = Object.keys(result.record).filter((key) =>
    JSON.stringify(result.record[key]) !== JSON.stringify(f.owner[key]));
  assert.deepEqual(changed.sort(), ["head", "providerRevision", "taskEvidence", "updatedAt"]);
  assert.equal(result.record.head, f.reviewedHead);
  assert.equal(result.record.providerRevision, f.publishedProviderRevision);
  assert.deepEqual(result.record.taskEvidence, f.reviewedTaskEvidence);
  assert.equal(result.record.updatedAt, "2026-10-20T22:00:00.000Z");
  assert.deepEqual(readEpisodeOwnership(f.root, f.owner.ownerSessionId), result.record);
  assert.deepEqual(readEpisodeOwnership(f.root, f.unrelated.ownerSessionId), f.unrelated);
});

test("post-preparation Beads advance and dirty state returns exact review evidence with zero owner writes", () => {
  const f = evidenceAdvancementFixture();
  const provider = evidenceAdvancementProvider(f);
  const initialResolve = provider.resolveTask;
  let liveRevision = f.publishedProviderRevision;
  let dirty = false;
  let pairingProofCalls = 0;
  let ownerWrites = 0;

  const result = advanceEvidence(f, {}, {
    ...provider,
    pairTransport: () => {
      pairingProofCalls += 1;
      assert.equal(dirty, true);
      return {
        status: "blocked",
        code: "revision",
        detail: "the selected Dolt working set has 1 uncommitted table change(s)",
        remediation: "Review the exact native writer before continuing",
        observedRevision: liveRevision,
      };
    },
    resolveTask: (...args) => {
      liveRevision = "d".repeat(32);
      dirty = true;
      return initialResolve(...args);
    },
    ownership: {
      read: (root, ownerSessionId) => readEpisodeOwnership(root, ownerSessionId),
      mutate: () => {
        ownerWrites += 1;
        throw new Error("ownership mutation must not run for unpaired evidence");
      },
    },
  });

  assert.deepEqual(result, {
    status: "review-required",
    code: "provider-evidence-mismatch",
    reviewedProviderRevision: f.reviewedProviderRevision,
    publishedProviderRevision: f.publishedProviderRevision,
    observedProviderRevision: "d".repeat(32),
    acceptedTaskEvidence: f.reviewedTaskEvidence,
    currentTaskEvidence: f.reviewedTaskEvidence,
    providerProof: {
      status: "blocked",
      code: "revision",
      detail: "the selected Dolt working set has 1 uncommitted table change(s)",
    },
  });
  assert.equal(pairingProofCalls, 1);
  assert.equal(ownerWrites, 0);
  assert.deepEqual(readEpisodeOwnership(f.root, f.owner.ownerSessionId), f.owner);
  assert.deepEqual(readEpisodeOwnership(f.root, f.unrelated.ownerSessionId), f.unrelated);
});

test("same-task Beads mismatch returns exact accepted/current raw evidence with no owner write", () => {
  const f = evidenceAdvancementFixture();
  const currentTaskEvidence = {
    ...f.reviewedTaskEvidence,
    status: "blocked",
    design: "outside same-task edit requiring managed review",
    comments: [...f.reviewedTaskEvidence.comments, { body: "outside writer changed authority" }],
  };
  const result = advanceEvidence(f, {}, evidenceAdvancementProvider(f, {
    currentTaskEvidence,
    canonicalStatus: "Blocked",
  }));

  assert.deepEqual(result, {
    status: "review-required",
    code: "task-evidence-mismatch",
    reviewedProviderRevision: f.reviewedProviderRevision,
    publishedProviderRevision: f.publishedProviderRevision,
    acceptedTaskEvidence: f.reviewedTaskEvidence,
    currentTaskEvidence,
  });
  assert.deepEqual(readEpisodeOwnership(f.root, f.owner.ownerSessionId), f.owner);
  assert.deepEqual(readEpisodeOwnership(f.root, f.unrelated.ownerSessionId), f.unrelated);
});

test("Beads evidence advancement rejects foreign, drifted, colliding, uncertain, or unpushed identity without retry", () => {
  const f = evidenceAdvancementFixture();
  assert.throws(() => advanceEvidence(f, { ownerSessionId: "foreign-owner" }), /no ownership for the exact requesting owner/);
  assert.throws(() => advanceEvidence(f, {}, {
    providerRevisionIsAncestor: () => false,
  }), /not an ancestor/);

  const cleanGit = {
    repositoryRoot: () => f.episodeRoot,
    branch: () => f.owner.branch,
    head: () => f.reviewedHead,
    upstreamHead: () => f.reviewedHead,
    directRemoteHead: () => "f".repeat(40),
    status: () => "",
    operationInProgress: () => false,
    isAncestor: () => true,
  };
  assert.throws(() => advanceEvidence(f, {}, { git: cleanGit }), /local\/upstream\/direct-remote Episode head/);

  const drifted = { ...f.owner, updatedAt: "2026-10-20T21:59:00.000Z" };
  const driftStore = {
    read: () => f.owner,
    mutate: (_root, _owner, mutation) => mutation(drifted, [drifted]),
  };
  assert.throws(() => advanceEvidence(f, {}, { ownership: driftStore }), /owner or binding drifted/);

  const foreignCollision = taskOwnership("collision-owner", f.taskId);
  const collisionStore = {
    read: () => f.owner,
    mutate: (_root, _owner, mutation) => mutation(f.owner, [f.owner, foreignCollision]),
  };
  assert.throws(() => advanceEvidence(f, {}, { ownership: collisionStore }), /foreign active owner collision/);

  let uncertainState = f.owner;
  let mutationAttempts = 0;
  const uncertainStore = {
    read: () => uncertainState,
    mutate: (_root, _owner, mutation) => {
      mutationAttempts += 1;
      mutation(uncertainState, [uncertainState]);
      uncertainState = { ...f.owner, updatedAt: "foreign-write" };
      throw new Error("simulated write transport failure");
    },
  };
  assert.throws(() => advanceEvidence(f, {}, { ownership: uncertainStore }), /write is uncertain and made no retry/);
  assert.equal(mutationAttempts, 1);
  assert.deepEqual(readEpisodeOwnership(f.root, f.owner.ownerSessionId), f.owner);
  assert.deepEqual(readEpisodeOwnership(f.root, f.unrelated.ownerSessionId), f.unrelated);
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
