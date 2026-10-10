import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
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

function fixture({ status = "active", owner = "owner" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-oversight-"));
  execFileSync("git", ["init", "-q", root]);
  const guideRoot = join(root, "plugin");
  mkdirSync(join(guideRoot, "skills", "prime-claw-oversee-episode"), { recursive: true });
  writeFileSync(join(guideRoot, "skills", "prime-claw-oversee-episode", "SKILL.md"), `FULL OVERSIGHT GUIDE
`);
  if (status) writeEpisodeOwnership(root, {
    version: 1, status, operationId: "op", engine: "local", ownerSessionId: owner,
    sourceLocation: ".ralph/plans/future/alpha", slug: "alpha", baseRef: "base", bundleDigest: "0".repeat(64),
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    worktree: join(root, "wt"), branch: "actual-branch", head: "head",
    episodeId: "episode", episodeSessionFile: join(root, "episode.jsonl"), episodeActiveSessionId: "route",
  });
  const events = new Map(); const tools = new Map(); const sent = [];
  const pi = {
    on(name, handler) { events.set(name, handler); },
    registerTool(tool) { tools.set(tool.name, tool); },
    async sendMessage(message, options) { sent.push({ message, options }); },
  };
  const ctx = { cwd: root, sessionManager: { getSessionId: () => "owner" } };
  registerConversationOversight(pi, { guideRoot });
  return { root, events, tools, sent, ctx };
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

for (const [name, status, owner] of [
  ["no owner", null, "owner"], ["inactive", "inactive", "owner"], ["foreign owner", "active", "other"],
]) test(`compact injects nothing for ${name}`, async () => {
  const f = fixture({ status, owner });
  await f.events.get("session_compact")({ type: "session_compact", compactionEntry: { id: "one" } }, f.ctx);
  assert.deepEqual(f.sent, []);
});

test("ordinary guide loading ignores project skill collisions", async () => {
  const f = fixture();
  mkdirSync(join(f.root, ".agents", "skills", "prime-claw-oversee-episode"), { recursive: true });
  writeFileSync(join(f.root, ".agents", "skills", "prime-claw-oversee-episode", "SKILL.md"), "collision");
  await f.events.get("session_compact")({ type: "session_compact", compactionEntry: { id: "one" } }, f.ctx);
  assert.equal(f.sent[0].message.content, `FULL OVERSIGHT GUIDE
`);
});

test("promotion preflight allows only terminal or exact-owner state", () => {
  const f = fixture();
  assert.doesNotThrow(() => assertConversationPromotionReady(f.ctx, ".ralph/plans/future/alpha"));
  assert.throws(() => assertConversationPromotionReady(f.ctx, ".ralph/plans/future/beta"), /already has non-terminal/);
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
