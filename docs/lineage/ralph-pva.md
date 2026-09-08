# Lineage: ralph-pva

Source: `~/gitlab_local/ralph-pva` (local)

The first iteration of the personal virtual assistant — and the clearest
prior art for prime-claw's "home it can call its own."

## What it is

A personal virtual assistant. Notably, its README already describes it as
"running in the **Prime Agent harness**." It helps manage Joe's life through
custom skills and integrated knowledge management.

## Key patterns prime-claw inherits

- **The brain symlink pattern.** The local `brain/` directory is the source
  of truth for all user knowledge and is a **symlink to a separate brain
  repository** — the knowledge base lives independently of the code repo.
  This is exactly the "home with a symlinked brain" Joe cited as the model
  for prime-claw's runtime home.
- **External channels feed the brain.** Google Workspace and Slack feed the
  local brain through channel-specific collection workflows.
- **Reports are outputs, not knowledge.** Point-in-time syntheses persist
  under `reports/`, never under `brain/`.
- **Progressive disclosure as a governing principle.** Each session starts
  with minimal context and follows links to load only what the task
  requires — summaries first, details behind links, nothing bulk-loaded.
  This is the same instinct as prime-claw's sweet-spot context discipline.
- **prime-agent integration already present**: `.prime/`, `.gbrain-source`,
  `.devcontainer`, `.gstack/` are all in the tree.

## Why it's not enough

Built on the zbrain chassis rather than a clean prime-agent core. prime-claw
is the re-base: same PVA ambition, prime-agent as the harness from the
ground up, and the OpenShell sandbox as the runtime boundary.
