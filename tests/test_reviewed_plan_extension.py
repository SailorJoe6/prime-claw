"""Reviewed plan and Episode lifecycle regression bridge.

Behavior suites run inside the isolated Tier-1 container. Static policy checks
remain host-safe Tier 0.
"""
import json
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
EXTENSION = REPO / "src/prime-agent-plugin/extensions/reviewed-plan.ts"
EPISODE_EXTENSION = REPO / "src/prime-agent-plugin/extension-support/spec-episode.ts"
WS_EXTENSION = "/workspace/src/prime-agent-plugin/extensions/reviewed-plan.ts"
WS_EPISODE_EXTENSION = "/workspace/src/prime-agent-plugin/extension-support/spec-episode.ts"
WS_REVIEWED_PLAN_NODE_SUITE = "/workspace/tests/reviewed_plan_extension.test.mjs"
WS_SPEC_EPISODE_NODE_SUITE = "/workspace/tests/spec_episode_extension.test.mjs"
WS_EPISODE_CLOSE_NODE_SUITE = "/workspace/tests/episode_close_extension.test.mjs"


def test_reviewed_plan_node_suite(tier1_container) -> None:
    result = tier1_container.run("node", "--experimental-strip-types", "--test", WS_REVIEWED_PLAN_NODE_SUITE, timeout=120)
    assert result.returncode == 0, result.stdout + result.stderr


def test_spec_episode_node_suite(tier1_container) -> None:
    result = tier1_container.run("node", "--experimental-strip-types", "--test", WS_SPEC_EPISODE_NODE_SUITE, timeout=180)
    assert result.returncode == 0, result.stdout + result.stderr


def test_task_episode_ownership_node_suite(tier1_container) -> None:
    result = tier1_container.run("node", "--experimental-strip-types", "--test", "/workspace/tests/task_episode_ownership_extension.test.mjs", timeout=120)
    assert result.returncode == 0, result.stdout + result.stderr


def test_episode_close_node_suite(tier1_container) -> None:
    result = tier1_container.run("node", "--experimental-strip-types", "--test", WS_EPISODE_CLOSE_NODE_SUITE, timeout=120)
    assert result.returncode == 0, result.stdout + result.stderr


