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
  handoffSpecEpisode,
  DaemonMutationUncertainError,
  EpisodeStateUncertainError,
  HandoffFollowUpRejectedError,
  episodeResultText,
  forkPrimeSession,
  NodeFilesystemAdapter,
  PrimeSessionPublisher,
} from "../src/prime-agent-plugin/extension-support/spec-episode.ts";

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
  write(join(repo, ".ralph", "skills", "handoff", "SKILL.md"), "canonical handoff body\n\n```python\ncompaction_result = await compact.run(focus_hint)\n```\n");
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
  constructor({ sessions = [], state = null, failDelivery = false, failKill = false } = {}) {
    this.sessions = sessions;
    this.state = state;
    this.failDelivery = failDelivery;
    this.failKill = failKill;
    this.listCalls = 0;
    this.stateCalls = [];
    this.forks = [];
    this.reopens = [];
    this.deliveries = [];
    this.handoffs = [];
    this.kills = [];
    this.closed = 0;
  }
  async list() { this.listCalls += 1; return this.sessions; }
  async getState(activeSessionId) {
    this.stateCalls.push(activeSessionId);
    if (!this.state) throw new Error("missing fake state");
    return this.state;
  }
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
  async deliverHandoff(activeSessionId, handoffPrompt, executePrompt, onHandoffAdmitted) {
    this.handoffs.push({ activeSessionId, handoffPrompt, executePrompt });
    if (this.failDelivery) throw new Error("delivery rejected");
    await onHandoffAdmitted?.();
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

function idleState(created, activeSessionId = created.episodeActiveSessionId) {
  return {
    activeSessionId,
    sessionId: created.episodeId,
    sessionFile: created.episodeSessionFile,
    sessionName: created.sessionName,
    cwd: created.worktree,
    isSessionActive: true,
    isStreaming: false,
    isCompacting: false,
    isBashRunning: false,
    isRunningTools: false,
    hasRunningRlmChildren: false,
    unfinishedActionCount: 0,
    sessionActions: { queuedCount: 0, steering: [], followUps: [] },
  };
}

test("promotes an opaque bundle, commits it, publishes context, and bootstraps handoff before execute", async (t) => {
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
  assert.deepEqual(publisher.deliveries, []);
  assert.equal(publisher.handoffs.length, 1);
  assert.equal(publisher.handoffs[0].activeSessionId, "active-episode-1");
  assert.equal(publisher.handoffs[0].handoffPrompt.split("canonical handoff body").length - 1, 1);
  assert.match(publisher.handoffs[0].handoffPrompt, /compact\.run\(focus_hint\)/);
  assert.equal(publisher.handoffs[0].executePrompt.split("canonical execute body").length - 1, 1);
  assert.equal(publisher.handoffs[0].executePrompt.split(LOCATION).length - 1, 1);
  assert.equal(publisher.closed, 1);

  const identityPath = join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json");
  const identity = JSON.parse(readFileSync(identityPath, "utf8"));
  assert.deepEqual(Object.keys(identity).sort(), [
    "bootstrapAdmission", "branch", "episodeActiveSessionId", "episodeId",
    "episodeSessionFile", "ownerSessionId", "sessionName", "slug", "sourceLocation",
    "version", "worktree",
  ]);
  assert.equal(identity.version, 2);
  assert.equal(identity.bootstrapAdmission, "delivered");
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

  assert.equal(result.bootstrapAdmission, "delivered");
  assert.equal(git(worktree, "diff", "--exit-code", "HEAD^", "HEAD"), "");
  assert.match(git(worktree, "log", "-1", "--pretty=%s"), /promote alpha-plan specification/);
  assert.equal(existsSync(join(repo, LOCATION, "manifest.yaml")), true);
  assert.equal(git(worktree, "status", "--porcelain"), "");
});


test("bootstrap journal advances durably between the two admissions", async (t) => {
  const { repo } = repositoryFixture(t);
  const baseFilesystem = new NodeFilesystemAdapter();
  const stages = [];
  const filesystem = {
    exists: (path) => baseFilesystem.exists(path),
    promoteBundle: (...args) => baseFilesystem.promoteBundle(...args),
    readIdentity: (path) => baseFilesystem.readIdentity(path),
    removeFile: (path) => baseFilesystem.removeFile(path),
    writeIdentity(path, identity) {
      stages.push(identity.bootstrapAdmission ?? `v${identity.version}`);
      baseFilesystem.writeIdentity(path, identity);
    },
  };

  const result = await createSpecEpisode(LOCATION, "tool-call-journal", context(repo), {
    git: new CliGitAdapter(), filesystem, publisher: new FakePublisher(),
  });

  assert.equal(result.bootstrapAdmission, "delivered");
  assert.deepEqual(stages, ["handoff-pending", "execute-pending", "delivered"]);
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


test("version-1 identities remain truthful legacy direct-execute records", async (t) => {
  const { repo } = repositoryFixture(t);
  const created = await createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(new FakePublisher()));
  const identityPath = join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json");
  const legacy = {
    version: 1,
    slug: created.slug,
    sourceLocation: created.sourceLocation,
    ownerSessionId: created.ownerSessionId,
    episodeId: created.episodeId,
    episodeActiveSessionId: created.episodeActiveSessionId,
    episodeSessionFile: created.episodeSessionFile,
    branch: created.branch,
    worktree: created.worktree,
    sessionName: created.sessionName,
    executeAdmission: "delivered",
  };
  writeFileSync(identityPath, `${JSON.stringify(legacy, null, 2)}\n`);
  const session = {
    activeSessionId: legacy.episodeActiveSessionId,
    sessionId: legacy.episodeId,
    sessionFile: legacy.episodeSessionFile,
    sessionName: legacy.sessionName,
    cwd: legacy.worktree,
    isSessionActive: true,
  };
  const replay = new FakePublisher({ sessions: [session] });

  const reused = await createSpecEpisode(LOCATION, "tool-call-2", context(repo), dependencies(replay));
  assert.equal(reused.version, 1);
  assert.equal(reused.executeAdmission, "delivered");
  assert.deepEqual(replay.handoffs, []);

  const handoffPublisher = new FakePublisher({
    sessions: [session],
    state: idleState(created),
  });
  const handoff = await handoffSpecEpisode(LOCATION, "", context(repo), dependencies(handoffPublisher));
  assert.equal(handoff.admitted, true);
  assert.equal(handoffPublisher.handoffs.length, 1);

  writeFileSync(identityPath, `${JSON.stringify({ ...legacy, executeAdmission: "uncertain" }, null, 2)}\n`);
  const unresolved = new FakePublisher({ sessions: [session], state: idleState(created) });
  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-3", context(repo), dependencies(unresolved)),
    /legacy execute admission uncertain/,
  );
  await assert.rejects(
    handoffSpecEpisode(LOCATION, "", context(repo), dependencies(unresolved)),
    /legacy execute admission uncertain is incomplete/,
  );
  assert.deepEqual(unresolved.handoffs, []);
});

test("owner drives an exact idle episode through handoff steer and one execute follow-up", async (t) => {
  const { repo } = repositoryFixture(t);
  const created = await createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(new FakePublisher()));
  const publisher = new FakePublisher({
    sessions: [{
      ...idleState(created),
      isSessionActive: true,
    }],
    state: idleState(created),
  });

  const result = await handoffSpecEpisode(
    LOCATION,
    "preserve the accepted slice boundary",
    context(repo),
    dependencies(publisher),
  );

  assert.deepEqual(result, {
    admitted: true,
    sourceLocation: LOCATION,
    episodeId: created.episodeId,
    episodeActiveSessionId: created.episodeActiveSessionId,
    handoffDelivery: "steer",
    executeDelivery: "followUp",
  });
  assert.deepEqual(publisher.stateCalls, [created.episodeActiveSessionId]);
  assert.equal(publisher.handoffs.length, 1);
  assert.equal(publisher.handoffs[0].activeSessionId, created.episodeActiveSessionId);
  assert.match(publisher.handoffs[0].handoffPrompt, /canonical handoff body/);
  assert.match(publisher.handoffs[0].handoffPrompt, /compact\.run\(focus_hint\)/);
  assert.equal(publisher.handoffs[0].handoffPrompt.split("preserve the accepted slice boundary").length - 1, 1);
  assert.match(publisher.handoffs[0].executePrompt, /canonical execute body/);
  assert.equal(publisher.closed, 1);
});

