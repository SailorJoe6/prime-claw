"""Linux-authoritative native proof for post-compaction Conversation guidance."""
import json
from pathlib import Path

WS_EXT = "/workspace/src/prime-agent-plugin/extensions/reviewed-plan.ts"


def _outer_provider(path: Path):
    path.write_text(r"""import {createAssistantMessageEventStream}from"@earendil-works/pi-ai";export default function p(pi){pi.registerProvider("outer",{baseUrl:"x",apiKey:"x",api:"outer",streamSimple(model){const s=createAssistantMessageEventStream();queueMicrotask(()=>{const m={role:"assistant",content:[{type:"text",text:"ok"}],api:model.api,provider:model.provider,model:model.id,usage:{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:"stop",timestamp:Date.now()};s.push({type:"start",partial:m});s.push({type:"done",reason:"stop",message:m});s.end()});return s},models:[{id:"m",name:"M",reasoning:false,input:["text"],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:10000,maxTokens:1000}]})}""")


def test_native_actual_compaction_reinjects_one_full_nonturn_guide(tier1_container, ctmp):
    project = ctmp / "project"
    project.mkdir()
    initialized = tier1_container.run("git", "-C", str(project), "init", "-q", workdir=None)
    assert initialized.returncode == 0, initialized.stderr
    agent = ctmp / "agent"
    agent.mkdir()
    records = ctmp / "records.jsonl"
    result = ctmp / "result.json"
    provider = ctmp / "provider.ts"
    provider.write_text(rf"""import{{appendFileSync}}from"node:fs";import{{createAssistantMessageEventStream}}from"@earendil-works/pi-ai";const p={json.dumps(str(records))};export default function x(pi){{pi.registerProvider("poc",{{baseUrl:"x",apiKey:"x",api:"poc",streamSimple(model,context){{const messages=context.messages??[],all=JSON.stringify(messages),guideCount=(all.match(/# Oversee one owned episode/g)||[]).length;appendFileSync(p,JSON.stringify({{after:all.includes("AFTER_COMPACTION"),guideCount,fullGuide:all.includes("# Oversee one owned episode"),goalsSkillCopies:(all.match(/name: goals-and-heartbeats/g)||[]).length}})+"\n");const s=createAssistantMessageEventStream();queueMicrotask(()=>{{const m={{role:"assistant",content:[{{type:"text",text:"ok"}}],api:model.api,provider:model.provider,model:model.id,usage:{{input:Math.ceil(all.length/4),output:1,cacheRead:0,cacheWrite:0,totalTokens:Math.ceil(all.length/4)+1,cost:{{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}}},stopReason:"stop",timestamp:Date.now()}};s.push({{type:"start",partial:m}});s.push({{type:"done",reason:"stop",message:m}});s.end()}});return s}},models:[{{id:"m",name:"M",reasoning:false,input:["text"],cost:{{input:0,output:0,cacheRead:0,cacheWrite:0}},contextWindow:100000,maxTokens:1000}}]}})}}""")
    setup = ctmp / "setup.ts"
    setup.write_text(r"""import{mkdirSync,writeFileSync}from"node:fs";import{dirname,join}from"node:path";export default function s(pi){pi.on("session_start",(_e,ctx)=>{const id=ctx.sessionManager.getSessionId(),wt=join(ctx.cwd,"episode"),plans=join(wt,".ralph/plans"),path=join(ctx.cwd,".prime-claw/ownership.json");mkdirSync(plans,{recursive:true});writeFileSync(join(plans,"SPECIFICATION.md"),"spec\n");writeFileSync(join(plans,"EXECUTION_PLAN.md"),"plan\n");mkdirSync(dirname(path),{recursive:true});writeFileSync(join(dirname(path),"legacy-specifications.json"),JSON.stringify({schemaVersion:1,specifications:[{location:".ralph/plans/future/alpha",specificationSha256:"3b92cc255009c1a8541990fd00bcde181bc803a80b234f086647210c078bb7e4"}]}));writeFileSync(path,JSON.stringify({version:1,status:"active",operationId:"op",engine:"local",ownerSessionId:id,sourceLocation:".ralph/plans/future/alpha",slug:"alpha",baseRef:"base",bundleDigest:"0000000000000000000000000000000000000000000000000000000000000000",createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-01T00:00:00Z",worktree:wt,branch:"actual",head:"head",episodeId:"episode",episodeSessionFile:join(ctx.cwd,"episode.jsonl"),episodeActiveSessionId:"route"}))})}""")
    driver = ctmp / "driver.ts"
    driver.write_text(rf"""import{{writeFileSync}}from"node:fs";import{{createAgentSessionServices,createAgentSessionFromServices,SessionManager}}from"@earendil-works/pi-coding-agent";const cwd={json.dumps(str(project))},agentDir={json.dumps(str(agent))},provider={json.dumps(str(provider))},setup={json.dumps(str(setup))},ext={json.dumps(WS_EXT)},result={json.dumps(str(result))};export default function d(pi){{pi.on("session_start",async()=>{{let session;try{{const services=await createAgentSessionServices({{cwd,agentDir,noBuiltinHerdrReporter:true,telemetryDisabled:true,resourceLoaderOptions:{{additionalExtensionPaths:[provider,setup,ext],noExtensions:true,noSkills:true,noPromptTemplates:true,noContextFiles:true,noThemes:true}}}});const model=services.modelRegistry.find("poc","m"),made=await createAgentSessionFromServices({{services,sessionManager:SessionManager.inMemory(cwd),model,thinkingLevel:"off",noTools:true,prewarmIpythonKernel:false,telemetryDisabled:true}});session=made.session;await session.bindExtensions({{}});for(let i=0;i<4;i+=1)await session.prompt(`BEFORE_${{i}} `+"x".repeat(30000));await session.compact("native oversight proof");await session.prompt("AFTER_COMPACTION");writeFileSync(result,JSON.stringify({{ok:true}}))}}catch(e){{writeFileSync(result,JSON.stringify({{error:String(e),stack:e?.stack}}))}}finally{{await session?.disposeAsync()}}}})}}""")
    outer = ctmp / "outer.ts"
    _outer_provider(outer)
    completed = tier1_container.run("/workspace/scripts/run-prime-agent-probe.sh", tier1_container.prime_agent, "--mode", "text", "--offline", "--no-session", "--no-skills", "--no-prompt-templates", "--no-context-files", "--no-extensions", "--cwd", str(project), "-e", str(outer), "-e", str(driver), "--provider", "outer", "--model", "m", "-p", "outer", timeout=60)
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert json.loads(result.read_text()) == {"ok": True}
    rows = [json.loads(line) for line in records.read_text().splitlines()]
    after = [row for row in rows if row["after"]]
    assert after, rows
    assert after[0]["guideCount"] == 1
    assert after[0]["fullGuide"] is True
    assert after[0]["goalsSkillCopies"] == 0


