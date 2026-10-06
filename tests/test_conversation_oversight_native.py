"""Tier-1 native oversight tests: both tests drive a real prime-agent INSIDE
the session's tier-1 container via the `tier1_container` fixture
(auto-marked `container`; see tests/conftest.py). The repo is bind-mounted
read-only at /workspace; test scratch lives on the same-path session share
(ctmp). Tier-1 test code never references host paths or host binaries.
"""

import json
from pathlib import Path

from provider_context_assertions import (
    LEGACY_PACKAGE_SENTINEL,
    assert_provider_context_clean,
    provider_capture_expression,
)

WS_EXT = "/workspace/src/prime-agent-plugin/extensions/reviewed-plan.ts"
WS_KERNEL = "src/prime-agent-plugin/ROLE_KERNEL.md"

def _outer_provider(path:Path):
 path.write_text(r"""import {createAssistantMessageEventStream}from"@earendil-works/pi-ai";export default function p(pi){pi.registerProvider("outer",{baseUrl:"x",apiKey:"x",api:"outer",streamSimple(model){const s=createAssistantMessageEventStream();queueMicrotask(()=>{const m={role:"assistant",content:[{type:"text",text:"ok"}],api:model.api,provider:model.provider,model:model.id,usage:{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:"stop",timestamp:Date.now()};s.push({type:"start",partial:m});s.push({type:"done",reason:"stop",message:m});s.end()});return s},models:[{id:"m",name:"M",reasoning:false,input:["text"],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:10000,maxTokens:1000}]})}""")

