import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";

import {
  CliGitAdapter,
  createSpecEpisode,
  DaemonJsonlClient,
  DaemonMutationUncertainError,
  EpisodeStateUncertainError,
  episodeResultText,
  forkPrimeSession,
  NodeFilesystemAdapter,
  PrimeSessionPublisher,
} from "../.prime/agent/extension-support/spec-episode.ts";

const LOCATION = ".ralph/plans/future/alpha-plan";

function git(cwd, ...args) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
}

function write(path, body) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

function repositoryFixture(t) {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-spec-episode-")));
  const worktree = resolve(dirname(repo), `${basename(repo)}-alpha-plan-episode`);
  t.after(() => {
    try { execFileSync("git", ["-C", repo, "worktree", "remove", "--force", worktree], { stdio: "ignore" }); } catch {}
    try { execFileSync("git", ["-C", repo, "branch", "-D", "episode/alpha-plan"], { stdio: "ignore" }); } catch {}
    rmSync(worktree, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  });

  git(repo, "init", "-q");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Spec Episode Test");
  write(join(repo, ".gitignore"), ".prime/agent/state/\n");
  write(join(repo, ".ralph", "skills", "execute", "SKILL.md"), "canonical execute body");
  write(join(repo, ".ralph", "plans", "CURRENT.md"), "old active plan");
  write(join(repo, LOCATION, "manifest.yaml"), "kind: arbitrary-bundle\n");
  write(join(repo, LOCATION, "nested", "notes.txt"), "opaque nested artifact\n");
  write(join(repo, ".ralph", "plans", "future", "other-bundle", "KEEP"), "future lifecycle");
  write(join(repo, ".ralph", "plans", "archive", "KEEP"), "archive lifecycle");
  write(join(repo, ".ralph", "plans", "blocked", "KEEP"), "blocked lifecycle");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "initial");
  return { repo, worktree };
}

class FakePublisher {
  constructor({ sessions = [], failDelivery = false, failKill = false } = {}) {
    this.sessions = sessions;
    this.failDelivery = failDelivery;
    this.failKill = failKill;
    this.listCalls = 0;
    this.forks = [];
    this.reopens = [];
    this.deliveries = [];
    this.kills = [];
    this.closed = 0;
  }
  async list() { this.listCalls += 1; return this.sessions; }
  async forkAndPublish(options) {
    this.forks.push(options);
    return {
      activeSessionId: "active-episode-1",
      sessionId: "stable-episode-1",
      sessionFile: join(options.worktree, ".episode-session.jsonl"),
    };
  }
  async reopen(options) {
    this.reopens.push(options);
    return {
      activeSessionId: "active-episode-reopened",
      sessionId: options.sessionId,
      sessionFile: options.sessionFile,
    };
  }
  async deliverExecute(activeSessionId, prompt) {
    this.deliveries.push({ activeSessionId, prompt });
    if (this.failDelivery) throw new Error("delivery rejected");
  }
  async kill(activeSessionId) {
    this.kills.push(activeSessionId);
    if (this.failKill) throw new Error("kill unconfirmed");
    return true;
  }
  close() { this.closed += 1; }
}

function context(repo) {
  return {
    cwd: repo,
    model: { provider: "test-provider", id: "test-model" },
    sessionManager: {
      getSessionFile() { return join(repo, "owner-session.jsonl"); },
      getSessionId() { return "owner-session-id"; },
      getHeader() { return { rlmDepth: 0 }; },
    },
  };
}

function dependencies(publisher) {
  return {
    git: new CliGitAdapter(),
    filesystem: new NodeFilesystemAdapter(),
    publisher,
  };
}

