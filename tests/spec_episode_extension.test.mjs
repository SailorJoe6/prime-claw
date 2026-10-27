import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  CliGitAdapter, CliOrcaAdapter, CliTaskEpisodeAdmissionGit, CliTaskEpisodeCleanupGit, PrimeSessionPublisher,
  EpisodeStateUncertainError, OrcaMutationUncertainError, OrcaUnavailableError,
  allocateReservedTaskEpisode, bundleContentDigest, createSpecEpisode, handoffSpecEpisode,
  restoreBlockedSpecEpisode, transitionSpecEpisodeToTaskOwnership,
  handoffTaskEpisode, resolveBlockedWorkflowAuthority, finalizeTaskEpisodeCleanup,
  verifyActiveTaskEpisodeContinuity,
} from "../src/prime-agent-plugin/extension-support/spec-episode.ts";
import { parseEpisodeOwnership, writeEpisodeOwnership } from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";
import { CliTaskEpisodeCleanupAdapter } from "../src/prime-agent-plugin/extension-support/task-episode-cleanup.ts";
import { createReviewedPlanExtension } from "../src/prime-agent-plugin/extensions/reviewed-plan.ts";
import { reconcileLegacySpecificationInventory } from "../src/prime-agent-plugin/extension-support/legacy-specification-inventory.ts";

const LOCATION = ".ralph/plans/future/alpha";
function diskFixture() {
  const rawRoot = mkdtempSync(join(tmpdir(), "prime-claw-episode-"));
  execFileSync("git", ["init", "-q", rawRoot]);
  const root = realpathSync(rawRoot);
  mkdirSync(join(root, ".ralph", "plans", "future", "alpha"), { recursive: true });
  writeFileSync(join(root, ".ralph", "plans", "future", "alpha", "SPECIFICATION.md"), "spec");
  writeFileSync(join(root, ".ralph", "plans", "future", "alpha", "EXECUTION_PLAN.md"), "plan");
  reconcileLegacySpecificationInventory(root, "initialize");
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
  const disk = diskFixture(); const calls = []; const records = new Map();
  if (options.record) records.set(options.record.ownerSessionId, structuredClone(options.record));
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
  const filesystem = {
    exists: (path) => options.unavailable ? !String(path).includes("-alpha-episode-") : true,
    hasActiveLegacyPlanFiles: () => options.legacyPlanFiles !== false,
    promoteBundle(path) {
      calls.push(["promote", path]);
      const plans = join(path, ".ralph", "plans"); mkdirSync(plans, { recursive: true });
      writeFileSync(join(plans, "SPECIFICATION.md"), readFileSync(join(disk.root, LOCATION, "SPECIFICATION.md")));
      writeFileSync(join(plans, "EXECUTION_PLAN.md"), readFileSync(join(disk.root, LOCATION, "EXECUTION_PLAN.md")));
    },
  };
  const ownership = {
    read(_root, ownerSessionId) { return ownerSessionId ? records.get(ownerSessionId) ?? null : (records.size <= 1 ? [...records.values()][0] ?? null : null); },
    write(_root, value) { records.set(value.ownerSessionId, structuredClone(value)); calls.push(["ownership", value.status]); },
  };
  const published = { activeSessionId: "route", sessionId: "episode", sessionFile: join(disk.root, "episode.jsonl") };
  let listCount = 0;
  const session = { ...published, cwd: disk.worktree, sessionName: "alpha-episode", isSessionActive: false, isStreaming: false, isCompacting: false, queuedCount: 0 };
  const publisher = {
    async list() { listCount += 1; return options.list ? options.list(listCount, session) : (listCount === 1 ? [] : [session]); },
    async getState() { return { ...session, isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false, unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [], active: null } }; },
    async createFresh(args) { calls.push(["fresh", args]); await args.onAllocated?.({ sessionId: published.sessionId, sessionFile: published.sessionFile }); return published; },
    async reopen(args) { calls.push(["reopen", args]); return published; },
    async deliverExecute(_route, prompt) { calls.push(["execute", prompt]); },
    async deliverHandoff(_route, handoff, execute, onHandoffAdmitted) {
      if (options.handoffBeforeAdmissionError) throw options.handoffBeforeAdmissionError;
      calls.push(["handoff", handoff, execute]);
      await onHandoffAdmitted?.();
      if (options.handoffAfterAdmissionError) throw options.handoffAfterAdmissionError;
    },
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
  return { ...disk, wt, calls, git, filesystem, ownership, publisher, orca, ctx, deps: { git, filesystem, ownership, publisher, orca, wait: async () => {}, bindingAttempts: 1 }, get record() { return records.get("owner") ?? null; } };
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
const BEADS_TASK_ID = "BEADS-42";
const BEADS_REVISION = "a".repeat(32);
const BEADS_TASK_EVIDENCE = {
  id: BEADS_TASK_ID,
  title: "Native handoff",
  status: "in_progress",
  description: "Continue one retained native task",
  design: "Implement the bounded active-Beads handoff route.",
  acceptance_criteria: "One handoff and one execute follow-up.",
  notes: "Retain exact raw evidence.",
};
function activeBeadsTaskRecord(f, overrides = {}) {
  return parseEpisodeOwnership({
    version: 2,
    provider: "beads",
    status: "active",
    operationId: "beads-task-operation",
    engine: "local",
    ownerSessionId: "owner",
    taskId: BEADS_TASK_ID,
    providerRevision: BEADS_REVISION,
    taskEvidence: BEADS_TASK_EVIDENCE,
    baseRef: TASK_BASE,
    createdAt: "2026-10-20T08:00:00.000Z",
    updatedAt: "2026-10-20T08:00:00.000Z",
    worktreeName: "prime-claw-beads-42-episode",
    worktree: f.worktree,
    branch: f.wt.branch,
    head: TASK_BASE,
    episodeId: "episode",
    episodeSessionFile: join(f.root, "episode.jsonl"),
    episodeActiveSessionId: "route",
    ...overrides,
  });
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
  const plans = join(f.worktree, ".ralph", "plans");
  mkdirSync(plans, { recursive: true });
  writeFileSync(join(plans, "SPECIFICATION.md"), readFileSync(join(f.root, LOCATION, "SPECIFICATION.md")));
  writeFileSync(join(plans, "EXECUTION_PLAN.md"), readFileSync(join(f.root, LOCATION, "EXECUTION_PLAN.md")));
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
  }), /ownership is missing/);
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

test("single ready setup bypasses picker and passes the owning Conversation key", async () => {
  const f = harness(); await createApproved(f);
  assert.equal(f.calls.some((call) => call[0] === "picker"), false);
  const prompt = f.calls.find((call) => call[0] === "auto-create")[1].prompt;
  assert.match(prompt, /<operator-episode-owner-session>\s*owner\s*<\/operator-episode-owner-session>/);
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

test("active replay refreshes route without source-folder dependence or assignment replay", async () => {
  const f0 = harness(); const active = await createApproved(f0);
  const f = harness({ record: { ...active, reused: undefined }, list: () => [{ sessionId: "episode", sessionFile: active.episodeSessionFile, cwd: active.worktree }] });
  f.git.entries = [{ path: f.root, branch: "main" }, { path: active.worktree, branch: active.branch }];
  f.filesystem.exists = () => true; f.orca.showWorktree = async () => ({ ...f.wt, id: active.worktreeId, identity: active.worktreeIdentity, path: active.worktree, branch: active.branch, projectSetupId: active.projectSetupId, head: active.head });
  rmSync(join(f.root, ".ralph", "plans", "future", "alpha"), { recursive: true, force: true });
  const result = await createSpecEpisode(LOCATION, "tool", f.ctx, f.deps, { approvedBundleDigest: "0".repeat(64) });
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
  assert.match(call[1], /<operator-episode-owner-session>\s*owner\s*<\/operator-episode-owner-session>/);
  assert.match(call[2], /<operator-episode-owner-session>\s*owner\s*<\/operator-episode-owner-session>/);
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
  writeFileSync(join(active.worktree, ".ralph", "plans", "SPECIFICATION.md"), "spec");
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

test("retained handoff rejects a changed promoted specification before delivery", async () => {
  const created = harness(); const active = await createApproved(created);
  const f = harness({ record: { ...active, reused: undefined }, list: () => [{ activeSessionId: "route", sessionId: "episode", sessionFile: active.episodeSessionFile, cwd: active.worktree, isSessionActive: false, isStreaming: false, isCompacting: false, queuedCount: 0 }] });
  f.git.entries = [{ path: f.root, branch: "main" }, { path: active.worktree, branch: active.branch }];
  f.orca.showWorktree = async () => ({ ...f.wt, id: active.worktreeId, identity: active.worktreeIdentity, path: active.worktree, branch: active.branch, projectSetupId: active.projectSetupId, head: active.head });
  writeFileSync(join(active.worktree, ".ralph", "plans", "SPECIFICATION.md"), "changed\n");
  await assert.rejects(handoffSpecEpisode(LOCATION, "continue", f.ctx, f.deps), /changed after grandfathering/);
  assert.equal(f.calls.some((call) => call[0] === "handoff"), false);
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
  const plans=join(f.worktree,".ralph/plans");
  for (const name of ["SPECIFICATION.md","IMPLEMENTATION_PLAN.md","EXECUTION_PLAN.md"]) rmSync(join(plans,name),{force:true});
  const blocked=join(plans,"blocked");mkdirSync(blocked,{recursive:true});
  writeFileSync(join(blocked,"SPECIFICATION.md"),"spec");
  writeFileSync(join(blocked,planName),"recorded blocker and unblock condition\n");
}
function writeActiveLegacyPair(f) {
  const plans=join(f.worktree,".ralph/plans");mkdirSync(plans,{recursive:true});
  writeFileSync(join(plans,"SPECIFICATION.md"),"spec");
  writeFileSync(join(plans,"EXECUTION_PLAN.md"),"active plan\n");
}

test("operator-cleared blocked pair restores and continues the same version-one Episode after its source is absent", async () => {
  const f=harness();await createApproved(f);f.calls.length=0;useDiskLegacyGate(f);writeBlockedLegacyPair(f);
  const identity=structuredClone(f.record);
  rmSync(join(f.root, ".ralph", "plans", "future", "alpha"), { recursive: true, force: true });
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
  await t.test("changed blocked specification is rejected before either file moves",async()=>{
    const f=harness();await createApproved(f);useDiskLegacyGate(f);writeBlockedLegacyPair(f);
    writeFileSync(join(f.worktree,".ralph/plans/blocked/SPECIFICATION.md"),"changed\n");
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,f.ctx,f.deps),/changed after grandfathering/);
    assert.equal(existsSync(join(f.worktree,".ralph/plans/blocked/SPECIFICATION.md")),true);
    assert.equal(existsSync(join(f.worktree,".ralph/plans/SPECIFICATION.md")),false);
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
    const foreign=harness();await createApproved(foreign);useDiskLegacyGate(foreign);writeBlockedLegacyPair(foreign);
    foreign.ctx.sessionManager.getSessionId=()=>"other";
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,foreign.ctx,foreign.deps),/No durable episode ownership/);
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
    const incomplete=harness();await createApproved(incomplete);useDiskLegacyGate(incomplete);writeBlockedLegacyPair(incomplete);const blocked=join(incomplete.worktree,".ralph/plans/blocked");rmSync(join(blocked,"EXECUTION_PLAN.md"),{force:true});
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,incomplete.ctx,incomplete.deps),/exactly one implementation plan/);
    const empty=harness();await createApproved(empty);useDiskLegacyGate(empty);writeBlockedLegacyPair(empty);writeFileSync(join(empty.worktree,".ralph/plans/blocked/EXECUTION_PLAN.md"),"");
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,empty.ctx,empty.deps),/(?:readable non-empty regular specification|changed after grandfathering)/);
  });
  await t.test("ambiguous plan spelling is rejected",async()=>{
    const f=harness();await createApproved(f);useDiskLegacyGate(f);writeBlockedLegacyPair(f);writeFileSync(join(f.worktree,".ralph/plans/blocked/IMPLEMENTATION_PLAN.md"),"second plan\n");
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,f.ctx,f.deps),/exactly one implementation plan/);
  });
  await t.test("symlinked blocked input is rejected",async()=>{
    const f=harness();await createApproved(f);useDiskLegacyGate(f);writeBlockedLegacyPair(f);unlinkSync(join(f.worktree,".ralph/plans/blocked/SPECIFICATION.md"));symlinkSync(join(f.root,".ralph/plans/future/alpha/SPECIFICATION.md"),join(f.worktree,".ralph/plans/blocked/SPECIFICATION.md"));
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,f.ctx,f.deps),/(?:readable non-empty regular specification|changed after grandfathering)/);
  });
  await t.test("symlinked lifecycle directory is rejected",async()=>{
    const f=harness();await createApproved(f);useDiskLegacyGate(f);writeBlockedLegacyPair(f);const blocked=join(f.worktree,".ralph/plans/blocked"), external=join(f.root,"external-blocked");rmSync(blocked,{recursive:true,force:true});mkdirSync(external);writeFileSync(join(external,"SPECIFICATION.md"),"blocked spec\n");writeFileSync(join(external,"EXECUTION_PLAN.md"),"blocked plan\n");symlinkSync(external,blocked,"dir");
    await assert.rejects(restoreBlockedSpecEpisode(LOCATION,true,f.ctx,f.deps),/(?:real in-worktree lifecycle directories|changed after grandfathering)/);
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
  f.ownership.write(f.root, activeTaskRecord(f, {
    ownerSessionId: "other-owner", taskId: "PRIMECLAW-10.39", taskPath: "backlog/tasks/primeclaw-10.39.md",
    operationId: "other-operation", worktree: join(f.root, "other-worktree"), branch: "other-branch",
    episodeId: "other-episode", episodeSessionFile: join(f.root, "other.jsonl"), episodeActiveSessionId: "other-route",
  }));
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
  assert.match(call[1], /<operator-episode-owner-session>\s*owner\s*<\/operator-episode-owner-session>/);
  assert.match(call[2], /<operator-episode-owner-session>\s*owner\s*<\/operator-episode-owner-session>/);
  assert.match(call[2], /EXECUTE POLICY/);
  assert.doesNotMatch(call[2], /resume the accepted in-scope revision/);
  assert.equal(f.calls.some((value) => ["fresh", "execute", "promote", "local-create", "orca-create"].includes(value[0])), false);
});

