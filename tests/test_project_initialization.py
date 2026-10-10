"""Project initialization and reconciliation acceptance coverage."""
import json
import subprocess
import time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"src/prime-agent-plugin"

def test_asset_inventory_covers_every_shipped_markdown_source_once():
    inventory=json.loads((SOURCE/"asset-inventory.json").read_text())
    rows=inventory["assets"]
    assert inventory["schemaVersion"]==1 and len(rows)==15
    assert len({row["id"] for row in rows})==len(rows)
    assert len({row["destination"] for row in rows})==len(rows)
    inventoried={row["source"] for row in rows}
    shipped={str(path.relative_to(SOURCE)) for path in SOURCE.rglob("*.md")}
    assert inventoried==shipped
    assert all((SOURCE/row["source"]).is_file() and not (SOURCE/row["source"]).is_symlink() for row in rows)

def test_prepare_requires_the_user_level_goals_and_heartbeats_skill():
    prepare=" ".join((SOURCE/"skills/project-templates/prepare.md").read_text().split())
    assert "`/skill:goals-and-heartbeats`" in prepare
    assert "unless that exact skill is already present in the current context" in prepare
    assert "mandatory and always in effect" in prepare


def test_builder_project_uses_regular_project_assets_and_no_legacy_skill_tree():
    project_rows=[row for row in json.loads((SOURCE/"asset-inventory.json").read_text())["assets"] if row["scope"]=="project"]
    for row in project_rows:
        destination=ROOT/row["destination"]
        assert destination.is_file() and not destination.is_symlink()
        assert destination.read_bytes()==(SOURCE/row["source"]).read_bytes()
    assert not (ROOT/".ralph/skills").exists()
    assert (ROOT/".ralph/plans").is_dir()
    manifest=json.loads((ROOT/".prime-claw/templates.json").read_text())
    assert set(manifest["assets"])=={row["id"] for row in project_rows}

def test_project_initialization_node_suite(tier1_container):
    result=tier1_container.run("node","--experimental-strip-types","--test","/workspace/tests/project_initialization_extension.test.mjs",timeout=180)
    assert result.returncode==0,result.stdout+result.stderr

def test_template_review_node_suite(tier1_container):
    result=tier1_container.run("node","--experimental-strip-types","--test","/workspace/tests/template_review.test.mjs",timeout=180)
    assert result.returncode==0,result.stdout+result.stderr


def test_two_processes_cannot_both_take_over_the_same_stale_lock(tmp_path):
    project=tmp_path/"project";project.mkdir();state=project/".prime-claw";state.mkdir()
    lock=state/"reconcile.lock";lock.write_text(json.dumps({"pid":99999999,"token":"stale-token","createdAt":"2020-01-01T00:00:00Z"})+"\n")
    barrier=tmp_path/"go";events=tmp_path/"events"
    module=(SOURCE/"extension-support/project-initialization.ts").as_uri()
    code='import { existsSync, appendFileSync } from "node:fs";\nconst { acquireProjectMutationLock } = await import(process.argv[1]);\nconst [project,barrier,events,name]=process.argv.slice(2);\nwhile(!existsSync(barrier)) await new Promise(resolve=>setTimeout(resolve,5));\ntry { const release=acquireProjectMutationLock(project);appendFileSync(events,`acquired ${name} ${Date.now()}\\n`);await new Promise(resolve=>setTimeout(resolve,300));release();appendFileSync(events,`released ${name} ${Date.now()}\\n`); }\ncatch(error){appendFileSync(events,`failed ${name} ${String(error)}\\n`);process.exitCode=2;}\n'
    argv=["node","--experimental-strip-types","--input-type=module","-e",code,module,str(project),str(barrier),str(events)]
    first=subprocess.Popen([*argv,"a"],cwd=ROOT)
    second=subprocess.Popen([*argv,"b"],cwd=ROOT)
    time.sleep(0.05);barrier.write_text("go\n")
    codes=[first.wait(timeout=10),second.wait(timeout=10)]
    lines=events.read_text().splitlines()
    assert sorted(codes)==[0,2],lines
    assert sum(line.startswith("acquired") for line in lines)==1
    assert not lock.exists()
    assert not (state/"reconcile.lock.recovery").exists()


def test_first_native_v098_session_discovers_initialized_skills(tier1_container, ctmp):
    project=ctmp/"first-session-project";project.mkdir()
    subprocess.run(["git","init","-q","-b","main",str(project)],check=True)
    bindir=ctmp/"bin";bindir.mkdir();orca=bindir/"orca"
    orca_payload=json.dumps({"result":{"repos":[{"id":"fixture","path":str(project),"displayName":"fixture"}]}})
    orca.write_text("#!/bin/sh\nprintf '%s\\n' '"+orca_payload+"'\n")
    orca.chmod(0o755)
    request=json.dumps({"id":"commands","type":"get_commands"})+"\n"
    path_result=tier1_container.run("sh","-c","printf %s \"$PATH\"",wrap=False,timeout=10)
    assert path_result.returncode==0,path_result.stderr
    result=tier1_container.run(
        "/workspace/scripts/run-prime-agent-probe.sh",tier1_container.prime_agent,"--mode","rpc","--offline","--no-session",
        "--no-prompt-templates","--no-context-files","--no-extensions",
        "--cwd",str(project),"-e","/workspace/src/prime-agent-plugin/extensions/project-initialization.ts",
        input_text=request,env={"PATH":str(bindir)+":"+path_result.stdout,"HOME":str(ctmp)},timeout=60,workdir=None,
    )
    assert result.returncode==0,result.stdout+result.stderr
    responses=[json.loads(line) for line in result.stdout.splitlines() if line.startswith("{")]
    command_response=next(row for row in responses if row.get("id")=="commands")
    commands=command_response["data"]["commands"]
    by_name={row["name"]:row for row in commands}
    for name in ("skill:prepare","skill:execute"):
        assert name in by_name
        assert by_name[name]["sourceInfo"]["path"]==str(project/".agents/skills"/name.split(":",1)[1]/"SKILL.md")
