import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { ProcessCommandRunner } from "../src/prime-agent-plugin/extension-support/project-initialization.ts";
import { commitConversationTaskStatus } from "../src/prime-agent-plugin/extension-support/spec-episode.ts";
import { resolveLegacyTaskOwnershipTransitionTarget } from "../src/prime-agent-plugin/extension-support/task-episode-ownership.ts";
import { createReviewedPlanExtension } from "../src/prime-agent-plugin/extensions/reviewed-plan.ts";
import {
  BEADS_DOLT_DATA_REF,
  BEADS_STATUS_MAP,
  CANONICAL_LIFECYCLE_STATUSES,
  checkBacklogCapabilities,
  checkBeadsCapabilities,
  checkSelectedProviderCapabilities,
  detectTaskProvider,
  mutateAndPublishBeadsTaskStatus,
  mutateProviderTaskStatus,
  prepareBeadsWorkspaceTransport,
  prepareExplicitBeadsWorkspaceTransport,
  readBeadsNativeTask,
  requireBacklogTaskSelection,
  resolveProviderTask,
} from "../src/prime-agent-plugin/extension-support/task-providers.ts";

const CANONICAL = [...CANONICAL_LIFECYCLE_STATUSES];

function fixtureRoot() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-providers-")));
  execFileSync("git", ["init", "-q", root]);
  return root;
}

function writeBacklogFolderConfig(root, dir = "backlog", name = "config.yml") {
  mkdirSync(join(root, dir), { recursive: true });
  const configPath = join(root, dir, name);
  writeFileSync(configPath, `project_name: "fixture"\nstatuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]\n`);
  return configPath;
}

function writeRootConfig(root, extra = "") {
  const configPath = join(root, "backlog.config.yml");
  writeFileSync(configPath, `project_name: "fixture"\n${extra}`);
  return configPath;
}

function writeBeadsStore(root, { metadataOverrides = {}, configText = "# beads config\n" } = {}) {
  const dir = join(root, ".beads");
  mkdirSync(join(dir, "dolt"), { recursive: true });
  writeFileSync(join(dir, "config.yaml"), configText);
  writeFileSync(join(dir, "metadata.json"), JSON.stringify({
    database: "dolt", backend: "dolt", dolt_mode: "embedded", dolt_database: "fixture_db", ...metadataOverrides,
  }));
  return dir;
}

function linkedWorktreeFixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-linked-provider-")));
  const primary = join(root, "primary");
  const linked = join(root, "linked");
  mkdirSync(primary);
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: primary });
  execFileSync("git", ["config", "user.name", "Provider Fixture"], { cwd: primary });
  execFileSync("git", ["config", "user.email", "provider@example.invalid"], { cwd: primary });
  writeFileSync(join(primary, "README.md"), "fixture\n");
  writeBeadsStore(primary, { metadataOverrides: { dolt_mode: "server" } });
  execFileSync("git", ["add", "README.md", ".beads/config.yaml", ".beads/metadata.json"], { cwd: primary });
  execFileSync("git", ["commit", "-q", "-m", "fixture"], { cwd: primary });
  execFileSync("git", ["worktree", "add", "-q", "-b", "episode", linked], { cwd: primary });
  return { root, primary: realpathSync(primary), linked: realpathSync(linked) };
}

function linkedBeadsContext(primary, linked, overrides = {}) {
  return {
    schema_version: 1,
    backend: "dolt",
    bd_version: "1.3.1",
    beads_dir: join(primary, ".beads"),
    cwd_repo_root: linked,
    database: "fixture_db",
    dolt_mode: "server",
    is_redirected: false,
    is_worktree: true,
    repo_root: primary,
    ...overrides,
  };
}

function linkedBeadsRunner(contextResult, extra = {}) {
  const real = new ProcessCommandRunner();
  const calls = [];
  const canned = { ...BEADS_OK, ...BD_NO_DB_FALSE, ...extra };
  return {
    calls,
    run(command, args, options = {}) {
      calls.push({ command, args: [...args], cwd: options.cwd });
      const key = [command, ...args].join("\0");
      if (key === "bd\0context\0--json") return contextResult;
      if (key in canned) return canned[key];
      return real.run(command, args, options);
    },
  };
}

/** Fake CommandRunner: exact (command, args) → canned result. */
function fakeRunner(responses) {
  const calls = [];
  return {
    calls,
    run(command, args, options = {}) {
      calls.push([command, ...args]);
      const key = [command, ...args].join("\0");
      const result = responses[key];
      if (!result) {
        if (options.allowFailure) return { stdout: "", stderr: `no fixture for ${key}`, status: 127 };
        throw new Error(`no fixture for ${key}`);
      }
      if (result.status !== 0 && !options.allowFailure) throw new Error(`${key} failed`);
      return result;
    },
  };
}

const BACKLOG_OK = {
  ["backlog\0--version"]: { stdout: "1.53.0\n", stderr: "", status: 0 },
  ["backlog\0config\0get\0statuses"]: { stdout: CANONICAL.join(", ") + "\n", stderr: "", status: 0 },
};

const BEADS_STATUSES_JSON = JSON.stringify({
  schema_version: 1,
  built_in_statuses: [
    { name: "open", category: "active" },
    { name: "in_progress", category: "wip" },
    { name: "blocked", category: "wip" },
    { name: "closed", category: "done" },
  ],
  custom_statuses: [
    { name: "in_design", category: "active" },
    { name: "in_planning", category: "active" },
    { name: "ready_for_merge", category: "wip" },
    { name: "done", category: "done" },
  ],
});

const BEADS_OK = {
  ["bd\0--version"]: { stdout: "bd version 1.1.2 (Homebrew) \n", stderr: "", status: 0 },
  ["bd\0statuses\0--json"]: { stdout: BEADS_STATUSES_JSON + "\n", stderr: "", status: 0 },
};

const BD_NO_DB_FALSE = { ["bd\0config\0get\0no-db"]: { stdout: "false\n", stderr: "", status: 0 } };

/**
 * Runner for detection tests: fake the recorded `bd` probes and delegate
 * everything else (Git project-root discovery) to the real process runner.
 */
function detectionRunner(extra = {}) {
  const responses = { ...BD_NO_DB_FALSE, ...extra };
  const real = new ProcessCommandRunner();
  const calls = [];
  return {
    calls,
    run(command, args, options = {}) {
      calls.push([command, ...args]);
      const key = [command, ...args].join("\0");
      if (key in responses) return responses[key];
      return real.run(command, args, options);
    },
  };
}

const DOLT_REVISION = "a".repeat(32);
const DOLT_DATA_HEAD = "b".repeat(40);
const DOLT_REMOTE_URL = "git+https://example.invalid/org/repo.git";
const DOLT_IDENTITY_QUERY = "SELECT database() AS database_name, active_branch() AS branch, dolt_hashof('HEAD') AS revision, dolt_version() AS dolt_version";
const DOLT_DIRTY_QUERY = "SELECT table_name, staged, status FROM dolt_status ORDER BY table_name";
const DOLT_REMOTE_IDENTITY_QUERY = "SELECT database() AS database_name, active_branch() AS branch, dolt_hashof('HEAD') AS revision";
const DOLT_MUTATION_REVISION_QUERY = "SELECT database() AS database_name, active_branch() AS branch, dolt_hashof('HEAD') AS revision, (SELECT COUNT(*) FROM dolt_status) AS status_count";

function beadsWorkspaceResponses(root, { operatorManaged = false, bdVersion = "1.1.2", doltVersion = "2.2.3" } = {}) {
  const storeDir = join(root, ".beads");
  return {
    ...BEADS_OK,
    ...BD_NO_DB_FALSE,
    ["bd\0--version"]: { stdout: `bd version ${bdVersion} (Homebrew) \n`, stderr: "", status: 0 },
    ["bd\0context\0--json"]: { stdout: JSON.stringify({
      schema_version: 1,
      backend: "dolt",
      bd_version: bdVersion,
      beads_dir: storeDir,
      cwd_repo_root: root,
      repo_root: root,
      database: "fixture_db",
      dolt_mode: "server",
      is_redirected: false,
      is_worktree: false,
    }) + "\n", stderr: "", status: 0 },
    ["bd\0config\0get\0dolt.auto-start\0--json"]: {
      stdout: JSON.stringify({
        schema_version: 1, key: "dolt.auto-start", location: "config.yaml", value: operatorManaged ? "false" : "",
      }) + "\n",
      stderr: "", status: 0,
    },
    ["bd\0dolt\0show\0--json"]: { stdout: JSON.stringify({
      schema_version: 1,
      backend: "dolt",
      connection_ok: true,
      database: "fixture_db",
      embedded: false,
      host: "127.0.0.1",
      port: 3307,
      shared_server: false,
      user: "root",
    }) + "\n", stderr: "", status: 0 },
    ["bd\0dolt\0status\0--json"]: { stdout: JSON.stringify(operatorManaged ? {
      schema_version: 1,
      mode: "external",
      running: true,
      host: "127.0.0.1",
      port: 3307,
      database: "fixture_db",
      user: "root",
      tls: false,
    } : {
      schema_version: 1,
      running: true,
      pid: 4242,
      port: 3307,
      data_dir: join(storeDir, "dolt"),
    }) + "\n", stderr: "", status: 0 },
    ["dolt\0version"]: { stdout: `dolt version ${doltVersion}\n`, stderr: "", status: 0 },
    [["bd", "--readonly", "sql", "--json", DOLT_IDENTITY_QUERY].join("\0")]: { stdout: JSON.stringify([{
      database_name: "fixture_db", branch: "main", revision: DOLT_REVISION, dolt_version: doltVersion,
    }]) + "\n", stderr: "", status: 0 },
    [["bd", "--readonly", "sql", "--json", DOLT_DIRTY_QUERY].join("\0")]: { stdout: "[]\n", stderr: "", status: 0 },
    ["bd\0config\0get\0sync.remote\0--json"]: { stdout: JSON.stringify({
      schema_version: 1, key: "sync.remote", location: "config.yaml", value: DOLT_REMOTE_URL,
    }) + "\n", stderr: "", status: 0 },
    ["bd\0dolt\0remote\0list\0--json"]: { stdout: JSON.stringify([
      { name: "origin", url: DOLT_REMOTE_URL, sql_url: DOLT_REMOTE_URL, status: "ok" },
    ]) + "\n", stderr: "", status: 0 },
    ["git\0remote\0get-url\0--all\0origin"]: { stdout: "https://example.invalid/org/repo.git\n", stderr: "", status: 0 },
    [`git\0ls-remote\0--exit-code\0--refs\0origin\0${BEADS_DOLT_DATA_REF}`]: {
      stdout: `${DOLT_DATA_HEAD}\t${BEADS_DOLT_DATA_REF}\n`, stderr: "", status: 0,
    },
  };
}

function beadsTransportRunner(extra = {}, { publishedRevision = DOLT_REVISION } = {}) {
  const delegate = detectionRunner(extra);
  return {
    run(command, args, options = {}) {
      if (command === "dolt" && args[0] === "clone") {
        return { stdout: "cloned\n", stderr: "", status: 0 };
      }
      if (command === "dolt" && args[0] === "sql" && args.at(-1) === DOLT_REMOTE_IDENTITY_QUERY) {
        return { stdout: JSON.stringify({ rows: [{
          database_name: "fixture_db", branch: "main", revision: publishedRevision,
        }] }) + "\n", stderr: "", status: 0 };
      }
      return delegate.run(command, args, options);
    },
  };
}

function recordedDetectionRunner(extra = {}, options = {}) {
  const delegate = beadsTransportRunner(extra, options);
  const calls = [];
  return {
    calls,
    run(command, args, commandOptions = {}) {
      calls.push([command, ...args]);
      return delegate.run(command, args, commandOptions);
    },
  };
}

