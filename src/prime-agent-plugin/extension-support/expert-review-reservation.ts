import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync, constants, existsSync, lstatSync, mkdirSync, openSync, readFileSync,
  realpathSync, renameSync, statSync, unlinkSync, writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  PRIME_CLAW_ROLE_KERNEL_SHA256,
  PRIME_CLAW_ROLE_KERNEL_TEXT,
} from "./role-kernel.generated.ts";

// Retained exports make removal of the old caller-authoritative tools explicit.
// None of these names is registered after the private-launch cutover.
export const EXPERT_REVIEW_RESERVE_TOOL = "prime_claw_reserve_expert_review";
export const EXPERT_REVIEW_BIND_TOOL = "prime_claw_bind_expert_review";
export const EXPERT_REVIEW_STATUS_TOOL = "prime_claw_expert_review_status";
export const EXPERT_REVIEW_CANCEL_TOOL = "prime_claw_cancel_expert_review";
export const OFFICIAL_EXPERT_SELECTOR = "openai-codex/gpt-6-astra";
export const OFFICIAL_EXPERT_THINKING = "max";
export const EXPERT_REVIEW_RESERVATION_TTL_MS = 15 * 60 * 1000;
export const EXPERT_REVIEW_STATE_SCHEMA = "prime-claw-official-expert-launch-v1";
export const EXPERT_REVIEW_PACKET_KIND = "prime-claw-official-expert-review-packet";

const EXPERT_SKILL_NAME = "prime-claw-official-expert-review";
const EXPERT_IMPORT_NAME = "prime_claw_official_expert_review";
const PACKAGE_FILES = ["__init__.py", "reviewer.md"] as const;
const OVERSIGHT_MARKER_TYPE = "prime-claw-conversation-oversight";

type PackageStatusName = "AVAILABLE" | "SYNC_PENDING" | "UNAVAILABLE";
export type OfficialExpertPackageStatus = {
  schemaVersion: 1;
  status: PackageStatusName;
  mode: "managed" | "configured" | "source";
  interpreter?: string;
  expectedPackageSha256?: string;
  packageSha256?: string;
  reason?: string;
  installedReason?: string;
};

export type ExpertReviewRepositoryIdentity = { repositoryPath: string; commitOid: string };
export type ExpertReviewReservationRegistration = {
  guideRoot?: string;
  packageStatus?: (ctx: ExtensionContext) => OfficialExpertPackageStatus;
  repositoryIdentity?: (worktree: string) => ExpertReviewRepositoryIdentity;
  now?: () => number;
  nonce?: () => string;
  stateRoot?: string;
  admissionWaitMs?: number;
  wait?: (milliseconds: number) => Promise<void>;
};

type ProbeResult =
  | { probe: "OK"; value: Record<string, unknown> }
  | { probe: "UNAVAILABLE"; reason: string };

type LaunchRecord = Record<string, unknown> & {
  schema: string;
  phase: "FINALIZED" | "CLAIMED" | "REPORTED" | "SETTLED" | "DISPOSITIONED" | "CLOSED" | "CANCELLED";
  nonce: string;
  createdAt: number;
  expiresAt: number;
  ownerSessionId: string;
  ownerSessionFile: string;
  ownerHeaderId: string;
  ownerGeneration: string;
  projectPath: string;
  repositoryPath: string;
  candidateCommitOid: string;
  packet: Record<string, unknown>;
  packetJson: string;
  packetDigest: string;
  packageSha256: string;
  kernelSha256: string;
  selector: string;
  thinking: string;
  childName: string;
  bootstrapDigest: string;
  finalizedAt: number;
  rlmChildId: string;
  sessionDir: string;
  returnedModel: string;
};

function digest(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object") throw new Error("private review state contains a non-JSON value");
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}

