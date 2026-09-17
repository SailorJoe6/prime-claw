# Hermes as prime-claw's main agent: compatibility assessment

> **Status:** Recommendation, not an approved architectural decision  
> **Date:** 2026-09-17  
> **Bead:** `prime-claw-k06`  
> **Source conversation:** [ChatGPT: Hermes, OpenShell, and sandbox topology](../../docs/research/chatgpt-hermes-openshell-conversation.md)

## Bottom line

**Do not replace prime-agent with Hermes inside this repository now.** The change is not an implementation detail. It reverses the founding choice that defines prime-claw, invalidates several completed de-risk gates, and changes both the agent harness and the sandbox topology.

The Hermes proposal is credible enough to test. Test it as a **separate, bounded sibling experiment** after finishing prime-claw Phase 3a. Use the same acceptance criteria against both systems. If Hermes proves the load-bearing product semantics and is materially better, then make an explicit project-level pivot with rewritten vision, decisions, requirements, and de-risk gates.

This recommendation does **not** mean “Hermes is incompatible with the product idea.” It means “Hermes is incompatible with the current repository contract until a spike proves a replacement contract.”

## What the shared conversation proposes

The final, simplified hypothesis is:

```text
OpenShell sandbox: main runtime
└── one multiplexed Hermes gateway
    ├── Company/project A profiles ──SSH──> OpenShell worker sandbox A
    ├── Company/project B profiles ──SSH──> OpenShell worker sandbox B
    └── Company/project C profiles ──SSH──> OpenShell worker sandbox C
```

The operator provisions the trust domains. Hermes profiles select configured execution targets. Hermes does not need permission to invent sandboxes or change their policies.

That is a reasonable hypothesis. It is also a different architecture from the current one:

```text
Current prime-claw
└── one self-contained OpenShell sandbox
    ├── prime-agent daemon and sessions
    ├── gbrain + Postgres
    ├── project contexts represented by git folders/CWD
    └── conversation and episode isolation represented by prime-agent sessions
```

The proposal therefore changes **two axes at once**:

1. prime-agent → Hermes as the main harness;
2. one self-contained runtime with CWD/session boundaries → a main runtime plus separately provisioned worker sandboxes with SSH boundaries.

## External claims checked

The linked conversation is AI-generated and is not evidence by itself. The following claims were checked against pinned public source/docs on 2026-09-17.

| Claim | Finding | Confidence |
|---|---|---|
| Terminal configuration is resolved per Hermes profile. | Verified. A multiplexed gateway resolves `terminal.backend`, CWD, Docker settings, and SSH targets per routed profile. | High |
| Profiles can intentionally share one Docker container. | Verified. A shared non-empty `docker_shared_container_key` gives profiles a common container identity. The first creator fixes immutable image/mount settings. | High |
| Hermes supports an SSH execution backend. | Verified. It uses system `ssh`/`scp`, ControlMaster, `BatchMode=yes`, and normal OpenSSH host resolution. | High |
| OpenShell provides an SSH connection seam. | Verified. `openshell sandbox ssh-config <name>` emits an OpenSSH Host entry using `openshell ssh-proxy`; this is gateway-mediated, not a plain exposed port 22. | High |
| Stock NemoHermes maps profiles in one Hermes runtime to sibling OpenShell sandboxes. | Not found. The documented reference topology places a Hermes runtime inside each OpenShell sandbox. This remains an absence claim, not proof that no implementation exists. | Medium |
| The proposed composition needs no code changes. | Plausible, not proven. Hermes and OpenSSH likely need no code change, but the main sandbox still needs the OpenShell CLI, generated SSH config, gateway connectivity, and safe authorization material. | Medium |

Primary sources:

