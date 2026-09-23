import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { PrimeSessionPublisher, parseEpisodeIdentity, type EpisodeIdentity, type SessionSummary } from "./spec-episode.ts";
import type { OversightDisposition, OversightMarker } from "./conversation-oversight.ts";

const SAFE_LOCATION = /^\.ralph\/plans\/future\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const RECEIPT_VERSION = 2;
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export type FinalizationState = "authorized" | "completing" | "completed";

export type FinalizationReceipt = {
  version: 2;
  state: FinalizationState;
  sourceLocation: string;
  slug: string;
  disposition: OversightDisposition;
  ownerSessionId: string;
  episodeId: string;
  episodeActiveSessionId: string;
  episodeSessionFile: string;
  episodeBranch: string;
  episodeWorktree: string;
  sessionName: string;
  identityVersion: 1 | 2;
  admission: string;
  episodeCommit: string;
  targetBranch: string;
  targetRef: string;
  targetCommitAtAuthorization: string;
  authorizedAt: string;
  completingAt?: string;
  completedAt?: string;
};

export interface FinalizationDependencies {
  listSessions(): Promise<SessionSummary[]>;
  close(): void;
  repositoryRoot(cwd: string): string;
  worktrees(repo: string): Array<{ path: string; branch?: string }>;
  currentBranch(repo: string): string;
  commit(repo: string, ref: string): string;
  isAncestor(repo: string, ancestor: string, descendant: string): boolean;
  exists(path: string): boolean;
  readJson(path: string): unknown;
  writeJson(path: string, value: unknown): void;
  remove(path: string): void;
  now(): string;
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
  currentBranch(repo: string) {
    try {
      const branch = execFileSync("git", ["-C", repo, "symbolic-ref", "--quiet", "--short", "HEAD"], { encoding: "utf8" }).trim();
      if (!branch) throw new Error("empty branch");
      return branch;
    } catch (error) {
      throw new Error(`Finalization requires an attached target branch: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  commit(repo: string, ref: string) {
    const value = execFileSync("git", ["-C", repo, "rev-parse", "--verify", `${ref}^{commit}`], { encoding: "utf8" }).trim();
    if (!OBJECT_ID.test(value)) throw new Error(`Git ref ${ref} did not resolve to a commit object`);
    return value;
  }
  isAncestor(repo: string, ancestor: string, descendant: string) {
    try {
      execFileSync("git", ["-C", repo, "merge-base", "--is-ancestor", ancestor, descendant], { stdio: "pipe" });
      return true;
    } catch (error) {
      if (typeof error === "object" && error !== null && "status" in error && error.status === 1) return false;
      throw new Error(`Git ancestry check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
  now() { return new Date().toISOString(); }
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
  return parseEpisodeIdentity(value, "episode identity");
}
function nonempty(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
export function parseFinalizationReceipt(value: unknown): FinalizationReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Finalization receipt is missing or corrupt");
  const data = value as Record<string, unknown>;
  const state = data.state;
  const baseKeys = ["version", "state", "sourceLocation", "slug", "disposition", "ownerSessionId", "episodeId",
    "episodeActiveSessionId", "episodeSessionFile", "episodeBranch", "episodeWorktree", "sessionName", "identityVersion", "admission",
    "episodeCommit", "targetBranch", "targetRef",
    "targetCommitAtAuthorization", "authorizedAt"];
  const allowed = new Set([...baseKeys, ...(state === "completing" || state === "completed" ? ["completingAt"] : []),
    ...(state === "completed" ? ["completedAt"] : [])]);
  if (
    data.version !== RECEIPT_VERSION
    || (state !== "authorized" && state !== "completing" && state !== "completed")
    || (data.disposition !== "merged" && data.disposition !== "abandoned")
    || baseKeys.slice(2).filter((key) => !["disposition", "identityVersion"].includes(key)).some((key) => !nonempty(data[key]))
    || (data.identityVersion !== 1 && data.identityVersion !== 2)
    || data.sourceLocation !== `.ralph/plans/future/${data.slug}`
    || data.episodeBranch !== `episode/${data.slug}` || data.sessionName !== `${data.slug}-episode`
    || (data.identityVersion === 1
      ? !["pending", "uncertain", "delivered"].includes(String(data.admission))
      : !["handoff-pending", "handoff-uncertain", "execute-pending", "execute-rejected", "execute-uncertain", "delivered"].includes(String(data.admission)))
    || [...Object.keys(data)].some((key) => !allowed.has(key))
    || [...allowed].some((key) => !(key in data))
    || !OBJECT_ID.test(String(data.episodeCommit))
    || !OBJECT_ID.test(String(data.targetCommitAtAuthorization))
    || data.targetRef !== `refs/heads/${data.targetBranch}`
  ) throw new Error("Finalization receipt is missing or corrupt");
  return data as unknown as FinalizationReceipt;
}
function assertExactOwner(record: EpisodeIdentity, ctx: ExtensionContext, sourceLocation: string): void {
  if (record.ownerSessionId !== ctx.sessionManager.getSessionId()) throw new Error("Episode finalization owner mismatch");
  if (record.sourceLocation !== sourceLocation) throw new Error("Episode finalization location mismatch");
}
function samePath(a: string | undefined, b: string): boolean {
  return typeof a === "string" && resolve(a) === resolve(b);
}
function assertExactMarker(marker: OversightMarker, binding: {
  ownerSessionId: string; sourceLocation: string; slug: string; episodeId: string; episodeActiveSessionId: string;
  episodeSessionFile: string; episodeBranch?: string; branch?: string; episodeWorktree?: string; worktree?: string;
  sessionName: string; identityVersion: 1 | 2; admission: string;
}, permitted: Array<OversightMarker["status"]>): void {
  if (!marker || marker.markerVersion !== 2 || !permitted.includes(marker.status)
    || marker.ownerSessionId !== binding.ownerSessionId || marker.sourceLocation !== binding.sourceLocation
    || marker.slug !== binding.slug || marker.episodeId !== binding.episodeId
    || marker.episodeActiveSessionId !== binding.episodeActiveSessionId
    || !samePath(marker.episodeSessionFile, binding.episodeSessionFile)
    || marker.branch !== (binding.episodeBranch ?? binding.branch)
    || !samePath(marker.worktree, binding.episodeWorktree ?? binding.worktree ?? "")
    || marker.sessionName !== binding.sessionName || marker.identityVersion !== binding.identityVersion
    || marker.admission !== binding.admission) {
    throw new Error("Exact oversight marker does not match the finalization state");
  }
}
function markerBindingFromIdentity(record: EpisodeIdentity) {
  return {
    ownerSessionId: record.ownerSessionId, sourceLocation: record.sourceLocation, slug: record.slug,
    episodeId: record.episodeId, episodeActiveSessionId: record.episodeActiveSessionId,
    episodeSessionFile: record.episodeSessionFile, branch: record.branch, worktree: record.worktree,
    sessionName: record.sessionName, identityVersion: record.version,
    admission: record.version === 1 ? record.executeAdmission : record.bootstrapAdmission,
  };
}
function receiptMatchesIdentity(value: FinalizationReceipt, record: EpisodeIdentity): boolean {
  return value.ownerSessionId === record.ownerSessionId && value.episodeId === record.episodeId
    && value.sourceLocation === record.sourceLocation && value.slug === record.slug
    && value.episodeActiveSessionId === record.episodeActiveSessionId
    && samePath(value.episodeSessionFile, record.episodeSessionFile)
    && value.episodeBranch === record.branch && samePath(value.episodeWorktree, record.worktree)
    && value.sessionName === record.sessionName && value.identityVersion === record.version
    && value.admission === (record.version === 1 ? record.executeAdmission : record.bootstrapAdmission);
}
function assertRequest(value: FinalizationReceipt, sourceLocation: string, slug: string,
  disposition: OversightDisposition, ownerSessionId: string): void {
  if (value.sourceLocation !== sourceLocation || value.slug !== slug || value.disposition !== disposition
    || value.ownerSessionId !== ownerSessionId) throw new Error("A different terminal authorization receipt already exists");
}

export async function authorizeEpisodeFinalization(
  rawLocation: string,
  disposition: OversightDisposition,
  ctx: ExtensionContext,
  confirm: (title: string, message: string) => Promise<boolean>,
  marker: OversightMarker,
  supplied?: FinalizationDependencies,
): Promise<{ receipt: FinalizationReceipt; reused: boolean }> {
  const deps = supplied ?? new NativeFinalizationDependencies();
  try {
    if (disposition !== "merged" && disposition !== "abandoned") throw new Error("Disposition must be merged or abandoned");
    const selected = parseLocation(ctx.cwd, rawLocation, deps);
    if (deps.exists(selected.receipt)) {
      const existing = parseFinalizationReceipt(deps.readJson(selected.receipt));
      assertRequest(existing, selected.sourceLocation, selected.slug, disposition, ctx.sessionManager.getSessionId());
      if (existing.state === "authorized") {
        const existingIdentity = identity(deps.readJson(selected.identity));
        assertExactOwner(existingIdentity, ctx, selected.sourceLocation);
        if (!receiptMatchesIdentity(existing, existingIdentity)) throw new Error("Finalization receipt does not match the exact owned episode");
        assertExactMarker(marker, existing, ["active"]);
      } else {
        if (deps.exists(selected.identity)) {
          const existingIdentity = identity(deps.readJson(selected.identity));
          if (!receiptMatchesIdentity(existing, existingIdentity)) throw new Error("Finalization receipt does not match the exact owned episode");
        }
        assertExactMarker(marker, existing, existing.state === "completed" ? ["inactive"] : ["active", "inactive"]);
      }
      return { receipt: existing, reused: true };
    }
    const record = identity(deps.readJson(selected.identity));
    assertExactOwner(record, ctx, selected.sourceLocation);
    if (record.slug !== selected.slug) throw new Error("Episode finalization slug mismatch");
    assertExactMarker(marker, markerBindingFromIdentity(record), ["active"]);
    const targetBranch = deps.currentBranch(selected.repo);
    if (targetBranch === record.branch) throw new Error("Episode branch cannot be the finalization target branch");
    const episodeCommit = deps.commit(selected.repo, record.branch);
    const targetCommitAtAuthorization = deps.commit(selected.repo, `refs/heads/${targetBranch}`);
    const approved = await confirm(
      `Authorize ${disposition} episode finalization?`,
      `Record the operator decision for ${selected.sourceLocation}. This performs no Git, session, worktree, branch, or cleanup mutation.`,
    );
    if (!approved) throw new Error("Episode finalization authorization was cancelled");
    const value: FinalizationReceipt = {
      version: RECEIPT_VERSION, state: "authorized", sourceLocation: selected.sourceLocation, slug: selected.slug,
      disposition, ownerSessionId: record.ownerSessionId, episodeId: record.episodeId,
      episodeActiveSessionId: record.episodeActiveSessionId, episodeSessionFile: record.episodeSessionFile,
      episodeBranch: record.branch, episodeWorktree: record.worktree, sessionName: record.sessionName,
      identityVersion: record.version, admission: record.version === 1 ? record.executeAdmission : record.bootstrapAdmission,
      episodeCommit, targetBranch, targetRef: `refs/heads/${targetBranch}`, targetCommitAtAuthorization,
      authorizedAt: deps.now(),
    };
    deps.writeJson(selected.receipt, value);
    return { receipt: value, reused: false };
  } finally { deps.close(); }
}

function validateSessions(rows: unknown, authorization: FinalizationReceipt): void {
  if (!Array.isArray(rows)) throw new Error("Daemon session list is malformed");
  for (const raw of rows) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Daemon session row is malformed");
    const row = raw as SessionSummary;
    const id = nonempty(row.sessionId) ? row.sessionId : nonempty(row.id) ? row.id : undefined;
    if (!id || !nonempty(row.sessionFile)) throw new Error("Daemon session row is partial or malformed");
    const idMatch = id === authorization.episodeId;
    const pathMatch = samePath(row.sessionFile, authorization.episodeSessionFile);
    if (idMatch && pathMatch) throw new Error("Episode session is still addressable");
    if (idMatch || pathMatch) throw new Error("Daemon session row partially matches the episode identity");
  }
}
function validateWorktrees(rows: unknown, authorization: FinalizationReceipt): void {
  if (!Array.isArray(rows)) throw new Error("Git worktree list is malformed");
  for (const raw of rows) {
    if (!raw || typeof raw !== "object" || !nonempty((raw as { path?: unknown }).path)) throw new Error("Git worktree row is malformed");
    const row = raw as { path: string; branch?: unknown };
    if (row.branch !== undefined && !nonempty(row.branch)) throw new Error("Git worktree row is malformed");
    if (samePath(row.path, authorization.episodeWorktree) || row.branch === authorization.episodeBranch) {
      throw new Error("Episode worktree is still present or addressable");
    }
  }
}
async function validateTerminalFacts(selected: ReturnType<typeof parseLocation>, authorization: FinalizationReceipt,
  disposition: OversightDisposition, deps: FinalizationDependencies): Promise<void> {
  if (deps.currentBranch(selected.repo) !== authorization.targetBranch) throw new Error("Finalization target branch mismatch");
  const episodeTip = deps.commit(selected.repo, authorization.episodeBranch);
  if (episodeTip !== authorization.episodeCommit) throw new Error("Episode branch advanced after authorization");
  const authorizedEpisodeCommit = deps.commit(selected.repo, authorization.episodeCommit);
  if (authorizedEpisodeCommit !== authorization.episodeCommit) throw new Error("Authorized episode commit is corrupt");
  const originalTargetCommit = deps.commit(selected.repo, authorization.targetCommitAtAuthorization);
  if (originalTargetCommit !== authorization.targetCommitAtAuthorization) throw new Error("Authorized target commit is corrupt");
  const targetTip = deps.commit(selected.repo, authorization.targetRef);
  if (!deps.isAncestor(selected.repo, authorization.targetCommitAtAuthorization, targetTip)) {
    throw new Error("Finalization target branch no longer descends from the authorized target commit");
  }
  const merged = deps.isAncestor(selected.repo, authorization.episodeCommit, targetTip);
  if (disposition === "merged" && !merged) throw new Error("Authorized episode commit is not merged into the target branch");
  if (disposition === "abandoned" && merged) throw new Error("Abandoned episode commit is already merged into the target branch");
  validateSessions(await deps.listSessions(), authorization);
  if (deps.exists(authorization.episodeWorktree)) throw new Error("Episode worktree is still present");
  validateWorktrees(deps.worktrees(selected.repo), authorization);
}

export async function completeEpisodeFinalization(
  rawLocation: string,
  disposition: OversightDisposition,
  ctx: ExtensionContext,
  appendTransition: (status: "inactive", marker: OversightMarker) => void,
  marker: OversightMarker,
  supplied?: FinalizationDependencies,
): Promise<FinalizationReceipt> {
  const deps = supplied ?? new NativeFinalizationDependencies();
  try {
    if (disposition !== "merged" && disposition !== "abandoned") throw new Error("Disposition must be merged or abandoned");
    const selected = parseLocation(ctx.cwd, rawLocation, deps);
    let authorization = parseFinalizationReceipt(deps.readJson(selected.receipt));
    assertRequest(authorization, selected.sourceLocation, selected.slug, disposition, ctx.sessionManager.getSessionId());
    if (authorization.state === "completed") {
      assertExactMarker(marker, authorization, ["inactive"]);
      return authorization;
    }
    if (deps.exists(selected.identity)) {
      const record = identity(deps.readJson(selected.identity));
      assertExactOwner(record, ctx, selected.sourceLocation);
      if (!receiptMatchesIdentity(authorization, record)) throw new Error("Finalization receipt does not match the exact owned episode");
    } else if (authorization.state === "authorized") {
      throw new Error("Episode identity is missing before completion began");
    }
    assertExactMarker(marker, authorization, authorization.state === "authorized" ? ["active"] : ["active", "inactive"]);
    await validateTerminalFacts(selected, authorization, disposition, deps);

    if (authorization.state === "authorized") {
      authorization = { ...authorization, state: "completing", completingAt: deps.now() };
      deps.writeJson(selected.receipt, authorization);
    }
    if (marker.status === "active") appendTransition("inactive", { ...marker, status: "inactive" });
    deps.remove(selected.identity);
    const completed: FinalizationReceipt = { ...authorization, state: "completed", completedAt: deps.now() };
    deps.writeJson(selected.receipt, completed);
    return completed;
  } catch (error) {
    throw new Error(`Finalization is blocked with durable recovery evidence preserved: ${error instanceof Error ? error.message : String(error)}`);
  } finally { deps.close(); }
}
