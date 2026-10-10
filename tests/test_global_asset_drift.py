import json
from pathlib import Path
import subprocess
import stat
import shutil

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/manage-prime-agent-global-assets.py"
SOURCE=ROOT/"src/prime-agent-plugin"

def run(mode,root,*extra):
    return subprocess.run([str(SCRIPT),mode,str(SOURCE),str(root),*extra],text=True,capture_output=True)

def test_global_assets_create_converge_and_check(tmp_path):
    root=tmp_path/"agent";root.mkdir()
    first=run("apply",root);assert first.returncode==0,first.stderr
    second=run("apply",root);assert second.returncode==0,second.stderr
    checked=run("check",root);assert checked.returncode==0,checked.stderr
    state=json.loads((root/".prime-claw/global-templates.json").read_text())
    assert set(state["assets"])=={"global-goals-and-heartbeats","global-goal-continuation","global-expert-review","global-oversee-episode"}

def test_unknown_or_changed_global_asset_is_preserved_by_default(tmp_path):
    root=tmp_path/"agent";root.mkdir(); target=root/"skills/goals-and-heartbeats/SKILL.md";target.parent.mkdir(parents=True);target.write_text("local edit\n")
    applied=run("apply",root);assert applied.returncode==3;assert target.read_text()=="local edit\n";assert "requires explicit resolution" in applied.stderr
    checked=run("check",root);assert checked.returncode==3

def test_accept_override_settles_current_upstream_and_backup_reset_verifies_backup(tmp_path):
    root=tmp_path/"agent";root.mkdir(); target=root/"skills/goals-and-heartbeats/SKILL.md";target.parent.mkdir(parents=True);target.write_text("local edit\n")
    accepted=run("apply",root,"--action","accept-override");assert accepted.returncode==0,accepted.stderr;assert run("check",root).returncode==0
    target.write_text("new local edit\n")
    reset=run("apply",root,"--action","backup-reset");assert reset.returncode==0,reset.stderr;assert target.read_bytes()==(SOURCE/"skills/goals-and-heartbeats/SKILL.md").read_bytes()
    backups=list((root/".prime-claw/backups").rglob("SKILL.md"));assert backups and backups[-1].read_text()=="new local edit\n";assert run("check",root).returncode==0

def test_symlinked_global_asset_is_refused_without_touching_target(tmp_path):
    root=tmp_path/"agent";root.mkdir(); outside=tmp_path/"outside";outside.write_text("outside\n"); path=root/"skills/goals-and-heartbeats/SKILL.md";path.parent.mkdir(parents=True);path.symlink_to(outside)
    result=run("apply",root,"--action","backup-reset");assert result.returncode==1;assert outside.read_text()=="outside\n";assert path.is_symlink()


def test_backup_paths_are_private_unique_and_reject_symlinked_parent(tmp_path):
    root=tmp_path/"agent";root.mkdir(); assert run("apply",root).returncode==0
    target=root/"skills/goals-and-heartbeats/SKILL.md"
    for value in ("private one\n", "private two\n"):
        target.write_text(value)
        result=run("apply",root,"--action","backup-reset");assert result.returncode==0,result.stderr
    backups=list((root/".prime-claw/backups").rglob("SKILL.md"))
    assert len(backups)==2
    assert {path.read_text() for path in backups}=={"private one\n","private two\n"}
    assert all(stat.S_IMODE(path.stat().st_mode)==0o600 for path in backups)
    assert stat.S_IMODE((root/".prime-claw/backups").stat().st_mode)==0o700

    other=tmp_path/"outside";other.mkdir()
    shutil.rmtree(root/".prime-claw/backups")
    (root/".prime-claw/backups").symlink_to(other,target_is_directory=True)
    target.write_text("must not escape\n")
    refused=run("apply",root,"--action","backup-reset")
    assert refused.returncode==1
    assert not list(other.rglob("*"))


def test_symlinked_global_state_is_refused_without_touching_target(tmp_path):
    root=tmp_path/"agent";root.mkdir(); pc=root/".prime-claw";pc.mkdir()
    outside=tmp_path/"outside-state";outside.write_text('{"private":true}\n')
    (pc/"global-templates.json").symlink_to(outside)
    result=run("apply",root)
    assert result.returncode==1
    assert outside.read_text()=='{"private":true}\n'


def test_accepted_global_override_requires_new_decision_when_upstream_changes(tmp_path):
    source=tmp_path/"source";shutil.copytree(SOURCE,source)
    root=tmp_path/"agent";root.mkdir()
    def local(mode,*extra):
        return subprocess.run([str(SCRIPT),mode,str(source),str(root),*extra],text=True,capture_output=True)
    assert local("apply").returncode==0
    target=root/"skills/goals-and-heartbeats/SKILL.md";target.write_text("accepted local policy\n")
    assert local("apply","--action","accept-override").returncode==0
    upstream=source/"skills/goals-and-heartbeats/SKILL.md";upstream.write_text(upstream.read_text()+"\nupstream v2\n")
    changed=local("apply")
    assert changed.returncode==3
    assert target.read_text()=="accepted local policy\n"
    row=next(item for item in json.loads(changed.stdout)["assets"] if item["id"]=="global-goals-and-heartbeats")
    assert row["action"]=="preserved" and row["settled"] is False


def test_preflight_detects_drift_without_mutating_files_or_state(tmp_path):
    root=tmp_path/"agent";root.mkdir();target=root/"skills/goals-and-heartbeats/SKILL.md";target.parent.mkdir(parents=True);target.write_text("local edit\n")
    result=run("preflight",root)
    assert result.returncode==3
    assert target.read_text()=="local edit\n"
    assert not (root/".prime-claw").exists()


def test_exact_upstream_bytes_recover_stale_managed_and_customized_provenance(tmp_path):
    source=tmp_path/"source";shutil.copytree(SOURCE,source)
    root=tmp_path/"agent";root.mkdir()
    def local(mode,*extra):
        return subprocess.run([str(SCRIPT),mode,str(source),str(root),*extra],text=True,capture_output=True)
    assert local("apply").returncode==0
    target=root/"skills/goals-and-heartbeats/SKILL.md";upstream=source/"skills/goals-and-heartbeats/SKILL.md";upstream.write_text(upstream.read_text()+"\nupstream interrupted v2\n")
    target.write_bytes(upstream.read_bytes())  # asset replacement completed, manifest save did not
    assert local("preflight").returncode==0
    repaired=local("apply");assert repaired.returncode==0,repaired.stderr
    assert local("check").returncode==0
    row=json.loads((root/".prime-claw/global-templates.json").read_text())["assets"]["global-goals-and-heartbeats"]
    assert row["state"]=="managed" and row["installedSha256"]==row["baselineSha256"]
    target.write_text("temporary local customization\n")
    assert local("apply").returncode==3
    target.write_bytes(upstream.read_bytes())  # operator manually restored the shipped bytes
    assert local("preflight").returncode==0
    assert local("apply").returncode==0
    assert local("check").returncode==0
