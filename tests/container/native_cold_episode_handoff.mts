/** Real native daemon, Git worktree, owner binding, journal and prompt delivery.
 * The task observation and model replies are inert fixture data, not LLM policy proof. */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  DaemonJsonlClient, PrimeSessionPublisher, handoffTaskEpisode, runtimeSessionManagerClass,
} from "../../src/prime-agent-plugin/extension-support/spec-episode.ts";
import {
  readEpisodeOwnership, writeEpisodeOwnership,
} from "../../src/prime-agent-plugin/extension-support/episode-ownership.ts";

const taskId = "COLD-FIXTURE-1";
const taskPathRelative = "backlog/tasks/COLD-FIXTURE-1.md";
const originalName = "original-episode-display";
const foreignName = "cold-fixture-1-episode"; // The former generated label for this task.
const model = { provider: "native-component", id: "m" };
const assignment = "Fixture original assignment. Reply only with acknowledgement.";
const markers = [assignment, "Fixture canonical handoff.", "Fixture canonical execute."];
const classify = (value: unknown) => markers.findIndex((part) => JSON.stringify(value).includes(part));

export default function fixture(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const { worktree, foreign, head, resultPath } = JSON.parse(process.env.PRIME_CLAW_COLD_HANDOFF_FIXTURE!);
    const socket = process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET!;
    const repo = ctx.cwd;
    const client = new DaemonJsonlClient(socket);
    // Separate the observations from the publisher owned and closed by the handoff.
    const handoffClient = new DaemonJsonlClient(socket);
    const observer = new PrimeSessionPublisher(client, runtimeSessionManagerClass(ctx.sessionManager));
    try {
      ctx.sessionManager.flushNow();
      assert.equal(ctx.model?.provider, model.provider);
      assert.equal(ctx.model?.id, model.id);
      const idle = async (activeSessionId: string) => {
        const response = await client.request({ type: "wait_for_idle", activeSessionId }, 15_000);
        assert.equal(response.success, true, JSON.stringify(response));
      };
      const owned = await observer.createFresh({ worktree, sessionName: originalName, model });
      const unrelated = await observer.createFresh({ worktree: foreign, sessionName: foreignName, model });
      await observer.deliverExecute(owned.activeSessionId, assignment);
      await idle(owned.activeSessionId);
      await observer.kill(owned.activeSessionId);
      await observer.kill(unrelated.activeSessionId);

      const before = await observer.list();
      const ownedBefore = before.filter((row) => row.sessionId === owned.sessionId);
      const foreignBefore = before.filter((row) => row.sessionId === unrelated.sessionId);
      assert.equal(ownedBefore.length, 1);
      assert.equal(foreignBefore.length, 1);
      assert.deepEqual(ownedBefore.map(({ sessionFile, cwd, sessionName, activeSessionId }) =>
        [sessionFile, cwd, sessionName, Boolean(activeSessionId)]), [[owned.sessionFile, worktree, originalName, false]]);
      assert.deepEqual(foreignBefore.map(({ sessionFile, cwd, sessionName, activeSessionId }) =>
        [sessionFile, cwd, sessionName, Boolean(activeSessionId)]), [[unrelated.sessionFile, foreign, foreignName, false]]);
      const inventory = (rows: typeof before) => rows.map(({ sessionId, sessionFile, cwd, sessionName }) =>
        JSON.stringify([sessionId, sessionFile, cwd, sessionName])).sort();
      const journals = () => readdirSync(process.env.PRIME_AGENT_SESSION_DIR!, { recursive: true, encoding: "utf8" })
        .filter((file) => file.endsWith(".jsonl")).sort();
      const journalNames = journals();
      const ownedBytes = readFileSync(owned.sessionFile);
      const foreignBytes = readFileSync(unrelated.sessionFile);

      // Verify the native precondition: this saved unrelated name really is reserved.
      // This deliberately refused fixture probe is not part of handoff delivery.
      const collision = await client.request({ type: "create", lifecycle: "resident", name: foreignName,
        sessionPath: owned.sessionFile, config: { cwd: worktree, provider: model.provider, model: model.id } });
      assert.equal(collision.success, false, "the former named reopen should collide with the unrelated root");
      assert.match(JSON.stringify(collision.error), /name.*unavailable|already exists/i);
      assert.deepEqual(readFileSync(owned.sessionFile), ownedBytes);
      assert.deepEqual(readFileSync(unrelated.sessionFile), foreignBytes);
      assert.equal((await observer.list()).find((row) => row.sessionId === owned.sessionId)?.activeSessionId, ownedBefore[0].activeSessionId);

      const now = new Date().toISOString();
      const ownerSessionId = ctx.sessionManager.getSessionId();
      const binding = {
        version: 2, status: "active", engine: "local", ownerSessionId, taskId, taskPath: taskPathRelative,
        operationId: "fixture-cold-handoff", baseRef: head, head, branch: "episode/cold-handoff", worktree,
        episodeId: owned.sessionId, episodeSessionFile: owned.sessionFile, episodeActiveSessionId: owned.activeSessionId,
        createdAt: now, updatedAt: now,
      } as const;
      writeEpisodeOwnership(repo, binding);
      const taskSelection = (projectRoot: string, selected: string) => {
        assert.ok(projectRoot === repo || projectRoot === worktree);
        assert.equal(selected, taskId);
        return { projectRoot, taskId, taskPathRelative, nativeView: { task: { id: taskId, path: taskPathRelative } } };
      };

      // Record, but do not replace, the production publisher's real native requests.
      const requests: Record<string, unknown>[] = [];
      const request = handoffClient.request.bind(handoffClient);
      handoffClient.request = (command, timeout) => {
        requests.push(command);
        return request(command, timeout);
      };
      const handoff = await handoffTaskEpisode(taskId, "Fixture scope only.", ctx, {
        publisher: new PrimeSessionPublisher(handoffClient),
        taskResolver: taskSelection,
        appendEntry(type, data) {
          pi.appendEntry(type, data);
          ctx.sessionManager.flushNow();
        },
      });
      const route = handoff.episodeActiveSessionId;
      assert.equal(handoff.admitted, true);
      assert.equal(handoff.episodeId, owned.sessionId);
      assert.equal(handoff.delivery?.activeSessionId, route);
      assert.equal(handoff.delivery?.first.outcome, "admitted");
      assert.equal(handoff.delivery?.followUp.outcome, "admitted");
      assert.deepEqual(requests.filter(({ type }) => type === "create" || type === "prompt")
        .map((command) => command.type === "create" ?
          ["create", command.sessionPath, Object.hasOwn(command, "name")] :
          ["prompt", command.activeSessionId, classify(command.message)]),
      [["create", owned.sessionFile, false], ["prompt", route, 1], ["prompt", route, 2]]);
      await idle(route);

      const state = await observer.getState(route);
      assert.equal(state.activeSessionId, route);
      assert.equal(state.sessionId, owned.sessionId);
      assert.equal(state.sessionFile, owned.sessionFile);
      assert.equal(state.cwd, worktree);
      const persisted = readEpisodeOwnership(repo, ownerSessionId);
      assert.ok(persisted);
      assert.equal(persisted.episodeActiveSessionId, route);
      assert.deepEqual({ ...persisted, episodeActiveSessionId: binding.episodeActiveSessionId, updatedAt: now }, binding);
      const after = await observer.list();
      assert.deepEqual(inventory(after), inventory(before));
      assert.equal(after.find((row) => row.sessionId === owned.sessionId)?.activeSessionId, route);
      assert.equal(after.find((row) => row.sessionId === unrelated.sessionId)?.activeSessionId, foreignBefore[0].activeSessionId);
      assert.deepEqual(journals(), journalNames);
      assert.deepEqual(readFileSync(unrelated.sessionFile), foreignBytes);

      const messages = await observer.getMessages(route) as Array<{ role: string; content: unknown }>;
      assert.deepEqual(messages.filter((msg) => msg.role === "user").map((msg) => classify(msg.content)), [0, 1, 2]);
      const rows = readFileSync(owned.sessionFile, "utf8").trim().split("\n").map((line) => JSON.parse(line));
      assert.equal(rows[0].id, owned.sessionId);
      assert.equal(rows[0].cwd, worktree);
      assert.deepEqual(rows.filter((row) => row.type === "message" && row.message.role === "user")
        .map((row) => classify(row.message.content)), [0, 1, 2]);
      writeFileSync(resultPath, JSON.stringify({
        result: "passed", scope: "real offline native daemon, ordinary task handoff with fixture task facts",
        coldNameCollisionRefused: true, sameSessionIdFileAndWorktree: true, namesPreserved: true,
        unchangedSessionInventory: true, foreignJournalBytesUnchanged: true,
        orderedUserMessages: ["original assignment", "canonical handoff", "canonical execute"],
      }));
    } catch (error) {
      const failure = error as Error;
      writeFileSync(resultPath, JSON.stringify({ error: failure.message, cause: String(failure.cause), stack: failure.stack }));
    } finally {
      handoffClient.close();
      observer.close();
    }
  });
}
