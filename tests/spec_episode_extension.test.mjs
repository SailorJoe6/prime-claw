import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  CliGitAdapter, CliOrcaAdapter, CliTaskEpisodeAdmissionGit, PrimeSessionPublisher,
  EpisodeStateUncertainError, OrcaMutationUncertainError, OrcaUnavailableError,
  allocateReservedTaskEpisode, bundleContentDigest, createSpecEpisode, handoffSpecEpisode,
  restoreBlockedSpecEpisode, transitionSpecEpisodeToTaskOwnership,
  handoffTaskEpisode, publishTaskEpisodeBlocked, publishTaskEpisodeResumed,
  publishTaskEpisodeReadyForMerge, integrateTaskEpisodeReadyForMerge,
  verifyTaskEpisodeReadyForMerge, delayTaskEpisodeReadyForMerge,
  mergeTaskEpisodeReadyForMerge, abandonTaskEpisode,
  publishTaskEpisodeChangesRequested, integrateTaskEpisodeChangesRequested,
  verifyTaskEpisodeChangesRequested, resumeTaskEpisodeChangesRequested,
  resolveBlockedWorkflowAuthority, resolveTaskReviewSnapshot, resolveTaskAbandonmentSnapshot,
  resolveTaskAbandonmentFileSnapshot, assertNoTaskArchiveCleanupTargets,
  assertNoHistoricalTaskArchiveCollision, finalizeTaskEpisodeCleanup,
  taskEpisodeCleanupResourceIdentity,
} from "../src/prime-agent-plugin/extension-support/spec-episode.ts";
import { parseEpisodeOwnership } from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";
import { CliTaskEpisodeCleanupAdapter } from "../src/prime-agent-plugin/extension-support/task-episode-cleanup.ts";

const LOCATION = ".ralph/plans/future/alpha";
function diskFixture() {
  const rawRoot = mkdtempSync(join(tmpdir(), "prime-claw-episode-"));
  execFileSync("git", ["init", "-q", rawRoot]);
  const root = realpathSync(rawRoot);
  mkdirSync(join(root, ".ralph", "plans", "future", "alpha"), { recursive: true });
  writeFileSync(join(root, ".ralph", "plans", "future", "alpha", "SPECIFICATION.md"), "spec");
  writeFileSync(join(root, ".ralph", "plans", "future", "alpha", "EXECUTION_PLAN.md"), "plan");
  mkdirSync(join(root, ".agents", "skills", "execute"), { recursive: true });
  writeFileSync(join(root, ".agents", "skills", "execute", "SKILL.md"), `---
name: execute
---
EXECUTE POLICY
`);
  mkdirSync(join(root, ".prime-claw", "workflows"), { recursive: true });
  writeFileSync(join(root, ".prime-claw", "workflows", "handoff.md"), `---
name: handoff
---
HANDOFF POLICY
`);
  const worktree = join(root, "episode-worktree");
  mkdirSync(join(worktree, ".agents", "skills", "execute"), { recursive: true });
  writeFileSync(join(worktree, ".agents", "skills", "execute", "SKILL.md"), `---
name: execute
---
EXECUTE POLICY
`);
  mkdirSync(join(worktree, ".prime-claw", "workflows"), { recursive: true });
  writeFileSync(join(worktree, ".prime-claw", "workflows", "handoff.md"), `---
name: handoff
---
HANDOFF POLICY
`);
  return { root, worktree };
}
function setup(id = "setup-local", hostId = "local", route) {
  return { id, projectId: "project", hostId, path: "/project", displayName: "prime-claw", environmentLabel: hostId, ...(route ? { routingEnvironmentId: route } : {}) };
}
function harness(options = {}) {
  const disk = diskFixture(); const calls = []; let record = options.record ?? null;
  const wt = { id: `repo::${disk.worktree}`, identity: "wt2:local:one", path: disk.worktree, branch: "JLanders/generated", head: "base", projectSetupId: "setup-local" };
  const git = {
    entries: [{ path: disk.root, branch: "main" }, { path: disk.worktree, branch: wt.branch }],
    repositoryRoot: () => disk.root, head: (path) => path === disk.root ? "base" : "promoted",
    branch: (path) => path === disk.root ? "main" : wt.branch, worktrees() { return this.entries; },
    createWorktree(_repo, branch, path, base) { calls.push(["local-create", branch, path, base]); mkdirSync(path, { recursive: true }); this.entries.push({ path, branch }); mkdirSync(join(path, ".agents", "skills", "execute"), { recursive: true }); writeFileSync(join(path, ".agents", "skills", "execute", "SKILL.md"), "EXECUTE POLICY"); mkdirSync(join(path, ".prime-claw", "workflows"), { recursive: true }); writeFileSync(join(path, ".prime-claw", "workflows", "handoff.md"), "HANDOFF POLICY"); },
    assertCleanWorktree(path) { calls.push(["clean", path]); },
    pathStatus(path, taskPath) { calls.push(["path-status", path, taskPath]); return ""; },
    commitPromotion(path) { calls.push(["commit", path]); return "promoted"; },
  };
  const filesystem = { exists: (path) => options.unavailable ? !String(path).includes("-alpha-episode-") : true, hasActiveLegacyPlanFiles: () => options.legacyPlanFiles !== false, promoteBundle(path) { calls.push(["promote", path]); } };
  const ownership = { read: () => record, write(_root, value) { record = structuredClone(value); calls.push(["ownership", value.status]); } };
  const published = { activeSessionId: "route", sessionId: "episode", sessionFile: join(disk.root, "episode.jsonl") };
  let listCount = 0;
  const session = { ...published, cwd: disk.worktree, sessionName: "alpha-episode", isSessionActive: false, isStreaming: false, isCompacting: false, queuedCount: 0 };
  const publisher = {
    async list() { listCount += 1; return options.list ? options.list(listCount, session) : (listCount === 1 ? [] : [session]); },
    async getState() { return { ...session, isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false, unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [], active: null } }; },
    async createFresh(args) { calls.push(["fresh", args]); await args.onAllocated?.({ sessionId: published.sessionId, sessionFile: published.sessionFile }); return published; },
    async reopen(args) { calls.push(["reopen", args]); return published; },
    async deliverExecute(_route, prompt) { calls.push(["execute", prompt]); },
    async deliverHandoff(_route, handoff, execute) { calls.push(["handoff", handoff, execute]); },
    close() { calls.push(["close"]); },
  };
  const localSetup = setup();
  const orca = {
    async listReadySetups() { calls.push(["setups"]); if (options.unavailable) throw new OrcaUnavailableError("missing"); return options.setups ?? [localSetup]; },
    async createWorktree(args) { calls.push(["orca-create", args]); if (options.createError) throw options.createError; return wt; },
    async showWorktree() { calls.push(["orca-show"]); return wt; },
    async createLaunchAutomation(args) { calls.push(["auto-create", args]); if (options.autoCreateError) throw options.autoCreateError; return "automation"; },
    async runAutomation(id) { calls.push(["auto-run", id]); if (options.runError) throw options.runError; return "run"; },
    async removeAutomation(id) { calls.push(["auto-remove", id]); if (options.removeError) throw options.removeError; },
    async listTerminals() { return options.terminals ?? [{ handle: "terminal", connected: true, writable: true, agentIdentity: "prime-agent", worktreeId: wt.id, worktreePath: wt.path, tabId: "tab", leafId: "leaf", visible: true }]; },
    async readTerminalScreen() { return options.screen ?? { source: "screen", text: "← manage model" }; },
  };
  const ctx = {
    cwd: disk.root, hasUI: options.hasUI ?? true,
    ui: { async select(_title, labels) { calls.push(["picker", labels]); return options.pick?.(labels); } },
    sessionManager: { getSessionId: () => "owner", getSessionFile: () => join(disk.root, "owner.jsonl"), getHeader: () => ({ rlmDepth: 0 }) },
    model: { provider: "provider", id: "model" },
  };
  return { ...disk, wt, calls, git, filesystem, ownership, publisher, orca, ctx, deps: { git, filesystem, ownership, publisher, orca, wait: async () => {}, bindingAttempts: 1 }, get record() { return record; } };
}
function createApproved(f, options = {}) {
  const approvedBundleDigest = bundleContentDigest(join(f.root, ".ralph", "plans", "future", "alpha"));
  return createSpecEpisode(LOCATION, "tool", f.ctx, f.deps, { ...options, approvedBundleDigest });
}

const TASK_BASE = "a".repeat(40);
function taskReservation(overrides = {}) {
  return parseEpisodeOwnership({
    version: 2,
    status: "provisioning",
    operationId: "task-operation-1234",
    engine: "local",
    ownerSessionId: "owner",
    taskId: "PRIMECLAW-10.38",
    taskPath: "backlog/tasks/primeclaw-10.38.md",
    baseRef: TASK_BASE,
    createdAt: "2026-10-13T08:00:00.000Z",
    updatedAt: "2026-10-13T08:00:00.000Z",
    ...overrides,
  });
}
function bindTaskOrcaHead(f) {
  f.orca.createWorktree = async (args) => {
    f.calls.push(["orca-create", args]);
    return { ...f.wt, head: TASK_BASE, projectSetupId: args.setup.id };
  };
}

function activeTaskRecord(f, overrides = {}) {
  const value = {
    ...taskReservation(),
    status: "active",
    worktreeName: "prime-claw-primeclaw-10-38-episode-task-oper",
    worktree: f.worktree,
    branch: f.wt.branch,
    head: TASK_BASE,
    episodeId: "episode",
    episodeSessionFile: join(f.root, "episode.jsonl"),
    episodeActiveSessionId: "route",
    ...overrides,
  };
  if (value.engine === "orca" && !value.terminalHandle) value.terminalHandle = "terminal";
  return parseEpisodeOwnership(value);
}
function taskSelection(f, overrides = {}) {
  const projectRoot = overrides.projectRoot ?? f.root;
  return {
    taskId: "PRIMECLAW-10.38",
    title: "Task-native lifecycle",
    status: "In Progress",
    implementationPlan: "Implement one bounded lifecycle slice.",
    projectRoot,
    taskPath: join(projectRoot, "backlog", "tasks", "primeclaw-10.38.md"),
    taskPathRelative: "backlog/tasks/primeclaw-10.38.md",
    ...overrides,
  };
}
function boundTaskResolver(f, overrides = {}) {
  return (cwd) => taskSelection(f, { projectRoot: cwd, ...overrides });
}
function commitMainTask(f, status) {
  const relative = "backlog/tasks/primeclaw-10.38.md";
  const taskPath = join(f.root, relative);
  mkdirSync(join(f.root, "backlog", "tasks"), { recursive: true });
  writeFileSync(taskPath, `---\nid: PRIMECLAW-10.38\nstatus: ${status}\n---\n`);
  execFileSync("git", ["-C", f.root, "add", "--", relative]);
  execFileSync("git", ["-C", f.root, "-c", "user.name=Prime Claw Test", "-c", "user.email=test@example.invalid", "commit", "-q", "-m", `commit ${status}`]);
  return { relative, taskPath };
}


function activeLegacyTransitionRecord(f, overrides = {}) {
  return parseEpisodeOwnership({
    version: 1, status: "active", operationId: "legacy-transition", engine: "orca", ownerSessionId: "owner",
    sourceLocation: LOCATION, slug: "alpha", baseRef: "a".repeat(40), bundleDigest: "c".repeat(64),
    createdAt: "2026-10-13T08:00:00.000Z", updatedAt: "2026-10-14T08:00:00.000Z",
    projectSetupId: f.wt.projectSetupId, worktreeId: f.wt.id, worktreeIdentity: f.wt.identity,
    worktree: f.worktree, branch: f.wt.branch, head: "d".repeat(40),
    episodeId: "episode", episodeSessionFile: join(f.root, "episode.jsonl"), episodeActiveSessionId: "route",
    terminalHandle: "terminal",
    ...overrides,
  });
}

function transitionSession(f, overrides = {}) {
  return {
    activeSessionId: "route", sessionId: "episode", sessionFile: join(f.root, "episode.jsonl"),
    cwd: f.worktree, isSessionActive: false, isStreaming: false, isCompacting: false, queuedCount: 0,
    ...overrides,
  };
}

test("ownership bridge preflight proves exact idle session and Orca resources before one transition call", async () => {
  const f = harness();
  const episodeHead = "e".repeat(40), mainHead = "f".repeat(40);
  f.wt.head = episodeHead;
  const legacy = activeLegacyTransitionRecord(f);
  f.ownership.write(f.root, legacy);
  const session = transitionSession(f);
  f.publisher.list = async () => [session];
  const calls = [];
  const result = await transitionSpecEpisodeToTaskOwnership(LOCATION, "PRIMECLAW-10.38", episodeHead, mainHead, true, f.ctx, {
    ...f.deps,
    transitionOwnership(input, dependencies) {
      calls.push({ input, dependencies });
      const { version: _version, sourceLocation: _source, slug: _slug, bundleDigest: _digest, ...preserved } = legacy;
      return {
        record: parseEpisodeOwnership({
          ...preserved, version: 2, taskId: "PRIMECLAW-10.38", taskPath: "backlog/tasks/primeclaw-10.38.md",
        }),
        reused: false, mainHead, episodeHead,
        activeSpecification: { path: ".ralph/plans/SPECIFICATION.md", blob: "1".repeat(40) },
        activeImplementationPlan: { path: ".ralph/plans/EXECUTION_PLAN.md", blob: "2".repeat(40) },
      };
    },
  });
  assert.equal(result.record.version, 2);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].input, {
    projectRoot: f.root, sourceLocation: LOCATION, taskId: "PRIMECLAW-10.38", ownerSessionId: "owner",
    expectedMainHead: mainHead, expectedEpisodeHead: episodeHead,
    expectedPreviousEpisodeActiveSessionId: "route", verifiedCurrentEpisodeActiveSessionId: "route", confirmedReady: true,
  });
  assert.equal(calls[0].dependencies.ownership, f.ownership);
  assert.equal(f.calls.some((entry) => entry[0] === "orca-show"), true);
  assert.equal(f.calls.at(-1)[0], "close");
});

test("ownership bridge preflight atomically forwards the sole idle replacement route and rejects route ambiguity", async () => {
  const f = harness();
  const episodeHead = "e".repeat(40), mainHead = "f".repeat(40), currentRoute = "current-route";
  f.wt.head = episodeHead;
  const legacy = activeLegacyTransitionRecord(f, { episodeActiveSessionId: "old-route" });
  f.ownership.write(f.root, legacy);
  f.publisher.list = async () => [transitionSession(f, { activeSessionId: currentRoute })];
  let inspectedRoute;
  f.publisher.getState = async (route) => {
    inspectedRoute = route;
    return {
      ...transitionSession(f, { activeSessionId: currentRoute }), isBashRunning: false, isRunningTools: false,
      hasRunningRlmChildren: false, unfinishedActionCount: 0,
      sessionActions: { queuedCount: 0, steering: [], followUps: [], active: null },
    };
  };
  let transitionInput;
  const result = await transitionSpecEpisodeToTaskOwnership(LOCATION, "PRIMECLAW-10.38", episodeHead, mainHead, true, f.ctx, {
    ...f.deps,
    transitionOwnership(input) {
      transitionInput = input;
      const { version: _version, sourceLocation: _source, slug: _slug, bundleDigest: _digest, ...preserved } = legacy;
      return {
        record: parseEpisodeOwnership({
          ...preserved, version: 2, taskId: "PRIMECLAW-10.38", taskPath: "backlog/tasks/primeclaw-10.38.md",
          episodeActiveSessionId: input.verifiedCurrentEpisodeActiveSessionId,
        }),
        reused: false, mainHead, episodeHead,
        activeSpecification: { path: ".ralph/plans/SPECIFICATION.md", blob: "1".repeat(40) },
        activeImplementationPlan: { path: ".ralph/plans/EXECUTION_PLAN.md", blob: "2".repeat(40) },
      };
    },
  });
  assert.equal(inspectedRoute, currentRoute);
  assert.equal(transitionInput.expectedPreviousEpisodeActiveSessionId, "old-route");
  assert.equal(transitionInput.verifiedCurrentEpisodeActiveSessionId, currentRoute);
  assert.equal(result.record.episodeActiveSessionId, currentRoute);
  assert.equal(result.record.episodeId, legacy.episodeId);
  assert.equal(result.record.episodeSessionFile, legacy.episodeSessionFile);
  assert.equal(result.record.worktree, legacy.worktree);
  assert.equal(result.record.branch, legacy.branch);
  assert.equal(result.record.ownerSessionId, legacy.ownerSessionId);

  const oldLive = harness(); oldLive.wt.head = episodeHead;
  oldLive.ownership.write(oldLive.root, activeLegacyTransitionRecord(oldLive, { episodeActiveSessionId: "old-route" }));
  oldLive.publisher.list = async () => [
    transitionSession(oldLive, { activeSessionId: currentRoute }),
    { id: "old-route", sessionId: "other-session", sessionFile: join(oldLive.root, "other.jsonl"), cwd: oldLive.worktree },
  ];
  await assert.rejects(transitionSpecEpisodeToTaskOwnership(LOCATION, "PRIMECLAW-10.38", episodeHead, mainHead, true, oldLive.ctx, oldLive.deps), /previous runtime route is still live/);

  const ambiguous = harness(); ambiguous.wt.head = episodeHead;
  ambiguous.ownership.write(ambiguous.root, activeLegacyTransitionRecord(ambiguous, { episodeActiveSessionId: "old-route" }));
  ambiguous.publisher.list = async () => [
    transitionSession(ambiguous, { activeSessionId: currentRoute }),
    transitionSession(ambiguous, { activeSessionId: "second-current-route" }),
  ];
  await assert.rejects(transitionSpecEpisodeToTaskOwnership(LOCATION, "PRIMECLAW-10.38", episodeHead, mainHead, true, ambiguous.ctx, ambiguous.deps), /one unambiguous durable Episode session/);
});

test("ownership bridge preflight rejects busy, foreign-terminal, and non-owner runtime state before transition", async () => {
  const busy = harness(); busy.wt.head = "e".repeat(40); busy.ownership.write(busy.root, activeLegacyTransitionRecord(busy));
  busy.publisher.list = async () => [transitionSession(busy, { isSessionActive: true })];
  let transitions = 0;
  await assert.rejects(transitionSpecEpisodeToTaskOwnership(LOCATION, "PRIMECLAW-10.38", busy.wt.head, "f".repeat(40), true, busy.ctx, {
    ...busy.deps, transitionOwnership() { transitions += 1; throw new Error("must not run"); },
  }), /Episode to be idle/);
  assert.equal(transitions, 0);

  const terminal = harness({ terminals: [{ handle: "foreign", connected: true, writable: true, visible: true, worktreeId: "foreign" }] });
  terminal.wt.head = "e".repeat(40); terminal.ownership.write(terminal.root, activeLegacyTransitionRecord(terminal));
  terminal.publisher.list = async () => [transitionSession(terminal)];
  await assert.rejects(transitionSpecEpisodeToTaskOwnership(LOCATION, "PRIMECLAW-10.38", terminal.wt.head, "f".repeat(40), true, terminal.ctx, {
    ...terminal.deps, transitionOwnership() { transitions += 1; throw new Error("must not run"); },
  }), /terminal evidence/);
  assert.equal(transitions, 0);

  const foreign = harness(); foreign.wt.head = "e".repeat(40);
  foreign.ownership.write(foreign.root, activeLegacyTransitionRecord(foreign, { ownerSessionId: "another-owner" }));
  foreign.publisher.list = async () => [transitionSession(foreign)];
  await assert.rejects(transitionSpecEpisodeToTaskOwnership(LOCATION, "PRIMECLAW-10.38", foreign.wt.head, "f".repeat(40), true, foreign.ctx, {
    ...foreign.deps, transitionOwnership() { transitions += 1; throw new Error("must not run"); },
  }), /exact owner Conversation/);
  assert.equal(transitions, 0);
});

