#!/usr/bin/env python3
"""Run one external command under a hard process-group deadline."""
from __future__ import annotations

import argparse
import fcntl
import json
from contextlib import ExitStack
from dataclasses import dataclass
import os
import re
import select
import signal
import shutil
import subprocess
import sys
import tempfile
from typing import Any

TIMEOUT_EXIT = 124
_OUTCOMES = {"exited", "signaled", "timed_out", "interrupted", "launch_error", "reap_timeout"}


@dataclass(frozen=True)
class BoundedResult:
    args: list[str]
    returncode: int
    stdout: str | bytes | None
    stderr: str | bytes | None
    outcome: str
    signal: int | None = None

    def __post_init__(self) -> None:
        if self.outcome not in _OUTCOMES:
            raise ValueError("invalid bounded command outcome")


class _ForwardedSignal(BaseException):
    def __init__(self, signum: int) -> None:
        self.signum = signum


def _signal_group(process: subprocess.Popen, sig: signal.Signals) -> None:
    try:
        os.killpg(process.pid, sig)
    except ProcessLookupError:
        pass


def _terminate_group(process: subprocess.Popen, kill_grace: float,
                     reap_grace: float) -> bool:
    """TERM then KILL one owned group; every wait has an explicit budget."""
    _signal_group(process, signal.SIGTERM)
    try:
        process.wait(timeout=kill_grace)
    except subprocess.TimeoutExpired:
        pass
    # The leader can exit while descendants retain work or inherited handles.
    _signal_group(process, signal.SIGKILL)
    if process.poll() is not None:
        return True
    try:
        process.wait(timeout=reap_grace)
        return True
    except subprocess.TimeoutExpired:
        return False


def _read_capture(handle, *, text: bool):
    if handle is None:
        return None
    handle.flush()
    handle.seek(0)
    data = handle.read()
    return data.decode("utf-8", "replace") if text else data


