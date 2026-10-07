"""Regression bridge for the native reviewed-plan command.

Tier policy: the node-suite bridges and the live RPC/publication probes are
tier 1 — they run INSIDE the session's tier-1 container via the
`tier1_container` fixture (auto-marked `container`; see tests/conftest.py),
with scratch on the same-path session share (ctmp) and the fake publication
daemon in-container (tests/container/fake_daemon.py; a host-bound Unix
socket is unreachable from the container through the macOS virtiofs mount).
The policy/documentation tests below stay tier 0.
"""

import json
import os
import re
from pathlib import Path
import selectors
import subprocess
import time


REPO = Path(__file__).resolve().parents[1]
EXTENSION = REPO / "src" / "prime-agent-plugin" / "extensions" / "reviewed-plan.ts"
EPISODE_EXTENSION = REPO / "src" / "prime-agent-plugin" / "extension-support" / "spec-episode.ts"
NODE_SUITE = REPO / "tests" / "reviewed_plan_extension.test.mjs"
EPISODE_NODE_SUITE = REPO / "tests" / "spec_episode_extension.test.mjs"
FAKE_PUBLICATION_ROUTE = "fake-publication-route"
# Container paths (repo bind-mounted read-only at /workspace).
WS_EXTENSION = "/workspace/src/prime-agent-plugin/extensions/reviewed-plan.ts"
CONTAINER_INSTALLED_EXTENSION = "/root/.prime/agent/extensions/reviewed-plan.ts"
WS_EPISODE_EXTENSION = "/workspace/src/prime-agent-plugin/extension-support/spec-episode.ts"
WS_REVIEWED_PLAN_NODE_SUITE = "/workspace/tests/reviewed_plan_extension.test.mjs"
WS_SPEC_EPISODE_NODE_SUITE = "/workspace/tests/spec_episode_extension.test.mjs"
WS_EPISODE_CLOSE_NODE_SUITE = "/workspace/tests/episode_close_extension.test.mjs"


def assert_legacy_publication_trace(envelopes: list, responses: dict) -> None:
    """Every mutation must use the exact fake route and protocol-7 ack chain.

    envelopes/responses are reconstructed host-side from the in-container
    fake daemon's JSONL logs (tests/container/fake_daemon.py), written to
    the same-path session share.
    """
    commands = [envelope["command"] for envelope in envelopes]
    assert [command["type"] for command in commands] == [
        "create", "ack_result", "get_state", "get_messages", "kill", "ack_result",
    ], commands
    create, create_ack, get_state, get_messages, kill, kill_ack = commands
    assert responses[create["id"]]["activeSessionId"] == FAKE_PUBLICATION_ROUTE
    for command in (get_state, get_messages, kill):
        assert command["activeSessionId"] == FAKE_PUBLICATION_ROUTE
    assert create_ack["commandId"] == create["id"]
    assert kill_ack["commandId"] == kill["id"]
    assert len({create["id"], create_ack["id"], get_state["id"],
                get_messages["id"], kill["id"], kill_ack["id"]}) == 6
    assert all(command["id"].startswith("spec_episode_")
               for command in (create, get_state, get_messages, kill))
    assert all(command["id"].startswith("spec_episode_ack_")
               for command in (create_ack, kill_ack))
    assert len({envelope["clientId"] for envelope in envelopes}) == 1
    for envelope in envelopes:
        assert envelope["type"] == "command"
        assert envelope["protocol"] == {"name": "prime-agent.daemon", "version": 7}
        assert envelope["command"]["id"] == envelope["id"]


def test_reviewed_plan_node_suite(tier1_container) -> None:
    """Run the TypeScript extension against a mocked ExtensionAPI."""
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test",
        WS_REVIEWED_PLAN_NODE_SUITE, timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_spec_episode_node_suite(tier1_container) -> None:
    """Run temporary-Git, context-fork, idempotency, and daemon-envelope tests."""
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test",
        WS_SPEC_EPISODE_NODE_SUITE, timeout=180,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_episode_close_node_suite(tier1_container) -> None:
    """Run the episode-close TypeScript suite inside the tier-1 container.

    This suite previously had no pytest bridge; slice 3 adds it so every
    committed node suite runs under the tier-1 container.
    """
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test",
        WS_EPISODE_CLOSE_NODE_SUITE, timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_episode_creation_reuses_host_session_manager_without_runtime_package_import() -> None:
    """Source-mode Jiti loading must not re-import the complete coding-agent package."""
    source = EPISODE_EXTENSION.read_text()
    assert 'import("@earendil-works/pi-coding-agent")' not in source
    assert "runtimeSessionManagerClass(ctx.sessionManager)" in source
    assert "Object.getPrototypeOf(sessionManager)?.constructor" in source
    assert "typeof candidate.forkFrom" in source