function pluginRoot(options: ExpertReviewReservationRegistration): string {
  return resolve(options.guideRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
}
function packageDirectory(options: ExpertReviewReservationRegistration): string {
  return join(pluginRoot(options), "skills", EXPERT_SKILL_NAME, "src", EXPERT_IMPORT_NAME);
}
function expectedPackageHash(options: ExpertReviewReservationRegistration): string {
  const root = packageDirectory(options); const manifest: Record<string, string> = {};
  for (const name of PACKAGE_FILES) {
    const path = join(root, name); const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || realpathSync(path) !== path) {
      throw new Error(`source package asset is not a canonical regular file: ${name}`);
    }
    manifest[name] = digest(readFileSync(path));
  }
  return digest(JSON.stringify(manifest));
}
function expandHome(value: string): string {
  if (value === "~") return homedir();
  if (value.startsWith("~/") || value.startsWith("~\\")) return join(homedir(), value.slice(2));
  return value;
}
function kernelInterpreter(): { mode: "managed" | "configured"; path: string } {
  const configured = process.env.PRIME_AGENT_KERNEL_PYTHON;
  if (configured) return { mode: "configured", path: resolve(expandHome(configured)) };
  const executable = process.platform === "win32" ? join("Scripts", "python.exe") : join("bin", "python");
  const configuredVenv = process.env.PRIME_AGENT_KERNEL_VENV;
  if (configuredVenv) return { mode: "managed", path: join(resolve(expandHome(configuredVenv)), executable) };
  const primary = join(homedir(), ".prime", "agent", "kernel-venv", executable);
  const dataHome = resolve(expandHome(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share")));
  const fallback = join(dataHome, "prime", "agent", "kernel-venv", executable);
  return { mode: "managed", path: !existsSync(primary) && existsSync(fallback) ? fallback : primary };
}
function probeEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env, PYTHONNOUSERSITE: "1", PYTHONDONTWRITEBYTECODE: "1" };
  delete environment.PYTHONPATH; return environment;
}
function runProbe(interpreter: string, expected: string, source?: string): ProbeResult {
  const code = `import hashlib,importlib.util,json,pathlib\nname=${JSON.stringify(EXPERT_IMPORT_NAME)}\nexpected=${JSON.stringify(expected)}\ntry:\n spec=importlib.util.find_spec(name)\n if spec is None or not spec.origin:\n  raise ModuleNotFoundError(name)\n root=pathlib.Path(spec.origin).resolve().parent\n manifest={item:hashlib.sha256((root/item).read_bytes()).hexdigest() for item in ("__init__.py","reviewer.md")}\n package_hash=hashlib.sha256(json.dumps(manifest,sort_keys=True,separators=(",",":")).encode()).hexdigest()\n if package_hash != expected:\n  print(json.dumps({"probe":"UNAVAILABLE","reason":"package_hash_mismatch"},sort_keys=True))\n else:\n  package=__import__(name)\n  value=package.describe()\n  value["origin"]=package.__file__\n  print(json.dumps({"probe":"OK","value":value},sort_keys=True))\nexcept ModuleNotFoundError:\n print(json.dumps({"probe":"UNAVAILABLE","reason":"package_import_failed"},sort_keys=True))\nexcept Exception:\n print(json.dumps({"probe":"UNAVAILABLE","reason":"package_validation_failed"},sort_keys=True))\n`;
  try {
    const output = execFileSync(interpreter, source ? ["-c", code] : ["-I", "-c", code], {
      cwd: source, env: probeEnvironment(), encoding: "utf8", input: "", timeout: 20_000,
      maxBuffer: 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    });
    const lines = output.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length !== 1) return { probe: "UNAVAILABLE", reason: "invalid_probe_output" };
    const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
    if (parsed.probe === "OK" && parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value)) {
      return { probe: "OK", value: parsed.value as Record<string, unknown> };
    }
    if (parsed.probe === "UNAVAILABLE" && typeof parsed.reason === "string") return { probe: "UNAVAILABLE", reason: parsed.reason };
    return { probe: "UNAVAILABLE", reason: "invalid_probe_output" };
  } catch { return { probe: "UNAVAILABLE", reason: "interpreter_failed" }; }
}
function validDescription(value: Record<string, unknown>, expected: string): boolean {
  const reviewer = value.reviewer;
  return value.schemaVersion === 1
    && value.capability === "private-review-lifecycle-closure"
    && value.authority === false && value.module === EXPERT_IMPORT_NAME
    && value.packageSha256 === expected
    && reviewer !== null && typeof reviewer === "object" && !Array.isArray(reviewer)
    && (reviewer as Record<string, unknown>).name === "expert-reviewer"
    && (reviewer as Record<string, unknown>).model === OFFICIAL_EXPERT_SELECTOR
    && (reviewer as Record<string, unknown>).thinking === OFFICIAL_EXPERT_THINKING;
}
function unavailable(mode: "managed" | "configured" | "source", expected: string | undefined, reason: string, interpreter?: string): OfficialExpertPackageStatus {
  return { schemaVersion: 1, status: "UNAVAILABLE", mode, interpreter, expectedPackageSha256: expected, reason };
}
export function officialExpertPackageStatus(_ctx: ExtensionContext, options: ExpertReviewReservationRegistration = {}): OfficialExpertPackageStatus {
  let expected: string;
  try { expected = expectedPackageHash(options); }
  catch (error) { return unavailable("source", undefined, error instanceof Error ? error.message : String(error)); }
  const interpreter = kernelInterpreter();
  try { if (!statSync(interpreter.path).isFile()) return unavailable(interpreter.mode, expected, "interpreter_missing", interpreter.path); }
  catch { return unavailable(interpreter.mode, expected, "interpreter_missing", interpreter.path); }
  const installed = runProbe(interpreter.path, expected);
  if (installed.probe === "OK" && validDescription(installed.value, expected)) {
    return { schemaVersion: 1, status: "AVAILABLE", mode: interpreter.mode, interpreter: interpreter.path, expectedPackageSha256: expected, packageSha256: expected };
  }
  const installedReason = installed.probe === "OK" ? "package_validation_failed" : installed.reason;
  if (interpreter.mode === "configured") return unavailable("configured", expected, installedReason, interpreter.path);
  const sourceRoot = dirname(packageDirectory(options)); const source = runProbe(interpreter.path, expected, sourceRoot);
  if (source.probe !== "OK" || !validDescription(source.value, expected)
    || resolve(String(source.value.origin ?? "")) !== join(packageDirectory(options), "__init__.py")) {
    return unavailable("managed", expected, "source_import_failed", interpreter.path);
  }
  return { schemaVersion: 1, status: "SYNC_PENDING", mode: "managed", interpreter: interpreter.path, expectedPackageSha256: expected, installedReason };
}

