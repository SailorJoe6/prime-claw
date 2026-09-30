import json
import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
PROBE = REPO / "scripts" / "run-prime-agent-probe.sh"
PRIME = shutil.which("prime-agent")
SENTINEL = "PRIME_CLAW_GOAL_HEARTBEAT_CARRIER_PROBE_V1"
PROJECT_APPEND = "PROJECT_APPEND_SHADOW_FOR_GOAL_CARRIER_PROBE"


def _write_python_skill(path: Path, name: str) -> str:
    import_name = name.replace("-", "_")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f"---\nname: {name}\ndescription: Native carrier fixture for {name}.\n---\n{name} fixture\n"
    )
    pyproject = (
        "[build-system]\nrequires = []\nbuild-backend = 'fixture'\n\n"
        f"[project]\nname = 'carrier-{name}'\nversion = '0.0.0'\n"
    )
    (path.parent / "pyproject.toml").write_text(pyproject)
    package = path.parent / "src" / import_name
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("# native carrier fixture\n")
    return pyproject


def _write_provider(path: Path, records: Path) -> None:
    path.write_text(
        rf'''import{{appendFileSync}}from"node:fs";
import{{createAssistantMessageEventStream}}from"@earendil-works/pi-ai";
const records={json.dumps(str(records))},sentinel={json.dumps(SENTINEL)},projectAppend={json.dumps(PROJECT_APPEND)};
function count(text,needle){{return text.split(needle).length-1}}
function contentText(content){{if(typeof content==="string")return content;if(Array.isArray(content))return content.map(contentText).join("");if(content&&typeof content==="object"&&typeof content.text==="string")return content.text;return""}}
function message(model,content,reason){{return{{role:"assistant",content,api:model.api,provider:model.provider,model:model.id,usage:{{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}}},stopReason:reason,timestamp:Date.now()}}}}
export default function provider(pi){{pi.registerProvider("carrier",{{baseUrl:"fixture",apiKey:"fixture",api:"carrier",streamSimple(model,context){{const messages=context.messages??[],last=messages.at(-1),lastUser=[...messages].reverse().find(row=>row.role==="user"),label=contentText(lastUser?.content),kind=last?.role==="toolResult"?"tool-continuation":"primary",systemPrompt=context.systemPrompt;appendFileSync(records,JSON.stringify({{label,kind,systemPrompt,sentinelCount:count(systemPrompt,sentinel),projectAppendCount:count(systemPrompt,projectAppend),messageRoles:messages.map(row=>row.role)}})+"\n");const stream=createAssistantMessageEventStream();queueMicrotask(()=>{{if(kind==="primary"&&label.includes("FIRST_RUN")){{const call={{type:"toolCall",id:"carrier-probe-tool-call",name:"carrier_probe_tool",arguments:{{}}}},out=message(model,[call],"toolUse");stream.push({{type:"start",partial:out}});stream.push({{type:"toolcall_start",contentIndex:0,partial:out}});stream.push({{type:"toolcall_end",contentIndex:0,toolCall:call,partial:out}});stream.push({{type:"done",reason:"toolUse",message:out}})}}else{{const out=message(model,[{{type:"text",text:"ok"}}],"stop");stream.push({{type:"start",partial:out}});stream.push({{type:"done",reason:"stop",message:out}})}}stream.end()}});return stream}},models:[{{id:"m",name:"Carrier fixture",reasoning:false,input:["text"],cost:{{input:0,output:0,cacheRead:0,cacheWrite:0}},contextWindow:100000,maxTokens:1000}}]}})}}
'''
    )


def _write_probe_extension(path: Path, decisions: Path) -> None:
    path.write_text(
        rf'''import{{appendFileSync}}from"node:fs";
const decisions={json.dumps(str(decisions))},sentinel={json.dumps(SENTINEL)},projectAppend={json.dumps(PROJECT_APPEND)};
function count(text,needle){{return text.split(needle).length-1}}
export default function probe(pi){{pi.registerCommand("carrier-reload",{{description:"Reload carrier resources",handler:async(_args,ctx)=>{{await ctx.reload()}}}});pi.registerTool({{name:"carrier_probe_tool",label:"Carrier probe tool",description:"Return a deterministic local fixture result.",executionMode:"sequential",parameters:{{type:"object",properties:{{}},additionalProperties:false}},async execute(){{return{{content:[{{type:"text",text:"fixture-tool-result"}}],details:{{fixture:true}}}}}}}});pi.on("before_agent_start",event=>{{const rawTools=event.systemPromptOptions.selectedTools,selectedTools=rawTools??["ipython"],skillSignals=(event.systemPromptOptions.skills??[]).map(skill=>({{name:skill.name,kind:skill.kind,importName:skill.python?.importName??null,disableModelInvocation:skill.disableModelInvocation}})).sort((a,b)=>a.name.localeCompare(b.name)),hasGoal=skillSignals.some(skill=>skill.name==="goal"&&skill.kind==="python"&&skill.importName==="goal"&&!skill.disableModelInvocation),hasHeartbeat=skillSignals.some(skill=>skill.name==="rlm-heartbeat"&&skill.kind==="python"&&skill.importName==="rlm_heartbeat"&&!skill.disableModelInvocation),compatible=selectedTools.includes("ipython")&&hasGoal&&hasHeartbeat;appendFileSync(decisions,JSON.stringify({{prompt:event.prompt,rawSelectedTools:rawTools??null,selectedTools,skillSignals,hasGoal,hasHeartbeat,compatible,inputSystemPrompt:event.systemPrompt,inputSentinelCount:count(event.systemPrompt,sentinel),projectAppendCount:count(event.systemPrompt,projectAppend)}})+"\n");if(!compatible)return;return{{systemPrompt:`${{event.systemPrompt}}\n\n${{sentinel}}`}}}})}}
'''
    )