test("owner handoff reopens the exact inactive durable session before delivery", async (t) => {
  const { repo } = repositoryFixture(t);
  const created = await createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(new FakePublisher()));
  const publisher = new FakePublisher({
    sessions: [{
      sessionId: created.episodeId,
      sessionFile: created.episodeSessionFile,
      sessionName: created.sessionName,
      cwd: created.worktree,
      isSessionActive: false,
      isStreaming: false,
      isCompacting: false,
      queuedCount: 0,
    }],
    state: idleState(created, "active-episode-reopened"),
  });

  const result = await handoffSpecEpisode(LOCATION, "", context(repo), dependencies(publisher));

  assert.equal(result.episodeActiveSessionId, "active-episode-reopened");
  assert.equal(publisher.reopens.length, 1);
  assert.equal(publisher.handoffs[0].activeSessionId, "active-episode-reopened");
  const identity = JSON.parse(readFileSync(
    join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json"),
    "utf8",
  ));
  assert.equal(identity.episodeActiveSessionId, "active-episode-reopened");
});

test("owner handoff rejects a different owner before state checks or delivery", async (t) => {
  const { repo } = repositoryFixture(t);
  const created = await createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(new FakePublisher()));
  const publisher = new FakePublisher({
    sessions: [{ ...idleState(created), isSessionActive: true }],
    state: idleState(created),
  });
  const otherOwner = context(repo);
  otherOwner.sessionManager.getSessionId = () => "different-owner";

  await assert.rejects(
    handoffSpecEpisode(LOCATION, "", otherOwner, dependencies(publisher)),
    /conflicts on ownerSessionId/,
  );

  assert.deepEqual(publisher.stateCalls, []);
  assert.deepEqual(publisher.handoffs, []);
});

