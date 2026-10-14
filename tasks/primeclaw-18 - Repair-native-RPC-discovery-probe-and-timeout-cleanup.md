---
id: PRIMECLAW-18
title: Repair native RPC discovery probe and timeout cleanup
status: In Design
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-14 14:45'
labels:
  - episode-loop
  - prime-agent
  - rpc
  - tests
dependencies: []
references:
  - PRIMECLAW-10.9
priority: p2
type: bug
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two pre-existing Prime Agent native-probe failures were confirmed while validating commit 376bc2b. `test_prime_agent_rpc_loads_native_commands_and_structured_tool` fails identically on untouched HEAD because the probe sees `/plan` and `/implement-spec` commands but not the registered structured tools during its session_start check. `test_installed_rpc_characterizes_confirmed_steer_lifecycle_order` exceeds its documented 20-second deadline and leaves pytest sleeping indefinitely with no child process and near-zero CPU; two runs required SIGTERM after 8+ minutes. These failures are independent of the episode-bootstrap transport patch and need isolated repair against the currently installed Prime Agent version.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The structured-tool probe checks the correct supported registration lifecycle and proves exactly the intended reviewed-plan tools;  the steer-ordering probe always exits within a bounded wall-clock limit, kills/reaps all descendants on every path, and prints captured events/stderr on failure;  both tests pass repeatedly in isolation and in their parent file without leaving sleeping pytest or Prime Agent processes;  documentation records any changed Prime Agent compatibility assumption.
<!-- AC:END -->
