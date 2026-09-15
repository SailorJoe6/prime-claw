# Phase 3a Slice 1 — Brain into the sandbox, push-capable (R3a-1, R3a-5 partial, R3a-7)

**Status: COMPLETE. Fresh `create` lands the brain deterministically; the blocker was a
shell-quoting bug in `stage_brain_clone` (see root cause below), not an OpenShell defect.**

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

## Root cause of the fresh-`create` clone failure (SOLVED 2026-09-14)

The "OpenShell credential cold-start / poison-on-failed-attempt" hypothesis in the earlier
version of this doc was **wrong**. Hours of bisection (fresh sandboxes clone fine immediately;
`ls-remote` succeeds while clone fails; failed sandboxes recover; single-stage knockouts all
fail; results flip over time) were all noise from ONE mundane bug:

**`stage_brain_clone`'s shell script single-quoted the clone URL**
(`git clone --branch main 'https://x-access-token:${api_token}@github.com/...'`). Inside
`bash -lc`, single quotes prevent parameter expansion, so git received the LITERAL string
`${api_token}` as the password and every attempt 401'd. Every manual probe used double quotes
(expand correctly), which is why manual clones always worked while the stage always failed.
The "recovery after minutes" observations were simply manual clones succeeding on sandboxes
where the stage had failed.

**Lesson (recorded so we don't re-learn it):** when a scripted stage fails but the "same"
command run by hand succeeds, diff the EXACT bytes each path sends (here: shell quoting of an
interpolated URL) before theorizing about the platform. Time-varying bisect results are a
strong smell that the variable under test isn't the real variable.

Fix: double-quote the URL in `git clone` and `git remote set-url` (commit `2bfcc03`). Retry budget
reduced to a sane 3x10s (genuine per-sandbox L7 injection cold-start, if any, is seconds-scale).
Regression test: `test_brain_clone_url_double_quoted_for_placeholder_expansion` asserts the
generated script double-quotes the URL so `${api_token}` expands.

**Verified end-to-end**: fresh `bin/prime-claw destroy` + `bin/prime-claw create` lands
`/sandbox/brain` cloned with `.git` (HEAD `8adf9d4`), placeholder-only remote URL, zero real
token in `.git/config`; `converge` is idempotent (providers skip update when unchanged, brain
fetch+ff). Push-back round-trip verified earlier (commit + push, reverted).

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
