import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  createReviewedPlanExtension,
  maybeDeliverConversationAfterHandoff,
  normalizeConversationCompactionThreshold,
} from "../src/prime-agent-plugin/extensions/reviewed-plan.ts";
import { resolveBacklogTask } from "../src/prime-agent-plugin/extension-support/reviewed-plan-support.ts";
import { reconcileLegacySpecificationInventory } from "../src/prime-agent-plugin/extension-support/legacy-specification-inventory.ts";
import { writeEpisodeOwnership } from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";

function fixture({ throwOnSend = 0, taskStatus = "In Design", providerTaskResolver, placementResolver, usage = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-reviewed-")); execFileSync("git", ["init", "-q", root]);
  for (const slug of ["alpha", "beta"]) {
    const folder = join(root, ".ralph", "plans", "future", slug);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "SPECIFICATION.md"), `${slug} specification\n`);
    writeFileSync(join(folder, "EXECUTION_PLAN.md"), `Implement ${slug} within its retained scope.\n`);
  }
  reconcileLegacySpecificationInventory(root, "initialize");
  mkdirSync(join(root, ".prime-claw", "workflows"), { recursive: true });
  for (const name of ["plan-prep", "plan-spec", "plan-task-prep", "plan-task", "implement-prep", "implement-spec", "implement-task-prep", "implement-task", "handoff"]) writeFileSync(join(root, ".prime-claw", "workflows", `${name}.md`), `---
name: ${name}
---
${name.toUpperCase()} POLICY
`);
  writeFileSync(join(root, ".prime-claw", "workflows", "conversation-after-handoff.md"), `---
name: conversation-after-handoff
threshold_percent: 60
---
AFTER-HANDOFF POLICY
`);
  mkdirSync(join(root, ".agents", "skills", "execute"), { recursive: true }); writeFileSync(join(root, ".agents", "skills", "execute", "SKILL.md"), "EXECUTE POLICY");
  const guideRoot = join(root, "plugin"); mkdirSync(join(guideRoot, "skills", "prime-claw-oversee-episode"), { recursive: true }); writeFileSync(join(guideRoot, "skills", "prime-claw-oversee-episode", "SKILL.md"), `FULL OVERSIGHT GUIDE
`);
  const commands = new Map(), tools = new Map(), events = new Map(), sent = [], created = [], restored = [], transitioned = [], resolved = [], taskCalls = [];
  let sendCount = 0;
  const pi = { registerCommand(name, value) { commands.set(name, value); }, registerTool(tool) { tools.set(tool.name, tool); }, on(name, handler) { events.set(name, handler); }, sendUserMessage(message, options) { sendCount += 1; if (sendCount === throwOnSend) throw new Error("synthetic send failure"); sent.push({ message, options }); }, async sendMessage() {} };
  const ctx = { cwd: root, hasUI: true, ui: { notify(message, level) { sent.push({ notify: message, level }); } }, sessionManager: { getSessionId: () => "owner", getSessionFile: () => join(root, "owner.jsonl"), getHeader: () => ({ rlmDepth: 0 }) }, getContextUsage: () => usage == null ? undefined : { tokens: 1, contextWindow: 100, percent: usage } };
  const episode = { version: 1, status: "active", operationId: "op", engine: "local", ownerSessionId: "owner", sourceLocation: ".ralph/plans/future/alpha", slug: "alpha", baseRef: "base", bundleDigest: "0".repeat(64), createdAt: "x", updatedAt: "x", worktree: join(root, "wt"), branch: "branch", head: "head", episodeId: "episode", episodeSessionFile: join(root, "episode.jsonl"), episodeActiveSessionId: "route", reused: false };
  const taskActions = {
    async create(taskId, toolCallId, callCtx, _dependencies, placement) { taskCalls.push(["create", taskId, placement]); return { version: 2, status: "active", taskId, episodeId: "task-episode", episodeActiveSessionId: "task-route", reused: false }; },
    async handoff(taskId, guidance) { taskCalls.push(["handoff", taskId, guidance]); return { admitted: true, taskId, episodeId: "task-episode", episodeActiveSessionId: "task-route", handoffDelivery: "prompt", executeDelivery: "followUp" }; },
    async cleanup(taskId, episodeHead, outcome) { taskCalls.push(["cleanup", taskId, episodeHead, outcome]); return { verified: true, outcome, taskId, episodeHead, resourcesRemoved: true, ownershipRemoved: true }; },
  };
  const deps = { guideRoot, taskActions, taskCleanup: {}, taskCleanupGit: { repositoryRoot: () => root }, taskResolver(cwd, rawTaskId) { resolved.push({ cwd, rawTaskId }); if (rawTaskId.trim() === "missing") return null; return { taskId: "PRIMECLAW-10.38", title: "Planning fixture", status: taskStatus, implementationPlan: taskStatus === "In Planning" ? "Implement exact fixture" : null, projectRoot: root, taskPath: join(root, "task.md"), taskPathRelative: "task.md" }; }, ...(providerTaskResolver ? { providerTaskResolver } : {}), async placementResolver(...args) { return placementResolver ? placementResolver(...args) : args[1] ? { engine: "orca", projectSetupId: args[1].slice(3) } : { engine: "local" }; }, async createEpisode(location, toolCallId, callCtx, _deps, options) { created.push({ location, toolCallId, callCtx, options }); return episode; }, async restoreBlockedEpisode(location, confirmedUnblocked) { restored.push({location,confirmedUnblocked}); return { restored:true, sourceLocation:episode.sourceLocation, episodeId:"episode", worktree:episode.worktree, specification:join(episode.worktree,".ralph/plans/SPECIFICATION.md"), implementation:join(episode.worktree,".ralph/plans/EXECUTION_PLAN.md") }; }, transitionLegacyOwnership(location, taskId, episodeHead, mainHead, confirmedReady, callCtx, transitionDependencies) { transitioned.push({ location, taskId, episodeHead, mainHead, confirmedReady, callCtx, transitionDependencies }); return { record: { ...episode, version: 2, taskId, taskPath: "task.md" }, reused: false, mainHead, episodeHead, activeSpecification: { path: ".ralph/plans/SPECIFICATION.md", blob: "a".repeat(40) }, activeImplementationPlan: { path: ".ralph/plans/EXECUTION_PLAN.md", blob: "b".repeat(40) } }; }, async handoffEpisode() { return { admitted: true, sourceLocation: episode.sourceLocation, episodeId: "episode", episodeActiveSessionId: "route", handoffDelivery: "prompt", executeDelivery: "followUp" }; } };
  createReviewedPlanExtension(deps)(pi);
  return { root, commands, tools, events, sent, created, restored, transitioned, resolved, taskCalls, ctx, episode, deps, pi, afterHandoffPath: join(root, ".prime-claw", "workflows", "conversation-after-handoff.md") };
}

test("registers complete task lifecycle beside retained folder compatibility", () => {
  const f = fixture();
  assert.deepEqual([...f.commands.keys()], []);
  assert.deepEqual([...f.tools.keys()].sort(), [
    "create_spec_episode", "create_task_episode", "finalize_spec_episode", "finalize_task_episode",
    "handoff_spec_episode", "handoff_task_episode", "implement_spec", "implement_task", "plan_spec", "plan_task", "restore_blocked_spec_episode",
    "transition_spec_episode_to_task",
  ]);
  assert.equal(f.tools.has("ralph_plan"), false);
  assert.equal(f.tools.has("prime_claw_activate_conversation_guide"), false);
  assert.equal(f.tools.has("prime_claw_conversation_guide_status"), false);
  const planTaskSchema = f.tools.get("plan_task").parameters;
  assert.deepEqual(Object.keys(planTaskSchema.properties), ["taskId"]);
  assert.deepEqual(planTaskSchema.required, ["taskId"]);
});

test("plan_spec tool steers prep and queues sole plan-spec follow-up", async () => {
  const f = fixture(); const result = await f.tools.get("plan_spec").execute("tool", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(result.details.admitted, true); assert.deepEqual(f.sent[0].options, { deliverAs: "steer" }); assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });
  assert.match(result.content[0].text, /Planning admitted/);
});

