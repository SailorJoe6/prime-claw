#!/usr/bin/env python3
"""Fail-closed, retained-root Prime Agent daemon smoke. Do not run native mode before review."""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass, field
import hashlib
import json
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

    def record(self) -> dict:
        if len(self.stdout.encode()) > MAX_COMMAND_BYTES or len(self.stderr.encode()) > MAX_COMMAND_BYTES:
            raise UnsafeScratch("command result exceeds capture bound")
        # Keep failure diagnostics without printing raw CLI output or descriptor secrets.
        return {
            "returncode": self.returncode,
            "timed_out": self.timed_out,
            "output_truncated": self.output_truncated,
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


def parse_worker_descriptor(value, path: Path, root: Path) -> dict:
    if not isinstance(value, dict) or type(value.get("version")) is not int or value["version"] not in (1, 2):
        raise UnsafeScratch("unknown worker descriptor format")
    pid = value.get("pid")
    start = value.get("processStartId")
    if (type(pid) is not int or pid <= 1 or not isinstance(start, str)
            or not start or len(start) > 256):
        raise UnsafeScratch("worker descriptor lacks a stable process identity")
    for key in ("workerId", "authenticationToken", "rootActiveSessionId",
                "createdAt", "updatedAt", "lifecycle"):
        if not isinstance(value.get(key), str) or not value[key] or len(value[key]) > 256:
            raise UnsafeScratch("worker descriptor lacks required native metadata")
    if (not isinstance(value.get("createCommand"), dict)
            or type(value.get("consecutiveFailures")) is not int
            or value["consecutiveFailures"] < 0):
        raise UnsafeScratch("worker descriptor lacks required native lifecycle")
    for key in ("socketPath", "supervisorSocketPath", "recoveryJournalPath"):
        reported = value.get(key)
        if (not isinstance(reported, str) or len(reported) > MAX_FIELD_BYTES
                or not Path(reported).is_absolute() or not inside(reported, root)):
            raise UnsafeScratch("worker descriptor path escapes scratch root")
    worker_id = value["workerId"]
    if (not re.fullmatch(r"[A-Za-z0-9._-]{1,128}", worker_id)
            or path.name != worker_id + ".json"
            or path.parent != default_descriptor_dir(root, Path(value["supervisorSocketPath"]))):
        raise UnsafeScratch("worker descriptor filename or socket scope disagrees")
    for key in ("orphanProcessJournalPath", "sessionDir", "sessionFile"):
        reported = value.get(key)
        if reported is not None and (not isinstance(reported, str)
                                    or not Path(reported).is_absolute() or not inside(reported, root)):
            raise UnsafeScratch("optional worker descriptor path escapes scratch root")
    return {"path": str(path), "pid": pid, "start_id": start,
            "socketPath": value["socketPath"],
            "supervisorSocketPath": value["supervisorSocketPath"],
            "recoveryJournalPath": value["recoveryJournalPath"]}


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
    return all(start is None for start in obs.pid_starts.values())


def baseline_empty(obs: Observation) -> bool:
    return (obs.valid and not obs.reason and obs.ps_complete and not obs.daemons
            and not obs.root_refs and not obs.unix_refs and not obs.socket_files
            and not obs.descriptors and not obs.registry_files and not obs.registry_owners
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
                or active.descriptors or active.registry_files or active.registry_owners
                or any(start is not None for start in active.pid_starts.values())):
            return False, False, "uncertain start has a possible owner; no shutdown admitted"
        return True, False, "start result uncertain; one isolated shutdown may be attempted"
    if expected_pid is None or len(active.daemons) != 1 or active.daemons[0]["status"] != "current":
        return False, False, "active supervisor was not uniquely current; no shutdown admitted"
    if active.pid_starts.get(expected_pid) is None or len(active.registry_owners) != 1:
        return False, False, "active supervisor and registry owner were not both proven; no shutdown admitted"
    owner = active.registry_owners[0]
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
        try:
            proc = subprocess.Popen(argv, cwd=self.cwd, env=self.env,
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except OSError:
            return CommandResult(None)
        output = {"stdout": bytearray(), "stderr": bytearray()}
        selector = selectors.DefaultSelector()
        expired = False
        oversized = False
        deadline = time.monotonic() + timeout
        try:
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
            remaining = deadline - time.monotonic()
            if not oversized and not expired:
                try:
                    proc.wait(timeout=max(remaining, 0.001))
                except subprocess.TimeoutExpired:
                    expired = True
            if oversized or expired:
                if proc.poll() is None:
                    proc.kill()  # This exact direct child only, never a daemon PID.
                proc.wait()
            return CommandResult(None if expired or oversized else proc.returncode,
                                 output["stdout"].decode(errors="replace"),
                                 output["stderr"].decode(errors="replace"), expired or oversized, oversized)
        finally:
            if proc.poll() is None:
                proc.kill()  # Exact direct child on unexpected pump failure.
                proc.wait()
            selector.close()
            proc.stdout.close()
            proc.stderr.close()

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
        for path, st in scan_root_entries(root):
            if stat.S_ISSOCK(st.st_mode):
                obs.socket_files.append(str(path))
            elif stat.S_ISREG(st.st_mode):
                if inside(path, descriptor_dir):
                    # Native descriptors live under daemon-workers/<socket hash>/.
                    # Recovery/orphan journals are opaque retained metadata.
                    if (path.parent.parent != descriptor_dir
                            or not re.fullmatch(r"[0-9a-f]{12}", path.parent.name)):
                        raise UnsafeScratch("unknown worker descriptor layout")
                    if path.name.endswith((".recovery.jsonl", ".orphans.jsonl")):
                        obs.other_files.append(str(path))
                    elif path.suffix == ".json":
                        desc = read_scanned_json(path, st, "worker descriptor")
                        obs.descriptors.append(parse_worker_descriptor(desc, path, root))
                    else:
                        raise UnsafeScratch("unknown worker descriptor artifact")
                elif inside(path, registry_dir):
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
        for owner_dir in owner_records.keys() | owner_scopes.keys():
            if owner_dir not in owner_records or owner_dir not in owner_scopes:
                raise UnsafeScratch("incomplete supervisor registry owner record")
            validate_owner_scope(owner_scopes[owner_dir], owner_records[owner_dir], owner_dir / "scope.json")
        pids = {d["pid"] for d in obs.daemons if d["pid"] is not None}
        pids.update(r["pid"] for r in obs.root_refs + obs.unix_refs)
        pids.update(d["pid"] for d in obs.descriptors)
        pids.update(owner["pid"] for owner in obs.registry_owners)
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
            event.update(outcome.record())
            return outcome
        except Exception:
            event["error"] = "invocation or result recording failed; outcome unknown"
            return CommandResult(None, timed_out=True)

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
    try:
        if start.stdout.strip().startswith("Daemon already running on "):
            ownership_revoked = True
            reason("start reported a competing daemon; no shutdown admitted")
        else:
            match = START_RE.fullmatch(start.stdout.strip()) if start.returncode == 0 and not start.timed_out else None
            start_ok = bool(match and match.group(1) == str(socket))
            expected_pid = int(match.group(2)) if start_ok else None
            if not start_ok:
                reason("start result uncertain; never retry")
            active = observation("active", {expected_pid} if expected_pid else set())
            admission, active_ok, decision = active_shutdown_admission(active, root, socket, expected_pid, start_ok)
            if not admission:
                ownership_revoked = True
                reason(decision)
            else:
                if decision:
                    reason(decision)
                captured = dict(active.pid_starts)
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
        second = observation("postflight", set(captured))
        quiet = interval_ok and snapshot_quiet(first) and snapshot_quiet(second)
        if not quiet:
            reason("independent post-shutdown scans are not both empty and valid")
        if any(first.pid_starts.get(pid) is not None or second.pid_starts.get(pid) is not None
               or pid not in first.pid_starts or pid not in second.pid_starts for pid in captured):
            quiet = False
            reason("captured process identity persisted, was reused, or was not checked twice")
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
