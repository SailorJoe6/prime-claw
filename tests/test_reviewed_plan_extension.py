"""Regression bridge for the native reviewed-plan command."""

import json
import os
import re
from pathlib import Path
import selectors
import shutil
import socket
import subprocess
import tempfile
import threading
import time


REPO = Path(__file__).resolve().parents[1]
EXTENSION = REPO / "src" / "prime-agent-plugin" / "extensions" / "reviewed-plan.ts"
EPISODE_EXTENSION = REPO / "src" / "prime-agent-plugin" / "extension-support" / "spec-episode.ts"
NODE_SUITE = REPO / "tests" / "reviewed_plan_extension.test.mjs"
EPISODE_NODE_SUITE = REPO / "tests" / "spec_episode_extension.test.mjs"
FAKE_PUBLICATION_ROUTE = "fake-publication-route"


class PublicationFakeDaemon:
    """Strict local daemon fixture for native publication transport tests."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.envelopes: list[dict] = []
        self.responses: dict[str, dict] = {}
        self._stop = False
        self._socket = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self._socket.bind(str(path))
        self._socket.listen()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self) -> None:
        while not self._stop:
            try:
                self._socket.settimeout(0.2)
                connection, _ = self._socket.accept()
            except (TimeoutError, socket.timeout, OSError):
                continue
            with connection:
                connection.sendall((json.dumps({
                    "type": "daemon_hello",
                    "protocol": {"name": "prime-agent.daemon", "version": 7},
                    "schema": {"revision": 28},
                }) + "\n").encode())
                buffer = b""
                while not self._stop:
                    try:
                        data = connection.recv(65536)
                    except OSError:
                        break
                    if not data:
                        break
                    buffer += data
                    while b"\n" in buffer:
                        line, buffer = buffer.split(b"\n", 1)
                        if not line:
                            continue
                        envelope = json.loads(line)
                        self.envelopes.append(envelope)
                        command = envelope.get("command", {})
                        command_type = command.get("type")
                        if command_type == "ack_result":
                            continue
                        if command_type == "create":
                            header = json.loads(
                                Path(command["sessionPath"]).read_text().splitlines()[0]
                            )
                            data = {
                                "activeSessionId": FAKE_PUBLICATION_ROUTE,
                                "sessionId": header["id"],
                                "sessionFile": command["sessionPath"],
                                "sessionName": command["name"],
                                "cwd": command["config"]["cwd"],
                                "isSessionActive": True,
                            }
                        elif command_type == "get_state":
                            data = {
                                "activeSessionId": FAKE_PUBLICATION_ROUTE,
                                "sessionId": self._session_id,
                                "sessionFile": self._session_file,
                                "sessionName": self._session_name,
                                "cwd": self._cwd,
                            }
                        elif command_type == "get_messages":
                            data = {"messages": [{
                                "role": "toolResult", "toolCallId": "call-real",
                            }]}
                        elif command_type == "kill":
                            data = {"ok": True}
                        else:
                            data = {}
                        if command_type == "create":
                            self._session_id = data["sessionId"]
                            self._session_file = data["sessionFile"]
                            self._session_name = data["sessionName"]
                            self._cwd = data["cwd"]
                        self.responses[envelope["id"]] = data
                        connection.sendall((json.dumps({
                            "type": "response", "id": envelope["id"],
                            "success": True, "data": data,
                        }) + "\n").encode())

    def close(self) -> None:
        self._stop = True
        try:
            self._socket.close()
        except OSError:
            pass
        self._thread.join(2)
        self.path.unlink(missing_ok=True)




def assert_legacy_publication_trace(daemon: PublicationFakeDaemon) -> None:
    """Every mutation must use the exact fake route and protocol-7 ack chain."""
    commands = [envelope["command"] for envelope in daemon.envelopes]
    assert [command["type"] for command in commands] == [
        "create", "ack_result", "get_state", "get_messages", "kill", "ack_result",
    ], commands
    create, create_ack, get_state, get_messages, kill, kill_ack = commands
    assert daemon.responses[create["id"]]["activeSessionId"] == FAKE_PUBLICATION_ROUTE
    for command in (get_state, get_messages, kill):
        assert command["activeSessionId"] == FAKE_PUBLICATION_ROUTE
    assert create_ack["commandId"] == create["id"]
    assert kill_ack["commandId"] == kill["id"]
    assert len({create["id"], create_ack["id"], get_state["id"],
                get_messages["id"], kill["id"], kill_ack["id"]}) == 6
    assert all(command["id"].startswith("spec_episode_") for command in (create, get_state, get_messages, kill))
    assert all(command["id"].startswith("spec_episode_ack_") for command in (create_ack, kill_ack))
    assert len({envelope["clientId"] for envelope in daemon.envelopes}) == 1
    for envelope in daemon.envelopes:
        assert envelope["type"] == "command"
        assert envelope["protocol"] == {"name": "prime-agent.daemon", "version": 7}
        assert envelope["command"]["id"] == envelope["id"]


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
    """Exercise public SessionManager against a runtime-verified fake daemon only."""
    prime_agent = shutil.which("prime-agent")
    assert prime_agent, "prime-agent is a documented developer prerequisite"
    request = json.dumps({"id": "loader", "type": "get_commands"}) + "\n"
    episode_import = json.dumps(str(EPISODE_EXTENSION))
    with tempfile.TemporaryDirectory(prefix="prime-claw-fake-episode-") as cwd:
        root = Path(cwd)
        socket_path = root / "publication.sock"
        transport_path = root / "transport.jsonl"
        daemon = PublicationFakeDaemon(socket_path)
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
            process = subprocess.Popen(
                [
                    prime_agent, "--mode", "rpc", "--offline", "--no-session",
                    "--no-skills", "--no-prompt-templates", "--no-context-files",
                    "--no-extensions", "--cwd", cwd, "-e", str(EXTENSION),
                    "-e", str(probe),
                ],
                cwd=REPO,
                env={
                    **{
                        key: value for key, value in os.environ.items()
                        if not key.startswith("PRIME_AGENT_INTERNAL_")
                        and not key.startswith("RLM_")
                        and key != "PRIME_AGENT_KERNEL_OWNER_PID"
                    },
                    "PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET": str(socket_path),
                    "PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_REGISTRY_DIR": str(root / "supervisor"),
                    "PRIME_AGENT_INTERNAL_LEGACY_OWNED_WORKER_FRONTEND": "1",
                },
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True,
            )
            assert process.stdin is not None and process.stdout is not None
            process.stdin.write(request)
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
            stderr = process.stderr.read() if process.stderr is not None else ""
            probe_error = error_path.read_text() if error_path.exists() else ""
            assert success_path.exists(), stderr + probe_error
            assert json.loads(success_path.read_text()) == {"ok": True}
            assert response["success"] is True
            assert_legacy_publication_trace(daemon)
            transport = [json.loads(line) for line in transport_path.read_text().splitlines()]
            assert transport[0] == {
                "kind": "runtime-guard", "socket": str(socket_path), "transportIsFake": True,
            }
            assert transport[1:] == [{"kind": "connect", "path": str(socket_path), "isFake": True}]
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
        "call `create_spec_episode` exactly once",
        "sole `location` argument",
        "Stop without implementing",
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
