import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { projectBeadsCurrentTask, assertBeadsCurrentTask, authorBeadsCurrentTask } from "../src/prime-agent-plugin/extension-support/beads-backlog-current.ts";
import { MigrationBacklogWebError, startMigrationBacklogWeb } from "../src/prime-agent-plugin/extension-support/migration-backlog-web.ts";

// Docker-only native dependency tests. No host executable discovery, operator
// stores, source history capture, importer, publication or source retirement.
const BACKLOG = "/usr/local/bin/backlog";
assert.equal(process.platform, "linux", "current projection tests require tier 1");
assert.ok(existsSync(BACKLOG), "tier-1 native Backlog executable is required");

function command(cwd, executable, args) {
  return execFileSync(executable, args, {
    cwd, env: { ...process.env, BACKLOG_CWD: cwd }, encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024,
  });
}

function repository(t, name, priorities = ["High", "Medium", "Low"], types = ["task", "bug"]) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-current-projection-")));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = join(directory, "repo");
  mkdirSync(root);
  const remote = join(directory, "remote.git");
  command(directory, "git", ["init", "-q", "--bare", remote]);
  command(root, "git", ["init", "-q", "-b", "main"]);
  command(root, "git", ["config", "user.name", "Current Projection Fixture"]);
  command(root, "git", ["config", "user.email", "current-projection@example.invalid"]);
  command(root, "git", ["remote", "add", "origin", remote]);
  writeFileSync(join(root, "README.md"), "Disposable current-state fixture\n");
  command(root, "git", ["add", "README.md"]);
  command(root, "git", ["commit", "-qm", "fixture baseline"]);
  command(root, BACKLOG, ["init", name, "--defaults", "--backlog-dir", "backlog",
    "--config-location", "folder", "--integration-mode", "none"]);
  writeFileSync(join(root, "backlog", "config.yml"), [
    `project_name: ${JSON.stringify(name)}`,
    'statuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]',
    'default_status: "In Design"', `types: ${JSON.stringify(types)}`,
    `priorities: ${JSON.stringify(priorities)}`, 'default_assignee: ["@configured-default"]',
    "auto_commit: false", "remote_operations: false", "check_active_branches: false", 'task_prefix: "CURRENT"', "",
  ].join("\n"));
  return { root, priorities, types };
}

