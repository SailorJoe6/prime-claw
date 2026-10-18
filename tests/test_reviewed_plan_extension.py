"""Reviewed plan and Episode lifecycle regression bridge.

Behavior suites run inside the isolated Tier-1 container. Static policy checks
remain host-safe Tier 0.
"""
import json
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
EXTENSION = REPO / "src/prime-agent-plugin/extensions/reviewed-plan.ts"
EPISODE_EXTENSION = REPO / "src/prime-agent-plugin/extension-support/spec-episode.ts"
WS_EXTENSION = "/workspace/src/prime-agent-plugin/extensions/reviewed-plan.ts"
WS_EPISODE_EXTENSION = "/workspace/src/prime-agent-plugin/extension-support/spec-episode.ts"
WS_REVIEWED_PLAN_NODE_SUITE = "/workspace/tests/reviewed_plan_extension.test.mjs"
WS_SPEC_EPISODE_NODE_SUITE = "/workspace/tests/spec_episode_extension.test.mjs"
WS_EPISODE_CLOSE_NODE_SUITE = "/workspace/tests/episode_close_extension.test.mjs"


def test_reviewed_plan_node_suite(tier1_container) -> None:
    result = tier1_container.run("node", "--experimental-strip-types", "--test", WS_REVIEWED_PLAN_NODE_SUITE, timeout=120)
    assert result.returncode == 0, result.stdout + result.stderr


def test_spec_episode_node_suite(tier1_container) -> None:
    result = tier1_container.run("node", "--experimental-strip-types", "--test", WS_SPEC_EPISODE_NODE_SUITE, timeout=180)
    assert result.returncode == 0, result.stdout + result.stderr


def test_episode_close_node_suite(tier1_container) -> None:
    result = tier1_container.run("node", "--experimental-strip-types", "--test", WS_EPISODE_CLOSE_NODE_SUITE, timeout=120)
    assert result.returncode == 0, result.stdout + result.stderr


