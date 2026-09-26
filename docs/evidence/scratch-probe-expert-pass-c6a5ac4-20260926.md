# Fresh EXPERT PASS: retained probe socket-path containment, `c6a5ac4`

- **Reviewer:** `scratch-probe-expert-c6a5ac4`; child `sub-1b3f0beb`; exact session `01a0df27-13b7-748c-ae6f-7b8af0e78d67`.
- **Validated profile:** `.prime/agent/profiles/expert-reviewer.md`, line-exact bounded frontmatter and nonempty body; exact resolved/returned model `openai-codex/gpt-6-astra`; admitted `thinking: max`.
- **One delivered packet:** `agentmsg_624dca9d-a9dc-4dd2-a612-7fe3ae3dba60`; no resend. The report reached the exact owner directly.
- **Exact subject:** pushed `c6a5ac4b6df7252731ad52697d305f5e71421d3c` against `3b3038149cab183a9db259706577734a3339fb4d` on `fix/episode-id-authority`, clean and tracking `origin` at the reviewed SHA.
- **Disposition:** complete **PASS** for wrapper containment only. Owner accepts this bounded evidence, not a scratch launch or EPISODE completion.

## Reviewer report (verbatim)

PASS — exact pushed commit c6a5ac4b6df7252731ad52697d305f5e71421d3c, against 3b3038149cab183a9db259706577734a3339fb4d. No material wrapper finding remains.

Evidence:
- scripts/run-prime-agent-probe.sh:15–39 allocates short /tmp/pcp.XXXXXX roots independently of inherited TMPDIR, resolves the physical path, reports it, and keeps private permissions. :22–27 never removes retained roots.
- :46–59 checks encoded default supervisor and maximum worker pathname bytes before :62–68 admits the child; >103 rejects with exit 65 and preserves the root. Static physical paths on this host are 55/81 bytes, below the 103-byte limit including the reserved NUL.
- Verified the model against clean v0.9.6 source SHA e260085dd8f742e0def3d871860c9a888b114851: daemon-socket.ts:70–75,279–282; daemon-supervisor.ts:692–693,708–713. Both native sockets use the default TMPDIR-based directory; the worker basename includes the two 12-character portions.
- Seven focused non-daemon tests independently PASS (1.464 s): private isolated state/environment; long/multibyte inherited TMPDIR; canonical socket bytes; distinct replays; overflow rejection before child admission; nonzero/command-not-found retention; ordinary cleanup/exit status. sh -n, in-memory Python compile, and exact git diff --check PASS. Subject remains clean at the exact SHA; origin tracking ref matches.
- AGENTS.md:77–90 and docs/evidence/episode-cwd-rebind-fork-hypothesis-20260926.md:65–69 preserve the separate custom --daemon-socket check and shutdown/uncertain-outcome gate.

This PASS covers only wrapper containment. It does not authorize a scratch daemon launch, merge, EPISODE completion, or live recovery. The separately reviewed shutdown/uncertain-outcome driver and direct tool-root test remain required. No daemon/probe, socket, credential-store access, live EPISODE inspection, source edit, or external-resource cleanup was performed; only the permitted Python-only unit tests created and removed their own fixtures.

## Owner reconciliation and next gate

The owner independently confirmed the exact clean pushed candidate, pinned v0.9.6 source SHA, unchanged live EPISODE HEAD `1c1ea3488691c31ca47e4057509a0f8fdbb6ec57`, and the same seven focused non-daemon tests and static shell/Python/diff checks. The original BLOCK on `48b11ec` remains preserved separately; this PASS is for the repaired `c6a5ac4`, not a re-review or reversal of the old commit. The accepted next step stays inside the plugin-only investigation: design and separately review a fail-closed isolated driver for scoped shutdown, uncertain outcomes, residual process/socket/root-reference checks, and an execution-time cwd sentinel. A custom supervisor socket needs its own byte check. Do not start a native daemon or act on the live EPISODE until that gate passes.
