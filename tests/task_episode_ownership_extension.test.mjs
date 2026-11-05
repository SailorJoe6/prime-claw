import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import test from "node:test";

import {
  isBacklogTaskEpisodeOwnership,
  isPublishedBacklogTaskEpisodeOwnership,
  isBeadsTaskEpisodeOwnership,
  isLegacyEpisodeOwnership,
  isTaskEpisodeOwnership,
  parseEpisodeOwnership,
  taskEpisodeProvider,
  parseEpisodeOwnershipRegistry,
  readAllEpisodeOwnership,
  readEpisodeOwnership,
  readEpisodeOwnershipRegistry,
  restoreTaskProviderOwnershipSwitch,
  switchActiveTaskProviderOwnership,
  withCurrentTaskProviderOwnershipSwitch,
  removeTaskEpisodeOwnership,
  writeEpisodeOwnership,
} from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";
import { createReviewedPlanExtension } from "../src/prime-agent-plugin/extensions/reviewed-plan.ts";
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
    postMutationRevision: revision,
    submittedRevision: revision,
    publicationHead: "e".repeat(40),
    taskBefore: { taskId, title: rawTask.title, nativeStatus: "in_design", canonicalStatus: "In Design", nativeView: { ...rawTask, status: "in_design" } },
    taskAfterPush: { taskId, title: rawTask.title, nativeStatus: rawTask.status, canonicalStatus: "In Progress", nativeView: rawTask },
    postMutationObservation: { revision, parentRevision: "c".repeat(32), clean: true, command },
    postPushObservation: { revision, parentRevision: "c".repeat(32), clean: true, command },
    pull: command,
    mutation: command,
    push: command,
    ...overrides,
  };
  return { status: "pushed", evidence };
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
  const currentTaskEvidence = {
    ...oldTaskEvidence,
    design: "Implement the owner-authored living-plan update",
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
    currentProviderRevision: "c".repeat(32), currentTaskEvidence,
  };
}

function evidenceAdvancementProvider(f, overrides = {}) {
  const currentTaskEvidence = overrides.currentTaskEvidence ?? f.currentTaskEvidence;
  return {
    detectProvider: (cwd) => ({
      kind: "selected",
      projectRoot: cwd,
      evidence: {
        provider: "beads",
        storeDir: f.root,
        metadataPath: f.root,
        configPath: f.root,
        doltMode: "server",
        doltDatabase: "evidence",
      },
    }),
    synchronize: () => ({ status: 0, stdout: "synchronized", stderr: "native pull qualification" }),
    prepareTransport: () => ({
      status: "ready",
      evidence: {
        provider: "beads", projectRoot: f.root,
        database: "evidence", branch: "main",
        revision: overrides.currentProviderRevision ?? f.currentProviderRevision,
        workingSet: [{ table_name: "unrelated_task", status: "modified" }],
        publication: { remoteName: "origin", ref: "refs/dolt/data", raw: "remote task publication not observed" },
        commands: [{ command: "bd", args: ["dolt", "status", "--json"], status: 0, stdout: "raw current working-set facts", stderr: "native observation warning" }],
      },
    }),
    resolveTask: () => ({
      provider: "beads", taskId: f.taskId, title: currentTaskEvidence.title,
      nativeStatus: currentTaskEvidence.status, status: overrides.canonicalStatus ?? "In Progress",
      projectRoot: overrides.taskProjectRoot ?? f.episodeRoot, nativeView: currentTaskEvidence,
    }),
    now: () => "2026-10-20T22:00:00.000Z",
    ...overrides.dependencies,
  };
}

function prepareEvidence(f, inputOverrides = {}, dependencyOverrides = {}) {
  return advancePublishedBeadsTaskEpisodeEvidence({
    projectRoot: f.root,
    ownerSessionId: f.owner.ownerSessionId,
    taskId: f.taskId,
    previousProviderRevision: f.owner.providerRevision,
    previousTaskEvidence: f.owner.taskEvidence,
    episodeHead: f.reviewedHead,
    ...inputOverrides,
  }, {
    ...evidenceAdvancementProvider(f),
    ...dependencyOverrides,
  });
}

function advanceEvidence(f, inputOverrides = {}, dependencyOverrides = {}) {
  const prepared = prepareEvidence(f, inputOverrides, dependencyOverrides);
  prepared.commit();
  return prepared;
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

function makeBeadsTransitionContinuable(f) {
  f.legacy = { ...f.legacy, head: f.baseRef };
  writeEpisodeOwnership(f.root, f.legacy);
  return f;
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
    transitionTargetResolver: () => ({ provider: "backlog", history: "branch-local", task: f.selection }),
    now: () => "2026-10-14T09:00:00.000Z",
    ...dependencies,
  });
}

