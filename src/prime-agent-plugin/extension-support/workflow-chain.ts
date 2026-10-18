import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
const LEGACY_SNAPSHOT_WORKFLOWS = new Set(["handoff", "execute"]);

export interface CanonicalWorkflowPromptOptions {
  guidance?: string;
  legacySnapshot?: boolean;
  location?: { tag: string; value: string };
  ownerSessionId?: string;
}
// Legacy lookup is limited to handoff/execute so active old-layout Episodes
// can finish from their unchanged snapshots without reviving old plan flows.
export function canonicalWorkflowPrompt(
  root: string,
  name: string,
  options: CanonicalWorkflowPromptOptions = {},
): string | null {
  const current = name === "execute"
    ? join(root, ".agents", "skills", "execute", "SKILL.md")
    : join(root, ".prime-claw", "workflows", `${name}.md`);
  const candidates = options.legacySnapshot && LEGACY_SNAPSHOT_WORKFLOWS.has(name)
    ? [current, join(root, ".ralph", "skills", name, "SKILL.md")]
    : [current];
  const path = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  if (!path) return null;
  let prompt = `<skill name="${name}" location="${path}">
References are relative to ${dirname(path)}.

${readFileSync(path, "utf8")}
</skill>`;
  if (options.location) {
    const { tag, value } = options.location;
    prompt += `

<${tag}>
${value}
</${tag}>`;
  }
  if (options.ownerSessionId) {
    prompt += `

<operator-episode-owner-session>
${options.ownerSessionId}
</operator-episode-owner-session>
The value above is the exact owning Conversation registry key for this managed Episode. It intentionally differs from the Episode session ID; use it to select the persisted ownership entry and never substitute the current session ID.`;
  }
  if (options.guidance) {
    prompt += `

<operator-compaction-guidance>
${options.guidance}
</operator-compaction-guidance>`;
  }
  return prompt;
}

export type WorkflowChainAdmissionResult =
  | { ok: true }
  | { ok: false; stage: "first" | "followUp"; error: unknown };

// The callback is outside delivery catches to preserve caller transaction rules.
export async function admitWorkflowChain(options: {
  deliverFirst: () => void | Promise<void>;
  deliverFollowUp: () => void | Promise<void>;
  afterFirst?: () => void | Promise<void>;
}): Promise<WorkflowChainAdmissionResult> {
  try { await options.deliverFirst(); }
  catch (error) { return { ok: false, stage: "first", error }; }
  await options.afterFirst?.();
  try { await options.deliverFollowUp(); }
  catch (error) { return { ok: false, stage: "followUp", error }; }
  return { ok: true };
}
