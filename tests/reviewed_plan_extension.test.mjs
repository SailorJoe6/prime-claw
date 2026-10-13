import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  admitTaskImplementationPrepChain,
  createReviewedPlanExtension,
  TaskImplementationApprovalStore,
} from "../src/prime-agent-plugin/extensions/reviewed-plan.ts";
import { resolveBacklogTask } from "../src/prime-agent-plugin/extension-support/reviewed-plan-support.ts";
import { EpisodeStateUncertainError, HandoffFollowUpRejectedError } from "../src/prime-agent-plugin/extension-support/spec-episode.ts";

function fixture({ throwOnSend = 0, taskStatus = "In Design" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-reviewed-")); execFileSync("git", ["init", "-q", root]);
  for (const slug of ["alpha", "beta"]) mkdirSync(join(root, ".ralph", "plans", "future", slug), { recursive: true });
  mkdirSync(join(root, ".prime-claw", "workflows"), { recursive: true });
  for (const name of ["plan-prep", "plan-spec", "plan-task-prep", "plan-task", "implement-prep", "implement-spec", "implement-task-prep", "implement-task", "handoff"]) writeFileSync(join(root, ".prime-claw", "workflows", `${name}.md`), `---
name: ${name}
---
${name.toUpperCase()} POLICY
`);
  mkdirSync(join(root, ".agents", "skills", "execute"), { recursive: true }); writeFileSync(join(root, ".agents", "skills", "execute", "SKILL.md"), "EXECUTE POLICY");
  const guideRoot = join(root, "plugin"); mkdirSync(join(guideRoot, "skills", "prime-claw-oversee-episode"), { recursive: true }); writeFileSync(join(guideRoot, "skills", "prime-claw-oversee-episode", "SKILL.md"), `FULL OVERSIGHT GUIDE
`);
  const commands = new Map(), tools = new Map(), events = new Map(), sent = [], created = [], resolved = [], taskCalls = [];
  let sendCount = 0;
  const pi = { registerCommand(name, value) { commands.set(name, value); }, registerTool(tool) { tools.set(tool.name, tool); }, on(name, handler) { events.set(name, handler); }, sendUserMessage(message, options) { sendCount += 1; if (sendCount === throwOnSend) throw new Error("synthetic send failure"); sent.push({ message, options }); }, async sendMessage() {} };
  const ctx = { cwd: root, hasUI: true, ui: { notify(message, level) { sent.push({ notify: message, level }); } }, sessionManager: { getSessionId: () => "owner", getSessionFile: () => join(root, "owner.jsonl"), getHeader: () => ({ rlmDepth: 0 }) } };
  const episode = { version: 1, status: "active", operationId: "op", engine: "local", ownerSessionId: "owner", sourceLocation: ".ralph/plans/future/alpha", slug: "alpha", baseRef: "base", bundleDigest: "0".repeat(64), createdAt: "x", updatedAt: "x", worktree: join(root, "wt"), branch: "branch", head: "head", episodeId: "episode", episodeSessionFile: join(root, "episode.jsonl"), episodeActiveSessionId: "route", reused: false };
  const taskImplementationApprovals = new TaskImplementationApprovalStore();
  const readyPublication = { taskId: "PRIMECLAW-10.38", status: "Ready for Merge", commit: "r".repeat(40), episodeHead: "e".repeat(40), parentTaskId: "PRIMECLAW-10", episodeTaskContentDigest: "d".repeat(64) };
  const readyIntegration = { taskId: "PRIMECLAW-10.38", readyCommit: readyPublication.commit, acceptedEpisodeHead: readyPublication.episodeHead, integratedMainHead: "m".repeat(40), refreshedEpisodeHead: "f".repeat(40), parentTaskId: "PRIMECLAW-10", episodeTaskContentDigest: "d".repeat(64) };
  const readyVerification = { verified: true, taskId: "PRIMECLAW-10.38", mainHead: readyIntegration.integratedMainHead, refreshedEpisodeHead: readyIntegration.refreshedEpisodeHead };
  const taskActions = {
    async create(taskId, toolCallId, callCtx, _dependencies, placement) { taskCalls.push(["create", taskId, placement]); return { version: 2, status: "active", taskId, episodeId: "task-episode", episodeActiveSessionId: "task-route", reused: false }; },
    async handoff(taskId, guidance) { taskCalls.push(["handoff", taskId, guidance]); return { admitted: true, taskId, episodeId: "task-episode", episodeActiveSessionId: "task-route", handoffDelivery: "prompt", executeDelivery: "followUp" }; },
    block(taskId, head) { taskCalls.push(["block", taskId, head]); return { taskId, status: "Blocked", commit: "b".repeat(40), episodeHead: head }; },
    resume(taskId, head) { taskCalls.push(["resume", taskId, head]); return { taskId, status: "In Progress", commit: "i".repeat(40), episodeHead: head }; },
    readyPublish(taskId, head) { taskCalls.push(["ready-publish", taskId, head]); return { ...readyPublication, episodeHead: head }; },
    async readyIntegrate(publication) { taskCalls.push(["ready-integrate", publication.commit]); return { ...readyIntegration, acceptedEpisodeHead: publication.episodeHead }; },
    readyVerify(publication, integration) { taskCalls.push(["ready-verify", integration.refreshedEpisodeHead]); return readyVerification; },
    async delay(receipt) { taskCalls.push(["delay", receipt.verification.mainHead]); return { ...receipt.verification, outcome: "delayed" }; },
    async changesPublish(receipt) { taskCalls.push(["changes-publish", receipt.verification.mainHead]); return { taskId: "PRIMECLAW-10.38", status: "In Progress", commit: "c".repeat(40), episodeHead: receipt.verification.refreshedEpisodeHead, parentTaskId: "PRIMECLAW-10", episodeTaskContentDigest: "d".repeat(64) }; },
    async changesIntegrate(publication) { taskCalls.push(["changes-integrate", publication.commit]); return { taskId: publication.taskId, changesCommit: publication.commit, previousRefreshedEpisodeHead: publication.episodeHead, integratedMainHead: "n".repeat(40), refreshedEpisodeHead: "x".repeat(40), parentTaskId: publication.parentTaskId, episodeTaskContentDigest: publication.episodeTaskContentDigest }; },
    async changesResume(publication, integration, guidance) { taskCalls.push(["changes-resume", guidance]); return { verification: { verified: true, taskId: publication.taskId, mainHead: integration.integratedMainHead, refreshedEpisodeHead: integration.refreshedEpisodeHead, status: "In Progress" }, handoff: { admitted: true, taskId: publication.taskId, episodeId: "task-episode", episodeActiveSessionId: "task-route", handoffDelivery: "prompt", executeDelivery: "followUp" } }; },
    async merge(receipt, _ctx, _dependencies, decision) { taskCalls.push(["merge", decision]); return { verified: true, outcome: "merged", taskId: decision.taskId, status: "Done", priorMainHead: decision.mainHead, mergedHead: decision.refreshedEpisodeHead, doneCommit: "z".repeat(40), parentTaskId: "PRIMECLAW-10", episodeTaskContentDigest: "d".repeat(64) }; },
    prepareAbandonment(taskId, head, finalSummary) { taskCalls.push(["prepare-abandon", taskId, head]); return { operatorDecision: "abandon", taskId, taskPath: "task.md", mainHead: "m".repeat(40), episodeHead: head, mainStatus: "In Progress", candidateMainRelationship: "diverged", parentTaskId: "PRIMECLAW-10", episodeTaskContentDigest: "a".repeat(64), finalSummary }; },
    async abandon(_ctx, _dependencies, decision) { taskCalls.push(["abandon", decision.taskId]); return { verified: true, outcome: "abandoned", taskId: decision.taskId, status: decision.mainStatus, priorMainHead: decision.mainHead, episodeHead: decision.episodeHead, archiveCommit: "a".repeat(40), archivedTaskPath: "backlog/archive/task.md", parentTaskId: decision.parentTaskId, episodeTaskContentDigest: decision.episodeTaskContentDigest, archivedTaskFileDigest: "q".repeat(64), resourcesRetained: true }; },
    prepareCleanup(taskId, evidence) { taskCalls.push(["prepare-cleanup", taskId, evidence.outcome]); return { operatorDecision: "cleanup", taskId, taskPath: "task.md", ownerSessionId: "owner", episodeHead: evidence.result.mergedHead ?? evidence.result.episodeHead, terminalOutcome: evidence.outcome, terminalCommit: evidence.result.doneCommit ?? evidence.result.archiveCommit, resources: {} }; },
    async cleanup(_ctx, _dependencies, decision) { taskCalls.push(["cleanup", decision.taskId]); return { verified: true, outcome: decision.terminalOutcome, taskId: decision.taskId, terminalCommit: decision.terminalCommit, resourcesRemoved: true, ownershipStatus: "inactive", reused: false }; },
  };
  const deps = { guideRoot, taskImplementationApprovals, taskActions, taskCleanup: {}, taskResolver(cwd, rawTaskId) { resolved.push({ cwd, rawTaskId }); if (rawTaskId.trim() === "missing") return null; return { taskId: "PRIMECLAW-10.38", title: "Planning fixture", status: taskStatus, implementationPlan: taskStatus === "In Planning" ? "Implement exact fixture" : null, projectRoot: root, taskPath: join(root, "task.md"), taskPathRelative: "task.md" }; }, async placementResolver() { return { engine: "local" }; }, async createEpisode(location, toolCallId, callCtx, _deps, options) { created.push({ location, toolCallId, callCtx, options }); return episode; }, async handoffEpisode() { return { admitted: true, sourceLocation: episode.sourceLocation, episodeId: "episode", episodeActiveSessionId: "route", handoffDelivery: "prompt", executeDelivery: "followUp" }; } };
  createReviewedPlanExtension(deps)(pi);
  return { root, commands, tools, events, sent, created, resolved, taskCalls, readyReceipt: { publication: readyPublication, integration: readyIntegration, verification: readyVerification }, ctx, episode, deps, taskImplementationApprovals, pi };
}

test("registers complete task lifecycle beside retained folder compatibility", () => {
  const f = fixture();
  assert.deepEqual([...f.commands.keys()].sort(), ["implement-spec", "implement-task", "plan", "plan-spec"]);
  assert.deepEqual([...f.tools.keys()].sort(), [
    "create_spec_episode", "create_task_episode", "finalize_spec_episode", "finalize_task_episode",
    "handoff_spec_episode", "handoff_task_episode", "plan_spec", "plan_task",
  ]);
  assert.equal(f.tools.has("ralph_plan"), false);
  assert.equal(f.tools.has("prime_claw_activate_conversation_guide"), false);
  assert.equal(f.tools.has("prime_claw_conversation_guide_status"), false);
});

test("native plan-spec preserves prep then sole phase follow-up", async () => {
  const f = fixture(); await f.commands.get("plan-spec").handler(".ralph/plans/future/alpha", f.ctx);
  assert.equal(f.sent.length, 2); assert.match(f.sent[0].message, /PLAN-PREP POLICY/); assert.equal(f.sent[0].options, undefined);
  assert.match(f.sent[1].message, /PLAN-SPEC POLICY/); assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });
});

