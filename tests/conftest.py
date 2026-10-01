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
contract): same .env selection semantics (exactly one of PRIME_AGENT_PINNED /
PRIME_AGENT_SOURCE; TIER1_ENV_FILE override), same fail-fast ladder (docker
readiness -> source staging -> image build -> container run), same install
commands, same in-container apply/check against the container's own
~/.prime/agent. Host-side fork staging in source mode duplicates the
driver's B1 contract (fresh build every run after FAIL-CLOSED removal of
the four pack-consumed dist dirs); if the driver's staging contract
changes, change it there first and mirror it here.

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
import stat
import subprocess
import tempfile
import time

import pytest


REPO = Path(__file__).resolve().parents[1]
WORKSPACE = "/workspace"
IMAGE = "prime-claw-test-tier1:latest"
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
        src = Path(source)
        if not src.is_absolute():
            raise RuntimeError(
                f"tier-1 fixture: PRIME_AGENT_SOURCE must be an absolute path: {source}"
            )
        if not src.is_dir():
            raise RuntimeError(
                f"tier-1 fixture: PRIME_AGENT_SOURCE is not a directory: {source}"
            )
        if not (src / "scripts" / "pack-prime-agent-release.mjs").is_file():
            raise RuntimeError(
                "tier-1 fixture: PRIME_AGENT_SOURCE lacks "
                f"scripts/pack-prime-agent-release.mjs: {source}"
            )
        return "source", source
    return "pinned", pinned


def _remove_dist_tree(path: Path) -> None:
    """Fail-closed removal of one pack-consumed dist tree.

    Same fail-closed contract as the driver's `rm -rf` under `set -e`
    (scripts/test-tier1.sh) — the run stops before pack/image-build/
    container creation when stale output cannot be cleared — but with
    STRICTLY EARLIER metadata-error detection: the path is lstat'd
    directly at staging time, so an inspection failure (PermissionError,
    EIO, ...) raises HERE. The driver's rm -rf can defer detection of an
    unsearchable dist parent to the npm build step on some hosts (BSD
    rm -rf may exit 0 without removing the tree; the build then fails on
    the permission denial). Both stop before pack/container creation;
    the fixture simply detects the metadata error sooner.

    Error-preserving semantics — on Python 3.14 the Path.is_symlink() /
    is_file() / is_dir() predicates SUPPRESS filesystem OSError into
    False, so they cannot distinguish absence from inspection failure.
    lstat directly instead:
    - FileNotFoundError          -> confirmed absence: nothing to do.
    - any other OSError on lstat -> RAISE: the dist state is unknown.
    - symlink (incl. dangling)   -> unlink; the target is NEVER traversed.
    - directory                  -> shutil.rmtree (errors raise).
    - regular file               -> unlink.
    - anything else (FIFO, socket, device, ...) -> explicitly REJECTED:
      a special object at a pack-consumed dist path is an anomaly the
      fixture refuses to build over.
    """
    try:
        st = path.lstat()
    except FileNotFoundError:
        return  # confirmed absent — the valid missing-tree case
    except OSError as exc:
        raise RuntimeError(
            f"tier-1 fixture: cannot inspect stale build output {path} "
            f"({exc}) — refusing to build/pack with unknown dist state"
        ) from exc
    mode = st.st_mode
    if stat.S_ISLNK(mode) or stat.S_ISREG(mode):
        action = path.unlink
    elif stat.S_ISDIR(mode):
        action = lambda: shutil.rmtree(path)  # noqa: E731
    else:
        raise RuntimeError(
            f"tier-1 fixture: {path} is a special filesystem object "
            f"(st_mode {oct(mode)}) at a pack-consumed dist path — "
            "refusing to build/pack over it; remove it manually"
        )
    try:
        action()
    except OSError as exc:
        raise RuntimeError(
            f"tier-1 fixture: cannot remove stale build output {path} "
            f"({exc}) — refusing to build/pack from a possibly-stale tree"
        ) from exc


def _stage_fork_release(source: str) -> tuple[str, Path]:
    """Mirror of the driver's B1 source staging: FRESH build on every run.

    The fork build (tsgo + asset copies) does NOT clean dist, so the four
    pack-consumed dist dirs are removed first — fail-closed with the same
    stop-before-pack/container contract as the driver's rm -rf under
    set -e, but with strictly earlier metadata-error detection (the
    fixture lstat's each tree at staging; the driver's rm -rf may defer
    detection of an unsearchable parent to the npm build step on some
    hosts). Freshness is never inferred from version equality or
    directory existence. release:pack wipes its out-dir before writing,
    so a failed run leaves no fallback artifacts.
    """
    src = Path(source)
    print(f"tier-1 fixture: fresh fork build (rm dist dirs; npm run build in {source})")
    for pkg in DIST_DIRS:
        _remove_dist_tree(src / pkg / "dist")
    subprocess.run(["npm", "run", "build"], cwd=src, check=True, timeout=1800)
    out_dir = src / FORK_STAGE_SUBDIR
    print(f"tier-1 fixture: release:pack -> {out_dir}")
    subprocess.run(
        ["node", str(src / "scripts" / "pack-prime-agent-release.mjs"),
         "--base-url", "file:///stage", "--out-dir", str(out_dir)],
        check=True, timeout=600,
    )
    tarballs = sorted(
        p for p in (out_dir / "artifacts").glob("prime-agent-*.tgz")
        if not re.match(r"prime-agent-(ai|core|tui)-", p.name)
    )
    if not tarballs:
        raise RuntimeError(
            f"tier-1 fixture: release:pack produced no prime-agent tarball in "
            f"{out_dir}/artifacts"
        )
    version = tarballs[0].name.removeprefix("prime-agent-").removesuffix(".tgz")
    print(f"tier-1 fixture: staged fork release v{version}")
    return version, out_dir / "artifacts"


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
    raise RuntimeError(
        "tier-1 fixture: TEARDOWN FAILED — could not establish clean "
        f"removal of the session container. container_id={container_id}. "
        f"Reasons: {'; '.join(reasons)}. Final absence check: "
        f"state={state}. Diagnostics: {'; '.join(diagnostics) or 'none'}. "
        f"Remove it manually: docker rm -f {container_id}"
    )


