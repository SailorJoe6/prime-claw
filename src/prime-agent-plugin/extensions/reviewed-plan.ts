import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  bundleContentDigest,
  createSpecEpisode,
  createTaskEpisode,
  episodeResultText,
  finalizeTaskEpisodeCleanup,
  handoffSpecEpisode,
  handoffTaskEpisode,
  resolveTaskEpisodePlacement,
  restoreBlockedSpecEpisode,
  transitionSpecEpisodeToTaskOwnership,
  CliTaskEpisodeCleanupGit,
  type EpisodeDependencies,
  type EpisodeOwnershipTransitionDependencies,
  type TaskEpisodeAdmissionOptions,
  type TaskEpisodeCleanupDependencies,
  type TaskEpisodeCleanupOutcome,
  type TaskEpisodeCreationDependencies,
  type TaskEpisodeHandoffDependencies,
  type TaskEpisodePlacementDependencies,
} from "../extension-support/spec-episode.ts";
import { CliTaskEpisodeCleanupAdapter } from "../extension-support/task-episode-cleanup.ts";
import {
  admitPrepChain,
  admitProviderTaskPrepChain,
  type PrepChainWorkflow,
  type ProviderTaskPrepChainAdmissionResult,
  type ProviderTaskResolver,
  type TaskPrepChainWorkflow,
} from "../extension-support/prep-chain.ts";
import {
  assertConversationPromotionReady,
  conversationGuideText,
  registerConversationOversight,
} from "../extension-support/conversation-oversight.ts";
import { closeEpisodeOwnership } from "../extension-support/episode-close.ts";
import {
  resolveFutureLocationSyntax,
  validateFutureLocation,
  type BacklogTaskSelection,
} from "../extension-support/reviewed-plan-support.ts";
import { isLegacyEpisodeOwnership, readEpisodeOwnership, type LegacyEpisodeOwnershipRecord } from "../extension-support/episode-ownership.ts";
import {
  assertGrandfatheredLegacySpecificationFile,
  assertSafeLegacyFutureLocation,
} from "../extension-support/legacy-specification-inventory.ts";
import { assertLiveLegacyEpisodeFiles } from "../extension-support/legacy-workflow.ts";
import {
  resolveProviderTask,
  type ProviderTaskResolution,
} from "../extension-support/task-providers.ts";

function asBacklogProviderResolver(
  resolver: (cwd: string, rawTaskId: string) => BacklogTaskSelection | null,
): ProviderTaskResolver {
  return (cwd, rawTaskId) => {
    const selected = resolver(cwd, rawTaskId);
    return selected ? { provider: "backlog", ...selected } : null;
  };
}

function taskProviderResolver(
  dependencies: TaskImplementationAdmissionDependencies,
): ProviderTaskResolver {
  if (dependencies.providerTaskResolver) return dependencies.providerTaskResolver;
  if (dependencies.taskResolver) return asBacklogProviderResolver(dependencies.taskResolver);
  return resolveProviderTask;
}

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

function activeLegacyReplay(
  ctx: ExtensionContext,
  rawLocation: string,
): { projectRoot: string; location: string; record: LegacyEpisodeOwnershipRecord } | null {
  const selected = resolveFutureLocationSyntax(ctx.cwd, rawLocation);
  if (!selected) return null;
  assertSafeLegacyFutureLocation(selected.projectRoot, selected.location, true);
  const record = readEpisodeOwnership(selected.projectRoot, ctx.sessionManager.getSessionId());
  if (!record || !isLegacyEpisodeOwnership(record) || record.status !== "active"
    || record.sourceLocation !== selected.location) return null;
  const files = assertLiveLegacyEpisodeFiles(record, "Retained Episode replay");
  assertGrandfatheredLegacySpecificationFile(selected.projectRoot, record.sourceLocation, files.specification);
  return { projectRoot: selected.projectRoot, location: selected.location, record };
}

type TaskImplementationApprovalBase = {
  ownerSessionId: string;
  taskId: string;
  projectRoot: string;
  placement: TaskEpisodeAdmissionOptions;
  skipNextAgentEnd: boolean;
};

export type TaskImplementationApproval =
  | (TaskImplementationApprovalBase & { provider: "backlog"; taskPath: string })
  | (TaskImplementationApprovalBase & { provider: "beads"; taskPath?: never });

/** One-turn, single-use authority for the exact task and preselected placement. */
export class TaskImplementationApprovalStore {
  private readonly approvals = new Map<string, TaskImplementationApproval>();

