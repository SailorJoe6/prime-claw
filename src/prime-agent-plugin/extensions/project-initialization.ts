import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  acceptProjectOverride,
  isOrcaRegistered,
  reconcilePrimeClawProject,
  resetProjectAsset,
  resolveNearestProjectRoot,
  type ReconcileOptions,
  type ReconcileResult,
} from "../extension-support/project-initialization.ts";
import { prepareTaskHistoryWorkspace } from "../extension-support/task-history-workspace.ts";
import {
  inspectTaskProviderMigration,
  migrateTaskProvider,
  type ProviderMigrationInspection,
  type ProviderMigrationOptions,
  type ProviderMigrationResult,
} from "../extension-support/task-provider-migration.ts";
import { verifyActiveTaskEpisodeContinuity } from "../extension-support/spec-episode.ts";
import {
  finishTemplateReview,
  recoverTemplateReview,
  requestTemplateReview,
  startTemplateReview,
} from "../extension-support/template-review.ts";

type Action = "reconcile" | "accept-override" | "reset" | "review-request" | "review-start" | "review-complete" | "review-cancel" | "review-restore" | "review-keep" | "switch-request" | "switch-confirm";

export function summarizeReconcile(result: ReconcileResult, detailed = false): string {
  if (result.skippedActiveEpisode) {
    return result.skipReason === "uncertain-episode-activity"
      ? `Prime Claw reconciliation skipped ${result.project.root}: Episode activity could not be proven inactive`
      : `Prime Claw reconciliation skipped active Episode worktree ${result.project.root}`;
  }
  const counts = new Map<string, number>();
  for (const item of result.items) counts.set(item.action, (counts.get(item.action) ?? 0) + 1);
  const actions = [...counts.entries()].map(([name, count]) => `${name}=${count}`).join(" ");
  const registration = result.registration.status === "unavailable"
    ? `orca=degraded(${result.registration.error ?? "unavailable"})`
    : `orca=${result.registration.status}${result.registration.id ? `:${result.registration.id}` : ""}`;
  const provider = result.taskProvider.status === "initialized"
    ? `provider=initialized(${result.taskProvider.provider})`
    : result.taskProvider.status === "selected"
      ? `provider=selected(${result.taskProvider.provider})`
      : result.taskProvider.status === "blocked"
        ? `provider=blocked(${result.taskProvider.code}: ${result.taskProvider.detail} ${result.taskProvider.remediation})`
        : result.taskProvider.status === "failed"
          ? `provider=failed(${result.taskProvider.detail})`
          : "provider=not-run";
  const legacy = result.legacySpecifications.status === "created"
    ? `legacy-specs=created(${result.legacySpecifications.accepted})`
    : result.legacySpecifications.status === "verified"
      ? `legacy-specs=verified(${result.legacySpecifications.accepted})`
      : result.legacySpecifications.status === "required"
        ? "legacy-specs=explicit-initialization-required"
        : result.legacySpecifications.status === "blocked"
          ? `legacy-specs=blocked(${result.legacySpecifications.detail})`
          : `legacy-specs=${result.legacySpecifications.status}`;
  const warnings = (result.warnings ?? []).map((warning) => `Warning: ${warning}`);
  const base = [`Prime Claw project ${result.project.root} (${result.project.kind}): ${actions || "no-assets"} conflicts=${result.conflicts} ${registration} ${provider} ${legacy}`, ...warnings].join("\n");
  if (!detailed || result.conflicts === 0) return base;
  const unresolved = result.items.filter((item) => item.action === "preserved" || item.action === "blocked");
  const lines = unresolved.map((item) => item.action === "preserved"
    ? `- ${item.assetId} (${item.destination}): ${item.reason ?? item.action}; review with /initialize-prime-claw --review ${item.assetId}`
    : `- ${item.assetId} (${item.destination}): ${item.reason ?? item.action}; resolve the collision, then rerun /initialize-prime-claw`);
  if (result.legacySpecifications.status === "required") {
    lines.push("- unfinished retained legacy specifications are not inventoried; run explicit /initialize-prime-claw once, then use selected-provider tasks for new work");
  } else if (result.legacySpecifications.status === "blocked") {
    lines.push(`- ${result.legacySpecifications.path}: ${result.legacySpecifications.detail}; repair the inventory without rebaselining specifications`);
  } else if (result.legacySpecifications.status === "verified") {
    for (const violation of result.legacySpecifications.violations) {
      lines.push(`- ${violation.location}: ${violation.reason === "specification-changed" ? "grandfathered specification changed; restore its accepted digest" : "not grandfathered; use the selected-provider task UX"}`);
    }
  }
  const visible = lines.slice(0, 8);
  const omitted = Math.max(0, result.conflicts - visible.length);
  return `${base}\n${visible.join("\n")}${omitted > 0 ? `\n- ${omitted} more unresolved item(s); use initialize_prime_claw action=reconcile for full details` : ""}`;
}

