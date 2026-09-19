import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs, { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, lstatSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import specificationEpisodes, { acquireProjectLock, releaseProjectLock } from "../.prime/agent/extensions/specification-episodes.ts";

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


const bundleNames = [
  ["SPECIFICATION.md", "specification_markdown"],
  ["REQUIREMENTS.md", "requirements_markdown"],
  ["DECISIONS.md", "decisions_markdown"],
];
function writeBundle(target) {
  mkdirSync(target, { recursive: true });
  for (const [name, key] of bundleNames) writeFileSync(join(target, name), params().documents[key]);
}
async function stoppedBeforeCommit(f) {
  f.setExecInterceptor(async ({ args, invoke }) => args.includes("commit-tree")
    ? { stdout: "", stderr: "review stop before commit", code: 71, killed: false }
    : invoke());
  const first = resultDetails(await f.tools.get("spec_disposition").execute("stop", params(), undefined, undefined, f.ctx));
  assert.equal(first.status, "failed");
  assert.equal(first.product_resource_mutation_performed, true);
  assert.equal(typeof first.ownership_receipt_path, "string");
  f.setExecInterceptor(null);
  return first;
}

test("ASTRA-05 directory replacement must invalidate historical ownership before first removal", async (t) => {
  const f = await fixture(t);
  const first = await stoppedBeforeCommit(f);
  const target = join(f.cwd, ".ralph/plans/future/safe-idea");
  const original = join(f.root, "original-owned-directory");
  renameSync(target, original);
  writeBundle(target); // Another actor created this directory, with identical bytes.
  assert.notEqual(lstatSync(target).ino, lstatSync(original).ino);
  const before = (await run("git", ["-C", f.cwd, "status", "--porcelain=v1"])).stdout;
  const removal = resultDetails(await f.tools.get("spec_disposition").execute("remove", params({
    request_id: "request-replacement", recovery_action: "remove-owned-uncommitted",
  }), undefined, undefined, f.ctx));
  console.log("ASTRA-05", JSON.stringify({status:removal.status, target_exists:existsSync(target), original_exists:existsSync(original), error:removal.error}));
  assert.equal(existsSync(target), true, "Unowned replacement directory was deleted using a stale receipt");
  assert.equal((await run("git", ["-C", f.cwd, "status", "--porcelain=v1"])).stdout, before);
});

test("ASTRA-05 same-name identical file replacement invalidates removal authority", async (t) => {
  const f = await fixture(t);
  await stoppedBeforeCommit(f);
  const target = join(f.cwd, ".ralph/plans/future/safe-idea");
  const path = join(target, "SPECIFICATION.md");
  const original = join(f.root, "original-owned-specification.md");
  renameSync(path, original);
  writeFileSync(path, params().documents.specification_markdown);
  assert.notEqual(lstatSync(path).ino, lstatSync(original).ino);
  const before = (await run("git", ["-C", f.cwd, "status", "--porcelain=v1"])).stdout;
  const removal = resultDetails(await f.tools.get("spec_disposition").execute("remove-file-replacement", params({
    request_id: "request-file-replace", recovery_action: "remove-owned-uncommitted",
  }), undefined, undefined, f.ctx));
  assert.equal(removal.status, "failed");
  assert.equal(existsSync(path), true, "Unowned same-name file replacement was deleted");
  assert.equal(readFileSync(path, "utf8"), params().documents.specification_markdown);
  assert.equal(existsSync(original), true);
  assert.equal((await run("git", ["-C", f.cwd, "status", "--porcelain=v1"])).stdout, before);
});

test("ASTRA-06 control child swapped after validation must not redirect consumption writes", async (t) => {
  const f = await fixture(t);
  const first = await stoppedBeforeCommit(f);
  const child = join(f.cwd, ".git/prime-claw/future-ownership-consumed");
  const outside = join(f.root, "external-sentinel-directory");
  mkdirSync(outside);
  let injected = false;
  f.setExecInterceptor(async ({ args, invoke }) => {
    if (!injected && args.includes("diff") && args.includes("--cached")) {
      injected = true;
      renameSync(child, join(f.root, "saved-control-child"));
      symlinkSync(outside, child, "dir");
    }
    return invoke();
  });
  const removal = resultDetails(await f.tools.get("spec_disposition").execute("remove", params({
    request_id: "request-control-swap", recovery_action: "remove-owned-uncommitted",
  }), undefined, undefined, f.ctx));
  const entries = readdirSync(outside);
  console.log("ASTRA-06", JSON.stringify({status:removal.status, external_entries:entries, target_exists:existsSync(join(f.cwd,".ralph/plans/future/safe-idea")), error:removal.error}));
  assert.equal(injected, true);
  assert.equal(removal.status, "failed");
  assert.equal(existsSync(join(f.cwd,".ralph/plans/future/safe-idea")), true);
  assert.deepEqual(entries, [], "Consumption tombstone was written outside the Git common dir");
});

test("ASTRA-07 replay current observations must not predate its own reconciled state", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("success", params(), undefined, undefined, f.ctx));
  assert.equal(first.status, "verified-success");
  let statusCount = 0;
  let injected = false;
  f.setExecInterceptor(async ({ args, invoke }) => {
    if (args.includes("status")) {
      statusCount += 1;
      const result = await invoke();
      // preflight status #1, locked state #2, reconcile state #3
      if (statusCount === 2) {
        writeFileSync(join(f.cwd,"concurrent-wip.txt"), "unowned concurrent dirt\n");
        injected = true;
      }
      return result;
    }
    return invoke();
  });
  const replay = resultDetails(await tool.execute("replay", params({request_id:"request-replay-race"}), undefined, undefined, f.ctx));
  const actual = (await run("git", ["-C", f.cwd, "status", "--porcelain=v1"])).stdout;
  console.log("ASTRA-07", JSON.stringify({status:replay.status, current_checkout_clean:replay.current_checkout_clean, current_status_paths:replay.current_status_paths, actual_status:actual, statusCount}));
  assert.equal(injected, true);
  assert.equal(replay.status, "verified-success", JSON.stringify(replay, null, 2));
  assert.equal(replay.current_checkout_clean, false, "Replay discards a newer dirty observation and claims current cleanliness");
  assert.ok(replay.current_status_paths.includes("concurrent-wip.txt"));
});

