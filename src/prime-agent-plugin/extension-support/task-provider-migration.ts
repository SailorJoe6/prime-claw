/**
 * One-shot selected-provider migration for Prime Claw initialization/upgrade.
 *
 * Imports current Beads tickets and memories into a fresh Backlog store.
 * Native writes and readback precede publication, ownership cutover and guarded
 * retirement. Source
 * identity lives once in the existing receipt, not in per-ticket archives.
 */
import { createHash } from "node:crypto";
import { makeBacklogGitEvidence } from "./backlog-git-evidence.ts";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { setImmediate as yieldToOperator } from "node:timers/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  type CommandRunner,
  ProcessCommandRunner,
  resolveNearestProjectRoot,
} from "./project-initialization.ts";
import {
  assertFreshBacklogMigrationDestination,
  cloneFreshBacklogMigrationWorkspace,
  createFreshBacklogMigrationWorkspace,
  verifyMigrationEpisodeWorktree,
  assertNoLocalBacklogMigrationDestination,
  TASK_HISTORY_REF,
} from "./task-history-workspace.ts";
import {
  BEADS_STATUS_MAP,
  detectExplicitTaskProvider,
  detectTaskProvider,
  type BeadsProviderEvidence,
  type CanonicalLifecycleStatus,
  type TaskProviderId,
} from "./task-providers.ts";
import {
  readEpisodeOwnershipRegistry,
  switchActiveTaskProviderOwnership,
  taskEpisodeProvider,
  withCurrentTaskProviderOwnershipSwitch,
  type ActiveTaskProviderOwnershipDestination,
  type ActiveTaskProviderOwnershipSwitchResult,
  type TaskEpisodeOwnershipRecord,
} from "./episode-ownership.ts";

import { projectBeadsCurrentTask, authorBeadsCurrentTask, assertBeadsCurrentTask } from "./beads-backlog-current.ts";
import { startMigrationBacklogWeb, MigrationBacklogWebError } from "./migration-backlog-web.ts";

type BeadsMigrationWeb = Awaited<ReturnType<typeof startMigrationBacklogWeb>>;
type OpenBeadsMigrationWeb = (storeDir: string) => Promise<BeadsMigrationWeb>;
interface BeadsCurrentConfiguration { priorities: string[]; types: string[]; statuses: string[] }

const RECEIPT_TITLE = "Prime Claw task-provider migration receipt";
const RECEIPT_MARKER = "prime-claw-task-provider-migration-receipt-v1";
const SOURCE_MARKER = "prime-claw-task-provider-migration-source-v1";
const SOURCE_RELATIONSHIP_MARKER = "prime-claw-task-provider-migration-relationships-v1";
const BACKLOG_TASK_DIRS = ["tasks", "completed", "archive/tasks", "drafts", "archive/drafts"] as const;
const GIT_OID = /^[0-9a-f]{40,64}$/;

export interface ProviderMigrationInspection {
  status: "ready";
  projectRoot: string;
  sourceProvider: TaskProviderId;
  targetProvider: TaskProviderId;
  sourceRevision: string;
  sourceDigest: string;
  taskCounts: { open: number; closed: number; archived: number; total: number };
  activeOwnership: Array<{ ownerSessionId: string; taskId: string }>;
  semanticPlacementPrompt: string;
  confirmation: string;
}

export interface ProviderMigrationBlocked {
  status: "blocked";
  code: string;
  detail: string;
  remediation: string;
  sourceProvider?: TaskProviderId;
  targetProvider?: TaskProviderId;
  sourceRevision?: string;
  sourceBackupPath?: string;
  authority?: "beads" | "backlog" | "unverified";
  sourceRetirement?: "absent" | "present" | "unverified";
  ownershipSwitched?: boolean;
  destinationRevision?: string;
  warnings?: string[];
}

export interface ProviderMigrationReceipt {
  schemaVersion: 1;
  marker: typeof RECEIPT_MARKER;
  sourceProvider: TaskProviderId;
  targetProvider: TaskProviderId;
  sourceRevision: string;
  sourceDigest: string;
  destinationDataRevision: string;
  destinationDataDigest: string;
  destinationReceiptRevision: string;
  taskCounts: { open: number; closed: number; archived: number; total: number };
  mappings: Array<{ sourceTaskId: string; destinationTaskId: string }>;
  ownershipTransitions: Array<{ ownerSessionId: string; sourceTaskId: string; destinationTaskId: string }>;
  actor: string;
  timestamp: string;
  semanticPlacement: string;
  /** Initial retiring Beads store/connection identity, once per migration. */
  beadsSourceIdentity?: Record<string, unknown>;
  /** Native memory outputs, separate from issue-only counts and mappings. */
  backlogMemoryOutputs?: BacklogMemoryOutputs;
}

export interface ProviderMigrationCompleted {
  status: "completed";
  receipt: ProviderMigrationReceipt;
  receiptTaskId: string;
  sourceAbsent: true;
  sourceBackupPath: string;
  selectedProvider: TaskProviderId;
  warnings?: string[];
}

export type ProviderMigrationResult = ProviderMigrationCompleted | ProviderMigrationBlocked;

export interface ProviderMigrationOptions {
  cwd: string;
  targetProvider: TaskProviderId;
  expectedSourceRevision: string;
  confirmedSwitch: boolean;
  actor: string;
  semanticPlacement: string;
  runner?: CommandRunner;
  now?: () => string;
  signal?: AbortSignal;
  onProgress?: (phase: string, level?: "warning") => void;
  deleteSource?: (snapshot: SourceSnapshot, runner: CommandRunner) => void;
  verifyActiveRuntime?: (records: readonly TaskEpisodeOwnershipRecord[]) => Promise<Array<{
    ownerSessionId: string;
    expectedPreviousEpisodeActiveSessionId: string;
    verifiedCurrentEpisodeActiveSessionId: string;
  }>>;
}

class PreCutoverStop extends Error {
  constructor() { super("Operator stop requested before ownership cutover."); }
}

type MigrationCheckpoint = (phase?: string) => Promise<void>;

type NativeCommand = { stdout: string; stderr: string; status: number; errorCode?: string | number; nativeStatus?: number | null; signal?: string | null };
type JsonObject = Record<string, any>;

interface BeadsMemoryRow {
  _type: "memory";
  key: string;
  value: string;
}

type BeadsExportEntry =
  | { kind: "issue"; row: JsonObject; line: string }
  | { kind: "memory"; row: BeadsMemoryRow; line: string };

interface BeadsMemoryPackage {
  exportRow: BeadsMemoryRow;
  exportLineBase64: string;
}

interface BeadsTaskPackage {
  sourceTaskId: string;
  classification: "open" | "closed" | "archived";
  exportRow: JsonObject;
  exportLineBase64: string;
  nativeView: JsonObject;
}

interface BeadsSnapshot {
  provider: "beads";
  projectRoot: string;
  evidence: BeadsProviderEvidence;
  /** Native store/connection identity, without active-provider publication requirements. */
  sourceIdentity: JsonObject;
  sourceVersion: string;
  statusCatalog: JsonObject;
  revision: string;
  digest: string;
  tasks: BeadsTaskPackage[];
  memories: BeadsMemoryPackage[];
  counts: { open: number; closed: number; archived: number; total: number };
}

export type SourceSnapshot = BeadsSnapshot;

interface DestinationTask {
  sourceTaskId: string;
  destinationTaskId: string;
  taskPath?: string;
  taskEvidence: JsonObject;
}

interface DestinationCandidate {
  provider: TaskProviderId;
  revision: string;
  digest: string;
  receiptBase: Omit<ProviderMigrationReceipt, "destinationReceiptRevision">;
  receiptTaskId: string;
  tasks: DestinationTask[];
  refreshAfterReceipt: () => { revision: string; digest: string; tasks: DestinationTask[]; receiptTaskId: string };
  prepareActiveWorktree: (worktree: string, sourceTaskId: string) => void;
}

function blocked(
  code: string,
  detail: string,
  remediation: string,
  context: Omit<ProviderMigrationBlocked, "status" | "code" | "detail" | "remediation"> = {},
): ProviderMigrationBlocked {
  return { status: "blocked", code, detail, remediation, ...context };
}

// Only this existing command boundary distinguishes transport from native data.
// Never include argv by default: destination commands can carry source packages.
class MigrationCommandFailure extends Error {}

function boundedDiagnostic(value: string, limit: number): string {
  const safe = value.replace(/[\x00-\x1f\x7f]/g, " ");
  return safe.length > limit ? `${safe.slice(0, limit - 3)}...` : safe;
}

function commandFailure(label: string, result: NativeCommand): string {
  const metadata = [
    `status=${result.status}`,
    ...(result.errorCode === undefined ? [] : [`code=${boundedDiagnostic(String(result.errorCode), 64)}`]),
    ...(result.nativeStatus === undefined ? [] : [`nativeStatus=${result.nativeStatus}`]),
    ...(result.signal === undefined ? [] : [`signal=${boundedDiagnostic(String(result.signal), 32)}`]),
  ];
  const stderr = boundedDiagnostic(result.stderr.trim(), 256);
  return boundedDiagnostic(`${boundedDiagnostic(label, 192)}: command/capture failed (${metadata.join(", ")})${stderr ? `; stderr: ${stderr}` : ""}`, 768);
}

/** One file-backed seam reaches discovery, source capture and every recapture. */
function migrationRunner(supplied?: CommandRunner): CommandRunner {
  const processRunner = new ProcessCommandRunner();
  return {
    run(command, args, options) {
      // Supplied runners keep their existing seam, including synthetic runners.
      const captureOptions = { ...options, allowFailure: true };
      // BACKLOG_CWD overrides cwd natively. Pin only this synchronous migration
      // call, including supplied runners, and restore the ambient value before
      // returning. The owned async Web transport snapshots its own explicit env.
      const previousBacklogCwd = process.env.BACKLOG_CWD;
      let result: NativeCommand;
      try {
        if (command === "backlog" && options?.cwd) process.env.BACKLOG_CWD = options.cwd;
        result = supplied ? supplied.run(command, args, captureOptions) : processRunner.runFileBacked(command, args, captureOptions);
      } finally {
        if (command === "backlog") {
          if (previousBacklogCwd === undefined) delete process.env.BACKLOG_CWD;
          else process.env.BACKLOG_CWD = previousBacklogCwd;
        }
      }
      // Resource/spawn failures must not be mistaken for a negative discovery
      // probe. Nonzero native-provider commands also cannot certify source data.
      // Ordinary negative Git existence/ancestry probes retain their semantics.
      if (result.errorCode !== undefined || result.nativeStatus === null || result.signal
          || (result.status !== 0 && (options?.allowFailure !== true || ["bd", "backlog", "dolt"].includes(command)))) {
        throw new MigrationCommandFailure(commandFailure(`${basename(command)} command`, result));
      }
      return result;
    },
  };
}

