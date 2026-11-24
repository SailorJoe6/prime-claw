import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { ProcessCommandRunner } from "./project-initialization.ts";

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

const RUNNER = new ProcessCommandRunner();
const OID = /^[0-9a-f]{40}$/;
const WINDOW = 4096;
const gitArgs = (root: string) => ["--no-replace-objects", "-C", root];

function metadata(root: string, args: string[], failure: string): string {
  const result = RUNNER.run("git", [...gitArgs(root), ...args], { allowFailure: true });
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

function blobFor(selected: SelectedBacklogRepository, evidence: BacklogGitEvidence): string {
  const actual = repository(selected);
  if (evidence.kind !== "backlog-git" || actual.topology !== evidence.repository.topology
      || actual.identity !== evidence.repository.identity) {
    throw new Error("Backlog evidence repository mismatch");
  }
  if (!OID.test(evidence.commit) || !evidence.path.endsWith(".md") || /[\0\r\n\\]/.test(evidence.path)
      || evidence.path.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error("Backlog evidence requires a full commit and literal repository-relative ticket path");
  }
  const root = selected.root;
  if (metadata(root, ["cat-file", "-t", evidence.commit], "Backlog evidence commit unavailable").trim() !== "commit") {
    throw new Error("Backlog evidence OID is not a commit");
  }
  const entry = metadata(root, ["--literal-pathspecs", "ls-tree", "-z", evidence.commit, "--", evidence.path],
    "Backlog evidence tree unavailable");
  const match = /^100(?:644|755) blob ([0-9a-f]{40})\t/.exec(entry);
  if (!match || entry.slice(match[0].length) !== `${evidence.path}\0`) {
    throw new Error("Backlog evidence path is not an exact regular ticket blob");
  }
  return match[1];
}

/** Read a literal byte window, including within arbitrarily long lines. No cached content. */
export async function readBacklogGitEvidence(
  selected: SelectedBacklogRepository, evidence: BacklogGitEvidence, taskId: string, offset = 0,
): Promise<{ bytes: Buffer; totalBytes: number }> {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid Backlog evidence byte offset");
  const blob = blobFor(selected, evidence);
  const child = spawn("git", [...gitArgs(selected.root), "cat-file", "blob", blob], { stdio: ["ignore", "pipe", "ignore"] });
  const exited = new Promise<boolean>(resolve => {
    child.once("error", () => resolve(false));
    child.once("close", code => resolve(code === 0));
  });
  const prefix = Buffer.alloc(WINDOW);
  const bytes = Buffer.alloc(WINDOW);
  let totalBytes = 0;
  let length = 0;
  for await (const chunk of child.stdout) {
    if (totalBytes < WINDOW) chunk.copy(prefix, totalBytes, 0, WINDOW - totalBytes);
    const start = Math.max(0, offset - totalBytes);
    if (start < chunk.length && length < WINDOW) length += chunk.copy(bytes, length, start, start + WINDOW - length);
    totalBytes += chunk.length;
  }
  if (!await exited) throw new Error("Backlog evidence ticket blob unavailable");
  // Native Backlog writes the canonical ID immediately after the opening delimiter.
  // Do not match an ID in the Markdown body or reconstruct the native task view.
  const id = /^---\r?\nid: ([A-Za-z0-9][A-Za-z0-9_.-]*)\r?\n/.exec(prefix.toString("utf8"))?.[1];
  if (id !== taskId || id === undefined) throw new Error("Backlog evidence canonical task ID mismatch");
  return { bytes: bytes.subarray(0, length), totalBytes };
}

export async function makeBacklogGitEvidence(
  selected: SelectedBacklogRepository, commit: string, path: string, taskId: string,
): Promise<BacklogGitEvidence> {
  const evidence: BacklogGitEvidence = { kind: "backlog-git", repository: repository(selected), commit, path };
  await readBacklogGitEvidence(selected, evidence, taskId);
  return evidence;
}
