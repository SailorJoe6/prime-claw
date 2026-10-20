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

import { lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type CommandRunner,
  ProcessCommandRunner,
  resolveNearestProjectRoot,
} from "./project-initialization.ts";
import { resolveBacklogTask, type BacklogTaskSelection } from "./reviewed-plan-support.ts";

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
  let canonicalProjectRoot: string;
  let storeEntry: ReturnType<typeof lstatSync>;
  let canonicalStore: string;
  try {
    canonicalProjectRoot = realpathSync(projectRoot);
  } catch {
    return {
      blocked: {
        code: "malformed-evidence",
        detail: "the selected project root has unreadable or ambiguous filesystem identity",
        remediation: "Restore a readable real project directory, then retry before running any native Beads command",
      },
    };
  }
  try {
    storeEntry = lstatSync(beadsPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    return {
      blocked: {
        code: "malformed-evidence",
        detail: `${BEADS_DIR} has unreadable or ambiguous filesystem identity`,
        remediation: `Restore a readable real non-symlink ${BEADS_DIR} directory inside the selected project, then retry`,
      },
    };
  }
  try {
    canonicalStore = realpathSync(beadsPath);
  } catch {
    return {
      blocked: {
        code: "malformed-evidence",
        detail: `${BEADS_DIR} has unreadable or ambiguous canonical identity`,
        remediation: `Restore a readable real non-symlink ${BEADS_DIR} directory inside the selected project, then retry`,
      },
    };
  }
  const expectedCanonicalStore = join(canonicalProjectRoot, BEADS_DIR);
  if (storeEntry.isSymbolicLink() || !storeEntry.isDirectory()
      || canonicalStore !== expectedCanonicalStore || !containedBy(canonicalProjectRoot, canonicalStore)) {
    return {
      blocked: {
        code: "malformed-evidence",
        detail: `${BEADS_DIR} is not the selected project's real non-symlink Beads directory`,
        remediation: `Replace ${BEADS_DIR} with a real directory canonically contained in the selected project; do not link task authority to an external store`,
      },
    };
  }

  const authorityFiles = [
    { name: "metadata.json", path: join(beadsPath, "metadata.json") },
    { name: "config.yaml", path: join(beadsPath, "config.yaml") },
  ];
  const authorityIdentities: Array<{
    name: string;
    path: string;
    entry: ReturnType<typeof lstatSync>;
    canonicalPath: string;
  }> = [];
  const missingAuthorityFiles: string[] = [];
  for (const authorityFile of authorityFiles) {
    let entry: ReturnType<typeof lstatSync>;
    try {
      entry = lstatSync(authorityFile.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        missingAuthorityFiles.push(authorityFile.name);
        continue;
      }
      return {
        blocked: {
          code: "malformed-evidence",
          detail: `${BEADS_DIR}/${authorityFile.name} has unreadable or ambiguous filesystem identity`,
          remediation: `Restore a readable real non-symlink ${authorityFile.name} file inside ${BEADS_DIR}, then retry`,
        },
      };
    }
    let canonicalPath: string;
    try {
      canonicalPath = realpathSync(authorityFile.path);
    } catch {
      return {
        blocked: {
          code: "malformed-evidence",
          detail: `${BEADS_DIR}/${authorityFile.name} has unreadable or ambiguous canonical identity`,
          remediation: `Restore a readable real non-symlink ${authorityFile.name} file inside ${BEADS_DIR}, then retry`,
        },
      };
    }
    authorityIdentities.push({ ...authorityFile, entry, canonicalPath });
  }
  if (missingAuthorityFiles.length === authorityFiles.length) {
    // Export residue (for example only issues.jsonl) or an empty directory is
    // not live evidence and not partial initialization: ignore it.
    return null;
  }
  const unsafeAuthority = authorityIdentities.find((identity) =>
    identity.entry.isSymbolicLink() || !identity.entry.isFile()
      || identity.canonicalPath !== join(canonicalStore, identity.name)
      || !containedBy(canonicalStore, identity.canonicalPath)
      || !containedBy(canonicalProjectRoot, identity.canonicalPath));
  if (unsafeAuthority) {
    return {
      blocked: {
        code: "malformed-evidence",
        detail: `${BEADS_DIR}/${unsafeAuthority.name} is not a real regular non-symlink file canonically contained in the selected Beads store`,
        remediation: `Replace ${unsafeAuthority.name} with a real readable regular file inside the selected ${BEADS_DIR} directory; do not link task authority to external content`,
      },
    };
  }
  if (missingAuthorityFiles.length !== 0) {
    return {
      blocked: {
        code: "malformed-evidence",
        detail: `${BEADS_DIR} is missing ${missingAuthorityFiles.join(" and ")}`,
        remediation: `Run the supported \`bd bootstrap\` recovery or remove the incomplete ${BEADS_DIR} store`,
      },
    };
  }
  const configPath = authorityFiles[1].path;
  const metadataPath = authorityFiles[0].path;
  try {
    // Prove both selected authority files are readable only after their exact
    // in-project identities are safe; config semantics remain native to bd.
    readFileSync(configPath);
  } catch {
    return {
      blocked: {
        code: "malformed-evidence",
        detail: `${BEADS_DIR}/config.yaml is not readable as selected Beads authority`,
        remediation: `Restore a readable real config.yaml file inside ${BEADS_DIR}, then retry before running any native Beads command`,
      },
    };
  }
  let metadataText: string;
  try {
    metadataText = readFileSync(metadataPath, "utf8");
  } catch {
    return {
      blocked: {
        code: "malformed-evidence",
        detail: `${BEADS_DIR}/metadata.json is not readable as selected Beads authority`,
        remediation: `Restore a readable real metadata.json file inside ${BEADS_DIR}, then retry before running any native Beads command`,
      },
    };
  }
  let metadata: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(metadataText);
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

export const BEADS_DOLT_DATA_REF = "refs/dolt/data";

export type BeadsServerAuthority = "bd-auto-start" | "operator-managed";

export interface BeadsWorkspaceTransportEvidence {
  provider: "beads";
  projectRoot: string;
  storeDir: string;
  bdVersion: string;
  doltVersion: string;
  serverAuthority: BeadsServerAuthority;
  serverHost: string;
  serverPort: number;
  database: string;
  branch: string;
  revision: string;
  remoteName: string;
  remoteUrl: string;
  publicationRef: typeof BEADS_DOLT_DATA_REF;
  publicationHead: string;
  publishedRevision: string;
}

export type BeadsWorkspaceTransportPreparation =
  | { status: "ready"; evidence: BeadsWorkspaceTransportEvidence }
  | {
      status: "blocked";
      code: "provider-authority" | "capability" | "server-mode" | "server-unavailable" | "revision" | "remote-transport" | "publication-authority";
      detail: string;
      remediation: string;
    };

type JsonRecord = Record<string, unknown>;

function parseJSONRecordCommand(
  label: string,
  result: { stdout: string; stderr: string; status: number },
): { value: JsonRecord } | { error: string } {
  if (result.status !== 0) return { error: commandFailure(label, result) };
  try {
    const parsed: unknown = JSON.parse(result.stdout);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: `${label} returned a non-object JSON value` };
    }
    return { value: parsed as JsonRecord };
  } catch (error) {
    return { error: `${label} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function normalizedDoltGitRemote(url: string): string | null {
  if (!url || url.includes("\0") || /[\r\n]/.test(url)) return null;
  if (/^git\+(?:https?|ssh|file):\/\//.test(url)) return url;
  if (/^(?:https?|ssh|file):\/\//.test(url)) return `git+${url}`;
  if (isAbsolute(url)) return `git+${pathToFileURL(normalize(url)).href}`;
  const scp = /^([^/:]+@[^/:]+):(.+)$/.exec(url);
  if (scp) return `git+ssh://${scp[1]}/${scp[2]}`;
  return null;
}

/**
 * Prove the selected Beads workspace, per-project server, native revision,
 * configured Git-backed Dolt transport, and its published refs/dolt/data
 * authority. Native bd reads may exercise bd's supported per-project
 * auto-start. Direct Dolt reads are limited to version discovery and a
 * disposable remote clone; none targets the live store. JSONL is never authority.
 */
export function prepareBeadsWorkspaceTransport(
  cwd: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): BeadsWorkspaceTransportPreparation {
  const detection = detectTaskProvider(cwd, runner);
  if (detection.kind !== "selected" || detection.evidence.provider !== "beads") {
    if (detection.kind === "blocked") {
      return {
        status: "blocked",
        code: "provider-authority",
        detail: `live task-provider authority is blocked (${detection.code}): ${detection.detail}`,
        remediation: detection.remediation,
      };
    }
    return {
      status: "blocked",
      code: "provider-authority",
      detail: detection.kind === "none"
        ? "no live Beads authority is selected"
        : `the selected live provider is ${detection.evidence.provider}, not Beads`,
      remediation: detection.kind === "none"
        ? "Initialize one supported Beads Dolt store with `bd init --server`, or select the existing live provider"
        : "Use the selected provider or complete an explicit provider migration before preparing Beads transport",
    };
  }
  const projectRoot = detection.projectRoot;
  const selected = detection.evidence;

  let capabilities: ProviderCapabilities;
  try {
    capabilities = checkBeadsCapabilities(projectRoot, runner);
  } catch (error) {
    return {
      status: "blocked",
      code: "capability",
      detail: error instanceof Error ? error.message : String(error),
      remediation: "Restore the pinned supported `bd` executable and exact category-aware lifecycle statuses, then rerun preparation",
    };
  }

  const contextResult = parseJSONRecordCommand(
    "bd context --json",
    runner.run("bd", ["context", "--json"], { cwd: projectRoot, allowFailure: true }),
  );
  if ("error" in contextResult) {
    return {
      status: "blocked",
      code: "provider-authority",
      detail: `native Beads context is unavailable: ${contextResult.error}`,
      remediation: "Run `bd context --json` from the repository and repair its reported workspace binding before retrying",
    };
  }
  const context = contextResult.value;
  const contextMatches = context.schema_version === 1
    && context.backend === "dolt"
    && context.bd_version === capabilities.version
    && context.database === selected.doltDatabase
    && typeof context.repo_root === "string" && resolve(context.repo_root) === projectRoot
    && typeof context.cwd_repo_root === "string" && resolve(context.cwd_repo_root) === projectRoot
    && typeof context.beads_dir === "string" && resolve(context.beads_dir) === selected.storeDir;
  if (!contextMatches) {
    return {
      status: "blocked",
      code: "provider-authority",
      detail: "`bd context --json` does not exactly match the selected repository, .beads store, bd version, and Dolt database",
      remediation: "Run `bd context --json` and `bd where --json`; repair redirects or metadata so this repository resolves to its one selected Beads database",
    };
  }
  if (context.dolt_mode !== "server") {
    return {
      status: "blocked",
      code: "server-mode",
      detail: `the selected Beads store uses unsupported Dolt mode ${JSON.stringify(context.dolt_mode)}; multi-agent use requires native per-project server mode`,
      remediation: "Reconfigure the store through supported `bd init --server`/bootstrap procedures before multi-agent use; do not run raw Dolt beside an embedded store",
    };
  }

  const autoStartCommand = runner.run("bd", ["config", "get", "dolt.auto-start", "--json"], { cwd: projectRoot, allowFailure: true });
  const autoStartResult = parseJSONRecordCommand("bd config get dolt.auto-start --json", autoStartCommand);
  if ("error" in autoStartResult) {
    return {
      status: "blocked",
      code: "server-mode",
      detail: `the effective per-project server lifecycle is unavailable: ${autoStartResult.error}`,
      remediation: "Set `bd config set dolt.auto-start true` for bd-managed lifecycle or `bd config set dolt.auto-start false` for an operator-managed server, then retry",
    };
  }
  const autoStartView = autoStartResult.value;
  const autoStart = typeof autoStartView.value === "string" ? autoStartView.value.trim().toLowerCase() : "<invalid>";
  const autoStartEnabled = autoStart === "" || autoStart === "true" || autoStart === "1" || autoStart === "on";
  const autoStartDisabled = autoStart === "false" || autoStart === "0" || autoStart === "off";
  if (autoStartView.schema_version !== 1 || autoStartView.key !== "dolt.auto-start"
      || autoStartView.location !== "config.yaml" || (!autoStartEnabled && !autoStartDisabled)) {
    return {
      status: "blocked",
      code: "server-mode",
      detail: "`bd config get dolt.auto-start --json` did not prove supported per-project lifecycle configuration",
      remediation: "Set `bd config set dolt.auto-start true` for bd-managed lifecycle or `bd config set dolt.auto-start false` for an operator-managed server, then retry",
    };
  }

  const showResult = parseJSONRecordCommand(
    "bd dolt show --json",
    runner.run("bd", ["dolt", "show", "--json"], { cwd: projectRoot, allowFailure: true }),
  );
  if ("error" in showResult) {
    return {
      status: "blocked",
      code: "server-unavailable",
      detail: `native Dolt server configuration is unavailable: ${showResult.error}`,
      remediation: autoStartDisabled
        ? "Start the configured operator-managed Dolt server and verify it with `bd dolt show --json`"
        : "Run `bd dolt start`, then verify the per-project server with `bd dolt show --json`",
    };
  }
  const show = showResult.value;
  const serverHost = typeof show.host === "string" ? show.host.trim() : "";
  const serverPort = typeof show.port === "number" && Number.isInteger(show.port) ? show.port : 0;
  if (show.schema_version !== 1 || show.backend !== "dolt" || show.embedded !== false
      || show.shared_server !== false || show.connection_ok !== true
      || show.database !== selected.doltDatabase || !serverHost || serverPort < 1 || serverPort > 65535) {
    return {
      status: "blocked",
      code: "server-mode",
      detail: "`bd dolt show --json` did not prove one reachable non-embedded, non-shared per-project server for the selected database",
      remediation: "Configure native per-project server mode with `bd init --server` or repair the selected server; machine-global shared and embedded modes are unsupported",
    };
  }

  const statusResult = parseJSONRecordCommand(
    "bd dolt status --json",
    runner.run("bd", ["dolt", "status", "--json"], { cwd: projectRoot, allowFailure: true }),
  );
  if ("error" in statusResult) {
    return {
      status: "blocked",
      code: "server-unavailable",
      detail: `native Dolt server status is unavailable: ${statusResult.error}`,
      remediation: autoStartDisabled
        ? "Start the operator-managed server and verify `bd dolt status --json` reports running external authority"
        : "Repair bd auto-start or run `bd dolt start`, then verify `bd dolt status --json`",
    };
  }
  const serverStatus = statusResult.value;
  if (autoStartDisabled) {
    if (serverStatus.schema_version !== 1 || serverStatus.mode !== "external" || serverStatus.running !== true
        || serverStatus.database !== selected.doltDatabase || serverStatus.host !== serverHost || serverStatus.port !== serverPort) {
      return {
        status: "blocked",
        code: "server-unavailable",
        detail: "operator-managed mode is selected but `bd dolt status --json` did not prove the exact external server/database is running",
        remediation: "Start the configured operator-managed server, keep `dolt.auto-start: false`, and retry `bd dolt status --json`",
      };
    }
  } else if (serverStatus.schema_version !== 1 || serverStatus.running !== true
      || typeof serverStatus.pid !== "number" || !Number.isInteger(serverStatus.pid) || serverStatus.pid < 1
      || serverStatus.port !== serverPort || typeof serverStatus.data_dir !== "string" || !serverStatus.data_dir.trim()) {
    return {
      status: "blocked",
      code: "server-unavailable",
      detail: "bd-managed auto-start is selected but `bd dolt status --json` did not prove one running per-project server process",
      remediation: "Repair bd auto-start or run `bd dolt start`, then retry without starting a raw Dolt process",
    };
  }
  if (!autoStartDisabled) {
    const expectedDataDir = join(selected.storeDir, "dolt");
    const reportedDataDir = (serverStatus.data_dir as string).trim();
    let realStoreDir: string;
    let realExpectedDataDir: string;
    let realReportedDataDir: string;
    try {
      realStoreDir = realpathSync(selected.storeDir);
      realExpectedDataDir = realpathSync(expectedDataDir);
      realReportedDataDir = realpathSync(reportedDataDir);
    } catch (error) {
      return {
        status: "blocked",
        code: "server-unavailable",
        detail: `bd-managed server data-directory identity is unavailable: ${error instanceof Error ? error.message : String(error)}`,
        remediation: "Stop any foreign server, restore the selected store's real `.beads/dolt` directory through supported `bd dolt start`, and retry",
      };
    }
    if (realStoreDir !== selected.storeDir || realExpectedDataDir !== expectedDataDir
        || reportedDataDir !== expectedDataDir || realReportedDataDir !== realExpectedDataDir) {
      return {
        status: "blocked",
        code: "server-unavailable",
        detail: `bd-managed server data directory ${JSON.stringify(reportedDataDir)} is not the selected store's exact real per-project directory ${JSON.stringify(expectedDataDir)}`,
        remediation: "Stop the foreign or symlinked server, restore the selected store's real `.beads/dolt` directory, and start it through supported `bd dolt start`",
      };
    }
  }

  const doltVersionResult = runner.run("dolt", ["version"], { cwd: projectRoot, allowFailure: true });
  const installedDoltVersion = /^dolt version (\d+\.\d+\.\d+)\b/m.exec(doltVersionResult.stdout)?.[1] ?? null;
  if (doltVersionResult.status !== 0 || !installedDoltVersion) {
    return {
      status: "blocked",
      code: "capability",
      detail: `the installed Dolt version is unavailable or unreadable: ${commandFailure("dolt version", doltVersionResult)}`,
      remediation: "Restore the Dolt executable supplied with the pinned Beads installation, then retry",
    };
  }

  const identityQuery = "SELECT database() AS database_name, active_branch() AS branch, dolt_hashof('HEAD') AS revision, dolt_version() AS dolt_version";
  const identityCommand = runner.run("bd", ["--readonly", "sql", "--json", identityQuery], { cwd: projectRoot, allowFailure: true });
  let identityRows: unknown;
  try {
    identityRows = JSON.parse(identityCommand.stdout);
  } catch (error) {
    return {
      status: "blocked",
      code: "revision",
      detail: `native Dolt identity query returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "Repair the selected server until the read-only native identity query reports its exact database, branch, revision, and Dolt version",
    };
  }
  const identity = Array.isArray(identityRows) && identityRows.length === 1 ? identityRows[0] as JsonRecord : null;
  if (identityCommand.status !== 0 || !identity || identity.database_name !== selected.doltDatabase
      || typeof identity.branch !== "string" || !identity.branch.trim()
      || typeof identity.revision !== "string" || !/^[0-9a-v]{32}$/.test(identity.revision)
      || identity.dolt_version !== installedDoltVersion) {
    return {
      status: "blocked",
      code: "revision",
      detail: "the read-only native identity query did not prove one exact selected database/branch/revision at the installed Dolt version",
      remediation: "Verify the configured server/database and pinned Dolt installation, then rerun the read-only `bd sql` identity query",
    };
  }

  const dirtyQuery = "SELECT table_name, staged, status FROM dolt_status ORDER BY table_name";
  const dirtyCommand = runner.run("bd", ["--readonly", "sql", "--json", dirtyQuery], { cwd: projectRoot, allowFailure: true });
  let dirtyRows: unknown;
  try {
    dirtyRows = JSON.parse(dirtyCommand.stdout);
  } catch (error) {
    return {
      status: "blocked",
      code: "revision",
      detail: `native Dolt working-set query returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "Repair the selected database until the read-only `dolt_status` query is available",
    };
  }
  if (dirtyCommand.status !== 0 || !Array.isArray(dirtyRows)) {
    return {
      status: "blocked",
      code: "revision",
      detail: `native Dolt working-set evidence is unavailable: ${commandFailure("bd --readonly sql dolt_status", dirtyCommand)}`,
      remediation: "Repair the selected database until the read-only `dolt_status` query is available",
    };
  }
  if (dirtyRows.length !== 0) {
    return {
      status: "blocked",
      code: "revision",
      detail: `the selected Dolt working set has ${dirtyRows.length} uncommitted table change(s), so HEAD is not complete publication evidence`,
      remediation: "Inspect `dolt_status`; after review, commit intended changes with `bd dolt commit -m <message>`. If the supported command rehydrates required config outside HEAD, upgrade or repair Beads before retrying; do not bypass the live server with raw Dolt",
    };
  }
  const branch = identity.branch.trim();
  const revision = identity.revision;

  const configuredRemoteCommand = runner.run("bd", ["config", "get", "sync.remote", "--json"], { cwd: projectRoot, allowFailure: true });
  const configuredRemoteResult = parseJSONRecordCommand("bd config get sync.remote --json", configuredRemoteCommand);
  if ("error" in configuredRemoteResult) {
    return {
      status: "blocked",
      code: "remote-transport",
      detail: `no exact native Dolt sync remote is available: ${configuredRemoteResult.error}`,
      remediation: "Add the repository remote with `bd dolt remote add origin <git+https-or-git+ssh-url>`, commit `.beads/config.yaml`, and publish once with `bd dolt push --remote origin`",
    };
  }
  const configuredRemoteView = configuredRemoteResult.value;
  const configuredRemoteInput = typeof configuredRemoteView.value === "string" ? configuredRemoteView.value.trim() : "";
  const configuredRemote = normalizedDoltGitRemote(configuredRemoteInput);
  if (configuredRemoteView.schema_version !== 1 || configuredRemoteView.key !== "sync.remote"
      || configuredRemoteView.location !== "config.yaml" || !configuredRemoteInput || !configuredRemote) {
    return {
      status: "blocked",
      code: "remote-transport",
      detail: "`bd config get sync.remote --json` did not prove one supported config.yaml-backed Git remote URL or absolute path",
      remediation: "Add the intended Git-backed remote with `bd dolt remote add <name> <url>` so native config and remote evidence agree",
    };
  }

  const remotesCommand = runner.run("bd", ["dolt", "remote", "list", "--json"], { cwd: projectRoot, allowFailure: true });
  if (remotesCommand.status !== 0) {
    return {
      status: "blocked",
      code: "remote-transport",
      detail: `native Dolt remote evidence is unavailable: ${commandFailure("bd dolt remote list --json", remotesCommand)}`,
      remediation: "Repair the selected database until `bd dolt remote list --json` returns its configured remotes",
    };
  }
  let remotes: unknown;
  try {
    remotes = JSON.parse(remotesCommand.stdout);
  } catch (error) {
    return {
      status: "blocked",
      code: "remote-transport",
      detail: `bd dolt remote list --json returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "Repair the pinned bd installation and rerun `bd dolt remote list --json`",
    };
  }
  if (!Array.isArray(remotes)) {
    return {
      status: "blocked",
      code: "remote-transport",
      detail: "bd dolt remote list --json returned a non-list schema",
      remediation: "Repair the pinned bd installation and rerun `bd dolt remote list --json`",
    };
  }
  const remoteRows = remotes as JsonRecord[];
  if (remoteRows.some((row) => !row || typeof row !== "object" || typeof row.name !== "string" || !row.name.trim()
      || typeof row.url !== "string" || typeof row.sql_url !== "string" || typeof row.status !== "string")) {
    return {
      status: "blocked",
      code: "remote-transport",
      detail: "bd dolt remote list --json returned a malformed remote entry",
      remediation: "Repair the pinned bd installation and native remote configuration before retrying",
    };
  }
  const matches = remoteRows.filter((row) =>
    normalizedDoltGitRemote(row.url as string) === configuredRemote
      && normalizedDoltGitRemote(row.sql_url as string) === configuredRemote
      && row.status === "ok");
  if (matches.length !== 1) {
    return {
      status: "blocked",
      code: "remote-transport",
      detail: `the configured sync remote ${JSON.stringify(configuredRemote)} does not resolve to exactly one healthy native Dolt remote`,
      remediation: "Use `bd dolt remote list --json` and `bd dolt remote add/remove` so `sync.remote` selects exactly one healthy remote",
    };
  }
  const remoteName = matches[0].name as string;

  const gitRemoteResult = runner.run("git", ["remote", "get-url", "--all", remoteName], { cwd: projectRoot, allowFailure: true });
  const gitRemoteUrls = gitRemoteResult.stdout.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
  if (gitRemoteResult.status !== 0 || gitRemoteUrls.length !== 1 || normalizedDoltGitRemote(gitRemoteUrls[0]) !== configuredRemote) {
    return {
      status: "blocked",
      code: "publication-authority",
      detail: `Dolt remote ${JSON.stringify(remoteName)} is not proved to be the same exact transport as one repository Git remote`,
      remediation: `Configure Git remote ${JSON.stringify(remoteName)} and the native Dolt remote to the same repository URL, then rerun preparation`,
    };
  }

  const publicationResult = runner.run("git", ["ls-remote", "--exit-code", "--refs", remoteName, BEADS_DOLT_DATA_REF], { cwd: projectRoot, allowFailure: true });
  const publicationMatch = /^([0-9a-f]{40})\trefs\/dolt\/data\n?$/.exec(publicationResult.stdout);
  if (publicationResult.status !== 0 || !publicationMatch) {
    return {
      status: "blocked",
      code: "publication-authority",
      detail: `repository remote ${JSON.stringify(remoteName)} does not expose one exact ${BEADS_DOLT_DATA_REF} authority: ${commandFailure(`git ls-remote ${remoteName} ${BEADS_DOLT_DATA_REF}`, publicationResult)}`,
      remediation: `Publish the native Dolt history with \`bd dolt push --remote ${remoteName}\` (never force), then verify \`git ls-remote ${remoteName} ${BEADS_DOLT_DATA_REF}\``,
    };
  }
  const publicationHead = publicationMatch[1];

  if (!/^[A-Za-z0-9_.-]+$/.test(selected.doltDatabase) || selected.doltDatabase === "." || selected.doltDatabase === "..") {
    return {
      status: "blocked",
      code: "publication-authority",
      detail: `the selected database name ${JSON.stringify(selected.doltDatabase)} cannot be materialized safely for isolated remote proof`,
      remediation: "Rename or reconfigure the Beads database through supported bd procedures, then retry",
    };
  }
  const proofRoot = mkdtempSync(join(tmpdir(), "prime-claw-beads-remote-proof-"));
  const proofDatabase = join(proofRoot, selected.doltDatabase);
  try {
    const cloned = runner.run("dolt", [
      "clone",
      "--branch", branch,
      "--single-branch",
      "--ref", BEADS_DOLT_DATA_REF,
      configuredRemote,
      proofDatabase,
    ], { allowFailure: true });
    if (cloned.status !== 0) {
      return {
        status: "blocked",
        code: "publication-authority",
        detail: `the exact ${BEADS_DOLT_DATA_REF} authority could not be cloned in isolation: ${commandFailure("dolt clone", cloned)}`,
        remediation: `Make native Git/Dolt credentials available, verify ${BEADS_DOLT_DATA_REF}, and retry; never copy credentials into project files or use a raw live-store clone`,
      };
    }
    const remoteIdentityQuery = "SELECT database() AS database_name, active_branch() AS branch, dolt_hashof('HEAD') AS revision";
    const remoteIdentityCommand = runner.run("dolt", ["sql", "-r", "json", "-q", remoteIdentityQuery], { cwd: proofDatabase, allowFailure: true });
    let remoteIdentityOutput: unknown;
    try {
      remoteIdentityOutput = JSON.parse(remoteIdentityCommand.stdout);
    } catch (error) {
      return {
        status: "blocked",
        code: "publication-authority",
        detail: `isolated remote Dolt identity returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        remediation: "Repair the configured remote and rerun the isolated native publication proof",
      };
    }
    const remoteRows = remoteIdentityOutput && typeof remoteIdentityOutput === "object" && !Array.isArray(remoteIdentityOutput)
      ? (remoteIdentityOutput as JsonRecord).rows
      : null;
    const remoteIdentity = Array.isArray(remoteRows) && remoteRows.length === 1 ? remoteRows[0] as JsonRecord : null;
    if (remoteIdentityCommand.status !== 0 || !remoteIdentity
        || remoteIdentity.database_name !== selected.doltDatabase
        || remoteIdentity.branch !== branch || remoteIdentity.revision !== revision) {
      return {
        status: "blocked",
        code: "publication-authority",
        detail: `the configured ${BEADS_DOLT_DATA_REF} authority does not publish exact local Dolt revision ${revision} on ${branch}`,
        remediation: `Run \`bd dolt pull --remote ${remoteName}\`, resolve any native conflict, then \`bd dolt push --remote ${remoteName}\`; never force automatically`,
      };
    }
  } finally {
    rmSync(proofRoot, { recursive: true, force: true });
  }

  const liveIdentityCommand = runner.run("bd", ["--readonly", "sql", "--json", identityQuery], { cwd: projectRoot, allowFailure: true });
  let liveIdentityRows: unknown;
  try {
    liveIdentityRows = JSON.parse(liveIdentityCommand.stdout);
  } catch (error) {
    return {
      status: "blocked",
      code: "revision",
      detail: `native Dolt identity recheck returned invalid JSON after isolated remote proof: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "Repair the selected server, then rerun preparation so the live database/branch/revision/version can be proved stable",
    };
  }
  const liveIdentity = Array.isArray(liveIdentityRows) && liveIdentityRows.length === 1 ? liveIdentityRows[0] as JsonRecord : null;
  const liveIdentityStable = liveIdentityCommand.status === 0 && liveIdentity !== null
    && liveIdentity.database_name === identity.database_name
    && liveIdentity.branch === branch && liveIdentity.revision === revision
    && liveIdentity.dolt_version === installedDoltVersion;
  const observedLiveRevision = liveIdentity && typeof liveIdentity.revision === "string"
    ? liveIdentity.revision
    : "unavailable";

  const liveDirtyCommand = runner.run("bd", ["--readonly", "sql", "--json", dirtyQuery], { cwd: projectRoot, allowFailure: true });
  let liveDirtyRows: unknown;
  try {
    liveDirtyRows = JSON.parse(liveDirtyCommand.stdout);
  } catch (error) {
    return {
      status: "blocked",
      code: "revision",
      detail: `native Dolt working-set recheck returned invalid JSON after isolated remote proof: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "Repair the selected database until the read-only `dolt_status` query is available and stable",
    };
  }
  if (liveDirtyCommand.status !== 0 || !Array.isArray(liveDirtyRows)) {
    return {
      status: "blocked",
      code: "revision",
      detail: `native Dolt working-set recheck is unavailable after isolated remote proof: ${commandFailure("bd --readonly sql dolt_status", liveDirtyCommand)}`,
      remediation: "Repair the selected database until the read-only `dolt_status` query is available and stable",
    };
  }
  if (liveDirtyRows.length !== 0) {
    return {
      status: "blocked",
      code: "revision",
      detail: `the selected Dolt working set became dirty during isolated remote proof with ${liveDirtyRows.length} uncommitted table change(s)`,
      remediation: "Inspect `dolt_status`; after review, commit intended changes with `bd dolt commit -m <message>`. If the supported command rehydrates required config outside HEAD, upgrade or repair Beads before retrying; do not bypass the live server with raw Dolt",
    };
  }
  if (!liveIdentityStable) {
    return {
      status: "blocked",
      code: "revision",
      detail: `the live native database/branch/revision/version changed or became unavailable during isolated remote proof; prior revision ${revision}, observed ${observedLiveRevision}`,
      remediation: "Reconcile the live selected database with its configured remote through supported `bd dolt pull`/`bd dolt push`, then retry against one stable clean revision; never force automatically",
    };
  }

  const publicationRecheck = runner.run("git", ["ls-remote", "--exit-code", "--refs", remoteName, BEADS_DOLT_DATA_REF], { cwd: projectRoot, allowFailure: true });
  const publicationRecheckMatch = /^([0-9a-f]{40})\trefs\/dolt\/data\n?$/.exec(publicationRecheck.stdout);
  if (publicationRecheck.status !== 0 || !publicationRecheckMatch || publicationRecheckMatch[1] !== publicationHead) {
    const observedPublication = publicationRecheckMatch?.[1]
      ?? commandFailure(`git ls-remote ${remoteName} ${BEADS_DOLT_DATA_REF}`, publicationRecheck);
    return {
      status: "blocked",
      code: "publication-authority",
      detail: `repository remote ${JSON.stringify(remoteName)} changed or became unavailable while proving ${BEADS_DOLT_DATA_REF}; prior Git head ${publicationHead}, observed ${observedPublication}`,
      remediation: `Fetch and reconcile with \`bd dolt pull --remote ${remoteName}\`, then rerun preparation against a stable remote; never force automatically`,
    };
  }

  return {
    status: "ready",
    evidence: {
      provider: "beads",
      projectRoot,
      storeDir: selected.storeDir,
      bdVersion: capabilities.version,
      doltVersion: installedDoltVersion,
      serverAuthority: autoStartDisabled ? "operator-managed" : "bd-auto-start",
      serverHost,
      serverPort,
      database: selected.doltDatabase,
      branch,
      revision,
      remoteName,
      remoteUrl: configuredRemote,
      publicationRef: BEADS_DOLT_DATA_REF,
      publicationHead,
      publishedRevision: revision,
    },
  };
}

export interface BeadsNativeTaskEvidence {
  taskId: string;
  title: string;
  nativeStatus: string;
  canonicalStatus: CanonicalLifecycleStatus;
  /** Exact provider-native task view; isolated evidence also embeds related comments, labels, and dependencies. */
  nativeView: JsonRecord;
}

export interface BeadsNativeDiffEvidence {
  fromRevision: string;
  toRevision: string;
  summary: JsonRecord[];
  targetTaskRows: JsonRecord[];
}

export interface BeadsTaskMutationPublicationEvidence {
  provider: "beads";
  projectRoot: string;
  taskId: string;
  remoteName: string;
  publicationRef: typeof BEADS_DOLT_DATA_REF;
  preMutationRevision: string;
  committedRevision: string;
  publishedRevision: string;
  publicationHead: string;
  liveRevision: string;
  liveTask: BeadsNativeTaskEvidence;
  liveDiff: BeadsNativeDiffEvidence;
  taskBefore: BeadsNativeTaskEvidence;
  taskAfterMutation: BeadsNativeTaskEvidence;
  taskAfterCommit: BeadsNativeTaskEvidence;
  isolatedPublishedTask: BeadsNativeTaskEvidence;
  committedDiff: BeadsNativeDiffEvidence;
  publicationDiff: BeadsNativeDiffEvidence;
  concurrentDescendant: boolean;
}

export interface BeadsSameTaskReconciliationEvidence {
  provider: "beads";
  projectRoot: string;
  taskId: string;
  phase: "mutation" | "commit" | "publication-proof";
  preMutationRevision: string;
  observedRevision: string;
  taskBefore: BeadsNativeTaskEvidence;
  taskObserved: BeadsNativeTaskEvidence;
  diff: BeadsNativeDiffEvidence;
  publication?: BeadsTaskMutationPublicationEvidence;
}

export interface BeadsObservedRemoteEvidence {
  revision: string;
  publicationHead: string;
  task: BeadsNativeTaskEvidence;
  diff: BeadsNativeDiffEvidence;
}

export type BeadsTaskMutationPublication =
  | { status: "published"; evidence: BeadsTaskMutationPublicationEvidence }
  | {
      status: "reconciliation-required";
      code: "concurrent-same-task";
      phase: "mutation" | "commit" | "publication-proof";
      detail: string;
      evidence: BeadsSameTaskReconciliationEvidence;
    }
  | {
      status: "blocked";
      code: "preparation" | "synchronization" | "task-identity" | "revision" | "mutation" | "commit" | "push" | "publication-authority";
      phase: "preparation" | "synchronization" | "pre-mutation" | "mutation" | "commit" | "push" | "publication-proof";
      detail: string;
      remediation: string;
      recoverable: {
        kind: "clean-pre-mutation" | "working-set" | "local-commit" | "unknown";
        preMutationRevision?: string;
        observedRevision?: string;
        dirtyTableCount?: number;
      };
      observedRemote?: BeadsObservedRemoteEvidence;
    };

const BEADS_NATIVE_IDENTITY_QUERY = "SELECT database() AS database_name, active_branch() AS branch, dolt_hashof('HEAD') AS revision, dolt_version() AS dolt_version";
const BEADS_NATIVE_DIRTY_QUERY = "SELECT table_name, staged, status FROM dolt_status ORDER BY table_name";

function readExactBeadsTask(
  projectRoot: string,
  taskId: string,
  runner: CommandRunner,
): { value: BeadsNativeTaskEvidence } | { error: string } {
  const result = runner.run("bd", ["show", taskId, "--json", "--long", "--include-comments"], {
    cwd: projectRoot,
    allowFailure: true,
  });
  if (result.status !== 0) return { error: `bd show ${taskId} failed: ${commandFailure(`bd show ${taskId}`, result)}` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    return { error: `bd show ${taskId} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!Array.isArray(parsed) || parsed.length !== 1 || !parsed[0] || typeof parsed[0] !== "object" || Array.isArray(parsed[0])) {
    return { error: `bd show ${taskId} returned an unsupported exact task-view schema` };
  }
  const nativeView = parsed[0] as JsonRecord;
  if (typeof nativeView.id !== "string" || !nativeView.id.trim()
      || typeof nativeView.title !== "string" || !nativeView.title.trim()
      || typeof nativeView.status !== "string" || !nativeView.status.trim()) {
    return { error: `bd show ${taskId} returned an incomplete exact task view` };
  }
  let canonicalStatus: CanonicalLifecycleStatus;
  try {
    canonicalStatus = beadsCanonicalStatus(nativeView.id, nativeView.status);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  return {
    value: {
      taskId: nativeView.id,
      title: nativeView.title,
      nativeStatus: nativeView.status,
      canonicalStatus,
      nativeView,
    },
  };
}

function observeBeadsNativeState(
  projectRoot: string,
  expected: Pick<BeadsWorkspaceTransportEvidence, "database" | "branch" | "doltVersion">,
  runner: CommandRunner,
): { value: { revision: string; dirtyTableCount: number } } | { error: string } {
  const identityResult = runner.run("bd", ["--readonly", "sql", "--json", BEADS_NATIVE_IDENTITY_QUERY], {
    cwd: projectRoot,
    allowFailure: true,
  });
  if (identityResult.status !== 0) {
    return { error: `native identity query failed: ${commandFailure("bd --readonly sql identity", identityResult)}` };
  }
  let identities: unknown;
  try {
    identities = JSON.parse(identityResult.stdout);
  } catch (error) {
    return { error: `native identity query returned invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const identity = Array.isArray(identities) && identities.length === 1 && identities[0]
    && typeof identities[0] === "object" && !Array.isArray(identities[0])
    ? identities[0] as JsonRecord
    : null;
  if (!identity || identity.database_name !== expected.database || identity.branch !== expected.branch
      || typeof identity.revision !== "string" || !/^[0-9a-v]{32}$/.test(identity.revision)
      || identity.dolt_version !== expected.doltVersion) {
    return { error: "native identity query did not preserve the exact database, branch, revision, and Dolt version" };
  }
  const dirtyResult = runner.run("bd", ["--readonly", "sql", "--json", BEADS_NATIVE_DIRTY_QUERY], {
    cwd: projectRoot,
    allowFailure: true,
  });
  if (dirtyResult.status !== 0) {
    return { error: `native working-set query failed: ${commandFailure("bd --readonly sql dolt_status", dirtyResult)}` };
  }
  let dirtyRows: unknown;
  try {
    dirtyRows = JSON.parse(dirtyResult.stdout);
  } catch (error) {
    return { error: `native working-set query returned invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!Array.isArray(dirtyRows)) return { error: "native working-set query returned a non-list schema" };
  return { value: { revision: identity.revision, dirtyTableCount: dirtyRows.length } };
}

const BEADS_TASK_RELATED_DIFF_COLUMNS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  issues: ["id"],
  bd_events_journal: ["issue_id"],
  comments: ["issue_id"],
  child_counters: ["parent_id"],
  compaction_snapshots: ["issue_id"],
  dependencies: ["issue_id", "depends_on_issue_id", "depends_on_wisp_id"],
  events: ["issue_id"],
  interactions: ["issue_id"],
  issue_snapshots: ["issue_id"],
  labels: ["issue_id"],
  leases: ["issue_id"],
  provenance_events: ["issue_id"],
  wisp_comments: ["issue_id"],
  wisp_child_counters: ["parent_id"],
  wisp_dependencies: ["issue_id", "depends_on_issue_id", "depends_on_wisp_id"],
  wisp_events: ["issue_id"],
  wisp_labels: ["issue_id"],
});

function readBeadsNativeDiff(
  projectRoot: string,
  fromRevision: string,
  toRevision: string,
  taskId: string,
  runner: CommandRunner,
): { value: BeadsNativeDiffEvidence } | { error: string } {
  if (!/^(?:HEAD|WORKING|[0-9a-v]{32})$/.test(fromRevision)
      || !/^(?:HEAD|WORKING|[0-9a-v]{32})$/.test(toRevision)) {
    return { error: "native diff proof received an unsafe revision identifier" };
  }
  const summaryQuery = `SELECT * FROM dolt_diff_summary('${fromRevision}','${toRevision}')`;
  const summaryResult = runner.run("bd", ["--readonly", "sql", "--json", summaryQuery], {
    cwd: projectRoot,
    allowFailure: true,
  });
  if (summaryResult.status !== 0) {
    return { error: `native diff summary failed: ${commandFailure("bd --readonly sql dolt_diff_summary", summaryResult)}` };
  }
  let summary: unknown;
  try {
    summary = JSON.parse(summaryResult.stdout);
  } catch (error) {
    return { error: `native diff summary returned invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!Array.isArray(summary) || summary.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    return { error: "native diff summary returned an unsupported schema" };
  }

  const quotedTaskId = taskId.replaceAll("'", "''");
  const changedTables = new Set<string>();
  for (const row of summary as JsonRecord[]) {
    const table = typeof row.to_table_name === "string" && row.to_table_name
      ? row.to_table_name
      : typeof row.from_table_name === "string" ? row.from_table_name : "";
    if (table in BEADS_TASK_RELATED_DIFF_COLUMNS) changedTables.add(table);
  }
  const taskRows: JsonRecord[] = [];
  for (const table of [...changedTables].sort()) {
    const predicates = BEADS_TASK_RELATED_DIFF_COLUMNS[table]
      .flatMap((column) => [`from_${column} = '${quotedTaskId}'`, `to_${column} = '${quotedTaskId}'`]);
    const query = `SELECT * FROM dolt_diff('${fromRevision}','${toRevision}','${table}') WHERE ${predicates.join(" OR ")}`;
    const result = runner.run("bd", ["--readonly", "sql", "--json", query], {
      cwd: projectRoot,
      allowFailure: true,
    });
    if (result.status !== 0) {
      return { error: `native target-task diff failed for ${table}: ${commandFailure(`bd --readonly sql dolt_diff ${table}`, result)}` };
    }
    let rows: unknown;
    try {
      rows = JSON.parse(result.stdout);
    } catch (error) {
      return { error: `native target-task diff for ${table} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
      return { error: `native target-task diff for ${table} returned an unsupported schema` };
    }
    taskRows.push(...(rows as JsonRecord[]).map((row) => ({ table_name: table, ...row })));
  }

  return {
    value: {
      fromRevision,
      toRevision,
      summary: summary as JsonRecord[],
      targetTaskRows: taskRows as JsonRecord[],
    },
  };
}

function proveRequestedBeadsStatusDelta(
  diff: BeadsNativeDiffEvidence,
  before: BeadsNativeTaskEvidence,
  after: BeadsNativeTaskEvidence,
  expectedNativeStatus: string,
): { value: BeadsNativeDiffEvidence } | { error: string } {
  const hasIssuesDataChange = diff.summary.some((row) => row.from_table_name === "issues"
    && row.to_table_name === "issues" && row.diff_type === "modified"
    && row.data_change === 1 && row.schema_change === 0);
  const row = diff.targetTaskRows.length === 1 ? diff.targetTaskRows[0] : null;
  if (!hasIssuesDataChange || !row || row.table_name !== "issues" || row.diff_type !== "modified"
      || row.from_id !== before.taskId || row.to_id !== after.taskId
      || row.from_title !== before.title || row.to_title !== after.title
      || after.nativeStatus !== expectedNativeStatus
      || row.from_status !== before.nativeStatus || row.to_status !== expectedNativeStatus) {
    return { error: `native ${diff.fromRevision}..${diff.toRevision} target-task diff does not prove exactly ${before.taskId} ${before.nativeStatus} -> ${expectedNativeStatus}` };
  }

  const nativeLifecycleFields = new Set([
    "status", "updated_at", "row_lock", "started_at", "closed_at",
    "closed_by_session", "close_reason", "last_activity", "commit", "commit_date",
  ]);
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith("from_")) continue;
    const field = key.slice("from_".length);
    const toKey = `to_${field}`;
    if (!(toKey in row)) return { error: `native target-task diff omitted ${toKey}` };
    if (!nativeLifecycleFields.has(field) && JSON.stringify(value) !== JSON.stringify(row[toKey])) {
      return { error: `native target task changed non-lifecycle field ${field}` };
    }
  }
  for (const key of Object.keys(row)) {
    if (key.startsWith("to_") && !(`from_${key.slice("to_".length)}` in row)) {
      return { error: `native target-task diff introduced unmatched field ${key}` };
    }
  }
  return { value: diff };
}

function isolatedPublishedBeadsComparison(
  preparation: BeadsWorkspaceTransportEvidence,
  fromRevision: string,
  taskId: string,
  runner: CommandRunner,
): {
  value: {
    revision: string;
    task: BeadsNativeTaskEvidence;
    diff: BeadsNativeDiffEvidence;
  };
} | { error: string } {
  if (!/^[0-9a-v]{32}$/.test(fromRevision)) {
    return { error: "isolated publication comparison received an unsafe native revision" };
  }
  const proofRoot = mkdtempSync(join(tmpdir(), "prime-claw-beads-task-proof-"));
  const proofDatabase = join(proofRoot, preparation.database);
  try {
    const cloned = runner.run("dolt", [
      "clone", "--branch", preparation.branch, "--single-branch", "--ref", BEADS_DOLT_DATA_REF,
      preparation.remoteUrl, proofDatabase,
    ], { allowFailure: true });
    if (cloned.status !== 0) return { error: `isolated task clone failed: ${commandFailure("dolt clone", cloned)}` };

    const runRows = (query: string, label: string, allowEmpty = false): { rows: JsonRecord[] } | { error: string } => {
      const result = runner.run("dolt", ["sql", "-r", "json", "-q", query], {
        cwd: proofDatabase,
        allowFailure: true,
      });
      if (result.status !== 0) return { error: `${label} failed: ${commandFailure(`dolt sql ${label}`, result)}` };
      let output: unknown;
      try {
        output = JSON.parse(result.stdout);
      } catch (error) {
        return { error: `${label} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
      }
      const rawRows = output && typeof output === "object" && !Array.isArray(output)
        ? (output as JsonRecord).rows
        : null;
      const rows = rawRows === undefined && allowEmpty ? [] : rawRows;
      if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
        return { error: `${label} returned an unsupported row schema` };
      }
      return { rows: rows as JsonRecord[] };
    };

    const identity = runRows(
      "SELECT database() AS database_name, active_branch() AS branch, dolt_hashof('HEAD') AS revision",
      "isolated task revision query",
    );
    if ("error" in identity) return identity;
    const identityRow = identity.rows.length === 1 ? identity.rows[0] : null;
    if (!identityRow || identityRow.database_name !== preparation.database
        || identityRow.branch !== preparation.branch
        || typeof identityRow.revision !== "string" || !/^[0-9a-v]{32}$/.test(identityRow.revision)) {
      return { error: `isolated task clone did not prove one native revision on ${preparation.branch}` };
    }
    const publishedRevision = identityRow.revision as string;

    const quotedTaskId = taskId.replaceAll("'", "''");
    const taskRows = runRows(
      `SELECT * FROM issues WHERE id = '${quotedTaskId}' ORDER BY id`,
      "isolated published task query",
    );
    if ("error" in taskRows) return taskRows;
    const published = taskRows.rows.length === 1 ? taskRows.rows[0] : null;
    if (!published || published.id !== taskId || typeof published.title !== "string"
        || typeof published.status !== "string") {
      return { error: `isolated published task query did not return exact task ${taskId} at revision ${publishedRevision}` };
    }
    let publishedCanonicalStatus: CanonicalLifecycleStatus;
    try {
      publishedCanonicalStatus = beadsCanonicalStatus(taskId, published.status);
    } catch (error) {
      return { error: `isolated published task has no canonical lifecycle mapping: ${error instanceof Error ? error.message : String(error)}` };
    }

    const summaryRows = runRows(
      `SELECT * FROM dolt_diff_summary('${fromRevision}','${publishedRevision}')`,
      "isolated publication diff summary",
      true,
    );
    if ("error" in summaryRows) return summaryRows;
    const changedTables = new Set<string>();
    for (const row of summaryRows.rows) {
      const table = typeof row.to_table_name === "string" && row.to_table_name
        ? row.to_table_name
        : typeof row.from_table_name === "string" ? row.from_table_name : "";
      if (table in BEADS_TASK_RELATED_DIFF_COLUMNS) changedTables.add(table);
    }
    const targetRows: JsonRecord[] = [];
    for (const table of [...changedTables].sort()) {
      const predicates = BEADS_TASK_RELATED_DIFF_COLUMNS[table]
        .flatMap((column) => [`from_${column} = '${quotedTaskId}'`, `to_${column} = '${quotedTaskId}'`]);
      const rows = runRows(
        `SELECT * FROM dolt_diff('${fromRevision}','${publishedRevision}','${table}') WHERE ${predicates.join(" OR ")}`,
        `isolated publication target-task diff for ${table}`,
        true,
      );
      if ("error" in rows) return rows;
      targetRows.push(...rows.rows.map((row) => ({ table_name: table, ...row })));
    }

    const relatedView: Record<string, JsonRecord[]> = {};
    for (const table of ["comments", "labels", "dependencies"] as const) {
      const columns = BEADS_TASK_RELATED_DIFF_COLUMNS[table];
      const predicates = columns.map((column) => `${column} = '${quotedTaskId}'`);
      const rows = runRows(
        `SELECT * FROM ${table} WHERE ${predicates.join(" OR ")}`,
        `isolated published task ${table} query`,
        true,
      );
      if ("error" in rows) return rows;
      relatedView[table] = rows.rows;
    }

    return {
      value: {
        revision: publishedRevision,
        task: {
          taskId: published.id as string,
          title: published.title as string,
          nativeStatus: published.status as string,
          canonicalStatus: publishedCanonicalStatus,
          nativeView: { issue: published, related: relatedView },
        },
        diff: {
          fromRevision,
          toRevision: publishedRevision,
          summary: summaryRows.rows,
          targetTaskRows: targetRows,
        },
      },
    };
  } finally {
    rmSync(proofRoot, { recursive: true, force: true });
  }
}

function readPublishedBeadsSnapshot(
  authority: BeadsWorkspaceTransportEvidence,
  fromRevision: string,
  taskId: string,
  runner: CommandRunner,
): {
  value: {
    publicationHead: string;
    revision: string;
    task: BeadsNativeTaskEvidence;
    diff: BeadsNativeDiffEvidence;
  };
} | { error: string } {
  const configured = parseJSONRecordCommand(
    "bd config get sync.remote --json",
    runner.run("bd", ["config", "get", "sync.remote", "--json"], {
      cwd: authority.projectRoot,
      allowFailure: true,
    }),
  );
  const configuredValue = "value" in configured && typeof configured.value.value === "string"
    ? normalizedDoltGitRemote(configured.value.value)
    : null;
  if ("error" in configured || configured.value.schema_version !== 1
      || configured.value.key !== "sync.remote" || configured.value.location !== "config.yaml"
      || configuredValue !== authority.remoteUrl) {
    return { error: `native sync remote changed after mutation: ${"error" in configured ? configured.error : "configured URL no longer matches prepared authority"}` };
  }

  const nativeRemotesResult = runner.run("bd", ["dolt", "remote", "list", "--json"], {
    cwd: authority.projectRoot,
    allowFailure: true,
  });
  if (nativeRemotesResult.status !== 0) {
    return { error: `native remote recheck failed: ${commandFailure("bd dolt remote list --json", nativeRemotesResult)}` };
  }
  let nativeRemotes: unknown;
  try {
    nativeRemotes = JSON.parse(nativeRemotesResult.stdout);
  } catch (error) {
    return { error: `native remote recheck returned invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!Array.isArray(nativeRemotes) || nativeRemotes.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    return { error: "native remote recheck returned an unsupported list schema" };
  }
  const matchingNativeRemotes = (nativeRemotes as JsonRecord[]).filter((row) =>
    row.name === authority.remoteName && row.status === "ok"
      && typeof row.url === "string" && typeof row.sql_url === "string"
      && normalizedDoltGitRemote(row.url) === authority.remoteUrl
      && normalizedDoltGitRemote(row.sql_url) === authority.remoteUrl);
  if (matchingNativeRemotes.length !== 1) {
    return { error: "selected native remote cardinality or identity changed after mutation" };
  }


  const repositoryRemote = runner.run("git", ["remote", "get-url", "--all", authority.remoteName], {
    cwd: authority.projectRoot,
    allowFailure: true,
  });
  const repositoryUrls = repositoryRemote.stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  if (repositoryRemote.status !== 0 || repositoryUrls.length !== 1
      || normalizedDoltGitRemote(repositoryUrls[0]) !== authority.remoteUrl) {
    return { error: `repository remote identity changed after mutation: ${commandFailure("git remote get-url --all", repositoryRemote)}` };
  }

  const readHead = () => {
    const result = runner.run("git", ["ls-remote", "--exit-code", "--refs", authority.remoteName, BEADS_DOLT_DATA_REF], {
      cwd: authority.projectRoot,
      allowFailure: true,
    });
    const match = /^([0-9a-f]{40})\trefs\/dolt\/data\n?$/.exec(result.stdout);
    return result.status === 0 && match ? { value: match[1] } : { error: commandFailure("git ls-remote refs/dolt/data", result) };
  };
  const firstHead = readHead();
  if ("error" in firstHead) return { error: `direct publication head is unavailable: ${firstHead.error}` };

  const comparison = isolatedPublishedBeadsComparison(authority, fromRevision, taskId, runner);
  if ("error" in comparison) return comparison;

  const finalHead = readHead();
  if ("error" in finalHead) return { error: `final direct publication head is unavailable: ${finalHead.error}` };
  if (finalHead.value !== firstHead.value) {
    return { error: `direct ${BEADS_DOLT_DATA_REF} changed during isolated comparison: ${firstHead.value} -> ${finalHead.value}` };
  }
  return {
    value: {
      publicationHead: finalHead.value,
      revision: comparison.value.revision,
      task: comparison.value.task,
      diff: comparison.value.diff,
    },
  };
}

/**
 * Perform one Beads-native status mutation and publish it without force.
 *
 * The existing workspace preparation is the authority preflight. The guarded
 * native mutation and supported commit may include compatible unrelated task
 * advances. Immediately after the non-force push, a disposable clone compares
 * the exact committed and published revisions, target task, and native diff.
 * Unrelated descendants are accepted; a target-task delta is preserved and
 * returned as reconciliation-required evidence. Nothing rolls back, forces,
 * overwrites, or reports exact success from stale evidence.
 */
export function mutateAndPublishBeadsTaskStatus(options: {
  projectRoot: string;
  taskId: string;
  status: CanonicalLifecycleStatus;
  commitMessage: string;
  runner?: CommandRunner;
}): BeadsTaskMutationPublication {
  const runner = options.runner ?? new ProcessCommandRunner();
  const taskId = options.taskId.trim();
  if (!taskId || taskId !== options.taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)) {
    return {
      status: "blocked", code: "task-identity", phase: "preparation",
      detail: "the requested Beads task ID is not one exact canonical ID",
      remediation: "Provide the exact canonical ID returned by `bd show <id> --json`; shorthand and whitespace are not mutation authority",
      recoverable: { kind: "clean-pre-mutation" },
    };
  }
  const commitMessage = options.commitMessage.trim();
  if (!commitMessage || /[\0\r\n]/.test(commitMessage)) {
    return {
      status: "blocked", code: "commit", phase: "preparation",
      detail: "the native Dolt commit message must be one non-empty line",
      remediation: "Provide one factual single-line commit message for `bd dolt commit -m`",
      recoverable: { kind: "clean-pre-mutation" },
    };
  }

  const prepared = prepareBeadsWorkspaceTransport(options.projectRoot, runner);
  if (prepared.status !== "ready") {
    return {
      status: "blocked", code: "preparation", phase: "preparation",
      detail: `Beads mutation preflight is blocked (${prepared.code}): ${prepared.detail}`,
      remediation: prepared.remediation,
      recoverable: { kind: "unknown" },
    };
  }
  const pre = prepared.evidence;

  const prePullTaskResult = readExactBeadsTask(pre.projectRoot, taskId, runner);
  if ("error" in prePullTaskResult) {
    return {
      status: "blocked", code: "task-identity", phase: "pre-mutation",
      detail: prePullTaskResult.error,
      remediation: "Resolve the exact canonical task before native synchronization",
      recoverable: { kind: "clean-pre-mutation", preMutationRevision: pre.revision, observedRevision: pre.revision, dirtyTableCount: 0 },
    };
  }
  if (prePullTaskResult.value.taskId !== taskId) {
    return {
      status: "blocked", code: "task-identity", phase: "pre-mutation",
      detail: `refusing to mutate: requested ${taskId} but Beads resolved canonical ID ${prePullTaskResult.value.taskId}; no mutation was attempted`,
      remediation: `Retry only with exact canonical ID ${prePullTaskResult.value.taskId} after operator review`,
      recoverable: { kind: "clean-pre-mutation", preMutationRevision: pre.revision, observedRevision: pre.revision, dirtyTableCount: 0 },
    };
  }

  const pull = runner.run("bd", ["dolt", "pull", "--remote", pre.remoteName], {
    cwd: pre.projectRoot,
    allowFailure: true,
  });
  if (pull.status !== 0) {
    const observed = observeBeadsNativeState(pre.projectRoot, pre, runner);
    return {
      status: "blocked", code: "synchronization", phase: "synchronization",
      detail: `native pull from ${pre.remoteName} failed without any Prime Claw overwrite: ${commandFailure("bd dolt pull", pull)}${"value" in observed ? `; observed revision ${observed.value.revision} with ${observed.value.dirtyTableCount} dirty table(s)` : `; ${observed.error}`}`,
      remediation: "Inspect the native pull/conflict evidence and recover the existing Beads working set through supported bd commands; never force or choose a semantic side automatically",
      recoverable: "value" in observed
        ? { kind: observed.value.dirtyTableCount > 0 ? "working-set" : "clean-pre-mutation", preMutationRevision: pre.revision, observedRevision: observed.value.revision, dirtyTableCount: observed.value.dirtyTableCount }
        : { kind: "unknown", preMutationRevision: pre.revision },
    };
  }

  const synchronized = observeBeadsNativeState(pre.projectRoot, pre, runner);
  if ("error" in synchronized) {
    return {
      status: "blocked", code: "revision", phase: "synchronization",
      detail: `native revision evidence is unavailable after pull: ${synchronized.error}`,
      remediation: "Repair the selected native server and inspect the pull result before retrying; do not mutate without an exact clean revision",
      recoverable: { kind: "unknown", preMutationRevision: pre.revision },
    };
  }
  if (synchronized.value.dirtyTableCount !== 0) {
    return {
      status: "blocked", code: "synchronization", phase: "synchronization",
      detail: `native pull left a dirty authority; prior revision ${pre.revision}, observed ${synchronized.value.revision}, dirty tables ${synchronized.value.dirtyTableCount}`,
      remediation: "Preserve and inspect the native working set before mutation; never force or choose a semantic side automatically",
      recoverable: { kind: "working-set", preMutationRevision: pre.revision, observedRevision: synchronized.value.revision, dirtyTableCount: synchronized.value.dirtyTableCount },
    };
  }

  let beforeTask = prePullTaskResult.value;
  let baseRevision = synchronized.value.revision;
  if (baseRevision !== pre.revision) {
    const synchronizedTask = readExactBeadsTask(pre.projectRoot, taskId, runner);
    const synchronizedDiff = readBeadsNativeDiff(pre.projectRoot, pre.revision, baseRevision, taskId, runner);
    if ("error" in synchronizedTask || "error" in synchronizedDiff) {
      return {
        status: "blocked", code: "synchronization", phase: "synchronization",
        detail: `synchronized revision ${baseRevision} cannot be classified exactly: ${"error" in synchronizedTask ? synchronizedTask.error : synchronizedDiff.error}`,
        remediation: "Preserve the synchronized revision and repair native task/diff reads before mutation",
        recoverable: { kind: "clean-pre-mutation", preMutationRevision: pre.revision, observedRevision: baseRevision, dirtyTableCount: 0 },
      };
    }
    if (synchronizedDiff.value.targetTaskRows.length > 0) {
      return {
        status: "reconciliation-required", code: "concurrent-same-task", phase: "mutation",
        detail: `native synchronization advanced target task ${taskId}; revision ${baseRevision} is preserved for managed reconciliation`,
        evidence: {
          provider: "beads", projectRoot: pre.projectRoot, taskId, phase: "mutation",
          preMutationRevision: pre.revision, observedRevision: baseRevision,
          taskBefore: beforeTask, taskObserved: synchronizedTask.value, diff: synchronizedDiff.value,
        },
      };
    }
    beforeTask = synchronizedTask.value;
  }

  if (beforeTask.canonicalStatus === options.status) {
    return {
      status: "blocked", code: "mutation", phase: "pre-mutation",
      detail: `Beads task ${taskId} already has canonical status ${options.status}; no mutation was attempted`,
      remediation: "Treat this as an idempotent no-op or request a different reviewed transition; do not create an empty publication commit",
      recoverable: { kind: "clean-pre-mutation", preMutationRevision: baseRevision, observedRevision: baseRevision, dirtyTableCount: 0 },
    };
  }

  const immediate = observeBeadsNativeState(pre.projectRoot, pre, runner);
  if ("error" in immediate || immediate.value.dirtyTableCount !== 0) {
    const observedRevision = "value" in immediate ? immediate.value.revision : undefined;
    const dirtyTableCount = "value" in immediate ? immediate.value.dirtyTableCount : undefined;
    return {
      status: "blocked", code: "revision", phase: "pre-mutation",
      detail: "error" in immediate
        ? `clean revision recheck failed immediately before mutation: ${immediate.error}`
        : `native working set changed immediately before mutation; revision ${observedRevision}, dirty tables ${dirtyTableCount}`,
      remediation: "Preserve and inspect the native working set before mutation; never overwrite or force",
      recoverable: {
        kind: dirtyTableCount && dirtyTableCount > 0 ? "working-set" : observedRevision ? "clean-pre-mutation" : "unknown",
        preMutationRevision: baseRevision,
        observedRevision,
        dirtyTableCount,
      },
    };
  }
  if (immediate.value.revision !== baseRevision) {
    const immediateTask = readExactBeadsTask(pre.projectRoot, taskId, runner);
    const immediateDiff = readBeadsNativeDiff(
      pre.projectRoot, baseRevision, immediate.value.revision, taskId, runner,
    );
    if ("error" in immediateTask || "error" in immediateDiff) {
      return {
        status: "blocked", code: "revision", phase: "pre-mutation",
        detail: `clean concurrent revision ${immediate.value.revision} cannot be classified exactly: ${"error" in immediateTask ? immediateTask.error : immediateDiff.error}`,
        remediation: "Preserve the clean descendant and repair exact native task/diff reads before mutation",
        recoverable: { kind: "clean-pre-mutation", preMutationRevision: baseRevision, observedRevision: immediate.value.revision, dirtyTableCount: 0 },
      };
    }
    if (immediateDiff.value.targetTaskRows.length > 0) {
      return {
        status: "reconciliation-required", code: "concurrent-same-task", phase: "mutation",
        detail: `clean concurrent revision ${immediate.value.revision} changed target task ${taskId} before mutation`,
        evidence: {
          provider: "beads", projectRoot: pre.projectRoot, taskId, phase: "mutation",
          preMutationRevision: baseRevision, observedRevision: immediate.value.revision,
          taskBefore: beforeTask, taskObserved: immediateTask.value, diff: immediateDiff.value,
        },
      };
    }
    baseRevision = immediate.value.revision;
    beforeTask = immediateTask.value;
  }

  const target = BEADS_STATUS_MAP[options.status];
  const update = runner.run("bd", [
    "--dolt-auto-commit=batch", "update", taskId,
    "--status", target.name, "--if-status", beforeTask.nativeStatus, "--json",
  ], { cwd: pre.projectRoot, allowFailure: true });
  if (update.status !== 0) {
    const observed = observeBeadsNativeState(pre.projectRoot, pre, runner);
    const observedTask = readExactBeadsTask(pre.projectRoot, taskId, runner);
    if ("value" in observed && "value" in observedTask) {
      const toRef = observed.value.dirtyTableCount > 0 ? "WORKING" : observed.value.revision;
      const concurrentDiff = readBeadsNativeDiff(pre.projectRoot, baseRevision, toRef, taskId, runner);
      if ("value" in concurrentDiff && concurrentDiff.value.targetTaskRows.length > 0) {
        return {
          status: "reconciliation-required", code: "concurrent-same-task", phase: "mutation",
          detail: `native guarded update failed after target task ${taskId} changed; the concurrent state is preserved for managed reconciliation: ${commandFailure("bd update", update)}`,
          evidence: {
            provider: "beads",
            projectRoot: pre.projectRoot,
            taskId,
            phase: "mutation",
            preMutationRevision: baseRevision,
            observedRevision: observed.value.revision,
            taskBefore: beforeTask,
            taskObserved: observedTask.value,
            diff: concurrentDiff.value,
          },
        };
      }
    }
    return {
      status: "blocked", code: "mutation", phase: "mutation",
      detail: `native guarded update failed: ${commandFailure("bd update", update)}${"value" in observed ? `; observed revision ${observed.value.revision} with ${observed.value.dirtyTableCount} dirty table(s)` : `; ${observed.error}`}`,
      remediation: "Inspect the exact native task and working set. Preserve any reported work; retry only after the status guard and semantic intent are reviewed",
      recoverable: "value" in observed
        ? { kind: observed.value.dirtyTableCount > 0 ? "working-set" : "clean-pre-mutation", preMutationRevision: baseRevision, observedRevision: observed.value.revision, dirtyTableCount: observed.value.dirtyTableCount }
        : { kind: "unknown", preMutationRevision: baseRevision },
    };
  }

  const afterResult = readExactBeadsTask(pre.projectRoot, taskId, runner);
  const afterState = observeBeadsNativeState(pre.projectRoot, pre, runner);
  if ("error" in afterResult || "error" in afterState || afterResult.value.taskId !== taskId) {
    const detail = "error" in afterResult ? afterResult.error
      : "error" in afterState ? afterState.error
      : `post-mutation task identity changed from ${taskId} to ${afterResult.value.taskId}`;
    return {
      status: "blocked", code: "mutation", phase: "mutation", detail,
      remediation: "Preserve and inspect the native task and working set; do not commit or publish without exact task/revision evidence",
      recoverable: "value" in afterState
        ? { kind: afterState.value.dirtyTableCount > 0 ? "working-set" : "unknown", preMutationRevision: baseRevision, observedRevision: afterState.value.revision, dirtyTableCount: afterState.value.dirtyTableCount }
        : { kind: "unknown", preMutationRevision: baseRevision },
    };
  }
  const afterTask = afterResult.value;

  let committedRevision: string;
  let committedTask: BeadsNativeTaskEvidence;
  let committedDiff: BeadsNativeDiffEvidence;
  let mutationWasCommittedConcurrently = false;

  if (afterState.value.revision !== baseRevision) {
    const advanceDiff = readBeadsNativeDiff(
      pre.projectRoot, baseRevision, afterState.value.revision, taskId, runner,
    );
    if ("error" in advanceDiff) {
      return {
        status: "blocked", code: "revision", phase: "mutation",
        detail: `concurrent revision ${afterState.value.revision} cannot be classified exactly: ${advanceDiff.error}`,
        remediation: "Preserve the native state and repair exact target-task diff reads before commit or push",
        recoverable: { kind: afterState.value.dirtyTableCount > 0 ? "working-set" : "local-commit", preMutationRevision: baseRevision, observedRevision: afterState.value.revision, dirtyTableCount: afterState.value.dirtyTableCount },
      };
    }
    if (advanceDiff.value.targetTaskRows.length > 0) {
      const alreadyCommittedDelta = afterState.value.dirtyTableCount === 0
        ? proveRequestedBeadsStatusDelta(advanceDiff.value, beforeTask, afterTask, target.name)
        : { error: "target task changed in HEAD while the guarded mutation remains uncommitted" };
      if ("error" in alreadyCommittedDelta) {
        return {
          status: "reconciliation-required", code: "concurrent-same-task", phase: "mutation",
          detail: `concurrent revision ${afterState.value.revision} changed target task ${taskId}: ${alreadyCommittedDelta.error}`,
          evidence: {
            provider: "beads", projectRoot: pre.projectRoot, taskId, phase: "mutation",
            preMutationRevision: baseRevision, observedRevision: afterState.value.revision,
            taskBefore: beforeTask, taskObserved: afterTask, diff: advanceDiff.value,
          },
        };
      }
      committedRevision = afterState.value.revision;
      committedTask = afterTask;
      committedDiff = advanceDiff.value;
      mutationWasCommittedConcurrently = true;
    }
  }

  if (!mutationWasCommittedConcurrently) {
    if (afterState.value.dirtyTableCount < 1) {
      return {
        status: "blocked", code: "mutation", phase: "mutation",
        detail: `guarded mutation produced no provable working set; base ${baseRevision}, observed ${afterState.value.revision}`,
        remediation: "Inspect the exact native task and retry only after the guarded transition can be proved",
        recoverable: { kind: "unknown", preMutationRevision: baseRevision, observedRevision: afterState.value.revision, dirtyTableCount: afterState.value.dirtyTableCount },
      };
    }
    const workingDiff = readBeadsNativeDiff(pre.projectRoot, "HEAD", "WORKING", taskId, runner);
    if ("error" in workingDiff) {
      return {
        status: "blocked", code: "mutation", phase: "mutation",
        detail: `native target working-set diff is unavailable: ${workingDiff.error}`,
        remediation: "Preserve the native working set and repair exact diff reads before commit",
        recoverable: { kind: "working-set", preMutationRevision: baseRevision, observedRevision: afterState.value.revision, dirtyTableCount: afterState.value.dirtyTableCount },
      };
    }
    const workingDelta = proveRequestedBeadsStatusDelta(workingDiff.value, beforeTask, afterTask, target.name);
    if ("error" in workingDelta) {
      return {
        status: "reconciliation-required", code: "concurrent-same-task", phase: "mutation",
        detail: `native working set contains a target-task change beyond the guarded lifecycle transition: ${workingDelta.error}`,
        evidence: {
          provider: "beads", projectRoot: pre.projectRoot, taskId, phase: "mutation",
          preMutationRevision: baseRevision, observedRevision: afterState.value.revision,
          taskBefore: beforeTask, taskObserved: afterTask, diff: workingDiff.value,
        },
      };
    }

    const commit = runner.run("bd", ["dolt", "commit", "-m", commitMessage], {
      cwd: pre.projectRoot,
      allowFailure: true,
    });
    if (commit.status !== 0) {
      const observed = observeBeadsNativeState(pre.projectRoot, pre, runner);
      return {
        status: "blocked", code: "commit", phase: "commit",
        detail: `native Dolt commit failed and Prime Claw left recoverable state intact: ${commandFailure("bd dolt commit", commit)}${"value" in observed ? `; observed revision ${observed.value.revision} with ${observed.value.dirtyTableCount} dirty table(s)` : `; ${observed.error}`}`,
        remediation: "Inspect the recoverable native working set or commit through supported bd commands; do not reset or rewrite history",
        recoverable: "value" in observed
          ? {
              kind: observed.value.dirtyTableCount > 0 ? "working-set" : observed.value.revision !== baseRevision ? "local-commit" : "unknown",
              preMutationRevision: baseRevision,
              observedRevision: observed.value.revision,
              dirtyTableCount: observed.value.dirtyTableCount,
            }
          : { kind: "unknown", preMutationRevision: baseRevision },
      };
    }

    const committedState = observeBeadsNativeState(pre.projectRoot, pre, runner);
    const committedTaskResult = readExactBeadsTask(pre.projectRoot, taskId, runner);
    if ("error" in committedState || "error" in committedTaskResult
        || committedState.value.revision === baseRevision || committedState.value.dirtyTableCount !== 0
        || committedTaskResult.value.taskId !== taskId) {
      const detail = "error" in committedState ? committedState.error
        : "error" in committedTaskResult ? committedTaskResult.error
        : `commit proof expected one new clean revision for task ${taskId}; observed revision ${committedState.value.revision}, dirty tables ${committedState.value.dirtyTableCount}, task ${committedTaskResult.value.taskId}`;
      return {
        status: "blocked", code: "revision", phase: "commit", detail,
        remediation: "Preserve the native working set/history and inspect the supported commit result before any push",
        recoverable: "value" in committedState
          ? { kind: committedState.value.dirtyTableCount > 0 ? "working-set" : "local-commit", preMutationRevision: baseRevision, observedRevision: committedState.value.revision, dirtyTableCount: committedState.value.dirtyTableCount }
          : { kind: "unknown", preMutationRevision: baseRevision },
      };
    }
    committedRevision = committedState.value.revision;
    committedTask = committedTaskResult.value;
    const committedDiffResult = readBeadsNativeDiff(
      pre.projectRoot, baseRevision, committedRevision, taskId, runner,
    );
    if ("error" in committedDiffResult) {
      return {
        status: "blocked", code: "revision", phase: "commit",
        detail: `native commit ${committedRevision} cannot be compared exactly: ${committedDiffResult.error}`,
        remediation: `Preserve local commit ${committedRevision} and repair native diff reads before any push`,
        recoverable: { kind: "local-commit", preMutationRevision: baseRevision, observedRevision: committedRevision, dirtyTableCount: 0 },
      };
    }
    const committedDelta = proveRequestedBeadsStatusDelta(
      committedDiffResult.value, beforeTask, committedTask, target.name,
    );
    if ("error" in committedDelta) {
      return {
        status: "reconciliation-required", code: "concurrent-same-task", phase: "commit",
        detail: `native commit ${committedRevision} contains a target-task delta beyond the guarded lifecycle transition: ${committedDelta.error}`,
        evidence: {
          provider: "beads", projectRoot: pre.projectRoot, taskId, phase: "commit",
          preMutationRevision: baseRevision, observedRevision: committedRevision,
          taskBefore: beforeTask, taskObserved: committedTask, diff: committedDiffResult.value,
        },
      };
    }
    committedDiff = committedDiffResult.value;
  }

  const prePushState = observeBeadsNativeState(pre.projectRoot, pre, runner);
  if ("error" in prePushState || prePushState.value.dirtyTableCount !== 0) {
    const observedRevision = "value" in prePushState ? prePushState.value.revision : undefined;
    const dirtyTableCount = "value" in prePushState ? prePushState.value.dirtyTableCount : undefined;
    return {
      status: "blocked", code: "revision", phase: "push",
      detail: "error" in prePushState
        ? `native state is unavailable immediately before push: ${prePushState.error}`
        : `native working set changed before push; committed ${committedRevision}, observed ${observedRevision}, dirty tables ${dirtyTableCount}`,
      remediation: `Preserve local commit ${committedRevision} and the working set. Publish only clean native revisions; never force or commit another actor's dirty work automatically`,
      recoverable: {
        kind: dirtyTableCount && dirtyTableCount > 0 ? "working-set" : "local-commit",
        preMutationRevision: baseRevision,
        observedRevision,
        dirtyTableCount,
      },
    };
  }
  if (prePushState.value.revision !== committedRevision) {
    const prePushTask = readExactBeadsTask(pre.projectRoot, taskId, runner);
    const prePushDiff = readBeadsNativeDiff(
      pre.projectRoot, committedRevision, prePushState.value.revision, taskId, runner,
    );
    if ("error" in prePushTask || "error" in prePushDiff) {
      return {
        status: "blocked", code: "revision", phase: "push",
        detail: `concurrent clean revision ${prePushState.value.revision} cannot be classified exactly: ${"error" in prePushTask ? prePushTask.error : prePushDiff.error}`,
        remediation: "Preserve the clean descendant and repair native task/diff reads before a non-force push",
        recoverable: { kind: "local-commit", preMutationRevision: baseRevision, observedRevision: prePushState.value.revision, dirtyTableCount: 0 },
      };
    }
    if (prePushDiff.value.targetTaskRows.length > 0) {
      return {
        status: "reconciliation-required", code: "concurrent-same-task", phase: "commit",
        detail: `clean descendant ${prePushState.value.revision} changed target task ${taskId} after commit ${committedRevision}; no push was attempted`,
        evidence: {
          provider: "beads",
          projectRoot: pre.projectRoot,
          taskId,
          phase: "commit",
          preMutationRevision: committedRevision,
          observedRevision: prePushState.value.revision,
          taskBefore: committedTask,
          taskObserved: prePushTask.value,
          diff: prePushDiff.value,
        },
      };
    }
  }

  let push = runner.run("bd", ["dolt", "push", "--remote", pre.remoteName, "--no-adopt"], {
    cwd: pre.projectRoot,
    allowFailure: true,
  });
  if (push.status !== 0) {
    const rejectedRemote = readPublishedBeadsSnapshot(pre, baseRevision, taskId, runner);
    if ("error" in rejectedRemote) {
      const observed = observeBeadsNativeState(pre.projectRoot, pre, runner);
      return {
        status: "blocked", code: "push", phase: "push",
        detail: `non-force push failed and remote comparison is unavailable: ${commandFailure("bd dolt push", push)}; ${rejectedRemote.error}`,
        remediation: `Preserve local commit ${committedRevision}; repair exact remote revision/task/diff reads before retrying without force`,
        recoverable: "value" in observed
          ? { kind: observed.value.dirtyTableCount > 0 ? "working-set" : "local-commit", preMutationRevision: baseRevision, observedRevision: observed.value.revision, dirtyTableCount: observed.value.dirtyTableCount }
          : { kind: "local-commit", preMutationRevision: baseRevision, observedRevision: committedRevision },
      };
    }
    if (rejectedRemote.value.diff.targetTaskRows.length > 0) {
      return {
        status: "reconciliation-required", code: "concurrent-same-task", phase: "publication-proof",
        detail: `non-force push was rejected because remote revision ${rejectedRemote.value.revision} changed target task ${taskId}; local commit ${committedRevision} and the remote descendant are preserved`,
        evidence: {
          provider: "beads", projectRoot: pre.projectRoot, taskId, phase: "publication-proof",
          preMutationRevision: baseRevision, observedRevision: rejectedRemote.value.revision,
          taskBefore: beforeTask, taskObserved: rejectedRemote.value.task, diff: rejectedRemote.value.diff,
        },
      };
    }

    const reconcilePull = runner.run("bd", ["dolt", "pull", "--remote", pre.remoteName], {
      cwd: pre.projectRoot,
      allowFailure: true,
    });
    const reconciledState = observeBeadsNativeState(pre.projectRoot, pre, runner);
    const reconciledTask = readExactBeadsTask(pre.projectRoot, taskId, runner);
    if (reconcilePull.status !== 0 || "error" in reconciledState || "error" in reconciledTask
        || reconciledState.value.dirtyTableCount !== 0 || reconciledTask.value.taskId !== taskId) {
      const stateDetail = "error" in reconciledState
        ? reconciledState.error
        : `revision ${reconciledState.value.revision}, dirty tables ${reconciledState.value.dirtyTableCount}`;
      const pullDetail = reconcilePull.status === 0 ? "native pull completed" : commandFailure("bd dolt pull", reconcilePull);
      return {
        status: "blocked", code: "synchronization", phase: "push",
        detail: `compatible remote revision ${rejectedRemote.value.revision} could not be integrated through supported native pull: ${pullDetail}; ${stateDetail}`,
        remediation: `Preserve local commit ${committedRevision} and remote revision ${rejectedRemote.value.revision}; repair the native non-conflicting pull without force or semantic side selection`,
        recoverable: "value" in reconciledState
          ? { kind: reconciledState.value.dirtyTableCount > 0 ? "working-set" : "local-commit", preMutationRevision: baseRevision, observedRevision: reconciledState.value.revision, dirtyTableCount: reconciledState.value.dirtyTableCount }
          : { kind: "local-commit", preMutationRevision: baseRevision, observedRevision: committedRevision },
      };
    }
    const integratedDiff = readBeadsNativeDiff(
      pre.projectRoot, committedRevision, reconciledState.value.revision, taskId, runner,
    );
    if ("error" in integratedDiff) {
      return {
        status: "blocked", code: "synchronization", phase: "push",
        detail: `integrated descendant cannot be compared to local commit ${committedRevision}: ${integratedDiff.error}`,
        remediation: "Preserve both native revisions and repair exact target-task diff reads before another push",
        recoverable: { kind: "local-commit", preMutationRevision: baseRevision, observedRevision: reconciledState.value.revision, dirtyTableCount: reconciledState.value.dirtyTableCount },
      };
    }
    if (integratedDiff.value.targetTaskRows.length > 0) {
      return {
        status: "reconciliation-required", code: "concurrent-same-task", phase: "publication-proof",
        detail: `native pull integrated a newer target-task change at revision ${reconciledState.value.revision}; no retry push was attempted`,
        evidence: {
          provider: "beads", projectRoot: pre.projectRoot, taskId, phase: "publication-proof",
          preMutationRevision: committedRevision, observedRevision: reconciledState.value.revision,
          taskBefore: committedTask, taskObserved: reconciledTask.value, diff: integratedDiff.value,
        },
      };
    }

    if (reconciledTask.value.title !== committedTask.title
        || reconciledTask.value.nativeStatus !== target.name
        || reconciledTask.value.canonicalStatus !== options.status) {
      return {
        status: "blocked", code: "synchronization", phase: "push",
        detail: `integrated task ${taskId} does not match requested ${target.name}/${options.status} despite an empty target-task diff`,
        remediation: "Preserve both revisions and repair inconsistent native task/diff evidence before retrying",
        recoverable: { kind: "local-commit", preMutationRevision: baseRevision, observedRevision: reconciledState.value.revision, dirtyTableCount: 0 },
      };
    }

    push = runner.run("bd", ["dolt", "push", "--remote", pre.remoteName, "--no-adopt"], {
      cwd: pre.projectRoot,
      allowFailure: true,
    });
    if (push.status !== 0) {
      const secondRemote = readPublishedBeadsSnapshot(
        pre, rejectedRemote.value.revision, taskId, runner,
      );
      if ("error" in secondRemote) {
        return {
          status: "blocked", code: "push", phase: "push",
          detail: `second non-force push failed and its newer remote cannot be compared exactly: ${commandFailure("bd dolt push", push)}; ${secondRemote.error}`,
          remediation: "Preserve the integrated local descendant and repair exact remote comparison; never force or overwrite",
          recoverable: { kind: "local-commit", preMutationRevision: baseRevision, observedRevision: reconciledState.value.revision, dirtyTableCount: 0 },
        };
      }
      if (secondRemote.value.diff.targetTaskRows.length > 0) {
        return {
          status: "reconciliation-required", code: "concurrent-same-task", phase: "publication-proof",
          detail: `second non-force push was rejected after remote revision ${secondRemote.value.revision} changed target task ${taskId}; all descendants are preserved`,
          evidence: {
            provider: "beads", projectRoot: pre.projectRoot, taskId, phase: "publication-proof",
            preMutationRevision: rejectedRemote.value.revision, observedRevision: secondRemote.value.revision,
            taskBefore: rejectedRemote.value.task, taskObserved: secondRemote.value.task,
            diff: secondRemote.value.diff,
          },
        };
      }
      return {
        status: "blocked", code: "push", phase: "push",
        detail: `second non-force push failed after another proven unrelated remote advance to ${secondRemote.value.revision}: ${commandFailure("bd dolt push", push)}`,
        remediation: "Preserve the integrated local descendant and exact remote evidence. Retry in a later managed pass; never force or overwrite a repeatedly advancing remote",
        recoverable: { kind: "local-commit", preMutationRevision: baseRevision, observedRevision: reconciledState.value.revision, dirtyTableCount: 0 },
        observedRemote: secondRemote.value,
      };
    }
  }

  const liveBefore = observeBeadsNativeState(pre.projectRoot, pre, runner);
  const liveTaskBefore = readExactBeadsTask(pre.projectRoot, taskId, runner);
  if ("error" in liveBefore || "error" in liveTaskBefore || liveBefore.value.dirtyTableCount !== 0) {
    const detail = "error" in liveBefore ? liveBefore.error
      : "error" in liveTaskBefore ? liveTaskBefore.error
      : `live working set has ${liveBefore.value.dirtyTableCount} dirty table(s)`;
    return {
      status: "blocked", code: "publication-authority", phase: "publication-proof",
      detail: `post-push live authority is not a clean comparable revision: ${detail}`,
      remediation: "Preserve the published and live descendants; repair exact clean native evidence without force or rollback",
      recoverable: "value" in liveBefore
        ? { kind: liveBefore.value.dirtyTableCount > 0 ? "working-set" : "local-commit", preMutationRevision: baseRevision, observedRevision: liveBefore.value.revision, dirtyTableCount: liveBefore.value.dirtyTableCount }
        : { kind: "unknown", preMutationRevision: baseRevision },
    };
  }
  const liveDiffResult = readBeadsNativeDiff(
    pre.projectRoot, committedRevision, liveBefore.value.revision, taskId, runner,
  );
  if ("error" in liveDiffResult) {
    return {
      status: "blocked", code: "publication-authority", phase: "publication-proof",
      detail: `post-push live descendant cannot be compared to commit ${committedRevision}: ${liveDiffResult.error}`,
      remediation: "Preserve the live descendant and repair exact native diff reads without force or rollback",
      recoverable: { kind: "local-commit", preMutationRevision: baseRevision, observedRevision: liveBefore.value.revision, dirtyTableCount: 0 },
    };
  }

  const remoteSnapshot = readPublishedBeadsSnapshot(pre, committedRevision, taskId, runner);
  if ("error" in remoteSnapshot) {
    return {
      status: "blocked", code: "publication-authority", phase: "publication-proof",
      detail: remoteSnapshot.error,
      remediation: "Preserve the published descendant; repair exact remote revision/task/diff evidence without force, rollback, or overwrite",
      recoverable: { kind: "local-commit", preMutationRevision: baseRevision, observedRevision: liveBefore.value.revision, dirtyTableCount: 0 },
    };
  }

  const liveAfter = observeBeadsNativeState(pre.projectRoot, pre, runner);
  const liveTaskAfter = readExactBeadsTask(pre.projectRoot, taskId, runner);
  if ("error" in liveAfter || "error" in liveTaskAfter
      || liveAfter.value.revision !== liveBefore.value.revision
      || liveAfter.value.dirtyTableCount !== liveBefore.value.dirtyTableCount
      || JSON.stringify(liveTaskAfter.value.nativeView) !== JSON.stringify(liveTaskBefore.value.nativeView)) {
    const stateDetail = "error" in liveAfter
      ? liveAfter.error
      : `revision ${liveAfter.value.revision}, dirty tables ${liveAfter.value.dirtyTableCount}`;
    return {
      status: "blocked", code: "publication-authority", phase: "publication-proof",
      detail: `live authority changed during isolated remote comparison; initial revision ${liveBefore.value.revision}, final ${stateDetail}`,
      remediation: "Preserve all descendants and repeat exact live/remote task and diff comparison; never report stale success",
      recoverable: "value" in liveAfter
        ? { kind: liveAfter.value.dirtyTableCount > 0 ? "working-set" : "local-commit", preMutationRevision: baseRevision, observedRevision: liveAfter.value.revision, dirtyTableCount: liveAfter.value.dirtyTableCount }
        : { kind: "unknown", preMutationRevision: baseRevision },
    };
  }

  const publicationEvidence: BeadsTaskMutationPublicationEvidence = {
    provider: "beads",
    projectRoot: pre.projectRoot,
    taskId,
    remoteName: pre.remoteName,
    publicationRef: BEADS_DOLT_DATA_REF,
    preMutationRevision: baseRevision,
    committedRevision,
    publishedRevision: remoteSnapshot.value.revision,
    publicationHead: remoteSnapshot.value.publicationHead,
    liveRevision: liveBefore.value.revision,
    liveTask: liveTaskBefore.value,
    liveDiff: liveDiffResult.value,
    taskBefore: beforeTask,
    taskAfterMutation: afterTask,
    taskAfterCommit: committedTask,
    isolatedPublishedTask: remoteSnapshot.value.task,
    committedDiff,
    publicationDiff: remoteSnapshot.value.diff,
    concurrentDescendant: remoteSnapshot.value.revision !== committedRevision,
  };

  if (liveDiffResult.value.targetTaskRows.length > 0) {
    return {
      status: "reconciliation-required", code: "concurrent-same-task", phase: "publication-proof",
      detail: `live descendant ${liveBefore.value.revision} changed target task ${taskId} after local commit ${committedRevision}; live and published authorities are preserved`,
      evidence: {
        provider: "beads", projectRoot: pre.projectRoot, taskId, phase: "publication-proof",
        preMutationRevision: committedRevision, observedRevision: liveBefore.value.revision,
        taskBefore: committedTask, taskObserved: liveTaskBefore.value,
        diff: liveDiffResult.value, publication: publicationEvidence,
      },
    };
  }
  if (remoteSnapshot.value.diff.targetTaskRows.length > 0) {
    return {
      status: "reconciliation-required", code: "concurrent-same-task", phase: "publication-proof",
      detail: `published descendant ${remoteSnapshot.value.revision} changed target task ${taskId} after local commit ${committedRevision}; the descendant is preserved for managed reconciliation`,
      evidence: {
        provider: "beads", projectRoot: pre.projectRoot, taskId, phase: "publication-proof",
        preMutationRevision: committedRevision, observedRevision: remoteSnapshot.value.revision,
        taskBefore: committedTask, taskObserved: remoteSnapshot.value.task,
        diff: remoteSnapshot.value.diff, publication: publicationEvidence,
      },
    };
  }

  if (liveTaskBefore.value.title !== committedTask.title
      || liveTaskBefore.value.nativeStatus !== target.name
      || liveTaskBefore.value.canonicalStatus !== options.status
      || remoteSnapshot.value.task.title !== committedTask.title
      || remoteSnapshot.value.task.nativeStatus !== target.name
      || remoteSnapshot.value.task.canonicalStatus !== options.status) {
    return {
      status: "blocked", code: "publication-authority", phase: "publication-proof",
      detail: `live or published task ${taskId} differs from the requested ${target.name}/${options.status} without target-task diff evidence`,
      remediation: "Preserve all descendants and repair provider-native task/diff evidence before claiming exact success",
      recoverable: { kind: "local-commit", preMutationRevision: baseRevision, observedRevision: liveBefore.value.revision, dirtyTableCount: 0 },
    };
  }

  return { status: "published", evidence: publicationEvidence };
}

/**
 * The provider-resolved task, as a discriminated native result: the Backlog
 * branch IS the existing BacklogTaskSelection plus its provider identity;
 * the Beads branch carries the validated native `bd show --json` issue view
 * (id/title/status; Beads stores no task Markdown, plan field, or references,
 * so none are invented). No provider-neutral normalized task shape exists.
 */
export type ProviderTaskResolution =
  | ({ provider: "backlog" } & BacklogTaskSelection)
  | { provider: "beads"; taskId: string; title: string; status: string; projectRoot: string };

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

/** Parse `bd show <id> --json` output into the validated native issue view. */
function parseBeadsIssueView(stdout: string, selectedTaskId: string): { taskId: string; title: string; status: string } {
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
  return { taskId: issue.id, title: issue.title, status: issue.status };
}

/** Read one Beads issue natively, with no canonical-status conversion. */
function readBeadsIssue(
  projectRoot: string,
  selectedTaskId: string,
  runner: CommandRunner,
): { taskId: string; title: string; status: string } {
  const result = runner.run("bd", ["show", selectedTaskId, "--json"], {
    cwd: projectRoot,
    allowFailure: true,
  });
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`;
    throw new Error(`Beads could not resolve ${selectedTaskId}: ${detail}`);
  }
  return parseBeadsIssueView(result.stdout, selectedTaskId);
}

/** Canonical lifecycle status for a Beads issue, at the exact use boundary. */
function beadsCanonicalStatus(taskId: string, nativeStatus: string): CanonicalLifecycleStatus {
  const canonical = Object.entries(BEADS_STATUS_MAP).find(([, mapping]) => mapping.name === nativeStatus)?.[0];
  if (!canonical) {
    throw new Error(`Beads task ${taskId} carries unmapped status ${nativeStatus}`);
  }
  return canonical as CanonicalLifecycleStatus;
}

/**
 * Resolve one explicit task through the repository's sole live provider.
 * Detection and the capability gate run before the native read; none, dual,
 * malformed, or unavailable provider evidence fails closed. The result is
 * discriminated by provider: the Backlog branch is the existing
 * BacklogTaskSelection, and the Beads branch carries the native issue view
 * with its status mapped to the canonical lifecycle (unmapped statuses fail
 * closed).
 */
export function resolveProviderTask(
  cwd: string,
  rawTaskId: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): ProviderTaskResolution | null {
  const selectedTaskId = rawTaskId.trim();
  if (!selectedTaskId || /\s/.test(selectedTaskId) || selectedTaskId.startsWith("-")) return null;

  const detection = requireLiveProvider(cwd, runner);
  checkSelectedProviderCapabilities(detection, runner);
  if (detection.evidence.provider === "backlog") {
    const selection = resolveBacklogTask(detection.projectRoot, selectedTaskId, runner);
    if (!selection) return null;
    return { provider: "backlog", ...selection };
  }
  const issue = readBeadsIssue(detection.projectRoot, selectedTaskId, runner);
  if (issue.taskId !== selectedTaskId) {
    throw new Error(`Beads resolved ${selectedTaskId} to a different task ID ${issue.taskId}`);
  }
  return {
    provider: "beads",
    taskId: issue.taskId,
    title: issue.title,
    status: beadsCanonicalStatus(issue.taskId, issue.status),
    projectRoot: detection.projectRoot,
  };
}

/**
 * Apply one canonical lifecycle status transition through the selected
 * provider's native mutation, then prove the exact task reached it by
 * re-reading natively. Identity is proven BEFORE any mutation: the task is
 * resolved natively first and the raw requested ID must equal the provider's
 * canonical ID exactly; a Beads shorthand that resolves to a different
 * (longer) canonical ID rejects with zero writes. Backlog mutates its
 * tracked Markdown task file; Beads mutates the Dolt store (no task file
 * exists). Returns the discriminated provider result exactly as re-read.
 */
export function mutateProviderTaskStatus(options: {
  projectRoot: string;
  taskId: string;
  status: CanonicalLifecycleStatus;
  note?: string;
  runner?: CommandRunner;
}): ProviderTaskResolution {
  const runner = options.runner ?? new ProcessCommandRunner();
  const detection = requireLiveProvider(options.projectRoot, runner);
  checkSelectedProviderCapabilities(detection, runner);

  // Identity proof before mutation: resolve natively and require the raw
  // requested ID to equal the provider canonical ID exactly.
  const before = detection.evidence.provider === "backlog"
    ? resolveBacklogTask(detection.projectRoot, options.taskId, runner)
    : null;
  if (detection.evidence.provider === "backlog") {
    if (!before) {
      throw new Error(`Backlog could not resolve ${options.taskId} before mutation; no writes were attempted`);
    }
    if (before.taskId !== options.taskId) {
      throw new Error(
        `refusing to mutate: requested ${options.taskId} but Backlog resolved canonical ID ${before.taskId}; no writes were attempted`,
      );
    }
  } else {
    const issue = readBeadsIssue(detection.projectRoot, options.taskId, runner);
    if (issue.taskId !== options.taskId) {
      throw new Error(
        `refusing to mutate: requested ${options.taskId} but Beads resolved canonical ID ${issue.taskId}; no writes were attempted`,
      );
    }
  }

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

/**
 * Narrow a provider resolution to the existing Backlog task-file contract.
 * File-bound lifecycle paths call this at their use boundary: a Backlog
 * result passes through unchanged, and a Beads result rejects explicitly
 * until that path's planned provider slice lands.
 */
export function requireBacklogTaskSelection(
  resolution: ProviderTaskResolution | null,
  context: string,
): BacklogTaskSelection | null {
  if (!resolution) return null;
  if (resolution.provider !== "backlog") {
    throw new Error(
      `task ${resolution.taskId} resolves through Beads; ${context} still requires `
      + "the Backlog task-file contract until its provider slice lands",
    );
  }
  return resolution;
}
