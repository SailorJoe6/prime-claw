#!/usr/bin/env python3
"""Linux-native behavioral probes for the final role reconciler."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

MANAGER=Path(sys.argv[1]); KERNEL=Path(sys.argv[2]); ROOT=Path(sys.argv[3]); SCENARIO=sys.argv[4]
START=b"<!-- prime-claw:role-kernel:start -->"; END=b"<!-- prime-claw:role-kernel:end -->"

def run(mode,kernel=KERNEL,root=ROOT):
 return subprocess.run([sys.executable,str(MANAGER),mode,str(kernel),str(root)],capture_output=True,text=True)

def block_range(data): return data.index(START),data.index(END)+len(END)
def state(): return json.loads((ROOT/'.prime-claw/role-protocol-state.json').read_text())
def setup(): shutil.rmtree(ROOT,ignore_errors=True);ROOT.mkdir(parents=True)
def alternate():
 p=ROOT.parent/f"kernel-{SCENARIO}.md";p.write_bytes(KERNEL.read_bytes().replace(b"Prime Claw may use",b"Prime Claw can use",1));return p

def priority():
 setup();(ROOT/'CLAUDE.md').write_text('claude\n');assert run('apply').returncode==0;assert state()['selectedContext']=='CLAUDE.md'
 (ROOT/'AGENTS.md').write_text('agents\n');assert run('check').returncode!=0

def preserve():
 setup();original=b'operator\r\ncontent';(ROOT/'AGENTS.md').write_bytes(original);os.chmod(ROOT/'AGENTS.md',0o2640);owner=((ROOT/'AGENTS.md').stat().st_uid,(ROOT/'AGENTS.md').stat().st_gid);assert run('apply').returncode==0;assert ((ROOT/'AGENTS.md').stat().st_mode & 0o7777)==0o2640;assert ((ROOT/'AGENTS.md').stat().st_uid,(ROOT/'AGENTS.md').stat().st_gid)==owner
 data=(ROOT/'AGENTS.md').read_bytes();a,b=block_range(data);assert data[:a].startswith(original);inode=(ROOT/'AGENTS.md').stat().st_ino
 assert run('apply').returncode==0;assert (ROOT/'AGENTS.md').stat().st_ino==inode;assert run('check').returncode==0
 other=alternate();assert run('apply',other).returncode==0;updated=(ROOT/'AGENTS.md').read_bytes();a,b=block_range(updated);assert updated[:a]==data[:a] and updated[b:]==data[b:]

def malformed():
 setup();bad=b'before\n'+START+b' one '+START+b' two '+END;(ROOT/'AGENTS.md').write_bytes(bad);assert run('apply').returncode!=0;assert (ROOT/'AGENTS.md').read_bytes()==bad

def drift():
 setup();assert run('apply').returncode==0;p=ROOT/'AGENTS.md';p.write_bytes(p.read_bytes().replace(b'Prime Claw may use',b'Prime Claw must use',1));before=p.read_bytes();assert run('check').returncode!=0 and run('apply').returncode!=0;assert p.read_bytes()==before

def unsafe():
 setup();outside=ROOT.parent/'outside';outside.write_text('outside');(ROOT/'AGENTS.md').symlink_to(outside);assert run('apply').returncode!=0;assert outside.read_text()=='outside'
 setup();(ROOT/'.prime-claw').symlink_to(ROOT.parent);assert run('apply').returncode!=0
 setup();assert run('apply').returncode==0;os.chmod(ROOT/'.prime-claw/role-protocol-state.json',0o644);assert run('check').returncode!=0;os.chmod(ROOT/'.prime-claw/role-protocol-state.json',0o600);lock=ROOT/'.prime-claw/role.lock';lock.unlink();lock.symlink_to(outside);assert run('check').returncode!=0

def concurrent():
 setup();commands=[[sys.executable,str(MANAGER),'apply',str(KERNEL),str(ROOT)] for _ in range(2)];procs=[subprocess.Popen(c,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True) for c in commands];results=[p.communicate(timeout=30)+(p.returncode,) for p in procs];assert all(r[2]==0 for r in results),results;assert run('check').returncode==0

def old_final():
 setup();kernel=KERNEL.read_bytes();(ROOT/'AGENTS.md').write_bytes(kernel);d=ROOT/'.prime-claw';d.mkdir();payload={'schemaVersion':1,'generation':'final','selectedContext':{'path':'AGENTS.md','installerCreated':True,'blockSha256':__import__('hashlib').sha256(kernel).hexdigest(),'prefixSeparatorBase64':'','suffixSeparatorBase64':''},'legacyAppend':{'path':'APPEND_SYSTEM.md','blockSha256':'0'*64,'prefixSeparatorBase64':'','suffixSeparatorBase64':''}};payload['extra']=True;(d/'role-protocol-state.json').write_text(json.dumps(payload));os.chmod(d/'role-protocol-state.json',0o600);assert run('apply').returncode!=0;payload.pop('extra');(d/'role-protocol-state.json').write_text(json.dumps(payload));os.chmod(d/'role-protocol-state.json',0o600)
 assert run('apply').returncode==0;assert state()['schemaVersion']==2 and run('check').returncode==0

def interrupted():
 setup();old=alternate();assert run('apply',old).returncode==0;p=ROOT/'AGENTS.md';data=p.read_bytes();a,b=block_range(data);p.write_bytes(data[:a]+KERNEL.read_bytes()+data[b:]);assert run('check').returncode!=0;assert run('apply').returncode==0;assert run('check').returncode==0

def rollback():
 setup();spec=importlib.util.spec_from_file_location('role_manager',MANAGER);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);real=m.atomic_write
 def fail(path,*args,**kwargs):
  if path==ROOT/m.STATE_REL: raise OSError('injected state failure')
  return real(path,*args,**kwargs)
 m.atomic_write=fail
 try:m.apply(ROOT,KERNEL)
 except OSError:pass
 else:raise AssertionError('injected failure accepted')
 assert not (ROOT/'AGENTS.md').exists()

def hardlink():
 setup();(ROOT/'AGENTS.md').write_text('same');os.link(ROOT/'AGENTS.md',ROOT/'CLAUDE.md');assert run('apply').returncode!=0;assert (ROOT/'AGENTS.md').read_text()=='same' and (ROOT/'CLAUDE.md').read_text()=='same'

SCENARIOS={'priority':priority,'preserve':preserve,'malformed':malformed,'drift':drift,'unsafe':unsafe,'concurrent':concurrent,'old-final':old_final,'interrupted':interrupted,'rollback':rollback,'hardlink':hardlink}
SCENARIOS[SCENARIO]();print(json.dumps({'ok':True,'scenario':SCENARIO}))