test("registered active Beads handoff delivers owner-authored published design and notes observations to the existing workflow", async () => {
  const f = harness({ list: (_count, session) => [session] });
  const initial = activeBeadsTaskRecord(f);
  f.ownership.write(f.root, initial);
  f.calls.length = 0;
  const currentHead = "b".repeat(40);
  const publishedRevision = "b".repeat(32);
  const currentEvidence = {
    ...BEADS_TASK_EVIDENCE,
    design: "Owner-authored published design update.",
    notes: "Owner-authored published notes update.",
  };
  f.git.head = (path) => path === f.worktree ? currentHead : "main-head";
  let advanceInput;
  const advanceBeadsEvidence = (input) => {
    advanceInput = structuredClone(input);
    f.calls.push(["advance", input]);
    const advanced = parseEpisodeOwnership({
      ...f.record,
      providerRevision: publishedRevision,
      taskEvidence: currentEvidence,
      head: input.episodeHead,
      updatedAt: "2026-10-20T09:00:00.000Z",
    });
    return {
      record: advanced,
      previousProviderRevision: input.previousProviderRevision,
      publishedProviderRevision: publishedRevision,
      previousTaskEvidence: input.previousTaskEvidence,
      currentTaskEvidence: currentEvidence,
      commit() { f.ownership.write(f.root, advanced); return advanced; },
    };
  };
  const tools = new Map();
  createReviewedPlanExtension({ ...f.deps, advanceBeadsEvidence })({
    registerCommand() {},
    registerTool(tool) { tools.set(tool.name, tool); },
    on() {},
    sendUserMessage() {},
    async sendMessage() {},
  });
  const toolResult = await tools.get("handoff_task_episode").execute(
    "handoff", { taskId: BEADS_TASK_ID, guidance: "bounded continuation focus" }, undefined, undefined, f.ctx,
  );
  const result = toolResult.details;
  assert.equal(toolResult.isError, undefined);
  assert.match(toolResult.content[0].text, /handoff admitted/);
  assert.equal(result.admitted, true);
  assert.equal(result.taskId, BEADS_TASK_ID);
  assert.deepEqual(advanceInput, {
    projectRoot: f.root,
    ownerSessionId: "owner",
    taskId: BEADS_TASK_ID,
    previousProviderRevision: BEADS_REVISION,
    previousTaskEvidence: BEADS_TASK_EVIDENCE,
    episodeHead: currentHead,
  });
  assert.equal(Object.hasOwn(advanceInput, "guidance"), false);
  assert.equal(f.record.providerRevision, publishedRevision);
  assert.deepEqual(f.record.taskEvidence, currentEvidence);
  assert.equal(f.record.head, currentHead);
  for (const key of [
    "operationId", "engine", "ownerSessionId", "taskId", "baseRef", "worktreeName", "worktree",
    "branch", "episodeId", "episodeSessionFile", "episodeActiveSessionId",
  ]) assert.deepEqual(f.record[key], initial[key], key);
  const deliveries = f.calls.filter((call) => call[0] === "handoff");
  assert.equal(deliveries.length, 1);
  assert.ok(f.calls.findIndex((call) => call[0] === "advance") < f.calls.findIndex((call) => call[0] === "handoff"));
  assert.match(deliveries[0][1], /bounded continuation focus/);
  assert.match(deliveries[0][1], /<operator-episode-task>\s*BEADS-42\s*<\/operator-episode-task>/);
  assert.match(deliveries[0][2], /<operator-episode-task>\s*BEADS-42\s*<\/operator-episode-task>/);
  assert.doesNotMatch(deliveries[0][2], /bounded continuation focus/);
  for (const prompt of [deliveries[0][1], deliveries[0][2]]) {
    assert.match(prompt, /<provider-task-observation>/);
    assert.ok(prompt.includes(JSON.stringify(BEADS_TASK_EVIDENCE)));
    assert.ok(prompt.includes(JSON.stringify(currentEvidence)));
    assert.match(prompt, /records observations, not semantic acceptance or a new authority/);
  }
  assert.equal(f.calls.some((call) => ["fresh", "execute", "orca-create"].includes(call[0])), false);
});

test("registered active Beads handoff delivers compatible outside same-task native changes without another authorization interface", async () => {
  const f = harness({ list: (_count, session) => [session] });
  const longTailMarker = "provider-native-long-tail-marker-9f6d8d1f";
  const previous = {
    ...BEADS_TASK_EVIDENCE,
    provider_native_tail: {
      marker: longTailMarker,
      opaque_values: ["previous-tail-alpha", { nested: "previous-tail-omega" }],
    },
  };
  const initial = activeBeadsTaskRecord(f, { taskEvidence: previous });
  f.ownership.write(f.root, initial);
  f.calls.length = 0;
  const currentHead = "b".repeat(40);
  const publishedProviderRevision = "b".repeat(32);
  const current = {
    ...previous,
    notes: "Compatible outside same-task note for the existing approved scope.",
    provider_native_tail: {
      ...previous.provider_native_tail,
      current_only: "current-tail-zeta",
    },
  };
  f.git.head = (path) => path === f.worktree ? currentHead : "main-head";
  const advanceBeadsEvidence = (input) => {
    f.calls.push(["advance", input]);
    const advanced = parseEpisodeOwnership({
      ...f.record,
      providerRevision: publishedProviderRevision,
      taskEvidence: current,
      head: input.episodeHead,
      updatedAt: "2026-10-20T09:00:00.000Z",
    });
    return {
      record: advanced,
      previousProviderRevision: input.previousProviderRevision,
      publishedProviderRevision,
      previousTaskEvidence: input.previousTaskEvidence,
      currentTaskEvidence: current,
      commit() { f.ownership.write(f.root, advanced); return advanced; },
    };
  };
  const tools = new Map();
  createReviewedPlanExtension({ ...f.deps, advanceBeadsEvidence })({
    registerCommand() {},
    registerTool(tool) { tools.set(tool.name, tool); },
    on() {},
    sendUserMessage() {},
    async sendMessage() {},
  });
  const toolResult = await tools.get("handoff_task_episode").execute(
    "handoff", { taskId: BEADS_TASK_ID, guidance: "continue compatible scope" }, undefined, undefined, f.ctx,
  );
  const result = toolResult.details;
  assert.equal(toolResult.isError, undefined);
  assert.match(toolResult.content[0].text, /handoff admitted/);
  assert.equal(result.admitted, true);
  assert.equal(result.handoffDelivery, "prompt");
  assert.equal(result.executeDelivery, "followUp");
  assert.deepEqual(f.record.taskEvidence, current);
  const deliveries = f.calls.filter((call) => call[0] === "handoff");
  assert.equal(deliveries.length, 1);
  for (const prompt of [deliveries[0][1], deliveries[0][2]]) {
    assert.ok(prompt.includes(JSON.stringify(previous)));
    assert.ok(prompt.includes(JSON.stringify(current)));
    assert.match(prompt, new RegExp(longTailMarker));
    assert.match(prompt, new RegExp(BEADS_REVISION));
    assert.match(prompt, new RegExp(publishedProviderRevision));
  }
  assert.equal(f.calls.some((call) => ["execute", "reopen"].includes(call[0])), false);
});

test("active Beads handoff resumes from a factual blocked observation when current native state is in progress", async () => {
  const f = harness({ list: (_count, session) => [session] });
  const previous = {
    ...BEADS_TASK_EVIDENCE,
    status: "blocked",
    notes: "Accepted blocker: wait for exact native dependency. Unblock when the dependency is published.",
  };
  const initial = activeBeadsTaskRecord(f, { taskEvidence: previous });
  f.ownership.write(f.root, initial);
  f.calls.length = 0;
  const publishedProviderRevision = "b".repeat(32);
  const current = {
    ...previous,
    status: "in_progress",
    notes: `${previous.notes}
Cleared: exact native dependency is published.`,
  };
  f.git.head = (path) => path === f.worktree ? "b".repeat(40) : "main-head";
  const advanceBeadsEvidence = (input) => {
    assert.equal(input.previousTaskEvidence.status, "blocked");
    const advanced = parseEpisodeOwnership({
      ...f.record,
      providerRevision: publishedProviderRevision,
      taskEvidence: current,
      head: input.episodeHead,
      updatedAt: "2026-10-20T09:00:00.000Z",
    });
    return {
      record: advanced,
      previousProviderRevision: input.previousProviderRevision,
      publishedProviderRevision,
      previousTaskEvidence: input.previousTaskEvidence,
      currentTaskEvidence: current,
      commit() { f.ownership.write(f.root, advanced); return advanced; },
    };
  };

  const result = await handoffTaskEpisode(
    BEADS_TASK_ID, "resume after accepted unblock", f.ctx, { ...f.deps, advanceBeadsEvidence },
  );
  assert.equal(result.admitted, true);
  assert.equal(f.record.providerRevision, publishedProviderRevision);
  assert.equal(f.record.taskEvidence.status, "in_progress");
  assert.equal(f.record.worktree, initial.worktree);
  assert.equal(f.record.episodeId, initial.episodeId);
  assert.equal(f.calls.filter((call) => call[0] === "handoff").length, 1);
});

test("active Beads handoff commits factual observations only after the first canonical message is admitted", async (t) => {
  const scenario = (options) => {
    const f = harness({ list: (_count, session) => [session], ...options });
    const initial = activeBeadsTaskRecord(f);
    f.ownership.write(f.root, initial);
    f.calls.length = 0;
    const currentHead = "b".repeat(40);
    const publishedProviderRevision = "b".repeat(32);
    const current = { ...BEADS_TASK_EVIDENCE, notes: "outside factual change marker admission-sequence" };
    f.git.head = (path) => path === f.worktree ? currentHead : "main-head";
    const advanceBeadsEvidence = (input) => {
      const advanced = parseEpisodeOwnership({
        ...f.record,
        providerRevision: publishedProviderRevision,
        taskEvidence: current,
        head: input.episodeHead,
        updatedAt: "2026-10-20T09:00:00.000Z",
      });
      return {
        record: advanced,
        previousProviderRevision: input.previousProviderRevision,
        publishedProviderRevision,
        previousTaskEvidence: input.previousTaskEvidence,
        currentTaskEvidence: current,
        commit() { f.ownership.write(f.root, advanced); return advanced; },
      };
    };
    return { f, initial, current, advanceBeadsEvidence };
  };

  await t.test("definite first-send rejection preserves the prior observation", async () => {
    const { f, initial, advanceBeadsEvidence } = scenario({
      handoffBeforeAdmissionError: new Error("first handoff rejected"),
    });
    await assert.rejects(handoffTaskEpisode(BEADS_TASK_ID, "continue", f.ctx, {
      ...f.deps, advanceBeadsEvidence,
    }), /first handoff rejected/);
    assert.deepEqual(f.record, initial);
    assert.equal(f.calls.some((call) => call[0] === "handoff"), false);
  });

  await t.test("follow-up rejection retains the current observation after exact handoff delivery", async () => {
    const { f, current, advanceBeadsEvidence } = scenario({
      handoffAfterAdmissionError: new Error("execute follow-up rejected"),
    });
    await assert.rejects(handoffTaskEpisode(BEADS_TASK_ID, "continue", f.ctx, {
      ...f.deps, advanceBeadsEvidence,
    }), /execute follow-up rejected/);
    assert.deepEqual(f.record.taskEvidence, current);
    const deliveries = f.calls.filter((call) => call[0] === "handoff");
    assert.equal(deliveries.length, 1);
    assert.ok(deliveries[0][1].includes(JSON.stringify(BEADS_TASK_EVIDENCE)));
    assert.ok(deliveries[0][1].includes(JSON.stringify(current)));
  });
});

test("active Beads task handoff rejects foreign, busy, and dirty native evidence before delivery", async (t) => {
  await t.test("foreign owner", async () => {
    const f = harness({ list: (_count, session) => [session] });
    f.ownership.write(f.root, activeBeadsTaskRecord(f));
    f.ctx.sessionManager.getSessionId = () => "foreign-owner";
    let advances = 0;
    await assert.rejects(handoffTaskEpisode(BEADS_TASK_ID, "continue", f.ctx, {
      ...f.deps, advanceBeadsEvidence() { advances += 1; throw new Error("must not run"); },
    }), /No durable task-native Episode ownership/);
    assert.equal(advances, 0);
    assert.equal(f.calls.some((call) => call[0] === "handoff"), false);
  });
  await t.test("busy Episode", async () => {
    const f = harness({ list: (_count, session) => [{ ...session, isSessionActive: true }] });
    f.ownership.write(f.root, activeBeadsTaskRecord(f));
    let advances = 0;
    await assert.rejects(handoffTaskEpisode(BEADS_TASK_ID, "continue", f.ctx, {
      ...f.deps, advanceBeadsEvidence() { advances += 1; throw new Error("must not run"); },
    }), /Owned Episode is busy/);
    assert.equal(advances, 0);
    assert.equal(f.calls.some((call) => call[0] === "handoff"), false);
  });
  await t.test("dirty native evidence", async () => {
    const f = harness({ list: (_count, session) => [session] });
    f.ownership.write(f.root, activeBeadsTaskRecord(f));
    let advances = 0;
    await assert.rejects(handoffTaskEpisode(BEADS_TASK_ID, "continue", f.ctx, {
      ...f.deps,
      advanceBeadsEvidence() {
        advances += 1;
        throw new Error("native publication proof is blocked: selected Dolt working set has uncommitted changes");
      },
    }), /Dolt working set has uncommitted changes/);
    assert.equal(advances, 1);
    assert.equal(f.calls.some((call) => call[0] === "handoff"), false);
  });
});

