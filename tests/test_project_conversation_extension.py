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
    assert 'pi.on("input"' not in source


def test_current_documentation_describes_launch_and_role_boundaries():
    assert DOC.is_file()
    text = DOC.read_text()
    for phrase in [
        "prime-agent --cwd /path/to/project --project-conversation",
        "does not grant this role",
        "resumed or reloaded session",
        "fork can inherit the marker",
        "fails closed",
        "registers no slash command",
        "does not change the active tool set",
        "grants no merge",
        ".prime/agent/profiles/project-conversation.md",
    ]:
        assert phrase in text

    assert "conversation-driven-episode-oversight.md" in DOC_INDEX.read_text()
