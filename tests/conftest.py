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
from dataclasses import dataclass
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile
import time

import pytest

from scripts.testing import provenance
from scripts.testing import bounded as bounded_command


REPO = Path(__file__).resolve().parents[1]
WORKSPACE = "/workspace"
CONTAINER_PLUGIN_ROOT = "/root/.prime/agent"
IMAGE_REPO = "prime-claw-test-tier1"
DOCKERFILE = "docker/test.Dockerfile"
RESULTS = REPO / ".test-results"
ENV_FILE = REPO / ".env"
FORK_STAGE_SUBDIR = "packages/coding-agent/release/tier1"
DIST_DIRS = ("packages/coding-agent", "packages/agent", "packages/ai", "packages/tui")
HOST_KILL_GRACE = 5.0
_DEFERRED_SIGNAL = None


class _FixtureInterrupted(BaseException):
    def __init__(self, signum: int) -> None:
        self.signum = signum
        super().__init__(f"tier-1 fixture interrupted by signal {signum}")


def _host_command(argv, *, timeout: float, capture_output: bool = False,
                  text: bool = False, input_text=None, check: bool = False,
                  propagate_signal: bool = True):
    """The only host external-command contract used by the tier-1 fixture."""
    result = bounded_command.run_completed(
        [str(arg) for arg in argv], timeout=timeout,
        kill_grace=HOST_KILL_GRACE, reap_grace=HOST_KILL_GRACE,
        capture_output=capture_output, text=text, input=input_text)
    if result.outcome == "interrupted" and result.signal is not None:
        if propagate_signal:
            raise _FixtureInterrupted(result.signal)
        global _DEFERRED_SIGNAL
        _DEFERRED_SIGNAL = result.signal
    if check and (result.outcome != "exited" or result.returncode != 0):
        raise RuntimeError(
            "tier-1 fixture: bounded host command failed "
            f"(outcome={result.outcome}, rc={result.returncode})")
    return result

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