test("blocked workflow authority routes owner Conversation to task mode and never falls back from version 2", () => {
  const f = harness();
  f.ownership.write(f.root, activeTaskRecord(f));
  assert.deepEqual(
    resolveBlockedWorkflowAuthority(undefined, f.ctx, f.deps),
    {
      mode: "task",
      provider: "backlog",
      taskId: "PRIMECLAW-10.38",
      taskPath: "backlog/tasks/primeclaw-10.38.md",
      projectRoot: f.root,
    },
  );
  assert.equal(resolveBlockedWorkflowAuthority("PRIMECLAW-10.38", f.ctx, f.deps).mode, "task");
  assert.throws(
    () => resolveBlockedWorkflowAuthority("OTHER-1", f.ctx, f.deps),
    /does not match the exact owned provider task/,
  );
  f.ownership.write(f.root, activeTaskRecord(f, {
    ownerSessionId: "foreign", taskId: "PRIMECLAW-10.39", taskPath: "backlog/tasks/primeclaw-10.39.md",
    operationId: "foreign-operation", worktree: join(f.root, "foreign-worktree"), branch: "foreign-branch",
    episodeId: "foreign-episode", episodeSessionFile: join(f.root, "foreign.jsonl"), episodeActiveSessionId: "foreign-route",
  }));
  const foreign = {
    ...f.ctx,
    sessionManager: { ...f.ctx.sessionManager, getSessionId: () => "foreign" },
  };
  assert.deepEqual(resolveBlockedWorkflowAuthority(undefined, foreign, f.deps), {
    mode: "task", provider: "backlog", taskId: "PRIMECLAW-10.39", taskPath: "backlog/tasks/primeclaw-10.39.md", projectRoot: f.root,
  });

  f.ownership.write(f.root, activeBeadsTaskRecord(f));
  assert.deepEqual(resolveBlockedWorkflowAuthority(BEADS_TASK_ID, f.ctx, f.deps), {
    mode: "task", provider: "beads", taskId: BEADS_TASK_ID, projectRoot: f.root,
    providerRevision: BEADS_REVISION, taskEvidence: BEADS_TASK_EVIDENCE,
  });
  assert.throws(
    () => resolveBlockedWorkflowAuthority("OTHER-1", f.ctx, f.deps),
    /does not match the exact owned provider task/,
  );
  const foreignBeads = {
    ...f.ctx,
    sessionManager: { ...f.ctx.sessionManager, getSessionId: () => "foreign" },
  };
  assert.throws(
    () => resolveBlockedWorkflowAuthority(BEADS_TASK_ID, foreignBeads, f.deps),
    /does not match the exact owned provider task/,
  );
  const episode = { ...f.ctx, cwd: f.worktree };
  assert.throws(
    () => resolveBlockedWorkflowAuthority(BEADS_TASK_ID, episode, f.deps),
    /repository root/,
  );

  const noTaskOwnership = harness();
  assert.equal(resolveBlockedWorkflowAuthority(undefined, noTaskOwnership.ctx, noTaskOwnership.deps).mode, "folder");
  assert.throws(
    () => resolveBlockedWorkflowAuthority("PRIMECLAW-10.38", noTaskOwnership.ctx, noTaskOwnership.deps),
    /requires active version-2 Episode ownership/,
  );
  const legacyOwnership = harness();
  legacyOwnership.ownership.write(legacyOwnership.root, parseEpisodeOwnership({
    version:1,status:"active",operationId:"legacy",engine:"local",ownerSessionId:"owner",
    sourceLocation:LOCATION,slug:"alpha",baseRef:"base",bundleDigest:"0".repeat(64),
    createdAt:"x",updatedAt:"x",worktree:legacyOwnership.worktree,branch:legacyOwnership.wt.branch,head:"head",
    episodeId:"legacy-episode",episodeSessionFile:join(legacyOwnership.root,"legacy.jsonl"),episodeActiveSessionId:"legacy-route",
  }));
  assert.equal(resolveBlockedWorkflowAuthority("not a canonical task id", legacyOwnership.ctx, legacyOwnership.deps).mode,"folder");

  const provisioning = harness({ record: taskReservation() });
  assert.throws(
    () => resolveBlockedWorkflowAuthority(undefined, provisioning.ctx, provisioning.deps),
    /requires active ownership; found provisioning/,
  );
});

test("canonical-main cleanup guard allows required untracked state but rejects tracked drift", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-cleanup-main-")));
  try {
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
    writeFileSync(join(root, "tracked.txt"), "clean\n");
    execFileSync("git", ["add", "tracked.txt"], { cwd: root });
    execFileSync("git", ["commit", "-q", "-m", "base"], { cwd: root });
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    writeEpisodeOwnership(root, {
      version: 2, status: "active", operationId: "op", engine: "local", ownerSessionId: "owner",
      taskId: "PRIMECLAW-10.38", taskPath: "backlog/tasks/primeclaw-10.38.md", baseRef: head,
      createdAt: "2026-10-18T00:00:00.000Z", updatedAt: "2026-10-18T00:00:00.000Z",
      worktree: join(root, "episode"), branch: "episode", head, episodeId: "episode",
      episodeSessionFile: join(root, "episode.jsonl"), episodeActiveSessionId: "route",
    });
    mkdirSync(join(root, ".ralph", "plans", "archive", "replace-beads"), { recursive: true });
    writeFileSync(join(root, ".ralph", "plans", "archive", "replace-beads", "SPECIFICATION.md"), "protected spec\n");
    writeFileSync(join(root, ".ralph", "plans", "archive", "replace-beads", "EXECUTION_PLAN.md"), "protected plan\n");
    const guard = new CliTaskEpisodeCleanupGit();
    assert.doesNotThrow(() => guard.assertCleanWorktree(root));

    writeFileSync(join(root, "tracked.txt"), "dirty\n");
    assert.throws(() => guard.assertCleanWorktree(root), /without staged or tracked changes/);
    execFileSync("git", ["checkout", "--", "tracked.txt"], { cwd: root });
    writeFileSync(join(root, "tracked.txt"), "staged\n");
    execFileSync("git", ["add", "tracked.txt"], { cwd: root });
    assert.throws(() => guard.assertCleanWorktree(root), /without staged or tracked changes/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function cleanupHarness(outcome = "merged", options = {}) {
  const f = harness({ list: (_count, session) => [session] });
  const episodeHead = "b".repeat(40);
  const mainHead = "c".repeat(40);
  const record = activeTaskRecord(f, options.record ?? {});
  const foreign = activeTaskRecord(f, {
    ownerSessionId: "foreign-owner", taskId: "PRIMECLAW-10.39", taskPath: "backlog/tasks/primeclaw-10.39.md",
    operationId: "foreign-operation", worktree: join(f.root, "foreign-worktree"), branch: "foreign-branch",
    episodeId: "foreign-episode", episodeSessionFile: join(f.root, "foreign.jsonl"), episodeActiveSessionId: "foreign-route",
  });
  const records = new Map([[record.ownerSessionId, record], [foreign.ownerSessionId, foreign]]);
  const calls = [];
  const state = {
    runtime: { cwd: f.worktree, idle: !options.busy },
    worktree: { path: f.worktree, branch: f.wt.branch, head: episodeHead, clean: !options.dirtyEpisode },
    branch: { name: f.wt.branch, head: episodeHead },
  };
  if (options.upstream || options.unpushedEpisode) state.upstream = { remote: "delivery", ref: "refs/heads/published-episode", head: options.unpushedEpisode ? "d".repeat(40) : episodeHead };
  for (const resource of options.absent ?? []) delete state[resource];
  const ownership = {
    read(_root, ownerSessionId) { return structuredClone(records.get(ownerSessionId) ?? null); },
    removeTask(_root, expected) {
      assert.deepEqual(records.get(expected.ownerSessionId), expected, "ownership changed during cleanup");
      assert.deepEqual(state, {}, "owner removal requires every resource absent");
      records.delete(expected.ownerSessionId); calls.push(["remove-owner"]);
    },
  };
  const cleanupGit = {
    repositoryRoot: () => f.root,
    branch: () => "main",
    head: () => mainHead,
    upstreamHead: () => options.unpushed ? "d".repeat(40) : mainHead,
    assertCleanWorktree() { calls.push(["clean"]); if (options.dirty) throw new Error("dirty main"); },
    isAncestor(_repo, ancestor, descendant) {
      if (ancestor === TASK_BASE && descendant === episodeHead) return !options.foreignBase;
      if (ancestor === episodeHead && descendant === mainHead) return outcome === "merged" && !options.unmerged;
      return false;
    },
    pathTrackedAtRef(_repo, ref, path) {
      assert.equal(ref, mainHead);
      if (outcome !== "abandoned" || options.notArchived) return path === "backlog/tasks/primeclaw-10.38.md";
      return path === "backlog/archive/tasks/primeclaw-10.38.md";
    },
  };
  const cleanup = {
    async inspect() { calls.push(["inspect"]); return structuredClone(state); },
    async removeRuntime() { calls.push(["remove-runtime"]); delete state.runtime; },
    async removeUpstream() { calls.push(["remove-upstream"]); delete state.upstream; },
    async removeWorktree() { calls.push(["remove-worktree"]); assert.equal(state.upstream, undefined, "upstream must be absent before provider worktree removal"); delete state.worktree; },
    async removeBranch() { calls.push(["remove-branch"]); delete state.branch; },
  };
  const taskResolver = (cwd) => taskSelection(f, { projectRoot: cwd, status: options.taskStatus ?? "Done" });
  return {
    f, episodeHead, calls, ownership, cleanupGit, cleanup, taskResolver, state, records,
    get record() { return records.get("owner"); },
    get foreignRecord() { return records.get("foreign-owner"); },
    deps: { ownership, cleanupGit, cleanup, taskResolver },
  };
}

function beadsCleanupHarness(outcome = "merged", options = {}) {
  const f = harness({ list: (_count, session) => [session] });
  const episodeHead = "b".repeat(40);
  const mainHead = "c".repeat(40);
  const providerRevision = "c".repeat(32);
  const record = activeBeadsTaskRecord(f, { head: "9".repeat(40), ...(options.record ?? {}) });
  const records = new Map([[record.ownerSessionId, record]]);
  const calls = [];
  const state = {
    runtime: { cwd: f.worktree, idle: !options.busy },
    worktree: { path: f.worktree, branch: f.wt.branch, head: options.wrongHead ? "d".repeat(40) : episodeHead, clean: !options.dirtyEpisode },
    branch: { name: f.wt.branch, head: episodeHead },
  };
  if (options.upstream || options.remoteEpisodeHead) state.upstream = {
    remote: "delivery", ref: "refs/heads/published-beads-episode", head: options.remoteEpisodeHead ?? episodeHead,
  };
  for (const resource of options.absent ?? []) delete state[resource];
  const ownership = {
    read(_root, ownerSessionId) { return structuredClone(records.get(ownerSessionId) ?? null); },
    removeTask(_root, expected) {
      assert.deepEqual(records.get(expected.ownerSessionId), expected, "ownership changed during cleanup");
      assert.deepEqual(state, {}, "owner removal requires every resource absent");
      records.delete(expected.ownerSessionId); calls.push(["remove-owner"]);
    },
  };
  const cleanupGit = {
    repositoryRoot: () => f.root,
    branch: () => "main",
    head: () => mainHead,
    upstreamHead: () => options.unpushedMain ? "d".repeat(40) : mainHead,
    directRemoteHead(_repo, branch) {
      calls.push(["direct-remote", branch]);
      if (branch === "main") return options.remoteMainHead ?? mainHead;
      return options.remoteEpisodeHead ?? episodeHead;
    },
    assertCleanWorktree() { calls.push(["clean"]); if (options.dirty) throw new Error("dirty main"); },
    isAncestor(_repo, ancestor, descendant) {
      if (ancestor === TASK_BASE && descendant === record.head) return true;
      if (ancestor === TASK_BASE && descendant === episodeHead) return true;
      if (ancestor === record.head && descendant === episodeHead) return !options.unsafeAncestry;
      if (ancestor === episodeHead && descendant === mainHead) return outcome === "merged";
      return false;
    },
    pathTrackedAtRef() { throw new Error("Beads cleanup must not inspect a task path"); },
  };
  const cleanup = {
    async inspect() { calls.push(["inspect"]); return structuredClone(state); },
    async removeRuntime() { calls.push(["remove-runtime"]); delete state.runtime; },
    async removeUpstream() { calls.push(["remove-upstream"]); delete state.upstream; },
    async removeWorktree() { calls.push(["remove-worktree"]); assert.equal(state.upstream, undefined); delete state.worktree; },
    async removeBranch() { calls.push(["remove-branch"]); delete state.branch; },
  };
  const transportEvidence = {
    provider: "beads", projectRoot: f.root, storeDir: join(f.root, ".beads"), bdVersion: "1.3.1",
    doltVersion: "2.5.0", serverAuthority: "operator-managed", serverHost: "127.0.0.1", serverPort: 3307,
    database: "fixture", branch: "main", revision: providerRevision, remoteName: "origin",
    remoteUrl: "/fixture/remote", publicationRef: "refs/dolt/data", publicationHead: "e".repeat(40),
    publishedRevision: providerRevision,
  };
  let transportReads = 0;
  const beadsTransport = () => {
    transportReads += 1;
    if (options.providerBlocked) return { status: "blocked", code: "publication-authority", detail: "unpublished", remediation: "publish" };
    if (options.providerDrift && transportReads === 2) {
      return { status: "ready", evidence: { ...transportEvidence, revision: "d".repeat(32), publishedRevision: "d".repeat(32), publicationHead: "f".repeat(40) } };
    }
    return { status: "ready", evidence: transportEvidence };
  };
  const abandonReason = `Prime Claw abandonment: task ${BEADS_TASK_ID}; pushed Episode head ${episodeHead}; code was not merged.`;
  const nativeView = {
    ...BEADS_TASK_EVIDENCE,
    status: outcome === "merged" ? "done" : "closed",
    ...(outcome === "abandoned" ? {
      closed_at: "2026-10-26T19:00:08Z",
      close_reason: options.wrongReason ? "Abandoned without exact authority evidence" : abandonReason,
    } : {}),
    comments: [{ id: 7, text: "retained provider history", author: "fixture" }],
  };
  const beadsTaskReader = () => ({
    provider: "beads", taskId: BEADS_TASK_ID, title: nativeView.title,
    nativeStatus: options.wrongNativeStatus ?? nativeView.status, projectRoot: f.root, nativeView,
  });
  const beadsRevisionIsAncestor = () => !options.providerRewrite;
  mkdirSync(join(f.root, ".beads"), { recursive: true });
  const sentinel = join(f.root, ".beads", "shared-store-sentinel");
  writeFileSync(sentinel, "preserve shared provider state\n");
  return {
    f, episodeHead, calls, ownership, cleanupGit, cleanup, beadsTransport, beadsTaskReader,
    beadsRevisionIsAncestor, sentinel, state, records,
    get record() { return records.get("owner"); },
    deps: {
      ownership, cleanupGit, cleanup, beadsTransport, beadsTaskReader, beadsRevisionIsAncestor,
      taskResolver: () => { throw new Error("Beads cleanup must not use Backlog task resolution"); },
    },
  };
}

test("cleanup-only task finalization removes exact resources then deletes only the unchanged owner", async () => {
  const h = cleanupHarness("merged");
  const foreignBefore = structuredClone(h.foreignRecord);
  const result = await finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps);
  assert.deepEqual(result, {
    verified: true, outcome: "merged", taskId: "PRIMECLAW-10.38", episodeHead: h.episodeHead,
    resourcesRemoved: true, ownershipRemoved: true,
  });
  assert.equal(h.record, undefined);
  assert.deepEqual(h.foreignRecord, foreignBefore);
  assert.deepEqual(h.calls.filter((call) => call[0].startsWith("remove-")), [
    ["remove-runtime"], ["remove-worktree"], ["remove-branch"], ["remove-owner"],
  ]);
});

test("independent Backlog merged cleanup verifies published terminal evidence and removes nested history first", async () => {
  const taskPath = "backlog/tasks/primeclaw-10.38.md";
  const h = cleanupHarness("merged", { record: {
    provider: "backlog", providerRevision: "e".repeat(40),
    taskEvidence: { task: { id: "PRIMECLAW-10.38", path: taskPath, status: "In Progress", title: "Task-native lifecycle" } },
  } });
  const publishedHead = "f".repeat(40);
  h.deps.inspectPublishedTaskHistory = () => ({ status: "ready", storeDir: join(h.f.root, "backlog"), head: publishedHead });
  h.deps.inspectTaskHistory = (input) => {
    assert.equal(input.expectedRevision, publishedHead);
    assert.equal(h.calls.some((call) => call[0].startsWith("remove-")), false);
    return { status: "ready", storeDir: join(h.f.worktree, "backlog"), present: true };
  };
  h.deps.cleanupTaskHistory = () => { h.calls.push(["remove-task-history"]); return { status: "cleaned", storeDir: join(h.f.worktree, "backlog") }; };
  const result = await finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps);
  assert.equal(result.ownershipRemoved, true);
  assert.equal(h.record, undefined);
  assert.ok(h.calls.findIndex((call) => call[0] === "remove-task-history") < h.calls.findIndex((call) => call[0] === "remove-runtime"));
});

test("independent Backlog cleanup refuses dirty or unpublished nested history before parent-resource removal", async (t) => {
  for (const scenario of [
    { name: "dirty", code: "uncommitted-task-content", detail: "nested task checkout has uncommitted task content" },
    { name: "unpublished", code: "unpublished-task-history", detail: "nested task checkout is ahead of the selected remote" },
  ]) await t.test(scenario.name, async () => {
    const taskPath = "backlog/tasks/primeclaw-10.38.md";
    const h = cleanupHarness("merged", { record: {
      provider: "backlog",
      providerRevision: "e".repeat(40),
      taskEvidence: { task: { id: "PRIMECLAW-10.38", path: taskPath, status: "In Progress", title: "Task-native lifecycle" } },
    } });
    let cleanupCalls = 0;
    h.deps.inspectPublishedTaskHistory = () => ({ status: "ready", storeDir: join(h.f.root, "backlog"), head: "f".repeat(40) });
    h.deps.inspectTaskHistory = (input) => {
      assert.equal(input.expectedRevision, "f".repeat(40));
      return { status: "refused", code: scenario.code, detail: scenario.detail, remediation: "publish or clean the exact nested checkout" };
    };
    h.deps.cleanupTaskHistory = () => { cleanupCalls += 1; throw new Error("must not clean refused history"); };
    await assert.rejects(
      finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps),
      new RegExp(`${scenario.code}.*${scenario.detail}`),
    );
    assert.equal(cleanupCalls, 0);
    assert.equal(h.calls.some((call) => call[0].startsWith("remove-")), false);
    assert.equal(h.record.status, "active");
  });
});