test("retained planning admits only the inventoried frozen specification while plans remain living", async () => {
  const living = fixture();
  writeFileSync(join(living.root, ".ralph", "plans", "future", "alpha", "EXECUTION_PLAN.md"), "living plan changed after upgrade\n");
  const admitted = await living.tools.get("plan_spec").execute("living", { location: ".ralph/plans/future/alpha" }, undefined, undefined, living.ctx);
  assert.equal(admitted.details.admitted, true);

  const revised = fixture();
  writeFileSync(join(revised.root, ".ralph", "plans", "future", "alpha", "SPECIFICATION.md"), "revised after upgrade\n");
  const changed = await revised.tools.get("plan_spec").execute("changed", { location: ".ralph/plans/future/alpha" }, undefined, undefined, revised.ctx);
  assert.equal(changed.isError, true); assert.equal(revised.sent.length, 0); assert.match(changed.content[0].text, /changed after grandfathering/);

  const later = fixture();
  const gamma = join(later.root, ".ralph", "plans", "future", "gamma");
  mkdirSync(gamma, { recursive: true }); writeFileSync(join(gamma, "SPECIFICATION.md"), "new legacy work\n");
  const rejected = await later.tools.get("plan_spec").execute("new", { location: ".ralph/plans/future/gamma" }, undefined, undefined, later.ctx);
  assert.equal(rejected.isError, true); assert.equal(later.sent.length, 0); assert.match(rejected.content[0].text, /not grandfathered.*selected-provider task UX/);
});

test("registered retained routes reject a symlinked source directory before delivery", async () => {
  const f = fixture(), future = join(f.root, ".ralph", "plans", "future");
  renameSync(join(future, "alpha"), join(future, ".alpha-storage"));
  symlinkSync(join(future, ".alpha-storage"), join(future, "alpha"), "dir");
  const planned = await f.tools.get("plan_spec").execute("unsafe", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(planned.isError, true); assert.equal(f.sent.length, 0); assert.match(planned.content[0].text, /must be a real directory/);
  const implemented = await f.tools.get("implement_spec").execute("entry", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(implemented.isError, true); assert.equal(f.sent.length, 0); assert.match(implemented.content[0].text, /must be a real directory/);
});

test("plan_task resolves one exact task and preserves prep then sole phase follow-up", async () => {
  const f = fixture(); await f.tools.get("plan_task").execute("entry", { taskId: "10.38" }, undefined, undefined, f.ctx);
  assert.deepEqual(f.resolved, [{ cwd: f.root, rawTaskId: "10.38" }]);
  assert.equal(f.sent.length, 2); assert.match(f.sent[0].message, /PLAN-TASK-PREP POLICY/); assert.deepEqual(f.sent[0].options, { deliverAs: "steer" });
  assert.ok(f.sent[0].message.includes("<operator-plan-task-id>\nPRIMECLAW-10.38\n</operator-plan-task-id>"));
  for (const message of f.sent.map(({ message }) => message)) {
    assert.ok(message.includes("<operator-plan-task-provider>\nbacklog\n</operator-plan-task-provider>"));
    assert.ok(message.includes(`<operator-plan-task-project-root>\n${f.root}\n</operator-plan-task-project-root>`));
    assert.ok(message.includes("<operator-plan-task-path>\ntask.md\n</operator-plan-task-path>"));
  }
  assert.match(f.sent[1].message, /PLAN-TASK POLICY/); assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });
});

test("registered Beads planning route binds exact provider/root with no invented task path", async () => {
  const calls = [];
  const providerTaskResolver = (cwd, taskId) => {
    calls.push({ cwd, taskId });
    return {
      provider: "beads", taskId: "BEADS-42", title: "Native planning fixture",
      nativeStatus: "in_design", status: "In Design", projectRoot: cwd,
      nativeView: {
        id: "BEADS-42", title: "Native planning fixture", status: "in_design",
        description: "Reviewed outcome", design: "Current living plan", comments: [],
      },
    };
  };
  const native = fixture({ providerTaskResolver });
  await native.tools.get("plan_task").execute("entry", { taskId: "BEADS-42" }, undefined, undefined, native.ctx);
  assert.deepEqual(calls, [{ cwd: native.root, taskId: "BEADS-42" }]);
  assert.equal(native.sent.length, 2);
  assert.deepEqual(native.sent[0].options, { deliverAs: "steer" });
  assert.deepEqual(native.sent[1].options, { deliverAs: "followUp" });
  for (const message of native.sent.map(({ message }) => message)) {
    assert.ok(message.includes("<operator-plan-task-id>\nBEADS-42\n</operator-plan-task-id>"));
    assert.ok(message.includes("<operator-plan-task-provider>\nbeads\n</operator-plan-task-provider>"));
    assert.ok(message.includes(`<operator-plan-task-project-root>\n${native.root}\n</operator-plan-task-project-root>`));
    assert.doesNotMatch(message, /<operator-plan-task-path>\n/);
  }

  const tool = fixture({ providerTaskResolver });
  const result = await tool.tools.get("plan_task").execute(
    "plan-beads", { taskId: "BEADS-42" }, undefined, undefined, tool.ctx,
  );
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.details, { admitted: true, taskId: "BEADS-42" });
  assert.deepEqual(tool.sent[0].options, { deliverAs: "steer" });
  assert.deepEqual(tool.sent[1].options, { deliverAs: "followUp" });
});

test("registered Beads planning rejects shorthand identity and later status before delivery", async () => {
  for (const drift of ["identity", "status"]) {
    const f = fixture({
      providerTaskResolver(cwd) {
        return {
          provider: "beads", taskId: drift === "identity" ? "BEADS-42-full" : "BEADS-42",
          title: "Native planning fixture", nativeStatus: drift === "status" ? "in_progress" : "in_design",
          status: drift === "status" ? "In Progress" : "In Design", projectRoot: cwd,
          nativeView: { id: "BEADS-42", title: "Native planning fixture", status: "in_design", design: "Plan" },
        };
      },
    });
    const result = await f.tools.get("plan_task").execute(
      `plan-beads-${drift}`, { taskId: "BEADS-42" }, undefined, undefined, f.ctx,
    );
    assert.equal(result.isError, true, drift);
    assert.equal(f.sent.length, 0, drift);
    assert.match(result.content[0].text, drift === "identity" ? /different canonical ID/ : /accepts only In Design or In Planning/);
  }
});

test("plan_task steers prep, queues sole phase follow-up, and returns canonical identity", async () => {
  const f = fixture({ taskStatus: "In Planning" }); const result = await f.tools.get("plan_task").execute("tool", { taskId: "10.38" }, undefined, undefined, f.ctx);
  assert.equal(result.details.admitted, true); assert.equal(result.details.taskId, "PRIMECLAW-10.38");
  assert.deepEqual(f.sent[0].options, { deliverAs: "steer" }); assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });
  assert.match(result.content[0].text, /Planning admitted for PRIMECLAW-10\.38/);
});

test("task planning rejects missing and disallowed-state tasks before workflow admission", async () => {
  const missing = fixture(); const absent = await missing.tools.get("plan_task").execute("missing", { taskId: "missing" }, undefined, undefined, missing.ctx);
  assert.equal(absent.isError, true); assert.equal(missing.sent.length, 0); assert.match(absent.content[0].text, /plan_task requires one exact/);
  for (const taskStatus of ["To Do", "In Progress", "Blocked", "Ready for Merge", "Done"]) {
    const later = fixture({ taskStatus }); const result = await later.tools.get("plan_task").execute("tool", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, later.ctx);
    assert.equal(result.isError, true); assert.equal(later.sent.length, 0); assert.match(result.content[0].text, /accepts only In Design or In Planning/);
  }
});

test("task planning missing phase workflow fails before either message is sent", async () => {
  const f = fixture(); unlinkSync(join(f.root, ".prime-claw", "workflows", "plan-task.md"));
  const result = await f.tools.get("plan_task").execute("tool", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, true); assert.equal(f.sent.length, 0); assert.match(result.content[0].text, /plan-task\.md not found/);
});

test("implement-spec queues full ordinary guide in post-prep phase before semantic workflow", async () => {
  const f = fixture(); await f.tools.get("implement_spec").execute("entry", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(f.sent.length, 2); assert.match(f.sent[0].message, /IMPLEMENT-PREP POLICY/);
  assert.ok(f.sent[1].message.indexOf("FULL OVERSIGHT GUIDE") < f.sent[1].message.indexOf("IMPLEMENT-SPEC POLICY"));
  assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });
});

