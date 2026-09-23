import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import projectConversation from "../src/prime-agent-plugin/extensions/project-conversation.ts";

const MARKER_TYPE = "prime-claw-project-conversation";
const PROFILE = `# PROJECT_CONVERSATION

profile revision one`;

function createHarness(cwd, {
  flag = false,
  sessionId = "session-a",
  entries = [],
  seedCapabilities = false,
  rejectToolChanges = false,
} = {}) {
  const flags = new Map();
  const events = new Map();
  const commands = new Map(seedCapabilities ? [["native-command", { native: true }]] : []);
  const tools = new Map(seedCapabilities ? [["native-tool", { native: true }]] : []);
  const messages = [];
  const activeToolChanges = [];
  const storedEntries = structuredClone(entries);
  let currentSessionId = sessionId;

  const pi = {
    registerFlag(name, options) { flags.set(name, options); },
    getFlag(name) { return name === "project-conversation" ? flag : undefined; },
    on(name, handler) { events.set(name, handler); },
    appendEntry(customType, data) {
      storedEntries.push({ type: "custom", customType, data });
    },
    registerCommand(name, definition) { commands.set(name, definition); },
    registerTool(definition) { tools.set(definition.name, definition); },
    sendUserMessage(message, options) { messages.push({ message, options }); },
    setActiveTools(names) {
      if (rejectToolChanges) throw new Error("active tools must not change");
      activeToolChanges.push(names);
    },
  };
  const ctx = {
    cwd,
    sessionManager: {
      getSessionId() { return currentSessionId; },
      getEntries() { return storedEntries; },
    },
  };
  projectConversation(pi);
  return {
    pi, ctx, flags, events, commands, tools, messages, activeToolChanges, storedEntries,
    setSessionId(value) { currentSessionId = value; },
  };
}

function fixture(t, options = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "prime-claw-project-conversation-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const profilePath = join(cwd, ".prime", "agent", "profiles", "project-conversation.md");
  mkdirSync(dirname(profilePath), { recursive: true });
  writeFileSync(profilePath, PROFILE);
  return { cwd, profilePath, ...createHarness(cwd, options) };
}

function marker(sessionId, overrides = {}) {
  return {
    type: "custom",
    customType: MARKER_TYPE,
    data: { version: 1, role: "PROJECT_CONVERSATION", sessionId, ...overrides },
  };
}

async function start(f, reason = "startup") {
  await f.events.get("session_start")({ reason }, f.ctx);
}

async function before(f, systemPrompt = "BASE") {
  return f.events.get("before_agent_start")({ systemPrompt }, f.ctx);
}

