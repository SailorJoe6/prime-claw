"""Tier-0 static contracts for the slim tier-1 image and driver."""
import re
import unittest
from pathlib import Path
REPO=Path(__file__).resolve().parent.parent
DOCKERFILE=REPO/"docker/test.Dockerfile"; DRIVER=REPO/"scripts/test-tier1.sh"

class TestTier1Dockerfile(unittest.TestCase):
    def test_exists_single_stage_ubuntu_2404(self):
        text=DOCKERFILE.read_text(); self.assertTrue(DOCKERFILE.is_file()); self.assertEqual(len([l for l in text.splitlines() if l.startswith("FROM ")]),1); self.assertIn("FROM ubuntu:24.04",text)
    def test_required_toolchain_and_native_installer_path(self):
        text=DOCKERFILE.read_text()
        for n in ("nodejs","python3","python3-pytest","procps",'ENV PATH="/root/.local/bin:${PATH}"'): self.assertIn(n,text)
    def test_build_context_has_no_repository_inputs(self):
        instructions="\n".join(l.strip() for l in DOCKERFILE.read_text().splitlines() if l.strip() and not l.lstrip().startswith("#"))
        self.assertIsNone(re.search(r"^(COPY|ADD)\b",instructions,re.M))
    def test_image_stays_slim(self):
        instructions="\n".join(l for l in DOCKERFILE.read_text().splitlines() if l.strip() and not l.lstrip().startswith("#")).lower()
        for banned in ("postgres","pgvector","gbrain","openshell","bun"): self.assertIsNone(re.search(rf"\b{banned}\b",instructions))

class TestTier1DriverStatic(unittest.TestCase):
        def test_real_contract_has_captured_identity_not_rm(self):
            text=DRIVER.read_text()
            self.assertNotIn("docker run --rm",text)
            self.assertIn('docker run -d --init --name "$NAME" --cidfile "$CIDFILE"',text)
            self.assertRegex(text, re.compile(
                r'BOUNDED_OUTPUT_POLICY=status bounded "\$REMOVE_TIMEOUT" '
                r'\\\s+docker rm -f "\$CONTAINER_ID"'))
            self.assertRegex(text, re.compile(
                r'BOUNDED_OUTPUT_POLICY=container-presence bounded '
                r'"\$FINAL_INSPECT_TIMEOUT" \\\s+docker inspect '
                r'"\$CONTAINER_ID"'))
