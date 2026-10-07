#!/usr/bin/env python3
"""Read-only exact-interpreter preflight for the managed EXPERT package."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
from typing import Any

IMPORT_NAME = "prime_claw_official_expert_review"
PACKAGE_FILES = ("__init__.py", "reviewer.md")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def package_hash(package_dir: Path) -> str:
    manifest: dict[str, str] = {}
    for name in PACKAGE_FILES:
        path = package_dir / name
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"source package asset is not a regular file: {name}")
        manifest[name] = digest(path.read_bytes())
    encoded = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
    return digest(encoded)


def kernel_python() -> tuple[str, Path]:
    configured = os.environ.get("PRIME_AGENT_KERNEL_PYTHON")
    if configured:
        # Match Prime Agent's lexical path.resolve behavior without dereferencing
        # a virtualenv's executable symlink and thereby losing pyvenv.cfg.
        return "configured", Path(os.path.abspath(os.path.expanduser(configured)))
    configured_venv = os.environ.get("PRIME_AGENT_KERNEL_VENV")
    if configured_venv:
        venv = Path(os.path.abspath(os.path.expanduser(configured_venv)))
    else:
        home = Path.home()
        primary = home / ".prime" / "agent" / "kernel-venv"
        data_home = Path(os.environ.get("XDG_DATA_HOME", home / ".local" / "share"))
        fallback = data_home / "prime" / "agent" / "kernel-venv"
        executable = Path("Scripts/python.exe" if os.name == "nt" else "bin/python")
        venv = fallback if not (primary / executable).is_file() and (fallback / executable).is_file() else primary
    return "managed", venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def probe_environment() -> dict[str, str]:
    environment = dict(os.environ)
    environment.pop("PYTHONPATH", None)
    environment["PYTHONNOUSERSITE"] = "1"
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    return environment


def run_probe(python: Path, *, source: Path | None, expected: str) -> dict[str, Any]:
    code = f'''import hashlib,importlib.util,json,pathlib
name={IMPORT_NAME!r}
expected={expected!r}
try:
 spec=importlib.util.find_spec(name)
 if spec is None or not spec.origin:
  raise ModuleNotFoundError(name)
 root=pathlib.Path(spec.origin).resolve().parent
 manifest={{item:hashlib.sha256((root/item).read_bytes()).hexdigest() for item in ("__init__.py","reviewer.md")}}
 package_hash=hashlib.sha256(json.dumps(manifest,sort_keys=True,separators=(",",":")).encode()).hexdigest()
 if package_hash != expected:
  print(json.dumps({{"probe":"UNAVAILABLE","reason":"package_hash_mismatch"}},sort_keys=True))
 else:
  package=__import__(name)
  value=package.describe()
  value["origin"]=package.__file__
  print(json.dumps({{"probe":"OK","value":value}},sort_keys=True))
except ModuleNotFoundError:
 print(json.dumps({{"probe":"UNAVAILABLE","reason":"package_import_failed"}},sort_keys=True))
except Exception:
 print(json.dumps({{"probe":"UNAVAILABLE","reason":"package_validation_failed"}},sort_keys=True))
'''
    command = [str(python)]
    if source is None:
        command.append("-I")
    command.extend(["-c", code])
    try:
        result = subprocess.run(
            command,
            cwd=None if source is None else source,
            env=probe_environment(),
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return {"probe": "UNAVAILABLE", "reason": "interpreter_failed"}
    if result.returncode != 0:
        return {"probe": "UNAVAILABLE", "reason": "interpreter_failed"}
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    if len(lines) != 1:
        return {"probe": "UNAVAILABLE", "reason": "invalid_probe_output"}
    try:
        value = json.loads(lines[0])
    except json.JSONDecodeError:
        return {"probe": "UNAVAILABLE", "reason": "invalid_probe_output"}
    if not isinstance(value, dict) or value.get("probe") not in {"OK", "UNAVAILABLE"}:
        return {"probe": "UNAVAILABLE", "reason": "invalid_probe_output"}
    return value




def valid_description(value: Any, expected: str) -> bool:
    reviewer = value.get("reviewer") if isinstance(value, dict) else None
    return (
        isinstance(value, dict)
        and value.get("schemaVersion") == 1
        and value.get("capability") == "private-launch-and-first-call-admission"
        and value.get("authority") is False
        and value.get("module") == IMPORT_NAME
        and value.get("packageSha256") == expected
        and isinstance(reviewer, dict)
        and reviewer == {
            "name": "expert-reviewer",
            "model": "openai-codex/gpt-6-astra",
            "thinking": "max",
        }
    )

def unavailable(mode: str, python: Path, expected: str, reason: str) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "status": "UNAVAILABLE",
        "mode": mode,
        "interpreter": str(python),
        "expectedPackageSha256": expected,
        "reason": reason,
    }


def preflight(skill_root: Path) -> dict[str, Any]:
    package_dir = skill_root / "src" / IMPORT_NAME
    expected = package_hash(package_dir)
    mode, python = kernel_python()
    if not python.is_file():
        return unavailable(mode, python, expected, "interpreter_missing")

    installed = run_probe(python, source=None, expected=expected)
    if installed.get("probe") == "OK":
        value = installed.get("value")
        if valid_description(value, expected):
            return {
                "schemaVersion": 1,
                "status": "AVAILABLE",
                "mode": mode,
                "interpreter": str(python),
                "expectedPackageSha256": expected,
                "packageSha256": expected,
            }
        installed_reason = "package_hash_mismatch"
    else:
        installed_reason = str(installed.get("reason", "package_import_failed"))

    if mode == "configured":
        return unavailable(mode, python, expected, installed_reason)

    source = run_probe(python, source=skill_root / "src", expected=expected)
    if source.get("probe") != "OK":
        return unavailable(mode, python, expected, "source_import_failed")
    value = source.get("value")
    expected_origin = (package_dir / "__init__.py").resolve()
    if (
        not valid_description(value, expected)
        or Path(str(value.get("origin", ""))).resolve() != expected_origin
    ):
        return unavailable(mode, python, expected, "source_hash_mismatch")
    return {
        "schemaVersion": 1,
        "status": "SYNC_PENDING",
        "mode": mode,
        "interpreter": str(python),
        "expectedPackageSha256": expected,
        "installedReason": installed_reason,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("skill_root", type=Path)
    args = parser.parse_args()
    try:
        result = preflight(args.skill_root.resolve())
    except (OSError, ValueError) as error:
        result = {
            "schemaVersion": 1,
            "status": "UNAVAILABLE",
            "mode": "source",
            "reason": str(error),
        }
    print(json.dumps(result, sort_keys=True))
    return 0 if result.get("status") in {"AVAILABLE", "SYNC_PENDING"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
