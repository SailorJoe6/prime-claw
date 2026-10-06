"""Unit-env body: post-preflight launcher exec failure and replay."""
from __future__ import annotations

from unit_env_entry import require_unit_env
require_unit_env()

import json
import tempfile
import unittest
from pathlib import Path

from scripts.testing import provenance
from unit_env_tier1_driver_body import DriverHarness, IMAGE_ID


class TestPublicStandaloneLaunchError(unittest.TestCase):
    @staticmethod
    def _instrument_scratch_bounded(harness: DriverHarness) -> None:
        """Inject one deterministic exec fault plus a typed-result observer."""
        path = harness.repo / "scripts/testing/bounded.py"
        source = path.read_text()
        exec_marker = "        os.execvp(argv[0], argv)\n"
        exec_fault = """        if (os.environ.get("FAKE_BOUNDED_EXEC_FAULT") == "1"
                and argv[:2] == ["docker", "build"]):
            raise OSError("synthetic post-preflight exec failure")
        os.execvp(argv[0], argv)
"""
        self_marker = "    _write_status(status_file, result)\n"
        observer = """    _write_status(status_file, result)
    audit_path = os.environ.get("FAKE_BOUNDED_AUDIT")
    if audit_path:
        with open(audit_path, "a", encoding="utf-8") as audit:
            print(json.dumps({"args": result.args,
                              "outcome": result.outcome,
                              "returncode": result.returncode,
                              "signal": result.signal},
                             sort_keys=True, separators=(",", ":")),
                  file=audit)
"""
        if source.count(exec_marker) != 1 or source.count(self_marker) != 1:
            raise AssertionError("scratch bounded instrumentation marker changed")
        path.write_text(source.replace(exec_marker, exec_fault, 1)
                              .replace(self_marker, observer, 1))

    def test_post_preflight_launch_error_cleans_and_fresh_replay_passes(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            harness = DriverHarness(root / "harness")
            self._instrument_scratch_bounded(harness)
            audit_path = root / "bounded-audit.jsonl"
            controls = {
                "FAKE_USE_REAL_BOUNDED": "1",
                "PRIME_CLAW_TIER1_INNER": "0",
                "FAKE_BOUNDED_AUDIT": str(audit_path),
            }

            failed = harness.run(
                "--smoke",
                env=harness.env(None, **controls,
                                FAKE_BOUNDED_EXEC_FAULT="1"),
            )
            self.assertEqual(failed.returncode, 127,
                             (failed.stdout, failed.stderr))
            self.assertNotIn("checks complete", failed.stdout)
            self.assertNotIn("driver: OK", failed.stdout)
            self.assertEqual(harness.calls(), [["info"]])

            audit = [json.loads(line)
                     for line in audit_path.read_text().splitlines()]
            docker_rows = [row for row in audit
                           if row["args"] and row["args"][0] == "docker"]
            self.assertEqual(
                [(row["args"][:2], row["outcome"], row["returncode"],
                  row["signal"]) for row in docker_rows],
                [(["docker", "info"], "exited", 0, None),
                 (["docker", "build"], "launch_error", 127, None)],
            )

            manifests = list((harness.tmp / "results").glob(
                "*/tier1/manifest.json"))
            self.assertEqual(len(manifests), 1)
            failed_path = manifests[0]
            failed_bytes = failed_path.read_bytes()
            manifest = json.loads(failed_bytes)
            provenance.validate_manifest(manifest)
            self.assertEqual(manifest["run"]["status"], "failed")
            self.assertEqual(manifest["run"]["failure_codes"],
                             ["primary-command-failed"])
            self.assertIsNone(manifest["image"])
            self.assertEqual(
                manifest["network"],
                {"disconnected_at": None, "verified_absent": False},
            )
            self.assertEqual(set(manifest["teardown"]),
                             {"state", "verified_at", "remove_outcome",
                              "inspect_outcome", "clean"})
            self.assertEqual(manifest["teardown"]["state"], "absent")
            self.assertEqual(manifest["teardown"]["remove_outcome"],
                             "not_needed")
            self.assertEqual(manifest["teardown"]["inspect_outcome"],
                             "not_needed")
            self.assertTrue(manifest["teardown"]["clean"])
            self.assertIsNotNone(manifest["teardown"]["verified_at"])

            tier = failed_path.parent
            run_id = tier.parent.name
            self.assertFalse((tier / "share").exists())
            self.assertFalse((harness.tmp / "results" / ".workspaces" /
                              run_id).exists())
            for relative in ("image.iid", "container.cid", "image.json",
                             "network.json"):
                self.assertFalse((tier / relative).exists(), relative)
            self.assertEqual(
                (tier / "setup.log").read_text().splitlines(),
                ["phase=run-allocated", "phase=image-build-started"],
            )

            call_offset = len(harness.calls())
            replay = harness.run("--smoke", env=harness.env(None, **controls))
            self.assertEqual(replay.returncode, 0,
                             (replay.stdout, replay.stderr))
            self.assertIn("driver: OK", replay.stdout)
            self.assertEqual(failed_path.read_bytes(), failed_bytes)
            replay_calls = harness.calls()[call_offset:]
            self.assertEqual(replay_calls[0], ["info"])
            self.assertTrue(any(call[:1] == ["build"]
                                for call in replay_calls))
            self.assertTrue(any(call[:1] == ["run"]
                                for call in replay_calls))
            self.assertTrue(any(call[:1] == ["rm"]
                                for call in replay_calls))

            manifests = list((harness.tmp / "results").glob(
                "*/tier1/manifest.json"))
            self.assertEqual(len(manifests), 2)
            by_status = {json.loads(path.read_text())["run"]["status"]: path
                         for path in manifests}
            self.assertEqual(set(by_status), {"failed", "passed"})
            passed = json.loads(by_status["passed"].read_text())
            provenance.validate_manifest(passed)
            self.assertEqual(passed["image"]["id"], IMAGE_ID)
            self.assertEqual(passed["teardown"]["state"], "absent")
            self.assertTrue(passed["teardown"]["clean"])

            audit = [json.loads(line)
                     for line in audit_path.read_text().splitlines()]
            build_outcomes = [row["outcome"] for row in audit
                              if row["args"][:2] == ["docker", "build"]]
            self.assertEqual(build_outcomes, ["launch_error", "exited"])


if __name__ == "__main__":
    unittest.main()
