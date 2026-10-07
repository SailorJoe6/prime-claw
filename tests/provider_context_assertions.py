"""Shared provider-visible context assertions for native Prime Agent probes.

Prime Agent converts extension custom messages before ``streamSimple``. The
provider therefore cannot rely on ``customType`` metadata: leaked oversight text
is visible as a user message. The retired work-control extension used a different
channel: ``before_agent_start`` appended its detailed policy to the effective
system prompt. Unique fixture sentinels make both channels observable without
matching ordinary user discussion as injected system policy.
"""

import json

LEGACY_PACKAGE_SENTINEL = "PRIME_CLAW_TEST_LEGACY_PACKAGE_7D17AF7354A14C65"
RETIRED_WORK_CONTROL_SENTINEL = "PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1"
RETIRED_WORK_CONTROL_START = "<!-- prime-claw:goal-heartbeat-work-control:start -->"
RETIRED_WORK_CONTROL_END = "<!-- prime-claw:goal-heartbeat-work-control:end -->"
RETIRED_WORK_CONTROL_CONTROL = "PRIME_CLAW_TEST_RETIRED_WORK_CONTROL_91B3DF1D12C44C5A"
ORDINARY_USER_SENTINEL = "PRIME_CLAW_TEST_ORDINARY_USER_2F625A178B6B4FD0"
ROLE_KERNEL_SENTINEL = "PRIME_CLAW_ROLE_KERNEL_V1"
CONVERSATION_GUIDE_SENTINEL = "PRIME_CLAW_CONVERSATION_GUIDE_V1"
BOUNDED_IDENTITY_SENTINEL = "PRIME_CLAW_BOUNDED_IDENTITY_V1"
EXPERT_RUBRIC_SENTINEL = "# EXPERT reviewer"
EXPERT_PACKET_SENTINEL = "## Immutable review packet"
EXPERT_PRIVATE_STATE_SENTINEL = "prime-claw-official-expert-review-state"

# Historical-shaped test fixture copied from the retired injector's policy. It
# intentionally stays in tests: production proves absence by not installing the
# injector, never by adding a system-prompt scrubber.
RETIRED_WORK_CONTROL_POLICY = f"""{RETIRED_WORK_CONTROL_START}
{RETIRED_WORK_CONTROL_SENTINEL}
Goal and heartbeat work control:
- For substantive multi-step work, inspect the persistent goal and create one bounded active-work goal unless a compatible active goal already owns the same authorized work. Do not create goals for trivial answers or quick lookups. Do not replace, complete, or reinterpret an incompatible pending goal merely to make room.
- A goal owns the current active-work epoch toward the broader requested outcome. Completing an epoch does not claim the requested outcome is complete, and goal creation does not require predicting the next gate or ownership boundary.
- A heartbeat owns one exact observable wait. Keep it with a goal only during the short handoff that creates and verifies monitoring before completing the compatible active-work goal, or when they own independent work.
- When the agent actually starts a long-running or background operation such as a subagent, build or test, download, deployment, or container startup: retain an inspectable handle and output/status location; create one bounded rlm_heartbeat with exact running, success, failure, staleness, cleanup, and resumable-checkpoint conditions; verify its ID; recheck the operation; then, if it is still running, complete the current goal even when requested work remains and end the turn. If it is already terminal, delete and verify removal of the heartbeat and handle the result now.
- A non-terminal heartbeat check reports only meaningful change and creates no goal. It never restarts work. Routine monitors use follow-up delivery. Delete the exact heartbeat and verify absence at terminal state.
- The first observer of terminal state captures evidence, deletes the exact monitor, performs bounded cleanup, and acts idempotently. If the requested outcome is complete, report it without another goal. If substantive agent work remains, create a fresh bounded goal before continuing. Never resume a completed epoch or disturb an unrelated pending goal.
- When blocked or waiting for user input, credentials, permission, physical action, or a product decision: stop only monitors that cannot produce useful evidence; complete the current goal even when the requested outcome remains unfinished; report the exact blocker, external action, process state, and one resumable checkpoint; then stop without creating a heartbeat to poll the person. After the blocker clears, create a fresh goal before substantive work resumes.
- Never inject, simulate, or call native /goal pause or /goal resume for autonomous work control. Human use of native goal commands remains authoritative.
- Preserve narrower episode, expert, delegated-task, security, and credential boundaries. Report any goal or heartbeat control-plane failure with the external identity and checkpoint intact; never claim a transfer or completion that did not occur.
{RETIRED_WORK_CONTROL_END}"""


