import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import reviewedPlan, { createReviewedPlanExtension } from "../src/prime-agent-plugin/extensions/reviewed-plan.ts";
import {
  CONVERSATION_GUIDE_ACTIVATION_TOOL,
  CONVERSATION_GUIDE_STATUS_TOOL,
  EXPECTED_IDENTITY_KERNEL_BLOCK,
} from "../src/prime-agent-plugin/extension-support/conversation-oversight.ts";
import {
  EXPERT_REVIEW_BIND_TOOL,
  EXPERT_REVIEW_CANCEL_TOOL,
  EXPERT_REVIEW_PACKET_KIND,
  EXPERT_REVIEW_RESERVATION_TTL_MS,
  EXPERT_REVIEW_RESERVE_TOOL,
  EXPERT_REVIEW_STATE_SCHEMA,
  EXPERT_REVIEW_STATUS_TOOL,
  OFFICIAL_EXPERT_SELECTOR,
  OFFICIAL_EXPERT_THINKING,
  registerOfficialExpertReviewReservation,
} from "../src/prime-agent-plugin/extension-support/expert-review-reservation.ts";
import {
  PRIME_CLAW_ROLE_KERNEL_SHA256,
  PRIME_CLAW_ROLE_KERNEL_TEXT,
} from "../src/prime-agent-plugin/extension-support/role-kernel.generated.ts";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const LOCATION = ".ralph/plans/future/alpha-plan";
const USAGE = "Usage: /plan .ralph/plans/future/<slug>";

test("every shipped extension entry point exports a factory", async () => {
  const extensions = join(REPO_ROOT, "src", "prime-agent-plugin", "extensions");
  const files = readdirSync(extensions)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".js"))
    .sort();

  assert.ok(files.length > 0, "expected at least one shipped extension");
  for (const file of files) {
    const module = await import(pathToFileURL(join(extensions, file)).href);
    assert.equal(
      typeof module.default,
      "function",
      `${file} must default-export an extension factory`,
    );
  }
});

function createHarness(cwd, extension = reviewedPlan, throwOnSend = 0, systemPrompt = EXPECTED_IDENTITY_KERNEL_BLOCK) {
  const commands = new Map();
  const tools = new Map();
  const events = new Map();
  const messages = [];
  const deliveries = [];
  const notices = [];
  const confirmations = [];
  const entries = [];
  let sendCount = 0;
  const pi = {
    registerCommand(name, definition) {
      commands.set(name, definition);
    },
    registerTool(definition) {
      tools.set(definition.name, definition);
    },
    on(name, handler) {
      const earlier = events.get(name);
      events.set(name, earlier ? async (...args) => {
        const previous = await earlier(...args);
        if (name === "context" && previous?.messages) args[0] = { ...args[0], messages: previous.messages };
        return (await handler(...args)) ?? previous;
      } : handler);
    },
    appendEntry(customType, data) { entries.push({ type: "custom", customType, data }); },
    sendUserMessage(message, options) {
      sendCount += 1;
      if (sendCount === throwOnSend) throw new Error("synthetic send failure");
      messages.push(message);
      deliveries.push({ message, options });
    },
  };
  const ctx = {
    cwd,
    sessionManager: {
      getSessionId() { return "owner-session"; },
      getSessionFile() { return join(cwd, "owner-session.jsonl"); },
      getHeader() { return { rlmDepth: 0 }; },
      getBranch() { return entries; },
    },
    getSystemPrompt() { return systemPrompt; },
    abort() {},
    ui: {
      notify(message, level) {
        notices.push({ message, level });
      },
      async confirm(title, message) { confirmations.push({ title, message }); return true; },
    },
  };
  extension(pi);
  return { commands, tools, events, ctx, messages, deliveries, notices, confirmations, entries };
}

function fixture(t, {
  skill = "canonical plan body",
  prepSkill = "canonical plan-prep body",
  implementPrepSkill = "canonical implement-prep body",
  folder = true,
  throwOnSend = 0,
  extension = reviewedPlan,
} = {}) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-reviewed-plan-")));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, ".ralph", "plans", "future"), { recursive: true });
  if (folder) mkdirSync(join(cwd, LOCATION), { recursive: true });
  if (prepSkill !== null) writeSkill(cwd, prepSkill, "plan-prep");
  if (implementPrepSkill !== null) writeSkill(cwd, implementPrepSkill, "implement-prep");
  if (skill !== null) writeSkill(cwd, skill);
  mkdirSync(join(cwd, ".prime", "agent", "state", "spec-episodes"), { recursive: true });
  return { cwd, ...createHarness(cwd, extension, throwOnSend) };
}

function writeSkill(cwd, body, name = "plan") {
  const path = join(cwd, ".ralph", "skills", name, "SKILL.md");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  return path;
}

function expectedPrompt(cwd, body, location = LOCATION) {
  const path = join(cwd, ".ralph", "skills", "plan", "SKILL.md");
  return `<skill name="plan" location="${path}">
References are relative to ${dirname(path)}.

${body}
</skill>

<operator-plan-location>
${location}
</operator-plan-location>`;
}

function expectedPrepPrompt(cwd, body, location = LOCATION) {
  const path = join(cwd, ".ralph", "skills", "plan-prep", "SKILL.md");
  return `<skill name="plan-prep" location="${path}">
References are relative to ${dirname(path)}.

${body}
</skill>

<operator-plan-location>
${location}
</operator-plan-location>`;
}

function expectedImplementPrompt(cwd, body, location = LOCATION) {
  const path = join(cwd, ".ralph", "skills", "implement-spec", "SKILL.md");
  return `<skill name="implement-spec" location="${path}">
References are relative to ${dirname(path)}.

${body}
</skill>

<operator-implementation-location>
${location}
</operator-implementation-location>`;
}

function expectedImplementPrepPrompt(cwd, body, location = LOCATION) {
  const path = join(cwd, ".ralph", "skills", "implement-prep", "SKILL.md");
  return `<skill name="implement-prep" location="${path}">
References are relative to ${dirname(path)}.

${body}
</skill>

<operator-implementation-location>
${location}
</operator-implementation-location>`;
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

async function activateConversationGuide(f, toolCallId = "guide-call") {
  const activation = f.tools.get(CONVERSATION_GUIDE_ACTIVATION_TOOL);
  const issued = await activation.execute(toolCallId, {}, undefined, undefined, f.ctx);
  assert.equal(issued.isError, undefined, JSON.stringify(issued));
  const messages = [
    {
      role: "assistant",
      content: [{ type: "toolCall", id: toolCallId, name: CONVERSATION_GUIDE_ACTIVATION_TOOL, arguments: {} }],
    },
    {
      role: "toolResult",
      toolCallId,
      toolName: CONVERSATION_GUIDE_ACTIVATION_TOOL,
      content: issued.content,
      details: issued.details,
      isError: false,
      timestamp: Date.now(),
    },
  ];
  const first = await f.events.get("context")({ messages }, f.ctx);
  assert.equal(first.messages.filter((message) => message.role === "toolResult")[0].content[0].text, issued.content[0].text);
  const status = await f.tools.get(CONVERSATION_GUIDE_STATUS_TOOL).execute("status", {}, undefined, undefined, f.ctx);
  assert.equal(status.details.ready, true, JSON.stringify(status));
  return { issued, messages, first, status };
}

test("registers native reviewed commands, planning tool, and native-only implementation", (t) => {
  const f = fixture(t);
  assert.deepEqual([...f.commands.keys()], ["plan", "implement-spec"]);
  assert.deepEqual([...f.tools.keys()], [
    CONVERSATION_GUIDE_ACTIVATION_TOOL,
    CONVERSATION_GUIDE_STATUS_TOOL,
    "ralph_plan", "create_spec_episode", "finalize_spec_episode", "handoff_spec_episode",
  ]);
  assert.equal(f.tools.has("ralph_implement_spec"), false);
  for (const retired of [EXPERT_REVIEW_RESERVE_TOOL, EXPERT_REVIEW_BIND_TOOL, EXPERT_REVIEW_STATUS_TOOL, EXPERT_REVIEW_CANCEL_TOOL]) {
    assert.equal(f.tools.has(retired), false, `${retired} must remain retired`);
  }
  assert.deepEqual([...f.events.keys()], ["session_start", "session_shutdown", "context", "before_agent_start", "agent_end"]);
  assert.match(f.commands.get("plan").description, /explicit .*future/);
  const planTool = f.tools.get("ralph_plan");
  assert.equal(planTool.executionMode, "sequential");
  assert.deepEqual(Object.keys(planTool.parameters.properties), ["location"]);
  assert.deepEqual(planTool.parameters.required, ["location"]);
  assert.equal(planTool.parameters.additionalProperties, false);
  assert.ok(planTool.promptGuidelines.every((guideline) => guideline.includes("ralph_plan")));
  assert.deepEqual(f.tools.get("create_spec_episode").parameters.required, ["location"]);
  assert.equal(f.tools.get("create_spec_episode").parameters.additionalProperties, false);
  const finalizeTool = f.tools.get("finalize_spec_episode");
  assert.deepEqual(Object.keys(finalizeTool.parameters.properties), ["location"]);
  assert.deepEqual(finalizeTool.parameters.required, ["location"]);
  assert.match(finalizeTool.description, /after the owning conversation verifies terminal work/);
  assert.doesNotMatch(finalizeTool.promptGuidelines.join(" "), /authorize|receipt|confirm/i);
  assert.equal(finalizeTool.parameters.additionalProperties, false);
  const handoffTool = f.tools.get("handoff_spec_episode");
  assert.equal(handoffTool.executionMode, "sequential");
  assert.deepEqual(Object.keys(handoffTool.parameters.properties), ["location", "guidance"]);
  assert.deepEqual(handoffTool.parameters.required, ["location"]);
  assert.equal(handoffTool.parameters.additionalProperties, false);
  assert.match(handoffTool.description, /owner accepts an in-scope advance or recorded revision/);
  assert.deepEqual(handoffTool.promptGuidelines, [
    "Call handoff_spec_episode only when this exact owner has selected advance after candidate acceptance or revise from accepted findings already recorded inside the approved scope; no new operator transport request is required.",
    "Pass handoff_spec_episode the exact retained future-folder location used to create that episode; never search for or infer another episode.",
    "Pass only optional operator focus or a bounded compaction-focus synthesis of the accepted recorded in-scope findings; never route arbitrary chat, unaccepted findings, product decisions, or scope expansion.",
    "Never call handoff_spec_episode for consult, pause, merge, abandonment, cleanup, or another episode; those boundaries retain their existing operator authority.",
    "Treat handoff_spec_episode as a terminal routing action. Admission does not prove compaction completed; observe the episode before claiming continuation results, and never retry an uncertain result.",
  ]);
  assert.match(handoffTool.parameters.properties.guidance.description, /operator-supplied guidance or the exact owner's bounded synthesis of accepted recorded findings inside the approved scope/);
  assert.doesNotMatch(handoffTool.description + handoffTool.promptGuidelines.join(" "), /only when the operator clearly asks|only operator-supplied/);
});

test("native planning admits plan-prep first and canonical plan as the sole follow-up", async (t) => {
  const f = fixture(t, { skill: "old body", prepSkill: "old prep body" });
  writeSkill(f.cwd, "current project-customized plan body");
  writeSkill(f.cwd, "current project-customized plan-prep body", "plan-prep");

  await f.commands.get("plan").handler(LOCATION, f.ctx);

  const prep = expectedPrepPrompt(f.cwd, "current project-customized plan-prep body");
  const plan = expectedPrompt(f.cwd, "current project-customized plan body");
  assert.deepEqual(f.messages, [prep, plan]);
  assert.deepEqual(f.deliveries, [
    { message: prep, options: undefined },
    { message: plan, options: { deliverAs: "followUp" } },
  ]);
  assert.equal(f.deliveries.filter(({ options }) => options?.deliverAs === "followUp").length, 1);
  for (const prompt of f.messages) {
    assert.equal(count(prompt, "<operator-plan-location>"), 1);
    assert.equal(count(prompt, LOCATION), 1);
  }
  assert.deepEqual(f.notices, []);
});

test("conversational planning steers plan-prep and queues canonical plan as the sole follow-up", async (t) => {
  const f = fixture(t, { skill: "old body", prepSkill: "old prep body" });
  writeSkill(f.cwd, "current project-customized plan body");
  writeSkill(f.cwd, "current project-customized plan-prep body", "plan-prep");

  const result = await f.tools.get("ralph_plan").execute(
    "plan-call-1",
    { location: `  ${LOCATION}  ` },
    undefined,
    undefined,
    f.ctx,
  );

  const prep = expectedPrepPrompt(f.cwd, "current project-customized plan-prep body");
  const plan = expectedPrompt(f.cwd, "current project-customized plan body");
  assert.deepEqual(f.messages, [prep, plan]);
  assert.deepEqual(f.deliveries, [
    { message: prep, options: { deliverAs: "steer" } },
    { message: plan, options: { deliverAs: "followUp" } },
  ]);
  assert.equal(f.deliveries.filter(({ options }) => options?.deliverAs === "followUp").length, 1);
  for (const prompt of f.messages) {
    assert.equal(count(prompt, "<operator-plan-location>"), 1);
    assert.equal(count(prompt, LOCATION), 1);
  }
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.details, { admitted: true, location: LOCATION });
  assert.match(result.content[0].text, /Planning admitted/);
  assert.match(result.content[0].text, /plan-prep was steered/);
  assert.match(result.content[0].text, /sole follow-up/);
  assert.match(result.content[0].text, /has not completed/);
  assert.match(result.content[0].text, /implementation is not authorized/);
  assert.doesNotMatch(result.content[0].text, /compaction (?:completed|confirmed)/i);
  assert.deepEqual(f.notices, []);

  const unauthorized = await f.tools.get("create_spec_episode").execute(
    "episode-after-valid-plan",
    { location: LOCATION },
    undefined,
    undefined,
    f.ctx,
  );
  assert.equal(unauthorized.isError, true);
  assert.match(unauthorized.content[0].text, /no matching active \/implement-spec approval/);
});

test("conversational planning rejects invalid exact locations without side effects", async (t) => {
  const f = fixture(t);
  const tool = f.tools.get("ralph_plan");
  const invalidLocations = [
    "",
    join(f.cwd, LOCATION),
    ".ralph/plans/future/../future/alpha-plan",
    `${LOCATION} another`,
    ".ralph/plans/future/alpha plan",
  ];

  for (const [index, location] of invalidLocations.entries()) {
    const result = await tool.execute(
      `invalid-${index}`, { location }, undefined, undefined, f.ctx,
    );
    assert.equal(result.isError, true);
    assert.equal(result.content[0].text, USAGE);
  }

  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.deliveries, []);
  const unauthorized = await f.tools.get("create_spec_episode").execute(
    "episode-after-invalid-plan",
    { location: LOCATION },
    undefined,
    undefined,
    f.ctx,
  );
  assert.equal(unauthorized.isError, true);
  assert.match(unauthorized.content[0].text, /no matching active \/implement-spec approval/);
});

