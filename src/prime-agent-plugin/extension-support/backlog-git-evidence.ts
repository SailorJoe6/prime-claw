import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, createReadStream, mkdirSync, mkdtempSync, openSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProcessCommandRunner } from "./project-initialization.ts";
import { readBacklogHeaderIdentity } from "./backlog-creation-identity.ts";

/** Factual evidence only, never a store selection or publication decision. */
export interface BacklogGitEvidence {
  kind: "backlog-git";
  repository: { topology: "independent" | "branch-local"; identity: string };
  commit: string;
  path: string;
}

/** Supplied by the existing lifecycle workspace/publication checks, not by the evidence. */
export interface SelectedBacklogRepository {
  root: string;
  topology: BacklogGitEvidence["repository"]["topology"];
  /** Null is only for an already authorized unpublished local-only repository. */
  remote: string | null;
}

let runner: ProcessCommandRunner | undefined;
const OID = /^[0-9a-f]{40}$/;
const WINDOW = 4096;
const HEADER_END = Buffer.from("\n---");
const gitArgs = (root: string) => ["--no-replace-objects", "-C", root];

function metadata(root: string, args: string[], failure: string): string {
  const result = (runner ??= new ProcessCommandRunner()).run("git", [...gitArgs(root), ...args], { allowFailure: true });
  if (result.status !== 0) throw new Error(failure);
  return result.stdout;
}

function repository(selected: SelectedBacklogRepository): BacklogGitEvidence["repository"] {
  const root = realpathSync(selected.root);
  const gitRoot = metadata(root, ["rev-parse", "--show-toplevel"], "Backlog evidence repository unavailable").trimEnd();
  if (realpathSync(gitRoot) !== root) throw new Error("Backlog evidence requires the exact repository root");
  const identity = selected.remote === null
    ? `local:${realpathSync(metadata(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"], "Backlog local repository unavailable").trimEnd())}`
    : `remote:${metadata(root, ["remote", "get-url", "--", selected.remote], "Backlog evidence remote unavailable").trimEnd()}`;
  return { topology: selected.topology, identity: createHash("sha256").update(identity).digest("hex") };
}

function committedBlob(root: string, commit: string, path: string): string;
function committedBlob(root: string, commit: string, path: string, allowAbsent: true): string | undefined;
function committedBlob(root: string, commit: string, path: string, allowAbsent = false): string | undefined {
  if (!OID.test(commit) || !path.endsWith(".md") || /[\0\r\n\\]/.test(path)
      || path.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error("Backlog evidence requires a full commit and literal repository-relative ticket path");
  }
  if (metadata(root, ["cat-file", "-t", commit], "Backlog evidence commit unavailable").trim() !== "commit") {
    throw new Error("Backlog evidence OID is not a commit");
  }
  const entry = metadata(root, ["--literal-pathspecs", "ls-tree", "-z", commit, "--", path],
    "Backlog evidence tree unavailable");
  if (allowAbsent && entry === "") return undefined;
  const match = /^100(?:644|755) blob ([0-9a-f]{40})\t/.exec(entry);
  if (!match || entry.slice(match[0].length) !== `${path}\0`) {
    throw new Error("Backlog evidence path is not an exact regular ticket blob");
  }
  return match[1];
}

function blobFor(selected: SelectedBacklogRepository, evidence: BacklogGitEvidence): string {
  const actual = repository(selected);
  if (evidence.kind !== "backlog-git" || actual.topology !== evidence.repository.topology
      || actual.identity !== evidence.repository.identity) {
    throw new Error("Backlog evidence repository mismatch");
  }
  return committedBlob(selected.root, evidence.commit, evidence.path);
}

/** Reference the exact regular committed file without opening its contents.
 * The caller supplies separate native proof of the canonical task identity.
 */
