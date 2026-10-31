---
name: implement-spec
description: Start an implementation-readiness review and isolated Episode for one approved retained future-plan folder through the agent-callable implement_spec tool.
---
# Implement a retained specification

Use `implement_spec(location, host?)` for an already-retained
`.ralph/plans/future/<slug>` bundle. The operator can request this
conversationally; no custom slash command is a prerequisite. This global entry
skill routes to the project's customizable
`.prime-claw/workflows/implement-prep.md` and `implement-spec.md` policies.
Do not copy their detailed procedures here or implement in the Conversation.
Read `/skill:goals-and-heartbeats` unless it is already in context.

## Bind scope and authority

Interpret the operator's actual instruction before advancing. An explicit
conditional instruction such as “plan this specification, then implement it
when ready” may authorize that sequence within approved scope. Preserve that
authority through planning, preparation, and compaction; do not demand a fresh
approval solely because planning finished. A planning-only request does not
authorize implementation. Clarify material ambiguity, missing authority, or new
scope. Neither a prior tool/command invocation nor a stored or turn-scoped
receipt is approval authority.

Bind the exact operator-selected project-relative future-folder `location`.
Do not search for, select, invent, or substitute another folder. Ask if the
location is missing or materially ambiguous. This route is only for retained
version-1 bundles in the frozen grandfathered inventory, not new folder
authoring or task-native implementation. The specification remains frozen and
the execution plan remains living. An exact already-active version-1 replay
may use its persisted source location even when the obsolete future folder is
absent; it returns the same resources and sends no new execute assignment.

## Admit once, then stop

Call `implement_spec` with that exact `location`. Supply optional `host` only
as an exact stable `id:<project-host-setup-id>`, never a display name or resource
identity. Otherwise let native placement selection choose the sole ready local
setup or present its picker. An explicit host cannot silently fall back to
another setup or local execution. Carry any selected stable host unchanged into
the final create call as factual operation data, not approval proof.

The tool queues preparation and one canonical readiness follow-up. Admission is
not proof of compaction, readiness, or Episode creation. On successful admission,
end the turn so those queued workflows can run. On failure or uncertainty,
report the actual result; do not automatically retry, create another Episode,
or send an initial handoff or second execute assignment. Native retained-bundle
integrity, ownership, replay, placement, and resource checks remain in force
without requiring proof of a particular earlier invocation sequence.

Custom slash commands are not workflow prerequisites. Retained version-1
workflows, ownership, plans, and resources remain supported. This skill grants
no merge, abandonment, deployment, restart, or destructive cleanup authority.
