import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import handoffChain from "../.prime/agent/extensions/handoff-chain.ts";

function createHarness(cwd, throwOnSend = 0) {
  const commands = new Map();
  const events = new Map();
  const messages = [];
  const notices = [];
  let sendCount = 0;
  const pi = {
    registerCommand(name, definition) {
      commands.set(name, definition);
    },
    on(name, handler) {
      events.set(name, handler);
    },
    sendUserMessage(message, options) {
      sendCount += 1;
      if (sendCount === throwOnSend) throw new Error("synthetic send failure");
      messages.push({ message, options });
    },
  };
  const ctx = {
    cwd,
    ui: {
      notify(message, level) {
        notices.push({ message, level });
      },
    },
  };

  handoffChain(pi);
  return { cwd, commands, events, messages, notices, ctx };
}

function fixture(t, throwOnSend = 0) {
  const cwd = mkdtempSync(join(tmpdir(), "prime-claw-handoff-chain-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return createHarness(cwd, throwOnSend);
}

function skillPath(cwd, name) {
  return join(cwd, ".ralph", "skills", name, "SKILL.md");
}

function legacyMarkerPath(cwd) {
  return join(cwd, ".prime", "agent", "state", "chain-next");
}

function writeSkill(cwd, name, body) {
  const path = skillPath(cwd, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  return path;
}

function wrappedSkill(name, path, body, guidance = "") {
  const wrapped = `<skill name="${name}" location="${path}">
References are relative to ${dirname(path)}.

${body}
</skill>`;
  if (!guidance) return wrapped;
  return `${wrapped}

<operator-compaction-guidance>
${guidance}
</operator-compaction-guidance>`;
}

function writeCanonicalSkills(f, handoffBody = "handoff body", executeBody = "execute body") {
  return {
    handoffPath: writeSkill(f.cwd, "handoff", handoffBody),
    executePath: writeSkill(f.cwd, "execute", executeBody),
  };
}

test("registers native handoff and only cleanup lifecycle listeners", (t) => {
  const f = fixture(t);
  assert.deepEqual([...f.commands.keys()], ["handoff"]);
  assert.match(f.commands.get("handoff").description, /queued independently/);
  assert.equal(typeof f.events.get("session_start"), "function");
  assert.equal(typeof f.events.get("session_shutdown"), "function");
  assert.equal(f.events.has("session_compact"), false);
});

test("preflights then admits handoff followed by one execute follow-up", async (t) => {
  const f = fixture(t);
  const { handoffPath, executePath } = writeCanonicalSkills(f, "custom handoff", "custom execute");

  await f.commands.get("handoff").handler("", f.ctx);

  assert.deepEqual(f.messages, [
    { message: wrappedSkill("handoff", handoffPath, "custom handoff"), options: undefined },
    { message: wrappedSkill("execute", executePath, "custom execute"), options: { deliverAs: "followUp" } },
  ]);
  assert.deepEqual(f.notices, []);
});

test("preserves exact trimmed trailing guidance without changing execute routing", async (t) => {
  const f = fixture(t);
  const { handoffPath, executePath } = writeCanonicalSkills(f);
  const guidance = `focus on bead xyz; preserve ../../review!
Keep punctuation & spaces.`;

  await f.commands.get("handoff").handler(`  ${guidance}  `, f.ctx);

  assert.deepEqual(f.messages, [
    { message: wrappedSkill("handoff", handoffPath, "handoff body", guidance), options: undefined },
    { message: wrappedSkill("execute", executePath, "execute body"), options: { deliverAs: "followUp" } },
  ]);
});

test("missing handoff fails before a partial transition", async (t) => {
  const f = fixture(t);
  writeSkill(f.cwd, "execute", "execute body");

  await f.commands.get("handoff").handler("focus", f.ctx);

  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{
    message: "handoff-chain: .ralph/skills/handoff/SKILL.md not found",
    level: "warning",
  }]);
});

test("missing execute fails before handoff admission", async (t) => {
  const f = fixture(t);
  writeSkill(f.cwd, "handoff", "handoff body");

  await f.commands.get("handoff").handler("", f.ctx);

  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{
    message: "handoff-chain: .ralph/skills/execute/SKILL.md not found",
    level: "warning",
  }]);
});

test("a synchronous handoff admission failure is visible", async (t) => {
  const f = fixture(t, 1);
  writeCanonicalSkills(f);

  await f.commands.get("handoff").handler("", f.ctx);

  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{
    message: "handoff-chain: canonical handoff could not be admitted",
    level: "error",
  }]);
});

test("a synchronous follow-up queue failure is visible without claiming success", async (t) => {
  const f = fixture(t, 2);
  const { handoffPath } = writeCanonicalSkills(f);

  await f.commands.get("handoff").handler("", f.ctx);

  assert.deepEqual(f.messages, [{
    message: wrappedSkill("handoff", handoffPath, "handoff body"),
    options: undefined,
  }]);
  assert.deepEqual(f.notices, [{
    message: "handoff-chain: canonical execute follow-up could not be queued; continuation is infeasible",
    level: "error",
  }]);
});

test("late or repeated compaction signals have no execute-admission path", async (t) => {
  const f = fixture(t);
  writeCanonicalSkills(f);

  await f.commands.get("handoff").handler("", f.ctx);
  const admitted = structuredClone(f.messages);

  assert.equal(f.events.get("session_compact"), undefined);
  assert.deepEqual(f.messages, admitted);
  assert.equal(f.messages.filter(({ options }) => options?.deliverAs === "followUp").length, 1);
});

test("session lifecycle only removes legacy state and never reconstructs execute", async (t) => {
  const f = fixture(t);
  const legacy = legacyMarkerPath(f.cwd);
  mkdirSync(dirname(legacy), { recursive: true });
  writeFileSync(legacy, "execute");

  f.events.get("session_start")({}, f.ctx);
  assert.equal(existsSync(legacy), false);
  assert.deepEqual(f.messages, []);

  writeFileSync(legacy, "execute");
  f.events.get("session_shutdown")({}, f.ctx);
  assert.equal(existsSync(legacy), false);
  assert.deepEqual(f.messages, []);
});
