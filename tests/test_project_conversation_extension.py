import json
import os
import shutil
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
KERNEL = REPO / "src/prime-agent-plugin/APPEND_SYSTEM.md"
EXTENSION = REPO / "src/prime-agent-plugin/extensions/reviewed-plan.ts"
SUPPORT = REPO / "src/prime-agent-plugin/extension-support/conversation-oversight.ts"
SKILL = REPO / ".ralph/skills/oversee-episode/SKILL.md"
DOC = REPO / "docs/conversation-driven-episode-oversight.md"
DOGFOOD = REPO / "reports/reviews/conversation-driven-episode-oversight-dogfood.md"


def test_managed_identity_kernel_is_small_and_routes_bounded_roles():
    text = KERNEL.read_text()
    for phrase in ["PRIME_CLAW_CONVERSATION_IDENTITY_V1", "CONVERSATION", "EPISODE", "EXPERT", "delegated", "exact-session", "compaction"]:
        assert phrase in text
    assert "oversee-episode" in text
    assert "daemon protocol" not in text
    assert len(text.splitlines()) < 30


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
    for phrase in ["IDENTITY_KERNEL", "OVERSIGHT_MARKER_TYPE", "getBranch()", "spec-episodes", "OVERSIGHT_PACKAGE_PATH", "ctx.abort()", "oversight marker disagrees", "filter"]:
        assert phrase in support


def _provider_extension(path: Path, records: Path):
    source = r'''import {appendFileSync} from "node:fs";
import {createAssistantMessageEventStream} from "@earendil-works/pi-ai";
const records=RECORDS;
export default function p(pi){pi.registerProvider("poc",{baseUrl:"x",apiKey:"x",api:"poc",
streamSimple(model,context){appendFileSync(records,JSON.stringify({kernel:context.systemPrompt.split("PRIME_CLAW_CONVERSATION_IDENTITY_V1").length-1,package:JSON.stringify(context.messages??[]).split("name: oversee-episode").length-1})+"\n");const s=createAssistantMessageEventStream();queueMicrotask(()=>{const m={role:"assistant",content:[{type:"text",text:"ok"}],api:model.api,provider:model.provider,model:model.id,usage:{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:"stop",timestamp:Date.now()};s.push({type:"start",partial:m});s.push({type:"done",reason:"stop",message:m});s.end()});return s},models:[{id:"m",name:"M",reasoning:false,input:["text"],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:10000,maxTokens:1000}]})}'''
    path.write_text(source.replace("RECORDS", json.dumps(str(records))))


def _run_native(tmp_path, with_kernel: bool):
    prime = shutil.which("prime-agent"); assert prime
    project = tmp_path / "project"; project.mkdir()
    if with_kernel:
        (project / ".prime/agent").mkdir(parents=True)
        (project / ".prime/agent/APPEND_SYSTEM.md").write_text(KERNEL.read_text())
    records = tmp_path / "records.jsonl"; provider = tmp_path / "provider.ts"; _provider_extension(provider, records)
    env = {**os.environ, "PRIME_AGENT_CODING_AGENT_DIR": str(tmp_path / "agent")}
    completed = subprocess.run([prime, "--mode", "text", "--offline", "--no-session", "--no-skills", "--no-prompt-templates", "--no-context-files", "--no-extensions", "--cwd", str(project), "-e", str(provider), "-e", str(EXTENSION), "--provider", "poc", "--model", "m", "-p", "probe"], cwd=REPO, env=env, capture_output=True, text=True, timeout=20)
    return completed, records


def test_native_inactive_shadowed_kernel_keeps_ordinary_conversation(tmp_path):
    completed, records = _run_native(tmp_path, False)
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert json.loads(records.read_text()) == {"kernel": 0, "package": 0}


def test_native_inactive_conversation_gets_one_kernel_and_no_package(tmp_path):
    completed, records = _run_native(tmp_path, True)
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert json.loads(records.read_text()) == {"kernel": 1, "package": 0}