test("Orca creation promotes before exactly one native execute assignment and removes launcher", async () => {
  const f = harness(); const result = await createApproved(f);
  assert.equal(result.engine, "orca"); assert.equal(result.status, "active"); assert.equal(result.reused, false);
  const names = f.calls.map((call) => call[0]);
  assert.ok(names.indexOf("promote") < names.indexOf("auto-create"));
  assert.ok(names.indexOf("commit") < names.indexOf("auto-create"));
  assert.deepEqual(names.filter((name) => name === "auto-run"), ["auto-run"]);
  assert.equal(names.includes("fresh"), false); assert.equal(names.includes("execute"), false); assert.equal(names.includes("handoff"), false);
  const automation = f.calls.find((call) => call[0] === "auto-create")[1];
  assert.match(automation.prompt, /EXECUTE POLICY/); assert.equal(automation.worktreeId, f.wt.id);
  assert.ok(names.indexOf("auto-remove") < names.lastIndexOf("ownership"));
  assert.equal(f.record.launchAutomationId, undefined); assert.match(f.record.launchAutomationName, /^prime-claw-launch-/);
  assert.equal(f.record.terminalHandle, "terminal");
});

test("single ready setup bypasses picker", async () => {
  const f = harness(); await createApproved(f);
  assert.equal(f.calls.some((call) => call[0] === "picker"), false);
});

test("multiple setups use stable labeled picker and selected local id", async () => {
  const second = setup("setup-second");
  const f = harness({ setups: [setup(), second], pick: (labels) => labels[1] });
  f.orca.createWorktree = async (args) => { f.calls.push(["orca-create", args]); return { ...f.wt, projectSetupId: second.id }; };
  const result = await createApproved(f);
  assert.equal(result.projectSetupId, second.id);
  assert.match(f.calls.find((call) => call[0] === "picker")[1][1], /id:setup-second/);
});

test("stable host bypass selects exact setup without picker", async () => {
  const second = setup("123e4567-e89b-12d3-a456-426614174000"); const f = harness({ setups: [setup(), second] });
  f.orca.createWorktree = async (args) => ({ ...f.wt, projectSetupId: args.setup.id });
  const result = await createApproved(f, { host: "id:123e4567-e89b-12d3-a456-426614174000" });
  assert.equal(result.projectSetupId, "123e4567-e89b-12d3-a456-426614174000"); assert.equal(f.calls.some((call) => call[0] === "picker"), false);
});

for (const [name, options, pattern] of [
  ["picker cancellation", { setups: [setup(), setup("two")], pick: () => undefined }, /cancelled/],
  ["noninteractive ambiguity", { setups: [setup(), setup("two")], hasUI: false }, /noninteractive/],
  ["zero ready setups", { setups: [] }, /No ready/],
]) test(`${name} creates nothing`, async () => {
  const f = harness(options); await assert.rejects(createApproved(f), pattern);
  assert.equal(f.calls.some((call) => call[0] === "orca-create" || call[0] === "local-create"), false);
  assert.equal(f.record, null);
});

test("remote selection is rejected before mutation and never falls back", async () => {
  const remote = setup("remote", "runtime:env", "env"); const f = harness({ setups: [remote] });
  await assert.rejects(createApproved(f), /Remote Episode placement is disabled/);
  assert.equal(f.calls.some((call) => call[0] === "orca-create" || call[0] === "local-create"), false);
});

test("definitive pre-mutation Orca unavailability uses fresh local fallback once", async () => {
  const f = harness({ unavailable: true }); const result = await createApproved(f);
  assert.equal(result.engine, "local"); assert.equal(result.status, "active");
  assert.equal(f.calls.filter((call) => call[0] === "fresh").length, 1);
  assert.equal(f.calls.filter((call) => call[0] === "execute").length, 1);
  assert.equal(f.calls.some((call) => call[0] === "handoff" || call[0] === "orca-create"), false);
});

test("explicit host never falls back locally when Orca inventory is unavailable", async () => {
  const f = harness({ unavailable: true });
  await assert.rejects(
    createApproved(f, { host: "id:123e4567-e89b-12d3-a456-426614174000" }),
    /Explicit Episode host .* could not be resolved/,
  );
  assert.equal(f.record, null);
  assert.equal(f.calls.some((call) => ["local-create", "fresh", "execute", "orca-create"].includes(call[0])), false);
});

test("local worktree identity is durable before fallback mutation", async () => {
  const f = harness({ unavailable: true });
  f.git.createWorktree = () => { throw new Error("ambiguous local create"); };
  await assert.rejects(createApproved(f), /ambiguous local create/);
  assert.equal(f.record.status, "uncertain");
  assert.match(f.record.worktree, /-alpha-episode-/);
  assert.match(f.record.branch, /^episode\/alpha-/);
  assert.equal(f.record.head, "base");
});

for (const [name, option, value] of [
  ["worktree create", "createError", new OrcaMutationUncertainError("create", "lost")],
  ["automation run", "runError", new OrcaMutationUncertainError("run", "lost")],
  ["automation removal", "removeError", new OrcaMutationUncertainError("remove", "lost")],
]) test(`${name} uncertainty preserves one record and never falls back`, async () => {
  const f = harness({ [option]: value }); await assert.rejects(createApproved(f));
  assert.equal(f.record.status, "uncertain"); assert.equal(f.record.engine, "orca");
  assert.equal(f.calls.some((call) => call[0] === "local-create"), false);
  if (option === "removeError") { assert.equal(f.record.episodeId, "episode"); assert.equal(f.record.launchAutomationId, "automation"); }
});

test("active replay refreshes route without replaying assignment", async () => {
  const f0 = harness(); const active = await createApproved(f0);
  const f = harness({ record: { ...active, reused: undefined }, list: () => [{ sessionId: "episode", sessionFile: active.episodeSessionFile, cwd: active.worktree }] });
  f.git.entries = [{ path: f.root, branch: "main" }, { path: active.worktree, branch: active.branch }];
  f.filesystem.exists = () => true; f.orca.showWorktree = async () => ({ ...f.wt, id: active.worktreeId, identity: active.worktreeIdentity, path: active.worktree, branch: active.branch, projectSetupId: active.projectSetupId, head: active.head });
  const result = await createApproved(f);
  assert.equal(result.reused, true); assert.equal(f.calls.some((call) => ["auto-run", "execute", "handoff"].includes(call[0])), false);
  assert.equal(f.calls.some((call) => call[0] === "reopen"), true);
});

test("active replay persists an already-live replacement route without reopening", async () => {
  const f0 = harness(); const active = await createApproved(f0);
  const replacement = { ...active, episodeActiveSessionId: "old-route", reused: undefined };
  const f = harness({ record: replacement, list: () => [{ activeSessionId: "replacement-route", sessionId: "episode", sessionFile: active.episodeSessionFile, cwd: active.worktree }] });
  f.git.entries = [{ path: f.root, branch: "main" }, { path: active.worktree, branch: active.branch }];
  f.filesystem.exists = () => true;
  f.orca.showWorktree = async () => ({ ...f.wt, id: active.worktreeId, identity: active.worktreeIdentity, path: active.worktree, branch: active.branch, projectSetupId: active.projectSetupId, head: active.head });
  const result = await createApproved(f);
  assert.equal(result.reused, true); assert.equal(result.episodeActiveSessionId, "replacement-route");
  assert.equal(f.record.episodeActiveSessionId, "replacement-route");
  assert.equal(f.calls.some((call) => ["reopen", "execute", "handoff", "fresh"].includes(call[0])), false);
});

test("uncertain replay never replays assignment", async () => {
  const f = harness({ record: { version: 1, status: "uncertain", operationId: "op", engine: "local", ownerSessionId: "owner", sourceLocation: LOCATION, slug: "alpha", baseRef: "base", bundleDigest: "0".repeat(64), createdAt: "x", updatedAt: "x", uncertaintyReason: "lost" } });
  await assert.rejects(createApproved(f), /No assignment was replayed/);
  assert.equal(f.calls.some((call) => ["auto-run", "execute", "fresh"].includes(call[0])), false);
});

test("task-native ownership blocks retained folder admission without resource mutation", async () => {
  const f = harness({ record: {
    version: 2, status: "provisioning", operationId: "task-op", engine: "local", ownerSessionId: "owner",
    taskId: "PRIMECLAW-10.38", taskPath: "backlog/tasks/task.md", baseRef: "a".repeat(40),
    createdAt: "x", updatedAt: "x",
  } });
  await assert.rejects(createApproved(f), /task-native episode ownership conflicts/);
  assert.equal(f.calls.some((call) => ["setups", "orca-create", "local-create", "fresh", "execute"].includes(call[0])), false);
});

test("handoff uses exact active ownership and queues canonical execute only after quiescence", async () => {
  const f0 = harness(); const active = await createApproved(f0);
  const f = harness({ record: { ...active, reused: undefined }, list: () => [{ activeSessionId: "route", sessionId: "episode", sessionFile: active.episodeSessionFile, cwd: active.worktree, isSessionActive: false, isStreaming: false, isCompacting: false, queuedCount: 0 }] });
  f.git.entries = [{ path: f.root, branch: "main" }, { path: active.worktree, branch: active.branch }];
  f.orca.showWorktree = async () => ({ ...f.wt, id: active.worktreeId, identity: active.worktreeIdentity, path: active.worktree, branch: active.branch, projectSetupId: active.projectSetupId, head: active.head });
  f.publisher.getState = async () => ({ activeSessionId: "route", sessionId: "episode", sessionFile: active.episodeSessionFile, isSessionActive: false, isStreaming: false, isCompacting: false, isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false, unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [], active: null } });
  const result = await handoffSpecEpisode(LOCATION, "fix accepted defect", f.ctx, f.deps);
  assert.equal(result.handoffDelivery, "prompt"); assert.equal(result.executeDelivery, "followUp");
  const call = f.calls.find((value) => value[0] === "handoff"); assert.match(call[1], /fix accepted defect/); assert.match(call[2], /EXECUTE POLICY/);
});

test("retained handoff uses exact ownership when the obsolete promoted source folder is absent", async () => {
  const created = harness(); const active = await createApproved(created);
  const f = harness({
    record: { ...active, reused: undefined },
    list: () => [{ activeSessionId: "route", sessionId: "episode", sessionFile: active.episodeSessionFile, cwd: active.worktree, isSessionActive: false, isStreaming: false, isCompacting: false, queuedCount: 0 }],
  });
  f.git.entries = [{ path: f.root, branch: "main" }, { path: active.worktree, branch: active.branch }];
  f.orca.showWorktree = async () => ({ ...f.wt, id: active.worktreeId, identity: active.worktreeIdentity, path: active.worktree, branch: active.branch, projectSetupId: active.projectSetupId, head: active.head });
  f.publisher.getState = async () => ({ activeSessionId: "route", sessionId: "episode", sessionFile: active.episodeSessionFile, isSessionActive: false, isStreaming: false, isCompacting: false, isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false, unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [], active: null } });
  useDiskLegacyGate(f);
  mkdirSync(join(active.worktree, ".ralph", "plans"), { recursive: true });
  writeFileSync(join(active.worktree, ".ralph", "plans", "SPECIFICATION.md"), "active spec\n");
  writeFileSync(join(active.worktree, ".ralph", "plans", "EXECUTION_PLAN.md"), "active plan\n");
  rmSync(join(f.root, ".ralph", "plans", "future", "alpha"), { recursive: true, force: true });
  assert.equal(existsSync(join(f.root, ".ralph", "plans", "future", "alpha")), false);
  assert.equal(existsSync(join(active.worktree, ".ralph", "plans", "SPECIFICATION.md")), true);
  assert.equal(existsSync(join(active.worktree, ".ralph", "plans", "EXECUTION_PLAN.md")), true);

  const result = await handoffSpecEpisode(LOCATION, "continue exact retained Episode", f.ctx, f.deps);
  assert.equal(result.sourceLocation, LOCATION);
  assert.equal(result.episodeId, active.episodeId);
  assert.equal(f.calls.filter((call) => call[0] === "handoff").length, 1);

  await assert.rejects(handoffSpecEpisode(".ralph/plans/future/../alpha", "invalid", f.ctx, f.deps), /Invalid future-plan source location/);
  await assert.rejects(handoffSpecEpisode(".ralph/plans/future/beta", "mismatch", f.ctx, f.deps), /conflicts on sourceLocation/);

  const missing = harness({ record: null });
  rmSync(join(missing.root, ".ralph", "plans", "future", "alpha"), { recursive: true, force: true });
  await assert.rejects(handoffSpecEpisode(LOCATION, "missing ownership", missing.ctx, missing.deps), /No durable episode ownership exists/);
});

test("legacy active replay and handoff require the promoted active plan pair", async () => {
  const createdHarness=harness(); const active=await createApproved(createdHarness);
  const replay=harness({ record:{...active,reused:undefined}, legacyPlanFiles:false, list:()=>[{sessionId:"episode",sessionFile:active.episodeSessionFile,cwd:active.worktree}] });
  replay.git.entries=[{path:replay.root,branch:"main"},{path:active.worktree,branch:active.branch}]; replay.filesystem.exists=()=>true;
  replay.orca.showWorktree=async()=>({...replay.wt,id:active.worktreeId,identity:active.worktreeIdentity,path:active.worktree,branch:active.branch,projectSetupId:active.projectSetupId,head:active.head});
  await assert.rejects(createApproved(replay),/ownership is not live.*active specification and implementation plan/);
  assert.equal(replay.calls.some(call=>["reopen","execute","handoff"].includes(call[0])),false);

  const handoff=harness({ record:{...active,reused:undefined}, legacyPlanFiles:false, list:(_count,session)=>[session] });
  handoff.git.entries=[{path:handoff.root,branch:"main"},{path:active.worktree,branch:active.branch}];
  handoff.orca.showWorktree=async()=>({...handoff.wt,id:active.worktreeId,identity:active.worktreeIdentity,path:active.worktree,branch:active.branch,projectSetupId:active.projectSetupId,head:active.head});
  await assert.rejects(handoffSpecEpisode(LOCATION,"resume",handoff.ctx,handoff.deps),/ownership is not live.*active specification and implementation plan/);
  assert.equal(handoff.calls.some(call=>["reopen","handoff"].includes(call[0])),false);
});

function useDiskLegacyGate(f) {
  f.filesystem.hasActiveLegacyPlanFiles = (worktree) => existsSync(join(worktree,".ralph/plans/SPECIFICATION.md"))
    && (existsSync(join(worktree,".ralph/plans/IMPLEMENTATION_PLAN.md")) || existsSync(join(worktree,".ralph/plans/EXECUTION_PLAN.md")));
}
function writeBlockedLegacyPair(f, planName = "EXECUTION_PLAN.md") {
  const blocked=join(f.worktree,".ralph/plans/blocked");mkdirSync(blocked,{recursive:true});
  writeFileSync(join(blocked,"SPECIFICATION.md"),"blocked spec\n");
  writeFileSync(join(blocked,planName),"recorded blocker and unblock condition\n");
}
function writeActiveLegacyPair(f) {
  const plans=join(f.worktree,".ralph/plans");mkdirSync(plans,{recursive:true});
  writeFileSync(join(plans,"SPECIFICATION.md"),"active spec\n");
  writeFileSync(join(plans,"EXECUTION_PLAN.md"),"active plan\n");
}

test("operator-cleared blocked pair restores and continues the same version-one Episode", async () => {
  const f=harness();await createApproved(f);f.calls.length=0;useDiskLegacyGate(f);writeBlockedLegacyPair(f);
  const identity=structuredClone(f.record);
  const restored=await restoreBlockedSpecEpisode(LOCATION,true,f.ctx,f.deps);
  assert.equal(restored.restored,true);assert.equal(restored.episodeId,identity.episodeId);assert.equal(restored.worktree,identity.worktree);
  assert.equal(existsSync(join(f.worktree,".ralph/plans/SPECIFICATION.md")),true);
  assert.equal(existsSync(join(f.worktree,".ralph/plans/EXECUTION_PLAN.md")),true);
  assert.deepEqual(f.record,identity);

  const continued=await handoffSpecEpisode(LOCATION,"operator accepted the recorded unblock",f.ctx,f.deps);
  assert.equal(continued.episodeId,identity.episodeId);assert.equal(continued.episodeActiveSessionId,identity.episodeActiveSessionId);
  assert.deepEqual(f.record,identity);
  assert.equal(f.calls.filter(call=>call[0]==="handoff").length,1);
  assert.equal(f.calls.some(call=>["fresh","reopen","execute","promote","local-create","orca-create","ownership"].includes(call[0])),false);
});

test("completed version-one candidate remains live through review and bounded revision handoff", async () => {
  const f=harness();await createApproved(f);f.calls.length=0;useDiskLegacyGate(f);writeActiveLegacyPair(f);
  const identity=structuredClone(f.record), plan=join(f.worktree,".ralph/plans/EXECUTION_PLAN.md");
  appendFileSync(plan,"candidate completed; active for review\n");
  const accepted=await handoffSpecEpisode(LOCATION,"accepted candidate advance",f.ctx,f.deps);
  appendFileSync(plan,"accepted bounded review revision\n");
  const revised=await handoffSpecEpisode(LOCATION,"implement accepted revision",f.ctx,f.deps);
  assert.equal(accepted.episodeId,identity.episodeId);assert.equal(revised.episodeId,identity.episodeId);
  assert.equal(accepted.episodeActiveSessionId,identity.episodeActiveSessionId);assert.equal(revised.episodeActiveSessionId,identity.episodeActiveSessionId);
  assert.deepEqual(f.record,identity);
  assert.equal(f.calls.filter(call=>call[0]==="handoff").length,2);
  assert.equal(f.calls.some(call=>["fresh","execute","promote","local-create","orca-create","ownership"].includes(call[0])),false);
});

