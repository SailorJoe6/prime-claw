"""Python-only guard tests. No installed Prime Agent binary or daemon is invoked."""

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import stat
import sys
import tempfile
import unittest
from unittest import mock
from types import SimpleNamespace

REPO = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO / "scripts" / "validate-prime-agent-scratch-smoke.py"
SPEC = importlib.util.spec_from_file_location("prime_claw_scratch_smoke", MODULE_PATH)
assert SPEC and SPEC.loader
smoke = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = smoke
SPEC.loader.exec_module(smoke)


class FakeRunner:
    def __init__(self, cli, observations, start=None, stop=None, pid_values=None):
        self.cli = cli
        self.observations = list(observations)
        self.start = start or smoke.CommandResult(0)
        self.stop = stop or smoke.CommandResult(0, '{"stopped": [], "failed": []}')
        self.pid_values = dict(pid_values or {})
        self.commands = []
        self.quiet_calls = 0

    def command(self, argv, timeout):
        self.commands.append((tuple(argv), timeout))
        if argv[:3] == [str(self.cli), "daemon", "start"]:
            return self.start
        if argv == [str(self.cli), "shutdown", "--force", "--json"]:
            return self.stop
        raise AssertionError("unexpected command: " + repr(argv))

    def observe(self, root, cli):
        if not self.observations:
            raise AssertionError("unexpected extra observation")
        return self.observations.pop(0)

    def pid_start(self, pid):
        return self.pid_values.get(pid)

    def quiet_interval(self):
        self.quiet_calls += 1


class FakeOSNativeRunner(smoke.NativeRunner):
    """Inject exact CLI/lsof/ps output; never execute an OS command."""

    def __init__(self, cli, results):
        self.cli = cli
        self.lsof = Path("/usr/sbin/lsof")
        self.ps = Path("/bin/ps")
        self.results = list(results)
        self.commands = []

    def command(self, argv, timeout):
        self.commands.append(tuple(argv))
        if not self.results:
            raise AssertionError("unexpected OS/CLI call: " + repr(argv))
        expected, outcome = self.results.pop(0)
        if tuple(argv) != tuple(expected):
            raise AssertionError(f"expected {expected!r}, got {argv!r}")
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome


class ScratchSmokeTests(unittest.TestCase):
    def setUp(self):
        # These are owned Python-only fixtures; no native process/socket exists.
        self.root = Path(tempfile.mkdtemp(prefix="pcp.", dir="/tmp")).resolve()
        self.addCleanup(shutil.rmtree, self.root)
        for name in ("home", "tmp", "config", "sessions"):
            (self.root / name).mkdir(mode=0o700)
        self.cli_parent = Path(tempfile.mkdtemp(prefix="prime-claw-fake-cli-", dir="/tmp")).resolve()
        self.addCleanup(shutil.rmtree, self.cli_parent)
        self.cli = self.cli_parent / "prime-agent"
        self.cli.write_text("#!/bin/sh\nexit 99\n")
        self.cli.chmod(0o700)
        self.sha = hashlib.sha256(self.cli.read_bytes()).hexdigest()
        self.env = {"PATH": smoke.SYSTEM_PATH, "LANG": "C", "PRIME_CLAW_PROBE_ROOT": str(self.root),
                    "HOME": str(self.root / "home"), "TMPDIR": str(self.root / "tmp"),
                    "PRIME_AGENT_CODING_AGENT_DIR": str(self.root / "config"),
                    "PRIME_AGENT_SESSION_DIR": str(self.root / "sessions")}
        self.socket = self.root / "tmp" / f"prime-agent-{os.getuid()}" / "daemon.sock"

    def run_fake(self, observations, *, start=None, stop=None, pid_values=None, run_native=True):
        runner = FakeRunner(self.cli, observations, start=start, stop=stop, pid_values=pid_values)
        result = smoke.smoke(self.env, self.cli, self.sha, runner, run_native=run_native)
        self.assertTrue(self.root.exists())
        self.assertEqual(json.loads((self.root / "scratch-smoke-report.json").read_text())["status"], result["status"])
        return result, runner

    def active(self):
        return smoke.Observation(daemons=[{"socketPath": str(self.socket), "pid": 123, "status": "current"}],
                                 root_refs=[{"pid": 123, "path": str(self.socket)}], pid_starts={123: "T0"})

    def good_start(self):
        return smoke.CommandResult(0, f"Daemon started on {self.socket} (pid 123)\n")

    def test_clean_owned_smoke_stops_once_and_retains_root(self):
        result, runner = self.run_fake([smoke.Observation(), self.active(), smoke.Observation(), smoke.Observation()],
                                       start=self.good_start(), pid_values={123: None})
        self.assertEqual(result["status"], "stopped")
        self.assertEqual([command[0][1:3] for command in runner.commands], [("daemon", "start"), ("shutdown", "--force")])
        self.assertEqual(runner.quiet_calls, 1)
        self.assertEqual((self.root / "project").stat().st_mode & 0o777, 0o700)
        self.assertNotIn("authenticationToken", (self.root / "scratch-smoke-report.json").read_text())

    def test_dry_preflight_never_starts_or_shuts_down(self):
        result, runner = self.run_fake([smoke.Observation()], run_native=False)
        self.assertEqual(result["status"], "preflight_ready")
        self.assertEqual(runner.commands, [])
        self.assertFalse((self.root / "project").exists())

    def test_occupied_or_failed_baseline_does_not_start_or_shut_down(self):
        for baseline in (smoke.Observation(root_refs=[{"pid": 999, "path": str(self.socket)}]),
                         smoke.Observation(valid=False, reason="lsof failed")):
            with self.subTest(baseline=baseline.reason or "occupied"):
                # Separate private root per iteration because report creation is deliberately one-shot.
                if (self.root / "scratch-smoke-report.json").exists():
                    (self.root / "scratch-smoke-report.json").unlink()
                result, runner = self.run_fake([baseline])
                self.assertEqual(result["status"], "blocked_preflight")
                self.assertEqual(runner.commands, [])

    def test_start_timeout_still_attempts_one_scoped_shutdown_but_is_unresolved(self):
        result, runner = self.run_fake([smoke.Observation(), smoke.Observation(), smoke.Observation(), smoke.Observation()],
                                       start=smoke.CommandResult(None, timed_out=True))
        self.assertEqual(result["status"], "unresolved")
        self.assertEqual(len(runner.commands), 2)
        self.assertEqual(runner.commands[-1][0][1:], ("shutdown", "--force", "--json"))

    def test_competing_daemon_revokes_shutdown_authority(self):
        result, runner = self.run_fake([smoke.Observation()],
                                       start=smoke.CommandResult(0, f"Daemon already running on {self.socket}\n"))
        self.assertEqual(result["status"], "unresolved_ownership")
        self.assertEqual(len(runner.commands), 1)
        self.assertEqual(runner.quiet_calls, 0)

    def test_unexpected_second_owner_or_worker_revokes_shutdown_authority(self):
        extra_socket = self.root / "tmp" / "other.sock"
        second_owner = self.active()
        second_owner.daemons.append({"socketPath": str(extra_socket), "pid": 456, "status": "current"})
        second_owner.pid_starts[456] = "T1"
        worker = self.active()
        worker.descriptors.append({"pid": 456, "socketPath": str(extra_socket)})
        for active in (second_owner, worker):
            with self.subTest(active=active):
                if (self.root / "scratch-smoke-report.json").exists():
                    (self.root / "scratch-smoke-report.json").unlink()
                if (self.root / "project").exists():
                    (self.root / "project").rmdir()
                result, runner = self.run_fake([smoke.Observation(), active], start=self.good_start())
                self.assertEqual(result["status"], "unresolved_ownership")
                self.assertEqual(len(runner.commands), 1)
                self.assertEqual(runner.quiet_calls, 0)

    def test_failed_shutdown_remains_unresolved_despite_empty_scans(self):
        cases = (smoke.CommandResult(1, '{"stopped": [], "failed": []}'),
                 smoke.CommandResult(0, "not-json"),
                 smoke.CommandResult(0, '{"stopped": [], "failed": [{"reason":"x"}]}'),
                 smoke.CommandResult(None, timed_out=True),
                 smoke.CommandResult(0, '{"stopped": [{"socketPath":"/outside/daemon.sock","action":"x"}],"failed":[]}'))
        for case in cases:
            with self.subTest(case=case.record()):
                if (self.root / "scratch-smoke-report.json").exists():
                    (self.root / "scratch-smoke-report.json").unlink()
                if (self.root / "project").exists():
                    (self.root / "project").rmdir()
                result, runner = self.run_fake([smoke.Observation(), self.active(), smoke.Observation(), smoke.Observation()],
                                               start=self.good_start(), stop=case, pid_values={123: None})
                self.assertEqual(result["status"], "unresolved")
                self.assertEqual(len(runner.commands), 2)

    def test_lsof_ref_or_captured_pid_blocks_stopped(self):
        for post, pid_values in ((smoke.Observation(root_refs=[{"pid": 7, "path": str(self.socket)}]), {123: None}),
                                 (smoke.Observation(), {123: "T0"}),
                                 (smoke.Observation(), {123: "T1"})):
            with self.subTest(post=post, pid_values=pid_values):
                if (self.root / "scratch-smoke-report.json").exists():
                    (self.root / "scratch-smoke-report.json").unlink()
                if (self.root / "project").exists():
                    (self.root / "project").rmdir()
                result, _ = self.run_fake([smoke.Observation(), self.active(), post, smoke.Observation()],
                                          start=self.good_start(), pid_values=pid_values)
                self.assertEqual(result["status"], "unresolved")

    def test_root_and_reported_path_guards(self):
        self.env["OPENAI_API_KEY"] = "do-not-log"
        with self.assertRaises(smoke.UnsafeScratch):
            smoke.validate_root(self.env, self.cli, self.sha)
        self.env.pop("OPENAI_API_KEY")
        self.env["PRIME_AGENT_DAEMON_SUPERVISOR_REGISTRY_DIR"] = "/outside"
        with self.assertRaises(smoke.UnsafeScratch):
            smoke.validate_root(self.env, self.cli, self.sha)
        self.env.pop("PRIME_AGENT_DAEMON_SUPERVISOR_REGISTRY_DIR")
        self.env["PATH"] = "/opt/homebrew/bin:" + smoke.SYSTEM_PATH
        with self.assertRaises(smoke.UnsafeScratch):
            smoke.validate_root(self.env, self.cli, self.sha)
        self.env["PATH"] = smoke.SYSTEM_PATH
        with self.assertRaises(smoke.UnsafeScratch):
            smoke.parse_daemon_ps(smoke.CommandResult(0, '[{"socketPath":"'+str(self.root)+'/../other.sock","status":"current"}]'), self.root)
        with self.assertRaises(smoke.UnsafeScratch):
            smoke.parse_shutdown(smoke.CommandResult(0, '{"stopped":[{"socketPath":"/outside/daemon.sock","action":"x"}],"failed":[]}'), self.root)
        self.assertEqual(smoke.parse_lsof(f"p123\nn{self.socket}\n", self.root),
                         [{"pid": 123, "path": str(self.socket)}])
        for bad in (f"n{self.socket}\n", "pnope\n", f"p123\nn{self.root}/../outside.sock\n",
                    f"p123\nnunix 0x0 {self.socket}\n"):
            with self.subTest(bad=bad):
                with self.assertRaises(smoke.UnsafeScratch):
                    smoke.parse_lsof(bad, self.root)

    def os_results(self, *, ps=None, files=None, unix=None, pid=None):
        return [
            ((str(self.cli), "daemon", "ps", "--json"), ps or smoke.CommandResult(0, "[]")),
            (("/usr/sbin/lsof", "-nP", "-F", "pn", "+D", str(self.root)), files or smoke.CommandResult(1)),
            (("/usr/sbin/lsof", "-nP", "-F", "pn", "-U"), unix or smoke.CommandResult(1)),
            *([(("/bin/ps", "-p", "123", "-o", "lstart="), pid)] if pid is not None else []),
        ]

    def test_native_command_uses_one_cli_and_exact_isolated_env_without_execution(self):
        if sys.platform != "darwin":
            self.skipTest("macOS-only native driver")
        runner = smoke.NativeRunner(self.env, self.cli, self.root)
        commands = ([str(self.cli), "daemon", "ps", "--json"],
                    [str(self.cli), "daemon", "start", "--offline"],
                    [str(self.cli), "shutdown", "--force", "--json"],
                    [str(runner.lsof), "-nP", "-F", "pn", "-U"],
                    [str(runner.ps), "-p", "123", "-o", "lstart="])
        with mock.patch.object(smoke.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout="", stderr="")) as patched:
            for args in commands:
                self.assertEqual(runner.command(args, 12).returncode, 0)
        self.assertEqual(patched.call_count, len(commands))
        for invocation, expected in zip(patched.call_args_list, commands):
            self.assertEqual(invocation.args[0], expected)
            self.assertEqual(invocation.kwargs["cwd"], self.root)
            self.assertEqual(invocation.kwargs["env"], {**self.env, "LC_ALL": "C", "TZ": "UTC"})
            self.assertTrue(invocation.kwargs["capture_output"])
            self.assertFalse(invocation.kwargs["check"])
        with self.assertRaises(smoke.UnsafeScratch):
            runner.command(["/opt/homebrew/bin/lsof", "-U"], 12)

    def test_native_os_scan_is_injected_and_fails_closed_on_cli_or_lsof_errors(self):
        cases = (
            ("empty", self.os_results(), True),
            ("invalid-json", self.os_results(ps=smoke.CommandResult(0, "{")), False),
            ("cli-timeout", self.os_results(ps=smoke.CommandResult(None, timed_out=True)), False),
            ("lsof-stderr", self.os_results(files=smoke.CommandResult(1, stderr="scan failed")), False),
            ("lsof-escape", self.os_results(files=smoke.CommandResult(0, f"p123\nn{self.root}/../outside.sock\n")), False),
            ("lsof-malformed", self.os_results(files=smoke.CommandResult(0, f"n{self.socket}\n")), False),
            ("ps-missing-id", self.os_results(files=smoke.CommandResult(0, f"p123\nn{self.socket}\n"),
                                                unix=smoke.CommandResult(0, f"p123\nn{self.socket}\n"),
                                                pid=smoke.CommandResult(0, "")), False),
        )
        for label, results, expected_valid in cases:
            with self.subTest(label=label):
                runner = FakeOSNativeRunner(self.cli, results)
                observation = runner.observe(self.root, self.cli)
                self.assertEqual(observation.valid, expected_valid)
                if label == "empty":
                    self.assertTrue(smoke.baseline_empty(observation))
                self.assertEqual(runner.results, []) if expected_valid or label == "ps-missing-id" else None

    def test_native_lsof_pid_and_descriptor_redaction_without_native_commands(self):
        descriptor_dir = self.root / "config" / "daemon-workers"
        descriptor_dir.mkdir()
        descriptor_path = descriptor_dir / "worker.json"
        secret = "do-not-emit-descriptor-token"
        descriptor_path.write_text(json.dumps({"version": 2, "pid": 123, "processStartId": "source-start",
                                               "socketPath": str(self.root / "tmp" / "worker.sock"),
                                               "supervisorSocketPath": str(self.socket),
                                               "authenticationToken": secret}))
        root_ref = smoke.CommandResult(0, f"p123\nn{descriptor_path}\n")
        unix_ref = smoke.CommandResult(0, f"p123\nn{self.socket}\n")
        runner = FakeOSNativeRunner(self.cli, self.os_results(files=root_ref, unix=unix_ref,
                            pid=smoke.CommandResult(0, "Fri Jan  1 00:00:00 2027\n")))
        observation = runner.observe(self.root, self.cli)
        self.assertTrue(observation.valid, observation.reason)
        self.assertFalse(smoke.baseline_empty(observation))
        self.assertEqual(observation.pid_starts, {123: "Fri Jan  1 00:00:00 2027"})
        self.assertEqual(len(observation.descriptors), 1)
        self.assertNotIn(secret, json.dumps(observation.record()))
        self.assertEqual(runner.results, [])
        descriptor_path.write_text("{invalid-json " + secret)
        malformed = FakeOSNativeRunner(self.cli, self.os_results())
        malformed_observation = malformed.observe(self.root, self.cli)
        self.assertFalse(malformed_observation.valid)
        self.assertNotIn(secret, json.dumps(malformed_observation.record()))
        descriptor_path.unlink()
        (descriptor_dir / "outbound").symlink_to(self.cli)
        symlinked = FakeOSNativeRunner(self.cli, self.os_results())
        self.assertFalse(symlinked.observe(self.root, self.cli).valid)

    def test_unexpected_observation_exception_never_admits_start(self):
        class BrokenRunner(FakeRunner):
            def observe(self, root, cli):
                raise RuntimeError("unexpected")
        runner = BrokenRunner(self.cli, [])
        result = smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertEqual(result["status"], "blocked_preflight")
        self.assertEqual(runner.commands, [])

    def test_unexpected_error_after_owned_start_attempt_still_shuts_down_once(self):
        class BrokenStart(FakeRunner):
            def command(self, argv, timeout):
                if argv[:3] == [str(self.cli), "daemon", "start"]:
                    self.commands.append((tuple(argv), timeout))
                    raise RuntimeError("secret-should-not-be-logged")
                return super().command(argv, timeout)
        runner = BrokenStart(self.cli, [smoke.Observation(), smoke.Observation(),
                                         smoke.Observation(), smoke.Observation()])
        result = smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertEqual(result["status"], "unresolved")
        self.assertEqual(len(runner.commands), 2)
        self.assertEqual(runner.commands[-1][0][1:], ("shutdown", "--force", "--json"))
        self.assertNotIn("secret-should-not-be-logged", (self.root / "scratch-smoke-report.json").read_text())

    def test_active_observation_exception_and_quiet_failure_remain_unresolved(self):
        class BrokenActive(FakeRunner):
            observed = 0
            def observe(self, root, cli):
                self.observed += 1
                if self.observed == 2:
                    raise RuntimeError("active scan failed")
                return super().observe(root, cli)
            def quiet_interval(self):
                raise RuntimeError("interval failed")
        runner = BrokenActive(self.cli, [smoke.Observation(), smoke.Observation(), smoke.Observation()],
                              start=self.good_start())
        result = smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertEqual(result["status"], "unresolved")
        self.assertEqual(len(runner.commands), 2)
        self.assertEqual(len(result["postflight"]), 2)
        self.assertTrue(any("quiet interval failed" in reason for reason in result["reasons"]))

    def test_registry_file_blocks_quiet_and_baseline(self):
        registry = self.root / "home" / ".prime" / "supervisor-owners"
        registry.mkdir(parents=True)
        (registry / "unexpected.owner").write_text("metadata-only-fixture")
        runner = FakeOSNativeRunner(self.cli, self.os_results())
        observation = runner.observe(self.root, self.cli)
        self.assertTrue(observation.valid, observation.reason)
        self.assertFalse(smoke.baseline_empty(observation))
        self.assertFalse(smoke.snapshot_quiet(observation))
        self.assertEqual(len(observation.registry_files), 1)

    def test_raw_cli_failure_output_is_digest_only(self):
        secret = "do-not-log-cli-secret"
        result, _ = self.run_fake([smoke.Observation(), smoke.Observation(), smoke.Observation(), smoke.Observation()],
                                  start=smoke.CommandResult(1, stdout=secret, stderr=secret))
        self.assertEqual(result["status"], "unresolved")
        self.assertNotIn(secret, (self.root / "scratch-smoke-report.json").read_text())


if __name__ == "__main__":
    unittest.main()