test("plan_spec tool steers prep and queues sole plan-spec follow-up", async () => {
  const f = fixture(); const result = await f.tools.get("plan_spec").execute("tool", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(result.details.admitted, true); assert.deepEqual(f.sent[0].options, { deliverAs: "steer" }); assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });
  assert.match(result.content[0].text, /Planning admitted/);
});

test("native plan resolves one exact task and preserves prep then sole phase follow-up", async () => {
  const f = fixture(); await f.commands.get("plan").handler("10.38", f.ctx);
  assert.deepEqual(f.resolved, [{ cwd: f.root, rawTaskId: "10.38" }]);
  assert.equal(f.sent.length, 2); assert.match(f.sent[0].message, /PLAN-TASK-PREP POLICY/); assert.equal(f.sent[0].options, undefined);
  assert.ok(f.sent[0].message.includes("<operator-plan-task-id>\nPRIMECLAW-10.38\n</operator-plan-task-id>"));
  assert.match(f.sent[1].message, /PLAN-TASK POLICY/); assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });
});

test("plan_task steers prep, queues sole phase follow-up, and returns canonical identity", async () => {
  const f = fixture({ taskStatus: "In Planning" }); const result = await f.tools.get("plan_task").execute("tool", { taskId: "10.38" }, undefined, undefined, f.ctx);
  assert.equal(result.details.admitted, true); assert.equal(result.details.taskId, "PRIMECLAW-10.38");
  assert.deepEqual(f.sent[0].options, { deliverAs: "steer" }); assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });
  assert.match(result.content[0].text, /Planning admitted for PRIMECLAW-10\.38/);
});