def run_completed(
    argv: list[str], *, timeout: float, kill_grace: float,
    reap_grace: float | None = None, capture_output: bool = False,
    text: bool = False, input: Any = None,
) -> BoundedResult:
    """Run argv with typed outcomes and no pipe-EOF dependency.

    Captured streams use owned regular files. A detached child may retain and
    write its inherited descriptor, but it cannot make controller return wait
    for pipe EOF after the owned process group has been killed.
    """
    if not argv or timeout <= 0 or kill_grace <= 0:
        raise ValueError("argv and positive timeout/grace are required")
    reap_grace = kill_grace if reap_grace is None else reap_grace
    if reap_grace <= 0:
        raise ValueError("positive reap_grace is required")

    with ExitStack() as stack:
        stdout_file = stack.enter_context(tempfile.TemporaryFile()) if capture_output else None
        stderr_file = stack.enter_context(tempfile.TemporaryFile()) if capture_output else None
        stdin_file = None
        if input is not None:
            stdin_file = stack.enter_context(tempfile.TemporaryFile())
            payload = input.encode() if text and isinstance(input, str) else input
            stdin_file.write(payload)
            stdin_file.seek(0)
        watched = tuple(sig for sig in (
            signal.SIGTERM, signal.SIGINT, signal.SIGHUP) if sig is not None)
        previous = {sig: signal.getsignal(sig) for sig in watched}
        sigmask = getattr(signal, "pthread_sigmask", None)
        old_mask = None
        mask_restored = sigmask is None
        handlers_installed = False
        process = None
        handling_signal = False

        def forward(signum, _frame):
            nonlocal handling_signal
            if handling_signal:
                return
            handling_signal = True
            raise _ForwardedSignal(signum)

        try:
            # Close the post-spawn/pre-handler orphan race: pending watched
            # signals cannot be delivered until the process handle exists and
            # the forwarding handlers are installed.
            if sigmask is not None:
                old_mask = sigmask(signal.SIG_BLOCK, watched)
            # Mark first so a partial installation failure still restores every
            # caller handler while watched signals remain blocked.
            handlers_installed = True
            for sig in watched:
                signal.signal(sig, forward)
            executable = argv[0]
            resolved = (executable if os.path.sep in executable
                        else shutil.which(executable))
            if resolved is None or not os.access(resolved, os.X_OK):
                empty = "" if text else b""
                return BoundedResult(argv, 127,
                                     empty if capture_output else None,
                                     empty if capture_output else None,
                                     "launch_error")
            child_argv = argv
            exec_read_fd = None
            exec_write_fd = None
            pass_fds: tuple[int, ...] = ()
            if sigmask is not None:
                # The controller keeps watched signals blocked through Popen,
                # but the exec-replaced group leader must inherit the caller's
                # intended mask. A close-on-exec pipe distinguishes successful
                # target exec from wrapper failure without reopening the orphan
                # window or guessing from exit code 127.
                encoded_mask = ",".join(str(int(sig)) for sig in sorted(
                    old_mask or (), key=int))
                exec_read_fd, exec_write_fd = os.pipe()
                child_argv = [sys.executable, os.path.abspath(__file__),
                              "--_exec-with-mask", encoded_mask,
                              str(exec_write_fd), "--", *argv]
                pass_fds = (exec_write_fd,)
            try:
                process = subprocess.Popen(
                    child_argv, start_new_session=True, stdin=stdin_file,
                    stdout=stdout_file, stderr=stderr_file,
                    pass_fds=pass_fds)
            except OSError:
                empty = "" if text else b""
                return BoundedResult(argv, 127,
                                     empty if capture_output else None,
                                     empty if capture_output else None,
                                     "launch_error")
            finally:
                if exec_write_fd is not None:
                    os.close(exec_write_fd)

            if exec_read_fd is not None:
                ready, _, _ = select.select([exec_read_fd], [], [],
                                            min(timeout, 5.0))
                if not ready:
                    handling_signal = True
                    reaped = _terminate_group(process, kill_grace, reap_grace)
                    os.close(exec_read_fd)
                    empty = "" if text else b""
                    return BoundedResult(
                        argv, TIMEOUT_EXIT,
                        empty if capture_output else None,
                        empty if capture_output else None,
                        "timed_out" if reaped else "reap_timeout")
                launch_error = os.read(exec_read_fd, 64)
                os.close(exec_read_fd)
                if launch_error:
                    process.wait(timeout=reap_grace)
                    empty = "" if text else b""
                    return BoundedResult(argv, 127,
                                         empty if capture_output else None,
                                         empty if capture_output else None,
                                         "launch_error")

            outcome = "exited"
            signum = None
            rc = 1
            try:
                if sigmask is not None:
                    # Mark first: delivery of a pending signal can raise from
                    # this call after the kernel has restored the old mask.
                    mask_restored = True
                    sigmask(signal.SIG_SETMASK, old_mask)
                rc = process.wait(timeout=timeout)
                if rc < 0:
                    signum = -rc
                    outcome = "signaled"
            except subprocess.TimeoutExpired:
                handling_signal = True
                outcome = "timed_out"
                rc = TIMEOUT_EXIT
                if not _terminate_group(process, kill_grace, reap_grace):
                    outcome = "reap_timeout"
            except _ForwardedSignal as exc:
                handling_signal = True
                signum = exc.signum
                outcome = "interrupted"
                rc = 128 + exc.signum
                if not _terminate_group(process, kill_grace, reap_grace):
                    outcome = "reap_timeout"
            except BaseException:
                handling_signal = True
                _terminate_group(process, kill_grace, reap_grace)
                raise
        except BaseException:
            if process is not None and process.poll() is None:
                handling_signal = True
                _terminate_group(process, kill_grace, reap_grace)
            raise
        finally:
            # Make terminal restoration one blocked boundary for every exit
            # path. Signals accepted before this block retain controller
            # semantics; signals arriving after it stay pending until every
            # caller handler is restored. Restoring the exact caller mask then
            # redelivers caller-unblocked pending signals to those handlers and
            # leaves caller-blocked pending signals untouched.
            if sigmask is not None and mask_restored:
                sigmask(signal.SIG_BLOCK, watched)
                mask_restored = False
            restoration_error = None
            try:
                if handlers_installed:
                    for sig, handler in previous.items():
                        try:
                            signal.signal(sig, handler)
                        except BaseException as exc:
                            if restoration_error is None:
                                restoration_error = exc
            finally:
                handlers_installed = False
                if sigmask is not None:
                    mask_restored = True
                    sigmask(signal.SIG_SETMASK, old_mask)
            if restoration_error is not None:
                raise restoration_error

        stdout = _read_capture(stdout_file, text=text)
        stderr = _read_capture(stderr_file, text=text)
        return BoundedResult(argv, rc, stdout, stderr, outcome, signum)


def _write_status(path: str | None, result: BoundedResult) -> None:
    if path is None:
        return
    target = os.path.abspath(path)
    parent = os.path.dirname(target)
    fd, temporary = tempfile.mkstemp(prefix=".bounded-status-", dir=parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump({"outcome": result.outcome,
                       "returncode": result.returncode,
                       "signal": result.signal}, handle,
                      sort_keys=True, separators=(",", ":"))
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, target)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass


