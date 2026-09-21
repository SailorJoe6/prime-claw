import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep, win32 } from "node:path";

export interface FutureLocation {
  location: string;
  slug: string;
  projectRoot: string;
  folder: string;
}

const SAFE_LOCATION = /^\.ralph\/plans\/future\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

function containedBy(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child);
  return pathFromParent !== ""
    && pathFromParent !== ".."
    && !pathFromParent.startsWith(`..${sep}`)
    && !isAbsolute(pathFromParent);
}

export function validateFutureLocation(cwd: string, rawArgs: string): FutureLocation | null {
  const location = rawArgs.trim();
  if (!location || /\s/.test(location)) return null;
  if (isAbsolute(location) || win32.isAbsolute(location)) return null;
  const match = SAFE_LOCATION.exec(location);
  if (!match) return null;

  const projectRoot = realpathSync(cwd);
  const futureRoot = resolve(projectRoot, ".ralph", "plans", "future");
  const folder = resolve(projectRoot, location);
  if (!containedBy(futureRoot, folder)) return null;
  if (!existsSync(folder) || !statSync(folder).isDirectory()) return null;

  const realFutureRoot = realpathSync(futureRoot);
  const realFolder = realpathSync(folder);
  if (!containedBy(realFutureRoot, realFolder)) return null;
  if (!containedBy(projectRoot, realFolder)) return null;

  return { location, slug: match[1], projectRoot, folder: realFolder };
}

export function wrapCanonicalSkill(
  projectRoot: string,
  skillName: string,
  locationTag: string,
  location: string,
): string | null {
  const path = join(projectRoot, ".ralph", "skills", skillName, "SKILL.md");
  if (!existsSync(path)) return null;
  const body = readFileSync(path, "utf8");
  return `<skill name="${skillName}" location="${path}">
References are relative to ${dirname(path)}.

${body}
</skill>

<${locationTag}>
${location}
</${locationTag}>`;
}
