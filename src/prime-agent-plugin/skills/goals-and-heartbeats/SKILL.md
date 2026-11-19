---
name: goals-and-heartbeats
description: use this skill any time you are working toward any goal to ensure you use goals and heartbeats to keep your work moving forward without allowing either to clog up your context window
---
As long as there is more work you can do, set up a goal to keep your work moving forward.  Do not use goal budgets.  You are authorized to use as many tokens as required to complete your work.   However, if at any time you need to wait on any long running process, one or more subagents, sibling agents, a response from the user, or anything else that puts you in a waiting state, you MUST stop your goal by marking it as complete.  Even if there is work left to do, you do NOT want non-stop goal-continuation messages clogging up your context, so in the event you find yourself waiting for anything, mark your goal as complete.  This is not contradictory to other rules, if you give yourself a goal that includes stopping the next time you need to wait.

Once you reach a waiting state, unless you are waiting for the User, set up a heartbeat to monitor the process you are waiting on.  Your heartbeat should prompt you to verify the status of the long running process and ensure things keep moving along.  The heartbeat should also prompt you to set a new goal for yourself to continue your work once the wait is over.  When the wait is done, and you set your new goal, cancel the heartbeat.

If you are waiting for the user, you can do nothing else but wait.  There should be no heartbeat and no goal in that case.

Keep goals quiet and bounded to the admitted phase, not the whole eventual
project. Complete the phase goal when its required report is delivered, its
canonical continuation is admitted, or it reaches a wait boundary. Do not keep
it active merely because another queued phase or owner-supervised pass may do
more work. A canonical queued follow-up owns its own next phase; never dispatch
or reconstruct it from a goal continuation. Do not create a heartbeat just to
wait for or acknowledge that queued phase.

Goal and post-compaction reminders are advisory background guidance, not a new
assignment or acknowledgement request. Apply them to the current admitted work
without a separate user-facing acknowledgement, status-only turn or replay.
They do not authorize another slice, handoff, compaction or execute pass. If the
phase already ended or is waiting, leave its goal complete and end quietly;
resume only under the existing assignment or authorized monitoring workflow.
