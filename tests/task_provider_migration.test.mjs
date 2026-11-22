import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import http from "node:http";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { completeBeadsExport, importBeadsMemoryDocuments, verifyBacklogMemoryOutputs, inspectTaskProviderMigration, migrateTaskProvider } from "../src/prime-agent-plugin/extension-support/task-provider-migration.ts";
import { ProcessCommandRunner } from "../src/prime-agent-plugin/extension-support/project-initialization.ts";
import { checkBeadsCapabilities, detectExplicitTaskProvider, detectTaskProvider } from "../src/prime-agent-plugin/extension-support/task-providers.ts";
import { initialTaskStoreConfig, prepareTaskHistoryWorkspace, TASK_HISTORY_REF } from "../src/prime-agent-plugin/extension-support/task-history-workspace.ts";
import { projectBeadsCurrentTask, assertBeadsCurrentTask } from "../src/prime-agent-plugin/extension-support/beads-backlog-current.ts";

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
    return super.runFileBacked(commandName === "backlog" ? BACKLOG : commandName, args, options);
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
function backlog(cwd, ...args) {
  return RUNNER.run("backlog", args, { cwd }).stdout.trim();
}

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
    "--design", "living source plan", "--notes", "original notes", "--acceptance", "Current acceptance Ω\nSecond source check",
    "--assignee", "@source-owner", "--labels", "current-label,unicode-Ω", "--type", "bug", "--priority", "1",
    "--metadata", '{"opaque":{"shape":[1,null,false]}}', "--json")).id;
  bd(fixture.root, "update", parent, "--title", "Embedded revised", "--status", "in_progress", "--notes", "final source notes", "--json");
  const child = JSON.parse(bd(fixture.root, "create", "Embedded open child", "--parent", parent, "--json")).id;
  const blocked = JSON.parse(bd(fixture.root, "create", "Embedded blocked", "--status", "blocked", "--json")).id;
  bd(fixture.root, "dep", "add", blocked, child);
  bd(fixture.root, "comments", "add", parent, "embedded native comment Ω\n\n## Final Summary\n\nAn ordinary source comment, not task closure.", "--author", "source-author");
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
      const verb = args[0] === "--readonly" ? args[1] : args[0];
      assert.ok(!["history", "provenance"].includes(verb), `current-state capture must not read bd ${verb}`);
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


// Meaningful current metadata must cross capture and native authoring without
// argv chunks, raw source envelopes, or repeated export/native copies.
function syntheticCurrentViewFile(fixture, view, byteLength = 2_610_950) {
  const current = structuredClone(view);
  const line = "Current rollout decision: preserve Ω and 日本語, owner-approved detail.\n";
  const tail = "\nPRIVATE-CURRENT-TAIL-界🙂";
  const count = Math.floor((byteLength - Buffer.byteLength(tail)) / Buffer.byteLength(line));
  const body = line.repeat(count);
  const metadataText = body + "x".repeat(byteLength - Buffer.byteLength(body) - Buffer.byteLength(tail)) + tail;
  assert.equal(Buffer.byteLength(metadataText), byteLength);
  current.metadata = { ...current.metadata, current_capture: { text: metadataText } };
  const text = JSON.stringify([current]);
  const path = join(fixture.outer, "synthetic-current-view.json");
  writeFileSync(path, text);
  return { view: current, text, path, metadataText };
}

function readSyntheticOutput(runner, file, options) {
  return runner.runFileBacked(process.execPath,
    ["-e", "process.stdout.write(require('node:fs').readFileSync(process.argv[1]))", file], options);
}

function captureBeadsCurrentTasks(root, ids) {
  const exported = completeBeadsExport(RUNNER, root, "fixture current source capture");
  return Object.fromEntries(ids.map((id) => {
    const entry = exported.find(({ kind, row }) => kind === "issue" && row.id === id);
    assert.ok(entry, "fixture source must be present in the independent native export");
    const nativeView = JSON.parse(RUNNER.run("bd", ["--readonly", "show", id, "--json", "--long", "--include-comments"], { cwd: root }).stdout)[0];
    return [id, { sourceTaskId: id, exportRow: entry.row, nativeView }];
  }));
}

function assertCurrentBacklogTask(view, pkg, inspection, mapping, configuration = {}) {
  const parent = pkg.nativeView.parent ?? pkg.exportRow.parent;
  const dependencies = pkg.nativeView.dependencies ?? pkg.exportRow.dependencies ?? [];
  const context = {
    sourceRevision: inspection.sourceRevision, sourceDigest: inspection.sourceDigest,
    status: ({ open: "In Design", deferred: "In Design", in_design: "In Design", in_planning: "In Planning",
      in_progress: "In Progress", blocked: "Blocked", ready_for_merge: "Ready for Merge", done: "Done", closed: "Done" })[pkg.nativeView.status],
    ...(parent ? { parentTaskId: mapping[parent] ?? parent } : {}),
    dependencies: dependencies.map((value) => typeof value === "string" ? value : value.depends_on_id ?? value.id ?? value.issue_id)
      .filter(Boolean).map((id) => mapping[id] ?? id),
    priorities: ["high", "medium", "low"], types: ["bug", "feature", "enhancement", "task", "chore", "docs", "spike"],
    ...configuration,
  };
  const projection = projectBeadsCurrentTask(pkg, context);
  const id = mapping[pkg.sourceTaskId];
  assertBeadsCurrentTask(view, projection, id);
  assert.deepEqual(view.task.references, [
    `prime-claw-beads-source:${pkg.sourceTaskId}`,
    `prime-claw-beads-current:${JSON.stringify({ sourceTaskId: pkg.sourceTaskId,
      sourceRevision: inspection.sourceRevision, sourceDigest: inspection.sourceDigest }, null, 2)}`,
  ], "initial native references bind current source identity without a comment package");
  assert.equal(view.task.comments.length, projection.comments.length, "only actual authored source comments are imported");
  const readable = [view.task.description, view.task.implementationPlan, view.task.implementationNotes,
    view.task.finalSummary, ...view.task.comments.map((comment) => comment.body)].join("\n");
  for (const forbidden of ["prime-claw-task-provider-migration-source-v1 part=", "prime-claw-task-provider-migration-source-v1 mapping ",
    '"exportLineBase64":', '"exportRow":', '"statusCatalog":', '"sourceVersion":']) {
    assert.equal(readable.includes(forbidden), false, "new Beads imports contain no encoded package, raw envelope, or repeated catalog");
  }
  return projection;
}

function assertMeaningfulMetadataOnce(task, value) {
  assert.equal(Buffer.byteLength(value), 2_610_950);
  const readable = [task.description, task.implementationPlan, task.implementationNotes, task.finalSummary ?? ""].join("\n");
  const exact = readable.includes(value) ? value : JSON.stringify(value);
  assert.equal(readable.includes(exact), true, "complete meaningful current metadata survives native CLI readback");
  const start = readable.indexOf(exact);
  assert.equal(createHash("sha256").update(readable.slice(start, start + exact.length)).digest("hex"),
    createHash("sha256").update(exact).digest("hex"), "current metadata has its exact tail and digest");
  assert.equal(readable.split(exact).length - 1, 1, "metadata is not repeated from native/export envelopes");
}