test("legacy transition target proves paired published Beads revision and complete raw native evidence", () => {
  const { primary, linked } = linkedWorktreeFixture();
  mkdirSync(join(primary, ".beads", "dolt"), { recursive: true });
  mkdirSync(join(linked, ".beads", "dolt"), { recursive: true });
  const taskId = "TST-BRIDGE";
  const sourceReference = `legacy-episode-source=.ralph/plans/future/bridge; superseded-by=${taskId}`;
  const nativeView = {
    id: taskId,
    title: "Bridge retained authority",
    status: "in_progress",
    description: "Reviewed retained specification content",
    design: "Reviewed provider-native living plan",
    notes: `Reviewed provenance\n${sourceReference}`,
    comments: [{ id: "comment-1", body: "reviewed before cutover" }],
    provider_native_tail: { opaque: [1, { two: 2 }] },
  };
  const real = new ProcessCommandRunner();
  const calls = [];
  const runner = {
    run(command, args, options = {}) {
      calls.push({ command, args: [...args], cwd: options.cwd });
      const cwd = options.cwd === linked ? linked : primary;
      if (command === "bd" && args[0] === "context" && options.cwd === linked) {
        return {
          stdout: `${JSON.stringify(linkedBeadsContext(primary, linked, { bd_version: "1.1.2" }))}\n`,
          stderr: "", status: 0,
        };
      }
      if (command === "bd" && args[0] === "show") {
        return { stdout: `${JSON.stringify([nativeView])}\n`, stderr: "", status: 0 };
      }
      if (command === "dolt" && args[0] === "clone") return { stdout: "cloned\n", stderr: "", status: 0 };
      if (command === "dolt" && args[0] === "sql" && args.at(-1) === DOLT_REMOTE_IDENTITY_QUERY) {
        return { stdout: `${JSON.stringify({ rows: [{ database_name: "fixture_db", branch: "main", revision: DOLT_REVISION }] })}\n`, stderr: "", status: 0 };
      }
      const responses = beadsWorkspaceResponses(cwd);
      const key = [command, ...args].join("\0");
      if (key in responses) return responses[key];
      return real.run(command, args, options);
    },
  };

  const target = resolveLegacyTaskOwnershipTransitionTarget(primary, linked, taskId, runner);
  assert.equal(target.provider, "beads");
  assert.equal(target.providerRevision, DOLT_REVISION);
  assert.deepEqual(target.taskEvidence, nativeView);
  assert.deepEqual(target.task.nativeView, nativeView);
  assert.equal(target.task.status, "In Progress");
  assert.equal(target.task.projectRoot, primary);
  assert.equal(calls.filter((call) => call.command === "bd" && call.args[0] === "show").length, 2);
  assert.equal(calls.filter((call) => call.command === "git" && call.args[0] === "ls-remote").length, 4);
});

function beadsMutationRunner(root, scenario = {}) {
  const responses = beadsWorkspaceResponses(root);
  if (scenario.dirtyBeforeMutation) responses[["bd", "--readonly", "sql", "--json", DOLT_DIRTY_QUERY].join("\0")] = {
    stdout: JSON.stringify([{ table_name: "unrelated_table", staged: true, status: "modified" }]) + "\n", stderr: "", status: 0,
  };
  const delegate = beadsTransportRunner(responses);
  const calls = [];
  let revision = DOLT_REVISION;
  let head = DOLT_DATA_HEAD;
  let status = scenario.initialStatus ?? "in_design";
  let notes = "existing native notes";
  let mutationCompleted = false;
  let pushCompleted = false;
  return {
    calls,
    run(command, args, options = {}) {
      calls.push([command, ...args]);
      if (command === "bd" && args[0] === "show" && args.includes("--long")) {
        if (scenario.showFailure && mutationCompleted) return { stdout: "", stderr: "native read unavailable\n", status: 7 };
        const native = {
          id: scenario.foreignTask ? "TST-other" : "TST-1", title: "Native task", status,
          design: "preserve the owner-authored native design", notes,
          native_tail: { opaque: ["alpha", { omega: true }] }, comments: [],
          ...(scenario.nativeView ?? {}),
        };
        if (scenario.absentFields) for (const key of ["title", "status", "design", "notes", "comments"]) delete native[key];
        return { stdout: JSON.stringify([native]) + "\n", stderr: "", status: 0 };
      }
      if (command === "bd" && args[0] === "dolt" && args[1] === "pull") {
        if (scenario.pullFailure) return { stdout: "native partial pull\n", stderr: "pull conflict\n", status: 2 };
        if (scenario.concurrentPull) revision = "c".repeat(32);
        return { stdout: "pulled\n", stderr: "", status: 0 };
      }
      if (command === "bd" && args[0] === "--dolt-auto-commit=on") {
        if (scenario.mutationFailure || (args.includes("--if-status") && args[args.indexOf("--if-status") + 1] !== status)) {
          return { stdout: "native update result\n", stderr: "native conditional update rejected\n", status: 1 };
        }
        status = scenario.ignoreStatus ? status : args[args.indexOf("--status") + 1];
        const noteIndex = args.indexOf("--append-notes");
        if (noteIndex >= 0 && !scenario.ignoreNote) notes = `${notes}\n${args[noteIndex + 1]}`;
        mutationCompleted = true;
        if (!scenario.noNewRevision && !scenario.historyCommitFailure) revision = scenario.postUpdateDescendant ? "e".repeat(32) : "d".repeat(32);
        return { stdout: JSON.stringify([{ id: "TST-1", status }]) + "\n", stderr: scenario.historyCommitFailure ? "simulated trailing history commit failure\n" : "native update warning\n", status: 0 };
      }
      if (command === "bd" && args[0] === "dolt" && args[1] === "push") {
        if (scenario.pushFailure) return { stdout: "native push output\n", stderr: "non-fast-forward\n", status: 1 };
        head = "e".repeat(40);
        pushCompleted = true;
        if (scenario.postPushLocalAdvance) revision = "f".repeat(32);
        if (scenario.postPushStatus) status = scenario.postPushStatus;
        return { stdout: "pushed\n", stderr: "native push warning\n", status: 0 };
      }
      if (command === "bd" && args.at(-1) === DOLT_MUTATION_REVISION_QUERY) {
        return { stdout: JSON.stringify([{
          database_name: scenario.foreignDatabase && mutationCompleted ? "foreign_db" : "fixture_db",
          branch: "main", revision,
          ...(scenario.absentRevisionFields ? {} : { status_count: mutationCompleted && scenario.dirtyAfterMutation ? 1 : 0 }),
          native_extra: { retained: true },
        }]) + "\n", stderr: "", status: 0 };
      }
      if (command === "git" && args[0] === "ls-remote") {
        if (pushCompleted && scenario.refFailure) return { stdout: "", stderr: "remote read unavailable\n", status: 128 };
        return { stdout: `${head}\t${BEADS_DOLT_DATA_REF}\n`, stderr: "", status: 0 };
      }
      return delegate.run(command, args, options);
    },
  };
}

test("no live evidence returns none so initialization can default to .backlog", () => {
  const root = fixtureRoot();
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "none");
  assert.equal(detection.projectRoot, root);
});

test("a stray backlog directory without configuration is not live evidence", () => {
  const root = fixtureRoot();
  mkdirSync(join(root, "backlog"), { recursive: true });
  writeFileSync(join(root, "backlog", "README.md"), "export residue\n");
  assert.equal(detectTaskProvider(root).kind, "none");
});

test("folder backlog config selects backlog with exact evidence", () => {
  const root = fixtureRoot();
  const configPath = writeBacklogFolderConfig(root);
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "selected");
  assert.deepEqual(detection.evidence, {
    provider: "backlog",
    configPath,
    configSource: "folder",
    storeDir: join(root, "backlog"),
    layout: "backlog",
  });
});

test("hidden .backlog folder config selects backlog with the hidden layout", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root, ".backlog", "config.yaml");
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "selected");
  assert.equal(detection.evidence.layout, ".backlog");
  assert.equal(detection.evidence.configSource, "folder");
});

test("root backlog.config.yml takes precedence over folder configuration", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  writeBacklogFolderConfig(root, ".backlog");
  const configPath = writeRootConfig(root);
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "selected");
  assert.equal(detection.evidence.configSource, "root");
  assert.equal(detection.evidence.configPath, configPath);
  assert.equal(detection.evidence.layout, "backlog");
});

test("root config without backlog_directory prefers the configured built-in directory over a bare one", () => {
  const root = fixtureRoot();
  writeRootConfig(root);
  mkdirSync(join(root, "backlog"), { recursive: true });
  const hiddenConfig = writeBacklogFolderConfig(root, ".backlog");
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "selected");
  assert.equal(detection.evidence.configSource, "root");
  assert.equal(detection.evidence.storeDir, join(root, ".backlog"));
  assert.equal(detection.evidence.layout, ".backlog");
  assert.ok(hiddenConfig.startsWith(join(root, ".backlog")));
});

test("root config without backlog_directory falls back to a bare built-in directory", () => {
  const root = fixtureRoot();
  writeRootConfig(root);
  mkdirSync(join(root, ".backlog"), { recursive: true });
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "selected");
  assert.equal(detection.evidence.configSource, "root");
  assert.equal(detection.evidence.storeDir, join(root, ".backlog"));
  assert.equal(detection.evidence.layout, ".backlog");
});

test("export-only .beads residue alone is not live evidence", () => {
  const root = fixtureRoot();
  const dir = join(root, ".beads");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "issues.jsonl"), "{\"id\":\"tst-1\"}\n");
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "none");
});

test("valid backlog plus export-only .beads residue still selects backlog", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  const dir = join(root, ".beads");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "issues.jsonl"), "{\"id\":\"tst-1\"}\n");
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "selected");
  assert.equal(detection.evidence.provider, "backlog");
});

