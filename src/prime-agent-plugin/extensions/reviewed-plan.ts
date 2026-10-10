import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  bundleContentDigest,
  createSpecEpisode,
  episodeResultText,
  handoffSpecEpisode,
  type EpisodeDependencies,
} from "../extension-support/spec-episode.ts";
import {
  admitPrepChain,
  type PrepChainWorkflow,
} from "../extension-support/prep-chain.ts";
import {
  assertConversationPromotionReady,
  conversationGuideText,
  requireConversationOwnership,
  registerConversationOversight,
} from "../extension-support/conversation-oversight.ts";
import { closeEpisodeOwnership } from "../extension-support/episode-close.ts";
import { validateFutureLocation } from "../extension-support/reviewed-plan-support.ts";

/**
 * Native reviewed planning and implementation-promotion boundaries.
 *
 * Commands perform only deterministic path checks and canonical skill loading.
 * Semantic readiness remains in customizable Markdown. Explicit structured tools
 * expose no arbitrary command, prompt, branch, worktree, or session controls.
 */

const PLAN_USAGE = "Usage: /plan-spec .ralph/plans/future/<slug>";
const IMPLEMENT_USAGE = "Usage: /implement-spec .ralph/plans/future/<slug> [--host id:<project-host-setup-id>]";

const PLAN_WORKFLOW = {
  usage: PLAN_USAGE,
  skillName: "plan-spec",
  locationTag: "operator-plan-location",
};
const PLAN_PREP_WORKFLOW: PrepChainWorkflow = {
  usage: PLAN_USAGE,
  prepSkillName: "plan-prep",
  phaseSkillName: PLAN_WORKFLOW.skillName,
  locationTag: PLAN_WORKFLOW.locationTag,
};
const IMPLEMENT_PREP_WORKFLOW: PrepChainWorkflow = {
  usage: IMPLEMENT_USAGE,
  prepSkillName: "implement-prep",
  phaseSkillName: "implement-spec",
  locationTag: "operator-implementation-location",
};


type CommandSelection = { location: string; host?: string };

function parseImplementationArgs(args: string): CommandSelection | null {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 1) return { location: tokens[0] };
  if (tokens.length === 3 && tokens[1] === "--host" && /^id:[0-9a-f-]+$/.test(tokens[2])) {
    return { location: tokens[0], host: tokens[2] };
  }
  return null;
}

type ImplementationApproval = {
  location: string;
  host?: string;
  bundleDigest: string;
  skipNextAgentEnd: boolean;
};

function registerPrepChainCommand(
  pi: ExtensionAPI,
  options: {
    command: string;
    description: string;
    workflow: PrepChainWorkflow;
    onValidated?: (ctx: ExtensionContext, location: string, selection: CommandSelection) => void;
    preflight?: (ctx: ExtensionContext, location: string) => void;
    phasePreamble?: () => string;
    parseArgs?: (args: string) => CommandSelection | null;
  },
): void {
  pi.registerCommand(options.command, {
    description: options.description,
    handler: async (args, ctx) => {
      const selection = options.parseArgs?.(args) ?? { location: args.trim() };
      if (!selection) {
        ctx.ui.notify(options.workflow.usage, "warning");
        return;
      }
      const result = admitPrepChain(
        pi,
        ctx,
        selection.location,
        options.workflow,
        "native",
        undefined,
        options.preflight,
        options.phasePreamble?.(),
      );
      if (!result.ok) {
        ctx.ui.notify(result.message, result.level);
        return;
      }
      options.onValidated?.(ctx, result.location, selection);
    },
  });
}

type ReviewedPlanDependencies = EpisodeDependencies & {
  createEpisode?: typeof createSpecEpisode;
  handoffEpisode?: typeof handoffSpecEpisode;
};

