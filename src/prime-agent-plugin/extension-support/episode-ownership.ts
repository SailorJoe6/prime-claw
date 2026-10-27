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

/** Existing branch-local Backlog ownership carries only its exact task-file identity. */
export interface BacklogTaskEpisodeOwnershipRecord extends TaskEpisodeOwnershipBase {
  provider: "backlog";
  taskPath: string;
  providerRevision?: never;
  taskEvidence?: never;
}

/** Independent Backlog task history binds its published Git revision and exact native task view. */
export interface PublishedBacklogTaskEpisodeOwnershipRecord extends TaskEpisodeOwnershipBase {
  provider: "backlog";
  taskPath: string;
  providerRevision: string;
  taskEvidence: Record<string, unknown>;
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
  | PublishedBacklogTaskEpisodeOwnershipRecord
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
  ...COMMON_RECORD_FIELDS, "provider", "taskId", "taskPath", "providerRevision", "taskEvidence", "cleanupHead",
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

function exactBacklogTaskEvidence(value: unknown, taskId: unknown, taskPath: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const task = (value as Record<string, unknown>).task;
  const path = task && typeof task === "object" && !Array.isArray(task)
    ? (task as Record<string, unknown>).path : undefined;
  const archivedPath = typeof taskPath === "string"
    ? taskPath.replace(/(^|\/)tasks\//, "$1archive/tasks/") : undefined;
  return Boolean(task && typeof task === "object" && !Array.isArray(task)
    && (task as Record<string, unknown>).id === taskId
    && (path === taskPath || path === archivedPath)
    && typeof (task as Record<string, unknown>).status === "string"
    && String((task as Record<string, unknown>).status).trim() !== "");
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
): record is LegacyBacklogTaskEpisodeOwnershipRecord | BacklogTaskEpisodeOwnershipRecord | PublishedBacklogTaskEpisodeOwnershipRecord {
  return taskEpisodeProvider(record) === "backlog";
}

export function isPublishedBacklogTaskEpisodeOwnership(
  record: TaskEpisodeOwnershipRecord,
): record is PublishedBacklogTaskEpisodeOwnershipRecord {
  return record.provider === "backlog" && typeof record.providerRevision === "string" && record.taskEvidence !== undefined;
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
    const legacyBacklogTask = item.provider === undefined
      && safeTaskPath(item.taskPath)
      && item.providerRevision === undefined && item.taskEvidence === undefined
      && hasOnlyFields(item, BACKLOG_TASK_RECORD_FIELDS);
    const backlogTask = item.provider === "backlog"
      && safeTaskPath(item.taskPath)
      && ((item.providerRevision === undefined && item.taskEvidence === undefined)
        || (typeof item.providerRevision === "string" && GIT_OID.test(item.providerRevision)
          && exactBacklogTaskEvidence(item.taskEvidence, item.taskId, item.taskPath)))
      && hasOnlyFields(item, BACKLOG_TASK_RECORD_FIELDS);
    const beadsTask = item.provider === "beads"
      && typeof item.providerRevision === "string"
      && DOLT_REVISION.test(item.providerRevision)
      && exactBeadsTaskEvidence(item.taskEvidence, item.taskId)
      && hasOnlyFields(item, BEADS_TASK_RECORD_FIELDS);
    if (!commonTask || (!legacyBacklogTask && !backlogTask && !beadsTask)) {
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

export interface ActiveTaskProviderOwnershipDestination {
  taskId: string;
  providerRevision: string;
  taskEvidence: Record<string, unknown>;
  taskPath?: string;
}

export interface ActiveTaskProviderOwnershipSwitchInput {
  sourceProvider: "backlog" | "beads";
  targetProvider: "backlog" | "beads";
  switchedAt: string;
  destinations: Record<string, ActiveTaskProviderOwnershipDestination>;
}

export interface ActiveTaskProviderOwnershipSwitchResult {
  before: EpisodeOwnershipRegistry;
  after: EpisodeOwnershipRegistry;
  transitions: Array<{
    ownerSessionId: string;
    sourceTaskId: string;
    destinationTaskId: string;
  }>;
}

function copiedRegistry(registry: EpisodeOwnershipRegistry): EpisodeOwnershipRegistry {
  return JSON.parse(JSON.stringify(orderedRegistry(registry))) as EpisodeOwnershipRegistry;
}

/**
 * Atomically move every active version-2 binding from one selected provider to
 * the already-verified destination. Version-1 and inactive historical records
 * remain byte-for-byte equivalent. The task mapping and complete native target
 * evidence are supplied by the migration verifier; this function creates no
 * provider data and changes no Episode resource identity.
 */
export function switchActiveTaskProviderOwnership(
  projectRoot: string,
  input: ActiveTaskProviderOwnershipSwitchInput,
): ActiveTaskProviderOwnershipSwitchResult {
  if (input.sourceProvider === input.targetProvider) throw new Error("task-provider ownership switch requires different providers");
  if (!input.switchedAt || Number.isNaN(Date.parse(input.switchedAt))) throw new Error("task-provider ownership switch requires an RFC3339 timestamp");
  return withOwnershipLock(projectRoot, () => {
    const registry = readEpisodeOwnershipRegistry(projectRoot);
    const before = copiedRegistry(registry);
    const transitions: ActiveTaskProviderOwnershipSwitchResult["transitions"] = [];
    const destinationTaskIds = new Set<string>();
    const destinationTaskPaths = new Set<string>();
    for (const [ownerSessionId, record] of Object.entries(registry.owners)) {
      if (record.status === "inactive" || record.version === 1) continue;
      const actualProvider = taskEpisodeProvider(record);
      if (actualProvider !== input.sourceProvider) {
        throw new Error(`active task Episode ${ownerSessionId} uses ${actualProvider}, not selected source ${input.sourceProvider}`);
      }
      const destination = input.destinations[record.taskId];
      if (!destination) throw new Error(`provider migration has no verified destination mapping for active task ${record.taskId}`);
      if (input.targetProvider === "backlog" && (!destination.taskPath || !destination.taskPath.trim())) {
        throw new Error(`provider migration has no verified Backlog task path for active task ${record.taskId}`);
      }
      if (destinationTaskIds.has(destination.taskId)) throw new Error(`provider migration destination task ${destination.taskId} is mapped more than once`);
      destinationTaskIds.add(destination.taskId);
      if (input.targetProvider === "backlog") {
        const taskPath = destination.taskPath!.trim();
        if (destinationTaskPaths.has(taskPath)) throw new Error(`provider migration destination path ${taskPath} is mapped more than once`);
        destinationTaskPaths.add(taskPath);
      }
      const common = { ...record } as Record<string, unknown>;
      delete common.provider;
      delete common.taskId;
      delete common.taskPath;
      delete common.providerRevision;
      delete common.taskEvidence;
      delete common.updatedAt;
      const next: TaskEpisodeOwnershipRecord = input.targetProvider === "backlog"
        ? {
            ...common,
            version: 2,
            provider: "backlog",
            taskId: destination.taskId,
            taskPath: destination.taskPath ?? "",
            providerRevision: destination.providerRevision,
            taskEvidence: destination.taskEvidence,
            updatedAt: input.switchedAt,
          } as PublishedBacklogTaskEpisodeOwnershipRecord
        : {
            ...common,
            version: 2,
            provider: "beads",
            taskId: destination.taskId,
            providerRevision: destination.providerRevision,
            taskEvidence: destination.taskEvidence,
            updatedAt: input.switchedAt,
          } as BeadsTaskEpisodeOwnershipRecord;
      parseEpisodeOwnership(next, `provider migration owner ${ownerSessionId}`);
      if (next.ownerSessionId !== ownerSessionId) throw new Error("provider migration cannot change the owning Conversation");
      registry.owners[ownerSessionId] = next;
      transitions.push({ ownerSessionId, sourceTaskId: record.taskId, destinationTaskId: destination.taskId });
    }
    if (transitions.length > 0) persistOwnershipRegistry(projectRoot, registry);
    return { before, after: copiedRegistry(registry), transitions };
  });
}

/** Exact rollback for a failed pre-deletion cutover. No concurrent registry
 * change is overwritten; a mismatch blocks and leaves current ownership intact. */
export function restoreTaskProviderOwnershipSwitch(
  projectRoot: string,
  switchResult: ActiveTaskProviderOwnershipSwitchResult,
): EpisodeOwnershipRegistry {
  return withOwnershipLock(projectRoot, () => {
    const current = copiedRegistry(readEpisodeOwnershipRegistry(projectRoot));
    if (JSON.stringify(current) !== JSON.stringify(copiedRegistry(switchResult.after))) {
      throw new Error("task-provider ownership rollback refused because the registry changed after the switch");
    }
    const restored = copiedRegistry(switchResult.before);
    if (JSON.stringify(restored) !== JSON.stringify(current)) persistOwnershipRegistry(projectRoot, restored);
    return restored;
  });
}

export function writeEpisodeOwnership(projectRoot: string, record: EpisodeOwnershipRecord): void {
  parseEpisodeOwnership(record);
  mutateEpisodeOwnership(projectRoot, record.ownerSessionId, () => record);
}
