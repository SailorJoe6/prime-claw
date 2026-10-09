import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const GOAL_CONTEXT_TYPE = "goal_context";
const CONFIG_PATH = join(".agents", "skills", "goals-and-heartbeats", "CONTINUATION.md");
const MAX_WINDOW_SECONDS = 3600;
const MAX_RAPID_CONTINUATIONS = 100;
const MAX_CONFIG_BYTES = 16 * 1024;

type GoalContinuationDetails = {
  kind: "continuation";
  goalId: string;
  continuationsUsed: number;
};

type Observation = {
  goalId: string;
  lastContinuationsUsed: number;
  lastContinuationAt: number;
  rapidContinuationCount: number;
  nudgeCurrentContinuation: boolean;
  reminder?: string;
};

type NudgeConfig = {
  minimumRapidContinuations: number;
  windowMs: number;
  reminder: string;
};

type Dependencies = {
  now?: () => number;
};

function parsePositiveInteger(value: string): number | null {
  if (!/^[1-9][0-9]*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function loadGoalContinuationNudge(cwd: string): NudgeConfig | null {
  const path = join(cwd, CONFIG_PATH);
  if (!existsSync(path)) return null;

  let source: string;
  try {
    const metadata = lstatSync(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_CONFIG_BYTES) return null;
    source = readFileSync(path, "utf8");
    if (Buffer.byteLength(source, "utf8") > MAX_CONFIG_BYTES) return null;
  } catch {
    return null;
  }

  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!match) return null;

  const values = new Map<string, string>();
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const field = /^([a-z_]+):\s*(.*?)\s*$/.exec(line);
    if (!field || values.has(field[1])) return null;
    values.set(field[1], field[2]);
  }
  if (
    values.size !== 2
    || !values.has("minimum_rapid_continuations")
    || !values.has("window_seconds")
  ) return null;

  const minimumRapidContinuations = parsePositiveInteger(values.get("minimum_rapid_continuations")!);
  const windowSeconds = parsePositiveInteger(values.get("window_seconds")!);
  const reminder = match[2].trim();
  if (
    minimumRapidContinuations === null
    || minimumRapidContinuations < 2
    || minimumRapidContinuations > MAX_RAPID_CONTINUATIONS
    || windowSeconds === null
    || windowSeconds > MAX_WINDOW_SECONDS
    || !reminder
  ) return null;

  return {
    minimumRapidContinuations,
    windowMs: windowSeconds * 1000,
    reminder,
  };
}

function continuationDetails(message: any): GoalContinuationDetails | null {
  if (message?.role !== "custom" || message.customType !== GOAL_CONTEXT_TYPE) return null;
  const details = message.details;
  if (
    details?.kind !== "continuation"
    || typeof details.goalId !== "string"
    || !details.goalId
    || !Number.isSafeInteger(details.continuationsUsed)
    || details.continuationsUsed < 1
  ) return null;
  return details as GoalContinuationDetails;
}

function latestInboundIndex(messages: any[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user" || messages[index]?.role === "custom") return index;
  }
  return -1;
}

function appendReminder(message: any, reminder: string): any | null {
  if (typeof message.content === "string") {
    return { ...message, content: `${message.content}\n\n${reminder}` };
  }
  if (!Array.isArray(message.content)) return null;

  const textIndex = message.content.findIndex((part: any) => part?.type === "text" && typeof part.text === "string");
  if (textIndex < 0) return null;
  const content = [...message.content];
  content[textIndex] = { ...content[textIndex], text: `${content[textIndex].text}\n\n${reminder}` };
  return { ...message, content };
}

export function createGoalContinuationNudgeExtension(dependencies: Dependencies = {}) {
  const now = dependencies.now ?? Date.now;

  return function goalContinuationNudge(pi: ExtensionAPI): void {
    const observations = new Map<string, Observation>();

    const clear = (_event: unknown, ctx: any) => {
      observations.delete(ctx.sessionManager.getSessionId());
    };
    pi.on("session_start", clear);
    pi.on("session_tree", clear);
    pi.on("session_shutdown", clear);

    pi.on("context", (event: any, ctx: any) => {
      const sessionId = ctx.sessionManager.getSessionId();
      const index = latestInboundIndex(event.messages);
      if (index < 0) return;

      const details = continuationDetails(event.messages[index]);
      if (!details) {
        observations.delete(sessionId);
        return;
      }

      const previous = observations.get(sessionId);
      if (
        previous
        && previous.goalId === details.goalId
        && previous.lastContinuationsUsed === details.continuationsUsed
      ) {
        if (!previous.nudgeCurrentContinuation || !previous.reminder) return;
        const updated = appendReminder(event.messages[index], previous.reminder);
        if (!updated) return;
        const messages = [...event.messages];
        messages[index] = updated;
        return { messages };
      }

      const observedAt = now();
      const config = loadGoalContinuationNudge(ctx.cwd);
      const isRapidSuccessor = Boolean(
        previous
        && config
        && previous.goalId === details.goalId
        && details.continuationsUsed > previous.lastContinuationsUsed
        && observedAt - previous.lastContinuationAt >= 0
        && observedAt - previous.lastContinuationAt <= config.windowMs,
      );
      const rapidContinuationCount = isRapidSuccessor
        ? previous!.rapidContinuationCount + 1
        : 1;
      const nudgeCurrentContinuation = Boolean(
        config && rapidContinuationCount >= config.minimumRapidContinuations,
      );
      const observation: Observation = {
        goalId: details.goalId,
        lastContinuationsUsed: details.continuationsUsed,
        lastContinuationAt: observedAt,
        rapidContinuationCount,
        nudgeCurrentContinuation,
        reminder: nudgeCurrentContinuation ? config!.reminder : undefined,
      };
      observations.set(sessionId, observation);

      if (!observation.nudgeCurrentContinuation || !observation.reminder) return;
      const updated = appendReminder(event.messages[index], observation.reminder);
      if (!updated) return;
      const messages = [...event.messages];
      messages[index] = updated;
      return { messages };
    });
  };
}

export default createGoalContinuationNudgeExtension();
