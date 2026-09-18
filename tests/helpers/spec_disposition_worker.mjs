import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import specificationEpisodes from "../../.prime/agent/extensions/specification-episodes.ts";

const execFileAsync = promisify(execFile);
const [cwd, sessionId, requestId, slug, startAtRaw] = process.argv.slice(2);
const startAt = Number(startAtRaw);
if (Number.isFinite(startAt) && Date.now() < startAt) {
  await new Promise((resolve) => setTimeout(resolve, startAt - Date.now()));
}

const tools = new Map();
const pi = {
  registerCommand() {},
  registerTool(definition) { tools.set(definition.name, definition); },
  sendUserMessage() {},
  async exec(command, args, options = {}) {
    try {
      const result = await execFileAsync(command, args, { encoding: "utf8", ...options });
      return { stdout: result.stdout, stderr: result.stderr, code: 0, killed: false };
    } catch (error) {
      return {
        stdout: error.stdout ?? "",
        stderr: error.stderr ?? error.message,
        code: typeof error.code === "number" ? error.code : 1,
        killed: Boolean(error.killed),
      };
    }
  },
};
specificationEpisodes(pi);
const sessionFile = join(cwd, ".git", "test-sessions", `${sessionId}.jsonl`);
mkdirSync(dirname(sessionFile), { recursive: true });
writeFileSync(sessionFile, `${JSON.stringify({ type: "session", version: 3, id: sessionId, cwd })}\n`);
const ctx = {
  cwd,
  sessionManager: {
    getSessionId() { return sessionId; },
    getSessionFile() { return sessionFile; },
    getCwd() { return cwd; },
  },
  ui: { notify() {} },
};
const result = await tools.get("spec_disposition").execute("worker", {
  request_id: requestId,
  confirmed_by_operator: true,
  decision: { kind: "future", slug },
  documents: {
    specification_markdown: `# Specification\n\n${slug}\n`,
    requirements_markdown: `# Requirements\n\nR-${slug}\n`,
    decisions_markdown: `# Decisions\n\nD-${slug}\n`,
  },
}, undefined, undefined, ctx);
process.stdout.write(`${JSON.stringify(result.details)}\n`);