test("implement_spec carries exact retained path and factual host to final create", async () => {
  const f = fixture();
  await f.tools.get("implement_spec").execute("entry", { location: ".ralph/plans/future/alpha", host: "id:123e4567-e89b-12d3-a456-426614174000" }, undefined, undefined, f.ctx);
  assert.deepEqual(f.resolved, []);
  assert.equal(f.sent.length, 2); assert.match(f.sent[0].message, /IMPLEMENT-PREP POLICY/);
  assert.match(f.sent[1].message, /IMPLEMENT-SPEC POLICY/);
  assert.match(f.sent[0].message, /id:123e4567-e89b-12d3-a456-426614174000/);
  assert.match(f.sent[1].message, /id:123e4567-e89b-12d3-a456-426614174000/);
  const result = await f.tools.get("create_spec_episode").execute("common", { location: ".ralph/plans/future/alpha", host: "id:123e4567-e89b-12d3-a456-426614174000" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined, JSON.stringify(result));
  assert.equal(f.created[0].options.host, "id:123e4567-e89b-12d3-a456-426614174000");
});


test("registered implement-spec replays the exact active Episode after its source folder is absent", async () => {
  const f = fixture();
  const plans = join(f.episode.worktree, ".ralph", "plans"); mkdirSync(plans, { recursive: true });
  writeFileSync(join(plans, "SPECIFICATION.md"), "alpha specification\n");
  writeFileSync(join(plans, "EXECUTION_PLAN.md"), "living replay plan\n");
  const { reused: _reused, ...record } = f.episode;
  writeEpisodeOwnership(f.root, record);
  rmSync(join(f.root, ".ralph", "plans", "future", "alpha"), { recursive: true });
  f.deps.createEpisode = async (location, toolCallId, callCtx, _deps, options) => {
    f.created.push({ location, toolCallId, callCtx, options });
    return { ...record, reused: true };
  };

  await f.tools.get("implement_spec").execute("entry", { location: record.sourceLocation }, undefined, undefined, f.ctx);
  assert.equal(f.sent.length, 2); assert.match(f.sent[0].message, /IMPLEMENT-PREP POLICY/);
  assert.match(f.sent[1].message, /IMPLEMENT-SPEC POLICY/);
  const result = await f.tools.get("create_spec_episode").execute("replay", { location: record.sourceLocation }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined, JSON.stringify(result)); assert.equal(result.details.reused, true);
  assert.equal(f.created.length, 1); assert.equal(f.created[0].location, record.sourceLocation);
  assert.deepEqual(f.created[0].options, { host: undefined });
});

test("implement_spec checks exact active replay before obsolete source lookup and keeps recorded placement", async () => {
  const f = fixture({ placementResolver: async () => { throw new Error("replay must not select another placement"); } });
  const plans = join(f.episode.worktree, ".ralph", "plans"); mkdirSync(plans, { recursive: true });
  writeFileSync(join(plans, "SPECIFICATION.md"), "alpha specification\n");
  writeFileSync(join(plans, "EXECUTION_PLAN.md"), "Continue the living retained plan.\n");
  const { reused: _reused, ...record } = f.episode; writeEpisodeOwnership(f.root, record);
  rmSync(join(f.root, ".ralph", "plans", "future", "alpha"), { recursive: true });
  symlinkSync(join(f.root, "missing-obsolete-source"), join(f.root, ".ralph", "plans", "future", "alpha"), "dir");
  const result = await f.tools.get("implement_spec").execute("replay", { location: record.sourceLocation }, undefined, undefined, f.ctx);
  assert.equal(result.details.admitted, true, JSON.stringify(result)); assert.equal(f.sent.length, 2); assert.equal(f.created.length, 0);
  const mismatch = await f.tools.get("implement_spec").execute("wrong-host", { location: record.sourceLocation, host: "id:123e4567-e89b-12d3-a456-426614174000" }, undefined, undefined, f.ctx);
  assert.equal(mismatch.isError, true); assert.match(mismatch.content[0].text, /does not match.*placement/);
  assert.equal(f.sent.length, 2);
});

test("source-absent replay rejects promoted specification drift before workflow delivery", async () => {
  const f = fixture();
  const plans = join(f.episode.worktree, ".ralph", "plans"); mkdirSync(plans, { recursive: true });
  writeFileSync(join(plans, "SPECIFICATION.md"), "changed promoted specification\n");
  writeFileSync(join(plans, "EXECUTION_PLAN.md"), "living replay plan\n");
  const { reused: _reused, ...record } = f.episode; writeEpisodeOwnership(f.root, record);
  rmSync(join(f.root, ".ralph", "plans", "future", "alpha"), { recursive: true });
  const result = await f.tools.get("implement_spec").execute("entry", { location: record.sourceLocation }, undefined, undefined, f.ctx);
  assert.equal(result.isError, true); assert.equal(f.sent.length, 0); assert.match(result.content[0].text, /changed after grandfathering/);
});

test("implement_task preserves compact-first routing without task invocation proof", async () => {
  const f = fixture({ taskStatus: "In Planning" });
  await f.tools.get("implement_task").execute("entry", { taskId: "10.38" }, undefined, undefined, f.ctx);
  assert.equal(f.sent.length, 2);
  assert.match(f.sent[0].message, /IMPLEMENT-TASK-PREP POLICY/);
  assert.deepEqual(f.sent[0].options, { deliverAs: "steer" });
  assert.match(f.sent[1].message, /IMPLEMENT-TASK POLICY/);
  assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });
  assert.equal(f.taskCalls.length, 0);
});

test("create_task_episode resolves current task and placement without prior entry or agent-end hooks", async () => {
  const f = fixture({ taskStatus: "In Planning" });
  const result = await f.tools.get("create_task_episode").execute("create", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined);
  assert.equal(result.details.episodeId, "task-episode");
  assert.deepEqual(f.taskCalls, [["create", "PRIMECLAW-10.38", { engine: "local" }]]);
  assert.equal(f.sent.length, 0);
  assert.deepEqual(f.resolved, [{ cwd: f.root, rawTaskId: "PRIMECLAW-10.38" }]);
});

test("registered Beads implementation entry preserves exact identity and one create dispatch", async () => {
  const calls = [];
  const f = fixture({ providerTaskResolver(cwd, taskId) {
    calls.push({ cwd, taskId });
    return {
      provider: "beads", taskId: "BEADS-42", title: "Native fixture",
      nativeStatus: "in_planning", status: "In Planning", projectRoot: cwd,
      nativeView: { id: "BEADS-42", status: "in_planning", design: "Implement exact native change" },
    };
  } });
  const entry = await f.tools.get("implement_task").execute("entry", { taskId: "BEADS-42" }, undefined, undefined, f.ctx);
  assert.equal(entry.isError, undefined);
  assert.equal(f.sent.length, 2);
  assert.deepEqual(f.sent[0].options, { deliverAs: "steer" });
  assert.ok(f.sent[0].message.includes("<operator-implementation-task-id>\nBEADS-42\n</operator-implementation-task-id>"));
  assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });
  assert.equal(f.taskCalls.length, 0);
  for (const { message } of f.sent) {
    assert.ok(message.includes("<operator-implementation-task-provider>\nbeads\n</operator-implementation-task-provider>"));
    assert.ok(message.includes(`<operator-implementation-task-project-root>\n${f.root}\n</operator-implementation-task-project-root>`));
    assert.equal(message.includes("<operator-implementation-task-path>"), false);
  }
  const result = await f.tools.get("create_task_episode").execute("create", { taskId: "BEADS-42" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined);
  assert.match(result.content[0].text, /One fixed execute assignment/);
  assert.match(result.content[0].text, /Exact provider-native result/);
  assert.deepEqual(f.taskCalls, [["create", "BEADS-42", { engine: "local" }]]);
  assert.deepEqual(calls.map(({ taskId }) => taskId), ["BEADS-42", "BEADS-42"]);
});

