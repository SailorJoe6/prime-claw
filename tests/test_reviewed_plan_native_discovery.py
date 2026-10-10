"""Frozen Orca/Prime Agent discovery contract mapped to current implementation."""
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
EVIDENCE = REPO / "docs/evidence/2026-10-09-orca-prime-agent-integration-probes.md"
EPISODE = REPO / "src/prime-agent-plugin/extension-support/spec-episode.ts"
OWNERSHIP = REPO / "src/prime-agent-plugin/extension-support/episode-ownership.ts"
OVERSIGHT = REPO / "src/prime-agent-plugin/extension-support/conversation-oversight.ts"


def test_frozen_discovery_matrix_keeps_all_accepted_boundary_rows():
    text = EVIDENCE.read_text()
    for row in ("| L1 ", "| L13 ", "| R1 ", "| R2 ", "| H1 ", "| H2 ", "| B1 ", "| A1 ", "| D1 ", "| S1 ", "| C1 ", "| F1 "):
        assert row in text
    assert "Orca CLI/runtime | `1.4.223`" in text
    assert "Prime Agent TUI | `0.9.8`" in text


def test_implementation_encodes_promotion_launch_and_recovery_order():
    source = EPISODE.read_text().split("export async function createSpecEpisode", 1)[1]
    order = [
        source.index("store.write(repo, record)"),
        source.index("orca.createWorktree"),
        source.index("filesystem.promoteBundle(worktree.path"),
        source.index("git.commitPromotion(worktree.path"),
        source.index("orca.createLaunchAutomation"),
        source.index("orca.runAutomation"),
        source.index("waitForOrcaBinding"),
        source.index("orca.removeAutomation"),
    ]
    assert order == sorted(order)
    full_source = EPISODE.read_text()
    assert '"--provider", "prime-agent"' in full_source
    assert '"--activate"' not in source
    assert "forkFrom(" not in source
    assert "Remote Episode placement is disabled" in full_source


def test_single_record_and_compaction_contract_replace_legacy_protocol():
    ownership = OWNERSHIP.read_text()
    oversight = OVERSIGHT.read_text()
    assert '.prime-claw", "ownership.json"' in ownership
    assert 'pi.on("session_compact"' in oversight
    assert "triggerTurn: false" in oversight
    combined = ownership + oversight + EPISODE.read_text()
    for obsolete in ("spec-episodes", "bootstrapAdmission", "GuideReceipt", "activate_conversation_guide", "conversation_guide_status", "forkPrimeSession"):
        assert obsolete not in combined