export function createReviewedPlanExtension(dependencies?: ReviewedPlanDependencies) {
  return function reviewedPlan(pi: ExtensionAPI): void {
    const implementationApprovalBySession = new Map<string, ImplementationApproval>();
    const oversightOptions = { guideRoot: dependencies?.guideRoot };
    registerConversationOversight(pi, oversightOptions);
    registerPrepChainCommand(pi, {
      command: "plan-spec",
      description: "Plan a reviewed specification from an explicit .ralph/plans/future/<slug> folder",
      workflow: PLAN_PREP_WORKFLOW,
    });
    registerPrepChainCommand(pi, {
      command: "implement-spec",
      description: "Review and promote an approved future bundle into an isolated implementation episode",
      workflow: IMPLEMENT_PREP_WORKFLOW,
      preflight: (ctx, location) => {
        assertConversationPromotionReady(ctx, location);
        const selected = validateFutureLocation(ctx.cwd, location);
        if (!selected) throw new Error("Validated implementation folder disappeared");
        bundleContentDigest(selected.folder);
      },
      phasePreamble: () => conversationGuideText(oversightOptions),
      parseArgs: parseImplementationArgs,
      onValidated: (ctx, location, selection) => {
        const selected = validateFutureLocation(ctx.cwd, location);
        if (!selected) throw new Error("Validated implementation folder disappeared");
        implementationApprovalBySession.set(ctx.sessionManager.getSessionId(), {
          location,
          ...(selection.host ? { host: selection.host } : {}),
          bundleDigest: bundleContentDigest(selected.folder),
          skipNextAgentEnd: true,
        });
      },
    });

    pi.registerTool({
      name: "plan_spec",
      label: "Plan reviewed Ralph specification",
      description: "Queue the canonical Ralph planning workflow for one exact .ralph/plans/future/<slug> folder. This creates a plan only and never authorizes implementation.",
      promptSnippet: "Queue canonical Ralph planning for one reviewed future-plan folder",
      promptGuidelines: [
        "Call plan_spec only when the operator clearly asks to plan one exact .ralph/plans/future/<slug> folder.",
        "Before calling plan_spec, ask the operator if the folder is missing or materially ambiguous; never search for, select, or invent a folder.",
        "plan_spec queues planning only and never records implementation approval or creates episode resources.",
        "Treat plan_spec as a terminal routing action: after successful admission, do not continue planning in the current turn.",
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
        const result = admitPrepChain(
          pi,
          ctx,
          params.location,
          PLAN_PREP_WORKFLOW,
          "tool",
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
            text: `Planning admitted for ${result.location}: canonical plan-prep was steered and canonical plan was queued as the sole follow-up. Planning has not completed, and implementation is not authorized.`,
          }],
          details: { admitted: true, location: result.location },
        };
      },
    });

    pi.on("session_start", (_event, ctx) => {
      implementationApprovalBySession.delete(ctx.sessionManager.getSessionId());
    });
    pi.on("agent_end", (_event, ctx) => {
      const sessionId = ctx.sessionManager.getSessionId();
      const approval = implementationApprovalBySession.get(sessionId);
      if (!approval) return;
      if (approval.skipNextAgentEnd) {
        implementationApprovalBySession.set(sessionId, {
          ...approval,
          skipNextAgentEnd: false,
        });
        return;
      }
      implementationApprovalBySession.delete(sessionId);
    });
    pi.on("session_shutdown", (_event, ctx) => {
      implementationApprovalBySession.delete(ctx.sessionManager.getSessionId());
    });

    pi.registerTool({
      name: "create_spec_episode",
      label: "Create specification episode",
      description: "Create or return the one worktree-isolated episode for the exact implementation-ready future-plan folder admitted by the current /implement-spec chain.",
      promptSnippet: "Promote one reviewed future-plan folder into one fresh isolated Episode",
      promptGuidelines: [
        "Call create_spec_episode only after the current implement-spec readiness workflow finds its exact selected bundle complete and implementation-ready.",
        "Pass create_spec_episode only the exact operator-selected future-folder location.",
        "The host creates one fresh Episode with one fixed execute assignment; never send an initial handoff or a second assignment.",
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
        const approval = implementationApprovalBySession.get(sessionId);
        if (approval?.location !== params.location || approval.skipNextAgentEnd) {
          return {
            content: [{ type: "text", text: "Episode creation failed: no matching active /implement-spec approval" }],
            details: { error: "no matching active /implement-spec approval" },
            isError: true,
          };
        }
        try {
          implementationApprovalBySession.delete(sessionId);
          assertConversationPromotionReady(ctx, params.location);
          const createEpisode = dependencies?.createEpisode ?? createSpecEpisode;
          const result = await createEpisode(params.location, toolCallId, ctx, dependencies, { host: approval.host, approvedBundleDigest: approval.bundleDigest });
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
      name: "finalize_spec_episode",
      label: "Close specification episode bookkeeping",
      description: "Idempotently clear exact owned episode identity and oversight state after the owning conversation verifies terminal work.",
      promptSnippet: "Close exact episode bookkeeping after verified terminal work",
      promptGuidelines: [
        "Call finalize_spec_episode only after the operator's conversational terminal decision has been carried out and verified for this exact owned episode.",
        "Pass only the exact retained future-folder location used to create the owned episode.",
        "This is a no-UI bookkeeping close. It performs no Git, merge, abandonment, session, worktree, branch, or cleanup action.",
        "An identical replay is idempotent; any owner, location, identity, or state mismatch remains a blocker.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "Exact .ralph/plans/future/<slug> folder owned by this conversation" },
        },
        required: ["location"],
        additionalProperties: false,
      } as any,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          const result = closeEpisodeOwnership(params.location, ctx);
          return {
            content: [{ type: "text", text: result.reused
              ? `Episode bookkeeping was already closed for ${params.location}. CONVERSATION capability remains.`
              : `Episode bookkeeping closed for ${params.location}. Oversight is inactive; CONVERSATION capability remains.` }],
            details: { location: params.location, reused: result.reused, episodeId: result.record.episodeId, status: "inactive" },
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: "text", text: `Episode bookkeeping close failed: ${message}` }], details: { error: message }, isError: true };
        }
      },
    });

    pi.registerTool({
      name: "handoff_spec_episode",
      label: "Hand off specification episode",
      description: "Continue one exact owned idle episode after its owner accepts an in-scope advance or recorded revision: run canonical handoff, then queue canonical execute as its sole follow-up.",
      promptSnippet: "Hand off an exact owned Ralph episode and queue its next execute pass",
      promptGuidelines: [
        "Call handoff_spec_episode only when this exact owner has selected advance after candidate acceptance or revise from accepted findings already recorded inside the approved scope; no new operator transport request is required.",
        "Pass handoff_spec_episode the exact retained future-folder location used to create that episode; never search for or infer another episode.",
        "Pass only optional operator focus or a bounded compaction-focus synthesis of the accepted recorded in-scope findings; never route arbitrary chat, unaccepted findings, product decisions, or scope expansion.",
        "Never call handoff_spec_episode for consult, pause, merge, abandonment, cleanup, or another episode; those boundaries retain their existing operator authority.",
        "Treat handoff_spec_episode as a terminal routing action. Admission does not prove compaction completed; observe the episode before claiming continuation results, and never retry an uncertain result.",
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
            description: "Optional compaction focus: operator-supplied guidance or the exact owner's bounded synthesis of accepted recorded findings inside the approved scope",
          },
        },
        required: ["location"],
        additionalProperties: false,
      } as any,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          requireConversationOwnership(ctx, params.location);
          const handoffEpisode = dependencies?.handoffEpisode ?? handoffSpecEpisode;
          const result = await handoffEpisode(
            params.location,
            params.guidance ?? "",
            ctx,
            dependencies,
          );
          return {
            content: [{
              type: "text",
              text: `Episode handoff admitted for ${result.sourceLocation}: canonical handoff was admitted as an ordinary prompt and canonical execute was queued as the sole follow-up. Admission may be immediate or queued; inspect the episode Status/Evidence output before claiming either workflow completed.`,
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