test("task planning rejects missing and disallowed-state tasks before workflow admission", async () => {
  const missing = fixture(); await missing.commands.get("plan").handler("missing", missing.ctx);
  assert.equal(missing.sent.length, 1); assert.match(missing.sent[0].notify, /Usage: \/plan TASK-ID/);
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
  const f = fixture(); await f.commands.get("implement-spec").handler(".ralph/plans/future/alpha", f.ctx);
  assert.equal(f.sent.length, 2); assert.match(f.sent[0].message, /IMPLEMENT-PREP POLICY/);
  assert.ok(f.sent[1].message.indexOf("FULL OVERSIGHT GUIDE") < f.sent[1].message.indexOf("IMPLEMENT-SPEC POLICY"));
  assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });
});


test("public implement-task approval creates one task Episode with its bound placement", async () => {
  const f = fixture({ taskStatus: "In Planning" });
  await f.commands.get("implement-task").handler("10.38", f.ctx);
  assert.equal(f.sent.length, 2);
  assert.match(f.sent[0].message, /IMPLEMENT-TASK-PREP POLICY/);
  assert.match(f.sent[1].message, /IMPLEMENT-TASK POLICY/);
  await f.events.get("agent_end")({}, f.ctx);
  const result = await f.tools.get("create_task_episode").execute("create", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined);
  assert.equal(result.details.episodeId, "task-episode");
  assert.deepEqual(f.taskCalls, [["create", "PRIMECLAW-10.38", { engine: "local" }]]);
  const replay = await f.tools.get("create_task_episode").execute("again", { taskId: "PRIMECLAW-10.38" }, undefined, undefined, f.ctx);
  assert.equal(replay.isError, true);
  assert.match(replay.content[0].text, /no matching active/);
});

