"""Host-safe integrity checks for the explicitly shipped YAML dependency."""
import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
VENDOR = REPO / "src/prime-agent-plugin/extension-support/vendor/yaml"
TOOL = REPO / "scripts/vendor-plugin-yaml"


def test_yaml_bundle_has_locked_provenance_and_license():
    record = json.loads((VENDOR / "provenance.json").read_text())
    lock = json.loads((TOOL / "package-lock.json").read_text())
    package = lock["packages"]["node_modules/yaml"]
    assert record["package"] == "yaml"
    assert record["version"] == package["version"] == "2.9.0"
    assert record["integrity"] == package["integrity"]
    assert record["tarball"] == package["resolved"]
    assert record["license"] == "ISC"
    assert record["bundlerVersion"] == lock["packages"]["node_modules/esbuild"]["version"] == "0.28.1"
    assert record["lockSha256"] == hashlib.sha256((TOOL / "package-lock.json").read_bytes()).hexdigest()
    assert record["bundleSha256"] == hashlib.sha256((VENDOR / "yaml.cjs").read_bytes()).hexdigest()
    assert record["licenseSha256"] == hashlib.sha256((VENDOR / "LICENSE").read_bytes()).hexdigest()
    assert "Copyright Eemeli Aro" in (VENDOR / "LICENSE").read_text()
    assert "Permission to use, copy, modify, and/or distribute" in (VENDOR / "LICENSE").read_text()
    # The bundle is package-self-contained; Node's own process/buffer remain
    # available in both supported runtime modes and retain YAML's warnings.
    assert record["runtimeImports"] == ["buffer", "process"]
    assert record["inputFileSha256"]
    assert all(path.startswith("node_modules/yaml/") and len(digest) == 64
               for path, digest in record["inputFileSha256"].items())


def test_yaml_bundle_uses_normal_exact_asset_delivery():
    inventory = json.loads((REPO / "src/prime-agent-plugin/asset-inventory.json").read_text())
    for name in ("yaml.cjs", "LICENSE", "provenance.json"):
        relative = "extension-support/vendor/yaml/" + name
        matches = [asset for asset in inventory["assets"] if asset["source"] == relative]
        assert len(matches) == 1
        assert matches[0]["targets"] == [{"class": "plugin-root-exact", "destination": relative}]
