import { createHash } from "node:crypto";
import { accessSync, constants, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  PRIME_CLAW_ROLE_KERNEL_END,
  PRIME_CLAW_ROLE_KERNEL_SENTINEL,
  PRIME_CLAW_ROLE_KERNEL_SHA256,
  PRIME_CLAW_ROLE_KERNEL_START,
  PRIME_CLAW_ROLE_KERNEL_TEXT,
} from "./role-kernel.generated.ts";
import {
  PRIME_CLAW_CONVERSATION_GUIDE_NAME,
  PRIME_CLAW_CONVERSATION_GUIDE_SENTINEL,
  PRIME_CLAW_CONVERSATION_GUIDE_SHA256,
  PRIME_CLAW_CONVERSATION_GUIDE_VERSION,
} from "./conversation-guide-metadata.ts";
import {
  episodeBootstrapReady,
  parseEpisodeIdentity,
  type EpisodeIdentity,
  type EpisodeResult,
} from "./spec-episode.ts";

// Compatibility exports for the existing deterministic lifecycle surfaces.
// The authority is the generated neutral role kernel, not the legacy APPEND body.
export const IDENTITY_KERNEL = PRIME_CLAW_ROLE_KERNEL_SENTINEL;
export const IDENTITY_BLOCK_START = PRIME_CLAW_ROLE_KERNEL_START;
export const IDENTITY_BLOCK_END = PRIME_CLAW_ROLE_KERNEL_END;
export const EXPECTED_IDENTITY_KERNEL_BLOCK = PRIME_CLAW_ROLE_KERNEL_TEXT;
export const OVERSIGHT_MARKER_TYPE = "prime-claw-conversation-oversight";
export const BOUNDED_IDENTITY_TYPE = "prime-claw-bounded-identity";
export const LEGACY_OVERSIGHT_PACKAGE_TYPE = "prime-claw-oversee-episode-package";
export const BOUNDED_PACKAGE_TYPE = "prime-claw-bounded-identity-package";
const MARKER_VERSION = 2;

export type OversightMarker = {
  markerVersion: 2;
  status: "active" | "inactive";
  ownerSessionId: string;
  slug: string;
  sourceLocation: string;
  episodeId: string;
  episodeSessionFile: string;
  branch: string;
  worktree: string;
  sessionName: string;
  identityVersion: 1 | 2;
  admission: string;
};

export const CONVERSATION_GUIDE_ACTIVATION_TOOL = "prime_claw_activate_conversation_guide";
export const CONVERSATION_GUIDE_STATUS_TOOL = "prime_claw_conversation_guide_status";

export type ProspectiveConversationPreparation = {
  location: string;
  lifecycle: string;
};

export type ConversationOversightRegistration = {
  guideRoot?: string;
  currentProspectivePreparation?: (
    ctx: ExtensionContext,
  ) => ProspectiveConversationPreparation | null;
};

type GuideReceipt = {
  status: "issued" | "consumed";
  toolCallId: string;
  sessionId: string;
  subjectKind: "active" | "prospective";
  sourceLocation?: string;
  preparationLifecycle?: string;
  lifecycleFingerprint: string;
  guidePath: string;
  version: number;
  sha256: string;
  resultText: string;
};

const guideReceipts = new Map<string, GuideReceipt>();

function visibleFailure(ctx: ExtensionContext, message: string): never {
  const full = `prime-claw conversation blocked: ${message}`;
  ctx.ui.notify(full, "error");
  ctx.abort();
  throw new Error(full);
}

function literalCount(value: string, token: string): number {
  return value.split(token).length - 1;
}

export function assertIdentityKernel(ctx: ExtensionContext): void {
  const prompt = ctx.getSystemPrompt();
  const startCount = literalCount(prompt, IDENTITY_BLOCK_START);
  const endCount = literalCount(prompt, IDENTITY_BLOCK_END);
  const sentinelCount = literalCount(prompt, IDENTITY_KERNEL);
  const markerLikeCount = (prompt.match(/prime-claw:role-kernel/gi) ?? []).length;
  const sentinelLikeCount = (prompt.match(/PRIME_CLAW_ROLE_KERNEL_[A-Z0-9_-]*/g) ?? []).length;
  const start = prompt.indexOf(IDENTITY_BLOCK_START);
  const end = prompt.indexOf(IDENTITY_BLOCK_END);
  const exact = start >= 0 && end > start
    ? prompt.slice(start, end + IDENTITY_BLOCK_END.length)
    : "";
  if (startCount !== 1 || endCount !== 1 || sentinelCount !== 1
    || markerLikeCount !== 2 || sentinelLikeCount !== 1
    || exact !== EXPECTED_IDENTITY_KERNEL_BLOCK) {
    throw new Error(
      `expected exactly one exact managed role kernel; found start=${startCount}, end=${endCount}, sentinel=${sentinelCount}`,
    );
  }
}

