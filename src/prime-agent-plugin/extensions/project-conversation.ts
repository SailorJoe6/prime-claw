import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  applyConversationContext,
  clearOversightRuntimeReady,
  markOversightRuntimeReady,
} from "../extension-support/conversation-oversight.ts";

/**
 * Universal CONVERSATION identity readiness and exact-session oversight mode.
 * Identity comes from managed APPEND_SYSTEM.md. This extension owns no startup
 * prompt, phase command, semantic completion decision, or active-tool changes.
 */
export default function projectConversation(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    markOversightRuntimeReady(ctx.sessionManager.getSessionId());
  });
  pi.on("session_shutdown", (_event, ctx) => {
    clearOversightRuntimeReady(ctx.sessionManager.getSessionId());
  });
  pi.on("context", (event, ctx) => applyConversationContext(event, ctx));
}
