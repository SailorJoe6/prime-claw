import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import handoffChain from "../.prime/agent/extensions/handoff-chain.ts";

function createHarness(cwd, defaultSessionId = "session-a") {
  const commands = new Map();
  const events = new Map();
  const messages = [];
  const notices = [];
  const pi = {
    registerCommand(name, definition) {
      commands.set(name, definition);
    },
    on(name, handler) {
      events.set(name, handler);
    },
    sendUserMessage(message) {
      messages.push(message);
    },
  };
  function context(sessionId = defaultSessionId) {
    return {
      cwd,
      sessionManager: {
        getSessionId() {
          return sessionId;
        },
      },
      ui: {
        notify(message, level) {
          notices.push({ message, level });
        },
      },
    };
  }

  handoffChain(pi);
  return { cwd, commands, events, messages, notices, context, ctx: context() };
}

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "prime-claw-handoff-chain-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return createHarness(cwd);
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

test("registers the native handoff command and session lifecycle listeners", (t) => {
  const f = fixture(t);
  assert.deepEqual([...f.commands.keys()], ["handoff"]);
  assert.match(f.commands.get("handoff").description, /compaction guidance/);
  assert.equal(typeof f.events.get("session_start"), "function");
  assert.equal(typeof f.events.get("session_compact"), "function");
  assert.equal(typeof f.events.get("session_shutdown"), "function");
});

test("handoff resolves canonical markdown and arms fixed execute for its session", async (t) => {
  const f = fixture(t);
  const handoffBody = `# Project-specific handoff

Keep this customization byte-for-byte.`;
  const handoffPath = writeSkill(f.cwd, "handoff", handoffBody);
  const executePath = writeSkill(f.cwd, "execute", "execute body");

  await f.commands.get("handoff").handler("", f.ctx);
  f.events.get("session_compact")({}, f.ctx);

  assert.deepEqual(f.messages, [
    wrappedSkill("handoff", handoffPath, handoffBody),
    wrappedSkill("execute", executePath, "execute body"),
  ]);
  assert.deepEqual(f.notices, []);
});

test("all trailing text is compaction guidance and cannot select another skill", async (t) => {
  const f = fixture(t);
  const handoffPath = writeSkill(f.cwd, "handoff", "handoff body");
  const executePath = writeSkill(f.cwd, "execute", "execute body");
  const guidance = "and focus on bead xyzpdq; preserve paths like ../../review!\nKeep spaces & punctuation exactly.";

  await f.commands.get("handoff").handler(`  ${guidance}  `, f.ctx);
  f.events.get("session_compact")({}, f.ctx);

  assert.deepEqual(f.messages, [
    wrappedSkill("handoff", handoffPath, "handoff body", guidance),
    wrappedSkill("execute", executePath, "execute body"),
  ]);
  assert.deepEqual(f.notices, []);
});

test("missing handoff markdown clears pending state and warns", async (t) => {
  const f = fixture(t);
  writeSkill(f.cwd, "execute", "execute body");

  await f.commands.get("handoff").handler("focus here", f.ctx);
  f.events.get("session_compact")({}, f.ctx);

  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{
    message: "handoff-chain: .ralph/skills/handoff/SKILL.md not found",
    level: "warning",
  }]);
});

test("compaction without pending state is a no-op", (t) => {
  const f = fixture(t);

  f.events.get("session_compact")({}, f.ctx);

  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, []);
});

test("compaction consumes pending state and injects execute exactly once", async (t) => {
  const f = fixture(t);
  writeSkill(f.cwd, "handoff", "handoff body");
  const body = `# Project-specific execute

Run only the current slice.`;
  const path = writeSkill(f.cwd, "execute", body);

  await f.commands.get("handoff").handler("", f.ctx);
  f.messages.length = 0;
  f.events.get("session_compact")({}, f.ctx);
  f.events.get("session_compact")({}, f.ctx);

  assert.deepEqual(f.messages, [wrappedSkill("execute", path, body)]);
  assert.deepEqual(f.notices, []);
});

test("a missing execute skill is consumed and reported instead of retried", async (t) => {
  const f = fixture(t);
  writeSkill(f.cwd, "handoff", "handoff body");

  await f.commands.get("handoff").handler("", f.ctx);
  f.messages.length = 0;
  f.events.get("session_compact")({}, f.ctx);
  f.events.get("session_compact")({}, f.ctx);

  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{
    message: "handoff-chain: .ralph/skills/execute/SKILL.md not found",
    level: "warning",
  }]);
});

test("one shared extension closure isolates pending state by session ID", async (t) => {
  const f = fixture(t);
  const handoffPath = writeSkill(f.cwd, "handoff", "handoff body");
  const executePath = writeSkill(f.cwd, "execute", "execute body");
  const a = f.context("session-a");
  const b = f.context("session-b");

  await f.commands.get("handoff").handler("focus A", a);
  await f.commands.get("handoff").handler("focus B", b);
  f.events.get("session_compact")({}, a);
  f.events.get("session_compact")({}, a);
  f.events.get("session_compact")({}, b);

  assert.deepEqual(f.messages, [
    wrappedSkill("handoff", handoffPath, "handoff body", "focus A"),
    wrappedSkill("handoff", handoffPath, "handoff body", "focus B"),
    wrappedSkill("execute", executePath, "execute body"),
    wrappedSkill("execute", executePath, "execute body"),
  ]);
  assert.deepEqual(f.notices, []);
});

test("session lifecycle clears only that session and deletes legacy state", async (t) => {
  const f = fixture(t);
  writeSkill(f.cwd, "handoff", "handoff body");
  const executePath = writeSkill(f.cwd, "execute", "execute body");
  const a = f.context("session-a");
  const b = f.context("session-b");

  await f.commands.get("handoff").handler("focus A", a);
  await f.commands.get("handoff").handler("focus B", b);
  f.messages.length = 0;

  const legacy = legacyMarkerPath(f.cwd);
  mkdirSync(dirname(legacy), { recursive: true });
  writeFileSync(legacy, "review");
  f.events.get("session_start")({}, a);

  assert.equal(existsSync(legacy), false);
  f.events.get("session_compact")({}, a);
  f.events.get("session_compact")({}, b);
  assert.deepEqual(f.messages, [wrappedSkill("execute", executePath, "execute body")]);

  await f.commands.get("handoff").handler("focus A again", a);
  f.messages.length = 0;
  f.events.get("session_shutdown")({}, a);
  f.events.get("session_compact")({}, a);

  assert.deepEqual(f.messages, []);
});
