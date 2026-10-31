import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { completeBeadsExport, importBeadsMemoryDocuments, verifyBacklogMemoryOutputs, inspectTaskProviderMigration, migrateTaskProvider } from "../src/prime-agent-plugin/extension-support/task-provider-migration.ts";
import { ProcessCommandRunner } from "../src/prime-agent-plugin/extension-support/project-initialization.ts";
import { checkBeadsCapabilities, detectExplicitTaskProvider, detectTaskProvider } from "../src/prime-agent-plugin/extension-support/task-providers.ts";
import { prepareTaskHistoryWorkspace, TASK_HISTORY_REF } from "../src/prime-agent-plugin/extension-support/task-history-workspace.ts";

const BACKLOG_CANDIDATE = "deps/backlog/dist/backlog";
const RUNTIME_BACKLOG = "/usr/local/bin/backlog";
const BACKLOG = process.platform === "linux" && existsSync(RUNTIME_BACKLOG)
  ? RUNTIME_BACKLOG
  : existsSync(BACKLOG_CANDIDATE) ? realpathSync(BACKLOG_CANDIDATE) : "backlog";
const CUSTOM = "in_design:active,in_planning:active,ready_for_merge:wip,done:done";
const BEADS_INVENTORY = ["--readonly", "list", "--all", "--limit", "0", "--include-infra",
  "--include-templates", "--include-gates", "--include-ephemeral", "--json"];

class CandidateRunner extends ProcessCommandRunner {
  run(commandName, args, options = {}) {
    return super.run(commandName === "backlog" ? BACKLOG : commandName, args, options);
  }
}
const RUNNER = new CandidateRunner();

class RecordingBeadsRunner extends CandidateRunner {
  constructor() { super(); this.reads = []; this.sourceVersionSuffix = ""; this.sourceCatalogExtra = false; }
  run(commandName, args, options = {}) {
    const result = super.run(commandName, args, options);
    if (commandName !== "bd") return result;
    this.reads.push({ args: [...args], cwd: options.cwd, ...result });
    if (result.status !== 0) return result;
    // Migration source capture reads the raw version without transport preparation.
    if (args.length === 1 && args[0] === "--version" && this.sourceVersionSuffix) {
      return { ...result, stdout: `${result.stdout}${this.sourceVersionSuffix}` };
    }
    if (args[0] === "--readonly" && args[1] === "statuses" && this.sourceCatalogExtra) {
      return { ...result, stdout: JSON.stringify({ ...JSON.parse(result.stdout), source_catalog_context: { opaque: [1, null, false] } }) };
    }
    return result;
  }
}

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
  bd(fixture.root, "close", archived, "--reason", `Prime Claw abandonment: task ${archived}; pushed Episode head ${git(fixture.root, "rev-parse", "HEAD")}; code was not merged.`, "--json");
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

// This source is deliberately not prepared as an active Prime Claw Beads provider.
// Its Git origin publishes code/destination history only; the outgoing store has
// neither a Dolt remote nor a published source revision.
function embeddedBeadsSource(t, name = "embedded-beads-source", customStatuses) {
  const fixture = repository(t, name);
  bd(fixture.root, "init", "--skip-hooks", "--skip-agents", "--prefix", "EMB", "--quiet", "--non-interactive");
  // bd init adopts the code origin by default. Fixture setup removes that native
  // Dolt remote so canonical migration must really support an outgoing local store.
  bd(fixture.root, "dolt", "remote", "remove", "origin");
  if (customStatuses) bd(fixture.root, "config", "set", "status.custom", customStatuses);
  const parent = JSON.parse(bd(fixture.root, "create", "Embedded original", "--description", "original description",
    "--design", "living source plan", "--notes", "original notes", "--metadata", '{"opaque":{"shape":[1,null,false]}}', "--json")).id;
  bd(fixture.root, "update", parent, "--title", "Embedded revised", "--status", "in_progress", "--notes", "final source notes", "--json");
  const child = JSON.parse(bd(fixture.root, "create", "Embedded open child", "--parent", parent, "--json")).id;
  const blocked = JSON.parse(bd(fixture.root, "create", "Embedded blocked", "--status", "blocked", "--json")).id;
  bd(fixture.root, "dep", "add", blocked, child);
  bd(fixture.root, "comments", "add", parent, "embedded native comment", "--author", "source-author");
  bd(fixture.root, "provenance", "record", "--issue", parent, "--kind", "commit", "--source", "fixture",
    "--ref", git(fixture.root, "rev-parse", "HEAD"), "--ref-kind", "git-sha", "--actor", "source-actor", "--payload", '{"opaque":true}');
  git(fixture.root, "add", "-A");
  if (git(fixture.root, "status", "--porcelain=v1")) git(fixture.root, "commit", "-qm", "seed embedded source metadata");
  git(fixture.root, "push", "-q");
  assert.equal(JSON.parse(bd(fixture.root, "--readonly", "context", "--json")).dolt_mode, "embedded");
  assert.deepEqual(JSON.parse(bd(fixture.root, "--readonly", "dolt", "remote", "list", "--json")), []);
  return { ...fixture, ids: { parent, child, blocked } };
}

function sourceAuthorityFiles(root) {
  return Object.fromEntries(["config.yaml", "metadata.json"].map((name) => [name,
    readFileSync(join(root, ".beads", name)).toString("base64"),
  ]));
}

class AsIsBeadsRunner extends RecordingBeadsRunner {
  constructor() { super(); this.sourcePublicationCommands = []; }
  run(commandName, args, options = {}) {
    if (commandName === "bd") {
      // Sole-provider discovery is unchanged and has its own read-only probes.
      const discovery = JSON.stringify(args) === JSON.stringify(["config", "get", "no-db"])
        || JSON.stringify(args) === JSON.stringify(["context", "--json"]);
      assert.ok(args[0] === "--readonly" || (args.length === 1 && args[0] === "--version") || discovery,
        `retiring-source migration attempted active preparation/write: bd ${args.join(" ")}`);
      assert.equal(args.includes("sql"), false, "source capture must not require embedded SQL");
      assert.equal(args.includes("remote"), false, "source capture must not require a Dolt remote");
      assert.equal(args.includes("stop"), false, "embedded source retirement must not stop a server");
    }
    if (commandName === "git" && args.some((arg) => String(arg).includes("refs/dolt/data"))) {
      this.sourcePublicationCommands.push([...args]);
      assert.fail("retiring-source migration must not inspect, publish or delete a source Dolt publication");
    }
    return super.run(commandName, args, options);
  }
}

async function proveFixtureRuntime(records) {
  return records.map((record) => ({
    ownerSessionId: record.ownerSessionId,
    expectedPreviousEpisodeActiveSessionId: record.episodeActiveSessionId,
    verifiedCurrentEpisodeActiveSessionId: record.episodeActiveSessionId,
  }));
}

function sourcePackageFromBacklogComments(task) {
  const parts = task.comments.map((comment) => String(comment.text ?? comment.content ?? comment.body))
    .map((text) => /^prime-claw-task-provider-migration-source-v1 part=(\d+)\/(\d+)\n([A-Za-z0-9+/=]+)$/.exec(text))
    .filter(Boolean).sort((a, b) => Number(a[1]) - Number(b[1]));
  assert.ok(parts.length > 0, "native Backlog comments have no exact source package");
  assert.ok(parts.every((part, index) => Number(part[1]) === index + 1 && Number(part[2]) === parts.length));
  return JSON.parse(Buffer.from(parts.map((part) => part[3]).join(""), "base64").toString("utf8"));
}

function retainedBacklogArchivePackage(entityKind) {
  const sourceTaskId = entityKind === "draft" ? "DRAFT-12" : "OLD-7";
  return {
    marker: "prime-claw-task-provider-migration-source-v1", sourceProvider: "backlog",
    sourceTaskId, entityKind, classification: "archived",
    relativePath: `backlog/archive/${entityKind === "draft" ? "drafts" : "tasks"}/${sourceTaskId.toLowerCase()} - Prior archive.md`,
    nativeView: { task: { id: sourceTaskId, title: "Prior archive", status: "In Progress" } },
    markdownBase64: Buffer.from(`---\nid: ${sourceTaskId}\nstatus: In Progress\n---\nPrior archived ${entityKind}\n`).toString("base64"),
    gitHistoryBase64: Buffer.from("retained exact previous native history\n").toString("base64"),
    semanticPlacement: "Retain the original archive package without reinterpretation.",
  };
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
    cwd: "/definitely/missing", targetProvider: "backlog", expectedSourceRevision: "a".repeat(40),
    confirmedSwitch: false, actor: "operator", semanticPlacement: "preserve exact unsupported values",
  });
  assert.deepEqual(result, {
    status: "blocked", code: "confirmation-required",
    detail: "provider switch requires explicit operator confirmation",
    remediation: "inspect the migration, present the exact source revision and semantic placement, then call switch-confirm with confirmedSwitch=true",
    targetProvider: "backlog",
  });
});

