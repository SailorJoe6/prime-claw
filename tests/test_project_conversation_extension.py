"""Native project-conversation oversight tests.

Tier policy: the static contract/documentation tests are tier 0. The native
prime-agent probes are tier 1 and run INSIDE the session's tier-1 container
via the `tier1_container` fixture (auto-marked `container`; see
tests/conftest.py). Tier-1 test code never references host paths or host
binaries; scratch lives on the same-path session share (ctmp).
"""

import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
KERNEL = REPO / "src/prime-agent-plugin/APPEND_SYSTEM.md"
EXTENSION = REPO / "src/prime-agent-plugin/extensions/reviewed-plan.ts"
SUPPORT = REPO / "src/prime-agent-plugin/extension-support/conversation-oversight.ts"
SKILL = REPO / ".ralph/skills/oversee-episode/SKILL.md"
DOC = REPO / "docs/conversation-driven-episode-oversight.md"
DOGFOOD = REPO / "reports/reviews/conversation-driven-episode-oversight-dogfood.md"

# Container paths (repo bind-mounted read-only at /workspace).
WS_EXTENSION = "/workspace/src/prime-agent-plugin/extensions/reviewed-plan.ts"
WS_SUPPORT = "/workspace/src/prime-agent-plugin/extension-support/conversation-oversight.ts"
WS_KERNEL = "src/prime-agent-plugin/APPEND_SYSTEM.md"
WS_NODE_SUITE = "/workspace/tests/project_conversation_extension.test.mjs"


def test_managed_session_contract_is_lean_and_covers_the_poc_protocol():
    text = " ".join(KERNEL.read_text().split())
    for phrase in [
        "PRIME_CLAW_CONVERSATION_IDENTITY_V1",
        "CONVERSATION",
        "EPISODE",
        "EXPERT",
        "delegated",
        "vertical slice",
        "canonical handoff protocol",
        "focused compaction",
        "maintain a goal",
        "establish a heartbeat",
        "waiting for the user",
        "Do not narrate",
    ]:
        assert phrase in text
    assert "daemon protocol" not in text
    assert len(text.split()) <= 250


def test_oversee_episode_is_exposed_through_normal_project_skill_discovery():
    link = REPO / ".agents/skills/oversee-episode"
    assert link.is_symlink()
    assert link.resolve() == (REPO / ".ralph/skills/oversee-episode").resolve()
    assert (link / "SKILL.md").read_bytes() == SKILL.read_bytes()


def test_canonical_oversight_package_contains_reviewed_policy():
    text = " ".join(SKILL.read_text().split())
    for phrase in ["name: oversee-episode", "one owner-coordination message", "15-minute", "exact pushed candidate", "owner ledger", "advance", "revise", "consult", "pause", "finalize_spec_episode", "Only the operator", "ordinary CONVERSATION work", "sole terminal decision", "no-UI, idempotent"]:
        assert phrase in text


def test_extension_uses_context_and_exact_state_without_rejected_flag_profile():
    extension = EXTENSION.read_text(); support = SUPPORT.read_text()
    assert "registerConversationOversight(pi);" in extension
    assert "recoverCompleting:" not in extension
    assert "episode-finalization" not in extension + support
    assert "authorization receipt" not in extension + support
    assert "currentCompletingFinalization" not in extension + support
    assert "assertFinalizationRecoveryReady" not in extension + support
    assert 'pi.on("context"' in support
    assert 'pi.on("session_start"' in support
    assert "registerFlag" not in extension + support
    assert "before_agent_start" not in support
    assert "project-conversation.md" not in extension + support
    for phrase in ["IDENTITY_KERNEL", "OVERSIGHT_MARKER_TYPE", "LEGACY_OVERSIGHT_PACKAGE_TYPE", "getBranch()", "spec-episodes", "ctx.abort()", "oversight marker disagrees", "filter"]:
        assert phrase in support
    assert "OVERSIGHT_PACKAGE_PATH" not in support
    assert "packageBody" not in support
    assert "parseSkillFrontmatter" not in support
    assert "parseFrontmatterScalar" not in support


