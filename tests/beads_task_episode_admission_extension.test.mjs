import assert from "node:assert/strict";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

import {
  CliTaskEpisodeAdmissionGit,
  createTaskEpisode,
} from "../src/prime-agent-plugin/extension-support/spec-episode.ts";

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

class FixtureRunner {
  run(command, args, options = {}) {
    const result = spawnSync(command, args, {
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

const nativeStatus = {
  "In Planning": "in_planning",
  "In Progress": "in_progress",
  Blocked: "blocked",
};
const revision = {
  "In Planning": "a".repeat(32),
  "In Progress": "b".repeat(32),
  Blocked: "c".repeat(32),
};

function published(root, taskId, canonicalStatus, design) {
  const status = nativeStatus[canonicalStatus];
  const nativeView = {
    id: taskId,
    title: "Provider-native admission fixture",
    status,
    design,
    comments: [{ id: 7, text: `${canonicalStatus} raw evidence` }],
  };
  return {
    status: "published",
    evidence: {
      provider: "beads",
      projectRoot: root,
      taskId,
      publishedRevision: revision[canonicalStatus],
      taskPublished: {
        taskId,
        title: nativeView.title,
        nativeStatus: status,
        canonicalStatus,
        nativeView,
      },
    },
  };
}

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "prime-claw-beads-admission-")));
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "Prime Claw Test");
  git(root, "config", "user.email", "prime-claw@example.invalid");
  execFileSync("sh", ["-c", "printf 'code baseline\\n' > code.txt"], { cwd: root });
  git(root, "add", "code.txt");
  git(root, "commit", "-q", "-m", "code baseline");

  const taskId = "BEADS-43";
  const design = "1. Publish one exact task.\n2. Reserve and allocate its Episode.";
  let liveDesign = design;
  let unrelatedTask = {
    id: "BEADS-other",
    title: "Unrelated provider task",
    status: "open",
    revision: "unrelated-before",
    comments: [],
  };
  let status = "In Planning";
  let resolvedId = taskId;
  let operationInProgress = false;
  let trackedStatus = "";
  let upstreamHead = git(root, "rev-parse", "HEAD");
  let publicationOverride;
  let publicationMutator;
  let reservationFailure;
  let allocationFailure;
  let allocationMutator;
  let allocatorCalls = 0;
  const statusCalls = [];
  const reservationCalls = [];
  const records = new Map();
  const runner = new FixtureRunner();
  const realGit = new CliTaskEpisodeAdmissionGit();
  const admissionGit = {
    repositoryRoot: (cwd) => realGit.repositoryRoot(cwd),
    branch: (repo) => realGit.branch(repo),
    head: (repo) => realGit.head(repo),
    upstreamHead: () => upstreamHead,
    trackedStatus: () => trackedStatus,
    operationInProgress: () => operationInProgress,
    commitPaths: (repo, ref) => realGit.commitPaths(repo, ref),
    pathStatus: (repo, path) => realGit.pathStatus(repo, path),
    commitOnlyPath: (repo, path, message) => realGit.commitOnlyPath(repo, path, message),
    push: (repo) => realGit.push(repo),
  };
  const ownership = {
    read(_projectRoot, ownerSessionId) {
      return records.get(ownerSessionId ?? "owner-session") ?? null;
    },
    write(_projectRoot, record) { records.set(record.ownerSessionId, record); },
  };
  const selection = () => {
    const native = nativeStatus[status];
    return {
      provider: "beads",
      taskId: resolvedId,
      title: "Provider-native admission fixture",
      nativeStatus: native,
      status,
      projectRoot: root,
      nativeView: {
        id: resolvedId,
        title: "Provider-native admission fixture",
        status: native,
        design: liveDesign,
        comments: [{ id: 7, text: `${status} raw evidence` }],
      },
    };
  };
  const commitTaskStatus = (options) => {
    statusCalls.push(options.status);
    assert.equal(options.taskId, taskId);
    assert.equal(options.expectedProvider, "beads");
    if (publicationOverride) return publicationOverride(options.status);
    status = options.status;
    const result = published(root, taskId, status, liveDesign);
    publicationMutator?.(options.status);
    return result;
  };
  const reserveBeadsTaskOwnership = (input, reservationDependencies) => {
    reservationCalls.push(input);
    if (reservationFailure) throw reservationFailure;
    const now = "2026-10-20T17:00:00.000Z";
    const record = {
      version: 2,
      provider: "beads",
      status: "provisioning",
      operationId: input.operationId ?? "beads-operation",
      engine: input.engine,
      ownerSessionId: input.ownerSessionId,
      taskId,
      providerRevision: input.publication.evidence.publishedRevision,
      taskEvidence: input.publication.evidence.taskPublished.nativeView,
      baseRef: input.baseRef,
      createdAt: now,
      updatedAt: now,
      ...(input.projectSetupId ? { projectSetupId: input.projectSetupId } : {}),
      ...(input.routingEnvironmentId ? { routingEnvironmentId: input.routingEnvironmentId } : {}),
    };
    reservationDependencies.ownership.write(root, record);
    return record;
  };
  const allocateTaskEpisode = async () => {
    allocatorCalls += 1;
    const reserved = ownership.read(root, "owner-session");
    allocationMutator?.(reserved);
    if (allocationFailure) throw allocationFailure;
    const active = {
      ...reserved,
      status: "active",
      worktreeName: "prime-claw-beads-43-episode-beads-op",
      worktree: join(root, "episode-worktree"),
      branch: "episode/beads-43-beads-op",
      head: reserved.baseRef,
      episodeId: "episode-session",
      episodeSessionFile: join(root, "episode.jsonl"),
      episodeActiveSessionId: "active-route",
    };
    ownership.write(root, active);
    return { ...active, reused: false };
  };
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
    admissionGit,
    admissionRunner: runner,
    providerDetector: () => ({ kind: "selected", evidence: { provider: "beads" } }),
    providerTaskResolver: () => selection(),
    commitTaskStatus,
    reserveBeadsTaskOwnership,
    allocateTaskEpisode,
    ownership,
    reservationOperationId: "beads-operation",
    now: () => "2026-10-20T17:30:00.000Z",
  };
  return {
    root, taskId, design, ctx, dependencies, statusCalls, reservationCalls, ownership,
    get status() { return status; },
    set status(value) { status = value; },
    get allocatorCalls() { return allocatorCalls; },
    set resolvedId(value) { resolvedId = value; },
    set operationInProgress(value) { operationInProgress = value; },
    set trackedStatus(value) { trackedStatus = value; },
    set upstreamHead(value) { upstreamHead = value; },
    set publicationOverride(value) { publicationOverride = value; },
    set publicationMutator(value) { publicationMutator = value; },
    set liveDesign(value) { liveDesign = value; },
    get unrelatedTask() { return structuredClone(unrelatedTask); },
    set unrelatedTask(value) { unrelatedTask = structuredClone(value); },
    set reservationFailure(value) { reservationFailure = value; },
    set allocationFailure(value) { allocationFailure = value; },
    set allocationMutator(value) { allocationMutator = value; },
  };
}

