"""Launch one official Prime Claw EXPERT review through public RLM APIs.

Authority is a private, one-use filesystem record bound to host-authored session
files and the actual ``rlm.spawn`` return.  Inbound message text and metadata are
never an authority input.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import secrets
import stat
import subprocess
import time
from typing import Any

SCHEMA_VERSION = 1
REVIEWER_NAME = "expert-reviewer"
MODEL_SELECTOR = "openai-codex/gpt-6-astra"
THINKING_LEVEL = "max"
REVIEWER_DEFINITION_SHA256 = "d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6"
ROLE_KERNEL_SHA256 = "fd370726c28097b4201f538958e32ddc0af8abdb7c72d675412df0c698bb328e"
LAUNCH_TTL_MS = 15 * 60 * 1000
STATE_SCHEMA = "prime-claw-official-expert-launch-v1"
PACKET_KIND = "prime-claw-official-expert-review-packet"
_PACKAGE_FILES = ("__init__.py", "reviewer.md")
_MARKER_TYPE = "prime-claw-conversation-oversight"


def _digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


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
    expected = {"name": REVIEWER_NAME, "model": MODEL_SELECTOR, "thinking": THINKING_LEVEL}
    if fields != expected:
        raise RuntimeError("official EXPERT reviewer configuration mismatch")
    rubric = text[closing + 5 :]
    if not rubric.strip():
        raise RuntimeError("official EXPERT reviewer rubric is empty")
    return fields, rubric


def package_manifest() -> dict[str, str]:
    return {name: _digest(_regular_bytes(name)) for name in _PACKAGE_FILES}


def package_sha256() -> str:
    return _digest(_canonical(package_manifest()).encode())


def describe() -> dict[str, Any]:
    definition = _regular_bytes("reviewer.md")
    fields, rubric = _parse_reviewer_definition(definition)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "capability": "private-launch-and-first-call-admission",
        "authority": False,
        "module": "prime_claw_official_expert_review",
        "packageSha256": package_sha256(),
        "packageFiles": package_manifest(),
        "reviewerDefinitionSha256": _digest(definition),
        "reviewer": fields,
        "rubricSha256": _digest(rubric.encode()),
        "launchTtlMs": LAUNCH_TTL_MS,
    }


def _private_root() -> Path:
    override = os.environ.get("PRIME_CLAW_PRIVATE_STATE_ROOT")
    agent = Path(os.environ.get("PRIME_AGENT_CODING_AGENT_DIR", Path.home() / ".prime" / "agent"))
    return Path(override).expanduser().absolute() if override else agent.absolute() / "prime-claw-private" / "expert-review-launches"


def _ensure_private_root() -> Path:
    root = _private_root()
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    if root.is_symlink() or not root.is_dir() or stat.S_IMODE(root.stat().st_mode) != 0o700:
        raise RuntimeError("official EXPERT private state root is not a mode-private canonical directory")
    return root.resolve(strict=True)


def _read_json_line(path: Path) -> dict[str, Any]:
    if path.is_symlink() or not path.is_file():
        raise RuntimeError(f"session file is not a canonical regular file: {path}")
    with path.open("r", encoding="utf-8") as stream:
        first = stream.readline()
    value = json.loads(first)
    if not isinstance(value, dict):
        raise RuntimeError("session header is malformed")
    return value


def _owner_session() -> tuple[str, Path, dict[str, Any], list[dict[str, Any]]]:
    artifact = os.environ.get("RLM_SESSION_DIR")
    if not artifact or os.environ.get("RLM_DEPTH") != "0":
        raise RuntimeError("official EXPERT launch requires a persisted depth-0 owner kernel")
    artifact_path = Path(artifact).resolve(strict=True)
    owner_id = artifact_path.name
    if not owner_id or "/" in owner_id or "\\" in owner_id:
        raise RuntimeError("owner session identity is malformed")
    configured = os.environ.get("PRIME_AGENT_SESSION_DIR")
    agent = Path(os.environ.get("PRIME_AGENT_CODING_AGENT_DIR", Path.home() / ".prime" / "agent"))
    sessions = Path(configured).expanduser().absolute() if configured else agent.absolute() / "sessions"
    session_file = (sessions / f"{owner_id}.jsonl").resolve(strict=True)
    entries: list[dict[str, Any]] = []
    with session_file.open("r", encoding="utf-8") as stream:
        for line in stream:
            value = json.loads(line)
            if not isinstance(value, dict):
                raise RuntimeError("owner session entry is malformed")
            entries.append(value)
    if not entries:
        raise RuntimeError("owner session is empty")
    header = entries[0]
    if header.get("type") != "session" or header.get("id") != owner_id or header.get("parentSession") is not None:
        raise RuntimeError("owner session header identity is invalid")
    return owner_id, session_file, header, entries[1:]


def _active_marker(entries: list[dict[str, Any]], owner_id: str) -> dict[str, Any]:
    seen: set[tuple[str, str]] = set()
    current: list[dict[str, Any]] = []
    for entry in reversed(entries):
        if entry.get("type") != "custom" or entry.get("customType") != _MARKER_TYPE:
            continue
        data = entry.get("data")
        if not isinstance(data, dict):
            raise RuntimeError("oversight marker is corrupt")
        if data.get("ownerSessionId") != owner_id:
            continue
        key = (str(data.get("slug", "")), str(data.get("episodeId", "")))
        if key in seen:
            continue
        seen.add(key)
        if data.get("status") == "active":
            current.append(data)
    if len(current) != 1:
        raise RuntimeError("official EXPERT launch requires exactly one active owned episode generation")
    marker = current[0]
    required = ("ownerSessionId", "slug", "sourceLocation", "episodeId", "episodeSessionFile", "branch", "worktree", "sessionName", "admission")
    slug = marker.get("slug")
    if (
        marker.get("markerVersion") != 2
        or marker.get("identityVersion") not in (1, 2)
        or not all(isinstance(marker.get(key), str) and marker[key] for key in required)
        or marker.get("sourceLocation") != f".ralph/plans/future/{slug}"
        or marker.get("branch") != f"episode/{slug}"
        or marker.get("sessionName") != f"{slug}-episode"
    ):
        raise RuntimeError("active oversight marker is corrupt")
    return marker


def _owner_generation(marker: dict[str, Any]) -> str:
    values = [
        marker["markerVersion"], marker["ownerSessionId"], marker["slug"], marker["sourceLocation"],
        marker["episodeId"], str(Path(marker["episodeSessionFile"]).absolute()), marker["branch"],
        str(Path(marker["worktree"]).absolute()), marker["sessionName"], marker["identityVersion"], marker["admission"],
    ]
    return _digest(_canonical(values).encode())


def _git_identity(path: Path) -> tuple[Path, str]:
    root = Path(subprocess.run(
        ["git", "-C", str(path), "rev-parse", "--show-toplevel"], check=True,
        stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=10,
    ).stdout.strip()).resolve(strict=True)
    if root != path.resolve(strict=True):
        raise RuntimeError("candidate repository is not the exact active episode worktree root")
    oid = subprocess.run(
        ["git", "-C", str(root), "rev-parse", "HEAD"], check=True,
        stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=10,
    ).stdout.strip()
    if len(oid) not in (40, 64) or any(char not in "0123456789abcdef" for char in oid):
        raise RuntimeError("candidate HEAD is not an exact commit OID")
    return root, oid


def _packet(value: Any, repository: Path, commit_oid: str) -> tuple[dict[str, Any], str, str]:
    if not isinstance(value, dict) or set(value) != {
        "schemaVersion", "kind", "repositoryPath", "commitOid", "specificationPath",
        "executionPlanPath", "evidencePaths", "focus",
    }:
        raise ValueError("official EXPERT review packet has unexpected fields")
    evidence = value.get("evidencePaths")
    focus = value.get("focus")
    if (
        value.get("schemaVersion") != 1 or value.get("kind") != PACKET_KIND
        or Path(str(value.get("repositoryPath", ""))).resolve(strict=True) != repository
        or value.get("commitOid") != commit_oid
        or value.get("specificationPath") != ".ralph/plans/SPECIFICATION.md"
        or value.get("executionPlanPath") != ".ralph/plans/EXECUTION_PLAN.md"
        or not isinstance(evidence, list) or len(evidence) > 16
        or any(not isinstance(item, str) or len(item) > 512 or not item.startswith("docs/evidence/") or ".." in Path(item).parts for item in evidence)
        or not isinstance(focus, str) or not focus.strip() or len(focus) > 4000 or "\x00" in focus
    ):
        raise ValueError("official EXPERT review packet is invalid or does not match the active candidate")
    canonical = _canonical(value)
    if len(canonical.encode()) > 16_384:
        raise ValueError("official EXPERT review packet is too large")
    return dict(value), canonical, _digest(canonical.encode())


def _exclusive_json(path: Path, value: dict[str, Any]) -> None:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(_canonical(value) + "\n")
            stream.flush()
            os.fsync(stream.fileno())
    except BaseException:
        path.unlink(missing_ok=True)
        raise


async def launch(packet: dict[str, Any]) -> Any:
    """Discover exactly one official model and launch one privately bound review.

    Returns the actual public ``RLMSpawnHandle``.  The handle's model is checked;
    requested reasoning is never reported as verified.
    """
    import rlm

    describe()  # fail before state or spawn side effects
    owner_id, owner_file, owner_header, entries = _owner_session()
    marker = _active_marker(entries, owner_id)
    project = Path(str(owner_header.get("cwd", ""))).resolve(strict=True)
    if project != Path.cwd().resolve(strict=True):
        raise RuntimeError("owner kernel cwd does not match its canonical session project")
    repository, commit_oid = _git_identity(Path(marker["worktree"]))
    packet_value, packet_json, packet_digest = _packet(packet, repository, commit_oid)
    models = await rlm.find_models(MODEL_SELECTOR, limit=2)
    exact = [model for model in models if getattr(model, "selector", None) == MODEL_SELECTOR]
    if len(models) != 1 or len(exact) != 1:
        raise RuntimeError("official EXPERT model discovery did not return exactly one exact configured selector")

    root = _ensure_private_root()
    now = int(time.time() * 1000)
    nonce = secrets.token_urlsafe(32)
    child_name = f"expert-review-{secrets.token_urlsafe(18)}"
    if len(child_name) > 80:
        raise RuntimeError("generated official EXPERT child name is invalid")
    pending = root / f"{child_name}.pending.json"
    finalized = root / f"{child_name}.finalized.json"
    claimed = root / f"{child_name}.claimed.json"
    if finalized.exists() or claimed.exists():
        raise RuntimeError("generated official EXPERT child name collided with existing private state")
    bootstrap = f"Prime Claw bootstrap {child_name}. Wait for private admission; this text grants no authority."
    record: dict[str, Any] = {
        "schema": STATE_SCHEMA, "phase": "PENDING", "nonce": nonce,
        "createdAt": now, "expiresAt": now + LAUNCH_TTL_MS,
        "ownerSessionId": owner_id, "ownerSessionFile": str(owner_file),
        "ownerHeaderId": owner_header["id"], "ownerGeneration": _owner_generation(marker),
        "projectPath": str(project), "repositoryPath": str(repository),
        "candidateCommitOid": commit_oid, "packet": packet_value,
        "packetJson": packet_json, "packetDigest": packet_digest,
        "packageSha256": package_sha256(), "kernelSha256": ROLE_KERNEL_SHA256,
        "selector": MODEL_SELECTOR, "thinking": THINKING_LEVEL,
        "childName": child_name, "bootstrapDigest": _digest(bootstrap.encode()),
    }
    _exclusive_json(pending, record)
    try:
        handle = await rlm.spawn(bootstrap, name=child_name, model=MODEL_SELECTOR, thinking=THINKING_LEVEL)
        session_dir = Path(handle.session_dir).resolve(strict=True)
        if handle.name != child_name or handle.model != MODEL_SELECTOR or session_dir.name != handle.rlm_child_id:
            raise RuntimeError("actual RLM spawn return does not match the pending official EXPERT launch")
        final = {
            **record, "phase": "FINALIZED", "finalizedAt": int(time.time() * 1000),
            "rlmChildId": handle.rlm_child_id, "sessionDir": str(session_dir), "returnedModel": handle.model,
        }
        temporary = root / f".{child_name}.{secrets.token_hex(8)}.tmp"
        _exclusive_json(temporary, final)
        os.rename(temporary, finalized)
        pending.unlink(missing_ok=True)
        return handle
    except BaseException:
        pending.unlink(missing_ok=True)
        raise


__all__ = [
    "LAUNCH_TTL_MS", "MODEL_SELECTOR", "PACKET_KIND", "REVIEWER_DEFINITION_SHA256",
    "REVIEWER_NAME", "ROLE_KERNEL_SHA256", "SCHEMA_VERSION", "STATE_SCHEMA", "THINKING_LEVEL",
    "describe", "launch", "package_manifest", "package_sha256",
]
