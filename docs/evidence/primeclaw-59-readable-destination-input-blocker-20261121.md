# PRIMECLAW-59 — readable-destination native input boundary

This pass stopped before changing the plugin writer. Slice 1a at
`50dd3be9eef64693db9b499248cd8ea718a9e008` remains the implemented, reviewed
source-capture increment. This is decisive boundary evidence, not a readable
migration candidate or a completed acceptance criterion.

## Required behavior and conflict

The next approved slice removes encoded source packages/chunks and writes
complete readable current ticket fields through native Backlog create/edit
batches. The existing `syntheticCurrentViewFile` fixture in
`tests/task_provider_migration.test.mjs` supplies a **2,610,950-byte current
native view**, including large Unicode metadata and a tail sentinel. It is not
revision history. The accepted source capture and resource-error protection
must not be reduced to make destination authoring easier.

Backlog's existing noninteractive create/edit CLI takes Markdown values through
arguments. Its help has no file/stdin field-input option. Sending a current
value of this size as an argument fails at process execution, before Backlog
can parse it. Increasing output capture limits does not fix input `E2BIG`.
The old encoded-comment path avoids this only by making many small writes;
retaining or renaming that package/chunk scheme is not this slice's solution.

## Disposable offline probe

The probe used an already built tier-1 image, no network, a read-only root and
an empty temporary working directory. It invokes the native executable with a
synthetic ASCII notes value of the same byte count. No plugin or migration was
run. Process execution failed before a task command could run; no provider
workspace was mounted or created.

- Image: `prime-claw-test-tier1:6ee5f4dfd193`
- Image ID: `sha256:8e0ab6c6ae025c22ac1146b4f77f605ea23359e9d45dc25e8136109ddb6f566f`
- Native version: `1.55.3`; binary `/usr/local/bin/backlog`
- Linux binary SHA-256: `7b7392ce39def4fc96edc1903109ed9564dc25eb8bd79d3924378cb568ed590d`
- Probe exit: **0**, meaning the expected `E2BIG` was observed.

```json
{"inputBytes":2610950,"errorCode":"E2BIG","status":null,"signal":null,"stdoutBytes":0,"stderrBytes":0}
```

Reproduction (no private payload):

```sh
docker run --rm --network none --read-only --tmpfs /tmp:rw,nosuid,nodev   --entrypoint node prime-claw-test-tier1:6ee5f4dfd193 -e '
const {spawnSync}=require("node:child_process");
const bytes=2610950;
const r=spawnSync("backlog",["task","create","disposable-current-input-probe","--notes","x".repeat(bytes),"--plain"],{cwd:"/tmp",encoding:"utf8"});
const evidence={inputBytes:bytes,errorCode:r.error?.code??null,status:r.status,signal:r.signal,stdoutBytes:Buffer.byteLength(r.stdout??""),stderrBytes:Buffer.byteLength(r.stderr??"")};
console.log(JSON.stringify(evidence));
if(evidence.errorCode!=="E2BIG")process.exitCode=1;
'
```

## Other native surfaces inspected, not adopted

The read-only dependency inspection used source revision
`0cf4fdbc70020327f4366a29d3f405f83d180301`. The current host candidate is a
platform-specific binary; its SHA-256 is
`96044ce2319e84112b9490257f2b8a47a4458754a3c48472fb17452e511ffa00`.

- **MCP stdio:** `src/mcp/utils/schema-generators.ts:391–451` caps
  `implementationNotes` at 10,000 characters, `notesSet`/`planSet` at 20,000,
  and each appended comment/note at 5,000 with at most 20 per batch.
  The same caps were found in the actual host executable. MCP stdin is not
  an unchunked large-value route.
- **Interactive editor:** documented as a TUI edit action; it launches an editor
  on the actual task Markdown. An injected editor script/PTY is not a native
  structured-field input interface. No such workaround was used.
- **Library:** the distributed package exposes its CLI launcher/platform binary,
  not a public exported Core SDK. Checkout-only imports were not used.
- **Browser HTTP:** the shipped `backlog browser --no-open --port ...
  --non-interactive` starts a loopback server. Existing task POST/PUT handlers
  in `src/server/index.ts` forward readable current fields to Core without the
  MCP string caps (`implementationNotes` at lines 1165–1166). This is a possible
  native alternative, not a proven solution. It was **not started or tested**.
  The documented interface is a local Web UI; request limits, exact store/port
  identity, readiness, shutdown and uncertain writes need a bounded design and
  validation before relying on it for migration.

## Stop condition and next disposition

The approved create/edit-CLI plan cannot carry this current data without the
removed chunk path. Choosing a server-backed writer, or adding supported
file-backed input to the bundled provider, changes that implementation boundary.
The Episode did not silently choose either, add a size ceiling, drop current
fields, or relocate an archive. The owner should select the native input route
and record any plan adjustment before this slice resumes. This is a transport
choice; it does not relax current-state preservation or authorize live actions.

Partial test-only edits from the delegated fixture audit were restored to their
exact starting bytes. No plugin/test implementation remains changed. No full
migration suite or tier-1 plugin probe was rerun because plugin source did not
change; the only new execution evidence is the offline native input probe above.
Task lifecycle stays `In Progress`, all nine AC stay unchecked, and no full-task
Final Summary is claimed. Coexistence/configuration, recovery, cancellation,
progress and representative performance remain unfinished. No live migration,
provider switch, private incident-data access, cleanup, merge, global activation,
restart, Prime Agent source change or new Episode resources occurred.