test("independent Backlog cleanup refuses an unpublished primary terminal before any removal", async () => {
  const taskPath = "backlog/tasks/primeclaw-10.38.md";
  const h = cleanupHarness("merged", { record: {
    provider: "backlog", providerRevision: "e".repeat(40),
    taskEvidence: { task: { id: "PRIMECLAW-10.38", path: taskPath, status: "In Progress", title: "Task-native lifecycle" } },
  } });
  h.deps.inspectPublishedTaskHistory = () => ({
    status: "blocked", code: "local-ahead", detail: "primary terminal commit is not directly published", remediation: "publish it",
  });
  await assert.rejects(
    finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps),
    /clean directly published primary task history.*local-ahead.*not directly published/,
  );
  assert.equal(h.calls.some((call) => call[0].startsWith("remove-")), false);
  assert.equal(h.record.cleanupHead, undefined);
});

test("independent Backlog abandonment verifies the published archive without active-task resolution", async () => {
  const taskPath = "backlog/tasks/primeclaw-10.38.md";
  const h = cleanupHarness("abandoned", { record: {
    provider: "backlog", providerRevision: "e".repeat(40),
    taskEvidence: { task: { id: "PRIMECLAW-10.38", path: taskPath, status: "In Progress", title: "Task-native lifecycle" } },
  } });
  const publishedHead = "f".repeat(40);
  h.deps.inspectPublishedTaskHistory = () => ({ status: "ready", storeDir: join(h.f.root, "backlog"), head: publishedHead });
  h.deps.taskResolver = () => { throw new Error("archived independent task must not use active-task resolution"); };
  const requiredEvidence = `Prime Claw abandonment: task PRIMECLAW-10.38; pushed Episode head ${h.episodeHead}; code was not merged.`;
  const summary = `${requiredEvidence}\n\nPreserved operator context explaining why the accepted candidate was abandoned.`;
  h.deps.taskRunner = { run(command, args) {
    assert.equal(command, "git");
    if (args[0] === "show" && args[1].includes(":tasks/")) return { stdout: "", stderr: "missing", status: 128 };
    if (args[0] === "show" && args[1].includes(":archive/tasks/")) return {
      stdout: `---\nid: PRIMECLAW-10.38\nstatus: In Progress\n---\n\n## Final Summary\n\n<!-- SECTION:FINAL_SUMMARY:BEGIN -->\n${summary}\n<!-- SECTION:FINAL_SUMMARY:END -->\n`,
      stderr: "", status: 0,
    };
    throw new Error(`unexpected command: ${command} ${args.join(" ")}`);
  } };
  h.deps.inspectTaskHistory = (input) => {
    assert.equal(input.expectedRevision, publishedHead);
    return { status: "ready", storeDir: join(h.f.worktree, "backlog"), present: true };
  };
  h.deps.cleanupTaskHistory = () => ({ status: "cleaned", storeDir: join(h.f.worktree, "backlog") });
  const result = await finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "abandoned", h.f.ctx, h.deps);
  assert.equal(result.ownershipRemoved, true);
  assert.equal(h.record, undefined);
});

test("cleanup finalization treats the actual upstream as an independent exact resource", async (t) => {
  for (const localPresent of [true, false]) await t.test(`local branch present: ${localPresent}`, async () => {
    const h = cleanupHarness("merged", { upstream: true, absent: localPresent ? [] : ["branch"] });
    await finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps);
    assert.equal(h.record, undefined);
    assert.deepEqual(h.calls.filter(([kind]) => kind.startsWith("remove-")), [
      ["remove-runtime"], ["remove-upstream"], ["remove-worktree"], ...(localPresent ? [["remove-branch"]] : []), ["remove-owner"],
    ]);
  });
  await t.test("remote mismatch blocks before any destructive mutation", async () => {
    const h = cleanupHarness("merged", { upstream: true });
    const original = structuredClone(h.record);
    h.state.upstream.head = "d".repeat(40);
    await assert.rejects(finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps), /upstream.*(?:exact|head)|(?:exact|head).*upstream/i);
    assert.deepEqual(h.record, original);
    assert.equal(h.calls.some(([kind]) => kind.startsWith("remove-")), false);
  });
  await t.test("remote must be absent before ownership removal", async () => {
    const h = cleanupHarness("merged", { upstream: true });
    const original = structuredClone(h.record);
    h.cleanup.removeUpstream = async () => { h.calls.push(["remove-upstream"]); };
    await assert.rejects(finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps), /upstream removal was not verified exactly/);
    assert.deepEqual(h.record, original);
    assert.ok(h.state.upstream);
    assert.equal(h.calls.some(([kind]) => kind === "remove-owner"), false);
  });
});

test("cleanup-only finalization deletes its registry entry through the production ownership store", async () => {
  const h = cleanupHarness();
  writeEpisodeOwnership(h.f.root, h.record);
  writeEpisodeOwnership(h.f.root, h.foreignRecord);
  const path = join(h.f.root, ".prime-claw", "ownership.json");
  const foreign = JSON.parse(readFileSync(path, "utf8")).owners["foreign-owner"];
  await finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, { ...h.deps, ownership: undefined });
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")).owners, { "foreign-owner": foreign });
});

test("independent Backlog cleanup accepts an absent worktree without inspecting or recreating nested history", async () => {
  const taskPath = "backlog/tasks/primeclaw-10.38.md";
  const h = cleanupHarness("merged", { absent: ["worktree"], record: {
    provider: "backlog", providerRevision: "e".repeat(40),
    taskEvidence: { task: { id: "PRIMECLAW-10.38", path: taskPath, status: "In Progress" } },
  } });
  h.deps.inspectPublishedTaskHistory = () => ({ status: "ready", storeDir: join(h.f.root, "backlog"), head: "f".repeat(40) });
  h.deps.inspectTaskHistory = () => { throw new Error("absent worktree must not be prepared or inspected"); };
  h.deps.cleanupTaskHistory = () => { throw new Error("absent worktree has no nested history to remove"); };
  await finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps);
  assert.equal(h.record, undefined);
  assert.deepEqual(h.calls.filter(([kind]) => kind.startsWith("remove-")), [["remove-runtime"], ["remove-branch"], ["remove-owner"]]);
});

test("cleanup-only task finalization supports abandonment without an inactive replay record", async () => {
  const h = cleanupHarness("abandoned");
  await finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "abandoned", h.f.ctx, h.deps);
  const beforeReplay = structuredClone(h.calls);
  await assert.rejects(
    finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "abandoned", h.f.ctx, h.deps),
    /No durable task-native Episode ownership/,
  );
  assert.deepEqual(h.calls, beforeReplay);
  assert.equal(h.record, undefined);
});

test("cleanup-only finalization verifies merged Beads terminal publication without a task path", async () => {
  const h = beadsCleanupHarness("merged", { upstream: true });
  assert.equal(h.record.provider, "beads");
  assert.equal("taskPath" in h.record, false);
  const result = await finalizeTaskEpisodeCleanup(BEADS_TASK_ID, h.episodeHead, "merged", h.f.ctx, h.deps);
  assert.equal(result.ownershipRemoved, true);
  assert.equal(h.record, undefined);
  assert.equal(existsSync(h.sentinel), true);
  assert.deepEqual(h.calls.filter((call) => call[0] === "direct-remote"), [["direct-remote", "main"]]);
  assert.deepEqual(h.calls.filter(([kind]) => kind.startsWith("remove-")), [
    ["remove-runtime"], ["remove-upstream"], ["remove-worktree"], ["remove-branch"], ["remove-owner"],
  ]);
});

test("cleanup-only finalization verifies exact closed Beads abandonment without retaining a replay record", async () => {
  const h = beadsCleanupHarness("abandoned");
  await finalizeTaskEpisodeCleanup(BEADS_TASK_ID, h.episodeHead, "abandoned", h.f.ctx, h.deps);
  assert.equal(h.record, undefined);
  assert.equal(existsSync(h.sentinel), true);
  const before = structuredClone(h.calls);
  await assert.rejects(finalizeTaskEpisodeCleanup(BEADS_TASK_ID, h.episodeHead, "abandoned", h.f.ctx, h.deps), /No durable task-native Episode ownership/);
  assert.deepEqual(h.calls, before);
});

test("Beads cleanup accepts every combination of already absent resources without cleanup markers", async (t) => {
  for (const runtime of [true, false]) for (const worktree of [true, false]) for (const branch of [true, false]) for (const upstream of [true, false]) {
    const absent = Object.entries({ runtime, worktree, branch, upstream }).filter(([, present]) => !present).map(([key]) => key);
    await t.test(`absent: ${absent.join(",") || "none"}`, async () => {
      const h = beadsCleanupHarness("merged", { upstream: true, absent });
      await finalizeTaskEpisodeCleanup(BEADS_TASK_ID, h.episodeHead, "merged", h.f.ctx, h.deps);
      assert.equal(h.record, undefined);
      assert.equal(existsSync(h.sentinel), true);
      assert.deepEqual(h.calls.filter(([kind]) => kind.startsWith("remove-")), [
        ...(runtime ? [["remove-runtime"]] : []), ...(upstream ? [["remove-upstream"]] : []),
        ...(worktree ? [["remove-worktree"]] : []), ...(branch ? [["remove-branch"]] : []), ["remove-owner"],
      ]);
    });
  }
});

