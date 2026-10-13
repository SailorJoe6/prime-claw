import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  isLegacyEpisodeOwnership,
  readEpisodeOwnership,
  type EpisodeOwnershipRecord,
} from "./episode-ownership.ts";
import { resolveNearestProjectRoot } from "./project-initialization.ts";

export const CONVERSATION_GUIDE_MESSAGE_TYPE = "prime-claw-conversation-guide";
export const CONVERSATION_GUIDE_NAME = "prime-claw-oversee-episode";

export type ConversationOversightRegistration = {
  guideRoot?: string;
};

function pluginRoot(options: ConversationOversightRegistration): string {
  return resolve(options.guideRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
}

export function conversationGuideText(options: ConversationOversightRegistration = {}): string {
  return readFileSync(join(pluginRoot(options), "skills", CONVERSATION_GUIDE_NAME, "SKILL.md"), "utf8");
}

export function currentConversationOwnership(ctx: ExtensionContext): EpisodeOwnershipRecord | null {
  let root: string;
  try { root = resolveNearestProjectRoot(ctx.cwd).root; }
  catch { return null; }
  const record = readEpisodeOwnership(root);
  if (!record || record.ownerSessionId !== ctx.sessionManager.getSessionId()) return null;
  return record;
}


function ownershipIdentity(record: EpisodeOwnershipRecord): string {
  return isLegacyEpisodeOwnership(record) ? record.sourceLocation : record.taskId;
}

export function assertConversationPromotionReady(ctx: ExtensionContext, requestedLocation?: string): void {
  const record = readEpisodeOwnership(resolveNearestProjectRoot(ctx.cwd).root);
  if (!record || record.status === "inactive") return;
  const exactOwner = record.ownerSessionId === ctx.sessionManager.getSessionId();
  const exactLocation = !requestedLocation || (isLegacyEpisodeOwnership(record) && record.sourceLocation === requestedLocation);
  if (exactOwner && exactLocation) return;
  throw new Error(`Conversation already has non-terminal episode ownership for ${ownershipIdentity(record)}`);
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
      details: {
        ...(isLegacyEpisodeOwnership(record) ? { sourceLocation: record.sourceLocation } : { taskId: record.taskId }),
        episodeId: record.episodeId,
      },
    }, { triggerTurn: false });
  });
}