async function create(f) {
  return createTaskEpisode(f.taskId, "tool-call", f.ctx, f.dependencies, { engine: "local" });
}

test("direct Beads admission publishes, reserves, allocates, and proves one exact active identity", async () => {
  const f = fixture();
  const codeHead = git(f.root, "rev-parse", "HEAD");
  const result = await create(f);

  assert.equal(result.provider, "beads");
  assert.equal(result.status, "active");
  assert.equal(result.taskId, f.taskId);
  assert.equal(result.baseRef, codeHead);
  assert.equal(result.head, codeHead);
  assert.equal(result.providerRevision, revision["In Progress"]);
  assert.equal(result.taskEvidence.design, f.design);
  assert.deepEqual(f.statusCalls, ["In Progress"]);
  assert.equal(f.reservationCalls.length, 1);
  assert.equal(f.reservationCalls[0].baseRef, codeHead);
  assert.equal(f.reservationCalls[0].publication.status, "published");
  assert.equal(f.allocatorCalls, 1);
  assert.equal(f.status, "In Progress");
  assert.equal(git(f.root, "rev-parse", "HEAD"), codeHead);
});

test("Beads admission preflight rejects unsafe code or non-exact native planning evidence before mutation", async (t) => {
  const cases = [
    ["operation", (f) => { f.operationInProgress = true; }, /no Git operation/],
    ["tracked dirt", (f) => { f.trackedStatus = " M code.txt"; }, /without staged or tracked changes/],
    ["upstream drift", (f) => { f.upstreamHead = "f".repeat(40); }, /code HEAD to equal its upstream/],
    ["canonical ID drift", (f) => { f.resolvedId = "BEADS-43-full"; }, /exact requested canonical ID/],
    ["placeholder design", (f) => { Object.defineProperty(f.dependencies, "providerTaskResolver", { value: () => ({ provider: "beads", taskId: f.taskId, title: "Provider-native admission fixture", nativeStatus: "in_planning", status: "In Planning", projectRoot: f.root, nativeView: { id: f.taskId, title: "Provider-native admission fixture", status: "in_planning", design: "TODO: write the implementation plan" } }) }); }, /meaningful provider-native design/],
  ];
  for (const [name, arrange, message] of cases) {
    await t.test(name, async () => {
      const f = fixture();
      arrange(f);
      await assert.rejects(create(f), message);
      assert.deepEqual(f.statusCalls, []);
      assert.equal(f.reservationCalls.length, 0);
      assert.equal(f.allocatorCalls, 0);
      assert.equal(f.ownership.read(f.root, "owner-session"), null);
    });
  }
});