test("ASTRA-07 final replay observation follows historical validation and reports all current refs", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("success-final-observation", params(), undefined, undefined, f.ctx));
  assert.equal(first.status, "verified-success");
  let injected = false;
  f.setExecInterceptor(async ({ args, invoke }) => {
    const result = await invoke();
    if (!injected && args.includes("ls-tree")) {
      injected = true;
      writeFileSync(join(f.cwd, "late-commit.txt"), "committed after historical validation began\n");
      await run("git", ["-C", f.cwd, "add", "late-commit.txt"]);
      await run("git", ["-C", f.cwd, "commit", "-qm", "late concurrent commit"]);
      writeFileSync(join(f.cwd, "late-dirt.txt"), "untracked after late commit\n");
    }
    return result;
  });
  const replay = resultDetails(await tool.execute("replay-final-observation", params({
    request_id: "request-final-observe",
  }), undefined, undefined, f.ctx));
  const head = (await run("git", ["-C", f.cwd, "rev-parse", "HEAD"])).stdout.trim();
  const upstream = (await run("git", ["-C", f.cwd, "rev-parse", "@{upstream}"])).stdout.trim();
  const remote = (await run("git", ["--git-dir", f.remote, "rev-parse", "HEAD"])).stdout.trim();
  assert.equal(injected, true);
  assert.equal(replay.status, "verified-success", JSON.stringify(replay, null, 2));
  assert.equal(replay.current_checkout_clean, false);
  assert.ok(replay.current_status_paths.includes("late-dirt.txt"));
  assert.equal(replay.current_head, head);
  assert.equal(replay.current_upstream_head, upstream);
  assert.equal(replay.current_remote_head, remote);
  assert.equal(typeof replay.current_observed_at, "string");
});

test("ASTRA-07 final replay observation fails closed across a concurrent remote change", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("success-remote-bracket", params(), undefined, undefined, f.ctx));
  assert.equal(first.status, "verified-success");

  const racer = join(f.root, "remote-observation-racer");
  await run("git", ["clone", "-q", f.remote, racer]);
  await run("git", ["-C", racer, "config", "user.name", "Remote Observer"]);
  await run("git", ["-C", racer, "config", "user.email", "observer@example.invalid"]);
  writeFileSync(join(racer, "remote-change.txt"), "changed during final observation\n");
  await run("git", ["-C", racer, "add", "remote-change.txt"]);
  await run("git", ["-C", racer, "commit", "-qm", "remote observation race"]);

  let remoteReads = 0;
  let injected = false;
  f.setExecInterceptor(async ({ args, invoke }) => {
    const result = await invoke();
    if (args.includes("ls-remote")) {
      remoteReads += 1;
      if (!injected && remoteReads === 2) {
        injected = true;
        await run("git", ["-C", racer, "push", "-q", "origin", "HEAD:main"]);
      }
    }
    return result;
  });
  const replay = resultDetails(await tool.execute("replay-remote-race", params({
    request_id: "request-remote-observe",
  }), undefined, undefined, f.ctx));
  assert.equal(injected, true);
  assert.equal(replay.status, "failed", JSON.stringify(replay, null, 2));
  assert.match(replay.error, /remote changed while collecting|repository or remote changed/i);
});