function canonicalProjectRoot(cwd: string): string {
  try { return realpathSync(cwd); }
  catch (error) { throw new Error(`project root is unavailable: ${error instanceof Error ? error.message : String(error)}`); }
}
function stateRoot(cwd: string): string { return resolve(canonicalProjectRoot(cwd), ".prime", "agent", "state", "spec-episodes"); }
function expectedWorktree(cwd: string, slug: string): string {
  const root = canonicalProjectRoot(cwd);
  return resolve(dirname(root), `${basename(root)}-${slug}-episode`);
}
function validateProjectBinding(identity: EpisodeIdentity, cwd: string): EpisodeIdentity {
  if (resolve(identity.worktree) !== expectedWorktree(cwd, identity.slug)) throw new Error("episode identity worktree binding is invalid");
  return identity;
}
function ownerExpectations(ctx: ExtensionContext): EpisodeIdentity[] {
  const root = stateRoot(ctx.cwd);
  if (!existsSync(root)) return [];
  const values: EpisodeIdentity[] = [];
  for (const name of readdirSync(root)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(name)) continue;
    const path = join(root, name);
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`episode identity path is not a regular file: ${path}`);
    let raw: unknown;
    try { raw = JSON.parse(readFileSync(path, "utf8")); }
    catch (error) { throw new Error(`episode identity is unreadable: ${path}: ${String(error)}`); }
    if (raw && typeof raw === "object" && !Array.isArray(raw)
      && typeof (raw as { ownerSessionId?: unknown }).ownerSessionId === "string"
      && (raw as { ownerSessionId: string }).ownerSessionId.length > 0
      && (raw as { ownerSessionId: string }).ownerSessionId !== ctx.sessionManager.getSessionId()) continue;
    const identity = validateProjectBinding(parseEpisodeIdentity(raw, path), ctx.cwd);
    if (`${identity.slug}.json` !== name) throw new Error(`episode identity filename/slug mismatch: ${path}`);
    values.push(identity);
  }
  if (values.length > 1) throw new Error("conversation owns more than one durable episode expectation");
  return values;
}

