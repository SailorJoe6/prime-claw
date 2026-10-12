---
name: blocked
description: Use when Ralph detects blocked planning docs and needs help explaining the blocker and getting the project unblocked.
---

First, run through the "prepare" skill.

Then use `/skill:backlog` to load the project task-tracking workflow.

Read the files in `.ralph/plans/blocked`.  Explain to the user why the Agent marked the project as blocked.  Work with the user to get the project unblocked.  If the user successfully unblocks the project for you, then move both .ralph/plans/blocked/EXECUTION_PLAN.md and .ralph/plans/blocked/SPECIFICATION.md out of .ralph/plans/blocked and back to .ralph/plans/.
