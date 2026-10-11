#!/usr/bin/env python3
"""Apply and check the manifest-authoritative Prime Claw delivery."""
from __future__ import annotations
import argparse, hashlib, json, os, stat, sys, tempfile, time
from pathlib import Path

STATE_REL = Path(".prime-claw/delivery-state.json")
LEGACY_STATE_REL = Path(".prime-claw/global-templates.json")
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


def safe_relative(value: object, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"invalid {label}")
    path = Path(value)
    if path.is_absolute() or any(part in ("", ".", "..") for part in path.parts):
        raise ValueError(f"unsafe {label}: {value}")
    return value


def inventory(source: Path) -> dict:
    value = load_json(source / "asset-inventory.json")
    if set(value) != {"schemaVersion", "predecessorRetiredPluginFiles", "assets"}:
        raise ValueError("asset inventory fields are malformed")
    if value.get("schemaVersion") != 2:
        raise ValueError("unsupported asset inventory")
    retired = value.get("predecessorRetiredPluginFiles")
    rows = value.get("assets")
    if not isinstance(retired, list) or not isinstance(rows, list): raise ValueError("asset inventory collections are malformed")
    retired_paths=[]
    for row in retired:
        if not isinstance(row, dict) or set(row) != {"path", "sha256"} or not isinstance(row.get("sha256"), str) or len(row["sha256"]) != 64:
            raise ValueError("malformed predecessor retired plugin file")
        retired_paths.append(safe_relative(row.get("path"), "predecessor retired plugin path"))
    if len(retired_paths) != len(set(retired_paths)): raise ValueError("repeated predecessor retired plugin path")
    ids: set[str] = set(); sources: set[str] = set(); target_keys: set[str] = set(); selected = 0
    allowed = {"plugin-root-exact", "plugin-root-managed", "user-skill-exact", "selected-context-block", "project-customizable"}
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"id", "source", "targets"}:
            raise ValueError("asset inventory row is malformed")
        asset_id = row.get("id"); source_rel = safe_relative(row.get("source"), "asset source")
        if not isinstance(asset_id, str) or not asset_id or asset_id in ids or source_rel in sources:
            raise ValueError(f"duplicate or invalid asset identity: {asset_id}")
        ids.add(asset_id); sources.add(source_rel)
        source_path = source / source_rel; info = source_path.lstat()
        if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode):
            raise ValueError(f"unsafe asset source: {source_path}")
        targets = row.get("targets")
        if not isinstance(targets, list) or not targets:
            raise ValueError(f"asset has no targets: {asset_id}")
        local: set[str] = set()
        for target in targets:
            if not isinstance(target, dict) or target.get("class") not in allowed:
                raise ValueError(f"invalid target for asset: {asset_id}")
            kind = target["class"]
            if kind == "selected-context-block":
                if set(target) != {"class"}: raise ValueError(f"malformed selected-context target: {asset_id}")
                destination = ""; selected += 1
            elif kind == "project-customizable":
                if set(target) != {"class", "destination", "exposure", "lifecycleTrigger", "migrateFrom"}:
                    raise ValueError(f"malformed project target: {asset_id}")
                destination = safe_relative(target.get("destination"), "project target")
                safe_relative(target.get("migrateFrom"), "project migration source")
                if target.get("exposure") not in {"discoverable", "internal"} or not isinstance(target.get("lifecycleTrigger"), str) or not target["lifecycleTrigger"]:
                    raise ValueError(f"invalid project target policy: {asset_id}")
            else:
                if set(target) != {"class", "destination"}: raise ValueError(f"malformed file target: {asset_id}")
                destination = safe_relative(target.get("destination"), "delivery target")
            key = f"{kind}:{destination}"
            if key in local or key in target_keys: raise ValueError(f"duplicate delivery target: {key}")
            local.add(key); target_keys.add(key)
        plugin_targets = [target for target in targets if target["class"] in {"plugin-root-exact", "plugin-root-managed"}]
        if len(plugin_targets) != 1 or plugin_targets[0]["destination"] != source_rel:
            raise ValueError(f"asset {asset_id} must have one source-matching plugin-root target")
    if selected != 1:
        raise ValueError("asset inventory must contain exactly one selected-context block")
    all_sources = {
        str(path.relative_to(source))
        for path in source.rglob("*")
        if path.is_file() and not path.is_symlink()
    }
    expected_sources = all_sources
    if sources != expected_sources:
        raise ValueError(f"asset inventory source coverage mismatch: missing={sorted(expected_sources-sources)} extra={sorted(sources-expected_sources)}")
    return value


