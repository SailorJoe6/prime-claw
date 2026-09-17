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
    c = {"sandbox_name": "prime-claw", "image": "prime-claw-brain:0.1.0",
         "brain_repo": "operator/brain", "_local_override_keys": ["brain_repo"],
         "_local_config_path": os.path.realpath(os.path.join(
             REPO, ".prime-claw", "runtime.local.json"))}
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


def _capture_models_json(monkeypatch):
    import base64 as _b, json as _j
    written = {}
    def fake_exec(cfg, script, timeout=30):
        if "models.json" in script and "base64 -d" in script:
            payload = script.split("echo ",1)[1].split(" | base64",1)[0].strip()
            written["models"] = _b.b64decode(payload.encode()).decode()
        return 0, "ok"
    monkeypatch.setattr(pc, "sandbox_exec", fake_exec)
    monkeypatch.setattr(pc, "REPO_ROOT", os.path.join(REPO))
    return written


def test_models_json_copies_host_verbatim(tmp_path, monkeypatch):
    """R3a-13: when the operator's host prime-agent models.json exists, it is copied
    VERBATIM into the sandbox (container mirrors the user's local config)."""
    host_cfg = tmp_path / "models.json"
    sentinel = {"providers": {"anthropic": {"baseUrl": "https://ai-gateway.zende.sk/anthropic",
                "models": [{"id": "anthropic.custom-9", "name": "Custom", "reasoning": True,
                            "input": ["text"], "contextWindow": 1, "cost": {"input":0,"output":0,"cacheRead":0,"cacheWrite":0}}]}}}
    host_cfg.write_text(__import__("json").dumps(sentinel))
    host_settings = tmp_path / "settings.json"
    host_settings.write_text(__import__("json").dumps({
        "defaultProvider": "anthropic", "defaultModel": "anthropic.custom-9"}))
    monkeypatch.setenv("PRIME_CLAW_HOST_MODELS_JSON", str(host_cfg))
    monkeypatch.setenv("PRIME_CLAW_HOST_SETTINGS_JSON", str(host_settings))
    written = _capture_models_json(monkeypatch)
    class A: dry_run=False; force=False
    pc.stage_prime_agent({"sandbox_name":"prime-claw"}, A())
    import json as _j
    assert _j.loads(written["models"]) == sentinel  # verbatim, including the custom model


def test_models_json_fallback_when_no_host_config(tmp_path, monkeypatch):
    """R3a-13 fallback: no host config -> built-in default with exactly Kimi-K3 + GLM,
    base URLs from the configured gateway host. No secrets."""
    monkeypatch.setenv("PRIME_CLAW_HOST_MODELS_JSON", str(tmp_path / "absent-models.json"))
    monkeypatch.setenv("PRIME_CLAW_HOST_SETTINGS_JSON", str(tmp_path / "absent-settings.json"))
    written = _capture_models_json(monkeypatch)
    class A: dry_run=False; force=False
    pc.stage_prime_agent({"sandbox_name":"prime-claw","ai_gateway_host":"ai-gateway.zende.sk","model":"anthropic/anthropic.kimi-k3"}, A())
    import json as _j
    m = _j.loads(written["models"])
    ids = {mod["id"] for mod in m["providers"]["anthropic"]["models"]}
    assert ids == {"anthropic.kimi-k3", "anthropic.glm-5.2"}
    assert m["providers"]["anthropic"]["baseUrl"] == "https://ai-gateway.zende.sk/anthropic"
    assert m["providers"]["openai"]["baseUrl"] == "https://ai-gateway.zende.sk/v1"
    # no secret-shaped fields
    assert "key" not in written["models"].lower() and "token" not in written["models"].lower()


# ---- Slice 1: github push provider + brain clone (R3a-1/5/7) ----

def test_github_provider_dry_run(tmp_path, capsys):
    class A: dry_run=True
    rc = pc.stage_github_provider(cfg(tmp_path), A())
    out = capsys.readouterr().out
    assert rc == 0 and "github provider" in out and "gh auth token" in out