test("owner handoff rejects a busy list snapshot and a non-quiescent daemon state", async (t) => {
  const { repo } = repositoryFixture(t);
  const created = await createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(new FakePublisher()));
  const busy = new FakePublisher({
    sessions: [{ ...idleState(created), isSessionActive: true, isStreaming: true }],
    state: idleState(created),
  });
  await assert.rejects(
    handoffSpecEpisode(LOCATION, "", context(repo), dependencies(busy)),
    /episode is busy/i,
  );
  assert.deepEqual(busy.stateCalls, []);
  assert.deepEqual(busy.handoffs, []);

  const queuedState = idleState(created);
  queuedState.sessionActions = { queuedCount: 1, steering: [], followUps: ["execute"] };
  const queued = new FakePublisher({
    sessions: [{ ...idleState(created), isSessionActive: true }],
    state: queuedState,
  });
  await assert.rejects(
    handoffSpecEpisode(LOCATION, "", context(repo), dependencies(queued)),
    /not quiescent/,
  );
  assert.deepEqual(queued.handoffs, []);
});

test("owner handoff rejects non-root callers and unresolved initial admission", async (t) => {
  const { repo } = repositoryFixture(t);
  const created = await createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(new FakePublisher()));
  const publisher = new FakePublisher({
    sessions: [{ ...idleState(created), isSessionActive: true }],
    state: idleState(created),
  });
  const child = context(repo);
  child.sessionManager.getHeader = () => ({ rlmDepth: 1 });
  await assert.rejects(
    handoffSpecEpisode(LOCATION, "", child, dependencies(publisher)),
    /top-level project conversation/,
  );
  assert.equal(publisher.listCalls, 0);

  const identityPath = join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json");
  const identity = JSON.parse(readFileSync(identityPath, "utf8"));
  writeFileSync(identityPath, `${JSON.stringify({ ...identity, bootstrapAdmission: "execute-uncertain" }, null, 2)}\n`);
  await assert.rejects(
    handoffSpecEpisode(LOCATION, "", context(repo), dependencies(publisher)),
    /bootstrap admission execute-uncertain is incomplete/,
  );
  assert.deepEqual(publisher.stateCalls, []);
  assert.deepEqual(publisher.handoffs, []);
});