def test_prime_agent_rpc_loads_native_commands_and_structured_tool(
    tier1_container, ctmp,
) -> None:
    """Probe real offline RPC after startup to prove command and tool registration."""
    request = json.dumps({"id": "loader", "type": "get_commands"}) + "\n"
    probe_source = """import { SessionManager } from "@earendil-works/pi-coding-agent";
export default function probe(pi) {
  pi.on("session_start", () => {
    const toolNames = pi.getAllTools().map((tool) => tool.name);
    if (typeof SessionManager.forkFrom === "function"
      && toolNames.includes("ralph_plan")
      && toolNames.includes("create_spec_episode")
      && toolNames.includes("handoff_spec_episode")
      && !toolNames.includes("prime_claw_reserve_expert_review")
      && !toolNames.includes("prime_claw_bind_expert_review")
      && !toolNames.includes("prime_claw_expert_review_status")
      && !toolNames.includes("prime_claw_cancel_expert_review")
      && !toolNames.includes("ralph_implement_spec")) {
      pi.registerCommand("probe-reviewed-plan-tools", {
        description: "RPC proof that reviewed-plan tools are registered",
        handler: async () => {},
      });
    }
  });
}
"""
    probe = ctmp / "tool-probe.ts"
    probe.write_text(probe_source)
    result = tier1_container.run(
        "prime-agent",
        "--mode", "rpc",
        "--offline",
        "--no-session",
        "--no-skills",
        "--no-prompt-templates",
        "--no-context-files",
        "--no-extensions",
        "--cwd", str(ctmp),
        "-e", WS_EXTENSION,
        "-e", str(probe),
        input_text=request,
        timeout=40,
        workdir=None,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    response = json.loads(result.stdout.strip().splitlines()[-1])
    assert response["success"] is True
    commands = response["data"]["commands"]
    for name in ("plan", "implement-spec"):
        matches = [command for command in commands if command["name"] == name]
        assert len(matches) == 1
        assert matches[0]["sourceInfo"]["path"] == WS_EXTENSION
    assert [command["name"] for command in commands].count(
        "probe-reviewed-plan-tools"
    ) == 1


def test_container_installed_native_plan_runs_prep_then_one_plan_followup(
    tier1_container, ctmp,
) -> None:
    """Exercise the full plan-prep chain without touching the host generation."""
    project = ctmp / "plan-prep-project"
    for skill_name in ("plan-prep", "plan"):
        skill = project / ".ralph" / "skills" / skill_name / "SKILL.md"
        skill.parent.mkdir(parents=True, exist_ok=True)
        skill.write_text(tier1_container.read_repo(
            f".ralph/skills/{skill_name}/SKILL.md"
        ))
    bundle = project / ".ralph" / "plans" / "future" / "probe"
    bundle.mkdir(parents=True)
    (bundle / "SPECIFICATION.md").write_text(
        "# Probe specification\n\n"
        "## Outcome\n\n"
        "Prove the Docker-only native planning preparation chain.\n"
    )

    provider_source = r"""import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

let modelCalls = 0;
function message(model, content, reason) {
  return {
    role: "assistant", content, api: model.api, provider: model.provider,
    model: model.id,
    usage: {
      input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: reason, timestamp: Date.now(),
  };
}
function streamProbe(model) {
  const stream = createAssistantMessageEventStream();
  queueMicrotask(() => {
    modelCalls += 1;
    if (modelCalls === 1) {
      const call = {
        type: "toolCall", id: "compact-probe-call", name: "ipython",
        arguments: {
          code: 'focus_hint = "Docker tier-1 native plan-prep probe"\ncompaction_result = await compact.run(focus_hint)\nprint(compaction_result)',
        },
      };
      const output = message(model, [call], "toolUse");
      stream.push({ type: "start", partial: output });
      stream.push({ type: "toolcall_start", contentIndex: 0, partial: output });
      stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: call, partial: output });
      stream.push({ type: "done", reason: "toolUse", message: output });
    } else {
      const text = modelCalls === 2
        ? "Status\nprep complete\nEvidence\ncompact.run returned above\nNext Step\ncanonical plan follow-up"
        : modelCalls === 3
          ? "PLAN_PROBE_COMPLETED"
          : `UNEXPECTED_MODEL_CALL_${modelCalls}`;
      const output = message(model, [{ type: "text", text }], "stop");
      stream.push({ type: "start", partial: output });
      stream.push({ type: "text_start", contentIndex: 0, partial: output });
      stream.push({ type: "text_delta", contentIndex: 0, delta: text, partial: output });
      stream.push({ type: "text_end", contentIndex: 0, content: text, partial: output });
      stream.push({ type: "done", reason: "stop", message: output });
    }
    stream.end();
  });
  return stream;
}
export default function probe(pi) {
  pi.registerProvider("prep-probe", {
    baseUrl: "http://127.0.0.1.invalid", apiKey: "unused", api: "prep-probe-api",
    streamSimple: streamProbe,
    models: [{
      id: "prep-probe-model", name: "Prep Probe", reasoning: false,
      input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000, maxTokens: 1000,
    }],
  });
}
"""
    provider = ctmp / "plan-prep-provider.ts"
    provider.write_text(provider_source)
    result = tier1_container.run(
        "prime-agent",
        "--mode", "json", "--offline", "--no-session",
        "--no-extensions", "--no-prompt-templates",
        "--cwd", str(project),
        "-e", CONTAINER_INSTALLED_EXTENSION,
        "-e", str(provider),
        "--provider", "prep-probe", "--model", "prep-probe-model",
        "--", "/plan .ralph/plans/future/probe",
        timeout=300,
        workdir=None,
        env={"PRIME_AGENT_INSTALL_UV": "1"},
    )
    assert result.returncode == 0, result.stdout + result.stderr

    events = []
    for line in result.stdout.splitlines():
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    user_skills = []
    compact_calls = 0
    compact_results = []
    completion_markers = 0
    for event in events:
        if (event.get("type") == "tool_execution_end"
                and event.get("toolCallId") == "compact-probe-call"):
            compact_results.append(event)
        if event.get("type") != "message_start":
            continue
        message = event.get("message", {})
        content = message.get("content", [])
        if message.get("role") == "user":
            text = "".join(
                item.get("text", "") for item in content
                if isinstance(item, dict)
            )
            match = re.search(r'<skill name="([^"]+)"', text)
            if match:
                user_skills.append(match.group(1))
        elif message.get("role") == "assistant":
            compact_calls += sum(
                item.get("type") == "toolCall"
                and item.get("name") == "ipython"
                and "compact.run" in item.get("arguments", {}).get("code", "")
                for item in content if isinstance(item, dict)
            )
            completion_markers += sum(
                item.get("text") == "PLAN_PROBE_COMPLETED"
                for item in content if isinstance(item, dict)
            )

    assert user_skills == ["plan-prep", "plan"]
    assert compact_calls == 1
    assert len(compact_results) == 1, json.dumps(compact_results, indent=2)
    compact_result = compact_results[0]
    assert compact_result.get("isError") is False, json.dumps(
        compact_result, indent=2,
    )
    result_text = "".join(
        item.get("text", "")
        for item in compact_result.get("result", {}).get("content", [])
        if isinstance(item, dict)
    )
    # The immediate compact.run() return is the cross-version contract. Older
    # supported Prime Agent releases do not also emit a custom threshold event.
    assert "scheduled" in result_text and "False" in result_text, result_text
    assert completion_markers == 1
    assert "UNEXPECTED_MODEL_CALL" not in result.stdout


def test_container_installed_native_implement_runs_prep_then_one_authorized_followup(
    tier1_container, ctmp,
) -> None:
    """Exercise installed prep ordering and the one-agent_end approval bridge."""
    project = ctmp / "implement-prep-project"
    for skill_name in ("implement-prep", "implement-spec", "oversee-episode"):
        skill = project / ".ralph" / "skills" / skill_name / "SKILL.md"
        skill.parent.mkdir(parents=True, exist_ok=True)
        skill.write_text(tier1_container.read_repo(
            f".ralph/skills/{skill_name}/SKILL.md"
        ))
    bundle = project / ".ralph" / "plans" / "future" / "probe"
    bundle.mkdir(parents=True)
    (bundle / "SPECIFICATION.md").write_text(
        "# Probe specification\n\n"
        "## Outcome\n\n"
        "Prove the Docker-only native implementation preparation chain.\n"
    )
    (bundle / "EXECUTION_PLAN.md").write_text(
        "# Probe execution plan\n\n"
        "## Slice\n\n"
        "Promote one controlled episode identity and stop.\n"
    )

    installed_extension = json.dumps(CONTAINER_INSTALLED_EXTENSION)
    provider_source = rf"""import {{ mkdirSync, writeFileSync }} from "node:fs";
import {{ basename, dirname, join, resolve }} from "node:path";
import {{ createAssistantMessageEventStream }} from "@earendil-works/pi-ai";
import {{ createReviewedPlanExtension }} from {installed_extension};

let modelCalls = 0;
let agentEnds = 0;
function message(model, content, reason) {{
  return {{
    role: "assistant", content, api: model.api, provider: model.provider,
    model: model.id,
    usage: {{
      input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: {{ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }},
    }},
    stopReason: reason, timestamp: Date.now(),
  }};
}}
function streamProbe(model) {{
  const stream = createAssistantMessageEventStream();
  queueMicrotask(() => {{
    modelCalls += 1;
    let output;
    if (modelCalls === 1) {{
      const call = {{
        type: "toolCall", id: "implement-compact-call", name: "ipython",
        arguments: {{
          code: 'focus_hint = "Docker tier-1 native implement-prep probe"\ncompaction_result = await compact.run(focus_hint)\nprint(compaction_result)',
        }},
      }};
      output = message(model, [call], "toolUse");
      stream.push({{ type: "start", partial: output }});
      stream.push({{ type: "toolcall_start", contentIndex: 0, partial: output }});
      stream.push({{ type: "toolcall_end", contentIndex: 0, toolCall: call, partial: output }});
      stream.push({{ type: "done", reason: "toolUse", message: output }});
    }} else if (modelCalls === 2) {{
      const text = "Status\nprep complete\nEvidence\ncompact.run returned above\nNext Step\ncanonical implement follow-up";
      output = message(model, [{{ type: "text", text }}], "stop");
      stream.push({{ type: "start", partial: output }});
      stream.push({{ type: "text_start", contentIndex: 0, partial: output }});
      stream.push({{ type: "text_delta", contentIndex: 0, delta: text, partial: output }});
      stream.push({{ type: "text_end", contentIndex: 0, content: text, partial: output }});
      stream.push({{ type: "done", reason: "stop", message: output }});
    }} else if (modelCalls === 3) {{
      const call = {{
        type: "toolCall", id: "implement-guide-call", name: "prime_claw_activate_conversation_guide",
        arguments: {{}},
      }};
      output = message(model, [call], "toolUse");
      stream.push({{ type: "start", partial: output }});
      stream.push({{ type: "toolcall_start", contentIndex: 0, partial: output }});
      stream.push({{ type: "toolcall_end", contentIndex: 0, toolCall: call, partial: output }});
      stream.push({{ type: "done", reason: "toolUse", message: output }});
    }} else if (modelCalls === 4) {{
      const call = {{
        type: "toolCall", id: "implement-create-call", name: "create_spec_episode",
        arguments: {{ location: ".ralph/plans/future/probe" }},
      }};
      output = message(model, [call], "toolUse");
      stream.push({{ type: "start", partial: output }});
      stream.push({{ type: "toolcall_start", contentIndex: 0, partial: output }});
      stream.push({{ type: "toolcall_end", contentIndex: 0, toolCall: call, partial: output }});
      stream.push({{ type: "done", reason: "toolUse", message: output }});
    }} else {{
      const text = modelCalls === 5
        ? "IMPLEMENT_PROBE_COMPLETED"
        : `UNEXPECTED_MODEL_CALL_${{modelCalls}}`;
      output = message(model, [{{ type: "text", text }}], "stop");
      stream.push({{ type: "start", partial: output }});
      stream.push({{ type: "text_start", contentIndex: 0, partial: output }});
      stream.push({{ type: "text_delta", contentIndex: 0, delta: text, partial: output }});
      stream.push({{ type: "text_end", contentIndex: 0, content: text, partial: output }});
      stream.push({{ type: "done", reason: "stop", message: output }});
    }}
    stream.end();
  }});
  return stream;
}}
export default function probe(pi) {{
  createReviewedPlanExtension({{
    async createEpisode(location, _toolCallId, ctx) {{
      if (agentEnds !== 1) throw new Error(`expected one intervening agent_end, saw ${{agentEnds}}`);
      const slug = "probe";
      const worktree = resolve(dirname(ctx.cwd), `${{basename(ctx.cwd)}}-${{slug}}-episode`);
      const episode = {{
        version: 2, reused: false, slug, sourceLocation: location,
        ownerSessionId: ctx.sessionManager.getSessionId(),
        episodeId: "33333333-3333-4333-8333-333333333333",
        episodeActiveSessionId: "controlled-active-route",
        episodeSessionFile: join(worktree, "episode.jsonl"),
        branch: "episode/probe", worktree, sessionName: "probe-episode",
        bootstrapAdmission: "delivered",
      }};
      const state = join(ctx.cwd, ".prime", "agent", "state", "spec-episodes");
      mkdirSync(state, {{ recursive: true }});
      writeFileSync(join(state, "probe.json"), JSON.stringify(episode));
      return episode;
    }},
  }})(pi);
  pi.on("agent_end", () => {{ agentEnds += 1; }});
  pi.registerProvider("implement-prep-probe", {{
    baseUrl: "http://127.0.0.1.invalid", apiKey: "unused",
    api: "implement-prep-probe-api", streamSimple: streamProbe,
    models: [{{
      id: "implement-prep-probe-model", name: "Implement Prep Probe",
      reasoning: false, input: ["text"],
      cost: {{ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }},
      contextWindow: 200000, maxTokens: 1000,
    }}],
  }});
}}
"""
    provider = ctmp / "implement-prep-provider.ts"
    provider.write_text(provider_source)
    result = tier1_container.run(
        "prime-agent",
        "--mode", "json", "--offline", "--no-session",
        "--no-extensions", "--no-prompt-templates",
        "--cwd", str(project), "-e", str(provider),
        "--provider", "implement-prep-probe",
        "--model", "implement-prep-probe-model",
        "--", "/implement-spec .ralph/plans/future/probe",
        timeout=300,
        workdir=None,
        env={"PRIME_AGENT_INSTALL_UV": "1"},
    )
    assert result.returncode == 0, result.stdout + result.stderr

    events = []
    for line in result.stdout.splitlines():
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    user_skills = []
    compact_calls = 0
    compact_results = []
    guide_results = []
    create_results = []
    completion_markers = 0
    for event in events:
        if event.get("type") == "tool_execution_end":
            if event.get("toolCallId") == "implement-compact-call":
                compact_results.append(event)
            elif event.get("toolCallId") == "implement-guide-call":
                guide_results.append(event)
            elif event.get("toolCallId") == "implement-create-call":
                create_results.append(event)
        if event.get("type") != "message_start":
            continue
        message_value = event.get("message", {})
        content = message_value.get("content", [])
        if message_value.get("role") == "user":
            text = "".join(
                item.get("text", "") for item in content
                if isinstance(item, dict)
            )
            match = re.search(r'<skill name="([^"]+)"', text)
            if match:
                user_skills.append(match.group(1))
        elif message_value.get("role") == "assistant":
            compact_calls += sum(
                item.get("type") == "toolCall"
                and item.get("name") == "ipython"
                and "compact.run" in item.get("arguments", {}).get("code", "")
                for item in content if isinstance(item, dict)
            )
            completion_markers += sum(
                item.get("text") == "IMPLEMENT_PROBE_COMPLETED"
                for item in content if isinstance(item, dict)
            )

    assert user_skills == ["implement-prep", "implement-spec"]
    assert compact_calls == 1
    assert len(compact_results) == 1
    assert compact_results[0].get("isError") is False, json.dumps(
        compact_results, indent=2,
    )
    assert len(guide_results) == 1
    assert guide_results[0].get("isError") is False, json.dumps(
        guide_results, indent=2,
    )
    assert len(create_results) == 1
    assert create_results[0].get("isError") is False, json.dumps(
        create_results, indent=2,
    )
    assert completion_markers == 1
    assert "UNEXPECTED_MODEL_CALL" not in result.stdout


def test_installed_rpc_characterizes_confirmed_steer_lifecycle_order(
    tier1_container, ctmp,
) -> None:
    """Prove why conversational implementation remains native-only on 0.9.5."""
    probe_source = r'''import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

const events = [];
let modelCalls = 0;
function record(cwd, label) {
  events.push(label);
  writeFileSync(join(cwd, "ordering.json"), JSON.stringify(events));
}
function message(model, content, reason) {
  return {
    role: "assistant", content, api: model.api, provider: model.provider,
    model: model.id,
    usage: {
      input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: reason, timestamp: Date.now(),
  };
}
function streamProbe(model) {
  const stream = createAssistantMessageEventStream();
  queueMicrotask(() => {
    modelCalls += 1;
    if (modelCalls === 1) {
      const call = {
        type: "toolCall", id: "probe-call", name: "probe_implement",
        arguments: {},
      };
      const output = message(model, [call], "toolUse");
      stream.push({ type: "start", partial: output });
      stream.push({ type: "toolcall_start", contentIndex: 0, partial: output });
      stream.push({
        type: "toolcall_end", contentIndex: 0, toolCall: call, partial: output,
      });
      stream.push({ type: "done", reason: "toolUse", message: output });
    } else {
      const output = message(
        model, [{ type: "text", text: "readiness turn" }], "stop",
      );
      stream.push({ type: "start", partial: output });
      stream.push({ type: "text_start", contentIndex: 0, partial: output });
      stream.push({
        type: "text_end", contentIndex: 0, content: "readiness turn",
        partial: output,
      });
      stream.push({ type: "done", reason: "stop", message: output });
    }
    stream.end();
  });
  return stream;
}
export default function probe(pi) {
  pi.registerProvider("probe", {
    baseUrl: "http://127.0.0.1.invalid", apiKey: "unused", api: "probe-api",
    streamSimple: streamProbe,
    models: [{
      id: "probe-model", name: "Probe", reasoning: false, input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 10000, maxTokens: 1000,
    }],
  });
  let starts = 0;
  pi.on("before_agent_start", (_event, ctx) => {
    starts += 1;
    record(ctx.cwd, `before-agent-start-${starts}`);
  });
  pi.on("input", (event, ctx) => {
    const match = event.text === "READINESS" ? "matching" : "other";
    record(ctx.cwd, `input-${event.source}-${match}`);
  });
  pi.on("agent_end", (_event, ctx) => record(ctx.cwd, "agent-end"));
  pi.registerTool({
    name: "probe_implement", label: "Probe",
    description: "Probe confirmation and steer lifecycle ordering",
    executionMode: "sequential",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_id, _params, _signal, _update, ctx) {
      record(ctx.cwd, "confirm-requested");
      const confirmed = await ctx.ui.confirm(
        "Implement specification?",
        "Create branch, worktree, and episode for .ralph/plans/future/probe?",
      );
      record(ctx.cwd, confirmed ? "confirm-resolved-true" : "confirm-resolved-false");
      if (!confirmed) {
        return { content: [{ type: "text", text: "rejected" }], details: {} };
      }
      record(ctx.cwd, "send-steer");
      pi.sendUserMessage("READINESS", { deliverAs: "steer" });
      return { content: [{ type: "text", text: "admitted" }], details: {} };
    },
  });
}
'''
    ordering_path = ctmp / "ordering.json"
    probe = ctmp / "probe.ts"
    probe.write_text(probe_source)
    process = tier1_container.popen(
        "prime-agent",
        "--mode", "rpc", "--offline", "--no-session",
        "--no-skills", "--no-prompt-templates", "--no-context-files",
        "--no-extensions", "--cwd", str(ctmp), "-e", str(probe),
        "--provider", "probe", "--model", "probe-model",
        timeout=90,
    )
    process.stdin.write((json.dumps({
        "id": "start", "type": "prompt", "message": "start probe",
    }) + "\n").encode())
    process.stdin.flush()

    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    deadline = time.monotonic() + 20
    agent_ends = 0
    observed = []
    try:
        while time.monotonic() < deadline and agent_ends < 2:
            ready = selector.select(timeout=max(0, deadline - time.monotonic()))
            if not ready:
                break
            line = process.stdout.readline()
            if not line:
                break
            event = json.loads(line.decode())
            observed.append(event)
            if (event.get("type") == "extension_ui_request"
                    and event.get("method") == "confirm"):
                process.stdin.write((json.dumps({
                    "type": "extension_ui_response", "id": event["id"],
                    "confirmed": True,
                }) + "\n").encode())
                process.stdin.flush()
            if event.get("type") == "agent_end":
                agent_ends += 1
    finally:
        selector.close()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=3)

    stderr = (process.stderr.read().decode(errors="replace")
              if process.stderr is not None else "")
    assert agent_ends == 2, json.dumps(observed, indent=2) + stderr
    ordering = json.loads(ordering_path.read_text())

    required = [
        "input-rpc-other", "before-agent-start-1", "confirm-requested",
        "confirm-resolved-true", "send-steer", "input-extension-matching",
        "agent-end", "before-agent-start-2",
    ]
    positions = [ordering.index(label) for label in required]
    assert positions == sorted(positions), ordering


