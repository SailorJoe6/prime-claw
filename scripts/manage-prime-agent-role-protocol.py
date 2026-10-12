#!/usr/bin/env python3
"""Install and check Prime Claw's final managed role block."""
from __future__ import annotations

import argparse
import base64
import fcntl
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
from typing import Any

CONTEXT_CANDIDATES = ("AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD")
KERNEL_START = b"<!-- prime-claw:role-kernel:start -->"
KERNEL_END = b"<!-- prime-claw:role-kernel:end -->"
STATE_REL = Path(".prime-claw/role-protocol-state.json")
LOCK_REL = Path(".prime-claw/role.lock")
SCHEMA = 2


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def lstat_regular(path: Path, label: str, *, absent: bool = True) -> tuple[bytes, os.stat_result] | None:
    try:
        info = path.lstat()
    except FileNotFoundError:
        if absent: return None
        raise ValueError(f"missing {label}: {path}")
    if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode):
        raise ValueError(f"unsafe {label}: {path}")
    fd=os.open(path,os.O_RDONLY|getattr(os,"O_NOFOLLOW",0))
    try:
        opened=os.fstat(fd)
        if not stat.S_ISREG(opened.st_mode) or (opened.st_dev,opened.st_ino)!=(info.st_dev,info.st_ino):
            raise ValueError(f"changed {label}: {path}")
        with os.fdopen(fd,"rb",closefd=False) as handle: data=handle.read()
    finally: os.close(fd)
    return data, opened


def require_directory(path: Path, label: str, *, absent: bool = True) -> None:
    try: info = path.lstat()
    except FileNotFoundError:
        if absent: return
        raise ValueError(f"missing {label}: {path}")
    if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode):
        raise ValueError(f"unsafe {label}: {path}")


def managed_range(data: bytes, start: bytes, end: bytes, label: str) -> tuple[int, int] | None:
    starts=[]; offset=0
    while True:
        found=data.find(start,offset)
        if found<0: break
        starts.append(found); offset=found+len(start)
    ends=[]; offset=0
    while True:
        found=data.find(end,offset)
        if found<0: break
        ends.append(found+len(end)); offset=found+len(end)
    if not starts and not ends: return None
    if len(starts)!=1 or len(ends)!=1 or starts[0]>=ends[0]:
        raise ValueError(f"{label} has ambiguous managed markers")
    return starts[0],ends[0]


def load_kernel(path: Path) -> bytes:
    loaded=lstat_regular(path,"ROLE_KERNEL source",absent=False); assert loaded
    selected=managed_range(loaded[0],KERNEL_START,KERNEL_END,"ROLE_KERNEL source")
    if selected is None or selected!=(0,len(loaded[0])):
        raise ValueError("ROLE_KERNEL source must contain exactly one complete managed block")
    return loaded[0]


def candidates(root: Path) -> tuple[str,dict[str,tuple[bytes,os.stat_result]|None]]:
    found={name:lstat_regular(root/name,f"global context candidate {name}") for name in CONTEXT_CANDIDATES}
    selected=next((name for name in CONTEXT_CANDIDATES if found[name] is not None),"AGENTS.md")
    return selected,found


def aliases(a: tuple[bytes,os.stat_result]|None,b: tuple[bytes,os.stat_result]|None) -> bool:
    return bool(a and b and (a[1].st_dev,a[1].st_ino)==(b[1].st_dev,b[1].st_ino))


def one_link_case_alias(selected: str,name: str,a: tuple[bytes,os.stat_result]|None,b: tuple[bytes,os.stat_result]|None) -> bool:
    return bool(aliases(a,b) and selected.casefold()==name.casefold() and a and b and a[1].st_nlink==b[1].st_nlink==1)


