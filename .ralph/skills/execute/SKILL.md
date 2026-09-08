---
name: execute
description: Use for Ralph's execution phase in beads-tracked projects to implement the current spec and plan while keeping beads, docs, and tests current.
---

run the /prepare skill if it is not fresh in your context window.  Important: If you have had a recent context compaction, then nothing is fresh!

Next, study [the plan](.ralph/plans/EXECUTION_PLAN.md), if one exists.  The plan describes the implementation steps for the current [spec doc](.ralph/plans/SPECIFICATION.md).  Study both of these files, if they exist.   This will get you up to speed on where we are, what we are working on and what's left to do.  If the files are not found in that location, then the user should have given you other instructions on what to work on. If you have not been given any instructions, then ask the user for instructions on what to work on.  In either case, these instructions are "the plan" for the purposes of this conversation. 

There may be some tickets in beads related to the plan, and you may need to create beads tickets as you implement the plan.  There may be some tickets that are not related to the plan.  Focus on the plan and plan related tickets.

Some of the work may have been completed in previous sessions.  Audit the code against the spec and the plan to determine what work is left.

If you find a related ticket that is not closed in beads, but you find the work for the ticket is all the way done, you should check to ensure proper documentation and tests exist for the finished work, and if everything is perfect you should close that ticket and ensure the plan represents the finished work.

If there is no work left to do on this plan, then check if the spec has been completely converted to a document (or set of documents) in the `docs/` folder describing the new state of this project.  If that hasn't been done, then doing so is your next task.

If the plan is truly finished, all changes are documented and there is nothing left to do on this plan, move both the `.ralph/plans/SPECIFICATION.md` and the `.ralph/plans/EXECUTION_PLAN.md` files to a subfolder within the `.ralph/plans/archive/` folder, and update `.ralph/plans/archive/README.md`.  Update any beads issues related to the plan, and since there is no work left to do all related beads issues should be closed.  Once that's done, mark any active goal as completed, stop any active heartbeats, and report the results of the work. 

Assuming there still is work left to do to implement this spec, your task is to do the most important thing to move this project forward.  Pick the one most important next task to do and do that.  Important!  DO NOT PICK A TASK TOO LARGE!  You should be able to complete your task in the scope of your current context window, including tests and documentation!  So, keep your task constrained.  You may use as many subagents as you like in any way you see fit.  If the next task involves invoking any long running process, such as a software build, container pull, container build, container startup that takes a long time, then get to the point of starting that long-running process, mark your goal as complete and set up a heartbeat to monitor the process.  Even if there is still work to do on that plan, you MUST mark you goal as completed.  You do NOT want to have non-stop goal continuation reminders dirtying up your context!  To that end, if you find yourself waiting on ANY long-running task, you MUST mark your goal as completed and set a heartbeat to monitor the process.  Your heartbeat prompt should also remind you to reinstate your goal after the long-running process is done, unless that actually completes your goal.  

General execution standards (apply to any work you do):
- Evidence-backed decisions: any claim of correctness, completion, causality, etc. must cite an artifact (test output, log, benchmark, user research, code diff, design doc).
- Hypothesis hygiene: check the plan for previously rejected approaches to avoid re-attempting.
- Single primary objective per session: do one primary task, record results, stop.
- Reproducibility: record inputs/commands/flags/config needed to reproduce results.
- Highest-leverage next action: choose the next step by expected impact or information gain.

If you find yourself blocked, make a sincere but bounded attempt to unblock yourself using safe, in-scope actions. Routine implementation, deployment, recovery, rollback, and other external-state changes are not blockers when they are already within the active specification and plan, covered by the recorded safeguards, and authorized by the owner; proceed without requesting redundant permission.

Treat missing authority, credentials the agent cannot obtain, required physical interaction, unavailable hardware, or required external coordination as immediate blockers. Ask the owner before materially changing the approved scope, candidate, migration, rollback, safety, or acceptance contract. Do not block merely because an authorized in-plan action mutates external state or carries risk already addressed by the plan. Re-running checks, refreshing timestamps, rewriting handoff context, updating beads with unchanged status, or committing status-only churn does not count as progress or as an unblock attempt.

If the bounded attempt does not clear the blocker or produce new actionable evidence, update [the plan](.ralph/plans/EXECUTION_PLAN.md) with the exact blocker and unblock condition. Then, you MUST do the following 3 things:  **THIS STEP IS CRITICAL**! You MUST do these things if you are blocked: 
1) Move BOTH the plan and the spec to the `.ralph/plans/blocked/` folder.  Mark the related beads issues blocked
2) Mark your goal as complete, even if the plan has more work to do.  You do NOT want non-stop goal continuation reminders while blocked.  I will see that you are blocked.  I will unblock you, and I will prompt you for a new goal after the blocker is cleared.  So, if you become blocked, mark your goal as complete, and stop.  
3) Pause any active heartbeat.  A heartbeat prompting you to do more work when you are blocked also creates churn in your context window.  Stop any active hartbeat when you are blocked.  


**CRITICAL** Remember to keep the planning docs and beads up to date as you work on the task.

Remember to maintain good documentation quality.  All new features and changes to functionality need to be well documented, in the `docs/` directory.  Follow the existing documentation structure.

Remember to maintain high test coverage.  All new features will need tests.  Bug fixes need tests as well.

That is your workflow. Do all these things for the one task you choose.  Only complete these things for one task, then report back on the status and await further instructions.  