async function proveFixtureRuntime(records) {
  return records.map((record) => ({
    ownerSessionId: record.ownerSessionId,
    expectedPreviousEpisodeActiveSessionId: record.episodeActiveSessionId,
    verifiedCurrentEpisodeActiveSessionId: record.episodeActiveSessionId,
  }));
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

test("read-only inspection captures complete current Beads state without history reads", { timeout: 120_000 }, (t) => {
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
  }
  assert.ok(!sourceReads.some(({ args }) => ["history", "provenance"].includes(args[1])));
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


test("current Beads source digest binds comments relationships metadata and raw export independently of old history", { timeout: 180_000 }, (t) => {
  const fixture = embeddedBeadsSource(t, "current-source-digest");
  const independent = JSON.parse(bd(fixture.root, "create", "Independent relationship target", "--json")).id;
  class CurrentDigestRunner extends AsIsBeadsRunner {
    constructor() { super(); this.mutation = null; this.oldHistoryVersion = 1; this.historicalReads = 0; }
    run(commandName, args, options = {}) {
      const verb = args[0] === "--readonly" ? args[1] : args[0];
      // Hypothetical old history changes independently of every current response.
      // Intercept before native execution; even one attempted read fails below.
      if (commandName === "bd" && ["history", "provenance"].includes(verb)) {
        this.historicalReads += 1;
        return { status: 0, stdout: JSON.stringify([{ revision: this.oldHistoryVersion }]), stderr: "" };
      }
      const result = super.run(commandName, args, options);
      if (result.status !== 0 || commandName !== "bd") return result;
      if (this.mutation === "raw export" && verb === "export") {
        return { ...result, stdout: result.stdout.split("\n").map((line) =>
          line && JSON.parse(line).id === fixture.ids.parent ? `  ${line}  ` : line).join("\n") };
      }
      if (verb !== "show" || args[2] !== fixture.ids.parent || !this.mutation) return result;
      const rows = JSON.parse(result.stdout);
      const view = rows[0];
      if (this.mutation === "comments") view.comments = [...(view.comments ?? []), {
        text: "Current comment-only change", author: "current-source-author", created_at: "2026-11-20T00:00:00Z",
      }];
      if (this.mutation === "relationships") view.dependencies = [...(view.dependencies ?? []), { depends_on_id: independent }];
      if (this.mutation === "metadata") view.metadata = { ...view.metadata, current_opaque: { values: [false, null, "界🙂"] } };
      return { ...result, stdout: JSON.stringify(rows) };
    }
  }
  const runner = new CurrentDigestRunner();
  const inspect = () => inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  const baseline = inspect();
  assert.equal(baseline.status, "ready", baseline.detail);
  runner.oldHistoryVersion += 1;
  const sameCurrent = inspect();
  assert.equal(sameCurrent.status, "ready", sameCurrent.detail);
  assert.equal(sameCurrent.sourceRevision, baseline.sourceRevision);
  assert.equal(sameCurrent.sourceDigest, baseline.sourceDigest, "old history must not bind current-state capture");
  for (const mutation of ["comments", "relationships", "metadata", "raw export"]) {
    runner.mutation = mutation;
    const changed = inspect();
    assert.equal(changed.status, "ready", changed.detail);
    assert.notEqual(changed.sourceDigest, baseline.sourceDigest, mutation);
    assert.notEqual(changed.sourceRevision, baseline.sourceRevision, mutation);
    assert.equal(changed.sourceRevision, `capture-sha256:${changed.sourceDigest}`);
    assert.deepEqual(changed.taskCounts, baseline.taskCounts);
    runner.mutation = null;
    assert.equal(inspect().sourceDigest, baseline.sourceDigest, `restore ${mutation}`);
  }
  assert.equal(runner.historicalReads, 0, "current capture must never request historical evidence");
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
  assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
});

test("confirmed Beads to Backlog migration preserves active Episode identity and continues on canonical-primary Backlog", { timeout: 180_000 }, async (t) => {
  const fixture = beadsSource(t, "beads-active-owner");
  const nativeCurrent = captureBeadsCurrentTasks(fixture.root, Object.values(fixture.ids));
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
    const view = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", mapping.destinationTaskId));
    const task = view.task;
    assert.equal(task.status, mapping.sourceTaskId === fixture.ids.parent ? "In Progress" : "Done");
    assert.ok(task.path.startsWith(mapping.sourceTaskId === fixture.ids.archived ? ".backlog/archive/tasks/" : ".backlog/tasks/"));
    assertCurrentBacklogTask(view, nativeCurrent[mapping.sourceTaskId], inspection,
      Object.fromEntries(result.receipt.mappings.map((row) => [row.sourceTaskId, row.destinationTaskId])));
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


test("post-switch route replacement preserves active Beads migration continuity", { timeout: 240_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "post-switch-route-replacement");
  const owner = addActiveBeadsOwner(fixture);
  const runner = new AsIsBeadsRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  const sourceBefore = sourceAuthorityFiles(fixture.root);
  const sessionBefore = readFileSync(owner.record.episodeSessionFile, "utf8");
  const replacementRoute = "route-beads-migration-fixture-replacement";
  let proofs = 0;
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve complete native source evidence.",
    async verifyActiveRuntime(records) {
      proofs += 1;
      assert.equal(records.length, 1);
      const [record] = records;
      for (const field of ["ownerSessionId", "operationId", "worktree", "branch", "head", "episodeId", "episodeSessionFile"]) {
        assert.equal(record[field], owner.record[field], field);
      }
      assert.equal(record.episodeActiveSessionId, owner.record.episodeActiveSessionId);
      assert.equal(readFileSync(record.episodeSessionFile, "utf8"), sessionBefore);
      assert.deepEqual(sourceAuthorityFiles(fixture.root), sourceBefore, "source must remain intact through the latest runtime proof");
      if (proofs === 3) {
        assert.equal(record.provider, "backlog");
        const destination = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", record.taskId)).task;
        assert.equal(destination.id, record.taskId);
        const store = join(fixture.root, ".backlog");
        assert.equal(git(store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], record.providerRevision,
          "destination must already be published before retiring the source");
        // Only the verified current route changes after cutover. The durable
        // session, file, owner, worktree and mapped task stay the same.
        return [{ ownerSessionId: record.ownerSessionId,
          expectedPreviousEpisodeActiveSessionId: record.episodeActiveSessionId,
          verifiedCurrentEpisodeActiveSessionId: replacementRoute }];
      }
      assert.equal(record.provider, "beads");
      assert.equal(record.taskId, fixture.ids.parent);
      return proveFixtureRuntime(records);
    },
  });
  assert.equal(proofs, 3, "must reach the post-cutover runtime proof");
  assert.equal(result.status, "completed", result.detail);
  assert.equal(result.sourceAbsent, true);
  assert.equal(result.selectedProvider, "backlog");
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  const current = JSON.parse(readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8")).owners[owner.ownerSessionId];
  assert.equal(current.provider, "backlog");
  assert.equal(current.taskId, result.receipt.mappings.find((row) => row.sourceTaskId === fixture.ids.parent).destinationTaskId);
  for (const field of ["ownerSessionId", "operationId", "engine", "baseRef", "createdAt", "worktree", "branch", "head", "episodeId", "episodeSessionFile"]) {
    assert.deepEqual(current[field], owner.record[field], field);
  }
  assert.equal(readFileSync(current.episodeSessionFile, "utf8"), sessionBefore);
  assert.equal(git(owner.episode, "status", "--porcelain=v1"), "");
  assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
  assert.deepEqual(runner.sourcePublicationCommands, []);
});

test("post-switch continuity failure and persisted ownership drift still prevent source deletion", { timeout: 480_000 }, async (t) => {
  for (const kind of ["runtime unavailable", "persisted ownership drift"]) {
    await t.test(kind, async (t) => {
      const fixture = embeddedBeadsSource(t, `post-switch-${kind.replaceAll(" ", "-")}`);
      const owner = addActiveBeadsOwner(fixture);
      const runner = new AsIsBeadsRunner();
      const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
      assert.equal(inspection.status, "ready", inspection.detail);
      const sourceBefore = sourceAuthorityFiles(fixture.root);
      const registryPath = join(fixture.root, ".prime-claw", "ownership.json");
      const ownershipBefore = readFileSync(registryPath, "utf8");
      let proofs = 0, deletions = 0, driftedRegistry;
      const result = await migrateTaskProvider({
        cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: inspection.sourceRevision,
        confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve complete native source evidence.",
        async verifyActiveRuntime(records) {
          proofs += 1;
          if (proofs === 3) {
            assert.equal(records[0].provider, "backlog", "failure must occur after ownership cutover");
            if (kind === "runtime unavailable") throw new Error("fixture runtime unavailable after ownership switch");
            const registry = JSON.parse(readFileSync(registryPath, "utf8"));
            registry.owners[owner.ownerSessionId].episodeActiveSessionId = "persisted-route-drift";
            driftedRegistry = `${JSON.stringify(registry, null, 2)}\n`;
            writeFileSync(registryPath, driftedRegistry);
          }
          return proveFixtureRuntime(records);
        },
        deleteSource() { deletions += 1; },
      });
      assert.equal(proofs, 3);
      assert.equal(result.status, "blocked", result.detail);
      assert.equal(deletions, 0);
      assert.equal(existsSync(join(fixture.root, ".beads")), true);
      assert.deepEqual(sourceAuthorityFiles(fixture.root), sourceBefore);
      if (kind === "runtime unavailable") {
        assert.equal(result.code, "pre-cutover-failed");
        assert.match(result.detail, /fixture runtime unavailable after ownership switch/);
        assert.equal(readFileSync(registryPath, "utf8"), ownershipBefore, "unchanged source ownership must be restored");
      } else {
        assert.equal(result.code, "cutover-incomplete");
        assert.match(result.detail, /ownership rollback refused because the registry changed after the switch/);
        assert.equal(readFileSync(registryPath, "utf8"), driftedRegistry, "a changed persisted owner record must not be overwritten");
      }
      assert.deepEqual(runner.sourcePublicationCommands, []);
    });
  }
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


test("active Beads Episode deletion refusal preserves source and exact Backlog destination retry completes", { timeout: 600_000 }, async (t) => {
  await t.test("ignored memory documents refuse published data and preserve source and exact ownership", async (t) => {
    const fixture = embeddedBeadsSource(t, "ignored-memory-publication");
    bd(fixture.root, "remember", "Public ignored memory λ\n  exact whitespace  \n", "--key", "public-ignored");
    const destination = publishedPopulatedBacklogDestination(fixture);
    writeFileSync(join(destination.store, ".gitignore"), "docs/\n");
    git(destination.store, "add", ".gitignore");
    git(destination.store, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "existing docs ignore policy");
    git(destination.store, "push", "-q", "origin", `HEAD:${TASK_HISTORY_REF}`);
    addActiveBeadsOwner(fixture);
    const registryPath = join(fixture.root, ".prime-claw", "ownership.json");
    const registry = readFileSync(registryPath).toString("base64");
    const source = sourceAuthorityFiles(fixture.root);
    const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: RUNNER });
    assert.equal(inspection.status, "ready", inspection.detail);
    let deletions = 0;
    const request = { cwd: fixture.root, targetProvider: "backlog", runner: RUNNER,
      expectedSourceRevision: inspection.sourceRevision, confirmedSwitch: true, actor: "migration-operator",
      semanticPlacement: "Preserve the complete native source without curation.", verifyActiveRuntime: proveFixtureRuntime,
      deleteSource() { deletions += 1; } };
    const refused = await migrateTaskProvider(request);
    assert.equal(refused.status, "blocked", refused.detail);
    assert.equal(refused.code, "pre-cutover-failed");
    assert.match(refused.detail, /verify committed Backlog memory output/);
    const head = git(destination.store, "rev-parse", "HEAD");
    assert.equal(git(destination.store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], head);
    assert.equal(git(destination.store, "status", "--porcelain=v1"), "", "ignored local documents do not dirty Git");
    const imported = readdirSync(join(destination.store, "docs")).filter((path) => /Imported-Beads/.test(path));
    assert.equal(imported.length, 2, "memory and index still exist locally");
    for (const path of imported) {
      const docId = readFileSync(join(destination.store, "docs", path), "utf8").match(/^id: (doc-\d+)$/m)[1];
      assert.ok(backlog(fixture.root, "doc", "view", docId, "--plain").includes("Migrated from Beads"));
      assert.equal(command(destination.store, "git", ["cat-file", "-e", `${head}:docs/${path}`], true), null);
    }
    assert.equal(readFileSync(join(destination.store, ".gitignore"), "utf8"), "docs/\n", "ignore policy is never repaired");
    assert.equal(deletions, 0);
    assert.equal(existsSync(join(fixture.root, ".beads")), true);
    assert.deepEqual(sourceAuthorityFiles(fixture.root), source);
    assert.equal(readFileSync(registryPath).toString("base64"), registry);
    const replay = await migrateTaskProvider(request);
    assert.equal(replay.status, "blocked", replay.detail);
    assert.equal(deletions, 0);
    assert.equal(git(destination.store, "rev-parse", "HEAD"), head, "partial import is not retried or repaired");
    assert.deepEqual(sourceAuthorityFiles(fixture.root), source);
    assert.equal(readFileSync(registryPath).toString("base64"), registry);
  });
  const fixture = beadsSource(t, "beads-delete-refusal-retry");
  const memoryRows = [
    { _type: "memory", key: "public-replay-λ", value: "  ---\nstatus: source data\n---\nPublic café 🐙\n\ttrailing  \n" },
    { _type: "memory", key: "public-second", value: "Second public memory with ``` and \u0001" },
  ];
  for (const row of memoryRows) bd(fixture.root, "remember", "--key", row.key, "--", row.value);
  bd(fixture.root, "dolt", "push", "--no-adopt");
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
  const store = join(fixture.root, ".backlog");
  const receiptId = Object.values(physicalDestinationRecords(store)).map((bytes) => Buffer.from(bytes, "base64").toString("utf8"))
    .find((text) => text.includes("title: Prime Claw task-provider migration receipt")).match(/^id: (.+)$/m)[1];
  const receiptView = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", receiptId));
  const receipt = JSON.parse(receiptView.task.implementationNotes.match(/^```json\n([\s\S]+)\n```$/)[1]);
  const memoryOutputs = receipt.backlogMemoryOutputs;
  assert.equal(memoryOutputs.documents.length, memoryRows.length);
  assert.equal(receipt.taskCounts.total, inspection.taskCounts.total);
  assert.equal(receipt.mappings.length, inspection.taskCounts.total);
  verifyBacklogMemoryOutputs(memoryOutputs, fixture.root, RUNNER);
  const importedRows = memoryOutputs.documents.map((doc) => JSON.parse(doc.body.match(/## Complete native memory record \(lossless JSON\)\n\n```json\n([^\n]+)\n```/)[1]));
  assert.deepEqual(importedRows.sort((a, b) => a.key.localeCompare(b.key)), memoryRows.sort((a, b) => a.key.localeCompare(b.key)));
  for (const output of [...memoryOutputs.documents, memoryOutputs.index, memoryOutputs.userTask]) {
    for (const revision of [receipt.destinationDataRevision, git(store, "rev-parse", "HEAD")]) {
      assert.equal(command(store, "git", ["show", `${revision}:${output.path.slice(".backlog/".length)}`]),
        readFileSync(join(fixture.root, output.path), "utf8"), "data/receipt commits preserve exact output bytes without trimming");
    }
  }
  assert.equal(JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", memoryOutputs.userTask.taskId)).task.status, "In Design");
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
  await t.test("missing, changed and unpublished memory outputs refuse replay without source retirement", async () => {
    const target = join(fixture.root, memoryOutputs.documents[0].path);
    const original = readFileSync(target);
    const source = sourceAuthorityFiles(fixture.root);
    const registry = readFileSync(replayRegistryPath).toString("base64");
    async function denied(diagnostic) {
      let deletions = 0;
      const result = await migrateTaskProvider({
        cwd: fixture.root, targetProvider: "backlog", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
        confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve exact unsupported values in native provenance.",
        verifyActiveRuntime: proveFixtureRuntime, deleteSource() { deletions += 1; },
      });
      assert.equal(result.status, "blocked", result.detail);
      assert.match(result.detail, diagnostic);
      assert.equal(deletions, 0);
      assert.deepEqual(sourceAuthorityFiles(fixture.root), source);
      assert.equal(readFileSync(replayRegistryPath).toString("base64"), registry);
    }
    rmSync(target);
    await denied(/not clean|mismatch/);
    writeFileSync(target, original);
    backlog(fixture.root, "doc", "update", memoryOutputs.documents[0].docId, "--content=Changed public memory output");
    git(store, "add", "-A");
    git(store, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "unpublished changed memory");
    await denied(/publication|exact revision/);
    git(store, "push", "-q", "origin", `HEAD:${TASK_HISTORY_REF}`);
    await denied(/native identity\/body mismatch/);
    writeFileSync(target, original);
    const nativePath = memoryOutputs.documents[0].path.slice(".backlog/".length);
    git(store, "update-index", "--assume-unchanged", "--", nativePath);
    try {
      assert.equal(git(store, "status", "--porcelain=v1"), "");
      verifyBacklogMemoryOutputs(memoryOutputs, fixture.root, RUNNER);
      await denied(/committed bytes differ/);
    } finally {
      git(store, "update-index", "--no-assume-unchanged", "--", nativePath);
    }
    git(store, "add", "-A");
    git(store, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "restore exact public memory output");
    git(store, "push", "-q", "origin", `HEAD:${TASK_HISTORY_REF}`);
    verifyBacklogMemoryOutputs(memoryOutputs, fixture.root, RUNNER);
  });
  await t.test("pre-retirement memory loss rolls ownership back and never calls source deletion", async () => {
    const target = join(fixture.root, memoryOutputs.index.path);
    const original = readFileSync(target);
    const registry = readFileSync(replayRegistryPath).toString("base64");
    const source = sourceAuthorityFiles(fixture.root);
    let proofs = 0, deletions = 0;
    const denied = await migrateTaskProvider({
      cwd: fixture.root, targetProvider: "backlog", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
      confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve exact unsupported values in native provenance.",
      async verifyActiveRuntime(records) {
        proofs += 1;
        if (proofs === 3) rmSync(target);
        return proveFixtureRuntime(records);
      },
      deleteSource() { deletions += 1; },
    });
    assert.equal(proofs, 3);
    assert.equal(denied.status, "blocked");
    assert.match(denied.detail, /not clean|mismatch/);
    assert.equal(deletions, 0);
    assert.deepEqual(sourceAuthorityFiles(fixture.root), source);
    assert.equal(readFileSync(replayRegistryPath).toString("base64"), registry);
    writeFileSync(target, original);
  });
  const retried = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve exact unsupported values in native provenance.",
    verifyActiveRuntime: proveFixtureRuntime,
  });
  assert.equal(retried.status, "completed", retried.detail);
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  assert.deepEqual(retried.receipt.mappings.map((row) => row.destinationTaskId).concat(retried.receiptTaskId, memoryOutputs.userTask.taskId).sort(), destinationIds);
  assert.deepEqual(retried.receipt.backlogMemoryOutputs, memoryOutputs, "exact replay reuses every document/index/USER identity");
  assert.equal(git(store, "ls-files", "docs").split(/\r?\n/).filter(Boolean).length, memoryRows.length + 1);
  verifyBacklogMemoryOutputs(memoryOutputs, fixture.root, RUNNER);
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




test("complete-receipt same-destination replay rejects current AC and comment drift with source references retained", { timeout: 300_000 }, async (t) => {
  for (const kind of ["acceptance criteria", "actual comment"]) {
    await t.test(kind, async (t) => {
      const fixture = embeddedBeadsSource(t, `current-replay-drift-${kind.replaceAll(" ", "-")}`);
      const owner = addActiveBeadsOwner(fixture);
      const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: RUNNER });
      assert.equal(inspection.status, "ready", inspection.detail);
      const sourceBefore = sourceAuthorityFiles(fixture.root);
      const registryPath = join(fixture.root, ".prime-claw", "ownership.json");
      const ownershipBefore = readFileSync(registryPath, "utf8");
      const request = {
        cwd: fixture.root, targetProvider: "backlog", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
        confirmedSwitch: true, actor: "current-replay-operator", semanticPlacement: "Preserve complete readable current ticket content.",
        verifyActiveRuntime: proveFixtureRuntime,
        deleteSource() { throw new Error("fixture retains source after complete native destination proof"); },
      };
      const first = await migrateTaskProvider(request);
      assert.equal(first.status, "blocked", first.detail);
      assert.equal(first.code, "pre-cutover-failed");
      assert.match(first.detail, /fixture retains source after complete native destination proof/);
      assert.deepEqual(sourceAuthorityFiles(fixture.root), sourceBefore);
      assert.equal(readFileSync(registryPath, "utf8"), ownershipBefore);
      const store = join(fixture.root, ".backlog");
      const receiptText = Object.values(physicalDestinationRecords(store)).map((bytes) => Buffer.from(bytes, "base64").toString("utf8"))
        .find((value) => value.includes("title: Prime Claw task-provider migration receipt"));
      assert.ok(receiptText, "partial destination has a complete published native receipt before deliberate drift");
      const receiptId = receiptText.match(/^id: (.+)$/m)[1];
      const receiptView = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", receiptId));
      assert.equal(receiptView.task.status, "Done");
      const receipt = JSON.parse(receiptView.task.implementationNotes.match(/^```json\n([\s\S]+)\n```$/)[1]);
      assert.equal(receipt.sourceRevision, inspection.sourceRevision);
      assert.equal(receipt.sourceDigest, inspection.sourceDigest);
      const mapped = receipt.mappings.find((row) => row.sourceTaskId === fixture.ids.parent).destinationTaskId;
      const before = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", mapped));
      assert.deepEqual(before.task.references, [
        `prime-claw-beads-source:${fixture.ids.parent}`,
        `prime-claw-beads-current:${JSON.stringify({ sourceTaskId: fixture.ids.parent,
          sourceRevision: inspection.sourceRevision, sourceDigest: inspection.sourceDigest }, null, 2)}`,
      ]);
      if (kind === "acceptance criteria") backlog(fixture.root, "task", "edit", mapped, "--ac", "Deliberate changed current criterion Ω", "--plain");
      else backlog(fixture.root, "task", "edit", mapped, "--comment", "Deliberate changed actual comment Ω", "--comment-author", "drift-author", "--plain");
      const altered = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", mapped));
      assert.deepEqual(altered.task.references, before.task.references, "identity references cannot stand in for complete current-state verification");
      if (kind === "acceptance criteria") assert.notDeepEqual(altered.task.acceptanceCriteria, before.task.acceptanceCriteria);
      else assert.notDeepEqual(altered.task.comments, before.task.comments);
      const taskPath = altered.task.path.slice(".backlog/".length);
      git(store, "add", "--", taskPath);
      git(store, "-c", "user.name=Current Drift Fixture", "-c", "user.email=current-drift@example.invalid", "commit", "-qm", `persist ${kind} drift with source identity retained`);
      git(store, "push", "-q", "origin", `HEAD:${TASK_HISTORY_REF}`);
      const driftHead = git(store, "rev-parse", "HEAD");
      assert.equal(git(store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], driftHead,
        "replay must reject current content, not merely unpublished or dirty state");
      const driftRecords = physicalDestinationRecords(store);
      const codeHead = git(fixture.root, "rev-parse", "HEAD");
      const codeIndex = git(fixture.root, "ls-files", "--stage");
      let deletions = 0;
      const replay = await migrateTaskProvider({ ...request, deleteSource() { deletions += 1; } });
      assert.equal(replay.status, "blocked", replay.detail);
      assert.equal(replay.code, "pre-cutover-failed");
      assert.equal(deletions, 0, "changed current ticket cannot reach source retirement");
      assert.equal(git(store, "rev-parse", "HEAD"), driftHead, "replay neither repairs nor reauthors the destination");
      assert.equal(git(store, "status", "--porcelain=v1"), "");
      assert.deepEqual(physicalDestinationRecords(store), driftRecords, "no duplicate task, comment, or receipt after refused replay");
      assert.deepEqual(sourceAuthorityFiles(fixture.root), sourceBefore);
      assert.equal(readFileSync(registryPath, "utf8"), ownershipBefore);
      assert.equal(git(fixture.root, "rev-parse", "HEAD"), codeHead);
      assert.equal(git(fixture.root, "ls-files", "--stage"), codeIndex);
      assert.equal(git(owner.episode, "rev-parse", "HEAD"), owner.episodeHead);
      assert.equal(existsSync(join(fixture.root, ".beads")), true);
    });
  }
});

test("current native migration and replay preserve configured type priority and metadata-shaped source comments", { timeout: 300_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "current-configured-bookkeeping-replay");
  const sourceComments = [
    "prime-claw-task-provider-migration-source-v1 mapping ordinary current source prose Ω",
    "prime-claw-task-provider-migration-receipt-v1\nAn ordinary current source comment, not a destination receipt.",
  ];
  for (const body of sourceComments) bd(fixture.root, "comments", "add", fixture.ids.parent, body, "--author", "source-marker-author");
  bd(fixture.root, "remember", "One current separate memory Ω", "--key", "configured-public-memory");
  const destination = publishedPopulatedBacklogDestination(fixture);
  const configPath = join(destination.store, "config.yml");
  const types = ["Incident, Follow-up"];
  const priorities = ["P4", "P1", "P0", "Very High, Almost"];
  // Disposable native configuration fixture; preserve its exact bytes during
  // migration, including legitimate comma-bearing names and no literal task.
  let config = readFileSync(configPath, "utf8");
  for (const [key, values] of [["types", types], ["priorities", priorities]]) {
    const line = `${key}: ${JSON.stringify(values)}`;
    const pattern = new RegExp(`^${key}:.*$`, "m");
    config = pattern.test(config) ? config.replace(pattern, line) : `${config}\n${line}\n`;
  }
  writeFileSync(configPath, config);
  git(destination.store, "add", "config.yml");
  git(destination.store, "-c", "user.name=Configured Fixture", "-c", "user.email=configured@example.invalid", "commit", "-qm", "fixture selects custom configured native values");
  git(destination.store, "push", "-q", "origin", `HEAD:${TASK_HISTORY_REF}`);
  // Fixture starts with its selected independent layout already published, so
  // replay exercises existing-destination content rather than fresh-layout-only
  // recovery (which deliberately remains a separate bounded path).
  command(fixture.root, "ln", ["-s", ".backlog/config.yml", "backlog.config.yml"]);
  const ignorePath = join(fixture.root, ".gitignore");
  writeFileSync(ignorePath, (existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "") + "\n/.backlog/\n");
  git(fixture.root, "add", ".gitignore", "backlog.config.yml");
  git(fixture.root, "commit", "-qm", "fixture publishes selected independent native layout");
  git(fixture.root, "push", "-q");
  const current = captureBeadsCurrentTasks(fixture.root, Object.values(fixture.ids));
  const sourceBefore = sourceAuthorityFiles(fixture.root);
  const runner = new AsIsBeadsRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  let retirements = 0;
  const request = {
    cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "configured-native-fixture", now: () => "2026-11-21T00:00:00.000Z",
    semanticPlacement: "Preserve current fields and actual comments; respect configured native values.",
    deleteSource() { retirements += 1; throw new Error("configured fixture deliberately retains source"); },
  };
  const first = await migrateTaskProvider(request);
  assert.equal(first.status, "blocked", first.detail);
  assert.match(first.detail, /configured fixture deliberately retains source/);
  const records = physicalDestinationRecords(destination.store);
  const receiptMarkdown = Object.values(records).map((value) => Buffer.from(value, "base64").toString("utf8"))
    .find((value) => /^title: Prime Claw task-provider migration receipt$/m.test(value));
  assert.ok(receiptMarkdown);
  const receiptId = receiptMarkdown.match(/^id: (.+)$/m)[1];
  const receiptTask = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", receiptId)).task;
  const receipt = JSON.parse(receiptTask.implementationNotes.match(/^```json\n([\s\S]+)\n```$/)[1]);
  const mapping = Object.fromEntries(receipt.mappings.map((row) => [row.sourceTaskId, row.destinationTaskId]));
  assert.equal(receiptTask.type, types[0], "receipt uses an actual configured native type");
  const userTask = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", receipt.backlogMemoryOutputs.userTask.taskId)).task;
  assert.equal(userTask.type, types[0], "exactly one separate memory USER uses the configured fallback too");
  assert.equal(receipt.backlogMemoryOutputs.documents.length, 1);
  const imported = {};
  for (const [sourceId, id] of Object.entries(mapping)) {
    const pkg = current[sourceId];
    const parent = pkg.nativeView.parent ?? pkg.exportRow.parent;
    const dependencies = (pkg.nativeView.dependencies ?? pkg.exportRow.dependencies ?? []).map((value) =>
      typeof value === "string" ? value : value.depends_on_id ?? value.id ?? value.issue_id).map((sourceId) => mapping[sourceId] ?? sourceId);
    const projection = projectBeadsCurrentTask(pkg, {
      sourceRevision: inspection.sourceRevision, sourceDigest: inspection.sourceDigest,
      status: ({ open: "In Design", in_progress: "In Progress", blocked: "Blocked" })[pkg.nativeView.status],
      ...(parent ? { parentTaskId: mapping[parent] } : {}), dependencies, types, priorities,
    });
    const view = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", id));
    assertBeadsCurrentTask(view, projection, id);
    assert.equal(view.task.type, types[0]);
    imported[view.task.path] = readFileSync(join(fixture.root, view.task.path), "utf8");
    if (sourceId === fixture.ids.parent) {
      assert.equal(view.task.priority.toLowerCase(), "p1", "configured numeric P1 beats the legacy priority alias");
      for (const body of sourceComments) assert.ok(view.task.comments.some((comment) => comment.body.startsWith(body)),
        "real source metadata-shaped prose remains an ordinary authored comment");
      assert.equal(view.task.comments.length, current[sourceId].nativeView.comments.length);
    }
  }
  const replay = await migrateTaskProvider(request);
  assert.equal(replay.status, "blocked", replay.detail);
  assert.match(replay.detail, /configured fixture deliberately retains source/);
  assert.equal(retirements, 2, "valid source comments do not become legacy evidence or duplicate receipts on replay");
  assert.deepEqual(Object.keys(physicalDestinationRecords(destination.store)).sort(), Object.keys(records).sort());
  for (const [path, bytes] of Object.entries(imported)) assert.equal(readFileSync(join(fixture.root, path), "utf8"), bytes);
  assert.equal(readFileSync(configPath, "utf8"), config);
  assert.deepEqual(sourceAuthorityFiles(fixture.root), sourceBefore);
  assert.equal(git(destination.store, "status", "--porcelain=v1"), "");
});

test("current native importer stops after an accepted comment response failure and never duplicates a partial allocation", { timeout: 240_000 }, async (t) => {
  const fixture = repository(t, "current-native-partial-write");
  bd(fixture.root, "init", "--skip-hooks", "--skip-agents", "--prefix", "PART", "--quiet", "--non-interactive");
  bd(fixture.root, "dolt", "remote", "remove", "origin");
  const parent = JSON.parse(bd(fixture.root, "create", "First current task", "--description", "Current readable description Ω", "--json")).id;
  const child = JSON.parse(bd(fixture.root, "create", "Later current child", "--parent", parent, "--json")).id;
  bd(fixture.root, "comments", "add", parent, "First actual current comment Ω", "--author", "partial-source-author");
  fixture.ids = { parent, child };
  git(fixture.root, "add", "-A");
  if (git(fixture.root, "status", "--porcelain=v1")) git(fixture.root, "commit", "-qm", "seed bounded native partial-write fixture");
  git(fixture.root, "push", "-q");
  const owner = addActiveBeadsOwner(fixture);
  const runner = new AsIsBeadsRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  const foreign = repository(t, "current-native-partial-foreign-context");
  backlog(foreign.root, "init", "foreign", "--defaults", "--backlog-dir", "backlog", "--config-location", "folder", "--integration-mode", "none");
  canonicalBacklogConfig(foreign.root);
  backlog(foreign.root, "task", "create", "Untouched foreign task", "--status", "In Design", "--plain");
  git(foreign.root, "add", "-A");
  git(foreign.root, "commit", "-qm", "seed foreign native context");
  const foreignHead = git(foreign.root, "rev-parse", "HEAD");
  const foreignRecords = physicalDestinationRecords(join(foreign.root, "backlog"));
  const foreignConfig = readFileSync(join(foreign.root, "backlog", "config.yml"), "utf8");
  const sourceBefore = sourceAuthorityFiles(fixture.root);
  const exportBefore = bd(fixture.root, "--readonly", "export", "--all");
  const registryPath = join(fixture.root, ".prime-claw", "ownership.json");
  const ownershipBefore = readFileSync(registryPath, "utf8");
  const requests = [];
  let originalNativeStatus;
  let deletions = 0;
  const request = {
    cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "partial-write-fixture", semanticPlacement: "Preserve complete readable current ticket content.",
    verifyActiveRuntime: proveFixtureRuntime,
    deleteSource() { deletions += 1; },
  };
  // Transparent wrapper around REAL native HTTP operations: the first actual
  // comment has persisted and native returned200 before this fixture changes
  // only the response status seen by the client. No second tracker or fake
  // persistence is involved. This is controlled response failure, not proof of
  // ordinary importer cancellation or a real transport losing its response.
  const originalRequest = http.request;
  http.request = function (...args) {
    const url = String(args[0]);
    const method = args[1]?.method ?? "GET";
    if (method === "POST" || method === "PUT") requests.push({ method, url });
    const callback = args.at(-1);
    if (method === "PUT" && originalNativeStatus === undefined && typeof callback === "function") {
      args[args.length - 1] = (response) => {
        originalNativeStatus = response.statusCode;
        response.statusCode = 503;
        callback(response);
      };
    }
    return originalRequest.apply(this, args);
  };
  syncBuiltinESMExports();
  let first;
  const previousBacklogCwd = process.env.BACKLOG_CWD;
  let observedAmbient;
  try {
    process.env.BACKLOG_CWD = foreign.root;
    first = await migrateTaskProvider(request);
    observedAmbient = process.env.BACKLOG_CWD;
  } finally {
    if (previousBacklogCwd === undefined) delete process.env.BACKLOG_CWD;
    else process.env.BACKLOG_CWD = previousBacklogCwd;
    http.request = originalRequest; syncBuiltinESMExports();
  }
  assert.equal(observedAmbient, foreign.root, "migration-local synchronous context pinning restores the foreign ambient value");
  assert.deepEqual(physicalDestinationRecords(join(foreign.root, "backlog")), foreignRecords);
  assert.equal(readFileSync(join(foreign.root, "backlog", "config.yml"), "utf8"), foreignConfig);
  assert.equal(git(foreign.root, "rev-parse", "HEAD"), foreignHead);
  assert.equal(git(foreign.root, "status", "--porcelain=v1"), "");
  assert.equal(originalNativeStatus, 200, "real native comment write succeeded before the controlled response failure");
  assert.equal(first.status, "blocked", first.detail);
  assert.equal(first.code, "pre-cutover-failed");
  assert.match(first.detail, /http-status-503; outcome=uncertain/);
  assert.match(first.remediation, /STOP and preserve/);
  assert.match(first.remediation, /Do not automatically resend/);
  assert.deepEqual(requests.map(({ method }) => method), ["POST", "PUT"], "no next source task or resend after uncertain comment response");
  const artifactDirectory = first.detail.match(/Private transport evidence: ([^\n]+)$/)?.[1];
  assert.ok(artifactDirectory && existsSync(artifactDirectory), "private transport failure evidence is retained");
  t.after(() => rmSync(artifactDirectory, { recursive: true, force: true }));
  const store = join(fixture.root, ".backlog");
  const partial = physicalDestinationRecords(store);
  assert.equal(Object.keys(partial).length, 1, "no child, receipt, or replacement allocation follows the failed write");
  const markdown = Buffer.from(Object.values(partial)[0], "base64").toString("utf8");
  const id = markdown.match(/^id: (.+)$/m)[1];
  const view = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", id));
  assert.equal(view.task.title, "First current task");
  assert.equal(view.task.description, "Current readable description Ω");
  assert.deepEqual(view.task.references, [
    `prime-claw-beads-source:${parent}`,
    `prime-claw-beads-current:${JSON.stringify({ sourceTaskId: parent,
      sourceRevision: inspection.sourceRevision, sourceDigest: inspection.sourceDigest }, null, 2)}`,
  ], "the initial native allocation already has complete source identity before any comment response");
  assert.equal(view.task.comments.length, 1, "actual comment persisted despite uncertain client outcome");
  assert.equal(view.task.comments[0].author, "partial-source-author");
  assert.ok(view.task.comments[0].body.includes("First actual current comment Ω"));
  assert.equal(deletions, 0);
  assert.deepEqual(sourceAuthorityFiles(fixture.root), sourceBefore);
  assert.equal(bd(fixture.root, "--readonly", "export", "--all"), exportBefore);
  assert.equal(readFileSync(registryPath, "utf8"), ownershipBefore);
  assert.equal(git(owner.episode, "rev-parse", "HEAD"), owner.episodeHead);
  // Deliberately publish this fixture's partial record, separately from the
  // failed importer. An explicit re-invocation must still refuse identity-only
  // evidence, not merely refuse a dirty/unpublished store.
  git(store, "add", "-A");
  git(store, "-c", "user.name=Partial Write Fixture", "-c", "user.email=partial@example.invalid", "commit", "-qm", "fixture publishes unverified partial allocation");
  git(store, "push", "-q", "origin", `HEAD:${TASK_HISTORY_REF}`);
  const partialHead = git(store, "rev-parse", "HEAD");
  const replay = await migrateTaskProvider(request);
  assert.equal(replay.status, "blocked", replay.detail);
  assert.equal(replay.code, "pre-cutover-failed");
  assert.match(replay.detail, /complete destination-native receipt|incomplete or unverified/);
  assert.equal(git(store, "rev-parse", "HEAD"), partialHead);
  assert.equal(git(store, "status", "--porcelain=v1"), "");
  assert.deepEqual(physicalDestinationRecords(store), partial, "no duplicate, comment completion, or receipt on partial reinvocation");
  assert.equal(deletions, 0);
  assert.deepEqual(sourceAuthorityFiles(fixture.root), sourceBefore);
  assert.equal(bd(fixture.root, "--readonly", "export", "--all"), exportBefore);
  assert.equal(readFileSync(registryPath, "utf8"), ownershipBefore);
});

test("used unsupported Beads statuses and ambiguous archive records aggregate before inspection or confirmation destination writes", { timeout: 240_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "embedded-status-archive-preflight", "unused:active,finished:done,paused:wip");
  const runner = new AsIsBeadsRunner();
  const baseline = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(baseline.status, "ready", baseline.detail);
  const offenders = [];
  for (const status of ["pinned", "hooked", "finished", "paused"]) {
    const id = JSON.parse(bd(fixture.root, "create", `Unsupported ${status}`, "--status", status, "--json")).id;
    offenders.push({ id, status });
  }
  const malformed = JSON.parse(bd(fixture.root, "create", "Malformed claimed prior archive", "--metadata", JSON.stringify({
    prime_claw_migration: { marker: "prime-claw-task-provider-migration-source-v1", sourceProvider: "backlog", classification: "archived" },
  }), "--json")).id;
  bd(fixture.root, "close", malformed, "--reason", "ordinary closed task with malformed archive claim", "--json");
  offenders.push({ id: malformed, status: "closed" });
  const retainedArchive = JSON.parse(bd(fixture.root, "create", "Open task with retained archive evidence", "--metadata", JSON.stringify({
    prime_claw_migration: retainedBacklogArchivePackage("task"),
  }), "--json")).id;
  // Exact retained archive evidence is valid independently of the mapped status;
  // an ordinary open source record is not an unsupported or ambiguous offender.
  const wrongAbandonment = JSON.parse(bd(fixture.root, "create", "Abandonment reason names another task", "--json")).id;
  bd(fixture.root, "close", wrongAbandonment, "--reason", `Prime Claw abandonment: task OTHER-1; pushed Episode head ${git(fixture.root, "rev-parse", "HEAD")}; code was not merged.`, "--json");
  offenders.push({ id: wrongAbandonment, status: "closed" });
  const before = sourceAuthorityFiles(fixture.root);
  const exportBefore = bd(fixture.root, "--readonly", "export", "--all");
  const sourceRecords = [...offenders, { id: retainedArchive, status: "open" }];
  const currentBefore = Object.fromEntries(sourceRecords.map(({ id }) => [id,
    bd(fixture.root, "--readonly", "show", id, "--json", "--long", "--include-comments")]));
  const sourceHead = git(fixture.root, "rev-parse", "HEAD");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  let deletions = 0;
  const confirmed = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: baseline.sourceRevision,
    confirmedSwitch: true, actor: "status-preflight-operator", semanticPlacement: "Preserve complete current source fields.",
    deleteSource() { deletions += 1; },
  });
  for (const result of [inspection, confirmed]) {
    assert.equal(result.status, "blocked");
    for (const { id, status } of offenders) {
      assert.ok(result.detail.includes(`${id} status=${JSON.stringify(status)}`), `diagnostic omitted exact task/status ${id}/${status}: ${result.detail}`);
    }
    assert.equal(result.detail.includes(`${retainedArchive} status="open"`), false,
      "valid retained archive evidence with an open status must not be reported as an offender");
    assert.equal(result.detail.includes('status="unused"'), false, "unused catalog entries must not be status offenders");
  }
  assert.equal(deletions, 0);
  assert.deepEqual(sourceAuthorityFiles(fixture.root), before);
  assert.equal(bd(fixture.root, "--readonly", "export", "--all"), exportBefore);
  for (const { id } of sourceRecords) assert.equal(
    bd(fixture.root, "--readonly", "show", id, "--json", "--long", "--include-comments"), currentBefore[id]);
  assert.equal(git(fixture.root, "rev-parse", "HEAD"), sourceHead);
  assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
  assert.deepEqual(JSON.parse(bd(fixture.root, "--readonly", "dolt", "remote", "list", "--json")), []);
  assert.deepEqual(runner.sourcePublicationCommands, []);
});



