import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const managed = join(root, "src", "prime-agent-plugin");
const expected = [
  "extensions/handoff-chain.ts",
  "extensions/reviewed-plan.ts",
  "extension-support/conversation-oversight.ts",
  "extension-support/episode-close.ts",
  "extension-support/handoff-prompts.ts",
  "extension-support/reviewed-plan-support.ts",
  "extension-support/spec-episode.ts",
];

test("managed APPEND_SYSTEM owns the lean session and work-control protocol", () => {
  const source = readFileSync(join(managed, "APPEND_SYSTEM.md"), "utf8").trim().split(/\s+/).join(" ");
  for (const phrase of [
    "one reviewable vertical slice at a time",
    "Use the canonical handoff protocol",
    "maintain a goal so interrupted work resumes",
    "establish a heartbeat for that exact wait and complete the goal",
    "When waiting for the user, complete the goal and create no heartbeat",
    "When all work is complete, retain neither",
  ]) assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(source.split(" ").length <= 250);
});

test("managed plugin is the seven-file generation without retired transports", () => {
  for (const relative of expected) assert.equal(existsSync(join(managed, relative)), true, relative);
  assert.equal(existsSync(join(managed, "extensions/goal-heartbeat-work-control.ts")), false);
  assert.equal(existsSync(join(managed, "extensions/goal-blocker-control.ts")), false);
  const source = expected.map(relative => readFileSync(join(managed, relative), "utf8")).join("\n");
  assert.doesNotMatch(source, /pause_thread_goal|resume_thread_goal/);
  assert.doesNotMatch(source, /sendUserMessage\("\/goal (?:pause|resume)/);
  assert.doesNotMatch(source, /PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1/);
});