test("Beads cleanup retains unchanged ownership after partial failure and resumes from actual absence", async () => {
  const h = beadsCleanupHarness("merged", { upstream: true });
  const original = structuredClone(h.record);
  const removeWorktree = h.cleanup.removeWorktree;
  h.cleanup.removeWorktree = async () => { throw new Error("provider unavailable"); };
  await assert.rejects(finalizeTaskEpisodeCleanup(BEADS_TASK_ID, h.episodeHead, "merged", h.f.ctx, h.deps), /provider unavailable/);
  assert.deepEqual(h.record, original);
  assert.equal(h.state.runtime, undefined);
  assert.equal(h.state.upstream, undefined);
  assert.ok(h.state.worktree);
  h.cleanup.removeWorktree = removeWorktree;
  await finalizeTaskEpisodeCleanup(BEADS_TASK_ID, h.episodeHead, "merged", h.f.ctx, h.deps);
  assert.equal(h.record, undefined);
  assert.equal(h.calls.filter(([kind]) => kind === "remove-runtime").length, 1);
  assert.equal(h.calls.filter(([kind]) => kind === "remove-upstream").length, 1);
  assert.equal(existsSync(h.sentinel), true);
});

test("Beads cleanup refuses wrong terminal, publication, ancestry, and direct-remote evidence", async (t) => {
  const cases = [
    { name: "wrong abandonment reason", outcome: "abandoned", options: { wrongReason: true }, pattern: /exact native closed abandonment evidence/ },
    { name: "unpublished provider", outcome: "merged", options: { providerBlocked: true }, pattern: /publication proof is blocked/ },
    { name: "provider read drift", outcome: "merged", options: { providerDrift: true }, pattern: /publication identity changed/ },
    { name: "provider history rewrite", outcome: "merged", options: { providerRewrite: true }, pattern: /not an ancestor/ },
    { name: "wrong main remote head", outcome: "merged", options: { remoteMainHead: "d".repeat(40) }, pattern: /local\/upstream\/direct-remote canonical main/ },
    { name: "wrong Episode remote head", outcome: "merged", options: { remoteEpisodeHead: "d".repeat(40) }, pattern: /upstream branch is no longer exact/ },
    { name: "unsafe code ancestry", outcome: "merged", options: { unsafeAncestry: true }, pattern: /unsafe Beads base\/recorded\/terminal code ancestry/ },
    { name: "dirty canonical main", outcome: "merged", options: { dirty: true }, pattern: /dirty main/ },
    { name: "dirty Episode worktree", outcome: "merged", options: { dirtyEpisode: true }, pattern: /worktree is dirty or no longer exact/ },
    { name: "wrong resource head", outcome: "merged", options: { wrongHead: true }, pattern: /worktree is dirty or no longer exact/ },
  ];
  for (const scenario of cases) await t.test(scenario.name, async () => {
    const h = beadsCleanupHarness(scenario.outcome, scenario.options);
    await assert.rejects(
      finalizeTaskEpisodeCleanup(BEADS_TASK_ID, h.episodeHead, scenario.outcome, h.f.ctx, h.deps),
      scenario.pattern,
    );
    assert.equal(h.calls.some((call) => call[0].startsWith("remove-")), false);
    assert.equal(h.record.status, "active");
    assert.equal(existsSync(h.sentinel), true);
  });
});

test("cleanup-only task finalization accepts every combination of already absent exact resources", async (t) => {
  for (const runtime of [true, false]) for (const worktree of [true, false]) for (const branch of [true, false]) {
    const absent = Object.entries({ runtime, worktree, branch }).filter(([, present]) => !present).map(([key]) => key);
    await t.test(`absent: ${absent.join(",") || "none"}`, async () => {
      const h = cleanupHarness("merged", { absent });
      await finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps);
      assert.equal(h.record, undefined);
      assert.deepEqual(h.calls.filter((call) => call[0].startsWith("remove-")), [
        ...(runtime ? [["remove-runtime"]] : []), ...(worktree ? [["remove-worktree"]] : []),
        ...(branch ? [["remove-branch"]] : []), ["remove-owner"],
      ]);
    });
  }
});

test("cleanup-only task finalization preserves ordinary ownership on failure and rereads actual state on a later call", async () => {
  const h = cleanupHarness();
  const original = structuredClone(h.record);
  const removeWorktree = h.cleanup.removeWorktree;
  let attempts = 0;
  h.cleanup.removeWorktree = async () => { attempts += 1; throw new Error("bounded provider error"); };
  await assert.rejects(finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps), /bounded provider error/);
  assert.equal(attempts, 1);
  assert.deepEqual(h.record, original);
  assert.equal(h.state.runtime, undefined);
  assert.ok(h.state.worktree);
  h.cleanup.removeWorktree = removeWorktree;
  await finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps);
  assert.equal(h.record, undefined);
  assert.equal(h.calls.filter(([kind]) => kind === "remove-runtime").length, 1);
});

test("cleanup-only task finalization requires verified absence and unchanged ownership before owner deletion", async (t) => {
  await t.test("provider no-op", async () => {
    const h = cleanupHarness(); const original = structuredClone(h.record);
    h.cleanup.removeRuntime = async () => {};
    await assert.rejects(finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps), /runtime removal was not verified/);
    assert.deepEqual(h.record, original);
    assert.equal(h.calls.some(([kind]) => kind === "remove-owner"), false);
  });
  await t.test("owner changed during resource removal", async () => {
    const h = cleanupHarness();
    h.cleanup.removeBranch = async () => {
      delete h.state.branch;
      h.records.set("owner", { ...h.record, updatedAt: "changed" });
    };
    await assert.rejects(finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps), /ownership changed during cleanup/);
    assert.equal(h.record.updatedAt, "changed");
    assert.equal(h.calls.some(([kind]) => kind === "remove-owner"), false);
  });
});

