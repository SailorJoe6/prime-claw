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
                                               "socketPath": str(self.root / "tmp" / "worker.sock"),
                                               "supervisorSocketPath": str(self.socket),
                                               "authenticationToken": secret, "workerId": "w1",
                                               "rootActiveSessionId": "r1", "createdAt": "time", "updatedAt": "time",
                                               "lifecycle": "running", "createCommand": {}, "consecutiveFailures": 0,
                                               "recoveryJournalPath": str(self.root / "config" / "journal.json")}))
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
        worker_socket = self.root / "tmp" / "worker.sock"
        descriptor = {"version": 2, "workerId": "w1", "pid": 123,
                      "processStartId": "ps:old", "socketPath": str(worker_socket),
                      "recoveryJournalPath": str(descriptor_dir / "w1.recovery.jsonl"),
                      "supervisorSocketPath": str(self.socket),
                      "authenticationToken": "hidden-worker-token", "rootActiveSessionId": "root1",
                      "createdAt": "time", "updatedAt": "time", "lifecycle": "stopped",
                      "createCommand": {}, "consecutiveFailures": 0}
        (descriptor_dir / "w1.json").write_text(json.dumps(descriptor))
        (descriptor_dir / "w1.recovery.jsonl").write_text("opaque-journal-token")
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

    def test_unmocked_subprocess_guard_regression(self):
        with self.assertRaisesRegex(AssertionError, "unmocked subprocess"):
            smoke.subprocess.Popen([str(self.cli)])


if __name__ == "__main__":
    unittest.main()