test("create_task_episode rejects unavailable provider, noncanonical identity, invalid status or missing plan before dispatch", async () => {
  for (const invalid of ["missing", "provider", "identity", "status", "native-status", "plan"]) {
    const f = fixture({ providerTaskResolver(cwd) {
      if (invalid === "missing") return null;
      return {
        provider: invalid === "provider" ? "unsupported" : "beads",
        taskId: invalid === "identity" ? "BEADS-OTHER" : "BEADS-42", title: "Native fixture",
        nativeStatus: invalid === "native-status" ? "open" : "in_planning",
        status: invalid === "status" ? "In Progress" : "In Planning", projectRoot: cwd,
        nativeView: { id: "BEADS-42", status: "in_planning", design: invalid === "plan" ? "" : "Implement exact change" },
      };
    } });
    const result = await f.tools.get("create_task_episode").execute("invalid", { taskId: "BEADS-42" }, undefined, undefined, f.ctx);
    assert.equal(result.isError, true, invalid);
    assert.equal(f.taskCalls.length, 0, invalid);
  }
  const f = fixture({ taskStatus: "In Planning" });
  const result = await f.tools.get("create_task_episode").execute("shorthand", { taskId: "10.38" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /different canonical ID/);
  assert.equal(f.taskCalls.length, 0);
});

test("final create resolves supplied stable host afresh and refuses placement failures before dispatch", async () => {
  const host = "id:123e4567-e89b-12d3-a456-426614174000", placements = [];
  const f = fixture({ taskStatus: "In Planning", async placementResolver(projectRoot, selectedHost) {
    placements.push({ projectRoot, host: selectedHost });
    return { engine: "orca", projectSetupId: selectedHost.slice(3) };
  } });
  const result = await f.tools.get("create_task_episode").execute("create", { taskId: "PRIMECLAW-10.38", host }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined);
  assert.deepEqual(placements, [{ projectRoot: f.root, host }]);
  assert.deepEqual(f.taskCalls, [["create", "PRIMECLAW-10.38", { engine: "orca", projectSetupId: host.slice(3) }]]);
  for (const reason of ["selection cancelled", "stable host is not ready"]) {
    const failed = fixture({ taskStatus: "In Planning", async placementResolver() { throw new Error(reason); } });
    const failure = await failed.tools.get("create_task_episode").execute("create", { taskId: "PRIMECLAW-10.38", host }, undefined, undefined, failed.ctx);
    assert.equal(failure.isError, true);
    assert.match(failure.content[0].text, new RegExp(reason));
    assert.equal(failed.taskCalls.length, 0);
  }
});

test("task handoff remains disjoint from retained folder handoff", async () => {
  const f = fixture({ taskStatus: "In Progress" });
  const result = await f.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38", guidance: "accepted repair" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined);
  assert.deepEqual(f.taskCalls, [["handoff", "PRIMECLAW-10.38", "accepted repair"]]);
  assert.equal(f.created.length, 0);
});

test("finalize_task_episode exposes only terminal identity without second confirmation", () => {
  const f = fixture(); const tool = f.tools.get("finalize_task_episode");
  assert.deepEqual(Object.keys(tool.parameters.properties).sort(), ["episodeHead", "outcome", "taskId"]);
  assert.deepEqual([...tool.parameters.required].sort(), ["episodeHead", "outcome", "taskId"]);
  assert.deepEqual(tool.parameters.properties.outcome.enum, ["merged", "abandoned"]);
  assert.equal(tool.parameters.additionalProperties, false);
  assert.doesNotMatch(tool.promptSnippet + tool.promptGuidelines.join(" "), /separate.*authority|confirmed:|explicit operator cleanup authority/);
  // Retained version-1 bookkeeping remains a distinct, unchanged boundary.
  const legacy = f.tools.get("finalize_spec_episode");
  assert.deepEqual(Object.keys(legacy.parameters.properties), ["location"]);
  assert.deepEqual(legacy.parameters.required, ["location"]);
  assert.match(legacy.promptGuidelines.join(" "), /operator.*terminal decision/);
});

test("finalize_task_episode forwards merged or abandoned identity without confirmed", async () => {
  for (const outcome of ["merged", "abandoned"]) {
    const f = fixture(); const tool = f.tools.get("finalize_task_episode");
    const cleaned = await tool.execute("cleanup", {
      taskId: "PRIMECLAW-10.38", episodeHead: "e".repeat(40), outcome,
    }, undefined, undefined, f.ctx);
    assert.equal(cleaned.isError, undefined);
    assert.equal(cleaned.details.result.ownershipRemoved, true);
    assert.deepEqual(f.taskCalls, [["cleanup", "PRIMECLAW-10.38", "e".repeat(40), outcome]]);
    assert.equal(f.sent.length, 0);
  }
});

test("cleanup returns provider error once; only a caller with fresh evidence re-invokes", async () => {
  const f = fixture(); const tool = f.tools.get("finalize_task_episode"); let calls = 0;
  f.deps.taskActions.cleanup = async () => { calls += 1; throw new Error("provider removal failed; ownership retained"); };
  const params = { taskId: "PRIMECLAW-10.38", episodeHead: "e".repeat(40), outcome: "merged" };
  const failed = await tool.execute("cleanup", params, undefined, undefined, f.ctx);
  assert.equal(failed.isError, true);
  assert.deepEqual(failed.details, { taskId: params.taskId, error: "provider removal failed; ownership retained" });
  assert.match(failed.content[0].text, /Task Episode cleanup failed: provider removal failed/);
  assert.equal(calls, 1); assert.equal(f.sent.length, 0);
  // The caller supplies a new inspected state; the tool has no retry policy.
  f.deps.taskActions.cleanup = async (...args) => { calls += 1; f.taskCalls.push(args.slice(0, 3)); return { ownershipRemoved: true }; };
  const continued = await tool.execute("cleanup-again", params, undefined, undefined, f.ctx);
  assert.equal(continued.isError, undefined); assert.equal(calls, 2);
  assert.deepEqual(f.taskCalls, [[params.taskId, params.episodeHead, params.outcome]]);
});

test("finalize_task_episode schema rejects lifecycle receipts and action multiplexing", () => {
  const f = fixture({ taskStatus: "In Progress" });
  const schema = f.tools.get("finalize_task_episode").parameters;
  for (const removed of ["action", "guidance", "resumeProgress", "readyReceipt", "readyProgress", "changesProgress", "terminalEvidence", "finalSummary"]) {
    assert.equal(schema.properties[removed], undefined);
  }
});

test("planning tools report first versus sole-follow-up uncertainty without retry or allocation", async () => {
  for (const name of ["plan_spec", "plan_task"]) {
    for (const throwOnSend of [1, 2]) {
      const f = fixture({ throwOnSend });
      const params = name === "plan_spec" ? { location: ".ralph/plans/future/alpha" } : { taskId: "10.38" };
      const result = await f.tools.get(name).execute("tool", params, undefined, undefined, f.ctx);
      assert.equal(result.isError, true); assert.equal(f.sent.length, throwOnSend - 1);
      assert.equal(result.details.admission, "unconfirmed");
      assert.equal(result.details.stage, throwOnSend === 1 ? "first" : "followUp");
      assert.equal(Object.hasOwn(result.details, "admitted"), false);
      if (f.sent.length) assert.deepEqual(f.sent[0].options, { deliverAs: "steer" });
      assert.equal(f.created.length, 0); assert.equal(f.taskCalls.length, 0);
      assert.match(result.content[0].text, /unconfirmed; inspect before retrying/);
    }
  }
});

test("planning tools defer semantic and conditional phase authority to skills", () => {
  const f = fixture();
  for (const name of ["plan_spec", "plan_task"]) {
    const tool = f.tools.get(name), guidance = tool.promptGuidelines.join(" ");
    assert.match(guidance, /skill.*interpret planning authority/);
    assert.match(guidance, /bounded delegation/);
    assert.match(guidance, /material ambiguity/);
    assert.match(guidance, /conditional/);
    assert.match(guidance, /terminal routing/);
    assert.doesNotMatch(guidance, /never search for, select/);
  }
});

test("standalone retained create forwards exact source and selected stable host without entry or agent-end hooks", async () => {
  const f = fixture();
  const host = "id:123e4567-e89b-12d3-a456-426614174000";
  const result = await f.tools.get("create_spec_episode").execute("standalone", { location: ".ralph/plans/future/alpha", host }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined); assert.equal(f.created.length, 1);
  assert.deepEqual(f.created[0].options, { host });
  assert.equal(f.events.has("agent_end"), false);
  assert.equal(f.events.has("session_start"), false);
  assert.equal(f.events.has("session_shutdown"), false);
  const schema = f.tools.get("create_spec_episode").parameters;
  assert.deepEqual(Object.keys(schema.properties), ["location", "host"]);
  assert.deepEqual(schema.required, ["location"]);
  assert.equal(schema.additionalProperties, false);
});

test("invalid retained host syntax delivers nothing and final create rejects injection", async () => {
  const f = fixture(); const entry = await f.tools.get("implement_spec").execute("entry", { location: ".ralph/plans/future/alpha", host: "local" }, undefined, undefined, f.ctx);
  assert.equal(entry.isError, true); assert.equal(f.sent.length, 0); assert.match(entry.content[0].text, /implement_spec requires one exact/);
  for (const params of [
    { location: ".ralph/plans/future/alpha", host: "local" },
    { location: ".ralph/plans/future/alpha --host id:abcd" },
    { location: " .ralph/plans/future/alpha" },
  ]) {
    const result = await f.tools.get("create_spec_episode").execute("invalid", params, undefined, undefined, f.ctx);
    assert.equal(result.isError, true); assert.match(result.content[0].text, /requires one exact/);
  }
  assert.equal(f.created.length, 0);
});

test("retained create keeps ownership conflicts without requiring an earlier entry", async () => {
  const f = fixture();
  const { reused: _reused, ...record } = f.episode;
  writeEpisodeOwnership(f.root, record);
  const result = await f.tools.get("create_spec_episode").execute("different", { location: ".ralph/plans/future/beta" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, true); assert.match(result.content[0].text, /already has non-terminal episode ownership/);
  assert.equal(f.created.length, 0);
});

test("blocked restore tool carries explicit operator confirmation to the exact version-one recovery", async () => {
  const f=fixture(), tool=f.tools.get("restore_blocked_spec_episode");
  assert.match(tool.promptGuidelines.join(" "),/operator explicitly decides/);
  assert.match(tool.promptGuidelines.join(" "),/never search, infer another Episode, or use this for version 2/);
  assert.match(tool.promptGuidelines.join(" "),/revalidates live active identity/);
  const result=await tool.execute("restore",{location:".ralph/plans/future/alpha",confirmedUnblocked:true},undefined,undefined,f.ctx);
  assert.equal(result.isError,undefined);assert.deepEqual(f.restored,[{location:".ralph/plans/future/alpha",confirmedUnblocked:true}]);
  assert.equal(result.details.episodeId,"episode");
});

test("ownership transition tool binds exact reviewed heads and owner confirmation", async () => {
  const f = fixture();
  const tool = f.tools.get("transition_spec_episode_to_task");
  assert.match(tool.promptGuidelines.join(" "), /reviewed, merged to canonical primary main, activated user-globally/);
  assert.match(tool.promptGuidelines.join(" "), /plan deletion remains a separate reviewed step/);
  const mainHead = "a".repeat(40), episodeHead = "b".repeat(40);
  const result = await tool.execute("transition", {
    location: ".ralph/plans/future/alpha", taskId: "PRIMECLAW-10.38",
    mainHead, episodeHead, confirmedReady: true,
  }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined);
  assert.equal(result.details.record.version, 2);
  assert.equal(f.transitioned.length, 1);
  assert.deepEqual({
    location: f.transitioned[0].location,
    taskId: f.transitioned[0].taskId,
    episodeHead: f.transitioned[0].episodeHead,
    mainHead: f.transitioned[0].mainHead,
    confirmedReady: f.transitioned[0].confirmedReady,
    callCtx: f.transitioned[0].callCtx,
  }, {
    location: ".ralph/plans/future/alpha", taskId: "PRIMECLAW-10.38",
    episodeHead, mainHead, confirmedReady: true, callCtx: f.ctx,
  });
  assert.equal(f.transitioned[0].transitionDependencies, f.deps);
});

test("ownership transition tool reports guarded failures without fallback", async () => {
  const f = fixture();
  f.deps.transitionLegacyOwnership = () => { throw new Error("foreign owner or drift"); };
  const result = await f.tools.get("transition_spec_episode_to_task").execute("transition", {
    location: ".ralph/plans/future/alpha", taskId: "PRIMECLAW-10.38",
    mainHead: "a".repeat(40), episodeHead: "b".repeat(40), confirmedReady: true,
  }, undefined, undefined, f.ctx);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /foreign owner or drift/);
  assert.deepEqual(result.details, { error: "foreign owner or drift" });
});

test("tool guidance preserves operator authority and fixed fresh assignment", () => {
  const f = fixture(); const create = f.tools.get("create_spec_episode"); const handoff = f.tools.get("handoff_spec_episode"); const finalize = f.tools.get("finalize_spec_episode");
  assert.match(create.promptGuidelines.join(" "), /fresh Episode/); assert.match(create.promptGuidelines.join(" "), /never send an initial handoff/);
  assert.match(handoff.promptGuidelines.join(" "), /product decisions/); assert.match(handoff.promptGuidelines.join(" "), /operator accepted the exact recorded unblock/); assert.match(handoff.promptGuidelines.join(" "), /restored active version-1 plan identity was revalidated/); assert.match(finalize.promptGuidelines.join(" "), /operator/);
  assert.match(finalize.promptGuidelines.join(" "), /active legacy plan pair/); assert.match(finalize.promptGuidelines.join(" "), /separate explicit post-terminal legacy authority/);
  const taskCreate = f.tools.get("create_task_episode"); const taskHandoff = f.tools.get("handoff_task_episode"); const taskFinalize = f.tools.get("finalize_task_episode");
  assert.match(taskCreate.promptGuidelines.join(" "), /exactly once/);
  assert.match(taskCreate.promptGuidelines.join(" "), /same optional stable host carried by readiness/);
  assert.match(taskCreate.promptGuidelines.join(" "), /independently resolves the current provider, task, and safe placement/);
  assert.match(taskCreate.promptGuidelines.join(" "), /no prior invocation proof or content-revision approval receipt is required/);
  assert.match(taskHandoff.promptGuidelines.join(" "), /Never use ordinary handoff for Blocked, merge/);
  assert.match(taskHandoff.promptGuidelines.join(" "), /Guidance never supplies provider revision or raw task authority/);
  assert.match(taskHandoff.promptGuidelines.join(" "), /factual LLM context, not a semantic approval gate/);
  assert.match(taskHandoff.promptGuidelines.join(" "), /compatible same-task changes and unrelated descendants continue normally/);
  assert.match(taskFinalize.promptGuidelines.join(" "), /already operator-authorized terminal outcome/);
  assert.match(taskFinalize.promptGuidelines.join(" "), /exact pushed Episode head/);
  assert.match(taskFinalize.promptGuidelines.join(" "), /removes only the bound idle runtime/);
});


test("task resolver binds canonical Backlog JSON identity and regular task path", () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-task-resolver-"));
  execFileSync("git", ["init", "-q", root]);
  const relativeTaskPath = "backlog/tasks/primeclaw-10.38 - planning.md";
  mkdirSync(join(root, "backlog", "tasks"), { recursive: true });
  writeFileSync(join(root, relativeTaskPath), "task fixture");
  const calls = [];
  const runner = { run(command, args, options) {
    calls.push({ command, args, options });
    return { stdout: JSON.stringify({ schemaVersion: 1, kind: "task-view", task: {
      id: "PRIMECLAW-10.38", title: "Planning fixture", status: "In Planning",
      implementationPlan: "One meaningful step", references: ["legacy-episode-source=.ralph/plans/future/alpha; superseded-by=PRIMECLAW-10.38"], path: relativeTaskPath,
    } }), stderr: "", status: 0 };
  } };

  const selected = resolveBacklogTask(root, "10.38", runner);
  assert.equal(selected.taskId, "PRIMECLAW-10.38");
  assert.equal(selected.status, "In Planning");
  assert.equal(selected.implementationPlan, "One meaningful step");
  assert.deepEqual(selected.references, ["legacy-episode-source=.ralph/plans/future/alpha; superseded-by=PRIMECLAW-10.38"]);
  assert.equal(selected.projectRoot, realpathSync(root));
  assert.equal(selected.taskPath, realpathSync(join(root, relativeTaskPath)));
  assert.deepEqual(calls, [{
    command: "backlog",
    args: ["task", "view", "--json", "--", "10.38"],
    options: { cwd: realpathSync(root), allowFailure: true },
  }]);
});

