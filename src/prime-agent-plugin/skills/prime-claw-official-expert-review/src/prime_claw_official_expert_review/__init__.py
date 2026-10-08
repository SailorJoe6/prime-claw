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
REVIEWER_DEFINITION_SHA256 = "dcd02e81e7e0656a3d7eb89ccfa78bd8b24a8492de012122f82b17b7aec50a05"
ROLE_KERNEL_SHA256 = "fd370726c28097b4201f538958e32ddc0af8abdb7c72d675412df0c698bb328e"
LAUNCH_TTL_MS = 15 * 60 * 1000
STATE_SCHEMA = "prime-claw-official-expert-launch-v1"
REPORT_SCHEMA = "prime-claw-official-expert-report-v1"
RECEIPT_SCHEMA = "prime-claw-official-expert-receipt-v1"
PACKET_KIND = "prime-claw-official-expert-review-packet"
REPORT_VERDICTS = frozenset({"PASS", "BLOCK", "ADVISORY", "SPEC_QUESTION"})
DISPOSITION_DECISIONS = frozenset({"ACCEPT", "REVISE", "PAUSE", "CONSULT"})
REPORT_LIMIT_BYTES = 12 * 1024
DISPOSITION_LIMIT_BYTES = 8 * 1024
_LIVE_PHASES = ("PENDING", "FINALIZED", "CLAIMED", "REPORTED", "SETTLED", "DISPOSITIONED", "CLOSED", "CANCELLED")
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
        "capability": "private-review-lifecycle-closure",
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


def _git_identity(worktree: str) -> tuple[Path, str]:
    marker_path = Path(worktree)
    if not marker_path.is_absolute():
        raise RuntimeError("candidate repository is not the exact active episode worktree root")
    root = marker_path.resolve(strict=True)
    if worktree != str(root):
        raise RuntimeError("candidate repository is not the exact active episode worktree root")
    toplevel_output = subprocess.run(
        ["git", "-C", worktree, "rev-parse", "--show-toplevel"], check=True,
        stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=10,
    ).stdout
    toplevel = toplevel_output[:-1] if toplevel_output.endswith("\n") else toplevel_output
    if toplevel != worktree:
        raise RuntimeError("candidate repository is not the exact active episode worktree root")
    oid = subprocess.run(
        ["git", "-C", worktree, "rev-parse", "HEAD"], check=True,
        stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=10,
    ).stdout.strip()
    if len(oid) not in (40, 64) or any(char not in "0123456789abcdef" for char in oid):
        raise RuntimeError("candidate HEAD is not an exact commit OID")
    return root, oid


def _repository_snapshot(worktree: str) -> dict[str, Any]:
    repository, head = _git_identity(worktree)
    result = subprocess.run(
        ["git", "-C", str(repository), "status", "--porcelain=v1", "-z", "--untracked-files=all"],
        check=True, stdin=subprocess.DEVNULL, capture_output=True, timeout=10,
    )
    status_bytes = result.stdout
    return {
        "head": head,
        "clean": not status_bytes,
        "statusBytes": len(status_bytes),
        "statusSha256": _digest(status_bytes),
    }


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
    encoded = (_canonical(value) + "\n").encode()
    if len(encoded) > 64 * 1024:
        raise ValueError("official EXPERT private state exceeds its bounded file size")
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
    except BaseException:
        path.unlink(missing_ok=True)
        raise




def _private_record(path: Path) -> dict[str, Any]:
    metadata = path.lstat()
    if (
        path.is_symlink() or not path.is_file() or path.resolve(strict=True) != path
        or stat.S_IMODE(metadata.st_mode) != 0o600 or metadata.st_size > 64 * 1024
    ):
        raise RuntimeError("official EXPERT private state file is not canonical and mode-private")
    raw = path.read_bytes()
    if not raw.endswith(b"\n") or raw.count(b"\n") != 1:
        raise RuntimeError("official EXPERT private state file is malformed")
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise RuntimeError("official EXPERT private state is malformed")
    return value


def _required_string(record: dict[str, Any], key: str) -> str:
    value = record.get(key)
    if not isinstance(value, str) or not value:
        raise RuntimeError(f"official EXPERT state {key} is malformed")
    return value


def _required_integer(record: dict[str, Any], key: str) -> int:
    value = record.get(key)
    if type(value) is not int:
        raise RuntimeError(f"official EXPERT state {key} is malformed")
    return value


def _canonical_path(value: str, label: str) -> Path:
    path = Path(value)
    if not path.is_absolute():
        raise RuntimeError(f"{label} is not canonical")
    canonical = path.resolve(strict=True)
    if value != str(canonical):
        raise RuntimeError(f"{label} is not canonical")
    return canonical


def _session_entries(path: Path) -> list[dict[str, Any]]:
    if path.is_symlink() or not path.is_file() or path.resolve(strict=True) != path:
        raise RuntimeError("session file is not a canonical regular file")
    entries: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as stream:
        for line in stream:
            value = json.loads(line)
            if not isinstance(value, dict):
                raise RuntimeError("session entry is malformed")
            entries.append(value)
    if not entries:
        raise RuntimeError("session file is empty")
    return entries


def _runtime_directory(depth: int) -> Path:
    value = os.environ.get("RLM_SESSION_DIR")
    if os.environ.get("RLM_DEPTH") != str(depth) or not value:
        raise RuntimeError(f"official EXPERT operation requires a persisted depth-{depth} kernel")
    return _canonical_path(value, "current RLM session directory")