test("provider-absent registered linked worktree remains none without invoking native Beads context", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-linked-none-")));
  const primary = join(root, "primary");
  const linked = join(root, "linked");
  mkdirSync(primary);
  const real = new ProcessCommandRunner();
  const calls = [];
  const runner = {
    run(command, args, options = {}) {
      calls.push([command, ...args]);
      return real.run(command, args, options);
    },
  };
  try {
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: primary });
    execFileSync("git", ["config", "user.name", "Provider Fixture"], { cwd: primary });
    execFileSync("git", ["config", "user.email", "provider@example.invalid"], { cwd: primary });
    writeFileSync(join(primary, "README.md"), "provider absent\n");
    execFileSync("git", ["add", "README.md"], { cwd: primary });
    execFileSync("git", ["commit", "-q", "-m", "fixture"], { cwd: primary });
    execFileSync("git", ["worktree", "add", "-q", "-b", "episode", linked], { cwd: primary });
    const detection = detectTaskProvider(linked, runner);
    assert.deepEqual(detection, { kind: "none", projectRoot: realpathSync(linked) });
    assert.equal(calls.some(([command, subcommand]) => command === "bd" && subcommand === "context"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("registered linked worktree resolves the primary Beads authority and reads the exact task from linked cwd", () => {
  const fixture = linkedWorktreeFixture();
  try {
    const context = linkedBeadsContext(fixture.primary, fixture.linked);
    const runner = linkedBeadsRunner(
      { stdout: JSON.stringify(context) + "\n", stderr: "", status: 0 },
      {
        [["bd", "--version"].join("\0")]: { stdout: "bd version 1.3.1 (Homebrew)\n", stderr: "", status: 0 },
        [["bd", "show", "TST-1", "--json", "--long", "--include-comments"].join("\0")]: {
          stdout: JSON.stringify([{ id: "TST-1", title: "Linked native task", status: "in_planning", design: "exact" }]) + "\n",
          stderr: "", status: 0,
        },
      },
    );
    const detection = detectTaskProvider(fixture.linked, runner);
    assert.equal(detection.kind, "selected");
    assert.equal(detection.projectRoot, fixture.linked);
    assert.deepEqual(detection.evidence, {
      provider: "beads",
      storeDir: join(fixture.primary, ".beads"),
      metadataPath: join(fixture.primary, ".beads", "metadata.json"),
      configPath: join(fixture.primary, ".beads", "config.yaml"),
      doltMode: "server",
      doltDatabase: "fixture_db",
    });

    const resolved = resolveProviderTask(fixture.linked, "TST-1", runner);
    assert.equal(resolved.provider, "beads");
    assert.equal(resolved.taskId, "TST-1");
    assert.equal(resolved.status, "In Planning");
    assert.equal(resolved.projectRoot, fixture.linked);
    assert.equal(resolved.nativeView.design, "exact");
    for (const args of [["context", "--json"], ["show", "TST-1", "--json", "--long", "--include-comments"]]) {
      const call = runner.calls.find((item) => item.command === "bd" && JSON.stringify(item.args) === JSON.stringify(args));
      assert.ok(call, `missing native linked-worktree call: bd ${args.join(" ")}`);
      assert.equal(call.cwd, fixture.linked);
    }
    assert.equal(runner.calls.some((item) => item.command === "bd"
      && ["--version", "statuses"].includes(item.args[0])), false,
    "task resolution must not capability-check the linked Beads authority");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("canonical-primary Beads cutover ignores only stale linked Backlog snapshot evidence", () => {
  const fixture = linkedWorktreeFixture();
  try {
    writeBacklogFolderConfig(fixture.linked);
    writeBacklogFolderConfig(fixture.primary);
    const context = linkedBeadsContext(fixture.primary, fixture.linked);
    const runner = linkedBeadsRunner({ stdout: JSON.stringify(context) + "\n", stderr: "", status: 0 });
    const duringMaintenance = detectTaskProvider(fixture.linked, runner);
    assert.equal(duringMaintenance.kind, "blocked");
    assert.equal(duringMaintenance.code, "dual-providers");
    rmSync(join(fixture.primary, "backlog"), { recursive: true, force: true });
    const detection = detectTaskProvider(fixture.linked, runner);
    assert.equal(detection.kind, "selected");
    assert.equal(detection.evidence.provider, "beads");
    assert.equal(detection.evidence.storeDir, join(fixture.primary, ".beads"));
    assert.equal(existsSync(join(fixture.linked, "backlog", "config.yml")), true);
    assert.equal(existsSync(join(fixture.primary, "backlog", "config.yml")), false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("linked Beads Episode blocks ordinary mutation when only canonical primary has dual provider evidence", () => {
  const fixture = linkedWorktreeFixture();
  try {
    writeBacklogFolderConfig(fixture.primary);
    const context = linkedBeadsContext(fixture.primary, fixture.linked);
    const runner = linkedBeadsRunner({ stdout: JSON.stringify(context) + "\n", stderr: "", status: 0 });
    const detection = detectTaskProvider(fixture.linked, runner);
    assert.equal(detection.kind, "blocked");
    assert.equal(detection.code, "dual-providers");
    assert.equal(existsSync(join(fixture.linked, "backlog", "config.yml")), false);
    assert.throws(() => mutateProviderTaskStatus({ projectRoot: fixture.linked, taskId: "TST-1", status: "Blocked", runner }), /both Backlog.*Beads|canonical primary has both/);
    assert.equal(runner.calls.some((call) => call.command === "bd" && call.args[0] === "update"), false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("canonical-primary Backlog cutover ignores only stale linked Beads snapshot evidence", () => {
  const fixture = linkedWorktreeFixture();
  try {
    writeBacklogFolderConfig(fixture.primary);
    writeBacklogFolderConfig(fixture.linked);
    const context = linkedBeadsContext(fixture.primary, fixture.linked);
    const runner = linkedBeadsRunner({ stdout: JSON.stringify(context) + "\n", stderr: "", status: 0 });
    const duringMaintenance = detectTaskProvider(fixture.linked, runner);
    assert.equal(duringMaintenance.kind, "blocked");
    assert.equal(duringMaintenance.code, "dual-providers");
    rmSync(join(fixture.primary, ".beads"), { recursive: true, force: true });
    const detection = detectTaskProvider(fixture.linked, runner);
    assert.equal(detection.kind, "selected");
    assert.equal(detection.evidence.provider, "backlog");
    assert.equal(existsSync(join(fixture.linked, ".beads", "metadata.json")), true);
    assert.equal(existsSync(join(fixture.primary, ".beads")), false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("linked Beads discovery blocks missing, forged, and foreign native context before task reads", () => {
  const fixture = linkedWorktreeFixture();
  const scenarios = [
    {
      name: "missing",
      result: { stdout: "", stderr: "not initialized", status: 1 },
      pattern: /context is unavailable.*not initialized/,
    },
    {
      name: "forged",
      result: { stdout: JSON.stringify(linkedBeadsContext(fixture.primary, fixture.linked, { is_worktree: false, is_redirected: true })) + "\n", stderr: "", status: 0 },
      pattern: /does not exactly bind/,
    },
    {
      name: "foreign",
      result: { stdout: JSON.stringify(linkedBeadsContext(fixture.primary, fixture.linked, {
        repo_root: join(fixture.root, "foreign"), beads_dir: join(fixture.root, "foreign", ".beads"),
      })) + "\n", stderr: "", status: 0 },
      pattern: /does not exactly bind/,
    },
  ];
  try {
    for (const scenario of scenarios) {
      const runner = linkedBeadsRunner(scenario.result);
      const detection = detectTaskProvider(fixture.linked, runner);
      assert.equal(detection.kind, "blocked", scenario.name);
      assert.equal(detection.code, "malformed-evidence", scenario.name);
      assert.match(detection.detail, scenario.pattern, scenario.name);
      assert.match(detection.remediation, /repair|Run `bd context/i, scenario.name);
      assert.equal(runner.calls.some((item) => item.command === "bd" && ["show", "statuses", "update"].includes(item.args[0])), false, scenario.name);
    }
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("real Beads 1.3.1 resolves one task and dispatches direct create with later native status facts", { timeout: 60_000 }, async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-real-linked-beads-")));
  const primary = join(root, "primary");
  const linked = join(root, "linked");
  mkdirSync(primary);
  const run = (command, args, cwd = primary) => execFileSync(command, args, { cwd, encoding: "utf8" });
  try {
    run("git", ["init", "-q", "-b", "main"]);
    run("git", ["config", "user.name", "Real Beads Fixture"]);
    run("git", ["config", "user.email", "real-beads@example.invalid"]);
    writeFileSync(join(primary, "README.md"), "real linked fixture\n");
    run("git", ["add", "README.md"]);
    run("git", ["commit", "-q", "-m", "baseline"]);
    assert.match(run("bd", ["--version"]), /\bbd version 1\.3\.1\b/);
    run("bd", ["init", "--server", "--skip-hooks", "--prefix", "RWT", "--quiet"]);
    run("bd", ["config", "set", "status.custom", "in_design:active,in_planning:active,ready_for_merge:wip,done:done"]);
    run("bd", ["dolt", "commit", "-m", "configure lifecycle"]);
    const created = JSON.parse(run("bd", ["create", "Linked worktree read", "--status", "in_planning", "--design", "Read without mutation", "--json"]));
    assert.equal(typeof created.id, "string");
    run("git", ["worktree", "add", "-q", "-b", "episode", linked]);

    const context = JSON.parse(run("bd", ["context", "--json"], linked));
    assert.equal(context.schema_version, 1);
    assert.equal(context.backend, "dolt");
    assert.equal(context.is_worktree, true);
    assert.equal(context.is_redirected, false);
    assert.equal(context.cwd_repo_root, realpathSync(linked));
    assert.equal(context.repo_root, realpathSync(primary));
    assert.equal(context.beads_dir, realpathSync(join(primary, ".beads")));

    const beforeView = JSON.parse(run("bd", ["show", created.id, "--json", "--long", "--include-comments"], linked));
    const beforeStatus = JSON.parse(run("bd", ["--readonly", "sql", "--json", "SELECT * FROM dolt_status"], linked));
    const detection = detectTaskProvider(linked);
    const resolved = resolveProviderTask(linked, created.id);
    const afterView = JSON.parse(run("bd", ["show", created.id, "--json", "--long", "--include-comments"], linked));
    const afterStatus = JSON.parse(run("bd", ["--readonly", "sql", "--json", "SELECT * FROM dolt_status"], linked));

    assert.equal(detection.kind, "selected");
    assert.equal(detection.projectRoot, realpathSync(linked));
    assert.equal(detection.evidence.provider, "beads");
    assert.equal(detection.evidence.storeDir, realpathSync(join(primary, ".beads")));
    assert.equal(resolved.provider, "beads");
    assert.equal(resolved.taskId, created.id);
    assert.equal(resolved.status, "In Planning");
    assert.equal(resolved.projectRoot, realpathSync(linked));
    assert.deepEqual(resolved.nativeView, beforeView[0]);
    assert.deepEqual(afterView, beforeView);
    assert.deepEqual(beforeStatus, []);
    assert.deepEqual(afterStatus, []);

    const workflows = join(primary, ".prime-claw", "workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(join(workflows, "implement-task-prep.md"), "---\nname: implement-task-prep\n---\nREAL BEADS PREP\n");
    writeFileSync(join(workflows, "implement-task.md"), "---\nname: implement-task\n---\nREAL BEADS IMPLEMENT\n");
    const guideRoot = join(root, "guide");
    mkdirSync(join(guideRoot, "skills", "prime-claw-oversee-episode"), { recursive: true });
    writeFileSync(join(guideRoot, "skills", "prime-claw-oversee-episode", "SKILL.md"), "FULL OVERSIGHT GUIDE\n");
    const commands = new Map(), tools = new Map(), events = new Map();
    const sent = [], creates = [], placements = [];
    const pi = {
      registerCommand(name, value) { commands.set(name, value); },
      registerTool(tool) { tools.set(tool.name, tool); },
      on(name, handler) { events.set(name, handler); },
      sendUserMessage(message, options) { sent.push({ message, options }); },
      async sendMessage() {},
    };
    const ctx = {
      cwd: primary,
      hasUI: false,
      ui: { notify(message, level) { sent.push({ notify: message, level }); } },
      sessionManager: {
        getSessionId: () => "real-beads-owner",
        getSessionFile: () => join(root, "owner.jsonl"),
        getHeader: () => ({ rlmDepth: 0 }),
      },
    };
    createReviewedPlanExtension({
      guideRoot,
      async placementResolver(projectRoot, host) {
        placements.push({ projectRoot, host });
        return { engine: "local" };
      },
      taskActions: {
        async create(taskId, toolCallId, _ctx, _deps, placement) {
          creates.push({ taskId, toolCallId, placement });
          return { version: 2, provider: "beads", status: "active", taskId,
            providerRevision: "uat-revision", taskEvidence: resolved.nativeView,
            baseRef: run("git", ["rev-parse", "HEAD"]), ownerSessionId: "real-beads-owner",
            operationId: "uat-operation", engine: "local", createdAt: "x", updatedAt: "x",
            episodeId: "real-beads-episode", episodeActiveSessionId: "real-beads-route", reused: false };
        },
      },
    })(pi);

    // Final creation has no prior entry-tool or command-invocation requirement.
    const admitted = await tools.get("create_task_episode").execute(
      "real-beads-create", { taskId: created.id }, undefined, undefined, ctx,
    );
    assert.equal(admitted.isError, undefined);
    assert.equal(sent.length, 0);
    assert.match(admitted.content[0].text, /One fixed execute assignment/);
    assert.match(admitted.content[0].text, /Exact provider-native result/);
    assert.deepEqual(creates, [{ taskId: created.id, toolCallId: "real-beads-create", placement: { engine: "local" } }]);
    assert.deepEqual(JSON.parse(run("bd", ["show", created.id, "--json", "--long", "--include-comments"])), beforeView);

    // The agent-callable entry retains the same compact-first chain.
    assert.equal(commands.size, 0);
    const entry = await tools.get("implement_task").execute(
      "real-beads-entry", { taskId: created.id }, undefined, undefined, ctx,
    );
    assert.equal(entry.isError, undefined);
    assert.equal(sent.length, 2);
    assert.match(sent[0].message, /REAL BEADS PREP/);
    assert.deepEqual(sent[0].options, { deliverAs: "steer" });
    assert.match(sent[1].message, /REAL BEADS IMPLEMENT/);
    assert.deepEqual(sent[1].options, { deliverAs: "followUp" });
    assert.equal(creates.length, 1);
    assert.deepEqual(placements, [
      { projectRoot: realpathSync(primary), host: undefined },
      { projectRoot: realpathSync(primary), host: undefined },
    ]);

    // The creation action is mocked above. A real native status reread must
    // reach that action without a duplicate wrapper eligibility policy. The
    // deeper native creation primitive is not exercised or changed here.
    run("bd", ["update", created.id, "--status", "in_progress"]);
    const progressed = JSON.parse(run("bd", ["show", created.id, "--json", "--long", "--include-comments"]));
    assert.equal(progressed[0].status, "in_progress");
    assert.equal(progressed[0].id, created.id);
    assert.equal(progressed[0].design, beforeView[0].design);
    const replay = await tools.get("create_task_episode").execute(
      "real-beads-replay", { taskId: created.id }, undefined, undefined, ctx,
    );
    assert.equal(replay.isError, undefined);
    assert.deepEqual(creates[1], { taskId: created.id, toolCallId: "real-beads-replay", placement: { engine: "local" } });
    assert.equal(creates.length, 2);
    assert.equal(placements.length, 3);
    assert.equal(sent.length, 2);
    assert.deepEqual(JSON.parse(run("bd", ["show", created.id, "--json", "--long", "--include-comments"])), progressed);
  } finally {
    try { run("bd", ["dolt", "stop"]); } catch {}
    rmSync(root, { recursive: true, force: true });
  }
});


test("an empty .beads directory alone is not live evidence", () => {
  const root = fixtureRoot();
  mkdirSync(join(root, ".beads"), { recursive: true });
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "none");
});

test("root config without a materialized store directory is valid evidence with a null store", () => {
  const root = fixtureRoot();
  writeRootConfig(root);
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "selected");
  assert.equal(detection.evidence.configSource, "root");
  assert.equal(detection.evidence.storeDir, null);
  assert.equal(detection.evidence.layout, null);
});

test("malformed folder configuration blocks before native provider reads", () => {
  const root = fixtureRoot();
  mkdirSync(join(root, "backlog"), { recursive: true });
  writeFileSync(join(root, "backlog", "config.yml"), "garbage: [\n");
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "blocked");
  assert.equal(detection.code, "malformed-evidence");
  assert.match(detection.detail, /project_name is missing/);
  assert.match(detection.remediation, /pinned backlog CLI/);
});

test("root config may select an existing custom directory", () => {
  const root = fixtureRoot();
  mkdirSync(join(root, "planning", "tasks"), { recursive: true });
  writeRootConfig(root, "backlog_directory: planning\n");
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "selected");
  assert.equal(detection.evidence.layout, "custom");
  assert.equal(detection.evidence.storeDir, join(root, "planning"));
});

test("root config selecting a missing custom directory blocks as malformed", () => {
  const root = fixtureRoot();
  writeRootConfig(root, "backlog_directory: planning\n");
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "blocked");
  assert.equal(detection.code, "malformed-evidence");
  assert.match(detection.detail, /custom directory planning/);
  assert.match(detection.remediation, /backlog_directory/);
});

test("root config without project_name blocks as malformed", () => {
  const root = fixtureRoot();
  writeFileSync(join(root, "backlog.config.yml"), "backlog_directory: backlog\n");
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "blocked");
  assert.match(detection.detail, /project_name/);
});

test("root config with an escaping backlog_directory blocks as malformed", () => {
  const root = fixtureRoot();
  writeRootConfig(root, "backlog_directory: ../elsewhere\n");
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "blocked");
  assert.match(detection.detail, /relative path inside the repository/);
});

test("a valid beads store selects beads with exact dolt metadata", () => {
  const root = fixtureRoot();
  const storeDir = writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const detection = detectTaskProvider(root, detectionRunner());
  assert.equal(detection.kind, "selected");
  assert.deepEqual(detection.evidence, {
    provider: "beads",
    storeDir,
    metadataPath: join(storeDir, "metadata.json"),
    configPath: join(storeDir, "config.yaml"),
    doltMode: "server",
    doltDatabase: "fixture_db",
  });
});

test("an incomplete beads store blocks with exact remediation", () => {
  const root = fixtureRoot();
  const dir = join(root, ".beads");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "config.yaml"), "# partial\n");
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "blocked");
  assert.equal(detection.code, "malformed-evidence");
  assert.match(detection.detail, /metadata\.json/);
  assert.match(detection.remediation, /bd bootstrap/);
});

test("a beads store without a dolt backend blocks as malformed", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { backend: "sqlite" } });
  const detection = detectTaskProvider(root, detectionRunner());
  assert.equal(detection.kind, "blocked");
  assert.match(detection.detail, /Dolt backend/);
});

test("beads no-db JSONL-only mode is never live authority", () => {
  const root = fixtureRoot();
  writeBeadsStore(root);
  const detection = detectTaskProvider(root, detectionRunner({
    ["bd\0config\0get\0no-db"]: { stdout: "true\n", stderr: "", status: 0 },
  }));
  assert.equal(detection.kind, "blocked");
  assert.match(detection.detail, /no-db/);
  assert.match(detection.detail, /issues\.jsonl/);
});

test("a native quoted no-db true value blocks exactly like bd resolves it", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { configText: '# beads config\nno-db: "true"\n' });
  const detection = detectTaskProvider(root, detectionRunner({
    ["bd\0config\0get\0no-db"]: { stdout: "true\n", stderr: "", status: 0 },
  }));
  assert.equal(detection.kind, "blocked");
  assert.match(detection.detail, /no-db/);
});

test("an unreadable or uncertain effective no-db mode blocks", () => {
  const root = fixtureRoot();
  writeBeadsStore(root);
  for (const result of [
    { stdout: "", stderr: "bd: executable unavailable", status: 127 },
    { stdout: "no-db (not set)\n", stderr: "", status: 0 },
  ]) {
    const detection = detectTaskProvider(root, detectionRunner({
      ["bd\0config\0get\0no-db"]: result,
    }));
    assert.equal(detection.kind, "blocked");
    assert.match(detection.detail, /no-db mode is unreadable or uncertain/);
  }
});

test("simultaneous valid backlog and beads evidence blocks as an incomplete migration", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  writeBeadsStore(root);
  const detection = detectTaskProvider(root, detectionRunner());
  assert.equal(detection.kind, "blocked");
  assert.equal(detection.code, "dual-providers");
  assert.match(detection.detail, /incomplete migration/);
});

test("backlog capabilities prove the executable and exact ordered lifecycle statuses", () => {
  const root = fixtureRoot();
  const runner = fakeRunner({ ...BACKLOG_OK });
  const caps = checkBacklogCapabilities(root, runner);
  assert.equal(caps.provider, "backlog");
  assert.equal(caps.version, "1.53.0");
  assert.deepEqual(runner.calls, [["backlog", "--version"], ["backlog", "config", "get", "statuses"]]);
});

test("backlog capabilities reject a missing executable", () => {
  const root = fixtureRoot();
  const runner = fakeRunner({});
  assert.throws(() => checkBacklogCapabilities(root, runner), /executable is unavailable/);
});

test("backlog capabilities reject a non-canonical or reordered status set", () => {
  const root = fixtureRoot();
  const reordered = [...CANONICAL].reverse().join(", ") + "\n";
  const runner = fakeRunner({
    ["backlog\0--version"]: { stdout: "1.53.0\n", stderr: "", status: 0 },
    ["backlog\0config\0get\0statuses"]: { stdout: reordered, stderr: "", status: 0 },
  });
  assert.throws(() => checkBacklogCapabilities(root, runner), /do not match the exact ordered lifecycle/);
});

test("beads capabilities prove the executable and category-aware status mapping", () => {
  const root = fixtureRoot();
  const runner = fakeRunner({ ...BEADS_OK });
  const caps = checkBeadsCapabilities(root, runner);
  assert.equal(caps.provider, "beads");
  assert.equal(caps.version, "1.1.2");
  assert.deepEqual(runner.calls, [["bd", "--version"], ["bd", "statuses", "--json"]]);
});

test("beads capabilities reject a missing custom status with the exact fix", () => {
  const root = fixtureRoot();
  const broken = JSON.parse(BEADS_STATUSES_JSON);
  broken.custom_statuses = broken.custom_statuses.filter((row) => row.name !== "ready_for_merge");
  const runner = fakeRunner({
    ["bd\0--version"]: { stdout: "bd version 1.1.2 (Homebrew) \n", stderr: "", status: 0 },
    ["bd\0statuses\0--json"]: { stdout: JSON.stringify(broken), stderr: "", status: 0 },
  });
  assert.throws(
    () => checkBeadsCapabilities(root, runner),
    /ready_for_merge:wip[\s\S]*bd config set status\.custom/,
  );
});

test("beads capabilities reject a wrong readiness category", () => {
  const root = fixtureRoot();
  const broken = JSON.parse(BEADS_STATUSES_JSON);
  broken.custom_statuses.find((row) => row.name === "in_design").category = "wip";
  const runner = fakeRunner({
    ["bd\0--version"]: { stdout: "bd version 1.1.2\n", stderr: "", status: 0 },
    ["bd\0statuses\0--json"]: { stdout: JSON.stringify(broken), stderr: "", status: 0 },
  });
  assert.throws(() => checkBeadsCapabilities(root, runner), /category wip, expected active/);
});

test("beads capabilities reject an unsupported statuses schema", () => {
  const root = fixtureRoot();
  const runner = fakeRunner({
    ["bd\0--version"]: { stdout: "bd version 1.1.2\n", stderr: "", status: 0 },
    ["bd\0statuses\0--json"]: { stdout: JSON.stringify({ schema_version: 2 }), stderr: "", status: 0 },
  });
  assert.throws(() => checkBeadsCapabilities(root, runner), /unsupported `bd statuses --json` schema/);
});

test("the dispatcher capability-checks the selected provider", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  const detection = detectTaskProvider(root);
  assert.equal(detection.kind, "selected");
  const caps = checkSelectedProviderCapabilities(detection, fakeRunner({ ...BACKLOG_OK }));
  assert.equal(caps.provider, "backlog");
});

test("Beads workspace transport rejects symlinked store authority before native proof without exposing external content", () => {
  for (const kind of ["store", "metadata", "config"]) {
    const root = fixtureRoot();
    const localStore = writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
    const externalRoot = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-external-beads-")));
    const metadataSentinel = `EXTERNAL_METADATA_SENTINEL_${kind}`;
    const configSentinel = `EXTERNAL_CONFIG_SENTINEL_${kind}`;
    const externalStore = writeBeadsStore(externalRoot, {
      metadataOverrides: { dolt_mode: "server", sentinel: metadataSentinel },
      configText: `# ${configSentinel}\n`,
    });
    const externalSentinelPath = join(externalRoot, `external-${kind}.sentinel`);
    writeFileSync(externalSentinelPath, `EXTERNAL_FILE_SENTINEL_${kind}\n`);
    const watchedExternalPaths = [
      join(externalStore, "metadata.json"),
      join(externalStore, "config.yaml"),
      externalSentinelPath,
    ];
    const before = watchedExternalPaths.map((path) => readFileSync(path));

    if (kind === "store") {
      rmSync(localStore, { recursive: true, force: true });
      symlinkSync(externalStore, localStore, "dir");
    } else if (kind === "metadata") {
      rmSync(join(localStore, "metadata.json"), { force: true });
      symlinkSync(join(externalStore, "metadata.json"), join(localStore, "metadata.json"), "file");
    } else {
      rmSync(join(localStore, "config.yaml"), { force: true });
      symlinkSync(join(externalStore, "config.yaml"), join(localStore, "config.yaml"), "file");
    }

    const runner = recordedDetectionRunner(beadsWorkspaceResponses(root));
    const result = prepareBeadsWorkspaceTransport(root, runner);
    assert.equal(result.status, "blocked", kind);
    assert.equal(result.code, "provider-authority", kind);
    assert.match(result.detail, /real.*non-symlink/, kind);
    assert.match(result.remediation, /real|non-symlink/, kind);
    assert.deepEqual(
      runner.calls.filter(([command]) => command === "bd" || command === "dolt"),
      [],
      `${kind}: unsafe authority must block before any native Beads or Dolt call`,
    );
    assert.equal(
      runner.calls.some(([command, subcommand]) => command === "git" && subcommand === "ls-remote"),
      false,
      `${kind}: unsafe authority must block before remote publication proof`,
    );
    watchedExternalPaths.forEach((path, index) => assert.deepEqual(readFileSync(path), before[index], `${kind}: ${path} changed`));
    const exposed = JSON.stringify(result);
    assert.equal(exposed.includes(externalRoot), false, `${kind}: external path leaked`);
    assert.equal(exposed.includes(metadataSentinel), false, `${kind}: external metadata leaked`);
    assert.equal(exposed.includes(configSentinel), false, `${kind}: external config leaked`);
  }
});

test("Beads workspace transport exposes one set of native observations without publication approval", () => {
  const root = fixtureRoot();
  const storeDir = writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const responses = beadsWorkspaceResponses(root);
  const runner = recordedDetectionRunner(responses);
  const result = prepareBeadsWorkspaceTransport(root, runner);
  assert.equal(result.status, "ready");
  const facts = result.evidence;
  assert.equal(facts.projectRoot, root);
  assert.equal(facts.storeDir, storeDir);
  assert.equal(facts.database, "fixture_db");
  assert.equal(facts.branch, "main");
  assert.equal(facts.revision, DOLT_REVISION);
  assert.equal(facts.remoteName, "origin");
  assert.equal(facts.remoteUrl, DOLT_REMOTE_URL);
  assert.equal(facts.publicationHead, DOLT_DATA_HEAD);
  assert.equal("publishedRevision" in facts, false, "local HEAD is not a remote Dolt observation");
  assert.deepEqual(facts.context, JSON.parse(responses["bd\0context\0--json"].stdout));
  assert.deepEqual(facts.workingSet, []);
  assert.equal(facts.commands.every((command) => typeof command.stdout === "string" && typeof command.stderr === "string"), true);
  assert.equal(runner.calls.filter((call) => call.at(-1) === DOLT_IDENTITY_QUERY).length, 1);
  assert.equal(runner.calls.filter((call) => call.at(-1) === DOLT_DIRTY_QUERY).length, 1);
  assert.equal(runner.calls.filter(([command, subcommand]) => command === "git" && subcommand === "ls-remote").length, 1);
  assert.deepEqual(runner.calls.filter(([command]) => command === "dolt"), []);
  assert.equal(runner.calls.some((call) => call.includes("statuses")), false);
});

test("Beads native transport needs no direct Dolt executable or separate version capability gate", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const responses = beadsWorkspaceResponses(root);
  responses["bd\0--version"] = { stdout: "unusual native build", stderr: "", status: 0 };
  responses["dolt\0version"] = { stdout: "", stderr: "dolt executable not found", status: 127 };
  const context = JSON.parse(responses["bd\0context\0--json"].stdout);
  context.bd_version = "native-development-build";
  responses["bd\0context\0--json"].stdout = JSON.stringify(context);
  const runner = recordedDetectionRunner(responses);
  const result = prepareBeadsWorkspaceTransport(root, runner);
  assert.equal(result.status, "ready");
  assert.equal(result.evidence.bdVersion, "native-development-build");
  assert.equal(result.evidence.doltVersion, "2.2.3", "the native server reports its own version");
  assert.equal(runner.calls.some((call) => call[0] === "dolt" || call.includes("--version")), false);

  delete context.bd_version;
  responses["bd\0context\0--json"].stdout = JSON.stringify(context);
  responses[["bd", "--readonly", "sql", "--json", DOLT_IDENTITY_QUERY].join("\0")].stdout = JSON.stringify([{
    database_name: "fixture_db", branch: "main", revision: DOLT_REVISION,
  }]);
  const absent = prepareBeadsWorkspaceTransport(root, recordedDetectionRunner(responses));
  assert.equal(absent.status, "ready");
  assert.equal(absent.evidence.bdVersion, undefined);
  assert.equal(absent.evidence.doltVersion, undefined);
});

test("explicit retained-folder and migration transport keeps its separate pre-existing remote proof", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = recordedDetectionRunner(beadsWorkspaceResponses(root));
  const result = prepareExplicitBeadsWorkspaceTransport(root, runner);
  assert.equal(result.status, "ready");
  assert.equal(result.evidence.publishedRevision, DOLT_REVISION);
  assert.equal(result.evidence.publicationHead, DOLT_DATA_HEAD);
  assert.equal(runner.calls.filter(([command, subcommand]) => command === "dolt" && subcommand === "clone").length, 1);
  assert.equal(runner.calls.filter((call) => call.at(-1) === DOLT_IDENTITY_QUERY).length, 2);
  assert.equal(runner.calls.filter(([command, subcommand]) => command === "git" && subcommand === "ls-remote").length, 2);
  const unpublished = prepareExplicitBeadsWorkspaceTransport(root, recordedDetectionRunner(beadsWorkspaceResponses(root), { publishedRevision: "c".repeat(32) }));
  assert.equal(unpublished.status, "blocked", "the separate retained proof was not silently weakened");
});

test("Beads transport preserves dirty working sets, native version differences, and unrelated Git bytes/index/history", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  writeFileSync(join(root, "unrelated.txt"), "staged bytes\n");
  execFileSync("git", ["add", "unrelated.txt"], { cwd: root });
  writeFileSync(join(root, "unrelated.txt"), "unstaged bytes\n");
  writeFileSync(join(root, "untracked.txt"), "untracked bytes\n");
  const before = [readFileSync(join(root, "unrelated.txt")), readFileSync(join(root, "untracked.txt")), execFileSync("git", ["diff", "--cached", "--binary"], { cwd: root })];
  const responses = beadsWorkspaceResponses(root);
  const context = JSON.parse(responses["bd\0context\0--json"].stdout);
  context.bd_version = "a newer native context version";
  responses["bd\0context\0--json"].stdout = JSON.stringify(context);
  const dirty = [{ table_name: "other_ticket", staged: true, status: "modified", native_extra: true }];
  responses[["bd", "--readonly", "sql", "--json", DOLT_DIRTY_QUERY].join("\0")].stdout = JSON.stringify(dirty);
  responses[["bd", "--readonly", "sql", "--json", DOLT_IDENTITY_QUERY].join("\0")].stdout = JSON.stringify([{
    database_name: "fixture_db", branch: "main", revision: "c".repeat(32), dolt_version: "native-server-version",
  }]);
  const runner = recordedDetectionRunner(responses, { publishedRevision: "9".repeat(32) });
  const result = prepareBeadsWorkspaceTransport(root, runner);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.evidence.workingSet, dirty);
  assert.equal(result.evidence.revision, "c".repeat(32));
  assert.equal(result.evidence.identity.dolt_version, "native-server-version");
  assert.deepEqual([readFileSync(join(root, "unrelated.txt")), readFileSync(join(root, "untracked.txt")), execFileSync("git", ["diff", "--cached", "--binary"], { cwd: root })], before);
  assert.equal(runner.calls.some((call) => ["commit", "stash", "reset", "clone", "push", "pull"].some((operation) => call.includes(operation))), false);
});

test("Beads transport retains absent fields and unavailable publication evidence without inventing them", () => {
  const root = fixtureRoot();
  writeBeadsStore(root);
  const responses = beadsWorkspaceResponses(root, { operatorManaged: true });
  responses["bd\0dolt\0show\0--json"].stdout = JSON.stringify({ database: "fixture_db", embedded: true, native_extra: null });
  responses["bd\0dolt\0status\0--json"].stdout = JSON.stringify({ mode: "native-other-mode", running: false });
  responses["bd\0config\0get\0dolt.auto-start\0--json"].stdout = JSON.stringify({ key: "dolt.auto-start" });
  responses[`git\0ls-remote\0--exit-code\0--refs\0origin\0${BEADS_DOLT_DATA_REF}`] = { stdout: "", stderr: "no remote ref\n", status: 2 };
  const result = prepareBeadsWorkspaceTransport(root, recordedDetectionRunner(responses));
  assert.equal(result.status, "ready");
  assert.equal(result.evidence.serverAuthority, undefined);
  assert.equal(result.evidence.serverHost, undefined);
  assert.equal(result.evidence.serverPort, undefined);
  assert.equal(result.evidence.publicationHead, undefined);
  assert.equal(result.evidence.submittedRevision, undefined);
  assert.deepEqual(result.evidence.server, { database: "fixture_db", embedded: true, native_extra: null });
  assert.equal(result.evidence.publication.command.status, 2);
  assert.equal(result.evidence.publication.command.stderr, "no remote ref\n");
});

test("Beads transport normalizes equivalent native and repository remote forms without cloning", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const cases = [
    ["https://example.invalid/org/repo.git", "git+https://example.invalid/org/repo.git", "https://example.invalid/org/repo.git"],
    ["git+ssh://git@example.invalid/org/repo.git", "ssh://git@example.invalid/org/repo.git", "git@example.invalid:org/repo.git"],
    [join(root, "published.git"), `git+file://${root}/published.git`, `file://${root}/published.git`],
  ];
  for (const [configured, native, repository] of cases) {
    const responses = beadsWorkspaceResponses(root, { bdVersion: "1.3.1", doltVersion: "2.5.0" });
    responses["bd\0config\0get\0sync.remote\0--json"].stdout = JSON.stringify({ value: configured });
    responses["bd\0dolt\0remote\0list\0--json"].stdout = JSON.stringify([{ name: "origin", url: native, sql_url: native, status: "native-status" }]);
    responses["git\0remote\0get-url\0--all\0origin"].stdout = repository + "\n";
    const runner = recordedDetectionRunner(responses);
    const result = prepareBeadsWorkspaceTransport(root, runner);
    assert.equal(result.status, "ready");
    assert.equal(result.evidence.remoteName, "origin");
    assert.equal(result.evidence.remoteUrl.startsWith("git+"), true);
    assert.equal(runner.calls.some((call) => call.includes("clone")), false);
  }
});

test("Beads transport refuses wrong or ambiguous operation targets with raw native observations", () => {
  const cases = [
    ["provider-authority", (responses) => { const view = JSON.parse(responses["bd\0context\0--json"].stdout); view.database = "foreign"; responses["bd\0context\0--json"].stdout = JSON.stringify(view); }],
    ["provider-authority", (responses) => { const view = JSON.parse(responses["bd\0dolt\0show\0--json"].stdout); view.database = "foreign"; responses["bd\0dolt\0show\0--json"].stdout = JSON.stringify(view); }],
    ["remote-transport", (responses) => { const rows = JSON.parse(responses["bd\0dolt\0remote\0list\0--json"].stdout); rows.push({ ...rows[0], name: "mirror" }); responses["bd\0dolt\0remote\0list\0--json"].stdout = JSON.stringify(rows); }],
    ["publication-authority", (responses) => { responses["git\0remote\0get-url\0--all\0origin"].stdout = "https://example.invalid/foreign.git\n"; }],
  ];
  for (const [code, change] of cases) {
    const root = fixtureRoot();
    writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
    const responses = beadsWorkspaceResponses(root);
    change(responses);
    const runner = recordedDetectionRunner(responses);
    const result = prepareBeadsWorkspaceTransport(root, runner);
    assert.equal(result.status, "blocked");
    assert.equal(result.code, code);
    assert.ok(result.commands.length > 0);
    assert.equal(runner.calls.some((call) => ["update", "push", "pull", "clone", "start"].some((operation) => call.includes(operation))), false);
  }
});

test("Beads transport reports a native failure without repair or retry", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const responses = beadsWorkspaceResponses(root);
  responses["bd\0dolt\0show\0--json"] = { stdout: "partial native evidence\n", stderr: "connection failed\n", status: 3 };
  const runner = recordedDetectionRunner(responses);
  const result = prepareBeadsWorkspaceTransport(root, runner);
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "server-unavailable");
  assert.match(result.detail, /connection failed/);
  assert.deepEqual(result.commands.at(-1), { command: "bd", args: ["dolt", "show", "--json"], stdout: "partial native evidence\n", stderr: "connection failed\n", status: 3 });
  assert.equal(runner.calls.filter((call) => call[0] === "bd" && call[1] === "dolt" && call[2] === "show").length, 1);
  assert.equal(runner.calls.some((call) => call.includes("start")), false);
});

test("the beads status map covers every canonical lifecycle state exactly once", () => {
  assert.deepEqual(Object.keys(BEADS_STATUS_MAP), CANONICAL);
  for (const status of CANONICAL) {
    const mapping = BEADS_STATUS_MAP[status];
    assert.ok(mapping.name && mapping.category);
  }
});

function writeBacklogTaskFile(root, relative) {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "---\nid: TST-1\nstatus: In Planning\n---\nfixture task\n");
  return path;
}

function backlogTaskView(id = "TST-1", status = "In Planning", path = "backlog/tasks/tst-1.md") {
  return JSON.stringify({
    schemaVersion: 1, kind: "task-view",
    task: { id, title: "Fixture task", status, implementationPlan: "One meaningful step", path },
  });
}

test("provider task resolution reads Backlog without capability probes or lifecycle configuration gates", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  writeBacklogTaskFile(root, "backlog/tasks/tst-1.md");
  const nativeView = JSON.parse(backlogTaskView());
  nativeView.provider_extension = { envelope: [1, { retained: true }] };
  nativeView.task.description = "Provider-authored description";
  nativeView.task.acceptanceCriteria = [{ index: 1, text: "Keep native evidence", checked: false }];
  nativeView.task.provider_extension = { task: [null, { retained: true }] };
  const runner = detectionRunner({
    ["backlog\0--version"]: { stdout: "", stderr: "version probe unavailable", status: 127 },
    ["backlog\0config\0get\0statuses"]: { stdout: "To Do, Review\n", stderr: "", status: 0 },
    ["backlog\0task\0view\0--json\0--\0TST-1"]: { stdout: JSON.stringify(nativeView) + "\n", stderr: "", status: 0 },
  });
  const selection = resolveProviderTask(root, "TST-1", runner);
  assert.equal(selection.provider, "backlog");
  assert.equal(selection.taskId, "TST-1");
  assert.equal(selection.status, "In Planning");
  assert.equal(selection.implementationPlan, "One meaningful step");
  assert.equal(selection.taskPathRelative, "backlog/tasks/tst-1.md");
  assert.equal(selection.taskPath, realpathSync(join(root, "backlog/tasks/tst-1.md")));
  assert.deepEqual(selection.nativeView, nativeView, "the complete native task-view envelope remains lossless");
  assert.deepEqual(runner.calls.filter(([command]) => command === "backlog"), [
    ["backlog", "task", "view", "--json", "--", "TST-1"],
  ], "task resolution must not run executable or lifecycle capability checks");
});

test("provider task resolution returns the exact long Beads native view with canonical status", () => {
  const root = fixtureRoot();
  writeBeadsStore(root);
  const nativeView = {
    id: "TST-1",
    title: "Fixture task",
    status: "in_design",
    description: "Provider-authored description",
    design: "Provider-authored design",
    acceptance_criteria: "Provider-authored acceptance",
    labels: ["provider-native"],
    dependencies: [{ id: "TST-0", type: "blocks" }],
    comments: [{ id: 7, text: "raw comment", author: "fixture" }],
    provider_extension: { nested: [1, { retained: true }] },
  };
  const runner = detectionRunner({
    ["bd\0--version"]: { stdout: "", stderr: "version probe unavailable", status: 127 },
    ["bd\0statuses\0--json"]: { stdout: "", stderr: "status catalog unavailable", status: 1 },
    ["bd\0show\0TST-1\0--json\0--long\0--include-comments"]: {
      stdout: JSON.stringify([nativeView]) + "\n", stderr: "", status: 0,
    },
  });
  const selection = resolveProviderTask(root, "TST-1", runner);
  assert.deepEqual(selection, {
    provider: "beads",
    taskId: "TST-1",
    title: "Fixture task",
    nativeStatus: "in_design",
    status: "In Design",
    projectRoot: root,
    nativeView,
  });
  assert.deepEqual(runner.calls.filter(([command]) => command === "bd"), [
    ["bd", "config", "get", "no-db"],
    ["bd", "show", "TST-1", "--json", "--long", "--include-comments"],
  ], "task resolution reads native provider identity and the task, not lifecycle capabilities");
  // No provider-neutral normalization: the raw view remains Beads-only.
  assert.equal("taskPath" in selection, false);
  assert.equal("taskPathRelative" in selection, false);
  assert.equal("implementationPlan" in selection, false);
  assert.equal("references" in selection, false);
});

test("raw Beads task read preserves built-in closed abandonment evidence without mapping it to Done", () => {
  const root = fixtureRoot();
  writeBeadsStore(root);
  const nativeView = {
    id: "TST-closed",
    title: "Abandoned fixture",
    status: "closed",
    design: "Keep the complete provider-native design.",
    closed_at: "2026-10-26T19:00:08Z",
    close_reason: "Prime Claw abandonment: task TST-closed; pushed Episode head "
      + `${"b".repeat(40)}; code was not merged.`,
    comments: [{ id: 7, text: "retained history", author: "fixture" }],
  };
  const runner = detectionRunner({
    ["bd\0show\0TST-closed\0--json\0--long\0--include-comments"]: {
      stdout: JSON.stringify([nativeView]) + "\n", stderr: "", status: 0,
    },
  });
  assert.deepEqual(readBeadsNativeTask(root, "TST-closed", runner), {
    provider: "beads",
    taskId: "TST-closed",
    title: "Abandoned fixture",
    nativeStatus: "closed",
    projectRoot: root,
    nativeView,
  });
  const selection = resolveProviderTask(root, "TST-closed", detectionRunner({
    ["bd\0show\0TST-closed\0--json\0--long\0--include-comments"]: {
      stdout: JSON.stringify([nativeView]) + "\n", stderr: "", status: 0,
    },
  }));
  assert.deepEqual(selection, {
    provider: "beads",
    taskId: "TST-closed",
    title: "Abandoned fixture",
    nativeStatus: "closed",
    status: "closed",
    projectRoot: root,
    nativeView,
  });
});

for (const nativeStatus of ["open", "closed", "custom_review"]) {
  test(`provider task resolution retains unmapped Beads status ${nativeStatus} and absent design`, () => {
    const root = fixtureRoot();
    writeBeadsStore(root);
    const nativeView = {
      id: "TST-1", title: "Fixture task", status: nativeStatus,
      provider_extension: { nested: [null, { retained: true }] },
    };
    const runner = detectionRunner({
      ["bd\0show\0TST-1\0--json\0--long\0--include-comments"]: {
        stdout: JSON.stringify([nativeView]) + "\n", stderr: "", status: 0,
      },
    });
    const selection = resolveProviderTask(root, "TST-1", runner);
    assert.deepEqual(selection, {
      provider: "beads",
      taskId: "TST-1",
      title: "Fixture task",
      nativeStatus,
      status: nativeStatus,
      projectRoot: root,
      nativeView,
    });
    assert.equal("design" in selection.nativeView, false, "an absent native field must not be fabricated");
    assert.equal(runner.calls.some(([command, subcommand]) => command === "bd"
      && ["--version", "statuses"].includes(subcommand)), false);
  });
}

test("provider task resolution fails closed when no live provider evidence exists", () => {
  const root = fixtureRoot();
  assert.throws(() => resolveProviderTask(root, "TST-1", detectionRunner()), /no live task provider evidence/);
});

test("provider task resolution fails closed on dual live evidence", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  writeBeadsStore(root);
  assert.throws(() => resolveProviderTask(root, "TST-1", detectionRunner()), /blocked \(dual-providers\)/);
});

test("provider task resolution fails closed on malformed evidence with remediation", () => {
  const root = fixtureRoot();
  const dir = join(root, ".beads");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "config.yaml"), "# partial\n");
  assert.throws(() => resolveProviderTask(root, "TST-1", detectionRunner()), /blocked \(malformed-evidence\)[\s\S]*bd bootstrap/);
});

test("provider task resolution reports the actual Backlog native read failure without capability probes", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  writeBacklogTaskFile(root, "backlog/tasks/tst-1.md");
  const runner = detectionRunner({
    ["backlog\0task\0view\0--json\0--\0TST-1"]: { stdout: "", stderr: "command not found", status: 127 },
  });
  assert.throws(() => resolveProviderTask(root, "TST-1", runner), /Backlog could not resolve TST-1: command not found/);
  assert.deepEqual(runner.calls.filter(([command]) => command === "backlog"), [
    ["backlog", "task", "view", "--json", "--", "TST-1"],
  ]);
});

test("provider task resolution reports the actual Beads show failure without capability probes", () => {
  const root = fixtureRoot();
  writeBeadsStore(root);
  const runner = detectionRunner({
    ["bd\0show\0TST-1\0--json\0--long\0--include-comments"]: {
      stdout: "", stderr: "native task store is unavailable", status: 1,
    },
  });
  assert.throws(() => resolveProviderTask(root, "TST-1", runner), /Beads could not resolve TST-1: native task store is unavailable/);
  assert.deepEqual(runner.calls.filter(([command]) => command === "bd"), [
    ["bd", "config", "get", "no-db"],
    ["bd", "show", "TST-1", "--json", "--long", "--include-comments"],
  ]);
});


test("Beads mutation performs one requested native update and one pull/push with raw evidence", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root);
  const result = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner });
  assert.equal(result.status, "pushed");
  assert.equal(result.evidence.preparedRevision, DOLT_REVISION);
  assert.equal(result.evidence.postMutationRevision, "d".repeat(32));
  assert.equal(result.evidence.submittedRevision, "d".repeat(32), "submitted HEAD is retained on native push success");
  assert.equal(result.evidence.publicationHead, "e".repeat(40));
  assert.equal(result.evidence.remotePublishedTask, undefined, "no remote task snapshot is fabricated");
  assert.equal(result.evidence.taskAfterPush.nativeStatus, "in_progress");
  assert.deepEqual(result.evidence.mutation.args, ["--dolt-auto-commit=on", "update", "TST-1", "--status", "in_progress", "--json"]);
  assert.equal(result.evidence.mutation.stderr, "native update warning\n");
  assert.equal(result.evidence.push.stderr, "native push warning\n");
  assert.equal(result.evidence.taskReads.length, 4);
  assert.deepEqual(JSON.parse(result.evidence.taskReads.at(-1).command.stdout)[0], result.evidence.taskAfterPush.nativeView);
  assert.equal(result.evidence.commands.includes(result.evidence.pull), true);
  assert.equal(result.evidence.commands.includes(result.evidence.mutation), true);
  assert.equal(result.evidence.commands.includes(result.evidence.push), true);
  assert.equal(runner.calls.filter((call) => call[0] === "bd" && call[1] === "dolt" && call[2] === "pull").length, 1);
  assert.equal(runner.calls.filter((call) => call[0] === "bd" && call[1] === "dolt" && call[2] === "push").length, 1);
  assert.equal(runner.calls.some((call) => call.includes("--if-status") || call.includes("--force") || call.includes("clone")), false);
});