test("task resolver rejects unsafe selection without invoking Backlog", () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-task-resolver-"));
  execFileSync("git", ["init", "-q", root]);
  const runner = { run() { throw new Error("runner must not be called"); } };
  assert.equal(resolveBacklogTask(root, "--help", runner), null);
  assert.equal(resolveBacklogTask(root, "two tasks", runner), null);
});

test("task resolver fails closed on command, schema, and path errors", () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-task-resolver-"));
  execFileSync("git", ["init", "-q", root]);
  const failed = { run() { return { stdout: "", stderr: "not found", status: 1 }; } };
  assert.throws(() => resolveBacklogTask(root, "PRIMECLAW-10.38", failed), /could not resolve.*not found/);
  const malformed = { run() { return { stdout: "not json", stderr: "", status: 0 }; } };
  assert.throws(() => resolveBacklogTask(root, "PRIMECLAW-10.38", malformed), /invalid JSON/);
  const escaped = { run() { return { stdout: JSON.stringify({ schemaVersion: 1, kind: "task-view", task: {
    id: "PRIMECLAW-10.38", title: "Planning fixture", status: "In Planning",
    implementationPlan: null, path: "../outside.md",
  } }), stderr: "", status: 0 }; } };
  assert.throws(() => resolveBacklogTask(root, "PRIMECLAW-10.38", escaped), /outside the project or disappeared/);
});


