import json
import os
import shutil
import socket
import subprocess
import threading
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
APPLY = REPO / "scripts" / "apply-prime-agent-plugin.sh"
PRIME = shutil.which("prime-agent")
FAKE_ROUTE = "active-episode"


def git(cwd, *args):
    return subprocess.run(
        ["git", "-C", str(cwd), *args], check=True, text=True, capture_output=True,
    ).stdout.strip()


class FakeDaemon:
    def __init__(self, path):
        self.path = path
        self.envelopes = []
        self.responses = {}
        self.stop = False
        self.closed = False
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.bind(str(path))
        self.sock.listen()
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()

    @property
    def commands(self):
        return [envelope["command"] for envelope in self.envelopes]

    def run(self):
        while not self.stop:
            try:
                self.sock.settimeout(0.2)
                conn, _ = self.sock.accept()
            except (TimeoutError, socket.timeout, OSError):
                continue
            with conn:
                conn.sendall((json.dumps({
                    "type": "daemon_hello",
                    "protocol": {"name": "prime-agent.daemon", "version": 7},
                    "schema": {"revision": 28},
                }) + "\n").encode())
                buffer = b""
                while not self.stop:
                    try:
                        data = conn.recv(65536)
                    except OSError:
                        break
                    if not data:
                        break
                    buffer += data
                    while b"\n" in buffer:
                        line, buffer = buffer.split(b"\n", 1)
                        if not line:
                            continue
                        envelope = json.loads(line)
                        command = envelope.get("command", {})
                        self.envelopes.append(envelope)
                        command_type = command.get("type")
                        if command_type == "ack_result":
                            continue
                        if command_type == "list":
                            payload = {"sessions": []}
                        elif command_type == "create":
                            header = json.loads(
                                Path(command["sessionPath"]).read_text().splitlines()[0]
                            )
                            payload = {
                                "activeSessionId": FAKE_ROUTE,
                                "sessionId": header["id"],
                                "sessionFile": command["sessionPath"],
                                "sessionName": command["name"],
                                "cwd": command["config"]["cwd"],
                                "isSessionActive": True,
                            }
                        elif command_type in {"prompt", "kill"}:
                            payload = {"ok": True}
                        else:
                            payload = {}
                        self.responses[envelope["id"]] = payload
                        conn.sendall((json.dumps({
                            "type": "response", "id": envelope["id"],
                            "success": True, "data": payload,
                        }) + "\n").encode())

    def close(self):
        if self.closed:
            return
        self.closed = True
        self.stop = True
        try:
            self.sock.close()
        except OSError:
            pass
        self.thread.join(2)
        self.path.unlink(missing_ok=True)


def cleanup_episode(project, worktree, branch, daemon, socket_path, *fixture_paths):
    try:
        if project.exists() and worktree is not None and worktree.exists():
            subprocess.run(
                ["git", "-C", str(project), "worktree", "remove", "--force", str(worktree)],
                text=True, capture_output=True, check=False,
            )
        if project.exists() and branch:
            subprocess.run(
                ["git", "-C", str(project), "branch", "-D", branch],
                text=True, capture_output=True, check=False,
            )
    finally:
        try:
            daemon.close()
        finally:
            socket_path.unlink(missing_ok=True)
            for path in fixture_paths:
                if path.is_dir() and not path.is_symlink():
                    shutil.rmtree(path, ignore_errors=True)
                else:
                    path.unlink(missing_ok=True)


def provider(path,records,location,socket_path=None):
 transport_records = records.with_suffix(".transport.jsonl")
 transport = "" if socket_path is None else f"import net from 'node:net';import{{lstatSync,appendFileSync as transportWrite}}from'node:fs';const expectedSocket={json.dumps(str(socket_path))},transportRecords={json.dumps(str(transport_records))};if(!lstatSync(expectedSocket).isSocket())throw Error('fake socket missing');process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET=expectedSocket;const originalConnect=net.Socket.prototype.connect;function guardedConnect(...args){{let arg=args[0];if(Array.isArray(arg))arg=arg[0];const path=typeof arg==='string'?arg:arg?.path;if(path!==expectedSocket)throw Error('non-fixture transport denied');transportWrite(transportRecords,JSON.stringify({{kind:'connect',path,isFake:true}})+'\\n');return originalConnect.apply(this,args)}}net.Socket.prototype.connect=guardedConnect;if(process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET!==expectedSocket||net.Socket.prototype.connect!==guardedConnect)throw Error('fake transport not effective');transportWrite(transportRecords,JSON.stringify({{kind:'runtime-guard',socket:expectedSocket,transportIsFake:true}})+'\\n');"
 guard = "" if socket_path is None else 'if(process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET!==expectedSocket||net.Socket.prototype.connect!==guardedConnect)throw Error("fake transport not effective");'
 transport_value = "null" if socket_path is None else "true"
 path.write_text(transport + rf'''import{{appendFileSync}}from"node:fs";import{{createAssistantMessageEventStream}}from"@earendil-works/pi-ai";const p={json.dumps(str(records))};let calls=0;function msg(model,content,reason){{return{{role:"assistant",content,api:model.api,provider:model.provider,model:model.id,usage:{{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}}},stopReason:reason,timestamp:Date.now()}}}}export default function x(pi){{pi.registerCommand("probe-reload",{{description:"reload",handler:async(_a,ctx)=>ctx.reload()}});pi.registerProvider("poc",{{baseUrl:"x",apiKey:"x",api:"poc",streamSimple(model,context){{{guard}calls++;const all=JSON.stringify(context.messages??[]);appendFileSync(p,JSON.stringify({{calls,transportIsFake:{transport_value},kernel:context.systemPrompt.split("PRIME_CLAW_CONVERSATION_IDENTITY_V1").length-1,package:all.split("# Oversee episode").length-1}})+"\n");const s=createAssistantMessageEventStream();queueMicrotask(()=>{{if(process.env.PROBE_MODE==="activate"&&calls===1){{const tc={{type:"toolCall",id:"create",name:"create_spec_episode",arguments:{{location:"{location}"}}}},m=msg(model,[tc],"toolUse");s.push({{type:"start",partial:m}});s.push({{type:"toolcall_start",contentIndex:0,partial:m}});s.push({{type:"toolcall_end",contentIndex:0,toolCall:tc,partial:m}});s.push({{type:"done",reason:"toolUse",message:m}})}}else{{const m=msg(model,[{{type:"text",text:"ok"}}],"stop");s.push({{type:"start",partial:m}});s.push({{type:"done",reason:"stop",message:m}})}}s.end()}});return s}},models:[{{id:"m",name:"M",reasoning:false,input:["text"],cost:{{input:0,output:0,cacheRead:0,cacheWrite:0}},contextWindow:100000,maxTokens:1000}}]}})}}''')
