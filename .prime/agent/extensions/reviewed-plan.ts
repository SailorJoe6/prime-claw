import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  createSpecEpisode,
  episodeResultText,
  handoffSpecEpisode,
  type EpisodeDependencies,
} from "../extension-support/spec-episode.ts";
import {
  validateFutureLocation,
  wrapCanonicalSkill,
} from "../extension-support/reviewed-plan-support.ts";

/**
 * Native reviewed planning and implementation-promotion boundaries.
 *
 * Commands perform only deterministic path checks and canonical skill loading.
 * Semantic readiness remains in customizable Markdown. Explicit structured tools
 * expose no arbitrary command, prompt, branch, worktree, or session controls.
 */

const PLAN_USAGE = "Usage: /plan .ralph/plans/future/<slug>";
const IMPLEMENT_USAGE = "Usage: /implement-spec .ralph/plans/future/<slug>";

const PLAN_WORKFLOW = {
  usage: PLAN_USAGE,
  skillName: "plan",
  locationTag: "operator-plan-location",
};
const IMPLEMENT_WORKFLOW = {
  usage: IMPLEMENT_USAGE,
  skillName: "implement-spec",
  locationTag: "operator-implementation-location",
};

function warn(ctx: ExtensionContext, message: string): void {
  ctx.ui.notify(message, "warning");
}

type SkillWorkflow = {
  usage: string;
  skillName: string;
  locationTag: string;
};

type SkillAdmissionResult =
  | { ok: true; location: string }
  | { ok: false; message: string };

function admitCanonicalSkill(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  rawLocation: string,
  workflow: SkillWorkflow,
  delivery: "native" | "followUp",
  onValidated?: (ctx: ExtensionContext, location: string) => void,
): SkillAdmissionResult {
  let selected;
  try {
    selected = validateFutureLocation(ctx.cwd, rawLocation);
  } catch {
    selected = null;
  }
  if (!selected) return { ok: false, message: workflow.usage };

  const prompt = wrapCanonicalSkill(
    selected.projectRoot,
    workflow.skillName,
    workflow.locationTag,
    selected.location,
  );
  if (!prompt) {
    return {
      ok: false,
      message: `reviewed-plan: .ralph/skills/${workflow.skillName}/SKILL.md not found`,
    };
  }

  try {
    if (delivery === "followUp") {
      pi.sendUserMessage(prompt, { deliverAs: "followUp" });
    } else {
      pi.sendUserMessage(prompt);
    }
  } catch (error) {
    if (delivery === "native") throw error;
    return {
      ok: false,
      message: `reviewed-plan: canonical ${workflow.skillName} could not be queued`,
    };
  }

  onValidated?.(ctx, selected.location);
  return { ok: true, location: selected.location };
}

function registerSkillCommand(
  pi: ExtensionAPI,
  options: {
    command: string;
    description: string;
    workflow: SkillWorkflow;
    onValidated?: (ctx: ExtensionContext, location: string) => void;
  },
): void {
  pi.registerCommand(options.command, {
    description: options.description,
    handler: async (args, ctx) => {
      const result = admitCanonicalSkill(
        pi,
        ctx,
        args,
        options.workflow,
        "native",
        options.onValidated,
      );
      if (!result.ok) warn(ctx, result.message);
    },
  });
}