test("conversational planning rejects a missing folder", async (t) => {
  const f = fixture(t, { folder: false });

  const result = await f.tools.get("ralph_plan").execute(
    "missing-folder", { location: LOCATION }, undefined, undefined, f.ctx,
  );

  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, USAGE);
  assert.deepEqual(f.messages, []);
});

test("conversational planning rejects a resolved symlink escape", async (t) => {
  const f = fixture(t, { folder: false });
  const outside = mkdtempSync(join(tmpdir(), "prime-claw-plan-tool-outside-"));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  symlinkSync(outside, join(f.cwd, LOCATION), "dir");

  const result = await f.tools.get("ralph_plan").execute(
    "symlink-escape", { location: LOCATION }, undefined, undefined, f.ctx,
  );

  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, USAGE);
  assert.deepEqual(f.messages, []);
});

test("conversational planning reports missing plan-prep before any send", async (t) => {
  const f = fixture(t, { prepSkill: null });

  const result = await f.tools.get("ralph_plan").execute(
    "missing-prep", { location: LOCATION }, undefined, undefined, f.ctx,
  );

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /\.ralph\/skills\/plan-prep\/SKILL\.md not found/);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.deliveries, []);
});

test("conversational planning reports missing canonical skill", async (t) => {
  const f = fixture(t, { skill: null });

  const result = await f.tools.get("ralph_plan").execute(
    "missing-skill", { location: LOCATION }, undefined, undefined, f.ctx,
  );

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /\.ralph\/skills\/plan\/SKILL\.md not found/);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.deliveries, []);
});

test("conversational planning reports plan-prep admission failure", async (t) => {
  const f = fixture(t, { throwOnSend: 1 });

  const result = await f.tools.get("ralph_plan").execute(
    "prep-send-failure", { location: LOCATION }, undefined, undefined, f.ctx,
  );

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /canonical plan-prep could not be admitted/);
  assert.deepEqual(result.details, {
    admitted: false,
    error: "reviewed-plan: canonical plan-prep could not be admitted",
  });
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.deliveries, []);
});

test("conversational planning reports plan follow-up failure without claiming admission", async (t) => {
  const f = fixture(t, { throwOnSend: 2 });

  const result = await f.tools.get("ralph_plan").execute(
    "plan-send-failure", { location: LOCATION }, undefined, undefined, f.ctx,
  );

  const prep = expectedPrepPrompt(f.cwd, "canonical plan-prep body");
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /canonical plan follow-up could not be queued/);
  assert.match(result.content[0].text, /transition is incomplete/);
  assert.doesNotMatch(result.content[0].text, /Planning admitted/);
  assert.deepEqual(result.details, {
    admitted: false,
    error: "reviewed-plan: canonical plan follow-up could not be queued; transition is incomplete",
  });
  assert.deepEqual(f.messages, [prep]);
  assert.deepEqual(f.deliveries, [{ message: prep, options: { deliverAs: "steer" } }]);
});

test("missing argument shows usage without model injection", async (t) => {
  const f = fixture(t);
  await f.commands.get("plan").handler("", f.ctx);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{ message: USAGE, level: "warning" }]);
});

test("absolute path shows usage without model injection", async (t) => {
  const f = fixture(t);
  await f.commands.get("plan").handler(join(f.cwd, LOCATION), f.ctx);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{ message: USAGE, level: "warning" }]);
});

test("traversal shows usage without model injection", async (t) => {
  const f = fixture(t);
  await f.commands.get("plan").handler(
    ".ralph/plans/future/../future/alpha-plan",
    f.ctx,
  );
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{ message: USAGE, level: "warning" }]);
});

test("resolved symlink escape shows usage without model injection", async (t) => {
  const f = fixture(t, { folder: false });
  const outside = mkdtempSync(join(tmpdir(), "prime-claw-plan-outside-"));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  symlinkSync(outside, join(f.cwd, LOCATION), "dir");

  await f.commands.get("plan").handler(LOCATION, f.ctx);

  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{ message: USAGE, level: "warning" }]);
});

test("nonexistent folder shows usage without model injection", async (t) => {
  const f = fixture(t, { folder: false });
  await f.commands.get("plan").handler(LOCATION, f.ctx);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{ message: USAGE, level: "warning" }]);
});

test("missing plan-prep warns before native planning sends anything", async (t) => {
  const f = fixture(t, { prepSkill: null });
  await f.commands.get("plan").handler(LOCATION, f.ctx);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.deliveries, []);
  assert.deepEqual(f.notices, [{
    message: "reviewed-plan: .ralph/skills/plan-prep/SKILL.md not found",
    level: "warning",
  }]);
});

test("missing canonical skill warns without model injection", async (t) => {
  const f = fixture(t, { skill: null });
  await f.commands.get("plan").handler(LOCATION, f.ctx);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.deliveries, []);
  assert.deepEqual(f.notices, [{
    message: "reviewed-plan: .ralph/skills/plan/SKILL.md not found",
    level: "warning",
  }]);
});

test("native planning reports plan-prep admission failure", async (t) => {
  const f = fixture(t, { throwOnSend: 1 });
  await f.commands.get("plan").handler(LOCATION, f.ctx);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.deliveries, []);
  assert.deepEqual(f.notices, [{
    message: "reviewed-plan: canonical plan-prep could not be admitted",
    level: "error",
  }]);
});

test("native planning reports plan follow-up failure after prep admission", async (t) => {
  const f = fixture(t, { throwOnSend: 2 });
  await f.commands.get("plan").handler(LOCATION, f.ctx);
  const prep = expectedPrepPrompt(f.cwd, "canonical plan-prep body");
  assert.deepEqual(f.messages, [prep]);
  assert.deepEqual(f.deliveries, [{ message: prep, options: undefined }]);
  assert.deepEqual(f.notices, [{
    message: "reviewed-plan: canonical plan follow-up could not be queued; transition is incomplete",
    level: "error",
  }]);
});

test("multiple arguments show usage without model injection", async (t) => {
  const f = fixture(t);
  await f.commands.get("plan").handler(`${LOCATION} another`, f.ctx);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{ message: USAGE, level: "warning" }]);
});


