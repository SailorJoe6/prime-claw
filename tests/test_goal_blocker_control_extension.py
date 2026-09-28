import json
import shutil
import subprocess
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
EXTENSION = REPO / "src" / "prime-agent-plugin" / "extensions" / "goal-blocker-control.ts"
PROBE = REPO / "scripts" / "run-prime-agent-probe.sh"


def test_goal_blocker_control_supports_background_waits_and_human_blockers() -> None:
    text = EXTENSION.read_text()

    for fragment in (
        'name: "pause_thread_goal"',
        'name: "resume_thread_goal"',
        "For substantive multi-step work, create a persistent goal",
        "smallest end-to-end outcome",
        "Do not create goals for trivial answers",
        "observable long-running process",
        "rlm_heartbeat",
        "background work finishes",
        "externally blocked",
        'pi.sendUserMessage("/goal pause", { deliverAs: "steer" })',
        'pi.sendUserMessage("/goal resume", { deliverAs: "followUp" })',
    ):
        assert fragment in text

    assert "thread_goal_state" in text
    assert "private AgentSession methods" in text
    assert 'from "typebox"' not in text


def test_native_plugin_injects_bounded_work_guidance_without_ralph_skill(tmp_path: Path) -> None:
    prime = shutil.which("prime-agent")
    assert prime, "prime-agent is required for native plugin verification"
    records = tmp_path / "records.jsonl"
    provider = tmp_path / "provider.ts"
    provider.write_text(
        r'''import {appendFileSync} from "node:fs";
import {createAssistantMessageEventStream} from "@earendil-works/pi-ai";
const records=RECORDS;
export default function provider(pi){pi.registerProvider("poc",{baseUrl:"x",apiKey:"x",api:"poc",streamSimple(model,context){appendFileSync(records,JSON.stringify({systemPrompt:context.systemPrompt})+"\n");const stream=createAssistantMessageEventStream();queueMicrotask(()=>{const message={role:"assistant",content:[{type:"text",text:"ok"}],api:model.api,provider:model.provider,model:model.id,usage:{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:"stop",timestamp:Date.now()};stream.push({type:"start",partial:message});stream.push({type:"done",reason:"stop",message});stream.end()});return stream},models:[{id:"m",name:"M",reasoning:false,input:["text"],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:10000,maxTokens:1000}]})}'''.replace("RECORDS", json.dumps(str(records)))
    )

    completed = subprocess.run(
        [
            str(PROBE),
            prime,
            "--mode", "text",
            "--offline",
            "--no-session",
            "--no-skills",
            "--no-prompt-templates",
            "--no-context-files",
            "--no-extensions",
            "--cwd", str(tmp_path),
            "-e", str(provider),
            "-e", str(EXTENSION),
            "--provider", "poc",
            "--model", "m",
            "-p", "probe",
        ],
        cwd=REPO,
        text=True,
        capture_output=True,
        timeout=20,
        check=False,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    prompt = json.loads(records.read_text().splitlines()[-1])["systemPrompt"]
    for fragment in (
        "For substantive multi-step work, create a persistent goal",
        "pause_thread_goal",
        "rlm_heartbeat",
        "resume_thread_goal",
    ):
        assert fragment in prompt
