"""Docker-authoritative runtime tests for the official EXPERT prerequisite."""

import json
import time
from pathlib import Path


def test_official_expert_exact_interpreter_preflight_matrix(tier1_container) -> None:
    work = f"/tmp/official-expert-preflight-{time.time_ns()}"
    result = tier1_container.run(
        "python3",
        "/workspace/tests/container/expert_runtime_probe.py",
        "/workspace/scripts/check-prime-agent-expert-runtime.py",
        "/workspace/src/prime-agent-plugin/skills/prime-claw-official-expert-review",
        work,
        "/workspace/src/prime-agent-plugin/extension-support/expert-review-reservation.ts",
        workdir=None,
        timeout=180,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout.strip().splitlines()[-1]) == {
        "configured": "AVAILABLE",
        "managed": "SYNC_PENDING",
        "ok": True,
    }


def test_official_expert_native_first_call_and_refusals(tier1_container, ctmp) -> None:
    '''Exercise real 0.9.8 context conversion and the provider-call boundary.'''
    import hashlib
    import os

    root = ctmp / "expert-native-provider"
    root.mkdir()
    project = root / "project"
    repository = root / "episode"
    project.mkdir()
    repository.mkdir()
    module_uri = "file:///workspace/src/prime-agent-plugin/extension-support/expert-review-reservation.ts"
    guide_root = "/workspace/src/prime-agent-plugin"
    package_sha = "a" * 64
    commit_oid = "c" * 40
    cases = []
    for index, kind in enumerate((
        "valid", "overlap-resolves", "overlap-persists", "mismatch", "timeout",
        "reported", "settled", "dispositioned", "closed", "cancelled",
    ), start=1):
        case = root / kind
        state_root = case / "private-state"
        session_dir = case / f"sub-native-{kind}"
        state_root.mkdir(parents=True, mode=0o700)
        os.chmod(state_root, 0o700)
        session_dir.mkdir()
        owner_id = f"00000000-0000-7000-8000-{index:012d}"
        child_id = f"10000000-0000-7000-8000-{index:012d}"
        owner_file = case / "owner.jsonl"
        child_file = session_dir / f"{child_id}.jsonl"
        child_name = f"expert-review-native-{kind}-abcdefghijkl"
        marker = {
            "markerVersion": 2, "status": "active", "ownerSessionId": owner_id,
            "slug": "native-probe", "sourceLocation": ".ralph/plans/future/native-probe",
            "episodeId": f"20000000-0000-7000-8000-{index:012d}",
            "episodeSessionFile": str(repository / "episode.jsonl"),
            "branch": "episode/native-probe", "worktree": str(repository),
            "sessionName": "native-probe-episode", "identityVersion": 2,
            "admission": "delivered",
        }
        owner_header = {
            "type": "session", "version": 3, "id": owner_id,
            "timestamp": "2026-10-07T00:00:00.000Z", "cwd": str(project), "rlmDepth": 0,
        }
        marker_entry = {
            "type": "custom", "id": f"marker-{index}", "parentId": None,
            "timestamp": owner_header["timestamp"],
            "customType": "prime-claw-conversation-oversight", "data": marker,
        }
        owner_file.write_text(json.dumps(owner_header) + "\n" + json.dumps(marker_entry) + "\n")
        os.chmod(owner_file, 0o600)
        child_header = {
            "type": "session", "version": 3, "id": child_id,
            "timestamp": owner_header["timestamp"], "cwd": str(project),
            "parentSession": str(owner_file), "rlmDepth": 1,
        }
        child_info = {
            "type": "session_info", "id": f"info-{index}", "parentId": None,
            "timestamp": owner_header["timestamp"], "name": child_name,
        }
        child_file.write_text(json.dumps(child_header) + "\n" + json.dumps(child_info) + "\n")
        os.chmod(child_file, 0o600)
        generation_values = [
            2, owner_id, marker["slug"], marker["sourceLocation"], marker["episodeId"],
            str(repository / "episode.jsonl"), marker["branch"], str(repository),
            marker["sessionName"], 2, marker["admission"],
        ]
        owner_generation = hashlib.sha256(json.dumps(generation_values, separators=(",", ":")).encode()).hexdigest()
        packet = {
            "schemaVersion": 1, "kind": "prime-claw-official-expert-review-packet",
            "repositoryPath": str(repository), "commitOid": commit_oid,
            "specificationPath": ".ralph/plans/SPECIFICATION.md",
            "executionPlanPath": ".ralph/plans/EXECUTION_PLAN.md",
            "evidencePaths": ["docs/evidence/native.md"],
            "focus": "Review the native provider seam.",
        }
        packet_json = json.dumps(packet, sort_keys=True, separators=(",", ":"))
        record = {
            "schema": "prime-claw-official-expert-launch-v1", "phase": "FINALIZED", "nonce": "n" * 43,
            "createdAt": 1000, "expiresAt": 901000,
            "ownerSessionId": owner_id, "ownerSessionFile": str(owner_file),
            "ownerHeaderId": owner_id, "ownerGeneration": owner_generation,
            "projectPath": str(project), "repositoryPath": str(repository),
            "candidateCommitOid": commit_oid,
            "preReviewRepository": {
                "head": commit_oid, "clean": True, "statusBytes": 0,
                "statusSha256": hashlib.sha256(b"").hexdigest(),
            },
            "packet": packet, "packetJson": packet_json,
            "packetDigest": hashlib.sha256(packet_json.encode()).hexdigest(),
            "packageSha256": package_sha,
            "kernelSha256": "fd370726c28097b4201f538958e32ddc0af8abdb7c72d675412df0c698bb328e",
            "selector": "openai-codex/gpt-6-astra", "thinking": "max",
            "childName": child_name,
            "bootstrapDigest": hashlib.sha256(b"harmless bootstrap").hexdigest(),
            "finalizedAt": 1100, "rlmChildId": session_dir.name,
            "sessionDir": str(session_dir), "returnedModel": "openai-codex/gpt-6-astra",
        }
        if kind == "mismatch":
            record["returnedModel"] = "openai-codex/wrong"
        if kind in ("reported", "settled", "dispositioned", "closed", "cancelled"):
            record.update({
                "phase": kind.upper(), "claimedAt": 1200,
                "childSessionId": child_id, "childSessionFile": str(child_file),
                "childSessionName": child_name,
            })
        phase = "pending" if kind == "timeout" else kind if kind in (
            "reported", "settled", "dispositioned", "closed", "cancelled",
        ) else "finalized"
        state_file = state_root / f"{child_name}.{phase}.json"
        state_file.write_text(json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n")
        os.chmod(state_file, 0o600)
        pending_file = state_root / f"{child_name}.pending.json"
        if kind in ("overlap-resolves", "overlap-persists"):
            pending_record = {
                key: value for key, value in record.items()
                if key not in {"finalizedAt", "rlmChildId", "sessionDir", "returnedModel"}
            }
            pending_record["phase"] = "PENDING"
            pending_file.write_text(json.dumps(pending_record, sort_keys=True, separators=(",", ":")) + "\n")
            os.chmod(pending_file, 0o600)
        raw_path = case / "raw.jsonl"
        notices_path = case / "notices.jsonl"
        provider_path = case / "provider.jsonl"
        provider_extension = case / "provider.ts"
        provider_extension.write_text(rf'''
import {{appendFileSync}} from "node:fs";
import {{createAssistantMessageEventStream}} from "@earendil-works/pi-ai";
const output={json.dumps(str(provider_path))};
export default function provider(pi){{pi.registerProvider("openai-codex",{{baseUrl:"x",apiKey:"x",api:"native-expert",streamSimple(model,context){{appendFileSync(output,JSON.stringify({{roles:(context.messages??[]).map(m=>m.role),messages:context.messages,systemPrompt:context.systemPrompt}})+"\n");const stream=createAssistantMessageEventStream();queueMicrotask(()=>{{const message={{role:"assistant",content:[{{type:"text",text:"ok"}}],api:model.api,provider:model.provider,model:model.id,usage:{{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}}},stopReason:"stop",timestamp:Date.now()}};stream.push({{type:"start",partial:message}});stream.push({{type:"done",reason:"stop",message}});stream.end()}});return stream}},models:[{{id:"gpt-6-astra",name:"Astra",reasoning:true,input:["text"],cost:{{input:0,output:0,cacheRead:0,cacheWrite:0}},contextWindow:100000,maxTokens:1000}}]}})}}
''')
        setup_extension = case / "setup.ts"
        wait_action = (
            f'if(existsSync({json.dumps(str(pending_file))}))unlinkSync({json.dumps(str(pending_file))});'
            if kind == "overlap-resolves" else ""
        )
        setup_extension.write_text(rf'''
import {{appendFileSync,existsSync,unlinkSync}} from "node:fs";
import {{registerOfficialExpertReviewReservation}} from {json.dumps(module_uri)};
const raw={json.dumps(str(raw_path))},notices={json.dumps(str(notices_path))};
export default function setup(pi){{pi.on("context",(event,ctx)=>{{const prior=ctx.ui.notify.bind(ctx.ui);ctx.ui.notify=(message,level)=>{{appendFileSync(notices,JSON.stringify({{message,level}})+"\n");prior(message,level)}};appendFileSync(raw,JSON.stringify((event.messages??[]).map(message=>message.role))+"\n");return{{messages:event.messages}}}});registerOfficialExpertReviewReservation(pi,{{guideRoot:{json.dumps(guide_root)},stateRoot:{json.dumps(str(state_root))},now:()=>2000,admissionWaitMs:2,wait:async()=>{{{wait_action}}},packageStatus:()=>({{schemaVersion:1,status:"AVAILABLE",mode:"managed",packageSha256:{json.dumps(package_sha)}}}),repositoryIdentity:()=>({{repositoryPath:{json.dumps(str(repository))},commitOid:{json.dumps(commit_oid)}}})}})}}
''')
        cases.append({"kind": kind, "childFile": str(child_file), "sessionDir": str(session_dir), "provider": str(provider_extension), "setup": str(setup_extension), "raw": str(raw_path), "notices": str(notices_path), "providerOutput": str(provider_path), "stateRoot": str(state_root)})

    outcomes = {}
    for item in cases:
        command = tier1_container.run(
            "prime-agent", "--mode", "text", "--offline",
            "--resume", item["childFile"], "--no-skills",
            "--no-prompt-templates", "--no-context-files", "--no-extensions",
            "--cwd", str(project), "-e", item["provider"], "-e", item["setup"],
            "--provider", "openai-codex", "--model", "gpt-6-astra",
            "-p", "harmless bootstrap", timeout=30, workdir=None,
        )
        def lines(path):
            value = Path(path)
            return [json.loads(line) for line in value.read_text().splitlines()] if value.exists() else []
        outcomes[item["kind"]] = {
            "returncode": command.returncode,
            "stdout": command.stdout,
            "stderr": command.stderr,
            "raw": lines(item["raw"]),
            "notices": lines(item["notices"]),
            "provider": lines(item["providerOutput"]),
            "files": sorted(path.name for path in Path(item["stateRoot"]).iterdir()),
        }

    valid = outcomes["valid"]
    assert valid["returncode"] == 0, valid["stdout"] + valid["stderr"]
    assert len(valid["provider"]) == 1, valid["notices"]
    assert valid["raw"] and valid["raw"][0].count("custom") >= 1
    assert valid["raw"][0].count("user") == 1
    provider_row = valid["provider"][0]
    assert provider_row["roles"] == ["user"]
    provider_text = provider_row["messages"][0]["content"][0]["text"]
    assert "## Immutable review packet" in provider_text
    assert "harmless bootstrap" not in provider_text
    assert "PRIME_CLAW_ROLE_KERNEL_V1" in provider_row["systemPrompt"]
    assert any(name.endswith(".claimed.json") for name in valid["files"])

    resolved = outcomes["overlap-resolves"]
    assert resolved["returncode"] == 0, resolved["stdout"] + resolved["stderr"]
    assert len(resolved["provider"]) == 1, resolved["notices"]
    assert any(name.endswith(".claimed.json") for name in resolved["files"])
    assert not any(name.endswith(".pending.json") for name in resolved["files"])
    assert not any(name.endswith(".finalized.json") for name in resolved["files"])

    for kind in ("overlap-persists", "mismatch", "timeout", "reported", "settled", "dispositioned", "closed", "cancelled"):
        assert outcomes[kind]["provider"] == []
        assert outcomes[kind]["notices"], outcomes[kind]
    persistent = outcomes["overlap-persists"]
    assert "conflicting official EXPERT private phase files" in persistent["notices"][-1]["message"]
    assert any(name.endswith(".pending.json") for name in persistent["files"])
    assert any(name.endswith(".finalized.json") for name in persistent["files"])
    for kind in ("reported", "settled", "dispositioned", "closed", "cancelled"):
        assert f"{kind} review child" in outcomes[kind]["notices"][-1]["message"]
