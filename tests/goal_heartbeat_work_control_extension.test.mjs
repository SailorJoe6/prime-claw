import assert from "node:assert/strict";
import test from "node:test";

import goalHeartbeatWorkControl, {
  WORK_CONTROL_END,
  WORK_CONTROL_POLICY,
  WORK_CONTROL_SENTINEL,
  WORK_CONTROL_START,
} from "../src/prime-agent-plugin/extensions/goal-heartbeat-work-control.ts";

function harness() {
  const events = new Map();
  const calls = { tools: 0, messages: 0, commands: 0 };
  const pi = {
    on(name, handler) { events.set(name, handler); },
    registerTool() { calls.tools += 1; },
    registerCommand() { calls.commands += 1; },
    sendUserMessage() { calls.messages += 1; },
  };
  const notices = [];
  let aborts = 0;
  const ctx = {
    ui: { notify(message, level) { notices.push({ message, level }); } },
    abort() { aborts += 1; },
  };
  goalHeartbeatWorkControl(pi);
  const rawHandler = events.get("before_agent_start");
  return {
    handler(event) { return rawHandler(event, ctx); },
    events,
    calls,
    notices,
    get aborts() { return aborts; },
  };
}

function pythonSkill(name, importName, overrides = {}) {
  return {
    name,
    kind: "python",
    python: { importName },
    disableModelInvocation: false,
    ...overrides,
  };
}

function compatibleEvent(overrides = {}) {
  return {
    systemPrompt: "BASE_SYSTEM_PROMPT",
    prompt: "fixture user input",
    systemPromptOptions: {
      selectedTools: ["ipython", "read"],
      skills: [
        pythonSkill("goal", "goal"),
        pythonSkill("rlm-heartbeat", "rlm_heartbeat"),
      ],
    },
    ...overrides,
  };
}

function incompatibleOptions() {
  return [
    { selectedTools: ["read"], skills: compatibleEvent().systemPromptOptions.skills },
    { selectedTools: ["ipython"], skills: [pythonSkill("rlm-heartbeat", "rlm_heartbeat")] },
    { selectedTools: ["ipython"], skills: [pythonSkill("goal", "goal")] },
    { selectedTools: ["ipython"], skills: [
      pythonSkill("goal", "goal", { disableModelInvocation: true }),
      pythonSkill("rlm-heartbeat", "rlm_heartbeat"),
    ] },
    { selectedTools: ["ipython"], skills: [
      pythonSkill("goal", "wrong"),
      pythonSkill("rlm-heartbeat", "rlm_heartbeat"),
    ] },
  ];
}

function collisionShapes() {
  return [
    WORK_CONTROL_START,
    WORK_CONTROL_END,
    WORK_CONTROL_SENTINEL,
    `${WORK_CONTROL_START}
${WORK_CONTROL_END}`,
    `${WORK_CONTROL_POLICY}
${WORK_CONTROL_POLICY}`,
  ];
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

test("registers only one transient before_agent_start listener", () => {
  const f = harness();
  assert.equal(typeof f.handler, "function");
  assert.deepEqual([...f.events.keys()], ["before_agent_start"]);
  assert.deepEqual(f.calls, { tools: 0, messages: 0, commands: 0 });
});

test("compatible runs receive exactly one deterministic bounded policy", () => {
  const f = harness();
  const event = compatibleEvent();
  const first = f.handler(event);
  const second = f.handler(compatibleEvent());
  assert.deepEqual(first, second);
  assert.ok(first.systemPrompt.startsWith("BASE_SYSTEM_PROMPT\n\n"));
  assert.equal(count(first.systemPrompt, WORK_CONTROL_START), 1);
  assert.equal(count(first.systemPrompt, WORK_CONTROL_END), 1);
  assert.equal(count(first.systemPrompt, WORK_CONTROL_SENTINEL), 1);
  const policyBody = WORK_CONTROL_POLICY
    .replace(WORK_CONTROL_START, "")
    .replace(WORK_CONTROL_END, "")
    .replace(WORK_CONTROL_SENTINEL, "");
  assert.ok(Buffer.byteLength(policyBody, "utf8") <= 4000);
  assert.match(policyBody, /create one bounded active-work goal/);
  assert.match(policyBody, /create one bounded rlm_heartbeat/);
  assert.match(policyBody, /create a fresh bounded goal/);
  assert.match(policyBody, /Do not create a heartbeat merely to poll a person/);
  assert.match(policyBody, /Never inject, simulate, or call native \/goal pause or \/goal resume/);
});

test("the runtime default tool set is compatible when selectedTools is omitted", () => {
  const f = harness();
  const event = compatibleEvent();
  delete event.systemPromptOptions.selectedTools;
  assert.equal(count(f.handler(event).systemPrompt, WORK_CONTROL_SENTINEL), 1);
});

test("each missing or unusable capability is a silent no-op", () => {
  for (const systemPromptOptions of incompatibleOptions()) {
    const f = harness();
    assert.equal(f.handler(compatibleEvent({ systemPromptOptions })), undefined);
    assert.deepEqual(f.calls, { tools: 0, messages: 0, commands: 0 });
    assert.deepEqual(f.notices, []);
    assert.equal(f.aborts, 0);
  }
});

test("incompatible runs ignore every marker and sentinel collision shape", () => {
  for (const systemPromptOptions of incompatibleOptions()) {
    for (const collision of collisionShapes()) {
      const f = harness();
      const event = compatibleEvent({
        systemPrompt: `BASE
${collision}`,
        systemPromptOptions,
      });
      const before = structuredClone(event);
      assert.equal(f.handler(event), undefined);
      assert.deepEqual(event, before);
      assert.deepEqual(f.calls, { tools: 0, messages: 0, commands: 0 });
      assert.deepEqual(f.notices, []);
      assert.equal(f.aborts, 0);
    }
  }
});

test("contribution is transient and does not mutate event or send durable state", () => {
  const f = harness();
  const event = compatibleEvent();
  const before = structuredClone(event);
  const result = f.handler(event);
  assert.deepEqual(event, before);
  assert.equal(count(result.systemPrompt, WORK_CONTROL_SENTINEL), 1);
  assert.equal(event.systemPrompt.includes(WORK_CONTROL_SENTINEL), false);
  assert.deepEqual(f.calls, { tools: 0, messages: 0, commands: 0 });
});

test("project append content cannot suppress the later transient contribution", () => {
  const f = harness();
  const projectAppend = "PROJECT_LOCAL_APPEND_CONTENT";
  const result = f.handler(compatibleEvent({ systemPrompt: `BASE
${projectAppend}` }));
  assert.equal(count(result.systemPrompt, projectAppend), 1);
  assert.equal(count(result.systemPrompt, WORK_CONTROL_SENTINEL), 1);
  assert.ok(result.systemPrompt.indexOf(projectAppend) < result.systemPrompt.indexOf(WORK_CONTROL_SENTINEL));
});

test("any pre-existing marker or sentinel collision fails closed for compatible runs", () => {
  for (const collision of collisionShapes()) {
    const f = harness();
    assert.throws(
      () => f.handler(compatibleEvent({ systemPrompt: `BASE
${collision}` })),
      /existing policy marker or sentinel collision/,
    );
    assert.equal(f.aborts, 1);
    assert.equal(f.notices.length, 1);
    assert.equal(f.notices[0].level, "error");
  }
});