export function createReviewedPlanExtension(dependencies?: EpisodeDependencies) {
  return function reviewedPlan(pi: ExtensionAPI): void {
    const approvedLocationBySession = new Map<string, string>();
    registerSkillCommand(pi, {
      command: "plan",
      description: "Plan a reviewed specification from an explicit .ralph/plans/future/<slug> folder",
      workflow: PLAN_WORKFLOW,
    });
    registerSkillCommand(pi, {
      command: "implement-spec",
      description: "Review and promote an approved future bundle into an isolated implementation episode",
      workflow: IMPLEMENT_WORKFLOW,
      onValidated: (ctx, location) => {
        approvedLocationBySession.set(ctx.sessionManager.getSessionId(), location);
      },
    });

    pi.registerTool({
      name: "ralph_plan",
      label: "Plan reviewed Ralph specification",
      description: "Queue the canonical Ralph planning workflow for one exact .ralph/plans/future/<slug> folder. This creates a plan only and never authorizes implementation.",
      promptSnippet: "Queue canonical Ralph planning for one reviewed future-plan folder",
      promptGuidelines: [
        "Call ralph_plan only when the operator clearly asks to plan one exact .ralph/plans/future/<slug> folder.",
        "Before calling ralph_plan, ask the operator if the folder is missing or materially ambiguous; never search for, select, or invent a folder.",
        "ralph_plan queues planning only and never records implementation approval or creates episode resources.",
        "Treat ralph_plan as a terminal routing action: after successful admission, do not continue planning in the current turn.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "Exact project-relative .ralph/plans/future/<slug> folder selected by the operator",
          },
        },
        required: ["location"],
        additionalProperties: false,
      } as any,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const result = admitCanonicalSkill(
          pi,
          ctx,
          params.location,
          PLAN_WORKFLOW,
          "followUp",
        );
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
            text: `Planning admitted for ${result.location}: the canonical workflow was queued as a follow-up. Planning has not completed, and implementation is not authorized.`,
          }],
          details: { admitted: true, location: result.location },
        };
      },
    });

    pi.on("session_start", (_event, ctx) => {
      approvedLocationBySession.delete(ctx.sessionManager.getSessionId());
    });
    pi.on("agent_end", (_event, ctx) => {
      approvedLocationBySession.delete(ctx.sessionManager.getSessionId());
    });
    pi.on("session_shutdown", (_event, ctx) => {
      approvedLocationBySession.delete(ctx.sessionManager.getSessionId());
    });

    pi.registerTool({
      name: "create_spec_episode",
      label: "Create specification episode",
      description: "Create or return the one worktree-isolated episode for an implementation-ready future-plan folder.",
      promptSnippet: "Promote one reviewed future-plan folder into its isolated implementation episode",
      promptGuidelines: [
        "Call create_spec_episode only after the implement-spec readiness workflow finds the selected bundle complete and implementation-ready.",
        "Pass create_spec_episode only the exact operator-selected future-folder location.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "Exact project-relative .ralph/plans/future/<slug> folder selected by the operator",
          },
        },
        required: ["location"],
        additionalProperties: false,
      } as any,
      async execute(toolCallId, params, _signal, _onUpdate, ctx) {
        const sessionId = ctx.sessionManager.getSessionId();
        if (approvedLocationBySession.get(sessionId) !== params.location) {
          return {
            content: [{ type: "text", text: "Episode creation failed: no matching active /implement-spec approval" }],
            details: { error: "no matching active /implement-spec approval" },
            isError: true,
          };
        }
        approvedLocationBySession.delete(sessionId);
        try {
          const result = await createSpecEpisode(params.location, toolCallId, ctx, dependencies);
          return {
            content: [{ type: "text", text: episodeResultText(result) }],
            details: result,
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Episode creation failed: ${error instanceof Error ? error.message : String(error)}` }],
            details: { error: error instanceof Error ? error.message : String(error) },
            isError: true,
          };
        }
      },
    });

    pi.registerTool({
      name: "handoff_spec_episode",
      label: "Hand off specification episode",
      description: "Drive one exact owned idle episode through canonical handoff, then queue canonical execute as its sole follow-up.",
      promptSnippet: "Hand off an exact owned Ralph episode and queue its next execute pass",
      promptGuidelines: [
        "Call handoff_spec_episode only when the operator clearly asks to continue one exact owned episode between implementation slices.",
        "Pass handoff_spec_episode the exact future-folder location used to create that episode; never search for or infer another episode.",
        "Pass only operator-supplied optional guidance; ask if the intended compaction focus would be materially inferred.",
        "Treat handoff_spec_episode as a terminal routing action. Admission does not prove compaction completed; observe the episode before claiming continuation results.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "Exact project-relative .ralph/plans/future/<slug> folder used to create the owned episode",
          },
          guidance: {
            type: "string",
            description: "Optional operator-supplied compaction guidance for the episode handoff workflow",
          },
        },
        required: ["location"],
        additionalProperties: false,
      } as any,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          const result = await handoffSpecEpisode(
            params.location,
            params.guidance ?? "",
            ctx,
            dependencies,
          );
          return {
            content: [{
              type: "text",
              text: `Episode handoff admitted for ${result.sourceLocation}: canonical handoff was sent as steer and canonical execute was queued as the sole follow-up. Inspect the episode Status/Evidence output for its compaction-request result before claiming continuation completed.`,
            }],
            details: result,
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Episode handoff failed: ${error instanceof Error ? error.message : String(error)}` }],
            details: { error: error instanceof Error ? error.message : String(error) },
            isError: true,
          };
        }
      },
    });
  };
}

export default createReviewedPlanExtension();
