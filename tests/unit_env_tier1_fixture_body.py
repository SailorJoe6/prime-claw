"""Unit-env body: recording-fake coverage for the tier-1 session fixture."""
from __future__ import annotations

from unit_env_entry import require_unit_env
require_unit_env()

import hashlib, json, os, signal, subprocess, tempfile, textwrap, time, unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import conftest

IMAGE_ID="sha256:"+"a"*64; CID="c"*64

def cp(args,rc=0,out="",err="",outcome="exited",signum=None):
    return SimpleNamespace(args=args,returncode=rc,stdout=out,stderr=err,
                           outcome=outcome,signal=signum)

def build_image(tier, snapshot):
    binding = conftest.provenance.owned_directory_binding(tier)
    with conftest.provenance.open_owned_directory(tier, binding) as owned:
        return conftest._build_tier1_image(owned, tier, snapshot)


def source_builder_receipt(state="unknown", clean=False, remove_outcome=None):
    remove = (remove_outcome if remove_outcome is not None else
              "clean" if state in {"absent", "present"} else "ordinary_nonzero")
    inspect = "ordinary_nonzero" if state in {"absent", "unknown"} else "clean"
    inventory = {
        "content_sha256": "1" * 64, "entry_count": 1,
        "kind_counts": {"file": 1},
        "content_hash_contract": "framed-sha256-checkout-v1",
    }
    source = {
        "head": "b" * 40, "dirty": True, "status_sha256": "a" * 64,
        "content_sha256": "c" * 64, "entry_count": 1,
        "content_hash_contract": "framed-sha256-v2",
    }
    return {
        "schema_version": 1, "status": "failed",
        "started_at": "2026-10-04T00:00:00Z",
        "finished_at": "2026-10-04T00:00:01Z",
        "failure_codes": ["builder-failed"], "source": source,
        "source_rules": {
            "include": "git-cached-plus-nonignored-untracked-v1",
            "exclude": "git-standard-ignored-and-dotgit-v1",
        },
        "checkout_inventory_before": inventory,
        "checkout_inventory_after": inventory,
        "builder_image": {
            "id": IMAGE_ID, "repo_digests": [],
            "dockerfile": "docker/test-prime-agent-builder.Dockerfile",
            "dockerfile_sha256": "d" * 64,
            "declared_input_sha256": "e" * 64,
            "declared_input_hash_contract": "framed-sha256-v2",
            "informational_tag": "prime-claw-test-prime-agent-builder:eeeeeeeeeeee",
            "os": "linux", "architecture": "arm64",
            "build_started_at": "2026-10-04T00:00:00Z",
            "build_finished_at": "2026-10-04T00:00:01Z",
        },
        "builder_teardown": {
            "container_id": CID, "state": state,
            "remove_outcome": remove, "inspect_outcome": inspect,
            "clean": clean, "verified_at": "2026-10-04T00:00:01Z",
        },
        "release": None,
    }


