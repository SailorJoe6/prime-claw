# Choose where implementation happens

Use ordinary language with the exact task ID. “Implement TASK-ID here” (or “on
main”) means direct work in that verified checkout. “Implement TASK-ID in an
Episode” means isolated readiness review and, if ready, a dedicated worktree and
Episode. Prime Claw does not silently switch the target.

If you do not name a placement, a task with the right native planning status
and a meaningful plan normally goes to an Episode. An obvious small unplanned
fix normally stays in the current checkout, even if the ticket is `In Design`.
Substantial work still in design or conflicting evidence calls for one focused
question before planning or implementation. These are judgment calls, not a
size or status classifier.

“Plan TASK-ID, then implement it here when ready” preserves direct placement
through planning. A request to plan only does not start implementation.

For direct tracked work, Prime Claw checks the exact ticket and stops if an
active Episode already owns it. It publishes the native `In Progress` status
before editing implementation files. After required checks pass and the code
is committed and pushed (committed locally if there is no remote), it publishes
`Done` unless you explicitly asked for a review hold. No Episode or formal plan
is required. This does not authorize a separate merge, deployment, or activation.

For an Episode, the Conversation still manages readiness, lifecycle status,
and review. The Episode implements within its bound authority, and Experts
remain read-only.
