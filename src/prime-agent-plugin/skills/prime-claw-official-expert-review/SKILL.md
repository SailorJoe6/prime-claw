---
name: prime-claw-official-expert-review
description: Validate the exact official Prime Claw EXPERT reviewer definition and report package availability. Admission and review execution are intentionally unavailable in this prerequisite generation.
---

# Prime Claw official EXPERT review

This Python-backed skill currently owns only the official reviewer definition
and deterministic availability contract. It is inert. It does not spawn a
reviewer, reserve or admit a role, send a message, mutate lifecycle state, or
grant EXPERT authority to this session or any child.

The bundled `src/prime_claw_official_expert_review/reviewer.md` is the canonical
managed definition. During the bridge generation it must remain byte-identical
to `.prime/agent/profiles/expert-reviewer.md`, which is retained unchanged as
migration evidence.

## Available API

Read and validate the definition from the persistent Python kernel:

```python
info = prime_claw_official_expert_review.describe()
```

`describe()` returns the exact model selector, requested reasoning level,
reviewer-definition hash, rubric hash, package manifest/hash, and
`authority: false`. It performs no host request and has no admission side
effect. Any validation error is fail-closed.

Installer/runtime preflight is performed by
`scripts/check-prime-agent-expert-runtime.py`. In managed-kernel mode it checks
the exact kernel interpreter, accepts an exact installed package or validates
the source package with that interpreter and reports `SYNC_PENDING`. When
`PRIME_AGENT_KERNEL_PYTHON` is set, it accepts only a normal already-installed
exact package import and otherwise reports `UNAVAILABLE`; it never installs or
injects the source path.

## Deferred behavior

Reviewer discovery, spawn, reservation, nonce/expiry state, handle binding,
child admission, packet delivery, report settlement, cleanup, provider
identity, and all role authority are deferred. Generic RLM children remain
generic. Do not interpret successful `describe()` or preflight as an admitted
or completed EXPERT review.