function markerFromIdentity(identity: EpisodeIdentity, status: "active" | "inactive"): OversightMarker {
  return {
    markerVersion: MARKER_VERSION, status,
    ownerSessionId: identity.ownerSessionId, slug: identity.slug,
    sourceLocation: identity.sourceLocation, episodeId: identity.episodeId,
    episodeSessionFile: identity.episodeSessionFile, branch: identity.branch,
    worktree: identity.worktree, sessionName: identity.sessionName,
    identityVersion: identity.version,
    admission: identity.version === 1 ? identity.executeAdmission : identity.bootstrapAdmission,
  };
}
type LegacyMarker = { version: 1; status: "active" | "inactive"; ownerSessionId: string; sourceLocation: string; slug: string; episodeId: string; episodeSessionFile: string };
type MarkerRecord = { marker?: OversightMarker; legacy?: LegacyMarker };
function parseMarker(data: unknown): OversightMarker {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("oversight marker is corrupt");
  const item = data as Record<string, unknown>;
  const fields = ["ownerSessionId","slug","sourceLocation","episodeId","episodeSessionFile","branch","worktree","sessionName","admission"];
  const slug = typeof item.slug === "string" ? item.slug : "";
  if (item.markerVersion !== MARKER_VERSION || (item.status !== "active" && item.status !== "inactive")
    || (item.identityVersion !== 1 && item.identityVersion !== 2)
    || !fields.every((field) => typeof item[field] === "string" && item[field])
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    || item.sourceLocation !== `.ralph/plans/future/${slug}`
    || item.branch !== `episode/${slug}` || item.sessionName !== `${slug}-episode`) throw new Error("oversight marker is corrupt");
  return item as unknown as OversightMarker;
}
function parseLegacyMarker(data: unknown): LegacyMarker {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("legacy oversight marker is corrupt");
  const item = data as Record<string, unknown>;
  const fields = ["ownerSessionId","slug","sourceLocation","episodeId","episodeSessionFile"];
  const slug = typeof item.slug === "string" ? item.slug : "";
  if (item.version !== 1 || (item.status !== "active" && item.status !== "inactive")
    || !fields.every((field) => typeof item[field] === "string" && item[field])
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    || item.sourceLocation !== `.ralph/plans/future/${slug}`) throw new Error("legacy oversight marker is corrupt");
  return item as unknown as LegacyMarker;
}
function markerRecords(ctx: ExtensionContext): MarkerRecord[] {
  const sessionId = ctx.sessionManager.getSessionId();
  const entries = ctx.sessionManager.getBranch() as Array<{type?:string;customType?:string;data?:unknown}>;
  const seen = new Set<string>(); const result: MarkerRecord[] = [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.type !== "custom" || entry.customType !== OVERSIGHT_MARKER_TYPE) continue;
    const raw = entry.data as Record<string, unknown> | undefined;
    const owner = raw?.ownerSessionId;
    if (typeof owner !== "string" || !owner) throw new Error("oversight marker owner is unclassifiable");
    if (owner !== sessionId) continue; // only a positively identified foreign owner is inert
    const key = `${String(raw?.slug ?? "")}\0${String(raw?.episodeId ?? "")}`;
    if (seen.has(key)) continue; seen.add(key);
    if (raw?.markerVersion === MARKER_VERSION) result.push({ marker: parseMarker(raw) });
    else result.push({ legacy: parseLegacyMarker(raw) });
  }
  return result;
}
function markerForIdentity(ctx: ExtensionContext, identity: EpisodeIdentity): MarkerRecord | null {
  const sessionId = ctx.sessionManager.getSessionId();
  const entries = ctx.sessionManager.getBranch() as Array<{type?:string;customType?:string;data?:unknown}>;
  for (const entry of entries) {
    if (entry.type !== "custom" || entry.customType !== OVERSIGHT_MARKER_TYPE) continue;
    const raw = entry.data as Record<string, unknown> | undefined;
    if ((raw?.slug === identity.slug || raw?.episodeId === identity.episodeId) && raw?.ownerSessionId !== sessionId) {
      throw new Error("oversight marker owner disagrees with the exact expectation");
    }
  }
  return markerRecords(ctx).find((record) => {
    const value = record.marker ?? record.legacy;
    return value?.slug === identity.slug && value.episodeId === identity.episodeId;
  }) ?? null;
}
function markerForLocation(ctx: ExtensionContext, sourceLocation: string): MarkerRecord | null {
  const matches = markerRecords(ctx).filter((record) => (record.marker ?? record.legacy)?.sourceLocation === sourceLocation);
  if (matches.length > 1) throw new Error("multiple oversight generations share one future-folder location");
  return matches[0] ?? null;
}
type StableOversightBindings = {
  ownerSessionId: string;
  slug: string;
  sourceLocation: string;
  episodeId: string;
  episodeSessionFile: string;
  branch: string;
  worktree: string;
  sessionName: string;
  identityVersion: 1 | 2;
  admission: string;
};
const STABLE_BINDING_KEYS = [
  "ownerSessionId", "slug", "sourceLocation", "episodeId", "episodeSessionFile",
  "branch", "worktree", "sessionName", "identityVersion", "admission",
] as const satisfies ReadonlyArray<keyof StableOversightBindings>;
function stableBindingsFromIdentity(identity: EpisodeIdentity): StableOversightBindings {
  return {
    ownerSessionId: identity.ownerSessionId, slug: identity.slug,
    sourceLocation: identity.sourceLocation, episodeId: identity.episodeId,
    episodeSessionFile: identity.episodeSessionFile, branch: identity.branch,
    worktree: identity.worktree, sessionName: identity.sessionName,
    identityVersion: identity.version,
    admission: identity.version === 1 ? identity.executeAdmission : identity.bootstrapAdmission,
  };
}
function stableBindingsFromMarker(marker: OversightMarker): StableOversightBindings {
  return marker;
}
function stableBindingValue(key: keyof StableOversightBindings, value: string | number): string | number {
  return key === "episodeSessionFile" || key === "worktree" ? resolve(String(value)) : value;
}
function assertStableBindingAgreement(
  left: StableOversightBindings,
  right: StableOversightBindings,
  disagreement: (key: keyof StableOversightBindings) => string,
): void {
  for (const key of STABLE_BINDING_KEYS) {
    if (stableBindingValue(key, left[key]) !== stableBindingValue(key, right[key])) {
      throw new Error(disagreement(key));
    }
  }
}
function assertAgreement(marker: OversightMarker, identity: EpisodeIdentity): void {
  assertStableBindingAgreement(
    stableBindingsFromMarker(marker), stableBindingsFromIdentity(identity),
    (key) => `oversight marker disagrees on ${key}`,
  );
}
function assertLegacyAgreement(marker: LegacyMarker, identity: EpisodeIdentity): void {
  if (marker.status !== "active" || marker.ownerSessionId !== identity.ownerSessionId
    || marker.slug !== identity.slug || marker.sourceLocation !== identity.sourceLocation
    || marker.episodeId !== identity.episodeId
    || stableBindingValue("episodeSessionFile", marker.episodeSessionFile)
      !== stableBindingValue("episodeSessionFile", identity.episodeSessionFile)) {
    throw new Error("legacy oversight marker disagrees with the exact durable expectation");
  }
}

