"""Project Conversation lifecycle coverage.

Static checks are Tier 0. The Node behavior suite runs inside Docker Tier 1.
"""
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
ROLE_KERNEL = REPO / "src/prime-agent-plugin/ROLE_KERNEL.md"
EXTENSION = REPO / "src/prime-agent-plugin/extensions/reviewed-plan.ts"
SUPPORT = REPO / "src/prime-agent-plugin/extension-support/conversation-oversight.ts"
MANAGED_GUIDE = REPO / "src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md"
WS_NODE_SUITE = "/workspace/tests/project_conversation_extension.test.mjs"


def test_final_source_uses_neutral_kernel_and_one_managed_conversation_guide():
    kernel = " ".join(ROLE_KERNEL.read_text().split())
    guide = " ".join(MANAGED_GUIDE.read_text().split())
    for phrase in ("PRIME_CLAW_ROLE_KERNEL_V1", "CONVERSATION supervises", "EPISODE implements", "EXPERT reviews", "Roles are skill-based responsibilities"):
        assert phrase in kernel
    for phrase in ("one durable Prime Claw ownership record", "one reported vertical slice at a time", "Accept and advance", "Consult the operator"):
        assert phrase in guide
    assert not (REPO / "src/prime-agent-plugin/APPEND_SYSTEM.md").exists()
    assert not (REPO / ".ralph/skills/oversee-episode").exists()
    assert not (REPO / ".agents/skills/oversee-episode").exists()


def test_extension_uses_one_record_and_post_compaction_guidance_without_auth_protocol():
    source = EXTENSION.read_text() + SUPPORT.read_text()
    assert "registerConversationOversight(pi, oversightOptions);" in source
    assert 'pi.on("session_compact"' in source
    assert "readEpisodeOwnership" in source
    assert "triggerTurn: false" in source
    for obsolete in (
        'pi.on("context"', "currentProspectivePreparation",
        "assertProspectiveConversationGuideReady", "OVERSIGHT_MARKER_TYPE",
        "LEGACY_OVERSIGHT_PACKAGE_TYPE", "spec-episodes", "GuideReceipt", "sha256",
        "prime_claw_activate_conversation_guide", "prime_claw_conversation_guide_status",
        "filterGuideMessages",
    ):
        assert obsolete not in source


def test_project_conversation_node_suite(tier1_container):
    result = tier1_container.run("node", "--experimental-strip-types", "--test", WS_NODE_SUITE, timeout=120)
    assert result.returncode == 0, result.stdout + result.stderr
