# Real-installable two-generation proof for the canonical source boundary.
from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

import pytest

from scripts.testing import provenance

REPO = Path(__file__).resolve().parents[1]
PROBE = "tests/container/test_source_generation_probe.py"


def _git(repo: Path, *args: str) -> None:
    subprocess.run(
        ["git", "-C", str(repo), *args], check=True,
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env={**os.environ, "GIT_OPTIONAL_LOCKS": "0"}, timeout=30)


def _source_mode_selected() -> bool:
    env_file = Path(os.environ.get("TIER1_ENV_FILE") or REPO / ".env")
    if not env_file.is_file():
        return False
    values = {}
    for line in env_file.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            values[key] = value.strip().strip("\\\"'")
    return bool(values.get("PRIME_AGENT_SOURCE")) and not values.get(
        "PRIME_AGENT_PINNED")


def _make_source_fixture(root: Path) -> Path:
    source = root / "source"
    (source / "scripts").mkdir(parents=True)
    (source / "packages/coding-agent").mkdir(parents=True)
    (source / ".gitignore").write_text(
        "node_modules/\n.fixture-pack/\npackages/*/dist/\n"
        "packages/coding-agent/release/\n")
    package = {
        "name": "prime-agent-source-fixture", "version": "0.9.8",
        "private": True, "scripts": {"build": "node scripts/build.mjs"},
    }
    (source / "package.json").write_text(json.dumps(package) + "\n")
    lock = {
        "name": package["name"], "version": package["version"],
        "lockfileVersion": 3, "requires": True,
        "packages": {"": {"name": package["name"],
                            "version": package["version"]}},
    }
    (source / "package-lock.json").write_text(json.dumps(lock) + "\n")
    (source / "generation.txt").write_text("A\n")
    (source / "scripts/build.mjs").write_text(r"""import fs from "node:fs";
import path from "node:path";
const generation = fs.readFileSync("generation.txt", "utf8").trim();
const extra = fs.existsSync("generation-extra.txt")
  ? fs.readFileSync("generation-extra.txt", "utf8").trim() : "none";
const output = path.join("packages", "coding-agent", "dist");
fs.mkdirSync(output, {recursive: true});
const behavior = `${generation}|${extra}`;
const script = `#!/usr/bin/env node
if (process.argv.includes("--version")) console.log("0.9.8");
else if (process.argv[2] === "fixture-generation") console.log(${JSON.stringify(behavior)});
else { console.error("unsupported fixture command"); process.exit(2); }
`;
const target = path.join(output, "prime-agent.js");
fs.writeFileSync(target, script, {mode: 0o755});
fs.chmodSync(target, 0o755);
""")
    (source / "scripts/pack-prime-agent-release.mjs").write_text(r"""import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
const index = process.argv.indexOf("--out-dir");
if (index < 0 || !process.argv[index + 1]) throw new Error("missing out dir");
const output = path.resolve(process.argv[index + 1]);
const artifacts = path.join(output, "artifacts");
fs.mkdirSync(artifacts, {recursive: true});
const staging = path.resolve(".fixture-pack");
fs.rmSync(staging, {recursive: true, force: true});
const names = ["prime-agent", "prime-agent-ai", "prime-agent-core", "prime-agent-tui"];
for (const name of names) {
  const directory = path.join(staging, name);
  fs.mkdirSync(directory, {recursive: true});
  const manifest = {name, version: "0.9.8"};
  if (name === "prime-agent") {
    manifest.bin = {"prime-agent": "bin/prime-agent.js"};
    fs.mkdirSync(path.join(directory, "bin"), {recursive: true});
    fs.copyFileSync("packages/coding-agent/dist/prime-agent.js",
                    path.join(directory, "bin/prime-agent.js"));
    fs.chmodSync(path.join(directory, "bin/prime-agent.js"), 0o755);
  } else {
    manifest.main = "index.js";
    fs.writeFileSync(path.join(directory, "index.js"), "export default {};\n");
  }
  fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify(manifest) + "\n");
  const packed = spawnSync("npm", ["pack", "--silent", "--pack-destination", artifacts],
                           {cwd: directory, encoding: "utf8"});
  if (packed.status !== 0) throw new Error("npm pack failed");
}
const files = names.map(name => `${name}-0.9.8.tgz`);
const sums = files.map(name => {
  const bytes = fs.readFileSync(path.join(artifacts, name));
  return `${crypto.createHash("sha256").update(bytes).digest("hex")}  ${name}`;
}).join("\n") + "\n";
fs.writeFileSync(path.join(artifacts, "SHA256SUMS"), sums);
fs.writeFileSync(path.join(artifacts, "stable"), "v0.9.8\n");
fs.writeFileSync(path.join(artifacts, "latest.json"), '{"version":"0.9.8"}\n');
""")
    _git(source, "init", "-q")
    _git(source, "config", "user.email", "fixture@example.invalid")
    _git(source, "config", "user.name", "Fixture")
    _git(source, "add", ".")
    _git(source, "commit", "-qm", "generation A")
    return source


