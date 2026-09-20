import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import reviewedPlan from "../.prime/agent/extensions/reviewed-plan.ts";

const LOCATION = ".ralph/plans/future/alpha-plan";
const USAGE = "Usage: /plan .ralph/plans/future/<slug>";

function createHarness(cwd) {
  const commands = new Map();
  const messages = [];
  const notices = [];
  const pi = {
    registerCommand(name, definition) {
      commands.set(name, definition);
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
  reviewedPlan(pi);
  return { commands, ctx, messages, notices };
}

function fixture(t, { skill = "canonical plan body", folder = true } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "prime-claw-reviewed-plan-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, ".ralph", "plans", "future"), { recursive: true });
  if (folder) mkdirSync(join(cwd, LOCATION), { recursive: true });
  if (skill !== null) writeSkill(cwd, skill);
  return { cwd, ...createHarness(cwd) };
}

function writeSkill(cwd, body) {
  const path = join(cwd, ".ralph", "skills", "plan", "SKILL.md");
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

test("registers one native plan command", (t) => {
  const f = fixture(t);
  assert.deepEqual([...f.commands.keys()], ["plan"]);
  assert.match(f.commands.get("plan").description, /explicit .*future/);
});

test("loads current canonical markdown and injects exact location once", async (t) => {
  const f = fixture(t, { skill: "old body" });
  writeSkill(f.cwd, "current project-customized plan body");

  await f.commands.get("plan").handler(LOCATION, f.ctx);

  assert.deepEqual(f.messages, [
    expectedPrompt(f.cwd, "current project-customized plan body"),
  ]);
  assert.equal(count(f.messages[0], "<operator-plan-location>"), 1);
  assert.equal(count(f.messages[0], LOCATION), 1);
  assert.deepEqual(f.notices, []);
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