test("read-only inspection captures complete Backlog open closed and archived native history", { skip: "Reverse migration retired; explicit no-command refusal is covered below", timeout: 60_000 }, (t) => {
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

test("ambiguous Backlog assignees require and apply an actual native Beads value before source deletion", { skip: "Reverse migration retired; explicit no-command refusal is covered below", timeout: 240_000 }, async (t) => {
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

test("confirmed migration preserves complete history, managed native placement, and a later active Episode head", { skip: "Reverse migration retired; explicit no-command refusal is covered below", timeout: 240_000 }, async (t) => {
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


test("active Episode identity drift blocks before destination creation and preserves source authority", { skip: "Reverse migration retired; explicit no-command refusal is covered below", timeout: 60_000 }, async (t) => {
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

test("pre-cutover deletion refusal preserves source and exact same-destination retry completes", { skip: "Reverse migration retired; explicit no-command refusal is covered below", timeout: 300_000 }, async (t) => {
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

test("partial source deletion preserves verified destination ownership and reports cutover incomplete", { skip: "Reverse migration retired; explicit no-command refusal is covered below", timeout: 300_000 }, async (t) => {
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
  const runner = new RecordingBeadsRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.equal(inspection.sourceProvider, "beads");
  assert.deepEqual(inspection.taskCounts, { open: 1, closed: 1, archived: 1, total: 3 });
  assert.equal(inspection.sourceRevision, `capture-sha256:${inspection.sourceDigest}`);
  assert.equal(detectTaskProvider(fixture.root, RUNNER).evidence.provider, "beads");
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
  const sourceReads = runner.reads.filter(({ args }) => ["show", "history", "provenance", "export", "list"].includes(args[0] === "--readonly" ? args[1] : args[0]));
  assert.ok(sourceReads.length > 0);
  assert.ok(sourceReads.every(({ args }) => args[0] === "--readonly"), "source task reads must fail closed in readonly mode");
  for (const id of Object.values(fixture.ids)) {
    assert.ok(sourceReads.some(({ args }) => JSON.stringify(args) === JSON.stringify(["--readonly", "show", id, "--json", "--long", "--include-comments"])));
    assert.ok(sourceReads.some(({ args }) => JSON.stringify(args) === JSON.stringify(["--readonly", "history", id, "--json", "--limit", "0"])));
    assert.ok(sourceReads.some(({ args }) => JSON.stringify(args) === JSON.stringify(["--readonly", "history", id, "--events", "--json", "--limit", "0"])));
    assert.ok(sourceReads.some(({ args }) => JSON.stringify(args) === JSON.stringify(["--readonly", "provenance", "log", id, "--json"])));
  }
  assert.ok(runner.reads.some(({ args }) => JSON.stringify(args) === JSON.stringify(BEADS_INVENTORY)));
  assert.ok(runner.reads.some(({ args }) => JSON.stringify(args) === JSON.stringify(["--readonly", "statuses", "--json"])));
});

test("Beads source digest binds raw version and complete catalog independently of task rows", { timeout: 180_000 }, (t) => {
  const fixture = beadsSource(t, "beads-source-context-digest");
  const runner = new RecordingBeadsRunner();
  const inspect = () => inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  const baseline = inspect();
  assert.equal(baseline.status, "ready", baseline.detail);
  // Raw whitespace must remain digest evidence; the semantic CLI version is unchanged.
  runner.sourceVersionSuffix = "\n";
  const versionChanged = inspect();
  assert.equal(versionChanged.status, "ready", versionChanged.detail);
  assert.equal(versionChanged.sourceRevision, `capture-sha256:${versionChanged.sourceDigest}`);
  assert.notEqual(versionChanged.sourceRevision, baseline.sourceRevision);
  assert.deepEqual(versionChanged.taskCounts, baseline.taskCounts);
  assert.notEqual(versionChanged.sourceDigest, baseline.sourceDigest);
  runner.sourceVersionSuffix = "";
  // Preserve unknown catalog context, not just statuses used by current tasks.
  runner.sourceCatalogExtra = true;
  const catalogChanged = inspect();
  assert.equal(catalogChanged.status, "ready", catalogChanged.detail);
  assert.equal(catalogChanged.sourceRevision, `capture-sha256:${catalogChanged.sourceDigest}`);
  assert.notEqual(catalogChanged.sourceRevision, baseline.sourceRevision);
  assert.deepEqual(catalogChanged.taskCounts, baseline.taskCounts);
  assert.notEqual(catalogChanged.sourceDigest, baseline.sourceDigest);
  assert.notEqual(catalogChanged.sourceDigest, versionChanged.sourceDigest);
  runner.sourceCatalogExtra = false;
  const restored = inspect();
  assert.equal(restored.status, "ready", restored.detail);
  assert.equal(restored.sourceDigest, baseline.sourceDigest);
  assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
});


test("confirmed Beads to Backlog migration preserves active Episode identity and continues on canonical-primary Backlog", { timeout: 180_000 }, async (t) => {
  const fixture = beadsSource(t, "beads-active-owner");
  const sourceVersion = command(fixture.root, "bd", ["--version"]);
  const statusCatalog = JSON.parse(bd(fixture.root, "--readonly", "statuses", "--json"));
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
    const sourcePackage = sourcePackageFromBacklogComments(task);
    assert.equal(sourcePackage.sourceTaskId, mapping.sourceTaskId);
    assert.equal(sourcePackage.sourceVersion, sourceVersion, "preserve raw version stdout, including its newline");
    assert.deepEqual(sourcePackage.statusCatalog, statusCatalog);
    assert.equal(sourcePackage.sourceDigest, inspection.sourceDigest);
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
  const finalEpisodeHead = git(owner.episode, "rev-parse", "HEAD");
  git(owner.episode, "merge-base", "--is-ancestor", owner.episodeHead, finalEpisodeHead);
  assert.equal(git(owner.episode, "branch", "--show-current"), owner.record.branch);
  assert.equal(git(owner.episode, "ls-remote", "--refs", "origin", `refs/heads/${owner.record.branch}`).split(/\s+/)[0], finalEpisodeHead);
  assert.deepEqual(git(owner.episode, "diff", "--name-only", `${owner.episodeHead}..${finalEpisodeHead}`).split(/\r?\n/), ["backlog.config.yml"], "final Episode publication contains only the approved native root link");
  assert.equal(git(owner.episode, "rev-parse", `${owner.episodeHead}:README.md`), git(owner.episode, "rev-parse", `${finalEpisodeHead}:README.md`), "business bytes remain unchanged");
  const linkedDetection = detectTaskProvider(owner.episode, RUNNER);
  assert.equal(linkedDetection.kind, "selected");
  assert.equal(linkedDetection.evidence.provider, "backlog");
  assert.equal(existsSync(join(owner.episode, ".backlog", ".git")), true);
  assert.equal(existsSync(join(owner.episode, ".beads", "metadata.json")), true, "historical code bytes remain without live provider authority");
});


test("Beads to Backlog migration preserves the selected non-origin remote for ordinary preparation", { timeout: 240_000 }, async (t) => {
  const fixture = beadsSource(t, "beads-upstream-remote");
  git(fixture.root, "remote", "rename", "origin", "upstream");
  bd(fixture.root, "dolt", "remote", "remove", "origin");
  const remoteUrl = `git+${pathToFileURL(fixture.remote).href}`;
  bd(fixture.root, "dolt", "remote", "add", "upstream", remoteUrl, "--allow-git-origin");
  bd(fixture.root, "config", "set", "sync.remote", remoteUrl);
  command(fixture.root, "bd", ["dolt", "commit", "-m", "select upstream remote"], true);
  bd(fixture.root, "dolt", "push", "--remote", "upstream", "--no-adopt");
  git(fixture.root, "add", "-A");
  if (git(fixture.root, "status", "--porcelain=v1")) git(fixture.root, "commit", "-qm", "select upstream remote");
  git(fixture.root, "push", "-q");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  const result = await migrateTaskProvider({
    cwd: fixture.root,
    targetProvider: "backlog",
    runner: RUNNER,
    expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true,
    actor: "upstream-remote-operator",
    semanticPlacement: "Preserve complete native fields in the selected independent Backlog store.",
    verifyActiveRuntime: proveFixtureRuntime,
  });
  assert.equal(result.status, "completed", result.detail);
  const storeDir = join(fixture.root, ".backlog");
  assert.equal(git(storeDir, "remote"), "upstream");
  assert.equal(git(storeDir, "remote", "get-url", "upstream"), fixture.remote);
  const prepared = prepareTaskHistoryWorkspace({ primaryRoot: fixture.root, runner: RUNNER });
  assert.equal(prepared.status, "prepared", prepared.detail);
  assert.equal(prepared.remote, "upstream");
});


test("forward Beads retirement preserves outgoing Dolt history and operator ignores before Backlog replay", { timeout: 300_000 }, async (t) => {
  const fixture = beadsSource(t, "forward-publication-retirement");
  const operatorIgnore = "operator-cache/\n";
  const nativeIgnore = readFileSync(join(fixture.root, ".gitignore"), "utf8");
  assert.match(nativeIgnore, /\*\.gate\.lock\*/);
  const retiredBlock = ["# Beads / Dolt files (added by bd init)", ".dolt/", "*.db",
    ".beads-credential-key", ".beads/proxieddb/", "*.gate.lock*", ""].join("\n");
  assert.ok(nativeIgnore.includes(retiredBlock), "fixture must contain the exact native provider block");
  const retainedIgnore = nativeIgnore.replace(retiredBlock, "") + operatorIgnore;
  writeFileSync(join(fixture.root, ".gitignore"), nativeIgnore + operatorIgnore);
  git(fixture.root, "add", ".gitignore");
  git(fixture.root, "commit", "-qm", "preserve operator ignore rule");
  git(fixture.root, "push", "-q");
  const sourcePublication = git(fixture.root, "ls-remote", "--refs", fixture.remote, "refs/dolt/data");
  assert.match(sourcePublication, /refs\/dolt\/data$/);
  const toBacklog = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: RUNNER });
  assert.equal(toBacklog.status, "ready", toBacklog.detail);
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner: RUNNER, expectedSourceRevision: toBacklog.sourceRevision,
    confirmedSwitch: true, actor: "retirement-operator", semanticPlacement: "Preserve exact native source history in published Backlog provenance.",
    verifyActiveRuntime: proveFixtureRuntime,
  });
  assert.equal(result.status, "completed", result.detail);
  assert.equal(result.selectedProvider, "backlog");
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  assert.equal(existsSync(join(fixture.root, ".beads.gate.lock")), false, "retired native gate lock must not survive cutover");
  assert.equal(git(fixture.root, "ls-remote", "--refs", fixture.remote, "refs/dolt/data"), sourcePublication,
    "local source retirement must retain outgoing remote history without changing its ref");
  const finalIgnore = readFileSync(join(fixture.root, ".gitignore"), "utf8");
  assert.equal(finalIgnore, retainedIgnore + "/.backlog/\n",
    "cutover preserves exact operator bytes, removes only the native Beads block, and appends only the required Backlog wrapper");
  assert.equal(finalIgnore.split(/\r?\n/).filter((line) => line === "/.backlog/").length, 1);
  assert.equal(finalIgnore.includes(retiredBlock), false);
  assert.match(readFileSync(join(fixture.root, ".gitignore"), "utf8"), /operator-cache\//);
  const finalPreparation = prepareTaskHistoryWorkspace({ primaryRoot: fixture.root, runner: RUNNER });
  assert.equal(finalPreparation.status, "prepared", finalPreparation.detail);
  assert.equal(git(fixture.root, "rev-parse", TASK_HISTORY_REF), result.receipt.destinationReceiptRevision);
});


test("Beads source inspection rejects effective owner-filter omissions before destination creation", { timeout: 120_000 }, (t) => {
  const fixture = embeddedBeadsSource(t, "beads-filtered-source");
  const filtered = JSON.parse(bd(fixture.root, "create", "Filtered ordinary task", "--status", "in_progress", "--actor", "excluded-reviewer", "--json"));
  const view = JSON.parse(bd(fixture.root, "--readonly", "show", filtered.id, "--json", "--long", "--include-comments"))[0];
  assert.ok(view.created_by);
  bd(fixture.root, "config", "set", "export.exclude_owners", view.created_by);
  git(fixture.root, "add", "-A");
  if (git(fixture.root, "status", "--porcelain=v1")) git(fixture.root, "commit", "-qm", "configure supported export filter");
  git(fixture.root, "push", "-q");
  const filterBefore = bd(fixture.root, "--readonly", "config", "get", "export.exclude_owners", "--json");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: RUNNER });
  assert.equal(inspection.status, "blocked");
  assert.match(inspection.detail, /does not exactly match the independent native issue inventory/);
  assert.equal(bd(fixture.root, "--readonly", "config", "get", "export.exclude_owners", "--json"), filterBefore);
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
});

test("Backlog lifecycle counts use exact native Done status rather than physical folder", { skip: "Reverse migration retired; explicit no-command refusal is covered below", timeout: 60_000 }, (t) => {
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

test("late active Episode code drift after runtime proof preserves source and ownership", { skip: "Reverse migration retired; explicit no-command refusal is covered below", timeout: 180_000 }, async (t) => {
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

test("missing active Episode durable session blocks inspection before destination creation", { skip: "Reverse migration retired; explicit no-command refusal is covered below", timeout: 60_000 }, (t) => {
  const fixture = backlogSource(t, "backlog-missing-runtime");
  const owner = addActiveBacklogOwner(fixture);
  rmSync(owner.record.episodeSessionFile);
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "beads", runner: RUNNER });
  assert.equal(inspection.status, "blocked");
  assert.match(inspection.detail, /durable session file is absent/);
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  assert.equal(existsSync(join(fixture.root, "backlog")), true);
});

class BeadsReceiptDriftRunner extends CandidateRunner {
  constructor() { super(); this.drifted = false; }
  run(commandName, args, options = {}) {
    const result = super.run(commandName, args, options);
    if (!this.drifted && commandName === "bd" && args[0] === "create"
        && args[1] === "Prime Claw task-provider migration receipt" && result.status === 0) {
      const created = JSON.parse(result.stdout);
      const row = Array.isArray(created) ? created[0] : created;
      this.drifted = true;
      super.run("bd", ["update", row.id, "--notes", "corrupted receipt", "--metadata", JSON.stringify({ prime_claw_migration: {
        marker: "prime-claw-task-provider-migration-receipt-v1", sourceProvider: "backlog", targetProvider: "beads",
        sourceRevision: "0".repeat(40), sourceDigest: "0".repeat(64),
      } }), "--json"], options);
    }
    return result;
  }
}

class BacklogReceiptDriftRunner extends CandidateRunner {
  constructor() { super(); this.drifted = false; }
  run(commandName, args, options = {}) {
    const result = super.run(commandName, args, options);
    if (!this.drifted && commandName === "backlog" && args[0] === "task" && args[1] === "edit"
        && args.includes("Verified selected-provider migration receipt") && result.status === 0) {
      const id = args.at(-1);
      this.drifted = true;
      super.run("backlog", ["task", "edit", "--notes", "corrupted receipt", "--plain", "--", id], options);
    }
    return result;
  }
}

test("exact Beads receipt drift blocks before Backlog source deletion", { skip: "Reverse migration retired; explicit no-command refusal is covered below", timeout: 180_000 }, async (t) => {
  const fixture = backlogSource(t, "beads-receipt-drift");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "beads", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  const runner = new BeadsReceiptDriftRunner();
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "beads", runner, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve unsupported values in native metadata.",
  });
  assert.equal(runner.drifted, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "pre-cutover-failed");
  assert.match(result.detail, /receipt.*does not exactly match/i);
  assert.equal(existsSync(join(fixture.root, "backlog")), true);
});

test("exact Backlog receipt drift blocks before Beads source deletion", { timeout: 240_000 }, async (t) => {
  const fixture = beadsSource(t, "backlog-receipt-drift");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  const runner = new BacklogReceiptDriftRunner();
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve unsupported values in native provenance.",
  });
  assert.equal(runner.drifted, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "pre-cutover-failed");
  assert.match(result.detail, /receipt.*does not exactly match/i);
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
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
  const registryPath = join(fixture.root, ".prime-claw", "ownership.json");
  const registryBefore = existsSync(registryPath) ? readFileSync(registryPath).toString("base64") : null;
  const sourceBefore = sourceAuthorityFiles(fixture.root);
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
  assert.match(result.detail, /destination.*publication|exact revision|publish Backlog destination:[\s\S]*\[rejected\][\s\S]*fetch first/i);
  assert.equal(existsSync(registryPath) ? readFileSync(registryPath).toString("base64") : null, registryBefore);
  assert.deepEqual(sourceAuthorityFiles(fixture.root), sourceBefore);
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
});


test("post-switch runtime continuity loss rolls ownership back before source deletion", { skip: "Reverse migration retired; explicit no-command refusal is covered below", timeout: 180_000 }, async (t) => {
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
  // A complete same-source receipt admits only its exact pending native layout.
  // The explicit second invocation must not adopt unrelated business or metadata edits.
  const replayDestinationHead = git(join(fixture.root, ".backlog"), "rev-parse", "HEAD");
  const replayRegistryPath = join(fixture.root, ".prime-claw", "ownership.json");
  const replayRegistry = readFileSync(replayRegistryPath).toString("base64");
  const replaySource = sourceAuthorityFiles(fixture.root);
  for (const [path, delta, diagnostic] of [["README.md", "\nunauthorized business edit\n", /unrelated code changes/],
      [".gitignore", "\nunauthorized-extra-rule/\n", /unauthorized metadata changes/]]) {
    const actual = join(fixture.root, path), original = readFileSync(actual);
    writeFileSync(actual, Buffer.concat([original, Buffer.from(delta)]));
    const denied = await migrateTaskProvider({
      cwd: fixture.root, targetProvider: "backlog", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
      confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve exact unsupported values in native provenance.",
      verifyActiveRuntime: proveFixtureRuntime,
    });
    assert.equal(denied.status, "blocked");
    assert.equal(denied.code, "pre-cutover-failed");
    assert.match(denied.detail, diagnostic);
    assert.equal(readFileSync(actual).compare(Buffer.concat([original, Buffer.from(delta)])), 0, "refusal never repairs unauthorized code");
    assert.equal(git(join(fixture.root, ".backlog"), "rev-parse", "HEAD"), replayDestinationHead);
    assert.equal(git(join(fixture.root, ".backlog"), "status", "--porcelain=v1"), "");
    assert.equal(readFileSync(replayRegistryPath).toString("base64"), replayRegistry);
    assert.deepEqual(sourceAuthorityFiles(fixture.root), replaySource);
    writeFileSync(actual, original);
  }
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



test("Backlog native drafts are counted and preserved exactly before source deletion", { skip: "Reverse migration retired; explicit no-command refusal is covered below", timeout: 300_000 }, async (t) => {
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




test("used unsupported Beads statuses and ambiguous archive records aggregate before inspection or confirmation destination writes", { timeout: 240_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "embedded-status-archive-preflight", "unused:active,finished:done,paused:wip");
  const runner = new AsIsBeadsRunner();
  const baseline = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(baseline.status, "ready", baseline.detail);
  const offenders = [];
  for (const status of ["deferred", "pinned", "hooked", "finished", "paused"]) {
    const id = JSON.parse(bd(fixture.root, "create", `Unsupported ${status}`, "--status", status, "--json")).id;
    offenders.push({ id, status });
  }
  const malformed = JSON.parse(bd(fixture.root, "create", "Malformed claimed prior archive", "--metadata", JSON.stringify({
    prime_claw_migration: { marker: "prime-claw-task-provider-migration-source-v1", sourceProvider: "backlog", classification: "archived" },
  }), "--json")).id;
  bd(fixture.root, "close", malformed, "--reason", "ordinary closed task with malformed archive claim", "--json");
  offenders.push({ id: malformed, status: "closed" });
  const contradictory = JSON.parse(bd(fixture.root, "create", "Open task with retained archive evidence", "--metadata", JSON.stringify({
    prime_claw_migration: retainedBacklogArchivePackage("task"),
  }), "--json")).id;
  offenders.push({ id: contradictory, status: "open" });
  const wrongAbandonment = JSON.parse(bd(fixture.root, "create", "Abandonment reason names another task", "--json")).id;
  bd(fixture.root, "close", wrongAbandonment, "--reason", `Prime Claw abandonment: task OTHER-1; pushed Episode head ${git(fixture.root, "rev-parse", "HEAD")}; code was not merged.`, "--json");
  offenders.push({ id: wrongAbandonment, status: "closed" });
  const before = sourceAuthorityFiles(fixture.root);
  const exportBefore = bd(fixture.root, "--readonly", "export", "--all");
  const historyBefore = Object.fromEntries(offenders.map(({ id }) => [id, bd(fixture.root, "--readonly", "history", id, "--json", "--limit", "0")]));
  const sourceHead = git(fixture.root, "rev-parse", "HEAD");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  let deletions = 0;
  const confirmed = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: baseline.sourceRevision,
    confirmedSwitch: true, actor: "status-preflight-operator", semanticPlacement: "Preserve complete source fields and history.",
    deleteSource() { deletions += 1; },
  });
  for (const result of [inspection, confirmed]) {
    assert.equal(result.status, "blocked");
    for (const { id, status } of offenders) {
      assert.ok(result.detail.includes(`${id} status=${JSON.stringify(status)}`), `diagnostic omitted exact task/status ${id}/${status}: ${result.detail}`);
    }
    assert.equal(result.detail.includes('status="unused"'), false, "unused catalog entries must not be status offenders");
  }
  assert.equal(deletions, 0);
  assert.deepEqual(sourceAuthorityFiles(fixture.root), before);
  assert.equal(bd(fixture.root, "--readonly", "export", "--all"), exportBefore);
  for (const { id } of offenders) assert.equal(bd(fixture.root, "--readonly", "history", id, "--json", "--limit", "0"), historyBefore[id]);
  assert.equal(git(fixture.root, "rev-parse", "HEAD"), sourceHead);
  assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
  assert.deepEqual(JSON.parse(bd(fixture.root, "--readonly", "dolt", "remote", "list", "--json")), []);
  assert.deepEqual(runner.sourcePublicationCommands, []);
});



test("Beads closed reasons and categories complete normally while exact archive evidence retains native archive placement", { timeout: 300_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "embedded-closed-versus-archive", "unused_archive_hint:done");
  const expectedClass = Object.fromEntries(Object.values(fixture.ids).map((id) => [id, "open"]));
  for (const [index, reason] of [
    "Delivered requested changes",
    "abandoned archive cancel rejected keywords are ordinary closure text",
    "Completed normally with unrelated migration metadata",
  ].entries()) {
    const metadata = index === 2 ? { prime_claw_migration: {
      marker: "prime-claw-task-provider-migration-source-v1", sourceProvider: "backlog", classification: "closed",
      sourceTaskId: "OLD-6", relativePath: "backlog/tasks/old-6 - Ordinary completion.md",
    } } : { opaque: { reasonCategory: "abandoned", values: [1, null, false] } };
    const id = JSON.parse(bd(fixture.root, "create", `Ordinary closed ${index}`, "--metadata", JSON.stringify(metadata), "--json")).id;
    bd(fixture.root, "close", id, "--reason", reason, "--json");
    expectedClass[id] = "closed";
  }
  const abandoned = JSON.parse(bd(fixture.root, "create", "Exact native Prime Claw abandonment", "--json")).id;
  bd(fixture.root, "close", abandoned, "--reason", `Prime Claw abandonment: task ${abandoned}; pushed Episode head ${git(fixture.root, "rev-parse", "HEAD")}; code was not merged.`, "--json");
  expectedClass[abandoned] = "archived";
  for (const entityKind of ["task", "draft"]) {
    const id = JSON.parse(bd(fixture.root, "create", `Retained prior Backlog ${entityKind} archive`, "--metadata", JSON.stringify({
      prime_claw_migration: retainedBacklogArchivePackage(entityKind),
    }), "--json")).id;
    bd(fixture.root, "close", id, "--reason", "Original archive lifecycle is retained in the exact prior source package", "--json");
    expectedClass[id] = "archived";
  }
  const before = sourceAuthorityFiles(fixture.root);
  const sourceVersion = command(fixture.root, "bd", ["--version"]);
  const statusCatalog = JSON.parse(bd(fixture.root, "--readonly", "statuses", "--json"));
  const exportRows = Object.fromEntries(bd(fixture.root, "--readonly", "export", "--all").split(/\r?\n/).filter(Boolean).map((line) => {
    const row = JSON.parse(line);
    return [row.id, row];
  }));
  const native = Object.fromEntries(Object.keys(expectedClass).map((id) => [id, {
    view: JSON.parse(bd(fixture.root, "--readonly", "show", id, "--json", "--long", "--include-comments"))[0],
    history: JSON.parse(bd(fixture.root, "--readonly", "history", id, "--json", "--limit", "0")),
    events: JSON.parse(bd(fixture.root, "--readonly", "history", id, "--events", "--json", "--limit", "0")),
    provenance: JSON.parse(bd(fixture.root, "--readonly", "provenance", "log", id, "--json")),
  }]));
  class ArchivePublicationRunner extends AsIsBeadsRunner {
    constructor() { super(); this.destinationPublications = 0; }
    run(commandName, args, options = {}) {
      const publishingDestination = commandName === "git" && args.includes("push") && options.cwd === join(fixture.root, ".backlog");
      if (publishingDestination) assert.deepEqual(sourceAuthorityFiles(fixture.root), before, "source retired before destination publication");
      const result = super.run(commandName, args, options);
      if (publishingDestination && result.status === 0) {
        this.destinationPublications += 1;
        assert.deepEqual(sourceAuthorityFiles(fixture.root), before, "source changed during destination publication");
      }
      return result;
    }
  }
  const runner = new ArchivePublicationRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.deepEqual(inspection.taskCounts, { open: 3, closed: 3, archived: 3, total: 9 });
  assert.deepEqual(sourceAuthorityFiles(fixture.root), before);
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "archive-migration-operator", semanticPlacement: "Retain exact source lifecycle evidence and raw native content.",
  });
  assert.equal(result.status, "completed", result.detail);
  assert.equal(result.sourceAbsent, true);
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  assert.ok(runner.destinationPublications > 0, "destination must publish while source is intact");
  assert.deepEqual(result.receipt.taskCounts, inspection.taskCounts);
  assert.equal(result.receipt.mappings.length, 9);
  const store = join(fixture.root, ".backlog");
  assert.equal(git(store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], result.receipt.destinationReceiptRevision);
  const receipt = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", result.receiptTaskId)).task;
  assert.ok(receipt.comments.some((comment) => String(comment.text ?? comment.content ?? comment.body).includes("prime-claw-task-provider-migration-receipt-v1")));
  const paths = git(store, "ls-files").split(/\r?\n/).filter((path) => path.endsWith(".md"));
  // Archived tasks need a disposable native view. The live destination stays untouched.
  const archiveReadRoot = join(fixture.outer, "archive-native-read");
  mkdirSync(archiveReadRoot);
  const archiveReadStore = join(archiveReadRoot, ".backlog");
  command(archiveReadRoot, "git", ["clone", "-q", "--no-hardlinks", store, archiveReadStore]);
  for (const mapping of result.receipt.mappings) {
    const classification = expectedClass[mapping.sourceTaskId];
    const matching = paths.filter((path) => new RegExp(`^id:\\s*${mapping.destinationTaskId}\\s*$`, "m").test(readFileSync(join(store, path), "utf8")));
    assert.equal(matching.length, 1, `one physical destination task required for ${mapping.sourceTaskId}`);
    const physicalPath = matching[0];
    assert.ok(physicalPath.startsWith(classification === "archived" ? "archive/tasks/" : classification === "closed" ? "completed/" : "tasks/"), physicalPath);
    let task;
    if (classification === "archived") {
      renameSync(join(archiveReadStore, physicalPath), join(archiveReadStore, "tasks", physicalPath.split("/").at(-1)));
      task = JSON.parse(backlog(archiveReadRoot, "task", "view", "--json", "--", mapping.destinationTaskId)).task;
    } else {
      task = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", mapping.destinationTaskId)).task;
    }
    const expected = native[mapping.sourceTaskId];
    assert.equal(task.status, classification === "archived" ? "In Progress" : classification === "open" ? ({ open: "In Design", in_progress: "In Progress", blocked: "Blocked" })[expected.view.status] : "Done");
    const pkg = sourcePackageFromBacklogComments(task);
    assert.equal(pkg.sourceVersion, sourceVersion);
    assert.deepEqual(pkg.statusCatalog, statusCatalog);
    assert.equal(pkg.sourceDigest, inspection.sourceDigest);
    assert.deepEqual(pkg.exportRow, exportRows[mapping.sourceTaskId]);
    assert.deepEqual(pkg.nativeView, expected.view);
    assert.deepEqual(pkg.history, expected.history);
    assert.deepEqual(pkg.events, expected.events);
    assert.deepEqual(pkg.provenance, expected.provenance);
  }
  assert.equal(git(store, "status", "--porcelain=v1"), "");
  assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
  assert.deepEqual(runner.sourcePublicationCommands, []);
});

test("canonical source inspection reads embedded local-only built-in and partial catalogs as-is", { timeout: 180_000 }, async (t) => {
  for (const [name, custom] of [["built-in-only", undefined], ["partial-custom", "in_design:active"]]) {
    await t.test(name, (t) => {
      const fixture = embeddedBeadsSource(t, `inspect-${name}`, custom);
      const before = sourceAuthorityFiles(fixture.root);
      const catalog = JSON.parse(bd(fixture.root, "--readonly", "statuses", "--json"));
      const runner = new AsIsBeadsRunner();
      const inspect = () => inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
      const first = inspect();
      assert.equal(first.status, "ready", first.detail);
      assert.equal(first.sourceProvider, "beads");
      assert.equal(first.sourceRevision, `capture-sha256:${first.sourceDigest}`);
      assert.deepEqual(first.taskCounts, { open: 3, closed: 0, archived: 0, total: 3 });
      const second = inspect();
      assert.equal(second.status, "ready", second.detail);
      assert.equal(second.sourceRevision, first.sourceRevision);
      assert.equal(second.sourceDigest, first.sourceDigest);
      assert.deepEqual(sourceAuthorityFiles(fixture.root), before);
      assert.deepEqual(JSON.parse(bd(fixture.root, "--readonly", "statuses", "--json")), catalog);
      assert.deepEqual(catalog.custom_statuses, custom ? [{ name: "in_design", category: "active" }] : undefined);
      assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
      assert.equal(existsSync(join(fixture.root, ".backlog")), false);
      assert.ok(runner.reads.some(({ args }) => JSON.stringify(args) === JSON.stringify(["--readonly", "context", "--json"])));
      assert.ok(runner.reads.some(({ args }) => JSON.stringify(args) === JSON.stringify(BEADS_INVENTORY)));
      assert.deepEqual(runner.sourcePublicationCommands, []);
    });
  }
});

test("confirmed embedded local-only migration publishes Backlog before retiring source and preserves compatible active ownership", { timeout: 240_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "embedded-active-retirement");
  const before = sourceAuthorityFiles(fixture.root);
  const sourceVersion = command(fixture.root, "bd", ["--version"]);
  const statusCatalog = JSON.parse(bd(fixture.root, "--readonly", "statuses", "--json"));
  const native = Object.fromEntries(Object.values(fixture.ids).map((id) => [id, {
    view: JSON.parse(bd(fixture.root, "--readonly", "show", id, "--json", "--long", "--include-comments"))[0],
    history: JSON.parse(bd(fixture.root, "--readonly", "history", id, "--json", "--limit", "0")),
    events: JSON.parse(bd(fixture.root, "--readonly", "history", id, "--events", "--json", "--limit", "0")),
    provenance: JSON.parse(bd(fixture.root, "--readonly", "provenance", "log", id, "--json")),
  }]));
  const owner = addActiveBeadsOwner(fixture);
  writeFileSync(join(owner.episode, "compatible-progress.txt"), "compatible active source progress\n");
  git(owner.episode, "add", "compatible-progress.txt");
  git(owner.episode, "commit", "-qm", "compatible later Episode implementation");
  git(owner.episode, "push", "-q");
  const laterHead = git(owner.episode, "rev-parse", "HEAD");
  const runner = new AsIsBeadsRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.deepEqual(inspection.activeOwnership, [{ ownerSessionId: owner.ownerSessionId, taskId: fixture.ids.parent }]);
  let runtimeProofs = 0;
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "embedded-migration-operator",
    semanticPlacement: "Preserve exact native source data and history in Backlog provenance.",
    async verifyActiveRuntime(records) {
      runtimeProofs += 1;
      assert.ok(records.every((record) => record.head === laterHead));
      assert.deepEqual(sourceAuthorityFiles(fixture.root), before, "source authority changed before guarded retirement");
      if (runtimeProofs >= 3) {
        const store = join(fixture.root, ".backlog");
        assert.equal(git(store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], git(store, "rev-parse", "HEAD"),
          "Backlog must already be published while source authority is still intact");
      }
      return proveFixtureRuntime(records);
    },
  });
  assert.equal(result.status, "completed", result.detail);
  assert.equal(result.sourceAbsent, true);
  assert.equal(result.selectedProvider, "backlog");
  assert.ok(runtimeProofs >= 3, "active continuity must be proved through ownership cutover");
  assert.deepEqual(result.receipt.taskCounts, { open: 3, closed: 0, archived: 0, total: 3 });
  assert.equal(result.receipt.sourceRevision, inspection.sourceRevision);
  assert.equal(result.receipt.sourceDigest, inspection.sourceDigest);
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  const store = join(fixture.root, ".backlog");
  assert.equal(git(store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], result.receipt.destinationReceiptRevision);
  for (const mapping of result.receipt.mappings) {
    const task = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", mapping.destinationTaskId)).task;
    const pkg = sourcePackageFromBacklogComments(task);
    const expected = native[mapping.sourceTaskId];
    assert.equal(pkg.sourceVersion, sourceVersion);
    assert.deepEqual(pkg.statusCatalog, statusCatalog);
    assert.equal(pkg.sourceDigest, inspection.sourceDigest);
    assert.equal(pkg.sourceIdentity.storeDir, join(fixture.root, ".beads"));
    assert.equal(pkg.sourceIdentity.doltMode, "embedded");
    assert.equal(pkg.sourceIdentity.database, "EMB");
    assert.deepEqual(pkg.nativeView, expected.view);
    assert.deepEqual(pkg.history, expected.history);
    assert.deepEqual(pkg.events, expected.events);
    assert.deepEqual(pkg.provenance, expected.provenance);
    assert.equal(task.status, ({ open: "In Design", in_progress: "In Progress", blocked: "Blocked" })[expected.view.status]);
  }
  const current = JSON.parse(readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8")).owners[owner.ownerSessionId];
  assert.equal(current.provider, "backlog");
  assert.equal(current.taskId, result.receipt.mappings.find((row) => row.sourceTaskId === fixture.ids.parent).destinationTaskId);
  for (const field of ["ownerSessionId", "operationId", "engine", "baseRef", "createdAt", "worktree", "branch", "head", "episodeId", "episodeSessionFile", "episodeActiveSessionId"]) {
    assert.deepEqual(current[field], owner.record[field], field);
  }
  const finalizedEpisodeHead = git(owner.episode, "rev-parse", "HEAD");
  git(owner.episode, "merge-base", "--is-ancestor", laterHead, finalizedEpisodeHead);
  assert.equal(git(owner.episode, "ls-remote", "--refs", "origin", "refs/heads/episode-beads-owner").split(/\s+/)[0], finalizedEpisodeHead);
  assert.deepEqual(git(owner.episode, "diff", "--name-only", `${laterHead}..${finalizedEpisodeHead}`).split(/\r?\n/), ["backlog.config.yml"]);
  assert.equal(git(owner.episode, "status", "--porcelain=v1"), "");
  assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
  assert.ok(runner.reads.filter(({ args }) => JSON.stringify(args) === JSON.stringify(BEADS_INVENTORY)).length >= 6,
    "complete source must be recaptured through active workspace and guarded retirement proofs");
  assert.ok(runner.reads.some(({ cwd, args }) => cwd === owner.episode && args[0] === "--readonly" && args[1] === "context"),
    "active source workspace needs its own native source identity proof");
  assert.deepEqual(runner.sourcePublicationCommands, []);
});