DEPS_PROBE_TEMPLATE = r"""import { readFileSync, appendFileSync } from "node:fs";
import { createReviewedPlanExtension } from __WS_EXT__;
const recordPath = __RECORD__;
const reportPath = __REPORT__;
const holder = (globalThis.__primeClawProbe = globalThis.__primeClawProbe || { session: null });
const record = () => JSON.parse(readFileSync(recordPath, "utf8"));
const ownership = { read(_root, owner) { const r = record(); return !owner || r.ownerSessionId === owner ? r : null; }, write() {} };
const git = { repositoryRoot: (cwd) => cwd, head: () => "head", branch: () => "main", worktrees: () => [{ path: record().worktree, branch: "actual" }], createWorktree() {}, assertCleanWorktree() {}, pathStatus: () => "clean", commitPromotion: () => "c" };
const filesystem = { exists: () => true, hasActiveLegacyPlanFiles: () => true, promoteBundle() {} };
const sessionSummary = () => ({ id: "runtime", sessionId: record().episodeId, sessionFile: record().episodeSessionFile, activeSessionId: "route", cwd: record().worktree, isSessionActive: false, isStreaming: false, isCompacting: false, queuedCount: 0 });
const idleState = () => ({ activeSessionId: "route", sessionId: record().episodeId, sessionFile: record().episodeSessionFile, isSessionActive: false, isStreaming: false, isCompacting: false, isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false, unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [], active: null } });
const publisher = { async list() { return [sessionSummary()]; }, async getState() { return idleState(); }, async createFresh() { throw new Error("unexpected"); }, async reopen() { throw new Error("unexpected"); }, async deliverExecute() {}, async deliverHandoff() {}, close() {} };
const deps = { ownership, git, filesystem, publisher, guideRoot: __GUIDE__ };
export default function wrapper(pi) {
  createReviewedPlanExtension(deps)(pi);
  pi.on("tool_execution_end", (event) => {
    appendFileSync(reportPath, JSON.stringify({ marker: "tool-end", name: event.toolName, isError: event.isError, text: JSON.stringify(event.result ?? null) }) + "\n");
  });
  pi.on("session_compact", (event) => {
    appendFileSync(reportPath, JSON.stringify({ marker: "session_compact", fromExtension: event.fromExtension === true, hasEntry: !!event.compactionEntry }) + "\n");
  });
}
"""

