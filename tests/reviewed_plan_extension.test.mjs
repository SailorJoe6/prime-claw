import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { createReviewedPlanExtension } from "../src/prime-agent-plugin/extensions/reviewed-plan.ts";
import { resolveBacklogTask } from "../src/prime-agent-plugin/extension-support/reviewed-plan-support.ts";

function fixture({ throwOnSend = 0, taskStatus = "In Design" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-reviewed-")); execFileSync("git", ["init", "-q", root]);
  for (const slug of ["alpha", "beta"]) mkdirSync(join(root, ".ralph", "plans", "future", slug), { recursive: true });
  mkdirSync(join(root, ".prime-claw", "workflows"), { recursive: true });
  for (const name of ["plan-prep", "plan-spec", "plan-task-prep", "plan-task", "implement-prep", "implement-spec", "handoff"]) writeFileSync(join(root, ".prime-claw", "workflows", `${name}.md`), `---
name: ${name}
---
${name.toUpperCase()} POLICY
`);
  mkdirSync(join(root, ".agents", "skills", "execute"), { recursive: true }); writeFileSync(join(root, ".agents", "skills", "execute", "SKILL.md"), "EXECUTE POLICY");
  const guideRoot = join(root, "plugin"); mkdirSync(join(guideRoot, "skills", "prime-claw-oversee-episode"), { recursive: true }); writeFileSync(join(guideRoot, "skills", "prime-claw-oversee-episode", "SKILL.md"), `FULL OVERSIGHT GUIDE
`);
  const commands = new Map(), tools = new Map(), events = new Map(), sent = [], created = [], resolved = [];
  let sendCount = 0;
  const pi = { registerCommand(name, value) { commands.set(name, value); }, registerTool(tool) { tools.set(tool.name, tool); }, on(name, handler) { events.set(name, handler); }, sendUserMessage(message, options) { sendCount += 1; if (sendCount === throwOnSend) throw new Error("synthetic send failure"); sent.push({ message, options }); }, async sendMessage() {} };
  const ctx = { cwd: root, hasUI: true, ui: { notify(message, level) { sent.push({ notify: message, level }); } }, sessionManager: { getSessionId: () => "owner", getSessionFile: () => join(root, "owner.jsonl"), getHeader: () => ({ rlmDepth: 0 }) } };
  const episode = { version: 1, status: "active", operationId: "op", engine: "local", ownerSessionId: "owner", sourceLocation: ".ralph/plans/future/alpha", slug: "alpha", baseRef: "base", bundleDigest: "0".repeat(64), createdAt: "x", updatedAt: "x", worktree: join(root, "wt"), branch: "branch", head: "head", episodeId: "episode", episodeSessionFile: join(root, "episode.jsonl"), episodeActiveSessionId: "route", reused: false };
  const deps = { guideRoot, taskResolver(cwd, rawTaskId) { resolved.push({ cwd, rawTaskId }); if (rawTaskId.trim() === "missing") return null; return { taskId: "PRIMECLAW-10.38", title: "Planning fixture", status: taskStatus, implementationPlan: null, projectRoot: root, taskPath: join(root, "task.md"), taskPathRelative: "task.md" }; }, async createEpisode(location, toolCallId, callCtx, _deps, options) { created.push({ location, toolCallId, callCtx, options }); return episode; }, async handoffEpisode() { return { admitted: true, sourceLocation: episode.sourceLocation, episodeId: "episode", episodeActiveSessionId: "route", handoffDelivery: "prompt", executeDelivery: "followUp" }; } };
  createReviewedPlanExtension(deps)(pi);
  return { root, commands, tools, events, sent, created, resolved, ctx, episode };
}

test("registers task and folder planning surfaces without guide activation tools", () => {
  const f = fixture();
  assert.deepEqual([...f.commands.keys()].sort(), ["implement-spec", "plan", "plan-spec"]);
  assert.deepEqual([...f.tools.keys()].sort(), ["create_spec_episode", "finalize_spec_episode", "handoff_spec_episode", "plan_spec", "plan_task"]);
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
