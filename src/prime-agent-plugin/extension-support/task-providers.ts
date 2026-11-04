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
import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
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
      const normalizedStore = relative(projectRoot, storePath).split(sep).join("/");
      const configuredLayout = normalizedStore === ".backlog"
        ? ".backlog"
        : normalizedStore === "backlog"
          ? "backlog"
          : "custom";
      return {
        evidence: {
          provider: "backlog",
          configPath: rootConfigPath,
          configSource: "root",
          storeDir: storePath,
          layout: configuredLayout,
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
      let metadata: BacklogConfigMetadata;
      try {
        metadata = parseBacklogConfigMetadata(readFileSync(configPath, "utf8"));
      } catch (error) {
        return {
          blocked: {
            code: "malformed-evidence",
            detail: `${dirName} folder configuration is unreadable: ${error instanceof Error ? error.message : String(error)}`,
            remediation: `Repair or remove ${relative(projectRoot, configPath)} so live provider evidence is unambiguous`,
          },
        };
      }
      if (!metadata.projectName || metadata.backlogDirectoryInvalid) {
        return {
          blocked: {
            code: "malformed-evidence",
            detail: `${relative(projectRoot, configPath)} is not valid initialized Backlog configuration${!metadata.projectName ? " (project_name is missing)" : " (backlog_directory is invalid)"}`,
            remediation: `Repair the folder configuration with the pinned backlog CLI or remove it; Prime Claw never selects malformed provider evidence`,
          },
        };
      }
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
    !identity.entry || identity.entry.isSymbolicLink() || !identity.entry.isFile()
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
 * Resolve the one native Beads authority inherited by a registered Git linked
 * worktree. `bd context` is the provider-native discovery source; ordinary Git
 * metadata independently proves the linked checkout and derives the canonical
 * primary checkout whose real `.beads` directory remains the sole authority.
 */
function scanLinkedWorktreeBeads(projectRoot: string, runner: CommandRunner): ScanResult {
  const blocked = (detail: string, remediation: string): ScanResult => ({
    blocked: { code: "malformed-evidence", detail, remediation },
  });
  const contextCommand = runner.run("bd", ["context", "--json"], { cwd: projectRoot, allowFailure: true });
  if (contextCommand.status !== 0) {
    return blocked(
      `native Beads linked-worktree context is unavailable: ${commandFailure("bd context --json", contextCommand)}`,
      "Run `bd context --json` from this registered Git linked worktree and repair its native worktree binding before retrying; do not initialize, copy, link, or redirect a second store",
    );
  }
  let context: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(contextCommand.stdout);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not a JSON object");
    context = parsed as Record<string, unknown>;
  } catch (error) {
    return blocked(
      `native Beads linked-worktree context is invalid: ${error instanceof Error ? error.message : String(error)}`,
      "Repair `bd context --json` so it returns the supported linked-worktree schema before retrying; do not create a redirect or replacement store",
    );
  }

  const gitProbe = (args: string[]) => runner.run("git", args, { cwd: projectRoot, allowFailure: true });
  const topResult = gitProbe(["rev-parse", "--show-toplevel"]);
  const gitDirResult = gitProbe(["rev-parse", "--git-dir"]);
  const commonDirResult = gitProbe(["rev-parse", "--git-common-dir"]);
  const worktreesResult = gitProbe(["worktree", "list", "--porcelain", "-z"]);
  if ([topResult, gitDirResult, commonDirResult, worktreesResult].some((result) => result.status !== 0 || !result.stdout.trim())) {
    return blocked(
      "Git could not prove this checkout's exact registered linked-worktree identity and common directory",
      "Repair the registered Git worktree so `git rev-parse --show-toplevel --git-dir --git-common-dir` and `git worktree list --porcelain -z` succeed before retrying",
    );
  }

  let canonicalLinkedRoot: string;
  let canonicalTop: string;
  let canonicalGitDir: string;
  let canonicalCommonDir: string;
  try {
    canonicalLinkedRoot = realpathSync(projectRoot);
    canonicalTop = realpathSync(resolve(projectRoot, topResult.stdout.trim()));
    canonicalGitDir = realpathSync(resolve(projectRoot, gitDirResult.stdout.trim()));
    canonicalCommonDir = realpathSync(resolve(projectRoot, commonDirResult.stdout.trim()));
  } catch {
    return blocked(
      "Git linked-worktree paths have unreadable or ambiguous canonical identity",
      "Repair the registered Git worktree and its common-directory metadata before retrying",
    );
  }

  let linkedDotGit: ReturnType<typeof lstatSync>;
  let commonEntry: ReturnType<typeof lstatSync>;
  let gitDirEntry: ReturnType<typeof lstatSync>;
  try {
    linkedDotGit = lstatSync(join(canonicalLinkedRoot, ".git"));
    commonEntry = lstatSync(canonicalCommonDir);
    gitDirEntry = lstatSync(canonicalGitDir);
  } catch {
    return blocked(
      "Git linked-worktree discovery metadata is missing or unreadable",
      "Restore the registered linked worktree's real `.git` file and common-directory entries before retrying",
    );
  }
  const primaryRoot = dirname(canonicalCommonDir);
  const expectedGitDirParent = join(canonicalCommonDir, "worktrees");
  if (canonicalTop !== canonicalLinkedRoot || canonicalGitDir === canonicalCommonDir
      || !linkedDotGit.isFile() || linkedDotGit.isSymbolicLink()
      || !commonEntry.isDirectory() || commonEntry.isSymbolicLink()
      || !gitDirEntry.isDirectory() || gitDirEntry.isSymbolicLink()
      || basename(canonicalCommonDir) !== ".git"
      || dirname(canonicalGitDir) !== expectedGitDirParent
      || !containedBy(canonicalCommonDir, canonicalGitDir)
      || primaryRoot === canonicalLinkedRoot) {
    return blocked(
      "Git metadata does not describe one real registered linked worktree beneath the canonical primary repository's common directory",
      "Repair or re-register this Git worktree from the canonical primary checkout before retrying; do not infer provider authority from placement alone",
    );
  }

  let dotGitTarget: string;
  try {
    const dotGitText = readFileSync(join(canonicalLinkedRoot, ".git"), "utf8").trim();
    const match = /^gitdir:\s*(.+)$/.exec(dotGitText);
    if (!match) throw new Error("missing gitdir target");
    dotGitTarget = realpathSync(resolve(canonicalLinkedRoot, match[1]));
  } catch {
    return blocked(
      "the linked worktree's `.git` file does not carry one readable canonical gitdir target",
      "Repair the registered Git worktree's `.git` file through ordinary Git worktree recovery before retrying",
    );
  }
  if (dotGitTarget !== canonicalGitDir) {
    return blocked(
      "the linked worktree's `.git` target does not match Git's reported git directory",
      "Repair or re-register this linked worktree before retrying; do not redirect provider authority manually",
    );
  }

  let canonicalPrimaryRoot: string;
  let primaryTop: string;
  let primaryGitDir: string;
  let primaryCommonDir: string;
  try {
    canonicalPrimaryRoot = realpathSync(primaryRoot);
    const primaryTopResult = runner.run("git", ["rev-parse", "--show-toplevel"], { cwd: primaryRoot, allowFailure: true });
    const primaryGitDirResult = runner.run("git", ["rev-parse", "--git-dir"], { cwd: primaryRoot, allowFailure: true });
    const primaryCommonResult = runner.run("git", ["rev-parse", "--git-common-dir"], { cwd: primaryRoot, allowFailure: true });
    if ([primaryTopResult, primaryGitDirResult, primaryCommonResult].some((result) => result.status !== 0 || !result.stdout.trim())) {
      throw new Error("primary Git probes failed");
    }
    primaryTop = realpathSync(resolve(primaryRoot, primaryTopResult.stdout.trim()));
    primaryGitDir = realpathSync(resolve(primaryRoot, primaryGitDirResult.stdout.trim()));
    primaryCommonDir = realpathSync(resolve(primaryRoot, primaryCommonResult.stdout.trim()));
  } catch {
    return blocked(
      "the Git common directory does not derive one readable canonical primary working tree",
      "Restore the canonical primary checkout and its common Git directory before retrying",
    );
  }
  if (canonicalPrimaryRoot !== primaryRoot || primaryTop !== primaryRoot
      || primaryGitDir !== canonicalCommonDir || primaryCommonDir !== canonicalCommonDir) {
    return blocked(
      "the derived primary checkout does not exactly own the linked worktree's common Git directory",
      "Repair the canonical primary checkout/worktree registration before retrying",
    );
  }

  const listedRoots: string[] = [];
  try {
    for (const field of worktreesResult.stdout.split("\0")) {
      if (!field.startsWith("worktree ")) continue;
      listedRoots.push(realpathSync(field.slice("worktree ".length)));
    }
  } catch {
    return blocked(
      "Git's registered worktree list contains an unreadable working-tree identity",
      "Prune or repair stale Git worktree registrations before retrying",
    );
  }
  if (listedRoots.filter((root) => root === canonicalLinkedRoot).length !== 1
      || listedRoots.filter((root) => root === canonicalPrimaryRoot).length !== 1) {
    return blocked(
      "Git does not register exactly one matching linked checkout and canonical primary checkout",
      "Repair the Git worktree registry (`git worktree list`/`git worktree prune`) before retrying",
    );
  }

  const primaryBeads = scanBeads(canonicalPrimaryRoot, runner);
  if (!primaryBeads) {
    return blocked(
      "the derived canonical primary checkout has no complete live Beads authority",
      "Restore the existing primary `.beads` Dolt store through supported Beads recovery; do not initialize or copy a store into the linked worktree",
    );
  }
  if ("blocked" in primaryBeads) return primaryBeads;
  if (primaryBeads.evidence.provider !== "beads") {
    return blocked(
      "the derived canonical primary checkout did not select Beads authority",
      "Repair the primary provider evidence before retrying from the linked worktree",
    );
  }
  const selected = primaryBeads.evidence;
  const exactContext = context.schema_version === 1
    && context.backend === "dolt"
    && typeof context.bd_version === "string" && /^\d+\.\d+\.\d+$/.test(context.bd_version)
    && typeof context.cwd_repo_root === "string" && isAbsolute(context.cwd_repo_root)
    && context.cwd_repo_root === canonicalLinkedRoot
    && typeof context.repo_root === "string" && isAbsolute(context.repo_root)
    && context.repo_root === canonicalPrimaryRoot
    && typeof context.beads_dir === "string" && isAbsolute(context.beads_dir)
    && context.beads_dir === selected.storeDir
    && context.database === selected.doltDatabase
    && context.dolt_mode === selected.doltMode
    && context.is_worktree === true
    && context.is_redirected === false;
  if (!exactContext) {
    return blocked(
      "`bd context --json` does not exactly bind this linked checkout to the derived primary repository's selected Beads store, backend, database, mode, and worktree identity",
      "Run `bd context --json` from this linked worktree and repair foreign, redirected, or mismatched native context before retrying; do not create a redirect or replacement store",
    );
  }
  return primaryBeads;
}

function linkedPrimaryRoot(projectRoot: string, runner: CommandRunner): string | null {
  const common = runner.run("git", ["rev-parse", "--git-common-dir"], { cwd: projectRoot, allowFailure: true });
  if (common.status !== 0 || !common.stdout.trim()) return null;
  try { return dirname(realpathSync(resolve(projectRoot, common.stdout.trim()))); }
  catch { return null; }
}


/** Read one exact native provider store without deciding repository-wide sole
 * authority. This narrow maintenance primitive exists only so an explicitly
 * confirmed migration can validate and reuse its already-created destination;
 * ordinary lifecycle paths must use detectTaskProvider and remain fail-closed
 * whenever both stores exist. */
export function detectExplicitTaskProvider(
  cwd: string,
  provider: TaskProviderId,
  runner: CommandRunner = new ProcessCommandRunner(),
): TaskProviderDetection {
  const project = resolveNearestProjectRoot(cwd, process.env.HOME ?? "", runner);
  const scanned = provider === "backlog" ? scanBacklog(project.root) : scanBeads(project.root, runner);
  if (!scanned) return { kind: "none", projectRoot: project.root };
  if ("blocked" in scanned) return { kind: "blocked", projectRoot: project.root, ...scanned.blocked };
  return { kind: "selected", projectRoot: project.root, evidence: scanned.evidence };
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
  const project = resolveNearestProjectRoot(cwd, process.env.HOME ?? "", runner);
  const projectRoot = project.root;
  let backlog = scanBacklog(projectRoot);
  if (backlog && "blocked" in backlog) return { kind: "blocked", projectRoot, ...backlog.blocked };

  // A linked Episode can retain code-tracked bytes for the old provider at its
  // preserved historical head after an explicit cutover. Canonical primary's
  // sole live provider is repository-global: ignore the stale linked Backlog
  // snapshot only when primary has valid Beads and no Backlog, and ignore stale
  // linked Beads metadata only when primary has valid Backlog and no Beads.
  // During the dual-store maintenance window ordinary detection stays blocked.
  const primaryRoot = project.kind === "linked-worktree" ? linkedPrimaryRoot(projectRoot, runner) : null;
  const primaryBacklog = primaryRoot ? scanBacklog(primaryRoot) : null;
  if (primaryBacklog && "blocked" in primaryBacklog) return { kind: "blocked", projectRoot, ...primaryBacklog.blocked };
  const primaryBeads = primaryRoot ? scanBeads(primaryRoot, runner) : null;
  if (primaryBeads && "blocked" in primaryBeads) return { kind: "blocked", projectRoot, ...primaryBeads.blocked };
  const primaryHasBeads = Boolean(primaryBeads);
  if (primaryBacklog && primaryBeads) {
    return {
      kind: "blocked",
      projectRoot,
      code: "dual-providers",
      detail: `canonical primary has both Backlog (${primaryBacklog.evidence.configPath}) and Beads (${primaryBeads.evidence.storeDir}) live evidence; this is an incomplete migration`,
      remediation: "Complete the provider migration so exactly one live store remains; Prime Claw blocks task lifecycle mutation from primary and linked worktrees until then",
    };
  }
  if (primaryHasBeads && !primaryBacklog) backlog = null;
  const primaryHasSoleBacklog = project.kind === "linked-worktree" && !!primaryBacklog && !primaryHasBeads;
  const linkedBeadsCandidate = project.kind === "linked-worktree" && !primaryHasSoleBacklog
    && (isFile(join(projectRoot, BEADS_DIR, "metadata.json"))
      || isFile(join(projectRoot, BEADS_DIR, "config.yaml"))
      || primaryHasBeads);
  const beads = linkedBeadsCandidate
    ? scanLinkedWorktreeBeads(projectRoot, runner)
    : primaryHasSoleBacklog ? null : scanBeads(projectRoot, runner);
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
  bdVersion?: string;
  doltVersion?: string;
  serverAuthority?: BeadsServerAuthority;
  serverHost?: string;
  serverPort?: number;
  database: string;
  branch: string;
  /** Local native HEAD at this observation, not an approval revision. */
  revision: string;
  remoteName: string;
  remoteUrl: string;
  publicationRef: typeof BEADS_DOLT_DATA_REF;
  publicationHead?: string;
  /** Present only when an actual remote Dolt revision has been observed. */
  publishedRevision?: string;
  commands: BeadsRawCommandEvidence[];
  context: JsonRecord;
  server: JsonRecord;
  serverStatus: JsonRecord;
  identity: JsonRecord;
  workingSet: unknown;
  remotes: unknown[];
  publication: BeadsPublicationRefEvidence;
}

export type BeadsWorkspaceTransportPreparation =
  | { status: "ready"; evidence: BeadsWorkspaceTransportEvidence }
  | {
      status: "blocked";
      code: "provider-authority" | "capability" | "server-mode" | "server-unavailable" | "revision" | "remote-transport" | "publication-authority";
      detail: string;
      remediation: string;
      observedRevision?: string;
      commands?: BeadsRawCommandEvidence[];
    };

/** Existing explicit migration/retained-folder proof retains its exact result. */
export type BeadsExplicitWorkspaceTransportPreparation =
  | Extract<BeadsWorkspaceTransportPreparation, { status: "blocked" }>
  | {
      status: "ready";
      evidence: BeadsWorkspaceTransportEvidence & {
        bdVersion: string; doltVersion: string;
        serverAuthority: BeadsServerAuthority; serverHost: string; serverPort: number;
        publishedRevision: string; publicationHead: string;
      };
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

export function normalizedDoltGitRemote(url: string): string | null {
  if (!url || url.includes("\0") || /[\r\n]/.test(url)) return null;
  if (/^git\+(?:https?|ssh|file):\/\//.test(url)) return url;
  if (/^(?:https?|ssh|file):\/\//.test(url)) return `git+${url}`;
  if (isAbsolute(url)) return `git+${pathToFileURL(normalize(url)).href}`;
  const scp = /^([^/:]+@[^/:]+):(.+)$/.exec(url);
  if (scp) return `git+ssh://${scp[1]}/${scp[2]}`;
  return null;
}

/**
 * Observe the selected Beads workspace and its native transport targets.
 * Native reads may exercise bd's supported auto-start. Working-set, history,
 * versions, and publication observations are facts, not lifecycle approval.
 * This path performs no remote clone or repeated stable-publication proof.
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
  return prepareSelectedBeadsWorkspaceTransport(detection.projectRoot, detection.evidence, runner);
}

/**
 * Prove one exact canonical-primary Beads store from the primary checkout or
 * one exact linked Episode while a separately verified Backlog store also
 * exists during the bounded provider-switch window. This bypasses only
 * dual-provider selection; it preserves every native authority,
 * capability, server, revision, cleanliness, remote, and publication proof.
 */
export function prepareExplicitBeadsWorkspaceTransport(
  cwd: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): BeadsExplicitWorkspaceTransportPreparation {
  const project = resolveNearestProjectRoot(cwd, process.env.HOME ?? "", runner);
  const scanned = project.kind === "linked-worktree"
    ? scanLinkedWorktreeBeads(project.root, runner)
    : scanBeads(project.root, runner);
  if (!scanned) {
    return {
      status: "blocked",
      code: "provider-authority",
      detail: "no explicit Beads store exists in the canonical primary checkout",
      remediation: "initialize the one intended destination with supported `bd init --server`, or repair the exact source store before retrying",
    };
  }
  if ("blocked" in scanned) {
    return {
      status: "blocked",
      code: "provider-authority",
      detail: `explicit Beads authority is blocked (${scanned.blocked.code}): ${scanned.blocked.detail}`,
      remediation: scanned.blocked.remediation,
    };
  }
  if (scanned.evidence.provider !== "beads") {
    return {
      status: "blocked",
      code: "provider-authority",
      detail: "explicit Beads proof resolved a different provider",
      remediation: "repair the canonical .beads authority before retrying",
    };
  }
  return prepareExplicitSelectedBeadsWorkspaceTransport(project.root, scanned.evidence, runner);
}

/**
 * Retained-folder transition and provider-migration verification only. This is
 * the pre-existing strict publication proof for those separate operations.
 * Task-native lifecycle callers use prepareBeadsWorkspaceTransport instead;
 * this helper must not become their admission or status-publication gate.
 */
function prepareExplicitSelectedBeadsWorkspaceTransport(
  projectRoot: string,
  selected: BeadsProviderEvidence,
  nativeRunner: CommandRunner,
): BeadsExplicitWorkspaceTransportPreparation {
  const commands: BeadsRawCommandEvidence[] = [];
  const runner: CommandRunner = {
    run(command, args, options) {
      const result = nativeRunner.run(command, args, options);
      commands.push(rawCommand(command, args, result));
      return result;
    },
  };
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
    && typeof context.repo_root === "string" && resolve(context.repo_root) === dirname(selected.storeDir)
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

  const branch = identity.branch.trim();
  const revision = identity.revision;
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
      observedRevision: revision,
    };
  }
  if (dirtyCommand.status !== 0 || !Array.isArray(dirtyRows)) {
    return {
      status: "blocked",
      code: "revision",
      detail: `native Dolt working-set evidence is unavailable: ${commandFailure("bd --readonly sql dolt_status", dirtyCommand)}`,
      remediation: "Repair the selected database until the read-only `dolt_status` query is available",
      observedRevision: revision,
    };
  }
  if (dirtyRows.length !== 0) {
    return {
      status: "blocked",
      code: "revision",
      detail: `the selected Dolt working set has ${dirtyRows.length} uncommitted table change(s), so HEAD is not complete publication evidence`,
      remediation: "Inspect `dolt_status`; after review, commit intended changes with `bd dolt commit -m <message>`. If the supported command rehydrates required config outside HEAD, upgrade or repair Beads before retrying; do not bypass the live server with raw Dolt",
      observedRevision: revision,
    };
  }

  const configuredRemoteCommand = runner.run("bd", ["config", "get", "sync.remote", "--json"], { cwd: projectRoot, allowFailure: true });
  const configuredRemoteResult = parseJSONRecordCommand("bd config get sync.remote --json", configuredRemoteCommand);
  if ("error" in configuredRemoteResult) {
    return {
      status: "blocked",
      code: "remote-transport",
      detail: `no exact native Dolt sync remote is available: ${configuredRemoteResult.error}`,
      remediation: "Add the repository remote with `bd dolt remote add origin <git+https-or-git+ssh-url>`, commit `.beads/config.yaml`, and publish once with `bd dolt push --remote origin`",
      observedRevision: revision,
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
      observedRevision: revision,
    };
  }

  const remotesCommand = runner.run("bd", ["dolt", "remote", "list", "--json"], { cwd: projectRoot, allowFailure: true });
  if (remotesCommand.status !== 0) {
    return {
      status: "blocked",
      code: "remote-transport",
      detail: `native Dolt remote evidence is unavailable: ${commandFailure("bd dolt remote list --json", remotesCommand)}`,
      remediation: "Repair the selected database until `bd dolt remote list --json` returns its configured remotes",
      observedRevision: revision,
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
      observedRevision: revision,
    };
  }
  if (!Array.isArray(remotes)) {
    return {
      status: "blocked",
      code: "remote-transport",
      detail: "bd dolt remote list --json returned a non-list schema",
      remediation: "Repair the pinned bd installation and rerun `bd dolt remote list --json`",
      observedRevision: revision,
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
      observedRevision: revision,
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
      observedRevision: revision,
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
      observedRevision: revision,
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
      observedRevision: revision,
    };
  }
  const publicationHead = publicationMatch[1];

  if (!/^[A-Za-z0-9_.-]+$/.test(selected.doltDatabase) || selected.doltDatabase === "." || selected.doltDatabase === "..") {
    return {
      status: "blocked",
      code: "publication-authority",
      detail: `the selected database name ${JSON.stringify(selected.doltDatabase)} cannot be materialized safely for isolated remote proof`,
      remediation: "Rename or reconfigure the Beads database through supported bd procedures, then retry",
      observedRevision: revision,
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
    ], { cwd: proofRoot, allowFailure: true });
    if (cloned.status !== 0) {
      return {
        status: "blocked",
        code: "publication-authority",
        detail: `the exact ${BEADS_DOLT_DATA_REF} authority could not be cloned in isolation: ${commandFailure("dolt clone", cloned)}`,
        remediation: `Make native Git/Dolt credentials available, verify ${BEADS_DOLT_DATA_REF}, and retry; never copy credentials into project files or use a raw live-store clone`,
      observedRevision: revision,
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
      observedRevision: revision,
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
      observedRevision: revision,
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
      observedRevision: revision,
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
      observedRevision: revision,
    };
  }
  if (liveDirtyCommand.status !== 0 || !Array.isArray(liveDirtyRows)) {
    return {
      status: "blocked",
      code: "revision",
      detail: `native Dolt working-set recheck is unavailable after isolated remote proof: ${commandFailure("bd --readonly sql dolt_status", liveDirtyCommand)}`,
      remediation: "Repair the selected database until the read-only `dolt_status` query is available and stable",
      observedRevision: revision,
    };
  }
  if (liveDirtyRows.length !== 0) {
    return {
      status: "blocked",
      code: "revision",
      detail: `the selected Dolt working set became dirty during isolated remote proof with ${liveDirtyRows.length} uncommitted table change(s)`,
      remediation: "Inspect `dolt_status`; after review, commit intended changes with `bd dolt commit -m <message>`. If the supported command rehydrates required config outside HEAD, upgrade or repair Beads before retrying; do not bypass the live server with raw Dolt",
      observedRevision: revision,
    };
  }
  if (!liveIdentityStable) {
    return {
      status: "blocked",
      code: "revision",
      detail: `the live native database/branch/revision/version changed or became unavailable during isolated remote proof; prior revision ${revision}, observed ${observedLiveRevision}`,
      remediation: "Reconcile the live selected database with its configured remote through supported `bd dolt pull`/`bd dolt push`, then retry against one stable clean revision; never force automatically",
      observedRevision: /^[0-9a-v]{32}$/.test(observedLiveRevision) ? observedLiveRevision : revision,
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
      observedRevision: revision,
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
      commands, context, server: show, serverStatus, identity,
      workingSet: dirtyRows, remotes,
      publication: { command: rawCommand("git", ["ls-remote", "--exit-code", "--refs", remoteName, BEADS_DOLT_DATA_REF], publicationRecheck), head: publicationHead },
    },
  };
}

function prepareSelectedBeadsWorkspaceTransport(
  projectRoot: string,
  selected: BeadsProviderEvidence,
  runner: CommandRunner,
): BeadsWorkspaceTransportPreparation {
  const commands: BeadsRawCommandEvidence[] = [];
  const run = (command: string, args: string[]) => {
    const result = runner.run(command, args, { cwd: projectRoot, allowFailure: true });
    commands.push(rawCommand(command, args, result));
    return result;
  };
  const blocked = (
    code: Extract<BeadsWorkspaceTransportPreparation, { status: "blocked" }>["code"],
    detail: string,
    observedRevision?: string,
  ): BeadsWorkspaceTransportPreparation => ({
    status: "blocked", code, detail,
    remediation: "Inspect the returned native observations and resolve the reported transport or targeting failure before another operation",
    observedRevision, commands,
  });

  const contextResult = parseJSONRecordCommand("bd context --json", run("bd", ["context", "--json"]));
  if ("error" in contextResult) return blocked("provider-authority", contextResult.error);
  const context = contextResult.value;
  const bdVersion = typeof context.bd_version === "string" ? context.bd_version : undefined;
  if (context.backend !== "dolt" || context.database !== selected.doltDatabase
      || typeof context.repo_root !== "string" || resolve(context.repo_root) !== dirname(selected.storeDir)
      || typeof context.cwd_repo_root !== "string" || resolve(context.cwd_repo_root) !== projectRoot
      || typeof context.beads_dir !== "string" || resolve(context.beads_dir) !== selected.storeDir) {
    return blocked("provider-authority", "`bd context --json` does not target the selected repository, .beads store, and Dolt database");
  }

  const autoStartResult = parseJSONRecordCommand(
    "bd config get dolt.auto-start --json", run("bd", ["config", "get", "dolt.auto-start", "--json"]),
  );
  if ("error" in autoStartResult) return blocked("server-mode", autoStartResult.error);
  const autoStart = typeof autoStartResult.value.value === "string"
    ? autoStartResult.value.value.trim().toLowerCase() : undefined;
  const serverAuthority = autoStart !== undefined && ["false", "0", "off"].includes(autoStart)
    ? "operator-managed" as const
    : autoStart !== undefined && ["", "true", "1", "on"].includes(autoStart)
      ? "bd-auto-start" as const : undefined;

  const showResult = parseJSONRecordCommand("bd dolt show --json", run("bd", ["dolt", "show", "--json"]));
  if ("error" in showResult) return blocked("server-unavailable", showResult.error);
  const show = showResult.value;
  if (show.database !== selected.doltDatabase) {
    return blocked("provider-authority", "`bd dolt show --json` targets a different Dolt database");
  }
  const serverHost = typeof show.host === "string" ? show.host : undefined;
  const serverPort = typeof show.port === "number" ? show.port : undefined;
  const statusResult = parseJSONRecordCommand("bd dolt status --json", run("bd", ["dolt", "status", "--json"]));
  if ("error" in statusResult) return blocked("server-unavailable", statusResult.error);
  const serverStatus = statusResult.value;
  // If native status names a server target, it must be the one just observed.
  if ((serverStatus.database !== undefined && serverStatus.database !== selected.doltDatabase)
      || (serverStatus.host !== undefined && serverStatus.host !== serverHost)
      || (serverStatus.port !== undefined && serverStatus.port !== serverPort)) {
    return blocked("provider-authority", "`bd dolt status --json` names a different server or database");
  }
  if (serverAuthority === "bd-auto-start" && typeof serverStatus.data_dir === "string") {
    const expectedDataDir = join(selected.storeDir, "dolt");
    try {
      if (realpathSync(serverStatus.data_dir) !== realpathSync(expectedDataDir)) {
        return blocked("provider-authority", "the native server data directory is not the selected store's directory");
      }
    } catch (error) {
      return blocked("provider-authority", `native server data-directory identity is unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const identityQuery = "SELECT database() AS database_name, active_branch() AS branch, dolt_hashof('HEAD') AS revision, dolt_version() AS dolt_version";
  const identityCommand = run("bd", ["--readonly", "sql", "--json", identityQuery]);
  if (identityCommand.status !== 0) return blocked("revision", commandFailure("bd --readonly sql identity", identityCommand));
  let identityRows: unknown;
  try {
    identityRows = JSON.parse(identityCommand.stdout);
  } catch (error) {
    return blocked("revision", `native identity returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const identity = Array.isArray(identityRows) && identityRows.length === 1 ? identityRows[0] as JsonRecord : null;
  if (!identity || identity.database_name !== selected.doltDatabase
      || typeof identity.branch !== "string" || !identity.branch.trim()
      || typeof identity.revision !== "string" || !/^[0-9a-v]{32}$/.test(identity.revision)) {
    return blocked("revision", "native identity did not identify the selected database, branch, and HEAD");
  }
  const doltVersion = typeof identity.dolt_version === "string" ? identity.dolt_version : undefined;
  const branch = identity.branch;
  const revision = identity.revision;
  const workingSetCommand = run("bd", ["--readonly", "sql", "--json", "SELECT table_name, staged, status FROM dolt_status ORDER BY table_name"]);
  if (workingSetCommand.status !== 0) return blocked("revision", commandFailure("bd --readonly sql dolt_status", workingSetCommand), revision);
  // Preserve the complete native working-set observation without a cleanliness
  // predicate. Native update/commit isolation is not established by this read.
  let workingSet: unknown;
  try {
    workingSet = JSON.parse(workingSetCommand.stdout);
  } catch (error) {
    return blocked("revision", `native working set returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`, revision);
  }

  const configuredResult = parseJSONRecordCommand(
    "bd config get sync.remote --json", run("bd", ["config", "get", "sync.remote", "--json"]),
  );
  if ("error" in configuredResult) return blocked("remote-transport", configuredResult.error, revision);
  const configuredRemote = typeof configuredResult.value.value === "string"
    ? normalizedDoltGitRemote(configuredResult.value.value.trim()) : null;
  if (!configuredRemote) return blocked("remote-transport", "native sync.remote does not name a supported Git remote URL or absolute path", revision);
  const remotesCommand = run("bd", ["dolt", "remote", "list", "--json"]);
  if (remotesCommand.status !== 0) return blocked("remote-transport", commandFailure("bd dolt remote list --json", remotesCommand), revision);
  let remotes: unknown;
  try {
    remotes = JSON.parse(remotesCommand.stdout);
  } catch (error) {
    return blocked("remote-transport", `native remote list returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`, revision);
  }
  if (!Array.isArray(remotes)) return blocked("remote-transport", "native remote list is not an array", revision);
  const matches = remotes.filter((row): row is JsonRecord => row !== null && typeof row === "object"
    && typeof row.name === "string" && row.name.trim().length > 0
    && typeof row.url === "string" && normalizedDoltGitRemote(row.url) === configuredRemote
    && (row.sql_url === undefined || (typeof row.sql_url === "string" && normalizedDoltGitRemote(row.sql_url) === configuredRemote)));
  if (matches.length !== 1) return blocked("remote-transport", "native sync.remote does not select exactly one native Dolt remote", revision);
  const remoteName = matches[0].name as string;
  const gitRemoteCommand = run("git", ["remote", "get-url", "--all", remoteName]);
  const gitUrls = gitRemoteCommand.stdout.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
  if (gitRemoteCommand.status !== 0 || gitUrls.length !== 1 || normalizedDoltGitRemote(gitUrls[0]) !== configuredRemote) {
    return blocked("publication-authority", "the named Git remote does not identify the selected native Dolt transport", revision);
  }
  const publication = readBeadsPublicationRef(projectRoot, remoteName, runner);
  commands.push(publication.command);
  // A missing or unavailable publication ref is an observation, not a hidden
  // prerequisite for a native pull/push. No remote Dolt revision is invented.
  return {
    status: "ready",
    evidence: {
      provider: "beads", projectRoot, storeDir: selected.storeDir,
      bdVersion, doltVersion, serverAuthority, serverHost, serverPort,
      database: selected.doltDatabase, branch, revision, remoteName,
      remoteUrl: configuredRemote, publicationRef: BEADS_DOLT_DATA_REF,
      publicationHead: publication.head, commands, context, server: show,
      serverStatus, identity, workingSet, remotes, publication,
    },
  };
}

export interface BeadsRawCommandEvidence {
  command: string;
  args: string[];
  status: number;
  stdout: string;
  stderr: string;
}

export interface BeadsNativeTaskSnapshot {
  taskId: string;
  title?: string;
  nativeStatus?: string;
  canonicalStatus?: CanonicalLifecycleStatus;
  nativeView: JsonRecord;
}

export interface BeadsNativeTaskReadEvidence {
  command: BeadsRawCommandEvidence;
  task?: BeadsNativeTaskSnapshot;
  error?: string;
}

export interface BeadsPublicationRefEvidence {
  command: BeadsRawCommandEvidence;
  head?: string;
  error?: string;
}

export interface BeadsRemoteTaskSnapshotEvidence {
  publicationHead?: string;
  revision?: string;
  taskRow?: JsonRecord;
  comments?: JsonRecord[];
  refBefore: BeadsPublicationRefEvidence;
  clone?: BeadsRawCommandEvidence;
  identity?: BeadsRawCommandEvidence;
  task?: BeadsRawCommandEvidence;
  commentRead?: BeadsRawCommandEvidence;
  refAfter?: BeadsPublicationRefEvidence;
  error?: string;
}

export interface BeadsMutationRevisionEvidence {
  revision?: string;
  parentRevision?: string;
  clean?: boolean;
  command: BeadsRawCommandEvidence;
  nativeView?: JsonRecord;
  error?: string;
}

export interface BeadsTaskMutationPublishedEvidence {
  provider: "beads";
  projectRoot: string;
  taskId: string;
  remoteName: string;
  publicationRef: typeof BEADS_DOLT_DATA_REF;
  preparedRevision: string;
  committedRevision: string;
  /** Submitted local HEAD for the successful native push, not isolated remote proof. */
  publishedRevision: string;
  publicationHead?: string;
  taskBefore: BeadsNativeTaskSnapshot;
  taskPublished: BeadsNativeTaskSnapshot;
  postMutationProof: BeadsMutationRevisionEvidence;
  localPublishedProof: BeadsMutationRevisionEvidence;
  remotePublishedTask?: BeadsRemoteTaskSnapshotEvidence;
  pull: BeadsRawCommandEvidence;
  mutation: BeadsRawCommandEvidence;
  push: BeadsRawCommandEvidence;
  commands: BeadsRawCommandEvidence[];
  taskReads: BeadsNativeTaskReadEvidence[];
  publication: BeadsPublicationRefEvidence;
}

export interface BeadsTaskMutationReviewEvidence {
  provider: "beads";
  projectRoot: string;
  taskId: string;
  commands?: BeadsRawCommandEvidence[];
  preparation?: BeadsWorkspaceTransportPreparation;
  prepared?: BeadsWorkspaceTransportEvidence;
  preparedRevision?: string;
  observedRevision?: string;
  revisionProof?: BeadsMutationRevisionEvidence;
  taskBefore?: BeadsNativeTaskReadEvidence;
  taskObserved?: BeadsNativeTaskReadEvidence;
  operation?: BeadsRawCommandEvidence;
  diff?: BeadsRawCommandEvidence;
  publicationRef?: BeadsPublicationRefEvidence;
  remoteTask?: BeadsRemoteTaskSnapshotEvidence;
}

export type BeadsTaskMutationPublication =
  | { status: "published"; evidence: BeadsTaskMutationPublishedEvidence }
  | {
      status: "review-required";
      code: "synchronization-failed" | "mutation-failed" | "push-rejected" | "publication-proof-failed";
      phase: "synchronization" | "mutation" | "push" | "publication-proof";
      detail: string;
      evidence: BeadsTaskMutationReviewEvidence;
    }
  | {
      status: "blocked";
      code: "preparation" | "task-identity";
      detail: string;
      evidence: BeadsTaskMutationReviewEvidence;
    };

const BEADS_MUTATION_REVISION_QUERY = "SELECT database() AS database_name, active_branch() AS branch, dolt_hashof('HEAD') AS revision, (SELECT COUNT(*) FROM dolt_status) AS status_count";

function rawCommand(
  command: string,
  args: string[],
  result: { stdout: string; stderr: string; status: number },
): BeadsRawCommandEvidence {
  return { command, args: [...args], status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function readExactBeadsTaskEvidence(
  projectRoot: string,
  taskId: string,
  runner: CommandRunner,
): BeadsNativeTaskReadEvidence {
  const args = ["show", taskId, "--json", "--long", "--include-comments"];
  const result = runner.run("bd", args, { cwd: projectRoot, allowFailure: true });
  const command = rawCommand("bd", args, result);
  if (result.status !== 0) return { command, error: commandFailure(`bd show ${taskId}`, result) };
  try {
    const parsed: unknown = JSON.parse(result.stdout);
    if (!Array.isArray(parsed) || parsed.length !== 1 || !parsed[0]
        || typeof parsed[0] !== "object" || Array.isArray(parsed[0])) {
      return { command, error: `bd show ${taskId} did not return one native task object` };
    }
    const nativeView = parsed[0] as JsonRecord;
    if (nativeView.id !== taskId) return { command, error: `bd show ${taskId} resolved a different or absent canonical task ID` };
    const nativeStatus = typeof nativeView.status === "string" ? nativeView.status : undefined;
    const canonicalStatus = Object.entries(BEADS_STATUS_MAP).find(([, mapping]) => mapping.name === nativeStatus)?.[0] as CanonicalLifecycleStatus | undefined;
    return {
      command,
      task: {
        taskId, nativeView,
        ...(typeof nativeView.title === "string" ? { title: nativeView.title } : {}),
        ...(nativeStatus !== undefined ? { nativeStatus } : {}),
        ...(canonicalStatus !== undefined ? { canonicalStatus } : {}),
      },
    };
  } catch (error) {
    return { command, error: `bd show ${taskId} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function readBeadsMutationRevision(
  projectRoot: string,
  expected: Pick<BeadsWorkspaceTransportEvidence, "database" | "branch">,
  runner: CommandRunner,
): BeadsMutationRevisionEvidence {
  const args = ["--readonly", "sql", "--json", BEADS_MUTATION_REVISION_QUERY];
  const result = runner.run("bd", args, { cwd: projectRoot, allowFailure: true });
  const command = rawCommand("bd", args, result);
  if (result.status !== 0) return { command, error: commandFailure("bd --readonly sql native revision", result) };
  try {
    const parsed: unknown = JSON.parse(result.stdout);
    const row = Array.isArray(parsed) && parsed.length === 1 && parsed[0]
      && typeof parsed[0] === "object" && !Array.isArray(parsed[0]) ? parsed[0] as JsonRecord : null;
    if (!row || row.database_name !== expected.database || row.branch !== expected.branch
        || typeof row.revision !== "string" || !/^[0-9a-v]{32}$/.test(row.revision)) {
      return { command, error: "native revision observation did not identify the selected database, branch, and HEAD" };
    }
    return {
      command, nativeView: row, revision: row.revision,
      ...(typeof row.parent_revision === "string" ? { parentRevision: row.parent_revision } : {}),
      ...(typeof row.status_count === "number" ? { clean: row.status_count === 0 } : {}),
    };
  } catch (error) {
    return { command, error: `native revision returned invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function readBeadsPublicationRef(
  projectRoot: string,
  remoteName: string,
  runner: CommandRunner,
): BeadsPublicationRefEvidence {
  const args = ["ls-remote", "--exit-code", "--refs", remoteName, BEADS_DOLT_DATA_REF];
  const result = runner.run("git", args, { cwd: projectRoot, allowFailure: true });
  const command = rawCommand("git", args, result);
  const lines = result.stdout.split(/\r?\n/).filter(Boolean);
  const match = lines.length === 1 ? /^([0-9a-f]{40})\s+refs\/dolt\/data$/.exec(lines[0]) : null;
  if (result.status !== 0 || !match) {
    return { command, error: commandFailure(`git ls-remote ${remoteName} ${BEADS_DOLT_DATA_REF}`, result) };
  }
  return { command, head: match[1] };
}

/**
 * Run the requested native update and one pull/push. Raw observations describe
 * what happened; they do not approve status, content, history, or cleanliness.
 * Only an explicitly supplied native ifStatus requests a conditional update.
 * A native failure is returned without repair, retry, force, or another clone.
 */
export function mutateAndPublishBeadsTaskStatus(options: {
  projectRoot: string;
  taskId: string;
  status: CanonicalLifecycleStatus;
  ifStatus?: string;
  note?: string;
  runner?: CommandRunner;
}): BeadsTaskMutationPublication {
  const runner = options.runner ?? new ProcessCommandRunner();
  const taskId = options.taskId.trim();
  const commands: BeadsRawCommandEvidence[] = [];
  const baseEvidence: BeadsTaskMutationReviewEvidence = {
    provider: "beads", projectRoot: resolve(options.projectRoot), taskId, commands,
  };
  if (!taskId || taskId !== options.taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)) {
    return { status: "blocked", code: "task-identity", detail: "the requested Beads task ID is not one exact canonical ID", evidence: baseEvidence };
  }
  const preparation = prepareBeadsWorkspaceTransport(options.projectRoot, runner);
  if (preparation.status !== "ready") {
    commands.push(...preparation.commands ?? []);
    return {
      status: "blocked", code: "preparation", detail: preparation.detail,
      evidence: { ...baseEvidence, preparation },
    };
  }
  const prepared = preparation.evidence;
  commands.push(...prepared.commands);
  const evidence = { ...baseEvidence, projectRoot: prepared.projectRoot, prepared, preparedRevision: prepared.revision };
  const taskReads: BeadsNativeTaskReadEvidence[] = [];
  const readTask = () => {
    const read = readExactBeadsTaskEvidence(prepared.projectRoot, taskId, runner);
    commands.push(read.command);
    taskReads.push(read);
    return read;
  };
  const readRevision = () => {
    const read = readBeadsMutationRevision(prepared.projectRoot, prepared, runner);
    commands.push(read.command);
    return read;
  };
  const run = (args: string[]) => {
    const result = runner.run("bd", args, { cwd: prepared.projectRoot, allowFailure: true });
    const raw = rawCommand("bd", args, result);
    commands.push(raw);
    return raw;
  };
  const before = readTask();
  if (!before.task) {
    return { status: "blocked", code: "task-identity", detail: before.error ?? "exact native task is unavailable", evidence: { ...evidence, taskBefore: before } };
  }
  const pull = run(["dolt", "pull", "--remote", prepared.remoteName]);
  if (pull.status !== 0) {
    return {
      status: "review-required", code: "synchronization-failed", phase: "synchronization",
      detail: "the single native pull failed; no mutation was attempted",
      evidence: { ...evidence, taskBefore: before, operation: pull },
    };
  }
  const synchronized = readRevision();
  const afterPull = readTask();
  if (!synchronized.revision || !afterPull.task) {
    return {
      status: "review-required", code: "synchronization-failed", phase: "synchronization",
      detail: synchronized.error ?? afterPull.error ?? "native synchronization readback is unavailable",
      evidence: { ...evidence, observedRevision: synchronized.revision, revisionProof: synchronized, taskBefore: before, taskObserved: afterPull, operation: pull },
    };
  }
  const mutationArgs = ["--dolt-auto-commit=on", "update", taskId, "--status", BEADS_STATUS_MAP[options.status].name];
  if (options.ifStatus !== undefined) mutationArgs.push("--if-status", options.ifStatus);
  if (options.note !== undefined) mutationArgs.push("--append-notes", options.note);
  mutationArgs.push("--json");
  const mutation = run(mutationArgs);
  const committed = readRevision();
  const afterMutation = readTask();
  if (mutation.status !== 0 || !committed.revision || !afterMutation.task) {
    return {
      status: "review-required", code: "mutation-failed", phase: "mutation",
      detail: mutation.status !== 0 ? "the native requested update failed" : committed.error ?? afterMutation.error ?? "native update readback is unavailable",
      evidence: { ...evidence, observedRevision: committed.revision, revisionProof: committed, taskBefore: afterPull, taskObserved: afterMutation, operation: mutation },
    };
  }
  const push = run(["dolt", "push", "--remote", prepared.remoteName, "--no-adopt"]);
  if (push.status !== 0) {
    return {
      status: "review-required", code: "push-rejected", phase: "push",
      detail: "the single native push failed; no retry, repair, reset, or force was attempted",
      evidence: { ...evidence, observedRevision: committed.revision, revisionProof: committed, taskBefore: afterPull, taskObserved: afterMutation, operation: push },
    };
  }
  const publishedTask = readTask();
  const published = readRevision();
  const publication = readBeadsPublicationRef(prepared.projectRoot, prepared.remoteName, runner);
  commands.push(publication.command);
  if (!published.revision || !publishedTask.task) {
    return {
      status: "review-required", code: "publication-proof-failed", phase: "publication-proof",
      detail: published.error ?? publishedTask.error ?? "native readback after the successful push is unavailable",
      evidence: { ...evidence, observedRevision: published.revision, revisionProof: published, taskBefore: afterPull, taskObserved: publishedTask, operation: push, publicationRef: publication },
    };
  }
  return {
    status: "published",
    evidence: {
      provider: "beads", projectRoot: prepared.projectRoot, taskId, remoteName: prepared.remoteName,
      publicationRef: BEADS_DOLT_DATA_REF, preparedRevision: prepared.revision,
      // The submitted local HEAD for the successful native push. This is
      // not an isolated remote revision or a content-approval proof.
      committedRevision: committed.revision, publishedRevision: committed.revision,
      publicationHead: publication.head,
      taskBefore: before.task, taskPublished: publishedTask.task,
      postMutationProof: committed, localPublishedProof: published,
      pull, mutation, push, commands, taskReads, publication,
    },
  };
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
  | {
      provider: "beads";
      taskId: string;
      title: string;
      nativeStatus: string;
      status: string;
      projectRoot: string;
      nativeView: JsonRecord;
    };

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

/** Parse the exact long `bd show` response and retain its raw task object verbatim. */
function parseBeadsIssueView(
  stdout: string,
  selectedTaskId: string,
): { taskId: string; title: string; status: string; nativeView: JsonRecord } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Beads returned invalid JSON for ${selectedTaskId}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Array.isArray(parsed) || parsed.length !== 1 || !parsed[0]
      || typeof parsed[0] !== "object" || Array.isArray(parsed[0])) {
    throw new Error(`Beads returned an unsupported task-view schema for ${selectedTaskId}`);
  }
  const issue = parsed[0] as JsonRecord;
  if (typeof issue.id !== "string" || !issue.id.trim()) {
    throw new Error(`Beads returned no canonical task ID for ${selectedTaskId}`);
  }
  if (typeof issue.title !== "string" || !issue.title.trim()) {
    throw new Error(`Beads task ${selectedTaskId} has no title`);
  }
  if (typeof issue.status !== "string" || !issue.status.trim()) {
    throw new Error(`Beads task ${selectedTaskId} has no status`);
  }
  return { taskId: issue.id, title: issue.title, status: issue.status, nativeView: issue };
}

/** Read one exact Beads issue natively, with no canonical-status conversion. */
function readBeadsIssue(
  projectRoot: string,
  selectedTaskId: string,
  runner: CommandRunner,
): { taskId: string; title: string; status: string; nativeView: JsonRecord } {
  const result = runner.run("bd", ["show", selectedTaskId, "--json", "--long", "--include-comments"], {
    cwd: projectRoot,
    allowFailure: true,
  });
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`;
    throw new Error(`Beads could not resolve ${selectedTaskId}: ${detail}`);
  }
  return parseBeadsIssueView(result.stdout, selectedTaskId);
}

/** Exact provider-native Beads task read without canonical status conversion. */
export type BeadsNativeTaskResolution = {
  provider: "beads";
  taskId: string;
  title: string;
  nativeStatus: string;
  projectRoot: string;
  nativeView: JsonRecord;
};

export function readBeadsNativeTask(
  cwd: string,
  rawTaskId: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): BeadsNativeTaskResolution {
  const taskId = rawTaskId.trim();
  if (!taskId || taskId !== rawTaskId || /\s/.test(taskId) || taskId.startsWith("-")) {
    throw new Error("Beads native task read requires one exact canonical task ID");
  }
  const projectRoot = resolve(cwd);
  const issue = readBeadsIssue(projectRoot, taskId, runner);
  if (issue.taskId !== taskId) {
    throw new Error(`Beads resolved ${taskId} to a different task ID ${issue.taskId}`);
  }
  return {
    provider: "beads",
    taskId: issue.taskId,
    title: issue.title,
    nativeStatus: issue.status,
    projectRoot,
    nativeView: issue.nativeView,
  };
}

/**
 * Read one explicit task through the detected native provider. No capability,
 * preparation, synchronization, or lifecycle-eligibility operation is implied.
 * Beads keeps the complete raw view and native status, including statuses with
 * no canonical alias. Existing callers retain the known canonical aliases.
 */
export function resolveProviderTask(
  cwd: string,
  rawTaskId: string,
  runner: CommandRunner = new ProcessCommandRunner(),
): ProviderTaskResolution | null {
  const selectedTaskId = rawTaskId.trim();
  if (!selectedTaskId || /\s/.test(selectedTaskId) || selectedTaskId.startsWith("-")) return null;

  const detection = requireLiveProvider(cwd, runner);
  if (detection.evidence.provider === "backlog") {
    const selection = resolveBacklogTask(detection.projectRoot, selectedTaskId, runner);
    if (!selection) return null;
    return { provider: "backlog", ...selection };
  }
  const issue = readBeadsNativeTask(detection.projectRoot, selectedTaskId, runner);
  return {
    ...issue,
    status: Object.entries(BEADS_STATUS_MAP).find(([, mapping]) => mapping.name === issue.nativeStatus)?.[0]
      ?? issue.nativeStatus,
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