function defaultRepositoryIdentity(worktree: string): ExpertReviewRepositoryIdentity {
  if (!isAbsolute(worktree) || realpathSync(worktree) !== worktree) throw new Error("candidate repository path is not canonical");
  const repositoryPath = execFileSync("git", ["-C", worktree, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 }).trim();
  const commitOid = execFileSync("git", ["-C", worktree, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 }).trim();
  return { repositoryPath, commitOid };
}
function stateRoot(options: ExpertReviewReservationRegistration): string {
  return resolve(options.stateRoot ?? process.env.PRIME_CLAW_PRIVATE_STATE_ROOT
    ?? join(process.env.PRIME_AGENT_CODING_AGENT_DIR ?? join(homedir(), ".prime", "agent"), "prime-claw-private", "expert-review-launches"));
}
function statePaths(root: string, name: string) {
  if (!/^expert-review-[A-Za-z0-9_-]{16,64}$/.test(name)) throw new Error("official EXPERT child name is malformed");
  return {
    pending: join(root, `${name}.pending.json`),
    finalized: join(root, `${name}.finalized.json`),
    claimed: join(root, `${name}.claimed.json`),
    reported: join(root, `${name}.reported.json`),
    settled: join(root, `${name}.settled.json`),
    dispositioned: join(root, `${name}.dispositioned.json`),
    closed: join(root, `${name}.closed.json`),
    cancelled: join(root, `${name}.cancelled.json`),
  };
}
function assertPrivateRoot(root: string): void {
  const metadata = lstatSync(root);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || realpathSync(root) !== root || (metadata.mode & 0o777) !== 0o700) {
    throw new Error("official EXPERT private state root is not a mode-private canonical directory");
  }
}
function readPrivateRecord(path: string): LaunchRecord {
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || realpathSync(path) !== path || (metadata.mode & 0o777) !== 0o600 || metadata.size > 64 * 1024) {
    throw new Error("official EXPERT private state file is not canonical and mode-private");
  }
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
  if (lines.length !== 1) throw new Error("official EXPERT private state file is malformed");
  const record = JSON.parse(lines[0]) as LaunchRecord;
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("official EXPERT private state is malformed");
  return record;
}
function readSessionHeader(path: string): Record<string, unknown> {
  if (!isAbsolute(path) || realpathSync(path) !== path) throw new Error("session file path is not canonical");
  const first = readFileSync(path, "utf8").split(/\r?\n/, 1)[0];
  const value = JSON.parse(first) as Record<string, unknown>;
  if (!value || typeof value !== "object" || Array.isArray(value) || value.type !== "session") throw new Error("session header is malformed");
  return value;
}
function ownerGeneration(path: string, ownerSessionId: string): string {
  const entries = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
  const seen = new Set<string>(); const active: Record<string, unknown>[] = [];
  for (let index = entries.length - 1; index >= 1; index -= 1) {
    const entry = entries[index];
    if (entry.type !== "custom" || entry.customType !== OVERSIGHT_MARKER_TYPE) continue;
    const data = entry.data as Record<string, unknown> | undefined;
    if (!data || data.ownerSessionId !== ownerSessionId) continue;
    const key = `${String(data.slug ?? "")}\0${String(data.episodeId ?? "")}`;
    if (seen.has(key)) continue; seen.add(key);
    if (data.status === "active") active.push(data);
  }
  if (active.length !== 1) throw new Error("parent session does not contain exactly one active owner generation");
  const marker = active[0];
  const values = [marker.markerVersion, marker.ownerSessionId, marker.slug, marker.sourceLocation, marker.episodeId,
    resolve(String(marker.episodeSessionFile)), marker.branch, resolve(String(marker.worktree)), marker.sessionName,
    marker.identityVersion, marker.admission];
  return digest(JSON.stringify(values));
}
function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key]; if (typeof value !== "string" || !value) throw new Error(`official EXPERT state ${key} is malformed`); return value;
}
function requireInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key]; if (!Number.isSafeInteger(value)) throw new Error(`official EXPERT state ${key} is malformed`); return value as number;
}
function modelSelector(ctx: ExtensionContext): string | undefined {
  return ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined;
}
function reviewRubric(options: ExpertReviewReservationRegistration): string {
  const text = readFileSync(join(packageDirectory(options), "reviewer.md"), "utf8");
  const closing = text.indexOf("\n---\n", 4); if (!text.startsWith("---\n") || closing < 0) throw new Error("official EXPERT reviewer definition is malformed");
  const rubric = text.slice(closing + 5).trim(); if (!rubric || rubric.length > 16_384) throw new Error("official EXPERT reviewer rubric is invalid"); return rubric;
}
function failClosed(ctx: ExtensionContext, message: string): never {
  const full = `Official EXPERT admission failed: ${message}`; ctx.ui.notify(full, "error"); ctx.abort(); throw new Error(full);
}
function startCount(messages: Array<Record<string, unknown>>): number {
  // Content and custom-message metadata have zero authority. Prime Agent 0.9.8
  // inserts a public custom harness-digest message on the first committed turn,
  // so only public user-turn boundaries distinguish the spawn from a replay.
  return messages.filter((message) => message.role === "user").length;
}
function providerMessages(record: LaunchRecord, messages: Array<Record<string, unknown>>, options: ExpertReviewReservationRegistration): Array<Record<string, unknown>> {
  const text = `${reviewRubric(options)}\n\n## Immutable review packet\n\n\`\`\`json\n${record.packetJson}\n\`\`\``;
  const user = { role: "user", content: [{ type: "text", text }], timestamp: Date.now() };
  return [user, ...messages.filter((message) => message.role === "assistant" || message.role === "toolResult")];
}
function validateRecord(record: LaunchRecord, ctx: ExtensionContext, options: ExpertReviewReservationRegistration, allowExpired = false): void {
  if (record.schema !== EXPERT_REVIEW_STATE_SCHEMA || !["FINALIZED", "CLAIMED", "REPORTED", "SETTLED", "DISPOSITIONED", "CLOSED"].includes(record.phase)) throw new Error("private launch schema or phase is invalid");
  const now = (options.now ?? Date.now)(); const createdAt = requireInteger(record, "createdAt"); const expiresAt = requireInteger(record, "expiresAt");
  if (createdAt < 0 || expiresAt !== createdAt + EXPERT_REVIEW_RESERVATION_TTL_MS || (!allowExpired && now >= expiresAt)) throw new Error("private launch is stale or expired");
  const sessionDir = realpathSync(ctx.sessionManager.getSessionDir()); const sessionFileValue = ctx.sessionManager.getSessionFile();
  if (!sessionFileValue) throw new Error("child session file is unavailable");
  const sessionFile = realpathSync(sessionFileValue); const childHeader = ctx.sessionManager.getHeader();
  if (!childHeader || childHeader.id !== ctx.sessionManager.getSessionId() || realpathSync(dirname(sessionFile)) !== sessionDir) throw new Error("child public session identity is inconsistent");
  const childName = requireString(record, "childName");
  if (ctx.sessionManager.getSessionName() !== childName || requireString(record, "sessionDir") !== sessionDir
    || requireString(record, "rlmChildId") !== basename(sessionDir)) throw new Error("child name, directory, or RLM id does not match finalized spawn metadata");
  const selector = requireString(record, "selector");
  if (selector !== OFFICIAL_EXPERT_SELECTOR || requireString(record, "returnedModel") !== selector || modelSelector(ctx) !== selector) throw new Error("current child model does not match finalized spawn metadata");
  if (record.thinking !== OFFICIAL_EXPERT_THINKING) throw new Error("requested thinking binding is invalid");
  const projectPath = realpathSync(requireString(record, "projectPath"));
  if (realpathSync(ctx.cwd) !== projectPath || childHeader.cwd !== projectPath) throw new Error("child project cwd binding is invalid");
  const ownerFile = realpathSync(requireString(record, "ownerSessionFile")); const ownerId = requireString(record, "ownerSessionId");
  if (resolve(String(childHeader.parentSession ?? "")) !== ownerFile || childHeader.rlmDepth !== 1) throw new Error("child parent-session lineage is invalid");
  const parentHeader = readSessionHeader(ownerFile);
  if (parentHeader.id !== ownerId || parentHeader.id !== requireString(record, "ownerHeaderId") || parentHeader.cwd !== projectPath || parentHeader.parentSession !== undefined) throw new Error("canonical parent header identity is invalid");
  if (ownerGeneration(ownerFile, ownerId) !== requireString(record, "ownerGeneration")) throw new Error("owner episode generation changed or mismatched");
  const status = (options.packageStatus ?? ((subject) => officialExpertPackageStatus(subject, options)))(ctx);
  if (status.status !== "AVAILABLE" || status.packageSha256 !== requireString(record, "packageSha256")) throw new Error("exact official EXPERT package is unavailable or changed");
  if (record.kernelSha256 !== PRIME_CLAW_ROLE_KERNEL_SHA256) throw new Error("exact neutral role kernel is unavailable or changed");
  if (!record.packet || typeof record.packet !== "object" || Array.isArray(record.packet)
    || canonicalJson(record.packet) !== record.packetJson || digest(record.packetJson) !== record.packetDigest) throw new Error("immutable review packet digest is invalid");
  const repositoryPath = realpathSync(requireString(record, "repositoryPath")); const identity = (options.repositoryIdentity ?? defaultRepositoryIdentity)(repositoryPath);
  const candidate = requireString(record, "candidateCommitOid");
  if (realpathSync(identity.repositoryPath) !== repositoryPath || identity.commitOid !== candidate
    || record.packet.repositoryPath !== repositoryPath || record.packet.commitOid !== identity.commitOid) throw new Error("candidate repository or commit binding changed");
  const snapshot = record.preReviewRepository as Record<string, unknown> | undefined;
  if (!snapshot || snapshot.head !== candidate || snapshot.clean !== true || snapshot.statusBytes !== 0
    || snapshot.statusSha256 !== digest(Buffer.alloc(0))) throw new Error("clean pre-review repository snapshot is invalid");
}
function writeClaim(path: string, record: LaunchRecord, ctx: ExtensionContext): void {
  const claimed = { ...record, phase: "CLAIMED", claimedAt: Date.now(), childSessionId: ctx.sessionManager.getSessionId(), childSessionFile: ctx.sessionManager.getSessionFile(), childSessionName: ctx.sessionManager.getSessionName() };
  const temporary = `${path}.${randomBytes(8).toString("hex")}.tmp`; let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
    writeFileSync(descriptor, `${canonicalJson(claimed)}\n`, "utf8"); closeSync(descriptor); descriptor = undefined;
    renameSync(temporary, path);
  } catch (error) { if (descriptor !== undefined) closeSync(descriptor); if (existsSync(temporary)) unlinkSync(temporary); throw error; }
}