function runRequired(runner: CommandRunner, command: string, args: string[], cwd: string, label = `${basename(command)} command`): NativeCommand {
  let result: NativeCommand;
  try {
    result = runner.run(command, args, { cwd, allowFailure: true });
  } catch (error) {
    // The adapter's diagnostic is already payload-safe; retain this operation's
    // explicit safe label without exposing argv or unclassified runner errors.
    if (error instanceof MigrationCommandFailure) {
      throw new MigrationCommandFailure(boundedDiagnostic(`${boundedDiagnostic(label, 192)}: ${error.message}`, 768));
    }
    throw error;
  }
  if (result.status !== 0 || result.errorCode !== undefined || result.nativeStatus === null || result.signal) {
    throw new MigrationCommandFailure(commandFailure(label, result));
  }
  return result;
}

function parseJson(text: string, label: string): any {
  try { return JSON.parse(text); }
  catch { throw new Error(`${boundedDiagnostic(label, 192)} returned invalid JSON; complete native data must be readable JSON`); }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function updateCanonicalHash(
  hash: ReturnType<typeof createHash>,
  value: unknown,
  context: "root" | "array" | "object" = "root",
): void {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded !== undefined) hash.update(encoded);
    else if (context === "object") hash.update("undefined");
    else if (context === "root") throw new TypeError("canonical SHA-256 requires a serializable root value");
    return;
  }
  if (Array.isArray(value)) {
    hash.update("[");
    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) hash.update(",");
      updateCanonicalHash(hash, value[index], "array");
    }
    hash.update("]");
    return;
  }
  const record = value as Record<string, unknown>;
  hash.update("{");
  const keys = Object.keys(record).sort();
  for (let index = 0; index < keys.length; index += 1) {
    if (index > 0) hash.update(",");
    const key = keys[index];
    hash.update(JSON.stringify(key));
    hash.update(":");
    updateCanonicalHash(hash, record[key], "object");
  }
  hash.update("}");
}

export function canonicalSha256(value: unknown): string {
  const hash = createHash("sha256");
  updateCanonicalHash(hash, value);
  return hash.digest("hex");
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function exactTaskId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value || /\s/.test(value) || value.startsWith("-")) throw new Error(`${label} has no exact canonical task ID`);
  return value;
}

function asObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} is not a JSON object`);
  return value as JsonObject;
}

function contained(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function cleanGitRevision(runner: CommandRunner, repositoryRoot: string): string {
  const status = runRequired(runner, "git", ["--no-optional-locks", "-C", repositoryRoot, "status", "--porcelain=v1"], repositoryRoot, "git source cleanliness");
  if (status.stdout !== "") throw new Error(`source task history is not clean: ${status.stdout.trim()}`);
  const revision = runRequired(runner, "git", ["-C", repositoryRoot, "rev-parse", "HEAD"], repositoryRoot, "git source revision").stdout.trim();
  if (!GIT_OID.test(revision)) throw new Error("source task history did not return an exact Git revision");
  return revision;
}

function assertPublishedGitRef(
  runner: CommandRunner,
  repositoryRoot: string,
  revision: string,
  remoteName: string,
  remoteUrl: string,
  ref: string,
  label: string,
): void {
  const urls = runRequired(runner, "git", ["-C", repositoryRoot, "remote", "get-url", "--all", remoteName], repositoryRoot, `${label} remote URL`)
    .stdout.split(/\r?\n/).filter(Boolean);
  if (urls.length !== 1 || urls[0] !== remoteUrl) throw new Error(`${label} remote authority changed`);
  const direct = runRequired(runner, "git", ["-C", repositoryRoot, "ls-remote", "--exit-code", "--refs", remoteName, ref], repositoryRoot, label);
  const rows = direct.stdout.trim().split(/\r?\n/).filter(Boolean);
  if (rows.length !== 1 || rows[0] !== `${revision}\t${ref}`) throw new Error(`${label} does not equal exact revision ${revision}`);
}

function walkTaskFiles(storeDir: string): string[] {
  const files: string[] = [];
  const walk = (folder: string) => {
    if (!existsSync(folder)) return;
    for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`task source contains a symlink: ${path}`);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
    }
  };
  for (const dir of BACKLOG_TASK_DIRS) walk(join(storeDir, ...dir.split("/")));
  return files.sort();
}

function backlogTaskId(markdown: string, path: string): string {
  const match = /^id:\s*['"]?([^'"\r\n]+)['"]?\s*$/m.exec(markdown);
  return exactTaskId(match?.[1]?.trim(), `Backlog task ${path}`);
}

function backlogTaskView(runner: CommandRunner, projectRoot: string, taskId: string): JsonObject {
  const result = runRequired(runner, "backlog", ["task", "view", "--json", "--", taskId], projectRoot, `backlog task view ${taskId}`);
  const wrapper = asObject(parseJson(result.stdout, `backlog task view ${taskId}`), `backlog task view ${taskId}`);
  const task = asObject(wrapper.task, `backlog task view ${taskId}.task`);
  if (task.id !== taskId || typeof task.path !== "string" || !task.path) throw new Error(`Backlog task ${taskId} returned mismatched identity/path`);
  return wrapper;
}

function jsonCommand(runner: CommandRunner, command: string, args: string[], cwd: string, label: string): unknown {
  return parseJson(runRequired(runner, command, args, cwd, label).stdout, label);
}

/** Complete migration inventory without source configuration changes or SQL. */
export function completeBeadsExport(runner: CommandRunner, projectRoot: string, label: string): BeadsExportEntry[] {
  const result = runRequired(runner, "bd", ["--readonly", "export", "--all"], projectRoot, `${label} complete export`);
  const exported = result.stdout.split(/\r?\n/).filter((line) => line.trim() !== "").map((line): BeadsExportEntry => {
    const row = asObject(parseJson(line, `${label} export row`), `${label} export row`);
    // Native typed issues and supported older untagged issues share identity
    // checks. Only native memory records are exempt; unknown types must refuse.
    if (!Object.hasOwn(row, "_type") || row._type === "issue") return { kind: "issue", row, line };
    if (row._type !== "memory") throw new Error(`${label} export row has unsupported native record type`);
    if (canonical(Object.keys(row).sort()) !== canonical(["_type", "key", "value"])
        || typeof row.key !== "string" || !row.key || typeof row.value !== "string") {
      throw new Error(`${label} export row has malformed native memory record`);
    }
    return { kind: "memory", row: row as unknown as BeadsMemoryRow, line };
  });
  const inventory = jsonCommand(
    runner,
    "bd",
    ["--readonly", "list", "--all", "--limit", "0", "--include-infra", "--include-templates", "--include-gates", "--include-ephemeral", "--json"],
    projectRoot,
    `${label} independent issue inventory`,
  );
  if (!Array.isArray(inventory)) throw new Error(`${label} independent issue inventory is not an array`);
  const inventoryIds = inventory.map((value) => exactTaskId(asObject(value, `${label} inventory row`).id, `${label} inventory row`)).sort();
  const exportIds = exported.filter((entry) => entry.kind === "issue")
    .map(({ row }) => exactTaskId(row.id, `${label} export row`)).sort();
  if (new Set(inventoryIds).size !== inventoryIds.length || new Set(exportIds).size !== exportIds.length
      || canonical(inventoryIds) !== canonical(exportIds)) {
    throw new Error(`${label} export does not exactly match the independent native issue inventory`);
  }
  return exported;
}

/** Migration reads bind the native store, not active lifecycle/write readiness. */
function beadsSourceIdentity(projectRoot: string, evidence: BeadsProviderEvidence, runner: CommandRunner): JsonObject {
  const repositoryRoot = dirname(evidence.storeDir);
  const selected = detectExplicitTaskProvider(repositoryRoot, "beads", runner);
  if (selected.kind !== "selected" || selected.evidence.provider !== "beads"
      || canonical(selected.evidence) !== canonical(evidence)) {
    throw new Error("Beads source store identity changed or became unreadable");
  }
  const context = asObject(jsonCommand(runner, "bd", ["--readonly", "context", "--json"], projectRoot, "Beads source context"), "Beads source context");
  if (context.schema_version !== 1 || context.backend !== "dolt"
      || context.repo_root !== repositoryRoot || context.cwd_repo_root !== projectRoot
      || context.beads_dir !== evidence.storeDir || context.database !== evidence.doltDatabase
      || context.is_redirected !== false || context.dolt_mode !== evidence.doltMode
      || (context.dolt_mode !== "embedded" && context.dolt_mode !== "server")) {
    throw new Error("Beads source context does not match the selected repository, store, database and mode");
  }
  const connection = asObject(jsonCommand(runner, "bd", ["--readonly", "dolt", "show", "--json"], projectRoot, "Beads source connection"), "Beads source connection");
  if (connection.schema_version !== 1 || connection.backend !== "dolt"
      || connection.database !== context.database || connection.embedded !== (context.dolt_mode === "embedded")) {
    throw new Error("Beads source connection does not match the selected database and mode");
  }
  // Exclude per-invocation cwd/worktree flags and transient connection health.
  // The same native store must compare identically from its linked Episodes.
  return {
    repositoryRoot, storeDir: evidence.storeDir, database: context.database, doltMode: context.dolt_mode,
    connection: Object.fromEntries(["database", "embedded", "data_dir", "host", "port", "user", "shared_server", "branch"]
      .filter((key) => Object.hasOwn(connection, key)).map((key) => [key, connection[key]])),
  };
}

function captureBeads(
  projectRoot: string,
  evidence: BeadsProviderEvidence,
  runner: CommandRunner,
): BeadsSnapshot {
  const sourceIdentity = beadsSourceIdentity(projectRoot, evidence, runner);
  const sourceVersion = runRequired(runner, "bd", ["--version"], projectRoot, "Beads source version").stdout;
  const statusCatalog = asObject(
    jsonCommand(runner, "bd", ["--readonly", "statuses", "--json"], projectRoot, "Beads source status catalog"),
    "Beads source status catalog",
  );
  const exported = completeBeadsExport(runner, projectRoot, "Beads source");
  const memories = exported.filter((entry) => entry.kind === "memory").map(({ line, row }): BeadsMemoryPackage => ({
    exportRow: row,
    exportLineBase64: Buffer.from(line).toString("base64"),
  }));
  const tasks = exported.filter((entry) => entry.kind === "issue").map(({ line, row: exportRow }): BeadsTaskPackage => {
    const taskId = exactTaskId(exportRow.id, "Beads export row");
    const rawView = jsonCommand(runner, "bd", ["--readonly", "show", taskId, "--json", "--long", "--include-comments"], projectRoot, `bd show ${taskId}`);
    const views = Array.isArray(rawView) ? rawView : [];
    if (views.length !== 1) throw new Error(`bd show ${taskId} did not return one exact native task`);
    const nativeView = asObject(views[0], `bd show ${taskId}`);
    if (nativeView.id !== taskId) throw new Error(`bd show ${taskId} returned a different ID`);
    // Authored comments are current ticket content in the long native view.
    // Revision snapshots/events/provenance logs are not migration prerequisites.
    return {
      sourceTaskId: taskId,
      classification: "open",
      exportRow,
      exportLineBase64: Buffer.from(line).toString("base64"),
      nativeView,
    };
  }).sort((a, b) => a.sourceTaskId.localeCompare(b.sourceTaskId));
  if (new Set(tasks.map((task) => task.sourceTaskId)).size !== tasks.length) throw new Error("Beads source export repeats a canonical task ID");
  // Inspect the complete used inventory before any destination preparation. Every
  // recapture uses this same preflight; unused catalog entries remain raw context.
  validateBeadsTaskLifecycles(tasks);
  validateBeadsRelationshipTargets(tasks);
  const counts = {
    open: tasks.filter((task) => task.classification === "open").length,
    closed: tasks.filter((task) => task.classification === "closed").length,
    archived: tasks.filter((task) => task.classification === "archived").length,
    total: tasks.length,
  };
  const digest = canonicalSha256({ sourceIdentity, sourceVersion, statusCatalog, tasks, memories });
  return {
    provider: "beads", projectRoot, evidence, sourceIdentity,
    sourceVersion, statusCatalog,
    revision: `capture-sha256:${digest}`, digest, tasks, memories, counts,
  };
}

/** Native Backlog relationships may target archived records as well as active work. */
function validateBeadsRelationshipTargets(tasks: BeadsTaskPackage[]): void {
  const byId = new Map(tasks.map((task) => [task.sourceTaskId, task]));
  const problems: string[] = [];
  for (const pkg of tasks) {
    const parent = typeof pkg.nativeView.parent === "string" ? pkg.nativeView.parent : pkg.exportRow.parent;
    const targets = [...beadsRelationships(pkg).map(({ id, type }) => ({ id, kind: `${type} relationship` })),
      ...(typeof parent === "string" && parent ? [{ id: parent, kind: "parent" }] : [])];
    for (const { id, kind } of targets) {
      if (id === pkg.sourceTaskId) problems.push(`${pkg.sourceTaskId} ${kind} ${id}: self target`);
      else if (!byId.has(id)) problems.push(`${pkg.sourceTaskId} ${kind} ${id}: missing from complete source inventory`);
    }
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string, chain: string[]) => {
    if (visiting.has(id)) { problems.push(`dependency cycle: ${[...chain, id].join(" -> ")}`); return; }
    if (visited.has(id) || !byId.has(id)) return;
    visiting.add(id);
    for (const target of dependencyIds(byId.get(id)!)) visit(target, [...chain, id]);
    visiting.delete(id); visited.add(id);
  };
  for (const id of byId.keys()) visit(id, []);
  // Existing parent sorter supplies the exact source hierarchy cycle diagnostic.
  topologicalBeadsPackages(tasks);
  if (problems.length) throw new Error(`Beads source relationship preflight failed: ${problems.join("; ")}`);
}

function captureSelectedSource(projectRoot: string, runner: CommandRunner): BeadsSnapshot {
  const detection = detectTaskProvider(projectRoot, runner);
  if (detection.kind !== "selected" || detection.evidence.provider !== "beads") {
    throw new Error("Beads-to-Backlog migration requires a readable Beads source store" +
      (detection.kind === "blocked" ? `: ${detection.detail}` : ""));
  }
  return captureBeads(projectRoot, detection.evidence, runner);
}

function captureSameSource(source: BeadsSnapshot, runner: CommandRunner): BeadsSnapshot {
  return captureBeads(source.projectRoot, source.evidence, runner);
}

function exactSnapshotUnchanged(before: SourceSnapshot, after: SourceSnapshot): void {
  if (before.provider !== after.provider || before.revision !== after.revision || before.digest !== after.digest
      || canonical(before.counts) !== canonical(after.counts)) {
    throw new Error(`source provider changed during the maintenance window (revision ${before.revision} -> ${after.revision}, digest ${before.digest} -> ${after.digest})`);
  }
}

interface ActiveMigrationOwnership {
  ownerSessionId: string;
  taskId: string;
  worktree: string;
  record: TaskEpisodeOwnershipRecord;
}

function activeOwnership(projectRoot: string, source: BeadsSnapshot, runner: CommandRunner): ActiveMigrationOwnership[] {
  const registry = readEpisodeOwnershipRegistry(projectRoot);
  const rows: ActiveMigrationOwnership[] = [];
  const taskIds = new Set(source.tasks.map(({ sourceTaskId }) => sourceTaskId));
  for (const [ownerSessionId, record] of Object.entries(registry.owners)) {
    if (record.version === 1 || record.status === "inactive") continue;
    if (record.status !== "active" || taskEpisodeProvider(record) !== "beads" || !taskIds.has(record.taskId)) {
      throw new Error(`task Episode ${ownerSessionId} has no active Beads ownership mapped by this source`);
    }
    assertNoLocalBacklogMigrationDestination(record.worktree);
    verifyMigrationEpisodeWorktree(projectRoot, record.worktree, runner);
    beadsSourceIdentity(record.worktree, source.evidence, runner);
    rows.push({ ownerSessionId, taskId: record.taskId, worktree: record.worktree, record });
  }
  return rows;
}

function semanticPrompt(): string {
  return "Review exact current Beads fields that have no native Backlog equivalent. Supply concise semantic-placement prose for human-readable placement without omitting required content. Preserve current tickets, meaningful metadata, authored comments and relationships; do not import prior revisions, events or provenance logs.";
}

export function inspectTaskProviderMigration(options: {
  cwd: string;
  targetProvider: TaskProviderId;
  runner?: CommandRunner;
}): ProviderMigrationInspection | ProviderMigrationBlocked {
  const runner = migrationRunner(options.runner);
  try {
    if (options.targetProvider !== "backlog") return blocked("unsupported-direction", "provider migration supports only Beads-to-Backlog", "request an explicit Beads-to-Backlog inspection; reverse migration is not supported", { targetProvider: options.targetProvider });
    const project = resolveNearestProjectRoot(options.cwd, process.env.HOME ?? "", runner);
    if (project.kind === "linked-worktree") return blocked("primary-required", "provider migration must run from the canonical primary checkout", "run the initialize-prime-claw skill from the canonical primary Conversation", { targetProvider: options.targetProvider });
    assertFreshBacklogMigrationDestination(project.root, runner);
    const source = captureSelectedSource(project.root, runner);
    const ownership = activeOwnership(project.root, source, runner);
    return {
      status: "ready",
      projectRoot: project.root,
      sourceProvider: source.provider,
      targetProvider: options.targetProvider,
      sourceRevision: source.revision,
      sourceDigest: source.digest,
      taskCounts: source.counts,
      activeOwnership: ownership.map(({ ownerSessionId, taskId }) => ({ ownerSessionId, taskId })),
      semanticPlacementPrompt: semanticPrompt(),
      confirmation: `Confirm one-way ${source.provider}->${options.targetProvider} migration at exact source revision ${source.revision}; all task mutations must remain quiesced until the operation finishes.`,
    };
  } catch (error) {
    return blocked("preflight", error instanceof Error ? error.message : String(error),
      error instanceof MigrationCommandFailure
        ? "resolve the reported command/capture or resource failure, preserve the source intact, then request a new migration inspection; do not trim required current content or repair readable source data"
        : "repair the exact invalid or incomplete native source/publication evidence, then request a new migration inspection",
      { targetProvider: options.targetProvider });
  }
}

function statusFromBeads(value: unknown): CanonicalLifecycleStatus {
  const status = String(value ?? "");
  const found = Object.entries(BEADS_STATUS_MAP).find(([, mapping]) => mapping.name === status)?.[0];
  if (found) return found as CanonicalLifecycleStatus;
  if (status === "open" || status === "deferred") return "In Design";
  if (status === "closed") return "Done";
  throw new Error(`Beads task has unmapped status ${JSON.stringify(status)}`);
}

/** Existing native archive evidence only; reasons/categories are not classifiers. */
function validateBeadsTaskLifecycles(tasks: BeadsTaskPackage[]): void {
  const problems: string[] = [];
  for (const pkg of tasks) {
    const status = String(pkg.nativeView.status ?? pkg.exportRow.status ?? "");
    let projectedStatus: CanonicalLifecycleStatus | undefined;
    try {
      projectedStatus = statusFromBeads(status);
    } catch {
      problems.push(`${pkg.sourceTaskId} status=${JSON.stringify(status)}: unsupported status`);
    }
    let archived = false;
    let ambiguous = false;
    // Inspect both retained native surfaces. A malformed claimed archive must
    // not disappear merely because the other surface lacks that evidence.
    for (const row of [pkg.nativeView, pkg.exportRow]) {
      const prior = beadsMigrationMetadata(row);
      const path = prior?.relativePath;
      const claimsArchive = prior && (prior.classification === "archived"
        || (typeof path === "string" && /(?:^|\/)archive\/(?:tasks|drafts)(?:\/|$)/.test(path)));
      if (claimsArchive) {
        const sourceId = prior.sourceTaskId;
        const kind = prior.entityKind;
        const safePath = typeof path === "string" && !isAbsolute(path)
          && !path.includes("\\") && !path.split("/").some((part) => !part || part === "." || part === "..");
        const archiveFolder = kind === "task" ? "tasks" : kind === "draft" ? "drafts" : null;
        const exact = prior.marker === SOURCE_MARKER && prior.sourceProvider === "backlog"
          && prior.classification === "archived" && typeof sourceId === "string"
          && sourceId !== "" && !/\s/.test(sourceId) && !sourceId.startsWith("-")
          && archiveFolder !== null && safePath
          && new RegExp(`(?:^|/)archive/${archiveFolder}/[^/]+\\.md$`).test(path)
          && prior.nativeView?.task?.id === sourceId;
        if (exact) archived = true;
        else ambiguous = true;
      }
      const reason = row.close_reason;
      if (typeof reason === "string" && reason.startsWith("Prime Claw abandonment:")) {
        const match = /^Prime Claw abandonment: task ([^;]+); pushed Episode head ([0-9a-f]{40,64}); code was not merged\.$/.exec(reason);
        if (match && match[1] === pkg.sourceTaskId) archived = true;
        else ambiguous = true;
      }
    }
    if (ambiguous) problems.push(`${pkg.sourceTaskId} status=${JSON.stringify(status)}: ambiguous archive evidence`);
    pkg.classification = archived ? "archived" : projectedStatus === "Done" ? "closed" : "open";
  }
  if (problems.length) throw new Error(`Beads source lifecycle preflight failed: ${problems.join("; ")}`);
}

function beadsMigrationMetadata(row: JsonObject): JsonObject | null {
  const metadata = row.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    && (metadata as JsonObject).prime_claw_migration && typeof (metadata as JsonObject).prime_claw_migration === "object"
    ? (metadata as JsonObject).prime_claw_migration as JsonObject : null;
}

function migrationReceiptBase(source: SourceSnapshot, target: TaskProviderId, destinationRevision: string, destinationDigest: string,
  mappings: Array<{ sourceTaskId: string; destinationTaskId: string }>, ownership: Array<{ ownerSessionId: string; sourceTaskId: string; destinationTaskId: string }>,
  actor: string, timestamp: string, semanticPlacement: string): Omit<ProviderMigrationReceipt, "destinationReceiptRevision"> {
  return {
    schemaVersion: 1,
    marker: RECEIPT_MARKER,
    sourceProvider: source.provider,
    targetProvider: target,
    sourceRevision: source.revision,
    sourceDigest: source.digest,
    destinationDataRevision: destinationRevision,
    destinationDataDigest: destinationDigest,
    taskCounts: source.counts,
    mappings,
    ownershipTransitions: ownership,
    actor,
    timestamp,
    semanticPlacement,
  };
}

function backlogCreateId(output: string): string {
  const heading = /^Task ([A-Z][A-Z0-9_-]*-\d+(?:\.\d+)*) -/m.exec(output);
  if (heading) return heading[1];
  const matches = output.match(/\b[A-Za-z][A-Za-z0-9_-]*-\d+(?:\.\d+)*\b/g) ?? [];
  const ids = [...new Set(matches.map((value) => value.toUpperCase()))];
  if (ids.length !== 1) throw new Error(`Backlog create did not report one exact task ID: ${JSON.stringify(output.trim())}`);
  return ids[0];
}

interface BacklogMemoryDocument {
  docId: string;
  path: string;
  body: string;
}

/** Native output evidence, separate from source issue identities and mappings. */
export interface BacklogMemoryOutputs {
  documents: BacklogMemoryDocument[];
  index?: BacklogMemoryDocument;
  userTask?: { taskId: string; title: string; description: string; path: string; nativeView: JsonObject };
}

type BeadsMemorySource = Pick<BeadsSnapshot, "projectRoot" | "sourceIdentity" | "revision" | "digest" | "memories">;

function memoryTextBlock(text: string): string {
  // argv cannot contain NUL. Show controls visibly; the complete JSON row below
  // remains the lossless representation, including whitespace and control bytes.
  const readable = text.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, (char) => JSON.stringify(char).slice(1, -1));
  const fence = "`".repeat(Math.max(3, ...[...readable.matchAll(/`+/g)].map((match) => match[0].length + 1)));
  return `${fence}text\n${readable}\n${fence}`;
}

