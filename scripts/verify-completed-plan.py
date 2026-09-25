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


def blank(text: str) -> str:
    """Hide literal syntax while keeping offsets and line boundaries stable."""
    return ''.join('\n' if char == '\n' else ' ' for char in text)


def mask_visible(document: Path, text: str) -> tuple[str, list[str]]:
    """One conservative visibility pass for both index headings and links."""
    errors = []
    visible = []
    fence = None
    comment = False
    for line in text.splitlines(keepends=True):
        if fence is not None:
            fence = fence_transition(line, fence)
            visible.append(blank(line))
            continue
        pieces = []
        remaining = line
        while remaining:
            if comment:
                end = remaining.find('-->')
                if end < 0:
                    pieces.append(blank(remaining))
                    remaining = ''
                else:
                    pieces.append(blank(remaining[:end + 3]))
                    remaining = remaining[end + 3:]
                    comment = False
            else:
                start = remaining.find('<!--')
                if start < 0:
                    pieces.append(remaining)
                    remaining = ''
                else:
                    pieces.append(remaining[:start])
                    remaining = remaining[start:]
                    comment = True
        masked = ''.join(pieces)
        if not comment and FENCE.match(masked):
            fence = fence_transition(masked, None)
            visible.append(blank(line))
        else:
            visible.append(masked)
    if comment:
        errors.append(f"{document}: manual link inspection required: unclosed HTML comment")
    if fence is not None:
        errors.append(f"{document}: manual link inspection required: unclosed fenced code")
    content = INLINE_CODE.sub(lambda match: blank(match.group()), ''.join(visible))
    if '`' in content:
        errors.append(f"{document}: manual link inspection required: ambiguous inline code")
    return content, errors


def raw_html_error(document: Path, content: str) -> list[str]:
    # A supported angle-wrapped inline destination is not raw HTML.
    without_links = LINK.sub(lambda match: blank(match.group()), content)
    if re.search(r'<[A-Za-z!/]', without_links):
        return [f"{document}: manual link inspection required: raw HTML/angle syntax"]
    return []


def checked_links(document: Path, text: str) -> list[str]:
    content, errors = mask_visible(document, text)
    errors.extend(raw_html_error(document, content))
    for match in reversed(list(LINK.finditer(content))):
        raw = match.group(1).strip('<>')
        target = urlsplit(raw)
        if raw and not raw.startswith('#') and not target.scheme and not raw.startswith('//'):
            local = unquote(target.path)
            if local and not (document.parent / local).exists():
                errors.append(f"{document}: broken link {raw}")
        content = content[:match.start()] + blank(content[match.start():match.end()]) + content[match.end():]
    if REFERENCE.search(content) or HTML.search(content):
        errors.append(f"{document}: manual link inspection required: reference or HTML/angle syntax")
    if re.search(r"!?\[[^]\n]*\]\(", content):
        errors.append(f"{document}: manual link inspection required: unsupported inline destination")
    return errors


def real_index_headings(visible: str) -> list[tuple[int, int, int, str]]:
    """Return headings from already-masked Markdown, including descendants."""
    headings = []
    offset = 0
    for line in visible.splitlines(keepends=True):
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
        if active.exists() or active.is_symlink():
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
        visible, visibility_errors = mask_visible(index, text)
        errors.extend(visibility_errors)
        errors.extend(raw_html_error(index, visible))
        # Only real H2 headings count. H3-H6 descendants remain in the entry;
        # fenced examples and unrelated H2/H1 sections do not count.
        headings = real_index_headings(visible)
        entries = [(start, end) for start, end, level, label in headings
                   if level == 2 and re.match(re.escape(bundle_root.name) + r"/(?=\s|$)", label)]
        if len(entries) != 1:
            errors.append(f"archive index requires one exact ## {bundle_root.name}/ entry (found {len(entries)}): {index}")
        else:
            start, _ = entries[0]
            end = next((at for at, _, level, _ in headings if at > start and level <= 2), len(visible))
            errors.extend(checked_links(index, visible[start:end]))
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
