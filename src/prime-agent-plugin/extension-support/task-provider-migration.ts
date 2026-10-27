/**
 * One-shot selected-provider migration for Prime Claw initialization/upgrade.
 *
 * This module deliberately implements two native directions rather than a
 * universal task model. Backlog snapshots retain the exact structured view,
 * Markdown bytes, placement, and Git history. Beads snapshots retain the exact
 * export row, long native view, Dolt history/events, and append-only
 * provenance. Pair-specific writers use only supported native CLIs, preserve
 * non-equivalent source bytes in destination-native metadata/comments, and
 * verify those exact packages before the one-way ownership/source cutover.
 */
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  type CommandRunner,
  ProcessCommandRunner,
  resolveNearestProjectRoot,
} from "./project-initialization.ts";
import {
  initialTaskStoreConfig,
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
  prepareBeadsWorkspaceTransport,
  prepareExplicitBeadsWorkspaceTransport,
  type BacklogProviderEvidence,
  type BeadsProviderEvidence,
  type BeadsWorkspaceTransportEvidence,
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

const RECEIPT_TITLE = "Prime Claw task-provider migration receipt";
const RECEIPT_MARKER = "prime-claw-task-provider-migration-receipt-v1";
const SOURCE_MARKER = "prime-claw-task-provider-migration-source-v1";
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
  /** Exact operator-selected native Beads priorities for ambiguous Backlog values. */
  beadsPriorityPlacements?: Array<{ sourceTaskId: string; priority: number }>;
}

export interface ProviderMigrationCompleted {
  status: "completed";
  receipt: ProviderMigrationReceipt;
  receiptTaskId: string;
  sourceAbsent: true;
  selectedProvider: TaskProviderId;
}

export type ProviderMigrationResult = ProviderMigrationCompleted | ProviderMigrationBlocked;

export interface ProviderMigrationOptions {
  cwd: string;
  targetProvider: TaskProviderId;
  expectedSourceRevision: string;
  confirmedSwitch: boolean;
  actor: string;
  semanticPlacement: string;
  /** Pair-specific literal native values for Backlog priorities without one exact Beads equivalent. */
  beadsPriorityPlacements?: Array<{ sourceTaskId: string; priority: number }>;
  runner?: CommandRunner;
  now?: () => string;
  deleteSource?: (snapshot: SourceSnapshot, runner: CommandRunner) => void;
  verifyActiveRuntime?: (records: readonly TaskEpisodeOwnershipRecord[]) => Promise<Array<{
    ownerSessionId: string;
    expectedPreviousEpisodeActiveSessionId: string;
    verifiedCurrentEpisodeActiveSessionId: string;
  }>>;
}

type NativeCommand = { stdout: string; stderr: string; status: number };
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

interface BeadsTaskPackage {
  sourceTaskId: string;
  classification: "open" | "closed" | "archived";
  exportRow: JsonObject;
  exportLineBase64: string;
  nativeView: JsonObject;
  history: unknown;
  events: unknown;
  provenance: unknown;
}

interface BeadsSnapshot {
  provider: "beads";
  projectRoot: string;
  evidence: BeadsProviderEvidence;
  transport: BeadsWorkspaceTransportEvidence;
  revision: string;
  digest: string;
  tasks: BeadsTaskPackage[];
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
}

function blocked(
  code: string,
  detail: string,
  remediation: string,
  context: Partial<Pick<ProviderMigrationBlocked, "sourceProvider" | "targetProvider" | "sourceRevision">> = {},
): ProviderMigrationBlocked {
  return { status: "blocked", code, detail, remediation, ...context };
}

