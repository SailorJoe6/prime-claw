"""prime-claw test-tier fixtures (slice 3, prime-claw-blw.3).

Tier policy (see DEVELOPERS.md "Testing" and pytest.ini):

- unmarked tests are tier 0 (host, no environment) and always run;
- `container` tests (tier 1) run inside ONE long-lived tier-1 container per
  pytest session via the `tier1_container` fixture below;
- `sandbox` tests (tier 2, tests/test_runtime_*.py) stay host-orchestrated.

Any test that requests the `tier1_container` or `ctmp` fixture is
auto-marked `container`. Unless pytest is invoked with an explicit -m mark
expression, container/sandbox tests are SKIPPED — so plain `pytest tests/ -q`
is always the tier-0 default with no Docker dependency, and
`pytest -m container` selects exactly the migrated plugin suite.

The session fixture mirrors scripts/test-tier1.sh (the driver is the
contract): exact selector semantics, immediate source-mode fail-close, a
run-owned evidence tree, iidfile image capture, cidfile container capture,
online pinned installation, verified network removal, and only then offline
package identity plus apply/check/tests against the explicit container-local
/root/.prime/agent. TIER1_ENV_FILE selects the env file for tests.

Container/ host file exchange uses a session share directory bind-mounted
at the SAME absolute path on both sides, so paths embedded in probe sources
and daemon protocol payloads resolve identically in either process.
(Connecting to a host-bound Unix socket through the macOS virtiofs mount
does NOT work — connect(2) fails with EOPNOTSUPP — so daemon fakes run
in-container via tests/container/fake_daemon.py; see that file.)
"""

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time

import pytest

from scripts.testing import provenance


REPO = Path(__file__).resolve().parents[1]
WORKSPACE = "/workspace"
CONTAINER_PLUGIN_ROOT = "/root/.prime/agent"
IMAGE_REPO = "prime-claw-test-tier1"
DOCKERFILE = "docker/test.Dockerfile"
RESULTS = REPO / ".test-results"
ENV_FILE = REPO / ".env"
FORK_STAGE_SUBDIR = "packages/coding-agent/release/tier1"
DIST_DIRS = ("packages/coding-agent", "packages/agent", "packages/ai", "packages/tui")

_SKIP_CONTAINER = (
    "tier 1 (container): requires Docker; run `pytest -m container` "
    "or scripts/test-all.sh"
)
_SKIP_SANDBOX = (
    "tier 2 (sandbox): host-orchestrated OpenShell tests; run "
    "`pytest -m sandbox` or scripts/test-all.sh --with-sandbox"
)


def pytest_collection_modifyitems(config, items):
    """Auto-mark tier-1 fixture users; skip tier 1/2 unless -m selects them."""
    for item in items:
        if any(name in item.fixturenames for name in ("tier1_container", "ctmp", "croot")):
            item.add_marker(pytest.mark.container)
    markexpr = (getattr(config.option, "markexpr", "") or "").strip()
    if markexpr:
        return
    for item in items:
        if item.get_closest_marker("container") is not None:
            item.add_marker(pytest.mark.skip(reason=_SKIP_CONTAINER))
        if item.get_closest_marker("sandbox") is not None:
            item.add_marker(pytest.mark.skip(reason=_SKIP_SANDBOX))


def _read_selector(env_file: Path, key: str) -> str:
    """Mirror the driver's read_selector: last KEY=value line wins; one
    surrounding quote pair is stripped; an empty value counts as unset."""
    if not env_file.exists():
        return ""
    value = ""
    for line in env_file.read_text().splitlines():
        if line.startswith(key + "="):
            value = line[len(key) + 1:]
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    return value


