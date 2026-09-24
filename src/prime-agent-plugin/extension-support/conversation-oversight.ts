import { accessSync, constants, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { parseFinalizationReceipt, type FinalizationReceipt } from "./episode-finalization.ts";
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
restore both. Terminal finalization ends oversight, not CONVERSATION capability.
<!-- prime-claw:conversation-identity:end -->`;
export const OVERSIGHT_MARKER_TYPE = "prime-claw-conversation-oversight";
export const BOUNDED_IDENTITY_TYPE = "prime-claw-bounded-identity";
export const OVERSIGHT_PACKAGE_TYPE = "prime-claw-oversee-episode-package";
export const BOUNDED_PACKAGE_TYPE = "prime-claw-bounded-identity-package";
export const OVERSIGHT_PACKAGE_PATH = join(".ralph", "skills", "oversee-episode", "SKILL.md");
const MARKER_VERSION = 2;

export type OversightDisposition = "merged" | "abandoned";
export type OversightMarker = {
  markerVersion: 2;
  status: "active" | "inactive";
  ownerSessionId: string;
  slug: string;
  sourceLocation: string;
  episodeId: string;
  episodeActiveSessionId: string;
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
function parseFrontmatterScalar(value: string, key: string, path: string): string {
  if (!value) throw new Error(`oversight package ${key} scalar is empty at ${path}`);
  if (/^"(?:[^"\\]|\\.)*"$/.test(value)) {
    try { const parsed = JSON.parse(value); if (typeof parsed === "string" && parsed) return parsed; } catch { /* below */ }
    throw new Error(`oversight package ${key} scalar is malformed at ${path}`);
  }
  if (/^'[^']*'$/.test(value)) { const parsed = value.slice(1, -1); if (parsed) return parsed; }
  if (/^[\[\]{}|>&*!%@`'"-]/.test(value) || /[\[\]{}'"\t]/.test(value) || /:\s|\s#/.test(value)) {
    throw new Error(`oversight package ${key} scalar uses unsupported YAML syntax at ${path}`);
  }
  return value;
}
function parseSkillFrontmatter(text: string, path: string): { name: string; body: string } {
  const parsed = /^---\n([\s\S]*?)\n---\n([\s\S]+)$/.exec(text);
  if (!parsed) throw new Error(`oversight package frontmatter or procedure is incomplete at ${path}`);
  const values = new Map<string, string>();
  for (const raw of parsed[1].split("\n")) {
    if (!raw.trim() || raw.startsWith("#")) continue;
    if (/^[ \t]/.test(raw) || raw.startsWith("-")) throw new Error(`oversight package frontmatter nesting or sequences are unsupported at ${path}`);
    const match = /^([A-Za-z_][A-Za-z0-9_-]*):[ ](\S(?:.*\S)?)$/.exec(raw);
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
  let body: string;
  try { body = readFileSync(path, "utf8").trim(); }
  catch (error) { throw new Error(`oversight package unavailable at ${path}: ${error instanceof Error ? error.message : String(error)}`); }
  parseSkillFrontmatter(body, path);
  return body;
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
  return markerRecords(ctx).find((record) => (record.marker ?? record.legacy)?.sourceLocation === sourceLocation) ?? null;
}
function assertAgreement(marker: OversightMarker, identity: EpisodeIdentity): void {
  const expected = markerFromIdentity(identity, marker.status);
  for (const key of Object.keys(expected) as Array<keyof OversightMarker>) {
    if (marker[key] !== expected[key]) throw new Error(`oversight marker disagrees on ${key}`);
  }
}

export function assertConversationPromotionReady(ctx: ExtensionContext, requestedLocation?: string): void {
  assertIdentityKernel(ctx);
  packageBody(ctx.cwd);
  const root = stateRoot(ctx.cwd); mkdirSync(root, { recursive: true }); accessSync(root, constants.R_OK | constants.W_OK);
  const expectations = ownerExpectations(ctx);
  if (expectations.length && requestedLocation && expectations[0].sourceLocation !== requestedLocation) {
    throw new Error(`conversation already owns active expectation ${expectations[0].sourceLocation}`);
  }
  assertNoConflictingLifecycleState(ctx, expectations[0] ?? null, false);
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
  assertConversationPromotionReady(ctx);
  const identity = validateProjectBinding(parseEpisodeIdentity(episode, "created episode result"), ctx.cwd);
  if (!episodeBootstrapReady(identity)) throw new Error("created episode expectation is not bootstrap-ready");
  if (identity.ownerSessionId !== ctx.sessionManager.getSessionId()) throw new Error("created episode owner mismatch");
  const expectation = ownerExpectations(ctx).find((value) => value.slug === identity.slug);
  if (!expectation) throw new Error("created episode expectation was not persisted");
  const existingRecord = markerForIdentity(ctx, expectation);
  if (existingRecord?.marker?.status === "active") { assertAgreement(existingRecord.marker, expectation); return existingRecord.marker; }
  if (existingRecord?.marker || existingRecord?.legacy) throw new Error("existing marker conflicts with the live episode generation");
  const marker = markerFromIdentity(expectation, "active");
  pi.appendEntry(OVERSIGHT_MARKER_TYPE, marker);
  const persisted = markerForIdentity(ctx, expectation)?.marker;
  if (!persisted) throw new Error("active oversight marker did not persist");
  assertAgreement(persisted, expectation);
  return persisted;
}
export function appendInactiveOversight(pi: ExtensionAPI, marker: OversightMarker): void {
  pi.appendEntry(OVERSIGHT_MARKER_TYPE, { ...marker, status: "inactive" } satisfies OversightMarker);
}
export function appendEpisodeIdentity(session: {appendCustomEntry(customType:string,data:unknown):unknown;getSessionId():string}): void {
  session.appendCustomEntry(BOUNDED_IDENTITY_TYPE, {version:1,role:"EPISODE",sessionId:session.getSessionId()});
}

function ownerFinalizationReceipts(ctx: ExtensionContext): FinalizationReceipt[] {
  const root = stateRoot(ctx.cwd);
  if (!existsSync(root)) return [];
  const values: FinalizationReceipt[] = [];
  for (const name of readdirSync(root)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.finalization\.json$/.test(name)) continue;
    const path = join(root, name); const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`finalization receipt path is not a regular file: ${path}`);
    let raw: unknown;
    try { raw = JSON.parse(readFileSync(path, "utf8")); }
    catch (error) { throw new Error(`finalization receipt is unreadable: ${error instanceof Error ? error.message : String(error)}`); }
    if (raw && typeof raw === "object" && !Array.isArray(raw)
      && typeof (raw as { ownerSessionId?: unknown }).ownerSessionId === "string"
      && (raw as { ownerSessionId: string }).ownerSessionId !== ctx.sessionManager.getSessionId()) continue;
    let value: FinalizationReceipt;
    try { value = parseFinalizationReceipt(raw); }
    catch (error) { throw new Error(`finalization receipt is invalid: ${error instanceof Error ? error.message : String(error)}`); }
    if (`${value.slug}.finalization.json` !== name) throw new Error(`finalization receipt filename/slug mismatch: ${path}`);
    values.push(value);
  }
  return values;
}
function assertMarkerReceipt(marker: OversightMarker, receipt: FinalizationReceipt): void {
  const pairs: Array<[unknown, unknown]> = [
    [marker.ownerSessionId, receipt.ownerSessionId], [marker.slug, receipt.slug],
    [marker.sourceLocation, receipt.sourceLocation], [marker.episodeId, receipt.episodeId],
    [resolve(marker.episodeSessionFile), resolve(receipt.episodeSessionFile)],
    [marker.branch, receipt.episodeBranch], [resolve(marker.worktree), resolve(receipt.episodeWorktree)],
    [marker.sessionName, receipt.sessionName], [marker.identityVersion, receipt.identityVersion],
    [marker.admission, receipt.admission],
  ];
  if (pairs.some(([left, right]) => left !== right)) throw new Error("oversight marker disagrees with finalization receipt");
}