test("implement_spec steers prep and queues exactly one phase follow-up with selected stable host", async () => {
  const calls = [];
  const host = "id:123e4567-e89b-12d3-a456-426614174000";
  const f = fixture({ placementResolver: async (root, selectedHost) => {
    calls.push([root, selectedHost]); return { engine: "orca", projectSetupId: host.slice(3) };
  } });
  const tool = f.tools.get("implement_spec");
  assert.deepEqual(Object.keys(tool.parameters.properties), ["location", "host"]);
  assert.equal(tool.parameters.additionalProperties, false);
  const result = await tool.execute("entry", { location: ".ralph/plans/future/alpha", host }, undefined, undefined, f.ctx);
  assert.equal(result.details.admitted, true); assert.equal(result.details.location, ".ralph/plans/future/alpha");
  assert.match(result.content[0].text, /Readiness has not completed, and no Episode was created/);
  assert.deepEqual(calls, [[f.root, host]]); assert.equal(f.sent.length, 2); assert.equal(f.created.length, 0);
  assert.deepEqual(f.sent[0].options, { deliverAs: "steer" });
  assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });
  for (const sent of f.sent) assert.ok(sent.message.includes(`<operator-implementation-host>\n${host}\n</operator-implementation-host>`));
  assert.match(f.sent[0].message, /IMPLEMENT-PREP POLICY/); assert.match(f.sent[1].message, /IMPLEMENT-SPEC POLICY/);
  assert.ok(f.sent[1].message.indexOf("FULL OVERSIGHT GUIDE") < f.sent[1].message.indexOf("IMPLEMENT-SPEC POLICY"));
});

test("implement_spec carries auto-selected stable host in both canonical messages", async () => {
  const host = "id:123e4567-e89b-12d3-a456-426614174000";
  const f = fixture({ placementResolver: async () => ({ engine: "orca", projectSetupId: host.slice(3) }) });
  const result = await f.tools.get("implement_spec").execute("entry", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(result.details.admitted, true); assert.equal(f.sent.length, 2); assert.deepEqual(f.sent[0].options, { deliverAs: "steer" });
  for (const sent of f.sent) assert.ok(sent.message.includes(host));
});

test("implement_spec cancellation, unavailable selection, missing workflow and invalid arguments send nothing", async () => {
  for (const message of ["Episode location selection was cancelled", "Explicit Episode host no longer ready", "Remote Episode placement is disabled"]) {
    const f = fixture({ placementResolver: async () => { throw new Error(message); } });
    const result = await f.tools.get("implement_spec").execute("blocked", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
    assert.equal(result.isError, true); assert.ok(result.content[0].text.includes(message));
    assert.equal(f.sent.length, 0); assert.equal(f.created.length, 0);
  }
  const missing = fixture(); unlinkSync(join(missing.root, ".prime-claw", "workflows", "implement-spec.md"));
  const absent = await missing.tools.get("implement_spec").execute("missing", { location: ".ralph/plans/future/alpha" }, undefined, undefined, missing.ctx);
  assert.equal(absent.isError, true); assert.equal(missing.sent.length, 0);
  const f = fixture();
  for (const params of [{ location: ".ralph/plans/future/alpha", host: "local" }, { location: ".ralph/plans/future/alpha --host id:abcd" }, { location: "../alpha" }]) {
    const result = await f.tools.get("implement_spec").execute("invalid", params, undefined, undefined, f.ctx);
    assert.equal(result.isError, true); assert.equal(f.sent.length, 0);
  }
});

test("implement_spec reports first versus follow-up uncertainty without retry or allocation", async () => {
  for (const throwOnSend of [1, 2]) {
    const f = fixture({ throwOnSend });
    const result = await f.tools.get("implement_spec").execute("uncertain", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
    assert.equal(result.isError, true); assert.equal(result.details.admission, "unconfirmed");
    assert.equal(result.details.stage, throwOnSend === 1 ? "first" : "followUp");
    assert.equal(Object.hasOwn(result.details, "admitted"), false);
    assert.equal(f.sent.length, throwOnSend - 1); assert.equal(f.created.length, 0);
    assert.match(result.content[0].text, /unconfirmed; inspect before retrying/);
  }
});

test("implement_task steers prep and queues the sole phase follow-up with selected stable host and full guide", async () => {
  const host = "id:123e4567-e89b-12d3-a456-426614174000", placements = [];
  const f = fixture({ taskStatus: "In Planning", async placementResolver(projectRoot, selectedHost) {
    placements.push({ projectRoot, host: selectedHost });
    return { engine: "orca", projectSetupId: host.slice(3) };
  } });
  const result = await f.tools.get("implement_task").execute("entry", { taskId: "10.38", host }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined);
  assert.equal(result.details.admitted, true);
  assert.equal(result.details.taskId, "PRIMECLAW-10.38");
  assert.match(result.content[0].text, /Readiness has not completed/);
  assert.deepEqual(placements, [{ projectRoot: f.root, host }]);
  assert.equal(f.sent.length, 2);
  assert.deepEqual(f.sent[0].options, { deliverAs: "steer" });
  assert.match(f.sent[0].message, /IMPLEMENT-TASK-PREP POLICY/);
  assert.ok(f.sent[1].message.indexOf("FULL OVERSIGHT GUIDE") < f.sent[1].message.indexOf("IMPLEMENT-TASK POLICY"));
  assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });
  for (const { message } of f.sent) {
    assert.ok(message.includes(`<operator-implementation-host>\n${host}\n</operator-implementation-host>`));
    assert.ok(message.includes("<operator-implementation-task-provider>\nbacklog\n</operator-implementation-task-provider>"));
    assert.ok(message.includes(`<operator-implementation-task-project-root>\n${f.root}\n</operator-implementation-task-project-root>`));
    assert.ok(message.includes("<operator-implementation-task-path>\ntask.md\n</operator-implementation-task-path>"));
  }
  assert.equal(f.taskCalls.length, 0);
});

test("implement_task carries auto-selected stable host before both messages", async () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const f = fixture({ taskStatus: "In Planning", async placementResolver() {
    assert.equal(f.sent.length, 0); return { engine: "orca", projectSetupId: id };
  } });
  const result = await f.tools.get("implement_task").execute("entry", { taskId: "10.38" }, undefined, undefined, f.ctx);
  assert.equal(result.details.admitted, true);
  assert.deepEqual(f.sent[0].options, { deliverAs: "steer" });
  for (const { message } of f.sent) assert.ok(message.includes(`<operator-implementation-host>\nid:${id}\n</operator-implementation-host>`));
});