test("task handoff remains disjoint from retained folder handoff", async () => {
  const f = fixture({ taskStatus: "In Progress" });
  const result = await f.tools.get("handoff_task_episode").execute("handoff", { taskId: "PRIMECLAW-10.38", guidance: "accepted repair" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined);
  assert.deepEqual(f.taskCalls, [["handoff", "PRIMECLAW-10.38", "accepted repair"]]);
  assert.equal(f.created.length, 0);
});

test("finalize_task_episode transacts guarded review and terminal receipts", async () => {
  const f = fixture({ taskStatus: "In Progress" });
  const accepted = await f.tools.get("finalize_task_episode").execute("ready", {
    action: "accept-candidate", taskId: "PRIMECLAW-10.38", episodeHead: "e".repeat(40),
  }, undefined, undefined, f.ctx);
  assert.equal(accepted.isError, undefined);
  assert.equal(accepted.details.readyReceipt.verification.verified, true);
  assert.deepEqual(f.taskCalls.map((call) => call[0]), ["ready-publish", "ready-integrate", "ready-verify"]);

  f.taskCalls.length = 0;
  const merged = await f.tools.get("finalize_task_episode").execute("merge", {
    action: "merge", taskId: "PRIMECLAW-10.38", readyReceipt: f.readyReceipt, confirmed: true,
  }, undefined, undefined, f.ctx);
  assert.equal(merged.isError, undefined);
  assert.equal(merged.details.terminalEvidence.outcome, "merged");
  assert.deepEqual(f.taskCalls.map((call) => call[0]), ["merge"]);

  f.taskCalls.length = 0;
  const cleanup = await f.tools.get("finalize_task_episode").execute("cleanup", {
    action: "cleanup", taskId: "PRIMECLAW-10.38", terminalEvidence: merged.details.terminalEvidence, confirmed: true,
  }, undefined, undefined, f.ctx);
  assert.equal(cleanup.isError, undefined);
  assert.equal(cleanup.details.result.ownershipStatus, "inactive");
  assert.deepEqual(f.taskCalls.map((call) => call[0]), ["prepare-cleanup", "cleanup"]);
});

test("finalize_task_episode keeps reversible, blocker, and abandonment actions behind exact receipts", async () => {
  const f = fixture({ taskStatus: "In Progress" });
  const tool = f.tools.get("finalize_task_episode");
  const blocked = await tool.execute("block", { action: "block", taskId: "PRIMECLAW-10.38", episodeHead: "e".repeat(40) }, undefined, undefined, f.ctx);
  assert.equal(blocked.details.result.status, "Blocked");
  const resumed = await tool.execute("resume", { action: "resume", taskId: "PRIMECLAW-10.38", episodeHead: "e".repeat(40), guidance: "unblocked" }, undefined, undefined, f.ctx);
  assert.equal(resumed.details.handoff.admitted, true);
  const delayed = await tool.execute("delay", { action: "delay", taskId: "PRIMECLAW-10.38", readyReceipt: f.readyReceipt, confirmed: true }, undefined, undefined, f.ctx);
  assert.equal(delayed.details.result.outcome, "delayed");
  const changes = await tool.execute("changes", { action: "request-changes", taskId: "PRIMECLAW-10.38", readyReceipt: f.readyReceipt, guidance: "fix exact defect", confirmed: true }, undefined, undefined, f.ctx);
  assert.equal(changes.details.changesReceipt.verification.status, "In Progress");
  const abandon = await tool.execute("abandon", { action: "abandon", taskId: "PRIMECLAW-10.38", episodeHead: "e".repeat(40), finalSummary: "Stopped by operator decision.", confirmed: true }, undefined, undefined, f.ctx);
  assert.equal(abandon.details.terminalEvidence.outcome, "abandoned");
  assert.deepEqual(f.taskCalls.map((call) => call[0]), [
    "block", "resume", "handoff", "delay", "changes-publish", "changes-integrate", "changes-resume", "prepare-abandon", "abandon",
  ]);
  const foreign = await tool.execute("delay", { action: "delay", taskId: "PRIMECLAW-OTHER", readyReceipt: f.readyReceipt }, undefined, undefined, f.ctx);
  assert.equal(foreign.isError, true);
  assert.match(foreign.content[0].text, /does not bind the exact requested task/);
});

test("finalize_task_episode recovers exact pushed integration receipts and unpushed abandonment", async () => {
  const f = fixture({ taskStatus: "In Progress" });
  const tool = f.tools.get("finalize_task_episode");
  const readyPushError = { ...f.readyReceipt.integration, pushError: "offline" };
  const accepted = await tool.execute("ready-retry", {
    action: "accept-candidate", taskId: "PRIMECLAW-10.38",
    readyProgress: { publication: f.readyReceipt.publication, integration: readyPushError },
  }, undefined, undefined, f.ctx);
  assert.equal(accepted.isError, undefined);
  assert.equal(f.taskCalls.filter((call) => call[0] === "ready-integrate").length, 1);

  const changesPublication = { taskId: "PRIMECLAW-10.38", status: "In Progress", commit: "c".repeat(40), episodeHead: "f".repeat(40), parentTaskId: "PRIMECLAW-10", episodeTaskContentDigest: "d".repeat(64) };
  const changesIntegration = { taskId: "PRIMECLAW-10.38", changesCommit: changesPublication.commit, previousRefreshedEpisodeHead: changesPublication.episodeHead, integratedMainHead: "n".repeat(40), refreshedEpisodeHead: "x".repeat(40), parentTaskId: "PRIMECLAW-10", episodeTaskContentDigest: "d".repeat(64), pushError: "offline" };
  const changed = await tool.execute("changes-retry", {
    action: "request-changes", taskId: "PRIMECLAW-10.38", readyReceipt: f.readyReceipt,
    changesProgress: { publication: changesPublication, integration: changesIntegration }, confirmed: true,
  }, undefined, undefined, f.ctx);
  assert.equal(changed.isError, undefined);
  assert.equal(f.taskCalls.filter((call) => call[0] === "changes-integrate").length, 1);

  const decision = f.deps.taskActions.prepareAbandonment("PRIMECLAW-10.38", "e".repeat(40), "Stopped.");
  f.taskCalls.length = 0;
  const abandonment = { outcome: "abandoned", decision, result: { verified: true, outcome: "abandoned", taskId: decision.taskId, status: decision.mainStatus, priorMainHead: decision.mainHead, episodeHead: decision.episodeHead, archiveCommit: "a".repeat(40), archivedTaskPath: "backlog/archive/task.md", parentTaskId: decision.parentTaskId, episodeTaskContentDigest: decision.episodeTaskContentDigest, archivedTaskFileDigest: "q".repeat(64), resourcesRetained: true, pushError: "offline" } };
  const replayed = await tool.execute("abandon-retry", { action: "abandon", taskId: "PRIMECLAW-10.38", terminalEvidence: abandonment, confirmed: true }, undefined, undefined, f.ctx);
  assert.equal(replayed.isError, undefined);
  assert.deepEqual(f.taskCalls.map((call) => call[0]), ["abandon"]);
  assert.equal(replayed.details.terminalEvidence.result.pushError, undefined);
});

test("finalize_task_episode requires decisions and never labels uncertain handoff transport retryable", async () => {
  const f = fixture({ taskStatus: "In Progress" });
  const tool = f.tools.get("finalize_task_episode");
  for (const action of ["delay", "request-changes"]) {
    const result = await tool.execute(action, { action, taskId: "PRIMECLAW-10.38", readyReceipt: f.readyReceipt }, undefined, undefined, f.ctx);
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /explicit operator authority/);
  }
  f.deps.taskActions.handoff = async () => { throw new EpisodeStateUncertainError("handoff admission uncertain"); };
  const resumed = await tool.execute("resume", { action: "resume", taskId: "PRIMECLAW-10.38", episodeHead: "e".repeat(40) }, undefined, undefined, f.ctx);
  assert.equal(resumed.isError, true);
  assert.equal(resumed.details.transportUncertain, true);
  assert.equal(resumed.details.retryable, false);

  f.deps.taskActions.changesResume = async () => { throw new HandoffFollowUpRejectedError("changes handoff admitted; follow-up uncertain"); };
  const changed = await tool.execute("changes", { action: "request-changes", taskId: "PRIMECLAW-10.38", readyReceipt: f.readyReceipt, confirmed: true }, undefined, undefined, f.ctx);
  assert.equal(changed.isError, true);
  assert.equal(changed.details.transportUncertain, true);
  assert.equal(changed.details.retryable, false);
  assert.ok(changed.details.changesProgress.publication);
  assert.ok(changed.details.changesProgress.integration);
});