test("blocked-pair restore rejects missing authority, wrong mode, unsafe files, and collisions", async (t) => {
  await t.test("explicit operator decision is required before mutation",async()=>{
    const f=harness();await createApproved(f);useDiskLegacyGate(f);writeBlockedLegacyPair(f);
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,false,f.ctx,f.deps),/explicit unblock decision/);
    assert.equal(existsSync(join(f.worktree,".ralph/plans/blocked/SPECIFICATION.md")),true);
  });
  await t.test("missing ownership never falls through",async()=>{
    const f=harness();useDiskLegacyGate(f);writeBlockedLegacyPair(f);
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,f.ctx,f.deps),/No durable episode ownership/);
  });
  await t.test("version two ownership never enters folder recovery",async()=>{
    const f=harness();f.ownership.write(f.root,activeTaskRecord(f));useDiskLegacyGate(f);writeBlockedLegacyPair(f);
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,f.ctx,f.deps),/task-native episode ownership conflicts/);
  });
  await t.test("foreign owner and inactive ownership fail closed",async()=>{
    const foreign=harness();await createApproved(foreign);useDiskLegacyGate(foreign);writeBlockedLegacyPair(foreign);foreign.ownership.write(foreign.root,{...foreign.record,ownerSessionId:"other"});
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,foreign.ctx,foreign.deps),/ownerSessionId/);
    const inactive=harness();await createApproved(inactive);useDiskLegacyGate(inactive);writeBlockedLegacyPair(inactive);inactive.ownership.write(inactive.root,{...inactive.record,status:"inactive"});
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,inactive.ctx,inactive.deps),/requires active version-1 ownership/);
  });
  await t.test("worktree mismatch fails before moving files",async()=>{
    const f=harness();await createApproved(f);useDiskLegacyGate(f);writeBlockedLegacyPair(f);f.git.entries=[{path:f.root,branch:"main"}];
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,f.ctx,f.deps),/missing or different worktree/);
    assert.equal(existsSync(join(f.worktree,".ralph/plans/blocked/SPECIFICATION.md")),true);
  });
  await t.test("canonical-main and Orca identity drift fail before moving files",async()=>{
    const wrongBranch=harness();await createApproved(wrongBranch);useDiskLegacyGate(wrongBranch);writeBlockedLegacyPair(wrongBranch);wrongBranch.git.branch=()=>"feature";
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,wrongBranch.ctx,wrongBranch.deps),/canonical primary main checkout/);
    const wrongOrca=harness();await createApproved(wrongOrca);useDiskLegacyGate(wrongOrca);writeBlockedLegacyPair(wrongOrca);wrongOrca.orca.showWorktree=async()=>({...wrongOrca.wt,identity:"foreign"});
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,wrongOrca.ctx,wrongOrca.deps),/Orca worktree identity/);
    assert.equal(existsSync(join(wrongOrca.worktree,".ralph/plans/blocked/SPECIFICATION.md")),true);
  });
  await t.test("incomplete or empty blocked pair is rejected",async()=>{
    const incomplete=harness();await createApproved(incomplete);useDiskLegacyGate(incomplete);const blocked=join(incomplete.worktree,".ralph/plans/blocked");mkdirSync(blocked,{recursive:true});writeFileSync(join(blocked,"SPECIFICATION.md"),"blocked spec\n");
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,incomplete.ctx,incomplete.deps),/exactly one implementation plan/);
    const empty=harness();await createApproved(empty);useDiskLegacyGate(empty);writeBlockedLegacyPair(empty);writeFileSync(join(empty.worktree,".ralph/plans/blocked/EXECUTION_PLAN.md"),"");
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,empty.ctx,empty.deps),/readable non-empty regular specification/);
  });
  await t.test("ambiguous plan spelling is rejected",async()=>{
    const f=harness();await createApproved(f);useDiskLegacyGate(f);writeBlockedLegacyPair(f);writeFileSync(join(f.worktree,".ralph/plans/blocked/IMPLEMENTATION_PLAN.md"),"second plan\n");
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,f.ctx,f.deps),/exactly one implementation plan/);
  });
  await t.test("symlinked blocked input is rejected",async()=>{
    const f=harness();await createApproved(f);useDiskLegacyGate(f);writeBlockedLegacyPair(f);unlinkSync(join(f.worktree,".ralph/plans/blocked/SPECIFICATION.md"));symlinkSync(join(f.root,".ralph/plans/future/alpha/SPECIFICATION.md"),join(f.worktree,".ralph/plans/blocked/SPECIFICATION.md"));
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,f.ctx,f.deps),/readable non-empty regular specification/);
  });
  await t.test("symlinked lifecycle directory is rejected",async()=>{
    const f=harness();await createApproved(f);useDiskLegacyGate(f);writeBlockedLegacyPair(f);const blocked=join(f.worktree,".ralph/plans/blocked"), external=join(f.root,"external-blocked");rmSync(blocked,{recursive:true,force:true});mkdirSync(external);writeFileSync(join(external,"SPECIFICATION.md"),"blocked spec\n");writeFileSync(join(external,"EXECUTION_PLAN.md"),"blocked plan\n");symlinkSync(external,blocked,"dir");
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,f.ctx,f.deps),/real in-worktree lifecycle directories/);
    assert.equal(existsSync(join(external,"SPECIFICATION.md")),true);
  });
  await t.test("active destination collision is rejected without overwrite",async()=>{
    const f=harness();await createApproved(f);useDiskLegacyGate(f);writeBlockedLegacyPair(f);const activeSpec=join(f.worktree,".ralph/plans/SPECIFICATION.md");mkdirSync(join(f.worktree,".ralph/plans"),{recursive:true});writeFileSync(activeSpec,"partial active spec\n");
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,f.ctx,f.deps),/destination collision or partial active pair/);
    assert.equal(readFileSync(activeSpec,"utf8"),"partial active spec\n");
    assert.equal(existsSync(join(f.worktree,".ralph/plans/blocked/SPECIFICATION.md")),true);
    assert.equal(existsSync(join(f.worktree,".ralph/plans/blocked/EXECUTION_PLAN.md")),true);
  });
});

test("task-native handoff continues the exact idle Episode with task-bound handoff and execute", async () => {
  const f = harness({ list: (_count, session) => [session] });
  f.ownership.write(f.root, activeTaskRecord(f));
  const result = await handoffTaskEpisode(
    "PRIMECLAW-10.38",
    "resume the accepted in-scope revision",
    f.ctx,
    { ...f.deps, taskResolver: boundTaskResolver(f) },
  );
  assert.equal(result.taskId, "PRIMECLAW-10.38");
  assert.equal(result.episodeId, "episode");
  assert.equal(result.episodeActiveSessionId, "route");
  const call = f.calls.find((value) => value[0] === "handoff");
  assert.match(call[1], /resume the accepted in-scope revision/);
  assert.match(call[1], /<operator-episode-task>\s*PRIMECLAW-10\.38\s*<\/operator-episode-task>/);
  assert.match(call[2], /<operator-episode-task>\s*PRIMECLAW-10\.38\s*<\/operator-episode-task>/);
  assert.match(call[2], /EXECUTE POLICY/);
  assert.doesNotMatch(call[2], /resume the accepted in-scope revision/);
  assert.equal(f.calls.some((value) => ["fresh", "execute", "promote", "local-create", "orca-create"].includes(value[0])), false);
});