function markerFromReceipt(receipt: FinalizationReceipt, status: "active" | "inactive"): OversightMarker {
  return {
    markerVersion: MARKER_VERSION, status, ownerSessionId: receipt.ownerSessionId,
    slug: receipt.slug, sourceLocation: receipt.sourceLocation, episodeId: receipt.episodeId,
    episodeSessionFile: receipt.episodeSessionFile, branch: receipt.episodeBranch,
    worktree: receipt.episodeWorktree, sessionName: receipt.sessionName,
    identityVersion: receipt.identityVersion, admission: receipt.admission,
  };
}

function matchingReceipt(receipts: FinalizationReceipt[], value: { slug: string; episodeId: string }): FinalizationReceipt | null {
  return receipts.find((receipt) => receipt.slug === value.slug && receipt.episodeId === value.episodeId) ?? null;
}
function assertNoConflictingLifecycleState(
  ctx: ExtensionContext,
  expectation: EpisodeIdentity | null,
  allowMatchingAuthorized: boolean,
): void {
  const receipts = ownerFinalizationReceipts(ctx);
  const records = markerRecords(ctx);
  for (const receipt of receipts) {
    const record = markerForLocation(ctx, receipt.sourceLocation);
    const marker = record?.marker ?? null;
    if (!marker) throw new Error("finalization receipt lacks its exact v2 marker");
    assertMarkerReceipt(marker, receipt);
    const sameExpectation = expectation?.slug === receipt.slug && expectation.episodeId === receipt.episodeId;
    if (sameExpectation) {
      if (receipt.state === "authorized" && allowMatchingAuthorized && marker.status === "active") continue;
      throw new Error(`current expectation conflicts with terminal ${receipt.state} receipt`);
    }
    if (receipt.state !== "completed" || marker.status !== "inactive") {
      throw new Error(`noncurrent terminal ${receipt.state} state must be reconciled before proceeding`);
    }
  }
  for (const record of records) {
    const value = record.marker ?? record.legacy!;
    const sameExpectation = expectation?.slug === value.slug && expectation.episodeId === value.episodeId;
    if (record.legacy) {
      if (!sameExpectation) throw new Error("legacy owner marker requires exact expectation migration before proceeding");
      continue;
    }
    if (sameExpectation) {
      if (record.marker!.status !== "active") throw new Error("current expectation has an inactive marker");
      continue;
    }
    if (record.marker!.status === "active") throw new Error("orphan active marker conflicts with current lifecycle state");
    const receipt = matchingReceipt(receipts, record.marker!);
    if (!receipt || receipt.state !== "completed") throw new Error("inactive marker has no completed matching tombstone");
  }
}