test("finalize_task_episode preserves partial phase receipts and explicit outcome authority", async () => {
  const f = fixture({ taskStatus: "In Progress" });
  f.deps.taskActions.readyIntegrate = async (publication) => {
    f.taskCalls.push(["ready-integrate", publication.commit]);
    throw new Error("integration stopped");
  };
  const partial = await f.tools.get("finalize_task_episode").execute("ready", {
    action: "accept-candidate", taskId: "PRIMECLAW-10.38", episodeHead: "e".repeat(40),
  }, undefined, undefined, f.ctx);
  assert.equal(partial.isError, true);
  assert.equal(partial.details.readyProgress.publication.status, "Ready for Merge");
  assert.match(partial.content[0].text, /integration stopped/);

  const unconfirmed = await f.tools.get("finalize_task_episode").execute("merge", {
    action: "merge", taskId: "PRIMECLAW-10.38", readyReceipt: f.readyReceipt,
  }, undefined, undefined, f.ctx);
  assert.equal(unconfirmed.isError, true);
  assert.match(unconfirmed.content[0].text, /explicit confirmation/);
});

test("plan_spec reports uncertain second-send admission without retrying", async () => {
  const f = fixture({ throwOnSend: 2 });
  const result = await f.tools.get("plan_spec").execute("tool", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, true); assert.equal(f.sent.length, 1);
  assert.deepEqual(f.sent[0].options, { deliverAs: "steer" });
  assert.match(result.content[0].text, /follow-up admission is unconfirmed; inspect before retrying/);
});

