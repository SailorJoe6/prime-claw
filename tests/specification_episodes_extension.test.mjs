import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
  mkdirSync(join(cwd, ".ralph", "plans"), { recursive: true });
  writeFileSync(join(cwd, ".ralph", "plans", ".gitkeep"), "");
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
  let execInterceptor = null;
  let specificationFault = null;
  const pi = {
    async __primeClawSpecificationFault(phase) {
      if (specificationFault) await specificationFault(phase);
    },
    registerCommand(name, definition) { commands.set(name, definition); },
    registerTool(definition) { tools.set(definition.name, definition); },
    sendUserMessage(message) { messages.push(message); },
    async exec(command, args, options = {}) {
      execCalls.push({ command, args: [...args], options: { ...options } });
      const invoke = () => run(command, args, options);
      return execInterceptor ? execInterceptor({ command, args: [...args], options: { ...options }, invoke }) : invoke();
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
  return {
    root, cwd, remote, commands, tools, messages, notices, execCalls, context, ctx: context(),
    setExecInterceptor(value) { execInterceptor = value; },
    setSpecificationFault(value) { specificationFault = value; },
  };
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
  assert.deepEqual(tool.parameters.properties.recovery_action.enum, ["inspect", "continue", "remove-owned-uncommitted"]);
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

test("future disposition commits and pushes only the three-file bundle without episode allocation", async (t) => {
  const f = await fixture(t);
  const beforeBranch = (await run("git", ["-C", f.cwd, "branch", "--show-current"])).stdout.trim();
  const beforeWorktrees = (await run("git", ["-C", f.cwd, "worktree", "list", "--porcelain"])).stdout
    .split("\n").filter((line) => line.startsWith("worktree "));
  const beforeBranches = (await run("git", ["-C", f.cwd, "for-each-ref", "--format=%(refname)", "refs/heads"])).stdout;
  const beforeSessions = readdirSync(join(f.cwd, ".git/test-sessions")).sort();

  const details = resultDetails(await f.tools.get("spec_disposition").execute("call-1", params(), undefined, undefined, f.ctx));

  assert.equal(details.status, "verified-success", JSON.stringify(details, null, 2));
  assert.equal(details.phase, "pushed-and-clean");
  assert.equal(details.product_resource_mutation_performed, true);
  assert.equal(details.episode_resources_allocated, false);
  assert.equal(details.deduplicated, false);
  assert.equal(details.disposition, "future");
  assert.equal(details.owner_session_id, "session-12345678");
  assert.match(details.preflight_receipt_path, /\.git\/prime-claw\/dispositions\/.+\.json$/);
  assert.match(details.transaction_path, /\.git\/prime-claw\/future-transactions\/.+\.json$/);
  const receiptText = readFileSync(details.preflight_receipt_path, "utf8");
  const transactionText = readFileSync(details.transaction_path, "utf8");
  assert.equal(JSON.parse(receiptText).disposition_id, details.disposition_id);
  assert.doesNotMatch(`${receiptText}${transactionText}`, /Complete behavior|R-1 required|D-1 satisfies/);
  for (const [name, key] of [
    ["SPECIFICATION.md", "specification_markdown"],
    ["REQUIREMENTS.md", "requirements_markdown"],
    ["DECISIONS.md", "decisions_markdown"],
  ]) {
    assert.equal(readFileSync(join(f.cwd, ".ralph/plans/future/safe-idea", name), "utf8"), params().documents[key]);
  }
  assert.equal((await run("git", ["-C", f.cwd, "status", "--porcelain"])).stdout, "");
  assert.equal((await run("git", ["-C", f.cwd, "rev-parse", "HEAD"])).stdout.trim(), details.commit_sha);
  assert.equal((await run("git", ["-C", f.cwd, "rev-parse", "@{upstream}"])).stdout.trim(), details.commit_sha);
  assert.equal((await run("git", ["-C", f.cwd, "branch", "--show-current"])).stdout.trim(), beforeBranch);
  assert.deepEqual(
    (await run("git", ["-C", f.cwd, "worktree", "list", "--porcelain"])).stdout
      .split("\n").filter((line) => line.startsWith("worktree ")),
    beforeWorktrees,
  );
  assert.equal((await run("git", ["-C", f.cwd, "for-each-ref", "--format=%(refname)", "refs/heads"])).stdout, beforeBranches);
  assert.deepEqual(readdirSync(join(f.cwd, ".git/test-sessions")).sort(), beforeSessions);
  assert.ok(f.execCalls.every((call) => call.command === "git" && Array.isArray(call.args)));
});

test("future disposition refuses tracked, untracked, and staged dirt before bundle mutation", async (t) => {
  const scenarios = [
    ["untracked", async (f) => writeFileSync(join(f.cwd, "unrelated.txt"), "untracked\n")],
    ["tracked", async (f) => writeFileSync(join(f.cwd, ".ralph/skills/design/SKILL.md"), "changed\n")],
    ["staged", async (f) => {
      writeFileSync(join(f.cwd, "staged.txt"), "staged\n");
      await run("git", ["-C", f.cwd, "add", "staged.txt"]);
    }],
  ];
  for (const [name, dirty] of scenarios) {
    await t.test(name, async (st) => {
      const f = await fixture(st);
      const beforeHead = (await run("git", ["-C", f.cwd, "rev-parse", "HEAD"])).stdout.trim();
      await dirty(f);
      const beforeStatus = (await run("git", ["-C", f.cwd, "status", "--porcelain=v1"])).stdout;
      const details = resultDetails(await f.tools.get("spec_disposition").execute(
        `dirty-${name}`, params({ request_id: `request-dirty-${name}` }), undefined, undefined, f.ctx,
      ));
      assert.equal(details.status, "failed");
      assert.equal(details.product_resource_mutation_performed, false);
      assert.match(details.error, /pre-existing dirty paths/i);
      assert.equal(existsSync(join(f.cwd, ".ralph/plans/future/safe-idea")), false);
      assert.equal((await run("git", ["-C", f.cwd, "rev-parse", "HEAD"])).stdout.trim(), beforeHead);
      assert.equal((await run("git", ["-C", f.cwd, "status", "--porcelain=v1"])).stdout, beforeStatus);
      assert.equal(existsSync(join(f.cwd, ".git/prime-claw/future-mutation-blocked.json")), false);
    });
  }
});

test("existing future path is a collision and is never overwritten", async (t) => {
  const f = await fixture(t);
  const target = join(f.cwd, ".ralph/plans/future/safe-idea");
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "SPECIFICATION.md"), "pre-existing\n");
  writeFileSync(join(target, "REQUIREMENTS.md"), "pre-existing\n");
  writeFileSync(join(target, "DECISIONS.md"), "pre-existing\n");
  await run("git", ["-C", f.cwd, "add", ".ralph/plans/future/safe-idea"]);
  await run("git", ["-C", f.cwd, "commit", "-qm", "existing candidate"]);
  await run("git", ["-C", f.cwd, "push", "-q"]);
  const before = readFileSync(join(target, "SPECIFICATION.md"), "utf8");

  const details = resultDetails(await f.tools.get("spec_disposition").execute(
    "collision", params(), undefined, undefined, f.ctx,
  ));
  assert.equal(details.status, "failed");
  assert.equal(details.product_resource_mutation_performed, false);
  assert.match(details.error, /already exists/i);
  assert.equal(readFileSync(join(target, "SPECIFICATION.md"), "utf8"), before);
  assert.equal((await run("git", ["-C", f.cwd, "status", "--porcelain"])).stdout, "");
});

