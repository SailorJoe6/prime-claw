---
id: PRIMECLAW-31
title: Activate Prime Claw plugin in preserved v2 sandbox
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
priority: p1
type: task
ordinal: 104000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a reproducible, container-only Prime Claw plugin install/check for the pinned TypeScript Prime Agent v0.9.8-r1 runtime. The live prime-claw-v2r1013 /sandbox/.prime symlinks into the working volume home-root, but current apply/check cannot fresh-install final role ownership and explicit-root skill placement is wrong; /sandbox/.agents is image-owned. Add a narrowly gated fresh sandbox-home target and ownership genesis without changing host user-global behavior. Package the exact managed allowlist for container delivery, reject unsafe symlink/drift/duplicate discovery, test in Docker and run the host-safe suite. Then stage to the accepted replacement, coordinate one full restart, prove daemon-backed plugin command/tool discovery, PostgreSQL state, source/model/security, and hand off for Joe manual UAT. Retain original v2, v1, checkpoint, live working volume and rollback preimages. Do not use host-global apply/check, patch upstream Prime Agent, broad converge/recover/validate, brain sync/index/routed writes, or Mac-wide cleanup.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Guarded sandbox-home plugin delivery committed, Docker/host tests and independent review accepted, v2r1013 live daemon-backed discovery plus unchanged DB and AGENT_OK verified; evidence docs/evidence/prime-claw-v2r1013-plugin-activation-20261010.md. Joe manual UAT handed back; unrelated synthetic fixture bug prime-claw-pai remains open.
<!-- SECTION:FINAL_SUMMARY:END -->