SETUP_PROBE_TEMPLATE = r"""import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const recordPath = __RECORD__;
export default function s(pi) { pi.on("session_start", (_e, ctx) => {
  const id = ctx.sessionManager.getSessionId();
  const wt = join(ctx.cwd, "episode");
  const plans = join(wt, ".ralph/plans");
  mkdirSync(plans, { recursive: true });
  writeFileSync(join(plans, "SPECIFICATION.md"), "spec\n");
  writeFileSync(join(plans, "EXECUTION_PLAN.md"), "plan\n");
  const wtwf = join(wt, ".prime-claw/workflows");
  mkdirSync(wtwf, { recursive: true });
  writeFileSync(join(wtwf, "handoff.md"), "HANDOFF POLICY\n");
  const wtex = join(wt, ".agents/skills/execute");
  mkdirSync(wtex, { recursive: true });
  writeFileSync(join(wtex, "SKILL.md"), "EXECUTE POLICY\n");
  const record = { version: 1, status: "active", operationId: "op", engine: "local", ownerSessionId: id, sourceLocation: ".ralph/plans/future/alpha", slug: "alpha", baseRef: "base", bundleDigest: "0".repeat(64), createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", worktree: wt, branch: "actual", head: "head", episodeId: "episode", episodeSessionFile: join(ctx.cwd, "episode.jsonl"), episodeActiveSessionId: "route" };
  writeFileSync(recordPath, JSON.stringify(record));
  const pc = join(ctx.cwd, ".prime-claw");
  mkdirSync(pc, { recursive: true });
  writeFileSync(join(pc, "legacy-specifications.json"), JSON.stringify({ schemaVersion: 1, specifications: [{ location: record.sourceLocation, specificationSha256: "3b92cc255009c1a8541990fd00bcde181bc803a80b234f086647210c078bb7e4" }] }));
  writeFileSync(join(pc, "ownership.json"), JSON.stringify(record));
}); }
"""

PROVIDER_PROBE_TEMPLATE = r"""import { appendFileSync } from "node:fs";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
const p = __RECORDS__;
let handoffCalls = 0;
let compactCalls = 0;
const COMPACT_CODE = "probe_compact_result = await compact.run('PROBE_COMPACT_HINT'); print('PROBE_COMPACT_RESULT', probe_compact_result)";
export default function x(pi) { pi.registerProvider("poc", { baseUrl: "x", apiKey: "x", api: "poc", streamSimple(model, context) {
  const messages = context.messages ?? [], all = JSON.stringify(messages);
  const toolResults = messages.filter((m) => m.role === "toolResult");
  const handoffResults = toolResults.filter((m) => m.toolName === "handoff_spec_episode").length;
  const ipythonResults = toolResults.filter((m) => m.toolName === "ipython").length;
  const triggers = messages.filter((m) => m.role === "user" && JSON.stringify(m).includes("HANDOFF_TRIGGER")).length;
  const check = all.includes("POST_COMPACT_CHECK");
  const sawSteer = all.includes("AFTER-HANDOFF POLICY");
  const sawCompactResult = all.includes("PROBE_COMPACT_RESULT");
  // High utilization (95%) only inside the first handoff tool execution so the
  // post-admission check steers; every other call reports low usage so no
  // native auto-compaction fires and exactly one compaction cycle occurs.
  const high = handoffResults === 0 && triggers === 1 && handoffCalls === 0;
  const inputTokens = high ? 190000 : 100;
  appendFileSync(p, JSON.stringify({ handoffResults, ipythonResults, sawSteer, sawCompactResult, guideCopies: (all.match(/# Oversee one owned episode/g) || []).length, bytes: all.length, check, high }) + "\n");
  const s = createAssistantMessageEventStream();
  queueMicrotask(() => {
    const usage = { input: inputTokens, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: inputTokens + 1, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
    let m;
    if (triggers > 0 && handoffResults === handoffCalls && handoffCalls === 0) {
      handoffCalls += 1;
      const tc = { type: "toolCall", id: "tc-handoff", name: "handoff_spec_episode", arguments: { location: ".ralph/plans/future/alpha" } };
      m = { role: "assistant", content: [tc], api: model.api, provider: model.provider, model: model.id, usage, stopReason: "toolUse", timestamp: Date.now() };
      s.push({ type: "start", partial: m });
      s.push({ type: "toolcall_start", contentIndex: 0, partial: m });
      s.push({ type: "toolcall_end", contentIndex: 0, toolCall: tc, partial: m });
      s.push({ type: "done", reason: "toolUse", message: m });
    } else if (handoffResults > 0 && sawSteer && ipythonResults === compactCalls && compactCalls === 0 && !check) {
      // Model-side compact.run: after observing the steered workflow
      // instructions, the assistant invokes the installed compact skill
      // through a real ipython tool call, the same kernel path a real model
      // uses. The kernel host bridge converts compact.run into the session
      // host request while the turn is still active.
      compactCalls += 1;
      const tc = { type: "toolCall", id: "tc-compact", name: "ipython", arguments: { code: COMPACT_CODE } };
      m = { role: "assistant", content: [tc], api: model.api, provider: model.provider, model: model.id, usage, stopReason: "toolUse", timestamp: Date.now() };
      s.push({ type: "start", partial: m });
      s.push({ type: "toolcall_start", contentIndex: 0, partial: m });
      s.push({ type: "toolcall_end", contentIndex: 0, toolCall: tc, partial: m });
      s.push({ type: "done", reason: "toolUse", message: m });
    } else {
      m = { role: "assistant", content: [{ type: "text", text: "ok" }], api: model.api, provider: model.provider, model: model.id, usage, stopReason: "stop", timestamp: Date.now() };
      s.push({ type: "start", partial: m });
      s.push({ type: "done", reason: "stop", message: m });
    }
    s.end();
  });
  return s;
}, models: [{ id: "m", name: "M", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 1000 }] }); }
"""

