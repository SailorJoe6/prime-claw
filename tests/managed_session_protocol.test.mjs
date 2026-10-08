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
  "extension-support/prep-chain.ts",
  "extension-support/reviewed-plan-support.ts",
  "extension-support/spec-episode.ts",
];

test("final protocol separates the neutral kernel from managed guidance", () => {
  const kernel = readFileSync(join(managed, "ROLE_KERNEL.md"), "utf8").trim().split(/\s+/).join(" ");
  const guide = readFileSync(join(managed, "skills/prime-claw-oversee-episode/SKILL.md"), "utf8").trim().split(/\s+/).join(" ");
  for (const phrase of ["CONVERSATION supervises", "EPISODE implements", "EXPERT reviews"])
    assert.match(kernel, new RegExp(phrase));
  for (const phrase of ["one reported vertical slice at a time", "canonical handoff", "bounded goal", "one exact heartbeat"])
    assert.match(guide, new RegExp(phrase));
  assert.equal(existsSync(join(managed, "APPEND_SYSTEM.md")), false);
});

test("managed plugin is the eight-file generation without retired transports", () => {
  for (const relative of expected) assert.equal(existsSync(join(managed, relative)), true, relative);
  assert.equal(existsSync(join(managed, "extensions/goal-heartbeat-work-control.ts")), false);
  assert.equal(existsSync(join(managed, "extensions/goal-blocker-control.ts")), false);
  const source = expected.map(relative => readFileSync(join(managed, relative), "utf8")).join("\n");
  assert.doesNotMatch(source, /pause_thread_goal|resume_thread_goal/);
  assert.doesNotMatch(source, /sendUserMessage\("\/goal (?:pause|resume)/);
  assert.doesNotMatch(source, /PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1/);
});