export function assertConversationPromotionReady(ctx: ExtensionContext, requestedLocation?: string): void {
  assertIdentityKernel(ctx);
  const root = stateRoot(ctx.cwd); mkdirSync(root, { recursive: true }); accessSync(root, constants.R_OK | constants.W_OK);
  const state = classifyLifecycle(ctx);
  if (state.mode === "ordinary") {
    if (requestedLocation && markerForLocation(ctx, requestedLocation)) {
      throw new Error("closed episode location cannot be reused; select a fresh future folder");
    }
    return;
  }
  if (state.mode === "active" && requestedLocation
    && state.expectation?.sourceLocation === requestedLocation) return;
  if (state.mode === "active") throw new Error(`conversation already owns active expectation ${state.expectation?.sourceLocation}`);
  throw new Error(`oversight lifecycle requires ${state.mode} reconciliation before promotion`);
}

function currentBoundedIdentity(ctx: ExtensionContext): { role: "EPISODE"; sessionId: string } | null {
  const sessionId = ctx.sessionManager.getSessionId();
  for (const entry of (ctx.sessionManager.getBranch() as Array<{type?:string;customType?:string;data?:unknown}>).slice().reverse()) {
    if (entry.type !== "custom" || entry.customType !== BOUNDED_IDENTITY_TYPE) continue;
    const data = entry.data as {version?:unknown;role?:unknown;sessionId?:unknown} | undefined;
    if (data?.sessionId !== sessionId) continue;
    if (data.version !== 1 || data.role !== "EPISODE") throw new Error("exact-session bounded identity is corrupt");
    return data as {role:"EPISODE";sessionId:string};
  }
  return null;
}

export function appendActiveOversight(pi: ExtensionAPI, ctx: ExtensionContext, episode: EpisodeResult): OversightMarker {
  assertIdentityKernel(ctx);
  const root = stateRoot(ctx.cwd); mkdirSync(root, { recursive: true }); accessSync(root, constants.R_OK | constants.W_OK);
  const identity = validateProjectBinding(parseEpisodeIdentity(episode, "created episode result"), ctx.cwd);
  if (!episodeBootstrapReady(identity)) throw new Error("created episode expectation is not bootstrap-ready");
  if (identity.ownerSessionId !== ctx.sessionManager.getSessionId()) throw new Error("created episode owner mismatch");
  const expectation = ownerExpectations(ctx).find((value) => sameGeneration(value, identity));
  if (!expectation) throw new Error("created episode expectation was not persisted");
  const state = classifyLifecycle(ctx);
  if (state.mode === "active" && state.marker && sameGeneration(state.marker, expectation)) return state.marker;
  if (state.mode !== "recovery" || state.recovery?.kind !== "expectation-marker"
    || !sameGeneration(state.recovery.identity, expectation)) {
    throw new Error("created episode expectation is not the sole recoverable lifecycle generation");
  }
  const marker = markerFromIdentity(expectation, "active");
  pi.appendEntry(OVERSIGHT_MARKER_TYPE, marker);
  const persisted = classifyLifecycle(ctx);
  if (persisted.mode !== "active" || !persisted.marker || !sameGeneration(persisted.marker, expectation)) {
    throw new Error("active oversight marker did not persist");
  }
  return persisted.marker;
}
export function appendInactiveOversight(pi: ExtensionAPI, marker: OversightMarker): void {
  pi.appendEntry(OVERSIGHT_MARKER_TYPE, { ...marker, status: "inactive" } satisfies OversightMarker);
}
export function appendEpisodeIdentity(session: {appendCustomEntry(customType:string,data:unknown):unknown;getSessionId():string}): void {
  session.appendCustomEntry(BOUNDED_IDENTITY_TYPE, {version:1,role:"EPISODE",sessionId:session.getSessionId()});
}

type LifecycleRecovery =
  | { kind: "expectation-marker"; identity: EpisodeIdentity }
  | { kind: "legacy-marker"; identity: EpisodeIdentity };

type LifecycleClassification = {
  mode: "ordinary" | "active" | "recovery";
  expectation: EpisodeIdentity | null;
  marker: OversightMarker | null;
  recovery: LifecycleRecovery | null;
};

function sameGeneration(left: { slug: string; episodeId: string }, right: { slug: string; episodeId: string }): boolean {
  return left.slug === right.slug && left.episodeId === right.episodeId;
}

