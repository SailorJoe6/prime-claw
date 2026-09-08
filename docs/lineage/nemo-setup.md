# Lineage: nemo-setup

Source: `~/code/nemo-setup` (local)

The security blueprint: how to run an agent inside NVIDIA's sandboxed
OpenShell environment, well-guided by NemoClaw (NVIDIA's reference
implementation for a secure claw).

## What it is

A reproducible, secured **Hermes** agent on this Mac, isolated inside an
OpenShell sandbox, orchestrated by NemoClaw, thinking through a company LLM
gateway's OpenAI-compatible endpoint.

**Architecture in one line:** NemoClaw (host CLI, orchestration) → OpenShell
(sandbox runtime, the security boundary) → Hermes (the agent, in a Docker
sandbox), with inference brokered through OpenShell's `inference.local` →
gateway `/v1/`. **The gateway token lives in OpenShell's credential store
and is injected at L7 — it never touches sandbox disk.**

## What prime-claw takes from it

- **The runtime boundary.** prime-claw's container-as-home is an OpenShell
  sandbox. The verified posture: deny-by-default egress, no direct Docker
  socket, no broad home mount, no host SSH paths, no host network/PID/IPC,
  no privileged pod, mediated GPU grants.
- **L7 credential injection** — the mechanism that satisfies prime-claw's
  credential-isolation rule (never touch Keychain/browser creds).
- **The slice-based build + runbook + verification scripts** as the
  reproducibility model (`docs/RUNBOOK.md`, `scripts/probe-blockers.sh`,
  `install-runtime.sh`, `check-runtime.sh`, ...).
- The vendored references under `third_party/`: OpenShell, NemoClaw,
  hermes-agent.

## The difference

Hermes sits where prime-agent should. prime-claw keeps the entire
sandbox/orchestration/security posture and swaps the harness at the heart.