test("commit-object failure requires explicit recovery and supports safe removal or continuation", async (t) => {
  const f = await fixture(t);
  let failCommitTree = true;
  f.setExecInterceptor(async ({ args, invoke }) => {
    if (failCommitTree && args.includes("commit-tree")) {
      return { stdout: "", stderr: "injected commit-tree failure", code: 71, killed: false };
    }
    return invoke();
  });
  const tool = f.tools.get("spec_disposition");
  const failed = resultDetails(await tool.execute("fault", params(), undefined, undefined, f.ctx));
  assert.equal(failed.status, "failed");
  assert.equal(failed.product_resource_mutation_performed, true);
  assert.match(failed.error, /injected commit-tree failure/i);
  assert.equal(existsSync(join(f.cwd, ".git/prime-claw/future-mutation-blocked.json")), true);

  const ordinaryRetry = resultDetails(await tool.execute(
    "retry", params({ request_id: "request-retry001" }), undefined, undefined, f.ctx,
  ));
  assert.equal(ordinaryRetry.status, "recovery-required");
  assert.equal(ordinaryRetry.recovery_action_required, true);

  const removed = resultDetails(await tool.execute(
    "remove",
    params({ request_id: "request-remove01", recovery_action: "remove-owned-uncommitted" }),
    undefined, undefined, f.ctx,
  ));
  assert.equal(removed.status, "recovered-clean", JSON.stringify(removed, null, 2));
  assert.equal(existsSync(join(f.cwd, ".ralph/plans/future/safe-idea")), false);
  assert.equal(existsSync(join(f.cwd, ".ralph/plans/future")), true);
  assert.deepEqual(readdirSync(join(f.cwd, ".ralph/plans/future")), []);
  assert.equal(existsSync(join(f.cwd, ".git/prime-claw/future-mutation-blocked.json")), false);
  assert.equal((await run("git", ["-C", f.cwd, "status", "--porcelain"])).stdout, "");
  const staleReceiptRetry = resultDetails(await tool.execute(
    "stale-receipt",
    params({ request_id: "request-stale-receipt", recovery_action: "continue" }),
    undefined, undefined, f.ctx,
  ));
  assert.equal(staleReceiptRetry.status, "failed");
  assert.match(staleReceiptRetry.error, /explicitly removed|does not support implicit recovery|directory is absent.*refusing automatic recreation/i);
  assert.equal(existsSync(join(f.cwd, ".ralph/plans/future/safe-idea")), false);

  const continuationParams = params({
    request_id: "request-cont0001",
    decision: { kind: "future", slug: "continue-idea" },
  });
  const failedAgain = resultDetails(await tool.execute("fault-2", continuationParams, undefined, undefined, f.ctx));
  assert.equal(failedAgain.status, "failed");
  failCommitTree = false;
  const continued = resultDetails(await tool.execute(
    "continue",
    { ...continuationParams, request_id: "request-cont0002", recovery_action: "continue" },
    undefined, undefined, f.ctx,
  ));
  assert.equal(continued.status, "verified-success", JSON.stringify(continued, null, 2));
  assert.equal(existsSync(join(f.cwd, ".git/prime-claw/future-mutation-blocked.json")), false);
  assert.equal((await run("git", ["-C", f.cwd, "status", "--porcelain"])).stdout, "");
});

