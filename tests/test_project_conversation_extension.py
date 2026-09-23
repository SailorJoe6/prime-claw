import json
import selectors
import shutil
import subprocess
import time
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
PROFILE = REPO / ".prime/agent/profiles/project-conversation.md"
EXTENSION = REPO / "src/prime-agent-plugin/extensions/project-conversation.ts"
DOC = REPO / "docs/conversation-driven-episode-oversight.md"
DOC_INDEX = REPO / "docs/README.md"


def test_project_conversation_profile_is_a_dedicated_system_role_resource():
    assert PROFILE.is_file()
    assert PROFILE.parent.name == "profiles"
    assert ".prime/agent/prompts" not in PROFILE.as_posix()

    text = PROFILE.read_text()
    required = [
        "# PROJECT_CONVERSATION",
        "exact Prime Agent session identity",
        "existing `prepare` skill",
        "Do not emit",
        "ordinary project discussion",
        "Own only episodes created by this conversation",
        "at most one active",
        "later sequential episodes",
        "Distinguish transport admission, work completion, review, and operator",
        "Never infer approval to merge, abandon, expand scope, or perform destructive",
        "Stop and surface real blockers",
        "one coordination message",
        "exactly one non-steering",
        "15-minute agent-owned heartbeat",
        "context pressure",
    ]
    for phrase in required:
        assert phrase in text

    assert "/spec-it-out" in text
    assert "/plan" in text
    assert "/implement-spec" in text
    assert "daemon protocol" in text
    assert "Git recipes" in text


def test_extension_uses_exact_session_marker_and_chained_system_prompt_only():
    source = EXTENSION.read_text()

    for phrase in [
        'registerFlag("project-conversation"',
        'const MARKER_VERSION = 1',
        'role: ROLE',
        "sessionId",
        'pi.appendEntry(MARKER_TYPE',
        'pi.on("session_start"',
        'event.reason === "startup"',
        'pi.on("input"',
        'action: "handled"',
        'pi.on("before_agent_start"',
        "event.systemPrompt",
        "readFileSync",
        "assigned profile unavailable",
    ]:
        assert phrase in source

    assert "ctx.cwd" in source
    assert "getSessionId()" in source
    assert "candidate.customType === MARKER_TYPE" in source
    assert "data.sessionId !== sessionId" in source
    assert "registerCommand(" not in source
    assert "registerTool(" not in source
    assert "setActiveTools(" not in source
    assert "sendUserMessage(" not in source
    assert "getHeader()" in source
    assert "parentSession" in source
    assert "rlmDepth" in source


def test_current_documentation_describes_launch_and_role_boundaries():
    assert DOC.is_file()
    text = DOC.read_text()
    for phrase in [
        "prime-agent --cwd /path/to/project --project-conversation",
        "does not grant this role",
        "resumed or reloaded session",
        "fork can inherit the marker",
        'action: "handled"',
        "interactive",
        "extension-sourced",
        "registers no slash command",
        "does not change the active tool set",
        "grants no merge",
        ".prime/agent/profiles/project-conversation.md",
    ]:
        assert phrase in text

    assert "conversation-driven-episode-oversight.md" in DOC_INDEX.read_text()


def _write_native_probe_extension(path: Path, provider_records: Path, input_records: Path) -> None:
    path.write_text(rf'''import {{ appendFileSync }} from "node:fs";
import {{ createAssistantMessageEventStream }} from "@earendil-works/pi-ai";
const providerRecords = {json.dumps(str(provider_records))};
const inputRecords = {json.dumps(str(input_records))};
export default function probe(pi) {{
  pi.on("input", (event) => {{
    appendFileSync(inputRecords, JSON.stringify({{ source: event.source }}) + "\n");
  }});
  pi.registerCommand("pc-emit", {{
    description: "Emit one extension-source prompt",
    handler: async () => pi.sendUserMessage("extension-source probe"),
  }});
  pi.registerProvider("pc-probe", {{
    baseUrl: "http://127.0.0.1.invalid", apiKey: "unused", api: "pc-probe-api",
    streamSimple(model, context) {{
      appendFileSync(providerRecords, JSON.stringify({{ systemPrompt: context.systemPrompt }}) + "\n");
      const stream = createAssistantMessageEventStream();
      queueMicrotask(() => {{
        const message = {{
          role: "assistant", content: [{{ type: "text", text: "ok" }}],
          api: model.api, provider: model.provider, model: model.id,
          usage: {{ input: 0, output: 0, cacheRead: 0, cacheWrite: 0,
            totalTokens: 0, cost: {{ input: 0, output: 0, cacheRead: 0,
              cacheWrite: 0, total: 0 }} }},
          stopReason: "stop", timestamp: Date.now(),
        }};
        stream.push({{ type: "start", partial: message }});
        stream.push({{ type: "done", reason: "stop", message }});
        stream.end();
      }});
      return stream;
    }},
    models: [{{ id: "pc-probe-model", name: "Probe", reasoning: false,
      input: ["text"], cost: {{ input: 0, output: 0, cacheRead: 0,
        cacheWrite: 0 }}, contextWindow: 10000, maxTokens: 1000 }}],
  }});
}}
''')