// Adapter-only failure simulation, not a reproduction of native Dolt commits
// or proof of per-issue isolation. Beads may leave an update in its working set
// despite returning success; a push result must not label that task published.
test("Beads push success preserves a logged history-commit failure as unproved local task evidence", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root, { historyCommitFailure: true, dirtyAfterMutation: true });
  const result = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner });
  assert.equal(result.status, "pushed", "only the requested native push is reported successful");
  assert.equal(result.evidence.mutation.status, 0);
  assert.equal(result.evidence.mutation.stderr, "simulated trailing history commit failure\n");
  assert.equal(result.evidence.push.status, 0);
  assert.equal(result.evidence.submittedRevision, DOLT_REVISION, "HEAD did not advance with the working-set update");
  assert.equal(result.evidence.postMutationObservation.clean, false);
  assert.equal(result.evidence.postPushObservation.clean, false);
  assert.equal(result.evidence.taskAfterPush.nativeStatus, "in_progress", "this is a local working-set read only");
  for (const key of ["publishedRevision", "taskPublished", "postMutationProof", "localPublishedProof", "remotePublishedTask"]) {
    assert.equal(key in result.evidence, false, `${key} must not invent committed/published task proof`);
  }
  for (const operation of ["pull", "update", "push"]) {
    assert.equal(runner.calls.filter((call) => call.includes(operation)).length, 1);
  }
  assert.equal(runner.calls.some((call) => call.includes("clone") || call.includes("--force")), false);
});

