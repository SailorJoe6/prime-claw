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
  finishTemplateReview,
  recoverTemplateReview,
  requestTemplateReview,
  startTemplateReview,
} from "../extension-support/template-review.ts";

type Action = "reconcile" | "accept-override" | "reset" | "review-request" | "review-start" | "review-complete" | "review-cancel" | "review-restore" | "review-keep";

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
  return "Prime Claw initialization action completed";
}

function toolResult(value: unknown, text?: string, isError = false) {
  return {
    content: [{ type: "text" as const, text: text ?? JSON.stringify(value, null, 2) }],
    details: value,
    ...(isError ? { isError: true } : {}),
  };
}

type ProjectInitializationDependencies = Omit<ReconcileOptions, "cwd" | "registerOrca" | "requireOrcaRegistration">;

function productionReconcileOptions(dependencies: ProjectInitializationDependencies) {
  return {
    ...dependencies,
    taskHistoryPreparer: dependencies.taskHistoryPreparer ?? prepareTaskHistoryWorkspace,
  };
}

async function executeAction(action: Action, assetId: string | undefined, ready: boolean, visible: boolean, ctx: ExtensionContext, dependencies: ProjectInitializationDependencies) {
  switch (action) {
    case "reconcile": return reconcilePrimeClawProject({
      ...productionReconcileOptions(dependencies), cwd: ctx.cwd, registerOrca: true, legacyInventoryMode: "initialize",
    });
    case "accept-override":
      if (!assetId) throw new Error("accept-override requires assetId");
      return { assetId, entry: acceptProjectOverride(ctx.cwd, assetId, dependencies) };
    case "reset":
      if (!assetId) throw new Error("reset requires assetId");
      return { assetId, entry: resetProjectAsset(ctx.cwd, assetId, dependencies) };
    case "review-request":
      if (!assetId) throw new Error("review-request requires assetId");
      return requestTemplateReview(ctx.cwd, assetId, dependencies);
    case "review-start":
      if (!assetId) throw new Error("review-start requires assetId");
      return startTemplateReview(ctx.cwd, assetId, ready, dependencies);
    case "review-complete": return finishTemplateReview(ctx.cwd, "complete", visible, dependencies);
    case "review-cancel": return finishTemplateReview(ctx.cwd, "cancel", false, dependencies);
    case "review-restore": return recoverTemplateReview(ctx.cwd, "restore", dependencies);
    case "review-keep": return recoverTemplateReview(ctx.cwd, "keep", dependencies);
  }
}

function parseCommand(raw: string): { action: Action; assetId?: string; ready: boolean; visible: boolean } {
  const args = raw.trim() ? raw.trim().split(/\s+/) : [];
  if (!args.length) return { action: "reconcile", ready: false, visible: false };
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
  const action = actions[args[0]];
  if (!action || args.length > 2) throw new Error("usage: /initialize-prime-claw [--accept-override|--reset|--review|--review-ready <asset-id>|--review-complete|--review-cancel|--review-restore|--review-keep]");
  return { action, assetId: args[1], ready: action === "review-start", visible: action === "review-complete" };
}

export function createProjectInitializationExtension(dependencies: ProjectInitializationDependencies = {}) {
  return function projectInitialization(pi: ExtensionAPI): void {
    let pendingSkillPaths: string[] = [];
    pi.registerCommand("initialize-prime-claw", {
      description: "Initialize or safely reconcile Prime Claw project assets",
      handler: async (args, ctx) => {
        try {
          const parsed = parseCommand(args);
          const value = await executeAction(parsed.action, parsed.assetId, parsed.ready, parsed.visible, ctx, dependencies);
          ctx.ui.notify(actionSummary(value), "info");
        } catch (error) {
          ctx.ui.notify(`Prime Claw initialization failed: ${error instanceof Error ? error.message : String(error)}`, "error");
        }
      },
    });

    pi.registerTool({
      name: "initialize_prime_claw",
      label: "Initialize Prime Claw project",
      description: "Initialize or safely reconcile Prime Claw project templates, accept/reset an exact asset, or drive the explicitly confirmed template-review lifecycle.",
      promptSnippet: "Initialize or reconcile Prime Claw assets in the current Git project",
      promptGuidelines: [
        "Use initialize_prime_claw action=reconcile for explicit initialization or upgrade; it never commits. The first explicit run records the exact unfinished retained-legacy specification allowlist, and later runs never enroll or rebaseline legacy specifications.",
        "For review, call review-request first, explain the temporary overwrite and foreground switch exactly, and wait for the operator to say ready or cancel.",
        "Call review-start only after literal operator readiness. After it opens the focused Orca diff, ask whether the comparison is visible and keep the overwrite held.",
        "Call review-complete only after visible confirmation and explicit completion; call review-cancel on cancellation. Never invoke Computer Use, Accessibility, or another GUI-control surface.",
        "Use review-restore or review-keep only for an interrupted review after an explicit operator decision.",
        "Accepting an override or resetting an asset is an explicit content decision; never infer it from silence.",
      ],
      executionMode: "sequential",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["reconcile", "accept-override", "reset", "review-request", "review-start", "review-complete", "review-cancel", "review-restore", "review-keep"] },
          assetId: { type: "string", description: "Exact stable asset ID for asset-specific actions" },
          confirmedReady: { type: "boolean", description: "True only after the operator explicitly said ready" },
          visibleConfirmed: { type: "boolean", description: "True only after the operator confirmed the focused comparison is visible" },
        },
        required: ["action"],
        additionalProperties: false,
      } as any,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          const value = await executeAction(params.action as Action, params.assetId, params.confirmedReady === true, params.visibleConfirmed === true, ctx, dependencies);
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
