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
    setup.write_text(r"""import{mkdirSync,writeFileSync}from"node:fs";import{dirname,join}from"node:path";export default function s(pi){pi.on("session_start",(_e,ctx)=>{const id=ctx.sessionManager.getSessionId(),path=join(ctx.cwd,".prime-claw/ownership.json");mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify({version:1,status:"active",operationId:"op",engine:"local",ownerSessionId:id,sourceLocation:".ralph/plans/future/alpha",slug:"alpha",baseRef:"base",bundleDigest:"0000000000000000000000000000000000000000000000000000000000000000",createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-01T00:00:00Z",worktree:join(ctx.cwd,"episode"),branch:"actual",head:"head",episodeId:"episode",episodeSessionFile:join(ctx.cwd,"episode.jsonl"),episodeActiveSessionId:"route"}))})}""")
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
