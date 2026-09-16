import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import handoffChain from "../.prime/agent/extensions/handoff-chain.ts";

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "prime-claw-handoff-chain-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));

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

function skillPath(cwd, name) {
  return join(cwd, ".ralph", "skills", name, "SKILL.md");
}

function markerPath(cwd) {
  return join(cwd, ".prime", "agent", "state", "chain-next");
}

function writeSkill(cwd, name, body) {
  const path = skillPath(cwd, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  return path;
}

function wrappedSkill(name, path, body) {
  return `<skill name="${name}" location="${path}">
References are relative to ${dirname(path)}.

${body}
</skill>`;
}

test("registers the native handoff command and compaction listener", (t) => {
  const f = fixture(t);
  assert.deepEqual([...f.commands.keys()], ["handoff"]);
  assert.match(f.commands.get("handoff").description, /compact context/);
  assert.equal(typeof f.events.get("session_compact"), "function");
});

test("handoff resolves canonical markdown from the session CWD and arms execute", async (t) => {
  const f = fixture(t);
  const body = `# Project-specific handoff

Keep this customization byte-for-byte.`;
  const path = writeSkill(f.cwd, "handoff", body);

  await f.commands.get("handoff").handler("", f.ctx);

  assert.equal(readFileSync(markerPath(f.cwd), "utf8"), "execute");
  assert.deepEqual(f.messages, [wrappedSkill("handoff", path, body)]);
  assert.deepEqual(f.notices, []);
});

test("handoff preserves an explicit next-skill target", async (t) => {
  const f = fixture(t);
  writeSkill(f.cwd, "handoff", "handoff body");

  await f.commands.get("handoff").handler("  review  ", f.ctx);

  assert.equal(readFileSync(markerPath(f.cwd), "utf8"), "review");
});

test("missing handoff markdown removes the marker and warns", async (t) => {
  const f = fixture(t);

  await f.commands.get("handoff").handler("", f.ctx);

  assert.equal(existsSync(markerPath(f.cwd)), false);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{
    message: "handoff-chain: .ralph/skills/handoff/SKILL.md not found",
    level: "warning",
  }]);
});

test("compaction without a marker is a no-op", (t) => {
  const f = fixture(t);

  f.events.get("session_compact")({}, f.ctx);

  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, []);
});

test("compaction consumes the marker and injects execute exactly once", (t) => {
  const f = fixture(t);
  const body = `# Project-specific execute

Run only the current slice.`;
  const path = writeSkill(f.cwd, "execute", body);
  const marker = markerPath(f.cwd);
  mkdirSync(dirname(marker), { recursive: true });
  writeFileSync(marker, "execute");

  f.events.get("session_compact")({}, f.ctx);
  f.events.get("session_compact")({}, f.ctx);

  assert.equal(existsSync(marker), false);
  assert.deepEqual(f.messages, [wrappedSkill("execute", path, body)]);
  assert.deepEqual(f.notices, []);
});

test("a blank marker falls back to execute", (t) => {
  const f = fixture(t);
  const path = writeSkill(f.cwd, "execute", "execute body");
  const marker = markerPath(f.cwd);
  mkdirSync(dirname(marker), { recursive: true });
  writeFileSync(marker, " ".repeat(2));

  f.events.get("session_compact")({}, f.ctx);

  assert.deepEqual(f.messages, [wrappedSkill("execute", path, "execute body")]);
});

test("a missing target is consumed and reported instead of retried", (t) => {
  const f = fixture(t);
  const marker = markerPath(f.cwd);
  mkdirSync(dirname(marker), { recursive: true });
  writeFileSync(marker, "review");

  f.events.get("session_compact")({}, f.ctx);

  assert.equal(existsSync(marker), false);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{
    message: "handoff-chain: .ralph/skills/review/SKILL.md not found",
    level: "warning",
  }]);
});
