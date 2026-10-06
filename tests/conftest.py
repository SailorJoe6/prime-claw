"""prime-claw test-tier fixtures.

Unmarked tests are tier 0 and host-safe. Tests that request `tier1_container`,
`ctmp`, or `croot` are auto-marked `container` and run only when pytest receives
the exact supported selector `-m container`. A random, negated, grouped, or
compound marker expression never authorizes an environment tier.

Tier 2 is not a host pytest suite. `scripts/test-integration.sh` invokes a
non-collectable assertion body inside the purpose-built Slice-3 image. Lifecycle
execution remains disabled; `integration`, `lifecycle`, and deprecated `sandbox`
markers are always skipped by host pytest.

The session fixture mirrors scripts/test-tier1.sh and preserves the accepted
Slice-1/Slice-2 build, isolation, evidence, and cleanup contract.
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
RESULTS = Path(os.environ.get("TIER1_RESULTS_ROOT") or REPO / ".test-results").resolve()
ENV_FILE = REPO / ".env"
HOST_KILL_GRACE = 5.0
_DEFERRED_SIGNAL = None


class _FixtureInterrupted(BaseException):
    def __init__(self, signum: int) -> None:
        self.signum = signum
        super().__init__(f"tier-1 fixture interrupted by signal {signum}")


def _host_command(argv, *, timeout: float, capture_output: bool = False,
                  text: bool = False, input_text=None, check: bool = False,
                  propagate_signal: bool = True,
                  kill_grace: float = HOST_KILL_GRACE):
    """The only host external-command contract used by the tier-1 fixture."""
    result = bounded_command.run_completed(
        [str(arg) for arg in argv], timeout=timeout,
        kill_grace=kill_grace, reap_grace=kill_grace,
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
_SKIP_INTEGRATION = (
    "tier 2 (integration): explicit disposable brain-stack body; run "
    "scripts/test-integration.sh"
)
_SKIP_LIFECYCLE = (
    "lifecycle execution is disabled; mocked runtime tests belong in tier 0"
)


def pytest_collection_modifyitems(config, items):
    """Admit tier 1 only through exact `-m container`; fail closed otherwise."""
    for item in items:
        if any(name in item.fixturenames for name in ("tier1_container", "ctmp", "croot")):
            item.add_marker(pytest.mark.container)
    markexpr = (getattr(config.option, "markexpr", "") or "").strip()
    tier1_selected = markexpr == "container"
    for item in items:
        if (item.get_closest_marker("container") is not None
                and not tier1_selected):
            item.add_marker(pytest.mark.skip(reason=_SKIP_CONTAINER))
        if item.get_closest_marker("integration") is not None:
            item.add_marker(pytest.mark.skip(reason=_SKIP_INTEGRATION))
        if (item.get_closest_marker("lifecycle") is not None
                or item.get_closest_marker("sandbox") is not None):
            item.add_marker(pytest.mark.skip(reason=_SKIP_LIFECYCLE))


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
        if (not os.path.isabs(source)
                or any(char in source for char in (",", "\n", "\r", "\0"))):
            raise RuntimeError(
                "tier-1 fixture: PRIME_AGENT_SOURCE must be a safe absolute path")
        return "source", source
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", pinned):
        raise RuntimeError(
            "tier-1 fixture: PRIME_AGENT_PINNED must be an exact semantic version")
    return "pinned", pinned


def _build_source_release(source: str, tier_cap: provenance.OwnedDirectory,
                          tier_dir: Path, tier_binding: str,
                          share: Path, share_binding: str,
                          workspace_snapshot: Path) -> dict:
    """Invoke the one canonical disposable source builder and read its receipt."""
    result = _host_command(
        [str(workspace_snapshot / "scripts/build-prime-agent-test-release.sh"),
         "--source", source, "--workspace", str(workspace_snapshot),
         "--tier-dir", str(tier_dir), "--tier-binding", tier_binding,
         "--share", str(share), "--share-binding", share_binding,
         "--image-timeout", "600", "--build-timeout", "600"],
        timeout=600, kill_grace=120, capture_output=True, text=True,
    )
    if result.outcome != "exited" or result.returncode != 0:
        raise RuntimeError(
            "tier-1 fixture: disposable source builder failed "
            f"(outcome={result.outcome}, rc={result.returncode})")
    receipt = provenance.read_sanitized_json(tier_cap, "source-build.json")
    try:
        teardown = provenance.source_builder_share_teardown(receipt)
    except provenance.ProvenanceError as exc:
        raise RuntimeError(
            "tier-1 fixture: validated source builder receipt unavailable") from exc
    release = receipt.get("release") if isinstance(receipt, dict) else None
    if (receipt.get("status") != "passed" or not isinstance(release, dict)
            or teardown["state"] != "absent" or not teardown["clean"]):
        raise RuntimeError("tier-1 fixture: validated source builder receipt unavailable")
    version = release.get("package_version")
    if not isinstance(version, str) or not re.fullmatch(
            r"[0-9]+\.[0-9]+\.[0-9]+", version):
        raise RuntimeError("tier-1 fixture: source release version is invalid")
    return receipt


def _build_tier1_image(tier_cap: provenance.OwnedDirectory,
                       tier_dir: Path, workspace_snapshot: Path) -> dict:
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
        raise RuntimeError("tier-1 fixture: invalid image ID in iidfile")
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
    provenance.write_sanitized_json(tier_cap, "image.json", safe)
    return safe


def _container_networks(container_id: str) -> list[str]:
    """Return captured network names; any inspect ambiguity fails closed."""
    try:
        out = _host_command(
            ["docker", "inspect", "--format",
             "{{json .NetworkSettings.Networks}}", container_id],
            capture_output=True, text=True, timeout=30,
        )
    except _FixtureInterrupted:
        raise
    except Exception as exc:
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
    if getattr(container, "mode", "pinned") == "source":
        version_script = (
            'const{execFileSync}=require("child_process");'
            'const r=execFileSync("npm",["root","-g"],{encoding:"utf8"}).trim();'
            'const p=require(r+"/prime-agent/package.json");'
            'process.stdout.write(String(p.version))'
        )
        version_result = container.run(
            "node", "-e", version_script, wrap=False, timeout=30, workdir=None)
    else:
        version_result = container.run(
            "prime-agent", "--version", wrap=False, timeout=30, workdir=None)
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


def _read_source_builder_teardown(
        tier_cap: provenance.OwnedDirectory) -> TeardownResult:
    """Return typed builder share ownership; invalid receipts stay unknown."""
    try:
        receipt = provenance.read_sanitized_json(tier_cap, "source-build.json")
        value = provenance.source_builder_share_teardown(receipt)
    except (FileNotFoundError, OSError, UnicodeDecodeError, json.JSONDecodeError,
            TypeError, ValueError, provenance.ProvenanceError):
        return TeardownResult(
            "unknown", "identity_refused", "not_run", False,
            "source builder receipt unavailable or invalid")
    return TeardownResult(
        value["state"], value["remove_outcome"], value["inspect_outcome"],
        value["clean"], "source builder receipt validated")


def _output_bytes(value) -> bytes:
    if value is None:
        return b""
    return value if isinstance(value, bytes) else str(value).encode("utf-8", "replace")


def _inspect_container(container_id: str, timeout: float = 15) -> tuple:
    """Return (presence, safe diagnostics, bounded outcome) for one exact ID."""
    out = _host_command(["docker", "inspect", container_id],
                        capture_output=True, text=False, timeout=timeout,
                        propagate_signal=False)
    safe_diag = f"outcome={out.outcome} rc={out.returncode}"
    if out.outcome != "exited":
        return "unknown", safe_diag, out.outcome
    if out.returncode == 0:
        return "present", safe_diag, "clean"
    blob = (_output_bytes(out.stdout) + b"\n" + _output_bytes(out.stderr)).lower()
    if b"no such container" in blob or b"no such object" in blob:
        return "absent", safe_diag, "ordinary_nonzero"
    return "unknown", safe_diag, "ordinary_nonzero"


def _remove_session_container(container_id: str, *,
                              rm_timeout: float = 60,
                              inspect_timeout: float = 15) -> TeardownResult:
    """Remove one captured ID; arbitrary daemon output never escapes memory."""
    rm = _host_command(["docker", "rm", "-f", container_id],
                       capture_output=True, text=False, timeout=rm_timeout,
                       propagate_signal=False)
    if rm.outcome == "exited":
        remove_outcome = "clean" if rm.returncode == 0 else "ordinary_nonzero"
    else:
        remove_outcome = rm.outcome
    state, inspect_diag, inspect_outcome = _inspect_container(
        container_id, timeout=inspect_timeout)
    clean = (state == "absent"
             and remove_outcome == "clean"
             and inspect_outcome == "ordinary_nonzero")
    diagnostics = (
        f"remove_outcome={remove_outcome} remove_rc={rm.returncode}; "
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


def _finalize_session(container_id, share: Path, in_flight=None,
                      share_binding: str | None = None,
                      quarantine_parent: Path | None = None,
                      quarantine_binding: str | None = None,
                      builder_teardown: TeardownResult | None = None) -> TeardownResult:
    """Remove a bound share only after every possible owner is clean/absent."""
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
    runtime_released = result.clean and result.state == "absent"
    builder_released = (builder_teardown is None or (
        builder_teardown.clean and builder_teardown.state == "absent"))
    if not os.environ.get("TIER1_KEEP_SHARE"):
        if runtime_released and builder_released:
            try:
                binding = share_binding or provenance.owned_directory_binding(share)
                provenance.remove_owned_directory(
                    share, binding,
                    quarantine_parent=quarantine_parent or share.parent,
                    quarantine_binding=quarantine_binding)
            except (OSError, provenance.ProvenanceError) as exc:
                refused = TeardownResult(
                    result.state, result.remove_outcome,
                    result.inspect_outcome, False,
                    "owned share cleanup refused")
                raise TeardownError(
                    refused,
                    "tier-1 fixture: TEARDOWN FAILED — owned share binding "
                    "changed; refusing cleanup") from exc
        else:
            owner = "runtime" if not runtime_released else "source builder"
            print(f"tier-1 fixture: {owner} may still own the share — "
                  f"preserving evidence at {share}")
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

    run_id, tier_dir, tier_binding = provenance.allocate_run_tree(
        RESULTS, "tier1")
    run_started = provenance.utc_now()
    workspace_snapshot = RESULTS / ".workspaces" / run_id
    repository = provenance.stage_repository_snapshot(REPO, workspace_snapshot)
    workspace_binding = provenance.owned_directory_binding(workspace_snapshot)
    share = tier_dir / "share"
    share.mkdir(mode=0o755)
    share_binding = provenance.owned_directory_binding(share)
    setup_log = tier_dir / "setup.log"
    setup_lines = [f"mode={mode}", f"run_id={run_id}"]
    container_id = None
    container_attempted = False
    image = None
    artifact = None
    source_build = None
    builder_teardown_result = (
        TeardownResult("unknown", "identity_refused", "not_run", False)
        if mode == "source" else
        TeardownResult("absent", "not_needed", "not_needed", True))
    install_version = value if mode == "pinned" else None
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
    terminal_sigmask = getattr(signal, "pthread_sigmask", None)
    terminal_sigpending = getattr(signal, "sigpending", None)
    if terminal_sigmask is None or terminal_sigpending is None:
        raise RuntimeError("tier-1 fixture requires POSIX signal-mask support")

    def on_fixture_signal(signum, _frame):
        nonlocal pending_signal
        pending_signal = signum
        if not finalizing:
            raise _FixtureInterrupted(signum)

    # Snapshot caller-owned mask/pending state before acquiring the evidence
    # capability. Once acquired, any failure while blocking the watched set
    # restores that exact mask and closes the capability before propagating.
    caller_mask = terminal_sigmask(signal.SIG_BLOCK, [])
    caller_owned_pending = set(terminal_sigpending())
    tier_cap = provenance.open_owned_directory(tier_dir, tier_binding)
    terminal_signals_blocked = False
    try:
        terminal_sigmask(signal.SIG_BLOCK, watched_signals)
        terminal_signals_blocked = True
    except BaseException:
        try:
            terminal_sigmask(signal.SIG_SETMASK, caller_mask)
        finally:
            tier_cap.close()
        raise
    handlers_owned = True

    try:
        for watched_signal in watched_signals:
            signal.signal(watched_signal, on_fixture_signal)
        terminal_signals_blocked = False
        terminal_sigmask(signal.SIG_SETMASK, caller_mask)
        if mode == "source":
            print(f"tier-1 fixture: run={run_id}; build source release in disposable builder")
            source_build = _build_source_release(
                value, tier_cap, tier_dir, tier_binding,
                share, share_binding, workspace_snapshot)
            builder_teardown_result = _read_source_builder_teardown(tier_cap)
            if (not builder_teardown_result.clean
                    or builder_teardown_result.state != "absent"):
                raise RuntimeError(
                    "tier-1 fixture: source builder ownership is not released")
            install_version = source_build["release"]["package_version"]
            setup_lines.append("phase=source-builder-passed")
        print(f"tier-1 fixture: run={run_id}; build exact image")
        image = _build_tier1_image(
            tier_cap, tier_dir, workspace_snapshot)
        name = f"prime-claw-tier1-{run_id}"
        cidfile = tier_dir / "container.cid"
        mounts = ["-v", f"{workspace_snapshot}:{WORKSPACE}:ro",
                  "-v", f"{share}:{share}"]
        if mode == "source":
            mounts += ["-v", (f"{share}/source-release/artifacts:"
                              f"/stage/releases/v{install_version}:ro")]
        container_attempted = True
        started = _host_command(
            ["docker", "run", "-d", "--init", "--name", name,
             "--cidfile", str(cidfile), *mounts,
             image["id"], "sleep", "infinity"],
            capture_output=True, text=True, timeout=60,
        )
        raw_container_id = cidfile.read_text().strip() if cidfile.is_file() else ""
        if started.returncode != 0:
            raise RuntimeError(
                "tier-1 fixture: container start failed "
                f"(outcome={started.outcome}, rc={started.returncode})")
        if not re.fullmatch(r"[0-9a-f]{64}", raw_container_id):
            raise RuntimeError("tier-1 fixture: invalid or missing captured container ID")
        container_id = raw_container_id
        setup_lines.append(f"container_id={container_id}")
        container = Tier1Container(container_id, share, mode)

        if mode == "pinned":
            install = "curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh"
            result = container.run(
                "bash", "-lc", "set -euo pipefail; " + install,
                timeout=600, workdir=None,
                env={"PRIME_AGENT_VERSION": value,
                     "PRIME_AGENT_INSTALLER_PLAIN": "1",
                     "PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL": "0"},
            )
            install_label = "pinned"
        else:
            sums_rows = [row for row in source_build["release"]["output_inventory"]
                         if row.get("path") == "artifacts/SHA256SUMS"]
            if len(sums_rows) != 1:
                raise RuntimeError("tier-1 fixture: source release inventory is invalid")
            sums_sha = sums_rows[0]["content_sha256"]
            result = container.run(
                "bash", "-lc",
                (f"set -euo pipefail; cd /stage/releases/v{install_version}; "
                 f"printf '%s  SHA256SUMS\\n' '{sums_sha}' | sha256sum -c - >/dev/null; "
                 "sha256sum -c SHA256SUMS >/dev/null; "
                 f"npm install -g ./prime-agent-{install_version}.tgz"),
                timeout=600, workdir=None,
            )
            install_label = "source"
        if result.returncode != 0:
            raise RuntimeError(
                f"tier-1 fixture: {install_label} Prime Agent install failed")
        setup_lines.append(f"phase=prime-agent-{install_label}-installed")

        network_time = _disconnect_container_networks(container_id)
        setup_lines.append("phase=network-absent")
        provenance.write_sanitized_json(
            tier_cap, "network.json", {"verified_absent": True})
        artifact = _installed_package_identity(container)
        if artifact["version"] != install_version:
            raise RuntimeError(
                "tier-1 fixture: installed Prime Agent version does not "
                "match the validated requested version")
        provenance.write_sanitized_json(
            tier_cap, "installed-artifact.json", artifact)

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
        try:
            setup_log.write_text("\n".join(setup_lines))
        except BaseException as log_exc:
            if hasattr(exc, "add_note"):
                exc.add_note(
                    "tier-1 fixture setup-log write also failed: "
                    f"{type(log_exc).__name__}")
        raise
    finally:
        finalizing = True
        secondary_errors: list[tuple[str, BaseException]] = []
        publication_error = None
        published_manifest_binding = None
        def add_secondary(code: str, exc: BaseException) -> None:
            secondary_errors.append((code, exc))
            if setup_error is not None and hasattr(setup_error, "add_note"):
                setup_error.add_note(
                    f"tier-1 fixture secondary {code}: {type(exc).__name__}")

        def make_manifest() -> dict:
            tests_failed = bool(
                getattr(getattr(request, "session", None), "testsfailed", 0))
            failure_codes = []
            if setup_error is not None:
                failure_codes.append("setup-or-body-failed")
            if tests_failed:
                failure_codes.append("tests-failed")
            if (pending_signal is not None or _DEFERRED_SIGNAL is not None
                    or terminal_signal is not None):
                failure_codes.append("interrupted")
            if not teardown_result.clean:
                failure_codes.append("teardown-command-failed")
            if teardown_result.state != "absent":
                failure_codes.append("teardown-not-absent")
            if mode == "source" and not builder_teardown_result.clean:
                failure_codes.append("builder-teardown-command-failed")
            if mode == "source" and builder_teardown_result.state != "absent":
                failure_codes.append("builder-teardown-not-absent")
            if (artifact is not None
                    and artifact["version"] != install_version):
                failure_codes.append("installed-version-mismatch")
            for code, _exc in secondary_errors:
                if code not in failure_codes:
                    failure_codes.append(code)
            source_ready = (mode == "pinned" or (
                isinstance(source_build, dict)
                and source_build.get("status") == "passed"
                and isinstance(source_build.get("release"), dict)))
            builder_released = (mode != "source" or (
                builder_teardown_result.clean
                and builder_teardown_result.state == "absent"))
            passed = (not failure_codes and teardown_result.clean
                      and teardown_result.state == "absent"
                      and builder_released
                      and image is not None and artifact is not None
                      and artifact["version"] == install_version
                      and network_time is not None and source_ready)
            if not failure_codes and not passed:
                failure_codes.append("incomplete-identity")
            if mode == "pinned":
                prime_identity = {
                    "mode": "pinned", "requested_version": value,
                    "installed_version": artifact["version"] if artifact else None,
                    "artifact": artifact,
                }
            else:
                release = (source_build.get("release")
                           if isinstance(source_build, dict) else None)
                builder = None
                if isinstance(source_build, dict):
                    builder_teardown = source_build.get("builder_teardown")
                    if (not builder_teardown_result.clean
                            or builder_teardown_result.state != "absent"):
                        builder_teardown = {
                            "container_id": None,
                            "state": builder_teardown_result.state,
                            "remove_outcome": builder_teardown_result.remove_outcome,
                            "inspect_outcome": builder_teardown_result.inspect_outcome,
                            "clean": False,
                            "verified_at": provenance.utc_now(),
                        }
                    builder = {
                        "image": source_build.get("builder_image"),
                        "teardown": builder_teardown,
                        "checkout_inventory_before": source_build.get(
                            "checkout_inventory_before"),
                        "checkout_inventory_after": source_build.get(
                            "checkout_inventory_after"),
                    }
                prime_identity = {
                    "mode": "source", "requested_version": install_version,
                    "installed_version": artifact["version"] if artifact else None,
                    "artifact": artifact,
                    "source": (source_build.get("source")
                               if isinstance(source_build, dict) else None),
                    "source_rules": (source_build.get("source_rules")
                                     if isinstance(source_build, dict) else None),
                    "staged_release": release,
                    "builder": builder,
                }
            return {
                "schema_version": provenance.SCHEMA_VERSION,
                "command_contract_version": provenance.COMMAND_CONTRACT_VERSION,
                "run": {"id": run_id, "tier": "tier1", "mode": mode,
                        "started_at": run_started,
                        "finished_at": provenance.utc_now(),
                        "status": "passed" if passed else "failed",
                        "failure_codes": failure_codes},
                "repository": repository,
                "prime_agent": prime_identity,
                "image": image,
                "network": {"disconnected_at": network_time,
                            "verified_absent": network_time is not None},
                "teardown": {"state": teardown_result.state,
                             "verified_at": teardown_time or provenance.utc_now(),
                             "remove_outcome": teardown_result.remove_outcome,
                             "inspect_outcome": teardown_result.inspect_outcome,
                             "clean": teardown_result.clean},
                "evidence": {"files": []},
            }

        terminal_signal = None
        redeliver_signal = None
        terminal_manifest_failed = False
        terminal_observation_failed = False

        def observed_kernel_terminal_signal():
            waiting = terminal_sigpending()
            for candidate in watched_signals:
                # A caller-blocked signal remains caller-owned even when it
                # arrives during the fixture. Pre-existing pending state is
                # recorded separately for clarity and must also stay pending.
                if (candidate in waiting and candidate not in caller_mask
                        and candidate not in caller_owned_pending):
                    return candidate
            return None

        def observe_terminal_safely(code: str):
            nonlocal terminal_observation_failed
            try:
                return observed_kernel_terminal_signal()
            except BaseException as exc:
                terminal_observation_failed = True
                add_secondary(code, exc)
                return None

        def publish_terminal_failure() -> dict:
            nonlocal published_manifest_binding, terminal_manifest_failed
            failed = make_manifest()
            failed["evidence"]["files"] = provenance.evidence_inventory(
                tier_cap)
            published_manifest_binding = provenance.atomic_write_manifest(
                tier_cap, failed,
                expected_existing=published_manifest_binding)
            provenance.verify_evidence(tier_cap, failed)
            terminal_manifest_failed = True
            return failed

        try:
            if mode == "source":
                try:
                    builder_teardown_result = _read_source_builder_teardown(tier_cap)
                except Exception as exc:
                    builder_teardown_result = TeardownResult(
                        "unknown", "identity_refused", "not_run", False,
                        "source builder receipt reread failed")
                    add_secondary("builder-receipt-read-failed", exc)
                if (not builder_teardown_result.clean
                        or builder_teardown_result.state != "absent"):
                    add_secondary(
                        "builder-receipt-invalid",
                        RuntimeError("terminal source builder receipt is invalid"))
            if container_id is None and container_attempted:
                try:
                    if cidfile.is_file():
                        recovered_id = cidfile.read_text().strip()
                        if re.fullmatch(r"[0-9a-f]{64}", recovered_id):
                            container_id = recovered_id
                            setup_lines.append("phase=container-identity-recovered")
                            setup_log.write_text("\n".join(setup_lines))
                except BaseException as exc:
                    add_secondary("identity-read-failed", exc)
            if container_id is None and container_attempted:
                teardown_result = TeardownResult(
                    "unknown", "identity_refused", "not_run", False)
                print("tier-1 fixture: container publication identity is invalid; "
                      "refusing destructive teardown and preserving mounted inputs")
            else:
                try:
                    teardown_result = _finalize_session(
                        container_id, share, setup_error, share_binding,
                        tier_dir, tier_binding,
                        builder_teardown=(builder_teardown_result
                                          if mode == "source" else None))
                except TeardownError as exc:
                    teardown_result = exc.result
                    add_secondary("teardown-command-failed", exc)
                except BaseException as exc:
                    teardown_result = TeardownResult(
                        "unknown", "launch_error", "not_run", False)
                    add_secondary("teardown-command-failed", exc)
            if _DEFERRED_SIGNAL is not None:
                pending_signal = _DEFERRED_SIGNAL
            if teardown_result.clean:
                try:
                    provenance.remove_owned_directory(
                        workspace_snapshot, workspace_binding,
                        quarantine_parent=tier_dir,
                        quarantine_binding=tier_cap.binding)
                except BaseException as exc:
                    add_secondary("snapshot-cleanup-failed", exc)
            else:
                print(f"tier-1 fixture: preserving repository snapshot at "
                      f"{workspace_snapshot} because teardown is "
                      f"{teardown_result.state}/{teardown_result.remove_outcome}")
            teardown_time = provenance.utc_now()

            # Establish the terminal boundary before recomputing or publishing
            # final state. Keep watched signals blocked through publication and
            # prior-handler restoration so every pre-restoration arrival is
            # folded into durable non-green terminal truth.
            if not terminal_signals_blocked:
                terminal_sigmask(signal.SIG_BLOCK, watched_signals)
                terminal_signals_blocked = True
            redeliver_signal = pending_signal or _DEFERRED_SIGNAL
            terminal_signal = (
                redeliver_signal or observed_kernel_terminal_signal())

            try:
                manifest = make_manifest()
                manifest["evidence"]["files"] = provenance.evidence_inventory(
                    tier_cap)
                # Recompute after inventory because a finalization signal is
                # recorded, not raised, while owned publication is in flight.
                terminal_signal = (
                    terminal_signal or observed_kernel_terminal_signal())
                current = make_manifest()
                current["evidence"]["files"] = manifest["evidence"]["files"]
                published_manifest_binding = provenance.atomic_write_manifest(
                    tier_cap, current)
                terminal_signal = (
                    terminal_signal or observed_kernel_terminal_signal())
                if (terminal_signal is not None
                        and current["run"]["status"] == "passed"):
                    current = publish_terminal_failure()
                elif terminal_signal is not None:
                    terminal_manifest_failed = True
                provenance.verify_evidence(tier_cap, current)
                terminal_signal = (
                    terminal_signal or observed_kernel_terminal_signal())
                if (terminal_signal is not None
                        and current["run"]["status"] == "passed"):
                    current = publish_terminal_failure()
                print(f"tier-1 fixture: evidence={tier_dir}")
            except BaseException as exc:
                publication_error = exc
                add_secondary("publication-failed", exc)
                # An exception after atomic publication may have left stale
                # green evidence. This run owns the unique manifest path; a
                # failed or absent manifest is safer than a green contradiction.
                try:
                    provenance.invalidate_green_manifest(
                        tier_cap, expected=published_manifest_binding)
                except BaseException as invalidation_exc:
                    add_secondary(
                        "publication-invalidation-failed", invalidation_exc)
        finally:
            # Keep the evidence capability and watched mask through the last
            # green-manifest check. This closes the late signal window before
            # every prior handler is restored.
            if not terminal_signals_blocked:
                try:
                    terminal_sigmask(signal.SIG_BLOCK, watched_signals)
                    terminal_signals_blocked = True
                except BaseException as exc:
                    add_secondary("signal-boundary-failed", exc)
            redeliver_signal = (
                redeliver_signal or pending_signal or _DEFERRED_SIGNAL)
            terminal_signal = (
                terminal_signal or redeliver_signal
                or observe_terminal_safely("signal-inspection-failed"))
            if ((terminal_signal is not None or terminal_observation_failed)
                    and not terminal_manifest_failed):
                try:
                    publish_terminal_failure()
                except BaseException as exc:
                    add_secondary("terminal-publication-failed", exc)
                    try:
                        provenance.invalidate_green_manifest(
                            tier_cap, expected=published_manifest_binding)
                    except BaseException as invalidation_exc:
                        add_secondary(
                            "publication-invalidation-failed", invalidation_exc)

            restoration_error = None
            if handlers_owned:
                for watched_signal, previous in previous_handlers.items():
                    try:
                        signal.signal(watched_signal, previous)
                    except BaseException as exc:
                        if restoration_error is None:
                            restoration_error = exc
            if restoration_error is not None:
                add_secondary("handler-restoration-failed", restoration_error)

            # A signal can become pending during handler restoration. It is
            # still part of this fixture's terminal truth and must neutralize
            # any green manifest before the evidence capability is closed.
            terminal_signal = (
                terminal_signal
                or observe_terminal_safely("signal-inspection-failed"))
            if ((terminal_signal is not None or terminal_observation_failed)
                    and not terminal_manifest_failed):
                try:
                    publish_terminal_failure()
                except BaseException as exc:
                    add_secondary("terminal-publication-failed", exc)
                    try:
                        provenance.invalidate_green_manifest(
                            tier_cap, expected=published_manifest_binding)
                    except BaseException as invalidation_exc:
                        add_secondary(
                            "publication-invalidation-failed", invalidation_exc)

            close_error = None
            try:
                try:
                    # Signals consumed by the fixture handler or a bounded
                    # cleanup command need one replay. Signals already
                    # kernel-pending are delivered naturally by exact unmask.
                    if redeliver_signal is not None:
                        os.kill(os.getpid(), redeliver_signal)
                finally:
                    terminal_signals_blocked = False
                    terminal_sigmask(signal.SIG_SETMASK, caller_mask)
            finally:
                try:
                    tier_cap.close()
                except BaseException as exc:
                    close_error = exc
            if close_error is not None:
                add_secondary("capability-close-failed", close_error)

        if terminal_signal is not None:
            raise _FixtureInterrupted(terminal_signal)
        if setup_error is None:
            if secondary_errors:
                raise secondary_errors[0][1]
            if publication_error is not None:
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
