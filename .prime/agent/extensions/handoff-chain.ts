import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Deterministic native /handoff -> canonical execute admission.
 *
 * Compaction remains a best-effort action inside the handoff workflow. The
 * command and conversational tool admit execute independently as one native
 * follow-up, so no compaction event can create a second execute pass.
 */

const LEGACY_MARKER = join(".prime", "agent", "state", "chain-next");
const GUIDANCE_TAG = "operator-compaction-guidance";

type AdmissionResult =
  | { ok: true }
  | { ok: false; message: string; level: "warning" | "error" };

function removeLegacyMarker(cwd: string): void {
  rmSync(join(cwd, LEGACY_MARKER), { force: true });
}

function skillPrompt(cwd: string, name: string, guidance = ""): string | null {
  const path = join(cwd, ".ralph", "skills", name, "SKILL.md");
  if (!existsSync(path)) return null;
  const body = readFileSync(path, "utf8");
  const wrapped = `<skill name="${name}" location="${path}">
References are relative to ${dirname(path)}.

${body}
</skill>`;
  return guidance
    ? `${wrapped}

<${GUIDANCE_TAG}>
${guidance}
</${GUIDANCE_TAG}>`
    : wrapped;
}

function admitHandoff(
  pi: ExtensionAPI,
  cwd: string,
  guidance: string,
  source: "native" | "tool",
): AdmissionResult {
  removeLegacyMarker(cwd);

  // Preflight both canonical workflows before beginning a partial transition.
  const handoff = skillPrompt(cwd, "handoff", guidance.trim());
  if (!handoff) {
    return {
      ok: false,
      message: "handoff-chain: .ralph/skills/handoff/SKILL.md not found",
      level: "warning",
    };
  }
  const execute = skillPrompt(cwd, "execute");
  if (!execute) {
    return {
      ok: false,
      message: "handoff-chain: .ralph/skills/execute/SKILL.md not found",
      level: "warning",
    };
  }

  try {
    if (source === "tool") {
      pi.sendUserMessage(handoff, { deliverAs: "steer" });
    } else {
      pi.sendUserMessage(handoff);
    }
  } catch {
    return {
      ok: false,
      message: "handoff-chain: canonical handoff could not be admitted",
      level: "error",
    };
  }

  try {
    pi.sendUserMessage(execute, { deliverAs: "followUp" });
  } catch {
    return {
      ok: false,
      message: "handoff-chain: canonical execute follow-up could not be queued; continuation is infeasible",
      level: "error",
    };
  }

  return { ok: true };
}

export default function handoffChain(pi: ExtensionAPI): void {
  pi.registerCommand("handoff", {
    description: "Ralph handoff phase — optional trailing text supplies compaction guidance; execute is queued independently",
    handler: async (args, ctx) => {
      const result = admitHandoff(pi, ctx.cwd, args, "native");
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
      const result = admitHandoff(pi, ctx.cwd, params.guidance ?? "", "tool");
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

  // The Phase 4a.1 marker has no trustworthy session owner. Delete it without
  // consuming it. Native queues and session lifecycle now own cancellation.
  pi.on("session_start", (_event, ctx) => removeLegacyMarker(ctx.cwd));
  pi.on("session_shutdown", (_event, ctx) => removeLegacyMarker(ctx.cwd));
}