def _jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def _run_rpc_prompt(args: list[str], message: str) -> list[dict]:
    process = subprocess.Popen(
        args, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, text=True, bufsize=1, cwd=REPO,
    )
    assert process.stdin is not None
    assert process.stdout is not None
    process.stdin.write(json.dumps({"id": "probe", "type": "prompt", "message": message}) + "\n")
    process.stdin.flush()
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    events = []
    deadline = time.monotonic() + 20
    try:
        while time.monotonic() < deadline:
            ready = selector.select(timeout=max(0, deadline - time.monotonic()))
            if not ready:
                break
            line = process.stdout.readline()
            if not line:
                break
            event = json.loads(line)
            events.append(event)
            if event.get("type") == "agent_end":
                break
            if event.get("id") == "probe" and event.get("type") == "response":
                if any(item.get("method") == "notify" for item in events):
                    break
    finally:
        selector.close()
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=3)
    stderr = process.stderr.read() if process.stderr is not None else ""
    assert any(event.get("id") == "probe" and event.get("success") is True for event in events), (
        json.dumps(events, indent=2) + stderr
    )
    return events


def _native_input_probe(tmp_path: Path, source: str, profile_state: str) -> tuple[list[dict], list[dict], list[dict]]:
    prime_agent = shutil.which("prime-agent")
    assert prime_agent, "prime-agent is a documented developer prerequisite"
    case = tmp_path / f"{source}-{profile_state}"
    project = case / "project"
    profile = project / ".prime/agent/profiles/project-conversation.md"
    profile.parent.mkdir(parents=True)
    if profile_state == "valid":
        profile.write_text("# PROJECT_CONVERSATION\n\nNATIVE PROFILE SENTINEL")
    elif profile_state == "empty":
        profile.write_text("   ")
    elif profile_state == "unreadable":
        profile.mkdir()
    elif profile_state != "missing":
        raise AssertionError(profile_state)

    provider_records = case / "provider.jsonl"
    input_records = case / "input.jsonl"
    probe_extension = case / "probe.ts"
    _write_native_probe_extension(probe_extension, provider_records, input_records)
    common = [
        prime_agent, "--offline", "--no-session", "--no-skills",
        "--no-prompt-templates", "--no-context-files", "--no-extensions",
        "--cwd", str(project), "-e", str(probe_extension), "-e", str(EXTENSION),
        "--provider", "pc-probe", "--model", "pc-probe-model",
        "--project-conversation",
    ]
    events: list[dict] = []
    if source == "interactive":
        completed = subprocess.run(
            [*common, "--mode", "text", "-p", "interactive-source probe"],
            cwd=REPO, capture_output=True, text=True, timeout=20,
        )
        assert completed.returncode == 0, completed.stdout + completed.stderr
    else:
        message = "rpc-source probe" if source == "rpc" else "/pc-emit"
        events = _run_rpc_prompt([*common, "--mode", "rpc"], message)
    return _jsonl(input_records), _jsonl(provider_records), events


def test_native_prime_agent_blocks_invalid_profiles_before_every_input_source(tmp_path):
    for source in ["interactive", "rpc", "extension"]:
        for profile_state in ["missing", "empty", "unreadable"]:
            inputs, providers, events = _native_input_probe(tmp_path, source, profile_state)
            assert inputs == [{"source": source}], (source, profile_state, inputs)
            assert providers == [], (source, profile_state, providers)
            if source != "interactive":
                notices = [event for event in events if event.get("method") == "notify"]
                assert len(notices) == 1
                assert "blocked before model dispatch" in notices[0]["message"]


def test_native_prime_agent_valid_profiles_dispatch_once_with_one_overlay(tmp_path):
    for source in ["interactive", "rpc", "extension"]:
        inputs, providers, _events = _native_input_probe(tmp_path, source, "valid")
        assert inputs == [{"source": source}]
        assert len(providers) == 1
        prompt = providers[0]["systemPrompt"]
        assert prompt.count("# PROJECT_CONVERSATION") == 1
        assert "NATIVE PROFILE SENTINEL" in prompt


