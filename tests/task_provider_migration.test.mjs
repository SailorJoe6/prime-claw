import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { inspectTaskProviderMigration, migrateTaskProvider } from "../src/prime-agent-plugin/extension-support/task-provider-migration.ts";
import { ProcessCommandRunner } from "../src/prime-agent-plugin/extension-support/project-initialization.ts";
import { detectTaskProvider } from "../src/prime-agent-plugin/extension-support/task-providers.ts";

const BACKLOG = realpathSync("deps/backlog/dist/backlog");
const CUSTOM = "in_design:active,in_planning:active,ready_for_merge:wip,done:done";

class CandidateRunner extends ProcessCommandRunner {
  run(commandName, args, options = {}) {
    return super.run(commandName === "backlog" ? BACKLOG : commandName, args, options);
  }
}
const RUNNER = new CandidateRunner();

function command(cwd, executable, args, allowFailure = false) {
  try {
    return execFileSync(executable, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    if (allowFailure) return null;
    throw error;
  }
}

function git(cwd, ...args) { return command(cwd, "git", args).trim(); }
function bd(cwd, ...args) { return command(cwd, "bd", args).trim(); }
function backlog(cwd, ...args) { return command(cwd, BACKLOG, args).trim(); }

function repository(t, name) {
  const outer = realpathSync(mkdtempSync(join(tmpdir(), `prime-claw-migration-${name}-`)));
  const root = join(outer, "repo");
  const remote = join(outer, "remote.git");
  mkdirSync(root);
  command(outer, "git", ["init", "-q", "--bare", remote]);
  command(root, "git", ["init", "-q", "-b", "main"]);
  git(root, "config", "user.name", "Migration Fixture");
  git(root, "config", "user.email", "migration@example.invalid");
  writeFileSync(join(root, "README.md"), `${name}\n`);
  git(root, "add", "README.md");
  git(root, "commit", "-qm", "baseline");
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "-qu", "origin", "main");
  t.after(() => {
    try { bd(root, "dolt", "stop"); } catch {}
    rmSync(outer, { recursive: true, force: true });
  });
  return { outer, root: realpathSync(root), remote: realpathSync(remote) };
}

function canonicalBacklogConfig(root, dir = "backlog") {
  const path = join(root, dir, "config.yml");
  const content = readFileSync(path, "utf8")
    .replace(/^statuses:.*$/m, 'statuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]')
    .replace(/^default_status:.*$/m, 'default_status: "In Design"')
    .replace(/^auto_commit:.*$/m, "auto_commit: false");
  writeFileSync(path, content);
}

function backlogSource(t, name = "backlog-source") {
  const fixture = repository(t, name);
  backlog(fixture.root, "init", "fixture", "--defaults", "--backlog-dir", "backlog", "--config-location", "folder", "--integration-mode", "none");
  canonicalBacklogConfig(fixture.root);
  const parentOut = backlog(fixture.root, "task", "create", "Open parent", "--status", "In Progress", "--description", "open description", "--plan", "living plan", "--notes", "execution notes", "--ac", "first criterion", "--no-dod-defaults", "--plain");
  const parent = parentOut.match(/\b[A-Z][A-Z0-9_-]*-\d+(?:\.\d+)*\b/)[0];
  backlog(fixture.root, "task", "edit", parent, "--comment", "native source comment", "--comment-author", "source-author", "--plain");
  const closedOut = backlog(fixture.root, "task", "create", "Closed child", "--status", "Done", "--parent", parent, "--depends-on", parent, "--description", "closed description", "--final-summary", "closed summary", "--no-dod-defaults", "--plain");
  const closed = closedOut.match(/\b[A-Z][A-Z0-9_-]*-\d+(?:\.\d+)*\b/)[0];
  backlog(fixture.root, "task", "complete", closed);
  const archivedOut = backlog(fixture.root, "task", "create", "Archived task", "--status", "In Design", "--description", "archived description", "--no-dod-defaults", "--plain");
  const archived = archivedOut.match(/\b[A-Z][A-Z0-9_-]*-\d+(?:\.\d+)*\b/)[0];
  backlog(fixture.root, "task", "archive", archived);
  git(fixture.root, "add", "backlog");
  git(fixture.root, "commit", "-qm", "seed complete Backlog source");
  git(fixture.root, "push", "-q");
  return { ...fixture, ids: { parent, closed, archived } };
}