test("Beads status and note requests are native operations, not transition eligibility rules", () => {
  const transitions = [
    ["in_design", "Done"], ["ready_for_merge", "Blocked"], ["blocked", "In Progress"],
    ["in_progress", "Ready for Merge"], ["closed", "In Planning"], ["custom_native_status", "In Progress"],
  ];
  for (const [from, to] of transitions) {
    const root = fixtureRoot();
    writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
    const runner = beadsMutationRunner(root, { initialStatus: from });
    const note = `Owner requested ${to}`;
    const result = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: to, note, runner });
    assert.equal(result.status, "pushed");
    assert.equal(result.evidence.taskBefore.nativeStatus, from);
    assert.equal(result.evidence.taskAfterPush.nativeStatus, BEADS_STATUS_MAP[to].name);
    assert.deepEqual(result.evidence.taskAfterPush.nativeView.native_tail, result.evidence.taskBefore.nativeView.native_tail);
    assert.deepEqual(result.evidence.mutation.args, ["--dolt-auto-commit=on", "update", "TST-1", "--status", BEADS_STATUS_MAP[to].name, "--append-notes", note, "--json"]);
    if (from === "custom_native_status" || from === "closed") assert.equal("canonicalStatus" in result.evidence.taskBefore, false);
  }
});