def test_installed_prime_agent_forks_valid_context_and_publishes_worktree_session(
    tier1_container, ctmp,
) -> None:
    """Exercise public SessionManager against a runtime-verified fake daemon only."""
    request = json.dumps({"id": "loader", "type": "get_commands"}) + "\n"
    episode_import = json.dumps(WS_EPISODE_EXTENSION)
    root = ctmp
    socket_path = f"/tmp/pc-pub-{os.getpid()}-{time.time_ns()}.sock"
    transport_path = root / "transport.jsonl"
    daemon = tier1_container.start_daemon(
        socket_path, FAKE_PUBLICATION_ROUTE, root / "daemon-log",
    )
    try:
        probe_source = f"""import net from "node:net";
import {{ appendFileSync, lstatSync, mkdirSync, realpathSync, rmSync, writeFileSync }} from "node:fs";
import {{ join, resolve }} from "node:path";
import {{ SessionManager }} from "@earendil-works/pi-coding-agent";
import {{ DaemonJsonlClient, forkPrimeSession }} from {episode_import};

const expectedSocket = {json.dumps(str(socket_path))};
const transportRecords = {json.dumps(str(transport_path))};
if (!lstatSync(expectedSocket).isSocket()) throw new Error("fake socket missing");
process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET = expectedSocket;
const originalConnect = net.Socket.prototype.connect;
function guardedConnect(...args) {{
  let arg = args[0];
  if (Array.isArray(arg)) arg = arg[0];
  const path = typeof arg === "string" ? arg : arg?.path;
  if (path !== expectedSocket) throw new Error(`non-fixture transport denied: ${{path}}`);
  appendFileSync(transportRecords, JSON.stringify({{ kind: "connect", path, isFake: true }}) + "\\n");
  return originalConnect.apply(this, args);
}}
net.Socket.prototype.connect = guardedConnect;
appendFileSync(transportRecords, JSON.stringify({{
  kind: "runtime-guard", socket: expectedSocket, transportIsFake: true,
}}) + "\\n");

const usage = {{
  input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
  cost: {{ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }},
}};

export default function probe(pi) {{
  pi.on("session_start", async (_event, ctx) => {{
    let project;
    let sessions;
    let fork;
    let client;
    let activeSessionId;
    try {{
      if (process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET !== expectedSocket
          || net.Socket.prototype.connect !== guardedConnect) {{
        throw new Error("fake transport not effective before lifecycle mutation");
      }}
      const projectPath = join(ctx.cwd, "published-worktree");
      mkdirSync(projectPath, {{ recursive: true }});
      project = realpathSync(projectPath);
      sessions = join(ctx.cwd, "probe-sessions");
      mkdirSync(sessions, {{ recursive: true }});
      const source = SessionManager.create(ctx.cwd, sessions);
      const firstEntry = source.appendMessage({{ role: "user", content: [{{ type: "text", text: "approved" }}], timestamp: Date.now() }});
      source.appendModelChange("test-provider", "test-model");
      source.appendThinkingLevelChange("high");
      source.appendCompaction("preserved compact context", firstEntry, 100);
      source.appendMessage({{
        role: "assistant",
        content: [{{ type: "toolCall", id: "call-real", name: "create_spec_episode", arguments: {{ location: ".ralph/plans/future/probe" }} }}],
        api: "test", provider: "test", model: "test", usage, stopReason: "toolUse", timestamp: Date.now(),
      }});
      fork = forkPrimeSession(SessionManager, {{
        sourceSessionFile: source.getSessionFile(), worktree: project,
        sessionName: `probe-${{process.pid}}`, branch: "episode/probe", toolCallId: "call-real",
      }});
      const opened = SessionManager.open(fork.sessionFile, sessions);
      const inherited = opened.buildSessionContext().messages;
      const inheritedTypes = new Set(opened.getEntries().map((entry) => entry.type));
      const paired = inherited.at(-1)?.role === "toolResult"
        && inherited.at(-1)?.toolCallId === "call-real"
        && inheritedTypes.has("model_change")
        && inheritedTypes.has("thinking_level_change")
        && inheritedTypes.has("compaction");
      client = new DaemonJsonlClient(expectedSocket);
      const name = `probe-${{process.pid}}`;
      const created = await client.request({{
        type: "create", sessionPath: fork.sessionFile, lifecycle: "resident",
        name, config: {{ cwd: project }},
      }}, 30_000);
      if (created.success !== true) throw new Error(created.error ?? "create failed");
      activeSessionId = created.data.activeSessionId ?? created.data.id;
      if (activeSessionId !== "{FAKE_PUBLICATION_ROUTE}") throw new Error("unexpected fake route");
      const state = await client.request({{ type: "get_state", activeSessionId }});
      const messages = await client.request({{ type: "get_messages", activeSessionId }});
      const pairedPublished = messages.data.messages.some(
        (message) => message.role === "toolResult" && message.toolCallId === "call-real",
      );
      const valid = paired && pairedPublished && state.success === true
        && state.data.activeSessionId === "{FAKE_PUBLICATION_ROUTE}"
        && state.data.sessionId === fork.sessionId
        && resolve(state.data.sessionFile) === resolve(fork.sessionFile)
        && resolve(state.data.cwd) === resolve(project)
        && state.data.sessionName === name;
      const killed = await client.request({{ type: "kill", activeSessionId }});
      activeSessionId = undefined;
      if (!valid || killed.success !== true) throw new Error(`fork/publication proof failed: ${{JSON.stringify({{ paired, pairedPublished, fork, state: state.data, killed }})}}`);
      writeFileSync(join(ctx.cwd, "probe-success.json"), JSON.stringify({{ ok: true }}));
      pi.registerCommand("probe-fake-spec-episode-publication", {{ description: "probe", handler: async () => {{}} }});
    }} catch (error) {{
      writeFileSync(join(ctx.cwd, "probe-error.txt"), error?.stack ?? String(error));
    }} finally {{
      if (activeSessionId && client) await client.request({{ type: "kill", activeSessionId }}).catch(() => undefined);
      if (fork?.sessionFile) rmSync(fork.sessionFile, {{ force: true }});
      client?.close();
      if (project) rmSync(project, {{ recursive: true, force: true }});
      if (sessions) rmSync(sessions, {{ recursive: true, force: true }});
    }}
  }});
}}
"""
        probe = root / "fake-episode-probe.ts"
        probe.write_text(probe_source)
        process = tier1_container.popen(
            "prime-agent", "--mode", "rpc", "--offline", "--no-session",
            "--no-skills", "--no-prompt-templates", "--no-context-files",
            "--no-extensions", "--cwd", str(root), "-e", WS_EXTENSION,
            "-e", str(probe),
            env={
                "PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET": socket_path,
                "PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_REGISTRY_DIR": str(root / "supervisor"),
                "PRIME_AGENT_INTERNAL_LEGACY_OWNED_WORKER_FRONTEND": "1",
            },
            timeout=90,
        )
        process.stdin.write(request.encode())
        process.stdin.flush()
        process.stdin.close()
        response = json.loads(process.stdout.readline())
        success_path = root / "probe-success.json"
        error_path = root / "probe-error.txt"
        deadline = time.monotonic() + 20
        while (not success_path.exists() and not error_path.exists()
               and time.monotonic() < deadline):
            time.sleep(0.02)
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=3)
        stderr = process.stderr.read() if process.stderr is not None else b""
        if isinstance(stderr, bytes):
            stderr = stderr.decode(errors="replace")
        probe_error = error_path.read_text() if error_path.exists() else ""
        assert success_path.exists(), stderr + probe_error
        assert json.loads(success_path.read_text()) == {"ok": True}
        assert response["success"] is True
        assert_legacy_publication_trace(daemon.envelopes, daemon.responses)
        transport = [json.loads(line)
                     for line in transport_path.read_text().splitlines()]
        assert transport[0] == {
            "kind": "runtime-guard", "socket": socket_path, "transportIsFake": True,
        }
        assert transport[1:] == [
            {"kind": "connect", "path": socket_path, "isFake": True},
        ]
        assert not (root / "published-worktree").exists()
        assert not (root / "probe-sessions").exists()
    finally:
        daemon.close()