function resolveState(ctx: ExtensionContext): { expectation: EpisodeIdentity | null; marker: OversightMarker | null } {
  const expectation = ownerExpectations(ctx)[0] ?? null;
  const receipts = ownerFinalizationReceipts(ctx);
  assertNoConflictingLifecycleState(ctx, expectation, true);
  if (expectation) {
    if (!episodeBootstrapReady(expectation)) throw new Error("owner episode expectation is not bootstrap-ready");
    const record = markerForIdentity(ctx, expectation);
    if (record?.legacy) throw new Error("legacy owner marker requires session-start migration");
    const marker = record?.marker ?? null;
    if (!marker) throw new Error("owner episode expectation has no active oversight marker");
    assertAgreement(marker, expectation);
    const receipt = matchingReceipt(receipts, expectation);
    if (receipt) {
      assertMarkerReceipt(marker, receipt);
      if (receipt.state === "completed") throw new Error("completed finalization cannot coexist with a reappearing expectation");
      if (receipt.state === "completing") throw new Error("episode finalization is completing; native recovery must reconcile it");
    }
    if (marker.status !== "active") throw new Error("inactive oversight marker conflicts with a live expectation");
    return { expectation, marker };
  }
  for (const receipt of receipts) {
    const record = markerForLocation(ctx, receipt.sourceLocation);
    if (!record?.marker) throw new Error("finalization receipt has no exact v2 marker");
    assertMarkerReceipt(record.marker, receipt);
    if (receipt.state !== "completed") throw new Error(`episode finalization is ${receipt.state}; native recovery must reconcile it`);
    if (record.marker.status !== "inactive") throw new Error("completed finalization requires an inactive marker");
  }
  for (const record of markerRecords(ctx)) {
    const value = record.marker ?? record.legacy!;
    const receipt = matchingReceipt(receipts, value);
    if (record.legacy) throw new Error("legacy owner marker has no live expectation for migration");
    if (record.marker!.status === "active") throw new Error("active oversight marker has no durable expectation");
    if (!receipt || receipt.state !== "completed") throw new Error("inactive oversight marker lacks a completed matching tombstone");
  }
  return { expectation: null, marker: null };
}

