import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  CliOrcaAdapter, EpisodeStateUncertainError, OrcaMutationUncertainError, OrcaUnavailableError,
  bundleContentDigest, createSpecEpisode, handoffSpecEpisode,
} from "../src/prime-agent-plugin/extension-support/spec-episode.ts";
import { parseEpisodeOwnership } from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";

const LOCATION = ".ralph/plans/future/alpha";
function diskFixture() {
  const rawRoot = mkdtempSync(join(tmpdir(), "prime-claw-episode-"));
  execFileSync("git", ["init", "-q", rawRoot]);
  const root = realpathSync(rawRoot);
  mkdirSync(join(root, ".ralph", "plans", "future", "alpha"), { recursive: true });
  writeFileSync(join(root, ".ralph", "plans", "future", "alpha", "SPECIFICATION.md"), "spec");
  writeFileSync(join(root, ".ralph", "plans", "future", "alpha", "EXECUTION_PLAN.md"), "plan");
  mkdirSync(join(root, ".agents", "skills", "execute"), { recursive: true });
  writeFileSync(join(root, ".agents", "skills", "execute", "SKILL.md"), `---
name: execute
---
EXECUTE POLICY
`);
  mkdirSync(join(root, ".prime-claw", "workflows"), { recursive: true });
  writeFileSync(join(root, ".prime-claw", "workflows", "handoff.md"), `---
name: handoff
---
HANDOFF POLICY
`);
  const worktree = join(root, "episode-worktree");
  mkdirSync(join(worktree, ".agents", "skills", "execute"), { recursive: true });
  writeFileSync(join(worktree, ".agents", "skills", "execute", "SKILL.md"), `---
name: execute
---
EXECUTE POLICY
`);
  mkdirSync(join(worktree, ".prime-claw", "workflows"), { recursive: true });
  writeFileSync(join(worktree, ".prime-claw", "workflows", "handoff.md"), `---
name: handoff
---
HANDOFF POLICY
`);
  return { root, worktree };
}
function setup(id = "setup-local", hostId = "local", route) {
  return { id, projectId: "project", hostId, path: "/project", displayName: "prime-claw", environmentLabel: hostId, ...(route ? { routingEnvironmentId: route } : {}) };
}
function harness(options = {}) {
  const disk = diskFixture(); const calls = []; let record = options.record ?? null;
  const wt = { id: `repo::${disk.worktree}`, identity: "wt2:local:one", path: disk.worktree, branch: "JLanders/generated", head: "base", projectSetupId: "setup-local" };
  const git = {
    entries: [{ path: disk.root, branch: "main" }, { path: disk.worktree, branch: wt.branch }],
    repositoryRoot: () => disk.root, head: (path) => path === disk.root ? "base" : "promoted",
    branch: () => wt.branch, worktrees() { return this.entries; },
    createWorktree(_repo, branch, path, base) { calls.push(["local-create", branch, path, base]); mkdirSync(path, { recursive: true }); this.entries.push({ path, branch }); mkdirSync(join(path, ".agents", "skills", "execute"), { recursive: true }); writeFileSync(join(path, ".agents", "skills", "execute", "SKILL.md"), "EXECUTE POLICY"); mkdirSync(join(path, ".prime-claw", "workflows"), { recursive: true }); writeFileSync(join(path, ".prime-claw", "workflows", "handoff.md"), "HANDOFF POLICY"); },
    assertCleanWorktree(path) { calls.push(["clean", path]); },
    commitPromotion(path) { calls.push(["commit", path]); return "promoted"; }, removeCreatedWorktree() { calls.push(["remove-local"]); },
  };
  const filesystem = { exists: (path) => options.unavailable ? !String(path).includes("-alpha-episode-") : true, promoteBundle(path) { calls.push(["promote", path]); } };
  const ownership = { read: () => record, write(_root, value) { record = structuredClone(value); calls.push(["ownership", value.status]); } };
  const published = { activeSessionId: "route", sessionId: "episode", sessionFile: join(disk.root, "episode.jsonl") };
  let listCount = 0;
  const session = { ...published, cwd: disk.worktree, sessionName: "alpha-episode", isSessionActive: false, isStreaming: false, isCompacting: false, queuedCount: 0 };
  const publisher = {
    async list() { listCount += 1; return options.list ? options.list(listCount, session) : (listCount === 1 ? [] : [session]); },
    async getState() { return { ...session, isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false, unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [], active: null } }; },
    async createFresh(args) { calls.push(["fresh", args]); await args.onAllocated?.({ sessionId: published.sessionId, sessionFile: published.sessionFile }); return published; },
    async reopen(args) { calls.push(["reopen", args]); return published; },
    async deliverExecute(_route, prompt) { calls.push(["execute", prompt]); },
    async deliverHandoff(_route, handoff, execute) { calls.push(["handoff", handoff, execute]); },
    async kill() { return true; }, close() { calls.push(["close"]); },
  };
  const localSetup = setup();
  const orca = {
    async listReadySetups() { calls.push(["setups"]); if (options.unavailable) throw new OrcaUnavailableError("missing"); return options.setups ?? [localSetup]; },
    async createWorktree(args) { calls.push(["orca-create", args]); if (options.createError) throw options.createError; return wt; },
    async showWorktree() { calls.push(["orca-show"]); return wt; },
    async createLaunchAutomation(args) { calls.push(["auto-create", args]); if (options.autoCreateError) throw options.autoCreateError; return "automation"; },
    async runAutomation(id) { calls.push(["auto-run", id]); if (options.runError) throw options.runError; return "run"; },
    async removeAutomation(id) { calls.push(["auto-remove", id]); if (options.removeError) throw options.removeError; },
    async listTerminals() { return options.terminals ?? [{ handle: "terminal", connected: true, writable: true, agentIdentity: "prime-agent", worktreeId: wt.id, worktreePath: wt.path, tabId: "tab", leafId: "leaf", visible: true }]; },
    async readTerminalScreen() { return options.screen ?? { source: "screen", text: "← manage model" }; },
  };
  const ctx = {
    cwd: disk.root, hasUI: options.hasUI ?? true,
    ui: { async select(_title, labels) { calls.push(["picker", labels]); return options.pick?.(labels); } },
    sessionManager: { getSessionId: () => "owner", getSessionFile: () => join(disk.root, "owner.jsonl"), getHeader: () => ({ rlmDepth: 0 }) },
    model: { provider: "provider", id: "model" },
  };
  return { ...disk, wt, calls, git, filesystem, ownership, publisher, orca, ctx, deps: { git, filesystem, ownership, publisher, orca, wait: async () => {}, bindingAttempts: 1 }, get record() { return record; } };
}
function createApproved(f, options = {}) {
  const approvedBundleDigest = bundleContentDigest(join(f.root, ".ralph", "plans", "future", "alpha"));
  return createSpecEpisode(LOCATION, "tool", f.ctx, f.deps, { ...options, approvedBundleDigest });
}

