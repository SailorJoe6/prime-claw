import { readFileSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TaskEpisodeOwnershipRecord } from "./episode-ownership.ts";
import { effectiveTaskEpisodeIntegrationBranch } from "./episode-ownership.ts";

const CUSTOM_TYPE = "prime-claw-task-handoff-observation";

export interface TaskHandoffObservationReference {
  schemaVersion: 1;
  sessionId: string;
  sessionFile: string;
  entryId: string;
  parentId: string | null;
  customType: typeof CUSTOM_TYPE;
  /** Hash of the exact persisted UTF-8 JSONL row, excluding its newline. */
  entrySha256: string;
  bindings: Record<string, unknown>;
}

function unavailable(reason: string): never {
  throw new Error(`Task handoff observation unavailable (${reason}); no continuation was sent. Preserve current facts and inspect; do not retry or use an inline/copy fallback.`);
}

function localRows(file: string): { line: string; row: any }[] {
  try {
    const stat = statSync(file);
    if (!isAbsolute(file) || !stat.isFile() || !process.getuid || stat.uid !== process.getuid()) {
      return unavailable("same-user shared-filesystem placement not established");
    }
    return readFileSync(file, "utf8").split("\n").filter(Boolean)
      .map((line) => ({ line, row: JSON.parse(line) }));
  } catch {
    // Native journal lines and parser/I/O exception text can contain task bodies.
    return unavailable("native session journal is not readable");
  }
}

/** One factual capture in the invoking native journal, not a new authority/store.
 * The local daemon and exact local Episode journal establish the supported
 * same-user/shared-absolute-filesystem placement. Remote transport is unproven.
 * appendEntry is void and can defer writes: only the exact disk row permits send.
 */
export function retainTaskHandoffObservation(
  ctx: ExtensionContext,
  record: TaskEpisodeOwnershipRecord,
  activeSessionId: string,
  providerTaskObservation: Record<string, unknown>,
  episodeSessionObservation: Record<string, unknown>,
  appendEntry?: (customType: string, data: unknown) => void,
): TaskHandoffObservationReference {
  const sessionId = ctx.sessionManager.getSessionId();
  const sessionFile = ctx.sessionManager.getSessionFile();
  if (!appendEntry || !sessionFile || sessionId !== record.ownerSessionId || record.routingEnvironmentId) {
    return unavailable("public append or supported local placement missing");
  }
  // Check the selected Episode's actual local native file, not file existence
  // or an assumed host path. No Episode prompt/probe is sent to test access.
  const episodeHeader = localRows(record.episodeSessionFile!)[0]?.row;
  if (episodeHeader?.type !== "session" || episodeHeader.id !== record.episodeId
      || episodeHeader.cwd !== record.worktree) {
    return unavailable("selected Episode journal identity does not match");
  }
  const bindings = {
    ownerSessionId: record.ownerSessionId,
    provider: record.provider ?? "backlog",
    taskId: record.taskId,
    operationId: record.operationId,
    episodeId: record.episodeId,
    episodeSessionFile: record.episodeSessionFile,
    episodeActiveSessionId: activeSessionId,
    worktree: record.worktree,
    branch: record.branch,
    baseRef: record.baseRef,
    integrationBranch: effectiveTaskEpisodeIntegrationBranch(record),
    engine: record.engine,
    ...(record.projectSetupId ? { projectSetupId: record.projectSetupId } : {}),
    ...(record.routingEnvironmentId ? { routingEnvironmentId: record.routingEnvironmentId } : {}),
  };
  const data = { schemaVersion: 1, bindings, providerTaskObservation, episodeSessionObservation };
  try { appendEntry(CUSTOM_TYPE, data); }
  catch { return unavailable("public native append failed"); }
  // Synchronous exact leaf/entry selection immediately after the public append.
  const entry = ctx.sessionManager.getLeafEntry();
  if (!entry || entry.type !== "custom" || entry.customType !== CUSTOM_TYPE
      || JSON.stringify(entry.data) !== JSON.stringify(data)
      || JSON.stringify(ctx.sessionManager.getEntry(entry.id)) !== JSON.stringify(entry)) {
    return unavailable("public exact entry selection failed");
  }
  const rows = localRows(sessionFile);
  if (rows[0]?.row.type !== "session" || rows[0].row.id !== sessionId) {
    return unavailable("invoking native session header does not match");
  }
  const matches = rows.filter(({ row }) => row.id === entry.id);
  if (matches.length !== 1 || JSON.stringify(matches[0].row) !== JSON.stringify(entry)) {
    return unavailable("exact native entry is not persisted");
  }
  return {
    schemaVersion: 1, sessionId, sessionFile, entryId: entry.id,
    parentId: entry.parentId, customType: CUSTOM_TYPE,
    entrySha256: createHash("sha256").update(matches[0].line, "utf8").digest("hex"),
    bindings,
  };
}