def test_native_run_paths_and_real_child_precedence(tier1_container, ctmp):
 project=ctmp/"project";(project/".prime/agent").mkdir(parents=True);(project/".prime/agent/APPEND_SYSTEM.md").write_text(tier1_container.read_repo(WS_KERNEL));assert not (project/".ralph/skills/oversee-episode/SKILL.md").exists()
 agent=ctmp/"agent";agent.mkdir();records=ctmp/"records.jsonl";result=ctmp/"result.json"
 provider=ctmp/"provider.ts";provider.write_text(rf"""import {{appendFileSync}}from"node:fs";import{{createAssistantMessageEventStream}}from"@earendil-works/pi-ai";const p={json.dumps(str(records))};let tool=false,retry=false;function rec(x){{appendFileSync(p,JSON.stringify(x)+"\n")}}function msg(model,c,reason="stop"){{return{{role:"assistant",content:c,api:model.api,provider:model.provider,model:model.id,usage:{{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}}},stopReason:reason,timestamp:Date.now()}}}}export default function x(pi){{pi.registerCommand("custom",{{description:"poc",handler:async()=>pi.sendMessage({{customType:"poc",content:"CUSTOM",display:true}},{{triggerTurn:true}})}});pi.registerTool({{name:"poc_tool",label:"POC",description:"poc",executionMode:"sequential",parameters:{{type:"object",properties:{{}},additionalProperties:false}},async execute(){{return{{content:[{{type:"text",text:"ok"}}],details:{{}}}}}}}});pi.registerProvider("poc",{{baseUrl:"x",apiKey:"x",api:"poc",streamSimple(model,context){{const messages=context.messages??[],all=JSON.stringify(messages),capture={provider_capture_expression()};rec({{kind:"provider",kernel:context.systemPrompt.split("PRIME_CLAW_ROLE_KERNEL_V1").length-1,...capture,depth1:context.systemPrompt.includes("Recursive agent depth: 1"),retryAlreadyInjected:retry,routes:{{normal:all.includes("NORMAL"),custom:all.includes("CUSTOM"),heartbeat:all.includes("HEARTBEAT"),agentIdle:all.includes("AGENT_MESSAGE"),agentQueued:all.includes("QUEUED_AGENT_MESSAGE"),followup:all.includes("FOLLOWUP"),recovered:all.includes("RECOVERED_QUEUE") ,retry:all.includes("RETRY"),tool:all.includes("TOOL"),toolResult:messages.some(m=>m.role==="toolResult"&&m.toolName==="poc_tool")}},tail:all.slice(-120)}});const s=createAssistantMessageEventStream();const done=()=>{{if(all.includes("RETRY")&&!retry){{retry=true;const m=msg(model,[],"error");m.errorMessage="transient retry probe";s.push({{type:"error",reason:"error",error:m}});s.end();return}}if(all.includes("TOOL")&&!tool){{tool=true;const tc={{type:"toolCall",id:"t",name:"poc_tool",arguments:{{}}}},m=msg(model,[tc],"toolUse");s.push({{type:"start",partial:m}});s.push({{type:"toolcall_start",contentIndex:0,partial:m}});s.push({{type:"toolcall_end",contentIndex:0,toolCall:tc,partial:m}});s.push({{type:"done",reason:"toolUse",message:m}});s.end();return}}const m=msg(model,[{{type:"text",text:"ok"}}]);s.push({{type:"start",partial:m}});s.push({{type:"done",reason:"stop",message:m}});s.end()}};if(all.includes("HOLD"))setTimeout(done,250);else queueMicrotask(done);return s}},models:[{{id:"m",name:"M",reasoning:false,input:["text"],cost:{{input:0,output:0,cacheRead:0,cacheWrite:0}},contextWindow:100000,maxTokens:1000}}]}})}}""")
 setup=ctmp/"setup.ts";setup.write_text(rf"""import{{mkdirSync,writeFileSync}}from"node:fs";import{{dirname,join}}from"node:path";export default function s(pi){{pi.on("session_start",(_e,ctx)=>{{if(ctx.getSystemPrompt().includes("Recursive agent depth: 1"))return;const id=ctx.sessionManager.getSessionId(),slug="alpha",worktree=join(ctx.cwd,"..",ctx.cwd.split("/").at(-1)+"-alpha-episode"),sessionFile=join(worktree,"episode.jsonl"),path=join(ctx.cwd,".prime/agent/state/spec-episodes/alpha.json");mkdirSync(dirname(path),{{recursive:true}});writeFileSync(path,JSON.stringify({{version:2,slug,sourceLocation:".ralph/plans/future/alpha",ownerSessionId:id,episodeId:"episode",episodeActiveSessionId:"active",episodeSessionFile:sessionFile,branch:"episode/alpha",worktree,sessionName:"alpha-episode",bootstrapAdmission:"delivered"}}));pi.appendEntry("prime-claw-conversation-oversight",{{markerVersion:2,status:"active",ownerSessionId:id,slug,sourceLocation:".ralph/plans/future/alpha",episodeId:"episode",episodeActiveSessionId:"active",episodeSessionFile:sessionFile,branch:"episode/alpha",worktree,sessionName:"alpha-episode",identityVersion:2,admission:"delivered"}})}})}}""")
 driver=ctmp/"driver.ts";driver.write_text(rf"""import{{writeFileSync}}from"node:fs";import{{join}}from"node:path";import{{createAgentSessionRuntime,createAgentSessionServices,createAgentSessionFromServices,SessionManager}}from"@earendil-works/pi-coding-agent";const cwd={json.dumps(str(project))},agentDir={json.dumps(str(agent))},provider={json.dumps(str(provider))},setup={json.dumps(str(setup))},ext={json.dumps(WS_EXT)},result={json.dumps(str(result))},legacyPackage={json.dumps(LEGACY_PACKAGE_SENTINEL)};const delay=ms=>new Promise(r=>setTimeout(r,ms));export default function d(pi){{pi.on("session_start",async()=>{{let runtime;try{{const make=async target=>{{const services=await createAgentSessionServices({{cwd:target.cwd,agentDir,noBuiltinHerdrReporter:true,telemetryDisabled:true,resourceLoaderOptions:{{additionalExtensionPaths:[provider,setup,ext],noExtensions:true,noSkills:true,noPromptTemplates:true,noContextFiles:true,noThemes:true}}}});const model=services.modelRegistry.find("poc","m");const made=await createAgentSessionFromServices({{services,sessionManager:target.sessionManager,sessionStartEvent:target.sessionStartEvent,model,thinkingLevel:"off",noTools:false,prewarmIpythonKernel:false,telemetryDisabled:true,...(target.sessionOptions??{{}})}});return{{...made,services,diagnostics:services.diagnostics}}}};runtime=await createAgentSessionRuntime(make,{{cwd,agentDir,sessionManager:SessionManager.inMemory(cwd)}});await runtime.session.bindExtensions({{}});await runtime.session.sendCustomMessage({{customType:"prime-claw-oversee-episode-package",content:legacyPackage,display:false}},{{triggerTurn:false}});await runtime.session.prompt("NORMAL");await runtime.session.prompt("/custom");await runtime.session.promptHeartbeat({{id:"hb",schedule:{{expression:"*/15 * * * *"}},runCount:1,status:"running",prompt:"HEARTBEAT"}});await runtime.session.acceptAgentMessagePrompt("AGENT_MESSAGE");await runtime.session.waitForSessionInputIdle();const heldAgent=runtime.session.prompt("HOLD QUEUED_AGENT");await delay(30);await runtime.session.acceptAgentMessagePrompt("QUEUED_AGENT_MESSAGE",{{streamingBehavior:"followUp",queueIfBusy:true}});await heldAgent;await runtime.session.waitForSessionInputIdle();const held=runtime.session.prompt("HOLD");await delay(30);await runtime.session.followUp("FOLLOWUP");await held;await runtime.session.waitForSessionInputIdle();const heldRecovery=runtime.session.prompt("HOLD RECOVERY");await delay(30);await runtime.session.followUp("RECOVERED_QUEUE");const recovery=runtime.session.getSessionActionRecoverySnapshot();runtime.session.clearQueue();await heldRecovery;await runtime.session.waitForSessionInputIdle();const restored=await runtime.session.restoreSessionActions(recovery);if(restored!==1)throw Error(`expected one recovered action, got ${{restored}}`);runtime.session.resumeQueuedWork();await runtime.session.waitForSessionInputIdle();const held2=runtime.session.prompt("HOLD CANCEL");await delay(30);await runtime.session.followUp("CANCELLED");runtime.session.clearQueue();await held2;await runtime.session.waitForSessionInputIdle();await runtime.session.prompt("RETRY");await runtime.session.waitForSessionInputIdle();await runtime.session.prompt("TOOL");writeFileSync(join(cwd,".prime/agent/APPEND_SYSTEM.md"),"INTENTIONAL CHILD SHADOW");const child=await runtime.createRlmSubagentRuntime({{id:"child",sessionName:"EXPERT",parentSession:runtime.session,sessionDir:join(agentDir,"child"),model:runtime.session.model,thinkingLevel:"off",scopedModels:[],activeToolNames:[],allowedToolNames:[],customTools:[],includeGoals:false,includeCompactSkill:false,rlmDepth:1,rlmMaxDepth:2,prompt:"bounded"}});await child.session.sendCustomMessage({{customType:"prime-claw-oversee-episode-package",content:legacyPackage,display:false}},{{triggerTurn:false}});await child.session.prompt("CHILD");writeFileSync(result,JSON.stringify({{ok:true}}))}}catch(e){{writeFileSync(result,JSON.stringify({{error:String(e),stack:e?.stack}}))}}finally{{await runtime?.dispose()}}}})}}""")
 outer=ctmp/"outer.ts";_outer_provider(outer)
 cp=tier1_container.run("prime-agent","--mode","text","--offline","--no-session","--no-skills","--no-prompt-templates","--no-context-files","--no-extensions","--cwd",str(project),"-e",str(outer),"-e",str(driver),"--provider","outer","--model","m","-p","outer",timeout=45)
 assert cp.returncode==0,cp.stdout+cp.stderr
 assert json.loads(result.read_text())=={"ok":True}
 rows=[json.loads(x) for x in records.read_text().splitlines()]
 parent=[r for r in rows if not r["depth1"]];child=[r for r in rows if r["depth1"]]
 assert len(parent) >= 15
 assert all(r["kernel"] == 1 for r in parent)
 for route in ("normal", "custom", "heartbeat", "agentIdle", "agentQueued", "followup", "recovered", "retry", "tool", "toolResult"):
  assert any(r["routes"][route] for r in parent), route
 retry_rows = [r for r in parent if r["routes"]["retry"]]
 assert any(not r["retryAlreadyInjected"] for r in retry_rows)
 assert any(r["retryAlreadyInjected"] for r in retry_rows)
 for row in parent:
  assert_provider_context_clean(row)
 assert len(child)==1 and child[0]["kernel"]==0
 assert_provider_context_clean(child[0])
 assert not any("CANCELLED" in r["tail"] for r in rows)



