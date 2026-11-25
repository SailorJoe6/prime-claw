import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { statfsSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import http from "node:http";
import { syncBuiltinESMExports } from "node:module";
import { networkInterfaces, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { canonicalSha256, completeBeadsExport, importBeadsMemoryDocuments, verifyBacklogMemoryOutputs, inspectTaskProviderMigration, migrateTaskProvider } from "../src/prime-agent-plugin/extension-support/task-provider-migration.ts";
import { ProcessCommandRunner } from "../src/prime-agent-plugin/extension-support/project-initialization.ts";
import { detectTaskProvider } from "../src/prime-agent-plugin/extension-support/task-providers.ts";
import { prepareTaskHistoryWorkspace, TASK_HISTORY_REF } from "../src/prime-agent-plugin/extension-support/task-history-workspace.ts";
import { projectBeadsCurrentTask, assertBeadsCurrentTask } from "../src/prime-agent-plugin/extension-support/beads-backlog-current.ts";

const BACKLOG_CANDIDATE = "deps/backlog/dist/backlog";
const RUNTIME_BACKLOG = "/usr/local/bin/backlog";
const BACKLOG = process.platform === "linux" && existsSync(RUNTIME_BACKLOG)
  ? RUNTIME_BACKLOG
  : existsSync(BACKLOG_CANDIDATE) ? realpathSync(BACKLOG_CANDIDATE) : "backlog";
const CUSTOM = "in_design:active,in_planning:active,ready_for_merge:wip,done:done";
const BEADS_INVENTORY = ["--readonly", "list", "--all", "--limit", "0", "--include-infra",
  "--include-templates", "--include-gates", "--include-ephemeral", "--json"];

function legacyCanonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => legacyCanonical(item)).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${legacyCanonical(value[key])}`).join(",")}}`;
}

test("streaming canonical migration digest matches the legacy canonical bytes", () => {
  const values = [
    null,
    true,
    42,
    -0,
    1.25,
    "line\n雪",
    [3, { z: null, a: ["x", false] }],
    [undefined, , { undefinedValue: undefined }],
    { z: "last", a: "first", nested: { beta: 2, alpha: [1, null, "three"] } },
  ];
  for (const value of values) {
    const expected = createHash("sha256").update(legacyCanonical(value)).digest("hex");
    assert.equal(canonicalSha256(value), expected);
  }
  assert.equal(canonicalSha256({ b: 2, a: 1 }), canonicalSha256({ a: 1, b: 2 }));
});

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

function exportRecoveryRows(root) {
  return bd(root, "--readonly", "export", "--all").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
    .sort((a, b) => (a.id ?? a.key).localeCompare(b.id ?? b.key));
}

function recoveryEvidence(fixture) {
  return {
    files: sourceAuthorityFiles(fixture.root), rows: exportRecoveryRows(fixture.root),
    context: JSON.parse(bd(fixture.root, "--readonly", "context", "--json")),
    connection: JSON.parse(bd(fixture.root, "--readonly", "dolt", "show", "--json")),
  };
}