test("Beads forwards native --if-status only when explicitly requested and reports native rejection", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root, { initialStatus: "custom_native_status" });
  const accepted = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "Blocked", ifStatus: "custom_native_status", runner });
  assert.equal(accepted.status, "pushed");
  assert.deepEqual(accepted.evidence.mutation.args, ["--dolt-auto-commit=on", "update", "TST-1", "--status", "blocked", "--if-status", "custom_native_status", "--json"]);
  const rejectedRunner = beadsMutationRunner(root, { initialStatus: "ready_for_merge" });
  const rejected = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "Blocked", ifStatus: "in_progress", runner: rejectedRunner });
  assert.equal(rejected.status, "review-required");
  assert.equal(rejected.code, "mutation-failed");
  assert.equal(rejected.evidence.operation.status, 1);
  assert.equal(rejected.evidence.operation.stderr, "native conditional update rejected\n");
  assert.equal(rejectedRunner.calls.filter((call) => call.includes("update")).length, 1, "the LLM's native condition is not a local eligibility precheck");
  assert.equal(rejectedRunner.calls.some((call) => call.includes("push")), false);
});

test("Beads preserves missing native fields, unknown statuses, nulls, and raw provider data", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root, { absentFields: true, absentRevisionFields: true, nativeView: { provider_extra: { unknown: null } } });
  const result = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner });
  assert.equal(result.status, "pushed");
  for (const task of [result.evidence.taskBefore, result.evidence.taskAfterPush]) {
    for (const field of ["title", "nativeStatus", "canonicalStatus"]) assert.equal(field in task, false);
    for (const field of ["title", "status", "design", "notes", "comments"]) assert.equal(field in task.nativeView, false);
    assert.deepEqual(task.nativeView.provider_extra, { unknown: null });
  }
  assert.equal(result.evidence.postMutationObservation.clean, undefined);
  assert.equal(result.evidence.postMutationObservation.parentRevision, undefined);
  assert.deepEqual(result.evidence.postMutationObservation.nativeView.native_extra, { retained: true });
});