test("implementation cancellation, placement errors, missing workflows and invalid status deliver nothing", async () => {
  for (const reason of ["selection cancelled", "multiple ready local setups are ambiguous", "host unavailable"]) {
    const f = fixture({ taskStatus: "In Planning", async placementResolver() { throw new Error(reason); } });
    const result = await f.tools.get("implement_task").execute("entry", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
    assert.equal(result.isError, true);
    assert.equal(result.details.admitted, false);
    assert.match(result.content[0].text, new RegExp(reason));
    assert.equal(f.sent.length, 0);
  }
  const missing = fixture({ taskStatus: "In Planning" });
  unlinkSync(join(missing.root, ".prime-claw", "workflows", "implement-task.md"));
  const noWorkflow = await missing.tools.get("implement_task").execute("entry", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, missing.ctx);
  assert.equal(noWorkflow.isError, true);
  assert.equal(missing.sent.length, 0);
  const wrongStatus = fixture({ taskStatus: "In Design" });
  const rejected = await wrongStatus.tools.get("implement_task").execute("entry", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, wrongStatus.ctx);
  assert.equal(rejected.isError, true);
  assert.equal(wrongStatus.sent.length, 0);
});

test("structured task tools reject host and argument injection before resolving or delivering", async () => {
  for (const name of ["implement_task", "create_task_episode"]) {
    for (const params of [
      { taskId: "PRIMECLAW-10.38", host: "local" },
      { taskId: "PRIMECLAW-10.38 --host id:123" },
      { taskId: "-task" }, { taskId: "" }, { taskId: " PRIMECLAW-10.38" },
    ]) {
      const f = fixture({ taskStatus: "In Planning" });
      const result = await f.tools.get(name).execute("invalid", params, undefined, undefined, f.ctx);
      assert.equal(result.isError, true, `${name}: ${JSON.stringify(params)}`);
      assert.equal(f.sent.length, 0);
      assert.equal(f.resolved.length, 0);
      assert.equal(f.taskCalls.length, 0);
    }
  }
});

test("implementation delivery uncertainty reports the exact stage without retrying or creating", async () => {
  for (const throwOnSend of [1, 2]) {
    const f = fixture({ taskStatus: "In Planning", throwOnSend });
    const result = await f.tools.get("implement_task").execute("entry", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
    assert.equal(result.isError, true);
    assert.equal(result.details.admission, "unconfirmed");
    assert.equal(result.details.stage, throwOnSend === 1 ? "first" : "followUp");
    assert.equal(result.details.admitted, undefined);
    assert.match(result.content[0].text, /unconfirmed; inspect before retrying/);
    assert.equal(f.sent.length, throwOnSend - 1);
    assert.equal(f.taskCalls.length, 0);
  }
});

test("conversation compaction threshold normalization accepts documented equivalent forms", () => {
  const valid = [
    [".6", 0.6], ["60", 0.6], ["60%", 0.6], [60, 0.6], [0.6, 0.6],
    ["1", 1], ["100", 1], ["100%", 1], [1, 1], [100, 1],
    [".1", 0.1], ["10", 0.1], ["10%", 0.1],
    ["0", 0], ["0%", 0], [0, 0], ["0.5", 0.5], [" 60% ", 0.6],
  ];
  for (const [input, expected] of valid) {
    const result = normalizeConversationCompactionThreshold(input);
    assert.equal(result.ok, true, `expected ${JSON.stringify(input)} to normalize`);
    assert.ok(Math.abs(result.value - expected) < 1e-12, `expected ${JSON.stringify(input)} -> ${expected}, got ${result.value}`);
  }
});

test("conversation compaction threshold normalization rejects invalid values", () => {
  for (const input of [".6%", ".06", "6", "6%", "1%", "9.9%", "-1", "-0.5%", "101", "150%", "", "abc", "60x", "NaN", "Infinity", true, false, null, [], {}, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = normalizeConversationCompactionThreshold(input);
    assert.equal(result.ok, false, `expected ${JSON.stringify(input)} to be rejected`);
  }
});

test("successful task handoff steers the after-handoff prompt exactly once above threshold", async () => {
  const f = fixture({ taskStatus: "In Progress", usage: 61 });
  const result = await f.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined);
  assert.deepEqual(f.taskCalls, [["handoff", "PRIMECLAW-10.38", ""]]);
  assert.equal(f.sent.length, 1);
  assert.deepEqual(f.sent[0].options, { deliverAs: "steer" });
  assert.ok(f.sent[0].message.includes('<skill name="conversation-after-handoff"'));
  assert.ok(f.sent[0].message.includes("AFTER-HANDOFF POLICY"));
  assert.equal(result.details.conversationCompaction.outcome, "prompt-delivered");
  assert.equal(result.details.conversationCompaction.threshold, 0.6);
  assert.equal(result.details.conversationCompaction.usagePercent, 61);
  assert.doesNotMatch(result.content[0].text, /Warning:/);
});

test("successful spec handoff steers the after-handoff prompt exactly once above threshold", async () => {
  const f = fixture({ usage: 75 });
  const result = await f.tools.get("handoff_spec_episode").execute("handoff", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined);
  assert.equal(f.sent.length, 1);
  assert.deepEqual(f.sent[0].options, { deliverAs: "steer" });
  assert.ok(f.sent[0].message.includes("AFTER-HANDOFF POLICY"));
  assert.equal(result.details.conversationCompaction.outcome, "prompt-delivered");
  assert.equal(result.details.conversationCompaction.usagePercent, 75);
  assert.doesNotMatch(result.content[0].text, /Warning:/);
});

test("provider-native terminal cleanup and handoff retain the common public boundaries", async () => {
  const f = fixture({ usage: 75 });
  const taskId = "pc-native.1";
  const handoff = await f.tools.get("handoff_task_episode").execute("handoff", { taskId }, undefined, undefined, f.ctx);
  assert.equal(handoff.isError, undefined);
  assert.deepEqual(f.taskCalls, [["handoff", taskId, ""]]);
  assert.equal(handoff.details.conversationCompaction.outcome, "prompt-delivered");
  assert.equal(f.sent.length, 1);
  const cleanup = f.tools.get("finalize_task_episode");
  assert.match(cleanup.promptGuidelines.join(" "), /Beads requires current clean published native done/);
  assert.match(cleanup.promptGuidelines.join(" "), /No second cleanup confirmation/);
  const result = await cleanup.execute("cleanup", { taskId, episodeHead: "e".repeat(40), outcome: "merged" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined);
  assert.equal(result.details.result.ownershipRemoved, true);
  assert.deepEqual(f.taskCalls[1], ["cleanup", taskId, "e".repeat(40), "merged"]);
  assert.equal(f.sent.length, 1); // terminal cleanup does not trigger compaction
});

test("at-threshold, below-threshold, and unknown utilization skip the after-handoff prompt", async () => {
  for (const usage of [60, 30]) {
    const f = fixture({ taskStatus: "In Progress", usage });
    const result = await f.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
    assert.equal(result.isError, undefined);
    assert.equal(f.sent.length, 0);
    assert.equal(result.details.conversationCompaction.outcome, "skipped");
    assert.match(result.details.conversationCompaction.reason, /at or below/);
    assert.doesNotMatch(result.content[0].text, /Warning:/);
  }
  const unknown = fixture({ taskStatus: "In Progress" });
  const unknownResult = await unknown.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, unknown.ctx);
  assert.equal(unknownResult.isError, undefined);
  assert.equal(unknown.sent.length, 0);
  assert.match(unknownResult.details.conversationCompaction.reason, /utilization is unknown/);
  assert.doesNotMatch(unknownResult.content[0].text, /Warning:/);
  const nullPercent = fixture({ taskStatus: "In Progress" });
  nullPercent.ctx.getContextUsage = () => ({ tokens: null, contextWindow: 100, percent: null });
  const nullResult = await nullPercent.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, nullPercent.ctx);
  assert.equal(nullResult.isError, undefined);
  assert.equal(nullPercent.sent.length, 0);
  assert.match(nullResult.details.conversationCompaction.reason, /utilization is unknown/);
  assert.doesNotMatch(nullResult.content[0].text, /Warning:/);
});

test("omitted threshold_percent defaults to 60 and zero disables without a separate key", async () => {
  const omitted = fixture({ taskStatus: "In Progress", usage: 61 });
  writeFileSync(omitted.afterHandoffPath, "---\nname: conversation-after-handoff\n---\nCUSTOM DEFAULT POLICY\n");
  const omittedResult = await omitted.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, omitted.ctx);
  assert.equal(omittedResult.details.conversationCompaction.outcome, "prompt-delivered");
  assert.equal(omittedResult.details.conversationCompaction.threshold, 0.6);
  assert.ok(omitted.sent[0].message.includes("CUSTOM DEFAULT POLICY"));

  for (const zero of ["0", "0%"]) {
    const disabled = fixture({ taskStatus: "In Progress", usage: 100 });
    writeFileSync(disabled.afterHandoffPath, `---\nname: conversation-after-handoff\nthreshold_percent: ${zero}\n---\nDISABLED POLICY\n`);
    const disabledResult = await disabled.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, disabled.ctx);
    assert.equal(disabledResult.isError, undefined);
    assert.equal(disabled.sent.length, 0);
    assert.match(disabledResult.details.conversationCompaction.reason, /disabled/);
    assert.doesNotMatch(disabledResult.content[0].text, /Warning:/);
  }
});

test("customized project threshold and prompt load from the same workflow file", async () => {
  const f = fixture({ taskStatus: "In Progress", usage: 41 });
  writeFileSync(f.afterHandoffPath, "---\nname: conversation-after-handoff\nthreshold_percent: \"40%\"\n---\nPROJECT CUSTOMIZED AFTER-HANDOFF\n");
  const result = await f.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
  assert.equal(result.details.conversationCompaction.outcome, "prompt-delivered");
  assert.equal(result.details.conversationCompaction.threshold, 0.4);
  assert.ok(f.sent[0].message.includes("PROJECT CUSTOMIZED AFTER-HANDOFF"));
  assert.ok(f.sent[0].message.includes(f.afterHandoffPath));

  const below = fixture({ taskStatus: "In Progress", usage: 40 });
  writeFileSync(below.afterHandoffPath, "---\nname: conversation-after-handoff\nthreshold_percent: 40\n---\nPROJECT CUSTOMIZED AFTER-HANDOFF\n");
  const belowResult = await below.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, below.ctx);
  assert.equal(below.sent.length, 0);
  assert.equal(belowResult.details.conversationCompaction.outcome, "skipped");
});