test("guarded transition replaces only the exact owner's legacy authority and preserves other owners", () => {
  const f = transitionFixture();
  // Exercise the supported operator choice to expose existing state for tracking.
  // First creation now excludes it locally; later owner writes must not repair that rule.
  const exclude = resolve(f.root, git(f.root, "rev-parse", "--git-path", "info/exclude"));
  writeFileSync(exclude, readFileSync(exclude, "utf8").split("\n").filter(line => line !== "/.prime-claw/").join("\n"));
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

test("guarded transition records published independent Backlog authority without manufacturing task evidence on the code DAG", () => {
  const f = transitionFixture();
  const providerRevision = "7".repeat(40);
  const taskEvidence = {
    schemaVersion: 1,
    kind: "task-view",
    task: {
      id: f.selection.taskId,
      path: f.relative,
      status: "In Progress",
      implementationPlan: f.selection.implementationPlan,
      references: f.selection.references,
    },
  };
  const providerTarget = {
    provider: "backlog",
    history: "independent",
    task: f.selection,
    providerRevision,
    taskEvidence,
  };
  const result = transition(f, {}, { transitionTargetResolver: () => providerTarget });
  assert.equal(result.record.provider, "backlog");
  assert.equal(result.record.taskPath, f.relative);
  assert.equal(result.record.providerRevision, providerRevision);
  assert.deepEqual(result.record.taskEvidence, taskEvidence);
  assert.equal(result.record.baseRef, f.legacy.baseRef);
  assert.equal(result.record.operationId, f.legacy.operationId);
  assert.equal(result.record.episodeId, f.legacy.episodeId);
  assert.equal(result.record.worktree, f.legacy.worktree);
  assert.equal(result.record.branch, f.legacy.branch);

  const replay = transition(f, {}, { transitionTargetResolver: () => providerTarget });
  assert.equal(replay.reused, true);
  assert.deepEqual(replay.record, result.record);
});

test("guarded transition records published Beads authority and its first normal handoff remains usable", () => {
  const f = makeBeadsTransitionContinuable(transitionFixture());
  const sourceReference = `legacy-episode-source=${f.legacy.sourceLocation}; superseded-by=${f.selection.taskId}`;
  const taskEvidence = {
    id: f.selection.taskId,
    title: "Native retained migration",
    status: "in_progress",
    description: "Reviewed retained specification content",
    design: "Complete bridge candidate plan",
    notes: `Migration provenance\n${sourceReference}`,
    comments: [{ body: "reviewed before authority switch" }],
  };
  const providerTarget = {
    provider: "beads",
    task: {
      provider: "beads",
      taskId: f.selection.taskId,
      title: taskEvidence.title,
      nativeStatus: taskEvidence.status,
      status: "In Progress",
      projectRoot: f.root,
      nativeView: taskEvidence,
    },
    providerRevision: "m".repeat(32),
    taskEvidence,
  };
  const result = transition(f, {}, { transitionTargetResolver: () => providerTarget });
  assert.equal(result.record.provider, "beads");
  assert.equal(result.record.taskId, f.selection.taskId);
  assert.equal(result.record.providerRevision, "m".repeat(32));
  assert.deepEqual(result.record.taskEvidence, taskEvidence);
  assert.equal(result.record.taskPath, undefined);
  assert.equal(result.record.baseRef, f.legacy.baseRef);
  assert.equal(result.record.head, f.legacy.head);

  const replay = transition(f, {}, { transitionTargetResolver: () => providerTarget });
  assert.equal(replay.reused, true);
  assert.deepEqual(replay.record, result.record);

  const advancedEvidence = { ...taskEvidence, notes: `${taskEvidence.notes}\noutside advance` };
  const advanced = {
    ...providerTarget,
    providerRevision: "n".repeat(32),
    task: { ...providerTarget.task, nativeView: advancedEvidence },
    taskEvidence: advancedEvidence,
  };
  assert.throws(() => transition(f, {}, { transitionTargetResolver: () => advanced }), /does not match the completed transition binding/);
  assert.deepEqual(readEpisodeOwnership(f.root, f.legacy.ownerSessionId), result.record);

  const firstHandoff = {
    root: f.root, episodeRoot: f.episodeRoot, taskId: f.selection.taskId,
    owner: result.record, reviewedHead: f.episodeHead,
    currentProviderRevision: providerTarget.providerRevision,
    currentTaskEvidence: taskEvidence,
  };
  const preparedHandoff = prepareEvidence(firstHandoff);
  assert.equal(preparedHandoff.commit().head, f.episodeHead);
});

test("guarded Beads transition rejects a historical head that its first handoff and cleanup cannot continue", () => {
  const f = transitionFixture();
  const sourceReference = `legacy-episode-source=${f.legacy.sourceLocation}; superseded-by=${f.selection.taskId}`;
  const taskEvidence = {
    id: f.selection.taskId, title: "Native retained migration", status: "in_progress",
    design: "Complete bridge candidate plan", notes: sourceReference,
  };
  const providerTarget = {
    provider: "beads",
    task: {
      provider: "beads", taskId: f.selection.taskId, title: taskEvidence.title,
      nativeStatus: taskEvidence.status, status: "In Progress", projectRoot: f.root, nativeView: taskEvidence,
    },
    providerRevision: "m".repeat(32),
    taskEvidence,
  };
  assert.throws(() => transition(f, {}, { transitionTargetResolver: () => providerTarget }), /historical Episode head cannot continue/);
  assert.deepEqual(readEpisodeOwnership(f.root, f.legacy.ownerSessionId), f.legacy);

  const backlogResult = transition(f);
  assert.equal(backlogResult.record.provider, "backlog");
  assert.equal(backlogResult.record.head, f.legacyHead);
});

test("guarded Beads transition rejects a published design that differs from the retained living plan", () => {
  const f = makeBeadsTransitionContinuable(transitionFixture());
  const sourceReference = `legacy-episode-source=${f.legacy.sourceLocation}; superseded-by=${f.selection.taskId}`;
  const taskEvidence = {
    id: f.selection.taskId,
    title: "Native retained migration",
    status: "in_progress",
    design: "Stale or partial provider-native plan",
    notes: sourceReference,
  };
  const providerTarget = {
    provider: "beads",
    task: {
      provider: "beads", taskId: f.selection.taskId, title: taskEvidence.title,
      nativeStatus: taskEvidence.status, status: "In Progress", projectRoot: f.root, nativeView: taskEvidence,
    },
    providerRevision: "m".repeat(32),
    taskEvidence,
  };
  assert.throws(() => transition(f, {}, { transitionTargetResolver: () => providerTarget }), /Beads task plan does not exactly match/);
  assert.deepEqual(readEpisodeOwnership(f.root, f.legacy.ownerSessionId), f.legacy);
});

test("guarded provider publication failure and paired evidence drift preserve exact version-1 recovery", () => {
  const failed = transitionFixture();
  assert.throws(() => transition(failed, {}, {
    transitionTargetResolver: () => { throw new Error("published provider task is unavailable"); },
  }), /published provider task is unavailable/);
  assert.deepEqual(readEpisodeOwnership(failed.root, failed.legacy.ownerSessionId), failed.legacy);

  const raced = transitionFixture();
  let calls = 0;
  const first = {
    provider: "backlog",
    history: "independent",
    task: raced.selection,
    providerRevision: "7".repeat(40),
    taskEvidence: { task: {
      id: raced.selection.taskId, path: raced.relative, status: "In Progress",
      implementationPlan: raced.selection.implementationPlan, references: raced.selection.references,
    } },
  };
  assert.throws(() => transition(raced, {}, {
    transitionTargetResolver: () => (++calls === 1 ? first : { ...first, providerRevision: "8".repeat(40) }),
  }), /publication changed during ownership transition validation/);
  assert.equal(calls, 2);
  assert.deepEqual(readEpisodeOwnership(raced.root, raced.legacy.ownerSessionId), raced.legacy);
});

test("guarded transition re-proves exact code state after final provider reads and before replay returns", () => {
  const f = transitionFixture();
  let calls = 0;
  assert.throws(() => transition(f, {}, {
    transitionTargetResolver: () => {
      calls += 1;
      if (calls === 2) writeFileSync(join(f.episodeRoot, f.relative), "status: In Progress\nplan: concurrent tracked drift\n");
      return { provider: "backlog", history: "branch-local", task: f.selection };
    },
  }), /Git state changed during ownership transition validation/);
  assert.equal(calls, 2);
  assert.deepEqual(readEpisodeOwnership(f.root, f.legacy.ownerSessionId), f.legacy);

  git(f.episodeRoot, "checkout", "--", f.relative);
  const completed = transition(f);
  let replayCalls = 0;
  assert.throws(() => transition(f, {}, {
    transitionTargetResolver: () => {
      replayCalls += 1;
      writeFileSync(join(f.episodeRoot, f.relative), "status: In Progress\nplan: concurrent replay drift\n");
      return { provider: "backlog", history: "branch-local", task: f.selection };
    },
  }), /Git state changed during ownership transition validation/);
  assert.equal(replayCalls, 1);
  assert.deepEqual(readEpisodeOwnership(f.root, f.legacy.ownerSessionId), completed.record);
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
  assert.throws(() => transition(f, {}, { transitionTargetResolver: () => ({
    provider: "backlog", history: "branch-local", task: { ...f.selection, implementationPlan: "stale partial plan" },
  }) }), /does not exactly match/);
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

test("task ownership parser discards only the legacy cleanup marker without changing version-1 parsing", () => {
  const task = taskOwnership("task-owner", "PRIMECLAW-43");
  const raw = { ...task, cleanupHead: "c".repeat(40) };
  assert.deepEqual(parseEpisodeOwnership(raw), task);
  assert.equal(raw.cleanupHead, "c".repeat(40), "parsing must not mutate the input");
  assert.deepEqual(parseEpisodeOwnership({ ...task, cleanupHead: "d".repeat(64) }), task);
  assert.throws(() => parseEpisodeOwnership({ ...task, cleanupHead: "not-a-head" }), /unsupported shape/);
  assert.throws(() => parseEpisodeOwnership({ ...task, cleanupStage: 1 }), /unsupported shape/);
  const legacy = legacyOwnership("legacy-owner", ".ralph/plans/future/legacy-source");
  assert.strictEqual(parseEpisodeOwnership(legacy), legacy);
  assert.throws(() => parseEpisodeOwnership({ ...legacy, cleanupHead: "c".repeat(40) }), /unsupported shape/);
});

test("owner writes discard their own old marker and preserve foreign raw entries", () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-ownership-foreign-marker-"));
  const path = join(root, ".prime-claw", "ownership.json");
  mkdirSync(join(root, ".prime-claw"), { recursive: true });
  const owned = taskOwnership("owner", "PRIMECLAW-43");
  const foreign = { ...taskOwnership("foreign", "PRIMECLAW-44"), cleanupHead: "d".repeat(40) };
  const legacy = legacyOwnership("legacy", ".ralph/plans/future/foreign-legacy");
  writeFileSync(path, JSON.stringify({ schemaVersion: 1, owners: { owner: { ...owned, cleanupHead: "c".repeat(40) }, foreign, legacy } }));
  const normalized = readEpisodeOwnershipRegistry(root);
  assert.equal(normalized.owners.owner.cleanupHead, undefined);
  assert.equal(normalized.owners.foreign.cleanupHead, undefined);

  writeEpisodeOwnership(root, { ...owned, updatedAt: "changed", cleanupHead: "c".repeat(40) });
  const raw = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(raw.owners.owner.cleanupHead, undefined);
  assert.equal(raw.owners.owner.updatedAt, "changed");
  assert.deepEqual(raw.owners.foreign, foreign);
  assert.deepEqual(raw.owners.legacy, legacy);
});

test("writing another owner preserves a direct task record's legacy marker", () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-ownership-direct-marker-"));
  const path = join(root, ".prime-claw", "ownership.json");
  mkdirSync(join(root, ".prime-claw"), { recursive: true });
  const foreign = { ...taskOwnership("foreign", "PRIMECLAW-44"), cleanupHead: "d".repeat(40) };
  writeFileSync(path, JSON.stringify(foreign));
  const owned = taskOwnership("owner", "PRIMECLAW-43");
  writeEpisodeOwnership(root, owned);
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")).owners, { foreign, owner: owned });
});

function activeTaskOwnership(owner = "owner", taskId = "PRIMECLAW-43") {
  return parseEpisodeOwnership({
    ...taskOwnership(owner, taskId), status: "active", worktree: `/tmp/${owner}-worktree`,
    branch: `${owner}-episode`, head: "b".repeat(40), episodeId: `${owner}-episode-id`,
    episodeSessionFile: `/tmp/${owner}-episode.jsonl`, episodeActiveSessionId: `${owner}-route`,
    terminalHandles: ["terminal-one", "terminal-two"],
  });
}

test("atomic task removal deletes only the unchanged owner and rejects a second removal", () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-ownership-remove-"));
  const path = join(root, ".prime-claw", "ownership.json");
  const owned = activeTaskOwnership();
  writeEpisodeOwnership(root, owned);
  const foreign = { ...activeTaskOwnership("foreign", "PRIMECLAW-44"), cleanupHead: "c".repeat(40) };
  const legacy = legacyOwnership("legacy", ".ralph/plans/future/foreign-legacy");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  raw.owners.foreign = foreign;
  raw.owners.legacy = legacy;
  raw.owners.owner.cleanupHead = "d".repeat(40);
  writeFileSync(path, JSON.stringify(raw));

  // Key order is not ownership drift. The old marker is discarded by the read boundary.
  const expected = Object.fromEntries(Object.entries(readEpisodeOwnership(root, "owner")).reverse());
  removeTaskEpisodeOwnership(root, expected);
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")).owners, { foreign, legacy });
  const after = readFileSync(path, "utf8");
  assert.throws(() => removeTaskEpisodeOwnership(root, expected), /changed or is missing/);
  assert.equal(readFileSync(path, "utf8"), after);
});

test("removing a sole direct task entry leaves no inactive record or tombstone", () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-ownership-remove-direct-"));
  const path = join(root, ".prime-claw", "ownership.json");
  mkdirSync(join(root, ".prime-claw"), { recursive: true });
  const owned = activeTaskOwnership();
  writeFileSync(path, JSON.stringify({ ...owned, cleanupHead: "c".repeat(40) }));
  removeTaskEpisodeOwnership(root, readEpisodeOwnership(root, owned.ownerSessionId));
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), { schemaVersion: 1, owners: {} });
  assert.equal(readEpisodeOwnership(root), null);
});

