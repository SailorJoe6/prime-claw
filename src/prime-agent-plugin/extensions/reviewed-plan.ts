import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  abandonTaskEpisode,
  bundleContentDigest,
  createSpecEpisode,
  createTaskEpisode,
  delayTaskEpisodeReadyForMerge,
  episodeResultText,
  finalizeTaskEpisodeCleanup,
  handoffSpecEpisode,
  handoffTaskEpisode,
  integrateTaskEpisodeChangesRequested,
  integrateTaskEpisodeReadyForMerge,
  mergeTaskEpisodeReadyForMerge,
  prepareTaskEpisodeAbandonmentDecision,
  prepareTaskEpisodeCleanupDecision,
  publishTaskEpisodeBlocked,
  publishTaskEpisodeChangesRequested,
  publishTaskEpisodeReadyForMerge,
  publishTaskEpisodeResumed,
  resolveTaskEpisodePlacement,
  resumeTaskEpisodeChangesRequested,
  verifyTaskEpisodeReadyForMerge,
  CliGitAdapter,
  HandoffFollowUpRejectedError,
  EpisodeStateUncertainError,
  type EpisodeDependencies,
  type TaskEpisodeAdmissionOptions,
  type TaskEpisodeChangesIntegrationResult,
  type TaskEpisodeChangesPublicationResult,
  type TaskEpisodeCreationDependencies,
  type TaskEpisodeFinalizationDependencies,
  type TaskEpisodeReadyForMergeDependencies,
  type TaskEpisodeReadyHandshakeEvidence,
  type TaskEpisodePlacementDependencies,
  type TaskEpisodeTerminalEvidence,
} from "../extension-support/spec-episode.ts";
import { CliTaskEpisodeCleanupAdapter } from "../extension-support/task-episode-cleanup.ts";
import {
  admitPrepChain,
  admitTaskPrepChain,
  type PrepChainWorkflow,
  type TaskPrepChainAdmissionResult,
  type TaskPrepChainWorkflow,
} from "../extension-support/prep-chain.ts";
import {
  assertConversationPromotionReady,
  conversationGuideText,
  registerConversationOversight,
} from "../extension-support/conversation-oversight.ts";
import { closeEpisodeOwnership } from "../extension-support/episode-close.ts";
import {
  resolveBacklogTask,
  validateFutureLocation,
  type BacklogTaskSelection,
} from "../extension-support/reviewed-plan-support.ts";

/**
 * Native reviewed planning and implementation-promotion boundaries.
 *
 * Commands perform only deterministic path checks and canonical skill loading.
 * Semantic readiness remains in customizable Markdown. Explicit structured tools
 * expose no arbitrary command, prompt, branch, worktree, or session controls.
 */

const PLAN_USAGE = "Usage: /plan-spec .ralph/plans/future/<slug>";
const PLAN_TASK_USAGE = "Usage: /plan TASK-ID";
const IMPLEMENT_USAGE = "Usage: /implement-spec .ralph/plans/future/<slug> [--host id:<project-host-setup-id>]";

const PLAN_PREP_WORKFLOW: PrepChainWorkflow = {
  usage: PLAN_USAGE,
  prepSkillName: "plan-prep",
  phaseSkillName: "plan-spec",
  locationTag: "operator-plan-location",
};
const PLAN_TASK_PREP_WORKFLOW: TaskPrepChainWorkflow = {
  usage: PLAN_TASK_USAGE,
  prepSkillName: "plan-task-prep",
  phaseSkillName: "plan-task",
  locationTag: "operator-plan-task-id",
  allowedStatuses: ["In Design", "In Planning"],
};
const IMPLEMENT_PREP_WORKFLOW: PrepChainWorkflow = {
  usage: IMPLEMENT_USAGE,
  prepSkillName: "implement-prep",
  phaseSkillName: "implement-spec",
  locationTag: "operator-implementation-location",
};
const IMPLEMENT_TASK_USAGE = "Usage: /implement-task TASK-ID [--host id:<project-host-setup-id>]";
const IMPLEMENT_TASK_PREP_WORKFLOW: TaskPrepChainWorkflow = {
  usage: IMPLEMENT_TASK_USAGE,
  prepSkillName: "implement-task-prep",
  phaseSkillName: "implement-task",
  locationTag: "operator-implementation-task-id",
  allowedStatuses: ["In Planning"],
};


