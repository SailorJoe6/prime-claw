#!/usr/bin/env python3
"""Bounded, read-only check of caller-supplied completed-plan archive evidence.

This project's archive index uses `## bundle-name/` headings. Unsupported
Markdown syntax returns non-success for separately recorded manual inspection.
The owner, not this helper, determines required artifacts and Git provenance.
"""

import argparse
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
FENCE_CLOSE = re.compile(r"^ {0,3}(`{3,}|~{3,})[ \t]*$")


def fence_transition(line: str, state: tuple[str, int] | None) -> tuple[str, int] | None:
    """Update a fenced-code state; info text is legal only on an opener."""
    if state is not None:
        close = FENCE_CLOSE.match(line.rstrip('\r\n'))
        if close and close.group(1)[0] == state[0] and len(close.group(1)) >= state[1]:
            return None
        return state
    opener = FENCE.match(line)
    return (opener.group(1)[0], len(opener.group(1))) if opener else None
INLINE_CODE = re.compile(r"(`+)(.*?)\1", re.DOTALL)
# Bounded inline links/images: plain path, optional double-quoted title, or
# angle-wrapped path (which may contain spaces/parentheses).
LINK = re.compile(r"!?\[[^]\n]*\]\((<[^>\n]+>|[^()\s]+)(?:\s+\"[^\"\n]*\")?\)")
REFERENCE = re.compile(r"!?\[[^]\n]+\]\[[^]\n]*\]|^ {0,3}\[[^]\n]+\]:", re.MULTILINE)
HTML = re.compile(r"</?[A-Za-z][^>]*>|<[^<>\s]+(?:\.\w+|/[^<>]*)>")


def checked_links(document: Path, text: str) -> list[str]:
    errors = []
    visible = []
    fence = None
    for line in text.splitlines():
        was_fenced = fence is not None
        fence = fence_transition(line, fence)
        if was_fenced or fence is not None:
            continue
        visible.append(line)
    if fence is not None:
        errors.append(f"{document}: manual link inspection required: unclosed fenced code")
    # Markdown code spans can cross a line break; mask them after collecting
    # non-fenced lines so their link-like examples remain inert.
    content = INLINE_CODE.sub("", "\n".join(visible))
    if '`' in content:
        errors.append(f"{document}: manual link inspection required: ambiguous inline code")
    for match in reversed(list(LINK.finditer(content))):
        raw = match.group(1).strip('<>')
        target = urlsplit(raw)
        if raw and not raw.startswith('#') and not target.scheme and not raw.startswith('//'):
            local = unquote(target.path)
            if local and not (document.parent / local).exists():
                errors.append(f"{document}: broken link {raw}")
        content = content[:match.start()] + content[match.end():]
    if REFERENCE.search(content) or HTML.search(content):
        errors.append(f"{document}: manual link inspection required: reference or HTML/angle syntax")
    # Any remaining inline-link opener may be a parenthesized/unsupported URL.
    if re.search(r"!?\[[^]\n]*\]\(", content):
        errors.append(f"{document}: manual link inspection required: unsupported inline destination")
    return errors




def real_index_headings(text: str) -> list[tuple[int, int, int, str]]:
    """Return heading positions outside fenced examples, including child headings."""
    headings = []
    fence = None
    offset = 0
    for line in text.splitlines(keepends=True):
        was_fenced = fence is not None
        fence = fence_transition(line, fence)
        if not was_fenced and fence is None:
            heading = re.match(r"^(#{1,6}) (.*)$", line.rstrip('\r\n'))
            if heading:
                headings.append((offset, offset + len(line), len(heading.group(1)), heading.group(2)))
        offset += len(line)
    return headings

def verify(index: Path, bundle_root: Path, artifacts: list[tuple[Path, Path]]) -> list[str]:
    errors = []
    if not artifacts:
        return ["at least one project-required artifact pair is needed"]
    root = bundle_root.resolve()
    if not bundle_root.is_dir() or root == index.parent.resolve():
        errors.append(f"reviewed bundle root is missing or ambiguous: {bundle_root}")
    if index.parent.resolve() != root.parent:
        errors.append(f"index does not belong to archive root: {index}")
    for active, archive in artifacts:
        if active.exists():
            errors.append(f"active artifact still present: {active}")
        # Resolve symlinks too: a nominal child that points outside is not inside.
        if archive.resolve() == root or root not in archive.resolve().parents:
            errors.append(f"archived artifact outside reviewed bundle: {archive}")
        if not archive.is_file():
            errors.append(f"archived artifact missing: {archive}")
        elif archive.suffix.lower() == '.md':
            errors.extend(checked_links(archive, archive.read_text()))
    if not index.is_file():
        errors.append(f"archive index missing: {index}")
    else:
        text = index.read_text()
        # Only real H2 headings count. H3-H6 descendants remain in the entry;
        # fenced examples and unrelated H2/H1 sections do not count.
        headings = real_index_headings(text)
        entries = [(start, end) for start, end, level, label in headings
                   if level == 2 and re.match(re.escape(bundle_root.name) + r"/(?=\s|$)", label)]
        if len(entries) != 1:
            errors.append(f"archive index requires one exact ## {bundle_root.name}/ entry (found {len(entries)}): {index}")
        else:
            start, _ = entries[0]
            end = next((at for at, _, level, _ in headings if at > start and level <= 2), len(text))
            errors.extend(checked_links(index, text[start:end]))
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--index', type=Path, required=True)
    parser.add_argument('--bundle-root', type=Path, required=True)
    parser.add_argument('--artifact', nargs=2, metavar=('ACTIVE', 'ARCHIVED'),
                        action='append', required=True,
                        help='one explicit project-required active path and archived destination; repeat')
    args = parser.parse_args()
    errors = verify(args.index, args.bundle_root, [(Path(a), Path(b)) for a, b in args.artifact])
    for error in errors:
        print(error)
    if errors:
        return 1
    print("Bounded archive evidence verified for supplied artifact pairs; owner must still decide completeness and provenance.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
