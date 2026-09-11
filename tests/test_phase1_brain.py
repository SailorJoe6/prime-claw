"""Tests for Slice 4 brain-stack artifacts (structure + safety invariants).

No live Postgres/docker/credentials touched: these assert the Dockerfile bakes
the stack in as root and returns to the sandbox user, that the apply script uses
the image-build flow (not a runtime install), and that the validator covers all
R-U2 requirements.
"""
import os, re, subprocess

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCKERFILE = os.path.join(REPO, "docker", "phase1-brain.Dockerfile")
APPLY = os.path.join(REPO, "scripts", "apply-phase1-brain.sh")
CHECK = os.path.join(REPO, "scripts", "check-phase1-brain.sh")
VALIDATE = os.path.join(REPO, "scripts", "validate-phase1-brain.py")


def read(p):
    return open(p).read()


def test_dockerfile_exists():
    assert os.path.isfile(DOCKERFILE)


def test_dockerfile_derives_from_proven_base():
    s = read(DOCKERFILE)
    assert "FROM ghcr.io/nvidia/openshell-community/sandboxes/base:latest" in s


def test_dockerfile_bakes_postgres_and_pgvector():
    """R-U2-3: Postgres 16 + pgvector installed at build time (as root)."""
    s = read(DOCKERFILE)
    assert "postgresql-16" in s and "postgresql-16-pgvector" in s
    assert "USER root" in s


def test_dockerfile_builds_gbrain_and_returns_to_sandbox_user():
    """R-U2-1 + agent ownership: gbrain compiled; final USER is sandbox."""
    s = read(DOCKERFILE)
    assert "bun build --compile" in s and "gbrain" in s
    assert s.rstrip().rfind("USER sandbox") > s.rfind("USER root")


def test_dockerfile_pgdata_owned_by_sandbox():
    """Agent owns its Postgres: PGDATA under /sandbox, chowned to sandbox."""
    s = read(DOCKERFILE)
    assert "PGDATA=/sandbox/pgdata" in s
    assert "chown" in s and "sandbox" in s


def test_apply_script_uses_image_build_not_runtime_install():
    """D15: the stack is built into the image; the sandbox is created --from it."""
    s = read(APPLY)
    assert "docker build" in s and "--from" in s
    # no rootless package install into the running sandbox
    assert "micromamba" not in s and "conda" not in s


def test_apply_script_bash_syntax():
    r = subprocess.run(["bash", "-n", APPLY], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    r = subprocess.run(["bash", "-n", CHECK], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr


def test_apply_script_restores_templates_from_git_history():
    """gbrain src imports templates/bootstrap/* but upstream deleted templates/;
    the build must restore them (recorded as an upstream break)."""
    s = read(APPLY)
    assert "templates" in s and "git" in s and "archive" in s


def test_validator_covers_all_ru2():
    s = read(VALIDATE)
    for req in ["R-U2-1", "R-U2-2", "R-U2-3", "R-U2-4", "R-U2-5"]:
        assert req in s, "missing %s" % req
    assert "pgvector" in s and "postgres" in s.lower()


def test_policy_binds_bun_and_gbrain_to_gateway():
    """R-U2-6: gbrain runs as a Bun binary; the L7 policy keys the credentialed
    gateway endpoint per calling binary, so bun + gbrain must be bound."""
    s = read(os.path.join(REPO, "policies", "phase1-sandbox.yaml"))
    i = s.find("model_ai_gateway")
    block = s[i:i+700]
    assert "/usr/local/bin/bun" in block, "bun binary not bound to gateway endpoint"
    assert "/usr/local/bin/gbrain" in block, "gbrain binary not bound to gateway endpoint"


def test_validator_has_embedding_gate():
    """R-U2-6 embedding gate is part of the validator."""
    s = read(VALIDATE)
    assert "R-U2-6" in s and "OPENAI_BASE_URL" in s and "vector_dims" in s