test("owner handoff preflights both canonical workflows before reopening", async (t) => {
  const { repo } = repositoryFixture(t);
  const created = await createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(new FakePublisher()));
  rmSync(join(created.worktree, ".ralph", "skills", "execute", "SKILL.md"));
  const publisher = new FakePublisher({
    sessions: [{
      sessionId: created.episodeId,
      sessionFile: created.episodeSessionFile,
      sessionName: created.sessionName,
      cwd: created.worktree,
      isSessionActive: false,
      isStreaming: false,
      isCompacting: false,
      queuedCount: 0,
    }],
  });

  await assert.rejects(
    handoffSpecEpisode(LOCATION, "", context(repo), dependencies(publisher)),
    /missing \.ralph\/skills\/execute\/SKILL\.md/,
  );

  assert.deepEqual(publisher.reopens, []);
  assert.deepEqual(publisher.handoffs, []);
});

test("initial bootstrap preflights handoff and execute before publication", async (t) => {
  for (const missing of ["handoff", "execute"]) {
    const { repo, worktree } = repositoryFixture(t);
    git(repo, "rm", `.ralph/skills/${missing}/SKILL.md`);
    git(repo, "commit", "-qm", `remove ${missing}`);
    const publisher = new FakePublisher();

    await assert.rejects(
      createSpecEpisode(LOCATION, `tool-call-missing-${missing}`, context(repo), dependencies(publisher)),
      new RegExp(`missing \.ralph/skills/${missing}/SKILL\.md`),
    );

    assert.deepEqual(publisher.forks, []);
    assert.deepEqual(publisher.handoffs, []);
    assert.equal(existsSync(worktree), false);
  }
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


test("uncertain initial handoff admission preserves identity and never replays", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  const publisher = new FakePublisher();
  publisher.deliverHandoff = async (activeSessionId, handoffPrompt, executePrompt) => {
    publisher.handoffs.push({ activeSessionId, handoffPrompt, executePrompt });
    const pending = JSON.parse(readFileSync(
      join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json"),
      "utf8",
    ));
    assert.equal(pending.bootstrapAdmission, "handoff-pending");
    throw new EpisodeStateUncertainError("handoff admission uncertain");
  };

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(publisher)),
    /handoff admission uncertain/,
  );

  assert.deepEqual(publisher.kills, []);
  assert.equal(existsSync(worktree), true);
  const identityPath = join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json");
  const uncertain = JSON.parse(readFileSync(identityPath, "utf8"));
  assert.equal(uncertain.bootstrapAdmission, "handoff-uncertain");

  const replay = new FakePublisher({ sessions: [{
    activeSessionId: uncertain.episodeActiveSessionId,
    sessionId: uncertain.episodeId,
    sessionFile: uncertain.episodeSessionFile,
    sessionName: uncertain.sessionName,
    cwd: uncertain.worktree,
  }] });
  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-2", context(repo), dependencies(replay)),
    /incomplete bootstrap admission handoff-uncertain/,
  );
  assert.deepEqual(replay.handoffs, []);
  assert.deepEqual(replay.kills, []);
});

test("checkpoint write failure after handoff sends no execute and preserves pending identity", async (t) => {
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
      if (identityWrites === 2) throw new Error("checkpoint disk failure");
      baseFilesystem.writeIdentity(path, identity);
    },
  };
  const publisher = new FakePublisher();

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", context(repo), {
      git: new CliGitAdapter(), filesystem, publisher,
    }),
    /execute checkpoint could not be persisted/,
  );

  assert.equal(publisher.handoffs.length, 1);
  assert.deepEqual(publisher.kills, []);
  assert.equal(existsSync(worktree), true);
  const identity = JSON.parse(readFileSync(
    join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json"),
    "utf8",
  ));
  assert.equal(identity.bootstrapAdmission, "handoff-pending");
});

