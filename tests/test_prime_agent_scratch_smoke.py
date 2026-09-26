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

    def observe(self, root, cli, required_pids=None):
        if not self.observations:
            raise AssertionError("unexpected extra observation")
        observed = self.observations.pop(0)
        observed.required_pids = sorted(required_pids or set())
        for pid in required_pids or set():
            observed.pid_starts.setdefault(pid, self.pid_values.get(pid))
        return observed

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
        for method in ("Popen", "run", "check_output"):
            guard = mock.patch.object(smoke.subprocess, method, side_effect=AssertionError("unmocked subprocess in fake test"))
            guard.start()
            self.addCleanup(guard.stop)
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
        directory = self.root / "home" / ".prime" / "supervisor-owners" / "g1.owner"
        return smoke.Observation(
            daemons=[{"socketPath": str(self.socket), "pid": 123, "status": "current",
                      "isDefault": True, "sessionCount": 0, "hasTrackedWorkers": False}],
            root_refs=[{"pid": 123, "path": str(self.socket)}], pid_starts={123: "T0"},
            snapshot_generations=["g1"],
            supervisor_configs=[{"path": str(smoke.default_descriptor_dir(self.root, self.socket) / "supervisor-config"),
                                 "version": 1, "socketPath": str(self.socket), "agentDir": str(self.root / "config")}],
            registry_files=[str(directory / "owner.json"), str(directory / "scope.json")],
            registry_owners=[{"generation": "g1", "pid": 123, "start_id": "ps:T0",
                              "socketPath": str(self.socket),
                              "descriptorDir": str(smoke.default_descriptor_dir(self.root, self.socket)),
                              "agentDir": str(self.root / "config"), "phase": "owner"}])

    def good_start(self):
        return smoke.CommandResult(0, f"Daemon started on {self.socket} (pid 123)\n")

    def test_clean_owned_smoke_stops_once_and_retains_root(self):
        result, runner = self.run_fake([smoke.Observation(), self.active(), smoke.Observation(), smoke.Observation()],
                                       start=self.good_start(), pid_values={123: None})
        self.assertEqual(result["status"], "stopped")
        self.assertEqual([command[0][1:3] for command in runner.commands], [("daemon", "start"), ("shutdown", "--force")])
        self.assertTrue(all("--daemon-socket" not in argv for argv, _ in runner.commands))
        self.assertEqual((self.root / "scratch-smoke-report.json").stat().st_mode & 0o777, 0o600)
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

    def test_unreaped_direct_start_child_forbids_shutdown_and_replays(self):
        runner = FakeRunner(self.cli, [smoke.Observation(), smoke.Observation()],
                            start=smoke.CommandResult(None, timed_out=True, child_unresolved=True))
        result = smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertEqual(result["status"], "unresolved_ownership")
        self.assertEqual(len(runner.commands), 1)
        self.assertTrue(result["events"][0]["child_unresolved"])
        self.assertIn("direct start CLI child", result["reasons"][-1])
        self.assert_replay_nonmutating(runner)

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

    def os_results(self, *, ps=None, files=None, unix=None, pid=None, health=None):
        return [
            ((str(self.cli), "daemon", "ps", "--json"), ps or smoke.CommandResult(0, "[]")),
            (("/usr/sbin/lsof", "-nP", "-F", "pn", "+D", str(self.root)), files or smoke.CommandResult(1)),
            (("/usr/sbin/lsof", "-nP", "-F", "pn", "-U"), unix or smoke.CommandResult(1)),
            (("/bin/ps", "-p", str(os.getpid()), "-o", "lstart="),
             health or smoke.CommandResult(0, "Fri Jan  1 00:00:00 2027\n")),
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
        calls = []
        class FakePopen:
            def __init__(self, argv, **kwargs):
                calls.append((argv, kwargs))
                self.stdout = self.pipe()
                self.stderr = self.pipe()
                self.returncode = 0
            def pipe(self):
                read, write = os.pipe()
                os.close(write)
                return os.fdopen(read, "rb")
            def wait(self, timeout=None):
                return 0
            def poll(self):
                return self.returncode
            def kill(self):
                raise AssertionError("fake child should not be killed")
        with mock.patch.object(smoke.subprocess, "Popen", FakePopen):
            for args in commands:
                self.assertEqual(runner.command(args, 12).returncode, 0)
        self.assertEqual(len(calls), len(commands))
        for (argv, kwargs), expected in zip(calls, commands):
            self.assertEqual(argv, expected)
            self.assertEqual(kwargs["cwd"], self.root)
            self.assertEqual(kwargs["env"], {**self.env, "LC_ALL": "C", "TZ": "UTC"})
            self.assertEqual(kwargs["stdout"], smoke.subprocess.PIPE)
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
        descriptor_dir = smoke.default_descriptor_dir(self.root, self.socket)
        descriptor_dir.mkdir(parents=True)
        descriptor_path = descriptor_dir / "w1.json"
        secret = "do-not-emit-descriptor-token"
        descriptor_path.write_text(json.dumps({"version": 2, "pid": 123, "processStartId": "source-start",
                                               "socketPath": str(self.root / "tmp" / f"prime-agent-{os.getuid()}" / f"worker-{descriptor_dir.name}-w1.sock"),
                                               "supervisorSocketPath": str(self.socket),
                                               "authenticationToken": secret, "workerId": "w1",
                                               "rootActiveSessionId": "r1", "createdAt": "time", "updatedAt": "time",
                                               "lifecycle": "ready", "createCommand": {"type": "create"}, "consecutiveFailures": 0,
                                               "recoveryJournalPath": str(descriptor_dir / "w1.recovery.jsonl")}))
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
            def observe(self, root, cli, required_pids=None):
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
            def observe(self, root, cli, required_pids=None):
                self.observed += 1
                if self.observed == 2:
                    raise RuntimeError("active scan failed")
                return super().observe(root, cli, required_pids)
            def quiet_interval(self):
                raise RuntimeError("interval failed")
        runner = BrokenActive(self.cli, [smoke.Observation(), smoke.Observation(), smoke.Observation()],
                              start=self.good_start())
        result = smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertEqual(result["status"], "unresolved_ownership")
        self.assertEqual(len(runner.commands), 1)
        self.assertNotIn("postflight", result)
        self.assertTrue(any("active ownership observation was incomplete" in reason for reason in result["reasons"]))

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

    def assert_replay_nonmutating(self, runner):
        before = (self.root / "scratch-smoke-report.json").read_bytes()
        commands = len(runner.commands)
        with self.assertRaises(smoke.UnsafeScratch):
            smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertEqual(len(runner.commands), commands)
        self.assertEqual((self.root / "scratch-smoke-report.json").read_bytes(), before)

    def owner_fixture(self, pid=123, start="ps:Fri Jan  1 00:00:00 2027"):
        directory = self.root / "home" / ".prime" / "supervisor-owners" / "g1.owner"
        directory.mkdir(parents=True)
        record = {"version": 1, "role": "supervisor", "token": "do-not-print-owner-token",
                  "generation": "g1", "pid": pid, "processStartId": start,
                  "socketPath": str(self.socket), "descriptorDir": str(smoke.default_descriptor_dir(self.root, self.socket)),
                  "agentDir": str(self.root / "config"), "appVersion": "test", "phase": "owner",
                  "createdAt": "time", "updatedAt": "time"}
        scope = {key: record[key] for key in
                 ("version", "role", "token", "generation", "socketPath", "descriptorDir")}
        (directory / "owner.json").write_text(json.dumps(record))
        (directory / "scope.json").write_text(json.dumps(scope))
        descriptor_dir = smoke.default_descriptor_dir(self.root, self.socket)
        descriptor_dir.mkdir(parents=True, exist_ok=True)
        (descriptor_dir / "supervisor-config").write_text(json.dumps({
            "version": 1, "socketPath": str(self.socket),
            "defaultSessionConfig": {"agentDir": str(self.root / "config"),
                                     "cwd": str(self.root / "project"),
                                     "sessionDir": str(self.root / "sessions")}}))
        (descriptor_dir / "snapshot-cache" / "g1").mkdir(parents=True, exist_ok=True)
        return directory, record

    def test_native_owner_scope_and_session_worker_reconciliation(self):
        directory, owner = self.owner_fixture()
        entry = {"socketPath": str(self.socket), "pid": 123, "status": "current",
                 "isDefault": True, "sessionCount": 0, "hasTrackedWorkers": False}
        def scan(value):
            results = self.os_results(
                ps=smoke.CommandResult(0, json.dumps([value])),
                files=smoke.CommandResult(0, f"p123\nn{self.socket}\n"),
                unix=smoke.CommandResult(0, f"p123\nn{self.socket}\n"),
                pid=smoke.CommandResult(0, "Fri Jan  1 00:00:00 2027\n"))
            if value["pid"] == 456:
                results.append((("/bin/ps", "-p", "456", "-o", "lstart="), smoke.CommandResult(1)))
            runner = FakeOSNativeRunner(self.cli, results)
            result = runner.observe(self.root, self.cli)
            self.assertTrue(result.valid, result.reason)
            self.assertNotIn(owner["token"], json.dumps(result.record()))
            return smoke.active_shutdown_admission(result, self.root, self.socket, 123, True)
        self.assertEqual(scan(entry)[:2], (True, True))
        for change in ({"sessionCount": 1}, {"hasTrackedWorkers": True},
                       {"pid": 456}, {"isDefault": False}):
            with self.subTest(change=change):
                self.assertFalse(scan({**entry, **change})[0])
        owner["processStartId"] = "ps:other"
        (directory / "owner.json").write_text(json.dumps(owner))
        self.assertFalse(scan(entry)[0])
        owner["processStartId"] = "ps:Fri Jan  1 00:00:00 2027"
        (directory / "owner.json").write_text(json.dumps(owner))
        (directory / "scope.json").write_text(json.dumps({"version": 1, "role": "supervisor",
                                                         "token": "wrong", "generation": "g1",
                                                         "socketPath": str(self.socket),
                                                         "descriptorDir": owner["descriptorDir"]}))
        bad = FakeOSNativeRunner(self.cli, self.os_results())
        self.assertFalse(bad.observe(self.root, self.cli).valid)

    def test_extra_owner_or_mismatched_registry_scope_revokes_and_replay(self):
        for mutation in ("extra", "socket", "start"):
            with self.subTest(mutation=mutation):
                if (self.root / "scratch-smoke-report.json").exists():
                    (self.root / "scratch-smoke-report.json").unlink()
                if (self.root / "project").exists():
                    (self.root / "project").rmdir()
                active = self.active()
                if mutation == "extra":
                    active.registry_owners.append({**active.registry_owners[0], "pid": 456})
                    active.registry_files.extend([str(self.root / "home" / ".prime" / "supervisor-owners" / "g2.owner" / name)
                                                  for name in ("owner.json", "scope.json")])
                elif mutation == "socket":
                    active.registry_owners[0]["socketPath"] = str(self.root / "tmp" / "foreign.sock")
                else:
                    active.registry_owners[0]["start_id"] = "ps:other"
                result, runner = self.run_fake([smoke.Observation(), active], start=self.good_start())
                self.assertEqual(result["status"], "unresolved_ownership")
                self.assertEqual(len(runner.commands), 1)
                self.assert_replay_nonmutating(runner)

    def test_partial_observation_preserves_adverse_daemon_when_lsof_later_fails(self):
        foreign = {"socketPath": str(self.root / "tmp" / "other.sock"), "pid": 456,
                   "status": "current", "isDefault": False, "sessionCount": 1,
                   "hasTrackedWorkers": True}
        runner = FakeOSNativeRunner(self.cli, self.os_results(
            ps=smoke.CommandResult(0, json.dumps([foreign])),
            files=smoke.CommandResult(1, stderr="lsof failed")))
        result = runner.observe(self.root, self.cli)
        self.assertFalse(result.valid)
        self.assertEqual(result.daemons[0]["pid"], 456)
        self.assertFalse(smoke.active_shutdown_admission(result, self.root, self.socket, 123, True)[0])
        active = self.active()
        active.valid = False
        active.reason = "later filesystem scan failed"
        active.registry_owners[0]["pid"] = 456
        report, fake = self.run_fake([smoke.Observation(), active], start=self.good_start())
        self.assertEqual(report["status"], "unresolved_ownership")
        self.assertEqual(len(fake.commands), 1)
        self.assertEqual(report["active"]["registry_owners"][0]["pid"], 456)
        self.assert_replay_nonmutating(fake)

    def test_incomplete_scans_and_descriptor_shapes_fail_closed(self):
        for bad in ("garbled-output", "p123\n", "p123\nf\n", "p123\nn\n"):
            with self.subTest(lsof=bad), self.assertRaises(smoke.UnsafeScratch):
                smoke.parse_lsof(bad, self.root)
        self.assertEqual(smoke.parse_lsof("p123\nf3\np456\nn/var/tmp/unrelated.sock\n", self.root), [])
        descriptor_dir = smoke.default_descriptor_dir(self.root, self.socket)
        descriptor_dir.mkdir(parents=True)
        (descriptor_dir / "bad.json").write_text(json.dumps({"version": 2, "pid": 123,
                                                            "processStartId": "T0",
                                                            "authenticationToken": "secret"}))
        observation = FakeOSNativeRunner(self.cli, self.os_results()).observe(self.root, self.cli)
        self.assertFalse(observation.valid)
        self.assertNotIn("secret", json.dumps(observation.record()))
        self.assertFalse(smoke.snapshot_quiet(observation))
        (descriptor_dir / "bad.json").unlink()
        for injected in (PermissionError("unreadable"), FileNotFoundError("vanished")):
            with self.subTest(error=type(injected).__name__), mock.patch.object(smoke.os, "scandir", side_effect=injected):
                observation = FakeOSNativeRunner(self.cli, self.os_results()).observe(self.root, self.cli)
                self.assertFalse(observation.valid)
                self.assertFalse(smoke.baseline_empty(observation))
        with mock.patch.object(smoke, "MAX_SCAN_ENTRIES", 1):
            observation = FakeOSNativeRunner(self.cli, self.os_results()).observe(self.root, self.cli)
            self.assertFalse(observation.valid)

    def test_captured_pid_checked_in_each_postflight_and_replay(self):
        for first, second in (("T0", None), (None, "T1"), (None, None)):
            with self.subTest(first=first, second=second):
                if (self.root / "scratch-smoke-report.json").exists():
                    (self.root / "scratch-smoke-report.json").unlink()
                if (self.root / "project").exists():
                    (self.root / "project").rmdir()
                observations = [smoke.Observation(), self.active(),
                                smoke.Observation(pid_starts={123: first}),
                                smoke.Observation(pid_starts={123: second})]
                result, runner = self.run_fake(observations, start=self.good_start())
                self.assertEqual(result["status"], "stopped" if first is None and second is None else "unresolved")
                self.assertEqual(result["postflight"][0]["required_pids"], [123])
                self.assertEqual(result["postflight"][1]["required_pids"], [123])
                self.assert_replay_nonmutating(runner)

    def test_malformed_successful_start_and_second_scan_new_listener(self):
        malformed = smoke.CommandResult(0, "Daemon started on /outside.sock (pid 123)\n")
        report, runner = self.run_fake([smoke.Observation(), smoke.Observation(),
                                        smoke.Observation(), smoke.Observation()], start=malformed)
        self.assertEqual(report["status"], "unresolved")
        self.assertEqual(len(runner.commands), 2)
        self.assert_replay_nonmutating(runner)
        (self.root / "scratch-smoke-report.json").unlink()
        (self.root / "project").rmdir()
        new_listener = smoke.Observation(unix_refs=[{"pid": 456, "path": str(self.socket)}],
                                         pid_starts={456: "T1"})
        result, runner = self.run_fake([smoke.Observation(), self.active(),
                                        smoke.Observation(), new_listener], start=self.good_start())
        self.assertEqual(result["status"], "unresolved")
        self.assert_replay_nonmutating(runner)

    def test_ps_failure_even_with_empty_discovery(self):
        runner = FakeOSNativeRunner(self.cli, self.os_results(health=smoke.CommandResult(None, timed_out=True)))
        observed = runner.observe(self.root, self.cli)
        self.assertFalse(observed.valid)
        self.assertFalse(observed.ps_complete)
        runner = FakeOSNativeRunner(self.cli, self.os_results(health=smoke.CommandResult(0, "not-an-lstart")))
        self.assertFalse(runner.observe(self.root, self.cli).valid)

    def test_cli_identity_symlink_change_and_invocation_record(self):
        alias = self.cli_parent / "alias"
        alias.symlink_to(self.cli)
        with self.assertRaises(smoke.UnsafeScratch):
            smoke.validate_root(self.env, alias, self.sha)
        parent_alias = self.cli_parent / "parent-alias"
        parent_alias.symlink_to(self.cli_parent, target_is_directory=True)
        with self.assertRaises(smoke.UnsafeScratch):
            smoke.validate_root(self.env, parent_alias / "prime-agent", self.sha)
        with self.assertRaises(smoke.UnsafeScratch):
            smoke.validate_root(self.env, self.cli, "0" * 64)
        class ReplaceAfterStart(FakeRunner):
            def command(this, argv, timeout):
                result = super().command(argv, timeout)
                if argv[1:3] == ["daemon", "start"]:
                    self.cli.write_text("#!/bin/sh\nexit 98\n")
                return result
        runner = ReplaceAfterStart(self.cli, [smoke.Observation()], start=self.good_start())
        result = smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertEqual(result["status"], "unresolved_ownership")
        self.assertEqual(len(runner.commands), 1)
        event = result["events"][0]
        self.assertEqual(event["argv"][-2:], ["--cwd", str(self.root / "project")])
        self.assertEqual(event["cli_path"], str(self.cli))
        self.assertEqual(event["cwd"], str(Path.cwd()))
        self.assert_replay_nonmutating(runner)

    def test_finalizer_injected_failures_are_unresolved_and_one_attempt(self):
        class Broken(FakeRunner):
            count = 0
            def observe(self, root, cli, required_pids=None):
                self.count += 1
                if self.count == 3:
                    raise RuntimeError("secret-postflight-error")
                return super().observe(root, cli, required_pids)
        runner = Broken(self.cli, [smoke.Observation(), self.active(), smoke.Observation()],
                        start=self.good_start())
        result = smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertEqual(result["status"], "unresolved")
        self.assertEqual(len(result["postflight"]), 2)
        self.assertEqual(len(runner.commands), 2)
        self.assertNotIn("secret-postflight-error", (self.root / "scratch-smoke-report.json").read_text())
        self.assert_replay_nonmutating(runner)

    def test_postshutdown_fsync_failure_surfaces_retained_root_without_retry(self):
        runner = FakeRunner(self.cli, [smoke.Observation(), self.active(),
                                       smoke.Observation(), smoke.Observation()],
                            start=self.good_start())
        with mock.patch.object(smoke.os, "fsync", side_effect=OSError("secret-fsync")):
            with self.assertRaises(smoke.UnsafeScratch) as raised:
                smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertIn(str(self.root), str(raised.exception))
        self.assertNotIn("secret-fsync", str(raised.exception))
        self.assertEqual(len(runner.commands), 2)
        self.assertTrue(self.root.exists())
        self.assert_replay_nonmutating(runner)

    def test_directory_fsync_failure_never_returns_stopped_verdict(self):
        runner = FakeRunner(self.cli, [smoke.Observation(), self.active(),
                                       smoke.Observation(), smoke.Observation()],
                            start=self.good_start())
        real_fsync = os.fsync
        def fail_directory(fd):
            if stat.S_ISDIR(os.fstat(fd).st_mode):
                raise OSError("secret-directory-fsync")
            return real_fsync(fd)
        with mock.patch.object(smoke.os, "fsync", side_effect=fail_directory):
            with self.assertRaisesRegex(smoke.UnsafeScratch, "evidence write failed") as raised:
                smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertIn(str(self.root), str(raised.exception))
        self.assertNotIn("secret-directory-fsync", str(raised.exception))
        self.assertEqual(len(runner.commands), 2)
        # Bytes may exist, but the directory-fsync failure means this is
        # uncommitted evidence, not a returned stopped verdict.
        self.assertTrue((self.root / "scratch-smoke-report.json").exists())
        self.assert_replay_nonmutating(runner)

    def test_exclusive_report_failure_retains_root_and_never_replays(self):
        (self.root / "scratch-smoke-report.json").write_text("sentinel")
        runner = FakeRunner(self.cli, [smoke.Observation()])
        with self.assertRaisesRegex(smoke.UnsafeScratch, "evidence write failed"):
            smoke.smoke(self.env, self.cli, self.sha, runner, run_native=False)
        self.assertEqual((self.root / "scratch-smoke-report.json").read_text(), "sentinel")
        self.assertEqual(runner.commands, [])
        self.assertTrue(self.root.exists())

    def test_failure_matrix_replay_and_root_guards(self):
        with self.assertRaises(smoke.UnsafeScratch):
            smoke.validate_root({**self.env, "TMPDIR": str(self.root / "home")}, self.cli, self.sha)
        (self.root / "config").chmod(0o755)
        with self.assertRaises(smoke.UnsafeScratch):
            smoke.validate_root(self.env, self.cli, self.sha)
        (self.root / "config").chmod(0o700)
        custom = smoke.Observation(daemons=[{"socketPath": str(self.root / "tmp" / "custom.sock"),
                                              "pid": 123, "status": "current", "isDefault": False,
                                              "sessionCount": 0, "hasTrackedWorkers": False}])
        self.assertFalse(smoke.active_shutdown_admission(custom, self.root, self.socket, 123, True)[0])
        report, runner = self.run_fake([smoke.Observation(valid=False, reason="lsof failed")])
        self.assertEqual(report["status"], "blocked_preflight")
        self.assert_replay_nonmutating(runner)

    def test_result_recording_and_second_scan_exceptions_are_contained(self):
        class BrokenResult(smoke.CommandResult):
            def record(self):
                raise ValueError("secret-result")
        class BrokenSecond(FakeRunner):
            count = 0
            def observe(self, root, cli, required_pids=None):
                self.count += 1
                if self.count == 4:
                    raise ValueError("secret-second")
                return super().observe(root, cli, required_pids)
        runner = BrokenSecond(self.cli, [smoke.Observation(), self.active(), smoke.Observation()],
                              start=self.good_start(), stop=BrokenResult(0, '{"stopped":[],"failed":[]}'))
        report = smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertEqual(report["status"], "unresolved")
        self.assertEqual(len(runner.commands), 2)
        self.assertEqual(len(report["postflight"]), 2)
        self.assertNotIn("secret-", (self.root / "scratch-smoke-report.json").read_text())
        self.assert_replay_nonmutating(runner)

    def test_oversized_injected_command_result_and_report_failure(self):
        start = smoke.CommandResult(0, "x" * (smoke.MAX_COMMAND_BYTES + 1))
        result, runner = self.run_fake([smoke.Observation(), smoke.Observation(),
                                        smoke.Observation(), smoke.Observation()], start=start)
        self.assertEqual(result["status"], "unresolved")
        self.assertEqual(len(runner.commands), 2)
        self.assertNotIn("x" * 100, (self.root / "scratch-smoke-report.json").read_text())
        self.assert_replay_nonmutating(runner)
        (self.root / "scratch-smoke-report.json").unlink()
        (self.root / "project").rmdir()
        stderr = smoke.CommandResult(1, stderr="secret" * (smoke.MAX_COMMAND_BYTES // 6 + 1))
        second, second_runner = self.run_fake([smoke.Observation(), smoke.Observation(),
                                               smoke.Observation(), smoke.Observation()], start=stderr)
        self.assertEqual(second["status"], "unresolved")
        self.assertEqual(len(second_runner.commands), 2)
        self.assertNotIn("secretsecret", (self.root / "scratch-smoke-report.json").read_text())
        self.assert_replay_nonmutating(second_runner)
        another = Path(tempfile.mkdtemp(prefix="pcp.", dir="/tmp")).resolve()
        self.addCleanup(shutil.rmtree, another)
        with mock.patch.object(smoke.json, "dumps", side_effect=ValueError("secret-json")):
            with self.assertRaisesRegex(smoke.UnsafeScratch, "evidence write failed"):
                smoke.record_report(another, {"status": "unresolved"})
        self.assertFalse((another / "scratch-smoke-report.json").exists())

    def test_valid_stale_native_descriptor_and_journal_are_retained_only_when_quiet(self):
        descriptor_dir = smoke.default_descriptor_dir(self.root, self.socket)
        descriptor_dir.mkdir(parents=True)
        worker_socket = self.root / "tmp" / f"prime-agent-{os.getuid()}" / f"worker-{descriptor_dir.name}-w1.sock"
        descriptor = {"version": 2, "workerId": "w1", "pid": 123,
                      "processStartId": "ps:old", "socketPath": str(worker_socket),
                      "recoveryJournalPath": str(descriptor_dir / "w1.recovery.jsonl"),
                      "supervisorSocketPath": str(self.socket),
                      "authenticationToken": "hidden-worker-token", "rootActiveSessionId": "root1",
                      "createdAt": "time", "updatedAt": "time", "lifecycle": "ready",
                      "createCommand": {"type": "create"}, "consecutiveFailures": 0}
        (descriptor_dir / "w1.json").write_text(json.dumps(descriptor))
        (descriptor_dir / "w1.recovery.jsonl").write_text(json.dumps({
            "version": 1, "activeSessionId": "r1", "sessionId": "s1", "busy": False,
            "operation": "opaque-journal-token", "recordedAt": "time"}) + "\n")
        runner = FakeOSNativeRunner(self.cli, self.os_results(pid=smoke.CommandResult(1)))
        observed = runner.observe(self.root, self.cli)
        self.assertTrue(observed.valid, observed.reason)
        self.assertFalse(smoke.baseline_empty(observed))
        self.assertTrue(smoke.snapshot_quiet(observed))
        self.assertNotIn(descriptor["authenticationToken"], json.dumps(observed.record()))
        self.assertNotIn("opaque-journal-token", json.dumps(observed.record()))
        (descriptor_dir / "w1.json").write_text(json.dumps({**descriptor, "version": 3}))
        self.assertFalse(FakeOSNativeRunner(self.cli, self.os_results()).observe(self.root, self.cli).valid)

    def test_native_filesystem_stat_and_json_read_failures_preserve_uncertainty(self):
        descriptor_dir = smoke.default_descriptor_dir(self.root, self.socket)
        descriptor_dir.mkdir(parents=True)
        descriptor = descriptor_dir / "worker.json"
        descriptor.write_text("{}")
        with mock.patch.object(smoke, "read_scanned_json", side_effect=PermissionError("secret-read")):
            observed = FakeOSNativeRunner(self.cli, self.os_results()).observe(self.root, self.cli)
        self.assertFalse(observed.valid)
        self.assertNotIn("secret-read", json.dumps(observed.record()))
        with mock.patch.object(smoke, "MAX_RECORD_BYTES", 1):
            observed = FakeOSNativeRunner(self.cli, self.os_results()).observe(self.root, self.cli)
        self.assertFalse(observed.valid)
        descriptor.unlink()
        (descriptor_dir / "bad-link").symlink_to(self.cli)
        observed = FakeOSNativeRunner(self.cli, self.os_results()).observe(self.root, self.cli)
        self.assertFalse(observed.valid)
        self.assertFalse(smoke.snapshot_quiet(observed))

    def test_observation_record_exception_is_not_stopped(self):
        class BadRecord(smoke.Observation):
            def record(self):
                raise ValueError("secret-observation")
        runner = FakeRunner(self.cli, [smoke.Observation(), self.active(),
                                       BadRecord(), smoke.Observation()], start=self.good_start())
        result = smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertEqual(result["status"], "unresolved")
        self.assertEqual(len(runner.commands), 2)
        self.assertNotIn("secret-observation", (self.root / "scratch-smoke-report.json").read_text())
        self.assert_replay_nonmutating(runner)

    def test_native_runner_rejects_replaced_cli_before_popen(self):
        if sys.platform != "darwin":
            self.skipTest("macOS-only native driver")
        runner = smoke.NativeRunner(self.env, self.cli, self.root)
        self.cli.write_text("#!/bin/sh\nexit 98\n")
        with self.assertRaisesRegex(smoke.UnsafeScratch, "identity changed"):
            runner.command([str(self.cli), "shutdown", "--force", "--json"], 5)
        # Test-wide subprocess guard proves no replaced CLI was executed.

    def test_native_pipe_pump_caps_capture_without_executing_child(self):
        if sys.platform != "darwin":
            self.skipTest("macOS-only native driver")
        runner = smoke.NativeRunner(self.env, self.cli, self.root)
        class FakePopen:
            def __init__(self, argv, **kwargs):
                self.returncode = None
                self.killed = False
                self.stdout = self.pipe()
                self.stderr = self.pipe()
            def pipe(self):
                read, write = os.pipe()
                os.write(write, b"x")
                os.close(write)
                return os.fdopen(read, "rb")
            def poll(self):
                return self.returncode
            def kill(self):
                self.killed = True
                self.returncode = -9
            def wait(self, timeout=None):
                return self.returncode
        instances = []
        def construct(*args, **kwargs):
            instance = FakePopen(*args, **kwargs)
            instances.append(instance)
            return instance
        real_read = os.read
        def oversized_read(fd, n):
            real_read(fd, n)
            return b"x" * (smoke.MAX_COMMAND_BYTES + 1)
        with mock.patch.object(smoke.subprocess, "Popen", construct), mock.patch.object(smoke.os, "read", side_effect=oversized_read):
            result = runner.command([str(self.cli), "daemon", "ps", "--json"], 5)
        self.assertTrue(result.timed_out)
        self.assertTrue(result.output_truncated)
        self.assertEqual(result.returncode, None)
        self.assertEqual(result.stdout, "")
        self.assertTrue(instances[0].killed)

    def test_native_supervisor_artifact_inventory_and_scope(self):
        directory, owner = self.owner_fixture()
        descriptor_dir = smoke.default_descriptor_dir(self.root, self.socket)
        config_path = descriptor_dir / "supervisor-config"
        journal_path = descriptor_dir / "command-journal.jsonl"
        journal_path.write_text(json.dumps({"version": 1, "type": "received", "key": "[\"c\",\"id\"]",
                                            "clientId": "c", "commandId": "id", "commandType": "shutdown",
                                            "recordedAt": "time"}) + "\n")
        results = self.os_results(ps=smoke.CommandResult(0, json.dumps([{
            "socketPath": str(self.socket), "pid": 123, "status": "current", "isDefault": True,
            "sessionCount": 0, "hasTrackedWorkers": False}])),
            pid=smoke.CommandResult(0, "Fri Jan  1 00:00:00 2027\n"))
        def scan():
            runner = FakeOSNativeRunner(self.cli, results)
            return runner.observe(self.root, self.cli)
        observed = scan()
        self.assertTrue(observed.valid, observed.reason)
        self.assertEqual(len(observed.supervisor_configs), 1)
        self.assertEqual(len(observed.command_journals), 1)
        self.assertTrue(smoke.active_shutdown_admission(observed, self.root, self.socket, 123, True)[0])
        self.assertNotIn(owner["token"], json.dumps(observed.record()))
        # Native retained config/journal are not worker metadata. Two valid
        # quiet snapshots can retain them after owner registry removal.
        directory.joinpath("owner.json").unlink()
        directory.joinpath("scope.json").unlink()
        empty_results = self.os_results()
        for _ in range(2):
            quiet = FakeOSNativeRunner(self.cli, empty_results).observe(self.root, self.cli)
            self.assertTrue(quiet.valid, quiet.reason)
            self.assertTrue(smoke.snapshot_quiet(quiet))
        config = json.loads(config_path.read_text())
        for bad in ({**config, "version": 3}, {**config, "extra": "x"},
                    {**config, "socketPath": "/outside/socket"},
                    {**config, "defaultSessionConfig": {"agentDir": "/outside"}},
                    {**config, "defaultSessionConfig": {"agentDir": str(self.root / "config"), "cwd": 7}}):
            config_path.write_text(json.dumps(bad))
            observed = FakeOSNativeRunner(self.cli, empty_results).observe(self.root, self.cli)
            self.assertFalse(observed.valid)
            self.assertFalse(smoke.snapshot_quiet(observed))
        config_path.write_text(json.dumps(config))
        for name, contents in (("unknown", "x"), ("w2.json", "{}"),
                               ("orphan.recovery.jsonl", "x")):
            extra = descriptor_dir / name
            extra.write_text(contents)
            self.assertFalse(FakeOSNativeRunner(self.cli, empty_results).observe(self.root, self.cli).valid)
            extra.unlink()
        journal_path.write_text("{bad-json")
        self.assertFalse(FakeOSNativeRunner(self.cli, empty_results).observe(self.root, self.cli).valid)

    def test_full_native_shaped_active_tree_stops_once_and_replays_without_mutation(self):
        test = self
        class FilesystemRunner(FakeOSNativeRunner):
            def __init__(self):
                super().__init__(test.cli, [])
                self.live = False
                self.quiet_calls = 0
            def command(self, argv, timeout):
                self.commands.append(tuple(argv))
                if tuple(argv[1:3]) == ("daemon", "start"):
                    test.owner_fixture()
                    self.live = True
                    return test.good_start()
                if tuple(argv[1:3]) == ("shutdown", "--force"):
                    self.live = False
                    directory = test.root / "home" / ".prime" / "supervisor-owners" / "g1.owner"
                    (directory / "owner.json").unlink()
                    (directory / "scope.json").unlink()
                    journal = smoke.default_descriptor_dir(test.root, test.socket) / "command-journal.jsonl"
                    journal.write_text("\n")
                    return smoke.CommandResult(0, '{"stopped": [], "failed": []}')
                if tuple(argv[1:]) == ("daemon", "ps", "--json"):
                    rows = ([{"socketPath": str(test.socket), "pid": 123, "status": "current",
                              "isDefault": True, "sessionCount": 0, "hasTrackedWorkers": False}]
                            if self.live else [])
                    return smoke.CommandResult(0, json.dumps(rows))
                if argv[0] == "/usr/sbin/lsof":
                    return smoke.CommandResult(0, f"p123\nn{test.socket}\n") if self.live else smoke.CommandResult(1)
                if argv[0] == "/bin/ps":
                    return (smoke.CommandResult(0, "Fri Jan  1 00:00:00 2027\n")
                            if argv[2] != "123" or self.live else smoke.CommandResult(1))
                raise AssertionError("unexpected fake command")
            def quiet_interval(self):
                self.quiet_calls += 1
        runner = FilesystemRunner()
        report = smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertEqual(report["status"], "stopped")
        self.assertEqual([event["operation"] for event in report["events"]],
                         ["daemon_start_once", "top_level_shutdown_once"])
        self.assertEqual(len(report["postflight"]), 2)
        self.assertTrue(all(snap["command_journals"] and snap["supervisor_configs"] for snap in report["postflight"]))
        self.assertEqual(runner.quiet_calls, 1)
        self.assert_replay_nonmutating(runner)

    def test_supervisor_partial_stat_traversal_and_read_fail_closed(self):
        self.owner_fixture()
        active = {"socketPath": str(self.socket), "pid": 123, "status": "current",
                  "isDefault": True, "sessionCount": 0, "hasTrackedWorkers": False}
        results = self.os_results(ps=smoke.CommandResult(0, json.dumps([active])),
                                  pid=smoke.CommandResult(0, "Fri Jan  1 00:00:00 2027\n"))
        real_scan = smoke.scan_root_entries
        def partial(root):
            for path, st in real_scan(root):
                yield path, st
                if path.name == "supervisor-config":
                    raise PermissionError("secret-traversal")
        with mock.patch.object(smoke, "scan_root_entries", partial):
            observed = FakeOSNativeRunner(self.cli, results).observe(self.root, self.cli)
        self.assertFalse(observed.valid)
        self.assertEqual(observed.daemons[0]["pid"], 123)
        self.assertTrue(observed.supervisor_configs)
        self.assertFalse(smoke.active_shutdown_admission(observed, self.root, self.socket, 123, True)[0])
        self.assertNotIn("secret-", json.dumps(observed.record()))
        config_path = smoke.default_descriptor_dir(self.root, self.socket) / "supervisor-config"
        with mock.patch.object(smoke, "read_scanned_json", side_effect=PermissionError("secret-read")):
            observed = FakeOSNativeRunner(self.cli, results).observe(self.root, self.cli)
        self.assertFalse(observed.valid)
        self.assertEqual(observed.daemons[0]["pid"], 123)
        with mock.patch.object(smoke.os, "open", side_effect=PermissionError("secret-open")):
            observed = FakeOSNativeRunner(self.cli, results).observe(self.root, self.cli)
        self.assertFalse(observed.valid)
        self.assertTrue(config_path.exists())

    def test_supported_worker_versions_and_reject_malformed_nested_routing(self):
        descriptor_dir = smoke.default_descriptor_dir(self.root, self.socket)
        descriptor_dir.mkdir(parents=True)
        worker_socket = self.root / "tmp" / f"prime-agent-{os.getuid()}" / f"worker-{descriptor_dir.name}-w1.sock"
        value = {"version": 2, "workerId": "w1", "pid": 123,
                 "processStartId": "ps:old", "socketPath": str(worker_socket),
                 "recoveryJournalPath": str(descriptor_dir / "w1.recovery.jsonl"),
                 "supervisorSocketPath": str(self.socket), "authenticationToken": "secret-token",
                 "rootActiveSessionId": "root1", "createdAt": "time", "updatedAt": "time",
                 "lifecycle": "ready", "createCommand": {"type": "create", "noSession": False},
                 "consecutiveFailures": 0}
        path = descriptor_dir / "w1.json"
        for version in (1, 2):
            good = {**value, "version": version}
            if version == 1:
                good["createCommand"] = {"type": "create", "config": {"agentDir": str(self.root / "config")}}
            path.write_text(json.dumps(good))
            observed = FakeOSNativeRunner(self.cli, self.os_results(pid=smoke.CommandResult(1))).observe(self.root, self.cli)
            self.assertTrue(observed.valid, observed.reason)
            self.assertTrue(smoke.snapshot_quiet(observed))
            self.assertNotIn("secret-token", json.dumps(observed.record()))
        bad_cases = [
            {"lifecycle": "unknown"}, {"lifecycle": "stopped"}, {"version": 3},
            {"createCommand": {}}, {"createCommand": {"type": "delete"}},
            {"createCommand": {"type": "create", "sessionPath": "/outside"}},
            {"createCommand": {"type": "create", "noSession": "false"}},
            {"createCommand": {"type": "create", "config": {"agentDir": str(self.root / "config")}}},
            {"socketPath": "/outside/socket"}, {"recoveryJournalPath": str(self.root / "config" / "wrong")},
            {"sessionDir": "/outside"}, {"sessionDir": str(self.root / "config")},
            {"createCommand": {"type": "create", "sessionPath": str(self.root / "project" / "wrong")}},
            {"telemetryDisabled": False},
        ]
        for change in bad_cases:
            with self.subTest(change=change):
                path.write_text(json.dumps({**value, **change}))
                observed = FakeOSNativeRunner(self.cli, self.os_results()).observe(self.root, self.cli)
                self.assertFalse(observed.valid)
                self.assertFalse(smoke.snapshot_quiet(observed))

    def test_postflight_classification_exceptions_keep_two_snapshots_and_report(self):
        for stage in ("quiet", "identity", "malformed"):
            with self.subTest(stage=stage):
                if (self.root / "scratch-smoke-report.json").exists():
                    (self.root / "scratch-smoke-report.json").unlink()
                if (self.root / "project").exists():
                    (self.root / "project").rmdir()
                first = smoke.Observation(daemons=[1]) if stage == "malformed" else smoke.Observation()
                runner = FakeRunner(self.cli, [smoke.Observation(), self.active(), first, smoke.Observation()],
                                    start=self.good_start())
                if stage == "quiet":
                    patch = mock.patch.object(smoke, "snapshot_quiet", side_effect=ValueError("secret-quiet"))
                elif stage == "identity":
                    class BrokenPID(dict):
                        def get(self, *args):
                            raise ValueError("secret-pid")
                    first.pid_starts = BrokenPID()
                    patch = mock.patch.object(smoke, "snapshot_quiet", return_value=True)
                else:
                    patch = mock.patch.object(smoke, "snapshot_quiet", wraps=smoke.snapshot_quiet)
                with patch:
                    result = smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
                self.assertEqual(result["status"], "unresolved")
                self.assertEqual(len(result["postflight"]), 2)
                self.assertEqual(len(runner.commands), 2)
                self.assertNotIn("secret-", (self.root / "scratch-smoke-report.json").read_text())
                self.assert_replay_nonmutating(runner)

    def test_direct_child_setup_and_reaping_failures_are_bounded(self):
        if sys.platform != "darwin":
            self.skipTest("macOS-only native driver")
        runner = smoke.NativeRunner(self.env, self.cli, self.root)
        class Child:
            def __init__(self):
                self.stdout = self.pipe()
                self.stderr = self.pipe()
                self.returncode = None
                self.kills = 0
                self.waits = []
                self.refuse = False
            def pipe(self):
                read, write = os.pipe()
                os.close(write)
                return os.fdopen(read, "rb")
            def poll(self):
                return self.returncode
            def kill(self):
                self.kills += 1
                if not self.refuse:
                    self.returncode = -9
            def wait(self, timeout=None):
                self.waits.append(timeout)
                if self.refuse:
                    raise smoke.subprocess.TimeoutExpired("fake-child", timeout)
                return self.returncode
        for failure in ("selector", "register", "select", "read", "refuse", "kill_failure"):
            with self.subTest(failure=failure):
                child = Child()
                child.refuse = failure in ("refuse", "kill_failure")
                if failure == "kill_failure":
                    def failed_kill():
                        child.kills += 1
                        raise OSError("secret-kill")
                    child.kill = failed_kill
                class BadSelector:
                    def __init__(self):
                        if failure in ("selector", "kill_failure"):
                            raise OSError("secret-selector")
                        self.registered = {}
                    def register(self, pipe, flags, data):
                        if failure == "register":
                            raise OSError("secret-register")
                        self.registered[pipe] = data
                    def get_map(self):
                        return self.registered
                    def select(self, timeout):
                        if failure == "select":
                            raise OSError("secret-select")
                        return [(type("Key", (), {"fileobj": pipe, "data": name})(), None)
                                for pipe, name in self.registered.items()]
                    def unregister(self, pipe):
                        self.registered.pop(pipe)
                    def close(self):
                        pass
                with mock.patch.object(smoke.subprocess, "Popen", return_value=child), \
                     mock.patch.object(smoke.selectors, "DefaultSelector", BadSelector), \
                     mock.patch.object(smoke.os, "read", side_effect=OSError("secret-read") if failure == "read" else lambda fd, size: b""):
                    result = runner.command([str(self.cli), "daemon", "ps", "--json"], 0.01 if failure == "refuse" else 5)
                self.assertTrue(result.timed_out)
                self.assertEqual(result.returncode, None)
                self.assertEqual(child.kills, 1)
                self.assertTrue(child.stdout.closed and child.stderr.closed)
                self.assertTrue(child.waits and all(v is not None and v <= 5 for v in child.waits))
                self.assertEqual(result.child_unresolved, failure in ("refuse", "kill_failure"))
                self.assertNotIn("secret-", json.dumps(result.record()))

    def test_c1_record_failures_preserve_revocation_and_one_stop_semantics(self):
        class BadRecord(smoke.CommandResult):
            def record(self):
                raise ValueError("secret-record")
        for start in (BadRecord(0, f"Daemon already running on {self.socket}"),
                      BadRecord(None, child_unresolved=True),
                      BadRecord(0, f"Daemon already running on {self.socket}", child_unresolved=True),
                      smoke.CommandResult(0, f"Daemon already running on {self.socket}",
                                          stderr="x" * (smoke.MAX_COMMAND_BYTES + 1))):
            with self.subTest(start=start.__class__.__name__):
                (self.root / "scratch-smoke-report.json").unlink(missing_ok=True)
                (self.root / "project").rmdir() if (self.root / "project").exists() else None
                report, runner = self.run_fake([smoke.Observation(), smoke.Observation()], start=start)
                self.assertEqual(report["status"], "unresolved_ownership")
                self.assertEqual(len(runner.commands), 1)
                self.assertNotIn("secret-record", json.dumps(report))
                self.assert_replay_nonmutating(runner)
        (self.root / "scratch-smoke-report.json").unlink()
        (self.root / "project").rmdir()
        report, runner = self.run_fake([smoke.Observation(), smoke.Observation(),
                                        smoke.Observation(), smoke.Observation()],
                                       start=BadRecord(None, timed_out=True))
        self.assertEqual(report["status"], "unresolved")
        self.assertEqual(len(runner.commands), 2)
        self.assert_replay_nonmutating(runner)

    def test_c1_native_invalid_utf8_expansion_unreaped_start(self):
        if sys.platform != "darwin":
            self.skipTest("macOS-only native driver")
        native = smoke.NativeRunner(self.env, self.cli, self.root)
        class Child:
            returncode = None
            def __init__(self):
                self.stdout, self.stdout_writer = os.pipe()
                self.stderr, self.stderr_writer = os.pipe()
                os.close(self.stdout_writer)
                os.close(self.stderr_writer)
                self.stdout = os.fdopen(self.stdout, "rb")
                self.stderr = os.fdopen(self.stderr, "rb")
                self.kills = 0
                self.waits = []
            def poll(self): return None
            def kill(self): self.kills += 1
            def wait(self, timeout=None):
                self.waits.append(timeout)
                raise smoke.subprocess.TimeoutExpired("fake", timeout)
        child = Child()
        real_read = os.read
        emitted = False
        def read(fd, size):
            nonlocal emitted
            if fd == child.stderr.fileno() and not emitted:
                emitted = True
                return b"\xff" * 400_000
            return real_read(fd, size)
        with mock.patch.object(smoke.subprocess, "Popen", return_value=child), \
             mock.patch.object(smoke.os, "read", side_effect=read):
            start = native.command([str(self.cli), "daemon", "start"], 5)
        self.assertTrue(start.child_unresolved)
        self.assertTrue(start.output_truncated, (len(start.stderr.encode()), start.capture_failed, emitted))
        self.assertLessEqual(len(start.stderr.encode()), smoke.MAX_COMMAND_BYTES)
        self.assertEqual(child.kills, 1)
        self.assertTrue(child.waits and all(v is not None and v <= 5 for v in child.waits))
        report, runner = self.run_fake([smoke.Observation(), smoke.Observation()], start=start)
        self.assertEqual(report["status"], "unresolved_ownership")
        self.assertEqual(len(runner.commands), 1)
        self.assert_replay_nonmutating(runner)

    def test_c2_generations_orphans_and_changed_state_revoke_stopped(self):
        for first, second, expected in (
            (smoke.Observation(snapshot_generations=["g1"]),
             smoke.Observation(snapshot_generations=["g1"]), "stopped"),
            (smoke.Observation(snapshot_generations=["g2"]), smoke.Observation(), "unresolved"),
            (smoke.Observation(), smoke.Observation(snapshot_generations=["g2"]), "unresolved"),
            (smoke.Observation(orphan_candidates=[{"pid": 345, "start_id": "ps:T1"}],
                               pid_starts={345: None}),
             smoke.Observation(orphan_candidates=[{"pid": 345, "start_id": "ps:T1"}],
                               pid_starts={345: None}), "stopped"),
            (smoke.Observation(orphan_candidates=[{"pid": 345, "start_id": "ps:T1"}],
                               pid_starts={345: "T1"}),
             smoke.Observation(orphan_candidates=[{"pid": 345, "start_id": "ps:T1"}],
                               pid_starts={345: None}), "unresolved"),
            (smoke.Observation(orphan_candidates=[{"pid": 345, "start_id": "ps:T1"}],
                               pid_starts={345: None}),
             smoke.Observation(orphan_candidates=[{"pid": 345, "start_id": "ps:T1"}],
                               pid_starts={345: "T2"}), "unresolved"),
            (smoke.Observation(orphan_candidates=[{"pid": 345, "start_id": "ps:T1"}],
                               pid_starts={345: None}),
             smoke.Observation(orphan_candidates=[{"pid": 345, "start_id": "ps:T1"}],
                               pid_starts={345: "T1"}), "unresolved"),
            (smoke.Observation(), smoke.Observation(orphan_candidates=[{"pid": 345, "start_id": "ps:T1"}],
                                                   pid_starts={345: None}), "unresolved"),
            (smoke.Observation(), smoke.Observation(descriptors=[{"path": "new", "pid": 234}],
                                                   pid_starts={234: None}), "unresolved"),
            (smoke.Observation(orphan_candidates=[{"pid": 345, "start_id": None}],
                               pid_starts={345: None}),
             smoke.Observation(orphan_candidates=[{"pid": 345, "start_id": None}],
                               pid_starts={345: None}), "unresolved"),
        ):
            with self.subTest(expected=expected, first=first.record()):
                (self.root / "scratch-smoke-report.json").unlink(missing_ok=True)
                (self.root / "project").rmdir() if (self.root / "project").exists() else None
                report, runner = self.run_fake([smoke.Observation(), self.active(), first, second],
                                               start=self.good_start(), pid_values={123: None})
                self.assertEqual(report["status"], expected)
                self.assertEqual(len(runner.commands), 2)
                self.assert_replay_nonmutating(runner)

    def test_c2_uncertain_start_generation_does_not_admit_shutdown(self):
        report, runner = self.run_fake([smoke.Observation(), smoke.Observation(snapshot_generations=["g1"])],
                                       start=smoke.CommandResult(None, timed_out=True))
        self.assertEqual(report["status"], "unresolved_ownership")
        self.assertEqual(len(runner.commands), 1)
        self.assert_replay_nonmutating(runner)

    def test_c2_real_journal_latest_record_pid_scan_and_partial_failure(self):
        directory = smoke.default_descriptor_dir(self.root, self.socket)
        directory.mkdir(parents=True)
        descriptor = {"version": 2, "workerId": "w1", "pid": 234, "processStartId": "ps:old",
                      "socketPath": str(self.root / "tmp" / f"prime-agent-{os.getuid()}" /
                                        f"worker-{directory.name}-w1.sock"),
                      "recoveryJournalPath": str(directory / "w1.recovery.jsonl"),
                      "orphanProcessJournalPath": str(directory / "w1.orphans.jsonl"),
                      "supervisorSocketPath": str(self.socket), "authenticationToken": "secret-worker",
                      "rootActiveSessionId": "r1", "createdAt": "time", "updatedAt": "time",
                      "lifecycle": "ready", "createCommand": {"type": "create"},
                      "consecutiveFailures": 0}
        (directory / "w1.json").write_text(json.dumps(descriptor))
        journal = directory / "w1.orphans.jsonl"
        def row(pid, active, start="ps:Fri Jan  1 00:00:00 2027"):
            return json.dumps({"version": 1, "pid": pid, "ownerPid": 234,
                               "active": active, "processStartId": start, "recordedAt": "time"}) + "\n"
        journal.write_text(row(345, True) + row(345, False) + row(346, True))
        class OSRunner(FakeOSNativeRunner):
            def command(self, argv, timeout):
                self.commands.append(tuple(argv))
                if argv[1:] == ["daemon", "ps", "--json"]: return smoke.CommandResult(0, "[]")
                if argv[0] == "/usr/sbin/lsof": return smoke.CommandResult(1)
                if argv[0] == "/bin/ps":
                    return smoke.CommandResult(0, "Fri Jan  1 00:00:00 2027\n") if argv[2] == str(os.getpid()) else smoke.CommandResult(1)
                raise AssertionError("unexpected native call")
        runner = OSRunner(self.cli, [])
        observed = runner.observe(self.root, self.cli)
        self.assertTrue(observed.valid, observed.reason)
        self.assertEqual(observed.orphan_candidates, [{"pid": 346, "start_id": "ps:Fri Jan  1 00:00:00 2027"}])
        self.assertEqual({int(v[2]) for v in runner.commands if v[0] == "/bin/ps"}, {os.getpid(), 234, 346})
        self.assertTrue(smoke.snapshot_quiet(observed))
        self.assertNotIn("secret-worker", json.dumps(observed.record()))
        journal.write_text(row(346, True) + "{truncated")
        partial = OSRunner(self.cli, []).observe(self.root, self.cli)
        self.assertFalse(partial.valid)
        self.assertEqual(partial.orphan_candidates, [{"pid": 346, "start_id": "ps:Fri Jan  1 00:00:00 2027"}])
        self.assertFalse(smoke.snapshot_quiet(partial))

    def test_c2_full_filesystem_postflight_checks_new_orphan_twice(self):
        test = self
        class Runner(FakeOSNativeRunner):
            def __init__(self):
                super().__init__(test.cli, [])
                self.live = False
                self.post = 0
                self.orphan_checks = []
            def command(self, argv, timeout):
                self.commands.append(tuple(argv))
                if tuple(argv[1:3]) == ("daemon", "start"):
                    test.owner_fixture()
                    self.live = True
                    return test.good_start()
                if tuple(argv[1:3]) == ("shutdown", "--force"):
                    self.live = False
                    owner = test.root / "home" / ".prime" / "supervisor-owners" / "g1.owner"
                    (owner / "owner.json").unlink()
                    (owner / "scope.json").unlink()
                    directory = smoke.default_descriptor_dir(test.root, test.socket)
                    descriptor = {"version": 2, "workerId": "w1", "pid": 234,
                                  "processStartId": "ps:old", "socketPath": str(test.root / "tmp" /
                                      f"prime-agent-{os.getuid()}" / f"worker-{directory.name}-w1.sock"),
                                  "recoveryJournalPath": str(directory / "w1.recovery.jsonl"),
                                  "orphanProcessJournalPath": str(directory / "w1.orphans.jsonl"),
                                  "supervisorSocketPath": str(test.socket), "authenticationToken": "secret",
                                  "rootActiveSessionId": "r1", "createdAt": "time", "updatedAt": "time",
                                  "lifecycle": "ready", "createCommand": {"type": "create"},
                                  "consecutiveFailures": 0}
                    (directory / "w1.json").write_text(json.dumps(descriptor))
                    (directory / "w1.orphans.jsonl").write_text(json.dumps({
                        "version": 1, "pid": 345, "ownerPid": 234, "processStartId": "ps:Fri Jan  1 00:00:00 2027",
                        "active": True, "recordedAt": "time"}) + "\n")
                    return smoke.CommandResult(0, '{"stopped":[],"failed":[]}')
                if tuple(argv[1:]) == ("daemon", "ps", "--json"):
                    self.post += not self.live and (test.root / "project").exists()
                    rows = ([{"socketPath": str(test.socket), "pid": 123, "status": "current",
                              "isDefault": True, "sessionCount": 0, "hasTrackedWorkers": False}]
                            if self.live else [])
                    return smoke.CommandResult(0, json.dumps(rows))
                if argv[0] == "/usr/sbin/lsof":
                    return smoke.CommandResult(0, f"p123\nn{test.socket}\n") if self.live else smoke.CommandResult(1)
                if argv[0] == "/bin/ps":
                    pid = int(argv[2])
                    if pid == 345:
                        self.orphan_checks.append(self.post)
                    return (smoke.CommandResult(0, "Fri Jan  1 00:00:00 2027\n")
                            if pid == os.getpid() or pid == 123 and self.live else smoke.CommandResult(1))
                raise AssertionError("unexpected fake command")
            def quiet_interval(self): pass
        runner = Runner()
        report = smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertEqual(report["status"], "stopped")
        self.assertEqual(runner.orphan_checks, [1, 2])
        self.assertTrue(all(snap["orphan_candidates"] == [{"pid": 345, "start_id": "ps:Fri Jan  1 00:00:00 2027"}]
                            for snap in report["postflight"]))
        self.assertNotIn("secret", json.dumps(report))
        self.assert_replay_nonmutating(runner)

    def test_c3_legacy_and_command_journal_source_shapes(self):
        directory = smoke.default_descriptor_dir(self.root, self.socket)
        directory.mkdir(parents=True)
        path = directory / "command-journal.jsonl"
        key = json.dumps(["c", "id"], separators=(",", ":"))
        received = {"version": 1, "type": "received", "key": key, "clientId": "c",
                    "commandId": "id", "commandType": "shutdown", "recordedAt": "time"}
        response = {"type": "response", "command": "shutdown", "success": True, "data": {"token": "secret-data"}}
        result = {"version": 1, "type": "result", "key": key, "response": response, "recordedAt": "time"}
        ack = {"version": 1, "type": "acknowledged", "key": key, "recordedAt": "time"}
        for contents in ("\n", "".join(json.dumps(v) + "\n" for v in (received, result, ack)),
                         json.dumps({**result, "response": {"type": "response", "command": "shutdown",
                                                               "success": False, "error": "hidden"}}) + "\n"):
            path.write_text(contents)
            observed = FakeOSNativeRunner(self.cli, self.os_results()).observe(self.root, self.cli)
            self.assertTrue(observed.valid, observed.reason)
            self.assertTrue(smoke.snapshot_quiet(observed))
            self.assertNotIn("secret-data", json.dumps(observed.record()))
        for contents in ("", "\n\n", "{bad", json.dumps({**result, "response": {"type": "response"}}) + "\n",
                         json.dumps({**result, "response": {**response, "success": "yes"}}) + "\n",
                         json.dumps({**result, "response": {**response, "error": "bad"}}) + "\n",
                         json.dumps({**result, "response": {"type": "response", "command": "shutdown",
                                                                "success": False, "error": "hidden",
                                                                "errorInfo": {"code": "unknown"}}}) + "\n"):
            path.write_text(contents)
            observed = FakeOSNativeRunner(self.cli, self.os_results()).observe(self.root, self.cli)
            self.assertFalse(observed.valid)
            self.assertFalse(smoke.snapshot_quiet(observed))
        path.unlink()
        worker = {"version": 1, "workerId": "w1", "pid": 234, "processStartId": "ps:old",
                  "socketPath": str(self.root / "tmp" / f"prime-agent-{os.getuid()}" /
                                    f"worker-{directory.name}-w1.sock"),
                  "recoveryJournalPath": str(directory / "w1.recovery.jsonl"),
                  "supervisorSocketPath": str(self.socket), "authenticationToken": "secret-token",
                  "rootActiveSessionId": "r1", "createdAt": "time", "updatedAt": "time",
                  "lifecycle": "ready", "createCommand": {"type": "create", "config": {
                      "cwd": str(self.root / "project"), "agentDir": str(self.root / "config"),
                      "sessionDir": str(self.root / "sessions"), "telemetryDisabled": True,
                      "noTools": True, "models": ["x"], "autonomous": {"enabled": False}}},
                  "consecutiveFailures": 0}
        worker_path = directory / "w1.json"
        worker_path.write_text(json.dumps(worker))
        results = self.os_results(pid=smoke.CommandResult(1))
        results[-1] = (("/bin/ps", "-p", "234", "-o", "lstart="), smoke.CommandResult(1))
        valid = FakeOSNativeRunner(self.cli, results).observe(self.root, self.cli)
        self.assertTrue(valid.valid, valid.reason)
        for bad in ({"routing": {"socketPath": "/outside"}},
                    {"createCommand": {"type": "create", "config": {"noTools": "invalid"}}},
                    {"createCommand": {"type": "create", "config": {"telemetryDisabled": 7}}},
                    {"createCommand": {"type": "create", "config": {"unknown": 1}}}):
            worker_path.write_text(json.dumps({**worker, **bad}))
            observed = FakeOSNativeRunner(self.cli, self.os_results()).observe(self.root, self.cli)
            self.assertFalse(observed.valid)
            self.assertNotIn("secret-token", json.dumps(observed.record()))

    def test_c3_rejected_postflight_journal_blocks_full_smoke_and_replay(self):
        test = self
        class Runner(FakeRunner):
            def __init__(self):
                super().__init__(test.cli, [smoke.Observation(), test.active()], start=test.good_start())
                self.post = 0
            def observe(self, root, cli, required_pids=None):
                if self.observations:
                    return super().observe(root, cli, required_pids)
                self.post += 1
                if self.post == 1:
                    directory = smoke.default_descriptor_dir(root, test.socket)
                    directory.mkdir(parents=True)
                    (directory / "command-journal.jsonl").write_text(json.dumps({
                        "version": 1, "type": "result", "key": '["c","id"]',
                        "response": {"type": "response", "data": "secret-response"},
                        "recordedAt": "time"}) + "\n")
                return FakeOSNativeRunner(test.cli, test.os_results(pid=smoke.CommandResult(1))).observe(root, cli, required_pids)
        runner = Runner()
        report = smoke.smoke(self.env, self.cli, self.sha, runner, run_native=True)
        self.assertEqual(report["status"], "unresolved")
        self.assertEqual(len(runner.commands), 2)
        self.assertFalse(report["postflight"][0]["valid"])
        self.assertFalse(report["postflight"][1]["valid"])
        self.assertNotIn("secret-response", json.dumps(report))
        self.assert_replay_nonmutating(runner)

    def test_unmocked_subprocess_guard_regression(self):
        with self.assertRaisesRegex(AssertionError, "unmocked subprocess"):
            smoke.subprocess.Popen([str(self.cli)])


if __name__ == "__main__":
    unittest.main()
