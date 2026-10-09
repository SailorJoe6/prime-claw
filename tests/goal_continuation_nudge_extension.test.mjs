import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { createGoalContinuationNudgeExtension, loadGoalContinuationNudge } from "../src/prime-agent-plugin/extensions/goal-continuation-nudge.ts";

function createHarness(cwd) {
  const events = new Map();
  const commands = [];
  const tools = [];
  const pi = {
    on(name, handler) { events.set(name, handler); },
    registerCommand(name) { commands.push(name); },
    registerTool(definition) { tools.push(definition.name); },
  };
  let currentTime = 0;
  const extension = createGoalContinuationNudgeExtension({ now: () => currentTime });
  extension(pi);
  const ctx = {
    cwd,
    sessionManager: { getSessionId() { return "session-1"; } },
  };
  return {
    events, commands, tools, ctx,
    setTime(value) { currentTime = value; },
  };
}

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "prime-claw-goal-nudge-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return { cwd, ...createHarness(cwd) };
}

function writeConfig(cwd, {
  minimum = 2,
  window = 30,
  reminder = "custom project reminder",
} = {}) {
  const path = join(cwd, ".agents", "skills", "goals-and-heartbeats", "CONTINUATION.md");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `---
minimum_rapid_continuations: ${minimum}
window_seconds: ${window}
---

${reminder}
`);
  return path;
}

function goalContinuation(goalId, continuationsUsed, content = "native goal continuation") {
  return {
    role: "custom",
    customType: "goal_context",
    content,
    display: true,
    details: { kind: "continuation", goalId, continuationsUsed },
    timestamp: continuationsUsed,
  };
}

function outputText(result, original) {
  const message = result?.messages?.at(-1) ?? original.at(-1);
  if (typeof message.content === "string") return message.content;
  return message.content.find((part) => part.type === "text")?.text;
}

test("registers only context and session cleanup listeners", (t) => {
  const f = fixture(t);
  assert.deepEqual([...f.events.keys()], ["session_start", "session_tree", "session_shutdown", "context"]);
  assert.deepEqual(f.commands, []);
  assert.deepEqual(f.tools, []);
});

test("loads validated project Markdown frontmatter and exact reminder body", (t) => {
  const f = fixture(t);
  writeConfig(f.cwd, { minimum: 3, window: 45, reminder: "line one\nline two" });
  assert.deepEqual(loadGoalContinuationNudge(f.cwd), {
    minimumRapidContinuations: 3,
    windowMs: 45_000,
    reminder: "line one\nline two",
  });
});

test("missing or malformed project Markdown is a safe no-op", (t) => {
  const f = fixture(t);
  assert.equal(loadGoalContinuationNudge(f.cwd), null);
  const path = writeConfig(f.cwd);
  writeFileSync(path, "---\nminimum_rapid_continuations: 1\nwindow_seconds: 30\n---\nnope\n");
  assert.equal(loadGoalContinuationNudge(f.cwd), null);
  writeFileSync(path, "---\nminimum_rapid_continuations: 2\nwindow_seconds: 0\n---\nnope\n");
  assert.equal(loadGoalContinuationNudge(f.cwd), null);
  writeFileSync(path, "---\nminimum_rapid_continuations: 2\nwindow_seconds: 30\nextra: 1\n---\nnope\n");
  assert.equal(loadGoalContinuationNudge(f.cwd), null);
});

test("oversize and symlinked reminder files are safe no-ops", (t) => {
  const f = fixture(t);
  const path = writeConfig(f.cwd);
  writeFileSync(path, `---\nminimum_rapid_continuations: 2\nwindow_seconds: 30\n---\n\n${"x".repeat(17_000)}`);
  assert.equal(loadGoalContinuationNudge(f.cwd), null);

  const target = join(f.cwd, "outside-reminder.md");
  writeFileSync(target, "---\nminimum_rapid_continuations: 2\nwindow_seconds: 30\n---\n\noutside\n");
  unlinkSync(path);
  symlinkSync(target, path);
  assert.equal(loadGoalContinuationNudge(f.cwd), null);
});