def _load_install_selection() -> tuple[str, str]:
    """Return (mode, value) with the driver's fail-fast selection contract."""
    env_file = Path(os.environ.get("TIER1_ENV_FILE") or ENV_FILE)
    if not env_file.exists():
        raise RuntimeError(
            f"tier-1 fixture: missing env file {env_file} "
            "(cp .env.example .env and set exactly one selector)"
        )
    lines = env_file.read_text().splitlines()
    allowed = ("PRIME_AGENT_PINNED=", "PRIME_AGENT_SOURCE=")
    if any(line and not line.startswith("#")
           and not line.startswith(allowed) for line in lines):
        raise RuntimeError(
            "tier-1 fixture: env file contains unsupported keys or malformed lines")
    for key in ("PRIME_AGENT_PINNED=", "PRIME_AGENT_SOURCE="):
        if sum(line.startswith(key) for line in lines) > 1:
            raise RuntimeError(f"tier-1 fixture: env file repeats {key[:-1]}")
    pinned = _read_selector(env_file, "PRIME_AGENT_PINNED")
    source = _read_selector(env_file, "PRIME_AGENT_SOURCE")
    if pinned and source:
        raise RuntimeError(
            f"tier-1 fixture: both PRIME_AGENT_PINNED and PRIME_AGENT_SOURCE "
            f"are set in {env_file} — set exactly one"
        )
    if not pinned and not source:
        raise RuntimeError(
            f"tier-1 fixture: neither PRIME_AGENT_PINNED nor PRIME_AGENT_SOURCE "
            f"is set in {env_file} — set exactly one (see .env.example)"
        )
    if source:
        # Slice 1 fail-close boundary. Parsing the selector is allowed; no
        # stat/read/build/cleanup/pack operation may touch the checkout until
        # the isolated source builder lands in prime-claw-5v7.1.
        raise RuntimeError(
            "tier-1 fixture: PRIME_AGENT_SOURCE is disabled until isolated "
            "source builder Slice 2 (prime-claw-5v7.1) lands; use "
            "PRIME_AGENT_PINNED"
        )
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", pinned):
        raise RuntimeError(
            "tier-1 fixture: PRIME_AGENT_PINNED must be an exact semantic version")
    return "pinned", pinned


def _build_tier1_image(tier_dir: Path) -> dict:
    """Build from a run-owned empty context and return exact image identity."""
    build_context = tier_dir / "build-context"
    build_context.mkdir()
    shutil.copy2(REPO / DOCKERFILE, build_context / "Dockerfile")
    input_hash = provenance.hash_declared_inputs(REPO, [DOCKERFILE])
    dockerfile_hash = provenance.sha256_file(REPO / DOCKERFILE)
    tag = f"{IMAGE_REPO}:{input_hash[:12]}"
    iidfile = tier_dir / "image.iid"
    started_at = provenance.utc_now()
    subprocess.run(
        ["docker", "build", "-q", "--iidfile", str(iidfile),
         "-f", str(build_context / "Dockerfile"), "-t", tag,
         str(build_context)],
        check=True, capture_output=True, text=True, timeout=1200,
    )
    finished_at = provenance.utc_now()
    try:
        image_id = iidfile.read_text().strip()
    except OSError as exc:
        raise RuntimeError("tier-1 fixture: image iidfile was not published") from exc
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", image_id):
        raise RuntimeError(f"tier-1 fixture: invalid image ID in iidfile: {image_id!r}")
    inspected = subprocess.run(
        ["docker", "image", "inspect", image_id], check=True,
        capture_output=True, text=True, timeout=30,
    )
    try:
        rows = json.loads(inspected.stdout)
        row = rows[0]
    except (json.JSONDecodeError, IndexError, TypeError) as exc:
        raise RuntimeError("tier-1 fixture: invalid docker image inspect output") from exc
    if row.get("Id") != image_id:
        raise RuntimeError("tier-1 fixture: image inspect identity mismatched iidfile")
    if not row.get("Os") or not row.get("Architecture"):
        raise RuntimeError("tier-1 fixture: image inspect omitted platform identity")
    safe = {
        "id": image_id,
        "repo_digests": row.get("RepoDigests") or [],
        "dockerfile": DOCKERFILE,
        "dockerfile_sha256": dockerfile_hash,
        "declared_input_sha256": input_hash,
        "informational_tag": tag,
        "os": row["Os"],
        "architecture": row["Architecture"],
        "build_started_at": started_at,
        "build_finished_at": finished_at,
    }
    (tier_dir / "image.json").write_text(
        json.dumps(safe, sort_keys=True, separators=(",", ":")) + "\n")
    return safe


