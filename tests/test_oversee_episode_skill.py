import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SKILL = REPO / ".ralph/skills/oversee-episode/SKILL.md"
PROFILE = REPO / ".prime/agent/profiles/expert-reviewer.md"
DOC = REPO / "docs/conversation-driven-episode-oversight.md"
FUTURE_DOC = REPO / "docs/future-specification-bundles.md"
HANDOFF_DOC = REPO / "docs/handoff-chain.md"


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


def test_oversee_skill_bounds_owner_driven_continuation_and_sequential_return():
    text = " ".join(SKILL.read_text().split())
    for phrase in [
        "`advance` only after this owner accepts the exact candidate",
        "`revise` only from findings this owner has accepted",
        "An accepted `advance` or in-scope `revise` needs no new operator transport request",
        "exact retained future-folder location",
        "operator-supplied focus or a bounded synthesis of the accepted durable findings",
        "Never route arbitrary chat, unaccepted findings, a new product decision, or scope expansion",
        "cancel the completed generation's old watch",
        "pre-arm exactly one non-steering watch for the intended generation",
        "immediately before calling the terminal `handoff_spec_episode`",
        "keep the pre-armed intended-generation watch available for a later fresh observed-idle retry",
        "The watch never retries automatically",
        "Before any owner retry, obtain a fresh exact state snapshot",
        "Retain the watch across success, partial admission, ambiguity, or definite first-send no-admission",
        "Never create the intended-generation watch after success or arm a duplicate",
        "never retry an uncertain transport result",
        "use the tool for `consult`, `pause`, or a terminal disposition",
        "Treat the operator's ordinary conversational `merge`, `revise`, `pause`, or `abandon` response as the sole terminal decision",
        "Only after terminal work is verified, call `finalize_spec_episode` once with the exact retained future-folder `location`",
        "This no-UI, idempotent call is bookkeeping only",
        "return to ordinary CONVERSATION work",
        "A later reviewed folder at a fresh location requires a native `/implement-spec` run",
        "never lifetime-locks the owner conversation",
    ]:
        assert phrase in text
    assert "only when the operator clearly asks" not in text
    assert "After admission, immediately create the one watch" not in text
    assert text.index("recorded durably") < text.index("calling the terminal `handoff_spec_episode`")
    continuation = text.split("For an accepted `advance` or in-scope `revise`", 1)[1].split("Before presenting merge readiness", 1)[0]
    assert continuation.index("cancel the completed generation's old watch") < continuation.index("pre-arm exactly one non-steering watch")
    assert continuation.index("pre-arm exactly one non-steering watch") < continuation.index("calling the terminal `handoff_spec_episode`")
    for forbidden in ["authorize phase", "authorization receipt", "completion phase", "single UI confirmation", "terminal facts"]:
        assert forbidden not in text


def test_oversee_skill_trusts_idle_status_and_retains_the_intended_retry_watch():
    raw = SKILL.read_text()
    text = " ".join(raw.split())
    question = "You seem done with your work. Are you complete or waiting for some process?"

    assert question in raw
    for phrase in [
        "If no completion report arrives but the heartbeat sees apparent quiescence",
        "Trust that answer before beginning review or handoff",
        "definite first-send no-admission",
        "keep the pre-armed intended-generation watch available for a later fresh observed-idle retry",
        "The watch never retries automatically",
        "require the exact owned episode to be idle again",
    ]:
        assert phrase in text
    assert "Cancel the pre-armed watch only when the result proves definite no-admission" not in text
    assert text.index("If no completion report arrives") < text.index(question)
    assert text.index(question) < text.index("Trust that answer before beginning review or handoff")
    retry = text.split("If the result proves definite first-send no-admission", 1)[1]
    assert retry.index("keep the pre-armed intended-generation watch") < retry.index("Before any owner retry")


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


def test_current_docs_bound_owner_continuation_without_changing_host_authority():
    current = " ".join(DOC.read_text().split())
    future = " ".join(FUTURE_DOC.read_text().split())
    handoff = " ".join(HANDOFF_DOC.read_text().split())
    for fragment in (
        "without a new operator transport request",
        "operator focus or a bounded compaction-focus synthesis",
        "EPISODE sibling's explicit completion report",
        "You seem done with your work. Are you complete or waiting for some process?",
        "later fresh observed-idle retry",
        "watch never retries automatically",
        "reasonably quiescent observation",
        "preserves a valid resident route even when `isSessionActive` is false",
        "ordinary `prompt` with `queueIfBusy: false`",
        "not an atomic all-busy guard",
        "streaming race definitely rejects",
        "immediate-or-queued admission",
        "never blindly replayed",
        "fresh native `/implement-spec` run",
        "never lifetime-locks that owner",
    ):
        assert fragment in current
    for fragment in (
        "EPISODE sibling's explicit completion report",
        "heartbeat is only a missed-report safety net",
        "retains an exact resident route even when `isSessionActive` is false",
        "ordinary `prompt` with `queueIfBusy: false`",
        "not an atomic all-busy guard",
        "streaming race definitely rejects",
        "immediate-or-queued admission only",
        "leaves the owner watch available for a later retry",
        "not permission to retry",
    ):
        assert fragment in future
    for fragment in (
        "without a new operator transport request",
        "broader `ralph_handoff` adapter above remains operator-request-only",
        "existing `<operator-compaction-guidance>` envelope",
        "legacy tag is not a routing authority",
        "explicit completion report",
        "reasonably quiescent session observation",
        "ordinary `prompt`",
        "not an atomic all-busy guard",
        "streaming race definitely rejects",
        "immediate-or-queued admission only",
        "leaves the owner watch available for a later retry",
        "never retried automatically",
    ):
        assert fragment in handoff


def test_oversee_skill_requires_final_review_renewal_and_bounds_one_technical_replacement():
    text = " ".join(SKILL.read_text().split())
    for phrase in [
        "confirmed terminal after a purely technical failure",
        "no usable `PASS` or `BLOCK` disposition",
        "exactly one fresh replacement",
        "same validated profile and exact review packet",
        "owner ledger so context refresh cannot replenish",
        "does not apply to a still-active reviewer, ambiguous delivery or state, unavailable policy or access, or a substantive `BLOCK`",
        "replacement also fails or is uncertain",
        "fresh final EXPERT review of the complete exact candidate",
        "intermediate review, another commit's report, incomplete review, or unresolved `BLOCK`",
        "material repair changes the candidate and invalidates the prior review",
        "operator pause or abandonment request remains available without a merge-readiness claim",
        "EXPERT `PASS` is evidence, never merge authority",
    ]:
        assert phrase in text


def test_current_documentation_explains_final_review_and_one_replacement_limits():
    text = " ".join(DOC.read_text().split())
    for phrase in [
        "confirmed terminal after a purely technical failure",
        "no usable `PASS` or `BLOCK`",
        "exactly one fresh replacement",
        "same validated profile and exact review packet",
        "context refresh cannot replenish",
        "still-active reviewer, ambiguous delivery or state, unavailable policy or access, or a substantive `BLOCK`",
        "replacement failure or uncertainty pauses for the operator",
        "fresh final EXPERT review of the complete exact candidate",
        "intermediate PASS cannot satisfy this gate",
        "material repair invalidates the prior review",
        "Pause or abandonment remains available without claiming merge readiness",
        "PASS is evidence, not merge authority",
    ]:
        assert phrase in text
