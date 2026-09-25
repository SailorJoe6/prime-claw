import { accessSync, constants, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  episodeBootstrapReady,
  parseEpisodeIdentity,
  type EpisodeIdentity,
  type EpisodeResult,
} from "./spec-episode.ts";

export const IDENTITY_KERNEL = "PRIME_CLAW_CONVERSATION_IDENTITY_V1";
export const IDENTITY_BLOCK_START = "<!-- prime-claw:conversation-identity:start -->";
export const IDENTITY_BLOCK_END = "<!-- prime-claw:conversation-identity:end -->";
export const EXPECTED_IDENTITY_KERNEL_BLOCK = `<!-- prime-claw:conversation-identity:start -->
PRIME_CLAW_CONVERSATION_IDENTITY_V1

You have default CONVERSATION capability when you are an independent top-level
user-facing project session. Ordinary discussion, design, specification, and
planning remain available.

Bounded identity overrides default ownership:
- an explicit EPISODE implements only its assigned approved bundle;
- an explicit EXPERT reviews only its assigned question or exact commit;
- a delegated or depth-positive child follows only its bounded task;
- copied conversation history never copies episode ownership.

Oversight mode exists only when exact-session durable state agrees that this
CONVERSATION owns an active EPISODE. While active, follow exactly one current
canonical oversee-episode package supplied by trusted extension context. Missing,
duplicate, corrupt, or disagreeing identity/package state is a blocker. Native
compaction does not end identity or oversight; the first later real turn must
restore both. The exact bookkeeping close ends oversight, not CONVERSATION capability.
<!-- prime-claw:conversation-identity:end -->`;
export const OVERSIGHT_MARKER_TYPE = "prime-claw-conversation-oversight";
export const BOUNDED_IDENTITY_TYPE = "prime-claw-bounded-identity";
export const OVERSIGHT_PACKAGE_TYPE = "prime-claw-oversee-episode-package";
export const BOUNDED_PACKAGE_TYPE = "prime-claw-bounded-identity-package";
export const OVERSIGHT_PACKAGE_PATH = join(".ralph", "skills", "oversee-episode", "SKILL.md");
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

function visibleFailure(ctx: ExtensionContext, message: string): never {
  const full = `prime-claw conversation blocked: ${message}`;
  ctx.ui.notify(full, "error");
  ctx.abort();
  throw new Error(full);
}

function managedBlocks(prompt: string): string[] {
  const blocks: string[] = [];
  let cursor = 0;
  while (true) {
    const start = prompt.indexOf(IDENTITY_BLOCK_START, cursor);
    const endOnly = prompt.indexOf(IDENTITY_BLOCK_END, cursor);
    if (start < 0) { if (endOnly >= 0) throw new Error("managed identity kernel markers are malformed"); break; }
    if (endOnly >= 0 && endOnly < start) throw new Error("managed identity kernel markers are reversed");
    const end = prompt.indexOf(IDENTITY_BLOCK_END, start + IDENTITY_BLOCK_START.length);
    if (end < 0) throw new Error("managed identity kernel is incomplete");
    blocks.push(prompt.slice(start, end + IDENTITY_BLOCK_END.length));
    cursor = end + IDENTITY_BLOCK_END.length;
  }
  return blocks;
}

export function assertIdentityKernel(ctx: ExtensionContext): void {
  const blocks = managedBlocks(ctx.getSystemPrompt());
  if (blocks.length !== 1 || blocks[0] !== EXPECTED_IDENTITY_KERNEL_BLOCK) {
    throw new Error(`expected exactly one intact managed identity kernel, found ${blocks.length}`);
  }
}