def test_project_conversation_node_suite(tier1_container):
    """Run the project-conversation TypeScript suite inside the container.

    This suite previously had no pytest bridge; slice 3 adds it so every
    committed node suite runs under the tier-1 container.
    """
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", WS_NODE_SUITE,
        timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def _provider_extension(path: Path, records: Path):
    source = r'''import {appendFileSync} from "node:fs";
import {createAssistantMessageEventStream} from "@earendil-works/pi-ai";
const records=RECORDS;
export default function p(pi){pi.registerProvider("poc",{baseUrl:"x",apiKey:"x",api:"poc",
streamSimple(model,context){const messages=context.messages??[];appendFileSync(records,JSON.stringify({kernel:context.systemPrompt.split("PRIME_CLAW_CONVERSATION_IDENTITY_V1").length-1,package:messages.filter(message=>message?.role==="custom"&&message.customType==="prime-claw-oversee-episode-package").length})+"\n");const s=createAssistantMessageEventStream();queueMicrotask(()=>{const m={role:"assistant",content:[{type:"text",text:"ok"}],api:model.api,provider:model.provider,model:model.id,usage:{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:"stop",timestamp:Date.now()};s.push({type:"start",partial:m});s.push({type:"done",reason:"stop",message:m});s.end()});return s},models:[{id:"m",name:"M",reasoning:false,input:["text"],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:10000,maxTokens:1000}]})}'''
    path.write_text(source.replace("RECORDS", json.dumps(str(records))))


def _run_native(tier1_container, ctmp, with_kernel: bool):
    project = ctmp / "project"; project.mkdir()
    if with_kernel:
        (project / ".prime/agent").mkdir(parents=True)
        (project / ".prime/agent/APPEND_SYSTEM.md").write_text(tier1_container.read_repo(WS_KERNEL))
    records = ctmp / "records.jsonl"; provider = ctmp / "provider.ts"; _provider_extension(provider, records)
    env = {"PRIME_AGENT_CODING_AGENT_DIR": str(ctmp / "agent")}
    completed = tier1_container.run("prime-agent", "--mode", "text", "--offline", "--no-session", "--no-skills", "--no-prompt-templates", "--no-context-files", "--no-extensions", "--cwd", str(project), "-e", str(provider), "-e", WS_EXTENSION, "--provider", "poc", "--model", "m", "-p", "probe", env=env, timeout=40)
    return completed, records


def test_native_inactive_shadowed_kernel_keeps_ordinary_conversation(tier1_container, ctmp):
    completed, records = _run_native(tier1_container, ctmp, False)
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert json.loads(records.read_text()) == {"kernel": 0, "package": 0}


def test_native_inactive_conversation_gets_one_kernel_and_no_package(tier1_container, ctmp):
    completed, records = _run_native(tier1_container, ctmp, True)
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert json.loads(records.read_text()) == {"kernel": 1, "package": 0}


def _active_setup(path: Path):
    path.write_text(r'''import {basename,dirname,resolve} from "node:path";
import {mkdirSync,writeFileSync} from "node:fs";
export default function setup(pi){pi.on("session_start",(_event,ctx)=>{const slug="alpha",ownerSessionId=ctx.sessionManager.getSessionId(),worktree=resolve(dirname(ctx.cwd),`${basename(ctx.cwd)}-${slug}-episode`);const identity={version:2,slug,sourceLocation:`.ralph/plans/future/${slug}`,ownerSessionId,episodeId:"11111111-1111-4111-8111-111111111111",episodeActiveSessionId:"active",episodeSessionFile:resolve(worktree,"episode.jsonl"),branch:`episode/${slug}`,worktree,sessionName:`${slug}-episode`,bootstrapAdmission:"delivered"};const root=resolve(ctx.cwd,".prime/agent/state/spec-episodes");mkdirSync(root,{recursive:true});const encoded=JSON.stringify(identity);writeFileSync(resolve(root,`${slug}.json`),encoded);writeFileSync(resolve(ctx.cwd,"expected-identity.json"),encoded);pi.appendEntry("prime-claw-conversation-oversight",{markerVersion:2,status:"active",ownerSessionId,slug:identity.slug,sourceLocation:identity.sourceLocation,episodeId:identity.episodeId,episodeSessionFile:identity.episodeSessionFile,branch:identity.branch,worktree:identity.worktree,sessionName:identity.sessionName,identityVersion:2,admission:"delivered"})})}''')