function commandFailure(label: string, result: NativeCommand): string {
  return `${label}: ${result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`}`;
}

function runRequired(runner: CommandRunner, command: string, args: string[], cwd: string, label = `${command} ${args.join(" ")}`): NativeCommand {
  const result = runner.run(command, args, { cwd, allowFailure: true });
  if (result.status !== 0) throw new Error(commandFailure(label, result));
  return result;
}

function parseJson(text: string, label: string): any {
  try { return JSON.parse(text); }
  catch (error) { throw new Error(`${label} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`); }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
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
  const status = runRequired(runner, "git", ["-C", repositoryRoot, "status", "--porcelain=v1"], repositoryRoot, "git source cleanliness");
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
  if (rel.startsWith("completed/")) return "closed";
  if (rel.startsWith("archive/")) return "archived";
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

function archivedBacklogViews(
  runner: CommandRunner,
  repositoryRoot: string,
  projectRoot: string,
  revision: string,
  archived: Array<{ taskId: string; path: string; entityKind: "task" | "draft" }>,
): Map<string, JsonObject> {
  const views = new Map<string, JsonObject>();
  if (!archived.length) return views;
  const temp = mkdtempSync(join(tmpdir(), "prime-claw-archived-backlog-read-"));
  const nestedStore = repositoryRoot !== projectRoot;
  const clone = join(temp, nestedStore ? ".backlog" : "source");
  try {
    runRequired(runner, "git", ["clone", "-q", "--no-hardlinks", repositoryRoot, clone], temp, "clone exact Backlog source for archived native reads");
    runRequired(runner, "git", ["-C", clone, "checkout", "-q", "--detach", revision], clone, "checkout exact Backlog source revision");
    const nativeRoot = nestedStore ? temp : clone;
    for (const item of archived) {
      const archivedRelative = relative(repositoryRoot, item.path);
      const disposableSource = join(clone, archivedRelative);
      const storeRelative = nestedStore
        ? ".backlog"
        : relative(projectRoot, dirname(dirname(dirname(item.path))));
      const disposableFolder = resolve(nativeRoot, storeRelative, item.entityKind === "draft" ? "drafts" : "tasks");
      if (!contained(clone, disposableFolder)) throw new Error(`archived Backlog ${item.entityKind} ${item.taskId} has unsafe disposable placement`);
      mkdirSync(disposableFolder, { recursive: true });
      renameSync(disposableSource, join(disposableFolder, basename(item.path)));
      const view = item.entityKind === "draft"
        ? backlogDraftView(runner, nativeRoot, item.taskId, relative(projectRoot, item.path).replace(/\\/g, "/"))
        : backlogTaskView(runner, nativeRoot, item.taskId);
      views.set(item.taskId, view);
    }
    return views;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
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
  const archivedViews = archivedBacklogViews(
    runner, repositoryRoot, projectRoot, revision,
    taskFiles.filter((item) => item.classification === "archived").map(({ taskId, path, entityKind }) => ({ taskId, path, entityKind })),
  );
  const tasks = taskFiles.map(({ path, markdown, taskId, entityKind, classification: physicalClassification }): BacklogTaskPackage => {
    const relativePath = relative(projectRoot, path).replace(/\\/g, "/");
    const nativeView = physicalClassification === "archived"
      ? archivedViews.get(taskId)!
      : entityKind === "draft"
        ? backlogDraftView(runner, projectRoot, taskId, relativePath)
        : backlogTaskView(runner, projectRoot, taskId);
    if (physicalClassification !== "archived") {
      const reported = resolve(projectRoot, nativeView.task.path);
      if (realpathSync(reported) !== realpathSync(path)) throw new Error(`Backlog ${entityKind} ${taskId} native path does not match its exact source file`);
    }
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
  const digest = sha256(canonical(tasks));
  return {
    provider: "backlog", projectRoot, evidence, revision, digest, repositoryRoot,
    ...(publication ? { publicationRemote: publication.remote, publicationRef: publication.ref } : {}),
    tasks, counts,
  };
}

function jsonCommand(runner: CommandRunner, command: string, args: string[], cwd: string, label: string): unknown {
  return parseJson(runRequired(runner, command, args, cwd, label).stdout, label);
}

function completeBeadsExport(runner: CommandRunner, projectRoot: string, label: string): Array<{ row: JsonObject; line: string }> {
  const filter = asObject(
    jsonCommand(runner, "bd", ["config", "get", "export.exclude_owners", "--json"], projectRoot, `${label} export filter`),
    `${label} export filter`,
  );
  if (filter.schema_version !== 1 || filter.key !== "export.exclude_owners" || typeof filter.value !== "string") {
    throw new Error(`${label} returned malformed export.exclude_owners evidence`);
  }
  if (filter.value.trim() !== "") {
    throw new Error(`${label} cannot prove a complete inventory while export.exclude_owners is configured`);
  }
  const result = runRequired(runner, "bd", ["export", "--all"], projectRoot, `${label} complete export`);
  const exported = result.stdout.split(/\r?\n/).filter((line) => line.trim() !== "").map((line) => ({
    line,
    row: asObject(parseJson(line, `${label} export row`), `${label} export row`),
  }));
  const inventory = jsonCommand(
    runner,
    "bd",
    ["--readonly", "sql", "--json", "SELECT id FROM issues ORDER BY id"],
    projectRoot,
    `${label} independent issue inventory`,
  );
  if (!Array.isArray(inventory)) throw new Error(`${label} independent issue inventory is not an array`);
  const inventoryIds = inventory.map((value) => exactTaskId(asObject(value, `${label} inventory row`).id, `${label} inventory row`)).sort();
  const exportIds = exported.map(({ row }) => exactTaskId(row.id, `${label} export row`)).sort();
  if (new Set(inventoryIds).size !== inventoryIds.length || new Set(exportIds).size !== exportIds.length
      || canonical(inventoryIds) !== canonical(exportIds)) {
    throw new Error(`${label} export does not exactly match the independent native issue inventory`);
  }
  return exported;
}

function captureBeads(
  projectRoot: string,
  evidence: BeadsProviderEvidence,
  runner: CommandRunner,
  explicit: boolean,
): BeadsSnapshot {
  checkBeadsCapabilities(projectRoot, runner);
  const prepared = explicit
    ? prepareExplicitBeadsWorkspaceTransport(projectRoot, runner)
    : prepareBeadsWorkspaceTransport(projectRoot, runner);
  if (prepared.status !== "ready") throw new Error(`Beads publication proof failed (${prepared.code}): ${prepared.detail}; ${prepared.remediation}`);
  const exported = completeBeadsExport(runner, projectRoot, "Beads source");
  const tasks = exported.map(({ line, row: exportRow }): BeadsTaskPackage => {
    const taskId = exactTaskId(exportRow.id, "Beads export row");
    const rawView = jsonCommand(runner, "bd", ["show", taskId, "--json", "--long", "--include-comments"], projectRoot, `bd show ${taskId}`);
    const views = Array.isArray(rawView) ? rawView : [];
    if (views.length !== 1) throw new Error(`bd show ${taskId} did not return one exact native task`);
    const nativeView = asObject(views[0], `bd show ${taskId}`);
    if (nativeView.id !== taskId) throw new Error(`bd show ${taskId} returned a different ID`);
    const history = jsonCommand(runner, "bd", ["history", taskId, "--json"], projectRoot, `bd history ${taskId}`);
    const events = jsonCommand(runner, "bd", ["history", taskId, "--events", "--json"], projectRoot, `bd history ${taskId} --events`);
    const provenance = jsonCommand(runner, "bd", ["provenance", "log", taskId, "--json"], projectRoot, `bd provenance log ${taskId}`);
    const nativeStatus = String(nativeView.status);
    const classification = nativeStatus === "closed" ? "archived" : nativeStatus === "done" ? "closed" : "open";
    return {
      sourceTaskId: taskId,
      classification,
      exportRow,
      exportLineBase64: Buffer.from(line).toString("base64"),
      nativeView,
      history,
      events,
      provenance,
    };
  }).sort((a, b) => a.sourceTaskId.localeCompare(b.sourceTaskId));
  if (new Set(tasks.map((task) => task.sourceTaskId)).size !== tasks.length) throw new Error("Beads source export repeats a canonical task ID");
  const counts = {
    open: tasks.filter((task) => task.classification === "open").length,
    closed: tasks.filter((task) => task.classification === "closed").length,
    archived: tasks.filter((task) => task.classification === "archived").length,
    total: tasks.length,
  };
  const digest = sha256(canonical(tasks));
  return {
    provider: "beads", projectRoot, evidence, transport: prepared.evidence,
    revision: prepared.evidence.publishedRevision, digest, tasks, counts,
  };
}

function selectedEvidence(projectRoot: string, runner: CommandRunner): { provider: TaskProviderId; evidence: BacklogProviderEvidence | BeadsProviderEvidence } {
  const detection = detectTaskProvider(projectRoot, runner);
  if (detection.kind !== "selected") {
    if (detection.kind === "blocked") throw new Error(`provider authority blocked (${detection.code}): ${detection.detail}; ${detection.remediation}`);
    throw new Error("provider migration requires one selected live source provider");
  }
  return { provider: detection.evidence.provider, evidence: detection.evidence };
}

function captureProviderEvidence(
  projectRoot: string,
  provider: TaskProviderId,
  evidence: BacklogProviderEvidence | BeadsProviderEvidence,
  runner: CommandRunner,
  explicit = false,
): SourceSnapshot {
  return provider === "backlog"
    ? captureBacklog(projectRoot, evidence as BacklogProviderEvidence, runner)
    : captureBeads(projectRoot, evidence as BeadsProviderEvidence, runner, explicit);
}

function captureSelectedSource(projectRoot: string, runner: CommandRunner): SourceSnapshot {
  const selected = selectedEvidence(projectRoot, runner);
  return captureProviderEvidence(projectRoot, selected.provider, selected.evidence, runner);
}

function captureSameSource(snapshot: SourceSnapshot, runner: CommandRunner): SourceSnapshot {
  return snapshot.provider === "backlog"
    ? captureBacklog(snapshot.projectRoot, snapshot.evidence, runner, true)
    : captureBeads(snapshot.projectRoot, snapshot.evidence, runner, true);
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
  if (realpathSync(top) !== row.worktree || dirname(realpathSync(common)) !== realpathSync(projectRoot)
      || realpathSync(gitDir) === realpathSync(common) || branch !== row.branch || head !== row.currentCodeHead || status !== "") {
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
    const row = {
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
    const proof = prepareExplicitBeadsWorkspaceTransport(row.worktree, runner);
    if (proof.status !== "ready") throw new Error(`active task Episode ${row.ownerSessionId} cannot prove its source Beads workspace: ${proof.detail}; ${proof.remediation}`);
    if (proof.evidence.publishedRevision !== source.revision) throw new Error(`active task Episode ${row.ownerSessionId} resolves Beads revision ${proof.evidence.publishedRevision} instead of source revision ${source.revision}`);
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
  const priorityRequirements = source.provider === "backlog" && target === "beads"
    ? source.tasks.flatMap((pkg) => {
        const task = asObject(pkg.nativeView.task, `Backlog task ${pkg.sourceTaskId}`);
        const raw = String(task.priority ?? "p2").trim();
        return directBeadsPriority(raw) === undefined ? [`${pkg.sourceTaskId}=${raw}`] : [];
      })
    : [];
  const nativeValues = priorityRequirements.length
    ? ` These Backlog priorities have no single native Beads equivalent: ${priorityRequirements.join(", ")}. On switch-confirm, supply one exact literal Beads priority (0..4) for each through beadsPriorityPlacements; prose is never parsed as a value.`
    : "";
  return `Review exact ${source.provider} source fields that have no native ${target} equivalent. Supply concise semantic-placement prose for the confirm call.${nativeValues} The code preserves every raw value, absence, actor, timestamp, status transition, and history entry losslessly in destination-native metadata/provenance; your prose decides only the human-facing placement of non-equivalent content and must not authorize omission or normalization.`;
}

export function inspectTaskProviderMigration(options: {
  cwd: string;
  targetProvider: TaskProviderId;
  runner?: CommandRunner;
}): ProviderMigrationInspection | ProviderMigrationBlocked {
  const runner = options.runner ?? new ProcessCommandRunner();
  try {
    const project = resolveNearestProjectRoot(options.cwd, process.env.HOME ?? "", runner);
    if (project.kind === "linked-worktree") return blocked("primary-required", "provider migration must run from the canonical primary checkout", "rerun /initialize-prime-claw from the canonical primary Conversation", { targetProvider: options.targetProvider });
    const codeHead = cleanGitRevision(runner, project.root);
    if (!directPublishedGitHead(runner, project.root, codeHead)) throw new Error("provider migration inspection requires an exact directly published code head");
    const source = captureSelectedSource(project.root, runner);
    if (source.provider === options.targetProvider) return blocked("same-provider", `the selected provider is already ${source.provider}`, "choose the other supported provider", { sourceProvider: source.provider, targetProvider: options.targetProvider, sourceRevision: source.revision });
    const ownership = activeOwnership(project.root, source.provider, runner);
    for (const owner of ownership) verifyActiveSourceWorkspace(source, owner, runner);
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
    return blocked("preflight", error instanceof Error ? error.message : String(error), "repair the exact native source/publication evidence, then request a new migration inspection", { targetProvider: options.targetProvider });
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
  if (status === "open") return "In Design";
  if (status === "closed") return "Done";
  throw new Error(`Beads task has unmapped status ${JSON.stringify(status)}`);
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

function validateBeadsPrioritySelection(
  source: BacklogSnapshot,
  input: Array<{ sourceTaskId: string; priority: number }> | undefined,
): Record<string, number> {
  if (input !== undefined && !Array.isArray(input)) {
    throw new Error("beadsPriorityPlacements must be an array of exact source Backlog task IDs and native Beads priorities");
  }
  const supplied: Record<string, number> = {};
  const sourceIds = new Set(source.tasks.map((pkg) => pkg.sourceTaskId));
  for (const item of input ?? []) {
    if (!item || typeof item !== "object" || typeof item.sourceTaskId !== "string") throw new Error("each managed Beads priority requires an exact sourceTaskId");
    if (!sourceIds.has(item.sourceTaskId)) throw new Error(`managed Beads priority references unknown source Backlog task ${item.sourceTaskId}`);
    if (Object.prototype.hasOwnProperty.call(supplied, item.sourceTaskId)) throw new Error(`managed Beads priority repeats source Backlog task ${item.sourceTaskId}`);
    if (!Number.isInteger(item.priority) || item.priority < 0 || item.priority > 4) throw new Error(`managed Beads priority for ${item.sourceTaskId} must be an integer from 0 through 4`);
    supplied[item.sourceTaskId] = item.priority;
  }
  const selected: Record<string, number> = {};
  for (const pkg of source.tasks) {
    const task = asObject(pkg.nativeView.task, `Backlog task ${pkg.sourceTaskId}`);
    const raw = String(task.priority ?? "p2").trim();
    const direct = directBeadsPriority(raw);
    const hasManaged = Object.prototype.hasOwnProperty.call(supplied, pkg.sourceTaskId);
    if (direct !== undefined) {
      if (hasManaged) throw new Error(`Backlog task ${pkg.sourceTaskId} priority ${raw} already has exact native Beads priority ${direct}; omit the managed override`);
      continue;
    }
    if (!hasManaged) {
      throw new Error(`Backlog task ${pkg.sourceTaskId} priority ${raw} has no single native Beads equivalent; use the structured initialize_prime_claw switch-confirm and supply its explicit native value through beadsPriorityPlacements`);
    }
    const priority = supplied[pkg.sourceTaskId];
    const normalized = raw.toLowerCase();
    if (normalized === "high" && priority !== 0 && priority !== 1) {
      throw new Error(`managed native Beads priority for Backlog High task ${pkg.sourceTaskId} must be 0 or 1`);
    }
    if (normalized === "low" && priority !== 3 && priority !== 4) {
      throw new Error(`managed native Beads priority for Backlog Low task ${pkg.sourceTaskId} must be 3 or 4`);
    }
    selected[pkg.sourceTaskId] = priority;
  }
  return Object.fromEntries(Object.entries(selected).sort(([left], [right]) => left.localeCompare(right)));
}

function beadsPriorityForBacklog(pkg: BacklogTaskPackage, managed: Record<string, number>): number {
  const task = asObject(pkg.nativeView.task, `Backlog task ${pkg.sourceTaskId}`);
  const direct = directBeadsPriority(task.priority);
  if (direct !== undefined) return direct;
  const selected = managed[pkg.sourceTaskId];
  if (!Number.isInteger(selected) || selected < 0 || selected > 4) {
    throw new Error(`Backlog task ${pkg.sourceTaskId} has no verified native Beads priority selection`);
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
  beadsPriorities: Record<string, number>,
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
    ...(Object.prototype.hasOwnProperty.call(beadsPriorities, pkg.sourceTaskId)
      ? { beadsPriorityPlacement: beadsPriorities[pkg.sourceTaskId] }
      : {}),
  };
  const nativeDraftView = pkg.entityKind === "draft" && typeof task.nativePlainViewBase64 === "string"
    ? Buffer.from(task.nativePlainViewBase64, "base64").toString("utf8")
    : "";
  const notes = [
    backlogSupplement(task, placement),
    nativeDraftView ? `## Exact native Backlog draft view\n\n${nativeDraftView}` : "",
  ].filter(Boolean).join("\n\n");
  return {
    id: destinationId,
    title: String(task.title ?? pkg.sourceTaskId),
    description: String(task.description ?? ""),
    design: String(task.implementationPlan ?? ""),
    notes,
    acceptance_criteria: backlogAcceptance(task),
    issue_type: type,
    priority: beadsPriorityForBacklog(pkg, beadsPriorities),
    status: pkg.classification === "archived" ? "closed" : pkg.entityKind === "draft" ? "in_design" : statusFromBacklog(task.status),
    ...(pkg.classification === "archived" ? { close_reason: `Migrated archived Backlog ${pkg.entityKind} ${pkg.sourceTaskId}; exact source lifecycle is retained in prime_claw_migration metadata` } : {}),
    ...(Array.isArray(task.assignees) && task.assignees.length ? { assignee: String(task.assignees[0]) } : {}),
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
  actor: string, timestamp: string, semanticPlacement: string, beadsPriorities: Record<string, number> = {}): Omit<ProviderMigrationReceipt, "destinationReceiptRevision"> {
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
    ...(Object.keys(beadsPriorities).length
      ? { beadsPriorityPlacements: Object.entries(beadsPriorities).map(([sourceTaskId, priority]) => ({ sourceTaskId, priority })) }
      : {}),
  };
}

