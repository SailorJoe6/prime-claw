import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import specificationEpisodes from "../.prime/agent/extensions/specification-episodes.ts";

const execFileAsync = promisify(execFile);

async function run(command, args, options = {}) {
  try {
    const result = await execFileAsync(command, args, { encoding: "utf8", ...options });
    return { stdout: result.stdout, stderr: result.stderr, code: 0, killed: false };
  } catch (error) {
    return {
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message,
      code: typeof error.code === "number" ? error.code : 1,
      killed: Boolean(error.killed),
    };
  }
}

function writeSkill(cwd, name, body) {
  const path = join(cwd, ".ralph", "skills", name, "SKILL.md");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  return path;
}

async function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-specification-episodes-"));
  const cwd = join(root, "project");
  const remote = join(root, "remote.git");
  mkdirSync(cwd);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  await run("git", ["init", "-q", "--bare", remote]);
  await run("git", ["init", "-q", cwd]);
  await run("git", ["-C", cwd, "config", "user.name", "Prime Claw Tests"]);
  await run("git", ["-C", cwd, "config", "user.email", "tests@example.invalid"]);
  writeSkill(cwd, "design", "# Canonical design\n\nAsk one question at a time.\n");
  writeSkill(cwd, "spec-it-out", "# Canonical spec\n\nFormalize developed context.\n");
  await run("git", ["-C", cwd, "add", "."]);
  await run("git", ["-C", cwd, "commit", "-qm", "fixture"]);
  await run("git", ["-C", cwd, "remote", "add", "origin", remote]);
  await run("git", ["-C", cwd, "push", "-qu", "origin", "HEAD"]);
  await run("git", ["-C", cwd, "remote", "set-head", "origin", "--auto"]);

  const commands = new Map();
  const tools = new Map();
  const messages = [];
  const notices = [];
  const execCalls = [];
  const pi = {
    registerCommand(name, definition) { commands.set(name, definition); },
    registerTool(definition) { tools.set(definition.name, definition); },
    sendUserMessage(message) { messages.push(message); },
    async exec(command, args, options = {}) {
      execCalls.push({ command, args: [...args], options: { ...options } });
      return run(command, args, options);
    },
  };
  specificationEpisodes(pi);

  function context(sessionId = "session-12345678", contextCwd = cwd) {
    const sessionFile = join(cwd, ".git", "test-sessions", `${sessionId}.jsonl`);
    mkdirSync(dirname(sessionFile), { recursive: true });
    writeFileSync(sessionFile, `${JSON.stringify({
      type: "session", version: 3, id: sessionId, cwd: contextCwd,
    })}\n`);
    return {
      cwd: contextCwd,
      sessionManager: {
        getSessionId() { return sessionId; },
        getSessionFile() { return sessionFile; },
        getCwd() { return contextCwd; },
      },
      ui: { notify(message, level) { notices.push({ message, level }); } },
    };
  }
  return { root, cwd, remote, commands, tools, messages, notices, execCalls, context, ctx: context() };
}

function params(overrides = {}) {
  return {
    request_id: "request-12345678",
    confirmed_by_operator: true,
    decision: { kind: "future", slug: "safe-idea" },
    documents: {
      specification_markdown: "# Specification\n\nComplete behavior.",
      requirements_markdown: "# Requirements\n\n- R-1 required.",
      decisions_markdown: "# Decisions\n\n- D-1 satisfies R-1.",
    },
    ...overrides,
  };
}

function wrappedSkill(name, path, body, context = "") {
  const wrapped = `<skill name="${name}" location="${path}">\nReferences are relative to ${dirname(path)}.\n\n${body}\n</skill>`;
  return context ? `${wrapped}\n\n<operator-specification-context>\n${context}\n</operator-specification-context>` : wrapped;
}

function resultDetails(result) {
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, "text");
  return result.details;
}

