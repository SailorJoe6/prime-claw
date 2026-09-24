import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { authorizeEpisodeFinalization, completeEpisodeFinalization, parseFinalizationReceipt, recoverCompletingEpisodeFinalization, acquireNativeFinalizationLock } from "../src/prime-agent-plugin/extension-support/episode-finalization.ts";

const LOCATION = ".ralph/plans/future/alpha";
const EPISODE = "a".repeat(40);
const TARGET = "b".repeat(40);
const MERGED_TARGET = "c".repeat(40);
const EPISODE_UUID = "11111111-1111-4111-8111-111111111111";
const OTHER_UUID = "22222222-2222-4222-8222-222222222222";
const marker = (status = "active", extra = {}) => ({ markerVersion: 2, status, ownerSessionId: "owner", sourceLocation: LOCATION,
  slug: "alpha", episodeId: EPISODE_UUID, episodeSessionFile: "/sessions/episode.jsonl",
  branch: "episode/alpha", worktree: "/worktree", sessionName: "alpha-episode", identityVersion: 2, admission: "delivered", ...extra });

function fixture(options = {}) {
  const repo = "/repo";
  const identityPath = "/repo/.prime/agent/state/spec-episodes/alpha.json";
  const receiptPath = "/repo/.prime/agent/state/spec-episodes/alpha.finalization.json";
  const files = new Map();
  const record = { version: 2, slug: "alpha", sourceLocation: LOCATION, ownerSessionId: options.owner ?? "owner",
    episodeId: EPISODE_UUID, episodeActiveSessionId: "route", episodeSessionFile: "/sessions/episode.jsonl",
    branch: "episode/alpha", worktree: "/worktree", sessionName: "alpha-episode", bootstrapAdmission: "delivered" };
  files.set(identityPath, record);
  let targetBranch = options.targetBranch ?? "main";
  let episodeTip = options.episodeTip ?? EPISODE;
  let targetTip = options.targetTip ?? (options.merged === false ? TARGET : MERGED_TARGET);
  let sessions = options.sessions ?? [];
  let worktrees = options.worktree ? [{ path: "/worktree", branch: "episode/alpha" }] : [{ path: "/repo", branch: "main" }];
  let closed = 0, writes = 0, removes = 0;
  let lockTail = Promise.resolve();
  const fail = { ...(options.fail ?? {}) };
  const deps = {
    async listSessions() { if (fail.list) throw Error("daemon failed"); return structuredClone(sessions); },
    close() { closed++; }, repositoryRoot() { return repo; }, currentBranch() { if (fail.branch) throw Error("branch failed"); return targetBranch; },
    worktrees() { if (fail.worktrees) throw Error("worktrees failed"); return structuredClone(worktrees); },
    commit(_repo, ref) {
      if (fail.commit === ref) throw Error("corrupt object");
      if (ref === "episode/alpha" || ref === EPISODE) return episodeTip;
      if (ref === "refs/heads/main") return targetTip;
      if (/^[0-9a-f]{40}$/.test(ref)) return ref;
      throw Error("unknown ref " + ref);
    },
    isAncestor(_repo, ancestor, descendant) {
      if (fail.ancestor) throw Error("git ancestry error");
      if (ancestor === descendant) return true;
      if (ancestor === TARGET && descendant === targetTip) return true;
      if (ancestor === EPISODE && descendant === targetTip) return options.merged !== false;
      return false;
    },
    exists(path) { return path === "/worktree" ? Boolean(options.worktree) : files.has(path); },
    readJson(path) { if (!files.has(path)) throw Error("missing " + path); return structuredClone(files.get(path)); },
    writeJson(path, value) { writes++; if (fail.writeAt === writes) throw Error("write failed " + writes); files.set(path, structuredClone(value)); },
    remove(path) { removes++; if (fail.removeAt === removes) throw Error("remove failed"); files.delete(path); },
    now() { return `2026-01-01T00:00:0${writes}.000Z`; },
    async acquireLock() {
      const predecessor = lockTail;
      let unlock;
      lockTail = new Promise(resolve => { unlock = resolve; });
      await predecessor;
      return async () => unlock();
    },
  };
  const ctx = { cwd: repo, sessionManager: { getSessionId() { return "owner"; } } };
  return { identityPath, receiptPath, record, files, deps, ctx, fail,
    set targetBranch(value) { targetBranch = value; }, set episodeTip(value) { episodeTip = value; },
    set targetTip(value) { targetTip = value; }, set sessions(value) { sessions = value; }, set worktrees(value) { worktrees = value; },
    get closed() { return closed; }, get writes() { return writes; }, get removes() { return removes; } };
}
async function authorize(f, disposition = "merged", selectedMarker = marker()) {
  return authorizeEpisodeFinalization(LOCATION, disposition, f.ctx, async () => true, selectedMarker, f.deps);
}
async function complete(f, disposition = "merged", selectedMarker = marker(), append = () => {}) {
  return completeEpisodeFinalization(LOCATION, disposition, f.ctx, append, selectedMarker, f.deps);
}