test("nudges the second distinct rapid continuation and preserves source messages", async (t) => {
  const f = fixture(t);
  writeConfig(f.cwd, { reminder: "follow the project skill" });
  const first = goalContinuation("goal-a", 1);
  f.setTime(1_000);
  assert.equal(await f.events.get("context")({ messages: [first] }, f.ctx), undefined);

  const second = goalContinuation("goal-a", 2);
  const messages = [first, { role: "assistant", content: "waiting" }, second];
  f.setTime(2_000);
  const result = await f.events.get("context")({ messages }, f.ctx);

  assert.equal(outputText(result, messages), "native goal continuation\n\nfollow the project skill");
  assert.equal(second.content, "native goal continuation");
  assert.notEqual(result.messages, messages);
});

test("repeated provider calls do not increment the streak or duplicate the reminder", async (t) => {
  const f = fixture(t);
  writeConfig(f.cwd, { minimum: 3, reminder: "one nudge" });
  f.setTime(1_000);
  await f.events.get("context")({ messages: [goalContinuation("goal-a", 1)] }, f.ctx);
  f.setTime(2_000);
  const second = goalContinuation("goal-a", 2);
  assert.equal(await f.events.get("context")({ messages: [second] }, f.ctx), undefined);
  f.setTime(3_000);
  assert.equal(await f.events.get("context")({ messages: [second] }, f.ctx), undefined);

  f.setTime(4_000);
  const third = goalContinuation("goal-a", 3);
  const result = await f.events.get("context")({ messages: [third] }, f.ctx);
  assert.equal(outputText(result, [third]), "native goal continuation\n\none nudge");

  f.setTime(5_000);
  const repeated = await f.events.get("context")({ messages: [third] }, f.ctx);
  assert.equal(outputText(repeated, [third]), "native goal continuation\n\none nudge");
  assert.equal(outputText(repeated, [third]).split("one nudge").length - 1, 1);
});

test("an expired window, changed goal, or user turn resets the rapid streak", async (t) => {
  const f = fixture(t);
  writeConfig(f.cwd, { window: 10 });
  f.setTime(0);
  await f.events.get("context")({ messages: [goalContinuation("goal-a", 1)] }, f.ctx);
  f.setTime(11_000);
  assert.equal(await f.events.get("context")({ messages: [goalContinuation("goal-a", 2)] }, f.ctx), undefined);
  f.setTime(12_000);
  assert.equal(await f.events.get("context")({ messages: [goalContinuation("goal-b", 1)] }, f.ctx), undefined);

  await f.events.get("context")({ messages: [
    goalContinuation("goal-b", 1),
    { role: "user", content: "new direction" },
  ] }, f.ctx);
  f.setTime(13_000);
  assert.equal(await f.events.get("context")({ messages: [goalContinuation("goal-b", 2)] }, f.ctx), undefined);
});

test("session lifecycle clears observations", async (t) => {
  const f = fixture(t);
  writeConfig(f.cwd);
  f.setTime(1_000);
  await f.events.get("context")({ messages: [goalContinuation("goal-a", 1)] }, f.ctx);
  f.events.get("session_tree")({}, f.ctx);
  f.setTime(2_000);
  assert.equal(await f.events.get("context")({ messages: [goalContinuation("goal-a", 2)] }, f.ctx), undefined);
  f.events.get("session_start")({}, f.ctx);
  f.setTime(3_000);
  assert.equal(await f.events.get("context")({ messages: [goalContinuation("goal-a", 3)] }, f.ctx), undefined);
  f.events.get("session_shutdown")({}, f.ctx);
});

test("appends to text content without dropping image blocks", async (t) => {
  const f = fixture(t);
  writeConfig(f.cwd, { reminder: "image-safe reminder" });
  f.setTime(1_000);
  await f.events.get("context")({ messages: [goalContinuation("goal-a", 1)] }, f.ctx);
  const content = [
    { type: "text", text: "native goal continuation" },
    { type: "image", data: "abc", mimeType: "image/png" },
  ];
  const second = goalContinuation("goal-a", 2, content);
  f.setTime(2_000);
  const result = await f.events.get("context")({ messages: [second] }, f.ctx);
  assert.equal(result.messages[0].content[0].text, "native goal continuation\n\nimage-safe reminder");
  assert.deepEqual(result.messages[0].content[1], content[1]);
  assert.equal(content[0].text, "native goal continuation");
});