function createOrUpdateBeadsReceipt(runner: CommandRunner, projectRoot: string, receipt: Omit<ProviderMigrationReceipt, "destinationReceiptRevision">): string {
  const existing = beadsExportRows(runner, projectRoot).find((row) => beadsMigrationMetadata(row)?.marker === RECEIPT_MARKER);
  const metadata = JSON.stringify({ prime_claw_migration: receipt });
  const notes = `Destination-native Prime Claw migration receipt. The containing Dolt revision is the receipt revision.\n\n\`\`\`json\n${JSON.stringify(receipt, null, 2)}\n\`\`\``;
  if (existing) {
    const id = exactTaskId(existing.id, "existing Beads migration receipt");
    runRequired(runner, "bd", ["update", id, "--title", RECEIPT_TITLE, "--notes", notes, "--metadata", metadata, "--json"], projectRoot, "update Beads migration receipt");
    return id;
  }
  const created = jsonCommand(runner, "bd", ["create", RECEIPT_TITLE, "--type", "decision", "--status", "done", "--notes", notes, "--metadata", metadata, "--json"], projectRoot, "create Beads migration receipt");
  const row = Array.isArray(created) ? created[0] : created;
  return exactTaskId(asObject(row, "create Beads migration receipt").id, "create Beads migration receipt");
}

