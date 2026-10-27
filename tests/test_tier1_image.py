"""Tier-0 static contracts for the slim tier-1 image and driver."""
import re
import unittest
from pathlib import Path
REPO=Path(__file__).resolve().parent.parent
DOCKERFILE=REPO/"docker/test.Dockerfile"; DRIVER=REPO/"scripts/test-tier1.sh"

class TestTier1Dockerfile(unittest.TestCase):
    def test_exists_with_isolated_backlog_builder_and_ubuntu_2404_runtime(self):
        text=DOCKERFILE.read_text(); self.assertTrue(DOCKERFILE.is_file())
        self.assertEqual([l for l in text.splitlines() if l.startswith("FROM ")], [
            "FROM ubuntu:24.04 AS backlog_builder",
            "FROM ubuntu:24.04 AS tier1_runtime",
        ])
    def test_required_runtime_toolchain_and_native_provider_copy(self):
        text=DOCKERFILE.read_text()
        for n in ("nodejs","python3","python3-pytest","procps","COPY --from=backlog_builder /out/backlog /usr/local/bin/backlog"):
            self.assertIn(n,text)
    def test_build_context_has_no_repository_inputs(self):
        instructions="\n".join(l.strip() for l in DOCKERFILE.read_text().splitlines() if l.strip() and not l.lstrip().startswith("#"))
        self.assertIsNone(re.search(r"^ADD\b",instructions,re.M))
        copies=re.findall(r"^COPY\s+(.+)$",instructions,re.M)
        self.assertTrue(copies)
        self.assertTrue(all(value.startswith("--from=") for value in copies))
    def test_runtime_stage_stays_slim_and_does_not_retain_bun(self):
        text=DOCKERFILE.read_text()
        runtime=text.split("FROM ubuntu:24.04 AS tier1_runtime",1)[1]
        instructions="\n".join(l for l in runtime.splitlines() if l.strip() and not l.lstrip().startswith("#")).lower()
        for banned in ("postgres","pgvector","gbrain","openshell","bun"):
            self.assertIsNone(re.search(rf"\b{banned}\b",instructions))

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