test("embedded source refuses mismatched active workspace identity and unreadable native history before destination creation", { timeout: 180_000 }, async (t) => {
  for (const kind of ["active identity", "history"]) {
    await t.test(kind, (t) => {
      const fixture = embeddedBeadsSource(t, `embedded-refuse-${kind.replaceAll(" ", "-")}`);
      const owner = kind === "active identity" ? addActiveBeadsOwner(fixture) : null;
      const before = sourceAuthorityFiles(fixture.root);
      let refused = false;
      class UnreadableSourceRunner extends AsIsBeadsRunner {
        run(commandName, args, options = {}) {
          const result = super.run(commandName, args, options);
          if (commandName === "bd" && args[0] === "--readonly" && result.status === 0) {
            if (kind === "active identity" && args[1] === "context" && options.cwd === owner.episode) {
              refused = true;
              return { ...result, stdout: JSON.stringify({ ...JSON.parse(result.stdout), database: "OTHER" }) };
            }
            if (kind === "history" && args[1] === "history") {
              refused = true;
              return { status: 1, stdout: "", stderr: "fixture cannot read required native history" };
            }
          }
          return result;
        }
      }
      const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: new UnreadableSourceRunner() });
      assert.equal(refused, true);
      assert.equal(inspection.status, "blocked");
      assert.match(inspection.detail, kind === "history" ? /cannot read required native history/ : /source context.*store, database and mode/);
      assert.deepEqual(sourceAuthorityFiles(fixture.root), before);
      assert.equal(existsSync(join(fixture.root, ".backlog")), false);
      assert.equal(existsSync(join(fixture.root, ".beads")), true);
      assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
    });
  }
});

