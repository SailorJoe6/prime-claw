---
name: over-engineering-guard
description: Use when checking an implementation plan to ensure the wording does not encourage over-engineering that leads to unreasonably complex code.  
---

Study the plan, specifically the portion of the ticket after the heading "Implementation Plan" and tell me if there's anything in there that might lead to over-engineering.  We're looking for the least-tech solution that satisfies the plan! That means favor the following:

  1. Use provider-native behavior.
  2. Use LLM instructions for semantic judgment.
  3. Add only narrow deterministic integrity and transport code.
  4. Add persistent state or state machines only when a named criterion cannot otherwise be met—and require proof in the plan.

The specification should explicitly forbid deterministic machinery for task reconciliation, iterative plan changes, and trying to code other reasoning an Episode or Conversation can perform via the LLM.