test("corrupt private-index journal path cannot delete an external sentinel", async (t) => {
  const f = await fixture(t);
  f.setExecInterceptor(async ({ args, invoke }) => {
    if (args.includes("commit-tree")) return { stdout: "", stderr: "stop with owned index", code: 70, killed: false };
    return invoke();
  });
  const tool = f.tools.get("spec_disposition");
  const failed = resultDetails(await tool.execute("index-path-fault", params(), undefined, undefined, f.ctx));
  assert.equal(failed.status, "failed");
  const sentinel = join(f.root, "must-survive.txt");
  writeFileSync(sentinel, "do not delete\n");
  const journal = JSON.parse(readFileSync(failed.transaction_path, "utf8"));
  journal.private_index_path = sentinel;
  writeFileSync(failed.transaction_path, `${JSON.stringify(journal, null, 2)}\n`);
  f.setExecInterceptor(null);

  const removal = resultDetails(await tool.execute(
    "index-path-remove",
    params({ request_id: "request-indexpath", recovery_action: "remove-owned-uncommitted" }),
    undefined, undefined, f.ctx,
  ));
  assert.equal(removal.status, "failed");
  assert.match(removal.error, /private-index path does not match the derived control path/i);
  assert.equal(readFileSync(sentinel, "utf8"), "do not delete\n");
});


test("push rejection preserves the exact local commit for explicit continuation", async (t) => {
  const f = await fixture(t);
  const hook = join(f.remote, "hooks", "pre-receive");
  writeFileSync(hook, "#!/bin/sh\necho injected push rejection >&2\nexit 1\n", { mode: 0o755 });
  const tool = f.tools.get("spec_disposition");
  const failed = resultDetails(await tool.execute("push-fault", params(), undefined, undefined, f.ctx));
  assert.equal(failed.status, "failed");
  assert.equal(failed.phase, "pushing");
  assert.match(failed.error, /push.*failed|rejection/i);
  assert.equal(typeof failed.commit_sha, "string");
  assert.equal((await run("git", ["-C", f.cwd, "rev-parse", "HEAD"])).stdout.trim(), failed.commit_sha);
  assert.equal((await run("git", ["-C", f.cwd, "status", "--porcelain"])).stdout, "");
  assert.equal(typeof failed.observed_remote_head, "string");
  assert.equal(Object.keys(failed.observed_owned_files).length, 3);
  assert.equal(failed.observed_commit.content_matches, true);
  assert.equal(failed.observed_private_index.exists, false);

  rmSync(hook);
  const continued = resultDetails(await tool.execute(
    "push-continue",
    params({ request_id: "request-pushcont", recovery_action: "continue" }),
    undefined, undefined, f.ctx,
  ));
  assert.equal(continued.status, "verified-success", JSON.stringify(continued, null, 2));
  assert.equal((await run("git", ["-C", f.cwd, "rev-parse", "@{upstream}"])).stdout.trim(), continued.commit_sha);
});

test("uncertain push response is reconciled from the actual remote before recovery success", async (t) => {
  const f = await fixture(t);
  let losePushResponse = true;
  f.setExecInterceptor(async ({ args, invoke }) => {
    const result = await invoke();
    if (losePushResponse && args.includes("push")) {
      losePushResponse = false;
      return { stdout: "", stderr: "injected lost push response", code: 74, killed: false };
    }
    return result;
  });
  const tool = f.tools.get("spec_disposition");
  const uncertain = resultDetails(await tool.execute("uncertain-push", params(), undefined, undefined, f.ctx));
  assert.equal(uncertain.status, "failed");
  assert.match(uncertain.error, /lost push response/i);
  const actualRemote = (await run("git", ["--git-dir", f.remote, "rev-parse", "HEAD"])).stdout.trim();
  assert.equal(actualRemote, uncertain.commit_sha);

  const recovered = resultDetails(await tool.execute(
    "uncertain-recover",
    params({ request_id: "request-uncertain", recovery_action: "continue" }),
    undefined, undefined, f.ctx,
  ));
  assert.equal(recovered.status, "verified-success", JSON.stringify(recovered, null, 2));
  assert.equal(recovered.verified_remote_head, uncertain.commit_sha);
});


test("non-cooperative primary-index staging is detected and never enters the future commit", async (t) => {
  const f = await fixture(t);
  let injected = false;
  f.setExecInterceptor(async ({ args, invoke }) => {
    if (!injected && args.includes("update-ref")) {
      injected = true;
      writeFileSync(join(f.cwd, "unrelated-race.txt"), "other conversation\n");
      await run("git", ["-C", f.cwd, "add", "unrelated-race.txt"]);
    }
    return invoke();
  });
  const details = resultDetails(await f.tools.get("spec_disposition").execute(
    "index-race", params(), undefined, undefined, f.ctx,
  ));
  assert.equal(details.status, "failed");
  assert.match(details.error, /unrelated paths appeared/i);
  const commit = details.commit_object_sha;
  assert.equal(typeof commit, "string");
  const changed = (await run("git", ["-C", f.cwd, "diff-tree", "--no-commit-id", "--name-only", "-r", commit])).stdout;
  assert.doesNotMatch(changed, /unrelated-race/);
  assert.match((await run("git", ["-C", f.cwd, "status", "--porcelain"])).stdout, /unrelated-race/);
  assert.notEqual((await run("git", ["-C", f.cwd, "rev-parse", "@{upstream}"])).stdout.trim(), commit);
});