test("promotes an opaque bundle, commits it, publishes context, and delivers execute once", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  write(join(repo, LOCATION, "approved-after-head.md"), "uncommitted approved content\n");
  const publisher = new FakePublisher();

  const result = await createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(publisher));

  assert.equal(result.reused, false);
  assert.equal(result.episodeId, "stable-episode-1");
  assert.equal(result.episodeActiveSessionId, "active-episode-1");
  assert.equal(result.branch, "episode/alpha-plan");
  assert.equal(result.worktree, worktree);
  assert.equal(result.sessionName, "alpha-plan-episode");
  assert.match(episodeResultText(result), /"episodeActiveSessionId":"active-episode-1"/);

  assert.equal(readFileSync(join(repo, LOCATION, "manifest.yaml"), "utf8"), "kind: arbitrary-bundle\n");
  assert.equal(existsSync(join(worktree, LOCATION)), false);
  assert.equal(existsSync(join(worktree, ".ralph", "plans", "CURRENT.md")), false);
  assert.equal(readFileSync(join(worktree, ".ralph", "plans", "manifest.yaml"), "utf8"), "kind: arbitrary-bundle\n");
  assert.equal(readFileSync(join(worktree, ".ralph", "plans", "nested", "notes.txt"), "utf8"), "opaque nested artifact\n");
  assert.equal(readFileSync(join(worktree, ".ralph", "plans", "approved-after-head.md"), "utf8"), "uncommitted approved content\n");
  for (const lifecycle of ["future/other-bundle/KEEP", "archive/KEEP", "blocked/KEEP"]) {
    assert.equal(existsSync(join(worktree, ".ralph", "plans", lifecycle)), true);
  }
  assert.match(git(worktree, "log", "-1", "--pretty=%s"), /promote alpha-plan specification/);
  assert.equal(git(worktree, "show", "HEAD:.ralph/plans/manifest.yaml"), "kind: arbitrary-bundle");
  assert.equal(git(worktree, "show", "HEAD:.ralph/plans/approved-after-head.md"), "uncommitted approved content");
  assert.throws(() => execFileSync(
    "git",
    ["-C", worktree, "cat-file", "-e", "HEAD:.ralph/plans/future/alpha-plan/manifest.yaml"],
    { stdio: "ignore" },
  ));
  assert.equal(git(worktree, "status", "--porcelain"), "");

  assert.equal(publisher.forks.length, 1);
  assert.deepEqual(publisher.forks[0], {
    sourceSessionFile: join(repo, "owner-session.jsonl"),
    worktree,
    sessionName: "alpha-plan-episode",
    branch: "episode/alpha-plan",
    toolCallId: "tool-call-1",
    model: { provider: "test-provider", id: "test-model" },
  });
  assert.equal(publisher.deliveries.length, 1);
  assert.equal(publisher.deliveries[0].activeSessionId, "active-episode-1");
  assert.equal(publisher.deliveries[0].prompt.split("canonical execute body").length - 1, 1);
  assert.equal(publisher.closed, 1);

  const identityPath = join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json");
  const identity = JSON.parse(readFileSync(identityPath, "utf8"));
  assert.deepEqual(Object.keys(identity).sort(), [
    "branch", "episodeActiveSessionId", "episodeId", "episodeSessionFile",
    "executeAdmission", "ownerSessionId", "sessionName", "slug", "sourceLocation",
    "version", "worktree",
  ]);
  assert.equal(identity.executeAdmission, "delivered");
});


test("no-diff promotion starts clean and creates an allow-empty marker commit", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  git(repo, "rm", "-qr", ".ralph/plans/CURRENT.md", LOCATION);
  write(join(repo, ".ralph", "plans", "manifest.yaml"), "kind: arbitrary-bundle\n");
  write(join(repo, ".ralph", "plans", "nested", "notes.txt"), "opaque nested artifact\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "make active plan match future bundle");
  write(join(repo, LOCATION, "manifest.yaml"), "kind: arbitrary-bundle\n");
  write(join(repo, LOCATION, "nested", "notes.txt"), "opaque nested artifact\n");
  const publisher = new FakePublisher();

  const result = await createSpecEpisode(LOCATION, "tool-call-empty", context(repo), dependencies(publisher));

  assert.equal(result.executeAdmission, "delivered");
  assert.equal(git(worktree, "diff", "--exit-code", "HEAD^", "HEAD"), "");
  assert.match(git(worktree, "log", "-1", "--pretty=%s"), /promote alpha-plan specification/);
  assert.equal(existsSync(join(repo, LOCATION, "manifest.yaml")), true);
  assert.equal(git(worktree, "status", "--porcelain"), "");
});


test("matching repeated request returns identity without another fork or execute delivery", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  const first = new FakePublisher();
  const created = await createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(first));
  const replay = new FakePublisher({ sessions: [{
    activeSessionId: created.episodeActiveSessionId,
    sessionId: created.episodeId,
    sessionFile: created.episodeSessionFile,
    sessionName: created.sessionName,
    cwd: created.worktree,
  }] });

  const result = await createSpecEpisode(LOCATION, "tool-call-2", context(repo), dependencies(replay));

  assert.equal(result.reused, true);
  assert.equal(result.worktree, worktree);
  assert.deepEqual(replay.forks, []);
  assert.deepEqual(replay.deliveries, []);
  assert.equal(replay.closed, 1);
});