function taskLifecycleHarness(options = {}) {
  const f = harness({ list: (_count, session) => [session] });
  f.ownership.write(f.root, activeTaskRecord(f, options.orcaEngine ? {
    engine: "orca",
    worktreeId: f.wt.id,
    worktreeIdentity: f.wt.identity,
    projectSetupId: f.wt.projectSetupId,
  } : {}));
  f.calls.length = 0;
  let mainStatus = options.mainStatus ?? "In Progress";
  let episodeStatus = options.episodeStatus ?? "In Progress";
  let mainHead = "1".repeat(40);
  let mainUpstream = mainHead;
  let pushCount = 0;
  let fastForwardFailed = false;
  let doneSnapshotFailed = false;
  let doneEditFailed = false;
  let doneMutationInterrupted = false;
  let doneCommitInterrupted = false;
  let mainChanges = [];
  let mainCommitCount = 0;
  let publicationAncestor = options.publicationAncestor ?? true;
  let episodeHead = options.episodeHead ?? "b".repeat(40);
  let episodeUpstream = options.upstreamHead ?? episodeHead;
  const acceptedEpisodeHead = episodeHead;
  const mergeParents = new Map();
  const runner = {
    run(command, args, runOptions = {}) {
      if (command === "backlog") {
        const statusIndex = args.indexOf("--status");
        assert.notEqual(statusIndex, -1);
        const nextStatus = args[statusIndex + 1];
        if (runOptions.cwd !== f.worktree && nextStatus === "Done"
          && options.doneEditFailsOnce && !doneEditFailed) {
          doneEditFailed = true;
          throw new Error("Done edit interrupted");
        }
        if (runOptions.cwd === f.worktree) episodeStatus = nextStatus;
        else {
          mainStatus = nextStatus;
          mainChanges = [{ status: " M", path: "backlog/tasks/primeclaw-10.38.md" }];
          if (nextStatus === "Done" && options.interruptAfterDoneMutationOnce && !doneMutationInterrupted) {
            doneMutationInterrupted = true;
            throw new Error("interrupted after Done mutation");
          }
        }
        f.calls.push(["backlog-status", nextStatus, runOptions.cwd]);
        return { stdout: "", stderr: "", status: 0 };
      }
      try {
        const stdout = execFileSync(command, args, { cwd: runOptions.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        return { stdout, stderr: "", status: 0 };
      } catch (error) {
        if (!runOptions.allowFailure) throw error;
        return { stdout: error.stdout?.toString() ?? "", stderr: error.stderr?.toString() ?? "", status: error.status ?? 1 };
      }
    },
  };
  f.git.assertCleanWorktree = (cwd) => {
    f.calls.push(["clean", cwd]);
    if (cwd === f.root && (options.mainDirty || mainChanges.length > 0)) throw new Error("canonical main is dirty");
  };
  const lifecycleGit = {
    repositoryRoot: () => f.root,
    branch: () => options.branch ?? "main",
    head: (cwd) => cwd === f.worktree ? episodeHead : mainHead,
    commitPaths: () => options.commitPaths ?? ["backlog/tasks/primeclaw-10.38.md"],
    pathStatus: (cwd) => cwd === f.root
      ? (options.mainPathStatus ?? (mainChanges.length > 0 ? `${mainChanges[0].status} ${mainChanges[0].path}` : ""))
      : (options.episodePathStatus ?? ""),
    commitOnlyPath(_repo, path, message) {
      f.calls.push(["status-commit", path, message]);
      if (options.interruptAfterDoneStageOnce && mainStatus === "Done" && !doneCommitInterrupted) {
        doneCommitInterrupted = true;
        mainChanges = [{ status: "M ", path }];
        throw new Error("interrupted after Done staging");
      }
      const previousMainHead = mainHead;
      mainHead = mainHead === "1".repeat(40) ? "2".repeat(40) : "3".repeat(40);
      mergeParents.set(mainHead, [previousMainHead]);
      mainChanges = [];
      mainCommitCount += 1;
      return mainHead;
    },
    push(cwd) {
      pushCount += 1;
      f.calls.push(["status-push", pushCount, cwd]);
      if (options.firstPushFails && pushCount === 1) throw new Error("offline");
      if ((options.episodePushFails || options.failEpisodePushNumber === pushCount
        || (options.failEpisodePushFrom && pushCount >= options.failEpisodePushFrom)) && cwd === f.worktree) {
        throw new Error("episode push offline");
      }
      if (cwd === f.worktree) episodeUpstream = episodeHead;
      else {
        if (options.finalPushFails && mainStatus === "Done") throw new Error("main push offline");
        mainUpstream = options.upstreamMismatchAfterDone && mainStatus === "Done"
          ? "8".repeat(40) : mainHead;
      }
    },
    upstreamHead: (cwd) => {
      if (cwd !== f.worktree && options.upstreamLookupFailsAfterDone && mainStatus === "Done") {
        throw new Error("upstream unavailable");
      }
      return cwd === f.worktree ? episodeUpstream : mainUpstream;
    },
    pathChangedBetween: () => options.pathChanged ?? true,
    isAncestor: (_repo, ancestor, descendant) => {
      if (!publicationAncestor
        && ancestor === "2".repeat(40) && descendant === "2".repeat(40)) return false;
      return options.isAncestor ?? true;
    },
    mergeMain(worktree, mergedMain, taskPath) { f.calls.push(["merge-main", worktree, mergedMain, taskPath]); if (options.mergeError) throw options.mergeError; },
    restoreTaskFromHead(worktree, taskPath) { f.calls.push(["restore-task", worktree, taskPath]); },
    stagePath(worktree, taskPath) { f.calls.push(["stage-task", worktree, taskPath]); },
    commitMerge(worktree, message) {
      f.calls.push(["merge-commit", worktree, message]);
      const previousEpisodeHead = episodeHead;
      const refreshed = episodeHead === acceptedEpisodeHead ? "c".repeat(40) : "d".repeat(40);
      mergeParents.set(refreshed, [previousEpisodeHead, mainHead]);
      episodeHead = refreshed;
      return refreshed;
    },
    abortMerge(worktree) { f.calls.push(["merge-abort", worktree]); },
    parents(_cwd, ref) { return options.parents ?? mergeParents.get(ref) ?? []; },
    fastForward(repo, candidateHead) {
      f.calls.push(["fast-forward", repo, candidateHead]);
      if (options.fastForwardError) throw options.fastForwardError;
      mainHead = candidateHead;
      if (options.failFastForwardAfterMutationOnce && !fastForwardFailed) {
        fastForwardFailed = true;
        throw new Error("interrupted after fast-forward");
      }
    },
    worktreeChanges(cwd) {
      if (cwd === f.root && options.mainDirty) return [{ status: "??", path: "unrelated.txt" }];
      return cwd === f.root ? structuredClone(mainChanges) : [];
    },
  };
  const taskResolver = (cwd) => taskSelection(f, { projectRoot: cwd, status: cwd === f.root ? mainStatus : episodeStatus });
  const taskSnapshotResolver = (cwd) => {
    if (cwd === f.root && mainStatus === "Done" && options.failDoneSnapshotOnce && !doneSnapshotFailed) {
      doneSnapshotFailed = true;
      throw new Error("interrupted after Done commit");
    }
    return {
      taskId: "PRIMECLAW-10.38",
      taskPath: "backlog/tasks/primeclaw-10.38.md",
      parentTaskId: options.parentTaskId ?? "PRIMECLAW-10",
      status: cwd === f.root ? mainStatus : episodeStatus,
      implementationPlan: "Implement one bounded lifecycle slice.",
      contentDigest: options.contentDigest ?? "d".repeat(64),
    };
  };
  return {
    f, get episodeHead() { return episodeHead; }, acceptedEpisodeHead, lifecycleGit, runner, taskResolver, taskSnapshotResolver,
    deps: { ...f.deps, lifecycleGit, reviewGit: lifecycleGit, mergeGit: lifecycleGit, lifecycleRunner: runner, taskResolver, taskSnapshotResolver },
    get mainStatus() { return mainStatus; }, get episodeStatus() { return episodeStatus; }, get mainHead() { return mainHead; },
    get mainCommitCount() { return mainCommitCount; },
    advanceMain() { mainHead = "4".repeat(40); },
    divergeMainUpstream() { mainUpstream = "9".repeat(40); },
    setEpisodeUpstream(value) { episodeUpstream = value; },
    setParents(ref, parents) { mergeParents.set(ref, parents); },
    addMainChange(change) { mainChanges.push(change); },
    setMainStatus(value) { mainStatus = value; },
    setPublicationAncestor(value) { publicationAncestor = value; },
  };
}

function taskAbandonmentHarness(options = {}) {
  const f = harness({ list: (_count, session) => [session] });
  f.ownership.write(f.root, activeTaskRecord(f));
  f.calls.length = 0;
  const activePath = "backlog/tasks/primeclaw-10.38.md";
  const archivePath = "backlog/archive/tasks/primeclaw-10.38.md";
  const episodeHead = "b".repeat(40);
  const priorMainHead = "1".repeat(40);
  const archiveHead = "a".repeat(40);
  const episodeDigest = "e".repeat(64);
  let mainHead = priorMainHead;
  let mainUpstream = priorMainHead;
  let mainPath = activePath;
  let mainStatus = options.mainStatus ?? "Blocked";
  let mainDigest = "m".repeat(64);
  let finalSummary = null;
  let changes = options.mainChanges ? structuredClone(options.mainChanges) : [];
  let restoreInterrupted = false;
  let archiveInterrupted = false;
  let stageInterrupted = false;
  let verifyInterrupted = false;
  let pushCount = 0;
  const parents = new Map([[archiveHead, [priorMainHead]]]);
  const paths = new Map([[archiveHead, [activePath, archivePath]]]);

  f.git.assertCleanWorktree = (cwd) => {
    f.calls.push(["clean", cwd]);
    if (cwd === f.root && changes.length) throw new Error("canonical main is dirty");
  };
  const runner = {
    run(command, args, runOptions = {}) {
      if (command !== "backlog") {
        try {
          const stdout = execFileSync(command, args, { cwd: runOptions.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
          return { stdout, stderr: "", status: 0 };
        } catch (error) {
          if (!runOptions.allowFailure) throw error;
          return { stdout: error.stdout?.toString() ?? "", stderr: error.stderr?.toString() ?? "", status: error.status ?? 1 };
        }
      }
      if (args[1] === "edit") {
        const statusIndex = args.indexOf("--status");
        const summaryIndex = args.indexOf("--final-summary");
        mainStatus = args[statusIndex + 1];
        finalSummary = args[summaryIndex + 1];
        changes = [{ status: " M", path: activePath }];
        f.calls.push(["abandon-edit", mainStatus, finalSummary]);
        return { stdout: "", stderr: "", status: 0 };
      }
      if (args[1] === "archive") {
        mainPath = archivePath;
        changes = [
          { status: " D", path: activePath },
          { status: "??", path: archivePath },
        ];
        f.calls.push(["abandon-archive", args.at(-1)]);
        if (options.interruptAfterArchive && !archiveInterrupted) {
          archiveInterrupted = true;
          throw new Error("interrupted after archive move");
        }
        return { stdout: "Archived task", stderr: "", status: 0 };
      }
      throw new Error(`unexpected Backlog arguments ${args.join(" ")}`);
    },
  };
  const abandonmentGit = {
    repositoryRoot: () => f.root,
    branch: () => "main",
    head: (cwd) => cwd === f.worktree ? episodeHead : mainHead,
    upstreamHead: (cwd) => cwd === f.worktree ? episodeHead : mainUpstream,
    worktreeChanges: (cwd) => cwd === f.root ? structuredClone(changes) : [],
    isAncestor: () => options.related !== false,
    pathTrackedAtRef(_repo, ref, path) {
      f.calls.push(["tracked-at-ref", ref, path]);
      return options.historicalArchive === true && ref === priorMainHead && path === archivePath;
    },
    restorePathFromRef(_repo, ref, path) {
      assert.equal(ref, episodeHead); assert.equal(path, activePath);
      mainDigest = episodeDigest;
      changes = [{ status: " M", path: activePath }];
      f.calls.push(["select-task-blob", ref, path]);
      if (options.interruptAfterRestore && !restoreInterrupted) {
        restoreInterrupted = true;
        throw new Error("interrupted after task blob selection");
      }
    },
    commitOnlyPaths(_repo, commitPaths, message) {
      f.calls.push(["archive-commit", [...commitPaths], message]);
      if (options.interruptAfterStage && !stageInterrupted) {
        stageInterrupted = true;
        changes = [{ status: "R ", path: `${archivePath} -> ${activePath}` }];
        throw new Error("interrupted after archive staging");
      }
      mainHead = archiveHead;
      changes = [];
      return archiveHead;
    },
    parents: (_repo, ref) => parents.get(ref) ?? [],
    commitPaths: (_repo, ref) => paths.get(ref) ?? [],
    pathStatus: () => "",
    commitOnlyPath: () => { throw new Error("single-path commit is not allowed"); },
    push() {
      pushCount += 1;
      f.calls.push(["archive-push", pushCount]);
      if (options.pushFails) throw new Error("archive push offline");
      mainUpstream = mainHead;
    },
  };
  const taskResolver = (cwd) => taskSelection(f, {
    projectRoot: cwd,
    status: cwd === f.worktree ? (options.episodeStatus ?? "In Progress") : mainStatus,
    taskPathRelative: cwd === f.worktree ? activePath : mainPath,
    taskPath: join(cwd, cwd === f.worktree ? activePath : mainPath),
  });
  const abandonmentSnapshotResolver = (cwd) => {
    const episode = cwd === f.worktree;
    return {
      taskId: "PRIMECLAW-10.38",
      taskPath: episode ? activePath : mainPath,
      parentTaskId: options.parentTaskId ?? "PRIMECLAW-10",
      status: episode ? (options.episodeStatus ?? "In Progress") : mainStatus,
      implementationPlan: "Implement exact abandonment.",
      contentDigest: episode ? episodeDigest : mainDigest,
      abandonmentContentDigest: episode ? episodeDigest : mainDigest,
      finalSummary: episode ? null : finalSummary,
    };
  };
  const abandonmentFileSnapshotResolver = (cwd) => {
    if (cwd === f.root && mainHead === archiveHead && options.interruptAfterCommit
      && !verifyInterrupted) {
      verifyInterrupted = true;
      throw new Error("interrupted after archive commit");
    }
    return {
      status: cwd === f.worktree ? (options.episodeStatus ?? "In Progress") : mainStatus,
      finalSummary: cwd === f.worktree ? null : finalSummary,
      contentDigest: "f".repeat(64),
    };
  };
  const deps = {
    ...f.deps,
    lifecycleRunner: runner,
    taskResolver,
    abandonmentSnapshotResolver,
    abandonmentFileSnapshotResolver,
    abandonmentGit,
  };
  const decision = {
    operatorDecision: "abandon",
    taskId: "PRIMECLAW-10.38",
    taskPath: activePath,
    mainHead: priorMainHead,
    episodeHead,
    mainStatus: options.mainStatus ?? "Blocked",
    candidateMainRelationship: "main-ancestor",
    parentTaskId: options.decisionParentTaskId ?? "PRIMECLAW-10",
    episodeTaskContentDigest: options.decisionDigest ?? episodeDigest,
    finalSummary: "Operator confirmed abandonment; Episode code was not merged and resources remain retained.",
  };
  return {
    f, deps, decision, activePath, archivePath, episodeHead, priorMainHead, archiveHead,
    get mainHead() { return mainHead; }, get mainPath() { return mainPath; },
    get mainStatus() { return mainStatus; }, get changes() { return changes; },
    setChanges(value) { changes = structuredClone(value); },
    advanceMain() { mainHead = "9".repeat(40); },
  };
}

test("blocked workflow authority routes owner Conversation to task mode and never falls back from version 2", () => {
  const f = harness();
  f.ownership.write(f.root, activeTaskRecord(f));
  assert.deepEqual(
    resolveBlockedWorkflowAuthority(undefined, f.ctx, f.deps),
    {
      mode: "task",
      taskId: "PRIMECLAW-10.38",
      taskPath: "backlog/tasks/primeclaw-10.38.md",
      projectRoot: f.root,
    },
  );
  assert.equal(resolveBlockedWorkflowAuthority("PRIMECLAW-10.38", f.ctx, f.deps).mode, "task");
  assert.throws(
    () => resolveBlockedWorkflowAuthority("OTHER-1", f.ctx, f.deps),
    /does not match the exact owned Backlog task/,
  );
  const foreign = {
    ...f.ctx,
    sessionManager: { ...f.ctx.sessionManager, getSessionId: () => "foreign" },
  };
  assert.throws(
    () => resolveBlockedWorkflowAuthority(undefined, foreign, f.deps),
    /ownerSessionId/,
  );
  const episode = { ...f.ctx, cwd: f.worktree };
  assert.throws(
    () => resolveBlockedWorkflowAuthority("PRIMECLAW-10.38", episode, f.deps),
    /repository root/,
  );

  const noTaskOwnership = harness();
  assert.equal(resolveBlockedWorkflowAuthority(undefined, noTaskOwnership.ctx, noTaskOwnership.deps).mode, "folder");
  assert.throws(
    () => resolveBlockedWorkflowAuthority("PRIMECLAW-10.38", noTaskOwnership.ctx, noTaskOwnership.deps),
    /requires active version-2 Episode ownership/,
  );
  const legacyOwnership = harness({ record: { version: 1, status: "active", worktree: "/legacy" } });
  assert.equal(resolveBlockedWorkflowAuthority("not a canonical task id", legacyOwnership.ctx, legacyOwnership.deps).mode,"folder");

  const provisioning = harness({ record: taskReservation() });
  assert.throws(
    () => resolveBlockedWorkflowAuthority(undefined, provisioning.ctx, provisioning.deps),
    /requires active ownership; found provisioning/,
  );
});

test("Conversation publishes Blocked then resumes the same pushed task Episode before handoff", async () => {
  const h = taskLifecycleHarness({ firstPushFails: true });
  const blocked = publishTaskEpisodeBlocked("PRIMECLAW-10.38", h.episodeHead, h.f.ctx, h.deps);
  assert.equal(blocked.status, "Blocked");
  assert.match(blocked.pushError, /offline/);
  assert.equal(h.mainStatus, "Blocked");
  assert.deepEqual(h.f.calls.filter((call) => call[0] === "backlog-status").map((call) => call[1]), ["Blocked"]);
  assert.equal(h.f.calls.filter((call) => call[0] === "ownership").length, 0);
  assert.equal(h.f.calls.some((call) => ["fresh", "execute", "promote", "local-create", "orca-create"].includes(call[0])), false);

  const resumed = publishTaskEpisodeResumed("PRIMECLAW-10.38", h.episodeHead, h.f.ctx, h.deps);
  assert.equal(resumed.status, "In Progress");
  assert.equal(resumed.pushError, undefined);
  assert.equal(h.mainStatus, "In Progress");
  assert.deepEqual(h.f.calls.filter((call) => call[0] === "status-commit").map((call) => call[1]), [
    "backlog/tasks/primeclaw-10.38.md", "backlog/tasks/primeclaw-10.38.md",
  ]);

  const handoff = await handoffTaskEpisode(
    "PRIMECLAW-10.38", "resume after accepted unblock", h.f.ctx,
    { ...h.f.deps, taskResolver: h.taskResolver },
  );
  assert.equal(handoff.episodeId, "episode");
  assert.equal(h.f.calls.filter((call) => call[0] === "handoff").length, 1);
  assert.equal(h.f.calls.some((call) => ["fresh", "execute", "promote", "local-create", "orca-create"].includes(call[0])), false);
});

test("Ready-for-Merge handshake publishes, integrates current main in the same Episode, and verifies the pushed refreshed candidate", async () => {
  const h = taskLifecycleHarness({ firstPushFails: true });
  const publication = publishTaskEpisodeReadyForMerge(
    "PRIMECLAW-10.38", h.acceptedEpisodeHead, h.f.ctx, h.deps,
  );
  assert.equal(publication.status, "Ready for Merge");
  assert.match(publication.pushError, /offline/);
  assert.equal(h.mainStatus, "Ready for Merge");
  assert.equal(publication.episodeTaskContentDigest, "d".repeat(64));
  assert.deepEqual(h.f.calls.filter((call) => call[0] === "status-commit").map((call) => call[1]), [
    "backlog/tasks/primeclaw-10.38.md",
  ]);

  const integration = await integrateTaskEpisodeReadyForMerge(publication, h.f.ctx, h.deps);
  assert.equal(integration.acceptedEpisodeHead, h.acceptedEpisodeHead);
  assert.equal(integration.integratedMainHead, publication.commit);
  assert.equal(integration.refreshedEpisodeHead, "c".repeat(40));
  assert.equal(integration.pushError, undefined);
  assert.equal(h.episodeStatus, "Ready for Merge");
  const names = h.f.calls.map((call) => call[0]);
  assert.ok(names.indexOf("merge-main") < names.indexOf("restore-task"));
  assert.ok(names.indexOf("restore-task") < names.lastIndexOf("backlog-status"));
  assert.ok(names.lastIndexOf("backlog-status") < names.indexOf("stage-task"));
  assert.ok(names.indexOf("stage-task") < names.indexOf("merge-commit"));
  assert.equal(names.includes("handoff"), false);
  assert.equal(names.some((name) => ["fresh", "execute", "promote", "local-create", "orca-create"].includes(name)), false);

  const verified = verifyTaskEpisodeReadyForMerge(publication, integration, h.f.ctx, h.deps);
  assert.deepEqual(verified, {
    verified: true,
    taskId: "PRIMECLAW-10.38",
    mainHead: publication.commit,
    refreshedEpisodeHead: "c".repeat(40),
  });
});

async function completeReadyHandshake(h) {
  const publication = publishTaskEpisodeReadyForMerge(
    "PRIMECLAW-10.38", h.acceptedEpisodeHead, h.f.ctx, h.deps,
  );
  const integration = await integrateTaskEpisodeReadyForMerge(publication, h.f.ctx, h.deps);
  const verification = verifyTaskEpisodeReadyForMerge(publication, integration, h.f.ctx, h.deps);
  return { publication, integration, verification };
}

test("Delay preserves the exact verified Ready-for-Merge state without transport", async () => {
  const h = taskLifecycleHarness();
  const evidence = await completeReadyHandshake(h);
  const transportNames = new Set(["backlog-status", "status-commit", "status-push", "merge-main", "merge-commit", "handoff"]);
  const before = h.f.calls.filter((call) => transportNames.has(call[0])).map((call) => structuredClone(call));
  const delayed = await delayTaskEpisodeReadyForMerge(
    evidence, h.f.ctx, h.deps, { operatorDecision: "delay" },
  );
  assert.deepEqual(delayed, { ...evidence.verification, outcome: "delayed" });
  assert.equal(h.mainStatus, "Ready for Merge");
  assert.equal(h.episodeStatus, "Ready for Merge");
  assert.equal(h.episodeHead, evidence.verification.refreshedEpisodeHead);
  assert.deepEqual(
    h.f.calls.filter((call) => transportNames.has(call[0])),
    before,
  );
  assert.equal(h.f.calls.filter((call) => call[0] === "ownership").length, 0);
});

test("explicit Merge fast-forwards exact candidate, publishes only task Done, and retains Episode resources", async () => {
  const h = taskLifecycleHarness({ orcaEngine: true });
  const evidence = await completeReadyHandshake(h);
  const ownershipBefore = structuredClone(h.f.record);
  const result = await mergeTaskEpisodeReadyForMerge(
    evidence, h.f.ctx, h.deps,
    {
      operatorDecision: "merge",
      taskId: evidence.verification.taskId,
      mainHead: evidence.verification.mainHead,
      refreshedEpisodeHead: evidence.verification.refreshedEpisodeHead,
    },
  );
  assert.deepEqual(result, {
    verified: true,
    outcome: "merged",
    taskId: "PRIMECLAW-10.38",
    status: "Done",
    priorMainHead: evidence.verification.mainHead,
    mergedHead: evidence.verification.refreshedEpisodeHead,
    doneCommit: "3".repeat(40),
    parentTaskId: "PRIMECLAW-10",
    episodeTaskContentDigest: "d".repeat(64),
  });
  assert.equal(h.mainStatus, "Done");
  assert.equal(h.episodeStatus, "Ready for Merge");
  assert.equal(h.mainHead, result.doneCommit);
  assert.deepEqual(h.f.record, ownershipBefore);
  assert.equal(h.f.calls.filter((call) => call[0] === "fast-forward").length, 1);
  assert.equal(h.f.calls.filter((call) => call[0] === "status-commit").length, 2);
  assert.equal(h.f.calls.filter((call) => call[0] === "handoff").length, 0);
  assert.equal(h.f.calls.filter((call) => call[0] === "ownership").length, 0);
  assert.equal(h.f.calls.some((call) => ["fresh", "execute", "promote", "local-create", "orca-create", "auto-remove"].includes(call[0])), false);
  const sessions = await h.f.publisher.list();
  const session = sessions.find((entry) => entry.sessionId === ownershipBefore.episodeId);
  assert.equal(session.cwd, ownershipBefore.worktree);
  const orcaWorktree = await h.f.orca.showWorktree(ownershipBefore.worktreeId);
  assert.equal(orcaWorktree.identity, ownershipBefore.worktreeIdentity);
  assert.equal(orcaWorktree.path, ownershipBefore.worktree);
});

test("confirmed abandonment imports only task content, preserves status, archives without Done, and retains resources", async () => {
  const h = taskAbandonmentHarness();
  const ownershipBefore = structuredClone(h.f.record);
  const result = await abandonTaskEpisode(h.f.ctx, h.deps, h.decision);
  assert.deepEqual(result, {
    verified: true,
    outcome: "abandoned",
    taskId: "PRIMECLAW-10.38",
    status: "Blocked",
    priorMainHead: h.priorMainHead,
    episodeHead: h.episodeHead,
    archiveCommit: h.archiveHead,
    archivedTaskPath: h.archivePath,
    parentTaskId: "PRIMECLAW-10",
    episodeTaskContentDigest: "e".repeat(64),
    archivedTaskFileDigest: "f".repeat(64),
    resourcesRetained: true,
  });
  assert.equal(h.mainStatus, "Blocked");
  assert.equal(h.mainPath, h.archivePath);
  assert.deepEqual(h.f.record, ownershipBefore);
  assert.equal(h.f.calls.filter((call) => call[0] === "select-task-blob").length, 1);
  assert.equal(h.f.calls.filter((call) => call[0] === "abandon-edit").length, 1);
  assert.equal(h.f.calls.filter((call) => call[0] === "abandon-archive").length, 1);
  assert.equal(h.f.calls.filter((call) => call[0] === "archive-commit").length, 1);
  assert.ok(
    h.f.calls.findIndex((call) => call[0] === "tracked-at-ref")
      < h.f.calls.findIndex((call) => call[0] === "select-task-blob"),
  );
  assert.equal(h.f.calls.some((call) => ["fast-forward", "status-commit", "auto-remove"].includes(call[0])), false);
});

test("abandonment recovery resumes exact task-only partial states without duplicate archival mutation", async (t) => {
  for (const [name, options, error] of [
    ["selected task blob", { interruptAfterRestore: true }, /interrupted after task blob selection/],
    ["archived move", { interruptAfterArchive: true }, /interrupted after archive move/],
    ["staged archive", { interruptAfterStage: true }, /interrupted after archive staging/],
    ["committed archive", { interruptAfterCommit: true }, /interrupted after archive commit/],
  ]) {
    await t.test(name, async () => {
      const h = taskAbandonmentHarness(options);
      await assert.rejects(abandonTaskEpisode(h.f.ctx, h.deps, h.decision), error);
      const result = await abandonTaskEpisode(h.f.ctx, h.deps, h.decision);
      assert.equal(result.archiveCommit, h.archiveHead);
      assert.equal(h.f.calls.filter((call) => call[0] === "select-task-blob").length, 1);
      assert.equal(h.f.calls.filter((call) => call[0] === "abandon-archive").length, 1);
      assert.equal(
        h.f.calls.filter((call) => call[0] === "archive-commit").length,
        options.interruptAfterStage ? 2 : 1,
      );
    });
  }
});

test("abandonment fails closed on stale, dirty, cross-path, hierarchy, relationship, and Done state", async (t) => {
  await t.test("historical archive destination collision", async () => {
    const h = taskAbandonmentHarness({ historicalArchive: true });
    await assert.rejects(
      abandonTaskEpisode(h.f.ctx, h.deps, h.decision),
      /archive destination already exists in bound main history/,
    );
    assert.equal(h.mainPath, h.activePath);
    assert.deepEqual(h.changes, []);
    assert.equal(h.f.calls.filter((call) => call[0] === "tracked-at-ref").length, 1);
    assert.equal(
      h.f.calls.some((call) => ["select-task-blob", "abandon-edit", "abandon-archive", "archive-commit"].includes(call[0])),
      false,
    );
  });
  await t.test("unrelated canonical-main path", async () => {
    const h = taskAbandonmentHarness({ mainChanges: [{ status: "??", path: "src/code.ts" }] });
    await assert.rejects(abandonTaskEpisode(h.f.ctx, h.deps, h.decision), /outside the exact Episode task blob/);
  });
  await t.test("stale main", async () => {
    const h = taskAbandonmentHarness(); h.advanceMain();
    await assert.rejects(abandonTaskEpisode(h.f.ctx, h.deps, h.decision), /neither the bound pre-abandonment head nor its exact archival child/);
  });
  await t.test("wrong bound path", async () => {
    const h = taskAbandonmentHarness(); h.decision.taskPath = "backlog/tasks/other.md";
    await assert.rejects(abandonTaskEpisode(h.f.ctx, h.deps, h.decision), /exact owned task path/);
  });
  await t.test("parent mismatch", async () => {
    const h = taskAbandonmentHarness({ parentTaskId: "OTHER-1" });
    await assert.rejects(abandonTaskEpisode(h.f.ctx, h.deps, h.decision), /exact bound task content and hierarchy/);
  });
  await t.test("candidate not descended from main", async () => {
    const h = taskAbandonmentHarness({ related: false });
    await assert.rejects(abandonTaskEpisode(h.f.ctx, h.deps, h.decision), /candidate\/main relationship/);
  });
  await t.test("Done cannot be abandoned", async () => {
    const h = taskAbandonmentHarness({ mainStatus: "Done" });
    await assert.rejects(abandonTaskEpisode(h.f.ctx, h.deps, h.decision), /without publishing Done/);
  });
});


function taskCleanupHarness(outcome = "merged", options = {}) {
  const f = harness();
  const taskPath = "backlog/tasks/primeclaw-10.38.md";
  const episodeHead = "b".repeat(40);
  const terminalCommit = outcome === "merged" ? "d".repeat(40) : "a".repeat(40);
  const priorMainHead = "1".repeat(40);
  const archivePath = "backlog/archive/tasks/primeclaw-10.38.md";
  f.ownership.write(f.root, activeTaskRecord(f));
  f.calls.length = 0;
  const resources = taskEpisodeCleanupResourceIdentity(f.record, episodeHead);
  const initialStage = options.stage ?? 0;
  let runtimePresent = initialStage < 1;
  let worktreePresent = initialStage < 2;
  let branchPresent = initialStage < 3;
  if (options.unsafeGap) { runtimePresent = false; worktreePresent = true; branchPresent = false; }
  let failRuntime = Boolean(options.failRuntimeOnce);
  const snapshot = () => ({
    ...(runtimePresent ? { runtime: { resources: structuredClone(resources), cwd: f.worktree, idle: options.busy !== true } } : {}),
    ...(worktreePresent ? { worktree: { path: f.worktree, branch: f.record.branch, head: episodeHead, clean: true } } : {}),
    ...(branchPresent ? { branch: { name: f.record.branch, head: episodeHead } } : {}),
  });
  const cleanup = {
    async inspect() { f.calls.push(["cleanup-inspect"]); return snapshot(); },
    async removeRuntime() {
      f.calls.push(["remove-runtime", f.record.status]);
      runtimePresent = false;
      if (options.runtimeRemovesWorktree) worktreePresent = false;
      if (failRuntime) { failRuntime = false; throw new Error("runtime removal interrupted"); }
    },
    async removeWorktree() {
      f.calls.push(["remove-worktree", f.record.status]);
      worktreePresent = false;
      if (options.worktreeRemovesBranch) branchPresent = false;
    },
    async removeBranch() { f.calls.push(["remove-branch", f.record.status]); branchPresent = false; },
  };
  const terminalGit = {
    head: () => terminalCommit,
    upstreamHead: () => terminalCommit,
    isAncestor: (_repo, ancestor, descendant) => (
      (ancestor === terminalCommit && descendant === terminalCommit)
      || (ancestor === TASK_BASE && descendant === episodeHead && (worktreePresent || branchPresent))
    ),
    parents: (_repo, ref) => ref === terminalCommit
      ? [outcome === "merged" ? episodeHead : priorMainHead] : [],
    commitPaths: (_repo, ref) => ref === terminalCommit
      ? (outcome === "merged" ? [taskPath] : [taskPath, archivePath]) : [],
  };
  const mergedResult = {
    verified: true,
    outcome: "merged",
    taskId: "PRIMECLAW-10.38",
    status: "Done",
    priorMainHead,
    mergedHead: episodeHead,
    doneCommit: terminalCommit,
    parentTaskId: "PRIMECLAW-10",
    episodeTaskContentDigest: "e".repeat(64),
  };
  const abandonDecision = {
    operatorDecision: "abandon",
    taskId: "PRIMECLAW-10.38",
    taskPath,
    mainHead: priorMainHead,
    episodeHead,
    mainStatus: "Blocked",
    candidateMainRelationship: "main-ancestor",
    parentTaskId: "PRIMECLAW-10",
    episodeTaskContentDigest: "e".repeat(64),
    finalSummary: "Operator confirmed abandonment; no candidate code was merged.",
  };
  const abandonedResult = {
    verified: true,
    outcome: "abandoned",
    taskId: "PRIMECLAW-10.38",
    status: "Blocked",
    priorMainHead,
    episodeHead,
    archiveCommit: terminalCommit,
    archivedTaskPath: archivePath,
    parentTaskId: "PRIMECLAW-10",
    episodeTaskContentDigest: "e".repeat(64),
    archivedTaskFileDigest: "f".repeat(64),
    resourcesRetained: true,
  };
  const evidence = outcome === "merged"
    ? { outcome: "merged", result: mergedResult }
    : { outcome: "abandoned", decision: abandonDecision, result: abandonedResult };
  const decision = {
    operatorDecision: "cleanup",
    taskId: "PRIMECLAW-10.38",
    taskPath,
    ownerSessionId: "owner",
    episodeHead,
    terminalOutcome: outcome,
    terminalCommit,
    resources: structuredClone(resources),
  };
  const deps = {
    ...f.deps,
    cleanup,
    abandonmentGit: terminalGit,
    taskResolver: (cwd) => outcome === "merged" ? taskSelection(f, {
      projectRoot: cwd, status: "Done", taskPathRelative: taskPath, taskPath: join(cwd, taskPath),
    }) : null,
    taskSnapshotResolver: () => ({
      taskId: "PRIMECLAW-10.38", taskPath, parentTaskId: "PRIMECLAW-10",
      status: "Done", implementationPlan: "Plan", contentDigest: "e".repeat(64),
    }),
    abandonmentFileSnapshotResolver: () => ({
      status: "Blocked", finalSummary: abandonDecision.finalSummary, contentDigest: "f".repeat(64),
    }),
    now: () => "2026-10-13T15:00:00.000Z",
  };
  return {
    f, deps, decision, evidence, mergedResult, abandonedResult, abandonDecision,
    snapshot, get runtimePresent() { return runtimePresent; },
    get worktreePresent() { return worktreePresent; }, get branchPresent() { return branchPresent; },
  };
}

test("authorized merged-task cleanup removes exact resources in order before closing ownership", async () => {
  const h = taskCleanupHarness("merged");
  assert.equal(h.f.record.head, TASK_BASE);
  assert.notEqual(h.f.record.head, h.decision.episodeHead);
  const result = await finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, h.evidence);
  assert.deepEqual(result, {
    verified: true, outcome: "merged", taskId: "PRIMECLAW-10.38",
    terminalCommit: "d".repeat(40), resourcesRemoved: true, ownershipStatus: "inactive", reused: false,
  });
  assert.deepEqual(
    h.f.calls.filter((call) => call[0].startsWith("remove-")),
    [["remove-runtime", "active"], ["remove-worktree", "active"], ["remove-branch", "active"]],
  );
  assert.equal(h.f.record.status, "inactive");
  assert.equal(h.runtimePresent || h.worktreePresent || h.branchPresent, false);
  const replay = await finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, h.evidence);
  assert.equal(replay.reused, true);
});

test("authorized abandonment cleanup verifies archived non-Done evidence before resource removal", async () => {
  const h = taskCleanupHarness("abandoned", { worktreeRemovesBranch: true });
  const result = await finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, h.evidence);
  assert.equal(result.outcome, "abandoned");
  assert.equal(result.terminalCommit, "a".repeat(40));
  assert.deepEqual(
    h.f.calls.filter((call) => call[0].startsWith("remove-")),
    [["remove-runtime", "active"], ["remove-worktree", "active"]],
  );
  assert.equal(h.f.record.status, "inactive");
  const replay = await finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, h.evidence);
  assert.equal(replay.reused, true);
});

