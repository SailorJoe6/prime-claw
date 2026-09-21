"""Regression bridge for the native reviewed-plan command."""

import json
from pathlib import Path
import shutil
import subprocess
import tempfile


REPO = Path(__file__).resolve().parents[1]
EXTENSION = REPO / ".prime" / "agent" / "extensions" / "reviewed-plan.ts"
EPISODE_EXTENSION = REPO / ".prime" / "agent" / "extension-support" / "spec-episode.ts"
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
    if (typeof SessionManager.forkFrom === "function"
      && pi.getAllTools().some((tool) => tool.name === "create_spec_episode")) {
      pi.registerCommand("probe-create-spec-episode-tool", {
        description: "RPC proof that create_spec_episode is registered",
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
        "probe-create-spec-episode-tool"
    ) == 1


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
