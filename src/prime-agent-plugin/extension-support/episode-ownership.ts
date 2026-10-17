import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, win32 } from "node:path";
import { randomUUID } from "node:crypto";

export type EpisodeLifecycleStatus = "provisioning" | "active" | "uncertain" | "inactive";
export type EpisodeLifecycleEngine = "orca" | "local";

interface EpisodeOwnershipBase {
  status: EpisodeLifecycleStatus;
  operationId: string;
  engine: EpisodeLifecycleEngine;
  ownerSessionId: string;
  baseRef: string;
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
  terminalHandles?: string[];
  worktreeName?: string;
  launchAutomationName?: string;
  launchAutomationId?: string;
  launchRunId?: string;
  uncertaintyReason?: string;
}

/** Retained compatibility identity for an already-created future-folder Episode. */
export interface LegacyEpisodeOwnershipRecord extends EpisodeOwnershipBase {
  version: 1;
  sourceLocation: string;
  slug: string;
  bundleDigest: string;
}

/** Task-native identity. The exact task and its status commit replace plan authority. */
export interface TaskEpisodeOwnershipRecord extends EpisodeOwnershipBase {
  version: 2;
  taskId: string;
  taskPath: string;
  /** Exact terminal Episode head bound before separately authorized resource cleanup. */
  cleanupHead?: string;
}

export type EpisodeOwnershipRecord = LegacyEpisodeOwnershipRecord | TaskEpisodeOwnershipRecord;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIGEST = /^[0-9a-f]{64}$/;
const GIT_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const COMMON_STRING_FIELDS = [
  "operationId", "ownerSessionId", "baseRef", "createdAt", "updatedAt",
] as const;
const OPTIONAL_STRING_FIELDS = [
  "projectSetupId", "routingEnvironmentId", "worktreeId", "worktreeIdentity", "worktree", "branch", "head",
  "episodeId", "episodeSessionFile", "episodeActiveSessionId", "terminalHandle", "worktreeName",
  "launchAutomationName", "launchAutomationId", "launchRunId", "uncertaintyReason",
] as const;
const COMMON_RECORD_FIELDS = new Set<string>([
  "version", "status", "engine", "terminalHandles", ...COMMON_STRING_FIELDS, ...OPTIONAL_STRING_FIELDS,
]);
const LEGACY_RECORD_FIELDS = new Set<string>([...COMMON_RECORD_FIELDS, "sourceLocation", "slug", "bundleDigest"]);
const TASK_RECORD_FIELDS = new Set<string>([...COMMON_RECORD_FIELDS, "taskId", "taskPath", "cleanupHead"]);

function hasOnlyFields(item: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(item).every((field) => allowed.has(field));
}

function safeTaskPath(value: unknown): value is string {
  if (typeof value !== "string" || !value || isAbsolute(value) || win32.isAbsolute(value) || value.includes("\\")) return false;
  return value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

function canonicalTaskId(value: unknown): value is string {
  return typeof value === "string" && value !== "" && !/\s/.test(value) && !value.startsWith("-");
}

export function isLegacyEpisodeOwnership(record: EpisodeOwnershipRecord): record is LegacyEpisodeOwnershipRecord {
  return record.version === 1;
}

export function isTaskEpisodeOwnership(record: EpisodeOwnershipRecord): record is TaskEpisodeOwnershipRecord {
  return record.version === 2;
}

export function episodeOwnershipPath(projectRoot: string): string {
  return join(projectRoot, ".prime-claw", "ownership.json");
}

export function parseEpisodeOwnership(value: unknown, path = "episode ownership"): EpisodeOwnershipRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Episode ownership has an unsupported shape: ${path}`);
  }
  const item = value as Record<string, unknown>;
  const common = (item.version === 1 || item.version === 2)
    && ["provisioning", "active", "uncertain", "inactive"].includes(String(item.status))
    && ["orca", "local"].includes(String(item.engine))
    && COMMON_STRING_FIELDS.every((field) => typeof item[field] === "string" && item[field] !== "")
    && OPTIONAL_STRING_FIELDS.every((field) => item[field] === undefined || (typeof item[field] === "string" && item[field] !== ""))
    && (item.terminalHandles === undefined || (Array.isArray(item.terminalHandles)
      && item.terminalHandles.length > 0
      && item.terminalHandles.every((handle) => typeof handle === "string" && handle !== "")
      && new Set(item.terminalHandles).size === item.terminalHandles.length));
  if (!common) throw new Error(`Episode ownership has an unsupported shape: ${path}`);

  if (item.version === 1) {
    const legacy = typeof item.sourceLocation === "string"
      && typeof item.slug === "string"
      && typeof item.bundleDigest === "string"
      && SLUG.test(item.slug)
      && DIGEST.test(item.bundleDigest)
      && item.sourceLocation === `.ralph/plans/future/${item.slug}`
      && hasOnlyFields(item, LEGACY_RECORD_FIELDS);
    if (!legacy) throw new Error(`Episode ownership has an unsupported shape: ${path}`);
  } else {
    const task = canonicalTaskId(item.taskId)
      && safeTaskPath(item.taskPath)
      && GIT_OID.test(String(item.baseRef))
      && (item.cleanupHead === undefined || GIT_OID.test(String(item.cleanupHead)))
      && hasOnlyFields(item, TASK_RECORD_FIELDS);
    if (!task) throw new Error(`Episode ownership has an unsupported shape: ${path}`);
  }

  if (item.engine === "orca" && typeof item.projectSetupId !== "string") {
    throw new Error(`Episode ownership is missing its Orca project setup: ${path}`);
  }
  if (["active", "inactive"].includes(String(item.status))) {
    const bound = ["worktree", "branch", "head", "episodeId", "episodeSessionFile"];
    if (item.version === 2) bound.push("episodeActiveSessionId");
    if (!bound.every((field) => typeof item[field] === "string" && item[field] !== "")) {
      throw new Error(`Episode ownership is missing active bindings: ${path}`);
    }
    const orcaBound = item.version === 2
      ? ["worktreeId", "worktreeIdentity", "terminalHandle"]
      : ["worktreeId", "worktreeIdentity"];
    if (item.engine === "orca" && !orcaBound.every((field) => typeof item[field] === "string" && item[field] !== "")) {
      throw new Error(`Episode ownership is missing active Orca bindings: ${path}`);
    }
    if (item.version === 2 && item.engine === "orca" && item.terminalHandles !== undefined
      && !(item.terminalHandles as string[]).includes(String(item.terminalHandle))) {
      throw new Error(`Episode ownership terminal inventory omits its primary terminal: ${path}`);
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