test("repeated embedded source proofs reject task and catalog drift without source publication", { timeout: 240_000 }, async (t) => {
  for (const kind of ["task", "catalog"]) {
    await t.test(kind, async (t) => {
      const fixture = embeddedBeadsSource(t, `embedded-${kind}-drift`);
      const owner = addActiveBeadsOwner(fixture);
      const runner = new AsIsBeadsRunner();
      const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
      assert.equal(inspection.status, "ready", inspection.detail);
      const ownershipBefore = readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8");
      let changed = false, deletions = 0;
      const result = await migrateTaskProvider({
        cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: inspection.sourceRevision,
        confirmedSwitch: true, actor: "drift-operator", semanticPlacement: "Preserve exact source evidence.",
        async verifyActiveRuntime(records) {
          if (!changed) {
            changed = true;
            if (kind === "task") bd(fixture.root, "update", fixture.ids.parent, "--notes", "changed during maintenance", "--json");
            else bd(fixture.root, "config", "set", "status.custom", "in_design:active");
          }
          return proveFixtureRuntime(records);
        },
        deleteSource() { deletions += 1; },
      });
      assert.equal(changed, true);
      assert.equal(result.status, "blocked");
      assert.match(result.detail, /source provider changed during the maintenance window/);
      assert.equal(deletions, 0);
      assert.equal(existsSync(join(fixture.root, ".beads")), true);
      assert.equal(readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8"), ownershipBefore);
      assert.equal(git(owner.episode, "rev-parse", "HEAD"), owner.episodeHead);
      assert.deepEqual(runner.sourcePublicationCommands, []);
    });
  }
});

test("production export helper captures embedded local-only native inventory without lifecycle or transport setup", { timeout: 120_000 }, (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-migration-embedded-export-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  command(root, "git", ["init", "-q", "-b", "main"]);
  git(root, "config", "user.name", "Embedded Export Fixture");
  git(root, "config", "user.email", "embedded-export@example.invalid");
  // Fixture writes only. Deliberately no --server, custom statuses, remote or push.
  bd(root, "init", "--skip-hooks", "--skip-agents", "--prefix", "EMB", "--quiet", "--non-interactive");
  const ids = [];
  for (const status of ["open", "in_progress", "blocked", "deferred", "pinned", "hooked"]) {
    ids.push(JSON.parse(bd(root, "create", `Embedded ${status}`, "--status", status, "--json")).id);
  }
  const closed = JSON.parse(bd(root, "create", "Embedded closed", "--json")).id;
  bd(root, "close", closed, "--reason", "fixture native closure", "--json");
  ids.push(closed);
  assert.equal(JSON.parse(bd(root, "--readonly", "context", "--json")).dolt_mode, "embedded");
  assert.deepEqual(JSON.parse(bd(root, "--readonly", "dolt", "remote", "list", "--json")), []);
  const identityBefore = Object.fromEntries(["config.yaml", "metadata.json"].map((name) => [name, readFileSync(join(root, ".beads", name)).toString("base64")]));
  const runner = new RecordingBeadsRunner();
  const exported = completeBeadsExport(runner, root, "embedded fixture");
  const inventory = JSON.parse(bd(root, ...BEADS_INVENTORY));
  assert.deepEqual(exported.map(({ row }) => row.id).sort(), [...ids].sort());
  assert.deepEqual(exported.map(({ row }) => row.id).sort(), inventory.map((row) => row.id).sort());
  assert.ok(exported.every(({ row, line }) => JSON.stringify(JSON.parse(line)) === JSON.stringify(row)));
  assert.deepEqual(runner.reads.map(({ args }) => args), [["--readonly", "export", "--all"], BEADS_INVENTORY]);
  assert.deepEqual(completeBeadsExport(runner, root, "embedded fixture"), exported);
  assert.deepEqual(Object.fromEntries(["config.yaml", "metadata.json"].map((name) => [name, readFileSync(join(root, ".beads", name)).toString("base64")])), identityBefore);

  // A configured filter alone is not a reason to demand source reconfiguration.
  bd(root, "config", "set", "export.exclude_owners", "absent-owner@example.invalid");
  assert.deepEqual(completeBeadsExport(runner, root, "embedded unmatched filter"), exported);

  // Native created_by is the filter authority; do not assume actor or Git author.
  const sourceView = JSON.parse(bd(root, "--readonly", "show", ids[0], "--json", "--long", "--include-comments"))[0];
  assert.equal(typeof sourceView.created_by, "string");
  assert.ok(sourceView.created_by);
  bd(root, "config", "set", "export.exclude_owners", sourceView.created_by);
  const filterBefore = bd(root, "--readonly", "config", "get", "export.exclude_owners", "--json");
  const filteredIdentity = Object.fromEntries(["config.yaml", "metadata.json"].map((name) => [name, readFileSync(join(root, ".beads", name)).toString("base64")]));
  runner.reads = [];
  assert.throws(() => completeBeadsExport(runner, root, "embedded filtered fixture"), /does not exactly match the independent native issue inventory/);
  assert.deepEqual(runner.reads.map(({ args }) => args), [["--readonly", "export", "--all"], BEADS_INVENTORY]);
  assert.equal(bd(root, "--readonly", "config", "get", "export.exclude_owners", "--json"), filterBefore);
  assert.deepEqual(JSON.parse(bd(root, ...BEADS_INVENTORY)).map((row) => row.id).sort(), [...ids].sort());
  assert.deepEqual(Object.fromEntries(["config.yaml", "metadata.json"].map((name) => [name, readFileSync(join(root, ".beads", name)).toString("base64")])), filteredIdentity);
});

class DroppedBeadsExportRunner extends CandidateRunner {
  constructor() { super(); this.dropped = false; this.sawInventory = false; }
  run(commandName, args, options = {}) {
    const result = super.run(commandName, args, options);
    if (commandName === "bd" && JSON.stringify(args) === JSON.stringify(BEADS_INVENTORY)) this.sawInventory = true;
    if (commandName === "bd" && args[0] === "--readonly" && args[1] === "export" && args.includes("--all") && !this.dropped && result.status === 0) {
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

// PRIMECLAW-49 capture slice: public data only, never the reported private store.
function syntheticBeadsExport(rows, inventory) {
  const calls = [];
  return {
    calls,
    run(commandName, args) {
      calls.push({ commandName, args: [...args] });
      assert.equal(commandName, "bd");
      if (JSON.stringify(args) === JSON.stringify(["--readonly", "export", "--all"])) {
        return { status: 0, stdout: rows.map((row) => typeof row === "string" ? row : JSON.stringify(row)).join("\n") + "\n", stderr: "" };
      }
      assert.deepEqual(args, BEADS_INVENTORY);
      return { status: 0, stdout: JSON.stringify(inventory), stderr: "" };
    },
  };
}

test("typed Beads export preserves 33 issues and 19 native memories with strict issue inventory", () => {
  const issues = Array.from({ length: 33 }, (_, i) => ({ _type: "issue", id: `PUBLIC-${i + 1}`, title: `Public issue ${i + 1}`, status: "open" }));
  const memories = Array.from({ length: 19 }, (_, i) => ({ _type: "memory", key: ` public-memory-${i} λ `,
    value: i === 0 ? "" : `  ---\nstatus: not task metadata\n---\nPublic café 🐙 ${i}\n\ttrailing whitespace  \n` }));
  const rows = [...issues.slice(0, 10), ...memories, ...issues.slice(10)];
  // Native row bytes (including JSON whitespace) are evidence, not normalized text.
  const lines = rows.map((row) => `  ${JSON.stringify(row)}  `);
  const runner = syntheticBeadsExport(lines, issues);
  const exported = completeBeadsExport(runner, "/public-synthetic", "public mixed fixture");
  assert.equal(exported.length, 52);
  assert.deepEqual(exported.filter(({ kind }) => kind === "issue").map(({ row }) => row), issues);
  assert.deepEqual(exported.filter(({ kind }) => kind === "memory").map(({ row }) => row), memories);
  assert.deepEqual(exported.map(({ line }) => line), lines);
  assert.equal(runner.calls.length, 2, "helper performs only readonly export and independent inventory");
  const issueOnly = completeBeadsExport(syntheticBeadsExport(issues, issues), "/public-synthetic", "public issue-only fixture");
  assert.equal(issueOnly.length, 33);
  assert.ok(issueOnly.every(({ kind }) => kind === "issue"));
  const legacyIssues = issues.map(({ _type, ...row }) => row);
  const legacy = completeBeadsExport(syntheticBeadsExport(legacyIssues, legacyIssues), "/public-synthetic", "legacy issue-only fixture");
  assert.deepEqual(legacy.map(({ row }) => row), legacyIssues);
  assert.ok(legacy.every(({ kind }) => kind === "issue"));
});

test("typed Beads export refuses malformed records and genuine issue identity omissions", () => {
  const issue = { _type: "issue", id: "PUBLIC-1", title: "Public issue", status: "open" };
  const memory = { _type: "memory", key: "public", value: "not an issue" };
  for (const [name, rows, inventory, error] of [
    ["missing issue ID", [{ _type: "issue", title: "missing" }, memory], [issue], /no exact canonical task ID/],
    ["missing legacy issue ID", [{ title: "missing" }, memory], [issue], /no exact canonical task ID/],
    ["malformed issue ID", [{ ...issue, id: "bad id" }, memory], [issue], /no exact canonical task ID/],
    ["duplicate issue ID", [issue, memory, issue], [issue], /independent native issue inventory/],
    ["missing exported issue", [memory], [issue], /independent native issue inventory/],
    ["duplicate inventory ID", [issue, memory], [issue, issue], /independent native issue inventory/],
    ["missing inventory ID", [issue, memory], [{}], /no exact canonical task ID/],
    ["unknown type with valid issue ID", [{ ...issue, _type: "config" }], [issue], /unsupported.*type/],
    ["null type", [{ ...issue, _type: null }], [issue], /unsupported.*type/],
    ["memory missing value", [{ _type: "memory", key: "public" }], [], /malformed.*memory/],
    ["memory nonstring value", [{ ...memory, value: { nested: true } }], [], /malformed.*memory/],
    ["memory nonstring key", [{ ...memory, key: 7 }], [], /malformed.*memory/],
    ["memory empty key", [{ ...memory, key: "" }], [], /malformed.*memory/],
    ["memory with issue ID", [{ ...memory, id: issue.id }], [], /malformed.*memory/],
    ["nonobject", [null], [], /not a JSON object/],
  ]) {
    assert.throws(() => completeBeadsExport(syntheticBeadsExport(rows, inventory), "/public-synthetic", name), error, name);
  }
});

test("native Beads memory capture binds exact content and refuses confirmed import before destination writes", { timeout: 180_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "native-memory-capture");
  const key = "public-memory-λ";
  const value = "  ---\nstatus: not task metadata\n---\nPublic café 🐙\n\ttrailing spaces  \n";
  bd(fixture.root, "remember", value, "--key", key);
  bd(fixture.root, "remember", "Second public memory", "--key", "public-second-memory");
  const sourceBefore = command(fixture.root, "bd", ["--readonly", "export", "--all"]);
  const authorityBefore = sourceAuthorityFiles(fixture.root);
  const codeBefore = git(fixture.root, "rev-parse", "HEAD");
  class MemoryLineRunner extends AdmissionRunner {
    constructor() { super(); this.padMemoryLines = false; }
    run(commandName, args, options = {}) {
      const result = super.run(commandName, args, options);
      if (this.padMemoryLines && commandName === "bd" && args[0] === "--readonly" && args[1] === "export" && result.status === 0) {
        return { ...result, stdout: result.stdout.split("\n").map((line) => line && JSON.parse(line)._type === "memory" ? `  ${line}  ` : line).join("\n") };
      }
      return result;
    }
  }
  const runner = new MemoryLineRunner();
  const exported = completeBeadsExport(runner, fixture.root, "native memory fixture");
  const memories = exported.filter(({ kind }) => kind === "memory");
  assert.deepEqual(memories.map(({ row }) => row).sort((a, b) => a.key.localeCompare(b.key)), [
    { _type: "memory", key, value }, { _type: "memory", key: "public-second-memory", value: "Second public memory" },
  ].sort((a, b) => a.key.localeCompare(b.key)));
  for (const { row, line } of memories) assert.deepEqual(JSON.parse(line), row);
  const inspect = () => inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  const first = inspect();
  assert.equal(first.status, "ready", first.detail);
  assert.deepEqual(first.taskCounts, { open: 3, closed: 0, archived: 0, total: 3 });
  const issueReads = runner.reads.filter(({ args }) => ["show", "history", "provenance"].includes(args[1]));
  assert.ok(issueReads.length > 0);
  assert.ok(issueReads.every(({ args }) => Object.values(fixture.ids).includes(args[1] === "provenance" ? args[3] : args[2])),
    "native memory keys must never enter task show/history/events/provenance");
  assert.equal(inspect().sourceRevision, first.sourceRevision);
  runner.padMemoryLines = true;
  const rawLineChanged = inspect();
  assert.equal(rawLineChanged.status, "ready", rawLineChanged.detail);
  assert.notEqual(rawLineChanged.sourceDigest, first.sourceDigest, "original memory export line bytes remain snapshot digest evidence");
  runner.padMemoryLines = false;
  assert.equal(inspect().sourceRevision, first.sourceRevision);
  bd(fixture.root, "remember", value + "\n", "--key", key);
  const changed = inspect();
  assert.equal(changed.status, "ready", changed.detail);
  assert.notEqual(changed.sourceRevision, first.sourceRevision, "memory-only whitespace change changes exact revision");
  assert.notEqual(changed.sourceDigest, first.sourceDigest);
  assert.deepEqual(changed.taskCounts, first.taskCounts);
  bd(fixture.root, "remember", value, "--key", key);
  // Native writes may add history even after the exported value is restored.
  // Confirm the current exact capture, never assume the old history returns.
  const restored = inspect();
  assert.equal(restored.status, "ready", restored.detail);
  assert.equal(inspect().sourceRevision, restored.sourceRevision);
  runner.calls = [];
  let deletions = 0;
  const result = await migrateTaskProvider({ cwd: fixture.root, targetProvider: "backlog", runner,
    expectedSourceRevision: restored.sourceRevision, confirmedSwitch: true, actor: "public-memory-operator",
    semanticPlacement: "Preserve every source value without curation.", deleteSource() { deletions += 1; } });
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "memory-import-not-implemented");
  assert.match(result.detail, /native Beads memor.*Backlog document.*not implemented/i);
  assertNoAdmissionWrites(runner);
  assert.equal(runner.calls.some(({ commandName }) => commandName === "backlog"), false,
    "temporary slice refusal must precede even destination preparation/probes");
  assert.equal(deletions, 0);
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
  assert.equal(command(fixture.root, "bd", ["--readonly", "export", "--all"]), sourceBefore);
  assert.deepEqual(sourceAuthorityFiles(fixture.root), authorityBefore);
  assert.equal(git(fixture.root, "rev-parse", "HEAD"), codeBefore);
  assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
});

test("native Beads memory outputs preserve exact records and link one USER task", { timeout: 180_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "native-memory-outputs");
  const key = "  public λ key\n\tends  ";
  const value = "---\nid: not-metadata\n---\nPublic café 🐙\n```\n  leading / trailing  \n\tline\r\n";
  bd(fixture.root, "remember", "--key", key, "--", value);
  bd(fixture.root, "remember", "Second public value\n\x01\x1b", "--key", "public-second");
  const entries = completeBeadsExport(RUNNER, fixture.root, "native output fixture");
  const memories = entries.filter(({ kind }) => kind === "memory").map(({ row, line }) => ({ exportRow: row, exportLineBase64: Buffer.from(line).toString("base64") }));
  assert.equal(memories.length, 2);
  assert.deepEqual(memories.find(({ exportRow }) => exportRow.key === key).exportRow, { _type: "memory", key, value });
  assert.equal(memories.find(({ exportRow }) => exportRow.key === "public-second").exportRow.value, "Second public value\n\x01\x1b");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  const source = { projectRoot: fixture.root, sourceIdentity: { repositoryRoot: fixture.root, storeDir: join(fixture.root, ".beads") },
    revision: inspection.sourceRevision, digest: inspection.sourceDigest, memories };
  const sourceBefore = command(fixture.root, "bd", ["--readonly", "export", "--all"]);
  backlog(fixture.root, "init", "Memory destination", "--defaults", "--backlog-dir", ".backlog", "--config-location", "root", "--task-prefix", "MEM", "--integration-mode", "none");
  const configPath = join(fixture.root, "backlog.config.yml");
  writeFileSync(configPath, readFileSync(configPath, "utf8")
    .replace(/^statuses:.*$/m, 'statuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]')
    .replace(/^default_status:.*$/m, 'default_status: "In Design"')
    .replace(/^auto_commit:.*$/m, "auto_commit: false"));
  class OutputRunner extends CandidateRunner {
    constructor() { super(); this.calls = []; }
    run(commandName, args, options = {}) {
      this.calls.push({ commandName, args: [...args] });
      return super.run(commandName, args, options);
    }
  }
  const runner = new OutputRunner();
  const outputs = importBeadsMemoryDocuments(source, runner);
  assert.equal(outputs.documents.length, 2);
  assert.ok(outputs.index);
  assert.ok(outputs.userTask);
  assert.equal(new Set([...outputs.documents, outputs.index].map(({ docId }) => docId)).size, 3);
  const docs = readdirSync(join(fixture.root, ".backlog", "docs"));
  assert.equal(docs.length, 3);
  for (const [index, document] of outputs.documents.entries()) {
    assert.ok(document.path.startsWith(".backlog/docs/"));
    const plain = command(fixture.root, BACKLOG, ["doc", "view", document.docId, "--plain"]);
    assert.ok(plain.endsWith(`${document.body}\n`));
    const complete = plain.match(/## Complete native memory record \(lossless JSON\)\n\n```json\n([^\n]+)\n```/);
    assert.ok(complete);
    assert.deepEqual(JSON.parse(complete[1]), memories[index].exportRow, "complete original native row, including exact key/value, round-trips");
    const provenance = JSON.parse(plain.match(/Source provenance:\n\n```json\n([\s\S]*?)\n```/)[1]);
    assert.deepEqual(provenance, { sourceProvider: "beads", sourceProject: fixture.root, sourceStore: join(fixture.root, ".beads"), sourceRevision: source.revision, sourceDigest: source.digest });
    assert.match(plain, /# Imported Beads memory/);
    assert.match(plain, /## Original key/);
    assert.match(plain, /## Original value/);
  }
  const indexPlain = command(fixture.root, BACKLOG, ["doc", "view", outputs.index.docId, "--plain"]);
  const links = [...indexPlain.matchAll(/^- \[(doc-\d+)\]\(([^)]+)\)$/gm)];
  assert.equal(links.length, memories.length);
  for (const [, id, link] of links) {
    assert.ok(link.includes("%20"), "native filenames are URL-encoded");
    const path = join(fixture.root, ".backlog", "docs", decodeURIComponent(link));
    assert.ok(existsSync(path), "index link reaches the actual native document path");
    assert.match(readFileSync(path, "utf8"), new RegExp(`^id: ${id}$`, "m"));
  }
  const task = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", outputs.userTask.taskId)).task;
  assert.equal(task.status, "In Design");
  assert.match(task.title, /^USER:/);
  assert.match(task.description, /Integrate useful material properly into the project's documentation, or delete imported material/);
  assert.deepEqual(task.documentation, [outputs.index.path]);
  assert.deepEqual(task.assignees, []);
  assert.equal(readdirSync(join(fixture.root, ".backlog", "tasks")).length, 1);
  assert.equal(runner.calls.filter(({ args }) => args[0] === "task" && args[1] === "create").length, 1);
  assert.equal(runner.calls.filter(({ args }) => args[0] === "doc" && args[1] === "create").length, 3);
  assert.ok(runner.calls.filter(({ args }) => args[0] === "doc" && args[1] === "update").every(({ args }) => args[3].startsWith("--content=")));
  assert.equal(command(fixture.root, "bd", ["--readonly", "export", "--all"]), sourceBefore);
  verifyBacklogMemoryOutputs(outputs, fixture.root, runner);
  // No extra outputs or commands for the existing issue-only source case.
  runner.calls = [];
  assert.deepEqual(importBeadsMemoryDocuments({ ...source, memories: [] }, runner), { documents: [] });
  verifyBacklogMemoryOutputs({ documents: [] }, fixture.root, runner);
  assert.deepEqual(runner.calls, []);
  await t.test("native moves of a memory document or index refuse stale captured paths", () => {
    for (const document of [outputs.documents[0], outputs.index]) {
      backlog(fixture.root, "doc", "update", document.docId, "--path", "relocated", `--content=${document.body}`);
      try {
        assert.equal(existsSync(join(fixture.root, document.path)), false, "native move removes the captured link target");
        assert.ok(command(fixture.root, BACKLOG, ["doc", "view", document.docId, "--plain"]).endsWith(`${document.body}\n`),
          "native ID readback still succeeds with the unchanged body after the move");
        assert.ok(backlog(fixture.root, "doc", "view", outputs.index.docId, "--plain").includes(encodeURIComponent(outputs.documents[0].path.split("/").at(-1))),
          "index still links the original memory path");
        assert.deepEqual(JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", outputs.userTask.taskId)).task.documentation, [outputs.index.path],
          "USER task still references the original index path");
        assert.throws(() => verifyBacklogMemoryOutputs(outputs, fixture.root, runner), /native identity\/body mismatch/);
      } finally {
        backlog(fixture.root, "doc", "update", document.docId, "--path", "", `--content=${document.body}`);
      }
    }
    verifyBacklogMemoryOutputs(outputs, fixture.root, runner);
  });
  // Native content corruption is refused on re-read, not accepted via exit code.
  for (const document of [...outputs.documents, outputs.index]) {
    backlog(fixture.root, "doc", "update", document.docId, "--content=Changed public output");
    assert.throws(() => verifyBacklogMemoryOutputs(outputs, fixture.root, runner), /native identity\/body mismatch/);
    backlog(fixture.root, "doc", "update", document.docId, `--content=${document.body}`);
  }
  backlog(fixture.root, "task", "edit", outputs.userTask.taskId, "--status", "In Progress", "--plain");
  assert.throws(() => verifyBacklogMemoryOutputs(outputs, fixture.root, runner), /USER task.*content\/status\/index mismatch/);
  backlog(fixture.root, "task", "edit", outputs.userTask.taskId, "--status", "In Design", "--plain");
  backlog(fixture.root, "task", "edit", outputs.userTask.taskId, "--doc", "", "--plain");
  assert.throws(() => verifyBacklogMemoryOutputs(outputs, fixture.root, runner), /USER task.*content\/status\/index mismatch/);
  backlog(fixture.root, "task", "edit", outputs.userTask.taskId, "--doc", outputs.index.path, "--plain");
  verifyBacklogMemoryOutputs(outputs, fixture.root, runner);
  for (const document of [outputs.documents[0], outputs.index]) {
    const path = join(fixture.root, document.path);
    renameSync(path, `${path}.missing`);
    const missing = runner.run("backlog", ["doc", "view", document.docId, "--plain"], { cwd: fixture.root });
    assert.equal(missing.status, 0, "native missing document can exit successfully");
    assert.throws(() => verifyBacklogMemoryOutputs(outputs, fixture.root, runner), /native identity\/body mismatch/);
    renameSync(`${path}.missing`, path);
  }
  const taskPath = join(fixture.root, task.path);
  renameSync(taskPath, `${taskPath}.missing`);
  assert.throws(() => verifyBacklogMemoryOutputs(outputs, fixture.root, runner), /Backlog task|backlog task view/);
  renameSync(`${taskPath}.missing`, taskPath);
  verifyBacklogMemoryOutputs(outputs, fixture.root, runner);
  // NUL cannot enter bd argv. One public synthetic package proves the same
  // native Backlog writer preserves it without passing raw NUL in argv.
  const nulRow = { _type: "memory", key: "public\0key", value: "public\0value\n" };
  const nulSource = { ...source, revision: "public-synthetic-nul-revision", digest: "public-synthetic-nul-digest",
    memories: [{ exportRow: nulRow, exportLineBase64: Buffer.from(JSON.stringify(nulRow)).toString("base64") }] };
  runner.calls = [];
  const nulOutputs = importBeadsMemoryDocuments(nulSource, runner);
  const nulPlain = command(fixture.root, BACKLOG, ["doc", "view", nulOutputs.documents[0].docId, "--plain"]);
  assert.deepEqual(JSON.parse(nulPlain.match(/## Complete native memory record \(lossless JSON\)\n\n```json\n([^\n]+)\n```/)[1]), nulRow);
  assert.ok(runner.calls.every(({ args }) => args.every((arg) => !arg.includes("\0"))));
  assert.equal(runner.calls.filter(({ args }) => args[0] === "task" && args[1] === "create").length, 1);
  verifyBacklogMemoryOutputs(nulOutputs, fixture.root, runner);
});

// PRIMECLAW-44 Slice 1g: inspection coexistence is NOT populated import permission.
function admissionTree(path) {
  return Object.fromEntries(readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((item) => item.isDirectory()
      ? Object.entries(admissionTree(join(path, item.name))).map(([key, value]) => [`${item.name}/${key}`, value])
      : [[item.name, readFileSync(join(path, item.name)).toString("base64")]]));
}

function coexistenceDestination(fixture, store) {
  const rootConfig = store !== "backlog";
  backlog(fixture.root, "init", "Existing destination", "--defaults", "--backlog-dir", store,
    "--config-location", rootConfig ? "root" : "folder", "--task-prefix", "BASE", "--integration-mode", "none");
  const configPath = join(fixture.root, rootConfig ? "backlog.config.yml" : `${store}/config.yml`);
  writeFileSync(configPath, readFileSync(configPath, "utf8")
    .replace(/^statuses:.*$/m, 'statuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]')
    .replace(/^default_status:.*$/m, 'default_status: "In Design"')
    .replace(/^auto_commit:.*$/m, 'auto_commit: false')
    .replace(/^backlog_directory:/m, "backlogDirectory:"));
  const active = backlog(fixture.root, "task", "create", "Existing active", "--status", "In Progress",
    "--description", "existing description", "--plan", "existing plan", "--no-dod-defaults", "--plain").match(/BASE-\d+/)[0];
  const completed = backlog(fixture.root, "task", "create", "Existing completed", "--status", "Done",
    "--no-dod-defaults", "--plain").match(/BASE-\d+/)[0];
  backlog(fixture.root, "task", "complete", completed);
  const archived = backlog(fixture.root, "task", "create", "Existing archive", "--no-dod-defaults", "--plain").match(/BASE-\d+/)[0];
  backlog(fixture.root, "task", "archive", archived);
  const activePath = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", active)).task.path;
  writeFileSync(join(fixture.root, store, "archive", "tasks", `${active} - historical-prefix-probe.md`),
    readFileSync(join(fixture.root, activePath), "utf8") + "\nDistinct same-ID historical archive probe.\n");
  git(fixture.root, "add", "-A");
  git(fixture.root, "commit", "-qm", "seed existing Backlog alongside Beads");
  const first = git(fixture.root, "rev-parse", "HEAD");
  backlog(fixture.root, "task", "edit", active, "--append-notes", "preserved second native revision");
  git(fixture.root, "add", "-A");
  git(fixture.root, "commit", "-qm", "existing Backlog history");
  git(fixture.root, "push", "-q");
  return { store, configPath, active, completed, archived, activePath, first };
}

class AdmissionRunner extends AsIsBeadsRunner {
  constructor() { super(); this.calls = []; }
  run(commandName, args, options = {}) {
    this.calls.push({ commandName, args: [...args], cwd: options.cwd });
    return super.run(commandName, args, options);
  }
}

function assertNoAdmissionWrites(runner) {
  assert.equal(runner.calls.some(({ commandName, args }) => commandName === "backlog"
    && args.some((arg) => ["create", "edit", "complete", "archive", "init"].includes(arg))), false);
  assert.equal(runner.calls.some(({ commandName, args }) => commandName === "git"
    && args.some((arg) => ["add", "commit", "push", "clone", "checkout", "init"].includes(arg))), false);
  assert.deepEqual(runner.sourcePublicationCommands, []);
}

test("migration admission rejects reverse direction before any command or project lookup", async () => {
  const runner = { run() { assert.fail("unsupported direction must not run commands"); } };
  const inspection = inspectTaskProviderMigration({ cwd: "/definitely/missing", targetProvider: "beads", runner });
  const confirmation = await migrateTaskProvider({ cwd: "/definitely/missing", targetProvider: "beads", runner,
    expectedSourceRevision: "not-a-revision", confirmedSwitch: true, actor: "operator", semanticPlacement: "Keep every field" });
  for (const result of [inspection, confirmation]) {
    assert.equal(result.status, "blocked");
    assert.equal(result.code, "unsupported-direction");
    assert.match(result.detail, /only Beads-to-Backlog/);
  }
});

for (const store of ["backlog", ".backlog", "planning/task store"]) {
  test(`migration admission inspects Beads alongside preserved ${store} and refuses mismatched confirmation`, { timeout: 180_000 }, async (t) => {
    const fixture = embeddedBeadsSource(t, `admission-${store.replaceAll("/", "-")}`);
    const runner = new AdmissionRunner();
    const original = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
    assert.equal(original.status, "ready", original.detail);
    const destination = coexistenceDestination(fixture, store);
    const before = admissionTree(join(fixture.root, store));
    const config = readFileSync(destination.configPath, "utf8");
    const source = sourceAuthorityFiles(fixture.root);
    const catalog = bd(fixture.root, "--readonly", "statuses", "--json");
    const views = [destination.active, destination.completed].map((id) => backlog(fixture.root, "task", "view", "--json", "--", id));
    const head = git(fixture.root, "rev-parse", "HEAD"), index = git(fixture.root, "ls-files", "--stage");
    const privateExcludes = readFileSync(join(fixture.root, ".git", "info", "exclude"), "utf8");
    const publishedRefs = git(fixture.root, "ls-remote", "--refs", fixture.remote);
    const history = git(fixture.root, "log", "--follow", "--format=%H", "--", destination.activePath);
    assert.ok(history.includes(destination.first));
    assert.equal(detectTaskProvider(fixture.root, RUNNER).code, "dual-providers");
    assert.throws(() => checkBeadsCapabilities(fixture.root, RUNNER), /status mapping is incomplete/,
      "retiring-source admission must not relax ordinary active Beads capability checks");
    runner.calls = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
      assert.equal(inspection.status, "ready", inspection.detail);
      assert.equal(inspection.sourceProvider, "beads");
      assert.equal(inspection.targetProvider, "backlog");
      assert.equal(inspection.sourceRevision, original.sourceRevision);
      assert.equal(inspection.sourceDigest, original.sourceDigest);
      assert.deepEqual(inspection.taskCounts, original.taskCounts);
    }
    let deletions = 0;
    const options = { cwd: fixture.root, targetProvider: "backlog", runner, confirmedSwitch: true,
      actor: "admission-operator", semanticPlacement: "Preserve every raw source value", deleteSource() { deletions++; } };
    const wrong = await migrateTaskProvider({ ...options, expectedSourceRevision: "capture-sha256:" + "0".repeat(64) });
    assert.equal(wrong.status, "blocked");
    assert.match(wrong.detail, /source revision.*does not equal confirmed/);
    assert.equal(deletions, 0);
    const finalCapture = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
    assert.equal(finalCapture.status, "ready", finalCapture.detail);
    assert.equal(finalCapture.sourceRevision, original.sourceRevision);
    assert.equal(finalCapture.sourceDigest, original.sourceDigest);
    assert.deepEqual(finalCapture.taskCounts, original.taskCounts);
    assertNoAdmissionWrites(runner);
    assert.deepEqual(admissionTree(join(fixture.root, store)), before);
    assert.equal(readFileSync(destination.configPath, "utf8"), config);
    assert.deepEqual(sourceAuthorityFiles(fixture.root), source);
    assert.equal(bd(fixture.root, "--readonly", "statuses", "--json"), catalog);
    assert.deepEqual([destination.active, destination.completed].map((id) => backlog(fixture.root, "task", "view", "--json", "--", id)), views);
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), head);
    assert.equal(git(fixture.root, "ls-files", "--stage"), index);
    assert.equal(readFileSync(join(fixture.root, ".git", "info", "exclude"), "utf8"), privateExcludes);
    assert.equal(git(fixture.root, "ls-remote", "--refs", fixture.remote), publishedRefs);
    assert.equal(git(fixture.root, "log", "--follow", "--format=%H", "--", destination.activePath), history);
    assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
    assert.equal(detectTaskProvider(fixture.root, RUNNER).code, "dual-providers");
    if (store !== ".backlog") assert.equal(existsSync(join(fixture.root, ".backlog")), false);
    assert.equal(existsSync(join(fixture.root, ".beads")), true);
  });
}

test("migration admission keeps malformed coexistence and unreadable source refusals before writes", { timeout: 180_000 }, (t) => {
  const fixture = embeddedBeadsSource(t, "admission-invalid");
  const destination = coexistenceDestination(fixture, "backlog");
  class UnreadableHistory extends AdmissionRunner {
    run(name, args, options) {
      const result = super.run(name, args, options);
      return name === "bd" && args[0] === "--readonly" && args[1] === "history"
        ? { status: 1, stdout: "", stderr: "fixture cannot read required native history" } : result;
    }
  }
  const runner = new UnreadableHistory();
  const before = admissionTree(join(fixture.root, destination.store));
  const source = sourceAuthorityFiles(fixture.root);
  const unreadable = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(unreadable.status, "blocked");
  assert.match(unreadable.detail, /cannot read required native history/);
  assertNoAdmissionWrites(runner);
  assert.deepEqual(admissionTree(join(fixture.root, destination.store)), before);
  assert.deepEqual(sourceAuthorityFiles(fixture.root), source);
  for (const [path, bytes] of [[destination.configPath, "malformed Backlog config\n"],
      [join(fixture.root, ".beads", "metadata.json"), "malformed Beads metadata\n"]]) {
    const original = readFileSync(path);
    writeFileSync(path, bytes);
    git(fixture.root, "add", "-A");
    if (git(fixture.root, "status", "--porcelain=v1")) git(fixture.root, "commit", "-qm", "invalid fixture evidence");
    git(fixture.root, "push", "-q");
    const probe = new AdmissionRunner();
    const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: probe });
    assert.equal(inspection.status, "blocked");
    assert.match(inspection.detail, /provider authority blocked/);
    assertNoAdmissionWrites(probe);
    assert.equal(readFileSync(path, "utf8"), bytes);
    assert.equal(existsSync(join(fixture.root, ".backlog")), false);
    writeFileSync(path, original);
    git(fixture.root, "add", "-A");
    if (git(fixture.root, "status", "--porcelain=v1")) git(fixture.root, "commit", "-qm", "restore fixture evidence");
    git(fixture.root, "push", "-q");
  }
});


test("migration admission refuses absent Beads even when Backlog is selected", { timeout: 90_000 }, async (t) => {
  for (const kind of ["none", "backlog"]) {
    await t.test(kind, (t) => {
      const fixture = kind === "backlog" ? backlogSource(t, "admission-no-beads") : repository(t, "admission-no-provider");
      const runner = new AdmissionRunner();
      const head = git(fixture.root, "rev-parse", "HEAD"), index = git(fixture.root, "ls-files", "--stage");
      const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
      assert.equal(inspection.status, "blocked");
      assert.match(inspection.detail, /requires a readable Beads source store/);
      assertNoAdmissionWrites(runner);
      assert.equal(git(fixture.root, "rev-parse", "HEAD"), head);
      assert.equal(git(fixture.root, "ls-files", "--stage"), index);
      assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
      assert.equal(existsSync(join(fixture.root, ".beads")), false);
      assert.equal(existsSync(join(fixture.root, ".backlog")), false);
    });
  }
});


// Independent native destination published before any migration attempt. Keep
// its archived highest ID: native allocation intentionally considers only the
// active/completed corpus and can reuse that ID.
function publishedPopulatedBacklogDestination(fixture) {
  const seed = join(fixture.outer, "native-allocation-seed");
  mkdirSync(seed);
  command(seed, "git", ["init", "-q", "-b", "main"]);
  git(seed, "config", "user.name", "Existing Task Author");
  git(seed, "config", "user.email", "existing@example.invalid");
  writeFileSync(join(seed, "README.md"), "Disposable native destination authoring.\n");
  git(seed, "add", "README.md");
  git(seed, "commit", "-qm", "destination authoring setup");
  backlog(seed, "init", "Preserved destination", "--defaults", "--backlog-dir", "backlog",
    "--config-location", "folder", "--task-prefix", "BASE", "--integration-mode", "none");
  canonicalBacklogConfig(seed);
  const configPath = join(seed, "backlog", "config.yml");
  writeFileSync(configPath, readFileSync(configPath, "utf8")
    .replace(/^default_port:.*$/m, "default_port: 6459") + "\n# Preserve the complete operator configuration.\n");
  const active = backlog(seed, "task", "create", "Existing active", "--status", "In Progress",
    "--description", "existing description", "--notes", "original notes", "--no-dod-defaults", "--plain").match(/BASE-\d+/)[0];
  backlog(seed, "task", "edit", active, "--comment", "existing native comment", "--comment-author", "baseline-author", "--plain");
  const completed = backlog(seed, "task", "create", "Existing completed", "--status", "Done",
    "--no-dod-defaults", "--plain").match(/BASE-\d+/)[0];
  backlog(seed, "task", "complete", completed);
  const archived = backlog(seed, "task", "create", "Existing archived", "--description", "original archive content",
    "--no-dod-defaults", "--plain").match(/BASE-\d+/)[0];
  backlog(seed, "task", "archive", archived);
  const activePath = JSON.parse(backlog(seed, "task", "view", "--json", "--", active)).task.path;
  writeFileSync(join(seed, "backlog", "archive", "tasks", `${active} - historical-prefix-probe.md`),
    readFileSync(join(seed, activePath), "utf8") + "\nDistinct same-ID historical archive probe.\n");
  const history = join(seed, "backlog");
  command(history, "git", ["init", "-q", "-b", "prime-claw/tasks"]);
  git(history, "config", "user.name", "Existing Task Author");
  git(history, "config", "user.email", "existing@example.invalid");
  git(history, "add", "-A");
  git(history, "commit", "-qm", "original native corpus with archive records");
  backlog(seed, "task", "edit", active, "--append-notes", "preserved second native revision", "--plain");
  git(history, "add", "-A");
  git(history, "commit", "-qm", "existing native task history");
  git(history, "remote", "add", "origin", fixture.remote);
  git(history, "push", "-qu", "origin", TASK_HISTORY_REF);
  const store = join(fixture.root, ".backlog");
  command(fixture.root, "git", ["clone", "-q", "--branch", "prime-claw/tasks", "--single-branch", fixture.remote, store]);
  const exclude = join(fixture.root, ".git", "info", "exclude");
  writeFileSync(exclude, readFileSync(exclude, "utf8") + "\n.backlog/\n");
  const baseline = Object.fromEntries(git(store, "ls-files").split(/\r?\n/).map((path) => [path, {
    bytes: readFileSync(join(store, path)).toString("base64"),
    history: git(store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", path),
  }]));
  return { store, active, completed, archived, baseline };
}

test("native populated Backlog allocation reuses an archived ID; eligible live dependency succeeds and archive-only refuses", { timeout: 180_000 }, (t) => {
  const fixture = embeddedBeadsSource(t, "native-populated-allocation-blocker");
  const destination = publishedPopulatedBacklogDestination(fixture);
  const { store } = destination;
  console.info(`native Backlog version: ${backlog(fixture.root, "--version")}`);
  assert.deepEqual([destination.active, destination.completed, destination.archived], ["BASE-1", "BASE-2", "BASE-3"]);
  const source = () => ({ authority: sourceAuthorityFiles(fixture.root),
    inventory: bd(fixture.root, ...BEADS_INVENTORY),
    exported: bd(fixture.root, "--readonly", "export", "--all"),
    history: bd(fixture.root, "--readonly", "history", fixture.ids.parent, "--json", "--limit", "0"),
  });
  const sourceBefore = source();
  const rootHead = git(fixture.root, "rev-parse", "HEAD"), rootIndex = git(fixture.root, "ls-files", "--stage");
  const storeHead = git(store, "rev-parse", "HEAD"), storeIndex = git(store, "ls-files", "--stage");
  const identity = { gitDir: realpathSync(join(store, ".git")), config: readFileSync(join(store, ".git", "config"), "utf8"),
    branch: git(store, "symbolic-ref", "HEAD") };
  const refs = git(fixture.root, "ls-remote", "--refs", fixture.remote);
  const exclude = readFileSync(join(fixture.root, ".git", "info", "exclude"), "utf8");
  const beforeOverride = admissionTree(store);
  const override = RUNNER.run("backlog", ["task", "create", "Unsupported literal ID", "--id", "BASE-99", "--plain"],
    { cwd: fixture.root, allowFailure: true });
  assert.notEqual(override.status, 0);
  assert.match(`${override.stdout}\n${override.stderr}`, /unknown option.*--id/i);
  assert.deepEqual(admissionTree(store), beforeOverride, "unsupported --id must refuse before destination writes");

  // These are the existing importer's native allocation/relationship operations,
  // not a canonical migration or an alternative ID-allocation policy.
  const parent = backlog(fixture.root, "task", "create", "Prospective imported parent", "--status", "In Progress",
    "--no-dod-defaults", "--plain").match(/BASE-\d+/)[0];
  assert.equal(parent, destination.archived, "native allocator intentionally reuses the archived highest ID");
  const child = backlog(fixture.root, "task", "create", "Prospective imported child", "--status", "In Progress",
    "--parent", parent, "--no-dod-defaults", "--plain").match(/BASE-\d+(?:\.\d+)*/)[0];
  const childBefore = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", child)).task;
  assert.equal(childBefore.parentTaskId, parent);
  const beforeDependency = admissionTree(store);
  const dependency = RUNNER.run("backlog", ["task", "edit", child, "--depends-on", parent, "--plain"],
    { cwd: fixture.root, allowFailure: true });
  console.info("native populated Backlog allocation evidence:", JSON.stringify({
    originalOccupiedIds: [destination.active, destination.completed],
    originalArchivedIds: [destination.archived, destination.active],
    allocatedParent: parent, allocatedChild: child,
    dependencyWriteStatus: dependency.status,
    dependencyWriteDiagnostic: `${dependency.stdout}\n${dependency.stderr}`.trim(),
  }));
  assert.equal(dependency.status, 0, "archive history never makes an eligible reused live target ambiguous");
  assert.deepEqual(JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", child)).task.dependencies, [parent]);
  // Remove only the disposable newly-created live parent to expose archive-only history.
  const liveParent = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", parent)).task.path;
  const parentBytes = readFileSync(join(fixture.root, liveParent));
  rmSync(join(fixture.root, liveParent));
  const archiveOnlyBefore = admissionTree(store);
  const archiveOnly = RUNNER.run("backlog", ["task", "edit", child, "--depends-on", parent, "--plain"], { cwd: fixture.root, allowFailure: true });
  assert.notEqual(archiveOnly.status, 0);
  assert.match(`${archiveOnly.stdout}\n${archiveOnly.stderr}`, /missing|not found|do(?:es)? not exist|deleted/i);
  assert.deepEqual(admissionTree(store), archiveOnlyBefore);
  writeFileSync(join(fixture.root, liveParent), parentBytes);
  for (const [path, expected] of Object.entries(destination.baseline)) {
    assert.equal(readFileSync(join(store, path)).toString("base64"), expected.bytes, `original bytes and placement: ${path}`);
    assert.equal(git(store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", path), expected.history, `original history: ${path}`);
  }
  assert.equal(git(store, "rev-parse", "HEAD"), storeHead);
  assert.equal(git(store, "ls-files", "--stage"), storeIndex);
  assert.equal(realpathSync(join(store, ".git")), identity.gitDir);
  assert.equal(readFileSync(join(store, ".git", "config"), "utf8"), identity.config);
  assert.equal(git(store, "symbolic-ref", "HEAD"), identity.branch);
  assert.equal(git(fixture.root, "rev-parse", "HEAD"), rootHead);
  assert.equal(git(fixture.root, "ls-files", "--stage"), rootIndex);
  assert.equal(git(fixture.root, "ls-remote", "--refs", fixture.remote), refs);
  assert.equal(readFileSync(join(fixture.root, ".git", "info", "exclude"), "utf8"), exclude);
  assert.deepEqual(source(), sourceBefore, "retiring source was neither configured, changed, published nor deleted");
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
  assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
});


function physicalDestinationRecords(store) {
  const records = {};
  for (const folder of ["tasks", "completed", "archive/tasks", "drafts", "archive/drafts"]) {
    const path = join(store, folder);
    if (!existsSync(path)) continue;
    for (const name of readdirSync(path)) if (name.endsWith(".md")) records[`${folder}/${name}`] = readFileSync(join(path, name)).toString("base64");
  }
  return records;
}

for (const kind of ["independent-hidden", "independent-default", "independent-custom", "independent-custom-root-override", "code-default", "code-hidden", "code-custom"]) {
  test(`confirmed populated Backlog migration preserves baseline/imports/receipt for ${kind}`, { timeout: 300_000 }, async (t) => {
    const fixture = embeddedBeadsSource(t, `populated-${kind}`);
    const selected = kind.includes("custom") ? "planning/task store" : kind.endsWith("default") ? "backlog" : ".backlog";
    let destination;
    if (kind.startsWith("independent")) {
      destination = publishedPopulatedBacklogDestination(fixture);
      if (selected !== ".backlog") {
        mkdirSync(join(fixture.root, selected, ".."), { recursive: true });
        renameSync(destination.store, join(fixture.root, selected));
        destination.store = join(fixture.root, selected);
        const exclude = join(fixture.root, ".git", "info", "exclude");
        writeFileSync(exclude, readFileSync(exclude, "utf8") + `\n/${selected}/\n`);
      }
      if (selected.includes("/")) {
        const fullConfig = readFileSync(join(destination.store, "config.yml"), "utf8") + `\nbacklogDirectory: "${selected}"\n`;
        if (!kind.endsWith("root-override")) {
          writeFileSync(join(destination.store, "config.yml"), fullConfig);
          git(destination.store, "add", "config.yml");
          command(destination.store, "git", ["-c", "user.name=Existing Task Author", "-c", "user.email=existing@example.invalid", "commit", "-qm", "select custom native location"]);
          git(destination.store, "push", "-q");
        }
        writeFileSync(join(fixture.root, "backlog.config.yml"), fullConfig);
        git(fixture.root, "add", "backlog.config.yml");
        git(fixture.root, "commit", "-qm", "select existing custom destination");
        git(fixture.root, "push", "-q");
      }
    } else {
      destination = coexistenceDestination(fixture, selected);
      destination.store = join(fixture.root, selected);
    }
    const owner = kind === "code-default" ? addActiveBeadsOwner(fixture) : null;
    const originalEpisodeHead = owner ? git(owner.episode, "rev-parse", "HEAD") : null;
    const originalReadmeIndex = owner ? git(owner.episode, "ls-files", "--stage", "--", "README.md") : null;
    const records = physicalDestinationRecords(destination.store);
    const originalHead = git(destination.store, "rev-parse", "HEAD");
    const nativeDestination = detectExplicitTaskProvider(fixture.root, "backlog", RUNNER);
    assert.equal(nativeDestination.kind, "selected");
    assert.equal(nativeDestination.evidence.storeDir, destination.store);
    const configPath = nativeDestination.evidence.configPath;
    const config = readFileSync(configPath, "utf8");
    const originalFolderConfig = existsSync(join(destination.store, "config.yml"))
      ? readFileSync(join(destination.store, "config.yml"), "utf8") : null;
    const before = sourceAuthorityFiles(fixture.root);
    class PublicationBeforeRetirement extends AsIsBeadsRunner {
      run(name, args, options = {}) {
        if (name === "backlog" && args[0] === "task" && args[1] === "view" && existsSync(join(fixture.root, ".beads"))) {
          assert.deepEqual(sourceAuthorityFiles(fixture.root), before);
        }
        const result = super.run(name, args, options);
        if (name === "backlog" && args[0] === "task" && args[1] === "view" && result.status === 0) {
          const task = JSON.parse(result.stdout).task;
          if (task.title === "Prime Claw task-provider migration receipt" && task.status === "Done") {
            const store = join(fixture.root, selected === "backlog" ? ".backlog" : selected);
            assert.equal(git(store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], git(store, "rev-parse", "HEAD"));
            if (existsSync(join(fixture.root, ".beads"))) this.publishedBeforeRetirement = true;
          }
        }
        return result;
      }
    }
    const runner = new PublicationBeforeRetirement();
    const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
    assert.equal(inspection.status, "ready", inspection.detail);
    const result = await migrateTaskProvider({ cwd: fixture.root, targetProvider: "backlog", runner,
      expectedSourceRevision: inspection.sourceRevision, confirmedSwitch: true, actor: "populated-native-operator",
      semanticPlacement: "Retain complete native source packages, history and relationships in existing Backlog.",
      ...(owner ? { verifyActiveRuntime: proveFixtureRuntime } : {}) });
    assert.equal(result.status, "completed", result.detail);
    assert.equal(runner.publishedBeforeRetirement, true, "verified receipt publication must precede source deletion");
    const store = join(fixture.root, selected === "backlog" ? ".backlog" : selected);
    for (const [path, bytes] of Object.entries(records)) assert.equal(readFileSync(join(store, path)).toString("base64"), bytes, path);
    assert.equal(Object.keys(physicalDestinationRecords(store)).length, Object.keys(records).length + inspection.taskCounts.total + 1);
    assert.equal(git(store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], result.receipt.destinationReceiptRevision);
    if (kind.startsWith("independent")) git(store, "merge-base", "--is-ancestor", originalHead, "HEAD");
    const finalConfig = readFileSync(join(fixture.root, "backlog.config.yml"), "utf8");
    if (kind.endsWith("root-override")) {
      assert.equal(readFileSync(join(store, "config.yml"), "utf8"), originalFolderConfig, "inactive folder config is not overwritten");
      assert.equal(readFileSync(join(store, "backlog.config.yml"), "utf8"), config, "whole authoritative root config retained");
      assert.equal(readlinkSync(join(fixture.root, "backlog.config.yml")), `${selected}/backlog.config.yml`);
    }
    // Only the selected default directory spelling may change with normalization.
    assert.equal(finalConfig.replace(/^backlog(?:Directory|_directory):.*\n?/gm, ""), config.replace(/^backlog(?:Directory|_directory):.*\n?/gm, ""));
    const mappings = Object.fromEntries(result.receipt.mappings.map((row) => [row.sourceTaskId, row.destinationTaskId]));
    const imported = Object.fromEntries(result.receipt.mappings.map((row) => [row.sourceTaskId,
      JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", row.destinationTaskId)).task]));
    for (const [sourceId, task] of Object.entries(imported)) assert.equal(sourcePackageFromBacklogComments(task).sourceTaskId, sourceId);
    assert.equal(imported[fixture.ids.child].parentTaskId, mappings[fixture.ids.parent]);
    assert.deepEqual(imported[fixture.ids.blocked].dependencies, [mappings[fixture.ids.child]]);
    assert.equal(existsSync(join(fixture.root, ".beads")), false);
    if (selected === "backlog") assert.equal(existsSync(join(fixture.root, "backlog")), false);
    assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
    assert.equal(detectTaskProvider(fixture.root, RUNNER).evidence.provider, "backlog");
    if (owner) {
      const head = git(owner.episode, "rev-parse", "HEAD");
      git(owner.episode, "merge-base", "--is-ancestor", originalEpisodeHead, head);
      assert.equal(git(owner.episode, "ls-remote", "--refs", "origin", "refs/heads/episode-beads-owner").split(/\s+/)[0], head);
      assert.equal(git(owner.episode, "status", "--porcelain=v1"), "");
      assert.equal(git(owner.episode, "ls-files", "--stage", "--", "README.md"), originalReadmeIndex);
      const paths = git(owner.episode, "diff", "--name-only", `${originalEpisodeHead}..${head}`).split(/\r?\n/);
      assert.ok(paths.every((path) => path === "backlog.config.yml" || path.startsWith("backlog/")), paths.join(", "));
      assert.equal(git(owner.episode, "ls-files", "--stage").includes("160000"), false);
      assert.equal(git(owner.episode, "ls-files", "--", "backlog", ".backlog"), "");
      const current = JSON.parse(readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8")).owners[owner.ownerSessionId];
      for (const field of ["head", "branch", "worktree", "episodeId", "episodeSessionFile", "episodeActiveSessionId", "operationId", "baseRef"]) assert.deepEqual(current[field], owner.record[field], field);
      const episodeStore = join(owner.episode, ".backlog");
      assert.equal(git(episodeStore, "rev-parse", "HEAD"), result.receipt.destinationReceiptRevision);
    }
  });
}

test("invalid deleted-target source graph refuses exact evidence before any destination mutation", { timeout: 180_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "deleted-target-preflight");
  const destination = publishedPopulatedBacklogDestination(fixture);
  bd(fixture.root, "close", fixture.ids.child, "--reason",
    `Prime Claw abandonment: task ${fixture.ids.child}; pushed Episode head ${git(fixture.root, "rev-parse", "HEAD")}; code was not merged.`, "--force", "--json");
  const before = admissionTree(destination.store), source = sourceAuthorityFiles(fixture.root);
  const refs = git(fixture.root, "ls-remote", "--refs", fixture.remote);
  const runner = new AdmissionRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "blocked");
  assert.match(inspection.detail, /source relationship preflight/);
  assert.ok(inspection.detail.includes(fixture.ids.blocked));
  assert.ok(inspection.detail.includes(fixture.ids.child));
  assert.match(inspection.detail, /deleted\/archive-only target.*closed.*archived/);
  const confirmation = await migrateTaskProvider({ cwd: fixture.root, targetProvider: "backlog", runner,
    expectedSourceRevision: "capture-sha256:" + "0".repeat(64), confirmedSwitch: true, actor: "operator", semanticPlacement: "No repair" });
  assert.equal(confirmation.status, "blocked");
  assert.match(confirmation.detail, /source relationship preflight/);
  assertNoAdmissionWrites(runner);
  assert.deepEqual(admissionTree(destination.store), before);
  assert.deepEqual(sourceAuthorityFiles(fixture.root), source);
  assert.equal(git(fixture.root, "ls-remote", "--refs", fixture.remote), refs);
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
});