test("stable --host bypass is bound to the exact implementation approval", async () => {
  const f = fixture(); await f.commands.get("implement-spec").handler(".ralph/plans/future/alpha --host id:123e4567-e89b-12d3-a456-426614174000", f.ctx);
  await f.events.get("agent_end")({}, f.ctx);
  const result = await f.tools.get("create_spec_episode").execute("tool", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, undefined); assert.equal(f.created.length, 1);
  assert.equal(f.created[0].options.host, "id:123e4567-e89b-12d3-a456-426614174000");
  assert.match(f.created[0].options.approvedBundleDigest, /^[0-9a-f]{64}$/);
});

test("invalid host syntax creates no approval or queued workflow", async () => {
  const f = fixture(); await f.commands.get("implement-spec").handler(".ralph/plans/future/alpha --host local", f.ctx);
  assert.equal(f.sent.length, 1); assert.match(f.sent[0].notify, /Usage: \/implement-spec/);
  const result = await f.tools.get("create_spec_episode").execute("tool", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, true); assert.match(result.content[0].text, /no matching active/);
});

test("creation requires exact current post-prep approval and consumes it once", async () => {
  const f = fixture(); await f.commands.get("implement-spec").handler(".ralph/plans/future/alpha", f.ctx); await f.events.get("agent_end")({}, f.ctx);
  const mismatch = await f.tools.get("create_spec_episode").execute("bad", { location: ".ralph/plans/future/beta" }, undefined, undefined, f.ctx);
  assert.equal(mismatch.isError, true); assert.equal(f.created.length, 0);
  const ok = await f.tools.get("create_spec_episode").execute("ok", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(ok.details.episodeId, "episode"); assert.equal(f.created.length, 1);
  const replay = await f.tools.get("create_spec_episode").execute("again", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(replay.isError, true); assert.equal(f.created.length, 1);
});

test("phase completion without creation clears ephemeral approval", async () => {
  const f = fixture(); await f.commands.get("implement-spec").handler(".ralph/plans/future/alpha", f.ctx);
  await f.events.get("agent_end")({}, f.ctx); await f.events.get("agent_end")({}, f.ctx);
  const result = await f.tools.get("create_spec_episode").execute("late", { location: ".ralph/plans/future/alpha" }, undefined, undefined, f.ctx);
  assert.equal(result.isError, true);
});

test("tool guidance preserves operator authority and fixed fresh assignment", () => {
  const f = fixture(); const create = f.tools.get("create_spec_episode"); const handoff = f.tools.get("handoff_spec_episode"); const finalize = f.tools.get("finalize_spec_episode");
  assert.match(create.promptGuidelines.join(" "), /fresh Episode/); assert.match(create.promptGuidelines.join(" "), /never send an initial handoff/);
  assert.match(handoff.promptGuidelines.join(" "), /product decisions/); assert.match(finalize.promptGuidelines.join(" "), /operator/);
  const taskCreate = f.tools.get("create_task_episode"); const taskHandoff = f.tools.get("handoff_task_episode"); const taskFinalize = f.tools.get("finalize_task_episode");
  assert.match(taskCreate.promptGuidelines.join(" "), /exactly once/); assert.match(taskCreate.promptGuidelines.join(" "), /cannot be overridden/);
  assert.match(taskHandoff.promptGuidelines.join(" "), /Never use ordinary handoff for Blocked, Ready for Merge/);
  assert.match(taskFinalize.promptGuidelines.join(" "), /operator's explicit decision/);
  assert.match(taskFinalize.promptGuidelines.join(" "), /separate explicit operator confirmation/);
  assert.match(taskFinalize.promptGuidelines.join(" "), /exact terminal evidence/);
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
      implementationPlan: "One meaningful step", path: relativeTaskPath,
    } }), stderr: "", status: 0 };
  } };

  const selected = resolveBacklogTask(root, "10.38", runner);
  assert.equal(selected.taskId, "PRIMECLAW-10.38");
  assert.equal(selected.status, "In Planning");
  assert.equal(selected.implementationPlan, "One meaningful step");
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


