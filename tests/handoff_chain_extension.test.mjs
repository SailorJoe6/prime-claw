import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import handoffChain from "../src/prime-agent-plugin/extensions/handoff-chain.ts";
import { canonicalWorkflowPrompt } from "../src/prime-agent-plugin/extension-support/workflow-chain.ts";

function createHarness(cwd, throwOnSend = 0) {
  const commands = new Map();
  const tools = new Map();
  const events = new Map();
  const messages = [];
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
  return { cwd, commands, tools, events, messages, notices, ctx };
}

function fixture(t, throwOnSend = 0) {
  const cwd = mkdtempSync(join(tmpdir(), "prime-claw-handoff-chain-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return createHarness(cwd, throwOnSend);
}

function skillPath(cwd, name) {
  return name === "execute"
    ? join(cwd, ".agents", "skills", "execute", "SKILL.md")
    : join(cwd, ".prime-claw", "workflows", `${name}.md`);
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

test("registers no custom commands and one narrow tool without lifecycle listeners", (t) => {
  const f = fixture(t);
  assert.deepEqual([...f.commands.keys()], []);
  assert.deepEqual([...f.tools.keys()], ["ralph_handoff"]);
  const tool = f.tools.get("ralph_handoff");
  assert.equal(tool.executionMode, "sequential");
  assert.deepEqual(Object.keys(tool.parameters.properties), ["guidance"]);
  assert.equal(tool.parameters.required, undefined);
  assert.equal(tool.parameters.additionalProperties, false);
  assert.match(tool.promptGuidelines.join(" "), /handoff skill.*bind the current implementation pass/);
  assert.match(tool.promptGuidelines.join(" "), /never retry uncertain delivery automatically/);
  assert.deepEqual([...f.events.keys()], []);
});

test("preflights then admits handoff followed by one execute follow-up", async (t) => {
  const f = fixture(t);
  const { handoffPath, executePath } = writeCanonicalSkills(f, "custom handoff", "custom execute");

  await f.tools.get("ralph_handoff").execute("tool", {}, undefined, undefined, f.ctx);

  assert.deepEqual(f.messages, [
    { message: wrappedSkill("handoff", handoffPath, "custom handoff"), options: { deliverAs: "steer" } },
    { message: wrappedSkill("execute", executePath, "custom execute"), options: { deliverAs: "followUp" } },
  ]);
  assert.deepEqual(f.notices, []);
});

test("preserves exact trimmed trailing guidance without changing execute routing", async (t) => {
  const f = fixture(t);
  const { handoffPath, executePath } = writeCanonicalSkills(f);
  const guidance = `focus on bead xyz; preserve ../../review!
Keep punctuation & spaces.`;

  await f.tools.get("ralph_handoff").execute("tool", { guidance: `  ${guidance}  ` }, undefined, undefined, f.ctx);

  assert.deepEqual(f.messages, [
    { message: wrappedSkill("handoff", handoffPath, "handoff body", guidance), options: { deliverAs: "steer" } },
    { message: wrappedSkill("execute", executePath, "execute body"), options: { deliverAs: "followUp" } },
  ]);
});

test("conversational tool steers handoff then queues the sole execute follow-up", async (t) => {
  const f = fixture(t);
  const { handoffPath, executePath } = writeCanonicalSkills(f);
  const guidance = `focus on the exact reviewed diff;
preserve punctuation & spacing.`;

  const result = await f.tools.get("ralph_handoff").execute(
    "tool-call-1",
    { guidance: `  ${guidance}  ` },
    undefined,
    undefined,
    f.ctx,
  );

  assert.deepEqual(f.messages, [
    {
      message: wrappedSkill("handoff", handoffPath, "handoff body", guidance),
      options: { deliverAs: "steer" },
    },
    {
      message: wrappedSkill("execute", executePath, "execute body"),
      options: { deliverAs: "followUp" },
    },
  ]);
  assert.equal(f.messages.filter(({ options }) => options?.deliverAs === "followUp").length, 1);
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.details, { admitted: true });
  assert.match(result.content[0].text, /admitted/);
  assert.match(result.content[0].text, /completion are not confirmed by admission/);
  assert.deepEqual(f.notices, []);
});

test("conversational tool preflights both skills before either send", async (t) => {
  const f = fixture(t);
  writeSkill(f.cwd, "handoff", "handoff body");

  const result = await f.tools.get("ralph_handoff").execute(
    "tool-call-2", {}, undefined, undefined, f.ctx,
  );

  assert.deepEqual(f.messages, []);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /execute\/SKILL\.md not found/);
});

test("conversational tool reports first-send uncertainty without claiming nonadmission", async (t) => {
  const f = fixture(t, 1);
  writeCanonicalSkills(f);

  const result = await f.tools.get("ralph_handoff").execute(
    "tool-call-3", {}, undefined, undefined, f.ctx,
  );

  assert.deepEqual(f.messages, []);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /handoff delivery is unconfirmed; inspect and do not retry/);
  assert.equal(result.details.admission, "unconfirmed");
  assert.equal(result.details.stage, "first");
  assert.equal(Object.hasOwn(result.details, "admitted"), false);
});