test("Orca creation promotes before exactly one native execute assignment and removes launcher", async () => {
  const f = harness(); const result = await createApproved(f);
  assert.equal(result.engine, "orca"); assert.equal(result.status, "active"); assert.equal(result.reused, false);
  const names = f.calls.map((call) => call[0]);
  assert.ok(names.indexOf("promote") < names.indexOf("auto-create"));
  assert.ok(names.indexOf("commit") < names.indexOf("auto-create"));
  assert.deepEqual(names.filter((name) => name === "auto-run"), ["auto-run"]);
  assert.equal(names.includes("fresh"), false); assert.equal(names.includes("execute"), false); assert.equal(names.includes("handoff"), false);
  const automation = f.calls.find((call) => call[0] === "auto-create")[1];
  assert.match(automation.prompt, /EXECUTE POLICY/); assert.equal(automation.worktreeId, f.wt.id);
  assert.ok(names.indexOf("auto-remove") < names.lastIndexOf("ownership"));
  assert.equal(f.record.launchAutomationId, undefined); assert.match(f.record.launchAutomationName, /^prime-claw-launch-/);
  assert.equal(f.record.terminalHandle, "terminal");
});

test("single ready setup bypasses picker", async () => {
  const f = harness(); await createApproved(f);
  assert.equal(f.calls.some((call) => call[0] === "picker"), false);
});