test("cleanup rejects missing authority, foreign resources, mixed terminal evidence, and busy runtime before mutation", async (t) => {
  await t.test("missing cleanup decision", async () => {
    const h = taskCleanupHarness("merged"); h.decision.operatorDecision = "delay";
    await assert.rejects(finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, h.evidence), /separate explicit operator cleanup authority/);
    assert.equal(h.f.record.status, "active");
  });
  await t.test("foreign resource binding", async () => {
    const h = taskCleanupHarness("merged"); h.decision.resources.episodeId = "foreign";
    await assert.rejects(finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, h.evidence), /every exact Episode resource/);
    assert.equal(h.f.calls.some((call) => call[0].startsWith("remove-")), false);
  });
  await t.test("mixed terminal boundary", async () => {
    const h = taskCleanupHarness("abandoned");
    const mixed = { outcome: "merged", result: h.abandonedResult };
    await assert.rejects(finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, mixed), /does not match the explicit cleanup authority/);
    assert.equal(h.f.calls.some((call) => call[0].startsWith("remove-")), false);
  });
  await t.test("unverified transport", async () => {
    const h = taskCleanupHarness("merged"); h.evidence.result.pushError = "offline";
    await assert.rejects(finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, h.evidence), /merge evidence/);
    assert.equal(h.f.calls.some((call) => call[0].startsWith("remove-")), false);
  });
  await t.test("busy runtime", async () => {
    const h = taskCleanupHarness("merged", { busy: true });
    await assert.rejects(finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, h.evidence), /runtime is busy/);
    assert.equal(h.f.calls.some((call) => call[0].startsWith("remove-")), false);
  });
  await t.test("unsafe missing-resource order", async () => {
    const h = taskCleanupHarness("merged", { unsafeGap: true });
    await assert.rejects(finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, h.evidence), /missing in an unsafe order/);
    assert.equal(h.f.calls.some((call) => call[0].startsWith("remove-")), false);
  });
  await t.test("runtime removal crosses its exact boundary", async () => {
    const h = taskCleanupHarness("merged", { runtimeRemovesWorktree: true });
    await assert.rejects(finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, h.evidence), /runtime removal was not verified exactly/);
    assert.equal(h.f.record.status, "active");
  });
  await t.test("uncertain ownership", async () => {
    const h = taskCleanupHarness("merged");
    h.f.ownership.write(h.f.root, { ...h.f.record, status: "uncertain" });
    await assert.rejects(finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, h.evidence), /cannot finalize uncertain ownership/);
    assert.equal(h.f.calls.some((call) => call[0].startsWith("remove-")), false);
  });
});

test("all-absent abandonment retry closes ownership without requiring the deleted Episode ref", async () => {
  const h = taskCleanupHarness("abandoned", { stage: 3 });
  assert.equal(h.f.record.status, "active");
  const result = await finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, h.evidence);
  assert.equal(result.reused, false);
  assert.equal(h.f.record.status, "inactive");
  assert.equal(h.f.calls.some((call) => call[0].startsWith("remove-")), false);
});

test("interrupted cleanup retains active ownership and resumes only the exact monotonic prefix", async () => {
  const h = taskCleanupHarness("merged", { failRuntimeOnce: true });
  await assert.rejects(
    finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, h.evidence),
    /runtime removal interrupted/,
  );
  assert.equal(h.f.record.status, "active");
  assert.equal(h.runtimePresent, false);
  const result = await finalizeTaskEpisodeCleanup(h.f.ctx, h.deps, h.decision, h.evidence);
  assert.equal(result.reused, false);
  assert.deepEqual(
    h.f.calls.filter((call) => call[0] === "remove-runtime"),
    [["remove-runtime", "active"]],
  );
  assert.equal(h.f.record.status, "inactive");
});

test("verified local abandonment remains authoritative when its final push fails", async () => {
  const h = taskAbandonmentHarness({ pushFails: true });
  const result = await abandonTaskEpisode(h.f.ctx, h.deps, h.decision);
  assert.equal(result.archiveCommit, h.archiveHead);
  assert.match(result.pushError, /archive push offline/);
  assert.equal(h.mainPath, h.archivePath);
  assert.deepEqual(h.changes, []);
});

test("successful local Done remains authoritative when its final push fails", async () => {
  const h = taskLifecycleHarness({ finalPushFails: true });
  const evidence = await completeReadyHandshake(h);
  const result = await mergeTaskEpisodeReadyForMerge(
    evidence, h.f.ctx, h.deps,
    {
      operatorDecision: "merge",
      taskId: evidence.verification.taskId,
      mainHead: evidence.verification.mainHead,
      refreshedEpisodeHead: evidence.verification.refreshedEpisodeHead,
    },
  );
  assert.equal(result.status, "Done");
  assert.equal(h.mainStatus, "Done");
  assert.equal(h.mainHead, result.doneCommit);
  assert.match(result.pushError, /main push offline/);
});

test("Merge recovery resumes exact partial states without duplicate mutation", async (t) => {
  const decisionFor = (evidence) => ({
    operatorDecision: "merge",
    taskId: evidence.verification.taskId,
    mainHead: evidence.verification.mainHead,
    refreshedEpisodeHead: evidence.verification.refreshedEpisodeHead,
  });
  await t.test("interruption immediately after fast-forward resumes at Done", async () => {
    const h = taskLifecycleHarness({ failFastForwardAfterMutationOnce: true });
    const evidence = await completeReadyHandshake(h);
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /interrupted after fast-forward/,
    );
    const result = await mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence));
    assert.equal(result.status, "Done");
    assert.equal(h.f.calls.filter((call) => call[0] === "fast-forward").length, 1);
    assert.equal(h.f.calls.filter((call) => call[0] === "status-commit").length, 2);
  });
  await t.test("interruption before Done edit resumes from exact candidate", async () => {
    const h = taskLifecycleHarness({ doneEditFailsOnce: true });
    const evidence = await completeReadyHandshake(h);
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /Done edit interrupted/,
    );
    const result = await mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence));
    assert.equal(result.status, "Done");
    assert.equal(h.f.calls.filter((call) => call[0] === "fast-forward").length, 1);
    assert.equal(h.f.calls.filter((call) => call[0] === "status-commit").length, 2);
  });
  await t.test("interruption after Done mutation commits the exact dirty task once", async () => {
    const h = taskLifecycleHarness({ interruptAfterDoneMutationOnce: true });
    const evidence = await completeReadyHandshake(h);
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /interrupted after Done mutation/,
    );
    const result = await mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence));
    assert.equal(result.status, "Done");
    assert.equal(h.f.calls.filter((call) => call[0] === "fast-forward").length, 1);
    assert.equal(h.mainCommitCount, 2);
  });
  await t.test("interruption after Done staging commits the exact staged task once", async () => {
    const h = taskLifecycleHarness({ interruptAfterDoneStageOnce: true });
    const evidence = await completeReadyHandshake(h);
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /interrupted after Done staging/,
    );
    const result = await mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence));
    assert.equal(result.status, "Done");
    assert.equal(h.f.calls.filter((call) => call[0] === "fast-forward").length, 1);
    assert.equal(h.mainCommitCount, 2);
  });
  await t.test("dirty Done recovery rejects an extra changed path", async () => {
    const h = taskLifecycleHarness({ interruptAfterDoneMutationOnce: true });
    const evidence = await completeReadyHandshake(h);
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /interrupted after Done mutation/,
    );
    h.addMainChange({ status: "??", path: "unrelated.txt" });
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /rejects canonical-main changes outside the exact modified task/,
    );
    assert.equal(h.mainCommitCount, 1);
  });
  await t.test("dirty recovery rejects a non-Done task", async () => {
    const h = taskLifecycleHarness({ interruptAfterDoneMutationOnce: true });
    const evidence = await completeReadyHandshake(h);
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /interrupted after Done mutation/,
    );
    h.setMainStatus("Ready for Merge");
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /Dirty Done recovery does not preserve/,
    );
    assert.equal(h.mainCommitCount, 1);
  });
  await t.test("interruption after Done commit verifies and pushes the exact existing child", async () => {
    const h = taskLifecycleHarness({ failDoneSnapshotOnce: true });
    const evidence = await completeReadyHandshake(h);
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /interrupted after Done commit/,
    );
    const result = await mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence));
    assert.equal(result.status, "Done");
    assert.equal(h.f.calls.filter((call) => call[0] === "fast-forward").length, 1);
    assert.equal(h.f.calls.filter((call) => call[0] === "status-commit").length, 2);
  });
  await t.test("mismatched existing Done child fails closed", async () => {
    const h = taskLifecycleHarness({ failDoneSnapshotOnce: true });
    const evidence = await completeReadyHandshake(h);
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /interrupted after Done commit/,
    );
    h.setParents(h.mainHead, ["e".repeat(40)]);
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /neither the verified pre-merge head, exact candidate, nor exact Done child/,
    );
    assert.equal(h.f.calls.filter((call) => call[0] === "status-commit").length, 2);
  });
});

test("post-Done remote verification remains best-effort evidence", async (t) => {
  for (const scenario of [
    { name: "upstream lookup error", options: { upstreamLookupFailsAfterDone: true }, pattern: /upstream unavailable/ },
    { name: "observed upstream mismatch", options: { upstreamMismatchAfterDone: true }, pattern: /expected .* but observed/ },
  ]) await t.test(scenario.name, async () => {
    const h = taskLifecycleHarness(scenario.options);
    const evidence = await completeReadyHandshake(h);
    const result = await mergeTaskEpisodeReadyForMerge(
      evidence, h.f.ctx, h.deps,
      {
        operatorDecision: "merge",
        taskId: evidence.verification.taskId,
        mainHead: evidence.verification.mainHead,
        refreshedEpisodeHead: evidence.verification.refreshedEpisodeHead,
      },
    );
    assert.equal(result.status, "Done");
    assert.equal(h.mainStatus, "Done");
    assert.equal(h.mainHead, result.doneCommit);
    assert.match(result.pushError, scenario.pattern);
  });
});

test("Merge and Done fail closed before canonical-main mutation", async (t) => {
  const decisionFor = (evidence, overrides = {}) => ({
    operatorDecision: "merge",
    taskId: evidence.verification.taskId,
    mainHead: evidence.verification.mainHead,
    refreshedEpisodeHead: evidence.verification.refreshedEpisodeHead,
    ...overrides,
  });
  await t.test("wrong operator outcome is not merge authority", async () => {
    const h = taskLifecycleHarness();
    const evidence = await completeReadyHandshake(h);
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, { operatorDecision: "delay" }),
      /explicit operator Merge decision/,
    );
    assert.equal(h.f.calls.some((call) => call[0] === "fast-forward"), false);
  });
  await t.test("authority must bind exact task, main, and candidate", async () => {
    const h = taskLifecycleHarness();
    const evidence = await completeReadyHandshake(h);
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(
        evidence, h.f.ctx, h.deps, decisionFor(evidence, { refreshedEpisodeHead: "e".repeat(40) }),
      ),
      /does not bind the exact verified task, main, and refreshed candidate/,
    );
    assert.equal(h.mainStatus, "Ready for Merge");
    assert.equal(h.f.calls.some((call) => call[0] === "fast-forward"), false);
  });
  await t.test("Ready publication commit must remain in verified main history", async () => {
    const h = taskLifecycleHarness();
    const evidence = await completeReadyHandshake(h);
    h.setPublicationAncestor(false);
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /exact reviewed ancestry/,
    );
    assert.equal(h.mainStatus, "Ready for Merge");
    assert.equal(h.f.calls.some((call) => call[0] === "fast-forward"), false);
  });
  await t.test("dirty canonical main blocks merge", async () => {
    const h = taskLifecycleHarness({ mainDirty: true });
    const evidence = await completeReadyHandshake(h);
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /rejects canonical-main changes outside the exact modified task/,
    );
    assert.equal(h.mainStatus, "Ready for Merge");
    assert.equal(h.f.calls.some((call) => call[0] === "fast-forward"), false);
  });
  await t.test("diverged canonical-main upstream blocks merge", async () => {
    const h = taskLifecycleHarness();
    const evidence = await completeReadyHandshake(h);
    h.divergeMainUpstream();
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /canonical main and its upstream to remain at the exact verified head/,
    );
    assert.equal(h.mainStatus, "Ready for Merge");
    assert.equal(h.f.calls.some((call) => call[0] === "fast-forward"), false);
  });
  await t.test("unpushed refreshed candidate blocks merge", async () => {
    const h = taskLifecycleHarness();
    const evidence = await completeReadyHandshake(h);
    h.setEpisodeUpstream("e".repeat(40));
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /exact refreshed Episode candidate to remain pushed/,
    );
    assert.equal(h.mainStatus, "Ready for Merge");
    assert.equal(h.f.calls.some((call) => call[0] === "fast-forward"), false);
  });
  await t.test("stale main blocks merge", async () => {
    const h = taskLifecycleHarness();
    const evidence = await completeReadyHandshake(h);
    h.advanceMain();
    await assert.rejects(
      mergeTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, decisionFor(evidence)),
      /neither the verified pre-merge head, exact candidate, nor exact Done child/,
    );
    assert.equal(h.mainStatus, "Ready for Merge");
    assert.equal(h.f.calls.some((call) => call[0] === "fast-forward"), false);
  });
});

test("Request Changes reverses status, refreshes the same Episode, verifies, then hands off once", async () => {
  const h = taskLifecycleHarness();
  const evidence = await completeReadyHandshake(h);
  const publication = await publishTaskEpisodeChangesRequested(
    evidence, h.f.ctx, h.deps, { operatorDecision: "request-changes" },
  );
  const integration = await integrateTaskEpisodeChangesRequested(publication, h.f.ctx, h.deps);
  const verified = verifyTaskEpisodeChangesRequested(publication, integration, h.f.ctx, h.deps);
  assert.equal(h.f.calls.some((call) => call[0] === "handoff"), false);
  const result = await resumeTaskEpisodeChangesRequested(
    publication, integration, "repair only the accepted findings", h.f.ctx, h.deps,
  );
  assert.equal(publication.status, "In Progress");
  assert.equal(publication.episodeHead, evidence.verification.refreshedEpisodeHead);
  assert.equal(integration.previousRefreshedEpisodeHead, evidence.verification.refreshedEpisodeHead);
  assert.equal(integration.refreshedEpisodeHead, "d".repeat(40));
  assert.equal(verified.status, "In Progress");
  assert.equal(verified.refreshedEpisodeHead, "d".repeat(40));
  assert.deepEqual(result.verification, verified);
  assert.equal(result.handoff.taskId, "PRIMECLAW-10.38");
  assert.equal(h.mainStatus, "In Progress");
  assert.equal(h.episodeStatus, "In Progress");
  assert.equal(h.f.calls.filter((call) => call[0] === "status-commit").length, 2);
  assert.equal(h.f.calls.filter((call) => call[0] === "merge-commit").length, 2);
  assert.equal(h.f.calls.filter((call) => call[0] === "handoff").length, 1);
  assert.equal(h.f.calls.filter((call) => call[0] === "ownership").length, 0);
  assert.equal(h.f.calls.some((call) => ["fresh", "execute", "promote", "local-create", "orca-create"].includes(call[0])), false);
});