def test_github_provider_creates_with_gh_token(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(pc, "run", lambda cmd, timeout=30: (calls.append(cmd) or (1, "")) if cmd[1:3]==["provider","get"] else (calls.append(cmd) or (0, "ok")))
    monkeypatch.setattr(pc, "_host_github_token", lambda c: "gho_testtoken")
    class A: dry_run=False
    rc = pc.stage_github_provider(cfg(tmp_path), A())
    assert rc == 0
    joined = [" ".join(c) for c in calls]
    assert any("profile" in j and "import" in j for j in joined)
    assert any("create" in j and "prime-claw-github" in j and "github-push" in j for j in joined)
    # token handed to provider create, never persisted by us
    assert any("api_token=gho_testtoken" in j for j in joined)


def test_github_provider_refreshes_existing(tmp_path, monkeypatch):
    # Token CHANGED (no matching state hash) -> update fires.
    monkeypatch.setattr(pc, "REPO_ROOT", str(tmp_path))  # state file lives here; absent -> treat as changed
    calls = []
    def fake(cmd, timeout=30):
        calls.append(cmd)
        return (0, "ok")  # provider get succeeds -> update path
    monkeypatch.setattr(pc, "run", fake)
    monkeypatch.setattr(pc, "_host_github_token", lambda c: "gho_abc")
    class A: dry_run=False
    rc = pc.stage_github_provider(cfg(tmp_path), A())
    joined = [" ".join(c) for c in calls]
    assert rc == 0 and any("update" in j and "api_token=gho_abc" in j for j in joined)
    assert not any("create" in j for j in joined)


def test_github_provider_skips_update_when_token_unchanged(tmp_path, monkeypatch):
    """Resource-version bumps re-key the sandbox placeholder and break a running sandbox's
    git auth; the update must be skipped when the token hash matches the recorded state."""
    import hashlib as _hl, os as _os
    monkeypatch.setattr(pc, "REPO_ROOT", str(tmp_path))
    (_os.path.join(str(tmp_path), ".prime-claw-github-token.sha256"))
    with open(_os.path.join(str(tmp_path), ".prime-claw-github-token.sha256"), "w") as f:
        f.write(_hl.sha256(b"gho_same").hexdigest())
    calls = []
    monkeypatch.setattr(pc, "run", lambda cmd, timeout=30: (calls.append(cmd), (0, "ok"))[1])
    monkeypatch.setattr(pc, "_host_github_token", lambda c: "gho_same")
    class A: dry_run=False
    rc = pc.stage_github_provider(cfg(tmp_path), A())
    joined = [" ".join(c) for c in calls]
    assert rc == 0
    assert not any("update" in j for j in joined) and not any("create" in j for j in joined)


def test_brain_clone_dry_run(tmp_path, capsys):
    class A: dry_run=True
    rc = pc.stage_brain_clone(cfg(tmp_path), A())
    out = capsys.readouterr().out
    assert rc == 0 and "operator/brain" in out and "/sandbox/brain" in out and "placeholder" in out


def test_brain_clone_fresh_clone_branch(tmp_path, monkeypatch):
    seen = {}
    def fake_exec(cfg, script, timeout=30):
        seen["script"] = script
        # simulate .git absent -> clone path
        return 0, "brain: HEAD=abc123 remote-set"
    monkeypatch.setattr(pc, "sandbox_exec", fake_exec)
    class A: dry_run=False
    rc = pc.stage_brain_clone(cfg(tmp_path), A())
    assert rc == 0
    s = seen["script"]
    assert "git clone --branch main" in s and "https://x-access-token:${api_token}@github.com/operator/brain.git" in s
    assert "if [ -d /sandbox/brain/.git ]" in s  # idempotency guard present


def test_brain_clone_idempotent_fetch_branch(tmp_path, monkeypatch):
    seen = {}
    def fake_exec(cfg, script, timeout=30):
        seen["script"] = script
        return 0, "brain: already cloned; fetching"
    monkeypatch.setattr(pc, "sandbox_exec", fake_exec)
    class A: dry_run=False
    rc = pc.stage_brain_clone(cfg(tmp_path), A())
    s = seen["script"]
    # the script handles both branches; verify the fetch/ff path exists for the already-cloned case
    assert "git -C /sandbox/brain fetch origin main" in s
    assert "merge --ff-only origin/main" in s
    assert "remote set-url origin" in s


def test_brain_clone_config_override(tmp_path, monkeypatch):
    seen = {}
    monkeypatch.setattr(pc, "sandbox_exec", lambda c, s, timeout=30: (seen.setdefault("s", s), 0, "")[1:])
    class A: dry_run=False
    c = cfg(tmp_path, brain_repo="acme/knowledge", brain_branch="trunk", sb_brain_dir="/data/kb")
    rc = pc.stage_brain_clone(c, A())
    s = seen["s"]
    assert rc == 0 and "acme/knowledge" in s and "trunk" in s and "/data/kb" in s


def test_brain_clone_retries_transient_401(tmp_path, monkeypatch):
    """Slice 1 cold-start finding: fresh-sandbox clones can 401 for the first few minutes, then
    recover. The stage retries the clone itself on a bounded schedule (a failed attempt does NOT
    permanently poison the sandbox; ls-remote is not predictive). Fail twice, then succeed."""
    calls = []
    def fake_exec(c, s, timeout=30):
        calls.append(s)
        return (0, "") if len(calls) >= 3 else (128, "remote: Invalid username or token")
    monkeypatch.setattr(pc, "sandbox_exec", fake_exec)
    monkeypatch.setattr(pc, "_sleep", lambda s: None)
    class A: dry_run=False
    rc = pc.stage_brain_clone(cfg(tmp_path), A())
    assert rc == 0 and len(calls) == 3


def test_brain_clone_gives_up_after_bounded_attempts(tmp_path, monkeypatch):
    """If the credential path never comes live within the bounded retry budget, fail clearly."""
    calls = []
    def fake_exec(c, s, timeout=30):
        calls.append(s); return (128, "remote: Invalid username or token")
    monkeypatch.setattr(pc, "sandbox_exec", fake_exec)
    monkeypatch.setattr(pc, "_sleep", lambda s: None)
    class A: dry_run=False
    rc = pc.stage_brain_clone(cfg(tmp_path, brain_clone_attempts=3), A())
    assert rc == 128 and len(calls) == 3



def test_brain_clone_url_double_quoted_for_placeholder_expansion(tmp_path, monkeypatch):
    """Regression (Slice 1 root cause): the clone/remote URL embeds ${api_token}, which must be
    expanded by the in-sandbox bash. If the script single-quotes the URL, bash passes the literal
    string '${api_token}' to git and every attempt 401s. Assert the generated script wraps the
    URL in double quotes."""
    seen = {}
    monkeypatch.setattr(pc, "sandbox_exec", lambda c, s, timeout=30: (seen.setdefault("s", s), 0, "")[1:])
    class A: dry_run=False
    rc = pc.stage_brain_clone(cfg(tmp_path), A())
    s = seen["s"]
    assert rc == 0
    assert "git clone --branch main \"https://x-access-token:${api_token}@" in s
    assert "remote set-url origin \"https://x-access-token:${api_token}@" in s
    assert "'https://x-access-token:${api_token}" not in s  # single-quoted form = the bug