test("multiple setups use stable labeled picker and selected local id", async () => {
  const second = setup("setup-second");
  const f = harness({ setups: [setup(), second], pick: (labels) => labels[1] });
  f.orca.createWorktree = async (args) => { f.calls.push(["orca-create", args]); return { ...f.wt, projectSetupId: second.id }; };
  const result = await createApproved(f);
  assert.equal(result.projectSetupId, second.id);
  assert.match(f.calls.find((call) => call[0] === "picker")[1][1], /id:setup-second/);
});

test("stable host bypass selects exact setup without picker", async () => {
  const second = setup("123e4567-e89b-12d3-a456-426614174000"); const f = harness({ setups: [setup(), second] });
  f.orca.createWorktree = async (args) => ({ ...f.wt, projectSetupId: args.setup.id });
  const result = await createApproved(f, { host: "id:123e4567-e89b-12d3-a456-426614174000" });
  assert.equal(result.projectSetupId, "123e4567-e89b-12d3-a456-426614174000"); assert.equal(f.calls.some((call) => call[0] === "picker"), false);
});

for (const [name, options, pattern] of [
  ["picker cancellation", { setups: [setup(), setup("two")], pick: () => undefined }, /cancelled/],
  ["noninteractive ambiguity", { setups: [setup(), setup("two")], hasUI: false }, /noninteractive/],
  ["zero ready setups", { setups: [] }, /No ready/],
]) test(`${name} creates nothing`, async () => {
  const f = harness(options); await assert.rejects(createApproved(f), pattern);
  assert.equal(f.calls.some((call) => call[0] === "orca-create" || call[0] === "local-create"), false);
  assert.equal(f.record, null);
});

test("remote selection is rejected before mutation and never falls back", async () => {
  const remote = setup("remote", "runtime:env", "env"); const f = harness({ setups: [remote] });
  await assert.rejects(createApproved(f), /Remote Episode placement is disabled/);
  assert.equal(f.calls.some((call) => call[0] === "orca-create" || call[0] === "local-create"), false);
});

test("definitive pre-mutation Orca unavailability uses fresh local fallback once", async () => {
  const f = harness({ unavailable: true }); const result = await createApproved(f);
  assert.equal(result.engine, "local"); assert.equal(result.status, "active");
  assert.equal(f.calls.filter((call) => call[0] === "fresh").length, 1);
  assert.equal(f.calls.filter((call) => call[0] === "execute").length, 1);
  assert.equal(f.calls.some((call) => call[0] === "handoff" || call[0] === "orca-create"), false);
});

test("local worktree identity is durable before fallback mutation", async () => {
  const f = harness({ unavailable: true });
  f.git.createWorktree = () => { throw new Error("ambiguous local create"); };
  await assert.rejects(createApproved(f), /ambiguous local create/);
  assert.equal(f.record.status, "uncertain");
  assert.match(f.record.worktree, /-alpha-episode-/);
  assert.match(f.record.branch, /^episode\/alpha-/);
  assert.equal(f.record.head, "base");
});

for (const [name, option, value] of [
  ["worktree create", "createError", new OrcaMutationUncertainError("create", "lost")],
  ["automation run", "runError", new OrcaMutationUncertainError("run", "lost")],
  ["automation removal", "removeError", new OrcaMutationUncertainError("remove", "lost")],
]) test(`${name} uncertainty preserves one record and never falls back`, async () => {
  const f = harness({ [option]: value }); await assert.rejects(createApproved(f));
  assert.equal(f.record.status, "uncertain"); assert.equal(f.record.engine, "orca");
  assert.equal(f.calls.some((call) => call[0] === "local-create"), false);
  if (option === "removeError") { assert.equal(f.record.episodeId, "episode"); assert.equal(f.record.launchAutomationId, "automation"); }
});

test("active replay refreshes route without replaying assignment", async () => {
  const f0 = harness(); const active = await createApproved(f0);
  const f = harness({ record: { ...active, reused: undefined }, list: () => [{ sessionId: "episode", sessionFile: active.episodeSessionFile, cwd: active.worktree }] });
  f.git.entries = [{ path: f.root, branch: "main" }, { path: active.worktree, branch: active.branch }];
  f.filesystem.exists = () => true; f.orca.showWorktree = async () => ({ ...f.wt, id: active.worktreeId, identity: active.worktreeIdentity, path: active.worktree, branch: active.branch, projectSetupId: active.projectSetupId, head: active.head });
  const result = await createApproved(f);
  assert.equal(result.reused, true); assert.equal(f.calls.some((call) => ["auto-run", "execute", "handoff"].includes(call[0])), false);
  assert.equal(f.calls.some((call) => call[0] === "reopen"), true);
});

