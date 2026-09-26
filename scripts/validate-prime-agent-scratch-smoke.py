#!/usr/bin/env python3
"""Fail-closed, retained-root Prime Agent daemon smoke. Do not run native mode before review."""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass, field
import hashlib
import json
import math
import os
from pathlib import Path
import re
import selectors
import stat
import subprocess
import sys
import time
from typing import Protocol

SOCKET_BUDGET = 103  # macOS sun_path[104], reserving one NUL byte.
MAX_OUTPUT = 1_000_000
MAX_SCAN_ENTRIES = 2048
MAX_FIELD_BYTES = 4096
MAX_RECORD_BYTES = 65536
MAX_REPORT_BYTES = 256_000
MAX_COMMAND_BYTES = 1_000_000
START_RE = re.compile(r"^Daemon started on (.+) \(pid ([1-9][0-9]*)\)$")
# The probe wrapper invokes this driver with env -i. Any additional setting
# could reroute shutdown/discovery to live HOME, sockets, or provider state.
ALLOWED_ENV = frozenset({"PATH", "LANG", "HOME", "TMPDIR", "PRIME_CLAW_PROBE_ROOT",
                         "PRIME_AGENT_CODING_AGENT_DIR", "PRIME_AGENT_SESSION_DIR"})
SYSTEM_PATH = "/usr/bin:/bin:/usr/sbin:/sbin"  # Internal CLI child scans must not load user PATH tools.


class UnsafeScratch(RuntimeError):
    """Do not infer safety or retry the mutation after this failure."""


@dataclass
class CommandResult:
    returncode: int | None
    stdout: str = ""
    stderr: str = ""
    timed_out: bool = False
    output_truncated: bool = False
    child_unresolved: bool = False
    capture_failed: bool = False

    def record(self) -> dict:
        if len(self.stdout.encode()) > MAX_COMMAND_BYTES or len(self.stderr.encode()) > MAX_COMMAND_BYTES:
            raise UnsafeScratch("command result exceeds capture bound")
        # Keep failure diagnostics without printing raw CLI output or descriptor secrets.
        return {
            "returncode": self.returncode,
            "timed_out": self.timed_out,
            "output_truncated": self.output_truncated,
            "child_unresolved": self.child_unresolved,
            "capture_failed": self.capture_failed,
            "stdout_bytes": len(self.stdout.encode()),
            "stdout_sha256": hashlib.sha256(self.stdout.encode()).hexdigest(),
            "stderr_bytes": len(self.stderr.encode()),
            "stderr_sha256": hashlib.sha256(self.stderr.encode()).hexdigest(),
        }


@dataclass
class Observation:
    valid: bool = True
    reason: str = ""
    daemons: list[dict] = field(default_factory=list)
    root_refs: list[dict] = field(default_factory=list)
    unix_refs: list[dict] = field(default_factory=list)
    socket_files: list[str] = field(default_factory=list)
    descriptors: list[dict] = field(default_factory=list)
    supervisor_configs: list[dict] = field(default_factory=list)
    command_journals: list[dict] = field(default_factory=list)
    snapshot_generations: list[str] = field(default_factory=list)
    orphan_candidates: list[dict] = field(default_factory=list)
    worker_journal_digests: list[dict] = field(default_factory=list)
    registry_files: list[str] = field(default_factory=list)
    registry_owners: list[dict] = field(default_factory=list)
    other_files: list[str] = field(default_factory=list)
    pid_starts: dict[int, str | None] = field(default_factory=dict)
    # Injected observations are complete by default. Native observations begin
    # incomplete and become complete only after an independent /bin/ps health
    # check plus every discovered and captured PID/start check succeeds.
    ps_complete: bool = True
    required_pids: list[int] = field(default_factory=list)

    def record(self) -> dict:
        return asdict(self)


class Runner(Protocol):
    def command(self, argv: list[str], timeout: int) -> CommandResult: ...
    def observe(self, root: Path, cli: Path, required_pids: set[int] | None = None) -> Observation: ...
    def quiet_interval(self) -> None: ...


def inside(path: Path | str, root: Path) -> bool:
    # Normalize `..` and any symlinked parent before trusting a reported socket.
    candidate = Path(os.path.realpath(path))
    return candidate == root or root in candidate.parents


def required_private_dir(path: Path, expected: Path) -> None:
    if path != expected or path.is_symlink() or not path.is_dir():
        raise UnsafeScratch(f"missing or redirected private directory: {expected.name}")
    st = path.stat()
    if st.st_uid != os.getuid() or stat.S_IMODE(st.st_mode) != 0o700:
        raise UnsafeScratch(f"private directory owner/mode mismatch: {expected.name}")


def cli_identity(cli: Path) -> tuple[int, int, str]:
    """Physical pathname and opened inode/hash must agree at each command boundary.

    Python 3.9 on macOS cannot atomically bind pathname verification to exec.
    """
    if not cli.is_absolute() or cli != Path(os.path.realpath(cli)):
        raise UnsafeScratch("CLI physical pathname changed")
    fd = os.open(cli, os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0))
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or not (st.st_mode & 0o111):
            raise UnsafeScratch("CLI is not an executable regular file")
        digest = hashlib.sha256()
        with os.fdopen(fd, "rb", closefd=False) as stream:
            while True:
                chunk = stream.read(65536)
                if not chunk:
                    break
                digest.update(chunk)
        current = os.stat(cli, follow_symlinks=False)
        if (current.st_dev, current.st_ino) != (st.st_dev, st.st_ino):
            raise UnsafeScratch("CLI pathname replaced while hashing")
        return st.st_dev, st.st_ino, digest.hexdigest()
    finally:
        os.close(fd)


def validate_root(env: dict[str, str], cli: Path, expected_sha256: str) -> tuple[Path, Path]:
    root = Path(env.get("PRIME_CLAW_PROBE_ROOT", ""))
    if (not root.is_absolute() or root.is_symlink() or not root.is_dir()
            or root != Path(os.path.realpath(root))
            or root.parent != Path("/tmp").resolve() or not root.name.startswith("pcp.")):
        raise UnsafeScratch("not a canonical private retained probe root")
    required_private_dir(root, root)
    for key, name in (("HOME", "home"), ("TMPDIR", "tmp"),
                      ("PRIME_AGENT_CODING_AGENT_DIR", "config"),
                      ("PRIME_AGENT_SESSION_DIR", "sessions")):
        required_private_dir(Path(env.get(key, "")), root / name)
    if set(env) != ALLOWED_ENV or env.get("PATH") != SYSTEM_PATH or not env.get("LANG"):
        raise UnsafeScratch("probe environment is not the exact system-path env -i allowlist")
    socket_dir = root / "tmp" / f"prime-agent-{os.getuid()}"
    for socket in (socket_dir / "daemon.sock", socket_dir / ("worker-" + "x" * 12 + "-" + "y" * 12 + ".sock")):
        if len(os.fsencode(str(socket))) > SOCKET_BUDGET:
            raise UnsafeScratch("Unix socket pathname exceeds 103-byte budget")
    if not cli.is_absolute() or cli != Path(os.path.realpath(cli)) or not cli.is_file() or not os.access(cli, os.X_OK):
        raise UnsafeScratch("CLI must be an absolute, physical, executable file")
    if not re.fullmatch(r"[0-9a-f]{64}", expected_sha256):
        raise UnsafeScratch("expected CLI SHA-256 is required")
    actual_sha256 = cli_identity(cli)[2]
    if actual_sha256 != expected_sha256:
        raise UnsafeScratch("installed CLI SHA-256 does not match reviewed identity")
    project = root / "project"
    if project.exists() or project.is_symlink():
        raise UnsafeScratch("scratch project path already exists")
    return root, project


