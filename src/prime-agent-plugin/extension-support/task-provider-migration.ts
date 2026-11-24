/**
 * One-shot selected-provider migration for Prime Claw initialization/upgrade.
 *
 * Public entry points admit only Beads to Backlog. Existing pair-specific
 * native helpers are retained rather than introducing a universal task model. Backlog snapshots retain the exact structured view,
 * Markdown bytes, placement, and Git history. Beads snapshots bind the complete
 * current export, independent issue inventory and long native views/comments;
 * they neither read nor bind old revisions, database events or provenance logs.
 * Pair-specific writers use supported native Web/CLI operations and verify full
 * readable current content before the one-way ownership/source cutover. Source
 * identity lives once in the existing receipt, not in per-ticket archives.
 */
import { createHash } from "node:crypto";
import { makeBacklogGitEvidence } from "./backlog-git-evidence.ts";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  renameSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { setImmediate as yieldToOperator } from "node:timers/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  type CommandRunner,
  ProcessCommandRunner,
  resolveNearestProjectRoot,
} from "./project-initialization.ts";
import {
  prepareExistingBacklogTaskHistoryWorkspace,
  assertFreshBacklogMigrationDestination,
  assertNoLocalBacklogMigrationDestination,
  checkBacklogMigrationConfiguration,
  prepareExistingBacklogEpisodeProjection,
  TASK_HISTORY_REF,
} from "./task-history-workspace.ts";
import {
  BEADS_STATUS_MAP,
  CANONICAL_LIFECYCLE_STATUSES,
  checkBacklogCapabilities,
  checkBeadsCapabilities,
  detectExplicitTaskProvider,
  detectTaskProvider,
  normalizedDoltGitRemote,
  prepareExplicitBeadsWorkspaceTransport,
  type BacklogProviderEvidence,
  type BeadsProviderEvidence,
  type CanonicalLifecycleStatus,
  type TaskProviderId,
} from "./task-providers.ts";
import {
  readEpisodeOwnershipRegistry,
  restoreTaskProviderOwnershipSwitch,
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
const BEADS_CUSTOM_STATUSES = "in_design:active,in_planning:active,ready_for_merge:wip,done:done";
const BACKLOG_TASK_DIRS = ["tasks", "completed", "archive/tasks", "drafts", "archive/drafts"] as const;
const GIT_OID = /^[0-9a-f]{40,64}$/;
const DOLT_REVISION = /^[0-9a-v]{32}$/;

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
  /** Exact managed native Beads values applied for ambiguous Backlog projections. */
  beadsNativePlacements?: BeadsNativePlacement[];
  /** Initial retiring Beads store/connection identity, once per migration. */
  beadsSourceIdentity?: Record<string, unknown>;
  /** Native memory outputs, separate from issue-only counts and mappings. */
  backlogMemoryOutputs?: BacklogMemoryOutputs;
}

export interface BeadsNativePlacement {
  sourceTaskId: string;
  priority?: number;
  assignee?: string;
}

export interface ProviderMigrationCompleted {
  status: "completed";
  receipt: ProviderMigrationReceipt;
  receiptTaskId: string;
  sourceAbsent: true;
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
  /** Pair-specific literal native values for ambiguous Backlog-to-Beads projections. */
  beadsNativePlacements?: BeadsNativePlacement[];
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

interface BacklogTaskPackage {
  sourceTaskId: string;
  entityKind: "task" | "draft";
  classification: "open" | "closed" | "archived";
  relativePath: string;
  nativeView: JsonObject;
  markdownBase64: string;
  gitHistoryBase64: string;
}

interface BacklogSnapshot {
  provider: "backlog";
  projectRoot: string;
  evidence: BacklogProviderEvidence;
  revision: string;
  digest: string;
  repositoryRoot: string;
  publicationRemote?: string;
  publicationRef?: string;
  tasks: BacklogTaskPackage[];
  counts: { open: number; closed: number; archived: number; total: number };
}

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

export type SourceSnapshot = BacklogSnapshot | BeadsSnapshot;

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
  prepareActiveWorktree: (worktree: string) => void;
  codePaths?: string[];
  verifyCodeProjection?: () => void;
  activeCodeProjections?: Map<string, () => void>;
  publishActiveCodeLayout?: (worktree: string) => string;
}