- [Hermes profiles](https://github.com/NousResearch/hermes-agent/blob/8ffc2f03693f8d502d8d08deb15e21846035d4b4/website/docs/user-guide/profiles.md#L5-L14)
- [Hermes multi-profile terminal resolution](https://github.com/NousResearch/hermes-agent/blob/8ffc2f03693f8d502d8d08deb15e21846035d4b4/website/docs/user-guide/multi-profile-gateways.md#L64-L84)
- [Hermes Docker and SSH configuration](https://github.com/NousResearch/hermes-agent/blob/8ffc2f03693f8d502d8d08deb15e21846035d4b4/website/docs/user-guide/configuration.md#L323-L465)
- [Hermes SSH implementation](https://github.com/NousResearch/hermes-agent/blob/8ffc2f03693f8d502d8d08deb15e21846035d4b4/tools/environments/ssh.py#L58-L127)
- [OpenShell sandbox SSH configuration](https://github.com/NVIDIA/OpenShell/blob/9b9f7905e11b7a10fb8d4f5b28d52109fddde2a9/docs/sandboxes/manage-sandboxes.mdx#L653-L661)
- [OpenShell SSH proxy implementation](https://github.com/NVIDIA/OpenShell/blob/9b9f7905e11b7a10fb8d4f5b28d52109fddde2a9/crates/openshell-cli/src/ssh.rs#L1518-L1557)
- [NemoClaw/Hermes ecosystem topology](https://github.com/NVIDIA/NemoClaw/blob/b761658f6051ec7d6bb657e7ccb48682640da69d/docs/about/ecosystem-hermes.mdx#L18-L55)
- [NemoClaw multiple Hermes sandboxes](https://github.com/NVIDIA/NemoClaw/blob/b761658f6051ec7d6bb657e7ccb48682640da69d/docs/manage-sandboxes/run-sandboxes.mdx#L34-L58)

The biggest unresolved point is operational, not conceptual: can a main Hermes sandbox obtain narrowly scoped permission to use `openshell ssh-proxy` for named sibling sandboxes **without** receiving broad OpenShell control-plane authority or violating prime-claw's credential-isolation rule?

## Compatibility with the current repository

### What is compatible and reusable

These parts do not depend strongly on prime-agent:

- OpenShell as the security authority.
- Deny-by-default egress and L7 credential injection.
- The apply/check/validate/test lifecycle discipline.
- Requirements traceability.
- In-sandbox gbrain, Postgres, pgvector, brain clone/index/query, and Git push plumbing.
- The generic platform vs. operator-instance split.
- The information-architecture principles in `docs/information-architecture.md`.
- The Phase 3 read/query/write acceptance flow as a cross-harness benchmark.

A narrower use of Hermes as a worker/execution layer could coexist with prime-agent without changing the product thesis. That should be considered only after a spike shows it solves a real isolation problem.

### What makes replacement a founding pivot

The repository repeatedly defines prime-agent as the reason for the project:

- `VISION.md`, **What prime-claw is**: prime-claw is built on prime-agent.
- `VISION.md`, **Why prime-agent**: daemon sessions, CWD-aware spawn, persistent REPL state, targeted compaction, native recursion, schedules, and continual harness are the native primitives used to express the hierarchy.
- `VISION.md`, **What prime-claw explicitly is not**: it is explicitly “not a port of OpenClaw or Hermes.”
- `docs/founding-decisions.md`, **The decision to build something new**: prime-agent was selected because the universal → project → conversation → episode hierarchy was believed to work natively there.
- `.ralph/plans/DECISIONS.md`, **D3a-A/D3a-C**: prime-agent as the mode-(a) gbrain controller is the novel surface of the active tracer bullet.

Changing the main harness therefore requires more than swapping `stage_prime_agent` for `stage_hermes`. It reopens the product thesis.

### Completed evidence that would no longer answer the new question

A Hermes pivot would invalidate these items as acceptance evidence for the selected harness:

- Phase 1 U1: prime-agent runs inside OpenShell.
- Phase 1 U3: prime-agent episodes spawn and reap cleanly.
- Phase 2 checks for the prime-agent daemon, persistent REPL, socket/RPC behavior, and spawn target.
- Phase 3's proof that prime-agent can act as gbrain's mode-(a) controller.
- The prime-agent-specific model/auth projection and gbrain harness-adapter work.
- Phase 4 and Phase 6 assumptions about RLM children, daemon-managed conversations, targeted compaction, continual harness refinement, and prime-agent schedules/heartbeats.

This work is not all wasted. The runtime, brain, security, and lifecycle layers survive. But the harness-specific de-risk work would need Hermes equivalents.

## The product invariants Hermes must prove

Do not compare feature lists. Compare the behavior that prime-claw is designed around:

1. **Universal agent:** one always-on top-level agent with safe scheduled wakeups.
2. **Project context:** hard, understandable project boundaries with the correct repo, brain source, and durable state.
3. **Conversation:** resumable, observable, messageable threads that can remain quiet for weeks.
4. **Episode:** temporary build agents that can be spawned, supervised, handed off, and reaped.
5. **Three horizons:** controlled short-context operation, invocation-lifetime state, and product-lifetime living records.
6. **Focused handoff/compaction:** deliberate continuation state rather than accidental context rot.
7. **Mode-(a) brain ownership:** the main agent administers and drives gbrain, not merely queries a remote service.
8. **Security:** no credential on sandbox disk and no agent ability to enlarge its own trust domain.

The linked conversation mainly supports the project-context/security-boundary hypothesis. It does not yet prove the conversation, episode, context-lifetime, scheduling, or brain-controller hypotheses.

## Options

### A. Replace prime-agent in this repository now

**Reject for now.** This would rewrite a project whose defining premise is still being validated. It would mix a promising new hypothesis with a nearly complete Phase 3 tracer bullet and make it hard to tell which architecture actually worked.

### B. Ignore Hermes and continue unchanged

**Also reject.** The per-profile SSH topology is plausible and could offer stronger team/project isolation than CWD alone. It deserves evidence, especially because Hermes is part of prime-claw's NemoClaw lineage.

### C. Finish the current tracer bullet, then run a separate Hermes spike

**Recommended.** Phase 3a has only Slice 4B (routed write/push) and Slice 5 (acceptance/traceability) left. Completing them creates a working baseline. A sibling experiment can then reuse the generic runtime lessons while testing Hermes honestly.

## Recommended spike

Keep it deliberately small. Do not design a federation, broker, or new backend.

1. Provision one main OpenShell sandbox with one multiplexed Hermes gateway.
2. Provision two named worker OpenShell sandboxes.
3. Generate ordinary OpenSSH configuration for both workers.
4. Configure two Hermes profiles, each with its own SSH target.
5. From each profile, run a command and write a marker file in the intended worker.
6. Prove each profile cannot reach the other worker through its configured tool path.
7. Prove the main Hermes sandbox cannot create/destroy sandboxes or change policy.
8. Record exactly what OpenShell CLI, gateway metadata, TLS material, and network policy the main sandbox needed.
9. Only if this passes, test the product invariants above and the same cited gbrain read + routed write/push used by prime-claw Phase 3.

A good spike outcome is a measured comparison, not a commitment to migrate.

## Decision rule

- If Hermes only improves worker isolation, keep prime-agent as the universal/conversation/episode harness and consider Hermes or SSH workers as an execution layer.
- If Hermes proves all load-bearing hierarchy and context semantics and is materially simpler or safer, create an explicit pivot proposal. Update `VISION.md`, `docs/founding-decisions.md`, `LONG_RANGE_PLAN.md`, and the requirements before changing implementation.
- If Hermes cannot safely reach worker sandboxes without broad OpenShell authority, keep the current self-contained topology and treat the experiment as closed evidence.

## Recommendation

Finish Phase 3a in prime-claw. Run the Hermes topology as a separate sibling experiment. Do not change this repository's main agent until that experiment proves the full product invariants, not only per-profile SSH routing.