function classifyLifecycle(ctx: ExtensionContext): LifecycleClassification {
  const expectation = ownerExpectations(ctx)[0] ?? null;
  const records = markerRecords(ctx);
  const recordFor = (value: { slug: string; episodeId: string }) => records.find((record) => {
    const marker = record.marker ?? record.legacy!;
    return sameGeneration(marker, value);
  }) ?? null;

  if (expectation && !episodeBootstrapReady(expectation)) throw new Error("owner episode expectation is not bootstrap-ready");

  if (expectation) {
    const current = recordFor(expectation);
    for (const record of records) {
      const value = record.marker ?? record.legacy!;
      if (sameGeneration(value, expectation)) continue;
      if (value.sourceLocation === expectation.sourceLocation) {
        throw new Error("multiple oversight generations share one future-folder location");
      }
      if (value.status === "active") throw new Error("older active oversight marker conflicts with current episode expectation");
    }
    if (!current) {
      return { mode: "recovery", expectation, marker: null, recovery: { kind: "expectation-marker", identity: expectation } };
    }
    if (current.legacy) {
      assertLegacyAgreement(current.legacy, expectation);
      return { mode: "recovery", expectation, marker: null, recovery: { kind: "legacy-marker", identity: expectation } };
    }
    assertAgreement(current.marker!, expectation);
    // An inactive marker with the exact identity still present is a retryable
    // bookkeeping-close boundary, not a startup recovery state.
    return { mode: "active", expectation, marker: current.marker!, recovery: null };
  }

  for (const record of records) {
    const marker = record.marker ?? record.legacy!;
    if (marker.status === "active") throw new Error("orphan active oversight marker has no exact durable expectation");
  }
  return { mode: "ordinary", expectation: null, marker: null, recovery: null };
}

function pluginRoot(options: ConversationOversightRegistration): string {
  return resolve(options.guideRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
}

function guidePath(options: ConversationOversightRegistration): string {
  return join(pluginRoot(options), "skills", PRIME_CLAW_CONVERSATION_GUIDE_NAME, "SKILL.md");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function assertNoProjectGuideCollision(ctx: ExtensionContext): void {
  for (const relative of [
    join(".agents", "skills", PRIME_CLAW_CONVERSATION_GUIDE_NAME),
    join(".ralph", "skills", PRIME_CLAW_CONVERSATION_GUIDE_NAME),
  ]) {
    const candidate = resolve(ctx.cwd, relative);
    try {
      lstatSync(candidate);
      throw new Error(`project Conversation guide collision: ${candidate}`);
    } catch (error) {
      if ((error as { code?: unknown }).code !== "ENOENT") throw error;
    }
  }
}

function readExactConversationGuide(
  ctx: ExtensionContext,
  options: ConversationOversightRegistration,
): { path: string; text: string } {
  assertNoProjectGuideCollision(ctx);
  const path = guidePath(options);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`managed Conversation guide is not a regular file: ${path}`);
  if (realpathSync(path) !== path) throw new Error(`managed Conversation guide path is not canonical: ${path}`);
  const text = readFileSync(path, "utf8");
  if (sha256(text) !== PRIME_CLAW_CONVERSATION_GUIDE_SHA256) {
    throw new Error(`managed Conversation guide hash mismatch: ${path}`);
  }
  return { path, text };
}

type ConversationGuideSubject = {
  kind: "active" | "prospective";
  fingerprint: string;
  sourceLocation?: string;
  preparationLifecycle?: string;
};

function currentConversationGuideSubject(
  ctx: ExtensionContext,
  options: ConversationOversightRegistration,
): ConversationGuideSubject {
  if (currentBoundedIdentity(ctx)) throw new Error("EPISODE cannot activate Conversation guidance");
  const state = classifyLifecycle(ctx);
  if (state.mode === "active") {
    if (!state.marker || state.marker.status !== "active") {
      throw new Error("managed Conversation guidance requires one exact active owner episode");
    }
    assertIdentityKernel(ctx);
    const marker = state.marker;
    return {
      kind: "active",
      fingerprint: sha256(JSON.stringify([
        "active", ctx.sessionManager.getSessionId(), marker.ownerSessionId,
        marker.slug, marker.sourceLocation, marker.episodeId,
        marker.episodeSessionFile, marker.branch, marker.worktree,
        marker.sessionName, marker.identityVersion, marker.admission,
        PRIME_CLAW_ROLE_KERNEL_SHA256,
      ])),
    };
  }
  if (state.mode !== "ordinary") {
    throw new Error(`oversight lifecycle requires ${state.mode} reconciliation before guide activation`);
  }
  if ((ctx.sessionManager.getHeader().rlmDepth ?? 0) !== 0) {
    throw new Error("prospective Conversation guidance is available only from a top-level project conversation");
  }
  const preparation = options.currentProspectivePreparation?.(ctx) ?? null;
  if (!preparation) {
    throw new Error("managed Conversation guidance requires one exact active owner episode or current /implement-spec preparation");
  }
  if (!/^\.ralph\/plans\/future\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(preparation.location)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(preparation.lifecycle)) {
    throw new Error("current /implement-spec preparation is corrupt");
  }
  assertIdentityKernel(ctx);
  return {
    kind: "prospective",
    sourceLocation: preparation.location,
    preparationLifecycle: preparation.lifecycle,
    fingerprint: sha256(JSON.stringify([
      "prospective", ctx.sessionManager.getSessionId(), preparation.location,
      preparation.lifecycle, PRIME_CLAW_ROLE_KERNEL_SHA256,
    ])),
  };
}

function receiptMatchesSubject(receipt: GuideReceipt, subject: ConversationGuideSubject): boolean {
  return receipt.subjectKind === subject.kind
    && receipt.lifecycleFingerprint === subject.fingerprint
    && receipt.sourceLocation === subject.sourceLocation
    && receipt.preparationLifecycle === subject.preparationLifecycle;
}

function expectedGuideResult(text: string): string {
  return `${PRIME_CLAW_CONVERSATION_GUIDE_SENTINEL}\nversion=${PRIME_CLAW_CONVERSATION_GUIDE_VERSION}\nsha256=${PRIME_CLAW_CONVERSATION_GUIDE_SHA256}\n\n${text}`;
}

function currentGuideReceipt(
  ctx: ExtensionContext,
  options: ConversationOversightRegistration,
): GuideReceipt {
  const sessionId = ctx.sessionManager.getSessionId();
  const receipt = guideReceipts.get(sessionId);
  if (!receipt || receipt.status !== "consumed") throw new Error("managed Conversation guide has not been activated and consumed");
  const guide = readExactConversationGuide(ctx, options);
  let subject: ConversationGuideSubject;
  try { subject = currentConversationGuideSubject(ctx, options); }
  catch (error) { guideReceipts.delete(sessionId); throw error; }
  if (receipt.sessionId !== sessionId || !receiptMatchesSubject(receipt, subject)
    || receipt.guidePath !== guide.path || receipt.version !== PRIME_CLAW_CONVERSATION_GUIDE_VERSION
    || receipt.sha256 !== PRIME_CLAW_CONVERSATION_GUIDE_SHA256
    || receipt.resultText !== expectedGuideResult(guide.text)) {
    guideReceipts.delete(sessionId);
    throw new Error("managed Conversation guide receipt is stale or mismatched");
  }
  return receipt;
}

export class ConversationGuideReadinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationGuideReadinessError";
  }
}