type CommandSelection = { location: string; host?: string };
type TaskCommandSelection = { taskId: string; host?: string };

function parseImplementationArgs(args: string): CommandSelection | null {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 1) return { location: tokens[0] };
  if (tokens.length === 3 && tokens[1] === "--host" && /^id:[0-9a-f-]+$/.test(tokens[2])) {
    return { location: tokens[0], host: tokens[2] };
  }
  return null;
}

function parseTaskImplementationArgs(args: string): TaskCommandSelection | null {
  const selected = parseImplementationArgs(args);
  return selected ? { taskId: selected.location, ...(selected.host ? { host: selected.host } : {}) } : null;
}

type ImplementationApproval = {
  location: string;
  host?: string;
  bundleDigest: string;
  skipNextAgentEnd: boolean;
};

export type TaskImplementationApproval = {
  ownerSessionId: string;
  taskId: string;
  taskPath: string;
  projectRoot: string;
  placement: TaskEpisodeAdmissionOptions;
  skipNextAgentEnd: boolean;
};

/** One-turn, single-use authority for the exact task and preselected placement. */
export class TaskImplementationApprovalStore {
  private readonly approvals = new Map<string, TaskImplementationApproval>();

  grant(
    ctx: ExtensionContext,
    task: BacklogTaskSelection,
    placement: TaskEpisodeAdmissionOptions,
  ): void {
    const ownerSessionId = ctx.sessionManager.getSessionId();
    this.approvals.set(ownerSessionId, {
      ownerSessionId,
      taskId: task.taskId,
      taskPath: task.taskPath,
      projectRoot: task.projectRoot,
      placement: { ...placement },
      skipNextAgentEnd: true,
    });
  }

  consume(
    ctx: ExtensionContext,
    task: BacklogTaskSelection,
  ): TaskImplementationApproval | null {
    const ownerSessionId = ctx.sessionManager.getSessionId();
    const approval = this.approvals.get(ownerSessionId);
    if (!approval || approval.skipNextAgentEnd
      || approval.ownerSessionId !== ownerSessionId
      || approval.taskId !== task.taskId
      || approval.taskPath !== task.taskPath
      || approval.projectRoot !== task.projectRoot) return null;
    this.approvals.delete(ownerSessionId);
    return { ...approval, placement: { ...approval.placement } };
  }

  agentEnd(ownerSessionId: string): void {
    const approval = this.approvals.get(ownerSessionId);
    if (!approval) return;
    if (approval.skipNextAgentEnd) {
      this.approvals.set(ownerSessionId, { ...approval, skipNextAgentEnd: false });
      return;
    }
    this.approvals.delete(ownerSessionId);
  }

  clear(ownerSessionId: string): void {
    this.approvals.delete(ownerSessionId);
  }
}

export interface TaskImplementationAdmissionDependencies {
  taskResolver?: (cwd: string, taskId: string) => BacklogTaskSelection | null;
  placementResolver?: typeof resolveTaskEpisodePlacement;
  placement?: TaskEpisodePlacementDependencies;
  guideRoot?: string;
}

/**
 * Admit the task-native compact-first implementation chain. Placement is
 * resolved before either workflow message, and approval is recorded only after
 * both messages are admitted.
 */