test("inactive task implementation chain binds exact task, placement, and full post-prep guide", async () => {
  const f = fixture({ taskStatus: "In Planning" });
  const placementCalls = [];
  const result = await admitTaskImplementationPrepChain(
    f.pi,
    f.ctx,
    "10.38 --host id:123e4567-e89b-12d3-a456-426614174000",
    f.taskImplementationApprovals,
    {
      guideRoot: f.deps.guideRoot,
      taskResolver: f.deps.taskResolver,
      async placementResolver(projectRoot, host, callCtx) {
        placementCalls.push({ projectRoot, host, callCtx });
        return { engine: "orca", projectSetupId: host.slice(3) };
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.taskId, "PRIMECLAW-10.38");
  assert.equal(result.taskPath, join(f.root, "task.md"));
  assert.deepEqual(placementCalls.map(({ projectRoot, host }) => ({ projectRoot, host })), [{
    projectRoot: f.root,
    host: "id:123e4567-e89b-12d3-a456-426614174000",
  }]);
  assert.equal(f.sent.length, 2);
  assert.match(f.sent[0].message, /IMPLEMENT-TASK-PREP POLICY/);
  assert.equal(f.sent[0].options, undefined);
  assert.ok(f.sent[1].message.indexOf("FULL OVERSIGHT GUIDE") < f.sent[1].message.indexOf("IMPLEMENT-TASK POLICY"));
  assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });

  const task = f.deps.taskResolver(f.root, "PRIMECLAW-10.38");
  assert.equal(f.taskImplementationApprovals.consume(f.ctx, task), null);
  await f.events.get("agent_end")({}, f.ctx);
  const approval = f.taskImplementationApprovals.consume(f.ctx, task);
  assert.equal(approval.ownerSessionId, "owner");
  assert.equal(approval.taskId, "PRIMECLAW-10.38");
  assert.equal(approval.taskPath, join(f.root, "task.md"));
  assert.deepEqual(approval.placement, {
    engine: "orca",
    projectSetupId: "123e4567-e89b-12d3-a456-426614174000",
  });
  assert.equal(f.taskImplementationApprovals.consume(f.ctx, task), null);
});

