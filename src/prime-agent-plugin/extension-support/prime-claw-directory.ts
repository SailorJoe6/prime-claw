import { appendFileSync, lstatSync, mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

const EXCLUSION = "/.prime-claw/";

/** Only the call that creates the root directory may set its local Git default.
 * Existing paths (including a directory created by a racing caller) never repair
 * exclusions. Exclusion failures leave the new directory in place, without retry.
 */
export function ensurePrimeClawDirectory(
  projectRoot: string,
  onWarning: (message: string) => void = (message) => console.warn(message),
): boolean {
  const directory = join(projectRoot, ".prime-claw");
  try { lstatSync(directory); return false; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try { mkdirSync(directory, { mode: 0o755 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }

  let excludePath: string | undefined;
  try {
    const gitPath = execFileSync("git", ["-C", projectRoot, "rev-parse", "--git-path", "info/exclude"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (!gitPath) throw new Error("Git returned an empty info/exclude path");
    excludePath = resolve(projectRoot, gitPath);
    let existing: Buffer;
    try { existing = readFileSync(excludePath); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      existing = Buffer.alloc(0);
    }
    if (existing.toString("utf8").split(/\r?\n/).includes(EXCLUSION)) return true;
    mkdirSync(dirname(excludePath), { recursive: true });
    const separator = existing.length && existing[existing.length - 1] !== 0x0a ? "\n" : "";
    appendFileSync(excludePath, `${separator}${EXCLUSION}\n`);
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    const destination = excludePath
      ? JSON.stringify(excludePath)
      : `the path returned by git -C ${JSON.stringify(projectRoot)} rev-parse --git-path info/exclude`;
    onWarning(`Prime Claw created ${directory}, but could not add its local Git exclusion: ${cause}. `
      + `The worktree may remain dirty. Add ${EXCLUSION} manually to ${destination}; `
      + "Prime Claw will not retry while .prime-claw exists.");
  }
  return true;
}
