"""Inert definition package for Prime Claw's official EXPERT reviewer.

This prerequisite package validates and describes the canonical reviewer.  It
intentionally has no spawn, reservation, messaging, lifecycle, or authority
behavior.  Later admission code must fail closed on ``describe()`` before it
performs any side effect.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1
REVIEWER_NAME = "expert-reviewer"
MODEL_SELECTOR = "openai-codex/gpt-6-astra"
THINKING_LEVEL = "max"
REVIEWER_DEFINITION_SHA256 = "d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6"
_PACKAGE_FILES = ("__init__.py", "reviewer.md")


def _digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _package_root() -> Path:
    return Path(__file__).resolve().parent


def _regular_bytes(name: str) -> bytes:
    path = _package_root() / name
    if path.is_symlink() or not path.is_file():
        raise RuntimeError(f"official EXPERT package asset is not a regular file: {name}")
    return path.read_bytes()


def _parse_reviewer_definition(data: bytes) -> tuple[dict[str, str], str]:
    if _digest(data) != REVIEWER_DEFINITION_SHA256:
        raise RuntimeError("official EXPERT reviewer definition hash mismatch")
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as error:
        raise RuntimeError("official EXPERT reviewer definition is not UTF-8") from error
    if not text.startswith("---\n"):
        raise RuntimeError("official EXPERT reviewer definition lacks exact frontmatter")
    closing = text.find("\n---\n", 4)
    if closing < 0:
        raise RuntimeError("official EXPERT reviewer definition frontmatter is incomplete")
    fields: dict[str, str] = {}
    for line in text[4:closing].splitlines():
        if line.count(":") != 1:
            raise RuntimeError("official EXPERT reviewer frontmatter is malformed")
        key, value = (part.strip() for part in line.split(":", 1))
        if not key or not value or key in fields:
            raise RuntimeError("official EXPERT reviewer frontmatter is malformed")
        fields[key] = value
    expected = {
        "name": REVIEWER_NAME,
        "model": MODEL_SELECTOR,
        "thinking": THINKING_LEVEL,
    }
    if fields != expected:
        raise RuntimeError("official EXPERT reviewer configuration mismatch")
    rubric = text[closing + 5 :]
    if not rubric.strip():
        raise RuntimeError("official EXPERT reviewer rubric is empty")
    return fields, rubric


def package_manifest() -> dict[str, str]:
    """Return exact hashes for the two runtime package assets."""
    return {name: _digest(_regular_bytes(name)) for name in _PACKAGE_FILES}


def package_sha256() -> str:
    """Return a stable digest of the runtime package asset manifest."""
    encoded = json.dumps(package_manifest(), sort_keys=True, separators=(",", ":")).encode()
    return _digest(encoded)


def describe() -> dict[str, Any]:
    """Validate and describe the inert reviewer definition without side effects."""
    definition = _regular_bytes("reviewer.md")
    fields, rubric = _parse_reviewer_definition(definition)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "capability": "definition-only",
        "authority": False,
        "module": "prime_claw_official_expert_review",
        "packageSha256": package_sha256(),
        "packageFiles": package_manifest(),
        "reviewerDefinitionSha256": _digest(definition),
        "reviewer": fields,
        "rubricSha256": _digest(rubric.encode("utf-8")),
    }


__all__ = [
    "MODEL_SELECTOR",
    "REVIEWER_DEFINITION_SHA256",
    "REVIEWER_NAME",
    "SCHEMA_VERSION",
    "THINKING_LEVEL",
    "describe",
    "package_manifest",
    "package_sha256",
]
