import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TSchema } from "typebox";

/**
 * Native specification interviews plus the trusted, durable disposition bridge.
 *
 * Slice 1 established durable preflight. Slice 2 executes only the approved
 * future-incubation transaction under a project lock. Episode disposition
 * remains preflight-only until the later allocation slices.
 */

const CONTEXT_TAG = "operator-specification-context";
const CONTROL_DIR = "prime-claw";
const MAX_DOCUMENT_CHARS = 2_000_000;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;
const SAFE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const SAFE_BRANCH = /^(?:feature|spec|poc)\/[a-z0-9](?:[a-z0-9._\/-]{0,125}[a-z0-9])?$/;
const GIT_OID = /^[0-9a-f]{40,64}$/;
const SECURE_FS_HELPER = fileURLToPath(new URL("../helpers/specification-episode-fs.py", import.meta.url));

function secureFs<T extends Record<string, unknown>>(request: Record<string, unknown>): T {
  try {
    const output = execFileSync("python3", [SECURE_FS_HELPER], {
      encoding: "utf8",
      input: canonicalJson(request),
      maxBuffer: 16 * 1024 * 1024,
      timeout: 30_000,
    });
    const result = object(JSON.parse(output), "secure filesystem helper result");
    if (result.ok !== true) throw new Error(typeof result.error === "string" ? result.error : "unknown helper failure");
    return result as T;
  } catch (error) {
    const failure = error as { stderr?: string; stdout?: string };
    const stderr = failure.stderr?.trim();
    let diagnostic = stderr || failure.stdout?.trim() || errorMessage(error);
    try {
      const parsed = object(JSON.parse(failure.stdout ?? ""), "secure filesystem helper failure");
      if (typeof parsed.error === "string") diagnostic = parsed.error;
    } catch {
      // Keep the process diagnostic when stdout is not structured JSON.
    }
    throw new Error(`secure filesystem helper failed: ${diagnostic}`);
  }
}

function secureRelative(root: string, path: string): string {
  const rel = relative(root, path);
  if (!rel || rel.startsWith("..") || rel.startsWith("/")) throw new Error(`secure path escapes root: ${path}`);
  return rel.split("\\").join("/");
}

export interface DispositionParams {
  request_id: string;
  confirmed_by_operator: boolean;
  decision: {
    kind: "future" | "episode";
    slug: string;
    branch_name?: string;
  };
  documents: {
    specification_markdown: string;
    requirements_markdown: string;
    decisions_markdown: string;
  };
  recovery_action?: "inspect" | "continue" | "remove-owned-uncommitted";
}

// Raw JSON Schema avoids a runtime dependency for ordinary Node acceptance
// tests. It is equivalent to TypeBox output. An enum plus trusted cross-field
// validation is used instead of Type.Union/Type.Literal, which Prime Agent 0.9.5
// documents as incompatible with Google tool schemas.
export const dispositionParameters = {
  type: "object",
  properties: {
    request_id: {
      type: "string",
      minLength: 8,
      maxLength: 128,
      description: "Stable caller request identifier for retry and collision detection",
    },
    confirmed_by_operator: {
      type: "boolean",
      description: "Must be true only after the operator explicitly chooses a disposition",
    },
    decision: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["future", "episode"],
          description: "The operator's explicit disposition",
        },
        slug: { type: "string", minLength: 1, maxLength: 63 },
        branch_name: {
          type: "string",
          minLength: 3,
          maxLength: 128,
          description: "Required only for episode disposition",
        },
      },
      required: ["kind", "slug"],
      additionalProperties: false,
    },
    recovery_action: {
      type: "string",
      enum: ["inspect", "continue", "remove-owned-uncommitted"],
      description: "Explicit operator-approved recovery for an interrupted future transaction",
    },
    documents: {
      type: "object",
      properties: {
        specification_markdown: { type: "string", minLength: 1, maxLength: MAX_DOCUMENT_CHARS },
        requirements_markdown: { type: "string", minLength: 1, maxLength: MAX_DOCUMENT_CHARS },
        decisions_markdown: { type: "string", minLength: 1, maxLength: MAX_DOCUMENT_CHARS },
      },
      required: ["specification_markdown", "requirements_markdown", "decisions_markdown"],
      additionalProperties: false,
    },
  },
  required: ["request_id", "confirmed_by_operator", "decision", "documents"],
  additionalProperties: false,
} as const;

function skillMarkdown(cwd: string, name: "design" | "spec-it-out"): { path: string; body: string } | null {
  const path = join(cwd, ".ralph", "skills", name, "SKILL.md");
  if (!existsSync(path)) return null;
  return { path, body: readFileSync(path, "utf8") };
}

function injectSkill(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  name: "design" | "spec-it-out",
  operatorContext: string,
): void {
  const skill = skillMarkdown(ctx.cwd, name);
  if (!skill) {
    ctx.ui.notify(`specification-episodes: .ralph/skills/${name}/SKILL.md not found`, "warning");
    return;
  }
  const wrapped = `<skill name="${name}" location="${skill.path}">
References are relative to ${dirname(skill.path)}.

${skill.body}
</skill>`;
  const context = operatorContext.trim();
  const contextBlock = context
    ? `\n\n<${CONTEXT_TAG}>\n${context}\n</${CONTEXT_TAG}>`
    : "";
  pi.sendUserMessage(`${wrapped}${contextBlock}`);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function sameStrings(actual: string[], expected: string[]): boolean {
  return [...actual].sort().join("\0") === [...expected].sort().join("\0");
}

function porcelainPaths(output: string): string[] {
  const records = output.split("\0").filter(Boolean);
  const paths: string[] = [];
  for (const record of records) {
    if (record.length >= 4 && record[2] === " ") paths.push(record.slice(3));
    else paths.push(record);
  }
  return paths;
}

function exactKeys(value: Record<string, unknown>, allowed: string[], label: string): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length) throw new Error(`${label} contains unsupported field(s): ${unexpected.join(", ")}`);
}

function exactShape(value: Record<string, unknown>, keys: string[], label: string): void {
  exactKeys(value, keys, label);
  const missing = keys.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  if (missing.length) throw new Error(`${label} is missing required field(s): ${missing.join(", ")}`);
}

function exactHash(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) throw new Error(`${label} must be a SHA-256 hash`);
  return value;
}

function exactOid(value: unknown, label: string): string {
  if (typeof value !== "string" || !GIT_OID.test(value)) throw new Error(`${label} must be a Git object ID`);
  return value;
}

function exactTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be an RFC3339 UTC timestamp`);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/.exec(value);
  if (!match) throw new Error(`${label} must be an RFC3339 UTC timestamp`);
  const [, year, month, day, hour, minute, second] = match;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || Number(month) < 1 || Number(month) > 12
    || Number(day) < 1 || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    throw new Error(`${label} must be a calendar-valid RFC3339 UTC timestamp`);
  }
  const parsed = new Date(milliseconds);
  if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() + 1 !== Number(month)
    || parsed.getUTCDate() !== Number(day) || parsed.getUTCHours() !== Number(hour)
    || parsed.getUTCMinutes() !== Number(minute) || parsed.getUTCSeconds() !== Number(second)) {
    throw new Error(`${label} must be a calendar-valid RFC3339 UTC timestamp`);
  }
  return value;
}

function requiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || value.includes("\0")) {
    throw new Error(`${label} must be a non-empty string of at most ${maxLength} characters without NUL bytes`);
  }
  return value;
}

export function validateDispositionParams(value: unknown): DispositionParams {
  const root = object(value, "spec_disposition input");
  exactKeys(root, ["request_id", "confirmed_by_operator", "decision", "documents", "recovery_action"], "spec_disposition input");

  const requestId = requiredString(root.request_id, "request_id", 128);
  if (!REQUEST_ID.test(requestId)) {
    throw new Error("request_id must be 8-128 safe characters: letters, digits, dot, underscore, or hyphen");
  }
  if (root.confirmed_by_operator !== true) {
    throw new Error("explicit operator confirmation is required before disposition preflight");
  }

  const decision = object(root.decision, "decision");
  exactKeys(decision, ["kind", "slug", "branch_name"], "decision");
  if (decision.kind !== "future" && decision.kind !== "episode") {
    throw new Error("decision.kind must be exactly future or episode");
  }
  const slug = requiredString(decision.slug, "decision.slug", 63);
  if (!SAFE_SLUG.test(slug)) {
    throw new Error("decision.slug must be a lowercase filesystem-safe slug without traversal or metacharacters");
  }

  let branchName: string | undefined;
  if (decision.kind === "future") {
    if (decision.branch_name !== undefined) {
      throw new Error("decision.branch_name is not allowed for future disposition");
    }
  } else {
    branchName = requiredString(decision.branch_name, "decision.branch_name", 128);
    if (!SAFE_BRANCH.test(branchName) || branchName.includes("..") || branchName.includes("//") || branchName.includes("@{")) {
      throw new Error("decision.branch_name must be a safe feature/, spec/, or poc/ branch name");
    }
  }

  let recoveryAction: DispositionParams["recovery_action"];
  if (root.recovery_action !== undefined) {
    if (!['inspect', 'continue', 'remove-owned-uncommitted'].includes(String(root.recovery_action))) {
      throw new Error("recovery_action must be inspect, continue, or remove-owned-uncommitted");
    }
    if (decision.kind !== "future") throw new Error("recovery_action is allowed only for future disposition");
    recoveryAction = root.recovery_action as DispositionParams["recovery_action"];
  }

  const documents = object(root.documents, "documents");
  exactKeys(
    documents,
    ["specification_markdown", "requirements_markdown", "decisions_markdown"],
    "documents",
  );

  return {
    request_id: requestId,
    confirmed_by_operator: true,
    decision: { kind: decision.kind, slug, ...(branchName ? { branch_name: branchName } : {}) },
    documents: {
      specification_markdown: requiredString(
        documents.specification_markdown,
        "documents.specification_markdown",
        MAX_DOCUMENT_CHARS,
      ),
      requirements_markdown: requiredString(
        documents.requirements_markdown,
        "documents.requirements_markdown",
        MAX_DOCUMENT_CHARS,
      ),
      decisions_markdown: requiredString(
        documents.decisions_markdown,
        "documents.decisions_markdown",
        MAX_DOCUMENT_CHARS,
      ),
    },
    ...(recoveryAction ? { recovery_action: recoveryAction } : {}),
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function controlLocation(path: string): {
  root: string; relativePath: string; rootIdentity: FilesystemIdentity; parentIdentity: FilesystemIdentity;
} {
  const marker = `/${CONTROL_DIR}/`;
  const normalized = path.split("\\").join("/");
  const index = normalized.lastIndexOf(marker);
  if (index <= 0) throw new Error(`path is not beneath the Prime Claw control root: ${path}`);
  const root = normalized.slice(0, index);
  return {
    root,
    relativePath: normalized.slice(index + 1),
    rootIdentity: directoryAuthority(root),
    parentIdentity: directoryAuthority(dirname(normalized)),
  };
}

interface DurableJsonEvidence {
  value: Record<string, unknown>;
  text: string;
  sha256: string;
  identity: FilesystemIdentity;
}

function parseStrictJson(text: string, label: string): Record<string, unknown> {
  const parsed = secureFs<{ value: unknown }>({ operation: "parse-json", text });
  return object(parsed.value, label);
}

function readDurableJsonEvidence(path: string): DurableJsonEvidence {
  try {
    const location = controlLocation(path);
    const result = secureFs<{ text: string; sha256: string; identity: unknown }>({
      operation: "read-file",
      root: location.root,
      path: location.relativePath,
      root_identity: location.rootIdentity,
      parent_identity: location.parentIdentity,
    });
    if (result.sha256 !== sha256(result.text)) throw new Error("control read returned inconsistent hash evidence");
    return {
      value: parseStrictJson(result.text, `durable receipt ${path}`),
      text: result.text,
      sha256: result.sha256,
      identity: identity(result.identity, `durable receipt identity ${path}`),
    };
  } catch (error) {
    throw new Error(`corrupt durable receipt at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readDurableJson(path: string): Record<string, unknown> {
  return readDurableJsonEvidence(path).value;
}

interface FilesystemIdentity {
  version: 2;
  platform: "darwin" | "linux";
  device: string;
  inode: string;
  birthtime_ns: string;
  mount_id: string | null;
}

const DIRECTORY_AUTHORITIES = new Map<string, FilesystemIdentity>();

function bindDirectoryAuthority(path: string, value: unknown, label: string): FilesystemIdentity {
  const observed = identity(value, label);
  const key = path.split("\\").join("/");
  const prior = DIRECTORY_AUTHORITIES.get(key);
  if (prior && canonicalJson(prior) !== canonicalJson(observed)) {
    throw new Error(`${label} incarnation changed`);
  }
  DIRECTORY_AUTHORITIES.set(key, observed);
  return observed;
}

function directoryAuthority(path: string): FilesystemIdentity {
  const key = path.split("\\").join("/");
  const prior = DIRECTORY_AUTHORITIES.get(key);
  if (prior) return prior;
  const observed = secureFs<{ identity: unknown }>({ operation: "directory-identity", path: key });
  return bindDirectoryAuthority(key, observed.identity, `directory authority ${key}`);
}

function identity(value: unknown, label: string): FilesystemIdentity {
  const record = object(value, label);
  exactKeys(record, ["version", "platform", "device", "inode", "birthtime_ns", "mount_id"], label);
  if (record.version !== 2 || (record.platform !== "darwin" && record.platform !== "linux")) {
    throw new Error(`${label} has an unsupported identity version or platform`);
  }
  for (const key of ["device", "inode", "birthtime_ns"] as const) {
    if (typeof record[key] !== "string" || !/^[0-9]+$/.test(record[key] as string)) throw new Error(`${label} is invalid`);
  }
  if (record.mount_id !== null && (typeof record.mount_id !== "string" || !/^[0-9]+$/.test(record.mount_id))) {
    throw new Error(`${label} mount identity is invalid`);
  }
  if (record.platform === "linux" && record.mount_id === null) throw new Error(`${label} lacks Linux mount identity`);
  if (record.platform === "darwin" && record.mount_id !== null) throw new Error(`${label} has unexpected macOS mount identity`);
  return {
    version: 2,
    platform: record.platform,
    device: record.device as string,
    inode: record.inode as string,
    birthtime_ns: record.birthtime_ns as string,
    mount_id: record.mount_id as string | null,
  };
}

