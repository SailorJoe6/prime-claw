import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import test from "node:test";

import {
  CliOrcaAdapter,
  CliTaskEpisodeAdmissionGit,
  bundleContentDigest,
  commitConversationTaskStatus,
  createSpecEpisode,
  createTaskEpisode,
  handoffTaskEpisode,
  OrcaUnavailableError,
  resolveTaskEpisodePlacement,
} from "../src/prime-agent-plugin/extension-support/spec-episode.ts";
import {
  resolveBacklogTask,
} from "../src/prime-agent-plugin/extension-support/reviewed-plan-support.ts";
import {
  prepareEpisodeTaskHistoryWorkspace,
  prepareTaskHistoryWorkspace,
  publishTaskHistoryMutation,
  TASK_HISTORY_REF,
} from "../src/prime-agent-plugin/extension-support/task-history-workspace.ts";
import {
  readAllEpisodeOwnership,
  readEpisodeOwnership,
  writeEpisodeOwnership,
} from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";
import { reconcileLegacySpecificationInventory } from "../src/prime-agent-plugin/extension-support/legacy-specification-inventory.ts";

import { createReviewedPlanExtension } from "../src/prime-agent-plugin/extensions/reviewed-plan.ts";

const ROOT = realpathSync(join(dirname(fileURLToPath(import.meta.url)), ".."));
const RUNTIME_BACKLOG = "/usr/local/bin/backlog";
const BACKLOG = process.platform === "linux" && existsSync(RUNTIME_BACKLOG)
  ? RUNTIME_BACKLOG
  : join(ROOT, "deps", "backlog", "dist", "backlog");

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

