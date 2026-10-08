#!/usr/bin/env python3
"""Bounded operator-launched coordinator for an approved Prime Agent role cutover.

A normal invocation is preflight-only.  Mutating execution additionally requires
``--execute`` and the exact accepted candidate commit as ``--authorization``.
The coordinator never reviews, merges non-fast-forward, retries, accepts UAT, or
makes rollback decisions.  It stops at the first failure and records the last
proven checkpoint in the operator-selected private state directory.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import stat
import subprocess
import tempfile
import time
from typing import Any, Sequence

SCHEMA_VERSION = 1
CHECKPOINTS = (
    "INITIAL",
    "PREFLIGHT_VERIFIED",
    "SHUTDOWN_REQUESTED",
    "OLD_RUNTIME_STOPPED",
    "LANDING_REQUESTED",
    "CANDIDATE_LANDED",
    "APPLY_REQUESTED",
    "PLUGIN_APPLIED",
    "START_REQUESTED",
    "NEW_RUNTIME_STARTED",
    "RESUME_CHECKLIST_EMITTED",
)
HEX40 = re.compile(r"^[0-9a-f]{40}$")
PROCESS_ROLES = frozenset({"daemon", "worker", "client", "tui", "launcher", "wrapper"})
PRE_SHUTDOWN_ALLOWED_ROLES = frozenset({"daemon", "worker"})


class CutoverError(RuntimeError):
    pass


@dataclass(frozen=True)
class Result:
    argv: tuple[str, ...]
    returncode: int
    stdout: str = ""
    stderr: str = ""


@dataclass(frozen=True)
class RawResult:
    argv: tuple[str, ...]
    returncode: int
    stdout: bytes = b""
    stderr: bytes = b""


class LocalRunner:
    def __init__(self) -> None:
        self.children: dict[int, subprocess.Popen[bytes]] = {}

    def run(self, argv: Sequence[str], *, cwd: Path | None = None, allow_failure: bool = False, timeout: float | None = None) -> Result:
        try:
            completed = subprocess.run(list(argv), cwd=cwd, text=True, capture_output=True, check=False, timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            raise CutoverError(f"command timed out: {' '.join(argv)}") from exc
        result = Result(tuple(argv), completed.returncode, completed.stdout, completed.stderr)
        if result.returncode and not allow_failure:
            raise CutoverError(f"command failed ({result.returncode}): {' '.join(argv)}")
        return result

    def run_version(self, argv: Sequence[str], *, cwd: Path | None = None, timeout: float = 10) -> RawResult:
        try:
            completed = subprocess.run(list(argv), cwd=cwd, capture_output=True, check=False, timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            raise CutoverError(f"command timed out: {' '.join(argv)}") from exc
        return RawResult(tuple(argv), completed.returncode, completed.stdout, completed.stderr)

    def start(self, argv: Sequence[str], *, cwd: Path | None = None) -> Result:
        process = subprocess.Popen(
            list(argv), cwd=cwd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL, start_new_session=True,
        )
        self.children[process.pid] = process
        return Result(tuple(argv), 0, json.dumps({"pid": process.pid}) + "\n", "")

    def child_exit_code(self, pid: int) -> int | None:
        process = self.children.get(pid)
        if process is None:
            raise CutoverError(f"started child PID is not owned by coordinator: {pid}")
        return process.poll()


class Checkpoints:
    def __init__(self, root: Path, candidate: str, input_digest: str):
        self.root = root.resolve()
        if self.root.exists() and (not self.root.is_dir() or self.root.is_symlink()):
            raise CutoverError(f"private state root must be a real directory: {self.root}")
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.root, 0o700)
        self.path = self.root / "cutover-checkpoint.json"
        self.candidate = candidate
        self.input_digest = input_digest
        self.current = "INITIAL"
        if self.path.exists():
            current = json.loads(self.path.read_text())
            if current.get("candidateCommit") != candidate or current.get("inputDigest") != input_digest:
                raise CutoverError("checkpoint belongs to different immutable inputs")
            self.current = current.get("checkpoint", "")
            if self.current != "PREFLIGHT_VERIFIED":
                raise CutoverError("existing transaction is beyond preflight; automatic retry is forbidden")

    def write(self, checkpoint: str, evidence: dict[str, Any] | None = None) -> None:
        if checkpoint not in CHECKPOINTS:
            raise CutoverError(f"unknown checkpoint: {checkpoint}")
        value = {
            "schemaVersion": SCHEMA_VERSION,
            "candidateCommit": self.candidate,
            "inputDigest": self.input_digest,
            "checkpoint": checkpoint,
            "evidence": evidence or {},
        }
        data = (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()
        fd, raw = tempfile.mkstemp(prefix=".cutover-checkpoint.", dir=self.root)
        tmp = Path(raw)
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp, self.path)
            os.chmod(self.path, 0o600)
            self.current = checkpoint
        finally:
            if tmp.exists():
                tmp.unlink()


def sha256_file(path: Path) -> str:
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or path.is_symlink():
        raise CutoverError(f"expected regular non-symlink file: {path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise CutoverError(f"{label} must be an object")
    return value


def require_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise CutoverError(f"{label} must be a non-empty string")
    return value


def parse_json_output(result: Result, label: str) -> Any:
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise CutoverError(f"{label} did not return JSON") from exc


def process_rows(text: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: set[int] = set()
    for raw in text.splitlines():
        if not raw.strip():
            continue
        fields = raw.strip().split(None, 2)
        if len(fields) != 3 or not fields[0].isdigit() or not fields[1].isdigit() or not fields[2]:
            raise CutoverError("targeted process observation returned a malformed row")
        pid = int(fields[0])
        if pid <= 0 or pid in seen:
            raise CutoverError("targeted process observation returned duplicate or invalid PIDs")
        seen.add(pid)
        rows.append({"pid": pid, "ppid": int(fields[1]), "command": fields[2]})
    return rows


def recovery_for(checkpoint: str) -> str:
    return {
        "INITIAL": "leave the accepted generation running; correct preflight inputs",
        "PREFLIGHT_VERIFIED": "leave the accepted generation running; no shutdown was requested",
        "SHUTDOWN_REQUESTED": "inspect process, socket, and status evidence; do not assume the accepted generation is running or stopped",
        "OLD_RUNTIME_STOPPED": "restart only the proven unchanged accepted generation",
        "LANDING_REQUESTED": "inspect local and remote refs without retrying an uncertain merge or push",
        "CANDIDATE_LANDED": "use history-preserving Git recovery after separately confirming local and remote refs",
        "APPLY_REQUESTED": "inspect fixed managed surfaces; restore only exact known postimages and do not start a runtime",
        "PLUGIN_APPLIED": "restore only fixed-inventory surfaces that still match known postimages; otherwise stop for manual recovery",
        "START_REQUESTED": "inspect status once; do not start a second runtime",
        "NEW_RUNTIME_STARTED": "apply the known-state restore rule, then recover owner, episode, and ordinary sessions in order",
        "RESUME_CHECKLIST_EMITTED": "continue only through separately authorized UAT; do not infer acceptance",
    }[checkpoint]


class Coordinator:
    def __init__(self, config: dict[str, Any], state_dir: Path, runner: Any | None = None):
        self.config = config
        self.runner = runner or LocalRunner()
        self.candidate = require_object(config.get("candidate"), "candidate")
        self.runtime = require_object(config.get("runtime"), "runtime")
        self.main = require_object(config.get("main"), "main")
        self.operator = require_object(config.get("operator"), "operator")
        self.bundle = require_object(config.get("bundle"), "bundle")
        self.commit = require_string(self.candidate.get("commit"), "candidate.commit")
        self.tree = require_string(self.candidate.get("tree"), "candidate.tree")
        if not HEX40.fullmatch(self.commit) or not HEX40.fullmatch(self.tree):
            raise CutoverError("candidate commit and tree must be lowercase 40-character Git object IDs")
        self.primary = Path(require_string(self.main.get("checkout"), "main.checkout")).resolve()
        self.executable = Path(require_string(self.runtime.get("executableRealpath"), "runtime.executableRealpath"))
        if not self.executable.is_absolute():
            raise CutoverError("runtime executable realpath must be absolute")
        input_digest = hashlib.sha256((json.dumps(config, sort_keys=True, separators=(",", ":")) + "\n").encode()).hexdigest()
        self.checkpoints = Checkpoints(state_dir, self.commit, input_digest)
        self.last_checkpoint = self.checkpoints.current
        self.observations: dict[str, Any] = {}

    def command(self, argv: Sequence[str], *, cwd: Path | None = None, allow_failure: bool = False, timeout: float | None = None) -> Result:
        return self.runner.run(tuple(str(item) for item in argv), cwd=cwd, allow_failure=allow_failure, timeout=timeout)

    def version_command(self) -> RawResult:
        argv = self.cli_argv("--version")
        return self.runner.run_version(argv, cwd=None, timeout=10)

    def cli_argv(self, *args: str) -> tuple[str, ...]:
        return (*tuple(self.runtime["cliArgvPrefix"]), *args)

    def record(self, checkpoint: str, evidence: dict[str, Any] | None = None) -> None:
        self.checkpoints.write(checkpoint, evidence)
        self.last_checkpoint = checkpoint

    def validate_static(self) -> None:
        if self.config.get("schemaVersion") != SCHEMA_VERSION:
            raise CutoverError("unsupported coordinator schema")
        require_string(self.config.get("operationId"), "operationId")
        if not self.primary.is_dir() or self.primary.is_symlink():
            raise CutoverError(f"primary checkout must be a real directory: {self.primary}")
        for key in ("clientsExited", "foreignOwnersCheckpointed", "bundleVerified", "isolatedRestoreVerified"):
            if self.operator.get(key) is not True:
                raise CutoverError(f"operator confirmation is required: {key}")

        kind = require_string(self.runtime.get("entrypointKind"), "runtime.entrypointKind")
        prefix = self.runtime.get("cliArgvPrefix")
        entrypoint = Path(require_string(self.runtime.get("entrypointRealpath"), "runtime.entrypointRealpath"))
        if kind not in {"compiled", "node"}:
            raise CutoverError("runtime.entrypointKind must be compiled or node")
        if not isinstance(prefix, list) or not prefix or not all(isinstance(value, str) and value for value in prefix):
            raise CutoverError("runtime.cliArgvPrefix must be a non-empty string list")
        if kind == "compiled" and prefix != [str(self.executable)]:
            raise CutoverError("compiled runtime CLI prefix must be the exact executable")
        if kind == "node" and (len(prefix) != 2 or prefix != [str(self.executable), str(entrypoint)]):
            raise CutoverError("node runtime CLI prefix must be the exact interpreter and entrypoint")
        if not entrypoint.is_absolute():
            raise CutoverError("runtime entrypoint realpath must be absolute")
        for key in ("executableSha256", "entrypointSha256"):
            value = require_string(self.runtime.get(key), f"runtime.{key}")
            if not re.fullmatch(r"[0-9a-f]{64}", value):
                raise CutoverError(f"runtime.{key} must be a lowercase SHA-256")
        self.entrypoint = entrypoint


        inventory = self.config.get("processInventory")
        if not isinstance(inventory, list) or not inventory:
            raise CutoverError("processInventory must be a non-empty list")
        seen: set[int] = set()
        worker_sockets: set[str] = set()
        expected_daemons = 0
        for index, item_value in enumerate(inventory):
            item = require_object(item_value, f"processInventory[{index}]")
            pid = item.get("pid")
            if not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0 or pid in seen:
                raise CutoverError("process inventory PIDs must be unique positive integers")
            seen.add(pid)
            role = require_string(item.get("role"), f"processInventory[{index}].role")
            item_kind = require_string(item.get("entrypointKind"), f"processInventory[{index}].entrypointKind")
            if role not in PROCESS_ROLES:
                raise CutoverError(f"unsupported declared process role: {role}")
            if item_kind != kind:
                raise CutoverError(f"processInventory[{index}] entrypoint kind does not match the supported runtime")
            for key in ("version", "buildId", "daemonSocket"):
                require_string(item.get(key), f"processInventory[{index}].{key}")
            expected_present = item.get("expectedPresent")
            if not isinstance(expected_present, bool):
                raise CutoverError("processInventory expectedPresent must be boolean")
            if expected_present and role not in PRE_SHUTDOWN_ALLOWED_ROLES:
                raise CutoverError(f"client/TUI/launcher/wrapper must be absent before shutdown: PID {pid}")
            if not expected_present and item.get("acknowledgedExit") is not True:
                raise CutoverError("absent client/TUI/launcher/wrapper must have acknowledgedExit")
            if expected_present and role == "daemon":
                expected_daemons += 1
                if item["daemonSocket"] != self.runtime.get("daemonSocket") or item["version"] != self.runtime.get("version") or item["buildId"] != self.runtime.get("buildId"):
                    raise CutoverError("declared old daemon identity does not match the runtime contract")
            if expected_present and role == "worker":
                parent_pid = item.get("parentPid")
                if not isinstance(parent_pid, int) or isinstance(parent_pid, bool) or parent_pid <= 0:
                    raise CutoverError("approved old worker requires a positive parentPid")
                if item["version"] != self.runtime.get("version") or item["buildId"] != self.runtime.get("buildId"):
                    raise CutoverError("approved old worker version/build must match the exact validated supervisor")
                worker_socket = item["daemonSocket"]
                if worker_socket == self.runtime.get("daemonSocket") or worker_socket in worker_sockets:
                    raise CutoverError("approved old worker requires a distinct unique declared socket")
                worker_sockets.add(worker_socket)
        if expected_daemons != 1:
            raise CutoverError("process inventory must declare exactly one expected old daemon")


        sessions = self.config.get("sessions")
        if not isinstance(sessions, list) or [entry.get("role") for entry in sessions if isinstance(entry, dict)] != ["owner", "episode", "ordinary"]:
            raise CutoverError("sessions must be ordered owner, episode, ordinary")
        for entry in sessions:
            for key in ("sessionId", "name", "cwd", "checkpoint"):
                require_string(entry.get(key), f"sessions.{entry.get('role')}.{key}")
        if sessions[2].get("baselineTurn") is not True:
            raise CutoverError("ordinary saved conversation requires a successful baseline turn")

        start_args = self.runtime.get("startArgs")
        if not isinstance(start_args, list) or start_args[:len(prefix)] != prefix:
            raise CutoverError("runtime.startArgs must begin with the exact CLI entrypoint prefix")
        if start_args.count("--mode") != 1:
            raise CutoverError("runtime.startArgs must contain exactly one --mode")
        mode_index = start_args.index("--mode")
        if mode_index + 1 >= len(start_args) or start_args[mode_index + 1] != "daemon":
            raise CutoverError("runtime.startArgs must use the exact --mode daemon pair")
        if start_args.count("--daemon-socket") != 1:
            raise CutoverError("runtime.startArgs must contain exactly one --daemon-socket")
        socket_index = start_args.index("--daemon-socket")
        if socket_index + 1 >= len(start_args) or start_args[socket_index + 1] != self.runtime.get("daemonSocket"):
            raise CutoverError("runtime.startArgs must use the exact configured daemon socket")
        readiness = require_object(self.runtime.get("readiness"), "runtime.readiness")
        attempts = readiness.get("attempts")
        interval = readiness.get("intervalSeconds")
        deadline = readiness.get("deadlineSeconds")
        if not isinstance(attempts, int) or isinstance(attempts, bool) or not 1 <= attempts <= 20:
            raise CutoverError("runtime.readiness.attempts must be an integer from 1 through 20")
        if not isinstance(interval, (int, float)) or isinstance(interval, bool) or not 0 <= interval <= 1:
            raise CutoverError("runtime.readiness.intervalSeconds must be from 0 through 1")
        if not isinstance(deadline, (int, float)) or isinstance(deadline, bool) or not 0 < deadline <= 10:
            raise CutoverError("runtime.readiness.deadlineSeconds must be greater than 0 and at most 10")


        rollback = require_object(self.config.get("rollbackRecipe"), "rollbackRecipe")
        if set(rollback) != {"integrationMerge", "linearReverts", "acceptedBaseline", "commitMessage"}:
            raise CutoverError("rollbackRecipe must contain only the exact topology fields")
        integration = require_object(rollback.get("integrationMerge"), "rollbackRecipe.integrationMerge")
        if set(integration) != {"commit", "parents", "mainline"}:
            raise CutoverError("rollbackRecipe.integrationMerge must contain only commit, parents, and mainline")
        merge = require_string(integration.get("commit"), "rollbackRecipe.integrationMerge.commit")
        parents = integration.get("parents")
        if not isinstance(parents, list) or len(parents) != 2 or not all(isinstance(value, str) and HEX40.fullmatch(value) for value in parents):
            raise CutoverError("rollback integration parents must be two exact Git object IDs")
        if not HEX40.fullmatch(merge):
            raise CutoverError("rollback integration merge must be an exact Git object ID")
        if integration.get("mainline") != 2:
            raise CutoverError("rollback integration merge mainline must be 2")
        linear = rollback.get("linearReverts")
        if not isinstance(linear, list) or not linear or not all(isinstance(value, str) and HEX40.fullmatch(value) for value in linear):
            raise CutoverError("rollback linearReverts must be exact Git object IDs, not placeholders")
        if linear[0] != self.commit or len(set(linear)) != len(linear):
            raise CutoverError("rollback linearReverts must start at the exact candidate without duplicates")
        baseline = require_object(rollback.get("acceptedBaseline"), "rollbackRecipe.acceptedBaseline")
        if set(baseline) != {"commit", "tree"}:
            raise CutoverError("rollbackRecipe.acceptedBaseline must contain only commit and tree")
        baseline_commit = require_string(baseline.get("commit"), "rollbackRecipe.acceptedBaseline.commit")
        baseline_tree = require_string(baseline.get("tree"), "rollbackRecipe.acceptedBaseline.tree")
        if not HEX40.fullmatch(baseline_commit) or not HEX40.fullmatch(baseline_tree):
            raise CutoverError("rollback accepted baseline must contain exact commit and tree IDs")
        if baseline_commit != self.main.get("prelandingCommit") or parents[1] != baseline_commit:
            raise CutoverError("rollback accepted baseline and merge parent 2 must equal prelanding main")
        if rollback.get("commitMessage") != "Rollback Prime Claw Generation A cutover":
            raise CutoverError("rollback commit message is not the fixed accepted value")


    def verify_bundle(self) -> None:
        bundle_path = Path(require_string(self.bundle.get("path"), "bundle.path"))
        expected = require_string(self.bundle.get("manifestSha256"), "bundle.manifestSha256")
        bundle_tool = Path(__file__).resolve().with_name("manage-prime-agent-cutover-bundle.py")
        result = self.command((str(bundle_tool), "verify", "--bundle", str(bundle_path)))
        value = require_object(parse_json_output(result, "bundle verifier"), "bundle verifier result")
        if value.get("status") != "VERIFIED" or value.get("manifestSha256") != expected:
            raise CutoverError("private preactivation bundle verification mismatch")
        self.observations["bundleManifestSha256"] = expected

    def verify_process_inventory(self, *, require_absent: bool) -> None:
        discovered_result = self.command(("pgrep", "-x", "prime-agent"), allow_failure=True)
        if discovered_result.returncode == 0:
            raw_pids = [line.strip() for line in discovered_result.stdout.splitlines() if line.strip()]
            if not raw_pids or any(not value.isdigit() or int(value) <= 0 for value in raw_pids):
                raise CutoverError("exact Prime Agent PID discovery returned malformed output")
            discovered = {int(value) for value in raw_pids}
            if len(discovered) != len(raw_pids):
                raise CutoverError("exact Prime Agent PID discovery returned duplicate PIDs")
        elif discovered_result.returncode == 1 and not discovered_result.stdout.strip():
            discovered = set()
        else:
            raise CutoverError(f"exact Prime Agent PID discovery failed ({discovered_result.returncode})")
        declared = {entry["pid"]: entry for entry in self.config["processInventory"]}
        requested = sorted(discovered | set(declared))
        rows: list[dict[str, Any]] = []
        if requested:
            observed_result = self.command(("ps", "-p", ",".join(str(pid) for pid in requested), "-o", "pid=,ppid=,command="), allow_failure=True)
            if observed_result.returncode not in (0, 1):
                raise CutoverError(f"targeted process observation failed ({observed_result.returncode})")
            rows = process_rows(observed_result.stdout)
            if any(row["pid"] not in requested for row in rows):
                raise CutoverError("targeted process observation returned an unrequested PID")
        observed = {row["pid"]: row for row in rows}
        missing_discovered = discovered - set(observed)
        if missing_discovered:
            raise CutoverError(f"exactly discovered Prime Agent PIDs disappeared during observation: {sorted(missing_discovered)}")
        undeclared = discovered - set(declared)
        if undeclared:
            raise CutoverError(f"undeclared Prime Agent processes remain: {sorted(undeclared)}")
        old_daemon = next(entry for entry in declared.values() if entry["role"] == "daemon" and entry["expectedPresent"])
        evidence: list[dict[str, Any]] = []
        prefix = tuple(self.runtime["cliArgvPrefix"])
        for pid, entry in declared.items():
            row = observed.get(pid)
            if require_absent:
                if row is not None:
                    raise CutoverError(f"stale Prime Agent processes remain: {[item['pid'] for item in rows]}")
                continue
            if entry["expectedPresent"] and row is None:
                raise CutoverError(f"declared {entry['role']} PID is absent before shutdown: {pid}")
            if not entry["expectedPresent"] and row is not None:
                raise CutoverError(f"declared {entry['role']} must be absent before shutdown: {pid}")
            if row is None:
                evidence.append({"pid": pid, "role": entry["role"], "observed": "absent"})
                continue
            try:
                tokens = tuple(shlex.split(row["command"]))
            except ValueError as exc:
                raise CutoverError(f"malformed command for declared PID {pid}") from exc
            if not tokens or (tokens[0] != "prime-agent" and tokens[:len(prefix)] != prefix):
                raise CutoverError(f"declared process entrypoint mismatch for PID {pid}")
            if entry["role"] == "worker" and row["ppid"] != entry["parentPid"]:
                raise CutoverError(f"declared worker parent mismatch for PID {pid}")
            if entry["role"] == "worker" and entry["parentPid"] != old_daemon["pid"]:
                raise CutoverError(f"declared worker is not tied to the approved old daemon: PID {pid}")
            evidence.append({
                "pid": pid, "ppid": row["ppid"], "role": entry["role"],
                "entrypointKind": entry["entrypointKind"], "commandSha256": hashlib.sha256(row["command"].encode()).hexdigest(),
                "declaredVersion": entry["version"], "declaredBuildId": entry["buildId"],
                "daemonSocket": entry["daemonSocket"], "observed": "present",
                "identityBasis": "status-bound-daemon" if entry["role"] == "daemon" else "approved-worker-parent-and-entrypoint",
            })
        self.observations["processes"] = evidence

    def verify_executable(self) -> None:
        executable_actual = Path(os.path.realpath(self.executable))
        entrypoint_actual = Path(os.path.realpath(self.entrypoint))
        if executable_actual != self.executable or entrypoint_actual != self.entrypoint:
            raise CutoverError("runtime executable and entrypoint must be their own realpaths")
        executable_sha = sha256_file(self.executable)
        entrypoint_sha = sha256_file(self.entrypoint)
        if executable_sha != self.runtime["executableSha256"] or entrypoint_sha != self.runtime["entrypointSha256"]:
            raise CutoverError("runtime executable or entrypoint build digest mismatch")
        result = self.version_command()
        expected = require_string(self.runtime.get("version"), "runtime.version")
        try:
            expected_bytes = expected.encode("utf-8") + b"\n"
        except UnicodeEncodeError as exc:
            raise CutoverError("runtime.version must be valid UTF-8") from exc
        if result.returncode:
            raise CutoverError(f"runtime entrypoint version command failed ({result.returncode})")
        if bool(result.stdout) == bool(result.stderr):
            raise CutoverError("runtime entrypoint version output must use exactly one stream")
        version_output = result.stdout or result.stderr
        if version_output != expected_bytes:
            raise CutoverError("runtime entrypoint version mismatch")
        expected_build = require_string(self.runtime.get("buildId"), "runtime.buildId")
        self.observations["runtime"] = {
            "entrypointKind": self.runtime["entrypointKind"],
            "cliArgvPrefix": self.runtime["cliArgvPrefix"],
            "executableRealpath": str(self.executable), "executableSha256": executable_sha,
            "entrypointRealpath": str(self.entrypoint), "entrypointSha256": entrypoint_sha,
            "version": expected, "buildId": expected_build,
            "daemonSocket": self.runtime["daemonSocket"],
        }

    def status_row(self, result: Result, label: str, *, readiness: bool, expected_pid: int | None = None) -> tuple[str, dict[str, Any] | None]:
        if result.returncode:
            raise CutoverError(f"{label} command failed ({result.returncode})")
        value = parse_json_output(result, label)
        if not isinstance(value, list):
            raise CutoverError(f"{label} must be a JSON array")
        if len(value) > 1:
            if not all(isinstance(item, dict) for item in value):
                raise CutoverError(f"{label} contains malformed rows")
            raise CutoverError(f"{label} reported duplicate runtimes")
        if not value:
            if readiness:
                return "pending", None
            raise CutoverError(f"{label} did not report the declared old daemon")
        if not isinstance(value[0], dict):
            raise CutoverError(f"{label} row is malformed")
        row = value[0]
        status_value = row.get("status")
        if not isinstance(status_value, str):
            raise CutoverError(f"{label} status is missing or malformed")
        if readiness and status_value in {"unreachable", "orphan-file"}:
            socket_value = row.get("socketPath")
            if not isinstance(socket_value, str) or socket_value != self.runtime["daemonSocket"]:
                raise CutoverError(f"{label} pending socket identity mismatch")
            optional_identity = {
                "version": self.runtime["version"],
                "buildId": self.runtime["buildId"],
                "executablePath": str(self.entrypoint),
            }
            for key, wanted in optional_identity.items():
                if key in row and (not isinstance(row[key], str) or row[key] != wanted):
                    raise CutoverError(f"{label} pending identity mismatch: {key}")
            if "pid" in row:
                pid = row["pid"]
                if not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0 or (expected_pid is not None and pid != expected_pid):
                    raise CutoverError(f"{label} pending identity mismatch: pid")
            return "pending", row
        if status_value != "current":
            raise CutoverError(f"{label} has unsupported status: {status_value}")
        expected = {
            "socketPath": self.runtime["daemonSocket"],
            "version": self.runtime["version"],
            "buildId": self.runtime["buildId"],
            "executablePath": str(self.entrypoint),
        }
        for key, wanted in expected.items():
            if not isinstance(row.get(key), str) or row[key] != wanted:
                raise CutoverError(f"{label} identity mismatch: {key}")
        pid = row.get("pid")
        if not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0:
            raise CutoverError(f"{label} has no valid PID")
        if expected_pid is not None and pid != expected_pid:
            raise CutoverError(f"{label} identity mismatch: pid")
        return "ready", row

    def rollback_commands(self) -> list[list[str]]:
        rollback = self.config["rollbackRecipe"]
        merge = rollback["integrationMerge"]["commit"]
        commands = [["git", "revert", "--no-commit", commit] for commit in rollback["linearReverts"]]
        commands.append(["git", "revert", "--no-commit", "-m", "2", merge])
        commands.append(["git", "commit", "-m", rollback["commitMessage"]])
        return commands

    def verify_rollback_topology(self) -> None:
        rollback = self.config["rollbackRecipe"]
        integration = rollback["integrationMerge"]
        merge = integration["commit"]
        declared_parents = integration["parents"]
        before = self.main["prelandingCommit"]
        for oid in [*rollback["linearReverts"], merge, *declared_parents, before]:
            self.command(("git", "cat-file", "-e", f"{oid}^{{commit}}"), cwd=self.primary)
        actual_parents = self.command(("git", "rev-list", "--parents", "-n", "1", merge), cwd=self.primary).stdout.strip().split()[1:]
        if actual_parents != declared_parents:
            raise CutoverError("integration merge parent order does not match the declared topology")
        if declared_parents[1] != before or integration["mainline"] != 2:
            raise CutoverError("integration merge mainline does not select prelanding parent 2")
        linear = rollback["linearReverts"]
        expected_parents = linear[1:] + [merge]
        for commit, expected_parent in zip(linear, expected_parents, strict=True):
            line = self.command(("git", "rev-list", "--parents", "-n", "1", commit), cwd=self.primary).stdout.strip().split()
            if len(line) != 2 or line[0] != commit or line[1] != expected_parent:
                raise CutoverError("rollback linearReverts are not the complete newest-to-oldest first-parent chain")
        baseline_tree = self.command(("git", "rev-parse", f"{before}^{{tree}}"), cwd=self.primary).stdout.strip()
        if baseline_tree != rollback["acceptedBaseline"]["tree"]:
            raise CutoverError("rollback expected baseline tree mismatch")
        commands = self.rollback_commands()
        with tempfile.TemporaryDirectory(prefix="prime-claw-rollback-proof-") as raw:
            scratch = Path(raw) / "checkout"
            self.command(("git", "clone", "--no-local", "--no-checkout", str(self.primary), str(scratch)))
            self.command(("git", "checkout", "--detach", self.commit), cwd=scratch)
            for command in commands[:-1]:
                self.command(tuple(command), cwd=scratch)
            resulting_tree = self.command(("git", "write-tree"), cwd=scratch).stdout.strip()
            if resulting_tree != baseline_tree:
                raise CutoverError("rollback recipe does not produce the accepted prelanding baseline")
        self.observations["rollback"] = {
            "integrationMerge": merge, "integrationParents": actual_parents,
            "mainline": 2, "linearReverts": linear, "candidateCommit": self.commit,
            "prelandingCommit": before, "resultingTree": baseline_tree,
            "commands": commands, "proof": "isolated-no-local-clone-inverse",
        }

    def verify_git(self) -> None:
        branch = require_string(self.main.get("branch"), "main.branch")
        remote = require_string(self.main.get("remote"), "main.remote")
        before = require_string(self.main.get("prelandingCommit"), "main.prelandingCommit")
        if not HEX40.fullmatch(before):
            raise CutoverError("main.prelandingCommit must be a Git object ID")
        git_dir = Path(self.command(("git", "rev-parse", "--path-format=absolute", "--git-dir"), cwd=self.primary).stdout.strip()).resolve()
        common_dir = Path(self.command(("git", "rev-parse", "--path-format=absolute", "--git-common-dir"), cwd=self.primary).stdout.strip()).resolve()
        if git_dir != common_dir:
            raise CutoverError("primary checkout is a linked worktree")
        current_branch = self.command(("git", "symbolic-ref", "--quiet", "--short", "HEAD"), cwd=self.primary).stdout.strip()
        if current_branch != branch:
            raise CutoverError("primary checkout is not on the configured branch")
        if self.command(("git", "status", "--porcelain"), cwd=self.primary).stdout:
            raise CutoverError("primary checkout is not clean")
        head = self.command(("git", "rev-parse", "HEAD"), cwd=self.primary).stdout.strip()
        if head != before:
            raise CutoverError("primary checkout is not at the approved prelanding commit")
        candidate_tree = self.command(("git", "rev-parse", f"{self.commit}^{{tree}}"), cwd=self.primary).stdout.strip()
        if candidate_tree != self.tree:
            raise CutoverError("candidate tree mismatch")
        remote_line = self.command(("git", "ls-remote", remote, f"refs/heads/{branch}"), cwd=self.primary).stdout.strip()
        remote_head = remote_line.split()[0] if remote_line else ""
        if remote_head != before:
            raise CutoverError("remote main is not synchronized to prelanding main")
        self.command(("git", "merge-base", "--is-ancestor", before, self.commit), cwd=self.primary)
        self.verify_rollback_topology()
        self.observations["git"] = {"prelandingCommit": before, "remoteCommit": remote_head, "candidateCommit": self.commit, "candidateTree": self.tree}

    def preflight(self) -> dict[str, Any]:
        self.validate_static()
        self.verify_bundle()
        self.verify_executable()
        self.verify_process_inventory(require_absent=False)
        old_daemon = next(entry for entry in self.config["processInventory"] if entry["role"] == "daemon" and entry["expectedPresent"])
        status = self.command(self.cli_argv("status", "--json"), allow_failure=True)
        status_state, row = self.status_row(status, "initial prime-agent status", readiness=False, expected_pid=old_daemon["pid"])
        if status_state != "ready" or row is None:
            raise CutoverError("initial prime-agent status did not report the declared old daemon")
        self.observations["initialStatus"] = row
        self.verify_git()
        self.record("PREFLIGHT_VERIFIED", self.observations)
        return {"schemaVersion": SCHEMA_VERSION, "status": "PREFLIGHT_VERIFIED", "candidateCommit": self.commit, "observations": self.observations}

    def zero_stale_gate(self) -> None:
        self.verify_process_inventory(require_absent=True)
        socket_path = Path(require_string(self.runtime.get("daemonSocket"), "runtime.daemonSocket"))
        if socket_path.exists() or socket_path.is_symlink():
            raise CutoverError(f"stale daemon socket remains: {socket_path}")

    def wait_for_single_runtime(self, started_pid: int) -> dict[str, Any]:
        readiness = self.runtime["readiness"]
        attempts = int(readiness["attempts"])
        interval = float(readiness["intervalSeconds"])
        deadline = time.monotonic() + float(readiness["deadlineSeconds"])
        observations: list[dict[str, Any]] = []
        for attempt in range(1, attempts + 1):
            child_exit = self.runner.child_exit_code(started_pid)
            if child_exit is not None:
                raise CutoverError(f"started Prime Agent child exited before readiness: {child_exit}")
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise CutoverError("Prime Agent readiness deadline expired after exactly one start")
            result = self.command(self.cli_argv("status", "--json"), allow_failure=True, timeout=remaining)
            state, row = self.status_row(result, "readiness prime-agent status", readiness=True, expected_pid=started_pid)
            observations.append({
                "attempt": attempt, "stdoutSha256": hashlib.sha256(result.stdout.encode()).hexdigest(),
                "state": state, "row": row,
            })
            child_exit = self.runner.child_exit_code(started_pid)
            if child_exit is not None:
                raise CutoverError(f"started Prime Agent child exited before readiness: {child_exit}")
            if state == "ready" and row is not None:
                self.observations["readiness"] = observations
                return row
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise CutoverError("Prime Agent readiness deadline expired after exactly one start")
            if attempt == attempts:
                raise CutoverError("Prime Agent readiness observation limit reached before deadline after exactly one start")
            if interval:
                time.sleep(min(interval, remaining))
        raise AssertionError("bounded readiness loop exhausted unexpectedly")

    def execute(self, authorization: str) -> dict[str, Any]:
        if authorization != self.commit or self.operator.get("executeAuthorized") is not True:
            raise CutoverError("exact candidate execution authorization is required")
        self.preflight()
        branch = self.main["branch"]
        remote = self.main["remote"]
        try:
            shutdown_argv = self.cli_argv("shutdown", "--force", "--json")
            self.record("SHUTDOWN_REQUESTED", {"command": list(shutdown_argv)})
            shutdown = self.command(shutdown_argv)
            shutdown_value = require_object(parse_json_output(shutdown, "prime-agent shutdown"), "prime-agent shutdown result")
            if shutdown_value.get("failed") not in (None, []):
                raise CutoverError("prime-agent shutdown reported failures")
            self.zero_stale_gate()
            stopped_status = self.command(self.cli_argv("status", "--json"))
            if parse_json_output(stopped_status, "stopped prime-agent status") != []:
                raise CutoverError("old Prime Agent runtime remains after shutdown")
            self.record("OLD_RUNTIME_STOPPED", {"shutdownResultSha256": hashlib.sha256(shutdown.stdout.encode()).hexdigest()})

            self.record("LANDING_REQUESTED", {"prelandingCommit": self.main["prelandingCommit"], "candidateCommit": self.commit})
            self.command(("git", "merge", "--ff-only", self.commit), cwd=self.primary)
            landed = self.command(("git", "rev-parse", "HEAD"), cwd=self.primary).stdout.strip()
            if landed != self.commit:
                raise CutoverError("local main did not land exact candidate")
            self.command(("git", "push", remote, f"HEAD:{branch}"), cwd=self.primary)
            remote_line = self.command(("git", "ls-remote", remote, f"refs/heads/{branch}"), cwd=self.primary).stdout.strip()
            if not remote_line or remote_line.split()[0] != self.commit:
                raise CutoverError("remote main did not reach exact candidate")
            if self.command(("git", "status", "--porcelain"), cwd=self.primary).stdout:
                raise CutoverError("primary checkout became dirty during landing")
            self.record("CANDIDATE_LANDED", {"commit": self.commit, "tree": self.tree})

            receipt_path = self.checkpoints.root / "live-role-receipt.json"
            self.record("APPLY_REQUESTED", {"roleReceipt": receipt_path.name})
            self.command((str(self.primary / "scripts/apply-prime-agent-plugin.sh"), "--user-global", "--role-receipt", str(receipt_path)), cwd=self.primary)
            self.command((str(self.primary / "scripts/check-prime-agent-plugin.sh"), "--user-global"), cwd=self.primary)
            receipt = require_object(json.loads(receipt_path.read_text()), "live role receipt")
            if receipt.get("transaction") != "applied":
                raise CutoverError("live role receipt is not applied")
            self.record("PLUGIN_APPLIED", {"bundleManifestSha256": self.bundle["manifestSha256"], "roleReceiptSha256": sha256_file(receipt_path)})

            self.zero_stale_gate()
            self.record("START_REQUESTED", {"startArgs": self.runtime["startArgs"], "readiness": self.runtime["readiness"]})
            start = self.runner.start(tuple(self.runtime["startArgs"]), cwd=self.primary)
            if start.returncode:
                raise CutoverError(f"Prime Agent start failed ({start.returncode})")
            start_value = require_object(parse_json_output(start, "Prime Agent start"), "Prime Agent start result")
            started_pid = start_value.get("pid")
            if not isinstance(started_pid, int) or started_pid <= 0:
                raise CutoverError("Prime Agent start did not report a valid child PID")
            status = self.wait_for_single_runtime(started_pid)
            self.record("NEW_RUNTIME_STARTED", {"start": start_value, "status": status, "readiness": self.observations["readiness"]})

            checklist = [
                {"order": index + 1, **entry}
                for index, entry in enumerate(self.config["sessions"])
            ]
            self.record("RESUME_CHECKLIST_EMITTED", {"resumeChecklist": checklist})
            return {"schemaVersion": SCHEMA_VERSION, "status": "RESUME_CHECKLIST_EMITTED", "candidateCommit": self.commit, "resumeChecklist": checklist}
        except BaseException as exc:
            raise CutoverError(f"stopped at {self.last_checkpoint}; recovery: {recovery_for(self.last_checkpoint)}; cause: {exc}") from exc


def load_config(path: Path) -> dict[str, Any]:
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or path.is_symlink():
        raise CutoverError(f"configuration must be a regular non-symlink file: {path}")
    return require_object(json.loads(path.read_text()), "configuration")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--config", type=Path, required=True)
    result.add_argument("--state-dir", type=Path, required=True)
    result.add_argument("--execute", action="store_true")
    result.add_argument("--authorization")
    return result


def main() -> int:
    args = parser().parse_args()
    coordinator: Coordinator | None = None
    try:
        config = load_config(args.config.resolve())
        coordinator = Coordinator(config, args.state_dir)
        output = coordinator.execute(args.authorization or "") if args.execute else coordinator.preflight()
    except (OSError, ValueError, KeyError, json.JSONDecodeError, CutoverError) as exc:
        checkpoint = coordinator.last_checkpoint if coordinator is not None else "INITIAL"
        output = {"schemaVersion": SCHEMA_VERSION, "status": "STOPPED", "checkpoint": checkpoint, "recovery": recovery_for(checkpoint), "error": str(exc)}
        print(json.dumps(output, sort_keys=True))
        return 1
    print(json.dumps(output, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
