"""Tier-1 bridges for environment-dependent unit-env bodies.

The body filenames are intentionally non-default. Host pytest can collect only
these bridges; each body runs through ``tier1_container`` after the fixture has
proved the disposable container has no network and has installed its toolchain.
"""

from pathlib import Path


BODY_GROUPS = {
    "watchdog": ("tests/unit_env_watchdog_body.py",),
    "npm_onload": ("tests/unit_env_npm_onload_body.py",),
    "launcher_meta": (
        "tests/unit_env_tier1_driver_body.py",
        "tests/unit_env_tier1_launch_error_body.py",
        "tests/unit_env_tier1_fixture_body.py",
        "tests/unit_env_tier1_image_body.py",
    ),
    "cleanup": ("tests/unit_env_cleanup_body.py",),
    "probe_wrapper": ("tests/unit_env_probe_wrapper_body.py",),
}


def _run_body(tier1_container, *paths: str) -> None:
    result = tier1_container.run(
        "python3", "-m", "pytest", "-q", "-p", "no:cacheprovider", *paths,
        timeout=420, workdir=tier1_container.ws,
        env={"HOME": "/tmp/prime-claw-unit-env-home",
             "PRIME_CLAW_UNIT_ENV_BODY": "1"},
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_posix_watchdog_unit_env(tier1_container):
    _run_body(tier1_container, *BODY_GROUPS["watchdog"])


def test_npm_onload_unit_env(tier1_container):
    _run_body(tier1_container, *BODY_GROUPS["npm_onload"])


def test_launcher_meta_unit_env(tier1_container):
    _run_body(tier1_container, *BODY_GROUPS["launcher_meta"])


def test_git_worktree_socket_cleanup_unit_env(tier1_container):
    _run_body(tier1_container, *BODY_GROUPS["cleanup"])


def test_probe_wrapper_unit_env(tier1_container):
    _run_body(tier1_container, *BODY_GROUPS["probe_wrapper"])