test("Beads admission surfaces raw review-required publication evidence without recovery or retry", async () => {
  const f = fixture();
  f.publicationOverride = () => ({
    status: "review-required",
    code: "concurrent-advance",
    phase: "synchronization",
    detail: "human review required",
    evidence: { provider: "beads", projectRoot: f.root, taskId: f.taskId, raw_marker: "retain-this-verbatim" },
  });
  await assert.rejects(create(f), /raw_marker.*retain-this-verbatim/);
  assert.deepEqual(f.statusCalls, ["In Progress"]);
  assert.equal(f.reservationCalls.length, 0);
  assert.equal(f.allocatorCalls, 0);
  assert.equal(f.ownership.read(f.root, "owner-session"), null);
  assert.equal(f.status, "In Planning");
});

test("Beads admission rolls a published task back to In Planning before durable reservation or resources", async () => {
  const f = fixture();
  f.reservationFailure = new Error("reservation rejected before write");
  await assert.rejects(create(f), /returned to In Planning.*reservation rejected before write/);
  assert.deepEqual(f.statusCalls, ["In Progress", "In Planning"]);
  assert.equal(f.status, "In Planning");
  assert.equal(f.ownership.read(f.root, "owner-session"), null);
  assert.equal(f.allocatorCalls, 0);
});

test("Beads post-reservation failure publishes Blocked and advances only same-owner provider evidence", async () => {
  const f = fixture();
  f.allocationMutator = (reserved) => f.ownership.write(f.root, {
    ...reserved,
    status: "uncertain",
    worktreeName: "retained-worktree",
    worktree: join(f.root, "retained-worktree"),
    branch: "episode/retained",
    head: reserved.baseRef,
    uncertaintyReason: "session allocation outcome unknown",
  });
  f.allocationFailure = new Error("session allocation outcome unknown");

  await assert.rejects(create(f), /is Blocked with advanced ownership evidence.*session allocation outcome unknown/);
  const retained = f.ownership.read(f.root, "owner-session");
  assert.deepEqual(f.statusCalls, ["In Progress", "Blocked"]);
  assert.equal(f.status, "Blocked");
  assert.equal(retained.provider, "beads");
  assert.equal(retained.status, "uncertain");
  assert.equal(retained.operationId, "beads-operation");
  assert.equal(retained.baseRef, git(f.root, "rev-parse", "HEAD"));
  assert.equal(retained.worktreeName, "retained-worktree");
  assert.equal(retained.worktree, join(f.root, "retained-worktree"));
  assert.equal(retained.branch, "episode/retained");
  assert.equal(retained.providerRevision, revision.Blocked);
  assert.equal(retained.taskEvidence.status, "blocked");
  assert.equal(retained.taskEvidence.design, f.design);
});