test("remote race preserves the local owned commit and refuses implicit rebase", async (t) => {
  const f = await fixture(t);
  const racer = join(f.root, "remote-racer");
  await run("git", ["clone", "-q", f.remote, racer]);
  await run("git", ["-C", racer, "config", "user.name", "Remote Racer"]);
  await run("git", ["-C", racer, "config", "user.email", "racer@example.invalid"]);
  writeFileSync(join(racer, "remote-race.txt"), "remote advance\n");
  const hook = join(f.cwd, ".git", "hooks", "pre-push");
  const q = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  writeFileSync(hook, [
    "#!/bin/sh",
    `git -C ${q(racer)} add remote-race.txt`,
    `git -C ${q(racer)} commit -qm remote-race`,
    `git -C ${q(racer)} push -q origin HEAD`,
    "exit 0",
    "",
  ].join("\n"), { mode: 0o755 });
  const tool = f.tools.get("spec_disposition");
  const failed = resultDetails(await tool.execute("remote-race", params(), undefined, undefined, f.ctx));
  assert.equal(failed.status, "failed");
  assert.equal(failed.phase, "pushing");
  assert.equal(typeof failed.commit_sha, "string");
  const remoteHead = (await run("git", ["--git-dir", f.remote, "rev-parse", "HEAD"])).stdout.trim();
  assert.notEqual(remoteHead, failed.commit_sha);
  assert.deepEqual(await (async () => (await run(
    "git", ["-C", f.cwd, "diff-tree", "--no-commit-id", "--name-only", "-r", "-z", failed.commit_sha],
  )).stdout.split("\0").filter(Boolean).sort())(), [
    ".ralph/plans/future/safe-idea/DECISIONS.md",
    ".ralph/plans/future/safe-idea/REQUIREMENTS.md",
    ".ralph/plans/future/safe-idea/SPECIFICATION.md",
  ]);
  rmSync(hook);
  const retry = resultDetails(await tool.execute(
    "remote-race-retry",
    params({ request_id: "request-racecont", recovery_action: "continue" }),
    undefined, undefined, f.ctx,
  ));
  assert.equal(retry.status, "failed");
  assert.match(retry.error, /remote default branch raced|recovery state diverged/i);
  assert.equal((await run("git", ["-C", f.cwd, "rev-parse", "HEAD"])).stdout.trim(), failed.commit_sha);
});

test("two OS processes serialize future bundles without cross-commit or lost work", async (t) => {
  const f = await fixture(t);
  const worker = resolve("tests/helpers/spec_disposition_worker.mjs");
  const startAt = Date.now() + 750;
  const calls = [
    ["session-processa", "request-processa", "process-a"],
    ["session-processb", "request-processb", "process-b"],
  ];
  const first = await Promise.all(calls.map(async ([session, request, slug]) => {
    const result = await execFileAsync(process.execPath, [
      "--experimental-strip-types", worker, f.cwd, session, request, slug, String(startAt),
    ], { encoding: "utf8" });
    return JSON.parse(result.stdout);
  }));
  assert.ok(first.every((details) => ["verified-success", "lock-contention"].includes(details.status)));
  assert.ok(first.some((details) => details.status === "verified-success"));

  for (let index = 0; index < first.length; index += 1) {
    if (first[index].status !== "lock-contention") continue;
    const [session, request, slug] = calls[index];
    const result = await execFileAsync(process.execPath, [
      "--experimental-strip-types", worker, f.cwd, session, request, slug, "0",
    ], { encoding: "utf8" });
    first[index] = JSON.parse(result.stdout);
  }
  assert.ok(first.every((details) => details.status === "verified-success"), JSON.stringify(first, null, 2));
  const commits = [];
  for (const details of first) {
    assert.equal(details.episode_resources_allocated, false);
    const paths = (await run(
      "git", ["-C", f.cwd, "diff-tree", "--no-commit-id", "--name-only", "-r", "-z", details.commit_sha],
    )).stdout.split("\0").filter(Boolean);
    assert.equal(paths.length, 3);
    assert.ok(paths.every((path) => path.includes(`/${details.slug}/`)));
    commits.push(details.commit_sha);
  }
  assert.equal(new Set(commits).size, 2);
  const remoteFiles = (await run(
    "git", ["--git-dir", f.remote, "ls-tree", "-r", "--name-only", "HEAD", ".ralph/plans/future"],
  )).stdout;
  assert.match(remoteFiles, /future\/process-a\/SPECIFICATION\.md/);
  assert.match(remoteFiles, /future\/process-b\/SPECIFICATION\.md/);
  assert.equal((await run("git", ["-C", f.cwd, "status", "--porcelain"])).stdout, "");
  assert.equal(existsSync(join(f.cwd, ".git/prime-claw/locks/project-mutation.lock")), false);
});


test("held or ambiguous project locks are never stolen", async (t) => {
  for (const mode of ["valid", "empty", "corrupt"]) {
    await t.test(mode, async (st) => {
      const f = await fixture(st);
      const lockDir = join(f.cwd, ".git/prime-claw/locks/project-mutation.lock");
      mkdirSync(lockDir, { recursive: true });
      if (mode === "valid") writeFileSync(join(lockDir, "owner.json"), `${JSON.stringify({ token: "other", disposition_id: "other" })}\n`);
      if (mode === "corrupt") writeFileSync(join(lockDir, "owner.json"), "not-json");
      const details = resultDetails(await f.tools.get("spec_disposition").execute(
        `lock-${mode}`, params({ request_id: `request-lock-${mode}` }), undefined, undefined, f.ctx,
      ));
      assert.equal(details.status, "lock-contention");
      assert.equal(existsSync(lockDir), true);
      assert.equal(existsSync(join(f.cwd, ".ralph/plans/future/safe-idea")), false);
      assert.match(details.next_safe_action, /never steal/i);
    });
  }
});

