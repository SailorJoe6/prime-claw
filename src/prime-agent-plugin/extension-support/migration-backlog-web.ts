/** Migration-only native Web ingress. No provider files or lifecycle policy live here.
 * The current importer uses this async boundary to own its browser and CLI children.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createReadStream, createWriteStream, closeSync, chmodSync, mkdtempSync,
  openSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";

export interface MigrationBacklogWebOptions {
  /** Exact selected destination project context, not its nested task clone. */
  cwd: string;
  /** Exact already-prepared destination store. This helper never creates a store. */
  backlogDirectory: string;
  backlogCommand?: string;
  port?: number;
  signal?: AbortSignal;
  startupTimeoutMs?: number;
  requestTimeoutMs?: number;
  shutdownTimeoutMs?: number;
}

type Exit = { code: number | null; signal: NodeJS.Signals | null; forced: boolean };
type OwnedProcess = { child: ChildProcess; done: Promise<Exit>; result?: Exit; spawnFailed: boolean };

export class MigrationBacklogWebError extends Error {
  readonly stage: string;
  readonly outcome: "not-started" | "uncertain";
  readonly artifactDirectory: string;
  constructor(stage: string, outcome: "not-started" | "uncertain", artifactDirectory: string) {
    // Never include payloads, provider responses, argv, or child stderr here.
    super(`Migration native Web transport failed (${stage}; outcome=${outcome}). Private transport files retained.`);
    this.name = "MigrationBacklogWebError";
    this.stage = stage;
    this.outcome = outcome;
    this.artifactDirectory = artifactDirectory;
  }
}

async function unusedLoopbackPort(): Promise<number> {
  const probe = createServer();
  return new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close((error) => {
        if (error || !address || typeof address === "string") reject(error ?? new Error("No loopback port"));
        else resolve(address.port);
      });
    });
  });
}

