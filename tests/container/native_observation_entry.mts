/** Synthetic public-interface proof. This is NOT the production handoff path. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createAgentSessionServices, createAgentSessionFromServices, SessionManager,
} from "@earendil-works/pi-coding-agent";

const root = "/tmp/native-entry-proof";
const ownerCwd = join(root, "project"), readerCwd = join(root, "episode");
mkdirSync(ownerCwd, { recursive: true });
const git = (...args: string[]) => execFileSync("git", ["-C", ownerCwd, ...args], { encoding: "utf8" }).trim();
git("init", "-q");
git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "fixture");
git("worktree", "add", "-qb", "episode-proof", readerCwd);
assert.ok(git("worktree", "list", "--porcelain").includes(readerCwd));

const text = (name: string) => `${name}_EARLY_α` + "x".repeat(450000) + `${name}_MIDDLE_β` + "y".repeat(450000) + `${name}_LATE_γ`;
const task = (version: string) => ({
  schemaVersion: 1, kind: "task-view", unknownEnvelope: { explicitNull: null },
  task: {
    id: "SYNTHETIC-62", title: "Synthetic task", status: "In Progress", type: "bug", priority: "p1",
    project: null, assignees: [], reporter: null, labels: [], milestone: null, parentTaskId: null,
    acceptanceCriteriaCompleted: 0, acceptanceCriteriaCount: 1, references: ["REQUIREMENTS.md"],
    modifiedFiles: [], ordinal: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    dueDate: null, isReady: true, path: ".backlog/tasks/synthetic-62.md", description: "Synthetic full contract",
    dependencies: [], dependencyGraph: { root: "SYNTHETIC-62", nodes: [], edges: [] },
    readiness: { isReady: true, isBlocked: false, blockingDependencies: [], missingDependencies: [] },
    documentation: ["docs/synthetic.md"], subtasks: [],
    acceptanceCriteria: [{ index: 1, text: "Synthetic acceptance", checked: false }], definitionOfDone: [],
    implementationPlan: "Read this full native contract", implementationNotes: null,
    comments: [{ id: version, author: "fixture", body: text(version), unknownComment: [null, { native: true }] }],
    finalSummary: null, unknownTask: { nullable: null, nested: [1, false, "unaltered"] },
  },
});
const observation = {
  provider: "backlog", previousProviderRevision: "1".repeat(40), publishedProviderRevision: "2".repeat(40),
  previousTaskEvidence: task("PREVIOUS"), currentTaskEvidence: task("CURRENT"),
  // Raw Beads remains a raw array, not a normalized Backlog-shaped task.
  beads: [{ id: "synthetic-beads", status: "in_progress", design: "native design", notes: null,
    acceptance_criteria: "native acceptance", unknown_native: { present_null: null } }],
  bindings: { owner: "fixture-owner", operation: "fixture-operation", task: "SYNTHETIC-62",
    worktree: readerCwd, branch: "episode-proof", host: null },
  unknownObservation: { unchanged: true },
};
const serialized = JSON.stringify(observation);
assert.ok(serialized.length >= 1700000);
const digest = createHash("sha256").update(serialized).digest("hex");
const rows = (file: string) => existsSync(file)
  ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
const state: any = { observation, references: [], contexts: [], readerToolEnds: [], compactions: [], emitRead: false };
(globalThis as any).__nativeEntryProof = state;

const extension = join(root, "proof-extension.ts");
writeFileSync(extension, `
import assert from "node:assert/strict";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
const state = globalThis.__nativeEntryProof;
export default function proof(pi) {
  pi.registerCommand("capture-entry", { description: "fixture capture", handler: async (arg, ctx) => {
    const data = arg === "deferred" ? { deferred: true } : state.observation;
    const returned = pi.appendEntry("fixture-native-observation", data);
    // No await or latest-type search between append and exact entry targeting.
    const entry = ctx.sessionManager.getLeafEntry();
    assert.equal(returned, undefined);
    assert.equal(entry.type, "custom");
    assert.equal(entry.customType, "fixture-native-observation");
    assert.deepEqual(entry.data, data);
    assert.deepEqual(ctx.sessionManager.getEntry(entry.id), entry);
    assert.equal(ctx.sessionManager.getEntry("not-an-entry"), undefined);
    state.references.push({ sessionId: ctx.sessionManager.getSessionId(),
      sessionFile: ctx.sessionManager.getSessionFile(), entryId: entry.id,
      customType: entry.customType, parentId: entry.parentId });
  }});
  pi.on("tool_execution_end", (event) => {
    if (event.toolName === "ipython") state.readerToolEnds.push({ isError: event.isError, result: event.result });
  });
  pi.on("session_compact", (event) => state.compactions.push({ hasEntry: !!event.compactionEntry }));
  pi.registerProvider("entry-proof", { baseUrl: "x", apiKey: "synthetic", api: "entry-proof",
    streamSimple(model, context) {
      state.contexts.push({ model: model.id, text: JSON.stringify(context.messages ?? []) });
      const stream = createAssistantMessageEventStream();
      queueMicrotask(() => {
        const usage = { input: 100, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 101,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
        const toolCall = model.id === "reader" && state.emitRead
          ? { type: "toolCall", id: "read-" + state.readerToolEnds.length, name: "ipython", arguments: { code: state.pythonCode } }
          : undefined;
        state.emitRead = false;
        const message = { role: "assistant", content: toolCall ? [toolCall] : [{ type: "text", text: "fixture complete" }],
          api: model.api, provider: model.provider, model: model.id, usage,
          stopReason: toolCall ? "toolUse" : "stop", timestamp: Date.now() };
        stream.push({ type: "start", partial: message });
        if (toolCall) {
          stream.push({ type: "toolcall_start", contentIndex: 0, partial: message });
          stream.push({ type: "toolcall_end", contentIndex: 0, toolCall, partial: message });
        }
        stream.push({ type: "done", reason: message.stopReason, message });
        stream.end();
      });
      return stream;
    }, models: ["writer", "reader"].map((id) => ({ id, name: id, reasoning: false, input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 1000 })) });
}`);

async function make(cwd: string, modelId: string, manager: any) {
  const agentDir = join(root, modelId + "-agent");
  mkdirSync(agentDir, { recursive: true });
  const services = await createAgentSessionServices({ cwd, agentDir, noBuiltinHerdrReporter: true,
    telemetryDisabled: true, resourceLoaderOptions: { additionalExtensionPaths: [extension],
      noExtensions: true, noSkills: true, noPromptTemplates: true, noContextFiles: true, noThemes: true } });
  assert.deepEqual(services.resourceLoader.getExtensions().errors, []);
  const model = services.modelRegistry.find("entry-proof", modelId);
  assert.ok(model);
  const made = await createAgentSessionFromServices({ services, sessionManager: manager, model,
    thinkingLevel: "off", prewarmIpythonKernel: false, telemetryDisabled: true });
  await made.session.bindExtensions({});
  made.session.setActiveToolsByName(modelId === "reader" ? ["ipython"] : []);
  return made.session;
}

let writer: any, reader: any;
try {
  const writerManager = SessionManager.create(ownerCwd, join(root, "owner-sessions"));
  writer = await make(ownerCwd, "writer", writerManager);
  await writer.prompt("/capture-entry deferred");
  const deferredRef = state.references[0];
  assert.equal(state.contexts.length, 0, "append must not start a model turn");
  assert.equal(rows(deferredRef.sessionFile).some((row) => row.id === deferredRef.entryId), false);
  await writer.prompt("Seed one real native assistant response.");
  assert.equal(rows(deferredRef.sessionFile).filter((row) => row.id === deferredRef.entryId).length, 1);
  const contextsBefore = state.contexts.length;
  await writer.prompt("/capture-entry observation");
  assert.equal(state.contexts.length, contextsBefore);
  const ref = state.references[1];
  const persisted = rows(ref.sessionFile);
  assert.equal(persisted[0].type, "session");
  assert.equal(persisted[0].id, ref.sessionId);
  const exact = persisted.filter((row) => row.id === ref.entryId);
  assert.equal(exact.length, 1);
  assert.equal(exact[0].parentId, ref.parentId);
  assert.deepEqual(exact[0].data, observation);
  // A later same-type custom entry must not change what this reference selects.
  await writer.prompt("/capture-entry deferred");

  reader = await make(readerCwd, "reader", SessionManager.create(readerCwd, join(root, "reader-sessions")));
  const readerId = reader.sessionManager.getSessionId();
  state.pythonCode = `from pathlib import Path
import json, hashlib
assert str(Path.cwd()) == ${JSON.stringify(readerCwd)}
native_reference = json.loads(${JSON.stringify(JSON.stringify(ref))})
def load_exact(reference):
    with Path(reference['sessionFile']).open(encoding='utf-8') as journal:
        header = json.loads(next(journal))
        assert header['type'] == 'session' and header['id'] == reference['sessionId']
        matches = [json.loads(line) for line in journal if line.strip()]
    matches = [entry for entry in matches if entry.get('id') == reference['entryId']]
    if len(matches) != 1:
        raise LookupError('exact native entry unavailable')
    entry = matches[0]
    assert entry['type'] == 'custom' and entry['customType'] == reference['customType']
    assert entry['parentId'] == reference['parentId']
    return entry['data']
observation = load_exact(native_reference)
encoded = json.dumps(observation, ensure_ascii=False, separators=(',', ':'))
assert hashlib.sha256(encoded.encode()).hexdigest() == ${JSON.stringify(digest)}
assert observation['currentTaskEvidence']['task']['unknownTask']['nullable'] is None
assert 'genuinely_absent' not in observation['currentTaskEvidence']['task']
assert observation['beads'][0]['design'] == 'native design'
assert observation['beads'][0]['unknown_native']['present_null'] is None
assert 'assignee' not in observation['beads'][0]
# Complete traversal with bounded pieces, including huge individual comments.
# This proves retrieval mechanics, not LLM semantic inspection of these pieces.
structure = []
text_pieces = 0
def inspect_pieces(value, path=()):
    global text_pieces
    structure.append((path, type(value).__name__))
    if isinstance(value, dict):
        for key, child in value.items(): inspect_pieces(child, path + (key,))
    elif isinstance(value, list):
        for index, child in enumerate(value): inspect_pieces(child, path + (index,))
    elif isinstance(value, str):
        pieces = [value[start:start+4096] for start in range(0, len(value), 4096)]
        assert all(len(piece) <= 4096 for piece in pieces)
        assert ''.join(pieces) == value
        text_pieces += len(pieces)
inspect_pieces(observation)
for key, sentinel in [('previousTaskEvidence', 'PREVIOUS'), ('currentTaskEvidence', 'CURRENT')]:
    body = observation[key]['task']['comments'][0]['body']
    assert body.startswith(sentinel + '_EARLY_α')
    assert sentinel + '_MIDDLE_β' in body[449900:450100]
    assert body.endswith(sentinel + '_LATE_γ')
for override, error in [({'entryId': 'missing'}, LookupError), ({'sessionFile': '/tmp/not-present-native-entry'}, FileNotFoundError)]:
    try:
        load_exact(dict(native_reference, **override))
    except error:
        pass
    else:
        raise AssertionError('unavailable exact evidence must stop')
print('ENTRY_READ_OK', len(encoded), len(structure), text_pieces)
`;
  state.emitRead = true;
  await reader.prompt("Read the supplied exact native observation reference before any handoff dispatch.");
  assert.equal(state.readerToolEnds.length, 1);
  assert.equal(state.readerToolEnds[0].isError, false, JSON.stringify(state.readerToolEnds));
  assert.ok(JSON.stringify(state.readerToolEnds[0]).includes("ENTRY_READ_OK"));

  await writer.disposeAsync();
  writer = undefined;
  const reopenedManager = SessionManager.open(ref.sessionFile);
  assert.deepEqual(reopenedManager.getEntry(ref.entryId)?.data, observation);
  assert.equal(reopenedManager.getSessionId(), ref.sessionId);
  writer = await make(ownerCwd, "writer", reopenedManager);
  for (let i = 0; i < 4; i++) await writer.prompt(`PADDING_${i} ` + "z".repeat(30000));
  await writer.compact("Synthetic custom-entry exclusion proof; keep only the ordinary messages.");
  assert.equal(state.compactions.length, 1);
  assert.equal(state.compactions[0].hasEntry, true);
  assert.equal(writer.sessionManager.getSessionId(), ref.sessionId);
  assert.deepEqual(writer.sessionManager.getEntry(ref.entryId)?.data, observation);
  const afterCompact = SessionManager.open(ref.sessionFile);
  assert.deepEqual(afterCompact.getEntry(ref.entryId)?.data, observation);
  state.emitRead = true;
  await reader.prompt("Read that same exact reference again after owner reopen and native SDK compaction.");
  assert.equal(reader.sessionManager.getSessionId(), readerId);
  assert.equal(state.readerToolEnds.length, 2);
  for (const end of state.readerToolEnds) {
    assert.equal(end.isError, false, JSON.stringify(end));
    assert.ok(JSON.stringify(end).includes("ENTRY_READ_OK"));
    assert.ok(JSON.stringify(end).length < 3000);
  }
  const customPayloadInModelContext = state.contexts.some((context: any) =>
    context.text.includes("PREVIOUS_EARLY_α") || context.text.includes("CURRENT_LATE_γ"));
  assert.equal(customPayloadInModelContext, false);
  console.log("NATIVE_ENTRY_RESULT=" + JSON.stringify({ preAssistantDeferred: true,
    appendReturnedVoid: true, payloadCharacters: serialized.length, exactEntryCount: exact.length,
    readerToolSuccesses: state.readerToolEnds.length, compactionCompleted: state.compactions.length,
    customPayloadInModelContext, reopenedExactEntry: true }));
} finally {
  await reader?.disposeAsync();
  await writer?.disposeAsync();
  delete (globalThis as any).__nativeEntryProof;
}