def parse_lsof(stdout: str, root: Path) -> list[dict]:
    # -F pn may include a file-descriptor separator on some lsof builds.
    # Unknown, empty, oversized or malformed records are NOT an empty scan.
    if len(stdout.encode(errors="replace")) > MAX_OUTPUT:
        raise UnsafeScratch("lsof output exceeds scan bound")
    refs: set[tuple[int, str]] = set()
    pid: int | None = None
    lines = stdout.splitlines()
    if len(lines) > MAX_SCAN_ENTRIES:
        raise UnsafeScratch("lsof record count exceeds scan bound")
    file_record = False
    for line in lines:
        if not line or len(line.encode(errors="replace")) > MAX_FIELD_BYTES or "\x00" in line or "\r" in line:
            raise UnsafeScratch("malformed lsof record")
        field, value = line[0], line[1:]
        if field == "p":
            if pid is not None and not file_record:
                raise UnsafeScratch("lsof PID has no file records")
            file_record = False
            if not value.isdecimal() or len(value) > 12 or int(value) <= 1:
                raise UnsafeScratch("malformed lsof PID")
            pid = int(value)
        elif field == "f":
            if pid is None or not value:
                raise UnsafeScratch("malformed lsof file descriptor")
            file_record = True
        elif field == "n":
            if pid is None:
                raise UnsafeScratch("lsof pathname before PID")
            if not value:
                raise UnsafeScratch("empty lsof pathname")
            file_record = True
            if str(root) in value and (not value.startswith("/") or not inside(value, root)):
                raise UnsafeScratch("lsof root reference has an unrecognized or escaping path")
            if value.startswith("/") and inside(value, root):
                refs.add((pid, value))
                if len(refs) > MAX_SCAN_ENTRIES:
                    raise UnsafeScratch("lsof root references exceed scan bound")
        else:
            raise UnsafeScratch("unknown lsof field in independent scan")
    if pid is not None and not file_record:
        raise UnsafeScratch("truncated lsof PID record")
    return [{"pid": pid, "path": path} for pid, path in sorted(refs)]


def parse_daemon_ps(result: CommandResult, root: Path, collected: list[dict] | None = None) -> list[dict]:
    if (result.timed_out or result.returncode != 0 or result.stderr.strip()
            or len(result.stdout.encode()) > MAX_OUTPUT):
        raise UnsafeScratch("daemon ps failed or exceeded output bound")
    try:
        daemons = json.loads(result.stdout)
    except ValueError as error:
        raise UnsafeScratch("daemon ps returned invalid JSON") from error
    if not isinstance(daemons, list) or len(daemons) > MAX_SCAN_ENTRIES:
        raise UnsafeScratch("daemon ps returned invalid or oversized array")
    safe = [] if collected is None else collected
    for entry in daemons:
        if not isinstance(entry, dict) or not isinstance(entry.get("socketPath"), str):
            raise UnsafeScratch("daemon ps returned invalid entry")
        socket = Path(entry["socketPath"])
        if not socket.is_absolute() or not inside(socket, root):
            raise UnsafeScratch("daemon ps reported out-of-root socket")
        pid = entry.get("pid")
        if pid is not None and (type(pid) is not int or pid <= 1):
            raise UnsafeScratch("daemon ps returned invalid PID")
        status = entry.get("status")
        if status not in ("current", "stale", "unreachable", "orphan-file"):
            raise UnsafeScratch("daemon ps returned unknown status")
        if type(entry.get("isDefault")) is not bool:
            raise UnsafeScratch("daemon ps default-socket identity is missing")
        session_count = entry.get("sessionCount")
        if session_count is not None and (type(session_count) is not int or session_count < 0):
            raise UnsafeScratch("daemon ps returned invalid session count")
        tracked = entry.get("hasTrackedWorkers", False)
        if type(tracked) is not bool:
            raise UnsafeScratch("daemon ps returned invalid worker flag")
        safe.append({"socketPath": str(socket), "pid": pid, "status": status,
                     "isDefault": entry["isDefault"], "sessionCount": session_count,
                     "hasTrackedWorkers": tracked})
    return safe


def parse_shutdown(result: CommandResult, root: Path) -> list[dict]:
    if result.timed_out or result.returncode != 0 or len(result.stdout.encode()) > MAX_OUTPUT:
        raise UnsafeScratch("shutdown failed, timed out, or exceeded output bound")
    try:
        payload = json.loads(result.stdout)
    except ValueError as error:
        raise UnsafeScratch("shutdown returned invalid JSON") from error
    if not isinstance(payload, dict) or not isinstance(payload.get("stopped"), list) or not isinstance(payload.get("failed"), list):
        raise UnsafeScratch("shutdown returned invalid result shape")
    if payload["failed"]:
        raise UnsafeScratch("shutdown reported failed entries")
    stopped = []
    for entry in payload["stopped"]:
        if not isinstance(entry, dict) or not isinstance(entry.get("socketPath"), str):
            raise UnsafeScratch("shutdown reported invalid stopped entry")
        socket = Path(entry["socketPath"])
        if not socket.is_absolute() or not inside(socket, root):
            raise UnsafeScratch("shutdown reported out-of-root socket")
        if not isinstance(entry.get("action"), str):
            raise UnsafeScratch("shutdown reported invalid action")
        stopped.append({"socketPath": str(socket)})
    return stopped


def scan_root_entries(root: Path):
    """Explicit, bounded walk; unlike Path.rglob, traversal errors propagate."""
    pending = [root]
    count = 0
    while pending:
        directory = pending.pop()
        children = []
        with os.scandir(directory) as entries:
            for entry in entries:
                count += 1
                if count > MAX_SCAN_ENTRIES or len(os.fsencode(entry.path)) > MAX_FIELD_BYTES:
                    raise UnsafeScratch("private root enumeration exceeds scan bound")
                path = Path(entry.path)
                st = entry.stat(follow_symlinks=False)
                if stat.S_ISLNK(st.st_mode) or not inside(path, root):
                    raise UnsafeScratch("symlink or redirect inside private scratch root")
                yield path, st
                if stat.S_ISDIR(st.st_mode):
                    children.append(path)
        pending.extend(reversed(children))


def read_scanned_json(path: Path, st: os.stat_result, label: str):
    if not stat.S_ISREG(st.st_mode) or st.st_size > MAX_RECORD_BYTES:
        raise UnsafeScratch("invalid or oversized " + label)
    flags = os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)
    fd = os.open(path, flags)
    try:
        opened = os.fstat(fd)
        if (not stat.S_ISREG(opened.st_mode) or opened.st_dev != st.st_dev
                or opened.st_ino != st.st_ino or opened.st_size > MAX_RECORD_BYTES):
            raise UnsafeScratch("changed or oversized " + label)
        with os.fdopen(fd, "rb", closefd=False) as reader:
            data = reader.read(MAX_RECORD_BYTES + 1)
        if len(data) > MAX_RECORD_BYTES or len(data) != opened.st_size:
            raise UnsafeScratch("changed or oversized " + label)
        try:
            return json.loads(data.decode("utf-8"))
        except (UnicodeError, ValueError) as error:
            raise UnsafeScratch("malformed " + label) from error
    finally:
        os.close(fd)


def default_descriptor_dir(root: Path, socket: Path) -> Path:
    # v0.9.6 daemon-supervisor.ts:692-697 hashes normalized socket path.
    key = hashlib.sha256(str(socket).encode()).hexdigest()[:12]
    return root / "config" / "daemon-workers" / key


