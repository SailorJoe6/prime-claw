#!/usr/bin/env python3
"""Thin, read-only gbrain helper for the sandboxed prime-agent.

Searches the in-sandbox `brain` source, resolves the best result with `gbrain get`,
and emits a bounded excerpt plus an exact citation token. No host files or credentials.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from typing import Sequence


SEARCH_RESULT_RE = re.compile(r"^\[[0-9.]+\]\s+(\S+)\s+--", re.MULTILINE)


def run_gbrain(args: Sequence[str]) -> str:
    env = os.environ.copy()
    env["HOME"] = env.get("PRIME_CLAW_SB_HOME", "/sandbox")
    proc = subprocess.run(
        ["gbrain", *args],
        capture_output=True,
        text=True,
        env=env,
        timeout=90,
    )
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout).strip()[-500:]
        raise RuntimeError(f"gbrain {' '.join(args[:1])} failed: {detail}")
    return proc.stdout


def extract_search_slug(output: str) -> str:
    match = SEARCH_RESULT_RE.search(output)
    if not match:
        raise ValueError("no brain page matched the query")
    return match.group(1)


def extract_title(page: str, slug: str) -> str:
    frontmatter = re.search(r"\A---\s*\n(.*?)\n---\s*(?:\n|\Z)", page, re.DOTALL)
    if frontmatter:
        title = re.search(r"^title:\s*[\"']?(.*?)[\"']?\s*$", frontmatter.group(1), re.MULTILINE)
        if title and title.group(1).strip():
            return title.group(1).strip()
    heading = re.search(r"^#\s+(.+?)\s*$", page, re.MULTILINE)
    return heading.group(1).strip() if heading else slug.rsplit("/", 1)[-1]


def extract_excerpt(page: str, max_chars: int = 1600) -> str:
    body = re.sub(r"\A---\s*\n.*?\n---\s*(?:\n|\Z)", "", page, count=1, flags=re.DOTALL).strip()
    if len(body) <= max_chars:
        return body
    cut = body[:max_chars].rsplit(" ", 1)[0].rstrip()
    return cut + " … [truncated]"


def format_citation(slug: str, title: str, excerpt: str) -> str:
    return (
        "BRAIN_RESULT\n"
        f"SOURCE_SLUG: {slug}\n"
        f"SOURCE_TITLE: {title}\n"
        "SOURCE_EXCERPT:\n"
        f"{excerpt}\n"
        f"CITE_AS: [Brain: {slug}]\n"
        "END_BRAIN_RESULT"
    )


def query_brain(query: str) -> str:
    search = run_gbrain([
        "search", query, "--source-id", "brain", "--limit", "1", "--snippet-chars", "320"
    ])
    slug = extract_search_slug(search)
    page = run_gbrain(["get", slug, "--source-id", "brain"])
    return format_citation(slug, extract_title(page, slug), extract_excerpt(page))


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="brain-query",
        description="Search the in-sandbox brain and return one citation-ready result.",
    )
    parser.add_argument("query", nargs="+", help="question or search terms")
    args = parser.parse_args(argv)
    try:
        print(query_brain(" ".join(args.query)))
        return 0
    except (RuntimeError, ValueError, subprocess.TimeoutExpired) as exc:
        print(f"brain-query: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
