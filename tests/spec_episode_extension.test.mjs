import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  CliGitAdapter, CliOrcaAdapter, CliTaskEpisodeAdmissionGit,
  EpisodeStateUncertainError, OrcaMutationUncertainError, OrcaUnavailableError,
  allocateReservedTaskEpisode, bundleContentDigest, createSpecEpisode, handoffSpecEpisode,
  handoffTaskEpisode, publishTaskEpisodeBlocked, publishTaskEpisodeResumed,
  publishTaskEpisodeReadyForMerge, integrateTaskEpisodeReadyForMerge,
  verifyTaskEpisodeReadyForMerge, delayTaskEpisodeReadyForMerge,
  mergeTaskEpisodeReadyForMerge,
  publishTaskEpisodeChangesRequested, integrateTaskEpisodeChangesRequested,
  verifyTaskEpisodeChangesRequested, resumeTaskEpisodeChangesRequested,
  resolveBlockedWorkflowAuthority, resolveTaskReviewSnapshot,
} from "../src/prime-agent-plugin/extension-support/spec-episode.ts";
import { parseEpisodeOwnership } from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";

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
  const filesystem = { exists: (path) => options.unavailable ? !String(path).includes("-alpha-episode-") : true, promoteBundle(path) { calls.push(["promote", path]); } };
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
  return parseEpisodeOwnership({
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
  const result = await allocateReservedTaskEpisode("PRIMECLAW-10.38", f.ctx, f.deps);
  assert.equal(result.version, 2);
  assert.equal(result.engine, "orca");
  assert.equal(result.status, "active");
  assert.equal(result.head, TASK_BASE);
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