def test_real_v098_fresh_session_is_flushed_before_daemon_publication(tier1_container, ctmp) -> None:
    cwd = ctmp / "fresh-session"
    cwd.mkdir()
    result_file = ctmp / "fresh-session-result.json"
    driver = ctmp / "fresh-session-proof.ts"
    driver.write_text(f"""import {{existsSync,writeFileSync}} from 'node:fs';
import {{SessionManager}} from '@earendil-works/pi-coding-agent';
import {{PrimeSessionPublisher,runtimeSessionManagerClass}} from '{WS_EPISODE_EXTENSION}';
const cwd={json.dumps(str(cwd))},resultFile={json.dumps(str(result_file))};
export default function proof(pi){{pi.on('session_start',async()=>{{
  try{{
    const Runtime=runtimeSessionManagerClass(SessionManager.inMemory(cwd));
    let allocated;
    const client={{async request(command){{
      if(command.type!=='create')throw new Error('unexpected daemon request '+command.type);
      if(!existsSync(command.sessionPath))throw new Error('allocated header was not durable');
      const opened=await SessionManager.openAsync(command.sessionPath,undefined,command.config.cwd);
      return {{success:true,data:{{activeSessionId:'route',sessionId:opened.getSessionId(),sessionFile:command.sessionPath,cwd:command.config.cwd,sessionName:command.name}}}};
    }},close(){{}}}};
    const publisher=new PrimeSessionPublisher(client,Runtime);
    const published=await publisher.createFresh({{worktree:cwd,sessionName:'fresh-episode',onAllocated(identity){{allocated=identity;if(!existsSync(identity.sessionFile))throw new Error('allocation callback preceded flush');}}}});
    publisher.close();
    writeFileSync(resultFile,JSON.stringify({{allocated,published,sameId:allocated.sessionId===published.sessionId,sameFile:allocated.sessionFile===published.sessionFile}}));
  }}catch(error){{writeFileSync(resultFile,JSON.stringify({{error:String(error),stack:error?.stack}}));}}
}})}}
""")
    request = json.dumps({"id": "commands", "type": "get_commands"}) + "\n"
    result = tier1_container.run(
        "/workspace/scripts/run-prime-agent-probe.sh", tier1_container.prime_agent,
        "--mode", "rpc", "--offline", "--no-session", "--no-skills", "--no-prompt-templates", "--no-context-files", "--no-extensions",
        "--cwd", str(cwd), "-e", str(driver), input_text=request, timeout=60, workdir=None,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    proof = json.loads(result_file.read_text())
    assert "error" not in proof, proof
    assert proof["sameId"] is True
    assert proof["sameFile"] is True
    assert proof["published"]["activeSessionId"] == "route"


def test_episode_creation_uses_fresh_host_session_without_runtime_package_import() -> None:
    source = EPISODE_EXTENSION.read_text()
    assert 'import("@earendil-works/pi-coding-agent")' not in source
    assert "runtimeSessionManagerClass(ctx.sessionManager)" in source
    assert "Object.getPrototypeOf(sessionManager)?.constructor" in source
    assert 'typeof candidate.create !== "function"' in source
    assert "forkFrom(" not in source
    assert "appendEpisodeIdentity" not in source


def test_prime_agent_rpc_loads_renamed_commands_and_simplified_tools(tier1_container, ctmp) -> None:
    request = json.dumps({"id": "loader", "type": "get_commands"}) + "\n"
    probe = ctmp / "tool-probe.ts"
    probe.write_text("""import {writeFileSync} from "node:fs";
const out=process.env.TOOL_SNAPSHOT;
export default function probe(pi){pi.on("session_start",()=>{const names=pi.getAllTools().map(t=>t.name).sort();writeFileSync(out,JSON.stringify(names));if(names.includes("plan_spec")&&names.includes("plan_task")&&names.includes("create_spec_episode")&&names.includes("handoff_spec_episode")&&names.includes("finalize_spec_episode")&&names.includes("restore_blocked_spec_episode")&&names.includes("create_task_episode")&&names.includes("handoff_task_episode")&&names.includes("finalize_task_episode")&&names.includes("transition_spec_episode_to_task")&&!names.includes("ralph_plan")&&!names.includes("prime_claw_activate_conversation_guide")&&!names.includes("prime_claw_conversation_guide_status")){pi.registerCommand("probe-reviewed-plan-tools",{description:"proof",handler:async()=>{}})}})}""")
    snapshot = ctmp / "tools.json"
    result = tier1_container.run(
        "/workspace/scripts/run-prime-agent-probe.sh", tier1_container.prime_agent, "--mode", "rpc", "--offline", "--no-session", "--no-skills",
        "--no-prompt-templates", "--no-context-files", "--no-extensions", "--cwd", str(ctmp),
        "-e", WS_EXTENSION, "-e", str(probe), input_text=request, timeout=40, workdir=None,
        env={"TOOL_SNAPSHOT": str(snapshot)},
    )
    assert result.returncode == 0, result.stdout + result.stderr
    response = json.loads(result.stdout.strip().splitlines()[-1])
    assert response["success"] is True
    commands = response["data"]["commands"]
    for name in ("plan-spec", "plan", "implement-spec", "implement-task"):
        matches = [command for command in commands if command["name"] == name]
        assert len(matches) == 1
        assert matches[0]["sourceInfo"]["path"] == WS_EXTENSION
    assert [command["name"] for command in commands].count("probe-reviewed-plan-tools") == 1
    tools = json.loads(snapshot.read_text())
    for name in ("plan_spec", "plan_task", "create_spec_episode", "handoff_spec_episode", "finalize_spec_episode", "restore_blocked_spec_episode", "create_task_episode", "handoff_task_episode", "finalize_task_episode", "transition_spec_episode_to_task"):
        assert name in tools



def test_task_finalization_surface_is_cleanup_only() -> None:
    extension = EXTENSION.read_text()
    support = EPISODE_EXTENSION.read_text()
    for removed in (
        "readyReceipt", "readyProgress", "changesProgress", "terminalEvidence",
        "publishTaskEpisodeReadyForMerge", "mergeTaskEpisodeReadyForMerge",
        "abandonTaskEpisode", "TaskEpisodeReadyHandshakeEvidence",
    ):
        assert removed not in extension
        assert removed not in support
    assert 'name: "finalize_task_episode"' in extension
    assert 'enum: ["merged", "abandoned"]' in extension
    assert 'required: ["taskId", "episodeHead", "outcome", "confirmed"]' in extension
    assert "cleanupHead" in support
    assert 'runGit(repo, ["merge", "--ff-only"' not in support


def test_repository_status_cutover_uses_task_native_order_without_to_do() -> None:
    config = yaml.safe_load((REPO / "backlog/config.yml").read_text())
    assert config["default_status"] == "In Design"
    assert config["statuses"] == [
        "In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done",
    ]
    assert "To Do" not in config["statuses"]


def test_compact_first_workflows_and_normal_guide_load_are_explicit() -> None:
    extension = EXTENSION.read_text()
    plan_prep = (REPO / "src/prime-agent-plugin/workflows/plan-prep.md").read_text()
    implement_prep = (REPO / "src/prime-agent-plugin/workflows/implement-prep.md").read_text()
    implement = (REPO / "src/prime-agent-plugin/workflows/implement-spec.md").read_text()
    assert 'command: "plan-spec"' in extension
    assert 'name: "plan_spec"' in extension
    assert 'pi.registerCommand("plan"' in extension
    assert 'name: "plan_task"' in extension
    assert 'name: "ralph_plan"' not in extension
    assert "compact.run(focus_hint)" in plan_prep
    assert "compact.run(focus_hint)" in implement_prep
    assert "conversationGuideText(oversightOptions)" in extension
    assert "activation, disclosure, receipt, or readiness tool" in implement


def test_creation_policy_matches_frozen_orca_boundary() -> None:
    source = EPISODE_EXTENSION.read_text()
    for phrase in (
        '"--no-parent"', '"--setup", "skip"', '"--provider", "prime-agent"',
        '"--reuse-session"', '"--disabled"', "Remote Episode placement is disabled",
        "OrcaUnavailableError", "OrcaMutationUncertainError", "createFresh",
    ):
        assert phrase in source
    assert '"--activate"' not in source


def test_episode_tests_prove_fresh_orca_and_local_assignment_boundaries() -> None:
    tests = (REPO / "tests/spec_episode_extension.test.mjs").read_text()
    for phrase in (
        "promotes before exactly one native execute assignment",
        "definitive pre-mutation Orca unavailability uses fresh local fallback once",
        "uncertainty preserves one record and never falls back",
        "uncertain replay never replays assignment",
    ):
        assert phrase in tests
    assert "forkPrimeSession" not in tests


def test_current_docs_preserve_authority_and_transport_boundaries() -> None:
    future = (REPO / "docs/future-specification-bundles.md").read_text()
    oversight = (REPO / "docs/conversation-driven-episode-oversight.md").read_text()
    handoff = (REPO / "docs/handoff-chain.md").read_text()
    for phrase in ("`/plan-spec`", "`plan_spec`", "Remote selection is rejected", "one fixed execute assignment", "not permission to retry"):
        assert phrase in future
    assert "operator alone decides" in oversight.lower()
    assert "never retried automatically" in handoff

def test_activation_truth_docs_are_task_native_first_with_explicit_folder_compatibility() -> None:
    expected_terms = {
        "VISION.md": ("/implement-task task-id", "version-2 ownership", "retained version-1 compatibility"),
        "docs/backlog.md": ("/plan task-id", "/implement-task task-id", "retained version-1 compatibility"),
        "docs/future-specification-bundles.md": ("primary task-native lifecycle", "create_task_episode", "retained version-1 compatibility"),
        "docs/conversation-driven-episode-oversight.md": (
            "primary task-native path",
            "finalize_task_episode",
            "reject existing non-terminal ownership",
            "retained version-1 compatibility",
        ),
        "docs/user-stories/README.md": ("primary task-native lifecycle", "handoff_task_episode", "retained version-1 compatibility"),
        "docs/user-stories/C-specification.md": ("primary version-2 task episodes", "retained version-1 compatibility"),
        "docs/user-stories/E-episode-promotion.md": (
            "/implement-task task-id",
            "create_task_episode",
            "public admission replay fails closed",
            "proven clean failure",
            "blocked",
            "retained version-1 compatibility",
        ),
        "docs/user-stories/H-handoff-and-continuation.md": ("primary task-native continuation", "handoff_task_episode", "retained version-1 compatibility"),
        "docs/user-stories/I-episode-finalization.md": ("primary task-native lifecycle", "finalize_task_episode", "retained version-1 compatibility"),
        "docs/user-stories/traceability.md": ("primary task-native", "finalize_task_episode", "retained version-1 compatibility"),
    }

    for path, terms in expected_terms.items():
        text = " ".join((REPO / path).read_text().lower().split())
        for term in terms:
            assert term in text, (path, term)


def test_traceability_covers_both_episode_schemas_at_creation_recovery_and_finish() -> None:
    lines = (REPO / "docs/user-stories/traceability.md").read_text().splitlines()
    rows = {
        parts[1].strip(): line.lower()
        for line in lines
        if line.startswith("| US-")
        for parts in [line.split("|")]
    }

    for story in ("US-11", "US-12", "US-14", "US-16", "US-24"):
        assert "retained version-1 compatibility" in rows[story]

    assert "no bundle copy" in rows["US-14"]
    assert "public task-native admission replay fails closed on that conversation's existing non-terminal ownership" in rows["US-14"]
    assert "different conversations can reserve and create independent episodes concurrently" in rows["US-14"]
    assert "retained version-1 compatibility promotes and commits the exact approved bundle, and `create_spec_episode` may return" in rows["US-14"]

    assert "primary task-native recovery returns the exact task to `in planning` after a proven clean failure before ownership/resource mutation" in rows["US-16"]
    assert "publishes `blocked` with exact recovery evidence after any recorded, partial, or uncertain ownership/resource mutation" in rows["US-16"]
    assert "retained version-1 compatibility preserves partial provisioning/allocation as exact `uncertain` ownership" in rows["US-16"]
    assert "public admission replay fails closed" in rows["US-16"]

    assert "finalize_task_episode" in rows["US-24"]
    assert "separately confirmed" in rows["US-24"]
    assert "exact idle resources" in rows["US-24"]
    assert "finalize_spec_episode" in rows["US-24"]