test("matching inactive durable session is reopened without another execute delivery", async (t) => {
  const { repo } = repositoryFixture(t);
  const first = new FakePublisher();
  const created = await createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(first));
  const replay = new FakePublisher({ sessions: [{
    sessionId: created.episodeId,
    sessionFile: created.episodeSessionFile,
    sessionName: created.sessionName,
    cwd: created.worktree,
  }] });

  const result = await createSpecEpisode(LOCATION, "tool-call-2", context(repo), dependencies(replay));

  assert.equal(result.reused, true);
  assert.equal(result.episodeActiveSessionId, "active-episode-reopened");
  assert.equal(replay.reopens.length, 1);
  assert.deepEqual(replay.forks, []);
  assert.deepEqual(replay.deliveries, []);
  const identity = JSON.parse(readFileSync(
    join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json"),
    "utf8",
  ));
  assert.equal(identity.episodeActiveSessionId, "active-episode-reopened");
});


test("non-root session is rejected before collision checks or Git mutation", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  const publisher = new FakePublisher();
  const childContext = context(repo);
  childContext.sessionManager.getHeader = () => ({ rlmDepth: 1 });

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", childContext, dependencies(publisher)),
    /top-level project conversation/,
  );

  assert.equal(publisher.listCalls, 0);
  assert.equal(existsSync(worktree), false);
  assert.equal(existsSync(join(repo, LOCATION, "manifest.yaml")), true);
});


test("ordinary branch collision fails clearly without deleting it", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  git(repo, "branch", "episode/alpha-plan");
  const publisher = new FakePublisher();

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(publisher)),
    /Episode branch already exists/,
  );

  assert.equal(git(repo, "show-ref", "--verify", "--quiet", "refs/heads/episode/alpha-plan"), "");
  assert.equal(existsSync(worktree), false);
  assert.equal(existsSync(join(repo, LOCATION, "manifest.yaml")), true);
});


test("worktree path collision fails without deleting the directory", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  write(join(worktree, "OWNER"), "pre-existing resource");
  const publisher = new FakePublisher();

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(publisher)),
    /Episode worktree path already exists/,
  );

  assert.equal(readFileSync(join(worktree, "OWNER"), "utf8"), "pre-existing resource");
  assert.throws(() => git(repo, "show-ref", "--verify", "--quiet", "refs/heads/episode/alpha-plan"));
});

test("session-name collision fails before Git mutation", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  const publisher = new FakePublisher({ sessions: [{
    activeSessionId: "other-active",
    sessionId: "other-stable",
    sessionName: "alpha-plan-episode",
    cwd: "/somewhere-else",
  }] });

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(publisher)),
    /Episode session name already exists/,
  );

  assert.equal(existsSync(worktree), false);
  assert.throws(() => git(repo, "show-ref", "--verify", "--quiet", "refs/heads/episode/alpha-plan"));
  assert.equal(existsSync(join(repo, LOCATION, "manifest.yaml")), true);
});





test("cleanup reports worktree-removal failure after still attempting branch deletion", () => {
  const calls = [];
  const adapter = new CliGitAdapter((_cwd, args) => {
    calls.push(args);
    if (args[0] === "worktree" && args[1] === "remove") throw new Error("cannot remove worktree");
    return "";
  });

  assert.throws(
    () => adapter.removeCreatedWorktree("/repo", "episode/alpha", "/worktree"),
    /worktree removal failed: cannot remove worktree/,
  );
  assert.deepEqual(calls.map((args) => args.slice(0, 2)), [["worktree", "remove"], ["branch", "-D"]]);
});

test("cleanup reports branch-deletion failure after confirmed worktree removal", () => {
  const calls = [];
  const adapter = new CliGitAdapter((_cwd, args) => {
    calls.push(args);
    if (args[0] === "branch" && args[1] === "-D") throw new Error("cannot delete branch");
    return "";
  });

  assert.throws(
    () => adapter.removeCreatedWorktree("/repo", "episode/alpha", "/worktree"),
    /branch deletion failed: cannot delete branch/,
  );
  assert.deepEqual(calls.map((args) => args.slice(0, 2)), [["worktree", "remove"], ["branch", "-D"]]);
});

