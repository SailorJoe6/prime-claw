import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  assertConversationGuideReady,
  assertExactActiveConversationOwner,
} from "./conversation-oversight.ts";

export const EXPERT_REVIEW_RESERVE_TOOL = "prime_claw_reserve_expert_review";
export const EXPERT_REVIEW_BIND_TOOL = "prime_claw_bind_expert_review";
export const EXPERT_REVIEW_STATUS_TOOL = "prime_claw_expert_review_status";
export const EXPERT_REVIEW_CANCEL_TOOL = "prime_claw_cancel_expert_review";
export const OFFICIAL_EXPERT_SELECTOR = "openai-codex/gpt-6-astra";
export const OFFICIAL_EXPERT_THINKING = "max";
export const EXPERT_REVIEW_RESERVATION_TTL_MS = 15 * 60 * 1000;

const EXPERT_SKILL_NAME = "prime-claw-official-expert-review";
const EXPERT_IMPORT_NAME = "prime_claw_official_expert_review";
const PACKAGE_FILES = ["__init__.py", "reviewer.md"] as const;

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

export type ExpertReviewRepositoryIdentity = {
  repositoryPath: string;
  commitOid: string;
};

export type ExpertReviewReservationRegistration = {
  guideRoot?: string;
  packageStatus?: (ctx: ExtensionContext) => OfficialExpertPackageStatus;
  repositoryIdentity?: (worktree: string) => ExpertReviewRepositoryIdentity;
  now?: () => number;
  nonce?: () => string;
};

type ReservedReview = {
  phase: "reserved";
  ownerSessionId: string;
  ownerGeneration: string;
  nonce: string;
  createdAt: number;
  expiresAt: number;
  repositoryPath: string;
  commitOid: string;
  packetDigest: string;
  selector: string;
  thinking: string;
  packageSha256: string;
};

type BoundReview = Omit<ReservedReview, "phase"> & {
  phase: "bound-pending";
  boundAt: number;
  rlmChildId: string;
  childName: string;
  sessionDir: string;
  returnedModel: string;
};

type ReviewReservation = ReservedReview | BoundReview;

type ProbeResult =
  | { probe: "OK"; value: Record<string, unknown> }
  | { probe: "UNAVAILABLE"; reason: string };

