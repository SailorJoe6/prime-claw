# Slice 2 — In-sandbox index serving (R3a-2, R3a-12)

**Date:** 2026-09-15 · **Bead:** prime-claw-zwg · **Status:** COMPLETE

## What was built

New stage **`brain-index`** (in `bin/prime-claw`, wired into `create`/`converge` after `brain`,
before `spawn`):

1. `gbrain init --migrate-only --url postgresql://…` — apply schema to in-sandbox PG (idempotent).
2. `gbrain sources add brain --path /sandbox/brain --force` — register the cloned repo (idempotent;
   the "already exists" exit is tolerated).
3. `gbrain sync --source brain` — import + **embed** (embeddings ride the AI-gateway L7; the
   placeholder `openai_api_key` in `/sandbox/.gbrain/config.json` is swapped for the real key on
   the wire). Followed by `gbrain sync --skip-failed` (a no-op unless files failed) to advance the
   bookmark past any brain-repo files with malformed frontmatter — repair belongs to the brain's
   own triage workflows, not this runtime.
4. Gate: `SELECT count(*) FROM pages > 0`, and `set -o pipefail` on every piped gbrain call so a
   failing gbrain is never masked by `tail`.

`stage_brain` now writes gbrain config to **`/sandbox/.gbrain/config.json`** (the only location
gbrain reads — `$HOME/.gbrain`, with `HOME=/sandbox`), including `openai_api_key` taken from the
sandbox-env placeholder (`$api_key`, refreshed every run so a provider rotation + recreate rewrites
it). Config previously went to `/sandbox/brain/.gbrain/config.json`, which gbrain never reads —
see "False-pass bug" below.

## Verified end-to-end (fresh `destroy` + `create`)

- 1057 pages imported from the real brain clone (`JLandersZen/brain` @ `5a477ea`).
- 3029/3029 chunks embedded (dims 1536) via the AI gateway; zero un-embedded.
- `gbrain search` / `gbrain query` return real brain pages with live query-time embedding
  (no salvage fallback).
- **`bin/prime-claw validate`: 16/16 PASS** — including `brain-search-roundtrip` and
  `brain-embedding-via-gateway`, both previously the known-fail/deferred dimensions.
  Evidence: `docs/evidence/validate-20260915T170708Z.json`.

## False-pass bug fixed in validate (found this slice)

gbrain has **no cwd walk-up config discovery** (that was the zbrain fork delta; upstream reads
`$HOME/.gbrain/config.json` only — `GBRAIN_HOME` honored). The old validate checks ran
`cd /sandbox/brain && gbrain put …` expecting walk-up discovery, so the `put`s were failing
silently (`GBRAIN_DB_ACCESS no_url`, swallowed by `>/dev/null 2>&1`). `brain-embedding-via-gateway`
still reported PASS because its psql check read the newest embedded chunk *unscoped* — created by
an unrelated manual bulk embed against the same PG. Fixes:

- `brain-search-roundtrip` / `brain-embedding-via-gateway` no longer `cd` into the repo and no
  longer export `OPENAI_API_KEY`/`OPENAI_BASE_URL` (config supplies both).
- The embedding check now gates on **the row the probe just wrote**
  (`JOIN pages p ON p.id=c.page_id WHERE p.slug='embval'`), so a failed put can never pass against
  stale rows.

## Operational findings (recorded, not re-litigated)

- **VPN-down signature**: sandbox egress to `ai-gateway.zende.sk` 403s with `RBAC: access denied`
  (istio-envoy, no rate-limit headers) whenever the host VPN is down — the daily corporate re-login
  policy guarantees this happens mid-session regularly. Diagnostic: host+real-key 200 while
  sandbox+placeholder 403 → check `zetup vpn status` FIRST. Bead `prime-claw-z56` ports the
  `ensure-vpn` Claude hook so credentialed stages auto-check.
- **Provider recreate required after credential churn**: during this session the providers were
  deleted + recreated (create-time semantics) to recover from a broken placeholder binding after a
  `provider update` re-key (the D3a-J failure mode, runbook signature 7). Providers must not be
  deleted while attached to sandboxes — stale test sandboxes from Slice 1 bisecting were cleaned up.
- **npm registry race** (transient, external): `@types/node@26.6.0` was published 2026-09-15T16:41Z
  with its tarball 404ing for ~15 minutes, breaking prime-agent's fresh `npm install -g` during
  that window (transitive floating dep). Resolved itself; worth knowing if install 404s recur.
- **4 brain-repo files** have malformed YAML frontmatter (unquoted `: ` in scalars) and are skipped
  by sync: `tasks/app-elevator-participate-in-deployment-environment.md`,
  `resources/how-to-build-eks-cluster-confluence.md`, `resources/cplat-stand-up-notes.md`,
  `people/riccardo-dsilva.md`. Repair via the brain's own triage (`gbrain frontmatter validate
  <path> --fix`), not here.

## Requirement evidence

- **R3a-2 (in-sandbox index serving)** — PROVEN: `gbrain search`/`query` run against in-sandbox PG
  (`localhost:5433`), 1057 pages served, no host dependency at query time (other than the
  gateway-mediated embedding call).
- **R3a-12 (embedding freshness)** — PROVEN: 3029 chunks embedded via the AI gateway (dims 1536),
  query-time embedding live.
- **R3a-5 (lifecycle integration)** — advanced: `brain-index` is wired into `create`/`converge`,
  idempotent, dry-run aware, offline-tested.

## Tests added (offline, 6 new; suite 103 green)

`test_brain_config_lives_at_sandbox_home_not_repo`, `test_brain_index_stage_sequence`,
`test_brain_index_stage_dry_run`, `test_brain_index_sync_failure_propagates`,
`test_brain_index_sources_add_idempotent`, `test_create_and_converge_include_brain_index`;
ordering tests updated for the new stage.