test("Beads pre-reservation recovery rolls back despite tracked drift after In Progress publication", async () => {
  const f = fixture();
  f.publicationMutator = (requested) => {
    if (requested === "In Progress") f.trackedStatus = " M code.txt";
  };

  await assert.rejects(create(f), /returned to In Planning.*without staged or tracked changes/);
  assert.deepEqual(f.statusCalls, ["In Progress", "In Planning"]);
  assert.equal(f.status, "In Planning");
  assert.equal(f.reservationCalls.length, 0);
  assert.equal(f.ownership.read(f.root, "owner-session"), null);
  assert.equal(f.allocatorCalls, 0);
});

test("Beads post-reservation recovery publishes Blocked despite later tracked drift", async () => {
  const f = fixture();
  const codeHead = git(f.root, "rev-parse", "HEAD");
  f.allocationMutator = () => { f.trackedStatus = " M code.txt"; };
  f.allocationFailure = new Error("allocation failed after tracked drift");

  await assert.rejects(create(f), /is Blocked with advanced ownership evidence.*allocation failed after tracked drift/);
  const retained = f.ownership.read(f.root, "owner-session");
  assert.deepEqual(f.statusCalls, ["In Progress", "Blocked"]);
  assert.equal(f.status, "Blocked");
  assert.equal(f.reservationCalls.length, 1);
  assert.equal(retained.provider, "beads");
  assert.equal(retained.status, "provisioning");
  assert.equal(retained.taskId, f.taskId);
  assert.equal(retained.ownerSessionId, "owner-session");
  assert.equal(retained.baseRef, codeHead);
  assert.equal(retained.providerRevision, revision.Blocked);
  assert.equal(retained.taskEvidence.status, "blocked");
  assert.equal(f.allocatorCalls, 1);
});

test("Beads raw same-task drift before reservation surfaces both views and rolls back once", async () => {
  const f = fixture();
  const changedDesign = `1. Outside writer changed the plan.\n2. ${"x".repeat(1200)} raw-live-tail-marker`;
  const unrelatedAdvance = {
    ...f.unrelatedTask,
    revision: "unrelated-after",
    comments: [{ id: 99, text: "outside unrelated advance" }],
  };
  f.publicationMutator = (requested) => {
    if (requested === "In Progress") {
      f.liveDesign = changedDesign;
      f.unrelatedTask = unrelatedAdvance;
    }
  };

  await assert.rejects(create(f), (error) => {
    assert.match(error.message, /returned to In Planning/);
    assert.match(error.message, /published native view/);
    assert.match(error.message, /live native view/);
    assert.ok(error.message.includes("Publish one exact task"));
    assert.ok(error.message.includes("Outside writer changed the plan"));
    assert.ok(error.message.includes("raw-live-tail-marker"));
    return true;
  });
  assert.deepEqual(f.statusCalls, ["In Progress", "In Planning"]);
  assert.equal(f.status, "In Planning");
  assert.equal(f.reservationCalls.length, 0);
  assert.equal(f.ownership.read(f.root, "owner-session"), null);
  assert.equal(f.allocatorCalls, 0);
  assert.deepEqual(f.unrelatedTask, unrelatedAdvance);
});

test("Beads Blocked recovery preserves ownership and raw review evidence when publication is not proven", async () => {
  const f = fixture();
  f.allocationFailure = new Error("allocation failed after reservation");
  let publications = 0;
  f.publicationOverride = (requested) => {
    publications += 1;
    if (requested === "In Progress") {
      f.status = "In Progress";
      return published(f.root, f.taskId, "In Progress", f.design);
    }
    return {
      status: "review-required",
      code: "push-rejected",
      phase: "push",
      detail: "retain recovery evidence",
      evidence: { provider: "beads", projectRoot: f.root, taskId: f.taskId, raw_marker: "blocked-recovery-raw" },
    };
  };

  await assert.rejects(create(f), /blocked-recovery-raw/);
  const retained = f.ownership.read(f.root, "owner-session");
  assert.equal(publications, 2);
  assert.equal(retained.providerRevision, revision["In Progress"]);
  assert.equal(retained.taskEvidence.status, "in_progress");
  assert.equal(retained.status, "provisioning");
});