test("definite execute follow-up rejection preserves the admitted handoff", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  const publisher = new FakePublisher();
  publisher.deliverHandoff = async (activeSessionId, handoffPrompt, executePrompt, onHandoffAdmitted) => {
    publisher.handoffs.push({ activeSessionId, handoffPrompt, executePrompt });
    await onHandoffAdmitted();
    throw new HandoffFollowUpRejectedError("follow-up rejected");
  };

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(publisher)),
    /follow-up rejected/,
  );

  assert.deepEqual(publisher.kills, []);
  assert.equal(existsSync(worktree), true);
  const identity = JSON.parse(readFileSync(
    join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json"),
    "utf8",
  ));
  assert.equal(identity.bootstrapAdmission, "execute-rejected");
});

test("uncertain execute follow-up preserves the episode and records its stage", async (t) => {
  const { repo, worktree } = repositoryFixture(t);
  const publisher = new FakePublisher();
  publisher.deliverHandoff = async (activeSessionId, handoffPrompt, executePrompt, onHandoffAdmitted) => {
    publisher.handoffs.push({ activeSessionId, handoffPrompt, executePrompt });
    await onHandoffAdmitted();
    throw new EpisodeStateUncertainError("execute follow-up uncertain");
  };

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", context(repo), dependencies(publisher)),
    /execute follow-up uncertain/,
  );

  assert.deepEqual(publisher.kills, []);
  assert.equal(existsSync(worktree), true);
  const identity = JSON.parse(readFileSync(
    join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json"),
    "utf8",
  ));
  assert.equal(identity.bootstrapAdmission, "execute-uncertain");
});

test("delivered-mark failure preserves execute-pending and never replays", async (t) => {
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
      if (identityWrites === 3) throw new Error("delivered mark disk failure");
      baseFilesystem.writeIdentity(path, identity);
    },
  };
  const publisher = new FakePublisher();

  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-1", context(repo), {
      git: new CliGitAdapter(), filesystem, publisher,
    }),
    /delivered bootstrap mark could not be persisted/,
  );

  assert.deepEqual(publisher.kills, []);
  assert.equal(existsSync(worktree), true);
  const identityPath = join(repo, ".prime", "agent", "state", "spec-episodes", "alpha-plan.json");
  const identity = JSON.parse(readFileSync(identityPath, "utf8"));
  assert.equal(identity.bootstrapAdmission, "execute-pending");
  const replay = new FakePublisher({ sessions: [{
    activeSessionId: identity.episodeActiveSessionId,
    sessionId: identity.episodeId,
    sessionFile: identity.episodeSessionFile,
    sessionName: identity.sessionName,
    cwd: identity.worktree,
  }] });
  await assert.rejects(
    createSpecEpisode(LOCATION, "tool-call-2", context(repo), dependencies(replay)),
    /incomplete bootstrap admission execute-pending/,
  );
  assert.deepEqual(replay.handoffs, []);
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
        appendCustomEntry(customType, data) { appended.push({ type: "custom", customType, data }); return "identity-1"; },
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
  assert.equal(appended.length, 2);
  assert.deepEqual(appended[0], {
    type: "custom",
    customType: "prime-claw-bounded-identity",
    data: { version: 1, role: "EPISODE", sessionId: "stable-fork-id" },
  });
  assert.equal(appended[1].role, "toolResult");
  assert.equal(appended[1].toolCallId, "tool-call-9");
  assert.equal(appended[1].toolName, "create_spec_episode");
  assert.equal(appended[1].isError, false);
  assert.equal(appended[1].content[0].text, episodeResultText({
    episodeId: "stable-fork-id",
    branch: options.branch,
    worktree: options.worktree,
    sessionName: options.sessionName,
    bootstrapAdmission: "handoff-pending",
    reused: false,
  }));
});