test("Beads does not approve per-field note/status content before native publication", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root, { initialStatus: "in_progress", ignoreStatus: true, ignoreNote: true });
  const result = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "Blocked", note: "requested note", runner });
  assert.equal(result.status, "pushed", "native successful operations are evidence, not code-level semantic acceptance");
  assert.equal(result.evidence.taskAfterPush.nativeStatus, "in_progress");
  assert.equal(result.evidence.taskAfterPush.nativeView.notes, "existing native notes");
  assert.ok(result.evidence.mutation.args.includes("requested note"));
  assert.equal(result.evidence.push.status, 0);
});

for (const [name, scenario] of [
  ["a dirty working set", { dirtyBeforeMutation: true, dirtyAfterMutation: true }],
  ["an unrelated pull advance", { concurrentPull: true }],
  ["a later descendant after update", { postUpdateDescendant: true }],
  ["an idempotent native update", { noNewRevision: true }],
]) {
  test(`Beads native publication is not suppressed by ${name}`, () => {
    const root = fixtureRoot();
    writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
    writeFileSync(join(root, "unrelated.txt"), "staged bytes\n");
    execFileSync("git", ["add", "unrelated.txt"], { cwd: root });
    writeFileSync(join(root, "unrelated.txt"), "unstaged bytes\n");
    const bytes = readFileSync(join(root, "unrelated.txt"));
    const index = execFileSync("git", ["diff", "--cached", "--binary"], { cwd: root });
    const runner = beadsMutationRunner(root, scenario);
    const result = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner });
    assert.equal(result.status, "pushed");
    assert.equal(runner.calls.filter((call) => call.includes("pull")).length, 1);
    assert.equal(runner.calls.filter((call) => call.includes("update")).length, 1);
    assert.equal(runner.calls.filter((call) => call.includes("push")).length, 1);
    assert.deepEqual(readFileSync(join(root, "unrelated.txt")), bytes);
    assert.deepEqual(execFileSync("git", ["diff", "--cached", "--binary"], { cwd: root }), index);
    if (scenario.concurrentPull) assert.equal(JSON.parse(result.evidence.commands.find((command) => command.args.at(-1) === DOLT_MUTATION_REVISION_QUERY).stdout)[0].revision, "c".repeat(32));
    if (scenario.dirtyAfterMutation) assert.equal(result.evidence.postMutationObservation.clean, false);
    if (scenario.noNewRevision) assert.equal(result.evidence.postMutationRevision, DOLT_REVISION);
  });
}

test("Beads post-push advances are separate native observations, not a frozen equality gate", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root, { postPushLocalAdvance: true, postPushStatus: "native_later_status", refFailure: true });
  const result = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner });
  assert.equal(result.status, "pushed");
  assert.equal(result.evidence.postMutationRevision, "d".repeat(32));
  assert.equal(result.evidence.submittedRevision, "d".repeat(32), "the post-push local HEAD is not mislabeled as pushed");
  assert.equal(result.evidence.postPushObservation.revision, "f".repeat(32));
  assert.equal(result.evidence.taskAfterPush.nativeStatus, "native_later_status");
  assert.equal("canonicalStatus" in result.evidence.taskAfterPush, false);
  assert.equal(result.evidence.publicationHead, undefined);
  assert.equal(result.evidence.publication.command.stderr, "remote read unavailable\n");
  assert.equal(result.evidence.remotePublishedTask, undefined);
});

for (const [name, scenario, code, failedOperation, stderr] of [
  ["pull", { pullFailure: true }, "synchronization-failed", "pull", "pull conflict\n"],
  ["update", { mutationFailure: true }, "mutation-failed", "update", "native conditional update rejected\n"],
  ["push", { pushFailure: true }, "push-rejected", "push", "non-fast-forward\n"],
]) {
  test(`Beads reports a truthful native ${name} failure without retry or repair`, () => {
    const root = fixtureRoot();
    writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
    const runner = beadsMutationRunner(root, scenario);
    const result = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner });
    assert.equal(result.status, "review-required");
    assert.equal(result.code, code);
    assert.equal(result.evidence.operation.stderr, stderr);
    assert.equal(result.evidence.operation.status === 0, false);
    assert.equal(result.evidence.commands.includes(result.evidence.operation), true);
    assert.equal(runner.calls.filter((call) => call.includes(failedOperation)).length, 1);
    assert.equal(runner.calls.filter((call) => call.includes("pull")).length, 1);
    assert.equal(runner.calls.filter((call) => call.includes("push")).length, name === "push" ? 1 : 0);
    assert.equal(runner.calls.some((call) => ["--force", "reset", "commit", "clone", "start"].some((operation) => call.includes(operation))), false);
  });
}

test("Beads refuses a different exact task or database target without substitution", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const wrongTask = beadsMutationRunner(root, { foreignTask: true });
  const taskResult = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner: wrongTask });
  assert.equal(taskResult.status, "blocked");
  assert.equal(taskResult.code, "task-identity");
  assert.equal(wrongTask.calls.some((call) => call.includes("pull") || call.includes("update") || call.includes("push")), false);
  const wrongDatabase = beadsMutationRunner(root, { foreignDatabase: true });
  const databaseResult = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner: wrongDatabase });
  assert.equal(databaseResult.status, "review-required");
  assert.equal(databaseResult.code, "mutation-failed");
  assert.match(databaseResult.evidence.revisionProof.error, /selected database/);
  assert.equal(wrongDatabase.calls.some((call) => call.includes("push")), false);
});

function conversationStatusGit(overrides = {}) {
  const calls = [];
  return {
    calls,
    head() { calls.push(["head"]); return "a".repeat(40); },
    commitOnlyPath(root, path, message) {
      calls.push(["commitOnlyPath", root, path, message]);
      return "c".repeat(40);
    },
    commitPaths(root, commit) {
      calls.push(["commitPaths", root, commit]);
      return ["backlog/tasks/tst-1.md"];
    },
    pathStatus(root, path) {
      calls.push(["pathStatus", root, path]);
      return "";
    },
    ...overrides,
  };
}

function failIfConversationFilePathIsUsed() {
  return new Proxy({}, {
    get(_target, property) {
      throw new Error(`Beads status publication must not use Conversation Git path operation ${String(property)}`);
    },
  });
}

test("conversation status publication preserves the ordinary Backlog mutation and Git commit result", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  const relative = "backlog/tasks/tst-1.md";
  const taskPath = writeBacklogTaskFile(root, relative);
  let status = "In Planning";
  const real = new ProcessCommandRunner();
  const calls = [];
  const runner = { run(command, args, options = {}) {
    const key = [command, ...args].join("\0");
    calls.push(key);
    const canned = {
      ...BACKLOG_OK,
      [`git\0ls-files\0--error-unmatch\0--\0${relative}`]: { stdout: `${relative}\n`, stderr: "", status: 0 },
      ["backlog\0task\0edit\0--status\0In Progress\0--append-notes\0admit\0--plain\0--\0TST-1"]: { stdout: "", stderr: "", status: 0 },
    }[key];
    if (canned) {
      if (key.startsWith("backlog\0task\0edit")) status = "In Progress";
      return canned;
    }
    if (key === "backlog\0task\0view\0--json\0--\0TST-1") {
      return { stdout: backlogTaskView("TST-1", status, relative) + "\n", stderr: "", status: 0 };
    }
    return real.run(command, args, options);
  } };
  const selection = () => ({
    taskId: "TST-1", title: "Fixture task", status, implementationPlan: "One meaningful step",
    projectRoot: root, taskPath, taskPathRelative: relative,
  });
  const git = conversationStatusGit();

  const result = commitConversationTaskStatus({
    taskId: "TST-1", projectRoot: root, taskPath: relative, status: "In Progress",
    message: "chore: admit TST-1 episode", note: "admit", runner, git, resolveTask: selection,
  });

  assert.deepEqual(result, { selection: selection(), commit: "c".repeat(40) });
  assert.deepEqual(calls.filter((call) => call.startsWith("backlog\0")), [
    "backlog\0--version",
    "backlog\0config\0get\0statuses",
    "backlog\0task\0view\0--json\0--\0TST-1",
    "backlog\0task\0edit\0--status\0In Progress\0--append-notes\0admit\0--plain\0--\0TST-1",
    "backlog\0task\0view\0--json\0--\0TST-1",
  ]);
  assert.equal(calls.some((call) => call.startsWith("bd\0")), false);
  assert.deepEqual(git.calls, [
    ["commitOnlyPath", root, relative, "chore: admit TST-1 episode"],
    ["commitPaths", root, "c".repeat(40)],
    ["pathStatus", root, relative],
  ]);
});