def _policy_output(policy: str, result: BoundedResult) -> bytes:
    stdout = result.stdout if isinstance(result.stdout, bytes) else (result.stdout or "").encode()
    stderr = result.stderr if isinstance(result.stderr, bytes) else (result.stderr or "").encode()
    status = {"outcome": result.outcome, "returncode": result.returncode,
              "signal": result.signal}
    if policy == "discard":
        return b""
    if policy == "status":
        return (json.dumps(status, sort_keys=True, separators=(",", ":")) + "\n").encode()
    if policy in ("canonical-json", "image-inspect"):
        try:
            value = json.loads(stdout.decode("utf-8", "strict"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("command output is not canonicalizable JSON") from exc
        if policy == "image-inspect":
            if (not isinstance(value, list) or len(value) != 1
                    or not isinstance(value[0], dict)):
                raise ValueError("image inspection has invalid shape")
            row = value[0]
            value = [{key: row.get(key) for key in
                      ("Id", "Os", "Architecture", "RepoDigests")}]
        return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()
    if policy == "network-list":
        try:
            lines = stdout.decode("utf-8", "strict").splitlines()
        except UnicodeDecodeError as exc:
            raise ValueError("network list has unknown encoding") from exc
        # Docker appends its own newline after the template output. Because the
        # template also terminates each network name, real output has one final
        # empty row. Drop only trailing empty rows; an empty row between names
        # remains invalid and cannot hide malformed output.
        while lines and lines[-1] == "":
            lines.pop()
        if any(not re.fullmatch(r"[A-Za-z0-9_.-]{1,128}", line) for line in lines):
            raise ValueError("network list contains an unsafe name")
        return (("\n".join(lines) + ("\n" if lines else "")).encode())
    if policy == "network-state":
        try:
            value = json.loads(stdout.decode("utf-8", "strict"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("network state is invalid") from exc
        if not isinstance(value, dict):
            raise ValueError("network state is invalid")
        return (b"absent\n" if not value else b"present\n")
    if policy == "container-presence":
        state = "unknown"
        if result.outcome == "exited" and result.returncode == 0:
            state = "present"
        elif result.outcome == "exited" and result.returncode != 0:
            try:
                diagnostic = stderr.decode("utf-8", "strict")
            except UnicodeDecodeError:
                diagnostic = ""
            if re.search(r"no such (?:container|object)", diagnostic,
                         re.IGNORECASE):
                state = "absent"
        status["state"] = state
        return (json.dumps(status, sort_keys=True, separators=(",", ":")) + "\n").encode()
    if policy != "passthrough":
        raise ValueError("unknown output policy")
    return stdout + (b"\0" + stderr if stderr else b"")


def run(argv: list[str], *, timeout: float, kill_grace: float,
        status_file: str | None = None,
        output_policy: str = "passthrough") -> int:
    """Return a conventional rc and optionally publish the typed outcome."""
    result = run_completed(
        argv, timeout=timeout, kill_grace=kill_grace, capture_output=True)
    policy_failed = False
    try:
        filtered = _policy_output(output_policy, result)
    except ValueError:
        policy_failed = True
        filtered = b""
    if output_policy == "passthrough":
        if result.stdout:
            sys.stdout.buffer.write(result.stdout)
        if result.stderr:
            sys.stderr.buffer.write(result.stderr)
        sys.stdout.buffer.flush(); sys.stderr.buffer.flush()
    elif filtered:
        sys.stdout.buffer.write(filtered); sys.stdout.buffer.flush()
    if result.outcome in {"timed_out", "reap_timeout"}:
        print(f"bounded command timed out after {timeout:g}s", file=sys.stderr)
    _write_status(status_file, result)
    if policy_failed:
        return 65
    if result.outcome == "signaled" and result.signal is not None:
        return 128 + result.signal
    return result.returncode


def _exec_with_mask(raw_mask: str, status_fd: int,
                    argv: list[str]) -> int:
    if not argv:
        return 127
    sigmask = getattr(signal, "pthread_sigmask", None)
    if sigmask is None:
        return 127
    try:
        # The parent observes EOF only after a successful exec. Any wrapper or
        # target-exec failure writes a byte and remains typed as launch_error.
        flags = fcntl.fcntl(status_fd, fcntl.F_GETFD)
        fcntl.fcntl(status_fd, fcntl.F_SETFD, flags | fcntl.FD_CLOEXEC)
        intended = {signal.Signals(int(value)) for value in raw_mask.split(",")
                    if value}
        sigmask(signal.SIG_SETMASK, intended)
        os.execvp(argv[0], argv)
    except (OSError, ValueError):
        try:
            os.write(status_fd, b"E")
        except OSError:
            pass
        return 127
    return 127


def main(argv: list[str] | None = None) -> int:
    raw_argv = list(sys.argv[1:] if argv is None else argv)
    if raw_argv[:1] == ["--_exec-with-mask"]:
        if len(raw_argv) < 5 or raw_argv[3] != "--":
            return 127
        try:
            status_fd = int(raw_argv[2])
        except ValueError:
            return 127
        return _exec_with_mask(raw_argv[1], status_fd, raw_argv[4:])
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeout", required=True, type=float)
    parser.add_argument("--kill-grace", required=True, type=float)
    parser.add_argument("--status-file")
    parser.add_argument("--output-policy", default="passthrough",
                        choices=("passthrough", "discard", "status",
                                 "canonical-json", "image-inspect", "network-list",
                                 "network-state", "container-presence"))
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args(raw_argv)
    command = args.command
    if command and command[0] == "--":
        command = command[1:]
    if not command or args.timeout <= 0 or args.kill_grace <= 0:
        parser.error("positive timeout/grace and a command are required")
    return run(command, timeout=args.timeout, kill_grace=args.kill_grace,
               status_file=args.status_file, output_policy=args.output_policy)


if __name__ == "__main__":
    raise SystemExit(main())