class FixtureRunner {
  run(command, args, options = {}) {
    const result = spawnSync(command === "backlog" ? BACKLOG : command, args, {
      cwd: options.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const response = {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? result.error?.message ?? "",
      status: result.status ?? 1,
    };
    if (response.status !== 0 && !options.allowFailure) {
      throw new Error(`${command} ${args.join(" ")} failed: ${response.stderr || `exit ${response.status}`}`);
    }
    return response;
  }
}

function view(root, taskId = "PRIMECLAW-1") {
  return JSON.parse(execFileSync(BACKLOG, ["task", "view", "--json", "--", taskId], {
    cwd: root,
    encoding: "utf8",
  })).task;
}

function fixture() {
  const rawRoot = mkdtempSync(join(tmpdir(), "prime-claw-task-admission-"));
  const root = realpathSync(rawRoot);
  mkdirSync(join(root, "backlog"), { recursive: true });
  copyFileSync(join(ROOT, "tests", "fixtures", "backlog-admission-config.yml"), join(root, "backlog", "config.yml"));
  git(root, "init", "-q");
  git(root, "config", "user.name", "Prime Claw Test");
  git(root, "config", "user.email", "prime-claw@example.invalid");
  writeFileSync(join(root, "unrelated.txt"), "baseline\n");
  git(root, "add", "--", "backlog/config.yml", "unrelated.txt");
  git(root, "commit", "-q", "-m", "fixture baseline");
  git(root, "branch", "-M", "main");
  execFileSync(BACKLOG, [
    "task", "create", "Task-native admission fixture",
    "--status", "In Planning",
    "--description", "Create one exact Episode",
    "--plan", "1. Create the bounded resource.\n2. Verify exact identity.",
    "--plain",
  ], { cwd: root, encoding: "utf8" });
  const task = view(root);
  git(root, "add", "--", task.path);
  git(root, "commit", "-q", "--only", "-m", "plan exact task", "--", task.path);
  writeFileSync(join(root, "unrelated.txt"), "unrelated working change\n");

  const records = new Map();
  const events = [];
  const ownership = {
    read(_projectRoot, ownerSessionId) {
      const record = ownerSessionId ? records.get(ownerSessionId) ?? null : (records.size <= 1 ? [...records.values()][0] ?? null : null);
      events.push(["ownership-read", record?.status ?? null]);
      return record;
    },
    write(_projectRoot, value) { records.set(value.ownerSessionId, value); events.push(["ownership-write", value.status]); },
  };
  const runner = new FixtureRunner();
  const taskResolver = (cwd, taskId) => resolveBacklogTask(cwd, taskId, runner);
  const ctx = {
    cwd: root,
    model: { provider: "test", id: "model" },
    sessionManager: {
      getSessionId: () => "owner-session",
      getSessionFile: () => join(root, "owner.jsonl"),
      getHeader: () => ({ rlmDepth: 0 }),
    },
  };
  const dependencies = {
    admissionGit: new CliTaskEpisodeAdmissionGit(),
    admissionRunner: runner,
    taskResolver,
    ownership,
    reservationOperationId: "operation-1234",
    now: () => "2026-10-13T09:00:00.000Z",
  };
  return { root, task, ctx, dependencies, ownership, events, get record() { return records.get("owner-session") ?? null; } };
}

function commitPaths(root, ref = "HEAD") {
  const output = git(root, "diff-tree", "--root", "--no-commit-id", "--name-only", "-r", ref, "--");
  return output ? output.split(/\r?\n/) : [];
}

test("independent Backlog admission keeps code and task DAGs separate and prepares task access before session start", async (t) => {
  if (!existsSync(BACKLOG)) { t.skip("managed backlog executable unavailable"); return; }
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-independent-admission-")));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, "repo");
  const remote = join(dir, "remote.git");
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  execFileSync("git", ["init", "-q", "--bare", remote]);
  git(root, "config", "user.name", "Prime Claw Test");
  git(root, "config", "user.email", "prime-claw@example.invalid");
  mkdirSync(join(root, ".agents", "skills", "execute"), { recursive: true });
  mkdirSync(join(root, ".prime-claw", "workflows"), { recursive: true });
  copyFileSync(join(ROOT, ".agents", "skills", "execute", "SKILL.md"), join(root, ".agents", "skills", "execute", "SKILL.md"));
  copyFileSync(join(ROOT, ".prime-claw", "workflows", "handoff.md"), join(root, ".prime-claw", "workflows", "handoff.md"));
  writeFileSync(join(root, "code.txt"), "code\n");
  git(root, "add", ".agents/skills/execute/SKILL.md", ".prime-claw/workflows/handoff.md", "code.txt");
  git(root, "commit", "-qm", "code baseline");
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "-qu", "origin", "main");
  const runner = new FixtureRunner();
  const prepared = prepareTaskHistoryWorkspace({ primaryRoot: root, runner });
  assert.equal(prepared.status, "prepared");
  git(prepared.storeDir, "config", "user.name", "Prime Claw Test");
  git(prepared.storeDir, "config", "user.email", "prime-claw@example.invalid");
  const created = execFileSync(BACKLOG, [
    "task", "create", "Independent admission", "--status", "In Planning",
    "--description", "Keep task history separate from code",
    "--plan", "1. Prepare the nested task checkout.\n2. Start execute from the clean code head.", "--plain",
  ], { cwd: root, encoding: "utf8" });
  assert.match(created, /created/i);
  const listed = JSON.parse(execFileSync(BACKLOG, ["task", "list", "--json"], { cwd: root, encoding: "utf8" }));
  const taskId = listed.tasks?.[0]?.id;
  assert.ok(taskId);
  const task = view(root, taskId);
  git(prepared.storeDir, "add", ".");
  git(prepared.storeDir, "commit", "-qm", "plan independent task");
  git(prepared.storeDir, "push", "-q", "origin", `HEAD:${TASK_HISTORY_REF}`);
  const plannedTaskHead = git(prepared.storeDir, "rev-parse", "HEAD");
  git(root, "add", ".gitignore");
  git(root, "commit", "-qm", "ignore independent task store");
  git(root, "push", "-q");
  writeFileSync(join(root, "local-base.txt"), "intentional unpublished code base\n");
  git(root, "add", "local-base.txt");
  git(root, "commit", "-qm", "selected local code base");
  const codeHead = git(root, "rev-parse", "HEAD");
  assert.notEqual(git(root, "rev-parse", "@{upstream}"), codeHead);
  writeFileSync(join(root, "code.txt"), "staged unrelated code\n");
  git(root, "add", "code.txt");
  writeFileSync(join(root, "code.txt"), "unstaged unrelated code\n");
  writeFileSync(join(root, "untracked-code.txt"), "untracked code\n");
  writeFileSync(join(prepared.storeDir, "admission-other.txt"), "staged unrelated ticket bytes\n");
  git(prepared.storeDir, "add", "admission-other.txt");
  writeFileSync(join(prepared.storeDir, "admission-other.txt"), "unstaged unrelated ticket bytes\n");
  writeFileSync(join(prepared.storeDir, "untracked-admission.txt"), "untracked task bytes\n");
  const unrelatedBefore = [git(root, "status", "--porcelain"), git(root, "diff", "--cached", "--binary"),
    git(prepared.storeDir, "diff", "--cached", "--binary"), readFileSync(join(prepared.storeDir, "admission-other.txt")),
    readFileSync(join(root, "code.txt")), readFileSync(join(root, "untracked-code.txt")), readFileSync(join(prepared.storeDir, "untracked-admission.txt"))];
  const records = new Map();
  const ownership = {
    read(_root, owner) { return owner ? records.get(owner) ?? null : [...records.values()][0] ?? null; },
    write(_root, record) { records.set(record.ownerSessionId, record); },
  };
  let preSessionView = null;
  let delivered = 0;
  let deliveredExecutePrompt = "";
  const publisher = {
    async createFresh(options) {
      assert.ok(existsSync(join(options.worktree, ".backlog", ".git")), "nested task checkout exists before session allocation");
      preSessionView = view(options.worktree, taskId);
      const identity = { sessionId: "independent-episode", sessionFile: join(dir, "independent-episode.jsonl") };
      writeFileSync(identity.sessionFile, "{}\n");
      await options.onAllocated?.(identity);
      return { ...identity, activeSessionId: "independent-route" };
    },
    async deliverExecute(_route, prompt) { delivered += 1; deliveredExecutePrompt = prompt; },
    close() {},
  };
  const ctx = { cwd: root, model: { provider: "test", id: "model" }, sessionManager: {
    getSessionId: () => "independent-owner", getSessionFile: () => join(dir, "owner.jsonl"), getHeader: () => ({ rlmDepth: 0 }),
  } };
  const taskResolver = (cwd, id) => resolveBacklogTask(cwd, id, runner);
  let preparationCalls = 0;
  let interleavedAdvance = null;
  let reservedProviderRevision = "";
  let reservedTaskEvidence = null;
  const prepareEpisodeTaskHistory = (input) => {
    preparationCalls += 1;
    if (preparationCalls === 1) {
      const reserved = records.get("independent-owner");
      reservedProviderRevision = reserved.providerRevision;
      reservedTaskEvidence = structuredClone(reserved.taskEvidence);
      interleavedAdvance = publishTaskHistoryMutation({
        primaryRoot: root, targetWorktree: root, taskId,
        edits: [{ option: "--append-notes", value: "compatible pre-session observation marker" }],
        runner,
      });
      assert.equal(interleavedAdvance.status, "published");
    }
    return prepareEpisodeTaskHistoryWorkspace(input);
  };
  const result = await createTaskEpisode(taskId, "independent-call", ctx, {
    admissionGit: new CliTaskEpisodeAdmissionGit(), admissionRunner: runner, taskResolver,
    prepareEpisodeTaskHistory, ownership, publisher,
    reservationOperationId: "independent-operation", now: () => "2026-10-26T20:00:00.000Z",
  }, { engine: "local" });
  const publishedTaskHead = git(prepared.storeDir, "rev-parse", "HEAD");
  assert.notEqual(publishedTaskHead, plannedTaskHead);
  assert.equal(git(root, "rev-parse", "HEAD"), codeHead);
  assert.deepEqual([git(root, "status", "--porcelain"), git(root, "diff", "--cached", "--binary"),
    git(prepared.storeDir, "diff", "--cached", "--binary"), readFileSync(join(prepared.storeDir, "admission-other.txt")),
    readFileSync(join(root, "code.txt")), readFileSync(join(root, "untracked-code.txt")), readFileSync(join(prepared.storeDir, "untracked-admission.txt"))], unrelatedBefore);
  assert.equal(result.baseRef, codeHead);
  assert.equal(result.head, codeHead);
  assert.equal(result.providerRevision, publishedTaskHead);
  assert.equal(result.providerRevision, interleavedAdvance.publishedHead);
  assert.equal(result.taskEvidence.task.id, taskId);
  assert.equal(result.taskEvidence.task.status, "In Progress");
  assert.match(result.taskEvidence.task.implementationNotes, /compatible pre-session observation marker/);
  assert.equal(preSessionView.id, taskId);
  assert.equal(preSessionView.status, "In Progress");
  assert.equal(delivered, 1);
  assert.equal(result.taskId, taskId);
  assert.equal(result.episodeId, "independent-episode");
  assert.equal(result.episodeActiveSessionId, "independent-route");
  assert.equal(preparationCalls, 1, "pre-session task context uses one preparation, not a paired stable-head approval");
  assert.match(deliveredExecutePrompt, /<provider-task-observation>/);
  assert.ok(deliveredExecutePrompt.includes(JSON.stringify(reservedTaskEvidence)));
  assert.ok(deliveredExecutePrompt.includes(JSON.stringify(result.taskEvidence)));
  assert.match(deliveredExecutePrompt, new RegExp(reservedProviderRevision));
  assert.match(deliveredExecutePrompt, new RegExp(interleavedAdvance.publishedHead));
  assert.doesNotMatch(deliveredExecutePrompt, /records observations, not semantic acceptance or a new authority/);
  assert.equal(git(result.worktree, "rev-parse", "HEAD"), codeHead);
  assert.equal(git(join(result.worktree, ".backlog"), "rev-parse", "HEAD"), publishedTaskHead);
  assert.notEqual(realpathSync(join(root, ".backlog", ".git")), realpathSync(join(result.worktree, ".backlog", ".git")));

  git(join(result.worktree, ".backlog"), "config", "user.name", "Prime Claw Test");
  git(join(result.worktree, ".backlog"), "config", "user.email", "prime-claw@example.invalid");
  const changedTask = publishTaskHistoryMutation({
    primaryRoot: root,
    targetWorktree: result.worktree,
    taskId,
    edits: [{ option: "--append-notes", value: "accepted handoff advance" }],
    runner,
  });
  assert.equal(changedTask.status, "published");
  let handoffs = 0;
  let activeRoute = "independent-route";
  const session = () => ({
    sessionId: "independent-episode", activeSessionId: activeRoute,
    sessionFile: join(dir, "independent-episode.jsonl"), cwd: result.worktree,
    isSessionActive: false, isStreaming: false, isCompacting: false, queuedCount: 0,
  });
  publisher.list = async () => [session()];
  publisher.reopen = async () => {
    activeRoute = "independent-reopened-route";
    return { sessionId: "independent-episode", sessionFile: join(dir, "independent-episode.jsonl"), activeSessionId: activeRoute };
  };
  publisher.getState = async () => ({
    ...session(), isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false,
    unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [], active: null },
  });
  let deliveredHandoff = "";
  let deliveredContinuation = "";
  publisher.deliverHandoff = async (_route, handoff, execute, onHandoffAdmitted) => {
    handoffs += 1;
    deliveredHandoff = handoff;
    deliveredContinuation = execute;
    await onHandoffAdmitted?.();
  };
  const handoffDependencies = {
    admissionRunner: runner, taskRunner: runner, taskResolver, ownership, publisher,
    prepareEpisodeTaskHistory,
    now: () => "2026-10-26T20:01:00.000Z",
  };
  const beforeHandoff = structuredClone(records.get("independent-owner"));
  writeFileSync(join(prepared.storeDir, "unrelated-primary.txt"), "staged primary task bytes\n");
  git(prepared.storeDir, "add", "unrelated-primary.txt");
  writeFileSync(join(prepared.storeDir, "unrelated-primary.txt"), "unstaged primary task bytes\n");
  writeFileSync(join(prepared.storeDir, "untracked-primary.txt"), "untracked primary task bytes\n");
  const primaryBeforeHandoff = [
    git(prepared.storeDir, "rev-parse", "HEAD"),
    git(prepared.storeDir, "diff", "--cached", "--binary"),
    readFileSync(join(prepared.storeDir, "unrelated-primary.txt")),
    readFileSync(join(prepared.storeDir, "untracked-primary.txt")),
    readFileSync(join(root, task.path)),
  ];
  assert.notEqual(primaryBeforeHandoff[0], changedTask.publishedHead, "primary task checkout is intentionally stale");
  writeFileSync(join(result.worktree, "unrelated-code.txt"), "staged Episode code\n");
  git(result.worktree, "add", "unrelated-code.txt");
  writeFileSync(join(result.worktree, "unrelated-code.txt"), "unstaged Episode code\n");
  writeFileSync(join(result.worktree, "untracked-code.txt"), "untracked Episode code\n");
  const codeBeforeHandoff = [git(result.worktree, "diff", "--cached", "--binary"),
    readFileSync(join(result.worktree, "unrelated-code.txt")), readFileSync(join(result.worktree, "untracked-code.txt"))];
  const continued = await handoffTaskEpisode(taskId, "continue accepted work", ctx, handoffDependencies);
  assert.deepEqual([git(result.worktree, "diff", "--cached", "--binary"),
    readFileSync(join(result.worktree, "unrelated-code.txt")), readFileSync(join(result.worktree, "untracked-code.txt"))], codeBeforeHandoff);
  assert.deepEqual([
    git(prepared.storeDir, "rev-parse", "HEAD"),
    git(prepared.storeDir, "diff", "--cached", "--binary"),
    readFileSync(join(prepared.storeDir, "unrelated-primary.txt")),
    readFileSync(join(prepared.storeDir, "untracked-primary.txt")),
    readFileSync(join(root, task.path)),
  ], primaryBeforeHandoff, "handoff does not synchronize or absorb the mutable primary task checkout");
  assert.equal(continued.admitted, true);
  assert.equal(handoffs, 1);
  assert.equal(preparationCalls, 2, "handoff adds one preparation, not paired stability proofs");
  const advancedOwner = records.get("independent-owner");
  assert.equal(advancedOwner.providerRevision, changedTask.publishedHead);
  assert.match(advancedOwner.taskEvidence.task.implementationNotes, /accepted handoff advance/);
  for (const prompt of [deliveredHandoff, deliveredContinuation]) {
    assert.ok(prompt.includes(JSON.stringify(beforeHandoff.taskEvidence)));
    assert.ok(prompt.includes(JSON.stringify(advancedOwner.taskEvidence)));
    const observation = JSON.parse(prompt.match(/(?:^|\n)<provider-task-observation>\r?\n([\s\S]*?)\r?\n<\/provider-task-observation>/)[1]);
    assert.equal(observation.episodeCodeHead, codeHead);
    assert.match(observation.episodeCode.status.stdout, /unrelated-code.txt/);
    assert.notEqual(observation.episodeUpstream.status, 0, "missing upstream is an observation, not coded eligibility");
  }
  git(result.worktree, "push", "-qu", "origin", result.branch);
  activeRoute = undefined;
  const reopened = await handoffTaskEpisode(taskId, "continue after durable route refresh", ctx, handoffDependencies);
  assert.equal(reopened.admitted, true);
  assert.equal(reopened.episodeActiveSessionId, "independent-reopened-route");
  assert.equal(handoffs, 2);
  assert.equal(records.get("independent-owner").episodeActiveSessionId, "independent-reopened-route");
  // The primary author explicitly synchronizes its own checkout before its next edit.
  git(prepared.storeDir, "fetch", "-q", "origin", TASK_HISTORY_REF);
  git(prepared.storeDir, "merge", "--ff-only", "FETCH_HEAD");
  const primaryAdvance = publishTaskHistoryMutation({
    primaryRoot: root, targetWorktree: root, taskId,
    edits: [{ option: "--append-notes", value: "ordinary primary advance" }], runner,
  });
  assert.equal(primaryAdvance.status, "published");
  const afterPrimaryAdvance = await handoffTaskEpisode(taskId, "continue after primary task advance", ctx, handoffDependencies);
  assert.equal(afterPrimaryAdvance.admitted, true);
  assert.equal(handoffs, 3);
  assert.equal(git(join(result.worktree, ".backlog"), "rev-parse", "HEAD"), primaryAdvance.publishedHead);
  assert.equal(records.get("independent-owner").providerRevision, primaryAdvance.publishedHead);

  execFileSync(BACKLOG, [
    "task", "create", "Independent blocked recovery", "--status", "In Planning",
    "--description", "Prove failure publication on the task DAG",
    "--plan", "1. Reserve independent task evidence.\n2. Publish Blocked after allocation failure.", "--plain",
  ], { cwd: root, encoding: "utf8" });
  const tasksAfterCreate = JSON.parse(execFileSync(BACKLOG, ["task", "list", "--json"], { cwd: root, encoding: "utf8" })).tasks;
  const secondTaskId = tasksAfterCreate.find((entry) => entry.id !== taskId)?.id;
  assert.ok(secondTaskId);
  const secondTask = view(root, secondTaskId);
  assert.equal(secondTask.status, "In Planning");
  git(prepared.storeDir, "--literal-pathspecs", "add", "--", secondTask.path.replace(/^\.backlog\//, ""));
  git(prepared.storeDir, "--literal-pathspecs", "commit", "--only", "-qm", "plan independent blocked task", "--", secondTask.path.replace(/^\.backlog\//, ""));
  git(prepared.storeDir, "push", "-q", "origin", `HEAD:${TASK_HISTORY_REF}`);
  const ctx2 = { ...ctx, sessionManager: {
    getSessionId: () => "independent-owner-2", getSessionFile: () => join(dir, "owner-2.jsonl"), getHeader: () => ({ rlmDepth: 0 }),
  } };
  await assert.rejects(
    createTaskEpisode(secondTaskId, "independent-blocked-call", ctx2, {
      admissionGit: new CliTaskEpisodeAdmissionGit(), admissionRunner: runner, taskResolver,
      ownership, reservationOperationId: "independent-operation-2", now: () => "2026-10-26T20:02:00.000Z",
      allocateTaskEpisode: async () => { throw new Error("fixture allocation failure"); },
    }, { engine: "local" }),
    /fixture allocation failure.*Native admission result:.*Current ownership:/,
  );
  assert.equal(view(root, secondTaskId).status, "In Progress");
  const retainedOwner = structuredClone(records.get("independent-owner-2"));
  const codeIndex = git(root, "diff", "--cached", "--binary");
  const taskIndex = git(prepared.storeDir, "diff", "--cached", "--binary");
  const blocked = commitConversationTaskStatus({
    taskId: secondTaskId, projectRoot: root, taskPath: secondTask.path, status: "Blocked",
    message: "owner-requested blocker publication", note: "owner chose Blocked from factual failure evidence",
    runner, git: new CliTaskEpisodeAdmissionGit(), resolveTask: taskResolver,
  });
  assert.equal(blocked.taskHistory.status, "published");
  assert.deepEqual(records.get("independent-owner-2"), retainedOwner, "requested status publication never rewrites ownership");
  assert.equal(git(root, "diff", "--cached", "--binary"), codeIndex);
  assert.equal(git(prepared.storeDir, "diff", "--cached", "--binary"), taskIndex);
  const blockedOwner = records.get("independent-owner-2");
  assert.equal(blockedOwner.provider, "backlog");
  assert.notEqual(blockedOwner.providerRevision, git(prepared.storeDir, "rev-parse", "HEAD"));
  assert.equal(blockedOwner.taskEvidence.task.status, "In Progress");
  assert.equal(view(root, secondTaskId).status, "Blocked");
  assert.equal(git(root, "rev-parse", "HEAD"), codeHead);
});

test("trusted task admission commits In Progress before reservation and allocation despite push failure", async () => {
  const f = fixture();
  let observed;
  const result = await createTaskEpisode("PRIMECLAW-1", "tool-call", f.ctx, {
    ...f.dependencies,
    allocateTaskEpisode: async (taskId) => {
      const reserved = f.record;
      observed = {
        taskId,
        status: view(f.root).status,
        reservationStatus: reserved.status,
        baseRef: reserved.baseRef,
        head: git(f.root, "rev-parse", "HEAD"),
        paths: commitPaths(f.root, reserved.baseRef),
      };
      const active = {
        ...reserved,
        status: "active",
        worktreeName: "prime-claw-primeclaw-1-episode-operation",
        worktree: join(f.root, "episode-worktree"),
        branch: "episode/primeclaw-1-operation",
        head: reserved.baseRef,
        episodeId: "episode-session",
        episodeSessionFile: join(f.root, "episode.jsonl"),
        episodeActiveSessionId: "active-route",
      };
      f.ownership.write(f.root, active);
      return { ...active, reused: false };
    },
  }, { engine: "local" });

  assert.deepEqual(observed, {
    taskId: "PRIMECLAW-1",
    status: "In Progress",
    reservationStatus: "provisioning",
    baseRef: observed.head,
    head: observed.head,
    paths: [f.task.path],
  });
  assert.equal(result.status, "active");
  assert.match(result.admissionPushError, /push/i);
  assert.deepEqual(commitPaths(f.root), [f.task.path]);
  assert.equal(git(f.root, "status", "--short"), "M unrelated.txt");
  assert.deepEqual(f.events.filter(([name]) => name === "ownership-write"), [
    ["ownership-write", "provisioning"], ["ownership-write", "active"],
  ]);
});

test("pre-reservation failure reports the one native admission without choosing a rollback", async () => {
  const f = fixture();
  await assert.rejects(createTaskEpisode("PRIMECLAW-1", "tool-call", f.ctx, {
    ...f.dependencies,
    reserveTaskOwnership() { throw new Error("reservation rejected before write"); },
    allocateTaskEpisode: async () => { assert.fail("must not allocate"); },
  }, { engine: "local" }), /reservation rejected before write.*Native admission result:.*Current ownership: null/);
  assert.equal(view(f.root).status, "In Progress");
  assert.equal(f.record, null);
  assert.deepEqual(commitPaths(f.root), [f.task.path]);
  assert.equal(git(f.root, "log", "-1", "--pretty=%s"), "chore: admit PRIMECLAW-1 episode");
  assert.equal(git(f.root, "status", "--short"), "M unrelated.txt");
});


test("post-reservation allocation failure retains exact uncertain resources without a second task mutation", async () => {
  const f = fixture();
  await assert.rejects(createTaskEpisode("PRIMECLAW-1", "tool-call", f.ctx, {
    ...f.dependencies,
    allocateTaskEpisode: async () => {
      f.ownership.write(f.root, { ...f.record, status: "uncertain", uncertaintyReason: "session publication outcome unknown" });
      throw new Error("session publication outcome unknown");
    },
  }, { engine: "local" }), /session publication outcome unknown.*Native admission result:.*Current ownership:.*operation-1234/);
  const task = view(f.root);
  assert.equal(task.status, "In Progress");
  assert.equal(task.implementationNotes, null);
  assert.equal(f.record.status, "uncertain");
  assert.equal(f.record.operationId, "operation-1234");
  assert.deepEqual(commitPaths(f.root), [f.task.path]);
  assert.equal(git(f.root, "status", "--short"), "M unrelated.txt");
  const head = git(f.root, "rev-parse", "HEAD");
  await assert.rejects(createTaskEpisode("PRIMECLAW-1", "again", f.ctx, f.dependencies, { engine: "local" }), /Non-terminal Episode ownership already exists/);
  assert.equal(git(f.root, "rev-parse", "HEAD"), head);
});


test("task admission uses the selected code branch without a literal-main suitability gate", async () => {
  const f = fixture();
  git(f.root, "checkout", "-qb", "selected-code-base");
  let reached = false;
  await assert.rejects(createTaskEpisode("PRIMECLAW-1", "non-main", f.ctx, {
    ...f.dependencies,
    reserveTaskOwnership(input) {
      reached = true;
      assert.equal(input.baseRef, git(f.root, "rev-parse", "HEAD"));
      throw new Error("selected-base reservation observation");
    },
  }, { engine: "local" }), /selected-base reservation observation/);
  assert.equal(reached, true);
  assert.equal(git(f.root, "branch", "--show-current"), "selected-code-base");
  assert.equal(view(f.root).status, "In Progress");
  assert.deepEqual(commitPaths(f.root), [f.task.path]);
});


test("authorized selected-ticket edits reach native exact-file commit while nonterminal ownership still prevents duplication", async () => {
  const dirty = fixture();
  execFileSync(BACKLOG, ["task", "edit", "PRIMECLAW-1", "--append-notes", "authorized coherent selected edit"], { cwd: dirty.root });
  git(dirty.root, "add", "--", dirty.task.path);
  await assert.rejects(createTaskEpisode("PRIMECLAW-1", "dirty-selected", dirty.ctx, {
    ...dirty.dependencies, reserveTaskOwnership() { throw new Error("selected edit committed"); },
  }, { engine: "local" }), /selected edit committed/);
  assert.equal(view(dirty.root).status, "In Progress");
  assert.match(view(dirty.root).implementationNotes, /authorized coherent selected edit/);
  assert.deepEqual(commitPaths(dirty.root), [dirty.task.path]);

  const owned = fixture();
  owned.ownership.write(owned.root, {
    version: 1, status: "provisioning", operationId: "other", engine: "local", ownerSessionId: "owner-session",
    sourceLocation: ".ralph/plans/future/other", slug: "other", baseRef: "base", bundleDigest: "0".repeat(64), createdAt: "x", updatedAt: "x",
  });
  const head = git(owned.root, "rev-parse", "HEAD");
  await assert.rejects(createTaskEpisode("PRIMECLAW-1", "owned", owned.ctx, owned.dependencies, { engine: "local" }), /Non-terminal Episode ownership already exists/);
  assert.equal(git(owned.root, "rev-parse", "HEAD"), head);
  assert.equal(view(owned.root).status, "In Planning");
});


test("task admission ignores another Conversation's independent ownership", async () => {
  const f = fixture();
  const foreign = {
    version: 1, status: "provisioning", operationId: "foreign", engine: "local", ownerSessionId: "foreign-owner",
    sourceLocation: ".ralph/plans/future/foreign", slug: "foreign", baseRef: "base", bundleDigest: "0".repeat(64),
    createdAt: "x", updatedAt: "x",
  };
  f.ownership.write(f.root, foreign);

  const result = await createTaskEpisode("PRIMECLAW-1", "tool-call", f.ctx, {
    ...f.dependencies,
    allocateTaskEpisode: async () => {
      const active = {
        ...f.record,
        status: "active",
        worktreeName: "prime-claw-primeclaw-1-episode-operation",
        worktree: join(f.root, "episode-worktree"),
        branch: "episode/primeclaw-1-operation",
        head: f.record.baseRef,
        episodeId: "episode-session",
        episodeSessionFile: join(f.root, "episode.jsonl"),
        episodeActiveSessionId: "active-route",
      };
      f.ownership.write(f.root, active);
      return { ...active, reused: false };
    },
  }, { engine: "local" });

  assert.equal(result.ownerSessionId, "owner-session");
  assert.deepEqual(f.ownership.read(f.root, "foreign-owner"), foreign);
});


test("different Conversations create different task Episodes without repository cardinality", async () => {
  const f = fixture();
  const created = execFileSync(BACKLOG, [
    "task", "create", "Second task-native admission fixture",
    "--status", "In Planning",
    "--description", "Create another exact Episode",
    "--plan", "1. Create the second bounded resource.\n2. Verify exact identity.",
    "--plain",
  ], { cwd: f.root, encoding: "utf8" });
  const secondId = created.match(/PRIMECLAW-[0-9.]+/)?.[0];
  assert.ok(secondId);
  const secondTask = view(f.root, secondId);
  git(f.root, "add", "--", secondTask.path);
  git(f.root, "commit", "-q", "--only", "-m", "plan second exact task", "--", secondTask.path);

  const productionDependencies = {
    admissionGit: f.dependencies.admissionGit,
    admissionRunner: f.dependencies.admissionRunner,
    taskResolver: f.dependencies.taskResolver,
    now: f.dependencies.now,
    allocateTaskEpisode: async (_taskId, ctx) => {
      const ownerSessionId = ctx.sessionManager.getSessionId();
      const reserved = readEpisodeOwnership(f.root, ownerSessionId);
      assert.equal(reserved.status, "provisioning");
      const active = {
        ...reserved,
        status: "active",
        worktreeName: `worktree-${ownerSessionId}`,
        worktree: join(f.root, `worktree-${ownerSessionId}`),
        branch: `episode/${ownerSessionId}`,
        head: reserved.baseRef,
        episodeId: `episode-${ownerSessionId}`,
        episodeSessionFile: join(f.root, `${ownerSessionId}.jsonl`),
        episodeActiveSessionId: `route-${ownerSessionId}`,
      };
      writeEpisodeOwnership(f.root, active);
      return { ...active, reused: false };
    },
  };
  const secondCtx = {
    ...f.ctx,
    sessionManager: {
      ...f.ctx.sessionManager,
      getSessionId: () => "second-owner",
      getSessionFile: () => join(f.root, "second-owner.jsonl"),
    },
  };

  const [first, second] = await Promise.all([
    createTaskEpisode("PRIMECLAW-1", "tool-call-one", f.ctx, {
      ...productionDependencies, reservationOperationId: "operation-first",
    }, { engine: "local" }),
    createTaskEpisode(secondId, "tool-call-two", secondCtx, {
      ...productionDependencies, reservationOperationId: "operation-second",
    }, { engine: "local" }),
  ]);

  assert.deepEqual(new Set([first.ownerSessionId, second.ownerSessionId]), new Set(["owner-session", "second-owner"]));
  assert.deepEqual(readAllEpisodeOwnership(f.root).map((record) => record.ownerSessionId), ["owner-session", "second-owner"]);
  assert.equal(view(f.root, "PRIMECLAW-1").status, "In Progress");
  assert.equal(view(f.root, secondId).status, "In Progress");
});


test("separate processes serialize task status commit and reservation before slow push", async () => {
  const f = fixture();
  const created = execFileSync(BACKLOG, [
    "task", "create", "Second process admission fixture",
    "--status", "In Planning",
    "--description", "Create an independently owned Episode",
    "--plan", "1. Create the bounded resource.\n2. Verify exact identity.",
    "--plain",
  ], { cwd: f.root, encoding: "utf8" });
  const secondId = created.match(/PRIMECLAW-[0-9.]+/)?.[0];
  assert.ok(secondId);
  const secondTask = view(f.root, secondId);
  git(f.root, "add", "--", secondTask.path);
  git(f.root, "commit", "-q", "--only", "-m", "plan second process task", "--", secondTask.path);

  const worker = join(f.root, "admission-worker.mjs");
  const specUrl = new URL("../src/prime-agent-plugin/extension-support/spec-episode.ts", import.meta.url).href;
  const ownershipUrl = new URL("../src/prime-agent-plugin/extension-support/episode-ownership.ts", import.meta.url).href;
  const resolverUrl = new URL("../src/prime-agent-plugin/extension-support/reviewed-plan-support.ts", import.meta.url).href;
  writeFileSync(worker, `
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { CliTaskEpisodeAdmissionGit, createTaskEpisode } from ${JSON.stringify(specUrl)};
import { readEpisodeOwnership, writeEpisodeOwnership } from ${JSON.stringify(ownershipUrl)};
import { resolveBacklogTask } from ${JSON.stringify(resolverUrl)};
const [root, taskId, ownerSessionId, barrier, backlog] = process.argv.slice(2);
class Runner {
  run(command, args, options = {}) {
    const result = spawnSync(command === "backlog" ? backlog : command, args, { cwd: options.cwd, encoding: "utf8" });
    if (result.status !== 0 && !options.allowFailure) throw new Error(result.stderr || result.stdout);
    return { stdout: result.stdout || "", stderr: result.stderr || "", status: result.status ?? 1 };
  }
}
class AdmissionGit extends CliTaskEpisodeAdmissionGit {
  push() {
    if (ownerSessionId === "owner-first") {
      process.stdout.write("READY_IN_PUSH\\n");
      readFileSync(barrier);
    }
  }
}
const ctx = { cwd: root, model: { provider: "test", id: "model" }, sessionManager: {
  getSessionId: () => ownerSessionId, getSessionFile: () => join(root, ownerSessionId + ".jsonl"), getHeader: () => ({ rlmDepth: 0 }),
} };
const dependencies = {
  admissionGit: new AdmissionGit(), admissionRunner: new Runner(), taskResolver: resolveBacklogTask,
  allocateTaskEpisode: async () => {
    const reserved = readEpisodeOwnership(root, ownerSessionId);
    const active = { ...reserved, status: "active", worktree: join(root, ownerSessionId + "-worktree"), branch: "episode/" + ownerSessionId,
      head: reserved.baseRef, episodeId: "episode-" + ownerSessionId, episodeSessionFile: join(root, "episode-" + ownerSessionId + ".jsonl"), episodeActiveSessionId: "route-" + ownerSessionId };
    writeEpisodeOwnership(root, active);
    return { ...active, reused: false };
  },
};
try {
  const result = await createTaskEpisode(taskId, "call-" + ownerSessionId, ctx, dependencies, { engine: "local" });
  process.stdout.write(JSON.stringify({ outcome: "created", taskId: result.taskId, baseRef: result.baseRef }) + "\\n");
} catch (error) {
  process.stdout.write(JSON.stringify({ outcome: "failed", error: String(error) }) + "\\n");
}
`);
  const barrier = join(f.root, "release.fifo");
  execFileSync("mkfifo", [barrier]);
  const run = (taskId, ownerSessionId) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", worker, f.root, taskId, ownerSessionId, barrier, BACKLOG], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "", stderr = "", readyResolve;
    const ready = new Promise((resolveReady) => { readyResolve = resolveReady; });
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; if (stdout.includes("READY_IN_PUSH")) readyResolve(); });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const done = new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr)));
    });
    return { child, done, ready };
  };

  const first = run("PRIMECLAW-1", "owner-first");
  await first.ready;
  const second = run(secondId, "owner-second");
  const secondResult = await second.done;
  writeFileSync(barrier, "release");
  const firstResult = await first.done;

  assert.match(firstResult.stdout, /"outcome":"created"/);
  assert.match(secondResult.stdout, /"outcome":"created"/);
  assert.equal(view(f.root, "PRIMECLAW-1").status, "In Progress");
  assert.equal(view(f.root, secondId).status, "In Progress");
  assert.deepEqual(readAllEpisodeOwnership(f.root).map((record) => record.ownerSessionId), ["owner-first", "owner-second"]);
});