def _build_tier1_image(tier_dir: Path, workspace_snapshot: Path) -> dict:
    """Build from a run-owned empty context and return exact image identity."""
    build_context = tier_dir / "build-context"
    build_context.mkdir()
    captured_dockerfile = workspace_snapshot / DOCKERFILE
    shutil.copy2(captured_dockerfile, build_context / "Dockerfile")
    input_hash = provenance.hash_declared_inputs(build_context, ["Dockerfile"])
    dockerfile_hash = provenance.sha256_file(build_context / "Dockerfile")
    tag = f"{IMAGE_REPO}:{input_hash[:12]}"
    iidfile = tier_dir / "image.iid"
    started_at = provenance.utc_now()
    _host_command(
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
    inspected = _host_command(
        ["docker", "image", "inspect", image_id], check=True,
        capture_output=True, text=True, timeout=30,
    )
    try:
        rows = json.loads(inspected.stdout)
        row = rows[0]
    except (json.JSONDecodeError, IndexError, TypeError) as exc:
        raise RuntimeError("tier-1 fixture: invalid docker image inspect output") from exc
    safe = provenance.image_identity(
        row, expected_id=image_id, dockerfile=DOCKERFILE,
        dockerfile_sha256=dockerfile_hash,
        declared_input_sha256=input_hash, informational_tag=tag,
        build_started_at=started_at, build_finished_at=finished_at)
    provenance.write_sanitized_json(tier_dir / "image.json", safe)
    return safe


def _container_networks(container_id: str) -> list[str]:
    """Return captured network names; any inspect ambiguity fails closed."""
    try:
        out = _host_command(
            ["docker", "inspect", "--format",
             "{{json .NetworkSettings.Networks}}", container_id],
            capture_output=True, text=True, timeout=30,
        )
    except BaseException as exc:
        raise RuntimeError(
            "tier-1 fixture: container network inspection is unknown") from exc
    if out.outcome != "exited" or out.returncode != 0:
        raise RuntimeError(
            "tier-1 fixture: container network inspection is unknown "
            f"(outcome={out.outcome}, rc={out.returncode})")
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
        out = _host_command(
            ["docker", "network", "disconnect", network, container_id],
            capture_output=True, text=True, timeout=30,
        )
        if out.outcome != "exited" or out.returncode != 0:
            raise RuntimeError(
                "tier-1 fixture: network disconnect failed for captured "
                f"container {container_id} (outcome={out.outcome}, "
                f"rc={out.returncode})")
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
    try:
        observed_version = provenance.parse_prime_agent_version(version_result.stdout)
    except provenance.ProvenanceError as exc:
        raise RuntimeError("tier-1 fixture: installed version was unparseable") from exc
    hash_result = container.run(
        "bash", "-lc", 'sha256sum "$(command -v prime-agent)"',
        wrap=False, timeout=30, workdir=None,
    )
    digest = hash_result.stdout.split()[0] if hash_result.returncode == 0 and hash_result.stdout.split() else ""
    if not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise RuntimeError("tier-1 fixture: installed executable hash is invalid")
    return {"kind": "vendor-binary", "version": observed_version,
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


class ManagedHostProcess:
    """Interactive client with exact process-group termination semantics."""
    def __init__(self, process: subprocess.Popen) -> None:
        self._process = process

    def __getattr__(self, name):
        return getattr(self._process, name)

    def wait(self, timeout=None):
        if timeout is None:
            raise ValueError("interactive host waits require an explicit timeout")
        return self._process.wait(timeout=timeout)

    def terminate(self) -> None:
        try:
            os.killpg(self._process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass

    def kill(self) -> None:
        try:
            os.killpg(self._process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


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
        return _host_command(
            cmd, input_text=input_text, text=True, capture_output=True,
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
        return ManagedHostProcess(subprocess.Popen(
            cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, bufsize=0, start_new_session=True,
        ))

    def start_daemon(self, socket_path: str, route: str,
                     log_dir: Path) -> ContainerDaemon:
        """Start tests/container/fake_daemon.py in-container (detached)."""
        log_dir = Path(log_dir)
        log_dir.mkdir(parents=True, exist_ok=True)
        _host_command(
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


@dataclass(frozen=True)
class TeardownResult:
    state: str
    remove_outcome: str
    inspect_outcome: str
    clean: bool
    diagnostics: str = ""


class TeardownError(RuntimeError):
    def __init__(self, result: TeardownResult, message: str) -> None:
        super().__init__(message)
        self.result = result
        self.state = result.state


def _inspect_container(container_id: str, timeout: float = 15) -> tuple:
    """Return (presence, diagnostics, bounded outcome) for one exact ID."""
    out = _host_command(["docker", "inspect", container_id],
                        capture_output=True, text=True, timeout=timeout,
                        propagate_signal=False)
    if out.outcome != "exited":
        return "unknown", (
            f"docker inspect outcome={out.outcome} rc={out.returncode}"), out.outcome
    diag = (f"rc={out.returncode} stdout={out.stdout.strip()!r} "
            f"stderr={out.stderr.strip()!r}")
    if out.returncode == 0:
        return "present", diag, "clean"
    blob = f"{out.stdout}\n{out.stderr}".lower()
    if "no such container" in blob or "no such object" in blob:
        return "absent", diag, "ordinary_nonzero"
    return "unknown", diag, "ordinary_nonzero"


def _remove_session_container(container_id: str, *,
                              rm_timeout: float = 60,
                              inspect_timeout: float = 15) -> TeardownResult:
    """Remove one captured ID and keep command health separate from presence."""
    rm = _host_command(["docker", "rm", "-f", container_id],
                       capture_output=True, text=True, timeout=rm_timeout,
                       propagate_signal=False)
    if rm.outcome == "exited":
        remove_outcome = "clean" if rm.returncode == 0 else "ordinary_nonzero"
    else:
        remove_outcome = rm.outcome
    state, inspect_diag, inspect_outcome = _inspect_container(
        container_id, timeout=inspect_timeout)
    clean = (state == "absent"
             and remove_outcome in {"clean", "ordinary_nonzero"}
             and inspect_outcome == "ordinary_nonzero")
    diagnostics = (
        f"remove_outcome={remove_outcome} rc={rm.returncode}; "
        f"inspect_outcome={inspect_outcome} state={state}; {inspect_diag}")
    result = TeardownResult(state, remove_outcome, inspect_outcome,
                            clean, diagnostics)
    if clean:
        return result
    raise TeardownError(
        result,
        "tier-1 fixture: TEARDOWN FAILED — exact container cleanup was not "
        f"clean. container_id={container_id}. {diagnostics}. Remove it "
        f"manually: docker rm -f {container_id}")


def _finalize_session(container_id, share: Path, in_flight=None) -> TeardownResult:
    """Verify exact-container absence and remove only the run-owned share."""
    teardown_error = None
    if container_id is None:
        result = TeardownResult("absent", "not_needed", "not_needed", True)
    else:
        try:
            result = _remove_session_container(container_id)
        except TeardownError as exc:
            teardown_error = exc
            result = exc.result
            print(f"tier-1 fixture: {exc}")
    if not os.environ.get("TIER1_KEEP_SHARE"):
        if result.clean:
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
    return result


@pytest.fixture(scope="session")
def tier1_container(request):
    """One offline, exact-image tier-1 container per selected pytest run."""
    # Selector safety comes before Docker readiness: source mode must fail
    # deterministically without touching its checkout even on a Dockerless host.
    global _DEFERRED_SIGNAL
    _DEFERRED_SIGNAL = None
    mode, value = _load_install_selection()
    if shutil.which("docker") is None:
        pytest.skip("tier 1 requires Docker: no docker executable on PATH")
    docker_info = _host_command(["docker", "info"], capture_output=True,
                                timeout=30)
    if docker_info.outcome != "exited" or docker_info.returncode != 0:
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
    teardown_result = TeardownResult(
        "absent", "not_needed", "not_needed", True)
    teardown_time = None
    pending_signal = None
    finalizing = False
    watched_signals = tuple(
        sig for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP)
        if sig is not None)
    previous_handlers = {sig: signal.getsignal(sig) for sig in watched_signals}

    def on_fixture_signal(signum, _frame):
        nonlocal pending_signal
        pending_signal = signum
        if not finalizing:
            raise _FixtureInterrupted(signum)

    for watched_signal in watched_signals:
        signal.signal(watched_signal, on_fixture_signal)

    try:
        print(f"tier-1 fixture: run={run_id}; build exact image")
        image = _build_tier1_image(tier_dir, workspace_snapshot)
        name = f"prime-claw-tier1-{run_id}"
        cidfile = tier_dir / "container.cid"
        mounts = ["-v", f"{workspace_snapshot}:{WORKSPACE}:ro",
                  "-v", f"{share}:{share}"]
        container_attempted = True
        started = _host_command(
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
        if isinstance(exc, _FixtureInterrupted):
            pending_signal = exc.signum
        setup_lines.append(f"failure_type={type(exc).__name__}")
        setup_log.write_text("\n".join(setup_lines))
        raise
    finally:
        finalizing = True
        finalizer_error = None
        publication_error = None
        if container_id is None and container_attempted and cidfile.is_file():
            recovered_id = cidfile.read_text().strip()
            if re.fullmatch(r"[0-9a-f]{64}", recovered_id):
                container_id = recovered_id
                setup_lines.append("phase=container-identity-recovered")
                setup_log.write_text("\n".join(setup_lines))
        if container_id is None and container_attempted:
            teardown_result = TeardownResult(
                "unknown", "identity_refused", "not_run", False)
            print("tier-1 fixture: container publication identity is invalid; "
                  "refusing destructive teardown and preserving mounted inputs")
        else:
            try:
                teardown_result = _finalize_session(
                    container_id, share, setup_error)
            except TeardownError as exc:
                teardown_result = exc.result
                finalizer_error = exc
        if _DEFERRED_SIGNAL is not None:
            pending_signal = _DEFERRED_SIGNAL
        if teardown_result.clean:
            shutil.rmtree(workspace_snapshot)
        else:
            print(f"tier-1 fixture: preserving repository snapshot at "
                  f"{workspace_snapshot} because teardown is "
                  f"{teardown_result.state}/{teardown_result.remove_outcome}")
        teardown_time = provenance.utc_now()
        finished = provenance.utc_now()
        tests_failed = bool(
            getattr(getattr(request, "session", None), "testsfailed", 0))
        passed = (setup_error is None and finalizer_error is None
                  and pending_signal is None and not tests_failed
                  and teardown_result.clean
                  and teardown_result.state == "absent" and image is not None
                  and artifact is not None and artifact["version"] == value
                  and network_time is not None)
        failure_codes = []
        if setup_error is not None:
            failure_codes.append("setup-or-body-failed")
        if tests_failed:
            failure_codes.append("tests-failed")
        if pending_signal is not None:
            failure_codes.append("interrupted")
        if not teardown_result.clean:
            failure_codes.append("teardown-command-failed")
        if teardown_result.state != "absent":
            failure_codes.append("teardown-not-absent")
        if artifact is not None and artifact["version"] != value:
            failure_codes.append("installed-version-mismatch")
        if not failure_codes and not passed:
            failure_codes.append("incomplete-identity")
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
                    "status": "passed" if passed else "failed",
                    "failure_codes": failure_codes},
            "repository": repository,
            "prime_agent": prime_identity,
            "image": image,
            "network": {"disconnected_at": network_time,
                        "verified_absent": network_time is not None},
            "teardown": {"state": teardown_result.state,
                         "verified_at": teardown_time,
                         "remove_outcome": teardown_result.remove_outcome,
                         "inspect_outcome": teardown_result.inspect_outcome,
                         "clean": teardown_result.clean},
            "evidence": {"files": []},
        }
        try:
            manifest["evidence"]["files"] = provenance.evidence_inventory(tier_dir)
            provenance.atomic_write_manifest(tier_dir / "manifest.json", manifest)
            provenance.verify_evidence(tier_dir, manifest)
            print(f"tier-1 fixture: evidence={tier_dir}")
        except BaseException as exc:
            publication_error = exc
            primary = setup_error or finalizer_error
            if primary is not None and hasattr(primary, "add_note"):
                primary.add_note(
                    "tier-1 fixture evidence publication also failed: "
                    f"{type(exc).__name__}")
        finally:
            for watched_signal, previous in previous_handlers.items():
                signal.signal(watched_signal, previous)
        if pending_signal is not None:
            os.kill(os.getpid(), pending_signal)
            # A restored callable/SIG_IGN handler may return. Never allow that
            # redelivery path to resume as a green fixture session.
            raise _FixtureInterrupted(pending_signal)
        if finalizer_error is not None:
            raise finalizer_error
        if publication_error is not None and setup_error is None:
            raise publication_error


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
