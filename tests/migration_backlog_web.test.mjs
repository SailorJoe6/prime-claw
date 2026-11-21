import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, watch, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { MigrationBacklogWebError, startMigrationBacklogWeb } from "../src/prime-agent-plugin/extension-support/migration-backlog-web.ts";

// This suite is admitted only through the tier-1 Python bridge. Never discover a
// host executable or point it at an operator store.
const BACKLOG = "/usr/local/bin/backlog";
assert.equal(process.platform, "linux", "migration web transport tests require tier 1");
assert.ok(existsSync(BACKLOG), "tier-1 native Backlog executable is required");

function sandbox(t) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-migration-web-")));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function command(cwd, executable, args) {
  return execFileSync(executable, args, {
    cwd, env: { ...process.env, BACKLOG_CWD: cwd },
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024,
  });
}

function repository(directory, name) {
  const root = join(directory, name);
  mkdirSync(root);
  command(root, "git", ["init", "-q", "-b", "main"]);
  command(root, "git", ["config", "user.name", "Migration Web Fixture"]);
  command(root, "git", ["config", "user.email", "migration-web@example.invalid"]);
  writeFileSync(join(root, "README.md"), "Disposable migration web fixture\n");
  command(root, "git", ["add", "README.md"]);
  command(root, "git", ["commit", "-qm", "fixture baseline"]);
  command(root, BACKLOG, ["init", name, "--defaults", "--backlog-dir", "backlog",
    "--config-location", "folder", "--integration-mode", "none"]);
  const config = join(root, "backlog", "config.yml");
  writeFileSync(config, readFileSync(config, "utf8").replace(/^auto_commit:.*$/m, "auto_commit: false"));
  return root;
}

function snapshot(root) {
  const entries = [];
  function visit(directory) {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) visit(path);
      else entries.push([path.slice(root.length), createHash("sha256").update(readFileSync(path)).digest("hex")]);
    }
  }
  visit(root);
  return entries;
}

function privateArtifacts(directory) {
  assert.equal(statSync(directory).mode & 0o777, 0o700);
  const files = [];
  function visit(root) {
    for (const name of readdirSync(root)) {
      const path = join(root, name);
      const info = statSync(path);
      if (info.isDirectory()) {
        assert.equal(info.mode & 0o777, 0o700);
        visit(path);
      } else {
        assert.equal(info.mode & 0o777, 0o600, path);
        files.push(path);
      }
    }
  }
  visit(directory);
  assert.ok(files.length > 0, "transport has file-backed evidence");
  return files;
}

async function listen(server, port = 0) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function portReleased(url) {
  const port = Number(new URL(url).port);
  const probe = createServer();
  await listen(probe, port);
  await closeServer(probe);
}

function retainedFailure(t, error, outcome, secret = "") {
  assert.ok(error instanceof MigrationBacklogWebError);
  assert.equal(error.outcome, outcome);
  assert.equal(typeof error.stage, "string");
  assert.ok(error.stage.length > 0);
  assert.equal(typeof error.artifactDirectory, "string");
  assert.ok(existsSync(error.artifactDirectory));
  privateArtifacts(error.artifactDirectory);
  t.after(() => rmSync(error.artifactDirectory, { recursive: true, force: true }));
  if (secret) {
    assert.ok(!String(error).includes(secret));
    assert.ok(!JSON.stringify(error).includes(secret));
  }
  return true;
}

function longReadableText(tail) {
  // Exact evidence-size regression: UTF-8, readable lines, and an unmistakable
  // tail beyond argv/pipe transport limits. Keep the tail within the exact size.
  const size = 2_610_950;
  const line = "Migration context: preserve Ω, 日本語, and every readable line.\n";
  const ending = `\n${tail}`;
  const count = Math.floor((size - Buffer.byteLength(ending)) / Buffer.byteLength(line));
  const body = line.repeat(count);
  const padding = "x".repeat(size - Buffer.byteLength(body) - Buffer.byteLength(ending));
  const text = body + padding + ending;
  assert.equal(Buffer.byteLength(text), size);
  return text;
}

