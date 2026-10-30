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
import { prepareExistingBacklogTaskHistoryWorkspace, prepareTaskHistoryWorkspace } from "../extension-support/task-history-workspace.ts";
import {
  inspectTaskProviderMigration,
  migrateTaskProvider,
  type ProviderMigrationInspection,
  type ProviderMigrationOptions,
  type ProviderMigrationResult,
} from "../extension-support/task-provider-migration.ts";
import { verifyActiveTaskEpisodeContinuity } from "../extension-support/spec-episode.ts";
import {
  recoverTemplateReview,
  requestTemplateReview,
} from "../extension-support/template-review.ts";

type Action = "reconcile" | "accept-override" | "reset" | "review-request" | "review-restore" | "review-keep" | "switch-request" | "switch-confirm";

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
  const base = `Prime Claw project ${result.project.root} (${result.project.kind}): ${actions || "no-assets"} conflicts=${result.conflicts} ${registration} ${provider} ${legacy}`;
  if (!detailed || result.conflicts === 0) return base;
  const unresolved = result.items.filter((item) => item.action === "preserved" || item.action === "blocked");
  const lines = unresolved.map((item) => item.action === "preserved"
    ? `- ${item.assetId} (${item.destination}): ${item.reason ?? item.action}; ask the initialization skill for a text comparison of ${item.assetId}`
    : `- ${item.assetId} (${item.destination}): ${item.reason ?? item.action}; resolve the collision, then rerun the initialization skill`);
  if (result.legacySpecifications.status === "required") {
    lines.push("- unfinished retained legacy specifications are not inventoried; run the initialization skill explicitly once, then use selected-provider tasks for new work");
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
  if (value && typeof value === "object" && typeof (value as any).diff === "string") {
    return `${(value as any).message}\n${(value as any).diff || "(no textual differences)"}`;
  }
  if (value && typeof value === "object" && typeof (value as any).message === "string") return (value as any).message;
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
  targetProvider?: "backlog";
  expectedSourceRevision?: string;
  confirmedSwitch: boolean;
  actor?: string;
  semanticPlacement?: string;
  unpublishedLocalOnly: boolean;
}

function productionReconcileOptions(dependencies: ProjectInitializationDependencies, unpublishedLocalOnly = false) {
  return {
    ...dependencies,
    taskHistoryPreparer: (input) => (dependencies.taskHistoryPreparer ?? (input.normalizeExisting ? prepareExistingBacklogTaskHistoryWorkspace : prepareTaskHistoryWorkspace))({ ...input, unpublishedLocalOnly }),
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
    case "review-restore": return recoverTemplateReview(ctx.cwd, "restore", dependencies);
    case "review-keep": return recoverTemplateReview(ctx.cwd, "keep", dependencies);
    case "switch-request":
      if (args.targetProvider !== "backlog") throw new Error("only Beads to Backlog migration is supported; targetProvider must be backlog");
      return (dependencies.migrationInspector ?? inspectTaskProviderMigration)({
        cwd: ctx.cwd, targetProvider: args.targetProvider, runner: dependencies.runner,
      });
    case "switch-confirm":
      if (args.targetProvider !== "backlog") throw new Error("only Beads to Backlog migration is supported; targetProvider must be backlog");
      if (!args.expectedSourceRevision) throw new Error("switch-confirm requires expectedSourceRevision");
      return (dependencies.migrationRunner ?? migrateTaskProvider)({
        cwd: ctx.cwd,
        targetProvider: args.targetProvider,
        expectedSourceRevision: args.expectedSourceRevision,
        confirmedSwitch: args.confirmedSwitch,
        actor: args.actor ?? "",
        semanticPlacement: args.semanticPlacement ?? "",
        runner: dependencies.runner,
        verifyActiveRuntime: dependencies.migrationRuntimeVerifier ?? ((records) => {
          const project = resolveNearestProjectRoot(ctx.cwd, process.env.HOME ?? "", dependencies.runner);
          return verifyActiveTaskEpisodeContinuity(project.root, records);
        }),
      });
    default: throw new Error(`unsupported initialization action: ${action}`);
  }
}

