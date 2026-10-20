import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { ProcessCommandRunner } from "../src/prime-agent-plugin/extension-support/project-initialization.ts";
import { commitConversationTaskStatus } from "../src/prime-agent-plugin/extension-support/spec-episode.ts";
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
  return {
    run(command, args, options = {}) {
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
const DOLT_MUTATION_REVISION_QUERY = "SELECT database() AS database_name, active_branch() AS branch, dolt_hashof('HEAD') AS revision, dolt_hashof('HEAD~1') AS parent_revision, (SELECT COUNT(*) FROM dolt_status) AS status_count";

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

function beadsMutationRunner(root, scenario = {}) {
  const delegate = beadsTransportRunner(beadsWorkspaceResponses(root));
  const calls = [];
  let revision = DOLT_REVISION;
  let parentRevision = "9".repeat(32);
  let remoteRevision = DOLT_REVISION;
  let head = DOLT_DATA_HEAD;
  let status = "in_design";
  let mutationCompleted = false;
  let remoteStatus = "in_design";
  let pushCompleted = false;
  let postPushRefReads = 0;
  return {
    calls,
    run(command, args, options = {}) {
      calls.push([command, ...args]);
      if (command === "bd" && args[0] === "show" && args.includes("--long")) {
        return { stdout: JSON.stringify([{ id: "TST-1", title: "Native task", status, comments: [] }]) + "\n", stderr: "", status: 0 };
      }
      if (command === "bd" && args[0] === "dolt" && args[1] === "pull") {
        if (scenario.concurrentPull) revision = "c".repeat(32);
        return { stdout: "pulled\n", stderr: "", status: 0 };
      }
      if (command === "bd" && args[0] === "--dolt-auto-commit=on") {
        if (scenario.mutationFailure) return { stdout: "", stderr: "guard rejected\n", status: 1 };
        status = args[args.indexOf("--status") + 1];
        mutationCompleted = true;
        revision = scenario.postUpdateDescendant ? "e".repeat(32) : "d".repeat(32);
        parentRevision = scenario.postUpdateDescendant ? "d".repeat(32) : DOLT_REVISION;
        return { stdout: JSON.stringify([{ id: "TST-1", status }]) + "\n", stderr: "", status: 0 };
      }
      if (command === "bd" && args[0] === "dolt" && args[1] === "push") {
        if (scenario.pushFailure) return { stdout: "", stderr: "non-fast-forward\n", status: 1 };
        head = "e".repeat(40);
        remoteRevision = revision;
        remoteStatus = status;
        pushCompleted = true;
        return { stdout: "pushed\n", stderr: "", status: 0 };
      }
      if (command === "dolt" && args[0] === "sql" && args.at(-1) === DOLT_REMOTE_IDENTITY_QUERY) {
        return { stdout: JSON.stringify({ rows: [{ database_name: "fixture_db", branch: "main", revision: remoteRevision }] }) + "\n", stderr: "", status: 0 };
      }
      if (command === "dolt" && args[0] === "sql" && args.at(-1).startsWith("SELECT * FROM issues WHERE id =")) {
        return { stdout: JSON.stringify({ rows: [{ id: "TST-1", title: "Native task", status: remoteStatus }] }) + "\n", stderr: "", status: 0 };
      }
      if (command === "dolt" && args[0] === "sql" && args.at(-1).startsWith("SELECT * FROM comments WHERE issue_id =")) {
        return { stdout: JSON.stringify({ rows: [] }) + "\n", stderr: "", status: 0 };
      }
      if (command === "bd" && args.at(-1) === DOLT_MUTATION_REVISION_QUERY) {
        return { stdout: JSON.stringify([{
          database_name: "fixture_db", branch: "main", revision, parent_revision: parentRevision,
          status_count: mutationCompleted && scenario.dirtyAfterMutation ? 1 : 0,
        }]) + "\n", stderr: "", status: 0 };
      }
      if (command === "bd" && args[0] === "--readonly" && args[1] === "diff") {
        return { stdout: JSON.stringify({ from: args[2], to: args[3], changes: [{ raw: true }] }) + "\n", stderr: "", status: 0 };
      }
      if (command === "git" && args[0] === "ls-remote") {
        if (pushCompleted) postPushRefReads += 1;
        if (scenario.remotePostPushAdvance && postPushRefReads === 1) {
          remoteRevision = "f".repeat(32);
          remoteStatus = "blocked";
          head = "f".repeat(40);
        }
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

test("Beads workspace transport proves bd-managed server, native revision, remote, and refs/dolt/data", () => {
  const root = fixtureRoot();
  const storeDir = writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = recordedDetectionRunner(beadsWorkspaceResponses(root));
  const result = prepareBeadsWorkspaceTransport(root, runner);
  assert.deepEqual(result, {
    status: "ready",
    evidence: {
      provider: "beads",
      projectRoot: root,
      storeDir,
      bdVersion: "1.1.2",
      doltVersion: "2.2.3",
      serverAuthority: "bd-auto-start",
      serverHost: "127.0.0.1",
      serverPort: 3307,
      database: "fixture_db",
      branch: "main",
      revision: DOLT_REVISION,
      remoteName: "origin",
      remoteUrl: DOLT_REMOTE_URL,
      publicationRef: BEADS_DOLT_DATA_REF,
      publicationHead: DOLT_DATA_HEAD,
      publishedRevision: DOLT_REVISION,
    },
  });
  const doltCalls = runner.calls.filter(([command]) => command === "dolt");
  assert.deepEqual(doltCalls.map(([, subcommand]) => subcommand), ["version", "clone", "sql"]);
  assert.ok(doltCalls[1].includes(BEADS_DOLT_DATA_REF), "the only raw clone targets isolated refs/dolt/data proof");
  assert.match(doltCalls[1].at(-1), /prime-claw-beads-remote-proof-/, "the raw clone target is disposable, not the live store");
  assert.notEqual(doltCalls[1].at(-1), storeDir);
  assert.equal(runner.calls.some((call) => call.join(" ").includes("issues.jsonl")), false, "JSONL is never authority");
  assert.equal(runner.calls.filter((call) => call.join("\0") === ["bd", "--readonly", "sql", "--json", DOLT_IDENTITY_QUERY].join("\0")).length, 2);
  assert.equal(runner.calls.filter((call) => call.join("\0") === ["bd", "--readonly", "sql", "--json", DOLT_DIRTY_QUERY].join("\0")).length, 2);
  assert.equal(runner.calls.filter(([command, subcommand]) => command === "git" && subcommand === "ls-remote").length, 2);
});

test("Beads 1.3.1 transport normalizes equivalent configured, native, and repository Git remote forms", () => {
  const root = fixtureRoot();
  const localRemote = join(root, "published.git");
  const fileUrl = `file://${localRemote}`;
  const gitFileUrl = `git+${fileUrl}`;
  const cases = [
    {
      label: "https",
      configured: "https://example.invalid/org/repo.git",
      listed: "git+https://example.invalid/org/repo.git",
      repository: "https://example.invalid/org/repo.git",
      normalized: "git+https://example.invalid/org/repo.git",
    },
    {
      label: "ssh",
      configured: "git+ssh://git@example.invalid/org/repo.git",
      listed: "ssh://git@example.invalid/org/repo.git",
      repository: "git@example.invalid:org/repo.git",
      normalized: "git+ssh://git@example.invalid/org/repo.git",
    },
    {
      label: "file URL",
      configured: fileUrl,
      listed: gitFileUrl,
      repository: localRemote,
      normalized: gitFileUrl,
    },
    {
      label: "absolute path",
      configured: localRemote,
      listed: gitFileUrl,
      repository: fileUrl,
      normalized: gitFileUrl,
    },
  ];

  for (const remote of cases) {
    writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
    const responses = beadsWorkspaceResponses(root, { bdVersion: "1.3.1", doltVersion: "2.5.0" });
    const configured = JSON.parse(responses["bd\0config\0get\0sync.remote\0--json"].stdout);
    configured.value = remote.configured;
    responses["bd\0config\0get\0sync.remote\0--json"] = {
      stdout: JSON.stringify(configured) + "\n", stderr: "", status: 0,
    };
    responses["bd\0dolt\0remote\0list\0--json"] = {
      stdout: JSON.stringify([{ name: "origin", url: remote.listed, sql_url: remote.listed, status: "ok" }]) + "\n",
      stderr: "", status: 0,
    };
    responses["git\0remote\0get-url\0--all\0origin"] = { stdout: `${remote.repository}\n`, stderr: "", status: 0 };
    const runner = recordedDetectionRunner(responses);
    const result = prepareBeadsWorkspaceTransport(root, runner);
    assert.equal(result.status, "ready", remote.label);
    assert.equal(result.evidence.remoteUrl, remote.normalized, remote.label);
    const clone = runner.calls.find(([command, subcommand]) => command === "dolt" && subcommand === "clone");
    assert.ok(clone, remote.label);
    assert.equal(clone.at(-2), remote.normalized, remote.label);
  }
});

test("Beads remote normalization preserves exact native and repository remote cardinality", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const responses = beadsWorkspaceResponses(root, { bdVersion: "1.3.1", doltVersion: "2.5.0" });
  const configured = JSON.parse(responses["bd\0config\0get\0sync.remote\0--json"].stdout);
  configured.value = "https://example.invalid/org/repo.git";
  responses["bd\0config\0get\0sync.remote\0--json"] = {
    stdout: JSON.stringify(configured) + "\n", stderr: "", status: 0,
  };
  responses["bd\0dolt\0remote\0list\0--json"] = {
    stdout: JSON.stringify([
      { name: "origin", url: "git+https://example.invalid/org/repo.git", sql_url: "git+https://example.invalid/org/repo.git", status: "ok" },
      { name: "mirror", url: "https://example.invalid/org/repo.git", sql_url: "https://example.invalid/org/repo.git", status: "ok" },
    ]) + "\n",
    stderr: "", status: 0,
  };
  const duplicate = prepareBeadsWorkspaceTransport(root, recordedDetectionRunner(responses));
  assert.equal(duplicate.status, "blocked");
  assert.equal(duplicate.code, "remote-transport");
  assert.match(duplicate.detail, /exactly one healthy native Dolt remote/);

  configured.value = "../relative/repo.git";
  responses["bd\0config\0get\0sync.remote\0--json"] = {
    stdout: JSON.stringify(configured) + "\n", stderr: "", status: 0,
  };
  const relative = prepareBeadsWorkspaceTransport(root, recordedDetectionRunner(responses));
  assert.equal(relative.status, "blocked");
  assert.equal(relative.code, "remote-transport");
  assert.match(relative.detail, /supported config.yaml-backed Git remote URL or absolute path/);
});

test("Beads workspace transport rejects foreign, symlinked, and ambiguous bd-managed data directories", () => {
  for (const kind of ["foreign", "symlink", "ambiguous"]) {
    const root = fixtureRoot();
    const storeDir = writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
    const responses = beadsWorkspaceResponses(root);
    const status = JSON.parse(responses["bd\0dolt\0status\0--json"].stdout);
    if (kind === "foreign") {
      status.data_dir = "/tmp/foreign-shared-dolt-data";
    } else if (kind === "symlink") {
      const alias = join(root, "dolt-data-alias");
      symlinkSync(join(storeDir, "dolt"), alias, "dir");
      status.data_dir = alias;
    } else {
      status.data_dir = `${join(storeDir, "dolt")}/.`;
    }
    responses["bd\0dolt\0status\0--json"] = { stdout: JSON.stringify(status) + "\n", stderr: "", status: 0 };
    const result = prepareBeadsWorkspaceTransport(root, beadsTransportRunner(responses));
    assert.equal(result.status, "blocked", kind);
    assert.equal(result.code, "server-unavailable", kind);
    assert.match(result.detail, /data-directory identity is unavailable|not the selected store's exact real per-project directory/, kind);
    assert.match(result.remediation, /foreign|symlinked/, kind);
  }
});

test("Beads workspace transport distinguishes an explicitly operator-managed server", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, {
    metadataOverrides: { dolt_mode: "server", dolt_server_host: "127.0.0.1", dolt_server_port: 3307 },
    configText: "dolt.auto-start: false\n",
  });
  const result = prepareBeadsWorkspaceTransport(root, beadsTransportRunner(beadsWorkspaceResponses(root, { operatorManaged: true })));
  assert.equal(result.status, "ready");
  assert.equal(result.evidence.serverAuthority, "operator-managed");
  assert.equal(result.evidence.database, "fixture_db");
});

test("Beads workspace transport fails closed with exact capability, server, revision, remote, and publication remediation", () => {
  const cases = [
    {
      code: "capability",
      change(responses) { responses["bd\0--version"] = { stdout: "", stderr: "bd unavailable", status: 127 }; },
      remediation: /pinned supported `bd` executable/,
    },
    {
      code: "server-mode",
      change(responses) {
        const view = JSON.parse(responses["bd\0context\0--json"].stdout);
        view.dolt_mode = "embedded";
        responses["bd\0context\0--json"] = { stdout: JSON.stringify(view), stderr: "", status: 0 };
      },
      remediation: /bd init --server/,
    },
    {
      code: "server-unavailable",
      change(responses) {
        responses["bd\0dolt\0status\0--json"] = { stdout: JSON.stringify({ schema_version: 1, running: false, pid: 0 }), stderr: "", status: 0 };
      },
      remediation: /bd dolt start/,
    },
    {
      code: "revision",
      change(responses) {
        responses[["bd", "--readonly", "sql", "--json", DOLT_IDENTITY_QUERY].join("\0")] = { stdout: JSON.stringify([{
          database_name: "fixture_db", branch: "main", revision: "ambiguous", dolt_version: "2.2.3",
        }]), stderr: "", status: 0 };
      },
      remediation: /read-only `bd sql` identity query/,
    },
    {
      code: "revision",
      change(responses) {
        responses[["bd", "--readonly", "sql", "--json", DOLT_DIRTY_QUERY].join("\0")] = { stdout: JSON.stringify([{
          table_name: "config", staged: 0, status: "modified",
        }]), stderr: "", status: 0 };
      },
      remediation: /bd dolt commit.*upgrade or repair Beads/,
    },
    {
      code: "remote-transport",
      change(responses) {
        responses["bd\0config\0get\0sync.remote\0--json"] = { stdout: "", stderr: "not configured", status: 1 };
      },
      remediation: /bd dolt remote add origin/,
    },
    {
      code: "publication-authority",
      change(responses) {
        responses[`git\0ls-remote\0--exit-code\0--refs\0origin\0${BEADS_DOLT_DATA_REF}`] = { stdout: "", stderr: "", status: 2 };
      },
      remediation: /bd dolt push --remote origin/,
    },
    {
      code: "publication-authority",
      change() {},
      runnerOptions: { publishedRevision: "c".repeat(32) },
      remediation: /bd dolt pull --remote origin/,
    },
  ];
  for (const scenario of cases) {
    const root = fixtureRoot();
    writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
    const responses = beadsWorkspaceResponses(root);
    scenario.change(responses);
    const result = prepareBeadsWorkspaceTransport(root, beadsTransportRunner(responses, scenario.runnerOptions));
    assert.equal(result.status, "blocked", scenario.code);
    assert.equal(result.code, scenario.code);
    assert.match(result.remediation, scenario.remediation);
  }
});

test("Beads workspace transport refuses a refs/dolt/data race during isolated proof", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const delegate = beadsTransportRunner(beadsWorkspaceResponses(root));
  let publicationReads = 0;
  const runner = {
    run(command, args, options = {}) {
      if (command === "git" && args[0] === "ls-remote") {
        publicationReads += 1;
        if (publicationReads === 2) {
          return { stdout: `${"c".repeat(40)}\t${BEADS_DOLT_DATA_REF}\n`, stderr: "", status: 0 };
        }
      }
      return delegate.run(command, args, options);
    },
  };
  const result = prepareBeadsWorkspaceTransport(root, runner);
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "publication-authority");
  assert.match(result.detail, new RegExp(`${DOLT_DATA_HEAD}.*${"c".repeat(40)}`));
  assert.match(result.remediation, /bd dolt pull --remote origin/);
  assert.equal(publicationReads, 2);
});

test("Beads workspace transport refuses a live revision race during isolated proof", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const delegate = beadsTransportRunner(beadsWorkspaceResponses(root));
  let remoteProofCompleted = false;
  let identityReads = 0;
  let workingSetReads = 0;
  const runner = {
    run(command, args, options = {}) {
      if (command === "dolt" && args[0] === "sql" && args.at(-1) === DOLT_REMOTE_IDENTITY_QUERY) {
        const result = delegate.run(command, args, options);
        remoteProofCompleted = true;
        return result;
      }
      if (command === "bd" && args.at(-1) === DOLT_IDENTITY_QUERY) {
        identityReads += 1;
        if (identityReads === 2) {
          assert.equal(remoteProofCompleted, true, "the live identity recheck must follow isolated remote identity proof");
          return { stdout: JSON.stringify([{
            database_name: "fixture_db", branch: "main", revision: "c".repeat(32), dolt_version: "2.2.3",
          }]) + "\n", stderr: "", status: 0 };
        }
      }
      if (command === "bd" && args.at(-1) === DOLT_DIRTY_QUERY) {
        workingSetReads += 1;
        if (workingSetReads === 2) {
          assert.equal(remoteProofCompleted, true, "the live working-set recheck must follow isolated remote identity proof");
        }
      }
      return delegate.run(command, args, options);
    },
  };
  const result = prepareBeadsWorkspaceTransport(root, runner);
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "revision");
  assert.match(result.detail, new RegExp(`${DOLT_REVISION}.*${"c".repeat(32)}`));
  assert.match(result.remediation, /stable clean revision/);
  assert.equal(identityReads, 2);
  assert.equal(workingSetReads, 2);
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

test("provider task resolution routes a Backlog repo through the native backlog read", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  writeBacklogTaskFile(root, "backlog/tasks/tst-1.md");
  const runner = detectionRunner({
    ...BACKLOG_OK,
    ["backlog\0task\0view\0--json\0--\0TST-1"]: { stdout: backlogTaskView() + "\n", stderr: "", status: 0 },
  });
  const selection = resolveProviderTask(root, "TST-1", runner);
  assert.equal(selection.provider, "backlog");
  assert.equal(selection.taskId, "TST-1");
  assert.equal(selection.status, "In Planning");
  assert.equal(selection.implementationPlan, "One meaningful step");
  assert.equal(selection.taskPathRelative, "backlog/tasks/tst-1.md");
  assert.equal(selection.taskPath, realpathSync(join(root, "backlog/tasks/tst-1.md")));
});

test("provider task resolution routes a Beads repo through the native bd read with canonical status", () => {
  const root = fixtureRoot();
  writeBeadsStore(root);
  const runner = detectionRunner({
    ...BEADS_OK,
    ["bd\0show\0TST-1\0--json"]: { stdout: JSON.stringify([{ id: "TST-1", title: "Fixture task", status: "in_design" }]) + "\n", stderr: "", status: 0 },
  });
  const selection = resolveProviderTask(root, "TST-1", runner);
  assert.deepEqual(selection, {
    provider: "beads",
    taskId: "TST-1",
    title: "Fixture task",
    status: "In Design",
    projectRoot: root,
  });
  // No provider-neutral normalization: no invented plan/path/reference fields.
  assert.equal("taskPath" in selection, false);
  assert.equal("taskPathRelative" in selection, false);
  assert.equal("implementationPlan" in selection, false);
  assert.equal("references" in selection, false);
});

test("provider task resolution fails closed on a Beads task with an unmapped status", () => {
  const root = fixtureRoot();
  writeBeadsStore(root);
  const runner = detectionRunner({
    ...BEADS_OK,
    ["bd\0show\0TST-1\0--json"]: { stdout: JSON.stringify([{ id: "TST-1", title: "Fixture task", status: "open" }]) + "\n", stderr: "", status: 0 },
  });
  assert.throws(() => resolveProviderTask(root, "TST-1", runner), /unmapped status open/);
});

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

test("provider task resolution fails closed when the selected provider executable is unavailable", () => {
  const root = fixtureRoot();
  writeBacklogFolderConfig(root);
  writeBacklogTaskFile(root, "backlog/tasks/tst-1.md");
  const runner = detectionRunner({
    ["backlog\0--version"]: { stdout: "", stderr: "command not found", status: 127 },
  });
  assert.throws(() => resolveProviderTask(root, "TST-1", runner), /executable is unavailable/);
});


test("Beads mutation publishes one guarded provider-native update without retry or force", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root);
  const result = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner });

  assert.equal(result.status, "published");
  assert.equal(result.evidence.preparedRevision, DOLT_REVISION);
  assert.equal(result.evidence.committedRevision, "d".repeat(32));
  assert.equal(result.evidence.publishedRevision, "d".repeat(32));
  assert.equal(result.evidence.publicationHead, "e".repeat(40));
  assert.equal(result.evidence.taskPublished.nativeStatus, "in_progress");
  assert.equal(result.evidence.postMutationProof.parentRevision, DOLT_REVISION);
  assert.equal(result.evidence.postMutationProof.clean, true);
  assert.equal(result.evidence.localPublishedProof.revision, "d".repeat(32));
  assert.equal(result.evidence.localPublishedProof.parentRevision, DOLT_REVISION);
  assert.equal(result.evidence.localPublishedProof.clean, true);
  assert.equal(result.evidence.remotePublishedTask.revision, "d".repeat(32));
  assert.equal(result.evidence.remotePublishedTask.taskRow.status, "in_progress");
  assert.equal(runner.calls.filter((call) => call[0] === "bd" && call[1] === "dolt" && call[2] === "pull").length, 1);
  assert.equal(runner.calls.filter((call) => call[0] === "bd" && call[1] === "dolt" && call[2] === "push").length, 1);
  assert.ok(runner.calls.some((call) => call.join(" ").includes("--dolt-auto-commit=on update TST-1 --status in_progress --if-status in_design --json")));
  assert.equal(runner.calls.some((call) => call.includes("--force")), false);
});