test("native migration web POST PUT and CLI view preserve 2610950 UTF-8 bytes in the selected context", { timeout: 180_000 }, async (t) => {
  const directory = sandbox(t);
  const target = repository(directory, "selected");
  const foreign = repository(directory, "foreign");
  command(foreign, BACKLOG, ["task", "create", "Untouched foreign task", "--description", "foreign bytes", "--plain"]);
  const originalForeign = snapshot(foreign);
  const previous = process.env.BACKLOG_CWD;
  process.env.BACKLOG_CWD = foreign;
  t.after(() => {
    if (previous === undefined) delete process.env.BACKLOG_CWD;
    else process.env.BACKLOG_CWD = previous;
  });
  const transport = await startMigrationBacklogWeb({ cwd: target, backlogDirectory: join(target, "backlog"), backlogCommand: BACKLOG });
  t.after(() => transport.close());
  assert.equal(new URL(transport.url).hostname, "127.0.0.1");
  const description = longReadableText("POST-TAIL-Ω-日本語");
  const created = await transport.createTask({
    title: "Migration native web task", description, implementationPlan: "living plan Ω",
    implementationNotes: "source notes", references: ["https://example.invalid/source/one"],
    acceptanceCriteriaItems: [{ text: "preserve native criterion Ω", checked: true }],
    disableDefinitionOfDoneDefaults: true,
  });
  assert.equal(typeof created.id, "string");
  assert.equal(created.description, description);
  const afterPost = await transport.readTask(created.id);
  assert.equal(afterPost.task.description, description);
  assert.equal(typeof afterPost.task.path, "string", "CLI view envelope includes native path");
  const updatedDescription = longReadableText("PUT-TAIL-Ω-日本語");
  const references = ["https://example.invalid/source/two", "migration-source:exact-revision"];
  const updated = await transport.updateTask(created.id, {
    description: updatedDescription, references,
    acceptanceCriteriaItems: [{ text: "checked criterion Ω", checked: true }, { text: "open criterion 日本語", checked: false }],
    commentsAppend: ["native migration comment Ω 日本語"], commentAuthor: "migration-fixture",
  });
  assert.equal(updated.description, updatedDescription);
  const envelope = await transport.readTask(created.id);
  assert.equal(envelope.schemaVersion, 1);
  assert.equal(envelope.kind, "task-view");
  assert.deepEqual(envelope, JSON.parse(command(target, BACKLOG, ["task", "view", "--json", "--", created.id])),
    "readTask preserves the complete native CLI envelope");
  assert.equal(envelope.task.description, updatedDescription);
  assert.equal(envelope.task.implementationPlan, "living plan Ω");
  assert.deepEqual(envelope.task.references, references);
  assert.deepEqual(envelope.task.acceptanceCriteria.map(({ text, checked }) => ({ text, checked })), [
    { text: "checked criterion Ω", checked: true }, { text: "open criterion 日本語", checked: false },
  ]);
  assert.equal(envelope.task.comments.length, 1);
  assert.equal(envelope.task.comments[0].body, "native migration comment Ω 日本語");
  assert.equal(envelope.task.comments[0].author, "migration-fixture");
  const artifacts = privateArtifacts(transport.artifactDirectory);
  assert.ok(artifacts.some((path) => path.endsWith("request.json") && statSync(path).size > 2_610_950));
  assert.ok(artifacts.some((path) => path.endsWith("task-view.json") && statSync(path).size > 2_610_950));
  assert.deepEqual(snapshot(foreign), originalForeign, "browser and CLI ignore ambient foreign BACKLOG_CWD");
  const exit = await transport.close();
  assert.equal(exit.forced, false);
  assert.ok(transport.server.exitCode !== null || transport.server.signalCode !== null);
  assert.throws(() => process.kill(-transport.server.pid, 0), { code: "ESRCH" }, "owned process group is gone");
  assert.ok(!existsSync(transport.artifactDirectory), "successful shutdown removes ephemeral bodies and logs");
  await portReleased(transport.url);
  assert.deepEqual(snapshot(foreign), originalForeign);
});