def _finalize_session(container_id, share: Path, in_flight=None) -> None:
    """Session teardown: verified container removal, then share policy.

    The session share is evidence: it is removed only when no container
    can still own it (nothing was published, or teardown verified
    absence). When teardown fails while a setup/test failure is already
    in flight, the teardown failure is attached to it as a note so BOTH
    surface; otherwise the teardown failure raises on its own.
    """
    teardown_error = None
    if container_id is not None:
        try:
            _remove_session_container(container_id)
        except RuntimeError as exc:
            teardown_error = exc
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


@pytest.fixture(scope="session")
def tier1_container(request):
    """One tier-1 container per pytest session that includes container tests.

    Driver-equivalent setup runs ONCE here: build the image (cached),
    stage/install prime-agent per .env, then apply + check the plugin
    against the container's own ~/.prime/agent. The container is destroyed
    — and its absence verified — at session end; a teardown failure fails
    the run with the exact container identity (B2), and the session share
    evidence is preserved while a container may still own it. The share is
    freshly and exclusively allocated per session (mkdtemp), so one
    session can never inherit — or delete — another session's share
    (B2-R2).
    """
    if shutil.which("docker") is None:
        pytest.skip("tier 1 requires Docker: no docker executable on PATH")
    if subprocess.run(["docker", "info"], capture_output=True,
                      timeout=30).returncode != 0:
        pytest.skip("tier 1 requires Docker: docker daemon is not reachable")

    mode, value = _load_install_selection()

    RESULTS.mkdir(parents=True, exist_ok=True)
    # Unique, exclusively allocated per session (B2-R2): mkdtemp always
    # creates a FRESH directory owned by this session. A later session —
    # PID reuse, or several pytest sessions in one process — never reuses
    # a retained failed session's share, so finalization can only ever
    # remove this session's own evidence. A pre-existing directory (for
    # example a legacy share-<pid>) is neither used nor removed.
    run_id = f"{os.getpid()}-{int(time.time())}"
    share = Path(tempfile.mkdtemp(prefix=f"share-{run_id}-", dir=RESULTS))
    # mkdtemp creates 0700; normalize to the former mkdir default so the
    # container's access through the same-absolute-path mount is unchanged.
    share.chmod(0o755)
    share_token = share.name.rsplit("-", 1)[-1]
    setup_log = RESULTS / "tier1-session-setup.log"
    log_lines = [f"mode={mode} value={value}", f"share={share}"]

    container_id = None
    setup_error = None
    try:
        mounts = ["-v", f"{REPO}:{WORKSPACE}:ro",
                  "-v", f"{share}:{share}"]
        if mode == "source":
            version, artifacts = _stage_fork_release(value)
            mounts += ["-v", f"{artifacts}:/stage/releases/v{version}:ro"]
            install = (f"npm install -g "
                       f"/stage/releases/v{version}/prime-agent-{version}.tgz")
        else:
            install = (
                f"export PRIME_AGENT_VERSION='{value}' "
                "PRIME_AGENT_INSTALLER_PLAIN=1 "
                "PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL=0; "
                "curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh"
            )

        print("tier-1 fixture: docker build (cached layers make this fast)")
        subprocess.run(
            ["docker", "build", "-q", "-f", str(REPO / DOCKERFILE),
             "-t", IMAGE, str(REPO)],
            check=True, capture_output=True, text=True, timeout=1200,
        )

        # Unique per session — pid + epoch + the share's allocation token,
        # keeping the container identity aligned with the share identity
        # (B2-R2): a later run never collides with — and therefore never
        # inherits — a failed run's leftover container or share.
        name = f"prime-claw-tier1-session-{run_id}-{share_token}"
        started = subprocess.run(
            ["docker", "run", "-d", "--name", name, *mounts,
             IMAGE, "sleep", "infinity"],
            check=True, capture_output=True, text=True, timeout=60,
        )
        container_id = started.stdout.strip()
        log_lines.append(f"container={name} id={container_id[:12]}")

        print("tier-1 fixture: install prime-agent, apply + check plugin "
              "(once per session)")
        setup = container = Tier1Container(container_id, share, mode)
        result = container.run(
            "bash", "-lc",
            "set -euo pipefail; " + install
            + " && prime-agent --version"
            + " && /workspace/scripts/apply-prime-agent-plugin.sh"
            + " && /workspace/scripts/check-prime-agent-plugin.sh",
            timeout=600, workdir=None,
        )
        log_lines.append(result.stdout)
        if result.returncode != 0:
            log_lines.append(result.stderr)
            setup_log.write_text("\n".join(log_lines))
            raise RuntimeError(
                "tier-1 fixture: container setup failed (see "
                f"{setup_log}):\n{result.stdout[-2000:]}\n{result.stderr[-2000:]}"
            )
        version_line = [
            line for line in result.stdout.splitlines() if line.strip()
        ]
        log_lines.append(f"prime-agent version: "
                         f"{version_line and 'see log' or 'unknown'}")
        setup_log.write_text("\n".join(log_lines))

        yield container
    except BaseException as exc:  # setup failure or throw-in at the yield
        setup_error = exc
        raise
    finally:
        _finalize_session(container_id, share, setup_error)


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
