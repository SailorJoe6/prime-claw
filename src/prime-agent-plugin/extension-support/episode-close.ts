import { execFileSync } from "node:child_process";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  readEpisodeOwnership,
  writeEpisodeOwnership,
  type EpisodeOwnershipRecord,
} from "./episode-ownership.ts";

export type EpisodeCloseResult = {
  reused: boolean;
  record: EpisodeOwnershipRecord;
};

const SAFE_LOCATION = /^\.ralph\/plans\/future\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

function projectRoot(cwd: string): string {
  return execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function closeEpisodeOwnership(
  sourceLocation: string,
  ctx: ExtensionContext,
  write: (root: string, record: EpisodeOwnershipRecord) => void = writeEpisodeOwnership,
): EpisodeCloseResult {
  const match = SAFE_LOCATION.exec(sourceLocation);
  if (!match) throw new Error("Episode bookkeeping location is invalid");
  const root = projectRoot(ctx.cwd);
  const record = readEpisodeOwnership(root);
  if (!record) throw new Error("Exact episode ownership is missing before bookkeeping close");
  if (record.slug !== match[1] || record.sourceLocation !== sourceLocation) {
    throw new Error("Episode bookkeeping location does not match exact ownership state");
  }
  if (record.ownerSessionId !== ctx.sessionManager.getSessionId()) {
    throw new Error("Episode bookkeeping owner mismatch");
  }
  if (record.status === "inactive") return { reused: true, record };
  if (record.status !== "active") {
    throw new Error(`Episode bookkeeping cannot close ${record.status} ownership`);
  }
  const closed: EpisodeOwnershipRecord = {
    ...record,
    status: "inactive",
    updatedAt: new Date().toISOString(),
  };
  write(root, closed);
  const persisted = readEpisodeOwnership(root);
  if (!persisted || persisted.status !== "inactive" || persisted.operationId !== record.operationId) {
    throw new Error("Inactive episode bookkeeping evidence did not persist");
  }
  return { reused: false, record: persisted };
}