test("migration web uses only its owned fallback on an occupied foreign port without touching its owner", { timeout: 30_000 }, async (t) => {
  const directory = sandbox(t);
  const target = repository(directory, "occupied");
  const before = snapshot(target);
  let requests = 0;
  const foreign = createServer((_req, res) => { requests += 1; res.end("foreign owner"); });
  const port = await listen(foreign);
  t.after(() => closeServer(foreign));
  const transport = await startMigrationBacklogWeb({
    cwd: target, backlogDirectory: join(target, "backlog"), backlogCommand: BACKLOG, port,
  });
  t.after(() => transport.close());
  assert.notEqual(Number(new URL(transport.url).port), port);
  assert.equal(requests, 0);
  assert.equal(foreign.listening, true);
  await transport.close();
  await portReleased(transport.url);
  assert.equal(foreign.listening, true);
  assert.equal(requests, 0);
  assert.deepEqual(snapshot(target), before);
});

test("migration web rejects invalid executable and pre-abort before destination mutation", { timeout: 30_000 }, async (t) => {
  const directory = sandbox(t);
  const target = repository(directory, "not-started");
  const before = snapshot(target);
  await assert.rejects(startMigrationBacklogWeb({ cwd: target, backlogDirectory: join(target, "backlog"), backlogCommand: join(directory, "missing-executable"), startupTimeoutMs: 1000 }),
    (error) => retainedFailure(t, error, "not-started"));
  for (const port of [-1, 0, 65536, 1.5]) {
    await assert.rejects(startMigrationBacklogWeb({
      cwd: target, backlogDirectory: join(target, "backlog"), backlogCommand: BACKLOG, port,
    }), (error) => {
      assert.ok(error instanceof MigrationBacklogWebError);
      assert.equal(error.outcome, "not-started");
      assert.equal(error.artifactDirectory, "");
      return true;
    });
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(startMigrationBacklogWeb({ cwd: target, backlogDirectory: join(target, "backlog"), backlogCommand: BACKLOG, signal: controller.signal }),
    (error) => {
      assert.ok(error instanceof MigrationBacklogWebError);
      assert.equal(error.outcome, "not-started");
      assert.equal(error.artifactDirectory, "", "pre-abort allocates no transport or child");
      return true;
    });
  assert.deepEqual(snapshot(target), before);
});

test("migration web HTTP rejection retains private evidence and fences writes without payload diagnostics", { timeout: 30_000 }, async (t) => {
  const directory = sandbox(t);
  const target = repository(directory, "native-rejection");
  const transport = await startMigrationBacklogWeb({ cwd: target, backlogDirectory: join(target, "backlog"), backlogCommand: BACKLOG });
  t.after(() => transport.close());
  const secret = "PRIVATE-MIGRATION-PAYLOAD-Ω-DO-NOT-ECHO";
  await assert.rejects(transport.createTask({ title: "", description: secret }),
    (error) => retainedFailure(t, error, "uncertain", secret));
  await assert.rejects(transport.createTask({ title: "Must never be sent", description: secret }));
  await portReleased(transport.url);
  assert.ok(transport.server.exitCode !== null || transport.server.signalCode !== null);
  await transport.close();
  assert.ok(existsSync(transport.artifactDirectory), "close must not erase failed request evidence");
  const listed = JSON.parse(command(target, BACKLOG, ["task", "list", "--json"]));
  assert.ok(Array.isArray(listed) ? listed.length === 0 : listed.tasks.length === 0);
});

// Only failure timing uses a native-shaped executable. Successful large writes
// above always use the real pinned Backlog core and CLI, not this HTTP fixture.
function failingExecutable(directory, mode, secret) {
  const executable = join(directory, `backlog-${mode}`);
  const attempts = join(directory, `${mode}-attempts.jsonl`);
  const accepted = join(directory, `${mode}-accepted.json`);
  const binding = join(directory, `${mode}-binding.json`);
  const script = `#!/usr/bin/env node
const fs = require("node:fs");
const http = require("node:http");
const args = process.argv.slice(2);
if (args[0] !== "browser") process.exit(31);
const port = Number(args[args.indexOf("--port") + 1]);
const mode = ${JSON.stringify(mode)};
const server = http.createServer((req, res) => {
  if (req.url === "/api/status" && req.method === "GET") {
    if (mode === "status-hold") return;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ initialized: true, projectPath: process.env.BACKLOG_CWD, backlogDirectory: "backlog" }));
    return;
  }
  const chunks = [];
  req.on("data", chunk => chunks.push(chunk));
  req.on("end", () => {
    fs.appendFileSync(${JSON.stringify(attempts)}, JSON.stringify({ method: req.method, url: req.url }) + "\\n");
    fs.writeFileSync(${JSON.stringify(accepted)}, Buffer.concat(chunks));
    if (mode === "hold") return;
    res.destroy(); // task may exist, but no response reaches the caller
  });
});
server.listen(port, "127.0.0.1", () => {
  fs.writeFileSync(${JSON.stringify(binding)}, JSON.stringify({ pid: process.pid, port }));
  console.log("Backlog.md browser interface running at http://127.0.0.1:" + port);
});
process.on("SIGTERM", () => {
  if (mode === "ignore-term") return;
  server.closeAllConnections(); server.close(() => process.exit(0));
});
`;
  writeFileSync(executable, script, { mode: 0o700 });
  return { executable, attempts, accepted, binding };
}

function acceptedRequest(path) {
  if (existsSync(path)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { watcher.close(); reject(new Error("controlled request was not received")); }, 5000);
    const watcher = watch(join(path, ".."), () => {
      if (!existsSync(path)) return;
      clearTimeout(timeout);
      watcher.close();
      resolve();
    });
    if (existsSync(path)) { clearTimeout(timeout); watcher.close(); resolve(); }
  });
}