def provider_capture_expression(context_var: str = "context") -> str:
    """Return a TypeScript expression that inspects provider-visible channels."""
    package = json.dumps(LEGACY_PACKAGE_SENTINEL)
    retired_sentinel = json.dumps(RETIRED_WORK_CONTROL_SENTINEL)
    retired_start = json.dumps(RETIRED_WORK_CONTROL_START)
    retired_end = json.dumps(RETIRED_WORK_CONTROL_END)
    retired_control = json.dumps(RETIRED_WORK_CONTROL_CONTROL)
    ordinary = json.dumps(ORDINARY_USER_SENTINEL)
    role_kernel = json.dumps(ROLE_KERNEL_SENTINEL)
    conversation_guide = json.dumps(CONVERSATION_GUIDE_SENTINEL)
    bounded_identity = json.dumps(BOUNDED_IDENTITY_SENTINEL)
    expert_rubric = json.dumps(EXPERT_RUBRIC_SENTINEL)
    expert_packet = json.dumps(EXPERT_PACKET_SENTINEL)
    expert_private = json.dumps(EXPERT_PRIVATE_STATE_SENTINEL)
    return f"""(()=>{{const providerMessages={context_var}.messages??[],systemPrompt=typeof {context_var}.systemPrompt==="string"?{context_var}.systemPrompt:"",text=value=>typeof value==="string"?value:Array.isArray(value)?value.map(part=>typeof part==="string"?part:part?.type==="text"?part.text??"":"").join(""):"",userText=providerMessages.filter(message=>message?.role==="user").map(message=>text(message.content)).join("\\n"),userCount=token=>userText.split(token).length-1,systemCount=token=>systemPrompt.split(token).length-1,customText=providerMessages.filter(message=>message?.role==="custom").map(message=>JSON.stringify(message)).join("\\n"),customCount=token=>customText.split(token).length-1;return{{legacyOversightUserCount:userCount({package}),retiredWorkControlQuotedUserCount:userCount({retired_sentinel}),ordinaryUserCount:userCount({ordinary}),roleKernelSystemCount:systemCount({role_kernel}),roleKernelUserCount:userCount({role_kernel}),roleKernelCustomCount:customCount({role_kernel}),conversationGuideSystemCount:systemCount({conversation_guide}),conversationGuideUserCount:userCount({conversation_guide}),conversationGuideCustomCount:customCount({conversation_guide}),boundedIdentitySystemCount:systemCount({bounded_identity}),boundedIdentityUserCount:userCount({bounded_identity}),boundedIdentityCustomCount:customCount({bounded_identity}),expertRubricSystemCount:systemCount({expert_rubric}),expertRubricUserCount:userCount({expert_rubric}),expertRubricCustomCount:customCount({expert_rubric}),expertPacketSystemCount:systemCount({expert_packet}),expertPacketUserCount:userCount({expert_packet}),expertPacketCustomCount:customCount({expert_packet}),expertPrivateStateSystemCount:systemCount({expert_private}),expertPrivateStateUserCount:userCount({expert_private}),expertPrivateStateCustomCount:customCount({expert_private}),controlledSentinelCustomCount:[{package},{retired_control}].reduce((total,token)=>total+customCount(token),0),retiredWorkControlSystemSentinelCount:systemCount({retired_sentinel}),retiredWorkControlSystemStartCount:systemCount({retired_start}),retiredWorkControlSystemEndCount:systemCount({retired_end}),retiredWorkControlSystemControlCount:systemCount({retired_control})}}}})()"""


def assert_provider_context_clean(
    row: dict,
    *,
    ordinary_count: int | None = None,
    quoted_work_control_user_count: int | None = None,
    role_kernel_system_count: int | None = None,
) -> None:
    """Assert that controlled retired content is absent from its real channel."""
    assert row["legacyOversightUserCount"] == 0, f"provider-visible oversight package sentinel leaked: {row}"
    assert row["controlledSentinelCustomCount"] == 0, f"provider custom sentinel unexpectedly survived conversion: {row}"
    assert row["roleKernelUserCount"] == 0, f"neutral role kernel leaked into provider user text: {row}"
    assert row["roleKernelCustomCount"] == 0, f"neutral role kernel leaked into provider custom text: {row}"
    if role_kernel_system_count is not None:
        assert row["roleKernelSystemCount"] == role_kernel_system_count, row
    assert row["conversationGuideSystemCount"] == 0, f"Conversation guide leaked into provider system prompt: {row}"
    assert row["conversationGuideUserCount"] == 0, f"Conversation guide leaked into provider user text: {row}"
    assert row["conversationGuideCustomCount"] == 0, f"Conversation guide leaked into provider custom text: {row}"
    assert row["boundedIdentitySystemCount"] == 0, f"private bounded identity leaked into provider system prompt: {row}"
    assert row["boundedIdentityUserCount"] == 0, f"private bounded identity leaked into provider user text: {row}"
    assert row["boundedIdentityCustomCount"] == 0, f"private bounded identity leaked into provider custom text: {row}"
    for field in (
        "retiredWorkControlSystemSentinelCount",
        "retiredWorkControlSystemStartCount",
        "retiredWorkControlSystemEndCount",
        "retiredWorkControlSystemControlCount",
    ):
        assert row[field] == 0, f"provider system prompt contains retired work-control overlay ({field}): {row}"
    if ordinary_count is not None:
        assert row["ordinaryUserCount"] == ordinary_count, row
    if quoted_work_control_user_count is not None:
        assert row["retiredWorkControlQuotedUserCount"] == quoted_work_control_user_count, row