test("reversible operator outcomes fail closed before mutation or handoff", async (t) => {
  await t.test("wrong decision cannot authorize Delay", async () => {
    const h = taskLifecycleHarness();
    const evidence = await completeReadyHandshake(h);
    const statusCommits = h.f.calls.filter((call) => call[0] === "status-commit").length;
    await assert.rejects(
      delayTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, { operatorDecision: "request-changes" }),
      /explicit operator Delay decision/,
    );
    assert.equal(h.f.calls.filter((call) => call[0] === "status-commit").length, statusCommits);
    assert.equal(h.f.calls.some((call) => call[0] === "handoff"), false);
  });
  await t.test("wrong decision cannot authorize Request Changes", async () => {
    const h = taskLifecycleHarness();
    const evidence = await completeReadyHandshake(h);
    const statusCommits = h.f.calls.filter((call) => call[0] === "status-commit").length;
    await assert.rejects(
      publishTaskEpisodeChangesRequested(evidence, h.f.ctx, h.deps, { operatorDecision: "delay" }),
      /explicit operator authority/,
    );
    assert.equal(h.f.calls.filter((call) => call[0] === "status-commit").length, statusCommits);
    assert.equal(h.f.calls.some((call) => call[0] === "handoff"), false);
  });
  await t.test("stale verified main cannot be reversed", async () => {
    const h = taskLifecycleHarness();
    const evidence = await completeReadyHandshake(h);
    h.advanceMain();
    await assert.rejects(
      publishTaskEpisodeChangesRequested(evidence, h.f.ctx, h.deps, { operatorDecision: "request-changes" }),
      /refreshed candidate against current main/,
    );
    assert.equal(h.mainStatus, "Ready for Merge");
    assert.equal(h.f.calls.filter((call) => call[0] === "status-commit").length, 1);
    assert.equal(h.f.calls.some((call) => call[0] === "handoff"), false);
  });
  await t.test("published reversal can retry integration without another status mutation", async () => {
    const h = taskLifecycleHarness();
    const evidence = await completeReadyHandshake(h);
    h.lifecycleGit.mergeMain = () => { throw new Error("conflict outside task"); };
    const publication = await publishTaskEpisodeChangesRequested(
      evidence, h.f.ctx, h.deps, { operatorDecision: "request-changes" },
    );
    const statusCommits = h.f.calls.filter((call) => call[0] === "status-commit").length;
    await assert.rejects(
      integrateTaskEpisodeChangesRequested(publication, h.f.ctx, h.deps),
      /conflict outside task/,
    );
    assert.equal(h.mainStatus, "In Progress");
    assert.equal(h.episodeStatus, "Ready for Merge");
    assert.equal(h.f.calls.some((call) => call[0] === "handoff"), false);
    h.lifecycleGit.mergeMain = (worktree, mergedMain, taskPath) => {
      h.f.calls.push(["merge-main", worktree, mergedMain, taskPath]);
    };
    const integration = await integrateTaskEpisodeChangesRequested(publication, h.f.ctx, h.deps);
    const resumed = await resumeTaskEpisodeChangesRequested(publication, integration, "retry accepted integration", h.f.ctx, h.deps);
    assert.equal(resumed.verification.status, "In Progress");
    assert.equal(h.f.calls.filter((call) => call[0] === "status-commit").length, statusCommits);
    assert.equal(h.f.calls.filter((call) => call[0] === "handoff").length, 1);
  });
  await t.test("transient candidate push retries the exact existing merge before handoff", async () => {
    const h = taskLifecycleHarness({ failEpisodePushNumber: 4 });
    const evidence = await completeReadyHandshake(h);
    const publication = await publishTaskEpisodeChangesRequested(
      evidence, h.f.ctx, h.deps, { operatorDecision: "request-changes" },
    );
    const first = await integrateTaskEpisodeChangesRequested(publication, h.f.ctx, h.deps);
    assert.match(first.pushError, /episode push offline/);
    const statusCommits = h.f.calls.filter((call) => call[0] === "status-commit").length;
    const mergeCommits = h.f.calls.filter((call) => call[0] === "merge-commit").length;
    const retried = await integrateTaskEpisodeChangesRequested(publication, h.f.ctx, h.deps);
    assert.equal(retried.pushError, undefined);
    assert.equal(retried.refreshedEpisodeHead, first.refreshedEpisodeHead);
    assert.equal(h.f.calls.filter((call) => call[0] === "status-commit").length, statusCommits);
    assert.equal(h.f.calls.filter((call) => call[0] === "merge-commit").length, mergeCommits);
    const resumed = await resumeTaskEpisodeChangesRequested(publication, retried, "retry push", h.f.ctx, h.deps);
    assert.equal(resumed.verification.status, "In Progress");
    assert.equal(h.f.calls.filter((call) => call[0] === "status-commit").length, 2);
    assert.equal(h.f.calls.filter((call) => call[0] === "merge-commit").length, 2);
    assert.equal(h.f.calls.filter((call) => call[0] === "handoff").length, 1);
  });
  await t.test("persistently unpushable requested-changes candidate is never handed off", async () => {
    const h = taskLifecycleHarness({ failEpisodePushFrom: 4 });
    const evidence = await completeReadyHandshake(h);
    const publication = await publishTaskEpisodeChangesRequested(
      evidence, h.f.ctx, h.deps, { operatorDecision: "request-changes" },
    );
    const first = await integrateTaskEpisodeChangesRequested(publication, h.f.ctx, h.deps);
    const retried = await integrateTaskEpisodeChangesRequested(publication, h.f.ctx, h.deps);
    assert.match(first.pushError, /episode push offline/);
    assert.match(retried.pushError, /episode push offline/);
    await assert.rejects(
      resumeTaskEpisodeChangesRequested(publication, retried, "", h.f.ctx, h.deps),
      /exact refreshed Episode candidate to be pushed/,
    );
    assert.equal(h.mainStatus, "In Progress");
    assert.equal(h.episodeStatus, "In Progress");
    assert.equal(h.f.calls.filter((call) => call[0] === "merge-commit").length, 2);
    assert.equal(h.f.calls.some((call) => call[0] === "handoff"), false);
  });
  await t.test("busy Episode blocks Delay without transport", async () => {
    const h = taskLifecycleHarness();
    const evidence = await completeReadyHandshake(h);
    h.f.publisher.getState = async () => ({
      activeSessionId: "route", sessionId: "episode", sessionFile: join(h.f.root, "episode.jsonl"),
      cwd: h.f.worktree, isSessionActive: true, isStreaming: true, isCompacting: false,
      isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false,
      unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [], active: {} },
    });
    const before = h.f.calls.filter((call) => call[0] === "status-commit").length;
    await assert.rejects(
      delayTaskEpisodeReadyForMerge(evidence, h.f.ctx, h.deps, { operatorDecision: "delay" }),
      /not quiescent|idle Episode|must be idle|busy/,
    );
    assert.equal(h.f.calls.filter((call) => call[0] === "status-commit").length, before);
    assert.equal(h.f.calls.some((call) => call[0] === "handoff"), false);
  });
});

test("Ready-for-Merge handshake fails closed on changed content, unsafe merge, stale main, and unpushed refreshed candidate", async (t) => {
  await t.test("owned Episode must be idle before worktree mutation", async () => {
    const h = taskLifecycleHarness();
    const publication = publishTaskEpisodeReadyForMerge("PRIMECLAW-10.38", h.acceptedEpisodeHead, h.f.ctx, h.deps);
    h.f.publisher.getState = async () => ({
      activeSessionId: "route", sessionId: "episode", sessionFile: join(h.f.root, "episode.jsonl"),
      cwd: h.f.worktree, isSessionActive: true, isStreaming: true, isCompacting: false,
      isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false,
      unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [], active: {} },
    });
    await assert.rejects(
      integrateTaskEpisodeReadyForMerge(publication, h.f.ctx, h.deps),
      /not quiescent|idle Episode|must be idle|busy/,
    );
    assert.equal(h.f.calls.some((call) => call[0] === "merge-main"), false);
  });
  await t.test("candidate content changed after publication", async () => {
    const h = taskLifecycleHarness();
    const publication = publishTaskEpisodeReadyForMerge("PRIMECLAW-10.38", h.acceptedEpisodeHead, h.f.ctx, h.deps);
    const snapshots = (cwd, id) => ({ ...h.taskSnapshotResolver(cwd, id), contentDigest: "e".repeat(64) });
    await assert.rejects(
      integrateTaskEpisodeReadyForMerge(publication, h.f.ctx, { ...h.deps, taskSnapshotResolver: snapshots }),
      /candidate content or invariant identity changed/,
    );
    assert.equal(h.f.calls.some((call) => call[0] === "merge-main"), false);
  });
  await t.test("merge conflict outside the task aborts without a refreshed commit", async () => {
    const h = taskLifecycleHarness({ mergeError: new Error("conflict outside task") });
    const publication = publishTaskEpisodeReadyForMerge("PRIMECLAW-10.38", h.acceptedEpisodeHead, h.f.ctx, h.deps);
    await assert.rejects(integrateTaskEpisodeReadyForMerge(publication, h.f.ctx, h.deps), /conflict outside task/);
    assert.equal(h.f.calls.filter((call) => call[0] === "merge-abort").length, 1);
    assert.equal(h.f.calls.some((call) => call[0] === "merge-commit"), false);
    assert.equal(h.episodeStatus, "In Progress");
  });
  await t.test("refreshed candidate must be pushed", async () => {
    const h = taskLifecycleHarness({ episodePushFails: true });
    const publication = publishTaskEpisodeReadyForMerge("PRIMECLAW-10.38", h.acceptedEpisodeHead, h.f.ctx, h.deps);
    const integration = await integrateTaskEpisodeReadyForMerge(publication, h.f.ctx, h.deps);
    assert.match(integration.pushError, /episode push offline/);
    assert.throws(
      () => verifyTaskEpisodeReadyForMerge(publication, integration, h.f.ctx, h.deps),
      /exact refreshed Episode candidate to be pushed/,
    );
  });
  await t.test("main advancing after integration makes the refreshed candidate stale", async () => {
    const h = taskLifecycleHarness();
    const publication = publishTaskEpisodeReadyForMerge("PRIMECLAW-10.38", h.acceptedEpisodeHead, h.f.ctx, h.deps);
    const integration = await integrateTaskEpisodeReadyForMerge(publication, h.f.ctx, h.deps);
    h.advanceMain();
    assert.throws(
      () => verifyTaskEpisodeReadyForMerge(publication, integration, h.f.ctx, h.deps),
      /refreshed candidate against current main/,
    );
  });
});

test("review snapshot digest excludes lifecycle metadata while retaining hierarchy and task content", () => {
  const baseTask = {
    id: "PRIMECLAW-10.38",
    path: "backlog/tasks/primeclaw-10.38.md",
    parentTaskId: "PRIMECLAW-10",
    status: "In Progress",
    updatedAt: "2026-10-13T00:00:00Z",
    title: "Task",
    implementationPlan: "Implement exact integration.",
    implementationNotes: "Episode-owned evidence",
    acceptanceCriteria: [{ id: 1, checked: true, text: "works" }],
  };
  const runnerFor = (task) => ({ run: () => ({ stdout: JSON.stringify({ schemaVersion: 1, kind: "task-view", task }), stderr: "", status: 0 }) });
  const before = resolveTaskReviewSnapshot("/repo", baseTask.id, runnerFor(baseTask));
  const lifecycleOnly = resolveTaskReviewSnapshot("/repo", baseTask.id, runnerFor({
    ...baseTask,
    status: "Ready for Merge",
    updatedAt: "2026-10-13T01:00:00Z",
    isReady: false,
    readiness: { ready: false, blockers: ["OTHER-2"] },
    dependencyGraph: { blockedBy: ["OTHER-2"] },
    subtasks: [{ id: "OTHER-3" }],
    acceptanceCriteriaCompleted: 1,
    acceptanceCriteriaCount: 1,
  }));
  assert.equal(before.contentDigest, lifecycleOnly.contentDigest);
  assert.equal(before.parentTaskId, "PRIMECLAW-10");
  const changed = resolveTaskReviewSnapshot("/repo", baseTask.id, runnerFor({
    ...baseTask, implementationNotes: "different Episode content",
  }));
  assert.notEqual(before.contentDigest, changed.contentDigest);
  const abandonmentBefore = resolveTaskAbandonmentSnapshot("/repo", baseTask.id, runnerFor(baseTask));
  const abandonmentTerminal = resolveTaskAbandonmentSnapshot("/repo", baseTask.id, runnerFor({
    ...baseTask, path: "backlog/archive/tasks/primeclaw-10.38.md",
    status: "Blocked", finalSummary: "Operator confirmed abandonment.",
  }));
  assert.equal(abandonmentBefore.abandonmentContentDigest, abandonmentTerminal.abandonmentContentDigest);
  assert.equal(abandonmentTerminal.finalSummary, "Operator confirmed abandonment.");
});

test("vendored Backlog abandonment fixtures expose archive visibility and reject inbound cleanup", () => {
  const backlog = resolve("deps/backlog/dist/backlog");
  const config = readFileSync(resolve("backlog/config.yml"), "utf8");
  const makeProject = () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-abandon-backlog-")));
    mkdirSync(join(root, "backlog"), { recursive: true });
    writeFileSync(join(root, "backlog", "config.yml"), config);
    execFileSync("git", ["-C", root, "init", "-q", "-b", "main"]);
    return root;
  };
  const run = (root, args, allowFailure = false) => {
    try {
      const stdout = execFileSync(backlog, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return { stdout, stderr: "", status: 0 };
    } catch (error) {
      if (!allowFailure) throw error;
      return { stdout: error.stdout?.toString() ?? "", stderr: error.stderr?.toString() ?? "", status: error.status ?? 1 };
    }
  };
  const runner = { run(command, args, options = {}) {
    assert.equal(command, "backlog");
    return run(options.cwd, args, options.allowFailure ?? false);
  } };

  const exact = makeProject();
  run(exact, ["task", "create", "Archive target", "--status", "Blocked", "--plan", "Plan", "--plain"]);
  const active = JSON.parse(run(exact, ["task", "view", "--json", "--", "PRIMECLAW-1"]).stdout).task.path;
  const episodeFile = resolveTaskAbandonmentFileSnapshot(exact, active);
  run(exact, ["task", "edit", "--status", "Blocked", "--final-summary", "Operator abandoned", "--plain", "--", "PRIMECLAW-1"]);
  const preparedFile = resolveTaskAbandonmentFileSnapshot(exact, active);
  assert.equal(preparedFile.contentDigest, episodeFile.contentDigest);
  assert.equal(preparedFile.finalSummary, "Operator abandoned");
  const archive = active.replace("/tasks/", "/archive/tasks/");
  assert.doesNotThrow(() => assertNoTaskArchiveCleanupTargets(exact, "PRIMECLAW-1", active, runner));
  const before = readFileSync(join(exact, active));
  assert.equal(run(exact, ["task", "archive", "--", "PRIMECLAW-1"], true).status, 1);
  mkdirSync(dirname(join(exact, archive)), { recursive: true });
  run(exact, ["task", "archive", "--", "PRIMECLAW-1"]);
  assert.equal(existsSync(join(exact, active)), false);
  assert.deepEqual(readFileSync(join(exact, archive)), before);
  assert.equal(run(exact, ["task", "view", "--json", "--", "PRIMECLAW-1"], true).status, 1);

  const collision = makeProject();
  const collisionGit = (...args) => execFileSync(
    "git", ["-C", collision, ...args], { encoding: "utf8" },
  ).trim();
  collisionGit("config", "user.name", "Prime Claw Test");
  collisionGit("config", "user.email", "test@example.invalid");
  run(collision, ["task", "create", "Reusable Café", "--status", "Blocked", "--plan", "Historical plan", "--plain"]);
  const historicalActive = JSON.parse(
    run(collision, ["task", "view", "--json", "--", "PRIMECLAW-1"]).stdout,
  ).task.path;
  const historicalArchive = historicalActive.replace("/tasks/", "/archive/tasks/");
  mkdirSync(dirname(join(collision, historicalArchive)), { recursive: true });
  run(collision, ["task", "archive", "--", "PRIMECLAW-1"]);
  const historicalBytes = readFileSync(join(collision, historicalArchive));
  collisionGit("add", "-A");
  collisionGit("commit", "-q", "-m", "historical archive");
  run(collision, ["task", "create", "Reusable Café", "--status", "Blocked", "--plan", "Current plan", "--plain"]);
  const reused = JSON.parse(
    run(collision, ["task", "view", "--json", "--", "PRIMECLAW-1"]).stdout,
  ).task;
  assert.equal(reused.path, historicalActive);
  collisionGit("add", "-A");
  collisionGit("commit", "-q", "-m", "reused active id");
  const collisionHead = collisionGit("rev-parse", "HEAD");
  const collisionAdapter = new CliTaskEpisodeAdmissionGit();
  assert.equal(collisionAdapter.pathTrackedAtRef(collision, collisionHead, historicalArchive), true);
  assert.throws(
    () => assertNoHistoricalTaskArchiveCollision(
      collision, collisionHead, historicalArchive, collisionAdapter,
    ),
    /archive destination already exists in bound main history/,
  );
  assert.deepEqual(readFileSync(join(collision, historicalArchive)), historicalBytes);
  assert.equal(existsSync(join(collision, historicalActive)), true);
  assert.equal(collisionGit("status", "--porcelain"), "");

  const activeInbound = makeProject();
  run(activeInbound, ["task", "create", "Target", "--status", "Blocked", "--plan", "Plan", "--plain"]);
  run(activeInbound, ["task", "create", "Dependent", "--status", "Blocked", "--plan", "Plan", "--depends-on", "PRIMECLAW-1", "--plain"]);
  assert.throws(
    () => assertNoTaskArchiveCleanupTargets(activeInbound, "PRIMECLAW-1", "backlog/tasks/primeclaw-1 - Target.md", runner),
    /would rewrite dependencies/,
  );

  for (const reference of ["PRIMECLAW-01", "primeclaw-1", "  PRIMECLAW-1  "]) {
    const aliasInbound = makeProject();
    run(aliasInbound, ["task", "create", "Target", "--status", "Blocked", "--plan", "Plan", "--plain"]);
    run(aliasInbound, ["task", "create", "Alias reference", "--status", "Blocked", "--plan", "Plan", "--ref", reference, "--plain"]);
    assert.throws(
      () => assertNoTaskArchiveCleanupTargets(aliasInbound, "PRIMECLAW-1", "backlog/tasks/target.md", runner),
      /would rewrite references/,
      reference,
    );
  }

  const completedInbound = makeProject();
  run(completedInbound, ["task", "create", "Target", "--status", "Blocked", "--plan", "Plan", "--plain"]);
  run(completedInbound, ["task", "create", "Historical reference", "--status", "Done", "--final-summary", "Done", "--ref", "PRIMECLAW-1", "--plain"]);
  mkdirSync(join(completedInbound, "backlog", "completed"), { recursive: true });
  run(completedInbound, ["task", "complete", "PRIMECLAW-2"]);
  assert.throws(
    () => assertNoTaskArchiveCleanupTargets(completedInbound, "PRIMECLAW-1", "backlog/tasks/primeclaw-1 - Target.md", runner),
    /would rewrite references/,
  );
});

test("abandonment file digest excludes only lifecycle metadata and Final Summary", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-abandon-digest-")));
  const activePath = "backlog/tasks/primeclaw-10.38.md";
  const archivePath = "backlog/archive/tasks/primeclaw-10.38.md";
  mkdirSync(join(root, "backlog", "tasks"), { recursive: true });
  mkdirSync(join(root, "backlog", "archive", "tasks"), { recursive: true });
  writeFileSync(join(root, activePath), `---\nid: PRIMECLAW-10.38\nstatus: In Progress\nupdated_date: '2026-10-13 12:00'\nparent_task_id: PRIMECLAW-10\n---\n\n## Implementation Notes\n\nEpisode content\n`);
  writeFileSync(join(root, archivePath), `---\nid: PRIMECLAW-10.38\nstatus: Blocked\nupdated_date: '2026-10-13 13:00'\nparent_task_id: PRIMECLAW-10\n---\n\n## Implementation Notes\n\nEpisode content\n\n## Final Summary\n\n<!-- SECTION:FINAL_SUMMARY:BEGIN -->\nOperator confirmed abandonment.\n<!-- SECTION:FINAL_SUMMARY:END -->\n`);
  const active = resolveTaskAbandonmentFileSnapshot(root, activePath);
  const archived = resolveTaskAbandonmentFileSnapshot(root, archivePath);
  assert.equal(active.status, "In Progress");
  assert.equal(active.finalSummary, null);
  assert.equal(archived.status, "Blocked");
  assert.equal(archived.finalSummary, "Operator confirmed abandonment.");
  assert.equal(active.contentDigest, archived.contentDigest);
  writeFileSync(join(root, archivePath), readFileSync(join(root, archivePath), "utf8").replace("Episode content", "changed content"));
  assert.notEqual(active.contentDigest, resolveTaskAbandonmentFileSnapshot(root, archivePath).contentDigest);
});

