"""Contract tests for the Markdown-only native EXPERT workflow."""
from pathlib import Path
import subprocess
import sys


REPO = Path(__file__).resolve().parents[1]
SKILL = REPO / "src/prime-agent-plugin/skills/prime-claw-expert-review/SKILL.md"
CLEANUP = REPO / "scripts/cleanup-retired-prime-agent-expert-review.py"
OLD_FILES = (
    "SKILL.md",
    "pyproject.toml",
    "src/prime_claw_official_expert_review/__init__.py",
    "src/prime_claw_official_expert_review/reviewer.md",
)


def test_expert_skill_uses_native_model_spawn_message_and_cleanup() -> None:
    text = SKILL.read_text()
    assert "name: prime-claw-expert-review" in text
    for required in (
        "rlm.find_models", "openai-codex/gpt-6-astra", 'thinking="max"',
        "rlm.spawn", "Bootstrap only", "agent_message.send",
        "agent_observe", "rlm.collect", "rlm.delete_subagent", "actual model",
    ):
        assert required in text
    assert text.index("rlm.spawn") < text.index("agent_message.send")


def test_expert_skill_accepts_normal_context_and_preserves_review_judgment() -> None:
    text = SKILL.read_text()
    for required in (
        "normal review request", "caller overrides", "ask the caller",
        "short conclusion", "material findings", "realistic impact",
        "proportionate general repair direction", "Do not expand scope",
        "Adversarial red-team review requires explicit operator authorization",
    ):
        assert required in text
    for retired in (
        "prime_claw_official_expert_review", "launch(packet)", "submit(report)",
        "prime-claw-official-expert-review-packet", "PASS`/`BLOCK",
    ):
        assert retired not in text


def _old_skill(root: Path) -> Path:
    target = root / "skills/prime-claw-official-expert-review"
    for relative in OLD_FILES:
        path = target / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(relative)
    return target


def _run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(CLEANUP), *args], text=True, capture_output=True,
    )


def test_retired_expert_cleanup_removes_only_exact_known_roots(tmp_path: Path) -> None:
    plugin = tmp_path / "plugin"
    plugin.mkdir()
    old = _old_skill(plugin)
    cache = old / "src/prime_claw_official_expert_review/__pycache__/__init__.cpython-313.pyc"
    cache.parent.mkdir()
    cache.write_bytes(b"known derived cache")
    coding = tmp_path / "agent"
    state = coding / "prime-claw-private/expert-review-launches"
    state.mkdir(parents=True)
    (state / "old.closed.json").write_text("{}")
    unrelated = coding / "keep.txt"
    unrelated.write_text("keep")

    result = _run("remove", "--plugin-root", str(plugin), "--coding-agent-root", str(coding))
    assert result.returncode == 0, result.stderr
    assert not old.exists()
    assert not state.exists()
    assert unrelated.read_text() == "keep"
    assert _run("check-absent", "--plugin-root", str(plugin), "--coding-agent-root", str(coding)).returncode == 0


def test_retired_expert_cleanup_rejects_unknown_layout_and_symlink(tmp_path: Path) -> None:
    plugin = tmp_path / "plugin"
    plugin.mkdir()
    old = _old_skill(plugin)
    (old / "unexpected").write_text("stop")
    rejected = _run("validate", "--plugin-root", str(plugin))
    assert rejected.returncode != 0
    assert old.exists()

    safe = tmp_path / "safe"
    safe.mkdir()
    linked_plugin = tmp_path / "linked-plugin"
    linked_plugin.symlink_to(safe, target_is_directory=True)
    linked = _run("validate", "--plugin-root", str(linked_plugin))
    assert linked.returncode != 0


def test_retired_expert_cleanup_rejects_symlinked_private_state(tmp_path: Path) -> None:
    plugin = tmp_path / "plugin"
    plugin.mkdir()
    coding = tmp_path / "agent"
    private = coding / "prime-claw-private"
    private.mkdir(parents=True)
    outside = tmp_path / "outside-state"
    outside.mkdir()
    (outside / "keep").write_text("keep")
    (private / "expert-review-launches").symlink_to(outside, target_is_directory=True)

    rejected = _run(
        "remove", "--plugin-root", str(plugin), "--coding-agent-root", str(coding),
    )
    assert rejected.returncode != 0
    assert (outside / "keep").read_text() == "keep"