function migrateBacklogToBeads(
  source: BacklogSnapshot,
  runner: CommandRunner,
  actor: string,
  timestamp: string,
  semanticPlacement: string,
  beadsPriorities: Record<string, number>,
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
      const row = backlogToBeadsRow(pkg, semanticPlacement, mapping, beadsPriorities);
      (row.metadata.prime_claw_migration as JsonObject).sourceRevision = source.revision;
      (row.metadata.prime_claw_migration as JsonObject).sourceDigest = source.digest;
      return row;
    });
    const input = join(temp, "tasks.jsonl");
    writeJsonLines(input, rows);
    const dry = runner.run("bd", ["import", input, "--dry-run", "--json"], { cwd: source.projectRoot, allowFailure: true });
    if (dry.status !== 0) throw new Error(commandFailure("bd import --dry-run", dry));
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
      || metadata.beadsPriorityPlacement !== beadsPriorities[pkg.sourceTaskId]) {
      throw new Error(`Beads destination did not preserve the exact source package for ${pkg.sourceTaskId}`);
    }
    const sourceTask = asObject(pkg.nativeView.task, `Backlog source task ${pkg.sourceTaskId}`);
    const expectedRow = backlogToBeadsRow(pkg, semanticPlacement, mapping, beadsPriorities);
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
    const targetParent = String(targetView.parent ?? targetView.parent_id ?? "");
    if (sourceParent !== targetParent) throw new Error(`Beads destination parent mapping mismatch for ${pkg.sourceTaskId}`);
    const expectedRelationships = [...new Set([
      ...relationshipIds(sourceTask.dependencies).map((dependencyId) => mapping[dependencyId] ?? dependencyId),
      ...(sourceParent ? [sourceParent] : []),
    ])].sort();
    assertSameIds(relationshipIds(targetView.dependencies, id), expectedRelationships, `Beads destination relationships for ${pkg.sourceTaskId}`);
    return { sourceTaskId: pkg.sourceTaskId, destinationTaskId: id, taskEvidence: targetView };
  });
  const destinationDataDigest = sha256(canonical(destinationTasks.map((task) => task.taskEvidence)));
  const transitions = ownershipRows.map((row) => ({ ownerSessionId: row.ownerSessionId, sourceTaskId: row.taskId, destinationTaskId: mapping[row.taskId] }));
  if (transitions.some((row) => !row.destinationTaskId)) throw new Error("active ownership has no Beads destination mapping");
  const receiptBase = migrationReceiptBase(source, "beads", dataTransport.evidence.publishedRevision, destinationDataDigest,
    destinationTasks.map(({ sourceTaskId, destinationTaskId }) => ({ sourceTaskId, destinationTaskId })), transitions, actor, timestamp, semanticPlacement, beadsPriorities);
  const receiptTaskId = createOrUpdateBeadsReceipt(runner, source.projectRoot, receiptBase);
  runRequired(runner, "bd", ["dolt", "push", "--no-adopt"], source.projectRoot, "publish Beads migration receipt");
  const refresh = (): { revision: string; digest: string; tasks: DestinationTask[]; receiptTaskId: string } => {
    const proof = prepareExplicitBeadsWorkspaceTransport(source.projectRoot, runner);
    if (proof.status !== "ready") throw new Error(`Beads receipt publication proof failed: ${proof.detail}`);
    const allRows = beadsExportRows(runner, source.projectRoot);
    const receiptCount = allRows.filter((row) => beadsMigrationMetadata(row)?.marker === RECEIPT_MARKER).length;
    if (allRows.length !== source.counts.total + 1 || receiptCount !== 1) throw new Error(`Beads destination receipt count mismatch: expected ${source.counts.total + 1} total rows with one receipt, found ${allRows.length} rows and ${receiptCount} receipts`);
    const refreshedTasks = destinationTasks.map((task) => {
      const view = jsonCommand(runner, "bd", ["show", task.destinationTaskId, "--json", "--long", "--include-comments"], source.projectRoot, `refresh Beads task ${task.destinationTaskId}`);
      if (!Array.isArray(view) || view.length !== 1) throw new Error(`Beads task ${task.destinationTaskId} is not exactly readable after receipt`);
      return { ...task, taskEvidence: asObject(view[0], `Beads task ${task.destinationTaskId}`) };
    });
    return { revision: proof.evidence.publishedRevision, digest: sha256(canonical(refreshedTasks.map((task) => task.taskEvidence))), tasks: refreshedTasks, receiptTaskId };
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

function backlogSourcePackage(pkg: BeadsTaskPackage, source: BeadsSnapshot, semanticPlacement: string): string {
  return JSON.stringify({
    marker: SOURCE_MARKER,
    sourceProvider: "beads",
    sourceRevision: source.revision,
    sourceDigest: source.digest,
    sourceTaskId: pkg.sourceTaskId,
    exportRow: pkg.exportRow,
    exportLineBase64: pkg.exportLineBase64,
    nativeView: pkg.nativeView,
    history: pkg.history,
    events: pkg.events,
    provenance: pkg.provenance,
    semanticPlacement,
  });
}

function chunkComment(value: string): string[] {
  const encoded = Buffer.from(value).toString("base64");
  const size = 24_000;
  const count = Math.max(1, Math.ceil(encoded.length / size));
  return Array.from({ length: count }, (_, index) => `${SOURCE_MARKER} part=${index + 1}/${count}\n${encoded.slice(index * size, (index + 1) * size)}`);
}

function backlogCreateId(output: string): string {
  const heading = /^Task ([A-Z][A-Z0-9_-]*-\d+(?:\.\d+)*) -/m.exec(output);
  if (heading) return heading[1];
  const matches = output.match(/\b[A-Za-z][A-Za-z0-9_-]*-\d+(?:\.\d+)*\b/g) ?? [];
  const ids = [...new Set(matches.map((value) => value.toUpperCase()))];
  if (ids.length !== 1) throw new Error(`Backlog create did not report one exact task ID: ${JSON.stringify(output.trim())}`);
  return ids[0];
}

function beadsTaskType(value: unknown): string {
  const raw = String(value ?? "task").toLowerCase();
  const aliases: Record<string, string> = { story: "feature", milestone: "task", epic: "task", decision: "task", "merge-request": "task", molecule: "task", gate: "task", convoy: "task" };
  const mapped = aliases[raw] ?? raw;
  return ["bug", "feature", "enhancement", "task", "chore", "docs", "spike"].includes(mapped) ? mapped : "task";
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
  const revision = cleanGitRevision(runner, storeDir);
  const files = walkTaskFiles(storeDir).map((path) => {
    const markdown = readFileSync(path);
    return {
      path,
      taskId: backlogTaskId(markdown.toString("utf8"), path),
      entityKind: backlogEntityKind(storeDir, path),
      classification: backlogClassification(storeDir, path),
    };
  });
  const archived = archivedBacklogViews(
    runner, storeDir, projectRoot, revision,
    files.filter((item) => item.classification === "archived").map(({ taskId, path, entityKind }) => ({ taskId, path, entityKind })),
  );
  try {
    return new Map(files.map((item) => [
      item.taskId,
      item.classification === "archived"
        ? archived.get(item.taskId)!
        : item.entityKind === "draft"
          ? backlogDraftView(runner, projectRoot, item.taskId, relative(projectRoot, item.path).replace(/\\/g, "/"))
          : backlogTaskView(runner, projectRoot, item.taskId),
    ]));
  } catch (error) {
    throw new Error(`Backlog destination ${phase} read failed (store=${existsSync(storeDir)}, config=${existsSync(join(storeDir, "config.yml"))}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

function existingBacklogMigrationMappings(runner: CommandRunner, projectRoot: string, storeDir: string, source: BeadsSnapshot): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const [id, view] of backlogDestinationViews(runner, projectRoot, storeDir, "reuse")) {
    const comments = Array.isArray(view.task.comments) ? view.task.comments : [];
    const marker = comments.map((comment: JsonObject) => String(comment.text ?? comment.content ?? comment.body ?? "")).find((text: string) => text.startsWith(`${SOURCE_MARKER} mapping `));
    const receipt = comments.map((comment: JsonObject) => String(comment.text ?? comment.content ?? comment.body ?? "")).some((text: string) => text.includes(RECEIPT_MARKER));
    if (receipt) {
      const notes = String(view.task.implementationNotes ?? "");
      const receiptJson = /^```json\n([\s\S]+)\n```$/.exec(notes)?.[1];
      if (!receiptJson) throw new Error(`Backlog destination receipt ${id} has no exact receipt payload`);
      const exact = asObject(parseJson(receiptJson, `Backlog migration receipt ${id}`), `Backlog migration receipt ${id}`);
      if (exact.sourceProvider !== "beads" || exact.targetProvider !== "backlog"
          || exact.sourceRevision !== source.revision || exact.sourceDigest !== source.digest) {
        throw new Error(`Backlog destination receipt ${id} belongs to a different source snapshot`);
      }
      continue;
    }
    if (!marker) throw new Error(`Backlog destination contains foreign task ${id}; use a clean destination or the exact same migration destination`);
    const parsed = asObject(parseJson(marker.slice(`${SOURCE_MARKER} mapping `.length), `Backlog migration marker ${id}`), `Backlog migration marker ${id}`);
    if (parsed.sourceRevision !== source.revision || parsed.sourceDigest !== source.digest
        || !source.tasks.some((task) => task.sourceTaskId === parsed.sourceTaskId)) throw new Error(`Backlog destination task ${id} belongs to a different source snapshot`);
    const sourceTaskId = String(parsed.sourceTaskId);
    if (mapping[sourceTaskId]) throw new Error(`Backlog destination repeats source task ${sourceTaskId}`);
    mapping[sourceTaskId] = id;
  }
  return mapping;
}

function nativeBacklogComment(runner: CommandRunner, projectRoot: string, taskId: string, text: string, author: string): void {
  runRequired(runner, "backlog", ["task", "edit", "--comment", text, "--comment-author", author, "--plain", "--", taskId], projectRoot, `append Backlog provenance to ${taskId}`);
}

function createBacklogTaskFromBeads(pkg: BeadsTaskPackage, source: BeadsSnapshot, projectRoot: string, runner: CommandRunner,
  mapping: Record<string, string>, semanticPlacement: string): string {
  const row = pkg.nativeView;
  const parentSource = typeof row.parent === "string" ? row.parent : typeof pkg.exportRow.parent === "string" ? pkg.exportRow.parent : null;
  const numericPriority = Math.min(4, Math.max(0, Number(row.priority ?? 2)));
  const backlogPriority = numericPriority <= 1 ? "High" : numericPriority >= 3 ? "Low" : "Medium";
  const args = ["task", "create", String(row.title ?? pkg.sourceTaskId), "--status", "In Progress", "--type", beadsTaskType(row.issue_type ?? row.type),
    "--priority", backlogPriority, "--no-dod-defaults"];
  if (typeof row.description === "string") args.push("--description", row.description);
  if (typeof row.design === "string" && row.design) args.push("--plan", row.design);
  if (typeof row.notes === "string" && row.notes) args.push("--notes", row.notes);
  if (typeof row.acceptance_criteria === "string" && row.acceptance_criteria) args.push("--ac", row.acceptance_criteria);
  if (Array.isArray(row.labels) && row.labels.length) args.push("--labels", row.labels.map(String).join(","));
  if (typeof row.assignee === "string" && row.assignee) args.push("--assignee", row.assignee);
  if (parentSource) {
    const parent = mapping[parentSource];
    if (!parent) throw new Error(`Beads task ${pkg.sourceTaskId} parent ${parentSource} has no destination mapping`);
    args.push("--parent", parent);
  }
  args.push("--plain");
  const created = runRequired(runner, "backlog", args, projectRoot, `create Backlog task for ${pkg.sourceTaskId}`);
  const id = backlogCreateId(created.stdout);
  nativeBacklogComment(runner, projectRoot, id, `${SOURCE_MARKER} mapping ${JSON.stringify({ sourceTaskId: pkg.sourceTaskId, sourceRevision: source.revision, sourceDigest: source.digest })}`, "prime-claw-migration");
  for (const comment of chunkComment(backlogSourcePackage(pkg, source, semanticPlacement))) nativeBacklogComment(runner, projectRoot, id, comment, "prime-claw-migration");
  const nativeComments = Array.isArray(row.comments) ? row.comments : Array.isArray(pkg.exportRow.comments) ? pkg.exportRow.comments : [];
  for (const comment of nativeComments) {
    const body = String(comment.text ?? comment.body ?? comment.content ?? "");
    const author = String(comment.author ?? comment.created_by ?? "unknown");
    const at = String(comment.created_at ?? comment.createdAt ?? "unknown-time");
    nativeBacklogComment(runner, projectRoot, id, `[source Beads comment at ${at}]\n${body}`, author);
  }
  return id;
}

function dependencyIds(pkg: BeadsTaskPackage): string[] {
  const dependencies = Array.isArray(pkg.nativeView.dependencies) ? pkg.nativeView.dependencies : Array.isArray(pkg.exportRow.dependencies) ? pkg.exportRow.dependencies : [];
  return dependencies.map((dep: any) => typeof dep === "string" ? dep : String(dep.depends_on_id ?? dep.id ?? dep.issue_id ?? "")).filter(Boolean);
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

function ensureBacklogReceiptPlaceholder(runner: CommandRunner, projectRoot: string, storeDir: string, source: BeadsSnapshot): string {
  const clean = runRequired(runner, "git", ["-C", storeDir, "status", "--porcelain=v1"], storeDir, "inspect Backlog receipt placeholder state").stdout === "";
  const views = clean
    ? backlogDestinationViews(runner, projectRoot, storeDir, "receipt-placeholder")
    : new Map(walkTaskFiles(storeDir).map((path) => {
        const id = backlogTaskId(readFileSync(path, "utf8"), path);
        return [id, backlogTaskView(runner, projectRoot, id)] as const;
      }));
  for (const [id, view] of views) {
    const comments = Array.isArray(view.task.comments) ? view.task.comments : [];
    if (comments.some((comment: JsonObject) => String(comment.text ?? comment.body ?? comment.content ?? "").includes(RECEIPT_MARKER))) return id;
  }
  const pending = { marker: RECEIPT_MARKER, pending: true, sourceProvider: "beads", targetProvider: "backlog", sourceRevision: source.revision, sourceDigest: source.digest };
  const created = runRequired(runner, "backlog", ["task", "create", RECEIPT_TITLE, "--status", "In Progress", "--type", "task", "--notes", `\`\`\`json\n${JSON.stringify(pending, null, 2)}\n\`\`\``, "--no-dod-defaults", "--plain"], projectRoot, "reserve Backlog migration receipt identity");
  const id = backlogCreateId(created.stdout);
  nativeBacklogComment(runner, projectRoot, id, `${RECEIPT_MARKER}\nPending complete destination proof for ${source.revision}; this task becomes the sole final receipt.`, "prime-claw-migration");
  return id;
}

function createOrUpdateBacklogReceipt(runner: CommandRunner, projectRoot: string, storeDir: string,
  receipt: Omit<ProviderMigrationReceipt, "destinationReceiptRevision">): string {
  for (const [id, view] of backlogDestinationViews(runner, projectRoot, storeDir, "receipt")) {
    const comments = Array.isArray(view.task.comments) ? view.task.comments : [];
    if (comments.some((comment: JsonObject) => String(comment.text ?? comment.body ?? comment.content ?? "").includes(RECEIPT_MARKER))) {
      runRequired(runner, "backlog", ["task", "edit", "--notes", `\`\`\`json\n${JSON.stringify(receipt, null, 2)}\n\`\`\``, "--status", "Done", "--final-summary", "Verified selected-provider migration receipt", "--plain", "--", id], projectRoot, "update Backlog migration receipt");
      return id;
    }
  }
  const created = runRequired(runner, "backlog", ["task", "create", RECEIPT_TITLE, "--status", "In Progress", "--type", "task", "--notes", `\`\`\`json\n${JSON.stringify(receipt, null, 2)}\n\`\`\``, "--no-dod-defaults", "--plain"], projectRoot, "create Backlog migration receipt");
  const id = backlogCreateId(created.stdout);
  nativeBacklogComment(runner, projectRoot, id, `${RECEIPT_MARKER}\nThe containing task-history Git commit is the destination receipt revision.`, "prime-claw-migration");
  runRequired(runner, "backlog", ["task", "edit", "--status", "Done", "--final-summary", "Verified selected-provider migration receipt", "--plain", "--", id], projectRoot, "complete Backlog migration receipt content");
  return id;
}

function migratedBacklogPackage(view: JsonObject): string {
  const comments = Array.isArray(view.task.comments) ? view.task.comments : [];
  const parts: string[] = comments.map((comment: JsonObject) => String(comment.text ?? comment.body ?? comment.content ?? ""))
    .filter((text: string) => text.startsWith(`${SOURCE_MARKER} part=`));
  if (!parts.length) throw new Error(`Backlog destination task ${String(view.task.id)} has no migration provenance chunks`);
  const parsed: Array<{ index: number; count: number; value: string }> = parts.map((text: string) => {
    const match = new RegExp(`^${SOURCE_MARKER} part=(\\d+)/(\\d+)\\n([A-Za-z0-9+/=]+)$`).exec(text);
    if (!match) throw new Error(`Backlog destination task ${String(view.task.id)} has malformed migration provenance`);
    return { index: Number(match[1]), count: Number(match[2]), value: match[3] };
  }).sort((a, b) => a.index - b.index);
  if (parsed.some((part) => part.count !== parsed.length) || parsed.some((part, index) => part.index !== index + 1)) throw new Error(`Backlog destination task ${String(view.task.id)} has incomplete migration provenance`);
  return Buffer.from(parsed.map((part) => part.value).join(""), "base64").toString("utf8");
}

interface ExplicitBacklogMigrationWorkspace {
  storeDir: string;
  remoteName: string;
  remoteUrl: string;
  head: string;
}

function ignoreMigrationBacklogStore(projectRoot: string, runner: CommandRunner): void {
  const raw = runRequired(runner, "git", ["-C", projectRoot, "rev-parse", "--path-format=absolute", "--git-path", "info/exclude"], projectRoot, "resolve Git private exclude").stdout.trim();
  const exclude = isAbsolute(raw) ? raw : resolve(projectRoot, raw);
  const line = "/.backlog/";
  const existing = existsSync(exclude) ? readFileSync(exclude, "utf8") : "";
  if (!existing.split(/\r?\n/).includes(line)) appendFileSync(exclude, `${existing && !existing.endsWith("\n") ? "\n" : ""}${line}\n`);
  const ignored = runRequired(runner, "git", ["-C", projectRoot, "check-ignore", "-q", ".backlog/probe"], projectRoot, "prove private Backlog destination ignore");
  if (ignored.status !== 0) throw new Error("Backlog destination is not privately ignored by the code repository");
}

function prepareExplicitBacklogMigrationWorkspace(projectRoot: string, runner: CommandRunner): ExplicitBacklogMigrationWorkspace {
  const remote = gitRemoteForDolt(runner, projectRoot);
  const storeDir = join(projectRoot, ".backlog");
  if (existsSync(storeDir)) {
    const entry = lstatSync(storeDir);
    if (!entry.isDirectory() || entry.isSymbolicLink() || !existsSync(join(storeDir, ".git"))) {
      throw new Error("existing .backlog destination is not the exact reusable independent Git store");
    }
    const origin = runRequired(runner, "git", ["-C", storeDir, "remote", "get-url", "origin"], storeDir, "read Backlog destination remote").stdout.trim();
    if (origin !== remote.raw) throw new Error("existing .backlog destination uses a different remote; clean it up or retry the exact same destination");
  }
  ignoreMigrationBacklogStore(projectRoot, runner);
  if (!existsSync(storeDir)) {
    runRequired(runner, "git", ["init", "-q", "--initial-branch", "prime-claw/tasks", storeDir], projectRoot, "initialize independent Backlog destination");
    writeFileSync(join(storeDir, "TASKS.md"), "# Prime Claw task history\n\nThis disconnected branch carries the provider-native Backlog task store.\n");
    writeFileSync(join(storeDir, "config.yml"), initialTaskStoreConfig(basename(projectRoot)));
    mkdirSync(join(storeDir, "tasks"), { recursive: true });
    mkdirSync(join(storeDir, "completed"), { recursive: true });
    mkdirSync(join(storeDir, "archive", "tasks"), { recursive: true });
    runRequired(runner, "git", ["-C", storeDir, "add", "TASKS.md", "config.yml"], storeDir, "stage Backlog destination initialization");
    runRequired(runner, "git", ["-C", storeDir, "-c", "user.name=prime-claw", "-c", "user.email=prime-claw@localhost", "commit", "-m", "prime-claw: initialize task history"], storeDir, "commit Backlog destination initialization");
    runRequired(runner, "git", ["-C", storeDir, "remote", "add", "origin", remote.raw], storeDir, "configure Backlog destination remote");
    runRequired(runner, "git", ["-C", storeDir, "push", "-u", "origin", `HEAD:${TASK_HISTORY_REF}`], storeDir, "publish Backlog destination initialization");
  }
  checkBacklogCapabilities(projectRoot, runner);
  const head = runRequired(runner, "git", ["-C", storeDir, "rev-parse", "HEAD"], storeDir, "read Backlog destination revision").stdout.trim();
  if (!GIT_OID.test(head)) throw new Error("Backlog destination did not return an exact Git revision");
  assertPublishedGitRef(runner, storeDir, head, "origin", remote.raw, TASK_HISTORY_REF, "Backlog destination initialization publication");
  return { storeDir, remoteName: "origin", remoteUrl: remote.raw, head };
}

function prepareExplicitBacklogEpisodeWorkspace(worktree: string, runner: CommandRunner, remoteUrl: string, expectedHead: string): void {
  const storeDir = join(worktree, ".backlog");
  if (!existsSync(storeDir)) {
    runRequired(runner, "git", ["clone", "-q", "--branch", "prime-claw/tasks", "--single-branch", remoteUrl, storeDir], worktree, "clone migrated Backlog history into active Episode");
  } else {
    const entry = lstatSync(storeDir);
    if (!entry.isDirectory() || entry.isSymbolicLink() || !existsSync(join(storeDir, ".git"))) throw new Error(`active Episode ${worktree} has a foreign .backlog destination`);
    const origin = runRequired(runner, "git", ["-C", storeDir, "remote", "get-url", "origin"], storeDir, "read active Episode Backlog remote").stdout.trim();
    if (origin !== remoteUrl) throw new Error(`active Episode ${worktree} has a different Backlog destination remote`);
  }
  const statusBefore = runRequired(runner, "git", ["-C", storeDir, "status", "--porcelain=v1"], storeDir, "active Episode Backlog cleanliness").stdout;
  const branch = runRequired(runner, "git", ["-C", storeDir, "symbolic-ref", "--short", "HEAD"], storeDir, "active Episode Backlog branch").stdout.trim();
  if (statusBefore !== "" || branch !== "prime-claw/tasks") throw new Error(`active Episode worktree ${worktree} has dirty or foreign Backlog destination state`);
  assertPublishedGitRef(runner, storeDir, expectedHead, "origin", remoteUrl, TASK_HISTORY_REF, "active Episode Backlog destination publication");
  runRequired(
    runner,
    "git",
    ["-C", storeDir, "fetch", "--no-tags", "origin", `${TASK_HISTORY_REF}:refs/remotes/origin/prime-claw/tasks`],
    storeDir,
    "refresh active Episode Backlog destination",
  );
  const remoteHead = runRequired(runner, "git", ["-C", storeDir, "rev-parse", "refs/remotes/origin/prime-claw/tasks"], storeDir, "active Episode Backlog remote revision").stdout.trim();
  const headBefore = runRequired(runner, "git", ["-C", storeDir, "rev-parse", "HEAD"], storeDir, "active Episode Backlog revision").stdout.trim();
  if (remoteHead !== expectedHead) throw new Error(`active Episode worktree ${worktree} fetched a different Backlog destination revision`);
  if (headBefore !== expectedHead) {
    const ancestor = runner.run("git", ["-C", storeDir, "merge-base", "--is-ancestor", headBefore, expectedHead], { cwd: storeDir, allowFailure: true });
    if (ancestor.status !== 0) throw new Error(`active Episode worktree ${worktree} Backlog destination cannot fast-forward to the migrated revision`);
    runRequired(runner, "git", ["-C", storeDir, "merge", "--ff-only", "refs/remotes/origin/prime-claw/tasks"], storeDir, "fast-forward active Episode Backlog destination");
  }
  const statusAfter = runRequired(runner, "git", ["-C", storeDir, "status", "--porcelain=v1"], storeDir, "active Episode Backlog final cleanliness").stdout;
  const headAfter = runRequired(runner, "git", ["-C", storeDir, "rev-parse", "HEAD"], storeDir, "active Episode Backlog final revision").stdout.trim();
  if (statusAfter !== "" || headAfter !== expectedHead) throw new Error(`active Episode worktree ${worktree} cannot bind the migrated Backlog revision`);
}

function migrateBeadsToBacklog(
  source: BeadsSnapshot,
  runner: CommandRunner,
  actor: string,
  timestamp: string,
  semanticPlacement: string,
  ownershipRows: Array<{ ownerSessionId: string; taskId: string; worktree: string }>,
): DestinationCandidate {
  const prepared = prepareExplicitBacklogMigrationWorkspace(source.projectRoot, runner);
  const storeDir = prepared.storeDir;
  const mapping = existingBacklogMigrationMappings(runner, source.projectRoot, storeDir, source);
  const reusedDestinationIds = new Set(Object.values(mapping));
  for (const pkg of topologicalBeadsPackages(source.tasks)) {
    if (!mapping[pkg.sourceTaskId]) mapping[pkg.sourceTaskId] = createBacklogTaskFromBeads(pkg, source, source.projectRoot, runner, mapping, semanticPlacement);
  }
  ensureBacklogReceiptPlaceholder(runner, source.projectRoot, storeDir, source);
  for (const pkg of source.tasks) {
    const id = mapping[pkg.sourceTaskId];
    if (reusedDestinationIds.has(id)) continue;
    const deps = dependencyIds(pkg).map((sourceId) => mapping[sourceId] ?? sourceId);
    if (deps.length) runRequired(runner, "backlog", ["task", "edit", "--depends-on", deps.join(","), "--plain", "--", id], source.projectRoot, `migrate dependencies for ${pkg.sourceTaskId}`);
    if (pkg.classification === "archived") {
      runRequired(runner, "backlog", ["task", "archive", id], source.projectRoot, `archive abandoned Backlog task ${id}`);
    } else {
      const status = statusFromBeads(pkg.nativeView.status ?? pkg.exportRow.status);
      runRequired(runner, "backlog", ["task", "edit", "--status", status, "--plain", "--", id], source.projectRoot, `migrate status for ${pkg.sourceTaskId}`);
      if (pkg.classification === "closed") runRequired(runner, "backlog", ["task", "complete", id], source.projectRoot, `complete migrated Backlog task ${id}`);
    }
  }
  const dataRevision = commitBacklogDestination(runner, prepared, "prime-claw: migrate Beads task history");
  const dataViews = backlogDestinationViews(runner, source.projectRoot, storeDir, "data");
  if (dataViews.size !== source.counts.total + 1) throw new Error(`Backlog destination count mismatch: expected ${source.counts.total} migrated tasks plus one receipt, found ${dataViews.size}`);
  const destinationTasks: DestinationTask[] = source.tasks.map((pkg) => {
    const id = mapping[pkg.sourceTaskId];
    const view = dataViews.get(id);
    if (!view) throw new Error(`Backlog destination task ${id} is not exactly readable`);
    const packageText = migratedBacklogPackage(view);
    if (canonical(parseJson(packageText, `Backlog migration package ${id}`)) !== canonical(parseJson(backlogSourcePackage(pkg, source, semanticPlacement), `source migration package ${pkg.sourceTaskId}`))) {
      throw new Error(`Backlog destination did not preserve the exact source package for ${pkg.sourceTaskId}`);
    }
    const sourceRow = pkg.nativeView;
    const expectedPriorityNumber = Math.min(4, Math.max(0, Number(sourceRow.priority ?? 2)));
    const expectedPriority = expectedPriorityNumber <= 1 ? "high" : expectedPriorityNumber >= 3 ? "low" : "medium";
    const projectionPairs: Array<[string, unknown, unknown]> = [
      ["title", view.task.title, sourceRow.title],
      ["description", view.task.description ?? "", sourceRow.description ?? ""],
      ["plan", view.task.implementationPlan ?? "", sourceRow.design ?? ""],
      ["notes", view.task.implementationNotes ?? "", sourceRow.notes ?? ""],
      ["type", String(view.task.type ?? "").toLowerCase(), beadsTaskType(sourceRow.issue_type ?? sourceRow.type)],
      ["priority", String(view.task.priority ?? "").toLowerCase(), expectedPriority],
      ["labels", Array.isArray(view.task.labels) ? view.task.labels.map(String).sort() : [], Array.isArray(sourceRow.labels) ? sourceRow.labels.map(String).sort() : []],
    ];
    for (const [field, actual, expected] of projectionPairs) {
      if (canonical(actual) !== canonical(expected)) throw new Error(`Backlog destination ${field} projection mismatch for ${pkg.sourceTaskId}: expected ${canonical(expected)}, observed ${canonical(actual)}`);
    }
    if (pkg.classification !== "archived") {
      const expectedStatus = statusFromBeads(sourceRow.status ?? pkg.exportRow.status);
      if (view.task.status !== expectedStatus) throw new Error(`Backlog destination status projection mismatch for ${pkg.sourceTaskId}`);
    }
    const sourceParent = typeof pkg.nativeView.parent === "string" ? pkg.nativeView.parent : typeof pkg.exportRow.parent === "string" ? pkg.exportRow.parent : "";
    const expectedParent = sourceParent ? mapping[sourceParent] ?? sourceParent : "";
    const actualParent = String(view.task.parentTaskId ?? "");
    if (expectedParent !== actualParent) throw new Error(`Backlog destination parent mapping mismatch for ${pkg.sourceTaskId}`);
    const expectedDependencies = dependencyIds(pkg).map((sourceId) => mapping[sourceId] ?? sourceId).sort();
    assertSameIds(relationshipIds(view.task.dependencies, id), expectedDependencies, `Backlog destination dependencies for ${pkg.sourceTaskId}`);
    return { sourceTaskId: pkg.sourceTaskId, destinationTaskId: id, taskPath: String(view.task.path), taskEvidence: view };
  });
  const destinationDataDigest = sha256(canonical(destinationTasks.map((task) => task.taskEvidence)));
  const transitions = ownershipRows.map((row) => ({ ownerSessionId: row.ownerSessionId, sourceTaskId: row.taskId, destinationTaskId: mapping[row.taskId] }));
  if (transitions.some((row) => !row.destinationTaskId)) throw new Error("active ownership has no Backlog destination mapping");
  const receiptBase = migrationReceiptBase(source, "backlog", dataRevision, destinationDataDigest,
    destinationTasks.map(({ sourceTaskId, destinationTaskId }) => ({ sourceTaskId, destinationTaskId })), transitions, actor, timestamp, semanticPlacement);
  const receiptTaskId = createOrUpdateBacklogReceipt(runner, source.projectRoot, storeDir, receiptBase);
  const receiptRevision = commitBacklogDestination(runner, prepared, "prime-claw: record task-provider migration receipt");
  const refresh = () => {
    const exact = cleanGitRevision(runner, storeDir);
    if (exact !== receiptRevision) throw new Error("Backlog destination revision changed after receipt publication");
    assertPublishedGitRef(runner, storeDir, receiptRevision, prepared.remoteName, prepared.remoteUrl, TASK_HISTORY_REF, "Backlog destination receipt publication");
    const views = backlogDestinationViews(runner, source.projectRoot, storeDir, "refresh");
    if (views.size !== source.counts.total + 1) throw new Error(`Backlog destination receipt count changed: expected ${source.counts.total + 1}, found ${views.size}`);
    const refreshed = destinationTasks.map((task) => {
      const taskEvidence = views.get(task.destinationTaskId);
      if (!taskEvidence) throw new Error(`Backlog destination task ${task.destinationTaskId} is not exactly readable after receipt`);
      return { ...task, taskEvidence };
    });
    return { revision: exact, digest: sha256(canonical(refreshed.map((task) => task.taskEvidence))), tasks: refreshed, receiptTaskId };
  };
  const final = refresh();
  return {
    provider: "backlog", revision: final.revision, digest: final.digest, receiptBase, receiptTaskId, tasks: final.tasks,
    refreshAfterReceipt: refresh,
    prepareActiveWorktree(worktree: string) {
      prepareExplicitBacklogEpisodeWorkspace(worktree, runner, prepared.remoteUrl, receiptRevision);
    },
  };
}

function verifyExactRetryDestination(source: SourceSnapshot, target: TaskProviderId, runner: CommandRunner): void {
  if (source.provider === "backlog" && target === "beads") {
    const prepared = prepareExplicitBeadsWorkspaceTransport(source.projectRoot, runner);
    if (prepared.status !== "ready") throw new Error(`existing Beads retry destination is not exactly reusable: ${prepared.detail}`);
    const rows = beadsExportRows(runner, source.projectRoot);
    const mapping = ensureBeadsDestinationReusable(rows, source);
    const receipts = rows.filter((row) => beadsMigrationMetadata(row)?.marker === RECEIPT_MARKER);
    if (receipts.length > 1 || rows.length !== Object.keys(mapping).length + receipts.length
        || (Object.keys(mapping).length === 0 && receipts.length === 0)) {
      throw new Error("existing Beads retry destination cannot be proven as the exact same destination for this source snapshot");
    }
    return;
  }
  if (source.provider === "beads" && target === "backlog") {
    const storeDir = join(source.projectRoot, ".backlog");
    if (!existsSync(storeDir) || !lstatSync(storeDir).isDirectory() || lstatSync(storeDir).isSymbolicLink()) {
      throw new Error("existing Backlog retry destination is absent or unsafe");
    }
    const revision = cleanGitRevision(runner, storeDir);
    const remote = gitRemoteForDolt(runner, source.projectRoot);
    assertPublishedGitRef(runner, storeDir, revision, "origin", remote.raw, TASK_HISTORY_REF, "existing Backlog retry destination publication");
    const mapping = existingBacklogMigrationMappings(runner, source.projectRoot, storeDir, source);
    const views = backlogDestinationViews(runner, source.projectRoot, storeDir, "retry admission");
    const receiptCount = [...views.values()].filter((view) => {
      const comments = Array.isArray(view.task.comments) ? view.task.comments : [];
      return comments.some((comment: JsonObject) => String(comment.text ?? comment.content ?? comment.body ?? "").includes(RECEIPT_MARKER));
    }).length;
    if (receiptCount > 1 || views.size !== Object.keys(mapping).length + receiptCount
        || (Object.keys(mapping).length === 0 && receiptCount === 0)) {
      throw new Error("existing Backlog retry destination cannot be proven as the exact same destination for this source snapshot");
    }
    return;
  }
  throw new Error("same-destination retry requires different supported source and target providers");
}

function captureConfirmedSource(
  projectRoot: string,
  targetProvider: TaskProviderId,
  expectedSourceRevision: string,
  runner: CommandRunner,
): SourceSnapshot {
  const detection = detectTaskProvider(projectRoot, runner);
  if (detection.kind === "selected") {
    return captureProviderEvidence(projectRoot, detection.evidence.provider, detection.evidence, runner);
  }
  if (detection.kind !== "blocked" || detection.code !== "dual-providers") {
    if (detection.kind === "blocked") throw new Error(`provider authority blocked (${detection.code}): ${detection.detail}; ${detection.remediation}`);
    throw new Error("provider migration requires one selected live source provider");
  }
  const sourceProvider: TaskProviderId = targetProvider === "beads" ? "backlog" : "beads";
  const explicit = detectExplicitTaskProvider(projectRoot, sourceProvider, runner);
  if (explicit.kind !== "selected" || explicit.evidence.provider !== sourceProvider) {
    throw new Error(`same-destination retry cannot prove the exact ${sourceProvider} source store`);
  }
  const source = captureProviderEvidence(projectRoot, sourceProvider, explicit.evidence, runner, true);
  if (source.revision !== expectedSourceRevision) {
    throw new Error(`same-destination retry source revision ${source.revision} does not equal confirmed ${expectedSourceRevision}`);
  }
  verifyExactRetryDestination(source, targetProvider, runner);
  return source;
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

function deleteBacklogSource(snapshot: BacklogSnapshot): void {
  verifyBacklogDeletionIdentity(snapshot);
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
  runRequired(runner, "bd", ["dolt", "stop"], snapshot.projectRoot, "stop Beads source server before deletion");
  rmSync(store, { recursive: true, force: false });
}

function independentActiveBacklogStores(source: SourceSnapshot, owners: ActiveMigrationOwnership[]): string[] {
  if (source.provider !== "backlog" || source.repositoryRoot === source.projectRoot || !source.evidence.storeDir) return [];
  const storeRelative = relative(source.projectRoot, source.evidence.storeDir);
  return owners.map((owner) => resolve(owner.worktree, storeRelative));
}

function defaultDeleteSource(snapshot: SourceSnapshot, runner: CommandRunner): void {
  if (snapshot.provider === "backlog") deleteBacklogSource(snapshot);
  else deleteBeadsSource(snapshot, runner);
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

function publishProviderCutoverCodeState(snapshot: SourceSnapshot, runner: CommandRunner): string {
  const projectRoot = snapshot.projectRoot;
  const allowed = new Set<string>([".prime-claw/ownership.json"]);
  if (snapshot.provider === "backlog") {
    for (const path of activateBeadsCodeMetadata(projectRoot, runner)) allowed.add(path);
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
    const modified = [...changed, ...untracked];
    const stagePaths = [...allowed].filter((base) => modified.some((path) => path === base || path.startsWith(`${base}/`)));
    runRequired(runner, "git", ["-C", projectRoot, "add", "-A", "--", ...stagePaths], projectRoot, "stage provider cutover state");
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
  if (target === "backlog") checkBacklogCapabilities(projectRoot, runner);
  else checkBeadsCapabilities(projectRoot, runner);
}

export async function migrateTaskProvider(options: ProviderMigrationOptions): Promise<ProviderMigrationResult> {
  const runner = options.runner ?? new ProcessCommandRunner();
  let source: SourceSnapshot | undefined;
  let ownershipSwitch: ActiveTaskProviderOwnershipSwitchResult | undefined;
  try {
    if (!options.confirmedSwitch) return blocked("confirmation-required", "provider switch requires explicit operator confirmation", "inspect the migration, present the exact source revision and semantic placement, then call switch-confirm with confirmedSwitch=true", { targetProvider: options.targetProvider });
    if (!options.actor.trim()) return blocked("actor-required", "provider switch receipt requires an exact actor", "supply the operator-approved actor identifier", { targetProvider: options.targetProvider });
    if (!options.semanticPlacement.trim()) return blocked("placement-required", "provider switch requires managed semantic-placement prose for non-equivalent fields", "inspect exact source fields and supply concise placement prose without omitting any value", { targetProvider: options.targetProvider });
    const project = resolveNearestProjectRoot(options.cwd, process.env.HOME ?? "", runner);
    if (project.kind === "linked-worktree") return blocked("primary-required", "provider migration must run from the canonical primary checkout", "rerun from the canonical primary Conversation", { targetProvider: options.targetProvider });
    const codeHead = cleanGitRevision(runner, project.root);
    if (!directPublishedGitHead(runner, project.root, codeHead)) throw new Error("provider migration requires an exact directly published code head");
    source = captureConfirmedSource(project.root, options.targetProvider, options.expectedSourceRevision, runner);
    if (source.provider === options.targetProvider) return blocked("same-provider", `the selected provider is already ${source.provider}`, "choose the other supported provider", { sourceProvider: source.provider, targetProvider: options.targetProvider, sourceRevision: source.revision });
    if (source.revision !== options.expectedSourceRevision) return blocked("source-revision-changed", `confirmed source revision ${options.expectedSourceRevision} does not equal current exact ${source.revision}`, "quiesce mutations, request a fresh inspection, and confirm that exact revision", { sourceProvider: source.provider, targetProvider: options.targetProvider, sourceRevision: source.revision });
    const beadsPriorities = source.provider === "backlog" && options.targetProvider === "beads"
      ? validateBeadsPrioritySelection(source, options.beadsPriorityPlacements)
      : {};
    if (source.provider !== "backlog" && (options.beadsPriorityPlacements?.length ?? 0) > 0) {
      throw new Error("beadsPriorityPlacements applies only to Backlog-to-Beads migration");
    }
    const ownershipRows = activeOwnership(project.root, source.provider, runner);
    for (const owner of ownershipRows) verifyActiveSourceWorkspace(source, owner, runner);
    const sourceIds = new Set(source.tasks.map((task) => task.sourceTaskId));
    const missing = ownershipRows.filter((row) => !sourceIds.has(row.taskId));
    if (missing.length) throw new Error(`active ownership references source tasks absent from the complete snapshot: ${missing.map((row) => row.taskId).join(", ")}`);
    await proveActiveRuntimeContinuity(ownershipRows, options.verifyActiveRuntime);
    const timestamp = (options.now ?? (() => new Date().toISOString()))();
    if (Number.isNaN(Date.parse(timestamp))) throw new Error("migration timestamp is not RFC3339");
    const candidate = source.provider === "backlog"
      ? migrateBacklogToBeads(source, runner, options.actor.trim(), timestamp, options.semanticPlacement.trim(), beadsPriorities, ownershipRows)
      : migrateBeadsToBacklog(source, runner, options.actor.trim(), timestamp, options.semanticPlacement.trim(), ownershipRows);
    for (const owner of ownershipRows) candidate.prepareActiveWorktree(owner.worktree);
    const sourceAfterMigration = captureSameSource(source, runner);
    exactSnapshotUnchanged(source, sourceAfterMigration);
    const refreshed = candidate.refreshAfterReceipt();
    if (refreshed.revision !== candidate.revision || refreshed.digest !== candidate.digest) throw new Error("destination changed after receipt verification");
    const codeBeforeOwnership = cleanGitRevision(runner, project.root);
    if (codeBeforeOwnership !== codeHead) throw new Error("code repository changed during provider migration proof");
    for (const owner of ownershipRows) {
      verifyActiveCodeIdentity(project.root, owner, runner);
      verifyActiveSourceWorkspace(source, owner, runner);
    }
    const runtimeProofs = await proveActiveRuntimeContinuity(ownershipRows, options.verifyActiveRuntime);
    const destinationAtSwitch = candidate.refreshAfterReceipt();
    if (destinationAtSwitch.revision !== candidate.revision || destinationAtSwitch.digest !== candidate.digest) throw new Error("destination changed at ownership cutover");
    const sourceAtSwitch = captureSameSource(source, runner);
    exactSnapshotUnchanged(source, sourceAtSwitch);
    for (const owner of ownershipRows) {
      verifyActiveCodeIdentity(project.root, owner, runner);
      verifyActiveSourceWorkspace(source, owner, runner);
    }
    const destinations = ownershipDestinations(candidate);
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
      const postSwitchProofs = await proveActiveRuntimeContinuity(switchedRows, options.verifyActiveRuntime);
      for (const row of switchedRows) {
        const proof = postSwitchProofs[row.ownerSessionId];
        if (proof.expectedPreviousEpisodeActiveSessionId !== row.record.episodeActiveSessionId
            || proof.verifiedCurrentEpisodeActiveSessionId !== row.record.episodeActiveSessionId) {
          throw new Error(`active runtime route changed after ownership switch for ${row.ownerSessionId}`);
        }
      }
      withCurrentTaskProviderOwnershipSwitch(project.root, ownershipSwitch, () => {
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
    publishProviderCutoverCodeState(source, runner);
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
    return { status: "completed", receipt, receiptTaskId: candidate.receiptTaskId, sourceAbsent: true, selectedProvider: candidate.provider };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const sourcePath = source?.evidence.storeDir ?? "the exact inspected source store";
    const destinationPath = source
      ? join(source.projectRoot, options.targetProvider === "beads" ? ".beads" : ".backlog")
      : `the existing ${options.targetProvider} destination`;
    return blocked(
      ownershipSwitch ? "cutover-incomplete" : "pre-cutover-failed",
      message,
      ownershipSwitch
        ? `stop all task mutation and recover the exact source ${sourcePath}, destination ${destinationPath}, and ownership evidence; do not create another destination`
        : `the source remains authoritative at ${sourcePath}; preserve it, inspect the exact native error, and either clean only the existing destination ${destinationPath} or retry only that same destination after the stated condition is satisfied`,
      { sourceProvider: source?.provider, targetProvider: options.targetProvider, sourceRevision: source?.revision },
    );
  }
}