def parse_owner_record(value, path: Path, root: Path) -> dict:
    registry = root / "home" / ".prime" / "supervisor-owners"
    if (not isinstance(value, dict) or path.name != "owner.json"
            or path.parent.parent != registry or not path.parent.name.endswith(".owner")):
        raise UnsafeScratch("invalid supervisor owner record layout")
    generation = path.parent.name[:-6]
    if (not re.fullmatch(r"[A-Za-z0-9._-]{1,128}", generation)
            or type(value.get("version")) is not int or value["version"] != 1
            or value.get("role") != "supervisor"
            or value.get("generation") != generation
            or value.get("phase") not in ("starting", "owner", "stopping")
            or type(value.get("pid")) is not int or value["pid"] <= 1):
        raise UnsafeScratch("invalid supervisor owner identity")
    for key in ("token", "appVersion", "createdAt", "updatedAt"):
        if not isinstance(value.get(key), str) or not value[key] or len(value[key]) > 256:
            raise UnsafeScratch("invalid supervisor owner metadata")
    start = value.get("processStartId")
    if start is not None and (not isinstance(start, str) or not start or len(start) > 256):
        raise UnsafeScratch("invalid supervisor owner process start")
    for key in ("socketPath", "descriptorDir", "agentDir"):
        path_value = value.get(key)
        if (not isinstance(path_value, str) or len(path_value) > MAX_FIELD_BYTES
                or not Path(path_value).is_absolute() or not inside(path_value, root)):
            raise UnsafeScratch("supervisor owner scope escapes scratch root")
    return {"path": str(path), "generation": generation, "pid": value["pid"],
            "start_id": start, "socketPath": value["socketPath"],
            "descriptorDir": value["descriptorDir"], "agentDir": value["agentDir"],
            "phase": value["phase"]}


def validate_owner_scope(value, owner: dict, path: Path) -> None:
    if (not isinstance(value, dict) or path.name != "scope.json"
            or any(value.get(key) != owner.get(key) for key in
                   ("version", "role", "token", "generation", "socketPath", "descriptorDir"))):
        raise UnsafeScratch("supervisor owner scope disagrees with owner record")


def scoped_path(value, root: Path, label: str) -> str:
    if (not isinstance(value, str) or not value or len(value.encode()) > MAX_FIELD_BYTES
            or not Path(value).is_absolute() or not inside(value, root)):
        raise UnsafeScratch("invalid or out-of-root " + label)
    return value


def parse_supervisor_config(value, path: Path, root: Path, socket: Path) -> dict:
    if (path != default_descriptor_dir(root, socket) / "supervisor-config"
            or not isinstance(value, dict) or type(value.get("version")) is not int
            or value["version"] != 1 or value.get("socketPath") != str(socket)):
        raise UnsafeScratch("invalid supervisor config identity")
    if set(value) != {"version", "socketPath", "defaultSessionConfig"}:
        raise UnsafeScratch("unknown supervisor config field")
    config = value.get("defaultSessionConfig")
    if not isinstance(config, dict) or config.get("agentDir") != str(root / "config"):
        raise UnsafeScratch("invalid supervisor config agent scope")
    for key, expected in (("cwd", root / "project"), ("sessionDir", root / "sessions")):
        if key in config and config[key] != str(expected):
            raise UnsafeScratch("invalid supervisor config " + key)
    if "telemetryDisabled" in config and config["telemetryDisabled"] is not True:
        raise UnsafeScratch("invalid supervisor config telemetry")
    if set(config) - {"cwd", "agentDir", "sessionDir", "telemetryDisabled"}:
        raise UnsafeScratch("unknown supervisor config field")
    return {"path": str(path), "version": 1, "socketPath": str(socket),
            "agentDir": config["agentDir"]}


# Pinned v0.9.6 AgentSessionRuntimeConfig. Legacy v1 alone can carry
# this runtime config; v2 keeps only durable create fields. Never retain it.
LEGACY_STRINGS = {"provider", "model", "apiKey", "systemPrompt", "thinking", "executionMode"}
LEGACY_ARRAYS = {"appendSystemPrompt", "models", "tools", "extensions", "skills",
                 "promptTemplates", "themes"}
LEGACY_BOOLS = {"noTools", "noBuiltinTools", "noExtensions", "noSkills",
                "noPromptTemplates", "noThemes", "noContextFiles", "serializedRefine"}


def finite_number(value) -> bool:
    return type(value) in (int, float) and math.isfinite(value)


def validate_legacy_config(config: dict, root: Path) -> None:
    allowed = (LEGACY_STRINGS | LEGACY_ARRAYS | LEGACY_BOOLS |
               {"cwd", "agentDir", "sessionDir", "telemetryDisabled", "autonomous",
                "extensionFlagValues", "initialGoal"})
    if set(config) - allowed:
        raise UnsafeScratch("unknown legacy worker config field")
    for key, expected in (("cwd", root / "project"), ("agentDir", root / "config"),
                          ("sessionDir", root / "sessions")):
        if key in config and config[key] != str(expected):
            raise UnsafeScratch("invalid legacy worker config scope")
    if "telemetryDisabled" in config and config["telemetryDisabled"] is not True:
        raise UnsafeScratch("invalid legacy worker telemetry")
    for key in LEGACY_STRINGS & config.keys():
        if not isinstance(config[key], str):
            raise UnsafeScratch("invalid legacy worker string")
    if "executionMode" in config and config["executionMode"] not in ("interactive", "print", "json", "rpc", "acp"):
        raise UnsafeScratch("invalid legacy worker execution mode")
    if "thinking" in config and config["thinking"] not in ("off", "minimal", "low", "medium", "high", "xhigh", "max"):
        raise UnsafeScratch("invalid legacy worker thinking")
    for key in LEGACY_ARRAYS & config.keys():
        if not isinstance(config[key], list) or any(not isinstance(v, str) for v in config[key]):
            raise UnsafeScratch("invalid legacy worker string list")
    for key in LEGACY_BOOLS & config.keys():
        if type(config[key]) is not bool:
            raise UnsafeScratch("invalid legacy worker boolean")
    if "extensionFlagValues" in config:
        flags = config["extensionFlagValues"]
        if not isinstance(flags, dict) or any(not isinstance(k, str) or type(v) not in (bool, str)
                                               for k, v in flags.items()):
            raise UnsafeScratch("invalid legacy extension flags")
    if "initialGoal" in config:
        goal = config["initialGoal"]
        if (not isinstance(goal, dict) or set(goal) - {"objective", "tokenBudget"}
                or not isinstance(goal.get("objective"), str) or not goal["objective"]
                or ("tokenBudget" in goal and not finite_number(goal["tokenBudget"]))):
            raise UnsafeScratch("invalid legacy initial goal")
    if "autonomous" in config:
        auto = config["autonomous"]
        if not isinstance(auto, dict) or set(auto) - {"enabled", "maxContinuations", "maxTurns", "maxTokens",
                                                 "timeoutMs", "continuationPrompt", "gates", "subagentKeepAliveMs"}:
            raise UnsafeScratch("invalid legacy autonomous config")
        for key in ("enabled",):
            if key in auto and type(auto[key]) is not bool:
                raise UnsafeScratch("invalid legacy autonomous boolean")
        for key in ("maxContinuations", "maxTurns", "maxTokens", "timeoutMs", "subagentKeepAliveMs"):
            if key in auto and not finite_number(auto[key]):
                raise UnsafeScratch("invalid legacy autonomous number")
        if "continuationPrompt" in auto and not isinstance(auto["continuationPrompt"], str):
            raise UnsafeScratch("invalid legacy autonomous prompt")
        if "gates" in auto:
            gates = auto["gates"]
            if not isinstance(gates, dict) or set(gates) - {"commands", "maxRetries", "timeoutMs"}:
                raise UnsafeScratch("invalid legacy autonomous gates")
            if "commands" in gates and (not isinstance(gates["commands"], list)
                                       or any(not isinstance(v, str) for v in gates["commands"])):
                raise UnsafeScratch("invalid legacy gate commands")
            for key in ("maxRetries", "timeoutMs"):
                if key in gates and not finite_number(gates[key]):
                    raise UnsafeScratch("invalid legacy gate number")