function actionSummary(value: unknown, detailed = true): string {
  if (value && typeof value === "object" && "items" in value) return summarizeReconcile(value as ReconcileResult, detailed);
  if (value && typeof value === "object" && typeof (value as any).message === "string") return (value as any).message;
  if (value && typeof value === "object" && (value as any).fallback) {
    const diff = typeof (value as any).diff === "string" && (value as any).diff.trim() ? (value as any).diff.trimEnd() : "(no textual differences)";
    return `Prime Claw review restored cleanly; ${(value as any).fallback} fallback:
${diff}`;
  }
  if (value && typeof value === "object" && (value as any).status === "ready" && "sourceRevision" in (value as any)) {
    const migration = value as ProviderMigrationInspection;
    return `Prime Claw provider-switch inspection ready: ${migration.sourceProvider}->${migration.targetProvider} source=${migration.sourceRevision} digest=${migration.sourceDigest} tasks(open=${migration.taskCounts.open},closed=${migration.taskCounts.closed},archived=${migration.taskCounts.archived},total=${migration.taskCounts.total}) active-owners=${migration.activeOwnership.length}. Semantic placement: ${migration.semanticPlacementPrompt} Confirmation: ${migration.confirmation}`;
  }
  if (value && typeof value === "object" && (value as any).status === "completed" && "receipt" in (value as any)) {
    const migration = value as Extract<ProviderMigrationResult, { status: "completed" }>;
    return `Prime Claw provider switch completed: ${migration.receipt.sourceProvider}->${migration.receipt.targetProvider} source=${migration.receipt.sourceRevision} destination=${migration.receipt.destinationReceiptRevision} receipt=${migration.receiptTaskId} source-absent=true`;
  }
  if (value && typeof value === "object" && (value as any).status === "blocked" && "code" in (value as any) && "targetProvider" in (value as any)) {
    const migration = value as Extract<ProviderMigrationResult, { status: "blocked" }>;
    return `Prime Claw provider switch blocked (${migration.code}): ${migration.detail}; ${migration.remediation}`;
  }
  return "Prime Claw initialization action completed";
}

function toolResult(value: unknown, text?: string, isError = false) {
  return {
    content: [{ type: "text" as const, text: text ?? JSON.stringify(value, null, 2) }],
    details: value,
    ...(isError ? { isError: true } : {}),
  };
}

type ProjectInitializationDependencies = Omit<ReconcileOptions, "cwd" | "registerOrca" | "requireOrcaRegistration"> & {
  migrationInspector?: typeof inspectTaskProviderMigration;
  migrationRunner?: typeof migrateTaskProvider;
  migrationRuntimeVerifier?: ProviderMigrationOptions["verifyActiveRuntime"];
};

interface ActionArguments {
  assetId?: string;
  ready: boolean;
  visible: boolean;
  targetProvider?: "backlog" | "beads";
  expectedSourceRevision?: string;
  confirmedSwitch: boolean;
  actor?: string;
  semanticPlacement?: string;
  beadsNativePlacements?: ProviderMigrationOptions["beadsNativePlacements"];
  unpublishedLocalOnly: boolean;
}

