---
name: implement-task
description: Start an implementation-readiness review and isolated Episode for one approved provider-native task through the agent-callable implement_task tool.
---
# Implement an approved task

Use `implement_task(taskId, host?)` for task-native implementation. The operator
can request this conversationally; no custom slash command is a prerequisite.
This global entry skill routes to the project's customizable
`.prime-claw/workflows/implement-task-prep.md` and `implement-task.md` policies.
Do not copy their detailed procedures here or implement in the Conversation.
Read `/skill:goals-and-heartbeats` unless it is already in context.

## Bind scope and authority

Interpret the operator's actual instruction before advancing. An explicit
conditional instruction such as “plan this task, then implement it when ready”
may authorize that sequence within the approved scope. Preserve that authority
through planning, preparation, and compaction; do not demand a fresh approval
solely because planning finished. A planning-only request does not authorize
implementation. Clarify material ambiguity, missing authority, or new scope.
Neither a prior tool/command invocation nor a stored or turn-scoped receipt is
approval authority.

Bind one exact canonical task ID before calling the tool. If the operator
selected a task, do not substitute another. If the operator explicitly delegated
selection, stay within those stated bounds and inspect the selected provider's
native tasks. Select implementation work only from `In Planning` (Beads native
`in_planning`) after design and planning, not from dependency readiness alone or
the highest-priority open task. Selection does not skip either phase. Verify a
meaningful native Implementation Plan or Beads `design`; the project workflow
still performs the full semantic readiness review. Apply the same rule to an
operator-selected task. If the native status is not `In Planning`/`in_planning`,
is unmapped, or the plan/design is missing or placeholder-only, explain the
current native facts and stop without mutation or admission. Do not rely on code
to refuse an ineligible task. Status, dependency readiness, and successful queue
admission alone establish neither authority nor implementation readiness. If the
task or delegated bounds are materially unclear, ask instead of guessing.

## Selected-ticket durability before creation

Ensure the exact selected ticket's coherent specification and plan are committed
and, when a remote exists, published before an Episode needs to obtain them.
This is your responsibility under this editable workflow, not a frozen-revision
approval or a code-level whole-checkout cleanliness check. Inspect current task
and history facts first. If needed, commit and publish only the authorized ticket
update through Backlog's exact-task Git history or Beads' supported native task
history. Commit each coherent update as soon as it is ready and publish promptly;
do not defer it until handoff or session end. Preserve unrelated bytes, staging,
fields and history. An unrelated published descendant is not a conflict by
itself. Use semantic judgment for actual same-task changes and report native
publication conflicts or uncertainty without force, automatic retry or another
allocation. Confirm that the Episode can obtain the selected committed ticket
from its provider workspace; do not synchronize another owner's dirty checkout
as a hidden prerequisite.

## Admit once, then stop

Call `implement_task` with the exact canonical `taskId`. Supply optional `host`
only as an exact stable `id:<project-host-setup-id>`, never a display name or
resource identity. Otherwise let native placement selection choose the sole
ready local setup or present its picker. An explicit host cannot silently fall
back to another setup or local execution.

The tool queues preparation and one canonical readiness follow-up. Admission is
not proof of compaction, readiness, or Episode creation. On successful admission,
end the turn so those queued workflows can run. On failure or uncertainty,
report the actual result and inspect current delivery, ownership, provider, and
resource facts; do not automatically retry, create another Episode, or send an
initial handoff or second execute assignment. Carry the exact selected host
unchanged through readiness and final creation. The workflows own lifecycle
eligibility and readiness decisions; native operations and resource checks do
not replace them or require proof of a particular earlier invocation sequence.

Custom slash commands are not workflow prerequisites. Retained version-1
workflows, ownership, plans, and resources remain supported. This skill grants
no merge, abandonment, deployment, restart, or destructive cleanup authority.