def _container_networks(container_id: str) -> list[str]:
    """Return captured network names; any inspect ambiguity fails closed."""
    try:
        out = subprocess.run(
            ["docker", "inspect", "--format",
             "{{json .NetworkSettings.Networks}}", container_id],
            capture_output=True, text=True, timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError(
            "tier-1 fixture: container network inspection is unknown") from exc
    if out.returncode != 0:
        raise RuntimeError(
            "tier-1 fixture: container network inspection is unknown: "
            + out.stderr.strip())
    try:
        networks = json.loads(out.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "tier-1 fixture: container network inspection returned invalid JSON") from exc
    if not isinstance(networks, dict):
        raise RuntimeError("tier-1 fixture: container network set is not an object")
    return sorted(networks)


def _disconnect_container_networks(container_id: str) -> str:
    """Disconnect the exact container and prove its network set is empty."""
    for network in _container_networks(container_id):
        out = subprocess.run(
            ["docker", "network", "disconnect", network, container_id],
            capture_output=True, text=True, timeout=30,
        )
        if out.returncode != 0:
            raise RuntimeError(
                "tier-1 fixture: network disconnect failed for captured "
                f"container {container_id}: {out.stderr.strip()}")
    remaining = _container_networks(container_id)
    if remaining:
        raise RuntimeError(
            "tier-1 fixture: container still has an attached network; "
            "refusing apply/check/tests")
    return provenance.utc_now()


def _installed_package_identity(container: "Tier1Container") -> dict:
    version_result = container.run("prime-agent", "--version", wrap=False,
                                   timeout=30, workdir=None)
    if version_result.returncode != 0:
        raise RuntimeError("tier-1 fixture: installed version query failed")
    match = re.search(r"[0-9]+(?:\.[0-9]+)+", version_result.stdout)
    if not match:
        raise RuntimeError("tier-1 fixture: installed version was unparseable")
    hash_result = container.run(
        "bash", "-lc", 'sha256sum "$(command -v prime-agent)"',
        wrap=False, timeout=30, workdir=None,
    )
    digest = hash_result.stdout.split()[0] if hash_result.returncode == 0 and hash_result.stdout.split() else ""
    if not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise RuntimeError("tier-1 fixture: installed executable hash is invalid")
    return {"kind": "vendor-binary", "version": match.group(0),
            "executable_sha256": digest}


class ContainerDaemon:
    """Handle for an in-container fake daemon (tests/container/fake_daemon.py).

    The daemon binds a container-local Unix socket and logs every envelope
    and response as JSONL under a same-path share directory, so the host
    test reconstructs the exact exchange by reading those files.
    """

    def __init__(self, container: "Tier1Container", socket_path: str,
                 route: str, log_dir: Path) -> None:
        self._container = container
        self.socket_path = socket_path
        self.route = route
        self.log_dir = Path(log_dir)
        self._pidfile = socket_path + ".pid"
        self._closed = False

    @property
    def envelopes(self) -> list:
        path = self.log_dir / "envelopes.jsonl"
        if not path.exists():
            return []
        return [json.loads(line) for line in
                path.read_text().splitlines() if line.strip()]

    @property
    def responses(self) -> dict:
        path = self.log_dir / "responses.jsonl"
        if not path.exists():
            return {}
        out = {}
        for line in path.read_text().splitlines():
            if line.strip():
                row = json.loads(line)
                out[row["id"]] = row["data"]
        return out

    @property
    def commands(self) -> list:
        return [envelope["command"] for envelope in self.envelopes]

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        self._container.run(
            "sh", "-c", f"kill $(cat {self._pidfile}) 2>/dev/null || true",
            wrap=False, timeout=15,
        )


class Tier1Container:
    """Exec helper for the one-session tier-1 container."""

    ws = WORKSPACE

    def __init__(self, container_id: str, share: Path, mode: str) -> None:
        self.id = container_id
        self.share = share
        self.mode = mode
        self._prime_agent = None

    @property
    def prime_agent(self) -> str:
        if self._prime_agent is None:
            found = self.run("bash", "-lc", "command -v prime-agent",
                             wrap=False, timeout=15)
            assert found.returncode == 0 and found.stdout.strip(), found.stderr
            self._prime_agent = found.stdout.strip()
        return self._prime_agent

    def run(self, *argv, timeout: int = 90, env: dict | None = None,
            input_text: str | None = None, workdir: str | None = WORKSPACE,
            wrap: bool = True) -> subprocess.CompletedProcess:
        """Run argv in the container and capture the result.

        wrap=True (default) puts the command under an in-container
        `timeout --kill-after=5 <timeout>` so a hung or TERM-ignoring
        process tree terminates within deadline + grace and the pipe
        closes (slice-1 / B3 lesson); the outer subprocess timeout adds
        margin for exec overhead. Only explicitly passed env vars are set —
        the host environment never leaks into the container.
        """
        cmd = ["docker", "exec"]
        if input_text is not None:
            cmd.append("-i")
        for key, value in (env or {}).items():
            cmd += ["-e", f"{key}={value}"]
        if workdir:
            cmd += ["-w", workdir]
        cmd.append(self.id)
        if wrap:
            cmd += ["timeout", "--kill-after=5", str(timeout)]
        cmd += [str(arg) for arg in argv]
        return subprocess.run(
            cmd, input=input_text, text=True, capture_output=True,
            timeout=timeout + 30,
        )

    def popen(self, *argv, timeout: int = 60, env: dict | None = None,
              workdir: str | None = WORKSPACE) -> subprocess.Popen:
        """Interactive in-container process (binary pipes) for RPC drivers.

        The command runs under the same in-container hard timeout as run();
        killing the returned Popen only kills the docker exec client, so the
        in-container deadline (and session teardown) is the real backstop.
        """
        cmd = ["docker", "exec", "-i"]
        for key, value in (env or {}).items():
            cmd += ["-e", f"{key}={value}"]
        if workdir:
            cmd += ["-w", workdir]
        cmd += [self.id, "timeout", "--kill-after=5", str(timeout)]
        cmd += [str(arg) for arg in argv]
        return subprocess.Popen(
            cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, bufsize=0,
        )

    def start_daemon(self, socket_path: str, route: str,
                     log_dir: Path) -> ContainerDaemon:
        """Start tests/container/fake_daemon.py in-container (detached)."""
        log_dir = Path(log_dir)
        log_dir.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["docker", "exec", "-d", self.id,
             "python3", f"{WORKSPACE}/tests/container/fake_daemon.py",
             "--socket", socket_path, "--route", route,
             "--log-dir", str(log_dir), "--pidfile", socket_path + ".pid"],
            check=True, timeout=15,
        )
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            probe = self.run("sh", "-c", f"test -S {socket_path}",
                             wrap=False, timeout=10)
            if probe.returncode == 0:
                break
            time.sleep(0.1)
        else:
            raise RuntimeError(
                f"tier-1 fixture: fake daemon socket never appeared: {socket_path}"
            )
        return ContainerDaemon(self, socket_path, route, log_dir)

    def read_repo(self, relpath: str) -> str:
        """Read a repo file from the /workspace mount (never the host copy)."""
        result = self.run("cat", f"{WORKSPACE}/{relpath}", wrap=False, timeout=15)
        assert result.returncode == 0, result.stderr
        return result.stdout

    def read_text(self, path) -> str:
        """Read a file; share paths are read host-side (same file)."""
        path = Path(path)
        if _is_relative_to(path, self.share):
            return path.read_text()
        result = self.run("cat", str(path), wrap=False, timeout=15)
        assert result.returncode == 0, result.stderr
        return result.stdout

    def write_text(self, path, content: str) -> None:
        """Write a file; share paths are written host-side (same file)."""
        path = Path(path)
        if _is_relative_to(path, self.share):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
            return
        result = self.run(
            "sh", "-c", 'mkdir -p -- "$1" && exec tee "$2" >/dev/null',
            "sh", str(path.parent), str(path),
            input_text=content, wrap=False, timeout=15, workdir=None,
        )
        assert result.returncode == 0, result.stderr


    def exists(self, path) -> bool:
        """Whether a path exists in the container (share paths included)."""
        path = Path(path)
        if _is_relative_to(path, self.share):
            return path.exists()
        result = self.run("test", "-e", str(path), wrap=False, timeout=15,
                          workdir=None)
        return result.returncode == 0

    def mkdir_p(self, path) -> None:
        """mkdir -p for container-local paths (share paths work host-side)."""
        path = Path(path)
        if _is_relative_to(path, self.share):
            path.mkdir(parents=True, exist_ok=True)
            return
        result = self.run("mkdir", "-p", str(path), wrap=False, timeout=15,
                          workdir=None)
        assert result.returncode == 0, result.stderr

    def symlink(self, target, link) -> None:
        """ln -s target link inside the container (container-local paths)."""
        result = self.run("ln", "-s", str(target), str(link), wrap=False,
                          timeout=15, workdir=None)
        assert result.returncode == 0, result.stderr


