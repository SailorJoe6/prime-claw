# Agent Instructions

This project uses **Backlog.md** for issue tracking. Use the repository-built
`deps/backlog/dist/backlog` candidate until the accepted host artifact is activated.

## Quick Reference

```bash
backlog task list --status "In Design" --status "In Planning" --ready --plain
backlog task view --json -- <id>
backlog task create "Short title" --status "In Design" --description "Outcome and context" --type task --priority P2 --plain
```

Use `/skill:design` or `/skill:spec-it-out` for specification authoring. Ask the
agent to plan or implement work. The `plan` skill calls `plan_task`; the
`implement-task` skill respects explicit direct or Episode placement and uses
judgment only when placement is unspecified. Planning alone does not authorize
implementation. An authorized plan-then-implement request retains its placement.
Bounded delegated selection must bind an exact canonical task. Episode readiness
requires `In Planning` and a meaningful plan, not `--ready` alone. For an owned
Episode, the owning Conversation controls lifecycle status. Direct tracked work
uses its own native `In Progress` and `Done` procedure in the entry skill. Native `/skill:` invocation and
Prime Agent built-ins remain available; custom workflow commands are removed.

## What this repo is

Product requirements live in [REQUIREMENTS.md](REQUIREMENTS.md). Read it before
substantive design or implementation. It is the single maintained requirements
source; task plans, existing code/tests, and historical evidence do not create
additional product requirements. Its first consolidation awaits operator review.

This is the **builder repo** for prime-claw. Read [VISION.md](VISION.md) and
[LONG_RANGE_PLAN.md](LONG_RANGE_PLAN.md) before substantive work. The reasoning
behind the design (and the origin session id) is in
[docs/founding-decisions.md](docs/founding-decisions.md). Build order is manual-first:
phase skills → episode mechanics → conversation/episode boundary →
upgrade command → orchestrator LAST.

## Prime Agent is an upstream dependency — never a development target

This repository develops the **prime-claw plugin** and the sandboxed Docker
runtime that installs Prime Agent plus that plugin. It does **not** develop,
patch, fork, or maintain the Prime Agent codebase.

For prime-claw work:

- Never propose or make changes in a Prime Agent source checkout as the solution.
- Never propose an unsolicited Prime Agent pull request. Prime Agent does not
  accept unsolicited PRs.
- Do not treat a local Prime Agent checkout or worktree as an implementation
  surface. It may be read only to understand documented/runtime behavior.
- Solve compatibility problems within prime-claw's plugin, container, scripts,
  configuration, or supported public Prime Agent interfaces.
- If the public interface cannot support a correct solution, report that product
  constraint to the operator. Do not convert it into a Prime Agent patch plan.

## Prime Agent plugin source and testing

The prime-claw plugin source is inert under `src/prime-agent-plugin/`. Never put
plugin source or a copy under this repository's `.prime/agent/extensions/`
path while the user-global plugin is installed; current Prime Agent versions can
fail startup when the same extension is discovered at both scopes.

**Plugin development and pre-merge validation are Docker-only.** After every
plugin-source change, run tier 1 (`scripts/test-tier1.sh --probe`,
`python3 -m pytest tests/ -q -m container`, or `scripts/test-all.sh`). Never run
host/user-global apply, check, or Prime Agent plugin probes for a candidate.
The Docker driver and fixture pass an explicit container-local
`PRIME_AGENT_PLUGIN_ROOT`; an explicitly isolated scratch root is also valid for
script-only diagnostics.

Bare apply/check fail closed. A deliberate post-acceptance user-global refresh
must run from the primary `main` checkout and spell out `--user-global`:

```bash
scripts/apply-prime-agent-plugin.sh --user-global
scripts/check-prime-agent-plugin.sh --user-global
```

`--user-global` is refused from linked worktrees. A loaded process can retain old
extension code while rereading project files. After an approved global refresh,
let affected work quiesce and perform one coordinated full Prime Agent restart.
Keep every resource that the loaded generation may read until resumed owner,
episode, and designated ordinary-session UAT prove the new generation is active.
`/reload`, elapsed time, copy success, and a fresh probe alone are not cutover
proof.

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

## Provider selection for every new agent or session

Every new subagent, reviewer, sibling Episode, sibling session, or other new
session must use the launching session's current **LLM provider** (the
model/authentication route), unless the operator explicitly directs a provider
change. Change only the model, never the provider as a side effect. Determine
the actual parent provider from native session facts; choose models only within
that provider or use supported inheritance. Missing model discovery, an
unavailable model, or a quota error does not authorize a provider fallback.
If the launch surface cannot preserve the provider, report that constraint
instead of silently switching providers. This is separate from task providers
such as Backlog and Beads.

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

## Native Prime Agent probe isolation

Native Prime Agent probes and tests that can mutate configuration must run through
`scripts/run-prime-agent-probe.sh`. `--session-dir` isolates session artifacts only;
it does not isolate `settings.json`. The wrapper gives each probe temporary
`PRIME_AGENT_CODING_AGENT_DIR` and `PRIME_AGENT_SESSION_DIR` roots and removes them
on exit. Do not send configuration-mutating RPC requests such as
`set_auto_compaction` from an unguarded Prime Agent process.

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
git push
git status   # MUST show up to date with origin
```

Until the remote exists, ensure all work is committed locally.