test("registered Backlog create reports actual default status and reservation failure without selecting another lifecycle action", async () => {
  const f = fixture(), tools = new Map();
  const beforeIndex = git(f.root, "diff", "--cached", "--binary");
  let allocations = 0;
  createReviewedPlanExtension({
    ...f.dependencies,
    providerTaskResolver: (cwd, id) => ({ ...f.dependencies.taskResolver(cwd, id), provider: "backlog" }),
    async placementResolver() { return { engine: "local" }; },
    allocateTaskEpisode: async () => { allocations += 1; throw new Error("registered allocation failure"); },
  })({ registerTool(tool) { tools.set(tool.name, tool); }, registerCommand() {}, on() {}, sendUserMessage() { assert.fail("no extra assignment"); } });
  const result = await tools.get("create_task_episode").execute("registered-default", { taskId: "PRIMECLAW-1" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, true);
  assert.match(result.details.error, /registered allocation failure.*Native admission result:.*Current ownership:.*operation-1234/);
  assert.equal(allocations, 1);
  assert.equal(view(f.root).status, "In Progress");
  assert.equal(f.record.status, "provisioning");
  assert.equal(git(f.root, "log", "-1", "--pretty=%s"), "chore: admit PRIMECLAW-1 episode");
  assert.equal(git(f.root, "diff", "--cached", "--binary"), beforeIndex);
});


test("retained promotion tolerates an unrelated task admission while selecting its captured base", async () => {
  const f = fixture();
  const location = ".ralph/plans/future/alpha";
  mkdirSync(join(f.root, location), { recursive: true });
  writeFileSync(join(f.root, location, "SPECIFICATION.md"), "Bounded retained specification.\n");
  writeFileSync(join(f.root, location, "IMPLEMENTATION_PLAN.md"), "1. Promote exact source.\n2. Verify it.\n");
  assert.equal(reconcileLegacySpecificationInventory(f.root, "initialize").status, "created");
  // This retained-publication fixture deliberately tracks the allowlist. Model
  // the documented operator opt-in without changing the creation-only default.
  const exclude = resolve(f.root, git(f.root, "rev-parse", "--git-path", "info/exclude").trim());
  const exclusions = readFileSync(exclude, "utf8");
  assert.match(exclusions, /^\/\.prime-claw\/$/m);
  assert.equal(git(f.root, "check-ignore", "--", ".prime-claw/legacy-specifications.json").trim(), ".prime-claw/legacy-specifications.json");
  writeFileSync(exclude, exclusions.replace(/^\/\.prime-claw\/\r?\n/gm, ""));
  mkdirSync(join(f.root, ".agents", "skills", "execute"), { recursive: true });
  writeFileSync(join(f.root, ".agents", "skills", "execute", "SKILL.md"), "Retained execute fixture.\n");
  git(f.root, "add", "--", location, ".prime-claw/legacy-specifications.json", ".agents/skills/execute/SKILL.md");
  git(f.root, "commit", "-q", "-m", "add retained source");
  const capturedBase = git(f.root, "rev-parse", "HEAD");
  const digest = bundleContentDigest(join(f.root, location));
  let enteredResolve, releaseResolve;
  const entered = new Promise((resolveEntered) => { enteredResolve = resolveEntered; });
  const release = new Promise((resolveRelease) => { releaseResolve = resolveRelease; });
  const legacyCtx = {
    ...f.ctx,
    sessionManager: {
      ...f.ctx.sessionManager,
      getSessionId: () => "owner-legacy",
      getSessionFile: () => join(f.root, "owner-legacy.jsonl"),
    },
  };
  const publisher = {
    async createFresh(options) {
      const identity = { sessionId: "legacy-episode", sessionFile: join(f.root, "legacy-episode.jsonl") };
      writeFileSync(identity.sessionFile, "{}\n");
      await options.onAllocated?.(identity);
      return { ...identity, activeSessionId: "legacy-route" };
    },
    async deliverExecute() {},
    close() {},
  };
  const legacyPromise = createSpecEpisode(location, "legacy-call", legacyCtx, {
    orca: {
      async listReadySetups() {
        enteredResolve();
        await release;
        throw new OrcaUnavailableError("deliberate local fallback");
      },
    },
    publisher,
  }, { approvedBundleDigest: digest });
  await entered;

  const productionDependencies = {
    admissionGit: f.dependencies.admissionGit,
    admissionRunner: f.dependencies.admissionRunner,
    taskResolver: f.dependencies.taskResolver,
    now: f.dependencies.now,
    reservationOperationId: "mixed-mode-task-operation",
    allocateTaskEpisode: async () => {
      const reserved = readEpisodeOwnership(f.root, "owner-session");
      const active = {
        ...reserved, status: "active", worktree: join(f.root, "task-worktree"), branch: "episode/task",
        head: reserved.baseRef, episodeId: "task-episode", episodeSessionFile: join(f.root, "task-episode.jsonl"), episodeActiveSessionId: "task-route",
      };
      writeEpisodeOwnership(f.root, active);
      return { ...active, reused: false };
    },
  };
  const task = await createTaskEpisode("PRIMECLAW-1", "task-call", f.ctx, productionDependencies, { engine: "local" });
  releaseResolve();
  const legacy = await legacyPromise;

  assert.equal(task.status, "active");
  assert.equal(legacy.status, "active");
  assert.equal(legacy.baseRef, capturedBase);
  assert.notEqual(git(f.root, "rev-parse", "HEAD"), capturedBase);
  assert.equal(bundleContentDigest(join(f.root, location)), digest);
  assert.deepEqual(readAllEpisodeOwnership(f.root).map((record) => record.ownerSessionId), ["owner-legacy", "owner-session"]);
});


test("task status and plan eligibility belong to Markdown rather than the requested native creation operation", async () => {
  // These direct primitive calls prove policy removal, not semantic readiness.
  for (const args of [["--status", "In Design"], ["--plan", "TODO: write the implementation plan"]]) {
    const f = fixture();
    execFileSync(BACKLOG, ["task", "edit", ...args, "--plain", "--", "PRIMECLAW-1"], { cwd: f.root });
    await assert.rejects(createTaskEpisode("PRIMECLAW-1", "facts-only", f.ctx, {
      ...f.dependencies, reserveTaskOwnership() { throw new Error("native creation reached reservation"); },
    }, { engine: "local" }), /native creation reached reservation/);
    assert.equal(view(f.root).status, "In Progress");
    assert.equal(f.record, null);
    assert.deepEqual(commitPaths(f.root), [f.task.path]);
  }
});


test("failed In Progress commit leaves its actual native task state without another commit or status choice", async () => {
  const f = fixture(), real = f.dependencies.admissionGit;
  const head = git(f.root, "rev-parse", "HEAD");
  let commits = 0;
  const admissionGit = Object.assign(Object.create(real), {
    commitOnlyPath() { commits += 1; throw new Error("status commit rejected before write"); },
  });
  await assert.rejects(createTaskEpisode("PRIMECLAW-1", "commit-failure", f.ctx, {
    ...f.dependencies, admissionGit, allocateTaskEpisode: async () => { assert.fail("must not allocate"); },
  }, { engine: "local" }), /status commit rejected before write/);
  assert.equal(commits, 1);
  assert.equal(view(f.root).status, "In Progress");
  assert.equal(git(f.root, "rev-parse", "HEAD"), head);
  assert.notEqual(git(f.root, "status", "--porcelain", "--", f.task.path), "");
  assert.equal(f.record, null);
});


test("allocator return without durable active identity reports the exact retained reservation without Blocked publication", async () => {
  const f = fixture();
  await assert.rejects(createTaskEpisode("PRIMECLAW-1", "bad-result", f.ctx, {
    ...f.dependencies, allocateTaskEpisode: async () => ({ ...f.record, status: "active", reused: false }),
  }, { engine: "local" }), /exact active reservation identity.*Current ownership:.*provisioning/);
  assert.equal(view(f.root).status, "In Progress");
  assert.equal(f.record.status, "provisioning");
  assert.equal(view(f.root).implementationNotes, null);
});


test("task placement binds one exact ready local Orca setup without mutation", async () => {
  const setup = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    projectId: "project",
    hostId: "local",
    path: "/project",
    displayName: "Local setup",
    environmentLabel: "Local",
  };
  let inventories = 0;
  const orca = { async listReadyTaskPlacementSetups(projectRoot) {
    inventories += 1;
    assert.equal(projectRoot, "/project");
    return [setup];
  } };
  const ctx = { hasUI: false, ui: {} };
  assert.deepEqual(
    await resolveTaskEpisodePlacement("/project", undefined, ctx, { orca }),
    { engine: "orca", projectSetupId: setup.id },
  );
  assert.deepEqual(
    await resolveTaskEpisodePlacement("/project", `id:${setup.id}`, ctx, { orca }),
    { engine: "orca", projectSetupId: setup.id },
  );
  assert.equal(inventories, 2);
});

