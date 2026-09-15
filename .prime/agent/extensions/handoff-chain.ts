import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * handoff-chain — deterministic handoff -> execute chaining for Ralph loops.
 *
 * The operator's observed pattern: /handoff is only ever invoked when another
 * execute phase follows (100% repeatable). This extension makes the chain
 * deterministic:
 *
 *   1. Registers a native /handoff command that does EXACTLY what the
 *      markdown-skill slash command did — loads the canonical
 *      .ralph/skills/handoff/SKILL.md and gives it to the agent as its
 *      prompt — plus one additive step: writing a chain marker file.
 *   2. After any compaction, if the marker exists, consumes it and injects
 *      the target skill's canonical markdown (.ralph/skills/<name>/SKILL.md)
 *      as the next prompt.
 *
 * The canonical skill markdown stays in .ralph/skills/ and is LOADED, never
 * duplicated here, so per-project customization is preserved. The LLM never
 * writes or routes the marker — both sides of the chain are code.
 */

const STATE_DIR = join(".prime", "agent", "state");
const MARKER_NAME = "chain-next";

function markerPath(cwd: string): string {
  return join(cwd, STATE_DIR, MARKER_NAME);
}

function skillMarkdown(cwd: string, name: string): { path: string; body: string } | null {
  const path = join(cwd, ".ralph", "skills", name, "SKILL.md");
  if (!existsSync(path)) return null;
  return { path, body: readFileSync(path, "utf8") };
}

function injectSkill(pi: ExtensionAPI, cwd: string, name: string): boolean {
  const skill = skillMarkdown(cwd, name);
  if (!skill) return false;
  pi.sendUserMessage(`<skill name="${name}" location="${skill.path}">
References are relative to ${dirname(skill.path)}.

${skill.body}
</skill>`);
  return true;
}

export default function handoffChain(pi: ExtensionAPI): void {
  pi.registerCommand("handoff", {
    description: "Ralph handoff phase — compact context, then chain into the next skill (default: execute)",
    handler: async (args, ctx) => {
      const next = args.trim() || "execute";
      const marker = markerPath(ctx.cwd);
      mkdirSync(dirname(marker), { recursive: true });
      writeFileSync(marker, next);
      if (!injectSkill(pi, ctx.cwd, "handoff")) {
        rmSync(marker, { force: true });
        ctx.ui.notify("handoff-chain: .ralph/skills/handoff/SKILL.md not found", "warning");
      }
    },
  });

  pi.on("session_compact", (_event, ctx) => {
    const marker = markerPath(ctx.cwd);
    if (!existsSync(marker)) return;
    const next = readFileSync(marker, "utf8").trim() || "execute";
    rmSync(marker, { force: true });
    if (!injectSkill(pi, ctx.cwd, next)) {
      ctx.ui.notify(`handoff-chain: .ralph/skills/${next}/SKILL.md not found`, "warning");
    }
  });
}
