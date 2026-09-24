import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import reviewedPlan, { createReviewedPlanExtension } from "../src/prime-agent-plugin/extensions/reviewed-plan.ts";
import { EXPECTED_IDENTITY_KERNEL_BLOCK } from "../src/prime-agent-plugin/extension-support/conversation-oversight.ts";

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
      events.set(name, earlier ? async (...args) => { await earlier(...args); return handler(...args); } : handler);
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

function fixture(t, { skill = "canonical plan body", folder = true, throwOnSend = 0 } = {}) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-reviewed-plan-")));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, ".ralph", "plans", "future"), { recursive: true });
  if (folder) mkdirSync(join(cwd, LOCATION), { recursive: true });
  if (skill !== null) writeSkill(cwd, skill);
  writeSkill(cwd, "---\nname: oversee-episode\ndescription: test package\n---\ncanonical oversight", "oversee-episode");
  mkdirSync(join(cwd, ".prime", "agent", "state", "spec-episodes"), { recursive: true });
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
  assert.deepEqual([...f.tools.keys()], ["ralph_plan", "create_spec_episode", "finalize_spec_episode", "handoff_spec_episode"]);
  assert.equal(f.tools.has("ralph_implement_spec"), false);
  assert.deepEqual([...f.events.keys()], ["session_start", "context", "agent_end", "session_shutdown"]);
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