def _recovery_setup(path: Path):
    path.write_text(r'''import {basename,dirname,resolve} from "node:path";
import {mkdirSync,writeFileSync} from "node:fs";
export default function setup(pi){pi.on("session_start",(_event,ctx)=>{const slug="alpha",ownerSessionId=ctx.sessionManager.getSessionId(),worktree=resolve(dirname(ctx.cwd),`${basename(ctx.cwd)}-${slug}-episode`);const identity={version:2,slug,sourceLocation:`.ralph/plans/future/${slug}`,ownerSessionId,episodeId:"11111111-1111-4111-8111-111111111111",episodeActiveSessionId:"active",episodeSessionFile:resolve(worktree,"episode.jsonl"),branch:`episode/${slug}`,worktree,sessionName:`${slug}-episode`,bootstrapAdmission:"delivered"};const root=resolve(ctx.cwd,".prime/agent/state/spec-episodes"),encoded=JSON.stringify(identity);mkdirSync(root,{recursive:true});writeFileSync(resolve(root,`${slug}.json`),encoded);writeFileSync(resolve(ctx.cwd,"expected-identity.json"),encoded)})}''')


def _promotion_setup(path: Path):
    support = json.dumps(WS_SUPPORT)
    path.write_text(f'''import {{basename,dirname,resolve}} from "node:path";
import {{mkdirSync,writeFileSync}} from "node:fs";
import {{appendActiveOversight}} from {support};
export default function setup(pi){{pi.on("session_start",(_event,ctx)=>{{const slug="alpha",ownerSessionId=ctx.sessionManager.getSessionId(),worktree=resolve(dirname(ctx.cwd),`${{basename(ctx.cwd)}}-${{slug}}-episode`);const identity={{version:2,slug,sourceLocation:`.ralph/plans/future/${{slug}}`,ownerSessionId,episodeId:"11111111-1111-4111-8111-111111111111",episodeActiveSessionId:"active",episodeSessionFile:resolve(worktree,"episode.jsonl"),branch:`episode/${{slug}}`,worktree,sessionName:`${{slug}}-episode`,bootstrapAdmission:"delivered"}};const encoded=JSON.stringify(identity),root=resolve(ctx.cwd,".prime/agent/state/spec-episodes");mkdirSync(root,{{recursive:true}});writeFileSync(resolve(root,`${{slug}}.json`),encoded);writeFileSync(resolve(ctx.cwd,"expected-identity.json"),encoded);appendActiveOversight(pi,ctx,{{...identity,reused:false}})}})}}''')


def _run_native_active(tier1_container, case: Path, mode: str):
    project = case / "project"; (project / ".prime/agent").mkdir(parents=True)
    (project / ".prime/agent/APPEND_SYSTEM.md").write_text(tier1_container.read_repo(WS_KERNEL))
    assert not (project / ".ralph/skills/oversee-episode/SKILL.md").exists()
    records = case / "records.jsonl"; provider = case / "provider.ts"; _provider_extension(provider, records)
    setup = case / "setup.ts"
    {"active": _active_setup, "promotion": _promotion_setup, "recovery": _recovery_setup}[mode](setup)
    env = {"PRIME_AGENT_CODING_AGENT_DIR": str(case / "agent"), "PRIME_AGENT_INTERNAL_LEGACY_OWNED_WORKER_FRONTEND": "1"}
    completed = tier1_container.run("prime-agent", "--mode", "text", "--offline", "--no-session", "--no-skills", "--no-prompt-templates", "--no-context-files", "--no-extensions", "--cwd", str(project), "-e", str(provider), "-e", str(setup), "-e", WS_EXTENSION, "--provider", "poc", "--model", "m", "-p", "probe", env=env, timeout=40)
    identity = project / ".prime/agent/state/spec-episodes/alpha.json"
    return completed, records, identity, project


