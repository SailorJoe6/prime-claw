#!/usr/bin/env python3
"""Run one external command under a hard process-group deadline."""
from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
from typing import Any

TIMEOUT_EXIT = 124


class _ForwardedSignal(BaseException):
    def __init__(self, signum: int) -> None:
        self.signum = signum


def _signal_group(process: subprocess.Popen, sig: signal.Signals) -> None:
    try:
        os.killpg(process.pid, sig)
    except ProcessLookupError:
        pass


def _terminate_group(process: subprocess.Popen, kill_grace: float) -> None:
    """TERM, wait only the grace budget, then always KILL the whole group."""
    _signal_group(process, signal.SIGTERM)
    try:
        process.wait(timeout=kill_grace)
    except subprocess.TimeoutExpired:
        pass
    # The group leader can exit on TERM while descendants remain. Always send
    # KILL to the original process group after the grace budget/leader exit.
    _signal_group(process, signal.SIGKILL)
    if process.poll() is None:
        process.wait()


def run_completed(
    argv: list[str], *, timeout: float, kill_grace: float,
    capture_output: bool = False, text: bool = False,
    input: Any = None,
) -> subprocess.CompletedProcess:
    """Run argv with deadline and interruption-safe process-group teardown."""
    if not argv or timeout <= 0 or kill_grace <= 0:
        raise ValueError("argv and positive timeout/grace are required")
    kwargs: dict[str, Any] = {"start_new_session": True, "text": text}
    if capture_output:
        kwargs.update(stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if input is not None:
        kwargs["stdin"] = subprocess.PIPE
    process = subprocess.Popen(argv, **kwargs)
    watched = tuple(
        sig for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP)
        if sig is not None
    )
    previous = {sig: signal.getsignal(sig) for sig in watched}
    handling_signal = False

    def forward(signum, _frame):
        nonlocal handling_signal
        if handling_signal:
            return
        handling_signal = True
        raise _ForwardedSignal(signum)

    for sig in watched:
        signal.signal(sig, forward)
    try:
        stdout, stderr = process.communicate(input=input, timeout=timeout)
        return subprocess.CompletedProcess(
            argv, process.returncode, stdout, stderr)
    except subprocess.TimeoutExpired:
        handling_signal = True
        _terminate_group(process, kill_grace)
        stdout, stderr = process.communicate()
        return subprocess.CompletedProcess(
            argv, TIMEOUT_EXIT, stdout, stderr)
    except _ForwardedSignal as exc:
        handling_signal = True
        _terminate_group(process, kill_grace)
        stdout, stderr = process.communicate()
        return subprocess.CompletedProcess(
            argv, 128 + exc.signum, stdout, stderr)
    except BaseException:
        handling_signal = True
        _terminate_group(process, kill_grace)
        raise
    finally:
        for sig, handler in previous.items():
            signal.signal(sig, handler)


def run(argv: list[str], *, timeout: float, kill_grace: float) -> int:
    """Return command rc, 124 on timeout, or 128+signal on interruption."""
    try:
        result = run_completed(argv, timeout=timeout, kill_grace=kill_grace)
    except FileNotFoundError:
        return 127
    if result.returncode == TIMEOUT_EXIT:
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
