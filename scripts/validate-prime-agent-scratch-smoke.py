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
import stat
import subprocess
import sys
import time
from typing import Protocol

SOCKET_BUDGET = 103  # macOS sun_path[104], reserving one NUL byte.
MAX_OUTPUT = 1_000_000
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

    def record(self) -> dict:
        # Keep failure diagnostics without printing raw CLI output or descriptor secrets.
        return {
            "returncode": self.returncode,
            "timed_out": self.timed_out,
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
    other_files: list[str] = field(default_factory=list)
    pid_starts: dict[int, str | None] = field(default_factory=dict)

    def record(self) -> dict:
        return asdict(self)


class Runner(Protocol):
    def command(self, argv: list[str], timeout: int) -> CommandResult: ...
    def observe(self, root: Path, cli: Path) -> Observation: ...
    def pid_start(self, pid: int) -> str | None: ...
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
    if not cli.is_absolute() or cli.is_symlink() or not cli.is_file() or not os.access(cli, os.X_OK):
        raise UnsafeScratch("CLI must be an absolute, executable, non-symlink file")
    if not re.fullmatch(r"[0-9a-f]{64}", expected_sha256):
        raise UnsafeScratch("expected CLI SHA-256 is required")
    actual_sha256 = hashlib.sha256(cli.read_bytes()).hexdigest()
    if actual_sha256 != expected_sha256:
        raise UnsafeScratch("installed CLI SHA-256 does not match reviewed identity")
    project = root / "project"
    if project.exists() or project.is_symlink():
        raise UnsafeScratch("scratch project path already exists")
    return root, project


def parse_lsof(stdout: str, root: Path) -> list[dict]:
    refs: set[tuple[int, str]] = set()
    pid: int | None = None
    for line in stdout.splitlines():
        if not line:
            continue
        if line.startswith("p"):
            if not line[1:].isdigit() or int(line[1:]) <= 1:
                raise UnsafeScratch("malformed lsof PID")
            pid = int(line[1:])
        elif line.startswith("n"):
            name = line[1:]
            if pid is None:
                raise UnsafeScratch("lsof pathname before PID")
            if str(root) in name and (not name.startswith("/") or not inside(name, root)):
                raise UnsafeScratch("lsof root reference has an unrecognized or escaping path")
            if name.startswith("/") and inside(name, root):
                refs.add((pid, name))
    return [{"pid": pid, "path": path} for pid, path in sorted(refs)]


def parse_daemon_ps(result: CommandResult, root: Path) -> list[dict]:
    if result.timed_out or result.returncode != 0 or len(result.stdout.encode()) > MAX_OUTPUT:
        raise UnsafeScratch("daemon ps failed or exceeded output bound")
    try:
        daemons = json.loads(result.stdout)
    except ValueError as error:
        raise UnsafeScratch("daemon ps returned invalid JSON") from error
    if not isinstance(daemons, list):
        raise UnsafeScratch("daemon ps returned non-array JSON")
    safe = []
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
        safe.append({"socketPath": str(socket), "pid": pid, "status": status})
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


def snapshot_quiet(obs: Observation) -> bool:
    if not obs.valid or obs.reason or obs.root_refs or obs.unix_refs or obs.registry_files:
        return False
    if any(d.get("pid") is not None and obs.pid_starts.get(d["pid"]) is not None for d in obs.daemons):
        return False
    if any(d.get("status") != "orphan-file" for d in obs.daemons):
        return False
    if any(d.get("pid") is not None and obs.pid_starts.get(d["pid"]) is not None for d in obs.descriptors):
        return False
    return all(start is None for start in obs.pid_starts.values())


def baseline_empty(obs: Observation) -> bool:
    return (obs.valid and not obs.reason and not obs.daemons and not obs.root_refs
            and not obs.unix_refs and not obs.socket_files and not obs.descriptors
            and not obs.registry_files and not obs.other_files and not obs.pid_starts)


class NativeRunner:
    """One explicit CLI binary and independent OS scans under the wrapper environment."""

    def __init__(self, env: dict[str, str], cli: Path, cwd: Path):
        self.env = {**env, "LC_ALL": "C", "TZ": "UTC"}
        self.cli = cli
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
        try:
            done = subprocess.run(argv, cwd=self.cwd, env=self.env, timeout=timeout,
                                  capture_output=True, text=True, errors="replace", check=False)
            return CommandResult(done.returncode, done.stdout, done.stderr)
        except subprocess.TimeoutExpired as error:
            out = error.stdout or b""
            err = error.stderr or b""
            return CommandResult(None, out.decode(errors="replace") if isinstance(out, bytes) else out,
                                 err.decode(errors="replace") if isinstance(err, bytes) else err, True)
        except OSError:
            return CommandResult(None)

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
        if not start or "\n" in start or len(start) > 100:
            raise UnsafeScratch("process start identity missing or malformed")
        return start

    def observe(self, root: Path, cli: Path) -> Observation:
        try:
            return self._observe(root, cli)
        except (UnsafeScratch, OSError, ValueError) as error:
            # Errors here are bounded driver constants, never raw daemon output.
            return Observation(valid=False, reason=str(error)[:200])

    def _observe(self, root: Path, cli: Path) -> Observation:
        obs = Observation()
        obs.daemons = parse_daemon_ps(self.command([str(cli), "daemon", "ps", "--json"], 12), root)
        obs.root_refs = self._lsof(["+D", str(root)], root)
        obs.unix_refs = self._lsof(["-U"], root)
        descriptor_dir = root / "config" / "daemon-workers"
        registry_dir = root / "home" / ".prime" / "supervisor-owners"
        for path in root.rglob("*"):
            if path.is_symlink():
                raise UnsafeScratch("symlink inside private scratch root")
            mode = path.lstat().st_mode
            if stat.S_ISSOCK(mode):
                obs.socket_files.append(str(path))
            elif stat.S_ISREG(mode):
                if inside(path, descriptor_dir) and path.suffix == ".json":
                    if path.stat().st_size > MAX_OUTPUT:
                        raise UnsafeScratch("oversized worker descriptor")
                    try:
                        descriptor = json.loads(path.read_text())
                    except (ValueError, UnicodeError) as error:
                        raise UnsafeScratch("malformed worker descriptor") from error
                    if not isinstance(descriptor, dict):
                        raise UnsafeScratch("worker descriptor is not an object")
                    pid = descriptor.get("pid")
                    start_id = descriptor.get("processStartId")
                    if (descriptor.get("version") not in (1, 2) or type(pid) is not int or pid <= 1
                            or not isinstance(start_id, str) or not start_id):
                        raise UnsafeScratch("worker descriptor lacks a stable process identity")
                    for key in ("socketPath", "supervisorSocketPath"):
                        if not isinstance(descriptor.get(key), str) or not inside(descriptor[key], root):
                            raise UnsafeScratch("worker descriptor socket escapes scratch root")
                    obs.descriptors.append({"path": str(path), "pid": pid, "start_id": start_id,
                                            "socketPath": descriptor["socketPath"],
                                            "supervisorSocketPath": descriptor["supervisorSocketPath"]})
                elif inside(path, registry_dir):
                    obs.registry_files.append(str(path))
                else:
                    obs.other_files.append(str(path))
            elif not stat.S_ISDIR(mode):
                raise UnsafeScratch("unknown filesystem entry in scratch root")
        pids = {d["pid"] for d in obs.daemons if d["pid"] is not None}
        pids.update(r["pid"] for r in obs.root_refs + obs.unix_refs)
        pids.update(d["pid"] for d in obs.descriptors)
        for pid in sorted(pids):
            obs.pid_starts[pid] = self.pid_start(pid)
        for ref in obs.root_refs + obs.unix_refs:
            if obs.pid_starts[ref["pid"]] is None:
                raise UnsafeScratch("root reference disappeared during process identity scan")
        return obs


def record_report(root: Path, report: dict) -> None:
    path = root / "scratch-smoke-report.json"
    if path.exists() or path.is_symlink():
        raise UnsafeScratch("scratch report path already exists; root retained")
    path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    path.chmod(0o600)


def smoke(env: dict[str, str], cli: Path, expected_sha256: str, runner: Runner, *, run_native: bool) -> dict:
    """One guarded start and one scoped shutdown; every root is retained."""
    root, project = validate_root(env, cli, expected_sha256)
    report: dict = {"root": str(root), "cli_sha256": expected_sha256,
                    "mode": "smoke" if run_native else "preflight", "status": "blocked_preflight",
                    "events": [], "reasons": []}

    def observe() -> Observation:
        try:
            return runner.observe(root, cli)
        except Exception:
            return Observation(valid=False, reason="independent observation raised an exception")

    def command(argv: list[str], timeout: int) -> CommandResult:
        try:
            return runner.command(argv, timeout)
        except Exception:
            return CommandResult(None)  # Unknown outcome, never replay a mutation.

    baseline = observe()
    report["baseline"] = baseline.record()
    if not baseline_empty(baseline):
        report["reasons"].append(baseline.reason or "scratch baseline is not empty and uniquely owned")
        record_report(root, report)
        return report  # Never shutdown an unowned preflight root.
    if not run_native:
        report["status"] = "preflight_ready"
        record_report(root, report)
        return report

    project.mkdir(mode=0o700)
    socket = root / "tmp" / f"prime-agent-{os.getuid()}" / "daemon.sock"
    start_args = [str(cli), "daemon", "start", "--offline", "--no-extensions", "--no-skills",
                  "--no-prompt-templates", "--no-context-files", "--no-tools", "--cwd", str(project)]
    # From this point an owned start was attempted; even a timeout could have
    # detached a daemon. No second start is ever allowed in this root.
    ownership_revoked = False
    start_ok = False
    active_ok = False
    captured: dict[int, str | None] = {}
    try:
        start = command(start_args, 18)
        report["events"].append({"operation": "daemon_start_once", **start.record()})
        if start.stdout.strip().startswith("Daemon already running on "):
            ownership_revoked = True
            report["reasons"].append("start found a competing daemon after the empty baseline; no shutdown admitted")
        else:
            match = START_RE.fullmatch(start.stdout.strip()) if start.returncode == 0 and not start.timed_out else None
            start_ok = bool(match and match.group(1) == str(socket))
            if not start_ok:
                report["reasons"].append("start result is uncertain; never retry")
            active = observe()
            report["active"] = active.record()
            expected_pid = int(match.group(2)) if start_ok else None
            unexpected_owner = (active.valid and
                (any(d["socketPath"] != str(socket) or d["pid"] not in (expected_pid, None)
                     for d in active.daemons)
                 or any(ref["pid"] != expected_pid for ref in active.root_refs + active.unix_refs)
                 or bool(active.descriptors)
                 or any(pid != expected_pid and start_id is not None
                        for pid, start_id in active.pid_starts.items())))
            if (not active.valid and "out-of-root" in active.reason) or unexpected_owner:
                ownership_revoked = True
                report["reasons"].append("active observation found foreign or unexpected ownership; no shutdown admitted")
            else:
                active_ok = (active.valid and start_ok and len(active.daemons) == 1
                             and active.daemons[0]["socketPath"] == str(socket)
                             and active.daemons[0]["pid"] == expected_pid
                             and active.daemons[0]["status"] == "current"
                             and active.pid_starts.get(expected_pid) is not None)
                if not active_ok:
                    report["reasons"].append("active supervisor identity was not uniquely reconciled")
                if active.valid:
                    captured = dict(active.pid_starts)
    except Exception:
        report["reasons"].append("unexpected driver error after owned start attempt")
    finally:
        if ownership_revoked:
            report["status"] = "unresolved_ownership"
        else:
            # Top-level shutdown selects the isolated HOME+TMPDIR state root.
            # The per-socket `daemon shutdown` cannot reap unknown/hidden workers.
            stop = command([str(cli), "shutdown", "--force", "--json"], 35)
            report["events"].append({"operation": "top_level_shutdown_once", **stop.record()})
            try:
                report["stopped"] = parse_shutdown(stop, root)
                shutdown_ok = True
            except UnsafeScratch as error:
                shutdown_ok = False
                report["reasons"].append(str(error))
            first = observe()
            try:
                runner.quiet_interval()
                interval_ok = True
            except Exception:
                interval_ok = False
                report["reasons"].append("post-shutdown quiet interval failed")
            second = observe()
            report["postflight"] = [first.record(), second.record()]
            quiet = interval_ok and snapshot_quiet(first) and snapshot_quiet(second)
            if not quiet:
                report["reasons"].append("independent post-shutdown scans are not both empty and valid")
            identities_gone = True
            for pid, start_id in captured.items():
                try:
                    current = runner.pid_start(pid)
                except Exception:
                    identities_gone = False
                    break
                if not start_id or current is not None:
                    identities_gone = False  # Same PID still alive or PID reuse: unresolved.
                    break
            if not identities_gone:
                report["reasons"].append("captured process identity persists, was reused, or could not be checked")
            report["status"] = "stopped" if start_ok and active_ok and shutdown_ok and quiet and identities_gone else "unresolved"
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