def targets(value: dict, kind: str) -> list[dict]:
    return [
        {"id": row["id"], "source": row["source"], **target}
        for row in value["assets"] for target in row["targets"]
        if target["class"] == kind
    ]


def managed_assets(value: dict) -> list[dict]:
    return targets(value, "plugin-root-managed")


def selected_context_source(source: Path, value: dict) -> Path:
    rows = targets(value, "selected-context-block")
    if len(rows) != 1: raise ValueError("expected one selected-context block")
    return source / rows[0]["source"]


def load_state_path(path: Path) -> dict:
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode):
        raise ValueError(f"unsafe delivery state: {path}")
    value = load_json(path)
    if value.get("schemaVersion") != SCHEMA or not isinstance(value.get("assets"), dict):
        raise ValueError("unsupported delivery state")
    owned = value.get("ownedFiles", {})
    if not isinstance(owned, dict): raise ValueError("malformed delivery owned-file state")
    for key, digest_value in owned.items():
        if not isinstance(key, str) or ":" not in key or not isinstance(digest_value, str) or len(digest_value) != 64:
            raise ValueError("malformed delivery owned-file state")
        kind, relative = key.split(":", 1)
        if kind not in {"plugin-root", "user-skill"}: raise ValueError("unsupported delivery owned-file state")
        safe_relative(relative, "owned-file state path")
    return {"schemaVersion": SCHEMA, "assets": value["assets"], "ownedFiles": owned}


def state_for(root: Path) -> tuple[dict, bool]:
    path = root / STATE_REL
    validate_parent(root, path)
    if path.exists() or path.is_symlink(): return load_state_path(path), False
    legacy = root / LEGACY_STATE_REL
    validate_parent(root, legacy)
    if legacy.exists() or legacy.is_symlink():
        old = load_state_path(legacy)
        return {"schemaVersion": SCHEMA, "assets": old["assets"], "ownedFiles": {}}, True
    return {"schemaVersion": SCHEMA, "assets": {}, "ownedFiles": {}}, False


def prior_owned(source_root: Path, root: Path, value: dict, state: dict) -> dict[str, str | None]:
    retired = {f"plugin-root:{row['path']}": row["sha256"] for row in value["predecessorRetiredPluginFiles"]}
    if state["ownedFiles"]: return {**retired, **state["ownedFiles"]}
    installed = root / "asset-inventory.json"
    if not installed.exists() and not installed.is_symlink(): return retired
    info = installed.lstat()
    if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode): raise ValueError(f"unsafe installed asset inventory: {installed}")
    previous = load_json(installed)
    if previous.get("schemaVersion") == 1:
        owned = {
            key: None for key in current_file_targets(value)
            if key.startswith("plugin-root:")
        }
        owned.update(retired)
        return owned
    if previous.get("schemaVersion") == 2:
        raise ValueError("schema v2 delivery is missing its ownership state")
    raise ValueError("unsupported installed asset inventory")


def backup(root: Path, relative: str, source: Path) -> str:
    stamp = f"{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}-{time.time_ns()}"
    destination = root / BACKUP_REL / stamp / relative
    safe_private_parent(root, destination)
    if destination.exists() or destination.is_symlink(): raise ValueError(f"global backup collision: {relative}")
    atomic_copy(source, destination, 0o600)
    if sha(destination) != sha(source): raise ValueError(f"global backup verification failed: {relative}")
    return str(destination.relative_to(root))


def destination_for(key: str, root: Path, user_root: Path) -> Path:
    kind, relative = key.split(":", 1)
    if kind == "plugin-root": return root / relative
    if kind == "user-skill": return user_root / relative
    raise ValueError(f"unsupported owned-file key: {key}")