test("CLI review integration merges current main, restores the Episode task, and rejects conflicts outside it", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-ready-merge-")));
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Prime Claw Test");
  git("config", "user.email", "test@example.invalid");
  mkdirSync(join(root, "backlog", "tasks"), { recursive: true });
  const taskPath = "backlog/tasks/primeclaw-10.38.md";
  writeFileSync(join(root, taskPath), "---\nid: PRIMECLAW-10.38\nstatus: In Progress\n---\nbase\n");
  writeFileSync(join(root, "landed.txt"), "base\n");
  writeFileSync(join(root, "shared.txt"), "base\n");
  git("add", "-A"); git("commit", "-q", "-m", "base");
  git("checkout", "-q", "-b", "episode");
  writeFileSync(join(root, taskPath), "---\nid: PRIMECLAW-10.38\nstatus: In Progress\n---\nbase\nepisode evidence\n");
  writeFileSync(join(root, "shared.txt"), "episode\n");
  git("add", "-A"); git("commit", "-q", "-m", "episode candidate");
  const episodeHead = git("rev-parse", "HEAD");
  git("checkout", "-q", "main");
  writeFileSync(join(root, taskPath), "---\nid: PRIMECLAW-10.38\nstatus: Ready for Merge\n---\nbase\n");
  writeFileSync(join(root, "landed.txt"), "landed on main\n");
  writeFileSync(join(root, "shared.txt"), "main\n");
  git("add", "-A"); git("commit", "-q", "-m", "main ready");
  const mainHead = git("rev-parse", "HEAD");
  git("checkout", "-q", "episode");
  const adapter = new CliTaskEpisodeAdmissionGit();
  assert.throws(() => adapter.mergeMain(root, mainHead, taskPath), /conflicts outside/);
  adapter.abortMerge(root);

  writeFileSync(join(root, "shared.txt"), "base\n");
  git("add", "shared.txt"); git("commit", "-q", "-m", "avoid unrelated conflict");
  const acceptedHead = git("rev-parse", "HEAD");
  adapter.mergeMain(root, mainHead, taskPath);
  adapter.restoreTaskFromHead(root, taskPath);
  assert.match(readFileSync(join(root, taskPath), "utf8"), /status: In Progress[\s\S]*episode evidence/);
  assert.equal(readFileSync(join(root, "landed.txt"), "utf8"), "landed on main\n");
  adapter.stagePath(root, taskPath);
  const refreshed = adapter.commitMerge(root, "integrate main");
  assert.deepEqual(adapter.parents(root, refreshed), [acceptedHead, mainHead]);
  assert.equal(adapter.isAncestor(root, mainHead, refreshed), true);
  assert.notEqual(refreshed, episodeHead);

  git("checkout", "-q", "main");
  adapter.fastForward(root, refreshed);
  assert.equal(git("rev-parse", "HEAD"), refreshed);
  assert.match(readFileSync(join(root, taskPath), "utf8"), /status: In Progress[\s\S]*episode evidence/);

  git("checkout", "-q", "main");
  writeFileSync(join(root, taskPath), "---\nid: PRIMECLAW-10.38\nstatus: In Progress\n---\nbase\n");
  writeFileSync(join(root, "revision.txt"), "request changes\n");
  git("add", "-A"); git("commit", "-q", "-m", "request changes");
  const changesMainHead = git("rev-parse", "HEAD");
  git("checkout", "-q", "episode");
  adapter.mergeMain(root, changesMainHead, taskPath);
  adapter.restoreTaskFromHead(root, taskPath);
  assert.match(readFileSync(join(root, taskPath), "utf8"), /status: In Progress[\s\S]*episode evidence/);
  assert.equal(readFileSync(join(root, "revision.txt"), "utf8"), "request changes\n");
  adapter.stagePath(root, taskPath);
  const revisionCandidate = adapter.commitMerge(root, "integrate request changes");
  assert.deepEqual(adapter.parents(root, revisionCandidate), [refreshed, changesMainHead]);
  assert.equal(adapter.isAncestor(root, refreshed, revisionCandidate), true);
  assert.equal(adapter.isAncestor(root, changesMainHead, revisionCandidate), true);
});

test("CLI merge adapter reports clean, modified, staged, extra, untracked, and renamed paths", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-merge-status-")));
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Prime Claw Test");
  git("config", "user.email", "test@example.invalid");
  mkdirSync(join(root, "backlog", "tasks"), { recursive: true });
  const taskPath = "backlog/tasks/primeclaw-10.38.md";
  writeFileSync(join(root, taskPath), "status: Ready for Merge\n");
  writeFileSync(join(root, "other.txt"), "base\n");
  git("add", "-A"); git("commit", "-q", "-m", "base");
  const adapter = new CliTaskEpisodeAdmissionGit();
  assert.deepEqual(adapter.worktreeChanges(root), []);

  writeFileSync(join(root, taskPath), "status: Done\n");
  assert.deepEqual(adapter.worktreeChanges(root), [{ status: " M", path: taskPath }]);
  git("add", "--", taskPath);
  assert.deepEqual(adapter.worktreeChanges(root), [{ status: "M ", path: taskPath }]);
  writeFileSync(join(root, taskPath), "status: Done\nfinal summary: recorded\n");
  assert.deepEqual(adapter.worktreeChanges(root), [{ status: "MM", path: taskPath }]);
  git("add", "--", taskPath);
  git("commit", "-q", "-m", "done task");

  writeFileSync(join(root, "other.txt"), "changed\n");
  writeFileSync(join(root, "untracked.txt"), "new\n");
  assert.deepEqual(adapter.worktreeChanges(root), [
    { status: " M", path: "other.txt" },
    { status: "??", path: "untracked.txt" },
  ]);
  git("add", "-A"); git("commit", "-q", "-m", "other changes");
  git("mv", "other.txt", "renamed.txt");
  const renamed = adapter.worktreeChanges(root);
  assert.equal(renamed.length, 1);
  assert.match(renamed[0].status, /R/);
  assert.match(renamed[0].path, /other\.txt|renamed\.txt/);
  assert.match(renamed[0].path, / -> /);
});

test("CLI abandonment adapter selects only the Episode task blob and commits only its archive move", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-abandon-adapter-")));
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Prime Claw Test");
  git("config", "user.email", "test@example.invalid");
  const taskPath = "backlog/tasks/primeclaw-10.38.md";
  const archivePath = "backlog/archive/tasks/primeclaw-10.38.md";
  mkdirSync(join(root, "backlog", "tasks"), { recursive: true });
  writeFileSync(join(root, taskPath), "main task\\n");
  writeFileSync(join(root, "code.ts"), "main code\\n");
  git("add", "-A"); git("commit", "-q", "-m", "main");
  git("checkout", "-q", "-b", "episode");
  writeFileSync(join(root, taskPath), "episode task\\n");
  writeFileSync(join(root, "code.ts"), "episode code\\n");
  git("add", "-A"); git("commit", "-q", "-m", "episode candidate");
  const episodeHead = git("rev-parse", "HEAD");
  git("checkout", "-q", "main");

  const adapter = new CliTaskEpisodeAdmissionGit();
  adapter.restorePathFromRef(root, episodeHead, taskPath);
  assert.equal(readFileSync(join(root, taskPath), "utf8"), "episode task\\n");
  assert.equal(readFileSync(join(root, "code.ts"), "utf8"), "main code\\n");
  assert.deepEqual(adapter.worktreeChanges(root), [{ status: " M", path: taskPath }]);

  mkdirSync(join(root, "backlog", "archive", "tasks"), { recursive: true });
  git("mv", taskPath, archivePath);
  const commit = adapter.commitOnlyPaths(root, [taskPath, archivePath], "archive task");
  assert.deepEqual(adapter.commitPaths(root, commit).sort(), [archivePath, taskPath].sort());
  assert.deepEqual(adapter.worktreeChanges(root), []);
  assert.equal(readFileSync(join(root, "code.ts"), "utf8"), "main code\\n");
});

test("task lifecycle publication fails closed before status mutation", async (t) => {
  for (const scenario of [
    { name: "uncommitted Episode task content", options: { episodePathStatus: " M backlog/tasks/primeclaw-10.38.md" }, pattern: /committed Episode task content/ },
    { name: "reported Episode commit is not local HEAD", options: { episodeHead: "b".repeat(40), upstreamHead: "b".repeat(40) }, reported: "c".repeat(40), pattern: /exact reported Episode commit/ },
    { name: "reported Episode commit is not pushed", options: { upstreamHead: "a".repeat(40) }, pattern: /upstream to contain/ },
    { name: "Episode task has no post-admission evidence", options: { pathChanged: false }, pattern: /Episode-owned task evidence/ },
    { name: "main task bytes are dirty", options: { mainPathStatus: " M backlog/tasks/primeclaw-10.38.md" }, pattern: /main task path to match committed HEAD/ },
    { name: "Episode changed lifecycle status", options: { episodeStatus: "Blocked" }, pattern: /Episode task status In Progress/ },
  ]) await t.test(scenario.name, () => {
    const h = taskLifecycleHarness(scenario.options);
    assert.throws(
      () => publishTaskEpisodeBlocked("PRIMECLAW-10.38", scenario.reported ?? h.episodeHead, h.f.ctx, h.deps),
      scenario.pattern,
    );
    assert.equal(h.mainStatus, "In Progress");
    assert.equal(h.f.calls.some((call) => call[0] === "backlog-status" || call[0] === "status-commit"), false);
  });
});

test("task-native handoff rejects dirty main task bytes before routing even when they claim In Progress", async () => {
  const f = harness({ list: (_count, session) => [session] });
  const { relative, taskPath } = commitMainTask(f, "Blocked");
  writeFileSync(taskPath, "---\nid: PRIMECLAW-10.38\nstatus: In Progress\n---\n");
  assert.match(readFileSync(taskPath, "utf8"), /status: In Progress/);
  assert.match(execFileSync("git", ["-C", f.root, "show", `HEAD:${relative}`], { encoding: "utf8" }), /status: Blocked/);
  const cliGit = new CliGitAdapter();
  f.git.pathStatus = (repo, path) => cliGit.pathStatus(repo, path);
  f.ownership.write(f.root, activeTaskRecord(f));
  f.calls.length = 0;
  let resolverCalls = 0;
  await assert.rejects(
    handoffTaskEpisode(
      "PRIMECLAW-10.38", "continue", f.ctx,
      { ...f.deps, taskResolver: (cwd) => { resolverCalls += 1; return taskSelection(f, { projectRoot: cwd }); } },
    ),
    /exact main task path to match committed HEAD/,
  );
  assert.equal(resolverCalls, 1);
  assert.equal(f.calls.some((value) => ["reopen", "ownership", "handoff", "execute"].includes(value[0])), false);
});

test("task-native handoff allows unrelated dirty main paths", async () => {
  const f = harness({ list: (_count, session) => [session] });
  commitMainTask(f, "In Progress");
  writeFileSync(join(f.root, "unrelated.txt"), "uncommitted unrelated work\n");
  const cliGit = new CliGitAdapter();
  f.git.pathStatus = (repo, path) => cliGit.pathStatus(repo, path);
  f.ownership.write(f.root, activeTaskRecord(f));
  f.calls.length = 0;
  const result = await handoffTaskEpisode(
    "PRIMECLAW-10.38", "continue", f.ctx,
    { ...f.deps, taskResolver: boundTaskResolver(f) },
  );
  assert.equal(result.admitted, true);
  assert.equal(f.calls.filter((value) => value[0] === "handoff").length, 1);
  assert.match(execFileSync("git", ["-C", f.root, "status", "--porcelain", "--", "unrelated.txt"], { encoding: "utf8" }), /unrelated\.txt/);
});

test("task-native handoff preserves exact Orca identity without allocating resources", async () => {
  const f = harness({ list: (_count, session) => [session] });
  f.ownership.write(f.root, activeTaskRecord(f, {
    engine: "orca",
    projectSetupId: f.wt.projectSetupId,
    worktreeId: f.wt.id,
    worktreeIdentity: f.wt.identity,
    terminalHandle: "terminal",
  }));
  const result = await handoffTaskEpisode(
    "PRIMECLAW-10.38", "continue", f.ctx,
    { ...f.deps, taskResolver: boundTaskResolver(f) },
  );
  assert.equal(result.taskId, "PRIMECLAW-10.38");
  assert.equal(f.calls.filter((value) => value[0] === "orca-show").length, 1);
  assert.equal(f.calls.filter((value) => value[0] === "handoff").length, 1);
  assert.equal(f.calls.some((value) => ["orca-create", "auto-create", "fresh"].includes(value[0])), false);
});

test("task-native handoff rejects non-active ownership and a dirty Episode checkout before task routing", async (t) => {
  await t.test("non-active ownership", async () => {
    const f = harness({ record: taskReservation() });
    await assert.rejects(
      handoffTaskEpisode(
        "PRIMECLAW-10.38", "continue", f.ctx,
        { ...f.deps, taskResolver: boundTaskResolver(f) },
      ),
      /ownership is provisioning/,
    );
    assert.equal(f.calls.some((value) => value[0] === "handoff"), false);
  });
  await t.test("primary checkout is not on main", async () => {
    const f = harness();
    f.ownership.write(f.root, activeTaskRecord(f));
    f.git.branch = () => "feature";
    await assert.rejects(
      handoffTaskEpisode(
        "PRIMECLAW-10.38", "continue", f.ctx,
        { ...f.deps, taskResolver: boundTaskResolver(f) },
      ),
      /canonical primary main checkout/,
    );
    assert.equal(f.calls.some((value) => value[0] === "handoff"), false);
  });
  await t.test("dirty Episode checkout", async () => {
    const f = harness();
    f.ownership.write(f.root, activeTaskRecord(f));
    f.git.assertCleanWorktree = () => { throw new Error("Episode worktree is dirty"); };
    await assert.rejects(
      handoffTaskEpisode(
        "PRIMECLAW-10.38", "continue", f.ctx,
        { ...f.deps, taskResolver: boundTaskResolver(f) },
      ),
      /Episode worktree is dirty/,
    );
    assert.equal(f.calls.some((value) => value[0] === "handoff"), false);
  });
});

test("task-native handoff rejects changed task state and foreign durable session before delivery", async (t) => {
  for (const scenario of [
    {
      name: "main status is still Blocked",
      selection: (f, cwd) => taskSelection(f, { projectRoot: cwd, status: cwd === f.root ? "Blocked" : "In Progress" }),
      list: undefined,
      pattern: /requires main task status In Progress; found Blocked/,
    },
    {
      name: "main status is already Ready for Merge",
      selection: (f, cwd) => taskSelection(f, { projectRoot: cwd, status: cwd === f.root ? "Ready for Merge" : "In Progress" }),
      list: undefined,
      pattern: /requires main task status In Progress; found Ready for Merge/,
    },
    {
      name: "main plan is placeholder-only",
      selection: (f, cwd) => taskSelection(f, { projectRoot: cwd, implementationPlan: cwd === f.root ? "TODO" : "Implement the task." }),
      list: undefined,
      pattern: /meaningful main-task Implementation Plan/,
    },
    {
      name: "task path no longer matches ownership",
      selection: (f, cwd) => taskSelection(f, { projectRoot: cwd, taskPathRelative: "backlog/tasks/other.md" }),
      list: undefined,
      pattern: /does not match the exact owned Backlog task on main/,
    },
    {
      name: "Episode task status drifted",
      selection: (f, cwd) => taskSelection(f, { projectRoot: cwd, status: cwd === f.root ? "In Progress" : "Blocked" }),
      list: undefined,
      pattern: /requires Episode task status In Progress; found Blocked/,
    },
    {
      name: "Episode plan is placeholder-only",
      selection: (f, cwd) => taskSelection(f, { projectRoot: cwd, implementationPlan: cwd === f.root ? "Implement the task." : "TBD" }),
      list: undefined,
      pattern: /meaningful Episode Implementation Plan/,
    },
    {
      name: "durable session is rooted in another checkout",
      selection: (f, cwd) => taskSelection(f, { projectRoot: cwd }),
      list: (_count, session) => [{ ...session, cwd: "/foreign" }],
      pattern: /durable session is not rooted at the owned worktree/,
    },
  ]) await t.test(scenario.name, async () => {
    const f = harness({ ...(scenario.list ? { list: scenario.list } : {}) });
    f.ownership.write(f.root, activeTaskRecord(f));
    await assert.rejects(
      handoffTaskEpisode(
        "PRIMECLAW-10.38",
        "continue",
        f.ctx,
        { ...f.deps, taskResolver: (cwd) => scenario.selection(f, cwd) },
      ),
      scenario.pattern,
    );
    assert.equal(f.calls.some((value) => value[0] === "handoff"), false);
  });
});

test("ownership parser requires active durable and Orca bindings", () => {
  assert.throws(() => parseEpisodeOwnership({ version: 1, status: "active", engine: "orca" }), /unsupported shape/);
});

test("bundle bytes are bound before any ownership or external mutation", async () => {
  const f = harness();
  const folder = join(f.root, ".ralph", "plans", "future", "alpha");
  const approvedBundleDigest = bundleContentDigest(folder);
  writeFileSync(join(folder, "SPECIFICATION.md"), "changed after approval");
  await assert.rejects(createSpecEpisode(LOCATION, "tool", f.ctx, f.deps, { approvedBundleDigest }), /Approved bundle changed/);
  assert.deepEqual(f.calls, [["close"]]); assert.equal(f.record, null);
});

test("uncertain local publication preserves allocated durable session identity", async () => {
  const f = harness({ unavailable: true });
  f.publisher.createFresh = async (args) => {
    await args.onAllocated?.({ sessionId: "allocated", sessionFile: join(f.root, "allocated.jsonl") });
    throw new EpisodeStateUncertainError("publication uncertain");
  };
  await assert.rejects(createApproved(f), /publication uncertain/);
  assert.equal(f.record.status, "uncertain"); assert.equal(f.record.episodeId, "allocated");
  assert.equal(f.record.episodeSessionFile, join(f.root, "allocated.jsonl"));
  assert.equal(f.calls.some((call) => call[0] === "execute"), false);
});

test("Orca binding requires positive visible provider readiness", async () => {
  const f = harness({ screen: { source: "screen-unavailable", text: "starting" } });
  await assert.rejects(createApproved(f), /Timed out binding/);
  assert.equal(f.record.status, "uncertain"); assert.equal(f.calls.some((call) => call[0] === "auto-remove"), false);
});

test("CLI Orca adapter encodes background provider launch without activate", async () => {
  const commands = [];
  const runner = (args) => {
    commands.push(args);
    const key = args.slice(0, 2).join(" ");
    if (key === "project setups") return JSON.stringify({ ok: true, result: { setups: [{ id: "setup", projectId: "project", hostId: "local", path: "/repo", displayName: "repo", setupState: "ready" }] } });
    if (key === "worktree create") return JSON.stringify({ ok: true, result: { worktree: { id: "repo::/wt", identity: { key: "wt2:local:one" }, path: "/wt", branch: "refs/heads/generated", head: "base", projectHostSetupId: "setup" } } });
    if (key === "automations create") return JSON.stringify({ ok: true, result: { automation: { id: "auto" } } });
    if (key === "automations run") return JSON.stringify({ ok: true, result: { run: { id: "run" } } });
    if (key === "automations remove") return JSON.stringify({ ok: true, result: {} });
    if (key === "terminal list") return JSON.stringify({ ok: true, result: {
      terminals: [{ handle: "term", worktreeId: "repo::/wt", worktreePath: "/wt", connected: true, writable: true, agentIdentity: "prime-agent", tabId: "tab", leafId: "leaf" }],
      visualLayouts: [{ worktreeId: "repo::/wt", root: { tabs: [{ panes: { handle: "term" } }] } }],
    } });
    if (key === "terminal read") return JSON.stringify({ ok: true, result: { terminal: { source: "screen", tail: ["← manage model"] } } });
    throw new Error(`unexpected ${args}`);
  };
  const adapter = new CliOrcaAdapter(runner); const setups = await adapter.listReadySetups("/repo");
  const wt = await adapter.createWorktree({ setup: setups[0], name: "episode", baseRef: "base" });
  const auto = await adapter.createLaunchAutomation({ worktreeId: wt.id, name: "launch", prompt: "execute" });
  await adapter.runAutomation(auto); await adapter.removeAutomation(auto);
  const terminals = await adapter.listTerminals(wt.id);
  assert.equal(terminals[0].visible, true); assert.equal(terminals[0].worktreePath, "/wt");
  assert.equal(terminals[0].tabId, "tab"); assert.equal(terminals[0].leafId, "leaf");
  assert.deepEqual(await adapter.readTerminalScreen("term"), { source: "screen", text: "← manage model" });
  const flattened = commands.flat(); assert.equal(flattened.includes("--activate"), false);
  const create = commands.find((args) => args[0] === "worktree"); assert.ok(create.includes("--no-parent")); assert.ok(create.includes("--project-host-setup"));
  const automation = commands.find((args) => args[0] === "automations" && args[1] === "create");
  assert.ok(automation.includes("prime-agent")); assert.ok(automation.includes("--reuse-session")); assert.ok(automation.includes("--disabled"));
});


