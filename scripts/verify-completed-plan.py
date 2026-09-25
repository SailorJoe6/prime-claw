#!/usr/bin/env python3
"""Check the concrete artifact/archive evidence supplied by the owning conversation.

This is a mechanical aid, not a completeness, review, or merge decision. The owner
gets the required artifact list and terminal policy from the project's skills.
"""

import argparse
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

LINK = re.compile(r"(?<!!)\[[^]\n]*\]\(([^)]+)\)")


def broken_links(document: Path) -> list[str]:
    errors = []
    for raw in LINK.findall(document.read_text()):
        target = raw.strip().split(' "', 1)[0].strip('<>')
        if not target or target.startswith('#') or urlsplit(target).scheme or target.startswith('//'):
            continue
        path = unquote(urlsplit(target).path)
        if path and not (document.parent / path).exists():
            errors.append(f"{document}: broken link {target}")
    return errors


def verify(index: Path, artifacts: list[tuple[Path, Path]]) -> list[str]:
    errors = []
    if not artifacts:
        return ["at least one project-required artifact pair is needed"]
    destinations = {archive.parent for _, archive in artifacts}
    if len(destinations) != 1:
        errors.append("archived artifacts must belong to one reviewed bundle directory")
    for active, archive in artifacts:
        if active.exists():
            errors.append(f"active artifact still present: {active}")
        if not archive.is_file():
            errors.append(f"archived artifact missing: {archive}")
        elif archive.suffix.lower() == '.md':
            errors.extend(broken_links(archive))
    if not index.is_file():
        errors.append(f"archive index missing: {index}")
    elif len(destinations) == 1:
        directory = next(iter(destinations))
        if index.parent != directory.parent:
            errors.append(f"index does not belong to archive root: {index}")
        index_text = index.read_text()
        entry = re.search(r"(?<![\w/-])" + re.escape(directory.name) + r"/", index_text)
        if not entry:
            errors.append(f"archive index has no entry for {directory.name}/: {index}")
        else:
            # Only inspect the relevant entry, not unrelated historical sections.
            next_heading = re.search(r"^#{1,6} ", index_text[entry.end():], re.MULTILINE)
            line_start = index_text.rfind('\n', 0, entry.start()) + 1
            section = index_text[line_start:entry.end() + next_heading.start() if next_heading else None]
            for raw in LINK.findall(section):
                target = raw.strip().split(' "', 1)[0].strip('<>')
                if target and not target.startswith('#') and not urlsplit(target).scheme and not target.startswith('//'):
                    path = unquote(urlsplit(target).path)
                    if path and not (index.parent / path).exists():
                        errors.append(f"{index}: broken index link {target}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--index', type=Path, required=True)
    parser.add_argument('--artifact', nargs=2, metavar=('ACTIVE', 'ARCHIVED'),
                        action='append', required=True,
                        help='one explicit project-required active path and its archived destination; repeat')
    args = parser.parse_args()
    errors = verify(args.index, [(Path(a), Path(b)) for a, b in args.artifact])
    for error in errors:
        print(error)
    if errors:
        return 1
    print("Archive evidence verified for supplied artifact pairs; owner must still decide completeness and merge readiness.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
