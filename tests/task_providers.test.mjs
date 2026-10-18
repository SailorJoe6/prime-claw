import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ProcessCommandRunner } from "../src/prime-agent-plugin/extension-support/project-initialization.ts";
import {
  BEADS_STATUS_MAP,
  CANONICAL_LIFECYCLE_STATUSES,
  checkBacklogCapabilities,
  checkBeadsCapabilities,
  checkSelectedProviderCapabilities,
  detectTaskProvider,
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
  mkdirSync(dir, { recursive: true });
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

test("the beads status map covers every canonical lifecycle state exactly once", () => {
  assert.deepEqual(Object.keys(BEADS_STATUS_MAP), CANONICAL);
  for (const status of CANONICAL) {
    const mapping = BEADS_STATUS_MAP[status];
    assert.ok(mapping.name && mapping.category);
  }
});
