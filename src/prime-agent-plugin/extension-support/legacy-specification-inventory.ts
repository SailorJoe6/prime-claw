import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import {
  readAllEpisodeOwnership,
  type EpisodeOwnershipRecord,
} from "./episode-ownership.ts";

export const LEGACY_SPECIFICATION_INVENTORY = ".prime-claw/legacy-specifications.json";

const SAFE_LOCATION = /^\.ralph\/plans\/future\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export interface GrandfatheredLegacySpecification {
  location: string;
  specificationSha256: string;
}

export interface LegacySpecificationInventory {
  schemaVersion: 1;
  specifications: GrandfatheredLegacySpecification[];
}

export interface LegacySpecificationViolation {
  location: string;
  reason: "not-grandfathered" | "specification-changed";
}

export type LegacySpecificationInventoryResult =
  | { status: "created" | "verified"; path: string; accepted: number; violations: LegacySpecificationViolation[] }
  | { status: "not-required"; path: string; accepted: 0; violations: [] }
  | { status: "required"; path: string; accepted: 0; violations: LegacySpecificationViolation[] }
  | { status: "blocked"; path: string; accepted: 0; violations: []; detail: string };

function containedBy(parent: string, child: string): boolean {
  const value = relative(parent, child);
  return value !== "" && value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value);
}

function regularReadableBytes(path: string): Buffer | null {
  let descriptor: number | undefined;
  try {
    const before = lstatSync(path);
    if (!before.isFile() || before.isSymbolicLink() || before.size <= 0) return null;
    descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.size <= 0 || opened.dev !== before.dev || opened.ino !== before.ino) return null;
    return readFileSync(descriptor);
  } catch {
    return null;
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* readability was already proven */ }
    }
  }
}