def test_handoff_policy_documents_trusted_completion_and_honest_transport() -> None:
    """Archived feature and current docs must not promise an atomic all-busy primitive."""
    paths = (
        REPO / ".ralph/plans/archive/conversation-driven-episode-oversight/SPECIFICATION.md",
        REPO / ".ralph/plans/archive/conversation-driven-episode-oversight/EXECUTION_PLAN.md",
        REPO / "docs/handoff-chain.md",
        REPO / "docs/future-specification-bundles.md",
    )
    question = "You seem done with your work. Are you complete or waiting for some process?"
    for path in paths:
        text = path.read_text()
        assert question in text, path
        assert "completion report" in text, path
        assert "streaming race" in text, path
        assert "residual non-streaming" in text, path
        assert "atomic all-busy" in text or "atomic fail-if-any-busy" in text, path

    extension = EXTENSION.read_text()
    assert "sent as steer" not in extension
    assert "ordinary prompt" in extension
    assert "immediate or queued" in extension
    episode_support = (
        REPO / "src/prime-agent-plugin/extension-support/spec-episode.ts"
    ).read_text()
    assert 'handoffDelivery: "prompt"' in episode_support
    assert 'executeDelivery: "followUp"' in episode_support


def test_bootstrap_and_continuation_document_distinct_state_boundaries() -> None:
    """Fresh creation must not inherit the later continuation snapshot gate."""
    specification = (
        REPO / ".ralph/plans/archive/conversation-driven-episode-oversight/SPECIFICATION.md"
    ).read_text()
    docs = (REPO / "docs/future-specification-bundles.md").read_text()

    for text in (specification, docs):
        assert "Fresh bootstrap does not read episode state" in text
        assert "observed-idle snapshot" in text
        assert "later" in text and "continuation" in text
        assert "completion report" in text

    bootstrap = specification.split("### Handoff-first bootstrap", 1)[1].split(
        "### First-turn identity", 1
    )[0]
    assert "fork and validate publication" in bootstrap
    assert "complete canonical handoff/execute preflight" in bootstrap
    assert "persist v2 handoff-pending" in bootstrap
    assert "persist execute-pending" in bootstrap
    assert "persist delivered" in bootstrap
    assert "after the observed-idle snapshot" not in bootstrap

    continuation = docs.split("## Owner-driven episode continuation", 1)[1].split(
        "## Automated and integration validation", 1
    )[0]
    assert "re-reads live daemon state" in continuation
    assert "fails closed on an observed busy snapshot" in continuation


