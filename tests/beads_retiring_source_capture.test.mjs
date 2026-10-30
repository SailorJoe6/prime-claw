/** Native evidence for PRIMECLAW-44, not a replacement migration implementation.
 * All writes seed disposable fixtures. Capture uses only strict native reads.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const INVENTORY = ["list", "--all", "--limit", "0", "--include-infra",
  "--include-templates", "--include-gates", "--include-ephemeral", "--json"];
const BUILT_INS = ["open", "in_progress", "blocked", "deferred", "closed", "pinned", "hooked"];
const ENV = { ...process.env, BD_JSON_ENVELOPE: "0" };

function command(root, executable, args) {
  return execFileSync(executable, args, {
    cwd: root, env: ENV, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000,
  }).trim();
}
function bd(root, ...args) { return command(root, "bd", args); }
function json(root, ...args) { return JSON.parse(bd(root, ...args)); }
function read(root, ...args) { return json(root, "--readonly", ...args); }
function ids(rows) { return rows.map((row) => row.id).sort(); }

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-retiring-capture-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  command(root, "git", ["init", "-q", "-b", "main"]);
  command(root, "git", ["config", "user.name", "Capture Fixture"]);
  command(root, "git", ["config", "user.email", "capture@example.invalid"]);
  // Deliberately no --server, status.custom, Dolt/Git remote, backup setup or push.
  bd(root, "init", "--skip-hooks", "--skip-agents", "--prefix", "CAP", "--quiet", "--non-interactive");
  return root;
}

function sourceFiles(root) {
  return Object.fromEntries(["config.yaml", "metadata.json"].map((name) => [
    name, readFileSync(join(root, ".beads", name)).toString("base64"),
  ]));
}

function capture(root) {
  const inventory = read(root, ...INVENTORY);
  const exported = bd(root, "--readonly", "export", "--all").split(/\r?\n/)
    .filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(new Set(ids(inventory)).size, inventory.length, "inventory repeats an ID");
  assert.equal(new Set(ids(exported)).size, exported.length, "export repeats an ID");
  assert.deepEqual(ids(exported), ids(inventory), "export omits native inventory records");
  const tasks = ids(inventory).map((id) => {
    const views = read(root, "show", id, "--json", "--long", "--include-comments");
    assert.equal(views.length, 1);
    assert.equal(views[0].id, id);
    const history = read(root, "history", id, "--json", "--limit", "0");
    const events = read(root, "history", id, "--events", "--json", "--limit", "0");
    const provenance = read(root, "provenance", "log", id, "--json");
    assert.ok(Array.isArray(history) && history.length > 0, `${id} has no native history`);
    assert.ok(history.every((entry) => entry.Issue.id === id && entry.CommitHash));
    assert.ok(Array.isArray(events) && events.some((entry) => entry.event_type === "created"));
    assert.ok(events.every((entry) => entry.issue_id === id));
    assert.ok(Array.isArray(provenance) && provenance.every((entry) => entry.issue_id === id));
    return { id, view: views[0], history, events, provenance };
  });
  return {
    version: bd(root, "--version"), context: read(root, "context", "--json"),
    location: read(root, "where", "--json"), transport: read(root, "dolt", "show", "--json"),
    remotes: read(root, "dolt", "remote", "list", "--json"),
    catalog: read(root, "statuses", "--json"), inventory, exported, tasks,
  };
}

test("embedded local-only native reads capture complete issues, relationships, history and status context", { timeout: 180_000 }, (t) => {
  const root = fixture(t);
  const parent = json(root, "create", "Parent original", "--description", "original description",
    "--design", "original design", "--notes", "original notes", "--metadata", '{"opaque":{"shape":[1,null,false]}}', "--json").id;
  bd(root, "update", parent, "--title", "Parent revised", "--description", "revised description",
    "--design", "revised design", "--notes", "revised notes", "--status", "in_progress", "--json");
  bd(root, "update", parent, "--notes", "final living notes", "--json");
  const blocker = json(root, "create", "Native open", "--json").id;
  const child = json(root, "create", "Completed child", "--parent", parent, "--json").id;
  bd(root, "close", child, "--reason", "Delivered the requested change", "--json");
  const byStatus = {};
  for (const status of ["blocked", "deferred", "pinned", "hooked"]) {
    byStatus[status] = json(root, "create", `Native ${status}`, "--status", status, "--json").id;
  }
  bd(root, "dep", "add", byStatus.blocked, blocker);
  bd(root, "comments", "add", parent, "native capture comment", "--author", "fixture-author");
  bd(root, "label", "add", parent, "capture-proof");
  bd(root, "provenance", "record", "--issue", parent, "--kind", "commit", "--source", "fixture",
    "--ref", "a".repeat(40), "--ref-kind", "git-sha", "--actor", "fixture-actor", "--payload", '{"opaque":true}');

  const filesBefore = sourceFiles(root);
  const first = capture(root);
  assert.match(first.version, /^bd version 1\.3\.1\b/);
  assert.equal(first.context.dolt_mode, "embedded");
  assert.equal(first.context.is_redirected, false);
  assert.equal(realpathSync(first.context.beads_dir), join(root, ".beads"));
  assert.equal(first.transport.embedded, true);
  assert.equal(first.transport.database, "CAP");
  assert.ok(existsSync(first.transport.data_dir), "use native data_dir, not a server directory assumption");
  assert.deepEqual(first.remotes, []);
  assert.deepEqual(first.catalog.built_in_statuses.map((row) => row.name).sort(), [...BUILT_INS].sort());
  assert.ok(first.catalog.built_in_statuses.every((row) => row.category && row.description && row.icon));
  assert.equal(first.catalog.custom_statuses, undefined);
  assert.equal(first.inventory.length, 7);
  assert.deepEqual([...new Set(first.inventory.map((row) => row.status))].sort(), [...BUILT_INS].sort());

  const p = first.tasks.find((row) => row.id === parent);
  const c = first.tasks.find((row) => row.id === child);
  assert.deepEqual(p.view.metadata, { opaque: { shape: [1, null, false] } });
  assert.ok(p.view.comments.some((row) => row.text === "native capture comment" && row.author === "fixture-author"));
  assert.ok(p.view.labels.includes("capture-proof"));
  assert.ok(p.history.some((row) => row.Issue.title === "Parent original"
    && row.Issue.description === "original description" && row.Issue.design === "original design"
    && row.Issue.notes === "original notes" && row.Issue.status === "open"));
  assert.ok(p.history.some((row) => row.Issue.title === "Parent revised"
    && row.Issue.design === "revised design" && row.Issue.notes === "revised notes"));
  assert.ok(p.history.some((row) => row.Issue.notes === "final living notes" && row.Issue.status === "in_progress"));
  assert.ok(p.events.some((row) => row.event_type === "status_changed"
    && row.old_value.includes("original description") && row.new_value.includes("revised description")));
  assert.ok(p.provenance.some((row) => row.actor === "fixture-actor" && row.ref === "a".repeat(40)
    && row.payload === '{"opaque":true}'));
  assert.equal(c.view.status, "closed");
  assert.equal(c.view.close_reason, "Delivered the requested change");
  assert.ok(c.history.some((row) => row.Issue.status === "open"));
  assert.ok(c.history.some((row) => row.Issue.status === "closed" && row.Issue.close_reason === c.view.close_reason));
  const exportedParent = first.exported.find((row) => row.id === parent);
  const exportedChild = first.exported.find((row) => row.id === child);
  assert.deepEqual(exportedParent.comments, p.view.comments);
  assert.ok(exportedParent.labels.includes("capture-proof"));
  assert.deepEqual(exportedParent.metadata, p.view.metadata);
  assert.ok(exportedChild.dependencies.some((row) => row.depends_on_id === parent && row.type === "parent-child"));
  const exportedBlocked = first.exported.find((row) => row.id === byStatus.blocked);
  assert.ok(exportedBlocked.dependencies.some((row) => row.depends_on_id === blocker && row.type === "blocks"));
  assert.equal(exportedChild.close_reason, c.view.close_reason);

  // Demonstrate the actual current SQL path's embedded capability failure.
  const sql = spawnSync("bd", ["--readonly", "sql", "--json", "SELECT id FROM issues ORDER BY id"], {
    cwd: root, env: ENV, encoding: "utf8", timeout: 30_000,
  });
  assert.equal(sql.status, 1);
  assert.match(sql.stderr, /not yet supported in embedded mode/);
  assert.deepEqual(capture(root), first, "strict reads changed the logical source capture");
  assert.deepEqual(sourceFiles(root), filesBefore, "capture changed source configuration or identity");
  console.log(`native capture: ${first.version}; 7 statuses/issues; complete history/events/provenance; stable readonly recapture`);
});

test("partial native catalogs and export filtering are visible without reconfiguring source during capture", { timeout: 120_000 }, (t) => {
  const root = fixture(t);
  // Fixture writes only. The source capture itself must never clear filters or add statuses.
  bd(root, "config", "set", "status.custom", "in_design:active");
  const issue = json(root, "create", "Custom status issue", "--status", "in_design", "--json").id;
  const filesBefore = sourceFiles(root);
  const first = capture(root);
  assert.equal(first.tasks[0].id, issue);
  assert.deepEqual(first.catalog.custom_statuses, [{ name: "in_design", category: "active" }]);
  assert.deepEqual(capture(root), first);
  assert.deepEqual(sourceFiles(root), filesBefore);

  // A source-side filter remains untouched. Independent inventory detects omission.
  bd(root, "config", "set", "export.exclude_owners", first.tasks[0].view.created_by);
  const filterBefore = read(root, "config", "get", "export.exclude_owners", "--json");
  assert.throws(() => capture(root), /export omits native inventory records/);
  assert.deepEqual(read(root, "config", "get", "export.exclude_owners", "--json"), filterBefore);
  assert.equal(read(root, ...INVENTORY)[0].id, issue);

  // A catalog-only change is retained by the raw capture, not inferred from tasks.
  bd(root, "config", "set", "status.custom", "in_design:wip");
  const changed = read(root, "statuses", "--json");
  assert.notDeepEqual(changed, first.catalog);
  assert.deepEqual(changed.custom_statuses, [{ name: "in_design", category: "wip" }]);
  assert.deepEqual(read(root, "dolt", "remote", "list", "--json"), []);
});