function createBacklogMemoryDocument(runner: CommandRunner, projectRoot: string, title: string, body: string): BacklogMemoryDocument {
  const created = runRequired(runner, "backlog", ["doc", "create", title, "--plain"], projectRoot, "create imported Beads memory document");
  const identity = /^Created document (doc-\d+)\nPath: ([^\r\n]+)\n?$/.exec(created.stdout);
  if (!identity || isAbsolute(identity[2]) || identity[2].split("/").includes("..") || !identity[2].includes("/docs/")) {
    throw new Error("Backlog memory document create did not return one native ID/path");
  }
  const [, docId, path] = identity;
  const updated = runRequired(runner, "backlog", ["doc", "update", docId, `--content=${body}`], projectRoot, `write Backlog memory document ${docId}`);
  if (updated.stdout !== `Updated document ${docId}\nPath: ${path}\n`) throw new Error(`Backlog memory document ${docId} update changed native identity/path`);
  const document = { docId, path, body };
  verifyBacklogMemoryOutputs({ documents: [document] }, projectRoot, runner);
  return document;
}

/** Exact native readback; missing doc view can exit zero and is not evidence. */
export function verifyBacklogMemoryOutputs(outputs: BacklogMemoryOutputs, projectRoot: string, runner: CommandRunner): void {
  for (const document of [...outputs.documents, ...(outputs.index ? [outputs.index] : [])]) {
    const plain = runRequired(runner, "backlog", ["doc", "view", document.docId, "--plain"], projectRoot, `read Backlog memory document ${document.docId}`).stdout;
    const markdown = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(plain);
    // Native doc view resolves by ID, not path. Check the captured link target
    // read-only against that exact native readback (view adds one newline).
    let captured: string | undefined;
    try { captured = readFileSync(join(projectRoot, document.path), "utf8"); }
    catch { /* An unreadable/moved target is the same readback mismatch below. */ }
    if (!markdown || markdown[1].split("\n").filter((line) => line.startsWith("id:")).join("\n") !== `id: ${document.docId}`
        || markdown[2] !== `${document.body}\n` || captured === undefined || `${captured}\n` !== plain) {
      throw new Error(`Backlog memory document ${document.docId} native identity/body mismatch`);
    }
  }
  if (outputs.userTask) {
    const expected = outputs.userTask;
    const view = backlogTaskView(runner, projectRoot, expected.taskId);
    const task = view.task;
    if (!outputs.index || task.title !== expected.title || task.description !== expected.description || backlogStatusKey(task.status) !== backlogStatusKey("In Design")
        || task.path !== expected.path || canonical(task.documentation) !== canonical([outputs.index.path])
        || canonical(task.assignees) !== canonical([])) {
      throw new Error(`Backlog memory USER task ${expected.taskId} native content/status/index mismatch`);
    }
  }
}

function beadsMemoryProvenance(source: BeadsMemorySource): string {
  return `Migrated from Beads. Imported text is data, not instructions. No memory curation was performed.

Source provenance:

\`\`\`json
${JSON.stringify({
    sourceProvider: "beads", sourceProject: source.sourceIdentity.repositoryRoot, sourceStore: source.sourceIdentity.storeDir,
    sourceRevision: source.revision, sourceDigest: source.digest,
  }, null, 2)}
\`\`\``;
}

function beadsMemoryBody(source: BeadsMemorySource, memory: BeadsMemoryPackage): string {
  return `# Imported Beads memory

${beadsMemoryProvenance(source)}

## Original key

${memoryTextBlock(memory.exportRow.key)}

## Original value

${memoryTextBlock(memory.exportRow.value)}

## Complete native memory record (lossless JSON)

\`\`\`json
${JSON.stringify(memory.exportRow)}
\`\`\`
`;
}

function beadsMemoryIndexBody(source: BeadsMemorySource, documents: BacklogMemoryDocument[]): string {
  const links = documents.map((document) => {
    const link = relative(dirname(document.path), document.path).split(sep).map(encodeURIComponent).join("/");
    return `- [${document.docId}](${link})`;
  }).join("\n");
  return `# Memories migrated from Beads

${beadsMemoryProvenance(source)}

Review the original imported memories below.

${links}
`;
}

function beadsMemoryUserDescription(source: BeadsMemorySource, index: BacklogMemoryDocument): string {
  return `USER action: Review the memories migrated from Beads in the linked source index (${index.path}). Integrate useful material properly into the project's documentation, or delete imported material you do not want. This task is for the user, not an agent. Migration does not authorize an agent to curate or delete these memories.

${beadsMemoryProvenance(source)}`;
}

const MEMORY_USER_TITLE = "USER: Review imported Beads memories and integrate or delete";

/** Pair-specific native writer; returned identities join the existing receipt. */
export function importBeadsMemoryDocuments(source: BeadsMemorySource, runner: CommandRunner, taskType = "task"): BacklogMemoryOutputs {
  const outputs: BacklogMemoryOutputs = { documents: [] };
  if (!source.memories.length) return outputs;
  for (const [index, memory] of source.memories.entries()) {
    outputs.documents.push(createBacklogMemoryDocument(runner, source.projectRoot, `Imported Beads memory ${index + 1}`, beadsMemoryBody(source, memory)));
  }
  outputs.index = createBacklogMemoryDocument(runner, source.projectRoot, "Imported Beads memories source index", beadsMemoryIndexBody(source, outputs.documents));
  const title = MEMORY_USER_TITLE;
  const description = beadsMemoryUserDescription(source, outputs.index);
  const created = runRequired(runner, "backlog", ["task", "create", title, "--status", "In Design", "--type", taskType, "--description", description,
    "--doc", outputs.index.path, "--no-dod-defaults", "--plain"], source.projectRoot, "create one USER memory review task");
  const taskId = backlogCreateId(created.stdout);
  const nativeView = backlogTaskView(runner, source.projectRoot, taskId);
  outputs.userTask = { taskId, title, description, path: nativeView.task.path, nativeView };
  verifyBacklogMemoryOutputs(outputs, source.projectRoot, runner);
  return outputs;
}

/** Read receipt-bound outputs against the exact source, never infer new identities. */
function assertBeadsMemorySourceOutputs(source: BeadsMemorySource, outputs: BacklogMemoryOutputs): void {
  const documents = [...outputs.documents, ...(outputs.index ? [outputs.index] : [])];
  if (outputs.documents.length !== source.memories.length
      || Boolean(outputs.index) !== Boolean(source.memories.length) || Boolean(outputs.userTask) !== Boolean(source.memories.length)
      || new Set(documents.map((doc) => doc.docId)).size !== documents.length
      || new Set(documents.map((doc) => doc.path)).size !== documents.length
      || outputs.documents.some((doc, index) => doc.body !== beadsMemoryBody(source, source.memories[index]))
      || (outputs.index && outputs.index.body !== beadsMemoryIndexBody(source, outputs.documents))
      || (outputs.userTask && (outputs.userTask.title !== MEMORY_USER_TITLE
        || outputs.userTask.description !== beadsMemoryUserDescription(source, outputs.index!)))) {
    throw new Error("Backlog memory outputs do not preserve the exact source collection/provenance/links");
  }
}

function backlogMemoryEvidence(source: BeadsMemorySource, outputs: BacklogMemoryOutputs, runner: CommandRunner): JsonObject {
  assertBeadsMemorySourceOutputs(source, outputs);
  verifyBacklogMemoryOutputs(outputs, source.projectRoot, runner);
  const documents = [...outputs.documents, ...(outputs.index ? [outputs.index] : [])].map((doc) => ({
    docId: doc.docId, path: doc.path, markdown: readFileSync(join(source.projectRoot, doc.path), "utf8"),
  }));
  const userTask = outputs.userTask ? backlogTaskView(runner, source.projectRoot, outputs.userTask.taskId) : undefined;
  if (outputs.userTask && canonical(userTask) !== canonical(outputs.userTask.nativeView)) throw new Error("Backlog memory USER task changed after native import");
  return { documents, ...(userTask ? { userTask } : {}) };
}

