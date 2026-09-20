import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep, win32 } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * reviewed-plan — deterministic loader for project-customized planning policy.
 *
 * Native code validates only the operator-selected future folder. The planning
 * method and artifact names remain in .ralph/skills/plan/SKILL.md.
 */

const COMMAND = "plan";
const USAGE = "Usage: /plan .ralph/plans/future/<slug>";
const PLAN_SKILL = join(".ralph", "skills", "plan", "SKILL.md");
const SAFE_LOCATION = /^\.ralph\/plans\/future\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

function containedBy(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child);
  return pathFromParent !== ""
    && pathFromParent !== ".."
    && !pathFromParent.startsWith(`..${sep}`)
    && !isAbsolute(pathFromParent);
}

function validatedLocation(cwd: string, rawArgs: string): string | null {
  const location = rawArgs.trim();
  if (!location || /\s/.test(location)) return null;
  if (isAbsolute(location) || win32.isAbsolute(location)) return null;
  if (!SAFE_LOCATION.test(location)) return null;

  const projectRoot = realpathSync(cwd);
  const futureRoot = resolve(projectRoot, ".ralph", "plans", "future");
  const candidate = resolve(projectRoot, location);
  if (!containedBy(futureRoot, candidate)) return null;
  if (!existsSync(candidate) || !statSync(candidate).isDirectory()) return null;

  const realFutureRoot = realpathSync(futureRoot);
  const realCandidate = realpathSync(candidate);
  if (!containedBy(realFutureRoot, realCandidate)) return null;
  if (!containedBy(projectRoot, realCandidate)) return null;

  return location;
}

function wrappedPlanSkill(cwd: string, location: string): string | null {
  const path = join(cwd, PLAN_SKILL);
  if (!existsSync(path)) return null;
  const body = readFileSync(path, "utf8");
  return `<skill name="plan" location="${path}">
References are relative to ${dirname(path)}.

${body}
</skill>

<operator-plan-location>
${location}
</operator-plan-location>`;
}

function warn(ctx: ExtensionContext, message: string): void {
  ctx.ui.notify(message, "warning");
}

export default function reviewedPlan(pi: ExtensionAPI): void {
  pi.registerCommand(COMMAND, {
    description: "Plan a reviewed specification from an explicit .ralph/plans/future/<slug> folder",
    handler: async (args, ctx) => {
      let location: string | null;
      try {
        location = validatedLocation(ctx.cwd, args);
      } catch {
        location = null;
      }
      if (!location) {
        warn(ctx, USAGE);
        return;
      }

      const prompt = wrappedPlanSkill(ctx.cwd, location);
      if (!prompt) {
        warn(ctx, "reviewed-plan: .ralph/skills/plan/SKILL.md not found");
        return;
      }
      pi.sendUserMessage(prompt);
    },
  });
}
