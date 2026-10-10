#!/usr/bin/env python3
"""Stage and check one exact Prime Claw plugin generation inside a Ready sandbox.

This is deliberately narrower than create/converge/validate. It never restarts
Prime Agent, touches the host-global plugin, or runs brain/index stages. The
operator must supervise the later full daemon/session cutover separately.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import shlex
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
HELPERS = (
    "apply-prime-agent-plugin.sh",
    "check-prime-agent-plugin.sh",
    "prime-agent-plugin-target.sh",
    "manage-prime-agent-global-assets.py",
    "cleanup-retired-prime-agent-expert-review.py",
    "manage-prime-agent-role-protocol.py",
)
DESTINATIONS = {"/sandbox/pgdata", "/sandbox/brain", "/sandbox/home-root"}
OPEN_SHELL_BIND_DESTINATIONS = {
    "/opt/openshell/bin/openshell-sandbox",
    "/etc/openshell/tls/client/ca.crt",
    "/etc/openshell/tls/client/tls.crt",
    "/etc/openshell/tls/client/tls.key",
    "/etc/openshell/auth/sandbox.jwt",
}


def bundle_bytes() -> tuple[bytes, tuple[str, ...]]:
    source = ROOT / "src/prime-agent-plugin"
    names = [str(p.relative_to(ROOT)) for p in source.rglob("*") if p.is_file()]
    names.extend("scripts/" + name for name in HELPERS)
    names = sorted(names)
    if len(names) < 30 or "src/prime-agent-plugin/role-protocol.json" not in names:
        raise ValueError("incomplete plugin source inventory")
    output = io.BytesIO()
    with gzip.GzipFile(fileobj=output, mode="wb", mtime=0, filename="") as zipped:
        with tarfile.open(fileobj=zipped, mode="w") as archive:
            for name in names:
                path = ROOT / name
                if path.is_symlink() or not path.is_file() or path.stat().st_size > 2_000_000:
                    raise ValueError("unsafe plugin bundle source: " + name)
                data = path.read_bytes()
                info = tarfile.TarInfo(name)
                info.size = len(data)
                info.mode = 0o755 if name.startswith("scripts/") else 0o644
                info.mtime = 0
                archive.addfile(info, io.BytesIO(data))
    return output.getvalue(), tuple(names)


def require_committed_bundle(names: tuple[str, ...]) -> None:
    branch = subprocess.run(["git", "-C", str(ROOT), "symbolic-ref", "--quiet", "--short", "HEAD"],
                            capture_output=True, text=True, timeout=30)
    if branch.returncode or branch.stdout.strip() != "main" or not (ROOT / ".git").is_dir():
        raise ValueError("sandbox plugin delivery requires the primary main checkout")
    paths = list(names) + ["scripts/deploy-prime-agent-plugin-sandbox.py"]
    tracked = subprocess.run(["git", "-C", str(ROOT), "ls-files", "--", *paths],
                             capture_output=True, text=True, timeout=30)
    changed = subprocess.run(["git", "-C", str(ROOT), "status", "--porcelain=v1",
                              "--untracked-files=all", "--", *paths],
                             capture_output=True, text=True, timeout=30)
    if (tracked.returncode or changed.returncode or changed.stdout.strip()
            or set(tracked.stdout.splitlines()) != set(paths)):
        raise ValueError("plugin bundle source and delivery script must be committed and clean")


def scoped_exec(runtime: dict, cfg: dict, script: str, timeout: int = 30) -> tuple[int, str]:
    """Never borrow the ambient gateway/workspace for an exact-sandbox action."""
    return runtime["run"]([runtime["OPENSHELL"], *runtime["openshell_scope"](cfg),
                           "sandbox", "exec", "-n", cfg["sandbox_name"],
                           "--timeout", str(timeout), "--no-tty", "--", "bash", "-lc", script],
                          timeout=timeout + 10)


def preflight(runtime: dict, cfg: dict, args: argparse.Namespace) -> None:
    if cfg.get("sandbox_name") != args.sandbox:
        raise ValueError("configured sandbox name disagrees with exact selected sandbox")
    if not isinstance(cfg.get("image"), str) or not cfg["image"].startswith("prime-claw-brain:pa098-ts-v2root-"):
        raise ValueError("sandbox plugin install requires the pinned TypeScript v2-root image")
    ready, _, record = runtime["probe_sandbox"](cfg)
    if ready is not True or not isinstance(record, dict) or record.get("phase") != "Ready" or record.get("id") != args.sandbox_id:
        raise ValueError("exact selected sandbox is not verified Ready")
    code, ids = runtime["run"](["docker", "ps", "--filter", "label=openshell.ai/sandbox-id=" + args.sandbox_id,
                                 "--format", "{{.ID}}"], timeout=30)
    containers = ids.splitlines() if code == 0 else []
    if len(containers) != 1:
        raise ValueError("exact sandbox Docker container not uniquely running")
    code, raw = runtime["run"](["docker", "inspect", containers[0]], timeout=30)
    data = json.loads(raw)[0] if code == 0 else None
    if not isinstance(data, dict):
        raise ValueError("Docker inspection failed")
    labels = data.get("Config", {}).get("Labels") or {}
    mounts = data.get("Mounts") or []
    actual = {(m.get("Name"), m.get("Destination"), m.get("RW")) for m in mounts if m.get("Type") == "volume"}
    expected = {(args.volume, dest, True) for dest in DESTINATIONS}
    binds = {(m.get("Destination"), m.get("RW")) for m in mounts if m.get("Type") == "bind"}
    expected_binds = {(dest, False) for dest in OPEN_SHELL_BIND_DESTINATIONS}
    if (data.get("Image") != args.image_id or data.get("Config", {}).get("Image") != args.image_id
            or not data.get("State", {}).get("Running") or labels.get("openshell.ai/sandbox-id") != args.sandbox_id
            or labels.get("openshell.ai/sandbox-name") != args.sandbox or actual != expected
            or binds != expected_binds or len(mounts) != len(expected) + len(expected_binds)):
        raise ValueError("image, labels, running state, or three working-volume mounts differ")
    code, image_id = runtime["run"](["docker", "image", "inspect", "--format", "{{.Id}}", cfg["image"]], timeout=30)
    if code != 0 or image_id.strip() != args.image_id:
        raise ValueError("image tag does not resolve to the exact accepted image ID")
    policy = record.get("policy") or {}
    actual_policy_sha = hashlib.sha256(json.dumps(policy, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    if actual_policy_sha != args.policy_sha256:
        raise ValueError("effective sandbox policy differs from the exact accepted policy digest")
    filesystem = policy.get("filesystem_policy") or {}
    if "/opt/prime-agent" not in filesystem.get("read_only", ()) or "/opt/prime-agent" in filesystem.get("read_write", ()):
        raise ValueError("effective policy does not preserve read-only Prime Agent source")
    code, out = scoped_exec(runtime, cfg, runtime["_prime_agent_source_gate_script"](), timeout=120)
    if code != 0 or "source_identity=" + runtime["PRIME_AGENT_SOURCE_TAG"] not in out:
        raise ValueError("image-owned Prime Agent source gate failed")
    home_probe = '''import os
from pathlib import Path
root=Path('/sandbox')
assert os.path.ismount(root/'home-root')
assert (root/'.prime').is_symlink() and os.readlink(root/'.prime')=='home-root/.prime'
assert (root/'.prime/agent').resolve()==root/'home-root/.prime/agent'
assert (root/'.agents/skills').is_dir() and not (root/'.agents').is_symlink()
assert not (root/'brain/.prime/agent/extensions').exists()
print('PLUGIN_HOME_READY')
'''
    code, out = scoped_exec(runtime, cfg, "HOME=/sandbox python3 -c " + shlex.quote(home_probe), timeout=30)
    if code != 0 or "PLUGIN_HOME_READY" not in out:
        raise ValueError("mounted home topology or project extension collision unverified")


EXTRACT_AND_RUN = '''import hashlib,os,pathlib,secrets,shutil,subprocess,sys,tarfile,tempfile
bundle, expected_sha, action, expected_names = sys.argv[1:]
raw=pathlib.Path(bundle).read_bytes()
if hashlib.sha256(raw).hexdigest()!=expected_sha:raise ValueError('bundle digest mismatch')
names=expected_names.split(',')
work=pathlib.Path(tempfile.mkdtemp(prefix='pc-plugin-',dir='/tmp'))
try:
 with tarfile.open(bundle,'r:gz') as archive:
  members=archive.getmembers()
  if [m.name for m in members]!=names:raise ValueError('unexpected bundle member inventory')
  for m in members:
   p=pathlib.PurePosixPath(m.name)
   if not m.isfile() or p.is_absolute() or '..' in p.parts or m.size>2000000:raise ValueError('unsafe bundle member')
   dest=work.joinpath(*p.parts);dest.parent.mkdir(parents=True,exist_ok=True)
   with archive.extractfile(m) as inp,open(dest,'xb') as out:shutil.copyfileobj(inp,out)
   dest.chmod(0o755 if m.name.startswith('scripts/') else 0o644)
 env=dict(os.environ,HOME='/sandbox');env.pop('PRIME_AGENT_PLUGIN_ROOT',None)
 script=work/'scripts'/('apply-prime-agent-plugin.sh' if action=='apply' else 'check-prime-agent-plugin.sh')
 command=[str(script),'--sandbox-home']
 if action=='apply':
  receipts=pathlib.Path('/sandbox/home-root/.prime-claw/plugin-role-receipts')
  receipts.mkdir(mode=0o700,parents=True,exist_ok=True)
  receipt=receipts/('role-'+expected_sha[:16]+'-'+secrets.token_hex(8)+'.json')
  command+=['--role-receipt',str(receipt)]
 result=subprocess.run(command,env=env,capture_output=True,text=True,timeout=180)
 if result.returncode:
  print('container plugin '+action+' failed: '+(result.stderr or result.stdout)[-600:],file=sys.stderr)
  if action=='apply':print('ROLE_RECEIPT_PATH='+str(receipt),file=sys.stderr)
  raise SystemExit(result.returncode)
 print('CONTAINER_PLUGIN_'+action.upper()+'_OK')
 if action=='apply':print('ROLE_RECEIPT_PATH='+str(receipt))
finally:
 shutil.rmtree(work)
'''


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sandbox", required=True)
    parser.add_argument("--sandbox-id", required=True)
    parser.add_argument("--image-id", required=True)
    parser.add_argument("--volume", required=True)
    parser.add_argument("--policy-sha256", required=True,
                        help="canonical SHA-256 of the accepted effective OpenShell policy")
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if len(args.policy_sha256) != 64 or any(c not in "0123456789abcdef" for c in args.policy_sha256):
        parser.error("--policy-sha256 requires a lowercase SHA-256 digest")
    runtime = runpy.run_path(str(ROOT / "bin/prime-claw"), run_name="prime_claw_plugin_deployer")
    cfg = runtime["load_config"](None)
    try:
        archive, names = bundle_bytes()
        sha = hashlib.sha256(archive).hexdigest()
        if args.dry_run:
            print("dry_run: exact selected sandbox/image/volume; upload audited bundle " + sha)
            print("dry_run: apply/check sandbox-home only; daemon restart is separate")
            return 0
        require_committed_bundle(names)
        preflight(runtime, cfg, args)
        # This upload goes only to the sandbox's private /tmp. No host-global
        # plugin path, real credential, or managed project extension path is used.
        with tempfile.TemporaryDirectory(prefix="prime-claw-plugin-bundle-") as temp:
            path = Path(temp) / "plugin.tar.gz"
            path.write_bytes(archive)
            remote = "/tmp/pc-plugin-" + sha + ".tar.gz"
            code, _ = runtime["run"]([runtime["OPENSHELL"], *runtime["openshell_scope"](cfg),
                                       "sandbox", "upload", args.sandbox, str(path), remote], timeout=180)
            if code != 0:
                raise ValueError("scoped sandbox bundle upload failed")
            action = "check" if args.check_only else "apply"
            command = "HOME=/sandbox python3 -c " + shlex.quote(EXTRACT_AND_RUN) + " " + " ".join(
                shlex.quote(x) for x in (remote, sha, action, ",".join(names)))
            code, out = scoped_exec(runtime, cfg, command, timeout=240)
            if code != 0 or "CONTAINER_PLUGIN_" + action.upper() + "_OK" not in out:
                raise ValueError("container plugin " + action + " failed: " + out[-500:])
        print("container plugin " + action + " checked: " + sha)
        for line in out.splitlines():
            if line.startswith("ROLE_RECEIPT_PATH="):
                print(line)
        if not args.check_only:
            print("restart the isolated Prime Agent daemon before claiming activation")
        return 0
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        print("error: container plugin deployment refused: " + str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