test("native Beads deferred tasks project to In Design without active deferral and replay preserves source authority", { timeout: 300_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "embedded-deferred");
  const cases = [
    { title: "DEFERRED: Decide + enable web search provider", until: "2026-08-01T00:00:00Z" },
    { title: "Future deferred ordinary task", until: "2099-08-01T00:00:00Z" },
    { title: "Indefinite deferred ordinary task" },
  ];
  for (const row of cases) {
    row.id = JSON.parse(bd(fixture.root, "create", row.title, "--description", "Keep ordinary deferred description unchanged.",
      "--design", "Keep the deferred decision in the living plan.", "--notes", "Original deferred notes.", "--json")).id;
    // Native fixture setup only. Migration must never normalize the source this way.
    bd(fixture.root, "defer", row.id, ...(row.until ? ["--until", row.until] : []), "--reason", "Deferred pending ordinary operator review.", "--json");
    bd(fixture.root, "comments", "add", row.id, "Keep this ordinary deferred comment.", "--author", "deferred-source-author");
    bd(fixture.root, "provenance", "record", "--issue", row.id, "--kind", "commit", "--source", "fixture",
      "--ref", git(fixture.root, "rev-parse", "HEAD"), "--ref-kind", "git-sha", "--actor", "deferred-source-actor", "--payload", '{"deferred":"ordinary historical context"}');
  }
  const sourceIds = [...Object.values(fixture.ids), ...cases.map(({ id }) => id)];
  const readNative = () => Object.fromEntries(sourceIds.map((id) => [id, {
    view: JSON.parse(bd(fixture.root, "--readonly", "show", id, "--json", "--long", "--include-comments"))[0],
  }]));
  const native = readNative();
  const nativeCurrent = captureBeadsCurrentTasks(fixture.root, sourceIds);
  for (const { id, until } of cases) {
    assert.equal(native[id].view.status, "deferred");
    assert.equal(native[id].view.defer_until ?? null, until ?? null);
    assert.match(native[id].view.notes, /Original deferred notes\./);
    assert.match(native[id].view.notes, /Deferred pending ordinary operator review\./);
  }
  const before = sourceAuthorityFiles(fixture.root);
  const sourceHead = git(fixture.root, "rev-parse", "HEAD");
  const statusCatalog = JSON.parse(bd(fixture.root, "--readonly", "statuses", "--json"));
  const exportBefore = bd(fixture.root, "--readonly", "export", "--all");
  const runner = new AsIsBeadsRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.equal(inspection.sourceProvider, "beads");
  assert.deepEqual(inspection.taskCounts, { open: 6, closed: 0, archived: 0, total: 6 });
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
  assert.deepEqual(sourceAuthorityFiles(fixture.root), before);

  const store = join(fixture.root, ".backlog");
  let retirements = 0;
  const request = {
    cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "deferred-migration-operator", semanticPlacement: "Preserve exact ordinary text and complete native source evidence.",
    deleteSource() {
      retirements += 1;
      assert.deepEqual(sourceAuthorityFiles(fixture.root), before);
      assert.equal(bd(fixture.root, "--readonly", "export", "--all"), exportBefore);
      assert.deepEqual(readNative(), native);
      assert.equal(git(store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], git(store, "rev-parse", "HEAD"),
        "exact destination readback and publication must pass before guarded retirement");
      throw new Error("fixture refuses deferred source retirement after destination proof");
    },
  };
  const first = await migrateTaskProvider(request);
  assert.equal(first.status, "blocked", first.detail);
  assert.equal(first.code, "pre-cutover-failed");
  assert.match(first.detail, /fixture refuses deferred source retirement/);
  assert.equal(retirements, 1);
  const readReceipt = () => {
    const text = Object.values(physicalDestinationRecords(store)).map((bytes) => Buffer.from(bytes, "base64").toString("utf8"))
      .find((text) => text.includes("title: Prime Claw task-provider migration receipt"));
    assert.ok(text, "published native migration receipt is required");
    const id = text.match(/^id: (.+)$/m)[1];
    const task = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", id)).task;
    return { id, receipt: JSON.parse(task.implementationNotes.match(/^```json\n([\s\S]+)\n```$/)[1]) };
  };
  const firstReceipt = readReceipt();
  assert.equal(firstReceipt.receipt.sourceRevision, inspection.sourceRevision);
  assert.equal(firstReceipt.receipt.sourceDigest, inspection.sourceDigest);
  assert.deepEqual(firstReceipt.receipt.taskCounts, inspection.taskCounts);
  const importedRecords = {};
  for (const { id } of cases) {
    const mapping = firstReceipt.receipt.mappings.find((row) => row.sourceTaskId === id);
    assert.ok(mapping, `missing native destination identity for ${id}`);
    const view = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", mapping.destinationTaskId));
    const task = view.task;
    const expected = native[id];
    assert.equal(task.status, "In Design");
    const path = task.path.slice(".backlog/".length);
    assert.ok(path.startsWith("tasks/"), task.path);
    const markdown = readFileSync(join(store, path), "utf8");
    importedRecords[path] = markdown;
    assert.equal(task.title, expected.view.title);
    assert.equal(task.description, expected.view.description);
    assert.equal(task.implementationPlan, expected.view.design);
    assert.ok(task.implementationNotes.includes(expected.view.notes), "ordinary source notes remain readable alongside current metadata");
    assert.equal(task.dueDate, null, "defer_until must not become an active due date");
    assert.ok(Object.keys(task).every((field) => !/defer|snooze|wake/i.test(field)), "no active native deferral fields");
    assert.doesNotMatch(markdown.match(/^---\n([\s\S]*?)\n---/)[1], /^\s*(?:defer\w*|snooze\w*|\w*wake\w*):/im);
    assertCurrentBacklogTask(view, nativeCurrent[id], inspection,
      Object.fromEntries(firstReceipt.receipt.mappings.map((row) => [row.sourceTaskId, row.destinationTaskId])));
  }
  const destinationPaths = Object.keys(physicalDestinationRecords(store)).sort();
  const replay = await migrateTaskProvider(request);
  assert.equal(replay.status, "blocked", replay.detail);
  assert.equal(replay.code, "pre-cutover-failed");
  assert.match(replay.detail, /fixture refuses deferred source retirement/);
  assert.equal(retirements, 2, "exact replay must pass destination verification and reach the same guarded refusal");
  assert.ok(!runner.reads.some(({ args }) => ["history", "provenance"].includes(args[1])),
    "confirmation and same-destination replay must not read source history/provenance");
  const replayReceipt = readReceipt();
  assert.equal(replayReceipt.id, firstReceipt.id);
  assert.deepEqual(replayReceipt.receipt.mappings, firstReceipt.receipt.mappings, "replay must reuse all destination identities");
  assert.deepEqual(Object.keys(physicalDestinationRecords(store)).sort(), destinationPaths);
  for (const [path, markdown] of Object.entries(importedRecords)) assert.equal(readFileSync(join(store, path), "utf8"), markdown);
  assert.equal(git(store, "status", "--porcelain=v1"), "");
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
  assert.equal(detectTaskProvider(fixture.root, runner).code, "dual-providers", "pending destination must not silently replace source authority");
  assert.deepEqual(sourceAuthorityFiles(fixture.root), before);
  assert.equal(bd(fixture.root, "--readonly", "export", "--all"), exportBefore);
  assert.deepEqual(readNative(), native);
  assert.deepEqual(JSON.parse(bd(fixture.root, "--readonly", "statuses", "--json")), statusCatalog);
  assert.equal(git(fixture.root, "rev-parse", "HEAD"), sourceHead);
  assert.deepEqual(JSON.parse(bd(fixture.root, "--readonly", "dolt", "remote", "list", "--json")), []);
  assert.ok(runner.reads.every(({ args }) => !["ready", "defer", "undefer", "update"].includes(args[0] === "--readonly" ? args[1] : args[0])),
    "inspection, import and replay must not normalize or auto-wake retiring source tasks");
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
    if (entityKind === "draft") {
      bd(fixture.root, "update", id, "--status", "blocked", "--json");
    } else {
      bd(fixture.root, "close", id, "--reason", "Original archive lifecycle is retained in the exact prior source package", "--json");
    }
    expectedClass[id] = "archived";
  }
  const before = sourceAuthorityFiles(fixture.root);
  const native = Object.fromEntries(Object.keys(expectedClass).map((id) => [id, {
    view: JSON.parse(bd(fixture.root, "--readonly", "show", id, "--json", "--long", "--include-comments"))[0],
  }]));
  const nativeCurrent = captureBeadsCurrentTasks(fixture.root, Object.keys(expectedClass));
  class ArchivePublicationRunner extends AsIsBeadsRunner {
    constructor() { super(); this.destinationPublications = 0; }
    run(commandName, args, options = {}) {
      if (commandName === "backlog" && args[0] === "task" && args[1] === "view") {
        assert.equal(options.cwd, fixture.root, "native archive reads must use the real project, never a relocated clone");
      }
      assert.equal(commandName === "backlog" && args[0] === "task" && args[1] === "complete", false,
        "Done imports must not invoke the removed task complete command");
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
  const originalRecords = physicalDestinationRecords(store);
  for (const mapping of result.receipt.mappings) {
    const classification = expectedClass[mapping.sourceTaskId];
    const matching = paths.filter((path) => new RegExp(`^id:\\s*${mapping.destinationTaskId}\\s*$`, "m").test(readFileSync(join(store, path), "utf8")));
    assert.equal(matching.length, 1, `one physical destination task required for ${mapping.sourceTaskId}`);
    const physicalPath = matching[0];
    assert.ok(physicalPath.startsWith(classification === "archived" ? "archive/tasks/" : "tasks/"), physicalPath);
    const view = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", mapping.destinationTaskId));
    const task = view.task;
    const expected = native[mapping.sourceTaskId];
    assert.equal(task.path, `.backlog/${physicalPath}`, "native archived read must use the original path");
    assert.equal(task.status, ({ open: "In Design", in_progress: "In Progress", blocked: "Blocked", closed: "Done" })[expected.view.status]);
    assertCurrentBacklogTask(view, nativeCurrent[mapping.sourceTaskId], inspection,
      Object.fromEntries(result.receipt.mappings.map((row) => [row.sourceTaskId, row.destinationTaskId])));
  }
  assert.deepEqual(physicalDestinationRecords(store), originalRecords, "native readback must not relocate or rewrite archives");
  assert.equal(existsSync(join(store, "completed")), false, "ordinary closed imports stay active Done tasks");
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
  const native = Object.fromEntries(Object.values(fixture.ids).map((id) => [id, {
    view: JSON.parse(bd(fixture.root, "--readonly", "show", id, "--json", "--long", "--include-comments"))[0],
  }]));
  const nativeCurrent = captureBeadsCurrentTasks(fixture.root, Object.values(fixture.ids));
  const large = syntheticCurrentViewFile(fixture, native[fixture.ids.parent].view);
  native[fixture.ids.parent].view = large.view;
  nativeCurrent[fixture.ids.parent].nativeView = large.view;
  const owner = addActiveBeadsOwner(fixture);
  writeFileSync(join(owner.episode, "compatible-progress.txt"), "compatible active source progress\n");
  git(owner.episode, "add", "compatible-progress.txt");
  git(owner.episode, "commit", "-qm", "compatible later Episode implementation");
  git(owner.episode, "push", "-q");
  const laterHead = git(owner.episode, "rev-parse", "HEAD");
  class ForbiddenHistoryCurrentRunner extends AsIsBeadsRunner {
    run(commandName, args, options = {}) {
      if (commandName === "bd" && args[0] === "--readonly" && args[1] === "show" && args[2] === fixture.ids.parent) {
        assert.deepEqual(args, ["--readonly", "show", fixture.ids.parent, "--json", "--long", "--include-comments"]);
        const result = readSyntheticOutput(this, large.path, options);
        assert.equal(result.stdout, large.text);
        assert.deepEqual(JSON.parse(result.stdout), [large.view]);
        this.reads.push({ args: [...args], cwd: options.cwd, ...result });
        return result;
      }
      return super.run(commandName, args, options);
    }
  }
  const runner = new ForbiddenHistoryCurrentRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.deepEqual(inspection.activeOwnership, [{ ownerSessionId: owner.ownerSessionId, taskId: fixture.ids.parent }]);
  let runtimeProofs = 0;
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "embedded-migration-operator",
    semanticPlacement: "Preserve exact current native source data in Backlog.",
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
    const view = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", mapping.destinationTaskId));
    const task = view.task;
    const expected = native[mapping.sourceTaskId];
    const mappings = Object.fromEntries(result.receipt.mappings.map((row) => [row.sourceTaskId, row.destinationTaskId]));
    assertCurrentBacklogTask(view, nativeCurrent[mapping.sourceTaskId], inspection, mappings);
    assert.equal(task.status, ({ open: "In Design", in_progress: "In Progress", blocked: "Blocked" })[expected.view.status]);
    if (mapping.sourceTaskId === fixture.ids.parent) {
      assert.equal(task.description, expected.view.description);
      assert.equal(task.implementationPlan, expected.view.design);
      assert.deepEqual(task.assignees, ["@source-owner"]);
      assert.deepEqual(task.labels, ["current-label", "unicode-Ω"]);
      assert.equal(task.type.toLowerCase(), "bug");
      assert.equal(task.priority.toLowerCase(), "high");
      assert.equal(task.acceptanceCriteria.length, 1);
      const rawAcceptance = "Current acceptance Ω\nSecond source check";
      const acceptancePrefix = "Beads acceptance_criteria (exact JSON string): ";
      assert.equal(task.acceptanceCriteria[0].text, acceptancePrefix + JSON.stringify(rawAcceptance));
      assert.equal(JSON.parse(task.acceptanceCriteria[0].text.slice(acceptancePrefix.length)), rawAcceptance,
        "native criterion retains complete exact multiline source acceptance criteria");
      assert.equal(task.acceptanceCriteria[0].checked, false);
      assert.equal(task.comments.length, 1);
      assert.equal(task.comments[0].author, "source-author");
      assert.ok(task.comments[0].body.includes("embedded native comment Ω"));
      assert.ok(task.comments[0].body.includes(expected.view.comments[0].created_at));
      assert.equal(task.finalSummary, null, "source comment headings do not manufacture task closure");
      assertMeaningfulMetadataOnce(task, large.metadataText);
    }
    if (mapping.sourceTaskId === fixture.ids.child) assert.equal(task.parentTaskId, mappings[fixture.ids.parent]);
    if (mapping.sourceTaskId === fixture.ids.blocked) assert.deepEqual(task.dependencies, [mappings[fixture.ids.child]]);
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
  assert.ok(!runner.reads.some(({ args }) => ["history", "provenance"].includes(args[0] === "--readonly" ? args[1] : args[0])),
    "inspection, confirmation and active source recaptures must not read history/provenance");
  assert.deepEqual(runner.sourcePublicationCommands, []);
});

test("embedded source refuses mismatched active workspace identity and unreadable current native view before destination creation", { timeout: 180_000 }, async (t) => {
  for (const kind of ["active identity", "current view"]) {
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
            if (kind === "current view" && args[1] === "show") {
              refused = true;
              return { status: 1, stdout: "", stderr: "fixture cannot read required current native view" };
            }
          }
          return result;
        }
      }
      const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: new UnreadableSourceRunner() });
      assert.equal(refused, true);
      assert.equal(inspection.status, "blocked");
      assert.match(inspection.detail, kind === "current view" ? /cannot read required current native view/ : /source context.*store, database and mode/);
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