function addActiveBacklogOwner(fixture) {
  const episode = join(fixture.outer, "episode");
  git(fixture.root, "worktree", "add", "-q", "-b", "episode-owner", episode, "HEAD");
  const episodeRoot = realpathSync(episode);
  const task = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", fixture.ids.parent)).task;
  const episodeTaskPath = join(episodeRoot, task.path);
  const originalTaskBytes = readFileSync(episodeTaskPath);
  writeFileSync(episodeTaskPath, Buffer.concat([originalTaskBytes, Buffer.from("\n<!-- episode-only migration history -->\n")]));
  git(episodeRoot, "add", task.path);
  git(episodeRoot, "commit", "-qm", "episode-only migration history");
  writeFileSync(episodeTaskPath, originalTaskBytes);
  git(episodeRoot, "add", task.path);
  git(episodeRoot, "commit", "-qm", "restore episode task bytes before migration");
  git(episodeRoot, "push", "-qu", "origin", "episode-owner");
  const episodeHead = git(episodeRoot, "rev-parse", "HEAD");
  const sessionFile = join(fixture.outer, "episode-session.jsonl");
  writeFileSync(sessionFile, "{}\n");
  const ownerSessionId = "owner-migration-fixture";
  mkdirSync(join(fixture.root, ".prime-claw"), { recursive: true });
  const record = {
    version: 2, status: "active", operationId: "operation-migration-fixture", engine: "local",
    ownerSessionId, taskId: fixture.ids.parent, taskPath: task.path,
    baseRef: episodeHead, createdAt: "2026-10-27T00:00:00.000Z", updatedAt: "2026-10-27T00:00:00.000Z",
    worktree: episodeRoot, branch: "episode-owner", head: episodeHead,
    episodeId: "episode-migration-fixture", episodeSessionFile: sessionFile, episodeActiveSessionId: "route-migration-fixture",
  };
  writeFileSync(join(fixture.root, ".prime-claw", "ownership.json"), `${JSON.stringify({ schemaVersion: 1, owners: { [ownerSessionId]: record } }, null, 2)}\n`);
  git(fixture.root, "add", ".prime-claw/ownership.json");
  git(fixture.root, "commit", "-qm", "record active migration fixture owner");
  git(fixture.root, "push", "-q");
  return { ownerSessionId, episode: episodeRoot, episodeHead, record };
}

function beadsSource(t, name = "beads-source") {
  const fixture = repository(t, name);
  bd(fixture.root, "init", "--server", "--skip-hooks", "--skip-agents", "--prefix", "BST", "--quiet", "--non-interactive");
  bd(fixture.root, "config", "set", "status.custom", CUSTOM);
  bd(fixture.root, "config", "set", "dolt.auto-start", "true");
  const doltRemote = `git+${pathToFileURL(fixture.remote).href}`;
  bd(fixture.root, "dolt", "remote", "add", "origin", doltRemote, "--allow-git-origin");
  bd(fixture.root, "config", "set", "sync.remote", doltRemote);
  command(fixture.root, "bd", ["dolt", "commit", "-m", "configure migration fixture"], true);
  const parent = JSON.parse(bd(fixture.root, "create", "Beads parent", "--status", "in_progress", "--description", "beads description", "--design", "beads design", "--notes", "beads notes", "--metadata", '{"opaque":{"shape":[1,null,false]}}', "--json")).id;
  const child = JSON.parse(bd(fixture.root, "create", "Beads child", "--status", "in_progress", "--parent", parent, "--description", "closed child", "--json")).id;
  bd(fixture.root, "update", child, "--status", "done", "--force", "--json");
  const archived = JSON.parse(bd(fixture.root, "create", "Beads archived", "--status", "in_progress", "--description", "archived source task", "--json")).id;
  bd(fixture.root, "close", archived, "--reason", "explicitly abandoned fixture", "--json");
  bd(fixture.root, "comments", "add", parent, "native Beads comment", "--author", "beads-author");
  bd(fixture.root, "provenance", "record", "--issue", parent, "--kind", "commit", "--source", "fixture", "--ref", git(fixture.root, "rev-parse", "HEAD"), "--ref-kind", "git-sha", "--actor", "beads-actor", "--payload", '{"opaque":true}');
  bd(fixture.root, "dolt", "push", "--remote", "origin", "--no-adopt");
  git(fixture.root, "add", "-A");
  if (git(fixture.root, "status", "--porcelain=v1")) {
    git(fixture.root, "commit", "-qm", "record Beads provider configuration");
  }
  git(fixture.root, "push", "-q");
  return { ...fixture, ids: { parent, child, archived } };
}

async function proveFixtureRuntime(records) {
  return records.map((record) => ({
    ownerSessionId: record.ownerSessionId,
    expectedPreviousEpisodeActiveSessionId: record.episodeActiveSessionId,
    verifiedCurrentEpisodeActiveSessionId: record.episodeActiveSessionId,
  }));
}

function addActiveBeadsOwner(fixture) {
  const episode = join(fixture.outer, "episode-beads");
  git(fixture.root, "worktree", "add", "-q", "-b", "episode-beads-owner", episode, "HEAD");
  const episodeRoot = realpathSync(episode);
  git(episodeRoot, "push", "-qu", "origin", "episode-beads-owner");
  const episodeHead = git(episodeRoot, "rev-parse", "HEAD");
  const raw = JSON.parse(bd(fixture.root, "show", fixture.ids.parent, "--json", "--long", "--include-comments"));
  const taskEvidence = Array.isArray(raw) ? raw[0] : raw;
  const sessionFile = join(fixture.outer, "episode-beads-session.jsonl");
  writeFileSync(sessionFile, "{}\n");
  const ownerSessionId = "owner-beads-migration-fixture";
  mkdirSync(join(fixture.root, ".prime-claw"), { recursive: true });
  const record = {
    version: 2, status: "active", operationId: "operation-beads-migration-fixture", engine: "local",
    ownerSessionId, provider: "beads", taskId: fixture.ids.parent, providerRevision: "a".repeat(32), taskEvidence,
    baseRef: episodeHead, createdAt: "2026-10-27T00:00:00.000Z", updatedAt: "2026-10-27T00:00:00.000Z",
    worktree: episodeRoot, branch: "episode-beads-owner", head: episodeHead,
    episodeId: "episode-beads-migration-fixture", episodeSessionFile: sessionFile, episodeActiveSessionId: "route-beads-migration-fixture",
  };
  writeFileSync(join(fixture.root, ".prime-claw", "ownership.json"), `${JSON.stringify({ schemaVersion: 1, owners: { [ownerSessionId]: record } }, null, 2)}\n`);
  git(fixture.root, "add", ".prime-claw/ownership.json");
  git(fixture.root, "commit", "-qm", "record active Beads migration fixture owner");
  git(fixture.root, "push", "-q");
  return { ownerSessionId, episode: episodeRoot, episodeHead, record };
}

