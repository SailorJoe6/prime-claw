import json
import os
import shutil
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
KERNEL = REPO / "src/prime-agent-plugin/APPEND_SYSTEM.md"
EXTENSION = REPO / "src/prime-agent-plugin/extensions/project-conversation.ts"
SUPPORT = REPO / "src/prime-agent-plugin/extension-support/conversation-oversight.ts"
SKILL = REPO / ".ralph/skills/oversee-episode/SKILL.md"
DOC = REPO / "docs/conversation-driven-episode-oversight.md"


def test_managed_identity_kernel_is_small_and_routes_bounded_roles():
    text = KERNEL.read_text()
    for phrase in ["PRIME_CLAW_CONVERSATION_IDENTITY_V1", "CONVERSATION", "EPISODE", "EXPERT", "delegated", "exact-session", "compaction"]:
        assert phrase in text
    assert "oversee-episode" in text
    assert "daemon protocol" not in text
    assert len(text.splitlines()) < 30


def test_canonical_oversight_package_contains_reviewed_policy():
    text = SKILL.read_text()
    for phrase in ["name: oversee-episode", "one owner-coordination message", "15-minute", "exact pushed candidate", "owner ledger", "advance", "revise", "consult", "pause", "finalize_spec_episode", "Only the operator", "ordinary CONVERSATION mode"]:
        assert phrase in text


def test_extension_uses_context_and_exact_state_without_rejected_flag_profile():
    extension = EXTENSION.read_text(); support = SUPPORT.read_text()
    assert 'pi.on("context"' in extension
    assert 'pi.on("session_start"' in extension
    assert 'pi.on("session_shutdown"' in extension
    assert "registerFlag" not in extension
    assert "before_agent_start" not in extension
    assert "project-conversation.md" not in extension + support
    for phrase in ["IDENTITY_KERNEL", "OVERSIGHT_MARKER_TYPE", "getBranch()", "spec-episodes", "OVERSIGHT_PACKAGE_PATH", "ctx.abort()", "active oversight marker disagrees", "filter"]:
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


def test_native_missing_kernel_blocks_visibly_before_provider(tmp_path):
    completed, records = _run_native(tmp_path, False)
    assert completed.returncode != 0
    assert "expected exactly one managed identity kernel, found 0" in completed.stderr
    assert not records.exists()


def test_native_inactive_conversation_gets_one_kernel_and_no_package(tmp_path):
    completed, records = _run_native(tmp_path, True)
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert json.loads(records.read_text()) == {"kernel": 1, "package": 0}


def test_current_documentation_describes_default_identity_and_temporary_mode():
    text = DOC.read_text()
    for phrase in ["APPEND_SYSTEM.md", "default CONVERSATION", "oversight mode", "oversee-episode", "exact-session", "native compaction", "finalize_spec_episode", "15-minute"]:
        assert phrase in text
    assert "--project-conversation" not in text
