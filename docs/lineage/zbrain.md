# Lineage: zbrain

Source: `~/zbrain` (local)

The generic, reusable model for a basic claw — the always-on chassis.

## What it is

A Zendesk fork of the gbrain CLI (itself extracted from Garry Tan's OpenClaw
plugin repo), stripped to the CLI tool with one decisive change: **local
config.** Upstream gbrain always writes to `~/.gbrain/`; zbrain ensures each
project gets its own brain, its own database, its own config — no
cross-contamination. It vendors the `browse/` CLI for browser automation.

## What prime-claw takes from it

- **Per-project brains with no cross-contamination** — the technical basis
  for the "project = a gbrain source" boundary in VISION.md.
- **The always-on chassis pattern**: gbrain + gstack-browser in a container,
  a cron file (`brain.cron`) for schedules, and crude communication-channel
  scraping. prime-claw replaces the cron/scraping with prime-agent's native
  heartbeats and schedules.
- **Local-first knowledge**: markdown knowledge repo + Postgres-backed
  hybrid RAG + knowledge graph, queryable via `gbrain search`/`query`.

## Why it's not enough

Generic chassis; no prime-agent core; the scheduling and channel layer is
crude (cron + scraping) compared to what prime-agent provides natively.
