import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Give the agent a supported way to pause/resume the host-owned persistent goal.
 *
 * Goal state must only be mutated by Prime Agent's native /goal commands. These
 * tools queue those commands at a safe session-action boundary; they never edit
 * thread_goal_state entries or call private AgentSession methods.
 */
export default function goalBlockerControl(pi: ExtensionAPI) {
  pi.registerTool({
    name: "pause_thread_goal",
    label: "Pause thread goal",
    description:
      "Pause the active persistent thread goal while an observable long-running process runs " +
      "without agent action, or when progress is externally blocked by human action, authentication, " +
      "permission, host/environment repair, unavailable tooling, or an external decision. " +
      "This queues Prime Agent's native /goal pause command.",
    promptGuidelines: [
      "For substantive multi-step work, create a persistent goal unless the active goal already covers it. Scope it to the smallest end-to-end outcome that produces observable value or decisive evidence and can finish without relying on automatic compaction. Do not create goals for trivial answers or quick single lookups.",
      "Keep one primary objective active. Complete the goal only after its scoped outcome is achieved; never complete unfinished work merely to stop continuation reminders.",
      "Before yielding to an observable long-running process or background task, call pause_thread_goal, retain its handle, create one bounded agent-owned rlm_heartbeat with exact success, failure, blocker, and cleanup conditions, and end the turn instead of polling or spending goal continuations.",
      "When a heartbeat observes that background work finishes, stop that heartbeat and call resume_thread_goal if useful work remains; complete the goal instead when the result achieves it.",
      "When an active persistent goal is externally blocked and cannot make useful progress without outside action, call pause_thread_goal immediately and before ending the turn.",
      "Before calling pause_thread_goal for a human blocker, cancel only the heartbeat or scheduled monitoring owned by the blocked objective; preserve unrelated monitoring.",
      "After pausing for a human blocker, report the exact blocker, why the agent cannot resolve it internally, the external action needed, and the resumable checkpoint once; do not emit repeated unchanged blocker reports or continuations while paused.",
    ],
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Concise reason for pausing and the event or action that permits resumption.",
        },
      },
      required: ["reason"],
      additionalProperties: false,
    } as any,
    async execute(_toolCallId, params) {
      pi.sendUserMessage("/goal pause", { deliverAs: "steer" });
      return {
        content: [
          {
            type: "text",
            text:
              "Queued native /goal pause at the next safe session boundary. " +
              `Reason: ${params.reason}`,
          },
        ],
        details: { queued: true, command: "/goal pause", reason: params.reason },
      };
    },
  });

  pi.registerTool({
    name: "resume_thread_goal",
    label: "Resume thread goal",
    description:
      "Resume a paused persistent thread goal after monitored background work finishes, " +
      "or after the user confirms that an external blocker is cleared. " +
      "This queues Prime Agent's native /goal resume command.",
    promptGuidelines: [
      "Call resume_thread_goal after monitored background work finishes and useful goal work remains, or after the user confirms that an external blocker is cleared; otherwise leave the goal paused.",
    ],
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    } as any,
    async execute() {
      pi.sendUserMessage("/goal resume", { deliverAs: "steer" });
      return {
        content: [
          { type: "text", text: "Queued native /goal resume at the next safe session boundary." },
        ],
        details: { queued: true, command: "/goal resume" },
      };
    },
  });
}