export function assertConversationGuideReady(
  ctx: ExtensionContext,
  options: ConversationOversightRegistration = {},
): void {
  try { currentGuideReceipt(ctx, options); }
  catch (error) {
    throw new ConversationGuideReadinessError(error instanceof Error ? error.message : String(error));
  }
}

export function assertProspectiveConversationGuideReady(
  ctx: ExtensionContext,
  sourceLocation: string,
  preparationLifecycle: string,
  options: ConversationOversightRegistration = {},
): void {
  try {
    const receipt = currentGuideReceipt(ctx, options);
    if (receipt.subjectKind !== "prospective"
      || receipt.sourceLocation !== sourceLocation
      || receipt.preparationLifecycle !== preparationLifecycle) {
      throw new Error("managed Conversation guide receipt is not bound to the current prospective preparation");
    }
  } catch (error) {
    throw new ConversationGuideReadinessError(error instanceof Error ? error.message : String(error));
  }
}

function textContent(message: Record<string, unknown>): string {
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((item) => item && typeof item === "object"
    && (item as { type?: unknown }).type === "text"
    && typeof (item as { text?: unknown }).text === "string"
    ? (item as { text: string }).text : "").join("\n");
}

function filterGuideMessages(
  rawMessages: unknown[],
  allowedToolResult: Record<string, unknown> | null,
  exactGuideText?: string,
): Array<Record<string, unknown>> {
  const messages = rawMessages as Array<Record<string, unknown>>;
  const guideResultIds = new Set(messages.flatMap((message) => {
    if (message.role !== "toolResult") return [];
    const text = textContent(message);
    return message.toolName === CONVERSATION_GUIDE_ACTIVATION_TOOL
      || text.includes(PRIME_CLAW_CONVERSATION_GUIDE_SENTINEL)
      ? [String(message.toolCallId ?? "")] : [];
  }));
  return messages.map((message) => {
    if (message.role === "toolResult") {
      const id = String(message.toolCallId ?? "");
      if (guideResultIds.has(id) && message !== allowedToolResult) {
        const { details: _details, ...publicMessage } = message;
        return {
          ...publicMessage,
          content: [{ type: "text", text: "Managed Conversation guide disclosure omitted after its single authorized continuation." }],
        };
      }
      return message;
    }
    const visibleText = textContent(message);
    if (visibleText.includes(PRIME_CLAW_CONVERSATION_GUIDE_SENTINEL)
      || (exactGuideText && visibleText.includes(exactGuideText))) {
      return {
        ...message,
        content: typeof message.content === "string"
          ? "[managed Conversation guide disclosure omitted]"
          : [{ type: "text", text: "[managed Conversation guide disclosure omitted]" }],
      };
    }
    return message;
  });
}