test("token mismatch prevents a false success and preserves the ambiguous lock receipt", async (t) => {
  const f = await fixture(t);
  let remoteQueries = 0;
  f.setExecInterceptor(async ({ args, invoke }) => {
    const result = await invoke();
    if (args.includes("ls-remote")) {
      remoteQueries += 1;
      if (remoteQueries === 3) {
        const ownerPath = join(f.cwd, ".git/prime-claw/locks/project-mutation.lock/owner.json");
        writeFileSync(ownerPath, `${JSON.stringify({ token: "replaced-by-other-owner" })}\n`);
      }
    }
    return result;
  });
  await assert.rejects(
    f.tools.get("spec_disposition").execute("lock-token", params(), undefined, undefined, f.ctx),
    /lock release failed.*receipt/i,
  );
  const lockDir = join(f.cwd, ".git/prime-claw/locks/project-mutation.lock");
  assert.equal(existsSync(lockDir), true);
  const attempts = readdirSync(join(f.cwd, ".git/prime-claw/future-attempts"));
  const attempt = JSON.parse(readFileSync(join(f.cwd, ".git/prime-claw/future-attempts", attempts[0]), "utf8"));
  assert.equal(attempt.status, "lock-release-failed");
});


test("cancellation after bundle mutation produces durable recoverable state", async (t) => {
  const f = await fixture(t);
  const controller = new AbortController();
  let aborted = false;
  f.setExecInterceptor(async ({ args, invoke }) => {
    if (!aborted && args.includes("commit-tree")) {
      aborted = true;
      controller.abort();
    }
    return invoke();
  });
  const details = resultDetails(await f.tools.get("spec_disposition").execute(
    "cancel-after-write", params(), controller.signal, undefined, f.ctx,
  ));
  assert.equal(details.status, "failed");
  assert.equal(details.product_resource_mutation_performed, true);
  assert.equal(details.recovery_action_required, true);
  assert.equal(existsSync(details.transaction_path), true);
  assert.equal(existsSync(join(f.cwd, ".git/prime-claw/future-mutation-blocked.json")), true);
  assert.equal(existsSync(join(f.cwd, ".ralph/plans/future/safe-idea/SPECIFICATION.md")), true);
});


test("future root symlink escape fails before external writes", async (t) => {
  const f = await fixture(t);
  const outside = join(f.root, "outside");
  mkdirSync(outside);
  symlinkSync(outside, join(f.cwd, ".ralph/plans/future"));
  const details = resultDetails(await f.tools.get("spec_disposition").execute(
    "symlink", params({ request_id: "request-symlink1" }), undefined, undefined, f.ctx,
  ));
  assert.equal(details.status, "failed");
  assert.equal(details.product_resource_mutation_performed, false);
  assert.match(details.error, /must not be a symlink/i);
  assert.deepEqual(readdirSync(outside), []);
});


test("every durable future mutation boundary resumes only through explicit recovery", async (t) => {
  const phases = [
    "journal-created",
    "directory-created",
    "file-written:SPECIFICATION.md",
    "file-written:REQUIREMENTS.md",
    "file-written:DECISIONS.md",
    "private-tree-built",
    "commit-object-created",
    "default-ref-advanced",
    "primary-index-reconciled",
    "push-returned",
    "success-journal-written",
  ];
  for (const [index, phase] of phases.entries()) {
    await t.test(phase, async (st) => {
      const f = await fixture(st);
      let injected = false;
      f.setSpecificationFault((observed) => {
        if (!injected && observed === phase) {
          injected = true;
          throw new Error(`injected boundary fault: ${phase}`);
        }
      });
      const tool = f.tools.get("spec_disposition");
      const failed = resultDetails(await tool.execute(
        `boundary-${index}`, params({ request_id: `request-boundary-${index}` }), undefined, undefined, f.ctx,
      ));
      assert.equal(injected, true, `boundary was not reached: ${phase}`);
      assert.equal(failed.status, "failed");
      assert.match(failed.error, /injected boundary fault/);

      const ordinary = resultDetails(await tool.execute(
        `boundary-observe-${index}`,
        params({ request_id: `request-observe-${index}` }),
        undefined, undefined, f.ctx,
      ));
      assert.equal(ordinary.status, "recovery-required");

      f.setSpecificationFault(null);
      const recovered = resultDetails(await tool.execute(
        `boundary-recover-${index}`,
        params({ request_id: `request-recover-${index}`, recovery_action: "continue" }),
        undefined, undefined, f.ctx,
      ));
      assert.equal(recovered.status, "verified-success", JSON.stringify(recovered, null, 2));
      assert.equal((await run("git", ["-C", f.cwd, "status", "--porcelain"])).stdout, "");
      assert.equal((await run("git", ["--git-dir", f.remote, "rev-parse", "HEAD"])).stdout.trim(), recovered.commit_sha);
      assert.equal(existsSync(join(f.cwd, ".git/prime-claw/future-mutation-blocked.json")), false);
    });
  }
});


test("removal-consumption control-directory symlink fails before external writes", async (t) => {
  const f = await fixture(t);
  const external = mkdtempSync(join(tmpdir(), "prime-claw-consumed-external-"));
  t.after(() => rmSync(external, { recursive: true, force: true }));
  mkdirSync(join(f.cwd, ".git/prime-claw"), { recursive: true });
  symlinkSync(external, join(f.cwd, ".git/prime-claw/future-ownership-consumed"));
  await assert.rejects(
    f.tools.get("spec_disposition").execute(
      "consumed-symlink", params(), undefined, undefined, f.ctx,
    ),
    /control directory must not be a symlink/i,
  );
  assert.deepEqual(readdirSync(external), []);
  assert.equal(existsSync(join(f.cwd, ".ralph/plans/future/safe-idea")), false);
});


