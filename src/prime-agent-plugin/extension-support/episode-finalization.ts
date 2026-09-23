import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { PrimeSessionPublisher, type EpisodeIdentity, type SessionSummary } from "./spec-episode.ts";
import type { OversightDisposition, OversightMarker } from "./conversation-oversight.ts";

const SAFE_LOCATION = /^\.ralph\/plans\/future\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const RECEIPT_VERSION = 1;

export type FinalizationReceipt = {
  version: 1;
  sourceLocation: string;
  slug: string;
  disposition: OversightDisposition;
  ownerSessionId: string;
  episodeId: string;
  episodeSessionFile: string;
  branch: string;
  worktree: string;
  episodeCommit: string;
  authorizedAt: string;
};

export interface FinalizationDependencies {
  listSessions(): Promise<SessionSummary[]>;
  close(): void;
  repositoryRoot(cwd: string): string;
  worktrees(repo: string): Array<{ path: string; branch?: string }>;
  revParse(repo: string, ref: string): string;
  isAncestor(repo: string, ancestor: string, descendant: string): boolean;
  exists(path: string): boolean;
  readJson(path: string): unknown;
  writeJson(path: string, value: unknown): void;
  remove(path: string): void;
}

class NativeFinalizationDependencies implements FinalizationDependencies {
  private publisher = new PrimeSessionPublisher();
  listSessions() { return this.publisher.list(); }
  close() { this.publisher.close(); }
  repositoryRoot(cwd: string) {
    return execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  }
  worktrees(repo: string) {
    const out = execFileSync("git", ["-C", repo, "worktree", "list", "--porcelain"], { encoding: "utf8" });
    const entries: Array<{ path: string; branch?: string }> = [];
    let current: { path: string; branch?: string } | undefined;
    for (const line of out.split("\n")) {
      if (line.startsWith("worktree ")) { current = { path: line.slice(9) }; entries.push(current); }
      else if (current && line.startsWith("branch refs/heads/")) current.branch = line.slice(18);
    }
    return entries;
  }
  revParse(repo: string, ref: string) {
    return execFileSync("git", ["-C", repo, "rev-parse", ref], { encoding: "utf8" }).trim();
  }
  isAncestor(repo: string, ancestor: string, descendant: string) {
    try { execFileSync("git", ["-C", repo, "merge-base", "--is-ancestor", ancestor, descendant]); return true; }
    catch { return false; }
  }
  exists(path: string) { return existsSync(path); }
  readJson(path: string) { return JSON.parse(readFileSync(path, "utf8")); }
  writeJson(path: string, value: unknown) {
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${process.pid}`;
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporary, path);
  }
  remove(path: string) { rmSync(path, { force: true }); }
}

function paths(repo: string, slug: string) {
  const base = resolve(repo, ".prime", "agent", "state", "spec-episodes", slug);
  return { identity: `${base}.json`, receipt: `${base}.finalization.json` };
}
function parseLocation(cwd: string, raw: string, deps: FinalizationDependencies) {
  const sourceLocation = raw.trim();
  const match = SAFE_LOCATION.exec(sourceLocation);
  if (!match) throw new Error("Invalid future-plan folder location");
  const repo = deps.repositoryRoot(cwd);
  return { sourceLocation, slug: match[1], repo, ...paths(repo, match[1]) };
}
function identity(value: unknown): EpisodeIdentity {
  if (!value || typeof value !== "object") throw new Error("Episode identity is missing or corrupt");
  return value as EpisodeIdentity;
}
function receipt(value: unknown): FinalizationReceipt {
  const data = value as Partial<FinalizationReceipt> | null;
  if (
    !data || data.version !== RECEIPT_VERSION
    || (data.disposition !== "merged" && data.disposition !== "abandoned")
    || [data.sourceLocation, data.slug, data.ownerSessionId, data.episodeId,
      data.episodeSessionFile, data.branch, data.worktree, data.episodeCommit,
      data.authorizedAt].some((field) => typeof field !== "string" || !field)
  ) throw new Error("Finalization receipt is missing or corrupt");
  return data as FinalizationReceipt;
}
function assertExactOwner(record: EpisodeIdentity, ctx: ExtensionContext, sourceLocation: string): void {
  if (record.ownerSessionId !== ctx.sessionManager.getSessionId()) throw new Error("Episode finalization owner mismatch");
  if (record.sourceLocation !== sourceLocation) throw new Error("Episode finalization location mismatch");
}
function samePath(a: string | undefined, b: string): boolean {
  return typeof a === "string" && resolve(a) === resolve(b);
}

export async function authorizeEpisodeFinalization(
  rawLocation: string,
  disposition: OversightDisposition,
  ctx: ExtensionContext,
  confirm: (title: string, message: string) => Promise<boolean>,
  supplied?: FinalizationDependencies,
): Promise<{ receipt: FinalizationReceipt; reused: boolean }> {
  const deps = supplied ?? new NativeFinalizationDependencies();
  try {
    if (disposition !== "merged" && disposition !== "abandoned") throw new Error("Disposition must be merged or abandoned");
    const selected = parseLocation(ctx.cwd, rawLocation, deps);
    const record = identity(deps.readJson(selected.identity));
    assertExactOwner(record, ctx, selected.sourceLocation);
    if (deps.exists(selected.receipt)) {
      const existing = receipt(deps.readJson(selected.receipt));
      if (
        existing.ownerSessionId !== record.ownerSessionId || existing.episodeId !== record.episodeId
        || existing.sourceLocation !== selected.sourceLocation || existing.disposition !== disposition
        || existing.episodeSessionFile !== record.episodeSessionFile || existing.branch !== record.branch
        || existing.worktree !== record.worktree
      ) throw new Error("A different terminal authorization receipt already exists");
      return { receipt: existing, reused: true };
    }
    const approved = await confirm(
      `Authorize ${disposition} episode finalization?`,
      `Record the operator decision for ${selected.sourceLocation}. This performs no Git, session, worktree, branch, or cleanup mutation.`,
    );
    if (!approved) throw new Error("Episode finalization authorization was cancelled");
    const value: FinalizationReceipt = {
      version: RECEIPT_VERSION,
      sourceLocation: selected.sourceLocation,
      slug: selected.slug,
      disposition,
      ownerSessionId: record.ownerSessionId,
      episodeId: record.episodeId,
      episodeSessionFile: record.episodeSessionFile,
      branch: record.branch,
      worktree: record.worktree,
      episodeCommit: deps.revParse(selected.repo, record.branch),
      authorizedAt: new Date().toISOString(),
    };
    deps.writeJson(selected.receipt, value);
    return { receipt: value, reused: false };
  } finally { deps.close(); }
}

export async function completeEpisodeFinalization(
  rawLocation: string,
  disposition: OversightDisposition,
  ctx: ExtensionContext,
  appendTransition: (status: "inactive" | "active", marker: OversightMarker) => void,
  marker: OversightMarker,
  supplied?: FinalizationDependencies,
): Promise<FinalizationReceipt> {
  const deps = supplied ?? new NativeFinalizationDependencies();
  let selected: ReturnType<typeof parseLocation> | undefined;
  let record: EpisodeIdentity | undefined;
  let authorization: FinalizationReceipt | undefined;
  try {
    selected = parseLocation(ctx.cwd, rawLocation, deps);
    record = identity(deps.readJson(selected.identity));
    assertExactOwner(record, ctx, selected.sourceLocation);
    authorization = receipt(deps.readJson(selected.receipt));
    if (
      authorization.disposition !== disposition || authorization.ownerSessionId !== record.ownerSessionId
      || authorization.episodeId !== record.episodeId || authorization.sourceLocation !== selected.sourceLocation
      || authorization.episodeSessionFile !== record.episodeSessionFile
      || authorization.branch !== record.branch || authorization.worktree !== record.worktree
    ) throw new Error("Finalization receipt does not match the exact owned episode");
    if (marker.status !== "active" || marker.ownerSessionId !== record.ownerSessionId || marker.episodeId !== record.episodeId) {
      throw new Error("Active oversight marker does not match the finalization receipt");
    }
    const sessions = await deps.listSessions();
    const live = sessions.find((session) => session.sessionId === record!.episodeId
      && samePath(session.sessionFile, record!.episodeSessionFile)
      && (session.isSessionActive === true || typeof session.activeSessionId === "string"));
    if (live) throw new Error("Episode session is still active or addressable");
    if (deps.exists(record.worktree) || deps.worktrees(selected.repo).some((entry) => samePath(entry.path, record!.worktree))) {
      throw new Error("Episode worktree is still present");
    }
    const head = deps.revParse(selected.repo, "HEAD");
    const merged = deps.isAncestor(selected.repo, authorization.episodeCommit, head);
    if (disposition === "merged" && !merged) throw new Error("Authorized episode commit is not merged into the current branch");
    if (disposition === "abandoned" && merged) throw new Error("Abandoned episode commit is already merged into the current branch");

    appendTransition("inactive", marker);
    try {
      deps.remove(selected.identity);
      deps.remove(selected.receipt);
    } catch (error) {
      deps.writeJson(selected.identity, record);
      deps.writeJson(selected.receipt, authorization);
      appendTransition("active", marker);
      throw new Error(`Finalization state could not be cleared; active state was restored: ${error instanceof Error ? error.message : String(error)}`);
    }
    return authorization;
  } finally { deps.close(); }
}