test("implement-spec admits implement-prep first and canonical readiness as the sole follow-up", async (t) => {
  const f = fixture(t);
  const body = "project readiness policy";
  writeSkill(f.cwd, body, "implement-spec");
  writeSkill(f.cwd, "project implementation prep", "implement-prep");

  await f.commands.get("implement-spec").handler(LOCATION, f.ctx);

  const prep = expectedImplementPrepPrompt(f.cwd, "project implementation prep");
  const implement = expectedImplementPrompt(f.cwd, body);
  assert.deepEqual(f.messages, [prep, implement]);
  assert.deepEqual(f.deliveries, [
    { message: prep, options: undefined },
    { message: implement, options: { deliverAs: "followUp" } },
  ]);
  assert.equal(f.deliveries.filter(({ options }) => options?.deliverAs === "followUp").length, 1);
  for (const prompt of f.messages) {
    assert.equal(count(prompt, "<operator-implementation-location>"), 1);
    assert.equal(count(prompt, LOCATION), 1);
  }
  assert.deepEqual(f.notices, []);
});

test("implement-spec refuses shadowed or legacy role prompt shapes before model injection", async (t) => {
  const f = fixture(t);
  writeSkill(f.cwd, "implementation policy", "implement-spec");
  const prompts = [
    "project append shadow",
    `${PRIME_CLAW_ROLE_KERNEL_TEXT}
<!-- prime-claw:conversation-identity:start -->
PRIME_CLAW_CONVERSATION_IDENTITY_V1
<!-- prime-claw:conversation-identity:end -->`,
  ];
  for (const prompt of prompts) {
    const shadowed = createHarness(f.cwd, reviewedPlan, 0, prompt);
    await assert.rejects(
      shadowed.commands.get("implement-spec").handler(LOCATION, shadowed.ctx),
      /expected exactly one exact managed role kernel/,
    );
    assert.deepEqual(shadowed.messages, []);
  }
});

