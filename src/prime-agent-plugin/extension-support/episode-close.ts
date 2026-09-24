import { lstatSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { parseEpisodeIdentity, type EpisodeIdentity } from "./spec-episode.ts";
import type { OversightMarker } from "./conversation-oversight.ts";

export type EpisodeCloseResult = {
  reused: boolean;
  marker: OversightMarker;
};

const SAFE_LOCATION = /^\.ralph\/plans\/future\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

function identityPath(cwd: string, slug: string): string {
  return join(realpathSync(cwd), ".prime", "agent", "state", "spec-episodes", `${slug}.json`);
}

function samePath(left: string, right: string): boolean {
  return resolve(left) === resolve(right);
}

function assertExactIdentity(identity: EpisodeIdentity, marker: OversightMarker): void {
  const admission = identity.version === 1 ? identity.executeAdmission : identity.bootstrapAdmission;
  if (identity.ownerSessionId !== marker.ownerSessionId
    || identity.slug !== marker.slug
    || identity.sourceLocation !== marker.sourceLocation
    || identity.episodeId !== marker.episodeId
    || !samePath(identity.episodeSessionFile, marker.episodeSessionFile)
    || identity.branch !== marker.branch
    || !samePath(identity.worktree, marker.worktree)
    || identity.sessionName !== marker.sessionName
    || identity.version !== marker.identityVersion
    || admission !== marker.admission) {
    throw new Error("Episode bookkeeping identity does not match exact oversight state");
  }
}

export function closeEpisodeOversight(
  sourceLocation: string,
  ctx: ExtensionContext,
  marker: OversightMarker,
  appendInactive: (marker: OversightMarker) => void,
  removeIdentity: (path: string) => void = (path) => rmSync(path),
): EpisodeCloseResult {
  const match = SAFE_LOCATION.exec(sourceLocation);
  if (!match || match[1] !== marker.slug || marker.sourceLocation !== sourceLocation) {
    throw new Error("Episode bookkeeping location does not match exact oversight state");
  }
  if (marker.ownerSessionId !== ctx.sessionManager.getSessionId()) {
    throw new Error("Episode bookkeeping owner mismatch");
  }

  const path = identityPath(ctx.cwd, marker.slug);
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (!stat) {
    if (marker.status !== "inactive") throw new Error("Exact episode identity is missing before bookkeeping close");
    return { reused: true, marker };
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Episode identity path is not a regular file");
  const identity = parseEpisodeIdentity(JSON.parse(readFileSync(path, "utf8")), path);
  assertExactIdentity(identity, marker);
  if (marker.status === "active") appendInactive(marker);
  removeIdentity(path);
  return { reused: false, marker: { ...marker, status: "inactive" } };
}
