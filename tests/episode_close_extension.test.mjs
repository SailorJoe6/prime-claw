import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { closeEpisodeOwnership } from "../src/prime-agent-plugin/extension-support/episode-close.ts";
import { readEpisodeOwnership, writeEpisodeOwnership } from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";
import { reconcileLegacySpecificationInventory } from "../src/prime-agent-plugin/extension-support/legacy-specification-inventory.ts";

function fixture(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), "prime-claw-close-")); execFileSync("git", ["init", "-q", root]);
  const record = {
    version: 1, status: "active", operationId: "op", engine: "local", ownerSessionId: "owner",
    sourceLocation: ".ralph/plans/future/alpha", slug: "alpha", baseRef: "base", bundleDigest: "0".repeat(64),
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    worktree: join(root, "wt"), branch: "branch", head: "head", episodeId: "episode",
    episodeSessionFile: join(root, "episode.jsonl"), episodeActiveSessionId: "route", ...overrides,
  };
  writeEpisodeOwnership(root, record);
  if (record.worktree) {
    const plans = join(record.worktree, ".ralph", "plans"); mkdirSync(plans, { recursive: true });
    writeFileSync(join(plans, "SPECIFICATION.md"), "spec\n");
    writeFileSync(join(plans, "EXECUTION_PLAN.md"), "plan\n");
  }
  reconcileLegacySpecificationInventory(root, "initialize");
  const ctx = { cwd: root, sessionManager: { getSessionId: () => "owner" } };
  return { root, record, ctx };
}

test("close changes only the exact owner's bookkeeping to inactive", () => {
  const f = fixture();
  const other = {
    ...f.record,
    ownerSessionId: "other-owner",
    operationId: "other-operation",
    sourceLocation: ".ralph/plans/future/beta",
    slug: "beta",
    worktree: join(f.root, "other-wt"),
    branch: "other-branch",
    episodeId: "other-episode",
    episodeSessionFile: join(f.root, "other-episode.jsonl"),
  };
  writeEpisodeOwnership(f.root, other);
  const result = closeEpisodeOwnership(f.record.sourceLocation, f.ctx);
  assert.equal(result.reused, false); assert.equal(result.record.status, "inactive");
  assert.equal(readEpisodeOwnership(f.root, "owner").episodeId, "episode");
  assert.equal(readEpisodeOwnership(f.root, "owner").status, "inactive");
  assert.equal(readEpisodeOwnership(f.root, "other-owner").status, "active");
});

test("identical close replay is idempotent", () => {
  const f = fixture({ status: "inactive" }); const result = closeEpisodeOwnership(f.record.sourceLocation, f.ctx);
  assert.equal(result.reused, true); assert.equal(result.record.status, "inactive");
});

test("active close rejects a changed frozen specification while inactive replay stays idempotent", () => {
  const active = fixture();
  writeFileSync(join(active.record.worktree, ".ralph", "plans", "SPECIFICATION.md"), "changed\n");
  assert.throws(() => closeEpisodeOwnership(active.record.sourceLocation, active.ctx), /changed after grandfathering/);
  assert.equal(readEpisodeOwnership(active.root, "owner").status, "active");

  const inactive = fixture({ status: "inactive" });
  writeFileSync(join(inactive.record.worktree, ".ralph", "plans", "SPECIFICATION.md"), "changed after close\n");
  assert.equal(closeEpisodeOwnership(inactive.record.sourceLocation, inactive.ctx).reused, true);
});

test("close rejects owner and location mismatches", () => {
  const f = fixture();
  assert.throws(() => closeEpisodeOwnership(".ralph/plans/future/beta", f.ctx), /location does not match/);
  f.ctx.sessionManager.getSessionId = () => "other";
  assert.throws(() => closeEpisodeOwnership(f.record.sourceLocation, f.ctx), /ownership is missing/);
});

test("close refuses provisioning or uncertain state", () => {
  for (const status of ["provisioning", "uncertain"]) {
    const f = fixture({ status, worktree: undefined, branch: undefined, head: undefined, episodeId: undefined, episodeSessionFile: undefined });
    assert.throws(() => closeEpisodeOwnership(f.record.sourceLocation, f.ctx), new RegExp(status));
  }
});