test("provider migration requires explicit confirmation before any project lookup or write", async () => {
  const result = await migrateTaskProvider({
    cwd: "/definitely/missing", targetProvider: "beads", expectedSourceRevision: "a".repeat(40),
    confirmedSwitch: false, actor: "operator", semanticPlacement: "preserve exact unsupported values",
  });
  assert.deepEqual(result, {
    status: "blocked", code: "confirmation-required",
    detail: "provider switch requires explicit operator confirmation",
    remediation: "inspect the migration, present the exact source revision and semantic placement, then call switch-confirm with confirmedSwitch=true",
    targetProvider: "beads",
  });
});

test("read-only inspection captures complete Backlog open closed and archived native history", { timeout: 60_000 }, (t) => {
  const fixture = backlogSource(t, "inspect-backlog");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "beads", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.equal(inspection.sourceProvider, "backlog");
  assert.equal(inspection.sourceRevision, git(fixture.root, "rev-parse", "HEAD"));
  assert.deepEqual(inspection.taskCounts, { open: 1, closed: 1, archived: 1, total: 3 });
  assert.match(inspection.semanticPlacementPrompt, /no native beads equivalent/i);
  assert.equal(detectTaskProvider(fixture.root, RUNNER).evidence.provider, "backlog");
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
});

test("ambiguous Backlog assignees require and apply an actual native Beads value before source deletion", { timeout: 240_000 }, async (t) => {
  const fixture = backlogSource(t, "backlog-native-assignee-validation");
  backlog(fixture.root, "task", "edit", fixture.ids.parent, "--assignee", "alice,bob", "--plain");
  git(fixture.root, "add", "backlog");
  git(fixture.root, "commit", "-qm", "record ambiguous native assignees");
  git(fixture.root, "push", "-q");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "beads", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.equal(inspection.semanticPlacementPrompt.includes(`${fixture.ids.parent}.priority=`), false);
  assert.ok(inspection.semanticPlacementPrompt.includes(`${fixture.ids.parent}.assignee=[\"alice\",\"bob\"]`));
  const base = {
    cwd: fixture.root, targetProvider: "beads", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Use bob as the single native Beads assignee and preserve both source values.",
  };
  const cases = [
    { options: {}, detail: /cannot project to one native Beads assignee/ },
    { options: { beadsNativePlacements: [{ sourceTaskId: "UNKNOWN-1", assignee: "bob" }] }, detail: /unknown source Backlog task/ },
    { options: { beadsNativePlacements: [{ sourceTaskId: fixture.ids.parent, assignee: 7 }] }, detail: /non-empty native string/ },
    { options: { beadsNativePlacements: [{ sourceTaskId: fixture.ids.parent, assignee: "bob" }, { sourceTaskId: fixture.ids.parent, assignee: "bob" }] }, detail: /repeats source Backlog task/ },
    { options: { beadsNativePlacements: [{ sourceTaskId: fixture.ids.parent, priority: 5, assignee: "bob" }] }, detail: /integer from 0 through 4/ },
    { options: { beadsNativePlacements: [{ sourceTaskId: fixture.ids.parent, priority: 1, assignee: "bob" }] }, detail: /already has exact native Beads priority 2/ },
  ];
  for (const item of cases) {
    const result = await migrateTaskProvider({ ...base, ...item.options });
    assert.equal(result.status, "blocked");
    assert.equal(result.code, "pre-cutover-failed");
    assert.match(result.detail, item.detail);
    assert.equal(existsSync(join(fixture.root, ".beads")), false);
    assert.equal(existsSync(join(fixture.root, "backlog")), true);
  }
  const result = await migrateTaskProvider({
    ...base,
    beadsNativePlacements: [{ sourceTaskId: fixture.ids.parent, assignee: "bob" }],
  });
  assert.equal(result.status, "completed", result.detail);
  assert.equal(result.sourceAbsent, true);
  assert.deepEqual(result.receipt.beadsNativePlacements, [{ sourceTaskId: fixture.ids.parent, assignee: "bob" }]);
  const destinationId = result.receipt.mappings.find((row) => row.sourceTaskId === fixture.ids.parent).destinationTaskId;
  const destination = JSON.parse(bd(fixture.root, "show", destinationId, "--json", "--long", "--include-comments"))[0];
  assert.equal(destination.priority, 2);
  assert.equal(destination.assignee, "bob");
  assert.deepEqual(destination.metadata.prime_claw_migration.nativeView.task.assignees, ["alice", "bob"]);
  assert.deepEqual(destination.metadata.prime_claw_migration.beadsNativePlacement, { assignee: "bob" });
  assert.equal(existsSync(join(fixture.root, "backlog")), false);
});

