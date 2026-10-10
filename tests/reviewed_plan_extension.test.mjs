import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { createReviewedPlanExtension } from "../src/prime-agent-plugin/extensions/reviewed-plan.ts";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-reviewed-")); execFileSync("git", ["init", "-q", root]);
  for (const slug of ["alpha", "beta"]) mkdirSync(join(root, ".ralph", "plans", "future", slug), { recursive: true });
  mkdirSync(join(root, ".prime-claw", "workflows"), { recursive: true });
  for (const name of ["plan-prep", "plan-spec", "implement-prep", "implement-spec", "handoff"]) writeFileSync(join(root, ".prime-claw", "workflows", `${name}.md`), `---
name: ${name}
---
${name.toUpperCase()} POLICY
`);
  mkdirSync(join(root, ".agents", "skills", "execute"), { recursive: true }); writeFileSync(join(root, ".agents", "skills", "execute", "SKILL.md"), "EXECUTE POLICY");
  const guideRoot = join(root, "plugin"); mkdirSync(join(guideRoot, "skills", "prime-claw-oversee-episode"), { recursive: true }); writeFileSync(join(guideRoot, "skills", "prime-claw-oversee-episode", "SKILL.md"), `FULL OVERSIGHT GUIDE
`);
  const commands = new Map(), tools = new Map(), events = new Map(), sent = [], created = [];
  const pi = { registerCommand(name, value) { commands.set(name, value); }, registerTool(tool) { tools.set(tool.name, tool); }, on(name, handler) { events.set(name, handler); }, sendUserMessage(message, options) { sent.push({ message, options }); }, async sendMessage() {} };
  const ctx = { cwd: root, hasUI: true, ui: { notify(message, level) { sent.push({ notify: message, level }); } }, sessionManager: { getSessionId: () => "owner", getSessionFile: () => join(root, "owner.jsonl"), getHeader: () => ({ rlmDepth: 0 }) } };
  const episode = { version: 1, status: "active", operationId: "op", engine: "local", ownerSessionId: "owner", sourceLocation: ".ralph/plans/future/alpha", slug: "alpha", baseRef: "base", bundleDigest: "0".repeat(64), createdAt: "x", updatedAt: "x", worktree: join(root, "wt"), branch: "branch", head: "head", episodeId: "episode", episodeSessionFile: join(root, "episode.jsonl"), episodeActiveSessionId: "route", reused: false };
  const deps = { guideRoot, async createEpisode(location, toolCallId, callCtx, _deps, options) { created.push({ location, toolCallId, callCtx, options }); return episode; }, async handoffEpisode() { return { admitted: true, sourceLocation: episode.sourceLocation, episodeId: "episode", episodeActiveSessionId: "route", handoffDelivery: "prompt", executeDelivery: "followUp" }; } };
  createReviewedPlanExtension(deps)(pi);
  return { root, commands, tools, events, sent, created, ctx, episode };
}

test("registers renamed planning surfaces and no guide activation tools", () => {
  const f = fixture();
  assert.deepEqual([...f.commands.keys()].sort(), ["implement-spec", "plan-spec"]);
  assert.deepEqual([...f.tools.keys()].sort(), ["create_spec_episode", "finalize_spec_episode", "handoff_spec_episode", "plan_spec"]);
  assert.equal(f.tools.has("ralph_plan"), false); assert.equal(f.commands.has("plan"), false);
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

test("implement-spec queues full ordinary guide in post-prep phase before semantic workflow", async () => {
  const f = fixture(); await f.commands.get("implement-spec").handler(".ralph/plans/future/alpha", f.ctx);
  assert.equal(f.sent.length, 2); assert.match(f.sent[0].message, /IMPLEMENT-PREP POLICY/);
  assert.ok(f.sent[1].message.indexOf("FULL OVERSIGHT GUIDE") < f.sent[1].message.indexOf("IMPLEMENT-SPEC POLICY"));
  assert.deepEqual(f.sent[1].options, { deliverAs: "followUp" });
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
