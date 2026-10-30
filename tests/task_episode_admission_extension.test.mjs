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
  copyFileSync(join(ROOT, "backlog", "config.yml"), join(root, "backlog", "config.yml"));
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
  const codeHead = git(root, "rev-parse", "HEAD");
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
  assert.equal(git(root, "status", "--porcelain"), "");
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
  assert.equal(preparationCalls, 2);
  assert.match(deliveredExecutePrompt, /<provider-task-observation>/);
  assert.ok(deliveredExecutePrompt.includes(JSON.stringify(reservedTaskEvidence)));
  assert.ok(deliveredExecutePrompt.includes(JSON.stringify(result.taskEvidence)));
  assert.match(deliveredExecutePrompt, new RegExp(reservedProviderRevision));
  assert.match(deliveredExecutePrompt, new RegExp(interleavedAdvance.publishedHead));
  assert.match(deliveredExecutePrompt, /records observations, not semantic acceptance or a new authority/);
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
  publisher.deliverHandoff = async (_route, _handoff, _execute, onHandoffAdmitted) => { handoffs += 1; await onHandoffAdmitted?.(); };
  const handoffDependencies = {
    admissionRunner: runner, taskRunner: runner, taskResolver, ownership, publisher,
    now: () => "2026-10-26T20:01:00.000Z",
  };
  const beforeUnpushedHandoff = structuredClone(records.get("independent-owner"));
  await assert.rejects(
    handoffTaskEpisode(taskId, "continue accepted work", ctx, handoffDependencies),
    /exact Episode code head to be pushed/,
  );
  assert.equal(handoffs, 0);
  assert.deepEqual(records.get("independent-owner"), beforeUnpushedHandoff);
  git(result.worktree, "push", "-qu", "origin", result.branch);
  const continued = await handoffTaskEpisode(taskId, "continue accepted work", ctx, handoffDependencies);
  assert.equal(continued.admitted, true);
  assert.equal(handoffs, 1);
  const advancedOwner = records.get("independent-owner");
  assert.equal(advancedOwner.providerRevision, changedTask.publishedHead);
  assert.match(advancedOwner.taskEvidence.task.implementationNotes, /accepted handoff advance/);
  activeRoute = undefined;
  const reopened = await handoffTaskEpisode(taskId, "continue after durable route refresh", ctx, handoffDependencies);
  assert.equal(reopened.admitted, true);
  assert.equal(reopened.episodeActiveSessionId, "independent-reopened-route");
  assert.equal(handoffs, 2);
  assert.equal(records.get("independent-owner").episodeActiveSessionId, "independent-reopened-route");
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
  git(prepared.storeDir, "add", ".");
  git(prepared.storeDir, "commit", "-qm", "plan independent blocked task");
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
    /is Blocked and requires exact recovery/,
  );
  const blockedOwner = records.get("independent-owner-2");
  assert.equal(blockedOwner.provider, "backlog");
  assert.equal(blockedOwner.providerRevision, git(prepared.storeDir, "rev-parse", "HEAD"));
  assert.equal(blockedOwner.taskEvidence.task.status, "Blocked");
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

test("proven clean pre-reservation failure returns the exact task to In Planning", async () => {
  const f = fixture();
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", f.ctx, {
      ...f.dependencies,
      reserveTaskOwnership() { throw new Error("reservation rejected before write"); },
      allocateTaskEpisode: async () => { throw new Error("must not allocate"); },
    }, { engine: "local" }),
    /returned to In Planning.*reservation rejected before write/,
  );

  assert.equal(view(f.root).status, "In Planning");
  assert.equal(f.record, null);
  assert.deepEqual(commitPaths(f.root), [f.task.path]);
  assert.deepEqual(git(f.root, "log", "-2", "--pretty=%s").split(/\r?\n/), [
    "chore: roll back PRIMECLAW-1 episode admission",
    "chore: admit PRIMECLAW-1 episode",
  ]);
  assert.equal(git(f.root, "status", "--short"), "M unrelated.txt");
});