test("independent Backlog admission revalidates synchronized source status before mutation", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  mkdirSync(join(root, "backlog", ".git"), { recursive: true });
  const relative = "backlog/tasks/tst-1.md";
  const taskPath = writeBacklogTaskFile(root, relative);
  let status = "In Planning";
  let publications = 0;
  const real = new ProcessCommandRunner();
  const runner = { run(command, args, options = {}) {
    const key = [command, ...args].join("\0");
    if (key === "backlog\0--version") return { stdout: "Backlog.md 1.0.0\n", stderr: "", status: 0 };
    if (key === "backlog\0config\0get\0statuses") return BACKLOG_OK[key];
    return real.run(command, args, options);
  } };
  const selection = () => ({
    taskId: "TST-1", title: "Fixture task", status, implementationPlan: "One meaningful step",
    projectRoot: root, taskPath, taskPathRelative: relative,
  });
  assert.throws(() => commitConversationTaskStatus({
    taskId: "TST-1", projectRoot: root, taskPath: relative, status: "In Progress",
    expectedSourceStatus: "In Planning", requireSourcePlan: true,
    message: "chore: admit TST-1 episode", runner, git: conversationStatusGit({
      operationInProgress: () => false, trackedStatus: () => "", upstreamHead: () => "a".repeat(40),
    }), resolveTask: selection,
    prepareTaskHistory: () => {
      status = "Done";
      return { status: "prepared", storeDir: join(root, "backlog"), remote: "origin", remoteUrl: "unused", branch: "prime-claw/tasks", head: "a".repeat(40), created: false };
    },
    publishTaskHistory: () => { publications += 1; throw new Error("must not publish"); },
  }), /must still be In Planning.*found Done/);
  assert.equal(publications, 0);
  assert.equal(status, "Done");
});

test("conversation status publication returns the exact published Beads evidence without file mutation", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root);
  const result = commitConversationTaskStatus({
    taskId: "TST-1", projectRoot: root, taskPath: "backlog/tasks/unused.md", status: "In Progress",
    message: "unused for Beads", note: "native lifecycle evidence", runner, git: failIfConversationFilePathIsUsed(),
    resolveTask() { throw new Error("Beads publication must not resolve a Backlog task path"); },
  });

  assert.equal(result.status, "pushed");
  assert.equal(result.evidence.provider, "beads");
  assert.equal(result.evidence.preparedRevision, DOLT_REVISION);
  assert.equal(result.evidence.submittedRevision, "d".repeat(32));
  assert.equal(result.evidence.publicationHead, "e".repeat(40));
  assert.equal(runner.calls.some((call) => call[0] === "bd" && call[1] === "update"), false);
  assert.equal(runner.calls.filter((call) => call[0] === "bd" && call[1] === "--dolt-auto-commit=on").length, 1);
  assert.ok(runner.calls.some((call) => call.includes("--append-notes") && call.includes("native lifecycle evidence")));
  assert.match(result.evidence.taskAfterPush.nativeView.notes, /native lifecycle evidence/);
});

test("conversation status publication propagates raw Beads native failure without classification", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root, { pushFailure: true });
  const result = commitConversationTaskStatus({
    taskId: "TST-1", projectRoot: root, taskPath: "backlog/tasks/unused.md", status: "In Progress",
    message: "unused for Beads", runner, git: failIfConversationFilePathIsUsed(),
    resolveTask() { throw new Error("Beads raw failure must not resolve a Backlog task path"); },
  });
  assert.equal(result.status, "review-required");
  assert.equal(result.code, "push-rejected");
  assert.equal(result.phase, "push");
  assert.equal(result.evidence.preparedRevision, DOLT_REVISION);
  assert.equal(result.evidence.observedRevision, "d".repeat(32));
  assert.equal(result.evidence.operation.stderr, "non-fast-forward\n");
  assert.equal(runner.calls.filter((call) => call.includes("push")).length, 1);
  assert.equal(runner.calls.filter((call) => call.includes("pull")).length, 1);
});

test("provider status mutation edits the Backlog task natively and proves the new status", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  writeBacklogTaskFile(root, "backlog/tasks/tst-1.md");
  let status = "In Planning";
  const real = new ProcessCommandRunner();
  const calls = [];
  const runner = { run(command, args, options = {}) {
    const key = [command, ...args].join("\0");
    calls.push(key);
    const canned = {
      ...BACKLOG_OK,
      ["backlog\0task\0edit\0--status\0In Progress\0--append-notes\0admit\0--plain\0--\0TST-1"]: { stdout: "", stderr: "", status: 0 },
    }[key];
    if (canned) {
      if (key.startsWith("backlog\0task\0edit")) status = "In Progress";
      return canned;
    }
    if (key === "backlog\0task\0view\0--json\0--\0TST-1") {
      return { stdout: backlogTaskView("TST-1", status) + "\n", stderr: "", status: 0 };
    }
    return real.run(command, args, options);
  } };
  const resolved = mutateProviderTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", note: "admit", runner });
  assert.equal(resolved.provider, "backlog");
  assert.equal(resolved.status, "In Progress");
  assert.ok(calls.includes("backlog\0task\0edit\0--status\0In Progress\0--append-notes\0admit\0--plain\0--\0TST-1"));
});

test("provider status mutation updates the Beads store natively with the mapped status", () => {
  const root = fixtureRoot();
  writeBeadsStore(root);
  let status = "in_design";
  const real = new ProcessCommandRunner();
  const calls = [];
  const runner = { run(command, args, options = {}) {
    const key = [command, ...args].join("\0");
    calls.push(key);
    const canned = {
      ...BEADS_OK,
      ...BD_NO_DB_FALSE,
      ["bd\0update\0TST-1\0--status\0in_progress\0--json"]: { stdout: "", stderr: "", status: 0 },
    }[key];
    if (canned) {
      if (key.startsWith("bd\0update")) status = "in_progress";
      return canned;
    }
    if (key === "bd\0show\0TST-1\0--json\0--long\0--include-comments") {
      return {
        stdout: JSON.stringify([{
          id: "TST-1", title: "Fixture task", status,
          comments: [{ id: 11, text: "raw mutation view" }],
          provider_extension: { retained: true },
        }]) + "\n",
        stderr: "", status: 0,
      };
    }
    return real.run(command, args, options);
  } };
  const resolved = mutateProviderTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner });
  assert.equal(resolved.provider, "beads");
  assert.equal(resolved.nativeStatus, "in_progress");
  assert.equal(resolved.status, "In Progress");
  assert.deepEqual(resolved.nativeView.comments, [{ id: 11, text: "raw mutation view" }]);
  assert.deepEqual(resolved.nativeView.provider_extension, { retained: true });
  assert.ok(calls.includes("bd\0show\0TST-1\0--json\0--long\0--include-comments"));
  assert.ok(calls.includes("bd\0update\0TST-1\0--status\0in_progress\0--json"));
});

test("provider status mutation fails closed when the re-read task never reaches the status", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  writeBacklogTaskFile(root, "backlog/tasks/tst-1.md");
  const real = new ProcessCommandRunner();
  const runner = { run(command, args, options = {}) {
    const key = [command, ...args].join("\0");
    const canned = {
      ...BACKLOG_OK,
      ["backlog\0task\0edit\0--status\0Blocked\0--plain\0--\0TST-1"]: { stdout: "", stderr: "", status: 0 },
      ["backlog\0task\0view\0--json\0--\0TST-1"]: { stdout: backlogTaskView("TST-1", "In Planning") + "\n", stderr: "", status: 0 },
    }[key];
    if (canned) return canned;
    return real.run(command, args, options);
  } };
  assert.throws(
    () => mutateProviderTaskStatus({ projectRoot: root, taskId: "TST-1", status: "Blocked", runner }),
    /did not reach Blocked/,
  );
});

test("provider task resolution keeps the Backlog branch as the exact existing selection plus provider identity", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  writeBacklogTaskFile(root, "backlog/tasks/tst-1.md");
  const runner = detectionRunner({
    ...BACKLOG_OK,
    ["backlog\0task\0view\0--json\0--\0TST-1"]: { stdout: backlogTaskView() + "\n", stderr: "", status: 0 },
  });
  const selection = resolveProviderTask(root, "TST-1", runner);
  assert.deepEqual(selection, {
    provider: "backlog",
    taskId: "TST-1",
    title: "Fixture task",
    status: "In Planning",
    implementationPlan: "One meaningful step",
    projectRoot: root,
    taskPath: realpathSync(join(root, "backlog/tasks/tst-1.md")),
    taskPathRelative: "backlog/tasks/tst-1.md",
    nativeView: JSON.parse(backlogTaskView()),
  });
});

test("requireBacklogTaskSelection passes Backlog through and rejects the Beads branch at the boundary", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  writeBacklogTaskFile(root, "backlog/tasks/tst-1.md");
  const backlogRunner = detectionRunner({
    ...BACKLOG_OK,
    ["backlog\0task\0view\0--json\0--\0TST-1"]: { stdout: backlogTaskView() + "\n", stderr: "", status: 0 },
  });
  const backlogSelection = requireBacklogTaskSelection(resolveProviderTask(root, "TST-1", backlogRunner), "test path");
  assert.equal(backlogSelection.taskPathRelative, "backlog/tasks/tst-1.md");

  const beadsRoot = fixtureRoot();
  writeBeadsStore(beadsRoot);
  const beadsRunner = detectionRunner({
    ...BEADS_OK,
    ["bd\0show\0TST-1\0--json\0--long\0--include-comments"]: { stdout: JSON.stringify([{ id: "TST-1", title: "Fixture task", status: "in_design" }]) + "\n", stderr: "", status: 0 },
  });
  assert.throws(
    () => requireBacklogTaskSelection(resolveProviderTask(beadsRoot, "TST-1", beadsRunner), "test path"),
    /resolves through Beads; test path still requires the Backlog task-file contract/,
  );
  assert.equal(requireBacklogTaskSelection(null, "test path"), null);
});

test("provider status mutation rejects Beads shorthand with zero writes before any mutation", () => {
  const root = fixtureRoot();
  writeBeadsStore(root);
  const real = new ProcessCommandRunner();
  const calls = [];
  const runner = { run(command, args, options = {}) {
    const key = [command, ...args].join("\0");
    calls.push(key);
    const canned = {
      ...BEADS_OK,
      ...BD_NO_DB_FALSE,
      // Native shorthand: requested tst-pyb resolves to the longer canonical ID.
      ["bd\0show\0tst-pyb\0--json\0--long\0--include-comments"]: { stdout: JSON.stringify([{ id: "tst-pyb-full-9f2c", title: "Fixture task", status: "in_design" }]) + "\n", stderr: "", status: 0 },
    }[key];
    if (canned) return canned;
    return real.run(command, args, options);
  } };
  assert.throws(
    () => mutateProviderTaskStatus({ projectRoot: root, taskId: "tst-pyb", status: "In Progress", runner }),
    /refusing to mutate: requested tst-pyb but Beads resolved canonical ID tst-pyb-full-9f2c; no writes were attempted/,
  );
  assert.ok(calls.includes("bd\0show\0tst-pyb\0--json\0--long\0--include-comments"));
  assert.equal(calls.some((key) => key.startsWith("bd\0update")), false);
});

test("provider status mutation rejects a Backlog ID that resolves to a different canonical ID with zero writes", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  writeBacklogTaskFile(root, "backlog/tasks/tst-1.md");
  const real = new ProcessCommandRunner();
  const calls = [];
  const runner = { run(command, args, options = {}) {
    const key = [command, ...args].join("\0");
    calls.push(key);
    const canned = {
      ...BACKLOG_OK,
      ["backlog\0task\0view\0--json\0--\0TST-1"]: { stdout: backlogTaskView("TST-9", "In Planning") + "\n", stderr: "", status: 0 },
    }[key];
    if (canned) return canned;
    return real.run(command, args, options);
  } };
  assert.throws(
    () => mutateProviderTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner }),
    /refusing to mutate: requested TST-1 but Backlog resolved canonical ID TST-9; no writes were attempted/,
  );
  assert.equal(calls.some((key) => key.startsWith("backlog\0task\0edit")), false);
});

test("provider status mutation fails closed when the task cannot be resolved before mutation", () => {
  const root = fixtureRoot();
  writeBeadsStore(root);
  const real = new ProcessCommandRunner();
  const calls = [];
  const runner = { run(command, args, options = {}) {
    const key = [command, ...args].join("\0");
    calls.push(key);
    const canned = {
      ...BEADS_OK,
      ...BD_NO_DB_FALSE,
      ["bd\0show\0GHOST-1\0--json\0--long\0--include-comments"]: { stdout: "", stderr: "issue not found", status: 1 },
    }[key];
    if (canned) return canned;
    return real.run(command, args, options);
  } };
  assert.throws(
    () => mutateProviderTaskStatus({ projectRoot: root, taskId: "GHOST-1", status: "In Progress", runner }),
    /Beads could not resolve GHOST-1/,
  );
  assert.equal(calls.some((key) => key.startsWith("bd\0update")), false);
});