function applyGuideDisclosure(
  messages: unknown[],
  ctx: ExtensionContext,
  options: ConversationOversightRegistration,
): Array<Record<string, unknown>> {
  const sessionId = ctx.sessionManager.getSessionId();
  const receipt = guideReceipts.get(sessionId);
  if (!receipt || receipt.status === "consumed") {
    let exactGuideText: string | undefined;
    try { exactGuideText = readExactConversationGuide(ctx, options).text; }
    catch { /* readiness gates report missing/colliding guide; context still removes the public sentinel */ }
    return filterGuideMessages(messages, null, exactGuideText);
  }
  const guide = readExactConversationGuide(ctx, options);
  const subject = currentConversationGuideSubject(ctx, options);
  if (receipt.sessionId !== sessionId || !receiptMatchesSubject(receipt, subject)
    || receipt.guidePath !== guide.path || receipt.version !== PRIME_CLAW_CONVERSATION_GUIDE_VERSION
    || receipt.sha256 !== PRIME_CLAW_CONVERSATION_GUIDE_SHA256) {
    guideReceipts.delete(sessionId);
    throw new Error("issued Conversation guide receipt is stale or mismatched");
  }
  const allMessages = messages as Array<Record<string, unknown>>;
  const results = allMessages.filter((message) =>
    message.role === "toolResult" && message.toolCallId === receipt.toolCallId);
  const calls = allMessages.flatMap((message) =>
    message.role === "assistant" && Array.isArray(message.content)
      ? message.content.filter((item) => item && typeof item === "object"
        && (item as { type?: unknown }).type === "toolCall"
        && (item as { id?: unknown }).id === receipt.toolCallId)
      : []);
  const result = results[0];
  const call = calls[0] as { name?: unknown } | undefined;
  const details = result?.details;
  const exactDetails = details && typeof details === "object" && !Array.isArray(details)
    ? details as Record<string, unknown> : null;
  if (results.length !== 1 || calls.length !== 1
    || result.toolName !== CONVERSATION_GUIDE_ACTIVATION_TOOL
    || call?.name !== CONVERSATION_GUIDE_ACTIVATION_TOOL
    || textContent(result) !== receipt.resultText
    || !exactDetails || Object.keys(exactDetails).length !== 2
    || exactDetails.version !== PRIME_CLAW_CONVERSATION_GUIDE_VERSION
    || exactDetails.sha256 !== PRIME_CLAW_CONVERSATION_GUIDE_SHA256) {
    guideReceipts.delete(sessionId);
    throw new Error("issued Conversation guide tool call/result pair is missing or malformed");
  }
  guideReceipts.set(sessionId, { ...receipt, status: "consumed" });
  return filterGuideMessages(messages, result, guide.text);
}

export async function reconcileOversightAtSessionStart(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  _options: ConversationOversightRegistration = {},
): Promise<void> {
  try {
    let state = classifyLifecycle(ctx);
    if (state.mode !== "ordinary" || currentBoundedIdentity(ctx)) {
      assertIdentityKernel(ctx);
    }
    if (state.mode === "recovery") {
      const recovery = state.recovery!;
      pi.appendEntry(OVERSIGHT_MARKER_TYPE, markerFromIdentity(recovery.identity, "active"));
      const message = recovery.kind === "legacy-marker"
        ? `Migrated legacy oversight for ${recovery.identity.sourceLocation} to the exact v2 marker.`
        : `Recovered active oversight for ${recovery.identity.sourceLocation} from the exact durable episode expectation.`;
      ctx.ui.notify(message, "warning");
      void pi.sendMessage({ customType: "prime-claw-oversight-recovery", content: message, display: true });
      state = classifyLifecycle(ctx);
    }
    if (state.mode === "recovery") throw new Error("oversight recovery did not converge");
  } catch (error) {
    ctx.ui.notify(`prime-claw oversight recovery blocked: ${error instanceof Error ? error.message : String(error)}`, "error");
  }
}

