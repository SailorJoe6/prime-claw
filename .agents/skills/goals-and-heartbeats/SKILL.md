---
name: goals-and-heartbeats
description: use this skill any time you are working toward any goal to ensure you use goals and heartbeats to keep your work moving forward without allowing either to clog up your context window
---
As long as there is more work you can do, set up a goal to keep your work moving forward.  However, if at any
time you need to wait on any long running process, one or more subagents, sibling agents, a response from the user, or anything else that puts you in a waiting state, you MUST stop your goal by marking it as complete.  Even if there is work left to do, you do NOT want non-stop goal-continuation messages clogging up your context, so in the event you find yourself waiting for anything, mark your goal as complete.  This is not contradictory to other rules, if you give yourself a goal that includes stopping the next time you need to wait.

Once you reach a waiting state, unless you are waiting for the User, set up a heartbeat to monitor the process you are waiting on.  Your heartbeat should prompt you to verify the status of the long running process and ensure things keep moving along.  The heartbeat should also prompt you to set a new goal for yourself to continue your work once the wait is over.  When the wait is done, and you set your new goal, cancel the heartbeat.

 If you are waiting for the user, you can do nothing else but wait.  There should be no heartbeat and no goal in that case.