test("ASTRA-07 historical success remains valid after same-byte working-tree inode replacement", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("success-history", params(), undefined, undefined, f.ctx));
  assert.equal(first.status, "verified-success");
  const path = join(f.cwd, ".ralph/plans/future/safe-idea/SPECIFICATION.md");
  const old = join(f.root, "historical-owned-spec.md");
  renameSync(path, old);
  writeFileSync(path, params().documents.specification_markdown);
  assert.notEqual(lstatSync(path).ino, lstatSync(old).ino);
  const replay = resultDetails(await tool.execute("replay-history", params({
    request_id: "request-history-replay",
  }), undefined, undefined, f.ctx));
  assert.equal(replay.status, "verified-success");
  assert.equal(replay.historical_checkout_clean, true);
  assert.equal(replay.current_checkout_clean, true);
});

test("ASTRA-08 replay must reject a malformed success journal commit identity", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("success", params(), undefined, undefined, f.ctx));
  assert.equal(first.status,"verified-success");
  const journal = JSON.parse(readFileSync(first.transaction_path,"utf8"));
  journal.commit.oid = "this-is-not-an-object-id";
  writeFileSync(first.transaction_path,JSON.stringify(journal));
  const replay = resultDetails(await tool.execute("replay",params({request_id:"request-corrupt-commit"}),undefined,undefined,f.ctx));
  console.log("ASTRA-08",JSON.stringify({status:replay.status,commit_oid:journal.commit.oid}));
  assert.notEqual(replay.status,"verified-success","Malformed commit.oid accepted as complete success evidence");
});

test("ASTRA-13 closed v2 success schema rejects every malformed retained field and preserves evidence", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("success-schema", params(), undefined, undefined, f.ctx));
  assert.equal(first.status, "verified-success");
  const original = JSON.parse(readFileSync(first.transaction_path, "utf8"));
  const blockerPath = join(f.cwd, ".git/prime-claw/future-mutation-blocked.json");
  const blockerBytes = JSON.stringify({ version: 1, disposition_id: first.disposition_id, sentinel: "immutable" });
  const cases = [
    ["missing-target-directory", (v) => { delete v.target_directory; }],
    ["owned-paths-null", (v) => { v.owned_paths = null; }],
    ["owned-paths-string", (v) => { v.owned_paths = "not-an-array"; }],
    ["owned-paths-missing", (v) => { delete v.owned_paths; }],
    ["bad-version", (v) => { v.version = 987654321; }],
    ["bad-common-dir", (v) => { v.git_common_dir = "/unrelated/git/common"; }],
    ["bad-session-file", (v) => { v.owner_session_file = "/unrelated/session.jsonl"; }],
    ["bad-local-branch", (v) => { v.branch.local = "other"; }],
    ["bad-upstream", (v) => { v.branch.upstream = "origin/other"; }],
    ["bad-remote", (v) => { v.branch.remote = "other"; }],
    ["bad-remote-branch", (v) => { v.branch.remote_branch = "other"; }],
    ["bad-base-oid", (v) => { v.base_head = "not-an-oid"; }],
    ["bad-commit-oid", (v) => { v.commit.oid = "not-an-oid"; }],
    ["bad-tree-oid", (v) => { v.commit.tree = "not-an-oid"; }],
    ["bad-parent-oid", (v) => { v.commit.parent = "not-an-oid"; }],
    ["bad-publication-head", (v) => { v.publication.verified_head = "not-an-oid"; }],
    ["bad-publication-upstream", (v) => { v.publication.verified_upstream_head = "not-an-oid"; }],
    ["bad-publication-remote", (v) => { v.publication.verified_remote_head = "not-an-oid"; }],
    ["extra-observed-oid", (v) => { v.observed_head = "not-an-oid"; }],
    ["extra-nested-key", (v) => { v.commit.observed_oid = "not-an-oid"; }],
  ];
  for (const [index, [name, mutate]] of cases.entries()) {
    const corrupted = structuredClone(original); mutate(corrupted);
    const bytes = JSON.stringify(corrupted);
    writeFileSync(first.transaction_path, bytes); writeFileSync(blockerPath, blockerBytes);
    const replay = resultDetails(await tool.execute(`schema-${name}`, params({ request_id: `request-schema-${index.toString().padStart(3, "0")}` }), undefined, undefined, f.ctx));
    assert.equal(replay.status, "failed", `${name} was accepted as verified success`);
    assert.equal(readFileSync(first.transaction_path, "utf8"), bytes, `${name} corruption was overwritten`);
    assert.equal(readFileSync(blockerPath, "utf8"), blockerBytes, `${name} changed the blocker`);
  }
});

