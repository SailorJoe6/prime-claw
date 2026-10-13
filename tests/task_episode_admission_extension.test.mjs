import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

import {
  CliTaskEpisodeAdmissionGit,
  createTaskEpisode,
} from "../src/prime-agent-plugin/extension-support/spec-episode.ts";
import {
  resolveBacklogTask,
} from "../src/prime-agent-plugin/extension-support/reviewed-plan-support.ts";

const ROOT = realpathSync(join(dirname(fileURLToPath(import.meta.url)), ".."));
const BACKLOG = join(ROOT, "deps", "backlog", "dist", "backlog");

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

class FixtureRunner {
  run(command, args, options = {}) {
    const result = spawnSync(command === "backlog" ? BACKLOG : command, args, {
      cwd: options.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const response = {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? result.error?.message ?? "",
      status: result.status ?? 1,
    };
    if (response.status !== 0 && !options.allowFailure) {
      throw new Error(`${command} ${args.join(" ")} failed: ${response.stderr || `exit ${response.status}`}`);
    }
    return response;
  }
}

function view(root, taskId = "PRIMECLAW-1") {
  return JSON.parse(execFileSync(BACKLOG, ["task", "view", "--json", "--", taskId], {
    cwd: root,
    encoding: "utf8",
  })).task;
}

function fixture() {
  const rawRoot = mkdtempSync(join(tmpdir(), "prime-claw-task-admission-"));
  const root = realpathSync(rawRoot);
  mkdirSync(join(root, "backlog"), { recursive: true });
  copyFileSync(join(ROOT, "backlog", "config.yml"), join(root, "backlog", "config.yml"));
  git(root, "init", "-q");
  git(root, "config", "user.name", "Prime Claw Test");
  git(root, "config", "user.email", "prime-claw@example.invalid");
  writeFileSync(join(root, "unrelated.txt"), "baseline\n");
  git(root, "add", "--", "backlog/config.yml", "unrelated.txt");
  git(root, "commit", "-q", "-m", "fixture baseline");
  execFileSync(BACKLOG, [
    "task", "create", "Task-native admission fixture",
    "--status", "In Planning",
    "--description", "Create one exact Episode",
    "--plan", "1. Create the bounded resource.\n2. Verify exact identity.",
    "--plain",
  ], { cwd: root, encoding: "utf8" });
  const task = view(root);
  git(root, "add", "--", task.path);
  git(root, "commit", "-q", "--only", "-m", "plan exact task", "--", task.path);
  writeFileSync(join(root, "unrelated.txt"), "unrelated working change\n");

  let record = null;
  const events = [];
  const ownership = {
    read() { events.push(["ownership-read", record?.status ?? null]); return record; },
    write(_projectRoot, value) { record = value; events.push(["ownership-write", value.status]); },
  };
  const runner = new FixtureRunner();
  const taskResolver = (cwd, taskId) => resolveBacklogTask(cwd, taskId, runner);
  const ctx = {
    cwd: root,
    model: { provider: "test", id: "model" },
    sessionManager: {
      getSessionId: () => "owner-session",
      getSessionFile: () => join(root, "owner.jsonl"),
      getHeader: () => ({ rlmDepth: 0 }),
    },
  };
  const dependencies = {
    admissionGit: new CliTaskEpisodeAdmissionGit(),
    admissionRunner: runner,
    taskResolver,
    ownership,
    reservationOperationId: "operation-1234",
    now: () => "2026-10-13T09:00:00.000Z",
  };
  return { root, task, ctx, dependencies, ownership, events, get record() { return record; } };
}

function commitPaths(root, ref = "HEAD") {
  const output = git(root, "diff-tree", "--root", "--no-commit-id", "--name-only", "-r", ref, "--");
  return output ? output.split(/\r?\n/) : [];
}

test("trusted task admission commits In Progress before reservation and allocation despite push failure", async () => {
  const f = fixture();
  let observed;
  const result = await createTaskEpisode("PRIMECLAW-1", "tool-call", f.ctx, {
    ...f.dependencies,
    allocateTaskEpisode: async (taskId) => {
      const reserved = f.record;
      observed = {
        taskId,
        status: view(f.root).status,
        reservationStatus: reserved.status,
        baseRef: reserved.baseRef,
        head: git(f.root, "rev-parse", "HEAD"),
        paths: commitPaths(f.root, reserved.baseRef),
      };
      const active = {
        ...reserved,
        status: "active",
        worktreeName: "prime-claw-primeclaw-1-episode-operation",
        worktree: join(f.root, "episode-worktree"),
        branch: "episode/primeclaw-1-operation",
        head: reserved.baseRef,
        episodeId: "episode-session",
        episodeSessionFile: join(f.root, "episode.jsonl"),
        episodeActiveSessionId: "active-route",
      };
      f.ownership.write(f.root, active);
      return { ...active, reused: false };
    },
  }, { engine: "local" });

  assert.deepEqual(observed, {
    taskId: "PRIMECLAW-1",
    status: "In Progress",
    reservationStatus: "provisioning",
    baseRef: observed.head,
    head: observed.head,
    paths: [f.task.path],
  });
  assert.equal(result.status, "active");
  assert.match(result.admissionPushError, /push/i);
  assert.deepEqual(commitPaths(f.root), [f.task.path]);
  assert.equal(git(f.root, "status", "--short"), "M unrelated.txt");
  assert.deepEqual(f.events.filter(([name]) => name === "ownership-write"), [
    ["ownership-write", "provisioning"], ["ownership-write", "active"],
  ]);
});

test("proven clean pre-reservation failure returns the exact task to In Planning", async () => {
  const f = fixture();
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", f.ctx, {
      ...f.dependencies,
      reserveTaskOwnership() { throw new Error("reservation rejected before write"); },
      allocateTaskEpisode: async () => { throw new Error("must not allocate"); },
    }, { engine: "local" }),
    /returned to In Planning.*reservation rejected before write/,
  );