test("task placement fails closed on zero, ambiguous, cancelled, or remote Orca setup", async () => {
  const local = (id) => ({
    id, projectId: "project", hostId: "local", path: `/project/${id}`,
    displayName: id, environmentLabel: "Local",
  });
  const noUi = { hasUI: false, ui: {} };
  await assert.rejects(
    resolveTaskEpisodePlacement("/project", undefined, noUi, { orca: { async listReadyTaskPlacementSetups() { return []; } } }),
    /No ready Orca project-host setup/,
  );
  await assert.rejects(
    resolveTaskEpisodePlacement("/project", undefined, noUi, { orca: { async listReadyTaskPlacementSetups() { return [local("a"), local("b")]; } } }),
    /require --host.*noninteractive/,
  );
  await assert.rejects(
    resolveTaskEpisodePlacement("/project", undefined, { hasUI: true, ui: { async select() { return undefined; } } }, { orca: { async listReadyTaskPlacementSetups() { return [local("a"), local("b")]; } } }),
    /selection was cancelled; nothing was created/,
  );
  await assert.rejects(
    resolveTaskEpisodePlacement("/project", undefined, noUi, { orca: { async listReadyTaskPlacementSetups() { return [{ ...local("a"), hostId: "remote" }]; } } }),
    /Remote Episode placement is disabled/,
  );
});