test("Beads mutation returns raw evidence when a descendant appears after the guarded update", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root, { postUpdateDescendant: true });
  const result = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner });

  assert.equal(result.status, "review-required");
  assert.equal(result.code, "concurrent-advance");
  assert.equal(result.phase, "mutation");
  assert.equal(result.evidence.observedRevision, "e".repeat(32));
  assert.equal(result.evidence.revisionProof.parentRevision, "d".repeat(32));
  assert.equal(result.evidence.revisionProof.clean, true);
  assert.equal(result.evidence.taskBefore.task.nativeStatus, "in_design");
  assert.equal(result.evidence.taskObserved.task.nativeStatus, "in_progress");
  assert.deepEqual(result.evidence.taskBefore.command.args, ["show", "TST-1", "--json", "--long", "--include-comments"]);
  assert.deepEqual(result.evidence.taskObserved.command.args, ["show", "TST-1", "--json", "--long", "--include-comments"]);
  assert.deepEqual(JSON.parse(result.evidence.diff.stdout), {
    from: DOLT_REVISION, to: "e".repeat(32), changes: [{ raw: true }],
  });
  assert.equal(runner.calls.some((call) => call[0] === "bd" && call[1] === "dolt" && call[2] === "push"), false);
});

test("Beads mutation refuses a dirty native working set before push", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root, { dirtyAfterMutation: true });
  const result = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner });

  assert.equal(result.status, "review-required");
  assert.equal(result.code, "guarded-mutation-failed");
  assert.equal(result.phase, "mutation");
  assert.equal(result.evidence.observedRevision, "d".repeat(32));
  assert.equal(result.evidence.revisionProof.parentRevision, DOLT_REVISION);
  assert.equal(result.evidence.revisionProof.clean, false);
  assert.match(result.detail, /dolt_status.*not empty/);
  assert.equal(runner.calls.some((call) => call[0] === "bd" && call[1] === "dolt" && call[2] === "push"), false);
});