test("ASTRA-13 receipt graph rejects inconsistent or absent historical nodes", async (t) => {
  const f = await fixture(t); const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("success-receipts", params(), undefined, undefined, f.ctx));
  assert.equal(first.status, "verified-success");
  const originalJournal = JSON.parse(readFileSync(first.transaction_path, "utf8"));
  const bundlePath = first.bundle_ownership_receipt_path;
  const originalBundleBytes = readFileSync(bundlePath, "utf8");
  const filePath = originalJournal.receipts.files["SPECIFICATION.md"].path;
  const originalFileBytes = readFileSync(filePath, "utf8");
  const treeEvidencePath = originalJournal.receipts.tree_evidence.path;
  const originalTreeEvidenceBytes = readFileSync(treeEvidencePath, "utf8");
  const blockerPath = join(f.cwd, ".git/prime-claw/future-mutation-blocked.json");
  const blockerBytes = JSON.stringify({ version: 1, disposition_id: first.disposition_id, sentinel: "receipt-immutable" });
  const cases = ["bundle-file-identity", "bundle-directory-identity", "missing-creation-receipt", "corrupt-creation-receipt", "missing-tree-evidence", "corrupt-tree-evidence", "tree-evidence-oid"];
  for (const [index, name] of cases.entries()) {
    writeFileSync(bundlePath, originalBundleBytes); writeFileSync(filePath, originalFileBytes); writeFileSync(treeEvidencePath, originalTreeEvidenceBytes);
    const journal = structuredClone(originalJournal);
    if (name.startsWith("bundle-")) {
      const bundle = JSON.parse(originalBundleBytes);
      if (name === "bundle-file-identity") bundle.files["SPECIFICATION.md"].filesystem_identity.inode = "9999999999999";
      else bundle.directory_identity.inode = "9999999999999";
      const bytes = JSON.stringify(bundle); writeFileSync(bundlePath, bytes);
      journal.receipts.bundle.sha256 = createHash("sha256").update(bytes).digest("hex");
    } else if (name === "missing-creation-receipt") fs.rmSync(filePath);
    else if (name === "corrupt-creation-receipt") writeFileSync(filePath, "not-json");
    else if (name === "missing-tree-evidence") fs.rmSync(treeEvidencePath);
    else if (name === "corrupt-tree-evidence") writeFileSync(treeEvidencePath, "not-json");
    else {
      const evidence = JSON.parse(originalTreeEvidenceBytes); evidence.tree = originalJournal.base_head;
      const bytes = JSON.stringify(evidence); writeFileSync(treeEvidencePath, bytes);
      journal.receipts.tree_evidence.sha256 = createHash("sha256").update(bytes).digest("hex");
    }
    const journalBytes = JSON.stringify(journal); writeFileSync(first.transaction_path, journalBytes); writeFileSync(blockerPath, blockerBytes);
    const replay = resultDetails(await tool.execute(`receipt-${name}`, params({ request_id: `request-receipt-${index.toString().padStart(3, "0")}` }), undefined, undefined, f.ctx));
    assert.equal(replay.status, "failed", `${name} was accepted`);
    assert.equal(readFileSync(first.transaction_path, "utf8"), journalBytes);
    assert.equal(readFileSync(blockerPath, "utf8"), blockerBytes);
  }
});