export async function admitTaskImplementationPrepChain(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  args: string,
  approvals: TaskImplementationApprovalStore,
  dependencies: TaskImplementationAdmissionDependencies = {},
): Promise<TaskPrepChainAdmissionResult> {
  const parsed = parseTaskImplementationArgs(args);
  if (!parsed) return { ok: false, message: IMPLEMENT_TASK_USAGE, level: "warning" };
  let selected: BacklogTaskSelection | undefined;
  let placement: TaskEpisodeAdmissionOptions | undefined;
  const result = await admitTaskPrepChain(
    pi,
    ctx,
    parsed.taskId,
    IMPLEMENT_TASK_PREP_WORKFLOW,
    "native",
    dependencies.taskResolver,
    async (callCtx, task) => {
      selected = task;
      const resolvePlacement = dependencies.placementResolver ?? resolveTaskEpisodePlacement;
      placement = await resolvePlacement(task.projectRoot, parsed.host, callCtx, dependencies.placement);
    },
    conversationGuideText({ guideRoot: dependencies.guideRoot }),
  );
  if (result.ok) {
    if (!selected || !placement) throw new Error("Task implementation admission lost its exact placement binding");
    approvals.grant(ctx, selected, placement);
  }
  return result;
}

function registerPrepChainCommand(
  pi: ExtensionAPI,
  options: {
    command: string;
    description: string;
    workflow: PrepChainWorkflow;
    onValidated?: (ctx: ExtensionContext, location: string, selection: CommandSelection, preflightValue?: string) => void;
    preflight?: (ctx: ExtensionContext, location: string) => string | undefined;
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
      let preflightValue: string | undefined;
      const result = await admitPrepChain(
        pi,
        ctx,
        selection.location,
        options.workflow,
        "native",
        options.preflight ? (callCtx, location) => {
          preflightValue = options.preflight!(callCtx, location);
        } : undefined,
        options.phasePreamble?.(),
      );
      if (!result.ok) {
        ctx.ui.notify(result.message, result.level);
        return;
      }
      options.onValidated?.(ctx, result.location, selection, preflightValue);
    },
  });
}

type TaskEpisodePublicActions = {
  create: typeof createTaskEpisode;
  handoff: typeof handoffTaskEpisode;
  block: typeof publishTaskEpisodeBlocked;
  resume: typeof publishTaskEpisodeResumed;
  readyPublish: typeof publishTaskEpisodeReadyForMerge;
  readyIntegrate: typeof integrateTaskEpisodeReadyForMerge;
  readyVerify: typeof verifyTaskEpisodeReadyForMerge;
  delay: typeof delayTaskEpisodeReadyForMerge;
  changesPublish: typeof publishTaskEpisodeChangesRequested;
  changesIntegrate: typeof integrateTaskEpisodeChangesRequested;
  changesResume: typeof resumeTaskEpisodeChangesRequested;
  merge: typeof mergeTaskEpisodeReadyForMerge;
  prepareAbandonment: typeof prepareTaskEpisodeAbandonmentDecision;
  abandon: typeof abandonTaskEpisode;
  prepareCleanup: typeof prepareTaskEpisodeCleanupDecision;
  cleanup: typeof finalizeTaskEpisodeCleanup;
};

const DEFAULT_TASK_ACTIONS: TaskEpisodePublicActions = {
  create: createTaskEpisode,
  handoff: handoffTaskEpisode,
  block: publishTaskEpisodeBlocked,
  resume: publishTaskEpisodeResumed,
  readyPublish: publishTaskEpisodeReadyForMerge,
  readyIntegrate: integrateTaskEpisodeReadyForMerge,
  readyVerify: verifyTaskEpisodeReadyForMerge,
  delay: delayTaskEpisodeReadyForMerge,
  changesPublish: publishTaskEpisodeChangesRequested,
  changesIntegrate: integrateTaskEpisodeChangesRequested,
  changesResume: resumeTaskEpisodeChangesRequested,
  merge: mergeTaskEpisodeReadyForMerge,
  prepareAbandonment: prepareTaskEpisodeAbandonmentDecision,
  abandon: abandonTaskEpisode,
  prepareCleanup: prepareTaskEpisodeCleanupDecision,
  cleanup: finalizeTaskEpisodeCleanup,
};

type ReviewedPlanDependencies = EpisodeDependencies & TaskEpisodeCreationDependencies & TaskEpisodeReadyForMergeDependencies & {
  createEpisode?: typeof createSpecEpisode;
  handoffEpisode?: typeof handoffSpecEpisode;
  taskResolver?: typeof resolveBacklogTask;
  taskImplementationApprovals?: TaskImplementationApprovalStore;
  placementResolver?: typeof resolveTaskEpisodePlacement;
  taskActions?: Partial<TaskEpisodePublicActions>;
  taskCleanup?: TaskEpisodeFinalizationDependencies["cleanup"];
};