def test_native_active_promotion_and_recovery_need_no_oversight_skill(tier1_container, ctmp):
    for mode in ("active", "promotion", "recovery"):
        case = ctmp / mode; case.mkdir()
        completed, records, identity, project = _run_native_active(tier1_container, case, mode)
        assert completed.returncode == 0, completed.stdout + completed.stderr
        assert json.loads(records.read_text()) == {"kernel": 1, "package": 0}
        assert identity.read_bytes() == (project / "expected-identity.json").read_bytes()
        assert not (project / ".ralph/skills/oversee-episode/SKILL.md").exists()


def test_current_documentation_describes_lean_default_and_transition_compatibility():
    text = DOC.read_text()
    for phrase in [
        "Managed lean session protocol",
        "sole model-facing protocol",
        "one reviewable vertical slice at a time",
        "historical `prime-claw-oversee-episode-package` messages",
        "never reads, parses, validates, or injects the old project-local skill",
        "Loaded-generation compatibility reference (temporary)",
        "one coordinated full restart",
        "designated ordinary-conversation UAT",
        "Exact bookkeeping close",
        "location-only, no-UI bookkeeping close",
    ]:
        assert phrase in text
    assert "--project-conversation" not in text


def test_dogfood_report_preserves_frozen_old_finalizer_chronology():
    text = DOGFOOD.read_text()
    cancelled = text.index("first old-design native\nauthorization call returned `Episode finalization authorization was cancelled`")
    authorized = text.index("second old-design authorization succeeded for disposition `merged`")
    completed = text.index("exactly one old-design `complete` call")
    assert cancelled < authorized < completed
    for phrase in [
        "b8ddda43da88c897c2a844cca99d31a95f38c7fb",
        "fast-forwarded and pushed disposable `main`",
        "01a0d43b-e71c-702f-8f94-d5d7e60c2247",
        "removed its clean worktree",
        "only the main\nworktree remained",
        "matching local and remote episode refs were retained",
        "Finalization is blocked with durable recovery evidence preserved: Daemon session row has an invalid session UUID",
        "The call was not retried",
        "receipt remains `authorized`",
        "matching retained identity/oversight evidence and refs remain frozen",
    ]:
        assert phrase in text
    summary = DOC.read_text()
    assert "both old-design authorization attempts" in summary
    assert "still-`authorized` receipt" in summary
    assert "Daemon session row has an invalid session UUID" in summary


def test_native_unclassifiable_marker_owners_block_before_provider(tier1_container, ctmp):
    for index, owner in enumerate([None, 7, ""]):
        case=ctmp/str(index);case.mkdir();project=case/"project";(project/".prime/agent").mkdir(parents=True);(project/".prime/agent/APPEND_SYSTEM.md").write_text(tier1_container.read_repo(WS_KERNEL))
        records=case/"records.jsonl";provider=case/"provider.ts";_provider_extension(provider,records)
        setup=case/"setup.ts";setup.write_text(f'''export default function s(pi){{pi.on("session_start",()=>pi.appendEntry("prime-claw-conversation-oversight",{{markerVersion:2,status:"active",ownerSessionId:{json.dumps(owner)},slug:"alpha",sourceLocation:".ralph/plans/future/alpha",episodeId:"11111111-1111-4111-8111-111111111111",episodeSessionFile:"/session",branch:"episode/alpha",worktree:"/worktree",sessionName:"alpha-episode",identityVersion:2,admission:"delivered"}}))}}''')
        env={"PRIME_AGENT_CODING_AGENT_DIR":str(case/"agent"),"PRIME_AGENT_INTERNAL_LEGACY_OWNED_WORKER_FRONTEND":"1"}
        completed=tier1_container.run("prime-agent","--mode","text","--offline","--no-session","--no-skills","--no-prompt-templates","--no-context-files","--no-extensions","--cwd",str(project),"-e",str(provider),"-e",str(setup),"-e",WS_EXTENSION,"--provider","poc","--model","m","-p","probe",env=env,timeout=40)
        assert completed.returncode!=0
        assert "owner is unclassifiable" in completed.stderr
        assert not records.exists()
