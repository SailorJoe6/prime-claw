import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  CONVERSATION_GUIDE_MESSAGE_TYPE,
  assertConversationPromotionReady,
  registerConversationOversight,
} from "../src/prime-agent-plugin/extension-support/conversation-oversight.ts";
import { writeEpisodeOwnership } from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";
import { reconcileLegacySpecificationInventory } from "../src/prime-agent-plugin/extension-support/legacy-specification-inventory.ts";

function fixture({ status = "active", owner = "owner", taskNative = false, legacyFiles = true, mainLegacyFiles = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-oversight-"));
  execFileSync("git", ["init", "-q", root]);
  const guideRoot = join(root, "plugin");
  mkdirSync(join(guideRoot, "skills", "prime-claw-oversee-episode"), { recursive: true });
  writeFileSync(join(guideRoot, "skills", "prime-claw-oversee-episode", "SKILL.md"), `FULL OVERSIGHT GUIDE
`);
  const worktree=join(root,"wt");mkdirSync(worktree,{recursive:true});
  if (!taskNative && legacyFiles) { const plans=join(worktree,".ralph/plans");mkdirSync(plans,{recursive:true});writeFileSync(join(plans,"SPECIFICATION.md"),"spec\n");writeFileSync(join(plans,"EXECUTION_PLAN.md"),"plan\n"); }
  if (mainLegacyFiles) { const plans=join(root,".ralph/plans");mkdirSync(plans,{recursive:true});writeFileSync(join(plans,"SPECIFICATION.md"),"old in-place spec\n");writeFileSync(join(plans,"IMPLEMENTATION_PLAN.md"),"old in-place plan\n"); }
  if (status) writeEpisodeOwnership(root, {
    ...(taskNative
      ? { version: 2, taskId: "PRIMECLAW-10.38", taskPath: "backlog/tasks/task.md" }
      : { version: 1, sourceLocation: ".ralph/plans/future/alpha", slug: "alpha", bundleDigest: "0".repeat(64) }),
    status, operationId: "op", engine: "local", ownerSessionId: owner, baseRef: taskNative ? "a".repeat(40) : "base",
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    worktree, branch: "actual-branch", head: "head",
    episodeId: "episode", episodeSessionFile: join(root, "episode.jsonl"), episodeActiveSessionId: "route",
  });
  reconcileLegacySpecificationInventory(root, "initialize");
  const events = new Map(); const tools = new Map(); const sent = [];
  const pi = {
    on(name, handler) { events.set(name, handler); },
    registerTool(tool) { tools.set(tool.name, tool); },
    async sendMessage(message, options) { sent.push({ message, options }); },
  };
  const ctx = { cwd: root, sessionManager: { getSessionId: () => "owner" } };
  registerConversationOversight(pi, { guideRoot });
  return { root, worktree, events, tools, sent, ctx };
}

test("oversight registers no activation or readiness tools", () => {
  const f = fixture();
  assert.deepEqual([...f.tools], []);
  assert.equal(f.events.has("context"), false);
  assert.equal(f.events.has("session_start"), false);
  assert.equal(f.events.has("session_compact"), true);
});

test("each qualifying compact appends one full non-turn guide message", async () => {
  const f = fixture(); const handler = f.events.get("session_compact");
  await handler({ type: "session_compact", compactionEntry: { id: "one" } }, f.ctx);
  await handler({ type: "session_compact", compactionEntry: { id: "two" } }, f.ctx);
  assert.equal(f.sent.length, 2);
  for (const sent of f.sent) {
    assert.equal(sent.message.customType, CONVERSATION_GUIDE_MESSAGE_TYPE);
    assert.equal(sent.message.content, `FULL OVERSIGHT GUIDE
`);
    assert.equal(sent.message.display, false);
    assert.deepEqual(sent.options, { triggerTurn: false });
  }
});

test("retained oversight rejects a changed promoted specification without requiring its source or a provider", async () => {
  const f = fixture();
  writeFileSync(join(f.worktree, ".ralph", "plans", "SPECIFICATION.md"), "changed\n");
  await f.events.get("session_compact")({ type: "session_compact", compactionEntry: { id: "changed" } }, f.ctx);
  assert.equal(f.sent.length, 0);
});

test("compaction selects only the exact Conversation's registry record", async () => {
  const f = fixture({ taskNative: true });
  const otherWorktree=join(f.root,"other-wt");mkdirSync(otherWorktree,{recursive:true});
  writeEpisodeOwnership(f.root, {
    version:2,status:"active",operationId:"other-op",engine:"local",ownerSessionId:"other-owner",
    taskId:"PRIMECLAW-10.39",taskPath:"backlog/tasks/other.md",baseRef:"b".repeat(40),
    createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-01T00:00:00Z",
    worktree:otherWorktree,branch:"other-branch",head:"other-head",episodeId:"other-episode",
    episodeSessionFile:join(f.root,"other.jsonl"),episodeActiveSessionId:"other-route",
  });
  const compact=f.events.get("session_compact");
  await compact({type:"session_compact",compactionEntry:{id:"owner"}},f.ctx);
  await compact({type:"session_compact",compactionEntry:{id:"other"}},{...f.ctx,sessionManager:{getSessionId:()=>"other-owner"}});
  assert.deepEqual(f.sent.map(({message})=>message.details),[
    {taskId:"PRIMECLAW-10.38",episodeId:"episode"},
    {taskId:"PRIMECLAW-10.39",episodeId:"other-episode"},
  ]);
});


for (const [name, status, owner] of [
  ["no owner", null, "owner"], ["inactive", "inactive", "owner"], ["foreign owner", "active", "other"],
]) test(`compact injects nothing for ${name}`, async () => {
  const f = fixture({ status, owner });
  await f.events.get("session_compact")({ type: "session_compact", compactionEntry: { id: "one" } }, f.ctx);
  assert.deepEqual(f.sent, []);
});

test("legacy ownership without active worktree files does not claim live oversight", async () => {
  const f=fixture({legacyFiles:false});
  await f.events.get("session_compact")({type:"session_compact",compactionEntry:{id:"missing"}},f.ctx);
  assert.deepEqual(f.sent,[]);
});

test("completed legacy candidate remains the same live Episode through review and revision", async () => {
  const f=fixture(), plan=join(f.worktree,".ralph/plans/EXECUTION_PLAN.md"), compact=f.events.get("session_compact");
  appendFileSync(plan,"candidate ready for review\n");
  await compact({type:"session_compact",compactionEntry:{id:"candidate"}},f.ctx);
  appendFileSync(plan,"accepted bounded revision\n");
  await compact({type:"session_compact",compactionEntry:{id:"revision"}},f.ctx);
  assert.equal(f.sent.length,2);
  assert.deepEqual(f.sent.map(({message})=>message.details),[
    {sourceLocation:".ralph/plans/future/alpha",episodeId:"episode"},
    {sourceLocation:".ralph/plans/future/alpha",episodeId:"episode"},
  ]);
});

test("no ownership plus canonical-main legacy files remains old in-place work, not an Episode", async () => {
  const f=fixture({status:null,mainLegacyFiles:true});
  await f.events.get("session_compact")({type:"session_compact",compactionEntry:{id:"in-place"}},f.ctx);
  assert.deepEqual(f.sent,[]);
});

test("ordinary guide loading ignores project skill collisions", async () => {
  const f = fixture();
  mkdirSync(join(f.root, ".agents", "skills", "prime-claw-oversee-episode"), { recursive: true });
  writeFileSync(join(f.root, ".agents", "skills", "prime-claw-oversee-episode", "SKILL.md"), "collision");
  await f.events.get("session_compact")({ type: "session_compact", compactionEntry: { id: "one" } }, f.ctx);
  assert.equal(f.sent[0].message.content, `FULL OVERSIGHT GUIDE
`);
});

test("promotion preflight scopes non-terminal ownership to the exact Conversation", () => {
  const f = fixture();
  assert.doesNotThrow(() => assertConversationPromotionReady(f.ctx, ".ralph/plans/future/alpha"));
  assert.throws(() => assertConversationPromotionReady(f.ctx, ".ralph/plans/future/beta"), /already has non-terminal/);
  const foreign = fixture({ owner: "other-owner" });
  assert.doesNotThrow(() => assertConversationPromotionReady(foreign.ctx, ".ralph/plans/future/alpha"));
});


test("task-native ownership survives compaction without pretending to be a folder", async () => {
  const f = fixture({ taskNative: true });
  await f.events.get("session_compact")({ type: "session_compact", compactionEntry: { id: "task" } }, f.ctx);
  assert.equal(f.sent.length, 1);
  assert.deepEqual(f.sent[0].message.details, { taskId: "PRIMECLAW-10.38", episodeId: "episode" });
  assert.throws(() => assertConversationPromotionReady(f.ctx, ".ralph/plans/future/alpha"), /PRIMECLAW-10.38/);
});


test("compaction is inert outside a Git project", async () => {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-ordinary-"));
  const guideRoot = join(root, "plugin");
  mkdirSync(join(guideRoot, "skills", "prime-claw-oversee-episode"), { recursive: true });
  writeFileSync(join(guideRoot, "skills", "prime-claw-oversee-episode", "SKILL.md"), "guide");
  const events = new Map(); const sent = [];
  const pi = { on(name, handler) { events.set(name, handler); }, async sendMessage(message) { sent.push(message); } };
  registerConversationOversight(pi, { guideRoot });
  await events.get("session_compact")({}, { cwd: root, sessionManager: { getSessionId: () => "ordinary" } });
  assert.deepEqual(sent, []);
});