function productionReconcileOptions(dependencies: ProjectInitializationDependencies, unpublishedLocalOnly = false) {
  return {
    ...dependencies,
    taskHistoryPreparer: (input) => (dependencies.taskHistoryPreparer ?? prepareTaskHistoryWorkspace)({ ...input, unpublishedLocalOnly }),
  };
}

async function executeAction(action: Action, args: ActionArguments, ctx: ExtensionContext, dependencies: ProjectInitializationDependencies) {
  switch (action) {
    case "reconcile": return reconcilePrimeClawProject({
      ...productionReconcileOptions(dependencies, args.unpublishedLocalOnly), cwd: ctx.cwd, registerOrca: true, legacyInventoryMode: "initialize",
    });
    case "accept-override":
      if (!args.assetId) throw new Error("accept-override requires assetId");
      return { assetId: args.assetId, entry: acceptProjectOverride(ctx.cwd, args.assetId, dependencies) };
    case "reset":
      if (!args.assetId) throw new Error("reset requires assetId");
      return { assetId: args.assetId, entry: resetProjectAsset(ctx.cwd, args.assetId, dependencies) };
    case "review-request":
      if (!args.assetId) throw new Error("review-request requires assetId");
      return requestTemplateReview(ctx.cwd, args.assetId, dependencies);
    case "review-start":
      if (!args.assetId) throw new Error("review-start requires assetId");
      return startTemplateReview(ctx.cwd, args.assetId, args.ready, dependencies);
    case "review-complete": return finishTemplateReview(ctx.cwd, "complete", args.visible, dependencies);
    case "review-cancel": return finishTemplateReview(ctx.cwd, "cancel", false, dependencies);
    case "review-restore": return recoverTemplateReview(ctx.cwd, "restore", dependencies);
    case "review-keep": return recoverTemplateReview(ctx.cwd, "keep", dependencies);
    case "switch-request":
      if (!args.targetProvider) throw new Error("switch-request requires targetProvider");
      return (dependencies.migrationInspector ?? inspectTaskProviderMigration)({
        cwd: ctx.cwd, targetProvider: args.targetProvider, runner: dependencies.runner,
      });
    case "switch-confirm":
      if (!args.targetProvider) throw new Error("switch-confirm requires targetProvider");
      if (!args.expectedSourceRevision) throw new Error("switch-confirm requires expectedSourceRevision");
      return (dependencies.migrationRunner ?? migrateTaskProvider)({
        cwd: ctx.cwd,
        targetProvider: args.targetProvider,
        expectedSourceRevision: args.expectedSourceRevision,
        confirmedSwitch: args.confirmedSwitch,
        actor: args.actor ?? "",
        semanticPlacement: args.semanticPlacement ?? "",
        beadsNativePlacements: args.beadsNativePlacements,
        runner: dependencies.runner,
        verifyActiveRuntime: dependencies.migrationRuntimeVerifier ?? ((records) => {
          const project = resolveNearestProjectRoot(ctx.cwd, process.env.HOME ?? "", dependencies.runner);
          return verifyActiveTaskEpisodeContinuity(project.root, records);
        }),
      });
  }
}