  grant(
    ctx: ExtensionContext,
    task: ProviderTaskResolution,
    placement: TaskEpisodeAdmissionOptions,
  ): void {
    const ownerSessionId = ctx.sessionManager.getSessionId();
    const common = {
      ownerSessionId,
      taskId: task.taskId,
      projectRoot: task.projectRoot,
      placement: { ...placement },
      skipNextAgentEnd: true,
    };
    this.approvals.set(ownerSessionId, task.provider === "backlog"
      ? { ...common, provider: "backlog", taskPath: task.taskPath }
      : { ...common, provider: "beads" });
  }

  consume(
    ctx: ExtensionContext,
    task: ProviderTaskResolution,
  ): TaskImplementationApproval | null {
    const ownerSessionId = ctx.sessionManager.getSessionId();
    const approval = this.approvals.get(ownerSessionId);
    if (!approval || approval.skipNextAgentEnd
      || approval.ownerSessionId !== ownerSessionId
      || approval.provider !== task.provider
      || approval.taskId !== task.taskId
      || approval.projectRoot !== task.projectRoot
      || (approval.provider === "backlog"
        && (task.provider !== "backlog" || approval.taskPath !== task.taskPath))) return null;
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
  /** Backlog-only compatibility injection used by existing callers and tests. */
  taskResolver?: (cwd: string, taskId: string) => BacklogTaskSelection | null;
  providerTaskResolver?: ProviderTaskResolver;
  placementResolver?: typeof resolveTaskEpisodePlacement;
  placement?: TaskEpisodePlacementDependencies;
  guideRoot?: string;
}

/** Admit the provider-native compact-first planning chain for one exact task. */
export async function admitTaskPlanningPrepChain(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  rawTaskId: string,
  source: "native" | "tool",
  dependencies: Pick<TaskImplementationAdmissionDependencies, "taskResolver" | "providerTaskResolver"> = {},
): Promise<ProviderTaskPrepChainAdmissionResult> {
  const exactInput = rawTaskId.trim();
  return admitProviderTaskPrepChain(
    pi,
    ctx,
    rawTaskId,
    PLAN_TASK_PREP_WORKFLOW,
    source,
    taskProviderResolver(dependencies),
    async (_callCtx, task) => {
      if (task.provider === "beads" && task.taskId !== exactInput) {
        throw new Error(`Beads task ${exactInput} resolved to a different canonical ID ${task.taskId}`);
      }
      if (task.provider === "beads" && task.nativeStatus !== "in_design" && task.nativeStatus !== "in_planning") {
        throw new Error(`Beads task ${task.taskId} must be In Design/in_design or In Planning/in_planning for planning`);
      }
    },
    undefined,
    "planning",
  );
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
): Promise<ProviderTaskPrepChainAdmissionResult> {
  const parsed = parseTaskImplementationArgs(args);
  if (!parsed) return { ok: false, message: IMPLEMENT_TASK_USAGE, level: "warning" };
  let selected: ProviderTaskResolution | undefined;
  let placement: TaskEpisodeAdmissionOptions | undefined;
  const result = await admitProviderTaskPrepChain(
    pi,
    ctx,
    parsed.taskId,
    IMPLEMENT_TASK_PREP_WORKFLOW,
    "native",
    taskProviderResolver(dependencies),
    async (callCtx, task) => {
      if (task.provider === "beads" && task.taskId !== parsed.taskId) {
        throw new Error(`Beads task ${parsed.taskId} resolved to a different canonical ID ${task.taskId}`);
      }
      if (task.provider === "beads" && task.nativeStatus !== "in_planning") {
        throw new Error(`Beads task ${task.taskId} must be In Planning/in_planning for implementation admission`);
      }
      selected = task;
      const resolvePlacement = dependencies.placementResolver ?? resolveTaskEpisodePlacement;
      placement = await resolvePlacement(task.projectRoot, parsed.host, callCtx, dependencies.placement);
    },
    conversationGuideText({ guideRoot: dependencies.guideRoot }),
  );
  if (result.ok) {
    if (!selected || !placement) throw new Error("Task implementation admission lost its exact provider and placement binding");
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
    sourceAbsentReplay?: (ctx: ExtensionContext, rawLocation: string) => { projectRoot: string; location: string } | null;
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
        options.sourceAbsentReplay,
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
  cleanup: typeof finalizeTaskEpisodeCleanup;
};

const DEFAULT_TASK_ACTIONS: TaskEpisodePublicActions = {
  create: createTaskEpisode,
  handoff: handoffTaskEpisode,
  cleanup: finalizeTaskEpisodeCleanup,
};

type ReviewedPlanDependencies = EpisodeDependencies & EpisodeOwnershipTransitionDependencies & TaskEpisodeCreationDependencies & TaskEpisodeHandoffDependencies & {
  createEpisode?: typeof createSpecEpisode;
  restoreBlockedEpisode?: typeof restoreBlockedSpecEpisode;
  handoffEpisode?: typeof handoffSpecEpisode;
  transitionLegacyOwnership?: typeof transitionSpecEpisodeToTaskOwnership;
  taskResolver?: (cwd: string, rawTaskId: string) => BacklogTaskSelection | null;
  taskImplementationApprovals?: TaskImplementationApprovalStore;
  placementResolver?: typeof resolveTaskEpisodePlacement;
  taskActions?: Partial<TaskEpisodePublicActions>;
  taskCleanup?: TaskEpisodeCleanupDependencies["cleanup"];
  taskCleanupGit?: TaskEpisodeCleanupDependencies["cleanupGit"];
  taskCleanupBeadsTransport?: TaskEpisodeCleanupDependencies["beadsTransport"];
  taskCleanupBeadsTaskReader?: TaskEpisodeCleanupDependencies["beadsTaskReader"];
  taskCleanupBeadsRevisionIsAncestor?: TaskEpisodeCleanupDependencies["beadsRevisionIsAncestor"];
};

type TaskEpisodeCleanupParams = {
  taskId: string;
  episodeHead: string;
  outcome: TaskEpisodeCleanupOutcome;
  confirmed: boolean;
};

function requireLiveImplementationTask(selection: ProviderTaskResolution): void {
  if (selection.status !== "In Planning") {
    throw new Error(`Task ${selection.taskId} is ${selection.status}; implementation requires In Planning`);
  }
  if (selection.provider === "beads") {
    if (selection.nativeStatus !== "in_planning") {
      throw new Error(`Beads task ${selection.taskId} must remain In Planning/in_planning`);
    }
    if (typeof selection.nativeView.design !== "string" || !selection.nativeView.design.trim()) {
      throw new Error(`Beads task ${selection.taskId} has no readable provider-native design`);
    }
    return;
  }
  if (typeof selection.implementationPlan !== "string" || !selection.implementationPlan.trim()) {
    throw new Error(`Backlog task ${selection.taskId} has no readable Implementation Plan`);
  }
}

function placementHost(placement: TaskEpisodeAdmissionOptions): string | undefined {
  return placement.engine === "orca" ? `id:${placement.projectSetupId}` : undefined;
}

function samePlacement(left: TaskEpisodeAdmissionOptions, right: TaskEpisodeAdmissionOptions): boolean {
  return left.engine === right.engine
    && left.projectSetupId === right.projectSetupId
    && left.routingEnvironmentId === right.routingEnvironmentId;
}

async function runTaskEpisodeCleanup(
  params: TaskEpisodeCleanupParams,
  ctx: ExtensionContext,
  dependencies: ReviewedPlanDependencies,
): Promise<Record<string, unknown>> {
  const taskId = params.taskId.trim();
  if (!taskId || /\s/.test(taskId) || taskId.startsWith("-")) {
    throw new Error("Task Episode cleanup requires one exact provider-native task ID");
  }
  if (!params.confirmed) throw new Error("Task Episode cleanup requires separate explicit operator confirmation");
  const cleanupGit = dependencies.taskCleanupGit ?? new CliTaskEpisodeCleanupGit();
  const projectRoot = cleanupGit.repositoryRoot(ctx.cwd);
  const ownedCleanup = dependencies.taskCleanup
    ? undefined
    : new CliTaskEpisodeCleanupAdapter(projectRoot, params.episodeHead);
  const cleanup = dependencies.taskCleanup ?? ownedCleanup!;
  const actions = { ...DEFAULT_TASK_ACTIONS, ...dependencies.taskActions };
  try {
    const result = await actions.cleanup(
      taskId,
      params.episodeHead,
      params.outcome,
      ctx,
      {
        cleanup,
        cleanupGit,
        ...(dependencies.ownership ? { ownership: dependencies.ownership } : {}),
        ...(dependencies.taskRunner ? { taskRunner: dependencies.taskRunner } : {}),
        ...(dependencies.taskResolver ? { taskResolver: dependencies.taskResolver } : {}),
        ...(dependencies.taskCleanupBeadsTransport ? { beadsTransport: dependencies.taskCleanupBeadsTransport } : {}),
        ...(dependencies.taskCleanupBeadsTaskReader ? { beadsTaskReader: dependencies.taskCleanupBeadsTaskReader } : {}),
        ...(dependencies.taskCleanupBeadsRevisionIsAncestor
          ? { beadsRevisionIsAncestor: dependencies.taskCleanupBeadsRevisionIsAncestor } : {}),
        ...(dependencies.now ? { now: dependencies.now } : {}),
      },
    );
    return { result };
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
      description: "Plan one exact reviewed provider-native task in In Design or In Planning",
      handler: async (args, ctx) => {
        const result = await admitTaskPlanningPrepChain(pi, ctx, args, "native", dependencies);
        if (!result.ok) ctx.ui.notify(result.message, result.level);
      },
    });
    registerPrepChainCommand(pi, {
      command: "implement-spec",
      description: "Review and promote an approved future bundle into an isolated implementation episode",
      workflow: IMPLEMENT_PREP_WORKFLOW,
      preflight: (ctx, location) => {
        assertConversationPromotionReady(ctx, location);
        const replay = activeLegacyReplay(ctx, location);
        if (replay) return replay.record.bundleDigest;
        const selected = validateFutureLocation(ctx.cwd, location);
        if (!selected) throw new Error("Validated implementation folder disappeared");
        return bundleContentDigest(selected.folder);
      },
      phasePreamble: () => conversationGuideText(oversightOptions),
      parseArgs: parseImplementationArgs,
      sourceAbsentReplay: (ctx, location) => {
        const replay = activeLegacyReplay(ctx, location);
        return replay ? { projectRoot: replay.projectRoot, location: replay.location } : null;
      },
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
      description: "Review and admit one exact planned provider-native task into an isolated implementation Episode",
      handler: async (args, ctx) => {
        const result = await admitTaskImplementationPrepChain(
          pi,
          ctx,
          args,
          taskImplementationApprovals,
          {
            taskResolver: dependencies?.taskResolver,
            providerTaskResolver: dependencies?.providerTaskResolver,
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
      label: "Plan reviewed provider-native task",
      description: "Queue the canonical task-native planning workflow for one exact provider-native task in In Design or In Planning. This creates or revises a plan only and never authorizes implementation.",
      promptSnippet: "Queue canonical planning for one exact reviewed provider-native task",
      promptGuidelines: [
        "Call plan_task only when the operator clearly asks to plan one exact provider-native task ID.",
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
            description: "Exact provider-native task ID selected by the operator",
          },
        },
        required: ["taskId"],
        additionalProperties: false,
      } as any,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const result = await admitTaskPlanningPrepChain(pi, ctx, params.taskId, "tool", dependencies);
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
      promptSnippet: "Promote one reviewed future-plan folder or return its exact active retained Episode",
      promptGuidelines: [
        "Call create_spec_episode only after the current implement-spec readiness workflow finds its exact selected bundle complete and implementation-ready, or verifies an exact active retained replay whose obsolete source folder is absent.",
        "Pass create_spec_episode only the exact operator-selected future-folder source location.",
        "Fresh creation makes one fresh Episode with one fixed execute assignment; an exact active replay preserves its resources and sends no assignment; never send an initial handoff or a second assignment.",
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
      description: "Create or return the one isolated Episode for the exact provider-native task admitted by the current /implement-task chain.",
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
        properties: { taskId: { type: "string", description: "Exact canonical provider-native task ID admitted by /implement-task" } },
        required: ["taskId"],
        additionalProperties: false,
      } as any,
      async execute(toolCallId, params, _signal, _onUpdate, ctx) {
        const resolver = taskProviderResolver(dependencies ?? {});
        try {
          const task = resolver(ctx.cwd, params.taskId);
          if (!task) throw new Error(`Task ${params.taskId} is unavailable through the live provider`);
          if (task.provider === "beads" && task.taskId !== params.taskId) {
            throw new Error(`Beads task ${params.taskId} resolved to a different canonical ID ${task.taskId}`);
          }
          requireLiveImplementationTask(task);
          const approval = taskImplementationApprovals.consume(ctx, task);
          if (!approval) throw new Error("no matching active /implement-task approval");
          const resolvePlacement = dependencies?.placementResolver ?? resolveTaskEpisodePlacement;
          const currentPlacement = await resolvePlacement(
            task.projectRoot,
            placementHost(approval.placement),
            ctx,
            dependencies,
          );
          if (!samePlacement(currentPlacement, approval.placement)) {
            throw new Error("the preselected task Episode placement changed after /implement-task approval");
          }
          const actions = { ...DEFAULT_TASK_ACTIONS, ...dependencies?.taskActions };
          const result = await actions.create(task.taskId, toolCallId, ctx, dependencies, approval.placement);
          return {
            content: [{
              type: "text",
              text: `Task Episode created for ${result.taskId}. One fixed execute assignment was admitted to ${result.episodeId}. Exact provider-native result: ${JSON.stringify(result)}`,
            }],
            details: result,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: "text", text: `Task Episode creation failed: ${message}` }], details: { error: message }, isError: true };
        }
      },
    });

