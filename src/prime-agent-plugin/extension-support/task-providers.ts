/**
 * Selectable task-provider discovery and capability gates.
 *
 * Prime Claw supports exactly one live task provider per repository: Backlog.md
 * or Beads. The live stores themselves select authority; there is no
 * provider-selection file or shadow record. This module is the narrow
 * deterministic seam for that discovery: it classifies exact native store
 * evidence and capability-checks the pinned managed executables. Semantic
 * judgment stays in managed instructions; this code only reports exact
 * evidence and refuses ambiguity with exact remediation.
 *
 * Discovery preserves Backlog's native configuration behavior: a root
 * `backlog.config.yml` takes precedence, otherwise `backlog/config.yml` (or
 * `.yaml`) and `.backlog/config.yml` (or `.yaml`) are valid, and a root
 * configuration may select a custom directory. Only config-bearing evidence
 * selects a provider; exports, archives, and stray directories are not live
 * evidence. Beads evidence is a `.beads/` store with a coherent Dolt
 * `metadata.json` and `config.yaml`; `.beads/issues.jsonl` is export data and
 * never live authority.
 */

import { readFileSync, statSync } from "node:fs";
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import {
  type CommandRunner,
  ProcessCommandRunner,
  resolveNearestProjectRoot,
} from "./project-initialization.ts";
import { resolveBacklogTask } from "./reviewed-plan-support.ts";

/** The exact ordered lifecycle both providers map onto. */
export const CANONICAL_LIFECYCLE_STATUSES = [
  "In Design",
  "In Planning",
  "In Progress",
  "Blocked",
  "Ready for Merge",
  "Done",
] as const;

export type CanonicalLifecycleStatus = (typeof CANONICAL_LIFECYCLE_STATUSES)[number];

export type TaskProviderId = "backlog" | "beads";

/**
 * The exact Beads status mapping. Custom statuses carry their behavior
 * category because `bd ready` readiness is category-aware: only `active`
 * statuses are ready, `wip` statuses are visible but not ready, and `done`
 * closes the lifecycle.
 */
export const BEADS_STATUS_MAP: Record<CanonicalLifecycleStatus, { name: string; category: "active" | "wip" | "done"; custom: boolean }> = {
  "In Design": { name: "in_design", category: "active", custom: true },
  "In Planning": { name: "in_planning", category: "active", custom: true },
  "In Progress": { name: "in_progress", category: "wip", custom: false },
  "Blocked": { name: "blocked", category: "wip", custom: false },
  "Ready for Merge": { name: "ready_for_merge", category: "wip", custom: true },
  "Done": { name: "done", category: "done", custom: true },
};

export interface BacklogProviderEvidence {
  provider: "backlog";
  /** Absolute path of the configuration that establishes the store. */
  configPath: string;
  configSource: "root" | "folder";
  /**
   * Absolute path of the store directory, or null when a valid root
   * configuration governs a store directory that has not materialized yet.
   */
  storeDir: string | null;
  layout: "backlog" | ".backlog" | "custom" | null;
}

export interface BeadsProviderEvidence {
  provider: "beads";
  /** Absolute path of the `.beads/` store directory. */
  storeDir: string;
  metadataPath: string;
  configPath: string;
  /** The store's declared Dolt mode, exactly as recorded (embedded, server, ...). */
  doltMode: string | null;
  doltDatabase: string;
}

export type TaskProviderEvidence = BacklogProviderEvidence | BeadsProviderEvidence;

export type TaskProviderDetection =
  | { kind: "none"; projectRoot: string }
  | { kind: "selected"; projectRoot: string; evidence: TaskProviderEvidence }
  | {
      kind: "blocked";
      projectRoot: string;
      code: "dual-providers" | "malformed-evidence";
      detail: string;
      remediation: string;
    };