test("post-reservation allocation failure publishes Blocked with exact recovery condition", async () => {
  const f = fixture();
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", f.ctx, {
      ...f.dependencies,
      allocateTaskEpisode: async () => {
        f.ownership.write(f.root, {
          ...f.record,
          status: "uncertain",
          uncertaintyReason: "session publication outcome unknown",
        });
        throw new Error("session publication outcome unknown");
      },
    }, { engine: "local" }),
    /is Blocked and requires exact recovery.*session publication outcome unknown/,
  );

  const task = view(f.root);
  assert.equal(task.status, "Blocked");
  assert.match(JSON.stringify(task), /inspect \.prime-claw\/ownership\.json/);
  assert.match(JSON.stringify(task), /reconcile every recorded task, worktree, and session identity to PRIMECLAW-1/);
  assert.match(JSON.stringify(task), /do not retry it as fresh creation/);
  assert.equal(f.record.status, "uncertain");
  assert.equal(view(f.root).implementationPlan.includes("Create the bounded resource"), true);
  assert.deepEqual(commitPaths(f.root), [f.task.path]);
  assert.deepEqual(commitPaths(f.root, f.record.baseRef), [f.task.path]);
  assert.equal(git(f.root, "status", "--short"), "M unrelated.txt");

  const head = git(f.root, "rev-parse", "HEAD");
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call-2", f.ctx, f.dependencies, { engine: "local" }),
    /requires the exact task to be In Planning/,
  );
  assert.equal(git(f.root, "rev-parse", "HEAD"), head);
});

test("task admission rejects linked main and primary non-main checkouts before every mutation", async () => {
  const f = fixture();
  git(f.root, "branch", "keeper");
  git(f.root, "checkout", "-q", "keeper");
  const linkedParent = mkdtempSync(join(tmpdir(), "prime-claw-foreign-checkout-"));
  const linked = join(linkedParent, "linked-main");
  git(f.root, "worktree", "add", "-q", linked, "main");

  const linkedTask = join(linked, f.task.path);
  const before = {
    linkedTask: readFileSync(linkedTask),
    linkedHead: git(linked, "rev-parse", "HEAD"),
    linkedStatus: git(linked, "status", "--short"),
    primaryTask: readFileSync(join(f.root, f.task.path)),
    primaryHead: git(f.root, "rev-parse", "HEAD"),
    primaryStatus: git(f.root, "status", "--short"),
  };
  let reservationCalls = 0;
  let allocatorCalls = 0;

  const guardedDependencies = {
    ...f.dependencies,
    reserveTaskOwnership() { reservationCalls += 1; throw new Error("must not reserve"); },
    allocateTaskEpisode: async () => { allocatorCalls += 1; throw new Error("must not allocate"); },
  };
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", { ...f.ctx, cwd: linked }, guardedDependencies, { engine: "local" }),
    /canonical primary main checkout/,
  );
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", f.ctx, guardedDependencies, { engine: "local" }),
    /canonical primary main checkout/,
  );

  assert.equal(git(linked, "branch", "--show-current"), "main");
  assert.deepEqual(readFileSync(linkedTask), before.linkedTask);
  assert.equal(git(linked, "rev-parse", "HEAD"), before.linkedHead);
  assert.equal(git(linked, "status", "--short"), before.linkedStatus);
  assert.deepEqual(readFileSync(join(f.root, f.task.path)), before.primaryTask);
  assert.equal(git(f.root, "rev-parse", "HEAD"), before.primaryHead);
  assert.equal(git(f.root, "status", "--short"), before.primaryStatus);
  assert.equal(f.record, null);
  assert.equal(existsSync(join(linked, ".prime-claw", "ownership.json")), false);
  assert.equal(reservationCalls, 0);
  assert.equal(allocatorCalls, 0);
  assert.deepEqual(f.events, []);
});

test("task admission preflight rejects unclean task and nonterminal ownership without mutation", async () => {
  const dirty = fixture();
  writeFileSync(join(dirty.root, dirty.task.path), `${readFileSync(join(dirty.root, dirty.task.path), "utf8")}\nlocal change\n`);
  const dirtyHead = git(dirty.root, "rev-parse", "HEAD");
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", dirty.ctx, dirty.dependencies, { engine: "local" }),
    /task path to be clean/,
  );
  assert.equal(git(dirty.root, "rev-parse", "HEAD"), dirtyHead);
  assert.equal(view(dirty.root).status, "In Planning");

  const owned = fixture();
  owned.ownership.write(owned.root, {
    version: 1, status: "provisioning", operationId: "other", engine: "local", ownerSessionId: "owner-session",
    sourceLocation: ".ralph/plans/future/other", slug: "other", baseRef: "base", bundleDigest: "0".repeat(64),
    createdAt: "x", updatedAt: "x",
  });
  const ownedHead = git(owned.root, "rev-parse", "HEAD");
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", owned.ctx, owned.dependencies, { engine: "local" }),
    /Non-terminal Episode ownership already exists/,
  );
  assert.equal(git(owned.root, "rev-parse", "HEAD"), ownedHead);
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