/** Local native readback is not publication: ignored files can leave Git clean. */
function assertCommittedBacklogMemoryOutputs(
  outputs: BacklogMemoryOutputs, projectRoot: string, storeDir: string, revisions: string[], runner: CommandRunner,
): void {
  const paths = [...outputs.documents, ...(outputs.index ? [outputs.index] : []), ...(outputs.userTask ? [outputs.userTask] : [])];
  for (const { path } of paths) {
    const localPath = resolve(projectRoot, path);
    if (!contained(storeDir, localPath)) throw new Error(`Backlog memory output is outside the published destination: ${path}`);
    const nativePath = relative(storeDir, localPath).replace(/\\/g, "/");
    // --no-filters hashes the exact native bytes, not an index/clean-filter view.
    const expected = runRequired(runner, "git", ["-C", storeDir, "hash-object", "--no-filters", "--", localPath], storeDir,
      `hash exact Backlog memory output ${path}`).stdout.trim();
    for (const revision of revisions) {
      if (!GIT_OID.test(revision)) throw new Error("Backlog memory publication requires an exact destination revision");
      const committed = runRequired(runner, "git", ["-C", storeDir, "rev-parse", "--verify", `${revision}:${nativePath}`], storeDir,
        `verify committed Backlog memory output ${path}`).stdout.trim();
      if (committed !== expected) throw new Error(`Backlog memory output ${path} committed bytes differ at ${revision}`);
    }
  }
}

function topologicalBeadsPackages(tasks: BeadsTaskPackage[]): BeadsTaskPackage[] {
  const byId = new Map(tasks.map((task) => [task.sourceTaskId, task]));
  const ordered: BeadsTaskPackage[] = [];
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (task: BeadsTaskPackage) => {
    if (visited.has(task.sourceTaskId)) return;
    if (visiting.has(task.sourceTaskId)) throw new Error(`Beads parent hierarchy contains a cycle at ${task.sourceTaskId}`);
    visiting.add(task.sourceTaskId);
    const parent = typeof task.nativeView.parent === "string" ? task.nativeView.parent : typeof task.exportRow.parent === "string" ? task.exportRow.parent : null;
    if (parent && byId.has(parent)) visit(byId.get(parent)!);
    visiting.delete(task.sourceTaskId); visited.add(task.sourceTaskId); ordered.push(task);
  };
  tasks.forEach(visit);
  return ordered;
}

function backlogDestinationViews(runner: CommandRunner, projectRoot: string, storeDir: string, phase: string): Map<string, JsonObject> {
  cleanGitRevision(runner, storeDir);
  // Inventory native paths; a fresh import never accepts a duplicate ID.
  const paths = backlogPhysicalTaskPaths(storeDir);
  const repositoryRoot = realpathSync(runRequired(runner, "git", ["-C", storeDir, "rev-parse", "--show-toplevel"], storeDir, `Backlog destination ${phase} Git identity`).stdout.trim());
  if (repositoryRoot !== realpathSync(storeDir) && repositoryRoot !== realpathSync(projectRoot)) throw new Error(`Backlog destination ${phase} has a foreign Git root ${repositoryRoot}`);
  try {
    // Archived drafts stay in the physical inventory and exact file/history
    // baseline. The native CLI has no archived-draft view; its absence alone
    // must not block migration or lead to a manufactured active view.
    return new Map([...paths].filter(([, matches]) => matches.length === 1 &&
      !relative(storeDir, matches[0]).replace(/\\/g, "/").startsWith("archive/drafts/")).map(([taskId, [path]]) => {
      const view = backlogTaskView(runner, projectRoot, taskId);
      if (realpathSync(resolve(projectRoot, view.task.path)) !== realpathSync(path)) {
        throw new Error(`Backlog task ${taskId} native path does not match its exact destination file`);
      }
      return [relative(storeDir, path).replace(/\\/g, "/"), view];
    }));
  } catch (error) {
    throw new Error(`Backlog destination ${phase} read failed (store=${existsSync(storeDir)}, config=${existsSync(join(storeDir, "config.yml"))}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Initial native references identify imports, never certify their content. */
function backlogCurrentSourceReference(view: JsonObject): { sourceTaskId: string; sourceRevision: string; sourceDigest: string } | undefined {
  const references = Array.isArray(view.task.references) ? view.task.references : [];
  const ids = references.filter((value: unknown) => typeof value === "string" && value.startsWith("prime-claw-beads-source:"));
  const current = references.filter((value: unknown) => typeof value === "string" && value.startsWith("prime-claw-beads-current:"));
  if (!ids.length && !current.length) return undefined;
  if (ids.length !== 1 || current.length !== 1) throw new Error("Backlog import has conflicting initial source references");
  let binding: JsonObject;
  try { binding = asObject(JSON.parse(current[0].slice("prime-claw-beads-current:".length)), "Backlog initial current binding"); }
  catch { throw new Error("Backlog import has unreadable initial source references"); }
  if (typeof binding.sourceTaskId !== "string" || !binding.sourceTaskId
      || ids[0] !== `prime-claw-beads-source:${binding.sourceTaskId}`
      || typeof binding.sourceRevision !== "string" || !binding.sourceRevision
      || typeof binding.sourceDigest !== "string" || !binding.sourceDigest) {
    throw new Error("Backlog import has inconsistent initial source references");
  }
  return { sourceTaskId: binding.sourceTaskId, sourceRevision: binding.sourceRevision, sourceDigest: binding.sourceDigest };
}

function backlogDestinationViewById(views: Map<string, JsonObject>, id: string, sourceTaskId?: string): JsonObject | undefined {
  const matches = [...views.values()].filter((view) => view.task.id === id && (sourceTaskId
    ? backlogCurrentSourceReference(view)?.sourceTaskId === sourceTaskId
    : (Array.isArray(view.task.comments) ? view.task.comments : []).some(isBacklogReceiptComment)));
  if (matches.length > 1) throw new Error(`Backlog migration identity ${id} repeats exact migration provenance`);
  return matches[0];
}

// Keep the existing native-alias comparison and the exact original ID/path.
function backlogPhysicalIdentity(id: string): string {
  return id.toUpperCase().replace(/^([A-Z]+)-([0-9]+(?:\.[0-9]+)*)$/, (_match, prefix: string, body: string) =>
    `${prefix}-${body.split(".").map((segment) => segment.replace(/^0+(?=[0-9])/, "")).join(".")}`);
}

function backlogPhysicalTaskPaths(storeDir: string): Map<string, string[]> {
  const paths = new Map<string, string[]>();
  for (const path of walkTaskFiles(storeDir)) {
    const markdown = readFileSync(path, "utf8");
    const id = backlogTaskId(markdown, path);
    const existing = [...paths.keys()].find((key) => backlogPhysicalIdentity(key) === backlogPhysicalIdentity(id)) ?? id;
    paths.set(existing, [...(paths.get(existing) ?? []), path]);
  }
  const rel = (path: string) => relative(storeDir, path).replace(/\\/g, "/");
  const conflicts = [...paths].filter(([, matches]) => matches.length > 1);
  if (conflicts.length) {
    throw new Error(`Backlog destination repeats canonical task IDs: ${conflicts.map(([id, matches]) => `${id}: ${matches.map(rel).join(", ")}`).join("; ")}`);
  }
  return paths;
}

function assertBacklogLifecyclePlacement(
  pkg: BeadsTaskPackage, id: string, view: JsonObject, storeDir: string, paths: Map<string, string[]>,
): string {
  const expectedStatus = statusFromBeads(pkg.nativeView.status ?? pkg.exportRow.status);
  if (backlogStatusKey(view.task.status) !== backlogStatusKey(expectedStatus)) throw new Error(`Backlog destination status projection mismatch for ${pkg.sourceTaskId}`);
  const matches = paths.get(id) ?? [];
  const folder = pkg.classification === "archived" ? "archive/tasks/" : "tasks/";
  if (matches.length !== 1 || !relative(storeDir, matches[0]).replace(/\\/g, "/").startsWith(folder)
      || !String(view.task.path).replace(/\\/g, "/").endsWith(relative(storeDir, matches[0]).replace(/\\/g, "/"))) {
    throw new Error(`Backlog destination physical placement mismatch for ${pkg.sourceTaskId}: expected one ${folder} record for ${id}`);
  }
  return matches[0];
}

function isBacklogReceiptComment(comment: JsonObject): boolean {
  const text = String(comment.text ?? comment.content ?? comment.body ?? "");
  return text === RECEIPT_MARKER || text.startsWith(`${RECEIPT_MARKER}\n`);
}

// Native create/edit canonicalizes case and ALL whitespace, retaining the first
// configured spelling. Do not manufacture semantic duplicate statuses.
function backlogStatusKey(value: unknown): string { return String(value ?? "").toLowerCase().replace(/\s/g, ""); }

function nativeBacklogComment(runner: CommandRunner, projectRoot: string, taskId: string, text: string, author: string): void {
  runRequired(runner, "backlog", ["task", "edit", "--comment", text, "--comment-author", author, "--plain", "--", taskId], projectRoot, `append Backlog provenance to ${taskId}`);
}

/** Lossless native configuration read; CLI config get joins lists with commas. */
async function beadsCurrentConfiguration(web: BeadsMigrationWeb): Promise<BeadsCurrentConfiguration> {
  const config = asObject(await web.readConfiguration(), "Backlog current configuration");
  const values = (key: "priorities" | "types" | "statuses"): string[] => {
    const value = config[key];
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
      throw new Error("Backlog current configuration has an invalid native priority/type list");
    }
    return value;
  };
  return { priorities: values("priorities"), types: values("types"), statuses: values("statuses") };
}

/** Same final current-content projection for authoring and readback. */
function beadsCurrentProjection(pkg: BeadsTaskPackage, source: BeadsSnapshot, mapping: Record<string, string>,
  configuration: BeadsCurrentConfiguration, semanticPlacement?: string) {
  const parentSource = typeof pkg.nativeView.parent === "string" ? pkg.nativeView.parent
    : typeof pkg.exportRow.parent === "string" ? pkg.exportRow.parent : "";
  const parentTaskId = parentSource ? mapping[parentSource] : undefined;
  if (parentSource && !parentTaskId) throw new Error(`Beads task ${pkg.sourceTaskId} parent has no destination mapping`);
  return projectBeadsCurrentTask(pkg, {
    sourceRevision: source.revision, sourceDigest: source.digest,
    status: configuration.statuses.find(value => backlogStatusKey(value) === backlogStatusKey(statusFromBeads(pkg.nativeView.status ?? pkg.exportRow.status)))
      ?? statusFromBeads(pkg.nativeView.status ?? pkg.exportRow.status),
    parentTaskId, dependencies: semanticPlacement !== undefined ? dependencyIds(pkg).map((sourceId) => mapping[sourceId] ?? sourceId) : [],
    relationshipComment: semanticPlacement !== undefined ? beadsRelationshipComment(pkg, mapping, semanticPlacement) : undefined,
    ...configuration,
  });
}

interface BeadsRelationship {
  id: string;
  type: string;
}

function beadsRelationships(pkg: BeadsTaskPackage): BeadsRelationship[] {
  const dependencies = Array.isArray(pkg.nativeView.dependencies)
    ? pkg.nativeView.dependencies
    : Array.isArray(pkg.exportRow.dependencies) ? pkg.exportRow.dependencies : [];
  return dependencies.map((dep: any): BeadsRelationship => {
    const id = typeof dep === "string" ? dep : String(dep.depends_on_id ?? dep.id ?? dep.issue_id ?? "");
    const rawType = typeof dep === "string" ? "blocks" : String(dep.dependency_type ?? dep.type ?? "blocks");
    return { id, type: rawType.trim().toLowerCase().replace(/_/g, "-") || "blocks" };
  }).filter(({ id }) => Boolean(id));
}

/** Backlog dependencies are hard ordering edges; other Beads types retain their own meaning. */
function dependencyIds(pkg: BeadsTaskPackage): string[] {
  return beadsRelationships(pkg).filter(({ type }) => type === "blocks").map(({ id }) => id);
}

function beadsRelationshipComment(
  pkg: BeadsTaskPackage,
  mapping: Record<string, string>,
  semanticPlacement: string,
): string | undefined {
  const relationships = beadsRelationships(pkg).filter(({ type }) => type !== "blocks" && type !== "parent-child");
  if (!relationships.length) return undefined;
  const lines = relationships.map(({ id, type }) => `- ${type}: ${id} -> ${mapping[id] ?? id}`);
  return `${SOURCE_RELATIONSHIP_MARKER}
Source Beads relationships with no native Backlog dependency equivalent:
${lines.join("\n")}

Semantic placement: ${semanticPlacement}`;
}

function commitBacklogDestination(runner: CommandRunner, prepared: ExplicitBacklogMigrationWorkspace, message: string): string {
  const { storeDir, remoteName, remoteUrl } = prepared;
  runRequired(runner, "git", ["-C", storeDir, "add", "-A"], storeDir, "stage Backlog destination");
  const status = runRequired(runner, "git", ["-C", storeDir, "status", "--porcelain=v1"], storeDir, "Backlog destination status");
  if (status.stdout.trim()) runRequired(runner, "git", ["-C", storeDir, "-c", "user.name=prime-claw", "-c", "user.email=prime-claw@localhost", "commit", "-m", message], storeDir, "commit Backlog destination");
  const head = cleanGitRevision(runner, storeDir);
  runRequired(runner, "git", ["-C", storeDir, "push", remoteName, `HEAD:${TASK_HISTORY_REF}`], storeDir, "publish Backlog destination");
  assertPublishedGitRef(runner, storeDir, head, remoteName, remoteUrl, TASK_HISTORY_REF, "Backlog destination direct publication");
  return head;
}

function ensureBacklogReceiptPlaceholder(runner: CommandRunner, projectRoot: string, source: BeadsSnapshot, taskType: string): string {
  const pending = { marker: RECEIPT_MARKER, pending: true, sourceProvider: "beads", targetProvider: "backlog", sourceRevision: source.revision, sourceDigest: source.digest };
  const created = runRequired(runner, "backlog", ["task", "create", RECEIPT_TITLE, "--status", "In Progress", "--type", taskType, "--notes", `\`\`\`json\n${JSON.stringify(pending, null, 2)}\n\`\`\``, "--no-dod-defaults", "--plain"], projectRoot, "reserve Backlog migration receipt identity");
  const id = backlogCreateId(created.stdout);
  nativeBacklogComment(runner, projectRoot, id, `${RECEIPT_MARKER}\nPending complete destination proof for ${source.revision}; this task becomes the sole final receipt.`, "prime-claw-migration");
  return id;
}