def _state_paths(root: Path, child_name: str) -> dict[str, Path]:
    if (
        not child_name.startswith("expert-review-") or not 30 <= len(child_name) <= 80
        or any(character not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for character in child_name)
    ):
        raise RuntimeError("official EXPERT child name is malformed")
    return {
        phase: root / f"{child_name}.{phase}.json"
        for phase in (
            "pending", "finalized", "claimed", "reported", "settled", "dispositioned",
            "closed", "cancelled", "settlement-rejected",
        )
    }


def _phase_records(root: Path, phase: str) -> list[tuple[Path, dict[str, Any]]]:
    records: list[tuple[Path, dict[str, Any]]] = []
    for path in sorted(root.glob(f"*.{phase.lower()}.json")):
        record = _private_record(path)
        if record.get("phase") != phase:
            raise RuntimeError("official EXPERT private state phase and filename disagree")
        paths = _state_paths(root, _required_string(record, "childName"))
        if path != paths[phase.lower()]:
            raise RuntimeError("official EXPERT private state filename is invalid")
        records.append((path, record))
    return records


def _validate_snapshot(value: Any, candidate: str, *, clean: bool) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != {"head", "clean", "statusBytes", "statusSha256"}:
        raise RuntimeError("official EXPERT repository snapshot is malformed")
    if (
        value.get("head") != candidate or value.get("clean") is not clean
        or type(value.get("statusBytes")) is not int or value["statusBytes"] < 0
        or not isinstance(value.get("statusSha256"), str) or len(value["statusSha256"]) != 64
    ):
        raise RuntimeError("official EXPERT repository snapshot is invalid")
    if clean and (value["statusBytes"] != 0 or value["statusSha256"] != _digest(b"")):
        raise RuntimeError("official EXPERT clean repository snapshot is invalid")
    return value


def _validate_lineage(
    record: dict[str, Any], phases: set[str], *, runtime_directory: Path | None = None,
    require_live: bool = False,
) -> None:
    phase = record.get("phase")
    if record.get("schema") != STATE_SCHEMA or phase not in phases:
        raise RuntimeError("private launch schema or phase is invalid")
    created = _required_integer(record, "createdAt")
    expires = _required_integer(record, "expiresAt")
    if created < 0 or expires != created + LAUNCH_TTL_MS or (require_live and int(time.time() * 1000) >= expires):
        raise RuntimeError("private launch is stale or expired")
    if _required_string(record, "packageSha256") != package_sha256():
        raise RuntimeError("exact official EXPERT package is unavailable or changed")
    if record.get("kernelSha256") != ROLE_KERNEL_SHA256:
        raise RuntimeError("exact neutral role kernel is unavailable or changed")
    if (
        record.get("selector") != MODEL_SELECTOR or record.get("returnedModel") != MODEL_SELECTOR
        or record.get("thinking") != THINKING_LEVEL
    ):
        raise RuntimeError("official EXPERT model lineage is invalid")

    child_name = _required_string(record, "childName")
    child_directory = _canonical_path(_required_string(record, "sessionDir"), "child session directory")
    if child_directory.name != _required_string(record, "rlmChildId"):
        raise RuntimeError("child session directory and RLM id disagree")
    if runtime_directory is not None and runtime_directory != child_directory:
        raise RuntimeError("current child runtime does not match the claimed launch")
    child_file = _canonical_path(_required_string(record, "childSessionFile"), "child session file")
    if child_file.parent != child_directory:
        raise RuntimeError("child session file is outside its exact session directory")
    child_entries = _session_entries(child_file)
    child_header = child_entries[0]
    if (
        child_header.get("type") != "session"
        or child_header.get("id") != _required_string(record, "childSessionId")
        or child_header.get("rlmDepth") != 1
    ):
        raise RuntimeError("child session header identity is invalid")
    if record.get("childSessionName") != child_name:
        raise RuntimeError("child session name binding is invalid")

    owner_file = _canonical_path(_required_string(record, "ownerSessionFile"), "owner session file")
    owner_entries = _session_entries(owner_file)
    owner_id = _required_string(record, "ownerSessionId")
    owner_header = owner_entries[0]
    project = _canonical_path(_required_string(record, "projectPath"), "owner project path")
    if (
        owner_header.get("type") != "session" or owner_header.get("id") != owner_id
        or owner_header.get("id") != _required_string(record, "ownerHeaderId")
        or owner_header.get("cwd") != str(project) or owner_header.get("parentSession") is not None
        or child_header.get("parentSession") != str(owner_file) or child_header.get("cwd") != str(project)
    ):
        raise RuntimeError("canonical parent/child session lineage is invalid")
    marker = _active_marker(owner_entries[1:], owner_id)
    if _owner_generation(marker) != _required_string(record, "ownerGeneration"):
        raise RuntimeError("owner episode generation changed or mismatched")

    repository_value = _required_string(record, "repositoryPath")
    repository = _canonical_path(repository_value, "candidate repository path")
    if marker.get("worktree") != repository_value:
        raise RuntimeError("candidate repository no longer matches the owner generation")
    candidate = _required_string(record, "candidateCommitOid")
    if len(candidate) not in (40, 64) or any(character not in "0123456789abcdef" for character in candidate):
        raise RuntimeError("candidate commit binding is invalid")
    _validate_snapshot(record.get("preReviewRepository"), candidate, clean=True)
    packet = record.get("packet")
    packet_json = record.get("packetJson")
    if (
        not isinstance(packet, dict) or not isinstance(packet_json, str)
        or _canonical(packet) != packet_json or _digest(packet_json.encode()) != record.get("packetDigest")
        or packet.get("repositoryPath") != str(repository) or packet.get("commitOid") != candidate
    ):
        raise RuntimeError("immutable review packet digest is invalid")