// Exercise the operator's independent restore after retirement. Nothing from the
// old .beads tree or its runtime (PID, socket, port, redirects) can be reused.
function assertRetainedBackupRestores(fixture, result, before, oldTitle) {
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  const backup = realpathSync(result.sourceBackupPath);
  const scratch = mkdtempSync(join(fixture.outer, "recovery-"));
  git(scratch, "init", "-q", "-b", "main");
  const store = join(scratch, ".beads");
  const server = before.context.dolt_mode === "server";
  const database = before.context.database;
  assert.match(database, /^[\w-]+$/);
  if (server) {
    // Native init provides the managed-local server scaffolding, not the data
    // under test. Use a different database so restore never overwrites one.
    assert.notEqual(database, "RCV");
    bd(scratch, "init", "--server", "--skip-hooks", "--skip-agents", "--prefix", "RCV", "--quiet", "--non-interactive");
    bd(scratch, "dolt", "stop");
  } else {
    mkdirSync(store, { mode: 0o700 });
  }
  for (const [name, original] of Object.entries(before.files)) {
    const bytes = readFileSync(join(backup, name));
    assert.equal(bytes.toString("base64"), original, `backup retains original ${name}`);
    writeFileSync(join(store, name), bytes);
  }
  const data = join(store, server ? "dolt" : "embeddeddolt");
  if (!server) mkdirSync(data, { mode: 0o700 });
  assert.equal(existsSync(join(data, database)), false);
  command(data, "dolt", ["backup", "restore", pathToFileURL(join(backup, "dolt")).href, database]);
  // A current export cannot recreate superseded rows in Dolt commit history.
  assert.match(fixture.ids.parent, /^[\w.-]+$/);
  const titles = command(join(data, database), "dolt", ["sql", "-r", "csv", "-q",
    `SELECT DISTINCT title FROM dolt_history_issues WHERE id = '${fixture.ids.parent}'`]).trim().split(/\r?\n/);
  assert.ok(titles.includes(oldTitle), `restored history is missing ${oldTitle}`);
  assert.notEqual(before.rows.find(row => row.id === fixture.ids.parent)?.title, oldTitle);
  // The controlled fixture uses ordinary per-project defaults. Never reuse an
  // endpoint or an absolute data directory recorded by the source server.
  const metadata = JSON.parse(readFileSync(join(store, "metadata.json"), "utf8"));
  for (const key of ["dolt_server_port", "dolt_server_host", "dolt_server_socket", "dolt_data_dir", "dolt_team_server"]) delete metadata[key];
  writeFileSync(join(store, "metadata.json"), JSON.stringify(metadata));
  if (server) bd(scratch, "dolt", "start"); // fresh per-project listener; only the scratch server is stopped below
  try {
    const context = JSON.parse(bd(scratch, "--readonly", "context", "--json"));
    assert.equal(context.beads_dir, store);
    assert.equal(context.database, database);
    assert.equal(context.dolt_mode, before.context.dolt_mode);
    if (server) {
      const connection = JSON.parse(bd(scratch, "--readonly", "dolt", "show", "--json"));
      assert.ok(["localhost", "127.0.0.1", "::1"].includes(connection.host));
      assert.equal(Number(readFileSync(join(store, "dolt-server.port"), "utf8")), Number(connection.port));
      assert.notEqual(connection.port, before.connection.port);
    }
    assert.deepEqual(exportRecoveryRows(scratch), before.rows);
  } finally {
    if (server) bd(scratch, "dolt", "stop");
  }
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

// Independent fixture oracle: parent-child and other typed links are not blockers.
function nativeBlockingTargets(pkg) {
  const rows = pkg.nativeView.dependencies ?? pkg.exportRow.dependencies ?? [];
  return rows.flatMap(row => {
    if (typeof row === "string") return [row];
    const kind = String(row.dependency_type ?? row.type ?? "blocks").trim().toLowerCase();
    return !kind || kind === "blocks" ? [row.depends_on_id ?? row.id ?? row.issue_id] : [];
  }).filter(Boolean);
}

function assertCurrentBacklogTask(view, pkg, inspection, mapping, configuration = {}) {
  const parent = pkg.nativeView.parent ?? pkg.exportRow.parent;
  const context = {
    sourceRevision: inspection.sourceRevision, sourceDigest: inspection.sourceDigest,
    status: ({ open: "In Design", deferred: "In Design", in_design: "In Design", in_planning: "In Planning",
      in_progress: "In Progress", blocked: "Blocked", ready_for_merge: "Ready for Merge", done: "Done", closed: "Done" })[pkg.nativeView.status],
    ...(parent ? { parentTaskId: mapping[parent] ?? parent } : {}),
    dependencies: nativeBlockingTargets(pkg).map(id => mapping[id] ?? id),
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

function assertOwnedBacklogGitEvidence(record, { root, store, episodeStore, taskId, revision }) {
  const native = JSON.parse(backlog(root, "task", "view", "--json", "--", taskId)).task;
  assert.equal(native.id, taskId);
  const nativePath = resolve(root, native.path);
  assert.ok(nativePath.startsWith(`${store}/`), native.path);
  const path = nativePath.slice(store.length + 1);
  assert.equal(record.provider, "backlog");
  assert.equal(record.taskId, taskId);
  assert.equal(record.providerRevision, revision);
  assert.deepEqual(record.taskEvidence, {
    kind: "backlog-git",
    repository: { topology: "independent",
      identity: createHash("sha256").update(`remote:${git(store, "remote", "get-url", "origin")}`).digest("hex") },
    commit: revision,
    path,
  }, "keep only the exact reference, not a copy of the native view or ticket content");
  assert.equal(git(store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], revision);
  const entry = command(store, "git", ["--literal-pathspecs", "ls-tree", "-z", revision, "--", path]);
  const [metadata, literal] = entry.split("\t");
  assert.match(metadata, /^100(?:644|755) blob [0-9a-f]{40}$/);
  assert.equal(literal, `${path}\0`);
  const committed = RUNNER.runFileBacked("git", ["show", `${revision}:${path}`], { cwd: store }).stdout;
  assert.equal(committed.split("\n---", 1)[0].match(/^id: (.+)$/m)?.[1], taskId);
  assert.equal(RUNNER.runFileBacked("git", ["show", `${revision}:${path}`], { cwd: episodeStore }).stdout, committed);
  const copies = Object.entries(physicalDestinationRecords(store)).filter(([, bytes]) =>
    Buffer.from(bytes, "base64").toString("utf8").split("\n---", 1)[0].match(/^id: (.+)$/m)?.[1] === taskId);
  assert.deepEqual(copies.map(([file]) => file), [path], "do not allocate a second native ticket for the owner");
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

function dirtyCodeCheckout(cwd, label) {
  const tracked = join(cwd, "README.md");
  const untracked = join(cwd, "operator-draft.js");
  writeFileSync(tracked, `${label}: staged code\n`);
  git(cwd, "add", "README.md");
  writeFileSync(tracked, `${label}: unstaged code\n`);
  writeFileSync(untracked, `// ${label}: untracked code\n`);
  const snapshot = () => ({
    branch: git(cwd, "branch", "--show-current"),
    head: git(cwd, "rev-parse", "HEAD"),
    index: command(cwd, "git", ["ls-files", "--stage", "-z"]),
    status: git(cwd, "status", "--porcelain=v1", "--", "README.md", "operator-draft.js"),
    files: [readFileSync(tracked), readFileSync(untracked)],
  });
  assert.match(snapshot().status, /^MM README\.md\n\?\? operator-draft\.js$/);
  return snapshot;
}

test("confirmed Beads to Backlog migration preserves active Episode identity despite unrelated code drift", { timeout: 180_000 }, async (t) => {
  const fixture = beadsSource(t, "beads-active-owner");
  const nativeCurrent = captureBeadsCurrentTasks(fixture.root, Object.values(fixture.ids));
  const owner = addActiveBeadsOwner(fixture);
  const codeRemote = () => git(fixture.root, "ls-remote", "--refs", "origin", "refs/heads/*").split("\n")
    .filter((line) => !line.endsWith(`\t${TASK_HISTORY_REF}`));
  const remoteBefore = codeRemote();
  const sourceBefore = sourceAuthorityFiles(fixture.root);
  const sessionBefore = readFileSync(owner.record.episodeSessionFile);
  git(fixture.root, "update-ref", "refs/remotes/origin/main", owner.episodeHead);
  assert.notEqual(git(fixture.root, "rev-parse", "origin/main"), git(fixture.remote, "rev-parse", "refs/heads/main"));
  git(fixture.root, "update-ref", "refs/remotes/origin/prime-claw/tasks", owner.episodeHead);
  git(fixture.root, "switch", "-qc", "operator-checkout");
  const primaryCode = dirtyCodeCheckout(fixture.root, "primary");
  const episodeCode = dirtyCodeCheckout(owner.episode, "episode");
  const primaryBefore = primaryCode();
  const episodeBefore = episodeCode();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: RUNNER });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.deepEqual(inspection.activeOwnership, [{ ownerSessionId: owner.ownerSessionId, taskId: fixture.ids.parent }]);
  assert.deepEqual(primaryCode(), primaryBefore, "inspection must not alter the primary code checkout");
  assert.deepEqual(episodeCode(), episodeBefore, "inspection must not alter the Episode code checkout");
  const store = join(fixture.root, ".backlog");
  const episodeStore = join(owner.episode, ".backlog");
  let expectedEpisodeCode;
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner: RUNNER, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "migration-operator",
    semanticPlacement: "Place native design in the living plan and preserve all unsupported values in exact provenance comments.",
    onProgress(phase) {
      if (phase !== "Guarded cutover starting; stop no longer interrupts this phase") return;
      assert.deepEqual(episodeCode(), episodeBefore, "publication must not edit the Episode code checkout");
      git(owner.episode, "commit", "--allow-empty", "--only", "-qm", "unrelated Episode code advancement");
      expectedEpisodeCode = { ...episodeBefore, head: git(owner.episode, "rev-parse", "HEAD") };
    },
    async verifyActiveRuntime(records) {
      assert.deepEqual(sourceAuthorityFiles(fixture.root), sourceBefore, "source must remain intact through ownership cutover proof");
      assert.equal(records.length, 1);
      return proveFixtureRuntime(records);
    },
  });
  assert.equal(result.status, "completed", result.detail);
  assert.equal(result.selectedProvider, "backlog");
  assert.deepEqual(result.receipt.taskCounts, { open: 1, closed: 1, archived: 1, total: 3 });
  assert.equal(result.receipt.mappings.length, 3);
  assert.ok(result.receipt.mappings.every((mapping) => mapping.sourceTaskId !== mapping.destinationTaskId));
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  assert.deepEqual(primaryCode(), primaryBefore, "cutover must preserve primary code bytes, staged entries and checkout");
  assert.ok(expectedEpisodeCode, "must exercise drift at the guarded cutover boundary");
  assert.deepEqual(episodeCode(), expectedEpisodeCode, "cutover must preserve Episode code bytes, staged entries and advanced branch");
  assert.deepEqual(codeRemote(), remoteBefore, "independent task publication must not push code branches");
  assert.equal(git(fixture.root, "rev-parse", "origin/main"), owner.episodeHead, "must not refresh the stale code tracking ref");
  assert.equal(git(fixture.root, "rev-parse", "refs/remotes/origin/prime-claw/tasks"), owner.episodeHead, "must not refresh the stale task tracking ref");
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
  assertOwnedBacklogGitEvidence(current, { root: fixture.root, store, episodeStore,
    taskId: mapped.destinationTaskId, revision: result.receipt.destinationReceiptRevision });
  for (const field of ["ownerSessionId", "operationId", "engine", "baseRef", "createdAt", "worktree", "branch", "head", "episodeId", "episodeSessionFile", "episodeActiveSessionId"]) {
    assert.deepEqual(current[field], owner.record[field], field);
  }
  assert.deepEqual(readFileSync(owner.record.episodeSessionFile), sessionBefore);
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


test("forward Beads retirement preserves outgoing Dolt history and operator ignores through ordinary Backlog preparation", { timeout: 300_000 }, async (t) => {
  const fixture = beadsSource(t, "forward-publication-retirement");
  bd(fixture.root, "update", fixture.ids.parent, "--title", "Revised after source publication", "--json");
  bd(fixture.root, "remember", "Not in the outgoing remote Ω", "--key", "recovery-only-memory");
  const recovery = recoveryEvidence(fixture);
  assert.ok(recovery.rows.some(row => row._type === "memory" && row.key === "recovery-only-memory"));
  const operatorIgnore = "operator-cache/\n";
  const nativeIgnore = readFileSync(join(fixture.root, ".gitignore"), "utf8");
  assert.match(nativeIgnore, /\*\.gate\.lock\*/);
  const originalIgnore = nativeIgnore + operatorIgnore;
  writeFileSync(join(fixture.root, ".gitignore"), originalIgnore);
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
  assert.equal(existsSync(join(fixture.root, ".beads.gate.lock")), true, "original-store retirement leaves unrelated root files untouched");
  assert.equal(git(fixture.root, "ls-remote", "--refs", fixture.remote, "refs/dolt/data"), sourcePublication,
    "local source retirement must retain outgoing remote history without changing its ref");
  assertRetainedBackupRestores(fixture, result, recovery, "Beads parent");
  assert.equal(readFileSync(join(fixture.root, ".gitignore"), "utf8"), originalIgnore,
    "cutover must not rewrite the code checkout's ignore file");
  git(fixture.root, "check-ignore", "--", ".backlog/tasks/example.md");
  const finalPreparation = prepareTaskHistoryWorkspace({ primaryRoot: fixture.root, runner: RUNNER });
  assert.equal(finalPreparation.status, "prepared", finalPreparation.detail);
  assert.equal(git(fixture.root, "rev-parse", TASK_HISTORY_REF), result.receipt.destinationReceiptRevision);
});


test("forward Beads retirement stops before publication if the retained backup cannot restore", { timeout: 180_000 }, async t => {
  const fixture = embeddedBeadsSource(t, "backup-restore-refusal");
  const owner = addActiveBeadsOwner(fixture);
  const registry = join(fixture.root, ".prime-claw", "ownership.json");
  const owners = readFileSync(registry);
  const before = recoveryEvidence(fixture);
  const remote = git(fixture.root, "ls-remote", "--refs", fixture.remote);
  const head = git(fixture.root, "rev-parse", "HEAD");
  let refused = false;
  class RestoreRefusingRunner extends AsIsBeadsRunner {
    run(name, args, options = {}) {
      if (name === "dolt" && args[0] === "backup" && args[1] === "restore") {
        refused = true;
        return { status: 1, stdout: "", stderr: "fixture rejects scratch restore" };
      }
      return super.run(name, args, options);
    }
  }
  const runner = new RestoreRefusingRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.equal(refused, false, "inspection must not run a backup restore");
  const result = await migrateTaskProvider({
    cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "recovery-fixture", semanticPlacement: "Preserve current native values.",
    verifyActiveRuntime: proveFixtureRuntime,
  });
  assert.equal(refused, true, result.detail);
  assert.equal(result.status, "blocked");
  assert.ok(lstatSync(result.sourceBackupPath).isDirectory(), "report the retained artifact even on failed verification");
  assert.deepEqual(sourceAuthorityFiles(fixture.root), before.files);
  assert.deepEqual(exportRecoveryRows(fixture.root), before.rows);
  assert.deepEqual(readFileSync(registry), owners);
  assert.equal(git(owner.episode, "rev-parse", "HEAD"), owner.episodeHead);
  assert.equal(git(fixture.root, "rev-parse", "HEAD"), head);
  assert.equal(git(fixture.root, "ls-remote", "--refs", fixture.remote), remote);
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
  assert.equal(existsSync(join(fixture.root, "backlog.config.yml")), false);
  assert.equal(command(fixture.root, "git", ["rev-parse", "--verify", "--quiet", TASK_HISTORY_REF], true), null);
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
  constructor(onReceiptProof) { super(); this.onReceiptProof = onReceiptProof; this.receipt = undefined; }
  run(commandName, args, options = {}) {
    const result = super.run(commandName, args, options);
    if (commandName === "git" && args.includes("commit") && args.some(arg => /migration receipt/i.test(arg)) && result.status === 0) {
      this.receipt = git(options.cwd, "rev-parse", "HEAD");
    }
    if (this.receipt && commandName === "git" && args.includes("ls-remote") && args.includes(TASK_HISTORY_REF)
      && result.stdout.startsWith(this.receipt)) this.onReceiptProof();
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


test("pre-switch route replacement preserves active Beads migration continuity", { timeout: 240_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "post-switch-route-replacement");
  const owner = addActiveBeadsOwner(fixture);
  const runner = new AsIsBeadsRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  const sourceBefore = sourceAuthorityFiles(fixture.root);
  const sessionBefore = readFileSync(owner.record.episodeSessionFile, "utf8");
  const primaryHead = git(fixture.root, "rev-parse", "HEAD");
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
      if (proofs === 2) {
        assert.equal(record.provider, "beads");
        assert.ok(git(join(fixture.root, ".backlog"), "ls-remote", "--refs", "origin", TASK_HISTORY_REF));
        return [{ ownerSessionId: record.ownerSessionId,
          expectedPreviousEpisodeActiveSessionId: record.episodeActiveSessionId,
          verifiedCurrentEpisodeActiveSessionId: replacementRoute }];
      }
      assert.equal(record.provider, "beads");
      assert.equal(record.taskId, fixture.ids.parent);
      return proveFixtureRuntime(records);
    },
  });
  assert.equal(proofs, 2, "must reach the final pre-cutover runtime proof");
  assert.equal(result.status, "completed", result.detail);
  assert.equal(result.sourceAbsent, true);
  assert.equal(result.selectedProvider, "backlog");
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  const current = JSON.parse(readFileSync(join(fixture.root, ".prime-claw", "ownership.json"), "utf8")).owners[owner.ownerSessionId];
  assertOwnedBacklogGitEvidence(current, { root: fixture.root, store: join(fixture.root, ".backlog"),
    episodeStore: join(owner.episode, ".backlog"), revision: result.receipt.destinationReceiptRevision,
    taskId: result.receipt.mappings.find((row) => row.sourceTaskId === fixture.ids.parent).destinationTaskId });
  assert.equal(current.episodeActiveSessionId, replacementRoute);
  for (const field of ["ownerSessionId", "operationId", "engine", "baseRef", "createdAt", "worktree", "branch", "head", "episodeId", "episodeSessionFile"]) {
    assert.deepEqual(current[field], owner.record[field], field);
  }
  assert.equal(readFileSync(current.episodeSessionFile, "utf8"), sessionBefore);
  assert.equal(git(owner.episode, "rev-parse", "HEAD"), owner.episodeHead);
  assert.equal(git(fixture.root, "rev-parse", "HEAD"), primaryHead);
  assert.deepEqual(runner.sourcePublicationCommands, []);
});

test("unavailable committed Backlog owner evidence blocks before ownership or Beads source retirement", { timeout: 240_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "owner-git-evidence-unavailable");
  const ownedTitle = "Evidence unavailable owned task";
  bd(fixture.root, "update", fixture.ids.parent, "--title", ownedTitle);
  const owner = addActiveBeadsOwner(fixture);
  const runner = new AsIsBeadsRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  const store = join(fixture.root, ".backlog");
  const registryPath = join(fixture.root, ".prime-claw", "ownership.json");
  const registry = readFileSync(registryPath);
  const sourceBefore = sourceAuthorityFiles(fixture.root);
  const realGit = command(fixture.outer, "sh", ["-c", "command -v git"]).trim();
  const bin = join(fixture.outer, "evidence-bin");
  const blockedLookup = join(fixture.outer, "blocked-evidence-lookup");
  mkdirSync(bin);
  // Hide only the exact evidence read, not the receipt or native task views.
  writeFileSync(join(bin, "git"), `#!/bin/sh
if [ "$1" = --no-replace-objects ] && [ "$2" = -C ] && [ "$3" = "$FIXTURE_EVIDENCE_STORE" ] &&
   [ "$4" = --literal-pathspecs ] && [ "$5" = ls-tree ] && [ "$6" = -z ] && [ "$8" = -- ] &&
   "${realGit}" --no-replace-objects -C "$3" show "$7:$9" | grep -Fxq 'title: ${ownedTitle}'; then
  printf '%s\\n' "$7" "$9" > "$FIXTURE_EVIDENCE_LOG"
  exit 0
fi
exec "${realGit}" "$@"
`, { mode: 0o755 });
  const restoreEnv = { PATH: process.env.PATH, FIXTURE_EVIDENCE_STORE: process.env.FIXTURE_EVIDENCE_STORE,
    FIXTURE_EVIDENCE_LOG: process.env.FIXTURE_EVIDENCE_LOG };
  let result, deletions = 0, switchedRuntimeProofs = 0;
  try {
    process.env.PATH = `${bin}:${restoreEnv.PATH}`;
    process.env.FIXTURE_EVIDENCE_STORE = store;
    process.env.FIXTURE_EVIDENCE_LOG = blockedLookup;
    result = await migrateTaskProvider({
      cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: inspection.sourceRevision,
      confirmedSwitch: true, actor: "migration-operator", semanticPlacement: "Preserve complete native source evidence.",
      async verifyActiveRuntime(records) {
        switchedRuntimeProofs += records.filter((row) => row.provider === "backlog").length;
        return proveFixtureRuntime(records);
      },
      deleteSource() { deletions += 1; },
    });
  } finally {
    for (const [key, value] of Object.entries(restoreEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  assert.equal(result.status, "blocked", result.detail);
  assert.equal(result.code, "pre-cutover-failed");
  assert.match(result.detail, /Backlog evidence.*exact regular ticket blob/);
  assert.equal(switchedRuntimeProofs, 0);
  assert.equal(deletions, 0);
  assert.deepEqual(readFileSync(registryPath), registry);
  assert.deepEqual(sourceAuthorityFiles(fixture.root), sourceBefore);
  assert.equal(existsSync(join(fixture.root, ".beads")), true);
  assert.equal(git(owner.episode, "rev-parse", "HEAD"), owner.episodeHead);

  const [revision, path] = readFileSync(blockedLookup, "utf8").trimEnd().split("\n");
  assert.equal(git(store, "ls-remote", "--refs", "origin", TASK_HISTORY_REF).split(/\s+/)[0], revision);
  const receiptFile = Object.entries(physicalDestinationRecords(store)).find(([, bytes]) =>
    Buffer.from(bytes, "base64").toString("utf8").includes("title: Prime Claw task-provider migration receipt"))[0];
  const receiptBlob = command(store, "git", ["show", `${revision}:${receiptFile}`]);
  const receipt = JSON.parse(receiptBlob.match(/```json\n([\s\S]+?)\n```/)[1]);
  const taskId = receipt.mappings.find((row) => row.sourceTaskId === fixture.ids.parent).destinationTaskId;
  assert.equal(command(store, "git", ["show", `${revision}:${path}`]).split("\n---", 1)[0].match(/^id: (.+)$/m)?.[1], taskId);
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


test("fresh destination memory loss blocks before ownership switches or the original is retired", { timeout: 240_000 }, async t => {
  const fixture = embeddedBeadsSource(t, "fresh-memory-loss");
  bd(fixture.root, "remember", "Restore the exact native index", "--key", "fixture");
  addActiveBeadsOwner(fixture);
  const options = { cwd: fixture.root, targetProvider: "backlog", runner: new AsIsBeadsRunner() };
  const inspection = inspectTaskProviderMigration(options);
  assert.equal(inspection.status, "ready", inspection.detail);
  const registry = join(fixture.root, ".prime-claw", "ownership.json"), original = readFileSync(registry);
  const source = sourceAuthorityFiles(fixture.root), exported = bd(fixture.root, "--readonly", "export", "--all");
  let removed = false, deletions = 0, proofs = 0;
  const result = await migrateTaskProvider({ ...options, confirmedSwitch: true, expectedSourceRevision: inspection.sourceRevision,
    actor: "memory-loss-fixture", semanticPlacement: "Preserve the native memory records and source meaning.",
    async verifyActiveRuntime(records) {
      if (++proofs === 2) {
        const path = join(fixture.root, ".backlog", "docs");
        const index = readdirSync(path).find(name => /Imported-Beads.*Index/i.test(name));
        assert.ok(index, "expected published memory index before cutover");
        rmSync(join(path, index)); removed = true;
      }
      return proveFixtureRuntime(records);
    }, deleteSource() { deletions++; },
  });
  assert.ok(removed);
  assert.equal(result.status, "blocked", result.detail);
  assert.match(result.detail, /not clean|mismatch/i);
  assert.equal(deletions, 0);
  assert.deepEqual(readFileSync(registry), original);
  assert.deepEqual(sourceAuthorityFiles(fixture.root), source);
  assert.equal(bd(fixture.root, "--readonly", "export", "--all"), exported);
});

test("active Beads Episode deletion refusal retains the published receipt without admitting another import", { timeout: 300_000 }, async (t) => {
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
  const registryPath = join(fixture.root, ".prime-claw", "ownership.json");
  assert.equal(JSON.parse(readFileSync(registryPath, "utf8")).owners[owner.ownerSessionId].provider, "beads");
  await assertExistingDestinationRefused(fixture, inspection, [".backlog", "backlog.config.yml", TASK_HISTORY_REF]);
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




test("current native migration preserves type, priority and metadata-shaped source comments", { timeout: 300_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "current-native-bookkeeping");
  const sourceComments = [
    "prime-claw-task-provider-migration-source-v1 mapping ordinary current source prose Ω",
    "prime-claw-task-provider-migration-receipt-v1\nAn ordinary current source comment, not a destination receipt.",
  ];
  for (const body of sourceComments) bd(fixture.root, "comments", "add", fixture.ids.parent, body, "--author", "source-marker-author");
  bd(fixture.root, "remember", "One current separate memory Ω", "--key", "configured-public-memory");
  const types = ["bug", "feature", "enhancement", "task", "chore", "docs", "spike"];
  const priorities = ["high", "medium", "low"];
  const current = captureBeadsCurrentTasks(fixture.root, Object.values(fixture.ids));
  const runner = new AsIsBeadsRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  const request = {
    cwd: fixture.root, targetProvider: "backlog", runner, expectedSourceRevision: inspection.sourceRevision,
    confirmedSwitch: true, actor: "configured-native-fixture", now: () => "2026-11-21T00:00:00.000Z",
    semanticPlacement: "Preserve current fields and actual comments; respect configured native values.",
  };
  const first = await migrateTaskProvider(request);
  assert.equal(first.status, "completed", first.detail);
  const records = physicalDestinationRecords(join(fixture.root, ".backlog"));
  const receiptMarkdown = Object.values(records).map((value) => Buffer.from(value, "base64").toString("utf8"))
    .find((value) => /^title: Prime Claw task-provider migration receipt$/m.test(value));
  assert.ok(receiptMarkdown);
  const receiptId = receiptMarkdown.match(/^id: (.+)$/m)[1];
  const receiptTask = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", receiptId)).task;
  const receipt = JSON.parse(receiptTask.implementationNotes.match(/^```json\n([\s\S]+)\n```$/)[1]);
  const mapping = Object.fromEntries(receipt.mappings.map((row) => [row.sourceTaskId, row.destinationTaskId]));
  assert.equal(receiptTask.type, "task");
  const userTask = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", receipt.backlogMemoryOutputs.userTask.taskId)).task;
  assert.equal(userTask.type, "task");
  assert.equal(receipt.backlogMemoryOutputs.documents.length, 1);
  for (const [sourceId, id] of Object.entries(mapping)) {
    const pkg = current[sourceId];
    const parent = pkg.nativeView.parent ?? pkg.exportRow.parent;
    const dependencies = nativeBlockingTargets(pkg).map(sourceId => mapping[sourceId] ?? sourceId);
    const projection = projectBeadsCurrentTask(pkg, {
      sourceRevision: inspection.sourceRevision, sourceDigest: inspection.sourceDigest,
      status: ({ open: "In Design", in_progress: "In Progress", blocked: "Blocked" })[pkg.nativeView.status],
      ...(parent ? { parentTaskId: mapping[parent] } : {}), dependencies, types, priorities,
    });
    const view = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", id));
    assertBeadsCurrentTask(view, projection, id);
    if (sourceId === fixture.ids.parent) {
      assert.equal(view.task.type, "bug");
      assert.equal(view.task.priority.toLowerCase(), "high");
      for (const body of sourceComments) assert.ok(view.task.comments.some((comment) => comment.body.startsWith(body)),
        "real source metadata-shaped prose remains an ordinary authored comment");
      assert.equal(view.task.comments.length, current[sourceId].nativeView.comments.length);
    }
  }
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  assert.equal(git(join(fixture.root, ".backlog"), "status", "--porcelain=v1"), "");
});


const OPERATOR_STOP_AGENT = process.env.PRIME_CLAW_STOP_AGENT;
test("public Prime Agent RPC abort stops actual migration after an accepted native PUT", {
  skip: !OPERATOR_STOP_AGENT, timeout: 170_000,
}, async (t) => {
  assert.ok(process.platform === "linux" && existsSync("/.dockerenv"));
  const fixture = repository(t, "public-operator-stop");
  bd(fixture.root, "init", "--skip-hooks", "--skip-agents", "--prefix", "STOP", "--quiet", "--non-interactive");
  bd(fixture.root, "dolt", "remote", "remove", "origin");
  const parent = JSON.parse(bd(fixture.root, "create", "First native task", "--json")).id;
  bd(fixture.root, "create", "Later native child", "--parent", parent, "--json");
  bd(fixture.root, "comments", "add", parent, "accepted native comment Ω", "--author", "native-source");
  git(fixture.root, "add", "-A");
  if (git(fixture.root, "status", "--porcelain=v1")) git(fixture.root, "commit", "-qm", "seed operator stop fixture");
  git(fixture.root, "push", "-q");
  const codeHead = git(fixture.root, "rev-parse", "HEAD");
  const sourceFiles = sourceAuthorityFiles(fixture.root);
  const sourceExport = bd(fixture.root, "--readonly", "export", "--all");
  const ownership = join(fixture.root, ".prime-claw", "ownership.json");
  assert.equal(existsSync(ownership), false);

  const evidence = join(fixture.outer, "evidence");
  const bin = join(fixture.outer, "bin");
  mkdirSync(evidence, { mode: 0o700 });
  mkdirSync(bin, { mode: 0o700 });
  for (const [name, executable] of Object.entries({ backlog: BACKLOG, bd: "/usr/local/bin/bd", git: "/usr/bin/git", dolt: "/usr/local/bin/dolt" })) {
    const browserPid = name === "backlog"
      ? 'if [ "${1-}" = browser ]; then printf "%s\\n" "$$" > "$PRIME_CLAW_STOP_FIXTURE/browser.pid"; fi\n'
      : "";
    writeFileSync(join(bin, name), `#!/bin/sh\nset -eu\nprintf '%s\\n' '${name} '"$*" >> "$PRIME_CLAW_STOP_FIXTURE/native.log"\n${browserPid}exec "${executable}" "$@"\n`, { mode: 0o700 });
  }
  const rows = (name) => {
    const path = join(evidence, `${name}.jsonl`);
    // Ignore a trailing incomplete line while the daemon appends evidence.
    return existsSync(path) ? readFileSync(path, "utf8").split("\n").slice(0, -1).map(JSON.parse) : [];
  };
  let accepted, downstreamClosed = false, relayError;
  const relay = http.createServer((req, res) => {
    const url = req.headers["x-fixture-native-url"];
    if (req.method !== "PUT" || typeof url !== "string" || !/^http:\/\/127\.0\.0\.1:\d+\/api\/tasks\/[^/?]+$/.test(url)) {
      relayError = new Error(`unexpected fixture relay request: ${req.method} ${url}`);
      res.writeHead(400).end();
      return;
    }
    res.once("close", () => { downstreamClosed = true; });
    const headers = { "content-type": req.headers["content-type"], "content-length": req.headers["content-length"] };
    const upstream = http.request(url, { method: "PUT", headers, agent: false }, (response) => {
      response.on("error", (error) => { relayError = error; });
      response.once("end", () => { accepted = { url, status: response.statusCode }; });
      response.resume();
      // Deliberately send no headers/body to the native migration client.
      // Its request stays pending until the real operator RPC abort destroys it.
    });
    upstream.on("error", (error) => { relayError = error; });
    req.pipe(upstream);
  });
  relay.listen(0, "127.0.0.1");
  await once(relay, "listening");
  const rpc = spawn("/workspace/scripts/run-prime-agent-probe.sh", [
    OPERATOR_STOP_AGENT, "--mode", "rpc", "--offline", "--no-session", "--no-extensions",
    "--no-context-files", "--no-skills", "--no-prompt-templates", "--no-builtin-tools",
    "-e", "/workspace/tests/container/operator_migration_stop_extension.ts",
    "--provider", "migration-stop-fixture", "--model", "fixture",
  ], {
    cwd: fixture.root,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, DO_NOT_TRACK: "1",
      PRIME_CLAW_STOP_FIXTURE: evidence, PRIME_CLAW_STOP_RELAY: `http://127.0.0.1:${relay.address().port}/hold` },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "", exited = false;
  rpc.stderr.setEncoding("utf8").on("data", (value) => { stderr += value; });
  rpc.stdin.on("error", (error) => { stderr += `\n${error.message}`; });
  const exit = once(rpc, "close").then(([code, signal]) => { exited = true; return { code, signal }; });
  const frames = [];
  const frameTimes = new Map();
  const lines = createInterface({ input: rpc.stdout });
  lines.on("line", (line) => {
    try {
      const frame = JSON.parse(line);
      frameTimes.set(frame, performance.now());
      frames.push(frame);
    } catch { stderr += `\nstdout: ${line}`; }
  });
  const send = (frame) => rpc.stdin.write(`${JSON.stringify(frame)}\n`);
  const pollIntervalMs = 25;
  const wait = async (label, predicate, timeoutMs = 60_000, started = performance.now()) => {
    const end = started + timeoutMs;
    do {
      if (relayError) throw relayError;
      const value = predicate();
      if (value) return value;
      if (exited) break;
      await delay(pollIntervalMs);
    } while (performance.now() < end);
    assert.fail(`${label} not observed; frames: ${JSON.stringify(frames.slice(-12))}; stderr: ${stderr}`);
  };
  const response = (id) => frames.find((frame) => frame.type === "response" && frame.id === id);
  try {
    send({ id: "inspect", type: "prompt", message: "Inspect this disposable Beads-to-Backlog migration only." });
    const inspection = await wait("actual switch-request result", () => rows("switch-request")[0]);
    assert.equal(inspection.status, "ready", JSON.stringify(inspection));
    assert.equal((await wait("inspection RPC response", () => response("inspect"))).success, true);
    await wait("inspection turn end", () => frames.some((frame) => frame.type === "agent_end"));
    const turnStart = frames.length;
    send({ id: "confirm", type: "prompt", message: `I approve this one-way migration and Beads deletion for exact revision ${inspection.sourceRevision}. All task mutation is quiesced.` });
    const put = await wait("real native PUT response held by relay", () => {
      assert.deepEqual(rows("switch-confirm"), [], "migration must not settle before the native write barrier");
      return accepted;
    });
    assert.equal(put.status, 200);
    assert.equal(downstreamClosed, false, "native 200 has not reached the migration client");
    const browserPid = Number(readFileSync(join(evidence, "browser.pid"), "utf8"));
    assert.ok(Number.isSafeInteger(browserPid) && browserPid > 1);
    process.kill(-browserPid, 0);
    const store = join(fixture.root, ".backlog");
    const partial = physicalDestinationRecords(store);
    assert.equal(Object.keys(partial).length, 1);
    const markdown = Buffer.from(Object.values(partial)[0], "base64").toString("utf8");
    assert.match(markdown, /First native task/);
    assert.match(markdown, /accepted native comment Ω/);
    const requests = rows("http");
    assert.deepEqual(requests.map(({ method }) => method), ["POST", "PUT"]);
    assert.equal(requests[1].url, put.url);
    const commandTrace = readFileSync(join(evidence, "native.log"), "utf8");
    const taskHistory = git(fixture.remote, "for-each-ref", "--format=%(objectname)", TASK_HISTORY_REF);

    const stopDeadlineMs = 15_000;
    const stopSentAt = performance.now();
    send({ id: "stop", type: "abort" }); // The only cancellation trigger.
    const observeStop = (label, predicate) => wait(label, predicate, stopDeadlineMs, stopSentAt);
    const notification = (severity, pattern) => frames.slice(turnStart).find((frame) =>
      frame.type === "extension_ui_request" && frame.method === "notify" &&
      frame.notifyType === severity && pattern.test(frame.message));
    const [ack, settled, reaped, progress, finalNotice] = await Promise.all([
      observeStop("public abort acknowledgement", () => response("stop")),
      observeStop("actual initializer settlement independent of agent turn", () => {
        const result = rows("switch-confirm")[0];
        return result && { result, at: performance.now() };
      }),
      observeStop("owned browser group ESRCH before RPC teardown", () => {
        try { process.kill(-browserPid, 0); }
        catch (error) {
          if (error.code !== "ESRCH") throw error;
          return { at: performance.now() };
        }
      }),
      observeStop("RPC progress notification", () => notification("info", /Importing and verifying Backlog tasks \(\d+\.\d+ s elapsed\)$/)),
      observeStop("RPC final stop notification", () => notification("warning", /blocked \(pre-cutover-stopped\):.*\(\d+\.\d+ s elapsed\)$/)),
      observeStop("aborted agent turn end", () => frames.slice(turnStart).some((frame) => frame.type === "agent_end")),
      observeStop("relay observes client disconnect", () => downstreamClosed),
    ]);
    assert.equal(ack.success, true);
    const { result } = settled;
    assert.equal(result.status, "blocked", JSON.stringify(result));
    assert.equal(result.code, "pre-cutover-stopped");
    assert.match(result.detail, /uncertain/);
    assert.match(result.remediation, /source remains authoritative/);
    assert.match(finalNotice.message, /source remains authoritative/);
    const abortOutput = frames.slice(turnStart).find((frame) => frame.type === "tool_execution_end"
      && frame.toolName === "initialize_prime_claw" && frame.isError)?.result?.content
      ?.find(({ text }) => text === "Tool execution aborted")?.text ?? null;
    const available = http.createServer();
    available.listen(Number(new URL(put.url).port), "127.0.0.1");
    await once(available, "listening");
    await new Promise((resolve) => available.close(resolve));
    assert.deepEqual(rows("http"), requests, "no later native request or resend");
    assert.equal(readFileSync(join(evidence, "native.log"), "utf8"), commandTrace, "no later native CLI command");
    assert.deepEqual(physicalDestinationRecords(store), partial, "no later task, receipt, rewrite, or cleanup");
    const taskId = decodeURIComponent(new URL(put.url).pathname.split("/").at(-1));
    const view = JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", taskId));
    assert.equal(view.kind, "task-view");
    assert.equal(view.task.id, taskId);
    assert.equal(view.task.title, "First native task");
    assert.equal(view.task.comments.length, 1);
    assert.equal(view.task.comments[0].author, "native-source");
    assert.equal(view.task.comments[0].body.split("\n")[0], "accepted native comment Ω");
    assert.deepEqual(view.task.references, [
      `prime-claw-beads-source:${parent}`,
      `prime-claw-beads-current:${JSON.stringify({ sourceTaskId: parent,
        sourceRevision: inspection.sourceRevision, sourceDigest: inspection.sourceDigest }, null, 2)}`,
    ]);
    assert.deepEqual(sourceAuthorityFiles(fixture.root), sourceFiles);
    assert.equal(bd(fixture.root, "--readonly", "export", "--all"), sourceExport);
    assert.equal(existsSync(ownership), false, "no ownership cutover");
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), codeHead);
    assert.equal(git(fixture.remote, "rev-parse", "refs/heads/main"), codeHead);
    assert.equal(git(fixture.remote, "for-each-ref", "--format=%(objectname)", TASK_HISTORY_REF), taskHistory);
    const sinceAbortMs = (observedAt) => Number((observedAt - stopSentAt).toFixed(3));
    const observations = {
      rpcAckMs: sinceAbortMs(frameTimes.get(ack)),
      toolSettlementObservedMs: sinceAbortMs(settled.at),
      groupEsrchObservedMs: sinceAbortMs(reaped.at),
    };
    assert.ok(Object.values(observations).every((ms) => ms >= 0 && ms <= stopDeadlineMs), JSON.stringify(observations));
    t.diagnostic(JSON.stringify({ event: "operator-migration-stop", ...observations, pollIntervalMs,
      stopDeadlineMs, nativePutStatus: put.status, browserPgid: browserPid, taskId,
      code: result.code, progressNotification: progress.message, finalNotification: finalNotice.message, abortOutput }));
  } finally {
    // Failure-only teardown can break the relay, but no positive assertion above
    // is run after teardown and cannot mistake this for successful RPC abort.
    relay.closeAllConnections();
    await new Promise((resolve) => relay.close(resolve));
    rpc.stdin.end();
    const end = await Promise.race([exit, delay(12_000, undefined, { ref: false })]);
    if (!end) rpc.kill("SIGTERM");
    assert.equal(end?.code, 0, `${JSON.stringify(end)}; ${stderr}`);
  }
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
  await assertExistingDestinationRefused(fixture, inspection, [".backlog", "backlog.config.yml", TASK_HISTORY_REF]);
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



test("native Beads deferred tasks project to In Design without active deferral and failed retirement preserves source authority", { timeout: 300_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "embedded-deferred");
  bd(fixture.root, "dep", "add", fixture.ids.child, fixture.ids.blocked, "--type", "discovered-from");
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
  const typedMapping = Object.fromEntries(firstReceipt.receipt.mappings.map(row => [row.sourceTaskId, row.destinationTaskId]));
  const typedChild = () => JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", typedMapping[fixture.ids.child])).task;
  const typedBefore = typedChild();
  assert.deepEqual(typedBefore.dependencies, []);
  assert.equal(typedBefore.comments.length, 1);
  assert.ok(typedBefore.comments[0].body.includes(`- discovered-from: ${fixture.ids.blocked} -> ${typedMapping[fixture.ids.blocked]}`));
  await assertExistingDestinationRefused(fixture, inspection, [".backlog", "backlog.config.yml", TASK_HISTORY_REF]);
  assert.equal(retirements, 1);
  assert.ok(!runner.reads.some(({ args }) => ["history", "provenance"].includes(args[1])),
    "confirmation and admission refusal must not read source history/provenance");
  const replayReceipt = readReceipt();
  assert.equal(replayReceipt.id, firstReceipt.id);
  assert.equal(replayReceipt.receipt.semanticPlacement, request.semanticPlacement);
  assert.equal(replayReceipt.receipt.destinationDataDigest, firstReceipt.receipt.destinationDataDigest);
  assert.deepEqual(typedChild(), typedBefore);
  assert.deepEqual(replayReceipt.receipt.mappings, firstReceipt.receipt.mappings, "refusal preserves destination identities");
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
    "inspection, import and refusal must not normalize or auto-wake retiring source tasks");
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
  const recovery = recoveryEvidence(fixture);
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
  const primaryHead = git(fixture.root, "rev-parse", "HEAD");
  const primaryIndex = command(fixture.root, "git", ["ls-files", "--stage", "-z"]);
  const episodeIndex = command(owner.episode, "git", ["ls-files", "--stage", "-z"]);
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
      assert.equal(records.length, 1);
      assert.equal(records[0].episodeId, owner.record.episodeId);
      assert.deepEqual(sourceAuthorityFiles(fixture.root), before, "source authority changed before guarded retirement");
      if (runtimeProofs === 2) {
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
  assertRetainedBackupRestores(fixture, result, recovery, "Embedded original");
  assert.ok(runtimeProofs === 2, "active continuity must be proved through ownership cutover");
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
  assert.equal(git(owner.episode, "rev-parse", "HEAD"), laterHead, "migration must not commit Episode code metadata");
  assert.equal(git(owner.episode, "ls-remote", "--refs", "origin", `refs/heads/${owner.record.branch}`).split(/\s+/)[0], laterHead);
  assert.equal(git(fixture.root, "rev-parse", "HEAD"), primaryHead, "migration must not commit primary code metadata");
  assert.equal(command(fixture.root, "git", ["ls-files", "--stage", "-z"]), primaryIndex);
  assert.equal(command(owner.episode, "git", ["ls-files", "--stage", "-z"]), episodeIndex);
  assertOwnedBacklogGitEvidence(current, { root: fixture.root, store,
    episodeStore: join(owner.episode, ".backlog"), taskId: current.taskId, revision: result.receipt.destinationReceiptRevision });
  assert.ok(runner.reads.filter(({ args }) => JSON.stringify(args) === JSON.stringify(BEADS_INVENTORY)).length >= 4,
    "inspection, confirmation, cutover and guarded retirement each bind complete current source data");
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
  for (const { commandName, args } of runner.calls) {
    assert.notEqual(commandName, "backlog", "admission must not start the native destination");
    if (commandName === "git") assert.ok(!args.some(arg => ["add", "commit", "push", "fetch", "clone", "checkout", "init", "merge", "reset", "update-ref"].includes(arg)), args.join(" "));
  }
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

function admissionTree(path) {
  return Object.fromEntries(readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((item) => item.isDirectory()
      ? Object.entries(admissionTree(join(path, item.name))).map(([key, value]) => [`${item.name}/${key}`, value])
      : [[item.name, readFileSync(join(path, item.name)).toString("base64")]]));
}

function admissionEntry(path) {
  const stat = lstatSync(path);
  return { mode: stat.mode, ...(stat.isSymbolicLink() ? { link: readlinkSync(path) }
    : stat.isDirectory() ? { children: Object.fromEntries(readdirSync(path).filter(name => name !== ".git")
      .map(name => [name, admissionEntry(join(path, name))])) }
    : { bytes: readFileSync(path).toString("base64") }) };
}

// Use the genuine revision inspected before destination evidence appeared.
async function assertExistingDestinationRefused(fixture, original, markers) {
  const { root, remote } = fixture;
  const gitState = path => ({ head: git(path, "rev-parse", "HEAD"), refs: git(path, "show-ref"),
    index: git(path, "ls-files", "--stage"), status: git(path, "status", "--porcelain=v1") });
  const snapshot = () => ({
    source: sourceAuthorityFiles(root), export: bd(root, "--readonly", "export", "--all"),
    catalog: bd(root, "--readonly", "statuses", "--json"), code: gitState(root), remoteRefs: git(remote, "show-ref"),
    layout: Object.fromEntries(readdirSync(root).filter(name => ![".git", ".beads", ".beads.gate.lock"].includes(name))
      .map(name => [name, admissionEntry(join(root, name))])),
    exclude: readFileSync(join(root, ".git", "info", "exclude"), "utf8"),
    destinationGit: existsSync(join(root, ".backlog", ".git")) ? gitState(join(root, ".backlog")) : null,
  });
  const before = snapshot();
  for (const entry of ["inspect", "confirm"]) {
    const runner = new AdmissionRunner();
    const options = { cwd: root, targetProvider: "backlog", runner };
    let result, retirements = 0;
    if (entry === "inspect") result = inspectTaskProviderMigration(options);
    else {
      const observed = await observeCompletionMigration({ ...options, expectedSourceRevision: original.sourceRevision,
        confirmedSwitch: true, actor: "admission-fixture", semanticPlacement: "Keep every source field.",
        deleteSource() { retirements++; } });
      result = observed.result;
      assert.deepEqual(observed.requests, []);
    }
    assert.equal(result.status, "blocked", result.detail);
    assert.match(result.detail, /existing Backlog destination/);
    assert.ok(markers.some(marker => result.detail.includes(marker)), result.detail);
    assert.equal(retirements, 0);
    assertNoAdmissionWrites(runner);
    assert.deepEqual(snapshot(), before, `${entry} must leave source, ownership, destination and Git state unchanged`);
  }
}

for (const [kind, markers] of [
  ["empty", [".backlog"]], ["partial", ["backlog.config.yml"]], ["dangling-link", ["backlog.config.yml"]],
  ["populated", ["backlog"]], ["custom", ["backlog.config.yml", "planning/task store"]],
  ["parked", ["backlog"]], ["remote-only", [TASK_HISTORY_REF]], ["local-ref-only", [TASK_HISTORY_REF]],
]) {
  test(`migration admission refuses existing Backlog destination: ${kind}`, { timeout: 180_000 }, async t => {
    const fixture = embeddedBeadsSource(t, `admission-${kind}`);
    const { root, remote } = fixture;
    addActiveBeadsOwner(fixture);
    const original = inspectTaskProviderMigration({ cwd: root, targetProvider: "backlog", runner: new AsIsBeadsRunner() });
    assert.equal(original.status, "ready", original.detail);
    if (kind === "empty") mkdirSync(join(root, ".backlog"));
    if (kind === "partial") writeFileSync(join(root, "backlog.config.yml"), "incomplete: [\n");
    if (kind === "dangling-link") symlinkSync("missing/config.yml", join(root, "backlog.config.yml"));
    if (["populated", "custom", "parked"].includes(kind)) {
      const destination = coexistenceDestination(fixture, kind === "custom" ? "planning/task store" : "backlog");
      if (kind === "parked") renameSync(destination.configPath, `${destination.configPath}.pre-migration`);
    }
    // Seed just one side directly: a fetch or push would seed both.
    if (kind === "remote-only") git(remote, "update-ref", TASK_HISTORY_REF, "refs/heads/main");
    if (kind === "local-ref-only") git(root, "update-ref", TASK_HISTORY_REF, "HEAD");
    await assertExistingDestinationRefused(fixture, original, markers);
  });
}

test("migration admission refuses absent Beads on a fresh project", { timeout: 90_000 }, (t) => {
  const fixture = repository(t, "admission-no-provider");
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


// Independent native destination published before any migration attempt. Native
// allocation reserves IDs across active, canonical archive, legacy archive and drafts.
function publishedPopulatedBacklogDestination(fixture, noHardlinks = false) {
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
  command(fixture.root, "git", ["clone", "-q", ...(noHardlinks ? ["--no-hardlinks"] : []), "--branch", "prime-claw/tasks", "--single-branch", fixture.remote, store]);
  const exclude = join(fixture.root, ".git", "info", "exclude");
  writeFileSync(exclude, readFileSync(exclude, "utf8") + "\n.backlog/\n");
  const baseline = Object.fromEntries(git(store, "ls-files").split(/\r?\n/).map((path) => [path, {
    bytes: readFileSync(join(store, path)).toString("base64"),
    history: git(store, "log", "--follow", "--format=fuller", "--binary", "-p", "--", path),
  }]));
  return { store, active, completed, archived, legacy, draft, baseline };
}

class ReceiptPublicationRunner extends AdmissionRunner {
  run(commandName, args, options = {}) {
    const result = super.run(commandName, args, options);
    if (commandName === "backlog" && args[0] === "task" && args[1] === "view" && result.status === 0) {
      const task = JSON.parse(result.stdout).task;
      if (task.title === "Prime Claw task-provider migration receipt" && task.status === "Done") this.completeReceiptTask = task;
    }
    return result;
  }
}

function publishedReceipt(runner, store, inspection) {
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

test("typed Beads relationships preserve meaning without false dependency cycles", { timeout: 240_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "typed-relationship-migration");
  bd(fixture.root, "dep", "relate", fixture.ids.parent, fixture.ids.blocked);
  bd(fixture.root, "dep", "add", fixture.ids.child, fixture.ids.blocked, "--type", "discovered-from");
  const runner = new AsIsBeadsRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  const semanticPlacement = "Place non-blocking typed Beads relationships in readable migration comments; preserve current native content.";
  const result = await migrateTaskProvider({ cwd: fixture.root, targetProvider: "backlog", runner,
    expectedSourceRevision: inspection.sourceRevision, confirmedSwitch: true, actor: "operator",
    semanticPlacement, verifyActiveRuntime: proveFixtureRuntime });
  assert.equal(result.status, "completed", result.detail);
  const mappings = Object.fromEntries(result.receipt.mappings.map((row) => [row.sourceTaskId, row.destinationTaskId]));
  const view = (sourceId) => JSON.parse(backlog(fixture.root, "task", "view", "--json", "--", mappings[sourceId])).task;
  const parent = view(fixture.ids.parent), child = view(fixture.ids.child), blocked = view(fixture.ids.blocked);
  assert.deepEqual(parent.dependencies, []);
  assert.deepEqual(child.dependencies, []);
  assert.deepEqual(blocked.dependencies, [mappings[fixture.ids.child]]);
  const relationComment = (task) => task.comments.map((comment) => String(comment.text ?? comment.content ?? comment.body ?? ""))
    .find((text) => text.startsWith("prime-claw-task-provider-migration-relationships-v1\n"));
  assert.equal(relationComment(parent), `prime-claw-task-provider-migration-relationships-v1\nSource Beads relationships with no native Backlog dependency equivalent:\n- relates-to: ${fixture.ids.blocked} -> ${mappings[fixture.ids.blocked]}\n\nSemantic placement: ${semanticPlacement}`);
  assert.equal(relationComment(child), `prime-claw-task-provider-migration-relationships-v1\nSource Beads relationships with no native Backlog dependency equivalent:\n- discovered-from: ${fixture.ids.blocked} -> ${mappings[fixture.ids.blocked]}\n\nSemantic placement: ${semanticPlacement}`);
  assert.equal(relationComment(blocked), `prime-claw-task-provider-migration-relationships-v1\nSource Beads relationships with no native Backlog dependency equivalent:\n- relates-to: ${fixture.ids.parent} -> ${mappings[fixture.ids.parent]}\n\nSemantic placement: ${semanticPlacement}`);
  assert.equal(child.parentTaskId, mappings[fixture.ids.parent]);
  assert.ok(parent.comments.some(comment => comment.author === "source-author" && comment.body.includes("embedded native comment Ω")));
  for (const task of [parent, child, blocked]) {
    assert.equal(task.comments.filter(comment => comment.author === "prime-claw-migration"
      && comment.body.startsWith("prime-claw-task-provider-migration-relationships-v1\n")).length, 1);
  }
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
});

test("true Beads blocking cycles still fail before destination mutation", { timeout: 120_000 }, (t) => {
  const fixture = beadsSource(t, "blocking-cycle-preflight");
  bd(fixture.root, "dep", "add", fixture.ids.parent, fixture.ids.archived);
  bd(fixture.root, "sql", `INSERT INTO dependencies (id, issue_id, type, created_by, depends_on_issue_id) VALUES ('00000000-0000-0000-0000-000000000062', '${fixture.ids.archived}', 'blocks', 'fixture', '${fixture.ids.parent}')`);
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner: new AsIsBeadsRunner() });
  assert.equal(inspection.status, "blocked");
  assert.match(inspection.detail, /dependency cycle/);
  assert.equal(existsSync(join(fixture.root, ".backlog")), false);
});

test("native archived-target source graph preserves mapped dependencies through migration", { timeout: 240_000 }, async (t) => {
  const fixture = embeddedBeadsSource(t, "archived-target-migration");
  const store = join(fixture.root, ".backlog");
  bd(fixture.root, "close", fixture.ids.child, "--reason",
    `Prime Claw abandonment: task ${fixture.ids.child}; pushed Episode head ${git(fixture.root, "rev-parse", "HEAD")}; code was not merged.`, "--force", "--json");
  const nativeCurrent = captureBeadsCurrentTasks(fixture.root, Object.values(fixture.ids));
  const before = sourceAuthorityFiles(fixture.root);
  class ArchivedDependencyRunner extends AsIsBeadsRunner {
    run(name, args, options = {}) {
      if (name === "git" && args.includes("push") && options.cwd === store) assert.deepEqual(sourceAuthorityFiles(fixture.root), before);
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
  assert.equal(existsSync(join(fixture.root, ".beads")), false);
  assert.equal(git(store, "status", "--porcelain=v1"), "");
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


// Synthetic, offline-only PVA gate. Timings are observations, not thresholds.
class PvaRehearsalRunner extends ReceiptPublicationRunner {
  constructor() { super(); this.pushes = []; }
  run(commandName, args, options = {}) {
    const taskPush = commandName === "git" && args.includes("push") && args.includes(`HEAD:${TASK_HISTORY_REF}`);
    try {
      const result = super.run(commandName, args, options);
      if (taskPush) this.pushes.push({ ms: performance.now() - this.start, status: result.status, index: this.calls.length });
      return result;
    } catch (error) {
      if (taskPush) this.pushes.push({ ms: performance.now() - this.start, status: "threw", index: this.calls.length });
      throw error;
    }
  }
}

function pvaBoundedText(label, lines) {
  return Array.from({ length: lines }, (_, i) => `${label} ${i + 1}: Ω 日本語 🌊 verify readable current data.`).join("\n");
}

test("PVA gate fresh timed current migration", { timeout: 480_000 }, async t => {
  const started = performance.now();
  const f = embeddedBeadsSource(t, "pva-timed");
  const store = join(f.root, ".backlog");
  const closed = addSourceCompletionDependency(f);
  Object.assign(f.ids, closed);
  const parent = f.ids.parent;
  const bodies = [];
  for (let i = 0; i < 7; i++) {
    const id = JSON.parse(bd(f.root, "create", `Synthetic current ${i + 1}`, "--description", pvaBoundedText(`Description ${i + 1}`, 380),
      "--design", pvaBoundedText(`Plan ${i + 1}`, 140), "--notes", pvaBoundedText(`Notes ${i + 1}`, 140), "--parent", parent, "--json")).id;
    f.ids[`bulk${i}`] = id;
    for (let n = 0; n < 6; n++) {
      const body = pvaBoundedText(`Comment ${i + 1}/${n + 1}`, 200);
      bodies.push(body);
      bd(f.root, "comments", "add", id, body, "--author", `public-author-${n % 3 + 1}`);
    }
  }
  for (const key of ["one", "two"]) bd(f.root, "remember", pvaBoundedText(`Memory ${key}`, 90), "--key", `pva-fixture-${key}`);
  const owner = addActiveBeadsOwner(f);
  const ownerPath = join(f.root, ".prime-claw", "ownership.json");
  const nativeCurrent = captureBeadsCurrentTasks(f.root, Object.values(f.ids));
  const nativeExportBytes = Buffer.byteLength(RUNNER.run("bd", ["--readonly", "export", "--all"], { cwd: f.root }).stdout);
  const nativeCurrentBytes = Object.values(nativeCurrent).reduce((n, { nativeView }) => n + Buffer.byteLength(JSON.stringify(nativeView)), 0);
  const sourceBefore = sourceAuthorityFiles(f.root);
  const exportBefore = bd(f.root, "--readonly", "export", "--all");
  const setupMs = performance.now() - started;
  const runner = new PvaRehearsalRunner();
  const inspectionStarted = performance.now();
  const inspection = inspectTaskProviderMigration({ cwd: f.root, targetProvider: "backlog", runner });
  const inspectionMs = performance.now() - inspectionStarted;
  assert.equal(inspection.status, "ready", inspection.detail);
  assert.equal(inspection.taskCounts.total, Object.keys(f.ids).length);
  const runtimeChecksMs = [];
  let retirementAtMs, hookOverheadMs, receiptProof, mappings, webFirstWriteMs, webLastWriteMs;
  const realRequest = http.request;
  http.request = function (...args) {
    if (["POST", "PUT"].includes(args[1]?.method)) {
      webLastWriteMs = performance.now() - runner.start;
      webFirstWriteMs ??= webLastWriteMs;
    }
    return realRequest.apply(this, args);
  };
  syncBuiltinESMExports();
  let observed;
  runner.start = performance.now();
  try {
    observed = await observeCompletionMigration({ cwd: f.root, targetProvider: "backlog", confirmedSwitch: true,
      actor: "timed-current-fixture", semanticPlacement: "Preserve native current task fields and relationships.",
      expectedSourceRevision: inspection.sourceRevision, runner,
      async verifyActiveRuntime(rows) {
        runtimeChecksMs.push({ ms: performance.now() - runner.start, provider: rows[0]?.provider });
        return proveFixtureRuntime(rows);
      },
      deleteSource(snapshot) {
        assert.equal(retirementAtMs, undefined);
        const cutoverStart = performance.now();
        retirementAtMs = cutoverStart - runner.start;
        assert.equal(snapshot.provider, "beads");
        assert.deepEqual(sourceAuthorityFiles(f.root), sourceBefore);
        assert.equal(bd(f.root, "--readonly", "export", "--all"), exportBefore);
        receiptProof = publishedReceipt(runner, store, inspection);
        mappings = Object.fromEntries(receiptProof.receipt.mappings.map(row => [row.sourceTaskId, row.destinationTaskId]));
        const switched = JSON.parse(readFileSync(ownerPath, "utf8")).owners[owner.ownerSessionId];
        assertOwnedBacklogGitEvidence(switched, { root: f.root, store,
          episodeStore: join(owner.episode, ".backlog"), revision: receiptProof.head, taskId: mappings[parent] });
        for (const field of ["operationId", "worktree", "branch", "episodeId", "episodeSessionFile", "episodeActiveSessionId"]) {
          assert.equal(switched[field], owner.record[field], field);
        }
        assert.equal(git(join(owner.episode, ".backlog"), "rev-parse", "HEAD"), receiptProof.head);
        hookOverheadMs = performance.now() - cutoverStart;
        rmSync(join(f.root, ".beads"), { recursive: true });
        rmSync(join(f.root, ".beads.gate.lock"), { force: true });
      },
    });
  } finally { http.request = realRequest; syncBuiltinESMExports(); }
  const confirmObservedMs = performance.now() - runner.start;
  const { result, requests } = observed;
  assert.equal(result.status, "completed", result.detail);
  assert.equal(result.receipt.destinationReceiptRevision, receiptProof.head);
  assert.equal(existsSync(join(f.root, ".beads")), false);
  assert.equal(Object.keys(mappings).length, inspection.taskCounts.total);
  assert.equal(new Set(Object.values(mappings)).size, inspection.taskCounts.total);
  assert.equal(Object.keys(physicalDestinationRecords(store)).length, inspection.taskCounts.total + 2);
  assert.equal(git(store, "rev-parse", `${receiptProof.head}^`), result.receipt.destinationDataRevision);
  let destinationBytes = 0, commentCount = 0;
  for (const [sourceId, id] of Object.entries(mappings)) {
    const view = JSON.parse(backlog(f.root, "task", "view", "--json", "--", id));
    assertCurrentBacklogTask(view, nativeCurrent[sourceId], inspection, mappings);
    commentCount += view.task.comments.length;
    destinationBytes += Buffer.byteLength(JSON.stringify(view));
  }
  assert.equal(commentCount, bodies.length + 1);
  const memory = result.receipt.backlogMemoryOutputs;
  assert.equal(memory.documents.length, 2);
  verifyBacklogMemoryOutputs(memory, f.root, RUNNER);
  const commandCounts = Object.fromEntries(["bd", "git", "backlog"].map(name =>
    [name, runner.calls.filter(call => call.commandName === name).length]));
  console.info(JSON.stringify({ pvaGate: "fresh", taskCounts: inspection.taskCounts, comments: commentCount,
    additionalCommentBodyBytes: bodies.reduce((n, body) => n + Buffer.byteLength(body), 0),
    nativeExportBytes, nativeCurrentBytes, destinationBytes, memoryCount: memory.documents.length,
    receiptId: result.receiptTaskId,
    dataRevision: result.receipt.destinationDataRevision, receiptRevision: receiptProof.head,
    setupMs, inspectionMs, webFirstWriteMs, webLastWriteMs, taskRefPushes: runner.pushes, retirementAtMs,
    hookOverheadMs, confirmObservedMs, postRunReadbackMs: performance.now() - runner.start - confirmObservedMs,
    commandCounts, webMethods: Object.fromEntries(["GET", "POST", "PUT"].map(method =>
      [method, requests.filter(request => request.method === method).length])), runtimeChecksMs }));
});

test("PVA gate safe failure after native comment acceptance", { timeout: 240_000 }, async t => {
  const setupStarted = performance.now();
  const fixture = repository(t, "pva-safe-failure");
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
  const runner = new AdmissionRunner();
  const inspection = inspectTaskProviderMigration({ cwd: fixture.root, targetProvider: "backlog", runner });
  assert.equal(inspection.status, "ready", inspection.detail);
  const foreign = repository(t, "pva-safe-failure-foreign-context");
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
  let originalNativeStatus, failureAtMs, callsAtFailure, publishedAtFailure;
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
  const setupMs = performance.now() - setupStarted;
  const originalRequest = http.request;
  http.request = function (...args) {
    const url = String(args[0]);
    const method = args[1]?.method ?? "GET";
    if (method === "POST" || method === "PUT") requests.push({ method, url });
    const callback = args.at(-1);
    if (method === "PUT" && originalNativeStatus === undefined && typeof callback === "function") {
      args[args.length - 1] = (response) => {
        originalNativeStatus = response.statusCode;
        publishedAtFailure = command(fixture.remote, "git", ["rev-parse", "--verify", TASK_HISTORY_REF], true);
        callsAtFailure = runner.calls.length;
        failureAtMs = performance.now() - started;
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
  const started = performance.now();
  let returnedAtMs;
  try {
    process.env.BACKLOG_CWD = foreign.root;
    first = await migrateTaskProvider(request);
    returnedAtMs = performance.now() - started;
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
  assert.equal(command(fixture.remote, "git", ["rev-parse", "--verify", TASK_HISTORY_REF], true), publishedAtFailure);
  assert.deepEqual(runner.calls.slice(callsAtFailure), [], "no later native commands after the uncertain write");
  console.info(JSON.stringify({ pvaGate: "in-flight native response failure", setupMs, failureAtMs, returnedAtMs,
    observedStopLatencyMs: returnedAtMs - failureAtMs, actualResponse: originalNativeStatus, exposedResponse: 503,
    writes: requests.map(row => row.method), laterNativeCommands: runner.calls.length - callsAtFailure,
    retainedRecords: Object.keys(partial).length, retainedComments: view.task.comments.length, publishedAtFailure,
    retainedTransportEvidence: existsSync(artifactDirectory), deleteCalls: deletions, sourceAuthority: "Beads", result: first.code }));
});

for (const primaryFailure of [false, true]) {
  test(`isolated owned Web teardown ${primaryFailure ? "preserves primary failure" : "warns after native verification"}`, {
    timeout: 120_000, skip: process.env.PRIME_CLAW_ISOLATED_TEARDOWN_TEST !== "1",
  }, async t => {
    assert.equal(process.platform, "linux");
    assert.equal(tmpdir(), "/tmp");
    assert.equal(statfsSync("/tmp").type, 0x01021994);
    assert.deepEqual(Object.keys(networkInterfaces()), ["lo"]);
    assert.equal(readFileSync("/proc/net/route", "utf8").trim().split("\n").length, 1);
    assert.equal(process.env.GIT_ALLOW_PROTOCOL, "file");
    assert.equal(process.env.GIT_CONFIG_NOSYSTEM, "1");
    assert.equal(process.env.GIT_CONFIG_GLOBAL, "/dev/null");
    assert.equal(process.env.DOLT_ROOT_PATH, process.env.HOME);
    assert.equal(dirname(realpathSync(process.env.HOME)), "/tmp");
    assert.ok(!Object.keys(process.env).some(key => /^(?:BEADS_|BD_|MYSQL_|BACKLOG_)|^DOLT_(?!ROOT_PATH$)|^GIT_(?!(?:ALLOW_PROTOCOL|CONFIG_NOSYSTEM|CONFIG_GLOBAL|TERMINAL_PROMPT|OPTIONAL_LOCKS)$)/.test(key)));
    const { outer, root, remote, ids } = embeddedBeadsSource(t, "owned-web-teardown");
    const code = git(root, "rev-parse", "HEAD");
    assert.equal(git(root, "status", "--porcelain=v1"), "");
    assert.equal(existsSync(join(root, ".backlog")), false);
    const seen = new Set();
    function checkTree(path) {
      const stat = lstatSync(path);
      assert.equal(stat.dev, lstatSync(outer).dev);
      assert.equal(realpathSync(path), path);
      assert.ok(!seen.has(stat.ino), "fixture must not share inodes"); seen.add(stat.ino);
      if (stat.isDirectory()) for (const entry of readdirSync(path)) checkTree(join(path, entry));
      else assert.ok(stat.isFile() && stat.nlink === 1, "expected an unlinked regular file in the fixture");
    }
    checkTree(root); checkTree(remote);
    for (const [repo, dir] of [[root, join(root, ".git")], [remote, remote]]) {
      assert.equal(dirname(realpathSync(remote)), outer);
      assert.equal(git(repo, "rev-parse", "--absolute-git-dir"), dir);
      assert.equal(realpathSync(resolve(repo, git(repo, "rev-parse", "--git-common-dir"))), dir);
      for (const relative of ["commondir", "objects/info/alternates", "objects/info/http-alternates", "worktrees", "config.worktree", "refs/replace"]) {
        assert.ok(!existsSync(join(dir, relative)), relative);
      }
      assert.ok(readdirSync(join(dir, "hooks")).every(sample => sample.endsWith(".sample")));
      for (const line of git(repo, "config", "--no-includes", "--local", "--list").split("\n")) {
        const key = line.split("=", 1)[0];
        assert.match(key, /^(?:core\.(?:repositoryformatversion|filemode|bare|logallrefupdates)|remote\.origin\.(?:url|fetch)|branch\..+\.(?:remote|merge)|beads\.role|user\.(?:name|email))$/);
        if (key === "remote.origin.url") assert.equal(line, `remote.origin.url=${remote}`);
      }
      assert.equal(git(repo, "for-each-ref", "--format=%(refname)", "refs/replace"), "");
    }
    const context = JSON.parse(bd(root, "--readonly", "context", "--json"));
    const connection = JSON.parse(bd(root, "--readonly", "dolt", "show", "--json"));
    assert.equal(context.beads_dir, join(root, ".beads"));
    assert.equal(context.dolt_mode, "embedded");
    assert.equal(context.is_redirected, false);
    assert.equal(connection.embedded, true);
    assert.notEqual(connection.shared_server, true);
    assert.equal(realpathSync(resolve(root, connection.data_dir)), join(root, ".beads", "embeddeddolt"));
    assert.deepEqual(JSON.parse(bd(root, "--readonly", "dolt", "remote", "list", "--json")), []);
    const source = sourceAuthorityFiles(root), sourceExport = bd(root, "--readonly", "export", "--all");
    const inspection = inspectTaskProviderMigration({ cwd: root, targetProvider: "backlog", runner: new AsIsBeadsRunner() });
    assert.equal(inspection.status, "ready", inspection.detail);
    let publishedAtWrite;
    const oldRequest = http.request, oldKill = process.kill;
    const oldArtifacts = new Set(readdirSync(tmpdir()));
    const phases = [], writes = [];
    let teardownAttempts = 0, writesAtClose, readbacksAtClose, responseStatus, result;
    http.request = function (...args) {
      const method = args[1]?.method;
      if (method === "POST" || method === "PUT") writes.push(method);
      if (primaryFailure && method === "PUT" && responseStatus === undefined) {
        publishedAtWrite = command(remote, "git", ["rev-parse", "--verify", TASK_HISTORY_REF], true);
        const callback = args.at(-1);
        args[args.length - 1] = response => {
          responseStatus = response.statusCode;
          response.statusCode = 503;
          callback(response);
        };
      }
      return oldRequest.apply(this, args);
    };
    syncBuiltinESMExports();
    process.kill = function (pid, signal) {
      const sent = oldKill.call(this, pid, signal);
      if (pid < 0 && signal === "SIGTERM") {
        teardownAttempts++;
        writesAtClose = [...writes];
        const name = readdirSync(tmpdir()).find(name => !oldArtifacts.has(name) && name.startsWith("prime-claw-migration-web-"));
        readbacksAtClose = readdirSync(join(tmpdir(), name)).filter(file => /-task-view\.json$/.test(file));
        // Signal the real owned test process, then inject the loss of stop
        // proof at the native teardown boundary (not a macOS reproduction).
        throw new Error("synthetic teardown proof failure (not for display)");
      }
      return sent;
    };
    try {
      result = await migrateTaskProvider({ cwd: root, targetProvider: "backlog", runner: new AsIsBeadsRunner(),
        confirmedSwitch: true, actor: "web-teardown-fixture", expectedSourceRevision: inspection.sourceRevision,
        semanticPlacement: "Preserve complete native task content.",
        onProgress(phase, level) { phases.push({ phase, level }); },
      });
    } finally {
      process.kill = oldKill; http.request = oldRequest; syncBuiltinESMExports();
    }
    const artifacts = readdirSync(tmpdir()).filter(name => !oldArtifacts.has(name) && name.startsWith("prime-claw-migration-web-"));
    assert.equal(artifacts.length, 1);
    const artifact = join(tmpdir(), artifacts[0]);
    assert.equal(lstatSync(artifact).mode & 0o777, 0o700);
    const readbacks = readdirSync(artifact).filter(name => /-task-view\.json$/.test(name));
    assert.equal(teardownAttempts, 1, "there is no second stop attempt");
    assert.deepEqual(writes, writesAtClose, "there are no Web writes after the teardown attempt");
    const warning = /Owned Web shutdown was not proved \(owned-process-stop-unproved; outcome=uncertain\)/;
    assert.doesNotMatch(JSON.stringify(result), /synthetic teardown proof failure/);
    if (primaryFailure) {
      assert.equal(responseStatus, 200, "native write finished before the test response was changed");
      assert.equal(result.code, "pre-cutover-failed", result.detail);
      assert.match(result.detail, /http-status-503; outcome=uncertain.*Warning: Owned Web shutdown was not proved/);
      assert.match(result.detail, warning);
      assert.equal(phases.some(({ phase }) => /Publishing verified|Guarded cutover/.test(phase)), false);
      assert.deepEqual(sourceAuthorityFiles(root), source);
      assert.equal(command(remote, "git", ["rev-parse", "--verify", TASK_HISTORY_REF], true), publishedAtWrite);
      assert.equal(git(remote, "rev-parse", "refs/heads/main"), code);
      assert.equal(result.sourceProvider, "beads");
      assert.equal(bd(root, "--readonly", "export", "--all"), sourceExport);
    } else {
      assert.equal(result.status, "completed", result.detail);
      assert.deepEqual(readbacks, readbacksAtClose, "all file-backed native task readbacks preceded teardown");
      const finalReads = readbacks.sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).slice(-Object.keys(ids).length)
        .map(file => JSON.parse(readFileSync(join(artifact, file), "utf8")).task.id);
      assert.deepEqual(finalReads.sort(), result.receipt.mappings.map(row => row.destinationTaskId).sort());
      assert.equal(result.sourceAbsent, true);
      assert.equal(result.selectedProvider, "backlog");
      assert.equal(result.warnings?.length, 1);
      assert.match(result.warnings[0], warning);
      assert.doesNotMatch(JSON.stringify({ phases, result }), /prime-claw-migration-web-/);
      const warningIndex = phases.findIndex(({ phase, level }) => level === "warning" && warning.test(phase));
      assert.ok(warningIndex >= 0 && warningIndex < phases.findIndex(({ phase }) => /Publishing verified/.test(phase)));
      assert.ok(phases.some(({ phase }) => /Guarded cutover/.test(phase)));
      assert.equal(existsSync(join(root, ".beads")), false);
      assert.deepEqual(result.receipt.mappings.map(row => row.sourceTaskId).sort(), Object.values(ids).sort());
      const remoteReceipt = git(remote, "rev-parse", TASK_HISTORY_REF);
      assert.equal(remoteReceipt, result.receipt.destinationReceiptRevision);
      assert.equal(git(remote, "rev-parse", `${remoteReceipt}^`), result.receipt.destinationDataRevision);
      assert.equal(git(remote, "rev-parse", "refs/heads/main"), code);
      assert.equal(git(root, "rev-parse", "HEAD"), code);
      assert.equal(detectTaskProvider(root, RUNNER).evidence?.provider, "backlog");
    }
  });
}