def test_publisher_tests_do_not_claim_fake_native_admission_proof() -> None:
    """Maintained tests exercise production code without inventing native semantics."""
    tests = (REPO / "tests/spec_episode_extension.test.mjs").read_text()
    plan = (
        REPO / ".ralph/plans/archive/conversation-driven-episode-oversight/EXECUTION_PLAN.md"
    ).read_text()

    assert "nativeSemantics" not in tests
    assert 'from "../src/prime-agent-plugin/extension-support/spec-episode.ts"' in tests
    assert "mocked already-admitted handoff" in tests
    assert "controlled first ordinary-prompt rejection" in tests
    assert "maintained plugin tests do not" in plan
    assert "native-runtime proof" in plan


def test_dogfood_watch_policy_retains_intended_retry_without_replay() -> None:
    """A definite first rejection preserves only the bounded intended-retry watch."""
    plan = (
        REPO / ".ralph/plans/archive/conversation-driven-episode-oversight/EXECUTION_PLAN.md"
    ).read_text()
    assert "after definite first no-admission while a later owner" in plan
    assert "retry remains intended" in plan
    assert "waiting only for owner/operator action" in plan
    assert "must not poll or replay" in plan
    assert "automatically" in plan


def test_reviewed_skills_have_only_native_slash_command_surfaces() -> None:
    """Native commands must not compete with duplicate skill commands."""
    assert not (REPO / ".agents" / "skills" / "plan").exists()
    assert not (REPO / ".agents" / "skills" / "implement-spec").exists()