test("partial Git cleanup becomes uncertain and preserves identity artifacts", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  class CleanupFailureGit extends CliGitAdapter {
    removeCreatedWorktree() { throw new Error("worktree removal failed: simulated"); }
  }
  const publisher = new FakePublisher({ failDelivery: true });

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", context(repo), {
      git: new CleanupFailureGit(), filesystem: new NodeFilesystemAdapter(), publisher,
    }),
    /Git cleanup was incomplete/,
  );

  assert.deepEqual(publisher.kills, ["active-episode-1"]);
  assert.equal(existsSync(worktree), true);
  assert.equal(existsSync(join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json")), true);
});


test("uncertain execute admission preserves identity and never redelivers on replay", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  const publisher = new FakePublisher();
  publisher.deliverExecute = async (activeSessionId, prompt) => {
    publisher.deliveries.push({ activeSessionId, prompt });
    const pending = JSON.parse(readFileSync(
      join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json"),
      "utf8",
    ));
    assert.equal(pending.executeAdmission, "pending");
    throw new EpisodeStateUncertainError("execute admission uncertain");
  };

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(publisher)),
    /execute admission uncertain/,
  );

  assert.deepEqual(publisher.kills, []);
  assert.equal(existsSync(worktree), true);
  const identityPath = join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json");
  const uncertain = JSON.parse(readFileSync(identityPath, "utf8"));
  assert.equal(uncertain.executeAdmission, "uncertain");

  const replay = new FakePublisher({ sessions: [{
    activeSessionId: uncertain.episodeActiveSessionId,
    sessionId: uncertain.episodeId,
    sessionFile: uncertain.episodeSessionFile,
    sessionName: uncertain.sessionName,
    cwd: uncertain.worktree,
  }] });
  const result = await createSpecEpisode(LOCATION, "tool-call-2", context(repo), dependencies(replay));
  assert.equal(result.reused, true);
  assert.equal(result.executeAdmission, "uncertain");
  assert.deepEqual(replay.deliveries, []);
  assert.deepEqual(replay.kills, []);
});

test("crash-window failure after admission preserves pending identity and never redelivers", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  const baseFilesystem = new NodeFilesystemAdapter();
  let identityWrites = 0;
  const filesystem = {
    exists: (path) => baseFilesystem.exists(path),
    promoteBundle: (...args) => baseFilesystem.promoteBundle(...args),
    readIdentity: (path) => baseFilesystem.readIdentity(path),
    removeFile: (path) => baseFilesystem.removeFile(path),
    writeIdentity(path, identity) {
      identityWrites += 1;
      if (identityWrites === 2) throw new Error("crash before delivered mark");
      baseFilesystem.writeIdentity(path, identity);
    },
  };
  const publisher = new FakePublisher();

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", context(repo), {
      git: new CliGitAdapter(), filesystem, publisher,
    }),
    /delivered identity mark could not be persisted/,
  );

  assert.equal(publisher.deliveries.length, 1);
  assert.deepEqual(publisher.kills, []);
  assert.equal(existsSync(worktree), true);
  const identity = JSON.parse(readFileSync(
    join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json"),
    "utf8",
  ));
  assert.equal(identity.executeAdmission, "pending");

  const replay = new FakePublisher({ sessions: [{
    activeSessionId: identity.episodeActiveSessionId,
    sessionId: identity.episodeId,
    sessionFile: identity.episodeSessionFile,
    sessionName: identity.sessionName,
    cwd: identity.worktree,
  }] });
  const replayResult = await createSpecEpisode(LOCATION, "tool-call-2", context(repo), dependencies(replay));
  assert.equal(replayResult.executeAdmission, "pending");
  assert.deepEqual(replay.deliveries, []);
});


test("uncertain create preserves the promoted branch and worktree", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  const publisher = new FakePublisher();
  publisher.forkAndPublish = async () => {
    throw new EpisodeStateUncertainError("publication may have succeeded");
  };

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(publisher)),
    /publication may have succeeded/,
  );

  assert.equal(existsSync(worktree), true);
  assert.equal(git(repo, "show-ref", "--verify", "--quiet", "refs/heads/episode/alpha-plan"), "");
  assert.equal(readFileSync(join(worktree, ".ralph", "plans", "manifest.yaml"), "utf8"), "kind: arbitrary-bundle\n");
});

