"""Regression bridge for the native reviewed-plan command."""

import json
import re
from pathlib import Path
import selectors
import shutil
import subprocess
import tempfile
import time


REPO = Path(__file__).resolve().parents[1]
EXTENSION = REPO / "src" / "prime-agent-plugin" / "extensions" / "reviewed-plan.ts"
EPISODE_EXTENSION = REPO / "src" / "prime-agent-plugin" / "extension-support" / "spec-episode.ts"
NODE_SUITE = REPO / "tests" / "reviewed_plan_extension.test.mjs"
EPISODE_NODE_SUITE = REPO / "tests" / "spec_episode_extension.test.mjs"


def test_reviewed_plan_node_suite() -> None:
    """Run the TypeScript extension against a mocked ExtensionAPI."""
    node = shutil.which("node")
    assert node, "Node.js is required because prime-agent itself requires Node >=22.8"
    result = subprocess.run(
        [node, "--experimental-strip-types", "--test", str(NODE_SUITE)],
        cwd=REPO,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_spec_episode_node_suite() -> None:
    """Run temporary-Git, context-fork, idempotency, and daemon-envelope tests."""
    node = shutil.which("node")
    assert node, "Node.js is required because prime-agent itself requires Node >=22.8"
    result = subprocess.run(
        [node, "--experimental-strip-types", "--test", str(EPISODE_NODE_SUITE)],
        cwd=REPO,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_prime_agent_rpc_loads_native_commands_and_structured_tool() -> None:
    """Probe real offline RPC after startup to prove command and tool registration."""
    prime_agent = shutil.which("prime-agent")
    assert prime_agent, "prime-agent is a documented developer prerequisite"
    request = json.dumps({"id": "loader", "type": "get_commands"}) + "\n"
    probe_source = """import { SessionManager } from "@earendil-works/pi-coding-agent";
export default function probe(pi) {
  pi.on("session_start", () => {
    const toolNames = pi.getAllTools().map((tool) => tool.name);
    if (typeof SessionManager.forkFrom === "function"
      && toolNames.includes("ralph_plan")
      && toolNames.includes("create_spec_episode")
      && toolNames.includes("handoff_spec_episode")
      && !toolNames.includes("ralph_implement_spec")) {
      pi.registerCommand("probe-reviewed-plan-tools", {
        description: "RPC proof that reviewed-plan tools are registered",
        handler: async () => {},
      });
    }
  });
}
"""
    with tempfile.TemporaryDirectory(prefix="prime-claw-plan-loader-") as cwd:
        probe = Path(cwd) / "tool-probe.ts"
        probe.write_text(probe_source)
        result = subprocess.run(
            [
                prime_agent,
                "--mode", "rpc",
                "--offline",
                "--no-session",
                "--no-skills",
                "--no-prompt-templates",
                "--no-context-files",
                "--no-extensions",
                "--cwd", cwd,
                "-e", str(EXTENSION),
                "-e", str(probe),
            ],
            cwd=REPO,
            input=request,
            text=True,
            capture_output=True,
            timeout=30,
            check=False,
        )
    assert result.returncode == 0, result.stdout + result.stderr
    response = json.loads(result.stdout.strip().splitlines()[-1])
    assert response["success"] is True
    commands = response["data"]["commands"]
    for name in ("plan", "implement-spec"):
        matches = [command for command in commands if command["name"] == name]
        assert len(matches) == 1
        assert Path(matches[0]["sourceInfo"]["path"]).resolve() == EXTENSION.resolve()
    assert [command["name"] for command in commands].count(
        "probe-reviewed-plan-tools"
    ) == 1


def test_installed_rpc_characterizes_confirmed_steer_lifecycle_order() -> None:
    """Prove why conversational implementation remains native-only on 0.9.5."""
    prime_agent = shutil.which("prime-agent")
    assert prime_agent, "prime-agent is a documented developer prerequisite"
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
    with tempfile.TemporaryDirectory(prefix="prime-claw-impl-ordering-") as cwd:
        probe = Path(cwd) / "probe.ts"
        ordering_path = Path(cwd) / "ordering.json"
        probe.write_text(probe_source)
        process = subprocess.Popen(
            [
                prime_agent,
                "--mode", "rpc", "--offline", "--no-session",
                "--no-skills", "--no-prompt-templates", "--no-context-files",
                "--no-extensions", "--cwd", cwd, "-e", str(probe),
                "--provider", "probe", "--model", "probe-model",
            ],
            cwd=REPO, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=False, bufsize=0,
        )
        assert process.stdin is not None
        assert process.stdout is not None
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
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)

        stderr = (process.stderr.read().decode()
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


def test_installed_prime_agent_forks_valid_context_and_publishes_worktree_session() -> None:
    """Exercise public SessionManager plus bounded daemon create/state/messages/kill."""
    prime_agent = shutil.which("prime-agent")
    assert prime_agent, "prime-agent is a documented developer prerequisite"
    request = json.dumps({"id": "loader", "type": "get_commands"}) + "\n"
    episode_import = json.dumps(str(EPISODE_EXTENSION))
    probe_source = f"""import {{ mkdirSync, realpathSync, rmSync, writeFileSync }} from "node:fs";
import {{ join, resolve }} from "node:path";
import {{ SessionManager }} from "@earendil-works/pi-coding-agent";
import {{ DaemonJsonlClient, forkPrimeSession }} from {episode_import};

const usage = {{
  input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
  cost: {{ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }},
}};

export default function probe(pi) {{
  pi.on("session_start", async (_event, ctx) => {{
    try {{
    const projectPath = join(ctx.cwd, "published-worktree");
    mkdirSync(projectPath, {{ recursive: true }});
    const project = realpathSync(projectPath);
    const sessions = join(ctx.cwd, "probe-sessions");
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
    const fork = forkPrimeSession(SessionManager, {{
      sourceSessionFile: source.getSessionFile(),
      worktree: project,
      sessionName: `probe-${{process.pid}}`,
      branch: "episode/probe",
      toolCallId: "call-real",
    }});
    const opened = SessionManager.open(fork.sessionFile, sessions);
    const inherited = opened.buildSessionContext().messages;
    const inheritedTypes = new Set(opened.getEntries().map((entry) => entry.type));
    const paired = inherited.at(-1)?.role === "toolResult"
      && inherited.at(-1)?.toolCallId === "call-real"
      && inheritedTypes.has("model_change")
      && inheritedTypes.has("thinking_level_change")
      && inheritedTypes.has("compaction");
    const socketPath = process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET;
    if (!socketPath) throw new Error("missing injected supervisor socket");
    const client = new DaemonJsonlClient(socketPath);
    let activeSessionId;
    try {{
      const name = `probe-${{process.pid}}-${{Date.now()}}`;
      const created = await client.request({{
        type: "create", sessionPath: fork.sessionFile, lifecycle: "resident",
        name, config: {{ cwd: project }},
      }}, 120000);
      if (created.success !== true) throw new Error(created.error ?? "create failed");
      activeSessionId = created.data.activeSessionId ?? created.data.id;
      const state = await client.request({{ type: "get_state", activeSessionId }});
      const messages = await client.request({{ type: "get_messages", activeSessionId }});
      const pairedPublished = messages.data.messages.some(
        (message) => message.role === "toolResult" && message.toolCallId === "call-real",
      );
      const valid = paired
        && pairedPublished
        && state.success === true
        && state.data.sessionId === fork.sessionId
        && resolve(state.data.sessionFile) === resolve(fork.sessionFile)
        && resolve(state.data.cwd) === resolve(project)
        && state.data.sessionName === name;
      const killed = await client.request({{ type: "kill", activeSessionId }});
      activeSessionId = undefined;
      if (!valid || killed.success !== true) throw new Error(`fork/publication proof failed: ${{JSON.stringify({{ paired, pairedPublished, fork, state: state.data, killed }})}}`);
      pi.registerCommand("probe-real-spec-episode-publication", {{ description: "probe", handler: async () => {{}} }});
    }} finally {{
      if (activeSessionId) await client.request({{ type: "kill", activeSessionId }}).catch(() => undefined);
      rmSync(fork.sessionFile, {{ force: true }});
      client.close();
      rmSync(project, {{ recursive: true, force: true }});
      rmSync(sessions, {{ recursive: true, force: true }});
    }}
    }} catch (error) {{
      writeFileSync(join(ctx.cwd, "probe-error.txt"), error?.stack ?? String(error));
    }}
  }});
}}
"""
    with tempfile.TemporaryDirectory(prefix="prime-claw-real-episode-") as cwd:
        probe = Path(cwd) / "real-episode-probe.ts"
        probe.write_text(probe_source)
        result = subprocess.run(
            [
                prime_agent,
                "--mode", "rpc",
                "--offline",
                "--no-session",
                "--no-skills",
                "--no-prompt-templates",
                "--no-context-files",
                "--no-extensions",
                "--cwd", cwd,
                "-e", str(probe),
            ],
            cwd=REPO,
            input=request,
            text=True,
            capture_output=True,
            timeout=60,
            check=False,
        )
        error_path = Path(cwd) / "probe-error.txt"
        probe_error = error_path.read_text() if error_path.exists() else ""
    assert result.returncode == 0, result.stdout + result.stderr + probe_error
    response = json.loads(result.stdout.strip().splitlines()[-1])
    assert response["success"] is True
    assert [command["name"] for command in response["data"]["commands"]].count(
        "probe-real-spec-episode-publication"
    ) == 1, result.stdout + result.stderr + probe_error


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
        "call `create_spec_episode` exactly once",
        "sole `location` argument",
        "Stop without implementing",
    ):
        assert fragment in skill


def test_operator_docs_explain_native_only_implementation_fallback() -> None:
    """The authority limitation and retry boundary must be operator-visible."""
    docs = (REPO / "docs" / "future-specification-bundles.md").read_text()
    for fragment in (
        "Implementation promotion remains native-only",
        "not register `ralph_implement_spec`",
        "`agent_end` after that matching input and before the readiness agent turn",
        "no conversational implementation path",
        "episode side effect",
        "must not be emulated with durable approvals, leases,",
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