test("Beads mutation returns raw native evidence for a concurrent pull and does not mutate", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root, { concurrentPull: true });
  const result = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner });

  assert.equal(result.status, "review-required");
  assert.equal(result.code, "concurrent-advance");
  assert.equal(result.evidence.preparedRevision, DOLT_REVISION);
  assert.equal(result.evidence.observedRevision, "c".repeat(32));
  assert.equal(JSON.parse(result.evidence.diff.stdout).changes[0].raw, true);
  assert.equal(result.evidence.taskObserved.task.nativeView.id, "TST-1");
  assert.equal(runner.calls.some((call) => call.includes("update")), false);
  assert.equal(runner.calls.some((call) => call.includes("push")), false);

  const remoteRunner = beadsMutationRunner(root, { remotePostPushAdvance: true });
  const remoteResult = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner: remoteRunner });
  assert.equal(remoteResult.status, "review-required");
  assert.equal(remoteResult.code, "publication-proof-failed");
  assert.equal(remoteResult.evidence.remoteTask.revision, "f".repeat(32));
  assert.equal(remoteResult.evidence.remoteTask.taskRow.status, "blocked");
  assert.equal(remoteRunner.calls.filter((call) => call[0] === "bd" && call[1] === "dolt" && call[2] === "push").length, 1);
});