test("registers fixed native commands and one sequential structured tool", async (t) => {
  const f = await fixture(t);
  assert.deepEqual([...f.commands.keys()], ["design", "spec-it-out"]);
  assert.deepEqual([...f.tools.keys()], ["spec_disposition"]);
  const tool = f.tools.get("spec_disposition");
  assert.equal(tool.executionMode, "sequential");
  assert.equal(tool.parameters.type, "object");
  assert.deepEqual(tool.parameters.required.sort(), ["confirmed_by_operator", "decision", "documents", "request_id"].sort());
  assert.deepEqual(tool.parameters.properties.decision.properties.kind.enum, ["future", "episode"]);
  assert.equal(tool.parameters.properties.decision.additionalProperties, false);
  assert.equal(tool.parameters.additionalProperties, false);
});

test("commands load canonical markdown byte-for-byte and treat args only as context", async (t) => {
  const f = await fixture(t);
  const designBody = readFileSync(join(f.cwd, ".ralph/skills/design/SKILL.md"), "utf8");
  const specBody = readFileSync(join(f.cwd, ".ralph/skills/spec-it-out/SKILL.md"), "utf8");
  const context = "../../not-a-skill; keep punctuation & spaces";

  await f.commands.get("design").handler(`  ${context}  `, f.ctx);
  await f.commands.get("spec-it-out").handler("", f.ctx);

  assert.deepEqual(f.messages, [
    wrappedSkill("design", join(f.cwd, ".ralph/skills/design/SKILL.md"), designBody, context),
    wrappedSkill("spec-it-out", join(f.cwd, ".ralph/skills/spec-it-out/SKILL.md"), specBody),
  ]);
  assert.deepEqual(f.notices, []);
  assert.equal(f.execCalls.length, 0);
});

test("missing canonical markdown warns without injecting or creating control state", async (t) => {
  const f = await fixture(t);
  rmSync(join(f.cwd, ".ralph/skills/design/SKILL.md"));
  await f.commands.get("design").handler("", f.ctx);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.notices, [{
    message: "specification-episodes: .ralph/skills/design/SKILL.md not found",
    level: "warning",
  }]);
  assert.equal(f.execCalls.length, 0);
});

test("future preflight persists a non-mutating durable receipt under git common dir", async (t) => {
  const f = await fixture(t);
  const beforeBranch = (await run("git", ["-C", f.cwd, "branch", "--show-current"])).stdout.trim();
  const beforeWorktrees = (await run("git", ["-C", f.cwd, "worktree", "list", "--porcelain"])).stdout;

  const details = resultDetails(await f.tools.get("spec_disposition").execute("call-1", params(), undefined, undefined, f.ctx));

  assert.equal(details.status, "preflight-ready");
  assert.equal(details.phase, "validated");
  assert.equal(details.product_resource_mutation_performed, false);
  assert.equal(details.control_state_writes_performed.length, 2);
  assert.equal(details.deduplicated, false);
  assert.equal(details.disposition, "future");
  assert.equal(details.owner_session_id, "session-12345678");
  const receiptText = readFileSync(details.receipt_path, "utf8");
  assert.equal(JSON.parse(receiptText).disposition_id, details.disposition_id);
  assert.doesNotMatch(receiptText, /Complete behavior|R-1 required|D-1 satisfies/);
  assert.match(details.receipt_path, /\.git\/prime-claw\/dispositions\/.+\.json$/);
  assert.equal((await run("git", ["-C", f.cwd, "status", "--porcelain"])).stdout, "");
  assert.equal((await run("git", ["-C", f.cwd, "branch", "--show-current"])).stdout.trim(), beforeBranch);
  assert.equal((await run("git", ["-C", f.cwd, "worktree", "list", "--porcelain"])).stdout, beforeWorktrees);
  assert.ok(f.execCalls.every((call) => call.command === "git" && Array.isArray(call.args)));
});