    pi.registerTool({
      name: "transition_spec_episode_to_task",
      label: "Transition specification Episode ownership to task",
      description: "Atomically replace one exact live version-1 Episode authority binding with its reviewed task-native binding without changing or recreating Episode resources.",
      promptSnippet: "Transition one exact reviewed specification Episode to task-native ownership",
      promptGuidelines: [
        "Call transition_spec_episode_to_task only after the bridge candidate was separately reviewed, merged to canonical primary main, activated user-globally, followed by a full restart, and proven by UAT.",
        "The exact owning Conversation must pass the retained source location, canonical task ID, reviewed primary-main HEAD, and reviewed Episode HEAD, and set confirmedReady true only after all prerequisites are true.",
        "The transition changes ownership authority only. It must preserve the same Episode, session, worktree, branch, and Orca resources and keep the active plan pair present.",
        "Any foreign owner, drift, partial identity, dirty checkout, unsafe ancestry, task mismatch, unavailable evidence, or different replay is a blocker. Never repair or infer values inside this tool.",
        "A successful same-binding replay is idempotent. After success, continue only through task-native lifecycle surfaces; plan deletion remains a separate reviewed step.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "Exact retained .ralph/plans/future/<slug> source bound by active version-1 ownership" },
          taskId: { type: "string", description: "Exact canonical Backlog task ID that supersedes the retained bundle" },
          mainHead: { type: "string", description: "Exact reviewed and activated canonical primary-main HEAD" },
          episodeHead: { type: "string", description: "Exact reviewed clean Episode branch HEAD merged into main" },
          confirmedReady: { type: "boolean", description: "True only after separate review, merge, global activation, full restart, and successful UAT" },
        },
        required: ["location", "taskId", "mainHead", "episodeHead", "confirmedReady"],
        additionalProperties: false,
      } as any,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          const transition = dependencies?.transitionLegacyOwnership ?? transitionSpecEpisodeToTaskOwnership;
          const result = await transition(
            params.location,
            params.taskId,
            params.episodeHead,
            params.mainHead,
            params.confirmedReady,
            ctx,
            dependencies,
          );
          return {
            content: [{ type: "text", text: result.reused
              ? `Episode ownership already has the exact task-native binding for ${result.record.taskId}; no state changed.`
              : `Episode ownership transitioned atomically to task-native authority for ${result.record.taskId}. The same Episode resources were preserved.` }],
            details: result,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: "text", text: `Episode ownership transition failed: ${message}` }], details: { error: message }, isError: true };
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
        "This is a no-UI bookkeeping close. It performs no Git, merge, abandonment, session, worktree, branch, plan archival, or cleanup action.",
        "Keep the active legacy plan pair in place until this bookkeeping close succeeds; plan archival is outside this tool and this repair and requires separate explicit post-terminal legacy authority.",
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
      label: "Clean up task Episode resources",
      description: "After an operator-authorized merge or abandonment is committed and pushed, remove the exact idle Episode resources and close ownership.",
      promptSnippet: "Clean up the exact terminal task Episode after separate operator authority",
      promptGuidelines: [
        "Use finalize_task_episode only for one exact task-native Episode owned by this Conversation. Never use it for retained folder ownership.",
        "Perform review, request changes, merge, abandonment, and provider-native terminal publication through the Conversation instructions, ordinary Git, and the selected provider's supported CLI before cleanup.",
        "Call this tool only after separate explicit operator cleanup authority, with the exact pushed Episode head and truthful terminal outcome. Backlog requires its pushed Done/archive terminal evidence; Beads requires current clean published native done completion or closed plus the exact abandonment reason.",
        "Cleanup removes only the bound idle runtime, worktree, and branch, then closes ownership. It performs no merge, abandonment, task edit, archive, provider push, shared-store removal, or server shutdown.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "Exact canonical provider-native task ID owned by this Conversation" },
          episodeHead: { type: "string", description: "Exact pushed Episode head that was merged or abandoned" },
          outcome: { type: "string", enum: ["merged", "abandoned"], description: "Terminal outcome already committed and pushed on canonical main" },
          confirmed: { type: "boolean", description: "True only after separate explicit operator authority for destructive cleanup" },
        },
        required: ["taskId", "episodeHead", "outcome", "confirmed"],
        additionalProperties: false,
      } as any,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          const details = await runTaskEpisodeCleanup(params as TaskEpisodeCleanupParams, ctx, dependencies ?? {});
          return {
            content: [{ type: "text", text: `Task Episode resources removed and ownership closed for ${params.taskId}.` }],
            details,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: "text", text: `Task Episode cleanup failed: ${message}` }], details: { error: message, taskId: params.taskId }, isError: true };
        }
      },
    });

    pi.registerTool({
      name: "handoff_task_episode",
      label: "Hand off task Episode",
      description: "Continue one exact owned idle task-native Episode within its approved scope.",
      promptSnippet: "Hand off the exact task-native Episode and queue its next execute pass",
      promptGuidelines: [
        "Call handoff_task_episode only when this exact owner selects continuation while the task remains In Progress.",
        "Pass only the exact canonical task ID and optional bounded focus. Guidance never supplies provider revision or raw task authority.",
        "For active Beads ownership, exact previous/current native task observations are factual LLM context, not a semantic approval gate; compatible same-task changes and unrelated descendants continue normally.",
        "Never use ordinary handoff for Blocked, merge, abandonment, cleanup, consultation, pause, or scope expansion.",
        "Treat handoff as terminal routing. Never retry uncertain transport or claim compaction or execute completion from admission alone.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "Exact canonical provider-native task ID bound to the owned Episode" },
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
      name: "restore_blocked_spec_episode",
      label: "Restore blocked specification episode",
      description: "After the operator explicitly clears the recorded blocker, restore only the exact blocked plan pair for the persisted active version-1 Episode and revalidate its same worktree identity.",
      promptSnippet: "Restore one exact operator-cleared blocked version-1 Episode plan pair",
      promptGuidelines: [
        "Call restore_blocked_spec_episode only after the operator explicitly decides that the recorded unblock condition is satisfied.",
        "Pass only the exact retained future-folder location already bound by active version-1 ownership and set confirmedUnblocked true; never search, infer another Episode, or use this for version 2.",
        "The host requires the canonical primary main Conversation, exact owner, active version-1 record, recorded worktree and branch, absent active pair, one unambiguous readable regular blocked pair, and collision-free destinations.",
        "A successful restore re-reads unchanged ownership and revalidates live active identity. Only then may ordinary handoff continue the same Episode; never create, promote, or fall through to task-native mode.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "Exact .ralph/plans/future/<slug> folder owned by the blocked version-1 Episode" },
          confirmedUnblocked: { type: "boolean", description: "True only after the operator explicitly accepts the recorded unblock condition" },
        },
        required: ["location", "confirmedUnblocked"],
        additionalProperties: false,
      } as any,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          const restoreEpisode = dependencies?.restoreBlockedEpisode ?? restoreBlockedSpecEpisode;
          const result = await restoreEpisode(params.location, params.confirmedUnblocked, ctx, dependencies);
          return {
            content: [{ type: "text", text: `Blocked Episode plan pair restored for ${result.sourceLocation}. Active identity was revalidated in the same recorded worktree; ordinary handoff may now continue that Episode.` }],
            details: result,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: "text", text: `Blocked Episode restore failed: ${message}` }], details: { error: message }, isError: true };
        }
      },
    });

    pi.registerTool({
      name: "handoff_spec_episode",
      label: "Hand off specification episode",
      description: "Continue one exact owned idle episode after its owner accepts an in-scope advance, recorded revision, or operator-cleared blocked recovery whose active identity was revalidated: run canonical handoff, then queue canonical execute as its sole follow-up.",
      promptSnippet: "Hand off an exact owned Ralph episode and queue its next execute pass",
      promptGuidelines: [
        "Call handoff_spec_episode only when this exact owner has selected advance after candidate acceptance, revise from accepted findings already recorded inside the approved scope, or continuation after the operator accepted the exact recorded unblock and the restored active version-1 plan identity was revalidated; no new operator transport request is required.",
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