  assert.equal(view(f.root).status, "In Planning");
  assert.equal(f.record, null);
  assert.deepEqual(commitPaths(f.root), [f.task.path]);
  assert.deepEqual(git(f.root, "log", "-2", "--pretty=%s").split(/\r?\n/), [
    "chore: roll back PRIMECLAW-1 episode admission",
    "chore: admit PRIMECLAW-1 episode",
  ]);
  assert.equal(git(f.root, "status", "--short"), "M unrelated.txt");
});

test("post-reservation allocation failure publishes Blocked with exact recovery condition", async () => {
  const f = fixture();
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", f.ctx, {
      ...f.dependencies,
      allocateTaskEpisode: async () => {
        f.ownership.write(f.root, {
          ...f.record,
          status: "uncertain",
          uncertaintyReason: "session publication outcome unknown",
        });
        throw new Error("session publication outcome unknown");
      },
    }, { engine: "local" }),
    /is Blocked and requires exact recovery.*session publication outcome unknown/,
  );

  const task = view(f.root);
  assert.equal(task.status, "Blocked");
  assert.match(JSON.stringify(task), /inspect \.prime-claw\/ownership\.json/);
  assert.match(JSON.stringify(task), /reconcile every recorded task, worktree, and session identity to PRIMECLAW-1/);
  assert.match(JSON.stringify(task), /do not retry it as fresh creation/);
  assert.equal(f.record.status, "uncertain");
  assert.equal(view(f.root).implementationPlan.includes("Create the bounded resource"), true);
  assert.deepEqual(commitPaths(f.root), [f.task.path]);
  assert.deepEqual(commitPaths(f.root, f.record.baseRef), [f.task.path]);
  assert.equal(git(f.root, "status", "--short"), "M unrelated.txt");

  const head = git(f.root, "rev-parse", "HEAD");
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call-2", f.ctx, f.dependencies, { engine: "local" }),
    /requires the exact task to be In Planning/,
  );
  assert.equal(git(f.root, "rev-parse", "HEAD"), head);
});