def test_real_v098_fresh_session_is_flushed_before_daemon_publication(tier1_container, ctmp) -> None:
    cwd = ctmp / "fresh-session"
    cwd.mkdir()
    result_file = ctmp / "fresh-session-result.json"
    driver = ctmp / "fresh-session-proof.ts"
    driver.write_text(f"""import {{existsSync,writeFileSync}} from 'node:fs';
import {{SessionManager}} from '@earendil-works/pi-coding-agent';
import {{PrimeSessionPublisher,runtimeSessionManagerClass}} from '{WS_EPISODE_EXTENSION}';
const cwd={json.dumps(str(cwd))},resultFile={json.dumps(str(result_file))};
export default function proof(pi){{pi.on('session_start',async()=>{{
  try{{
    const Runtime=runtimeSessionManagerClass(SessionManager.inMemory(cwd));
    let allocated;
    const client={{async request(command){{
      if(command.type!=='create')throw new Error('unexpected daemon request '+command.type);
      if(!existsSync(command.sessionPath))throw new Error('allocated header was not durable');
      const opened=await SessionManager.openAsync(command.sessionPath,undefined,command.config.cwd);
      return {{success:true,data:{{activeSessionId:'route',sessionId:opened.getSessionId(),sessionFile:command.sessionPath,cwd:command.config.cwd,sessionName:command.name}}}};
    }},close(){{}}}};
    const publisher=new PrimeSessionPublisher(client,Runtime);
    const published=await publisher.createFresh({{worktree:cwd,sessionName:'fresh-episode',onAllocated(identity){{allocated=identity;if(!existsSync(identity.sessionFile))throw new Error('allocation callback preceded flush');}}}});
    publisher.close();
    writeFileSync(resultFile,JSON.stringify({{allocated,published,sameId:allocated.sessionId===published.sessionId,sameFile:allocated.sessionFile===published.sessionFile}}));
  }}catch(error){{writeFileSync(resultFile,JSON.stringify({{error:String(error),stack:error?.stack}}));}}
}})}}
""")
    request = json.dumps({"id": "commands", "type": "get_commands"}) + "\n"
    result = tier1_container.run(
        "/workspace/scripts/run-prime-agent-probe.sh", tier1_container.prime_agent,
        "--mode", "rpc", "--offline", "--no-session", "--no-skills", "--no-prompt-templates", "--no-context-files", "--no-extensions",
        "--cwd", str(cwd), "-e", str(driver), input_text=request, timeout=60, workdir=None,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    proof = json.loads(result_file.read_text())
    assert "error" not in proof, proof
    assert proof["sameId"] is True
    assert proof["sameFile"] is True
    assert proof["published"]["activeSessionId"] == "route"



def test_native_creation_session_assignment_and_saved_session_reuse(tier1_container, ctmp) -> None:
    """Real daemon component proof; no claim of Orca or whole-creation recovery."""
    repo = ctmp / "session-component"
    repo.mkdir()
    worktree = ctmp / "allocated-worktree"
    for args in (("init", "-q", "-b", "main"),
                 ("-c", "user.name=Fixture", "-c", "user.email=fixture@example.test",
                  "commit", "--allow-empty", "-qm", "Native session fixture"),
                 ("worktree", "add", "-q", "-b", "episode/native-component", str(worktree))):
        command = tier1_container.run("git", "-C", str(repo), *args, workdir=None)
        assert command.returncode == 0, command.stdout + command.stderr
    inventory = tier1_container.run("git", "-C", str(repo), "worktree", "list", "--porcelain").stdout
    # An inert local provider permits real native message admission/completion offline.
    # It neither implements recovery judgment nor contacts a provider service.
    provider = worktree / ".prime/agent/extensions/native-component-provider.ts"
    provider.parent.mkdir(parents=True)
    provider.write_text(r"""import {createAssistantMessageEventStream} from '@earendil-works/pi-ai';
export default function fixture(pi){pi.registerProvider('native-component',{
baseUrl:'offline',apiKey:'fixture',api:'native-component',streamSimple(model){
const stream=createAssistantMessageEventStream();queueMicrotask(()=>{
const m={role:'assistant',content:[{type:'text',text:'fixture acknowledged'}],api:model.api,
provider:model.provider,model:model.id,usage:{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,
cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:'stop',timestamp:Date.now()};
stream.push({type:'start',partial:m});stream.push({type:'done',reason:'stop',message:m});stream.end();});
return stream;},models:[{id:'m',name:'Fixture',reasoning:false,input:['text'],
cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:100000,maxTokens:1000}]});}
""")
    result_path = ctmp / "native-component-result.json"
    driver = ctmp / "native-component.ts"
    driver.write_text(r"""import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {DaemonJsonlClient,PrimeSessionPublisher,runtimeSessionManagerClass,CliOrcaAdapter}
from '/workspace/src/prime-agent-plugin/extension-support/spec-episode.ts';
const worktree=__WORKTREE__,repo=__REPO__,resultPath=__RESULT__;
const assignment='Native fixture initial execute assignment. No tools or external actions.\n<operator-episode-task>FIXTURE-1</operator-episode-task>';
export default function proof(pi){pi.on('session_start',async(_event,ctx)=>{
let client,publisher,published;
try{
client=new DaemonJsonlClient(process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET);
publisher=new PrimeSessionPublisher(client,runtimeSessionManagerClass(ctx.sessionManager));
const before=(await publisher.list()).filter(s=>s.cwd===worktree);
if(before.length)throw new Error('fixture worktree already has a native session');
let allocated;
published=await publisher.createFresh({worktree,sessionName:'native-component-episode',
model:{provider:'native-component',id:'m'},onAllocated(identity){
if(!existsSync(identity.sessionFile))throw new Error('session header was not durable');allocated=identity;}});
await publisher.deliverExecute(published.activeSessionId,assignment);
const idle=await client.request({type:'wait_for_idle',activeSessionId:published.activeSessionId},15000);
if(idle.success!==true)throw new Error('native idle request failed');
const firstMessages=await publisher.getMessages(published.activeSessionId);
const userAssignments=messages=>messages.filter(m=>m.role==='user'&&JSON.stringify(m.content).includes('Native fixture initial execute assignment.'));
if(userAssignments(firstMessages).length!==1)throw new Error('native session does not contain exactly one assignment');
const beforeKill=await publisher.getState(published.activeSessionId);
if(beforeKill.sessionId!==published.sessionId||beforeKill.cwd!==worktree)throw new Error('native state identity drift');
await publisher.kill(published.activeSessionId);
const saved=JSON.parse(readFileSync(published.sessionFile,'utf8').split('\n').find(Boolean));
const reopened=await publisher.reopen({worktree,sessionName:'native-component-episode',
sessionFile:published.sessionFile,sessionId:published.sessionId,model:{provider:'native-component',id:'m'}});
const reused=await publisher.getMessages(reopened.activeSessionId);
const after=(await publisher.list()).filter(s=>s.cwd===worktree);
const state=await publisher.getState(reopened.activeSessionId);
if(after.length!==1||after[0].sessionId!==published.sessionId||state.sessionId!==published.sessionId
||state.cwd!==worktree||reopened.sessionFile!==published.sessionFile
||userAssignments(reused).length!==1||saved.id!==published.sessionId)throw new Error('saved-session reuse changed identity or assignment count');
let orca;
try{await new CliOrcaAdapter().listReadyTaskPlacementSetups(repo);orca={available:true};}
catch(e){orca={available:false,errorName:e.name,missingExecutable:e.cause?.code==='ENOENT'};}
writeFileSync(resultPath,JSON.stringify({scope:'real native daemon/session component, not Orca or whole-recovery proof',
realDaemon:true,initialSessionsAtWorktree:before.length,sessionAllocations:1,initialAssignments:1,
allocatedHeaderDurable:allocated.sessionId===published.sessionId&&allocated.sessionFile===published.sessionFile,
sameDurableSession:true,sameSavedFile:true,sameWorktree:true,finalSessionsAtWorktree:after.length,
assignmentCountAfterReopen:userAssignments(reused).length,extraAssignmentOnReopen:false,orca,
notProven:['owner-led complete creation recovery','Orca allocation/launch/visible terminal binding','ambiguous-delivery recovery','LLM policy compliance','activation']}));
}catch(error){writeFileSync(resultPath,JSON.stringify({error:String(error),stack:error?.stack}));}
finally{publisher?.close();}
});}
""".replace("__WORKTREE__", json.dumps(str(worktree)))
        .replace("__REPO__", json.dumps(str(repo)))
        .replace("__RESULT__", json.dumps(str(result_path))))
    request = json.dumps({"id": "commands", "type": "get_commands"}) + "\n"
    command = tier1_container.run(
        "/workspace/scripts/run-prime-agent-probe.sh", tier1_container.prime_agent,
        "--mode", "rpc", "--offline", "--no-session", "--no-skills", "--no-prompt-templates",
        "--no-context-files", "--no-extensions", "--cwd", str(repo), "-e", str(driver),
        input_text=request, timeout=90, workdir=None,
    )
    assert command.returncode == 0, command.stdout + command.stderr
    proof = json.loads(result_path.read_text())
    assert "error" not in proof, proof
    assert proof["realDaemon"] and proof["allocatedHeaderDurable"]
    assert proof["initialSessionsAtWorktree"] == 0
    assert proof["finalSessionsAtWorktree"] == 1
    assert proof["assignmentCountAfterReopen"] == 1
    assert proof["sameDurableSession"] and proof["sameSavedFile"] and proof["sameWorktree"]
    assert proof["extraAssignmentOnReopen"] is False
    assert tier1_container.run("git", "-C", str(repo), "worktree", "list", "--porcelain").stdout == inventory
    (tier1_container.share.parent / "creation-native-session-component.json").write_text(json.dumps(proof, indent=2) + "\n")


def test_native_orca_packaged_runtime_and_terminal_boundary(tier1_container) -> None:
    """Real packaged headless runtime/PTY evidence, not a recovery simulation."""
    script = r"""import hashlib,json,os,pathlib,selectors,shlex,shutil,subprocess,time
base=pathlib.Path('/home/orca-fixture/native-readiness')
base.mkdir()
profile=base/'profile'
env=dict(os.environ,HOME=str(base),XDG_CONFIG_HOME=str(base/'config'),
         XDG_DATA_HOME=str(base/'data'),XDG_CACHE_HOME=str(base/'cache'),
         ORCA_USER_DATA_PATH=str(profile),ORCA_USER_DATA=str(profile),ORCA_SERVE_RUNTIME='orcad')
cli='/usr/local/bin/orca-ide'
# This is a transport wrapper around the real installed binary, not a mock agent.
# Every native Prime Agent process still uses the existing isolation/cleanup wrapper.
real_prime=shutil.which('prime-agent')
assert real_prime
probe=base/'launch-probe.ts'
launch_file=base/'launch.json'
probe.write_text('''import {writeFileSync} from 'node:fs';
export default function probe(pi){pi.registerProvider('native-readiness',{
baseUrl:'offline',apiKey:'fixture',api:'native-readiness',streamSimple(){throw new Error('readiness sent unexpected work');},
models:[{id:'m',name:'Fixture',reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:100000,maxTokens:1000}]});
pi.on('session_start',async(_event,ctx)=>{ctx.sessionManager.flushNow();
writeFileSync('''+json.dumps(str(launch_file))+''',JSON.stringify({cwd:process.cwd(),sessionId:ctx.sessionManager.getSessionId(),sessionFile:ctx.sessionManager.getSessionFile()}));});}
''')
bin_dir=base/'bin';bin_dir.mkdir()
wrapped=bin_dir/'prime-agent'
wrapped.write_text('#!/bin/sh\nprintf used > '+shlex.quote(str(base/'wrapper-used'))+'\nexec /workspace/scripts/run-prime-agent-probe.sh '+shlex.quote(real_prime)+
                  ' --offline --no-tools --no-skills --no-prompt-templates --no-context-files --no-extensions -e '+
                  shlex.quote(str(probe))+' --provider native-readiness --model m "$@"\n')
wrapped.chmod(0o755)
env['PATH']=str(bin_dir)+':'+env['PATH']
# Login shells may rebuild PATH; this is only the fixture user's fresh HOME.
for login_file in ['.bashrc','.bash_profile','.profile']:
    (base/login_file).write_text('export PATH='+shlex.quote(str(bin_dir))+':$PATH\n')
commands=[]
def native(*args):
    result=subprocess.run([cli,*args,'--json'],env=env,cwd=base,text=True,capture_output=True,timeout=45)
    commands.append({'command':list(args[:2]),'exitCode':result.returncode})
    if result.returncode:
        raise RuntimeError('native '+str(args[:2])+' failed: '+result.stderr[-1800:]+result.stdout[-1800:])
    envelope=json.loads(result.stdout)
    # Pure documentation commands return their JSON directly, unlike RPC envelopes.
    if args==('skills','get','orca-cli'):
        return envelope
    if envelope.get('ok') is not True:
        raise RuntimeError('native '+str(args[:2])+' refused: '+str(envelope.get('error')))
    return envelope['result']
# Load the selected distribution's own guide before runtime operations.
guide=native('skills','get','orca-cli')
assert guide
server=subprocess.Popen([cli,'serve','--json','--no-pairing','--port','6768'],env=env,cwd=base,
                        text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=1)
output=[]; errors=[]; ready=None
try:
    selector=selectors.DefaultSelector()
    selector.register(server.stdout,selectors.EVENT_READ,'out')
    selector.register(server.stderr,selectors.EVENT_READ,'err')
    deadline=time.monotonic()+60
    while ready is None and time.monotonic()<deadline:
        for key,_ in selector.select(max(0,deadline-time.monotonic())):
            line=key.fileobj.readline()
            if not line:
                selector.unregister(key.fileobj)
                continue
            (output if key.data=='out' else errors).append(line)
            try: payload=json.loads(line)
            except json.JSONDecodeError: continue
            if payload.get('type')=='orca_server_ready': ready=payload
        if server.poll() is not None:
            raise RuntimeError('native server exited before ready: '+''.join(errors)[-3000:])
    selector.close()
    assert ready is not None, 'native server did not report ready: '+''.join(errors)[-3000:]
    stderr=''.join(errors)
    assert '[serve] running on orcad ' in stderr, stderr
    assert '[serve] using Electron serve:' not in stderr, stderr
    status=native('status')
    repo=base/'repo'; repo.mkdir()
    for args in [('init','-q','-b','main'),('config','user.name','Fixture'),
                 ('config','user.email','fixture@example.test'),
                 ('commit','--allow-empty','-qm','Native Orca fixture')]:
        subprocess.run(['git','-C',str(repo),*args],env=env,check=True,capture_output=True)
    base_head=subprocess.check_output(['git','-C',str(repo),'rev-parse','HEAD'],env=env,text=True).strip()
    registered=native('repo','add','--path',str(repo))['repo']
    setups=native('project','setups')['setups']
    matching=[s for s in setups if s.get('path')==str(repo) and s.get('setupState')=='ready']
    assert len(matching)==1, 'exact local project setup is not ready'
    created=native('worktree','create','--project-host-setup',matching[0]['id'],
                   '--name','native-orca-readiness','--no-parent','--setup','skip','--base-branch',base_head)['worktree']
    shown=native('worktree','show','--worktree','id:'+created['id'])['worktree']
    assert shown['id']==created['id'] and shown['head']==base_head
    assert shown['projectHostSetupId']==matching[0]['id']
    term=native('terminal','create','--worktree','id:'+created['id'])['terminal']
    before=native('terminal','read','--terminal',term['handle'])['terminal']
    cursor=before['nextCursor']
    nonce=os.urandom(8).hex()
    marker='ORCA_NATIVE_'+nonce
    sent="printf 'ORCA_NATIVE_%s\\n' '"+nonce+"'"
    assert marker not in sent  # Input echo must not satisfy execution evidence.
    native('terminal','send','--terminal',term['handle'],'--text',sent,'--enter')
    emitted=[]
    deadline=time.monotonic()+15
    while marker not in emitted and time.monotonic()<deadline:
        read=native('terminal','read','--terminal',term['handle'],'--cursor',str(cursor),'--limit','1000')['terminal']
        emitted.extend(line.strip() for line in read.get('tail',[]))
        cursor=read['nextCursor']
    assert marker in emitted, 'actual PTY produced no standalone split-nonce output'
    screen=native('terminal','read','--terminal',term['handle'],'--screen')['terminal']
    listed=native('terminal','list','--worktree','id:'+created['id'],'--include-visual-layouts')
    actual=[t for t in listed['terminals'] if t['handle']==term['handle']]
    assert len(actual)==1 and actual[0]['connected'] and actual[0]['writable']
    layouts=listed.get('visualLayouts',[])
    visible=any(l.get('worktreeId')==created['id'] and term['handle'] in json.dumps(l) for l in layouts)
    assert visible, 'native shell terminal is not visible'
    # Supported project settings avoid an interactive first-run trace-sharing choice.
    # This fixture never supplies credentials or opts into telemetry/trace upload.
    settings=pathlib.Path(created['path'])/'.prime/agent/settings.json'
    settings.parent.mkdir(parents=True)
    settings.write_text(json.dumps({'onboardingShown':True,'agentTraces':{'enabled':False},'telemetry':{'enabled':False}}))
    prior_handles={t['handle'] for t in listed['terminals']}
    launch=native('agent','launch','--agent','prime-agent','--worktree','id:'+created['id'],'--surface','terminal')
    launched=native('terminal','list','--worktree','id:'+created['id'],'--include-visual-layouts')
    new_terms=[t for t in launched['terminals'] if t['handle'] not in prior_handles]
    assert len(new_terms)==1, 'native launch did not identify one new terminal'
    agent_handle=new_terms[0]['handle']
    wait_issue=None
    try: native('terminal','wait','--terminal',agent_handle,'--for','tui-idle','--timeout-ms','30000')
    except (RuntimeError,subprocess.TimeoutExpired) as error: wait_issue=str(error)
    # A wait timeout is observation, not non-launch proof or permission to launch again.
    agent_screen=native('terminal','read','--terminal',agent_handle,'--screen')['terminal']
    assert agent_screen['source']=='screen' and '← manage' in '\n'.join(agent_screen['tail']), json.dumps({
        'reason':'native Prime Agent TUI is not ready','wrapperUsed':(base/'wrapper-used').exists(),
        'sessionEvidencePresent':launch_file.exists(),'waitIssue':wait_issue,'screen':agent_screen.get('tail',[])})
    assert (base/'wrapper-used').is_file(), 'Prime Agent launch bypassed the isolation wrapper'
    agent_list=native('terminal','list','--worktree','id:'+created['id'],'--include-visual-layouts')
    agent_terms=[t for t in agent_list['terminals'] if t['handle']==agent_handle]
    assert len(agent_terms)==1 and agent_terms[0]['connected'] and agent_terms[0]['writable']
    agent_visible=any(l.get('worktreeId')==created['id'] and agent_handle in json.dumps(l) for l in agent_list.get('visualLayouts',[]))
    assert agent_visible, 'native Prime Agent terminal is not visible'
    bound=json.loads(launch_file.read_text())
    assert bound['cwd']==created['path']
    saved=[json.loads(line) for line in pathlib.Path(bound['sessionFile']).read_text().splitlines() if line]
    assert saved[0]['id']==bound['sessionId'] and saved[0]['cwd']==created['path']
    assert not any(row.get('message',{}).get('role')=='user' for row in saved), 'readiness unexpectedly admitted an assignment'
    native('terminal','close','--terminal',agent_handle)
    node=pathlib.Path('/opt/orca/squashfs-root/resources/node-runtime/bin/node')
    proof={'scope':'actual isolated packaged Orca runtime and terminal readiness only',
           'distribution':'official v1.4.247 full Linux AppImage','runtime':'orcad',
           'nodeVersion':subprocess.check_output([str(node),'--version'],text=True).strip(),
           'nodeSha256':hashlib.file_digest(node.open('rb'),'sha256').hexdigest(),
           'guideLoaded':True,'freshProfile':True,'exactReadyLocalSetup':True,
           'nativeWorktreeAtOriginalBase':True,'sameShownWorktree':True,
           'terminalConnected':actual[0]['connected'],'terminalWritable':actual[0]['writable'],
           'terminalVisible':visible,'actualPtyNonceObserved':True,'screenSource':screen.get('source'),
           'visualLayoutsCount':len(layouts),'commands':commands,
           'primeAgentNativeLaunch':True,'primeAgentVisibleConnectedWritable':True,
           'primeAgentManageScreen':True,'durableHeaderMatchesExactWorktree':True,'initialAssignments':0,
           'notProven':['same-operation creation recovery','existing-operation native binding',
                        'assignment reuse/ambiguity stop','canonical execute','LLM compliance','activation']}
    print(json.dumps(proof),flush=True)
finally:
    if server.poll() is None:
        server.terminate()
        try: server.wait(timeout=15)
        except subprocess.TimeoutExpired:
            server.kill();server.wait(timeout=5)
"""
    result = tier1_container.run(
        "runuser", "--user", "orca-fixture", "--", "python3", "-c", script,
        timeout=150, workdir=None,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    proof = json.loads(result.stdout.strip().splitlines()[-1])
    assert proof["runtime"] == "orcad" and proof["nodeVersion"] == "v24.22.1"
    assert proof["exactReadyLocalSetup"] and proof["nativeWorktreeAtOriginalBase"]
    assert proof["terminalConnected"] and proof["terminalWritable"] and proof["actualPtyNonceObserved"]
    (tier1_container.share.parent / "creation-native-orca-readiness.json").write_text(json.dumps(proof, indent=2) + "\n")

def test_native_same_operation_creation_recovery_and_session_binding(tier1_container) -> None:
    """Full-path native mechanics with explicit fixture-owner decisions, not LLM compliance."""
    script = r"""import json,os,pathlib,selectors,shlex,shutil,subprocess,time
base=pathlib.Path('/home/orca-fixture/native-recovery');base.mkdir()
profile=base/'profile'
env=dict(os.environ,HOME=str(base),XDG_CONFIG_HOME=str(base/'config'),XDG_DATA_HOME=str(base/'data'),
 XDG_CACHE_HOME=str(base/'cache'),ORCA_USER_DATA_PATH=str(profile),ORCA_USER_DATA=str(profile),ORCA_SERVE_RUNTIME='orcad')
cli='/usr/local/bin/orca-ide';real_prime=shutil.which('prime-agent');assert real_prime
probe=base/'recovery.ts';probe.write_text(r'''import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,renameSync,rmdirSync,openSync,closeSync,fchmodSync,statSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {CliOrcaAdapter,DaemonJsonlClient,PrimeSessionPublisher,allocateReservedTaskEpisode,runtimeSessionManagerClass}
from '/workspace/src/prime-agent-plugin/extension-support/spec-episode.ts';
import {prepareEpisodeTaskHistoryWorkspace} from '/workspace/src/prime-agent-plugin/extension-support/task-history-workspace.ts';
import {createAssistantMessageEventStream} from '@earendil-works/pi-ai';
const base="/home/orca-fixture/native-recovery",config=JSON.parse(readFileSync(base+'/fixture.json','utf8'));
const repo=config.repo,wt=config.worktree;
const run=(cmd,args,cwd=repo)=>execFileSync(cmd,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const git=(cwd,...args)=>run('git',args,cwd);
export default function fixture(pi){
pi.registerProvider('native-recovery',{baseUrl:'offline',apiKey:'fixture',api:'native-recovery',streamSimple(model){
 const stream=createAssistantMessageEventStream();queueMicrotask(()=>{
 const m={role:'assistant',content:[{type:'text',text:'fixture acknowledged'}],api:model.api,provider:model.provider,model:model.id,
 usage:{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:'stop',timestamp:Date.now()};
 stream.push({type:'start',partial:m});stream.push({type:'done',reason:'stop',message:m});stream.end();});return stream;},
 models:[{id:'m',name:'Fixture',reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:100000,maxTokens:1000}]});
pi.on('session_start',async(_event,ctx)=>{
 ctx.sessionManager.flushNow();
 if(process.cwd()!==repo){writeFileSync(base+'/launched.json',JSON.stringify({sessionId:ctx.sessionManager.getSessionId(),sessionFile:ctx.sessionManager.getSessionFile(),cwd:process.cwd()}));return;}
 let publisher,client;
 try{
  writeFileSync(base+'/controller-socket',process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET);
  client=new DaemonJsonlClient(process.env.PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET);
  const daemonCommands=[],request=client.request.bind(client);
  client.request=async(...args)=>{daemonCommands.push(args[0].type);return request(...args);};
  publisher=new PrimeSessionPublisher(client,runtimeSessionManagerClass(ctx.sessionManager));
  const commands=[];let discardedLaunchReceipts=0;
  const orca=new CliOrcaAdapter(args=>{
   commands.push(args.slice(0,2));
   if(args[0]==='automations'&&args[1]==='run'){
    assert.equal(discardedLaunchReceipts++,0,'never dispatch the launch again');
    // REAL native dispatch, but its result is unavailable to the caller.
    // Do not invent a reply or throw a fake adapter error.
    execFileSync('/usr/local/bin/orca-ide',args,{cwd:repo,stdio:['ignore','ignore','pipe']});
    return '';
   }
   return run('/usr/local/bin/orca-ide',args);
  });
  const native=(...args)=>JSON.parse(run('/usr/local/bin/orca-ide',[...args,'--json']));
  const owner=ctx.sessionManager.getSessionId(),operation=randomUUID(),owners=repo+'/.prime-claw/ownership.json';
  const nativeTask=JSON.parse(run('backlog',['task','view','--json','--','RECOVERY-1']));
  const initial={version:2,provider:'backlog',status:'uncertain',engine:'orca',ownerSessionId:owner,operationId:operation,
   taskId:'RECOVERY-1',taskPath:nativeTask.task.path,providerRevision:config.taskHead,taskEvidence:nativeTask,
   baseRef:config.baseHead,head:config.baseHead,integrationBranch:'main',projectSetupId:config.setupId,
   worktreeId:wt.id,worktreeIdentity:wt.identity.key,worktreeName:'native-recovery',worktree:wt.path,branch:wt.branch.replace(/^refs\/heads\//,''),
   createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),uncertaintyReason:'fixture late task clone failure'};
  const foreign={...initial,ownerSessionId:'foreign-owner',operationId:randomUUID(),taskId:'RECOVERY-2',
   taskPath:config.otherTask.task.path,taskEvidence:config.otherTask};
  for(const key of ['head','worktree','branch','worktreeId','worktreeIdentity','worktreeName'])delete foreign[key];
  mkdirSync(repo+'/.prime-claw',{recursive:true});writeFileSync(owners,JSON.stringify({schemaVersion:1,owners:{[owner]:initial,'foreign-owner':foreign}}));
  const selected=()=>JSON.parse(readFileSync(owners,'utf8')).owners[owner];
  const originalBindings=Object.fromEntries(['ownerSessionId','operationId','taskId','taskPath','provider','baseRef','integrationBranch','engine',
   'projectSetupId','worktreeId','worktreeIdentity','worktreeName','worktree','branch','head'].map(k=>[k,initial[k]]));
  const worktrees=git(repo,'worktree','list','--porcelain'),taskHead=config.taskHead;
  const unrelated=()=>[repo,repo+'/.backlog',wt.path].map(cwd=>({
   bytes:readFileSync(cwd+'/unrelated.txt','utf8'),staged:git(cwd,'diff','--cached','--binary','--','unrelated.txt')}));
  const unrelatedBefore=unrelated();
  assert.equal((await publisher.list()).filter(s=>s.cwd===wt.path).length,0);
  // Orca creates its normal shell tab with the worktree; it is not an Episode.
  const initialTerminals=await orca.listTerminals(wt.id);
  assert.equal(initialTerminals.some(t=>t.agentIdentity==='prime-agent'),false);
  assert.equal(native('automations','list').ok,true);
  assert.equal(existsSync(wt.path+'/.backlog'),false);
  // Deliberate native transport failure AFTER the one real worktree allocation.
  const failed=prepareEpisodeTaskHistoryWorkspace({primaryRoot:repo,targetWorktree:wt.path});
  assert.equal(failed.status,'blocked');assert.equal(failed.code,'remote-unavailable');
  assert.deepEqual(selected(),initial);
  assert.equal((await publisher.list()).filter(s=>s.cwd===wt.path).length,0);
  assert.deepEqual((await orca.listTerminals(wt.id)).map(t=>t.handle),initialTerminals.map(t=>t.handle));
  // Cleared only this disposable fixture's observed cause; no provider status write.
  renameSync(config.offlineOrigin,config.origin);
  assert.equal(git(repo+'/.backlog','ls-remote','origin','refs/heads/prime-claw/tasks').split(/\s/)[0],taskHead);
  // The owner LLM chooses this single patch. This inline edit is not a recovery engine.
  // Compare selected entry under the existing lock; preserve a newer foreign raw value.
  const advance=JSON.parse(readFileSync(owners,'utf8'));advance.owners['foreign-owner'].uncertaintyReason='latest foreign observation, retain me';
  writeFileSync(owners,JSON.stringify(advance));const foreignBefore=advance.owners['foreign-owner'];
  const lock=owners+'.lock';mkdirSync(lock);
  try{
   const latest=JSON.parse(readFileSync(owners,'utf8'));assert.deepEqual(latest.owners[owner],initial);
   const next={...initial,status:'provisioning'};delete next.uncertaintyReason;latest.owners[owner]=next;
   const temp=owners+'.'+randomUUID(),fd=openSync(temp,'wx',statSync(owners).mode & 0o777);
   try{fchmodSync(fd,statSync(owners).mode & 0o777);writeFileSync(fd,JSON.stringify(latest));}finally{closeSync(fd);}
   renameSync(temp,owners);assert.deepEqual(JSON.parse(readFileSync(owners,'utf8')),latest);
  }finally{rmdirSync(lock);}
  // Existing allocator, real Orca and real publisher: no admission/status/reservation mocks.
  const deps={orca,publisher,bindingAttempts:80};
  await assert.rejects(
   allocateReservedTaskEpisode('RECOVERY-1',ctx,deps,undefined,{operationId:operation}),
   error=>error.name==='OrcaMutationUncertainError'&&error.message.includes('Orca launch automation run'));
  const unresolved=selected();assert.equal(unresolved.status,'uncertain');
  assert.ok(unresolved.launchAutomationName&&unresolved.launchAutomationId);
  assert.equal(unresolved.launchRunId,undefined,'the discarded run identity is unknown, not non-delivery');
  assert.deepEqual(Object.fromEntries(Object.keys(originalBindings).map(k=>[k,unresolved[k]])),originalBindings);
  const mutationsAtStop=commands.filter(a=>['create','run','remove'].includes(a[1]));
  const daemonAtStop=daemonCommands.length;
  // STOP dispatch. The owner inspects only native evidence while completion is unresolved.
  // This bounded read wait sends no prompt/run/create and does not reconcile ownership.
  let observed;
  for(let attempt=0;attempt<80;attempt++){
   const candidates=(await publisher.list()).filter(s=>s.cwd===wt.path);
   assert.ok(candidates.length<=1,'contradictory sessions require recovery, not selection');
   const candidate=candidates[0],route=candidate?.activeSessionId;
   if(candidate?.sessionFile&&route){
    const idle=await client.request({type:'wait_for_idle',activeSessionId:route},30000);
    assert.equal(idle.success,true);
    const state=await publisher.getState(route),messages=await publisher.getMessages(route);
    if(messages.some(m=>m.role==='user'&&JSON.stringify(m.content).includes('Native fixture initial execute assignment.'))){
     assert.equal(state.sessionId,candidate.sessionId);assert.equal(state.cwd,wt.path);
     assert.equal(messages.filter(m=>m.role==='user').length,1);observed=candidate;break;
    }
   }
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(observed,'native initial-assignment evidence remains unavailable; do not replay');
  assert.deepEqual(selected(),unresolved);
  assert.deepEqual(commands.filter(a=>['create','run','remove'].includes(a[1])),mutationsAtStop);
  assert.equal(daemonCommands.slice(daemonAtStop).some(type=>['create','prompt'].includes(type)),false);
  const countBeforeBind=commands.length,daemonBeforeBind=daemonCommands.length;
  // Current native evidence now resolves the uncertainty; bind, never launch again.
  const result=await allocateReservedTaskEpisode('RECOVERY-1',ctx,deps,undefined,{operationId:operation,sessionId:observed.sessionId});
  assert.equal(result.status,'active');assert.equal(result.reused,true);
  assert.equal(result.launchAutomationId,unresolved.launchAutomationId);
  assert.equal(result.launchAutomationName,unresolved.launchAutomationName);
  assert.deepEqual(Object.fromEntries(Object.keys(originalBindings).map(k=>[k,result[k]])),originalBindings);
  const idle=await client.request({type:'wait_for_idle',activeSessionId:result.episodeActiveSessionId},30000);
  assert.equal(idle.success,true);
  const session=(await publisher.list()).filter(s=>s.cwd===wt.path);assert.equal(session.length,1);
  assert.equal(session[0].sessionId,result.episodeId);
  const state=await publisher.getState(result.episodeActiveSessionId);
  const messages=await publisher.getMessages(result.episodeActiveSessionId);
  const assignments=rows=>rows.filter(m=>m.role==='user'&&JSON.stringify(m.content).includes('Native fixture initial execute assignment.'));
  assert.equal(assignments(messages).length,1);assert.equal(messages.filter(m=>m.role==='user').length,1);
  assert.equal(state.cwd,wt.path);assert.equal(state.sessionId,result.episodeId);
  const launch=JSON.parse(readFileSync(base+'/launched.json','utf8'));
  assert.equal(launch.sessionId,result.episodeId);assert.equal(launch.cwd,wt.path);
  const saved=readFileSync(result.episodeSessionFile,'utf8').trim().split('\n').map(l=>JSON.parse(l));
  assert.equal(saved[0].id,result.episodeId);assert.equal(saved[0].cwd,wt.path);
  assert.equal(saved.filter(r=>r.message?.role==='user').length,1);
  const terminals=await orca.listTerminals(wt.id);
  const tab=terminals.find(t=>t.handle===result.terminalHandle);
  assert.ok(tab.connected&&tab.writable&&tab.visible&&tab.agentIdentity==='prime-agent'&&tab.tabId&&tab.leafId);
  assert.equal(tab.worktreePath,wt.path);
  assert.ok((await orca.readTerminalScreen(tab.handle)).text.includes('← manage'));
  assert.equal(existsSync(wt.path+'/.backlog/.git'),true);
  assert.equal(git(wt.path+'/.backlog','rev-parse','HEAD'),taskHead);
  assert.deepEqual(JSON.parse(run('backlog',['task','view','--json','--','RECOVERY-1'],wt.path)),nativeTask);
  const firstCommands=commands.slice();
  assert.equal(firstCommands.filter(a=>a.join(' ')==='automations run').length,1);
  assert.equal(firstCommands.some(a=>a.join(' ')==='worktree create'),false);
  // The explicit bind above followed actual lost-launch-result uncertainty,
  // not a synthetic status change after a previously acknowledged success.
  assert.equal(assignments(result.sessionObservation.messages).length,1);
  assert.equal(discardedLaunchReceipts,1);
  const replay=await allocateReservedTaskEpisode('RECOVERY-1',ctx,deps,undefined,{operationId:operation});
  assert.equal(replay.reused,true);assert.equal(replay.episodeId,result.episodeId);
  assert.equal(commands.slice(countBeforeBind).some(a=>['create','run','remove'].includes(a[1])),false);
  assert.equal((await publisher.list()).filter(s=>s.cwd===wt.path).length,1);
  const messagesAfterReuse=await publisher.getMessages(result.episodeActiveSessionId);
  assert.equal(assignments(messagesAfterReuse).length,1);
  assert.equal(messagesAfterReuse.filter(m=>m.role==='user').length,1);
  assert.equal(daemonCommands.slice(daemonBeforeBind).some(type=>['create','prompt'].includes(type)),false);
  assert.equal(git(repo,'worktree','list','--porcelain'),worktrees);
  assert.equal(git(repo,'rev-parse','HEAD'),config.baseHead);
  assert.equal(git(repo+'/.backlog','rev-parse','HEAD'),taskHead);
  assert.equal(git(repo+'/.backlog','ls-remote','origin','refs/heads/prime-claw/tasks').split(/\s/)[0],taskHead);
  assert.deepEqual(unrelated(),unrelatedBefore);
  assert.deepEqual(JSON.parse(readFileSync(owners,'utf8')).owners['foreign-owner'],foreignBefore);
  assert.deepEqual(JSON.parse(run('backlog',['task','view','--json','--','RECOVERY-2'])),config.otherTask);
  assert.deepEqual(Object.fromEntries(Object.keys(originalBindings).map(k=>[k,selected()[k]])),originalBindings);
  const proof={scope:'scripted application of reviewed Markdown decisions through real same-operation native interfaces',
   realOrca:true,realDaemon:true,originalBindingsPreserved:true,otherOwnerAndUnrelatedStagingPreserved:true,
   nativeLateFailure:failed.code,missingTargetClonePrepared:true,worktreeAllocations:1,sessionAllocations:1,
   initialAssignments:1,initialAutomationRuns:1,existingSessionBinding:true,activeReplay:true,extraDeliveryOnReuse:false,
   zeroStatusPublication:true,exactVisibleConnectedWritableTab:true,durableSavedAssignmentCount:1,
   lostNativeLaunchReceipt:true,dispatchStoppedWhileCompletionUnresolved:true,nativeEvidenceResolvedCompletion:true,
   knownLaunchIdentityPreserved:true,retainedDisabledAutomation:true,
   notProven:['canonical execute workflow','LLM policy compliance','daemon prompt-ack loss','permanently unavailable evidence resolution','activation']};
  native('terminal','close','--terminal',tab.handle);
  writeFileSync(base+'/result.json',JSON.stringify(proof));
 }catch(error){writeFileSync(base+'/result.json',JSON.stringify({error:String(error),stack:error?.stack}));}
 finally{publisher?.close();}
});}
''')
bin_dir=base/'bin';bin_dir.mkdir()
wrapped=bin_dir/'prime-agent'
wrapped.write_text('#!/bin/sh\nprintf used >> '+shlex.quote(str(base/'wrapper-used'))+'\nexec /workspace/scripts/run-prime-agent-probe.sh '+shlex.quote(real_prime)+
 ' --daemon-socket "$(cat '+shlex.quote(str(base/'controller-socket'))+')" --offline --no-tools --no-skills --no-prompt-templates --no-context-files --no-extensions -e '+shlex.quote(str(probe))+' --provider native-recovery --model m "$@"\n')
wrapped.chmod(0o755);env['PATH']=str(bin_dir)+':'+env['PATH']
for login_file in ['.bashrc','.bash_profile','.profile']:(base/login_file).write_text('export PATH='+shlex.quote(str(bin_dir))+':$PATH\n')
commands=[]
def native(*args):
    result=subprocess.run([cli,*args,'--json'],env=env,cwd=base,text=True,capture_output=True,timeout=45)
    commands.append({'command':list(args[:2]),'exitCode':result.returncode})
    if result.returncode:
        raise RuntimeError('native '+str(args[:2])+' failed: '+result.stderr[-1800:]+result.stdout[-1800:])
    envelope=json.loads(result.stdout)
    # Pure documentation commands return their JSON directly, unlike RPC envelopes.
    if args==('skills','get','orca-cli'):
        return envelope
    if envelope.get('ok') is not True:
        raise RuntimeError('native '+str(args[:2])+' refused: '+str(envelope.get('error')))
    return envelope['result']
# Load the selected distribution's own guide before runtime operations.
guide=native('skills','get','orca-cli')
assert guide
server=subprocess.Popen([cli,'serve','--json','--no-pairing','--port','6768'],env=env,cwd=base,
                        text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=1)
output=[]; errors=[]; ready=None
try:
    selector=selectors.DefaultSelector()
    selector.register(server.stdout,selectors.EVENT_READ,'out')
    selector.register(server.stderr,selectors.EVENT_READ,'err')
    deadline=time.monotonic()+60
    while ready is None and time.monotonic()<deadline:
        for key,_ in selector.select(max(0,deadline-time.monotonic())):
            line=key.fileobj.readline()
            if not line:
                selector.unregister(key.fileobj)
                continue
            (output if key.data=='out' else errors).append(line)
            try: payload=json.loads(line)
            except json.JSONDecodeError: continue
            if payload.get('type')=='orca_server_ready': ready=payload
        if server.poll() is not None:
            raise RuntimeError('native server exited before ready: '+''.join(errors)[-3000:])
    selector.close()
    assert ready is not None, 'native server did not report ready: '+''.join(errors)[-3000:]
    stderr=''.join(errors)
    assert '[serve] running on orcad ' in stderr, stderr
    assert '[serve] using Electron serve:' not in stderr, stderr
    status=native('status')
    def command(cwd,*args):
        r=subprocess.run(args,cwd=cwd,env=env,text=True,capture_output=True,timeout=40)
        assert r.returncode==0,r.stdout+r.stderr
        return r.stdout.strip()
    repo=base/'repo';repo.mkdir();store=repo/'.backlog';store.mkdir();origin=base/'origin.git';offline_origin=base/'offline-origin.git'
    command(repo,'git','init','-q','-b','main');command(store,'git','init','-q','-b','prime-claw/tasks')
    for cwd in [repo,store]:
        command(cwd,'git','config','user.name','Fixture');command(cwd,'git','config','user.email','fixture@example.test')
        (cwd/'unrelated.txt').write_text('baseline\n')
    (store/'config.yml').write_text('project_name: "recovery"\nstatuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]\ndefault_status: "In Design"\nauto_commit: false\nremote_operations: false\ntask_prefix: "recovery"\n')
    for title in ['Recovery fixture','Other fixture owner']:
        command(repo,'backlog','task','create',title,'--status','In Progress','--description','Disposable native exercise only','--plan','Inspect native evidence and finish the same operation','--plain')
    other=json.loads(command(repo,'backlog','task','view','--json','--','RECOVERY-2'))
    command(store,'git','add','.');command(store,'git','commit','-qm','Task baseline')
    command(base,'git','init','-q','--bare',str(origin));command(store,'git','remote','add','origin',str(origin))
    command(store,'git','push','-q','origin','HEAD:refs/heads/prime-claw/tasks');task_head=command(store,'git','rev-parse','HEAD')
    (repo/'.gitignore').write_text('.backlog/\n.prime/\n.prime-claw/ownership.json\n')
    execute=repo/'.agents/skills/execute/SKILL.md';execute.parent.mkdir(parents=True)
    execute.write_text('---\nname: execute\ndescription: Harmless isolated recovery fixture\n---\nNative fixture initial execute assignment. No tools or external actions. Reply fixture acknowledged.\n')
    command(repo,'git','add','.');command(repo,'git','commit','-qm','Code baseline')
    command(repo,'git','remote','add','origin',str(origin));command(repo,'git','push','-qu','origin','main');head=command(repo,'git','rev-parse','HEAD')
    native('repo','add','--path',str(repo));setups=native('project','setups')['setups']
    matching=[s for s in setups if s.get('path')==str(repo) and s.get('setupState')=='ready'];assert len(matching)==1
    created=native('worktree','create','--project-host-setup',matching[0]['id'],'--name','native-recovery','--no-parent','--setup','skip','--base-branch',head)['worktree']
    settings=pathlib.Path(created['path'])/'.prime/agent/settings.json';settings.parent.mkdir(parents=True)
    settings.write_text(json.dumps({'onboardingShown':True,'agentTraces':{'enabled':False},'telemetry':{'enabled':False}}))
    for cwd in [repo,store,pathlib.Path(created['path'])]:
        (cwd/'unrelated.txt').write_text('preserve staged unrelated bytes\n');command(cwd,'git','add','unrelated.txt')
    (base/'fixture.json').write_text(json.dumps({'repo':str(repo),'origin':str(origin),'offlineOrigin':str(offline_origin),'worktree':created,'setupId':matching[0]['id'],'taskHead':task_head,'baseHead':head,'otherTask':other}))
    origin.rename(offline_origin)
    result=subprocess.run(['/workspace/scripts/run-prime-agent-probe.sh',real_prime,'--mode','rpc','--offline',
     '--no-tools','--no-skills','--no-prompt-templates','--no-context-files','--no-extensions','--cwd',str(repo),'-e',str(probe),
     '--provider','native-recovery','--model','m'],env=env,cwd=repo,text=True,capture_output=True,
     input=json.dumps({'id':'commands','type':'get_commands'})+'\n',timeout=180)
    assert result.returncode==0,result.stdout[-4000:]+result.stderr[-4000:]
    assert (base/'result.json').is_file(),result.stdout[-4000:]+result.stderr[-4000:]
    proof=json.loads((base/'result.json').read_text());assert 'error' not in proof,proof
    assert (base/'wrapper-used').read_text()=='used'
    print(json.dumps(proof),flush=True)
finally:
    if server.poll() is None:
        server.terminate()
        try:server.wait(timeout=15)
        except subprocess.TimeoutExpired:server.kill();server.wait(timeout=5)
"""
    result = tier1_container.run(
        "runuser", "--user", "orca-fixture", "--", "python3", "-c", script,
        timeout=240, workdir=None,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    proof = json.loads(result.stdout.strip().splitlines()[-1])
    assert proof["realOrca"] and proof["realDaemon"]
    assert proof["originalBindingsPreserved"] and proof["otherOwnerAndUnrelatedStagingPreserved"]
    assert proof["worktreeAllocations"] == proof["sessionAllocations"] == proof["initialAssignments"] == 1
    assert proof["existingSessionBinding"] and proof["activeReplay"] and not proof["extraDeliveryOnReuse"]
    assert proof["zeroStatusPublication"] and proof["exactVisibleConnectedWritableTab"]
    (tier1_container.share.parent / "creation-native-same-operation-recovery.json").write_text(json.dumps(proof, indent=2) + "\n")


def test_episode_creation_uses_fresh_host_session_without_runtime_package_import() -> None:
    source = EPISODE_EXTENSION.read_text()
    assert 'import("@earendil-works/pi-coding-agent")' not in source
    assert "runtimeSessionManagerClass(ctx.sessionManager)" in source
    assert "Object.getPrototypeOf(sessionManager)?.constructor" in source
    assert 'typeof candidate.create !== "function"' in source
    assert "forkFrom(" not in source
    assert "appendEpisodeIdentity" not in source


def test_prime_agent_rpc_loads_tools_without_custom_commands_and_preserves_native_skill_discovery(tier1_container, ctmp) -> None:
    native_skill = ctmp / ".agents/skills/native-control/SKILL.md"
    native_skill.parent.mkdir(parents=True)
    native_skill.write_text("---\nname: native-control\ndescription: Native skill discovery control\n---\nControl policy.\n")
    request = json.dumps({"id": "loader", "type": "get_commands"}) + "\n"
    probe = ctmp / "tool-probe.ts"
    probe.write_text("""import {writeFileSync} from "node:fs";
const out=process.env.TOOL_SNAPSHOT;
export default function probe(pi){pi.on("session_start",()=>{const names=pi.getAllTools().map(t=>t.name).sort();writeFileSync(out,JSON.stringify(names));if(names.includes("plan_spec")&&names.includes("plan_task")&&names.includes("implement_task")&&names.includes("implement_spec")&&names.includes("create_spec_episode")&&names.includes("handoff_spec_episode")&&names.includes("finalize_spec_episode")&&names.includes("restore_blocked_spec_episode")&&names.includes("create_task_episode")&&names.includes("handoff_task_episode")&&names.includes("finalize_task_episode")&&names.includes("transition_spec_episode_to_task")&&!names.includes("ralph_plan")&&!names.includes("prime_claw_activate_conversation_guide")&&!names.includes("prime_claw_conversation_guide_status")){pi.registerCommand("probe-reviewed-plan-tools",{description:"proof",handler:async()=>{}})}})}""")
    snapshot = ctmp / "tools.json"
    result = tier1_container.run(
        "/workspace/scripts/run-prime-agent-probe.sh", tier1_container.prime_agent, "--mode", "rpc", "--offline", "--no-session",
        "--no-prompt-templates", "--no-context-files", "--no-extensions", "--cwd", str(ctmp),
        "-e", WS_EXTENSION, "-e", str(probe), input_text=request, timeout=40, workdir=None,
        env={"TOOL_SNAPSHOT": str(snapshot)},
    )
    assert result.returncode == 0, result.stdout + result.stderr
    response = json.loads(result.stdout.strip().splitlines()[-1])
    assert response["success"] is True
    commands = response["data"]["commands"]
    names = {command["name"] for command in commands}
    assert names.isdisjoint({"plan-spec", "plan", "implement-spec", "implement-task", "handoff"})
    assert not any(command.get("sourceInfo", {}).get("path") == WS_EXTENSION for command in commands)
    native = next(command for command in commands if command["name"] == "skill:native-control")
    assert native["sourceInfo"]["path"] == str(native_skill)
    # get_commands lists extension/prompt/skill entries, not built-ins. No
    # plugin registration may shadow a built-in or the native skill namespace.
    assert names.isdisjoint({"help", "model", "settings", "clear", "compact"})
    assert [command["name"] for command in commands].count("probe-reviewed-plan-tools") == 1
    tools = json.loads(snapshot.read_text())
    for name in ("plan_spec", "plan_task", "implement_task", "implement_spec", "create_spec_episode", "handoff_spec_episode", "finalize_spec_episode", "restore_blocked_spec_episode", "create_task_episode", "handoff_task_episode", "finalize_task_episode", "transition_spec_episode_to_task"):
        assert name in tools



def test_task_finalization_surface_is_cleanup_only() -> None:
    extension = EXTENSION.read_text()
    support = EPISODE_EXTENSION.read_text()
    for removed in (
        "readyReceipt", "readyProgress", "changesProgress", "terminalEvidence",
        "publishTaskEpisodeReadyForMerge", "mergeTaskEpisodeReadyForMerge",
        "abandonTaskEpisode", "TaskEpisodeReadyHandshakeEvidence",
    ):
        assert removed not in extension
        assert removed not in support
    assert 'name: "finalize_task_episode"' in extension
    assert 'enum: ["merged", "abandoned"]' in extension
    start = extension.index('name: "finalize_task_episode"')
    cleanup_surface = extension[start:extension.index("async execute", start)]
    assert 'required: ["taskId", "episodeHead", "outcome"]' in cleanup_surface
    assert "confirmed" not in cleanup_surface
    assert "cleanupHead" not in support
    assert "taskCleanupStage" not in support
    assert "ownershipRemoved: true" in support
    assert "store.removeTask(projectRoot, record)" in support
    assert 'runGit(repo, ["merge", "--ff-only"' not in support


def test_repository_status_cutover_uses_task_native_order_without_to_do() -> None:
    # This repository's selected native root config links into its independent store.
    config = yaml.safe_load((REPO / "backlog.config.yml").read_text())
    assert config["default_status"] == "In Design"
    assert config["statuses"] == [
        "In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done",
    ]
    assert "To Do" not in config["statuses"]


def test_compact_first_workflows_and_normal_guide_load_are_explicit() -> None:
    extension = EXTENSION.read_text()
    plan_prep = (REPO / "src/prime-agent-plugin/workflows/plan-prep.md").read_text()
    implement_prep = (REPO / "src/prime-agent-plugin/workflows/implement-prep.md").read_text()
    implement = (REPO / "src/prime-agent-plugin/workflows/implement-spec.md").read_text()
    assert "registerCommand" not in extension
    assert "parseImplementationArgs" not in extension
    assert "parseTaskImplementationArgs" not in extension
    assert 'name: "plan_spec"' in extension
    assert 'name: "implement_spec"' in extension
    assert 'name: "implement_task"' in extension
    assert 'name: "plan_task"' in extension
    assert 'name: "ralph_plan"' not in extension
    assert "compact.run(focus_hint)" in plan_prep
    assert "compact.run(focus_hint)" in implement_prep
    assert "conversationGuideText({ guideRoot: dependencies.guideRoot })" in extension
    assert "activation, disclosure, receipt, or readiness-confirmation step" in " ".join(implement.split())


def test_task_entry_code_loads_native_facts_without_status_or_plan_policy() -> None:
    extension = EXTENSION.read_text()
    prep = (REPO / "src/prime-agent-plugin/extension-support/prep-chain.ts").read_text()
    assert "allowedStatuses" not in extension
    assert "allowedStatuses" not in prep
    assert "requireLiveImplementationTask" not in extension
    assert "accepts only" not in prep
    assert "task.nativeStatus !==" not in extension
    assert "<operator-plan-task-observation>" in prep
    assert "JSON.stringify(selection.nativeView)" in prep
    assert "<operator-implementation-task-observation>" in extension
    assert "JSON.stringify(task.nativeView)" in extension

    for name in ("plan_task", "implement_task", "create_task_episode"):
        start = extension.index(f'name: "{name}"')
        metadata = extension[start:extension.index("async execute", start)]
        assert "promptGuidelines" not in metadata
        assert "In Planning" not in metadata
        assert "In Design" not in metadata
        assert "implementation-ready" not in metadata


def test_creation_policy_matches_frozen_orca_boundary() -> None:
    source = EPISODE_EXTENSION.read_text()
    for phrase in (
        '"--no-parent"', '"--setup", "skip"', '"--provider", "prime-agent"',
        '"--reuse-session"', '"--disabled"', "Remote Episode placement is disabled",
        "OrcaUnavailableError", "OrcaMutationUncertainError", "createFresh",
    ):
        assert phrase in source
    assert '"--activate"' not in source


def test_episode_tests_prove_fresh_orca_and_local_assignment_boundaries() -> None:
    tests = (REPO / "tests/spec_episode_extension.test.mjs").read_text()
    for phrase in (
        "promotes before exactly one native execute assignment",
        "definitive pre-mutation Orca unavailability uses fresh local fallback once",
        "uncertainty preserves one record and never falls back",
        "uncertain replay never replays assignment",
    ):
        assert phrase in tests
    assert "forkPrimeSession" not in tests


def test_current_docs_preserve_authority_and_transport_boundaries() -> None:
    future = (REPO / "docs/future-specification-bundles.md").read_text()
    oversight = (REPO / "docs/conversation-driven-episode-oversight.md").read_text()
    handoff = (REPO / "docs/handoff-chain.md").read_text()
    for phrase in ("`plan_spec`", "Remote selection is rejected", "one fixed execute assignment", "not permission to retry"):
        assert phrase in future
    assert "operator alone decides" in oversight.lower()
    assert "never retried automatically" in handoff

def test_activation_truth_docs_are_task_native_first_with_explicit_folder_compatibility() -> None:
    expected_terms = {
        "VISION.md": ("implement_task", "version-2 ownership", "retained version-1 compatibility"),
        "docs/backlog.md": ("plan_task", "implement_task", "retained version-1 compatibility"),
        "docs/future-specification-bundles.md": ("primary task-native lifecycle", "create_task_episode", "retained version-1 compatibility"),
        "docs/conversation-driven-episode-oversight.md": (
            "primary task-native path",
            "finalize_task_episode",
            "reject existing non-terminal ownership",
            "retained version-1 compatibility",
        ),
        "docs/user-stories/README.md": ("primary task-native lifecycle", "handoff_task_episode", "retained version-1 compatibility"),
        "docs/user-stories/C-specification.md": ("primary version-2 task episodes", "retained version-1 compatibility"),
        "docs/user-stories/E-episode-promotion.md": (
            "implement_task",
            "create_task_episode",
            "public admission replay fails closed",
            "owner-led creation recovery",
            "blocked",
            "retained version-1 compatibility",
        ),
        "docs/user-stories/H-handoff-and-continuation.md": ("primary task-native continuation", "handoff_task_episode", "retained version-1 compatibility"),
        "docs/user-stories/I-episode-finalization.md": ("primary task-native lifecycle", "finalize_task_episode", "retained version-1 compatibility"),
        "docs/user-stories/traceability.md": ("primary task-native", "finalize_task_episode", "retained version-1 compatibility"),
    }

    for path, terms in expected_terms.items():
        text = " ".join((REPO / path).read_text().lower().split())
        for term in terms:
            assert term in text, (path, term)


def test_traceability_covers_both_episode_schemas_at_creation_recovery_and_finish() -> None:
    lines = (REPO / "docs/user-stories/traceability.md").read_text().splitlines()
    rows = {
        parts[1].strip(): line.lower()
        for line in lines
        if line.startswith("| US-")
        for parts in [line.split("|")]
    }

    for story in ("US-11", "US-12", "US-14", "US-16", "US-24"):
        assert "retained version-1 compatibility" in rows[story]

    assert "no bundle copy" in rows["US-14"]
    assert "public task-native admission replay fails closed on that conversation's existing non-terminal ownership" in rows["US-14"]
    assert "different conversations can reserve and create independent episodes concurrently" in rows["US-14"]
    assert "retained version-1 compatibility promotes and commits the exact approved bundle, and `create_spec_episode` may return" in rows["US-14"]

    assert "known native prerequisite failure before fresh creation leaves no reservation/resources" in rows["US-16"]
    assert "the owning conversation inspects facts and decides any lifecycle correction" in rows["US-16"]
    assert "instead of code choosing an automatic rollback or blocked state" in rows["US-16"]
    assert "retained version-1 compatibility preserves partial provisioning/allocation as exact `uncertain` ownership" in rows["US-16"]
    assert "public admission is not replayed as fresh allocation or delivery" in rows["US-16"]

    assert "finalize_task_episode" in rows["US-24"]
    assert "without separate cleanup confirmation" in rows["US-24"]
    assert "provider-reported idle completion" in rows["US-24"]
    assert "explicitly proven descendants" in rows["US-24"]
    assert "exact idle resources" in rows["US-24"]
    assert "finalize_spec_episode" in rows["US-24"]