test("confirmed migration preserves complete history, managed native placement, and a later active Episode head", { timeout: 240_000 }, async (t) => {
  const fixture = backlogSource(t, "backlog-active-owner");
  backlog(fixture.root, "task", "edit", fixture.ids.parent, "--priority", "High", "--assignee", "alice,bob", "--plain");
  git(fixture.root, "add", "backlog");
  git(fixture.root, "commit", "-qm", "record managed native placement fixture", "-m", "BODY_ONLY_MIGRATION_ROLLBACK_EXPLANATION");
  git(fixture.root, "push", "-q");
  const owner = addActiveBacklogOwner(fixture);
  writeFileSync(join(owner.episode, "later-implementation.txt"), "ordinary Episode progress\n");
  git(owner.episode, "add", "later-implementation.txt");
  git(owner.episode, "commit", "-qm", "ordinary later Episode implementation");
  git(owner.episode, "push", "-q");
  const currentEpisodeHead = git(owner.episode, "rev-parse", "HEAD");
  assert.notEqual(currentEpisodeHead, owner.record.head);
  assert.ok(command(owner.episode, "git", ["merge-base", "--is-ancestor", owner.record.head, currentEpisodeHead], true) !== null);
  let runtimeProofs = 0;
  const verifyCurrentRuntime = async (records) => {
    runtimeProofs += 1;
    assert.ok(records.every((record) => record.head === currentEpisodeHead));
    return proveFixtureRuntime(records);
  };
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "beads", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.deepEqual(inspection.activeOwnership, [{ ownerSessionId: owner.ownerSessionId, taskId: fixture.ids.parent }]);
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "beads", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator",
    semanticPlacement: "Place the living plan in design, apply native Beads priority 1 and single assignee bob, and preserve all unsupported values in exact metadata.",
    beadsNativePlacements: [{ sourceTaskId: fixture.ids.parent, priority: 1, assignee: "bob" }],
    verifyActiveRuntime: verifyCurrentRuntime,
  });
  assert.equal(result.status, "completed", result.detail);
  assert.equal(result.sourceAbsent, true);
  assert.equal(result.selectedProvider, "beads");
  assert.deepEqual(result.receipt.taskCounts, { open: 1, closed: 1, archived: 1, total: 3 });
  assert.equal(result.receipt.mappings.length, 3);
  assert.deepEqual(result.receipt.beadsNativePlacements, [{ sourceTaskId: fixture.ids.parent, priority: 1, assignee: "bob" }]);
  assert.ok(runtimeProofs >= 3);
  assert.equal(existsSync(join(fixture.root, "backlog")), false);
  assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
  assert.equal(git(fixture.root, "rev-parse", "HEAD"), git(fixture.root, "rev-parse", "origin/main"));
  assert.deepEqual(git(fixture.root, "ls-files", ".beads/.gitignore", ".beads/config.yaml", ".beads/metadata.json", ".beads/README.md").split("\n").sort(), [".beads/.gitignore", ".beads/README.md", ".beads/config.yaml", ".beads/metadata.json"].sort());
  const receipt = JSON.parse(bd(fixture.root, "show", result.receiptTaskId, "--json", "--long", "--include-comments"))[0];
  assert.equal(receipt.metadata.prime_claw_migration.marker, "prime-claw-task-provider-migration-receipt-v1");
  assert.deepEqual(receipt.metadata.prime_claw_migration.beadsNativePlacements, [
    { sourceTaskId: fixture.ids.parent, priority: 1, assignee: "bob" },
  ]);
  for (const mapping of result.receipt.mappings) {
    const task = JSON.parse(bd(fixture.root, "show", mapping.destinationTaskId, "--json", "--long", "--include-comments"))[0];
    assert.equal(task.metadata.prime_claw_migration.sourceTaskId, mapping.sourceTaskId);
    assert.equal(task.metadata.prime_claw_migration.sourceRevision, inspection.sourceRevision);
    if (mapping.sourceTaskId === fixture.ids.archived) {
      assert.equal(task.status, "closed");
      assert.match(task.close_reason, /Migrated archived Backlog task/);
    }
    assert.equal(typeof task.metadata.prime_claw_migration.gitHistoryBase64, "string");
    const history = Buffer.from(task.metadata.prime_claw_migration.gitHistoryBase64, "base64").toString("utf8");
    assert.match(history, /diff --git/);
    if (mapping.sourceTaskId === fixture.ids.parent) {
      assert.match(history, /episode-only migration history/);
      assert.match(history, /BODY_ONLY_MIGRATION_ROLLBACK_EXPLANATION/);
      assert.equal(task.priority, 1);
      assert.equal(task.assignee, "bob");
      assert.equal(task.metadata.prime_claw_migration.nativeView.task.priority.toLowerCase(), "high");
      assert.deepEqual(task.metadata.prime_claw_migration.nativeView.task.assignees, ["alice", "bob"]);
      assert.deepEqual(task.metadata.prime_claw_migration.beadsNativePlacement, { priority: 1, assignee: "bob" });
    }
  }
  const registry = JSON.parse(readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8"));
  const current = registry.owners[owner.ownerSessionId];
  const mapped = result.receipt.mappings.find((row) => row.sourceTaskId === fixture.ids.parent);
  assert.equal(current.provider, "beads");
  assert.equal(current.taskId, mapped.destinationTaskId);
  for (const field of ["ownerSessionId", "operationId", "engine", "baseRef", "createdAt", "worktree", "branch", "head", "episodeId", "episodeSessionFile", "episodeActiveSessionId"]) {
    assert.deepEqual(current[field], owner.record[field], field);
  }
  assert.equal(git(owner.episode, "status", "--porcelain=v1"), "");
  assert.equal(git(owner.episode, "rev-parse", "HEAD"), currentEpisodeHead);
  assert.equal(current.head, owner.record.head, "provider switch preserves the historical ownership head");
  const linkedDetection = detectTaskProvider(owner.episode, RUNNER);
  assert.equal(linkedDetection.kind, "selected");
  assert.equal(linkedDetection.evidence.provider, "beads");
  assert.equal(existsSync(join(owner.episode, "backlog")), true, "historical code bytes remain without live provider authority");
});


