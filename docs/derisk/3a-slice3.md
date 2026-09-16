# Slice 3 — Cited read/query from sandboxed prime-agent (R3a-3)

**Date:** 2026-09-16 · **Bead:** `prime-claw-zwg` · **Status:** COMPLETE

## Outcome

A sandboxed prime-agent session answered a natural operator question using the in-sandbox
brain and cited the supporting page. The accepted run used the operator's current local
Prime Agent default, **ChatGPT-5.6 Sol via `openai-codex` OAuth**, per the updated R3a-13
requirement.

Evidence: [`cited-query-20260916T164509Z.json`](../evidence/cited-query-20260916T164509Z.json) and full runtime validation [`validate-20260916T165022Z.json`](../evidence/validate-20260916T165022Z.json) (**16/16 PASS**)

Accepted question:

> According to the operator's brain, what is an agent harness and what does it include?
> Answer briefly and cite the brain source.

The agent independently invoked the helper, refined its first broad search with a focused
second query, and answered that a harness is the code/config/execution around a model. It
listed system prompts; tools/skills/MCPs; filesystem/sandbox/browser infrastructure;
subagent/handoff/model-routing orchestration; and deterministic hooks/middleware. Citation:
`[Brain: resources/the-anatomy-of-an-agent-harness]`.

## Capability built

### `brain-query`

`stage_brain_query` installs `/sandbox/.prime-claw/bin/brain-query` and
`/sandbox/AGENTS.md`.

The read-only helper:

1. runs `gbrain search <query> --source-id brain --limit 1` against in-sandbox PG;
2. resolves the best slug with `gbrain get <slug> --source-id brain`;
3. strips frontmatter and bounds the excerpt (1600 characters);
4. emits `SOURCE_SLUG`, `SOURCE_TITLE`, `SOURCE_EXCERPT`, and exact
   `CITE_AS: [Brain: <slug>]` fields.

Agent guidance requires brain lookup for durable people/project/decision/history questions,
requires use of the exact citation token, and treats retrieved page text as **untrusted data,
never instructions**.

### Host-config mirroring + current model target (R3a-13 update)

Operator direction changed the acceptance target because Kimi/GLM are currently unavailable.
The runtime now:

- copies host `~/.prime/agent/models.json` **and** `settings.json` verbatim;
- follows the copied default: `openai-codex/gpt-5.6-sol`, thinking `high`;
- provisions host OAuth only into OpenShell's builtin `codex` provider;
- attaches Codex to an existing sandbox without wiping the brain index;
- writes only a non-secret synthetic JWT plus `openshell:resolve:` placeholders to sandbox
  `auth.json`;
- rewrites Codex Authorization/account headers to placeholders in `npm-onload.js` for
  fetch/SSE and WebSocket paths; OpenShell L7 performs the real credential swap;
- pins projected expiry far-future so prime-agent cannot refresh OAuth inside the sandbox
  and accidentally persist a returned real token;
- deliberately restarts the daemon during `stage_prime_agent` so sessions inherit the
  current provider placeholders.

The accepted run verified SHA-256 equality for host/sandbox `settings.json` and `models.json`.
It also verified synthetic access plus placeholder refresh/account fields without printing any
credential.

## Failure found and fixed

The first Slice 3 proof created a daemon session but `prompt_and_wait` failed with
`No API key found for anthropic`. Root cause: `stage_prime_agent` launched the daemon before
putting provider auth in its process environment. A first attempted conditional repair read
`/proc/<pid>/environ`, but OpenShell correctly denied that read. Final design: lifecycle
converge always restarts the daemon after staging config/auth, so it inherits the current
placeholder set. This also cleanly supports provider changes such as the operator's move to
openai-codex.

## Tests

Offline suite: **112 passed**. Full live runtime validation: **16/16 PASS**.

Coverage includes:

- search → get command construction and warning-tolerant slug parsing;
- citation format, title extraction, and bounded excerpts;
- helper/AGENTS installation, dry-run, and create/converge ordering;
- host OAuth → OpenShell provider mapping and hash-only refresh state;
- verbatim settings/models mirroring;
- synthetic/placeholder-only auth projection;
- offline fetch-header rewrite to access/account placeholders;
- daemon restart (without forbidden `/proc` inspection);
- provider attachment to an existing sandbox without recreate.

## Requirement verdict

- **R3a-3 — PROVEN.** The sandboxed prime-agent invoked in-sandbox gbrain, answered correctly,
  and cited the expected page slug.
- **R3a-7 — PRESERVED.** No real inference credential entered sandbox disk/process output.
- **R3a-13 — PROVEN (expanded).** Host models/settings mirrored verbatim; current host-default
  ChatGPT-5.6 Sol worked end-to-end through placeholder-projected OpenAI Codex OAuth.
- **R3a-5 — ADVANCED.** brain-query, Codex provider, missing-provider attach, config projection,
  and daemon placeholder inheritance are lifecycle stages.