test("failed kill after delivery error preserves live-resource candidates", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  const publisher = new FakePublisher({ failDelivery: true, failKill: true });

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(publisher)),
    /cleanup could not be confirmed/,
  );

  assert.deepEqual(publisher.kills, ["active-episode-1"]);
  assert.equal(existsSync(worktree), true);
  assert.equal(git(repo, "show-ref", "--verify", "--quiet", "refs/heads/episode/alpha-plan"), "");
});


test("delivery failure removes only resources created by that invocation", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  const publisher = new FakePublisher({ failDelivery: true });

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(publisher)),
    /delivery rejected/,
  );

  assert.deepEqual(publisher.kills, ["active-episode-1"]);
  assert.equal(existsSync(worktree), false);
  assert.throws(() => git(repo, "show-ref", "--verify", "--quiet", "refs/heads/episode/alpha-plan"));
  assert.equal(existsSync(join(repo, LOCATION, "manifest.yaml")), true);
});

test("public SessionManager forkFrom gets target cwd and a matching successful tool result", () => {
  const calls = [];
  const appended = [];
  const SessionManager = {
    forkFrom(source, cwd) {
      calls.push({ source, cwd });
      return {
        getSessionFile: () => "/sessions/fork.jsonl",
        getSessionId: () => "stable-fork-id",
        appendMessage(message) { appended.push(message); return "entry-1"; },
      };
    },
  };
  const options = {
    sourceSessionFile: "/sessions/owner.jsonl",
    worktree: "/repo-alpha-episode",
    sessionName: "alpha-episode",
    branch: "episode/alpha",
    toolCallId: "tool-call-9",
  };

  const fork = forkPrimeSession(SessionManager, options);

  assert.deepEqual(calls, [{ source: options.sourceSessionFile, cwd: options.worktree }]);
  assert.deepEqual(fork, { sessionFile: "/sessions/fork.jsonl", sessionId: "stable-fork-id" });
  assert.equal(appended.length, 1);
  assert.equal(appended[0].role, "toolResult");
  assert.equal(appended[0].toolCallId, "tool-call-9");
  assert.equal(appended[0].toolName, "create_spec_episode");
  assert.equal(appended[0].isError, false);
  assert.equal(appended[0].content[0].text, episodeResultText({
    episodeId: "stable-fork-id",
    branch: options.branch,
    worktree: options.worktree,
    sessionName: options.sessionName,
    executeAdmission: "pending",
    reused: false,
  }));
});



test("publisher rejects and kills a daemon identity not bound to the requested fork", async () => {
  const requests = [];
  const client = {
    async request(command) {
      requests.push(command);
      if (command.type === "create") {
        return { success: true, data: {
          activeSessionId: "wrong-active",
          sessionId: "wrong-stable",
          sessionFile: "/sessions/wrong.jsonl",
          sessionName: "wrong-name",
          cwd: "/wrong-cwd",
        } };
      }
      return { success: true, data: {} };
    },
    close() {},
  };
  const publisher = new PrimeSessionPublisher(client);

  await assert.rejects(
    publisher.reopen({
      sessionFile: "/sessions/fork.jsonl",
      sessionId: "stable-fork",
      worktree: "/repo-alpha-episode",
      sessionName: "alpha-episode",
    }),
    /does not match the requested fork/,
  );

  assert.deepEqual(requests.map((request) => request.type), ["create", "kill"]);
  assert.equal(requests[1].activeSessionId, "wrong-active");
});


test("publisher admits execute as one queued follow-up without template expansion", async () => {
  const requests = [];
  const client = {
    async request(command) { requests.push(command); return { success: true, data: {} }; },
    close() {},
  };
  const publisher = new PrimeSessionPublisher(client);

  await publisher.deliverExecute("active-episode-1", "wrapped execute");

  assert.deepEqual(requests, [{
    type: "prompt",
    activeSessionId: "active-episode-1",
    message: "wrapped execute",
    streamingBehavior: "followUp",
    queueIfBusy: true,
    expandPromptTemplates: false,
    source: "extension",
  }]);
});