function createOrUpdateBacklogReceipt(runner: CommandRunner, projectRoot: string,
  receipt: Omit<ProviderMigrationReceipt, "destinationReceiptRevision">, receiptTaskId: string): string {
  runRequired(runner, "backlog", ["task", "edit", "--notes", backlogReceiptNotes(receipt), "--status", "Done", "--final-summary", "Verified selected-provider migration receipt", "--plain", "--", receiptTaskId], projectRoot, "update Backlog migration receipt");
  return receiptTaskId;
}

function backlogReceiptNotes(receipt: Omit<ProviderMigrationReceipt, "destinationReceiptRevision">): string {
  return `\`\`\`json
${JSON.stringify(receipt, null, 2)}
\`\`\``;
}

function assertExactBacklogReceipt(
  views: Map<string, JsonObject>,
  receiptTaskId: string,
  receipt: Omit<ProviderMigrationReceipt, "destinationReceiptRevision">,
): void {
  const view = backlogDestinationViewById(views, receiptTaskId);
  if (!view) throw new Error(`Backlog destination receipt ${receiptTaskId} is not exactly readable`);
  const task = asObject(view.task, `Backlog migration receipt ${receiptTaskId}`);
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const hasMarker = comments.some(isBacklogReceiptComment);
  if (task.id !== receiptTaskId || task.title !== RECEIPT_TITLE || backlogStatusKey(task.status) !== backlogStatusKey("Done")
      || task.implementationNotes !== backlogReceiptNotes(receipt)
      || task.finalSummary !== "Verified selected-provider migration receipt"
      || !hasMarker) {
    throw new Error(`Backlog destination receipt ${receiptTaskId} native payload does not exactly match the verified migration receipt`);
  }
}

type ExplicitBacklogMigrationWorkspace = ReturnType<typeof createFreshBacklogMigrationWorkspace>;

async function migrateBeadsToBacklog(
  source: BeadsSnapshot,
  runner: CommandRunner,
  actor: string,
  timestamp: string,
  semanticPlacement: string,
  ownershipRows: ActiveMigrationOwnership[],
  openWeb: OpenBeadsMigrationWeb,
  closeVerifiedWeb: () => Promise<void>,
  warn: (message: string) => void,
  checkpoint: MigrationCheckpoint,
): Promise<DestinationCandidate> {
  const prepared = createFreshBacklogMigrationWorkspace(source.projectRoot, runner, warn);
  const { storeDir } = prepared;
  const mapping: Record<string, string> = Object.create(null);
  await checkpoint("Importing and verifying Backlog tasks");
  let configuration: BeadsCurrentConfiguration;
  {
    const web = await openWeb(storeDir);
    configuration = await beadsCurrentConfiguration(web);
    for (const pkg of topologicalBeadsPackages(source.tasks)) {
      mapping[pkg.sourceTaskId] = await authorBeadsCurrentTask(web, beadsCurrentProjection(pkg, source, mapping, configuration));
    }
    for (const pkg of source.tasks) {
      const id = mapping[pkg.sourceTaskId];
      const projection = beadsCurrentProjection(pkg, source, mapping, configuration, semanticPlacement);
      if ((projection.payload.dependencies as string[]).length) {
        await web.updateTask(id, { dependencies: projection.payload.dependencies });
      }
      if (projection.relationshipComment) {
        const comment = projection.relationshipComment;
        await web.updateTask(id, { commentsAppend: [comment.body], commentAuthor: comment.author });
      }
      if (pkg.classification === "archived") {
        await checkpoint();
        runRequired(runner, "backlog", ["task", "archive", id], source.projectRoot, `archive evidenced Backlog task ${id}`);
      }
    }
    const paths = backlogPhysicalTaskPaths(storeDir);
    for (const pkg of source.tasks) {
      const id = mapping[pkg.sourceTaskId];
      const view = await web.readTask(id);
      assertBeadsCurrentTask(view, beadsCurrentProjection(pkg, source, mapping, configuration, semanticPlacement), id);
      assertBacklogLifecyclePlacement(pkg, id, view, storeDir, paths);
    }
  }
  // No more migration Web operations after this point. Only the verified
  // import/readback path can treat an unproved stop as a warning.
  await closeVerifiedWeb();
  await checkpoint("Publishing verified data and receipt");
  const bookkeepingType = configuration.types.find((value) => value.trim().toLowerCase() === "task")
    ?? configuration.types[0] ?? "task";
  const reservedReceiptId = ensureBacklogReceiptPlaceholder(runner, source.projectRoot, source, bookkeepingType);
  const memoryOutputs = importBeadsMemoryDocuments(source, runner, bookkeepingType);
  backlogMemoryEvidence(source, memoryOutputs, runner);
  const dataRevision = commitBacklogDestination(runner, prepared, "prime-claw: migrate Beads task history");
  await checkpoint();
  assertCommittedBacklogMemoryOutputs(memoryOutputs, source.projectRoot, storeDir, [dataRevision], runner);
  const dataViews = backlogDestinationViews(runner, source.projectRoot, storeDir, "data");
  const dataPaths = backlogPhysicalTaskPaths(storeDir);
  const importedNativeViews: JsonObject[] = [];
  const destinationTasks = source.tasks.map((pkg) => {
    const id = mapping[pkg.sourceTaskId];
    const view = backlogDestinationViewById(dataViews, id, pkg.sourceTaskId);
    if (!view) throw new Error(`Backlog destination task ${id} is not exactly readable`);
    assertBeadsCurrentTask(view, beadsCurrentProjection(pkg, source, mapping, configuration, semanticPlacement), id);
    const taskPath = relative(source.projectRoot, assertBacklogLifecyclePlacement(pkg, id, view, storeDir, dataPaths)).replace(/\\/g, "/");
    importedNativeViews.push(view);
    return { sourceTaskId: pkg.sourceTaskId, destinationTaskId: id, taskPath };
  });
  // Receipt digests cover complete native readback, not Git references.
  const destinationDigest = (nativeViews: JsonObject[]) => {
    const memory = backlogMemoryEvidence(source, memoryOutputs, runner);
    return canonicalSha256({ preserved: [], imported: nativeViews,
      ...(source.memories.length ? { memory } : {}) });
  };
  const destinationDataDigest = destinationDigest(importedNativeViews);
  const transitions = ownershipRows.map((row) => ({ ownerSessionId: row.ownerSessionId, sourceTaskId: row.taskId, destinationTaskId: mapping[row.taskId] }));
  if (transitions.some((row) => !row.destinationTaskId)) throw new Error("active ownership has no Backlog destination mapping");
  const receiptBase = migrationReceiptBase(source, "backlog", dataRevision, destinationDataDigest,
    destinationTasks.map(({ sourceTaskId, destinationTaskId }) => ({ sourceTaskId, destinationTaskId })), transitions, actor, timestamp, semanticPlacement);
  receiptBase.beadsSourceIdentity = source.sourceIdentity;
  if (source.memories.length) receiptBase.backlogMemoryOutputs = memoryOutputs;
  await checkpoint();
  const receiptTaskId = createOrUpdateBacklogReceipt(runner, source.projectRoot, receiptBase, reservedReceiptId);
  const receiptRevision = commitBacklogDestination(runner, prepared, "prime-claw: record task-provider migration receipt");
  const verifyNativeReceipt = () => {
    const exact = cleanGitRevision(runner, storeDir);
    if (exact !== receiptRevision) throw new Error("Backlog destination revision changed after receipt publication");
    assertPublishedGitRef(runner, storeDir, receiptRevision, prepared.remoteName, prepared.remoteUrl, TASK_HISTORY_REF, "Backlog destination receipt publication");
    assertCommittedBacklogMemoryOutputs(memoryOutputs, source.projectRoot, storeDir, [dataRevision, receiptRevision], runner);
    const views = backlogDestinationViews(runner, source.projectRoot, storeDir, "refresh");
      assertExactBacklogReceipt(views, receiptTaskId, receiptBase);
    const paths = backlogPhysicalTaskPaths(storeDir);
    const sourceById = new Map(source.tasks.map((pkg) => [pkg.sourceTaskId, pkg]));
    const refreshed = destinationTasks.map((task) => {
      const taskEvidence = backlogDestinationViewById(views, task.destinationTaskId, task.sourceTaskId);
      if (!taskEvidence) throw new Error(`Backlog destination task ${task.destinationTaskId} is not exactly readable after receipt`);
      const pkg = sourceById.get(task.sourceTaskId)!;
      assertBeadsCurrentTask(taskEvidence, beadsCurrentProjection(pkg, source, mapping, configuration, semanticPlacement), task.destinationTaskId);
      const path = assertBacklogLifecyclePlacement(pkg, task.destinationTaskId, taskEvidence, storeDir, paths);
      if (path !== resolve(source.projectRoot, task.taskPath)) {
        throw new Error(`Backlog destination task ${task.destinationTaskId} changed path after data publication`);
      }
      return taskEvidence;
    });
    return { revision: exact, digest: destinationDigest(refreshed), receiptTaskId };
  };
  return verifiedBacklogCandidate(source, runner, prepared, receiptBase, verifyNativeReceipt, destinationTasks, warn);
}

