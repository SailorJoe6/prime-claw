---
id: PRIMECLAW-32
title: Repair synthetic source-generation Tier-1 prep-kernel fixture
status: To Do
assignee: []
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
priority: p2
type: bug
ordinal: 105000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Full container suite under verified PRIME_AGENT_SOURCE cwd-fix-v0.9.8-r1: 63 passed, 1 skipped, 1 failed. tests/test_source_builder_real_install.py::test_two_real_source_generations_install_changed_behavior_without_replay builds a deliberately minimal synthetic source package with no compact skill. Its nested tier1 fixture unconditionally searches /root/.local/share/prime-agent and the global npm root for skills/compact/pyproject.toml, then aborts isolated prep-kernel install (setup.log: find: /root/.local/share/prime-agent: No such file or directory). Fix the fixture/test contract without weakening real pinned-source prep or Prime Agent identity checks; prove source-generation A/B behavior, full container suite, and no host/global plugin changes. This is independent of v2r1013 plugin delivery; direct installer Docker test and pinned offline tier1 --probe passed.
<!-- SECTION:DESCRIPTION:END -->