test("conversational tool reports second-send failure without claiming continuation", async (t) => {
  const f = fixture(t, 2);
  const { handoffPath } = writeCanonicalSkills(f);

  const result = await f.tools.get("ralph_handoff").execute(
    "tool-call-4", {}, undefined, undefined, f.ctx,
  );

  assert.deepEqual(f.messages, [{
    message: wrappedSkill("handoff", handoffPath, "handoff body"),
    options: { deliverAs: "steer" },
  }]);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /follow-up admission is unconfirmed/);
  assert.equal(result.details.admission, "unconfirmed");
  assert.equal(result.details.stage, "followUp");
  assert.equal(Object.hasOwn(result.details, "admitted"), false);
  assert.doesNotMatch(result.content[0].text, /Handoff admitted/);
});

test("missing handoff fails before a partial transition", async (t) => {
  const f = fixture(t);
  writeSkill(f.cwd, "execute", "execute body");

  const result = await f.tools.get("ralph_handoff").execute("missing", { guidance: "focus" }, undefined, undefined, f.ctx);

  assert.deepEqual(f.messages, []);
  assert.equal(result.isError, true);
  assert.equal(result.details.admitted, false);
  assert.match(result.content[0].text, /handoff\.md not found/);
  assert.deepEqual(f.notices, []);
});

test("late or repeated compaction signals have no execute-admission path", async (t) => {
  const f = fixture(t);
  writeCanonicalSkills(f);

  await f.tools.get("ralph_handoff").execute("tool", {}, undefined, undefined, f.ctx);
  const admitted = structuredClone(f.messages);

  assert.equal(f.events.get("session_compact"), undefined);
  assert.deepEqual(f.messages, admitted);
  assert.equal(f.messages.filter(({ options }) => options?.deliverAs === "followUp").length, 1);
});


test("active legacy Episode snapshot remains readable without template migration", (t) => {
  const cwd=mkdtempSync(join(tmpdir(),"pc-legacy-episode-"));t.after(()=>rmSync(cwd,{recursive:true,force:true}));
  for(const name of ["handoff","execute"]){const path=join(cwd,".ralph","skills",name,"SKILL.md");mkdirSync(dirname(path),{recursive:true});writeFileSync(path,`legacy ${name} bytes\n`);}
  assert.equal(canonicalWorkflowPrompt(cwd,"handoff"),null);
  const handoff=canonicalWorkflowPrompt(cwd,"handoff",{legacySnapshot:true}),execute=canonicalWorkflowPrompt(cwd,"execute",{legacySnapshot:true});
  assert.match(handoff,/legacy handoff bytes/);assert.match(handoff,/\.ralph\/skills\/handoff\/SKILL\.md/);assert.match(execute,/legacy execute bytes/);
});



test("old-layout active Episode admits handoff and execute from its unchanged snapshot", async (t) => {
  const f=fixture(t);for(const name of ["handoff","execute"]){const path=join(f.cwd,".ralph","skills",name,"SKILL.md");mkdirSync(dirname(path),{recursive:true});writeFileSync(path,`active snapshot ${name}\n`);}
  const result=await f.tools.get("ralph_handoff").execute("legacy-active",{},undefined,undefined,f.ctx);
  assert.equal(result.isError,undefined);assert.equal(f.messages.length,2);assert.match(f.messages[0].message,/active snapshot handoff/);assert.match(f.messages[1].message,/active snapshot execute/);assert.match(f.messages[0].message,/\.ralph\/skills\/handoff\/SKILL\.md/);
});