export function createProjectInitializationExtension(dependencies: ProjectInitializationDependencies = {}) {
  return function projectInitialization(pi: ExtensionAPI): void {
    let pendingSkillPaths: string[] = [];
    pi.registerTool({
      name: "initialize_prime_claw",
      label: "Initialize Prime Claw project",
      description: "Agent-facing mechanics for the initialize-prime-claw skill: setup, upgrades, non-mutating text comparisons, explicit content decisions, legacy recovery, and confirmed Beads to Backlog migration.",
      promptSnippet: "Initialize or reconcile Prime Claw assets in the current Git project",
      promptGuidelines: [
        "Use initialize_prime_claw action=reconcile for explicit initialization or upgrade; it never commits. Set unpublishedLocalOnly true only when the operator explicitly selects unpublished local-only task history for a repository with no remote. The first explicit run records the exact unfinished retained-legacy specification allowlist, and later runs never enroll or rebaseline legacy specifications.",
        "Use review-request with an exact assetId to return a standard Git patch as text. It compares disposable copies only: actual asset bytes and the index stay unchanged, including staged and dirty assets. No viewer, ready confirmation, or completion call is needed; viewing is not acceptance.",
        "Use review-restore or review-keep only to recover retained legacy interrupted-review evidence after an explicit operator decision. Never silently discard it.",
        "Accepting an override or resetting an asset is an explicit content decision; never infer it from silence.",
        "For a provider switch, call switch-request first. Present the exact source provider/revision/counts, the bounded maintenance window, destructive source deletion, and the semantic-placement prompt. Do not call switch-confirm until the operator explicitly confirms that exact switch and all task mutation is quiesced.",
        "switch-confirm supports only Beads to Backlog and must repeat the exact inspected source revision, target backlog, truthful actor, and concise managed semantic-placement prose. Use disposable fixtures for candidate validation; never migrate a live repository without separate explicit operator authority.",
        "The switch is one linear native operation: source stays intact and authoritative through destination verification and receipt publication; existing active version-2 Episode identities are preserved; source deletion happens only after exact ownership cutover proof. Never retry transport automatically or create a second destination.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["reconcile", "accept-override", "reset", "review-request", "review-restore", "review-keep", "switch-request", "switch-confirm"] },
          assetId: { type: "string", description: "Exact stable asset ID for asset-specific actions" },
          unpublishedLocalOnly: { type: "boolean", description: "True only after the operator explicitly chooses unpublished local-only task history because this repository has no remote" },
          targetProvider: { type: "string", enum: ["backlog"], description: "Exact requested destination for a provider-switch inspection or confirmation" },
          expectedSourceRevision: { type: "string", description: "Exact source revision returned by switch-request" },
          confirmedSwitch: { type: "boolean", description: "True only after the operator explicitly confirmed this exact one-way switch and source deletion" },
          actor: { type: "string", description: "Operator-approved actor recorded in the destination-native receipt" },
          semanticPlacement: { type: "string", description: "Managed LLM decision for human-facing placement of non-equivalent native fields; it never authorizes omission" },
        },
        required: ["action"],
        additionalProperties: false,
      } as any,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          const value = await executeAction(params.action as Action, {
            assetId: params.assetId,
            targetProvider: params.targetProvider,
            expectedSourceRevision: params.expectedSourceRevision,
            confirmedSwitch: params.confirmedSwitch === true,
            actor: params.actor,
            semanticPlacement: params.semanticPlacement,
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
        } else if (result.changed || result.conflicts > 0 || result.registration.status === "unavailable") {
          ctx.ui.notify(summarizeReconcile(result), result.conflicts > 0 ? "warning" : "info");
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