def test_native_rlm_child_and_fork_do_not_inherit_project_conversation_role(tmp_path):
    prime_agent = shutil.which("prime-agent")
    assert prime_agent, "prime-agent is a documented developer prerequisite"
    project = tmp_path / "child-project"
    profile = project / ".prime/agent/profiles/project-conversation.md"
    profile.parent.mkdir(parents=True)
    profile.write_text("# PROJECT_CONVERSATION\n\nNATIVE CHILD SENTINEL")
    agent_dir = tmp_path / "agent"
    result = tmp_path / "child-result.json"
    child_probe = tmp_path / "child-probe.ts"
    child_probe.write_text(rf'''import {{ writeFileSync }} from "node:fs";
import {{ join }} from "node:path";
import {{ createAgentSessionRuntime, createAgentSessionServices,
  createAgentSessionFromServices, SessionManager }} from "@earendil-works/pi-coding-agent";
import {{ getModel }} from "@earendil-works/pi-ai";
const cwd = {json.dumps(str(project))};
const agentDir = {json.dumps(str(agent_dir))};
const extensionPath = {json.dumps(str(EXTENSION))};
const resultPath = {json.dumps(str(result))};
export default function childProbe(pi) {{
  pi.on("session_start", async () => {{
    let runtime;
    try {{
      const model = getModel("openai", "gpt-4.1");
      const createRuntime = async (target) => {{
        const services = await createAgentSessionServices({{
          cwd: target.cwd, agentDir,
          extensionFlagValues: new Map(Object.entries(
            target.sessionConfig?.extensionFlagValues ?? {{}})),
          noBuiltinHerdrReporter: true, telemetryDisabled: true,
          resourceLoaderOptions: {{ additionalExtensionPaths: [extensionPath],
            noExtensions: true, noSkills: true, noPromptTemplates: true,
            noContextFiles: true, noThemes: true }},
        }});
        const created = await createAgentSessionFromServices({{
          services, sessionManager: target.sessionManager,
          sessionStartEvent: target.sessionStartEvent, model,
          thinkingLevel: "off", noTools: true, prewarmIpythonKernel: false,
          telemetryDisabled: true, ...(target.sessionOptions ?? {{}}),
        }});
        return {{ ...created, services, diagnostics: services.diagnostics }};
      }};
      runtime = await createAgentSessionRuntime(createRuntime, {{
        cwd, agentDir,
        sessionManager: SessionManager.create(cwd, join(agentDir, "parent")),
        sessionConfig: {{ extensionFlagValues: {{ "project-conversation": true }} }},
      }});
      await runtime.session.bindExtensions({{}});
      const child = await runtime.createRlmSubagentRuntime({{
        id: "native-child-probe", sessionName: "native-child-probe",
        parentSession: runtime.session, sessionDir: join(agentDir, "child"),
        model, thinkingLevel: "off", scopedModels: [], activeToolNames: [],
        allowedToolNames: [], customTools: [], includeGoals: false,
        includeCompactSkill: false, rlmDepth: 1, rlmMaxDepth: 2,
      }});
      const markers = (session) => session.sessionManager.getEntries()
        .filter((entry) => entry.customType === "prime-claw-project-conversation");
      const parentSessionId = runtime.session.sessionId;
      const parentMarkers = markers(runtime.session);
      const childSessionId = child.session.sessionId;
      const childHeader = child.session.sessionManager.getHeader();
      const childMarkers = markers(child.session);
      runtime.session.sessionManager.appendMessage({{
        role: "user", content: "fork seed", timestamp: Date.now(),
      }});
      const forkPoint = runtime.session.sessionManager.getLeafId();
      await runtime.session.sessionManager.flushNow();
      await runtime.fork(forkPoint);
      await runtime.session.bindExtensions({{}});
      writeFileSync(resultPath, JSON.stringify({{
        parentSessionId, parentMarkers,
        childSessionId, childHeader, childMarkers,
        forkSessionId: runtime.session.sessionId,
        forkHeader: runtime.session.sessionManager.getHeader(),
        forkMarkers: markers(runtime.session),
      }}, null, 2));
    }} catch (error) {{
      writeFileSync(resultPath, JSON.stringify({{
        probeError: String(error), stack: error?.stack,
      }}, null, 2));
    }} finally {{
      if (runtime) await runtime.dispose();
    }}
  }});
}}
''')
    provider_records = tmp_path / "outer-provider.jsonl"
    input_records = tmp_path / "outer-input.jsonl"
    provider_probe = tmp_path / "outer-provider.ts"
    _write_native_probe_extension(provider_probe, provider_records, input_records)
    completed = subprocess.run([
        prime_agent, "--mode", "text", "--offline", "--no-session",
        "--no-skills", "--no-prompt-templates", "--no-context-files",
        "--no-extensions", "--cwd", str(project), "-e", str(provider_probe),
        "-e", str(child_probe), "--provider", "pc-probe",
        "--model", "pc-probe-model", "-p", "outer probe",
    ], cwd=REPO, capture_output=True, text=True, timeout=30)
    assert completed.returncode == 0, completed.stdout + completed.stderr
    observed = json.loads(result.read_text())
    assert "probeError" not in observed, observed
    assert len(observed["parentMarkers"]) == 1
    assert observed["parentMarkers"][0]["data"]["sessionId"] == observed["parentSessionId"]
    assert observed["childSessionId"] != observed["parentSessionId"]
    assert observed["childHeader"]["rlmDepth"] == 1
    assert observed["childHeader"]["parentSession"]
    assert observed["childMarkers"] == []
    assert observed["forkSessionId"] != observed["parentSessionId"]
    assert observed["forkHeader"]["id"] == observed["forkSessionId"]
    assert observed["forkMarkers"] == []
