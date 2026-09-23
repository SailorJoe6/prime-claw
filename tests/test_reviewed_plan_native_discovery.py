import json
import os
import shutil
import socket
import subprocess
import threading
import time
from pathlib import Path

REPO=Path(__file__).resolve().parents[1];APPLY=REPO/"scripts/apply-prime-agent-plugin.sh";PRIME=shutil.which("prime-agent")
def git(cwd,*args): return subprocess.run(["git","-C",str(cwd),*args],check=True,text=True,capture_output=True).stdout.strip()
class FakeDaemon:
 def __init__(self,path):
  self.commands=[];self.stop=False;self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.bind(str(path));self.sock.listen();self.thread=threading.Thread(target=self.run,daemon=True);self.thread.start()
 def run(self):
  while not self.stop:
   try:self.sock.settimeout(.2);conn,_=self.sock.accept()
   except (TimeoutError,socket.timeout,OSError):continue
   with conn:
    conn.sendall((json.dumps({"type":"daemon_hello","protocol":{"name":"prime-agent.daemon","version":7},"schema":{"revision":28}})+"\n").encode());buf=b""
    while not self.stop:
     data=conn.recv(65536)
     if not data:break
     buf+=data
     while b"\n" in buf:
      line,buf=buf.split(b"\n",1)
      if not line:continue
      msg=json.loads(line);cmd=msg.get("command",{});self.commands.append(cmd);typ=cmd.get("type")
      if typ=="ack_result":continue
      if typ=="list":payload={"sessions":[]}
      elif typ=="create":
       header=json.loads(Path(cmd["sessionPath"]).read_text().splitlines()[0]);payload={"activeSessionId":"active-episode","sessionId":header["id"],"sessionFile":cmd["sessionPath"],"sessionName":cmd["name"],"cwd":cmd["config"]["cwd"],"isSessionActive":True}
      elif typ in {"prompt","kill"}:payload={"ok":True}
      else:payload={}
      conn.sendall((json.dumps({"type":"response","id":msg["id"],"success":True,"data":payload})+"\n").encode())
 def close(self):
  self.stop=True
  try:self.sock.close()
  except OSError:pass
  self.thread.join(2)
def provider(path,records,location):
 path.write_text(rf'''import{{appendFileSync}}from"node:fs";import{{createAssistantMessageEventStream}}from"@earendil-works/pi-ai";const p={json.dumps(str(records))};let calls=0;function msg(model,content,reason){{return{{role:"assistant",content,api:model.api,provider:model.provider,model:model.id,usage:{{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}}},stopReason:reason,timestamp:Date.now()}}}}export default function x(pi){{pi.registerCommand("probe-reload",{{description:"reload",handler:async(_a,ctx)=>ctx.reload()}});pi.registerProvider("poc",{{baseUrl:"x",apiKey:"x",api:"poc",streamSimple(model,context){{calls++;const all=JSON.stringify(context.messages??[]);appendFileSync(p,JSON.stringify({{calls,kernel:context.systemPrompt.split("PRIME_CLAW_CONVERSATION_IDENTITY_V1").length-1,package:all.split("name: oversee-episode").length-1}})+"\n");const s=createAssistantMessageEventStream();queueMicrotask(()=>{{if(process.env.PROBE_MODE==="activate"&&calls===1){{const tc={{type:"toolCall",id:"create",name:"create_spec_episode",arguments:{{location:"{location}"}}}},m=msg(model,[tc],"toolUse");s.push({{type:"start",partial:m}});s.push({{type:"toolcall_start",contentIndex:0,partial:m}});s.push({{type:"toolcall_end",contentIndex:0,toolCall:tc,partial:m}});s.push({{type:"done",reason:"toolUse",message:m}})}}else{{const m=msg(model,[{{type:"text",text:"ok"}}],"stop");s.push({{type:"start",partial:m}});s.push({{type:"done",reason:"stop",message:m}})}}s.end()}});return s}},models:[{{id:"m",name:"M",reasoning:false,input:["text"],cost:{{input:0,output:0,cacheRead:0,cacheWrite:0}},contextWindow:100000,maxTokens:1000}}]}})}}''')