test("migration web uncertain failure never resends or removes a possibly accepted task", { timeout: 30_000 }, async (t) => {
  const directory = sandbox(t);
  const target = repository(directory, "controlled-failure");
  const secret = "PRIVATE-NATIVE-ERROR-BODY-Ω-DO-NOT-ECHO";
  const stub = failingExecutable(directory, "reject", secret);
  const transport = await startMigrationBacklogWeb({
    cwd: target, backlogDirectory: join(target, "backlog"), backlogCommand: stub.executable,
  });
  t.after(() => transport.close());
  const payload = { title: "possibly accepted task", description: secret };
  await assert.rejects(transport.createTask(payload), (error) => retainedFailure(t, error, "uncertain", secret));
  await assert.rejects(transport.createTask(payload));
  await assert.rejects(transport.updateTask("TASK-1", { description: secret }));
  assert.deepEqual(readFileSync(stub.attempts, "utf8").trim().split("\n").map(JSON.parse), [
    { method: "POST", url: "/api/tasks" },
  ]);
  assert.deepEqual(JSON.parse(readFileSync(stub.accepted, "utf8")), payload);
  const artifacts = privateArtifacts(transport.artifactDirectory);
  assert.ok(artifacts.some((path) => readFileSync(path, "utf8").includes(secret)), "failure evidence remains private rather than being discarded");
  await transport.close();
  await portReleased(transport.url);
  assert.deepEqual(JSON.parse(readFileSync(stub.accepted, "utf8")), payload);
});