def _jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def _start_rpc(
    *, project: Path, sessions: Path, provider: Path, probe: Path,
    goal_skill: Path, heartbeat_skill: Path, resume: Path | None = None,
) -> subprocess.Popen:
    command = [
        str(PROBE), PRIME, "--mode", "rpc", "--offline",
        "--session-dir", str(sessions),
        "--no-skills", "--skill", str(goal_skill), "--skill", str(heartbeat_skill),
        "--no-prompt-templates", "--no-context-files", "--no-extensions",
        "--cwd", str(project), "-e", str(provider), "-e", str(probe),
        "--provider", "carrier", "--model", "m",
    ]
    if resume is not None:
        command.extend(["--resume", str(resume)])
    return subprocess.Popen(
        command,
        cwd=REPO,
        env={**os.environ, "PRIME_AGENT_INTERNAL_LEGACY_OWNED_WORKER_FRONTEND": "1"},
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )


def _rpc(process: subprocess.Popen, request: dict) -> tuple[dict, list[dict]]:
    assert process.stdin is not None and process.stdout is not None
    process.stdin.write(json.dumps(request) + "\n")
    process.stdin.flush()
    observed = []
    while True:
        line = process.stdout.readline()
        if not line:
            stderr = process.stderr.read() if process.stderr is not None else ""
            raise AssertionError(f"RPC closed before {request['id']}: {observed!r}\n{stderr}")
        event = json.loads(line)
        observed.append(event)
        if event.get("type") == "response" and event.get("id") == request["id"]:
            assert event.get("success") is True, event
            return event, observed


def _stop_rpc(process: subprocess.Popen) -> None:
    assert process.stdin is not None
    process.stdin.close()
    try:
        returncode = process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        returncode = process.wait(timeout=5)
    stderr = process.stderr.read() if process.stderr is not None else ""
    assert returncode == 0, stderr


