// Loaded only by the Docker RPC test. Use the delivered initializer and leave
// its execute arguments (including Prime Agent's own signal) untouched.
import { appendFileSync, readFileSync } from "node:fs";
import http from "node:http";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { fauxAssistantMessage, fauxToolCall, getApiProvider, registerFauxProvider } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import initialize from "/root/.prime/agent/extensions/project-initialization.ts";

export default function operatorMigrationStop(pi: ExtensionAPI) {
  const root = process.env.PRIME_CLAW_STOP_FIXTURE!;
  const record = (name: string, value: unknown) =>
    appendFileSync(join(root, `${name}.jsonl`), `${JSON.stringify(value)}\n`, { mode: 0o600 });

  const provider = "migration-stop-fixture";
  const faux = registerFauxProvider({ provider, models: [{ id: "fixture", reasoning: false }] });
  const api = getApiProvider(faux.api);
  if (!api) throw new Error("Missing bundled faux provider");
  pi.registerProvider(provider, {
    api: faux.api, apiKey: "offline-test", baseUrl: faux.getModel().baseUrl,
    streamSimple: api.streamSimple, models: faux.models,
  });
  const tool = "initialize_prime_claw";
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall(tool, { action: "switch-request", targetProvider: "backlog" }), { stopReason: "toolUse" }),
    fauxAssistantMessage("Inspection complete. Awaiting explicit confirmation."),
    () => {
      const inspection = JSON.parse(readFileSync(join(root, "switch-request.jsonl"), "utf8"));
      return fauxAssistantMessage(fauxToolCall(tool, {
        action: "switch-confirm", targetProvider: "backlog", confirmedSwitch: true,
        expectedSourceRevision: inspection.sourceRevision, actor: "Docker fixture operator",
        semanticPlacement: "Preserve complete native source fields.",
      }), { stopReason: "toolUse" });
    },
  ]);

  initialize({ ...pi, registerTool(definition) {
    pi.registerTool({ ...definition, async execute(...args) {
      const action = (args[1] as { action: string }).action;
      const original = http.request;
      if (action === "switch-confirm") {
        // Only the first native task PUT goes through the fixture relay. It
        // forwards to the owned real browser and holds the downstream response
        // open after native 200. Nothing here sends/handles the operator abort.
        let held = false;
        http.request = function (...requestArgs: any[]) {
          const [url, options] = requestArgs;
          if (typeof url === "string" && /^http:\/\/127\.0\.0\.1:\d+\/api\/tasks(?:\/|$)/.test(url)) {
            record("http", { method: options.method, url });
            if (!held && options.method === "PUT") {
              held = true;
              requestArgs[0] = process.env.PRIME_CLAW_STOP_RELAY!;
              requestArgs[1] = { ...options, headers: { ...options.headers, "x-fixture-native-url": url } };
            }
          }
          return Reflect.apply(original, http, requestArgs);
        };
        syncBuiltinESMExports();
      }
      try {
        const result = await definition.execute(...args);
        // This is the real Promise settling, even if the agent loop has
        // already abandoned its race with that Promise and emitted agent_end.
        record(action, result.details);
        return result;
      } finally {
        if (action === "switch-confirm") {
          http.request = original;
          syncBuiltinESMExports();
        }
      }
    } });
  } });
}