async function verifiedBacklogCandidate(
  source: BeadsSnapshot, runner: CommandRunner, prepared: ExplicitBacklogMigrationWorkspace,
  receiptBase: DestinationCandidate["receiptBase"],
  verifyNativeReceipt: () => Omit<ReturnType<DestinationCandidate["refreshAfterReceipt"]>, "tasks">,
  destinationTasks: readonly Omit<DestinationTask, "taskEvidence">[],
  warn: (message: string) => void,
): Promise<DestinationCandidate> {
  const { storeDir } = prepared;
  const final = verifyNativeReceipt(), receiptRevision = final.revision;
  // Bind immutable blobs only at the directly verified receipt revision.
  // Subsequent synchronous checks still reverify native receipt/readback.
  const repository = { root: storeDir, topology: "independent" as const, remote: prepared.remoteName };
  const tasks: DestinationTask[] = [];
  for (const { sourceTaskId, destinationTaskId, taskPath } of destinationTasks) {
    const path = relative(storeDir, resolve(source.projectRoot, taskPath));
    const taskEvidence = await makeBacklogGitEvidence(repository, receiptRevision, path, destinationTaskId);
    tasks.push({ sourceTaskId, destinationTaskId, taskPath, taskEvidence });
  }
  const refresh = () => ({ ...verifyNativeReceipt(), tasks });
  return {
    provider: "backlog", revision: final.revision, digest: final.digest, receiptBase, receiptTaskId: final.receiptTaskId, tasks,
    refreshAfterReceipt: refresh,
    prepareActiveWorktree(worktree, sourceTaskId) {
      const task = tasks.find(task => task.sourceTaskId === sourceTaskId);
      if (!task?.taskPath) throw new Error(`active Episode has no published Backlog task for ${sourceTaskId}`);
      cloneFreshBacklogMigrationWorkspace(worktree, prepared, receiptRevision, runner, warn);
      const view = backlogTaskView(runner, worktree, task.destinationTaskId);
      if (resolve(worktree, view.task.path) !== resolve(worktree, task.taskPath)) {
        throw new Error(`active Episode does not select published Backlog task ${task.destinationTaskId}`);
      }
    },
  };
}

async function proveActiveRuntimeContinuity(
  rows: readonly ActiveMigrationOwnership[],
  verifier: ProviderMigrationOptions["verifyActiveRuntime"],
): Promise<Record<string, { expectedPreviousEpisodeActiveSessionId: string; verifiedCurrentEpisodeActiveSessionId: string }>> {
  if (rows.length === 0) return {};
  if (!verifier) throw new Error("active task Episode runtime continuity verification is unavailable");
  const proofs = await verifier(rows.map((row) => row.record));
  const result: Record<string, { expectedPreviousEpisodeActiveSessionId: string; verifiedCurrentEpisodeActiveSessionId: string }> = {};
  for (const proof of proofs) {
    if (!rows.some((row) => row.ownerSessionId === proof.ownerSessionId) || result[proof.ownerSessionId]) {
      throw new Error(`active runtime continuity returned unexpected or duplicate owner ${proof.ownerSessionId}`);
    }
    const row = rows.find((item) => item.ownerSessionId === proof.ownerSessionId)!;
    if (!proof.expectedPreviousEpisodeActiveSessionId || !proof.verifiedCurrentEpisodeActiveSessionId
        || proof.expectedPreviousEpisodeActiveSessionId !== row.record.episodeActiveSessionId) {
      throw new Error(`active runtime continuity returned incomplete or mismatched evidence for ${proof.ownerSessionId}`);
    }
    result[proof.ownerSessionId] = proof;
  }
  if (Object.keys(result).length !== rows.length) throw new Error("active runtime continuity did not cover every active task Episode");
  return result;
}

function ownershipDestinations(candidate: DestinationCandidate): Record<string, ActiveTaskProviderOwnershipDestination> {
  return Object.fromEntries(candidate.tasks.map((task) => [task.sourceTaskId, {
    taskId: task.destinationTaskId,
    providerRevision: candidate.revision,
    taskEvidence: task.taskEvidence,
    ...(candidate.provider === "backlog" ? { taskPath: task.taskPath } : {}),
  }]));
}

function backupDirectory(path: string): void {
  const info = lstatSync(path);
  if (!info.isDirectory() || realpathSync(path) !== path) {
    throw new Error("Beads backup path is not one canonical local directory");
  }
}

