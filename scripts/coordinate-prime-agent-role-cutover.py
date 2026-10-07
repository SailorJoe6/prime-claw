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


class CutoverError(RuntimeError):
    pass


@dataclass(frozen=True)
class Result:
    argv: tuple[str, ...]
    returncode: int
    stdout: str = ""
    stderr: str = ""


class LocalRunner:
    def run(self, argv: Sequence[str], *, cwd: Path | None = None, allow_failure: bool = False) -> Result:
        completed = subprocess.run(list(argv), cwd=cwd, text=True, capture_output=True, check=False)
        result = Result(tuple(argv), completed.returncode, completed.stdout, completed.stderr)
        if result.returncode and not allow_failure:
            raise CutoverError(f"command failed ({result.returncode}): {' '.join(argv)}")
        return result

    def start(self, argv: Sequence[str], *, cwd: Path | None = None) -> Result:
        process = subprocess.Popen(
            list(argv), cwd=cwd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL, start_new_session=True,
        )
        return Result(tuple(argv), 0, json.dumps({"pid": process.pid}) + "\n", "")


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
    for raw in text.splitlines():
        fields = raw.strip().split(None, 2)
        if len(fields) == 3 and fields[0].isdigit() and fields[1].isdigit():
            rows.append({"pid": int(fields[0]), "ppid": int(fields[1]), "command": fields[2]})
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

    def command(self, argv: Sequence[str], *, cwd: Path | None = None, allow_failure: bool = False) -> Result:
        return self.runner.run(tuple(str(item) for item in argv), cwd=cwd, allow_failure=allow_failure)

    def record(self, checkpoint: str, evidence: dict[str, Any] | None = None) -> None:
        self.checkpoints.write(checkpoint, evidence)
        self.last_checkpoint = checkpoint

    def validate_static(self) -> None:
        if self.config.get("schemaVersion") != SCHEMA_VERSION:
            raise CutoverError("unsupported coordinator schema")
        require_string(self.config.get("operationId"), "operationId")
        rollback = require_object(self.config.get("rollbackRecipe"), "rollbackRecipe")
        argv = rollback.get("argv")
        if not isinstance(argv, list) or not argv or argv[0:2] != ["git", "revert"] or any(value in argv for value in ("reset", "rebase", "--force")):
            raise CutoverError("rollbackRecipe.argv must be an explicit history-preserving git revert")
        if not self.primary.is_dir() or self.primary.is_symlink():
            raise CutoverError(f"primary checkout must be a real directory: {self.primary}")
        for key in ("clientsExited", "foreignOwnersCheckpointed", "bundleVerified", "isolatedRestoreVerified"):
            if self.operator.get(key) is not True:
                raise CutoverError(f"operator confirmation is required: {key}")
        inventory = self.config.get("processInventory")
        if not isinstance(inventory, list) or not inventory:
            raise CutoverError("processInventory must be a non-empty list")
        seen: set[int] = set()
        for index, item_value in enumerate(inventory):
            item = require_object(item_value, f"processInventory[{index}]")
            pid = item.get("pid")
            if not isinstance(pid, int) or pid <= 0 or pid in seen:
                raise CutoverError("process inventory PIDs must be unique positive integers")
            seen.add(pid)
            for key in ("kind", "executableRealpath", "version", "buildId", "daemonSocket"):
                require_string(item.get(key), f"processInventory[{index}].{key}")
            if item.get("resident") is True or item.get("acknowledgedExit") is not True:
                raise CutoverError("every resident client/launcher must be exited and acknowledged")
        sessions = self.config.get("sessions")
        if not isinstance(sessions, list) or [entry.get("role") for entry in sessions if isinstance(entry, dict)] != ["owner", "episode", "ordinary"]:
            raise CutoverError("sessions must be ordered owner, episode, ordinary")
        for entry in sessions:
            for key in ("sessionId", "name", "cwd", "checkpoint"):
                require_string(entry.get(key), f"sessions.{entry.get('role')}.{key}")
        if sessions[2].get("baselineTurn") is not True:
            raise CutoverError("ordinary saved conversation requires a successful baseline turn")
        start_args = self.runtime.get("startArgs")
        if not isinstance(start_args, list) or not start_args or start_args[0] != str(self.executable):
            raise CutoverError("runtime.startArgs must begin with the recorded executable realpath")
        if "--mode" not in start_args or "daemon" not in start_args:
            raise CutoverError("runtime.startArgs must start daemon mode")

    def verify_bundle(self) -> None:
        bundle_path = Path(require_string(self.bundle.get("path"), "bundle.path")).resolve()
        expected = require_string(self.bundle.get("manifestSha256"), "bundle.manifestSha256")
        bundle_tool = Path(__file__).resolve().with_name("manage-prime-agent-cutover-bundle.py")
        result = self.command((str(bundle_tool), "verify", "--bundle", str(bundle_path)))
        value = require_object(parse_json_output(result, "bundle verifier"), "bundle verifier result")
        if value.get("status") != "VERIFIED" or value.get("manifestSha256") != expected:
            raise CutoverError("private preactivation bundle verification mismatch")
        self.observations["bundleManifestSha256"] = expected

    def verify_process_inventory(self, *, require_absent: bool) -> None:
        result = self.command(("ps", "-axo", "pid=,ppid=,command="))
        rows = process_rows(result.stdout)
        declared = {entry["pid"]: entry for entry in self.config["processInventory"]}
        def looks_like_runtime(row: dict[str, Any]) -> bool:
            try:
                first = Path(shlex.split(row["command"])[0]).name
            except (ValueError, IndexError):
                return False
            return first == "prime-agent" or first.startswith("prime-agent-")
        relevant = [row for row in rows if row["pid"] in declared or looks_like_runtime(row)]
        undeclared = [row for row in relevant if row["pid"] not in declared]
        if undeclared:
            raise CutoverError(f"undeclared Prime Agent processes remain: {[row['pid'] for row in undeclared]}")
        for row in relevant:
            recorded = declared[row["pid"]]
            executable = recorded["executableRealpath"]
            if Path(shlex.split(row["command"])[0]).resolve() != Path(executable).resolve():
                raise CutoverError(f"process inventory executable mismatch for PID {row['pid']}")
        if require_absent and relevant:
            raise CutoverError(f"stale Prime Agent processes remain: {[row['pid'] for row in relevant]}")
        self.observations["processes"] = relevant

    def verify_executable(self) -> None:
        actual = Path(os.path.realpath(self.executable))
        if actual != self.executable:
            raise CutoverError("runtime executable is not its own realpath")
        result = self.command((str(self.executable), "--version"))
        expected = require_string(self.runtime.get("version"), "runtime.version")
        if result.stdout.strip() != expected:
            raise CutoverError("runtime executable version mismatch")
        expected_build = require_string(self.runtime.get("buildId"), "runtime.buildId")
        for index, entry in enumerate(self.config["processInventory"]):
            for key in ("executableRealpath", "version", "buildId"):
                require_string(entry.get(key), f"processInventory[{index}].{key}")
        self.observations["runtime"] = {"executableRealpath": str(self.executable), "version": expected, "buildId": expected_build}

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
        self.observations["git"] = {"prelandingCommit": before, "remoteCommit": remote_head, "candidateCommit": self.commit, "candidateTree": self.tree}

    def preflight(self) -> dict[str, Any]:
        self.validate_static()
        self.verify_bundle()
        self.verify_executable()
        self.verify_process_inventory(require_absent=False)
        self.verify_git()
        status = self.command((str(self.executable), "status", "--json"), allow_failure=True)
        self.observations["initialStatus"] = {"returncode": status.returncode, "stdoutSha256": hashlib.sha256(status.stdout.encode()).hexdigest()}
        self.record("PREFLIGHT_VERIFIED", self.observations)
        return {"schemaVersion": SCHEMA_VERSION, "status": "PREFLIGHT_VERIFIED", "candidateCommit": self.commit, "observations": self.observations}

    def zero_stale_gate(self) -> None:
        self.verify_process_inventory(require_absent=True)
        socket_path = Path(require_string(self.runtime.get("daemonSocket"), "runtime.daemonSocket"))
        if socket_path.exists() or socket_path.is_symlink():
            raise CutoverError(f"stale daemon socket remains: {socket_path}")

    def verify_single_runtime(self) -> dict[str, Any]:
        result = self.command((str(self.executable), "status", "--json"))
        value = parse_json_output(result, "prime-agent status")
        if not isinstance(value, list) or len(value) != 1 or not isinstance(value[0], dict):
            raise CutoverError("single-runtime status must contain exactly one daemon row")
        row = value[0]
        expected = {
            "socketPath": self.runtime["daemonSocket"],
            "version": self.runtime["version"],
            "buildId": self.runtime["buildId"],
            "executablePath": str(self.executable),
            "status": "current",
        }
        for key, wanted in expected.items():
            if row.get(key) != wanted:
                raise CutoverError(f"single-runtime status mismatch: {key}")
        if not isinstance(row.get("pid"), int) or row["pid"] <= 0:
            raise CutoverError("single-runtime status has no valid PID")
        return row

    def execute(self, authorization: str) -> dict[str, Any]:
        if authorization != self.commit or self.operator.get("executeAuthorized") is not True:
            raise CutoverError("exact candidate execution authorization is required")
        self.preflight()
        branch = self.main["branch"]
        remote = self.main["remote"]
        try:
            self.record("SHUTDOWN_REQUESTED", {"command": [str(self.executable), "shutdown", "--force", "--json"]})
            shutdown = self.command((str(self.executable), "shutdown", "--force", "--json"))
            shutdown_value = require_object(parse_json_output(shutdown, "prime-agent shutdown"), "prime-agent shutdown result")
            if shutdown_value.get("failed") not in (None, []):
                raise CutoverError("prime-agent shutdown reported failures")
            self.zero_stale_gate()
            stopped_status = self.command((str(self.executable), "status", "--json"))
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
            self.record("START_REQUESTED", {"startArgs": self.runtime["startArgs"]})
            start = self.runner.start(tuple(self.runtime["startArgs"]), cwd=self.primary)
            status = self.verify_single_runtime()
            self.record("NEW_RUNTIME_STARTED", {"start": json.loads(start.stdout), "status": status})

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