def load_state(path: Path) -> tuple[dict[str,Any]|None,bytes|None,os.stat_result|None]:
    loaded=lstat_regular(path,"role ownership state")
    if loaded is None: return None,None,None
    data,info=loaded
    if stat.S_IMODE(info.st_mode)!=0o600: raise ValueError(f"role ownership state must be mode 0600: {path}")
    try: value=json.loads(data)
    except (UnicodeError,json.JSONDecodeError) as exc: raise ValueError("malformed role ownership state") from exc
    if not isinstance(value,dict): raise ValueError("malformed role ownership state")
    if set(value)=={"schemaVersion","selectedContext","kernelSha256"} and value.get("schemaVersion")==SCHEMA:
        selected=value.get("selectedContext"); recorded=value.get("kernelSha256")
    elif value.get("schemaVersion")==1 and value.get("generation")=="final":
        if set(value)!={"schemaVersion","generation","selectedContext","legacyAppend"}: raise ValueError("malformed old-final role ownership state")
        context=value.get("selectedContext"); legacy=value.get("legacyAppend")
        common={"path","blockSha256","prefixSeparatorBase64","suffixSeparatorBase64"}
        if not isinstance(context,dict) or set(context)!=common|{"installerCreated"} or type(context.get("installerCreated")) is not bool: raise ValueError("malformed old-final selected context")
        if not isinstance(legacy,dict) or set(legacy)!=common or legacy.get("path")!="APPEND_SYSTEM.md": raise ValueError("malformed old-final legacy state")
        for row in (context,legacy):
            if not all(isinstance(row.get(key),str) for key in common): raise ValueError("malformed old-final role ownership state")
            try:
                base64.b64decode(row["prefixSeparatorBase64"],validate=True); base64.b64decode(row["suffixSeparatorBase64"],validate=True)
            except ValueError as exc: raise ValueError("malformed old-final role ownership state") from exc
            if len(row["blockSha256"])!=64: raise ValueError("malformed old-final role ownership state")
        selected=context["path"]; recorded=context["blockSha256"]
    else: raise ValueError("unsupported non-final role ownership state")
    if selected not in CONTEXT_CANDIDATES or not isinstance(recorded,str) or len(recorded)!=64:
        raise ValueError("malformed role ownership state")
    return {"selectedContext":selected,"kernelSha256":recorded},data,info


def inspect(root: Path,kernel: bytes) -> dict[str,Any]:
    require_directory(root,"agent root",absent=False)
    require_directory(root/STATE_REL.parent,"role state directory")
    selected,found=candidates(root); chosen=found[selected]
    state,state_bytes,state_info=load_state(root/STATE_REL)
    selected_data=b"" if chosen is None else chosen[0]
    selected_info=None if chosen is None else chosen[1]
    selected_range=managed_range(selected_data,KERNEL_START,KERNEL_END,"selected global context")
    for name,loaded in found.items():
        if loaded is None or name==selected: continue
        if one_link_case_alias(selected,name,loaded,chosen): continue
        if aliases(loaded,chosen): raise ValueError(f"hard-linked global context aliases are unsupported: {selected}, {name}")
        if managed_range(loaded[0],KERNEL_START,KERNEL_END,f"global context candidate {name}") is not None:
            raise ValueError(f"unselected global context contains a role kernel: {name}")
    if state is None:
        if selected_range is not None: raise ValueError("unowned role kernel without ownership state")
        newline=b"\r\n" if b"\r\n" in selected_data and b"\n" not in selected_data.replace(b"\r\n",b"") else b"\n"
        separator=b"" if not selected_data else newline if selected_data.endswith(b"\n") else newline+newline
        updated=selected_data+separator+kernel+(newline if selected_data.endswith(b"\n") else b"")
    else:
        if state["selectedContext"]!=selected: raise ValueError("selected global context drift")
        if selected_range is None: raise ValueError("owned role kernel is missing")
        old=selected_data[selected_range[0]:selected_range[1]]
        if digest(old)==state["kernelSha256"]:
            updated=selected_data[:selected_range[0]]+kernel+selected_data[selected_range[1]:]
        elif old==kernel:
            updated=selected_data
        else: raise ValueError("owned role kernel drifted")
    state_value={"schemaVersion":SCHEMA,"selectedContext":selected,"kernelSha256":digest(kernel)}
    return {"selected":selected,"contextData":selected_data,"contextInfo":selected_info,"updated":updated,"state":state_value,"stateData":state_bytes,"stateInfo":state_info}


def fsync_dir(path: Path) -> None:
    fd=os.open(path,os.O_RDONLY|getattr(os,"O_DIRECTORY",0))
    try: os.fsync(fd)
    finally: os.close(fd)


def atomic_write(path: Path,data: bytes,mode: int,expected: bytes|None,label: str,owner: tuple[int,int]|None=None,expected_info: os.stat_result|None=None) -> None:
    require_directory(path.parent,f"{label} parent",absent=False)
    current=lstat_regular(path,label)
    if (None if current is None else current[0])!=expected: raise ValueError(f"{label} changed after preflight")
    if expected_info is not None:
        if current is None or (current[1].st_dev,current[1].st_ino,current[1].st_uid,current[1].st_gid,stat.S_IMODE(current[1].st_mode))!=(expected_info.st_dev,expected_info.st_ino,expected_info.st_uid,expected_info.st_gid,stat.S_IMODE(expected_info.st_mode)):
            raise ValueError(f"{label} metadata changed after preflight")
    fd,temp=tempfile.mkstemp(prefix=f".{path.name}.",dir=path.parent)
    try:
        with os.fdopen(fd,"wb") as handle: handle.write(data); handle.flush(); os.fsync(handle.fileno())
        if owner is not None: os.chown(temp,*owner)
        os.chmod(temp,mode)
        os.replace(temp,path); fsync_dir(path.parent)
    finally:
        if os.path.exists(temp): os.unlink(temp)


