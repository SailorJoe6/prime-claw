#!/usr/bin/env python3
import argparse
from pathlib import Path
import re
import sys

START = "<!-- prime-claw:conversation-identity:start -->"
END = "<!-- prime-claw:conversation-identity:end -->"

def load_block(path: Path) -> str:
    text = path.read_text().strip()
    if text.count(START) != 1 or text.count(END) != 1 or text.index(START) > text.index(END):
        raise ValueError(f"managed APPEND_SYSTEM source is malformed: {path}")
    return text

def ranges(text: str):
    starts = [m.start() for m in re.finditer(re.escape(START), text)]
    ends = [m.end() for m in re.finditer(re.escape(END), text)]
    if len(starts) != len(ends): raise ValueError("installed APPEND_SYSTEM has unbalanced prime-claw markers")
    if len(starts) > 1: raise ValueError("installed APPEND_SYSTEM has duplicate prime-claw identity blocks")
    return starts, ends

def main() -> int:
    parser=argparse.ArgumentParser();parser.add_argument("mode",choices=["apply","check","validate"]);parser.add_argument("source",type=Path);parser.add_argument("destination",type=Path);args=parser.parse_args()
    block=load_block(args.source)
    existing=args.destination.read_text() if args.destination.exists() else ""
    try: starts,ends=ranges(existing)
    except ValueError as error: print(str(error),file=sys.stderr);return 1
    if args.mode=="validate": return 0
    if args.mode=="check":
        if len(starts)!=1:
            print(f"missing managed identity block: {args.destination}",file=sys.stderr);return 1
        actual=existing[starts[0]:ends[0]].strip()
        if actual!=block:
            print(f"stale managed identity block: {args.destination}",file=sys.stderr);return 1
        return 0
    if starts:
        updated=existing[:starts[0]].rstrip()+"\n\n"+block+"\n\n"+existing[ends[0]:].lstrip()
    elif existing.strip(): updated=existing.rstrip()+"\n\n"+block+"\n"
    else: updated=block+"\n"
    args.destination.parent.mkdir(parents=True,exist_ok=True);args.destination.write_text(updated)
    return 0
if __name__=="__main__": raise SystemExit(main())
