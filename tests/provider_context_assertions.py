"""Shared provider-visible context assertions for native Prime Agent probes.

Prime Agent converts extension custom messages before ``streamSimple``. The
provider therefore cannot rely on ``customType`` metadata: leaked custom text is
visible as a user message. Unique fixture sentinels make that seam observable
without matching ordinary discussion of production identifiers.
"""

import json

LEGACY_PACKAGE_SENTINEL = "PRIME_CLAW_TEST_LEGACY_PACKAGE_7D17AF7354A14C65"
RETIRED_WORK_CONTROL_SENTINEL = "PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1"
RETIRED_WORK_CONTROL_CONTROL = "PRIME_CLAW_TEST_RETIRED_WORK_CONTROL_91B3DF1D12C44C5A"
ORDINARY_USER_SENTINEL = "PRIME_CLAW_TEST_ORDINARY_USER_2F625A178B6B4FD0"


def provider_capture_expression(context_var: str = "context") -> str:
    """Return a TypeScript expression that inspects provider-visible user text."""
    package = json.dumps(LEGACY_PACKAGE_SENTINEL)
    retired_control = json.dumps(RETIRED_WORK_CONTROL_CONTROL)
    ordinary = json.dumps(ORDINARY_USER_SENTINEL)
    return f'''(()=>{{const providerMessages={context_var}.messages??[],text=value=>typeof value==="string"?value:Array.isArray(value)?value.map(part=>typeof part==="string"?part:part?.type==="text"?part.text??"":"").join(""):"",userText=providerMessages.filter(message=>message?.role==="user").map(message=>text(message.content)).join("\\n"),count=token=>userText.split(token).length-1,customText=providerMessages.filter(message=>message?.role==="custom").map(message=>JSON.stringify(message)).join("\\n");return{{legacyOversightUserCount:count({package}),retiredWorkControlUserCount:count({retired_control}),ordinaryUserCount:count({ordinary}),controlledSentinelCustomCount:[{package},{retired_control}].reduce((total,token)=>total+customText.split(token).length-1,0)}}}})()'''


def assert_provider_context_clean(row: dict, *, ordinary_count: int | None = None) -> None:
    """Assert that controlled retired content is absent at the provider seam."""
    assert row["legacyOversightUserCount"] == 0, f"provider-visible oversight package sentinel leaked: {row}"
    assert row["retiredWorkControlUserCount"] == 0, f"provider-visible retired work-control sentinel leaked: {row}"
    assert row["controlledSentinelCustomCount"] == 0, f"provider custom sentinel unexpectedly survived conversion: {row}"
    if ordinary_count is not None:
        assert row["ordinaryUserCount"] == ordinary_count, row