test("daemon client uses protocol-7 command envelope and acknowledges mutation", async (t) => {
  const socketPath = join(tmpdir(), `spec-episode-${process.pid}-${Date.now()}.sock`);
  rmSync(socketPath, { force: true });
  const records = [];
  let acknowledge;
  const acknowledged = new Promise((resolveAck) => { acknowledge = resolveAck; });
  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    socket.write(`${JSON.stringify({
      type: "daemon_hello",
      protocol: { name: "prime-agent.daemon", version: 7 },
      schema: { revision: 28 },
    })}\n`);
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk;
      while (buffer.includes("\n")) {
        const index = buffer.indexOf("\n");
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        const record = JSON.parse(line);
        records.push(record);
        if (record.command.type === "create") {
          socket.write(`${JSON.stringify({ type: "response", id: record.id, success: true, data: { ok: true } })}\n`);
        } else if (record.command.type === "ack_result") {
          acknowledge();
        }
      }
    });
  });
  server.listen(socketPath);
  await once(server, "listening");
  t.after(() => { server.close(); rmSync(socketPath, { force: true }); });
  const client = new DaemonJsonlClient(socketPath);
  t.after(() => client.close());

  const response = await client.request({
    type: "create",
    lifecycle: "resident",
    sessionPath: "/sessions/fork.jsonl",
    name: "alpha-episode",
    config: { cwd: "/repo-alpha-episode" },
  });
  await acknowledged;

  assert.equal(response.success, true);
  assert.equal(records[0].type, "command");
  assert.equal(records[0].protocol.name, "prime-agent.daemon");
  assert.equal(records[0].protocol.version, 7);
  assert.equal(records[0].command.id, records[0].id);
  assert.equal(records[0].command.lifecycle, "resident");
  assert.equal(records[1].command.type, "ack_result");
  assert.equal(records[1].command.commandId, records[0].id);
});


test("lost daemon mutation response is reported as uncertain", async (t) => {
  const socketPath = join(tmpdir(), `spec-episode-lost-${process.pid}-${Date.now()}.sock`);
  rmSync(socketPath, { force: true });
  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    socket.write(`${JSON.stringify({
      type: "daemon_hello",
      protocol: { name: "prime-agent.daemon", version: 7 },
      schema: { revision: 28 },
    })}\n`);
    socket.once("data", () => socket.destroy());
  });
  server.listen(socketPath);
  await once(server, "listening");
  t.after(() => { server.close(); rmSync(socketPath, { force: true }); });
  const client = new DaemonJsonlClient(socketPath);
  t.after(() => client.close());

  await assert.rejects(
    client.request({ type: "create", sessionPath: "/sessions/fork.jsonl" }),
    (error) => error instanceof DaemonMutationUncertainError && /create outcome is uncertain/.test(error.message),
  );
});


test("daemon command_result_uncertain preserves the durable episode state", async (t) => {
  const socketPath = join(tmpdir(), `spec-episode-reported-${process.pid}-${Date.now()}.sock`);
  rmSync(socketPath, { force: true });
  const commandTypes = [];
  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    socket.write(`${JSON.stringify({
      type: "daemon_hello",
      protocol: { name: "prime-agent.daemon", version: 7 },
      schema: { revision: 28 },
    })}\n`);
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk;
      while (buffer.includes("\n")) {
        const index = buffer.indexOf("\n");
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        const record = JSON.parse(line);
        commandTypes.push(record.command.type);
        if (record.command.type === "create") {
          socket.write(`${JSON.stringify({
            type: "response",
            id: record.id,
            success: false,
            error: "mutation outcome unknown after worker disconnect",
            errorInfo: {
              code: "command_result_uncertain",
              clientId: record.clientId,
              commandId: record.id,
            },
          })}\n`);
        }
      }
    });
  });
  server.listen(socketPath);
  await once(server, "listening");
  t.after(() => { server.close(); rmSync(socketPath, { force: true }); });
  const client = new DaemonJsonlClient(socketPath);
  const publisher = new PrimeSessionPublisher(client);
  t.after(() => publisher.close());

  await assert.rejects(
    publisher.reopen({
      sessionFile: "/sessions/fork.jsonl",
      sessionId: "stable-fork",
      worktree: "/repo-alpha-episode",
      sessionName: "alpha-episode",
    }),
    (error) => error instanceof EpisodeStateUncertainError && /may have succeeded/.test(error.message),
  );

  assert.equal(commandTypes[0], "create");
  assert.equal(commandTypes.includes("kill"), false);
});