test("implement-spec refuses a shadowed identity kernel before model injection", async (t) => {
  const f = fixture(t);
  writeSkill(f.cwd, "implementation policy", "implement-spec");
  const shadowed = createHarness(f.cwd, reviewedPlan, 0, "project append shadow");
  await assert.rejects(
    shadowed.commands.get("implement-spec").handler(LOCATION, shadowed.ctx),
    /expected exactly one intact managed identity kernel/,
  );
  assert.deepEqual(shadowed.messages, []);
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


test("invalid raw oversight delimiters block promotion before episode creation", async (t) => {
  const invalid=[
    " ---\nname: oversee-episode\ndescription: valid package\n---\nbody",
    "\t---\nname: oversee-episode\ndescription: valid package\n---\nbody",
    "--- \nname: oversee-episode\ndescription: valid package\n---\nbody",
    "---\nname: oversee-episode\ndescription: valid package\n ---\nbody",
    "---\nname: oversee-episode\ndescription: valid package\n\t---\nbody",
    "---\nname: oversee-episode\ndescription: valid package\n--- \nbody",
  ];
  for(const raw of invalid){
    const cwd=realpathSync(mkdtempSync(join(tmpdir(),"prime-claw-reviewed-plan-raw-")));t.after(()=>rmSync(cwd,{recursive:true,force:true}));mkdirSync(join(cwd,LOCATION),{recursive:true});writeSkill(cwd,"implementation readiness","implement-spec");writeSkill(cwd,raw,"oversee-episode");const state=join(cwd,".prime/agent/state/spec-episodes");mkdirSync(state,{recursive:true});let createCalls=0;const extension=createReviewedPlanExtension({async createEpisode(){createCalls+=1;throw new Error("episode creation must not run")}}),f=createHarness(cwd,extension);
    const beforeEntries=structuredClone(f.entries),beforeMessages=structuredClone(f.messages);
    await assert.rejects(()=>f.commands.get("implement-spec").handler(LOCATION,f.ctx),/frontmatter/);
    assert.equal(createCalls,0);assert.deepEqual(f.entries,beforeEntries);assert.deepEqual(f.messages,beforeMessages);assert.deepEqual(readdirSync(state),[]);
  }
});

test("successful create activates exact owner oversight without unsolicited message", async (t) => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-reviewed-plan-activate-")));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, LOCATION), { recursive: true });
  writeSkill(cwd, "implementation readiness", "implement-spec");
  writeSkill(cwd, "---\nname: oversee-episode\ndescription: test package\n---\ncanonical oversight", "oversee-episode");
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
});

test("registered bookkeeping close is no-UI, exact, and idempotent", async (t) => {
  const cwd=realpathSync(mkdtempSync(join(tmpdir(),"prime-claw-reviewed-plan-close-")));t.after(()=>rmSync(cwd,{recursive:true,force:true}));
  mkdirSync(join(cwd,LOCATION),{recursive:true});writeSkill(cwd,"---\nname: oversee-episode\ndescription: test package\n---\nprocedure","oversee-episode");
  const state=join(cwd,".prime/agent/state/spec-episodes");mkdirSync(state,{recursive:true});
  const slug="alpha-plan",worktree=resolve(dirname(cwd),`${basename(cwd)}-${slug}-episode`),identity={version:2,slug,sourceLocation:LOCATION,ownerSessionId:"owner-session",episodeId:"33333333-3333-4333-8333-333333333333",episodeActiveSessionId:"route",episodeSessionFile:join(worktree,"episode.jsonl"),branch:`episode/${slug}`,worktree,sessionName:`${slug}-episode`,bootstrapAdmission:"delivered"};
  const identityPath=join(state,`${slug}.json`);writeFileSync(identityPath,JSON.stringify(identity));
  const f=createHarness(cwd);f.entries.push({type:"custom",customType:"prime-claw-conversation-oversight",data:{markerVersion:2,status:"active",ownerSessionId:identity.ownerSessionId,slug,sourceLocation:LOCATION,episodeId:identity.episodeId,episodeSessionFile:identity.episodeSessionFile,branch:identity.branch,worktree:identity.worktree,sessionName:identity.sessionName,identityVersion:2,admission:"delivered"}});
  const tool=f.tools.get("finalize_spec_episode"),closed=await tool.execute("close",{location:LOCATION},undefined,undefined,f.ctx);
  assert.equal(closed.isError,undefined);assert.equal(closed.details.reused,false);assert.equal(existsSync(identityPath),false);assert.equal(f.confirmations.length,0);assert.equal(f.entries.at(-1).data.status,"inactive");
  const before=structuredClone(f.entries),replay=await tool.execute("replay",{location:LOCATION},undefined,undefined,f.ctx);
  assert.equal(replay.isError,undefined);assert.equal(replay.details.reused,true);assert.deepEqual(f.entries,before);assert.match(replay.content[0].text,/already closed/);
  const wrong=await tool.execute("wrong",{location:".ralph/plans/future/beta"},undefined,undefined,f.ctx);assert.equal(wrong.isError,true);assert.match(wrong.content[0].text,/No exact oversight marker/);
  const newer={...identity,episodeId:"44444444-4444-4444-8444-444444444444",episodeActiveSessionId:"new-route"};writeFileSync(identityPath,JSON.stringify(newer));
  f.entries.push({type:"custom",customType:"prime-claw-conversation-oversight",data:{...f.entries.findLast(entry=>entry.customType==="prime-claw-conversation-oversight").data,status:"active",episodeId:newer.episodeId}});
  const stale=await tool.execute("stale-old-close",{location:LOCATION},undefined,undefined,f.ctx);assert.equal(stale.isError,true);assert.match(stale.content[0].text,/multiple oversight generations/);assert.equal(JSON.parse(readFileSync(identityPath,"utf8")).episodeId,newer.episodeId);assert.equal(f.entries.at(-1).data.status,"active");
});

test("registered actual handoff reopen refresh preserves ordinary owner oversight", async (t) => {
  const cwd=realpathSync(mkdtempSync(join(tmpdir(),"prime-claw-reviewed-plan-route-")));t.after(()=>rmSync(cwd,{recursive:true,force:true}));
  mkdirSync(join(cwd,LOCATION),{recursive:true});writeSkill(cwd,"---\nname: oversee-episode\ndescription: test package\n---\nprocedure","oversee-episode");
  const slug="alpha-plan",worktree=resolve(dirname(cwd),`${basename(cwd)}-${slug}-episode`);t.after(()=>rmSync(worktree,{recursive:true,force:true}));mkdirSync(worktree,{recursive:true});writeSkill(worktree,"handoff","handoff");writeSkill(worktree,"execute","execute");
  const state=join(cwd,".prime/agent/state/spec-episodes");mkdirSync(state,{recursive:true});let identity={version:2,slug,sourceLocation:LOCATION,ownerSessionId:"owner-session",episodeId:"33333333-3333-4333-8333-333333333333",episodeActiveSessionId:"old-route",episodeSessionFile:join(cwd,"episode.jsonl"),branch:`episode/${slug}`,worktree,sessionName:`${slug}-episode`,bootstrapAdmission:"delivered"};const identityPath=join(state,`${slug}.json`);writeFileSync(identityPath,JSON.stringify(identity));
  const publisher={async list(){return[{sessionId:identity.episodeId,sessionFile:identity.episodeSessionFile,sessionName:identity.sessionName,cwd:worktree,isSessionActive:false}]},async reopen(){return{activeSessionId:"new-route",sessionId:identity.episodeId,sessionFile:identity.episodeSessionFile}},async getState(){return{activeSessionId:"new-route",sessionId:identity.episodeId,sessionFile:identity.episodeSessionFile,sessionName:identity.sessionName,cwd:worktree,isSessionActive:false,isStreaming:false,isCompacting:false,isBashRunning:false,isRunningTools:false,hasRunningRlmChildren:false,unfinishedActionCount:0,sessionActions:{queuedCount:0,steering:[],followUps:[]}}},async deliverHandoff(){},close(){}};
  const dependencies={git:{repositoryRoot(){return cwd},hasBranch(){return true},worktrees(){return[{path:worktree,branch:identity.branch}]}},filesystem:{readIdentity(){return identity},writeIdentity(_path,value){identity=value;writeFileSync(identityPath,JSON.stringify(value))},exists(){return true}},publisher};
  const f=createHarness(cwd,createReviewedPlanExtension(dependencies));f.entries.push({type:"custom",customType:"prime-claw-conversation-oversight",data:{markerVersion:2,status:"active",ownerSessionId:"owner-session",slug,sourceLocation:LOCATION,episodeId:identity.episodeId,episodeSessionFile:identity.episodeSessionFile,branch:identity.branch,worktree,sessionName:identity.sessionName,identityVersion:2,admission:"delivered"}});
  const result=await f.tools.get("handoff_spec_episode").execute("handoff",{location:LOCATION,guidance:""},undefined,undefined,f.ctx);assert.equal(result.isError,undefined);assert.equal(identity.episodeActiveSessionId,"new-route");const context=await f.events.get("context")({messages:[]},f.ctx);assert.equal(context.messages.filter(m=>m.customType==="prime-claw-oversee-episode-package").length,1);
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

test("fresh native implement-spec runs can sequentially arm different reviewed folders for the same owner", async (t) => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-reviewed-plan-auth-")));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, LOCATION), { recursive: true });
  writeSkill(cwd, "implementation readiness", "implement-spec");
  writeSkill(cwd, "---\nname: oversee-episode\ndescription: test package\n---\ncanonical oversight", "oversee-episode");
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
  const authorized = await tool.execute("call-2", { location: LOCATION }, undefined, undefined, f.ctx);
  assert.equal(authorized.isError, true);
  assert.match(authorized.content[0].text, /authorized tool reached host capability/);

  const consumed = await tool.execute("call-3", { location: LOCATION }, undefined, undefined, f.ctx);
  assert.match(consumed.content[0].text, /no matching active \/implement-spec approval/);

  const betaLocation = ".ralph/plans/future/beta-plan";
  mkdirSync(join(cwd, betaLocation), { recursive: true });
  await f.commands.get("implement-spec").handler(betaLocation, f.ctx);
  const laterAuthorized = await tool.execute("call-4", { location: betaLocation }, undefined, undefined, f.ctx);
  assert.equal(laterAuthorized.isError, true);
  assert.match(laterAuthorized.content[0].text, /authorized tool reached host capability/);
  const laterConsumed = await tool.execute("call-5", { location: betaLocation }, undefined, undefined, f.ctx);
  assert.match(laterConsumed.content[0].text, /no matching active \/implement-spec approval/);
});