test("uncertain replay never replays assignment", async () => {
  const f = harness({ record: { version: 1, status: "uncertain", operationId: "op", engine: "local", ownerSessionId: "owner", sourceLocation: LOCATION, slug: "alpha", baseRef: "base", bundleDigest: "0".repeat(64), createdAt: "x", updatedAt: "x", uncertaintyReason: "lost" } });
  await assert.rejects(createApproved(f), /No assignment was replayed/);
  assert.equal(f.calls.some((call) => ["auto-run", "execute", "fresh"].includes(call[0])), false);
});

test("handoff uses exact active ownership and queues canonical execute only after quiescence", async () => {
  const f0 = harness(); const active = await createApproved(f0);
  const f = harness({ record: { ...active, reused: undefined }, list: () => [{ activeSessionId: "route", sessionId: "episode", sessionFile: active.episodeSessionFile, cwd: active.worktree, isSessionActive: false, isStreaming: false, isCompacting: false, queuedCount: 0 }] });
  f.git.entries = [{ path: f.root, branch: "main" }, { path: active.worktree, branch: active.branch }];
  f.orca.showWorktree = async () => ({ ...f.wt, id: active.worktreeId, identity: active.worktreeIdentity, path: active.worktree, branch: active.branch, projectSetupId: active.projectSetupId, head: active.head });
  f.publisher.getState = async () => ({ activeSessionId: "route", sessionId: "episode", sessionFile: active.episodeSessionFile, isSessionActive: false, isStreaming: false, isCompacting: false, isBashRunning: false, isRunningTools: false, hasRunningRlmChildren: false, unfinishedActionCount: 0, sessionActions: { queuedCount: 0, steering: [], followUps: [], active: null } });
  const result = await handoffSpecEpisode(LOCATION, "fix accepted defect", f.ctx, f.deps);
  assert.equal(result.handoffDelivery, "prompt"); assert.equal(result.executeDelivery, "followUp");
  const call = f.calls.find((value) => value[0] === "handoff"); assert.match(call[1], /fix accepted defect/); assert.match(call[2], /EXECUTE POLICY/);
});

test("ownership parser requires active durable and Orca bindings", () => {
  assert.throws(() => parseEpisodeOwnership({ version: 1, status: "active", engine: "orca" }), /unsupported shape/);
});

test("bundle bytes are bound before any ownership or external mutation", async () => {
  const f = harness();
  const folder = join(f.root, ".ralph", "plans", "future", "alpha");
  const approvedBundleDigest = bundleContentDigest(folder);
  writeFileSync(join(folder, "SPECIFICATION.md"), "changed after approval");
  await assert.rejects(createSpecEpisode(LOCATION, "tool", f.ctx, f.deps, { approvedBundleDigest }), /Approved bundle changed/);
  assert.deepEqual(f.calls, [["close"]]); assert.equal(f.record, null);
});

test("uncertain local publication preserves allocated durable session identity", async () => {
  const f = harness({ unavailable: true });
  f.publisher.createFresh = async (args) => {
    await args.onAllocated?.({ sessionId: "allocated", sessionFile: join(f.root, "allocated.jsonl") });
    throw new EpisodeStateUncertainError("publication uncertain");
  };
  await assert.rejects(createApproved(f), /publication uncertain/);
  assert.equal(f.record.status, "uncertain"); assert.equal(f.record.episodeId, "allocated");
  assert.equal(f.record.episodeSessionFile, join(f.root, "allocated.jsonl"));
  assert.equal(f.calls.some((call) => call[0] === "execute"), false);
});

test("Orca binding requires positive visible provider readiness", async () => {
  const f = harness({ screen: { source: "screen-unavailable", text: "starting" } });
  await assert.rejects(createApproved(f), /Timed out binding/);
  assert.equal(f.record.status, "uncertain"); assert.equal(f.calls.some((call) => call[0] === "auto-remove"), false);
});