function cliView(root, id) {
  return JSON.parse(command(root, BACKLOG, ["task", "view", "--json", "--", id]));
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function longCurrentMetadata() {
  const size = 2_610_950;
  const line = "Current rollout decision: preserve Ω and 日本語, owner-approved detail.\n";
  const tail = "\nCURRENT-METADATA-EXACT-TAIL-Ω-日本語";
  const count = Math.floor((size - Buffer.byteLength(tail)) / Buffer.byteLength(line));
  const text = line.repeat(count);
  const result = text + "x".repeat(size - Buffer.byteLength(text) - Buffer.byteLength(tail)) + tail;
  assert.equal(Buffer.byteLength(result), size);
  return result;
}

const DELIMITER_COMMENT = "  source body Ω\r\n<!-- COMMENT:END -->\r\n---\r\n## source heading\n\n\nlast line  ";
const SOURCE_TIME = "2026-10-21T09:10:11.000Z";

function sourcePackage(overrides = {}) {
  const row = {
    id: "SRC-17", title: "Current source ticket Ω", description: "Current description 日本語",
    design: "Current implementation plan Ω", notes: "Current implementation notes",
    acceptance_criteria: "Both checks remain readable\nSecond source criterion",
    status: "closed", close_reason: "Current closure: fixed and verified Ω", closed_at: SOURCE_TIME,
    priority: 1, issue_type: "bug", labels: ["current-label", "unicode-Ω"], assignee: "@source-owner",
    external_ref: "https://example.invalid/current/SRC-17", estimated_minutes: 47,
    metadata: { current_decision: "Keep this meaningful current value" },
    ...overrides,
  };
  return {
    sourceTaskId: row.id, exportRow: structuredClone(row), nativeView: {
      ...structuredClone(row), comments: [
        { id: 1, author: "source-author", text: "Actual authored comment Ω", created_at: SOURCE_TIME },
        { id: 2, author: "  source\twriter  ", text: DELIMITER_COMMENT, created_at: "2026-10-22T11:12:13Z" },
      ],
    },
    // These package-level envelopes are not readable current ticket content.
    history: "EXCLUDED-OLD-SNAPSHOT", provenance: "EXCLUDED-EVENT-STREAM",
    catalogs: "EXCLUDED-CATALOG", memories: "EXCLUDED-MEMORY-COLLECTION",
    rawEnvelope: "EXCLUDED-RAW-ENVELOPE",
  };
}

function context(fixture, overrides = {}) {
  return {
    sourceRevision: "a".repeat(40), sourceDigest: "b".repeat(64), status: "Done",
    dependencies: [], priorities: fixture.priorities, types: fixture.types, ...overrides,
  };
}

function containsReadable(text, value) {
  return text.includes(value) || text.includes(JSON.stringify(value)) || text.includes(JSON.stringify(value).replace(/</g, "\\u003c"));
}

function rejectsWithoutPayload(action) {
  let caught;
  try { action(); } catch (error) { caught = error; }
  assert.ok(caught instanceof Error, "altered current native content must fail verification");
  assert.ok(String(caught).length < 2000, "verification diagnostics stay bounded");
  assert.ok(!String(caught).includes("Current rollout decision"), "no private current payload in diagnostics");
}

test("native current projection author and full CLI readback preserve meaningful 2610950-byte metadata", { timeout: 180_000 }, async (t) => {
  const fixture = repository(t, "native-current");
  const { root } = fixture;
  const web = await startMigrationBacklogWeb({ cwd: root, backlogDirectory: join(root, "backlog"), backlogCommand: BACKLOG });
  t.after(() => web.close());
  const parent = await web.createTask({ title: "Native parent", status: "In Design", type: "task", assignee: [], disableDefinitionOfDoneDefaults: true });
  const dependency = await web.createTask({ title: "Native dependency", status: "In Design", type: "task", assignee: [], disableDefinitionOfDoneDefaults: true });
  const large = longCurrentMetadata();
  const pkg = sourcePackage({ metadata: { current_capture: { text: large } } });
  const projection = projectBeadsCurrentTask(pkg, context(fixture, { parentTaskId: parent.id, dependencies: [dependency.id] }));
  const initialReferences = JSON.stringify(projection.payload.references);
  assert.ok(initialReferences.includes(pkg.sourceTaskId), "source identity is present in the initial create payload");
  assert.ok(initialReferences.includes("a".repeat(40)), "source revision is present before any comments");
  assert.ok(initialReferences.includes("b".repeat(64)), "current source content digest is present before any comments");
  const id = await authorBeadsCurrentTask(web, projection);
  const view = cliView(root, id);
  assertBeadsCurrentTask(view, projection, id);
  assert.equal(view.kind, "task-view");
  assert.equal(view.schemaVersion, 1);
  assert.equal(view.task.id, id);
  assert.equal(view.task.status, "Done");
  assert.equal(view.task.title, pkg.nativeView.title);
  assert.equal(view.task.description, pkg.nativeView.description);
  assert.equal(view.task.implementationPlan, pkg.nativeView.design);
  assert.deepEqual(view.task.assignees, ["@source-owner"]);
  assert.deepEqual(view.task.labels, pkg.nativeView.labels);
  assert.equal(view.task.type.toLowerCase(), "bug");
  assert.equal(view.task.acceptanceCriteria.length, 1);
  assert.ok(containsReadable(view.task.acceptanceCriteria[0].text, pkg.nativeView.acceptance_criteria), "complete multiline source acceptance criteria remain readable");
  assert.equal(view.task.acceptanceCriteria[0].checked, false);
  assert.equal(view.task.parentTaskId, parent.id);
  assert.deepEqual(view.task.dependencies, [dependency.id]);
  const readable = [view.task.description, view.task.implementationPlan, view.task.implementationNotes, view.task.finalSummary ?? ""].join("\n");
  assert.ok(containsReadable(readable, pkg.nativeView.close_reason), "current closure reason is readable");
  assert.ok(containsReadable(readable, SOURCE_TIME), "source closure time is readable");
  assert.ok(readable.includes("estimated_minutes"), "meaningful current field name is readable");
  assert.ok(readable.includes("47"));
  assert.ok(readable.includes("current_capture"));
  for (const ordinary of [pkg.nativeView.description, pkg.nativeView.design, pkg.nativeView.notes]) {
    assert.equal(readable.split(ordinary).length - 1, 1, "native current prose is not repeated in a source package supplement");
  }
  // Check exact current metadata without printing a multi-megabyte mismatch.
  const exactRepresentation = readable.includes(large) ? large : JSON.stringify(large);
  assert.equal(readable.includes(exactRepresentation), true, "complete meaningful current metadata is readable");
  const captured = readable.slice(readable.indexOf(exactRepresentation), readable.indexOf(exactRepresentation) + exactRepresentation.length);
  assert.equal(digest(captured), digest(exactRepresentation));
  assert.equal(readable.split(exactRepresentation).length - 1, 1, "current metadata is not duplicated from export/native envelopes");
  for (const forbidden of ["EXCLUDED-OLD-SNAPSHOT", "EXCLUDED-EVENT-STREAM", "EXCLUDED-CATALOG", "EXCLUDED-MEMORY-COLLECTION", "EXCLUDED-RAW-ENVELOPE", "prime-claw-task-provider-migration-source-v1 part="]) {
    assert.equal(JSON.stringify(view).includes(forbidden), false, "no package, history, catalog, or memory archive in ticket");
  }
  assert.equal(view.task.comments.length, 2, "only actual authored source comments are created");
  assert.deepEqual(view.task.comments.map(({ body, author }) => ({ body, author })), projection.comments);
  for (let index = 0; index < pkg.nativeView.comments.length; index += 1) {
    const source = pkg.nativeView.comments[index];
    const actual = view.task.comments[index];
    assert.ok(containsReadable(actual.body, source.text), "exact source comment body remains readable");
    assert.ok(actual.author === source.author || containsReadable(actual.body, source.author), "exact source comment author remains readable");
    assert.ok(actual.body.includes(source.created_at), "exact authored source timestamp remains readable");
  }
  assert.equal(view.task.path.startsWith("backlog/tasks/"), true, "ordinary Done remains an active task");

  // Independently corrupt the complete CLI envelope, not a payload echo. A
  // surviving identity reference must never stand in for full native comparison.
  const mutations = [
    ["acceptance criteria", (task) => { task.acceptanceCriteria[0].text += " changed"; }],
    ["assignee", (task) => { task.assignees = ["@intruder"]; }],
    ["current supplement", (task) => { task.implementationNotes = task.implementationNotes.replace("estimated_minutes", "changed_field"); }],
    ["large current tail", (task) => { task.implementationNotes = task.implementationNotes.replace("CURRENT-METADATA-EXACT-TAIL", "CURRENT-METADATA-LOST-TAIL"); }],
    ["comment body", (task) => { task.comments[1].body += " changed"; }],
    ["comment author", (task) => { task.comments[0].author = "different-author"; }],
    ["parent relationship", (task) => { delete task.parentTaskId; }],
    ["dependency relationship", (task) => { task.dependencies = []; }],
  ];
  for (const [name, mutate] of mutations) {
    await t.test(`full native comparison rejects changed ${name} with source binding retained`, () => {
      const altered = structuredClone(view);
      mutate(altered.task);
      assert.deepEqual(altered.task.references, view.task.references);
      assert.equal(digest(JSON.stringify(altered.task)) === digest(JSON.stringify(view.task)), false, "mutation changes native readback");
      rejectsWithoutPayload(() => assertBeadsCurrentTask(altered, projection, id));
    });
  }
  // Also prove the verifier rejects a real persisted native alteration.
  await web.updateTask(id, { acceptanceCriteriaItems: [{ text: "Changed after authoring", checked: true }] });
  const changed = cliView(root, id);
  assert.deepEqual(changed.task.references, view.task.references);
  rejectsWithoutPayload(() => assertBeadsCurrentTask(changed, projection, id));
});

test("native configured type and priority fallback preserves raw values and explicitly leaves default-assigned tasks unassigned", { timeout: 90_000 }, async (t) => {
  const fixture = repository(t, "configured-fallback", ["Critical", "Normal"], ["task", "bug"]);
  const pkg = sourcePackage({ priority: "  source urgency Ω  ", issue_type: "  source kind Ω  ", assignee: "", status: "deferred", defer_until: "2099-01-01T00:00:00Z", snoozed_until: "2099-02-01T00:00:00Z" });
  const projection = projectBeadsCurrentTask(pkg, context(fixture, { status: "In Design" }));
  assert.deepEqual(projection.payload.assignee, [], "explicitly override configured default assignee");
  assert.ok(fixture.types.includes(projection.payload.type));
  assert.ok(fixture.priorities.map((value) => value.toLowerCase()).includes(projection.payload.priority.toLowerCase()));
  const web = await startMigrationBacklogWeb({ cwd: fixture.root, backlogDirectory: join(fixture.root, "backlog"), backlogCommand: BACKLOG });
  t.after(() => web.close());
  const defaulted = await web.createTask({ title: "Configured default control", type: "task", disableDefinitionOfDoneDefaults: true });
  assert.deepEqual(cliView(fixture.root, defaulted.id).task.assignees, ["@configured-default"], "fixture default really is active");
  const id = await authorBeadsCurrentTask(web, projection);
  const view = cliView(fixture.root, id);
  assertBeadsCurrentTask(view, projection, id);
  assert.deepEqual(view.task.assignees, []);
  assert.equal(view.task.status, "In Design");
  assert.equal(view.task.type, projection.payload.type);
  assert.equal(view.task.priority, projection.payload.priority);
  const readable = [view.task.implementationNotes, view.task.finalSummary ?? ""].join("\n");
  assert.ok(containsReadable(readable, pkg.nativeView.issue_type), "unsupported exact current type survives fallback");
  assert.ok(containsReadable(readable, pkg.nativeView.priority), "unsupported exact current priority survives fallback");
  assert.equal(JSON.stringify(view).includes("2099-01-01"), false, "active deferral fields are dropped");
  assert.equal(JSON.stringify(view).includes("2099-02-01"), false, "active snooze fields are dropped");
});

test("native configured P priorities map numeric source priority to the corresponding current destination priority", { timeout: 90_000 }, async (t) => {
  // P1 is deliberately not first: this must map meaning, not happen to choose
  // the first configured fallback value when High is unavailable.
  const fixture = repository(t, "configured-p-priority", ["P3", "P1", "P2"], ["task", "bug"]);
  const pkg = sourcePackage({ priority: 1 });
  const projection = projectBeadsCurrentTask(pkg, context(fixture));
  assert.equal(projection.payload.priority, "p1");
  const web = await startMigrationBacklogWeb({ cwd: fixture.root, backlogDirectory: join(fixture.root, "backlog"), backlogCommand: BACKLOG });
  t.after(() => web.close());
  const id = await authorBeadsCurrentTask(web, projection);
  const view = cliView(fixture.root, id);
  assertBeadsCurrentTask(view, projection, id);
  assert.equal(view.task.priority, "p1");
  assert.ok(view.task.implementationNotes.includes("priority"), "exact numeric source priority is preserved in current readable metadata");
});

test("native current prose preserves exact normalization-sensitive description plan notes and acceptance criteria", { timeout: 90_000 }, async (t) => {
  const fixture = repository(t, "normalization-sensitive");
  const description = "  current description Ω\r\n\r\n\r\nlast description line  ";
  const design = "  current design 日本語\r\n<!-- SECTION:PLAN:END -->\r\n---\nlast design line  ";
  const notes = "  current notes Ω\r\n\r\n\r\nlast notes line  ";
  const acceptance = "  exact criterion Ω\r\nsecond line\n\n\nlast criterion  ";
  const pkg = sourcePackage({ description, design, notes, acceptance_criteria: acceptance });
  const projection = projectBeadsCurrentTask(pkg, context(fixture));
  const web = await startMigrationBacklogWeb({ cwd: fixture.root, backlogDirectory: join(fixture.root, "backlog"), backlogCommand: BACKLOG });
  t.after(() => web.close());
  const id = await authorBeadsCurrentTask(web, projection);
  const view = cliView(fixture.root, id);
  assertBeadsCurrentTask(view, projection, id);
  assert.ok(containsReadable(view.task.description, description), "native description retains exact normalized-sensitive source string");
  assert.ok(containsReadable(view.task.implementationPlan, design), "native plan retains exact delimiters and source whitespace");
  assert.ok(containsReadable(view.task.implementationNotes, notes), "native notes retain exact source whitespace");
  assert.ok(containsReadable(view.task.acceptanceCriteria[0].text, acceptance), "native criterion retains multiline source exactly");
  for (const value of [description, design, notes]) {
    const encoded = JSON.stringify(value).replace(/</g, "\\u003c");
    const allProse = [view.task.description, view.task.implementationPlan, view.task.implementationNotes].join("\n");
    assert.equal(allProse.split(encoded).length - 1, 1, "normalization-sensitive prose is represented only once, not as a repeated native/export package");
  }
});

for (const heading of ["Final Summary", "Source heading"]) {
  test(`native authored comment with ${heading} heading preserves body and absent source summary`, { timeout: 90_000 }, async (t) => {
    const fixture = repository(t, `comment-heading-${heading.replace(/ /g, "-").toLowerCase()}`);
    const body = `Work completed.\n\n## ${heading}\n\nPreserve this ordinary heading.`;
    const pkg = sourcePackage({ status: "open" });
    // sourcePackage normally supplies close_reason: remove it from BOTH current
    // rows so an existing real summary cannot mask native legacy-heading parsing.
    for (const row of [pkg.exportRow, pkg.nativeView]) {
      delete row.close_reason;
      delete row.finalSummary;
      delete row.closed_at;
      assert.equal(Object.hasOwn(row, "close_reason"), false);
      assert.equal(Object.hasOwn(row, "finalSummary"), false);
    }
    pkg.nativeView.comments = [{ id: 1, author: "source-author", text: body, created_at: SOURCE_TIME }];
    const projection = projectBeadsCurrentTask(pkg, context(fixture, { status: "In Design" }));
    assert.equal(projection.payload.finalSummary, "");
    assert.equal(projection.expected.finalSummary, null);
    const web = await startMigrationBacklogWeb({ cwd: fixture.root, backlogDirectory: join(fixture.root, "backlog"), backlogCommand: BACKLOG });
    t.after(() => web.close());
    const calls = [];
    // Count actual successful native operations, not payload echoes or a mock.
    const native = {
      async createTask(payload) {
        const created = await web.createTask(payload);
        calls.push("POST returned");
        return created;
      },
      async updateTask(id, payload) {
        const updated = await web.updateTask(id, payload);
        calls.push("PUT returned");
        return updated;
      },
      async readTask(id) {
        const view = await web.readTask(id);
        calls.push("CLI read");
        t.diagnostic(JSON.stringify({ heading, calls, destinationId: id,
          sourceSummaryAbsent: [pkg.exportRow, pkg.nativeView].every((row) => !Object.hasOwn(row, "close_reason") && !Object.hasOwn(row, "finalSummary")),
          expectedFinalSummary: projection.expected.finalSummary, actualFinalSummary: view.task.finalSummary,
          sourceBody: body, actualComment: view.task.comments[0] }));
        return view;
      },
    };
    let id;
    try { id = await authorBeadsCurrentTask(native, projection); }
    finally { assert.deepEqual(calls, ["POST returned", "PUT returned", "CLI read"], "one native create/comment/read and no resend"); }
    const view = cliView(fixture.root, id);
    assertBeadsCurrentTask(view, projection, id);
    assert.equal(view.task.finalSummary, null, "a comment heading must not fabricate task closure information");
    assert.equal(view.task.comments.length, 1);
    const comment = view.task.comments[0];
    assert.equal(comment.author, "source-author");
    assert.ok(comment.body.includes(SOURCE_TIME), "source comment time is retained readably");
    if (heading === "Final Summary") {
      const prefix = "Beads comment text (exact JSON string): ";
      assert.ok(comment.body.startsWith(prefix), "affected comment uses the existing exact-readable representation");
      assert.equal(JSON.parse(comment.body.slice(prefix.length).split("\n\n")[0]), body, "complete exact source body and heading survive native round trip");
    } else {
      assert.ok(comment.body.startsWith(body), "ordinary source heading remains ordinary readable prose");
      assert.equal(comment.body.includes("exact JSON string"), false);
    }
  });
}

test("current projection retains differing current export and native prose without copying source envelopes", () => {
  const pkg = sourcePackage();
  pkg.exportRow.notes = "Export-only current notes Ω";
  pkg.nativeView.notes = "Native current notes 日本語";
  const projection = projectBeadsCurrentTask(pkg, context({ priorities: ["High", "Medium", "Low"], types: ["task", "bug"] }));
  const readable = JSON.stringify(projection.payload);
  assert.equal(readable.includes(pkg.exportRow.notes), true);
  assert.equal(readable.includes(pkg.nativeView.notes), true);
  assert.equal(readable.includes("EXCLUDED-RAW-ENVELOPE"), false);
  assert.equal(projection.comments.length, 2);
});

for (const failAt of ["create", "first-comment", "second-comment", "read"]) {
  test(`current native author never resends or makes a next call after ${failAt} failure`, async () => {
    const projection = projectBeadsCurrentTask(sourcePackage(), context({ priorities: ["High", "Medium", "Low"], types: ["task", "bug"] }));
    const calls = [];
    const failure = new Error("controlled native failure");
    const web = {
      async createTask(payload) {
        calls.push("create");
        assert.equal(payload, projection.payload, "exact shared production projection reaches native author");
        if (failAt === "create") throw failure;
        return { id: "CURRENT-1" };
      },
      async updateTask(id, payload) {
        const number = calls.filter((call) => call.startsWith("comment-")).length + 1;
        calls.push(`comment-${number}`);
        assert.equal(id, "CURRENT-1");
        assert.deepEqual(payload, { commentsAppend: [projection.comments[number - 1].body], commentAuthor: projection.comments[number - 1].author });
        if (failAt === (number === 1 ? "first-comment" : "second-comment")) throw failure;
        return { id };
      },
      async readTask(id) {
        calls.push("read");
        assert.equal(id, "CURRENT-1");
        throw failure;
      },
    };
    await assert.rejects(authorBeadsCurrentTask(web, projection), (error) => {
      assert.ok(error instanceof Error);
      assert.ok(String(error).length < 2000, "native author failure diagnostics stay bounded");
      assert.equal(String(error).includes(DELIMITER_COMMENT), false);
      return true;
    });
    const expected = { create: ["create"], "first-comment": ["create", "comment-1"],
      "second-comment": ["create", "comment-1", "comment-2"], read: ["create", "comment-1", "comment-2", "read"] };
    assert.deepEqual(calls, expected[failAt]);
  });
}


test("current native author preserves accepted typed transport failure evidence without a next call", async () => {
  for (const failedCall of ["create", "comment-1", "read"]) {
    const projection = projectBeadsCurrentTask(sourcePackage(), context({ priorities: ["High", "Medium", "Low"], types: ["task", "bug"] }));
    const calls = [];
    const artifactDirectory = join(tmpdir(), "disposable-transport-evidence");
    const failure = new MigrationBacklogWebError("native-task-request", "uncertain", artifactDirectory);
    const record = (call) => {
      calls.push(call);
      if (call === failedCall) throw failure;
      return { id: "CURRENT-1" };
    };
    const web = {
      async createTask() { return record("create"); },
      async updateTask() { return record(`comment-${calls.filter((value) => value.startsWith("comment-")).length + 1}`); },
      async readTask() { return record("read"); },
    };
    await assert.rejects(authorBeadsCurrentTask(web, projection), (error) => {
      assert.equal(error, failure, "accepted typed evidence must remain accessible to the migration owner");
      assert.equal(error.stage, "native-task-request");
      assert.equal(error.outcome, "uncertain");
      assert.equal(error.artifactDirectory, artifactDirectory);
      return true;
    });
    const expected = { create: ["create"], "comment-1": ["create", "comment-1"], read: ["create", "comment-1", "comment-2", "read"] };
    assert.deepEqual(calls, expected[failedCall]);
  }
});
