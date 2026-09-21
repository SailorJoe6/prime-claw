import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  createSpecEpisode,
  episodeResultText,
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
 * Semantic readiness remains in customizable Markdown. The one structured tool
 * exposes no model-controlled branch, worktree, session, prompt, or command.
 */

const PLAN_USAGE = "Usage: /plan .ralph/plans/future/<slug>";
const IMPLEMENT_USAGE = "Usage: /implement-spec .ralph/plans/future/<slug>";

function warn(ctx: ExtensionContext, message: string): void {
  ctx.ui.notify(message, "warning");
}

function registerSkillCommand(
  pi: ExtensionAPI,
  options: {
    command: string;
    description: string;
    usage: string;
    skillName: string;
    locationTag: string;
    onValidated?: (ctx: ExtensionContext, location: string) => void;
  },
): void {
  pi.registerCommand(options.command, {
    description: options.description,
    handler: async (args, ctx) => {
      let selected;
      try {
        selected = validateFutureLocation(ctx.cwd, args);
      } catch {
        selected = null;
      }
      if (!selected) {
        warn(ctx, options.usage);
        return;
      }
      const prompt = wrapCanonicalSkill(
        selected.projectRoot,
        options.skillName,
        options.locationTag,
        selected.location,
      );
      if (!prompt) {
        warn(ctx, `reviewed-plan: .ralph/skills/${options.skillName}/SKILL.md not found`);
        return;
      }
      pi.sendUserMessage(prompt);
      options.onValidated?.(ctx, selected.location);
    },
  });
}

export function createReviewedPlanExtension(dependencies?: EpisodeDependencies) {
  return function reviewedPlan(pi: ExtensionAPI): void {
    const approvedLocationBySession = new Map<string, string>();
    registerSkillCommand(pi, {
      command: "plan",
      description: "Plan a reviewed specification from an explicit .ralph/plans/future/<slug> folder",
      usage: PLAN_USAGE,
      skillName: "plan",
      locationTag: "operator-plan-location",
    });
    registerSkillCommand(pi, {
      command: "implement-spec",
      description: "Review and promote an approved future bundle into an isolated implementation episode",
      usage: IMPLEMENT_USAGE,
      skillName: "implement-spec",
      locationTag: "operator-implementation-location",
      onValidated: (ctx, location) => {
        approvedLocationBySession.set(ctx.sessionManager.getSessionId(), location);
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
  };
}

export default createReviewedPlanExtension();