test("authorization binds exact active identity, marker, target, and episode commit; replay never reconfirms", async () => {
  const f = fixture(); const confirmations = [];
  const confirm = async (title, message) => { confirmations.push({ title, message }); return true; };
  const first = await authorizeEpisodeFinalization(LOCATION, "merged", f.ctx, confirm, marker("active", { episodeActiveSessionId: "stale-route" }), f.deps);
  assert.equal(first.reused, false); assert.equal(confirmations.length, 1);
  assert.match(confirmations[0].message, /Target: main \(refs\/heads\/main\)/);
  assert.match(confirmations[0].message, new RegExp(MERGED_TARGET));
  assert.match(confirmations[0].message, new RegExp(EPISODE));
  assert.deepEqual(Object.assign({}, first.receipt, { authorizedAt: "x" }), {
    version: 2, state: "authorized", sourceLocation: LOCATION, slug: "alpha", disposition: "merged", ownerSessionId: "owner",
    episodeId: EPISODE_UUID, episodeActiveSessionId: "route", episodeSessionFile: "/sessions/episode.jsonl",
    episodeBranch: "episode/alpha", episodeWorktree: "/worktree", sessionName: "alpha-episode", identityVersion: 2, admission: "delivered",
    episodeCommit: EPISODE, targetBranch: "main", targetRef: "refs/heads/main", targetCommitAtAuthorization: MERGED_TARGET, authorizedAt: "x" });
  const replay = await authorizeEpisodeFinalization(LOCATION, "merged", f.ctx, confirm, marker(), f.deps);
  assert.equal(replay.reused, true); assert.equal(confirmations.length, 1);
});

test("authorization rejects weak identity, mismatched marker, episode target, cancellation, and conflicting replay", async () => {
  const invalids = [
    [fixture({ owner: "other" }), marker(), /owner mismatch/],
    [fixture(), marker("inactive"), /Exact oversight marker/],
    [fixture(), marker("active", { slug: "other" }), /Exact oversight marker/],
    [fixture({ targetBranch: "episode/alpha" }), marker(), /cannot be the finalization target/],
  ];
  for (const [f, value, pattern] of invalids) await assert.rejects(authorize(f, "merged", value), pattern);
  const malformed = fixture(); malformed.files.set(malformed.identityPath, { version: 2 });
  await assert.rejects(authorize(malformed), /episode identity/);
  const cancelled = fixture();
  await assert.rejects(authorizeEpisodeFinalization(LOCATION, "merged", cancelled.ctx, async () => false, marker(), cancelled.deps), /cancelled/);
  const conflict = fixture(); await authorize(conflict);
  await assert.rejects(authorize(conflict, "abandoned"), /different terminal/);
  await assert.rejects(authorize(conflict, "merged", marker("active", { worktree: "/other" })), /Exact oversight marker/);
});

test("strict receipt parser rejects partial, extra, malformed ref, and non-commit object ids", async () => {
  const f = fixture(); const value = (await authorize(f)).receipt;
  for (const candidate of [
    { ...value, episodeCommit: "tag" }, { ...value, episodeId: "not-a-uuid" },
    { ...value, targetRef: "refs/heads/other" }, { ...value, extra: true }, Object.fromEntries(Object.entries(value).filter(([key]) => key !== "slug")),
    { ...value, state: "completed" },
  ]) assert.throws(() => parseFinalizationReceipt(candidate), /corrupt/);
});

test("completion requires exact commit objects, unchanged episode tip, target branch, and successful ancestry", async () => {
  for (const mutate of [
    f => { f.targetBranch = "release"; }, f => { f.episodeTip = "d".repeat(40); },
    f => { f.fail.commit = EPISODE; }, f => { f.fail.ancestor = true; }, f => { f.targetTip = "e".repeat(40); },
  ]) {
    const f = fixture(); await authorize(f); mutate(f);
    await assert.rejects(complete(f), /blocked with durable recovery evidence/);
    assert.equal(f.files.get(f.receiptPath).state, "authorized"); assert.equal(f.files.has(f.identityPath), true);
  }
});

test("merged and abandoned facts are checked against the bound target ref", async () => {
  const notMerged = fixture({ merged: false }); await authorize(notMerged, "merged");
  await assert.rejects(complete(notMerged, "merged"), /not merged/);
  const merged = fixture({ merged: true }); await authorize(merged, "abandoned");
  await assert.rejects(complete(merged, "abandoned"), /already merged/);
  const abandoned = fixture({ merged: false }); await authorize(abandoned, "abandoned");
  const transitions = []; const result = await complete(abandoned, "abandoned", marker(), status => transitions.push(status));
  assert.equal(result.state, "completed"); assert.deepEqual(transitions, ["inactive"]);
});