test("native Beads memory capture binds exact content without inspection writes", { timeout: 180_000 }, async (t) => {
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
  const issueReads = runner.reads.filter(({ args }) => args[1] === "show");
  assert.ok(issueReads.length > 0);
  assert.ok(issueReads.every(({ args }) => Object.values(fixture.ids).includes(args[2])),
    "native memory keys must never enter task show");
  assert.ok(!runner.reads.some(({ args }) => ["history", "provenance"].includes(args[1])));
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
  // Restored current content is independent of any old native history.
  const restored = inspect();
  assert.equal(restored.status, "ready", restored.detail);
  assert.equal(inspect().sourceRevision, restored.sourceRevision);
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

// Populated-destination admission preserves both stores until exact confirmation.
function admissionTree(path) {
  return Object.fromEntries(readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((item) => item.isDirectory()
      ? Object.entries(admissionTree(join(path, item.name))).map(([key, value]) => [`${item.name}/${key}`, value])
      : [[item.name, readFileSync(join(path, item.name)).toString("base64")]]));
}

// Native Done stays in tasks/. Only this fixture seeds a retained legacy archive
// by moving an already archived record, preserving its status and bytes.
function seedBacklogBaseline(root, store) {
  const create = (title, ...args) => backlog(root, "task", "create", title, ...args,
    "--no-dod-defaults", "--plain").match(/(?:BASE|DRAFT)-\d+(?:\.\d+)*/)[0];
  const active = create("Existing active", "--status", "In Progress", "--description", "existing description",
    "--plan", "existing plan", "--notes", "original notes");
  backlog(root, "task", "edit", active, "--comment", "existing native comment", "--comment-author", "baseline-author", "--plain");
  const completed = create("Existing completed", "--status", "Done", "--description", "ordinary closed baseline");
  const archived = create("Existing canonical archive", "--status", "In Planning", "--description", "original archive content",
    "--depends-on", completed);
  backlog(root, "task", "edit", archived, "--comment", "canonical archive comment", "--comment-author", "baseline-author", "--plain");
  backlog(root, "task", "archive", archived);
  const legacy = create("Existing legacy archive", "--status", "Done", "--description", "retained legacy archive content",
    "--depends-on", archived);
  backlog(root, "task", "edit", legacy, "--comment", "legacy archive comment", "--comment-author", "baseline-author", "--plain");
  backlog(root, "task", "archive", legacy);
  const legacyPath = JSON.parse(backlog(root, "task", "view", "--json", "--", legacy)).task.path;
  mkdirSync(join(root, store, "completed"), { recursive: true });
  renameSync(join(root, legacyPath), join(root, store, "completed", legacyPath.split("/").at(-1)));
  const draft = create("Existing draft", "--draft", "--description", "retained native draft content");
  backlog(root, "task", "edit", active, "--depends-on", `${archived},${draft}`, "--plain");
  const activePath = JSON.parse(backlog(root, "task", "view", "--json", "--", active)).task.path;
  return { active, completed, archived, legacy, draft, activePath };
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
  const { active, completed, archived, legacy, draft, activePath } = seedBacklogBaseline(fixture.root, store);
  git(fixture.root, "add", "-A");
  git(fixture.root, "commit", "-qm", "seed existing Backlog alongside Beads");
  const first = git(fixture.root, "rev-parse", "HEAD");
  backlog(fixture.root, "task", "edit", active, "--append-notes", "preserved second native revision");
  git(fixture.root, "add", "-A");
  git(fixture.root, "commit", "-qm", "existing Backlog history");
  git(fixture.root, "push", "-q");
  return { store, configPath, active, completed, archived, legacy, draft, activePath, first };
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


test("migration admission refuses contested Backlog IDs across active archive legacy and draft records before writes", { timeout: 240_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "contested-backlog-admission");
  const destination = coexistenceDestination(fixture, "backlog");
  const initial = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: RUNNER });
  assert.equal(initial.status, "ready", initial.detail);
  const archived = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", destination.archived)).task;
  const legacy = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", destination.legacy)).task;
  const source = { authority: sourceAuthorityFiles(fixture.root),
    export: bd(fixture.root, "--readonly", "export", "--all"),
    currentView: bd(fixture.root, "--readonly", "show", fixture.ids.parent, "--json", "--long", "--include-comments") };
  for (const [folder, taskId, originalId, originalPath] of [
    ["tasks", destination.active, destination.active, destination.activePath],
    ["archive/tasks", archived.id, archived.id, archived.path],
    ["completed", archived.id, archived.id, archived.path],
    ["completed", legacy.id, legacy.id, legacy.path],
    ["drafts", destination.active, destination.active, destination.activePath],
    ["archive/drafts", destination.active, destination.active, destination.activePath],
    ["tasks", "BASE-01", destination.active, destination.activePath],
  ]) {
    await t.test(`${folder} ${taskId}`, async () => {
      const relativePath = `backlog/${folder}/${taskId.toLowerCase()} - contested-copy.md`;
      const collisionPath = join(fixture.root, relativePath);
      mkdirSync(join(fixture.root, "backlog", folder), { recursive: true });
      writeFileSync(collisionPath, readFileSync(join(fixture.root, originalPath), "utf8").replace(/^id:.*$/m, `id: ${taskId}`));
      git(fixture.root, "add", relativePath);
      git(fixture.root, "commit", "-qm", `seed contested ${folder} identity`);
      git(fixture.root, "push", "-q");
      const runner = new AdmissionRunner();
      const before = admissionTree(join(fixture.root, "backlog"));
      const head = git(fixture.root, "rev-parse", "HEAD"), index = git(fixture.root, "ls-files", "--stage");
      const refs = git(fixture.root, "ls-remote", "--refs", fixture.remote);
      const excludes = readFileSync(join(fixture.root, ".git", "info", "exclude"), "utf8");
      const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
      const confirmation = await migrateTaskProvider({ cwd: fixture.root, targetProvider: "backlog", runner,
        expectedSourceRevision: initial.sourceRevision, confirmedSwitch: true, actor: "collision-operator",
        semanticPlacement: "Preserve all source and destination records; do not repair contested identity." });
      assert.equal(inspection.status, "ready", inspection.detail);
      assert.equal(inspection.sourceRevision, initial.sourceRevision, "inspection captures the outgoing Beads source as-is");
      assert.equal(confirmation.status, "blocked");
      const conflictPaths = [relativePath, originalPath].map((path) => path.slice("backlog/".length)).sort();
      const firstClaimId = conflictPaths[0] === relativePath.slice("backlog/".length) ? taskId : originalId;
      assert.equal(confirmation.detail,
        `Backlog destination repeats canonical task IDs: ${firstClaimId}: ${conflictPaths.join(", ")}`);
      assertNoAdmissionWrites(runner);
      assert.deepEqual(admissionTree(join(fixture.root, "backlog")), before);
      assert.deepEqual(sourceAuthorityFiles(fixture.root), source.authority);
      assert.equal(bd(fixture.root, "--readonly", "export", "--all"), source.export);
      assert.equal(bd(fixture.root, "--readonly", "show", fixture.ids.parent, "--json", "--long", "--include-comments"), source.currentView);
      assert.equal(git(fixture.root, "rev-parse", "HEAD"), head);
      assert.equal(git(fixture.root, "ls-files", "--stage"), index);
      assert.equal(git(fixture.root, "ls-remote", "--refs", fixture.remote), refs);
      assert.equal(readFileSync(join(fixture.root, ".git", "info", "exclude"), "utf8"), excludes);
      assert.equal(existsSync(join(fixture.root, ".backlog")), false);
      assert.equal(existsSync(join(fixture.root, ".beads")), true);
      assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
      rmSync(collisionPath);
      git(fixture.root, "add", relativePath);
      git(fixture.root, "commit", "-qm", "restore distinct-ID baseline after refusal");
      git(fixture.root, "push", "-q");
    });
  }
});


test("migration admission keeps malformed coexistence and unreadable source refusals before writes", { timeout: 180_000 }, (t) => {
  const fixture = embeddedBeadsSource(t, "admission-invalid");
  const destination = coexistenceDestination(fixture, "backlog");
  class UnreadableCurrentView extends AdmissionRunner {
    run(name, args, options) {
      const result = super.run(name, args, options);
      return name === "bd" && args[0] === "--readonly" && args[1] === "show"
        ? { status: 1, stdout: "", stderr: "fixture cannot read required current native view" } : result;
    }
  }
  const runner = new UnreadableCurrentView();
  const before = admissionTree(join(fixture.root, destination.store));
  const source = sourceAuthorityFiles(fixture.root);
  const unreadable = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(unreadable.status, "blocked");
  assert.match(unreadable.detail, /cannot read required current native view/);
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


// Independent native destination published before any migration attempt. Native
// allocation reserves IDs across active, canonical archive, legacy archive and drafts.
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
  const { active, completed, archived, legacy, draft } = seedBacklogBaseline(seed, "backlog");
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
  return { store, active, completed, archived, legacy, draft, baseline };
}


// Parked originals remain inactive code-owned history. Reconciliation must copy
// into the exact selected native store without replacing either task ancestry.
function parkedStoreTree(path) {
  if (!existsSync(path)) return null;
  const tree = {};
  for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === ".git") continue;
    const file = join(path, entry.name), stat = lstatSync(file);
    tree[entry.name] = { mode: stat.mode, ...(entry.isDirectory() ? { children: parkedStoreTree(file) }
      : entry.isSymbolicLink() ? { link: readlinkSync(file) } : { bytes: readFileSync(file).toString("base64") }) };
  }
  return tree;
}

function parkedStoreReconciliationFixture(t, name, { selected = ".backlog", clone = true, sameId = false } = {}) {
  const fixture = embeddedBeadsSource(t, `parked-${name}`);
  const original = coexistenceDestination(fixture, "backlog");
  const parked = join(fixture.root, "backlog"), configPath = join(parked, "config.yml");
  const config = readFileSync(configPath, "utf8")
    .replace(/^statuses:.*$/m, 'statuses: ["Triage", "In Design", "In Progress", "Blocked", "In Planning", "Done"]')
    .replace(/^default_status:.*$/m, 'default_status: "Triage"')
    .replace(/^auto_commit:.*$/m, "auto_commit: true")
    .replace(/^(?:types|priorities):.*\n/gm, "")
    + '\n# Retain parked operator customization, not bootstrap defaults.\noperator_extension: {opaque: [null, false, "Ω"]}\n'
    + 'types: ["Incident, Follow-up"]\npriorities: ["P4", "P1", "P0", "Very High, Almost"]\n';
  writeFileSync(configPath, config); chmodSync(configPath, 0o640);
  const pair = sameId ? seedSameIdOriginals(fixture.root, "backlog") : undefined;
  const nativeOriginals = sameId ? captureSameIdControls(fixture.root, "backlog", original) : undefined;
  const recordPaths = Object.keys(physicalDestinationRecords(parked));
  for (const path of recordPaths) if (!pair?.paths.includes(path)) chmodSync(join(parked, path), 0o640);
  mkdirSync(join(parked, "scripts"));
  writeFileSync(join(parked, "scripts", "retained.sh"), "#!/bin/sh\nprintf 'original attachment Ω\\n'\n");
  chmodSync(join(parked, "scripts", "retained.sh"), 0o750);
  renameSync(configPath, join(parked, "config.yml.pre-migration"));
  git(fixture.root, "add", "backlog"); git(fixture.root, "commit", "-qm", "park original native configuration without discarding history");
  git(fixture.root, "push", "-q");
  const codeHead = git(fixture.root, "rev-parse", "HEAD");
  // Native subtree split is only a task-only ancestry expectation; the original
  // code commits must not become ancestors of the independent task branch.
  const originalTaskHead = git(fixture.root, "subtree", "split", "--prefix=backlog", codeHead);
  assert.ok(git(fixture.root, "log", "--format=%H", originalTaskHead, "--", original.activePath.slice("backlog/".length)).split(/\r?\n/).length >= 2,
    "fixture carries two real revisions of the original active task");
  const sourceHistory = Object.fromEntries([...recordPaths, "config.yml.pre-migration", "scripts/retained.sh"].map(path => [path,
    git(fixture.root, "log", "--follow", "--format=fuller", "--binary", "-p", "--", `backlog/${path}`)]));
  const originalBlobs = Object.fromEntries(recordPaths.map(path => [path, command(fixture.root, "git", ["show", `${originalTaskHead}:${path}`])]));
  const seed = join(fixture.outer, "published-bootstrap"); mkdirSync(seed);
  command(seed, "git", ["init", "-q", "-b", "prime-claw/tasks"]);
  git(seed, "config", "user.name", "prime-claw"); git(seed, "config", "user.email", "prime-claw@localhost");
  writeFileSync(join(seed, "TASKS.md"), "# Prime Claw task history\n\nThis disconnected branch carries the provider-native Backlog task store.\n");
  const bootstrapConfig = initialTaskStoreConfig("repo") + (selected === ".backlog" ? "" : `backlog_directory: ${JSON.stringify(selected)}\n`);
  writeFileSync(join(seed, "config.yml"), bootstrapConfig);
  git(seed, "add", "TASKS.md", "config.yml"); git(seed, "commit", "-qm", "prime-claw: initialize task history");
  git(seed, "remote", "add", "origin", fixture.remote); git(seed, "push", "-qu", "origin", TASK_HISTORY_REF);
  const bootstrapHead = git(seed, "rev-parse", "HEAD"), store = join(fixture.root, selected);
  if (clone) {
    mkdirSync(join(store, ".."), { recursive: true });
    command(fixture.root, "git", ["clone", "-q", "--branch", "prime-claw/tasks", "--single-branch", fixture.remote, store]);
    git(store, "config", "user.name", "Existing Clone Author"); git(store, "config", "user.email", "existing-clone@example.invalid");
    symlinkSync(`${selected}/config.yml`, join(fixture.root, "backlog.config.yml"));
  }
  const ignorePath = join(fixture.root, ".gitignore"), ignore = readFileSync(ignorePath, "utf8");
  writeFileSync(ignorePath, `${ignore}${ignore.endsWith("\n") ? "" : "\n"}/${selected}/\n`);
  git(fixture.root, "add", ".gitignore", ...(clone ? ["backlog.config.yml"] : []));
  git(fixture.root, "commit", "-qm", "retain exact destination placement alongside parked originals"); git(fixture.root, "push", "-q");
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: new AsIsBeadsRunner() });
  assert.equal(inspection.status, "ready", inspection.detail);
  const identity = clone ? [store, join(store, ".git")].map(path => {
    const stat = lstatSync(path); return [realpathSync(path), stat.dev, stat.ino];
  }) : null;
  return { ...fixture, selected, store, seed, parked, original, config, recordPaths, codeHead, originalTaskHead, bootstrapHead,
    pair, nativeOriginals, sourceHistory, originalBlobs, identity, inspection, parkedBefore: parkedStoreTree(parked),
    cloneConfig: clone ? readFileSync(join(store, ".git", "config"), "utf8") : null,
    request: { cwd: fixture.root, targetProvider: "backlog", expectedSourceRevision: inspection.sourceRevision, confirmedSwitch: true,
      actor: "parked-store-fixture", semanticPlacement: "Retain inactive parked originals and both native task ancestries in the exact selected destination." } };
}

