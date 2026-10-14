---
id: PRIMECLAW-9
title: >-
  Port ensure-vpn check to prime-claw/prime-agent (daily VPN re-login breaks
  gateway RBAC)
status: In Design
assignee: []
created_date: '2026-10-12 01:00'
updated_date: '2026-10-14 14:45'
labels:
  - devex
  - phase3
  - vpn
dependencies: []
references:
  - PRIMECLAW-7
priority: p2
type: task
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The corporate VPN (GlobalProtect, via `zetup vpn`) drops roughly once per day by design — Zendesk security policy requires re-login at least daily. When it's down, all sandbox egress through ai-gateway.zende.sk fails with `403 RBAC: access denied` (source-network RBAC: the gateway accepts the key but denies the source network). This breaks prime-claw's credentialed paths mid-flight: in-sandbox gbrain embed/search (Slice 2 hit this: 2720-chunk bulk embed succeeded, then every call 403'd for the rest of the session), prime-agent inference, and brain clone/push.

There is already a working solution in the Claude ecosystem: the `ensure-vpn` hook (ai-agent-hub plugin, v1.0.0, owner jtjahjadi@zendesk.com), currently at ~/.claude/plugins/cache/ai-agent-hub/ensure-vpn/1.0.0/ensure-vpn.sh. It runs on UserPromptSubmit: checks a 120s cache (~/.claude/ensure-vpn.cache), then `zetup vpn status`; if `not-connected`, runs `zetup vpn connect --wait` (polls up to 120s; user approves an Okta push — requires user intervention and Accessibility permission for AppleScript clicking the GlobalProtect menu bar), then does a 3x stability check before allowing the prompt. Blocks (exit 2) with a clear message if it can't connect.

Task: port this to prime-agent / prime-claw so the same check runs at the start of agent turns (or before credentialed stages like stage_provider/stage_github_provider/stage_brain_index run).

## Legacy design

Porting notes:
- The Claude version is a UserPromptSubmit HOOK registered in ~/.claude/settings.json. Prime Agent has no identical hook surface; options: (a) a prime-agent session-start/turn hook if one exists, (b) a cheap `ensure-vpn` step invoked at the top of prime-claw's credentialed stages (stage_provider, stage_github_provider, stage_brain_index sync/embed) and/or `bin/prime-claw create|converge|validate`, (c) an ralph-pva skill that any session runs before gateway-dependent work.
- Keep the shell logic as-is where possible: cache TTL 120s, `zetup vpn status` -> {rfa-vpn, non-rfa-vpn, not-connected}, `zetup vpn connect --wait`, 3x2s stability poll, clear block message. The script already skips gracefully when zetup is absent.
- The Okta push requires user intervention — the check must surface a clear 'approve the push' prompt and a bounded wait, not hang silently.
- Also record the failure signature in the runbook (some of it exists): `403 RBAC: access denied` from istio-envoy with a valid key == VPN down. Recovery: connect VPN, no provider/sandbox changes needed (placeholders are unaffected).
- Open question: should this live in prime-claw (repo-specific) or as a shared ralph-pva/prime-agent skill (used by collect-slack, gbrain, etc. too)? Leaning: shared skill + a prime-claw pre-stage invocation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When VPN is down, any prime-claw credentialed operation (or a designated turn-start check) auto-triggers `zetup vpn connect --wait` and waits for the user to approve the Okta push, then proceeds once connected and stable.
- [ ] #2 When VPN is up, the check is sub-second (cached) and silent.
- [ ] #3 When VPN can't connect, the operation stops with a clear actionable message instead of a confusing 403 mid-stage.
- [ ] #4 The runbook documents the RBAC-403 == VPN-down signature and recovery.
<!-- AC:END -->