test("cleanup-only task finalization refuses unsafe identity or terminal evidence before mutation", async (t) => {
  for (const [name, options, pattern] of [
    ["busy runtime", { busy: true }, /Episode has not completed its work/],
    ["dirty Episode", { dirtyEpisode: true }, /worktree is dirty/],
    ["dirty main", { dirty: true }, /dirty main/],
    ["unpushed main", { unpushed: true }, /pushed canonical main/],
    ["unpushed Episode", { unpushedEpisode: true }, /upstream branch is no longer exact/],
    ["foreign base", { foreignBase: true }, /not descended from the owned Episode base/],
    ["not Done", { taskStatus: "In Progress" }, /requires .* to be Done/],
    ["not merged", { unmerged: true }, /exact Episode candidate in canonical main history/],
    ["inactive ownership", { record: { status: "inactive" } }, /cannot finalize inactive ownership/],
  ]) await t.test(name, async () => {
    const h = cleanupHarness("merged", options); const original = structuredClone(h.record);
    await assert.rejects(finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps), pattern);
    assert.deepEqual(h.record, original);
    assert.equal(h.calls.some(([kind]) => kind.startsWith("remove-")), false);
  });
  for (const [name, resource, change, pattern] of [
    ["runtime CWD", "runtime", { cwd: "/foreign" }, /runtime is no longer exact/],
    ["worktree identity", "worktree", { path: "/foreign" }, /worktree is dirty or no longer exact/],
    ["branch head", "branch", { head: "d".repeat(40) }, /branch is no longer exact/],
  ]) await t.test(name, async () => {
    const h = cleanupHarness(); Object.assign(h.state[resource], change);
    await assert.rejects(finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, h.deps), pattern);
    assert.equal(h.calls.some(([kind]) => kind.startsWith("remove-")), false);
  });
  await t.test("abandonment requires archive", async () => {
    const h = cleanupHarness("abandoned", { notArchived: true });
    await assert.rejects(finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "abandoned", h.f.ctx, h.deps), /exact task to be archived/);
    assert.equal(h.calls.some(([kind]) => kind.startsWith("remove-")), false);
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

test("ownership parser requires active durable bindings and discards legacy cleanupHead", () => {
  assert.throws(() => parseEpisodeOwnership({ version: 1, status: "active", engine: "orca" }), /unsupported shape/);
  const f = harness();
  const record = activeTaskRecord(f, { cleanupHead: "b".repeat(40) });
  assert.equal(Object.hasOwn(record, "cleanupHead"), false);
  assert.throws(() => parseEpisodeOwnership({ ...record, cleanupHead: "not-a-head" }), /unsupported shape/);
});

test("bundle bytes are bound before any ownership or external mutation", async () => {
  const f = harness();
  const folder = join(f.root, ".ralph", "plans", "future", "alpha");
  const approvedBundleDigest = bundleContentDigest(folder);
  writeFileSync(join(folder, "SPECIFICATION.md"), "changed after approval");
  await assert.rejects(createSpecEpisode(LOCATION, "tool", f.ctx, f.deps, { approvedBundleDigest }), /changed after grandfathering/);
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
  assert.match(execute[1], /<operator-episode-owner-session>\s*owner\s*<\/operator-episode-owner-session>/);
  assert.match(execute[1], /exact owning Conversation registry key/);
  assert.match(execute[1], /never substitute the current session ID/);
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
  assert.match(automation.prompt, /<operator-episode-owner-session>\s*owner\s*<\/operator-episode-owner-session>/);
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
    /No durable task-native Episode reservation/,
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


// Every cleanup Git fixture uses its own bare transport, never host remotes.
function configureCleanupUpstream(root, branch, ref = `refs/heads/${branch}`, remote = "delivery") {
  const remotePath = mkdtempSync(join(tmpdir(), "prime-claw-cleanup-remote-"));
  execFileSync("git", ["init", "--bare", "-q", remotePath]);
  execFileSync("git", ["-C", root, "remote", "add", remote, remotePath]);
  execFileSync("git", ["-C", root, "push", "-q", remote, `${branch}:${ref}`]);
  execFileSync("git", ["-C", root, "config", `branch.${branch}.remote`, remote]);
  execFileSync("git", ["-C", root, "config", `branch.${branch}.merge`, ref]);
  return { remote, ref, remotePath };
}

function cleanupTransportFixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-cleanup-transport-")));
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q", "-b", "main"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.test");
  writeFileSync(join(root, "README.md"), "base\n"); git("add", "."); git("commit", "-qm", "base");
  const head = git("rev-parse", "HEAD"), branch = "episode-local";
  git("branch", branch, head);
  const upstream = configureCleanupUpstream(root, branch, "refs/heads/published-different-name", "renamed-delivery");
  writeFileSync(join(root, "README.md"), "other\n"); git("commit", "-qam", "other");
  const otherHead = git("rev-parse", "HEAD");
  git("push", "-q", upstream.remote, "HEAD:refs/heads/unrelated-main");
  const record = parseEpisodeOwnership({ version: 2, status: "active", operationId: "op", engine: "local",
    ownerSessionId: "owner", taskId: "PRIMECLAW-1", taskPath: "backlog/tasks/task.md", baseRef: head,
    createdAt: "x", updatedAt: "x", worktree: join(root, "absent-worktree"), branch, head,
    episodeId: "episode", episodeSessionFile: join(root, "absent.jsonl"), episodeActiveSessionId: "route" });
  const calls = [];
  const f = { root, git, head, otherHead, branch, record, upstream, calls, beforeCommand: undefined, afterCommand: undefined };
  const runner = { run(command, args, options = {}) {
    assert.equal(command, "git"); calls.push([...args]);
    const intercepted = f.beforeCommand?.(args);
    if (intercepted) return intercepted;
    let result;
    try { result = { status: 0, stdout: execFileSync("git", args, { cwd: options.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), stderr: "" }; }
    catch (error) { result = { status: error.status ?? 1, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? error) }; }
    f.afterCommand?.(args, result);
    return result;
  } };
  f.adapter = () => new CliTaskEpisodeCleanupAdapter(root, head, { sessions: { async list() { return []; } }, runner });
  f.remoteHead = (remote = upstream.remote, ref = upstream.ref) => git("ls-remote", "--refs", "--", remote, ref).split(/\s+/)[0] || undefined;
  f.localPresent = () => git("for-each-ref", "--format=%(refname)", `refs/heads/${branch}`) !== "";
  t.after(() => { rmSync(root, { recursive: true, force: true }); rmSync(upstream.remotePath, { recursive: true, force: true }); });
  return f;
}

test("cleanup transport deletes the configured renamed remote ref before the local branch", async (t) => {
  const f = cleanupTransportFixture(t), adapter = f.adapter();
  assert.deepEqual((await adapter.inspect(f.record)).upstream, { remote: f.upstream.remote, ref: f.upstream.ref, head: f.head });
  f.beforeCommand = (args) => {
    if (args[0] === "update-ref" && args.includes("-d")) assert.equal(f.remoteHead(), undefined, "remote must be absent before local deletion");
  };
  await adapter.removeBranch(f.record);
  assert.equal(f.remoteHead(), undefined); assert.equal(f.localPresent(), false);
  assert.deepEqual(await adapter.inspect(f.record), {}, "both resources must be proven absent after local deletion");
  assert.deepEqual(f.calls.find((args) => args[0] === "push"), [
    "push", "--porcelain", `--force-with-lease=${f.upstream.ref}:${f.head}`, "--", f.upstream.remotePath, `:${f.upstream.ref}`,
  ]);
});

test("cleanup transport resumes either remote or local partial absence using retained exact config", async (t) => {
  for (const absent of ["remote", "local"]) await t.test(absent, async (t) => {
    const f = cleanupTransportFixture(t);
    if (absent === "remote") f.git("push", "-q", f.upstream.remote, `:${f.upstream.ref}`);
    else f.git("update-ref", "-d", `refs/heads/${f.branch}`); // Preserve explicit upstream config.
    const adapter = f.adapter(), snapshot = await adapter.inspect(f.record);
    assert.equal(Boolean(snapshot.branch), absent !== "local");
    assert.equal(Boolean(snapshot.upstream), absent !== "remote");
    await adapter.removeBranch(f.record);
    assert.equal(f.remoteHead(), undefined); assert.equal(f.localPresent(), false);
    assert.deepEqual(await adapter.inspect(f.record), {});
  });
});

test("cleanup transport refuses unresolved upstream after local branch and config are absent", async (t) => {
  const f = cleanupTransportFixture(t);
  f.git("branch", "-D", f.branch); // Unlike update-ref, this also removes branch config.
  await assert.rejects(f.adapter().inspect(f.record), /upstream|config|identity/i);
  assert.equal(f.remoteHead(), f.head);
  assert.equal(f.calls.some((args) => ["push", "branch", "worktree"].includes(args[0])), false);
});

test("only the same cleanup adapter can reuse an upstream it already resolved before external branch config erasure", async (t) => {
  const f = cleanupTransportFixture(t), adapter = f.adapter();
  await adapter.inspect(f.record);
  f.git("push", "-q", f.upstream.remote, `:${f.upstream.ref}`);
  f.git("branch", "-D", f.branch);
  assert.deepEqual(await adapter.inspect(f.record), {});
  await assert.rejects(f.adapter().inspect(f.record), /upstream|config|identity/i);
});

test("cleanup transport blocks actual remote mismatch despite a stale matching tracking ref", async (t) => {
  const f = cleanupTransportFixture(t);
  execFileSync("git", ["--git-dir", f.upstream.remotePath, "update-ref", f.upstream.ref, f.otherHead]);
  await assert.rejects(f.adapter().removeBranch(f.record), /(?:upstream|remote|terminal).*head|head.*(?:upstream|remote)/i);
  assert.equal(f.localPresent(), true); assert.equal(f.remoteHead(), f.otherHead);
  assert.equal(f.calls.some((args) => args[0] === "push" || (args[0] === "update-ref" && args.includes("-d"))), false);
});

test("cleanup transport retains local branch when remote deletion fails or its exact lease races", async (t) => {
  for (const race of [false, true]) await t.test(race ? "remote recreated at another head" : "remote rejects deletion", async (t) => {
    const f = cleanupTransportFixture(t);
    f.beforeCommand = (args) => {
      if (args[0] !== "push") return;
      if (race) {
        execFileSync("git", ["--git-dir", f.upstream.remotePath, "update-ref", "-d", f.upstream.ref]);
        execFileSync("git", ["--git-dir", f.upstream.remotePath, "update-ref", f.upstream.ref, f.otherHead]);
      }
      else return { status: 1, stdout: "", stderr: "synthetic remote deletion rejection" };
    };
    await assert.rejects(f.adapter().removeBranch(f.record), /(?:push|remote|upstream|delet|lease)/i);
    assert.equal(f.localPresent(), true);
    assert.equal(f.remoteHead(), race ? f.otherHead : f.head);
    assert.equal(f.calls.some((args) => args[0] === "update-ref" && args.includes("-d")), false);
  });
});

test("cleanup transport verifies remote absence again after deletion before deleting local branch", async (t) => {
  const f = cleanupTransportFixture(t);
  f.afterCommand = (args, result) => {
    if (args[0] === "push" && result.status === 0) execFileSync("git", ["--git-dir", f.upstream.remotePath, "update-ref", f.upstream.ref, f.head]);
  };
  await assert.rejects(f.adapter().removeBranch(f.record), /(?:remote|upstream|absen|verif)/i);
  assert.equal(f.localPresent(), true); assert.equal(f.remoteHead(), f.head);
  assert.equal(f.calls.some((args) => args[0] === "update-ref" && args.includes("-d")), false);
});

test("cleanup transport refuses divergent or multiple push destinations before mutation", async (t) => {
  for (const multiple of [false, true]) await t.test(multiple ? "multiple push URLs" : "different push URL", async (t) => {
    const f = cleanupTransportFixture(t), key = `remote.${f.upstream.remote}.pushurl`;
    f.git("config", "--add", key, multiple ? f.upstream.remotePath : join(f.root, "different-remote.git"));
    if (multiple) f.git("config", "--add", key, f.upstream.remotePath);
    await assert.rejects(f.adapter().removeBranch(f.record), /(?:upstream|remote|push|destination|URL)/i);
    assert.equal(f.localPresent(), true); assert.equal(f.remoteHead(), f.head);
    assert.equal(f.calls.some((args) => args[0] === "push" || (args[0] === "update-ref" && args.includes("-d"))), false);
  });
});

test("cleanup transport refuses the Episode branch checked out in another worktree before mutation", async (t) => {
  const f = cleanupTransportFixture(t), foreign = join(f.root, "foreign-checkout");
  f.git("worktree", "add", "-q", foreign, f.branch);
  await assert.rejects(f.adapter().removeBranch(f.record), /branch in another worktree/i);
  assert.equal(existsSync(foreign), true); assert.equal(f.localPresent(), true); assert.equal(f.remoteHead(), f.head);
  assert.equal(f.calls.some((args) => args[0] === "push" || (args[0] === "update-ref" && args.includes("-d"))), false);
});

test("cleanup transport refuses a same-head symbolic Episode ref without deleting its main target", async (t) => {
  const f = cleanupTransportFixture(t);
  f.git("update-ref", "refs/heads/main", f.head);
  f.git("symbolic-ref", `refs/heads/${f.branch}`, "refs/heads/main");
  await assert.rejects(f.adapter().removeBranch(f.record), /symbolic|symref/i);
  assert.equal(f.git("rev-parse", "refs/heads/main"), f.head);
  assert.equal(f.git("symbolic-ref", `refs/heads/${f.branch}`), "refs/heads/main");
  assert.equal(f.remoteHead(), f.head);
  assert.equal(f.calls.some((args) => args[0] === "push" || (args[0] === "update-ref" && args.includes("-d"))), false);
});

test("cleanup transport uses a local compare-and-delete after remote absence", async (t) => {
  const f = cleanupTransportFixture(t);
  f.beforeCommand = (args) => {
    if (args[0] !== "update-ref" || !args.includes("-d")) return;
    assert.ok(args.includes("--no-deref"));
    assert.deepEqual(args.filter((arg) => arg !== "--no-deref"), ["update-ref", "-d", `refs/heads/${f.branch}`, f.head]);
    f.git("update-ref", `refs/heads/${f.branch}`, f.otherHead);
  };
  await assert.rejects(f.adapter().removeBranch(f.record), /branch.*(?:remov|delet)|(?:remov|delet).*branch/i);
  assert.equal(f.git("rev-parse", `refs/heads/${f.branch}`), f.otherHead);
  assert.equal(f.remoteHead(), undefined);
});

test("fresh cleanup adapters resolve changed branch remote and merge config without stale identity", async (t) => {
  const f = cleanupTransportFixture(t);
  assert.equal((await f.adapter().inspect(f.record)).upstream.remote, f.upstream.remote);
  const next = configureCleanupUpstream(f.root, f.branch, "refs/heads/another-ref", "second-delivery");
  t.after(() => rmSync(next.remotePath, { recursive: true, force: true }));
  const adapter = f.adapter();
  assert.deepEqual((await adapter.inspect(f.record)).upstream, { remote: next.remote, ref: next.ref, head: f.head });
  await adapter.removeBranch(f.record);
  assert.equal(f.remoteHead(next.remote, next.ref), undefined);
  assert.equal(f.remoteHead(), f.head, "previously configured remote must not be deleted");
  assert.equal(f.localPresent(), false);
});

test("cleanup ignores unrelated saved CWD histories after the owned root is absent", async (t) => {
  const f = cleanupTransportFixture(t);
  const path = join(f.root, "unrelated-saved.jsonl");
  writeFileSync(path, "preserve saved history\n");
  const saved = { sessionId: "unrelated", sessionFile: path, cwd: f.record.worktree, isSessionActive: false };
  const sessions = { async list() { return [{ ...saved }]; } };
  const adapter = new CliTaskEpisodeCleanupAdapter(f.root, f.head, { sessions });
  assert.equal((await adapter.inspect(f.record)).runtime, undefined);
  await adapter.removeUpstream(f.record);
  await adapter.removeBranch(f.record);
  assert.deepEqual(await adapter.inspect(f.record), {});
  assert.equal(readFileSync(path, "utf8"), "preserve saved history\n");
});

test("cleanup without its root still rejects live CWD and exact saved-identity collisions", async (t) => {
  const f = cleanupTransportFixture(t);
  const path = join(f.root, "foreign-saved.jsonl"); writeFileSync(path, "preserve\n");
  const unrelated = { sessionId: "unrelated", sessionFile: path, cwd: f.record.worktree, isSessionActive: false };
  for (const collision of [
    { ...unrelated, activeSessionId: "foreign-route" },
    { ...unrelated, activeSessionId: f.record.episodeActiveSessionId, cwd: f.root },
    { ...unrelated, sessionId: f.record.episodeId, cwd: f.root },
    { ...unrelated, sessionFile: f.record.episodeSessionFile, cwd: f.root },
  ]) {
    const sessions = { async list() { return [structuredClone(collision)]; } };
    const adapter = new CliTaskEpisodeCleanupAdapter(f.root, f.head, { sessions });
    await assert.rejects(adapter.inspect(f.record), /foreign or duplicate Prime Agent session identity/);
    assert.equal(readFileSync(path, "utf8"), "preserve\n");
    assert.equal(f.localPresent(), true);
    assert.equal(f.remoteHead(), f.head);
  }
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
  configureCleanupUpstream(root, "episode-cleanup");
  const sessionFile = join(root, "episode.jsonl"); writeFileSync(sessionFile, "{}\n");
  let rows = [{ activeSessionId: "route", sessionId: "episode", sessionFile, cwd: worktree, isSessionActive: false, isStreaming: false, isCompacting: false, attachedClients: 0, unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [] } }];
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
  await assert.rejects(adapter.inspect(record), /changed Prime Agent session identity/);
  stateCwd = worktree;
  let snapshot = await adapter.inspect(record);
  assert.equal(snapshot.runtime.idle, true);
  assert.equal(snapshot.runtime.cwd, worktree);
  assert.equal(snapshot.worktree.head, terminalHead);
  assert.equal(snapshot.branch.head, terminalHead);
  await assert.rejects(adapter.removeRuntime(record), /synthetic uncertain delete/);
  snapshot = await adapter.inspect(record);
  assert.equal(snapshot.runtime.idle, true);
  await adapter.removeRuntime(record);
  snapshot = await adapter.inspect(record);
  assert.equal(snapshot.runtime, undefined);
  assert.ok(snapshot.worktree); assert.ok(snapshot.branch);
  await adapter.removeUpstream(record);
  await adapter.removeWorktree(record);
  snapshot = await adapter.inspect(record);
  assert.equal(snapshot.worktree, undefined); assert.ok(snapshot.branch);
  await adapter.removeBranch(record);
  snapshot = await adapter.inspect(record);
  assert.deepEqual(snapshot, {});
  assert.deepEqual(calls, [["kill", "route"], ["delete", sessionFile], ["delete", sessionFile]]);
});

test("cleanup retains ownership when an explicit child survives its missing root", async (t) => {
  for (const edge of ["parentSessionId", "parentSessionPath"]) await t.test(edge, async () => {
    const h = cleanupHarness("merged", { absent: ["runtime", "worktree", "branch"] });
    rmSync(h.f.worktree, { recursive: true, force: true });
    const original = structuredClone(h.record);
    const childFile = join(h.f.root, "surviving-child.jsonl"); writeFileSync(childFile, "{}\n");
    const child = { sessionId: "child", sessionFile: childFile, cwd: h.f.root, isSessionActive: true,
      [edge]: edge === "parentSessionId" ? h.record.episodeId : h.record.episodeSessionFile };
    const sessions = { async list() { return [child]; } };
    const runner = { run(_command, args) {
      if (args[0] === "check-ref-format") return { status: 0, stdout: "", stderr: "" };
      if (args[0] === "symbolic-ref") {
        assert.deepEqual(args, ["symbolic-ref", "--quiet", `refs/heads/${h.record.branch}`]);
        return { status: 1, stdout: "", stderr: "" };
      }
      if (args[0] === "config") {
        assert.equal(args[1], "--get-all");
        assert.ok([`branch.${h.record.branch}.remote`, `branch.${h.record.branch}.merge`].includes(args[2]));
        return { status: 0, stdout: args[2].endsWith(".remote") ? "delivery\n" : "refs/heads/published-episode\n", stderr: "" };
      }
      if (args[0] === "remote") {
        assert.ok([JSON.stringify(["remote", "get-url", "--all", "--", "delivery"]), JSON.stringify(["remote", "get-url", "--push", "--all", "--", "delivery"])].includes(JSON.stringify(args)));
        return { status: 0, stdout: "/isolated/fixture.git\n", stderr: "" };
      }
      if (args[0] === "ls-remote") {
        assert.deepEqual(args, ["ls-remote", "--refs", "--", "/isolated/fixture.git", "refs/heads/published-episode"]);
        return { status: 0, stdout: "", stderr: "" };
      }
      assert.deepEqual(args, ["show-ref", "--verify", "--quiet", `refs/heads/${h.record.branch}`]);
      return { status: 1, stdout: "", stderr: "" };
    } };
    const adapter = new CliTaskEpisodeCleanupAdapter(h.f.root, h.episodeHead, { sessions, runner, git: { worktrees: () => [] } });
    await assert.rejects(
      finalizeTaskEpisodeCleanup("PRIMECLAW-10.38", h.episodeHead, "merged", h.f.ctx, { ...h.deps, cleanup: adapter }),
      /explicit descendant without its recorded root/,
    );
    assert.deepEqual(h.record, original);
    assert.equal(existsSync(childFile), true);
    assert.equal(h.calls.some(([kind]) => kind.startsWith("remove-")), false);
  });
});