test("Git control-root symlink escape fails before receipt writes", async (t) => {
  const f = await fixture(t);
  const outside = join(f.root, "outside-control");
  mkdirSync(outside);
  symlinkSync(outside, join(f.cwd, ".git/prime-claw"));
  await assert.rejects(
    f.tools.get("spec_disposition").execute(
      "control-symlink", params({ request_id: "request-controlsym" }), undefined, undefined, f.ctx,
    ),
    /control root must not be a symlink/i,
  );
  assert.deepEqual(readdirSync(outside), []);
});


test("explicit continue rechecks unresolved pre-existing dirt before any write", async (t) => {
  const f = await fixture(t);
  writeFileSync(join(f.cwd, "unrelated.txt"), "still dirty\n");
  const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("dirty", params(), undefined, undefined, f.ctx));
  assert.equal(first.status, "failed");
  assert.equal(first.product_resource_mutation_performed, false);
  const continued = resultDetails(await tool.execute(
    "dirty-continue",
    params({ request_id: "request-dirtycont", recovery_action: "continue" }),
    undefined, undefined, f.ctx,
  ));
  assert.equal(continued.status, "failed");
  assert.match(continued.error, /still has pre-existing dirty paths/i);
  assert.equal(continued.product_resource_mutation_performed, false);
  assert.equal(existsSync(join(f.cwd, ".ralph/plans/future/safe-idea")), false);
});

test("recovery refuses a replaced target-directory symlink without touching external bytes", async (t) => {
  const f = await fixture(t);
  f.setExecInterceptor(async ({ args, invoke }) => {
    if (args.includes("commit-tree")) return { stdout: "", stderr: "stop before commit", code: 70, killed: false };
    return invoke();
  });
  const tool = f.tools.get("spec_disposition");
  const failed = resultDetails(await tool.execute("partial", params(), undefined, undefined, f.ctx));
  assert.equal(failed.status, "failed");
  const target = join(f.cwd, ".ralph/plans/future/safe-idea");
  rmSync(target, { recursive: true, force: true });
  const outside = join(f.root, "outside-recovery");
  mkdirSync(outside);
  writeFileSync(join(outside, "SPECIFICATION.md"), params().documents.specification_markdown);
  writeFileSync(join(outside, "REQUIREMENTS.md"), params().documents.requirements_markdown);
  writeFileSync(join(outside, "DECISIONS.md"), params().documents.decisions_markdown);
  symlinkSync(outside, target);
  f.setExecInterceptor(null);

  const recovered = resultDetails(await tool.execute(
    "remove-symlink",
    params({ request_id: "request-symremove", recovery_action: "remove-owned-uncommitted" }),
    undefined, undefined, f.ctx,
  ));
  assert.equal(recovered.status, "failed");
  assert.match(recovered.error, /real directory|unrelated dirty paths/i);
  assert.equal(readFileSync(join(outside, "SPECIFICATION.md"), "utf8"), params().documents.specification_markdown);
  assert.deepEqual(readdirSync(outside).sort(), ["DECISIONS.md", "REQUIREMENTS.md", "SPECIFICATION.md"]);
});

test("recovery refuses an unrelated clean local descendant after uncertain remote success", async (t) => {
  const f = await fixture(t);
  let losePushResponse = true;
  f.setExecInterceptor(async ({ args, invoke }) => {
    const result = await invoke();
    if (losePushResponse && args.includes("push")) {
      losePushResponse = false;
      return { stdout: "", stderr: "lost response", code: 74, killed: false };
    }
    return result;
  });
  const tool = f.tools.get("spec_disposition");
  const uncertain = resultDetails(await tool.execute("uncertain", params(), undefined, undefined, f.ctx));
  assert.equal(uncertain.status, "failed");
  writeFileSync(join(f.cwd, "unrelated-descendant.txt"), "local only\n");
  await run("git", ["-C", f.cwd, "add", "unrelated-descendant.txt"]);
  await run("git", ["-C", f.cwd, "commit", "-qm", "unrelated local descendant"]);
  const descendant = (await run("git", ["-C", f.cwd, "rev-parse", "HEAD"])).stdout.trim();
  f.setExecInterceptor(null);

  const recovered = resultDetails(await tool.execute(
    "descendant-recovery",
    params({ request_id: "request-descend1", recovery_action: "continue" }),
    undefined, undefined, f.ctx,
  ));
  assert.equal(recovered.status, "failed");
  assert.match(recovered.error, /recovery state diverged|HEAD .*moved away|not the owned future commit/i);
  assert.equal((await run("git", ["-C", f.cwd, "rev-parse", "HEAD"])).stdout.trim(), descendant);
  assert.equal((await run("git", ["--git-dir", f.remote, "rev-parse", "HEAD"])).stdout.trim(), uncertain.commit_sha);
});