def parse_worker_descriptor(value, path: Path, root: Path) -> dict:
    if not isinstance(value, dict) or type(value.get("version")) is not int or value["version"] not in (1, 2):
        raise UnsafeScratch("unknown worker descriptor format")
    allowed = {"version", "workerId", "pid", "processStartId", "socketPath",
               "recoveryJournalPath", "orphanProcessJournalPath", "supervisorSocketPath",
               "authenticationToken", "workerInstanceId", "rootActiveSessionId",
               "ownerClientId", "rootSessionId", "sessionFile", "sessionDir",
               "telemetryDisabled", "createdAt", "updatedAt", "lifecycle",
               "createCommand", "consecutiveFailures", "stopRequestedAt",
               "archiveOnStop", "lastFailureAt", "lastError"}
    if set(value) - allowed:
        raise UnsafeScratch("unknown worker descriptor routing field")
    pid = value.get("pid")
    start = value.get("processStartId")
    if (type(pid) is not int or pid <= 1 or not isinstance(start, str)
            or not start or len(start) > 256):
        raise UnsafeScratch("worker descriptor lacks a stable process identity")
    for key in ("workerId", "authenticationToken", "rootActiveSessionId",
                "createdAt", "updatedAt"):
        if not isinstance(value.get(key), str) or not value[key] or len(value[key]) > 256:
            raise UnsafeScratch("worker descriptor lacks required native metadata")
    if (value.get("lifecycle") not in ("starting", "ready", "recovering", "stopping", "failed")
            or type(value.get("consecutiveFailures")) is not int
            or value["consecutiveFailures"] < 0):
        raise UnsafeScratch("worker descriptor lacks required native lifecycle")
    create = value.get("createCommand")
    if not isinstance(create, dict) or create.get("type") != "create":
        raise UnsafeScratch("invalid worker create command")
    if set(create) - {"type", "sessionPath", "noSession", "config" if value["version"] == 1 else "type"}:
        raise UnsafeScratch("unknown worker create command fields")
    if "noSession" in create and type(create["noSession"]) is not bool:
        raise UnsafeScratch("invalid worker create noSession")
    if "sessionPath" in create:
        scoped_path(create["sessionPath"], root / "sessions", "worker sessionPath")
    if "config" in create:
        config = create["config"]
        if not isinstance(config, dict):
            raise UnsafeScratch("invalid legacy worker create config")
        if value["version"] != 1:
            raise UnsafeScratch("legacy config in v2 worker descriptor")
        validate_legacy_config(config, root)
    for key in ("socketPath", "supervisorSocketPath", "recoveryJournalPath"):
        scoped_path(value.get(key), root, "worker " + key)
    worker_id = value["workerId"]
    directory = default_descriptor_dir(root, Path(value["supervisorSocketPath"]))
    worker_socket = (root / "tmp" / f"prime-agent-{os.getuid()}" /
                     f"worker-{directory.name}-{worker_id[:12]}.sock")
    if (not re.fullmatch(r"[A-Za-z0-9._-]{1,128}", worker_id)
            or path != directory / (worker_id + ".json")
            or value["supervisorSocketPath"] != str(root / "tmp" / f"prime-agent-{os.getuid()}" / "daemon.sock")
            or value["socketPath"] != str(worker_socket)
            or value["recoveryJournalPath"] != str(directory / (worker_id + ".recovery.jsonl"))):
        raise UnsafeScratch("worker descriptor filename or socket scope disagrees")
    if ("orphanProcessJournalPath" in value and value["orphanProcessJournalPath"] !=
            str(directory / (worker_id + ".orphans.jsonl"))):
        raise UnsafeScratch("invalid worker orphan journal scope")
    if "sessionDir" in value and value["sessionDir"] != str(root / "sessions"):
        raise UnsafeScratch("invalid worker session directory")
    if "sessionFile" in value:
        scoped_path(value["sessionFile"], root / "sessions", "worker session file")
    for key in ("ownerClientId", "rootSessionId", "workerInstanceId", "stopRequestedAt", "lastFailureAt", "lastError"):
        if key in value and (not isinstance(value[key], str) or not value[key] or len(value[key]) > 256):
            raise UnsafeScratch("invalid optional worker metadata")
    if "archiveOnStop" in value and type(value["archiveOnStop"]) is not bool:
        raise UnsafeScratch("invalid worker archive metadata")
    if "telemetryDisabled" in value and value["telemetryDisabled"] is not True:
        raise UnsafeScratch("invalid worker telemetry metadata")
    if "orphanProcessJournalPath" in value:
        scoped_path(value["orphanProcessJournalPath"], root, "worker orphan journal")
    return {"path": str(path), "pid": pid, "start_id": start,
            "socketPath": value["socketPath"],
            "supervisorSocketPath": value["supervisorSocketPath"],
            "recoveryJournalPath": value["recoveryJournalPath"]}


def read_scanned_bytes(path: Path, st: os.stat_result, label: str) -> bytes:
    if not stat.S_ISREG(st.st_mode) or st.st_size > MAX_RECORD_BYTES:
        raise UnsafeScratch("invalid or oversized " + label)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0))
    try:
        opened = os.fstat(fd)
        if (not stat.S_ISREG(opened.st_mode) or (opened.st_dev, opened.st_ino) != (st.st_dev, st.st_ino)
                or opened.st_size > MAX_RECORD_BYTES):
            raise UnsafeScratch("changed or oversized " + label)
        with os.fdopen(fd, "rb", closefd=False) as stream:
            data = stream.read(MAX_RECORD_BYTES + 1)
        if len(data) != opened.st_size or len(data) > MAX_RECORD_BYTES:
            raise UnsafeScratch("changed or oversized " + label)
        return data
    finally:
        os.close(fd)