test("project YAML framing and quoted scalars retain parser semantics", async () => {
  for (const content of [
    "AFTER-HANDOFF POLICY without frontmatter",
    "---\n---\nAFTER-HANDOFF POLICY",
    "---\n# empty mapping\n---\nAFTER-HANDOFF POLICY",
    "---\nnull\n---\nAFTER-HANDOFF POLICY",
    "\uFEFF---\r\nthreshold_percent: \"60%\"\r\n---\r\nAFTER-HANDOFF POLICY",
    "---\nthreshold_percent: '60' # percent\n---\nAFTER-HANDOFF POLICY",
    "---\nbase: &limit 60\nthreshold_percent: *limit\n---\nAFTER-HANDOFF POLICY",
  ]) {
    const f = fixture({ usage: 61 });
    writeFileSync(f.afterHandoffPath, content);
    const result = await maybeDeliverConversationAfterHandoff(f.pi, f.ctx);
    assert.equal(result.outcome, "prompt-delivered", content);
    assert.equal(result.threshold, 0.6, content);
    assert.equal(f.sent.length, 1);
    assert.ok(f.sent[0].message.includes(content));
  }
});

test("invalid workflow configuration is a bounded skip, never a failed handoff", async () => {
  const cases = [
    ["---\nname: conversation-after-handoff\nthreshold_percent: 6%\n---\nBODY\n", /10-100% range/],
    ["---\nname: conversation-after-handoff\nthreshold_percent: true\n---\nBODY\n", /numeric scalar/],
    ["---\nname: conversation-after-handoff\nthreshold_percent:\n---\nBODY\n", /numeric scalar/],
    ["---\nname: conversation-after-handoff\nthreshold_percent: [60]\n---\nBODY\n", /numeric scalar/],
    ["---\nname: conversation-after-handoff\nthreshold_percent: 60\n", /unterminated frontmatter/],
    ["---\n- just\n- a\n- list\n---\nBODY\n", /not a mapping/],
    ["---\nname: a\nname: b\n---\nBODY\n", /frontmatter is invalid/],
    ["---\nthreshold_percent: 60\nthreshold_percent: 0\n---\nBODY\n", /frontmatter is invalid/],
    ["---\nthreshold_percent: {bad: 60}\n---\nBODY\n", /numeric scalar/],
    ["---\nthreshold_percent: \"60 trailing\"\n---\nBODY\n", /finite number/],
    ["---\nthreshold_percent: \"unterminated\n---\nBODY\n", /frontmatter is invalid/],
  ];
  for (const [content, pattern] of cases) {
    const f = fixture({ taskStatus: "In Progress", usage: 100 });
    writeFileSync(f.afterHandoffPath, content);
    const result = await f.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
    assert.equal(result.isError, undefined, `handoff must survive ${pattern}`);
    assert.equal(f.sent.length, 0);
    assert.equal(result.details.conversationCompaction.outcome, "skipped");
    assert.equal(result.details.conversationCompaction.error, true);
    assert.match(result.details.conversationCompaction.reason, pattern);
    assert.match(result.content[0].text, /Task Episode handoff admitted/);
    assert.match(result.content[0].text, /Warning: Conversation after-handoff compaction was skipped/);
    assert.match(result.content[0].text, pattern);
  }
  const missing = fixture({ taskStatus: "In Progress", usage: 100 });
  unlinkSync(missing.afterHandoffPath);
  const missingResult = await missing.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, missing.ctx);
  assert.equal(missingResult.isError, undefined);
  assert.equal(missing.sent.length, 0);
  assert.match(missingResult.details.conversationCompaction.reason, /not installed/);
  assert.match(missingResult.content[0].text, /Warning: Conversation after-handoff compaction was skipped/);
  assert.match(missingResult.content[0].text, /not installed/);
  const missingSpecResult = await missing.tools.get("handoff_spec_episode").execute("handoff", { location: ".ralph/plans/future/alpha" }, undefined, undefined, missing.ctx);
  assert.equal(missingSpecResult.isError, undefined);
  assert.match(missingSpecResult.content[0].text, /Episode handoff admitted/);
  assert.match(missingSpecResult.content[0].text, /Warning: Conversation after-handoff compaction was skipped/);
  assert.match(missingSpecResult.content[0].text, /not installed/);
});

test("compaction delivery failure preserves the successful handoff receipt without retry", async () => {
  const f = fixture({ taskStatus: "In Progress", usage: 100, throwOnSend: 1 });
  const result = await f.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined);
  assert.match(result.content[0].text, /Task Episode handoff admitted/);
  assert.match(result.content[0].text, /Warning: Conversation after-handoff compaction was skipped/);
  assert.match(result.content[0].text, /delivery failed/);
  assert.deepEqual(f.taskCalls, [["handoff", "PRIMECLAW-10.38", ""]]);
  assert.equal(result.details.conversationCompaction.outcome, "skipped");
  assert.equal(result.details.conversationCompaction.error, true);
  assert.match(result.details.conversationCompaction.reason, /delivery failed/);
});

test("both canonical handoff adapters invoke the compaction check exactly once per success", async () => {
  const f = fixture({ taskStatus: "In Progress" });
  const calls = [];
  f.deps.conversationAfterHandoff = async (pi, ctx) => { calls.push({ pi, ctx }); return { outcome: "skipped", reason: "spy" }; };
  const taskResult = await f.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
  const specResult = await f.tools.get("handoff_spec_episode").execute("handoff", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(taskResult.isError, undefined);
  assert.equal(specResult.isError, undefined);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].ctx, f.ctx);
  assert.equal(taskResult.details.conversationCompaction.reason, "spy");
  assert.equal(specResult.details.conversationCompaction.reason, "spy");
  assert.doesNotMatch(taskResult.content[0].text, /Warning:/);
  assert.doesNotMatch(specResult.content[0].text, /Warning:/);
});

test("failed, partial, or unrelated dispatches never invoke the compaction check", async () => {
  const f = fixture({ taskStatus: "In Progress" });
  const calls = [];
  f.deps.conversationAfterHandoff = async () => { calls.push("called"); return { outcome: "skipped", reason: "spy" }; };
  f.deps.taskActions.handoff = async () => { throw new Error("uncertain task handoff admission"); };
  f.deps.handoffEpisode = async () => { throw new Error("uncertain spec handoff admission"); };
  const taskResult = await f.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
  assert.equal(taskResult.isError, true);
  assert.match(taskResult.content[0].text, /uncertain task handoff admission/);
  const specResult = await f.tools.get("handoff_spec_episode").execute("handoff", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(specResult.isError, true);
  assert.match(specResult.content[0].text, /uncertain spec handoff admission/);
  const planned = await f.tools.get("plan_spec").execute("tool", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(planned.details.admitted, true);
  const created = await f.tools.get("create_task_episode").execute("create", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
  const cleaned = await f.tools.get("finalize_task_episode").execute("cleanup", {
    taskId: "PRIMECLAW-10.38", episodeHead: "e".repeat(40), outcome: "merged",
  }, undefined, undefined, f.ctx);
  assert.equal(cleaned.isError, undefined);
  assert.equal(calls.length, 0);
  assert.equal(created.isError, true); // task is not In Planning; still no compaction check
});

test("a throwing compaction hook is contained as a bounded skip on the successful receipt", async () => {
  const f = fixture({ taskStatus: "In Progress" });
  f.deps.conversationAfterHandoff = async () => { throw new Error("synthetic hook failure"); };
  const result = await f.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined);
  assert.match(result.content[0].text, /Task Episode handoff admitted/);
  assert.match(result.content[0].text, /Warning: Conversation after-handoff compaction was skipped/);
  assert.match(result.content[0].text, /compaction check failed/);
  assert.equal(result.details.conversationCompaction.outcome, "skipped");
  assert.equal(result.details.conversationCompaction.error, true);
  assert.match(result.details.conversationCompaction.reason, /compaction check failed/);
});

test("after-handoff helper delivers the project workflow through steer transport", async () => {
  const f = fixture({ usage: 90 });
  const direct = await maybeDeliverConversationAfterHandoff(f.pi, f.ctx);
  assert.equal(direct.outcome, "prompt-delivered");
  assert.equal(f.sent.length, 1);
  assert.deepEqual(f.sent[0].options, { deliverAs: "steer" });
  assert.ok(f.sent[0].message.includes("AFTER-HANDOFF POLICY"));
});