def _canonical_report(value: Any) -> tuple[dict[str, Any], str, str]:
    if not isinstance(value, dict) or set(value) != {"schemaVersion", "verdict", "summary", "findings"}:
        raise ValueError("official EXPERT report has unexpected fields")
    verdict = value.get("verdict")
    summary = value.get("summary")
    findings = value.get("findings")
    if (
        value.get("schemaVersion") != 1 or verdict not in REPORT_VERDICTS
        or not isinstance(summary, str) or not summary.strip() or len(summary) > 4000 or "\x00" in summary
        or not isinstance(findings, list) or len(findings) > 16
    ):
        raise ValueError("official EXPERT report is malformed or oversized")
    counts = {kind: 0 for kind in ("BLOCK", "ADVISORY", "SPEC_QUESTION")}
    normalized: list[dict[str, str]] = []
    for finding in findings:
        if not isinstance(finding, dict) or set(finding) != {"severity", "summary", "evidence", "remediation"}:
            raise ValueError("official EXPERT report finding has unexpected fields")
        severity = finding.get("severity")
        if severity not in counts:
            raise ValueError("official EXPERT report finding severity is invalid")
        strings = {key: finding.get(key) for key in ("summary", "evidence", "remediation")}
        if (
            not isinstance(strings["summary"], str) or not strings["summary"].strip() or len(strings["summary"]) > 1000
            or not isinstance(strings["evidence"], str) or not strings["evidence"].strip() or len(strings["evidence"]) > 4000
            or not isinstance(strings["remediation"], str) or len(strings["remediation"]) > 4000
            or any("\x00" in item for item in strings.values())
            or (severity == "BLOCK" and not strings["remediation"].strip())
        ):
            raise ValueError("official EXPERT report finding is malformed or lacks actionable BLOCK remediation")
        counts[severity] += 1
        normalized.append({"severity": severity, **strings})
    if (
        (verdict == "PASS" and findings)
        or (verdict == "BLOCK" and counts["BLOCK"] == 0)
        or (verdict == "SPEC_QUESTION" and (counts["SPEC_QUESTION"] == 0 or counts["BLOCK"] > 0))
        or (verdict == "ADVISORY" and (counts["ADVISORY"] == 0 or counts["BLOCK"] > 0 or counts["SPEC_QUESTION"] > 0))
    ):
        raise ValueError("official EXPERT report verdict and findings disagree")
    normalized_report = {"schemaVersion": 1, "verdict": verdict, "summary": summary, "findings": normalized}
    canonical = _canonical(normalized_report)
    if len(canonical.encode()) > REPORT_LIMIT_BYTES:
        raise ValueError("official EXPERT report is too large")
    return normalized_report, canonical, _digest(canonical.encode())


def _transition(source: Path, destination: Path, value: dict[str, Any]) -> None:
    temporary = destination.parent / f".{destination.name}.{secrets.token_hex(8)}.tmp"
    _exclusive_json(temporary, value)
    try:
        os.link(temporary, destination)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise
    temporary.unlink()
    try:
        source.unlink()
    except BaseException:
        raise RuntimeError("official EXPERT state transition published conflicting phase files")


def _report_result(record: dict[str, Any]) -> dict[str, Any]:
    report = record.get("report")
    receipt = record.get("reportReceipt")
    reported_at = _required_integer(record, "reportedAt")
    accepted = record.get("reportAccepted")
    if not isinstance(report, dict) or not isinstance(receipt, dict) or type(accepted) is not bool:
        raise RuntimeError("reported official EXPERT state is malformed")
    report_digest = _digest(_canonical(report).encode())
    expected_receipt = {
        "schema": RECEIPT_SCHEMA, "phase": "REPORTED", "childName": record["childName"],
        "candidateCommitOid": record["candidateCommitOid"], "packetDigest": record["packetDigest"],
        "reportDigest": report_digest, "repositoryUnchanged": accepted, "reportedAt": reported_at,
    }
    snapshot = record.get("postReviewRepository")
    if (
        report_digest != record.get("reportDigest") or receipt != expected_receipt
        or not isinstance(snapshot, dict)
        or set(snapshot) != {"head", "clean", "statusBytes", "statusSha256"}
        or not isinstance(snapshot.get("head"), str) or type(snapshot.get("clean")) is not bool
        or type(snapshot.get("statusBytes")) is not int or snapshot["statusBytes"] < 0
        or not isinstance(snapshot.get("statusSha256"), str) or len(snapshot["statusSha256"]) != 64
        or (accepted and snapshot != record.get("preReviewRepository"))
    ):
        raise RuntimeError("reported official EXPERT digest, receipt, or repository evidence is invalid")
    return {"report": report, "receipt": receipt}


def _settled_result(record: dict[str, Any]) -> dict[str, Any]:
    reported = _report_result(record)
    settled_at = _required_integer(record, "settledAt")
    settlement_receipt = record.get("settlementReceipt")
    expected_receipt = {
        "schema": RECEIPT_SCHEMA, "phase": "SETTLED", "childName": record["childName"],
        "candidateCommitOid": record["candidateCommitOid"], "reportDigest": record["reportDigest"],
        "repositoryUnchanged": True, "settledAt": settled_at,
    }
    expected_result = {
        "report": reported["report"], "reportReceipt": reported["receipt"],
        "settlementReceipt": expected_receipt,
    }
    if (
        record.get("reportAccepted") is not True
        or record.get("settlementRepository") != record.get("preReviewRepository")
        or settlement_receipt != expected_receipt or record.get("settlementResult") != expected_result
    ):
        raise RuntimeError("settled official EXPERT report or receipt is invalid")
    return expected_result


