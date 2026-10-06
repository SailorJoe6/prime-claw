"""Unit-env body: launcher and image-meta behavior without a Docker socket."""
from __future__ import annotations

from unit_env_entry import require_unit_env
require_unit_env()

import os, re, shutil, stat, subprocess, sys, tempfile, unittest
from pathlib import Path
REPO=Path(__file__).resolve().parent.parent
DOCKERFILE=REPO/"docker/test.Dockerfile"; DRIVER=REPO/"scripts/test-tier1.sh"

class TestTier1DriverSurface(unittest.TestCase):
    def test_executable_and_help(self):
        self.assertTrue(DRIVER.stat().st_mode & stat.S_IXUSR); out=subprocess.run([str(DRIVER),"--help"],capture_output=True,text=True); self.assertEqual(out.returncode,0,out.stderr); self.assertIn("--dry-run",out.stdout)
    def test_help_never_invokes_recording_docker(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); marker=tmp/"called"; docker=tmp/"docker"; docker.write_text(f'#!/bin/sh\ntouch "{marker}"\nexit 99\n'); docker.chmod(0o755)
            env=dict(os.environ); env["PATH"]=os.pathsep.join([str(tmp),"/usr/bin","/bin"])
            out=subprocess.run([str(DRIVER),"--help"],capture_output=True,text=True,env=env); self.assertEqual(out.returncode,0); self.assertFalse(marker.exists())

    def test_smoke_dry_run_is_docker_free(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); docker=tmp/"docker"; marker=tmp/"called"; docker.write_text(f'#!/bin/sh\ntouch "{marker}"\nexit 99\n'); docker.chmod(0o755)
            env=dict(os.environ); env["PATH"]=os.pathsep.join([str(tmp),"/usr/bin","/bin"])
            out=subprocess.run([str(DRIVER),"--smoke","--dry-run"],capture_output=True,text=True,env=env)
            self.assertEqual(out.returncode,0,out.stderr); self.assertFalse(marker.exists()); self.assertIn("--iidfile",out.stdout); self.assertIn("--cidfile",out.stdout)
    def test_real_run_fails_fast_without_docker_cli(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); isolated=tmp/"isolated-bin"; isolated.mkdir()
            for name, source in (("bash", shutil.which("bash", path="/bin:/usr/bin")),
                                 ("dirname", shutil.which("dirname")),
                                 ("python3", sys.executable)):
                self.assertTrue(source, f"missing prerequisite {name}")
                (isolated/name).symlink_to(source)
            poison_dir=tmp/"system-fallback"; poison_dir.mkdir()
            marker=tmp/"poison-docker-called"
            poison=poison_dir/"docker"
            poison.write_text(f'#!/bin/sh\ntouch "{marker}"\nexit 99\n')
            poison.chmod(0o755)
            isolated_path=str(isolated)
            self.assertIsNone(shutil.which("docker", path=isolated_path))
            env=dict(os.environ); env["PATH"]=isolated_path
            env["TIER1_RESULTS_ROOT"]=str(tmp/"results")
            out=subprocess.run(["/bin/bash",str(DRIVER),"--smoke"],
                               capture_output=True,text=True,env=env,timeout=10)
            self.assertNotEqual(out.returncode,0)
            self.assertIn("docker not found",out.stderr)
            self.assertFalse(marker.exists())
    def test_real_run_fails_fast_with_unreachable_daemon(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); docker=tmp/"docker"; docker.write_text('#!/bin/sh\n[ "$1" = info ] && exit 1\nexit 0\n'); docker.chmod(0o755)
            env=dict(os.environ); env["PATH"]=os.pathsep.join([str(tmp),"/usr/bin","/bin"]); env["TIER1_RESULTS_ROOT"]=str(tmp/"results")
            out=subprocess.run([str(DRIVER),"--smoke"],capture_output=True,text=True,env=env)
            self.assertNotEqual(out.returncode,0); self.assertIn("daemon is not reachable",out.stderr)

    def test_unknown_argument_fails(self):
        self.assertNotEqual(subprocess.run([str(DRIVER),"--bogus"],capture_output=True).returncode,0)

if __name__=="__main__": unittest.main()