def _run_generation(work_root: Path, evidence_dir: Path, source: Path,
                    label: str, expected: str,
                    save_artifact: Path | None = None):
    results = evidence_dir / f"results-{label.lower()}"
    capture = evidence_dir / f"capture-{label.lower()}.json"
    env_file = work_root / f"source-{label.lower()}.env"
    env_file.write_text(f"PRIME_AGENT_PINNED=\nPRIME_AGENT_SOURCE={source}\n")
    env = dict(os.environ)
    env.pop("PYTEST_ADDOPTS", None)
    env.pop("TIER1_KEEP_SHARE", None)
    env.update({
        "TIER1_ENV_FILE": str(env_file),
        "TIER1_RESULTS_ROOT": str(results),
        "PRIME_CLAW_EXPECTED_SOURCE_GENERATION": expected,
        "PRIME_CLAW_SOURCE_GENERATION_CAPTURE": str(capture),
    })
    if save_artifact is not None:
        env["PRIME_CLAW_SAVE_SOURCE_ARTIFACT"] = str(save_artifact)
    completed = subprocess.run(
        [sys.executable, "-m", "pytest", PROBE, "-q", "-m", "container"],
        cwd=REPO, env=env, capture_output=True, text=True, timeout=900)
    assert completed.returncode == 0, completed.stdout + completed.stderr
    value = json.loads(capture.read_text())
    manifest_path = results / value["run_id"] / "tier1" / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    provenance.validate_manifest(manifest)
    binding = provenance.owned_directory_binding(manifest_path.parent)
    with provenance.open_owned_directory(manifest_path.parent, binding) as owned:
        provenance.verify_evidence(owned, manifest)
    assert manifest["run"]["status"] == "passed"
    assert manifest["network"]["verified_absent"] is True
    assert manifest["teardown"]["state"] == "absent"
    assert manifest["teardown"]["clean"] is True
    assert value["builder_teardown"]["state"] == "absent"
    assert value["builder_teardown"]["clean"] is True
    assert value["source_inventory_before"] == value["source_inventory_after"]
    assert not (manifest_path.parent / "share").exists()
    return value, manifest, provenance.sha256_file(manifest_path)


@pytest.mark.container
def test_two_real_source_generations_install_changed_behavior_without_replay(tmp_path):
    if not _source_mode_selected():
        pytest.skip("real two-generation proof runs once with the source selector")
    source = _make_source_fixture(tmp_path)
    evidence_root = Path(
        os.environ.get("TIER1_RESULTS_ROOT") or REPO / ".test-results")
    _proof_id, evidence_dir, evidence_binding = provenance.allocate_run_tree(
        evidence_root, "source-generations")

    inventory_a = provenance.checkout_inventory(source)
    saved_a = tmp_path / "generation-a-prime-agent.tgz"
    generation_a, manifest_a, manifest_a_sha = _run_generation(
        tmp_path, evidence_dir, source, "A", "A|none", saved_a)
    assert provenance.checkout_inventory(source) == inventory_a
    assert saved_a.is_file()

    (source / "generation.txt").write_text("B\n")
    (source / "generation-extra.txt").write_text("extra-B\n")
    stale_release = source / "packages/coding-agent/release/tier1/artifacts"
    stale_release.mkdir(parents=True)
    shutil.copyfile(saved_a, stale_release / "prime-agent-0.9.8.tgz")
    stale_dist = source / "packages/coding-agent/dist"
    stale_dist.mkdir(parents=True)
    (stale_dist / "prime-agent.js").write_text("generation A stale output\n")
    inventory_b = provenance.checkout_inventory(source)

    generation_b, manifest_b, manifest_b_sha = _run_generation(
        tmp_path, evidence_dir, source, "B", "B|extra-B")
    assert provenance.checkout_inventory(source) == inventory_b

    assert generation_a["behavior"] == "A|none"
    assert generation_b["behavior"] == "B|extra-B"
    assert generation_a["run_id"] != generation_b["run_id"]
    assert generation_a["source"]["dirty"] is False
    assert generation_b["source"]["dirty"] is True
    assert generation_a["source"]["content_sha256"] != generation_b["source"]["content_sha256"]
    assert generation_a["release"]["output_inventory_sha256"] != generation_b["release"]["output_inventory_sha256"]
    assert generation_a["release"]["artifact_sha256"] != generation_b["release"]["artifact_sha256"]
    assert generation_a["installed"]["executable_sha256"] != generation_b["installed"]["executable_sha256"]
    assert generation_a["release"]["package_version"] == "0.9.8"
    assert generation_b["release"]["package_version"] == "0.9.8"
    assert manifest_a["prime_agent"]["source"] == generation_a["source"]
    assert manifest_b["prime_agent"]["source"] == generation_b["source"]
    summary = {
        "schema_version": 1,
        "contract": "source-two-generation-real-install-v1",
        "command": f"{sys.executable} -m pytest {PROBE} -q -m container",
        "generation_a": generation_a,
        "generation_b": generation_b,
        "manifest_sha256": {"a": manifest_a_sha, "b": manifest_b_sha},
        "stale_replay_refused": generation_b["behavior"] == "B|extra-B",
    }
    with provenance.open_owned_directory(
            evidence_dir, evidence_binding) as owned:
        provenance.write_sanitized_json(
            owned, "two-generation-summary.json", summary)
