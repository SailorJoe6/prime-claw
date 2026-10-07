#!/usr/bin/env python3
"""Shared canonical Slice-8 gbrain property normalization contract."""
from __future__ import annotations
import hashlib, json
from typing import Any

def canonical(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()

def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()

def dry_payload(*, command: list[str], exit_code: int, logical_mutation: bool,
                snapshot: dict[str, Any]) -> dict[str, Any]:
    return {
        "command": command, "exit_code": exit_code,
        "logical_mutation": logical_mutation,
        "schema_sha256": snapshot["schema_sha256"],
        "schema_object_count": snapshot["schema_object_count"],
        "migration_version": snapshot["migration_version"],
        "sequence_sha256": snapshot["sequence_sha256"],
        "sequence_count": snapshot["sequence_count"],
        "table_row_counts": snapshot["table_row_counts"],
        "failure_ledger_sha256": snapshot["failure_ledger_sha256"],
        "failure_ledger_lock": snapshot["failure_ledger_lock"],
        "persistent_locks": snapshot["persistent_locks"],
        "post_exit_fixture_sessions": snapshot["post_exit_fixture_sessions"],
        "config_semantics_sha256": snapshot["config_semantics_sha256"],
        "worktree": {"status_sha256": snapshot["worktree"]["status_sha256"],
                     "tree_sha256": snapshot["worktree"]["tree_sha256"]},
    }

def source_payload(*, command: list[str], accounting: dict[str, Any],
                   malformed: dict[str, Any]) -> dict[str, Any]:
    return {
        "command": command,
        "accounting": {key: accounting[key] for key in
                       ("records", "database_rows", "path_count", "row_count", "exclusion_count")},
        "live_slugs": sorted(r["slug"] for r in accounting["database_rows"] if not r["deleted"]),
        "deleted_slugs": sorted(r["slug"] for r in accounting["database_rows"] if r["deleted"]),
        "malformed": {"path": malformed["path"], "slug": malformed["slug"],
                      "reason": malformed["reason"], "bookmark_unchanged": True,
                      "rows_unchanged": True},
    }