for (const variant of [
  { name: "published bootstrap without local clone", clone: false },
  { name: "existing hidden bootstrap clone", clone: true, activeOwner: true },
  { name: "existing custom bootstrap clone", clone: true, selected: "planning/task store" },
]) {
  test(`parked-store reconciliation preserves originals and both ancestries: ${variant.name}`, { timeout: 360_000 }, async t => {
    const f = parkedStoreReconciliationFixture(t, variant.name.replaceAll(" ", "-"), variant);
    const owner = variant.activeOwner ? addActiveBeadsOwner(f) : null;
    if (owner) {
      f.inspection = inspectTaskProviderMigration({ cwd: f.root, targetProvider: "backlog", runner: new AsIsBeadsRunner() });
      assert.equal(f.inspection.status, "ready", f.inspection.detail);
      f.request.expectedSourceRevision = f.inspection.sourceRevision;
    }
    const ownerBefore = owner ? {
      worktree: [realpathSync(owner.episode), lstatSync(owner.episode).dev, lstatSync(owner.episode).ino],
      session: readFileSync(owner.record.episodeSessionFile).toString("base64"),
      codeIndex: git(owner.episode, "ls-files", "--stage", "--", "README.md"),
      parked: parkedStoreTree(join(owner.episode, "backlog")),
    } : null;
    const nativeCurrent = captureBeadsCurrentTasks(f.root, Object.values(f.ids));
    const source = sourceAuthorityFiles(f.root);
    let retirementCalls = 0;
    const nativeIdentity = variant.clone ? null : {
      GIT_AUTHOR_NAME: "Synthetic Parked Store Author", GIT_AUTHOR_EMAIL: "parked-store-author@example.invalid",
      GIT_COMMITTER_NAME: "Synthetic Parked Store Committer", GIT_COMMITTER_EMAIL: "parked-store-committer@example.invalid",
    };
    const previousIdentity = nativeIdentity ? Object.fromEntries(Object.keys(nativeIdentity).map(key => [key, process.env[key]])) : null;
    let observed;
    try {
      if (nativeIdentity) Object.assign(process.env, nativeIdentity);
      observed = await observeCompletionMigration({ ...f.request, runner: new AsIsBeadsRunner(),
      ...(owner ? { verifyActiveRuntime: proveFixtureRuntime } : {}), deleteSource(snapshot) {
      retirementCalls++;
      assert.equal(snapshot.provider, "beads");
      assert.deepEqual(sourceAuthorityFiles(f.root), source, "source remains authoritative through destination proof");
      assert.deepEqual(parkedStoreTree(f.parked), f.parkedBefore, "inactive originals stay byte/mode/path exact before retirement");
      for (const path of f.recordPaths) assert.equal(readFileSync(join(f.store, path)).toString("base64"),
        readFileSync(join(f.parked, path)).toString("base64"), `original is consolidated before retirement: ${path}`);
      git(f.store, "merge-base", "--is-ancestor", f.bootstrapHead, "HEAD");
      git(f.store, "merge-base", "--is-ancestor", f.originalTaskHead, "HEAD");
      assert.equal(git(f.store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], git(f.store, "rev-parse", "HEAD"));
      rmSync(join(f.root, ".beads"), { recursive: true, force: true });
      rmSync(join(f.root, ".beads.gate.lock"), { force: true }); // this synthetic native source owns its adjacent lock
      } });
    } finally {
      if (previousIdentity) for (const [key, value] of Object.entries(previousIdentity)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
    const { result, requests } = observed;
    console.info(JSON.stringify({ parkedStoreCase: variant.name, status: result.status, detail: result.detail, retirementCalls,
      nativeWrites: requests.filter(row => ["POST", "PUT"].includes(row.method)).length }));
    assert.equal(result.status, "completed", result.detail); assert.equal(retirementCalls, 1);
    assert.deepEqual(parkedStoreTree(f.parked), f.parkedBefore, "parked store stays inactive and unchanged, never moved or deleted");
    assert.equal(existsSync(join(f.parked, "config.yml")), false); assert.equal(existsSync(join(f.parked, ".git")), false);
    assert.equal(git(f.root, "ls-files", "--", "backlog"), git(f.root, "ls-tree", "-r", "--name-only", f.codeHead, "--", "backlog"),
      "parked original paths remain code-owned, not detached or replaced");
    for (const [path, history] of Object.entries(f.sourceHistory)) {
      assert.equal(git(f.root, "log", "--follow", "--format=fuller", "--binary", "-p", "--", `backlog/${path}`), history, path);
      assert.equal(readFileSync(join(f.store, path)).toString("base64"), readFileSync(join(f.parked, path)).toString("base64"), path);
      assert.equal(lstatSync(join(f.store, path)).mode, lstatSync(join(f.parked, path)).mode, path);
    }
    git(f.store, "merge-base", "--is-ancestor", f.bootstrapHead, "HEAD");
    git(f.store, "merge-base", "--is-ancestor", f.originalTaskHead, "HEAD");
    assert.notEqual(new CandidateRunner().run("git", ["merge-base", "--is-ancestor", f.codeHead, "HEAD"],
      { cwd: f.store, allowFailure: true }).status, 0, "original code commits do not become task authority");
    assert.equal(command(f.store, "git", ["show", `${f.bootstrapHead}:TASKS.md`]), readFileSync(join(f.seed, "TASKS.md"), "utf8"));
    for (const [path, bytes] of Object.entries(f.originalBlobs)) assert.equal(command(f.store, "git", ["show", `${f.originalTaskHead}:${path}`]), bytes, path);
    const finalConfig = readFileSync(join(f.store, "config.yml"), "utf8");
    const withoutPlacement = value => value.replace(/^backlog(?:Directory|_directory):.*\n?/gm, "");
    assert.equal(withoutPlacement(finalConfig), withoutPlacement(f.config), "activate a copy of parked custom config, changing only native placement");
    assert.equal(lstatSync(join(f.store, "config.yml")).mode, lstatSync(join(f.parked, "config.yml.pre-migration")).mode);
    assert.equal(readlinkSync(join(f.root, "backlog.config.yml")), `${f.selected}/config.yml`);
    assert.equal(realpathSync(join(f.root, "backlog.config.yml")), realpathSync(join(f.store, "config.yml")));
    assert.equal(git(f.store, "remote"), "origin"); assert.equal(git(f.store, "remote", "get-url", "origin"), f.remote);
    assert.equal(git(f.store, "symbolic-ref", "--short", "HEAD"), "prime-claw/tasks");
    if (f.identity) {
      assert.deepEqual([f.store, join(f.store, ".git")].map(path => {
        const stat = lstatSync(path); return [realpathSync(path), stat.dev, stat.ino];
      }), f.identity, "reuse the exact selected clone, not a new clone");
      assert.equal(readFileSync(join(f.store, ".git", "config"), "utf8"), f.cloneConfig);
    }
    if (f.selected !== ".backlog") assert.equal(existsSync(join(f.root, ".backlog")), false, "no second destination");
    const mappings = Object.fromEntries(result.receipt.mappings.map(row => [row.sourceTaskId, row.destinationTaskId]));
    for (const row of result.receipt.mappings) {
      const view = JSON.parse(backlog(f.root, "task", "view", "--json", "--", row.destinationTaskId));
      assertCurrentBacklogTask(view, nativeCurrent[row.sourceTaskId], f.inspection, mappings,
        { priorities: ["P4", "P1", "P0", "Very High, Almost"], types: ["Incident, Follow-up"] });
      assert.equal(view.task.type, "Incident, Follow-up");
      assert.ok(!Object.values(f.original).includes(row.destinationTaskId), "native allocation reserves original task IDs");
    }
    const originalView = JSON.parse(backlog(f.root, "task", "view", "--json", "--", f.original.active)).task;
    assert.equal(originalView.path.startsWith(`${f.selected}/`), true); assert.match(originalView.implementationNotes, /preserved second native revision/);
    assert.equal(git(f.store, "status", "--porcelain=v1"), "");
    assert.equal(git(f.store, "rev-parse", "HEAD"), result.receipt.destinationReceiptRevision);
    assert.equal(existsSync(join(f.root, ".beads")), false);
    assert.equal(existsSync(join(f.root, ".beads.gate.lock")), false);
    if (owner) {
      const current = JSON.parse(readFileSync(join(f.root, ".prime-claw", "ownership.json"), "utf8")).owners[owner.ownerSessionId];
      assert.equal(current.provider, "backlog"); assert.equal(current.taskId, mappings[f.ids.parent]);
      for (const field of ["status", "ownerSessionId", "operationId", "engine", "baseRef", "createdAt", "worktree", "branch", "head", "episodeId", "episodeSessionFile", "episodeActiveSessionId"]) {
        assert.deepEqual(current[field], owner.record[field], `same Episode resource: ${field}`);
      }
      assert.deepEqual([realpathSync(owner.episode), lstatSync(owner.episode).dev, lstatSync(owner.episode).ino], ownerBefore.worktree);
      assert.equal(readFileSync(owner.record.episodeSessionFile).toString("base64"), ownerBefore.session);
      assert.equal(git(owner.episode, "ls-files", "--stage", "--", "README.md"), ownerBefore.codeIndex);
      assert.deepEqual(parkedStoreTree(join(owner.episode, "backlog")), ownerBefore.parked, "Episode's inactive parked tree is not adopted or rewritten");
      const episodeStore = join(owner.episode, f.selected);
      for (const path of [...f.recordPaths, "config.yml.pre-migration", "scripts/retained.sh", "config.yml"]) {
        assert.equal(readFileSync(join(episodeStore, path)).toString("base64"), readFileSync(join(f.store, path)).toString("base64"), `Episode current bytes: ${path}`);
        assert.equal(lstatSync(join(episodeStore, path)).mode, lstatSync(join(f.store, path)).mode, `Episode full native mode: ${path}`);
      }
      assert.equal(lstatSync(join(episodeStore, "config.yml")).mode & 0o777, 0o640);
      assert.equal(lstatSync(join(episodeStore, "scripts/retained.sh")).mode & 0o777, 0o750);
      assert.equal(readlinkSync(join(owner.episode, "backlog.config.yml")), `${f.selected}/config.yml`);
      assert.equal(git(episodeStore, "rev-parse", "HEAD"), result.receipt.destinationReceiptRevision);
      assert.equal(git(episodeStore, "remote", "get-url", "origin"), f.remote);
      for (const row of result.receipt.mappings) {
        const nativeView = JSON.parse(backlog(owner.episode, "task", "view", "--json", "--", row.destinationTaskId));
        assertCurrentBacklogTask(nativeView, nativeCurrent[row.sourceTaskId], f.inspection, mappings,
          { priorities: ["P4", "P1", "P0", "Very High, Almost"], types: ["Incident, Follow-up"] });
      }
      const episodeOriginal = JSON.parse(backlog(owner.episode, "task", "view", "--json", "--", f.original.active)).task;
      assert.deepEqual(episodeOriginal, originalView, "same selected-store native original view");
      const episodeHead = git(owner.episode, "rev-parse", "HEAD");
      git(owner.episode, "merge-base", "--is-ancestor", owner.episodeHead, episodeHead);
      assert.equal(git(owner.episode, "ls-remote", "--refs", "origin", "refs/heads/episode-beads-owner").split(/\s+/)[0], episodeHead);
      assert.equal(git(owner.episode, "status", "--porcelain=v1"), "");
      assert.equal(git(episodeStore, "status", "--porcelain=v1"), "");
    }
  });
}

for (const conflict of ["configuration", "physical path", "code ancestry"]) {
  test(`parked-store reconciliation refuses unresolved ${conflict} without changing either side`, { timeout: 240_000 }, async t => {
    const f = parkedStoreReconciliationFixture(t, `conflict-${conflict.replaceAll(" ", "-")}`);
    if (conflict === "configuration") {
      const path = join(f.store, "config.yml");
      writeFileSync(path, readFileSync(path, "utf8") + '\noperator_extension: "different selected user setting"\n');
      git(f.store, "add", "config.yml"); git(f.store, "commit", "-qm", "selected non-bootstrap configuration must not be overwritten");
    } else if (conflict === "physical path") {
      // Resolve configuration equivalence first, so this fixture isolates the
      // conflicting attachment rather than a separate custom-config choice.
      const selectedConfig = f.config.replace(/^backlog(?:Directory|_directory):.*\n?/gm, "")
        + `backlog_directory: ${JSON.stringify(f.selected)}\n`;
      writeFileSync(join(f.store, "config.yml"), selectedConfig);
      chmodSync(join(f.store, "config.yml"), lstatSync(join(f.parked, "config.yml.pre-migration")).mode & 0o777);
      mkdirSync(join(f.store, "scripts")); writeFileSync(join(f.store, "scripts", "retained.sh"), "different selected attachment\n");
      git(f.store, "add", "config.yml", "scripts/retained.sh"); git(f.store, "commit", "-qm", "equivalent config with selected physical path conflict, not a duplicate task ID");
    } else {
      git(f.store, "fetch", "-q", f.root, f.codeHead);
      const mixed = git(f.store, "commit-tree", `${f.bootstrapHead}^{tree}`, "-p", f.bootstrapHead, "-p", f.codeHead, "-m", "fixture task ref incorrectly shares code ancestry");
      git(f.store, "update-ref", TASK_HISTORY_REF, mixed, f.bootstrapHead);
    }
    git(f.store, "push", "-q", "origin", `HEAD:${TASK_HISTORY_REF}`);
    const before = { parked: parkedStoreTree(f.parked), selected: parkedStoreTree(f.store), head: git(f.store, "rev-parse", "HEAD"),
      index: git(f.store, "ls-files", "--stage"), codeHead: git(f.root, "rev-parse", "HEAD"), codeIndex: git(f.root, "ls-files", "--stage"),
      refs: git(f.root, "ls-remote", "--refs", f.remote), config: readFileSync(join(f.store, ".git", "config"), "utf8"),
      source: sourceAuthorityFiles(f.root), sourceExport: bd(f.root, "--readonly", "export", "--all"), link: readlinkSync(join(f.root, "backlog.config.yml")) };
    const runner = new AdmissionRunner(); let retirementCalls = 0;
    const { result, requests } = await observeCompletionMigration({ ...f.request, runner,
      deleteSource() { retirementCalls++; throw new Error("conflict must not reach source retirement"); } });
    assert.equal(result.status, "blocked", result.detail);
    if (conflict === "configuration") {
      assert.match(result.detail, /parked[\s\S]*config|config[\s\S]*parked/i);
      assert.match(result.detail, /conflict|disagree|different|overwrite|custom|bootstrap/i, "refuse the actual unresolved config choice");
    }
    else if (conflict === "physical path") assert.match(result.detail, /scripts\/retained\.sh/);
    else assert.match(result.detail, /shared[\s\S]*ancestry|code[\s\S]*ancestry|history[\s\S]*conflict/i);
    assert.equal(retirementCalls, 0); assert.equal(requests.some(row => ["POST", "PUT"].includes(row.method)), false);
    assert.equal(runner.calls.some(({ commandName, args }) => commandName === "backlog" && ["create", "edit", "archive", "delete", "init"].includes(args[1] ?? args[0])), false);
    assert.deepEqual(parkedStoreTree(f.parked), before.parked); assert.deepEqual(parkedStoreTree(f.store), before.selected);
    assert.equal(git(f.store, "rev-parse", "HEAD"), before.head); assert.equal(git(f.store, "ls-files", "--stage"), before.index);
    assert.equal(git(f.root, "rev-parse", "HEAD"), before.codeHead); assert.equal(git(f.root, "ls-files", "--stage"), before.codeIndex);
    assert.equal(git(f.root, "ls-remote", "--refs", f.remote), before.refs);
    assert.equal(readFileSync(join(f.store, ".git", "config"), "utf8"), before.config);
    assert.equal(readlinkSync(join(f.root, "backlog.config.yml")), before.link);
    assert.deepEqual(sourceAuthorityFiles(f.root), before.source); assert.equal(bd(f.root, "--readonly", "export", "--all"), before.sourceExport);
    assert.equal(existsSync(join(f.root, ".beads")), true);
  });
}

// Selected-existing configuration must not become a fresh canonical bootstrap.
function selectedMigrationConfigFixture(t, name, { missing = false, block = false, autoCommit = false, statuses: selectedStatuses } = {}) {
  const fixture = embeddedBeadsSource(t, name), destination = publishedPopulatedBacklogDestination(fixture);
  const path = join(destination.store, "config.yml");
  git(destination.store, "config", "user.name", "Config Fixture"); git(destination.store, "config", "user.email", "config@example.invalid");
  const statuses = selectedStatuses ?? (missing ? [block ? "Triage" : "Triage, Carefully", "In Planning", "Done"]
    : ["Triage", "in progress", "Ready for Merge", "Blocked", "In Planning", "In Design", "Done"]);
  const section = block ? `statuses:\n${statuses.map(value => `  - ${JSON.stringify(value)}`).join("\n")}\n`
    : `statuses: ${JSON.stringify(statuses)} # retain terminal column\n`;
  const config = readFileSync(path, "utf8").replace(/^statuses:.*\n/m, section + (block ? "# Retain the operator status comment outside the node.\n" : ""))
    .replace(/^default_status:.*$/m, `default_status: ${JSON.stringify(statuses[0])}`)
    .replace(/^auto_commit:.*$/m, `auto_commit: ${autoCommit}`)
    .replace(/^(?:types|priorities):.*\n/gm, "")
    + '# Keep operator extension keys and comments verbatim.\noperator_extension: {opaque: [null, false, "Ω"]}\n'
    + 'types: ["Incident, Follow-up"]\npriorities: ["P4", "P1", "P0", "Very High, Almost"]\n';
  writeFileSync(path, config); chmodSync(path, 0o640);
  git(destination.store, "add", "config.yml");
  git(destination.store, "-c", "user.name=Config Fixture", "-c", "user.email=config@example.invalid", "commit", "-qm", "publish selected native configuration");
  git(destination.store, "push", "-q");
  symlinkSync(".backlog/config.yml", join(fixture.root, "backlog.config.yml"));
  const ignorePath = join(fixture.root, ".gitignore"), ignore = readFileSync(ignorePath, "utf8");
  writeFileSync(ignorePath, `${ignore}${ignore.endsWith("\n") ? "" : "\n"}/.backlog/\n`);
  git(fixture.root, "add", ".gitignore", "backlog.config.yml"); git(fixture.root, "commit", "-qm", "select existing config"); git(fixture.root, "push", "-q");
  const files = Object.fromEntries([...git(destination.store, "ls-files").split(/\r?\n/), ".git/config"].map(file => [file, {
    bytes: readFileSync(join(destination.store, file)).toString("base64"), mode: lstatSync(join(destination.store, file)).mode,
    history: git(destination.store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", file),
  }]));
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: new AsIsBeadsRunner() });
  assert.equal(inspection.status, "ready", inspection.detail);
  const request = { cwd: fixture.root, targetProvider: "backlog", expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "selected-config-fixture", semanticPlacement: "Retain existing native configuration and current ticket meaning." };
  return { fixture, destination, path, config, statuses, section, files, request };
}

for (const variant of [
  { name: "complete flow", autoCommit: true, memories: true },
  { name: "missing flow", missing: true },
  { name: "missing block", missing: true, block: true, autoCommit: true, memories: true },
]) {
  test(`selected-existing migration preserves config and minimally adds statuses: ${variant.name}`, { timeout: 300_000 }, async t => {
    const f = selectedMigrationConfigFixture(t, `selected-config-${variant.name.replaceAll(" ", "-")}`, variant);
    if (variant.memories) bd(f.fixture.root, "remember", "One readable native memory Ω", "--key", "config-memory");
    // Memories change the confirmed source; recapture only before the request.
    const inspection = inspectTaskProviderMigration({ cwd: f.fixture.root, targetProvider: "backlog", runner: new AsIsBeadsRunner() });
    assert.equal(inspection.status, "ready", inspection.detail); f.request.expectedSourceRevision = inspection.sourceRevision;
    const identity = [f.destination.store, join(f.destination.store, ".git")].map(path => {
      const stat = lstatSync(path); return [realpathSync(path), stat.dev, stat.ino];
    });
    const originalHead = git(f.destination.store, "rev-parse", "HEAD");
    class NativeCommitRunner extends AsIsBeadsRunner {
      run(name, args, options = {}) {
        const receipt = name === "backlog" && args[0] === "task" && args[1] === "create" && args[2] === "Prime Claw task-provider migration receipt";
        const before = receipt && git(f.destination.store, "rev-parse", "HEAD");
        const result = super.run(name, args, options);
        if (receipt && result.status === 0) this.receiptNativeCommitted = before !== git(f.destination.store, "rev-parse", "HEAD");
        return result;
      }
    }
    const runner = new NativeCommitRunner(), result = await migrateTaskProvider({ ...f.request, runner });
    assert.equal(result.status, "completed", result.detail);
    assert.equal(runner.receiptNativeCommitted, variant.autoCommit === true, "preserved auto_commit controls native commits");
    const finalConfig = readFileSync(f.path, "utf8"), statusSection = finalConfig.match(/^statuses:.*(?:\n[ \t]+.*)*\n/m)[0];
    const statuses = [...statusSection.matchAll(/"(?:[^"\\]|\\.)*"/g)].map(match => JSON.parse(match[0]));
    if (!variant.missing) assert.equal(finalConfig, f.config, "complete custom configuration is byte-exact, not normalized");
    else {
      const missing = Object.entries(f.fixture.ids).sort(([, left], [, right]) => left.localeCompare(right))
        .map(([kind]) => ({ parent: "In Progress", child: "In Design", blocked: "Blocked" })[kind]);
      assert.deepEqual(statuses, [...f.statuses.slice(0, -1), ...missing, f.statuses.at(-1)],
        "insert only required misses in source encounter order without changing original first fallback or final Done");
      assert.equal(finalConfig.replace(statusSection, ""), f.config.replace(f.section, ""), "only the statuses section changes");
      assert.equal(statuses.includes("Ready for Merge"), false, "unused canonical statuses are not added");
      assert.ok(finalConfig.includes(variant.block ? "# Retain the operator status comment outside the node." : "# retain terminal column"));
    }
    for (const [file, before] of Object.entries(f.files)) {
      assert.equal(lstatSync(join(f.destination.store, file)).mode, before.mode, file);
      if (file === "config.yml" && variant.missing) continue;
      assert.equal(readFileSync(join(f.destination.store, file)).toString("base64"), before.bytes, file);
      assert.equal(git(f.destination.store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", file), before.history, file);
    }
    assert.deepEqual([f.destination.store, join(f.destination.store, ".git")].map(path => {
      const stat = lstatSync(path); return [realpathSync(path), stat.dev, stat.ino];
    }), identity);
    git(f.destination.store, "merge-base", "--is-ancestor", originalHead, "HEAD");
    const parentId = result.receipt.mappings.find(row => row.sourceTaskId === f.fixture.ids.parent).destinationTaskId;
    const parent = JSON.parse(backlog(f.fixture.root, "task", "view", "--json", "--", parentId)).task;
    assert.equal(parent.status, variant.missing ? "In Progress" : "in progress", "readback uses the configured native spelling without duplicate status");
    assert.equal(parent.type, "Incident, Follow-up"); assert.equal(parent.priority.toLowerCase(), "p1");
    const memory = result.receipt.backlogMemoryOutputs;
    if (variant.memories) {
      const user = JSON.parse(backlog(f.fixture.root, "task", "view", "--json", "--", memory.userTask.taskId)).task;
      assert.equal(user.status, "In Design", "USER is not silently placed in default Triage"); assert.equal(user.type, "Incident, Follow-up");
    } else assert.equal(memory, undefined);
    assert.equal(git(f.destination.store, "status", "--porcelain=v1"), "");
    assert.equal(git(f.destination.store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], result.receipt.destinationReceiptRevision);
    assert.equal(existsSync(join(f.fixture.root, ".beads")), false);
  });
}

// Native authoring supplies distinct records; only disposable fixture setup
// seeds a grandfathered ID which today's allocator cannot produce.
function createSameIdFixtureTask(root, title, description, archived = false) {
  const id = backlog(root, "task", "create", title, "--description", description,
    "--no-dod-defaults", "--plain").match(/\bBASE-\d+\b/)[0];
  if (archived) backlog(root, "task", "archive", id);
  const task = JSON.parse(backlog(root, "task", "view", "--json", "--", id)).task;
  assert.equal(task.archived, archived);
  return task;
}

function seedSameIdFixtureRecord(root, placement, task, id, mode) {
  const oldFile = join(root, task.path), oldPrefix = `${task.id.toLowerCase()} - `;
  const filename = task.path.split("/").at(-1);
  assert.ok(filename.startsWith(oldPrefix));
  const folder = task.archived ? "archive/tasks" : "tasks";
  assert.equal(task.path, `${placement}/${folder}/${filename}`);
  const path = `${folder}/${id.toLowerCase()} - ${filename.slice(oldPrefix.length)}`;
  const file = join(root, placement, path);
  const text = readFileSync(oldFile, "utf8"), oldIdLine = `id: ${task.id}\n`;
  assert.ok(text.includes(oldIdLine)); assert.equal(existsSync(file), false);
  renameSync(oldFile, file);
  writeFileSync(file, text.replace(oldIdLine, `id: ${id}\n`));
  chmodSync(file, mode);
  return path;
}

function seedSameIdOriginals(root, placement, liveTitle = "High live original") {
  const id = "BASE-12";
  const archive = createSameIdFixtureTask(root, "High archived original", "Distinct archive content Ω", true);
  const live = createSameIdFixtureTask(root, liveTitle, "Distinct live content λ");
  assert.equal(live.title, liveTitle);
  assert.deepEqual(live.references ?? [], []);
  assert.notEqual(live.id, archive.id);
  return { id, paths: [seedSameIdFixtureRecord(root, placement, live, id, 0o640),
    seedSameIdFixtureRecord(root, placement, archive, id, 0o750)] };
}

function assertNativeSameIdAmbiguity(root, placement, { id, paths }) {
  const result = RUNNER.run("backlog", ["task", "view", "--json", "--", id], { cwd: root, allowFailure: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ambiguous/);
  assert.ok(result.stderr.includes(id));
  for (const path of paths) assert.ok(result.stderr.includes(`${placement}/${path}`), path);
}

function captureSameIdControls(root, placement, original) {
  const views = [original.active, original.completed, original.archived, original.legacy].map(id => {
    const view = JSON.parse(backlog(root, "task", "view", "--json", "--", id));
    assert.ok(view.task.path.startsWith(`${placement}/`), view.task.path);
    return { ...view, task: { ...view.task, path: view.task.path.slice(placement.length + 1) } };
  });
  const draft = backlog(root, "draft", "view", original.draft, "--plain");
  assert.ok(draft.includes(`File: ${join(root, placement)}/`));
  return { views, draft: draft.replace(`File: ${join(root, placement)}/`, "File: ") };
}

function captureSameIdRecords(store) {
  return Object.fromEntries(Object.entries(physicalDestinationRecords(store)).map(([path, bytes]) =>
    [path, { bytes, mode: lstatSync(join(store, path)).mode }]));
}

function publishSameIdFixtureChanges(store, message) {
  git(store, "add", "-A", "--", "tasks", "archive/tasks");
  git(store, "commit", "-qm", message);
  git(store, "push", "-q", "origin", `HEAD:${TASK_HISTORY_REF}`);
  return git(store, "rev-parse", "HEAD");
}

class SameIdPublicationRunner extends AdmissionRunner {
  run(commandName, args, options = {}) {
    const result = super.run(commandName, args, options);
    if (commandName === "backlog" && args[0] === "task" && args[1] === "view" && result.status === 0) {
      const task = JSON.parse(result.stdout).task;
      if (task.title === "Prime Claw task-provider migration receipt" && task.status === "Done") this.completeReceiptTask = task;
    }
    return result;
  }
}

function publishedSameIdReceipt(runner, store, inspection) {
  const head = git(store, "rev-parse", "HEAD");
  assert.equal(git(store, "status", "--porcelain=v1"), "");
  assert.equal(git(store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], head);
  const task = runner.completeReceiptTask;
  assert.ok(task, "migration read back the completed native receipt before retirement");
  const receipt = JSON.parse(task.implementationNotes.match(/^```json\n([\s\S]+)\n```$/)[1]);
  assert.equal(receipt.sourceRevision, inspection.sourceRevision);
  assert.equal(receipt.sourceDigest, inspection.sourceDigest);
  assert.equal(receipt.mappings.length, inspection.taskCounts.total);
  return { head, task, receipt };
}

for (const variant of ["existing selected store", "parked originals in selected bootstrap"]) {
  test(`same-ID coexistence preserves unrelated originals and imports: ${variant}`, { timeout: 300_000 }, async t => {
    const parked = variant.startsWith("parked") ? parkedStoreReconciliationFixture(t, "same-id-pair", { sameId: true }) : null;
    const selected = parked ? null : selectedMigrationConfigFixture(t, "same-id-pair", {
      statuses: ["Triage", "In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"],
    });
    const fixture = parked ?? selected.fixture;
    const original = parked?.original ?? selected.destination;
    const store = parked?.store ?? original.store;
    const originals = parked?.parked ?? store;
    // A title can mention the exact source marker without claiming a source reference.
    const pair = parked?.pair ?? seedSameIdOriginals(fixture.root, ".backlog",
      `Document prime-claw-beads-source:${fixture.ids.parent} in the operator guide`);
    if (!parked) {
      // Backlog 1.55.3 accepts these native spellings without YAML quotes.
      for (const [index, metadata] of [
        'assignee: @live-owner\nreporter: @task-reporter',
        'assignee: [@archive-owner, "@second-owner"] # native inline list',
      ].entries()) {
        const file = join(store, pair.paths[index]);
        const markdown = readFileSync(file, "utf8");
        assert.match(markdown, /^assignee: \[\]$/m);
        writeFileSync(file, markdown.replace(/^assignee: \[\]$/m, metadata));
      }
    }
    const originalHead = parked?.originalTaskHead ?? publishSameIdFixtureChanges(store, "seed high live/archive pair in existing native history");
    const nativeOriginals = parked?.nativeOriginals ?? captureSameIdControls(fixture.root, ".backlog", original);
    const records = captureSameIdRecords(originals);
    const selectedHistory = parked ? {} : Object.fromEntries(Object.keys(records).map(path => [path,
      git(store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", path)]));
    assert.notEqual(records[pair.paths[0]].bytes, records[pair.paths[1]].bytes);
    assert.notEqual(records[pair.paths[0]].mode, records[pair.paths[1]].mode);
    if (!parked) assertNativeSameIdAmbiguity(fixture.root, ".backlog", pair);
    const source = sourceAuthorityFiles(fixture.root);
    const nativeCurrent = captureBeadsCurrentTasks(fixture.root, Object.values(fixture.ids));
    const runner = new SameIdPublicationRunner();
    const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
    assert.equal(inspection.status, "ready", inspection.detail);
    const request = parked?.request ?? selected.request;
    assert.equal(request.expectedSourceRevision, inspection.sourceRevision);
    let retirementCalls = 0, receiptAtRetirement;
    const { result, requests } = await observeCompletionMigration({ ...request, runner, deleteSource(snapshot) {
      retirementCalls++;
      assert.equal(snapshot.provider, "beads");
      assert.deepEqual(sourceAuthorityFiles(fixture.root), source);
      receiptAtRetirement = publishedSameIdReceipt(runner, store, inspection);
      const recordsAtRetirement = captureSameIdRecords(store);
      for (const [path, original] of Object.entries(records)) assert.deepEqual(recordsAtRetirement[path], original, path);
      git(store, "merge-base", "--is-ancestor", originalHead, receiptAtRetirement.head);
      git(store, "merge-base", "--is-ancestor", receiptAtRetirement.receipt.destinationDataRevision, receiptAtRetirement.head);
      if (parked) git(store, "merge-base", "--is-ancestor", parked.bootstrapHead, receiptAtRetirement.head);
      const mapping = Object.fromEntries(receiptAtRetirement.receipt.mappings.map(row => [row.sourceTaskId, row.destinationTaskId]));
      assert.deepEqual(Object.keys(mapping).sort(), Object.values(fixture.ids).sort());
      for (const [sourceId, id] of Object.entries(mapping)) {
        const view = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", id));
        assertCurrentBacklogTask(view, nativeCurrent[sourceId], inspection, mapping,
          { priorities: ["P4", "P1", "P0", "Very High, Almost"], types: ["Incident, Follow-up"] });
      }
      rmSync(join(fixture.root, ".beads"), { recursive: true, force: true });
      rmSync(join(fixture.root, ".beads.gate.lock"), { force: true });
    } });
    console.info(JSON.stringify({ sameIdCase: variant, status: result.status, detail: result.detail, retirementCalls,
      nativeWrites: requests.filter(row => row.method !== "GET").length }));
    assert.equal(result.status, "completed", result.detail);
    assert.equal(retirementCalls, 1);
    assert.equal(existsSync(join(fixture.root, ".beads")), false);
    assert.equal(existsSync(join(fixture.root, ".beads.gate.lock")), false);
    assert.equal(receiptAtRetirement.head, result.receipt.destinationReceiptRevision);
    assert.equal(receiptAtRetirement.task.id, result.receiptTaskId);
    assert.deepEqual(receiptAtRetirement.receipt.mappings, result.receipt.mappings);
    if (parked) assert.deepEqual(parkedStoreTree(originals), parked.parkedBefore);

    const after = captureSameIdRecords(store);
    for (const [path, original] of Object.entries(records)) {
      assert.deepEqual(after[path], original, `exact original path, bytes and mode: ${path}`);
      assert.equal(git(store, "diff", originalHead, "HEAD", "--", path), "", `unchanged original Git path: ${path}`);
      if (!parked) assert.equal(git(store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", path),
        selectedHistory[path], `unchanged original Git history: ${path}`);
    }
    assert.equal(Object.keys(after).length, Object.keys(records).length + inspection.taskCounts.total + 1);
    assertNativeSameIdAmbiguity(fixture.root, ".backlog", pair);
    assert.deepEqual(captureSameIdControls(fixture.root, ".backlog", original), nativeOriginals);
    for (const id of [original.active, original.completed, original.archived, original.legacy, original.draft,
      ...result.receipt.mappings.map(row => row.destinationTaskId)]) {
      assert.ok(runner.calls.some(({ commandName, args }) => commandName === "backlog" && args[1] === "view" && args.includes(id)),
        `migration still requires exact native evidence for unambiguous ${id}`);
    }
    const allocated = [result.receiptTaskId, ...result.receipt.mappings.map(row => row.destinationTaskId)];
    assert.equal(new Set(allocated).size, inspection.taskCounts.total + 1);
    const roots = allocated.map(id => {
      const match = /^BASE-(\d+)(?:\.\d+)*$/.exec(id);
      assert.ok(match, `native allocation must use the selected BASE prefix: ${allocated.join(", ")}`);
      return Number(match[1]);
    });
    assert.ok(allocated.includes("BASE-13"), `native allocation must issue the next top-level ID: ${allocated.join(", ")}`);
    assert.equal(Math.min(...roots), 13, "native allocation reserves the high pre-existing pair");
  });
}

test("same-ID coexistence refuses genuine migration references without a receipt", { timeout: 180_000 }, async t => {
  const f = selectedMigrationConfigFixture(t, "same-id-native-references");
  const { root, remote, ids } = f.fixture, { store } = f.destination;
  const runner = new AdmissionRunner();
  const inspection = inspectTaskProviderMigration({ cwd: root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.equal(inspection.sourceRevision, f.request.expectedSourceRevision);
  // Author an actual native source reference, without a receipt that could
  // independently trigger the ambiguity refusal.
  const archive = createSameIdFixtureTask(root, "Unrelated archive", "Distinct archive content", true);
  const live = createSameIdFixtureTask(root, "Partially imported live task", "Distinct live content");
  const ref = `prime-claw-beads-source:${ids.parent}`;
  backlog(root, "task", "edit", live.id, "--ref", ref, "--plain");
  assert.deepEqual(JSON.parse(backlog(root, "task", "view", "--json", "--", live.id)).task.references, [ref]);
  const id = "BASE-12";
  const pair = { id, paths: [seedSameIdFixtureRecord(root, ".backlog", live, id, 0o640),
    seedSameIdFixtureRecord(root, ".backlog", archive, id, 0o750)] };
  const head = publishSameIdFixtureChanges(store, "publish genuine native migration references on one same-ID member");
  assertNativeSameIdAmbiguity(root, ".backlog", pair);
  const records = captureSameIdRecords(store), remoteRefs = git(root, "ls-remote", "--refs", remote);
  const source = sourceAuthorityFiles(root), sourceExport = bd(root, "--readonly", "export", "--all");
  let retirementCalls = 0;
  const result = await migrateTaskProvider({ ...f.request, runner, deleteSource() {
    retirementCalls++;
    throw new Error("genuine same-ID reference reached source retirement");
  } });
  assert.equal(result.status, "blocked", result.detail);
  assert.ok(result.detail.includes(`Backlog migration target ${pair.id} is ambiguous`), result.detail);
  for (const path of pair.paths) assert.ok(result.detail.includes(path), result.detail);
  assert.equal(retirementCalls, 0);
  assertNoAdmissionWrites(runner);
  assert.deepEqual(captureSameIdRecords(store), records);
  assert.deepEqual(sourceAuthorityFiles(root), source);
  assert.equal(bd(root, "--readonly", "export", "--all"), sourceExport);
  assert.equal(git(store, "rev-parse", "HEAD"), head);
  assert.equal(git(store, "status", "--porcelain=v1"), "");
  assert.equal(git(root, "ls-remote", "--refs", remote), remoteRefs);
});

test("same-ID coexistence refuses replay targeting an ambiguous receipt-mapped import", { timeout: 300_000 }, async t => {
  const f = selectedMigrationConfigFixture(t, "same-id-targeted-replay");
  const { root, remote, ids } = f.fixture, { store } = f.destination;
  const original = createSameIdFixtureTask(root, "Unrelated archive for replay", "Never a migration output", true);
  publishSameIdFixtureChanges(store, "publish unrelated archived original before first migration");
  const runner = new SameIdPublicationRunner();
  const inspection = inspectTaskProviderMigration({ cwd: root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.equal(f.request.expectedSourceRevision, inspection.sourceRevision);
  const source = sourceAuthorityFiles(root);
  const sourceExport = bd(root, "--readonly", "export", "--all");
  let verified;
  const first = await migrateTaskProvider({ ...f.request, runner, deleteSource() {
    assert.deepEqual(sourceAuthorityFiles(root), source);
    verified = publishedSameIdReceipt(runner, store, inspection);
    throw new Error("fixture retains source at verified publication before targeted replay");
  } });
  assert.equal(first.status, "blocked", first.detail);
  assert.match(first.detail, /fixture retains source at verified publication before targeted replay/);
  const id = verified.receipt.mappings.find(row => row.sourceTaskId === ids.parent).destinationTaskId;
  const imported = JSON.parse(backlog(root, "task", "view", "--json", "--", id)).task;
  assert.ok(imported.references.includes(`prime-claw-beads-source:${ids.parent}`));
  const livePath = imported.path.slice(".backlog/".length);
  assert.ok(livePath.startsWith("tasks/"));
  const archivePath = seedSameIdFixtureRecord(root, ".backlog", original, id, 0o640);
  const driftHead = publishSameIdFixtureChanges(store, "seed an archival claimant of an exact receipt-mapped ID");
  assertNativeSameIdAmbiguity(root, ".backlog", { id, paths: [livePath, archivePath] });
  assert.deepEqual(JSON.parse(backlog(root, "task", "view", "--json", "--", verified.task.id)).task, verified.task);
  const records = captureSameIdRecords(store), config = readFileSync(f.path);
  const codeHead = git(root, "rev-parse", "HEAD"), codeIndex = git(root, "ls-files", "--stage");
  const refs = git(root, "ls-remote", "--refs", remote);
  let retirementCalls = 0;
  const replayRunner = new AdmissionRunner();
  const { result, requests } = await observeCompletionMigration({ ...f.request, runner: replayRunner, deleteSource() {
    retirementCalls++;
    throw new Error("unsafe ambiguous target reached source retirement");
  } });
  assert.equal(result.status, "blocked", result.detail);
  assert.match(result.detail, /ambiguous|repeats canonical task IDs/i);
  for (const value of [id, livePath, archivePath]) assert.ok(result.detail.includes(value), result.detail);
  assert.equal(retirementCalls, 0);
  assert.ok(requests.every(row => row.method === "GET"), "no Web writes in targeted replay");
  assertNoAdmissionWrites(replayRunner);
  assert.deepEqual(captureSameIdRecords(store), records);
  assert.deepEqual(readFileSync(f.path), config);
  assert.deepEqual(sourceAuthorityFiles(root), source);
  assert.equal(bd(root, "--readonly", "export", "--all"), sourceExport);
  assert.equal(git(store, "rev-parse", "HEAD"), driftHead);
  assert.equal(git(store, "status", "--porcelain=v1"), "");
  assert.equal(git(root, "ls-remote", "--refs", remote), refs);
  assert.equal(git(root, "rev-parse", "HEAD"), codeHead);
  assert.equal(git(root, "ls-files", "--stage"), codeIndex);
});

test("same-ID coexistence refuses a receipt-bound memory USER pair before selected layout preparation", { timeout: 300_000 }, async t => {
  const f = selectedMigrationConfigFixture(t, "same-id-memory-user-replay");
  const { root, remote } = f.fixture, { store } = f.destination;
  const archive = createSameIdFixtureTask(root, "Unrelated archive for memory replay", "No native migration references", true);
  assert.deepEqual(archive.references ?? [], []);
  publishSameIdFixtureChanges(store, "publish unrelated archived original before memory migration");
  bd(root, "remember", "A disposable public memory for the replay regression.", "--key", "public-replay-memory");
  const runner = new SameIdPublicationRunner();
  const inspection = inspectTaskProviderMigration({ cwd: root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  const request = { ...f.request, expectedSourceRevision: inspection.sourceRevision };
  const source = sourceAuthorityFiles(root), sourceExport = bd(root, "--readonly", "export", "--all");
  let verified;
  const first = await migrateTaskProvider({ ...request, runner, deleteSource() {
    assert.deepEqual(sourceAuthorityFiles(root), source);
    verified = publishedSameIdReceipt(runner, store, inspection);
    throw new Error("fixture retains source after verified memory receipt publication");
  } });
  assert.equal(first.status, "blocked", first.detail);
  assert.match(first.detail, /fixture retains source after verified memory receipt publication/);
  const { documents, index, userTask } = verified.receipt.backlogMemoryOutputs;
  assert.equal(documents.length, 1);
  assert.ok(index && userTask);
  const id = userTask.taskId;
  assert.notEqual(id, verified.task.id);
  assert.ok(verified.receipt.mappings.every(row => row.destinationTaskId !== id));
  const user = JSON.parse(backlog(root, "task", "view", "--json", "--", id)).task;
  assert.equal(user.path, userTask.path);
  assert.match(user.title, /^USER:/);
  assert.deepEqual(user.references ?? [], []);
  assert.deepEqual(user.documentation, [index.path]);
  const livePath = user.path.slice(".backlog/".length);
  assert.ok(livePath.startsWith("tasks/"));
  const archivePath = seedSameIdFixtureRecord(root, ".backlog", archive, id, 0o640);
  for (const path of [livePath, archivePath]) {
    assert.doesNotMatch(readFileSync(join(store, path), "utf8"), /prime-claw-beads-(?:source|current):/);
  }
  const driftHead = publishSameIdFixtureChanges(store, "publish same-ID archival claimant of receipt-bound memory USER task");

  // This clean, selected root config legitimately differs from the in-store
  // config. Unfixed confirmation adopts it (writes/publishes a new native
  // config and replaces the regular root file with a link) before rejecting
  // the receipt's ambiguous USER ID. The receipt itself is never forged.
  const rootConfig = join(root, "backlog.config.yml");
  assert.equal(readlinkSync(rootConfig), ".backlog/config.yml");
  rmSync(rootConfig);
  const nestedConfig = readFileSync(f.path, "utf8").replace(/^(?:backlog_directory|backlogDirectory):[^\r\n]*(?:\r?\n|$)/gm, "");
  writeFileSync(rootConfig, `${nestedConfig.trimEnd()}\nbacklog_directory: ".backlog"\n# Preserve selected root authority.\n`);
  chmodSync(rootConfig, 0o640);
  git(root, "add", "backlog.config.yml");
  git(root, "commit", "-qm", "publish independent regular root authority for selected replay");
  git(root, "push", "-q");
  assert.equal(existsSync(join(store, "backlog.config.yml")), false);
  const selected = detectExplicitTaskProvider(root, "backlog", RUNNER);
  assert.equal(selected.kind, "selected", selected.detail);
  assert.equal(selected.evidence.configSource, "root");
  assert.equal(selected.evidence.storeDir, store);
  assertNativeSameIdAmbiguity(root, ".backlog", { id, paths: [livePath, archivePath] });
  const readReceipt = () => JSON.parse(backlog(root, "task", "view", "--json", "--", verified.task.id)).task.implementationNotes;
  assert.equal(readReceipt(), verified.task.implementationNotes);

  const identity = path => { const stat = lstatSync(path); return [realpathSync(path), stat.dev, stat.ino, stat.mode]; };
  const snapshot = () => ({
    rootConfig: readFileSync(rootConfig), rootConfigIdentity: identity(rootConfig),
    layout: parkedStoreTree(store), storeIdentity: identity(store), storeGitIdentity: identity(join(store, ".git")),
    codeIgnore: readFileSync(join(root, ".gitignore")), codeExclude: readFileSync(join(root, ".git", "info", "exclude")),
    codeHead: git(root, "rev-parse", "HEAD"), codeIndex: git(root, "ls-files", "--stage"),
    codeRefs: git(root, "show-ref"), codeStatus: git(root, "status", "--porcelain=v1"),
    storeHead: git(store, "rev-parse", "HEAD"), storeIndex: git(store, "ls-files", "--stage"),
    storeRefs: git(store, "show-ref"), storeStatus: git(store, "status", "--porcelain=v1"),
    storeGitConfig: readFileSync(join(store, ".git", "config")), remoteRefs: git(root, "ls-remote", "--refs", remote),
  });
  const before = snapshot();
  assert.equal(before.codeStatus, "", "must exercise clean selected-store replay, not dirty-layout replay");
  assert.equal(before.storeStatus, "");
  assert.equal(before.storeHead, driftHead);
  assert.equal(git(store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], driftHead);
  let retirementCalls = 0;
  const replayRunner = new AdmissionRunner();
  const { result, requests } = await observeCompletionMigration({ ...request, runner: replayRunner, deleteSource() {
    retirementCalls++;
    throw new Error("unsafe memory USER replay reached source retirement");
  } });
  assert.equal(result.status, "blocked", result.detail);
  assert.ok(result.detail.includes(`Backlog migration target ${id} is ambiguous`), result.detail);
  for (const path of [livePath, archivePath]) assert.ok(result.detail.includes(path), result.detail);
  assert.equal(retirementCalls, 0);
  assert.ok(lstatSync(rootConfig).isFile(), "refusal must precede relocation of the regular root configuration");
  assert.deepEqual(snapshot(), before, "refusal must leave code layout, native files, Git indexes and both publications exact");
  assert.ok(requests.every(row => row.method === "GET"), "no Web writes in memory USER replay");
  assertNoAdmissionWrites(replayRunner);
  assert.equal(readReceipt(), verified.task.implementationNotes);
  assert.deepEqual(sourceAuthorityFiles(root), source);
  assert.equal(bd(root, "--readonly", "export", "--all"), sourceExport);
});

function addSourceCompletionDependency(fixture) {
  const closed = JSON.parse(bd(fixture.root, "create", "Source completion C", "--description", "Complete current source ticket C.", "--json")).id;
  const dependent = JSON.parse(bd(fixture.root, "create", "Open dependent D", "--description", "Open D depends only on completed C.", "--json")).id;
  bd(fixture.root, "dep", "add", dependent, closed);
  bd(fixture.root, "close", closed, "--reason", "Source C is complete; dependent D stays open.", "--json");
  return { closed, dependent };
}

// Count actual owned HTTP requests without changing persistence or responses.
async function observeCompletionMigration(request) {
  const originalRequest = http.request, requests = [];
  http.request = function (...args) {
    requests.push({ url: String(args[0]), method: args[1]?.method ?? "GET" });
    return originalRequest.apply(this, args);
  };
  syncBuiltinESMExports();
  try { return { result: await migrateTaskProvider(request), requests }; }
  finally { http.request = originalRequest; syncBuiltinESMExports(); }
}

for (const variant of [
  { name: "complete supported list", statuses: ["Triage", "In Design", "In Progress", "Blocked", "Done", "Cancelled"] },
  { name: "missing active statuses", statuses: ["Triage", "Done", "Cancelled"] },
  { name: "unsupported native flow", statuses: ["Triage", "In Design", "In Progress", "Blocked", "Done", "Cancelled"], unsupported: true },
  { name: "first canonical spelling differs internally from terminal", statuses: ["Triage", "In Design", "In Progress", "Blocked", "D o n e", "Done"] },
]) {
  test(`selected-existing source completion refuses before writes: ${variant.name}`, { timeout: 240_000 }, async t => {
    const f = selectedMigrationConfigFixture(t, `completion-${variant.name.replaceAll(" ", "-")}`, variant);
    const sourceIds = addSourceCompletionDependency(f.fixture);
    const closed = JSON.parse(bd(f.fixture.root, "--readonly", "show", sourceIds.closed, "--json", "--long", "--include-comments"))[0];
    const dependent = JSON.parse(bd(f.fixture.root, "--readonly", "show", sourceIds.dependent, "--json", "--long", "--include-comments"))[0];
    assert.equal(closed.status, "closed"); assert.equal(dependent.status, "open");
    assert.ok(dependent.dependencies.some(row => (typeof row === "string" ? row : row.depends_on_id ?? row.id ?? row.issue_id) === sourceIds.closed));
    if (variant.unsupported) {
      const node = `statuses: [${variant.statuses.map(value => `'${value}'`).join(", ")}] # retain terminal column\n`;
      f.config = f.config.replace(f.section, node); writeFileSync(f.path, f.config);
      git(f.destination.store, "add", "config.yml"); git(f.destination.store, "commit", "-qm", "retain native single-quoted flow"); git(f.destination.store, "push", "-q");
    }
    const inspection = inspectTaskProviderMigration({ cwd: f.fixture.root, targetProvider: "backlog", runner: new AsIsBeadsRunner() });
    assert.equal(inspection.status, "ready", inspection.detail); f.request.expectedSourceRevision = inspection.sourceRevision;
    const source = sourceAuthorityFiles(f.fixture.root), sourceExport = bd(f.fixture.root, "--readonly", "export", "--all");
    const records = physicalDestinationRecords(f.destination.store), head = git(f.destination.store, "rev-parse", "HEAD"), mode = lstatSync(f.path).mode;
    const codeHead = git(f.fixture.root, "rev-parse", "HEAD"), codeIndex = git(f.fixture.root, "ls-files", "--stage");
    const originals = Object.fromEntries(Object.keys(f.files).map(file => [file, {
      bytes: readFileSync(join(f.destination.store, file)).toString("base64"), mode: lstatSync(join(f.destination.store, file)).mode,
      history: git(f.destination.store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", file),
    }]));
    let deletions = 0;
    const { result, requests } = await observeCompletionMigration({ ...f.request, runner: new AsIsBeadsRunner(),
      deleteSource() { deletions += 1; throw new Error("completion fixture retains source if unsafe cutover is reached"); } });
    console.info(JSON.stringify({ completionCase: variant.name, status: result.status, detail: result.detail, deletions,
      nativeWrites: requests.filter(row => ["POST", "PUT"].includes(row.method)).length,
      startupConfigReads: requests.filter(row => row.url.endsWith("/api/config")).length, configUnchanged: readFileSync(f.path, "utf8") === f.config }));
    assert.equal(result.status, "blocked", result.detail);
    assert.match(result.detail, /source.*Done.*native terminal.*placement/i, "must detect completion meaning, not a later unrelated failure");
    assert.equal(deletions, 0); assert.equal(requests.some(row => ["POST", "PUT"].includes(row.method)), false, "no native allocation or update");
    assert.equal(requests.filter(row => row.url.endsWith("/api/config")).length, variant.unsupported ? 1 : 0,
      "bounded lists refuse before startup/list edits; unsupported form uses the ONE owned native startup list");
    assert.equal(readFileSync(f.path, "utf8"), f.config); assert.equal(lstatSync(f.path).mode, mode);
    assert.equal(git(f.destination.store, "rev-parse", "HEAD"), head); assert.equal(git(f.destination.store, "status", "--porcelain=v1"), "");
    assert.equal(git(f.destination.store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], head);
    for (const [file, before] of Object.entries(originals)) {
      assert.equal(readFileSync(join(f.destination.store, file)).toString("base64"), before.bytes, file);
      assert.equal(lstatSync(join(f.destination.store, file)).mode, before.mode, file);
      assert.equal(git(f.destination.store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", file), before.history, file);
    }
    assert.deepEqual(physicalDestinationRecords(f.destination.store), records); assert.deepEqual(sourceAuthorityFiles(f.fixture.root), source);
    assert.equal(bd(f.fixture.root, "--readonly", "export", "--all"), sourceExport);
    assert.equal(git(f.fixture.root, "rev-parse", "HEAD"), codeHead); assert.equal(git(f.fixture.root, "ls-files", "--stage"), codeIndex);
    assert.equal(readlinkSync(join(f.fixture.root, "backlog.config.yml")), ".backlog/config.yml");
  });
}

test("selected-existing receipt-only Done does not impose universal terminal placement", { timeout: 300_000 }, async t => {
  const f = selectedMigrationConfigFixture(t, "receipt-only-nonterminal-done", {
    statuses: ["Triage", "In Design", "In Progress", "Blocked", "Done", "Cancelled"], autoCommit: true,
  });
  const rows = bd(f.fixture.root, "--readonly", "export", "--all").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  assert.ok(rows.every(row => !["closed", "done"].includes(row.status)), "no actual source issue maps to Done");
  const result = await migrateTaskProvider({ ...f.request, runner: new AsIsBeadsRunner() });
  assert.equal(result.status, "completed", result.detail); assert.equal(readFileSync(f.path, "utf8"), f.config);
  assert.equal(JSON.parse(backlog(f.fixture.root, "task", "view", "--json", "--", result.receiptTaskId)).task.status, "Done");
  assert.equal(existsSync(join(f.fixture.root, ".beads")), false);
  for (const [file, before] of Object.entries(f.files)) {
    assert.equal(readFileSync(join(f.destination.store, file)).toString("base64"), before.bytes, file);
    assert.equal(lstatSync(join(f.destination.store, file)).mode, before.mode, file);
    assert.equal(git(f.destination.store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", file), before.history, file);
  }
});

test("selected-existing source completion replay refuses without config repair or reuse cutover", { timeout: 600_000 }, async t => {
  for (const placement of ["selected existing", "fresh dirty layout"]) await t.test(placement, async t => {
    const selected = placement === "selected existing" ? selectedMigrationConfigFixture(t, "completion-replay-selected") : undefined;
    const fixture = selected?.fixture ?? embeddedBeadsSource(t, "completion-replay-fresh");
    addSourceCompletionDependency(fixture);
    const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: new AsIsBeadsRunner() });
    assert.equal(inspection.status, "ready", inspection.detail);
    const request = { cwd: fixture.root, targetProvider: "backlog", runner: new AsIsBeadsRunner(), expectedSourceRevision: inspection.sourceRevision,
      confirmedSwitch: true, actor: "completion-replay", semanticPlacement: "Preserve source completion and original native configuration." };
    const first = await migrateTaskProvider({ ...request, deleteSource() { throw new Error("retain complete destination and authoritative source for replay fixture"); } });
    assert.equal(first.status, "blocked", first.detail); assert.match(first.detail, /retain complete destination and authoritative source/);
    const store = join(fixture.root, ".backlog"), path = join(store, "config.yml");
    const config = readFileSync(path, "utf8").replace(/^statuses:.*$/m, 'statuses: ["Triage", "In Design", "In Progress", "Blocked", "Done", "Cancelled"]');
    writeFileSync(path, config); git(store, "add", "config.yml");
    git(store, "-c", "user.name=Replay Fixture", "-c", "user.email=replay@example.invalid", "commit", "-qm", "published operator terminal change after receipt");
    git(store, "push", "-q", "origin", `HEAD:${TASK_HISTORY_REF}`);
    const head = git(store, "rev-parse", "HEAD"), mode = lstatSync(path).mode, records = physicalDestinationRecords(store), source = sourceAuthorityFiles(fixture.root);
    const codeHead = git(fixture.root, "rev-parse", "HEAD"), codeIndex = git(fixture.root, "ls-files", "--stage");
    let deletions = 0;
    const { result, requests } = await observeCompletionMigration({ ...request,
      deleteSource() { deletions += 1; throw new Error("unsafe replay reached source retirement"); } });
    console.info(JSON.stringify({ completionReplay: placement, status: result.status, detail: result.detail, deletions }));
    assert.equal(result.status, "blocked", result.detail); assert.match(result.detail, /source.*Done.*native terminal.*placement/i);
    assert.equal(requests.filter(row => row.url.endsWith("/api/config")).length, 1, "replay checks the owned native startup list");
    assert.equal(requests.some(row => ["POST", "PUT"].includes(row.method)), false); assert.equal(deletions, 0);
    assert.equal(readFileSync(path, "utf8"), config); assert.equal(lstatSync(path).mode, mode);
    assert.deepEqual(physicalDestinationRecords(store), records); assert.deepEqual(sourceAuthorityFiles(fixture.root), source);
    assert.equal(git(store, "rev-parse", "HEAD"), head); assert.equal(git(store, "status", "--porcelain=v1"), "");
    assert.equal(git(store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], head);
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), codeHead); assert.equal(git(fixture.root, "ls-files", "--stage"), codeIndex);
  });
});

test("selected-existing sparse config refuses before native normalization and preserves original bytes and modes", { timeout: 180_000 }, async t => {
  const f = selectedMigrationConfigFixture(t, "selected-sparse-config");
  const sparse = f.config.replace(/^auto_commit:.*\n/m, ""); writeFileSync(f.path, sparse);
  git(f.destination.store, "add", "config.yml");
  git(f.destination.store, "-c", "user.name=Config Fixture", "-c", "user.email=config@example.invalid", "commit", "-qm", "retain sparse operator configuration"); git(f.destination.store, "push", "-q");
  const mode = lstatSync(f.path).mode, source = sourceAuthorityFiles(f.fixture.root), records = physicalDestinationRecords(f.destination.store);
  class NoNativeReads extends AsIsBeadsRunner {
    run(name, args, options = {}) {
      if (name === "backlog") { this.backlogReads = (this.backlogReads ?? 0) + 1; throw new Error("unsafe config reached native Backlog"); }
      return super.run(name, args, options);
    }
  }
  let deletions = 0; const runner = new NoNativeReads();
  const result = await migrateTaskProvider({ ...f.request, runner, deleteSource() { deletions += 1; } });
  assert.equal(runner.backlogReads ?? 0, 0, "unsafe config must stop before ANY native Backlog read");
  assert.equal(result.status, "blocked", result.detail); assert.match(result.detail, /config|normaliz|auto.?commit/i);
  assert.equal(readFileSync(f.path, "utf8"), sparse); assert.equal(lstatSync(f.path).mode, mode);
  assert.deepEqual(physicalDestinationRecords(f.destination.store), records); assert.deepEqual(sourceAuthorityFiles(f.fixture.root), source);
  assert.equal(readlinkSync(join(f.fixture.root, "backlog.config.yml")), ".backlog/config.yml"); assert.equal(deletions, 0);
});

for (const [name, node, unknown] of [
  ["multiline quoted scalar", 'statuses:\n  - "Triage"\n  - "Review\n    Carefully"\n  - "In Planning"\n  - "Done"\n', ""],
  ["anchor referenced by unknown key", 'statuses:\n  - "Triage"\n  - &status_alias "Review Carefully"\n  - "In Planning"\n  - "Done"\n', "operator_status_alias: *status_alias\n"],
]) {
  test(`selected-existing complex status block refuses without mutation: ${name}`, { timeout: 180_000 }, async t => {
    const f = selectedMigrationConfigFixture(t, `selected-config-complex-${name.replaceAll(" ", "-")}`, { missing: true, block: true });
    const config = f.config.replace(f.section, node) + unknown; writeFileSync(f.path, config);
    git(f.destination.store, "add", "config.yml");
    git(f.destination.store, "commit", "-qm", "retain valid complex native YAML status node"); git(f.destination.store, "push", "-q");
    const mode = lstatSync(f.path).mode, head = git(f.destination.store, "rev-parse", "HEAD");
    const records = physicalDestinationRecords(f.destination.store), source = sourceAuthorityFiles(f.fixture.root);
    let deletions = 0;
    const result = await migrateTaskProvider({ ...f.request, runner: new AsIsBeadsRunner(), deleteSource() { deletions += 1; } });
    assert.equal(result.status, "blocked", result.detail); assert.match(result.detail, /simple one-line scalar block items|complete simple sequence/);
    assert.equal(readFileSync(f.path, "utf8"), config); assert.equal(lstatSync(f.path).mode, mode);
    assert.equal(git(f.destination.store, "rev-parse", "HEAD"), head, "no status rewrite or import commit");
    assert.deepEqual(physicalDestinationRecords(f.destination.store), records, "no imports or cleanup of originals");
    assert.deepEqual(sourceAuthorityFiles(f.fixture.root), source); assert.equal(deletions, 0);
    assert.equal(readlinkSync(join(f.fixture.root, "backlog.config.yml")), ".backlog/config.yml");
    assert.equal(git(f.destination.store, "status", "--porcelain=v1"), "");
  });
}

test("selected-existing original config drift during import refuses without source retirement or cleanup", { timeout: 240_000 }, async t => {
  const f = selectedMigrationConfigFixture(t, "selected-config-drift"), source = sourceAuthorityFiles(f.fixture.root);
  const originals = physicalDestinationRecords(f.destination.store);
  class DriftRunner extends AsIsBeadsRunner {
    run(name, args, options = {}) {
      const result = super.run(name, args, options);
      if (!this.drifted && name === "backlog" && args[0] === "task" && args[1] === "create" && args[2] === "Prime Claw task-provider migration receipt" && result.status === 0) {
        this.drifted = true; writeFileSync(f.path, readFileSync(f.path, "utf8") + "# Concurrent operator config edit must remain.\n");
      }
      return result;
    }
  }
  const runner = new DriftRunner(); let deletions = 0;
  const result = await migrateTaskProvider({ ...f.request, runner, deleteSource() { deletions += 1; } });
  assert.equal(runner.drifted, true); assert.equal(result.status, "blocked", result.detail);
  assert.match(result.detail, /baseline|config|original/i); assert.equal(deletions, 0);
  assert.match(readFileSync(f.path, "utf8"), /Concurrent operator config edit must remain/);
  assert.deepEqual(sourceAuthorityFiles(f.fixture.root), source);
  for (const [file, before] of Object.entries(f.files)) if (file !== "config.yml") assert.equal(readFileSync(join(f.destination.store, file)).toString("base64"), before.bytes, file);
  assert.ok(Object.keys(physicalDestinationRecords(f.destination.store)).length > Object.keys(originals).length, "accepted partial imports are retained, not cleaned up");
});

test("native populated Backlog allocation reserves archived IDs and accepts archived and draft dependencies", { timeout: 180_000 }, (t) => {
  const fixture = repository(t, "native-populated-allocation");
  const destination = publishedPopulatedBacklogDestination(fixture);
  const { store } = destination;
  console.info(`native Backlog version: ${backlog(fixture.root, "--version")}`);
  assert.deepEqual([destination.active, destination.completed, destination.archived, destination.legacy, destination.draft],
    ["BASE-1", "BASE-2", "BASE-3", "BASE-4", "DRAFT-1"]);
  const rootHead = git(fixture.root, "rev-parse", "HEAD"), rootIndex = git(fixture.root, "ls-files", "--stage");
  const storeHead = git(store, "rev-parse", "HEAD"), storeIndex = git(store, "ls-files", "--stage");
  const identity = { gitDir: realpathSync(join(store, ".git")), config: readFileSync(join(store, ".git", "config"), "utf8"),
    branch: git(store, "symbolic-ref", "HEAD") };
  const refs = git(fixture.root, "ls-remote", "--refs", fixture.remote);
  const exclude = readFileSync(join(fixture.root, ".git", "info", "exclude"), "utf8");
  const originalRecords = physicalDestinationRecords(store);
  for (const [id, status, folder] of [
    [destination.completed, "Done", "tasks/"],
    [destination.archived, "In Planning", "archive/tasks/"],
    [destination.legacy, "Done", "completed/"],
  ]) {
    const task = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", id)).task;
    assert.equal(task.status, status);
    assert.ok(task.path.startsWith(`.backlog/${folder}`), task.path);
  }
  assert.match(backlog(fixture.root, "draft", "view", destination.draft, "--plain"), /retained native draft content/);
  assert.deepEqual(physicalDestinationRecords(store), originalRecords, "native in-place readback leaves every baseline record unchanged");
  const beforeOverride = admissionTree(store);
  const override = RUNNER.run("backlog", ["task", "create", "Unsupported literal ID", "--id", "BASE-99", "--plain"],
    { cwd: fixture.root, allowFailure: true });
  assert.notEqual(override.status, 0);
  assert.match(`${override.stdout}\n${override.stderr}`, /unknown option.*--id/i);
  assert.deepEqual(admissionTree(store), beforeOverride, "unsupported --id must refuse before destination writes");
  const imported = backlog(fixture.root, "task", "create", "Prospective imported task", "--status", "In Progress",
    "--no-dod-defaults", "--plain").match(/BASE-\d+/)[0];
  assert.equal(imported, "BASE-5", "native allocation must reserve both archive IDs");
  const targets = [destination.archived, destination.legacy, destination.draft];
  const dependency = RUNNER.run("backlog", ["task", "edit", imported, "--depends-on", targets.join(","), "--plain"],
    { cwd: fixture.root, allowFailure: true });
  assert.equal(dependency.status, 0, `${dependency.stdout}\n${dependency.stderr}`);
  assert.deepEqual(JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", imported)).task.dependencies, targets);
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
  assert.equal(git(fixture.root, "status", "--porcelain=v1"), "");
});


test("native populated Backlog lifecycle archives and restores Done and non-Done records in place", { timeout: 180_000 }, (t) => {
  const fixture = repository(t, "native-populated-lifecycle");
  const destination = publishedPopulatedBacklogDestination(fixture);
  const { store } = destination;
  const view = (id) => JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", id)).task;
  const create = (title, ...args) => backlog(fixture.root, "task", "create", title, ...args,
    "--no-dod-defaults", "--plain").match(/BASE-\d+(?:\.\d+)*/)[0];
  const commit = (message) => {
    git(store, "add", "tasks", "archive/tasks");
    command(store, "git", ["-c", "user.name=Lifecycle Fixture", "-c", "user.email=lifecycle@example.invalid",
      "commit", "-qm", message]);
  };
  const rootHead = git(fixture.root, "rev-parse", "HEAD");
  const publishedRefs = git(store, "ls-remote", "--refs", "origin");
  for (const status of ["Done", "In Planning"]) {
    const id = create(`Lifecycle ${status}`, "--status", status, "--parent", destination.active,
      "--depends-on", destination.archived, "--ref", destination.completed,
      "--ref", "https://example.invalid/native-reference", "--doc", "https://example.invalid/native-guide",
      "--description", "Preserved description λ", "--plan", "Preserved living plan", "--notes", "First native notes");
    backlog(fixture.root, "task", "edit", id, "--comment", "Preserved native comment", "--comment-author", "fixture-author", "--plain");
    const dependent = create("Relation survives archive", "--parent", destination.active, "--depends-on", id, "--ref", id);
    commit(`Seed ${id} native content`);
    backlog(fixture.root, "task", "edit", id, "--append-notes", "Second native revision", "--plain");
    commit(`Revise ${id} native notes`);
    const before = view(id);
    assert.equal(before.status, status);
    assert.equal(before.parentTaskId, destination.active);
    assert.deepEqual(before.dependencies, [destination.archived]);
    assert.deepEqual(before.references, [destination.completed, "https://example.invalid/native-reference"]);
    assert.deepEqual(before.documentation, ["https://example.invalid/native-guide"]);
    const beforeBytes = readFileSync(join(fixture.root, before.path));
    const beforeHead = git(store, "rev-parse", "HEAD");
    const relativePath = before.path.slice(".backlog/".length);
    const history = git(store, "log", "--follow", "--format=%H", "--", relativePath).split(/\r?\n/);
    assert.ok(history.length >= 2);
    assert.equal(git(store, "log", "--follow", "-2", "--format=%s", "--", relativePath),
      `Revise ${id} native notes\nSeed ${id} native content`);
    const records = physicalDestinationRecords(store);
    backlog(fixture.root, "task", "archive", id);
    const archived = view(id);
    assert.equal(archived.path, before.path.replace(".backlog/tasks/", ".backlog/archive/tasks/"));
    assert.equal(existsSync(join(fixture.root, before.path)), false);
    assert.deepEqual(readFileSync(join(fixture.root, archived.path)), beforeBytes);
    assert.equal(archived.archived, true);
    for (const field of ["id", "status", "parentTaskId", "dependencies", "references", "documentation", "implementationPlan", "implementationNotes", "comments"]) {
      assert.deepEqual(archived[field], before[field], `preserved native archive content: ${field}`);
    }
    const afterArchive = physicalDestinationRecords(store);
    delete records[relativePath];
    assert.deepEqual(afterArchive, { ...records, [archived.path.slice(".backlog/".length)]: beforeBytes.toString("base64") });
    const beforeRead = admissionTree(store);
    assert.match(backlog(fixture.root, "task", "view", id, "--plain"), /\(archived\)/);
    const refused = RUNNER.run("backlog", ["task", "edit", id, "--append-notes", "Must not be written", "--plain"],
      { cwd: fixture.root, allowFailure: true });
    assert.notEqual(refused.status, 0);
    assert.match(`${refused.stdout}\n${refused.stderr}`, /archived.*read-only[\s\S]*backlog task restore/i);
    assert.deepEqual(admissionTree(store), beforeRead, "archive readback and refused edit change nothing");
    assert.equal(git(store, "rev-parse", "HEAD"), beforeHead, "native operations do not invent task history");
    const sibling = create("Allocated while archived", "--parent", destination.active);
    assert.equal(sibling, `${destination.active}.${Number(dependent.split(".").at(-1)) + 1}`);
    assert.deepEqual(view(dependent).dependencies, [id], "archiving does not remove incoming dependencies");
    assert.deepEqual(view(dependent).references, [id]);
    commit(`Archive ${id} without changing its content`);
    assert.deepEqual(git(store, "log", "--follow", "--format=%H", "--", archived.path.slice(".backlog/".length)).split(/\r?\n/).slice(1), history);
    backlog(fixture.root, "task", "restore", id);
    assert.deepEqual(view(id), before);
    assert.deepEqual(readFileSync(join(fixture.root, before.path)), beforeBytes);
    assert.equal(existsSync(join(fixture.root, archived.path)), false);
    const next = create("Allocated after restore", "--parent", destination.active);
    assert.equal(next, `${destination.active}.${Number(sibling.split(".").at(-1)) + 1}`);
    commit(`Restore ${id} with its original identity`);
    assert.deepEqual(git(store, "log", "--follow", "--format=%H", "--", relativePath).split(/\r?\n/).slice(2), history);
    assert.deepEqual(Buffer.from(command(store, "git", ["show", `${beforeHead}:${relativePath}`])), beforeBytes);
    backlog(fixture.root, "task", "edit", id, "--append-notes", "Editable after native restore", "--plain");
    assert.match(view(id).implementationNotes, /Editable after native restore/);
  }
  for (const [path, expected] of Object.entries(destination.baseline)) {
    assert.equal(readFileSync(join(store, path)).toString("base64"), expected.bytes, `unrelated baseline bytes: ${path}`);
    assert.equal(git(store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", path), expected.history, `unrelated baseline history: ${path}`);
  }
  assert.equal(git(fixture.root, "rev-parse", "HEAD"), rootHead);
  assert.equal(git(store, "ls-remote", "--refs", "origin"), publishedRefs, "local lifecycle operations do not publish");
});

test("native populated Backlog lifecycle deletes only archived records and cleans relations before ID reuse", { timeout: 120_000 }, (t) => {
  const fixture = repository(t, "native-populated-delete");
  const destination = publishedPopulatedBacklogDestination(fixture);
  const { store } = destination;
  const view = (id) => JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", id)).task;
  const create = (title, ...args) => backlog(fixture.root, "task", "create", title, ...args,
    "--no-dod-defaults", "--plain").match(/BASE-\d+(?:\.\d+)*/)[0];
  const target = create("Explicit delete target", "--status", "Done");
  assert.equal(target, "BASE-5");
  const url = `https://example.invalid/${target}`;
  const dependent = create("Active dependent", "--parent", destination.active,
    "--depends-on", target, "--ref", target, "--ref", url);
  const archivedDependent = create("Archived dependent", "--parent", destination.active,
    "--depends-on", `${target},${destination.completed}`, "--ref", target, "--ref", url);
  backlog(fixture.root, "task", "archive", archivedDependent);
  const original = admissionTree(store);
  const refused = RUNNER.run("backlog", ["task", "delete", target], { cwd: fixture.root, allowFailure: true });
  assert.notEqual(refused.status, 0);
  assert.match(`${refused.stdout}\n${refused.stderr}`, /must be archived before it can be deleted/i);
  assert.deepEqual(admissionTree(store), original);
  backlog(fixture.root, "task", "archive", target);
  const archivedPath = view(target).path;
  const removed = backlog(fixture.root, "task", "delete", target);
  assert.match(removed, new RegExp(`Deleted task ${target}`));
  assert.ok(removed.includes(dependent) && removed.includes(archivedDependent), "native delete reports cleaned records");
  assert.equal(existsSync(join(fixture.root, archivedPath)), false);
  const missing = RUNNER.run("backlog", ["task", "view", "--json", "--", target], { cwd: fixture.root, allowFailure: true });
  assert.notEqual(missing.status, 0);
  assert.match(`${missing.stdout}\n${missing.stderr}`, /not found/i);
  assert.deepEqual(view(dependent).dependencies, []);
  assert.deepEqual(view(archivedDependent).dependencies, [destination.completed]);
  for (const id of [dependent, archivedDependent]) {
    assert.deepEqual(view(id).references, [url], "delete cleans exact native task links, not URLs containing its ID");
    assert.equal(view(id).parentTaskId, destination.active);
  }
  assert.equal(create("Replacement after explicit delete"), target, "only permanent deletion vacates native identity");
  assert.deepEqual(view(dependent).dependencies, [], "ID reuse must not reattach a removed relation");
  for (const [path, expected] of Object.entries(destination.baseline)) {
    assert.equal(readFileSync(join(store, path)).toString("base64"), expected.bytes, `unrelated baseline bytes: ${path}`);
  }
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

test("confirmed populated Backlog migration preserves archived draft bytes paths and history without native archived-draft readback", { timeout: 240_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "populated-archived-draft");
  const destination = publishedPopulatedBacklogDestination(fixture);
  const { store } = destination;
  const output = backlog(fixture.root, "task", "create", "Existing archived draft", "--draft",
    "--description", "Preserve archived draft bytes λ\nnever promote or discard", "--no-dod-defaults", "--plain");
  const archivedDraft = output.match(/\bDRAFT-\d+(?:\.\d+)*\b/)[0];
  git(store, "add", "drafts");
  command(store, "git", ["-c", "user.name=Existing Task Author", "-c", "user.email=existing@example.invalid",
    "commit", "-qm", "existing draft before native archive"]);
  backlog(fixture.root, "draft", "archive", archivedDraft);
  git(store, "add", "drafts", "archive/drafts");
  command(store, "git", ["-c", "user.name=Existing Task Author", "-c", "user.email=existing@example.invalid",
    "commit", "-qm", "preserved archived draft baseline"]);
  git(store, "push", "-q");
  const records = physicalDestinationRecords(store);
  const archivedPaths = Object.keys(records).filter((path) => path.startsWith("archive/drafts/"));
  assert.equal(archivedPaths.length, 1);
  const archivedPath = archivedPaths[0];
  const history = git(store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", archivedPath);
  const originalHead = git(store, "rev-parse", "HEAD");
  const runner = new AdmissionRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  const result = await migrateTaskProvider({ cwd: fixture.root, targetProvider: "backlog", runner,
    expectedSourceRevision: inspection.sourceRevision, confirmedSwitch: true, actor: "archived-draft-operator",
    semanticPlacement: "Preserve exact source packages and existing archived draft files/history; no synthetic native view." });
  assert.equal(result.status, "completed", result.detail);
  for (const [path, bytes] of Object.entries(records)) {
    assert.equal(readFileSync(join(store, path)).toString("base64"), bytes, `preserved baseline bytes/path: ${path}`);
  }
  assert.equal(git(store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", archivedPath), history);
  assert.equal(Buffer.from(command(store, "git", ["show", `${result.receipt.destinationReceiptRevision}:${archivedPath}`])).toString("base64"), records[archivedPath]);
  git(store, "merge-base", "--is-ancestor", originalHead, "HEAD");
  assert.equal(runner.calls.some(({ commandName, args }) => commandName === "backlog"
    && ["task", "draft"].includes(args[0]) && args[1] === "view" && args.includes(archivedDraft)), false,
    "unsupported archived-draft view is not required or synthesized");
  assert.ok(runner.calls.some(({ commandName, args }) => commandName === "backlog"
    && args[0] === "draft" && args[1] === "view" && args.includes(destination.draft)), "active draft still needs native evidence");
  for (const id of [destination.active, destination.completed, destination.archived, destination.legacy]) {
    assert.ok(runner.calls.some(({ commandName, args }) => commandName === "backlog"
      && args[0] === "task" && args[1] === "view" && args.includes(id)), `native task evidence remains required: ${id}`);
  }
  assert.equal(Object.keys(physicalDestinationRecords(store)).length, Object.keys(records).length + inspection.taskCounts.total + 1);
  assert.equal(result.receipt.mappings.length, inspection.taskCounts.total);
  assert.equal(git(store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], result.receipt.destinationReceiptRevision);
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  assert.equal(detectTaskProvider(fixture.root, RUNNER).evidence.provider, "backlog");
});

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
    const hasMemories = kind === "code-default" || kind === "independent-custom";
    if (hasMemories) bd(fixture.root, "remember", "Public populated destination memory λ\n", "--key", "public-populated");
    const owner = kind === "code-default" ? addActiveBeadsOwner(fixture) : null;
    const originalEpisodeHead = owner ? git(owner.episode, "rev-parse", "HEAD") : null;
    const originalReadmeIndex = owner ? git(owner.episode, "ls-files", "--stage", "--", "README.md") : null;
    const records = physicalDestinationRecords(destination.store);
    const nativeBaseline = Object.fromEntries([destination.active, destination.completed, destination.archived, destination.legacy].map((id) => {
      const task = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", id)).task;
      return [id, { ...task, path: task.path.slice(selected.length + 1) }];
    }));
    const draftBaseline = backlog(fixture.root, "draft", "view", destination.draft, "--plain");
    const originalHistory = kind.startsWith("independent") ? Object.fromEntries(Object.keys(records).map((path) =>
      [path, git(destination.store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", path)])) : {};
    const originalHead = git(destination.store, "rev-parse", "HEAD");
    const nativeDestination = detectExplicitTaskProvider(fixture.root, "backlog", RUNNER);
    assert.equal(nativeDestination.kind, "selected");
    assert.equal(nativeDestination.evidence.storeDir, destination.store);
    const configPath = nativeDestination.evidence.configPath;
    const config = readFileSync(configPath, "utf8");
    const originalFolderConfig = existsSync(join(destination.store, "config.yml"))
      ? readFileSync(join(destination.store, "config.yml"), "utf8") : null;
    const before = sourceAuthorityFiles(fixture.root);
    const nativeCurrent = captureBeadsCurrentTasks(fixture.root, Object.values(fixture.ids));
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
    for (const [path, bytes] of Object.entries(records)) {
      assert.equal(readFileSync(join(store, path)).toString("base64"), bytes, path);
      if (originalHistory[path]) assert.equal(git(store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", path), originalHistory[path], path);
    }
    const finalStore = selected === "backlog" ? ".backlog" : selected;
    for (const [id, expected] of Object.entries(nativeBaseline)) {
      const task = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", id)).task;
      assert.deepEqual({ ...task, path: task.path.slice(finalStore.length + 1) }, expected, `preserved native baseline ${id}`);
    }
    const finalDraftView = backlog(fixture.root, "draft", "view", destination.draft, "--plain");
    assert.equal(selected === "backlog"
      ? finalDraftView.replace(`File: ${store}/`, `File: ${join(fixture.root, "backlog")}/`)
      : finalDraftView, draftBaseline, "only the allowed default-store File path translation may differ");
    assert.equal(nativeBaseline[destination.completed].status, "Done");
    assert.ok(nativeBaseline[destination.completed].path.startsWith("tasks/"));
    assert.equal(nativeBaseline[destination.archived].status, "In Planning");
    assert.ok(nativeBaseline[destination.archived].path.startsWith("archive/tasks/"));
    assert.equal(nativeBaseline[destination.legacy].status, "Done");
    assert.ok(nativeBaseline[destination.legacy].path.startsWith("completed/"));
    assert.deepEqual(nativeBaseline[destination.active].dependencies, [destination.archived, destination.draft]);
    assert.equal(Object.keys(physicalDestinationRecords(store)).length, Object.keys(records).length + inspection.taskCounts.total + 1 + (hasMemories ? 1 : 0));
    if (hasMemories) {
      assert.equal(result.receipt.backlogMemoryOutputs.documents.length, 1);
      const outputs = result.receipt.backlogMemoryOutputs;
      verifyBacklogMemoryOutputs(outputs, fixture.root, runner);
      for (const output of [...outputs.documents, outputs.index, outputs.userTask]) {
        const path = output.path.slice(`${store.slice(fixture.root.length + 1)}/`.length);
        for (const revision of [result.receipt.destinationDataRevision, result.receipt.destinationReceiptRevision]) {
          assert.equal(command(store, "git", ["show", `${revision}:${path}`]), readFileSync(join(fixture.root, output.path), "utf8"));
        }
      }
    } else {
      assert.equal(result.receipt.backlogMemoryOutputs, undefined, "issue-only migration creates no memory outputs");
      assert.equal(git(store, "ls-files", "docs").split(/\r?\n/).filter((path) => /Imported-Beads|imported-beads/.test(path)).length, 0);
      assert.ok(!Object.values(physicalDestinationRecords(store)).some((bytes) => Buffer.from(bytes, "base64").toString("utf8").includes("USER: Review imported Beads memories")));
    }
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
    const importedViews = Object.fromEntries(result.receipt.mappings.map((row) => [row.sourceTaskId,
      JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", row.destinationTaskId))]));
    for (const [sourceId, view] of Object.entries(importedViews)) assertCurrentBacklogTask(view, nativeCurrent[sourceId], inspection, mappings);
    const imported = Object.fromEntries(Object.entries(importedViews).map(([id, view]) => [id, view.task]));
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

test("native archived-target source graph preserves mapped dependencies through migration", { timeout: 240_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "archived-target-migration");
  const destination = publishedPopulatedBacklogDestination(fixture);
  bd(fixture.root, "close", fixture.ids.child, "--reason",
    `Prime Claw abandonment: task ${fixture.ids.child}; pushed Episode head ${git(fixture.root, "rev-parse", "HEAD")}; code was not merged.`, "--force", "--json");
  const nativeCurrent = captureBeadsCurrentTasks(fixture.root, Object.values(fixture.ids));
  const records = physicalDestinationRecords(destination.store);
  const before = sourceAuthorityFiles(fixture.root);
  class ArchivedDependencyRunner extends AsIsBeadsRunner {
    run(name, args, options = {}) {
      if (name === "git" && args.includes("push") && options.cwd === destination.store) assert.deepEqual(sourceAuthorityFiles(fixture.root), before);
      return super.run(name, args, options);
    }
  }
  const runner = new ArchivedDependencyRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.deepEqual(inspection.taskCounts, { open: 2, closed: 0, archived: 1, total: 3 });
  const result = await migrateTaskProvider({ cwd: fixture.root, targetProvider: "backlog", runner,
    expectedSourceRevision: inspection.sourceRevision, confirmedSwitch: true, actor: "operator",
    semanticPlacement: "Preserve the native archived dependency and exact closure evidence." });
  assert.equal(result.status, "completed", result.detail);
  assert.deepEqual(result.receipt.taskCounts, inspection.taskCounts);
  const mappings = Object.fromEntries(result.receipt.mappings.map((row) => [row.sourceTaskId, row.destinationTaskId]));
  const childView = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", mappings[fixture.ids.child]));
  const child = childView.task;
  const blocked = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", mappings[fixture.ids.blocked])).task;
  assert.equal(child.status, "Done");
  assert.ok(child.path.startsWith(".backlog/archive/tasks/"));
  assert.equal(child.parentTaskId, mappings[fixture.ids.parent]);
  assert.deepEqual(blocked.dependencies, [mappings[fixture.ids.child]]);
  assertCurrentBacklogTask(childView, nativeCurrent[fixture.ids.child], inspection, mappings);
  assert.equal(nativeCurrent[fixture.ids.child].nativeView.status, "closed");
  assert.match(child.finalSummary, /^Prime Claw abandonment:/);
  for (const [path, bytes] of Object.entries(records)) assert.equal(readFileSync(join(destination.store, path)).toString("base64"), bytes, path);
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  assert.equal(git(destination.store, "status", "--porcelain=v1"), "");
});


test("default migration capture is file-backed for every native read and reports bounded payload-safe failures", { timeout: 180_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "file-backed-migration");
  const owner = addActiveBeadsOwner(fixture);
  const currentView = JSON.parse(bd(fixture.root, "--readonly", "show", fixture.ids.parent, "--json", "--long", "--include-comments"))[0];
  const large = syntheticCurrentViewFile(fixture, currentView);
  const before = sourceAuthorityFiles(fixture.root);
  const ownershipPath = join(fixture.root, ".prime-claw", "ownership.json");
  const ownership = readFileSync(ownershipPath, "utf8");
  const originalRun = ProcessCommandRunner.prototype.run;
  const originalFileBacked = ProcessCommandRunner.prototype.runFileBacked;
  const reads = [];
  let injection;
  let failDiscovery = false;
  let failRequiredGit = false;
  let failExport = false;
  ProcessCommandRunner.prototype.run = () => { throw new Error("migration used pipe-buffer capture"); };
  ProcessCommandRunner.prototype.runFileBacked = function (commandName, args, options = {}) {
    if (commandName === "bd") {
      reads.push([...args]);
      assert.ok(!["history", "provenance"].includes(args[0] === "--readonly" ? args[1] : args[0]),
        "default capture must not read historical commands");
    }
    if (failExport && commandName === "bd" && args[0] === "--readonly" && args[1] === "export") return injection;
    if ((failDiscovery && commandName === "bd" && args[0] === "config" && args[1] === "get" && args[2] === "no-db")
        || (failRequiredGit && commandName === "git" && args.includes("--git-dir"))) {
      assert.equal(options.allowFailure, true, "adapter must collect native metadata before throwing");
      return injection;
    }
    if (commandName === "bd" && args[0] === "--readonly" && args[1] === "show" && args[2] === fixture.ids.parent) {
      if (injection) return injection;
      const result = originalFileBacked.call(this, process.execPath,
        ["-e", "process.stdout.write(require('node:fs').readFileSync(process.argv[1]))", large.path], options);
      assert.equal(result.stdout, large.text);
      assert.deepEqual(JSON.parse(result.stdout), [large.view]);
      return result;
    }
    return originalFileBacked.call(this, commandName === "backlog" ? BACKLOG : commandName, args, options);
  };
  t.after(() => {
    ProcessCommandRunner.prototype.run = originalRun;
    ProcessCommandRunner.prototype.runFileBacked = originalFileBacked;
  });
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog" });
  assert.equal(inspection.status, "ready", inspection.detail);
  for (const verb of ["export", "list", "show", "context", "statuses", "dolt"]) {
    assert.ok(reads.some((args) => args[0] === "--readonly" && args[1] === verb), `missing file-backed ${verb}`);
  }
  assert.ok(reads.some((args) => args.length === 1 && args[0] === "--version"));
  assert.ok(!reads.some((args) => ["history", "provenance"].includes(args[1])));

  const failures = [
    { name: "ENOBUFS", stdout: large.text, stderr: "", status: 1, errorCode: "ENOBUFS", nativeStatus: null, signal: "SIGTERM" },
    { name: "ENOSPC", stdout: large.text, stderr: "", status: 1, errorCode: "ENOSPC", nativeStatus: null, signal: null },
    { name: "output-read EIO", stdout: large.text, stderr: "", status: 1, errorCode: "EIO", nativeStatus: null, signal: null },
    { name: "short stderr", stdout: large.text, stderr: "fixture command unavailable", status: 7, nativeStatus: 7, signal: null },
    { name: "large stderr", stdout: large.text, stderr: "fixture ordinary error ".repeat(2000) + "PRIVATE-STDERR-TAIL", status: 9, nativeStatus: 9 },
    { name: "empty stderr", stdout: large.text, stderr: "", status: 7, nativeStatus: 7, signal: null },
    { name: "empty export stderr", operation: "export", stdout: large.text, stderr: "", status: 7, nativeStatus: 7, signal: null },
  ];
  for (const failure of failures) {
    injection = failure;
    failExport = failure.operation === "export";
    const expectedLabel = failExport ? "Beads source complete export" : `bd show ${fixture.ids.parent}`;
    const refused = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog" });
    assert.equal(refused.status, "blocked", failure.name);
    assert.ok(refused.detail.startsWith(`${expectedLabel}:`), refused.detail);
    assert.match(refused.detail, /command\/capture failed/);
    assert.ok(refused.detail.includes(`status=${failure.status}`), failure.name);
    if (failure.nativeStatus !== undefined) assert.ok(refused.detail.includes(`nativeStatus=${failure.nativeStatus}`), failure.name);
    if (failure.signal === null) assert.match(refused.detail, /signal=null/);
    assert.ok(refused.detail.length <= 768, failure.name);
    assert.match(refused.remediation, /resolve.*command\/capture or resource failure/);
    assert.doesNotMatch(refused.detail, /PRIVATE-|Issue|description|padding/);
    if (failure.errorCode) assert.match(refused.detail, new RegExp(`code=${failure.errorCode}`));
    if (failure.nativeStatus === null) assert.match(refused.detail, /nativeStatus=null/);
    if (failure.signal) assert.match(refused.detail, /signal=SIGTERM/);
    const result = await migrateTaskProvider({
      cwd: fixture.root, targetProvider: "backlog", expectedSourceRevision: inspection.sourceRevision,
      confirmedSwitch: true, actor: "synthetic-test", semanticPlacement: "Preserve all native values.",
    });
    assert.equal(result.status, "blocked", failure.name);
    assert.equal(result.detail, refused.detail, "inspection and migration retain the same safe operation label and metadata");
    assert.match(result.detail, /command\/capture failed/);
    assert.ok(result.detail.length <= 768);
    assert.match(result.remediation, /resolve.*command\/capture or resource failure/);
    assert.doesNotMatch(result.detail, /PRIVATE-|Issue|description|padding/);
    assert.deepEqual(sourceAuthorityFiles(fixture.root), before);
    assert.equal(readFileSync(ownershipPath, "utf8"), ownership);
    assert.equal(existsSync(join(fixture.root, ".backlog")), false);
    assert.equal(existsSync(join(fixture.root, "backlog.config.yml")), false);
    assert.equal(existsSync(join(fixture.root, ".beads")), true);
  }
  // Discovery helpers used to turn native command failure into source-repair
  // advice. Required Git discovery also calls the runner with allowFailure=false.
  injection = failures[0];
  failExport = false;
  failDiscovery = true;
  const discoveryFailure = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog" });
  assert.equal(discoveryFailure.status, "blocked");
  assert.match(discoveryFailure.detail, /code=ENOBUFS.*nativeStatus=null.*signal=SIGTERM/);
  assert.match(discoveryFailure.remediation, /resolve.*command\/capture or resource failure/);
  assert.doesNotMatch(discoveryFailure.detail, /PRIVATE-|Issue|description|padding/);
  failDiscovery = false;
  failRequiredGit = true;
  const requiredFailure = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog" });
  assert.equal(requiredFailure.status, "blocked");
  assert.match(requiredFailure.detail, /code=ENOBUFS.*nativeStatus=null.*signal=SIGTERM/);
  assert.match(requiredFailure.remediation, /resolve.*command\/capture or resource failure/);
  failRequiredGit = false;
  injection = { status: 0, stderr: "", stdout: '{"PRIVATE-MALFORMED-NATIVE-PAYLOAD":' };
  const malformed = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog" });
  assert.equal(malformed.status, "blocked");
  assert.match(malformed.detail, /invalid JSON/);
  assert.match(malformed.remediation, /invalid or incomplete native/);
  assert.doesNotMatch(malformed.detail, /PRIVATE-|Unexpected|position|line|column/);
  assert.deepEqual(sourceAuthorityFiles(fixture.root), before);
  assert.equal(readFileSync(ownershipPath, "utf8"), ownership);
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
});


test("parked-store reconciliation retains uncertain native allocation when auto-commit has no Git identity", { timeout: 360_000 }, async t => {
  const f = parkedStoreReconciliationFixture(t, "missing-native-git-identity", { clone: false });
  const source = sourceAuthorityFiles(f.root);
  const overrides = {
    GIT_AUTHOR_NAME: undefined, GIT_AUTHOR_EMAIL: undefined,
    GIT_COMMITTER_NAME: undefined, GIT_COMMITTER_EMAIL: undefined,
    GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "user.useConfigOnly", GIT_CONFIG_VALUE_0: "true",
  };
  const before = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  let retirementCalls = 0;
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    const { result, requests } = await observeCompletionMigration({ ...f.request, runner: new AsIsBeadsRunner(),
      deleteSource() { retirementCalls++; throw new Error("missing native identity must not retire source"); } });
    assert.equal(result.status, "blocked");
    assert.match(result.detail, /http-status-400; outcome=uncertain/);
    assert.equal(retirementCalls, 0);
    assert.equal(requests.filter(row => ["POST", "PUT"].includes(row.method)).length, 1,
      "one uncertain allocation must not be resent or followed by another write");
    assert.deepEqual(sourceAuthorityFiles(f.root), source);
    assert.deepEqual(parkedStoreTree(f.parked), f.parkedBefore);
    assert.equal(command(f.store, "git", ["config", "--get", "user.name"], true), null);
    const privateDirectory = /Private transport evidence: ([^\r\n]+)/.exec(result.detail)?.[1];
    assert.ok(privateDirectory);
    const responseName = readdirSync(privateDirectory).filter(name => name.endsWith("response.json")).sort().at(-1);
    assert.ok(responseName);
    const responsePath = join(privateDirectory, responseName), responseBytes = readFileSync(responsePath);
    assert.equal(lstatSync(responsePath).mode & 0o777, 0o600);
    const response = JSON.parse(responseBytes.toString("utf8"));
    assert.match(JSON.stringify(response), /Author identity unknown|unable to auto-detect email|no (?:email|name) was given|empty ident/i,
      "synthetic native error must prove missing Git identity, not an unrelated HTTP400");
    git(f.store, "merge-base", "--is-ancestor", f.bootstrapHead, "HEAD");
    git(f.store, "merge-base", "--is-ancestor", f.originalTaskHead, "HEAD");
    assert.equal(git(f.store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], git(f.store, "rev-parse", "HEAD"));
    console.info(JSON.stringify({ parkedStoreDiagnostic: "missing-native-auto-commit-identity", status: result.status,
      nativeWrites: 1, retirementCalls, nativeIdentityErrorMatched: true,
      privateResponseSha256: createHash("sha256").update(responseBytes).digest("hex"), privateResponseMode: "0600" }));
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