def current_file_targets(value: dict) -> dict[str, dict]:
    result = {}
    for kind, prefix in (("plugin-root-exact", "plugin-root"), ("plugin-root-managed", "plugin-root"), ("user-skill-exact", "user-skill")):
        for row in targets(value, kind): result[f"{prefix}:{row['destination']}"] = row
    return result


def collision_paths(value: dict, root: Path) -> list[Path]:
    paths=[]
    for row in targets(value, "project-customizable"):
        parts=Path(row["destination"]).parts
        if len(parts) == 4 and parts[:2] == (".agents", "skills") and parts[3] == "SKILL.md":
            paths.append(root / "skills" / parts[2])
    return paths


def validate_base(base: Path, label: str) -> None:
    if base.exists() or base.is_symlink():
        info=base.lstat()
        if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode): raise ValueError(f"unsafe {label} directory: {base}")


def preflight(source_root: Path, root: Path, user_root: Path, action: str) -> tuple[dict, int]:
    value=inventory(source_root); state,_=state_for(root); prior=prior_owned(source_root,root,value,state); current=current_file_targets(value)
    validate_base(root,"managed plugin"); validate_base(user_root,"user skill root")
    rows=[]; conflicts=0
    for key,row in current.items():
        destination=destination_for(key,root,user_root); base=root if key.startswith("plugin-root:") else user_root
        if base.exists(): validate_parent(base,destination)
        if destination.exists() or destination.is_symlink():
            info=destination.lstat()
            if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode): raise ValueError(f"unsafe managed plugin destination: {destination}")
    for key,digest_value in prior.items():
        if key in current: continue
        destination=destination_for(key,root,user_root)
        validate_parent(root if key.startswith("plugin-root:") else user_root, destination)
        if destination.exists() or destination.is_symlink():
            info=destination.lstat()
            if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode): raise ValueError(f"unsafe retired managed destination: {destination}")
            if digest_value != sha(destination): raise ValueError(f"changed retired managed destination requires recovery: {destination}")
    for collision in collision_paths(value,root):
        if collision.exists() or collision.is_symlink(): raise ValueError(f"unexpected global project-template skill collision: {collision}")
    for asset in managed_assets(value):
        relative=asset["destination"]; source=source_root/asset["source"]; destination=root/relative
        validate_parent(root,destination); upstream=sha(source); prior_asset=state["assets"].get(asset["id"]); current_sha=sha(destination) if destination.exists() else None
        safe=current_sha is None or current_sha == upstream or bool(prior_asset and prior_asset.get("state")=="managed" and current_sha==prior_asset.get("installedSha256"))
        settled=bool(prior_asset and prior_asset.get("state")=="accepted-override" and current_sha==prior_asset.get("installedSha256") and upstream==prior_asset.get("baselineSha256"))
        if not safe and not settled and action=="backup-reset":
            validate_parent(root, root / BACKUP_REL / "preflight" / relative)
        conflict=not safe and not settled and action=="preserve"; rows.append({"id":asset["id"],"status":"conflict" if conflict else "ready"}); conflicts += int(conflict)
    return {"ok":conflicts==0,"conflicts":conflicts,"assets":rows,"state":str(STATE_REL)},conflicts


