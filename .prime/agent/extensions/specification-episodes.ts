import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TSchema } from "typebox";

/**
 * Native specification interviews plus the trusted, durable disposition bridge.
 *
 * Slice 1 deliberately stops after preflight. It records validated intent under
 * Git's local common directory but does not change checkout files, refs,
 * worktrees, sessions, or daemon state. Later slices replace the preflight-only
 * boundary with the two approved mutation transactions.
 */

const CONTEXT_TAG = "operator-specification-context";
const CONTROL_DIR = "prime-claw";
const MAX_DOCUMENT_CHARS = 2_000_000;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;
const SAFE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const SAFE_BRANCH = /^(?:feature|spec|poc)\/[a-z0-9](?:[a-z0-9._\/-]{0,125}[a-z0-9])?$/;

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

function exactKeys(value: Record<string, unknown>, allowed: string[], label: string): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length) throw new Error(`${label} contains unsupported field(s): ${unexpected.join(", ")}`);
}

function requiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || value.includes("\0")) {
    throw new Error(`${label} must be a non-empty string of at most ${maxLength} characters without NUL bytes`);
  }
  return value;
}

export function validateDispositionParams(value: unknown): DispositionParams {
  const root = object(value, "spec_disposition input");
  exactKeys(root, ["request_id", "confirmed_by_operator", "decision", "documents"], "spec_disposition input");

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
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readDurableJson(path: string): Record<string, unknown> {
  try {
    return object(JSON.parse(readFileSync(path, "utf8")), `durable receipt ${path}`);
  } catch (error) {
    throw new Error(`corrupt durable receipt at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
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
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temp = join(dirname(path), `.${randomUUID()}.tmp`);
  writeFileSync(temp, canonicalJson(value), { encoding: "utf8", flag: "wx", mode: 0o600 });
  const tempFd = openSync(temp, "r");
  try {
    fsyncSync(tempFd);
  } finally {
    closeSync(tempFd);
  }
  try {
    linkSync(temp, path);
    const directoryFd = openSync(dirname(path), "r");
    try {
      fsyncSync(directoryFd);
    } finally {
      closeSync(directoryFd);
    }
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST") return false;
    throw error;
  } finally {
    rmSync(temp, { force: true });
  }
}

async function git(
  pi: ExtensionAPI,
  cwd: string,
  args: string[],
  signal: AbortSignal | undefined,
): Promise<string> {
  if (signal?.aborted) throw new Error("spec_disposition cancelled before durable preflight");
  const result = await pi.exec("git", ["-C", cwd, ...args], { cwd, signal, timeout: 15_000 });
  if (result.killed || result.code !== 0) {
    const diagnostic = (result.stderr || result.stdout).trim();
    throw new Error(`git ${args.join(" ")} failed (${result.code}): ${diagnostic || "no diagnostic"}`);
  }
  return result.stdout.trimEnd();
}

async function executePreflight(
  pi: ExtensionAPI,
  rawParams: unknown,
  signal: AbortSignal | undefined,
  ctx: ExtensionContext,
) {
  const params = validateDispositionParams(rawParams);
  if (signal?.aborted) throw new Error("spec_disposition cancelled before durable preflight");

  const sessionId = ctx.sessionManager.getSessionId();
  if (!REQUEST_ID.test(sessionId)) {
    throw new Error("persisted Prime Agent session has an invalid stable session ID");
  }
  const sessionFile = ctx.sessionManager.getSessionFile();
  if (!sessionFile) throw new Error("spec_disposition requires a persisted Prime Agent session");
  const managerCwd = realpathSync(ctx.sessionManager.getCwd());
  const cwd = realpathSync(ctx.cwd);
  if (managerCwd !== cwd) throw new Error("session CWD does not match the extension execution root");
  const resolvedSessionFile = validateSessionFile(sessionFile, sessionId, cwd);

  const repoRoot = realpathSync((await git(pi, cwd, ["rev-parse", "--show-toplevel"], signal)).trim());
  if (repoRoot !== cwd) throw new Error("spec_disposition must run from the repository root");
  const commonDir = realpathSync((await git(
    pi,
    cwd,
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    signal,
  )).trim());
  const gitDir = realpathSync((await git(
    pi,
    cwd,
    ["rev-parse", "--path-format=absolute", "--git-dir"],
    signal,
  )).trim());
  if (gitDir !== commonDir) {
    throw new Error("spec_disposition source must be the primary canonical checkout, not a linked worktree");
  }
  const currentBranch = (await git(pi, cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"], signal)).trim();
  const upstream = (await git(
    pi,
    cwd,
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    signal,
  )).trim();
  const slash = upstream.indexOf("/");
  if (slash <= 0) throw new Error("canonical checkout upstream is not a remote-tracking branch");
  const remote = upstream.slice(0, slash);
  const defaultRemoteBranch = (await git(
    pi,
    cwd,
    ["symbolic-ref", "--quiet", "--short", `refs/remotes/${remote}/HEAD`],
    signal,
  )).trim();
  if (upstream !== defaultRemoteBranch || currentBranch !== upstream.slice(slash + 1)) {
    throw new Error(`spec_disposition source must be on configured remote default branch ${defaultRemoteBranch}`);
  }
  const status = await git(pi, cwd, ["status", "--porcelain=v1", "--untracked-files=all"], signal);
  if (params.decision.kind === "episode") {
    await git(pi, cwd, ["check-ref-format", "--branch", params.decision.branch_name!], signal);
  }
  if (signal?.aborted) throw new Error("spec_disposition cancelled before durable preflight");

  const bundleSha256 = sha256(canonicalJson(params.documents));
  const semanticIdentity = {
    version: 1,
    owner_session_id: sessionId,
    repository_root: repoRoot,
    disposition: params.decision.kind,
    slug: params.decision.slug,
    branch_name: params.decision.branch_name ?? null,
    bundle_sha256: bundleSha256,
  };
  const payloadFingerprint = sha256(canonicalJson(semanticIdentity));
  const dispositionId = `disp-${payloadFingerprint.slice(0, 32)}`;
  const requestKey = sha256(canonicalJson({ owner_session_id: sessionId, request_id: params.request_id }));
  const controlRoot = join(commonDir, CONTROL_DIR);
  const requestPath = join(controlRoot, "disposition-requests", `${requestKey}.json`);
  const receiptPath = join(controlRoot, "dispositions", `${dispositionId}.json`);

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
    ) {
      throw new Error(`request_id collision: ${params.request_id} is already bound to different disposition input`);
    }
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
    repository_root: repoRoot,
    git_common_dir: commonDir,
    current_branch: currentBranch,
    upstream_branch: upstream,
    remote_default_branch: defaultRemoteBranch,
    checkout_clean: status.length === 0,
    product_resource_mutation_performed: false,
    control_state_kind: "local-git-common-dir-receipt",
    implementation_boundary: "slice-1-preflight-only",
  };
  const receiptCreated = createDurableJson(receiptPath, receipt);
  let durableReceipt: Record<string, unknown> = receipt;
  if (!receiptCreated) {
    const existing = readDurableJson(receiptPath);
    const immutableKeys = [
      "version", "disposition_id", "payload_fingerprint", "status", "phase",
      "disposition", "slug", "branch_name", "bundle_sha256",
      "owner_session_id", "owner_session_file", "repository_root",
      "git_common_dir", "product_resource_mutation_performed",
      "control_state_kind", "implementation_boundary",
    ];
    if (immutableKeys.some((key) => existing[key] !== receipt[key])) {
      throw new Error(`disposition collision: durable receipt ${dispositionId} does not match validated input`);
    }
    durableReceipt = existing;
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
    description: "Validate an explicitly confirmed future or episode disposition and persist a non-mutating durable preflight receipt. Call exactly once after the specification interview is complete.",
    parameters: dispositionParameters as unknown as TSchema,
    executionMode: "sequential",
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const details = await executePreflight(pi, params, signal, ctx);
      return {
        content: [{
          type: "text",
          text: `Specification disposition preflight is ready. No product resource, checkout, Git ref/worktree, remote, daemon, or session mutation was performed. Local control-state receipt writes are listed below.\n${JSON.stringify(details, null, 2)}`,
        }],
        details,
      };
    },
  });
}
