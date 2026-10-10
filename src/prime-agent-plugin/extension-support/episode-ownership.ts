import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export type EpisodeLifecycleStatus = "provisioning" | "active" | "uncertain" | "inactive";
export type EpisodeLifecycleEngine = "orca" | "local";

export interface EpisodeOwnershipRecord {
  version: 1;
  status: EpisodeLifecycleStatus;
  operationId: string;
  engine: EpisodeLifecycleEngine;
  ownerSessionId: string;
  sourceLocation: string;
  slug: string;
  baseRef: string;
  bundleDigest: string;
  createdAt: string;
  updatedAt: string;
  projectSetupId?: string;
  routingEnvironmentId?: string;
  worktreeId?: string;
  worktreeIdentity?: string;
  worktree?: string;
  branch?: string;
  head?: string;
  episodeId?: string;
  episodeSessionFile?: string;
  episodeActiveSessionId?: string;
  terminalHandle?: string;
  worktreeName?: string;
  launchAutomationName?: string;
  launchAutomationId?: string;
  launchRunId?: string;
  uncertaintyReason?: string;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIGEST = /^[0-9a-f]{64}$/;
const STRING_FIELDS = [
  "operationId", "ownerSessionId", "sourceLocation", "slug", "baseRef", "bundleDigest", "createdAt", "updatedAt",
] as const;
const OPTIONAL_STRING_FIELDS = [
  "projectSetupId", "routingEnvironmentId", "worktreeId", "worktreeIdentity", "worktree", "branch", "head",
  "episodeId", "episodeSessionFile", "episodeActiveSessionId", "terminalHandle", "worktreeName",
  "launchAutomationName", "launchAutomationId", "launchRunId", "uncertaintyReason",
] as const;

export function episodeOwnershipPath(projectRoot: string): string {
  return join(projectRoot, ".prime-claw", "ownership.json");
}

export function parseEpisodeOwnership(value: unknown, path = "episode ownership"): EpisodeOwnershipRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Episode ownership has an unsupported shape: ${path}`);
  }
  const item = value as Record<string, unknown>;
  if (item.version !== 1
    || !["provisioning", "active", "uncertain", "inactive"].includes(String(item.status))
    || !["orca", "local"].includes(String(item.engine))
    || !STRING_FIELDS.every((field) => typeof item[field] === "string" && item[field] !== "")
    || !OPTIONAL_STRING_FIELDS.every((field) => item[field] === undefined || (typeof item[field] === "string" && item[field] !== ""))
    || !SLUG.test(String(item.slug))
    || !DIGEST.test(String(item.bundleDigest))
    || item.sourceLocation !== `.ralph/plans/future/${item.slug}`) {
    throw new Error(`Episode ownership has an unsupported shape: ${path}`);
  }
  if (item.engine === "orca" && typeof item.projectSetupId !== "string") {
    throw new Error(`Episode ownership is missing its Orca project setup: ${path}`);
  }
  if (["active", "inactive"].includes(String(item.status))) {
    const bound = ["worktree", "branch", "head", "episodeId", "episodeSessionFile"];
    if (!bound.every((field) => typeof item[field] === "string" && item[field] !== "")) {
      throw new Error(`Episode ownership is missing active bindings: ${path}`);
    }
    if (item.engine === "orca" && !["worktreeId", "worktreeIdentity"].every((field) => typeof item[field] === "string" && item[field] !== "")) {
      throw new Error(`Episode ownership is missing active Orca bindings: ${path}`);
    }
  }
  return item as unknown as EpisodeOwnershipRecord;
}

export function readEpisodeOwnership(projectRoot: string): EpisodeOwnershipRecord | null {
  const path = episodeOwnershipPath(projectRoot);
  if (!existsSync(path)) return null;
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Episode ownership path is not a regular file: ${path}`);
  let value: unknown;
  try { value = JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { throw new Error(`Episode ownership is unreadable: ${path}: ${String(error)}`); }
  return parseEpisodeOwnership(value, path);
}

export function writeEpisodeOwnership(projectRoot: string, record: EpisodeOwnershipRecord): void {
  parseEpisodeOwnership(record);
  const path = episodeOwnershipPath(projectRoot);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

export function removeEpisodeOwnership(projectRoot: string): void {
  rmSync(episodeOwnershipPath(projectRoot), { force: true });
}