def remove_expected(path: Path,expected: bytes,label: str) -> None:
    current=lstat_regular(path,label,absent=False); assert current
    if current[0]!=expected: raise ValueError(f"{label} changed before rollback")
    path.unlink(); fsync_dir(path.parent)


def lock(root: Path, *, create: bool) -> int:
    state_dir=root/STATE_REL.parent; require_directory(state_dir,"role state directory",absent=create)
    if not state_dir.exists():
        try: state_dir.mkdir(mode=0o700); fsync_dir(root)
        except FileExistsError: pass
    require_directory(state_dir,"role state directory",absent=False)
    path=root/LOCK_REL; loaded=lstat_regular(path,"role lock")
    if loaded is None and not create: raise ValueError("missing role lock")
    flags=os.O_RDWR|getattr(os,"O_NOFOLLOW",0)|(os.O_CREAT if create else 0)
    fd=os.open(path,flags,0o600)
    if not stat.S_ISREG(os.fstat(fd).st_mode): os.close(fd); raise ValueError("unsafe role lock")
    fcntl.flock(fd,fcntl.LOCK_EX); return fd


def apply(root: Path,kernel_path: Path) -> dict[str,Any]:
    kernel=load_kernel(kernel_path); require_directory(root,"agent root"); root.mkdir(parents=True,exist_ok=True); require_directory(root,"agent root",absent=False)
    fd=lock(root,create=True)
    try:
        plan=inspect(root,kernel); context=root/plan["selected"]; state_path=root/STATE_REL
        mode=0o644 if plan["contextInfo"] is None else stat.S_IMODE(plan["contextInfo"].st_mode)
        owner=None if plan["contextInfo"] is None else (plan["contextInfo"].st_uid,plan["contextInfo"].st_gid)
        context_changed=plan["updated"]!=plan["contextData"]
        if context_changed: atomic_write(context,plan["updated"],mode,plan["contextData"] if plan["contextInfo"] else None,"selected global context",owner,plan["contextInfo"])
        try:
            state_data=canonical(plan["state"])
            if state_data!=plan["stateData"]: atomic_write(state_path,state_data,0o600,plan["stateData"],"role ownership state",expected_info=plan["stateInfo"])
        except Exception:
            if context_changed:
                if plan["contextInfo"] is None: remove_expected(context,plan["updated"],"selected global context rollback")
                else:
                    changed=lstat_regular(context,"selected global context rollback",absent=False); assert changed
                    atomic_write(context,plan["contextData"],mode,plan["updated"],"selected global context rollback",owner,changed[1])
            raise
        checked=check(root,kernel_path,locked=True)
        return {"status":"applied",**checked}
    finally: os.close(fd)


def check(root: Path,kernel_path: Path,*,locked: bool=False) -> dict[str,Any]:
    kernel=load_kernel(kernel_path); require_directory(root,"agent root",absent=False)
    fd=None if locked else lock(root,create=False)
    try:
        plan=inspect(root,kernel); state,state_data,_=load_state(root/STATE_REL)
        if state is None or state_data!=canonical(plan["state"]): raise ValueError("role ownership state is stale")
        if plan["updated"]!=plan["contextData"]: raise ValueError("managed role kernel is stale")
        return {"status":"current","selectedContext":plan["selected"],"kernelSha256":digest(kernel)}
    finally:
        if fd is not None: os.close(fd)


def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__); sub=parser.add_subparsers(dest="command",required=True)
    for name in ("apply","check"):
        item=sub.add_parser(name); item.add_argument("kernel",type=Path); item.add_argument("root",type=Path)
    args=parser.parse_args()
    try: result=apply(args.root,args.kernel) if args.command=="apply" else check(args.root,args.kernel)
    except (OSError,ValueError,RuntimeError) as exc: print(f"role reconciliation failed: {exc}",file=sys.stderr); return 1
    print(json.dumps(result,sort_keys=True)); return 0


if __name__=="__main__": raise SystemExit(main())