def test_plan_skill_keeps_output_in_selected_folder_and_stops_for_review() -> None:
    """Project policy consumes native input without crossing approval gates."""
    skill = (REPO / ".ralph" / "skills" / "plan" / "SKILL.md").read_text()
    assert "<operator-plan-location>" not in skill
    required = (
        "operator plan location",
        "Do not guess, substitute, or select a different",
        "future folder",
        "Save `EXECUTION_PLAN.md` in the selected",
        "Keep all other planning",
        "artifacts in that same folder",
        "link every planning artifact created or updated",
        "explicitly ask the operator to review the plan",
        "stop without implementing",
        "Planning does not authorize implementation",
    )
    for fragment in required:
        assert fragment in skill


def test_implement_spec_policy_rejects_inadequate_bundles_without_tool_call() -> None:
    """Semantic readiness remains an explicit customizable policy gate."""
    skill = (REPO / ".ralph" / "skills" / "implement-spec" / "SKILL.md").read_text()
    assert "<operator-implementation-location>" not in skill
    for fragment in (
        "missing, contradictory, or inadequate",
        "Do not call `create_spec_episode`",
        "Do not create or mutate a",
        "`prime_claw_activate_conversation_guide` exactly once",
        "current preparation lifecycle",
        "call `create_spec_episode` exactly once",
        "sole `location` argument",
        "before any episode identity",
        "stop without implementing",
    ):
        assert fragment in skill


