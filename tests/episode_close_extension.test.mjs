import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { closeEpisodeOwnership } from "../src/prime-agent-plugin/extension-support/episode-close.ts";
import { readEpisodeOwnership, writeEpisodeOwnership } from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";

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
  const ctx = { cwd: root, sessionManager: { getSessionId: () => "owner" } };
  return { root, record, ctx };
}

test("close changes only exact ownership bookkeeping to inactive", () => {
  const f = fixture(); const result = closeEpisodeOwnership(f.record.sourceLocation, f.ctx);
  assert.equal(result.reused, false); assert.equal(result.record.status, "inactive");
  assert.equal(readEpisodeOwnership(f.root).episodeId, "episode");
});

test("identical close replay is idempotent", () => {
  const f = fixture({ status: "inactive" }); const result = closeEpisodeOwnership(f.record.sourceLocation, f.ctx);
  assert.equal(result.reused, true); assert.equal(result.record.status, "inactive");
});

test("close rejects owner and location mismatches", () => {
  const f = fixture();
  assert.throws(() => closeEpisodeOwnership(".ralph/plans/future/beta", f.ctx), /location does not match/);
  f.ctx.sessionManager.getSessionId = () => "other";
  assert.throws(() => closeEpisodeOwnership(f.record.sourceLocation, f.ctx), /owner mismatch/);
});

test("close refuses provisioning or uncertain state", () => {
  for (const status of ["provisioning", "uncertain"]) {
    const f = fixture({ status, worktree: undefined, branch: undefined, head: undefined, episodeId: undefined, episodeSessionFile: undefined });
    assert.throws(() => closeEpisodeOwnership(f.record.sourceLocation, f.ctx), new RegExp(status));
  }
});
