import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const ROLE = "PROJECT_CONVERSATION";
const MARKER_TYPE = "prime-claw-project-conversation";
const MARKER_VERSION = 1;
const PROFILE_PATH = join(".prime", "agent", "profiles", "project-conversation.md");

type RoleMarker = {
  version: typeof MARKER_VERSION;
  role: typeof ROLE;
  sessionId: string;
};

type SessionStartEvent = {
  reason: "startup" | "reload" | "new" | "resume" | "fork";
};

function matchingMarker(
  ctx: ExtensionContext,
  sessionId: string,
): RoleMarker | null {
  const entry = ctx.sessionManager.getEntries()
    .filter((candidate: { type?: string; customType?: string }) =>
      candidate.type === "custom" && candidate.customType === MARKER_TYPE)
    .pop() as { data?: Partial<RoleMarker> } | undefined;
  const data = entry?.data;
  if (
    data?.version !== MARKER_VERSION ||
    data.role !== ROLE ||
    data.sessionId !== sessionId
  ) return null;
  return data as RoleMarker;
}

function readProfile(cwd: string): string {
  const path = join(cwd, PROFILE_PATH);
  try {
    const profile = readFileSync(path, "utf8").trim();
    if (!profile) throw new Error("profile is empty");
    return profile;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `project-conversation: assigned profile unavailable at ${path}: ${reason}`,
    );
  }
}

export default function projectConversation(pi: ExtensionAPI): void {
  let assignedSessionId: string | null = null;

  pi.registerFlag("project-conversation", {
    description: "Assign this new session the identity-bound PROJECT_CONVERSATION role",
    type: "boolean",
    default: false,
  });

  pi.on("session_start", (event: SessionStartEvent, ctx) => {
    const sessionId = ctx.sessionManager.getSessionId();
    const stored = matchingMarker(ctx, sessionId);

    // A launch flag is consumed only at process startup. Session reload/resume
    // restores an exact marker; new or forked identities never inherit the role.
    if (event.reason === "startup" && pi.getFlag("project-conversation") === true) {
      if (!stored) {
        pi.appendEntry(MARKER_TYPE, {
          version: MARKER_VERSION,
          role: ROLE,
          sessionId,
        } satisfies RoleMarker);
      }
      assignedSessionId = sessionId;
      return;
    }

    assignedSessionId = stored ? sessionId : null;
  });

  pi.on("before_agent_start", (event, ctx) => {
    const sessionId = ctx.sessionManager.getSessionId();
    if (assignedSessionId !== sessionId || !matchingMarker(ctx, sessionId)) return;

    const profile = readProfile(ctx.cwd);
    return {
      systemPrompt: `${event.systemPrompt}

${profile}`,
    };
  });
}