/** Use the native point-in-time Dolt backup, not a live copy of database files. */
function retainBeadsBackup(source: BeadsSnapshot, runner: CommandRunner, allocated: (path: string) => void, warn: (message: string) => void): RetainedBeadsBackup {
  const { projectRoot, evidence } = source;
  const database = evidence.doltDatabase;
  if (!database || database.startsWith("-") || database === "." || database === ".." || /[\\/\x00-\x1f]/.test(database)) {
    throw new Error("Beads backup requires one safe native database directory name");
  }
  const connection = source.sourceIdentity.connection as JsonObject;
  let databaseDirectory: string;
  if (evidence.doltMode === "server") {
    if (connection.shared_server !== false || !["127.0.0.1", "localhost", "::1"].includes(connection.host)) {
      throw new Error("Beads backup requires the locally owned source server, not a shared or remote endpoint");
    }
    const status = asObject(jsonCommand(runner, "bd", ["--readonly", "dolt", "status", "--json"], projectRoot, "Beads backup source server"), "Beads backup source server");
    if (status.running !== true || status.port !== connection.port || !Number.isSafeInteger(status.pid) || status.pid <= 0 || typeof status.data_dir !== "string") {
      throw new Error("Beads backup cannot bind the running source server to its selected local database");
    }
    databaseDirectory = join(status.data_dir, database);
  } else if (evidence.doltMode === "embedded" && typeof connection.data_dir === "string") {
    databaseDirectory = join(connection.data_dir, database);
  } else {
    throw new Error("Beads backup cannot bind the selected embedded database directory");
  }
  if (!isAbsolute(databaseDirectory) || !contained(evidence.storeDir, databaseDirectory) || databaseDirectory === evidence.storeDir) {
    throw new Error("Beads backup database directory is not inside the source store");
  }
  backupDirectory(databaseDirectory);
  backupDirectory(join(databaseDirectory, ".dolt"));

  const gitDirectory = realpathSync(runRequired(runner, "git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], projectRoot, "locate private Beads backup parent").stdout.trim());
  if (contained(evidence.storeDir, gitDirectory) || contained(join(projectRoot, ".backlog"), gitDirectory)) {
    throw new Error("Beads backup parent would not survive source retirement or is inside the destination");
  }
  const path = mkdtempSync(join(gitDirectory, "prime-claw-beads-backup-"));
  allocated(path);
  for (const [name, original] of [["metadata.json", evidence.metadataPath], ["config.yaml", evidence.configPath]]) {
    const info = lstatSync(original);
    if (!info.isFile() || realpathSync(original) !== original || !contained(evidence.storeDir, original)) {
      throw new Error(`Beads backup cannot copy unsafe source ${name}`);
    }
    writeFileSync(join(path, name), readFileSync(original), { flag: "wx", mode: 0o600 });
  }
  mkdirSync(join(path, "dolt"), { mode: 0o700 });
  const url = pathToFileURL(join(path, "dolt")).href.replace(/'/g, "%27");
  if (evidence.doltMode === "server") {
    // Use the existing selected connection. No backup registration, source
    // commit, server stop, or path inferred from an unrelated SQL endpoint.
    runRequired(runner, "bd", ["--dolt-auto-commit", "off", "sql", `CALL DOLT_BACKUP('sync-url', '${url}')`], projectRoot, "capture owned Beads server backup");
  } else {
    runRequired(runner, "dolt", ["backup", "sync-url", url], databaseDirectory, "capture embedded Beads backup");
  }
  const scratch = mkdtempSync(join(realpathSync(tmpdir()), "prime-claw-beads-restore-"));
  try {
    runRequired(runner, "dolt", ["backup", "restore", url, database], scratch, "restore Beads backup for verification");
    const restored = join(scratch, database);
    backupDirectory(restored);
    runRequired(runner, "dolt", ["fsck"], restored, "verify restored Beads database");
  } finally {
    try { rmSync(scratch, { recursive: true, force: true }); }
    catch { warn(`Could not remove temporary Beads restore files at ${scratch}.`); }
  }
  writeFileSync(join(path, "source.json"), JSON.stringify({ database, mode: evidence.doltMode, sourceRevision: source.revision }) + "\n", { flag: "wx", mode: 0o600 });
  return { path, digest: beadsBackupDigest(path) };
}

/** Recheck the same private bytes before retiring the original. */
function beadsBackupDigest(root: string): string {
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(256 * 1024);
  const walk = (path: string) => {
    const info = lstatSync(path);
    const name = relative(root, path);
    if (info.isDirectory()) {
      backupDirectory(path);
      hash.update(JSON.stringify([name, "directory"]));
      for (const child of readdirSync(path).sort()) walk(join(path, child));
    } else if (info.isFile() && info.nlink === 1) {
      const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const opened = fstatSync(fd);
        if (opened.dev !== info.dev || opened.ino !== info.ino) throw new Error("Beads backup file changed during verification");
        hash.update(JSON.stringify([name, "file", info.size]));
        let offset = 0;
        for (let n; (n = readSync(fd, buffer, 0, buffer.length, null)) > 0; offset += n) hash.update(buffer.subarray(0, n));
        const finished = fstatSync(fd);
        if (offset !== info.size || finished.mtimeMs !== info.mtimeMs || finished.ctimeMs !== info.ctimeMs) {
          throw new Error("Beads backup file changed during verification");
        }
      } finally {
        closeSync(fd);
      }
    } else {
      throw new Error("Beads backup contains an unsafe file or link");
    }
  };
  walk(root);
  return hash.digest("hex");
}

function deleteBeadsSource(snapshot: BeadsSnapshot, runner: CommandRunner): void {
  const store = snapshot.evidence.storeDir;
  if (!existsSync(store)) throw new Error("Beads source store disappeared before guarded deletion");
  const entry = lstatSync(store);
  if (!entry.isDirectory() || entry.isSymbolicLink() || realpathSync(store) !== store || !contained(snapshot.projectRoot, store)) throw new Error("Beads source store identity changed before guarded deletion");
  // The caller has reverified this exact complete capture and the published
  // destination under the ownership lock. Outgoing remotes are not migration
  // authority and are neither required nor mutated by local source retirement.
  if (snapshot.sourceIdentity.doltMode === "server") {
    if (snapshot.sourceIdentity.connection.shared_server !== false) {
      throw new Error("cannot safely stop a shared or unidentified Beads source server for local retirement");
    }
    runRequired(runner, "bd", ["dolt", "stop"], snapshot.projectRoot, "stop Beads source server before deletion");
  }
  rmSync(store, { recursive: true, force: false });
}

const WEB_STOP_WARNING = "Owned Web shutdown was not proved (owned-process-stop-unproved; outcome=uncertain). Private transport files retained.";

function webStopUnproved(error: unknown): boolean {
  return error instanceof MigrationBacklogWebError && error.stage === "owned-process-stop-unproved" && error.outcome === "uncertain";
}

function observedStore(path: string | undefined): "absent" | "present" | "unverified" {
  if (!path) return "unverified";
  try { return lstatSync(path).isDirectory() ? "present" : "unverified"; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ENOENT" ? "absent" : "unverified"; }
}

export async function migrateTaskProvider(options: ProviderMigrationOptions): Promise<ProviderMigrationResult> {
  const runner = migrationRunner(options.runner);
  let source: BeadsSnapshot | undefined;
  let projectRoot: string | undefined;
  let sourceBackupPath: string | undefined;
  let ownershipSwitch: ActiveTaskProviderOwnershipSwitchResult | undefined;
  let candidate: DestinationCandidate | undefined;
  let retirementStarted = false;
  let backlogWeb: BeadsMigrationWeb | undefined;
  let closeAttempt: ReturnType<BeadsMigrationWeb["close"]> | undefined;
  const warnings: string[] = [];
  const notify = (phase: string, level?: "warning") => {
    try { options.onProgress?.(phase, level); } catch { /* Output delivery is not migration authority. */ }
  };
  const warn = (message: string) => { warnings.push(message); notify(message, "warning"); };
  const closeWeb = () => backlogWeb ? (closeAttempt ??= backlogWeb.close()) : undefined;
  const closeVerifiedWeb = async () => {
    try { await closeWeb(); }
    catch (error) { warn(webStopUnproved(error) ? WEB_STOP_WARNING : "Owned Backlog Web teardown failed; shutdown was not proved."); }
  };
  const checkpoint: MigrationCheckpoint = async (phase) => {
    if (options.signal && !options.signal.aborted) await yieldToOperator();
    if (options.signal?.aborted) throw new PreCutoverStop();
    if (phase) notify(phase);
  };
  const openBacklogWeb: OpenBeadsMigrationWeb = async (storeDir) => {
    backlogWeb = await startMigrationBacklogWeb({ cwd: projectRoot!, backlogDirectory: storeDir, signal: options.signal });
    return backlogWeb;
  };
  try {
    if (options.targetProvider !== "backlog") return blocked("unsupported-direction", "provider migration supports only Beads-to-Backlog", "request an explicit Beads-to-Backlog inspection", { targetProvider: options.targetProvider });
    if (!options.confirmedSwitch) return blocked("confirmation-required", "provider switch requires explicit operator confirmation", "inspect and confirm the exact source and guarded retirement", { targetProvider: options.targetProvider });
    if (!options.actor.trim() || !options.semanticPlacement.trim()) return blocked("confirmation-details-required", "confirmation requires an operator-approved actor and placement guidance", "supply the truthful actor and readable placement guidance from inspection", { targetProvider: options.targetProvider });
    await checkpoint("Checking source and migration prerequisites");
    const project = resolveNearestProjectRoot(options.cwd, process.env.HOME ?? "", runner);
    if (project.kind === "linked-worktree") return blocked("primary-required", "provider migration must run from the canonical primary checkout", "run it from the canonical primary Conversation", { targetProvider: options.targetProvider });
    projectRoot = project.root;
    assertFreshBacklogMigrationDestination(projectRoot, runner);
    source = captureSelectedSource(projectRoot, runner);
    if (source.revision !== options.expectedSourceRevision) throw new Error(`confirmed source revision ${options.expectedSourceRevision} does not equal current exact ${source.revision}`);
    const ownershipRows = activeOwnership(projectRoot, source, runner);
    await proveActiveRuntimeContinuity(ownershipRows, options.verifyActiveRuntime);
    await checkpoint("Creating and verifying a retained Beads backup");
    const selectedSource = source;
    const sourceBackup = retainBeadsBackup(selectedSource, runner, (path) => { sourceBackupPath = path; }, warn);
    await checkpoint("Preparing the destination");
    const timestamp = (options.now ?? (() => new Date().toISOString()))();
    const switchedAt = Number.isNaN(Date.parse(timestamp)) ? new Date().toISOString() : timestamp;
    if (timestamp !== switchedAt) warn("Invalid migration clock value; used the current time for the receipt.");
    const verified = candidate = await migrateBeadsToBacklog(selectedSource, runner, options.actor.trim(), switchedAt, options.semanticPlacement.trim(), ownershipRows, openBacklogWeb, closeVerifiedWeb, warn, checkpoint);
    await checkpoint("Verifying required publication and ownership before cutover");
    for (const owner of ownershipRows) {
      verifyMigrationEpisodeWorktree(projectRoot, owner.worktree, runner);
      verified.prepareActiveWorktree(owner.worktree, owner.taskId);
    }
    const runtimeProofs = await proveActiveRuntimeContinuity(ownershipRows, options.verifyActiveRuntime);
    await checkpoint("Guarded cutover starting; stop no longer interrupts this phase");
    verified.refreshAfterReceipt();
    exactSnapshotUnchanged(selectedSource, captureSameSource(selectedSource, runner));
    if (beadsBackupDigest(sourceBackup.path) !== sourceBackup.digest) throw new Error("retained Beads backup changed before ownership switch and source retirement");
    ownershipSwitch = switchActiveTaskProviderOwnership(projectRoot, {
      sourceProvider: "beads",
      targetProvider: "backlog",
      switchedAt,
      destinations: ownershipDestinations(verified),
      expectedSourceRecords: Object.fromEntries(ownershipRows.map((row) => [row.ownerSessionId, row.record])),
      runtimeProofs,
    });
    withCurrentTaskProviderOwnershipSwitch(projectRoot, ownershipSwitch, () => {
      verified.refreshAfterReceipt();
      exactSnapshotUnchanged(selectedSource, captureSameSource(selectedSource, runner));
      if (beadsBackupDigest(sourceBackup.path) !== sourceBackup.digest) throw new Error("retained Beads backup changed before guarded source retirement");
      retirementStarted = true;
      (options.deleteSource ?? deleteBeadsSource)(selectedSource, runner);
    });
    if (observedStore(source.evidence.storeDir) !== "absent") throw new Error("original Beads store removal was not verified");
    const detection = detectTaskProvider(projectRoot, runner);
    if (detection.kind !== "selected" || detection.evidence.provider !== "backlog" || detection.evidence.storeDir !== join(projectRoot, ".backlog")) {
      throw new Error("verified Backlog store did not become the selected local authority after retirement");
    }
    const receipt: ProviderMigrationReceipt = {
      ...verified.receiptBase,
      ownershipTransitions: ownershipSwitch.transitions,
      destinationReceiptRevision: verified.revision,
    };
    return { status: "completed", receipt, receiptTaskId: verified.receiptTaskId, sourceAbsent: true,
      sourceBackupPath: sourceBackup.path, selectedProvider: "backlog", warnings };
  } catch (error) {
    let teardownError = error instanceof MigrationBacklogWebError ? error.teardownError : undefined;
    try { await closeWeb(); } catch (stopError) { teardownError ??= stopError; }
    if (teardownError && !warnings.some(message => message.includes("Web"))) {
      warn(webStopUnproved(teardownError) ? WEB_STOP_WARNING : "Owned Backlog Web teardown failed; shutdown was not proved.");
    }
    const stopped = !ownershipSwitch && (error instanceof PreCutoverStop ||
      (options.signal?.aborted && error instanceof MigrationBacklogWebError && error.stage !== "owned-process-stop-unproved"));
    const sourceRetirement = observedStore(source?.evidence.storeDir ?? (projectRoot && join(projectRoot, ".beads")));
    let authority: ProviderMigrationBlocked["authority"] = "unverified";
    if (!ownershipSwitch && source && sourceRetirement === "present") {
      // A readable source together with a partial Backlog directory means
      // migration has not transferred authority, not that discovery is usable.
      try {
        if (canonical(beadsSourceIdentity(source.projectRoot, source.evidence, runner)) === canonical(source.sourceIdentity)) authority = "beads";
      } catch { /* Report unknown. */ }
    } else if (ownershipSwitch && candidate && sourceRetirement === "absent") {
      try {
        const selected = detectTaskProvider(source!.projectRoot, runner);
        if (selected.kind === "selected" && selected.evidence.provider === "backlog" && selected.evidence.storeDir === join(source!.projectRoot, ".backlog")) authority = "backlog";
      } catch { /* Report unknown. */ }
    }
    return blocked(
      ownershipSwitch ? "cutover-incomplete" : stopped ? "pre-cutover-stopped" : "pre-cutover-failed",
      (stopped ? "Migration stopped before cutover. " : "") + (error instanceof Error ? error.message : String(error))
        + (error instanceof MigrationBacklogWebError && error.artifactDirectory ? ` Private transport evidence: ${error.artifactDirectory}` : ""),
      `Stop task mutation and preserve the source, any partial Backlog destination and private evidence as found. ${retirementStarted ? "Inspect the incomplete retirement; " : ""}do not automatically retry, roll back, or clean up.`,
      { sourceProvider: source?.provider, targetProvider: options.targetProvider, sourceRevision: source?.revision,
        sourceBackupPath, authority, sourceRetirement, ownershipSwitched: !!ownershipSwitch, destinationRevision: candidate?.revision, warnings },
    );
  }
}