export function reconcileOversightAtSessionStart(pi: ExtensionAPI, ctx: ExtensionContext): void {
  try {
    const expectation = ownerExpectations(ctx)[0] ?? null;
    const receipts = ownerFinalizationReceipts(ctx);
    const existingRecords = markerRecords(ctx);
    if (expectation || receipts.length || existingRecords.length || currentBoundedIdentity(ctx)) {
      assertIdentityKernel(ctx);
      packageBody(ctx.cwd);
    }
    if (expectation) {
      if (!episodeBootstrapReady(expectation)) throw new Error("owner episode expectation is not bootstrap-ready");
      const existing = markerForIdentity(ctx, expectation);
      if (existing?.legacy) {
        if (existing.legacy.status !== "active") throw new Error("inactive legacy marker conflicts with a live expectation");
        if (existing.legacy.ownerSessionId !== expectation.ownerSessionId
          || existing.legacy.slug !== expectation.slug
          || existing.legacy.sourceLocation !== expectation.sourceLocation
          || existing.legacy.episodeId !== expectation.episodeId
          || resolve(existing.legacy.episodeSessionFile) !== resolve(expectation.episodeSessionFile)) {
          throw new Error("legacy oversight marker disagrees with the exact durable expectation");
        }
        const migrated = markerFromIdentity(expectation, "active");
        pi.appendEntry(OVERSIGHT_MARKER_TYPE, migrated);
        const message = `Migrated legacy oversight for ${expectation.sourceLocation} to the exact v2 marker.`;
        ctx.ui.notify(message, "warning");
        void pi.sendMessage({ customType: "prime-claw-oversight-recovery", content: message, display: true });
      } else if (!existing?.marker) {
        const recovered = markerFromIdentity(expectation, "active");
        pi.appendEntry(OVERSIGHT_MARKER_TYPE, recovered);
        const message = `Recovered active oversight for ${expectation.sourceLocation} from the exact durable episode expectation.`;
        ctx.ui.notify(message, "warning");
        void pi.sendMessage({ customType: "prime-claw-oversight-recovery", content: message, display: true });
      }
    }
    for (const receipt of receipts) {
      let record = markerForLocation(ctx, receipt.sourceLocation);
      if (!record?.marker) {
        const status = receipt.state === "authorized" && expectation ? "active" : "inactive";
        const recovered = markerFromReceipt(receipt, status);
        pi.appendEntry(OVERSIGHT_MARKER_TYPE, recovered); record = { marker: recovered };
        const message = `Recovered ${status} oversight finalization state for ${receipt.sourceLocation} from its durable receipt.`;
        ctx.ui.notify(message, "warning");
        void pi.sendMessage({ customType: "prime-claw-oversight-recovery", content: message, display: true });
      }
    }
    resolveState(ctx);
  } catch (error) { ctx.ui.notify(`prime-claw oversight recovery blocked: ${error instanceof Error ? error.message : String(error)}`, "error"); }
}

export function applyConversationContext(event: {messages:unknown[]}, ctx: ExtensionContext) {
  const messages = (event.messages as Array<Record<string,unknown>>).filter((message) => !(message.role === "custom"
    && (message.customType === OVERSIGHT_PACKAGE_TYPE || message.customType === BOUNDED_PACKAGE_TYPE)));
  try {
    const bounded = currentBoundedIdentity(ctx);
    if (bounded) { assertIdentityKernel(ctx); return { messages:[...messages,{role:"custom",customType:BOUNDED_PACKAGE_TYPE,content:`PRIME_CLAW_BOUNDED_IDENTITY_V1\nrole=${bounded.role}\nsessionId=${bounded.sessionId}`,display:false,timestamp:Date.now()}] }; }
    const state = resolveState(ctx);
    if (!state.expectation && (!state.marker || state.marker.status === "inactive")) return { messages };
    assertIdentityKernel(ctx);
    const body = packageBody(ctx.cwd);
    return {messages:[...messages,{role:"custom",customType:OVERSIGHT_PACKAGE_TYPE,content:body,display:false,timestamp:Date.now()}]};
  } catch (error) { visibleFailure(ctx, error instanceof Error ? error.message : String(error)); }
}
export function currentOversightMarker(ctx: ExtensionContext): OversightMarker | null { return resolveState(ctx).marker; }
export function currentOversightMarkerForFinalization(ctx: ExtensionContext, sourceLocation: string): OversightMarker | null {
  return markerForLocation(ctx, sourceLocation)?.marker ?? null;
}
export function assertFinalizationRecoveryReady(ctx: ExtensionContext): void {
  const completing = ownerFinalizationReceipts(ctx).some((value) => value.state === "completing");
  if (!completing) return;
  assertIdentityKernel(ctx);
  packageBody(ctx.cwd);
}
export function currentCompletingFinalization(ctx: ExtensionContext): { receipt: FinalizationReceipt; marker: OversightMarker } | null {
  const receipt = ownerFinalizationReceipts(ctx).find((value) => value.state === "completing");
  if (!receipt) return null;
  const marker = markerForLocation(ctx, receipt.sourceLocation)?.marker;
  if (!marker) throw new Error("completing receipt has no exact v2 marker");
  assertMarkerReceipt(marker, receipt);
  return { receipt, marker };
}
export function registerConversationOversight(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => reconcileOversightAtSessionStart(pi, ctx));
  pi.on("context", (event, ctx) => applyConversationContext(event, ctx));
}