def validate_command_journal(path: Path, st: os.stat_result) -> dict:
    data = read_scanned_bytes(path, st, "command journal")
    try:
        text = data.decode("utf-8")
        # compact() writes precisely one newline for an empty map.
        lines = [] if text == "\n" else text.splitlines()
        if not lines and text != "\n":
            raise UnsafeScratch("invalid empty command journal")
        if len(lines) > MAX_SCAN_ENTRIES:
            raise UnsafeScratch("command journal entry bound exceeded")
        for line in lines:
            if not line:
                raise UnsafeScratch("invalid blank command journal record")
            entry = json.loads(line)
            if (not isinstance(entry, dict) or type(entry.get("version")) is not int
                    or entry["version"] != 1 or entry.get("type") not in
                    ("received", "result", "acknowledged")
                    or not isinstance(entry.get("key"), str) or not entry["key"]
                    or not isinstance(entry.get("recordedAt"), str) or not entry["recordedAt"]):
                raise UnsafeScratch("invalid command journal record")
            kind = entry["type"]
            fields = {"version", "type", "key", "recordedAt"}
            if kind == "received":
                fields.update(("clientId", "commandId", "commandType"))
                if any(not isinstance(entry.get(key), str) or not entry[key]
                       for key in ("clientId", "commandId", "commandType")):
                    raise UnsafeScratch("invalid received command journal record")
                if entry["key"] != json.dumps([entry["clientId"], entry["commandId"]],
                                               separators=(",", ":"), ensure_ascii=False):
                    # JSON.stringify uses compact spacing and UTF-8 string contents.
                    raise UnsafeScratch("invalid command journal key")
            elif kind == "result":
                fields.add("response")
                response = entry.get("response")
                if (not isinstance(response, dict) or response.get("type") != "response"
                        or not isinstance(response.get("command"), str) or not response["command"]
                        or type(response.get("success")) is not bool):
                    raise UnsafeScratch("invalid result command journal response")
                response_fields = {"type", "command", "success", "id"}
                if "id" in response and not isinstance(response["id"], str):
                    raise UnsafeScratch("invalid result response id")
                if response["success"]:
                    response_fields.add("data")
                else:
                    response_fields.update(("error", "errorInfo"))
                    if not isinstance(response.get("error"), str):
                        raise UnsafeScratch("invalid result response error")
                    if "errorInfo" in response:
                        info = response["errorInfo"]
                        fields_by_code = {
                            "missing_session_cwd": {"issue"},
                            "session_import_file_not_found": {"filePath"},
                            "session_already_active": {"sessionPath"},
                            "session_recovering": {"activeSessionId"},
                            "update_restarting": set(),
                            "command_result_uncertain": {"clientId", "commandId"},
                        }
                        if not isinstance(info, dict) or info.get("code") not in fields_by_code:
                            raise UnsafeScratch("invalid result response error info")
                        code = info["code"]
                        required = fields_by_code[code]
                        allowed = {"code"} | required | ({"activeSessionId"} if code == "session_already_active" else set())
                        if set(info) - allowed or not required <= set(info):
                            raise UnsafeScratch("invalid result response error info")
                        if any(not isinstance(info[key], str) or not info[key]
                               for key in required - {"issue"}):
                            raise UnsafeScratch("invalid result response error identity")
                        if "activeSessionId" in info and not isinstance(info["activeSessionId"], str):
                            raise UnsafeScratch("invalid result response active session")
                        if code == "missing_session_cwd" and not isinstance(info["issue"], dict):
                            raise UnsafeScratch("invalid result response cwd issue")
                if set(response) - response_fields:
                    raise UnsafeScratch("invalid result response discriminant")
            if set(entry) != fields:
                raise UnsafeScratch("unknown or missing command journal field")
    except (UnicodeError, ValueError) as error:
        raise UnsafeScratch("malformed command journal") from error
    return {"path": str(path), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def validate_worker_journal(path: Path, st: os.stat_result, worker_pid: int,
                            partial: list[dict] | None = None,
                            digests: list[dict] | None = None) -> list[dict]:
    data = read_scanned_bytes(path, st, "worker journal")
    if digests is not None:
        digests.append({"path": str(path), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    latest: dict[int, dict] = {}
    try:
        lines = data.decode("utf-8").splitlines()
        if len(lines) > MAX_SCAN_ENTRIES:
            raise UnsafeScratch("worker journal entry bound exceeded")
        for line in lines:
            if not line:
                raise UnsafeScratch("invalid blank worker journal record")
            value = json.loads(line)
            if (not isinstance(value, dict) or type(value.get("version")) is not int
                    or value["version"] != 1 or not isinstance(value.get("recordedAt"), str)
                    or not value["recordedAt"]):
                raise UnsafeScratch("invalid worker journal record")
            if path.name.endswith(".recovery.jsonl"):
                if (set(value) - {"version", "recordedAt", "activeSessionId", "sessionId",
                                  "operation", "busy", "sessionFile"}
                        or any(not isinstance(value.get(key), str) or not value[key]
                               for key in ("activeSessionId", "sessionId", "operation"))
                        or type(value.get("busy")) is not bool):
                    raise UnsafeScratch("invalid worker recovery record")
                if "sessionFile" in value:
                    scoped_path(value["sessionFile"], path.parents[3] / "sessions", "worker recovery session file")
            else:
                if (set(value) - {"version", "recordedAt", "pid", "ownerPid", "kernelPid",
                                  "processStartId", "active"}
                        or type(value.get("pid")) is not int or value["pid"] <= 1
                        or value.get("ownerPid") != worker_pid
                        or type(value.get("active")) is not bool
                        or ("kernelPid" in value and (type(value["kernelPid"]) is not int or value["kernelPid"] <= 1))
                        or ("processStartId" in value and (not isinstance(value["processStartId"], str)
                                                              or not re.fullmatch(
                                                                  r"ps:[A-Z][a-z]{2} [A-Z][a-z]{2} [ 0-3][0-9] [0-2][0-9]:[0-5][0-9]:[0-5][0-9] [0-9]{4}",
                                                                  value["processStartId"])))):
                    raise UnsafeScratch("invalid worker orphan record")
                latest[value["pid"]] = value
                if partial is not None:
                    partial[:] = [{"pid": item["pid"], "start_id": item.get("processStartId")}
                                  for item in latest.values() if item["active"]]
    except (UnicodeError, ValueError) as error:
        raise UnsafeScratch("malformed worker journal") from error
    return [{"pid": item["pid"], "start_id": item.get("processStartId")}
            for item in latest.values() if item["active"]]


def snapshot_quiet(obs: Observation) -> bool:
    if (not obs.valid or obs.reason or not obs.ps_complete or obs.root_refs
            or obs.unix_refs or obs.registry_files or obs.registry_owners):
        return False
    if any(d.get("pid") is not None and obs.pid_starts.get(d["pid"]) is not None for d in obs.daemons):
        return False
    if any(d.get("status") != "orphan-file" for d in obs.daemons):
        return False
    if any(d.get("pid") is not None and obs.pid_starts.get(d["pid"]) is not None for d in obs.descriptors):
        return False
    # A PID-only orphan has no identity proof even if ps currently says absent.
    if any(not item.get("start_id") or obs.pid_starts.get(item["pid"]) is not None
           or item["pid"] not in obs.pid_starts for item in obs.orphan_candidates):
        return False
    return all(start is None for start in obs.pid_starts.values())


def baseline_empty(obs: Observation) -> bool:
    return (obs.valid and not obs.reason and obs.ps_complete and not obs.daemons
            and not obs.root_refs and not obs.unix_refs and not obs.socket_files
            and not obs.descriptors and not obs.supervisor_configs and not obs.command_journals
            and not obs.snapshot_generations and not obs.registry_files and not obs.registry_owners
            and not obs.other_files and not obs.pid_starts)


def active_shutdown_admission(active: Observation, root: Path, socket: Path,
                              expected_pid: int | None, start_ok: bool) -> tuple[bool, bool, str]:
    """Fail closed on any competing or unreconciled owner before destructive shutdown."""
    if not active.valid or active.reason or not active.ps_complete:
        return False, False, "active ownership observation was incomplete; no shutdown admitted"
    if active.descriptors:
        return False, False, "active observation found worker metadata; no shutdown admitted"
    if any(path != str(socket) for path in active.socket_files):
        return False, False, "active observation found an unexpected socket; no shutdown admitted"
    if any(d["socketPath"] != str(socket) or not d["isDefault"]
           or d["hasTrackedWorkers"] or d["sessionCount"] != 0
           or (expected_pid is not None and d["pid"] != expected_pid)
           for d in active.daemons):
        return False, False, "active daemon had a different owner, sessions, or workers; no shutdown admitted"
    if any(ref["pid"] != expected_pid for ref in active.root_refs + active.unix_refs):
        return False, False, "active root reference had a different owner; no shutdown admitted"
    if any(pid != expected_pid and start is not None for pid, start in active.pid_starts.items()):
        return False, False, "active process identity had a different owner; no shutdown admitted"
    if not start_ok:
        # One uncertain owned start may still have detached a daemon. Only a
        # complete, still-empty private namespace admits one isolated stop.
        if (active.daemons or active.root_refs or active.unix_refs or active.socket_files
                or active.descriptors or active.supervisor_configs or active.command_journals
                or active.snapshot_generations or active.orphan_candidates
                or active.registry_files or active.registry_owners
                or any(start is not None for start in active.pid_starts.values())):
            return False, False, "uncertain start has a possible owner; no shutdown admitted"
        return True, False, "start result uncertain; one isolated shutdown may be attempted"
    if (len(active.supervisor_configs) != 1 or active.supervisor_configs[0]["socketPath"] != str(socket)
            or len(active.command_journals) > 1):
        return False, False, "active supervisor metadata missing or inconsistent; no shutdown admitted"
    if expected_pid is None or len(active.daemons) != 1 or active.daemons[0]["status"] != "current":
        return False, False, "active supervisor was not uniquely current; no shutdown admitted"
    if active.pid_starts.get(expected_pid) is None or len(active.registry_owners) != 1:
        return False, False, "active supervisor and registry owner were not both proven; no shutdown admitted"
    owner = active.registry_owners[0]
    if active.snapshot_generations != [owner["generation"]]:
        return False, False, "active snapshot generation disagreed; no shutdown admitted"
    owner_dir = root / "home" / ".prime" / "supervisor-owners" / (owner["generation"] + ".owner")
    expected_records = {str(owner_dir / "owner.json"), str(owner_dir / "scope.json")}
    if (set(active.registry_files) != expected_records or owner["pid"] != expected_pid
            or owner["start_id"] != "ps:" + active.pid_starts[expected_pid]
            or owner["socketPath"] != str(socket)
            or owner["descriptorDir"] != str(default_descriptor_dir(root, socket))
            or owner["agentDir"] != str(root / "config") or owner["phase"] != "owner"):
        return False, False, "active registry identity or scope disagreed; no shutdown admitted"
    return True, True, ""


class NativeRunner:
    """One explicit CLI binary and independent OS scans under the wrapper environment."""

    def __init__(self, env: dict[str, str], cli: Path, cwd: Path):
        self.env = {**env, "LC_ALL": "C", "TZ": "UTC"}
        self.cli = cli
        self.identity = cli_identity(cli)
        self.cwd = cwd
        if sys.platform != "darwin":
            raise UnsafeScratch("native scratch smoke is reviewed only for macOS")
        self.lsof = Path("/usr/sbin/lsof")
        self.ps = Path("/bin/ps")
        if not all(p.is_file() and not p.is_symlink() and os.access(p, os.X_OK)
                   for p in (self.lsof, self.ps)):
            raise UnsafeScratch("trusted independent OS scan binary unavailable")

    def quiet_interval(self) -> None:
        # This runs inside the bounded child process, never as an agent REPL poll.
        time.sleep(1.25)

    def command(self, argv: list[str], timeout: int) -> CommandResult:
        if not argv or Path(argv[0]) not in (self.cli, self.lsof, self.ps):
            raise UnsafeScratch("unexpected executable in scratch driver")
        if Path(argv[0]) == self.cli and cli_identity(self.cli) != self.identity:
            raise UnsafeScratch("CLI identity changed before invocation")
        # Pipe pumping caps bytes in memory while draining both streams. A
        # timeout only kills the exact child handle created by this call.
        output = {"stdout": bytearray(), "stderr": bytearray()}
        selector = None
        expired = False
        oversized = False
        failed = False
        unresolved = False
        try:
            proc = subprocess.Popen(argv, cwd=self.cwd, env=self.env,
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except OSError:
            return CommandResult(None)
        # From the instant Popen returns, all selector setup and draining is
        # covered by exact-child containment. Cleanup has its own finite budget.
        try:
            deadline = time.monotonic() + timeout
            selector = selectors.DefaultSelector()
            for name, pipe in (("stdout", proc.stdout), ("stderr", proc.stderr)):
                selector.register(pipe, selectors.EVENT_READ, name)
            while selector.get_map():
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    expired = True
                    break
                for key, _ in selector.select(remaining):
                    chunk = os.read(key.fileobj.fileno(), 65536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                    elif len(output[key.data]) + len(chunk) > MAX_COMMAND_BYTES:
                        oversized = True
                        break
                    else:
                        output[key.data].extend(chunk)
                if oversized:
                    break
            if not oversized and not expired:
                try:
                    proc.wait(timeout=max(min(deadline - time.monotonic(), timeout), 0.001))
                except subprocess.TimeoutExpired:
                    expired = True
        except Exception:
            failed = True
        finally:
            if expired or oversized or failed:
                # Never signal a daemon or process group: only this Popen handle.
                # poll/kill/wait may themselves fail; no unbounded wait follows.
                try:
                    if proc.poll() is None:
                        proc.kill()
                except Exception:
                    unresolved = True
                try:
                    proc.wait(timeout=2)
                except Exception:
                    unresolved = True
            try:
                if proc.poll() is None:
                    unresolved = True
            except Exception:
                unresolved = True
            if selector is not None:
                try:
                    selector.close()
                except Exception:
                    failed = True
            for pipe in (proc.stdout, proc.stderr):
                if pipe is not None:
                    try:
                        pipe.close()
                    except Exception:
                        failed = True
        # Replacement decoding may triple raw bytes. Keep encoded evidence
        # bounded too, without discarding child lifecycle flags.
        decoded = {name: bytes(data).decode(errors="replace") for name, data in output.items()}
        if any(len(text.encode()) > MAX_COMMAND_BYTES for text in decoded.values()):
            oversized = True
            decoded = {name: text.encode()[:MAX_COMMAND_BYTES].decode("utf-8", errors="ignore")
                       for name, text in decoded.items()}
        return CommandResult(None if expired or oversized or failed or unresolved else proc.returncode,
                             decoded["stdout"], decoded["stderr"],
                             expired or oversized or failed or unresolved, oversized,
                             child_unresolved=unresolved, capture_failed=failed)

    def _lsof(self, args: list[str], root: Path) -> list[dict]:
        result = self.command([str(self.lsof), "-nP", "-F", "pn", *args], 12)
        if (result.timed_out or result.returncode not in (0, 1) or result.stderr.strip()
                or len(result.stdout.encode()) > MAX_OUTPUT
                or (result.returncode == 1 and result.stdout.strip())):
            raise UnsafeScratch("independent lsof scan failed or was truncated")
        return parse_lsof(result.stdout, root)

    def pid_start(self, pid: int) -> str | None:
        if type(pid) is not int or pid <= 1:
            raise UnsafeScratch("invalid PID for identity check")
        result = self.command([str(self.ps), "-p", str(pid), "-o", "lstart="], 5)
        if result.returncode == 1 and not result.stdout.strip() and not result.stderr.strip():
            return None
        if result.timed_out or result.returncode != 0 or result.stderr.strip():
            raise UnsafeScratch("independent process identity scan failed")
        start = result.stdout.strip()
        if not re.fullmatch(r"[A-Z][a-z]{2} [A-Z][a-z]{2} [ 0-3][0-9] [0-2][0-9]:[0-5][0-9]:[0-5][0-9] [0-9]{4}", start):
            raise UnsafeScratch("process start identity missing or malformed")
        return start

    def observe(self, root: Path, cli: Path, required_pids: set[int] | None = None) -> Observation:
        # Retain already observed ownership facts if a later independent scan
        # fails. Unknown or incomplete active observations forbid shutdown.
        obs = Observation(ps_complete=False, required_pids=sorted(required_pids or set()))
        try:
            self._observe_into(obs, root, cli, required_pids or set())
        except Exception as error:
            obs.valid = False
            obs.reason = str(error)[:200] if isinstance(error, UnsafeScratch) else "independent observation failed"
        return obs

    def _observe_into(self, obs: Observation, root: Path, cli: Path, required_pids: set[int]) -> None:
        parse_daemon_ps(self.command([str(cli), "daemon", "ps", "--json"], 12), root, obs.daemons)
        obs.root_refs = self._lsof(["+D", str(root)], root)
        obs.unix_refs = self._lsof(["-U"], root)
        descriptor_dir = root / "config" / "daemon-workers"
        registry_dir = root / "home" / ".prime" / "supervisor-owners"
        owner_records: dict[Path, dict] = {}
        owner_scopes: dict[Path, dict] = {}
        worker_journals: list[tuple[Path, os.stat_result]] = []
        expected_dir = default_descriptor_dir(root, root / "tmp" / f"prime-agent-{os.getuid()}" / "daemon.sock")
        for path, st in scan_root_entries(root):
            if inside(path, descriptor_dir) and path != descriptor_dir:
                if stat.S_ISDIR(st.st_mode):
                    # A native no-session supervisor creates an empty snapshot
                    # cache generation. Any other directory is unmodelled.
                    if path not in (expected_dir, expected_dir / "snapshot-cache") and not (
                            path.parent == expected_dir / "snapshot-cache"
                            and re.fullmatch(r"[A-Za-z0-9._-]{1,128}", path.name)):
                        raise UnsafeScratch("unknown supervisor descriptor directory")
                    if path.parent == expected_dir / "snapshot-cache":
                        obs.snapshot_generations.append(path.name)
                    continue
                if path.parent != expected_dir:
                    raise UnsafeScratch("unknown nested supervisor artifact")
                if not stat.S_ISREG(st.st_mode):
                    raise UnsafeScratch("unknown supervisor descriptor artifact type")
                if path.name == "supervisor-config":
                    config = read_scanned_json(path, st, "supervisor config")
                    obs.supervisor_configs.append(parse_supervisor_config(config, path, root,
                                            root / "tmp" / f"prime-agent-{os.getuid()}" / "daemon.sock"))
                elif path.name == "command-journal.jsonl":
                    obs.command_journals.append(validate_command_journal(path, st))
                elif re.fullmatch(r"[A-Za-z0-9._-]{1,128}\.(recovery|orphans)\.jsonl", path.name):
                    worker_journals.append((path, st))
                    obs.other_files.append(str(path))
                elif path.suffix == ".json":
                    desc = read_scanned_json(path, st, "worker descriptor")
                    obs.descriptors.append(parse_worker_descriptor(desc, path, root))
                else:
                    raise UnsafeScratch("unknown supervisor descriptor artifact")
            elif stat.S_ISSOCK(st.st_mode):
                obs.socket_files.append(str(path))
            elif stat.S_ISREG(st.st_mode):
                if inside(path, registry_dir):
                    obs.registry_files.append(str(path))
                    if path.parent.parent == registry_dir and path.parent.name.endswith(".owner"):
                        if path.name == "owner.json":
                            owner = read_scanned_json(path, st, "supervisor owner record")
                            obs.registry_owners.append(parse_owner_record(owner, path, root))
                            owner_records[path.parent] = owner
                        elif path.name == "scope.json":
                            owner_scopes[path.parent] = read_scanned_json(path, st, "supervisor owner scope")
                else:
                    obs.other_files.append(str(path))
            elif not stat.S_ISDIR(st.st_mode):
                raise UnsafeScratch("unknown filesystem entry in scratch root")
        for journal, journal_stat in worker_journals:
            worker_id = journal.name.split(".", 1)[0]
            matches = [descriptor for descriptor in obs.descriptors
                       if Path(descriptor["path"]).stem == worker_id]
            if len(matches) != 1:
                raise UnsafeScratch("orphan worker journal lacks descriptor")
            candidates: list[dict] = []
            # Retain validated latest-record identities even if a later line fails.
            try:
                validate_worker_journal(journal, journal_stat, matches[0]["pid"], candidates,
                                        obs.worker_journal_digests)
            finally:
                obs.orphan_candidates.extend(candidates)
        for owner_dir in owner_records.keys() | owner_scopes.keys():
            if owner_dir not in owner_records or owner_dir not in owner_scopes:
                raise UnsafeScratch("incomplete supervisor registry owner record")
            validate_owner_scope(owner_scopes[owner_dir], owner_records[owner_dir], owner_dir / "scope.json")
        pids = {d["pid"] for d in obs.daemons if d["pid"] is not None}
        pids.update(r["pid"] for r in obs.root_refs + obs.unix_refs)
        pids.update(d["pid"] for d in obs.descriptors)
        pids.update(owner["pid"] for owner in obs.registry_owners)
        pids.update(item["pid"] for item in obs.orphan_candidates)
        pids.update(required_pids)
        if len(pids) > MAX_SCAN_ENTRIES or any(type(pid) is not int or pid <= 1 for pid in pids):
            raise UnsafeScratch("invalid or oversized process identity set")
        # Even an apparently empty discovery must prove /bin/ps works.
        if self.pid_start(os.getpid()) is None:
            raise UnsafeScratch("independent process scan health check failed")
        for pid in sorted(pids):
            obs.pid_starts[pid] = self.pid_start(pid)
        for ref in obs.root_refs + obs.unix_refs:
            if obs.pid_starts[ref["pid"]] is None:
                raise UnsafeScratch("root reference disappeared during process identity scan")
        obs.ps_complete = True


def record_report(root: Path, report: dict) -> None:
    """Create one bounded, owner-only, durable record; never replace on replay."""
    path = root / "scratch-smoke-report.json"
    try:
        encoded = (json.dumps(report, sort_keys=True, ensure_ascii=True) + "\n").encode()
        if len(encoded) > MAX_REPORT_BYTES:
            raise UnsafeScratch("report serialization exceeds bound")
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try:
            with os.fdopen(fd, "wb", closefd=False) as stream:
                stream.write(encoded)
                stream.flush()
                os.fsync(fd)
        finally:
            os.close(fd)
        directory = os.open(root, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    except Exception as error:
        raise UnsafeScratch(f"evidence write failed for retained root {root}; quarantine and inspect report path manually") from error


def smoke(env: dict[str, str], cli: Path, expected_sha256: str, runner: Runner, *, run_native: bool) -> dict:
    """One owned start, at most one isolated shutdown; preserve every root."""
    root, project = validate_root(env, cli, expected_sha256)
    identity = cli_identity(cli)
    report: dict = {"root": str(root), "cli_path": str(cli), "cli_sha256": expected_sha256,
                    "cli_device": identity[0], "cli_inode": identity[1],
                    "helper_cwd": str(getattr(runner, "cwd", Path.cwd())),
                    "mode": "smoke" if run_native else "preflight", "status": "blocked_preflight",
                    "events": [], "reasons": []}

    def reason(message: str) -> None:
        report["reasons"].append(message[:200])

    def observation(stage: str, required: set[int] | None = None) -> Observation:
        try:
            if cli_identity(cli) != identity:
                raise UnsafeScratch("CLI identity changed before observation")
            value = runner.observe(root, cli, required_pids=required)
            if not isinstance(value, Observation):
                raise UnsafeScratch("observation did not return a supported result")
        except Exception:
            value = Observation(valid=False, ps_complete=False, reason="independent observation failed")
        try:
            record = value.record()
            if len(json.dumps(record)) > MAX_REPORT_BYTES // 2:
                raise UnsafeScratch("observation record exceeds bound")
            report[stage] = record if stage != "postflight" else report.setdefault(stage, []) + [record]
        except Exception:
            value.valid = False
            value.reason = "observation evidence recording failed"
            minimal = {"valid": False, "reason": value.reason, "ps_complete": False}
            report[stage] = minimal if stage != "postflight" else report.setdefault(stage, []) + [minimal]
        return value

    def command(operation: str, argv: list[str], timeout: int) -> CommandResult:
        # Exact safe argv/cwd are recorded BEFORE the attempt. No secrets or env.
        event = {"operation": operation, "argv": argv[:20],
                 "cwd": str(getattr(runner, "cwd", Path.cwd())), "cli_path": str(cli),
                 "cli_sha256": expected_sha256}
        report["events"].append(event)
        try:
            if cli_identity(cli) != identity:
                raise UnsafeScratch("CLI identity changed before invocation")
            outcome = runner.command(argv, timeout)
        except Exception:
            event["error"] = "invocation failed; outcome unknown"
            return CommandResult(None, timed_out=True)
        # Recording is a fallible evidence plane, not the command result. Its
        # failure cannot erase competing-owner text or an unreaped child.
        try:
            event.update(outcome.record())
        except Exception:
            event["error"] = "result evidence recording failed; outcome uncertain"
            outcome.capture_failed = True
        return outcome

    baseline = observation("baseline")
    if not baseline_empty(baseline):
        reason(baseline.reason or "scratch baseline is not empty and uniquely owned")
        record_report(root, report)
        return report
    if not run_native:
        report["status"] = "preflight_ready"
        record_report(root, report)
        return report

    try:
        project.mkdir(mode=0o700)
    except Exception:
        reason("scratch project creation failed before start admission")
        record_report(root, report)
        return report
    socket = root / "tmp" / f"prime-agent-{os.getuid()}" / "daemon.sock"
    start_args = [str(cli), "daemon", "start", "--offline", "--no-extensions", "--no-skills",
                  "--no-prompt-templates", "--no-context-files", "--no-tools", "--cwd", str(project)]
    start = command("daemon_start_once", start_args, 18)
    start_ok = False
    active_ok = False
    admission = False
    ownership_revoked = False
    captured: dict[int, str | None] = {}
    captured_generations: set[str] = set()
    captured_orphans: set[tuple[int, str | None]] = set()
    try:
        if start.stdout.strip().startswith("Daemon already running on "):
            ownership_revoked = True
            reason("start reported a competing daemon; no shutdown admitted")
        else:
            match = START_RE.fullmatch(start.stdout.strip()) if (start.returncode == 0 and not start.timed_out
                                                                and not start.capture_failed) else None
            start_ok = bool(match and match.group(1) == str(socket))
            expected_pid = int(match.group(2)) if start_ok else None
            if not start_ok:
                reason("start result uncertain; never retry")
            active = observation("active", {expected_pid} if expected_pid else set())
            admission, active_ok, decision = active_shutdown_admission(active, root, socket, expected_pid, start_ok)
            if start.child_unresolved:
                admission = False
                active_ok = False
                decision = "direct start CLI child may still run; no shutdown admitted"
            if not admission:
                ownership_revoked = True
                reason(decision)
            else:
                if decision:
                    reason(decision)
                captured = dict(active.pid_starts)
                captured_generations = set(active.snapshot_generations)
                captured_orphans = {(item["pid"], item.get("start_id")) for item in active.orphan_candidates}
    except Exception:
        ownership_revoked = True
        reason("active ownership reconciliation failed; no shutdown admitted")

    shutdown_ok = False
    if ownership_revoked:
        report["status"] = "unresolved_ownership"
    else:
        # No other mutation after this call, even if parsing/evidence fails.
        stop = command("top_level_shutdown_once", [str(cli), "shutdown", "--force", "--json"], 35)
        try:
            report["stopped"] = parse_shutdown(stop, root)
            shutdown_ok = True
        except Exception:
            reason("shutdown result failed, invalid, or uncertain")
        first = observation("postflight", set(captured))
        try:
            runner.quiet_interval()
            interval_ok = True
        except Exception:
            interval_ok = False
            reason("post-shutdown quiet interval failed")
        # Candidates first found in postflight one must be checked again in
        # postflight two; second-only candidates have no first check and veto.
        discovered_first = {item["pid"] for item in first.orphan_candidates}
        second = observation("postflight", set(captured) | discovered_first)
        quiet = False
        try:
            # Both snapshots have already been retained; classification cannot
            # erase either observation or turn malformed fields into absence.
            quiet = bool(interval_ok and snapshot_quiet(first) and snapshot_quiet(second))
            if not quiet:
                reason("independent post-shutdown scans are not both empty and valid")
        except Exception:
            reason("post-shutdown quiet classification failed; outcome unresolved")
        try:
            persisted = any(first.pid_starts.get(pid) is not None or second.pid_starts.get(pid) is not None
                            or pid not in first.pid_starts or pid not in second.pid_starts for pid in captured)
            if persisted:
                quiet = False
                reason("captured process identity persisted, was reused, or was not checked twice")
        except Exception:
            quiet = False
            reason("captured process identity classification failed; outcome unresolved")
        try:
            generations_first, generations_second = set(first.snapshot_generations), set(second.snapshot_generations)
            first_orphans = {(item["pid"], item.get("start_id")) for item in first.orphan_candidates}
            second_orphans = {(item["pid"], item.get("start_id")) for item in second.orphan_candidates}
            if (not generations_first <= captured_generations or not generations_second <= captured_generations
                    or generations_first != generations_second or first_orphans != second_orphans
                    or any(sorted(getattr(first, name), key=str) != sorted(getattr(second, name), key=str)
                           for name in ("descriptors", "supervisor_configs", "command_journals",
                                        "worker_journal_digests", "other_files", "socket_files"))
                    or any(item[1] is None for item in first_orphans | second_orphans)
                    or any(pid not in first.pid_starts or pid not in second.pid_starts
                           or first.pid_starts[pid] is not None or second.pid_starts[pid] is not None
                           for pid, _ in first_orphans | second_orphans | captured_orphans)):
                quiet = False
                reason("postflight generation or orphan identity changed, persisted, or lacked two checks")
        except Exception:
            quiet = False
            reason("postflight identity reconciliation failed; outcome unresolved")
        report["status"] = "stopped" if start_ok and active_ok and shutdown_ok and quiet else "unresolved"
    record_report(root, report)
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cli", type=Path, required=True, help="absolute resolved installed Prime Agent binary")
    parser.add_argument("--expected-cli-sha256", required=True, help="reviewed installed binary identity")
    parser.add_argument("--run-smoke", action="store_true", help="REQUIRES fresh exact-commit review before native daemon launch")
    args = parser.parse_args(argv)
    env = dict(os.environ)
    try:
        cli = args.cli  # Never silently resolve a symlink; the preflight rejects it.
        root, _ = validate_root(env, cli, args.expected_cli_sha256)
        runner = NativeRunner(env, cli, Path.cwd())
        report = smoke(env, cli, args.expected_cli_sha256, runner, run_native=args.run_smoke)
        print(json.dumps({"status": report["status"], "root": str(root),
                          "report": str(root / "scratch-smoke-report.json")}))
        return 0 if report["status"] in ("preflight_ready", "stopped") else 1
    except UnsafeScratch as error:
        # If preflight failed, root ownership may be unknown; do not write or
        # invoke shutdown. Never echo the environment or raw native output.
        print(json.dumps({"status": "blocked", "reason": str(error)[:200]}), file=sys.stderr)
        return 1
    except Exception:
        print(json.dumps({"status": "blocked_unexpected", "reason": "driver exception; retain scratch root"}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
