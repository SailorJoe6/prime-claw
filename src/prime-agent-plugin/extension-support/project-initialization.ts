import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const TEMPLATE_MANIFEST = ".prime-claw/templates.json";
export const TEMPLATE_REVIEW_STATE = ".prime-claw/template-review.json";
const RECONCILE_LOCK = ".prime-claw/reconcile.lock";
const RESET_INTENT = ".prime-claw/reset-intent.json";
const INVENTORY_FILE = "asset-inventory.json";
const SCHEMA_VERSION = 1;

export type AssetScope = "global" | "project";
export type AssetExposure = "discoverable" | "internal";
export type AssetCustomization = "plugin-managed" | "project-customizable";
export type TemplateState = "managed" | "customized" | "accepted-override";

export interface AssetDefinition {
  id: string;
  source: string;
  scope: AssetScope;
  exposure: AssetExposure;
  customization: AssetCustomization;
  destination: string;
  lifecycleTrigger: string;
}

export interface AssetInventory {
  schemaVersion: 1;
  assets: AssetDefinition[];
}

export interface TemplateEntry {
  source: string;
  destination: string;
  baselineSha256: string | null;
  installedSha256: string;
  acceptedOverrideSha256: string | null;
  availableUpstreamSha256: string;
  state: TemplateState;
  provenance: {
    scope: AssetScope;
    exposure: AssetExposure;
    customization: AssetCustomization;
    lifecycleTrigger: string;
  };
}

export interface TemplateManifest {
  schemaVersion: 1;
  assets: Record<string, TemplateEntry>;
}

export interface ReconcileItem {
  assetId: string;
  destination: string;
  action: "created" | "migrated" | "updated" | "recovered" | "unchanged" | "preserved" | "blocked";
  reason?: string;
}

export interface ProjectRoot {
  root: string;
  kind: "repository" | "nested-repository" | "submodule" | "linked-worktree";
}

export interface OrcaRegistration {
  id: string;
  path: string;
  [key: string]: unknown;
}

export interface CommandRunner {
  run(command: string, args: string[], options?: { cwd?: string; allowFailure?: boolean }): { stdout: string; stderr: string; status: number };
}

export interface ReconcileOptions {
  cwd: string;
  pluginRoot?: string;
  home?: string;
  runner?: CommandRunner;
  registerOrca?: boolean;
  requireOrcaRegistration?: boolean;
  isActiveEpisode?: (projectRoot: string) => boolean;
}

export interface ReconcileResult {
  project: ProjectRoot;
  registration: { status: "reused" | "added" | "unavailable" | "not-requested"; id?: string; error?: string };
  items: ReconcileItem[];
  manifestWritten: boolean;
  changed: boolean;
  conflicts: number;
  legacyRemaining: string[];
  skippedActiveEpisode: boolean;
  skipReason?: "active-episode" | "uncertain-episode-activity";
}