test("active Episode identity drift blocks before destination creation and preserves source authority", { timeout: 60_000 }, async (t) => {
  const fixture = backlogSource(t, "backlog-active-drift");
  const owner = addActiveBacklogOwner(fixture);
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "beads", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  writeFileSync(join(owner.episode, "uncommitted-drift.txt"), "drift\n");
  const before = readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8");
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "beads", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve exact unsupported values in native metadata.",
    verifyActiveRuntime: proveFixtureRuntime,
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "pre-cutover-failed");
  assert.match(result.detail, /exact clean linked worktree\/branch\/head identity/);
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  assert.equal(readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8"), before);
  assert.equal(existsSync(join(fixture.root, "backlog")), true);
});

test("pre-cutover deletion refusal preserves source and exact same-destination retry completes", { timeout: 300_000 }, async (t) => {
  const fixture = backlogSource(t, "backlog-delete-refusal");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "beads", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  let deletions = 0;
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "beads", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator",
    semanticPlacement: "Preserve every non-equivalent field in exact destination-native metadata.",
    deleteSource(snapshot) {
      deletions += 1;
      assert.equal(snapshot.provider, "backlog");
      assert.equal(existsSync(join(fixture.root, "backlog")), true);
      throw new Error("fixture refuses guarded deletion after all destination proof");
    },
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "pre-cutover-failed");
  assert.match(result.detail, /fixture refuses guarded deletion/);
  assert.match(result.remediation, new RegExp(`${fixture.root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/backlog`));
  assert.match(result.remediation, /existing destination .*\.beads/);
  assert.equal(deletions, 1);
  assert.equal(existsSync(join(fixture.root, "backlog")), true);
  assert.equal(git(fixture.root, "rev-parse", "HEAD"), inspection.sourceRevision);
  assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
  const detection = detectTaskProvider(fixture.root, RUNNER);
  assert.equal(detection.kind, "blocked");
  assert.equal(detection.code, "dual-providers");
  const sourceView = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", fixture.ids.parent)).task;
  assert.equal(sourceView.id, fixture.ids.parent);
  const destinationIds = bd(fixture.root, "export", "--all").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line).id).sort();
  const retried = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "beads", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator",
    semanticPlacement: "Preserve every non-equivalent field in exact destination-native metadata.",
  });
  assert.equal(retried.status, "completed", retried.detail);
  assert.equal(retried.sourceAbsent, true);
  assert.deepEqual(retried.receipt.mappings.map((row) => row.destinationTaskId).concat(retried.receiptTaskId).sort(), destinationIds);
  assert.equal(existsSync(join(fixture.root, "backlog")), false);
});

test("partial source deletion preserves verified destination ownership and reports cutover incomplete", { timeout: 300_000 }, async (t) => {
  const fixture = backlogSource(t, "backlog-partial-delete");
  const owner = addActiveBacklogOwner(fixture);
  const sourceTask = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", fixture.ids.parent)).task;
  const sourceTaskPath = join(fixture.root, sourceTask.path);
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "beads", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "beads", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator",
    semanticPlacement: "Preserve every non-equivalent field in exact destination-native metadata.",
    verifyActiveRuntime: proveFixtureRuntime,
    deleteSource() {
      rmSync(sourceTaskPath);
      throw new Error("injected filesystem deletion failure after one source task was removed");
    },
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "cutover-incomplete");
  assert.match(result.detail, /exact source is not intact/);
  assert.match(result.remediation, /recover the exact source/);
  assert.equal(existsSync(join(fixture.root, "backlog")), true);
  assert.equal(existsSync(sourceTaskPath), false);
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
  const registry = JSON.parse(readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8"));
  const current = registry.owners[owner.ownerSessionId];
  assert.equal(current.provider, "beads");
  assert.notEqual(current.taskId, undefined);
  assert.notDeepEqual(current, owner.record);
  assert.equal(current.worktree, owner.record.worktree);
  assert.equal(current.head, owner.record.head);
});

