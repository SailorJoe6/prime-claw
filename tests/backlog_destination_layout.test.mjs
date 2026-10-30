/** Native de-risk evidence for PRIMECLAW-44, NOT production normalization.
 * Every write below seeds or moves a disposable same-repository fixture.
 * No plugin initializer/migration, provider cutover or independent-DAG adoption.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync,
  realpathSync, existsSync, lstatSync, readlinkSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import test from "node:test";
import { prepareExistingBacklogTaskHistoryWorkspace, prepareExistingBacklogEpisodeProjection } from "../src/prime-agent-plugin/extension-support/task-history-workspace.ts";

function command(cwd, program, ...args) {
  return execFileSync(program, args, { cwd, encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 }).trim();
}
function git(cwd, ...args) { return command(cwd, "git", ...args); }
function backlog(cwd, ...args) { return command(cwd, "backlog", ...args); }
function view(cwd, id) { return JSON.parse(backlog(cwd, "task", "view", "--json", "--", id)).task; }
function files(path) {
  const entries = {};
  for (const item of readdirSync(path, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    if (item.isDirectory()) {
      for (const [name, value] of Object.entries(files(join(path, item.name)))) entries[`${item.name}/${name}`] = value;
    } else entries[item.name] = readFileSync(join(path, item.name)).toString("base64");
  }
  return entries;
}
function settings(root) {
  return Object.fromEntries(["projectName", "statuses", "defaultStatus", "labels", "defaultPort", "autoCommit"]
    .map(key => [key, backlog(root, "config", "get", key)]));
}
function history(root, path) { return git(root, "log", "--follow", "--format=%H", "--", path).split("\n"); }
function create(root, title, ...args) {
  const output = backlog(root, "task", "create", title, ...args, "--no-dod-defaults", "--plain");
  const id = output.match(/\bLAY-\d+(?:\.\d+)*\b/)?.[0];
  assert.ok(id, output);
  return id;
}

function fixture(t, { store, location, key = "backlog_directory" }) {
  const outer = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-layout-proof-")));
  t.after(() => rmSync(outer, { recursive: true, force: true }));
  const root = join(outer, "project"), remote = join(outer, "remote.git");
  command(outer, "git", "init", "-q", "-b", "main", root);
  command(outer, "git", "init", "-q", "-b", "main", "--bare", remote);
  git(root, "config", "user.name", "Layout Fixture");
  git(root, "config", "user.email", "layout@example.invalid");
  writeFileSync(join(root, "code.txt"), "unrelated code\n");
  writeFileSync(join(root, ".gitignore"), "*.scratch\n");
  git(root, "add", "code.txt", ".gitignore");
  git(root, "commit", "-qm", "code before task history");
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "-qu", "origin", "main");
  backlog(root, "init", "Layout fixture", "--defaults", "--backlog-dir", store,
    "--config-location", location, "--task-prefix", "LAY", "--integration-mode", "none");
  const configPath = location === "root" ? join(root, "backlog.config.yml") : join(root, store, "config.yml");
  // Fixture configuration only. Full native-generated config, not a tiny pointer.
  const config = readFileSync(configPath, "utf8")
    .replace(/^statuses:.*$/m, 'statuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]')
    .replace(/^default_status:.*$/m, 'default_status: "In Design"')
    .replace(/^labels:.*$/m, 'labels: ["preserved-label"]')
    .replace(/^default_port:.*$/m, "default_port: 6543")
    .replace(/^auto_commit:.*$/m, "auto_commit: false")
    .replace(/^remote_operations:.*$/m, "remote_operations: false")
    .replace(/^backlog_directory:/m, `${key}:`);
  writeFileSync(configPath, config);
  const active = create(root, "Existing active task", "--status", "In Progress", "--description", "original description",
    "--plan", "preserved living plan", "--notes", "original notes", "--ac", "preserved criterion");
  backlog(root, "task", "edit", active, "--comment", "preserved native comment", "--comment-author", "layout-author");
  const completed = create(root, "Existing completed task", "--status", "Done", "--parent", active,
    "--depends-on", active, "--final-summary", "preserved completion summary");
  backlog(root, "task", "complete", completed);
  const archived = create(root, "Existing archived task", "--status", "In Design", "--description", "preserved archive");
  backlog(root, "task", "archive", archived);
  const activeView = view(root, active);
  // Historical prefix-probe fixture repeats a live ID but is a DISTINCT archive record.
  // It must stay byte-for-byte, not be deduplicated by the live ID.
  const probe = join(root, store, "archive", "tasks", `${active} - historical-prefix-probe.md`);
  writeFileSync(probe, readFileSync(join(root, activeView.path), "utf8") + "\nHistorical prefix probe, not the live task.\n");
  git(root, "add", store, ...(location === "root" ? ["backlog.config.yml"] : []));
  git(root, "commit", "-qm", "seed existing active completed and archived records");
  const seedHead = git(root, "rev-parse", "HEAD");
  backlog(root, "task", "edit", active, "--description", "revised description with history", "--append-notes", "second revision");
  const activePath = view(root, active).path;
  git(root, "add", activePath);
  git(root, "commit", "-qm", "native second task revision");
  git(root, "push", "-q");
  // A whole-directory move must also carry data Git does not record.
  writeFileSync(join(root, store, "untracked-attachment.txt"), "untracked attachment\n");
  writeFileSync(join(root, store, "ignored.scratch"), "ignored attachment\n");
  assert.equal(git(root, "check-ignore", join(store, "ignored.scratch")), join(store, "ignored.scratch"));
  return { root, remote, store, config, configPath, location, key, active, completed, archived, activePath, seedHead };
}

const layouts = [
  { name: "folder-config default", store: "backlog", location: "folder" },
  { name: "root-config default camelCase key", store: "backlog", location: "root", key: "backlogDirectory" },
  { name: "already hidden root config", store: ".backlog", location: "root" },
  { name: "custom root config camelCase key", store: "planning/task store", location: "root", key: "backlogDirectory" },
];
for (const layout of layouts) {
  test(`native selected ${layout.name}: same-repo layout proof preserves records/config/history`, { timeout: 120_000 }, t => {
    const f = fixture(t, layout), { root, active, completed } = f;
    const beforeHead = git(root, "rev-parse", "HEAD");
    const beforeViews = [view(root, active), view(root, completed)];
    const beforeList = JSON.parse(backlog(root, "task", "list", "--json"));
    const beforeSettings = settings(root);
    const beforeFiles = files(join(root, f.store));
    const beforeHistory = history(root, f.activePath);
    assert.deepEqual(beforeHistory, [beforeHead, f.seedHead]);
    const remoteIdentity = git(root, "remote", "get-url", "origin");
    const unrelatedIndex = git(root, "ls-files", "--stage", "code.txt", ".gitignore");
    const codeBytes = readFileSync(join(root, "code.txt"), "utf8");
    const next = f.store === "backlog" ? ".backlog" : f.store;
    // Deliberately fixture-only supported Git/filesystem operations. This is NOT
    // the production adoption/initialization/migration algorithm.
    if (next !== f.store) {
      assert.equal(existsSync(join(root, next)), false);
      git(root, "mv", f.store, next);
    }
    const finalConfig = join(root, next, "config.yml");
    if (f.location === "root") git(root, "mv", "backlog.config.yml", relative(root, finalConfig));
    const nextConfig = f.location === "root"
      ? f.config.replace(new RegExp(`^${f.key}:.*$`, "m"), `${f.key}: "${next}"`)
      : f.config + `backlog_directory: "${next}"\n`;
    writeFileSync(finalConfig, nextConfig);
    symlinkSync(`${next}/config.yml`, join(root, "backlog.config.yml"));
    git(root, "add", relative(root, finalConfig), "backlog.config.yml");
    const layoutDiff = git(root, "diff", "--cached", "--name-only").split("\n");
    assert.ok(layoutDiff.every(path => path === "backlog.config.yml" || path.startsWith(`${f.store}/`) || path.startsWith(`${next}/`)));
    git(root, "commit", "-qm", "fixture same-repo layout adjustment");
    const layoutHead = git(root, "rev-parse", "HEAD");
    git(root, "push", "-q");
    assert.equal(git(root, "ls-remote", "origin", "refs/heads/main").split(/\s/)[0], layoutHead);
    assert.equal(git(root, "merge-base", "--is-ancestor", beforeHead, layoutHead), "");
    assert.equal(git(root, "remote", "get-url", "origin"), remoteIdentity);
    assert.equal(git(root, "branch", "--show-current"), "main");
    assert.equal(git(root, "ls-files", "--stage", "code.txt", ".gitignore"), unrelatedIndex);
    assert.equal(readFileSync(join(root, "code.txt"), "utf8"), codeBytes);
    assert.ok(lstatSync(join(root, "backlog.config.yml")).isSymbolicLink());
    assert.equal(readlinkSync(join(root, "backlog.config.yml")), `${next}/config.yml`);
    assert.equal(git(root, "ls-files", "--stage", "backlog.config.yml").split(" ")[0], "120000");
    assert.equal(readFileSync(finalConfig, "utf8"), nextConfig);
    if (next !== f.store) assert.equal(existsSync(join(root, f.store)), false, "no second live default store");
    const expectedFiles = { ...beforeFiles };
    expectedFiles["config.yml"] = Buffer.from(nextConfig).toString("base64");
    assert.deepEqual(files(join(root, next)), expectedFiles, "all records, archives, ignored/untracked attachments survive");
    for (const oldView of beforeViews) {
      const expectedPath = `${next}/${oldView.path.slice(f.store.length + 1)}`;
      assert.deepEqual(view(root, oldView.id), { ...oldView, path: expectedPath });
      const originalPath = oldView.path;
      const oldLog = history(root, originalPath);
      assert.ok(oldLog.length >= 1);
      const newLog = history(root, expectedPath);
      assert.deepEqual(newLog.slice(-oldLog.length), oldLog, "original task commits retained through --follow");
    }
    const currentActivePath = `${next}/${f.activePath.slice(f.store.length + 1)}`;
    assert.deepEqual(history(root, currentActivePath).slice(-beforeHistory.length), beforeHistory);
    const expectedList = JSON.stringify(beforeList).replaceAll(`${f.store}/`, `${next}/`);
    assert.deepEqual(JSON.parse(backlog(root, "task", "list", "--json")), JSON.parse(expectedList));
    assert.deepEqual(settings(root), beforeSettings);
    const afterStatus = git(root, "status", "--porcelain=v1", "--untracked-files=all");
    assert.equal(afterStatus, next.includes(" ")
      ? `?? "${next}/untracked-attachment.txt"` : `?? ${next}/untracked-attachment.txt`);
    assert.equal(git(root, "check-ignore", `${next}/ignored.scratch`), `${next}/ignored.scratch`);
    mkdirSync(join(root, "src", "nested"), { recursive: true });
    // Native root-config authority must beat a competing built-in config.
    // Only hidden/custom fixtures use decoys; normalized default has no old store.
    let decoy;
    if (f.store !== "backlog") {
      decoy = join(root, "backlog");
      mkdirSync(decoy, { recursive: true });
      writeFileSync(join(decoy, "config.yml"), f.config.replace('project_name: "Layout fixture"', 'project_name: "WRONG STORE"'));
    }
    for (const cwd of [root, join(root, "src", "nested"), join(root, next)]) {
      assert.deepEqual(settings(cwd), beforeSettings);
      assert.deepEqual(view(cwd, active), view(root, active));
    }
    if (decoy) rmSync(decoy, { recursive: true, force: true });
    assert.equal(git(root, "rev-parse", "HEAD"), layoutHead, "native reads never commit");
    assert.equal(git(root, "status", "--porcelain=v1", "--untracked-files=all"), afterStatus, "native reads never normalize config/index");
    assert.deepEqual(files(join(root, next)), expectedFiles);
    assert.equal(readFileSync(finalConfig, "utf8"), nextConfig);
    console.log(JSON.stringify({ layout: layout.name, nativeVersion: backlog(root, "--version"),
      oldStore: f.store, selectedStore: next, beforeHead, layoutHead, originalTaskCommits: beforeHistory,
      active, completed, archived: f.archived, preservedStoreFiles: Object.keys(expectedFiles).length }));
  });
}

test("native existing-init and config keys do not expose a relocation command", { timeout: 60_000 }, t => {
  const f = fixture(t, layouts[0]);
  const before = files(f.root), index = git(f.root, "ls-files", "--stage");
  for (const args of [
    ["init", "ignored", "--defaults", "--integration-mode", "none", "--backlog-dir", ".backlog"],
    ["init", "ignored", "--defaults", "--integration-mode", "none", "--config-location", "root"],
    ["config", "get", "backlogDirectory"], ["config", "set", "backlogDirectory", ".backlog"],
  ]) {
    const result = spawnSync("backlog", args, { cwd: f.root, encoding: "utf8", timeout: 30_000 });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, args[0] === "init" ? /fixed after initialization/ : /unknown|invalid|not.*supported/i);
    assert.deepEqual(files(f.root), before, `${args.join(" ")} does not mutate fixture`);
    assert.equal(git(f.root, "ls-files", "--stage"), index);
  }
});

// Production preserving preparation (the original same-repository de-risk
// proofs above remain as historical/native contract coverage).
for (const layout of layouts) {
  test(`explicit preparation adopts ${layout.name} without losing code/task history`, { timeout: 120_000 }, t => {
    const f = fixture(t, layout);
    const beforeHead = git(f.root, "rev-parse", "HEAD");
    const beforeIndex = git(f.root, "ls-files", "--stage", "code.txt");
    const oldFiles = files(join(f.root, f.store));
    const oldViews = [view(f.root, f.active), view(f.root, f.completed)];
    const result = prepareExistingBacklogTaskHistoryWorkspace({ primaryRoot: f.root });
    assert.equal(result.status, "prepared", JSON.stringify(result));
    const finalRel = f.store === "backlog" ? ".backlog" : f.store;
    assert.equal(result.storeDir, join(f.root, finalRel));
    assert.equal(git(f.root, "rev-parse", "HEAD"), beforeHead, "original code history is unchanged");
    assert.equal(git(f.root, "ls-files", "--stage", "code.txt"), beforeIndex);
    assert.equal(git(f.root, "ls-files", "--", f.store), "", "no remaining tracked task paths or gitlink");
    assert.equal(git(f.root, "diff", "--cached", "--diff-filter=A", "--name-only"), "", "no accidental gitlink");
    assert.equal(readlinkSync(join(f.root, "backlog.config.yml")), `${finalRel}/config.yml`);
    const nextFiles = files(result.storeDir);
    for (const [name, bytes] of Object.entries(oldFiles)) {
      if (name === "config.yml") continue; // only the specified native directory selection may change
      assert.equal(nextFiles[name], bytes, `preserved ${name}`);
    }
    const expectedConfig = f.store !== "backlog" ? f.config
      : /^(backlog_directory|backlogDirectory):.*$/m.test(f.config)
        ? f.config.replace(/^(backlog_directory|backlogDirectory):.*$/m, (_line, key) => `${key}: ".backlog"`)
        : f.config + 'backlog_directory: ".backlog"\n';
    assert.equal(readFileSync(join(result.storeDir, "config.yml"), "utf8"), expectedConfig);
    assert.equal(git(result.storeDir, "remote", "get-url", "origin"), f.remote);
    assert.equal(git(result.storeDir, "status", "--porcelain"), "");
    assert.equal(git(result.storeDir, "ls-remote", "origin", "refs/heads/prime-claw/tasks").split(/\s/)[0], result.head);
    assert.equal(spawnSync("git", ["-C", f.root, "merge-base", beforeHead, result.head]).status, 1, "task history is disconnected");
    const retainedMessages = git(result.storeDir, "log", "--format=%s");
    assert.match(retainedMessages, /seed existing active completed and archived records/);
    assert.match(retainedMessages, /native second task revision/);
    for (let i = 0; i < oldViews.length; i++) {
      const current = view(f.root, oldViews[i].id);
      for (const key of ["id", "description", "implementationPlan", "implementationNotes", "status", "dependencies", "parentTaskId"]) {
        assert.deepEqual(current[key], oldViews[i][key], key);
      }
    }
    if (f.store === "backlog") assert.equal(existsSync(join(f.root, "backlog")), false);
    // Explicit replay accepts the exact canonical pending code projection.
    const beforeReplayIndex = git(f.root, "ls-files", "--stage", "-z");
    const beforeReplayStore = files(result.storeDir);
    const replay = prepareExistingBacklogTaskHistoryWorkspace({ primaryRoot: f.root });
    assert.equal(replay.status, "prepared", JSON.stringify(replay));
    assert.equal(replay.head, result.head, "replay never creates a new task-history commit");
    assert.equal(git(f.root, "rev-parse", "HEAD"), beforeHead);
    assert.equal(git(f.root, "ls-files", "--stage", "-z"), beforeReplayIndex, "replay preserves every code index entry");
    // Git may refresh its private metadata; compare every native store file.
    const afterReplayStore = files(result.storeDir);
    const nativeFiles = snapshot => Object.fromEntries(Object.entries(snapshot).filter(([path]) => !path.startsWith(".git/")));
    assert.deepEqual(nativeFiles(afterReplayStore), nativeFiles(beforeReplayStore), "replay preserves all native store paths/bytes");
  });
}

for (const layout of [layouts[0], layouts[3]]) {
  test(`active Episode ${layout.name} projects native store without changing its code HEAD/index`, { timeout: 120_000 }, t => {
    const f = fixture(t, layout);
    const target = join(dirname(f.root), "episode");
    git(f.root, "worktree", "add", "-qb", "episode", target, f.seedHead);
    const head = git(target, "rev-parse", "HEAD");
    const index = git(target, "ls-files", "--stage", "-z");
    const oldRootPath = join(f.root, "backlog.config.yml");
    const originalRootConfig = existsSync(oldRootPath)
      ? { bytesBase64: readFileSync(oldRootPath).toString("base64"), mode: lstatSync(oldRootPath).mode }
      : null;
    const originalFiles = Object.entries(files(join(f.root, f.store)))
      .map(([path, bytesBase64]) => ({ path, bytesBase64, mode: lstatSync(join(f.root, f.store, path)).mode }));
    const primary = prepareExistingBacklogTaskHistoryWorkspace({ primaryRoot: f.root });
    assert.equal(primary.status, "prepared", JSON.stringify(primary));
    const finalRel = relative(f.root, primary.storeDir);
    // Existing migration's common private ignore protects the older Episode
    // without altering its code/index just to install the independent clone.
    writeFileSync(join(f.root, ".git", "info", "exclude"), `/${finalRel}/\n`);
    const result = prepareExistingBacklogEpisodeProjection({
      primaryRoot: f.root, targetWorktree: target, expectedRevision: primary.head,
      remoteName: primary.remote, remoteUrl: primary.remoteUrl,
      originalStoreRelative: f.store, originalFiles, originalRootConfig,
    });
    assert.equal(result.status, "prepared", JSON.stringify(result));
    assert.equal(git(target, "rev-parse", "HEAD"), head);
    assert.equal(git(target, "ls-files", "--stage", "-z"), index, "EVERY original index entry remains unchanged");
    assert.equal(git(result.storeDir, "rev-parse", "HEAD"), primary.head);
    assert.equal(git(result.storeDir, "status", "--porcelain"), "");
    assert.equal(view(target, f.active).description, view(f.root, f.active).description);
    assert.equal(readFileSync(join(target, "code.txt"), "utf8"), "unrelated code\n");
    const changed = git(target, "diff", "--name-only", "HEAD").split("\n");
    assert.ok(changed.every(path => result.codePaths.includes(path)));
    assert.ok(result.codePaths.includes("backlog.config.yml"));
    assert.ok(result.codePaths.includes(f.activePath));
  });
}

for (const store of ["backlog", "planning/task store"]) {
  test(`native root override at ${store} preserves inactive folder configuration bytes`, { timeout: 120_000 }, t => {
    const f = fixture(t, store === "backlog" ? layouts[0] : layouts[3]);
    const originalFolder = join(f.root, f.store, "config.yml");
    // A native root override is valid authority, not an ambiguous provider or
    // permission to discard the different inactive folder configuration.
    if (!existsSync(originalFolder)) writeFileSync(originalFolder, f.config.replace(/^default_port:.*$/m, "default_port: 6544"));
    const folderBytes = readFileSync(originalFolder, "utf8");
    const rootBytes = f.config.replace(/^default_port:.*$/m, "default_port: 6555")
      + (f.location === "folder" ? `backlog_directory: "${f.store}"\n` : "");
    writeFileSync(join(f.root, "backlog.config.yml"), rootBytes);
    git(f.root, "add", "backlog.config.yml", originalFolder);
    git(f.root, "commit", "-qm", "native authoritative root override with inactive folder config");
    git(f.root, "push", "-q");
    const beforeHead = git(f.root, "rev-parse", "HEAD");
    assert.equal(backlog(f.root, "config", "get", "defaultPort"), "6555");
    const result = prepareExistingBacklogTaskHistoryWorkspace({ primaryRoot: f.root });
    assert.equal(result.status, "prepared", JSON.stringify(result));
    const finalRel = f.store === "backlog" ? ".backlog" : f.store;
    assert.equal(readFileSync(join(result.storeDir, "config.yml"), "utf8"), folderBytes);
    const finalRoot = f.store === "backlog" ? rootBytes.replace(/^backlog_directory:.*$/m, 'backlog_directory: ".backlog"') : rootBytes;
    assert.equal(readFileSync(join(result.storeDir, "backlog.config.yml"), "utf8"), finalRoot);
    assert.equal(readlinkSync(join(f.root, "backlog.config.yml")), `${finalRel}/backlog.config.yml`);
    assert.equal(backlog(f.root, "config", "get", "defaultPort"), "6555");
    assert.equal(git(f.root, "rev-parse", "HEAD"), beforeHead);
    assert.equal(git(result.storeDir, "status", "--porcelain"), "");
    const beforeReplayIndex = git(f.root, "ls-files", "--stage", "-z");
    const beforeReplayStore = files(result.storeDir);
    const replay = prepareExistingBacklogTaskHistoryWorkspace({ primaryRoot: f.root });
    assert.equal(replay.status, "prepared", JSON.stringify(replay));
    assert.equal(replay.head, result.head, "replay never creates a new task-history commit");
    assert.equal(git(f.root, "rev-parse", "HEAD"), beforeHead);
    assert.equal(git(f.root, "ls-files", "--stage", "-z"), beforeReplayIndex, "replay preserves every code index entry");
    // Git may refresh its private metadata; compare every native store file.
    const afterReplayStore = files(result.storeDir);
    const nativeFiles = snapshot => Object.fromEntries(Object.entries(snapshot).filter(([path]) => !path.startsWith(".git/")));
    assert.deepEqual(nativeFiles(afterReplayStore), nativeFiles(beforeReplayStore), "replay preserves all native store paths/bytes");
  });
}