test("episode identity append failure removes the created fork file", () => {
  const sessionFile = join(tmpdir(), `prime-claw-fork-failure-${process.pid}-${Date.now()}.jsonl`);
  writeFileSync(sessionFile, "fork");
  const SessionManager = { forkFrom() { return {
    getSessionFile: () => sessionFile,
    getSessionId: () => "failed-fork",
    appendCustomEntry() { throw new Error("identity append failed"); },
    appendMessage() { throw new Error("must not append tool result"); },
  }; } };
  assert.throws(() => forkPrimeSession(SessionManager, {
    sourceSessionFile: "/owner.jsonl", worktree: "/worktree", sessionName: "episode",
    branch: "episode/alpha", toolCallId: "call",
  }), /identity append failed/);
  assert.equal(existsSync(sessionFile), false);
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


test("publisher admits remote handoff as steer before the sole execute follow-up", async () => {
  const requests = [];
  const client = {
    async request(command) { requests.push(command); return { success: true, data: {} }; },
    close() {},
  };
  const publisher = new PrimeSessionPublisher(client);

  let checkpointCalls = 0;
  await publisher.deliverHandoff(
    "active-episode-1",
    "wrapped handoff",
    "wrapped execute",
    () => {
      checkpointCalls += 1;
      assert.equal(requests.length, 1);
      assert.equal(requests[0].streamingBehavior, "steer");
    },
  );

  assert.equal(checkpointCalls, 1);
  assert.deepEqual(requests, [{
    type: "prompt",
    activeSessionId: "active-episode-1",
    message: "wrapped handoff",
    streamingBehavior: "steer",
    queueIfBusy: false,
    expandPromptTemplates: false,
    source: "extension",
  }, {
    type: "prompt",
    activeSessionId: "active-episode-1",
    message: "wrapped execute",
    streamingBehavior: "followUp",
    queueIfBusy: true,
    expandPromptTemplates: false,
    source: "extension",
  }]);
});

test("publisher exposes first-send failure without queuing execute", async () => {
  const requests = [];
  const client = {
    async request(command) {
      requests.push(command);
      return { success: false, error: "episode became busy" };
    },
    close() {},
  };
  const publisher = new PrimeSessionPublisher(client);

  await assert.rejects(
    publisher.deliverHandoff("active-episode-1", "wrapped handoff", "wrapped execute"),
    /handoff delivery failed: episode became busy/,
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].message, "wrapped handoff");
});

test("publisher exposes second-send failure as a partial transition", async () => {
  const requests = [];
  const client = {
    async request(command) {
      requests.push(command);
      return requests.length === 1
        ? { success: true, data: {} }
        : { success: false, error: "follow-up rejected" };
    },
    close() {},
  };
  const publisher = new PrimeSessionPublisher(client);

  await assert.rejects(
    publisher.deliverHandoff("active-episode-1", "wrapped handoff", "wrapped execute"),
    /Handoff was admitted, but canonical execute follow-up could not be queued: execute follow-up delivery failed: follow-up rejected/,
  );
  assert.equal(requests.length, 2);
  assert.equal(requests[0].streamingBehavior, "steer");
  assert.equal(requests[1].streamingBehavior, "followUp");
});

test("publisher distinguishes uncertain first and second handoff mutations", async () => {
  const firstRequests = [];
  const firstPublisher = new PrimeSessionPublisher({
    async request(command) {
      firstRequests.push(command);
      throw new DaemonMutationUncertainError("prompt", "connection closed");
    },
    close() {},
  });
  await assert.rejects(
    firstPublisher.deliverHandoff("active-episode-1", "wrapped handoff", "wrapped execute"),
    (error) => error instanceof EpisodeStateUncertainError && /Handoff task admission is uncertain/.test(error.message),
  );
  assert.equal(firstRequests.length, 1);

  const secondRequests = [];
  const secondPublisher = new PrimeSessionPublisher({
    async request(command) {
      secondRequests.push(command);
      if (secondRequests.length === 1) return { success: true, data: {} };
      throw new DaemonMutationUncertainError("prompt", "connection closed");
    },
    close() {},
  });
  await assert.rejects(
    secondPublisher.deliverHandoff("active-episode-1", "wrapped handoff", "wrapped execute"),
    (error) => error instanceof EpisodeStateUncertainError && /Execute follow-up admission is uncertain after handoff admission/.test(error.message),
  );
  assert.equal(secondRequests.length, 2);
});

test("publisher retrieves the exact active episode state before admission", async () => {
  const requests = [];
  const state = { activeSessionId: "active-episode-1", isStreaming: false };
  const client = {
    async request(command) { requests.push(command); return { success: true, data: state }; },
    close() {},
  };
  const publisher = new PrimeSessionPublisher(client);

  assert.equal(await publisher.getState("active-episode-1"), state);
  assert.deepEqual(requests, [{ type: "get_state", activeSessionId: "active-episode-1" }]);
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