function canonicalProjectRoot(cwd: string): string {
  try { return realpathSync(cwd); }
  catch (error) { throw new Error(`project root is unavailable: ${error instanceof Error ? error.message : String(error)}`); }
}
const FRONTMATTER_CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/;
function assertFrontmatterText(value: string, key: string, path: string): void {
  if (FRONTMATTER_CONTROL_CHARACTER.test(value)) {
    throw new Error(`oversight package ${key} scalar contains a control character at ${path}`);
  }
}
function parseFrontmatterScalar(value: string, key: string, path: string): string {
  if (!value) throw new Error(`oversight package ${key} scalar is empty at ${path}`);
  assertFrontmatterText(value, key, path);
  if (/^"(?:[^"\\]|\\.)*"$/.test(value)) {
    let parsed: unknown;
    try { parsed = JSON.parse(value); }
    catch { throw new Error(`oversight package ${key} scalar is malformed at ${path}`); }
    if (typeof parsed !== "string" || !parsed) throw new Error(`oversight package ${key} scalar is malformed at ${path}`);
    assertFrontmatterText(parsed, key, path);
    return parsed;
  }
  if (/^'[^']*'$/.test(value)) {
    const parsed = value.slice(1, -1);
    if (parsed) return parsed;
  }
  if (/^[-?:,\[\]{}#&*!|>'"%@`]/.test(value) || /[\[\]{}'"\t]/.test(value) || /:\s|\s#/.test(value)) {
    throw new Error(`oversight package ${key} scalar uses unsupported YAML syntax at ${path}`);
  }
  return value;
}
function parseSkillFrontmatter(text: string, path: string): { name: string; body: string } {
  const parsed = /^---\n([\s\S]*?)\n---\n([\s\S]+)$/.exec(text);
  if (!parsed) throw new Error(`oversight package frontmatter or procedure is incomplete at ${path}`);
  const lines = parsed[1].split("\n");
  if (lines.length !== 2) throw new Error(`oversight package frontmatter requires exactly name and description lines at ${path}`);
  const values = new Map<string, string>();
  for (const raw of lines) {
    if (/^[ \t]/.test(raw) || raw.startsWith("-")) throw new Error(`oversight package frontmatter nesting or sequences are unsupported at ${path}`);
    const match = /^(name|description):[ ](\S(?:.*\S)?)$/.exec(raw);
    if (!match || values.has(match[1])) throw new Error(`oversight package frontmatter is malformed or ambiguous at ${path}`);
    values.set(match[1], parseFrontmatterScalar(match[2], match[1], path));
  }
  const name = values.get("name"); const description = values.get("description");
  if (name !== "oversee-episode" || !description) throw new Error(`oversight package requires exact name and nonempty description at ${path}`);
  const body = parsed[2].trim();
  if (!body) throw new Error(`oversight package procedure is empty at ${path}`);
  return { name, body };
}
function packageBody(cwd: string): string {
  const path = join(canonicalProjectRoot(cwd), OVERSIGHT_PACKAGE_PATH);
  let raw: string;
  try { raw = readFileSync(path, "utf8"); }
  catch (error) { throw new Error(`oversight package unavailable at ${path}: ${error instanceof Error ? error.message : String(error)}`); }
  parseSkillFrontmatter(raw, path);
  return raw.trim();
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
  packageBody(ctx.cwd);
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
  packageBody(ctx.cwd);
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

export type ConversationOversightRegistration = Record<string, never>;

export async function reconcileOversightAtSessionStart(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  _options: ConversationOversightRegistration = {},
): Promise<void> {
  try {
    let state = classifyLifecycle(ctx);
    if (state.mode !== "ordinary" || currentBoundedIdentity(ctx)) {
      assertIdentityKernel(ctx);
      packageBody(ctx.cwd);
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

export function applyConversationContext(event: {messages:unknown[]}, ctx: ExtensionContext) {
  const messages = (event.messages as Array<Record<string,unknown>>).filter((message) => !(message.role === "custom"
    && (message.customType === OVERSIGHT_PACKAGE_TYPE || message.customType === BOUNDED_PACKAGE_TYPE)));
  try {
    const bounded = currentBoundedIdentity(ctx);
    if (bounded) { assertIdentityKernel(ctx); return { messages:[...messages,{role:"custom",customType:BOUNDED_PACKAGE_TYPE,content:`PRIME_CLAW_BOUNDED_IDENTITY_V1
role=${bounded.role}
sessionId=${bounded.sessionId}`,display:false,timestamp:Date.now()}] }; }
    const state = classifyLifecycle(ctx);
    if (state.mode === "ordinary") return { messages };
    if (state.mode === "recovery") throw new Error(`oversight lifecycle requires ${state.recovery!.kind} recovery before provider dispatch`);
    assertIdentityKernel(ctx);
    const body = packageBody(ctx.cwd);
    return {messages:[...messages,{role:"custom",customType:OVERSIGHT_PACKAGE_TYPE,content:body,display:false,timestamp:Date.now()}]};
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
  pi.on("session_start", (_event, ctx) => reconcileOversightAtSessionStart(pi, ctx, options));
  pi.on("context", (event, ctx) => applyConversationContext(event, ctx));
}
