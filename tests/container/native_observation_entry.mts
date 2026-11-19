/** Synthetic public-entry proof plus SDK-adapted candidate task handoff/REPL proof.
 * Native execution is real; provider/history facts and the daemon request adapter are synthetic. */
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
git("branch", "-M", "main");
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
const state: any = { observation, references: [], contexts: [], readerToolEnds: [], compactions: [], emitRead: false, chainDependencies: {} };
(globalThis as any).__nativeEntryProof = state;

const extension = join(root, "proof-extension.ts");
writeFileSync(extension, `
import assert from "node:assert/strict";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { retainTaskHandoffObservation } from "/candidate/extension-support/task-handoff-observation.ts";
import { createReviewedPlanExtension } from "/candidate/extensions/reviewed-plan.ts";
const state = globalThis.__nativeEntryProof;
export default function proof(pi) {
  createReviewedPlanExtension(state.chainDependencies)(pi);
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
  pi.registerCommand("capture-production", { description: "production public-entry helper", handler: async (_arg, ctx) => {
    state.productionReference = retainTaskHandoffObservation(ctx, state.productionRecord, "reader-route",
      state.observation, state.sessionObservation, (type, data) => pi.appendEntry(type, data));
  }});
  pi.on("tool_execution_end", (event) => {
    if (event.toolName === "ipython") state.readerToolEnds.push({ isError: event.isError, result: event.result });
    if (event.toolName === "handoff_task_episode") state.handoffToolEnd = { isError: event.isError, result: event.result };
  });
  pi.on("session_compact", (event) => state.compactions.push({ hasEntry: !!event.compactionEntry }));
  pi.registerProvider("entry-proof", { baseUrl: "x", apiKey: "synthetic", api: "entry-proof",
    streamSimple(model, context) {
      state.contexts.push({ model: model.id, text: JSON.stringify(context.messages ?? []) });
      const stream = createAssistantMessageEventStream();
      queueMicrotask(async () => {
        if (model.id === "reader" && state.chainActive && !state.chainReleased) await state.chainQueued;
        const usage = { input: 100, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 101,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
        const toolCall = state.chainTool?.(model, context) ?? (model.id === "reader" && state.emitRead
          ? { type: "toolCall", id: "read-" + state.readerToolEnds.length, name: "ipython", arguments: { code: state.pythonCode } }
          : undefined);
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
      additionalSkillPaths: ["/opt/prime-agent/packages/coding-agent/skills/compact"],
      noExtensions: true, noSkills: true, noPromptTemplates: true, noContextFiles: true, noThemes: true } });
  assert.deepEqual(services.resourceLoader.getExtensions().errors, []);
  const model = services.modelRegistry.find("entry-proof", modelId);
  assert.ok(model);
  const made = await createAgentSessionFromServices({ services, sessionManager: manager, model,
    thinkingLevel: "off", prewarmIpythonKernel: false, telemetryDisabled: true, includeCompactSkill: true });
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
  await reader.prompt("Seed the selected reader's actual native session file.");
  state.productionRecord = { version: 2, status: "active", provider: "backlog", engine: "local",
    ownerSessionId: writer.sessionManager.getSessionId(), operationId: "synthetic-operation",
    taskId: "SYNTHETIC-62", episodeId: readerId, episodeSessionFile: reader.sessionManager.getSessionFile(),
    worktree: readerCwd, branch: "episode-proof", baseRef: git("rev-parse", "HEAD"), integrationBranch: "main" };
  state.sessionObservation = { session: { sessionId: readerId, cwd: readerCwd, unknown: null },
    state: { sessionActions: { followUps: [{ message: "QUEUED_EARLY_α" + "q".repeat(900000) + "QUEUED_LATE_γ" }] } } };
  await writer.prompt("/capture-production");
  assert.ok(state.productionReference?.entrySha256);
  state.pythonCode = `from pathlib import Path
import json, hashlib
assert str(Path.cwd()) == ${JSON.stringify(readerCwd)}
native_reference = json.loads(${JSON.stringify(JSON.stringify(ref))})
def load_exact(reference):
    with Path(reference['sessionFile']).open(encoding='utf-8') as journal:
        header = json.loads(next(journal))
        assert header['type'] == 'session' and header['id'] == reference['sessionId']
        matches = [(line.removesuffix(chr(10)), json.loads(line)) for line in journal if line.strip()]
    matches = [(line, entry) for line, entry in matches if entry.get('id') == reference['entryId']]
    if len(matches) != 1:
        raise LookupError('exact native entry unavailable')
    line, entry = matches[0]
    if 'entrySha256' in reference:
        assert hashlib.sha256(line.encode('utf-8')).hexdigest() == reference['entrySha256']
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
production_reference = json.loads(${JSON.stringify(JSON.stringify(state.productionReference))})
production_data = load_exact(production_reference)
assert production_data['bindings'] == production_reference['bindings']
assert production_data['bindings']['episodeId'] == ${JSON.stringify(readerId)}
assert production_data['providerTaskObservation'] == observation
queued = production_data['episodeSessionObservation']['state']['sessionActions']['followUps'][0]['message']
assert queued.startswith('QUEUED_EARLY_α') and queued.endswith('QUEUED_LATE_γ') and len(queued) > 900000
inspect_pieces(production_data)
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
    customPayloadInModelContext, reopenedExactEntry: true,
    productionHelperExactRead: true, queuedPromptCharacters: 900000 }));

  // A separate native Episode compaction proof. No driver compact()/continue(),
  // replacement execute, hook dispatch, daemon or socket simulation is used.
  // The adapter maps the candidate publisher to the same public native entry
  // and PromptOptions used by the supported daemon. Socket transport stays a
  // separately tested boundary; this is NOT live task publication/activation.
  const { PrimeSessionPublisher } = await import("/candidate/extension-support/spec-episode.ts");
  const copyWorkflow = (relative: string, source: string) => {
    const target = join(readerCwd, relative);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, readFileSync(source));
  };
  copyWorkflow(".prime-claw/workflows/handoff.md", "/candidate/workflows/handoff.md");
  copyWorkflow(".agents/skills/execute/SKILL.md", "/candidate/skills/project-templates/execute.md");
  const prior = task("PREVIOUS"), current = task("CURRENT");
  current.task.description = "Sum every integer in unknownTask.workInputs and report the concrete total after compaction.";
  (current.task.unknownTask as any).workInputs = [17, 25, 8];
  let record: any = { ...state.productionRecord, operationId: "native-chain-operation",
    taskPath: current.task.path, providerRevision: "1".repeat(40), taskEvidence: prior,
    head: git("rev-parse", "HEAD"), createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    episodeActiveSessionId: "reader-route" };
  const originalRecord = structuredClone(record);
  const events: any[] = [], requests: any[] = [], completed: any[] = [];
  let releaseChain!: () => void;
  state.chainQueued = new Promise<void>((resolve) => { releaseChain = resolve; });
  const sessionSummary = () => ({ id: "reader-route", activeSessionId: "reader-route",
    sessionId: readerId, sessionFile: reader.sessionManager.getSessionFile(), cwd: readerCwd,
    isSessionActive: reader.isStreaming, isStreaming: reader.isStreaming, isCompacting: reader.isCompacting });
  const unsubscribe = reader.subscribe((event: any) => {
    if (event.type === "message_start" && event.message.role === "user") {
      const content = event.message.content;
      const text = typeof content === "string" ? content : content.map((part: any) => part.text ?? "").join("\n");
      if (text.includes('<skill name="handoff"') || text.includes('<skill name="execute"')) {
        events.push({ type: text.includes('<skill name="execute"') ? "execute-start" : "handoff-start" });
      }
    }
    if (event.type === "compaction_end") {
      completed.push({ reason: event.reason, hasResult: !!event.result, aborted: event.aborted,
        error: event.error ?? null });
      events.push({ type: "compaction-end", reason: event.reason });
    }
  });
  const publisher = new PrimeSessionPublisher({
    async request(command: any) {
      if (command.type === "list") return { success: true, data: { sessions: [sessionSummary()] } };
      assert.equal(command.activeSessionId, "reader-route");
      if (command.type === "get_state") return { success: true, data: {
        ...sessionSummary(), sessionActions: reader.getSessionActionSnapshot(),
      } };
      assert.equal(command.type, "prompt");
      requests.push(structuredClone(command));
      assert.ok(requests.length <= 2, "no extra assignment or resend");
      // Exact supported daemon -> AgentSession mapping (a1faacd5 daemon-mode).
      await reader.promptUntilAccepted(command.message, {
        source: command.source, streamingBehavior: command.streamingBehavior,
        expandPromptTemplates: command.expandPromptTemplates,
        queueIfBusy: command.queueIfBusy ?? command.streamingBehavior !== undefined,
        resumeIfIdle: command.streamingBehavior !== undefined,
        skipInputHandlers: command.expandPromptTemplates === false ? true : undefined,
      });
      events.push({ type: requests.length === 1 ? "first-admitted" : "followUp-admitted" });
      if (requests.length === 2) {
        assert.equal(reader.getSessionActionSnapshot().queuedCount, 1);
        assert.deepEqual(reader.getFollowUpMessages(), [command.message]);
        state.chainReleased = true;
        releaseChain();
      }
      return { success: true, data: {} };
    }, close() {},
  } as any);
  const taskRunner = { run(program: string, args: string[], options: any = {}) {
    if (program === "backlog") {
      assert.deepEqual(args, ["task", "view", "--json", "--", "SYNTHETIC-62"]);
      assert.equal(options.cwd, readerCwd);
      return { status: 0, stdout: JSON.stringify(current), stderr: "" };
    }
    assert.equal(program, "git");
    try { return { status: 0, stdout: execFileSync(program, args, { cwd: options.cwd, encoding: "utf8" }), stderr: "" }; }
    catch (error: any) { return { status: error.status, stdout: error.stdout ?? "", stderr: error.stderr ?? "" }; }
  } };
  Object.assign(state.chainDependencies, { publisher, taskRunner,
    ownership: { read(_root: string, owner: string) { return !owner || owner === record.ownerSessionId ? record : null; },
      write(_root: string, value: any) { events.push({ type: "factual-callback" }); record = value; } },
    prepareEpisodeTaskHistory: () => ({ status: "prepared", head: "2".repeat(40) }),
  });
  let handoffCalls = 0, compactCalls = 0, workCalls = 0;
  const cell = (id: string, code: string) => ({ type: "toolCall", id, name: "ipython", arguments: { code } });
  state.chainTool = (model: any, context: any) => {
    const users = context.messages.filter((m: any) => m.role === "user");
    const content = users.at(-1)?.content;
    const text = typeof content === "string" ? content : (content ?? []).map((part: any) => part.text ?? "").join("\n");
    if (model.id === "writer" && text.includes("BEGIN_NATIVE_CHAIN") && handoffCalls === 0) {
      handoffCalls++;
      return { type: "toolCall", id: "candidate-task-handoff", name: "handoff_task_episode",
        arguments: { taskId: "SYNTHETIC-62", guidance: "Synthetic sum work; one native compaction and the sole canonical execute." } };
    }
    const extract = /<task-handoff-observation-reference>\n(.*?)\n<\/task-handoff-observation-reference>/;
    const match = text.match(extract);
    if (model.id !== "reader" || !match) return undefined;
    // The model receives the candidate-generated reference, never the raw history.
    const reference = JSON.parse(match[1]);
    if (text.includes('<skill name="handoff"') && compactCalls === 0) {
      compactCalls++;
      return cell("episode-native-compact", `import os
chain_reference = json.loads(${JSON.stringify(JSON.stringify(reference))})
chain_data = load_exact(chain_reference)
assert chain_data['bindings'] == chain_reference['bindings']
chain_provider = chain_data['providerTaskObservation']
chain_current = chain_provider['currentTaskEvidence']['task']
chain_previous = chain_provider['previousTaskEvidence']['task']
assert chain_current['id'] == 'SYNTHETIC-62' and chain_current['status'] == 'In Progress'
assert chain_current['unknownTask']['nullable'] is None and 'genuinely_absent' not in chain_current
assert chain_provider['publishedProviderRevision'] == '2' * 40
inspect_pieces(chain_data)
chain_work = {'pid': os.getpid(), 'cwd': str(Path.cwd()), 'inputs': list(chain_current['unknownTask']['workInputs']), 'completed': False}
chain_work_identity = id(chain_work)
print('BOUNDED_NATIVE_CONTRACT', chain_current['description'], chain_current['implementationPlan'], chain_current['acceptanceCriteria'], sorted(chain_current), len(chain_current['comments'][0]['body']))
chain_compact_result = await compact.run('Keep the native observation reference and the sum-work contract. Full raw evidence and chain_work stay in the REPL; do not inline history. The sole canonical execute is already queued.')
assert chain_compact_result.get('scheduled') is True, chain_compact_result
print('EPISODE_COMPACTION_REQUESTED', chain_compact_result)
`);
    }
    if (text.includes('<skill name="execute"') && workCalls === 0) {
      workCalls++;
      assert.equal(completed.length, 1, "execute must follow actual compaction completion");
      return cell("episode-substantive-work", `assert chain_compact_result['scheduled'] is True
assert os.getpid() == chain_work['pid'] and str(Path.cwd()) == chain_work['cwd']
assert id(chain_work) == chain_work_identity and not chain_work['completed']
assert load_exact(chain_reference) == chain_data
assert load_exact(native_reference) == observation
assert observation['beads'][0]['unknown_native']['present_null'] is None and 'assignee' not in observation['beads'][0]
assert load_exact(production_reference) == production_data
inspect_pieces(chain_data)
chain_work['total'] = sum(chain_work['inputs'])
chain_work['completed'] = True
assert chain_work['total'] == 50
print('SUBSTANTIVE_AFTER_COMPACT', {'task': chain_current['id'], 'total': chain_work['total'], 'completed': chain_work['completed'], 'same_kernel_and_object': True, 'payload_characters': len(encoded), 'bounded_pieces': text_pieces})
`);
    }
    return undefined;
  };
  for (let i = 0; i < 4; i++) await reader.prompt(`READER_PADDING_${i} ` + "r".repeat(30000));
  writer.setActiveToolsByName(["handoff_task_episode"]);
  const readerCompactionsBefore = rows(reader.sessionManager.getSessionFile()).filter((row) => row.type === "compaction").length;
  state.chainActive = true;
  await writer.prompt("BEGIN_NATIVE_CHAIN: perform the one existing candidate task handoff tool.");
  await reader.waitForHeadlessIdle();
  unsubscribe();
  assert.equal(state.handoffToolEnd?.isError, false, JSON.stringify(state.handoffToolEnd));
  const delivery = state.handoffToolEnd.result.details.delivery;
  assert.equal(delivery.first.outcome, "admitted");
  assert.equal(delivery.callback, "completed");
  assert.equal(delivery.followUp.outcome, "admitted");
  assert.equal(handoffCalls, 1);
  assert.equal(compactCalls, 1);
  assert.equal(workCalls, 1);
  assert.equal(requests.length, 2);
  assert.equal(events.filter((event) => event.type === "handoff-start").length, 1);
  assert.equal(events.filter((event) => event.type === "execute-start").length, 1);
  assert.ok(events.findIndex((event) => event.type === "execute-start") > events.findIndex((event) => event.type === "compaction-end"));
  assert.deepEqual(completed, [{ reason: "requested", hasResult: true, aborted: false, error: null }]);
  const nativeCompactions = rows(reader.sessionManager.getSessionFile()).filter((row) => row.type === "compaction");
  assert.equal(nativeCompactions.length, readerCompactionsBefore + 1);
  assert.equal(reader.getSessionActionSnapshot().queuedCount, 0);
  assert.deepEqual(reader.getFollowUpMessages(), []);
  const phases = events.filter((event) => ["first-admitted", "factual-callback", "followUp-admitted"].includes(event.type)).map((event) => event.type);
  assert.deepEqual(phases, ["first-admitted", "factual-callback", "followUp-admitted"]);
  for (const key of ["ownerSessionId", "operationId", "taskId", "episodeId", "episodeSessionFile", "episodeActiveSessionId", "worktree", "branch", "baseRef", "integrationBranch"]) assert.equal(record[key], originalRecord[key]);
  assert.equal(record.head, git("rev-parse", "HEAD"));
  assert.equal(reader.sessionManager.getSessionId(), readerId);
  const chainEnds = state.readerToolEnds.slice(2);
  assert.equal(chainEnds.length, 2);
  for (const end of chainEnds) { assert.equal(end.isError, false, JSON.stringify(end)); assert.ok(JSON.stringify(end).length < 4096); }
  assert.ok(JSON.stringify(chainEnds[0]).includes("EPISODE_COMPACTION_REQUESTED"));
  assert.ok(JSON.stringify(chainEnds[1]).includes("SUBSTANTIVE_AFTER_COMPACT"));
  const contextLeak = state.contexts.some((context: any) => ["PREVIOUS_EARLY_α", "CURRENT_LATE_γ", "q".repeat(10000)].some((sentinel) => context.text.includes(sentinel)));
  assert.equal(contextLeak, false);
  assert.ok(requests.every((command) => command.message.length < 70000));
  assert.ok(JSON.stringify(state.handoffToolEnd).length < 20000);
  console.log("NATIVE_CHAIN_RESULT=" + JSON.stringify({ adapter: "public-promptUntilAccepted", handoffToolCalls: handoffCalls,
    canonicalPromptRequests: requests.length, compactRunRequests: compactCalls, completed, persistedCompactions: nativeCompactions.length,
    substantiveMarkers: workCalls, nativeQueueDrained: true, sameIdentity: true, sameKernelObject: true,
    completeEvidenceAfterCompaction: true, contextLeak, phases, events, toolResults: chainEnds }));

} finally {
  await reader?.disposeAsync();
  await writer?.disposeAsync();
  delete (globalThis as any).__nativeEntryProof;
}