test("read-only inspection captures complete published Beads history and provenance", { timeout: 120_000 }, (t) => {
  const fixture = beadsSource(t, "inspect-beads");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.equal(inspection.sourceProvider, "beads");
  assert.deepEqual(inspection.taskCounts, { open: 1, closed: 1, archived: 1, total: 3 });
  assert.match(inspection.sourceRevision, /^[0-9a-v]{32}$/);
  assert.equal(detectTaskProvider(fixture.root, RUNNER).evidence.provider, "beads");
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
});


test("confirmed Beads to Backlog migration preserves active Episode identity and continues on canonical-primary Backlog", { timeout: 180_000 }, async (t) => {
  const fixture = beadsSource(t, "beads-active-owner");
  const owner = addActiveBeadsOwner(fixture);
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.deepEqual(inspection.activeOwnership, [{ ownerSessionId: owner.ownerSessionId, taskId: fixture.ids.parent }]);
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator",
    semanticPlacement: "Place native design in the living plan and preserve all unsupported values in exact provenance comments.",
    verifyActiveRuntime: proveFixtureRuntime,
  });
  assert.equal(result.status, "completed", result.detail);
  assert.equal(result.selectedProvider, "backlog");
  assert.deepEqual(result.receipt.taskCounts, { open: 1, closed: 1, archived: 1, total: 3 });
  assert.equal(result.receipt.mappings.length, 3);
  assert.ok(result.receipt.mappings.every((mapping) => mapping.sourceTaskId !== mapping.destinationTaskId));
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
  assert.equal(git(fixture.root, "rev-parse", "HEAD"), git(fixture.root, "rev-parse", "origin/main"));
  const receipt = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", result.receiptTaskId)).task;
  assert.ok(receipt.comments.some((comment) => String(comment.text ?? comment.content ?? comment.body).includes("prime-claw-task-provider-migration-receipt-v1")));
  for (const mapping of result.receipt.mappings) {
    if (mapping.sourceTaskId === fixture.ids.archived) {
      const archiveDir = join(fixture.root, ".backlog", "archive", "tasks");
      const archivedFile = command(archiveDir, "find", [archiveDir, "-type", "f", "-name", `*${mapping.destinationTaskId.toLowerCase()}*`]).trim();
      assert.ok(archivedFile);
      assert.match(readFileSync(archivedFile, "utf8"), /prime-claw-task-provider-migration-source-v1/);
      continue;
    }
    const task = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", mapping.destinationTaskId)).task;
    const text = task.comments.map((comment) => String(comment.text ?? comment.content ?? comment.body)).join("\n");
    assert.match(text, /prime-claw-task-provider-migration-source-v1/);
  }
  const registry = JSON.parse(readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8"));
  const current = registry.owners[owner.ownerSessionId];
  const mapped = result.receipt.mappings.find((row) => row.sourceTaskId === fixture.ids.parent);
  assert.equal(current.provider, "backlog");
  assert.equal(current.taskId, mapped.destinationTaskId);
  assert.equal(typeof current.taskPath, "string");
  for (const field of ["ownerSessionId", "operationId", "engine", "baseRef", "createdAt", "worktree", "branch", "head", "episodeId", "episodeSessionFile", "episodeActiveSessionId"]) {
    assert.deepEqual(current[field], owner.record[field], field);
  }
  assert.equal(git(owner.episode, "status", "--porcelain=v1"), "");
  assert.equal(git(owner.episode, "rev-parse", "HEAD"), owner.episodeHead);
  const linkedDetection = detectTaskProvider(owner.episode, RUNNER);
  assert.equal(linkedDetection.kind, "selected");
  assert.equal(linkedDetection.evidence.provider, "backlog");
  assert.equal(existsSync(join(owner.episode, ".backlog", ".git")), true);
  assert.equal(existsSync(join(owner.episode, ".beads", "metadata.json")), true, "historical code bytes remain without live provider authority");
});


test("Beads source inspection rejects configured owner filters before destination creation", { timeout: 120_000 }, (t) => {
  const fixture = beadsSource(t, "beads-filtered-source");
  bd(fixture.root, "create", "Filtered ordinary task", "--status", "in_progress", "--actor", "excluded-reviewer", "--json");
  bd(fixture.root, "config", "set", "export.exclude_owners", "excluded-reviewer");
  bd(fixture.root, "dolt", "push", "--remote", "origin", "--no-adopt");
  git(fixture.root, "add", "-A");
  if (git(fixture.root, "status", "--porcelain=v1")) git(fixture.root, "commit", "-qm", "configure supported export filter");
  git(fixture.root, "push", "-q");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: RUNNER });
  assert.equal(inspection.status, "blocked");
  assert.match(inspection.detail, /export\.exclude_owners/);
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
});