def test_handoff_metadata_grants_only_recorded_in_scope_owner_continuation() -> None:
    """Model-facing policy may broaden semantic initiation, never host routing."""
    source = EXTENSION.read_text()
    metadata_start = source.index('name: "handoff_spec_episode"')
    execute_start = source.index("async execute", metadata_start)
    metadata = " ".join(source[metadata_start:execute_start].split())
    for fragment in (
        "owner accepts an in-scope advance or recorded revision",
        "no new operator transport request is required",
        "exact retained future-folder location",
        "accepted recorded in-scope findings",
        "never route arbitrary chat, unaccepted findings, product decisions, or scope expansion",
        "consult, pause, merge, abandonment, cleanup, or another episode",
        "never retry an uncertain result",
    ):
        assert fragment in metadata
    assert "only when the operator clearly asks" not in metadata
    assert "only operator-supplied" not in metadata
    assert 'required: ["location"]' in metadata
    assert "additionalProperties: false" in metadata


def test_operator_docs_explain_native_only_implementation_fallback() -> None:
    """The authority limitation and retry boundary must be operator-visible."""
    docs = (REPO / "docs" / "future-specification-bundles.md").read_text()
    for fragment in (
        "Implementation promotion remains native-only",
        "not register `ralph_implement_spec`",
        "would cross `agent_end` before a steered readiness turn",
        "no conversational implementation path",
        "episode side effect",
        "bounded in-memory one-deep lifecycle flag",
        "the approval is unusable before that boundary",
        "does not add durable approvals, leases, nonces, timers",
    ):
        assert fragment in docs


def test_archived_conversational_routing_bundle_links_resolve() -> None:
    """Final archival must preserve every local cross-document link."""
    bundle = REPO / ".ralph" / "plans" / "archive" / "conversational-ralph-command-routing"
    for filename in ("SPECIFICATION.md", "EXECUTION_PLAN.md"):
        document = bundle / filename
        targets = re.findall(r"\[[^\]]+\]\(([^)]+)\)", document.read_text())
        relative_targets = [
            target for target in targets
            if not target.startswith(("#", "http://", "https://"))
        ]
        assert relative_targets, filename
        for target in relative_targets:
            assert (document.parent / target).resolve().is_file(), f"{filename}: {target}"
