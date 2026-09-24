import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SKILL = REPO / ".ralph/skills/oversee-episode/SKILL.md"
PROFILE = REPO / ".prime/agent/profiles/expert-reviewer.md"
DOC = REPO / "docs/conversation-driven-episode-oversight.md"


def _parse_profile(text: str):
    lines = text.splitlines()
    assert lines and lines[0] == "---"
    assert "---" in lines[1:]
    closing = lines.index("---", 1)
    assert closing > 1
    pairs = []
    for line in lines[1:closing]:
        assert line and not line.startswith((" ", "\t", "#"))
        assert line.count(":") == 1
        key, value = line.split(":", 1)
        assert key in {"name", "model", "thinking"}
        assert value.startswith(" ")
        scalar = value.strip()
        assert re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", scalar)
        pairs.append((key, scalar))
    assert len(pairs) == 3
    assert len({key for key, _ in pairs}) == 3
    fields = dict(pairs)
    assert fields["name"] == "expert-reviewer"
    body = "\n".join(lines[closing + 1 :]).strip()
    assert body
    return fields, body


def _profile():
    return _parse_profile(PROFILE.read_text())


def test_expert_profile_selects_one_exact_model_and_reasoning_level():
    fields, body = _profile()
    assert fields == {
        "name": "expert-reviewer",
        "model": "openai-codex/gpt-6-astra",
        "thinking": "max",
    }
    assert body


def test_expert_profile_contract_rejects_ambiguous_or_open_configuration():
    valid = PROFILE.read_text()
    invalid = [
        valid.replace("name: expert-reviewer", "name: other"),
        valid.replace("model: openai-codex/gpt-6-astra", "model: unauthorized\nmodel: openai-codex/gpt-6-astra"),
        valid.replace("name: expert-reviewer", "name: other\nname: expert-reviewer"),
        valid.replace("thinking: max", "thinking: low\nthinking: max"),
        valid.replace("thinking: max", "fallback: default\nthinking: max"),
        valid.replace("name: expert-reviewer\n", ""),
        valid.replace("model: openai-codex/gpt-6-astra\n", ""),
        valid.replace("thinking: max", "thinking:"),
        valid.replace("thinking: max", "thinking:\n  level: max"),
        valid.replace("thinking: max", "thinking: [max]"),
        valid.replace("thinking: max", "thinking: {level: max}"),
        valid.replace("thinking: max", "thinking: |"),
        valid.replace("thinking: max", "thinking: >"),
        valid.replace("thinking: max", "thinking: &level max"),
        valid.replace("---\n", " ---\n", 1),
        valid.replace("---\n# EXPERT", "--- extra\n# EXPERT", 1),
        "---\nname: expert-reviewer\nmodel: openai-codex/gpt-6-astra\nthinking: max\n---\n",
    ]
    for text in invalid:
        try:
            _parse_profile(text)
        except AssertionError:
            continue
        raise AssertionError("invalid EXPERT profile was accepted")


def test_expert_profile_is_read_only_and_makes_blocks_actionable():
    _, body = _profile()
    for phrase in [
        "one exact pushed commit",
        "independently and read-only",
        "Do not edit or steer the subject",
        "Return the result to the owning conversation",
        "Return `PASS`",
        "return `BLOCK`",
        "violated invariant",
        "root cause or failing lifecycle seam",
        "recommended repair direction",
        "approaches to avoid",
        "positive, negative, failure, and replay tests",
        "regression risks",
        "repaired together",
        "bounded alternatives",
    ]:
        assert phrase in body


def test_oversee_skill_uses_exact_fail_closed_safe_spawn_protocol():
    text = " ".join(SKILL.read_text().split())
    for phrase in [
        ".prime/agent/profiles/expert-reviewer.md",
        "exactly one nonempty bounded scalar each for `name`, `model`, and `thinking`",
        "no duplicate, nested, collection, block, or additional keys",
        "`name: expert-reviewer`",
        "rlm.find_models",
        "one exact selector match",
        "call `rlm.spawn`",
        "only a harmless bootstrap",
        "exact resolved `model`",
        "configured `thinking`",
        "verify the returned handle names that exact model",
        "profile body and focused read-only exact-commit packet exactly once",
        "agent_message.send",
        "complete `PASS` or actionable `BLOCK` report",
        "Preserve the report before stopping and deleting that exact fresh reviewer",
        "returned model",
        "admitted reasoning level",
        "Never resend an uncertain delivered task",
        "outstanding delivery/report work",
        "use the current/default model",
        "retry another selector",
    ]:
        assert phrase in text
    assert text.index("call `rlm.spawn`") < text.index("verify the returned handle")
    assert text.index("verify the returned handle") < text.index("agent_message.send")
    assert text.index("Preserve the report") < text.index("stopping and deleting")


def test_current_documentation_explains_project_expert_policy():
    text = " ".join(DOC.read_text().split())
    for phrase in [
        "names `expert-reviewer`",
        "openai-codex/gpt-6-astra",
        "`max`",
        "prohibits editing or steering the subject",
        "returning findings to the owner",
        "exact selector match",
        "only a harmless bootstrap",
        "verify that the returned handle names the requested model",
        "profile body plus real read-only packet together exactly once",
        "Successful spawn admission proves acceptance of the explicit reasoning request",
        "preserves and adjudicates a complete report before stopping and deleting",
        "Uncertain delivery is never resent",
        "never authorizes merge",
    ]:
        assert phrase in text