def submit(report: dict[str, Any]) -> dict[str, Any]:
    """Submit exactly one structured report from the admitted depth-1 child."""
    runtime = _runtime_directory(1)
    root = _ensure_private_root()
    report_value, report_json, report_digest = _canonical_report(report)
    matches: list[tuple[Path, dict[str, Any]]] = []
    for phase in ("CLAIMED", "REPORTED", "SETTLED"):
        for path, record in _phase_records(root, phase):
            if record.get("sessionDir") == str(runtime) and record.get("rlmChildId") == runtime.name:
                matches.append((path, record))
    if len(matches) != 1:
        raise RuntimeError("current child does not have exactly one private review state")
    path, record = matches[0]
    phase = record["phase"]
    _validate_lineage(record, {phase}, runtime_directory=runtime, require_live=phase == "CLAIMED")
    if phase == "SETTLED":
        raise RuntimeError("settled official EXPERT report cannot be replayed")
    if phase == "REPORTED":
        if record.get("reportDigest") != report_digest or _canonical(record.get("report")) != report_json:
            raise RuntimeError("conflicting official EXPERT report was already submitted")
        if record.get("reportAccepted") is not True:
            raise RuntimeError("official EXPERT report recorded a mutated candidate and was rejected")
        return _report_result(record)

    snapshot = _repository_snapshot(_required_string(record, "repositoryPath"))
    unchanged = snapshot["head"] == record["candidateCommitOid"] and snapshot["clean"] is True
    reported_at = int(time.time() * 1000)
    receipt = {
        "schema": RECEIPT_SCHEMA, "phase": "REPORTED", "childName": record["childName"],
        "candidateCommitOid": record["candidateCommitOid"], "packetDigest": record["packetDigest"],
        "reportDigest": report_digest, "repositoryUnchanged": unchanged, "reportedAt": reported_at,
    }
    reported = {
        **record, "phase": "REPORTED", "reportedAt": reported_at, "report": report_value,
        "reportDigest": report_digest, "postReviewRepository": snapshot,
        "reportAccepted": unchanged, "reportReceipt": receipt,
    }
    paths = _state_paths(root, record["childName"])
    _transition(path, paths["reported"], reported)
    if not unchanged:
        raise RuntimeError("official EXPERT report recorded a mutated candidate and was rejected")
    return {"report": report_value, "receipt": receipt}


def _owner_state_matches(
    record: dict[str, Any], owner_id: str, owner_file: Path, generation: str, repository: Path,
) -> bool:
    return (
        record.get("ownerSessionId") == owner_id and record.get("ownerHeaderId") == owner_id
        and record.get("ownerSessionFile") == str(owner_file)
        and record.get("ownerGeneration") == generation and record.get("repositoryPath") == str(repository)
    )


def settle() -> dict[str, Any]:
    """Settle and read the unique reported review owned by this depth-0 Conversation."""
    _runtime_directory(0)
    owner_id, owner_file, owner_header, entries = _owner_session()
    marker = _active_marker(entries, owner_id)
    generation = _owner_generation(marker)
    project = _canonical_path(str(owner_header.get("cwd", "")), "owner project path")
    if project != Path.cwd().resolve(strict=True):
        raise RuntimeError("owner kernel cwd does not match its canonical session project")
    repository, _current_head = _git_identity(marker["worktree"])
    root = _ensure_private_root()
    reported = [
        (path, value) for path, value in _phase_records(root, "REPORTED")
        if _owner_state_matches(value, owner_id, owner_file, generation, repository)
    ]
    if not reported:
        settled = [
            (path, value) for path, value in _phase_records(root, "SETTLED")
            if _owner_state_matches(value, owner_id, owner_file, generation, repository)
        ]
        current = [item for item in settled if item[1].get("candidateCommitOid") == _current_head]
        if len(current) != 1:
            raise RuntimeError("owner does not have exactly one matching reported or settled review")
        _path, record = current[0]
        _validate_lineage(record, {"SETTLED"})
        return _settled_result(record)
    if len(reported) != 1:
        raise RuntimeError("owner does not have exactly one matching reported review")
    path, record = reported[0]
    _validate_lineage(record, {"REPORTED"})
    reported_result = _report_result(record)
    if record.get("reportAccepted") is not True:
        raise RuntimeError("reported official EXPERT review rejected a mutated candidate")
    paths = _state_paths(root, record["childName"])
    if paths["settlement-rejected"].exists():
        raise RuntimeError("official EXPERT settlement was already rejected for repository mutation")
    snapshot = _repository_snapshot(str(repository))
    report_snapshot = record.get("postReviewRepository")
    unchanged = (
        snapshot["head"] == record["candidateCommitOid"] and snapshot["clean"] is True
        and isinstance(report_snapshot, dict) and report_snapshot == record.get("preReviewRepository")
    )
    if not unchanged:
        rejection = {
            "schema": STATE_SCHEMA, "phase": "SETTLEMENT_REJECTED", "childName": record["childName"],
            "ownerSessionId": owner_id, "ownerGeneration": generation,
            "candidateCommitOid": record["candidateCommitOid"], "reportDigest": record["reportDigest"],
            "settlementRepository": snapshot, "rejectedAt": int(time.time() * 1000),
        }
        _exclusive_json(paths["settlement-rejected"], rejection)
        raise RuntimeError("official EXPERT settlement recorded a mutated candidate and was rejected")
    settled_at = int(time.time() * 1000)
    settlement_receipt = {
        "schema": RECEIPT_SCHEMA, "phase": "SETTLED", "childName": record["childName"],
        "candidateCommitOid": record["candidateCommitOid"], "reportDigest": record["reportDigest"],
        "repositoryUnchanged": True, "settledAt": settled_at,
    }
    result = {
        "report": reported_result["report"], "reportReceipt": reported_result["receipt"],
        "settlementReceipt": settlement_receipt,
    }
    settled_record = {
        **record, "phase": "SETTLED", "settledAt": settled_at,
        "settlementRepository": snapshot, "settlementReceipt": settlement_receipt,
        "settlementResult": result,
    }
    _transition(path, paths["settled"], settled_record)
    return result