function groupAlive(owned: OwnedProcess): boolean {
  if (owned.spawnFailed || !owned.child.pid) return false;
  try { process.kill(-owned.child.pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return false; throw error; }
}

/** Retains native envelopes unchanged. Current-state projection/readback comparison is the caller's job. */
class MigrationBacklogWeb {
  readonly artifactDirectory: string;
  readonly cwd: string;
  private origin: string;
  get url(): string { return this.origin; }
  private readonly backlogDirectory: string;
  server!: ChildProcess;
  private readonly env: NodeJS.ProcessEnv;
  private readonly owned = new Set<OwnedProcess>();
  private serverProcess!: OwnedProcess;
  private sequence = 0;
  private closed = false;
  private ready = false;
  private started = false;
  private failed = false;
  private busy = false;
  private aborted = false;
  private stopping?: Promise<Exit>;
  private abortRequest?: () => void;
  private readonly onAbort = () => {
    this.aborted = true;
    this.failed = true;
    this.abortRequest?.();
    // The public operation/close path also awaits this same shutdown promise.
    void this.close().catch(() => {});
  };

  private readonly options: MigrationBacklogWebOptions;
  constructor(options: MigrationBacklogWebOptions, port: number) {
    this.options = options;
    this.cwd = realpathSync(options.cwd);
    if (!isAbsolute(options.backlogDirectory)) throw new Error("Expected absolute prepared store path");
    this.backlogDirectory = realpathSync(options.backlogDirectory);
    this.env = { ...process.env, BACKLOG_CWD: this.cwd };
    this.origin = `http://127.0.0.1:${port}`;
    this.artifactDirectory = mkdtempSync(join(tmpdir(), "prime-claw-migration-web-"));
    chmodSync(this.artifactDirectory, 0o700);
  }

  private file(label: string): string {
    return join(this.artifactDirectory, `${++this.sequence}-${label}`);
  }

  private failure(stage: string, outcome: "not-started" | "uncertain"): MigrationBacklogWebError {
    this.failed = true;
    return new MigrationBacklogWebError(stage, outcome, this.artifactDirectory);
  }

  private launch(args: string[], stdout: string, stderr: string): OwnedProcess {
    const out = openSync(stdout, "wx", 0o600);
    let err: number | undefined;
    try {
      err = openSync(stderr, "wx", 0o600);
      const child = spawn(this.options.backlogCommand ?? "backlog", args, {
        cwd: this.cwd, env: this.env, detached: true, stdio: ["ignore", out, err],
      });
      // Publish ownership before any fallible parent descriptor cleanup.
      const owned: OwnedProcess = { child, done: undefined!, spawnFailed: false };
      owned.done = new Promise((resolve) => {
        child.once("error", () => {
          owned.spawnFailed = true;
          owned.result = { code: null, signal: null, forced: false };
          resolve(owned.result);
        });
        child.once("close", (code, signal) => {
          owned.result = { code, signal, forced: false };
          resolve(owned.result);
        });
      });
      this.owned.add(owned);
      return owned;
    } finally {
      try { closeSync(out); }
      finally { if (err !== undefined) closeSync(err); }
    }
  }

  /** Start only our child; a listening port by itself never establishes ownership. */
  async start(): Promise<void> {
    if (this.started || this.closed) throw this.failure("already-started", "not-started");
    this.started = true;
    const deadline = Date.now() + (this.options.startupTimeoutMs ?? 30_000);
    try {
      if (this.options.signal?.aborted) throw this.failure("pre-aborted", "not-started");
      this.options.signal?.addEventListener("abort", this.onAbort, { once: true });
      const stdout = this.file("browser.stdout");
      this.serverProcess = this.launch(["browser", "--no-open", "--port", new URL(this.url).port, "--non-interactive"],
        stdout, this.file("browser.stderr"));
      this.server = this.serverProcess.child;
      while (true) {
        if (this.closed || this.aborted || this.serverProcess.result) throw this.failure("browser-start", "not-started");
        const log = readFileSync(stdout, "utf8");
        const announced = log.match(/browser interface running at (http:\/\/127\.0\.0\.1:\d+)(?:\s|$)/);
        if (announced) {
          const actual = new URL(announced[1]);
          const actualPort = Number(actual.port);
          if (!Number.isInteger(actualPort) || actualPort < 1 || actualPort > 65535) throw this.failure("browser-url", "not-started");
          // --non-interactive can choose the next free port. Only this child's
          // successful bind announcement selects the URL, never a foreign listener.
          this.origin = actual.origin;
          break;
        }
        if (Date.now() >= deadline) throw this.failure("browser-readiness", "not-started");
        await delay(25);
      }
      // BACKLOG_CWD can still resolve an ancestor project. Require the actual
      // native root AND selected prepared store before any task write.
      const status = await this.request("GET", "/api/status", undefined, Math.max(1, deadline - Date.now()), false);
      if (status.initialized !== true || typeof status.projectPath !== "string" ||
          typeof status.backlogDirectory !== "string" ||
          realpathSync(status.projectPath) !== this.cwd ||
          realpathSync(resolve(this.cwd, status.backlogDirectory)) !== this.backlogDirectory) {
        throw this.failure("native-project-context", "not-started");
      }
      if (Date.now() >= deadline) throw this.failure("browser-readiness", "not-started");
      this.ready = true;
    } catch (error) {
      const failure = error instanceof MigrationBacklogWebError ? error : this.failure("browser-start", "not-started");
      await this.close();
      throw failure;
    }
  }

  private assertAvailable(requireReady = true): void {
    if ((requireReady && !this.ready) || this.closed || this.aborted || this.failed || this.busy || this.serverProcess?.result) {
      throw this.failure("transport-unavailable", "not-started");
    }
  }

  private async request(method: "GET" | "POST" | "PUT", path: string, payload?: Record<string, unknown>,
    timeoutMs = this.options.requestTimeoutMs ?? 120_000, requireReady = true): Promise<any> {
    this.assertAvailable(requireReady);
    this.busy = true;
    let attempted = false;
    const responseFile = this.file("response.json");
    let source: ReturnType<typeof createReadStream> | undefined;
    try {
      let inputFile: string | undefined;
      if (payload !== undefined) {
        inputFile = this.file("request.json");
        writeFileSync(inputFile, JSON.stringify(payload), { flag: "wx", mode: 0o600 });
      }
      const status = await new Promise<number>((resolve, reject) => {
        const req = httpRequest(`${this.url}${path}`, {
          method, headers: inputFile ? { "content-type": "application/json", "content-length": statSync(inputFile).size } : {},
          // Never follow redirects or use environment-selected HTTP proxies.
          agent: false,
        }, (response) => {
          pipeline(response, createWriteStream(responseFile, { flags: "wx", mode: 0o600 }))
            .then(() => resolve(response.statusCode ?? 0), reject);
        });
        const timer = setTimeout(() => req.destroy(new Error("request timeout")), timeoutMs);
        const done = () => { clearTimeout(timer); this.abortRequest = undefined; };
        req.once("error", (error) => { done(); reject(error); });
        req.once("close", done);
        this.abortRequest = () => req.destroy(new Error("request cancelled"));
        attempted = true;
        if (inputFile) {
          source = createReadStream(inputFile);
          source.once("error", (error) => req.destroy(error));
          source.pipe(req);
        } else req.end();
      });
      if (status < 200 || status >= 300) throw this.failure(`http-status-${status}`, method === "GET" ? "not-started" : "uncertain");
      if (this.closed || this.aborted || this.serverProcess.result) throw this.failure("request-stopped", method === "GET" ? "not-started" : "uncertain");
      return JSON.parse(readFileSync(responseFile, "utf8"));
    } catch (error) {
      const failure = error instanceof MigrationBacklogWebError ? error : this.failure("request", attempted && method !== "GET" ? "uncertain" : "not-started");
      // Even a native error response can follow partial writes. Stop, retain files,
      // and fence this transport. No automatic resend or allocation reconciliation.
      this.failed = true;
      await this.close();
      throw failure;
    } finally { source?.destroy(); this.busy = false; }
  }

  /** Return the native configuration object unchanged, including configured list values. */
  readConfiguration(): Promise<any> {
    return this.request("GET", "/api/config");
  }

  createTask(payload: Record<string, unknown>): Promise<any> {
    return this.request("POST", "/api/tasks", payload);
  }

  updateTask(id: string, payload: Record<string, unknown>): Promise<any> {
    return this.request("PUT", `/api/tasks/${encodeURIComponent(id)}`, payload);
  }

  /** File-backed native CLI read, with the same pinned selected project context. */
  async readTask(id: string): Promise<any> {
    this.assertAvailable();
    this.busy = true;
    try {
      const stdout = this.file("task-view.json");
      const owned = this.launch(["task", "view", "--json", "--", id], stdout, this.file("task-view.stderr"));
      const deadline = Date.now() + (this.options.requestTimeoutMs ?? 120_000);
      while (!owned.result) {
        if (this.closed || this.aborted || Date.now() >= deadline) throw this.failure("native-readback-stopped", "not-started");
        await delay(25);
      }
      if (owned.spawnFailed || owned.result.code !== 0 || owned.result.signal) throw this.failure("native-readback", "not-started");
      return JSON.parse(readFileSync(stdout, "utf8"));
    } catch (error) {
      const failure = error instanceof MigrationBacklogWebError ? error : this.failure("native-readback", "not-started");
      await this.close();
      throw failure;
    } finally { this.busy = false; }
  }

  close(): Promise<Exit> {
    if (this.stopping) return this.stopping;
    this.closed = true;
    if (this.busy) this.failed = true;
    this.abortRequest?.();
    this.options.signal?.removeEventListener("abort", this.onAbort);
    this.stopping = this.stopOwned();
    return this.stopping;
  }

  private async stopOwned(): Promise<Exit> {
    let forced = false;
    const signalGroups = (signal: NodeJS.Signals) => {
      for (const owned of this.owned) {
        if (groupAlive(owned)) {
          try { process.kill(-owned.child.pid!, signal); }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
        }
      }
    };
    try {
      signalGroups("SIGTERM");
      const grace = this.options.shutdownTimeoutMs ?? 3_000;
      let deadline = Date.now() + grace;
      while ([...this.owned].some(groupAlive)) {
        if (Date.now() >= deadline) { forced = true; break; }
        await delay(25);
      }
      if (forced) {
        signalGroups("SIGKILL");
        deadline = Date.now() + grace;
        while ([...this.owned].some(groupAlive)) {
          if (Date.now() >= deadline) throw this.failure("owned-process-stop-unproved", "uncertain");
          await delay(25);
        }
      }
      await Promise.all([...this.owned].map((owned) => owned.done));
      const result = this.serverProcess?.result ?? { code: null, signal: null, forced: false };
      if (!this.failed) rmSync(this.artifactDirectory, { recursive: true, force: true });
      return { ...result, forced };
    } catch { throw this.failure("owned-process-stop-unproved", "uncertain"); }
  }
}

export async function startMigrationBacklogWeb(options: MigrationBacklogWebOptions): Promise<MigrationBacklogWeb> {
  // Validate before allocating a child, including Windows where negative-PID group
  // signalling is unavailable. Do not silently provide a weaker stop guarantee.
  if (process.platform === "win32") throw new MigrationBacklogWebError("process-groups-unavailable", "not-started", "");
  if (options.signal?.aborted) throw new MigrationBacklogWebError("pre-aborted", "not-started", "");
  let port: number;
  try {
    port = options.port ?? await unusedLoopbackPort();
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("invalid port");
  } catch { throw new MigrationBacklogWebError("loopback-port", "not-started", ""); }
  let transport: MigrationBacklogWeb;
  try { transport = new MigrationBacklogWeb(options, port); }
  catch { throw new MigrationBacklogWebError("project-context", "not-started", ""); }
  await transport.start();
  return transport;
}