test("bounded EPISODE rejects a legacy role prompt before provider context", async (t) => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-episode-legacy-prompt-")));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const prompt = `${PRIME_CLAW_ROLE_KERNEL_TEXT}
<!-- prime-claw:conversation-identity:start -->
PRIME_CLAW_CONVERSATION_IDENTITY_V1
<!-- prime-claw:conversation-identity:end -->`;
  const f = createHarness(cwd, reviewedPlan, 0, prompt);
  f.entries.push({
    type: "custom", customType: "prime-claw-bounded-identity",
    data: { version: 1, role: "EPISODE", sessionId: "owner-session" },
  });
  await assert.rejects(
    () => f.events.get("context")({ messages: [] }, f.ctx),
    /expected exactly one exact managed role kernel/,
  );
});

test("invalid implement-spec input shows usage without model injection", async (t) => {
  const f = fixture(t);
  writeSkill(f.cwd, "implementation policy", "implement-spec");

  await f.commands.get("implement-spec").handler("../alpha-plan", f.ctx);

  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{
    message: "Usage: /implement-spec .ralph/plans/future/<slug>",
    level: "warning",
  }]);
});


test("implement-spec fails closed on either missing skill without arming approval", async (t) => {
  for (const missing of ["implement-prep", "implement-spec"]) {
    let createCalls = 0;
    const extension = createReviewedPlanExtension({
      async createEpisode() { createCalls += 1; throw new Error("must stay unauthorized"); },
    });
    const f = fixture(t, {
      implementPrepSkill: missing === "implement-prep" ? null : "implementation prep",
      extension,
    });
    if (missing !== "implement-spec") {
      writeSkill(f.cwd, "implementation readiness", "implement-spec");
    }

    await f.commands.get("implement-spec").handler(LOCATION, f.ctx);

    assert.deepEqual(f.messages, []);
    assert.deepEqual(f.deliveries, []);
    assert.deepEqual(f.notices, [{
      message: `reviewed-plan: .ralph/skills/${missing}/SKILL.md not found`,
      level: "warning",
    }]);
    const denied = await f.tools.get("create_spec_episode").execute(
      `missing-${missing}`, { location: LOCATION }, undefined, undefined, f.ctx,
    );
    assert.equal(denied.isError, true);
    assert.match(denied.content[0].text, /no matching active \/implement-spec approval/);
    assert.equal(createCalls, 0);
  }
});

test("implement-spec transport failures never arm approval", async (t) => {
  for (const throwOnSend of [1, 2]) {
    let createCalls = 0;
    const extension = createReviewedPlanExtension({
      async createEpisode() { createCalls += 1; throw new Error("must stay unauthorized"); },
    });
    const f = fixture(t, { throwOnSend, extension });
    writeSkill(f.cwd, "implementation readiness", "implement-spec");

    await f.commands.get("implement-spec").handler(LOCATION, f.ctx);

    const prep = expectedImplementPrepPrompt(f.cwd, "canonical implement-prep body");
    assert.deepEqual(f.messages, throwOnSend === 1 ? [] : [prep]);
    assert.deepEqual(f.notices, [{
      message: throwOnSend === 1
        ? "reviewed-plan: canonical implement-prep could not be admitted"
        : "reviewed-plan: canonical implement-spec follow-up could not be queued; transition is incomplete",
      level: "error",
    }]);
    await f.events.get("agent_end")({}, f.ctx);
    const denied = await f.tools.get("create_spec_episode").execute(
      `send-failure-${throwOnSend}`, { location: LOCATION }, undefined, undefined, f.ctx,
    );
    assert.equal(denied.isError, true);
    assert.match(denied.content[0].text, /no matching active \/implement-spec approval/);
    assert.equal(createCalls, 0);
  }
});

test("implement approval survives one prep agent_end, stays exact, and is consumed on use", async (t) => {
  let createCalls = 0;
  const extension = createReviewedPlanExtension({
    async createEpisode() {
      createCalls += 1;
      throw new Error("authorized episode capability reached");
    },
  });
  const f = fixture(t, { extension });
  writeSkill(f.cwd, "implementation readiness", "implement-spec");
  const betaLocation = ".ralph/plans/future/beta-plan";
  mkdirSync(join(f.cwd, betaLocation), { recursive: true });

  await f.commands.get("implement-spec").handler(LOCATION, f.ctx);
  const tooEarly = await f.tools.get("create_spec_episode").execute(
    "before-prep-end", { location: LOCATION }, undefined, undefined, f.ctx,
  );
  assert.equal(tooEarly.isError, true);
  assert.match(tooEarly.content[0].text, /no matching active \/implement-spec approval/);
  assert.equal(createCalls, 0);

  await f.events.get("agent_end")({}, f.ctx);

  const wrong = await f.tools.get("create_spec_episode").execute(
    "wrong-location", { location: betaLocation }, undefined, undefined, f.ctx,
  );
  assert.equal(wrong.isError, true);
  assert.match(wrong.content[0].text, /no matching active \/implement-spec approval/);
  assert.equal(createCalls, 0);

  const missingGuide = await f.tools.get("create_spec_episode").execute(
    "missing-guide", { location: LOCATION }, undefined, undefined, f.ctx,
  );
  assert.equal(missingGuide.isError, true);
  assert.match(missingGuide.content[0].text, /guide has not been activated and consumed/);
  assert.equal(createCalls, 0);

  const prospective = await activateConversationGuide(f, "prospective-guide");
  assert.deepEqual(Object.keys(prospective.issued.details).sort(), ["sha256", "version"]);
  assert.doesNotMatch(JSON.stringify(prospective.issued), /alpha-plan|preparation|lifecycle/i);

  const authorized = await f.tools.get("create_spec_episode").execute(
    "authorized", { location: LOCATION }, undefined, undefined, f.ctx,
  );
  assert.equal(authorized.isError, true);
  assert.match(authorized.content[0].text, /authorized episode capability reached/);
  assert.equal(createCalls, 1);

  const replay = await f.tools.get("create_spec_episode").execute(
    "consumed-replay", { location: LOCATION }, undefined, undefined, f.ctx,
  );
  assert.equal(replay.isError, true);
  assert.match(replay.content[0].text, /no matching active \/implement-spec approval/);
  assert.equal(createCalls, 1);
});

test("prospective guide activation rejects ordinary no-context, early, child, and EPISODE callers", async (t) => {
  let createCalls = 0;
  const extension = createReviewedPlanExtension({
    async createEpisode() { createCalls += 1; throw new Error("must stay unauthorized"); },
  });
  const f = fixture(t, { extension });
  writeSkill(f.cwd, "implementation readiness", "implement-spec");
  const activation = f.tools.get(CONVERSATION_GUIDE_ACTIVATION_TOOL);

  await assert.rejects(
    () => activation.execute("ordinary-no-context", {}, undefined, undefined, f.ctx),
    /active owner episode or current \/implement-spec preparation/,
  );

  await f.commands.get("implement-spec").handler(LOCATION, f.ctx);
  await assert.rejects(
    () => activation.execute("prep-too-early", {}, undefined, undefined, f.ctx),
    /active owner episode or current \/implement-spec preparation/,
  );
  await f.events.get("agent_end")({}, f.ctx);

  const topLevelHeader = f.ctx.sessionManager.getHeader;
  f.ctx.sessionManager.getHeader = () => ({ rlmDepth: 1 });
  await assert.rejects(
    () => activation.execute("generic-child", {}, undefined, undefined, f.ctx),
    /top-level project conversation/,
  );
  f.ctx.sessionManager.getHeader = topLevelHeader;

  f.entries.push({
    type: "custom", customType: "prime-claw-bounded-identity",
    data: { version: 1, role: "EPISODE", sessionId: "owner-session" },
  });
  await assert.rejects(
    () => activation.execute("episode-role", {}, undefined, undefined, f.ctx),
    /EPISODE cannot activate Conversation guidance/,
  );
  f.entries.pop();

  const denied = await f.tools.get("create_spec_episode").execute(
    "never-ready", { location: LOCATION }, undefined, undefined, f.ctx,
  );
  assert.equal(denied.isError, true);
  assert.match(denied.content[0].text, /guide (?:has not been activated and consumed|receipt is stale or mismatched)/);
  assert.equal(createCalls, 0);
  assert.equal(f.entries.filter((entry) => entry.customType === "prime-claw-conversation-oversight").length, 0);
});

test("prospective receipt is exact to location and preparation lifecycle and aborts stale disclosure", async (t) => {
  let createCalls = 0;
  const extension = createReviewedPlanExtension({
    async createEpisode(location) {
      createCalls += 1;
      throw new Error(`prospective create reached for ${location}`);
    },
  });
  const f = fixture(t, { extension });
  writeSkill(f.cwd, "implementation readiness", "implement-spec");
  const betaLocation = ".ralph/plans/future/beta-plan";
  mkdirSync(join(f.cwd, betaLocation), { recursive: true });

  await f.commands.get("implement-spec").handler(LOCATION, f.ctx);
  await f.events.get("agent_end")({}, f.ctx);
  const issued = await f.tools.get(CONVERSATION_GUIDE_ACTIVATION_TOOL).execute(
    "stale-alpha-guide", {}, undefined, undefined, f.ctx,
  );
  const staleMessages = [
    { role: "assistant", content: [{ type: "toolCall", id: "stale-alpha-guide", name: CONVERSATION_GUIDE_ACTIVATION_TOOL, arguments: {} }] },
    { role: "toolResult", toolCallId: "stale-alpha-guide", toolName: CONVERSATION_GUIDE_ACTIVATION_TOOL, content: issued.content, details: issued.details, isError: false, timestamp: Date.now() },
  ];

  await f.commands.get("implement-spec").handler(betaLocation, f.ctx);
  await f.events.get("agent_end")({}, f.ctx);
  await assert.rejects(
    () => f.events.get("context")({ messages: staleMessages }, f.ctx),
    /issued Conversation guide receipt is stale or mismatched/,
  );
  assert.match(f.notices.at(-1).message, /conversation blocked: issued Conversation guide receipt is stale or mismatched/);
  const staleStatus = await f.tools.get(CONVERSATION_GUIDE_STATUS_TOOL).execute(
    "stale-status", {}, undefined, undefined, f.ctx,
  );
  assert.equal(staleStatus.details.ready, false);

  await activateConversationGuide(f, "beta-guide");
  const wrong = await f.tools.get("create_spec_episode").execute(
    "wrong-prepared-location", { location: LOCATION }, undefined, undefined, f.ctx,
  );
  assert.equal(wrong.isError, true);
  assert.match(wrong.content[0].text, /no matching active \/implement-spec approval/);
  assert.equal(createCalls, 0);

  const exact = await f.tools.get("create_spec_episode").execute(
    "exact-prepared-location", { location: betaLocation }, undefined, undefined, f.ctx,
  );
  assert.equal(exact.isError, true);
  assert.match(exact.content[0].text, /prospective create reached for \.ralph\/plans\/future\/beta-plan/);
  assert.equal(createCalls, 1);
  const replay = await f.tools.get("create_spec_episode").execute(
    "prospective-replay", { location: betaLocation }, undefined, undefined, f.ctx,
  );
  assert.equal(replay.isError, true);
  assert.match(replay.content[0].text, /no matching active \/implement-spec approval/);
  assert.equal(createCalls, 1);
});

test("cancelled implement chain loses approval at the next agent_end after its one skip", async (t) => {
  let createCalls = 0;
  const extension = createReviewedPlanExtension({
    async createEpisode() { createCalls += 1; throw new Error("must stay unauthorized"); },
  });
  const f = fixture(t, { extension });
  writeSkill(f.cwd, "implementation readiness", "implement-spec");

  await f.commands.get("implement-spec").handler(LOCATION, f.ctx);
  await f.events.get("agent_end")({}, f.ctx); // prep turn: the sole bounded skip
  await f.events.get("agent_end")({}, f.ctx); // next turn after cancellation

  const denied = await f.tools.get("create_spec_episode").execute(
    "cancelled-chain", { location: LOCATION }, undefined, undefined, f.ctx,
  );
  assert.equal(denied.isError, true);
  assert.match(denied.content[0].text, /no matching active \/implement-spec approval/);
  assert.equal(createCalls, 0);
});

test("repeated implement admissions still grant only one agent_end skip", async (t) => {
  let createCalls = 0;
  const extension = createReviewedPlanExtension({
    async createEpisode() { createCalls += 1; throw new Error("must stay unauthorized"); },
  });
  const f = fixture(t, { extension });
  writeSkill(f.cwd, "implementation readiness", "implement-spec");
  const betaLocation = ".ralph/plans/future/beta-plan";
  mkdirSync(join(f.cwd, betaLocation), { recursive: true });

  await f.commands.get("implement-spec").handler(LOCATION, f.ctx);
  await f.commands.get("implement-spec").handler(betaLocation, f.ctx);
  await f.events.get("agent_end")({}, f.ctx);
  await f.events.get("agent_end")({}, f.ctx);

  const denied = await f.tools.get("create_spec_episode").execute(
    "duplicate-admission", { location: betaLocation }, undefined, undefined, f.ctx,
  );
  assert.equal(denied.isError, true);
  assert.match(denied.content[0].text, /no matching active \/implement-spec approval/);
  assert.equal(createCalls, 0);
});

test("session start and shutdown clear implement approval without a skip", async (t) => {
  for (const boundary of ["session_start", "session_shutdown"]) {
    let createCalls = 0;
    const extension = createReviewedPlanExtension({
      async createEpisode() { createCalls += 1; throw new Error("must stay unauthorized"); },
    });
    const f = fixture(t, { extension });
    writeSkill(f.cwd, "implementation readiness", "implement-spec");

    await f.commands.get("implement-spec").handler(LOCATION, f.ctx);
    await f.events.get(boundary)({}, f.ctx);

    const denied = await f.tools.get("create_spec_episode").execute(
      `boundary-${boundary}`, { location: LOCATION }, undefined, undefined, f.ctx,
    );
    assert.equal(denied.isError, true);
    assert.match(denied.content[0].text, /no matching active \/implement-spec approval/);
    assert.equal(createCalls, 0);
  }
});

test("successful create activates exact owner oversight without an oversight skill or unsolicited message", async (t) => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-reviewed-plan-activate-")));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, LOCATION), { recursive: true });
  writeSkill(cwd, "implementation readiness", "implement-spec");
  writeSkill(cwd, "implementation prep", "implement-prep");
  mkdirSync(join(cwd, ".prime", "agent", "state", "spec-episodes"), { recursive: true });
  let createCalls = 0;
  const episode = {
    version: 2, reused: false, slug: "alpha-plan", sourceLocation: LOCATION,
    ownerSessionId: "owner-session", episodeId: "episode-id",
    episodeActiveSessionId: "active-id",
    episodeSessionFile: join(resolve(dirname(cwd), `${basename(cwd)}-alpha-plan-episode`), "episode.jsonl"),
    branch: "episode/alpha-plan", worktree: resolve(dirname(cwd), `${basename(cwd)}-alpha-plan-episode`),
    sessionName: "alpha-plan-episode", bootstrapAdmission: "delivered",
  };
  const extension = createReviewedPlanExtension({
    async createEpisode(location) {
      createCalls += 1; assert.equal(location, LOCATION);
      writeFileSync(join(cwd, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json"), JSON.stringify(episode));
      return episode;
    },
  });
  const f = createHarness(cwd, extension);
  await f.commands.get("implement-spec").handler(LOCATION, f.ctx);
  await f.events.get("agent_end")({}, f.ctx);
  const prospective = await activateConversationGuide(f, "prospective-create-guide");
  assert.doesNotMatch(JSON.stringify(prospective.issued.details), /alpha-plan|preparation|lifecycle/i);
  const before = f.messages.length;
  const result = await f.tools.get("create_spec_episode").execute(
    "activate-call", { location: LOCATION }, undefined, undefined, f.ctx,
  );
  assert.equal(result.isError, undefined, JSON.stringify(result));
  assert.equal(createCalls, 1);
  assert.equal(f.messages.length, before);
  const markers = f.entries.filter((entry) => entry.customType === "prime-claw-conversation-oversight");
  assert.equal(markers.length, 1);
  assert.deepEqual(markers[0].data, {
    markerVersion: 2, status: "active", ownerSessionId: "owner-session",
    slug: "alpha-plan", sourceLocation: LOCATION, episodeId: "episode-id",
    episodeSessionFile: episode.episodeSessionFile,
    branch: "episode/alpha-plan", worktree: episode.worktree,
    sessionName: "alpha-plan-episode", identityVersion: 2, admission: "delivered",
  });
  const disclosure = await activateConversationGuide(f, "activate-guide-call");
  assert.equal(count(disclosure.issued.content[0].text, "PRIME_CLAW_CONVERSATION_GUIDE_V1"), 1);
  assert.match(disclosure.issued.content[0].text, /name: prime-claw-oversee-episode/);
  const later = await f.events.get("context")({ messages: disclosure.messages }, f.ctx);
  const laterResult = later.messages.find((message) => message.role === "toolResult");
  assert.doesNotMatch(laterResult.content[0].text, /PRIME_CLAW_CONVERSATION_GUIDE_V1|name: prime-claw-oversee-episode/);
  assert.match(laterResult.content[0].text, /omitted after its single authorized continuation/);
  assert.equal(laterResult.details, undefined);
  const copiedBody = readFileSync(join(REPO_ROOT, "src", "prime-agent-plugin", "skills", "prime-claw-oversee-episode", "SKILL.md"), "utf8");
  const copied = await f.events.get("context")({ messages: [{ role: "user", content: copiedBody }] }, f.ctx);
  assert.equal(copied.messages[0].content, "[managed Conversation guide disclosure omitted]");

  await f.commands.get("implement-spec").handler(LOCATION, f.ctx);
  await f.events.get("agent_end")({}, f.ctx);
  const activeOwnerMisuse = await f.tools.get("create_spec_episode").execute(
    "active-owner-create", { location: LOCATION }, undefined, undefined, f.ctx,
  );
  assert.equal(activeOwnerMisuse.isError, true);
  assert.match(activeOwnerMisuse.content[0].text, /not bound to the current prospective preparation/);
  assert.equal(createCalls, 1);

  await f.events.get("session_start")({}, f.ctx);
  const reset = await f.tools.get(CONVERSATION_GUIDE_STATUS_TOOL).execute("status-after-start", {}, undefined, undefined, f.ctx);
  assert.equal(reset.details.ready, false);
  const malformedIssued = await f.tools.get(CONVERSATION_GUIDE_ACTIVATION_TOOL).execute("malformed-guide", {}, undefined, undefined, f.ctx);
  const malformedMessages = [
    { role: "assistant", content: [{ type: "toolCall", id: "malformed-guide", name: CONVERSATION_GUIDE_ACTIVATION_TOOL, arguments: {} }] },
    { role: "toolResult", toolCallId: "malformed-guide", toolName: CONVERSATION_GUIDE_ACTIVATION_TOOL, content: malformedIssued.content, details: { ...malformedIssued.details, sha256: "wrong" }, isError: false, timestamp: Date.now() },
  ];
  await assert.rejects(() => f.events.get("context")({ messages: malformedMessages }, f.ctx), /tool call\/result pair is missing or malformed/);
  const afterMalformed = await f.tools.get(CONVERSATION_GUIDE_STATUS_TOOL).execute("status-after-malformed", {}, undefined, undefined, f.ctx);
  assert.equal(afterMalformed.details.ready, false);
  for (const alias of ["result", "call"]) {
    const toolCallId = `same-id-${alias}-alias`;
    const issued = await f.tools.get(CONVERSATION_GUIDE_ACTIVATION_TOOL).execute(toolCallId, {}, undefined, undefined, f.ctx);
    const messages = [
      { role: "assistant", content: [{ type: "toolCall", id: toolCallId, name: CONVERSATION_GUIDE_ACTIVATION_TOOL, arguments: {} }] },
      { role: "toolResult", toolCallId, toolName: CONVERSATION_GUIDE_ACTIVATION_TOOL, content: issued.content, details: issued.details, isError: false, timestamp: Date.now() },
    ];
    if (alias === "result") {
      messages.push({ role: "toolResult", toolCallId, toolName: CONVERSATION_GUIDE_STATUS_TOOL, content: issued.content, details: issued.details, isError: false, timestamp: Date.now() });
    } else {
      messages[0].content.push({ type: "toolCall", id: toolCallId, name: CONVERSATION_GUIDE_STATUS_TOOL, arguments: {} });
    }
    await assert.rejects(() => f.events.get("context")({ messages }, f.ctx), /tool call\/result pair is missing or malformed/);
    assert.match(f.notices.at(-1).message, /conversation blocked: issued Conversation guide tool call\/result pair is missing or malformed/);
    const status = await f.tools.get(CONVERSATION_GUIDE_STATUS_TOOL).execute(`status-after-${alias}-alias`, {}, undefined, undefined, f.ctx);
    assert.equal(status.details.ready, false);
  }
  const collision = join(f.ctx.cwd, ".agents", "skills", "prime-claw-oversee-episode");
  mkdirSync(collision, { recursive: true });
  await assert.rejects(
    () => f.tools.get(CONVERSATION_GUIDE_ACTIVATION_TOOL).execute("collision-guide", {}, undefined, undefined, f.ctx),
    /Conversation guide activation failed: project Conversation guide collision/,
  );
});

test("registered bookkeeping close is no-UI, exact, and idempotent", async (t) => {
  const cwd=realpathSync(mkdtempSync(join(tmpdir(),"prime-claw-reviewed-plan-close-")));t.after(()=>rmSync(cwd,{recursive:true,force:true}));
  mkdirSync(join(cwd,LOCATION),{recursive:true});
  const state=join(cwd,".prime/agent/state/spec-episodes");mkdirSync(state,{recursive:true});
  const slug="alpha-plan",worktree=resolve(dirname(cwd),`${basename(cwd)}-${slug}-episode`),identity={version:2,slug,sourceLocation:LOCATION,ownerSessionId:"owner-session",episodeId:"33333333-3333-4333-8333-333333333333",episodeActiveSessionId:"route",episodeSessionFile:join(worktree,"episode.jsonl"),branch:`episode/${slug}`,worktree,sessionName:`${slug}-episode`,bootstrapAdmission:"delivered"};
  const identityPath=join(state,`${slug}.json`);writeFileSync(identityPath,JSON.stringify(identity));
  const f=createHarness(cwd);f.entries.push({type:"custom",customType:"prime-claw-conversation-oversight",data:{markerVersion:2,status:"active",ownerSessionId:identity.ownerSessionId,slug,sourceLocation:LOCATION,episodeId:identity.episodeId,episodeSessionFile:identity.episodeSessionFile,branch:identity.branch,worktree:identity.worktree,sessionName:identity.sessionName,identityVersion:2,admission:"delivered"}});
  const tool=f.tools.get("finalize_spec_episode");
  await assert.rejects(() => tool.execute("close-before-guide",{location:LOCATION},undefined,undefined,f.ctx),/guide has not been activated and consumed/);assert.equal(existsSync(identityPath),true);assert.equal(f.entries.at(-1).data.status,"active");
  await activateConversationGuide(f,"close-guide");
  const closed=await tool.execute("close",{location:LOCATION},undefined,undefined,f.ctx);
  assert.equal(closed.isError,undefined);assert.equal(closed.details.reused,false);assert.equal(existsSync(identityPath),false);assert.equal(f.confirmations.length,0);assert.equal(f.entries.at(-1).data.status,"inactive");
  const before=structuredClone(f.entries),replay=await tool.execute("replay",{location:LOCATION},undefined,undefined,f.ctx);
  assert.equal(replay.isError,undefined);assert.equal(replay.details.reused,true);assert.deepEqual(f.entries,before);assert.match(replay.content[0].text,/already closed/);
  const betaLocation=".ralph/plans/future/beta-plan",betaSlug="beta-plan",betaWorktree=resolve(dirname(cwd),`${basename(cwd)}-${betaSlug}-episode`),beta={...identity,slug:betaSlug,sourceLocation:betaLocation,episodeId:"55555555-5555-4555-8555-555555555555",episodeActiveSessionId:"beta-route",episodeSessionFile:join(betaWorktree,"episode.jsonl"),branch:`episode/${betaSlug}`,worktree:betaWorktree,sessionName:`${betaSlug}-episode`},betaPath=join(state,`${betaSlug}.json`);
  mkdirSync(join(cwd,betaLocation),{recursive:true});writeFileSync(betaPath,JSON.stringify(beta));f.entries.push({type:"custom",customType:"prime-claw-conversation-oversight",data:{markerVersion:2,status:"active",ownerSessionId:beta.ownerSessionId,slug:beta.slug,sourceLocation:beta.sourceLocation,episodeId:beta.episodeId,episodeSessionFile:beta.episodeSessionFile,branch:beta.branch,worktree:beta.worktree,sessionName:beta.sessionName,identityVersion:2,admission:"delivered"}});
  const betaBytes=readFileSync(betaPath,"utf8"),betaMarkers=structuredClone(f.entries),historical=await tool.execute("replay-during-beta",{location:LOCATION},undefined,undefined,f.ctx);
  assert.equal(historical.isError,undefined);assert.equal(historical.details.reused,true);assert.equal(historical.details.episodeId,identity.episodeId);assert.equal(historical.details.location,LOCATION);assert.match(historical.content[0].text,/already closed.*alpha-plan/);assert.doesNotMatch(historical.content[0].text,/beta-plan/);assert.equal(readFileSync(betaPath,"utf8"),betaBytes);assert.deepEqual(f.entries,betaMarkers);assert.equal(f.confirmations.length,0);assert.deepEqual(f.messages,[]);
  const betaContext=await f.events.get("context")({messages:[]},f.ctx);assert.equal(betaContext.messages.filter(message=>message.customType==="prime-claw-oversee-episode-package").length,0);
  const wrong=await tool.execute("wrong",{location:".ralph/plans/future/unknown-plan"},undefined,undefined,f.ctx);assert.equal(wrong.isError,true);assert.match(wrong.content[0].text,/No exact oversight marker/);assert.equal(readFileSync(betaPath,"utf8"),betaBytes);assert.deepEqual(f.entries,betaMarkers);
  rmSync(betaPath);f.entries.push({type:"custom",customType:"prime-claw-conversation-oversight",data:{...betaMarkers.at(-1).data,status:"inactive"}});
  const newer={...identity,episodeId:"44444444-4444-4444-8444-444444444444",episodeActiveSessionId:"new-route"};writeFileSync(identityPath,JSON.stringify(newer));
  f.entries.push({type:"custom",customType:"prime-claw-conversation-oversight",data:{...before.at(-1).data,status:"active",episodeId:newer.episodeId}});
  const stale=await tool.execute("stale-old-close",{location:LOCATION},undefined,undefined,f.ctx);assert.equal(stale.isError,true);assert.match(stale.content[0].text,/multiple oversight generations/);assert.equal(JSON.parse(readFileSync(identityPath,"utf8")).episodeId,newer.episodeId);assert.equal(f.entries.at(-1).data.status,"active");
});

test("historical bookkeeping replay stays alpha-scoped while beta remains active across restart", async (t) => {
  const cwd=realpathSync(mkdtempSync(join(tmpdir(),"prime-claw-reviewed-plan-historical-close-")));t.after(()=>rmSync(cwd,{recursive:true,force:true}));
  const alphaLocation=LOCATION,betaLocation=".ralph/plans/future/beta-plan";
  mkdirSync(join(cwd,alphaLocation),{recursive:true});mkdirSync(join(cwd,betaLocation),{recursive:true});
  const state=join(cwd,".prime/agent/state/spec-episodes");mkdirSync(state,{recursive:true});
  const make=(slug,sourceLocation,episodeId)=>{const worktree=resolve(dirname(cwd),`${basename(cwd)}-${slug}-episode`);return{version:2,slug,sourceLocation,ownerSessionId:"owner-session",episodeId,episodeActiveSessionId:`${slug}-route`,episodeSessionFile:join(worktree,"episode.jsonl"),branch:`episode/${slug}`,worktree,sessionName:`${slug}-episode`,bootstrapAdmission:"delivered"}};
  const alpha=make("alpha-plan",alphaLocation,"33333333-3333-4333-8333-333333333333"),beta=make("beta-plan",betaLocation,"44444444-4444-4444-8444-444444444444");
  const mark=(identity,status)=>({markerVersion:2,status,ownerSessionId:identity.ownerSessionId,slug:identity.slug,sourceLocation:identity.sourceLocation,episodeId:identity.episodeId,episodeSessionFile:identity.episodeSessionFile,branch:identity.branch,worktree:identity.worktree,sessionName:identity.sessionName,identityVersion:2,admission:"delivered"});
  const betaPath=join(state,"beta-plan.json");writeFileSync(betaPath,JSON.stringify(beta));
  const entries=[mark(alpha,"inactive"),mark(beta,"active")].map(data=>({type:"custom",customType:"prime-claw-conversation-oversight",data}));
  const assertReplay=async(f,label)=>{
    const identityBefore=readFileSync(betaPath,"utf8"),markersBefore=structuredClone(f.entries);
    const result=await f.tools.get("finalize_spec_episode").execute(label,{location:alphaLocation},undefined,undefined,f.ctx);
    assert.equal(result.isError,undefined);assert.equal(result.details.reused,true);assert.equal(result.details.episodeId,alpha.episodeId);assert.equal(result.details.location,alphaLocation);assert.match(result.content[0].text,/already closed.*alpha-plan/);assert.doesNotMatch(result.content[0].text,/beta-plan/);
    assert.equal(readFileSync(betaPath,"utf8"),identityBefore);assert.deepEqual(f.entries,markersBefore);assert.equal(f.confirmations.length,0);assert.deepEqual(f.messages,[]);
    const context=await f.events.get("context")({messages:[]},f.ctx);assert.equal(context.messages.filter(message=>message.customType==="prime-claw-oversee-episode-package").length,0);
  };
  const first=createHarness(cwd);first.entries.push(...structuredClone(entries));await assertReplay(first,"historical-close");
  const restarted=createHarness(cwd);restarted.entries.push(...structuredClone(entries));await restarted.events.get("session_start")({},restarted.ctx);assert.deepEqual(restarted.entries,entries);await assertReplay(restarted,"historical-close-after-restart");
});

test("registered actual handoff reopen refresh preserves ordinary owner oversight", async (t) => {
  const cwd=realpathSync(mkdtempSync(join(tmpdir(),"prime-claw-reviewed-plan-route-")));t.after(()=>rmSync(cwd,{recursive:true,force:true}));
  mkdirSync(join(cwd,LOCATION),{recursive:true});
  const slug="alpha-plan",worktree=resolve(dirname(cwd),`${basename(cwd)}-${slug}-episode`);t.after(()=>rmSync(worktree,{recursive:true,force:true}));mkdirSync(worktree,{recursive:true});writeSkill(worktree,"handoff","handoff");writeSkill(worktree,"execute","execute");
  const state=join(cwd,".prime/agent/state/spec-episodes");mkdirSync(state,{recursive:true});let identity={version:2,slug,sourceLocation:LOCATION,ownerSessionId:"owner-session",episodeId:"33333333-3333-4333-8333-333333333333",episodeActiveSessionId:"old-route",episodeSessionFile:join(cwd,"episode.jsonl"),branch:`episode/${slug}`,worktree,sessionName:`${slug}-episode`,bootstrapAdmission:"delivered"};const identityPath=join(state,`${slug}.json`);writeFileSync(identityPath,JSON.stringify(identity));
  const publisher={async list(){return[{sessionId:identity.episodeId,sessionFile:identity.episodeSessionFile,sessionName:identity.sessionName,cwd:worktree,isSessionActive:false}]},async reopen(){return{activeSessionId:"new-route",sessionId:identity.episodeId,sessionFile:identity.episodeSessionFile}},async getState(){return{activeSessionId:"new-route",sessionId:identity.episodeId,sessionFile:identity.episodeSessionFile,sessionName:identity.sessionName,cwd:worktree,isSessionActive:false,isStreaming:false,isCompacting:false,isBashRunning:false,isRunningTools:false,hasRunningRlmChildren:false,unfinishedActionCount:0,sessionActions:{queuedCount:0,steering:[],followUps:[]}}},async deliverHandoff(){},close(){}};
  const dependencies={git:{repositoryRoot(){return cwd},hasBranch(){return true},worktrees(){return[{path:worktree,branch:identity.branch}]}},filesystem:{readIdentity(){return identity},writeIdentity(_path,value){identity=value;writeFileSync(identityPath,JSON.stringify(value))},exists(){return true}},publisher};
  const f=createHarness(cwd,createReviewedPlanExtension(dependencies));f.entries.push({type:"custom",customType:"prime-claw-conversation-oversight",data:{markerVersion:2,status:"active",ownerSessionId:"owner-session",slug,sourceLocation:LOCATION,episodeId:identity.episodeId,episodeSessionFile:identity.episodeSessionFile,branch:identity.branch,worktree,sessionName:identity.sessionName,identityVersion:2,admission:"delivered"}});
  await assert.rejects(() => f.tools.get("handoff_spec_episode").execute("handoff-before-guide",{location:LOCATION,guidance:""},undefined,undefined,f.ctx),/guide has not been activated and consumed/);assert.equal(identity.episodeActiveSessionId,"old-route");
  await activateConversationGuide(f,"handoff-guide");
  const result=await f.tools.get("handoff_spec_episode").execute("handoff",{location:LOCATION,guidance:""},undefined,undefined,f.ctx);assert.equal(result.isError,undefined);assert.equal(identity.episodeActiveSessionId,"new-route");const context=await f.events.get("context")({messages:[]},f.ctx);assert.equal(context.messages.filter(m=>m.customType==="prime-claw-oversee-episode-package").length,0);
});

test("owner handoff tool success text agrees with prompt delivery details", async (t) => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-reviewed-plan-handoff-success-")));
  const worktree = join(dirname(cwd), `${cwd.split("/").at(-1)}-alpha-plan-episode`);
  t.after(() => {
    rmSync(worktree, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });
  mkdirSync(join(cwd, LOCATION), { recursive: true });
  mkdirSync(worktree, { recursive: true });
  writeSkill(worktree, "canonical handoff", "handoff");
  writeSkill(worktree, "canonical execute", "execute");
  const identity = {
    version: 2,
    slug: "alpha-plan",
    sourceLocation: LOCATION,
    ownerSessionId: "owner-session",
    branch: "episode/alpha-plan",
    worktree,
    sessionName: "alpha-plan-episode",
    episodeId: "episode-id",
    episodeActiveSessionId: "active-episode-id",
    episodeSessionFile: join(cwd, "episode.jsonl"),
    bootstrapAdmission: "delivered",
  };
  const idle = {
    activeSessionId: identity.episodeActiveSessionId,
    sessionId: identity.episodeId,
    sessionFile: identity.episodeSessionFile,
    sessionName: identity.sessionName,
    cwd: identity.worktree,
    isSessionActive: false,
    isStreaming: false,
    isCompacting: false,
    isBashRunning: false,
    isRunningTools: false,
    hasRunningRlmChildren: false,
    unfinishedActionCount: 0,
    queuedCount: 0,
    sessionActions: { queuedCount: 0, steering: [], followUps: [] },
  };
  let delivered = 0;
  const dependencies = {
    git: {
      repositoryRoot() { return cwd; },
      hasBranch() { return true; },
      worktrees() { return [{ path: worktree, branch: identity.branch }]; },
    },
    filesystem: {
      readIdentity() { return identity; },
      exists() { return true; },
    },
    publisher: {
      async list() { return [idle]; },
      async getState() { return idle; },
      async deliverHandoff() { delivered += 1; },
      close() {},
    },
  };
  const f = createHarness(cwd, createReviewedPlanExtension(dependencies));
  const state = join(cwd, ".prime", "agent", "state", "spec-episodes");
  mkdirSync(state, { recursive: true });
  writeFileSync(join(state, "alpha-plan.json"), JSON.stringify(identity));
  f.entries.push({ type: "custom", customType: "prime-claw-conversation-oversight", data: {
    markerVersion: 2, status: "active", ownerSessionId: identity.ownerSessionId,
    slug: identity.slug, sourceLocation: identity.sourceLocation, episodeId: identity.episodeId,
    episodeSessionFile: identity.episodeSessionFile, branch: identity.branch,
    worktree: identity.worktree, sessionName: identity.sessionName,
    identityVersion: 2, admission: "delivered",
  } });
  await activateConversationGuide(f, "handoff-success-guide");

  const result = await f.tools.get("handoff_spec_episode").execute(
    "handoff-call-success",
    { location: LOCATION },
    undefined,
    undefined,
    f.ctx,
  );

  assert.equal(result.isError, undefined);
  assert.equal(delivered, 1);
  assert.equal(result.details.handoffDelivery, "prompt");
  assert.equal(result.details.executeDelivery, "followUp");
  assert.match(result.content[0].text, /ordinary prompt/);
  assert.match(result.content[0].text, /immediate or queued/);
  assert.doesNotMatch(result.content[0].text, /sent as steer/);
});

test("owner handoff tool requires a durable identity for the exact location", async (t) => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-reviewed-plan-handoff-")));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, LOCATION), { recursive: true });
  const dependencies = {
    git: { repositoryRoot() { return cwd; } },
    filesystem: { readIdentity() { return null; } },
    publisher: { close() {} },
  };
  const f = createHarness(cwd, createReviewedPlanExtension(dependencies));

  await assert.rejects(
    () => f.tools.get("handoff_spec_episode").execute(
      "handoff-call-1",
      { location: LOCATION, guidance: "operator focus" },
      undefined,
      undefined,
      f.ctx,
    ),
    /requires one exact active owner episode/,
  );
  assert.deepEqual(f.messages, []);
});

test("fresh native implement-spec runs can sequentially arm different reviewed folders for the same owner", async (t) => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-reviewed-plan-auth-")));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, LOCATION), { recursive: true });
  writeSkill(cwd, "implementation readiness", "implement-spec");
  writeSkill(cwd, "implementation prep", "implement-prep");
  mkdirSync(join(cwd, ".prime", "agent", "state", "spec-episodes"), { recursive: true });
  const dependencies = {
    git: { repositoryRoot() { throw new Error("authorized tool reached host capability"); } },
    filesystem: {},
    publisher: { close() {} },
  };
  const f = createHarness(cwd, createReviewedPlanExtension(dependencies));
  const tool = f.tools.get("create_spec_episode");

  const unauthorized = await tool.execute("call-1", { location: LOCATION }, undefined, undefined, f.ctx);
  assert.equal(unauthorized.isError, true);
  assert.match(unauthorized.content[0].text, /no matching active \/implement-spec approval/);

  await f.commands.get("implement-spec").handler(LOCATION, f.ctx);
  await f.events.get("agent_end")({}, f.ctx);
  await activateConversationGuide(f, "call-2-guide");
  const authorized = await tool.execute("call-2", { location: LOCATION }, undefined, undefined, f.ctx);
  assert.equal(authorized.isError, true);
  assert.match(authorized.content[0].text, /authorized tool reached host capability/);

  const consumed = await tool.execute("call-3", { location: LOCATION }, undefined, undefined, f.ctx);
  assert.match(consumed.content[0].text, /no matching active \/implement-spec approval/);

  const betaLocation = ".ralph/plans/future/beta-plan";
  mkdirSync(join(cwd, betaLocation), { recursive: true });
  await f.commands.get("implement-spec").handler(betaLocation, f.ctx);
  await f.events.get("agent_end")({}, f.ctx);
  await activateConversationGuide(f, "call-4-guide");
  const laterAuthorized = await tool.execute("call-4", { location: betaLocation }, undefined, undefined, f.ctx);
  assert.equal(laterAuthorized.isError, true);
  assert.match(laterAuthorized.content[0].text, /authorized tool reached host capability/);
  const laterConsumed = await tool.execute("call-5", { location: betaLocation }, undefined, undefined, f.ctx);
  assert.match(laterConsumed.content[0].text, /no matching active \/implement-spec approval/);
});


const EXPERT_COMMIT = "a".repeat(40);
const EXPERT_PACKET = "b".repeat(64);
const EXPERT_PACKAGE = "c".repeat(64);

function reservationFixture(t) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-expert-reservation-")));
  mkdirSync(join(cwd, LOCATION), { recursive: true });
  const state = join(cwd, ".prime", "agent", "state", "spec-episodes");
  mkdirSync(state, { recursive: true });
  const slug = "alpha-plan";
  const worktree = resolve(dirname(cwd), `${basename(cwd)}-${slug}-episode`);
  mkdirSync(worktree, { recursive: true });
  t.after(() => {
    rmSync(worktree, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });
  const identity = {
    version: 2, slug, sourceLocation: LOCATION, ownerSessionId: "owner-session",
    episodeId: "33333333-3333-4333-8333-333333333333",
    episodeActiveSessionId: "active-route", episodeSessionFile: join(worktree, "episode.jsonl"),
    branch: `episode/${slug}`, worktree, sessionName: `${slug}-episode`, bootstrapAdmission: "delivered",
  };
  writeFileSync(join(state, `${slug}.json`), JSON.stringify(identity));
  const control = {
    now: 1_000_000,
    nonceCount: 0,
    packageCalls: 0,
    repositoryCalls: 0,
    repositoryTarget: undefined,
    packageStatus: {
      schemaVersion: 1, status: "AVAILABLE", mode: "managed",
      expectedPackageSha256: EXPERT_PACKAGE, packageSha256: EXPERT_PACKAGE,
    },
  };
  const extension = createReviewedPlanExtension({
    now: () => control.now,
    nonce: () => `${String(++control.nonceCount).padStart(2, "0")}${"n".repeat(41)}`,
    packageStatus() { control.packageCalls += 1; return control.packageStatus; },
    repositoryIdentity(worktreePath) {
      control.repositoryCalls += 1;
      control.repositoryTarget = worktreePath;
      return { repositoryPath: worktreePath, commitOid: EXPERT_COMMIT };
    },
  });
  const f = createHarness(cwd, extension);
  f.entries.push({
    type: "custom", customType: "prime-claw-conversation-oversight", data: {
      markerVersion: 2, status: "active", ownerSessionId: identity.ownerSessionId,
      slug, sourceLocation: LOCATION, episodeId: identity.episodeId,
      episodeSessionFile: identity.episodeSessionFile, branch: identity.branch,
      worktree: identity.worktree, sessionName: identity.sessionName,
      identityVersion: 2, admission: "delivered",
    },
  });
  return { cwd, ...f, control, identity };
}

function reserveArguments(overrides = {}) {
  return {
    commitOid: EXPERT_COMMIT,
    packetDigest: EXPERT_PACKET,
    selector: OFFICIAL_EXPERT_SELECTOR,
    thinking: OFFICIAL_EXPERT_THINKING,
    ...overrides,
  };
}

function bindArguments(f, nonce, overrides = {}) {
  return {
    nonce,
    rlmChildId: "sub-deadbeef",
    childName: "official-expert-reviewer",
    sessionDir: join(f.cwd, "child-session"),
    returnedModel: OFFICIAL_EXPERT_SELECTOR,
    ...overrides,
  };
}

function gitCommit(repository, name, contents) {
  writeFileSync(join(repository, name), contents);
  execFileSync("git", ["-C", repository, "add", name]);
  execFileSync("git", ["-C", repository, "-c", "user.name=Prime Claw Test", "-c", "user.email=test@example.invalid", "commit", "-q", "-m", contents]);
  return execFileSync("git", ["-C", repository, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function reservationTopologyFixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-expert-topology-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, "conversation-owner");
  const worktree = resolve(dirname(cwd), `${basename(cwd)}-alpha-plan-episode`);
  mkdirSync(join(cwd, LOCATION), { recursive: true });
  mkdirSync(worktree, { recursive: true });
  execFileSync("git", ["-C", cwd, "init", "-q"]);
  execFileSync("git", ["-C", worktree, "init", "-q"]);
  const ownerHead = gitCommit(cwd, "owner.txt", "owner-head");
  const episodePrevious = gitCommit(worktree, "episode.txt", "episode-previous");
  const episodeHead = gitCommit(worktree, "episode.txt", "episode-head");
  assert.notEqual(ownerHead, episodeHead);

  const state = join(cwd, ".prime", "agent", "state", "spec-episodes");
  mkdirSync(state, { recursive: true });
  const identityPath = join(state, "alpha-plan.json");
  const identity = {
    version: 2, slug: "alpha-plan", sourceLocation: LOCATION, ownerSessionId: "owner-session",
    episodeId: "77777777-7777-4777-8777-777777777777",
    episodeActiveSessionId: "active-route", episodeSessionFile: join(worktree, "episode.jsonl"),
    branch: "episode/alpha-plan", worktree, sessionName: "alpha-plan-episode", bootstrapAdmission: "delivered",
  };
  writeFileSync(identityPath, JSON.stringify(identity));
  const control = { now: 1_000_000, nonceCount: 0 };
  const extension = createReviewedPlanExtension({
    now: () => control.now,
    nonce: () => `${String(++control.nonceCount).padStart(2, "0")}${"t".repeat(41)}`,
    packageStatus: () => ({
      schemaVersion: 1, status: "AVAILABLE", mode: "managed",
      expectedPackageSha256: EXPERT_PACKAGE, packageSha256: EXPERT_PACKAGE,
    }),
  });
  const f = createHarness(cwd, extension);
  const marker = {
    markerVersion: 2, status: "active", ownerSessionId: identity.ownerSessionId,
    slug: identity.slug, sourceLocation: identity.sourceLocation, episodeId: identity.episodeId,
    episodeSessionFile: identity.episodeSessionFile, branch: identity.branch,
    worktree: identity.worktree, sessionName: identity.sessionName,
    identityVersion: 2, admission: "delivered",
  };
  f.entries.push({ type: "custom", customType: "prime-claw-conversation-oversight", data: marker });
  function setWorktree(nextWorktree) {
    identity.worktree = nextWorktree;
    identity.episodeSessionFile = join(nextWorktree, "episode.jsonl");
    marker.worktree = nextWorktree;
    marker.episodeSessionFile = identity.episodeSessionFile;
    writeFileSync(identityPath, JSON.stringify(identity));
  }
  return { root, cwd, worktree, ownerHead, episodePrevious, episodeHead, control, identity, marker, setWorktree, ...f };
}

function canonicalJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }

function admissionFixture(t, mutate = () => {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-expert-admission-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const stateRoot = join(root, "private-state"); mkdirSync(stateRoot, { mode: 0o700 }); chmodSync(stateRoot, 0o700);
  const projectPath = join(root, "project"); const repositoryPath = join(root, "episode");
  mkdirSync(projectPath); mkdirSync(repositoryPath);
  const ownerSessionId = "11111111-1111-7111-8111-111111111111";
  const ownerSessionFile = join(root, "owner.jsonl");
  const episodeId = "22222222-2222-7222-8222-222222222222";
  const marker = {
    markerVersion: 2, status: "active", ownerSessionId, slug: "alpha-plan",
    sourceLocation: ".ralph/plans/future/alpha-plan", episodeId,
    episodeSessionFile: join(repositoryPath, "episode.jsonl"), branch: "episode/alpha-plan",
    worktree: repositoryPath, sessionName: "alpha-plan-episode", identityVersion: 2, admission: "delivered",
  };
  const ownerHeader = { type: "session", version: 3, id: ownerSessionId, timestamp: "2026-10-07T00:00:00Z", cwd: projectPath, rlmDepth: 0 };
  writeFileSync(ownerSessionFile, `${JSON.stringify(ownerHeader)}\n${JSON.stringify({ type: "custom", id: "marker", parentId: null, timestamp: ownerHeader.timestamp, customType: "prime-claw-conversation-oversight", data: marker })}\n`, { mode: 0o600 });
  const ownerGeneration = sha256(JSON.stringify([
    2, ownerSessionId, marker.slug, marker.sourceLocation, episodeId, resolve(marker.episodeSessionFile),
    marker.branch, resolve(repositoryPath), marker.sessionName, 2, marker.admission,
  ]));
  const childName = "expert-review-abcdefghijklmnopqrstuvwx";
  const rlmChildId = "sub-deadbeef"; const sessionDir = join(root, rlmChildId); mkdirSync(sessionDir);
  const childSessionId = "33333333-3333-7333-8333-333333333333";
  const sessionFile = join(sessionDir, `${childSessionId}.jsonl`);
  const childHeader = { type: "session", version: 3, id: childSessionId, timestamp: ownerHeader.timestamp, cwd: projectPath, parentSession: ownerSessionFile, rlmDepth: 1 };
  writeFileSync(sessionFile, `${JSON.stringify(childHeader)}\n`, { mode: 0o600 });
  const commitOid = "c".repeat(40); const packageSha256 = "a".repeat(64);
  const packet = {
    schemaVersion: 1, kind: EXPERT_REVIEW_PACKET_KIND, repositoryPath, commitOid,
    specificationPath: ".ralph/plans/SPECIFICATION.md", executionPlanPath: ".ralph/plans/EXECUTION_PLAN.md",
    evidencePaths: ["docs/evidence/official-lean-role-protocol/candidate.md"], focus: "Review the exact candidate only.",
  };
  const packetJson = canonicalJson(packet);
  const record = {
    schema: EXPERT_REVIEW_STATE_SCHEMA, phase: "FINALIZED", nonce: "n".repeat(43),
    createdAt: 1_000, expiresAt: 1_000 + EXPERT_REVIEW_RESERVATION_TTL_MS,
    ownerSessionId, ownerSessionFile, ownerHeaderId: ownerSessionId, ownerGeneration,
    projectPath, repositoryPath, candidateCommitOid: commitOid,
    preReviewRepository: { head: commitOid, clean: true, statusBytes: 0, statusSha256: sha256(Buffer.alloc(0)) },
    packet, packetJson, packetDigest: sha256(packetJson), packageSha256, kernelSha256: PRIME_CLAW_ROLE_KERNEL_SHA256,
    selector: OFFICIAL_EXPERT_SELECTOR, thinking: OFFICIAL_EXPERT_THINKING,
    childName, bootstrapDigest: sha256("harmless bootstrap"), finalizedAt: 1_100,
    rlmChildId, sessionDir, returnedModel: OFFICIAL_EXPERT_SELECTOR,
  };
  const control = { now: 2_000, packageSha256, commitOid, systemPrompt: PRIME_CLAW_ROLE_KERNEL_TEXT, aborts: 0, notices: [], wait: async () => {} };
  mutate({ record, control, childHeader, ownerHeader, marker, packet });
  writeFileSync(sessionFile, `${JSON.stringify(childHeader)}\n`, { mode: 0o600 });
  writeFileSync(ownerSessionFile, `${JSON.stringify(ownerHeader)}\n${JSON.stringify({ type: "custom", id: "marker", parentId: null, timestamp: ownerHeader.timestamp, customType: "prime-claw-conversation-oversight", data: marker })}\n`, { mode: 0o600 });
  const finalized = join(stateRoot, `${childName}.finalized.json`);
  writeFileSync(finalized, `${canonicalJson(record)}\n`, { mode: 0o600 }); chmodSync(finalized, 0o600);
  const hooks = { before: [], context: [] };
  registerOfficialExpertReviewReservation({
    on(name, handler) { if (name === "before_agent_start") hooks.before.push(handler); if (name === "context") hooks.context.push(handler); },
  }, {
    guideRoot: join(REPO_ROOT, "src", "prime-agent-plugin"), stateRoot, now: () => control.now,
    admissionWaitMs: 2, wait: async (milliseconds) => control.wait(milliseconds),
    packageStatus: () => ({ schemaVersion: 1, status: "AVAILABLE", mode: "managed", packageSha256: control.packageSha256 }),
    repositoryIdentity: () => ({ repositoryPath, commitOid: control.commitOid }),
  });
  const ctx = {
    cwd: projectPath,
    model: { provider: "openai-codex", id: "gpt-6-astra" },
    sessionManager: {
      getSessionDir: () => sessionDir, getSessionId: () => childSessionId,
      getSessionFile: () => sessionFile, getSessionName: () => childName,
      getHeader: () => childHeader,
    },
    getSystemPrompt: () => control.systemPrompt,
    abort() { control.aborts += 1; },
    ui: { notify(message, level) { control.notices.push({ message, level }); } },
  };
  return {
    root, stateRoot, pending: join(stateRoot, `${childName}.pending.json`), finalized,
    claimed: join(stateRoot, `${childName}.claimed.json`),
    reported: join(stateRoot, `${childName}.reported.json`), settled: join(stateRoot, `${childName}.settled.json`),
    dispositioned: join(stateRoot, `${childName}.dispositioned.json`),
    closed: join(stateRoot, `${childName}.closed.json`), cancelled: join(stateRoot, `${childName}.cancelled.json`),
    record, control, hooks, ctx, childName,
  };
}

const initialMessages = [
  { role: "custom", customType: "harness-digest", content: "public custom digest has zero authority", display: false, timestamp: 0 },
  { role: "user", content: [{ type: "text", text: "copied bootstrap has zero authority" }], timestamp: 1 },
];

test("official EXPERT caller reserve/bind tools are retired and generic children remain ordinary", async (t) => {
  const f = fixture(t);
  for (const name of [EXPERT_REVIEW_RESERVE_TOOL, EXPERT_REVIEW_BIND_TOOL, EXPERT_REVIEW_STATUS_TOOL, EXPERT_REVIEW_CANCEL_TOOL]) assert.equal(f.tools.has(name), false);
  const ordinary = await f.events.get("context")({ messages: initialMessages }, f.ctx);
  assert.deepEqual(ordinary.messages, initialMessages);
  assert.equal(f.notices.length, 0);
});

test("official EXPERT final state binds public child identity and claims before one canonical provider turn", async (t) => {
  const f = admissionFixture(t);
  const before = await f.hooks.before[0]({ prompt: "attacker-controlled text is ignored" }, f.ctx);
  assert.equal(before.systemPrompt, PRIME_CLAW_ROLE_KERNEL_TEXT);
  const admitted = await f.hooks.context[0]({ messages: initialMessages }, f.ctx);
  assert.equal(f.control.aborts, 0);
  assert.equal(existsSync(f.finalized), false);
  assert.equal(existsSync(f.claimed), true);
  const claimed = JSON.parse(readFileSync(f.claimed, "utf8"));
  assert.equal(claimed.phase, "CLAIMED");
  assert.equal(claimed.childSessionId, f.ctx.sessionManager.getSessionId());
  assert.equal(admitted.messages.length, 1);
  assert.equal(admitted.messages[0].role, "user");
  assert.match(admitted.messages[0].content[0].text, /## Immutable review packet/);
  assert.match(admitted.messages[0].content[0].text, new RegExp(f.record.packetDigest.slice(0, 0)));
  assert.equal(admitted.messages[0].content[0].text.includes("copied bootstrap"), false);

  const continuation = await f.hooks.context[0]({ messages: [...initialMessages, { role: "assistant", content: [{ type: "toolCall", id: "x" }] }, { role: "toolResult", toolCallId: "x", content: [] }] }, f.ctx);
  assert.equal(continuation.messages.length, 3);
  f.ctx.model = { provider: "openai-codex", id: "wrong" };
  await assert.rejects(() => f.hooks.context[0]({ messages: [...initialMessages, { role: "assistant", content: [] }] }, f.ctx), /current child model/);
  assert.equal(f.control.aborts, 1);
});

test("official EXPERT admission waits through a transient pending plus finalized publication overlap", async (t) => {
  const f = admissionFixture(t);
  writeFileSync(f.pending, `${canonicalJson({ ...f.record, phase: "PENDING" })}
`, { mode: 0o600 });
  let waits = 0;
  f.control.wait = async () => {
    waits += 1;
    unlinkSync(f.pending);
  };
  let providerCalls = 0;
  const admitted = await f.hooks.context[0]({ messages: initialMessages }, f.ctx);
  providerCalls += 1;
  assert.equal(waits, 1);
  assert.equal(providerCalls, 1);
  assert.equal(f.control.aborts, 0);
  assert.equal(existsSync(f.pending), false);
  assert.equal(existsSync(f.finalized), false);
  assert.equal(existsSync(f.claimed), true);
  assert.equal(admitted.messages.length, 1);
});

test("official EXPERT admission refuses a persistent pending plus finalized overlap", async (t) => {
  const f = admissionFixture(t);
  writeFileSync(f.pending, `${canonicalJson({ ...f.record, phase: "PENDING" })}
`, { mode: 0o600 });
  let providerCalls = 0;
  await assert.rejects(async () => {
    await f.hooks.context[0]({ messages: initialMessages }, f.ctx);
    providerCalls += 1;
  }, /conflicting official EXPERT private phase files/);
  assert.equal(providerCalls, 0);
  assert.equal(f.control.aborts, 1);
  assert.equal(existsSync(f.pending), true);
  assert.equal(existsSync(f.finalized), true);
  assert.equal(existsSync(f.claimed), false);
});

test("all terminal official EXPERT children retain the neutral kernel and abort provider calls", async (t) => {
  for (const [phase, key] of [
    ["REPORTED", "reported"], ["SETTLED", "settled"], ["DISPOSITIONED", "dispositioned"],
    ["CLOSED", "closed"], ["CANCELLED", "cancelled"],
  ]) {
    await t.test(phase.toLowerCase(), async (tt) => {
      const f = admissionFixture(tt);
      await f.hooks.context[0]({ messages: initialMessages }, f.ctx);
      const claimed = JSON.parse(readFileSync(f.claimed, "utf8"));
      writeFileSync(f[key], `${canonicalJson({ ...claimed, phase })}
`, { mode: 0o600 });
      unlinkSync(f.claimed);
      const before = await f.hooks.before[0]({ prompt: "terminal replay" }, f.ctx);
      assert.equal(before.systemPrompt, PRIME_CLAW_ROLE_KERNEL_TEXT);
      await assert.rejects(
        () => f.hooks.context[0]({ messages: [...initialMessages, { role: "assistant", content: [] }] }, f.ctx),
        new RegExp(`${phase.toLowerCase()} review child`),
      );
      assert.equal(f.control.aborts, 1);
    });
  }
});

test("conflicting official EXPERT phase files fail closed before provider use", async (t) => {
  const f = admissionFixture(t);
  await f.hooks.context[0]({ messages: initialMessages }, f.ctx);
  const claimed = JSON.parse(readFileSync(f.claimed, "utf8"));
  writeFileSync(f.reported, `${canonicalJson({ ...claimed, phase: "REPORTED" })}
`, { mode: 0o600 });
  const before = await f.hooks.before[0]({ prompt: "conflict" }, f.ctx);
  assert.equal(before.systemPrompt, PRIME_CLAW_ROLE_KERNEL_TEXT);
  await assert.rejects(
    () => f.hooks.context[0]({ messages: initialMessages }, f.ctx),
    /conflicting official EXPERT private phase files/,
  );
  assert.equal(f.control.aborts, 1);
});

test("official EXPERT admission aborts before provider use for every finalized binding mismatch", async (t) => {
  const cases = [
    ["stale", ({ record, control }) => { control.now = record.expiresAt; }, /stale or expired/],
    ["child-name", ({ record }) => { record.childName = "expert-review-differentabcdefghijkl"; }, /child name/],
    ["session-dir", ({ record }) => { record.sessionDir = "/definitely/wrong"; }, /directory/],
    ["parent", ({ childHeader }) => { childHeader.parentSession = "/wrong-parent.jsonl"; }, /parent-session/],
    ["generation", ({ record }) => { record.ownerGeneration = "b".repeat(64); }, /generation/],
    ["package", ({ record }) => { record.packageSha256 = "b".repeat(64); }, /package/],
    ["kernel", ({ record }) => { record.kernelSha256 = "b".repeat(64); }, /kernel/],
    ["packet", ({ record }) => { record.packet.focus = "mutated"; }, /packet/],
    ["candidate", ({ control }) => { control.commitOid = "d".repeat(40); }, /candidate/],
  ];
  for (const [label, mutate, pattern] of cases) {
    await t.test(label, async (tt) => {
      const f = admissionFixture(tt, mutate);
      let providerCalls = 0;
      await assert.rejects(async () => {
        await f.hooks.context[0]({ messages: initialMessages }, f.ctx);
        providerCalls += 1;
      }, pattern);
      assert.equal(providerCalls, 0, "provider must not be called after an admission refusal");
      assert.equal(f.control.aborts, 1);
      assert.equal(existsSync(f.claimed), false);
    });
  }
});

test("official EXPERT pending timeout, duplicate claim, and replay all abort", async (t) => {
  const unsafeRoot = admissionFixture(t);
  chmodSync(unsafeRoot.stateRoot, 0o755);
  await assert.rejects(() => unsafeRoot.hooks.context[0]({ messages: initialMessages }, unsafeRoot.ctx), /mode-private/);
  assert.equal(unsafeRoot.control.aborts, 1);

  const timeout = admissionFixture(t);
  renameSync(timeout.finalized, join(timeout.stateRoot, `${timeout.childName}.pending.json`));
  await assert.rejects(() => timeout.hooks.context[0]({ messages: initialMessages }, timeout.ctx), /timed out/);
  assert.equal(timeout.control.aborts, 1);

  const duplicate = admissionFixture(t);
  await duplicate.hooks.context[0]({ messages: initialMessages }, duplicate.ctx);
  await assert.rejects(() => duplicate.hooks.context[0]({ messages: initialMessages }, duplicate.ctx), /duplicated/);
  assert.equal(duplicate.control.aborts, 1);

  const replay = admissionFixture(t);
  await replay.hooks.context[0]({ messages: initialMessages }, replay.ctx);
  await assert.rejects(() => replay.hooks.context[0]({ messages: [...initialMessages, { role: "assistant", content: [] }, { role: "user", content: "replay" }] }, replay.ctx), /replayed|duplicate trigger/);
  assert.equal(replay.control.aborts, 1);
});