test("task placement uses local fallback only for proven Orca unavailability", async () => {
  const unavailable = { async listReadyTaskPlacementSetups() { throw new OrcaUnavailableError("orca missing"); } };
  const ctx = { hasUI: false, ui: {} };
  assert.deepEqual(
    await resolveTaskEpisodePlacement("/project", undefined, ctx, { orca: unavailable }),
    { engine: "local" },
  );
  await assert.rejects(
    resolveTaskEpisodePlacement("/project", "id:123e4567-e89b-12d3-a456-426614174000", ctx, { orca: unavailable }),
    /Explicit Episode host.*inventory is unavailable/,
  );
  await assert.rejects(
    resolveTaskEpisodePlacement("/project", undefined, ctx, { orca: { async listReadyTaskPlacementSetups() { throw new Error("bad inventory"); } } }),
    /bad inventory/,
  );
});


test("production task placement falls back only when the Orca command is absent", async () => {
  const ctx = { hasUI: false, ui: {} };
  const missing = new CliOrcaAdapter(() => {
    const error = new Error("spawn orca ENOENT");
    error.code = "ENOENT";
    throw error;
  });
  assert.deepEqual(
    await resolveTaskEpisodePlacement("/project", undefined, ctx, { orca: missing }),
    { engine: "local" },
  );

  const malformed = new CliOrcaAdapter(() => "not-json");
  await assert.rejects(
    resolveTaskEpisodePlacement("/project", undefined, ctx, { orca: malformed }),
    /returned malformed JSON/,
  );
  const rejected = new CliOrcaAdapter(() => JSON.stringify({ ok: false, error: "inventory denied" }));
  await assert.rejects(
    resolveTaskEpisodePlacement("/project", undefined, ctx, { orca: rejected }),
    /inventory denied/,
  );
});

test("ordinary task status commit targets one literal path and preserves unrelated staged files", () => {
  const f = fixture();
  const selected = "backlog/tasks/selected[1].md", other = "backlog/tasks/selected1.md";
  writeFileSync(join(f.root, selected), "selected baseline\n");
  writeFileSync(join(f.root, other), "foreign baseline\n");
  git(f.root, "--literal-pathspecs", "add", "--", selected, other);
  git(f.root, "commit", "-qm", "literal path fixtures");
  writeFileSync(join(f.root, selected), "authorized selected edit\n");
  writeFileSync(join(f.root, other), "foreign staged edit\n");
  git(f.root, "--literal-pathspecs", "add", "--", other);
  const staged = git(f.root, "diff", "--cached", "--binary");
  const head = new CliTaskEpisodeAdmissionGit().commitOnlyPath(f.root, selected, "literal selected ticket");
  assert.deepEqual(commitPaths(f.root, head), [selected]);
  assert.equal(git(f.root, "diff", "--cached", "--binary"), staged);
  assert.equal(readFileSync(join(f.root, other), "utf8"), "foreign staged edit\n");
});