export function referenceCommittedBacklogTask(
  selected: SelectedBacklogRepository, commit: string, path: string,
): BacklogGitEvidence {
  const selectedRepository = repository(selected);
  const blob = committedBlob(selected.root, commit, path);
  if (metadata(selected.root, ["cat-file", "-t", blob], "Backlog evidence ticket blob unavailable").trim() !== "blob") {
    throw new Error("Backlog evidence OID is not a ticket blob");
  }
  return { kind: "backlog-git", repository: selectedRepository, commit, path };
}

export type BacklogCommittedTaskObservation =
  | { availability: "available"; evidence: BacklogGitEvidence }
  | { availability: "absent" | "unavailable" };

/** Absence is a successful literal lookup, not a failed Git/native read. */
export async function observeCommittedBacklogTask(
  selected: SelectedBacklogRepository, commit: string, path: string, taskId: string,
  expectedRepository?: BacklogGitEvidence["repository"],
): Promise<BacklogCommittedTaskObservation> {
  try {
    const selectedRepository = repository(selected);
    if (expectedRepository && (selectedRepository.topology !== expectedRepository.topology
        || selectedRepository.identity !== expectedRepository.identity)) {
      return { availability: "unavailable" };
    }
    if (!committedBlob(selected.root, commit, path, true)) return { availability: "absent" };
    const evidence: BacklogGitEvidence = { kind: "backlog-git", repository: selectedRepository, commit, path };
    await readBacklogGitEvidence(selected, evidence, taskId);
    return { availability: "available", evidence };
  } catch {
    // Do not return command errors that may contain repository credentials or ticket content.
    return { availability: "unavailable" };
  }
}

/** Stage only the frontmatter for the existing native parser, then replay it in
 * bounded chunks. Never write the body or retain scratch as evidence. */
async function* verifiedTicketChunks(source: AsyncIterable<Buffer>, taskId: string): AsyncGenerator<Buffer> {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(taskId)) throw new Error("Invalid Backlog evidence task ID");
  const scratch = mkdtempSync(join(tmpdir(), "prime-claw-backlog-header-"));
  const filename = `${taskId.toLowerCase()} - evidence.md`;
  const path = join(scratch, "backlog", "tasks", filename);
  const input = source[Symbol.asyncIterator]();
  try {
    let remainder: Buffer | undefined;
    try {
      mkdirSync(join(scratch, "backlog", "tasks"), { recursive: true });
      const prefix = /^([a-z]+)-/i.exec(taskId)?.[1].toLowerCase() ?? "task";
      writeFileSync(join(scratch, "backlog", "config.yml"),
        `project_name: Evidence\nremote_operations: false\ncheck_active_branches: false\ntask_prefix: ${prefix}\n`);
      const file = openSync(path, "wx", 0o600);
      try {
        let opening = Buffer.alloc(0);
        let openingChecked = false;
        let tail = Buffer.alloc(0);
        for (;;) {
          const { done, value: chunk } = await input.next();
          if (done) break;
          if (!openingChecked) {
            opening = Buffer.concat([opening, chunk.subarray(0, 8 - opening.length)]);
            if (opening.length === 8) {
              if (!/^(?:\xef\xbb\xbf)?---\r?\n/.test(opening.toString("latin1"))) {
                throw new Error("Backlog evidence frontmatter has no opening delimiter");
              }
              openingChecked = true;
            }
          }
          // Only the delimiter overlap is retained between Git chunks; bytes
          // in the overlap have already been written to the scratch file.
          const scan = Buffer.concat([tail, chunk]);
          const close = scan.indexOf(HEADER_END);
          const end = close < 0 ? chunk.length : close + HEADER_END.length - tail.length;
          writeFileSync(file, chunk.subarray(0, end));
          if (close >= 0) {
            if (!openingChecked && !/^(?:\xef\xbb\xbf)?---\r?\n/.test(opening.toString("latin1"))) {
              throw new Error("Backlog evidence frontmatter has no opening delimiter");
            }
            remainder = chunk.subarray(end);
            break;
          }
          tail = Buffer.from(scan.subarray(-(HEADER_END.length - 1)));
        }
      } finally {
        closeSync(file);
      }
      if (!remainder) throw new Error("Backlog evidence frontmatter has no closing delimiter");
      const facts = await readBacklogHeaderIdentity(scratch, taskId).catch(() => undefined);
      if (facts?.path !== `backlog/tasks/${filename}`) {
        throw new Error("Backlog evidence canonical task ID mismatch or native header unavailable");
      }
      yield* createReadStream(path, { highWaterMark: WINDOW });
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
    if (remainder.length) yield remainder;
    for (;;) {
      const { done, value } = await input.next();
      if (done) break;
      yield value;
    }
  } finally {
    await input.return?.();
  }
}