def assert_runtime_guard(records, socket_path):
    rows = [
        json.loads(line)
        for line in records.with_suffix(".transport.jsonl").read_text().splitlines()
    ]
    assert rows[0] == {
        "kind": "runtime-guard", "socket": str(socket_path), "transportIsFake": True,
    }
    guard = {
        "kind": "runtime-guard", "socket": str(socket_path), "transportIsFake": True,
    }
    connect = {"kind": "connect", "path": str(socket_path), "isFake": True}
    assert connect in rows
    assert all(row in (guard, connect) for row in rows)


def assert_creation_trace(daemon):
    mutation_envelopes = [
        envelope for envelope in daemon.envelopes
        if envelope["command"].get("type") in {"create", "prompt", "ack_result"}
    ]
    commands = [envelope["command"] for envelope in mutation_envelopes]
    assert [command["type"] for command in commands] == [
        "create", "ack_result", "prompt", "ack_result", "prompt", "ack_result",
    ], commands
    create, ack_create, handoff, ack_handoff, execute, ack_execute = commands
    assert daemon.responses[create["id"]]["activeSessionId"] == FAKE_ROUTE
    assert handoff["activeSessionId"] == FAKE_ROUTE
    assert execute["activeSessionId"] == FAKE_ROUTE
    assert [ack_create["commandId"], ack_handoff["commandId"], ack_execute["commandId"]] == [
        create["id"], handoff["id"], execute["id"],
    ]
    assert "streamingBehavior" not in handoff and handoff["queueIfBusy"] is False
    assert execute["streamingBehavior"] == "followUp" and execute["queueIfBusy"] is True
    for prompt in (handoff, execute):
        assert prompt["source"] == "extension"
        assert prompt["expandPromptTemplates"] is False
    ids = [command["id"] for command in commands]
    assert len(set(ids)) == len(ids)
    assert all(command["id"].startswith("spec_episode_") for command in (create, handoff, execute))
    assert all(command["id"].startswith("spec_episode_ack_") for command in (ack_create, ack_handoff, ack_execute))
    assert len({envelope["clientId"] for envelope in mutation_envelopes}) == 1
    for envelope in mutation_envelopes:
        assert envelope["type"] == "command"
        assert envelope["protocol"] == {"name": "prime-agent.daemon", "version": 7}
        assert envelope["command"]["id"] == envelope["id"]


def assert_recovery_trace(daemon):
    assert [command.get("type") for command in daemon.commands] == ["list"], daemon.commands
    envelope = daemon.envelopes[0]
    assert envelope["type"] == "command"
    assert envelope["protocol"] == {"name": "prime-agent.daemon", "version": 7}
    assert envelope["command"]["id"] == envelope["id"]


def run(args,env):
 env=dict(env)
 if args and args[0]==PRIME:
  fake_socket=env.pop("PRIME_CLAW_TEST_DAEMON_SOCKET",None)
  fake_registry=env.pop("PRIME_CLAW_TEST_DAEMON_REGISTRY",None)
  env={key:value for key,value in env.items() if not key.startswith("PRIME_AGENT_INTERNAL_") and not key.startswith("RLM_") and key!="PRIME_AGENT_KERNEL_OWNER_PID"}
  env["PRIME_AGENT_INTERNAL_LEGACY_OWNED_WORKER_FRONTEND"]="1"
  if fake_socket is not None:env["PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET"]=fake_socket
  if fake_registry is not None:env["PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_REGISTRY_DIR"]=fake_registry
 return subprocess.run(args,cwd=REPO,env=env,text=True,capture_output=True,timeout=40)
