import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

import {
  CliTaskEpisodeAdmissionGit,
  allocateReservedTaskEpisode,
  createTaskEpisode,
} from "../src/prime-agent-plugin/extension-support/spec-episode.ts";
import { createReviewedPlanExtension } from "../src/prime-agent-plugin/extensions/reviewed-plan.ts";

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

class FixtureRunner {
  run(command, args, options = {}) {
    const result = spawnSync(command, args, {
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

const nativeStatus = {
  "In Planning": "in_planning",
  "In Progress": "in_progress",
  Blocked: "blocked",
};
const revision = {
  "In Planning": "a".repeat(32),
  "In Progress": "b".repeat(32),
  Blocked: "c".repeat(32),
};

function published(root, taskId, canonicalStatus, design) {
  const status = nativeStatus[canonicalStatus];
  const nativeView = {
    id: taskId,
    title: "Provider-native admission fixture",
    status,
    design,
    comments: [{ id: 7, text: `${canonicalStatus} raw evidence` }],
  };
  return {
    status: "pushed",
    evidence: {
      provider: "beads",
      projectRoot: root,
      taskId,
      submittedRevision: revision[canonicalStatus],
      postMutationObservation: {
        revision: revision[canonicalStatus], clean: false,
        command: { command: "bd", args: ["sql", "--json"], status: 0, stdout: "raw local mutation revision", stderr: "" },
        nativeView: { status_count: 2, opaque: ["issues", "comments"] },
      },
      postPushObservation: {
        revision: revision[canonicalStatus], clean: false,
        command: { command: "bd", args: ["sql", "--json"], status: 0, stdout: "raw local post-push revision", stderr: "post-push observation warning" },
      },
      mutation: { command: "bd", args: ["update", taskId, "--status", status], status: 0, stdout: "native update succeeded", stderr: "auto-commit warning: issues remain pending" },
      push: { command: "bd", args: ["dolt", "push"], status: 0, stdout: "Everything up-to-date", stderr: "native push warning" },
      commands: [{ command: "bd", args: ["dolt", "status", "--json"], status: 0, stdout: "raw touched-table/staged-set facts", stderr: "" }],
      publication: { remoteName: "origin", ref: "refs/dolt/data", raw: "no exact remote task observation" },
      taskAfterPush: {
        taskId,
        title: nativeView.title,
        nativeStatus: status,
        canonicalStatus,
        nativeView,
      },
    },
  };
}

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-beads-admission-")));
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "Prime Claw Test");
  git(root, "config", "user.email", "prime-claw@example.invalid");
  execFileSync("sh", ["-c", "printf 'code baseline\\n' > code.txt"], { cwd: root });
  git(root, "add", "code.txt");
  git(root, "commit", "-q", "-m", "code baseline");

  const taskId = "BEADS-43";
  const design = "1. Publish one exact task.\n2. Reserve and allocate its Episode.";
  let liveDesign = design;
  let unrelatedTask = {
    id: "BEADS-other",
    title: "Unrelated provider task",
    status: "open",
    revision: "unrelated-before",
    comments: [],
  };
  let status = "In Planning";
  let resolvedId = taskId;
  let operationInProgress = false;
  let trackedStatus = "";
  let upstreamHead = git(root, "rev-parse", "HEAD");
  let publicationOverride;
  let publicationMutator;
  let reservationFailure;
  let allocationFailure;
  let allocationMutator;
  let allocatorCalls = 0;
  const statusCalls = [];
  const reservationCalls = [];
  const records = new Map();
  const runner = new FixtureRunner();
  const realGit = new CliTaskEpisodeAdmissionGit();
  const admissionGit = {
    repositoryRoot: (cwd) => realGit.repositoryRoot(cwd),
    branch: (repo) => realGit.branch(repo),
    head: (repo) => realGit.head(repo),
    upstreamHead: () => upstreamHead,
    trackedStatus: () => trackedStatus,
    operationInProgress: () => operationInProgress,
    commitPaths: (repo, ref) => realGit.commitPaths(repo, ref),
    pathStatus: (repo, path) => realGit.pathStatus(repo, path),
    commitOnlyPath: (repo, path, message) => realGit.commitOnlyPath(repo, path, message),
    push: (repo) => realGit.push(repo),
  };
  const ownership = {
    read(_projectRoot, ownerSessionId) {
      return records.get(ownerSessionId ?? "owner-session") ?? null;
    },
    write(_projectRoot, record) { records.set(record.ownerSessionId, record); },
  };
  const selection = () => {
    const native = nativeStatus[status];
    return {
      provider: "beads",
      taskId: resolvedId,
      title: "Provider-native admission fixture",
      nativeStatus: native,
      status,
      projectRoot: root,
      nativeView: {
        id: resolvedId,
        title: "Provider-native admission fixture",
        status: native,
        design: liveDesign,
        comments: [{ id: 7, text: `${status} raw evidence` }],
      },
    };
  };
  const commitTaskStatus = (options) => {
    statusCalls.push(options.status);
    assert.equal(options.taskId, taskId);
    assert.equal(options.expectedProvider, "beads");
    if (publicationOverride) return publicationOverride(options.status);
    status = options.status;
    const result = published(root, taskId, status, liveDesign);
    publicationMutator?.(options.status);
    return result;
  };
  const reserveBeadsTaskOwnership = (input, reservationDependencies) => {
    reservationCalls.push(input);
    if (reservationFailure) throw reservationFailure;
    const now = "2026-10-20T17:00:00.000Z";
    const record = {
      version: 2,
      provider: "beads",
      status: "provisioning",
      operationId: input.operationId ?? "beads-operation",
      engine: input.engine,
      ownerSessionId: input.ownerSessionId,
      taskId,
      providerRevision: input.publication.evidence.submittedRevision,
      taskEvidence: input.publication.evidence.taskAfterPush.nativeView,
      baseRef: input.baseRef,
      ...(input.integrationBranch ? { integrationBranch: input.integrationBranch } : {}),
      createdAt: now,
      updatedAt: now,
      ...(input.projectSetupId ? { projectSetupId: input.projectSetupId } : {}),
      ...(input.routingEnvironmentId ? { routingEnvironmentId: input.routingEnvironmentId } : {}),
    };
    reservationDependencies.ownership.write(root, record);
    return record;
  };
  const allocateTaskEpisode = async () => {
    allocatorCalls += 1;
    const reserved = ownership.read(root, "owner-session");
    allocationMutator?.(reserved);
    if (allocationFailure) throw allocationFailure;
    const active = {
      ...reserved,
      status: "active",
      worktreeName: "prime-claw-beads-43-episode-beads-op",
      worktree: join(root, "episode-worktree"),
      branch: "episode/beads-43-beads-op",
      head: reserved.baseRef,
      episodeId: "episode-session",
      episodeSessionFile: join(root, "episode.jsonl"),
      episodeActiveSessionId: "active-route",
    };
    ownership.write(root, active);
    return { ...active, reused: false };
  };
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
    admissionGit,
    admissionRunner: runner,
    providerDetector: () => ({ kind: "selected", evidence: { provider: "beads" } }),
    providerTaskResolver: () => selection(),
    commitTaskStatus,
    reserveBeadsTaskOwnership,
    allocateTaskEpisode,
    ownership,
    reservationOperationId: "beads-operation",
    now: () => "2026-10-20T17:30:00.000Z",
  };
  return {
    root, taskId, design, ctx, dependencies, statusCalls, reservationCalls, ownership,
    get status() { return status; },
    set status(value) { status = value; },
    get allocatorCalls() { return allocatorCalls; },
    set resolvedId(value) { resolvedId = value; },
    set operationInProgress(value) { operationInProgress = value; },
    set trackedStatus(value) { trackedStatus = value; },
    set upstreamHead(value) { upstreamHead = value; },
    set publicationOverride(value) { publicationOverride = value; },
    set publicationMutator(value) { publicationMutator = value; },
    set liveDesign(value) { liveDesign = value; },
    get unrelatedTask() { return structuredClone(unrelatedTask); },
    set unrelatedTask(value) { unrelatedTask = structuredClone(value); },
    set reservationFailure(value) { reservationFailure = value; },
    set allocationFailure(value) { allocationFailure = value; },
    set allocationMutator(value) { allocationMutator = value; },
  };
}

async function create(f) {
  return createTaskEpisode(f.taskId, "tool-call", f.ctx, f.dependencies, { engine: "local" });
}

test("registered Beads implement-task path delegates once without invocation-proof authority", async () => {
  const f = fixture();
  const workflows = join(f.root, ".prime-claw", "workflows");
  mkdirSync(workflows, { recursive: true });
  writeFileSync(join(workflows, "implement-task-prep.md"), "---\nname: implement-task-prep\n---\nBEADS PREP POLICY\n");
  writeFileSync(join(workflows, "implement-task.md"), "---\nname: implement-task\n---\nBEADS IMPLEMENT POLICY\n");
  const guideRoot = join(f.root, "plugin");
  mkdirSync(join(guideRoot, "skills", "prime-claw-oversee-episode"), { recursive: true });
  writeFileSync(join(guideRoot, "skills", "prime-claw-oversee-episode", "SKILL.md"), "FULL OVERSIGHT GUIDE\n");

  const commands = new Map(), tools = new Map(), events = new Map(), sent = [], placements = [];
  const pi = {
    registerCommand(name, value) { commands.set(name, value); },
    registerTool(tool) { tools.set(tool.name, tool); },
    on(name, handler) { events.set(name, handler); },
    sendUserMessage(message, options) { sent.push({ message, options }); },
    async sendMessage() {},
  };
  const ctx = {
    ...f.ctx,
    hasUI: false,
    ui: { notify(message, level) { sent.push({ notify: message, level }); } },
  };
  createReviewedPlanExtension({
    ...f.dependencies,
    guideRoot,
    async placementResolver(projectRoot, host) {
      placements.push({ projectRoot, host });
      return { engine: "local" };
    },
  })(pi);

  assert.equal(commands.size, 0);
  const entry = await tools.get("implement_task").execute(
    "beads-entry", { taskId: f.taskId }, undefined, undefined, ctx,
  );
  assert.equal(entry.isError, undefined);
  assert.equal(sent.length, 2);
  assert.match(sent[0].message, /BEADS PREP POLICY/);
  assert.deepEqual(sent[0].options, { deliverAs: "steer" });
  assert.match(sent[1].message, /BEADS IMPLEMENT POLICY/);
  assert.deepEqual(sent[1].options, { deliverAs: "followUp" });
  assert.equal(f.allocatorCalls, 0);
  assert.equal(events.has("agent_end"), false);

  const result = await tools.get("create_task_episode").execute(
    "registered-create", { taskId: f.taskId }, undefined, undefined, ctx,
  );
  assert.equal(result.isError, undefined);
  assert.equal(result.details.provider, "beads");
  assert.equal(result.details.providerRevision, revision["In Progress"]);
  assert.equal(result.details.taskEvidence.design, f.design);
  const mutation = published(f.root, f.taskId, "In Progress", f.design);
  assert.deepEqual(result.details.beadsTaskMutation, mutation);
  assert.ok(result.content[0].text.includes(JSON.stringify(mutation)));
  assert.equal(Object.hasOwn(result.details.beadsTaskMutation.evidence, "remotePublishedTask"), false);
  assert.equal(Object.hasOwn(result.details.beadsTaskMutation.evidence, "publicationHead"), false);
  assert.equal(Object.hasOwn(result.details.beadsTaskMutation.evidence, "publishedRevision"), false);
  assert.match(result.content[0].text, /auto-commit warning: issues remain pending/);
  assert.match(result.content[0].text, /post-push observation warning/);
  assert.match(result.content[0].text, /One fixed execute assignment/);
  assert.match(result.content[0].text, /Exact provider-native result/);
  assert.deepEqual(f.statusCalls, ["In Progress"]);
  assert.equal(f.reservationCalls.length, 1);
  assert.equal(f.allocatorCalls, 1);
  assert.deepEqual(placements, [
    { projectRoot: f.root, host: undefined },
    { projectRoot: f.root, host: undefined },
  ]);

  f.status = "In Planning";
  const replay = await tools.get("create_task_episode").execute(
    "registered-replay", { taskId: f.taskId }, undefined, undefined, ctx,
  );
  assert.equal(replay.isError, true);
  assert.match(replay.content[0].text, /Non-terminal Episode ownership/);
  assert.deepEqual(f.statusCalls, ["In Progress"]);
  assert.equal(f.allocatorCalls, 1);
});

test("registered create_task_episode admits Beads directly without prior command or entry tool", async () => {
  const f = fixture(), tools = new Map(), sent = [];
  // Role judgment belongs to the edited workflow, not RLM metadata.
  f.ctx.sessionManager.getHeader = () => ({ rlmDepth: 3 });
  const pi = {
    registerCommand() {}, registerTool(tool) { tools.set(tool.name, tool); }, on() {},
    sendUserMessage(message) { sent.push(message); }, async sendMessage() {},
  };
  createReviewedPlanExtension({ ...f.dependencies, async placementResolver() { return { engine: "local" }; } })(pi);
  const result = await tools.get("create_task_episode").execute("direct", { taskId: f.taskId }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined);
  assert.equal(result.details.provider, "beads");
  assert.deepEqual(f.statusCalls, ["In Progress"]);
  assert.equal(f.reservationCalls.length, 1);
  assert.equal(f.allocatorCalls, 1);
  assert.equal(sent.length, 0);
});

test("direct Beads admission publishes, reserves, allocates, and proves one exact active identity", async () => {
  const f = fixture();
  const codeHead = git(f.root, "rev-parse", "HEAD");
  const result = await create(f);

  assert.equal(result.provider, "beads");
  assert.equal(result.status, "active");
  assert.equal(result.taskId, f.taskId);
  assert.equal(result.baseRef, codeHead);
  assert.equal(result.head, codeHead);
  assert.equal(result.integrationBranch, "main");
  assert.equal(result.providerRevision, revision["In Progress"]);
  assert.equal(result.taskEvidence.design, f.design);
  assert.deepEqual(f.statusCalls, ["In Progress"]);
  assert.equal(f.reservationCalls.length, 1);
  assert.equal(f.reservationCalls[0].baseRef, codeHead);
  // Native push success is not proof that this task reached published history.
  assert.equal(f.reservationCalls[0].publication.status, "pushed");
  assert.equal(f.reservationCalls[0].integrationBranch, "main");
  assert.equal(f.allocatorCalls, 1);
  assert.equal(f.status, "In Progress");
  assert.equal(git(f.root, "rev-parse", "HEAD"), codeHead);
});

test("Beads creation leaves status, design, code cleanliness and upstream suitability to editable policy", async (t) => {
  for (const [name, arrange] of [
    ["operation marker", f => { f.operationInProgress = true; }],
    ["tracked dirt", f => { f.trackedStatus = "MM code.txt"; }],
    ["upstream drift", f => { f.upstreamHead = "f".repeat(40); }],
    ["unmapped status and absent design", f => { f.status = "custom-native"; f.liveDesign = undefined; }],
    ["placeholder design", f => { f.liveDesign = "TODO: write the implementation plan"; }],
  ]) await t.test(name, async () => {
    const f = fixture(); arrange(f);
    const result = await create(f);
    assert.equal(result.status, "active");
    assert.deepEqual(f.statusCalls, ["In Progress"]);
    assert.equal(f.reservationCalls.length, 1);
    assert.equal(f.allocatorCalls, 1);
  });
  const wrong = fixture(); wrong.resolvedId = "BEADS-43-full";
  await assert.rejects(create(wrong), /exact requested canonical ID/);
  assert.deepEqual(wrong.statusCalls, []);
});

test("Beads admission allocates one isolated Episode at the exact clean published feature base", async (t) => {
  const f = fixture();
  const artifacts = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-beads-stack-")));
  const remote = join(artifacts, "remote.git");
  let episodeWorktree;
  t.after(() => {
    if (episodeWorktree) rmSync(episodeWorktree, { recursive: true, force: true });
    rmSync(f.root, { recursive: true, force: true });
    rmSync(artifacts, { recursive: true, force: true });
  });
  const mainHead = git(f.root, "rev-parse", "main");
  const integrationBranch = "feature/stack";
  git(f.root, "checkout", "-qb", integrationBranch);
  mkdirSync(join(f.root, ".agents", "skills", "execute"), { recursive: true });
  writeFileSync(join(f.root, ".agents", "skills", "execute", "SKILL.md"), "Execute the exact provider-native task.\n");
  writeFileSync(join(f.root, "code.txt"), "accepted stacked baseline\n");
  git(f.root, "add", ".agents/skills/execute/SKILL.md", "code.txt");
  git(f.root, "commit", "-qm", "accepted stacked code");
  execFileSync("git", ["init", "-q", "--bare", remote]);
  git(f.root, "remote", "add", "origin", remote);
  git(f.root, "push", "-qu", "origin", integrationBranch);
  const codeHead = git(f.root, "rev-parse", "HEAD");
  assert.notEqual(codeHead, mainHead);
  let sessions = 0, assignments = 0;
  const result = await createTaskEpisode(f.taskId, "stack-call", f.ctx, {
    ...f.dependencies,
    admissionGit: new CliTaskEpisodeAdmissionGit(),
    allocateTaskEpisode: undefined,
    beadsTransport(cwd) {
      return { status: "ready", evidence: {
        provider: "beads", projectRoot: cwd, revision: revision["In Progress"],
        workingSet: [], publication: { raw: "disposable transport observation; no exact-task remote proof" },
      } };
    },
    beadsTaskReader(cwd, taskId) {
      return { ...f.dependencies.providerTaskResolver(f.root, taskId), projectRoot: cwd };
    },
    publisher: {
      async createFresh(options) {
        sessions += 1;
        episodeWorktree = options.worktree;
        const reserved = f.ownership.read(f.root, "owner-session");
        assert.equal(reserved.baseRef, codeHead);
        assert.equal(reserved.integrationBranch, integrationBranch);
        assert.notEqual(realpathSync(options.worktree), f.root);
        assert.equal(git(options.worktree, "rev-parse", "HEAD"), codeHead);
        const identity = { sessionId: "stack-episode", sessionFile: join(artifacts, "episode.jsonl") };
        writeFileSync(identity.sessionFile, "{}\n");
        await options.onAllocated?.(identity);
        return { ...identity, activeSessionId: "stack-route" };
      },
      async deliverExecute(route) { assert.equal(route, "stack-route"); assignments += 1; },
      close() {},
    },
  }, { engine: "local" });

  assert.equal(result.status, "active");
  assert.equal(result.integrationBranch, integrationBranch);
  assert.equal(result.baseRef, codeHead);
  assert.equal(result.head, codeHead);
  assert.equal(result.providerRevision, revision["In Progress"]);
  assert.notEqual(result.providerRevision, codeHead);
  assert.equal(result.taskEvidence.design, f.design);
  assert.equal(f.reservationCalls.length, 1);
  assert.equal(f.reservationCalls[0].integrationBranch, integrationBranch);
  assert.equal(f.reservationCalls[0].baseRef, codeHead);
  assert.equal(sessions, 1);
  assert.equal(assignments, 1);
  assert.deepEqual(f.statusCalls, ["In Progress"]);
  assert.equal(git(f.root, "branch", "--show-current"), integrationBranch);
  assert.equal(git(f.root, "rev-parse", "HEAD"), codeHead);
  assert.equal(git(f.root, "rev-parse", "@{upstream}"), codeHead);
  assert.equal(git(f.root, "rev-parse", "main"), mainHead);
  assert.equal(git(f.root, "status", "--porcelain"), "");
  assert.notEqual(result.branch, integrationBranch);
  assert.equal(git(result.worktree, "branch", "--show-current"), result.branch);
  assert.equal(git(result.worktree, "rev-parse", "HEAD"), codeHead);
  assert.equal(git(result.worktree, "status", "--porcelain"), "");
});

test("Beads admission retains exact named integration-target addressing before mutation", async (t) => {
  const cases = [
    ["detached HEAD", (f) => { git(f.root, "checkout", "-q", "--detach"); }, /named.*branch|detached|not a symbolic ref/i],
    ["same-SHA branch drift", (f) => {
      const resolve = f.dependencies.providerTaskResolver;
      let resolutions = 0;
      f.dependencies.providerTaskResolver = (...args) => {
        const selected = resolve(...args);
        if (++resolutions === 1) git(f.root, "checkout", "-qb", "feature/other");
        return selected;
      };
    }, /integration branch|branch.*changed/i],
    ["canonical ID drift", (f) => { f.resolvedId = "BEADS-43-full"; }, /exact requested canonical ID/],
  ];
  for (const [name, arrange, message] of cases) {
    await t.test(name, async () => {
      const f = fixture();
      t.after(() => rmSync(f.root, { recursive: true, force: true }));
      arrange(f);
      const beforeHead = git(f.root, "rev-parse", "HEAD");
      const beforeStatus = git(f.root, "status", "--porcelain");
      const beforeTaskStatus = f.status;
      const beforeUnrelated = f.unrelatedTask;
      const worktrees = () => git(f.root, "worktree", "list", "--porcelain").split(/\r?\n/).filter((line) => line.startsWith("worktree "));
      const beforeWorktrees = worktrees();
      await assert.rejects(create(f), message);
      assert.equal(git(f.root, "rev-parse", "HEAD"), beforeHead);
      assert.equal(git(f.root, "status", "--porcelain"), beforeStatus);
      assert.equal(f.status, beforeTaskStatus);
      assert.deepEqual(f.unrelatedTask, beforeUnrelated);
      assert.deepEqual(worktrees(), beforeWorktrees);
      assert.equal(existsSync(join(f.root, ".prime-claw", "ownership.json")), false);
      assert.deepEqual(f.statusCalls, []);
      assert.equal(f.reservationCalls.length, 0);
      assert.equal(f.allocatorCalls, 0);
      assert.equal(f.ownership.read(f.root, "owner-session"), null);
    });
  }
});


test("Beads admission surfaces raw review-required publication evidence without recovery or retry", async () => {
  const f = fixture();
  f.publicationOverride = () => ({
    status: "review-required",
    code: "concurrent-advance",
    phase: "synchronization",
    detail: "human review required",
    evidence: { provider: "beads", projectRoot: f.root, taskId: f.taskId, raw_marker: "retain-this-verbatim" },
  });
  await assert.rejects(create(f), /raw_marker.*retain-this-verbatim/);
  assert.deepEqual(f.statusCalls, ["In Progress"]);
  assert.equal(f.reservationCalls.length, 0);
  assert.equal(f.allocatorCalls, 0);
  assert.equal(f.ownership.read(f.root, "owner-session"), null);
  assert.equal(f.status, "In Planning");
});

test("Beads pre-reservation failure exposes native warnings and no automatic rollback", async () => {
  const f = fixture(); f.reservationFailure = new Error("reservation rejected before write");
  await assert.rejects(create(f), /reservation rejected before write.*Native admission result:.*auto-commit warning.*Current ownership: null/);
  assert.deepEqual(f.statusCalls, ["In Progress"]);
  assert.equal(f.status, "In Progress");
  assert.equal(f.ownership.read(f.root, "owner-session"), null);
  assert.equal(f.allocatorCalls, 0);
});


test("Beads post-reservation failure preserves exact uncertain resources and native facts without Blocked publication", async () => {
  const f = fixture();
  f.allocationMutator = reserved => f.ownership.write(f.root, {
    ...reserved, status: "uncertain", worktreeName: "retained-worktree", worktree: join(f.root, "retained-worktree"),
    branch: "episode/retained", head: reserved.baseRef, uncertaintyReason: "session allocation outcome unknown",
  });
  f.allocationFailure = new Error("session allocation outcome unknown");
  await assert.rejects(create(f), /session allocation outcome unknown.*Native admission result:.*native push warning.*Current ownership:.*retained-worktree/);
  const retained = f.ownership.read(f.root, "owner-session");
  assert.deepEqual(f.statusCalls, ["In Progress"]);
  assert.equal(f.status, "In Progress");
  assert.equal(retained.status, "uncertain");
  assert.equal(retained.operationId, "beads-operation");
  assert.equal(retained.baseRef, git(f.root, "rev-parse", "HEAD"));
  assert.equal(retained.worktree, join(f.root, "retained-worktree"));
  assert.equal(retained.branch, "episode/retained");
  assert.equal(retained.providerRevision, revision["In Progress"]);
  assert.equal(retained.taskEvidence.status, "in_progress");
  await assert.rejects(create(f), /Non-terminal Episode ownership already exists/);
  assert.equal(f.allocatorCalls, 1);
  assert.deepEqual(f.statusCalls, ["In Progress"]);
});


test("Beads compatible post-mutation code drift does not trigger a rollback", async () => {
  const f = fixture();
  f.publicationMutator = () => { f.trackedStatus = " M code.txt"; };
  const result = await create(f);
  assert.equal(result.status, "active");
  assert.deepEqual(f.statusCalls, ["In Progress"]);
  assert.equal(f.allocatorCalls, 1);
});


test("Beads allocation failure after code drift makes no failure-selected status mutation", async () => {
  const f = fixture();
  f.allocationMutator = () => { f.trackedStatus = " M code.txt"; };
  f.allocationFailure = new Error("allocation failed after tracked drift");
  await assert.rejects(create(f), /allocation failed after tracked drift/);
  const retained = f.ownership.read(f.root, "owner-session");
  assert.deepEqual(f.statusCalls, ["In Progress"]);
  assert.equal(retained.status, "provisioning");
  assert.equal(retained.providerRevision, revision["In Progress"]);
  assert.equal(retained.taskEvidence.status, "in_progress");
  assert.equal(f.allocatorCalls, 1);
});


test("Beads current raw refinements reach the caller without frozen native-view reapproval", async () => {
  const f = fixture();
  const changedDesign = `1. Compatible outside refinement.\n2. ${"x".repeat(1200)} raw-live-tail-marker`;
  const unrelatedAdvance = { ...f.unrelatedTask, revision: "unrelated-after", comments: [{ id: 99, text: "outside advance" }] };
  f.publicationMutator = () => { f.liveDesign = changedDesign; f.unrelatedTask = unrelatedAdvance; };
  const result = await create(f);
  assert.match(result.currentTask.nativeView.design, /raw-live-tail-marker/);
  assert.equal(result.beadsTaskMutation.evidence.taskAfterPush.nativeView.design, f.design);
  assert.deepEqual(f.statusCalls, ["In Progress"]);
  assert.equal(f.reservationCalls.length, 1);
  assert.equal(f.allocatorCalls, 1);
  assert.deepEqual(f.unrelatedTask, unrelatedAdvance);
});


test("Beads allocation failure does not invoke a second native publication or rewrite observed evidence", async () => {
  const f = fixture(); let publications = 0;
  f.allocationFailure = new Error("allocation failed after reservation");
  f.publicationOverride = requested => {
    publications += 1;
    assert.equal(requested, "In Progress", "no automatic Blocked or In Planning mutation");
    f.status = "In Progress";
    return published(f.root, f.taskId, requested, f.design);
  };
  await assert.rejects(create(f), /allocation failed after reservation.*Native admission result:/);
  assert.equal(publications, 1);
  const retained = f.ownership.read(f.root, "owner-session");
  assert.equal(retained.providerRevision, revision["In Progress"]);
  assert.equal(retained.taskEvidence.status, "in_progress");
  assert.equal(retained.status, "provisioning");
});


test("registered Beads creation carries native mutation qualifications and fresh local reads to its one initial execute", async () => {
  const f = fixture();
  const calls = [];
  const writeExecute = (cwd) => {
    mkdirSync(join(cwd, ".agents", "skills", "execute"), { recursive: true });
    writeFileSync(join(cwd, ".agents", "skills", "execute", "SKILL.md"), "EXECUTE NATIVE POLICY\n");
  };
  writeExecute(f.root);
  git(f.root, "add", "--", ".agents/skills/execute/SKILL.md");
  git(f.root, "commit", "-q", "-m", "install fixture execute workflow");
  const baseRef = git(f.root, "rev-parse", "HEAD");
  f.upstreamHead = baseRef;
  const preparation = {
    status: "ready",
    evidence: {
      provider: "beads", projectRoot: f.root, revision: "d".repeat(32),
      workingSet: [{ table_name: "issues", staged: true }, { table_name: "comments", status: "modified" }],
      publication: { remoteName: "origin", ref: "refs/dolt/data", raw: "native remote ref not observed" },
      commands: [{ command: "bd", args: ["dolt", "status", "--json"], status: 0, stdout: "raw pre-session working set", stderr: "pre-session native warning" }],
    },
  };
  const localTask = {
    provider: "beads", taskId: f.taskId, title: "Changed local task", nativeStatus: "blocked",
    nativeView: { id: f.taskId, title: "Changed local task", status: "blocked", design: "", opaque: { absent_remote_proof: true } },
  };
  let worktree;
  const identity = { sessionId: "initial-session", sessionFile: join(f.root, "initial.jsonl"), activeSessionId: "initial-route" };
  const dependencies = {
    ...f.dependencies,
    allocateTaskEpisode: allocateReservedTaskEpisode,
    filesystem: { exists: () => false },
    git: {
      repositoryRoot: () => f.root, head: () => baseRef, worktrees: () => [],
      branch: () => git(f.root, "branch", "--show-current"),
      assertCleanWorktree() { assert.fail("task allocation must not reapply cleanliness eligibility"); },
      createWorktree(_repo, branch, path, head) {
        calls.push(["worktree", branch, path, head]); worktree = path; writeExecute(path);
      },
    },
    beadsTransport(cwd) { calls.push(["transport", cwd]); return preparation; },
    beadsTaskReader(cwd, taskId) {
      calls.push(["read", cwd, taskId]);
      return { ...localTask, projectRoot: cwd };
    },
    publisher: {
      async createFresh(options) {
        calls.push(["fresh", options.worktree]);
        assert.deepEqual(calls.map(([name]) => name), ["worktree", "transport", "read", "fresh"]);
        await options.onAllocated({ sessionId: identity.sessionId, sessionFile: identity.sessionFile });
        const allocated = f.ownership.read(f.root, "owner-session");
        assert.equal(allocated.episodeId, identity.sessionId);
        assert.equal(allocated.status, "provisioning");
        return identity;
      },
      async deliverExecute(route, prompt) {
        calls.push(["execute", route, prompt]);
        const allocated = f.ownership.read(f.root, "owner-session");
        assert.equal(allocated.episodeActiveSessionId, route);
        assert.equal(allocated.status, "provisioning");
      },
      close() {},
    },
    async placementResolver() { return { engine: "local" }; },
  };
  const tools = new Map();
  createReviewedPlanExtension(dependencies)({
    registerCommand() {}, registerTool(tool) { tools.set(tool.name, tool); }, on() {},
    sendUserMessage() { assert.fail("creation must not add another assignment"); }, async sendMessage() {},
  });
  const result = await tools.get("create_task_episode").execute("initial-native", { taskId: f.taskId }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined, JSON.stringify(result));
  const mutation = published(f.root, f.taskId, "In Progress", f.design);
  assert.deepEqual(result.details.beadsTaskMutation, mutation);
  assert.ok(result.content[0].text.includes(JSON.stringify(mutation)));
  assert.deepEqual(calls.map(([name]) => name), ["worktree", "transport", "read", "fresh", "execute"]);
  assert.deepEqual(calls[1], ["transport", worktree]);
  assert.deepEqual(calls[2], ["read", worktree, f.taskId]);
  const prompt = calls.find(([name]) => name === "execute")[2];
  assert.match(prompt, /EXECUTE NATIVE POLICY/);
  const observation = JSON.parse(prompt.match(/<provider-task-observation>\n([\s\S]*?)\n<\/provider-task-observation>/)[1]);
  assert.deepEqual(observation.beadsTaskMutation, mutation);
  assert.deepEqual(observation.preparation, preparation);
  assert.deepEqual(observation.currentTask, { ...localTask, projectRoot: worktree });
  assert.deepEqual(observation.currentTaskEvidence, localTask.nativeView);
  assert.deepEqual(observation.previousTaskEvidence, mutation.evidence.taskAfterPush.nativeView);
  assert.equal(observation.currentProviderRevision, preparation.evidence.revision);
  assert.equal(Object.hasOwn(observation, "publishedProviderRevision"), false);
  assert.equal(Object.hasOwn(observation.preparation.evidence, "publishedRevision"), false);
  assert.equal(Object.hasOwn(observation.beadsTaskMutation.evidence, "remotePublishedTask"), false);
  const stored = f.ownership.read(f.root, "owner-session");
  assert.equal(stored.status, "active");
  assert.equal(stored.operationId, "beads-operation");
  assert.equal(stored.episodeId, identity.sessionId);
  assert.equal(stored.episodeActiveSessionId, identity.activeSessionId);
  assert.equal(stored.worktree, worktree);
  assert.equal(Object.hasOwn(stored, "beadsTaskMutation"), false);
  assert.equal(Object.hasOwn(stored, "preparation"), false);
  assert.deepEqual(f.statusCalls, ["In Progress"]);
  assert.equal(f.reservationCalls.length, 1);
});
