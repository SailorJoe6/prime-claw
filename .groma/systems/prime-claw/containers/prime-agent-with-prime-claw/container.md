---
type: C4 Container
title: Prime Agent with Prime Claw
status: draft
groma:
  id: prime-agent-with-prime-claw
  parent: prime-claw
  technology: Prime Agent, TypeScript, Node.js
description: Runs the installed plugin and managed Conversation and Episode sessions.
---

The TypeScript plugin runs in-process inside Prime Agent. Host and sandbox user-global installations use the same plugin; Conversation, Episode, and Expert are roles, not applications. The sandbox also stages a Node compatibility preload separately from the plugin. Groma shows this documented runtime boundary as draft because the scanners cannot match the upstream loader.