test("atomic task removal fails without rewriting on missing records, status, version, or binding drift", () => {
  const expected = activeTaskOwnership();
  const changes = [
    { operationId: "changed-operation" }, { updatedAt: "changed-time" },
    { taskId: "PRIMECLAW-99" }, { taskPath: "backlog/tasks/changed.md" },
    { branch: "changed-branch" }, { head: "c".repeat(40) }, { baseRef: "d".repeat(40) },
    { episodeActiveSessionId: "changed-route" }, { worktree: "/tmp/changed-worktree" },
    { terminalHandles: ["terminal-two", "terminal-one"] },
    ...["inactive", "provisioning", "uncertain"].map((status) => ({ status })),
  ];
  const candidates = changes.map((change) => ({ ...expected, ...change }));
  candidates.push(legacyOwnership("owner", ".ralph/plans/future/legacy-source"));
  candidates.push(taskOwnership("foreign", "PRIMECLAW-44"));
  for (const current of candidates) {
    const root = mkdtempSync(join(tmpdir(), "prime-claw-ownership-remove-drift-"));
    writeEpisodeOwnership(root, current);
    const path = join(root, ".prime-claw", "ownership.json");
    const before = readFileSync(path, "utf8");
    assert.throws(() => removeTaskEpisodeOwnership(root, expected), /changed or is missing/);
    assert.equal(readFileSync(path, "utf8"), before);
  }
  const emptyRoot = mkdtempSync(join(tmpdir(), "prime-claw-ownership-remove-missing-"));
  assert.throws(() => removeTaskEpisodeOwnership(emptyRoot, expected), /changed or is missing/);
  assert.equal(readEpisodeOwnership(emptyRoot), null);
  for (const invalid of [
    { ...expected, status: "inactive" },
    taskOwnership("owner", "PRIMECLAW-43"),
    legacyOwnership("owner", ".ralph/plans/future/legacy-source"),
  ]) assert.throws(() => removeTaskEpisodeOwnership(emptyRoot, invalid), /exact active version-2/);
});

