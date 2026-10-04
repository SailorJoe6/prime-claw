"""Private child probe for the real two-generation source fixture."""
from __future__ import annotations

import json
import os
from pathlib import Path
import shutil

import pytest

from scripts.testing import provenance

pytestmark = pytest.mark.container


def test_installed_source_generation(tier1_container):
    expected = os.environ.get("PRIME_CLAW_EXPECTED_SOURCE_GENERATION")
    capture_raw = os.environ.get("PRIME_CLAW_SOURCE_GENERATION_CAPTURE")
    if not expected or not capture_raw:
        pytest.skip("two-generation source fixture child contract is inactive")
    capture = Path(capture_raw)
    if not capture.is_absolute():
        raise AssertionError("source-generation capture path must be absolute")

    result = tier1_container.run(
        tier1_container.prime_agent, "fixture-generation",
        wrap=False, timeout=30, workdir=None)
    assert result.returncode == 0, result.stderr
    behavior = result.stdout.strip()
    assert behavior == expected

    tier_dir = tier1_container.share.parent
    tier_binding = provenance.owned_directory_binding(tier_dir)
    with provenance.open_owned_directory(tier_dir, tier_binding) as owned:
        source_build = provenance.read_sanitized_json(
            owned, "source-build.json")
        teardown = provenance.source_builder_share_teardown(source_build)
        installed = provenance.read_sanitized_json(
            owned, "installed-artifact.json")
    release = source_build["release"]
    main = release["artifact"]
    main_path = tier1_container.share / "source-release" / main["path"]
    assert provenance.sha256_file(main_path) == main["content_sha256"]

    saved_raw = os.environ.get("PRIME_CLAW_SAVE_SOURCE_ARTIFACT")
    if saved_raw:
        saved = Path(saved_raw)
        if not saved.is_absolute():
            raise AssertionError("saved artifact path must be absolute")
        shutil.copyfile(main_path, saved)

    value = {
        "behavior": behavior,
        "builder_teardown": teardown,
        "installed": installed,
        "release": {
            "artifact_sha256": main["content_sha256"],
            "output_inventory_sha256": release["output_inventory_sha256"],
            "package_version": release["package_version"],
        },
        "run_id": tier_dir.parent.name,
        "source": source_build["source"],
        "source_inventory_before": source_build["checkout_inventory_before"],
        "source_inventory_after": source_build["checkout_inventory_after"],
    }
    capture.write_text(
        json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n")