test("task admission preflight rejects unclean task and nonterminal ownership without mutation", async () => {
  const dirty = fixture();
  writeFileSync(join(dirty.root, dirty.task.path), `${readFileSync(join(dirty.root, dirty.task.path), "utf8")}\nlocal change\n`);
  const dirtyHead = git(dirty.root, "rev-parse", "HEAD");
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", dirty.ctx, dirty.dependencies, { engine: "local" }),
    /task path to be clean/,
  );
  assert.equal(git(dirty.root, "rev-parse", "HEAD"), dirtyHead);
  assert.equal(view(dirty.root).status, "In Planning");

  const owned = fixture();
  owned.ownership.write(owned.root, {
    version: 1, status: "provisioning", operationId: "other", engine: "local", ownerSessionId: "other-owner",
    sourceLocation: ".ralph/plans/future/other", slug: "other", baseRef: "base", bundleDigest: "0".repeat(64),
    createdAt: "x", updatedAt: "x",
  });
  const ownedHead = git(owned.root, "rev-parse", "HEAD");
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", owned.ctx, owned.dependencies, { engine: "local" }),
    /Non-terminal Episode ownership already exists/,
  );
  assert.equal(git(owned.root, "rev-parse", "HEAD"), ownedHead);
  assert.equal(view(owned.root).status, "In Planning");
});


test("task admission status and plan preflight reject before main mutation", async () => {
  const wrongStatus = fixture();
  execFileSync(BACKLOG, ["task", "edit", "--status", "In Design", "--plain", "--", "PRIMECLAW-1"], { cwd: wrongStatus.root });
  git(wrongStatus.root, "add", "--", wrongStatus.task.path);
  git(wrongStatus.root, "commit", "-q", "--only", "-m", "return to design", "--", wrongStatus.task.path);
  const statusHead = git(wrongStatus.root, "rev-parse", "HEAD");
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", wrongStatus.ctx, wrongStatus.dependencies, { engine: "local" }),
    /requires the exact task to be In Planning/,
  );
  assert.equal(git(wrongStatus.root, "rev-parse", "HEAD"), statusHead);
  assert.equal(wrongStatus.record, null);

  const placeholder = fixture();
  execFileSync(BACKLOG, ["task", "edit", "--plan", "TODO: write the implementation plan", "--plain", "--", "PRIMECLAW-1"], { cwd: placeholder.root });
  git(placeholder.root, "add", "--", placeholder.task.path);
  git(placeholder.root, "commit", "-q", "--only", "-m", "placeholder plan", "--", placeholder.task.path);
  const planHead = git(placeholder.root, "rev-parse", "HEAD");
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", placeholder.ctx, placeholder.dependencies, { engine: "local" }),
    /requires a meaningful Implementation Plan/,
  );
  assert.equal(git(placeholder.root, "rev-parse", "HEAD"), planHead);
  assert.equal(view(placeholder.root).status, "In Planning");
  assert.equal(placeholder.record, null);
});

test("failed In Progress commit is recovered by one exact In Planning commit", async () => {
  const f = fixture();
  const real = f.dependencies.admissionGit;
  let commits = 0;
  const admissionGit = {
    repositoryRoot: (cwd) => real.repositoryRoot(cwd),
    head: (repo) => real.head(repo),
    commitPaths: (repo, ref) => real.commitPaths(repo, ref),
    pathStatus: (repo, path) => real.pathStatus(repo, path),
    push: (repo) => real.push(repo),
    commitOnlyPath(repo, path, message) {
      commits += 1;
      if (commits === 1) throw new Error("status commit rejected before write");
      return real.commitOnlyPath(repo, path, message);
    },
  };
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", f.ctx, {
      ...f.dependencies,
      admissionGit,
      allocateTaskEpisode: async () => { throw new Error("must not allocate"); },
    }, { engine: "local" }),
    /returned to In Planning.*status commit rejected before write/,
  );
  assert.equal(commits, 2);
  assert.equal(view(f.root).status, "In Planning");
  assert.equal(git(f.root, "log", "-1", "--pretty=%s"), "chore: roll back PRIMECLAW-1 episode admission");
  assert.deepEqual(commitPaths(f.root), [f.task.path]);
  assert.equal(f.record, null);
});


test("allocator return without durable active identity is published as Blocked", async () => {
  const f = fixture();
  await assert.rejects(
    createTaskEpisode("PRIMECLAW-1", "tool-call", f.ctx, {
      ...f.dependencies,
      allocateTaskEpisode: async () => ({ ...f.record, status: "active", reused: false }),
    }, { engine: "local" }),
    /is Blocked and requires exact recovery.*exact active reservation identity/,
  );
  assert.equal(view(f.root).status, "Blocked");
  assert.equal(f.record.status, "provisioning");
  assert.match(JSON.stringify(view(f.root)), /reconcile every recorded task, worktree, and session identity/);
});
