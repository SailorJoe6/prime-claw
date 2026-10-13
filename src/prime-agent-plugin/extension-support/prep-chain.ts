import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  type BacklogTaskSelection,
  resolveBacklogTask,
  validateFutureLocation,
} from "./reviewed-plan-support.ts";
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

export interface TaskPrepChainWorkflow extends PrepChainWorkflow {
  allowedStatuses: readonly string[];
}

export type TaskPrepChainAdmissionResult =
  | { ok: true; taskId: string }
  | { ok: false; message: string; level: "warning" | "error" };

type BacklogTaskResolver = (cwd: string, rawTaskId: string) => BacklogTaskSelection | null;

async function admitResolvedPrepChain(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  projectRoot: string,
  selection: string,
  workflow: PrepChainWorkflow,
  source: "native" | "tool",
  preflight?: (ctx: ExtensionContext, selection: string) => void,
  phasePreamble?: string,
): Promise<PrepChainAdmissionResult> {
  // Preflight both project-owned workflows before beginning a partial
  // transition. Loading them here also keeps every model instruction in the
  // Markdown skills rather than in extension code.
  const prepPrompt = canonicalWorkflowPrompt(projectRoot, workflow.prepSkillName, {
    location: { tag: workflow.locationTag, value: selection },
  });
  if (!prepPrompt) {
    return {
      ok: false,
      message: `reviewed-plan: .prime-claw/workflows/${workflow.prepSkillName}.md not found`,
      level: "warning",
    };
  }
  const canonicalPhasePrompt = canonicalWorkflowPrompt(projectRoot, workflow.phaseSkillName, {
    location: { tag: workflow.locationTag, value: selection },
  });
  if (!canonicalPhasePrompt) {
    return {
      ok: false,
      message: `reviewed-plan: .prime-claw/workflows/${workflow.phaseSkillName}.md not found`,
      level: "warning",
    };
  }

  const phasePrompt = phasePreamble ? `${phasePreamble}\n\n${canonicalPhasePrompt}` : canonicalPhasePrompt;
  preflight?.(ctx, selection);

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

  return { ok: true, location: selection };
}

/**
 * Admit a compact-first folder transition without putting workflow prose in
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
  return admitResolvedPrepChain(
    pi,
    ctx,
    selected.projectRoot,
    selected.location,
    workflow,
    source,
    preflight,
    phasePreamble,
  );
}

/** Admit task-native planning only for one exact Backlog task in an allowed state. */
export async function admitTaskPrepChain(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  rawTaskId: string,
  workflow: TaskPrepChainWorkflow,
  source: "native" | "tool",
  taskResolver: BacklogTaskResolver = resolveBacklogTask,
): Promise<TaskPrepChainAdmissionResult> {
  let selected: BacklogTaskSelection | null;
  try {
    selected = taskResolver(ctx.cwd, rawTaskId);
  } catch (error) {
    return {
      ok: false,
      message: `reviewed-plan: ${error instanceof Error ? error.message : String(error)}`,
      level: "error",
    };
  }
  if (!selected) return { ok: false, message: workflow.usage, level: "warning" };
  if (!workflow.allowedStatuses.includes(selected.status)) {
    return {
      ok: false,
      message: `Task ${selected.taskId} is ${selected.status}; /plan accepts only ${workflow.allowedStatuses.join(" or ")}.`,
      level: "warning",
    };
  }
  const result = await admitResolvedPrepChain(
    pi,
    ctx,
    selected.projectRoot,
    selected.taskId,
    workflow,
    source,
  );
  return result.ok ? { ok: true, taskId: result.location } : result;
}
