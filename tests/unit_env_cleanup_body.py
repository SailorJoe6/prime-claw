"""Unit-env body: real Git worktree, Unix socket, and state cleanup."""

from unit_env_entry import require_unit_env
require_unit_env()

import json
import os
import shutil
import socket
import subprocess
import threading
import time
from pathlib import Path

FAKE_ROUTE = "active-episode"

def git(cwd, *args):
    return subprocess.run(
        ["git", "-C", str(cwd), *args], check=True, text=True, capture_output=True,
    ).stdout.strip()


class FakeDaemon:
    def __init__(self, path):
        self.path = path
        self.envelopes = []
        self.responses = {}
        self.stop = False
        self.closed = False
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.bind(str(path))
        self.sock.listen()
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()

    @property
    def commands(self):
        return [envelope["command"] for envelope in self.envelopes]

    def run(self):
        while not self.stop:
            try:
                self.sock.settimeout(0.2)
                conn, _ = self.sock.accept()
            except (TimeoutError, socket.timeout, OSError):
                continue
            with conn:
                conn.sendall((json.dumps({
                    "type": "daemon_hello",
                    "protocol": {"name": "prime-agent.daemon", "version": 7},
                    "schema": {"revision": 28},
                }) + "\n").encode())
                buffer = b""
                while not self.stop:
                    try:
                        data = conn.recv(65536)
                    except OSError:
                        break
                    if not data:
                        break
                    buffer += data
                    while b"\n" in buffer:
                        line, buffer = buffer.split(b"\n", 1)
                        if not line:
                            continue
                        envelope = json.loads(line)
                        command = envelope.get("command", {})
                        self.envelopes.append(envelope)
                        command_type = command.get("type")
                        if command_type == "ack_result":
                            continue
                        if command_type == "list":
                            payload = {"sessions": []}
                        elif command_type == "create":
                            header = json.loads(
                                Path(command["sessionPath"]).read_text().splitlines()[0]
                            )
                            payload = {
                                "activeSessionId": FAKE_ROUTE,
                                "sessionId": header["id"],
                                "sessionFile": command["sessionPath"],
                                "sessionName": command["name"],
                                "cwd": command["config"]["cwd"],
                                "isSessionActive": True,
                            }
                        elif command_type in {"prompt", "kill"}:
                            payload = {"ok": True}
                        else:
                            payload = {}
                        self.responses[envelope["id"]] = payload
                        conn.sendall((json.dumps({
                            "type": "response", "id": envelope["id"],
                            "success": True, "data": payload,
                        }) + "\n").encode())

    def close(self):
        if self.closed:
            return
        self.closed = True
        self.stop = True
        try:
            self.sock.close()
        except OSError:
            pass
        self.thread.join(2)
        self.path.unlink(missing_ok=True)


def cleanup_episode(project, worktree, branch, daemon, socket_path, *fixture_paths):
    try:
        if project.exists() and worktree is not None and worktree.exists():
            subprocess.run(
                ["git", "-C", str(project), "worktree", "remove", "--force", str(worktree)],
                text=True, capture_output=True, check=False,
            )
        if project.exists() and branch:
            subprocess.run(
                ["git", "-C", str(project), "branch", "-D", branch],
                text=True, capture_output=True, check=False,
            )
    finally:
        try:
            daemon.close()
        finally:
            socket_path.unlink(missing_ok=True)
            for path in fixture_paths:
                if path.is_dir() and not path.is_symlink():
                    shutil.rmtree(path, ignore_errors=True)
                else:
                    path.unlink(missing_ok=True)


def test_registered_cleanup_survives_intentional_post_creation_assertion(tmp_path):
    project = tmp_path / "cleanup-project"
    project.mkdir()
    git(project, "init", "-q")
    git(project, "config", "user.email", "poc@example.invalid")
    git(project, "config", "user.name", "POC")
    (project / "README.md").write_text("fixture")
    git(project, "add", ".")
    git(project, "commit", "-qm", "fixture")
    worktree = tmp_path / "cleanup-worktree"
    branch = "episode/cleanup-proof"
    lifecycle_state = tmp_path / "cleanup-lifecycle-state"
    session_state = tmp_path / "cleanup-sessions"
    socket_path = Path(f"/tmp/pc-cleanup-{os.getpid()}-{time.time_ns()}.sock")
    daemon = FakeDaemon(socket_path)
    failed = False
    try:
        git(project, "worktree", "add", "-q", "-b", branch, str(worktree), "HEAD")
        lifecycle_state.mkdir()
        (lifecycle_state / "identity.json").write_text("created")
        session_state.mkdir()
        (session_state / "episode.jsonl").write_text("created")
        assert False, "intentional post-creation failure"
    except AssertionError as error:
        failed = "intentional post-creation failure" in str(error)
    finally:
        cleanup_episode(
            project, worktree, branch, daemon, socket_path,
            lifecycle_state, session_state,
        )
    assert failed is True
    assert not worktree.exists()
    assert git(project, "branch", "--list", branch) == ""
    assert not socket_path.exists()
    assert not lifecycle_state.exists()
    assert not session_state.exists()