test("Beads mutation preserves a rejected non-force push with raw evidence and no retry", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root, { pushFailure: true });
  const result = mutateAndPublishBeadsTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner });

  assert.equal(result.status, "review-required");
  assert.equal(result.code, "push-rejected");
  assert.equal(result.evidence.operation.stderr, "non-fast-forward\n");
  assert.equal(result.evidence.observedRevision, "d".repeat(32));
  assert.equal(result.evidence.taskObserved.task.nativeStatus, "in_progress");
  assert.equal(result.evidence.remoteTask.revision, DOLT_REVISION);
  assert.equal(result.evidence.remoteTask.taskRow.status, "in_design");
  assert.equal(JSON.parse(result.evidence.diff.stdout).changes[0].raw, true);
  assert.equal(runner.calls.filter((call) => call[0] === "bd" && call[1] === "dolt" && call[2] === "push").length, 1);
  assert.equal(runner.calls.filter((call) => call[0] === "bd" && call[1] === "dolt" && call[2] === "pull").length, 1);
  assert.equal(runner.calls.some((call) => call.includes("--force")), false);
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
    "backlog\0--version",
    "backlog\0config\0get\0statuses",
    "backlog\0task\0view\0--json\0--\0TST-1",
  ]);
  assert.equal(calls.some((call) => call.startsWith("bd\0")), false);
  assert.deepEqual(git.calls, [
    ["commitOnlyPath", root, relative, "chore: admit TST-1 episode"],
    ["commitPaths", root, "c".repeat(40)],
    ["pathStatus", root, relative],
  ]);
});