def _owner_context() -> tuple[str, Path, str, Path, Path, str]:
    _runtime_directory(0)
    owner_id, owner_file, owner_header, entries = _owner_session()
    marker = _active_marker(entries, owner_id)
    generation = _owner_generation(marker)
    project = _canonical_path(str(owner_header.get("cwd", "")), "owner project path")
    if project != Path.cwd().resolve(strict=True):
        raise RuntimeError("owner kernel cwd does not match its canonical session project")
    repository, current_head = _git_identity(marker["worktree"])
    return owner_id, owner_file, generation, project, repository, current_head


def _owned_phase_records(
    root: Path, phases: tuple[str, ...], owner_id: str, owner_file: Path,
    generation: str, repository: Path,
) -> list[tuple[Path, dict[str, Any]]]:
    records: list[tuple[Path, dict[str, Any]]] = []
    for phase in phases:
        records.extend(
            (path, record) for path, record in _phase_records(root, phase)
            if _owner_state_matches(record, owner_id, owner_file, generation, repository)
        )
    return records


def _assert_unique_child_phase(root: Path, child_name: str, selected: Path) -> None:
    paths = _state_paths(root, child_name)
    existing = [paths[phase.lower()] for phase in _LIVE_PHASES if paths[phase.lower()].exists()]
    if existing != [selected]:
        raise RuntimeError("conflicting official EXPERT private phase files exist")


def _canonical_disposition(value: Any) -> tuple[dict[str, Any], str, str]:
    if not isinstance(value, dict) or set(value) != {"schemaVersion", "decision", "rationale"}:
        raise ValueError("official EXPERT disposition has unexpected fields")
    decision = value.get("decision")
    rationale = value.get("rationale")
    if (
        value.get("schemaVersion") != 1 or decision not in DISPOSITION_DECISIONS
        or not isinstance(rationale, str) or not rationale.strip() or len(rationale) > 4000
        or "\x00" in rationale
    ):
        raise ValueError("official EXPERT disposition is malformed or oversized")
    normalized = {"schemaVersion": 1, "decision": decision, "rationale": rationale}
    canonical = _canonical(normalized)
    if len(canonical.encode()) > DISPOSITION_LIMIT_BYTES:
        raise ValueError("official EXPERT disposition is too large")
    return normalized, canonical, _digest(canonical.encode())


def _disposition_result(record: dict[str, Any]) -> dict[str, Any]:
    settled = _settled_result(record)
    value = record.get("disposition")
    canonical = record.get("dispositionJson")
    digest = record.get("dispositionDigest")
    disposed_at = _required_integer(record, "disposedAt")
    receipt = record.get("dispositionReceipt")
    if not isinstance(value, dict) or not isinstance(canonical, str):
        raise RuntimeError("dispositioned official EXPERT state is malformed")
    expected_receipt = {
        "schema": RECEIPT_SCHEMA, "phase": "DISPOSITIONED", "childName": record["childName"],
        "candidateCommitOid": record["candidateCommitOid"], "reportDigest": record["reportDigest"],
        "dispositionDigest": digest, "decision": value.get("decision"), "disposedAt": disposed_at,
    }
    if _canonical(value) != canonical or _digest(canonical.encode()) != digest or receipt != expected_receipt:
        raise RuntimeError("official EXPERT disposition digest or receipt is invalid")
    return {
        **settled, "disposition": value, "dispositionReceipt": expected_receipt,
    }


def record_disposition(disposition: dict[str, Any]) -> dict[str, Any]:
    """Record one exact conversational owner disposition for the settled report."""
    value, canonical, digest = _canonical_disposition(disposition)
    owner_id, owner_file, generation, _project, repository, current_head = _owner_context()
    root = _ensure_private_root()
    matches = _owned_phase_records(
        root, ("SETTLED", "DISPOSITIONED", "CLOSED"), owner_id, owner_file, generation, repository,
    )
    current = [item for item in matches if item[1].get("candidateCommitOid") == current_head]
    if len(current) != 1:
        raise RuntimeError("owner does not have exactly one matching settled or dispositioned review")
    path, record = current[0]
    _assert_unique_child_phase(root, record["childName"], path)
    phase = record["phase"]
    _validate_lineage(record, {phase})
    if phase in {"DISPOSITIONED", "CLOSED"}:
        if record.get("dispositionDigest") != digest or record.get("dispositionJson") != canonical:
            raise RuntimeError("conflicting official EXPERT owner disposition was already recorded")
        return _disposition_result(record)
    _settled_result(record)
    snapshot = _repository_snapshot(str(repository))
    if snapshot != record.get("preReviewRepository"):
        raise RuntimeError("official EXPERT disposition requires the exact unchanged candidate repository")
    disposed_at = int(time.time() * 1000)
    receipt = {
        "schema": RECEIPT_SCHEMA, "phase": "DISPOSITIONED", "childName": record["childName"],
        "candidateCommitOid": record["candidateCommitOid"], "reportDigest": record["reportDigest"],
        "dispositionDigest": digest, "decision": value["decision"], "disposedAt": disposed_at,
    }
    updated = {
        **record, "phase": "DISPOSITIONED", "disposedAt": disposed_at,
        "disposition": value, "dispositionJson": canonical, "dispositionDigest": digest,
        "dispositionReceipt": receipt,
    }
    _transition(path, _state_paths(root, record["childName"])["dispositioned"], updated)
    return _disposition_result(updated)