function digest(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function pluginRoot(options: ExpertReviewReservationRegistration): string {
  return resolve(options.guideRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
}

function packageDirectory(options: ExpertReviewReservationRegistration): string {
  return join(pluginRoot(options), "skills", EXPERT_SKILL_NAME, "src", EXPERT_IMPORT_NAME);
}

function expectedPackageHash(options: ExpertReviewReservationRegistration): string {
  const root = packageDirectory(options);
  const manifest: Record<string, string> = {};
  for (const name of PACKAGE_FILES) {
    const path = join(root, name);
    const stat = lstatSync(path);
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
  delete environment.PYTHONPATH;
  return environment;
}

function runProbe(interpreter: string, expected: string, source?: string): ProbeResult {
  const code = `import hashlib,importlib.util,json,pathlib\nname=${JSON.stringify(EXPERT_IMPORT_NAME)}\nexpected=${JSON.stringify(expected)}\ntry:\n spec=importlib.util.find_spec(name)\n if spec is None or not spec.origin:\n  raise ModuleNotFoundError(name)\n root=pathlib.Path(spec.origin).resolve().parent\n manifest={item:hashlib.sha256((root/item).read_bytes()).hexdigest() for item in ("__init__.py","reviewer.md")}\n package_hash=hashlib.sha256(json.dumps(manifest,sort_keys=True,separators=(",",":")).encode()).hexdigest()\n if package_hash != expected:\n  print(json.dumps({"probe":"UNAVAILABLE","reason":"package_hash_mismatch"},sort_keys=True))\n else:\n  package=__import__(name)\n  value=package.describe()\n  value["origin"]=package.__file__\n  print(json.dumps({"probe":"OK","value":value},sort_keys=True))\nexcept ModuleNotFoundError:\n print(json.dumps({"probe":"UNAVAILABLE","reason":"package_import_failed"},sort_keys=True))\nexcept Exception:\n print(json.dumps({"probe":"UNAVAILABLE","reason":"package_validation_failed"},sort_keys=True))\n`;
  try {
    const output = execFileSync(interpreter, source ? ["-c", code] : ["-I", "-c", code], {
      cwd: source,
      env: probeEnvironment(),
      encoding: "utf8",
      input: "",
      timeout: 20_000,
      maxBuffer: 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const lines = output.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length !== 1) return { probe: "UNAVAILABLE", reason: "invalid_probe_output" };
    const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
    if (parsed.probe === "OK" && parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value)) {
      return { probe: "OK", value: parsed.value as Record<string, unknown> };
    }
    if (parsed.probe === "UNAVAILABLE" && typeof parsed.reason === "string") {
      return { probe: "UNAVAILABLE", reason: parsed.reason };
    }
    return { probe: "UNAVAILABLE", reason: "invalid_probe_output" };
  } catch {
    return { probe: "UNAVAILABLE", reason: "interpreter_failed" };
  }
}

function validDescription(value: Record<string, unknown>, expected: string): boolean {
  const reviewer = value.reviewer;
  return value.schemaVersion === 1
    && value.capability === "definition-only"
    && value.authority === false
    && value.module === EXPERT_IMPORT_NAME
    && value.packageSha256 === expected
    && reviewer !== null && typeof reviewer === "object" && !Array.isArray(reviewer)
    && (reviewer as Record<string, unknown>).name === "expert-reviewer"
    && (reviewer as Record<string, unknown>).model === OFFICIAL_EXPERT_SELECTOR
    && (reviewer as Record<string, unknown>).thinking === OFFICIAL_EXPERT_THINKING;
}

function unavailable(
  mode: "managed" | "configured" | "source",
  expectedPackageSha256: string | undefined,
  reason: string,
  interpreter?: string,
): OfficialExpertPackageStatus {
  return { schemaVersion: 1, status: "UNAVAILABLE", mode, interpreter, expectedPackageSha256, reason };
}

export function officialExpertPackageStatus(
  _ctx: ExtensionContext,
  options: ExpertReviewReservationRegistration = {},
): OfficialExpertPackageStatus {
  let expected: string;
  try { expected = expectedPackageHash(options); }
  catch (error) {
    return unavailable("source", undefined, error instanceof Error ? error.message : String(error));
  }
  const interpreter = kernelInterpreter();
  try {
    if (!statSync(interpreter.path).isFile()) return unavailable(interpreter.mode, expected, "interpreter_missing", interpreter.path);
  } catch {
    return unavailable(interpreter.mode, expected, "interpreter_missing", interpreter.path);
  }
  const installed = runProbe(interpreter.path, expected);
  if (installed.probe === "OK" && validDescription(installed.value, expected)) {
    return {
      schemaVersion: 1, status: "AVAILABLE", mode: interpreter.mode,
      interpreter: interpreter.path, expectedPackageSha256: expected, packageSha256: expected,
    };
  }
  const installedReason = installed.probe === "OK" ? "package_validation_failed" : installed.reason;
  if (interpreter.mode === "configured") return unavailable("configured", expected, installedReason, interpreter.path);
  const sourceRoot = dirname(packageDirectory(options));
  const source = runProbe(interpreter.path, expected, sourceRoot);
  if (source.probe !== "OK" || !validDescription(source.value, expected)
    || resolve(String(source.value.origin ?? "")) !== join(packageDirectory(options), "__init__.py")) {
    return unavailable("managed", expected, "source_import_failed", interpreter.path);
  }
  return {
    schemaVersion: 1, status: "SYNC_PENDING", mode: "managed",
    interpreter: interpreter.path, expectedPackageSha256: expected, installedReason,
  };
}

function defaultRepositoryIdentity(worktree: string): ExpertReviewRepositoryIdentity {
  if (!isAbsolute(worktree)) {
    throw new Error("active episode worktree is not an absolute canonical path");
  }
  const repositoryPath = realpathSync(worktree);
  if (worktree !== repositoryPath) {
    throw new Error("active episode worktree is not a canonical real path");
  }
  const root = execFileSync("git", ["-C", repositoryPath, "rev-parse", "--show-toplevel"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000,
  }).trim();
  if (root !== repositoryPath) {
    throw new Error("active episode worktree is not its exact Git repository root");
  }
  const commitOid = execFileSync("git", ["-C", repositoryPath, "rev-parse", "HEAD"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000,
  }).trim();
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(commitOid)) {
    throw new Error("active episode worktree HEAD is not an exact 40- or 64-hex OID");
  }
  return { repositoryPath, commitOid };
}

function exactOwner(ctx: ExtensionContext): {
  ownerSessionId: string;
  ownerGeneration: string;
  markerWorktree: string;
} {
  const marker = assertExactActiveConversationOwner(ctx);
  return {
    ownerSessionId: ctx.sessionManager.getSessionId(),
    ownerGeneration: digest(JSON.stringify([
      marker.markerVersion, marker.ownerSessionId, marker.slug, marker.sourceLocation,
      marker.episodeId, resolve(marker.episodeSessionFile), marker.branch,
      resolve(marker.worktree), marker.sessionName, marker.identityVersion, marker.admission,
    ])),
    markerWorktree: marker.worktree,
  };
}

function assertHex(value: unknown, length: number, label: string): string {
  if (typeof value !== "string" || !new RegExp(`^[0-9a-f]{${length}}$`).test(value)) {
    throw new Error(`${label} must be exactly ${length} lowercase hexadecimal characters`);
  }
  return value;
}

function assertCommitOid(value: unknown): string {
  if (typeof value !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value)) {
    throw new Error("commitOid must be an exact lowercase 40- or 64-hex commit OID");
  }
  return value;
}

function assertOpaque(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 256 || !/^[A-Za-z0-9._:/-]+$/.test(value)) {
    throw new Error(`${label} is malformed`);
  }
  return value;
}