type TaskEpisodeActionParams = {
  action: "block" | "resume" | "accept-candidate" | "delay" | "request-changes" | "merge" | "abandon" | "cleanup";
  taskId: string;
  episodeHead?: string;
  guidance?: string;
  readyReceipt?: TaskEpisodeReadyHandshakeEvidence;
  resumeProgress?: { publication?: ReturnType<typeof publishTaskEpisodeResumed> };
  readyProgress?: {
    publication?: TaskEpisodeReadyHandshakeEvidence["publication"];
    integration?: TaskEpisodeReadyHandshakeEvidence["integration"];
  };
  changesProgress?: {
    publication?: TaskEpisodeChangesPublicationResult;
    integration?: TaskEpisodeChangesIntegrationResult;
  };
  terminalEvidence?: TaskEpisodeTerminalEvidence;
  finalSummary?: string;
  confirmed?: boolean;
};

class TaskEpisodeActionPhaseError extends Error {
  readonly details: Record<string, unknown>;
  constructor(message: string, details: Record<string, unknown>) { super(message); this.details = details; }
}

async function runTaskEpisodeAction(
  params: TaskEpisodeActionParams,
  ctx: ExtensionContext,
  dependencies: ReviewedPlanDependencies,
): Promise<Record<string, unknown>> {
  const actions = { ...DEFAULT_TASK_ACTIONS, ...dependencies.taskActions };
  const taskId = params.taskId.trim();
  if (!taskId || /\s/.test(taskId) || taskId.startsWith("-")) {
    throw new Error("Task Episode action requires one exact Backlog task ID");
  }
  const requireTaskReceipt = (receiptTaskId: string | undefined, label: string) => {
    if (receiptTaskId !== taskId) throw new Error(`${label} does not bind the exact requested task`);
  };
  if (params.readyProgress?.integration && !params.readyProgress.publication) {
    throw new Error("Ready progress cannot contain integration without its publication");
  }
  if (params.changesProgress?.integration && !params.changesProgress.publication) {
    throw new Error("Changes progress cannot contain integration without its publication");
  }
  if (params.readyReceipt) requireTaskReceipt(params.readyReceipt.publication?.taskId, "Ready receipt");
  if (params.readyProgress?.publication) requireTaskReceipt(params.readyProgress.publication.taskId, "Ready progress");
  if (params.changesProgress?.publication) requireTaskReceipt(params.changesProgress.publication.taskId, "Changes progress");
  if (params.resumeProgress?.publication) requireTaskReceipt(params.resumeProgress.publication.taskId, "Resume progress");
  if (params.terminalEvidence) requireTaskReceipt(params.terminalEvidence.result?.taskId, "Terminal evidence");
  if (params.action === "block") {
    if (!params.episodeHead) throw new Error("Block requires the exact pushed Episode report head");
    return { action: params.action, result: actions.block(taskId, params.episodeHead, ctx, dependencies) };
  }
  if (params.action === "resume") {
    if (!params.episodeHead && !params.resumeProgress?.publication) {
      throw new Error("Resume requires the exact accepted blocked Episode head");
    }
    let publication = params.resumeProgress?.publication;
    try {
      publication ??= actions.resume(taskId, params.episodeHead!, ctx, dependencies);
      const handoff = await actions.handoff(taskId, params.guidance ?? "", ctx, dependencies);
      return { action: params.action, publication, handoff };
    } catch (error) {
      throw new TaskEpisodeActionPhaseError(
        error instanceof Error ? error.message : String(error),
        (error instanceof HandoffFollowUpRejectedError || error instanceof EpisodeStateUncertainError)
          ? { action: params.action, resumeProgress: { ...(publication ? { publication } : {}) }, transportUncertain: true, retryable: false }
          : { action: params.action, resumeProgress: { ...(publication ? { publication } : {}) }, retryable: true },
      );
    }
  }
  if (params.action === "accept-candidate") {
    if (!params.episodeHead && !params.readyProgress?.publication) {
      throw new Error("Candidate acceptance requires the exact pushed Episode candidate head");
    }
    let publication = params.readyProgress?.publication;
    let integration = params.readyProgress?.integration;
    try {
      publication ??= actions.readyPublish(taskId, params.episodeHead!, ctx, dependencies);
      if (!integration || integration.pushError) {
        integration = await actions.readyIntegrate(publication, ctx, dependencies);
      }
      const verification = actions.readyVerify(publication, integration, ctx, dependencies);
      return { action: params.action, readyReceipt: { publication, integration, verification } };
    } catch (error) {
      throw new TaskEpisodeActionPhaseError(
        error instanceof Error ? error.message : String(error),
        { action: params.action, readyProgress: { ...(publication ? { publication } : {}), ...(integration ? { integration } : {}) }, retryable: true },
      );
    }
  }
  if (params.action === "delay") {
    if (!params.confirmed || !params.readyReceipt) throw new Error("Delay requires explicit operator authority and the exact Ready-for-Merge receipt");
    return { action: params.action, result: await actions.delay(params.readyReceipt, ctx, dependencies, { operatorDecision: "delay" }) };
  }
  if (params.action === "request-changes") {
    if (!params.confirmed || !params.readyReceipt) throw new Error("Request Changes requires explicit operator authority and the exact Ready-for-Merge receipt");
    let publication = params.changesProgress?.publication;
    let integration = params.changesProgress?.integration;
    try {
      publication ??= await actions.changesPublish(
        params.readyReceipt, ctx, dependencies, { operatorDecision: "request-changes" },
      );
      if (!integration || integration.pushError) {
        integration = await actions.changesIntegrate(publication, ctx, dependencies);
      }
      const resumed = await actions.changesResume(publication, integration, params.guidance ?? "", ctx, dependencies);
      return { action: params.action, changesReceipt: { publication, integration, ...resumed } };
    } catch (error) {
      const progress = { ...(publication ? { publication } : {}), ...(integration ? { integration } : {}) };
      throw new TaskEpisodeActionPhaseError(
        error instanceof Error ? error.message : String(error),
        (error instanceof HandoffFollowUpRejectedError || error instanceof EpisodeStateUncertainError)
          ? { action: params.action, changesProgress: progress, transportUncertain: true, retryable: false }
          : { action: params.action, changesProgress: progress, retryable: true },
      );
    }
  }
  if (params.action === "merge") {
    if (!params.confirmed || !params.readyReceipt) {
      throw new Error("Merge requires explicit confirmation and the exact Ready-for-Merge receipt");
    }
    const verified = params.readyReceipt.verification;
    const result = await actions.merge(params.readyReceipt, ctx, dependencies, {
      operatorDecision: "merge",
      taskId: verified.taskId,
      mainHead: verified.mainHead,
      refreshedEpisodeHead: verified.refreshedEpisodeHead,
    });
    return { action: params.action, terminalEvidence: { outcome: "merged", result } };
  }
  if (params.action === "abandon") {
    if (!params.confirmed) throw new Error("Abandon requires explicit operator confirmation");
    if (params.terminalEvidence) {
      if (params.terminalEvidence.outcome !== "abandoned" || !params.terminalEvidence.result.pushError) {
        throw new Error("Abandon replay requires exact unpushed abandonment terminal evidence");
      }
      const decision = params.terminalEvidence.decision;
      const result = await actions.abandon(ctx, dependencies, decision);
      return { action: params.action, terminalEvidence: { outcome: "abandoned", decision, result } };
    }
    if (!params.episodeHead || !params.finalSummary) {
      throw new Error("Abandon requires the exact pushed Episode head and truthful Final Summary");
    }
    const decision = actions.prepareAbandonment(
      taskId, params.episodeHead, params.finalSummary, ctx, dependencies,
    );
    const result = await actions.abandon(ctx, dependencies, decision);
    return { action: params.action, terminalEvidence: { outcome: "abandoned", decision, result } };
  }
  if (!params.confirmed || !params.terminalEvidence) {
    throw new Error("Cleanup requires separate explicit confirmation and exact terminal evidence");
  }
  const git = dependencies.git ?? new CliGitAdapter();
  const projectRoot = git.repositoryRoot(ctx.cwd);
  const terminalHead = params.terminalEvidence.outcome === "merged"
    ? params.terminalEvidence.result.mergedHead
    : params.terminalEvidence.result.episodeHead;
  const ownedCleanup = dependencies.taskCleanup ? undefined : new CliTaskEpisodeCleanupAdapter(projectRoot, terminalHead);
  const cleanup = dependencies.taskCleanup ?? ownedCleanup!;
  const cleanupDependencies = { ...dependencies, cleanup } as TaskEpisodeFinalizationDependencies;
  try {
    const decision = actions.prepareCleanup(taskId, params.terminalEvidence, ctx, cleanupDependencies);
    const result = await actions.cleanup(ctx, cleanupDependencies, decision, params.terminalEvidence);
    return { action: params.action, result };
  } finally {
    ownedCleanup?.close();
  }
}