/** A single forward-only Git stream. Exhaust it to check complete delivery. */
export async function* streamBacklogGitEvidence(
  selected: SelectedBacklogRepository, evidence: BacklogGitEvidence, taskId: string, offset = 0,
): AsyncGenerator<{ offset: number; bytes: Buffer; totalBytes: number }> {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid Backlog evidence byte offset");
  const root = selected.root;
  const blob = blobFor(selected, evidence);
  const size = metadata(root, ["cat-file", "-s", blob], "Backlog evidence ticket blob unavailable").trim();
  const totalBytes = Number(size);
  if (!/^\d+$/.test(size) || !Number.isSafeInteger(totalBytes)) throw new Error("Invalid Backlog evidence blob size");
  const child = spawn("git", [...gitArgs(root), "cat-file", "blob", blob], { stdio: ["ignore", "pipe", "ignore"] });
  let spawnFailed = false;
  child.once("error", () => { spawnFailed = true; });
  const exited = new Promise<boolean>(resolve => child.once("close", code => resolve(!spawnFailed && code === 0)));
  let position = 0;
  let length = 0;
  let bytes = Buffer.alloc(WINDOW);
  try {
    for await (const part of verifiedTicketChunks(child.stdout, taskId)) {
      let start = Math.min(part.length, Math.max(0, offset - position));
      position += start;
      while (start < part.length) {
        const copied = part.copy(bytes, length, start, start + WINDOW - length);
        length += copied;
        position += copied;
        start += copied;
        if (position > totalBytes) throw new Error("Backlog evidence blob size mismatch");
        if (length === WINDOW && position < totalBytes) {
          yield { offset: position - length, bytes, totalBytes };
          bytes = Buffer.alloc(WINDOW);
          length = 0;
        }
      }
    }
    if (!await exited) throw new Error("Backlog evidence ticket blob unavailable");
    if (position !== totalBytes) throw new Error("Backlog evidence blob size mismatch");
    if (length) yield { offset: position - length, bytes: bytes.subarray(0, length), totalBytes };
    else yield { offset, bytes: Buffer.alloc(0), totalBytes };
  } finally {
    // In particular, a one-window read or an early break must not drain the blob.
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
  }
}

/** A one-off literal byte window; use the stream for adjacent windows. */
export async function readBacklogGitEvidence(
  selected: SelectedBacklogRepository, evidence: BacklogGitEvidence, taskId: string, offset = 0,
): Promise<{ bytes: Buffer; totalBytes: number }> {
  const stream = streamBacklogGitEvidence(selected, evidence, taskId, offset);
  try {
    const first = (await stream.next()).value;
    if (!first) throw new Error("Backlog evidence ticket blob unavailable");
    return { bytes: first.bytes, totalBytes: first.totalBytes };
  } finally {
    await stream.return(undefined);
  }
}

export async function makeBacklogGitEvidence(
  selected: SelectedBacklogRepository, commit: string, path: string, taskId: string,
): Promise<BacklogGitEvidence> {
  const evidence: BacklogGitEvidence = { kind: "backlog-git", repository: repository(selected), commit, path };
  await readBacklogGitEvidence(selected, evidence, taskId);
  return evidence;
}
