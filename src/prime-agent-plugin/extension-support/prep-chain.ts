import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  validateFutureLocation,
  wrapCanonicalSkill,
} from "./reviewed-plan-support.ts";

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
export function admitPrepChain(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  rawLocation: string,
  workflow: PrepChainWorkflow,
  source: "native" | "tool",
  onValidated?: (ctx: ExtensionContext, location: string) => void,
  preflight?: (ctx: ExtensionContext, location: string) => void,
  phasePreamble?: string,
): PrepChainAdmissionResult {
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
  const prepPrompt = wrapCanonicalSkill(
    selected.projectRoot,
    workflow.prepSkillName,
    workflow.locationTag,
    selected.location,
  );
  if (!prepPrompt) {
    return {
      ok: false,
      message: `reviewed-plan: .prime-claw/workflows/${workflow.prepSkillName}.md not found`,
      level: "warning",
    };
  }
  const canonicalPhasePrompt = wrapCanonicalSkill(
    selected.projectRoot,
    workflow.phaseSkillName,
    workflow.locationTag,
    selected.location,
  );
  if (!canonicalPhasePrompt) {
    return {
      ok: false,
      message: `reviewed-plan: .prime-claw/workflows/${workflow.phaseSkillName}.md not found`,
      level: "warning",
    };
  }

  const phasePrompt = phasePreamble ? `${phasePreamble}\n\n${canonicalPhasePrompt}` : canonicalPhasePrompt;
  preflight?.(ctx, selected.location);

  try {
    if (source === "tool") {
      pi.sendUserMessage(prepPrompt, { deliverAs: "steer" });
    } else {
      pi.sendUserMessage(prepPrompt);
    }
  } catch {
    return {
      ok: false,
      message: `reviewed-plan: canonical ${workflow.prepSkillName} could not be admitted`,
      level: "error",
    };
  }

  try {
    pi.sendUserMessage(phasePrompt, { deliverAs: "followUp" });
  } catch {
    return {
      ok: false,
      message: `reviewed-plan: canonical ${workflow.phaseSkillName} follow-up could not be queued; transition is incomplete`,
      level: "error",
    };
  }

  onValidated?.(ctx, selected.location);
  return { ok: true, location: selected.location };
}