def _active_package_setup(path: Path):
    path.write_text(r'''import {basename,dirname,resolve} from "node:path";
import {mkdirSync,writeFileSync} from "node:fs";
export default function setup(pi){pi.on("session_start",(_event,ctx)=>{const slug="alpha",ownerSessionId=ctx.sessionManager.getSessionId(),worktree=resolve(dirname(ctx.cwd),`${basename(ctx.cwd)}-${slug}-episode`);const identity={version:2,slug,sourceLocation:`.ralph/plans/future/${slug}`,ownerSessionId,episodeId:"11111111-1111-4111-8111-111111111111",episodeActiveSessionId:"active",episodeSessionFile:resolve(worktree,"episode.jsonl"),branch:`episode/${slug}`,worktree,sessionName:`${slug}-episode`,bootstrapAdmission:"delivered"};const root=resolve(ctx.cwd,".prime/agent/state/spec-episodes");mkdirSync(root,{recursive:true});const encoded=JSON.stringify(identity);writeFileSync(resolve(root,`${slug}.json`),encoded);writeFileSync(resolve(ctx.cwd,"expected-identity.json"),encoded);pi.appendEntry("prime-claw-conversation-oversight",{markerVersion:2,status:"active",ownerSessionId,slug:identity.slug,sourceLocation:identity.sourceLocation,episodeId:identity.episodeId,episodeSessionFile:identity.episodeSessionFile,branch:identity.branch,worktree:identity.worktree,sessionName:identity.sessionName,identityVersion:2,admission:"delivered"})})}''')


def _recovery_package_setup(path: Path):
    path.write_text(r'''import {basename,dirname,resolve} from "node:path";
import {mkdirSync,writeFileSync} from "node:fs";
export default function setup(pi){pi.on("session_start",(_event,ctx)=>{const slug="alpha",ownerSessionId=ctx.sessionManager.getSessionId(),worktree=resolve(dirname(ctx.cwd),`${basename(ctx.cwd)}-${slug}-episode`);const identity={version:2,slug,sourceLocation:`.ralph/plans/future/${slug}`,ownerSessionId,episodeId:"11111111-1111-4111-8111-111111111111",episodeActiveSessionId:"active",episodeSessionFile:resolve(worktree,"episode.jsonl"),branch:`episode/${slug}`,worktree,sessionName:`${slug}-episode`,bootstrapAdmission:"delivered"};const root=resolve(ctx.cwd,".prime/agent/state/spec-episodes"),encoded=JSON.stringify(identity);mkdirSync(root,{recursive:true});writeFileSync(resolve(root,`${slug}.json`),encoded);writeFileSync(resolve(ctx.cwd,"expected-identity.json"),encoded)})}''')


def _promotion_package_setup(path: Path):
    support = json.dumps(str(SUPPORT))
    path.write_text(f'''import {{basename,dirname,resolve}} from "node:path";
import {{mkdirSync,writeFileSync}} from "node:fs";
import {{appendActiveOversight}} from {support};
export default function setup(pi){{pi.on("session_start",(_event,ctx)=>{{const slug="alpha",ownerSessionId=ctx.sessionManager.getSessionId(),worktree=resolve(dirname(ctx.cwd),`${{basename(ctx.cwd)}}-${{slug}}-episode`);const identity={{version:2,slug,sourceLocation:`.ralph/plans/future/${{slug}}`,ownerSessionId,episodeId:"11111111-1111-4111-8111-111111111111",episodeActiveSessionId:"active",episodeSessionFile:resolve(worktree,"episode.jsonl"),branch:`episode/${{slug}}`,worktree,sessionName:`${{slug}}-episode`,bootstrapAdmission:"delivered"}};const encoded=JSON.stringify(identity),root=resolve(ctx.cwd,".prime/agent/state/spec-episodes");mkdirSync(root,{{recursive:true}});writeFileSync(resolve(root,`${{slug}}.json`),encoded);writeFileSync(resolve(ctx.cwd,"expected-identity.json"),encoded);appendActiveOversight(pi,ctx,{{...identity,reused:false}})}})}}''')