test("ASTRA-06b construction evidence cannot follow a late indexes swap", async (t) => {
  const f = await fixture(t);
  const indexes = join(f.cwd, ".git/prime-claw/indexes");
  const outside = join(f.root, "external-index-build");
  mkdirSync(outside);
  let injected = false;
  f.setSpecificationFault((phase) => {
    if (!injected && phase === "before-exact-tree-build") {
      injected = true;
      renameSync(indexes, join(f.root, "original-index-build"));
      symlinkSync(outside, indexes, "dir");
    }
  });
  const result = resultDetails(await f.tools.get("spec_disposition").execute("index-build-swap", params(), undefined, undefined, f.ctx));
  assert.equal(injected, true);
  assert.equal(result.status, "failed");
  assert.deepEqual(readdirSync(outside), [], "Exact-tree construction wrote through a swapped control child");
  assert.equal(existsSync(join(f.cwd, ".ralph/plans/future/safe-idea")), true);
});

test("ASTRA-09 bundle regular-file type must survive exact-tree construction", async (t) => {
  const f = await fixture(t);
  const remoteBase = (await run("git", ["--git-dir", f.remote, "rev-parse", "HEAD"])).stdout.trim();
  let injected = false;
  f.setSpecificationFault((phase) => {
    if (!injected && phase === "before-exact-tree-build") {
      injected = true;
      for (const [name,key] of bundleNames) {
        const path = join(f.cwd,".ralph/plans/future/safe-idea",name);
        rmSync(path);
        symlinkSync(params().documents[key],path);
      }
    }
  });
  const result = resultDetails(await f.tools.get("spec_disposition").execute("symlink-race",params(),undefined,undefined,f.ctx));
  const tree = (await run("git",["--git-dir",f.remote,"ls-tree","-r","HEAD",".ralph/plans/future/safe-idea"])).stdout;
  console.log("ASTRA-09",JSON.stringify({status:result.status, remote_tree:tree, error:result.error}));
  assert.equal(injected,true);
  assert.notEqual(result.status,"verified-success","Symlink objects were accepted and published as regular Markdown documents");
  assert.equal((await run("git", ["--git-dir", f.remote, "rev-parse", "HEAD"])).stdout.trim(), remoteBase);
  assert.doesNotMatch(tree,/120000/);
});

test("ASTRA-06b static indexes child symlink must not permit deleting an external file", async (t) => {
  const f = await fixture(t);
  const first = await stoppedBeforeCommit(f);
  const indexes = join(f.cwd,".git/prime-claw/indexes");
  const outside = join(f.root,"external-indexes");
  mkdirSync(outside);
  const name = `${first.disposition_id}.index`;
  const sentinel = join(outside,name);
  writeFileSync(sentinel,readFileSync(join(indexes,name)));
  renameSync(indexes,join(f.root,"original-indexes"));
  symlinkSync(outside,indexes,"dir");
  const removal = resultDetails(await f.tools.get("spec_disposition").execute("remove",params({
    request_id:"request-indexes-symlink",recovery_action:"remove-owned-uncommitted",
  }),undefined,undefined,f.ctx));
  console.log("ASTRA-06b",JSON.stringify({status:removal.status,external_file_exists:existsSync(sentinel),error:removal.error}));
  assert.equal(existsSync(sentinel),true,"Recovery deleted external file through static indexes symlink");
});

test("ASTRA-06b late indexes child swap cannot redirect construction-evidence deletion", async (t) => {
  const f = await fixture(t);
  const first = await stoppedBeforeCommit(f);
  const indexes = join(f.cwd, ".git/prime-claw/indexes");
  const outside = join(f.root, "external-indexes-late");
  mkdirSync(outside);
  const name = `${first.disposition_id}.index`;
  const sentinel = join(outside, name);
  writeFileSync(sentinel, readFileSync(join(indexes, name)));
  let injected = false;
  f.setExecInterceptor(async ({ args, invoke }) => {
    if (!injected && args.includes("diff") && args.includes("--cached")) {
      injected = true;
      renameSync(indexes, join(f.root, "original-indexes-late"));
      symlinkSync(outside, indexes, "dir");
    }
    return invoke();
  });
  const removal = resultDetails(await f.tools.get("spec_disposition").execute("remove-late-indexes", params({
    request_id: "request-index-late", recovery_action: "remove-owned-uncommitted",
  }), undefined, undefined, f.ctx));
  assert.equal(injected, true);
  assert.equal(removal.status, "failed");
  assert.equal(existsSync(sentinel), true, "Late control-child swap deleted an external index");
  assert.equal(existsSync(join(f.cwd, ".ralph/plans/future/safe-idea")), true);
});