function view(record: ReviewReservation, now: number): Record<string, unknown> {
  const expired = now >= record.expiresAt;
  return {
    phase: expired ? "expired" : record.phase,
    previousPhase: expired ? record.phase : undefined,
    ownerSessionId: record.ownerSessionId,
    ownerGeneration: record.ownerGeneration,
    nonce: record.nonce,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    repositoryPath: record.repositoryPath,
    commitOid: record.commitOid,
    packetDigest: record.packetDigest,
    selector: record.selector,
    thinking: record.thinking,
    packageSha256: record.packageSha256,
    ...(record.phase === "bound-pending" ? {
      boundAt: record.boundAt,
      rlmChildId: record.rlmChildId,
      childName: record.childName,
      sessionDir: record.sessionDir,
      returnedModel: record.returnedModel,
      evidence: "caller-supplied-unverified",
    } : {}),
    authority: false,
  };
}

function failure(prefix: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `${prefix}: ${message}` }],
    details: { error: message, authority: false },
    isError: true,
  };
}

export function registerOfficialExpertReviewReservation(
  pi: ExtensionAPI,
  options: ExpertReviewReservationRegistration = {},
): void {
  const reservations = new Map<string, ReviewReservation>();
  const clock = options.now ?? Date.now;
  const nonceFactory = options.nonce ?? (() => randomBytes(32).toString("base64url"));
  const packagePreflight = options.packageStatus ?? ((ctx) => officialExpertPackageStatus(ctx, options));
  const repositoryIdentity = options.repositoryIdentity ?? defaultRepositoryIdentity;

  pi.registerTool({
    name: EXPERT_REVIEW_RESERVE_TOOL,
    label: "Reserve one official EXPERT review",
    description: "Reserve one owner-scoped official EXPERT review subject without spawning a child or granting role authority.",
    promptSnippet: "Reserve one exact pushed candidate for later official EXPERT review",
    promptGuidelines: [
      "Call prime_claw_reserve_expert_review only as the exact active episode owner after managed Conversation-guide readiness is consumed.",
      "Pass the exact current commit OID, packet SHA256, official selector, and thinking level; this tool never spawns or messages a child.",
      "Treat the returned nonce as opaque correlation data, not EXPERT authority or proof of child admission.",
    ],
    executionMode: "sequential",
    parameters: {
      type: "object",
      properties: {
        commitOid: { type: "string", description: "Exact lowercase active episode worktree HEAD OID" },
        packetDigest: { type: "string", description: "Exact lowercase SHA256 digest of the immutable review packet" },
        selector: { type: "string", description: "Requested full official model selector" },
        thinking: { type: "string", description: "Requested official thinking level" },
      },
      required: ["commitOid", "packetDigest", "selector", "thinking"],
      additionalProperties: false,
    } as any,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        const { ownerSessionId, ownerGeneration, markerWorktree } = exactOwner(ctx);
        assertConversationGuideReady(ctx, { guideRoot: options.guideRoot });
        const status = packagePreflight(ctx);
        if (status.status !== "AVAILABLE" || !status.packageSha256) {
          throw new Error(`official EXPERT package is ${status.status}${status.reason ? `: ${status.reason}` : ""}`);
        }
        const commitOid = assertCommitOid(params.commitOid);
        const packetDigest = assertHex(params.packetDigest, 64, "packetDigest");
        if (!isAbsolute(markerWorktree)) {
          throw new Error("active episode marker worktree is not an absolute canonical path");
        }
        const canonicalWorktree = realpathSync(markerWorktree);
        if (markerWorktree !== canonicalWorktree) {
          throw new Error("active episode marker worktree is not a canonical real path");
        }
        const identity = repositoryIdentity(canonicalWorktree);
        if (realpathSync(identity.repositoryPath) !== canonicalWorktree) {
          throw new Error("repository identity path does not match the exact active episode worktree");
        }
        if (identity.commitOid !== commitOid) {
          throw new Error("requested commit does not match the exact active episode worktree HEAD");
        }
        if (params.selector !== OFFICIAL_EXPERT_SELECTOR || params.thinking !== OFFICIAL_EXPERT_THINKING) {
          throw new Error("requested selector or thinking does not match the official EXPERT package");
        }
        const current = reservations.get(ownerSessionId);
        const now = clock();
        if (!Number.isSafeInteger(now) || now < 0) throw new Error("reservation clock is invalid");
        if (current && current.ownerGeneration === ownerGeneration && now < current.expiresAt) {
          throw new Error("one official EXPERT review reservation is already active for this owner generation");
        }
        const nonce = nonceFactory();
        if (!/^[A-Za-z0-9_-]{32,128}$/.test(nonce)) throw new Error("reservation nonce source returned a malformed value");
        const record: ReservedReview = {
          phase: "reserved", ownerSessionId, ownerGeneration, nonce, createdAt: now,
          expiresAt: now + EXPERT_REVIEW_RESERVATION_TTL_MS,
          repositoryPath: realpathSync(identity.repositoryPath), commitOid, packetDigest,
          selector: params.selector, thinking: params.thinking, packageSha256: status.packageSha256,
        };
        reservations.set(ownerSessionId, record);
        return {
          content: [{ type: "text", text: "Official EXPERT review reserved. No child was spawned and no EXPERT authority was granted." }],
          details: view(record, now),
        };
      } catch (error) { return failure("Official EXPERT review reservation failed", error); }
    },
  });

  pi.registerTool({
    name: EXPERT_REVIEW_BIND_TOOL,
    label: "Bind pending official EXPERT spawn evidence",
    description: "Record one exact returned child handle/session/model tuple as unverified caller evidence; this does not admit an EXPERT.",
    promptSnippet: "Bind one returned child tuple to the exact official review reservation as pending evidence",
    promptGuidelines: [
      "Call prime_claw_bind_expert_review only after reserve and only with the exact returned child handle, session id, and model metadata.",
      "Caller-supplied metadata remains unverified pending evidence; never claim model, reasoning, handle, or EXPERT admission proof.",
      "This tool does not spawn, message, admit, or authorize the child.",
    ],
    executionMode: "sequential",
    parameters: {
      type: "object",
      properties: {
        nonce: { type: "string", description: "Opaque nonce returned by reserve" },
        rlmChildId: { type: "string", description: "Exact returned rlm_child_id metadata" },
        childName: { type: "string", description: "Exact returned child name metadata" },
        sessionDir: { type: "string", description: "Exact returned session_dir metadata" },
        returnedModel: { type: "string", description: "Exact returned child model metadata" },
      },
      required: ["nonce", "rlmChildId", "childName", "sessionDir", "returnedModel"],
      additionalProperties: false,
    } as any,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        const { ownerSessionId, ownerGeneration } = exactOwner(ctx);
        assertConversationGuideReady(ctx, { guideRoot: options.guideRoot });
        const status = packagePreflight(ctx);
        if (status.status !== "AVAILABLE" || !status.packageSha256) {
          throw new Error(`official EXPERT package is ${status.status}${status.reason ? `: ${status.reason}` : ""}`);
        }
        const record = reservations.get(ownerSessionId);
        if (!record) throw new Error("no official EXPERT review reservation exists for this owner");
        if (record.ownerGeneration !== ownerGeneration) {
          throw new Error("official EXPERT review reservation belongs to a different owner generation");
        }
        const now = clock();
        if (now >= record.expiresAt) throw new Error("official EXPERT review reservation has expired");
        if (record.phase !== "reserved") throw new Error("official EXPERT review reservation is already bound");
        if (status.packageSha256 !== record.packageSha256) throw new Error("official EXPERT package generation changed after reservation");
        if (params.nonce !== record.nonce) throw new Error("official EXPERT review reservation nonce mismatch");
        const rlmChildId = assertOpaque(params.rlmChildId, "rlmChildId");
        const childName = assertOpaque(params.childName, "childName");
        if (typeof params.sessionDir !== "string" || params.sessionDir.length < 2 || params.sessionDir.length > 1024
          || params.sessionDir.includes("\0") || resolve(params.sessionDir) !== params.sessionDir) {
          throw new Error("sessionDir is malformed");
        }
        if (params.returnedModel !== record.selector) throw new Error("returned model metadata does not match the reserved selector");
        const returnedModel = params.returnedModel;
        const bound: BoundReview = {
          ...record, phase: "bound-pending", boundAt: now,
          rlmChildId, childName, sessionDir: params.sessionDir, returnedModel,
        };
        reservations.set(ownerSessionId, bound);
        return {
          content: [{ type: "text", text: "Returned child metadata recorded as pending caller evidence only. The child is not admitted or verified as EXPERT." }],
          details: view(bound, now),
        };
      } catch (error) { return failure("Official EXPERT review binding failed", error); }
    },
  });

  pi.registerTool({
    name: EXPERT_REVIEW_STATUS_TOOL,
    label: "Inspect official EXPERT review reservation",
    description: "Read-only status for the exact active owner's in-memory official EXPERT review reservation.",
    promptSnippet: "Inspect the current official EXPERT review reservation without mutation",
    promptGuidelines: [
      "Use prime_claw_expert_review_status only for read-only owner-scoped reservation evidence.",
      "A bound-pending result is caller evidence only and never proves child identity, model, reasoning, handle, or EXPERT admission.",
    ],
    executionMode: "sequential",
    parameters: { type: "object", properties: {}, additionalProperties: false } as any,
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      try {
        const { ownerSessionId, ownerGeneration } = exactOwner(ctx);
        const candidate = reservations.get(ownerSessionId);
        const record = candidate?.ownerGeneration === ownerGeneration ? candidate : undefined;
        const now = clock();
        return {
          content: [{ type: "text", text: record
            ? `Official EXPERT review reservation status: ${now >= record.expiresAt ? "expired" : record.phase}. No EXPERT authority is granted.`
            : "No official EXPERT review reservation exists for this owner generation." }],
          details: record ? view(record, now) : { phase: "none", ownerSessionId, ownerGeneration, authority: false },
        };
      } catch (error) { return failure("Official EXPERT review status failed", error); }
    },
  });

  pi.registerTool({
    name: EXPERT_REVIEW_CANCEL_TOOL,
    label: "Cancel official EXPERT review reservation",
    description: "Idempotently clear the exact active owner's in-memory official EXPERT review reservation without child cleanup or role mutation.",
    promptSnippet: "Cancel the current official EXPERT review reservation only",
    promptGuidelines: [
      "Use prime_claw_cancel_expert_review only as the exact active owner to clear reservation state.",
      "Cancellation is idempotent and performs no child, message, report, cleanup, or role action.",
    ],
    executionMode: "sequential",
    parameters: { type: "object", properties: {}, additionalProperties: false } as any,
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      try {
        const { ownerSessionId, ownerGeneration } = exactOwner(ctx);
        const record = reservations.get(ownerSessionId);
        const cancelled = record?.ownerGeneration === ownerGeneration
          ? reservations.delete(ownerSessionId)
          : false;
        return {
          content: [{ type: "text", text: cancelled
            ? "Official EXPERT review reservation cancelled. No child or role state was changed."
            : "No official EXPERT review reservation existed; cancellation is already complete." }],
          details: { cancelled, phase: "none", ownerSessionId, ownerGeneration, authority: false },
        };
      } catch (error) { return failure("Official EXPERT review cancellation failed", error); }
    },
  });

  pi.on("session_start", (_event, ctx) => { reservations.delete(ctx.sessionManager.getSessionId()); });
  pi.on("session_shutdown", (_event, ctx) => { reservations.delete(ctx.sessionManager.getSessionId()); });
}