test("separate-process recovery waits for another owner's admission reservation boundary", async (t) => {
  for (const recoveryMode of ["blocked", "rollback"]) {
    await t.test(recoveryMode, async () => {
      const f = fixture();
      const created = execFileSync(BACKLOG, [
        "task", "create", `Second ${recoveryMode} recovery-race task`,
        "--status", "In Planning",
        "--description", "Create an independently owned Episode",
        "--plan", "1. Create the bounded resource.\n2. Verify exact identity.",
        "--plain",
      ], { cwd: f.root, encoding: "utf8" });
      const secondId = created.match(/PRIMECLAW-[0-9.]+/)?.[0];
      assert.ok(secondId);
      const secondTask = view(f.root, secondId);
      git(f.root, "add", "--", secondTask.path);
      git(f.root, "commit", "-q", "--only", "-m", "plan recovery-race task", "--", secondTask.path);

      const worker = join(f.root, `recovery-${recoveryMode}-worker.mjs`);
      const specUrl = new URL("../src/prime-agent-plugin/extension-support/spec-episode.ts", import.meta.url).href;
      const ownershipUrl = new URL("../src/prime-agent-plugin/extension-support/episode-ownership.ts", import.meta.url).href;
      const resolverUrl = new URL("../src/prime-agent-plugin/extension-support/reviewed-plan-support.ts", import.meta.url).href;
      writeFileSync(worker, `
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { CliTaskEpisodeAdmissionGit, createTaskEpisode } from ${JSON.stringify(specUrl)};
import { readEpisodeOwnership, writeEpisodeOwnership } from ${JSON.stringify(ownershipUrl)};
import { resolveBacklogTask } from ${JSON.stringify(resolverUrl)};
const [root, taskId, owner, recoveryMode, barrier, backlog] = process.argv.slice(2);
const nativeAtomicsWait = Atomics.wait.bind(Atomics);
let admissionWaitSignaled = false;
Atomics.wait = (...args) => {
  if (owner === "owner-a" && !admissionWaitSignaled) {
    admissionWaitSignaled = true;
    process.stdout.write("A_WAITING_ON_ADMISSION_LOCK\\n");
  }
  return nativeAtomicsWait(...args);
};
class Runner {
  run(command, args, options = {}) {
    const result = spawnSync(command === "backlog" ? backlog : command, args, { cwd: options.cwd, encoding: "utf8" });
    if (result.status !== 0 && !options.allowFailure) throw new Error(result.stderr || result.stdout);
    return { stdout: result.stdout || "", stderr: result.stderr || "", status: result.status ?? 1 };
  }
}
class AdmissionGit extends CliTaskEpisodeAdmissionGit {
  push() {}
  commitOnlyPath(root, path, message) {
    const commit = super.commitOnlyPath(root, path, message);
    if (owner === "owner-b" && message.startsWith("chore: admit")) {
      process.stdout.write("B_COMMITTED\\n");
      readFileSync(barrier);
    }
    return commit;
  }
}
const runner = new Runner();
const ctx = { cwd: root, model: { provider: "test", id: "model" }, sessionManager: {
  getSessionId: () => owner,
  getSessionFile: () => join(root, owner + ".jsonl"),
  getHeader: () => ({ rlmDepth: 0 }),
} };
const dependencies = {
  admissionGit: new AdmissionGit(),
  admissionRunner: runner,
  taskResolver: (cwd, id) => resolveBacklogTask(cwd, id, runner),
  allocateTaskEpisode: async () => {
    const reserved = readEpisodeOwnership(root, owner);
    if (owner === "owner-a" && recoveryMode === "blocked") {
      writeEpisodeOwnership(root, { ...reserved, status: "uncertain", uncertaintyReason: "simulated session publication failure" });
      process.stdout.write("A_RECOVERY_READY\\n");
      readFileSync(barrier);
      throw new Error("simulated session publication failure");
    }
    const active = { ...reserved, status: "active", worktree: join(root, owner + "-worktree"), branch: "episode/" + owner,
      head: reserved.baseRef, episodeId: "episode-" + owner, episodeSessionFile: join(root, "episode-" + owner + ".jsonl"), episodeActiveSessionId: "route-" + owner };
    writeEpisodeOwnership(root, active);
    return { ...active, reused: false };
  },
};
if (owner === "owner-a" && recoveryMode === "rollback") {
  dependencies.reserveTaskOwnership = () => {
    throw { toString() {
      process.stdout.write("A_RECOVERY_READY\\n");
      readFileSync(barrier);
      return "reservation rejected before write";
    } };
  };
}
try {
  const result = await createTaskEpisode(taskId, "call-" + owner, ctx, dependencies, { engine: "local" });
  process.stdout.write(JSON.stringify({ owner, outcome: "created", taskId: result.taskId }) + "\\n");
} catch (error) {
  process.stdout.write(JSON.stringify({ owner, outcome: "failed", error: String(error) }) + "\\n");
}
`);
      const aBarrier = join(f.root, `a-${recoveryMode}.fifo`);
      const bBarrier = join(f.root, `b-${recoveryMode}.fifo`);
      execFileSync("mkfifo", [aBarrier, bBarrier]);
      const run = (taskId, owner, barrier, readyText) => {
        const child = spawn(process.execPath, [
          "--experimental-strip-types", worker, f.root, taskId, owner, recoveryMode, barrier, BACKLOG,
        ], { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "", stderr = "", readyResolve, readyReject, contentionResolve, contentionReject;
        const ready = new Promise((resolveReady, rejectReady) => { readyResolve = resolveReady; readyReject = rejectReady; });
        const contention = new Promise((resolveContention, rejectContention) => {
          contentionResolve = resolveContention;
          contentionReject = rejectContention;
        });
        child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
          if (stdout.includes(readyText)) readyResolve();
          if (stdout.includes("A_WAITING_ON_ADMISSION_LOCK")) contentionResolve();
        });
        child.stderr.on("data", (chunk) => { stderr += chunk; });
        const done = new Promise((resolveDone, rejectDone) => {
          child.on("error", (error) => { readyReject(error); contentionReject(error); rejectDone(error); });
          child.on("close", (code) => {
            if (!stdout.includes(readyText)) readyReject(new Error(stdout + stderr));
            if (owner === "owner-a" && !stdout.includes("A_WAITING_ON_ADMISSION_LOCK")) {
              contentionReject(new Error(`owner-a exited before contending on the admission lock: ${stdout}${stderr}`));
            }
            if (code === 0) resolveDone({ stdout, stderr });
            else rejectDone(new Error(stdout + stderr));
          });
        });
        return { child, ready, contention, done };
      };

      const first = run("PRIMECLAW-1", "owner-a", aBarrier, "A_RECOVERY_READY");
      await first.ready;
      const second = run(secondId, "owner-b", bBarrier, "B_COMMITTED");
      await second.ready;
      writeFileSync(aBarrier, "enter recovery");
      let contentionFailure;
      try {
        await new Promise((resolveContention, rejectContention) => {
          const timeout = setTimeout(
            () => rejectContention(new Error("owner-a did not contend on the held admission lock")),
            5_000,
          );
          first.contention.then(
            () => { clearTimeout(timeout); resolveContention(); },
            (error) => { clearTimeout(timeout); rejectContention(error); },
          );
        });
      } catch (error) {
        contentionFailure = error;
      }
      const recoveryExitedWhileAdmissionHeld = first.child.exitCode !== null;
      writeFileSync(bBarrier, "finish reservation");
      const [firstResult, secondResult] = await Promise.all([first.done, second.done]);

      if (contentionFailure) throw contentionFailure;
      assert.equal(recoveryExitedWhileAdmissionHeld, false, "recovery must wait for the other owner's reservation boundary");
      assert.match(secondResult.stdout, /"outcome":"created"/);
      assert.equal(view(f.root, secondId).status, "In Progress");
      const records = readAllEpisodeOwnership(f.root);
      assert.equal(records.find((record) => record.ownerSessionId === "owner-b")?.status, "active");
      if (recoveryMode === "blocked") {
        assert.match(firstResult.stdout, /is Blocked and requires exact recovery/);
        assert.equal(view(f.root).status, "Blocked");
        assert.equal(records.find((record) => record.ownerSessionId === "owner-a")?.status, "uncertain");
      } else {
        assert.match(firstResult.stdout, /was returned to In Planning.*reservation rejected before write/);
        assert.equal(view(f.root).status, "In Planning");
        assert.equal(records.some((record) => record.ownerSessionId === "owner-a"), false);
      }
    });
  }
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


test("task admission status and plan preflight reject before main mutation", async () => {
  const wrongStatus = fixture();
  execFileSync(BACKLOG, ["task", "edit", "--status", "In Design", "--plain", "--", "PRIMECLAW-1"], { cwd: wrongStatus.root });
  git(wrongStatus.root, "add", "--", wrongStatus.task.path);
  git(wrongStatus.root, "commit", "-q", "--only", "-m", "return to design", "--", wrongStatus.task.path);
  const statusHead = git(wrongStatus.root, "rev-parse", "HEAD");
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", wrongStatus.ctx, wrongStatus.dependencies, { engine: "local" }),
    /requires the exact task to be In Planning/,
  );
  assert.equal(git(wrongStatus.root, "rev-parse", "HEAD"), statusHead);
  assert.equal(wrongStatus.record, null);

  const placeholder = fixture();
  execFileSync(BACKLOG, ["task", "edit", "--plan", "TODO: write the implementation plan", "--plain", "--", "PRIMECLAW-1"], { cwd: placeholder.root });
  git(placeholder.root, "add", "--", placeholder.task.path);
  git(placeholder.root, "commit", "-q", "--only", "-m", "placeholder plan", "--", placeholder.task.path);
  const planHead = git(placeholder.root, "rev-parse", "HEAD");
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", placeholder.ctx, placeholder.dependencies, { engine: "local" }),
    /requires a meaningful Implementation Plan/,
  );
  assert.equal(git(placeholder.root, "rev-parse", "HEAD"), planHead);
  assert.equal(view(placeholder.root).status, "In Planning");
  assert.equal(placeholder.record, null);
});