test("ASTRA-08b pre-validation repository failure preserves success journal and blocker", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("success-prevalidation", params(), undefined, undefined, f.ctx));
  assert.equal(first.status, "verified-success");
  const journalBytes = readFileSync(first.transaction_path, "utf8");
  const blockerPath = join(f.cwd, ".git/prime-claw/future-mutation-blocked.json");
  const blockerBytes = JSON.stringify({ version: 1, disposition_id: first.disposition_id, sentinel: "prevalidation" });
  writeFileSync(blockerPath, blockerBytes);
  let statusCount = 0;
  f.setExecInterceptor(async ({ args, invoke }) => {
    if (args.includes("status")) {
      statusCount += 1;
      if (statusCount === 2) return { stdout: "", stderr: "injected locked inspection failure", code: 73, killed: false };
    }
    return invoke();
  });
  const replay = resultDetails(await tool.execute("replay-prevalidation", params({
    request_id: "request-prevalidation",
  }), undefined, undefined, f.ctx));
  assert.equal(replay.status, "failed");
  assert.equal(readFileSync(first.transaction_path, "utf8"), journalBytes);
  assert.equal(readFileSync(blockerPath, "utf8"), blockerBytes);
});

test("ASTRA-08b corrupt ownership path in success journal must preserve exact evidence", async (t) => {
  const f = await fixture(t);
  const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("success",params(),undefined,undefined,f.ctx));
  assert.equal(first.status,"verified-success");
  const journal = JSON.parse(readFileSync(first.transaction_path,"utf8"));
  journal.receipts.directory.path = join(f.root,"not-the-derived-path.json");
  const corrupted = JSON.stringify(journal);
  writeFileSync(first.transaction_path,corrupted);
  const blockerPath = join(f.cwd, ".git/prime-claw/future-mutation-blocked.json");
  const blockerBytes = JSON.stringify({ version: 1, disposition_id: first.disposition_id, sentinel: "preserve-exactly" });
  writeFileSync(blockerPath, blockerBytes);
  const replay = resultDetails(await tool.execute("replay",params({request_id:"request-corrupt-path"}),undefined,undefined,f.ctx));
  const after = readFileSync(first.transaction_path,"utf8");
  console.log("ASTRA-08b",JSON.stringify({status:replay.status,journal_preserved:after===corrupted,persisted_status:JSON.parse(after).status,error:replay.error}));
  assert.equal(replay.status,"failed");
  assert.equal(after,corrupted,"Malformed success journal was overwritten instead of preserved");
  assert.equal(readFileSync(blockerPath, "utf8"), blockerBytes, "Malformed success replay changed the recovery blocker");
});


test("ASTRA-11 helper failure never falls back to recursive external lock cleanup", async () => {
  const result = await run("node", ["--experimental-strip-types", "tests/helpers/specification_episodes_astra11_worker.mjs", "cleanup"], { cwd: resolve(".") });
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /ASTRA11_CLEANUP_OK/);
});

test("ASTRA-11 atomic owner publication refuses a replacement lock incarnation", async () => {
  const result = await run("node", ["--experimental-strip-types", "tests/helpers/specification_episodes_astra11_worker.mjs", "owner"], { cwd: resolve(".") });
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /ASTRA11_OWNER_OK/);
});

test("ASTRA-11 inter-call real-directory replacement is never adopted", async () => {
  const result = await run("node", ["--experimental-strip-types", "tests/helpers/specification_episodes_astra11_worker.mjs", "intercall"], { cwd: resolve(".") });
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /ASTRA11_INTERCALL_OK/);
});

test("ASTRA-11 release preserves a replacement lock and its prior owner", async () => {
  const result = await run("node", ["--experimental-strip-types", "tests/helpers/specification_episodes_astra11_worker.mjs", "release"], { cwd: resolve(".") });
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /ASTRA11_RELEASE_OK/);
});

