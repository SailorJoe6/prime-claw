import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const GUIDANCE_TAG = "operator-compaction-guidance";

export function canonicalSkillPrompt(
  cwd: string,
  name: "handoff" | "execute",
  guidance = "",
): string | null {
  const candidates = name === "execute"
    ? [join(cwd, ".agents", "skills", "execute", "SKILL.md"), join(cwd, ".ralph", "skills", "execute", "SKILL.md")]
    : [join(cwd, ".prime-claw", "workflows", `${name}.md`), join(cwd, ".ralph", "skills", name, "SKILL.md")];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) return null;
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
