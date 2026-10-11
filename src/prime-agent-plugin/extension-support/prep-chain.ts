import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { validateFutureLocation } from "./reviewed-plan-support.ts";
import {
  admitWorkflowChain,
  canonicalWorkflowPrompt,
} from "./workflow-chain.ts";

export interface PrepChainWorkflow {
  usage: string;
  prepSkillName: string;
  phaseSkillName: string;
  locationTag: string;
}

export type PrepChainAdmissionResult =
  | { ok: true; location: string }
  | { ok: false; message: string; level: "warning" | "error" };

/**
 * Admit a compact-first phase transition without putting workflow prose in
 * TypeScript. Both project-local skills are loaded before either message is
 * sent. The phase prompt is always the sole native follow-up.
 */
export async function admitPrepChain(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  rawLocation: string,
  workflow: PrepChainWorkflow,
  source: "native" | "tool",
  preflight?: (ctx: ExtensionContext, location: string) => void,
  phasePreamble?: string,
): Promise<PrepChainAdmissionResult> {
  let selected;
  try {
    selected = validateFutureLocation(ctx.cwd, rawLocation);
  } catch {
    selected = null;
  }
  if (!selected) {
    return { ok: false, message: workflow.usage, level: "warning" };
  }

  // Preflight both project-owned workflows before beginning a partial
  // transition. Loading them here also keeps every model instruction in the
  // Markdown skills rather than in extension code.
  const prepPrompt = canonicalWorkflowPrompt(selected.projectRoot, workflow.prepSkillName, {
    location: { tag: workflow.locationTag, value: selected.location },
  });
  if (!prepPrompt) {
    return {
      ok: false,
      message: `reviewed-plan: .prime-claw/workflows/${workflow.prepSkillName}.md not found`,
      level: "warning",
    };
  }
  const canonicalPhasePrompt = canonicalWorkflowPrompt(selected.projectRoot, workflow.phaseSkillName, {
    location: { tag: workflow.locationTag, value: selected.location },
  });
  if (!canonicalPhasePrompt) {
    return {
      ok: false,
      message: `reviewed-plan: .prime-claw/workflows/${workflow.phaseSkillName}.md not found`,
      level: "warning",
    };
  }

  const phasePrompt = phasePreamble ? `${phasePreamble}\n\n${canonicalPhasePrompt}` : canonicalPhasePrompt;
  preflight?.(ctx, selected.location);

  const admission = await admitWorkflowChain({
    deliverFirst: () => source === "tool"
      ? pi.sendUserMessage(prepPrompt, { deliverAs: "steer" })
      : pi.sendUserMessage(prepPrompt),
    deliverFollowUp: () => pi.sendUserMessage(phasePrompt, { deliverAs: "followUp" }),
  });
  if (!admission.ok) return {
    ok: false,
    level: "error",
    message: admission.stage === "first"
      ? `reviewed-plan: canonical ${workflow.prepSkillName} could not be admitted`
      : `reviewed-plan: ${workflow.prepSkillName} was admitted, but ${workflow.phaseSkillName} follow-up admission is unconfirmed; inspect before retrying`,
  };

  return { ok: true, location: selected.location };
}