test("ASTRA-14 stable newer remote rollback fails final reachability and preserves blocker", async (t) => {
  const f = await fixture(t); const tool = f.tools.get("spec_disposition");
  const first = resultDetails(await tool.execute("remote-success", params(), undefined, undefined, f.ctx));
  assert.equal(first.status, "verified-success");
  const journal = JSON.parse(readFileSync(first.transaction_path, "utf8"));
  const journalBytes = readFileSync(first.transaction_path, "utf8");
  const blockerPath = join(f.cwd, ".git/prime-claw/future-mutation-blocked.json");
  const blockerBytes = JSON.stringify({ version: 1, disposition_id: first.disposition_id, sentinel: "remote-immutable" });
  writeFileSync(blockerPath, blockerBytes);
  const branch = (await run("git", ["-C", f.cwd, "symbolic-ref", "--short", "HEAD"])).stdout.trim();
  let injected = false;
  f.setExecInterceptor(async ({ args, invoke }) => {
    const result = await invoke();
    if (!injected && args.includes("ls-remote")) {
      injected = true;
      const rollback = await run("git", ["--git-dir", f.remote, "update-ref", `refs/heads/${branch}`, journal.base_head, first.commit_sha]);
      assert.equal(rollback.code, 0, rollback.stderr);
    }
    return result;
  });
  const replay = resultDetails(await tool.execute("remote-replay", params({ request_id: "request-remote-final" }), undefined, undefined, f.ctx));
  assert.equal(injected, true); assert.equal(replay.status, "failed");
  assert.equal(readFileSync(first.transaction_path, "utf8"), journalBytes);
  assert.equal(readFileSync(blockerPath, "utf8"), blockerBytes);
});

test("ASTRA-15 post-success-write failure preserves exact newly durable success and blocker", async (t) => {
  const f = await fixture(t); const tool = f.tools.get("spec_disposition");
  let failedOnce = false;
  f.setSpecificationFault((phase) => { if (!failedOnce && phase === "commit-object-created") { failedOnce = true; throw new Error("create recovery blocker"); } });
  const failed = resultDetails(await tool.execute("initial-failure", params(), undefined, undefined, f.ctx));
  assert.equal(failed.status, "failed");
  const blockerPath = join(f.cwd, ".git/prime-claw/future-mutation-blocked.json");
  const blockerBytes = readFileSync(blockerPath, "utf8");
  let corruptedBytes = "";
  f.setSpecificationFault((phase) => {
    if (phase === "success-journal-written") {
      const success = JSON.parse(readFileSync(failed.transaction_path, "utf8"));
      success.commit.oid = "not-an-oid-after-publication";
      corruptedBytes = JSON.stringify(success);
      writeFileSync(failed.transaction_path, corruptedBytes);
      throw new Error("fault after durable success publication");
    }
  });
  const replay = resultDetails(await tool.execute("continue-success", params({ request_id: "request-continue-success", recovery_action: "continue" }), undefined, undefined, f.ctx));
  assert.equal(replay.status, "failed"); assert.equal(replay.corrupt_success_journal_preserved, true);
  assert.equal(readFileSync(failed.transaction_path, "utf8"), corruptedBytes);
  assert.equal(readFileSync(blockerPath, "utf8"), blockerBytes);
});

test("ASTRA-15 final cleanup fault occurs after lock release and preserves success blocker evidence", async (t) => {
  const f = await fixture(t); const tool = f.tools.get("spec_disposition");
  let failedOnce = false;
  f.setSpecificationFault((phase) => { if (!failedOnce && phase === "commit-object-created") { failedOnce = true; throw new Error("create recovery blocker"); } });
  const failed = resultDetails(await tool.execute("initial-cleanup-failure", params(), undefined, undefined, f.ctx));
  const blockerPath = join(f.cwd, ".git/prime-claw/future-mutation-blocked.json");
  const blockerBytes = readFileSync(blockerPath, "utf8");
  let successBytes = ""; let injected = false;
  f.setSpecificationFault((phase) => {
    if (!injected && phase === "before-success-blocker-cleanup") {
      injected = true; successBytes = readFileSync(failed.transaction_path, "utf8");
      throw new Error("fault before final blocker cleanup");
    }
  });
  const replay = resultDetails(await tool.execute("continue-cleanup", params({ request_id: "request-continue-cleanup", recovery_action: "continue" }), undefined, undefined, f.ctx));
  assert.equal(injected, true); assert.equal(replay.status, "failed"); assert.equal(replay.corrupt_success_journal_preserved, true);
  assert.equal(readFileSync(failed.transaction_path, "utf8"), successBytes);
  assert.equal(readFileSync(blockerPath, "utf8"), blockerBytes);
  assert.equal(existsSync(join(f.cwd, ".git/prime-claw/locks/project-mutation.lock")), false, "lock must already be retired before final blocker cleanup");
});
