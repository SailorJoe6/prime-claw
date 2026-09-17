import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * handoff-chain — deterministic handoff -> execute chaining for Ralph loops.
 *
 * The operator's observed pattern: /handoff is only invoked when another
 * execute phase follows. This extension makes that one transition
 * deterministic while leaving the canonical workflow text customizable:
 *
 *   1. Native /handoff loads .ralph/skills/handoff/SKILL.md, appends any
 *      trailing command text as operator compaction guidance, and records
 *      pending state under the current Prime Agent session ID.
 *   2. After that session compacts, its pending state is consumed and the
 *      canonical .ralph/skills/execute/SKILL.md is injected exactly once.
 *
 * User arguments never select a skill or become part of a filesystem path.
 * The canonical skill markdown stays in .ralph/skills/ and is loaded rather
 * than duplicated here. The LLM never creates, routes, or consumes state.
 */

const LEGACY_MARKER = join(".prime", "agent", "state", "chain-next");
const GUIDANCE_TAG = "operator-compaction-guidance";

function sessionId(ctx: ExtensionContext): string {
  return ctx.sessionManager.getSessionId();
}

function removeLegacyMarker(cwd: string): void {
  rmSync(join(cwd, LEGACY_MARKER), { force: true });
}

function skillMarkdown(cwd: string, name: string): { path: string; body: string } | null {
  const path = join(cwd, ".ralph", "skills", name, "SKILL.md");
  if (!existsSync(path)) return null;
  return { path, body: readFileSync(path, "utf8") };
}

function injectSkill(pi: ExtensionAPI, cwd: string, name: string, guidance = ""): boolean {
  const skill = skillMarkdown(cwd, name);
  if (!skill) return false;
  const wrappedSkill = `<skill name="${name}" location="${skill.path}">
References are relative to ${dirname(skill.path)}.

${skill.body}
</skill>`;
  const guidanceBlock = guidance
    ? `\n\n<${GUIDANCE_TAG}>\n${guidance}\n</${GUIDANCE_TAG}>`
    : "";
  pi.sendUserMessage(`${wrappedSkill}${guidanceBlock}`);
  return true;
}

export default function handoffChain(pi: ExtensionAPI): void {
  // One extension runtime may be shared across root and RLM child sessions, so
  // closure state must still be keyed by Prime Agent's stable session UUID.
  const pendingExecuteBySession = new Set<string>();

  pi.registerCommand("handoff", {
    description: "Ralph handoff phase — optional trailing text supplies compaction guidance; execute always follows",
    handler: async (args, ctx) => {
      removeLegacyMarker(ctx.cwd);
      const currentSession = sessionId(ctx);
      pendingExecuteBySession.add(currentSession);
      try {
        if (!injectSkill(pi, ctx.cwd, "handoff", args.trim())) {
          pendingExecuteBySession.delete(currentSession);
          ctx.ui.notify("handoff-chain: .ralph/skills/handoff/SKILL.md not found", "warning");
        }
      } catch (error) {
        pendingExecuteBySession.delete(currentSession);
        throw error;
      }
    },
  });

  pi.on("session_start", (_event, ctx) => {
    // The Phase 4a.1 project-wide marker has no trustworthy session owner.
    // Never consume it. A new/reloaded runtime also starts with no pending chain.
    removeLegacyMarker(ctx.cwd);
    pendingExecuteBySession.delete(sessionId(ctx));
  });

  pi.on("session_compact", (_event, ctx) => {
    removeLegacyMarker(ctx.cwd);
    if (!pendingExecuteBySession.delete(sessionId(ctx))) return;
    if (!injectSkill(pi, ctx.cwd, "execute")) {
      ctx.ui.notify("handoff-chain: .ralph/skills/execute/SKILL.md not found", "warning");
    }
  });

  pi.on("session_shutdown", (_event, ctx) => {
    removeLegacyMarker(ctx.cwd);
    pendingExecuteBySession.delete(sessionId(ctx));
  });
}
