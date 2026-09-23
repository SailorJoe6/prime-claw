import { accessSync, constants, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export const IDENTITY_KERNEL = "PRIME_CLAW_CONVERSATION_IDENTITY_V1";
export const OVERSIGHT_MARKER_TYPE = "prime-claw-conversation-oversight";
export const BOUNDED_IDENTITY_TYPE = "prime-claw-bounded-identity";
export const OVERSIGHT_PACKAGE_TYPE = "prime-claw-oversee-episode-package";
export const BOUNDED_PACKAGE_TYPE = "prime-claw-bounded-identity-package";
export const OVERSIGHT_PACKAGE_PATH = join(".ralph", "skills", "oversee-episode", "SKILL.md");
const MARKER_VERSION = 1;
const readySessions = new Set<string>();

export type OversightDisposition = "merged" | "abandoned";
export type OversightMarker = {
  version: 1;
  status: "active" | "inactive";
  ownerSessionId: string;
  sourceLocation: string;
  slug: string;
  episodeId: string;
  episodeSessionFile: string;
};

export function markOversightRuntimeReady(sessionId: string): void { readySessions.add(sessionId); }
export function clearOversightRuntimeReady(sessionId: string): void { readySessions.delete(sessionId); }

function fail(ctx: ExtensionContext, message: string): never {
  const full = `prime-claw conversation blocked: ${message}`;
  ctx.ui.notify(full, "error");
  ctx.abort();
  throw new Error(full);
}

export function assertIdentityKernel(ctx: ExtensionContext): void {
  const count = ctx.getSystemPrompt().split(IDENTITY_KERNEL).length - 1;
  if (count !== 1) fail(ctx, `expected exactly one managed identity kernel, found ${count}`);
}

function packageBody(cwd: string): string {
  const path = join(cwd, OVERSIGHT_PACKAGE_PATH);
  let body: string;
  try { body = readFileSync(path, "utf8").trim(); }
  catch (error) {
    throw new Error(`oversight package unavailable at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!body || !/^---[\s\S]*?name:\s*oversee-episode[\s\S]*?---/.test(body)) {
    throw new Error(`oversight package is empty or malformed at ${path}`);
  }
  return body;
}

export function assertConversationPromotionReady(ctx: ExtensionContext): void {
  const sessionId = ctx.sessionManager.getSessionId();
  if (!readySessions.has(sessionId)) throw new Error("project-conversation restoration plugin is not ready for this session");
  assertIdentityKernel(ctx);
  packageBody(ctx.cwd);
  const stateRoot = resolve(ctx.cwd, ".prime", "agent", "state", "spec-episodes");
  mkdirSync(stateRoot, { recursive: true });
  accessSync(stateRoot, constants.R_OK | constants.W_OK);
}

function latestCurrentMarker(ctx: ExtensionContext): OversightMarker | null {
  const sessionId = ctx.sessionManager.getSessionId();
  const entries = ctx.sessionManager.getBranch() as Array<{ type?: string; customType?: string; data?: unknown }>;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.type !== "custom" || entry.customType !== OVERSIGHT_MARKER_TYPE) continue;
    const data = entry.data as Partial<OversightMarker> | undefined;
    if (data?.ownerSessionId !== sessionId) continue;
    if (
      data.version !== MARKER_VERSION
      || (data.status !== "active" && data.status !== "inactive")
      || typeof data.sourceLocation !== "string"
      || typeof data.slug !== "string"
      || typeof data.episodeId !== "string"
      || typeof data.episodeSessionFile !== "string"
    ) throw new Error("latest exact-session oversight marker is corrupt");
    return data as OversightMarker;
  }
  return null;
}

function expectationPath(cwd: string, slug: string): string {
  return resolve(cwd, ".prime", "agent", "state", "spec-episodes", `${slug}.json`);
}

function validateExpectation(ctx: ExtensionContext, marker: OversightMarker): void {
  const path = expectationPath(ctx.cwd, marker.slug);
  let identity: Record<string, unknown>;
  try { identity = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>; }
  catch (error) {
    throw new Error(`active oversight expectation unavailable at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (
    identity.ownerSessionId !== marker.ownerSessionId
    || identity.sourceLocation !== marker.sourceLocation
    || identity.episodeId !== marker.episodeId
    || resolve(String(identity.episodeSessionFile ?? "")) !== resolve(marker.episodeSessionFile)
  ) throw new Error(`active oversight marker disagrees with ${path}`);
}

function currentBoundedIdentity(ctx: ExtensionContext): { role: "EPISODE"; sessionId: string } | null {
  const sessionId = ctx.sessionManager.getSessionId();
  const entries = ctx.sessionManager.getBranch() as Array<{ type?: string; customType?: string; data?: unknown }>;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.type !== "custom" || entry.customType !== BOUNDED_IDENTITY_TYPE) continue;
    const data = entry.data as { version?: unknown; role?: unknown; sessionId?: unknown } | undefined;
    if (data?.sessionId !== sessionId) continue;
    if (data.version !== 1 || data.role !== "EPISODE") throw new Error("exact-session bounded identity is corrupt");
    return data as { role: "EPISODE"; sessionId: string };
  }
  return null;
}

export function appendActiveOversight(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  episode: { sourceLocation: string; slug: string; episodeId: string; episodeSessionFile: string },
): void {
  const current = latestCurrentMarker(ctx);
  if (current?.status === "active") {
    if (current.sourceLocation === episode.sourceLocation && current.episodeId === episode.episodeId) return;
    throw new Error("this conversation already owns a different active episode");
  }
  pi.appendEntry(OVERSIGHT_MARKER_TYPE, {
    version: MARKER_VERSION,
    status: "active",
    ownerSessionId: ctx.sessionManager.getSessionId(),
    ...episode,
  } satisfies OversightMarker);
}

export function appendInactiveOversight(pi: ExtensionAPI, marker: OversightMarker): void {
  pi.appendEntry(OVERSIGHT_MARKER_TYPE, { ...marker, status: "inactive" } satisfies OversightMarker);
}

export function appendEpisodeIdentity(
  session: { appendCustomEntry(customType: string, data: unknown): unknown; getSessionId(): string },
): void {
  session.appendCustomEntry(BOUNDED_IDENTITY_TYPE, {
    version: 1,
    role: "EPISODE",
    sessionId: session.getSessionId(),
  });
}

export function applyConversationContext(event: { messages: unknown[] }, ctx: ExtensionContext) {
  assertIdentityKernel(ctx);
  const messages = (event.messages as Array<Record<string, unknown>>)
    .filter((message) => !(message.role === "custom"
      && (message.customType === OVERSIGHT_PACKAGE_TYPE || message.customType === BOUNDED_PACKAGE_TYPE)));
  let bounded: ReturnType<typeof currentBoundedIdentity>;
  try { bounded = currentBoundedIdentity(ctx); }
  catch (error) { fail(ctx, error instanceof Error ? error.message : String(error)); }
  if (bounded) {
    return { messages: [...messages, {
      role: "custom",
      customType: BOUNDED_PACKAGE_TYPE,
      content: `PRIME_CLAW_BOUNDED_IDENTITY_V1\nrole=${bounded.role}\nsessionId=${bounded.sessionId}`,
      display: false,
      timestamp: Date.now(),
    }] };
  }
  let marker: OversightMarker | null;
  try { marker = latestCurrentMarker(ctx); }
  catch (error) { fail(ctx, error instanceof Error ? error.message : String(error)); }
  if (!marker || marker.status === "inactive") return { messages };
  try {
    validateExpectation(ctx, marker);
    const body = packageBody(ctx.cwd);
    return {
      messages: [...messages, {
        role: "custom",
        customType: OVERSIGHT_PACKAGE_TYPE,
        content: body,
        display: false,
        timestamp: Date.now(),
      }],
    };
  } catch (error) { fail(ctx, error instanceof Error ? error.message : String(error)); }
}

export function currentOversightMarker(ctx: ExtensionContext): OversightMarker | null {
  return latestCurrentMarker(ctx);
}