def _is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


class TeardownError(RuntimeError):
    def __init__(self, state: str, message: str) -> None:
        super().__init__(message)
        self.state = state


def _inspect_container(container_id: str, timeout: float = 15) -> tuple:
    """Three-state presence classification for the ONE captured container.

    Returns (state, diagnostics) with state in {"present", "absent",
    "unknown"}:

    - "present": docker inspect exited 0 — the object exists;
    - "absent":  nonzero exit AND the output POSITIVELY reports the
      object missing ("No such container"/"No such object"). A bare
      nonzero exit is NOT proof of absence — daemon, connection,
      permission, and API failures exit nonzero too;
    - "unknown": everything else — daemon/connection/permission/API
      errors, CLI-launch failure (OSError), timeout, or unrecognised
      output. UNKNOWN never satisfies a teardown gate: the caller must
      fail and retain the session share.
    """
    try:
        out = subprocess.run(["docker", "inspect", container_id],
                             capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return "unknown", f"docker inspect timed out after {timeout}s"
    except OSError as exc:
        return "unknown", f"docker inspect could not run: {exc}"
    diag = (f"rc={out.returncode} stdout={out.stdout.strip()!r} "
            f"stderr={out.stderr.strip()!r}")
    if out.returncode == 0:
        return "present", diag
    blob = f"{out.stdout}\n{out.stderr}".lower()
    if "no such container" in blob or "no such object" in blob:
        return "absent", diag
    return "unknown", diag


def _remove_session_container(container_id: str, *,
                              rm_timeout: float = 60,
                              inspect_timeout: float = 15) -> None:
    """Remove the ONE captured session container and verify absence (B2).

    Bounded: exactly one forced removal plus one inspect verification,
    both scoped to the captured container ID — no docker-wide pruning,
    no name-based guesses, no retries. Idempotent: a nonzero removal exit
    (e.g. "No such container") with POSITIVELY established absence
    succeeds — the container is already gone. Absence is established only
    by an explicit "No such container"/"No such object" inspect result —
    a bare nonzero inspect exit is UNKNOWN (daemon/connection/permission/
    API failure), which fails the gate and retains the share. A timeout
    or launch failure always fails closed, even when a later inspect
    reports absence: a hung docker CLI is itself a teardown anomaly worth
    surfacing. Otherwise raises RuntimeError with the exact container
    identity and full diagnostics, so the gate can never go green with a
    leaked or unaccounted container.
    """
    diagnostics = []
    fatal = None    # timeout / launch failure: always fails closed
    rm_error = None  # nonzero exit: OK only when absence is verified
    try:
        rm = subprocess.run(["docker", "rm", "-f", container_id],
                            capture_output=True, text=True, timeout=rm_timeout)
        diagnostics.append(
            f"docker rm -f rc={rm.returncode} "
            f"stdout={rm.stdout.strip()!r} stderr={rm.stderr.strip()!r}")
        if rm.returncode != 0:
            rm_error = f"docker rm -f exited {rm.returncode}"
    except subprocess.TimeoutExpired:
        fatal = f"docker rm -f timed out after {rm_timeout}s"
        diagnostics.append(fatal)
    except OSError as exc:
        fatal = f"docker rm -f could not run: {exc}"
        diagnostics.append(fatal)
    state, inspect_diag = _inspect_container(container_id,
                                             timeout=inspect_timeout)
    diagnostics.append(f"docker inspect: state={state} ({inspect_diag})")
    absent = state == "absent"
    if fatal is None and absent:
        if rm_error:
            print(f"tier-1 fixture: {rm_error}, but container absence is "
                  "positively established — treating teardown as "
                  "idempotent success")
        return
    reasons = [r for r in (fatal, rm_error) if r]
    if state == "present":
        reasons.append("the container is still present afterwards")
    elif state == "unknown":
        reasons.append("container absence could not be positively "
                       "established (inspect unknown: daemon/connection/"
                       "permission/API error, launch failure, timeout, or "
                       "unrecognised output)")
    raise TeardownError(
        state,
        "tier-1 fixture: TEARDOWN FAILED — could not establish clean "
        f"removal of the session container. container_id={container_id}. "
        f"Reasons: {'; '.join(reasons)}. Final absence check: "
        f"state={state}. Diagnostics: {'; '.join(diagnostics) or 'none'}. "
        f"Remove it manually: docker rm -f {container_id}"
    )


def _finalize_session(container_id, share: Path, in_flight=None) -> str:
    """Verify exact-container absence and remove only the run-owned share."""
    teardown_error = None
    state = "absent"
    if container_id is not None:
        try:
            _remove_session_container(container_id)
        except TeardownError as exc:
            teardown_error = exc
            state = exc.state
            print(f"tier-1 fixture: {exc}")
    container_gone = container_id is None or teardown_error is None
    if not os.environ.get("TIER1_KEEP_SHARE"):
        if container_gone:
            shutil.rmtree(share, ignore_errors=True)
        else:
            print(f"tier-1 fixture: session container may still own the "
                  f"share — preserving evidence at {share}")
    else:
        print(f"tier-1 fixture: TIER1_KEEP_SHARE set — preserving {share}")
    if teardown_error is not None:
        if in_flight is not None:
            in_flight.add_note(
                f"tier-1 fixture teardown also failed: {teardown_error}")
        else:
            raise teardown_error
    return state


@pytest.fixture(scope="session")
def tier1_container(request):
    """One offline, exact-image tier-1 container per selected pytest run."""
    # Selector safety comes before Docker readiness: source mode must fail
    # deterministically without touching its checkout even on a Dockerless host.
    mode, value = _load_install_selection()
    if shutil.which("docker") is None:
        pytest.skip("tier 1 requires Docker: no docker executable on PATH")
    if subprocess.run(["docker", "info"], capture_output=True,
                      timeout=30).returncode != 0:
        pytest.skip("tier 1 requires Docker: docker daemon is not reachable")

    run_id, tier_dir = provenance.allocate_run_tree(RESULTS, "tier1")
    run_started = provenance.utc_now()
    workspace_snapshot = RESULTS / ".workspaces" / run_id
    repository = provenance.stage_repository_snapshot(REPO, workspace_snapshot)
    share = tier_dir / "share"
    share.mkdir(mode=0o755)
    setup_log = tier_dir / "setup.log"
    setup_lines = [f"mode={mode}", f"run_id={run_id}"]
    container_id = None
    container_attempted = False
    image = None
    artifact = None
    network_time = None
    setup_error = None
    teardown_state = "absent"
    teardown_time = None

    try:
        print(f"tier-1 fixture: run={run_id}; build exact image")
        image = _build_tier1_image(tier_dir)
        name = f"prime-claw-tier1-{run_id}"
        cidfile = tier_dir / "container.cid"
        mounts = ["-v", f"{workspace_snapshot}:{WORKSPACE}:ro",
                  "-v", f"{share}:{share}"]
        container_attempted = True
        started = subprocess.run(
            ["docker", "run", "-d", "--name", name,
             "--cidfile", str(cidfile), *mounts,
             image["id"], "sleep", "infinity"],
            capture_output=True, text=True, timeout=60,
        )
        raw_container_id = cidfile.read_text().strip() if cidfile.is_file() else ""
        if started.returncode != 0:
            raise RuntimeError(
                "tier-1 fixture: container start failed: "
                + started.stderr[-1000:])
        if not re.fullmatch(r"[0-9a-f]{64}", raw_container_id):
            raise RuntimeError("tier-1 fixture: invalid or missing captured container ID")
        container_id = raw_container_id
        setup_lines.append(f"container_id={container_id}")
        container = Tier1Container(container_id, share, mode)

        install = "curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh"
        result = container.run(
            "bash", "-lc", "set -euo pipefail; " + install,
            timeout=600, workdir=None,
            env={"PRIME_AGENT_VERSION": value,
                 "PRIME_AGENT_INSTALLER_PLAIN": "1",
                 "PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL": "0"},
        )
        if result.returncode != 0:
            raise RuntimeError("tier-1 fixture: pinned Prime Agent install failed")
        setup_lines.append("phase=prime-agent-installed")

        network_time = _disconnect_container_networks(container_id)
        setup_lines.append("phase=network-absent")
        (tier_dir / "network.json").write_text(
            '{"verified_absent":true}\n')
        artifact = _installed_package_identity(container)
        if artifact["version"] != value:
            raise RuntimeError(
                "tier-1 fixture: installed Prime Agent version does not "
                "match the requested pinned version")
        (tier_dir / "installed-artifact.json").write_text(
            json.dumps(artifact, sort_keys=True, separators=(",", ":")) + "\n")

        for script in ("apply-prime-agent-plugin.sh", "check-prime-agent-plugin.sh"):
            result = container.run(
                f"{WORKSPACE}/scripts/{script}", timeout=120, workdir=None,
                env={"PRIME_AGENT_PLUGIN_ROOT": CONTAINER_PLUGIN_ROOT},
            )
            if result.returncode != 0:
                raise RuntimeError(
                    f"tier-1 fixture: offline {script} failed")
            setup_lines.append(f"phase={script.removesuffix('.sh')}")
        setup_log.write_text("\n".join(setup_lines))
        yield container
    except BaseException as exc:
        setup_error = exc
        setup_lines.append(f"failure_type={type(exc).__name__}")
        setup_log.write_text("\n".join(setup_lines))
        raise
    finally:
        finalizer_error = None
        if container_id is None and container_attempted and cidfile.is_file():
            recovered_id = cidfile.read_text().strip()
            if re.fullmatch(r"[0-9a-f]{64}", recovered_id):
                container_id = recovered_id
                setup_lines.append("phase=container-identity-recovered")
                setup_log.write_text("\n".join(setup_lines))
        if container_id is None and container_attempted:
            teardown_state = "unknown"
            print("tier-1 fixture: container publication identity is invalid; "
                  "refusing destructive teardown and preserving mounted inputs")
        else:
            try:
                teardown_state = _finalize_session(container_id, share, setup_error)
            except TeardownError as exc:
                teardown_state = exc.state
                finalizer_error = exc
        if teardown_state == "absent":
            shutil.rmtree(workspace_snapshot)
        else:
            print(f"tier-1 fixture: preserving repository snapshot at "
                  f"{workspace_snapshot} because teardown is {teardown_state}")
        teardown_time = provenance.utc_now()
        # Once a run tree exists, publish a manifest even for partial failure.
        # Unavailable identities stay null/false rather than becoming claims.
        finished = provenance.utc_now()
        tests_failed = bool(
            getattr(getattr(request, "session", None), "testsfailed", 0))
        passed = (setup_error is None and not tests_failed
                  and teardown_state == "absent" and image is not None
                  and artifact is not None and network_time is not None)
        prime_identity = {
            "mode": "pinned", "requested_version": value,
            "installed_version": artifact["version"] if artifact else None,
            "artifact": artifact,
        }
        manifest = {
            "schema_version": provenance.SCHEMA_VERSION,
            "command_contract_version": provenance.COMMAND_CONTRACT_VERSION,
            "run": {"id": run_id, "tier": "tier1", "mode": "pinned",
                    "started_at": run_started, "finished_at": finished,
                    "status": "passed" if passed else "failed"},
            "repository": repository,
            "prime_agent": prime_identity,
            "image": image,
            "network": {"disconnected_at": network_time,
                        "verified_absent": network_time is not None},
            "teardown": {"state": teardown_state,
                         "verified_at": teardown_time},
            "evidence": {"files": []},
        }
        manifest["evidence"]["files"] = provenance.evidence_inventory(tier_dir)
        provenance.atomic_write_manifest(tier_dir / "manifest.json", manifest)
        provenance.verify_evidence(tier_dir, manifest)
        print(f"tier-1 fixture: evidence={tier_dir}")
        if finalizer_error is not None:
            raise finalizer_error


@pytest.fixture
def ctmp(tier1_container):
    """Per-test scratch dir on the session share (same path host/container)."""
    path = Path(tempfile.mkdtemp(prefix="ctmp-", dir=str(tier1_container.share)))
    yield path
    if not os.environ.get("TIER1_KEEP_SHARE"):
        shutil.rmtree(path, ignore_errors=True)


@pytest.fixture
def croot(tier1_container) -> str:
    """Per-test scratch dir on CONTAINER-LOCAL storage (a path string, not a
    host path — host file operations on it will not work).

    Why this exists: Node's fs.cpSync (used by the plugin's episode
    promoteBundle) fails with EACCES on its mode-normalizing chmod when the
    copy SOURCE is a guest-created file on the macOS gRPC-FUSE share
    (proven by tests/container probing: host-created sources copy fine,
    guest-created sources fail). Git-heavy episode flows therefore run on
    container-local /tmp; the same-path share (ctmp) is only for artifacts
    that need plain append/read visibility from the host (probe records,
    transport logs, daemon logs, session files). All access to croot paths
    goes through the tier1_container helpers.
    """
    result = tier1_container.run("mktemp", "-d", "/tmp/pc-croot-XXXXXXXX",
                                 wrap=False, timeout=15, workdir=None)
    assert result.returncode == 0, result.stderr
    path = result.stdout.strip()
    yield path
    tier1_container.run("rm", "-rf", path, wrap=False, timeout=30, workdir=None)
