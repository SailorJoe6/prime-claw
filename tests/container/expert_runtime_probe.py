#!/usr/bin/env python3
"""Container-native matrix for official EXPERT exact-interpreter preflight."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


def tree_hash(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*")):
        if path.is_file():
            digest.update(str(path.relative_to(root)).encode())
            digest.update(b"\0")
            digest.update(path.read_bytes())
    return digest.hexdigest()


def run(preflight: Path, skill: Path, env: dict[str, str]) -> tuple[int, dict]:
    result = subprocess.run(
        [sys.executable, str(preflight), str(skill)],
        env={**os.environ, **env},
        capture_output=True,
        text=True,
        check=False,
    )
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    assert len(lines) == 1, result.stdout + result.stderr
    return result.returncode, json.loads(lines[0])


def run_native(
    module: Path,
    plugin_root: Path,
    env: dict[str, str],
) -> dict:
    code = (
        "import {officialExpertPackageStatus} from "
        + json.dumps(module.as_uri())
        + ";console.log(JSON.stringify(officialExpertPackageStatus({}, {guideRoot:"
        + json.dumps(str(plugin_root))
        + "})));"
    )
    result = subprocess.run(
        ["node", "--experimental-strip-types", "--input-type=module", "-e", code],
        env={**os.environ, **env},
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    assert result.returncode == 0 and len(lines) == 1, result.stdout + result.stderr
    return json.loads(lines[0])


def assert_parity(script: dict, native: dict) -> None:
    assert native["status"] == script["status"], (script, native)
    assert native["mode"] == script["mode"], (script, native)
    assert native.get("reason") == script.get("reason"), (script, native)
    assert native.get("expectedPackageSha256") == script.get("expectedPackageSha256"), (script, native)
    assert native.get("packageSha256") == script.get("packageSha256"), (script, native)


def make_venv(path: Path) -> Path:
    subprocess.run(
        [sys.executable, "-m", "venv", "--without-pip", str(path)],
        check=True,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
    )
    return path / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def purelib(python: Path) -> Path:
    result = subprocess.run(
        [str(python), "-I", "-c", "import sysconfig;print(sysconfig.get_path('purelib'))"],
        check=True,
        capture_output=True,
        text=True,
    )
    return Path(result.stdout.strip())


def main() -> int:
    preflight = Path(sys.argv[1]).resolve()
    source_skill = Path(sys.argv[2]).resolve()
    work = Path(sys.argv[3]).resolve()
    native_module = Path(sys.argv[4]).resolve()
    plugin_root = source_skill.parents[1]
    work.mkdir(parents=True)
    before = tree_hash(source_skill)

    managed_venv = work / "managed"
    managed_python = make_venv(managed_venv)
    managed_env = {"PRIME_AGENT_KERNEL_VENV": str(managed_venv), "PRIME_AGENT_KERNEL_PYTHON": ""}
    code, managed = run(preflight, source_skill, managed_env)
    assert_parity(managed, run_native(native_module, plugin_root, managed_env))
    assert code == 0 and managed["status"] == "SYNC_PENDING", managed
    assert managed["mode"] == "managed"
    assert managed["interpreter"] == str(managed_python)

    missing_python = work / "missing-python"
    missing_env = {"PRIME_AGENT_KERNEL_PYTHON": str(missing_python)}
    code, missing = run(preflight, source_skill, missing_env)
    assert_parity(missing, run_native(native_module, plugin_root, missing_env))
    assert code == 1 and missing["status"] == "UNAVAILABLE", missing
    assert missing["reason"] == "interpreter_missing"

    configured_venv = work / "configured"
    configured_python = make_venv(configured_venv)
    configured_env = {
        "PRIME_AGENT_KERNEL_PYTHON": str(configured_python),
        "PRIME_AGENT_KERNEL_VENV": str(work / "ignored"),
    }
    code, absent = run(preflight, source_skill, configured_env)
    assert_parity(absent, run_native(native_module, plugin_root, configured_env))
    assert code == 1 and absent["status"] == "UNAVAILABLE", absent
    assert absent["mode"] == "configured"
    assert absent["reason"] == "package_import_failed"

    installed = purelib(configured_python) / "prime_claw_official_expert_review"
    shutil.copytree(source_skill / "src/prime_claw_official_expert_review", installed)
    sentinel = work / "rlm-imported"
    (purelib(configured_python) / "rlm.py").write_text(
        "from pathlib import Path\nPath(" + repr(str(sentinel)) + ").write_text('imported')\n"
    )
    code, available = run(preflight, source_skill, configured_env)
    assert_parity(available, run_native(native_module, plugin_root, configured_env))
    assert code == 0 and available["status"] == "AVAILABLE", available
    assert available["packageSha256"] == available["expectedPackageSha256"]
    assert not sentinel.exists()

    init = installed / "__init__.py"
    init.write_text(init.read_text() + "\n# stale installed package\n")
    code, stale = run(preflight, source_skill, configured_env)
    assert_parity(stale, run_native(native_module, plugin_root, configured_env))
    assert code == 1 and stale["status"] == "UNAVAILABLE", stale
    assert stale["reason"] == "package_hash_mismatch"

    shutil.rmtree(installed)
    shutil.copytree(source_skill / "src/prime_claw_official_expert_review", installed)
    (installed / "reviewer.md").write_text("stale reviewer\n")
    code, mismatched = run(preflight, source_skill, configured_env)
    assert_parity(mismatched, run_native(native_module, plugin_root, configured_env))
    assert code == 1 and mismatched["status"] == "UNAVAILABLE", mismatched
    assert mismatched["reason"] == "package_hash_mismatch"

    bad_plugin = work / "bad-plugin"
    bad_skill = bad_plugin / "skills" / source_skill.name
    shutil.copytree(source_skill, bad_skill)
    (bad_skill / "src/prime_claw_official_expert_review/reviewer.md").write_text("bad source\n")
    code, invalid_source = run(preflight, bad_skill, managed_env)
    assert_parity(invalid_source, run_native(native_module, bad_plugin, managed_env))
    assert code == 1 and invalid_source["status"] == "UNAVAILABLE", invalid_source
    assert invalid_source["reason"] == "source_import_failed"

    assert tree_hash(source_skill) == before
    print(json.dumps({"ok": True, "managed": managed["status"], "configured": available["status"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