export class ProcessCommandRunner implements CommandRunner {
  run(command: string, args: string[], options: { cwd?: string; allowFailure?: boolean } = {}) {
    try {
      const stdout = execFileSync(command, args, {
        cwd: options.cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { stdout, stderr: "", status: 0 };
    } catch (error: any) {
      const result = {
        stdout: String(error?.stdout ?? ""),
        stderr: String(error?.stderr ?? error?.message ?? error),
        status: Number.isInteger(error?.status) ? error.status : 1,
      };
      if (!options.allowFailure) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr.trim() || `exit ${result.status}`}`);
      return result;
    }
  }
}

function digest(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function containedBy(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function jsonObject(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object`);
  return value as Record<string, any>;
}

function parseJson(text: string, label: string): any {
  try { return JSON.parse(text); } catch (error) { throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`); }
}

function pluginRootFromModule(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

function assertRelativeFilePath(value: string, label: string): void {
  if (!value || isAbsolute(value) || value.split(/[\\/]/).some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`${label} is not a safe relative path`);
  }
}

export function loadAssetInventory(pluginRoot = pluginRootFromModule()): AssetInventory {
  const raw = jsonObject(parseJson(readFileSync(join(pluginRoot, INVENTORY_FILE), "utf8"), "asset inventory"), "asset inventory");
  if (raw.schemaVersion !== SCHEMA_VERSION || !Array.isArray(raw.assets)) throw new Error("unsupported asset inventory schema");
  const ids = new Set<string>();
  const destinations = new Set<string>();
  const assets = raw.assets.map((item: unknown) => {
    const asset = jsonObject(item, "asset");
    for (const key of ["id", "source", "scope", "exposure", "customization", "destination", "lifecycleTrigger"]) {
      if (typeof asset[key] !== "string" || !asset[key]) throw new Error(`asset ${String(asset.id ?? "<unknown>")} has invalid ${key}`);
    }
    assertRelativeFilePath(asset.source, `asset ${asset.id} source`);
    assertRelativeFilePath(asset.destination, `asset ${asset.id} destination`);
    if (!(["global", "project"] as string[]).includes(asset.scope)
      || !(["discoverable", "internal"] as string[]).includes(asset.exposure)
      || !(["plugin-managed", "project-customizable"] as string[]).includes(asset.customization)) {
      throw new Error(`asset ${asset.id} has invalid metadata`);
    }
    if (ids.has(asset.id) || destinations.has(asset.destination)) throw new Error(`asset inventory repeats ${asset.id} or ${asset.destination}`);
    ids.add(asset.id); destinations.add(asset.destination);
    const source = join(pluginRoot, asset.source);
    const sourceStat = lstatSync(source);
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) throw new Error(`asset ${asset.id} source is not a regular file`);
    return asset as AssetDefinition;
  });
  return { schemaVersion: SCHEMA_VERSION, assets };
}

function runGit(runner: CommandRunner, cwd: string, args: string[], allowFailure = false) {
  return runner.run("git", ["-C", cwd, ...args], { allowFailure });
}

export function resolveNearestProjectRoot(start: string, home = process.env.HOME ?? "", runner: CommandRunner = new ProcessCommandRunner()): ProjectRoot {
  const startReal = realpathSync(resolve(start));
  const homeReal = home && existsSync(home) ? realpathSync(resolve(home)) : resolve(home || "/__prime_claw_no_home__");
  if (startReal === homeReal) throw new Error("Prime Claw initialization refuses the user's HOME as a project root");
  const probe = runGit(runner, startReal, ["rev-parse", "--show-toplevel"], true);
  if (probe.status !== 0 || !probe.stdout.trim()) throw new Error("No Git worktree exists before the user's HOME boundary");
  const root = realpathSync(probe.stdout.trim());
  if (root === homeReal || (containedBy(root, homeReal) && containedBy(homeReal, startReal))) {
    throw new Error("Git discovery reached the user's HOME boundary before a project root");
  }
  const gitDirRaw = runGit(runner, root, ["rev-parse", "--git-dir"]).stdout.trim();
  const commonRaw = runGit(runner, root, ["rev-parse", "--git-common-dir"]).stdout.trim();
  const gitDir = realpathSync(resolve(root, gitDirRaw));
  const commonDir = realpathSync(resolve(root, commonRaw));
  const superproject = runGit(runner, root, ["rev-parse", "--show-superproject-working-tree"], true).stdout.trim();
  let kind: ProjectRoot["kind"] = "repository";
  if (superproject) kind = "submodule";
  else if (gitDir !== commonDir) kind = "linked-worktree";
  else {
    const parent = dirname(root);
    if (parent !== root && parent !== homeReal) {
      const outer = runGit(runner, parent, ["rev-parse", "--show-toplevel"], true);
      if (outer.status === 0 && outer.stdout.trim() && realpathSync(outer.stdout.trim()) !== root) kind = "nested-repository";
    }
  }
  return { root, kind };
}

export function assertSafePathAncestors(projectRoot: string, path: string): void {
  if (!containedBy(projectRoot, path)) throw new Error(`destination escapes project root: ${path}`);
  const rel = relative(projectRoot, dirname(path));
  let current = projectRoot;
  for (const part of rel.split(sep).filter(Boolean)) {
    current = join(current, part);
    const stat = lstatIfPresent(current);
    if (!stat) return;
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`unsafe managed directory collision: ${relative(projectRoot, current)}`);
  }
}

export function ensureSafeDirectory(projectRoot: string, path: string): void {
  if (!containedBy(projectRoot, path)) throw new Error(`destination escapes project root: ${path}`);
  const rel = relative(projectRoot, path);
  let current = projectRoot;
  for (const part of rel.split(sep).filter(Boolean)) {
    current = join(current, part);
    const stat = lstatIfPresent(current);
    if (stat) {
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`unsafe managed directory collision: ${relative(projectRoot, current)}`);
    } else {
      mkdirSync(current, { mode: 0o755 });
    }
  }
}

export function fsyncDirectory(path: string): void {
  const fd = openSync(path, constants.O_RDONLY);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function lstatIfPresent(path: string) {
  try { return lstatSync(path); }
  catch (error: any) { if (error?.code === "ENOENT") return null; throw error; }
}

function atomicWrite(path: string, bytes: Buffer | string, mode = 0o644): void {
  const tmp = join(dirname(path), `.${relative(dirname(path), path)}.tmp-${process.pid}-${randomUUID()}`);
  const fd = openSync(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), mode);
  try {
    writeFileSync(fd, bytes);
    fsyncSync(fd);
  } finally { closeSync(fd); }
  renameSync(tmp, path);
  fsyncDirectory(dirname(path));
}

function writeJsonAtomic(projectRoot: string, path: string, value: unknown, mode = 0o644): boolean {
  ensureSafeDirectory(projectRoot, dirname(path));
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  const existing = lstatIfPresent(path);
  if (existing) {
    if (!existing.isFile() || existing.isSymbolicLink()) throw new Error(`unsafe JSON state destination: ${relative(projectRoot, path)}`);
    if (readFileSync(path, "utf8") === bytes) return false;
  }
  const tmp = join(dirname(path), `.${relative(dirname(path), path)}.tmp-${process.pid}-${randomUUID()}`);
  const fd = openSync(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), mode);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(tmp, path);
  fsyncDirectory(dirname(path));
  return true;
}

function readManifest(projectRoot: string): TemplateManifest {
  const path = join(projectRoot, TEMPLATE_MANIFEST);
  const stat = lstatIfPresent(path);
  if (!stat) return { schemaVersion: SCHEMA_VERSION, assets: {} };
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${TEMPLATE_MANIFEST} is not a regular file`);
  const raw = jsonObject(parseJson(readFileSync(path, "utf8"), TEMPLATE_MANIFEST), TEMPLATE_MANIFEST);
  if (raw.schemaVersion !== SCHEMA_VERSION) throw new Error(`unsupported ${TEMPLATE_MANIFEST} schema`);
  return { schemaVersion: SCHEMA_VERSION, assets: jsonObject(raw.assets, `${TEMPLATE_MANIFEST} assets`) as Record<string, TemplateEntry> };
}

function recoverResetIntent(projectRoot: string, pluginRoot: string, inventory: AssetInventory, manifest: TemplateManifest): string | null {
  const path = join(projectRoot, RESET_INTENT);
  const stat = lstatIfPresent(path);
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${RESET_INTENT} is not a regular file`);
  const intent = jsonObject(parseJson(readFileSync(path, "utf8"), RESET_INTENT), RESET_INTENT);
  if (intent.schemaVersion !== 1 || intent.action !== "reset" || typeof intent.assetId !== "string" || typeof intent.destination !== "string" || typeof intent.upstreamSha256 !== "string" || !(intent.beforeSha256 === null || typeof intent.beforeSha256 === "string")) {
    throw new Error(`${RESET_INTENT} is invalid and requires explicit recovery`);
  }
  const asset = inventory.assets.find((item) => item.scope === "project" && item.id === intent.assetId);
  if (!asset || asset.destination !== intent.destination) throw new Error(`${RESET_INTENT} does not match the current inventory`);
  const source = readFileSync(join(pluginRoot, asset.source));
  const destination = join(projectRoot, asset.destination);
  const upstream = digest(source);
  if (upstream !== intent.upstreamSha256) throw new Error(`${RESET_INTENT} upstream changed and requires explicit recovery`);
  assertSafePathAncestors(projectRoot, destination);
  const destinationStat = lstatIfPresent(destination);
  if (!destinationStat) {
    if (intent.beforeSha256 !== null) throw new Error(`${RESET_INTENT} destination disappeared and requires explicit recovery`);
    ensureSafeDirectory(projectRoot, dirname(destination)); atomicWrite(destination, source);
  } else {
    if (!destinationStat.isFile() || destinationStat.isSymbolicLink()) throw new Error(`${RESET_INTENT} destination is unsafe`);
    const current = digest(readFileSync(destination));
    if (current === intent.beforeSha256) atomicWrite(destination, source);
    else if (current !== upstream) throw new Error(`${RESET_INTENT} destination changed and requires explicit recovery`);
  }
  manifest.assets[asset.id] = { source: asset.source, destination: asset.destination, baselineSha256: upstream, installedSha256: upstream, acceptedOverrideSha256: null, availableUpstreamSha256: upstream, state: "managed", provenance: provenance(asset) };
  return asset.id;
}

function provenance(asset: AssetDefinition): TemplateEntry["provenance"] {
  return { scope: asset.scope, exposure: asset.exposure, customization: asset.customization, lifecycleTrigger: asset.lifecycleTrigger };
}

function legacyPath(projectRoot: string, asset: AssetDefinition): string | null {
  if (asset.id.startsWith("project-skill-")) return join(projectRoot, ".ralph", "skills", asset.id.slice("project-skill-".length), "SKILL.md");
  if (asset.id.startsWith("project-workflow-")) {
    const name = asset.id.slice("project-workflow-".length);
    return join(projectRoot, ".ralph", "skills", name === "plan-spec" ? "plan" : name, "SKILL.md");
  }
  return null;
}

function safeLegacyStat(projectRoot: string, path: string) {
  try { assertSafePathAncestors(projectRoot, path); }
  catch (error) {
    if (lstatIfPresent(path)) throw error;
    return null;
  }
  return lstatIfPresent(path);
}

function migrateExpectedSkillSymlink(projectRoot: string, asset: AssetDefinition): Buffer | null {
  if (!asset.id.startsWith("project-skill-")) return null;
  const skillDir = join(projectRoot, dirname(asset.destination));
  const expectedLegacy = legacyPath(projectRoot, asset);
  if (!expectedLegacy) return null;
  assertSafePathAncestors(projectRoot, skillDir);
  const backupLink = `${skillDir}.prime-claw-migration-link`;
  if (existsSync(backupLink)) {
    assertSafePathAncestors(projectRoot, expectedLegacy);
    const backupStat = lstatSync(backupLink);
    if (!backupStat.isSymbolicLink() || realpathSync(backupLink) !== realpathSync(dirname(expectedLegacy))) {
      throw new Error(`unsafe interrupted project skill migration: ${relative(projectRoot, backupLink)}`);
    }
    if (!existsSync(skillDir)) renameSync(backupLink, skillDir);
    else {
      const currentStat = lstatSync(skillDir);
      if (!currentStat.isDirectory() || currentStat.isSymbolicLink()) throw new Error(`ambiguous interrupted project skill migration: ${relative(projectRoot, skillDir)}`);
      unlinkSync(backupLink);
    }
  }
  if (!existsSync(skillDir)) return null;
  const stat = lstatSync(skillDir);
  if (!stat.isSymbolicLink()) return null;
  assertSafePathAncestors(projectRoot, expectedLegacy);
  if (realpathSync(skillDir) !== realpathSync(dirname(expectedLegacy))) {
    throw new Error(`unsafe project skill symlink collision: ${relative(projectRoot, skillDir)}`);
  }
  const legacyStat = lstatSync(expectedLegacy);
  if (!legacyStat.isFile() || legacyStat.isSymbolicLink()) {
    throw new Error(`legacy asset is not a regular file: ${relative(projectRoot, expectedLegacy)}`);
  }
  const bytes = readFileSync(expectedLegacy);
  const parent = dirname(skillDir);
  ensureSafeDirectory(projectRoot, parent);
  const staged = join(parent, `.${asset.id}.migration-${process.pid}-${randomUUID()}`);
  mkdirSync(staged, { mode: 0o755 });
  try {
    atomicWrite(join(staged, "SKILL.md"), bytes);
    renameSync(skillDir, backupLink);
    try { renameSync(staged, skillDir); }
    catch (error) { renameSync(backupLink, skillDir); throw error; }
    unlinkSync(backupLink);
    fsyncDirectory(parent);
  } catch (error) {
    rmSync(staged, { recursive: true, force: true });
    throw error;
  }
  try { unlinkSync(expectedLegacy); } catch { /* the exact duplicate is reported as legacy remaining */ }
  return bytes;
}

function removeEmptyLegacy(projectRoot: string): string[] {
  const legacyRoot = join(projectRoot, ".ralph", "skills");
  let rootStat;
  try { rootStat = lstatSync(legacyRoot); } catch { return []; }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return [relative(projectRoot, legacyRoot)];
  const walk = (path: string): string[] => {
    const names = existsSync(path) && lstatSync(path).isDirectory() ? readdirSync(path) : [];
    const remaining: string[] = [];
    for (const name of names) {
      const child = join(path, name);
      const stat = lstatSync(child);
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        const nested = walk(child);
        if (!nested.length) rmdirSync(child); else remaining.push(...nested);
      } else remaining.push(relative(projectRoot, child));
    }
    return remaining;
  };
  const remaining = walk(legacyRoot);
  if (!remaining.length) rmdirSync(legacyRoot);
  return remaining;
}

export function acquireProjectMutationLock(projectRoot: string): () => void {
  const lockPath = join(projectRoot, RECONCILE_LOCK);
  const recoveryPath = `${lockPath}.recovery`;
  ensureSafeDirectory(projectRoot, dirname(lockPath));
  const token = randomUUID();
  const open = (): number => openSync(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  let fd: number;
  try { fd = open(); }
  catch {
    let record: Record<string, any>;
    try {
      const stat = lstatSync(lockPath);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("unsafe lock file");
      record = jsonObject(parseJson(readFileSync(lockPath, "utf8"), RECONCILE_LOCK), RECONCILE_LOCK);
      if (!Number.isInteger(record.pid) || record.pid <= 0) throw new Error("invalid lock owner");
      try { process.kill(record.pid, 0); throw new Error("lock owner is still active"); }
      catch (probe: any) { if (probe?.code !== "ESRCH") throw probe; }
    } catch (probe) {
      throw new Error(`another Prime Claw reconciliation is active or ${RECONCILE_LOCK} requires recovery: ${probe instanceof Error ? probe.message : String(probe)}`);
    }
    try { mkdirSync(recoveryPath, { mode: 0o700 }); }
    catch { throw new Error(`another Prime Claw reconciliation or stale-lock recovery is active`); }
    try {
      const current = jsonObject(parseJson(readFileSync(lockPath, "utf8"), RECONCILE_LOCK), RECONCILE_LOCK);
      if (current.pid !== record.pid || current.token !== record.token || current.createdAt !== record.createdAt) throw new Error("stale lock changed during recovery");
      unlinkSync(lockPath);
      fsyncDirectory(dirname(lockPath));
      fd = open();
    } catch (error) {
      throw new Error(`stale ${RECONCILE_LOCK} recovery failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      try { rmdirSync(recoveryPath); fsyncDirectory(dirname(recoveryPath)); } catch { /* a retained recovery marker fails future mutation closed */ }
    }
  }
  const lockRecord = { pid: process.pid, token, createdAt: new Date().toISOString() };
  writeFileSync(fd, `${JSON.stringify(lockRecord)}
`);
  fsyncSync(fd); closeSync(fd); fsyncDirectory(dirname(lockPath));
  return () => {
    try {
      const current = jsonObject(parseJson(readFileSync(lockPath, "utf8"), RECONCILE_LOCK), RECONCILE_LOCK);
      if (current.token !== token) return;
      unlinkSync(lockPath); fsyncDirectory(dirname(lockPath));
    } catch { /* never remove an unproven successor lock */ }
  };
}

