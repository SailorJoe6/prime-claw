"""Tests for bin/prime-claw Slice 2: image stage (build).

Offline: no docker daemon, no zbrain compile. Staging tested against a fake
zbrain checkout in tmp_path; docker build + image-exists are monkeypatched.
"""
import json, os, subprocess, sys
from importlib.machinery import SourceFileLoader
import pytest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN = os.path.join(REPO, "bin", "prime-claw")
pc = SourceFileLoader("primeclaw", BIN).load_module()


def cfg(tmp_path, **over):
    c = {"sandbox_name": "prime-claw", "image": "prime-claw-brain:0.1.0"}
    c.update(over)
    return c


class Args:
    def __init__(self, **kw):
        self.dry_run = kw.get("dry_run", False)
        self.force = kw.get("force", False)


def make_zbrain(tmp_path, templates=True):
    """Create a fake zbrain checkout."""
    z = tmp_path / "zbrain"
    (z / "src").mkdir(parents=True)
    for f in ("package.json", "bun.lock", "tsconfig.json"):
        (z / f).write_text(f"// {f}\n")
    (z / "src" / "cli.ts").write_text("// cli\n")
    if templates:
        (z / "templates" / "bootstrap").mkdir(parents=True)
        (z / "templates" / "bootstrap" / "x.md").write_text("tpl\n")
    return z


# --- Dockerfile shape --------------------------------------------------------

def test_runtime_dockerfile_exists_and_is_runtime():
    df = os.path.join(REPO, "docker", "runtime.Dockerfile")
    assert os.path.exists(df)
    body = open(df).read()
    assert "runtime.Dockerfile" in body
    assert "COPY runtime/gbrain /opt/gbrain" in body
    assert "postgresql-16-pgvector" in body
    assert "bun build --compile" in body
    assert "USER sandbox" in body
    assert "PGDATA=/sandbox/pgdata" in body


# --- staging -----------------------------------------------------------------

def test_stage_requires_zbrain_checkout(tmp_path):
    with pytest.raises(FileNotFoundError):
        pc.stage_gbrain_context(str(tmp_path / "nope"), str(tmp_path / "ctx"))


def test_stage_prefers_real_templates(tmp_path):
    z = make_zbrain(tmp_path, templates=True)
    ctx = str(tmp_path / "ctx")
    man = pc.stage_gbrain_context(str(z), ctx)
    assert man["templates"] == "real"
    for f in ("package.json", "bun.lock", "tsconfig.json"):
        assert os.path.exists(os.path.join(ctx, f))
    assert os.path.isdir(os.path.join(ctx, "src"))
    assert os.path.isdir(os.path.join(ctx, "templates"))
    # optional dirs staged (empty) even when absent in source
    assert os.path.isdir(os.path.join(ctx, "admin"))
    assert os.path.isdir(os.path.join(ctx, "skills"))


def test_stage_fallback_restores_templates_from_git(tmp_path, monkeypatch):
    z = make_zbrain(tmp_path, templates=False)  # no templates dir
    # Fake `git archive <commit> templates` returning a tar with templates/.
    import tarfile, io
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w") as tf:
        data = b"restored\n"
        info = tarfile.TarInfo("templates/bootstrap/y.md")
        info.size = len(data)
        tf.addfile(info, io.BytesIO(data))
    monkeypatch.setattr(pc, "run", lambda cmd, timeout=30: (0, buf.getvalue().decode("latin1") if False else buf.getvalue()))
    ctx = str(tmp_path / "ctx")
    man = pc.stage_gbrain_context(str(z), ctx)
    assert man["templates"].startswith("fallback:")
    assert os.path.exists(os.path.join(ctx, "templates", "bootstrap", "y.md"))


def test_stage_dry_run_stages_nothing(tmp_path):
    z = make_zbrain(tmp_path, templates=True)
    ctx = str(tmp_path / "ctx")
    man = pc.stage_gbrain_context(str(z), ctx, dry_run=True)
    assert man["templates"] == "real"
    assert not os.path.exists(ctx)


# --- fingerprint / idempotency -------------------------------------------------

def test_fingerprint_changes_with_dockerfile(tmp_path, monkeypatch):
    monkeypatch.setenv("PRIME_CLAW_ZBRAIN_SRC", str(make_zbrain(tmp_path)))
    monkeypatch.setattr(pc, "REPO_ROOT", str(tmp_path))
    os.makedirs(os.path.join(tmp_path, "docker"), exist_ok=True)
    df = os.path.join(tmp_path, "docker", "runtime.Dockerfile")
    open(df, "w").write("FROM a\n")
    f1 = pc._build_inputs_fingerprint(cfg(tmp_path))
    open(df, "w").write("FROM b\n")
    f2 = pc._build_inputs_fingerprint(cfg(tmp_path))
    assert f1 != f2