test("Backlog lifecycle counts use exact native Done status rather than physical folder", { timeout: 60_000 }, (t) => {
  const fixture = backlogSource(t, "backlog-native-counts");
  rmSync(join(fixture.root, "backlog", "archive"), { recursive: true, force: true });
  const output = backlog(fixture.root, "task", "create", "Done without physical completion", "--status", "In Progress", "--no-dod-defaults", "--plain");
  const taskId = output.match(/\b[A-Z][A-Z0-9_-]*-\d+(?:\.\d+)*\b/)[0];
  backlog(fixture.root, "task", "edit", "--status", "Done", "--plain", "--", taskId);
  assert.match(JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", taskId)).task.path, /\/tasks\//);
  git(fixture.root, "add", "backlog");
  git(fixture.root, "commit", "-qm", "add native Done task without complete move");
  git(fixture.root, "push", "-q");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "beads", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.deepEqual(inspection.taskCounts, { open: 1, closed: 2, archived: 0, total: 3 });
});

test("late active Episode code drift after runtime proof preserves source and ownership", { timeout: 180_000 }, async (t) => {
  const fixture = backlogSource(t, "backlog-late-code-drift");
  const owner = addActiveBacklogOwner(fixture);
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "beads", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  const ownershipBefore = readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8");
  let proofs = 0, deletions = 0;
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "beads", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve exact unsupported values in native metadata.",
    async verifyActiveRuntime(records) {
      proofs += 1;
      if (proofs === 2) writeFileSync(join(owner.episode, "late-drift.txt"), "late drift\n");
      return proveFixtureRuntime(records);
    },
    deleteSource() { deletions += 1; },
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "pre-cutover-failed");
  assert.match(result.detail, /exact clean linked worktree\/branch\/head identity/);
  assert.equal(deletions, 0);
  assert.equal(existsSync(join(fixture.root, "backlog")), true);
  assert.equal(readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8"), ownershipBefore);
});

test("missing active Episode durable session blocks inspection before destination creation", { timeout: 60_000 }, (t) => {
  const fixture = backlogSource(t, "backlog-missing-runtime");
  const owner = addActiveBacklogOwner(fixture);
  rmSync(owner.record.episodeSessionFile);
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "beads", runner: RUNNER });
  assert.equal(inspection.status, "blocked");
  assert.match(inspection.detail, /durable session file is absent/);
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  assert.equal(existsSync(join(fixture.root, "backlog")), true);
});

class BacklogRemoteRaceRunner extends CandidateRunner {
  constructor(onReceiptProof) { super(); this.onReceiptProof = onReceiptProof; this.proofs = 0; }
  run(commandName, args, options = {}) {
    const result = super.run(commandName, args, options);
    if (commandName === "git" && args.includes("ls-remote") && args.includes("refs/heads/prime-claw/tasks")) {
      this.proofs += 1;
      if (this.proofs === 3) this.onReceiptProof();
    }
    return result;
  }
}

test("Backlog destination remote advancement blocks before Beads source deletion", { timeout: 240_000 }, async (t) => {
  const fixture = beadsSource(t, "backlog-remote-race");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  let raced = false;
  const runner = new BacklogRemoteRaceRunner(() => {
    if (raced) return;
    raced = true;
    const sibling = join(fixture.outer, "task-history-racer");
    command(fixture.outer, "git", ["clone", "-q", "--branch", "prime-claw/tasks", "--single-branch", fixture.remote, sibling]);
    git(sibling, "config", "user.name", "Remote Racer");
    git(sibling, "config", "user.email", "racer@example.invalid");
    writeFileSync(join(sibling, "REMOTE-RACE.txt"), "advanced after receipt proof\n");
    git(sibling, "add", "REMOTE-RACE.txt");
    git(sibling, "commit", "-qm", "advance destination after receipt proof");
    git(sibling, "push", "-q", "origin", "HEAD:refs/heads/prime-claw/tasks");
  });
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve exact unsupported values in native provenance.",
  });
  assert.equal(raced, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "pre-cutover-failed");
  assert.match(result.detail, /destination.*publication|exact revision/i);
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
});


test("post-switch runtime continuity loss rolls ownership back before source deletion", { timeout: 180_000 }, async (t) => {
  const fixture = backlogSource(t, "backlog-post-switch-runtime-loss");
  const owner = addActiveBacklogOwner(fixture);
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "beads", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  const ownershipBefore = readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8");
  let proofs = 0, deletions = 0;
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "beads", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve exact unsupported values in native metadata.",
    async verifyActiveRuntime(records) {
      proofs += 1;
      if (proofs === 3) throw new Error("fixture runtime disappeared after ownership switch");
      return proveFixtureRuntime(records);
    },
    deleteSource() { deletions += 1; },
  });
  assert.equal(result.status, "blocked");
  assert.match(result.detail, /runtime disappeared after ownership switch/);
  assert.equal(deletions, 0);
  assert.equal(existsSync(join(fixture.root, "backlog")), true);
  assert.equal(readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8"), ownershipBefore);
});