export function applyConversationContext(
  event: { messages: unknown[] },
  ctx: ExtensionContext,
  options: ConversationOversightRegistration = {},
) {
  const historical = (event.messages as Array<Record<string,unknown>>).filter((message) => !(message.role === "custom"
    && (message.customType === LEGACY_OVERSIGHT_PACKAGE_TYPE
      || message.customType === BOUNDED_PACKAGE_TYPE
      || message.customType === BOUNDED_IDENTITY_TYPE)));
  try {
    const messages = applyGuideDisclosure(historical, ctx, options);
    const bounded = currentBoundedIdentity(ctx);
    if (bounded) { assertIdentityKernel(ctx); return { messages }; }
    const state = classifyLifecycle(ctx);
    if (state.mode === "ordinary") return { messages };
    if (state.mode === "recovery") throw new Error(`oversight lifecycle requires ${state.recovery!.kind} recovery before provider dispatch`);
    assertIdentityKernel(ctx);
    return { messages };
  } catch (error) { visibleFailure(ctx, error instanceof Error ? error.message : String(error)); }
}
export function currentOversightMarker(ctx: ExtensionContext): OversightMarker | null {
  const state = classifyLifecycle(ctx);
  return state.mode === "active" ? state.marker : null;
}
export function currentOversightMarkerForClose(ctx: ExtensionContext, sourceLocation: string): OversightMarker | null {
  const locationMarker = markerForLocation(ctx, sourceLocation)?.marker ?? null;
  const state = classifyLifecycle(ctx);
  if (state.mode === "active") {
    if (state.expectation?.sourceLocation === sourceLocation) return locationMarker;
    return locationMarker?.status === "inactive" ? locationMarker : null;
  }
  if (state.mode !== "ordinary") return null;
  return locationMarker;
}
export function registerConversationOversight(pi: ExtensionAPI, options: ConversationOversightRegistration = {}): void {
  pi.registerTool({
    name: CONVERSATION_GUIDE_ACTIVATION_TOOL,
    label: "Activate managed Conversation guide",
    description: "Disclose the exact managed Prime Claw Conversation guide once for the current trusted active owner episode or current prospective /implement-spec preparation.",
    promptSnippet: "Activate the managed Conversation guide before episode creation or an owner lifecycle decision",
    promptGuidelines: [
      "Call prime_claw_activate_conversation_guide only as the exact trusted owner of one active episode or after the current /implement-spec readiness review accepts its exact selected future folder.",
      "For prospective creation, call it once before create_spec_episode; the returned guide applies after successful creation and the native gate privately binds it to the current preparation.",
      "Treat the returned guide as judgment guidance only; it grants no product, scope, merge, abandonment, cleanup, or transport authority.",
      "After the guide continuation, use prime_claw_conversation_guide_status when a read-only readiness proof is needed; never copy or replay the guide text.",
    ],
    executionMode: "sequential",
    parameters: { type: "object", properties: {}, additionalProperties: false } as any,
    async execute(toolCallId, _params, _signal, _onUpdate, ctx) {
      try {
        const sessionId = ctx.sessionManager.getSessionId();
        const previous = guideReceipts.get(sessionId);
        if (previous?.status === "issued") throw new Error("a Conversation guide disclosure is already awaiting its first continuation");
        const guide = readExactConversationGuide(ctx, options);
        const subject = currentConversationGuideSubject(ctx, options);
        const resultText = expectedGuideResult(guide.text);
        guideReceipts.set(sessionId, {
          status: "issued", toolCallId, sessionId,
          subjectKind: subject.kind,
          sourceLocation: subject.sourceLocation,
          preparationLifecycle: subject.preparationLifecycle,
          lifecycleFingerprint: subject.fingerprint,
          guidePath: guide.path, version: PRIME_CLAW_CONVERSATION_GUIDE_VERSION,
          sha256: PRIME_CLAW_CONVERSATION_GUIDE_SHA256, resultText,
        });
        return {
          content: [{ type: "text", text: resultText }],
          details: { version: PRIME_CLAW_CONVERSATION_GUIDE_VERSION, sha256: PRIME_CLAW_CONVERSATION_GUIDE_SHA256 },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Conversation guide activation failed: ${message}`);
      }
    },
  });
  pi.registerTool({
    name: CONVERSATION_GUIDE_STATUS_TOOL,
    label: "Inspect Conversation guide readiness",
    description: "Read-only readiness check for the exact managed Conversation guide and current trusted active-owner or prospective preparation subject.",
    promptSnippet: "Inspect managed Conversation guide readiness without lifecycle mutation",
    promptGuidelines: [
      "Use prime_claw_conversation_guide_status for read-only readiness evidence before handoff or final bookkeeping UAT.",
      "A not-ready result requires fresh activation or operator consultation; it never authorizes bypass or replay.",
    ],
    executionMode: "sequential",
    parameters: { type: "object", properties: {}, additionalProperties: false } as any,
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      try {
        currentGuideReceipt(ctx, options);
        return {
          content: [{ type: "text", text: `Conversation guide ready: version=${PRIME_CLAW_CONVERSATION_GUIDE_VERSION} sha256=${PRIME_CLAW_CONVERSATION_GUIDE_SHA256}` }],
          details: { ready: true, version: PRIME_CLAW_CONVERSATION_GUIDE_VERSION, sha256: PRIME_CLAW_CONVERSATION_GUIDE_SHA256 },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Conversation guide not ready: ${message}` }],
          details: { ready: false, error: message },
        };
      }
    },
  });
  pi.on("session_start", (_event, ctx) => {
    guideReceipts.delete(ctx.sessionManager.getSessionId());
    return reconcileOversightAtSessionStart(pi, ctx, options);
  });
  pi.on("session_shutdown", (_event, ctx) => { guideReceipts.delete(ctx.sessionManager.getSessionId()); });
  pi.on("context", (event, ctx) => applyConversationContext(event, ctx, options));
}
