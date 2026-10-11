import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  admitWorkflowChain,
  canonicalWorkflowPrompt,
} from "../extension-support/workflow-chain.ts";

/**
 * Deterministic native /handoff -> canonical execute admission.
 *
 * Compaction remains a best-effort action inside the handoff workflow. The
 * command and conversational tool admit execute independently as one native
 * follow-up, so no compaction event can create a second execute pass.
 */

type AdmissionResult =
  | { ok: true }
  | { ok: false; message: string; level: "warning" | "error" };

async function admitHandoff(
  pi: ExtensionAPI,
  cwd: string,
  guidance: string,
  source: "native" | "tool",
): Promise<AdmissionResult> {
  // Preflight both canonical workflows before beginning a partial transition.
  const handoff = canonicalWorkflowPrompt(cwd, "handoff", { guidance: guidance.trim(), legacySnapshot: true });
  if (!handoff) {
    return {
      ok: false,
      message: "handoff-chain: .prime-claw/workflows/handoff.md not found",
      level: "warning",
    };
  }
  const execute = canonicalWorkflowPrompt(cwd, "execute", { legacySnapshot: true });
  if (!execute) {
    return {
      ok: false,
      message: "handoff-chain: .agents/skills/execute/SKILL.md not found",
      level: "warning",
    };
  }

  const admission = await admitWorkflowChain({
    deliverFirst: () => source === "tool"
      ? pi.sendUserMessage(handoff, { deliverAs: "steer" })
      : pi.sendUserMessage(handoff),
    deliverFollowUp: () => pi.sendUserMessage(execute, { deliverAs: "followUp" }),
  });
  if (!admission.ok) return {
    ok: false,
    level: "error",
    message: admission.stage === "first"
      ? "handoff-chain: canonical handoff could not be admitted"
      : "handoff-chain: handoff was admitted, but execute follow-up admission is unconfirmed; inspect and do not retry",
  };

  return { ok: true };
}

export default function handoffChain(pi: ExtensionAPI): void {
  pi.registerCommand("handoff", {
    description: "Ralph handoff phase — optional trailing text supplies compaction guidance; execute is queued independently",
    handler: async (args, ctx) => {
      const result = await admitHandoff(pi, ctx.cwd, args, "native");
      if (!result.ok) ctx.ui.notify(result.message, result.level);
    },
  });

  pi.registerTool({
    name: "ralph_handoff",
    label: "Ralph handoff",
    description: "Admit the canonical Ralph handoff workflow and queue one canonical execute follow-up. Optional guidance affects handoff compaction focus only.",
    promptSnippet: "Hand off the current Ralph implementation slice and queue its next execute pass",
    promptGuidelines: [
      "Call ralph_handoff when the operator clearly asks to hand off the current Ralph implementation pass.",
      "Pass ralph_handoff only operator-supplied optional guidance; ask before calling if the handoff objective would be materially inferred.",
      "Treat ralph_handoff as a terminal routing action: after successful admission, do not continue the implementation task in the current turn.",
    ],
    executionMode: "sequential",
    parameters: {
      type: "object",
      properties: {
        guidance: {
          type: "string",
          description: "Optional operator-supplied compaction guidance for the handoff workflow",
        },
      },
      additionalProperties: false,
    } as any,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = await admitHandoff(pi, ctx.cwd, params.guidance ?? "", "tool");
      if (!result.ok) {
        return {
          content: [{ type: "text", text: result.message }],
          details: { admitted: false, error: result.message },
          isError: true,
        };
      }
      return {
        content: [{
          type: "text",
          text: "Handoff admitted: canonical handoff was steered and one canonical execute follow-up was queued.",
        }],
        details: { admitted: true },
      };
    },
  });

}