test("failed In Progress commit is recovered by one exact In Planning commit", async () => {
  const f = fixture();
  const real = f.dependencies.admissionGit;
  let commits = 0;
  const admissionGit = {
    repositoryRoot: (cwd) => real.repositoryRoot(cwd),
    branch: (repo) => real.branch(repo),
    head: (repo) => real.head(repo),
    commitPaths: (repo, ref) => real.commitPaths(repo, ref),
    pathStatus: (repo, path) => real.pathStatus(repo, path),
    push: (repo) => real.push(repo),
    commitOnlyPath(repo, path, message) {
      commits += 1;
      if (commits === 1) throw new Error("status commit rejected before write");
      return real.commitOnlyPath(repo, path, message);
    },
  };
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", f.ctx, {
      ...f.dependencies,
      admissionGit,
      allocateTaskEpisode: async () => { throw new Error("must not allocate"); },
    }, { engine: "local" }),
    /returned to In Planning.*status commit rejected before write/,
  );
  assert.equal(commits, 2);
  assert.equal(view(f.root).status, "In Planning");
  assert.equal(git(f.root, "log", "-1", "--pretty=%s"), "chore: roll back PRIMECLAW-1 episode admission");
  assert.deepEqual(commitPaths(f.root), [f.task.path]);
  assert.equal(f.record, null);
});


test("allocator return without durable active identity is published as Blocked", async () => {
  const f = fixture();
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", f.ctx, {
      ...f.dependencies,
      allocateTaskEpisode: async () => ({ ...f.record, status: "active", reused: false }),
    }, { engine: "local" }),
    /is Blocked and requires exact recovery.*exact active reservation identity/,
  );
  assert.equal(view(f.root).status, "Blocked");
  assert.equal(f.record.status, "provisioning");
  assert.match(JSON.stringify(view(f.root)), /reconcile every recorded task, worktree, and session identity/);
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