function validateSessionFile(path: string, sessionId: string, cwd: string): string {
  let resolved: string;
  let header: Record<string, unknown>;
  try {
    resolved = realpathSync(path);
    const fd = openSync(resolved, "r");
    const buffer = Buffer.alloc(65_536);
    let bytesRead: number;
    try {
      bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
    } finally {
      closeSync(fd);
    }
    const prefix = buffer.subarray(0, bytesRead).toString("utf8");
    const newline = prefix.indexOf("\n");
    if (newline < 0) throw new Error("session header exceeds 65535 bytes or is incomplete");
    header = object(JSON.parse(prefix.slice(0, newline).replace(/\r$/, "")), "Prime Agent session header");
  } catch (error) {
    throw new Error(`persisted Prime Agent session file is missing or invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (header.type !== "session" || header.id !== sessionId) {
    throw new Error("persisted Prime Agent session header does not match the stable owner session ID");
  }
  if (typeof header.cwd !== "string" || realpathSync(header.cwd) !== cwd) {
    throw new Error("persisted Prime Agent session header does not match the canonical checkout CWD");
  }
  return resolved;
}

/** Create one complete JSON file without ever replacing an existing receipt. */
function createDurableJson(path: string, value: unknown): boolean {
  const location = controlLocation(path);
  const result = secureFs<{ created: boolean }>({
    operation: "create-json",
    root: location.root,
    path: location.relativePath,
    root_identity: location.rootIdentity,
    parent_identity: location.parentIdentity,
    quarantine_identity: directoryAuthority(ensureControlDirectory(location.root, "quarantine")),
    text: canonicalJson(value),
  });
  return result.created;
}

export function ensureControlDirectory(commonDir: string, name?: string): string {
  if (name !== undefined && !/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error(`invalid Prime Claw control directory name: ${name}`);
  }
  const rootIdentity = directoryAuthority(commonDir);
  const parentPath = name ? ensureControlDirectory(commonDir) : commonDir;
  const parentIdentity = directoryAuthority(parentPath);
  const relativePath = name ? `${CONTROL_DIR}/${name}` : CONTROL_DIR;
  const targetPath = join(commonDir, relativePath);
  const expected = DIRECTORY_AUTHORITIES.get(targetPath.split("\\").join("/"));
  const result = secureFs<{ identity: unknown }>({
    operation: "ensure-directory", repo: commonDir, path: relativePath,
    root_identity: rootIdentity, parent_identity: parentIdentity,
    expected_identity: expected ?? null,
  });
  bindDirectoryAuthority(targetPath, result.identity, `control directory ${targetPath}`);
  return targetPath;
}
function controlFilePath(commonDir: string, child: string, filename: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) throw new Error("invalid Prime Claw control filename");
  return join(ensureControlDirectory(commonDir, child), filename);
}

function replaceDurableJson(path: string, value: unknown): void {
  const location = controlLocation(path);
  const observed = secureFs<{ exists: boolean; identity?: unknown }>({
    operation: "read-file", root: location.root, path: location.relativePath, allow_missing: true,
    root_identity: location.rootIdentity, parent_identity: location.parentIdentity,
  });
  secureFs<Record<string, unknown>>({
    operation: "replace-json",
    root: location.root,
    path: location.relativePath,
    root_identity: location.rootIdentity,
    parent_identity: location.parentIdentity,
    quarantine_identity: directoryAuthority(ensureControlDirectory(location.root, "quarantine")),
    text: canonicalJson(value),
    expected_identity: observed.exists ? identity(observed.identity, "control state replacement identity") : null,
  });
}

function readDurableFile(path: string): string {
  const location = controlLocation(path);
  return secureFs<{ text: string }>({
    operation: "read-file",
    root: location.root,
    path: location.relativePath,
    root_identity: location.rootIdentity,
    parent_identity: location.parentIdentity,
  }).text;
}

export function removeDurableFile(path: string, approved?: DurableJsonEvidence): void {
  const location = controlLocation(path);
  const observed = approved ?? readDurableJsonEvidence(path);
  const approvedIdentity = identity(observed.identity, "control state retirement identity");
  const retirementKey = sha256(canonicalJson({ sha256: observed.sha256, identity: approvedIdentity })).slice(0, 32);
  const request = {
    operation: "remove-file",
    root: location.root,
    path: location.relativePath,
    root_identity: location.rootIdentity,
    parent_identity: location.parentIdentity,
    quarantine_identity: directoryAuthority(ensureControlDirectory(location.root, "quarantine")),
    sha256: observed.sha256,
    identity: approvedIdentity,
    retired_name: `control-${retirementKey}`,
  };
  try {
    secureFs<Record<string, unknown>>(request);
  } catch {
    // The helper transition is deterministic and idempotent. A retry reconciles
    // a lost response by validating the exact retained object, never by rereading
    // the canonical name as new authority.
    secureFs<Record<string, unknown>>(request);
  }
}

async function retireApprovedBlocker(
  pi: ExtensionAPI,
  path: string,
  approved: DurableJsonEvidence,
): Promise<void> {
  try {
    removeDurableFile(path, approved);
    await testFault(pi, "after-success-blocker-retirement");
  } catch {
    // Reconcile the stable destination and exact approved authority. A new
    // canonical blocker is never reread or adopted by this retry.
    removeDurableFile(path, approved);
  }
}

async function testFault(pi: ExtensionAPI, phase: string): Promise<void> {
  const hook = (pi as ExtensionAPI & {
    __primeClawSpecificationFault?: (phase: string) => void | Promise<void>;
  }).__primeClawSpecificationFault;
  if (hook) await hook(phase);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ProjectLock {
  path: string;
  token: string;
  ownerPath: string;
  lockIdentity: FilesystemIdentity;
  ownerIdentity: FilesystemIdentity;
  guardIdentity: FilesystemIdentity;
  ownerSha256: string;
  brokerSocket: string;
  authoritySocket: string;
  recoverAbandoned?: boolean;
}

class LockContentionError extends Error {
  readonly lockPath: string;
  readonly owner: Record<string, unknown> | null;

  constructor(lockPath: string, owner: Record<string, unknown> | null) {
    super(`project mutation lock is held at ${lockPath}`);
    this.lockPath = lockPath;
    this.owner = owner;
  }
}

export function acquireProjectLock(
  lockPath: string,
  dispositionId: string,
  ownerSessionId: string,
  allowAbandonedRecovery = false,
): ProjectLock {
  ensureControlDirectory(controlLocation(lockPath).root, "locks");
  const token = randomUUID();
  const owner = {
    version: 2,
    token,
    disposition_id: dispositionId,
    owner_session_id: ownerSessionId,
    pid: process.pid,
    acquired_at: new Date().toISOString(),
  };
  const ownerText = canonicalJson(owner);
  const ownerSha256 = sha256(ownerText);
  const location = controlLocation(lockPath);
  const quarantineIdentity = directoryAuthority(ensureControlDirectory(location.root, "quarantine"));
  let acquired: { created: boolean; lock_identity?: unknown; owner_identity?: unknown; guard_identity?: unknown; owner_sha256?: string; broker_socket?: string; authority_socket?: string };
  try {
    acquired = secureFs({
      operation: "acquire-lock",
      root: location.root,
      path: location.relativePath,
      root_identity: location.rootIdentity,
      parent_identity: location.parentIdentity,
      quarantine_identity: quarantineIdentity,
      owner_text: ownerText,
    });
  } catch (error) {
    // Publication may have completed before the helper response failed. Reconcile
    // only the exact caller-generated token/bytes; never retire a competing lock.
    try {
      const reconciled = secureFs<{ exists: boolean; complete?: boolean; lock_identity?: unknown; owner_identity?: unknown; guard_identity?: unknown; owner_sha256?: string; broker_socket?: string; authority_socket?: string }>({
        operation: "reconcile-lock", root: location.root, path: location.relativePath,
        root_identity: location.rootIdentity, parent_identity: location.parentIdentity,
        token, owner_sha256: ownerSha256,
      });
      if (reconciled.exists && reconciled.complete) {
        releaseProjectLock({
          path: lockPath, token, ownerPath: join(lockPath, "owner.json"),
          lockIdentity: identity(reconciled.lock_identity, "reconciled project lock identity"),
          ownerIdentity: identity(reconciled.owner_identity, "reconciled project lock owner identity"),
          guardIdentity: identity(reconciled.guard_identity, "reconciled stable lock guard identity"),
          ownerSha256,
          brokerSocket: requiredString(reconciled.broker_socket, "reconciled project lock broker socket"),
          authoritySocket: requiredString(reconciled.authority_socket, "reconciled project lock authority socket"),
        });
      } else if (reconciled.exists) {
        const guardPath = `${lockPath}.guard`;
        const guardLocation = controlLocation(guardPath);
        const guardIdentity = identity(reconciled.guard_identity, "partial stable lock guard identity");
        const retirementKey = sha256(canonicalJson({ sha256: ownerSha256, identity: guardIdentity })).slice(0, 32);
        secureFs<Record<string, unknown>>({
          operation: "remove-file", root: guardLocation.root, path: guardLocation.relativePath,
          root_identity: guardLocation.rootIdentity, parent_identity: guardLocation.parentIdentity,
          quarantine_identity: quarantineIdentity, sha256: ownerSha256, identity: guardIdentity,
          retired_name: `failed-lock-guard-${retirementKey}`,
        });
      }
    } catch {
      // Ambiguous state remains fail-closed and is never stolen.
    }
    throw error;
  }
  if (!acquired.created) {
    let existingOwner: Record<string, unknown> | null = null;
    try {
      existingOwner = readDurableJson(join(lockPath, "owner.json"));
    } catch {
      // Ambiguous lock metadata is contention and is never stolen.
    }
    if (allowAbandonedRecovery && existingOwner?.disposition_id === dispositionId && existingOwner?.owner_session_id === ownerSessionId && typeof existingOwner.token === "string") {
      try {
        const approvedOwner = readDurableJsonEvidence(join(lockPath, "owner.json"));
        const reconciled = secureFs<{ exists: boolean; complete?: boolean; abandoned?: boolean; lock_identity?: unknown; owner_identity?: unknown; guard_identity?: unknown; broker_socket?: string; authority_socket?: string }>({
          operation: "reconcile-lock", root: location.root, path: location.relativePath,
          root_identity: location.rootIdentity, parent_identity: location.parentIdentity,
          token: existingOwner.token, owner_sha256: approvedOwner.sha256, allow_inactive: true,
        });
        if (reconciled.exists && reconciled.complete && reconciled.abandoned === true) {
          releaseProjectLock({
            path: lockPath, token: existingOwner.token, ownerPath: join(lockPath, "owner.json"),
            lockIdentity: identity(reconciled.lock_identity, "abandoned project lock identity"),
            ownerIdentity: identity(reconciled.owner_identity, "abandoned project lock owner identity"),
            guardIdentity: identity(reconciled.guard_identity, "abandoned project lock guard identity"),
            ownerSha256: approvedOwner.sha256,
            brokerSocket: requiredString(reconciled.broker_socket, "abandoned broker socket", 512),
            authoritySocket: requiredString(reconciled.authority_socket, "abandoned authority socket", 512),
            recoverAbandoned: true,
          });
          return acquireProjectLock(lockPath, dispositionId, ownerSessionId, false);
        }
      } catch {
        // Exact abandoned-state recovery is optional and fail-closed.
      }
    }
    throw new LockContentionError(lockPath, existingOwner);
  }
  if (typeof acquired.owner_sha256 !== "string" || acquired.owner_sha256 !== ownerSha256) {
    throw new Error("secure lock acquisition returned invalid owner evidence");
  }
  if (typeof acquired.broker_socket !== "string" || !/^\/.*\/prime-claw-lock-[0-9a-f]{32}\.sock$/.test(acquired.broker_socket)
    || typeof acquired.authority_socket !== "string" || !/^\/.*\/prime-claw-lock-[0-9a-f]{32}\.sock$/.test(acquired.authority_socket)) {
    throw new Error("secure lock acquisition returned invalid replicated authority evidence");
  }
  const lock = {
    path: lockPath,
    token,
    ownerPath: join(lockPath, "owner.json"),
    lockIdentity: identity(acquired.lock_identity, "project lock identity"),
    ownerIdentity: identity(acquired.owner_identity, "project lock owner identity"),
    guardIdentity: identity(acquired.guard_identity, "stable project lock guard identity"),
    ownerSha256: acquired.owner_sha256,
    brokerSocket: acquired.broker_socket,
    authoritySocket: acquired.authority_socket,
  };
  try {
    secureFs<Record<string, unknown>>({
      operation: "validate-lock", root: location.root, path: location.relativePath, token,
      root_identity: location.rootIdentity, parent_identity: location.parentIdentity,
      lock_identity: lock.lockIdentity, owner_identity: lock.ownerIdentity, guard_identity: lock.guardIdentity, owner_sha256: lock.ownerSha256, broker_socket: lock.brokerSocket, authority_socket: lock.authoritySocket,
    });
  } catch (error) {
    try { releaseProjectLock(lock); } catch { /* exact lock remains recoverable; no competitor is retired */ }
    throw error;
  }
  return lock;
}

export function validateProjectLock(lock: ProjectLock): void {
  const location = controlLocation(lock.path);
  secureFs<Record<string, unknown>>({
    operation: "validate-lock", root: location.root, path: location.relativePath, token: lock.token,
    root_identity: location.rootIdentity, parent_identity: location.parentIdentity,
    lock_identity: lock.lockIdentity, owner_identity: lock.ownerIdentity, guard_identity: lock.guardIdentity, owner_sha256: lock.ownerSha256, broker_socket: lock.brokerSocket, authority_socket: lock.authoritySocket,
  });
}

export function releaseProjectLock(lock: ProjectLock): void {
  const location = controlLocation(lock.path);
  const request = {
    operation: "remove-lock",
    root: location.root,
    path: location.relativePath,
    root_identity: location.rootIdentity,
    parent_identity: location.parentIdentity,
    quarantine_identity: directoryAuthority(ensureControlDirectory(location.root, "quarantine")),
    token: lock.token,
    lock_identity: lock.lockIdentity,
    owner_identity: lock.ownerIdentity,
    guard_identity: lock.guardIdentity,
    owner_sha256: lock.ownerSha256,
    broker_socket: lock.brokerSocket, authority_socket: lock.authoritySocket,
    recover_abandoned: lock.recoverAbandoned === true,
  };
  try { secureFs<Record<string, unknown>>(request); }
  catch { secureFs<Record<string, unknown>>(request); }
}


function validateFutureTargetDirectory(futureRoot: string, targetDir: string): void {
  if (!existsSync(targetDir)) return;
  const stat = lstatSync(targetDir);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error("future bundle target must be a real directory, not a symlink or other file");
  }
  const resolved = realpathSync(targetDir);
  const rel = relative(futureRoot, resolved);
  if (rel.startsWith("..") || rel === "" || rel.startsWith("/") || rel.includes("/")) {
    throw new Error("future bundle target escapes its named directory");
  }
}

function validateOwnedBundle(
  futureRoot: string,
  targetDir: string,
  documents: DispositionParams["documents"],
): Record<string, string> {
  validateFutureTargetDirectory(futureRoot, targetDir);
  const expected: Record<string, string> = {
    "SPECIFICATION.md": documents.specification_markdown,
    "REQUIREMENTS.md": documents.requirements_markdown,
    "DECISIONS.md": documents.decisions_markdown,
  };
  const names = readdirSync(targetDir).sort();
  if (!sameStrings(names, Object.keys(expected))) {
    throw new Error(`future bundle contains unexpected or missing entries: ${names.join(", ") || "(empty)"}`);
  }
  const hashes: Record<string, string> = {};
  for (const [name, content] of Object.entries(expected)) {
    const path = join(targetDir, name);
    if (lstatSync(path).isSymbolicLink()) throw new Error(`future bundle file is a symlink: ${name}`);
    const actual = readFileSync(path, "utf8");
    if (actual !== content) throw new Error(`future bundle ownership mismatch for ${name}`);
    hashes[name] = sha256(actual);
  }
  return hashes;
}

function validateRemovableOwnedBundle(
  futureRoot: string,
  targetDir: string,
  documents: DispositionParams["documents"],
): void {
  validateFutureTargetDirectory(futureRoot, targetDir);
  const expected: Record<string, string> = {
    "SPECIFICATION.md": documents.specification_markdown,
    "REQUIREMENTS.md": documents.requirements_markdown,
    "DECISIONS.md": documents.decisions_markdown,
  };
  if (!existsSync(targetDir)) return;
  const names = readdirSync(targetDir);
  if (names.some((name) => !(name in expected))) {
    throw new Error(`future bundle contains non-owned entries: ${names.join(", ")}`);
  }
  for (const name of names) {
    const path = join(targetDir, name);
    if (lstatSync(path).isSymbolicLink() || readFileSync(path, "utf8") !== expected[name]) {
      throw new Error(`refusing to remove non-owned content: ${name}`);
    }
  }
}

function ensureFutureRoot(cwd: string, create = true): string {
  const ralphRootPath = join(cwd, ".ralph");
  const plansRootPath = join(ralphRootPath, "plans");
  if (lstatSync(ralphRootPath).isSymbolicLink() || lstatSync(plansRootPath).isSymbolicLink()) {
    throw new Error(".ralph and .ralph/plans must not be symlinks");
  }
  const plansRoot = realpathSync(plansRootPath);
  const plansRelative = relative(cwd, plansRoot);
  if (plansRelative.startsWith("..") || plansRelative.startsWith("/")) {
    throw new Error(".ralph/plans escapes the canonical checkout");
  }
  const futureRoot = join(plansRoot, "future");
  if (existsSync(futureRoot) && lstatSync(futureRoot).isSymbolicLink()) {
    throw new Error("future plans root must not be a symlink");
  }
  if (create) secureFs<Record<string, unknown>>({
    operation: "ensure-directory",
    repo: cwd,
    path: join(".ralph", "plans", "future").split("\\").join("/"),
  });
  const resolved = existsSync(futureRoot) ? realpathSync(futureRoot) : futureRoot;
  const rel = relative(plansRoot, resolved);
  if (rel.startsWith("..") || rel === "" || rel.startsWith("/")) {
    throw new Error("future plans root escapes .ralph/plans");
  }
  return resolved;
}

async function git(
  pi: ExtensionAPI,
  cwd: string,
  args: string[],
  signal: AbortSignal | undefined,
  env?: NodeJS.ProcessEnv,
): Promise<string> {
  if (signal?.aborted) throw new Error("spec_disposition cancelled before durable preflight");
  const result = await pi.exec("git", ["-C", cwd, ...args], {
    cwd,
    signal,
    timeout: args[0] === "push" ? 60_000 : 15_000,
    ...(env ? { env } : {}),
  });
  if (result.killed || result.code !== 0) {
    const diagnostic = (result.stderr || result.stdout).trim();
    throw new Error(`git ${args.join(" ")} failed (${result.code}): ${diagnostic || "no diagnostic"}`);
  }
  return result.stdout.trimEnd();
}

interface CanonicalState {
  repoRoot: string;
  commonDir: string;
  currentBranch: string;
  upstream: string;
  remote: string;
  remoteBranch: string;
  defaultRemoteBranch: string;
  head: string;
  upstreamHead: string;
  status: string;
}

async function inspectCanonicalRepository(
  pi: ExtensionAPI,
  cwd: string,
  signal: AbortSignal | undefined,
): Promise<CanonicalState> {
  const repoRoot = realpathSync((await git(pi, cwd, ["rev-parse", "--show-toplevel"], signal)).trim());
  if (repoRoot !== cwd) throw new Error("spec_disposition must run from the repository root");
  const commonDir = realpathSync((await git(
    pi, cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"], signal,
  )).trim());
  const gitDir = realpathSync((await git(
    pi, cwd, ["rev-parse", "--path-format=absolute", "--git-dir"], signal,
  )).trim());
  if (gitDir !== commonDir) {
    throw new Error("spec_disposition source must be the primary canonical checkout, not a linked worktree");
  }
  const currentBranch = (await git(pi, cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"], signal)).trim();
  const upstream = (await git(
    pi, cwd, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], signal,
  )).trim();
  const slash = upstream.indexOf("/");
  if (slash <= 0) throw new Error("canonical checkout upstream is not a remote-tracking branch");
  const remote = upstream.slice(0, slash);
  const remoteBranch = upstream.slice(slash + 1);
  const defaultRemoteBranch = (await git(
    pi, cwd, ["symbolic-ref", "--quiet", "--short", `refs/remotes/${remote}/HEAD`], signal,
  )).trim();
  if (upstream !== defaultRemoteBranch || currentBranch !== remoteBranch) {
    throw new Error(`spec_disposition source must be on configured remote default branch ${defaultRemoteBranch}`);
  }
  const head = (await git(pi, cwd, ["rev-parse", "HEAD"], signal)).trim();
  const upstreamHead = (await git(pi, cwd, ["rev-parse", "@{upstream}"], signal)).trim();
  const status = await git(pi, cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], signal);
  return {
    repoRoot, commonDir, currentBranch, upstream, remote, remoteBranch,
    defaultRemoteBranch, head, upstreamHead, status,
  };
}

async function gitIsAncestor(
  pi: ExtensionAPI,
  cwd: string,
  ancestor: string,
  descendant: string,
): Promise<boolean> {
  const result = await pi.exec("git", ["-C", cwd, "merge-base", "--is-ancestor", ancestor, descendant], {
    cwd, timeout: 15_000,
  });
  if (result.code === 0) return true;
  if (result.code === 1 && !result.killed) return false;
  throw new Error(`git merge-base --is-ancestor failed (${result.code}): ${(result.stderr || result.stdout).trim()}`);
}

async function requireGitObjectType(
  pi: ExtensionAPI,
  cwd: string,
  oid: string,
  expected: "commit" | "tree" | "blob",
  label: string,
): Promise<void> {
  const actual = (await git(pi, cwd, ["cat-file", "-t", oid], undefined)).trim();
  if (actual !== expected) throw new Error(`${label} must be an unpeeled ${expected}, got ${actual}`);
}

async function remoteRefOid(
  pi: ExtensionAPI,
  cwd: string,
  remote: string,
  remoteBranch: string,
): Promise<string> {
  const output = await git(pi, cwd, ["ls-remote", "--refs", remote, `refs/heads/${remoteBranch}`], undefined);
  const lines = output.split("\n").filter(Boolean);
  if (lines.length !== 1) throw new Error(`configured remote branch ${remote}/${remoteBranch} did not resolve uniquely`);
  const [oid, ref] = lines[0].split(/\s+/);
  if (!/^[0-9a-f]{40,64}$/.test(oid) || ref !== `refs/heads/${remoteBranch}`) {
    throw new Error(`configured remote branch ${remote}/${remoteBranch} returned an invalid object ID`);
  }
  return oid;
}

async function finalRemoteReachability(
  pi: ExtensionAPI,
  cwd: string,
  state: CanonicalState,
  commit: string,
): Promise<string> {
  const before = await remoteRefOid(pi, cwd, state.remote, state.remoteBranch);
  const middle = await remoteRefOid(pi, cwd, state.remote, state.remoteBranch);
  if (before !== middle) throw new Error("actual remote changed during final durability proof");
  if (middle !== commit && !(await gitIsAncestor(pi, cwd, commit, middle))) {
    throw new Error(`verified future commit ${commit} is not reachable from final actual remote ${middle}`);
  }
  const after = await remoteRefOid(pi, cwd, state.remote, state.remoteBranch);
  if (middle !== after) throw new Error("actual remote changed after final durability proof");
  return after;
}

async function commitPaths(pi: ExtensionAPI, cwd: string, commit: string): Promise<string[]> {
  const output = await git(pi, cwd, ["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", commit], undefined);
  return output.split("\0").filter(Boolean);
}

async function validateTreeBundle(
  pi: ExtensionAPI,
  cwd: string,
  treeish: string,
  ownedPaths: string[],
  documents: DispositionParams["documents"],
): Promise<void> {
  const treeOutput = await git(
    pi,
    cwd,
    ["ls-tree", "-r", "-z", "--full-tree", treeish, "--", ...ownedPaths.map((path) => `:(literal)${path}`)],
    undefined,
  );
  const treeEntries = treeOutput.split("\0").filter(Boolean).map((record) => {
    const tab = record.indexOf("\t");
    if (tab < 0) throw new Error("future tree returned an invalid entry");
    const [mode, type, oid] = record.slice(0, tab).split(" ");
    return { mode, type, oid, path: record.slice(tab + 1) };
  });
  if (!sameStrings(treeEntries.map((entry) => entry.path), ownedPaths)) {
    throw new Error("future tree does not contain exactly the owned bundle paths");
  }
  for (const entry of treeEntries) {
    if (entry.mode !== "100644" || entry.type !== "blob" || !GIT_OID.test(entry.oid)) {
      throw new Error(`future tree entry is not an approved regular file: ${entry.path}`);
    }
  }
  const expected = [
    documents.specification_markdown,
    documents.requirements_markdown,
    documents.decisions_markdown,
  ];
  for (let index = 0; index < ownedPaths.length; index += 1) {
    const result = await pi.exec("git", ["-C", cwd, "show", `${treeish}:${ownedPaths[index]}`], {
      cwd, timeout: 15_000,
    });
    if (result.killed || result.code !== 0 || result.stdout !== expected[index]) {
      throw new Error(`future tree content mismatch for ${ownedPaths[index]}`);
    }
  }
}

async function validateCommitBundle(
  pi: ExtensionAPI,
  cwd: string,
  commit: string,
  ownedPaths: string[],
  documents: DispositionParams["documents"],
): Promise<void> {
  if (!sameStrings(await commitPaths(pi, cwd, commit), ownedPaths)) {
    throw new Error("future commit does not contain exactly the owned bundle paths");
  }
  await validateTreeBundle(pi, cwd, commit, ownedPaths, documents);
}

async function findDispositionCommit(
  pi: ExtensionAPI,
  cwd: string,
  dispositionId: string,
  baseHead: string,
  ownedPaths: string[],
): Promise<string | null> {
  const output = await git(
    pi,
    cwd,
    ["log", "--all", "--format=%H", "--fixed-strings", `--grep=Prime-Claw-Disposition: ${dispositionId}`],
    undefined,
  );
  for (const candidate of output.split("\n").filter(Boolean)) {
    const parent = (await git(pi, cwd, ["rev-parse", `${candidate}^`], undefined)).trim();
    if (parent === baseHead && sameStrings(await commitPaths(pi, cwd, candidate), ownedPaths)) return candidate;
  }
  return null;
}

function isRecognizableVerifiedSuccess(transaction: Record<string, unknown>): boolean {
  return transaction.kind === "future-verified-success"
    || transaction.phase === "pushed-and-clean"
    || (transaction.version === 2 && transaction.disposition === "future"
      && transaction.commit !== undefined && transaction.publication !== undefined
      && transaction.receipts !== undefined);
}

const MUTABLE_FUTURE_KEYS = new Set([
  "version", "disposition_id", "payload_fingerprint", "disposition", "slug", "bundle_sha256",
  "owner_session_id", "owner_session_file", "repository_root", "git_common_dir", "current_branch",
  "upstream_branch", "remote_default_branch", "base_head", "remote_base_head", "target_directory",
  "future_root_preexisting", "owned_paths", "status", "phase", "product_resource_mutation_performed",
  "created_at", "next_safe_action", "ownership_receipt_path", "bundle_ownership_receipt_path",
  "document_hashes", "tree_evidence_path", "constructed_tree", "tree_evidence_sha256",
  "commit_object_sha", "commit_sha", "push_target", "remote_oid_before_push", "error", "failed_at",
  "recovery_action_required", "recovery_action", "ownership_consumed_path", "recovered_at",
  "observed_at", "observed_head", "observed_upstream_head", "observed_remote_head",
  "observed_status_paths", "observed_staged_paths", "observed_target_kind", "observed_target_entries",
  "observed_owned_paths", "observed_owned_files", "observed_tree_evidence", "observed_commit",
  "observation_errors", "observation_error",
]);

function isCalendarRfc3339(value: unknown): boolean {
  try { exactTimestamp(value, "mutable transaction timestamp"); return true; }
  catch { return false; }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every((entry) => typeof entry === "string");
}

function isMutablePhase(value: unknown): value is string {
  return typeof value === "string" && (
    ["before-journal", "journal-created", "directory-created", "bundle-ownership-recorded",
      "building-exact-tree", "exact-tree-built", "commit-object-created", "commit-reconciled",
      "advancing-default-ref", "committed", "pushing", "owned-uncommitted-removed"].includes(value)
    || /^writing-(SPECIFICATION|REQUIREMENTS|DECISIONS)\.md$/.test(value)
    || /^wrote-(SPECIFICATION|REQUIREMENTS|DECISIONS)\.md$/.test(value)
  );
}

function mutableFieldTypesAreValid(transaction: Record<string, unknown>): boolean {
  const optionalStrings = ["remote_base_head", "created_at", "ownership_receipt_path",
    "bundle_ownership_receipt_path", "tree_evidence_path", "constructed_tree", "tree_evidence_sha256",
    "commit_object_sha", "commit_sha", "push_target", "remote_oid_before_push", "error", "failed_at",
    "recovery_action", "ownership_consumed_path", "recovered_at", "observed_at", "observed_target_kind",
    "observation_error"];
  if (optionalStrings.some((key) => transaction[key] !== undefined && typeof transaction[key] !== "string")) return false;
  const optionalBooleans = ["future_root_preexisting", "recovery_action_required"];
  if (optionalBooleans.some((key) => transaction[key] !== undefined && typeof transaction[key] !== "boolean")) return false;
  const arrays = ["owned_paths", "observed_status_paths", "observed_staged_paths", "observed_target_entries", "observed_owned_paths", "observation_errors"];
  if (arrays.some((key) => transaction[key] !== undefined && !isStringArray(transaction[key]))) return false;
  if (transaction.observed_target_kind !== undefined && !["missing", "symlink", "other", "directory"].includes(transaction.observed_target_kind as string)) return false;
  if (transaction.document_hashes !== undefined) {
    if (!isStringRecord(transaction.document_hashes)) return false;
    const hashes = transaction.document_hashes as Record<string, string>;
    if (Object.keys(hashes).sort().join(",") !== "DECISIONS.md,REQUIREMENTS.md,SPECIFICATION.md"
      || Object.values(hashes).some((value) => !/^[0-9a-f]{64}$/.test(value))) return false;
  }
  for (const key of ["base_head", "remote_base_head", "constructed_tree", "commit_object_sha", "commit_sha", "remote_oid_before_push"]) {
    if (transaction[key] !== undefined && (typeof transaction[key] !== "string" || !/^[0-9a-f]{40,64}$/.test(transaction[key] as string))) return false;
  }
  for (const key of ["created_at", "failed_at", "recovered_at", "observed_at"]) {
    if (transaction[key] !== undefined && !isCalendarRfc3339(transaction[key])) return false;
  }
  for (const key of ["observed_head", "observed_upstream_head", "observed_remote_head"]) {
    const value = transaction[key]; if (value !== undefined && value !== null && (typeof value !== "string" || !/^[0-9a-f]{40,64}$/.test(value))) return false;
  }
  if (transaction.observed_owned_files !== undefined) {
    if (transaction.observed_owned_files === null || typeof transaction.observed_owned_files !== "object" || Array.isArray(transaction.observed_owned_files)) return false;
    for (const value of Object.values(transaction.observed_owned_files as Record<string, unknown>)) {
      if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
      const entry = value as Record<string, unknown>; const keys = Object.keys(entry).sort().join(",");
      if (entry.kind === "file") {
        if (keys !== "kind,sha256,size" || typeof entry.size !== "number" || !Number.isSafeInteger(entry.size) || entry.size < 0 || typeof entry.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.sha256)) return false;
      } else if ((entry.kind === "symlink" || entry.kind === "other") && keys === "kind") { /* exact */ }
      else return false;
    }
  }
  if (transaction.observed_tree_evidence !== undefined) {
    const value = transaction.observed_tree_evidence;
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>; const keys = Object.keys(record).sort().join(",");
    if (record.exists === false) { if (keys !== "exists") return false; }
    else if (record.exists === true) {
      if (keys !== "exists,path,sha256,size" || typeof record.path !== "string" || typeof record.size !== "number" || !Number.isSafeInteger(record.size) || record.size < 0 || typeof record.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(record.sha256)) return false;
    } else return false;
  }
  if (transaction.observed_commit !== undefined) {
    const value = transaction.observed_commit;
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>; const keys = Object.keys(record).sort().join(",");
    if (record.exists === false) {
      if (keys !== "exists,oid" || (record.oid !== null && (typeof record.oid !== "string" || !/^[0-9a-f]{40,64}$/.test(record.oid)))) return false;
    } else if (record.exists === true) {
      if (keys !== "content_matches,exists,oid,paths" || typeof record.oid !== "string" || !/^[0-9a-f]{40,64}$/.test(record.oid) || !isStringArray(record.paths) || typeof record.content_matches !== "boolean") return false;
    } else return false;
  }
  return isMutablePhase(transaction.phase);
}

function mutablePhaseRank(phase: string): number {
  if (phase === "before-journal" || phase === "journal-created") return 0;
  if (phase === "directory-created") return 1;
  if (/^writing-/.test(phase) || /^wrote-/.test(phase)) return 2;
  if (phase === "bundle-ownership-recorded") return 3;
  if (phase === "building-exact-tree") return 4;
  if (phase === "exact-tree-built") return 5;
  if (phase === "commit-object-created" || phase === "commit-reconciled" || phase === "advancing-default-ref") return 6;
  if (phase === "committed") return 7;
  if (phase === "pushing") return 8;
  if (phase === "owned-uncommitted-removed") return 9;
  return -1;
}

export function isKnownMutableFutureTransaction(transaction: Record<string, unknown>): boolean {
  const keys = Object.keys(transaction);
  if (keys.some((key) => !MUTABLE_FUTURE_KEYS.has(key))) return false;
  const requiredStrings = [
    "disposition_id", "payload_fingerprint", "slug", "bundle_sha256", "owner_session_id",
    "owner_session_file", "repository_root", "git_common_dir", "current_branch", "upstream_branch",
    "remote_default_branch", "base_head", "target_directory", "phase",
    "next_safe_action",
  ];
  if (requiredStrings.some((key) => typeof transaction[key] !== "string")) return false;
  if (transaction.version !== 1 || transaction.disposition !== "future") return false;
  if (transaction.phase !== "before-journal" && (
    typeof transaction.remote_base_head !== "string"
    || typeof transaction.future_root_preexisting !== "boolean"
    || typeof transaction.created_at !== "string"
  )) return false;
  if (!(transaction.status === "running" || transaction.status === "failed" || transaction.status === "recovered-clean")) return false;
  if (typeof transaction.product_resource_mutation_performed !== "boolean" || !Array.isArray(transaction.owned_paths)) return false;
  if (transaction.status === "failed" && (typeof transaction.error !== "string" || typeof transaction.failed_at !== "string" || typeof transaction.recovery_action_required !== "boolean")) return false;
  if (transaction.status === "recovered-clean" && (
    transaction.phase !== "owned-uncommitted-removed"
    || transaction.recovery_action !== "remove-owned-uncommitted"
    || typeof transaction.recovered_at !== "string"
    || typeof transaction.ownership_consumed_path !== "string"
    || typeof transaction.ownership_receipt_path !== "string"
    || typeof transaction.bundle_ownership_receipt_path !== "string"
    || typeof transaction.tree_evidence_path !== "string"
    || typeof transaction.tree_evidence_sha256 !== "string"
    || typeof transaction.constructed_tree !== "string"
    || transaction.document_hashes === undefined
    || transaction.product_resource_mutation_performed !== false
    || transaction.commit_object_sha !== undefined || transaction.commit_sha !== undefined
    || transaction.push_target !== undefined || transaction.remote_oid_before_push !== undefined
  )) return false;
  if (!mutableFieldTypesAreValid(transaction)) return false;
  const rank = mutablePhaseRank(transaction.phase as string);
  const minimumRank: Record<string, number> = {
    ownership_receipt_path: 1, document_hashes: 2, bundle_ownership_receipt_path: 3,
    tree_evidence_path: 4, constructed_tree: 5, tree_evidence_sha256: 5,
    commit_object_sha: 6, commit_sha: 7, push_target: 8, remote_oid_before_push: 8,
  };
  if (Object.entries(minimumRank).some(([key, minimum]) => transaction[key] !== undefined && rank < minimum)) return false;
  const requiredByRank: Array<[number, string[]]> = [
    [1, ["ownership_receipt_path"]],
    [3, ["bundle_ownership_receipt_path"]],
    [4, ["document_hashes", "tree_evidence_path"]],
    [5, ["constructed_tree", "tree_evidence_sha256"]],
    [6, ["commit_object_sha"]],
    [7, ["commit_sha"]],
    [8, ["push_target", "remote_oid_before_push"]],
  ];
  if (transaction.status !== "recovered-clean" && requiredByRank.some(([minimum, keys]) => rank >= minimum && keys.some((key) => transaction[key] === undefined))) return false;
  const failureKeys = ["error", "failed_at", "recovery_action_required", "observed_at", "observed_head",
    "observed_upstream_head", "observed_remote_head", "observed_status_paths", "observed_staged_paths",
    "observed_target_kind", "observed_target_entries", "observed_owned_paths", "observed_owned_files",
    "observed_tree_evidence", "observed_commit", "observation_errors", "observation_error"];
  if (transaction.status === "running" && failureKeys.some((key) => transaction[key] !== undefined)) return false;
  const recoveryKeys = ["recovery_action", "ownership_consumed_path", "recovered_at"];
  if (transaction.status !== "recovered-clean" && recoveryKeys.some((key) => transaction[key] !== undefined)) return false;
  if (transaction.status === "failed" || transaction.status === "recovered-clean") {
    const fullObservation = ["observed_at", "observed_head", "observed_upstream_head", "observed_remote_head",
      "observed_status_paths", "observed_staged_paths", "observed_target_kind", "observed_target_entries",
      "observed_owned_paths", "observed_owned_files", "observed_tree_evidence", "observed_commit", "observation_errors"];
    const presentFull = fullObservation.filter((key) => transaction[key] !== undefined);
    const hasFull = presentFull.length === fullObservation.length;
    const hasFallback = typeof transaction.observation_error === "string";
    if (hasFull === hasFallback) return false;
    if (!hasFull && presentFull.length !== 0) return false;
  }
  return true;
}

function transactionImmutableMatches(
  transaction: Record<string, unknown>,
  dispositionId: string,
  payloadFingerprint: string,
  params: DispositionParams,
  sessionId: string,
  repoRoot: string,
): boolean {
  const expectedDirectory = join(".ralph", "plans", "future", params.decision.slug);
  const expectedPaths = ["SPECIFICATION.md", "REQUIREMENTS.md", "DECISIONS.md"]
    .map((name) => join(expectedDirectory, name));
  const recordedPaths = Array.isArray(transaction.owned_paths) ? transaction.owned_paths : null;
  return transaction.disposition_id === dispositionId
    && transaction.payload_fingerprint === payloadFingerprint
    && transaction.disposition === "future"
    && transaction.slug === params.decision.slug
    && transaction.bundle_sha256 === sha256(canonicalJson(params.documents))
    && transaction.owner_session_id === sessionId
    && transaction.repository_root === repoRoot
    && (transaction.target_directory === undefined || transaction.target_directory === expectedDirectory)
    && (
      recordedPaths === null
      || (recordedPaths.every((path): path is string => typeof path === "string") && sameStrings(recordedPaths, expectedPaths))
    );
}

function validateFutureOwnershipReceipt(
  path: string,
  expected: {
    dispositionId: string;
    payloadFingerprint: string;
    ownerSessionId: string;
    repositoryRoot: string;
    baseHead: string;
    targetDirectory: string;
  },
): Record<string, unknown> {
  const receipt = readDurableJson(path);
  exactShape(receipt, [
    "version", "kind", "disposition_id", "payload_fingerprint", "owner_session_id",
    "repository_root", "base_head", "target_directory", "directory_created_exclusively",
    "directory_identity", "created_at",
  ], "future directory ownership receipt");
  if (
    receipt.version !== 3
    || receipt.kind !== "future-directory-ownership"
    || receipt.disposition_id !== expected.dispositionId
    || receipt.payload_fingerprint !== expected.payloadFingerprint
    || receipt.owner_session_id !== expected.ownerSessionId
    || receipt.repository_root !== expected.repositoryRoot
    || receipt.base_head !== expected.baseHead
    || receipt.target_directory !== expected.targetDirectory
    || receipt.directory_created_exclusively !== true
  ) throw new Error(`future directory ownership receipt does not match transaction identity: ${path}`);
  exactOid(receipt.base_head, "future directory ownership base_head");
  identity(receipt.directory_identity, "future directory ownership identity");
  exactTimestamp(receipt.created_at, "future directory ownership created_at");
  return receipt;
}


function validateFileOwnershipReceipt(
  path: string,
  expected: {
    dispositionId: string;
    payloadFingerprint: string;
    ownerSessionId: string;
    repositoryRoot: string;
    targetDirectory: string;
    name: string;
    content: string;
    directoryReceiptSha256: string;
    anchorPath: string;
  },
): Record<string, unknown> {
  const receipt = readDurableJson(path);
  const anchored = receipt.version === 3;
  exactShape(receipt, [
    "version", "kind", "disposition_id", "payload_fingerprint", "owner_session_id",
    "repository_root", "target_directory", "name", "sha256", "filesystem_identity",
    ...(anchored ? ["anchor_path", "anchor_identity"] : []),
    "directory_ownership_receipt_sha256", "created_at",
  ], `future file ownership receipt ${expected.name}`);
  if (
    (receipt.version !== 2 && receipt.version !== 3)
    || receipt.kind !== "future-file-ownership"
    || receipt.disposition_id !== expected.dispositionId
    || receipt.payload_fingerprint !== expected.payloadFingerprint
    || receipt.owner_session_id !== expected.ownerSessionId
    || receipt.repository_root !== expected.repositoryRoot
    || receipt.target_directory !== expected.targetDirectory
    || receipt.name !== expected.name
    || receipt.sha256 !== sha256(expected.content)
    || receipt.directory_ownership_receipt_sha256 !== expected.directoryReceiptSha256
  ) throw new Error(`future file ownership receipt does not match transaction identity: ${path}`);
  exactHash(receipt.sha256, `future file ownership hash ${expected.name}`);
  exactHash(receipt.directory_ownership_receipt_sha256, `future file directory receipt hash ${expected.name}`);
  identity(receipt.filesystem_identity, `future file ownership identity ${expected.name}`);
  if (anchored) {
    if (receipt.anchor_path !== expected.anchorPath) throw new Error(`future file anchor path mismatch: ${expected.name}`);
    const anchorIdentity = identity(receipt.anchor_identity, `future file anchor identity ${expected.name}`);
    if (canonicalJson(anchorIdentity) !== canonicalJson(identity(receipt.filesystem_identity, `future file ownership identity ${expected.name}`))) {
      throw new Error(`future file anchor allocation mismatch: ${expected.name}`);
    }
  }
  exactTimestamp(receipt.created_at, `future file ownership created_at ${expected.name}`);
  return receipt;
}

function validateBundleOwnershipReceipt(
  path: string,
  expected: {
    dispositionId: string;
    payloadFingerprint: string;
    ownerSessionId: string;
    repositoryRoot: string;
    commonDir: string;
    baseHead: string;
    targetDirectory: string;
    documents: DispositionParams["documents"];
    directoryReceiptPath: string;
    directoryReceiptSha256: string;
    fileReceiptPaths: Record<string, string>;
    fileAnchorPaths: Record<string, string>;
    fileReceiptSha256s: Record<string, string>;
  },
): Record<string, unknown> {
  const receipt = readDurableJson(path);
  exactShape(receipt, [
    "version", "kind", "disposition_id", "payload_fingerprint", "owner_session_id",
    "repository_root", "target_directory", "directory_identity", "directory_receipt_path",
    "directory_receipt_sha256", "files", "created_at",
  ], "future bundle ownership receipt");
  if (
    receipt.version !== 2
    || receipt.kind !== "future-bundle-ownership"
    || receipt.disposition_id !== expected.dispositionId
    || receipt.payload_fingerprint !== expected.payloadFingerprint
    || receipt.owner_session_id !== expected.ownerSessionId
    || receipt.repository_root !== expected.repositoryRoot
    || receipt.target_directory !== expected.targetDirectory
    || receipt.directory_receipt_path !== expected.directoryReceiptPath
    || receipt.directory_receipt_sha256 !== expected.directoryReceiptSha256
  ) throw new Error(`future bundle ownership receipt does not match transaction identity: ${path}`);
  exactHash(receipt.directory_receipt_sha256, "future bundle directory receipt hash");
  exactTimestamp(receipt.created_at, "future bundle ownership created_at");
  const bundleDirectoryIdentity = identity(receipt.directory_identity, "future bundle directory identity");
  const directoryReceipt = validateFutureOwnershipReceipt(expected.directoryReceiptPath, {
    dispositionId: expected.dispositionId, payloadFingerprint: expected.payloadFingerprint,
    ownerSessionId: expected.ownerSessionId, repositoryRoot: expected.repositoryRoot,
    baseHead: expected.baseHead,
    targetDirectory: expected.targetDirectory,
  });
  if (sha256(readDurableFile(expected.directoryReceiptPath)) !== expected.directoryReceiptSha256) {
    throw new Error("future directory receipt hash does not match bundle graph");
  }
  if (canonicalJson(identity(directoryReceipt.directory_identity, "future directory receipt identity")) !== canonicalJson(bundleDirectoryIdentity)) {
    throw new Error("future bundle directory identity is not cross-bound to its creation receipt");
  }
  const files = object(receipt.files, "future bundle file identities");
  const documentEntries: Array<[string, string]> = [
    ["SPECIFICATION.md", expected.documents.specification_markdown],
    ["REQUIREMENTS.md", expected.documents.requirements_markdown],
    ["DECISIONS.md", expected.documents.decisions_markdown],
  ];
  exactShape(files, documentEntries.map(([name]) => name), "future bundle files");
  for (const [name, content] of documentEntries) {
    const entry = object(files[name], `future bundle ownership entry ${name}`);
    exactShape(entry, ["sha256", "filesystem_identity", "creation_receipt_path", "creation_receipt_sha256"], `future bundle ownership entry ${name}`);
    if (
      entry.sha256 !== sha256(content)
      || entry.creation_receipt_path !== expected.fileReceiptPaths[name]
      || entry.creation_receipt_sha256 !== expected.fileReceiptSha256s[name]
    ) throw new Error(`future bundle ownership graph mismatch: ${name}`);
    exactHash(entry.sha256, `future bundle hash ${name}`);
    exactHash(entry.creation_receipt_sha256, `future file receipt hash ${name}`);
    const fileReceipt = validateFileOwnershipReceipt(expected.fileReceiptPaths[name], {
      dispositionId: expected.dispositionId, payloadFingerprint: expected.payloadFingerprint,
      ownerSessionId: expected.ownerSessionId, repositoryRoot: expected.repositoryRoot,
      targetDirectory: expected.targetDirectory, name, content,
      directoryReceiptSha256: expected.directoryReceiptSha256,
      anchorPath: secureRelative(expected.commonDir, expected.fileAnchorPaths[name]),
    });
    if (sha256(readDurableFile(expected.fileReceiptPaths[name])) !== expected.fileReceiptSha256s[name]) {
      throw new Error(`future file receipt hash does not match bundle graph: ${name}`);
    }
    const bundleFileIdentity = identity(entry.filesystem_identity, `future bundle file identity ${name}`);
    if (canonicalJson(bundleFileIdentity) !== canonicalJson(identity(fileReceipt.filesystem_identity, `future file receipt identity ${name}`))) {
      throw new Error(`future bundle file identity is not cross-bound to its creation receipt: ${name}`);
    }
  }
  return receipt;
}

async function validateVerifiedFutureSuccess(
  pi: ExtensionAPI,
  cwd: string,
  state: CanonicalState,
  transaction: Record<string, unknown>,
  expected: {
    dispositionId: string;
    payloadFingerprint: string;
    ownerSessionId: string;
    ownerSessionFile: string;
    repositoryRoot: string;
    baseHead: string;
    targetDirectory: string;
    ownershipPath: string;
    fileOwnershipPaths: Record<string, string>;
    fileAnchorPaths: Record<string, string>;
    bundleOwnershipPath: string;
    treeEvidencePath: string;
    ownedPaths: string[];
    documents: DispositionParams["documents"];
  },
): Promise<string> {
  exactShape(transaction, [
    "version", "kind", "status", "phase", "disposition_id", "payload_fingerprint",
    "disposition", "slug", "bundle_sha256", "owner_session_id", "owner_session_file",
    "repository_root", "git_common_dir", "branch", "base_head", "target_directory",
    "owned_paths", "document_hashes", "receipts", "commit", "publication",
    "episode_resources_allocated",
  ], "verified-success journal");
  if (
    transaction.version !== 2 || transaction.kind !== "future-verified-success"
    || transaction.status !== "verified-success" || transaction.phase !== "pushed-and-clean"
    || transaction.disposition_id !== expected.dispositionId
    || transaction.payload_fingerprint !== expected.payloadFingerprint
    || transaction.disposition !== "future"
    || transaction.owner_session_id !== expected.ownerSessionId
    || transaction.owner_session_file !== expected.ownerSessionFile
    || transaction.repository_root !== expected.repositoryRoot
    || transaction.git_common_dir !== state.commonDir
    || transaction.base_head !== expected.baseHead
    || transaction.target_directory !== expected.targetDirectory
    || transaction.episode_resources_allocated !== false
    || transaction.bundle_sha256 !== sha256(canonicalJson(expected.documents))
  ) throw new Error("verified-success journal is missing required immutable invariants");
  exactOid(transaction.base_head, "verified-success base_head");
  if (transaction.slug !== expected.targetDirectory.split("/").at(-1)) throw new Error("verified-success slug mismatch");
  if (!Array.isArray(transaction.owned_paths) || transaction.owned_paths.length !== expected.ownedPaths.length
    || transaction.owned_paths.some((path, index) => path !== expected.ownedPaths[index])) {
    throw new Error("verified-success owned_paths must be the exact ordered bundle paths");
  }
  const branch = object(transaction.branch, "verified-success branch");
  exactShape(branch, ["local", "upstream", "remote", "remote_branch"], "verified-success branch");
  if (branch.local !== state.currentBranch || branch.upstream !== state.upstream
    || branch.remote !== state.remote || branch.remote_branch !== state.remoteBranch) {
    throw new Error("verified-success branch configuration does not match the canonical repository");
  }
  const hashes = object(transaction.document_hashes, "verified-success document hashes");
  exactShape(hashes, ["SPECIFICATION.md", "REQUIREMENTS.md", "DECISIONS.md"], "verified-success document hashes");
  const expectedHashes: Record<string, string> = {
    "SPECIFICATION.md": sha256(expected.documents.specification_markdown),
    "REQUIREMENTS.md": sha256(expected.documents.requirements_markdown),
    "DECISIONS.md": sha256(expected.documents.decisions_markdown),
  };
  for (const [name, hash] of Object.entries(expectedHashes)) {
    if (hashes[name] !== hash) throw new Error(`verified-success document hash mismatch: ${name}`);
    exactHash(hashes[name], `verified-success document hash ${name}`);
  }
  const receipts = object(transaction.receipts, "verified-success receipts");
  exactShape(receipts, ["directory", "files", "bundle", "tree_evidence"], "verified-success receipts");
  const directoryRef = object(receipts.directory, "verified-success directory receipt reference");
  const bundleRef = object(receipts.bundle, "verified-success bundle receipt reference");
  const treeEvidenceRef = object(receipts.tree_evidence, "verified-success tree evidence reference");
  exactShape(directoryRef, ["path", "sha256"], "verified-success directory receipt reference");
  exactShape(bundleRef, ["path", "sha256"], "verified-success bundle receipt reference");
  exactShape(treeEvidenceRef, ["path", "sha256"], "verified-success tree evidence reference");
  if (directoryRef.path !== expected.ownershipPath || bundleRef.path !== expected.bundleOwnershipPath
    || treeEvidenceRef.path !== expected.treeEvidencePath) {
    throw new Error("verified-success receipt paths do not match derived control paths");
  }
  const directoryReceiptSha256 = exactHash(directoryRef.sha256, "verified-success directory receipt hash");
  const bundleReceiptSha256 = exactHash(bundleRef.sha256, "verified-success bundle receipt hash");
  const treeEvidenceSha256 = exactHash(treeEvidenceRef.sha256, "verified-success tree evidence hash");
  if (sha256(readDurableFile(expected.ownershipPath)) !== directoryReceiptSha256
    || sha256(readDurableFile(expected.bundleOwnershipPath)) !== bundleReceiptSha256
    || sha256(readDurableFile(expected.treeEvidencePath)) !== treeEvidenceSha256) {
    throw new Error("verified-success receipt bytes do not match their hashes");
  }
  const fileRefs = object(receipts.files, "verified-success file receipt references");
  exactShape(fileRefs, ["SPECIFICATION.md", "REQUIREMENTS.md", "DECISIONS.md"], "verified-success file receipt references");
  const fileReceiptSha256s: Record<string, string> = {};
  for (const name of ["SPECIFICATION.md", "REQUIREMENTS.md", "DECISIONS.md"]) {
    const ref = object(fileRefs[name], `verified-success file receipt reference ${name}`);
    exactShape(ref, ["path", "sha256"], `verified-success file receipt reference ${name}`);
    if (ref.path !== expected.fileOwnershipPaths[name]) throw new Error(`verified-success file receipt path mismatch: ${name}`);
    const hash = exactHash(ref.sha256, `verified-success file receipt hash ${name}`);
    if (sha256(readDurableFile(expected.fileOwnershipPaths[name])) !== hash) throw new Error(`verified-success file receipt bytes mismatch: ${name}`);
    fileReceiptSha256s[name] = hash;
  }
  validateFutureOwnershipReceipt(expected.ownershipPath, {
    dispositionId: expected.dispositionId, payloadFingerprint: expected.payloadFingerprint,
    ownerSessionId: expected.ownerSessionId, repositoryRoot: expected.repositoryRoot,
    baseHead: expected.baseHead, targetDirectory: expected.targetDirectory,
  });
  validateBundleOwnershipReceipt(expected.bundleOwnershipPath, {
    dispositionId: expected.dispositionId, payloadFingerprint: expected.payloadFingerprint,
    ownerSessionId: expected.ownerSessionId, repositoryRoot: expected.repositoryRoot,
    commonDir: state.commonDir,
    baseHead: expected.baseHead, targetDirectory: expected.targetDirectory,
    documents: expected.documents, directoryReceiptPath: expected.ownershipPath,
    directoryReceiptSha256, fileReceiptPaths: expected.fileOwnershipPaths,
    fileAnchorPaths: expected.fileAnchorPaths, fileReceiptSha256s,
  });
  const commit = object(transaction.commit, "verified-success commit");
  exactShape(commit, ["oid", "tree", "parent", "changed_paths"], "verified-success commit");
  const commitOid = exactOid(commit.oid, "verified-success commit oid");
  const commitTree = exactOid(commit.tree, "verified-success commit tree");
  await requireGitObjectType(pi, cwd, commitOid, "commit", "verified-success commit oid");
  await requireGitObjectType(pi, cwd, commitTree, "tree", "verified-success commit tree");
  await requireGitObjectType(pi, cwd, expected.baseHead, "commit", "verified-success base commit");
  const treeEvidence = readDurableJson(expected.treeEvidencePath);
  exactShape(treeEvidence, ["version", "kind", "disposition_id", "base_head", "tree", "bundle_sha256", "modes"], "verified-success tree evidence");
  const treeModes = object(treeEvidence.modes, "verified-success tree evidence modes");
  exactShape(treeModes, ["SPECIFICATION.md", "REQUIREMENTS.md", "DECISIONS.md"], "verified-success tree evidence modes");
  if (treeEvidence.version !== 1 || treeEvidence.kind !== "future-tree-construction-evidence"
    || treeEvidence.disposition_id !== expected.dispositionId || treeEvidence.base_head !== expected.baseHead
    || treeEvidence.tree !== commitTree || treeEvidence.bundle_sha256 !== transaction.bundle_sha256
    || Object.values(treeModes).some((mode) => mode !== "100644 blob")) {
    throw new Error("verified-success tree evidence does not match the commit graph");
  }
  exactOid(treeEvidence.base_head, "verified-success tree evidence base");
  exactOid(treeEvidence.tree, "verified-success tree evidence tree");
  if (commit.parent !== expected.baseHead) throw new Error("verified-success commit parent record mismatch");
  exactOid(commit.parent, "verified-success commit parent");
  if (!Array.isArray(commit.changed_paths) || commit.changed_paths.length !== expected.ownedPaths.length
    || commit.changed_paths.some((path, index) => path !== expected.ownedPaths[index])) {
    throw new Error("verified-success changed_paths mismatch");
  }
  const actualTree = (await git(pi, cwd, ["rev-parse", `${commitOid}^{tree}`], undefined)).trim();
  const actualParent = (await git(pi, cwd, ["rev-parse", `${commitOid}^`], undefined)).trim();
  if (actualTree !== commitTree || actualParent !== expected.baseHead) throw new Error("verified-success commit relationships are invalid");
  await validateCommitBundle(pi, cwd, commitOid, expected.ownedPaths, expected.documents);
  const publication = object(transaction.publication, "verified-success publication");
  exactShape(publication, ["verified_head", "verified_upstream_head", "verified_remote_head", "checkout_clean", "verified_at"], "verified-success publication");
  for (const field of ["verified_head", "verified_upstream_head", "verified_remote_head"] as const) {
    if (exactOid(publication[field], `verified-success publication ${field}`) !== commitOid) throw new Error(`verified-success publication ${field} mismatch`);
  }
  if (publication.checkout_clean !== true) throw new Error("verified-success historical checkout was not clean");
  exactTimestamp(publication.verified_at, "verified-success publication verified_at");
  const historicalRemote = await remoteRefOid(pi, cwd, state.remote, state.remoteBranch);
  if (historicalRemote !== commitOid && !(await gitIsAncestor(pi, cwd, commitOid, historicalRemote))) {
    throw new Error(`verified future commit ${commitOid} is not durable on actual remote ${historicalRemote}`);
  }
  return commitOid;
}

async function reconcileFutureState(
  pi: ExtensionAPI,
  cwd: string,
  transaction: Record<string, unknown>,
  ownedPaths: string[],
  documents: DispositionParams["documents"],
): Promise<Record<string, unknown>> {
  let state: CanonicalState | null = null;
  const observationErrors: string[] = [];
  try {
    state = await inspectCanonicalRepository(pi, cwd, undefined);
  } catch (error) {
    observationErrors.push(`repository: ${errorMessage(error)}`);
  }

  const observedFiles: Record<string, unknown> = {};
  const targetRelative = typeof transaction.target_directory === "string"
    ? transaction.target_directory
    : null;
  const target = targetRelative ? join(cwd, targetRelative) : null;
  let targetKind = "missing";
  let targetEntries: string[] = [];
  if (target && existsSync(target)) {
    try {
      const targetStat = lstatSync(target);
      if (targetStat.isSymbolicLink()) {
        targetKind = "symlink";
      } else if (!targetStat.isDirectory()) {
        targetKind = "other";
      } else {
        targetKind = "directory";
        targetEntries = readdirSync(target).sort();
        for (const name of targetEntries) {
          const path = join(target, name);
          const stat = lstatSync(path);
          const relativePath = join(targetRelative!, name);
          if (stat.isSymbolicLink()) observedFiles[relativePath] = { kind: "symlink" };
          else if (stat.isFile()) observedFiles[relativePath] = {
            kind: "file",
            size: stat.size,
            sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
          };
          else observedFiles[relativePath] = { kind: "other" };
        }
      }
    } catch (error) {
      observationErrors.push(`owned files: ${errorMessage(error)}`);
    }
  }

  const dispositionId = typeof transaction.disposition_id === "string" ? transaction.disposition_id : "unknown";
  let privateIndex: Record<string, unknown> = { exists: false };
  if (state && REQUEST_ID.test(dispositionId)) {
    try {
      const privateIndexPath = join(
        state.commonDir, CONTROL_DIR, "indexes", `${dispositionId}.index`,
      );
      const observed = secureFs<{ exists: boolean; size?: number; sha256?: string }>({
        operation: "read-file",
        root: state.commonDir,
        path: `${CONTROL_DIR}/indexes/${dispositionId}.index`,
        allow_missing: true,
      });
      privateIndex = observed.exists
        ? { exists: true, path: privateIndexPath, size: observed.size, sha256: observed.sha256 }
        : { exists: false };
    } catch (error) {
      observationErrors.push(`tree evidence: ${errorMessage(error)}`);
    }
  }

  const commit = typeof transaction.commit_sha === "string"
    ? transaction.commit_sha
    : typeof transaction.commit_object_sha === "string"
      ? transaction.commit_object_sha
      : null;
  let commitObservation: Record<string, unknown> = { oid: commit, exists: false };
  if (commit) {
    try {
      await git(pi, cwd, ["cat-file", "-e", `${commit}^{commit}`], undefined);
      const paths = await commitPaths(pi, cwd, commit);
      let contentMatches = false;
      try {
        await validateCommitBundle(pi, cwd, commit, ownedPaths, documents);
        contentMatches = true;
      } catch (error) {
        observationErrors.push(`commit content: ${errorMessage(error)}`);
      }
      commitObservation = { oid: commit, exists: true, paths, content_matches: contentMatches };
    } catch (error) {
      observationErrors.push(`commit: ${errorMessage(error)}`);
    }
  }

  let finalState: CanonicalState | null = null;
  let finalRemoteOid: string | null = null;
  let finalStagedPaths: string[] = [];
  try {
    const beforeFinal = await inspectCanonicalRepository(pi, cwd, undefined);
    const beforeRemote = await remoteRefOid(pi, cwd, beforeFinal.remote, beforeFinal.remoteBranch);
    finalStagedPaths = (await git(
      pi, cwd, ["diff", "--cached", "--name-only", "-z"], undefined,
    )).split("\0").filter(Boolean);
    const afterFinal = await inspectCanonicalRepository(pi, cwd, undefined);
    const afterRemote = await remoteRefOid(pi, cwd, afterFinal.remote, afterFinal.remoteBranch);
    if (
      beforeFinal.head !== afterFinal.head
      || beforeFinal.upstreamHead !== afterFinal.upstreamHead
      || beforeFinal.status !== afterFinal.status
      || beforeRemote !== afterRemote
    ) throw new Error("repository or remote changed while collecting the final current-state observation");
    finalState = afterFinal;
    finalRemoteOid = afterRemote;
  } catch (error) {
    observationErrors.push(`final current state: ${errorMessage(error)}`);
  }
  const observedAt = new Date().toISOString();

  return {
    ...transaction,
    observed_at: observedAt,
    observed_head: finalState?.head ?? null,
    observed_upstream_head: finalState?.upstreamHead ?? null,
    observed_remote_head: finalRemoteOid,
    observed_status_paths: finalState ? porcelainPaths(finalState.status) : [],
    observed_staged_paths: finalStagedPaths,
    observed_target_kind: targetKind,
    observed_target_entries: targetEntries,
    observed_owned_paths: Object.keys(observedFiles),
    observed_owned_files: observedFiles,
    observed_tree_evidence: privateIndex,
    observed_commit: commitObservation,
    observation_errors: observationErrors,
  };
}

async function executeFutureTransaction(
  pi: ExtensionAPI,
  params: DispositionParams,
  ctx: ExtensionContext,
  signal: AbortSignal | undefined,
  base: {
    sessionId: string;
    resolvedSessionFile: string;
    state: CanonicalState;
    dispositionId: string;
    payloadFingerprint: string;
    bundleSha256: string;
    requestKey: string;
    requestPath: string;
    requestCreated: boolean;
    receiptPath: string;
    receiptCreated: boolean;
  },
): Promise<Record<string, unknown>> {
  const { sessionId, resolvedSessionFile, dispositionId, payloadFingerprint, bundleSha256 } = base;
  const cwd = base.state.repoRoot;
  const controlRoot = ensureControlDirectory(base.state.commonDir);
  const transactionPath = join(ensureControlDirectory(base.state.commonDir, "future-transactions"), `${dispositionId}.json`);
  const attemptPath = join(ensureControlDirectory(base.state.commonDir, "future-attempts"), `${base.requestKey}.json`);
  const blockerPath = join(controlRoot, "future-mutation-blocked.json");
  const initialControlWrites = [
    ...(base.requestCreated ? [base.requestPath] : []),
    ...(base.receiptCreated ? [base.receiptPath] : []),
  ];
  const lockPath = join(ensureControlDirectory(base.state.commonDir, "locks"), "project-mutation.lock");
  const indexPath = join(controlRoot, "indexes", `${dispositionId}.index`);
  const ownershipPath = controlFilePath(base.state.commonDir, "future-ownership", `${dispositionId}.json`);
  const bundleOwnershipPath = controlFilePath(
    base.state.commonDir,
    "future-bundle-ownership",
    `${dispositionId}.json`,
  );
  const ownershipConsumedPath = join(
    ensureControlDirectory(base.state.commonDir, "future-ownership-consumed"),
    `${dispositionId}.json`,
  );
  const relativeDir = join(".ralph", "plans", "future", params.decision.slug);
  const targetDir = join(cwd, relativeDir);
  const documentEntries: Array<[string, string]> = [
    ["SPECIFICATION.md", params.documents.specification_markdown],
    ["REQUIREMENTS.md", params.documents.requirements_markdown],
    ["DECISIONS.md", params.documents.decisions_markdown],
  ];
  const ownedPaths = documentEntries.map(([name]) => join(relativeDir, name));
  const fileOwnershipPaths = Object.fromEntries(documentEntries.map(([name]) => [
    name,
    controlFilePath(base.state.commonDir, "future-file-ownership", `${dispositionId}.${name}.json`),
  ])) as Record<string, string>;
  const fileAnchorPaths = Object.fromEntries(documentEntries.map(([name]) => [
    name,
    controlFilePath(base.state.commonDir, "future-file-anchors", `${dispositionId}.${name}`),
  ])) as Record<string, string>;
  let preserveSuccessEvidence = false;
  let transaction: Record<string, unknown> | null = existsSync(transactionPath)
    ? readDurableJson(transactionPath)
    : null;
  preserveSuccessEvidence = transaction !== null && isRecognizableVerifiedSuccess(transaction);
  if (transaction && !isRecognizableVerifiedSuccess(transaction) && !isKnownMutableFutureTransaction(transaction)) {
    return {
      status: "failed",
      phase: "success-preservation-guard",
      error: `unknown durable future transaction schema at ${transactionPath}: unsupported field or missing required success invariants; preserving exact bytes`,
      corrupt_success_journal_preserved: true,
      preflight_receipt_path: base.receiptPath,
      transaction_path: transactionPath,
      attempt_path: attemptPath,
      deduplicated: false,
      recovery_action_required: true,
      control_state_writes_performed: [],
    };
  }
  if (transaction && !isRecognizableVerifiedSuccess(transaction) && !transactionImmutableMatches(
    transaction, dispositionId, payloadFingerprint, params, sessionId, cwd,
  )) {
    throw new Error(`future transaction collision at ${transactionPath}`);
  }

  const writeAttempt = (value: Record<string, unknown>) => replaceDurableJson(attemptPath, {
    version: 1,
    request_id: params.request_id,
    disposition_id: dispositionId,
    owner_session_id: sessionId,
    transaction_path: transactionPath,
    ...value,
  });

  let productMutated = false;
  let ownershipProven = false;
  let ownershipReceipt: Record<string, unknown> | null = null;
  let ownedDirectoryIdentity: FilesystemIdentity | null = null;
  let ownershipCreated = false;
  const fileOwnershipCreated: string[] = [];
  let bundleOwnershipCreated = false;
  let ownershipConsumedCreated = false;
  let lockReleaseError: string | null = null;
  const controlWrites = (...paths: string[]) => [
    ...initialControlWrites,
    ...(ownershipCreated ? [ownershipPath] : []),
    ...fileOwnershipCreated,
    ...(bundleOwnershipCreated ? [bundleOwnershipPath] : []),
    ...(ownershipConsumedCreated ? [ownershipConsumedPath] : []),
    ...paths,
  ];

  writeAttempt({ status: "waiting-for-lock", phase: transaction?.phase ?? "validated", observed_at: new Date().toISOString() });
  let lock: ProjectLock | null = null;
  let preserveAmbiguousLockEvidence = false;
  try {
    lock = acquireProjectLock(lockPath, dispositionId, sessionId, params.recovery_action !== undefined);
  } catch (error) {
    if (!(error instanceof LockContentionError)) throw error;
    writeAttempt({
      status: "lock-contention",
      phase: "lock-acquire",
      lock_path: error.lockPath,
      lock_owner: error.owner,
      next_safe_action: "retry only after the recorded owner releases the lock; never steal an ambiguous lock",
      observed_at: new Date().toISOString(),
    });
    return {
      status: "lock-contention",
      phase: "lock-acquire",
      disposition: "future",
      disposition_id: dispositionId,
      lock_path: error.lockPath,
      lock_owner: error.owner,
      attempt_path: attemptPath,
      preflight_receipt_path: base.receiptPath,
      product_resource_mutation_performed: false,
      next_safe_action: "retry only after the recorded owner releases the lock; never steal an ambiguous lock",
      control_state_writes_performed: controlWrites(attemptPath),
    };
  }

  const requireMutationAuthority = (allowConsumed = false): ProjectLock => {
    if (!lock) throw new Error("project mutation authority is not held");
    validateProjectLock(lock);
    if (!allowConsumed && existsSync(ownershipConsumedPath)) {
      throw new Error("consumed ownership state became durable before the next mutation boundary");
    }
    return lock;
  };

  try {
    if (!lock) throw new Error("project mutation authority is not held");
    validateProjectLock(lock);
    const state = await inspectCanonicalRepository(pi, cwd, signal);
    if (state.commonDir !== base.state.commonDir) throw new Error("Git common directory changed while acquiring project lock");

    transaction = existsSync(transactionPath) ? readDurableJson(transactionPath) : null;
    if (transaction && !isRecognizableVerifiedSuccess(transaction) && !isKnownMutableFutureTransaction(transaction)) {
      preserveSuccessEvidence = true;
      throw new Error(`unknown durable future transaction schema at ${transactionPath}; preserving exact bytes`);
    }
    if (existsSync(ownershipConsumedPath)
      && params.recovery_action !== "remove-owned-uncommitted"
      && params.recovery_action !== "inspect") {
      writeAttempt({
        status: "retirement-in-progress",
        phase: "consumed-manifest-present",
        error: "continuation is forbidden after retirement state exists",
        next_safe_action: "inspect or remove-owned-uncommitted to resume exact retirement",
        observed_at: new Date().toISOString(),
      });
      return {
        status: "failed",
        phase: "consumed-manifest-present",
        error: "continuation is forbidden after retirement state exists",
        retirement_state_preserved: true,
        product_resource_mutation_performed: false,
        preflight_receipt_path: base.receiptPath,
        transaction_path: transactionPath,
        attempt_path: attemptPath,
        control_state_writes_performed: controlWrites(attemptPath),
      };
    }
    if (transaction?.status === "recovered-clean") {
      const error = "this future transaction was explicitly removed; submit a new disposition identity to restart";
      if (!transactionImmutableMatches(
        transaction, dispositionId, payloadFingerprint, params, sessionId, cwd,
      )) {
        return {
          status: "failed",
          phase: "terminal-recovered-clean",
          error: `recovered-clean transaction identity does not match ${transactionPath}`,
          terminal_journal_preserved: true,
          preflight_receipt_path: base.receiptPath,
          transaction_path: transactionPath,
          attempt_path: attemptPath,
          product_resource_mutation_performed: false,
          control_state_writes_performed: controlWrites(attemptPath),
        };
      }
      writeAttempt({
        status: "terminal-recovered-clean",
        phase: "terminal-recovered-clean",
        error,
        observed_at: new Date().toISOString(),
      });
      return {
        ...transaction,
        status: "failed",
        phase: "terminal-recovered-clean",
        error,
        terminal_journal_preserved: true,
        product_resource_mutation_performed: false,
        preflight_receipt_path: base.receiptPath,
        transaction_path: transactionPath,
        attempt_path: attemptPath,
        deduplicated: true,
        control_state_writes_performed: controlWrites(attemptPath),
      };
    }
    if (transaction && isRecognizableVerifiedSuccess(transaction)) {
      // Success-like evidence is preservation-only before discriminator
      // validation. Missing or conflicting fields can never route to mutable recovery.
      // validation failure must write diagnostics only to the attempt record.
      preserveSuccessEvidence = true;
      let observed: Record<string, unknown> = {};
      try {
        if (!transactionImmutableMatches(
          transaction, dispositionId, payloadFingerprint, params, sessionId, cwd,
        )) throw new Error(`verified-success transaction identity does not match ${transactionPath}`);
        if (existsSync(blockerPath)) {
          const blocker = readDurableJson(blockerPath);
          if (blocker.disposition_id !== dispositionId) {
            throw new Error(`another future transaction requires recovery: ${blocker.disposition_id}`);
          }
        }
        const successBase = typeof transaction.base_head === "string" ? transaction.base_head : "";
        if (!GIT_OID.test(successBase)) throw new Error("verified-success journal has an invalid base object ID");
        const verifiedCommit = await validateVerifiedFutureSuccess(pi, cwd, state, transaction, {
          dispositionId,
          payloadFingerprint,
          ownerSessionId: sessionId,
          ownerSessionFile: resolvedSessionFile,
          repositoryRoot: cwd,
          baseHead: successBase,
          targetDirectory: relativeDir,
          ownershipPath,
          fileOwnershipPaths,
          fileAnchorPaths,
          bundleOwnershipPath,
          treeEvidencePath: indexPath,
          indexPath,
          targetDir,
          ownedPaths,
          documents: params.documents,
        });
        // Only after all historical evidence is validated do we collect the
        // one snapshot allowed to describe current state.
        observed = await reconcileFutureState(pi, cwd, transaction, ownedPaths, params.documents);
        const observationErrors = Array.isArray(observed.observation_errors)
          ? observed.observation_errors
          : ["replay did not produce an observation error list"];
        if (observationErrors.length !== 0) {
          throw new Error(`verified-success replay observation failed: ${observationErrors.join("; ")}`);
        }
        const finalObservedRemote = observed.observed_remote_head;
        if (typeof finalObservedRemote !== "string" || !GIT_OID.test(finalObservedRemote)
          || (finalObservedRemote !== verifiedCommit && !(await gitIsAncestor(pi, cwd, verifiedCommit, finalObservedRemote)))) {
          throw new Error("final replay observation does not prove success-commit reachability");
        }
      } catch (error) {
        const failure = errorMessage(error);
        try {
          writeAttempt({
            status: "corrupt-success",
            phase: "success-validation-failed",
            error: failure,
            next_safe_action: "preserve the journal and blocker; inspect without normalizing success evidence",
            observed_at: new Date().toISOString(),
          });
        } catch {
          // The transaction journal and blocker remain immutable even when a
          // separate diagnostic receipt cannot be written safely.
        }
        const currentPaths = Array.isArray(observed.observed_status_paths)
          ? observed.observed_status_paths.filter((path): path is string => typeof path === "string")
          : [];
        return {
          status: "failed",
          phase: "success-validation-failed",
          error: failure,
          corrupt_success_journal_preserved: true,
          historical_status: transaction.status,
          checkout_clean: false,
          current_checkout_clean: false,
          current_status_paths: currentPaths,
          current_head: observed.observed_head ?? null,
          current_upstream_head: observed.observed_upstream_head ?? null,
          current_remote_head: observed.observed_remote_head ?? null,
          current_observed_at: observed.observed_at ?? null,
          observation_errors: observed.observation_errors ?? [],
          preflight_receipt_path: base.receiptPath,
          transaction_path: transactionPath,
          attempt_path: attemptPath,
          deduplicated: false,
          recovery_action_required: true,
          control_state_writes_performed: controlWrites(attemptPath),
        };
      }
      writeAttempt({ status: "deduplicated-success", phase: "verified-success", observed_at: new Date().toISOString() });
      const replayLock = lock;
      lock = null;
      releaseProjectLock(replayLock);
      const replayCommit = exactOid(object(transaction.commit, "verified-success commit").oid, "verified-success commit oid");
      await finalRemoteReachability(pi, cwd, state, replayCommit);
      await testFault(pi, "before-success-blocker-cleanup");
      if (existsSync(blockerPath)) {
        const approvedBlocker = readDurableJsonEvidence(blockerPath);
        if (approvedBlocker.value.disposition_id === dispositionId) await retireApprovedBlocker(pi, blockerPath, approvedBlocker);
      }
      const currentPaths = (observed.observed_status_paths as string[]) ?? [];
      return {
        ...transaction,
        commit_sha: replayCommit,
        commit_object_sha: replayCommit,
        private_tree: object(transaction.commit, "verified-success commit").tree,
        ownership_receipt_path: ownershipPath,
        bundle_ownership_receipt_path: bundleOwnershipPath,
        verified_head: object(transaction.publication, "verified-success publication").verified_head,
        verified_upstream_head: object(transaction.publication, "verified-success publication").verified_upstream_head,
        verified_remote_head: object(transaction.publication, "verified-success publication").verified_remote_head,
        verified_at: object(transaction.publication, "verified-success publication").verified_at,
        historical_checkout_clean: true,
        checkout_clean: currentPaths.length === 0,
        current_checkout_clean: currentPaths.length === 0,
        current_status_paths: currentPaths,
        current_head: observed.observed_head,
        current_upstream_head: observed.observed_upstream_head,
        current_remote_head: observed.observed_remote_head,
        current_observed_at: observed.observed_at,
        preflight_receipt_path: base.receiptPath,
        transaction_path: transactionPath,
        attempt_path: attemptPath,
        deduplicated: true,
        control_state_writes_performed: controlWrites(attemptPath),
      };
    }

    if (transaction && !transactionImmutableMatches(
      transaction, dispositionId, payloadFingerprint, params, sessionId, cwd,
    )) throw new Error(`future transaction collision at ${transactionPath}`);
    if (existsSync(blockerPath)) {
      const blocker = readDurableJson(blockerPath);
      if (blocker.disposition_id !== dispositionId) {
        throw new Error(`another future transaction requires recovery: ${blocker.disposition_id}`);
      }
    }

    if (transaction?.ownership_receipt_path !== undefined && transaction.ownership_receipt_path !== ownershipPath) {
      throw new Error("future transaction ownership-receipt path does not match the derived control path");
    }
    if (transaction?.bundle_ownership_receipt_path !== undefined
      && transaction.bundle_ownership_receipt_path !== bundleOwnershipPath) {
      throw new Error("future transaction bundle-ownership path does not match the derived control path");
    }
    if (existsSync(ownershipPath)) {
      const ownershipBase = typeof transaction?.base_head === "string" ? transaction.base_head : state.head;
      ownershipReceipt = validateFutureOwnershipReceipt(ownershipPath, {
        dispositionId,
        payloadFingerprint,
        ownerSessionId: sessionId,
        repositoryRoot: cwd,
        baseHead: ownershipBase,
        targetDirectory: relativeDir,
      });
      ownedDirectoryIdentity = identity(ownershipReceipt.directory_identity, "future directory ownership identity");
      ownershipProven = true;
    }


    if (
      transaction
      && !ownershipProven
      && (typeof transaction.commit_sha === "string" || typeof transaction.commit_object_sha === "string")
    ) {
      productMutated = true;
      throw new Error("future transaction records a commit but its immutable directory ownership receipt is missing");
    }

    if (transaction && !params.recovery_action) {
      const observed = await reconcileFutureState(pi, cwd, transaction, ownedPaths, params.documents);
      const nextSafeAction = transaction.status === "running"
        ? "inspect or explicitly recover the interrupted transaction"
        : "inspect, continue, or remove-owned-uncommitted with explicit operator approval";
      writeAttempt({
        status: "recovery-required",
        phase: transaction.phase,
        recovery_action_required: true,
        next_safe_action: nextSafeAction,
        observed_at: new Date().toISOString(),
      });
      return {
        ...observed,
        status: "recovery-required",
        preflight_receipt_path: base.receiptPath,
        transaction_path: transactionPath,
        attempt_path: attemptPath,
        recovery_action_required: true,
        next_safe_action: nextSafeAction,
        deduplicated: true,
        control_state_writes_performed: controlWrites(attemptPath),
      };
    }

    if (params.recovery_action === "inspect") {
      if (!transaction) throw new Error("no interrupted future transaction exists to inspect");
      const observed = await reconcileFutureState(pi, cwd, transaction, ownedPaths, params.documents);
      writeAttempt({ status: "inspected", phase: transaction.phase, observed_at: new Date().toISOString() });
      return {
        ...observed,
        preflight_receipt_path: base.receiptPath,
        transaction_path: transactionPath,
        attempt_path: attemptPath,
        deduplicated: true,
        control_state_writes_performed: controlWrites(attemptPath),
      };
    }

    const futureRoot = ensureFutureRoot(cwd, false);
    const baseHead = typeof transaction?.base_head === "string" ? transaction.base_head : state.head;
    productMutated = ownershipProven && (
      existsSync(targetDir)
      || typeof transaction?.commit_sha === "string"
      || typeof transaction?.commit_object_sha === "string"
    );
    if (transaction?.tree_evidence_path !== undefined && transaction.tree_evidence_path !== indexPath) {
      throw new Error("future transaction tree-evidence path does not match the derived control path");
    }
    if (!GIT_OID.test(baseHead)) throw new Error("future transaction has an invalid recorded base object ID");
    if (typeof transaction?.commit_sha === "string" && !GIT_OID.test(transaction.commit_sha)) {
      throw new Error("future transaction has an invalid recorded commit object ID");
    }
    if (typeof transaction?.commit_object_sha === "string" && !GIT_OID.test(transaction.commit_object_sha)) {
      throw new Error("future transaction has an invalid recorded commit-object ID");
    }

    if (params.recovery_action === "remove-owned-uncommitted") {
      if (!transaction) throw new Error("no interrupted future transaction exists to remove");
      if (transaction.status !== "failed" && transaction.status !== "running") {
        throw new Error("removal authority is not live for this completed or retired transaction");
      }
      const ownershipConsumedPreflight = controlFilePath(
        base.state.commonDir,
        "future-ownership-consumed",
        `${dispositionId}.json`,
      );
      if (ownershipConsumedPreflight !== ownershipConsumedPath) {
        throw new Error("derived ownership-consumption path changed");
      }
      // An existing exact consumed manifest resumes an interrupted retirement.
      // The helper verifies every manifest-bound destination before continuing.
      if (!productMutated || !ownershipProven || !existsSync(ownershipPath)) {
        throw new Error("refusing removal without immutable file ownership proof and a directory mutation guard");
      }
      const directoryReceipt = validateFutureOwnershipReceipt(ownershipPath, {
        dispositionId,
        payloadFingerprint,
        ownerSessionId: sessionId,
        repositoryRoot: cwd,
        baseHead,
        targetDirectory: relativeDir,
      });
      if (transaction.bundle_ownership_receipt_path !== bundleOwnershipPath || !existsSync(bundleOwnershipPath)) {
        throw new Error("refusing removal without immutable proof of the owned file objects and directory guard");
      }
      let bundleReceipt = validateBundleOwnershipReceipt(bundleOwnershipPath, {
        dispositionId,
        payloadFingerprint,
        ownerSessionId: sessionId,
        repositoryRoot: cwd,
        commonDir: base.state.commonDir,
        targetDirectory: relativeDir,
        documents: params.documents,
        baseHead,
        directoryReceiptPath: ownershipPath,
        directoryReceiptSha256: sha256(readDurableFile(ownershipPath)),
        fileReceiptPaths: fileOwnershipPaths,
        fileAnchorPaths,
        fileReceiptSha256s: Object.fromEntries(Object.entries(fileOwnershipPaths).map(([name, path]) => [name, sha256(readDurableFile(path))])),
      });
      if (typeof transaction.commit_sha === "string" || typeof transaction.commit_object_sha === "string") {
        throw new Error("cannot remove a future transaction after a commit object exists; inspect and reconcile the commit");
      }
      if (state.head !== baseHead) throw new Error("cannot remove owned files because HEAD changed from the recorded base");
      validateRemovableOwnedBundle(futureRoot, targetDir, params.documents);
      const dirty = porcelainPaths(state.status);
      if (dirty.some((path) => !ownedPaths.includes(path))) {
        throw new Error(`cannot remove while unrelated dirty paths exist: ${dirty.join(", ")}`);
      }
      const staged = (await git(pi, cwd, ["diff", "--cached", "--name-only", "-z"], undefined)).split("\0").filter(Boolean);
      if (staged.some((path) => !ownedPaths.includes(path))) {
        throw new Error(`cannot remove while unrelated staged paths exist: ${staged.join(", ")}`);
      }
      if (staged.length) await git(pi, cwd, ["restore", "--staged", "--", ...ownedPaths], undefined);

      // Re-resolve all retirement control children after the final awaited Git
      // boundary, then revalidate object-bound product ownership. No await occurs
      // before one helper retires the product and construction evidence.
      const ownershipConsumedPathAtUse = controlFilePath(
        base.state.commonDir,
        "future-ownership-consumed",
        `${dispositionId}.json`,
      );
      if (ownershipConsumedPathAtUse !== ownershipConsumedPath) {
        throw new Error("derived ownership-consumption path changed");
      }
      controlFilePath(base.state.commonDir, "indexes", `${dispositionId}.index`);
      // Existing exact consumed manifests resume in the helper.
      bundleReceipt = validateBundleOwnershipReceipt(bundleOwnershipPath, {
        dispositionId,
        payloadFingerprint,
        ownerSessionId: sessionId,
        repositoryRoot: cwd,
        commonDir: base.state.commonDir,
        targetDirectory: relativeDir,
        documents: params.documents,
        baseHead,
        directoryReceiptPath: ownershipPath,
        directoryReceiptSha256: sha256(readDurableFile(ownershipPath)),
        fileReceiptPaths: fileOwnershipPaths,
        fileAnchorPaths,
        fileReceiptSha256s: Object.fromEntries(Object.entries(fileOwnershipPaths).map(([name, path]) => [name, sha256(readDurableFile(path))])),
      });
      const bundleFiles = object(bundleReceipt.files, "future bundle file identities");
      const removalFiles = documentEntries.map(([name, content]) => {
        const fileEntry = object(bundleFiles[name], `future bundle ownership entry ${name}`);
        const fileReceipt = readDurableJson(fileOwnershipPaths[name]);
        if (fileReceipt.version !== 3) throw new Error(`refusing retirement without protected allocation anchor: ${name}`);
        return {
          name,
          content,
          identity: identity(fileEntry.filesystem_identity, `future bundle file identity ${name}`),
          anchor_path: secureRelative(base.state.commonDir, fileAnchorPaths[name]),
          anchor_parent_identity: directoryAuthority(dirname(fileAnchorPaths[name])),
          anchor_identity: identity(fileReceipt.anchor_identity, `future file anchor identity ${name}`),
          retired_name: `product-${dispositionId}-${name}`,
        };
      });
      if (typeof transaction.tree_evidence_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(transaction.tree_evidence_sha256)) {
        throw new Error("refusing removal without a valid tree-evidence ownership hash");
      }
      const existingManifest = existsSync(ownershipConsumedPathAtUse)
        ? readDurableJson(ownershipConsumedPathAtUse) : null;
      const treeLocation = controlLocation(indexPath);
      const treeEvidence = secureFs<{ exists: boolean; sha256?: string; identity?: unknown }>({
        operation: "read-file", root: treeLocation.root, path: treeLocation.relativePath, allow_missing: true,
        root_identity: treeLocation.rootIdentity, parent_identity: treeLocation.parentIdentity,
      });
      let treeEvidenceIdentity: FilesystemIdentity;
      if (treeEvidence.exists) {
        if (treeEvidence.sha256 !== transaction.tree_evidence_sha256) throw new Error("tree evidence hash changed before retirement");
        treeEvidenceIdentity = identity(treeEvidence.identity, "tree evidence removal identity");
      } else {
        if (!existingManifest) throw new Error("refusing removal without the exact tree-evidence object or retirement manifest");
        const retirements = object(existingManifest.retirements, "consumed retirement manifest");
        const tree = object(retirements.tree_evidence, "consumed tree evidence retirement");
        treeEvidenceIdentity = identity(tree.identity, "consumed tree evidence identity");
      }
      const tombstone = {
        version: 2,
        kind: "future-directory-ownership-consumed",
        disposition_id: dispositionId,
        payload_fingerprint: payloadFingerprint,
        owner_session_id: sessionId,
        repository_root: cwd,
        target_directory: relativeDir,
        ownership_receipt_sha256: sha256(readDurableFile(ownershipPath)),
        bundle_ownership_receipt_sha256: sha256(readDurableFile(bundleOwnershipPath)),
        consumed_for: "remove-owned-uncommitted",
        retirements: {
          files: Object.fromEntries(removalFiles.map((item) => [item.name, {
            destination: item.retired_name, identity: item.identity, sha256: sha256(item.content),
            anchor_path: item.anchor_path, anchor_identity: item.anchor_identity,
          }])),
          tree_evidence: {
            destination: `tree-${dispositionId}.index`, identity: treeEvidenceIdentity,
            sha256: transaction.tree_evidence_sha256,
          },
        },
      };
      if (existingManifest && canonicalJson(existingManifest) !== canonicalJson(tombstone)) {
        throw new Error("existing consumed retirement manifest does not match immutable ownership evidence");
      }
      requireMutationAuthority(existingManifest !== null);
      const removal = secureFs<{ consumed_created: boolean; retirement_complete: boolean }>({
        operation: "remove-bundle",
        repo: cwd,
        common_dir: base.state.commonDir,
        common_identity: directoryAuthority(base.state.commonDir),
        consumed_parent_identity: directoryAuthority(dirname(ownershipConsumedPathAtUse)),
        indexes_identity: directoryAuthority(dirname(indexPath)),
        quarantine_identity: directoryAuthority(ensureControlDirectory(base.state.commonDir, "quarantine")),
        target_path: relativeDir.split("\\").join("/"),
        directory_identity: identity(bundleReceipt.directory_identity, "future bundle directory identity"),
        files: removalFiles,
        consumed_name: `${dispositionId}.json`,
        tombstone_text: canonicalJson(tombstone),
        tree_evidence_name: `${dispositionId}.index`,
        tree_evidence_retired_name: `tree-${dispositionId}.index`,
        tree_evidence_sha256: transaction.tree_evidence_sha256,
        tree_evidence_identity: treeEvidenceIdentity,
      });
      if (!removal.retirement_complete) throw new Error("owned retirement did not complete");
      ownershipConsumedCreated = removal.consumed_created;
      // Keep the shared future-plan parent. Its earlier absence is an observation,
      // not transaction-specific proof that this transaction exclusively created it.
      const after = await inspectCanonicalRepository(pi, cwd, undefined);
      if (after.status.length !== 0 || after.head !== baseHead) {
        throw new Error("owned-file removal did not restore the recorded clean base");
      }
      transaction = {
        ...transaction,
        status: "recovered-clean",
        phase: "owned-uncommitted-removed",
        product_resource_mutation_performed: false,
        recovery_action: "remove-owned-uncommitted",
        ownership_consumed_path: ownershipConsumedPathAtUse,
        recovered_at: new Date().toISOString(),
        next_safe_action: "submit a new explicitly confirmed future disposition if incubation is still desired",
      };
      replaceDurableJson(transactionPath, transaction);
      if (existsSync(blockerPath)) {
        const approvedBlocker = readDurableJsonEvidence(blockerPath);
        if (approvedBlocker.value.disposition_id === dispositionId) await retireApprovedBlocker(pi, blockerPath, approvedBlocker);
      }
      writeAttempt({ status: "recovered-clean", phase: "owned-uncommitted-removed", observed_at: new Date().toISOString() });
      return {
        ...transaction,
        preflight_receipt_path: base.receiptPath,
        transaction_path: transactionPath,
        attempt_path: attemptPath,
        deduplicated: false,
        control_state_writes_performed: controlWrites(transactionPath, attemptPath),
      };
    }

    if (transaction && params.recovery_action !== "continue") {
      throw new Error("interrupted future transaction requires an explicit recovery_action");
    }
    if (!transaction && params.recovery_action) {
      throw new Error("no interrupted future transaction exists to recover");
    }
    if (transaction && productMutated && transaction.ownership_receipt_path === undefined) {
      transaction = {
        ...transaction,
        ownership_receipt_path: ownershipPath,
        product_resource_mutation_performed: true,
      };
      replaceDurableJson(transactionPath, transaction);
    }

    if (transaction) {
      const recoveryDirty = porcelainPaths(state.status);
      if (productMutated) {
        if (recoveryDirty.some((path) => !ownedPaths.includes(path))) {
          throw new Error(`cannot continue while unrelated dirty paths exist: ${recoveryDirty.join(", ")}`);
        }
        validateFutureTargetDirectory(futureRoot, targetDir);
        const recoveryRemoteHead = await remoteRefOid(pi, cwd, state.remote, state.remoteBranch);
        const recordedCommit = typeof transaction.commit_sha === "string"
          ? transaction.commit_sha
          : typeof transaction.commit_object_sha === "string"
            ? transaction.commit_object_sha
            : null;
        const allowedRecoveryOids = recordedCommit ? [baseHead, recordedCommit] : [baseHead];
        if (
          !allowedRecoveryOids.includes(state.head)
          || !allowedRecoveryOids.includes(state.upstreamHead)
          || !allowedRecoveryOids.includes(recoveryRemoteHead)
        ) {
          throw new Error(
            `future recovery state diverged: HEAD=${state.head} upstream=${state.upstreamHead} remote=${recoveryRemoteHead}`,
          );
        }
      } else {
        if (recoveryDirty.length !== 0) {
          throw new Error(`canonical checkout still has pre-existing dirty paths: ${recoveryDirty.join(", ")}`);
        }
        if (state.head !== baseHead) {
          throw new Error(`canonical checkout HEAD ${state.head} changed from recorded recovery base ${baseHead}`);
        }
        if (state.head !== state.upstreamHead) {
          throw new Error(`canonical checkout HEAD ${state.head} differs from upstream ${state.upstreamHead}`);
        }
        const recoveryRemoteHead = await remoteRefOid(pi, cwd, state.remote, state.remoteBranch);
        if (state.head !== recoveryRemoteHead) {
          throw new Error(`canonical checkout HEAD ${state.head} differs from remote default ${recoveryRemoteHead}`);
        }
        if (existsSync(targetDir)) {
          throw new Error(`future bundle path exists without recorded product ownership: ${relativeDir}`);
        }
      }
    }

    if (!transaction) {
      if (state.status.length !== 0) {
        throw new Error(`canonical checkout has pre-existing dirty paths: ${porcelainPaths(state.status).join(", ")}`);
      }
      if (state.head !== state.upstreamHead) {
        throw new Error(`canonical checkout HEAD ${state.head} differs from upstream ${state.upstreamHead}`);
      }
      const remoteHead = await remoteRefOid(pi, cwd, state.remote, state.remoteBranch);
      if (state.head !== remoteHead) {
        throw new Error(`canonical checkout HEAD ${state.head} differs from remote default ${remoteHead}`);
      }
      if (existsSync(targetDir)) throw new Error(`future bundle path already exists: ${relativeDir}`);
      transaction = {
        version: 1,
        disposition_id: dispositionId,
        payload_fingerprint: payloadFingerprint,
        disposition: "future",
        slug: params.decision.slug,
        bundle_sha256: bundleSha256,
        owner_session_id: sessionId,
        owner_session_file: resolvedSessionFile,
        repository_root: cwd,
        git_common_dir: state.commonDir,
        current_branch: state.currentBranch,
        upstream_branch: state.upstream,
        remote_default_branch: state.defaultRemoteBranch,
        base_head: state.head,
        remote_base_head: remoteHead,
        target_directory: relativeDir,
        future_root_preexisting: existsSync(ensureFutureRoot(cwd, false)),
        owned_paths: ownedPaths,
        status: "running",
        phase: "journal-created",
        product_resource_mutation_performed: false,
        created_at: new Date().toISOString(),
        next_safe_action: "the owning invocation may continue under the project lock",
      };
      replaceDurableJson(transactionPath, transaction);
      await testFault(pi, "journal-created");
    } else {
      if (state.head !== baseHead && typeof transaction.commit_sha !== "string") {
        const recoveredCommit = await findDispositionCommit(pi, cwd, dispositionId, baseHead, ownedPaths);
        if (recoveredCommit) transaction = { ...transaction, commit_sha: recoveredCommit, phase: "commit-reconciled" };
        else throw new Error(`HEAD changed from recorded base ${baseHead}; refusing implicit recovery`);
      }
    }

    let commitSha = typeof transaction.commit_sha === "string" ? transaction.commit_sha : null;
    let commitObjectSha = typeof transaction.commit_object_sha === "string"
      ? transaction.commit_object_sha
      : commitSha;

    if (!commitObjectSha) {
      if (!existsSync(targetDir) && ownershipProven) {
        throw new Error("immutable ownership receipt exists but its directory is absent; refusing automatic recreation");
      }
      if (!existsSync(targetDir)) {
        ensureFutureRoot(cwd, true);
        requireMutationAuthority();
        const createdDirectory = secureFs<{ identity: unknown }>({
          operation: "create-directory",
          repo: cwd,
          path: relativeDir.split("\\").join("/"),
        });
        ownedDirectoryIdentity = identity(createdDirectory.identity, "created future directory identity");
        productMutated = true;
        ownershipCreated = createDurableJson(ownershipPath, {
          version: 3,
          kind: "future-directory-ownership",
          disposition_id: dispositionId,
          payload_fingerprint: payloadFingerprint,
          owner_session_id: sessionId,
          repository_root: cwd,
          base_head: baseHead,
          target_directory: relativeDir,
          directory_created_exclusively: true,
          directory_identity: ownedDirectoryIdentity,
          created_at: new Date().toISOString(),
        });
        if (!ownershipCreated) {
          throw new Error(`future directory ownership receipt already exists: ${ownershipPath}`);
        }
        transaction = {
          ...transaction,
          phase: "directory-created",
          product_resource_mutation_performed: true,
          ownership_receipt_path: ownershipPath,
        };
        replaceDurableJson(transactionPath, transaction);
        await testFault(pi, "directory-created");
        requireMutationAuthority();
      } else if (!productMutated) {
        throw new Error(`future bundle path already exists without transaction ownership: ${relativeDir}`);
      }

      if (!ownedDirectoryIdentity) throw new Error("owned directory identity is unavailable");
      for (const [name, content] of documentEntries) {
        validateFutureTargetDirectory(futureRoot, targetDir);
        const path = join(targetDir, name);
        const fileReceiptPath = fileOwnershipPaths[name];
        if (!existsSync(path)) {
          transaction = { ...transaction, phase: `writing-${name}` };
          replaceDurableJson(transactionPath, transaction);
          const anchorLocation = controlLocation(fileAnchorPaths[name]);
          requireMutationAuthority();
          const createdFile = secureFs<{ identity: unknown; anchor_identity: unknown }>({
            operation: "create-file",
            repo: cwd,
            common_dir: base.state.commonDir,
            common_identity: directoryAuthority(base.state.commonDir),
            path: join(relativeDir, name).split("\\").join("/"),
            content,
            directory_identity: ownedDirectoryIdentity,
            anchor_path: anchorLocation.relativePath,
            anchor_parent_identity: anchorLocation.parentIdentity,
          });
          const createdIdentity = identity(createdFile.identity, `created future file identity ${name}`);
          const anchorIdentity = identity(createdFile.anchor_identity, `created future file anchor identity ${name}`);
          productMutated = true;
          if (!createDurableJson(fileReceiptPath, {
            version: 3,
            kind: "future-file-ownership",
            disposition_id: dispositionId,
            payload_fingerprint: payloadFingerprint,
            owner_session_id: sessionId,
            repository_root: cwd,
            target_directory: relativeDir,
            name,
            sha256: sha256(content),
            filesystem_identity: createdIdentity,
            anchor_path: secureRelative(base.state.commonDir, fileAnchorPaths[name]),
            anchor_identity: anchorIdentity,
            directory_ownership_receipt_sha256: sha256(readDurableFile(ownershipPath)),
            created_at: new Date().toISOString(),
          })) throw new Error(`future file ownership receipt already exists: ${fileReceiptPath}`);
          fileOwnershipCreated.push(fileReceiptPath);
          transaction = { ...transaction, phase: `wrote-${name}`, product_resource_mutation_performed: true };
          replaceDurableJson(transactionPath, transaction);
          await testFault(pi, `file-written:${name}`);
          requireMutationAuthority();
        }
        if (!existsSync(fileReceiptPath)) {
          throw new Error(`future file exists without immutable creation evidence: ${name}`);
        }
        validateFileOwnershipReceipt(fileReceiptPath, {
          dispositionId,
          payloadFingerprint,
          ownerSessionId: sessionId,
          repositoryRoot: cwd,
          targetDirectory: relativeDir,
          name,
          content,
          directoryReceiptSha256: sha256(readDurableFile(ownershipPath)),
          anchorPath: secureRelative(base.state.commonDir, fileAnchorPaths[name]),
        });
      }
      const documentHashes = validateOwnedBundle(futureRoot, targetDir, params.documents);
      const fileIdentities: Record<string, unknown> = {};
      const snapshotFiles: Record<string, unknown>[] = [];
      for (const [name, content] of documentEntries) {
        const fileReceipt = validateFileOwnershipReceipt(fileOwnershipPaths[name], {
          dispositionId,
          payloadFingerprint,
          ownerSessionId: sessionId,
          repositoryRoot: cwd,
          targetDirectory: relativeDir,
          name,
          content,
          directoryReceiptSha256: sha256(readDurableFile(ownershipPath)),
          anchorPath: secureRelative(base.state.commonDir, fileAnchorPaths[name]),
        });
        const fileIdentity = identity(fileReceipt.filesystem_identity, `future file ownership identity ${name}`);
        if (fileReceipt.version !== 3) throw new Error(`future file ownership lacks protected allocation anchor: ${name}`);
        const anchorIdentity = identity(fileReceipt.anchor_identity, `future file anchor identity ${name}`);
        const anchorPath = fileAnchorPaths[name];
        fileIdentities[name] = {
          sha256: sha256(content),
          filesystem_identity: fileIdentity,
          creation_receipt_path: fileOwnershipPaths[name],
          creation_receipt_sha256: sha256(readDurableFile(fileOwnershipPaths[name])),
        };
        snapshotFiles.push({
          name, content, identity: fileIdentity,
          anchor_path: secureRelative(base.state.commonDir, anchorPath),
          anchor_parent_identity: directoryAuthority(dirname(anchorPath)),
          anchor_identity: anchorIdentity,
        });
      }
      const snapshot = secureFs<{ directory_identity: unknown }>({
        operation: "snapshot-bundle",
        repo: cwd,
        common_dir: base.state.commonDir,
        common_identity: directoryAuthority(base.state.commonDir),
        target_path: relativeDir.split("\\").join("/"),
        directory_identity: ownedDirectoryIdentity,
        files: snapshotFiles,
      });
      const finalDirectoryIdentity = identity(snapshot.directory_identity, "final future directory identity");
      if (existsSync(bundleOwnershipPath)) {
        const bundleReceipt = validateBundleOwnershipReceipt(bundleOwnershipPath, {
          dispositionId,
          payloadFingerprint,
          ownerSessionId: sessionId,
          repositoryRoot: cwd,
          commonDir: base.state.commonDir,
          targetDirectory: relativeDir,
          documents: params.documents,
          baseHead,
          directoryReceiptPath: ownershipPath,
          directoryReceiptSha256: sha256(readDurableFile(ownershipPath)),
          fileReceiptPaths: fileOwnershipPaths,
          fileAnchorPaths,
          fileReceiptSha256s: Object.fromEntries(Object.entries(fileOwnershipPaths).map(([name, path]) => [name, sha256(readDurableFile(path))])),
        });
        const recordedDirectory = identity(bundleReceipt.directory_identity, "future bundle directory identity");
        if (canonicalJson(recordedDirectory) !== canonicalJson(finalDirectoryIdentity)) {
          throw new Error("future bundle directory identity changed from immutable evidence");
        }
      } else {
        bundleOwnershipCreated = createDurableJson(bundleOwnershipPath, {
          version: 2,
          kind: "future-bundle-ownership",
          disposition_id: dispositionId,
          payload_fingerprint: payloadFingerprint,
          owner_session_id: sessionId,
          repository_root: cwd,
          target_directory: relativeDir,
          directory_identity: finalDirectoryIdentity,
          directory_receipt_path: ownershipPath,
          directory_receipt_sha256: sha256(readDurableFile(ownershipPath)),
          files: fileIdentities,
          created_at: new Date().toISOString(),
        });
        if (!bundleOwnershipCreated) {
          throw new Error(`future bundle ownership receipt already exists: ${bundleOwnershipPath}`);
        }
        transaction = {
          ...transaction,
          phase: "bundle-ownership-recorded",
          bundle_ownership_receipt_path: bundleOwnershipPath,
        };
        replaceDurableJson(transactionPath, transaction);
      }
      if (transaction.bundle_ownership_receipt_path !== bundleOwnershipPath) {
        transaction = { ...transaction, bundle_ownership_receipt_path: bundleOwnershipPath };
        replaceDurableJson(transactionPath, transaction);
      }
      const current = await inspectCanonicalRepository(pi, cwd, undefined);
      const dirtyPaths = porcelainPaths(current.status);
      if (dirtyPaths.some((path) => !ownedPaths.includes(path))) {
        throw new Error(`unrelated dirty paths appeared during future transaction: ${dirtyPaths.join(", ")}`);
      }
      if (current.head !== baseHead) throw new Error("HEAD changed before building the future commit");

      ensureControlDirectory(base.state.commonDir, "indexes");
      transaction = { ...transaction, phase: "building-exact-tree", document_hashes: documentHashes, tree_evidence_path: indexPath };
      replaceDurableJson(transactionPath, transaction);
      await testFault(pi, "before-exact-tree-build");
      requireMutationAuthority();
      // The helper opens `indexes` with O_DIRECTORY|O_NOFOLLOW and constructs
      // the exact tree directly from trusted blobs. A pathname swap cannot
      // redirect the retained construction evidence.
      ensureControlDirectory(base.state.commonDir, "indexes");
      const built = secureFs<Record<string, unknown>>({
        operation: "build-tree",
        common_dir: base.state.commonDir,
        common_identity: directoryAuthority(base.state.commonDir),
        base_head: baseHead,
        target_path: relativeDir.split("\\").join("/"),
        names: documentEntries.map(([name]) => name),
        contents: documentEntries.map(([, content]) => content),
      });
      if (typeof built.tree !== "string" || !GIT_OID.test(built.tree)) {
        throw new Error("secure exact-tree builder returned invalid evidence");
      }
      const tree = built.tree;
      const indexEvidence = {
        version: 1,
        kind: "future-tree-construction-evidence",
        disposition_id: dispositionId,
        base_head: baseHead,
        tree,
        bundle_sha256: bundleSha256,
        modes: Object.fromEntries(documentEntries.map(([name]) => [name, "100644 blob"])),
      };
      const indexEvidenceText = canonicalJson(indexEvidence);
      if (!createDurableJson(indexPath, indexEvidence)
        && sha256(readDurableFile(indexPath)) !== sha256(indexEvidenceText)) {
        throw new Error("retained tree-construction evidence does not match the rebuilt exact tree");
      }
      const indexEvidenceSha256 = sha256(indexEvidenceText);
      validateOwnedBundle(futureRoot, targetDir, params.documents);
      await validateTreeBundle(pi, cwd, tree, ownedPaths, params.documents);

      transaction = {
        ...transaction,
        phase: "exact-tree-built",
        constructed_tree: tree,
        tree_evidence_sha256: indexEvidenceSha256,
      };
      replaceDurableJson(transactionPath, transaction);
      await testFault(pi, "exact-tree-built");
      requireMutationAuthority();

      const message = `docs: incubate ${params.decision.slug} specification\n\nPrime-Claw-Disposition: ${dispositionId}`;
      commitObjectSha = (await git(
        pi, cwd, ["commit-tree", tree, "-p", baseHead, "-m", message], signal,
      )).trim();
      await validateCommitBundle(pi, cwd, commitObjectSha, ownedPaths, params.documents);
      transaction = { ...transaction, phase: "commit-object-created", commit_object_sha: commitObjectSha };
      replaceDurableJson(transactionPath, transaction);
      await testFault(pi, "commit-object-created");
    } else {
      const parent = (await git(pi, cwd, ["rev-parse", `${commitObjectSha}^`], undefined)).trim();
      if (parent !== baseHead) throw new Error("recorded future commit object is not based on the recorded HEAD");
      await validateCommitBundle(pi, cwd, commitObjectSha, ownedPaths, params.documents);
    }

    let afterObject = await inspectCanonicalRepository(pi, cwd, undefined);
    if (afterObject.head === baseHead) {
      transaction = { ...transaction, phase: "advancing-default-ref", commit_object_sha: commitObjectSha };
      replaceDurableJson(transactionPath, transaction);
      requireMutationAuthority();
      await git(
        pi,
        cwd,
        ["update-ref", `refs/heads/${afterObject.currentBranch}`, commitObjectSha, baseHead],
        signal,
      );
      await testFault(pi, "default-ref-advanced");
      afterObject = await inspectCanonicalRepository(pi, cwd, undefined);
    }
    if (afterObject.head !== commitObjectSha) {
      throw new Error(`canonical HEAD ${afterObject.head} is not the owned future commit ${commitObjectSha}`);
    }

    // Exact tree construction avoided the shared primary index. Reconcile only
    // the owned paths after the CAS ref update.
    const reconcileStatus = porcelainPaths(afterObject.status);
    if (reconcileStatus.some((path) => !ownedPaths.includes(path))) {
      throw new Error(`unrelated paths appeared before primary-index reconciliation: ${reconcileStatus.join(", ")}`);
    }
    requireMutationAuthority();
    await git(pi, cwd, ["add", "--", ...ownedPaths.map((path) => `:(literal)${path}`)], undefined);
    const primaryStaged = (await git(pi, cwd, ["diff", "--cached", "--name-only", "-z"], undefined)).split("\0").filter(Boolean);
    if (primaryStaged.length !== 0) {
      throw new Error(`primary index is not clean after owned-path reconciliation: ${primaryStaged.join(", ")}`);
    }
    await testFault(pi, "primary-index-reconciled");
    commitSha = commitObjectSha;
    transaction = { ...transaction, phase: "committed", commit_sha: commitSha };
    replaceDurableJson(transactionPath, transaction);

    const beforePush = await inspectCanonicalRepository(pi, cwd, undefined);
    const remoteBeforePush = await remoteRefOid(pi, cwd, beforePush.remote, beforePush.remoteBranch);
    if (beforePush.status.length !== 0) {
      throw new Error(`canonical checkout is dirty before push: ${porcelainPaths(beforePush.status).join(", ")}`);
    }
    if (beforePush.head !== commitSha) {
      throw new Error(`canonical HEAD ${beforePush.head} moved away from owned future commit ${commitSha}`);
    }
    if (remoteBeforePush !== commitSha) {
      if (remoteBeforePush !== baseHead) {
        throw new Error(`remote default branch raced from recorded base ${baseHead} to ${remoteBeforePush}`);
      }
      transaction = {
        ...transaction,
        phase: "pushing",
        push_target: `${beforePush.remote}/${beforePush.remoteBranch}`,
        remote_oid_before_push: remoteBeforePush,
      };
      replaceDurableJson(transactionPath, transaction);
      requireMutationAuthority();
      await git(
        pi,
        cwd,
        ["push", "--porcelain", beforePush.remote, `${commitSha}:refs/heads/${beforePush.remoteBranch}`],
        signal,
      );
      await testFault(pi, "push-returned");
    }

    let verified = await inspectCanonicalRepository(pi, cwd, undefined);
    const remoteAfterPush = await remoteRefOid(pi, cwd, verified.remote, verified.remoteBranch);
    if (remoteAfterPush !== commitSha) {
      throw new Error(`remote default branch ${verified.remote}/${verified.remoteBranch} is ${remoteAfterPush}, expected ${commitSha}`);
    }
    if (!(await gitIsAncestor(pi, cwd, commitSha, verified.upstream))) {
      requireMutationAuthority();
      await git(
        pi,
        cwd,
        ["fetch", "--no-tags", verified.remote, `+refs/heads/${verified.remoteBranch}:refs/remotes/${verified.remote}/${verified.remoteBranch}`],
        undefined,
      );
      verified = await inspectCanonicalRepository(pi, cwd, undefined);
    }
    if (!(await gitIsAncestor(pi, cwd, commitSha, verified.upstream))) {
      throw new Error("future commit is not reachable from the configured upstream after remote reconciliation");
    }
    if (verified.head !== commitSha || verified.upstreamHead !== commitSha) {
      throw new Error(`verified canonical state is not exact: HEAD=${verified.head} upstream=${verified.upstreamHead} expected=${commitSha}`);
    }
    if (verified.status.length !== 0) {
      throw new Error(`canonical checkout is not clean after future push: ${porcelainPaths(verified.status).join(", ")}`);
    }
    if (!sameStrings(await commitPaths(pi, cwd, commitSha), ownedPaths)) {
      throw new Error("verified future commit path set no longer matches the owned bundle");
    }
    const successTree = (await git(pi, cwd, ["rev-parse", `${commitSha}^{tree}`], undefined)).trim();
    const fileReceiptRefs = Object.fromEntries(Object.entries(fileOwnershipPaths).map(([name, path]) => [name, {
      path,
      sha256: sha256(readDurableFile(path)),
    }]));
    const successProof: Record<string, unknown> = {
      version: 2,
      kind: "future-verified-success",
      status: "verified-success",
      phase: "pushed-and-clean",
      disposition_id: dispositionId,
      payload_fingerprint: payloadFingerprint,
      disposition: "future",
      slug: params.decision.slug,
      bundle_sha256: bundleSha256,
      owner_session_id: sessionId,
      owner_session_file: resolvedSessionFile,
      repository_root: cwd,
      git_common_dir: state.commonDir,
      branch: {
        local: verified.currentBranch,
        upstream: verified.upstream,
        remote: verified.remote,
        remote_branch: verified.remoteBranch,
      },
      base_head: baseHead,
      target_directory: relativeDir,
      owned_paths: ownedPaths,
      document_hashes: {
        "SPECIFICATION.md": sha256(params.documents.specification_markdown),
        "REQUIREMENTS.md": sha256(params.documents.requirements_markdown),
        "DECISIONS.md": sha256(params.documents.decisions_markdown),
      },
      receipts: {
        directory: { path: ownershipPath, sha256: sha256(readDurableFile(ownershipPath)) },
        files: fileReceiptRefs,
        bundle: { path: bundleOwnershipPath, sha256: sha256(readDurableFile(bundleOwnershipPath)) },
        tree_evidence: { path: indexPath, sha256: sha256(readDurableFile(indexPath)) },
      },
      commit: { oid: commitSha, tree: successTree, parent: baseHead, changed_paths: ownedPaths },
      publication: {
        verified_head: verified.head,
        verified_upstream_head: verified.upstreamHead,
        verified_remote_head: remoteAfterPush,
        checkout_clean: true,
        verified_at: new Date().toISOString(),
      },
      episode_resources_allocated: false,
    };
    transaction = successProof;
    requireMutationAuthority();
    preserveSuccessEvidence = true;
    replaceDurableJson(transactionPath, successProof);
    const persistedSuccess = readDurableJson(transactionPath);
    await validateVerifiedFutureSuccess(pi, cwd, verified, persistedSuccess, {
      dispositionId, payloadFingerprint, ownerSessionId: sessionId, ownerSessionFile: resolvedSessionFile,
      repositoryRoot: cwd, baseHead, targetDirectory: relativeDir, ownershipPath,
      fileOwnershipPaths, fileAnchorPaths, bundleOwnershipPath, treeEvidencePath: indexPath, ownedPaths, documents: params.documents,
    });
    await testFault(pi, "success-journal-written");
    requireMutationAuthority();
    writeAttempt({ status: "verified-success", phase: "pushed-and-clean", commit_sha: commitSha, observed_at: new Date().toISOString() });
    const successLock = lock;
    lock = null;
    releaseProjectLock(successLock);
    await finalRemoteReachability(pi, cwd, verified, commitSha);
    await testFault(pi, "before-success-blocker-cleanup");
    if (existsSync(blockerPath)) {
      const approvedBlocker = readDurableJsonEvidence(blockerPath);
      if (approvedBlocker.value.disposition_id === dispositionId) await retireApprovedBlocker(pi, blockerPath, approvedBlocker);
    }
    return {
      ...successProof,
      commit_sha: commitSha,
      commit_object_sha: commitSha,
      private_tree: successTree,
      ownership_receipt_path: ownershipPath,
      bundle_ownership_receipt_path: bundleOwnershipPath,
      verified_head: verified.head,
      verified_upstream_head: verified.upstreamHead,
      verified_remote_head: remoteAfterPush,
      verified_at: object(successProof.publication, "success publication").verified_at,
      checkout_clean: true,
      product_resource_mutation_performed: true,
      preflight_receipt_path: base.receiptPath,
      transaction_path: transactionPath,
      attempt_path: attemptPath,
      deduplicated: false,
      control_state_writes_performed: controlWrites(transactionPath, attemptPath),
    };

  } catch (error) {
    const failure = errorMessage(error);
    if (/stable lock guard|lock incarnation|lock directory contains|lock owner|project exclusion authority/i.test(failure)) {
      preserveAmbiguousLockEvidence = true;
      return {
        status: "failed",
        phase: "lock-authority-lost",
        error: failure,
        transaction_journal_preserved: true,
        corrupt_success_journal_preserved: true,
        lock_evidence_preserved: true,
        preflight_receipt_path: base.receiptPath,
        transaction_path: transactionPath,
        attempt_path: attemptPath,
        deduplicated: false,
        recovery_action_required: true,
        control_state_writes_performed: controlWrites(attemptPath),
      };
    }
    if (preserveSuccessEvidence) {
      try {
        writeAttempt({
          status: "corrupt-success",
          phase: "success-preservation-guard",
          error: failure,
          next_safe_action: "preserve the journal and blocker; inspect without normalizing success evidence",
          observed_at: new Date().toISOString(),
        });
      } catch {
        // Preservation outranks diagnostic persistence.
      }
      return {
        status: "failed",
        phase: "success-preservation-guard",
        error: failure,
        corrupt_success_journal_preserved: true,
        preflight_receipt_path: base.receiptPath,
        transaction_path: transactionPath,
        attempt_path: attemptPath,
        deduplicated: false,
        recovery_action_required: true,
        control_state_writes_performed: controlWrites(attemptPath),
      };
    }
    const current = transaction ?? {
      version: 1,
      disposition_id: dispositionId,
      payload_fingerprint: payloadFingerprint,
      disposition: "future",
      slug: params.decision.slug,
      bundle_sha256: bundleSha256,
      owner_session_id: sessionId,
      owner_session_file: resolvedSessionFile,
      repository_root: cwd,
      git_common_dir: base.state.commonDir,
      current_branch: base.state.currentBranch,
      upstream_branch: base.state.upstream,
      remote_default_branch: base.state.defaultRemoteBranch,
      base_head: base.state.head,
      target_directory: relativeDir,
      owned_paths: ownedPaths,
      status: "failed",
      phase: "before-journal",
      product_resource_mutation_performed: productMutated,
    };
    let observed: Record<string, unknown> = current;
    try {
      observed = await reconcileFutureState(pi, cwd, current, ownedPaths, params.documents);
    } catch (observationError) {
      observed = { ...current, observation_error: errorMessage(observationError) };
    }
    transaction = {
      ...observed,
      status: "failed",
      error: failure,
      failed_at: new Date().toISOString(),
      product_resource_mutation_performed: productMutated,
      recovery_action_required: productMutated,
      next_safe_action: productMutated
        ? "inspect, then explicitly continue or remove only byte-identical owned uncommitted files"
        : "correct the reported precondition and submit a new explicitly confirmed disposition",
    };
    replaceDurableJson(transactionPath, transaction);
    if (productMutated) replaceDurableJson(blockerPath, {
      version: 1,
      disposition_id: dispositionId,
      transaction_path: transactionPath,
      blocked_at: new Date().toISOString(),
      reason: failure,
    });
    writeAttempt({
      status: "failed",
      phase: transaction.phase,
      error: failure,
      recovery_action_required: productMutated,
      next_safe_action: transaction.next_safe_action,
      observed_at: new Date().toISOString(),
    });
    return {
      ...transaction,
      preflight_receipt_path: base.receiptPath,
      transaction_path: transactionPath,
      attempt_path: attemptPath,
      deduplicated: false,
      control_state_writes_performed: controlWrites(transactionPath, attemptPath, ...(productMutated ? [blockerPath] : [])),
    };
  } finally {
    try {
      if (lock && !preserveAmbiguousLockEvidence) releaseProjectLock(lock);
    } catch (error) {
      lockReleaseError = errorMessage(error);
      if (!preserveSuccessEvidence) {
        writeAttempt({
          status: "lock-release-failed",
          phase: transaction?.phase ?? "unknown",
          error: lockReleaseError,
          lock_path: lock?.path ?? lockPath,
          next_safe_action: "inspect the token-matched lock before any further mutation",
          observed_at: new Date().toISOString(),
        });
        throw new Error(`future transaction lock release failed; receipt: ${attemptPath}; ${lockReleaseError}`);
      }
      // A corrupt-success result already preserves the journal, blocker, and
      // diagnostic. Ambiguous lock evidence is left untouched; release failure
      // must not overwrite that diagnostic or turn preservation into mutation.
    }
  }
}

async function executeDisposition(
  pi: ExtensionAPI,
  rawParams: unknown,
  signal: AbortSignal | undefined,
  ctx: ExtensionContext,
) {
  const params = validateDispositionParams(rawParams);
  if (signal?.aborted) throw new Error("spec_disposition cancelled before durable preflight");

  const sessionId = ctx.sessionManager.getSessionId();
  if (!REQUEST_ID.test(sessionId)) throw new Error("persisted Prime Agent session has an invalid stable session ID");
  const sessionFile = ctx.sessionManager.getSessionFile();
  if (!sessionFile) throw new Error("spec_disposition requires a persisted Prime Agent session");
  const managerCwd = realpathSync(ctx.sessionManager.getCwd());
  const cwd = realpathSync(ctx.cwd);
  if (managerCwd !== cwd) throw new Error("session CWD does not match the extension execution root");
  const resolvedSessionFile = validateSessionFile(sessionFile, sessionId, cwd);
  const state = await inspectCanonicalRepository(pi, cwd, signal);
  const preflightQuarantine = params.decision.kind === "future" ? join(state.commonDir, CONTROL_DIR, "quarantine") : state.commonDir;
  const preflightAnchors = params.decision.kind === "future" ? join(state.commonDir, CONTROL_DIR, "future-file-anchors") : state.commonDir;
  const platform = secureFs<{ repo_identity: unknown; common_identity: unknown; retirement_supported: boolean }>({
    operation: "platform-preflight",
    repo: state.repoRoot,
    common_dir: state.commonDir,
    target_path: join(".ralph", "plans", "future", params.decision.slug).split("\\").join("/"),
    quarantine_dir: preflightQuarantine,
    anchor_dir: preflightAnchors,
    require_retirement: params.decision.kind === "future",
  });
  if (params.decision.kind === "future" && platform.retirement_supported !== true) {
    throw new Error("filesystem preflight did not prove the required retirement topology");
  }
  identity(platform.repo_identity, "repository filesystem identity preflight");
  bindDirectoryAuthority(state.commonDir, platform.common_identity, "Git common filesystem identity preflight");
  if (params.decision.kind === "episode") {
    await git(pi, cwd, ["check-ref-format", "--branch", params.decision.branch_name!], signal);
  }
  if (signal?.aborted) throw new Error("spec_disposition cancelled before durable preflight");

  const bundleSha256 = sha256(canonicalJson(params.documents));
  const semanticIdentity = {
    version: 1,
    owner_session_id: sessionId,
    repository_root: state.repoRoot,
    disposition: params.decision.kind,
    slug: params.decision.slug,
    branch_name: params.decision.branch_name ?? null,
    bundle_sha256: bundleSha256,
  };
  const payloadFingerprint = sha256(canonicalJson(semanticIdentity));
  const dispositionId = `disp-${payloadFingerprint.slice(0, 32)}`;
  const requestKey = sha256(canonicalJson({ owner_session_id: sessionId, request_id: params.request_id }));
  const controlRoot = ensureControlDirectory(state.commonDir);
  const requestPath = join(ensureControlDirectory(state.commonDir, "disposition-requests"), `${requestKey}.json`);
  const receiptPath = join(ensureControlDirectory(state.commonDir, "dispositions"), `${dispositionId}.json`);
  const requestRecord = {
    version: 1,
    request_id: params.request_id,
    owner_session_id: sessionId,
    payload_fingerprint: payloadFingerprint,
    disposition_id: dispositionId,
  };
  const requestCreated = createDurableJson(requestPath, requestRecord);
  if (!requestCreated) {
    const existing = readDurableJson(requestPath);
    if (
      existing.owner_session_id !== sessionId
      || existing.request_id !== params.request_id
      || existing.payload_fingerprint !== payloadFingerprint
      || existing.disposition_id !== dispositionId
    ) throw new Error(`request_id collision: ${params.request_id} is already bound to different disposition input`);
  }

  const receipt = {
    version: 1,
    disposition_id: dispositionId,
    payload_fingerprint: payloadFingerprint,
    status: "preflight-ready",
    phase: "validated",
    disposition: params.decision.kind,
    slug: params.decision.slug,
    branch_name: params.decision.branch_name ?? null,
    bundle_sha256: bundleSha256,
    owner_session_id: sessionId,
    owner_session_file: resolvedSessionFile,
    repository_root: state.repoRoot,
    git_common_dir: state.commonDir,
    current_branch: state.currentBranch,
    upstream_branch: state.upstream,
    remote_default_branch: state.defaultRemoteBranch,
    checkout_clean: state.status.length === 0,
    product_resource_mutation_performed: false,
    control_state_kind: "local-git-common-dir-receipt",
    implementation_boundary: params.decision.kind === "future"
      ? "slice-2-future-transaction"
      : "slice-1-preflight-only",
  };
  const receiptCreated = createDurableJson(receiptPath, receipt);
  let durableReceipt: Record<string, unknown> = receipt;
  if (!receiptCreated) {
    const existing = readDurableJson(receiptPath);
    const immutableKeys = [
      "version", "disposition_id", "payload_fingerprint", "status", "phase",
      "disposition", "slug", "branch_name", "bundle_sha256",
      "owner_session_id", "owner_session_file", "repository_root", "git_common_dir",
    ];
    if (immutableKeys.some((key) => existing[key] !== receipt[key])) {
      throw new Error(`disposition collision: durable receipt ${dispositionId} does not match validated input`);
    }
    durableReceipt = existing;
  }

  if (params.decision.kind === "future") {
    return executeFutureTransaction(pi, params, ctx, signal, {
      sessionId, resolvedSessionFile, state, dispositionId, payloadFingerprint,
      bundleSha256, requestKey, requestPath, requestCreated, receiptPath, receiptCreated,
    });
  }

  return {
    ...durableReceipt,
    receipt_path: receiptPath,
    deduplicated: !receiptCreated,
    control_state_writes_performed: [
      ...(requestCreated ? [requestPath] : []),
      ...(receiptCreated ? [receiptPath] : []),
    ],
  };
}

export default function specificationEpisodes(pi: ExtensionAPI): void {
  for (const name of ["design", "spec-it-out"] as const) {
    pi.registerCommand(name, {
      description: name === "design"
        ? "Discover requirements and design, then explicitly incubate or create an episode"
        : "Formalize developed context, then explicitly incubate or create an episode",
      handler: async (args, ctx) => injectSkill(pi, ctx, name, args),
    });
  }

  pi.registerTool({
    name: "spec_disposition",
    label: "Specification Disposition",
    description: "Execute an explicitly confirmed future incubation transaction, or persist an episode preflight. Interrupted future work requires an explicit recovery_action; ordinary retries only inspect durable state.",
    parameters: dispositionParameters as unknown as TSchema,
    executionMode: "sequential",
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const details = await executeDisposition(pi, params, signal, ctx);
      const summary = details.disposition === "future"
        ? `Future specification disposition result: ${String(details.status)}. No branch, worktree, daemon, or episode session was allocated.`
        : "Episode disposition preflight is ready. No product resource, checkout, Git ref/worktree, remote, daemon, or session mutation was performed.";
      return {
        content: [{ type: "text", text: `${summary}\n${JSON.stringify(details, null, 2)}` }],
        details,
      };
    },
  });
}
