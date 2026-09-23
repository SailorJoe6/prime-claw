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

type SessionHeader = {
  parentSession?: string;
  rlmDepth?: number;
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

function isPristineTopLevelLaunch(event: SessionStartEvent, ctx: ExtensionContext): boolean {
  const header = ctx.sessionManager.getHeader() as SessionHeader | undefined;
  return event.reason === "startup"
    && (header?.rlmDepth ?? 0) === 0
    && !header?.parentSession;
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
  let admittedProfile: string | null = null;

  pi.registerFlag("project-conversation", {
    description: "Assign this new session the identity-bound PROJECT_CONVERSATION role",
    type: "boolean",
    default: false,
  });

  pi.on("session_start", (event: SessionStartEvent, ctx) => {
    const sessionId = ctx.sessionManager.getSessionId();
    const stored = matchingMarker(ctx, sessionId);
    admittedProfile = null;

    // Runtime children inherit extension flags. Only a pristine top-level
    // startup may consume the launch flag and mint a new role marker. Exact
    // markers remain the sole restoration path for existing sessions.
    if (
      isPristineTopLevelLaunch(event, ctx)
      && pi.getFlag("project-conversation") === true
    ) {
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

  // `before_agent_start` errors are logged and ignored by Prime Agent 0.9.5.
  // Admission must therefore fail at the supported input gate, where `handled`
  // skips skill/template expansion and the complete agent/provider run.
  pi.on("input", (_event, ctx) => {
    const sessionId = ctx.sessionManager.getSessionId();
    if (assignedSessionId !== sessionId || !matchingMarker(ctx, sessionId)) return;

    try {
      admittedProfile = readProfile(ctx.cwd);
      return { action: "continue" as const };
    } catch (error) {
      admittedProfile = null;
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`${message}; prompt blocked before model dispatch`, "error");
      return { action: "handled" as const };
    }
  });

  pi.on("before_agent_start", (event, ctx) => {
    const sessionId = ctx.sessionManager.getSessionId();
    if (assignedSessionId !== sessionId || !matchingMarker(ctx, sessionId)) return;

    const profile = admittedProfile;
    admittedProfile = null;
    if (!profile) return;
    return {
      systemPrompt: `${event.systemPrompt}

${profile}`,
    };
  });
}
