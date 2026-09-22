import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const GUIDANCE_TAG = "operator-compaction-guidance";

export function canonicalSkillPrompt(
  cwd: string,
  name: "handoff" | "execute",
  guidance = "",
): string | null {
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