def test_native_selected_global_context_survives_project_prompt_and_context_shadows(
    tier1_container, ctmp,
):
    project = ctmp / "shadow-project"
    (project / ".prime/agent").mkdir(parents=True)
    (project / ".prime/agent/SYSTEM.md").write_text("PROJECT_SYSTEM_SHADOW")
    (project / ".prime/agent/APPEND_SYSTEM.md").write_text("PROJECT_APPEND_SHADOW")
    (project / "AGENTS.md").write_text("PROJECT_AGENTS_SHADOW")
    (project / "CLAUDE.md").write_text("PROJECT_CLAUDE_NOT_SELECTED")
    agent = ctmp / "shadow-agent"
    agent.mkdir()
    # The installer matrix proves all four selected-global spellings. Use the
    # lowest-priority spelling here so a higher-priority project AGENTS file,
    # project SYSTEM, and project APPEND all participate in one native proof.
    (agent / "CLAUDE.MD").write_text(tier1_container.read_repo(WS_KERNEL))
    records = ctmp / "shadow-records.jsonl"
    provider = ctmp / "shadow-provider.ts"
    provider.write_text(rf'''import {{appendFileSync}} from "node:fs";
import {{createAssistantMessageEventStream}} from "@earendil-works/pi-ai";
const records={json.dumps(str(records))};
export default function probe(pi){{pi.registerProvider("shadow",{{baseUrl:"x",apiKey:"x",api:"shadow",streamSimple(model,context){{
  const capture={provider_capture_expression()};
  appendFileSync(records,JSON.stringify({{...capture,kernel:(context.systemPrompt.match(/PRIME_CLAW_ROLE_KERNEL_V1/g)||[]).length,projectSystem:context.systemPrompt.includes("PROJECT_SYSTEM_SHADOW"),projectAppend:context.systemPrompt.includes("PROJECT_APPEND_SHADOW"),projectAgents:context.systemPrompt.includes("PROJECT_AGENTS_SHADOW"),unselectedClaude:context.systemPrompt.includes("PROJECT_CLAUDE_NOT_SELECTED")}})+"\n");
  const stream=createAssistantMessageEventStream();queueMicrotask(()=>{{const message={{role:"assistant",content:[{{type:"text",text:"ok"}}],api:model.api,provider:model.provider,model:model.id,usage:{{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}}},stopReason:"stop",timestamp:Date.now()}};stream.push({{type:"start",partial:message}});stream.push({{type:"done",reason:"stop",message}});stream.end()}});return stream;
}},models:[{{id:"m",name:"M",reasoning:false,input:["text"],cost:{{input:0,output:0,cacheRead:0,cacheWrite:0}},contextWindow:100000,maxTokens:1000}}]}})}}''')
    setup = ctmp / "shadow-setup.ts"
    setup.write_text(r'''import {mkdirSync,writeFileSync} from "node:fs";
import {basename,dirname,join,resolve} from "node:path";
export default function setup(pi){pi.on("session_start",(_event,ctx)=>{const slug="alpha",ownerSessionId=ctx.sessionManager.getSessionId(),worktree=resolve(dirname(ctx.cwd),`${basename(ctx.cwd)}-${slug}-episode`),identity={version:2,slug,sourceLocation:`.ralph/plans/future/${slug}`,ownerSessionId,episodeId:"11111111-1111-4111-8111-111111111111",episodeActiveSessionId:"active",episodeSessionFile:join(worktree,"episode.jsonl"),branch:`episode/${slug}`,worktree,sessionName:`${slug}-episode`,bootstrapAdmission:"delivered"};const root=join(ctx.cwd,".prime/agent/state/spec-episodes");mkdirSync(root,{recursive:true});writeFileSync(join(root,`${slug}.json`),JSON.stringify(identity));pi.appendEntry("prime-claw-conversation-oversight",{markerVersion:2,status:"active",ownerSessionId,slug,sourceLocation:identity.sourceLocation,episodeId:identity.episodeId,episodeSessionFile:identity.episodeSessionFile,branch:identity.branch,worktree:identity.worktree,sessionName:identity.sessionName,identityVersion:2,admission:"delivered"})})}''')
    completed = tier1_container.run(
        "prime-agent", "--mode", "text", "--offline", "--no-session",
        "--no-skills", "--no-prompt-templates", "--no-extensions",
        "--cwd", str(project), "-e", str(provider), "-e", str(setup),
        "-e", WS_EXT, "--provider", "shadow", "--model", "m", "-p", "probe",
        env={
            "PRIME_AGENT_CODING_AGENT_DIR": str(agent),
            "PRIME_AGENT_INTERNAL_LEGACY_OWNED_WORKER_FRONTEND": "1",
        },
        timeout=45,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    row = json.loads(records.read_text())
    assert row["kernel"] == 1
    assert row["projectSystem"] is True
    assert row["projectAppend"] is True
    assert row["projectAgents"] is True
    assert row["unselectedClaude"] is False
    assert_provider_context_clean(row)


def test_native_sdk_system_prompt_override_preserves_or_blocks_managed_kernel(
    tier1_container, ctmp,
):
    kernel = tier1_container.read_repo(WS_KERNEL)
    projects = {}
    agents = {}
    for name in ("preserve", "replace"):
        project = ctmp / f"sdk-{name}-project"
        (project / ".prime/agent").mkdir(parents=True)
        (project / ".prime/agent/SYSTEM.md").write_text(kernel)
        agent = ctmp / f"sdk-{name}-agent"
        agent.mkdir()
        projects[name] = str(project)
        agents[name] = str(agent)
    records = ctmp / "sdk-override-records.jsonl"
    result = ctmp / "sdk-override-result.json"
    provider = ctmp / "sdk-override-provider.ts"
    provider.write_text(rf'''import {{appendFileSync}} from "node:fs";
import {{createAssistantMessageEventStream}} from "@earendil-works/pi-ai";
const records={json.dumps(str(records))};
export default function provider(pi){{pi.registerProvider("sdk",{{baseUrl:"x",apiKey:"x",api:"sdk",streamSimple(model,context){{
  const capture={provider_capture_expression()};appendFileSync(records,JSON.stringify({{...capture,kernel:(context.systemPrompt.match(/PRIME_CLAW_ROLE_KERNEL_V1/g)||[]).length,preserved:context.systemPrompt.includes("SDK_PRESERVED"),replaced:context.systemPrompt.includes("SDK_REPLACED")}})+"\n");
  const stream=createAssistantMessageEventStream();queueMicrotask(()=>{{const message={{role:"assistant",content:[{{type:"text",text:"ok"}}],api:model.api,provider:model.provider,model:model.id,usage:{{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}}},stopReason:"stop",timestamp:Date.now()}};stream.push({{type:"start",partial:message}});stream.push({{type:"done",reason:"stop",message}});stream.end()}});return stream;
}},models:[{{id:"m",name:"M",reasoning:false,input:["text"],cost:{{input:0,output:0,cacheRead:0,cacheWrite:0}},contextWindow:100000,maxTokens:1000}}]}})}}''')
    setup = ctmp / "sdk-override-setup.ts"
    setup.write_text(r'''import {mkdirSync,writeFileSync} from "node:fs";
import {basename,dirname,join,resolve} from "node:path";
export default function setup(pi){pi.on("session_start",(_event,ctx)=>{const slug="alpha",ownerSessionId=ctx.sessionManager.getSessionId(),worktree=resolve(dirname(ctx.cwd),`${basename(ctx.cwd)}-${slug}-episode`),identity={version:2,slug,sourceLocation:`.ralph/plans/future/${slug}`,ownerSessionId,episodeId:"11111111-1111-4111-8111-111111111111",episodeActiveSessionId:"active",episodeSessionFile:join(worktree,"episode.jsonl"),branch:`episode/${slug}`,worktree,sessionName:`${slug}-episode`,bootstrapAdmission:"delivered"};const root=join(ctx.cwd,".prime/agent/state/spec-episodes");mkdirSync(root,{recursive:true});writeFileSync(join(root,`${slug}.json`),JSON.stringify(identity));pi.appendEntry("prime-claw-conversation-oversight",{markerVersion:2,status:"active",ownerSessionId,slug,sourceLocation:identity.sourceLocation,episodeId:identity.episodeId,episodeSessionFile:identity.episodeSessionFile,branch:identity.branch,worktree:identity.worktree,sessionName:identity.sessionName,identityVersion:2,admission:"delivered"})})}''')
    driver = ctmp / "sdk-override-driver.ts"
    driver.write_text(rf'''import {{existsSync,readFileSync,writeFileSync}} from "node:fs";
import {{createAgentSessionRuntime,createAgentSessionServices,createAgentSessionFromServices,SessionManager}} from "@earendil-works/pi-coding-agent";
const projects={json.dumps(projects)},agents={json.dumps(agents)},provider={json.dumps(str(provider))},setup={json.dumps(str(setup))},extension={json.dumps(WS_EXT)},records={json.dumps(str(records))},result={json.dumps(str(result))};const providerCalls=()=>existsSync(records)?readFileSync(records,"utf8").trim().split("\n").filter(Boolean).length:0;
export default function driver(pi){{pi.on("session_start",async()=>{{const outcome={{preserve:false,replaceBlocked:false,diagnostics:{{}}}};for(const name of ["preserve","replace"]){{let runtime;try{{const cwd=projects[name],agentDir=agents[name];const make=async target=>{{const services=await createAgentSessionServices({{cwd:target.cwd,agentDir,noBuiltinHerdrReporter:true,telemetryDisabled:true,resourceLoaderOptions:{{additionalExtensionPaths:[provider,setup,extension],noExtensions:true,noSkills:true,noPromptTemplates:true,noContextFiles:true,noThemes:true,systemPromptOverride:name==="preserve"?(base)=>`${{base??""}}\nSDK_PRESERVED`:()=>"SDK_REPLACED"}}}});const model=services.modelRegistry.find("sdk","m");const made=await createAgentSessionFromServices({{services,sessionManager:target.sessionManager,sessionStartEvent:target.sessionStartEvent,model,thinkingLevel:"off",noTools:true,prewarmIpythonKernel:false,telemetryDisabled:true}});return{{...made,services,diagnostics:services.diagnostics}}}};runtime=await createAgentSessionRuntime(make,{{cwd,agentDir,sessionManager:SessionManager.inMemory(cwd)}});await runtime.session.bindExtensions({{}});outcome.diagnostics[name]={{kernel:(runtime.session.systemPrompt.match(/PRIME_CLAW_ROLE_KERNEL_V1/g)||[]).length,marker:runtime.session.sessionManager.getBranch().filter(entry=>entry.type==="custom"&&entry.customType==="prime-claw-conversation-oversight").length}};try{{await runtime.session.prompt("SDK_OVERRIDE_PROBE");if(name==="preserve")outcome.preserve=true;else outcome.replaceBlocked=providerCalls()===1}}catch(error){{if(name==="replace"&&providerCalls()===1)outcome.replaceBlocked=true;else throw error}}}}finally{{await runtime?.dispose()}}}}writeFileSync(result,JSON.stringify(outcome))}})}}''')
    outer = ctmp / "sdk-outer.ts"
    _outer_provider(outer)
    completed = tier1_container.run(
        "prime-agent", "--mode", "text", "--offline", "--no-session",
        "--no-skills", "--no-prompt-templates", "--no-context-files",
        "--no-extensions", "--cwd", projects["preserve"], "-e", str(outer),
        "-e", str(driver), "--provider", "outer", "--model", "m", "-p", "outer",
        timeout=45,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    outcome = json.loads(result.read_text())
    assert outcome["preserve"] is True
    assert outcome["replaceBlocked"] is True, outcome
    rows = [json.loads(line) for line in records.read_text().splitlines()]
    assert len(rows) == 1
    assert rows[0]["kernel"] == 1
    assert rows[0]["preserved"] is True
    assert rows[0]["replaced"] is False
    assert_provider_context_clean(rows[0])

def test_native_auto_compaction_restores_first_real_active_call(tier1_container, ctmp):
    project=ctmp/"project"; (project/".prime/agent").mkdir(parents=True); (project/".prime/agent/APPEND_SYSTEM.md").write_text(tier1_container.read_repo(WS_KERNEL))
    assert not (project/".ralph/skills/oversee-episode/SKILL.md").exists()
    agent=ctmp/"agent"; agent.mkdir(); records=ctmp/"records.jsonl"; result=ctmp/"result.json"
    provider=ctmp/"provider.ts"
    provider.write_text(rf'''import{{appendFileSync}}from"node:fs";import{{createAssistantMessageEventStream}}from"@earendil-works/pi-ai";const p={json.dumps(str(records))};export default function x(pi){{pi.registerProvider("poc",{{baseUrl:"x",apiKey:"x",api:"poc",streamSimple(model,context){{const messages=context.messages??[],all=JSON.stringify(messages),tokens=Math.ceil(all.length/4),capture={provider_capture_expression()};appendFileSync(p,JSON.stringify({{kernel:context.systemPrompt.split("PRIME_CLAW_ROLE_KERNEL_V1").length-1,...capture,after:all.includes("AFTER_COMPACTION")}})+"\n");const s=createAssistantMessageEventStream();queueMicrotask(()=>{{const m={{role:"assistant",content:[{{type:"text",text:"ok"}}],api:model.api,provider:model.provider,model:model.id,usage:{{input:tokens,output:1,cacheRead:0,cacheWrite:0,totalTokens:tokens+1,cost:{{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}}},stopReason:"stop",timestamp:Date.now()}};s.push({{type:"start",partial:m}});s.push({{type:"done",reason:"stop",message:m}});s.end()}});return s}},models:[{{id:"m",name:"M",reasoning:false,input:["text"],cost:{{input:0,output:0,cacheRead:0,cacheWrite:0}},contextWindow:12000,maxTokens:1000}}]}})}}''')
    setup=ctmp/"setup.ts"
    setup.write_text(rf'''import{{mkdirSync,writeFileSync}}from"node:fs";import{{dirname,join}}from"node:path";export default function s(pi){{pi.on("session_start",(_e,ctx)=>{{const id=ctx.sessionManager.getSessionId(),slug="alpha",worktree=join(ctx.cwd,"..",ctx.cwd.split("/").at(-1)+"-alpha-episode"),sessionFile=join(worktree,"episode.jsonl"),path=join(ctx.cwd,".prime/agent/state/spec-episodes/alpha.json");mkdirSync(dirname(path),{{recursive:true}});writeFileSync(path,JSON.stringify({{version:2,slug,sourceLocation:".ralph/plans/future/alpha",ownerSessionId:id,episodeId:"episode",episodeActiveSessionId:"active",episodeSessionFile:sessionFile,branch:"episode/alpha",worktree,sessionName:"alpha-episode",bootstrapAdmission:"delivered"}}));pi.appendEntry("prime-claw-conversation-oversight",{{markerVersion:2,status:"active",ownerSessionId:id,slug,sourceLocation:".ralph/plans/future/alpha",episodeId:"episode",episodeActiveSessionId:"active",episodeSessionFile:sessionFile,branch:"episode/alpha",worktree,sessionName:"alpha-episode",identityVersion:2,admission:"delivered"}})}})}}''')
    driver=ctmp/"driver.ts"
    driver.write_text(rf'''import{{writeFileSync}}from"node:fs";import{{createAgentSessionServices,createAgentSessionFromServices,SessionManager}}from"@earendil-works/pi-coding-agent";const cwd={json.dumps(str(project))},agentDir={json.dumps(str(agent))},provider={json.dumps(str(provider))},setup={json.dumps(str(setup))},ext={json.dumps(WS_EXT)},result={json.dumps(str(result))},legacyPackage={json.dumps(LEGACY_PACKAGE_SENTINEL)};export default function d(pi){{pi.on("session_start",async()=>{{let session;try{{const services=await createAgentSessionServices({{cwd,agentDir,noBuiltinHerdrReporter:true,telemetryDisabled:true,resourceLoaderOptions:{{additionalExtensionPaths:[provider,setup,ext],noExtensions:true,noSkills:true,noPromptTemplates:true,noContextFiles:true,noThemes:true}}}});const model=services.modelRegistry.find("poc","m"),made=await createAgentSessionFromServices({{services,sessionManager:SessionManager.inMemory(cwd),model,thinkingLevel:"off",noTools:true,prewarmIpythonKernel:false,telemetryDisabled:true}});session=made.session;await session.bindExtensions({{}});for(let i=0;i<3;i++)await session.prompt("LONG "+"x".repeat(60000));await session.sendCustomMessage({{customType:"prime-claw-oversee-episode-package",content:legacyPackage,display:false}},{{triggerTurn:false}});await session.prompt("AFTER_COMPACTION");writeFileSync(result,JSON.stringify({{ok:true}}))}}catch(e){{writeFileSync(result,JSON.stringify({{error:String(e),stack:e?.stack}}))}}finally{{await session?.disposeAsync()}}}})}}''')
    outer=ctmp/"outer.ts"; _outer_provider(outer)
    cp=tier1_container.run("prime-agent","--mode","text","--offline","--no-session","--no-skills","--no-prompt-templates","--no-context-files","--no-extensions","--cwd",str(project),"-e",str(outer),"-e",str(driver),"--provider","outer","--model","m","-p","outer",timeout=45)
    assert cp.returncode==0,cp.stdout+cp.stderr
    assert json.loads(result.read_text())=={"ok":True}
    rows=[json.loads(x) for x in records.read_text().splitlines()]
    active_rows=[r for r in rows if r["kernel"]==1]
    for row in active_rows:
        assert_provider_context_clean(row)
    assert any(r["kernel"]==0 for r in rows)
    after=[r for r in active_rows if r["after"]]
    assert after
    assert_provider_context_clean(after[0])


def test_native_managed_conversation_guide_is_disclosed_once_and_status_is_ready(
    tier1_container, ctmp,
):
    project = ctmp / "guide-project"
    (project / ".prime/agent").mkdir(parents=True)
    (project / ".prime/agent/APPEND_SYSTEM.md").write_text(
        tier1_container.read_repo(WS_KERNEL)
    )
    records = ctmp / "guide-records.jsonl"
    provider = ctmp / "guide-provider.ts"
    provider.write_text(rf'''import {{appendFileSync}} from "node:fs";
import {{createAssistantMessageEventStream}} from "@earendil-works/pi-ai";
const records={json.dumps(str(records))};
let calls=0,disclosureFailed=false;
function message(model,content,reason="stop"){{return{{role:"assistant",content,api:model.api,provider:model.provider,model:model.id,usage:{{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}}},stopReason:reason,timestamp:Date.now()}}}}
export default function probe(pi){{pi.registerProvider("guide",{{baseUrl:"x",apiKey:"x",api:"guide",streamSimple(model,context){{
  calls+=1;const messages=context.messages??[],encoded=JSON.stringify(messages),activationResults=messages.filter(m=>m.role==="toolResult"&&m.toolName==="prime_claw_activate_conversation_guide"),capture={provider_capture_expression()};
  appendFileSync(records,JSON.stringify({{...capture,call:calls,kernel:(context.systemPrompt.match(/PRIME_CLAW_ROLE_KERNEL_V1/g)||[]).length,systemGuide:context.systemPrompt.includes("PRIME_CLAW_CONVERSATION_GUIDE_V1"),guideCount:(encoded.match(/PRIME_CLAW_CONVERSATION_GUIDE_V1/g)||[]).length,assistantGuideCallIds:messages.flatMap(m=>m.role==="assistant"?(m.content??[]).filter(c=>c.type==="toolCall"&&c.name==="prime_claw_activate_conversation_guide").map(c=>c.id):[]),activationResultIds:activationResults.map(m=>m.toolCallId),activationResults:activationResults.map(m=>({{text:m.content?.[0]?.text,details:m.details??null}})),privateReceiptCount:(encoded.match(/subjectKind|sourceLocation|preparationLifecycle|lifecycleFingerprint|sessionId/g)||[]).length,statusReady:messages.some(m=>m.role==="toolResult"&&m.toolName==="prime_claw_conversation_guide_status"&&m.details?.ready===true)}})+"\n");
  const stream=createAssistantMessageEventStream();queueMicrotask(()=>{{let output;if(calls===1){{const tc={{type:"toolCall",id:"activate-guide",name:"prime_claw_activate_conversation_guide",arguments:{{}}}};output=message(model,[tc],"toolUse");stream.push({{type:"start",partial:output}});stream.push({{type:"toolcall_start",contentIndex:0,partial:output}});stream.push({{type:"toolcall_end",contentIndex:0,toolCall:tc,partial:output}});stream.push({{type:"done",reason:"toolUse",message:output}})}}else if(calls===2&&!disclosureFailed){{disclosureFailed=true;output=message(model,[],"error");output.errorMessage="transient retry probe";stream.push({{type:"error",reason:"error",error:output}})}}else if(calls===3){{const tc={{type:"toolCall",id:"guide-status",name:"prime_claw_conversation_guide_status",arguments:{{}}}};output=message(model,[tc],"toolUse");stream.push({{type:"start",partial:output}});stream.push({{type:"toolcall_start",contentIndex:0,partial:output}});stream.push({{type:"toolcall_end",contentIndex:0,toolCall:tc,partial:output}});stream.push({{type:"done",reason:"toolUse",message:output}})}}else{{output=message(model,[{{type:"text",text:"GUIDE_PROBE_DONE"}}]);stream.push({{type:"start",partial:output}});stream.push({{type:"text_start",contentIndex:0,partial:output}});stream.push({{type:"text_delta",contentIndex:0,delta:"GUIDE_PROBE_DONE",partial:output}});stream.push({{type:"text_end",contentIndex:0,content:"GUIDE_PROBE_DONE",partial:output}});stream.push({{type:"done",reason:"stop",message:output}})}}stream.end()}});return stream;
}},models:[{{id:"m",name:"M",reasoning:false,input:["text"],cost:{{input:0,output:0,cacheRead:0,cacheWrite:0}},contextWindow:100000,maxTokens:1000}}]}})}}''')
    setup = ctmp / "guide-setup.ts"
    setup.write_text(r'''import {mkdirSync,writeFileSync} from "node:fs";
import {basename,dirname,join,resolve} from "node:path";
export default function setup(pi){pi.on("session_start",(_event,ctx)=>{const slug="alpha",ownerSessionId=ctx.sessionManager.getSessionId(),worktree=resolve(dirname(ctx.cwd),`${basename(ctx.cwd)}-${slug}-episode`),identity={version:2,slug,sourceLocation:`.ralph/plans/future/${slug}`,ownerSessionId,episodeId:"11111111-1111-4111-8111-111111111111",episodeActiveSessionId:"active",episodeSessionFile:join(worktree,"episode.jsonl"),branch:`episode/${slug}`,worktree,sessionName:`${slug}-episode`,bootstrapAdmission:"delivered"};const root=join(ctx.cwd,".prime/agent/state/spec-episodes");mkdirSync(root,{recursive:true});writeFileSync(join(root,`${slug}.json`),JSON.stringify(identity));pi.appendEntry("prime-claw-conversation-oversight",{markerVersion:2,status:"active",ownerSessionId,slug,sourceLocation:identity.sourceLocation,episodeId:identity.episodeId,episodeSessionFile:identity.episodeSessionFile,branch:identity.branch,worktree:identity.worktree,sessionName:identity.sessionName,identityVersion:2,admission:"delivered"})})}''')
    completed = tier1_container.run(
        "prime-agent", "--mode", "text", "--offline", "--no-session",
        "--no-skills", "--no-prompt-templates", "--no-context-files",
        "--no-extensions", "--cwd", str(project), "-e", str(provider),
        "-e", str(setup), "-e", WS_EXT,
        "--provider", "guide", "--model", "m", "-p", "activate",
        env={"PRIME_AGENT_INTERNAL_LEGACY_OWNED_WORKER_FRONTEND": "1"},
        timeout=45,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert "GUIDE_PROBE_DONE" in completed.stdout
    rows = [json.loads(line) for line in records.read_text().splitlines()]
    assert [row["call"] for row in rows] == [1, 2, 3, 4]
    assert [row["guideCount"] for row in rows] == [0, 1, 0, 0]
    assert all(row["kernel"] == 1 and not row["systemGuide"] for row in rows)
    for row in rows:
        assert_provider_context_clean(row)
        assert row["privateReceiptCount"] == 0
    assert rows[0]["activationResults"] == []
    assert rows[1]["assistantGuideCallIds"] == ["activate-guide"]
    assert rows[1]["activationResultIds"] == ["activate-guide"]
    assert "name: prime-claw-oversee-episode" in rows[1]["activationResults"][0]["text"]
    assert rows[1]["activationResults"][0]["details"]["version"] == 1
    for row in rows[2:]:
        assert "omitted after its single authorized continuation" in row["activationResults"][0]["text"]
        assert row["activationResults"][0]["details"] is None
    assert rows[3]["statusReady"] is True