test("production cleanup adapter removes an exact idle runtime after worktree and branch are already absent", async () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-cleanup-runtime-only-"));
  const worktree = join(root, "absent-worktree");
  const sessionFile = join(root, "episode.jsonl"); writeFileSync(sessionFile, "{}\n");
  let rows = [{ sessionId: "episode", sessionFile, cwd: worktree, isSessionActive: false,
    isStreaming: false, isCompacting: false, sessionActions: { queuedCount: 0, steering: [], followUps: [] } }];
  const sessions = {
    async list() { return structuredClone(rows); },
    async deleteSaved(path) { assert.equal(path, sessionFile); unlinkSync(path); rows = []; },
  };
  const runner = { run(_command, args) {
    if (args[0] === "check-ref-format") return { status: 0, stdout: "", stderr: "" };
    if (args[0] === "symbolic-ref") {
      assert.deepEqual(args, ["symbolic-ref", "--quiet", "refs/heads/episode-cleanup"]);
      return { status: 1, stdout: "", stderr: "" };
    }
    if (args[0] === "config") {
      assert.equal(args[1], "--get-all");
      assert.ok(["branch.episode-cleanup.remote", "branch.episode-cleanup.merge"].includes(args[2]));
      return { status: 0, stdout: args[2].endsWith(".remote") ? "delivery\n" : "refs/heads/published-episode\n", stderr: "" };
    }
    if (args[0] === "remote") {
      assert.ok([JSON.stringify(["remote", "get-url", "--all", "--", "delivery"]), JSON.stringify(["remote", "get-url", "--push", "--all", "--", "delivery"])].includes(JSON.stringify(args)));
      return { status: 0, stdout: "/isolated/fixture.git\n", stderr: "" };
    }
    if (args[0] === "ls-remote") {
      assert.deepEqual(args, ["ls-remote", "--refs", "--", "/isolated/fixture.git", "refs/heads/published-episode"]);
      return { status: 0, stdout: "", stderr: "" };
    }
    assert.deepEqual(args, ["show-ref", "--verify", "--quiet", "refs/heads/episode-cleanup"]);
    return { status: 1, stdout: "", stderr: "" };
  } };
  const record = parseEpisodeOwnership({ version: 2, status: "active", operationId: "op", engine: "local",
    ownerSessionId: "owner", taskId: "PRIMECLAW-1", taskPath: "backlog/tasks/task.md", baseRef: TASK_BASE,
    createdAt: "x", updatedAt: "x", worktree, branch: "episode-cleanup", head: TASK_BASE,
    episodeId: "episode", episodeSessionFile: sessionFile, episodeActiveSessionId: "route" });
  const adapter = new CliTaskEpisodeCleanupAdapter(root, TASK_BASE, { sessions, runner, git: { worktrees: () => [] } });
  assert.deepEqual(await adapter.inspect(record), { runtime: { cwd: worktree, idle: true } });
  await adapter.removeRuntime(record);
  assert.deepEqual(await adapter.inspect(record), {});
});

test("production cleanup adapter removes ID-only and path-only descendants without CWD or RLM ownership guesses", async () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-cleanup-descendants-"));
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  execFileSync("git", ["-C", root, "config", "user.name", "Fixture"]);
  execFileSync("git", ["-C", root, "config", "user.email", "fixture@example.test"]);
  writeFileSync(join(root, "README.md"), "base\n");
  execFileSync("git", ["-C", root, "add", "README.md"]);
  execFileSync("git", ["-C", root, "commit", "-qm", "base"]);
  const base = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const worktree = join(dirname(root), `${root.split("/").pop()}-wt`);
  execFileSync("git", ["-C", root, "worktree", "add", "-q", "-b", "episode-descendants", worktree, base]);
  const sessionFile = join(root, "episode.jsonl"); writeFileSync(sessionFile, "{}\n");
  configureCleanupUpstream(root, "episode-descendants");
  const childFiles = Array.from({ length: 6 }, (_, index) => join(root, `child-${index + 1}.jsonl`));
  for (const path of childFiles) writeFileSync(path, "{}\n");
  const parentAlias = join(root, "parent-alias.jsonl"); symlinkSync(sessionFile, parentAlias);
  let rows = [
    { activeSessionId: "route", sessionId: "episode", sessionFile, cwd: worktree, lifecycle: "live", activity: "idle", runtimeKind: "top-level", isSessionActive: false, isStreaming: false, isCompacting: false, attachedClients: 0, unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [] } },
    ...childFiles.map((path, index) => ({ sessionId: `child-${index + 1}`, sessionFile: path,
      // Neither working directory nor RLM metadata establishes session ownership.
      ...(index === 0 ? { cwd: root, runtimeKind: "top-level", rlmDepth: 99 } : {}),
      lifecycle: index === 5 ? "archived" : "live", activity: "idle",
      isSessionActive: false, isStreaming: false, isCompacting: false, attachedClients: 0,
      unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [] },
      ...(index < 3 ? { parentSessionId: "episode" } : { parentSessionPath: index === 5 ? parentAlias : sessionFile }),
      ...(index === 3 ? { activeSessionId: "child-route" } : {}),
    })),
  ];
  rows[0].parentSessionId = "conversation";
  const siblingFile = join(root, "possible-sibling.jsonl"); writeFileSync(siblingFile, "{}\n");
  rows.push({ sessionId: "possible-sibling", sessionFile: siblingFile, cwd: root, parentSessionId: "conversation" });
  const calls = [];
  const sessions = {
    async list() { return rows.map((row) => structuredClone(row)); },
    async getState(activeSessionId) {
      const row = rows.find((entry) => entry.activeSessionId === activeSessionId);
      return { ...structuredClone(row), isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false, sessionActions: { ...row.sessionActions, active: null } };
    },
    async kill(activeSessionId) { calls.push(["kill", activeSessionId]); rows = rows.map((row) => row.activeSessionId === activeSessionId ? Object.fromEntries(Object.entries(row).filter(([key]) => key !== "activeSessionId")) : row); },
    async deleteSaved(path) { calls.push(["delete", path]); if (existsSync(path)) unlinkSync(path); rows = rows.filter((row) => row.sessionFile !== path); },
  };
  // Saved histories can retain this CWD after their runtimes and parents are gone.
  // They are not owned descendants and must survive cleanup outside the worktree.
  const savedFiles = [join(root, "unrelated-saved.jsonl"), join(root, "orphan-saved.jsonl")];
  for (const path of savedFiles) writeFileSync(path, "saved history\n");
  rows.push(
    { sessionId: "unrelated-saved", sessionFile: savedFiles[0], cwd: worktree, isSessionActive: false },
    { sessionId: "orphan-saved", sessionFile: savedFiles[1], cwd: worktree, isSessionActive: false,
      parentSessionPath: join(root, "already-removed-parent.jsonl") },
  );
  const record = parseEpisodeOwnership({ version: 2, status: "active", operationId: "op", engine: "local", ownerSessionId: "owner", taskId: "PRIMECLAW-1", taskPath: "backlog/tasks/task.md", baseRef: base, createdAt: "x", updatedAt: "x", worktree, branch: "episode-descendants", head: base, episodeId: "episode", episodeSessionFile: sessionFile, episodeActiveSessionId: "route" });
  const adapter = new CliTaskEpisodeCleanupAdapter(root, base, { sessions });
  assert.equal((await adapter.inspect(record)).runtime.idle, true);
  await adapter.removeRuntime(record);
  assert.equal((await adapter.inspect(record)).runtime, undefined);
  assert.deepEqual(calls.filter(([kind]) => kind === "kill"), [["kill", "child-route"], ["kill", "route"]]);
  const deleted = calls.filter(([kind]) => kind === "delete").map(([, path]) => path);
  assert.equal(deleted.at(-1), sessionFile);
  assert.deepEqual(new Set(deleted.slice(0, -1)), new Set(childFiles));
  assert.equal(existsSync(siblingFile), true);
  assert.deepEqual(rows.map((row) => row.sessionId), ["possible-sibling", "unrelated-saved", "orphan-saved"]);
  await adapter.removeUpstream(record);
  await adapter.removeWorktree(record);
  await adapter.removeBranch(record);
  assert.deepEqual(await adapter.inspect(record), {});
  for (const path of savedFiles) assert.equal(readFileSync(path, "utf8"), "saved history\n");
});

test("production cleanup adapter removes nested descendants deepest-first and resumes exact partial deletion", async () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-cleanup-nested-"));
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  execFileSync("git", ["-C", root, "config", "user.name", "Fixture"]);
  execFileSync("git", ["-C", root, "config", "user.email", "fixture@example.test"]);
  writeFileSync(join(root, "README.md"), "base\n"); execFileSync("git", ["-C", root, "add", "README.md"]); execFileSync("git", ["-C", root, "commit", "-qm", "base"]);
  const base = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const worktree = join(dirname(root), `${root.split("/").pop()}-wt`); execFileSync("git", ["-C", root, "worktree", "add", "-q", "-b", "episode-nested", worktree, base]);
  configureCleanupUpstream(root, "episode-nested");
  const sessionFile = join(root, "episode.jsonl"), childFile = join(root, "child.jsonl"), grandchildFile = join(root, "grandchild.jsonl");
  for (const path of [sessionFile, childFile, grandchildFile]) writeFileSync(path, "{}\n");
  const idle = { lifecycle: "live", activity: "idle", isSessionActive: false, isStreaming: false, isCompacting: false, attachedClients: 0, unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [] } };
  let rows = [
    { ...idle, activeSessionId: "route", sessionId: "episode", sessionFile, cwd: worktree, runtimeKind: "top-level", rlmDepth: 0 },
    { ...idle, sessionId: "child", sessionFile: childFile, cwd: root, parentSessionId: "episode" },
    { ...idle, sessionId: "grandchild", sessionFile: grandchildFile, parentSessionPath: childFile },
  ];
  const calls = []; let childDeleteAttempts = 0;
  const sessions = {
    async list() { return rows.map((row) => structuredClone(row)); },
    async getState(activeSessionId) { const row = rows.find((entry) => entry.activeSessionId === activeSessionId); return { ...structuredClone(row), isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false, sessionActions: { ...row.sessionActions, active: null } }; },
    async kill(activeSessionId) { calls.push(["kill", activeSessionId]); rows = rows.map((row) => row.activeSessionId === activeSessionId ? Object.fromEntries(Object.entries(row).filter(([key]) => key !== "activeSessionId")) : row); },
    async deleteSaved(path) {
      calls.push(["delete", path]);
      if (path === childFile && childDeleteAttempts++ === 0) throw new Error("synthetic child deletion failure");
      if (existsSync(path)) unlinkSync(path); rows = rows.filter((row) => row.sessionFile !== path);
    },
  };
  const record = parseEpisodeOwnership({ version: 2, status: "active", operationId: "op", engine: "local", ownerSessionId: "owner", taskId: "PRIMECLAW-1", taskPath: "backlog/tasks/task.md", baseRef: base, createdAt: "x", updatedAt: "x", worktree, branch: "episode-nested", head: base, episodeId: "episode", episodeSessionFile: sessionFile, episodeActiveSessionId: "route" });
  const adapter = new CliTaskEpisodeCleanupAdapter(root, base, { sessions });
  await assert.rejects(adapter.removeRuntime(record), /synthetic child deletion failure/);
  assert.equal(existsSync(grandchildFile), false); assert.equal(existsSync(childFile), true); assert.equal(existsSync(sessionFile), true);
  assert.equal((await adapter.inspect(record)).runtime.idle, true);
  await adapter.removeRuntime(record);
  assert.equal((await adapter.inspect(record)).runtime, undefined);
  assert.deepEqual(calls.filter(([kind]) => kind === "delete").map(([, path]) => path), [grandchildFile, childFile, childFile, sessionFile]);
});