def apply(source_root: Path, root: Path, user_root: Path, action: str) -> tuple[dict, int]:
    result,conflicts=preflight(source_root,root,user_root,action)
    if conflicts: return result,conflicts
    value=inventory(source_root); state,migrated_legacy=state_for(root); prior=prior_owned(source_root,root,value,state); current=current_file_targets(value)
    root.mkdir(parents=True,exist_ok=True); user_root.mkdir(parents=True,exist_ok=True)
    for row in targets(value,"plugin-root-exact"):
        destination=root/row["destination"]; safe_parent(root,destination); destination.parent.mkdir(parents=True,exist_ok=True); atomic_copy(source_root/row["source"],destination)
    for row in targets(value,"user-skill-exact"):
        destination=user_root/row["destination"]; safe_parent(user_root,destination); destination.parent.mkdir(parents=True,exist_ok=True); atomic_copy(source_root/row["source"],destination)
    rows=[]; active_managed=set()
    for asset in managed_assets(value):
        active_managed.add(asset["id"]); relative=asset["destination"]; source=source_root/asset["source"]; destination=root/relative; safe_parent(root,destination); destination.parent.mkdir(parents=True,exist_ok=True)
        upstream=sha(source); prior_asset=state["assets"].get(asset["id"]); current_sha=sha(destination) if destination.exists() else None
        settled_result=None
        if current_sha is None:
            atomic_copy(source,destination); entry={"source":asset["source"],"destination":relative,"baselineSha256":upstream,"installedSha256":upstream,"availableUpstreamSha256":upstream,"state":"managed","backup":None}; action_name="created"
        elif current_sha==upstream:
            recovered=bool(prior_asset and (prior_asset.get("state")!="managed" or prior_asset.get("installedSha256")!=upstream or prior_asset.get("baselineSha256")!=upstream)); entry={**(prior_asset or {}),"source":asset["source"],"destination":relative,"baselineSha256":upstream,"installedSha256":upstream,"availableUpstreamSha256":upstream,"state":"managed","backup":prior_asset.get("backup") if prior_asset else None}; action_name="recovered" if recovered else "unchanged" if prior_asset else "adopted"
        elif prior_asset and prior_asset.get("state")=="managed" and current_sha==prior_asset.get("installedSha256"):
            atomic_copy(source,destination); entry={**prior_asset,"source":asset["source"],"destination":relative,"baselineSha256":upstream,"installedSha256":upstream,"availableUpstreamSha256":upstream,"state":"managed"}; action_name="updated"
        elif action=="backup-reset":
            saved=backup(root,relative,destination); atomic_copy(source,destination); entry={"source":asset["source"],"destination":relative,"baselineSha256":upstream,"installedSha256":upstream,"availableUpstreamSha256":upstream,"state":"managed","backup":saved}; action_name="backup-reset"
        elif action=="accept-override":
            entry={"source":asset["source"],"destination":relative,"baselineSha256":upstream,"installedSha256":current_sha,"availableUpstreamSha256":upstream,"state":"accepted-override","backup":prior_asset.get("backup") if prior_asset else None}; action_name="accepted-override"
        else:
            settled=bool(prior_asset and prior_asset.get("state")=="accepted-override" and current_sha==prior_asset.get("installedSha256") and upstream==prior_asset.get("baselineSha256")); entry={"source":asset["source"],"destination":relative,"baselineSha256":prior_asset.get("baselineSha256") if prior_asset else None,"installedSha256":current_sha,"availableUpstreamSha256":upstream,"state":"accepted-override" if settled else "customized","backup":prior_asset.get("backup") if prior_asset else None}; action_name="preserved"; settled_result=settled; conflicts += 0 if settled else 1
        state["assets"][asset["id"]]=entry; rows.append({"id":asset["id"],"action":action_name,**({"settled":settled_result} if settled_result is not None else {})})
    state["assets"]={key:item for key,item in state["assets"].items() if key in active_managed}
    for key,digest_value in prior.items():
        if key in current: continue
        destination=destination_for(key,root,user_root)
        if destination.exists():
            if digest_value != sha(destination): raise ValueError(f"changed retired managed destination requires recovery: {destination}")
            destination.unlink(); fsync_dir(destination.parent)
    state["ownedFiles"]={key:sha(destination_for(key,root,user_root)) for key in current}
    safe_private_parent(root,root/STATE_REL); atomic_json(root/STATE_REL,state)
    legacy=root/LEGACY_STATE_REL
    if migrated_legacy and legacy.exists(): legacy.unlink(); fsync_dir(legacy.parent)
    return {"ok":conflicts==0,"conflicts":conflicts,"assets":rows,"state":str(STATE_REL)},conflicts


