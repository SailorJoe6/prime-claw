import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
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

interface TaskEpisodeOwnershipBase extends EpisodeOwnershipBase {
  version: 2;
  /** Canonical provider-native task ID. */
  taskId: string;
  /** Exact terminal Episode head bound before separately authorized resource cleanup. */
  cleanupHead?: string;
}

/** Compatibility shape for version-2 records written before provider identity existed. */
export interface LegacyBacklogTaskEpisodeOwnershipRecord extends TaskEpisodeOwnershipBase {
  provider?: undefined;
  taskPath: string;
  providerRevision?: never;
  taskEvidence?: never;
}

/** New Backlog ownership carries only its exact task-file identity. */
export interface BacklogTaskEpisodeOwnershipRecord extends TaskEpisodeOwnershipBase {
  provider: "backlog";
  taskPath: string;
  providerRevision?: never;
  taskEvidence?: never;
}

/** New Beads ownership carries the exact published native revision and task view. */
export interface BeadsTaskEpisodeOwnershipRecord extends TaskEpisodeOwnershipBase {
  provider: "beads";
  providerRevision: string;
  taskEvidence: Record<string, unknown>;
  taskPath?: never;
}

export type TaskEpisodeOwnershipRecord =
  | LegacyBacklogTaskEpisodeOwnershipRecord
  | BacklogTaskEpisodeOwnershipRecord
  | BeadsTaskEpisodeOwnershipRecord;

export type EpisodeOwnershipRecord = LegacyEpisodeOwnershipRecord | TaskEpisodeOwnershipRecord;

/** Human-readable repository registry keyed by the exact owning Conversation. */
export interface EpisodeOwnershipRegistry {
  schemaVersion: 1;
  owners: Record<string, EpisodeOwnershipRecord>;
}

export type EpisodeOwnershipMutation = (
  current: EpisodeOwnershipRecord | null,
  allRecords: readonly EpisodeOwnershipRecord[],
) => EpisodeOwnershipRecord | null;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIGEST = /^[0-9a-f]{64}$/;
const GIT_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const DOLT_REVISION = /^[0-9a-v]{32}$/;
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
const BACKLOG_TASK_RECORD_FIELDS = new Set<string>([
  ...COMMON_RECORD_FIELDS, "provider", "taskId", "taskPath", "cleanupHead",
]);
const BEADS_TASK_RECORD_FIELDS = new Set<string>([
  ...COMMON_RECORD_FIELDS, "provider", "taskId", "providerRevision", "taskEvidence", "cleanupHead",
]);

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

function exactBeadsTaskEvidence(value: unknown, taskId: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const task = value as Record<string, unknown>;
  return task.id === taskId
    && typeof task.title === "string" && task.title.trim() !== ""
    && typeof task.status === "string" && task.status.trim() !== "";
}

export function isLegacyEpisodeOwnership(record: EpisodeOwnershipRecord): record is LegacyEpisodeOwnershipRecord {
  return record.version === 1;
}

export function isTaskEpisodeOwnership(record: EpisodeOwnershipRecord): record is TaskEpisodeOwnershipRecord {
  return record.version === 2;
}

export function taskEpisodeProvider(record: TaskEpisodeOwnershipRecord): "backlog" | "beads" {
  return record.provider ?? "backlog";
}

export function isBacklogTaskEpisodeOwnership(
  record: TaskEpisodeOwnershipRecord,
): record is LegacyBacklogTaskEpisodeOwnershipRecord | BacklogTaskEpisodeOwnershipRecord {
  return taskEpisodeProvider(record) === "backlog";
}