export function registerOfficialExpertReviewReservation(pi: ExtensionAPI, options: ExpertReviewReservationRegistration = {}): void {
  const root = stateRoot(options); const wait = options.wait ?? ((milliseconds) => new Promise<void>((resolveWait) => setTimeout(resolveWait, milliseconds)));
  const waitLimit = options.admissionWaitMs ?? 2_000;
  pi.on("before_agent_start", (_event, ctx) => {
    const name = ctx.sessionManager.getSessionName?.(); if (!name || !existsSync(root)) return;
    let paths: ReturnType<typeof statePaths>;
    try { assertPrivateRoot(root); paths = statePaths(root, name); }
    catch { return; }
    if (Object.values(paths).some((path) => existsSync(path))) return { systemPrompt: PRIME_CLAW_ROLE_KERNEL_TEXT };
  });
  pi.on("context", async (event, ctx) => {
    const name = ctx.sessionManager.getSessionName?.();
    if (!name || !existsSync(root) || !/^expert-review-[A-Za-z0-9_-]{16,64}$/.test(name)) return { messages: event.messages };
    let paths: ReturnType<typeof statePaths>;
    try { assertPrivateRoot(root); paths = statePaths(root, name); }
    catch (error) { return failClosed(ctx, error instanceof Error ? error.message : String(error)); }
    if (!Object.values(paths).some((path) => existsSync(path))) return { messages: event.messages };
    try {
      const deadline = Date.now() + waitLimit;
      const readyPaths = [paths.finalized, paths.claimed, paths.reported, paths.settled,
        paths.dispositioned, paths.closed, paths.cancelled];
      let present: string[] = [];
      while (true) {
        const pendingPresent = existsSync(paths.pending);
        present = readyPaths.filter((path) => existsSync(path));
        if (!pendingPresent && present.length === 1) break;
        const publicationPending = present.length === 0
          || (pendingPresent && present.length === 1 && present[0] === paths.finalized);
        if (!publicationPending) return failClosed(ctx, "conflicting official EXPERT private phase files exist");
        if (Date.now() >= deadline) {
          if (pendingPresent && present.length === 1 && present[0] === paths.finalized) {
            return failClosed(ctx, "conflicting official EXPERT private phase files exist");
          }
          return failClosed(ctx, "timed out waiting for finalized private launch state");
        }
        await wait(Math.min(20, Math.max(1, deadline - Date.now())));
      }
      const currentPath = present[0];
      if ([paths.reported, paths.settled, paths.dispositioned, paths.closed, paths.cancelled].includes(currentPath)) {
        const terminal = readPrivateRecord(currentPath);
        if (currentPath !== paths.cancelled) validateRecord(terminal, ctx, options, true);
        else if (terminal.schema !== EXPERT_REVIEW_STATE_SCHEMA || terminal.phase !== "CANCELLED"
          || terminal.childName !== name) throw new Error("cancelled official EXPERT state is invalid");
        return failClosed(ctx, `${String(terminal.phase).toLowerCase()} review child cannot make another provider call`);
      }
      const alreadyClaimed = currentPath === paths.claimed;
      const record = readPrivateRecord(currentPath);
      validateRecord(record, ctx, options);
      const messages = event.messages as Array<Record<string, unknown>>;
      if (startCount(messages) !== 1) return failClosed(ctx, alreadyClaimed ? "claimed launch was replayed or received a duplicate trigger" : "initial spawn context is missing or has duplicate run triggers");
      if (alreadyClaimed && !messages.some((message) => message.role === "assistant" || message.role === "toolResult")) {
        return failClosed(ctx, "private launch claim was duplicated before a provider continuation");
      }
      if (!alreadyClaimed) {
        if (existsSync(paths.claimed)) return failClosed(ctx, "private launch was already claimed");
        writeClaim(paths.claimed, record, ctx); unlinkSync(paths.finalized);
      }
      return { messages: providerMessages(record, messages, options) as any };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Official EXPERT admission failed:")) throw error;
      return failClosed(ctx, error instanceof Error ? error.message : String(error));
    }
  });
}