function blocked(
  code: string,
  detail: string,
  remediation: string,
  context: Partial<Pick<ProviderMigrationBlocked, "sourceProvider" | "targetProvider" | "sourceRevision">> = {},
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

function directPublishedGitHead(runner: CommandRunner, repositoryRoot: string, revision: string): { remote: string; ref: string } | null {
  const upstream = runner.run("git", ["-C", repositoryRoot, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], { cwd: repositoryRoot, allowFailure: true });
  if (upstream.status !== 0 || !upstream.stdout.trim().includes("/")) return null;
  const value = upstream.stdout.trim();
  const slash = value.indexOf("/");
  const remote = value.slice(0, slash);
  const branch = value.slice(slash + 1);
  const ref = `refs/heads/${branch}`;
  const direct = runRequired(runner, "git", ["-C", repositoryRoot, "ls-remote", "--exit-code", "--refs", remote, ref], repositoryRoot, "direct source publication");
  const rows = direct.stdout.trim().split(/\r?\n/).filter(Boolean);
  if (rows.length !== 1 || rows[0].split(/\s+/)[0] !== revision || rows[0].split(/\s+/)[1] !== ref) {
    throw new Error(`source revision ${revision} is not the exact directly published ${remote}/${ref}`);
  }
  return { remote, ref };
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

function backlogClassification(storeDir: string, path: string): "open" | "closed" | "archived" {
  const rel = relative(storeDir, path).replace(/\\/g, "/");
  if (rel.startsWith("completed/") || rel.startsWith("archive/")) return "archived";
  return "open";
}

function backlogEntityKind(storeDir: string, path: string): "task" | "draft" {
  const rel = relative(storeDir, path).replace(/\\/g, "/");
  return rel.startsWith("drafts/") || rel.startsWith("archive/drafts/") ? "draft" : "task";
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

function backlogDraftView(runner: CommandRunner, projectRoot: string, taskId: string, relativePath: string): JsonObject {
  const plain = runRequired(runner, "backlog", ["draft", "view", taskId, "--plain"], projectRoot, `backlog draft view ${taskId}`).stdout;
  const reportedPath = /^File: (.+)$/m.exec(plain)?.[1];
  if (!reportedPath || realpathSync(resolve(projectRoot, reportedPath)) !== realpathSync(resolve(projectRoot, relativePath))) {
    throw new Error(`Backlog draft ${taskId} native path does not match its exact source file`);
  }
  const normalizedPlain = plain.replace(/^File: .*$/m, `File: ${relativePath}`);
  const heading = normalizedPlain.split(/\r?\n/).find((line) => line.startsWith(`Task ${taskId} - `));
  const status = normalizedPlain.split(/\r?\n/).find((line) => line.startsWith("Status:"));
  if (!heading || !status || !status.includes("Draft")) throw new Error(`Backlog draft ${taskId} returned mismatched native identity/status`);
  return {
    schemaVersion: 1,
    kind: "draft-view",
    task: {
      id: taskId,
      title: heading.slice(`Task ${taskId} - `.length),
      status: "Draft",
      path: relativePath,
      nativePlainViewBase64: Buffer.from(normalizedPlain).toString("base64"),
    },
  };
}

function captureBacklog(
  projectRoot: string,
  evidence: BacklogProviderEvidence,
  runner: CommandRunner,
  allowDestinationChanges = false,
): BacklogSnapshot {
  checkBacklogCapabilities(projectRoot, runner);
  const storeDir = evidence.storeDir ?? dirname(evidence.configPath);
  if (!existsSync(storeDir) || !statSync(storeDir).isDirectory()) throw new Error("selected Backlog source store is not a readable directory");
  const nestedGit = join(storeDir, ".git");
  const repositoryRoot = existsSync(nestedGit) && statSync(nestedGit).isDirectory() ? storeDir : projectRoot;
  const revision = allowDestinationChanges && repositoryRoot === projectRoot
    ? runRequired(runner, "git", ["-C", repositoryRoot, "rev-parse", "HEAD"], repositoryRoot, "git source revision").stdout.trim()
    : cleanGitRevision(runner, repositoryRoot);
  if (!GIT_OID.test(revision)) throw new Error("source task history did not return an exact Git revision");
  if (allowDestinationChanges && repositoryRoot === projectRoot) {
    const sourcePaths = [evidence.configPath, storeDir]
      .filter((path, index, values) => values.indexOf(path) === index)
      .map((path) => relative(projectRoot, path).replace(/\\/g, "/"));
    const sourceStatus = runRequired(runner, "git", ["-C", projectRoot, "status", "--porcelain=v1", "--", ...sourcePaths], projectRoot, "Backlog source path cleanliness");
    if (sourceStatus.stdout !== "") throw new Error(`source Backlog paths changed during migration: ${sourceStatus.stdout.trim()}`);
  }
  const publication = directPublishedGitHead(runner, repositoryRoot, revision);
  const taskFiles = walkTaskFiles(storeDir).map((path) => {
    const markdown = readFileSync(path);
    return {
      path,
      markdown,
      taskId: backlogTaskId(markdown.toString("utf8"), path),
      entityKind: backlogEntityKind(storeDir, path),
      classification: backlogClassification(storeDir, path),
    };
  });
  const tasks = taskFiles.map(({ path, markdown, taskId, entityKind, classification: physicalClassification }): BacklogTaskPackage => {
    const relativePath = relative(projectRoot, path).replace(/\\/g, "/");
    const nativeView = entityKind === "draft"
      ? backlogDraftView(runner, projectRoot, taskId, relativePath)
      : backlogTaskView(runner, projectRoot, taskId);
    const reported = resolve(projectRoot, nativeView.task.path);
    if (realpathSync(reported) !== realpathSync(path)) throw new Error(`Backlog ${entityKind} ${taskId} native path does not match its exact source file`);
    const classification = physicalClassification === "archived"
      ? "archived" as const
      : entityKind === "task" && String(nativeView.task.status) === "Done" ? "closed" as const : "open" as const;
    const historyPath = relative(repositoryRoot, path).replace(/\\/g, "/");
    const history = runRequired(
      runner,
      "git",
      ["-C", repositoryRoot, "log", "--all", "--follow", "--format=commit %H%nAuthor: %an <%ae>%nAuthorDate: %aI%nCommitter: %cn <%ce>%nCommitDate: %cI%nMessage:%n%B", "--patch", "--binary", "--full-index", "--", historyPath],
      repositoryRoot,
      `git history for ${taskId}`,
    ).stdout;
    if (!history.trim()) throw new Error(`Backlog task ${taskId} has no committed native history`);
    return {
      sourceTaskId: taskId,
      entityKind,
      classification,
      relativePath,
      nativeView,
      markdownBase64: markdown.toString("base64"),
      gitHistoryBase64: Buffer.from(history).toString("base64"),
    };
  }).sort((a, b) => a.sourceTaskId.localeCompare(b.sourceTaskId));
  if (new Set(tasks.map((task) => task.sourceTaskId)).size !== tasks.length) throw new Error("Backlog source repeats a canonical task ID");
  const counts = {
    open: tasks.filter((task) => task.classification === "open").length,
    closed: tasks.filter((task) => task.classification === "closed").length,
    archived: tasks.filter((task) => task.classification === "archived").length,
    total: tasks.length,
  };
  const digest = canonicalSha256(tasks);
  return {
    provider: "backlog", projectRoot, evidence, revision, digest, repositoryRoot,
    ...(publication ? { publicationRemote: publication.remote, publicationRef: publication.ref } : {}),
    tasks, counts,
  };
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

function selectedEvidence(projectRoot: string, runner: CommandRunner): { provider: TaskProviderId; evidence: BacklogProviderEvidence | BeadsProviderEvidence } {
  const detection = detectTaskProvider(projectRoot, runner);
  if (detection.kind === "blocked") throw new Error(`provider authority blocked (${detection.code}): ${detection.detail}; ${detection.remediation}`);
  if (detection.kind !== "selected" || detection.evidence.provider !== "beads") {
    throw new Error("Beads-to-Backlog migration requires a readable Beads source store");
  }
  return { provider: "beads", evidence: detection.evidence };
}

function captureProviderEvidence(
  projectRoot: string,
  provider: TaskProviderId,
  evidence: BacklogProviderEvidence | BeadsProviderEvidence,
  runner: CommandRunner,
): SourceSnapshot {
  return provider === "backlog"
    ? captureBacklog(projectRoot, evidence as BacklogProviderEvidence, runner)
    : captureBeads(projectRoot, evidence as BeadsProviderEvidence, runner);
}

function captureSelectedSource(projectRoot: string, runner: CommandRunner): SourceSnapshot {
  const selected = selectedEvidence(projectRoot, runner);
  return captureProviderEvidence(projectRoot, selected.provider, selected.evidence, runner);
}

function captureSameSource(snapshot: SourceSnapshot, runner: CommandRunner): SourceSnapshot {
  return snapshot.provider === "backlog"
    ? captureBacklog(snapshot.projectRoot, snapshot.evidence, runner, true)
    : captureBeads(snapshot.projectRoot, snapshot.evidence, runner);
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
  branch: string;
  currentCodeHead: string;
  verifyCodeProjection?: () => void;
  record: TaskEpisodeOwnershipRecord;
}

function gitAncestor(runner: CommandRunner, worktree: string, ancestor: string, descendant: string): boolean {
  return runner.run("git", ["-C", worktree, "merge-base", "--is-ancestor", ancestor, descendant], { cwd: worktree, allowFailure: true }).status === 0;
}

function verifyActiveCodeIdentity(projectRoot: string, row: ActiveMigrationOwnership, runner: CommandRunner): void {
  if (!existsSync(row.worktree)) throw new Error(`active task Episode ${row.ownerSessionId} worktree is absent`);
  const entry = lstatSync(row.worktree);
  if (!entry.isDirectory() || entry.isSymbolicLink() || realpathSync(row.worktree) !== row.worktree) throw new Error(`active task Episode ${row.ownerSessionId} worktree identity is unsafe`);
  const top = runRequired(runner, "git", ["rev-parse", "--show-toplevel"], row.worktree, `active Episode ${row.ownerSessionId} Git root`).stdout.trim();
  const common = runRequired(runner, "git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], row.worktree, `active Episode ${row.ownerSessionId} Git common directory`).stdout.trim();
  const gitDir = runRequired(runner, "git", ["rev-parse", "--path-format=absolute", "--git-dir"], row.worktree, `active Episode ${row.ownerSessionId} Git directory`).stdout.trim();
  const branch = runRequired(runner, "git", ["branch", "--show-current"], row.worktree, `active Episode ${row.ownerSessionId} branch`).stdout.trim();
  const head = runRequired(runner, "git", ["rev-parse", "HEAD"], row.worktree, `active Episode ${row.ownerSessionId} head`).stdout.trim();
  const status = runRequired(runner, "git", ["status", "--porcelain=v1"], row.worktree, `active Episode ${row.ownerSessionId} cleanliness`).stdout;
  row.verifyCodeProjection?.();
  if (realpathSync(top) !== row.worktree || dirname(realpathSync(common)) !== realpathSync(projectRoot)
      || realpathSync(gitDir) === realpathSync(common) || branch !== row.branch || head !== row.currentCodeHead || (status !== "" && !row.verifyCodeProjection)) {
    throw new Error(`active task Episode ${row.ownerSessionId} does not match its exact clean linked worktree/branch/head identity`);
  }
  const historicalHead = row.record.head;
  const baseRef = row.record.baseRef;
  if (!historicalHead || !baseRef
      || !gitAncestor(runner, row.worktree, baseRef, historicalHead)
      || !gitAncestor(runner, row.worktree, historicalHead, row.currentCodeHead)) {
    throw new Error(`active task Episode ${row.ownerSessionId} current code head does not descend from its preserved historical ownership ancestry`);
  }
  if (!directPublishedGitHead(runner, row.worktree, row.currentCodeHead)) throw new Error(`active task Episode ${row.ownerSessionId} current code head is not directly published`);
}

function activeOwnership(projectRoot: string, sourceProvider: TaskProviderId, runner: CommandRunner): ActiveMigrationOwnership[] {
  const registry = readEpisodeOwnershipRegistry(projectRoot);
  const rows: ActiveMigrationOwnership[] = [];
  for (const [ownerSessionId, record] of Object.entries(registry.owners)) {
    if (record.version === 1 || record.status === "inactive") continue;
    if (record.status !== "active") throw new Error(`task Episode ${ownerSessionId} is ${record.status}; provider migration requires exact active idle ownership`);
    const provider = taskEpisodeProvider(record);
    if (provider !== sourceProvider) throw new Error(`active task Episode ${ownerSessionId} uses ${provider}, not selected source ${sourceProvider}`);
    if (!record.worktree || !record.branch || !record.head || !record.episodeSessionFile) throw new Error(`active task Episode ${ownerSessionId} has no exact worktree/branch/head/session identity`);
    if (!existsSync(record.episodeSessionFile)) throw new Error(`active task Episode ${ownerSessionId} durable session file is absent`);
    const sessionEntry = lstatSync(record.episodeSessionFile);
    if (!sessionEntry.isFile() || sessionEntry.isSymbolicLink() || realpathSync(record.episodeSessionFile) !== record.episodeSessionFile) {
      throw new Error(`active task Episode ${ownerSessionId} durable session file identity is unsafe`);
    }
    const row: ActiveMigrationOwnership = {
      ownerSessionId,
      taskId: record.taskId,
      worktree: record.worktree,
      branch: record.branch,
      currentCodeHead: runRequired(runner, "git", ["rev-parse", "HEAD"], record.worktree, `capture active Episode ${ownerSessionId} current code head`).stdout.trim(),
      record: JSON.parse(JSON.stringify(record)) as TaskEpisodeOwnershipRecord,
    };
    verifyActiveCodeIdentity(projectRoot, row, runner);
    rows.push(row);
  }
  return rows.sort((a, b) => a.ownerSessionId.localeCompare(b.ownerSessionId));
}

function verifyActiveSourceWorkspace(source: SourceSnapshot, row: ActiveMigrationOwnership, runner: CommandRunner): void {
  if (source.provider === "beads") {
    const proof = captureBeads(row.worktree, source.evidence, runner);
    exactSnapshotUnchanged(source, proof);
    return;
  }
  if (source.repositoryRoot === source.projectRoot) {
    const pkg = source.tasks.find((task) => task.sourceTaskId === row.taskId);
    if (!pkg) throw new Error(`active task Episode ${row.ownerSessionId} has no exact source Backlog task package`);
    const path = resolve(row.worktree, pkg.relativePath);
    if (!contained(row.worktree, path) || !existsSync(path) || !lstatSync(path).isFile()
        || readFileSync(path).toString("base64") !== pkg.markdownBase64) {
      throw new Error(`active task Episode ${row.ownerSessionId} branch-local Backlog task differs from the canonical source snapshot`);
    }
    return;
  }
  const storeRelative = relative(source.projectRoot, source.evidence.storeDir!);
  const storeDir = resolve(row.worktree, storeRelative);
  if (!contained(row.worktree, storeDir) || !existsSync(join(storeDir, ".git"))) throw new Error(`active task Episode ${row.ownerSessionId} has no exact independent Backlog source workspace`);
  const status = runRequired(runner, "git", ["-C", storeDir, "status", "--porcelain=v1"], storeDir, `active Episode ${row.ownerSessionId} Backlog cleanliness`).stdout;
  const head = runRequired(runner, "git", ["-C", storeDir, "rev-parse", "HEAD"], storeDir, `active Episode ${row.ownerSessionId} Backlog revision`).stdout.trim();
  if (status !== "" || head !== source.revision || !directPublishedGitHead(runner, storeDir, head)) {
    throw new Error(`active task Episode ${row.ownerSessionId} independent Backlog workspace is not clean and directly published at source revision ${source.revision}`);
  }
}

function semanticPrompt(source: SourceSnapshot, target: TaskProviderId): string {
  const nativeRequirements = source.provider === "backlog" && target === "beads"
    ? source.tasks.flatMap((pkg) => {
        const task = asObject(pkg.nativeView.task, `Backlog task ${pkg.sourceTaskId}`);
        const requirements: string[] = [];
        const priority = String(task.priority ?? "p2").trim();
        if (directBeadsPriority(priority) === undefined) requirements.push(`${pkg.sourceTaskId}.priority=${JSON.stringify(priority)}`);
        const assignees = backlogAssignees(task, pkg.sourceTaskId);
        if (assignees.length > 1) requirements.push(`${pkg.sourceTaskId}.assignee=${JSON.stringify(assignees)}`);
        return requirements;
      })
    : [];
  const nativeValues = nativeRequirements.length
    ? ` These Backlog fields cannot project to one native Beads value without a decision: ${nativeRequirements.join(", ")}. On switch-confirm, supply each actual literal destination value through one task-specific beadsNativePlacements entry; priority is an integer 0..4 and assignee is a non-empty string. Prose is never parsed as a value.`
    : "";
  return `Review exact ${source.provider} current source fields that have no native ${target} equivalent. Supply concise semantic-placement prose for the confirm call.${nativeValues} Preserve current ticket content, meaningful metadata, actual authored comments and relationships. Do not require or import old revisions, database events or provenance logs. Your prose decides only the human-facing placement of non-equivalent current content and must not authorize its omission.`;
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
    const codeHead = cleanGitRevision(runner, project.root);
    if (!directPublishedGitHead(runner, project.root, codeHead)) throw new Error("provider migration inspection requires an exact directly published code head");
    const source = captureSelectedSource(project.root, runner);
    if (source.provider === options.targetProvider) return blocked("same-provider", `the selected provider is already ${source.provider}`, "choose the other supported provider", { sourceProvider: source.provider, targetProvider: options.targetProvider, sourceRevision: source.revision });
    const ownership = activeOwnership(project.root, source.provider, runner);
    for (const owner of ownership) {
      assertNoLocalBacklogMigrationDestination(owner.worktree);
      verifyActiveSourceWorkspace(source, owner, runner);
    }
    const sourceIds = new Set(source.tasks.map((task) => task.sourceTaskId));
    const missing = ownership.filter((item) => !sourceIds.has(item.taskId));
    if (missing.length) throw new Error(`active ownership references tasks absent from the source snapshot: ${missing.map((item) => item.taskId).join(", ")}`);
    return {
      status: "ready",
      projectRoot: project.root,
      sourceProvider: source.provider,
      targetProvider: options.targetProvider,
      sourceRevision: source.revision,
      sourceDigest: source.digest,
      taskCounts: source.counts,
      activeOwnership: ownership.map(({ ownerSessionId, taskId }) => ({ ownerSessionId, taskId })),
      semanticPlacementPrompt: semanticPrompt(source, options.targetProvider),
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

function statusFromBacklog(value: unknown): string {
  const status = String(value ?? "");
  const mapping = BEADS_STATUS_MAP[status as CanonicalLifecycleStatus];
  if (!mapping) throw new Error(`Backlog task has unmapped status ${JSON.stringify(status)}`);
  return mapping.name;
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

function backlogAcceptance(task: JsonObject): string {
  const rows = Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : [];
  return rows.map((row: JsonObject) => `- [${row.checked ? "x" : " "}] ${String(row.text ?? "")}`).join("\n");
}

function directBeadsPriority(backlogPriority: unknown): number | undefined {
  const value = String(backlogPriority ?? "p2").trim().toLowerCase();
  const exact = /^p([0-4])$/.exec(value);
  if (exact) return Number(exact[1]);
  if (value === "medium") return 2;
  return undefined;
}

type SelectedBeadsNativePlacement = Omit<BeadsNativePlacement, "sourceTaskId">;

function backlogAssignees(task: JsonObject, sourceTaskId: string): string[] {
  const raw = task.assignees;
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error(`Backlog task ${sourceTaskId} assignees must be a native array`);
  return raw.map((value, index) => {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Backlog task ${sourceTaskId} assignee ${index + 1} must be a non-empty native string`);
    }
    return value;
  });
}

function validateBeadsNativePlacements(
  source: BacklogSnapshot,
  input: BeadsNativePlacement[] | undefined,
): Record<string, SelectedBeadsNativePlacement> {
  if (input !== undefined && !Array.isArray(input)) {
    throw new Error("beadsNativePlacements must be an array of exact source Backlog task IDs and literal native Beads values");
  }
  const supplied: Record<string, SelectedBeadsNativePlacement> = {};
  const sourceIds = new Set(source.tasks.map((pkg) => pkg.sourceTaskId));
  for (const item of input ?? []) {
    if (!item || typeof item !== "object" || typeof item.sourceTaskId !== "string" || item.sourceTaskId.trim() === "") {
      throw new Error("each managed Beads native placement requires an exact sourceTaskId");
    }
    const unsupported = Object.keys(item).filter((key) => !["sourceTaskId", "priority", "assignee"].includes(key));
    if (unsupported.length) throw new Error(`managed Beads native placement for ${item.sourceTaskId} has unsupported fields: ${unsupported.sort().join(", ")}`);
    if (!sourceIds.has(item.sourceTaskId)) throw new Error(`managed Beads native placement references unknown source Backlog task ${item.sourceTaskId}`);
    if (Object.prototype.hasOwnProperty.call(supplied, item.sourceTaskId)) throw new Error(`managed Beads native placement repeats source Backlog task ${item.sourceTaskId}`);
    const placement: SelectedBeadsNativePlacement = {};
    if (Object.prototype.hasOwnProperty.call(item, "priority")) {
      if (!Number.isInteger(item.priority) || item.priority! < 0 || item.priority! > 4) {
        throw new Error(`managed Beads priority for ${item.sourceTaskId} must be an integer from 0 through 4`);
      }
      placement.priority = item.priority;
    }
    if (Object.prototype.hasOwnProperty.call(item, "assignee")) {
      if (typeof item.assignee !== "string" || item.assignee.trim() === "") {
        throw new Error(`managed Beads assignee for ${item.sourceTaskId} must be a non-empty native string`);
      }
      placement.assignee = item.assignee;
    }
    if (Object.keys(placement).length === 0) throw new Error(`managed Beads native placement for ${item.sourceTaskId} supplies no native value`);
    supplied[item.sourceTaskId] = placement;
  }
  const selected: Record<string, SelectedBeadsNativePlacement> = {};
  for (const pkg of source.tasks) {
    const task = asObject(pkg.nativeView.task, `Backlog task ${pkg.sourceTaskId}`);
    const rawPriority = String(task.priority ?? "p2").trim();
    const directPriority = directBeadsPriority(rawPriority);
    const assignees = backlogAssignees(task, pkg.sourceTaskId);
    const placement = supplied[pkg.sourceTaskId] ?? {};
    const hasPriority = Object.prototype.hasOwnProperty.call(placement, "priority");
    const hasAssignee = Object.prototype.hasOwnProperty.call(placement, "assignee");
    const applied: SelectedBeadsNativePlacement = {};
    if (directPriority !== undefined) {
      if (hasPriority) throw new Error(`Backlog task ${pkg.sourceTaskId} priority ${rawPriority} already has exact native Beads priority ${directPriority}; omit the managed value`);
    } else {
      if (!hasPriority) {
        throw new Error(`Backlog task ${pkg.sourceTaskId} priority ${rawPriority} has no single native Beads equivalent; supply its literal native value through beadsNativePlacements`);
      }
      const priority = placement.priority!;
      const normalized = rawPriority.toLowerCase();
      if (normalized === "high" && priority !== 0 && priority !== 1) {
        throw new Error(`managed native Beads priority for Backlog High task ${pkg.sourceTaskId} must be 0 or 1`);
      }
      if (normalized === "low" && priority !== 3 && priority !== 4) {
        throw new Error(`managed native Beads priority for Backlog Low task ${pkg.sourceTaskId} must be 3 or 4`);
      }
      applied.priority = priority;
    }
    if (assignees.length <= 1) {
      if (hasAssignee) throw new Error(`Backlog task ${pkg.sourceTaskId} already projects exactly to ${assignees.length} native Beads assignee value; omit the managed value`);
    } else {
      if (!hasAssignee) {
        throw new Error(`Backlog task ${pkg.sourceTaskId} assignees ${JSON.stringify(assignees)} cannot project to one native Beads assignee without a literal value in beadsNativePlacements`);
      }
      applied.assignee = placement.assignee;
    }
    if (Object.keys(applied).length) selected[pkg.sourceTaskId] = applied;
  }
  return Object.fromEntries(Object.entries(selected).sort(([left], [right]) => left.localeCompare(right)));
}

function beadsPriorityForBacklog(pkg: BacklogTaskPackage, managed: Record<string, SelectedBeadsNativePlacement>): number {
  const task = asObject(pkg.nativeView.task, `Backlog task ${pkg.sourceTaskId}`);
  const direct = directBeadsPriority(task.priority);
  if (direct !== undefined) return direct;
  const selected = managed[pkg.sourceTaskId]?.priority;
  if (!Number.isInteger(selected) || selected! < 0 || selected! > 4) {
    throw new Error(`Backlog task ${pkg.sourceTaskId} has no verified native Beads priority selection`);
  }
  return selected!;
}

function beadsAssigneeForBacklog(pkg: BacklogTaskPackage, managed: Record<string, SelectedBeadsNativePlacement>): string | undefined {
  const task = asObject(pkg.nativeView.task, `Backlog task ${pkg.sourceTaskId}`);
  const assignees = backlogAssignees(task, pkg.sourceTaskId);
  if (assignees.length === 0) return undefined;
  if (assignees.length === 1) return assignees[0];
  const selected = managed[pkg.sourceTaskId]?.assignee;
  if (typeof selected !== "string" || selected.trim() === "") {
    throw new Error(`Backlog task ${pkg.sourceTaskId} has no verified native Beads assignee selection`);
  }
  return selected;
}

function backlogSupplement(task: JsonObject, placement: string): string {
  const sections: Array<[string, unknown]> = [
    ["Implementation notes", task.implementationNotes],
    ["Final summary", task.finalSummary],
    ["Definition of Done", task.definitionOfDone],
    ["References", task.references],
    ["Documentation", task.documentation],
    ["Modified files", task.modifiedFiles],
    ["Semantic placement decision", placement],
  ];
  return sections
    .filter(([, value]) => value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0))
    .map(([name, value]) => `## ${name}\n\n${typeof value === "string" ? value : `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``}`)
    .join("\n\n");
}

function relationshipIds(value: unknown, ownId = ""): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item: unknown) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "";
    const row = item as JsonObject;
    return String(row.depends_on_id ?? row.dependsOnId ?? row.id ?? (row.issue_id !== ownId ? row.issue_id : "") ?? "");
  }).filter((id) => id && id !== ownId))].sort();
}

function assertSameIds(actual: string[], expected: string[], label: string): void {
  if (canonical(actual) !== canonical(expected)) throw new Error(`${label} mismatch: expected ${JSON.stringify(expected)}, observed ${JSON.stringify(actual)}`);
}

function backlogToBeadsRow(
  pkg: BacklogTaskPackage,
  placement: string,
  mapping: Record<string, string>,
  beadsPlacements: Record<string, SelectedBeadsNativePlacement>,
): JsonObject {
  const task = asObject(pkg.nativeView.task, `Backlog task ${pkg.sourceTaskId}`);
  const destinationId = mapping[pkg.sourceTaskId] ?? pkg.sourceTaskId;
  const parent = typeof task.parentTaskId === "string" && task.parentTaskId ? mapping[task.parentTaskId] ?? task.parentTaskId : undefined;
  const dependencies = relationshipIds(task.dependencies, pkg.sourceTaskId)
    .map((dep) => mapping[dep] ?? dep)
    .filter((dep) => dep !== parent)
    .map((dep) => ({ issue_id: destinationId, depends_on_id: dep, type: "blocks" }));
  if (parent) dependencies.unshift({ issue_id: destinationId, depends_on_id: parent, type: "parent-child" });
  const comments = Array.isArray(task.comments) ? task.comments.map((comment: JsonObject, index: number) => ({
    id: typeof comment.id === "string" ? comment.id : `${destinationId}-source-comment-${index + 1}`,
    issue_id: destinationId,
    author: String(comment.author ?? "unknown"),
    text: String(comment.text ?? comment.body ?? comment.content ?? ""),
    created_at: comment.createdAt ?? comment.created_at ?? task.createdAt,
  })) : [];
  const type = ["bug", "feature", "task", "epic", "chore", "decision", "spike"].includes(String(task.type)) ? String(task.type) : "task";
  const sourcePackage = {
    marker: SOURCE_MARKER,
    sourceProvider: "backlog",
    sourceTaskId: pkg.sourceTaskId,
    entityKind: pkg.entityKind,
    classification: pkg.classification,
    relativePath: pkg.relativePath,
    nativeView: pkg.nativeView,
    markdownBase64: pkg.markdownBase64,
    gitHistoryBase64: pkg.gitHistoryBase64,
    semanticPlacement: placement,
    ...(Object.prototype.hasOwnProperty.call(beadsPlacements, pkg.sourceTaskId)
      ? { beadsNativePlacement: beadsPlacements[pkg.sourceTaskId] }
      : {}),
  };
  const nativeDraftView = pkg.entityKind === "draft" && typeof task.nativePlainViewBase64 === "string"
    ? Buffer.from(task.nativePlainViewBase64, "base64").toString("utf8")
    : "";
  const notes = [
    backlogSupplement(task, placement),
    nativeDraftView ? `## Exact native Backlog draft view\n\n${nativeDraftView}` : "",
  ].filter(Boolean).join("\n\n");
  const assignee = beadsAssigneeForBacklog(pkg, beadsPlacements);
  return {
    id: destinationId,
    title: String(task.title ?? pkg.sourceTaskId),
    description: String(task.description ?? ""),
    design: String(task.implementationPlan ?? ""),
    notes,
    acceptance_criteria: backlogAcceptance(task),
    issue_type: type,
    priority: beadsPriorityForBacklog(pkg, beadsPlacements),
    status: pkg.classification === "archived" ? "closed" : pkg.entityKind === "draft" ? "in_design" : statusFromBacklog(task.status),
    ...(pkg.classification === "archived" ? { close_reason: `Migrated archived Backlog ${pkg.entityKind} ${pkg.sourceTaskId}; exact source lifecycle is retained in prime_claw_migration metadata` } : {}),
    ...(assignee !== undefined ? { assignee } : {}),
    ...(Array.isArray(task.labels) ? { labels: task.labels.map(String) } : {}),
    ...(parent ? { parent } : {}),
    dependencies,
    comments,
    external_ref: `backlog:${pkg.sourceTaskId}`,
    source_system: "backlog",
    ...(typeof task.createdAt === "string" ? { created_at: task.createdAt } : {}),
    ...(typeof task.updatedAt === "string" ? { updated_at: task.updatedAt } : {}),
    metadata: { prime_claw_migration: sourcePackage },
  };
}

function gitRemoteForDolt(runner: CommandRunner, projectRoot: string): { name: string; raw: string; dolt: string } {
  const upstream = runner.run("git", ["-C", projectRoot, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], { cwd: projectRoot, allowFailure: true });
  let name = "";
  if (upstream.status === 0 && upstream.stdout.trim().includes("/")) name = upstream.stdout.trim().split("/")[0];
  if (!name) {
    const remotes = runRequired(runner, "git", ["-C", projectRoot, "remote"], projectRoot, "git remote selection").stdout.split(/\r?\n/).filter(Boolean);
    if (remotes.length !== 1) throw new Error("Beads destination requires the primary upstream remote or exactly one repository remote");
    name = remotes[0];
  }
  const raw = runRequired(runner, "git", ["-C", projectRoot, "remote", "get-url", name], projectRoot, "git remote URL").stdout.trim();
  const dolt = normalizedDoltGitRemote(raw);
  if (!dolt) throw new Error(`repository remote ${raw} cannot be represented as a supported Git-backed Dolt remote`);
  return { name, raw, dolt };
}

function configureBeadsDestination(projectRoot: string, runner: CommandRunner, prefix: string): void {
  if (!existsSync(join(projectRoot, ".beads"))) {
    runRequired(runner, "bd", ["init", "--server", "--stealth", "--skip-hooks", "--skip-agents", "--prefix", prefix, "--quiet", "--non-interactive"], projectRoot, "bd init migration destination");
  }
  runRequired(runner, "bd", ["config", "set", "status.custom", BEADS_CUSTOM_STATUSES], projectRoot, "configure Beads lifecycle");
  runRequired(runner, "bd", ["config", "set", "dolt.auto-start", "true"], projectRoot, "configure Beads server lifecycle");
  const remote = gitRemoteForDolt(runner, projectRoot);
  const listed = runner.run("bd", ["dolt", "remote", "list", "--json"], { cwd: projectRoot, allowFailure: true });
  let hasRemote = false;
  if (listed.status === 0) {
    const rows = parseJson(listed.stdout, "bd dolt remote list");
    hasRemote = Array.isArray(rows) && rows.some((row: JsonObject) => row.name === remote.name && (row.url === remote.dolt || row.sql_url === remote.dolt));
    if (Array.isArray(rows) && rows.some((row: JsonObject) => row.name === remote.name) && !hasRemote) throw new Error(`Beads destination remote ${remote.name} exists with a different URL`);
  }
  if (!hasRemote) runRequired(runner, "bd", ["dolt", "remote", "add", remote.name, remote.dolt, "--allow-git-origin"], projectRoot, "add Beads Dolt remote");
  runRequired(runner, "bd", ["config", "set", "sync.remote", remote.dolt], projectRoot, "configure Beads sync remote");
  const dirty = jsonCommand(runner, "bd", ["--readonly", "sql", "--json", "SELECT table_name, staged, status FROM dolt_status ORDER BY table_name"], projectRoot, "Beads destination status");
  if (Array.isArray(dirty) && dirty.length > 0) runRequired(runner, "bd", ["dolt", "commit", "-m", "prime-claw: configure migration destination"], projectRoot, "commit Beads destination configuration");
  runRequired(runner, "bd", ["dolt", "push", "--remote", remote.name, "--no-adopt"], projectRoot, "publish Beads destination configuration");
}

function writeJsonLines(path: string, rows: JsonObject[]): void {
  writeFileSync(path, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, { mode: 0o600 });
}

function beadsExportRows(runner: CommandRunner, projectRoot: string): JsonObject[] {
  return completeBeadsExport(runner, projectRoot, "Beads destination").map(({ row }) => row);
}

function beadsMigrationMetadata(row: JsonObject): JsonObject | null {
  const metadata = row.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    && (metadata as JsonObject).prime_claw_migration && typeof (metadata as JsonObject).prime_claw_migration === "object"
    ? (metadata as JsonObject).prime_claw_migration as JsonObject : null;
}

function ensureBeadsDestinationReusable(rows: JsonObject[], source: BacklogSnapshot): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const row of rows) {
    const metadata = beadsMigrationMetadata(row);
    if (!metadata) throw new Error(`Beads destination contains foreign task ${String(row.id)}; use a clean destination or the exact same migration destination`);
    if (metadata.marker === RECEIPT_MARKER) {
      if (metadata.sourceProvider !== "backlog" || metadata.targetProvider !== "beads"
          || metadata.sourceRevision !== source.revision || metadata.sourceDigest !== source.digest) {
        throw new Error(`Beads destination receipt ${String(row.id)} belongs to a different source snapshot`);
      }
      continue;
    }
    if (metadata.marker !== SOURCE_MARKER || metadata.sourceProvider !== "backlog"
        || metadata.sourceRevision !== source.revision || metadata.sourceDigest !== source.digest) {
      throw new Error(`Beads destination task ${String(row.id)} has unrelated migration metadata`);
    }
    const sourceTaskId = exactTaskId(metadata.sourceTaskId, "Beads destination migration metadata");
    if (!source.tasks.some((task) => task.sourceTaskId === sourceTaskId)) throw new Error(`Beads destination contains task from a different source snapshot: ${sourceTaskId}`);
    if (mapping[sourceTaskId]) throw new Error(`Beads destination repeats source task ${sourceTaskId}`);
    mapping[sourceTaskId] = exactTaskId(row.id, "Beads destination row");
  }
  return mapping;
}

function generatedBeadsId(runner: CommandRunner, projectRoot: string, pkg: BacklogTaskPackage, source: BacklogSnapshot): string {
  const metadata = JSON.stringify({ prime_claw_migration: {
    marker: SOURCE_MARKER, sourceProvider: "backlog", sourceTaskId: pkg.sourceTaskId,
    sourceRevision: source.revision, placeholder: true,
  } });
  const created = jsonCommand(runner, "bd", ["create", String(pkg.nativeView.task.title ?? pkg.sourceTaskId), "--status", "in_progress", "--metadata", metadata, "--json"], projectRoot, `bd create mapping for ${pkg.sourceTaskId}`);
  const row = Array.isArray(created) ? created[0] : created;
  return exactTaskId(asObject(row, `bd create ${pkg.sourceTaskId}`).id, `bd create ${pkg.sourceTaskId}`);
}

function idSafeForBeads(runner: CommandRunner, projectRoot: string, taskId: string): boolean {
  const probe = runner.run("bd", ["create", "Prime Claw migration ID probe", "--id", taskId, "--dry-run", "--json"], { cwd: projectRoot, allowFailure: true });
  return probe.status === 0;
}

function migrationReceiptBase(source: SourceSnapshot, target: TaskProviderId, destinationRevision: string, destinationDigest: string,
  mappings: Array<{ sourceTaskId: string; destinationTaskId: string }>, ownership: Array<{ ownerSessionId: string; sourceTaskId: string; destinationTaskId: string }>,
  actor: string, timestamp: string, semanticPlacement: string, beadsPlacements: Record<string, SelectedBeadsNativePlacement> = {}): Omit<ProviderMigrationReceipt, "destinationReceiptRevision"> {
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
    ...(Object.keys(beadsPlacements).length
      ? { beadsNativePlacements: Object.entries(beadsPlacements).map(([sourceTaskId, placement]) => ({ sourceTaskId, ...placement })) }
      : {}),
  };
}

function beadsReceiptNotes(receipt: Omit<ProviderMigrationReceipt, "destinationReceiptRevision">): string {
  return `Destination-native Prime Claw migration receipt. The containing Dolt revision is the receipt revision.

\`\`\`json
${JSON.stringify(receipt, null, 2)}
\`\`\``;
}

function createOrUpdateBeadsReceipt(runner: CommandRunner, projectRoot: string, receipt: Omit<ProviderMigrationReceipt, "destinationReceiptRevision">): string {
  const existing = beadsExportRows(runner, projectRoot).find((row) => beadsMigrationMetadata(row)?.marker === RECEIPT_MARKER);
  const metadata = JSON.stringify({ prime_claw_migration: receipt });
  const notes = beadsReceiptNotes(receipt);
  if (existing) {
    const id = exactTaskId(existing.id, "existing Beads migration receipt");
    runRequired(runner, "bd", ["update", id, "--title", RECEIPT_TITLE, "--status", "done", "--notes", notes, "--metadata", metadata, "--json"], projectRoot, "update Beads migration receipt");
    return id;
  }
  const created = jsonCommand(runner, "bd", ["create", RECEIPT_TITLE, "--type", "decision", "--status", "done", "--notes", notes, "--metadata", metadata, "--json"], projectRoot, "create Beads migration receipt");
  const row = Array.isArray(created) ? created[0] : created;
  return exactTaskId(asObject(row, "create Beads migration receipt").id, "create Beads migration receipt");
}

function assertExactBeadsReceipt(
  runner: CommandRunner,
  projectRoot: string,
  allRows: JsonObject[],
  receiptTaskId: string,
  receipt: Omit<ProviderMigrationReceipt, "destinationReceiptRevision">,
): void {
  const row = allRows.find((item) => String(item.id) === receiptTaskId);
  if (!row) throw new Error(`Beads destination receipt ${receiptTaskId} is not present in the complete export`);
  if (canonical(beadsMigrationMetadata(row)) !== canonical(receipt)) throw new Error(`Beads destination receipt ${receiptTaskId} metadata does not exactly match the verified migration receipt`);
  const shown = jsonCommand(runner, "bd", ["show", receiptTaskId, "--json", "--long", "--include-comments"], projectRoot, `verify Beads migration receipt ${receiptTaskId}`);
  if (!Array.isArray(shown) || shown.length !== 1 || shown[0].id !== receiptTaskId) throw new Error(`Beads destination receipt ${receiptTaskId} is not exactly readable`);
  const view = asObject(shown[0], `Beads migration receipt ${receiptTaskId}`);
  if (view.title !== RECEIPT_TITLE || view.status !== "done" || view.issue_type !== "decision"
      || view.notes !== beadsReceiptNotes(receipt)
      || canonical(beadsMigrationMetadata(view)) !== canonical(receipt)) {
    throw new Error(`Beads destination receipt ${receiptTaskId} native payload does not exactly match the verified migration receipt`);
  }
}

function migrateBacklogToBeads(
  source: BacklogSnapshot,
  runner: CommandRunner,
  actor: string,
  timestamp: string,
  semanticPlacement: string,
  beadsPlacements: Record<string, SelectedBeadsNativePlacement>,
  ownershipRows: Array<{ ownerSessionId: string; taskId: string; worktree: string }>,
): DestinationCandidate {
  const prefix = source.tasks[0]?.sourceTaskId.split("-")[0] || basename(source.projectRoot).replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || "TASK";
  configureBeadsDestination(source.projectRoot, runner, prefix);
  const before = beadsExportRows(runner, source.projectRoot);
  const mapping = ensureBeadsDestinationReusable(before, source);
  for (const pkg of source.tasks) {
    if (mapping[pkg.sourceTaskId]) continue;
    if (idSafeForBeads(runner, source.projectRoot, pkg.sourceTaskId)) mapping[pkg.sourceTaskId] = pkg.sourceTaskId;
    else mapping[pkg.sourceTaskId] = generatedBeadsId(runner, source.projectRoot, pkg, source);
  }
  const temp = mkdtempSync(join(tmpdir(), "prime-claw-backlog-to-beads-"));
  try {
    const rows = source.tasks.map((pkg) => {
      const row = backlogToBeadsRow(pkg, semanticPlacement, mapping, beadsPlacements);
      (row.metadata.prime_claw_migration as JsonObject).sourceRevision = source.revision;
      (row.metadata.prime_claw_migration as JsonObject).sourceDigest = source.digest;
      return row;
    });
    const input = join(temp, "tasks.jsonl");
    writeJsonLines(input, rows);
    const dry = runner.run("bd", ["import", input, "--dry-run", "--json"], { cwd: source.projectRoot, allowFailure: true });
    if (dry.status !== 0) throw new MigrationCommandFailure(commandFailure("bd import --dry-run", dry));
    runRequired(runner, "bd", ["import", input, "--allow-stale", "--json"], source.projectRoot, "bd import migration tasks");
  } finally { rmSync(temp, { recursive: true, force: true }); }
  runRequired(runner, "bd", ["dolt", "push", "--no-adopt"], source.projectRoot, "publish migrated Beads tasks");
  const dataTransport = prepareExplicitBeadsWorkspaceTransport(source.projectRoot, runner);
  if (dataTransport.status !== "ready") throw new Error(`Beads destination publication proof failed: ${dataTransport.detail}`);
  const exported = beadsExportRows(runner, source.projectRoot);
  const migratedRows = exported.filter((row) => beadsMigrationMetadata(row)?.marker === SOURCE_MARKER);
  const receiptRows = exported.filter((row) => beadsMigrationMetadata(row)?.marker === RECEIPT_MARKER);
  if (migratedRows.length !== source.counts.total || receiptRows.length > 1 || exported.length !== migratedRows.length + receiptRows.length) {
    throw new Error(`Beads destination count mismatch: expected ${source.counts.total} migrated tasks and at most one receipt, found ${migratedRows.length} tasks, ${receiptRows.length} receipts, ${exported.length} total rows`);
  }
  const destinationTasks: DestinationTask[] = source.tasks.map((pkg) => {
    const id = mapping[pkg.sourceTaskId];
    const row = exported.find((candidate) => candidate.id === id);
    const metadata = row ? beadsMigrationMetadata(row) : null;
    if (!row || !metadata || metadata.sourceTaskId !== pkg.sourceTaskId || metadata.sourceRevision !== source.revision
      || metadata.entityKind !== pkg.entityKind || metadata.classification !== pkg.classification
      || canonical(metadata.nativeView) !== canonical(pkg.nativeView)
      || metadata.markdownBase64 !== pkg.markdownBase64 || metadata.gitHistoryBase64 !== pkg.gitHistoryBase64
      || metadata.semanticPlacement !== semanticPlacement
      || canonical(metadata.beadsNativePlacement ?? null) !== canonical(beadsPlacements[pkg.sourceTaskId] ?? null)) {
      throw new Error(`Beads destination did not preserve the exact source package for ${pkg.sourceTaskId}`);
    }
    const sourceTask = asObject(pkg.nativeView.task, `Backlog source task ${pkg.sourceTaskId}`);
    const expectedRow = backlogToBeadsRow(pkg, semanticPlacement, mapping, beadsPlacements);
    const projectionFields = ["title", "description", "design", "notes", "acceptance_criteria", "issue_type", "priority", "status", "assignee", "labels", "external_ref", "source_system", "close_reason"];
    for (const field of projectionFields) {
      const expected = expectedRow[field];
      if (expected === undefined
          || (expected === "" && row[field] === undefined)
          || (field === "labels" && Array.isArray(expected) && expected.length === 0 && row[field] === undefined)) continue;
      if (canonical(row[field]) !== canonical(expected)) throw new Error(`Beads destination ${field} projection mismatch for ${pkg.sourceTaskId}: expected ${canonical(expected)}, observed ${canonical(row[field])}`);
    }
    const sourceParent = typeof sourceTask.parentTaskId === "string" && sourceTask.parentTaskId ? mapping[sourceTask.parentTaskId] ?? sourceTask.parentTaskId : "";
    const view = jsonCommand(runner, "bd", ["show", id, "--json", "--long", "--include-comments"], source.projectRoot, `verify Beads task ${id}`);
    if (!Array.isArray(view) || view.length !== 1 || view[0].id !== id) throw new Error(`Beads destination task ${id} is not exactly readable`);
    const targetView = asObject(view[0], `Beads task ${id}`);
    const appliedPlacement = beadsPlacements[pkg.sourceTaskId];
    if (appliedPlacement?.priority !== undefined && targetView.priority !== appliedPlacement.priority) {
      throw new Error(`Beads destination native priority readback mismatch for ${pkg.sourceTaskId}: expected ${appliedPlacement.priority}, observed ${JSON.stringify(targetView.priority)}`);
    }
    if (appliedPlacement?.assignee !== undefined && targetView.assignee !== appliedPlacement.assignee) {
      throw new Error(`Beads destination native assignee readback mismatch for ${pkg.sourceTaskId}: expected ${JSON.stringify(appliedPlacement.assignee)}, observed ${JSON.stringify(targetView.assignee)}`);
    }
    const targetParent = String(targetView.parent ?? targetView.parent_id ?? "");
    if (sourceParent !== targetParent) throw new Error(`Beads destination parent mapping mismatch for ${pkg.sourceTaskId}`);
    const expectedRelationships = [...new Set([
      ...relationshipIds(sourceTask.dependencies).map((dependencyId) => mapping[dependencyId] ?? dependencyId),
      ...(sourceParent ? [sourceParent] : []),
    ])].sort();
    assertSameIds(relationshipIds(targetView.dependencies, id), expectedRelationships, `Beads destination relationships for ${pkg.sourceTaskId}`);
    return { sourceTaskId: pkg.sourceTaskId, destinationTaskId: id, taskEvidence: targetView };
  });
  const destinationDataDigest = canonicalSha256(destinationTasks.map((task) => task.taskEvidence));
  const transitions = ownershipRows.map((row) => ({ ownerSessionId: row.ownerSessionId, sourceTaskId: row.taskId, destinationTaskId: mapping[row.taskId] }));
  if (transitions.some((row) => !row.destinationTaskId)) throw new Error("active ownership has no Beads destination mapping");
  const receiptBase = migrationReceiptBase(source, "beads", dataTransport.evidence.publishedRevision, destinationDataDigest,
    destinationTasks.map(({ sourceTaskId, destinationTaskId }) => ({ sourceTaskId, destinationTaskId })), transitions, actor, timestamp, semanticPlacement, beadsPlacements);
  const receiptTaskId = createOrUpdateBeadsReceipt(runner, source.projectRoot, receiptBase);
  runRequired(runner, "bd", ["dolt", "push", "--no-adopt"], source.projectRoot, "publish Beads migration receipt");
  const refresh = (): { revision: string; digest: string; tasks: DestinationTask[]; receiptTaskId: string } => {
    const proof = prepareExplicitBeadsWorkspaceTransport(source.projectRoot, runner);
    if (proof.status !== "ready") throw new Error(`Beads receipt publication proof failed: ${proof.detail}`);
    const allRows = beadsExportRows(runner, source.projectRoot);
    const receiptCount = allRows.filter((row) => beadsMigrationMetadata(row)?.marker === RECEIPT_MARKER).length;
    if (allRows.length !== source.counts.total + 1 || receiptCount !== 1) throw new Error(`Beads destination receipt count mismatch: expected ${source.counts.total + 1} total rows with one receipt, found ${allRows.length} rows and ${receiptCount} receipts`);
    assertExactBeadsReceipt(runner, source.projectRoot, allRows, receiptTaskId, receiptBase);
    const refreshedTasks = destinationTasks.map((task) => {
      const view = jsonCommand(runner, "bd", ["show", task.destinationTaskId, "--json", "--long", "--include-comments"], source.projectRoot, `refresh Beads task ${task.destinationTaskId}`);
      if (!Array.isArray(view) || view.length !== 1) throw new Error(`Beads task ${task.destinationTaskId} is not exactly readable after receipt`);
      return { ...task, taskEvidence: asObject(view[0], `Beads task ${task.destinationTaskId}`) };
    });
    return { revision: proof.evidence.publishedRevision, digest: canonicalSha256(refreshedTasks.map((task) => task.taskEvidence)), tasks: refreshedTasks, receiptTaskId };
  };
  const final = refresh();
  return {
    provider: "beads", revision: final.revision, digest: final.digest, receiptBase, receiptTaskId,
    tasks: final.tasks, refreshAfterReceipt: refresh,
    prepareActiveWorktree(worktree: string) {
      const proof = prepareExplicitBeadsWorkspaceTransport(worktree, runner);
      if (proof.status !== "ready") throw new Error(`active Episode worktree ${worktree} cannot bind the migrated Beads revision: ${proof.detail}; ${proof.remediation}`);
      if (proof.evidence.publishedRevision !== final.revision) throw new Error(`active Episode worktree ${worktree} resolved Beads revision ${proof.evidence.publishedRevision} instead of migrated revision ${final.revision}`);
    },
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
      const relativePath = relative(projectRoot, path).replace(/\\/g, "/");
      const view = backlogEntityKind(storeDir, path) === "draft"
        ? backlogDraftView(runner, projectRoot, taskId, relativePath)
        : backlogTaskView(runner, projectRoot, taskId);
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

interface ExplicitBacklogMigrationWorkspace {
  codePaths: string[];
  storeDir: string;
  remoteName: string;
  remoteUrl: string;
  head: string;
}

function ignoreMigrationBacklogStore(projectRoot: string, runner: CommandRunner, storeRelative = ".backlog"): void {
  const raw = runRequired(runner, "git", ["-C", projectRoot, "rev-parse", "--path-format=absolute", "--git-path", "info/exclude"], projectRoot, "resolve Git private exclude").stdout.trim();
  const exclude = isAbsolute(raw) ? raw : resolve(projectRoot, raw);
  const line = `/${storeRelative}/`;
  const existing = existsSync(exclude) ? readFileSync(exclude, "utf8") : "";
  if (!existing.split(/\r?\n/).includes(line)) appendFileSync(exclude, `${existing && !existing.endsWith("\n") ? "\n" : ""}${line}\n`);
  const ignored = runRequired(runner, "git", ["-C", projectRoot, "check-ignore", "-q", `${storeRelative}/probe`], projectRoot, "prove private Backlog destination ignore");
  if (ignored.status !== 0) throw new Error("Backlog destination is not privately ignored by the code repository");
}

function prepareExplicitBacklogMigrationWorkspace(projectRoot: string, runner: CommandRunner): ExplicitBacklogMigrationWorkspace {
  const prepared = prepareExistingBacklogTaskHistoryWorkspace({ primaryRoot: projectRoot, runner, explicitMigration: true, freshMigration: true });
  if (prepared.status !== "prepared" || !prepared.remote || !prepared.remoteUrl) {
    throw new Error(`Backlog destination preparation failed: ${prepared.status === "blocked" ? `${prepared.detail}; ${prepared.remediation}` : "destination publication remote is required"}`);
  }
  checkBacklogMigrationConfiguration(projectRoot, runner);
  ignoreMigrationBacklogStore(projectRoot, runner, relative(projectRoot, prepared.storeDir).replace(/\\/g, "/"));
  assertPublishedGitRef(runner, prepared.storeDir, prepared.head, prepared.remote, prepared.remoteUrl, TASK_HISTORY_REF, "Backlog destination preparation publication");
  return { storeDir: prepared.storeDir, remoteName: prepared.remote, remoteUrl: prepared.remoteUrl, head: prepared.head, codePaths: prepared.codePaths ?? [] };
}

interface BacklogDestinationBaseline {
  head: string;
  cloneIdentity: string;
  files: Map<string, { bytes: string; history: string; repository: string; relativePath: string }>;
  statusChanges?: Map<string, { bytes: string; content: string; fileHistoryMayAdvance: boolean }>;
}

function backlogFileBytes(path: string): string {
  const entry = lstatSync(path);
  return `${entry.mode}:` + (entry.isSymbolicLink()
    ? `link:${readlinkSync(path)}:${readFileSync(path).toString("base64")}`
    : readFileSync(path).toString("base64"));
}

function backlogCloneIdentity(storeDir: string): string {
  return [storeDir, join(storeDir, ".git")].map((path) => {
    const entry = lstatSync(path);
    return `${realpathSync(path)}:${entry.dev}:${entry.ino}`;
  }).join("\n");
}

function backlogFileHistory(runner: CommandRunner, repository: string, relativePath: string): string {
  return runRequired(runner, "git", ["-C", repository, "log", "--all", "--follow", "--format=%H", "--", relativePath], repository, `Backlog baseline history ${relativePath}`).stdout;
}

function captureBacklogDestinationBaseline(
  projectRoot: string, prepared: ExplicitBacklogMigrationWorkspace, runner: CommandRunner,
): BacklogDestinationBaseline {
  const tracked = runRequired(runner, "git", ["-C", prepared.storeDir, "ls-files", "-z"], prepared.storeDir, "Backlog baseline files").stdout.split("\0").filter(Boolean);
  const paths = new Set(tracked.map((path) => join(prepared.storeDir, path)));
  const captureFiles = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const path = join(folder, entry.name);
      if (entry.isDirectory()) captureFiles(path);
      else paths.add(path);
    }
  };
  captureFiles(prepared.storeDir);
  for (const path of [join(projectRoot, "backlog.config.yml"), join(prepared.storeDir, "config.yml"), join(prepared.storeDir, "config.yaml"), join(prepared.storeDir, ".git", "config")]) {
    if (existsSync(path)) paths.add(path);
  }
  const files = new Map<string, { bytes: string; history: string; repository: string; relativePath: string }>();
  for (const path of paths) {
    const repository = contained(prepared.storeDir, path) ? prepared.storeDir : projectRoot;
    const relativePath = relative(repository, path).replace(/\\/g, "/");
    const history = backlogFileHistory(runner, repository, relativePath);
    files.set(path, { bytes: backlogFileBytes(path), history, repository, relativePath });
  }
  return { head: prepared.head, cloneIdentity: backlogCloneIdentity(prepared.storeDir), files };
}

function assertPreservedBacklogBaseline(
  baseline: BacklogDestinationBaseline, storeDir: string, runner: CommandRunner,
): void {
  if (backlogCloneIdentity(storeDir) !== baseline.cloneIdentity) throw new Error("Backlog destination original clone identity changed");
  runRequired(runner, "git", ["-C", storeDir, "merge-base", "--is-ancestor", baseline.head, "HEAD"], storeDir, "Backlog baseline ancestry");
  for (const [path, original] of baseline.files) {
    const allowed = baseline.statusChanges?.get(path);
    const history = backlogFileHistory(runner, original.repository, original.relativePath);
    let historyPreserved = history === original.history;
    if (!historyPreserved && allowed?.fileHistoryMayAdvance && history.endsWith(original.history)) {
      const added = history.slice(0, history.length - original.history.length).trim().split("\n").filter(Boolean);
      const mode = Number(original.bytes.split(":", 1)[0]) & 0o111 ? "100755" : "100644";
      historyPreserved = added.every(commit => runRequired(runner, "git",
        ["-C", original.repository, "show", `${commit}:${original.relativePath}`], original.repository,
        "verify only authorized status configuration history").stdout === allowed.content
        && runRequired(runner, "git", ["-C", original.repository, "ls-tree", commit, "--", original.relativePath],
          original.repository, "verify additive config history mode").stdout.startsWith(`${mode} blob `));
    }
    if (!existsSync(path) || backlogFileBytes(path) !== (allowed?.bytes ?? original.bytes) || !historyPreserved) {
      throw new Error(`Backlog destination changed original baseline file/history ${original.relativePath}`);
    }
  }
}

/** The pinned CLI explicitly supports editing the project YAML list directly,
 * not `config set statuses` or a whole-config PUT/save (which drops unknown keys).
 * Preserve every non-list byte. Flow insertion retains its exact old entries;
 * simple native block lists become the inline form the native watcher supports.
 */
function additiveBacklogStatusText(content: string, existing: string[], missing: string[]): string {
  const lines = content.split("\n");
  const candidates = lines.map((line, index) => /^statuses:/.test(line) ? index : -1).filter(index => index >= 0);
  const index = candidates.at(-1);
  if (index === undefined) throw new Error("missing statuses need a recognizable native YAML statuses list; preserve config and resolve its form separately");
  const line = lines[index];
  const opening = /^statuses:[ \t]*\[/.exec(line);
  const next = [...existing.slice(0, -1), ...missing, ...existing.slice(-1)];
  if (opening && /^statuses:.*\][ \t]*(?:#.*)?$/.test(line)) {
    // Find only outer-flow commas, without parsing or reserializing old YAML.
    // Keep quoted commas, nested values, anchors and unrelated aliases intact.
    let quote = "", depth = 1, last = opening[0].length, previous = last, closed = false;
    for (let cursor = opening[0].length; cursor < line.length; cursor++) {
      const char = line[cursor];
      if (quote) {
        if (quote === '"' && char === "\\") cursor++;
        else if (char === quote) quote = "";
      } else if (char === '"' || char === "'") quote = char;
      else if (char === "[" || char === "{") depth++;
      else if (char === "]" || char === "}") {
        if (--depth === 0) { if (!line.slice(last, cursor).trim()) last = previous; closed = true; break; }
      } else if (char === "," && depth === 1) { previous = last; last = cursor + 1; }
    }
    if (!closed || !existing.length) throw new Error("missing statuses need a complete nonempty native flow list; preserve this form without writing");
    lines[index] = line.slice(0, last) + missing.map(value => JSON.stringify(value)).join(", ") + ", " + line.slice(last);
  } else if (/^statuses:[ \t]*(?:#.*)?$/.test(line)) {
    let end = index + 1, items = 0;
    const comments: string[] = [];
    while (end < lines.length) {
      const entry = lines[end];
      if (/^[ \t]*(?:#.*)?$/.test(entry)) comments.push(entry);
      else if (/^[ \t]*-[ \t]+(?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[A-Za-z0-9][A-Za-z0-9 _.,()/-]*)[ \t]*$/.test(entry)) items++;
      else if (/^[ \t-]/.test(entry)) throw new Error("missing statuses need simple one-line scalar block items; preserve continuations, anchors, aliases, tags and comments without writing");
      else break;
      end++;
    }
    if (items !== existing.length) throw new Error("native status block shape is not a complete simple sequence; preserve it without writing");
    lines.splice(index, end - index, `statuses: ${JSON.stringify(next)}${line.slice("statuses:".length)}`, ...comments);
  } else throw new Error("missing statuses need a bounded native YAML list edit; preserve this configuration form without rewriting it");
  return lines.join("\n");
}

/** Completion is source-conditioned, not a universal receipt/Done-last policy.
 * Resolve the FIRST spelling exactly as current task authoring does; the pinned
 * native terminal comparison removes only surrounding whitespace, not internal.
 */
function assertBeadsCompletionStatus(source: BeadsSnapshot, statuses: string[]): void {
  if (!source.tasks.some(pkg => statusFromBeads(pkg.nativeView.status ?? pkg.exportRow.status) === "Done")) return;
  const authored = statuses.find(status => backlogStatusKey(status) === "done");
  const terminal = statuses.at(-1);
  if (!authored || !terminal || authored.trim().toLowerCase() !== terminal.trim().toLowerCase()) {
    throw new Error("source Done completion does not match the configured native terminal; preserve status order/default/terminal and resolve completion placement separately before migration writes or reuse");
  }
}

function missingBacklogMigrationStatuses(source: BeadsSnapshot, statuses: string[]): string[] {
  const required = [...source.tasks.map(pkg => statusFromBeads(pkg.nativeView.status ?? pkg.exportRow.status)),
    "In Progress", "Done", ...(source.memories.length ? ["In Design"] : [])];
  const keys = new Set(statuses.map(backlogStatusKey));
  return required.filter(status => { const key = backlogStatusKey(status); if (keys.has(key)) return false; keys.add(key); return true; });
}

/** Only the bounded native YAML forms we can edit without a config serializer.
 * Other forms remain readable by the owned native server, but are not rewritten.
 * JSON-compatible flow and complete scalar blocks have unambiguous list values.
 */
function editableBacklogStatuses(content: string): string[] | undefined {
  const lines = content.split("\n");
  const index = lines.map((line, offset) => /^statuses:/.test(line) ? offset : -1).filter(offset => offset >= 0).at(-1);
  if (index === undefined) return undefined;
  const flow = /^statuses:[ \t]*(\[.*\])[ \t]*(?:#.*)?$/.exec(lines[index]);
  try {
    if (flow) {
      const values = JSON.parse(flow[1].replace(/,[ \t]*\]$/, "]"));
      return Array.isArray(values) && values.every(value => typeof value === "string")
        ? values.map(value => value.trim()).filter(Boolean) : undefined;
    }
    if (!/^statuses:[ \t]*(?:#.*)?$/.test(lines[index])) return undefined;
    const values: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor++) {
      const line = lines[cursor];
      if (/^[ \t]*(?:#.*)?$/.test(line)) continue;
      const item = /^[ \t]*-[ \t]+("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[A-Za-z][A-Za-z0-9 _.,()/-]*)[ \t]*$/.exec(line);
      if (!item) { if (/^[ \t-]/.test(line)) return undefined; break; }
      const text = item[1].trim();
      // Do not guess YAML implicit scalar types or JSON-incompatible escapes.
      if (/^(?:true|false|null)$/i.test(text)) return undefined;
      const value = text.startsWith('"') ? JSON.parse(text) : text.startsWith("'") ? text.slice(1, -1).replace(/''/g, "'") : text;
      if (value.trim()) values.push(value.trim());
    }
    return values;
  } catch { return undefined; }
}

function prepareRequiredBacklogMigrationStatuses(source: BeadsSnapshot, prepared: ExplicitBacklogMigrationWorkspace,
  baseline: BacklogDestinationBaseline, runner: CommandRunner): string[] | undefined {
  const selected = detectExplicitTaskProvider(source.projectRoot, "backlog", runner);
  if (selected.kind !== "selected" || selected.evidence.provider !== "backlog") throw new Error("migration configuration selection changed");
  const path = realpathSync(selected.evidence.configPath);
  if (!contained(prepared.storeDir, path)) throw new Error("migration status configuration is outside the exact prepared store");
  const bytes = readFileSync(path), before = bytes.toString("utf8");
  const existing = editableBacklogStatuses(before);
  // Unsupported native forms may still need NO edit. The single owned server
  // decides that losslessly after startup; missing values then STOP unchanged.
  if (!existing) return undefined;
  assertBeadsCompletionStatus(source, existing);
  const missing = missingBacklogMigrationStatuses(source, existing);
  if (!missing.length) return existing;
  if (missing.some(status => backlogStatusKey(status) === "done")) {
    throw new Error("required Done status is absent; preserve the existing terminal/order and resolve its native completion placement before status writes");
  }
  if (!Buffer.from(before).equals(bytes)) throw new Error("status configuration is not lossless UTF-8; preserve exact bytes without rewriting");
  assertPreservedBacklogBaseline(baseline, prepared.storeDir, runner);
  const native = runRequired(runner, "backlog", ["config", "get", "statuses"], source.projectRoot, "read bounded native status list");
  if (native.stdout.trim() !== existing.join(", ")) throw new Error("bounded native status list mismatch; preserve config without writing");
  const updated = additiveBacklogStatusText(before, existing, missing);
  baseline.statusChanges = new Map([...baseline.files].filter(([file]) => realpathSync(file) === path).map(([file, original]) => [file, {
    bytes: original.bytes.slice(0, original.bytes.lastIndexOf(":") + 1) + Buffer.from(updated).toString("base64"),
    content: updated, fileHistoryMayAdvance: !lstatSync(file).isSymbolicLink(),
  }]));
  writeFileSync(path, updated);
  assertPreservedBacklogBaseline(baseline, prepared.storeDir, runner);
  const expected = [...existing.slice(0, -1), ...missing, ...existing.slice(-1)];
  const fresh = runRequired(runner, "backlog", ["config", "get", "statuses"], source.projectRoot, "verify additive migration statuses");
  if (fresh.stdout.trim() !== expected.join(", ")) throw new Error("native additive status readback mismatch; STOP and retain config without resend");
  return expected;
}

function migrationCodeProjection(projectRoot: string, runner: CommandRunner, allowed: string[]): string {
  const changed = runRequired(runner, "git", ["-C", projectRoot, "diff", "--name-only", "-z", "HEAD"], projectRoot, "inspect migration layout changes").stdout.split("\0").filter(Boolean);
  const untracked = runRequired(runner, "git", ["-C", projectRoot, "ls-files", "--others", "--exclude-standard", "-z"], projectRoot, "inspect migration layout untracked paths").stdout.split("\0").filter(Boolean);
  const layoutPath = (path: string) => allowed.some((base) => path === base || path.startsWith(`${base}/`));
  // Ownership is separately guarded by exact original records and the native
  // switch lock. It is not part of the authorized layout projection.
  const foreign = [...changed, ...untracked].filter((path) => !layoutPath(path) && path !== ".prime-claw/ownership.json");
  if (foreign.length) throw new Error(`migration layout encountered unrelated code changes: ${foreign.join(", ")}`);
  const diff = allowed.length ? runRequired(runner, "git", ["-C", projectRoot, "diff", "--binary", "HEAD", "--", ...allowed], projectRoot, "capture migration layout diff").stdout : "";
  const index = runRequired(runner, "git", ["-C", projectRoot, "ls-files", "--stage", "-z"], projectRoot, "capture migration layout index").stdout;
  return canonicalSha256({ diff, index, files: untracked.filter(layoutPath).map((path) => [path, backlogFileBytes(join(projectRoot, path))]) });
}

async function migrateBeadsToBacklog(
  source: BeadsSnapshot,
  runner: CommandRunner,
  actor: string,
  timestamp: string,
  semanticPlacement: string,
  ownershipRows: Array<{ ownerSessionId: string; taskId: string; worktree: string; verifyCodeProjection?: () => void }>,
  openWeb: OpenBeadsMigrationWeb,
  closeVerifiedWeb: () => Promise<void>,
  checkpoint: MigrationCheckpoint,
): Promise<DestinationCandidate> {
  const prepared = prepareExplicitBacklogMigrationWorkspace(source.projectRoot, runner);
  const storeDir = prepared.storeDir;
  const codeProjection = migrationCodeProjection(source.projectRoot, runner, prepared.codePaths);
  const verifyCodeProjection = () => {
    if (migrationCodeProjection(source.projectRoot, runner, prepared.codePaths) !== codeProjection) throw new Error("code layout projection changed during provider migration");
  };
  const originalPaths = backlogPhysicalTaskPaths(storeDir);
  const originalViews = backlogDestinationViews(runner, source.projectRoot, storeDir, "pre-import baseline");
  if (originalPaths.size || originalViews.size) throw new Error("fresh Backlog destination unexpectedly contains existing records");
  const mapping: Record<string, string> = Object.create(null);
  const baseline = captureBacklogDestinationBaseline(source.projectRoot, prepared, runner);
  const expectedCount = source.counts.total + 1 + (source.memories.length ? 1 : 0);
  const expectedStatuses = prepareRequiredBacklogMigrationStatuses(source, prepared, baseline, runner);
  await checkpoint("Importing and verifying Backlog tasks");
  let configuration: BeadsCurrentConfiguration;
  {
    const web = await openWeb(storeDir);
    configuration = await beadsCurrentConfiguration(web);
    if (expectedStatuses && canonical(configuration.statuses) !== canonical(expectedStatuses)) {
      throw new Error("owned native startup status readback mismatch; STOP and retain config without task allocation or resend");
    }
    assertBeadsCompletionStatus(source, configuration.statuses);
    if (missingBacklogMigrationStatuses(source, configuration.statuses).length) {
      throw new Error("required statuses need a supported JSON-compatible flow or simple one-line scalar block items; cannot continue this import");
    }
    assertPreservedBacklogBaseline(baseline, storeDir, runner);
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
  assertPreservedBacklogBaseline(baseline, storeDir, runner);
  const dataRevision = commitBacklogDestination(runner, prepared, "prime-claw: migrate Beads task history");
  await checkpoint();
  assertCommittedBacklogMemoryOutputs(memoryOutputs, source.projectRoot, storeDir, [dataRevision], runner);
  const dataViews = backlogDestinationViews(runner, source.projectRoot, storeDir, "data");
  const dataPaths = backlogPhysicalTaskPaths(storeDir);
  if (dataViews.size !== expectedCount) throw new Error(`Backlog destination count mismatch: expected ${source.counts.total} issue imports + one receipt + ${source.memories.length ? 1 : 0} USER task, found ${dataViews.size}`);
  assertPreservedBacklogBaseline(baseline, storeDir, runner);
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
  assertPreservedBacklogBaseline(baseline, storeDir, runner);
  const receiptRevision = commitBacklogDestination(runner, prepared, "prime-claw: record task-provider migration receipt");
  const verifyNativeReceipt = () => {
    const exact = cleanGitRevision(runner, storeDir);
    if (exact !== receiptRevision) throw new Error("Backlog destination revision changed after receipt publication");
    assertPublishedGitRef(runner, storeDir, receiptRevision, prepared.remoteName, prepared.remoteUrl, TASK_HISTORY_REF, "Backlog destination receipt publication");
    assertCommittedBacklogMemoryOutputs(memoryOutputs, source.projectRoot, storeDir, [dataRevision, receiptRevision], runner);
    const views = backlogDestinationViews(runner, source.projectRoot, storeDir, "refresh");
    if (views.size !== expectedCount) throw new Error(`Backlog destination receipt count changed: expected ${expectedCount} import/receipt records, found ${views.size}`);
    assertPreservedBacklogBaseline(baseline, storeDir, runner);
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
  return verifiedBacklogCandidate(source, runner, prepared, receiptBase, verifyCodeProjection, verifyNativeReceipt, destinationTasks, ownershipRows);
}

async function verifiedBacklogCandidate(
  source: BeadsSnapshot, runner: CommandRunner, prepared: ExplicitBacklogMigrationWorkspace,
  receiptBase: DestinationCandidate["receiptBase"],
  verifyCodeProjection: () => void, verifyNativeReceipt: () => Omit<ReturnType<DestinationCandidate["refreshAfterReceipt"]>, "tasks">,
  destinationTasks: readonly Omit<DestinationTask, "taskEvidence">[],
  ownershipRows: readonly Pick<ActiveMigrationOwnership, "worktree" | "verifyCodeProjection">[],
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
  const activeCodeProjections = new Map<string, () => void>();
  const activeLayoutPublishers = new Map<string, () => string>();
  return {
    provider: "backlog", revision: final.revision, digest: final.digest, receiptBase, receiptTaskId: final.receiptTaskId, tasks,
    codePaths: prepared.codePaths, verifyCodeProjection, activeCodeProjections,
    publishActiveCodeLayout(worktree: string) {
      const publish = activeLayoutPublishers.get(worktree);
      if (!publish) throw new Error(`active Episode ${worktree} has no exact reviewed layout projection`);
      return publish();
    },
    refreshAfterReceipt: refresh,
    prepareActiveWorktree(worktree: string) {
      assertNoLocalBacklogMigrationDestination(worktree);
      const indexBefore = runRequired(runner, "git", ["-C", worktree, "ls-files", "--stage", "-z"], worktree, "capture active Episode original code index").stdout;
      const originalRelative = relative(source.projectRoot, prepared.storeDir).replace(/\\/g, "/");
      const targetRelative = relative(source.projectRoot, prepared.storeDir).replace(/\\/g, "/");
      const detachPaths = runRequired(runner, "git", ["-C", worktree, "ls-files", "-z", "--", originalRelative], worktree, "check active Episode for tracked task paths").stdout;
      if (detachPaths) throw new Error("existing Backlog destination: active Episode tracked task paths");
      const headBefore = runRequired(runner, "git", ["-C", worktree, "rev-parse", "HEAD"], worktree, "capture active Episode original code HEAD").stdout;
      const attached = prepareExistingBacklogEpisodeProjection({ primaryRoot: source.projectRoot, targetWorktree: worktree,
        runner, expectedRevision: receiptRevision, remoteName: prepared.remoteName, remoteUrl: prepared.remoteUrl,
        originalStoreRelative: relative(source.projectRoot, prepared.storeDir).replace(/\\/g, "/"), originalFiles: [],
        originalRootConfig: null,
        verifyInitialCodeProjection: ownershipRows.find((row) => row.worktree === worktree)?.verifyCodeProjection });
      if (attached.status !== "prepared") throw new Error(`active Episode Backlog attachment failed: ${attached.detail}`);
      if (runRequired(runner, "git", ["-C", worktree, "ls-files", "--stage", "-z"], worktree, "verify active Episode original code index").stdout !== indexBefore
          || runRequired(runner, "git", ["-C", worktree, "rev-parse", "HEAD"], worktree, "verify active Episode original code HEAD").stdout !== headBefore) {
        throw new Error(`active Episode ${worktree} original code HEAD/index changed during layout projection`);
      }
      const projection = migrationCodeProjection(worktree, runner, attached.codePaths ?? []);
      activeCodeProjections.set(worktree, () => {
        if (migrationCodeProjection(worktree, runner, attached.codePaths ?? []) !== projection) throw new Error(`active Episode ${worktree} layout projection changed`);
      });
      activeLayoutPublishers.set(worktree, () => {
        activeCodeProjections.get(worktree)!();
        if (runRequired(runner, "git", ["-C", worktree, "rev-parse", "HEAD"], worktree, "verify active Episode pre-publication head").stdout !== headBefore) throw new Error(`active Episode ${worktree} code head changed before layout publication`);
        const metadata = attached.codePaths.filter((path) => path !== originalRelative && !path.startsWith(`${originalRelative}/`) && path !== targetRelative && !path.startsWith(`${targetRelative}/`));
        if (metadata.length) runRequired(runner, "git", ["-C", worktree, "add", "-A", "--", ...metadata], worktree, "stage exact Episode layout metadata");
        const staged = runRequired(runner, "git", ["-C", worktree, "diff", "--cached", "--name-only", "-z"], worktree, "verify exact Episode layout publication paths").stdout.split("\0").filter(Boolean);
        const exactPaths = new Set(metadata);
        if (staged.some((path) => !exactPaths.has(path))) throw new Error(`active Episode ${worktree} layout publication includes unrelated staged paths`);
        const gitlinks = runRequired(runner, "git", ["-C", worktree, "ls-files", "--stage"], worktree, "verify Episode layout contains no task gitlink").stdout.split("\n").filter((line) => line.startsWith("160000 ") && (line.endsWith(`\t${originalRelative}`) || line.endsWith(`\t${targetRelative}`)));
        if (gitlinks.length) throw new Error(`active Episode ${worktree} layout publication would retain a task gitlink`);
        if (staged.length) {
          runRequired(runner, "git", ["-C", worktree, "-c", "user.name=prime-claw", "-c", "user.email=prime-claw@localhost", "commit", "-m", "prime-claw: activate migrated Backlog Episode layout"], worktree, "commit exact Episode layout bookkeeping");
          runRequired(runner, "git", ["-C", worktree, "push"], worktree, "publish exact Episode layout bookkeeping");
        }
        const head = cleanGitRevision(runner, worktree);
        if (!gitAncestor(runner, worktree, headBefore.trim(), head) || !directPublishedGitHead(runner, worktree, head)) throw new Error(`active Episode ${worktree} layout is not a clean directly published code descendant`);
        return head;
      });
    },
  };
}

async function proveActiveRuntimeContinuity(
  rows: readonly ActiveMigrationOwnership[],
  verifier: ProviderMigrationOptions["verifyActiveRuntime"],
): Promise<Record<string, { expectedPreviousEpisodeActiveSessionId: string; verifiedCurrentEpisodeActiveSessionId: string }>> {
  if (rows.length === 0) return {};
  if (!verifier) throw new Error("active task Episode runtime continuity verification is unavailable");
  const proofs = await verifier(rows.map((row) => ({ ...row.record, head: row.currentCodeHead }) as TaskEpisodeOwnershipRecord));
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

function verifyBacklogDeletionIdentity(snapshot: BacklogSnapshot): void {
  const store = snapshot.evidence.storeDir;
  if (!store || !existsSync(store)) throw new Error("Backlog source store disappeared before guarded deletion");
  const storeEntry = lstatSync(store);
  if (!storeEntry.isDirectory() || storeEntry.isSymbolicLink() || realpathSync(store) !== store || !contained(snapshot.projectRoot, store)) throw new Error("Backlog source store identity changed before guarded deletion");
  const config = snapshot.evidence.configPath;
  if (!existsSync(config)) throw new Error("Backlog source configuration disappeared before guarded deletion");
  const configEntry = lstatSync(config);
  if ((!configEntry.isFile() && !configEntry.isSymbolicLink()) || !contained(snapshot.projectRoot, config)) throw new Error("Backlog source configuration identity changed before guarded deletion");
}

interface BacklogRefRetirement {
  repositoryRoot: string;
  ref: string;
  expectedHead: string;
}

function safeBacklogRefRetirements(snapshot: BacklogSnapshot, runner: CommandRunner): BacklogRefRetirement[] {
  if (!snapshot.publicationRemote || snapshot.publicationRef !== TASK_HISTORY_REF) {
    throw new Error("independent Backlog source has no exact canonical task-history publication authority for guarded retirement");
  }
  const sourceRemoteUrl = runRequired(
    runner, "git", ["-C", snapshot.repositoryRoot, "remote", "get-url", snapshot.publicationRemote],
    snapshot.repositoryRoot, "read independent Backlog source remote",
  ).stdout.trim();
  const trackingRef = `refs/remotes/${snapshot.publicationRemote}/${TASK_HISTORY_REF.slice("refs/heads/".length)}`;
  const retirements: BacklogRefRetirement[] = [];
  for (const repositoryRoot of [...new Set([snapshot.repositoryRoot, snapshot.projectRoot])]) {
    const remoteUrl = runRequired(
      runner, "git", ["-C", repositoryRoot, "remote", "get-url", snapshot.publicationRemote],
      repositoryRoot, "read Backlog retirement remote",
    ).stdout.trim();
    if (remoteUrl !== sourceRemoteUrl) {
      throw new Error(`Backlog retirement repository ${repositoryRoot} maps ${snapshot.publicationRemote} to a different remote`);
    }
    const fetched = runRequired(
      runner, "git", ["-C", repositoryRoot, "fetch", "--no-tags", snapshot.publicationRemote, snapshot.publicationRef],
      repositoryRoot, "fetch exact Backlog source revision before guarded retirement",
    );
    const fetchedHead = runRequired(runner, "git", ["-C", repositoryRoot, "rev-parse", "FETCH_HEAD"], repositoryRoot, "read fetched Backlog source revision").stdout.trim();
    if (fetched.status !== 0 || fetchedHead !== snapshot.revision) {
      throw new Error(`Backlog retirement repository ${repositoryRoot} fetched ${fetchedHead || "no revision"}, not exact source ${snapshot.revision}`);
    }
    for (const ref of [snapshot.publicationRef, trackingRef]) {
      const current = runner.run("git", ["-C", repositoryRoot, "rev-parse", "--verify", "--quiet", ref], { cwd: repositoryRoot, allowFailure: true });
      if (current.status !== 0) continue;
      const observed = current.stdout.trim();
      if (observed !== snapshot.revision) {
        const ancestor = runner.run("git", ["-C", repositoryRoot, "merge-base", "--is-ancestor", observed, snapshot.revision], { cwd: repositoryRoot, allowFailure: true });
        if (ancestor.status !== 0) {
          throw new Error(`independent Backlog source ${repositoryRoot}:${ref} contains unpublished or divergent history at ${observed}; refusing guarded retirement`);
        }
      }
      retirements.push({ repositoryRoot, ref, expectedHead: observed });
    }
  }
  return retirements;
}

function deleteBacklogSource(snapshot: BacklogSnapshot, runner: CommandRunner): void {
  verifyBacklogDeletionIdentity(snapshot);
  if (snapshot.repositoryRoot !== snapshot.projectRoot) {
    const retirements = safeBacklogRefRetirements(snapshot, runner);
    const publicationRef = snapshot.publicationRef!;
    const publicationRemote = snapshot.publicationRemote!;
    runRequired(
      runner,
      "git",
      ["-C", snapshot.repositoryRoot, "push", `--force-with-lease=${publicationRef}:${snapshot.revision}`, publicationRemote, `:${publicationRef}`],
      snapshot.repositoryRoot,
      "retire exact Backlog source task-history publication",
    );
    const retained = runner.run(
      "git",
      ["-C", snapshot.repositoryRoot, "ls-remote", "--exit-code", "--refs", publicationRemote, publicationRef],
      { cwd: snapshot.repositoryRoot, allowFailure: true },
    );
    if (retained.status === 0 || retained.stdout.trim()) throw new Error("Backlog source task-history publication still exists after guarded retirement");
    for (const retirement of retirements) {
      const current = runner.run("git", ["-C", retirement.repositoryRoot, "rev-parse", "--verify", "--quiet", retirement.ref], { cwd: retirement.repositoryRoot, allowFailure: true });
      if (current.status !== 0) continue;
      if (current.stdout.trim() !== retirement.expectedHead) {
        throw new Error(`independent Backlog source ${retirement.repositoryRoot}:${retirement.ref} changed to ${current.stdout.trim()} during guarded retirement`);
      }
      runRequired(
        runner, "git", ["-C", retirement.repositoryRoot, "update-ref", "-d", retirement.ref, retirement.expectedHead],
        retirement.repositoryRoot, `retire exact local Backlog source ref ${retirement.ref}`,
      );
    }
  }
  const store = snapshot.evidence.storeDir!;
  const config = snapshot.evidence.configPath;
  const configInsideStore = contained(store, config);
  if (!configInsideStore) unlinkSync(config);
  rmSync(store, { recursive: true, force: false });
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
  const gateLock = join(snapshot.projectRoot, ".beads.gate.lock");
  if (existsSync(gateLock)) {
    const tracked = runner.run("git", ["-C", snapshot.projectRoot, "ls-files", "--error-unmatch", "--", ".beads.gate.lock"], { cwd: snapshot.projectRoot, allowFailure: true });
    if (tracked.status === 0) throw new Error("Beads source gate lock is unexpectedly tracked by the code repository");
    const gateEntry = lstatSync(gateLock);
    if (!gateEntry.isFile() || gateEntry.isSymbolicLink() || realpathSync(gateLock) !== gateLock || !contained(snapshot.projectRoot, gateLock)) {
      throw new Error("Beads source gate lock is not one safe native transient file");
    }
    unlinkSync(gateLock);
  }
  rmSync(store, { recursive: true, force: false });
}

function independentActiveBacklogStores(source: SourceSnapshot, owners: ActiveMigrationOwnership[]): string[] {
  if (source.provider !== "backlog" || source.repositoryRoot === source.projectRoot || !source.evidence.storeDir) return [];
  const storeRelative = relative(source.projectRoot, source.evidence.storeDir);
  return owners.map((owner) => resolve(owner.worktree, storeRelative));
}

function defaultDeleteSource(snapshot: SourceSnapshot, runner: CommandRunner): void {
  if (snapshot.provider === "backlog") deleteBacklogSource(snapshot, runner);
  else deleteBeadsSource(snapshot, runner);
}

const BEADS_ROOT_GITIGNORE_BLOCK = [
  "# Beads / Dolt files (added by bd init)",
  ".dolt/",
  "*.db",
  ".beads-credential-key",
  ".beads/proxieddb/",
  "*.gate.lock*",
  "",
].join("\n");

/**
 * `bd init --server` commits one exact root ignore block. It is provider
 * initialization metadata, but the surrounding file may contain operator
 * rules. Retire only the pinned native block and preserve every other byte.
 */
function retireBeadsRootGitignoreBlock(projectRoot: string): boolean {
  const path = join(projectRoot, ".gitignore");
  if (!existsSync(path)) return false;
  const entry = lstatSync(path);
  if (!entry.isFile() || entry.isSymbolicLink() || realpathSync(path) !== path) {
    throw new Error("Beads root .gitignore metadata is not one safe regular file");
  }
  const before = readFileSync(path, "utf8");
  const occurrences = before.split(BEADS_ROOT_GITIGNORE_BLOCK).length - 1;
  if (occurrences === 0) return false;
  if (occurrences !== 1) throw new Error("Beads root .gitignore metadata block is ambiguous");
  const after = before.replace(BEADS_ROOT_GITIGNORE_BLOCK, "");
  if (after === "") unlinkSync(path);
  else writeFileSync(path, after);
  return true;
}

function activateBeadsCodeMetadata(projectRoot: string, runner: CommandRunner): string[] {
  const storeDir = join(projectRoot, ".beads");
  const files = [".beads/.gitignore", ".beads/config.yaml", ".beads/metadata.json", ".beads/README.md"];
  for (const relativePath of files) {
    const path = join(projectRoot, relativePath);
    if (!existsSync(path)) throw new Error(`Beads destination activation metadata is missing: ${relativePath}`);
    const entry = lstatSync(path);
    if (!entry.isFile() || entry.isSymbolicLink() || realpathSync(path) !== path || !contained(storeDir, path)) throw new Error(`Beads destination activation metadata is unsafe: ${relativePath}`);
  }
  const raw = runRequired(runner, "git", ["-C", projectRoot, "rev-parse", "--path-format=absolute", "--git-path", "info/exclude"], projectRoot, "resolve Git private exclude for Beads activation").stdout.trim();
  const exclude = isAbsolute(raw) ? raw : resolve(projectRoot, raw);
  if (existsSync(exclude)) {
    const before = readFileSync(exclude, "utf8");
    const after = before.split(/(?<=\n)/).filter((line) => line.trim() !== ".beads/").join("");
    if (after !== before) writeFileSync(exclude, after);
  }
  return files;
}

function publishProviderCutoverCodeState(snapshot: SourceSnapshot, runner: CommandRunner, codePaths: string[] = []): string {
  const projectRoot = snapshot.projectRoot;
  const allowed = new Set<string>([".prime-claw/ownership.json", ...codePaths]);
  if (snapshot.provider === "backlog") {
    for (const path of activateBeadsCodeMetadata(projectRoot, runner)) allowed.add(path);
  } else if (retireBeadsRootGitignoreBlock(projectRoot)) {
    allowed.add(".gitignore");
  }
  if (snapshot.evidence.storeDir && contained(projectRoot, snapshot.evidence.storeDir)) {
    allowed.add(relative(projectRoot, snapshot.evidence.storeDir).replace(/\\/g, "/"));
  }
  if (snapshot.provider === "backlog" && contained(projectRoot, snapshot.evidence.configPath)) {
    allowed.add(relative(projectRoot, snapshot.evidence.configPath).replace(/\\/g, "/"));
  }
  const changed = runRequired(runner, "git", ["-C", projectRoot, "diff", "--name-only", "-z", "HEAD"], projectRoot, "inspect cutover code changes").stdout.split("\0").filter(Boolean);
  const untracked = runRequired(runner, "git", ["-C", projectRoot, "ls-files", "--others", "--exclude-standard", "-z"], projectRoot, "inspect cutover untracked paths").stdout.split("\0").filter(Boolean);
  const permitted = (path: string) => [...allowed].some((base) => path === base || path.startsWith(`${base}/`));
  const foreign = [...changed, ...untracked].filter((path) => !permitted(path));
  if (foreign.length) throw new Error(`provider cutover encountered unrelated code changes: ${foreign.join(", ")}`);
  if (changed.length || untracked.length) {
    // Adoption already staged exact code-index deletions for the preserved
    // task store. Re-adding those absent/ignored paths would either fail or try
    // to reattach the independent clone. Stage only remaining worktree changes.
    const unstaged = runRequired(runner, "git", ["-C", projectRoot, "diff", "--name-only", "-z"], projectRoot, "inspect unstaged cutover metadata").stdout.split("\0").filter(Boolean);
    const stagePaths = [...new Set([...unstaged, ...untracked])];
    if (stagePaths.length) runRequired(runner, "git", ["-C", projectRoot, "add", "-A", "--", ...stagePaths], projectRoot, "stage provider cutover state");
    const staged = runRequired(runner, "git", ["-C", projectRoot, "diff", "--cached", "--name-only", "-z"], projectRoot, "verify full staged provider cutover scope").stdout.split("\0").filter(Boolean);
    if (staged.some((path) => !permitted(path))) throw new Error("provider cutover contains unrelated staged changes");
    const target = detectExplicitTaskProvider(projectRoot, "backlog", runner);
    if (target.kind === "selected" && target.evidence.provider === "backlog" && target.evidence.storeDir) {
      const storeRelative = relative(projectRoot, target.evidence.storeDir).replace(/\\/g, "/");
      const entries = runRequired(runner, "git", ["-C", projectRoot, "ls-files", "--stage", "-z", "--", storeRelative], projectRoot, "verify detached destination has no code gitlink").stdout.split("\0").filter(Boolean);
      if (entries.some((entry) => entry.startsWith("160000 "))) throw new Error("provider cutover would stage the independent task store as a gitlink");
    }
    runRequired(runner, "git", ["-C", projectRoot, "-c", "user.name=prime-claw", "-c", "user.email=prime-claw@localhost", "commit", "-m", `prime-claw: activate ${snapshot.provider === "backlog" ? "Beads" : "Backlog"} task provider`], projectRoot, "commit provider cutover state");
    runRequired(runner, "git", ["-C", projectRoot, "push"], projectRoot, "publish provider cutover state");
  }
  const head = cleanGitRevision(runner, projectRoot);
  if (!directPublishedGitHead(runner, projectRoot, head)) throw new Error("provider cutover code head has no exact direct publication authority");
  return head;
}

function exactSelectedTarget(projectRoot: string, target: TaskProviderId, runner: CommandRunner): void {
  const detection = detectTaskProvider(projectRoot, runner);
  if (detection.kind !== "selected" || detection.evidence.provider !== target) {
    throw new Error(`post-cutover provider selection is not exactly ${target}: ${detection.kind === "blocked" ? detection.detail : detection.kind}`);
  }
  if (target === "backlog") checkBacklogMigrationConfiguration(projectRoot, runner);
  else checkBeadsCapabilities(projectRoot, runner);
}

const WEB_STOP_WARNING = "Owned Web shutdown was not proved (owned-process-stop-unproved; outcome=uncertain). Private transport files retained.";

function webStopUnproved(error: unknown): boolean {
  return error instanceof MigrationBacklogWebError && error.stage === "owned-process-stop-unproved" && error.outcome === "uncertain";
}

export async function migrateTaskProvider(options: ProviderMigrationOptions): Promise<ProviderMigrationResult> {
  const runner = migrationRunner(options.runner);
  let source: SourceSnapshot | undefined;
  let ownershipSwitch: ActiveTaskProviderOwnershipSwitchResult | undefined;
  let backlogWeb: BeadsMigrationWeb | undefined;
  let backlogWebStore: string | undefined;
  let closeAttempt: ReturnType<BeadsMigrationWeb["close"]> | undefined;
  let webWarning: string | undefined;
  const closeWeb = () => backlogWeb ? (closeAttempt ??= backlogWeb.close()) : undefined;
  const closeVerifiedWeb = async () => {
    try { await closeWeb(); }
    catch (error) {
      if (!webStopUnproved(error)) throw error;
      webWarning = WEB_STOP_WARNING;
      options.onProgress?.(webWarning, "warning");
    }
  };
  const checkpoint: MigrationCheckpoint = async (phase) => {
    // Synchronous native commands cannot see an RPC/keyboard abort while the
    // event loop is blocked. Let the operator input run before the next phase.
    if (options.signal && !options.signal.aborted) await yieldToOperator();
    if (options.signal?.aborted) throw new PreCutoverStop();
    if (phase) options.onProgress?.(phase);
  };
  // Forward import uses one migration-owned browser.
  // Allocation happens only after the caller proves/prepares its exact store.
  const openBacklogWeb: OpenBeadsMigrationWeb = async (storeDir) => {
    if (source?.provider !== "beads") throw new Error("native current Web ingress requires the exact Beads source");
    const exactStore = realpathSync(storeDir);
    if (backlogWeb) {
      if (backlogWebStore !== exactStore) throw new Error("migration native Web store changed");
      return backlogWeb;
    }
    backlogWebStore = exactStore;
    backlogWeb = await startMigrationBacklogWeb({ cwd: source.projectRoot, backlogDirectory: exactStore, signal: options.signal });
    return backlogWeb;
  };
  try {
    if (options.targetProvider !== "backlog") return blocked("unsupported-direction", "provider migration supports only Beads-to-Backlog", "request an explicit Beads-to-Backlog inspection; reverse migration is not supported", { targetProvider: options.targetProvider });
    if (!options.confirmedSwitch) return blocked("confirmation-required", "provider switch requires explicit operator confirmation", "inspect the migration, present the exact source revision and semantic placement, then call switch-confirm with confirmedSwitch=true", { targetProvider: options.targetProvider });
    if (!options.actor.trim()) return blocked("actor-required", "provider switch receipt requires an exact actor", "supply the operator-approved actor identifier", { targetProvider: options.targetProvider });
    if (!options.semanticPlacement.trim()) return blocked("placement-required", "provider switch requires managed semantic-placement prose for non-equivalent fields", "inspect exact source fields and supply concise placement prose without omitting any value", { targetProvider: options.targetProvider });
    await checkpoint("Checking source and migration prerequisites");
    const project = resolveNearestProjectRoot(options.cwd, process.env.HOME ?? "", runner);
    if (project.kind === "linked-worktree") return blocked("primary-required", "provider migration must run from the canonical primary checkout", "rerun from the canonical primary Conversation", { targetProvider: options.targetProvider });
    assertFreshBacklogMigrationDestination(project.root, runner);
    const codeHead = cleanGitRevision(runner, project.root);
    if (!GIT_OID.test(codeHead)) throw new Error("provider migration has no exact code HEAD");
    if (!directPublishedGitHead(runner, project.root, codeHead)) throw new Error("provider migration requires an exact directly published code head");
    source = captureSelectedSource(project.root, runner);
    if (source.provider === options.targetProvider) return blocked("same-provider", `the selected provider is already ${source.provider}`, "choose the other supported provider", { sourceProvider: source.provider, targetProvider: options.targetProvider, sourceRevision: source.revision });
    if (source.revision !== options.expectedSourceRevision) return blocked("source-revision-changed", `confirmed source revision ${options.expectedSourceRevision} does not equal current exact ${source.revision}`, "quiesce mutations, request a fresh inspection, and confirm that exact revision", { sourceProvider: source.provider, targetProvider: options.targetProvider, sourceRevision: source.revision });
    await checkpoint();
    const beadsPlacements = source.provider === "backlog" && options.targetProvider === "beads"
      ? validateBeadsNativePlacements(source, options.beadsNativePlacements)
      : {};
    if (source.provider !== "backlog" && (options.beadsNativePlacements?.length ?? 0) > 0) {
      throw new Error("beadsNativePlacements applies only to Backlog-to-Beads migration");
    }
    const ownershipRows = activeOwnership(project.root, source.provider, runner);
    for (const owner of ownershipRows) verifyActiveSourceWorkspace(source, owner, runner);
    const sourceIds = new Set(source.tasks.map((task) => task.sourceTaskId));
    const missing = ownershipRows.filter((row) => !sourceIds.has(row.taskId));
    if (missing.length) throw new Error(`active ownership references source tasks absent from the complete snapshot: ${missing.map((row) => row.taskId).join(", ")}`);
    await proveActiveRuntimeContinuity(ownershipRows, options.verifyActiveRuntime);
    await checkpoint("Preparing the destination");
    for (const owner of ownershipRows) assertNoLocalBacklogMigrationDestination(owner.worktree);
    const timestamp = (options.now ?? (() => new Date().toISOString()))();
    if (Number.isNaN(Date.parse(timestamp))) throw new Error("migration timestamp is not RFC3339");
    const candidate = source.provider === "backlog"
      ? migrateBacklogToBeads(source, runner, options.actor.trim(), timestamp, options.semanticPlacement.trim(), beadsPlacements, ownershipRows)
      : await migrateBeadsToBacklog(source, runner, options.actor.trim(), timestamp, options.semanticPlacement.trim(), ownershipRows, openBacklogWeb, closeVerifiedWeb, checkpoint);
    await checkpoint("Rechecking the receipt, source and ownership before cutover");
    for (const owner of ownershipRows) {
      candidate.prepareActiveWorktree(owner.worktree);
      owner.verifyCodeProjection = candidate.activeCodeProjections?.get(owner.worktree);
    }
    const sourceAfterMigration = captureSameSource(source, runner);
    exactSnapshotUnchanged(source, sourceAfterMigration);
    const refreshed = candidate.refreshAfterReceipt();
    if (refreshed.revision !== candidate.revision || refreshed.digest !== candidate.digest) throw new Error("destination changed after receipt verification");
    candidate.verifyCodeProjection?.();
    const codeBeforeOwnership = candidate.verifyCodeProjection
      ? runRequired(runner, "git", ["-C", project.root, "rev-parse", "HEAD"], project.root, "code head after layout projection").stdout.trim()
      : cleanGitRevision(runner, project.root);
    if (codeBeforeOwnership !== codeHead) throw new Error("code repository changed during provider migration proof");
    for (const owner of ownershipRows) {
      verifyActiveCodeIdentity(project.root, owner, runner);
      verifyActiveSourceWorkspace(source, owner, runner);
    }
    const runtimeProofs = await proveActiveRuntimeContinuity(ownershipRows, options.verifyActiveRuntime);
    await checkpoint();
    const destinationAtSwitch = candidate.refreshAfterReceipt();
    if (destinationAtSwitch.revision !== candidate.revision || destinationAtSwitch.digest !== candidate.digest) throw new Error("destination changed at ownership cutover");
    candidate.verifyCodeProjection?.();
    const sourceAtSwitch = captureSameSource(source, runner);
    exactSnapshotUnchanged(source, sourceAtSwitch);
    for (const owner of ownershipRows) {
      verifyActiveCodeIdentity(project.root, owner, runner);
      verifyActiveSourceWorkspace(source, owner, runner);
    }
    const destinations = ownershipDestinations(candidate);
    // Give any stop queued during synchronous verification one last chance.
    // Once cutover begins, keep the existing ownership compare-and-switch and
    // the source/destination rechecks under its lock; never cancel halfway.
    await checkpoint("Guarded cutover starting; stop no longer interrupts this phase");
    ownershipSwitch = switchActiveTaskProviderOwnership(project.root, {
      sourceProvider: source.provider,
      targetProvider: candidate.provider,
      switchedAt: timestamp,
      destinations,
      expectedSourceRecords: Object.fromEntries(ownershipRows.map((row) => [row.ownerSessionId, row.record])),
      runtimeProofs,
    });
    const deleteSource = options.deleteSource ?? defaultDeleteSource;
    try {
      const switchedRows = ownershipRows.map((row) => {
        const record = ownershipSwitch!.after.owners[row.ownerSessionId];
        if (!record || record.version !== 2 || record.status !== "active") throw new Error(`switched ownership is absent for ${row.ownerSessionId}`);
        return { ...row, taskId: record.taskId, record };
      });
      await proveActiveRuntimeContinuity(switchedRows, options.verifyActiveRuntime);
      withCurrentTaskProviderOwnershipSwitch(project.root, ownershipSwitch, () => {
        candidate.verifyCodeProjection?.();
        const destinationBeforeDelete = candidate.refreshAfterReceipt();
        if (destinationBeforeDelete.revision !== candidate.revision || destinationBeforeDelete.digest !== candidate.digest) throw new Error("destination changed before guarded source deletion");
        const sourceBeforeDelete = captureSameSource(source!, runner);
        exactSnapshotUnchanged(source!, sourceBeforeDelete);
        for (const owner of ownershipRows) {
          verifyActiveCodeIdentity(project.root, owner, runner);
          verifyActiveSourceWorkspace(source!, owner, runner);
        }
        const activeSourceStores = independentActiveBacklogStores(source!, ownershipRows);
        deleteSource(source!, runner);
        for (const storeDir of activeSourceStores) rmSync(storeDir, { recursive: true, force: false });
      });
    } catch (error) {
      try {
        const sourceAfterFailedDeletion = captureSameSource(source, runner);
        exactSnapshotUnchanged(source, sourceAfterFailedDeletion);
        for (const owner of ownershipRows) {
          verifyActiveCodeIdentity(project.root, owner, runner);
          verifyActiveSourceWorkspace(source, owner, runner);
        }
      } catch (sourceProofError) {
        const deletionMessage = error instanceof Error ? error.message : String(error);
        const proofMessage = sourceProofError instanceof Error ? sourceProofError.message : String(sourceProofError);
        throw new Error(`${deletionMessage}; ownership remains on the verified destination because the exact source is not intact after the failed deletion: ${proofMessage}`, { cause: error });
      }
      restoreTaskProviderOwnershipSwitch(project.root, ownershipSwitch);
      ownershipSwitch = undefined;
      throw error;
    }
    exactSelectedTarget(project.root, candidate.provider, runner);
    if (source.evidence.storeDir && existsSync(source.evidence.storeDir)) throw new Error("source store still exists after guarded deletion");
    const remainingActiveSourceStores = independentActiveBacklogStores(source, ownershipRows).filter((storeDir) => existsSync(storeDir));
    if (remainingActiveSourceStores.length) throw new Error(`active Episode source stores still exist after guarded deletion: ${remainingActiveSourceStores.join(", ")}`);
    const destinationAfterDelete = candidate.refreshAfterReceipt();
    if (destinationAfterDelete.revision !== candidate.revision || destinationAfterDelete.digest !== candidate.digest) throw new Error("destination changed after guarded source deletion");
    publishProviderCutoverCodeState(source, runner, candidate.codePaths);
    for (const owner of ownershipRows) {
      if (candidate.publishActiveCodeLayout) {
        owner.currentCodeHead = candidate.publishActiveCodeLayout(owner.worktree);
        owner.verifyCodeProjection = undefined;
      }
    }
    const finalRegistry = readEpisodeOwnershipRegistry(project.root);
    for (const transition of ownershipSwitch.transitions) {
      const owner = ownershipRows.find((row) => row.ownerSessionId === transition.ownerSessionId)!;
      verifyActiveCodeIdentity(project.root, owner, runner);
      const record = finalRegistry.owners[transition.ownerSessionId];
      if (!record || record.version !== 2 || record.status === "inactive" || taskEpisodeProvider(record) !== candidate.provider
          || record.taskId !== transition.destinationTaskId) throw new Error(`active ownership ${transition.ownerSessionId} did not retain the migrated destination binding`);
    }
    const receipt: ProviderMigrationReceipt = {
      ...candidate.receiptBase,
      ownershipTransitions: ownershipSwitch.transitions,
      destinationReceiptRevision: candidate.revision,
    };
    return { status: "completed", receipt, receiptTaskId: candidate.receiptTaskId, sourceAbsent: true, selectedProvider: candidate.provider,
      ...(webWarning ? { warnings: [webWarning] } : {}) };
  } catch (error) {
    // Close the same owned transport on any earlier exit; do not retry shutdown
    // or replace the primary failure with a rejected close.
    let teardownError = error instanceof MigrationBacklogWebError ? error.teardownError : undefined;
    try { await closeWeb(); } catch (stopError) { teardownError ??= stopError; }
    const teardownWarning = webWarning ?? (webStopUnproved(teardownError) ? WEB_STOP_WARNING
      : teardownError && teardownError !== error ? "Owned Web teardown also failed; shutdown was not proved." : undefined);
    const stopped = !ownershipSwitch && (error instanceof PreCutoverStop ||
      (options.signal?.aborted && error instanceof MigrationBacklogWebError &&
        error.stage !== "owned-process-stop-unproved"));
    const message = (stopped ? (teardownWarning ? "Migration stopped before cutover. "
      : "Migration stopped before cutover; owned writers settled. ") : "")
      + (error instanceof Error ? error.message : String(error))
      + (teardownWarning ? ` Warning: ${teardownWarning}` : "")
      + (error instanceof MigrationBacklogWebError && error.artifactDirectory
        ? ` Private transport evidence: ${error.artifactDirectory}` : "");
    const sourcePath = source?.evidence.storeDir ?? "the exact inspected source store";
    const destinationPath = source
      ? join(source.projectRoot, options.targetProvider === "beads" ? ".beads" : ".backlog")
      : `the existing ${options.targetProvider} destination`;
    return blocked(
      ownershipSwitch ? "cutover-incomplete" : stopped ? "pre-cutover-stopped" : "pre-cutover-failed",
      message,
      ownershipSwitch
        ? `stop all task mutation and recover the exact source ${sourcePath}, destination ${destinationPath}, and ownership evidence; do not create another destination`
        : `the source remains authoritative at ${sourcePath}; STOP and preserve source, existing destination ${destinationPath}, ownership and private evidence. Native effects may be partial or unverified. Do not automatically resend, allocate, reconcile, roll back, delete or clean records. ${error instanceof MigrationCommandFailure ? "resolve the reported command/capture or resource failure without trimming required current content or repairing readable source data. " : ""}Inspect the exact stopped state; later recovery requires explicit authority. Required current content must not be trimmed`,
      { sourceProvider: source?.provider, targetProvider: options.targetProvider, sourceRevision: source?.revision },
    );
  }
}