test("episode preflight validates a structured branch with argument-based git", async (t) => {
  const f = await fixture(t);
  const episode = params({
    decision: { kind: "episode", slug: "safe-episode", branch_name: "feature/safe-episode" },
  });
  const details = resultDetails(await f.tools.get("spec_disposition").execute("call-2", episode, undefined, undefined, f.ctx));
  assert.equal(details.disposition, "episode");
  assert.equal(details.branch_name, "feature/safe-episode");
  assert.ok(f.execCalls.some((call) => call.command === "git" && call.args.includes("check-ref-format") && call.args.includes("feature/safe-episode")));
});

test("same semantic payload deduplicates across request ids and restart", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("call-a", params(), undefined, undefined, f.ctx));
  writeFileSync(join(f.cwd, "ordinary-untracked.txt"), "ordinary state change\n");

  const commands2 = new Map();
  const tools2 = new Map();
  const pi2 = {
    registerCommand(name, definition) { commands2.set(name, definition); },
    registerTool(definition) { tools2.set(definition.name, definition); },
    sendUserMessage() {},
    exec: f.tools.size ? async (command, args, options = {}) => run(command, args, options) : undefined,
  };
  specificationEpisodes(pi2);
  const second = resultDetails(await tools2.get("spec_disposition").execute(
    "call-b", params({ request_id: "request-87654321" }), undefined, undefined, f.ctx,
  ));

  assert.equal(second.disposition_id, first.disposition_id);
  assert.equal(second.receipt_path, first.receipt_path);
  assert.equal(second.deduplicated, true);
  assert.equal(second.checkout_clean, true, "dedup returns the original immutable receipt snapshot");
  assert.equal(second.control_state_writes_performed.length, 1, "only the new request pointer is created");
});

test("request id reuse with changed content fails closed", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  await tool.execute("call-a", params(), undefined, undefined, f.ctx);
  const changed = params({
    documents: { ...params().documents, specification_markdown: "# Specification\n\nDifferent." },
  });
  await assert.rejects(
    tool.execute("call-b", changed, undefined, undefined, f.ctx),
    /request_id collision/i,
  );
});

test("same caller request id is isolated by stable session id", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  const a = resultDetails(await tool.execute("call-a", params(), undefined, undefined, f.context("session-aaaaaaaa")));
  const b = resultDetails(await tool.execute("call-b", params(), undefined, undefined, f.context("session-bbbbbbbb")));
  assert.notEqual(a.disposition_id, b.disposition_id);
  assert.notEqual(a.receipt_path, b.receipt_path);
});

test("invalid confirmation names paths documents and transient sessions fail before receipt writes", async (t) => {
  const cases = [
    [params({ confirmed_by_operator: false }), /explicit operator confirmation/i, f => f.ctx],
    [params({ request_id: "bad id" }), /request_id/i, f => f.ctx],
    [params({ decision: { kind: "future", slug: "../escape" } }), /slug/i, f => f.ctx],
    [params({ decision: { kind: "episode", slug: "safe", branch_name: "-bad" } }), /branch_name/i, f => f.ctx],
    [params({ documents: { ...params().documents, decisions_markdown: "" } }), /decisions_markdown/i, f => f.ctx],
    [{ ...params(), extra: true }, /unsupported field/i, f => f.ctx],
    [params({ decision: { kind: "future", slug: "safe", branch_name: "feature/not-allowed" } }), /not allowed for future/i, f => f.ctx],
    [params({ decision: { kind: "episode", slug: "safe", branch_name: "feature/safe", extra: true } }), /unsupported field/i, f => f.ctx],
    [params(), /persisted Prime Agent session/i, f => ({ ...f.ctx, sessionManager: { ...f.ctx.sessionManager, getSessionFile() { return undefined; } } })],
    [params(), /session CWD does not match/i, f => ({ ...f.ctx, sessionManager: { ...f.ctx.sessionManager, getCwd() { return dirname(f.cwd); } } })],
  ];
  for (const [input, pattern, contextFor] of cases) {
    const f = await fixture(t);
    await assert.rejects(
      f.tools.get("spec_disposition").execute("bad", input, undefined, undefined, contextFor(f)),
      pattern,
    );
  }
});