def test_registered_cleanup_survives_intentional_post_creation_assertion(tmp_path):
    project = tmp_path / "cleanup-project"
    project.mkdir()
    git(project, "init", "-q")
    git(project, "config", "user.email", "poc@example.invalid")
    git(project, "config", "user.name", "POC")
    (project / "README.md").write_text("fixture")
    git(project, "add", ".")
    git(project, "commit", "-qm", "fixture")
    worktree = tmp_path / "cleanup-worktree"
    branch = "episode/cleanup-proof"
    lifecycle_state = tmp_path / "cleanup-lifecycle-state"
    session_state = tmp_path / "cleanup-sessions"
    socket_path = Path(f"/tmp/pc-cleanup-{os.getpid()}-{time.time_ns()}.sock")
    daemon = FakeDaemon(socket_path)
    failed = False
    try:
        git(project, "worktree", "add", "-q", "-b", branch, str(worktree), "HEAD")
        lifecycle_state.mkdir()
        (lifecycle_state / "identity.json").write_text("created")
        session_state.mkdir()
        (session_state / "episode.jsonl").write_text("created")
        assert False, "intentional post-creation failure"
    except AssertionError as error:
        failed = "intentional post-creation failure" in str(error)
    finally:
        cleanup_episode(
            project, worktree, branch, daemon, socket_path,
            lifecycle_state, session_state,
        )
    assert failed is True
    assert not worktree.exists()
    assert git(project, "branch", "--list", branch) == ""
    assert not socket_path.exists()
    assert not lifecycle_state.exists()
    assert not session_state.exists()