export function listOrcaRegistrations(runner: CommandRunner = new ProcessCommandRunner()): OrcaRegistration[] {
  const result = runner.run("orca", ["repo", "list", "--json"], { allowFailure: true });
  if (result.status !== 0) throw new Error(result.stderr.trim() || "orca repo list failed");
  const raw = jsonObject(parseJson(result.stdout, "orca repo list"), "orca repo list");
  const repos = raw.result && typeof raw.result === "object" ? (raw.result as any).repos : undefined;
  if (!Array.isArray(repos)) throw new Error("orca repo list returned no repos array");
  return repos.map((value, index) => {
    if (!value || typeof value !== "object" || typeof value.id !== "string" || !value.id || typeof value.path !== "string" || !value.path) {
      throw new Error(`orca repo list returned malformed repo row ${index}`);
    }
    return value as OrcaRegistration;
  });
}

function exactRegistration(root: string, registrations: OrcaRegistration[]): OrcaRegistration | undefined {
  const matches = registrations.filter((item) => { try { return realpathSync(item.path) === root; } catch { return resolve(item.path) === root; } });
  if (matches.length > 1) throw new Error(`orca has ${matches.length} registrations for exact path ${root}`);
  return matches[0];
}

export function ensureOrcaRegistration(root: string, runner: CommandRunner = new ProcessCommandRunner()): { status: "reused" | "added"; id: string } {
  const existing = exactRegistration(root, listOrcaRegistrations(runner));
  if (existing) return { status: "reused", id: existing.id };
  const added = runner.run("orca", ["repo", "add", "--path", root, "--json"], { allowFailure: true });
  let now: OrcaRegistration | undefined;
  try { now = exactRegistration(root, listOrcaRegistrations(runner)); }
  catch (error) {
    throw new Error(`orca repo add outcome is uncertain; inspect exact-path registration before retrying: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (now) return { status: "added", id: now.id };
  if (added.status !== 0) throw new Error(added.stderr.trim() || "orca repo add failed without an exact-path registration");
  throw new Error("orca repo add returned without an exact-path registration");
}

export function isOrcaRegistered(root: string, runner: CommandRunner = new ProcessCommandRunner()): boolean {
  return Boolean(exactRegistration(root, listOrcaRegistrations(runner)));
}

function sameExistingPath(left: string, right: string): boolean {
  try { return realpathSync(left) === realpathSync(right); } catch { return resolve(left) === resolve(right); }
}

export type EpisodeWorktreeActivity = "active" | "inactive" | "uncertain";

function legacyActivityAt(ownerRoot: string, worktreeRoot: string): EpisodeWorktreeActivity {
  const legacyRoot = join(ownerRoot, ".prime", "agent", "state", "spec-episodes");
  let legacyStat;
  try { legacyStat = lstatSync(legacyRoot); }
  catch (error: any) { return error?.code === "ENOENT" ? "inactive" : "uncertain"; }
  if (!legacyStat.isDirectory() || legacyStat.isSymbolicLink()) return "uncertain";
  let uncertain = false;
  for (const name of readdirSync(legacyRoot)) {
    if (!name.endsWith(".json")) continue;
    try {
      const path = join(legacyRoot, name);
      const stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink()) { uncertain = true; continue; }
      const record = jsonObject(parseJson(readFileSync(path, "utf8"), name), name);
      if (typeof record.worktree === "string" && sameExistingPath(record.worktree, worktreeRoot) && record.bootstrapAdmission !== "closed") return "active";
    } catch { uncertain = true; }
  }
  return uncertain ? "uncertain" : "inactive";
}

export function episodeWorktreeActivity(root: string, kind: ProjectRoot["kind"], runner: CommandRunner = new ProcessCommandRunner()): EpisodeWorktreeActivity {
  const ownershipCandidates = [join(root, ".prime-claw", "episode.json"), join(root, ".prime-claw", "ownership.json")];
  for (const path of ownershipCandidates) {
    let stat;
    try { stat = lstatSync(path); }
    catch (error: any) { if (error?.code === "ENOENT") continue; return "uncertain"; }
    try {
      if (!stat.isFile() || stat.isSymbolicLink()) return "uncertain";
      const record = jsonObject(parseJson(readFileSync(path, "utf8"), relative(root, path)), relative(root, path));
      if (record.status === "active" && typeof record.worktree === "string" && sameExistingPath(record.worktree, root)) return "active";
    } catch { return "uncertain"; }
  }
  const local = legacyActivityAt(root, root);
  if (local === "active") return "active";
  if (kind !== "linked-worktree") return "inactive";
  const worktrees = runGit(runner, root, ["worktree", "list", "--porcelain"], true);
  if (worktrees.status !== 0) return "uncertain";
  let uncertain = local === "uncertain";
  let sawWorktree = false;
  for (const line of worktrees.stdout.split(/\r?\n/)) {
    if (!line.startsWith("worktree ")) continue;
    sawWorktree = true;
    const ownerRoot = line.slice("worktree ".length).trim();
    if (!ownerRoot) { uncertain = true; continue; }
    const activity = legacyActivityAt(ownerRoot, root);
    if (activity === "active") return "active";
    if (activity === "uncertain") uncertain = true;
  }
  return !sawWorktree || uncertain ? "uncertain" : "inactive";
}

export function isActiveEpisodeWorktree(root: string, runner: CommandRunner = new ProcessCommandRunner(), kind: ProjectRoot["kind"] = "linked-worktree"): boolean {
  return episodeWorktreeActivity(root, kind, runner) !== "inactive";
}

export function reconcilePrimeClawProject(options: ReconcileOptions): ReconcileResult {
  const runner = options.runner ?? new ProcessCommandRunner();
  const pluginRoot = options.pluginRoot ? realpathSync(options.pluginRoot) : pluginRootFromModule();
  const project = resolveNearestProjectRoot(options.cwd, options.home, runner);
  const activity: EpisodeWorktreeActivity = options.isActiveEpisode
    ? (options.isActiveEpisode(project.root) ? "active" : "inactive")
    : episodeWorktreeActivity(project.root, project.kind, runner);
  if (activity !== "inactive") {
    return {
      project,
      registration: { status: "not-requested" },
      items: [],
      manifestWritten: false,
      changed: false,
      conflicts: 0,
      legacyRemaining: [],
      skippedActiveEpisode: true,
      skipReason: activity === "active" ? "active-episode" : "uncertain-episode-activity",
    };
  }
  const inventory = loadAssetInventory(pluginRoot);
  const release = acquireProjectMutationLock(project.root);
  const items: ReconcileItem[] = [];
  let registration: ReconcileResult["registration"] = { status: "not-requested" };
  let manifestWritten = false;
  try {
    const reviewState = join(project.root, TEMPLATE_REVIEW_STATE);
    if (lstatIfPresent(reviewState)) throw new Error(`interrupted template review requires an explicit keep or restore decision: ${TEMPLATE_REVIEW_STATE}`);
    const manifest = readManifest(project.root);
    const recoveredReset = recoverResetIntent(project.root, pluginRoot, inventory, manifest);
    for (const asset of inventory.assets.filter((item) => item.scope === "project")) {
      const sourcePath = join(pluginRoot, asset.source);
      const sourceBytes = readFileSync(sourcePath);
      const upstream = digest(sourceBytes);
      const destination = join(project.root, asset.destination);
      const prior = manifest.assets[asset.id];
      let action: ReconcileItem["action"] = "unchanged";
      let reason: string | undefined;
      try {
        const migratedSymlinkBytes = migrateExpectedSkillSymlink(project.root, asset);
        ensureSafeDirectory(project.root, dirname(destination));
        const legacy = legacyPath(project.root, asset);
        const destinationStat = lstatIfPresent(destination);
        const legacyStat = legacy ? safeLegacyStat(project.root, legacy) : null;
        if (migratedSymlinkBytes) {
          const current = digest(migratedSymlinkBytes);
          const state: TemplateState = current === upstream ? "managed" : "customized";
          manifest.assets[asset.id] = { source: asset.source, destination: asset.destination, baselineSha256: current === upstream ? upstream : null, installedSha256: current, acceptedOverrideSha256: null, availableUpstreamSha256: upstream, state, provenance: provenance(asset) };
          action = "migrated";
          if (state === "customized") reason = "preserved customized legacy content";
        } else if (!destinationStat && legacy && legacyStat) {
          if (!legacyStat.isFile() || legacyStat.isSymbolicLink()) throw new Error(`legacy asset is not a regular file: ${relative(project.root, legacy)}`);
          const bytes = readFileSync(legacy);
          atomicWrite(destination, bytes);
          unlinkSync(legacy);
          const current = digest(bytes);
          const state: TemplateState = current === upstream ? "managed" : "customized";
          manifest.assets[asset.id] = { source: asset.source, destination: asset.destination, baselineSha256: current === upstream ? upstream : null, installedSha256: current, acceptedOverrideSha256: null, availableUpstreamSha256: upstream, state, provenance: provenance(asset) };
          action = "migrated";
          if (state === "customized") reason = "preserved customized legacy content";
        } else if (!destinationStat) {
          atomicWrite(destination, sourceBytes);
          manifest.assets[asset.id] = { source: asset.source, destination: asset.destination, baselineSha256: upstream, installedSha256: upstream, acceptedOverrideSha256: null, availableUpstreamSha256: upstream, state: "managed", provenance: provenance(asset) };
          action = "created";
        } else {
          if (!destinationStat.isFile() || destinationStat.isSymbolicLink()) throw new Error("destination is not a regular file");
          const currentBytes = readFileSync(destination);
          const current = digest(currentBytes);
          if (!prior) {
            const state: TemplateState = current === upstream ? "managed" : "customized";
            manifest.assets[asset.id] = { source: asset.source, destination: asset.destination, baselineSha256: state === "managed" ? upstream : null, installedSha256: current, acceptedOverrideSha256: null, availableUpstreamSha256: upstream, state, provenance: provenance(asset) };
            action = state === "managed" ? "unchanged" : "preserved";
            if (state === "customized") reason = "unknown pre-existing file";
          } else if (prior.state === "managed" && current === upstream) {
            manifest.assets[asset.id] = { ...prior, source: asset.source, destination: asset.destination, baselineSha256: upstream, installedSha256: upstream, acceptedOverrideSha256: null, availableUpstreamSha256: upstream, state: "managed", provenance: provenance(asset) };
            if (prior.installedSha256 !== upstream) { action = "recovered"; reason = "recovered completed template write"; }
          } else if (prior.state === "managed" && current === prior.installedSha256 && (prior.baselineSha256 === prior.installedSha256 || prior.baselineSha256 === current)) {
            if (current !== upstream) {
              atomicWrite(destination, sourceBytes);
              action = "updated";
            }
            manifest.assets[asset.id] = { ...prior, source: asset.source, destination: asset.destination, baselineSha256: upstream, installedSha256: upstream, acceptedOverrideSha256: null, availableUpstreamSha256: upstream, state: "managed", provenance: provenance(asset) };
          } else {
            const accepted = prior.state === "accepted-override" && current === prior.acceptedOverrideSha256;
            manifest.assets[asset.id] = { ...prior, source: asset.source, destination: asset.destination, installedSha256: current, availableUpstreamSha256: upstream, state: accepted ? "accepted-override" : "customized", provenance: provenance(asset) };
            action = accepted && prior.baselineSha256 === upstream ? "unchanged" : "preserved";
            reason = accepted
              ? (prior.baselineSha256 === upstream ? "accepted override" : "new upstream available for accepted override")
              : "customized file";
          }
          if (legacy && existsSync(legacy)) {
            const legacyStat = lstatSync(legacy);
            if (legacyStat.isFile() && !legacyStat.isSymbolicLink() && digest(readFileSync(legacy)) === current) unlinkSync(legacy);
          }
        }
      } catch (error) {
        action = "blocked";
        reason = error instanceof Error ? error.message : String(error);
      }
      if (recoveredReset === asset.id && action !== "blocked") { action = "recovered"; reason = "completed explicit reset recovered from durable intent"; }
      items.push({ assetId: asset.id, destination: asset.destination, action, ...(reason ? { reason } : {}) });
    }
    const remaining = removeEmptyLegacy(project.root);
    manifestWritten = writeJsonAtomic(project.root, join(project.root, TEMPLATE_MANIFEST), manifest);
    if (recoveredReset) { unlinkSync(join(project.root, RESET_INTENT)); fsyncDirectory(join(project.root, ".prime-claw")); }
    if (options.registerOrca) {
      try { registration = ensureOrcaRegistration(project.root, runner); }
      catch (error) { registration = { status: "unavailable", error: error instanceof Error ? error.message : String(error) }; }
    } else if (options.requireOrcaRegistration) {
      try {
        const found = exactRegistration(project.root, listOrcaRegistrations(runner));
        registration = found ? { status: "reused", id: found.id } : { status: "unavailable", error: "project is not registered with Orca" };
      } catch (error) { registration = { status: "unavailable", error: error instanceof Error ? error.message : String(error) }; }
    }
    const conflicts = items.filter((item) => item.action === "preserved" || item.action === "blocked").length + remaining.length + (registration.status === "unavailable" ? 1 : 0);
    return { project, registration, items, manifestWritten, changed: manifestWritten || items.some((item) => ["created", "migrated", "updated", "recovered"].includes(item.action)), conflicts, legacyRemaining: remaining, skippedActiveEpisode: false };
  } finally { release(); }
}

export function acceptProjectOverride(cwd: string, assetId: string, options: Omit<ReconcileOptions, "cwd"> = {}): TemplateEntry {
  const runner = options.runner ?? new ProcessCommandRunner();
  const project = resolveNearestProjectRoot(cwd, options.home, runner);
  const pluginRoot = options.pluginRoot ? realpathSync(options.pluginRoot) : pluginRootFromModule();
  const asset = loadAssetInventory(pluginRoot).assets.find((item) => item.scope === "project" && item.id === assetId);
  if (!asset) throw new Error(`unknown project asset: ${assetId}`);
  if (options.isActiveEpisode?.(project.root) ?? (episodeWorktreeActivity(project.root, project.kind, runner) !== "inactive")) throw new Error("active or uncertain Episode worktree retains its starting template snapshot");
  const release = acquireProjectMutationLock(project.root);
  try {
    if (options.isActiveEpisode?.(project.root) ?? (episodeWorktreeActivity(project.root, project.kind, runner) !== "inactive")) throw new Error("active or uncertain Episode worktree retains its starting template snapshot");
    if (lstatIfPresent(join(project.root, TEMPLATE_REVIEW_STATE))) throw new Error("template review requires completion or recovery before accepting an override");
    const destination = join(project.root, asset.destination);
    assertSafePathAncestors(project.root, destination);
    const stat = lstatSync(destination);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("override destination is not a regular file");
    const current = digest(readFileSync(destination));
    const upstream = digest(readFileSync(join(pluginRoot, asset.source)));
    const manifest = readManifest(project.root);
    const entry: TemplateEntry = { source: asset.source, destination: asset.destination, baselineSha256: upstream, installedSha256: current, acceptedOverrideSha256: current, availableUpstreamSha256: upstream, state: "accepted-override", provenance: provenance(asset) };
    manifest.assets[asset.id] = entry;
    writeJsonAtomic(project.root, join(project.root, TEMPLATE_MANIFEST), manifest);
    return entry;
  } finally { release(); }
}

export function resetProjectAsset(cwd: string, assetId: string, options: Omit<ReconcileOptions, "cwd"> = {}): TemplateEntry {
  const runner = options.runner ?? new ProcessCommandRunner();
  const project = resolveNearestProjectRoot(cwd, options.home, runner);
  const pluginRoot = options.pluginRoot ? realpathSync(options.pluginRoot) : pluginRootFromModule();
  const asset = loadAssetInventory(pluginRoot).assets.find((item) => item.scope === "project" && item.id === assetId);
  if (!asset) throw new Error(`unknown project asset: ${assetId}`);
  if (options.isActiveEpisode?.(project.root) ?? (episodeWorktreeActivity(project.root, project.kind, runner) !== "inactive")) throw new Error("active or uncertain Episode worktree retains its starting template snapshot");
  const release = acquireProjectMutationLock(project.root);
  try {
    if (options.isActiveEpisode?.(project.root) ?? (episodeWorktreeActivity(project.root, project.kind, runner) !== "inactive")) throw new Error("active or uncertain Episode worktree retains its starting template snapshot");
    if (lstatIfPresent(join(project.root, TEMPLATE_REVIEW_STATE))) throw new Error("template review requires completion or recovery before resetting an asset");
    const sourceBytes = readFileSync(join(pluginRoot, asset.source));
    const upstream = digest(sourceBytes);
    const destination = join(project.root, asset.destination);
    assertSafePathAncestors(project.root, destination);
    let beforeSha256: string | null = null;
    const destinationStat = lstatIfPresent(destination);
    if (destinationStat) {
      if (!destinationStat.isFile() || destinationStat.isSymbolicLink()) throw new Error("reset destination is not a regular file");
      beforeSha256 = digest(readFileSync(destination));
    } else ensureSafeDirectory(project.root, dirname(destination));
    const intentPath = join(project.root, RESET_INTENT);
    if (lstatIfPresent(intentPath)) throw new Error(`${RESET_INTENT} already requires recovery`);
    writeJsonAtomic(project.root, intentPath, { schemaVersion: 1, action: "reset", assetId: asset.id, destination: asset.destination, upstreamSha256: upstream, beforeSha256 }, 0o600);
    atomicWrite(destination, sourceBytes);
    const manifest = readManifest(project.root);
    const entry: TemplateEntry = { source: asset.source, destination: asset.destination, baselineSha256: upstream, installedSha256: upstream, acceptedOverrideSha256: null, availableUpstreamSha256: upstream, state: "managed", provenance: provenance(asset) };
    manifest.assets[asset.id] = entry;
    writeJsonAtomic(project.root, join(project.root, TEMPLATE_MANIFEST), manifest);
    unlinkSync(intentPath); fsyncDirectory(dirname(intentPath));
    return entry;
  } finally { release(); }
}
