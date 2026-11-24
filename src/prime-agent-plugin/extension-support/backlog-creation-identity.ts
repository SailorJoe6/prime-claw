import { spawn } from "node:child_process";
import { lstatSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep, win32 } from "node:path";
import { TextDecoder } from "node:util";

export interface BacklogCreationIdentity {
  id: string;
  path: string;
  status: string;
}

const invalid = () => new Error("invalid or unsupported native task-view JSON");

/** Project only the two envelope fields and three exact task fields. Other
 * strings (including one very long line) are validated and discarded in place.
 */
export async function projectBacklogCreationIdentity(chunks: AsyncIterable<Uint8Array>): Promise<BacklogCreationIdentity> {
  const source = chunks[Symbol.asyncIterator]();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let chunk = "", offset = 0, ended = false;
  async function refill() {
    while (offset === chunk.length && !ended) {
      const next = await source.next();
      ended = Boolean(next.done);
      chunk = ended ? decoder.decode() : decoder.decode(next.value, { stream: true });
      offset = 0;
    }
  }
  async function peek() {
    if (offset === chunk.length) await refill();
    return chunk[offset];
  }
  async function space() {
    while (true) {
      const c = await peek();
      if (c !== " " && c !== "\n" && c !== "\r" && c !== "\t") return;
      offset++;
    }
  }
  async function take(expected: string) {
    if (await peek() !== expected) throw invalid();
    offset++;
  }
  async function string(keep: boolean, keys?: readonly string[]): Promise<string> {
    await take('"');
    let raw = '"';
    // JSON.stringify can escape each UTF-16 unit in a known ASCII key using
    // six characters. Once a key cannot match, don't retain the rest of it.
    const keyWidth = keys ? 2 + 6 * Math.max(...keys.map(k => k.length)) : 0;
    for (;;) {
      if (offset === chunk.length) await refill();
      const c = chunk[offset++];
      if (c === undefined || c.charCodeAt(0) < 32) throw invalid();
      if (keep) raw += c;
      if (c === '"') return keep ? JSON.parse(raw) : "";
      if (c === "\\") {
        const esc = await peek();
        if (esc === undefined || !'"\\/bfnrtu'.includes(esc)) throw invalid();
        offset++;
        if (keep) raw += esc;
        if (esc === "u") for (let i = 0; i < 4; i++) {
          const digit = await peek();
          if (!digit || !/^[\da-f]$/i.test(digit)) throw invalid();
          offset++;
          if (keep) raw += digit;
        }
      }
      if (keys && raw.length >= keyWidth) { keep = false; raw = ""; }
    }
  }
  async function number() {
    const digit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
    if (await peek() === "-") offset++;
    if (await peek() === "0") offset++;
    else {
      if (!digit(await peek())) throw invalid();
      while (digit(await peek())) offset++;
    }
    if (await peek() === ".") {
      offset++;
      if (!digit(await peek())) throw invalid();
      while (digit(await peek())) offset++;
    }
    const exp = await peek();
    if (exp === "e" || exp === "E") {
      offset++;
      const sign = await peek();
      if (sign === "+" || sign === "-") offset++;
      if (!digit(await peek())) throw invalid();
      while (digit(await peek())) offset++;
    }
  }
  async function sequence(open: string, close: string, member: () => Promise<void>) {
    await take(open);
    await space();
    if (await peek() !== close) while (true) {
      await member();
      await space();
      if (await peek() === close) break;
      await take(",");
      await space();
    }
    await take(close);
  }
  async function object(keys: readonly string[], member: (key: string) => Promise<void>) {
    const seen = new Set<string>();
    await sequence("{", "}", async () => {
      const key = await string(keys.length > 0, keys.length ? keys : undefined);
      if (keys.includes(key)) {
        if (seen.has(key)) throw invalid();
        seen.add(key);
      }
      await space();
      await take(":");
      await space();
      await member(key);
    });
  }
  async function skip(): Promise<void> {
    const c = await peek();
    if (c === "{") await object([], skip);
    else if (c === "[") await sequence("[", "]", skip);
    else if (c === '"') await string(false);
    else if (c === "t" || c === "f" || c === "n") {
      for (const expected of c === "t" ? "true" : c === "f" ? "false" : "null") await take(expected);
    } else await number();
  }
  let version = false, kind = false;
  const facts: Partial<BacklogCreationIdentity> = {};
  await space();
  await object(["schemaVersion", "kind", "task"], async (field) => {
    if (field === "schemaVersion") { await take("1"); version = true; }
    else if (field === "kind") kind = await string(true, ["task-view"]) === "task-view";
    else if (field === "task") await object(["id", "path", "status"], async (key) => {
      if (key === "id" || key === "path" || key === "status") facts[key] = await string(true);
      else await skip();
    });
    else await skip();
  });
  await space();
  if (await peek() !== undefined || !version || !kind || !facts.id || !facts.path || !facts.status) throw invalid();
  return { id: facts.id, path: facts.path, status: facts.status };
}

export async function readBacklogCreationIdentity(cwd: string, taskId: string): Promise<BacklogCreationIdentity> {
  const child = spawn("backlog", ["task", "view", "--json", "--", taskId], { cwd, stdio: ["ignore", "pipe", "ignore"] });
  let launchError: string | undefined;
  child.once("error", (error: NodeJS.ErrnoException) => { launchError = error.code ?? "spawn failed"; });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolveClose => {
    child.once("close", (code, signal) => resolveClose({ code, signal }));
  });
  let facts: BacklogCreationIdentity | undefined;
  try { facts = await projectBacklogCreationIdentity(child.stdout); }
  catch { child.stdout.resume(); }
  const { code, signal } = await closed;
  if (launchError || code !== 0 || !facts) throw new Error(`Native Backlog identity read failed for ${taskId}: ${launchError ?? (code === 0 ? invalid().message : signal ?? `exit ${code}`)}`);
  if (facts.id !== taskId) throw new Error(`Native Backlog resolved a different canonical ID for ${taskId}`);
  const inside = (path: string) => path !== "" && !isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`);
  const root = realpathSync(cwd);
  const file = resolve(root, facts.path);
  if (isAbsolute(facts.path) || win32.isAbsolute(facts.path) || !inside(relative(root, file))
      || !lstatSync(file).isFile() || !inside(relative(root, realpathSync(file)))) {
    throw new Error(`Native Backlog task ${taskId} did not resolve a regular project file`);
  }
  return facts;
}