def _replace_private_record(path: Path, value: dict[str, Any]) -> None:
    temporary = path.parent / f".{path.name}.{secrets.token_hex(8)}.tmp"
    _exclusive_json(temporary, value)
    try:
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def _record_deletion_failure(path: Path, record: dict[str, Any], operation: str, error: BaseException) -> None:
    message = str(error).replace("\x00", "")[:1000]
    failure = {
        "method": "public-rlm", "operation": operation,
        "errorType": type(error).__name__, "message": message,
        "failedAt": int(time.time() * 1000),
    }
    _replace_private_record(path, {**record, "lastDeletionFailure": failure})


def _roster_entry(entry: Any) -> dict[str, Any]:
    values = {
        "rlmChildId": getattr(entry, "rlm_child_id", None),
        "sessionName": getattr(entry, "session_name", None),
        "sessionDir": str(getattr(entry, "session_dir", "")),
        "sessionId": getattr(entry, "session_id", None),
        "activeSessionId": getattr(entry, "active_session_id", None),
        "status": getattr(entry, "status", None),
    }
    if (
        not isinstance(values["rlmChildId"], str) or not values["rlmChildId"]
        or not isinstance(values["sessionName"], str) or not values["sessionName"]
        or not isinstance(values["sessionDir"], str) or not values["sessionDir"]
        or values["status"] not in {"running", "completed", "error"}
        or (values["sessionId"] is not None and not isinstance(values["sessionId"], str))
        or (values["activeSessionId"] is not None and not isinstance(values["activeSessionId"], str))
    ):
        raise RuntimeError("public RLM roster returned a malformed child entry")
    return values


def _related_roster_entries(record: dict[str, Any], roster: Any) -> list[tuple[Any, dict[str, Any]]]:
    if not isinstance(roster, list):
        raise RuntimeError("public RLM roster did not return an exact list")
    child_id = _required_string(record, "rlmChildId")
    child_name = _required_string(record, "childName")
    session_dir = _required_string(record, "sessionDir")
    related: list[tuple[Any, dict[str, Any]]] = []
    for entry in roster:
        fields = _roster_entry(entry)
        if fields["rlmChildId"] == child_id or fields["sessionName"] == child_name or fields["sessionDir"] == session_dir:
            related.append((entry, fields))
    return related


def _validate_exact_roster_entry(record: dict[str, Any], fields: dict[str, Any]) -> None:
    if (
        fields["rlmChildId"] != record.get("rlmChildId")
        or fields["sessionName"] != record.get("childName")
        or fields["sessionDir"] != record.get("sessionDir")
        or (record.get("childSessionId") is not None and fields["sessionId"] != record.get("childSessionId"))
    ):
        raise RuntimeError("public RLM roster child identity mismatches stored launch lineage")


def _deletion_snapshot(fields: dict[str, Any]) -> dict[str, Any]:
    return {
        key: fields[key]
        for key in ("rlmChildId", "sessionName", "sessionDir", "sessionId", "activeSessionId", "status")
    }


async def _prove_roster_absent(record: dict[str, Any]) -> None:
    import rlm

    related = _related_roster_entries(record, await rlm.list_subagents())
    if related:
        if len(related) > 1:
            raise RuntimeError("public RLM roster is ambiguous for the stored official EXPERT child")
        _validate_exact_roster_entry(record, related[0][1])
        raise RuntimeError("official EXPERT child remains addressable in the public RLM roster")


async def _ensure_child_absent(record: dict[str, Any]) -> dict[str, Any]:
    import rlm

    initial = _related_roster_entries(record, await rlm.list_subagents())
    if len(initial) > 1:
        raise RuntimeError("public RLM roster is ambiguous for the stored official EXPERT child")
    deleted: dict[str, Any] | None = None
    initial_status = "ABSENT"
    if initial:
        entry, fields = initial[0]
        _validate_exact_roster_entry(record, fields)
        initial_status = "PRESENT"
        result = await rlm.delete_subagent(entry)
        deleted = _roster_entry(result)
        _validate_exact_roster_entry(record, deleted)
    remaining = _related_roster_entries(record, await rlm.list_subagents())
    if remaining:
        if len(remaining) > 1:
            raise RuntimeError("public RLM roster remains ambiguous after deletion")
        _validate_exact_roster_entry(record, remaining[0][1])
        raise RuntimeError("public RLM deletion did not prove child absence")
    confirmed_at = int(time.time() * 1000)
    return {
        "method": "public-rlm", "childId": record["rlmChildId"], "childName": record["childName"],
        "sessionDir": record["sessionDir"], "initialRoster": initial_status,
        "deleteReceipt": _deletion_snapshot(deleted) if deleted is not None else None,
        "absenceConfirmed": True, "confirmedAt": confirmed_at,
    }


async def _prove_pending_unpublished(record: dict[str, Any]) -> dict[str, Any]:
    import rlm

    roster = await rlm.list_subagents()
    if not isinstance(roster, list):
        raise RuntimeError("public RLM roster did not return an exact list")
    matches = []
    for entry in roster:
        fields = _roster_entry(entry)
        if fields["sessionName"] == record["childName"]:
            matches.append(fields)
    if matches:
        raise RuntimeError("pending official EXPERT launch has an addressable child without stored actual identity")
    return {
        "method": "not-published", "childId": None, "childName": record["childName"],
        "sessionDir": None, "initialRoster": "NOT_PUBLISHED", "deleteReceipt": None,
        "absenceConfirmed": True, "confirmedAt": int(time.time() * 1000),
    }