test("completion rejects addressable, conflicting, partial, malformed daemon state and worktree state", async () => {
  const cases = [
    { sessions: [{ sessionId: EPISODE_UUID, activeSessionId: "route", sessionFile: "/sessions/episode.jsonl", isSessionActive: false }] },
    { sessions: [{ sessionId: EPISODE_UUID, activeSessionId: "other-route", sessionFile: "/other.jsonl" }] },
    { sessions: [{ sessionId: OTHER_UUID, activeSessionId: "other-route", sessionFile: "/sessions/episode.jsonl" }] },
    { sessions: [{ sessionId: OTHER_UUID, activeSessionId: "route", sessionFile: "/other.jsonl" }] },
    { sessions: [{ sessionId: OTHER_UUID, id: EPISODE_UUID, activeSessionId: "other-route", sessionFile: "/other.jsonl" }] },
    { sessions: [{ sessionId: "not-a-uuid", activeSessionId: "other-route", sessionFile: "/other.jsonl" }] },
    { sessions: [{ sessionId: OTHER_UUID }] }, { sessions: [null] }, { worktree: true },
  ];
  for (const options of cases) { const f = fixture(options); await authorize(f); await assert.rejects(complete(f), /blocked/); }
  const f = fixture(); await authorize(f); f.worktrees = [{ path: "/other", branch: "episode/alpha" }];
  await assert.rejects(complete(f), /addressable/);
});

test("successful completion leaves a durable tombstone and identical complete/authorize replay returns it", async () => {
  const f = fixture(); await authorize(f); const transitions = [];
  const first = await complete(f, "merged", marker(), status => transitions.push(status));
  assert.equal(first.state, "completed"); assert.deepEqual(transitions, ["inactive"]);
  assert.equal(f.files.has(f.identityPath), false); assert.equal(f.files.has(f.receiptPath), true);
  const completeReplay = await complete(f, "merged", marker("inactive"), () => { throw Error("must not append"); });
  assert.deepEqual(completeReplay, first);
  let confirms = 0;
  const authorizeReplay = await authorizeEpisodeFinalization(LOCATION, "merged", f.ctx, async () => { confirms++; return true; }, marker("inactive"), f.deps);
  assert.equal(authorizeReplay.reused, true); assert.equal(authorizeReplay.receipt.state, "completed"); assert.equal(confirms, 0);
});

test("failure at every durable completion boundary preserves a visible monotonic recovery record", async () => {
  // first write is authorization. Completion writes completing (2), then removes identity, then writes completed (3).
  for (const fail of [{ writeAt: 2 }, { removeAt: 1 }, { writeAt: 3 }]) {
    const f = fixture({ fail }); await authorize(f); const transitions = [];
    await assert.rejects(complete(f, "merged", marker(), status => transitions.push(status)), /durable recovery evidence preserved/);
    const saved = parseFinalizationReceipt(f.files.get(f.receiptPath));
    assert.ok(saved.state === "authorized" || saved.state === "completing");
    assert.notEqual(saved.state, "completed");
    const recovered = await complete(f, "merged", marker(transitions.length ? "inactive" : "active"));
    assert.equal(recovered.state, "completed");
  }
  const f = fixture(); await authorize(f);
  await assert.rejects(complete(f, "merged", marker(), () => { throw Error("append failed"); }), /durable recovery evidence preserved/);
  assert.equal(f.files.get(f.receiptPath).state, "completing"); assert.equal(f.files.has(f.identityPath), true);
  assert.equal((await complete(f, "merged", marker())).state, "completed");
});

test("replay reconciles completing records whether identity and inactive append crossed the crash boundary", async () => {
  for (const scenario of [
    { removeIdentity: false, status: "active", transitions: ["inactive"] },
    { removeIdentity: true, status: "active", transitions: ["inactive"] },
    { removeIdentity: true, status: "inactive", transitions: [] },
  ]) {
    const f = fixture(); await authorize(f);
    const authorization = f.files.get(f.receiptPath);
    f.files.set(f.receiptPath, { ...authorization, state: "completing", completingAt: "2026-01-01T00:00:01.000Z" });
    if (scenario.removeIdentity) f.files.delete(f.identityPath);
    const transitions = [];
    const result = await complete(f, "merged", marker(scenario.status), status => transitions.push(status));
    assert.equal(result.state, "completed"); assert.deepEqual(transitions, scenario.transitions);
  }
});


