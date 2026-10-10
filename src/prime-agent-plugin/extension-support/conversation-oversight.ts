import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { readEpisodeOwnership, type EpisodeOwnershipRecord } from "./episode-ownership.ts";

export const CONVERSATION_GUIDE_MESSAGE_TYPE = "prime-claw-conversation-guide";
export const CONVERSATION_GUIDE_NAME = "prime-claw-oversee-episode";

export type ConversationOversightRegistration = {
  guideRoot?: string;
};

function projectRoot(cwd: string): string {
  return execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function pluginRoot(options: ConversationOversightRegistration): string {
  return resolve(options.guideRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
}

export function conversationGuideText(options: ConversationOversightRegistration = {}): string {
  return readFileSync(join(pluginRoot(options), "skills", CONVERSATION_GUIDE_NAME, "SKILL.md"), "utf8");
}

export function currentConversationOwnership(ctx: ExtensionContext): EpisodeOwnershipRecord | null {
  let root: string;
  try { root = projectRoot(ctx.cwd); }
  catch { return null; }
  const record = readEpisodeOwnership(root);
  if (!record || record.ownerSessionId !== ctx.sessionManager.getSessionId()) return null;
  return record;
}

export function requireConversationOwnership(
  ctx: ExtensionContext,
  sourceLocation?: string,
): EpisodeOwnershipRecord {
  const record = currentConversationOwnership(ctx);
  if (!record || record.status !== "active") throw new Error("No active episode is owned by this conversation");
  if (sourceLocation && record.sourceLocation !== sourceLocation) {
    throw new Error("Owned episode location does not match the requested folder");
  }
  return record;
}

export function assertConversationPromotionReady(ctx: ExtensionContext, requestedLocation?: string): void {
  const record = readEpisodeOwnership(projectRoot(ctx.cwd));
  if (!record || record.status === "inactive") return;
  const exactOwner = record.ownerSessionId === ctx.sessionManager.getSessionId();
  const exactLocation = !requestedLocation || record.sourceLocation === requestedLocation;
  if (exactOwner && exactLocation) return;
  throw new Error(`Conversation already has non-terminal episode ownership for ${record.sourceLocation}`);
}

export function registerConversationOversight(
  pi: ExtensionAPI,
  options: ConversationOversightRegistration = {},
): void {
  pi.on("session_compact", async (_event, ctx) => {
    const record = currentConversationOwnership(ctx);
    if (!record || record.status !== "active") return;
    await pi.sendMessage({
      customType: CONVERSATION_GUIDE_MESSAGE_TYPE,
      content: conversationGuideText(options),
      display: false,
      details: { sourceLocation: record.sourceLocation, episodeId: record.episodeId },
    }, { triggerTurn: false });
  });
}