def run(args,env):return subprocess.run(args,cwd=REPO,env=env,text=True,capture_output=True,timeout=40)
def test_installed_discovery_real_implement_spec_activation_resume_and_absence(tmp_path):
 assert PRIME
 location=f".ralph/plans/future/native-{os.getpid()}-{time.time_ns()}"
 slug=location.rsplit("/",1)[1]
 agent=tmp_path/"agent";env={**os.environ,"PRIME_AGENT_PLUGIN_ROOT":str(agent)};ap=run([str(APPLY)],env);assert ap.returncode==0,ap.stdout+ap.stderr
 records=tmp_path/"records.jsonl";probe=agent/"extensions/probe-provider.ts";provider(probe,records,location)
 project=tmp_path/"project";project.mkdir();git(project,"init","-q");git(project,"config","user.email","poc@example.invalid");git(project,"config","user.name","POC")
 for name in ["implement-spec","handoff","execute"]:
  target=project/f".ralph/skills/{name}/SKILL.md";target.parent.mkdir(parents=True,exist_ok=True);target.write_text(f"---\nname: {name}\n---\n{name} policy")
 target=project/".ralph/skills/oversee-episode/SKILL.md";target.parent.mkdir(parents=True,exist_ok=True);target.write_text((REPO/".ralph/skills/oversee-episode/SKILL.md").read_text())
 future=project/location;future.mkdir(parents=True);(future/"SPECIFICATION.md").write_text("spec");(future/"EXECUTION_PLAN.md").write_text("plan");git(project,"add",".");git(project,"commit","-qm","fixture")
 sessions=tmp_path/"sessions";sessions.mkdir();sock=Path(f"/tmp/pc-daemon-{os.getpid()}-{time.time_ns()}.sock");daemon=FakeDaemon(sock)
 baseenv={**os.environ,"PRIME_AGENT_CODING_AGENT_DIR":str(agent),"PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET":str(sock),"PROBE_MODE":"activate"}
 first=run([PRIME,"--mode","text","--offline","--session-dir",str(sessions),"--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(project),"--provider","poc","--model","m","-p",f"/implement-spec {location}"],baseenv)
 assert first.returncode==0,first.stdout+first.stderr
 identity=json.loads((project/".prime/agent/state/spec-episodes"/f"{slug}.json").read_text());assert identity["ownerSessionId"]!=identity["episodeId"]
 owner_files=[p for p in sessions.glob("*.jsonl") if p!=Path(identity["episodeSessionFile"])];assert len(owner_files)==1
 owner_entries=[json.loads(x) for x in owner_files[0].read_text().splitlines()];assert any(e.get("customType")=="prime-claw-conversation-oversight" for e in owner_entries)
 episode_entries=[json.loads(x) for x in Path(identity["episodeSessionFile"]).read_text().splitlines()];assert any(e.get("customType")=="prime-claw-bounded-identity" for e in episode_entries)
 rows=[json.loads(x) for x in records.read_text().splitlines()];assert rows[0]["kernel"]==1 and rows[-1]["package"]==1
 # Simulate a crash between durable episode identity and owner marker; resume recovers deterministically.
 retained=[line for line in owner_files[0].read_text().splitlines() if json.loads(line).get("customType")!="prime-claw-conversation-oversight"]
 owner_files[0].write_text("\n".join(retained)+"\n")
 recover_env={**baseenv,"PROBE_MODE":"plain"};recovered=run([PRIME,"--mode","text","--offline","--session-dir",str(sessions),"--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(project),"--provider","poc","--model","m","--resume",str(owner_files[0]),"-p","recover"],recover_env)
 assert recovered.returncode==0,recovered.stdout+recovered.stderr
 recovered_entries=[json.loads(x) for x in owner_files[0].read_text().splitlines()];assert any(e.get("customType")=="prime-claw-conversation-oversight" for e in recovered_entries);assert any(e.get("customType")=="prime-claw-oversight-recovery" for e in recovered_entries)
 resume_env={**baseenv,"PROBE_MODE":"plain"};before_reload=len(records.read_text().splitlines());second=run([PRIME,"--mode","text","--offline","--session-dir",str(sessions),"--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(project),"--provider","poc","--model","m","--resume",str(owner_files[0]),"-p","/probe-reload"],resume_env);assert second.returncode==0,second.stdout+second.stderr;assert len(records.read_text().splitlines())==before_reload
 third=run([PRIME,"--mode","text","--offline","--session-dir",str(sessions),"--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(project),"--provider","poc","--model","m","--resume",str(owner_files[0]),"-p","resume"],resume_env);assert third.returncode==0,third.stdout+third.stderr;assert json.loads(records.read_text().splitlines()[-1])["package"]==1
 # Promotion is fail-closed under project or CLI append shadowing, while no expectation is created.
 shadow_location=".ralph/plans/future/shadow-promotion"; (project/shadow_location).mkdir(parents=True)
 project_append=project/".prime/agent/APPEND_SYSTEM.md";project_append.parent.mkdir(parents=True,exist_ok=True);project_append.write_text("PROJECT SHADOW")
 shadow_before=len(records.read_text().splitlines());shadowed=run([PRIME,"--mode","text","--offline","--no-session","--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(project),"--provider","poc","--model","m","-p",f"/implement-spec {shadow_location}"],resume_env);assert shadowed.returncode!=0;assert len(records.read_text().splitlines())==shadow_before;assert not (project/".prime/agent/state/spec-episodes/shadow-promotion.json").exists();project_append.write_text("PRIME_CLAW_CONVERSATION_IDENTITY_V1")
 token_only=run([PRIME,"--mode","text","--offline","--no-session","--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(project),"--provider","poc","--model","m","-p",f"/implement-spec {shadow_location}"],resume_env);assert token_only.returncode!=0;assert len(records.read_text().splitlines())==shadow_before;project_append.unlink()
 package_path=project/".ralph/skills/oversee-episode/SKILL.md";package_body=package_path.read_text();package_path.write_text("---\nname: oversee-episode\n---\n")
 truncated=run([PRIME,"--mode","text","--offline","--no-session","--no-skills","--no-prompt-templates","--no-context-files","--cwd",str(project),"--provider","poc","--model","m","-p",f"/implement-spec {shadow_location}"],resume_env);assert truncated.returncode!=0;assert len(records.read_text().splitlines())==shadow_before;package_path.write_text(package_body)
 cli_shadow=run([PRIME,"--mode","text","--offline","--no-session","--no-skills","--no-prompt-templates","--no-context-files","--append-system-prompt","CLI SHADOW","--cwd",str(project),"--provider","poc","--model","m","-p",f"/implement-spec {shadow_location}"],resume_env);assert cli_shadow.returncode!=0;assert len(records.read_text().splitlines())==shadow_before
 daemon.close(); sock.unlink(missing_ok=True)
 absent=tmp_path/"absent-agent";absent.mkdir();abs_probe=absent/"probe.ts";absent_location=".ralph/plans/future/extension-absent"; (project/absent_location).mkdir(parents=True);provider(abs_probe,tmp_path/"absent-records.jsonl",absent_location);abs_env={**os.environ,"PRIME_AGENT_CODING_AGENT_DIR":str(absent),"PROBE_MODE":"plain"}
 missing=run([PRIME,"--mode","text","--offline","--no-session","--no-skills","--no-prompt-templates","--no-context-files","--no-extensions","--cwd",str(project),"-e",str(abs_probe),"--provider","poc","--model","m","-p",f"/implement-spec {absent_location}"],abs_env)
 assert not (project/".prime/agent/state/spec-episodes/extension-absent.json").exists(); assert missing.returncode!=0 or "create_spec_episode" not in missing.stdout
 worktree=Path(identity["worktree"])
 if worktree.exists():git(project,"worktree","remove","--force",str(worktree))
 if git(project,"branch","--list",f"episode/{slug}"):git(project,"branch","-D",f"episode/{slug}")
