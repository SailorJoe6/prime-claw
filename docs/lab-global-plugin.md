# Lab-global prime-claw plugin

> Scope: manual POC on Joe's personal DGX Spark only. The final sandbox uses the
> same environment-global placement inside its isolated home.

## What is installed

The source of truth remains the prime-claw builder repository. The lab-global
copy preserves this relative layout under `~/.prime/agent/`:

```text
extensions/
  handoff-chain.ts
  reviewed-plan.ts
extension-support/
  handoff-prompts.ts
  reviewed-plan-support.ts
  spec-episode.ts
```

Prime Agent auto-discovers the two extension entry points. Their relative
imports resolve through the copied `extension-support/` files.

Do not copy the plugin into each managed project. Project-specific Ralph policy
continues to live under each project's `.ralph/` tree.

## Install or refresh

From the prime-claw builder repository, first inspect any existing destination
files. On first installation, stop rather than overwrite an unexplained file
with one of the same names. Once the files are known to be the managed
prime-claw copy, refresh all five together:

```bash
mkdir -p "$HOME/.prime/agent/extensions"   "$HOME/.prime/agent/extension-support"
cp -f .prime/agent/extensions/handoff-chain.ts   "$HOME/.prime/agent/extensions/handoff-chain.ts"
cp -f .prime/agent/extensions/reviewed-plan.ts   "$HOME/.prime/agent/extensions/reviewed-plan.ts"
cp -f .prime/agent/extension-support/handoff-prompts.ts   "$HOME/.prime/agent/extension-support/handoff-prompts.ts"
cp -f .prime/agent/extension-support/reviewed-plan-support.ts   "$HOME/.prime/agent/extension-support/reviewed-plan-support.ts"
cp -f .prime/agent/extension-support/spec-episode.ts   "$HOME/.prime/agent/extension-support/spec-episode.ts"
```

Refresh after any builder change to these files. Copying the complete managed
set avoids mixed-version entry points and support code.

## Verify

Compare each global file with its builder source using `cmp -s` or a SHA-256
hash. Then start a fresh Prime Agent process with a CWD outside the builder
repository and inspect its registered commands and tools.

Expected native commands:

- `/handoff`
- `/plan`
- `/implement-spec`

Expected structured tools:

- `ralph_handoff`
- `ralph_plan`
- `create_spec_episode`
- `handoff_spec_episode`

The command source paths must resolve under `~/.prime/agent/extensions/`, not the
builder checkout. Plugin verification does not prove a project is ready for
Ralph: the project's `.ralph/` policy and direct skill exposure are separate
`PROJECT_CONTEXT` preparation concerns.

## First installation evidence

On 2026-09-22, the five global files matched their builder sources byte for byte.
A disposable offline RPC session outside the builder repository registered all
three commands from the global extension paths. A session-start probe also
confirmed all four structured tools and confirmed that no unsupported
`ralph_implement_spec` tool was exposed.