function digest(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function requireRealDirectory(path: string, label: string): void {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
}

function ownedSpecificationBytes(worktree: string): { active: Buffer | null; blocked: Buffer | null } {
  requireRealDirectory(worktree, "legacy ownership worktree");
  const plans = join(worktree, ".ralph", "plans");
  requireRealDirectory(plans, "legacy ownership plan root");
  const active = regularReadableBytes(join(plans, "SPECIFICATION.md"));
  const blockedRoot = join(plans, "blocked");
  let blocked: Buffer | null = null;
  try {
    requireRealDirectory(blockedRoot, "legacy blocked-plan root");
    blocked = regularReadableBytes(join(blockedRoot, "SPECIFICATION.md"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return { active, blocked };
}

function requireSafeFutureRoot(projectRoot: string): string {
  const ralph = join(projectRoot, ".ralph");
  const plans = join(ralph, "plans");
  const future = join(plans, "future");
  requireRealDirectory(ralph, "legacy .ralph root");
  requireRealDirectory(plans, "legacy plan root");
  requireRealDirectory(future, "legacy future-plan root");
  return future;
}

export function assertSafeLegacyFutureLocation(
  projectRoot: string,
  location: string,
  allowMissing = false,
): void {
  const match = SAFE_LOCATION.exec(location);
  if (!match) throw new Error(`${location} is not a supported retained legacy location`);
  const ralph = join(projectRoot, ".ralph");
  const plans = join(ralph, "plans");
  const future = join(plans, "future");
  const folder = join(future, match[1]);
  if (!containedBy(future, folder) || !containedBy(projectRoot, folder)) {
    throw new Error(`${location} escapes the legacy future-plan root`);
  }
  for (const [path, label] of [[ralph, "legacy .ralph root"], [plans, "legacy plan root"],
    [future, "legacy future-plan root"], [folder, location]] as const) {
    try { requireRealDirectory(path, label); }
    catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
}

function requireSafeFutureLocation(projectRoot: string, location: string): string {
  assertSafeLegacyFutureLocation(projectRoot, location);
  return join(projectRoot, location);
}

/** Inventory only unfinished, syntactically supported future-folder specifications.
 * Archive and blocked history are outside this exact root and are never reminders. */
export function discoverGrandfatherableLegacySpecifications(
  projectRoot: string,
  ownershipRecords: EpisodeOwnershipRecord[] = readAllEpisodeOwnership(projectRoot),
): GrandfatheredLegacySpecification[] {
  const futureRoot = join(projectRoot, ".ralph", "plans", "future");
  const byLocation = new Map<string, string>();
  let rootStat;
  try { rootStat = lstatSync(futureRoot); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (rootStat) {
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      throw new Error("legacy future-plan root must be a real directory");
    }
    requireSafeFutureRoot(projectRoot);
    for (const entry of readdirSync(futureRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const location = `.ralph/plans/future/${entry.name}`;
      if (!SAFE_LOCATION.test(location)) continue;
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        throw new Error(`${location} must be a real directory`);
      }
      const folder = join(futureRoot, entry.name);
      if (!containedBy(futureRoot, folder) || !containedBy(projectRoot, folder)) {
        throw new Error(`${location} escapes the legacy future-plan root`);
      }
      const bytes = regularReadableBytes(join(folder, "SPECIFICATION.md"));
      if (!bytes) throw new Error(`${location}/SPECIFICATION.md must be a readable non-empty regular file`);
      byLocation.set(location, digest(bytes));
    }
  }

  const retired = new Set<string>();
  const nonInactive = new Set<string>();
  const archiveRoot = join(projectRoot, ".ralph", "plans", "archive");
  try {
    const archiveStat = lstatSync(archiveRoot);
    requireRealDirectory(join(projectRoot, ".ralph"), "legacy .ralph root");
    requireRealDirectory(join(projectRoot, ".ralph", "plans"), "legacy plan root");
    if (!archiveStat.isDirectory() || archiveStat.isSymbolicLink()) {
      throw new Error("legacy archive root must be a real directory");
    }
    for (const entry of readdirSync(archiveRoot, { withFileTypes: true })) {
      const location = `.ralph/plans/future/${entry.name}`;
      if (!SAFE_LOCATION.test(location)) continue;
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        throw new Error(`.ralph/plans/archive/${entry.name} must be a real directory`);
      }
      retired.add(location);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  for (const record of ownershipRecords) {
    if (record.version !== 1) continue;
    if (record.status === "inactive") { retired.add(record.sourceLocation); continue; }
    nonInactive.add(record.sourceLocation);
    if (!record.worktree) throw new Error(`non-inactive legacy ownership for ${record.sourceLocation} has no worktree`);
    const { active, blocked } = ownedSpecificationBytes(record.worktree);
    if (active && blocked) throw new Error(`legacy ownership for ${record.sourceLocation} has both active and blocked specifications`);
    const ownedBytes = active ?? blocked;
    const futureDigest = byLocation.get(record.sourceLocation);
    if (!ownedBytes && !futureDigest) {
      throw new Error(`non-inactive legacy ownership for ${record.sourceLocation} has no readable specification`);
    }
    if (ownedBytes) {
      const ownedDigest = digest(ownedBytes);
      if (futureDigest && futureDigest !== ownedDigest) {
        throw new Error(`future and owned specifications disagree for ${record.sourceLocation}`);
      }
      const prior = byLocation.get(record.sourceLocation);
      if (prior && prior !== ownedDigest) throw new Error(`legacy ownership specifications disagree for ${record.sourceLocation}`);
      byLocation.set(record.sourceLocation, ownedDigest);
    }
  }

  for (const location of retired) {
    if (nonInactive.has(location)) throw new Error(`${location} has both completed and non-terminal legacy ownership`);
    byLocation.delete(location);
  }
  return [...byLocation.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([location, specificationSha256]) => ({ location, specificationSha256 }));
}

function parseInventory(bytes: Buffer): LegacySpecificationInventory {
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); }
  catch (error) { throw new Error(`legacy specification inventory is invalid JSON: ${error instanceof Error ? error.message : String(error)}`); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("legacy specification inventory must be an object");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== "schemaVersion,specifications"
    || record.schemaVersion !== 1 || !Array.isArray(record.specifications)) {
    throw new Error("legacy specification inventory has an unsupported schema");
  }
  const seen = new Set<string>();
  const specifications = record.specifications.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`legacy specification inventory row ${index} must be an object`);
    const row = item as Record<string, unknown>;
    if (Object.keys(row).sort().join(",") !== "location,specificationSha256"
      || typeof row.location !== "string" || !SAFE_LOCATION.test(row.location)
      || typeof row.specificationSha256 !== "string" || !/^[0-9a-f]{64}$/.test(row.specificationSha256)) {
      throw new Error(`legacy specification inventory row ${index} has invalid location or digest`);
    }
    if (seen.has(row.location)) throw new Error(`legacy specification inventory repeats ${row.location}`);
    seen.add(row.location);
    return { location: row.location, specificationSha256: row.specificationSha256 };
  });
  specifications.sort((a, b) => a.location.localeCompare(b.location));
  return { schemaVersion: 1, specifications };
}

function readInventory(projectRoot: string): LegacySpecificationInventory | null {
  const path = join(projectRoot, LEGACY_SPECIFICATION_INVENTORY);
  let stat;
  try { stat = lstatSync(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("legacy specification inventory must be a regular file");
  return parseInventory(readFileSync(path));
}

function writeInventoryOnce(projectRoot: string, inventory: LegacySpecificationInventory): void {
  const path = join(projectRoot, LEGACY_SPECIFICATION_INVENTORY);
  const parent = dirname(path);
  mkdirSync(parent, { recursive: true });
  const parentStat = lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error("legacy specification inventory parent must be a real directory");
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
  const bytes = `${JSON.stringify(inventory, null, 2)}\n`;
  try {
    writeFileSync(temporary, bytes, { flag: "wx", mode: 0o600 });
    const descriptor = openSync(temporary, "r");
    try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
    linkSync(temporary, path);
    unlinkSync(temporary);
    const parentDescriptor = openSync(parent, "r");
    try { fsyncSync(parentDescriptor); } finally { closeSync(parentDescriptor); }
  } catch (error) {
    try { unlinkSync(temporary); } catch { /* no temporary file */ }
    throw error;
  }
}

function violations(
  accepted: LegacySpecificationInventory,
  current: GrandfatheredLegacySpecification[],
): LegacySpecificationViolation[] {
  const byLocation = new Map(accepted.specifications.map((item) => [item.location, item.specificationSha256]));
  return current.flatMap((item) => {
    const expected = byLocation.get(item.location);
    if (!expected) return [{ location: item.location, reason: "not-grandfathered" as const }];
    if (expected !== item.specificationSha256) return [{ location: item.location, reason: "specification-changed" as const }];
    return [];
  });
}

/** Create the immutable allowlist only at explicit initialization/upgrade.
 * Verification never enrolls or rebaselines current filesystem content. */
export function reconcileLegacySpecificationInventory(
  projectRoot: string,
  mode: "initialize" | "verify",
): LegacySpecificationInventoryResult {
  const path = LEGACY_SPECIFICATION_INVENTORY;
  try {
    const current = discoverGrandfatherableLegacySpecifications(projectRoot);
    const accepted = readInventory(projectRoot);
    if (!accepted) {
      if (mode === "verify") {
        return current.length
          ? { status: "required", path, accepted: 0, violations: current.map((item) => ({ location: item.location, reason: "not-grandfathered" })) }
          : { status: "not-required", path, accepted: 0, violations: [] };
      }
      const created: LegacySpecificationInventory = { schemaVersion: 1, specifications: current };
      writeInventoryOnce(projectRoot, created);
      return { status: "created", path, accepted: current.length, violations: [] };
    }
    return { status: "verified", path, accepted: accepted.specifications.length, violations: violations(accepted, current) };
  } catch (error) {
    return { status: "blocked", path, accepted: 0, violations: [], detail: error instanceof Error ? error.message : String(error) };
  }
}

/** Require one exact frozen grandfathered specification for new planning or
 * admission. Existing owned version-1 Episodes use their persisted identity. */
function completedLegacyLocation(projectRoot: string, location: string): boolean {
  if (readAllEpisodeOwnership(projectRoot).some((record) => record.version === 1
    && record.status === "inactive" && record.sourceLocation === location)) return true;
  const match = SAFE_LOCATION.exec(location);
  if (!match) return false;
  try {
    const archived = lstatSync(join(projectRoot, ".ralph", "plans", "archive", match[1]));
    return archived.isDirectory() && !archived.isSymbolicLink();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function assertGrandfatheredLegacySpecificationFile(
  projectRoot: string,
  location: string,
  specificationPath: string,
): void {
  const accepted = readInventory(projectRoot);
  if (!accepted) {
    throw new Error("Retained legacy work requires explicit Prime Claw initialization; use the selected-provider task UX for new work");
  }
  if (completedLegacyLocation(projectRoot, location)) {
    throw new Error(`${location} is completed legacy history; use the selected-provider task UX for new work`);
  }
  const entry = accepted.specifications.find((item) => item.location === location);
  if (!entry) {
    throw new Error(`${location} is not grandfathered; use the selected-provider task UX for new work`);
  }
  const bytes = regularReadableBytes(specificationPath);
  if (!bytes || digest(bytes) !== entry.specificationSha256) {
    throw new Error(`${location}/SPECIFICATION.md changed after grandfathering; restore the accepted specification or use the selected-provider task UX`);
  }
}

export function assertGrandfatheredLegacySpecification(projectRoot: string, location: string): void {
  const folder = requireSafeFutureLocation(projectRoot, location);
  assertGrandfatheredLegacySpecificationFile(
    projectRoot,
    location,
    join(folder, "SPECIFICATION.md"),
  );
}