test("registers only the explicit boolean flag and prompt lifecycle hooks", () => {
  const cwd = mkdtempSync(join(tmpdir(), "prime-claw-project-conversation-register-"));
  try {
    const f = createHarness(cwd);
    assert.deepEqual([...f.flags.keys()], ["project-conversation"]);
    assert.deepEqual(f.flags.get("project-conversation"), {
      description: "Assign this new session the identity-bound PROJECT_CONVERSATION role",
      type: "boolean",
      default: false,
    });
    assert.deepEqual([...f.events.keys()], ["session_start", "before_agent_start"]);
    assert.deepEqual([...f.commands.keys()], []);
    assert.deepEqual([...f.tools.keys()], []);
    assert.deepEqual(f.activeToolChanges, []);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("does not infer assignment from project cwd", async (t) => {
  const f = fixture(t);
  await start(f);
  assert.equal(await before(f), undefined);
  assert.deepEqual(f.storedEntries, []);
});


test("preserves pre-existing commands and tools without changing active tools", () => {
  const cwd = mkdtempSync(join(tmpdir(), "prime-claw-project-conversation-compat-"));
  try {
    const f = createHarness(cwd, { seedCapabilities: true, rejectToolChanges: true });
    assert.deepEqual([...f.commands.entries()], [["native-command", { native: true }]]);
    assert.deepEqual([...f.tools.entries()], [["native-tool", { native: true }]]);
    assert.deepEqual(f.activeToolChanges, []);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});


test("an unassigned session never reads a missing profile", async (t) => {
  const f = fixture(t);
  rmSync(f.profilePath, { force: true });
  await start(f);
  assert.equal(await before(f), undefined);
});

test("explicit startup binds the exact session and overlays the current profile", async (t) => {
  const f = fixture(t, { flag: true, sessionId: "owner-session" });
  await start(f);

  assert.deepEqual(f.storedEntries, [marker("owner-session")]);
  assert.deepEqual(await before(f, "EARLIER OVERLAY"), {
    systemPrompt: `EARLIER OVERLAY\n\n${PROFILE}`,
  });
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.activeToolChanges, []);
});

test("reads the profile once per agent run so reloads do not retain stale text", async (t) => {
  const f = fixture(t, { flag: true });
  await start(f);
  assert.match((await before(f)).systemPrompt, /profile revision one/);

  writeFileSync(f.profilePath, "# PROJECT_CONVERSATION\n\nprofile revision two");
  assert.match((await before(f)).systemPrompt, /profile revision two/);
  assert.doesNotMatch((await before(f)).systemPrompt, /profile revision one/);
});

test("same-session resume and extension reload restore the exact marker without duplication", async (t) => {
  const entries = [marker("owner-session")];
  for (const reason of ["resume", "reload"]) {
    const f = fixture(t, { sessionId: "owner-session", entries });
    await start(f, reason);
    assert.match((await before(f)).systemPrompt, /PROJECT_CONVERSATION/);
    assert.deepEqual(f.storedEntries, entries);
  }
});


test("cold process startup restores an existing exact marker without the flag", async (t) => {
  const entries = [marker("owner-session")];
  const f = fixture(t, { flag: false, sessionId: "owner-session", entries });
  await start(f, "startup");
  assert.match((await before(f)).systemPrompt, /PROJECT_CONVERSATION/);
  assert.deepEqual(f.storedEntries, entries);
});


test("a readable process flag cannot bind non-startup session identities", async (t) => {
  for (const reason of ["reload", "resume", "new", "fork"]) {
    const f = fixture(t, { flag: true, sessionId: `ordinary-${reason}` });
    await start(f, reason);
    assert.equal(await before(f), undefined);
    assert.deepEqual(f.storedEntries, []);
  }
});


test("one runtime clears assignment across a fork and restores it on owner resume", async (t) => {
  const f = fixture(t, { flag: true, sessionId: "owner-session" });
  await start(f, "startup");
  assert.match((await before(f)).systemPrompt, /PROJECT_CONVERSATION/);

  f.setSessionId("fork-session");
  await start(f, "fork");
  assert.equal(await before(f), undefined);
  assert.deepEqual(f.storedEntries, [marker("owner-session")]);

  f.setSessionId("owner-session");
  await start(f, "resume");
  assert.match((await before(f)).systemPrompt, /PROJECT_CONVERSATION/);
  assert.deepEqual(f.storedEntries, [marker("owner-session")]);
});

test("a fork with an inherited marker for another session remains ordinary", async (t) => {
  const inherited = marker("owner-session");
  const f = fixture(t, {
    flag: true,
    sessionId: "fork-session",
    entries: [inherited],
  });

  await start(f, "fork");

  assert.equal(await before(f), undefined);
  assert.deepEqual(f.storedEntries, [inherited]);
  assert.deepEqual(f.messages, []);
});

test("a separately explicit process startup can bind a new identity", async (t) => {
  const f = fixture(t, {
    flag: true,
    sessionId: "new-explicit-session",
    entries: [marker("source-session")],
  });

  await start(f, "startup");

  assert.deepEqual(f.storedEntries.at(-1), marker("new-explicit-session"));
  assert.match((await before(f)).systemPrompt, /PROJECT_CONVERSATION/);
});

test("marker validation is versioned, role-specific, and exact-session", async (t) => {
  const invalid = [
    marker("owner", { version: 2 }),
    marker("owner", { role: "EPISODE" }),
    marker("different"),
  ];
  for (const entry of invalid) {
    const f = fixture(t, { sessionId: "owner", entries: [entry] });
    await start(f, "resume");
    assert.equal(await before(f), undefined);
  }
});

test("role persistence stores no episode identity or phase state", async (t) => {
  const f = fixture(t, { flag: true, sessionId: "owner" });
  await start(f);
  assert.deepEqual(Object.keys(f.storedEntries[0].data).sort(), ["role", "sessionId", "version"]);
  assert.equal(JSON.stringify(f.storedEntries[0]).includes("episode"), false);
});

test("an assigned session fails closed when the profile is missing or empty", async (t) => {
  const f = fixture(t, { entries: [marker("owner")], sessionId: "owner" });
  await start(f, "resume");

  rmSync(f.profilePath, { force: true });
  assert.throws(() => f.events.get("before_agent_start")({ systemPrompt: "BASE" }, f.ctx),
    /assigned profile unavailable/);

  writeFileSync(f.profilePath, "   ");
  assert.throws(() => f.events.get("before_agent_start")({ systemPrompt: "BASE" }, f.ctx),
    /profile is empty/);
});