test("active Beads Episode deletion refusal preserves source and exact Backlog destination retry completes", { timeout: 360_000 }, async (t) => {
  const fixture = beadsSource(t, "beads-delete-refusal-retry");
  const owner = addActiveBeadsOwner(fixture);
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  const first = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve exact unsupported values in native provenance.",
    verifyActiveRuntime: proveFixtureRuntime,
    deleteSource() { throw new Error("fixture refuses Beads deletion after destination proof"); },
  });
  assert.equal(first.status, "blocked");
  assert.equal(first.code, "pre-cutover-failed");
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
  assert.equal(detectTaskProvider(fixture.root, RUNNER).code, "dual-providers");
  const firstEpisodeDestinationHead = git(join(owner.episode, ".backlog"), "rev-parse", "HEAD");
  const destinationIds = git(join(fixture.root, ".backlog"), "ls-files").split(/\r?\n/).filter((path) => path.endsWith(".md") && path !== "TASKS.md")
    .map((path) => /^id:\s*([A-Z][A-Z0-9_-]*-\d+(?:\.\d+)*)/m.exec(readFileSync(join(fixture.root, ".backlog", path), "utf8"))?.[1]).filter(Boolean).sort();
  const retried = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve exact unsupported values in native provenance.",
    verifyActiveRuntime: proveFixtureRuntime,
  });
  assert.equal(retried.status, "completed", retried.detail);
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  assert.deepEqual(retried.receipt.mappings.map((row) => row.destinationTaskId).concat(retried.receiptTaskId).sort(), destinationIds);
  const finalDestinationHead = git(join(fixture.root, ".backlog"), "rev-parse", "HEAD");
  assert.notEqual(finalDestinationHead, firstEpisodeDestinationHead);
  assert.equal(git(join(owner.episode, ".backlog"), "rev-parse", "HEAD"), finalDestinationHead);
  const retained = JSON.parse(readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8").toString()).owners[owner.ownerSessionId];
  assert.equal(retained.provider, "backlog");
  assert.equal(retained.worktree, owner.episode);
  assert.equal(retained.head, owner.episodeHead);
});



test("Backlog native drafts are counted and preserved exactly before source deletion", { timeout: 300_000 }, async (t) => {
  const fixture = backlogSource(t, "backlog-draft-inventory");
  const output = backlog(fixture.root, "task", "create", "Draft with pending product notes", "--draft", "--description", "Unique draft source bytes 20261027", "--no-dod-defaults", "--plain");
  const draftId = output.match(/\bDRAFT-\d+(?:\.\d+)*\b/)[0];
  const archivedOutput = backlog(fixture.root, "task", "create", "Archived draft source", "--draft", "--description", "Unique archived draft bytes 20261027", "--no-dod-defaults", "--plain");
  const archivedDraftId = archivedOutput.match(/\bDRAFT-\d+(?:\.\d+)*\b/)[0];
  backlog(fixture.root, "draft", "archive", archivedDraftId);
  assert.match(backlog(fixture.root, "draft", "list", "--plain"), new RegExp(draftId));
  assert.doesNotMatch(backlog(fixture.root, "draft", "list", "--plain"), new RegExp(archivedDraftId));
  git(fixture.root, "add", "backlog");
  git(fixture.root, "commit", "-qm", "commit native draft source");
  git(fixture.root, "push", "-q");

  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "beads", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.deepEqual(inspection.taskCounts, { open: 2, closed: 1, archived: 2, total: 5 });
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "beads", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve exact draft content and unsupported values in native metadata.",
  });
  assert.equal(result.status, "completed", result.detail);
  assert.equal(existsSync(join(fixture.root, "backlog")), false);
  const rows = bd(fixture.root, "export", "--all").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const destinationId = result.receipt.mappings.find((row) => row.sourceTaskId === draftId)?.destinationTaskId;
  const draft = rows.find((row) => row.id === destinationId);
  const preserved = draft?.metadata?.prime_claw_migration;
  assert.equal(preserved?.sourceTaskId, draftId);
  assert.equal(preserved?.entityKind, "draft");
  assert.equal(preserved?.classification, "open");
  assert.match(Buffer.from(preserved.markdownBase64, "base64").toString("utf8"), /Unique draft source bytes 20261027/);
  assert.match(Buffer.from(preserved.nativeView.task.nativePlainViewBase64, "base64").toString("utf8"), /Unique draft source bytes 20261027/);
  assert.match(draft.notes, /Unique draft source bytes 20261027/);
  const archivedDestinationId = result.receipt.mappings.find((row) => row.sourceTaskId === archivedDraftId)?.destinationTaskId;
  const archivedDraft = rows.find((row) => row.id === archivedDestinationId);
  const archivedPreserved = archivedDraft?.metadata?.prime_claw_migration;
  assert.equal(archivedPreserved?.entityKind, "draft");
  assert.equal(archivedPreserved?.classification, "archived");
  assert.match(Buffer.from(archivedPreserved.markdownBase64, "base64").toString("utf8"), /Unique archived draft bytes 20261027/);
  assert.equal(archivedDraft.status, "closed");
});

class DroppedBeadsExportRunner extends CandidateRunner {
  constructor() { super(); this.dropped = false; this.sawInventory = false; }
  run(commandName, args, options = {}) {
    const result = super.run(commandName, args, options);
    if (commandName === "bd" && args.includes("SELECT id FROM issues ORDER BY id")) this.sawInventory = true;
    if (commandName === "bd" && args[0] === "export" && args.includes("--all") && !this.dropped && result.status === 0) {
      this.dropped = true;
      const lines = result.stdout.split(/\r?\n/).filter(Boolean);
      return { ...result, stdout: `${lines.slice(1).join("\n")}${lines.length > 1 ? "\n" : ""}` };
    }
    return result;
  }
}

test("Beads export must exactly match independent native issue inventory", { timeout: 120_000 }, (t) => {
  const fixture = beadsSource(t, "beads-export-inventory-mismatch");
  const runner = new DroppedBeadsExportRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "blocked");
  assert.match(inspection.detail, /does not exactly match the independent native issue inventory/);
  assert.equal(runner.dropped, true);
  assert.equal(runner.sawInventory, true);
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
});