test("consumed removal authority cannot delete a later byte-identical replacement", async (t) => {
  const f = await fixture(t);
  f.setExecInterceptor(async ({ args, invoke }) => {
    if (args.includes("commit-tree")) return { stdout: "", stderr: "stop before commit", code: 71, killed: false };
    return invoke();
  });
  const tool = f.tools.get("spec_disposition");
  const failed = resultDetails(await tool.execute("stop", params(), undefined, undefined, f.ctx));
  const removed = resultDetails(await tool.execute(
    "remove-once",
    params({ request_id: "request-remove-once", recovery_action: "remove-owned-uncommitted" }),
    undefined, undefined, f.ctx,
  ));
  assert.equal(removed.status, "recovered-clean");
  assert.equal(existsSync(removed.ownership_consumed_path), true);

  const target = join(f.cwd, ".ralph/plans/future/safe-idea");
  mkdirSync(target, { recursive: true });
  const input = params();
  for (const [name, key] of [
    ["SPECIFICATION.md", "specification_markdown"],
    ["REQUIREMENTS.md", "requirements_markdown"],
    ["DECISIONS.md", "decisions_markdown"],
  ]) writeFileSync(join(target, name), input.documents[key]);

  const transaction = JSON.parse(readFileSync(failed.transaction_path, "utf8"));
  transaction.status = "failed"; // Mutable journal state cannot revive consumed authority.
  writeFileSync(failed.transaction_path, `${JSON.stringify(transaction, null, 2)}\n`);
  const repeated = resultDetails(await tool.execute(
    "remove-again",
    params({ request_id: "request-remove-again", recovery_action: "remove-owned-uncommitted" }),
    undefined, undefined, f.ctx,
  ));
  assert.equal(repeated.status, "failed");
  assert.match(repeated.error, /removal authority.*already consumed/i);
  assert.equal(readFileSync(join(target, "SPECIFICATION.md"), "utf8"), input.documents.specification_markdown);
});


test("commit-bearing recovery fails closed when immutable directory ownership evidence is missing", async (t) => {
  const f = await fixture(t);
  f.setSpecificationFault((phase) => {
    if (phase === "commit-object-created") throw new Error("stop after owned commit object");
  });
  const tool = f.tools.get("spec_disposition");
  const failed = resultDetails(await tool.execute("commit-stop", params(), undefined, undefined, f.ctx));
  assert.equal(failed.status, "failed");
  assert.match(failed.commit_object_sha, /^[0-9a-f]{40,64}$/);
  const transaction = JSON.parse(readFileSync(failed.transaction_path, "utf8"));
  const ownershipPath = transaction.ownership_receipt_path;
  rmSync(ownershipPath);
  f.setSpecificationFault(null);
  const recovery = resultDetails(await tool.execute(
    "missing-ownership",
    params({ request_id: "request-missing-ownership", recovery_action: "continue" }),
    undefined, undefined, f.ctx,
  ));
  assert.equal(recovery.status, "failed");
  assert.match(recovery.error, /records a commit.*ownership receipt is missing/i);
  assert.equal(existsSync(join(f.cwd, ".ralph/plans/future/safe-idea")), true);
  assert.equal(existsSync(join(f.cwd, ".git/prime-claw/future-mutation-blocked.json")), true);
});


test("ASTRA-01 removal preserves a pre-existing byte-identical bundle without ownership proof", async (t) => {
  const f = await fixture(t);
  const input = params();
  const target = join(f.cwd, ".ralph/plans/future/safe-idea");
  mkdirSync(target, { recursive: true });
  for (const [name, key] of [
    ["SPECIFICATION.md", "specification_markdown"],
    ["REQUIREMENTS.md", "requirements_markdown"],
    ["DECISIONS.md", "decisions_markdown"],
  ]) writeFileSync(join(target, name), input.documents[key]);
  const beforeStatus = (await run("git", ["-C", f.cwd, "status", "--porcelain=v1"])).stdout;
  const tool = f.tools.get("spec_disposition");
  const failed = resultDetails(await tool.execute("preexisting", input, undefined, undefined, f.ctx));
  assert.equal(failed.status, "failed");
  assert.equal(failed.product_resource_mutation_performed, false);
  const removal = resultDetails(await tool.execute(
    "remove-nonowned",
    { ...input, request_id: "request-remove-nonowned", recovery_action: "remove-owned-uncommitted" },
    undefined, undefined, f.ctx,
  ));
  assert.equal(removal.status, "failed");
  assert.match(removal.error, /without immutable proof/i);
  assert.equal(existsSync(target), true);
  assert.equal(readFileSync(join(target, "SPECIFICATION.md"), "utf8"), input.documents.specification_markdown);
  assert.equal((await run("git", ["-C", f.cwd, "status", "--porcelain=v1"])).stdout, beforeStatus);
});

test("ASTRA-02 push pins the owned commit when local HEAD advances concurrently", async (t) => {
  const f = await fixture(t);
  let raced = false;
  f.setExecInterceptor(async ({ args, invoke }) => {
    if (!raced && args.includes("push")) {
      raced = true;
      writeFileSync(join(f.cwd, "other-conversation.txt"), "not authorized to publish\n");
      await run("git", ["-C", f.cwd, "add", "other-conversation.txt"]);
      await run("git", ["-C", f.cwd, "commit", "-qm", "other conversation unpublished work"]);
    }
    return invoke();
  });
  const result = resultDetails(await f.tools.get("spec_disposition").execute(
    "race-push", params(), undefined, undefined, f.ctx,
  ));
  assert.equal(raced, true);
  assert.equal(result.status, "failed");
  const remoteHead = (await run("git", ["--git-dir", f.remote, "rev-parse", "HEAD"])).stdout.trim();
  assert.equal(remoteHead, result.commit_sha, "remote may advance only to the pinned owned commit");
  const remoteOther = await run("git", ["--git-dir", f.remote, "show", "HEAD:other-conversation.txt"]);
  assert.notEqual(remoteOther.code, 0, "unrelated local descendant was published");
});