function parseCommand(raw: string): { action: Action; args: ActionArguments } {
  const values = raw.trim() ? raw.trim().split(/\s+/) : [];
  const defaults: ActionArguments = { ready: false, visible: false, confirmedSwitch: false, unpublishedLocalOnly: false };
  if (!values.length) return { action: "reconcile", args: defaults };
  if (values[0] === "--unpublished-local-only") {
    if (values.length !== 1) throw new Error("usage: /initialize-prime-claw --unpublished-local-only");
    return { action: "reconcile", args: { ...defaults, unpublishedLocalOnly: true } };
  }
  if (values[0] === "--switch-request") {
    if (values.length !== 2 || !["backlog", "beads"].includes(values[1])) throw new Error("usage: /initialize-prime-claw --switch-request <backlog|beads>");
    return { action: "switch-request", args: { ...defaults, targetProvider: values[1] as "backlog" | "beads" } };
  }
  if (values[0] === "--switch-confirm") {
    if (values.length < 5 || !["backlog", "beads"].includes(values[1])) {
      throw new Error("usage: /initialize-prime-claw --switch-confirm <backlog|beads> <exact-source-revision> <actor> <semantic-placement-prose>");
    }
    return {
      action: "switch-confirm",
      args: {
        ...defaults,
        targetProvider: values[1] as "backlog" | "beads",
        expectedSourceRevision: values[2],
        actor: values[3],
        semanticPlacement: values.slice(4).join(" "),
        confirmedSwitch: true,
      },
    };
  }
  const actions: Record<string, Action> = {
    "--accept-override": "accept-override",
    "--reset": "reset",
    "--review": "review-request",
    "--review-ready": "review-start",
    "--review-complete": "review-complete",
    "--review-cancel": "review-cancel",
    "--review-restore": "review-restore",
    "--review-keep": "review-keep",
  };
  const action = actions[values[0]];
  if (!action || values.length > 2) throw new Error("usage: /initialize-prime-claw [--accept-override|--reset|--review|--review-ready <asset-id>|--review-complete|--review-cancel|--review-restore|--review-keep|--switch-request <provider>|--switch-confirm <provider> <revision> <actor> <placement>]");
  return { action, args: { ...defaults, assetId: values[1], ready: action === "review-start", visible: action === "review-complete" } };
}

