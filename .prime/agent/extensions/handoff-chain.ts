import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Deterministic native /handoff -> canonical execute admission.
 *
 * Compaction remains a best-effort action inside the handoff workflow. The
 * command admits execute independently as one native follow-up, so no
 * compaction event can create a second execute pass.
 */

const LEGACY_MARKER = join(".prime", "agent", "state", "chain-next");
const GUIDANCE_TAG = "operator-compaction-guidance";

function removeLegacyMarker(cwd: string): void {
  rmSync(join(cwd, LEGACY_MARKER), { force: true });
}

function skillPrompt(cwd: string, name: string, guidance = ""): string | null {
  const path = join(cwd, ".ralph", "skills", name, "SKILL.md");
  if (!existsSync(path)) return null;
  const body = readFileSync(path, "utf8");
  const wrapped = `<skill name="${name}" location="${path}">
References are relative to ${dirname(path)}.

${body}
</skill>`;
  return guidance
    ? `${wrapped}

<${GUIDANCE_TAG}>
${guidance}
</${GUIDANCE_TAG}>`
    : wrapped;
}

export default function handoffChain(pi: ExtensionAPI): void {
  pi.registerCommand("handoff", {
    description: "Ralph handoff phase — optional trailing text supplies compaction guidance; execute is queued independently",
    handler: async (args, ctx) => {
      removeLegacyMarker(ctx.cwd);

      // Preflight both canonical workflows before beginning a partial transition.
      const handoff = skillPrompt(ctx.cwd, "handoff", args.trim());
      if (!handoff) {
        ctx.ui.notify("handoff-chain: .ralph/skills/handoff/SKILL.md not found", "warning");
        return;
      }
      const execute = skillPrompt(ctx.cwd, "execute");
      if (!execute) {
        ctx.ui.notify("handoff-chain: .ralph/skills/execute/SKILL.md not found", "warning");
        return;
      }

      try {
        pi.sendUserMessage(handoff);
      } catch {
        ctx.ui.notify("handoff-chain: canonical handoff could not be admitted", "error");
        return;
      }

      try {
        pi.sendUserMessage(execute, { deliverAs: "followUp" });
      } catch {
        ctx.ui.notify(
          "handoff-chain: canonical execute follow-up could not be queued; continuation is infeasible",
          "error",
        );
      }
    },
  });

  // The Phase 4a.1 marker has no trustworthy session owner. Delete it without
  // consuming it. Native queues and session lifecycle now own cancellation.
  pi.on("session_start", (_event, ctx) => removeLegacyMarker(ctx.cwd));
  pi.on("session_shutdown", (_event, ctx) => removeLegacyMarker(ctx.cwd));
}