test("CLI Orca adapter encodes background provider launch without activate", async () => {
  const commands = [];
  const runner = (args) => {
    commands.push(args);
    const key = args.slice(0, 2).join(" ");
    if (key === "project setups") return JSON.stringify({ ok: true, result: { setups: [{ id: "setup", projectId: "project", hostId: "local", path: "/repo", displayName: "repo", setupState: "ready" }] } });
    if (key === "environment list") return JSON.stringify({ ok: true, result: { environments: [] } });
    if (key === "worktree create") return JSON.stringify({ ok: true, result: { worktree: { id: "repo::/wt", identity: { key: "wt2:local:one" }, path: "/wt", branch: "refs/heads/generated", head: "base", projectHostSetupId: "setup" } } });
    if (key === "automations create") return JSON.stringify({ ok: true, result: { automation: { id: "auto" } } });
    if (key === "automations run") return JSON.stringify({ ok: true, result: { run: { id: "run" } } });
    if (key === "automations remove") return JSON.stringify({ ok: true, result: {} });
    if (key === "terminal list") return JSON.stringify({ ok: true, result: {
      terminals: [{ handle: "term", worktreeId: "repo::/wt", worktreePath: "/wt", connected: true, writable: true, agentIdentity: "prime-agent", tabId: "tab", leafId: "leaf" }],
      visualLayouts: [{ worktreeId: "repo::/wt", root: { tabs: [{ panes: { handle: "term" } }] } }],
    } });
    if (key === "terminal read") return JSON.stringify({ ok: true, result: { terminal: { source: "screen", tail: ["← manage model"] } } });
    throw new Error(`unexpected ${args}`);
  };
  const adapter = new CliOrcaAdapter(runner); const setups = await adapter.listReadySetups("/repo");
  const wt = await adapter.createWorktree({ setup: setups[0], name: "episode", baseRef: "base" });
  const auto = await adapter.createLaunchAutomation({ worktreeId: wt.id, name: "launch", prompt: "execute" });
  await adapter.runAutomation(auto); await adapter.removeAutomation(auto);
  const terminals = await adapter.listTerminals(wt.id);
  assert.equal(terminals[0].visible, true); assert.equal(terminals[0].worktreePath, "/wt");
  assert.equal(terminals[0].tabId, "tab"); assert.equal(terminals[0].leafId, "leaf");
  assert.deepEqual(await adapter.readTerminalScreen("term"), { source: "screen", text: "← manage model" });
  const flattened = commands.flat(); assert.equal(flattened.includes("--activate"), false);
  const create = commands.find((args) => args[0] === "worktree"); assert.ok(create.includes("--no-parent")); assert.ok(create.includes("--project-host-setup"));
  const automation = commands.find((args) => args[0] === "automations" && args[1] === "create");
  assert.ok(automation.includes("prime-agent")); assert.ok(automation.includes("--reuse-session")); assert.ok(automation.includes("--disabled"));
});


test("CLI setup inventory still enumerates remote-ready rows when local registration is not ready", async () => {
  const commands = [];
  const adapter = new CliOrcaAdapter((args) => {
    commands.push(args);
    if (args[0] === "project" && args[1] === "setups" && !args.includes("--host")) return JSON.stringify({ ok: true, result: { setups: [{ id: "local", projectId: "project", path: "/repo", setupState: "missing" }] } });
    if (args[0] === "environment") return JSON.stringify({ ok: true, result: { environments: [{ id: "remote-id", name: "remote" }] } });
    if (args[0] === "project" && args[1] === "setups" && args.includes("--host")) return JSON.stringify({ ok: true, result: { setups: [{ id: "remote-setup", projectId: "project", path: "/remote/repo", displayName: "repo", setupState: "ready", platform: "linux" }] } });
    throw new Error(`unexpected ${args}`);
  });
  const rows = await adapter.listReadySetups("/repo");
  assert.equal(rows.length, 1); assert.equal(rows[0].id, "remote-setup");
  assert.equal(rows[0].routingEnvironmentId, "remote-id");
  assert.equal(commands.some((args) => args.includes("runtime:remote-id")), true);
});