test("corrupt durable receipt fails closed rather than overwriting evidence", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("call-a", params(), undefined, undefined, f.ctx));
  writeFileSync(first.receipt_path, "not-json");
  await assert.rejects(
    tool.execute("call-b", params(), undefined, undefined, f.ctx),
    /corrupt durable receipt/i,
  );
  assert.equal(readFileSync(first.receipt_path, "utf8"), "not-json");
});

test("concurrent identical calls converge on one receipt", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  const [a, b] = await Promise.all([
    tool.execute("call-a", params(), undefined, undefined, f.ctx),
    tool.execute("call-b", params(), undefined, undefined, f.ctx),
  ]);
  const da = resultDetails(a);
  const db = resultDetails(b);
  assert.equal(da.disposition_id, db.disposition_id);
  assert.ok(da.deduplicated || db.deduplicated);
});


test("pre-aborted execution is a no-op before repository inspection or receipt writes", async (t) => {
  const f = await fixture(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    f.tools.get("spec_disposition").execute("cancelled", params(), controller.signal, undefined, f.ctx),
    /cancelled before durable preflight/i,
  );
  assert.equal(f.execCalls.length, 0);
  assert.equal(existsSync(join(f.cwd, ".git", "prime-claw")), false);
});

test("non-Git execution root fails before any durable control-state write", async (t) => {
  const f = await fixture(t);
  const nonGit = join(f.root, "not-a-repository");
  mkdirSync(nonGit);
  const ctx = f.context("session-notgit01", nonGit);
  await assert.rejects(
    f.tools.get("spec_disposition").execute("not-git", params(), undefined, undefined, ctx),
    /git rev-parse --show-toplevel failed/i,
  );
  assert.equal(existsSync(join(f.cwd, ".git", "prime-claw")), false);
});

test("linked worktree and non-default branch sources fail closed", async (t) => {
  const f = await fixture(t);
  const linked = join(f.root, "linked");
  await run("git", ["-C", f.cwd, "worktree", "add", "-qb", "feature/linked-source", linked]);
  await assert.rejects(
    f.tools.get("spec_disposition").execute(
      "linked", params({ request_id: "request-linked01" }), undefined, undefined,
      f.context("session-linked01", linked),
    ),
    /primary canonical checkout/i,
  );

  await run("git", ["-C", f.cwd, "switch", "-qc", "feature/wrong-source"]);
  const defaultRemote = (await run("git", ["-C", f.cwd, "symbolic-ref", "--short", "refs/remotes/origin/HEAD"])).stdout.trim();
  await run("git", ["-C", f.cwd, "branch", "--set-upstream-to", defaultRemote]);
  await assert.rejects(
    f.tools.get("spec_disposition").execute(
      "wrong-branch", params({ request_id: "request-wrong001" }), undefined, undefined,
      f.context("session-wrong001"),
    ),
    /configured remote default branch/i,
  );
  assert.equal(existsSync(join(f.cwd, ".git", "prime-claw")), false);
});

test("missing or mismatched persisted session header fails before receipt writes", async (t) => {
  const f = await fixture(t);
  const missing = f.context("session-missing1");
  rmSync(missing.sessionManager.getSessionFile());
  await assert.rejects(
    f.tools.get("spec_disposition").execute("missing", params(), undefined, undefined, missing),
    /session file is missing or invalid/i,
  );

  const mismatched = f.context("session-owner001");
  writeFileSync(mismatched.sessionManager.getSessionFile(), `${JSON.stringify({
    type: "session", version: 3, id: "different-owner", cwd: f.cwd,
  })}\n`);
  await assert.rejects(
    f.tools.get("spec_disposition").execute("mismatch", params(), undefined, undefined, mismatched),
    /header does not match the stable owner session ID/i,
  );
  assert.equal(existsSync(join(f.cwd, ".git", "prime-claw")), false);
});
