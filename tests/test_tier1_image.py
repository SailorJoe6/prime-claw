"""Static and informational-path coverage for the slim tier-1 image."""
from __future__ import annotations
import os, re, stat, subprocess, tempfile, unittest
from pathlib import Path
REPO=Path(__file__).resolve().parent.parent
DOCKERFILE=REPO/"docker/test.Dockerfile"; DRIVER=REPO/"scripts/test-tier1.sh"

class TestTier1Dockerfile(unittest.TestCase):
    def test_exists_single_stage_ubuntu_2404(self):
        text=DOCKERFILE.read_text(); self.assertTrue(DOCKERFILE.is_file()); self.assertEqual(len([l for l in text.splitlines() if l.startswith("FROM ")]),1); self.assertIn("FROM ubuntu:24.04",text)
    def test_required_toolchain_and_native_installer_path(self):
        text=DOCKERFILE.read_text()
        for n in ("nodejs","python3","python3-pytest",'ENV PATH="/root/.local/bin:${PATH}"'): self.assertIn(n,text)
    def test_build_context_has_no_repository_inputs(self):
        instructions="\n".join(l.strip() for l in DOCKERFILE.read_text().splitlines() if l.strip() and not l.lstrip().startswith("#"))
        self.assertIsNone(re.search(r"^(COPY|ADD)\b",instructions,re.M))
    def test_image_stays_slim(self):
        instructions="\n".join(l for l in DOCKERFILE.read_text().splitlines() if l.strip() and not l.lstrip().startswith("#")).lower()
        for banned in ("postgres","pgvector","gbrain","openshell","bun"): self.assertIsNone(re.search(rf"\b{banned}\b",instructions))

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
    def test_real_contract_has_captured_identity_not_rm(self):
        text=DRIVER.read_text(); self.assertNotIn("docker run --rm",text); self.assertIn('docker run -d --name "$NAME" --cidfile "$CIDFILE"',text); self.assertIn('["docker", "rm", "-f", cid]',text); self.assertIn('["docker", "inspect", cid]',text)
    def test_real_run_fails_fast_without_docker_cli(self):
        with tempfile.TemporaryDirectory() as td:
            env=dict(os.environ); env["PATH"]="/usr/bin:/bin"; env["TIER1_RESULTS_ROOT"]=str(Path(td)/"results")
            out=subprocess.run([str(DRIVER),"--smoke"],capture_output=True,text=True,env=env)
            self.assertNotEqual(out.returncode,0); self.assertIn("docker not found",out.stderr)
    def test_real_run_fails_fast_with_unreachable_daemon(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); docker=tmp/"docker"; docker.write_text('#!/bin/sh\n[ "$1" = info ] && exit 1\nexit 0\n'); docker.chmod(0o755)
            env=dict(os.environ); env["PATH"]=os.pathsep.join([str(tmp),"/usr/bin","/bin"]); env["TIER1_RESULTS_ROOT"]=str(tmp/"results")
            out=subprocess.run([str(DRIVER),"--smoke"],capture_output=True,text=True,env=env)
            self.assertNotEqual(out.returncode,0); self.assertIn("daemon is not reachable",out.stderr)

    def test_unknown_argument_fails(self):
        self.assertNotEqual(subprocess.run([str(DRIVER),"--bogus"],capture_output=True).returncode,0)

if __name__=="__main__": unittest.main()
