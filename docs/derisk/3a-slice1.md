# Phase 3a Slice 1 — Brain into the sandbox, push-capable (R3a-1, R3a-5 partial, R3a-7)

**Status: CAPABILITY PROVEN on a settled sandbox; fresh-`create` clone blocked by an OpenShell
credential-injection cold-start bug (documented below).**

## What works (proven, with evidence)

- **Push-capable github provider.** New custom profile `github-push` extends the builtin
  `github` profile (which is fetch-only: allows `POST` only to `/**/git-upload-pack`) with
  `POST /**/git-receive-pack` and read-write `api.github.com`. Auth: `bearer` /
  `authorization` header, credential `api_token`. Provider `prime-claw-github` created with
  the host `gh auth token`; the token is read host-side and injected at L7 — the sandbox only
  ever holds the placeholder `openshell:resolve:env:..._api_token`.
- **Clone with `.git`, credential-safe.** `git clone
  https://x-access-token:${api_token}@github.com/JLandersZen/brain.git /sandbox/brain` lands the
  real private brain with `.git` and full content; `git remote get-url origin` stores only the
  placeholder; `grep -c gho_ .git/config` = 0 (no real token on disk).
- **Push-back round-trip.** From the sandbox: commit + `git push origin HEAD:main` →
  `8adf9d4..61fd39c main` (then reverted). Push works through the same credentialed endpoint.
- **Policy shape (the one OpenShell accepts).** With the github-push provider attached, EVERY
  `github.com` rule must be L7 (`protocol: rest`) — a single credentialed `github_brain` rule
  keyed to `/usr/bin/git`, `/usr/local/bin/uv`, `/usr/bin/curl`. The uv/curl legs exist so the
  kernel-bootstrap `python-build-standalone` download (`github.com/.../releases/download/...`)
  stays reachable; they never send the placeholder, so the L7 swap never fires for them.
  `github.com`/`api.github.com` were removed from `kernel_bootstrap` (they were L4 there, which
  the attach validator rejects once a credentialed github provider exists).
- **Conditional credential refresh.** Every `provider update` bumps a resource version that
  re-keys the sandbox's placeholder set; a running sandbox still holds the OLD placeholders, so
  a needless update breaks the sandbox's credentialed endpoints until recreate. `stage_provider`
  (ai-gateway) and `stage_github_provider` now skip the update when the credential hash is
  unchanged (state in `.prime-claw-{ai-gateway-key,github-token}.sha256`, gitignored, hash only).

## The blocker: OpenShell per-sandbox credential cold-start + poison-on-failed-attempt

Reproduced consistently this session:

1. A **freshly created** sandbox's github credential injection is not live immediately.
2. A `git clone` (POST `git-receive-pack`/`git-upload-pack`) attempted in that window returns
   `401 Invalid username or token` — **and thereafter every clone from that sandbox keeps
   failing**, even minutes later, even after a cheap authenticated `curl` GET to the same host
   returns a real response (404) proving the swap fires for curl.
3. A sandbox whose first clone is **not** attempted during the cold-start window clones fine
   (observed succeeding at t+6s when the provider already existed and the sandbox had settled,
   and a `pc-coldtest` sandbox left alone ~180s cloned on the first try).
4. A `curl` GET "warm-up" before the clone does NOT reliably prevent the failure — the poison
   appears to be keyed to the first **git POST**, not to whether any prior authenticated request
   succeeded. (The earlier apparent warm-then-clone success was a timing coincidence.)

**Net:** retry inside `stage_brain_clone` cannot fix it (each failed attempt re-poisons), and a
pre-clone curl warm is not a reliable gate. The reliable path today is: create the sandbox, let
it settle, then clone (e.g. via `converge`) — but only if no failed clone already poisoned it.

**Hypothesis for follow-up:** the L7 proxy caches a per-(sandbox, host) credential-resolution
failure for git's smart-HTTP POST and does not re-resolve until some TTL or sandbox restart.
Needs either (a) an OpenShell-side fix/flag for credential readiness, or (b) a reliable
readiness probe that exercises the exact git POST handshake (not curl), or (c) delaying the
first clone until injection is confirmed live by a successful `git ls-remote` (a GET+POST pair
that is itself safe to retry — UNTESTED whether a failed `ls-remote` also poisons).

## Files changed (Slice 1)

- `bin/prime-claw`: `stage_github_provider`, `_host_github_token`, `GITHUB_PUSH_PROFILE_YAML`,
  `stage_brain_clone`; `stage_sandbox` attaches both providers at create and drops the host-dir
  `--upload` (clone supersedes it); conditional credential refresh in both provider stages;
  `create`/`converge` wire `github-provider` + `brain-clone`.
- `policies/runtime.yaml`: new `github_brain` credentialed L7 rule; `kernel_bootstrap` github
  endpoints removed (moved).
- `config/runtime.json`: `github_provider_name`, `github_profile`, `github_host`, `brain_repo`,
  `brain_branch`, `sb_brain_dir`.
- `tests/`: github provider (create/refresh/skip-unchanged/dry-run), brain clone (dry-run,
  fresh-clone, idempotent fetch, config override); stage-order tests updated for the 2 new stages.
  Suite: **94 green**.
