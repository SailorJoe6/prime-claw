import assert from "node:assert/strict";
import test from "node:test";

import goalHeartbeatWorkControl from "../src/prime-agent-plugin/extensions/goal-heartbeat-work-control.ts";

function harness() {
  const events = new Map();
  const calls = { tools: 0, messages: 0, commands: 0 };
  const pi = {
    on(name, handler) { events.set(name, handler); },
    registerTool() { calls.tools += 1; },
    registerCommand() { calls.commands += 1; },
    sendUserMessage() { calls.messages += 1; },
  };
  goalHeartbeatWorkControl(pi);
  return { events, calls };
}

test("POC entry point is inert because APPEND_SYSTEM owns work-control policy", () => {
  const f = harness();
  assert.deepEqual([...f.events.keys()], []);
  assert.deepEqual(f.calls, { tools: 0, messages: 0, commands: 0 });
});

test("source contains no transient work-control prompt markers", () => {
  const source = String(goalHeartbeatWorkControl);
  assert.doesNotMatch(source, /before_agent_start/);
  assert.doesNotMatch(source, /PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL/);
});