def test_before_agent_start_is_transient_capability_gated_and_resume_safe(tmp_path: Path) -> None:
    assert PRIME, "prime-agent executable is required for the native characterization"
    status = subprocess.run(
        [PRIME, "status", "--json"], cwd=REPO, text=True,
        capture_output=True, timeout=30,
    )
    assert status.returncode == 0, status.stdout + status.stderr
    active = [
        row for row in json.loads(status.stdout or "[]")
        if row.get("pid") and row.get("status") != "stopped"
    ]
    if active:
        pytest.skip(
            "native carrier probe requires an operator-controlled maintenance window "
            "with no active Prime Agent process"
        )
    version = subprocess.run(
        [str(PROBE), PRIME, "--version"], cwd=REPO, text=True,
        capture_output=True, timeout=30,
    )
    assert version.returncode == 0, version.stdout + version.stderr
    version_text = (version.stdout + version.stderr).strip()
    assert re.fullmatch(r"\d+\.\d+\.\d+", version_text)

    project = tmp_path / "project"
    project_append = project / ".prime" / "agent" / "APPEND_SYSTEM.md"
    project_append.parent.mkdir(parents=True)
    project_append.write_text(PROJECT_APPEND)
    sessions = tmp_path / "sessions"
    sessions.mkdir()
    skills = tmp_path / "skills"
    goal_skill = skills / "goal" / "SKILL.md"
    heartbeat_skill = skills / "rlm-heartbeat" / "SKILL.md"
    _write_python_skill(goal_skill, "goal")
    heartbeat_pyproject = _write_python_skill(heartbeat_skill, "rlm-heartbeat")

    provider_records = tmp_path / "provider-records.jsonl"
    decisions = tmp_path / "decisions.jsonl"
    provider = tmp_path / "carrier-provider.ts"
    probe = tmp_path / "carrier-probe.ts"
    _write_provider(provider, provider_records)
    _write_probe_extension(probe, decisions)

    first = _start_rpc(
        project=project, sessions=sessions, provider=provider, probe=probe,
        goal_skill=goal_skill, heartbeat_skill=heartbeat_skill,
    )
    _rpc(first, {"id": "first", "type": "prompt", "message": "FIRST_RUN"})
    _rpc(first, {"id": "second", "type": "prompt", "message": "SECOND_RUN"})
    (heartbeat_skill.parent / "pyproject.toml").unlink()
    _rpc(first, {"id": "reload-missing", "type": "prompt", "message": "/carrier-reload"})
    _rpc(first, {
        "id": "missing", "type": "prompt",
        "message": "MISSING_HEARTBEAT_AFTER_RELOAD",
    })
    (heartbeat_skill.parent / "pyproject.toml").write_text(heartbeat_pyproject)
    _rpc(first, {"id": "reload-restored", "type": "prompt", "message": "/carrier-reload"})
    _rpc(first, {
        "id": "restored", "type": "prompt", "message": "RESTORED_AFTER_RELOAD",
    })
    state, _ = _rpc(first, {"id": "state", "type": "get_state"})
    session_file = Path(state["data"]["sessionFile"])
    _stop_rpc(first)

    resumed = _start_rpc(
        project=project, sessions=sessions, provider=provider, probe=probe,
        goal_skill=goal_skill, heartbeat_skill=heartbeat_skill, resume=session_file,
    )
    _rpc(resumed, {
        "id": "resume", "type": "prompt", "message": "SAVED_SESSION_RESUME",
    })
    _stop_rpc(resumed)

    hooks = _jsonl(decisions)
    calls = _jsonl(provider_records)
    expected_prompts = [
        "FIRST_RUN",
        "SECOND_RUN",
        "MISSING_HEARTBEAT_AFTER_RELOAD",
        "RESTORED_AFTER_RELOAD",
        "SAVED_SESSION_RESUME",
    ]
    assert [row["prompt"] for row in hooks] == expected_prompts
    assert all(row["inputSentinelCount"] == 0 for row in hooks)
    assert all(row["projectAppendCount"] == 1 for row in hooks)
    assert all(row["rawSelectedTools"] is not None for row in hooks)
    assert all("ipython" in row["selectedTools"] for row in hooks)
    assert all(row["hasGoal"] is True for row in hooks)
    missing = next(row for row in hooks if row["prompt"] == "MISSING_HEARTBEAT_AFTER_RELOAD")
    assert missing["compatible"] is False
    assert missing["hasHeartbeat"] is False
    heartbeat_signal = next(
        signal for signal in missing["skillSignals"] if signal["name"] == "rlm-heartbeat"
    )
    assert heartbeat_signal["kind"] == "markdown"
    assert heartbeat_signal["importName"] is None
    for row in hooks:
        if row is not missing:
            assert row["compatible"] is True
            assert row["hasHeartbeat"] is True
            assert any(
                signal["name"] == "goal"
                and signal["kind"] == "python"
                and signal["importName"] == "goal"
                for signal in row["skillSignals"]
            )
            assert any(
                signal["name"] == "rlm-heartbeat"
                and signal["kind"] == "python"
                and signal["importName"] == "rlm_heartbeat"
                for signal in row["skillSignals"]
            )

    assert [(row["label"], row["kind"]) for row in calls] == [
        ("FIRST_RUN", "primary"),
        ("FIRST_RUN", "tool-continuation"),
        ("SECOND_RUN", "primary"),
        ("MISSING_HEARTBEAT_AFTER_RELOAD", "primary"),
        ("RESTORED_AFTER_RELOAD", "primary"),
        ("SAVED_SESSION_RESUME", "primary"),
    ]
    assert all(row["projectAppendCount"] == 1 for row in calls)
    assert all(
        row["sentinelCount"] == (0 if row["label"] == "MISSING_HEARTBEAT_AFTER_RELOAD" else 1)
        for row in calls
    )
    first_calls = [row for row in calls if row["label"] == "FIRST_RUN"]
    assert first_calls[0]["systemPrompt"] == first_calls[1]["systemPrompt"]

    session_text = session_file.read_text()
    session_entries = _jsonl(session_file)
    assert SENTINEL not in session_text
    durable_messages = [row for row in session_entries if row.get("type") == "message"]
    assert any("FIRST_RUN" in json.dumps(row) for row in durable_messages)
    assert any("SAVED_SESSION_RESUME" in json.dumps(row) for row in durable_messages)
    assert any(row.get("message", {}).get("role") == "toolResult" for row in durable_messages)
    assert not any(SENTINEL in json.dumps(row) for row in durable_messages)
