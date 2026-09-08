# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd sync               # Sync with git
```

## What this repo is

This is the **builder repo** for prime-claw. Read [VISION.md](VISION.md) and
[LONG_RANGE_PLAN.md](LONG_RANGE_PLAN.md) before substantive work. Build order is manual-first:
phase skills → episode mechanics → conversation/episode boundary →
upgrade command → orchestrator LAST.

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** to avoid hanging on prompts:

```bash
cp -f source dest
mv -f source dest
rm -f file
rm -rf directory
scp/ssh -o BatchMode=yes
apt-get -y
HOMEBREW_NO_AUTO_UPDATE=1 brew ...
```

## Prime Agent RLM Delegation — Safe Spawn Protocol

Prime Agent releases can lose the initial RLM task when a `session_start`
extension starts a child turn first (the automatic-preparation admission
race). For **every** `rlm()` spawn:

- **Do not** put substantive work in the initial `rlm()` prompt.
- Spawn with a harmless bootstrap, then send the real task exactly once
  through `agent_message.send`.
- A returned RLM handle proves child publication, not task admission. Do
  not resend a delivered task merely because a disposable bootstrap later
  reports `rlm_child_failure`.

See the global `rlm-automatic-preparation-startup-race` prompt note and
openclaw-setup `docs/prime-agent-rlm-preparation-race.md` for the full
diagnosis.

## Sandbox lifecycle safety

Sandbox rebuild/recovery/policy work follows an apply/check/validate
discipline (inherited from openclaw-setup):

- `scripts/apply-*.sh` mutate; `scripts/check-*.sh` gate readiness;
  `scripts/validate-*.py` prove acceptance; `tests/test_*.py` cover them.
- Recovery scripts are non-destructive by default. Do not replace them with
  ad hoc delete/recreate/force-rebuild unless an active plan explicitly
  calls for that higher-risk action.
- Missing provider credentials or OAuth/login state are manual operator
  actions. Do not print, copy, or store credential material.

## Credential isolation

Never access macOS Keychain or browser credential stores to obtain cookies,
keys, or tokens. The OpenShell sandbox is the security boundary; credentials
are injected at L7 and never touch sandbox disk. Preserve that boundary.

## Landing the plane (session completion)

Work is NOT complete until committed AND pushed (once a remote exists):

```bash
git pull --rebase
bd sync
git push
git status   # MUST show up to date with origin
```

Until the remote exists, ensure all work is committed locally.