export function createProjectInitializationExtension(dependencies: ProjectInitializationDependencies = {}) {
  return function projectInitialization(pi: ExtensionAPI): void {
    let pendingSkillPaths: string[] = [];
    pi.registerCommand("initialize-prime-claw", {
      description: "Initialize or safely reconcile Prime Claw project assets",
      handler: async (args, ctx) => {
        try {
          const parsed = parseCommand(args);
          const value = await executeAction(parsed.action, parsed.args, ctx, dependencies);
          ctx.ui.notify(actionSummary(value), (value as ReconcileResult)?.warnings?.length ? "warning" : "info");
        } catch (error) {
          ctx.ui.notify(`Prime Claw initialization failed: ${error instanceof Error ? error.message : String(error)}`, "error");
        }
      },
    });

    pi.registerTool({
      name: "initialize_prime_claw",
      label: "Initialize Prime Claw project",
      description: "Initialize or safely reconcile Prime Claw project templates, review an exact asset, or inspect and explicitly confirm one selected-provider migration.",
      promptSnippet: "Initialize or reconcile Prime Claw assets in the current Git project",
      promptGuidelines: [
        "Use initialize_prime_claw action=reconcile for explicit initialization or upgrade; it never commits. Set unpublishedLocalOnly true only when the operator explicitly selects unpublished local-only task history for a repository with no remote. The first explicit run records the exact unfinished retained-legacy specification allowlist, and later runs never enroll or rebaseline legacy specifications.",
        "For review, call review-request first, explain the temporary overwrite and foreground switch exactly, and wait for the operator to say ready or cancel.",
        "Call review-start only after literal operator readiness. After it opens the focused Orca diff, ask whether the comparison is visible and keep the overwrite held.",
        "Call review-complete only after visible confirmation and explicit completion; call review-cancel on cancellation. Never invoke Computer Use, Accessibility, or another GUI-control surface.",
        "Use review-restore or review-keep only for an interrupted review after an explicit operator decision.",
        "Accepting an override or resetting an asset is an explicit content decision; never infer it from silence.",
        "For a provider switch, call switch-request first. Present the exact source provider/revision/counts, the bounded maintenance window, destructive source deletion, and the semantic-placement prompt. Do not call switch-confirm until the operator explicitly confirms that exact switch and all task mutation is quiesced.",
        "switch-confirm must repeat the exact inspected source revision, target provider, truthful actor, and concise managed semantic-placement prose. When inspection lists an ambiguous Backlog-to-Beads projection, pass the managed role's actual literal destination-native value through one task-specific beadsNativePlacements entry; prose is audit evidence and is never parsed as a value. Use disposable fixtures for candidate validation; never migrate a live repository without separate explicit operator authority.",
        "The switch is one linear native operation: source stays intact and authoritative through destination verification and receipt publication; existing active version-2 Episode identities are preserved; source deletion happens only after exact ownership cutover proof. Never retry transport automatically or create a second destination.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["reconcile", "accept-override", "reset", "review-request", "review-start", "review-complete", "review-cancel", "review-restore", "review-keep", "switch-request", "switch-confirm"] },
          assetId: { type: "string", description: "Exact stable asset ID for asset-specific actions" },
          confirmedReady: { type: "boolean", description: "True only after the operator explicitly said ready" },
          visibleConfirmed: { type: "boolean", description: "True only after the operator confirmed the focused comparison is visible" },
          unpublishedLocalOnly: { type: "boolean", description: "True only after the operator explicitly chooses unpublished local-only task history because this repository has no remote" },
          targetProvider: { type: "string", enum: ["backlog", "beads"], description: "Exact requested destination for a provider-switch inspection or confirmation" },
          expectedSourceRevision: { type: "string", description: "Exact source revision returned by switch-request" },
          confirmedSwitch: { type: "boolean", description: "True only after the operator explicitly confirmed this exact one-way switch and source deletion" },
          actor: { type: "string", description: "Operator-approved actor recorded in the destination-native receipt" },
          semanticPlacement: { type: "string", description: "Managed LLM decision for human-facing placement of non-equivalent native fields; it never authorizes omission" },
          beadsNativePlacements: {
            type: "array",
            description: "Actual task-specific native Beads values selected for ambiguous Backlog projections; use only for fields listed by switch-request",
            items: {
              type: "object",
              properties: {
                sourceTaskId: { type: "string" },
                priority: { type: "integer", minimum: 0, maximum: 4 },
                assignee: { type: "string", minLength: 1 },
              },
              required: ["sourceTaskId"],
              additionalProperties: false,
            },
          },
        },
        required: ["action"],
        additionalProperties: false,
      } as any,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          const value = await executeAction(params.action as Action, {
            assetId: params.assetId,
            ready: params.confirmedReady === true,
            visible: params.visibleConfirmed === true,
            targetProvider: params.targetProvider,
            expectedSourceRevision: params.expectedSourceRevision,
            confirmedSwitch: params.confirmedSwitch === true,
            actor: params.actor,
            semanticPlacement: params.semanticPlacement,
            beadsNativePlacements: params.beadsNativePlacements,
            unpublishedLocalOnly: params.unpublishedLocalOnly === true,
          }, ctx, dependencies);
          return toolResult(value, actionSummary(value));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return toolResult({ error: message }, `Prime Claw initialization failed: ${message}`, true);
        }
      },
    });

    pi.on("session_start", async (_event, ctx) => {
      pendingSkillPaths = [];
      try {
        const project = resolveNearestProjectRoot(ctx.cwd, dependencies.home, dependencies.runner);
        if (!isOrcaRegistered(project.root, dependencies.runner)) return;
        const result = reconcilePrimeClawProject({
          ...productionReconcileOptions(dependencies),
          cwd: ctx.cwd,
          registerOrca: false,
          legacyInventoryMode: "verify",
        });
        pendingSkillPaths = result.items
          .filter((item) => ["created", "migrated", "updated", "recovered"].includes(item.action) && item.destination.startsWith(".agents/skills/") && item.destination.endsWith("/SKILL.md"))
          .map((item) => join(result.project.root, item.destination));
        if (result.skipReason === "uncertain-episode-activity") {
          ctx.ui.notify(summarizeReconcile(result), "warning");
        } else if (result.changed || result.conflicts > 0 || result.registration.status === "unavailable" || result.warnings?.length) {
          ctx.ui.notify(summarizeReconcile(result), result.conflicts > 0 || result.warnings?.length ? "warning" : "info");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/No Git worktree|HOME boundary/.test(message)) return;
        ctx.ui.notify(`Prime Claw startup reconciliation degraded: ${message}`, "warning");
      }
    });

    pi.on("resources_discover", async () => {
      const skillPaths = pendingSkillPaths;
      pendingSkillPaths = [];
      return skillPaths.length ? { skillPaths } : undefined;
    });
  };
}

export default createProjectInitializationExtension();