export function createReviewedPlanExtension(dependencies?: ReviewedPlanDependencies) {
  return function reviewedPlan(pi: ExtensionAPI): void {
    const implementationApprovalBySession = new Map<string, ImplementationApproval>();
    const taskImplementationApprovals = dependencies?.taskImplementationApprovals
      ?? new TaskImplementationApprovalStore();
    const oversightOptions = { guideRoot: dependencies?.guideRoot };
    registerConversationOversight(pi, oversightOptions);
    registerPrepChainCommand(pi, {
      command: "plan-spec",
      description: "Plan a reviewed specification from an explicit .ralph/plans/future/<slug> folder",
      workflow: PLAN_PREP_WORKFLOW,
    });
    pi.registerCommand("plan", {
      description: "Plan one exact reviewed Backlog task in In Design or In Planning",
      handler: async (args, ctx) => {
        const result = await admitTaskPrepChain(
          pi,
          ctx,
          args,
          PLAN_TASK_PREP_WORKFLOW,
          "native",
          dependencies?.taskResolver,
        );
        if (!result.ok) ctx.ui.notify(result.message, result.level);
      },
    });
    registerPrepChainCommand(pi, {
      command: "implement-spec",
      description: "Review and promote an approved future bundle into an isolated implementation episode",
      workflow: IMPLEMENT_PREP_WORKFLOW,
      preflight: (ctx, location) => {
        assertConversationPromotionReady(ctx, location);
        const selected = validateFutureLocation(ctx.cwd, location);
        if (!selected) throw new Error("Validated implementation folder disappeared");
        return bundleContentDigest(selected.folder);
      },
      phasePreamble: () => conversationGuideText(oversightOptions),
      parseArgs: parseImplementationArgs,
      onValidated: (ctx, location, selection, bundleDigest) => {
        if (!bundleDigest) throw new Error("Implementation preflight did not bind the approved bundle");
        implementationApprovalBySession.set(ctx.sessionManager.getSessionId(), {
          location,
          ...(selection.host ? { host: selection.host } : {}),
          bundleDigest,
          skipNextAgentEnd: true,
        });
      },
    });
    pi.registerCommand("implement-task", {
      description: "Review and admit one exact planned Backlog task into an isolated implementation Episode",
      handler: async (args, ctx) => {
        const result = await admitTaskImplementationPrepChain(
          pi,
          ctx,
          args,
          taskImplementationApprovals,
          {
            taskResolver: dependencies?.taskResolver,
            placementResolver: dependencies?.placementResolver,
            placement: dependencies,
            guideRoot: dependencies?.guideRoot,
          },
        );
        if (!result.ok) ctx.ui.notify(result.message, result.level);
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
        const result = await admitPrepChain(
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

    pi.registerTool({
      name: "plan_task",
      label: "Plan reviewed Backlog task",
      description: "Queue the canonical task-native planning workflow for one exact Backlog task in In Design or In Planning. This creates or revises a plan only and never authorizes implementation.",
      promptSnippet: "Queue canonical planning for one exact reviewed Backlog task",
      promptGuidelines: [
        "Call plan_task only when the operator clearly asks to plan one exact Backlog task ID.",
        "Before calling plan_task, ask the operator if the task ID is missing or materially ambiguous; never search for, select, or invent a task.",
        "plan_task accepts only In Design or In Planning and never authorizes implementation or creates Episode resources.",
        "Treat plan_task as a terminal routing action: after successful admission, do not continue planning in the current turn.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "Exact Backlog task ID selected by the operator",
          },
        },
        required: ["taskId"],
        additionalProperties: false,
      } as any,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const result = await admitTaskPrepChain(
          pi,
          ctx,
          params.taskId,
          PLAN_TASK_PREP_WORKFLOW,
          "tool",
          dependencies?.taskResolver,
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
            text: `Planning admitted for ${result.taskId}: canonical plan-task-prep was steered and canonical plan-task was queued as the sole follow-up. Planning has not completed, and implementation is not authorized.`,
          }],
          details: { admitted: true, taskId: result.taskId },
        };
      },
    });

    pi.on("session_start", (_event, ctx) => {
      const sessionId = ctx.sessionManager.getSessionId();
      implementationApprovalBySession.delete(sessionId);
      taskImplementationApprovals.clear(sessionId);
    });
    pi.on("agent_end", (_event, ctx) => {
      const sessionId = ctx.sessionManager.getSessionId();
      taskImplementationApprovals.agentEnd(sessionId);
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
      const sessionId = ctx.sessionManager.getSessionId();
      implementationApprovalBySession.delete(sessionId);
      taskImplementationApprovals.clear(sessionId);
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
      name: "create_task_episode",
      label: "Create task Episode",
      description: "Create or return the one isolated Episode for the exact implementation-ready Backlog task admitted by the current /implement-task chain.",
      promptSnippet: "Create one exact task-native Episode after implementation readiness succeeds",
      promptGuidelines: [
        "Call create_task_episode exactly once only after the current /implement-task readiness workflow approves its exact In Planning task.",
        "Pass only the exact canonical task ID selected by the operator; placement is already bound by /implement-task and cannot be overridden here.",
        "The host publishes In Progress, reserves ownership, creates one Episode, and sends one fixed execute assignment; never add an initial handoff or second assignment.",
        "Treat uncertain or partial creation as a blocker. Never retry it as a fresh Episode.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: { taskId: { type: "string", description: "Exact canonical Backlog task ID admitted by /implement-task" } },
        required: ["taskId"],
        additionalProperties: false,
      } as any,
      async execute(toolCallId, params, _signal, _onUpdate, ctx) {
        const resolver = dependencies?.taskResolver ?? resolveBacklogTask;
        try {
          const task = resolver(ctx.cwd, params.taskId);
          if (!task) throw new Error(`Backlog task ${params.taskId} is unavailable`);
          const approval = taskImplementationApprovals.consume(ctx, task);
          if (!approval) throw new Error("no matching active /implement-task approval");
          const actions = { ...DEFAULT_TASK_ACTIONS, ...dependencies?.taskActions };
          const result = await actions.create(task.taskId, toolCallId, ctx, dependencies, approval.placement);
          return {
            content: [{ type: "text", text: `Task Episode created for ${result.taskId}. One fixed execute assignment was admitted to ${result.episodeId}.` }],
            details: result,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: "text", text: `Task Episode creation failed: ${message}` }], details: { error: message }, isError: true };
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
      name: "finalize_task_episode",
      label: "Advance or finalize task Episode lifecycle",
      description: "Apply one exact Conversation-owned task Episode lifecycle action, preserving review receipts and explicit operator authority for outcomes and cleanup.",
      promptSnippet: "Apply one guarded lifecycle action to the exact owned task Episode",
      promptGuidelines: [
        "Use finalize_task_episode only for one exact task-native Episode owned by this Conversation. Never use it for retained folder ownership.",
        "Use block only from an accepted pushed blocker report; resume only after accepting the unblock; accept-candidate only after accepting the exact pushed candidate.",
        "Delay, request-changes, and merge require the exact Ready receipt returned by accept-candidate and the operator's explicit decision.",
        "Abandon requires explicit operator confirmation, the exact pushed Episode head, and a truthful Final Summary. If its returned evidence has pushError, replay abandon only with that exact terminal evidence.",
        "Cleanup requires a separate explicit operator confirmation and the exact terminal evidence returned by Merge or Abandon. It alone may remove exact idle resources.",
        "If a phased action returns retryable progress, retry only with that exact receipt. If it reports transportUncertain or retryable false, inspect and never retry the lifecycle action.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["block", "resume", "accept-candidate", "delay", "request-changes", "merge", "abandon", "cleanup"] },
          taskId: { type: "string", description: "Exact canonical Backlog task ID owned by this Conversation" },
          episodeHead: { type: "string", description: "Exact pushed Episode head for block, resume, accepted candidate, or abandonment" },
          guidance: { type: "string", description: "Optional bounded handoff focus for resume or request-changes" },
          resumeProgress: { type: "object", description: "Exact partial resume progress returned after a failed handoff phase" },
          readyReceipt: { type: "object", description: "Exact Ready-for-Merge receipt returned by accept-candidate" },
          readyProgress: { type: "object", description: "Exact partial accept-candidate progress returned after a failed phase" },
          changesProgress: { type: "object", description: "Exact partial request-changes progress returned after a failed phase" },
          terminalEvidence: { type: "object", description: "Exact Merge or Abandon terminal evidence returned by this tool, also used only to replay an unpushed Abandon result" },
          finalSummary: { type: "string", description: "Truthful normalized non-success Final Summary for confirmed abandonment" },
          confirmed: { type: "boolean", description: "True only after the operator explicitly chooses Delay, Request Changes, Merge, Abandon, or destructive Cleanup" },
        },
        required: ["action", "taskId"],
        additionalProperties: false,
      } as any,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          const details = await runTaskEpisodeAction(params as TaskEpisodeActionParams, ctx, dependencies ?? {});
          return {
            content: [{ type: "text", text: `Task Episode ${params.action} completed for ${params.taskId}. Retain the returned receipt for the next authorized boundary.` }],
            details,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const details = error instanceof TaskEpisodeActionPhaseError
            ? { error: message, ...error.details }
            : { error: message, action: params.action, taskId: params.taskId };
          return { content: [{ type: "text", text: `Task Episode ${params.action} failed: ${message}` }], details, isError: true };
        }
      },
    });

    pi.registerTool({
      name: "handoff_task_episode",
      label: "Hand off task Episode",
      description: "Continue one exact owned idle task-native Episode after an accepted in-scope advance or recorded revision.",
      promptSnippet: "Hand off the exact task-native Episode and queue its next execute pass",
      promptGuidelines: [
        "Call handoff_task_episode only after this exact owner accepts an in-scope advance or recorded revision while the task remains In Progress.",
        "Pass only the exact canonical task ID and optional bounded focus. Never infer another task or copy Episode-owned task content.",
        "Never use ordinary handoff for Blocked, Ready for Merge, merge, abandonment, cleanup, consultation, pause, or scope expansion.",
        "Treat handoff as terminal routing. Never retry uncertain transport or claim compaction or execute completion from admission alone.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "Exact canonical Backlog task ID bound to the owned Episode" },
          guidance: { type: "string", description: "Optional bounded compaction focus inside the accepted scope" },
        },
        required: ["taskId"],
        additionalProperties: false,
      } as any,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          const actions = { ...DEFAULT_TASK_ACTIONS, ...dependencies?.taskActions };
          const result = await actions.handoff(params.taskId, params.guidance ?? "", ctx, dependencies);
          return {
            content: [{ type: "text", text: `Task Episode handoff admitted for ${result.taskId}: canonical handoff was admitted and execute queued as the sole follow-up.` }],
            details: result,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: "text", text: `Task Episode handoff failed: ${message}` }], details: { error: message }, isError: true };
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