def check(source_root: Path, root: Path, user_root: Path) -> tuple[dict,int]:
    value=inventory(source_root); validate_base(root,"managed plugin"); validate_base(user_root,"user skill root")
    state,_=state_for(root); current=current_file_targets(value); prior=prior_owned(source_root,root,value,state); rows=[]; conflicts=0
    if set(state["ownedFiles"]) != set(current): conflicts+=1; rows.append({"id":"delivery-state","status":"target-set-mismatch"})
    for key in prior.keys() - current.keys():
        destination=destination_for(key,root,user_root)
        validate_parent(root if key.startswith("plugin-root:") else user_root, destination)
        if destination.exists() or destination.is_symlink():
            rows.append({"id":key,"status":"retired-present"}); conflicts+=1
    for key,row in current.items():
        destination=destination_for(key,root,user_root)
        validate_parent(root if key.startswith("plugin-root:") else user_root, destination)
        if not destination.exists() or destination.is_symlink() or not stat.S_ISREG(destination.lstat().st_mode): rows.append({"id":row["id"],"status":"missing-or-unsafe"}); conflicts+=1; continue
        if row["class"] in {"plugin-root-exact","user-skill-exact"}:
            status_value="managed" if sha(destination)==sha(source_root/row["source"]) and state["ownedFiles"].get(key)==sha(destination) else "stale"
            rows.append({"id":row["id"],"status":status_value}); conflicts += int(status_value!="managed")
    for collision in collision_paths(value,root):
        if collision.exists() or collision.is_symlink(): rows.append({"id":"project-skill-collision","status":"present"}); conflicts+=1
    for asset in managed_assets(value):
        destination=root/asset["destination"]; prior_asset=state["assets"].get(asset["id"])
        if not destination.exists() or destination.is_symlink() or not stat.S_ISREG(destination.lstat().st_mode): rows.append({"id":asset["id"],"status":"missing-or-unsafe"}); conflicts+=1; continue
        current_sha=sha(destination); upstream=sha(source_root/asset["source"]); managed=bool(prior_asset and prior_asset.get("state")=="managed" and current_sha==upstream==prior_asset.get("installedSha256") and state["ownedFiles"].get(f"plugin-root:{asset['destination']}")==current_sha); override=bool(prior_asset and prior_asset.get("state")=="accepted-override" and current_sha==prior_asset.get("installedSha256") and upstream==prior_asset.get("baselineSha256") and state["ownedFiles"].get(f"plugin-root:{asset['destination']}")==current_sha); status_value="managed" if managed else "accepted-override" if override else "unresolved-drift"; rows.append({"id":asset["id"],"status":status_value}); conflicts += int(not (managed or override))
    return {"ok":conflicts==0,"conflicts":conflicts,"assets":rows,"state":str(STATE_REL)},conflicts


def main() -> int:
    parser=argparse.ArgumentParser(); parser.add_argument("mode",choices=("preflight","apply","check","selected-context-source")); parser.add_argument("source_root",type=Path); parser.add_argument("destination_root",type=Path,nargs="?"); parser.add_argument("--user-root",type=Path); parser.add_argument("--action",choices=("preserve","backup-reset","accept-override"),default="preserve"); args=parser.parse_args()
    try:
        source=args.source_root.resolve(strict=True); value=inventory(source)
        if args.mode=="selected-context-source": print(selected_context_source(source,value)); return 0
        if args.destination_root is None or args.user_root is None: raise ValueError("destination root and --user-root are required")
        validate_base(args.destination_root, "managed plugin")
        validate_base(args.user_root, "user skill root")
        root=args.destination_root.resolve(strict=True); user=args.user_root.resolve(strict=False)
        result,conflicts=(preflight(source,root,user,args.action) if args.mode=="preflight" else apply(source,root,user,args.action) if args.mode=="apply" else check(source,root,user))
        print(json.dumps(result,sort_keys=True))
        if conflicts: print(f"plugin delivery drift requires explicit resolution: {conflicts} asset(s)",file=sys.stderr)
        return 0 if conflicts==0 else 3
    except Exception as error:
        print(f"plugin delivery reconciliation failed: {error}",file=sys.stderr); return 1
if __name__=="__main__": raise SystemExit(main())
