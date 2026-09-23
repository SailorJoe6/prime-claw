import { accessSync, constants, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
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

function packageBody(cwd: string): string {
  const path = join(cwd, OVERSIGHT_PACKAGE_PATH);
  let body: string;
  try { body = readFileSync(path, "utf8").trim(); }
  catch (error) {
    throw new Error(`oversight package unavailable at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const parsed = /^---\n([\s\S]*?)\n---\n([\s\S]+)$/.exec(body);
  if (!parsed) throw new Error(`oversight package frontmatter or procedure is incomplete at ${path}`);
  const frontmatter = parsed[1].split("\n");
  const name = frontmatter.find((line) => line.trim().startsWith("name:"))?.split(":", 2)[1]?.trim();
  const procedure = parsed[2].trim();
  if (name !== "oversee-episode" || !procedure) throw new Error(`oversight package name or procedure is invalid at ${path}`);
  return body;
}

function stateRoot(cwd: string): string { return resolve(cwd, ".prime", "agent", "state", "spec-episodes"); }
function expectedWorktree(cwd: string, slug: string): string {
  return resolve(dirname(resolve(cwd)), `${basename(resolve(cwd))}-${slug}-episode`);
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
    episodeActiveSessionId: identity.episodeActiveSessionId,
    episodeSessionFile: identity.episodeSessionFile, branch: identity.branch,
    worktree: identity.worktree, sessionName: identity.sessionName,
    identityVersion: identity.version,
    admission: identity.version === 1 ? identity.executeAdmission : identity.bootstrapAdmission,
  };
}
function parseMarker(data: unknown): OversightMarker {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("oversight marker is corrupt");
  const item = data as Record<string, unknown>;
  const fields = ["ownerSessionId","slug","sourceLocation","episodeId","episodeActiveSessionId","episodeSessionFile","branch","worktree","sessionName","admission"];
  const slug = typeof item.slug === "string" ? item.slug : "";
  if (item.markerVersion !== MARKER_VERSION || (item.status !== "active" && item.status !== "inactive")
    || (item.identityVersion !== 1 && item.identityVersion !== 2)
    || !fields.every((field) => typeof item[field] === "string" && item[field])
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    || item.sourceLocation !== `.ralph/plans/future/${slug}`
    || item.branch !== `episode/${slug}` || item.sessionName !== `${slug}-episode`) throw new Error("oversight marker is corrupt");
  return item as unknown as OversightMarker;
}
function markers(ctx: ExtensionContext): OversightMarker[] {
  const result: OversightMarker[] = [];
  for (const entry of ctx.sessionManager.getBranch() as Array<{type?:string;customType?:string;data?:unknown}>) {
    if (entry.type !== "custom" || entry.customType !== OVERSIGHT_MARKER_TYPE) continue;
    result.push(parseMarker(entry.data));
  }
  return result;
}
function exactMarker(ctx: ExtensionContext, expectation?: EpisodeIdentity): OversightMarker | null {
  const sessionId = ctx.sessionManager.getSessionId();
  const all = markers(ctx);
  if (expectation) {
    const related = all.filter((marker) => marker.episodeId === expectation.episodeId || marker.slug === expectation.slug);
    if (related.some((marker) => marker.ownerSessionId !== sessionId)) throw new Error("oversight marker owner disagrees with the exact expectation");
  }
  return all.filter((marker) => marker.ownerSessionId === sessionId).at(-1) ?? null;
}
function assertAgreement(marker: OversightMarker, identity: EpisodeIdentity): void {
  const expected = markerFromIdentity(identity, marker.status);
  for (const key of Object.keys(expected) as Array<keyof OversightMarker>) {
    if (marker[key] !== expected[key]) throw new Error(`oversight marker disagrees on ${key}`);
  }
}

export function assertConversationPromotionReady(ctx: ExtensionContext): void {
  assertIdentityKernel(ctx);
  packageBody(ctx.cwd);
  const root = stateRoot(ctx.cwd); mkdirSync(root, { recursive: true }); accessSync(root, constants.R_OK | constants.W_OK);
  ownerExpectations(ctx);
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
  const existing = exactMarker(ctx, expectation);
  if (existing?.status === "active") { assertAgreement(existing, expectation); return existing; }
  if (existing) throw new Error("inactive oversight marker conflicts with a live expectation");
  const marker = markerFromIdentity(expectation, "active");
  pi.appendEntry(OVERSIGHT_MARKER_TYPE, marker);
  const persisted = exactMarker(ctx, expectation);
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
  if (values.length > 1) throw new Error("conversation has more than one finalization receipt");
  return values;
}
function assertMarkerReceipt(marker: OversightMarker, receipt: FinalizationReceipt): void {
  const pairs: Array<[unknown, unknown]> = [
    [marker.ownerSessionId, receipt.ownerSessionId], [marker.slug, receipt.slug],
    [marker.sourceLocation, receipt.sourceLocation], [marker.episodeId, receipt.episodeId],
    [marker.episodeActiveSessionId, receipt.episodeActiveSessionId],
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
    episodeActiveSessionId: receipt.episodeActiveSessionId,
    episodeSessionFile: receipt.episodeSessionFile, branch: receipt.episodeBranch,
    worktree: receipt.episodeWorktree, sessionName: receipt.sessionName,
    identityVersion: receipt.identityVersion, admission: receipt.admission,
  };
}

function resolveState(ctx: ExtensionContext): { expectation: EpisodeIdentity | null; marker: OversightMarker | null } {
  const expectations = ownerExpectations(ctx);
  const expectation = expectations[0] ?? null;
  const marker = exactMarker(ctx, expectation ?? undefined);
  const receipt = ownerFinalizationReceipts(ctx)[0] ?? null;
  if (receipt) {
    if (expectation && receipt.slug !== expectation.slug) throw new Error("finalization receipt disagrees with the owner expectation");
    if (receipt.ownerSessionId !== ctx.sessionManager.getSessionId()) throw new Error("finalization receipt owner mismatch");
    if (!marker) throw new Error("finalization receipt has no exact-session oversight marker");
    assertMarkerReceipt(marker, receipt);
    if (receipt.state === "completed") {
      if (expectation) throw new Error("completed finalization still has an ownership expectation");
      if (marker.status !== "inactive") throw new Error("completed finalization requires an inactive marker");
      return { expectation: null, marker };
    }
    if (receipt.state === "completing") throw new Error("episode finalization is completing; replay completion to reconcile it");
  }
  if (expectation) {
    if (!episodeBootstrapReady(expectation)) throw new Error("owner episode expectation is not bootstrap-ready");
    if (!marker) throw new Error("owner episode expectation has no active oversight marker");
    assertAgreement(marker, expectation);
    if (marker.status !== "active") throw new Error("inactive oversight marker conflicts with a live expectation");
  } else if (marker?.status === "active") throw new Error("active oversight marker has no durable expectation");
  return { expectation, marker };
}

export function reconcileOversightAtSessionStart(pi: ExtensionAPI, ctx: ExtensionContext): void {
  let expectations: EpisodeIdentity[];
  try { expectations = ownerExpectations(ctx); } catch (error) { ctx.ui.notify(`prime-claw oversight recovery blocked: ${error instanceof Error ? error.message : String(error)}`, "error"); return; }
  try {
    const expectation = expectations[0] ?? null;
    const receipt = ownerFinalizationReceipts(ctx)[0] ?? null;
    let marker = exactMarker(ctx, expectation ?? undefined);
    if (receipt && !marker) {
      const status = receipt.state === "completed" || (receipt.state === "completing" && !expectation) ? "inactive" : "active";
      marker = markerFromReceipt(receipt, status);
      pi.appendEntry(OVERSIGHT_MARKER_TYPE, marker);
      const message = `Recovered ${status} oversight finalization state for ${receipt.sourceLocation} from its durable receipt.`;
      ctx.ui.notify(message, "warning");
      void pi.sendMessage({ customType: "prime-claw-oversight-recovery", content: message, display: true });
    }
    if (expectation && !marker) {
      if (!episodeBootstrapReady(expectation)) throw new Error("owner episode expectation is not bootstrap-ready");
      marker = markerFromIdentity(expectation, "active");
      pi.appendEntry(OVERSIGHT_MARKER_TYPE, marker);
      const message = `Recovered active oversight for ${expectation.sourceLocation} from the exact durable episode expectation.`;
      ctx.ui.notify(message, "warning");
      void pi.sendMessage({ customType: "prime-claw-oversight-recovery", content: message, display: true });
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
export function currentOversightMarkerForFinalization(ctx: ExtensionContext): OversightMarker | null {
  return exactMarker(ctx, ownerExpectations(ctx)[0]);
}
export function registerConversationOversight(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => reconcileOversightAtSessionStart(pi, ctx));
  pi.on("context", (event, ctx) => applyConversationContext(event, ctx));
}