test("inactive task implementation placement failure or ambiguity queues nothing and grants nothing", async () => {
  const f = fixture({ taskStatus: "In Planning" });
  const result = await admitTaskImplementationPrepChain(
    f.pi,
    f.ctx,
    "PRIMECLAW-10.38",
    f.taskImplementationApprovals,
    {
      guideRoot: f.deps.guideRoot,
      taskResolver: f.deps.taskResolver,
      async placementResolver() { throw new Error("multiple ready local setups are ambiguous"); },
    },
  );
  assert.equal(result.ok, false);
  assert.equal(result.level, "error");
  assert.match(result.message, /multiple ready local setups are ambiguous/);
  assert.equal(f.sent.length, 0);
  await f.events.get("agent_end")({}, f.ctx);
  const task = f.deps.taskResolver(f.root, "PRIMECLAW-10.38");
  assert.equal(f.taskImplementationApprovals.consume(f.ctx, task), null);

  const invalid = await admitTaskImplementationPrepChain(
    f.pi,
    f.ctx,
    "PRIMECLAW-10.38 --host local",
    f.taskImplementationApprovals,
    { guideRoot: f.deps.guideRoot, taskResolver: f.deps.taskResolver },
  );
  assert.deepEqual(invalid, { ok: false, message: "Usage: /implement-task TASK-ID [--host id:<project-host-setup-id>]", level: "warning" });
  assert.equal(f.sent.length, 0);
});

test("inactive task approval fails closed on identity drift and clears at phase end or shutdown", async () => {
  const f = fixture({ taskStatus: "In Planning" });
  const admit = () => admitTaskImplementationPrepChain(
    f.pi,
    f.ctx,
    "PRIMECLAW-10.38",
    f.taskImplementationApprovals,
    {
      guideRoot: f.deps.guideRoot,
      taskResolver: f.deps.taskResolver,
      async placementResolver() { return { engine: "local" }; },
    },
  );
  assert.equal((await admit()).ok, true);
  await f.events.get("agent_end")({}, f.ctx);
  const task = f.deps.taskResolver(f.root, "PRIMECLAW-10.38");
  assert.equal(f.taskImplementationApprovals.consume(f.ctx, { ...task, taskPath: join(f.root, "other.md") }), null);
  assert.deepEqual(f.taskImplementationApprovals.consume(f.ctx, task).placement, { engine: "local" });

  assert.equal((await admit()).ok, true);
  await f.events.get("agent_end")({}, f.ctx);
  await f.events.get("agent_end")({}, f.ctx);
  assert.equal(f.taskImplementationApprovals.consume(f.ctx, task), null);

  assert.equal((await admit()).ok, true);
  await f.events.get("agent_end")({}, f.ctx);
  await f.events.get("session_shutdown")({}, f.ctx);
  assert.equal(f.taskImplementationApprovals.consume(f.ctx, task), null);
});
