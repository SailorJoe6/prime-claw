import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export const WORK_CONTROL_SENTINEL = "PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1";
export const WORK_CONTROL_START = "<!-- prime-claw:goal-heartbeat-work-control:start -->";
export const WORK_CONTROL_END = "<!-- prime-claw:goal-heartbeat-work-control:end -->";

export const WORK_CONTROL_POLICY = `${WORK_CONTROL_START}
${WORK_CONTROL_SENTINEL}
Goal and heartbeat work control:
- For substantive multi-step work, inspect the persistent goal and create one bounded active-work goal unless a compatible active goal already owns the same authorized outcome. Do not create goals for trivial answers or quick lookups. Do not replace, complete, or reinterpret an incompatible pending goal merely to make room.
- A goal owns useful agent action. A heartbeat owns one exact observable wait. Keep both only during the short handoff that creates and verifies monitoring before completing the compatible active-work goal, or when they own independent work.
- Before yielding to a long-running process, job, deployment, or delegated worker: retain an inspectable identity and output/status location; create one bounded rlm_heartbeat with exact running, success, failure, staleness, cleanup, and resumable-checkpoint conditions; verify its ID; recheck the operation; then complete the compatible epoch goal and end the turn. If it is already terminal, delete and verify removal of the heartbeat and handle the result now.
- A non-terminal heartbeat check reports only meaningful change and creates no goal. It never restarts work. Routine monitors use follow-up delivery. Delete the exact heartbeat and verify absence at terminal state.
- The first observer of terminal state captures evidence, deletes the exact monitor, performs bounded cleanup, and acts idempotently. If the requested outcome is complete, report it without another goal. If substantive agent work remains, create a fresh bounded goal before continuing. Never resume a completed epoch or disturb an unrelated pending goal.
- For a human-only blocker, stop only monitors that cannot produce useful evidence, complete a compatible current goal at the actionable handoff boundary, report the blocker, exact external action, process state, and resumable checkpoint once, then stop. Do not create a heartbeat merely to poll a person. After the operator clears the blocker, substantive work starts under a fresh compatible goal.
- Never inject, simulate, or call native /goal pause or /goal resume for autonomous work control. Human use of native goal commands remains authoritative.
- Preserve narrower episode, expert, delegated-task, security, and credential boundaries. Report any goal or heartbeat control-plane failure with the external identity and checkpoint intact; never claim a transfer or completion that did not occur.
${WORK_CONTROL_END}`;

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

function compatible(event: any): boolean {
  const selectedTools = event.systemPromptOptions?.selectedTools ?? ["ipython"];
  const skills = event.systemPromptOptions?.skills ?? [];
  const hasPythonSkill = (name: string, importName: string) => skills.some((skill: any) =>
    skill?.name === name
    && skill?.kind === "python"
    && skill?.python?.importName === importName
    && skill?.disableModelInvocation !== true
  );
  return selectedTools.includes("ipython")
    && hasPythonSkill("goal", "goal")
    && hasPythonSkill("rlm-heartbeat", "rlm_heartbeat");
}

function rejectCollision(systemPrompt: string, ctx: ExtensionContext): void {
  const startCount = occurrences(systemPrompt, WORK_CONTROL_START);
  const endCount = occurrences(systemPrompt, WORK_CONTROL_END);
  const sentinelCount = occurrences(systemPrompt, WORK_CONTROL_SENTINEL);
  if (startCount !== 0 || endCount !== 0 || sentinelCount !== 0) {
    const message = "goal-heartbeat-work-control: existing policy marker or sentinel collision; "
      + `start=${startCount} end=${endCount} sentinel=${sentinelCount}`;
    ctx.ui.notify(message, "error");
    ctx.abort();
    throw new Error(message);
  }
}

export default function goalHeartbeatWorkControl(pi: ExtensionAPI) {
  pi.on("before_agent_start", (event: any, ctx: ExtensionContext) => {
    rejectCollision(event.systemPrompt, ctx);
    if (!compatible(event)) return;
    return { systemPrompt: `${event.systemPrompt}

${WORK_CONTROL_POLICY}` };
  });
}
