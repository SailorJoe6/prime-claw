import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const managed = join(root, "src", "prime-agent-plugin");
const inventory = JSON.parse(readFileSync(join(managed, "asset-inventory.json"), "utf8"));
const expected = inventory.assets.flatMap(asset => asset.targets
  .filter(target => ["plugin-root-exact", "plugin-root-managed"].includes(target.class))
  .map(target => target.destination));

test("final protocol separates the neutral kernel from managed guidance", () => {
  const kernel = readFileSync(join(managed, "ROLE_KERNEL.md"), "utf8").trim().split(/\s+/).join(" ");
  const guide = readFileSync(join(managed, "skills/prime-claw-oversee-episode/SKILL.md"), "utf8").trim().split(/\s+/).join(" ");
  for (const phrase of ["Roles are skill-based responsibilities", "CONVERSATION supervises", "EPISODE implements", "EXPERT reviews"])
    assert.match(kernel, new RegExp(phrase));
  for (const phrase of ["one reported vertical slice at a time", "canonical handoff", "bounded goal", "one exact heartbeat"])
    assert.match(guide, new RegExp(phrase));
  assert.equal(existsSync(join(managed, "APPEND_SYSTEM.md")), false);
});

test("managed plugin protocol surface includes its continuation policy without retired transports", () => {
  for (const relative of expected) assert.equal(existsSync(join(managed, relative)), true, relative);
  assert.equal(existsSync(join(managed, "extensions/goal-heartbeat-work-control.ts")), false);
  assert.equal(existsSync(join(managed, "extensions/goal-blocker-control.ts")), false);
  const source = expected.map(relative => readFileSync(join(managed, relative), "utf8")).join("\n");
  assert.doesNotMatch(source, /pause_thread_goal|resume_thread_goal/);
  assert.doesNotMatch(source, /sendUserMessage\("\/goal (?:pause|resume)/);
  assert.doesNotMatch(source, /PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1/);
});