test("CLI setup inventory stops at supported local project setups", async () => {
  const commands = [];
  const adapter = new CliOrcaAdapter((args) => {
    commands.push(args);
    if (args[0] === "project" && args[1] === "setups") return JSON.stringify({ ok: true, result: { setups: [{ id: "local", projectId: "project", path: "/repo", setupState: "missing" }] } });
    throw new Error(`unexpected unsupported inventory call ${args}`);
  });
  assert.deepEqual(await adapter.listReadySetups("/repo"), []);
  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0].slice(0, 2), ["project", "setups"]);
});


test("reserved task allocates a local worktree from the status commit and assigns execute once", async () => {
  const f = harness({ record: taskReservation() });
  f.filesystem.exists = () => false;
  f.git.head = () => TASK_BASE;
  const result = await allocateReservedTaskEpisode("PRIMECLAW-10.38", f.ctx, f.deps);
  assert.equal(result.version, 2);
  assert.equal(result.status, "active");
  assert.equal(result.reused, false);
  assert.equal(result.head, TASK_BASE);
  const localCreate = f.calls.find((call) => call[0] === "local-create");
  assert.equal(localCreate[3], TASK_BASE);
  const names = f.calls.map((call) => call[0]);
  assert.ok(names.indexOf("ownership") < names.indexOf("local-create"));
  assert.equal(names.filter((name) => name === "fresh").length, 1);
  assert.equal(names.filter((name) => name === "execute").length, 1);
  assert.equal(names.includes("promote"), false);
  assert.equal(names.includes("commit"), false);
  const execute = f.calls.find((call) => call[0] === "execute");
  assert.match(execute[1], /<operator-episode-task>\s*PRIMECLAW-10\.38\s*<\/operator-episode-task>/);
});

test("reserved task allocates through exact Orca placement without bundle promotion", async () => {
  const f = harness({ record: taskReservation({ engine: "orca", projectSetupId: "setup-local" }) });
  bindTaskOrcaHead(f);
  f.orca.listTerminals = async () => [
    { handle: "fallback", connected: true, writable: true, agentIdentity: "shell", worktreeId: f.wt.id, worktreePath: f.wt.path, visible: true },
    { handle: "terminal", connected: true, writable: true, agentIdentity: "prime-agent", worktreeId: f.wt.id, worktreePath: f.wt.path, tabId: "tab", leafId: "leaf", visible: true },
  ];
  const result = await allocateReservedTaskEpisode("PRIMECLAW-10.38", f.ctx, f.deps);
  assert.equal(result.version, 2);
  assert.equal(result.engine, "orca");
  assert.equal(result.status, "active");
  assert.equal(result.head, TASK_BASE);
  assert.deepEqual(result.terminalHandles, ["fallback", "terminal"]);
  const names = f.calls.map((call) => call[0]);
  assert.ok(names.indexOf("ownership") < names.indexOf("orca-create"));
  assert.equal(names.includes("promote"), false);
  assert.equal(names.includes("commit"), false);
  assert.equal(names.includes("fresh"), false);
  assert.equal(names.includes("execute"), false);
  assert.deepEqual(names.filter((name) => name === "auto-run"), ["auto-run"]);
  const automation = f.calls.find((call) => call[0] === "auto-create")[1];
  assert.match(automation.prompt, /<operator-episode-task>\s*PRIMECLAW-10\.38\s*<\/operator-episode-task>/);
});


test("missing reserved Orca setup becomes uncertain without resource creation", async () => {
  const f = harness({ record: taskReservation({ engine: "orca", projectSetupId: "setup-local" }), setups: [] });
  await assert.rejects(
    allocateReservedTaskEpisode("PRIMECLAW-10.38", f.ctx, f.deps),
    /no longer ready/,
  );
  assert.equal(f.record.status, "uncertain");
  assert.equal(f.calls.some((call) => ["orca-create", "auto-create", "auto-run", "fresh", "execute"].includes(call[0])), false);
});

test("active task-native allocation replay validates identity without replaying assignment", async () => {
  const f = harness({ record: taskReservation({ engine: "orca", projectSetupId: "setup-local" }) });
  bindTaskOrcaHead(f);
  await allocateReservedTaskEpisode("PRIMECLAW-10.38", f.ctx, f.deps);
  f.calls.length = 0;
  const result = await allocateReservedTaskEpisode("PRIMECLAW-10.38", f.ctx, f.deps);
  assert.equal(result.status, "active");
  assert.equal(result.reused, true);
  assert.equal(f.calls.some((call) => ["orca-create", "local-create", "auto-create", "auto-run", "fresh", "execute"].includes(call[0])), false);
  assert.equal(f.calls.some((call) => call[0] === "orca-show"), true);
});


test("active task-native replay reopens the durable session with the task-derived name", async () => {
  const f = harness({ record: taskReservation({ engine: "orca", projectSetupId: "setup-local" }) });
  bindTaskOrcaHead(f);
  await allocateReservedTaskEpisode("PRIMECLAW-10.38", f.ctx, f.deps);
  f.calls.length = 0;
  f.publisher.list = async () => [{
    sessionId: "episode",
    sessionFile: join(f.root, "episode.jsonl"),
    cwd: f.worktree,
    isSessionActive: false,
    isStreaming: false,
    isCompacting: false,
    queuedCount: 0,
  }];
  const result = await allocateReservedTaskEpisode("PRIMECLAW-10.38", f.ctx, f.deps);
  assert.equal(result.reused, true);
  const reopen = f.calls.find((call) => call[0] === "reopen");
  assert.equal(reopen[1].sessionName, "primeclaw-10-38-episode");
  assert.equal(f.calls.some((call) => ["orca-create", "auto-create", "auto-run", "execute"].includes(call[0])), false);
});


test("active task-native replay rejects the durable session in a foreign checkout", async () => {
  const f = harness({ record: taskReservation({ engine: "orca", projectSetupId: "setup-local" }) });
  bindTaskOrcaHead(f);
  await allocateReservedTaskEpisode("PRIMECLAW-10.38", f.ctx, f.deps);
  f.calls.length = 0;
  f.publisher.list = async () => [{
    activeSessionId: "foreign-route",
    sessionId: "episode",
    sessionFile: join(f.root, "episode.jsonl"),
    cwd: f.root,
    isSessionActive: false,
    isStreaming: false,
    isCompacting: false,
    queuedCount: 0,
  }];
  await assert.rejects(
    allocateReservedTaskEpisode("PRIMECLAW-10.38", f.ctx, f.deps),
    /not rooted at the owned worktree/,
  );
  assert.equal(f.calls.some((call) => ["reopen", "orca-create", "auto-create", "auto-run", "fresh", "execute"].includes(call[0])), false);
});

test("task-native allocation rejects mismatched ownership before resource mutation", async () => {
  const f = harness({ record: taskReservation() });
  await assert.rejects(
    allocateReservedTaskEpisode("PRIMECLAW-99", f.ctx, f.deps),
    /conflicts on taskId/,
  );
  assert.equal(f.record.status, "provisioning");
  assert.equal(f.calls.some((call) => ["ownership", "orca-create", "local-create", "fresh", "execute"].includes(call[0])), false);
  f.ctx.sessionManager.getSessionId = () => "foreign-owner";
  await assert.rejects(
    allocateReservedTaskEpisode("PRIMECLAW-10.38", f.ctx, f.deps),
    /conflicts on ownerSessionId/,
  );
  assert.equal(f.record.status, "provisioning");
  assert.equal(f.calls.some((call) => ["ownership", "orca-create", "local-create", "fresh", "execute"].includes(call[0])), false);
});

test("partial provisioning becomes uncertain and cannot replay allocation", async () => {
  const f = harness({ record: taskReservation({ worktreeName: "already-derived" }) });
  await assert.rejects(
    allocateReservedTaskEpisode("PRIMECLAW-10.38", f.ctx, f.deps),
    /already contains resource identity/,
  );
  assert.equal(f.record.status, "uncertain");
  assert.equal(f.calls.some((call) => ["orca-create", "local-create", "fresh", "execute"].includes(call[0])), false);
  f.calls.length = 0;
  await assert.rejects(
    allocateReservedTaskEpisode("PRIMECLAW-10.38", f.ctx, f.deps),
    /ownership is uncertain/,
  );
  assert.equal(f.calls.some((call) => ["orca-create", "local-create", "fresh", "execute"].includes(call[0])), false);
});

test("task-native local mutation failure preserves bound identity as uncertain", async () => {
  const f = harness({ record: taskReservation() });
  f.filesystem.exists = () => false;
  f.git.createWorktree = () => { throw new Error("ambiguous task worktree create"); };
  await assert.rejects(
    allocateReservedTaskEpisode("PRIMECLAW-10.38", f.ctx, f.deps),
    /ambiguous task worktree create/,
  );
  assert.equal(f.record.status, "uncertain");
  assert.match(f.record.worktreeName, /primeclaw-10-38-episode-task-ope/);
  assert.match(f.record.branch, /^episode\/primeclaw-10-38-task-ope/);
  assert.equal(f.record.head, TASK_BASE);
  assert.equal(f.calls.some((call) => ["fresh", "execute"].includes(call[0])), false);
});


test("production local cleanup adapter proves exact idle runtime, worktree, and unmerged branch removal", async () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-cleanup-host-"));
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  execFileSync("git", ["-C", root, "config", "user.name", "Fixture"]);
  execFileSync("git", ["-C", root, "config", "user.email", "fixture@example.test"]);
  writeFileSync(join(root, "README.md"), "base\n");
  execFileSync("git", ["-C", root, "add", "README.md"]);
  execFileSync("git", ["-C", root, "commit", "-qm", "base"]);
  const base = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const worktree = join(dirname(root), `${root.split("/").pop()}-cleanup-wt-${Date.now()}`);
  execFileSync("git", ["-C", root, "worktree", "add", "-q", "-b", "episode-cleanup", worktree, base]);
  writeFileSync(join(worktree, "episode.txt"), "terminal\n");
  execFileSync("git", ["-C", worktree, "add", "episode.txt"]);
  execFileSync("git", ["-C", worktree, "commit", "-qm", "episode"]);
  const terminalHead = execFileSync("git", ["-C", worktree, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const sessionFile = join(root, "episode.jsonl"); writeFileSync(sessionFile, "{}\n");
  let rows = [{ activeSessionId: "route", sessionId: "episode", sessionFile, cwd: worktree, isSessionActive: false }];
  const calls = []; let deleteAttempts = 0; let stateCwd = worktree;
  const sessions = {
    async list() { return rows.map((row) => ({ ...row })); },
    async getState() { return { ...rows[0], cwd: stateCwd, isStreaming: false, isCompacting: false, isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false, unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [], active: null } }; },
    async kill(id) { calls.push(["kill", id]); rows = rows.map(({ activeSessionId, ...row }) => row); },
    async deleteSaved(path) {
      calls.push(["delete", path]); deleteAttempts += 1;
      if (deleteAttempts === 1) throw new Error("synthetic uncertain delete");
      if (existsSync(path)) unlinkSync(path); rows = [];
    },
  };
  const record = parseEpisodeOwnership({ version: 2, status: "active", operationId: "op", engine: "local", ownerSessionId: "owner", taskId: "PRIMECLAW-1", taskPath: "backlog/tasks/task.md", baseRef: base, createdAt: "x", updatedAt: "x", worktree, branch: "episode-cleanup", head: base, episodeId: "episode", episodeSessionFile: sessionFile, episodeActiveSessionId: "route" });
  const adapter = new CliTaskEpisodeCleanupAdapter(root, terminalHead, { sessions });
  rows.push({ activeSessionId: "foreign-route", sessionId: "foreign", sessionFile: join(root, "foreign.jsonl"), cwd: worktree, isSessionActive: false });
  await assert.rejects(adapter.inspect(record), /foreign or duplicate Prime Agent session identity/);
  rows.pop();
  stateCwd = root;
  assert.equal((await adapter.inspect(record)).runtime.idle, false);
  stateCwd = worktree;
  let snapshot = await adapter.inspect(record);
  assert.equal(snapshot.runtime.idle, true);
  assert.equal(snapshot.runtime.resources.head, terminalHead);
  assert.equal(snapshot.worktree.head, terminalHead);
  assert.equal(snapshot.branch.head, terminalHead);
  await assert.rejects(adapter.removeRuntime(record), /synthetic uncertain delete/);
  snapshot = await adapter.inspect(record);
  assert.equal(snapshot.runtime.idle, true);
  await adapter.removeRuntime(record);
  snapshot = await adapter.inspect(record);
  assert.equal(snapshot.runtime, undefined);
  assert.ok(snapshot.worktree); assert.ok(snapshot.branch);
  await adapter.removeWorktree(record);
  snapshot = await adapter.inspect(record);
  assert.equal(snapshot.worktree, undefined); assert.ok(snapshot.branch);
  await adapter.removeBranch(record);
  snapshot = await adapter.inspect(record);
  assert.deepEqual(snapshot, {});
  assert.deepEqual(calls, [["kill", "route"], ["delete", sessionFile], ["delete", sessionFile]]);
});

test("production cleanup adapter fails closed when a saved-session file is missing from daemon inventory", async () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-cleanup-untracked-"));
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  execFileSync("git", ["-C", root, "config", "user.name", "Fixture"]);
  execFileSync("git", ["-C", root, "config", "user.email", "fixture@example.test"]);
  writeFileSync(join(root, "README.md"), "base\n"); execFileSync("git", ["-C", root, "add", "."]); execFileSync("git", ["-C", root, "commit", "-qm", "base"]);
  const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const worktree = join(dirname(root), `${root.split("/").pop()}-wt`); execFileSync("git", ["-C", root, "worktree", "add", "-q", "-b", "episode-untracked", worktree, head]);
  const sessionFile = join(root, "untracked.jsonl"); writeFileSync(sessionFile, "{}\n");
  const record = parseEpisodeOwnership({ version: 2, status: "active", operationId: "op", engine: "local", ownerSessionId: "owner", taskId: "PRIMECLAW-1", taskPath: "backlog/tasks/task.md", baseRef: head, createdAt: "x", updatedAt: "x", worktree, branch: "episode-untracked", head, episodeId: "episode", episodeSessionFile: sessionFile, episodeActiveSessionId: "route" });
  const sessions = { async list() { return []; }, async getState() { throw new Error("unused"); } };
  const adapter = new CliTaskEpisodeCleanupAdapter(root, head, { sessions });
  await assert.rejects(adapter.inspect(record), /untracked saved-session file/);
});


test("production Orca cleanup adapter removes one exact terminal-bearing worktree without force", async () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-cleanup-orca-"));
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  execFileSync("git", ["-C", root, "config", "user.name", "Fixture"]); execFileSync("git", ["-C", root, "config", "user.email", "fixture@example.test"]);
  writeFileSync(join(root, "README.md"), "base\n"); execFileSync("git", ["-C", root, "add", "."]); execFileSync("git", ["-C", root, "commit", "-qm", "base"]);
  const base = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const worktree = join(dirname(root), `${root.split("/").pop()}-wt`); execFileSync("git", ["-C", root, "worktree", "add", "-q", "-b", "episode-orca", worktree, base]);
  writeFileSync(join(worktree, "episode.txt"), "head\n"); execFileSync("git", ["-C", worktree, "add", "."]); execFileSync("git", ["-C", worktree, "commit", "-qm", "episode"]);
  const head = execFileSync("git", ["-C", worktree, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const sessionFile = join(root, "orca.jsonl"); writeFileSync(sessionFile, "{}\n");
  let sessionRows = [{ activeSessionId: "route", sessionId: "episode", sessionFile, cwd: worktree, isSessionActive: false }];
  let terminalPresent = true, worktreePresent = true; const calls = [];
  const sessions = {
    async list() { return sessionRows.map((row) => ({ ...row })); },
    async getState() { return { ...sessionRows[0], isStreaming: false, isCompacting: false, isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false, unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [], active: null } }; },
    async kill() { sessionRows = sessionRows.map(({ activeSessionId, ...row }) => row); },
    async deleteSaved() { unlinkSync(sessionFile); sessionRows = []; },
  };
  const runner = { run(command, args, options = {}) {
    if (command === "git") {
      try { return { stdout: execFileSync("git", args, { cwd: options.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), stderr: "", status: 0 }; }
      catch (error) { return { stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? error), status: Number.isInteger(error.status) ? error.status : 1 }; }
    }
    assert.equal(command, "orca"); calls.push(args);
    const ok = (result) => ({ stdout: JSON.stringify({ ok: true, result }), stderr: "", status: 0 });
    if (args[0] === "worktree" && args[1] === "show") {
      if (!worktreePresent) return { stdout: JSON.stringify({ ok: false, error: { code: "selector_not_found", message: "missing" } }), stderr: "", status: 1 };
      return ok({ worktree: { id: "wt", identity: { key: "identity" }, path: worktree, branch: "refs/heads/episode-orca", head, projectHostSetupId: "setup" } });
    }
    if (args[0] === "terminal" && args[1] === "list") return ok({ terminals: terminalPresent ? [
      { handle: "fallback", worktreeId: "wt", worktreePath: worktree, agentIdentity: "shell" },
      { handle: "term", worktreeId: "wt", worktreePath: worktree, agentIdentity: "prime-agent" },
    ] : [] });
    if (args[0] === "terminal" && args[1] === "close") { terminalPresent = false; return ok({ closed: true }); }
    if (args[0] === "worktree" && args[1] === "rm") { execFileSync("git", ["-C", root, "worktree", "remove", "--", worktree]); terminalPresent = false; worktreePresent = false; return ok({ removed: true }); }
    throw new Error(`unexpected Orca command ${args.join(" ")}`);
  } };
  const record = parseEpisodeOwnership({ version: 2, status: "active", operationId: "op", engine: "orca", ownerSessionId: "owner", taskId: "PRIMECLAW-1", taskPath: "backlog/tasks/task.md", baseRef: base, createdAt: "x", updatedAt: "x", projectSetupId: "setup", worktreeId: "wt", worktreeIdentity: "identity", worktree, branch: "episode-orca", head: base, episodeId: "episode", episodeSessionFile: sessionFile, episodeActiveSessionId: "route", terminalHandle: "term", terminalHandles: ["fallback", "term"] });
  const adapter = new CliTaskEpisodeCleanupAdapter(root, head, { sessions, runner });
  assert.ok((await adapter.inspect(record)).runtime);
  await adapter.removeRuntime(record);
  await adapter.removeWorktree(record);
  assert.ok((await adapter.inspect(record)).branch);
  await adapter.removeBranch(record);
  assert.deepEqual(await adapter.inspect(record), {});
  assert.equal(calls.some((args) => args[0] === "terminal" && args[1] === "close"), false);
  const remove = calls.find((args) => args[0] === "worktree" && args[1] === "rm");
  assert.ok(remove.includes("id:wt")); assert.equal(remove.includes("--force"), false);
});


test("Prime cleanup host uses supported kill and delete_saved_session daemon commands", async () => {
  const commands = [];
  const client = {
    async request(command) {
      commands.push(command);
      if (command.type === "kill") return { success: true, data: {} };
      if (command.type === "delete_saved_session") return { success: true, data: { ok: true, method: "unlink" } };
      throw new Error(`unexpected ${command.type}`);
    },
    close() {},
  };
  const publisher = new PrimeSessionPublisher(client);
  await publisher.kill("route");
  await publisher.deleteSaved("/tmp/episode.jsonl");
  assert.deepEqual(commands, [
    { type: "kill", activeSessionId: "route" },
    { type: "delete_saved_session", sessionPath: "/tmp/episode.jsonl" },
  ]);
  const failed = new PrimeSessionPublisher({ async request() { return { success: true, data: { ok: false, error: "refused" } }; }, close() {} });
  await assert.rejects(failed.deleteSaved("/tmp/episode.jsonl"), /refused/);
});