DRIVER_PROBE_TEMPLATE = r"""import { existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { createAgentSessionServices, createAgentSessionFromServices, SessionManager } from "@earendil-works/pi-coding-agent";
const cwd = __CWD__, agentDir = __AGENT__, provider = __PROVIDER__, setup = __SETUP__, depsExt = __DEPS__, result = __RESULT__;
// The bundled compact skill must be model- and kernel-visible even with
// noSkills:true so the provider can invoke the real `compact` python module
// through the ipython tool (the model-side compact.run path).
const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
const compactCandidates = [join(globalRoot, "prime-agent", "dist", "skills", "compact"), join(globalRoot, "prime-agent", "skills", "compact")];
const compactSkillDir = compactCandidates.find((p) => existsSync(join(p, "SKILL.md")));
if (!compactSkillDir) throw new Error("bundled compact skill not found under " + globalRoot);
export default function d(pi) { pi.on("session_start", async () => { let session; try {
  const services = await createAgentSessionServices({ cwd, agentDir, noBuiltinHerdrReporter: true, telemetryDisabled: true, resourceLoaderOptions: { additionalExtensionPaths: [provider, setup, depsExt], additionalSkillPaths: [compactSkillDir], noExtensions: true, noSkills: true, noPromptTemplates: true, noContextFiles: true, noThemes: true } });
  const rl = services.resourceLoader;
  const loaded = rl.getExtensions();
  const model = services.modelRegistry.find("poc", "m");
  const made = await createAgentSessionFromServices({ services, sessionManager: SessionManager.inMemory(cwd), model, thinkingLevel: "off", prewarmIpythonKernel: false, telemetryDisabled: true, includeCompactSkill: true });
  session = made.session;
  globalThis.__primeClawProbe = globalThis.__primeClawProbe || {};
  globalThis.__primeClawProbe.session = session;
  await session.bindExtensions({});
  session.setActiveToolsByName(["ipython", "handoff_spec_episode"]);
  for (let i = 0; i < 4; i += 1) await session.prompt(`PAD_${i} ` + "x".repeat(30000));
  await session.prompt("HANDOFF_TRIGGER");
  for (let tries = 0; tries < 200; tries += 1) {
    await new Promise((r) => setTimeout(r, 100));
    if (!session.isStreaming && !session.isCompacting && session.getContextUsage()) break;
  }
  await session.prompt("POST_COMPACT_CHECK");
  for (let tries = 0; tries < 200; tries += 1) {
    await new Promise((r) => setTimeout(r, 100));
    if (!session.isStreaming && !session.isCompacting) break;
  }
  writeFileSync(result, JSON.stringify({ ok: true, extErrors: loaded.errors, extCount: loaded.extensions.length }));
} catch (e) { writeFileSync(result, JSON.stringify({ error: String(e), stack: e?.stack })); } finally { await session?.disposeAsync(); } }); }
"""