def test_installed_lifecycle_classifier_blocks_corruption_before_provider_or_recovery(tmp_path, request):
    assert PRIME
    agent=tmp_path/"agent";env={**os.environ,"PRIME_AGENT_PLUGIN_ROOT":str(agent)};ap=run([str(APPLY)],env);assert ap.returncode==0,ap.stdout+ap.stderr
    sock=Path(f"/tmp/pc-lifecycle-{os.getpid()}-{time.time_ns()}.sock");daemon=FakeDaemon(sock);request.addfinalizer(daemon.close)
    setup=agent/"extensions/aaa-lifecycle-setup.ts"
    setup.write_text(r'''import{mkdirSync,writeFileSync,readdirSync,readFileSync}from"node:fs";import{join,dirname,basename,resolve}from"node:path";
const markerType="prime-claw-conversation-oversight";
export default function setup(pi){pi.on("session_start",(_event,ctx)=>{const cwd=ctx.cwd,owner=ctx.sessionManager.getSessionId(),kind=process.env.LIFECYCLE_CASE,root=join(cwd,".prime/agent/state/spec-episodes");mkdirSync(root,{recursive:true});const make=(slug,id)=>({version:2,slug,sourceLocation:`.ralph/plans/future/${slug}`,ownerSessionId:owner,episodeId:id,episodeActiveSessionId:`${slug}-route`,episodeSessionFile:join(dirname(cwd),`${basename(cwd)}-${slug}-episode`,"episode.jsonl"),branch:`episode/${slug}`,worktree:resolve(dirname(cwd),`${basename(cwd)}-${slug}-episode`),sessionName:`${slug}-episode`,bootstrapAdmission:"delivered"});const mark=(x,status="active")=>({markerVersion:2,status,ownerSessionId:x.ownerSessionId,slug:x.slug,sourceLocation:x.sourceLocation,episodeId:x.episodeId,episodeSessionFile:x.episodeSessionFile,branch:x.branch,worktree:x.worktree,sessionName:x.sessionName,identityVersion:2,admission:"delivered"});const alpha=make("alpha","11111111-1111-4111-8111-111111111111"),beta=make("beta","22222222-2222-4222-8222-222222222222");if(kind==="empty-expectation"){writeFileSync(join(root,"alpha.json"),JSON.stringify({...alpha,ownerSessionId:""}))}else if(kind==="empty-marker"){pi.appendEntry(markerType,{...mark(alpha),ownerSessionId:""})}else if(kind==="current-mismatch"){writeFileSync(join(root,"beta.json"),JSON.stringify(beta));pi.appendEntry(markerType,{...mark(beta),episodeSessionFile:"/wrong/current.jsonl"})}else if(kind==="legacy-mismatch"){writeFileSync(join(root,"beta.json"),JSON.stringify(beta));pi.appendEntry(markerType,{version:1,status:"active",ownerSessionId:owner,slug:beta.slug,sourceLocation:beta.sourceLocation,episodeId:beta.episodeId,episodeSessionFile:"/wrong/legacy.jsonl"})}else if(kind==="orphan-active-beta"){writeFileSync(join(root,"beta.json"),JSON.stringify(beta));pi.appendEntry(markerType,mark(beta));pi.appendEntry(markerType,mark(alpha))}else if(kind==="inactive-old-beta"){writeFileSync(join(root,"beta.json"),JSON.stringify(beta));pi.appendEntry(markerType,mark(beta));pi.appendEntry(markerType,mark(alpha,"inactive"))}else throw Error(`unknown lifecycle case ${kind}`);const files={};for(const name of readdirSync(root).sort())files[name]=readFileSync(join(root,name),"utf8");writeFileSync(process.env.LIFECYCLE_SNAPSHOT,JSON.stringify(files))})}''')
    probe=agent/"extensions/aab-lifecycle-provider.ts"
    probe.write_text(r'''import net from"node:net";import{appendFileSync,lstatSync}from"node:fs";import{createAssistantMessageEventStream}from"@earendil-works/pi-ai";const fake=process.env.LIFECYCLE_SOCKET;if(!lstatSync(fake).isSocket())throw Error("fake socket missing");process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET=fake;const original=net.Socket.prototype.connect;function guarded(...args){let arg=args[0];if(Array.isArray(arg))arg=arg[0];const path=typeof arg==="string"?arg:arg?.path;if(path!==fake)throw Error("non-fixture transport denied");return original.apply(this,args)}net.Socket.prototype.connect=guarded;if(process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET!==fake||net.Socket.prototype.connect!==guarded)throw Error("fake transport not effective");appendFileSync(process.env.LIFECYCLE_TRANSPORT,JSON.stringify({kind:"runtime-guard",socket:fake,transportIsFake:true})+"\n");export default function provider(pi){pi.registerProvider("lifecycle",{baseUrl:"x",apiKey:"x",api:"lifecycle",streamSimple(model,context){if(net.Socket.prototype.connect!==guarded)throw Error("fake guard replaced");appendFileSync(process.env.LIFECYCLE_RECORDS,JSON.stringify({package:JSON.stringify(context.messages??[]).split("# Oversee episode").length-1})+"\n");const s=createAssistantMessageEventStream();queueMicrotask(()=>{const m={role:"assistant",content:[{type:"text",text:"ok"}],api:model.api,provider:model.provider,model:model.id,usage:{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:"stop",timestamp:Date.now()};s.push({type:"start",partial:m});s.push({type:"done",reason:"stop",message:m});s.end()});return s},models:[{id:"m",name:"M",reasoning:false,input:["text"],cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0},contextWindow:10000,maxTokens:1000}]})}''')
    transport=tmp_path/"lifecycle-transport.jsonl"
    blocked={"empty-expectation","empty-marker","current-mismatch","legacy-mismatch","orphan-active-beta"}
    for kind in [*sorted(blocked),"inactive-old-beta"]:
        case=tmp_path/kind;project=case/"project";project.mkdir(parents=True);git(project,"init","-q");git(project,"config","user.email","poc@example.invalid");git(project,"config","user.name","POC")
        skill=project/".ralph/skills/oversee-episode/SKILL.md";skill.parent.mkdir(parents=True);skill.write_text((REPO/".ralph/skills/oversee-episode/SKILL.md").read_text());git(project,"add",".");git(project,"commit","-qm","fixture")
        sessions=case/"sessions";sessions.mkdir();records=case/"records.jsonl";snapshot=case/"snapshot.json"
        env2={**os.environ,"PRIME_AGENT_CODING_AGENT_DIR":str(agent),"PRIME_CLAW_TEST_DAEMON_REGISTRY":str(case/"supervisor"),"LIFECYCLE_CASE":kind,"LIFECYCLE_SOCKET":str(sock),"LIFECYCLE_TRANSPORT":str(transport),"LIFECYCLE_RECORDS":str(records),"LIFECYCLE_SNAPSHOT":str(snapshot)}
        guard_before=0 if not transport.exists() else len(transport.read_text().splitlines())
        commands_before=len(daemon.commands);cp=run([PRIME,"--mode","text","--offline","--session-dir",str(sessions),"--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(project),"--provider","lifecycle","--model","m","-p","lifecycle probe"],env2)
        guard_rows=[json.loads(line) for line in transport.read_text().splitlines()]
        assert len(guard_rows)==guard_before+1,(kind,guard_rows)
        assert guard_rows[-1]=={"kind":"runtime-guard","socket":str(sock),"transportIsFake":True}
        root=project/".prime/agent/state/spec-episodes";before=json.loads(snapshot.read_text());after={path.name:path.read_text() for path in sorted(root.glob("*")) if path.is_file()};assert after==before,(kind,before,after)
        session_files=list(sessions.glob("*.jsonl"));assert len(session_files)==1,(kind,session_files);entries=[json.loads(line) for line in session_files[0].read_text().splitlines()];assert not any(e.get("customType")=="prime-claw-oversight-recovery" for e in entries),kind
        assert len(daemon.commands)==commands_before,kind
        rows=[] if not records.exists() else [json.loads(line) for line in records.read_text().splitlines()]
        if kind in blocked:
            assert cp.returncode!=0,(kind,cp.stdout,cp.stderr);assert rows==[],kind
        else:
            assert cp.returncode==0,(kind,cp.stdout,cp.stderr);assert rows==[{"package":1}],rows


def test_installed_discovery_real_implement_spec_activation_resume_and_absence(tmp_path, request):
 assert PRIME
 location=f".ralph/plans/future/native-{os.getpid()}-{time.time_ns()}"
 slug=location.rsplit("/",1)[1]
 agent=tmp_path/"agent";env={**os.environ,"PRIME_AGENT_PLUGIN_ROOT":str(agent)};ap=run([str(APPLY)],env);assert ap.returncode==0,ap.stdout+ap.stderr
 sock=Path(f"/tmp/pc-daemon-{os.getpid()}-{time.time_ns()}.sock");daemon=FakeDaemon(sock);request.addfinalizer(daemon.close)
 records=tmp_path/"records.jsonl";probe=agent/"extensions/probe-provider.ts";provider(probe,records,location,sock)
 project=tmp_path/"project";project.mkdir();git(project,"init","-q");git(project,"config","user.email","poc@example.invalid");git(project,"config","user.name","POC")
 for name in ["implement-spec","handoff","execute"]:
  target=project/f".ralph/skills/{name}/SKILL.md";target.parent.mkdir(parents=True,exist_ok=True);target.write_text(f"---\nname: {name}\ndescription: native {name} fixture\n---\n{name} policy")
 target=project/".ralph/skills/oversee-episode/SKILL.md";target.parent.mkdir(parents=True,exist_ok=True);target.write_text((REPO/".ralph/skills/oversee-episode/SKILL.md").read_text().replace("name: oversee-episode", "name: \"oversee-episode\"", 1))
 future=project/location;future.mkdir(parents=True);(future/"SPECIFICATION.md").write_text("spec");(future/"EXECUTION_PLAN.md").write_text("plan");git(project,"add",".");git(project,"commit","-qm","fixture")
 sessions=tmp_path/"sessions";sessions.mkdir()
 state_root=project/".prime/agent/state/spec-episodes"
 expected_worktree=tmp_path/f"project-{slug}-episode"
 def cleanup_native_episode():
  cleanup_episode(project,expected_worktree,f"episode/{slug}",daemon,sock,state_root,sessions)
 request.addfinalizer(cleanup_native_episode)
 project_link=tmp_path/"project-link";project_link.symlink_to(project, target_is_directory=True)
 launch_project=Path(str(project_link).replace("/private/var/", "/var/", 1)) if str(project_link).startswith("/private/var/") else project_link
 baseenv={**os.environ,"PRIME_AGENT_CODING_AGENT_DIR":str(agent),"PRIME_CLAW_TEST_DAEMON_SOCKET":str(sock),"PRIME_CLAW_TEST_DAEMON_REGISTRY":str(tmp_path/"supervisor"),"PROBE_MODE":"activate"}
 first=run([PRIME,"--mode","text","--offline","--session-dir",str(sessions),"--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(launch_project),"--provider","poc","--model","m","-p",f"/implement-spec {location}"],baseenv)
 assert first.returncode==0,first.stdout+first.stderr
 assert records.exists(),first.stdout+first.stderr
 assert_creation_trace(daemon)
 identity=json.loads((project/".prime/agent/state/spec-episodes"/f"{slug}.json").read_text());assert identity["ownerSessionId"]!=identity["episodeId"];assert identity["episodeActiveSessionId"]=="active-episode"
 owner_files=[p for p in sessions.glob("*.jsonl") if p!=Path(identity["episodeSessionFile"])];assert len(owner_files)==1
 owner_entries=[json.loads(x) for x in owner_files[0].read_text().splitlines()];assert any(e.get("customType")=="prime-claw-conversation-oversight" for e in owner_entries)
 conflict_location=".ralph/plans/future/conflicting-live";(project/conflict_location).mkdir(parents=True);before_conflict=len(records.read_text().splitlines());conflict=run([PRIME,"--mode","text","--offline","--session-dir",str(sessions),"--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(launch_project),"--provider","poc","--model","m","--resume",str(owner_files[0]),"-p",f"/implement-spec {conflict_location}"],{**baseenv,"PROBE_MODE":"plain"});assert conflict.returncode!=0;assert len(records.read_text().splitlines())==before_conflict;assert not (project/".prime/agent/state/spec-episodes/conflicting-live.json").exists()
 episode_entries=[json.loads(x) for x in Path(identity["episodeSessionFile"]).read_text().splitlines()];assert any(e.get("customType")=="prime-claw-bounded-identity" for e in episode_entries)
 rows=[json.loads(x) for x in records.read_text().splitlines()];assert_runtime_guard(records,sock);assert all(row["transportIsFake"] is True for row in rows);assert rows[0]["kernel"]==1 and rows[-1]["package"]==1;assert_creation_trace(daemon)
 # Simulate a crash between durable episode identity and owner marker; resume recovers deterministically.
 retained=[line for line in owner_files[0].read_text().splitlines() if json.loads(line).get("customType")!="prime-claw-conversation-oversight"]
 owner_files[0].write_text("\n".join(retained)+"\n")
 recover_env={**baseenv,"PROBE_MODE":"plain"};recovered=run([PRIME,"--mode","text","--offline","--session-dir",str(sessions),"--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(launch_project),"--provider","poc","--model","m","--resume",str(owner_files[0]),"-p","recover"],recover_env)
 assert recovered.returncode==0,recovered.stdout+recovered.stderr
 recovered_entries=[json.loads(x) for x in owner_files[0].read_text().splitlines()];assert any(e.get("customType")=="prime-claw-conversation-oversight" for e in recovered_entries);assert any(e.get("customType")=="prime-claw-oversight-recovery" for e in recovered_entries)
 # Replace the recovered marker payload with the exact rejected v1 schema and prove native migration.
 rewritten=[]
 for entry in recovered_entries:
  if entry.get("customType")=="prime-claw-conversation-oversight":
   data=entry["data"];entry={**entry,"data":{"version":1,"status":"active","ownerSessionId":data["ownerSessionId"],"sourceLocation":data["sourceLocation"],"slug":data["slug"],"episodeId":data["episodeId"],"episodeSessionFile":data["episodeSessionFile"]}}
  rewritten.append(entry)
 for entry in rewritten:
  if entry.get("customType")=="prime-claw-conversation-oversight":entry["data"]["episodeSessionFile"]="/wrong/session.jsonl"
 owner_files[0].write_text("\n".join(json.dumps(entry) for entry in rewritten)+"\n")
 before_bad=len(records.read_text().splitlines());legacy_bad=run([PRIME,"--mode","text","--offline","--session-dir",str(sessions),"--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(launch_project),"--provider","poc","--model","m","--resume",str(owner_files[0]),"-p","legacy bad"],recover_env);assert legacy_bad.returncode!=0;assert len(records.read_text().splitlines())==before_bad
 for entry in rewritten:
  if entry.get("customType")=="prime-claw-conversation-oversight":entry["data"]["episodeSessionFile"]=identity["episodeSessionFile"]
 owner_files[0].write_text("\n".join(json.dumps(entry) for entry in rewritten)+"\n")
 legacy=run([PRIME,"--mode","text","--offline","--session-dir",str(sessions),"--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(launch_project),"--provider","poc","--model","m","--resume",str(owner_files[0]),"-p","legacy"],recover_env);assert legacy.returncode==0,legacy.stdout+legacy.stderr
 legacy_entries=[json.loads(x) for x in owner_files[0].read_text().splitlines()];assert any(e.get("customType")=="prime-claw-conversation-oversight" and e.get("data",{}).get("markerVersion")==2 for e in legacy_entries);assert any(e.get("customType")=="prime-claw-oversight-recovery" and "Migrated legacy" in e.get("content","") for e in legacy_entries)
 resume_env={**baseenv,"PROBE_MODE":"plain"};before_reload=len(records.read_text().splitlines());second=run([PRIME,"--mode","text","--offline","--session-dir",str(sessions),"--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(launch_project),"--provider","poc","--model","m","--resume",str(owner_files[0]),"-p","/probe-reload"],resume_env);assert second.returncode==0,second.stdout+second.stderr;assert len(records.read_text().splitlines())==before_reload
 third=run([PRIME,"--mode","text","--offline","--session-dir",str(sessions),"--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(launch_project),"--provider","poc","--model","m","--resume",str(owner_files[0]),"-p","resume"],resume_env);assert third.returncode==0,third.stdout+third.stderr;assert json.loads(records.read_text().splitlines()[-1])["package"]==1
 # Promotion is fail-closed under project or CLI append shadowing, while no expectation is created.
 shadow_location=".ralph/plans/future/shadow-promotion"; (project/shadow_location).mkdir(parents=True)
 project_append=project/".prime/agent/APPEND_SYSTEM.md";project_append.parent.mkdir(parents=True,exist_ok=True);project_append.write_text("PROJECT SHADOW")
 shadow_before=len(records.read_text().splitlines());shadowed=run([PRIME,"--mode","text","--offline","--no-session","--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(launch_project),"--provider","poc","--model","m","-p",f"/implement-spec {shadow_location}"],resume_env);assert shadowed.returncode!=0;assert len(records.read_text().splitlines())==shadow_before;assert not (project/".prime/agent/state/spec-episodes/shadow-promotion.json").exists();project_append.write_text("PRIME_CLAW_CONVERSATION_IDENTITY_V1")
 token_only=run([PRIME,"--mode","text","--offline","--no-session","--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(launch_project),"--provider","poc","--model","m","-p",f"/implement-spec {shadow_location}"],resume_env);assert token_only.returncode!=0;assert len(records.read_text().splitlines())==shadow_before;project_append.unlink()
 package_path=project/".ralph/skills/oversee-episode/SKILL.md";package_body=package_path.read_text()
 for invalid_package in ["---\nname: oversee-episode\n---\n","---\nname: oversee-episode\ndescription: ok\nname: other\n---\nbody","---\nmetadata:\n  name: oversee-episode\n---\nbody","---\nname: \"unterminated\ndescription: ok\n---\nbody","---\nname: oversee-episode\ndescription: [unterminated\n---\nbody","---\nname: oversee-episode\ndescription: \"unterminated\n---\nbody","---\nname: oversee-episode\ndescription: ok\nmetadata:\n  nested: value\n---\nbody","---\nname: oversee-episode\ndescription: ok\nmetadata:\n  nested: one\n  nested: two\n---\nbody"]:
  package_path.write_text(invalid_package);truncated=run([PRIME,"--mode","text","--offline","--no-session","--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(launch_project),"--provider","poc","--model","m","-p",f"/implement-spec {shadow_location}"],resume_env);assert truncated.returncode!=0;assert len(records.read_text().splitlines())==shadow_before
 package_path.write_text(package_body)
 cli_shadow=run([PRIME,"--mode","text","--offline","--no-session","--no-skills","--no-prompt-templates","--no-context-files","--append-system-prompt","CLI SHADOW","--cwd",str(launch_project),"--provider","poc","--model","m","-p",f"/implement-spec {shadow_location}"],resume_env);assert cli_shadow.returncode!=0;assert len(records.read_text().splitlines())==shadow_before
 absent=tmp_path/"absent-agent";absent.mkdir();abs_probe=absent/"probe.ts";absent_location=".ralph/plans/future/extension-absent"; (project/absent_location).mkdir(parents=True);provider(abs_probe,tmp_path/"absent-records.jsonl",absent_location);abs_env={**os.environ,"PRIME_AGENT_CODING_AGENT_DIR":str(absent),"PROBE_MODE":"plain"}
 missing=run([PRIME,"--mode","text","--offline","--no-session","--no-skills","--no-prompt-templates","--no-context-files","--no-extensions","--cwd",str(launch_project),"-e",str(abs_probe),"--provider","poc","--model","m","-p",f"/implement-spec {absent_location}"],abs_env)
 assert not (project/".prime/agent/state/spec-episodes/extension-absent.json").exists(); assert missing.returncode!=0 or "create_spec_episode" not in missing.stdout
 assert_runtime_guard(records,sock)
 assert_creation_trace(daemon)
 assert Path(identity["worktree"])==expected_worktree
 cleanup_native_episode()


def test_installed_inactive_generation_allows_later_cycle_and_is_inert(tmp_path, request):
    assert PRIME
    location=f".ralph/plans/future/later-{os.getpid()}-{time.time_ns()}";slug=location.rsplit("/",1)[1]
    agent=tmp_path/"agent";env={**os.environ,"PRIME_AGENT_PLUGIN_ROOT":str(agent)};assert run([str(APPLY)],env).returncode==0
    sock=Path(f"/tmp/pc-daemon-{os.getpid()}-{time.time_ns()}.sock");daemon=FakeDaemon(sock);records=tmp_path/"records.jsonl"
    request.addfinalizer(daemon.close)
    # Provider creates beta, probes alpha's inert inactive bookkeeping during beta, then finishes.
    probe=agent/"extensions/probe-provider.ts"
    provider_source=r'''import net from"node:net";import{appendFileSync,lstatSync}from"node:fs";const fake=__SOCKET__,transport=__TRANSPORT__;if(!lstatSync(fake).isSocket())throw Error("fake socket missing");process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET=fake;const originalConnect=net.Socket.prototype.connect;function guardedConnect(...args){let arg=args[0];if(Array.isArray(arg))arg=arg[0];const path=typeof arg==="string"?arg:arg?.path;if(path!==fake)throw Error("non-fixture transport denied");appendFileSync(transport,JSON.stringify({kind:"connect",path,isFake:true})+"\n");return originalConnect.apply(this,args)}net.Socket.prototype.connect=guardedConnect;if(process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET!==fake||net.Socket.prototype.connect!==guardedConnect)throw Error("fake transport not effective");appendFileSync(transport,JSON.stringify({kind:"runtime-guard",socket:fake,transportIsFake:true})+"\n");
import{createAssistantMessageEventStream}from"@earendil-works/pi-ai";
const p=__RECORDS__;let calls=0,mode=process.env.PROBE_MODE;
function m(model,content,reason){return{role:"assistant",content,api:model.api,provider:model.provider,model:model.id,usage:{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:reason,timestamp:Date.now()}}
export default function x(pi){pi.registerProvider("poc",{baseUrl:"x",apiKey:"x",api:"poc",streamSimple(model,context){calls++;const messages=context.messages??[],serialized=JSON.stringify(messages),result=messages.findLast(value=>value?.role==="toolResult"&&(value.toolCallId==="replay"||value.toolCallId==="replay-restart")),alphaResult=result?{toolCallId:result.toolCallId,text:(result.content??[]).map(value=>value?.text??"").join(""),isError:result.isError??false,details:result.details??null}:null;appendFileSync(p,JSON.stringify({calls,package:serialized.split("# Oversee episode").length-1,alphaResult})+"\n");const s=createAssistantMessageEventStream();queueMicrotask(()=>{let tc;if(mode==="replay"&&calls===1)tc={type:"toolCall",id:"replay-restart",name:"finalize_spec_episode",arguments:{location:".ralph/plans/future/alpha"}};if(mode!=="replay"&&calls===1)tc={type:"toolCall",id:"create",name:"create_spec_episode",arguments:{location:__LOCATION__}};if(mode!=="replay"&&calls===2)tc={type:"toolCall",id:"replay",name:"finalize_spec_episode",arguments:{location:".ralph/plans/future/alpha"}};if(tc){const z=m(model,[tc],"toolUse");s.push({type:"start",partial:z});s.push({type:"toolcall_start",contentIndex:0,partial:z});s.push({type:"toolcall_end",contentIndex:0,toolCall:tc,partial:z});s.push({type:"done",reason:"toolUse",message:z})}else{const z=m(model,[{type:"text",text:"ok"}],"stop");s.push({type:"start",partial:z});s.push({type:"done",reason:"stop",message:z})}s.end()});return s},models:[{id:"m",name:"M",reasoning:false,input:["text"],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:100000,maxTokens:1000}]})}
'''
    probe.write_text(provider_source.replace("__SOCKET__",json.dumps(str(sock))).replace("__TRANSPORT__",json.dumps(str(records.with_suffix(".transport.jsonl")))).replace("__RECORDS__",json.dumps(str(records))).replace("__LOCATION__",json.dumps(location)))
    project=tmp_path/"project";project.mkdir();git(project,"init","-q");git(project,"config","user.email","poc@example.invalid");git(project,"config","user.name","POC")
    for name in ["implement-spec","handoff","execute"]:
        target=project/f".ralph/skills/{name}/SKILL.md";target.parent.mkdir(parents=True,exist_ok=True);target.write_text(f"---\nname: {name}\ndescription: native {name} fixture\n---\n{name}")
    skill=project/".ralph/skills/oversee-episode/SKILL.md";skill.parent.mkdir(parents=True,exist_ok=True);skill.write_text((REPO/".ralph/skills/oversee-episode/SKILL.md").read_text())
    future=project/location;future.mkdir(parents=True);(future/"SPECIFICATION.md").write_text("spec");(future/"EXECUTION_PLAN.md").write_text("plan")
    # Test-only setup records one exact old completed generation for the new owner UUID.
    setup=agent/"extensions/aaa-completed-setup.ts";state=project/".prime/agent/state/spec-episodes";setup.write_text(rf'''export default function s(pi){{pi.on("session_start",(_e,ctx)=>{{const owner=ctx.sessionManager.getSessionId(),exists=ctx.sessionManager.getBranch().some(e=>e.type==="custom"&&e.customType==="prime-claw-conversation-oversight"&&e.data?.sourceLocation===".ralph/plans/future/alpha");if(!exists)pi.appendEntry("prime-claw-conversation-oversight",{{markerVersion:2,status:"inactive",ownerSessionId:owner,slug:"alpha",sourceLocation:".ralph/plans/future/alpha",episodeId:"11111111-1111-4111-8111-111111111111",episodeSessionFile:"/old/episode.jsonl",branch:"episode/alpha",worktree:"/old/worktree",sessionName:"alpha-episode",identityVersion:2,admission:"delivered"}})}})}}''')
    git(project,"add",".");git(project,"commit","-qm","fixture")
    sessions=tmp_path/"sessions";sessions.mkdir();expected_worktree=tmp_path/f"project-{slug}-episode"
    def cleanup_later_episode():
        cleanup_episode(project,expected_worktree,f"episode/{slug}",daemon,sock,state,sessions)
    request.addfinalizer(cleanup_later_episode)
    env2={**os.environ,"PRIME_AGENT_CODING_AGENT_DIR":str(agent),"PRIME_CLAW_TEST_DAEMON_REGISTRY":str(tmp_path/"supervisor"),"PROBE_MODE":"later"}
    cp=run([PRIME,"--mode","text","--offline","--session-dir",str(sessions),"--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(project),"--provider","poc","--model","m","-p",f"/implement-spec {location}"],env2);assert cp.returncode==0,cp.stdout+cp.stderr;assert records.exists(),cp.stdout+cp.stderr;assert_creation_trace(daemon)
    beta_path=state/f"{slug}.json";beta_raw=beta_path.read_text();beta=json.loads(beta_raw);assert beta["bootstrapAdmission"]=="delivered" and beta["episodeActiveSessionId"]=="active-episode"
    rows=[json.loads(x) for x in records.read_text().splitlines()];assert_runtime_guard(records,sock);alpha_result=rows[-1]["alphaResult"];assert len(rows)>=3 and rows[1]["package"]==1 and rows[-1]["package"]==1 and alpha_result["toolCallId"]=="replay" and alpha_result["isError"] is False and alpha_result["text"]=="Episode bookkeeping was already closed for .ralph/plans/future/alpha. CONVERSATION capability remains." and alpha_result["details"]["reused"] is True,rows
    assert Path(beta["worktree"])==expected_worktree
    owner_files=list(sessions.glob("*.jsonl"));assert len(owner_files)==1,owner_files
    def oversight_markers():
        return [json.loads(line)["data"] for line in owner_files[0].read_text().splitlines() if json.loads(line).get("customType")=="prime-claw-conversation-oversight"]
    markers_before=oversight_markers();commands_before=len(daemon.commands);rows_before=len(rows)
    replay_env={**env2,"PROBE_MODE":"replay"};replay=run([PRIME,"--mode","text","--offline","--session-dir",str(sessions),"--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(project),"--provider","poc","--model","m","--resume",str(owner_files[0]),"-p","replay old alpha after restart"],replay_env)
    assert replay.returncode==0,replay.stdout+replay.stderr;assert beta_path.read_text()==beta_raw;assert oversight_markers()==markers_before;assert len(daemon.commands)==commands_before
    replay_rows=[json.loads(x) for x in records.read_text().splitlines()][rows_before:];restart_result=replay_rows[-1]["alphaResult"];assert len(replay_rows)>=2 and replay_rows[0]["package"]==1 and replay_rows[-1]["package"]==1 and restart_result["toolCallId"]=="replay-restart" and restart_result["isError"] is False and restart_result["text"]=="Episode bookkeeping was already closed for .ralph/plans/future/alpha. CONVERSATION capability remains." and restart_result["details"]["reused"] is True,replay_rows
    cleanup_later_episode()
