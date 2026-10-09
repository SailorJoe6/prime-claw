---
name: goals-and-heartbeats
description: use this skill for substantive multi-step work and whenever active work transfers to a wait, without creating goals for quick responses
---
Use a goal when the requested work is substantial enough to require continued active work across many steps or turns.  Do not create a goal for a direct answer, a simple question, or a short task that can be completed with only a few tool calls before responding.

While substantive work remains and you can act on it now, maintain one compatible goal to keep the work moving.  Do not use goal budgets.  You are authorized to use as many tokens as required to complete the work.  However, if at any time you need to wait on a long-running process, one or more subagents or sibling agents, a response from the user, or anything else that transfers the next useful action away from you, you MUST complete the active-work goal.  Completing that goal ends the current active-work epoch; it does not claim that the broader requested outcome is finished.

Once you reach a waiting state, unless you are waiting for the user, set up a heartbeat to monitor the exact process you are waiting on.  The heartbeat should prompt you to verify status and ensure the work keeps moving.  It should also prompt you to create a fresh goal only when the wait ends and substantive agent work remains.  When the wait is done and active work resumes, cancel the heartbeat.

If you are waiting for the user, you can do nothing else but wait.  Complete any active-work goal, create no heartbeat, report the exact blocker and resumable checkpoint once, and stop.

When the requested work is complete, retain neither a goal nor a heartbeat.
