"""Offline tests for Slice 3's citation-ready brain-query helper."""
import os
from importlib.machinery import SourceFileLoader
from types import SimpleNamespace

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HELPER = os.path.join(REPO, "scripts", "runtime", "brain_query.py")
bq = SourceFileLoader("brain_query", HELPER).load_module()


def test_query_constructs_search_then_get_and_formats_citation(monkeypatch):
    calls = []
    responses = iter([
        "[0.9123] people/amir-alavi -- # Amir Alavi\n\nSenior Technical Lead\n",
        "---\ntype: person\ntitle: Amir Alavi\n---\n\n# Amir Alavi\n\nSenior Technical Lead on the Compute team.\n",
    ])

    def fake_run(cmd, **kwargs):
        calls.append((cmd, kwargs))
        return SimpleNamespace(returncode=0, stdout=next(responses), stderr="")

    monkeypatch.setattr(bq.subprocess, "run", fake_run)
    result = bq.query_brain("what do we know about Amir Alavi?")

    assert calls[0][0] == [
        "gbrain", "search", "what do we know about Amir Alavi?",
        "--source-id", "brain", "--limit", "1", "--snippet-chars", "320",
    ]
    assert calls[1][0] == ["gbrain", "get", "people/amir-alavi", "--source-id", "brain"]
    assert calls[0][1]["env"]["HOME"] == "/sandbox"
    assert "SOURCE_SLUG: people/amir-alavi" in result
    assert "SOURCE_TITLE: Amir Alavi" in result
    assert "Senior Technical Lead on the Compute team." in result
    assert "CITE_AS: [Brain: people/amir-alavi]" in result


def test_search_parser_ignores_gateway_warning_before_result():
    output = (
        "[gbrain] 1/1 query embeds failed (salvaging survivors): Forbidden\n"
        "[1.0000] projects/prime-claw -- # Prime Claw\n"
    )
    assert bq.extract_search_slug(output) == "projects/prime-claw"


def test_excerpt_is_bounded_and_marks_truncation():
    excerpt = bq.extract_excerpt("---\ntitle: X\n---\n\n# X\n\n" + ("fact " * 500), max_chars=80)
    assert len(excerpt) <= 95
    assert excerpt.endswith("… [truncated]")