const BACKLOG_ROOT_CONFIG = "backlog.config.yml";
const BACKLOG_FOLDER_CONFIGS = ["config.yml", "config.yaml"] as const;
const BACKLOG_BUILT_IN_DIRS = ["backlog", ".backlog"] as const;
const BEADS_DIR = ".beads";

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function containedBy(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child);
  return pathFromParent !== ""
    && pathFromParent !== ".."
    && !pathFromParent.startsWith(`..${sep}`)
    && !isAbsolute(pathFromParent);
}

interface BacklogConfigMetadata {
  projectName: string | null;
  backlogDirectory: string | null;
  backlogDirectoryInvalid: boolean;
}

/** Mirrors upstream `normalizeProjectBacklogDirectory` exactly. */
function normalizeBacklogDirectory(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (/^(?:[a-zA-Z]:)?[\\/]/.test(trimmed)) return null;
  const normalized = normalize(trimmed).replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized || normalized === ".") return null;
  if (normalized === ".." || normalized.startsWith("../")) return null;
  return normalized;
}

/** Mirrors upstream `parseBacklogConfigMetadata` line semantics exactly. */
function parseBacklogConfigMetadata(content: string): BacklogConfigMetadata {
  let projectName: string | null = null;
  let backlogDirectory: string | null = null;
  let backlogDirectoryInvalid = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim().replace(/^["']|["']$/g, "");
    if ((key === "project_name" || key === "projectName") && value) {
      projectName = value;
      continue;
    }
    if (key === "backlog_directory" || key === "backlogDirectory") {
      const normalizedDirectory = normalizeBacklogDirectory(value);
      if (normalizedDirectory) backlogDirectory = normalizedDirectory;
      else if (value) backlogDirectoryInvalid = true;
    }
  }
  return { projectName, backlogDirectory, backlogDirectoryInvalid };
}

function folderConfigPath(backlogPath: string): string | null {
  for (const name of BACKLOG_FOLDER_CONFIGS) {
    const candidate = join(backlogPath, name);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

type ScanResult =
  | { evidence: TaskProviderEvidence }
  | { blocked: { code: "malformed-evidence"; detail: string; remediation: string } }
  | null;

function scanBacklog(projectRoot: string): ScanResult {
  const rootConfigPath = join(projectRoot, BACKLOG_ROOT_CONFIG);
  if (isFile(rootConfigPath)) {
    let metadata: BacklogConfigMetadata;
    try {
      metadata = parseBacklogConfigMetadata(readFileSync(rootConfigPath, "utf8"));
    } catch (error) {
      return {
        blocked: {
          code: "malformed-evidence",
          detail: `root ${BACKLOG_ROOT_CONFIG} is unreadable: ${error instanceof Error ? error.message : String(error)}`,
          remediation: `Repair or remove ${BACKLOG_ROOT_CONFIG} so live provider evidence is unambiguous`,
        },
      };
    }
    if (!metadata.projectName) {
      return {
        blocked: {
          code: "malformed-evidence",
          detail: `root ${BACKLOG_ROOT_CONFIG} has no project_name`,
          remediation: `Add project_name to ${BACKLOG_ROOT_CONFIG} or remove the file; Prime Claw never guesses provider authority from partial configuration`,
        },
      };
    }
    if (metadata.backlogDirectoryInvalid) {
      return {
        blocked: {
          code: "malformed-evidence",
          detail: `root ${BACKLOG_ROOT_CONFIG} has an invalid backlog_directory (it must be a relative path inside the repository)`,
          remediation: `Point backlog_directory at a relative directory inside the repository or remove the key`,
        },
      };
    }
    if (metadata.backlogDirectory) {
      const storePath = resolve(projectRoot, metadata.backlogDirectory);
      if (!containedBy(projectRoot, storePath) || !isDirectory(storePath)) {
        return {
          blocked: {
            code: "malformed-evidence",
            detail: `root ${BACKLOG_ROOT_CONFIG} selects custom directory ${metadata.backlogDirectory} but it does not exist inside the repository`,
            remediation: `Create the configured store with the pinned backlog CLI, fix backlog_directory, or remove ${BACKLOG_ROOT_CONFIG}`,
          },
        };
      }
      return {
        evidence: {
          provider: "backlog",
          configPath: rootConfigPath,
          configSource: "root",
          storeDir: storePath,
          layout: "custom",
        },
      };
    }
    // Mirror upstream built-in selection: a built-in directory carrying
    // folder configuration wins over a bare built-in directory, and
    // `backlog/` then `.backlog/` breaks ties among each class.
    let firstBareDirName: (typeof BACKLOG_BUILT_IN_DIRS)[number] | null = null;
    for (const dirName of BACKLOG_BUILT_IN_DIRS) {
      const storePath = join(projectRoot, dirName);
      if (!isDirectory(storePath)) continue;
      if (folderConfigPath(storePath)) {
        return {
          evidence: {
            provider: "backlog",
            configPath: rootConfigPath,
            configSource: "root",
            storeDir: storePath,
            layout: dirName === ".backlog" ? ".backlog" : "backlog",
          },
        };
      }
      if (firstBareDirName === null) firstBareDirName = dirName;
    }
    if (firstBareDirName !== null) {
      return {
        evidence: {
          provider: "backlog",
          configPath: rootConfigPath,
          configSource: "root",
          storeDir: join(projectRoot, firstBareDirName),
          layout: firstBareDirName === ".backlog" ? ".backlog" : "backlog",
        },
      };
    }
    return {
      evidence: {
        provider: "backlog",
        configPath: rootConfigPath,
        configSource: "root",
        storeDir: null,
        layout: null,
      },
    };
  }

  // No root configuration: only a config-bearing built-in folder is live
  // evidence. A bare backlog/ or .backlog/ directory without configuration is
  // a stray directory, never live evidence.
  for (const dirName of BACKLOG_BUILT_IN_DIRS) {
    const storePath = join(projectRoot, dirName);
    if (!isDirectory(storePath)) continue;
    const configPath = folderConfigPath(storePath);
    if (configPath) {
      return {
        evidence: {
          provider: "backlog",
          configPath,
          configSource: "folder",
          storeDir: storePath,
          layout: dirName === ".backlog" ? ".backlog" : "backlog",
        },
      };
    }
  }
  return null;
}

function scanBeads(projectRoot: string, runner: CommandRunner): ScanResult {
  const beadsPath = join(projectRoot, BEADS_DIR);
  if (!isDirectory(beadsPath)) {
    try {
      if (!statSync(beadsPath)) return null;
    } catch {
      return null;
    }
    return {
      blocked: {
        code: "malformed-evidence",
        detail: `${BEADS_DIR} exists but is not a directory`,
        remediation: `Remove the stray ${BEADS_DIR} entry or restore a real Beads store`,
      },
    };
  }
  const configPath = join(beadsPath, "config.yaml");
  const metadataPath = join(beadsPath, "metadata.json");
  if (!isFile(configPath) && !isFile(metadataPath)) {
    // Export residue (for example only issues.jsonl) or an empty directory is
    // not live evidence and not partial initialization: ignore it.
    return null;
  }
  if (!isFile(configPath) || !isFile(metadataPath)) {
    return {
      blocked: {
        code: "malformed-evidence",
        detail: `${BEADS_DIR} is missing ${!isFile(configPath) ? "config.yaml" : "metadata.json"}`,
        remediation: `Run the supported \`bd bootstrap\` recovery or remove the incomplete ${BEADS_DIR} store`,
      },
    };
  }
  let metadata: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(readFileSync(metadataPath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not a JSON object");
    metadata = parsed as Record<string, unknown>;
  } catch (error) {
    return {
      blocked: {
        code: "malformed-evidence",
        detail: `${BEADS_DIR}/metadata.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        remediation: `Run the supported \`bd bootstrap\` recovery or remove the incomplete ${BEADS_DIR} store`,
      },
    };
  }
  if (metadata.backend !== "dolt" || typeof metadata.dolt_database !== "string" || !metadata.dolt_database.trim()) {
    return {
      blocked: {
        code: "malformed-evidence",
        detail: `${BEADS_DIR}/metadata.json does not record a Dolt backend and database`,
        remediation: `Run the supported \`bd bootstrap\` recovery or remove the incomplete ${BEADS_DIR} store`,
      },
    };
  }
  // Probe the native effective no-db mode instead of parsing config.yaml
  // text: quoted or relocated values must resolve exactly the way `bd`
  // resolves them. A failed or ambiguous probe blocks because JSONL-only
  // authority cannot be ruled out.
  const noDbResult = runner.run("bd", ["config", "get", "no-db"], { cwd: projectRoot, allowFailure: true });
  const noDbValue = noDbResult.stdout.trim();
  if (noDbResult.status !== 0 || (noDbValue !== "true" && noDbValue !== "false")) {
    return {
      blocked: {
        code: "malformed-evidence",
        detail: `the effective Beads no-db mode is unreadable or uncertain: ${commandFailure("bd config get no-db", noDbResult)}`,
        remediation: `Repair the Beads installation so \`bd config get no-db\` reports true or false, or remove the ${BEADS_DIR} store`,
      },
    };
  }
  if (noDbValue === "true") {
    return {
      blocked: {
        code: "malformed-evidence",
        detail: `${BEADS_DIR} is configured for no-db JSONL-only mode; .beads/issues.jsonl is export data and never live authority`,
        remediation: `Reconfigure Beads onto its Dolt store (\`bd config set no-db false\` and bootstrap) or remove the unsupported store`,
      },
    };
  }
  return {
    evidence: {
      provider: "beads",
      storeDir: beadsPath,
      metadataPath,
      configPath,
      doltMode: typeof metadata.dolt_mode === "string" && metadata.dolt_mode.trim() ? metadata.dolt_mode : null,
      doltDatabase: metadata.dolt_database.trim(),
    },
  };
}

/**
 * Detect the repository's sole live task provider from native store evidence.
 * Returns `none` when no valid evidence exists so initialization can default
 * to `.backlog/` (or an explicitly selected supported Beads store), and
 * `blocked` with exact remediation for malformed or dual live evidence.
 */
export function detectTaskProvider(
  cwd: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): TaskProviderDetection {
  const projectRoot = resolveNearestProjectRoot(cwd, process.env.HOME ?? "", runner).root;
  const backlog = scanBacklog(projectRoot);
  if (backlog && "blocked" in backlog) return { kind: "blocked", projectRoot, ...backlog.blocked };
  const beads = scanBeads(projectRoot, runner);
  if (beads && "blocked" in beads) return { kind: "blocked", projectRoot, ...beads.blocked };
  if (backlog && beads) {
    const backlogPath = (backlog.evidence as BacklogProviderEvidence).configPath;
    const beadsPath = (beads.evidence as BeadsProviderEvidence).storeDir;
    return {
      kind: "blocked",
      projectRoot,
      code: "dual-providers",
      detail: `both Backlog (${backlogPath}) and Beads (${beadsPath}) live evidence exists; this is an incomplete migration`,
      remediation: `Complete the provider migration so exactly one live store remains; Prime Claw blocks task lifecycle mutation until then`,
    };
  }
  if (backlog) return { kind: "selected", projectRoot, evidence: backlog.evidence };
  if (beads) return { kind: "selected", projectRoot, evidence: beads.evidence };
  return { kind: "none", projectRoot };
}

export interface ProviderCapabilityCheck {
  name: string;
  detail: string;
}

export interface ProviderCapabilities {
  provider: TaskProviderId;
  version: string;
  checks: ProviderCapabilityCheck[];
}

function commandFailure(command: string, result: { stdout: string; stderr: string; status: number }): string {
  return result.stderr.trim() || result.stdout.trim() || `exit ${result.status}` || `${command} failed`;
}

/**
 * Capability-check the pinned managed Backlog executable. The build pipeline
 * pins and smoke-checks the exact version; this runtime gate proves the
 * executable responds and the resolved configuration maps the exact ordered
 * canonical lifecycle before any task mutation.
 */
export function checkBacklogCapabilities(
  projectRoot: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): ProviderCapabilities {
  const versionResult = runner.run("backlog", ["--version"], { cwd: projectRoot, allowFailure: true });
  if (versionResult.status !== 0) {
    throw new Error(`Backlog capability check failed: the managed \`backlog\` executable is unavailable: ${commandFailure("backlog --version", versionResult)}`);
  }
  const version = versionResult.stdout.trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Backlog capability check failed: unexpected \`backlog --version\` output ${JSON.stringify(version)}`);
  }
  const statusesResult = runner.run("backlog", ["config", "get", "statuses"], { cwd: projectRoot, allowFailure: true });
  if (statusesResult.status !== 0) {
    throw new Error(`Backlog capability check failed: \`backlog config get statuses\` could not read the resolved configuration: ${commandFailure("backlog config get statuses", statusesResult)}`);
  }
  const statuses = statusesResult.stdout.trim().split(",").map((status) => status.trim()).filter((status) => status !== "");
  const expected = [...CANONICAL_LIFECYCLE_STATUSES];
  if (statuses.length !== expected.length || !statuses.every((status, index) => status === expected[index])) {
    throw new Error(
      `Backlog capability check failed: configured statuses ${JSON.stringify(statuses)} do not match the exact ordered lifecycle ${JSON.stringify(expected)}; configure them before any task lifecycle mutation`,
    );
  }
  return {
    provider: "backlog",
    version,
    checks: [
      { name: "executable", detail: `backlog ${version}` },
      { name: "statuses", detail: `exact ordered lifecycle: ${statuses.join(", ")}` },
    ],
  };
}

/**
 * Capability-check the installed Beads executable and the store's
 * category-aware status mapping. The exact custom statuses and built-ins in
 * BEADS_STATUS_MAP must be configured before any task mutation so every
 * canonical lifecycle state has a native target.
 */
export function checkBeadsCapabilities(
  projectRoot: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): ProviderCapabilities {
  const versionResult = runner.run("bd", ["--version"], { cwd: projectRoot, allowFailure: true });
  if (versionResult.status !== 0) {
    throw new Error(`Beads capability check failed: the \`bd\` executable is unavailable: ${commandFailure("bd --version", versionResult)}`);
  }
  const versionMatch = /\bbd version (\d+\.\d+\.\d+)\b/.exec(versionResult.stdout) ?? /^(\d+\.\d+\.\d+)\b/.exec(versionResult.stdout.trim());
  if (!versionMatch) {
    throw new Error(`Beads capability check failed: unexpected \`bd --version\` output ${JSON.stringify(versionResult.stdout.trim())}`);
  }
  const statusesResult = runner.run("bd", ["statuses", "--json"], { cwd: projectRoot, allowFailure: true });
  if (statusesResult.status !== 0) {
    throw new Error(`Beads capability check failed: \`bd statuses --json\` could not read the per-project store: ${commandFailure("bd statuses --json", statusesResult)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(statusesResult.stdout);
  } catch (error) {
    throw new Error(`Beads capability check failed: \`bd statuses --json\` returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const view = parsed as Record<string, unknown>;
  if (!view || typeof view !== "object" || Array.isArray(view) || view.schema_version !== 1) {
    throw new Error("Beads capability check failed: unsupported `bd statuses --json` schema");
  }
  const rows: Array<{ name: string; category: string; custom: boolean }> = [];
  for (const [key, custom] of [["built_in_statuses", false], ["custom_statuses", true]] as const) {
    const list = view[key];
    if (list === undefined) continue;
    if (!Array.isArray(list)) {
      throw new Error(`Beads capability check failed: \`bd statuses --json\` field ${key} is not a list`);
    }
    for (const entry of list) {
      const row = entry as Record<string, unknown>;
      if (!row || typeof row !== "object" || typeof row.name !== "string" || typeof row.category !== "string") {
        throw new Error(`Beads capability check failed: \`bd statuses --json\` field ${key} has an invalid entry`);
      }
      rows.push({ name: row.name, category: row.category, custom });
    }
  }
  const missing: string[] = [];
  for (const status of CANONICAL_LIFECYCLE_STATUSES) {
    const mapping = BEADS_STATUS_MAP[status];
    const found = rows.find((row) => row.name === mapping.name && row.custom === mapping.custom);
    if (!found) {
      missing.push(`${mapping.name}:${mapping.category} (${mapping.custom ? "custom" : "built-in"})`);
    } else if (found.category !== mapping.category) {
      missing.push(`${mapping.name} has category ${found.category}, expected ${mapping.category}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Beads capability check failed: the status mapping is incomplete: ${missing.join("; ")}; `
      + `configure \`bd config set status.custom "in_design:active,in_planning:active,ready_for_merge:wip,done:done"\` before any task lifecycle mutation`,
    );
  }
  return {
    provider: "beads",
    version: versionMatch[1],
    checks: [
      { name: "executable", detail: `bd ${versionMatch[1]}` },
      { name: "statuses", detail: `exact category-aware lifecycle mapping: ${CANONICAL_LIFECYCLE_STATUSES.join(", ")}` },
    ],
  };
}

/** Capability-check the selected provider of a successful detection. */
export function checkSelectedProviderCapabilities(
  detection: Extract<TaskProviderDetection, { kind: "selected" }>,
  runner: CommandRunner = new ProcessCommandRunner(),
): ProviderCapabilities {
  if (detection.evidence.provider === "backlog") return checkBacklogCapabilities(detection.projectRoot, runner);
  return checkBeadsCapabilities(detection.projectRoot, runner);
}

/**
 * One provider-resolved task, shaped like the existing Backlog selection so
 * the reviewed-plan and Episode admission call sites consume it unchanged.
 * For Beads there is no task Markdown file: `taskPath` is null and the
 * selection carries the exact store identity instead.
 */
export interface ProviderTaskSelection {
  provider: TaskProviderId;
  taskId: string;
  title: string;
  status: string;
  implementationPlan: string | null;
  references?: string[];
  projectRoot: string;
  /** Absolute task Markdown path for Backlog; null for Beads. */
  taskPath: string | null;
  /** Project-relative task path for Backlog; null for Beads. */
  taskPathRelative: string | null;
}

function requireLiveProvider(cwd: string, runner: CommandRunner): Extract<TaskProviderDetection, { kind: "selected" }> {
  const detection = detectTaskProvider(cwd, runner);
  if (detection.kind === "none") {
    throw new Error(
      `no live task provider evidence exists for ${detection.projectRoot}; `
      + "run Prime Claw project initialization (which defaults to `.backlog/`) or initialize a supported Beads store first",
    );
  }
  if (detection.kind === "blocked") {
    throw new Error(
      `the task provider state is blocked (${detection.code}): ${detection.detail}. ${detection.remediation}`,
    );
  }
  return detection;
}

/** Parse `bd show <id> --json` output into the shared selection shape. */
function parseBeadsTaskView(stdout: string, selectedTaskId: string, projectRoot: string): ProviderTaskSelection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Beads returned invalid JSON for ${selectedTaskId}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Array.isArray(parsed) || parsed.length !== 1 || !parsed[0] || typeof parsed[0] !== "object") {
    throw new Error(`Beads returned an unsupported task-view schema for ${selectedTaskId}`);
  }
  const issue = parsed[0] as Record<string, unknown>;
  if (typeof issue.id !== "string" || !issue.id.trim()) {
    throw new Error(`Beads returned no canonical task ID for ${selectedTaskId}`);
  }
  if (typeof issue.title !== "string" || !issue.title.trim()) {
    throw new Error(`Beads task ${selectedTaskId} has no title`);
  }
  if (typeof issue.status !== "string" || !issue.status.trim()) {
    throw new Error(`Beads task ${selectedTaskId} has no status`);
  }
  // `bd show` has no implementation-plan field; semantic planning content
  // lives in the task body, which managed instructions read natively.
  return {
    provider: "beads",
    taskId: issue.id,
    title: issue.title,
    status: issue.status,
    implementationPlan: null,
    projectRoot,
    taskPath: null,
    taskPathRelative: null,
  };
}