def _run_native_active_package(case: Path, description: str = "valid", *, metadata: str | None = None, raw_package: str | None = None, promote: bool = False, recover: bool = False):
    prime = shutil.which("prime-agent"); assert prime
    project = case / "project"; (project / ".prime/agent").mkdir(parents=True)
    (project / ".prime/agent/APPEND_SYSTEM.md").write_text(KERNEL.read_text())
    skill = project / ".ralph/skills/oversee-episode/SKILL.md"; skill.parent.mkdir(parents=True)
    frontmatter = metadata if metadata is not None else f"name: oversee-episode\ndescription: {description}"
    skill.write_bytes((raw_package if raw_package is not None else f"---\n{frontmatter}\n---\nbody").encode())
    records = case / "records.jsonl"; provider = case / "provider.ts"; _provider_extension(provider, records)
    setup = case / "setup.ts"
    (_recovery_package_setup if recover else _promotion_package_setup if promote else _active_package_setup)(setup)
    env = {**os.environ, "PRIME_AGENT_CODING_AGENT_DIR": str(case / "agent"), "PRIME_AGENT_INTERNAL_LEGACY_OWNED_WORKER_FRONTEND": "1"}
    completed = subprocess.run([prime, "--mode", "text", "--offline", "--no-session", "--no-skills", "--no-prompt-templates", "--no-context-files", "--no-extensions", "--cwd", str(project), "-e", str(provider), "-e", str(setup), "-e", str(EXTENSION), "--provider", "poc", "--model", "m", "-p", "probe"], cwd=REPO, env=env, capture_output=True, text=True, timeout=20)
    identity = project / ".prime/agent/state/spec-episodes/alpha.json"
    return completed, records, identity


def test_native_bounded_frontmatter_blocks_before_provider_and_keeps_expectation(tmp_path):
    invalid = ["? bare", ": bare", ",bare", "# comment only", "raw\x00nul", '"escaped\\u0000nul"']
    for index, description in enumerate(invalid):
        case = tmp_path / f"invalid-{index}"; case.mkdir()
        completed, records, identity = _run_native_active_package(case, description)
        assert completed.returncode != 0
        assert "prime-claw conversation blocked" in completed.stderr
        assert not records.exists(), completed.stdout + completed.stderr
        assert identity.read_bytes() == (case / "project/expected-identity.json").read_bytes()
    invalid_metadata = [
        "name: oversee-episode\ndescription: valid\nmetadata: ignored",
        "name: oversee-episode\n# comment-only metadata\ndescription: valid",
        "name: oversee-episode\n\ndescription: valid",
    ]
    for mode in ["active", "promotion"]:
        for index, metadata in enumerate(invalid_metadata):
            case = tmp_path / f"invalid-metadata-{mode}-{index}"; case.mkdir()
            completed, records, identity = _run_native_active_package(case, metadata=metadata, promote=mode == "promotion")
            assert completed.returncode != 0
            assert "oversight package frontmatter" in completed.stderr
            assert not records.exists(), completed.stdout + completed.stderr
            assert identity.read_bytes() == (case / "project/expected-identity.json").read_bytes()
    for index, description in enumerate(["plain scalar", '"quoted # scalar: value"']):
        case = tmp_path / f"valid-{index}"; case.mkdir()
        completed, records, identity = _run_native_active_package(case, description)
        assert completed.returncode == 0, completed.stdout + completed.stderr
        assert json.loads(records.read_text()) == {"kernel": 1, "package": 1}
        assert identity.read_bytes() == (case / "project/expected-identity.json").read_bytes()