export function isBeadsTaskEpisodeOwnership(
  record: TaskEpisodeOwnershipRecord,
): record is BeadsTaskEpisodeOwnershipRecord {
  return record.provider === "beads";
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
    const commonTask = canonicalTaskId(item.taskId)
      && GIT_OID.test(String(item.baseRef))
      && (item.cleanupHead === undefined || GIT_OID.test(String(item.cleanupHead)));
    const backlogTask = (item.provider === undefined || item.provider === "backlog")
      && safeTaskPath(item.taskPath)
      && hasOnlyFields(item, BACKLOG_TASK_RECORD_FIELDS);
    const beadsTask = item.provider === "beads"
      && DOLT_REVISION.test(String(item.providerRevision))
      && exactBeadsTaskEvidence(item.taskEvidence, item.taskId)
      && hasOnlyFields(item, BEADS_TASK_RECORD_FIELDS);
    if (!commonTask || (!backlogTask && !beadsTask)) {
      throw new Error(`Episode ownership has an unsupported shape: ${path}`);
    }
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

export function parseEpisodeOwnershipRegistry(value: unknown, path = "episode ownership"): EpisodeOwnershipRegistry {
  if (value && typeof value === "object" && !Array.isArray(value)
    && (value as Record<string, unknown>).schemaVersion === 1) {
    const item = value as Record<string, unknown>;
    if (Object.keys(item).some((field) => !["schemaVersion", "owners"].includes(field))
      || !item.owners || typeof item.owners !== "object" || Array.isArray(item.owners)) {
      throw new Error(`Episode ownership registry has an unsupported shape: ${path}`);
    }
    const owners: Record<string, EpisodeOwnershipRecord> = {};
    for (const [ownerSessionId, rawRecord] of Object.entries(item.owners as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) {
      if (!ownerSessionId) throw new Error(`Episode ownership registry has an empty owner key: ${path}`);
      const record = parseEpisodeOwnership(rawRecord, `${path} owner ${ownerSessionId}`);
      if (record.ownerSessionId !== ownerSessionId) {
        throw new Error(`Episode ownership registry owner key does not match its record: ${path} owner ${ownerSessionId}`);
      }
      owners[ownerSessionId] = record;
    }
    const registry: EpisodeOwnershipRegistry = { schemaVersion: 1, owners };
    validateActiveBindingUniqueness(registry);
    return registry;
  }

  // A pre-registry direct record is valid migration input. The next mutation
  // persists the equivalent Conversation-keyed registry without changing it.
  const record = parseEpisodeOwnership(value, path);
  return { schemaVersion: 1, owners: { [record.ownerSessionId]: record } };
}

function readOwnershipValue(projectRoot: string): unknown | null {
  const path = episodeOwnershipPath(projectRoot);
  if (!existsSync(path)) return null;
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Episode ownership path is not a regular file: ${path}`);
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { throw new Error(`Episode ownership is unreadable: ${path}: ${String(error)}`); }
}

export function readEpisodeOwnershipRegistry(projectRoot: string): EpisodeOwnershipRegistry {
  const value = readOwnershipValue(projectRoot);
  return value === null
    ? { schemaVersion: 1, owners: {} }
    : parseEpisodeOwnershipRegistry(value, episodeOwnershipPath(projectRoot));
}

export function readAllEpisodeOwnership(projectRoot: string): EpisodeOwnershipRecord[] {
  return Object.values(readEpisodeOwnershipRegistry(projectRoot).owners);
}

export function readEpisodeOwnership(projectRoot: string, ownerSessionId?: string): EpisodeOwnershipRecord | null {
  const registry = readEpisodeOwnershipRegistry(projectRoot);
  if (ownerSessionId !== undefined) return registry.owners[ownerSessionId] ?? null;
  const records = Object.values(registry.owners);
  if (records.length <= 1) return records[0] ?? null;
  throw new Error(`Episode ownership has multiple Conversation records; exact ownerSessionId is required: ${episodeOwnershipPath(projectRoot)}`);
}

function active(record: EpisodeOwnershipRecord): boolean {
  return record.status !== "inactive";
}

function sameEpisodeBinding(left: EpisodeOwnershipRecord, right: EpisodeOwnershipRecord): boolean {
  if (left.version === 1 && right.version === 1) return left.sourceLocation === right.sourceLocation;
  if (left.version === 2 && right.version === 2) {
    if (taskEpisodeProvider(left) !== taskEpisodeProvider(right) || left.taskId !== right.taskId) return false;
    return isBacklogTaskEpisodeOwnership(left) && isBacklogTaskEpisodeOwnership(right)
      ? left.taskPath === right.taskPath
      : isBeadsTaskEpisodeOwnership(left) && isBeadsTaskEpisodeOwnership(right);
  }
  return Boolean(left.episodeId && right.episodeId
    && left.episodeId === right.episodeId
    && left.worktree && left.worktree === right.worktree
    && left.branch && left.branch === right.branch);
}

function validateActiveBindingUniqueness(registry: EpisodeOwnershipRegistry): void {
  const records = Object.values(registry.owners).filter(active);
  for (let index = 0; index < records.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < records.length; otherIndex += 1) {
      const left = records[index];
      const right = records[otherIndex];
      if (left.version === 2 && right.version === 2) {
        const sameTaskId = left.taskId === right.taskId;
        const sameBacklogPath = isBacklogTaskEpisodeOwnership(left)
          && isBacklogTaskEpisodeOwnership(right)
          && left.taskPath === right.taskPath;
        if (sameTaskId || sameBacklogPath) {
          throw new Error(`Active task Episode binding collides across Conversations: ${left.taskId} / ${right.taskId}`);
        }
      }
      if (left.version === 1 && right.version === 1 && left.sourceLocation === right.sourceLocation) {
        throw new Error(`Active retained source binding collides across Conversations: ${left.sourceLocation}`);
      }
    }
  }
}

function orderedRegistry(registry: EpisodeOwnershipRegistry): EpisodeOwnershipRegistry {
  return {
    schemaVersion: 1,
    owners: Object.fromEntries(Object.entries(registry.owners).sort(([a], [b]) => a.localeCompare(b))),
  };
}

function persistOwnershipRegistry(projectRoot: string, registry: EpisodeOwnershipRegistry): void {
  validateActiveBindingUniqueness(registry);
  const path = episodeOwnershipPath(projectRoot);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(orderedRegistry(registry), null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function withDirectoryLock<T>(lockPath: string, timeoutMs: number, label: string, operation: () => T): T {
  mkdirSync(dirname(lockPath), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      mkdirSync(lockPath);
      break;
    } catch (error) {
      if ((error as { code?: string }).code !== "EEXIST") throw error;
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label} lock: ${lockPath}`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try { return operation(); }
  finally { rmSync(lockPath, { recursive: true, force: true }); }
}

function withOwnershipLock<T>(projectRoot: string, operation: () => T): T {
  return withDirectoryLock(`${episodeOwnershipPath(projectRoot)}.lock`, 5_000, "Episode ownership registry", operation);
}

/** Serialize only the canonical-main status commit plus durable reservation. */
export function withEpisodeAdmissionLock<T>(projectRoot: string, operation: () => T): T {
  return withDirectoryLock(join(projectRoot, ".prime-claw", "episode-admission.lock"), 30_000, "Episode admission", operation);
}

export function mutateEpisodeOwnership(
  projectRoot: string,
  ownerSessionId: string,
  mutation: EpisodeOwnershipMutation,
): EpisodeOwnershipRecord | null {
  if (!ownerSessionId) throw new Error("Episode ownership mutation requires an exact ownerSessionId");
  return withOwnershipLock(projectRoot, () => {
    const registry = readEpisodeOwnershipRegistry(projectRoot);
    const current = registry.owners[ownerSessionId] ?? null;
    const next = mutation(current, Object.values(registry.owners));
    if (next === null) delete registry.owners[ownerSessionId];
    else {
      parseEpisodeOwnership(next);
      if (next.ownerSessionId !== ownerSessionId) throw new Error("Episode ownership mutation cannot change its ownerSessionId");
      if (current && active(current) && active(next) && !sameEpisodeBinding(current, next)) {
        throw new Error(`Conversation ${ownerSessionId} already owns a different active Episode`);
      }
      registry.owners[ownerSessionId] = next;
    }
    persistOwnershipRegistry(projectRoot, registry);
    return next;
  });
}

export function writeEpisodeOwnership(projectRoot: string, record: EpisodeOwnershipRecord): void {
  parseEpisodeOwnership(record);
  mutateEpisodeOwnership(projectRoot, record.ownerSessionId, () => record);
}