test("ASTRA-03 malformed verified-success journal fails closed and remains preserved", async (t) => {
  const f = await fixture(t);
  f.setSpecificationFault((phase) => {
    if (phase === "journal-created") throw new Error("stop before mutation");
  });
  const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("stop", params(), undefined, undefined, f.ctx));
  const journal = JSON.parse(readFileSync(first.transaction_path, "utf8"));
  journal.status = "verified-success";
  writeFileSync(first.transaction_path, `${JSON.stringify(journal, null, 2)}\n`);
  f.setSpecificationFault(null);
  const replay = resultDetails(await tool.execute(
    "corrupt-replay", params({ request_id: "request-corrupt-success" }), undefined, undefined, f.ctx,
  ));
  assert.equal(replay.status, "failed");
  assert.equal(replay.corrupt_success_journal_preserved, true);
  assert.match(replay.error, /missing required success invariants/i);
  assert.equal(existsSync(join(f.cwd, ".ralph/plans/future/safe-idea")), false);
  assert.equal(JSON.parse(readFileSync(first.transaction_path, "utf8")).status, "verified-success");
});

test("ASTRA-04 successful replay separates historical success from current dirty state", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("first", params(), undefined, undefined, f.ctx));
  assert.equal(first.status, "verified-success");
  writeFileSync(join(f.cwd, "other-wip.txt"), "other conversation WIP\n");
  const replay = resultDetails(await tool.execute(
    "dirty-replay", params({ request_id: "request-replay-dirty" }), undefined, undefined, f.ctx,
  ));
  assert.equal(replay.status, "verified-success");
  assert.equal(replay.historical_checkout_clean, true);
  assert.equal(replay.checkout_clean, false);
  assert.equal(replay.current_checkout_clean, false);
  assert.ok(replay.current_status_paths.includes("other-wip.txt"));
});

test("ASTRA-05 removal preserves a concurrent unowned directory entry", async (t) => {
  const f = await fixture(t);
  const target = join(f.cwd, ".ralph/plans/future/safe-idea");
  const sentinel = join(target, "other-conversation-work.txt");
  f.setExecInterceptor(async ({ args, invoke }) => {
    if (args.includes("commit-tree")) return { stdout: "", stderr: "stop before commit", code: 70, killed: false };
    return invoke();
  });
  const tool = f.tools.get("spec_disposition");
  const failed = resultDetails(await tool.execute("stop", params(), undefined, undefined, f.ctx));
  assert.equal(failed.status, "failed");
  let injected = false;
  f.setExecInterceptor(async ({ args, invoke }) => {
    if (!injected && args.includes("diff") && args.includes("--cached")) {
      injected = true;
      writeFileSync(sentinel, "another conversation owns this\n");
    }
    return invoke();
  });
  const removal = resultDetails(await tool.execute(
    "remove-race",
    params({ request_id: "request-removal-race", recovery_action: "remove-owned-uncommitted" }),
    undefined, undefined, f.ctx,
  ));
  assert.equal(injected, true);
  assert.equal(removal.status, "failed");
  assert.equal(existsSync(sentinel), true);
  assert.equal(readFileSync(sentinel, "utf8"), "another conversation owns this\n");
  assert.match(removal.error, /not empty|ENOTEMPTY/i);
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
  const staleBlocker = join(f.cwd, ".git/prime-claw/future-mutation-blocked.json");
  writeFileSync(staleBlocker, `${JSON.stringify({ disposition_id: first.disposition_id })}\n`);

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
  assert.equal(second.transaction_path, first.transaction_path);
  assert.equal(second.deduplicated, true);
  assert.equal(second.status, "verified-success");
  assert.equal(second.commit_sha, first.commit_sha);
  assert.equal(second.control_state_writes_performed.length, 2, "new request and attempt control records are created");
  assert.equal(existsSync(staleBlocker), false, "successful replay clears only its own stale recovery blocker");
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
  const episode = params({ decision: { kind: "episode", slug: "safe-episode", branch_name: "feature/safe-episode" } });
  const a = resultDetails(await tool.execute("call-a", episode, undefined, undefined, f.context("session-aaaaaaaa")));
  const b = resultDetails(await tool.execute("call-b", episode, undefined, undefined, f.context("session-bbbbbbbb")));
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
  const episode = params({ decision: { kind: "episode", slug: "safe-episode", branch_name: "feature/safe-episode" } });
  const first = resultDetails(await tool.execute("call-a", episode, undefined, undefined, f.ctx));
  writeFileSync(first.receipt_path, "not-json");
  await assert.rejects(
    tool.execute("call-b", episode, undefined, undefined, f.ctx),
    /corrupt durable receipt/i,
  );
  assert.equal(readFileSync(first.receipt_path, "utf8"), "not-json");
});

test("concurrent identical calls serialize without duplicate mutation", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  const [a, b] = await Promise.all([
    tool.execute("call-a", params(), undefined, undefined, f.ctx),
    tool.execute("call-b", params({ request_id: "request-concur02" }), undefined, undefined, f.ctx),
  ]);
  const da = resultDetails(a);
  const db = resultDetails(b);
  const statuses = [da.status, db.status].sort();
  assert.deepEqual(statuses, ["lock-contention", "verified-success"]);
  const retry = resultDetails(await tool.execute(
    "call-c", params({ request_id: "request-concur02" }), undefined, undefined, f.ctx,
  ));
  assert.equal(retry.status, "verified-success");
  assert.equal(retry.deduplicated, true);
  const commits = (await run("git", ["-C", f.cwd, "log", "--format=%s"])).stdout
    .split("\n").filter((line) => line.startsWith("docs: incubate safe-idea"));
  assert.equal(commits.length, 1);
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