def _closed_result(record: dict[str, Any]) -> dict[str, Any]:
    dispositioned = _disposition_result(record)
    evidence = record.get("deletionEvidence")
    evidence_digest = record.get("deletionEvidenceDigest")
    closed_at = _required_integer(record, "closedAt")
    receipt = record.get("closedReceipt")
    if not isinstance(evidence, dict) or evidence.get("absenceConfirmed") is not True:
        raise RuntimeError("closed official EXPERT deletion evidence is invalid")
    expected_receipt = {
        "schema": RECEIPT_SCHEMA, "phase": "CLOSED", "childName": record["childName"],
        "candidateCommitOid": record["candidateCommitOid"], "reportDigest": record["reportDigest"],
        "dispositionDigest": record["dispositionDigest"], "deletionEvidenceDigest": evidence_digest,
        "childAbsent": True, "closedAt": closed_at,
    }
    if _digest(_canonical(evidence).encode()) != evidence_digest or receipt != expected_receipt:
        raise RuntimeError("closed official EXPERT digest or receipt is invalid")
    receipt_digest = _digest(_canonical(expected_receipt).encode())
    if record.get("closedReceiptDigest") != receipt_digest:
        raise RuntimeError("closed official EXPERT receipt digest is invalid")
    return {**dispositioned, "closedReceipt": expected_receipt, "closedReceiptDigest": receipt_digest}


async def close() -> dict[str, Any]:
    """Delete or prove absence of the dispositioned child, then create CLOSED."""
    owner_id, owner_file, generation, _project, repository, current_head = _owner_context()
    root = _ensure_private_root()
    matches = _owned_phase_records(
        root, ("DISPOSITIONED", "CLOSED"), owner_id, owner_file, generation, repository,
    )
    current = [item for item in matches if item[1].get("candidateCommitOid") == current_head]
    if len(current) != 1:
        raise RuntimeError("owner does not have exactly one matching dispositioned or closed review")
    path, record = current[0]
    _assert_unique_child_phase(root, record["childName"], path)
    phase = record["phase"]
    _validate_lineage(record, {phase})
    if phase == "CLOSED":
        await _prove_roster_absent(record)
        return _closed_result(record)
    _disposition_result(record)
    try:
        evidence = await _ensure_child_absent(record)
    except BaseException as error:
        _record_deletion_failure(path, record, "close", error)
        raise
    closed_at = int(time.time() * 1000)
    evidence_digest = _digest(_canonical(evidence).encode())
    receipt = {
        "schema": RECEIPT_SCHEMA, "phase": "CLOSED", "childName": record["childName"],
        "candidateCommitOid": record["candidateCommitOid"], "reportDigest": record["reportDigest"],
        "dispositionDigest": record["dispositionDigest"], "deletionEvidenceDigest": evidence_digest,
        "childAbsent": True, "closedAt": closed_at,
    }
    receipt_digest = _digest(_canonical(receipt).encode())
    updated = {
        **record, "phase": "CLOSED", "closedAt": closed_at, "deletionEvidence": evidence,
        "deletionEvidenceDigest": evidence_digest, "closedReceipt": receipt,
        "closedReceiptDigest": receipt_digest,
    }
    _transition(path, _state_paths(root, record["childName"])["closed"], updated)
    return _closed_result(updated)


def _validate_stale_owner_record(
    record: dict[str, Any], phase: str, owner_id: str, owner_file: Path,
    generation: str, project: Path, repository: Path,
) -> None:
    if record.get("schema") != STATE_SCHEMA or record.get("phase") != phase:
        raise RuntimeError("private launch schema or phase is invalid")
    created = _required_integer(record, "createdAt")
    expires = _required_integer(record, "expiresAt")
    if created < 0 or expires != created + LAUNCH_TTL_MS or int(time.time() * 1000) < expires:
        raise RuntimeError("private launch is not exactly expired")
    if not _owner_state_matches(record, owner_id, owner_file, generation, repository):
        raise RuntimeError("expired launch does not match the exact current owner")
    if record.get("projectPath") != str(project):
        raise RuntimeError("expired launch project does not match the exact current owner")
    if record.get("packageSha256") != package_sha256() or record.get("kernelSha256") != ROLE_KERNEL_SHA256:
        raise RuntimeError("expired launch package or kernel lineage is invalid")
    if record.get("selector") != MODEL_SELECTOR or record.get("thinking") != THINKING_LEVEL:
        raise RuntimeError("expired launch requested model lineage is invalid")
    candidate = _required_string(record, "candidateCommitOid")
    _validate_snapshot(record.get("preReviewRepository"), candidate, clean=True)
    packet = record.get("packet")
    packet_json = record.get("packetJson")
    if (
        not isinstance(packet, dict) or not isinstance(packet_json, str)
        or _canonical(packet) != packet_json or _digest(packet_json.encode()) != record.get("packetDigest")
        or packet.get("repositoryPath") != str(repository) or packet.get("commitOid") != candidate
    ):
        raise RuntimeError("expired launch packet digest is invalid")
    child_name = _required_string(record, "childName")
    _state_paths(_private_root(), child_name)
    if phase == "PENDING":
        if any(key in record for key in ("rlmChildId", "sessionDir", "returnedModel", "childSessionId")):
            raise RuntimeError("pending launch unexpectedly contains published child identity")
    else:
        child_id = _required_string(record, "rlmChildId")
        child_dir = _canonical_path(_required_string(record, "sessionDir"), "child session directory")
        if child_dir.name != child_id or record.get("returnedModel") != MODEL_SELECTOR:
            raise RuntimeError("expired published child identity is invalid")
        if phase == "CLAIMED":
            _validate_lineage(record, {"CLAIMED"})