test("lifecycle truth table blocks impossible or reappearing expectation states", async () => {
  const impossible = fixture(); await authorize(impossible);
  impossible.files.delete(impossible.identityPath);
  await assert.rejects(complete(impossible, "merged", marker("active")), /missing before completion began|exact recoverable crash boundary/);

  const completed = fixture(); await authorize(completed);
  await complete(completed, "merged", marker(), () => {});
  completed.files.set(completed.identityPath, completed.record);
  await assert.rejects(complete(completed, "merged", marker("inactive")), /exact recoverable crash boundary/);
  await assert.rejects(authorize(completed, "merged", marker("inactive")), /exact recoverable crash boundary/);
});

test("native recovery helper completes only a completing receipt without a provider call", async () => {
  const f = fixture(); await authorize(f);
  const authorization = f.files.get(f.receiptPath);
  f.files.set(f.receiptPath, { ...authorization, state: "completing", completingAt: "2026-01-01T00:00:01.000Z" });
  const transitions = [];
  const recovered = await recoverCompletingEpisodeFinalization(
    f.ctx,
    status => transitions.push(status),
    marker(),
    f.deps,
  );
  assert.equal(recovered.state, "completed");
  assert.deepEqual(transitions, ["inactive"]);
  assert.equal(f.files.has(f.identityPath), false);

  const quiet = fixture();
  assert.equal(await recoverCompletingEpisodeFinalization(quiet.ctx, () => { throw Error("must not append"); }, marker(), quiet.deps), null);
});


test("delayed overlapping authorization reacquires and returns the completed winner", async () => {
  const f = fixture();
  let enteredResolve, approveResolve;
  const entered = new Promise(resolve => { enteredResolve = resolve; });
  const approval = new Promise(resolve => { approveResolve = resolve; });
  let firstConfirms = 0, secondConfirms = 0;
  const firstPromise = authorizeEpisodeFinalization(LOCATION, "merged", f.ctx, async () => {
    firstConfirms++; enteredResolve(); return approval;
  }, marker(), f.deps);
  await entered;
  const secondPromise = authorizeEpisodeFinalization(LOCATION, "merged", f.ctx, async () => {
    secondConfirms++; return true;
  }, marker(), f.deps);
  const second = await secondPromise;
  assert.equal(second.reused, false);
  assert.equal(secondConfirms, 1);
  const transitions = [];
  const completed = await complete(f, "merged", marker("active"), status => transitions.push(status));
  assert.equal(completed.state, "completed");
  approveResolve(true);
  const first = await firstPromise;
  assert.equal(first.reused, true);
  assert.deepEqual(completed, first.receipt);
  assert.equal(firstConfirms, 1);
  assert.equal(f.writes, 3);
});

test("delayed overlapping completion returns the durable completed winner to an exact stale replay", async () => {
  const f = fixture(); await authorize(f);
  const originalList = f.deps.listSessions;
  let enteredResolve, continueResolve;
  const entered = new Promise(resolve => { enteredResolve = resolve; });
  const continuation = new Promise(resolve => { continueResolve = resolve; });
  let firstList = true;
  f.deps.listSessions = async () => {
    if (firstList) { firstList = false; enteredResolve(); await continuation; }
    return originalList();
  };
  const firstTransitions = [], secondTransitions = [];
  const firstPromise = complete(f, "merged", marker("active"), status => firstTransitions.push(status));
  await entered;
  const secondPromise = complete(f, "merged", marker("active"), status => secondTransitions.push(status));
  continueResolve();
  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(first.state, "completed");
  assert.deepEqual(second, first);
  assert.deepEqual(firstTransitions, ["inactive"]);
  assert.deepEqual(secondTransitions, []);
  assert.equal(f.files.has(f.identityPath), false);
});

test("native transaction lock is kernel-released after SIGTERM and restart preserves a completing receipt", async t => {
  const dir = mkdtempSync(join(tmpdir(), "prime-claw-finalization-lock-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const lockPath = join(dir, "alpha.finalization.json.transaction.lock");
  const receiptPath = join(dir, "alpha.finalization.json");
  writeFileSync(receiptPath, JSON.stringify({ state: "completing" }));
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/prime-agent-plugin/extension-support/episode-finalization.ts")).href;
  const script = `import { acquireNativeFinalizationLock } from ${JSON.stringify(moduleUrl)}; await acquireNativeFinalizationLock(${JSON.stringify(lockPath)}); process.stdout.write("held\\n"); setInterval(() => {}, 1000);`;
  const child = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.stdout.once("data", chunk => String(chunk).includes("held") ? resolve() : reject(Error(`unexpected child output: ${chunk}`)));
    child.once("exit", (code, signal) => reject(Error(`lock owner exited before interruption: ${code}/${signal}`)));
  });
  child.kill("SIGTERM");
  await new Promise(resolve => child.once("exit", resolve));
  const release = await acquireNativeFinalizationLock(lockPath);
  assert.deepEqual(JSON.parse(String(await import("node:fs").then(fs => fs.readFileSync(receiptPath)))), { state: "completing" });
  await release();
});