function resolveBeadsTask(
  projectRoot: string,
  selectedTaskId: string,
  runner: CommandRunner,
): ProviderTaskSelection {
  const result = runner.run("bd", ["show", selectedTaskId, "--json"], {
    cwd: projectRoot,
    allowFailure: true,
  });
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`;
    throw new Error(`Beads could not resolve ${selectedTaskId}: ${detail}`);
  }
  const selection = parseBeadsTaskView(result.stdout, selectedTaskId, projectRoot);
  if (selection.taskId !== selectedTaskId) {
    throw new Error(`Beads resolved ${selectedTaskId} to a different task ID ${selection.taskId}`);
  }
  return selection;
}

/**
 * Resolve one explicit task through the repository's sole live provider.
 * Detection and the capability gate run before the native read; none, dual,
 * malformed, or unavailable provider evidence fails closed. The returned
 * status is always the canonical lifecycle status (Backlog statuses are
 * already canonical; Beads statuses map through BEADS_STATUS_MAP reversed).
 */
export function resolveProviderTask(
  cwd: string,
  rawTaskId: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): ProviderTaskSelection | null {
  const selectedTaskId = rawTaskId.trim();
  if (!selectedTaskId || /\s/.test(selectedTaskId) || selectedTaskId.startsWith("-")) return null;

  const detection = requireLiveProvider(cwd, runner);
  checkSelectedProviderCapabilities(detection, runner);
  if (detection.evidence.provider === "backlog") {
    const selection = resolveBacklogTask(detection.projectRoot, selectedTaskId, runner);
    if (!selection) return null;
    return { provider: "backlog", ...selection };
  }
  const selection = resolveBeadsTask(detection.projectRoot, selectedTaskId, runner);
  const canonical = Object.entries(BEADS_STATUS_MAP).find(([, mapping]) => mapping.name === selection.status)?.[0];
  if (!canonical) {
    throw new Error(`Beads task ${selection.taskId} carries unmapped status ${selection.status}`);
  }
  return { ...selection, status: canonical };
}

/**
 * Apply one canonical lifecycle status transition through the selected
 * provider's native mutation, then prove the exact task reached it by
 * re-reading natively. Backlog mutates its tracked Markdown task file;
 * Beads mutates the Dolt store (no task file exists). Returns the canonical
 * status exactly as the provider recorded it.
 */
export function mutateProviderTaskStatus(options: {
  projectRoot: string;
  taskId: string;
  status: CanonicalLifecycleStatus;
  note?: string;
  runner?: CommandRunner;
}): ProviderTaskSelection {
  const runner = options.runner ?? new ProcessCommandRunner();
  const detection = requireLiveProvider(options.projectRoot, runner);
  checkSelectedProviderCapabilities(detection, runner);

  if (detection.evidence.provider === "backlog") {
    const args = ["task", "edit", "--status", options.status];
    if (options.note) args.push("--append-notes", options.note);
    args.push("--plain", "--", options.taskId);
    runner.run("backlog", args, { cwd: detection.projectRoot });
  } else {
    const mapping = BEADS_STATUS_MAP[options.status];
    const args = ["update", options.taskId, "--status", mapping.name];
    if (options.note) args.push("--append-notes", options.note);
    args.push("--json");
    runner.run("bd", args, { cwd: detection.projectRoot });
  }

  const resolved = resolveProviderTask(detection.projectRoot, options.taskId, runner);
  if (!resolved || resolved.taskId !== options.taskId) {
    throw new Error(`task ${options.taskId} could not be re-resolved exactly after the ${options.status} mutation`);
  }
  if (resolved.status !== options.status) {
    throw new Error(`task ${options.taskId} did not reach ${options.status}`);
  }
  return resolved;
}
