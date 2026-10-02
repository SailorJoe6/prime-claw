import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * The lean goal/heartbeat protocol is installed through the managed
 * APPEND_SYSTEM.md block. Keep this entry point inert during the POC so apply
 * replaces the previously installed prompt-injecting generation.
 */
export default function goalHeartbeatWorkControl(_pi: ExtensionAPI): void {}