def test_build_skips_when_up_to_date(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("PRIME_CLAW_ZBRAIN_SRC", str(make_zbrain(tmp_path)))
    monkeypatch.setattr(pc, "REPO_ROOT", str(tmp_path))
    os.makedirs(os.path.join(tmp_path, "docker"), exist_ok=True)
    open(os.path.join(tmp_path, "docker", "runtime.Dockerfile"), "w").write("FROM a\n")
    fp = pc._build_inputs_fingerprint(cfg(tmp_path))
    os.makedirs(os.path.join(tmp_path, "docker", "runtime"), exist_ok=True)
    json.dump({"image": "prime-claw-brain:0.1.0", "inputs_sha256": fp},
              open(os.path.join(tmp_path, "docker", "runtime", ".build-stamp.json"), "w"))
    monkeypatch.setattr(pc, "_docker_image_exists", lambda tag: True)
    rc = pc.cmd_build(cfg(tmp_path), Args())
    assert rc == 0
    assert "up to date" in capsys.readouterr().out


def test_build_runs_when_stale_or_forced(tmp_path, monkeypatch):
    monkeypatch.setenv("PRIME_CLAW_ZBRAIN_SRC", str(make_zbrain(tmp_path)))
    monkeypatch.setattr(pc, "REPO_ROOT", str(tmp_path))
    os.makedirs(os.path.join(tmp_path, "docker"), exist_ok=True)
    open(os.path.join(tmp_path, "docker", "runtime.Dockerfile"), "w").write("FROM a\n")
    monkeypatch.setattr(pc, "_docker_image_exists", lambda tag: True)  # image exists but no stamp -> stale
    calls = {}
    def fake_call(cmd):
        calls["cmd"] = cmd
        return 0
    monkeypatch.setattr(pc.subprocess, "call", fake_call)
    rc = pc.cmd_build(cfg(tmp_path), Args(force=True))
    assert rc == 0
    cmd = calls["cmd"]
    assert cmd[0:2] == [pc.DOCKER, "build"]
    assert "-t" in cmd and "prime-claw-brain:0.1.0" in cmd
    # stamp recorded
    stamp = json.load(open(os.path.join(tmp_path, "docker", "runtime", ".build-stamp.json")))
    assert stamp["image"] == "prime-claw-brain:0.1.0" and "inputs_sha256" in stamp


def test_build_dry_run_no_side_effects(tmp_path, monkeypatch, capsys):
    z = make_zbrain(tmp_path)
    monkeypatch.setenv("PRIME_CLAW_ZBRAIN_SRC", str(z))
    monkeypatch.setattr(pc, "REPO_ROOT", str(tmp_path))
    os.makedirs(os.path.join(tmp_path, "docker"), exist_ok=True)
    open(os.path.join(tmp_path, "docker", "runtime.Dockerfile"), "w").write("FROM a\n")
    rc = pc.cmd_build(cfg(tmp_path), Args(dry_run=True))
    out = capsys.readouterr().out
    assert rc == 0 and "dry_run" in out and "host_credential_access: prohibited" in out
    assert not os.path.exists(os.path.join(tmp_path, "docker", "runtime", "gbrain"))


# --- verb wiring ---------------------------------------------------------------

def test_build_verb_is_implemented():
    assert pc.VERBS["build"] is pc.cmd_build


# --- Slice 0 (R3a-0): gbrain source selection (upstream default, zbrain fallback) ---

def test_gbrain_source_defaults_to_upstream(monkeypatch):
    monkeypatch.delenv("PRIME_CLAW_GBRAIN_SOURCE", raising=False)
    assert pc._gbrain_source() == "upstream"
    assert pc._gbrain_source({}) == "upstream"


def test_gbrain_src_upstream_default_path(monkeypatch):
    monkeypatch.delenv("PRIME_CLAW_GBRAIN_SOURCE", raising=False)
    monkeypatch.delenv("PRIME_CLAW_GBRAIN_UPSTREAM_SRC", raising=False)
    assert pc._gbrain_src() == os.path.expanduser("~/gbrain")


def test_gbrain_source_env_overrides_to_zbrain(monkeypatch):
    monkeypatch.setenv("PRIME_CLAW_GBRAIN_SOURCE", "zbrain")
    monkeypatch.setenv("PRIME_CLAW_ZBRAIN_SRC", "/tmp/zb")
    assert pc._gbrain_source() == "zbrain"
    assert pc._gbrain_src() == "/tmp/zb"


def test_gbrain_source_config_selects_zbrain_fallback(monkeypatch):
    monkeypatch.delenv("PRIME_CLAW_GBRAIN_SOURCE", raising=False)
    monkeypatch.setenv("PRIME_CLAW_ZBRAIN_SRC", "/tmp/zbcfg")
    c = cfg(tmp_path=None if False else __import__("pathlib").Path("/tmp"), gbrain_source="zbrain")
    assert pc._gbrain_source(c) == "zbrain"
    assert pc._gbrain_src(c) == "/tmp/zbcfg"


def test_gbrain_upstream_src_config_override(monkeypatch):
    monkeypatch.delenv("PRIME_CLAW_GBRAIN_SOURCE", raising=False)
    monkeypatch.delenv("PRIME_CLAW_GBRAIN_UPSTREAM_SRC", raising=False)
    c = {"gbrain_upstream_src": "/opt/gb"}
    assert pc._gbrain_src(c) == "/opt/gb"


def test_fingerprint_differs_between_sources(tmp_path, monkeypatch):
    """Switching upstream<->zbrain must invalidate the build-idempotency skip."""
    monkeypatch.setattr(pc, "REPO_ROOT", str(tmp_path))
    os.makedirs(os.path.join(tmp_path, "docker"), exist_ok=True)
    open(os.path.join(tmp_path, "docker", "runtime.Dockerfile"), "w").write("FROM a\n")
    z = make_zbrain(tmp_path)
    monkeypatch.setenv("PRIME_CLAW_ZBRAIN_SRC", str(z))
    monkeypatch.setenv("PRIME_CLAW_GBRAIN_UPSTREAM_SRC", str(z))  # same dir, different source key
    c = cfg(tmp_path)
    monkeypatch.delenv("PRIME_CLAW_GBRAIN_SOURCE", raising=False)
    f_up = pc._build_inputs_fingerprint({**c, "gbrain_source": "upstream"})
    f_zb = pc._build_inputs_fingerprint({**c, "gbrain_source": "zbrain"})
    assert f_up != f_zb


def test_build_dry_run_reports_upstream_source(tmp_path, monkeypatch, capsys):
    monkeypatch.delenv("PRIME_CLAW_GBRAIN_SOURCE", raising=False)
    monkeypatch.setenv("PRIME_CLAW_GBRAIN_UPSTREAM_SRC", str(make_zbrain(tmp_path)))
    monkeypatch.setattr(pc, "REPO_ROOT", str(tmp_path))
    os.makedirs(os.path.join(tmp_path, "docker"), exist_ok=True)
    open(os.path.join(tmp_path, "docker", "runtime.Dockerfile"), "w").write("FROM a\n")
    rc = pc.cmd_build(cfg(tmp_path), Args(dry_run=True))
    out = capsys.readouterr().out
    assert rc == 0 and "source=upstream" in out


def test_stage_stages_postinstall_script_when_present(tmp_path):
    """Upstream gbrain runs `bun run scripts/postinstall.ts` on bun install; the
    build must stage that script or the frozen-lockfile install fails (R3a-0)."""
    z = make_zbrain(tmp_path, templates=True)
    (z / "scripts").mkdir(exist_ok=True)
    (z / "scripts" / "postinstall.ts").write_text("// postinstall\n")
    ctx = str(tmp_path / "ctx")
    pc.stage_gbrain_context(str(z), ctx)
    assert os.path.exists(os.path.join(ctx, "scripts", "postinstall.ts"))


def test_stage_ok_without_postinstall_script(tmp_path):
    """A source without scripts/postinstall.ts (e.g. the zbrain fallback) still stages."""
    z = make_zbrain(tmp_path, templates=True)  # no scripts/ dir
    ctx = str(tmp_path / "ctx")
    pc.stage_gbrain_context(str(z), ctx)
    assert os.path.isdir(os.path.join(ctx, "src"))


def test_prime_agent_stage_writes_models_json(tmp_path, monkeypatch):
    """stage_prime_agent must register the gateway model + base URL (anthropic.kimi-k3
    -> ai-gateway) so the sandboxed agent resolves the model instead of falling back to
    api.anthropic.com / an unauthorized catalog default (R3a-0 controller leg)."""
    import base64 as _b, json as _j
    written = {}
    def fake_exec(cfg, script, timeout=30):
        if "models.json" in script and "base64 -d" in script:
            payload = script.split("echo ",1)[1].split(" | base64",1)[0].strip()
            written["models"] = _j.loads(_b.b64decode(payload).decode())
        return 0, "ok"
    monkeypatch.setattr(pc, "sandbox_exec", fake_exec)
    monkeypatch.setattr(pc, "REPO_ROOT", os.path.join(REPO))
    class A: dry_run=False; force=False
    c = {"sandbox_name":"prime-claw","ai_gateway_host":"ai-gateway.zende.sk","model":"anthropic.kimi-k3"}
    pc.stage_prime_agent(c, A())  # later stages fail under the stub; we only assert the models.json write
    m = written["models"]
    assert m["providers"]["anthropic"]["baseUrl"] == "https://ai-gateway.zende.sk/anthropic"
    assert m["providers"]["openai"]["baseUrl"] == "https://ai-gateway.zende.sk/v1"
    assert any(mod["id"]=="anthropic.kimi-k3" for mod in m["providers"]["anthropic"]["models"])