test("conversation status publication returns the exact published Beads evidence without file mutation", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root);
  const result = commitConversationTaskStatus({
    taskId: "TST-1", projectRoot: root, taskPath: "backlog/tasks/unused.md", status: "In Progress",
    message: "unused for Beads", runner, git: failIfConversationFilePathIsUsed(),
    resolveTask() { throw new Error("Beads publication must not resolve a Backlog task path"); },
  });

  assert.equal(result.status, "published");
  assert.equal(result.evidence.provider, "beads");
  assert.equal(result.evidence.preparedRevision, DOLT_REVISION);
  assert.equal(result.evidence.publishedRevision, "d".repeat(32));
  assert.equal(result.evidence.publicationHead, "e".repeat(40));
  assert.equal(runner.calls.some((call) => call[0] === "bd" && call[1] === "update"), false);
  assert.equal(runner.calls.filter((call) => call[0] === "bd" && call[1] === "--dolt-auto-commit=on").length, 1);
});

test("conversation status publication propagates raw Beads review evidence without classification", () => {
  const root = fixtureRoot();
  writeBeadsStore(root, { metadataOverrides: { dolt_mode: "server" } });
  const runner = beadsMutationRunner(root, { concurrentPull: true });
  const result = commitConversationTaskStatus({
    taskId: "TST-1", projectRoot: root, taskPath: "backlog/tasks/unused.md", status: "In Progress",
    message: "unused for Beads", runner, git: failIfConversationFilePathIsUsed(),
    resolveTask() { throw new Error("Beads review evidence must not resolve a Backlog task path"); },
  });

  assert.equal(result.status, "review-required");
  assert.equal(result.code, "concurrent-advance");
  assert.equal(result.phase, "synchronization");
  assert.equal(result.evidence.preparedRevision, DOLT_REVISION);
  assert.equal(result.evidence.observedRevision, "c".repeat(32));
  assert.deepEqual(JSON.parse(result.evidence.diff.stdout), {
    from: DOLT_REVISION, to: "c".repeat(32), changes: [{ raw: true }],
  });
  assert.equal(runner.calls.some((call) => call[0] === "bd" && call[1] === "update"), false);
  assert.equal(runner.calls.some((call) => call[0] === "bd" && call[1] === "--dolt-auto-commit=on"), false);
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
    if (key === "bd\0show\0TST-1\0--json") {
      return { stdout: JSON.stringify([{ id: "TST-1", title: "Fixture task", status }]) + "\n", stderr: "", status: 0 };
    }
    return real.run(command, args, options);
  } };
  const resolved = mutateProviderTaskStatus({ projectRoot: root, taskId: "TST-1", status: "In Progress", runner });
  assert.equal(resolved.provider, "beads");
  assert.equal(resolved.status, "In Progress");
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
    ["bd\0show\0TST-1\0--json"]: { stdout: JSON.stringify([{ id: "TST-1", title: "Fixture task", status: "in_design" }]) + "\n", stderr: "", status: 0 },
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
      ["bd\0show\0tst-pyb\0--json"]: { stdout: JSON.stringify([{ id: "tst-pyb-full-9f2c", title: "Fixture task", status: "in_design" }]) + "\n", stderr: "", status: 0 },
    }[key];
    if (canned) return canned;
    return real.run(command, args, options);
  } };
  assert.throws(
    () => mutateProviderTaskStatus({ projectRoot: root, taskId: "tst-pyb", status: "In Progress", runner }),
    /refusing to mutate: requested tst-pyb but Beads resolved canonical ID tst-pyb-full-9f2c; no writes were attempted/,
  );
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
      ["bd\0show\0GHOST-1\0--json"]: { stdout: "", stderr: "issue not found", status: 1 },
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