test("migration web in-flight abort stops owned server fences writes and preserves accepted destination bytes", { timeout: 30_000 }, async (t) => {
  const directory = sandbox(t);
  const target = repository(directory, "controlled-abort");
  const secret = "PRIVATE-CANCELLED-PAYLOAD-Ω";
  const stub = failingExecutable(directory, "hold", secret);
  const controller = new AbortController();
  const transport = await startMigrationBacklogWeb({
    cwd: target, backlogDirectory: join(target, "backlog"), backlogCommand: stub.executable,
    signal: controller.signal, requestTimeoutMs: 10_000,
  });
  t.after(() => transport.close());
  const payload = { title: "accepted before cancellation", description: secret };
  const rejection = assert.rejects(transport.createTask(payload), (error) => retainedFailure(t, error, "uncertain", secret));
  await acceptedRequest(stub.accepted);
  controller.abort();
  await rejection;
  const exit = await transport.close();
  assert.equal(exit.forced, false);
  assert.ok(transport.server.exitCode !== null || transport.server.signalCode !== null);
  assert.throws(() => process.kill(-transport.server.pid, 0), { code: "ESRCH" }, "owned process group is gone");
  await portReleased(transport.url);
  await assert.rejects(transport.createTask({ title: "must not allocate again" }));
  assert.deepEqual(JSON.parse(readFileSync(stub.accepted, "utf8")), payload);
  assert.equal(readFileSync(stub.attempts, "utf8").trim().split("\n").length, 1);
  assert.ok(existsSync(transport.artifactDirectory));
});


test("migration web refuses resolved root or prepared-store mismatch before writes", { timeout: 60_000 }, async (t) => {
  const directory = sandbox(t);
  const target = repository(directory, "context-parent");
  const other = repository(directory, "wrong-store");
  const nested = join(target, "nested");
  mkdirSync(nested);
  const before = snapshot(target);
  const otherBefore = snapshot(other);
  for (const options of [
    { cwd: nested, backlogDirectory: join(target, "backlog") },
    { cwd: target, backlogDirectory: join(other, "backlog") },
  ]) {
    await assert.rejects(startMigrationBacklogWeb({ ...options, backlogCommand: BACKLOG }), (error) => {
      retainedFailure(t, error, "not-started");
      assert.equal(error.stage, "native-project-context");
      return true;
    });
  }
  assert.deepEqual(snapshot(target), before);
  assert.deepEqual(snapshot(other), otherBefore);
});


test("migration web startup timeout bounds a delayed native status response and stops its owned server", { timeout: 15_000 }, async (t) => {
  const directory = sandbox(t);
  const target = repository(directory, "delayed-status");
  const stub = failingExecutable(directory, "status-hold", "");
  const started = Date.now();
  await assert.rejects(startMigrationBacklogWeb({
    cwd: target, backlogDirectory: join(target, "backlog"), backlogCommand: stub.executable,
    startupTimeoutMs: 1000, requestTimeoutMs: 10_000,
  }), (error) => retainedFailure(t, error, "not-started"));
  assert.ok(Date.now() - started < 5000, "startup timeout also bounds the status request, not just URL announcement");
  const binding = JSON.parse(readFileSync(stub.binding, "utf8"));
  await portReleased(`http://127.0.0.1:${binding.port}`);
  assert.throws(() => process.kill(binding.pid, 0), { code: "ESRCH" });
  assert.ok(!existsSync(stub.attempts), "readiness failure makes no task request");
});


test("migration web escalates shutdown only for its owned TERM-resistant process", { timeout: 15_000 }, async (t) => {
  const directory = sandbox(t);
  const target = repository(directory, "forced-stop");
  const before = snapshot(target);
  const foreign = createServer((_req, res) => res.end("foreign owner"));
  await listen(foreign);
  t.after(() => closeServer(foreign));
  const stub = failingExecutable(directory, "ignore-term", "");
  const transport = await startMigrationBacklogWeb({
    cwd: target, backlogDirectory: join(target, "backlog"), backlogCommand: stub.executable,
    shutdownTimeoutMs: 200,
  });
  t.after(() => transport.close());
  const result = await transport.close();
  assert.equal(result.forced, true);
  assert.equal(result.signal, "SIGKILL");
  assert.throws(() => process.kill(-transport.server.pid, 0), { code: "ESRCH" });
  await portReleased(transport.url);
  assert.equal(foreign.listening, true, "unrelated listener is never signalled");
  assert.deepEqual(snapshot(target), before);
});