def _probe_deps_source(record_path: str, guide_root: str, report_path: str) -> str:
    """Deps-injected reviewed-plan extension with a fake version-1 Episode
    transport: in-memory ownership/git/filesystem/publisher fakes admit the
    handoff without any live worker, Orca, or Git state. The real extension
    code, the real steer transport, real getContextUsage(), and the real
    post-compaction oversight hook stay under test."""
    return (
        DEPS_PROBE_TEMPLATE
        .replace("__WS_EXT__", json.dumps(WS_EXT))
        .replace("__RECORD__", json.dumps(record_path))
        .replace("__REPORT__", json.dumps(report_path))
        .replace("__GUIDE__", json.dumps(guide_root))
    )


def test_native_handoff_compaction_end_to_end(tier1_container, ctmp):
    """Native Docker proof: successful handoff -> workflow steer during the
    tool turn -> model-side compact.run before turn end -> actual
    turn-boundary compaction -> unchanged same-Episode oversight restoration.

    The scripted provider issues a real handoff_spec_episode tool call during
    a genuine turn. The deps-injected extension performs its real
    post-admission compaction check against real ctx.getContextUsage() (the
    provider reports 190000 tokens against a 200000-token window (95%),
    strictly above the fixture's 50% threshold) and steers the real project
    workflow. The scripted provider then plays the model-side path: after
    observing the steered workflow instructions in context, it emits a real
    ipython tool call that awaits compact.run from the installed compact
    skill (the same kernel host-bridge path a real model uses), the session
    accepts the request while the turn is still active, and the native
    session performs the real turn-boundary compaction that fires the
    unchanged oversight hook.
    """
    project = ctmp / "project"
    project.mkdir()
    initialized = tier1_container.run("git", "-C", str(project), "init", "-q", workdir=None)
    assert initialized.returncode == 0, initialized.stderr
    agent = ctmp / "agent"
    agent.mkdir()
    records = ctmp / "records.jsonl"
    report = ctmp / "report.jsonl"
    result = ctmp / "result.json"

    # Fixture policy: 0.5 (50%) threshold; the provider reports 190000/200000
    # (95%) during the handoff turn, strictly exceeding it. The scripted usage
    # report also trips NATIVE auto-compaction at that turn boundary, so this
    # fixture legitimately produces two compactions: the native one at the
    # handoff-turn boundary, plus the requested compact.run at the tool-turn
    # boundary. Real message sizes stay small, so no unintended compaction
    # fires during the padding prompts.
    workflow_dir = project / ".prime-claw" / "workflows"
    workflow_dir.mkdir(parents=True)
    (workflow_dir / "conversation-after-handoff.md").write_text(
        "---\nname: conversation-after-handoff\nthreshold_percent: 0.5\n---\nAFTER-HANDOFF POLICY\n"
    )
    guide_root = ctmp / "plugin"
    guide_skill = guide_root / "skills" / "prime-claw-oversee-episode"
    guide_skill.mkdir(parents=True)
    (guide_skill / "SKILL.md").write_text("# Oversee one owned episode\nPROBE GUIDE MARKER\n")

    record_path = ctmp / "ownership-record.json"
    setup = ctmp / "setup.ts"
    setup.write_text(SETUP_PROBE_TEMPLATE.replace("__RECORD__", json.dumps(str(record_path))))
    provider = ctmp / "provider.ts"
    provider.write_text(PROVIDER_PROBE_TEMPLATE.replace("__RECORDS__", json.dumps(str(records))))
    deps_ext = ctmp / "reviewed-plan-deps.ts"
    deps_ext.write_text(_probe_deps_source(str(record_path), str(guide_root), str(report)))
    driver = ctmp / "driver.ts"
    driver.write_text(
        DRIVER_PROBE_TEMPLATE
        .replace("__CWD__", json.dumps(str(project)))
        .replace("__AGENT__", json.dumps(str(agent)))
        .replace("__PROVIDER__", json.dumps(str(provider)))
        .replace("__SETUP__", json.dumps(str(setup)))
        .replace("__DEPS__", json.dumps(str(deps_ext)))
        .replace("__RESULT__", json.dumps(str(result)))
    )
    outer = ctmp / "outer.ts"
    _outer_provider(outer)
    completed = tier1_container.run(
        "/workspace/scripts/run-prime-agent-probe.sh", tier1_container.prime_agent,
        "--mode", "text", "--offline", "--no-session", "--no-skills",
        "--no-prompt-templates", "--no-context-files", "--no-extensions",
        "--cwd", str(project), "-e", str(outer), "-e", str(driver),
        "--provider", "outer", "--model", "m", "-p", "outer", timeout=120,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    result_payload = json.loads(result.read_text())
    assert result_payload["ok"] is True, result_payload
    assert result_payload["extErrors"] == [], result_payload

    # The handoff tool ran, and the extension's post-admission compaction check
    # steered the workflow into the SAME tool turn: the provider's next call
    # observed the tool result AND the steered policy before the turn ended.
    rows = [json.loads(line) for line in records.read_text().splitlines()]
    entries = [json.loads(line) for line in report.read_text().splitlines()]
    admission = [entry for entry in entries if entry.get("marker") == "tool-end" and entry.get("name") == "handoff_spec_episode"]
    assert len(admission) == 1 and admission[0]["isError"] is False, admission
    after_handoff_index = next(i for i, row in enumerate(rows) if row["handoffResults"] > 0)
    assert rows[after_handoff_index]["sawSteer"] is True, rows
    # Exactly one handoff tool execution ran: one dispatch, no retry. Its
    # details record the prompt-delivered compaction workflow outcome.
    tool_ends = [entry for entry in entries if entry.get("marker") == "tool-end"]
    handoff_ends = [entry for entry in tool_ends if entry.get("name") == "handoff_spec_episode"]
    assert len(handoff_ends) == 1, entries
    handoff_result = json.loads(handoff_ends[0]["text"])
    assert "Episode handoff admitted" in handoff_ends[0]["text"], handoff_ends
    compaction_details = handoff_result["details"]["conversationCompaction"]
    assert compaction_details["outcome"] == "prompt-delivered", handoff_result

    # Model-side compact.run: exactly one ipython tool execution ran, and its
    # result records that the installed compact skill's host request was
    # accepted mid-turn (scheduled: true is a request, not confirmation).
    ipython_ends = [entry for entry in tool_ends if entry.get("name") == "ipython"]
    assert len(ipython_ends) == 1, entries
    assert ipython_ends[0]["isError"] is False, ipython_ends
    assert "'scheduled': True" in ipython_ends[0]["text"] or '"scheduled": true' in ipython_ends[0]["text"], ipython_ends
    # The provider's next call observed the compact.run result in context.
    assert any(row["sawCompactResult"] for row in rows[after_handoff_index + 1:]), rows

    # Compaction actually ran: session_compact fired once per turn boundary
    # where compaction was due (native auto-compaction fires at the handoff
    # boundary because the feature requires 95% reported usage there; the
    # model-side compact.run request above was accepted before the tool-turn
    # boundary and produced the second). Assert at least the two expected
    # real compactions, and that a later provider call observed the smaller
    # summarized post-compaction context.
    compact_events = [entry for entry in entries if entry.get("marker") == "session_compact"]
    assert len(compact_events) >= 2, entries
    assert all(event["hasEntry"] for event in compact_events), entries
    trigger_index = next(i for i, row in enumerate(rows) if row.get("high"))
    post_compaction = [row for row in rows[trigger_index + 1:] if row["bytes"] < 40000]
    assert post_compaction, rows

    # Unchanged same-Episode oversight restoration: the pre-compaction
    # continuation carried exactly one guide-title occurrence; every
    # post-compaction call carries exactly one MORE - the single fresh
    # reinjection for the exact active owner. The counts alone do not
    # identify what the pre-existing occurrence is; only the +1 delta and
    # its stability are asserted. No accumulation across later prompts.
    pre_compact = rows[after_handoff_index]
    assert pre_compact["guideCopies"] == 1, rows
    post_rows = [row for row in rows[after_handoff_index + 1:] if row["handoffResults"] > 0]
    assert post_rows, rows
    assert all(row["guideCopies"] == pre_compact["guideCopies"] + 1 for row in post_rows), rows
    # The final ordinary check prompt after the settled compactions still
    # carries exactly the pre-compaction count plus one fresh reinjection,
    # with no accumulation across prompts.
    final_check = [row for row in rows if row["check"]]
    assert final_check and final_check[-1]["guideCopies"] == pre_compact["guideCopies"] + 1, rows