def test_native_raw_package_delimiters_block_active_promotion_and_recovery(tmp_path):
    invalid = [
        " ---\nname: oversee-episode\ndescription: valid\n---\nbody",
        "\t---\nname: oversee-episode\ndescription: valid\n---\nbody",
        "--- \nname: oversee-episode\ndescription: valid\n---\nbody",
        "---\nname: oversee-episode\ndescription: valid\n ---\nbody",
        "---\nname: oversee-episode\ndescription: valid\n\t---\nbody",
        "---\nname: oversee-episode\ndescription: valid\n--- \nbody",
    ]
    for mode in ["active", "promotion", "recovery"]:
        for index, raw in enumerate(invalid):
            case = tmp_path / f"raw-{mode}-{index}"; case.mkdir()
            completed, records, identity = _run_native_active_package(
                case, raw_package=raw, promote=mode == "promotion", recover=mode == "recovery",
            )
            assert completed.returncode != 0
            assert ("expectation-marker recovery" if mode == "recovery" else "frontmatter") in completed.stderr
            assert not records.exists(), completed.stdout + completed.stderr
            assert identity.read_bytes() == (case / "project/expected-identity.json").read_bytes()
    canonical = "---\nname: oversee-episode\ndescription: Unicode café https://host/path key:value a,b why? C#\n---\n# Procedure\n\n  formatted step\n"
    for mode in ["active", "promotion", "recovery"]:
        case = tmp_path / f"valid-raw-{mode}"; case.mkdir()
        completed, records, identity = _run_native_active_package(
            case, raw_package=canonical, promote=mode == "promotion", recover=mode == "recovery",
        )
        assert completed.returncode == 0, completed.stdout + completed.stderr
        assert json.loads(records.read_text()) == {"kernel": 1, "package": 1}
        assert identity.read_bytes() == (case / "project/expected-identity.json").read_bytes()


def test_current_documentation_describes_default_identity_and_temporary_mode():
    text = DOC.read_text()
    for phrase in ["APPEND_SYSTEM.md", "default CONVERSATION", "oversight mode", "oversee-episode", "exact-session", "native compaction", "finalize_spec_episode", "15-minute"]:
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


def test_native_unclassifiable_marker_owners_block_before_provider(tmp_path):
    prime=shutil.which("prime-agent");assert prime
    for index, owner in enumerate([None, 7, ""]):
        case=tmp_path/str(index);case.mkdir();project=case/"project";(project/".prime/agent").mkdir(parents=True);(project/".prime/agent/APPEND_SYSTEM.md").write_text(KERNEL.read_text());skill=project/".ralph/skills/oversee-episode/SKILL.md";skill.parent.mkdir(parents=True);skill.write_text(SKILL.read_text())
        records=case/"records.jsonl";provider=case/"provider.ts";_provider_extension(provider,records)
        setup=case/"setup.ts";setup.write_text(f'''export default function s(pi){{pi.on("session_start",()=>pi.appendEntry("prime-claw-conversation-oversight",{{markerVersion:2,status:"active",ownerSessionId:{json.dumps(owner)},slug:"alpha",sourceLocation:".ralph/plans/future/alpha",episodeId:"11111111-1111-4111-8111-111111111111",episodeSessionFile:"/session",branch:"episode/alpha",worktree:"/worktree",sessionName:"alpha-episode",identityVersion:2,admission:"delivered"}}))}}''')
        env={**os.environ,"PRIME_AGENT_CODING_AGENT_DIR":str(case/"agent"),"PRIME_AGENT_INTERNAL_LEGACY_OWNED_WORKER_FRONTEND":"1"}
        completed=subprocess.run([prime,"--mode","text","--offline","--no-session","--no-skills","--no-prompt-templates","--no-context-files","--no-extensions","--cwd",str(project),"-e",str(provider),"-e",str(setup),"-e",str(EXTENSION),"--provider","poc","--model","m","-p","probe"],cwd=REPO,env=env,capture_output=True,text=True,timeout=20)
        assert completed.returncode!=0
        assert "owner is unclassifiable" in completed.stderr
        assert not records.exists()