def _cancelled_result(record: dict[str, Any]) -> dict[str, Any]:
    evidence = record.get("deletionEvidence")
    evidence_digest = record.get("deletionEvidenceDigest")
    cancelled_at = _required_integer(record, "cancelledAt")
    receipt = record.get("cancellationReceipt")
    if not isinstance(evidence, dict) or evidence.get("absenceConfirmed") is not True:
        raise RuntimeError("cancelled official EXPERT deletion evidence is invalid")
    expected = {
        "schema": RECEIPT_SCHEMA, "phase": "CANCELLED", "childName": record["childName"],
        "candidateCommitOid": record["candidateCommitOid"], "sourcePhase": record["cancelledFrom"],
        "deletionEvidenceDigest": evidence_digest, "childAbsent": True, "cancelledAt": cancelled_at,
    }
    if _digest(_canonical(evidence).encode()) != evidence_digest or receipt != expected:
        raise RuntimeError("cancelled official EXPERT digest or receipt is invalid")
    return {"cancellationReceipt": expected, "cancellationReceiptDigest": _digest(_canonical(expected).encode())}


async def cancel_stale() -> dict[str, Any]:
    """Cancel one exact expired pre-report launch owned by this Conversation."""
    owner_id, owner_file, generation, project, repository, _current_head = _owner_context()
    root = _ensure_private_root()
    matches = _owned_phase_records(
        root, ("PENDING", "FINALIZED", "CLAIMED", "CANCELLED"),
        owner_id, owner_file, generation, repository,
    )
    if len(matches) != 1:
        raise RuntimeError("owner does not have exactly one matching stale or cancelled launch")
    path, record = matches[0]
    _assert_unique_child_phase(root, record["childName"], path)
    phase = record["phase"]
    if phase == "CANCELLED":
        return _cancelled_result(record)
    _validate_stale_owner_record(record, phase, owner_id, owner_file, generation, project, repository)
    try:
        evidence = await _prove_pending_unpublished(record) if phase == "PENDING" else await _ensure_child_absent(record)
    except BaseException as error:
        _record_deletion_failure(path, record, "cancel-stale", error)
        raise
    cancelled_at = int(time.time() * 1000)
    evidence_digest = _digest(_canonical(evidence).encode())
    receipt = {
        "schema": RECEIPT_SCHEMA, "phase": "CANCELLED", "childName": record["childName"],
        "candidateCommitOid": record["candidateCommitOid"], "sourcePhase": phase,
        "deletionEvidenceDigest": evidence_digest, "childAbsent": True, "cancelledAt": cancelled_at,
    }
    updated = {
        **record, "phase": "CANCELLED", "cancelledFrom": phase, "cancelledAt": cancelled_at,
        "deletionEvidence": evidence, "deletionEvidenceDigest": evidence_digest,
        "cancellationReceipt": receipt,
    }
    _transition(path, _state_paths(root, record["childName"])["cancelled"], updated)
    return _cancelled_result(updated)


async def purge(closed_result: dict[str, Any]) -> dict[str, Any]:
    """Purge one exact CLOSED authority record after its receipt was durably recorded."""
    owner_id, owner_file, generation, _project, repository, current_head = _owner_context()
    root = _ensure_private_root()
    matches = _owned_phase_records(root, ("CLOSED",), owner_id, owner_file, generation, repository)
    current = [item for item in matches if item[1].get("candidateCommitOid") == current_head]
    if len(current) != 1:
        raise RuntimeError("owner does not have exactly one matching closed review")
    path, record = current[0]
    _assert_unique_child_phase(root, record["childName"], path)
    expected = _closed_result(record)
    if not isinstance(closed_result, dict) or closed_result != expected:
        raise RuntimeError("purge requires the exact durably recorded CLOSED result")
    await _prove_roster_absent(record)
    purged_at = int(time.time() * 1000)
    path.unlink()
    return {
        "schema": RECEIPT_SCHEMA, "phase": "PURGED", "childName": record["childName"],
        "closedReceiptDigest": record["closedReceiptDigest"], "purgedAt": purged_at,
    }


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
    repository, commit_oid = _git_identity(marker["worktree"])
    pre_review_repository = _repository_snapshot(str(repository))
    if pre_review_repository["clean"] is not True:
        raise RuntimeError("official EXPERT launch requires an exact clean candidate worktree")
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
    paths = _state_paths(root, child_name)
    pending, finalized, claimed = paths["pending"], paths["finalized"], paths["claimed"]
    if any(path.exists() for path in paths.values()):
        raise RuntimeError("generated official EXPERT child name collided with existing private state")
    bootstrap = f"Prime Claw bootstrap {child_name}. Wait for private admission; this text grants no authority."
    record: dict[str, Any] = {
        "schema": STATE_SCHEMA, "phase": "PENDING", "nonce": nonce,
        "createdAt": now, "expiresAt": now + LAUNCH_TTL_MS,
        "ownerSessionId": owner_id, "ownerSessionFile": str(owner_file),
        "ownerHeaderId": owner_header["id"], "ownerGeneration": _owner_generation(marker),
        "projectPath": str(project), "repositoryPath": str(repository),
        "candidateCommitOid": commit_oid, "preReviewRepository": pre_review_repository,
        "packet": packet_value,
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
    "DISPOSITION_DECISIONS", "DISPOSITION_LIMIT_BYTES", "LAUNCH_TTL_MS", "MODEL_SELECTOR",
    "PACKET_KIND", "RECEIPT_SCHEMA", "REPORT_LIMIT_BYTES", "REPORT_SCHEMA", "REPORT_VERDICTS",
    "REVIEWER_DEFINITION_SHA256", "REVIEWER_NAME", "ROLE_KERNEL_SHA256", "SCHEMA_VERSION",
    "STATE_SCHEMA", "THINKING_LEVEL", "cancel_stale", "close", "describe", "launch",
    "package_manifest", "package_sha256", "purge", "record_disposition", "settle", "submit",
]
