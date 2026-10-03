#!/usr/bin/env python3
"""Run one external command under a hard process-group deadline."""
from __future__ import annotations

import argparse
from contextlib import ExitStack
from dataclasses import dataclass
import os
import signal
import subprocess
import sys
import tempfile
from typing import Any

TIMEOUT_EXIT = 124
_OUTCOMES = {"exited", "timed_out", "interrupted", "launch_error", "reap_timeout"}


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
    return data.decode("utf-8", "strict") if text else data


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
            for sig in watched:
                signal.signal(sig, forward)
            handlers_installed = True
            try:
                process = subprocess.Popen(
                    argv, start_new_session=True, stdin=stdin_file,
                    stdout=stdout_file, stderr=stderr_file)
            except OSError:
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
            # When setup failed before unmasking, restore original handlers
            # while watched signals remain blocked, then restore the mask.
            if not mask_restored and sigmask is not None:
                for sig, handler in previous.items():
                    signal.signal(sig, handler)
                handlers_installed = False
                mask_restored = True
                sigmask(signal.SIG_SETMASK, old_mask)
            if handlers_installed:
                for sig, handler in previous.items():
                    signal.signal(sig, handler)

        stdout = _read_capture(stdout_file, text=text)
        stderr = _read_capture(stderr_file, text=text)
        return BoundedResult(argv, rc, stdout, stderr, outcome, signum)


def run(argv: list[str], *, timeout: float, kill_grace: float) -> int:
    """Return command rc, 124 on timeout, or 128+signal on interruption."""
    result = run_completed(
        argv, timeout=timeout, kill_grace=kill_grace, capture_output=True)
    if result.stdout:
        sys.stdout.buffer.write(result.stdout)
        sys.stdout.buffer.flush()
    if result.stderr:
        sys.stderr.buffer.write(result.stderr)
        sys.stderr.buffer.flush()
    if result.outcome in {"timed_out", "reap_timeout"}:
        print(f"bounded command timed out after {timeout:g}s", file=sys.stderr)
    return result.returncode


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeout", required=True, type=float)
    parser.add_argument("--kill-grace", required=True, type=float)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)
    command = args.command
    if command and command[0] == "--":
        command = command[1:]
    if not command or args.timeout <= 0 or args.kill_grace <= 0:
        parser.error("positive timeout/grace and a command are required")
    return run(command, timeout=args.timeout, kill_grace=args.kill_grace)


if __name__ == "__main__":
    raise SystemExit(main())