class TestFixtureEnvironmentBehavior(unittest.TestCase):
    def test_sigterm_after_cid_during_exec_and_cleanup_publishes_failed_evidence(self):
        child_source=textwrap.dedent(r'''
            import json, os, signal, sys, time
            from pathlib import Path
            from types import SimpleNamespace
            from unittest import mock
            sys.path.insert(0, sys.argv[1])
            sys.path.insert(0, str(Path(sys.argv[1]) / "tests"))
            import conftest
            root=Path(sys.argv[2]); checkpoint=sys.argv[3]
            results=root/"results"; ready=root/"ready"; calls=root/"calls.log"
            envf=root/"pinned.env"; envf.write_text("PRIME_AGENT_PINNED=0.9.8\n")
            image={"id":"sha256:"+"a"*64,"repo_digests":[],"dockerfile":"docker/test.Dockerfile","dockerfile_sha256":"d"*64,"declared_input_sha256":"e"*64,"declared_input_hash_contract":"framed-sha256-v2","informational_tag":"prime-claw-test-tier1:eeeeeeeeeeee","os":"linux","architecture":"arm64","build_started_at":"2026-10-02T00:00:00Z","build_finished_at":"2026-10-02T00:00:01Z"}
            repository={"head":"b"*40,"dirty":False,"status_sha256":"a"*64,"content_sha256":"c"*64,"entry_count":1,"content_hash_contract":"framed-sha256-v2"}
            cid="c"*64
            def cp(args,rc=0,out="",err="",outcome="exited",signum=None):
                return SimpleNamespace(args=args,returncode=rc,stdout=out,stderr=err,outcome=outcome,signal=signum)
            def stage(_repo,dest): Path(dest).mkdir(parents=True); return repository
            def host(args,**kw):
                with calls.open("a") as fh: fh.write(json.dumps(args)+"\n")
                if args==["docker","info"]: return cp(args)
                if args[:3]==["docker","run","-d"]:
                    Path(args[args.index("--cidfile")+1]).write_text(cid+"\n")
                    if checkpoint=="run": ready.write_text("ready"); time.sleep(60)
                    return cp(args)
                if args[:3]==["docker","rm","-f"]:
                    if checkpoint=="cleanup":
                        ready.write_text("ready"); os.kill(os.getpid(),signal.SIGTERM)
                        return cp(args,rc=143,outcome="interrupted",signum=signal.SIGTERM)
                    return cp(args)
                if args[:2]==["docker","inspect"]:
                    return cp(args,rc=1,err="Error: No such container: "+cid)
                raise AssertionError(args)
            def container_run(self,*args,**kw):
                joined=" ".join(map(str,args))
                if "install.sh" in joined:
                    if checkpoint=="exec": ready.write_text("ready"); time.sleep(60)
                    if checkpoint=="cleanup": return cp(args,rc=9)
                return cp(args)
            artifact={"kind":"vendor-binary","version":"0.9.8","executable_sha256":"f"*64}
            patches=[mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}),mock.patch.object(conftest,"RESULTS",results),mock.patch.object(conftest.shutil,"which",return_value="/fake/docker"),mock.patch.object(conftest,"_host_command",side_effect=host),mock.patch.object(conftest,"_build_tier1_image",return_value=image),mock.patch.object(conftest,"_disconnect_container_networks",return_value="2026-10-02T00:00:02Z"),mock.patch.object(conftest,"_installed_package_identity",return_value=artifact),mock.patch.object(conftest.Tier1Container,"run",new=container_run),mock.patch.object(conftest.provenance,"stage_repository_snapshot",side_effect=stage)]
            for patcher in patches: patcher.start()
            try:
                gen=conftest.tier1_container.__wrapped__(SimpleNamespace())
                next(gen)
            finally:
                for patcher in reversed(patches): patcher.stop()
        ''')
        for checkpoint in ("run","exec","cleanup"):
            with self.subTest(checkpoint=checkpoint), tempfile.TemporaryDirectory() as td:
                root=Path(td).resolve(); child=root/"child.py"; child.write_text(child_source)
                proc=subprocess.Popen([sys.executable,str(child),str(Path(__file__).resolve().parent.parent),str(root),checkpoint],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
                deadline=time.monotonic()+5
                while time.monotonic()<deadline and not (root/"ready").exists() and proc.poll() is None:
                    time.sleep(.01)
                if not (root/"ready").exists():
                    if proc.poll() is None: proc.kill()
                    stdout,stderr=proc.communicate(timeout=3)
                    self.fail(f"{checkpoint}: child failed before checkpoint: {stdout} {stderr}")
                if checkpoint!="cleanup": os.kill(proc.pid,signal.SIGTERM)
                self.assertEqual(proc.wait(timeout=10),-signal.SIGTERM)
                manifest_path=next((root/"results").glob("*/tier1/manifest.json"))
                manifest=json.loads(manifest_path.read_text())
                conftest.provenance.validate_manifest(manifest)
                self.assertEqual(manifest["run"]["status"],"failed")
                self.assertIn("interrupted",manifest["run"]["failure_codes"])
                calls=[json.loads(line) for line in (root/"calls.log").read_text().splitlines()]
                self.assertEqual(next(call for call in calls if call[:3]==["docker","rm","-f"])[-1],CID)
    @unittest.skipUnless(hasattr(signal, "pthread_sigmask")
                         and hasattr(signal, "sigpending"),
                         "requires POSIX pending-signal inspection")
    def test_fixture_terminal_boundary_matrix(self):
        controller = r'''
import json, os, signal, sys, tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest import mock
sys.path.insert(0, sys.argv[1])
sys.path.insert(0, str(Path(sys.argv[1]) / 'tests'))
import conftest
checkpoint = sys.argv[2]
injected_signal = int(sys.argv[3])
root = Path(sys.argv[4]).resolve()
results = root / 'results'
envf = root / 'pinned.env'
envf.write_text('PRIME_AGENT_PINNED=0.9.8\n')
watched = (signal.SIGTERM, signal.SIGINT, signal.SIGHUP)
seen = []
def prior(signum, _frame):
    seen.append(int(signum))
    if checkpoint == 'prior_raises':
        raise RuntimeError('injected prior handler failure')
for signum in watched:
    signal.signal(signum, prior)
if checkpoint == 'caller_pending':
    signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM})
    os.kill(os.getpid(), signal.SIGTERM)
entry_mask = signal.pthread_sigmask(signal.SIG_BLOCK, [])
image = {
    'id': 'sha256:' + 'a' * 64, 'repo_digests': [],
    'dockerfile': 'docker/test.Dockerfile',
    'dockerfile_sha256': 'd' * 64,
    'declared_input_sha256': 'e' * 64,
    'declared_input_hash_contract': 'framed-sha256-v2',
    'informational_tag': 'prime-claw-test-tier1:eeeeeeeeeeee',
    'os': 'linux', 'architecture': 'arm64',
    'build_started_at': '2026-10-02T00:00:00Z',
    'build_finished_at': '2026-10-02T00:00:01Z',
}
repository = {
    'head': 'b' * 40, 'dirty': False, 'status_sha256': 'a' * 64,
    'content_sha256': 'c' * 64, 'entry_count': 1,
    'content_hash_contract': 'framed-sha256-v2',
}
artifact = {
    'kind': 'vendor-binary', 'version': '0.9.8',
    'executable_sha256': 'f' * 64,
}
def cp(args, rc=0, out='', err='', outcome='exited', signum=None):
    return SimpleNamespace(args=args, returncode=rc, stdout=out, stderr=err,
                           outcome=outcome, signal=signum)
def stage(_repo, dest):
    Path(dest).mkdir(parents=True)
    return repository
def host(args, **_kwargs):
    if args == ['docker', 'info']:
        return cp(args)
    if args[:3] == ['docker', 'run', '-d']:
        Path(args[args.index('--cidfile') + 1]).write_text('c' * 64 + '\n')
        return cp(args)
    raise AssertionError(args)
def container_run(self, *args, **_kwargs):
    return cp(args)
clean = conftest.TeardownResult('absent', 'clean', 'ordinary_nonzero', True)
real_kill = os.kill
kill_calls = 0
def fixture_kill(pid, signum):
    global kill_calls
    kill_calls += 1
    if checkpoint == 'redelivery_failure' and kill_calls == 2:
        raise OSError('injected redelivery failure')
    return real_kill(pid, signum)
def finalize(*_args, **_kwargs):
    if checkpoint == 'redelivery_failure':
        os.kill(os.getpid(), injected_signal)
    return clean
real_open = conftest.provenance.open_owned_directory
opened = []
open_failed = False
def open_owned(path, binding, **kwargs):
    global open_failed
    if checkpoint == 'capability_open_failure' and Path(path).name == 'tier1' and not open_failed:
        open_failed = True
        raise conftest.provenance.ProvenanceError('injected capability open failure')
    cap = real_open(path, binding, **kwargs)
    if Path(path).name == 'tier1':
        opened.append(cap)
    return cap
real_inventory = conftest.provenance.evidence_inventory
real_atomic = conftest.provenance.atomic_write_manifest
real_verify = conftest.provenance.verify_evidence
injected = False
def inject_once():
    global injected
    if not injected:
        injected = True
        os.kill(os.getpid(), injected_signal)
def inventory(*args, **kwargs):
    if checkpoint in ('inventory', 'prior_raises'):
        inject_once()
    return real_inventory(*args, **kwargs)
def atomic(*args, **kwargs):
    global injected
    if checkpoint == 'atomic':
        inject_once()
    result = real_atomic(*args, **kwargs)
    if checkpoint == 'publication_failure' and not injected:
        injected = True
        raise RuntimeError('injected post-publication failure')
    return result
def verify(*args, **kwargs):
    result = real_verify(*args, **kwargs)
    if checkpoint == 'verify':
        inject_once()
    return result
real_signal = conftest.signal.signal
real_sigpending = conftest.signal.sigpending
real_sigmask = conftest.signal.pthread_sigmask
signal_calls = 0
sigpending_calls = 0
sigmask_calls = 0
def fixture_sigpending():
    global sigpending_calls
    sigpending_calls += 1
    fail_at = {
        'sigpending_publication_failure': 2,
        'sigpending_before_restore_failure': 6,
        'sigpending_after_restore_failure': 7,
    }.get(checkpoint)
    if fail_at is not None and sigpending_calls == fail_at:
        raise RuntimeError('injected terminal pending inspection failure')
    return real_sigpending()
def fixture_sigmask(how, mask):
    global sigmask_calls
    sigmask_calls += 1
    if checkpoint == 'initial_block_failure' and sigmask_calls == 2:
        raise RuntimeError('injected initial block failure')
    return real_sigmask(how, mask)
def fixture_signal(signum, handler):
    global signal_calls
    signal_calls += 1
    if checkpoint == 'handler_install_failure' and signal_calls == 2:
        raise RuntimeError('injected handler install failure')
    if checkpoint == 'restoration' and signal_calls == len(watched) + 1:
        inject_once()
    return real_signal(signum, handler)
patches = [
    mock.patch.dict(os.environ, {'TIER1_ENV_FILE': str(envf)}),
    mock.patch.object(conftest, 'RESULTS', results),
    mock.patch.object(conftest.shutil, 'which', return_value='/fake/docker'),
    mock.patch.object(conftest, '_host_command', side_effect=host),
    mock.patch.object(conftest, '_build_tier1_image', return_value=image),
    mock.patch.object(conftest, '_disconnect_container_networks',
                      return_value='2026-10-02T00:00:02Z'),
    mock.patch.object(conftest, '_installed_package_identity',
                      return_value=artifact),
    mock.patch.object(conftest.Tier1Container, 'run', new=container_run),
    mock.patch.object(conftest, '_finalize_session', side_effect=finalize),
    mock.patch.object(conftest.os, 'kill', side_effect=fixture_kill),
    mock.patch.object(conftest.provenance, 'stage_repository_snapshot',
                      side_effect=stage),
    mock.patch.object(conftest.provenance, 'open_owned_directory',
                      side_effect=open_owned),
    mock.patch.object(conftest.provenance, 'evidence_inventory',
                      side_effect=inventory),
    mock.patch.object(conftest.provenance, 'atomic_write_manifest',
                      side_effect=atomic),
    mock.patch.object(conftest.provenance, 'verify_evidence',
                      side_effect=verify),
    mock.patch.object(conftest.signal, 'signal', side_effect=fixture_signal),
    mock.patch.object(conftest.signal, 'sigpending',
                      side_effect=fixture_sigpending),
    mock.patch.object(conftest.signal, 'pthread_sigmask',
                      side_effect=fixture_sigmask),
]
for patcher in patches:
    patcher.start()
error = None
try:
    generator = conftest.tier1_container.__wrapped__(SimpleNamespace())
    next(generator)
    next(generator)
except StopIteration:
    pass
except BaseException as exc:
    error = type(exc).__name__
finally:
    for patcher in reversed(patches):
        patcher.stop()
manifest_paths = list(results.glob('*/tier1/manifest.json'))
manifest = json.loads(manifest_paths[0].read_text()) if manifest_paths else None
restored_mask = signal.pthread_sigmask(signal.SIG_BLOCK, [])
print(json.dumps({
    'capability_closed': all(cap.fd == -1 for cap in opened),
    'error': error,
    'handlers_restored': all(signal.getsignal(sig) is prior for sig in watched),
    'manifest_codes': [] if manifest is None else manifest.get('run', {}).get('failure_codes', []),
    'manifest_status': None if manifest is None else manifest.get('run', {}).get('status', manifest.get('status')),
    'mask_restored': restored_mask == entry_mask,
    'pending': sorted(map(int, signal.sigpending() & set(watched))),
    'seen': seen,
}))
'''
        signal_checkpoints = ("inventory", "atomic", "verify", "restoration")
        for checkpoint in signal_checkpoints:
            for injected_signal in (signal.SIGTERM, signal.SIGINT,
                                    signal.SIGHUP):
                with self.subTest(checkpoint=checkpoint,
                                  signal=signal.Signals(injected_signal).name), \
                        tempfile.TemporaryDirectory() as td:
                    completed = subprocess.run(
                        [sys.executable, "-c", controller,
                         str(Path(__file__).resolve().parent.parent), checkpoint,
                         str(int(injected_signal)), td],
                        capture_output=True, text=True, timeout=10)
                    self.assertEqual(completed.returncode, 0,
                                     completed.stdout + completed.stderr)
                    row = json.loads(completed.stdout.splitlines()[-1])
                    self.assertEqual(row["error"], "_FixtureInterrupted")
                    self.assertTrue(row["capability_closed"])
                    self.assertTrue(row["handlers_restored"])
                    self.assertTrue(row["mask_restored"])
                    self.assertEqual(row["seen"], [injected_signal])
                    self.assertEqual(row["pending"], [])
                    self.assertEqual(row["manifest_status"], "failed")
                    self.assertIn("interrupted", row["manifest_codes"])

        for checkpoint, expected_error in (
            ("publication_failure", "RuntimeError"),
            ("prior_raises", "RuntimeError"),
            ("redelivery_failure", "OSError"),
            ("handler_install_failure", "RuntimeError"),
            ("initial_block_failure", "RuntimeError"),
            ("sigpending_publication_failure", "RuntimeError"),
            ("sigpending_before_restore_failure", "RuntimeError"),
            ("sigpending_after_restore_failure", "RuntimeError"),
            ("capability_open_failure", "ProvenanceError"),
        ):
            with self.subTest(checkpoint=checkpoint), \
                    tempfile.TemporaryDirectory() as td:
                completed = subprocess.run(
                    [sys.executable, "-c", controller,
                     str(Path(__file__).resolve().parent.parent), checkpoint,
                     str(int(signal.SIGTERM)), td],
                    capture_output=True, text=True, timeout=10)
                self.assertEqual(completed.returncode, 0,
                                 completed.stdout + completed.stderr)
                row = json.loads(completed.stdout.splitlines()[-1])
                self.assertEqual(row["error"], expected_error)
                self.assertTrue(row["capability_closed"])
                self.assertTrue(row["handlers_restored"])
                self.assertTrue(row["mask_restored"])
                self.assertNotEqual(row["manifest_status"], "passed")
                if checkpoint == "prior_raises":
                    self.assertEqual(row["seen"], [signal.SIGTERM])
                    self.assertEqual(row["manifest_status"], "failed")
                if checkpoint in (
                    "sigpending_before_restore_failure",
                    "sigpending_after_restore_failure",
                ):
                    self.assertEqual(row["manifest_status"], "failed")
                    self.assertIn(
                        "signal-inspection-failed", row["manifest_codes"])
                if checkpoint == "sigpending_publication_failure":
                    self.assertIsNone(row["manifest_status"])

        with self.subTest(checkpoint="caller_pending"), \
                tempfile.TemporaryDirectory() as td:
            completed = subprocess.run(
                [sys.executable, "-c", controller,
                 str(Path(__file__).resolve().parent.parent), "caller_pending",
                 str(int(signal.SIGTERM)), td],
                capture_output=True, text=True, timeout=10)
            self.assertEqual(completed.returncode, 0,
                             completed.stdout + completed.stderr)
            row = json.loads(completed.stdout.splitlines()[-1])
            self.assertIsNone(row["error"])
            self.assertTrue(row["capability_closed"])
            self.assertTrue(row["handlers_restored"])
            self.assertTrue(row["mask_restored"])
            self.assertEqual(row["seen"], [])
            self.assertEqual(row["pending"], [signal.SIGTERM])
            self.assertEqual(row["manifest_status"], "passed")
    def test_signal_during_fixture_publication_never_leaves_green_manifest(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve(); results=tmp/"results"; envf=tmp/"pinned.env"
            envf.write_text("PRIME_AGENT_PINNED=0.9.8\n")
            image={"id":IMAGE_ID,"repo_digests":[],"dockerfile":"docker/test.Dockerfile","dockerfile_sha256":"d"*64,"declared_input_sha256":"e"*64,"declared_input_hash_contract":"framed-sha256-v2","informational_tag":"prime-claw-test-tier1:eeeeeeeeeeee","os":"linux","architecture":"arm64","build_started_at":"2026-10-02T00:00:00Z","build_finished_at":"2026-10-02T00:00:01Z"}
            repository={"head":"b"*40,"dirty":False,"status_sha256":"a"*64,"content_sha256":"c"*64,"entry_count":1,"content_hash_contract":"framed-sha256-v2"}
            artifact={"kind":"vendor-binary","version":"0.9.8","executable_sha256":"f"*64}
            def stage(_repo,dest): Path(dest).mkdir(parents=True); return repository
            def host(args,**kw):
                if args==["docker","info"]: return cp(args)
                if args[:3]==["docker","run","-d"]:
                    Path(args[args.index("--cidfile")+1]).write_text(CID+"\n"); return cp(args)
                raise AssertionError(args)
            def container_run(self,*args,**kw): return cp(args)
            clean=conftest.TeardownResult("absent","clean","ordinary_nonzero",True)
            real_inventory=conftest.provenance.evidence_inventory; injected=False; kill_calls=0
            def inventory(*args,**kwargs):
                nonlocal injected
                if not injected:
                    injected=True; conftest.os.kill(os.getpid(),signal.SIGTERM)
                return real_inventory(*args,**kwargs)
            def fake_kill(_pid,signum):
                nonlocal kill_calls
                kill_calls+=1
                if kill_calls==1:
                    handler=signal.getsignal(signum); handler(signum,None)
            previous={sig:signal.getsignal(sig) for sig in (signal.SIGTERM,signal.SIGINT,signal.SIGHUP)}
            patches=[mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}),mock.patch.object(conftest,"RESULTS",results),mock.patch.object(conftest.shutil,"which",return_value="/fake/docker"),mock.patch.object(conftest,"_host_command",side_effect=host),mock.patch.object(conftest,"_build_tier1_image",return_value=image),mock.patch.object(conftest,"_disconnect_container_networks",return_value="2026-10-02T00:00:02Z"),mock.patch.object(conftest,"_installed_package_identity",return_value=artifact),mock.patch.object(conftest.Tier1Container,"run",new=container_run),mock.patch.object(conftest,"_finalize_session",return_value=clean),mock.patch.object(conftest.provenance,"stage_repository_snapshot",side_effect=stage),mock.patch.object(conftest.provenance,"evidence_inventory",side_effect=inventory),mock.patch.object(conftest.os,"kill",side_effect=fake_kill)]
            for patcher in patches: patcher.start()
            try:
                gen=conftest.tier1_container.__wrapped__(SimpleNamespace()); next(gen)
                with self.assertRaises(conftest._FixtureInterrupted): next(gen)
            finally:
                for patcher in reversed(patches): patcher.stop()
            manifest=json.loads(next(results.glob("*/tier1/manifest.json")).read_text())
            conftest.provenance.validate_manifest(manifest)
            self.assertEqual(manifest["run"]["status"],"failed")
            self.assertIn("interrupted",manifest["run"]["failure_codes"])
            self.assertEqual({sig:signal.getsignal(sig) for sig in previous},previous)
