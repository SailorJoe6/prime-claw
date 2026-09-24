import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import reviewedPlan, { createReviewedPlanExtension } from "../src/prime-agent-plugin/extensions/reviewed-plan.ts";

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

function createHarness(cwd, extension = reviewedPlan, throwOnSend = 0) {
  const commands = new Map();
  const tools = new Map();
  const events = new Map();
  const messages = [];
  const deliveries = [];
  const notices = [];
  let sendCount = 0;
  const pi = {
    registerCommand(name, definition) {
      commands.set(name, definition);
    },
    registerTool(definition) {
      tools.set(definition.name, definition);
    },
    on(name, handler) {
      events.set(name, handler);
    },
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
    },
    ui: {
      notify(message, level) {
        notices.push({ message, level });
      },
    },
  };
  extension(pi);
  return { commands, tools, events, ctx, messages, deliveries, notices };
}

function fixture(t, { skill = "canonical plan body", folder = true, throwOnSend = 0 } = {}) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-reviewed-plan-")));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, ".ralph", "plans", "future"), { recursive: true });
  if (folder) mkdirSync(join(cwd, LOCATION), { recursive: true });
  if (skill !== null) writeSkill(cwd, skill);
  return { cwd, ...createHarness(cwd, reviewedPlan, throwOnSend) };
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

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test("registers native reviewed commands, planning tool, and native-only implementation", (t) => {
  const f = fixture(t);
  assert.deepEqual([...f.commands.keys()], ["plan", "implement-spec"]);
  assert.deepEqual([...f.tools.keys()], ["ralph_plan", "create_spec_episode", "handoff_spec_episode"]);
  assert.equal(f.tools.has("ralph_implement_spec"), false);
  assert.deepEqual([...f.events.keys()], ["session_start", "agent_end", "session_shutdown"]);
  assert.match(f.commands.get("plan").description, /explicit .*future/);
  const planTool = f.tools.get("ralph_plan");
  assert.equal(planTool.executionMode, "sequential");
  assert.deepEqual(Object.keys(planTool.parameters.properties), ["location"]);
  assert.deepEqual(planTool.parameters.required, ["location"]);
  assert.equal(planTool.parameters.additionalProperties, false);
  assert.ok(planTool.promptGuidelines.every((guideline) => guideline.includes("ralph_plan")));
  assert.deepEqual(f.tools.get("create_spec_episode").parameters.required, ["location"]);
  assert.equal(f.tools.get("create_spec_episode").parameters.additionalProperties, false);
  const handoffTool = f.tools.get("handoff_spec_episode");
  assert.equal(handoffTool.executionMode, "sequential");
  assert.deepEqual(Object.keys(handoffTool.parameters.properties), ["location", "guidance"]);
  assert.deepEqual(handoffTool.parameters.required, ["location"]);
  assert.equal(handoffTool.parameters.additionalProperties, false);
  assert.ok(handoffTool.promptGuidelines.every((guideline) => guideline.includes("handoff_spec_episode") || guideline.startsWith("Pass only")));
});

test("loads current canonical markdown and injects exact location once", async (t) => {
  const f = fixture(t, { skill: "old body" });
  writeSkill(f.cwd, "current project-customized plan body");

  await f.commands.get("plan").handler(LOCATION, f.ctx);

  const prompt = expectedPrompt(f.cwd, "current project-customized plan body");
  assert.deepEqual(f.messages, [prompt]);
  assert.deepEqual(f.deliveries, [{ message: prompt, options: undefined }]);
  assert.equal(count(f.messages[0], "<operator-plan-location>"), 1);
  assert.equal(count(f.messages[0], LOCATION), 1);
  assert.deepEqual(f.notices, []);
});

test("conversational planning queues current canonical markdown once as a follow-up", async (t) => {
  const f = fixture(t, { skill: "old body" });
  writeSkill(f.cwd, "current project-customized plan body");

  const result = await f.tools.get("ralph_plan").execute(
    "plan-call-1",
    { location: `  ${LOCATION}  ` },
    undefined,
    undefined,
    f.ctx,
  );

  const prompt = expectedPrompt(f.cwd, "current project-customized plan body");
  assert.deepEqual(f.messages, [prompt]);
  assert.deepEqual(f.deliveries, [{
    message: prompt,
    options: { deliverAs: "followUp" },
  }]);
  assert.equal(count(f.messages[0], "<operator-plan-location>"), 1);
  assert.equal(count(f.messages[0], LOCATION), 1);
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.details, { admitted: true, location: LOCATION });
  assert.match(result.content[0].text, /Planning admitted/);
  assert.match(result.content[0].text, /has not completed/);
  assert.match(result.content[0].text, /implementation is not authorized/);
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

test("conversational planning reports missing canonical skill", async (t) => {
  const f = fixture(t, { skill: null });

  const result = await f.tools.get("ralph_plan").execute(
    "missing-skill", { location: LOCATION }, undefined, undefined, f.ctx,
  );

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /\.ralph\/skills\/plan\/SKILL\.md not found/);
  assert.deepEqual(f.messages, []);
});

test("conversational planning reports follow-up queue failure without claiming admission", async (t) => {
  const f = fixture(t, { throwOnSend: 1 });

  const result = await f.tools.get("ralph_plan").execute(
    "send-failure", { location: LOCATION }, undefined, undefined, f.ctx,
  );

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /canonical plan could not be queued/);
  assert.deepEqual(result.details, {
    admitted: false,
    error: "reviewed-plan: canonical plan could not be queued",
  });
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.deliveries, []);
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

test("missing canonical skill warns without model injection", async (t) => {
  const f = fixture(t, { skill: null });
  await f.commands.get("plan").handler(LOCATION, f.ctx);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{
    message: "reviewed-plan: .ralph/skills/plan/SKILL.md not found",
    level: "warning",
  }]);
});

test("multiple arguments show usage without model injection", async (t) => {
  const f = fixture(t);
  await f.commands.get("plan").handler(`${LOCATION} another`, f.ctx);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{ message: USAGE, level: "warning" }]);
});


test("implement-spec loads current canonical markdown and wraps exact location once", async (t) => {
  const f = fixture(t);
  const body = "project readiness policy";
  const path = writeSkill(f.cwd, body, "implement-spec");

  await f.commands.get("implement-spec").handler(LOCATION, f.ctx);

  assert.deepEqual(f.messages, [`<skill name="implement-spec" location="${path}">
References are relative to ${dirname(path)}.

${body}
</skill>

<operator-implementation-location>
${LOCATION}
</operator-implementation-location>`]);
  assert.equal(count(f.messages[0], "<operator-implementation-location>"), 1);
  assert.equal(count(f.messages[0], LOCATION), 1);
  assert.deepEqual(f.notices, []);
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

  const result = await f.tools.get("handoff_spec_episode").execute(
    "handoff-call-1",
    { location: LOCATION, guidance: "operator focus" },
    undefined,
    undefined,
    f.ctx,
  );

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /No durable episode identity exists/);
  assert.deepEqual(f.messages, []);
});

test("structured tool requires and consumes matching implement-spec approval", async (t) => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-reviewed-plan-auth-")));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, LOCATION), { recursive: true });
  writeSkill(cwd, "implementation readiness", "implement-spec");
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
  const authorized = await tool.execute("call-2", { location: LOCATION }, undefined, undefined, f.ctx);
  assert.equal(authorized.isError, true);
  assert.match(authorized.content[0].text, /authorized tool reached host capability/);

  const consumed = await tool.execute("call-3", { location: LOCATION }, undefined, undefined, f.ctx);
  assert.match(consumed.content[0].text, /no matching active \/implement-spec approval/);
});