test("production cleanup adapter blocks busy, foreign, and ambiguous descendants before mutation", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-cleanup-collisions-"));
  execFileSync("git", ["init", "-q", "-b", "main", root]); execFileSync("git", ["-C", root, "config", "user.name", "Fixture"]); execFileSync("git", ["-C", root, "config", "user.email", "fixture@example.test"]);
  writeFileSync(join(root, "README.md"), "base\n"); execFileSync("git", ["-C", root, "add", "README.md"]); execFileSync("git", ["-C", root, "commit", "-qm", "base"]);
  const base = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const worktree = join(dirname(root), `${root.split("/").pop()}-wt`); execFileSync("git", ["-C", root, "worktree", "add", "-q", "-b", "episode-collisions", worktree, base]);
  configureCleanupUpstream(root, "episode-collisions");
  const sessionFile = join(root, "episode.jsonl"), childFile = join(root, "child.jsonl"), foreignFile = join(root, "foreign.jsonl");
  for (const path of [sessionFile, childFile, foreignFile]) writeFileSync(path, "{}\n");
  const idle = { lifecycle: "live", activity: "idle", isSessionActive: false, isStreaming: false, isCompacting: false, attachedClients: 0, unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [] } };
  const rootRow = { ...idle, activeSessionId: "route", sessionId: "episode", sessionFile, cwd: worktree, runtimeKind: "top-level", rlmDepth: 0 };
  const childRow = { ...idle, sessionId: "child", sessionFile: childFile, cwd: worktree, runtimeKind: "subagent", rlmDepth: 1, parentSessionId: "episode", parentSessionPath: sessionFile, rlmChildId: "sub-child" };
  let rows = []; const mutations = []; let listOverride;
  const sessions = {
    async list() {
      const listed = rows.map((row) => structuredClone(row));
      return listOverride ? listOverride(listed) : listed;
    },
    async getState(activeSessionId) {
      const row = rows.find((entry) => entry.activeSessionId === activeSessionId);
      const state = Object.fromEntries(Object.entries(structuredClone(row)).filter(([key]) => !["hasActiveHeartbeat", "hasRegisteredHeartbeat", "hasRegisteredCronJob"].includes(key)));
      return { ...state, isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false, sessionActions: { ...row.sessionActions, active: null } };
    },
    async kill(id) { mutations.push(["kill", id]); }, async deleteSaved(path) { mutations.push(["delete", path]); },
  };
  const record = parseEpisodeOwnership({ version: 2, status: "active", operationId: "op", engine: "local", ownerSessionId: "owner", taskId: "PRIMECLAW-1", taskPath: "backlog/tasks/task.md", baseRef: base, createdAt: "x", updatedAt: "x", worktree, branch: "episode-collisions", head: base, episodeId: "episode", episodeSessionFile: sessionFile, episodeActiveSessionId: "route" });
  const adapter = new CliTaskEpisodeCleanupAdapter(root, base, { sessions });
  await t.test("busy descendant", async () => {
    rows = [rootRow, { ...childRow, isStreaming: true }];
    assert.equal((await adapter.inspect(record)).runtime.idle, false);
    await assert.rejects(adapter.removeRuntime(record), /exact idle runtime/);
  });
  for (const flag of ["hasActiveHeartbeat", "hasRegisteredHeartbeat", "hasRegisteredCronJob"]) {
    await t.test(`routed root preserves list-reported ${flag}`, async () => {
      rows = [{ ...rootRow, [flag]: true }, childRow];
      assert.equal((await adapter.inspect(record)).runtime.idle, false);
      await assert.rejects(adapter.removeRuntime(record), /exact idle runtime/);
    });
    await t.test(`routed descendant preserves list-reported ${flag}`, async () => {
      rows = [rootRow, { ...childRow, activeSessionId: "child-route", [flag]: true }];
      assert.equal((await adapter.inspect(record)).runtime.idle, false);
      await assert.rejects(adapter.removeRuntime(record), /exact idle runtime/);
    });
  }
  await t.test("foreign same-worktree live runtime", async () => {
    rows = [rootRow, { ...idle, activeSessionId: "foreign-route", sessionId: "foreign", sessionFile: foreignFile, cwd: worktree, runtimeKind: "top-level" }];
    await assert.rejects(adapter.inspect(record), /foreign or duplicate Prime Agent session identity/);
  });
  await t.test("partial parent identity", async () => {
    rows = [rootRow, { ...childRow, parentSessionPath: foreignFile }];
    await assert.rejects(adapter.inspect(record), /ambiguous Prime Agent descendant parent chain/);
  });
  await t.test("present mismatched parent ID cannot be overridden by an exact path", async () => {
    rows = [rootRow, { ...childRow, parentSessionId: "wrong-parent" }];
    await assert.rejects(adapter.inspect(record), /ambiguous Prime Agent descendant parent chain/);
  });
  await t.test("routed descendant can use only its explicit parent path", async () => {
    rows = [rootRow, { ...childRow, activeSessionId: "child-route", parentSessionId: undefined }];
    assert.equal((await adapter.inspect(record)).runtime.idle, true);
  });
  await t.test("path-only descendant does not depend on RLM depth", async () => {
    rows = [rootRow, { ...childRow, parentSessionId: undefined, rlmDepth: 2 }];
    assert.equal((await adapter.inspect(record)).runtime.idle, true);
  });
  for (const [field, value] of [["isSessionActive", true], ["isSessionActive", undefined],
    ["isStreaming", undefined], ["isCompacting", undefined], ["sessionActions", undefined]]) {
    await t.test(`owned descendant without idle proof: ${field}=${value}`, async () => {
      rows = [rootRow, { ...childRow, [field]: value }];
      assert.equal((await adapter.inspect(record)).runtime.idle, false);
      await assert.rejects(adapter.removeRuntime(record), /Episode has not completed its work/);
    });
  }
  await t.test("active root blocks before mutation", async () => {
    rows = [{ ...rootRow, isSessionActive: true }, childRow];
    await assert.rejects(adapter.removeRuntime(record), /Episode has not completed its work/);
  });
  await t.test("duplicate explicit child identity blocks before mutation", async () => {
    rows = [rootRow, childRow, { ...childRow, sessionFile: foreignFile }];
    await assert.rejects(adapter.removeRuntime(record), /foreign or duplicate Prime Agent session identity/);
  });
  await t.test("path-only descendant identity is revalidated immediately before deletion", async () => {
    rows = [rootRow, { ...childRow, parentSessionId: undefined }];
    let listCalls = 0;
    listOverride = (listed) => {
      listCalls += 1;
      return listCalls === 4
        ? listed.map((row) => row.sessionId === "child" ? { ...row, activeSessionId: "late-route" } : row)
        : listed;
    };
    await assert.rejects(adapter.removeRuntime(record), /changed or busy Prime Agent session/);
    listOverride = undefined;
  });
  assert.deepEqual(mutations, []);
});

test("production cleanup adapter fails closed when a saved-session file is missing from daemon inventory", async () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-cleanup-untracked-"));
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  execFileSync("git", ["-C", root, "config", "user.name", "Fixture"]);
  execFileSync("git", ["-C", root, "config", "user.email", "fixture@example.test"]);
  writeFileSync(join(root, "README.md"), "base\n"); execFileSync("git", ["-C", root, "add", "."]); execFileSync("git", ["-C", root, "commit", "-qm", "base"]);
  const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const worktree = join(dirname(root), `${root.split("/").pop()}-wt`); execFileSync("git", ["-C", root, "worktree", "add", "-q", "-b", "episode-untracked", worktree, head]);
  configureCleanupUpstream(root, "episode-untracked");
  const sessionFile = join(root, "untracked.jsonl"); writeFileSync(sessionFile, "{}\n");
  const record = parseEpisodeOwnership({ version: 2, status: "active", operationId: "op", engine: "local", ownerSessionId: "owner", taskId: "PRIMECLAW-1", taskPath: "backlog/tasks/task.md", baseRef: head, createdAt: "x", updatedAt: "x", worktree, branch: "episode-untracked", head, episodeId: "episode", episodeSessionFile: sessionFile, episodeActiveSessionId: "route" });
  const sessions = { async list() { return []; }, async getState() { throw new Error("unused"); } };
  const adapter = new CliTaskEpisodeCleanupAdapter(root, head, { sessions });
  await assert.rejects(adapter.inspect(record), /untracked saved-session file/);
});


test("production Orca cleanup adapter force-removes only an exact verified-clean terminal-bearing worktree", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-cleanup-orca-"));
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  execFileSync("git", ["-C", root, "config", "user.name", "Fixture"]); execFileSync("git", ["-C", root, "config", "user.email", "fixture@example.test"]);
  writeFileSync(join(root, "README.md"), "base\n"); execFileSync("git", ["-C", root, "add", "."]); execFileSync("git", ["-C", root, "commit", "-qm", "base"]);
  const base = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const worktree = join(dirname(root), `${root.split("/").pop()}-wt`); execFileSync("git", ["-C", root, "worktree", "add", "-q", "-b", "episode-orca", worktree, base]);
  writeFileSync(join(worktree, "episode.txt"), "head\n"); execFileSync("git", ["-C", worktree, "add", "."]); execFileSync("git", ["-C", worktree, "commit", "-qm", "episode"]);
  const submodule = mkdtempSync(join(tmpdir(), "prime-claw-cleanup-submodule-"));
  t.after(() => rmSync(submodule, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q", submodule]);
  execFileSync("git", ["-C", submodule, "config", "user.name", "Fixture"]); execFileSync("git", ["-C", submodule, "config", "user.email", "fixture@example.test"]);
  writeFileSync(join(submodule, "data.txt"), "fixture\n"); execFileSync("git", ["-C", submodule, "add", "."]); execFileSync("git", ["-C", submodule, "commit", "-qm", "submodule"]);
  execFileSync("git", ["-C", worktree, "-c", "protocol.file.allow=always", "submodule", "add", "-q", submodule, "fixture-module"]);
  execFileSync("git", ["-C", worktree, "commit", "-qm", "initialized submodule"]);
  const head = execFileSync("git", ["-C", worktree, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  configureCleanupUpstream(root, "episode-orca");
  const sessionFile = join(root, "orca.jsonl"); writeFileSync(sessionFile, "{}\n");
  let sessionRows = [{ activeSessionId: "route", sessionId: "episode", sessionFile, cwd: worktree, isSessionActive: false, isStreaming: false, isCompacting: false, attachedClients: 0, unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [] } }];
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
    if (args[0] === "worktree" && args[1] === "rm") {
      assert.ok(args.includes("--force")); assert.equal(args.includes("TRUE"), false);
      assert.equal(execFileSync("git", ["-C", root, "ls-remote", "--refs", "--", "delivery", "refs/heads/episode-orca"], { encoding: "utf8" }).trim(), "", "remote must be absent before Orca can also delete the branch");
      execFileSync("git", ["-C", root, "worktree", "remove", "--force", "--", worktree]);
      execFileSync("git", ["-C", root, "branch", "-D", "episode-orca"]);
      terminalPresent = false; worktreePresent = false; return ok({ removed: true });
    }
    throw new Error(`unexpected Orca command ${args.join(" ")}`);
  } };
  const record = parseEpisodeOwnership({ version: 2, status: "active", operationId: "op", engine: "orca", ownerSessionId: "owner", taskId: "PRIMECLAW-1", taskPath: "backlog/tasks/task.md", baseRef: base, createdAt: "x", updatedAt: "x", projectSetupId: "setup", worktreeId: "wt", worktreeIdentity: "identity", worktree, branch: "episode-orca", head: base, episodeId: "episode", episodeSessionFile: sessionFile, episodeActiveSessionId: "route", terminalHandle: "term", terminalHandles: ["fallback", "term"] });
  const adapter = new CliTaskEpisodeCleanupAdapter(root, head, { sessions, runner });
  assert.ok((await adapter.inspect(record)).runtime);
  await adapter.removeRuntime(record);
  await adapter.removeUpstream(record);
  const mutations = () => calls.filter((args) => (args[0] === "worktree" && args[1] === "rm") || (args[0] === "terminal" && args[1] === "close"));
  writeFileSync(join(worktree, "dirty.txt"), "must survive refusal\n");
  await assert.rejects(adapter.removeWorktree(record), /clean worktree|dirty/i);
  assert.deepEqual(mutations(), []);
  assert.equal(existsSync(join(worktree, "dirty.txt")), true);
  unlinkSync(join(worktree, "dirty.txt"));
  execFileSync("git", ["-C", worktree, "config", "submodule.fixture-module.ignore", "all"]);
  const submoduleData = join(worktree, "fixture-module", "data.txt");
  writeFileSync(submoduleData, "ignored dirty submodule must survive\n");
  assert.equal(execFileSync("git", ["-C", worktree, "status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).trim(), "", "fixture hides submodule drift from default Git status");
  assert.equal((await adapter.inspect(record)).worktree.clean, false);
  await assert.rejects(adapter.removeWorktree(record), /clean worktree|dirty/i);
  assert.deepEqual(mutations(), []);
  assert.equal(readFileSync(submoduleData, "utf8"), "ignored dirty submodule must survive\n");
  writeFileSync(submoduleData, "fixture\n");
  execFileSync("git", ["-C", worktree, "config", "--unset", "submodule.fixture-module.ignore"]);
  await assert.rejects(adapter.removeWorktree({ ...record, worktreeIdentity: "foreign-identity" }), /(?:foreign|changed).*worktree/i);
  assert.deepEqual(mutations(), []);
  assert.equal(existsSync(worktree), true);
  await adapter.removeWorktree(record);
  assert.deepEqual(await adapter.inspect(record), {}, "same invocation verifies native Orca branch/config deletion using resolved upstream");
  assert.equal(calls.some((args) => args[0] === "terminal" && args[1] === "close"), false);
  const remove = calls.find((args) => args[0] === "worktree" && args[1] === "rm");
  assert.ok(remove.includes("id:wt"));
  assert.ok(remove.includes("--force")); assert.equal(remove.includes("TRUE"), false);
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


test("active task Episode continuity proves exact idle durable route and rejects missing or busy runtime", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-continuity-")));
  const worktree = join(root, "episode"); mkdirSync(worktree);
  const sessionFile = join(root, "episode.jsonl"); writeFileSync(sessionFile, "{}\n");
  const record = parseEpisodeOwnership({
    version: 2, status: "active", operationId: "operation-continuity", engine: "local",
    ownerSessionId: "owner-continuity", taskId: "TASK-1", taskPath: "backlog/tasks/task-1.md",
    baseRef: "a".repeat(40), createdAt: "2026-10-27T00:00:00.000Z", updatedAt: "2026-10-27T00:00:00.000Z",
    worktree, branch: "episode/continuity", head: "b".repeat(40), episodeId: "episode-continuity",
    episodeSessionFile: sessionFile, episodeActiveSessionId: "old-route",
  });
  const git = { worktrees: () => [{ path: worktree, branch: record.branch }] };
  const filesystem = { exists: () => true, hasActiveLegacyPlanFiles: () => true, promoteBundle() {}, removeWorktree() {} };
  const idleState = {
    activeSessionId: "new-route", sessionId: record.episodeId, sessionFile,
    isSessionActive: false, isStreaming: false, isCompacting: false, isBashRunning: false,
    isRunningTools: false, hasRunningRlmChildren: false, unfinishedActionCount: 0,
    sessionActions: { queuedCount: 0, steering: [], followUps: [], active: null },
  };
  const summary = { sessionId: record.episodeId, sessionFile, cwd: worktree, activeSessionId: "new-route", isSessionActive: false, isStreaming: false, isCompacting: false, queuedCount: 0 };
  const publisher = { list: async () => [summary], getState: async () => idleState, close() {} };
  try {
    const proofs = await verifyActiveTaskEpisodeContinuity(root, [record], { git, filesystem, publisher });
    assert.deepEqual(proofs, [{ ownerSessionId: record.ownerSessionId, expectedPreviousEpisodeActiveSessionId: "old-route", verifiedCurrentEpisodeActiveSessionId: "new-route" }]);
    await assert.rejects(() => verifyActiveTaskEpisodeContinuity(root, [record], { git, filesystem, publisher: { ...publisher, list: async () => [] } }), /one durable Episode session/);
    await assert.rejects(() => verifyActiveTaskEpisodeContinuity(root, [record], { git, filesystem, publisher: { ...publisher, list: async () => [{ ...summary, isSessionActive: true }] } }), /idle Episode summary/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