test("atomic removal validates foreign entries before any registry change", () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-ownership-remove-invalid-foreign-"));
  const owned = activeTaskOwnership();
  writeEpisodeOwnership(root, owned);
  const path = join(root, ".prime-claw", "ownership.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  raw.owners.foreign = { ...taskOwnership("foreign", "PRIMECLAW-44"), shadowAuthority: true };
  writeFileSync(path, JSON.stringify(raw));
  const before = readFileSync(path, "utf8");
  assert.throws(() => removeTaskEpisodeOwnership(root, owned), /unsupported shape/);
  assert.equal(readFileSync(path, "utf8"), before);
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

  const publishedBacklog = parseEpisodeOwnership({
    ...explicitBacklog,
    providerRevision: "e".repeat(40),
    taskEvidence: { task: { id: "PRIMECLAW-43", path: explicitBacklog.taskPath, status: "In Progress", title: "Independent history" } },
  });
  assert.equal(isPublishedBacklogTaskEpisodeOwnership(publishedBacklog), true);
  assert.equal(publishedBacklog.providerRevision, "e".repeat(40));
  assert.equal(publishedBacklog.taskEvidence.task.status, "In Progress");
  const archivedBacklog = parseEpisodeOwnership({
    ...publishedBacklog,
    taskEvidence: { task: { id: "PRIMECLAW-43", path: "backlog/archive/tasks/PRIMECLAW-43.md", status: "In Progress", finalSummary: "truthful abandonment" } },
  });
  assert.equal(isPublishedBacklogTaskEpisodeOwnership(archivedBacklog), true);
  assert.equal(archivedBacklog.taskEvidence.task.path, "backlog/archive/tasks/PRIMECLAW-43.md");

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
    { ...legacyBacklog, provider: "backlog", providerRevision: "a".repeat(40) },
    { ...legacyBacklog, provider: "backlog", taskEvidence: { task: { id: "PRIMECLAW-43", path: legacyBacklog.taskPath, status: "In Progress" } } },
    { ...legacyBacklog, provider: "backlog", providerRevision: "a".repeat(40), taskEvidence: { task: { id: "PRIMECLAW-44", path: legacyBacklog.taskPath, status: "In Progress" } } },
    { ...legacyBacklog, provider: "backlog", providerRevision: "a".repeat(40), taskEvidence: { task: { id: "PRIMECLAW-43", path: "backlog/tasks/other.md", status: "In Progress" } } },
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

test("Beads reservation reports an unsuccessful native result before ownership write", () => {
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
  assert.equal(readEpisodeOwnership(f.root, "beads-owner"), null);
});

test("Beads reservation keeps raw native facts and preserves dirty code and history without frozen publication approval", () => {
  const f = fixture();
  const unrelated = taskOwnership("unrelated-owner", "PRIMECLAW-99");
  writeEpisodeOwnership(f.root, unrelated);
  const baseRef = git(f.root, "rev-parse", "HEAD");
  writeFileSync(join(f.root, "unrelated.txt"), "published concurrent code\n");
  git(f.root, "add", "unrelated.txt");
  git(f.root, "commit", "-q", "-m", "unrelated code descendant");
  writeFileSync(join(f.root, "unrelated.txt"), "staged work\n");
  git(f.root, "add", "unrelated.txt");
  writeFileSync(join(f.root, "unrelated.txt"), "unstaged work\n");
  writeFileSync(join(f.root, "untracked.txt"), "untouched native absence\n");
  const headBefore = git(f.root, "rev-parse", "HEAD");
  const statusBefore = git(f.root, "status", "--porcelain=v1", "--untracked-files=all");
  const indexBefore = readFileSync(join(f.root, ".git", "index"));
  const rawTask = {
    id: f.selection.taskId, title: "Raw current title", status: "blocked", design: "",
    comments: [{ body: "current native observation" }], opaque_native_field: { keep: [1, 2] },
  };
  const publication = publishedBeadsStatus(f, {
    postMutationRevision: "a".repeat(32),
    postPushObservation: { revision: "b".repeat(32), clean: false },
    taskAfterPush: {
      taskId: f.selection.taskId, title: "Earlier title", canonicalStatus: "In Planning",
      nativeStatus: "in_planning", nativeView: rawTask,
    },
  });
  assert.equal(publication.evidence.remotePublishedTask, undefined);
  const record = reservePublishedBeads(f, { baseRef, publication }, {
    git: {
      repositoryRoot: () => f.root,
      head: () => assert.fail("reservation does not approve a frozen code HEAD"),
      status: () => assert.fail("reservation does not approve whole-code cleanliness"),
    },
  });
  assert.equal(record.baseRef, baseRef);
  assert.equal(record.providerRevision, publication.evidence.submittedRevision);
  assert.deepEqual(record.taskEvidence, rawTask);
  assert.deepEqual(readEpisodeOwnership(f.root, unrelated.ownerSessionId), unrelated);
  assert.equal(git(f.root, "rev-parse", "HEAD"), headBefore);
  assert.equal(git(f.root, "status", "--porcelain=v1", "--untracked-files=all"), statusBefore);
  assert.deepEqual(readFileSync(join(f.root, ".git", "index")), indexBefore);
  assert.equal(readFileSync(join(f.root, "unrelated.txt"), "utf8"), "unstaged work\n");
  assert.equal(readFileSync(join(f.root, "untracked.txt"), "utf8"), "untouched native absence\n");
});

test("Beads reservation retains exact task, revision and root targeting", () => {
  const f = fixture();
  const mismatched = publishedBeadsStatus(f);
  mismatched.evidence.taskAfterPush.nativeView.id = "OTHER-1";
  assert.throws(() => reservePublishedBeads(f, { publication: mismatched }), /raw native evidence for the exact task/);
  assert.throws(() => reservePublishedBeads(f, {
    publication: publishedBeadsStatus(f, { submittedRevision: "invalid" }),
  }), /exact observed candidate provider revision/);
  assert.throws(() => reservePublishedBeads(f, {
    publication: publishedBeadsStatus(f, { projectRoot: mkdtempSync(join(tmpdir(), "foreign-beads-reservation-")) }),
  }), /different project/);
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

test("prepared Beads observations preserve the prior record until handoff admission commits them", () => {
  const f = evidenceAdvancementFixture();
  const prepared = prepareEvidence(f);
  assert.deepEqual(readEpisodeOwnership(f.root, f.owner.ownerSessionId), f.owner);
  assert.deepEqual(prepared.previousTaskEvidence, f.owner.taskEvidence);
  assert.deepEqual(prepared.currentTaskEvidence, f.currentTaskEvidence);
  assert.deepEqual(prepared.commit(), prepared.record);
  assert.deepEqual(readEpisodeOwnership(f.root, f.owner.ownerSessionId), prepared.record);
});

test("Beads evidence refresh observes the native revision and raw task once without paired publication approval", () => {
  const f = evidenceAdvancementFixture();
  const provider = evidenceAdvancementProvider(f);
  const order = [];
  let synchronization, preparation, currentTask;
  const result = advanceEvidence(f, {}, {
    ...provider,
    synchronize: (...args) => {
      order.push("pull");
      synchronization = provider.synchronize(...args);
      return synchronization;
    },
    prepareTransport: (...args) => {
      order.push("observe");
      preparation = provider.prepareTransport(...args);
      assert.equal(preparation.evidence.publishedRevision, undefined);
      assert.deepEqual(preparation.evidence.workingSet, [{ table_name: "unrelated_task", status: "modified" }]);
      return preparation;
    },
    resolveTask: (...args) => {
      order.push("read");
      currentTask = provider.resolveTask(...args);
      return currentTask;
    },
  });

  assert.deepEqual(order, ["pull", "observe", "read"]);
  assert.equal(result.previousProviderRevision, f.owner.providerRevision);
  assert.equal(result.currentProviderRevision, f.currentProviderRevision);
  assert.deepEqual(result.previousTaskEvidence, f.owner.taskEvidence);
  assert.deepEqual(result.currentTaskEvidence, f.currentTaskEvidence);
  assert.equal(result.synchronization, synchronization);
  assert.equal(result.preparation, preparation);
  assert.equal(result.currentTask, currentTask);
  assert.equal(Object.hasOwn(result, "publishedProviderRevision"), false);
  assert.equal(Object.hasOwn(result.preparation.evidence, "publishedRevision"), false);
  const changed = Object.keys(result.record).filter((key) =>
    JSON.stringify(result.record[key]) !== JSON.stringify(f.owner[key]));
  assert.deepEqual(changed.sort(), ["head", "providerRevision", "taskEvidence", "updatedAt"]);
  assert.equal(result.record.head, f.reviewedHead);
  assert.equal(result.record.providerRevision, f.currentProviderRevision);
  assert.deepEqual(result.record.taskEvidence, f.currentTaskEvidence);
  assert.equal(result.record.updatedAt, "2026-10-20T22:00:00.000Z");
  assert.deepEqual(readEpisodeOwnership(f.root, f.owner.ownerSessionId), result.record);
  assert.deepEqual(readEpisodeOwnership(f.root, f.unrelated.ownerSessionId), f.unrelated);
});

test("published Beads evidence refresh accepts a prior blocked observation when current native task resumed", () => {
  const f = evidenceAdvancementFixture();
  const blockedOwner = parseEpisodeOwnership({
    ...f.owner,
    taskEvidence: {
      ...f.owner.taskEvidence,
      status: "blocked",
      notes: "Accepted blocker with exact unblock condition.",
    },
  });
  writeEpisodeOwnership(f.root, blockedOwner);
  f.owner = blockedOwner;
  const result = advanceEvidence(f);
  assert.equal(result.previousTaskEvidence.status, "blocked");
  assert.equal(result.currentTaskEvidence.status, "in_progress");
  assert.equal(result.record.taskEvidence.status, "in_progress");
  const changed = Object.keys(result.record).filter((key) =>
    JSON.stringify(result.record[key]) !== JSON.stringify(blockedOwner[key]));
  assert.deepEqual(changed.sort(), ["head", "providerRevision", "taskEvidence", "updatedAt"]);
});

test("owner-authored and compatible outside same-task Beads changes both advance as factual observations", () => {
  const ownerAuthored = evidenceAdvancementFixture();
  const ownerResult = advanceEvidence(ownerAuthored);
  assert.deepEqual(ownerResult.previousTaskEvidence, ownerAuthored.owner.taskEvidence);
  assert.deepEqual(ownerResult.currentTaskEvidence, ownerAuthored.currentTaskEvidence);
  assert.deepEqual(ownerResult.record.taskEvidence, ownerAuthored.currentTaskEvidence);

  const outside = evidenceAdvancementFixture();
  const outsideEvidence = {
    ...outside.owner.taskEvidence,
    design: "Compatible outside edit within the approved task scope",
    comments: [...outside.owner.taskEvidence.comments, { body: "outside writer added useful context" }],
    provider_native_tail: { marker: "outside-compatible-long-tail", opaque: [1, { two: 2 }] },
  };
  const outsideResult = advanceEvidence(outside, {}, evidenceAdvancementProvider(outside, {
    currentTaskEvidence: outsideEvidence,
  }));
  assert.deepEqual(outsideResult.previousTaskEvidence, outside.owner.taskEvidence);
  assert.deepEqual(outsideResult.currentTaskEvidence, outsideEvidence);
  assert.deepEqual(outsideResult.record.taskEvidence, outsideEvidence);
});

test("native observation failure is reported without ownership writes", () => {
  const f = evidenceAdvancementFixture();
  let ownerWrites = 0;
  assert.throws(() => advanceEvidence(f, {}, {
    prepareTransport: () => ({
      status: "blocked",
      code: "revision",
      detail: "native SQL read failed",
      remediation: "Inspect the reported native failure",
    }),
    ownership: {
      read: (root, ownerSessionId) => readEpisodeOwnership(root, ownerSessionId),
      mutate: () => {
        ownerWrites += 1;
        throw new Error("ownership mutation must not run after native failure");
      },
    },
  }), /native observation is blocked.*native SQL read failed/);
  assert.equal(ownerWrites, 0);
  assert.deepEqual(readEpisodeOwnership(f.root, f.owner.ownerSessionId), f.owner);
});

test("Beads evidence refresh passes changed lifecycle, design, history and prior observations to the LLM as facts", () => {
  const f = evidenceAdvancementFixture();
  const priorRevision = "b".repeat(32);
  const priorTask = { ...f.owner.taskEvidence, notes: "Earlier caller observation" };
  const currentTaskEvidence = {
    ...f.currentTaskEvidence, status: "blocked", design: "TBD",
    comments: [{ body: "Native raw facts, not lifecycle approval" }],
  };
  const result = advanceEvidence(f, {
    previousProviderRevision: priorRevision, previousTaskEvidence: priorTask,
  }, evidenceAdvancementProvider(f, {
    currentTaskEvidence, canonicalStatus: "Blocked",
    dependencies: {
      prepareTransport: () => ({
        status: "ready",
        evidence: {
          provider: "beads", projectRoot: f.root, database: "evidence", branch: "main",
          revision: "d".repeat(32), publishedRevision: "a".repeat(32),
          workingSet: [{ table_name: "issues", status: "modified" }],
        },
      }),
    },
  }));
  assert.equal(result.previousProviderRevision, priorRevision);
  assert.deepEqual(result.previousTaskEvidence, priorTask);
  assert.equal(result.record.providerRevision, "d".repeat(32));
  assert.equal(result.currentProviderRevision, "d".repeat(32));
  assert.deepEqual(result.currentTaskEvidence, currentTaskEvidence);
  assert.deepEqual(result.record.taskEvidence, currentTaskEvidence);
  assert.deepEqual(readEpisodeOwnership(f.root, f.unrelated.ownerSessionId), f.unrelated);
});

test("foreign linked provider context is rejected before the sole native pull", () => {
  const f = evidenceAdvancementFixture();
  let pulls = 0;
  assert.throws(() => prepareEvidence(f, {}, {
    detectProvider: (cwd) => ({
      kind: "selected",
      projectRoot: cwd,
      evidence: {
        provider: "beads",
        storeDir: cwd,
        metadataPath: cwd,
        configPath: cwd,
        doltMode: "server",
        doltDatabase: cwd === f.episodeRoot ? "foreign" : "evidence",
      },
    }),
    synchronize: () => {
      pulls += 1;
      return { status: 0, stdout: "must not pull", stderr: "" };
    },
  }), /does not resolve the exact canonical provider store and database/);
  assert.equal(pulls, 0);
  assert.deepEqual(readEpisodeOwnership(f.root, f.owner.ownerSessionId), f.owner);
});

test("native synchronization failure is not retried and changes no evidence", () => {
  const f = evidenceAdvancementFixture();
  let pulls = 0;
  assert.throws(() => advanceEvidence(f, {}, {
    synchronize: () => {
      pulls += 1;
      return { status: 1, stdout: "", stderr: "merge conflict" };
    },
  }), /native synchronization failed.*merge conflict/);
  assert.equal(pulls, 1);
  assert.deepEqual(readEpisodeOwnership(f.root, f.owner.ownerSessionId), f.owner);
  assert.deepEqual(readEpisodeOwnership(f.root, f.unrelated.ownerSessionId), f.unrelated);
});

test("Beads advancement preserves exact owner/store mutation without pushed-head approval", () => {
  const f = evidenceAdvancementFixture();
  assert.throws(() => advanceEvidence(f, { ownerSessionId: "foreign-owner" }), /no ownership for the exact requesting owner/);

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
  cleanGit.status = () => { throw new Error("no code cleanliness approval"); };
  cleanGit.upstreamHead = () => { throw new Error("no upstream approval"); };
  cleanGit.directRemoteHead = () => { throw new Error("no direct-remote approval"); };
  cleanGit.isAncestor = () => { throw new Error("no ancestry approval"); };
  assert.equal(prepareEvidence(f, {}, { git: cleanGit }).commit().head, f.reviewedHead);
  writeEpisodeOwnership(f.root, f.owner);
  assert.throws(() => prepareEvidence(f, {}, { git: { ...cleanGit, branch: () => "foreign" } }), /exact recorded Episode repository and branch/);

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

for (const [name, selection] of [
  ["pre-admission status", { status: "In Planning" }],
  ["blank plan", { implementationPlan: "   " }],
  ["placeholder plan", { implementationPlan: "TBD" }],
  ["TODO-prefixed placeholder plan", { implementationPlan: "TODO: write implementation plan" }],
  ["multiline placeholder plan", { implementationPlan: "TBD\nTODO" }],
  ["Markdown-framed placeholder plan", { implementationPlan: "# Implementation Plan\nTBD" }],
]) test(`${name} remains an editable-workflow decision, not a reservation predicate`, () => {
  const f = fixture();
  const before = { bytes: readFileSync(f.taskPath), head: git(f.root, "rev-parse", "HEAD"), index: git(f.root, "diff", "--cached", "--binary") };
  const record = reserve(f, { selection });
  assert.equal(record.taskId, f.selection.taskId);
  assert.equal(record.taskPath, f.relative);
  assert.equal(record.baseRef, before.head);
  assert.equal(record.status, "provisioning");
  assert.deepEqual(readFileSync(f.taskPath), before.bytes);
  assert.equal(git(f.root, "rev-parse", "HEAD"), before.head);
  assert.equal(git(f.root, "diff", "--cached", "--binary"), before.index);
});

test("noncanonical task id cannot reserve ownership", () => {
  const f = fixture();
  assert.throws(() => reserve(f, { selection: { taskId: "--bad" } }), /canonical Backlog task ID/);
  assert.equal(readEpisodeOwnership(f.root), null);
});

test("status commit containing another path cannot reserve ownership", () => {
  const f = fixture({ extraStatusPath: true });
  assert.throws(() => reserve(f), /only the exact Backlog task path/);
  assert.equal(readEpisodeOwnership(f.root), null);
});

test("reservation preserves current selected-task edits without a status-plan-dirt reapproval gate", () => {
  const f = fixture();
  writeFileSync(f.taskPath, "status: custom\nplan: compatible edit after commit\n");
  const bytes = readFileSync(f.taskPath);
  const record = reserve(f, { selection: { status: "custom", implementationPlan: null } });
  assert.equal(record.taskId, f.selection.taskId);
  assert.deepEqual(readFileSync(f.taskPath), bytes);
  assert.notEqual(git(f.root, "status", "--porcelain", "--", f.relative), "");
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


function switchContinuity(...records) {
  return {
    expectedSourceRecords: Object.fromEntries(records.map((record) => [record.ownerSessionId, record])),
    runtimeProofs: Object.fromEntries(records.map((record) => [record.ownerSessionId, {
      expectedPreviousEpisodeActiveSessionId: record.episodeActiveSessionId,
      verifiedCurrentEpisodeActiveSessionId: record.episodeActiveSessionId,
    }])),
  };
}

test("provider switch atomically preserves active Episode identity and exact rollback", () => {
  const { root } = fixture();
  const worktree = join(root, "episode-worktree");
  mkdirSync(worktree);
  const sessionFile = join(worktree, "episode.jsonl");
  writeFileSync(sessionFile, "{}\n");
  const original = parseEpisodeOwnership({
    version: 2,
    status: "active",
    operationId: "operation-switch",
    engine: "local",
    ownerSessionId: "owner-switch",
    taskId: "PRIMECLAW-10.38",
    taskPath: "backlog/tasks/primeclaw-10.38.md",
    baseRef: "a".repeat(40),
    createdAt: "2026-10-18T12:00:00.000Z",
    updatedAt: "2026-10-18T12:00:00.000Z",
    worktree,
    branch: "episode/switch",
    head: "b".repeat(40),
    episodeId: "episode-switch",
    episodeSessionFile: sessionFile,
    episodeActiveSessionId: "route-switch",
  });
  const inactive = parseEpisodeOwnership({
    ...original,
    status: "inactive",
    operationId: "operation-inactive",
    ownerSessionId: "owner-inactive",
    taskId: "PRIMECLAW-OLD",
    taskPath: "backlog/completed/primeclaw-old.md",
    episodeId: "episode-inactive",
  });
  writeEpisodeOwnership(root, original);
  writeEpisodeOwnership(root, inactive);
  const rawEvidence = { id: "BEAD-7", title: "Migrated task", status: "in_progress", opaque: { exact: true } };
  const switched = switchActiveTaskProviderOwnership(root, {
    sourceProvider: "backlog",
    targetProvider: "beads",
    switchedAt: "2026-10-27T12:00:00.000Z",
    ...switchContinuity(original),
    destinations: {
      "PRIMECLAW-10.38": { taskId: "BEAD-7", providerRevision: "c".repeat(32), taskEvidence: rawEvidence },
    },
  });
  assert.deepEqual(switched.transitions, [{ ownerSessionId: "owner-switch", sourceTaskId: "PRIMECLAW-10.38", destinationTaskId: "BEAD-7" }]);
  const current = readEpisodeOwnership(root, "owner-switch");
  assert.equal(current.provider, "beads");
  assert.equal(current.taskId, "BEAD-7");
  assert.equal(current.providerRevision, "c".repeat(32));
  assert.deepEqual(current.taskEvidence, rawEvidence);
  assert.equal(current.taskPath, undefined);
  for (const field of ["operationId", "ownerSessionId", "baseRef", "createdAt", "worktree", "branch", "head", "episodeId", "episodeSessionFile", "episodeActiveSessionId"]) {
    assert.deepEqual(current[field], original[field], field);
  }
  assert.deepEqual(readEpisodeOwnership(root, "owner-inactive"), inactive);
  const restored = restoreTaskProviderOwnershipSwitch(root, switched);
  assert.deepEqual(restored, switched.before);
  assert.deepEqual(readEpisodeOwnership(root, "owner-switch"), original);
});

test("provider switch refuses missing mappings and rollback refuses concurrent registry drift", () => {
  const { root } = fixture();
  const original = taskOwnership("owner-switch", "PRIMECLAW-10.38");
  writeEpisodeOwnership(root, original);
  assert.throws(() => switchActiveTaskProviderOwnership(root, {
    sourceProvider: "backlog", targetProvider: "beads", switchedAt: "2026-10-27T12:00:00.000Z", ...switchContinuity(original), destinations: {},
  }), /no verified destination mapping/);
  const switched = switchActiveTaskProviderOwnership(root, {
    sourceProvider: "backlog", targetProvider: "beads", switchedAt: "2026-10-27T12:00:00.000Z",
    ...switchContinuity(original),
    destinations: { "PRIMECLAW-10.38": { taskId: "BEAD-8", providerRevision: "d".repeat(32), taskEvidence: { id: "BEAD-8", title: "Migrated", status: "in_progress" } } },
  });
  writeEpisodeOwnership(root, parseEpisodeOwnership({ ...readEpisodeOwnership(root, "owner-switch"), updatedAt: "2026-10-27T12:00:01.000Z" }));
  assert.throws(() => restoreTaskProviderOwnershipSwitch(root, switched), /registry changed after the switch/);
});


test("provider switch to Backlog requires a verified destination path before registry mutation", () => {
  const { root } = fixture();
  const original = beadsOwnership("owner-beads-switch", "BEAD-9");
  writeEpisodeOwnership(root, original);
  assert.throws(() => switchActiveTaskProviderOwnership(root, {
    sourceProvider: "beads",
    targetProvider: "backlog",
    switchedAt: "2026-10-27T12:00:00.000Z",
    ...switchContinuity(original),
    destinations: {
      "BEAD-9": { taskId: "TASK-9", providerRevision: "e".repeat(40), taskEvidence: { task: { id: "TASK-9", status: "In Progress" } } },
    },
  }), /no verified Backlog task path/);
  assert.deepEqual(readEpisodeOwnership(root, "owner-beads-switch"), original);
});


test("provider switch rejects colliding destination task identity before registry mutation", () => {
  const { root } = fixture();
  const first = taskOwnership("owner-switch-one", "PRIMECLAW-10.38");
  const second = taskOwnership("owner-switch-two", "PRIMECLAW-10.39");
  writeEpisodeOwnership(root, first);
  writeEpisodeOwnership(root, second);
  const before = readEpisodeOwnershipRegistry(root);
  assert.throws(() => switchActiveTaskProviderOwnership(root, {
    sourceProvider: "backlog", targetProvider: "beads", switchedAt: "2026-10-27T12:00:00.000Z",
    ...switchContinuity(first, second),
    destinations: {
      "PRIMECLAW-10.38": { taskId: "BEAD-COLLISION", providerRevision: "f".repeat(32), taskEvidence: { id: "BEAD-COLLISION", title: "Migrated collision", status: "in_progress" } },
      "PRIMECLAW-10.39": { taskId: "BEAD-COLLISION", providerRevision: "f".repeat(32), taskEvidence: { id: "BEAD-COLLISION", title: "Migrated collision", status: "in_progress" } },
    },
  }), /mapped more than once/);
  assert.deepEqual(readEpisodeOwnershipRegistry(root), before);
});


test("provider switch binds only the freshly verified runtime route", () => {
  const { root } = fixture();
  const original = taskOwnership("owner-route-refresh", "PRIMECLAW-ROUTE");
  writeEpisodeOwnership(root, original);
  switchActiveTaskProviderOwnership(root, {
    sourceProvider: "backlog", targetProvider: "beads", switchedAt: "2026-10-27T12:00:00.000Z",
    destinations: { "PRIMECLAW-ROUTE": { taskId: "BEAD-ROUTE", providerRevision: "a".repeat(32), taskEvidence: { id: "BEAD-ROUTE", title: "route", status: "in_progress" } } },
    expectedSourceRecords: { [original.ownerSessionId]: original },
    runtimeProofs: { [original.ownerSessionId]: { expectedPreviousEpisodeActiveSessionId: original.episodeActiveSessionId, verifiedCurrentEpisodeActiveSessionId: "verified-new-route" } },
  });
  assert.equal(readEpisodeOwnership(root, original.ownerSessionId).episodeActiveSessionId, "verified-new-route");
});

test("destructive provider boundary refuses registry drift under the existing ownership lock", () => {
  const { root } = fixture();
  const original = taskOwnership("owner-guarded-delete", "PRIMECLAW-GUARD");
  writeEpisodeOwnership(root, original);
  const switched = switchActiveTaskProviderOwnership(root, {
    sourceProvider: "backlog", targetProvider: "beads", switchedAt: "2026-10-27T12:00:00.000Z",
    destinations: { "PRIMECLAW-GUARD": { taskId: "BEAD-GUARD", providerRevision: "b".repeat(32), taskEvidence: { id: "BEAD-GUARD", title: "guard", status: "in_progress" } } },
    ...switchContinuity(original),
  });
  let operations = 0;
  withCurrentTaskProviderOwnershipSwitch(root, switched, () => { operations += 1; });
  writeEpisodeOwnership(root, parseEpisodeOwnership({ ...readEpisodeOwnership(root, original.ownerSessionId), updatedAt: "2026-10-27T12:00:01.000Z" }));
  assert.throws(() => withCurrentTaskProviderOwnershipSwitch(root, switched, () => { operations += 1; }), /ownership changed after the switch/);
  assert.equal(operations, 1);
});


test("provider switch preserves raw inactive cleanup compatibility fields and exact rollback", () => {
  const { root } = fixture();
  const original = activeTaskOwnership("switch-owner", "PRIMECLAW-SWITCH");
  const inactive = { ...activeTaskOwnership("historical-owner", "PRIMECLAW-OLD"), status: "inactive", cleanupHead: "d".repeat(40) };
  writeEpisodeOwnership(root, original);
  const path = join(root, ".prime-claw", "ownership.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  raw.owners[original.ownerSessionId].cleanupHead = "e".repeat(40);
  raw.owners[inactive.ownerSessionId] = inactive;
  writeFileSync(path, JSON.stringify(raw));
  const switched = switchActiveTaskProviderOwnership(root, {
    sourceProvider: "backlog", targetProvider: "beads", switchedAt: "2026-10-27T12:00:00.000Z",
    ...switchContinuity(original),
    destinations: { [original.taskId]: { taskId: "BEAD-SWITCH", providerRevision: "f".repeat(32), taskEvidence: { id: "BEAD-SWITCH", title: "Migrated", status: "in_progress" } } },
  });
  const after = JSON.parse(readFileSync(path, "utf8"));
  assert.deepEqual(after.owners[inactive.ownerSessionId], inactive);
  assert.equal(after.owners[original.ownerSessionId].cleanupHead, undefined);
  let guarded = false;
  withCurrentTaskProviderOwnershipSwitch(root, switched, () => { guarded = true; });
  assert.equal(guarded, true);
  restoreTaskProviderOwnershipSwitch(root, switched);
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), raw);
});

test("atomic task removal handles provider-native Beads evidence without a Backlog task path", () => {
  const { root } = fixture();
  const { taskPath: _taskPath, ...resourceBinding } = activeTaskOwnership();
  const record = parseEpisodeOwnership({ ...resourceBinding, ...beadsOwnership("owner", "BEAD-CLEANUP"), status: "active" });
  writeEpisodeOwnership(root, record);
  const expected = readEpisodeOwnership(root, "owner");
  assert.equal(expected.provider, "beads");
  assert.equal(expected.taskPath, undefined);
  removeTaskEpisodeOwnership(root, expected);
  assert.equal(readEpisodeOwnership(root, "owner"), null);
});

test("registered Beads continuation delivers current raw/code/session facts without old design or code-publication approval", async () => {
  const f = evidenceAdvancementFixture();
  f.owner = parseEpisodeOwnership({ ...f.owner, taskEvidence: { ...f.owner.taskEvidence, design: null } });
  writeEpisodeOwnership(f.root, f.owner);
  f.currentTaskEvidence = { ...f.currentTaskEvidence, status: "native-unknown", notes: "current raw refinement" };
  delete f.currentTaskEvidence.design;
  mkdirSync(join(f.episodeRoot, ".agents", "skills", "execute"), { recursive: true });
  mkdirSync(join(f.episodeRoot, ".prime-claw", "workflows"), { recursive: true });
  writeFileSync(join(f.episodeRoot, ".agents", "skills", "execute", "SKILL.md"), "EXECUTE RAW NATIVE FACTS\n");
  writeFileSync(join(f.episodeRoot, ".prime-claw", "workflows", "handoff.md"), "HANDOFF RAW NATIVE FACTS\n");
  // The managed handoff directory is already Git-ignored by this fixture.
  // Keep it readable there; only the tracked execute workflow needs a commit.
  git(f.episodeRoot, "add", "--", ".agents/skills/execute/SKILL.md");
  git(f.episodeRoot, "commit", "-q", "-m", "install fixture continuation workflows");
  f.reviewedHead = git(f.episodeRoot, "rev-parse", "HEAD");
  // Leave the new fixture commit unpublished and unrelated index/bytes dirty.
  writeFileSync(join(f.episodeRoot, "candidate.txt"), "staged unrelated code\n");
  git(f.episodeRoot, "add", "candidate.txt");
  writeFileSync(join(f.episodeRoot, "candidate.txt"), "unstaged unrelated code\n");
  writeFileSync(join(f.episodeRoot, "untracked.txt"), "untracked unrelated code\n");
  const before = [git(f.episodeRoot, "rev-parse", "HEAD"), git(f.episodeRoot, "ls-files", "--stage"),
    readFileSync(join(f.episodeRoot, "candidate.txt"), "utf8"), readFileSync(join(f.episodeRoot, "untracked.txt"), "utf8")];
  const provider = evidenceAdvancementProvider(f);
  const session = {
    activeSessionId: f.owner.episodeActiveSessionId, sessionId: f.owner.episodeId,
    sessionFile: f.owner.episodeSessionFile, cwd: f.episodeRoot,
    isSessionActive: false, isStreaming: false, isCompacting: false, isBashRunning: false,
    isRunningTools: true, hasRunningRlmChildren: true, unfinishedActionCount: 3,
    sessionActions: { queuedCount: 0, steering: [], followUps: [], active: null },
  };
  let deliveries = 0;
  let advancement;
  const ctx = {
    cwd: f.root,
    sessionManager: {
      getSessionId: () => f.owner.ownerSessionId,
      getSessionFile: () => join(f.root, "owner.jsonl"), getHeader: () => ({ rlmDepth: 0 }),
    },
  };
  const tools = new Map();
  createReviewedPlanExtension({
    advanceBeadsEvidence(input) {
      advancement = advancePublishedBeadsTaskEpisodeEvidence(input, provider);
      return advancement;
    },
    publisher: {
      async list() { return [session]; },
      async getState() { return session; },
      async deliverHandoff(route, handoff, execute, onHandoffAdmitted) {
        deliveries += 1;
        assert.equal(route, f.owner.episodeActiveSessionId);
        assert.deepEqual(readEpisodeOwnership(f.root, f.owner.ownerSessionId), f.owner);
        for (const prompt of [handoff, execute]) {
          const facts = JSON.parse(prompt.match(/(?:^|\n)<provider-task-observation>\r?\n([\s\S]*?)\r?\n<\/provider-task-observation>/)[1]);
          assert.equal(facts.currentProviderRevision, f.currentProviderRevision);
          assert.equal(Object.hasOwn(facts, "publishedProviderRevision"), false);
          assert.deepEqual(facts.previousTaskEvidence, f.owner.taskEvidence);
          assert.deepEqual(facts.currentTaskEvidence, f.currentTaskEvidence);
          assert.deepEqual(facts.synchronization, advancement.synchronization);
          assert.deepEqual(facts.preparation, advancement.preparation);
          assert.deepEqual(facts.currentTask, advancement.currentTask);
          assert.equal(Object.hasOwn(facts.preparation.evidence, "publishedRevision"), false);
          assert.match(prompt, /native pull qualification/);
          assert.match(prompt, /native observation warning/);
          assert.match(prompt, /remote task publication not observed/);
          assert.match(facts.episodeCode.status.stdout, /candidate.txt/);
          assert.notEqual(facts.episodeCode.head, facts.episodeCode.upstream.stdout.trim());
          const sessionFacts = JSON.parse(prompt.match(/(?:^|\n)<episode-session-observation>\r?\n([\s\S]*?)\r?\n<\/episode-session-observation>/)[1]);
          assert.equal(sessionFacts.state.hasRunningRlmChildren, true);
          assert.equal(Object.hasOwn(facts.currentTaskEvidence, "design"), false);
        }
        assert.match(handoff, /accepted bounded revision/);
        assert.doesNotMatch(execute, /accepted bounded revision/);
        await onHandoffAdmitted();
        assert.equal(readEpisodeOwnership(f.root, f.owner.ownerSessionId).providerRevision, f.currentProviderRevision);
      },
      async createFresh() { assert.fail("continuation must not create a session"); },
      async deliverExecute() { assert.fail("continuation must not send a second initial assignment"); },
      async reopen() { assert.fail("same live session must remain bound"); },
      close() {},
    },
  })({
    registerCommand() {}, registerTool(tool) { tools.set(tool.name, tool); }, on() {},
    sendUserMessage() {}, async sendMessage() {},
  });
  const toolResult = await tools.get("handoff_task_episode").execute("continue", {
    taskId: f.taskId, guidance: "accepted bounded revision",
  }, undefined, undefined, ctx);
  assert.equal(toolResult.isError, undefined, toolResult.content[0].text);
  const result = toolResult.details;
  assert.equal(result.providerTaskObservation.currentTaskEvidence.status, "native-unknown");
  assert.ok(toolResult.content[0].text.includes(JSON.stringify(result.providerTaskObservation)), "the invoking LLM gets facts in tool text, not only UI details");
  assert.deepEqual([git(f.episodeRoot, "rev-parse", "HEAD"), git(f.episodeRoot, "ls-files", "--stage"),
    readFileSync(join(f.episodeRoot, "candidate.txt"), "utf8"), readFileSync(join(f.episodeRoot, "untracked.txt"), "utf8")], before);
  assert.equal(deliveries, 1);
  assert.equal(result.episodeId, f.owner.episodeId);
  assert.equal(result.episodeActiveSessionId, f.owner.episodeActiveSessionId);
  const stored = readEpisodeOwnership(f.root, f.owner.ownerSessionId);
  const changed = Object.keys(stored).filter((key) => JSON.stringify(stored[key]) !== JSON.stringify(f.owner[key]));
  assert.deepEqual(changed.sort(), ["head", "providerRevision", "taskEvidence", "updatedAt"]);
  assert.equal(Object.hasOwn(stored, "preparation"), false);
  assert.deepEqual(readEpisodeOwnership(f.root, f.unrelated.ownerSessionId), f.unrelated);
});
