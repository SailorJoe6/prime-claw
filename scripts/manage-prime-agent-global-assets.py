#!/usr/bin/env python3
"""Safely reconcile plugin-managed global Markdown assets from the inventory."""
from __future__ import annotations
import argparse, hashlib, json, os, stat, sys, tempfile, time
from pathlib import Path

STATE_REL = Path(".prime-claw/global-templates.json")
BACKUP_REL = Path(".prime-claw/backups")
SCHEMA = 1


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fsync_dir(path: Path) -> None:
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
    fd = os.open(path, flags)
    try: os.fsync(fd)
    finally: os.close(fd)


def load_json(path: Path) -> dict:
    value = json.loads(path.read_text())
    if not isinstance(value, dict): raise ValueError(f"{path} must contain an object")
    return value


def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as handle:
            json.dump(value, handle, indent=2, sort_keys=True); handle.write("\n"); handle.flush(); os.fsync(handle.fileno())
        os.replace(temp, path)
        fsync_dir(path.parent)
    finally:
        if os.path.exists(temp): os.unlink(temp)


def atomic_copy(source: Path, destination: Path, mode: int = 0o644) -> None:
    fd, temp = tempfile.mkstemp(prefix=f".{destination.name}.", dir=destination.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(source.read_bytes()); handle.flush(); os.fsync(handle.fileno())
        os.chmod(temp, mode)
        os.replace(temp, destination)
        fsync_dir(destination.parent)
    finally:
        if os.path.exists(temp): os.unlink(temp)


def safe_parent(root: Path, destination: Path) -> None:
    current = root
    for part in destination.relative_to(root).parts[:-1]:
        current /= part
        if current.exists() or current.is_symlink():
            st = current.lstat()
            if not stat.S_ISDIR(st.st_mode) or stat.S_ISLNK(st.st_mode): raise ValueError(f"unsafe managed global directory: {current}")
        else:
            parent=current.parent; current.mkdir(mode=0o755); fsync_dir(parent); fsync_dir(current)




def validate_parent(root: Path, destination: Path) -> None:
    current = root
    for part in destination.relative_to(root).parts[:-1]:
        current /= part
        if current.exists() or current.is_symlink():
            st = current.lstat()
            if not stat.S_ISDIR(st.st_mode) or stat.S_ISLNK(st.st_mode): raise ValueError(f"unsafe managed global directory: {current}")
        else: return


def safe_private_parent(root: Path, destination: Path) -> None:
    current = root
    for part in destination.relative_to(root).parts[:-1]:
        current /= part
        if current.exists() or current.is_symlink():
            st = current.lstat()
            if not stat.S_ISDIR(st.st_mode) or stat.S_ISLNK(st.st_mode): raise ValueError(f"unsafe private global directory: {current}")
        else:
            parent=current.parent; current.mkdir(mode=0o700); fsync_dir(parent)
        os.chmod(current, 0o700)
        fsync_dir(current)


def assets(source: Path) -> list[dict]:
    inv = load_json(source / "asset-inventory.json")
    if inv.get("schemaVersion") != 1 or not isinstance(inv.get("assets"), list): raise ValueError("unsupported asset inventory")
    rows=[]; ids=set(); destinations=set()
    for asset in inv["assets"]:
        if not isinstance(asset,dict): raise ValueError("asset inventory row must be an object")
        for key in ("id","source","scope","destination"):
            if not isinstance(asset.get(key),str) or not asset[key]: raise ValueError(f"invalid asset {key}")
        source_rel=Path(asset["source"]); destination_rel=Path(asset["destination"])
        if source_rel.is_absolute() or ".." in source_rel.parts or destination_rel.is_absolute() or ".." in destination_rel.parts: raise ValueError(f"unsafe asset path: {asset['id']}")
        if asset["id"] in ids or asset["destination"] in destinations: raise ValueError(f"duplicate asset identity or destination: {asset['id']}")
        ids.add(asset["id"]);destinations.add(asset["destination"])
        source_path=source/source_rel; st=source_path.lstat()
        if not stat.S_ISREG(st.st_mode) or stat.S_ISLNK(st.st_mode): raise ValueError(f"unsafe asset source: {source_path}")
        if asset.get("scope")=="global" and asset.get("id")!="global-role-kernel": rows.append(asset)
    return rows


def state_for(root: Path) -> dict:
    path = root / STATE_REL
    current = root
    for part in STATE_REL.parts[:-1]:
        current /= part
        if current.exists() or current.is_symlink():
            st = current.lstat()
            if not stat.S_ISDIR(st.st_mode) or stat.S_ISLNK(st.st_mode): raise ValueError(f"unsafe global template state directory: {current}")
        else: return {"schemaVersion": SCHEMA, "assets": {}}
    if not path.exists() and not path.is_symlink(): return {"schemaVersion": SCHEMA, "assets": {}}
    st = path.lstat()
    if not stat.S_ISREG(st.st_mode) or stat.S_ISLNK(st.st_mode): raise ValueError(f"unsafe global template state: {path}")
    value = load_json(path)
    if value.get("schemaVersion") != SCHEMA or not isinstance(value.get("assets"), dict): raise ValueError("unsupported global template state")
    return value


def backup(root: Path, relative: str, source: Path) -> str:
    stamp = f"{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}-{time.time_ns()}"
    destination = root / BACKUP_REL / stamp / relative
    safe_private_parent(root, destination)
    if destination.exists() or destination.is_symlink(): raise ValueError(f"global backup collision: {relative}")
    atomic_copy(source, destination, 0o600)
    if sha(destination) != sha(source): raise ValueError(f"global backup verification failed: {relative}")
    return str(destination.relative_to(root))


def preflight(source_root: Path, root: Path, action: str) -> tuple[dict, int]:
    state = state_for(root); rows=[]; conflicts=0
    for asset in assets(source_root):
        relative=asset["destination"]; source=source_root/asset["source"]; destination=root/relative
        validate_parent(root,destination)
        if destination.exists() or destination.is_symlink():
            st=destination.lstat()
            if not stat.S_ISREG(st.st_mode) or stat.S_ISLNK(st.st_mode): raise ValueError(f"unsafe managed global destination: {destination}")
        upstream=sha(source); prior=state["assets"].get(asset["id"]); current=sha(destination) if destination.exists() else None
        safe = current is None or current == upstream or bool(prior and prior.get("state")=="managed" and current==prior.get("installedSha256"))
        settled = bool(prior and prior.get("state")=="accepted-override" and current==prior.get("installedSha256") and upstream==prior.get("baselineSha256"))
        conflict = not safe and not settled and action == "preserve"
        if not safe and not settled and action == "backup-reset": validate_parent(root, root / BACKUP_REL / "preflight" / relative)
        rows.append({"id":asset["id"],"status":"conflict" if conflict else "ready"})
        conflicts += 1 if conflict else 0
    return {"ok":conflicts==0,"conflicts":conflicts,"assets":rows,"state":str(STATE_REL)},conflicts


def apply(source_root: Path, root: Path, action: str) -> tuple[dict, int]:
    state = state_for(root); rows=[]; conflicts=0
    for asset in assets(source_root):
        relative = asset["destination"]; source = source_root / asset["source"]; destination = root / relative
        safe_parent(root, destination)
        if destination.exists() or destination.is_symlink():
            st=destination.lstat()
            if not stat.S_ISREG(st.st_mode) or stat.S_ISLNK(st.st_mode): raise ValueError(f"unsafe managed global destination: {destination}")
        upstream=sha(source); prior=state["assets"].get(asset["id"]); current=sha(destination) if destination.exists() else None
        if current is None:
            destination.parent.mkdir(parents=True,exist_ok=True); atomic_copy(source,destination)
            state["assets"][asset["id"]]={"source":asset["source"],"destination":relative,"baselineSha256":upstream,"installedSha256":upstream,"availableUpstreamSha256":upstream,"state":"managed","backup":None}; rows.append({"id":asset["id"],"action":"created"}); continue
        if current==upstream:
            recovered=bool(prior and (prior.get("state")!="managed" or prior.get("installedSha256")!=upstream or prior.get("baselineSha256")!=upstream))
            state["assets"][asset["id"]]={**(prior or {}),"source":asset["source"],"destination":relative,"baselineSha256":upstream,"installedSha256":upstream,"availableUpstreamSha256":upstream,"state":"managed","backup":prior.get("backup") if prior else None}; rows.append({"id":asset["id"],"action":"recovered" if recovered else "unchanged" if prior else "adopted"}); continue
        if prior and prior.get("state")=="managed" and current==prior.get("installedSha256"):
            atomic_copy(source,destination)
            state["assets"][asset["id"]]={**prior,"source":asset["source"],"destination":relative,"baselineSha256":upstream,"installedSha256":upstream,"availableUpstreamSha256":upstream,"state":"managed"}; rows.append({"id":asset["id"],"action":"updated"}); continue
        if action=="backup-reset":
            saved=backup(root,relative,destination); atomic_copy(source,destination)
            state["assets"][asset["id"]]={"source":asset["source"],"destination":relative,"baselineSha256":upstream,"installedSha256":upstream,"availableUpstreamSha256":upstream,"state":"managed","backup":saved}; rows.append({"id":asset["id"],"action":"backup-reset","backup":saved}); continue
        if action=="accept-override":
            state["assets"][asset["id"]]={"source":asset["source"],"destination":relative,"baselineSha256":upstream,"installedSha256":current,"availableUpstreamSha256":upstream,"state":"accepted-override","backup":prior.get("backup") if prior else None}; rows.append({"id":asset["id"],"action":"accepted-override"}); continue
        settled=bool(prior and prior.get("state")=="accepted-override" and current==prior.get("installedSha256") and upstream==prior.get("baselineSha256"))
        state["assets"][asset["id"]]={"source":asset["source"],"destination":relative,"baselineSha256":prior.get("baselineSha256") if prior else None,"installedSha256":current,"availableUpstreamSha256":upstream,"state":"accepted-override" if settled else "customized","backup":prior.get("backup") if prior else None}
        rows.append({"id":asset["id"],"action":"preserved","settled":settled}); conflicts += 0 if settled else 1
    safe_private_parent(root, root / STATE_REL)
    atomic_json(root/STATE_REL,state)
    return {"ok":conflicts==0,"conflicts":conflicts,"assets":rows,"state":str(STATE_REL)}, conflicts


def check(source_root: Path, root: Path) -> tuple[dict,int]:
    state=state_for(root); rows=[]; conflicts=0
    for asset in assets(source_root):
        destination=root/asset["destination"]; prior=state["assets"].get(asset["id"])
        if not destination.exists() or destination.is_symlink() or not stat.S_ISREG(destination.lstat().st_mode): rows.append({"id":asset["id"],"status":"missing-or-unsafe"}); conflicts+=1; continue
        current=sha(destination); upstream=sha(source_root/asset["source"])
        managed=bool(prior and prior.get("state")=="managed" and current==upstream==prior.get("installedSha256"))
        override=bool(prior and prior.get("state")=="accepted-override" and current==prior.get("installedSha256") and upstream==prior.get("baselineSha256"))
        status_value="managed" if managed else "accepted-override" if override else "unresolved-drift"
        rows.append({"id":asset["id"],"status":status_value}); conflicts += 0 if managed or override else 1
    return {"ok":conflicts==0,"conflicts":conflicts,"assets":rows,"state":str(STATE_REL)},conflicts


def main() -> int:
    parser=argparse.ArgumentParser(); parser.add_argument("mode",choices=("preflight","apply","check")); parser.add_argument("source_root",type=Path); parser.add_argument("destination_root",type=Path); parser.add_argument("--action",choices=("preserve","backup-reset","accept-override"),default="preserve"); args=parser.parse_args()
    try:
        source=args.source_root.resolve(strict=True); root=args.destination_root.resolve(strict=True)
        result,conflicts=(preflight(source,root,args.action) if args.mode=="preflight" else apply(source,root,args.action) if args.mode=="apply" else check(source,root))
        print(json.dumps(result,sort_keys=True))
        if conflicts: print(f"global managed asset drift requires explicit resolution: {conflicts} asset(s)",file=sys.stderr)
        return 0 if conflicts==0 else 3
    except Exception as error:
        print(f"global managed asset reconciliation failed: {error}",file=sys.stderr); return 1
if __name__=="__main__": raise SystemExit(main())
