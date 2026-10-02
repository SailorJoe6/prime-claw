#!/usr/bin/env python3
"""In-container fake prime-agent daemon for tier-1 tests.

Speaks the daemon JSONL protocol (protocol prime-agent.daemon version 7,
schema revision 28) over a Unix socket. This is the union of the two
host-side test fakes (PublicationFakeDaemon and the native-discovery
FakeDaemon), which cannot run on the host for containerized prime-agent:
a guest cannot connect to a host-bound Unix socket through the macOS
virtiofs bind mount (proven: connect(2) fails with EOPNOTSUPP). The
socket therefore lives at a container-local path and both peers run in
the same container kernel.

Every received envelope is appended to <log-dir>/envelopes.jsonl and every
response to <log-dir>/responses.jsonl ({"id": ..., "data": ...} lines) so
the host-side test can reconstruct and assert the exact exchange. The log
dir is a same-path bind-mounted share, so the host reads the files at the
identical absolute path.

Runs until SIGTERM/SIGINT. Writes its pid to --pidfile after listen() so
the host fixture can stop it with a plain kill.
"""

import argparse
import json
import os
import socket
import sys

HELLO = {
    "type": "daemon_hello",
    "protocol": {"name": "prime-agent.daemon", "version": 7},
    "schema": {"revision": 28},
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--socket", required=True)
    parser.add_argument("--route", required=True)
    parser.add_argument("--log-dir", required=True)
    parser.add_argument("--pidfile", required=True)
    args = parser.parse_args()

    os.makedirs(args.log_dir, exist_ok=True)
    envelopes_log = os.path.join(args.log_dir, "envelopes.jsonl")
    responses_log = os.path.join(args.log_dir, "responses.jsonl")

    try:
        os.unlink(args.socket)
    except FileNotFoundError:
        pass
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(args.socket)
    server.listen()

    with open(args.pidfile, "w", encoding="utf-8") as fh:
        fh.write(str(os.getpid()))

    # Last created session, for get_state (publication flavor).
    created = {}

    def handle(conn) -> None:
        conn.sendall((json.dumps(HELLO) + "\n").encode())
        buffer = b""
        while True:
            try:
                data = conn.recv(65536)
            except OSError:
                return
            if not data:
                return
            buffer += data
            while b"\n" in buffer:
                line, buffer = buffer.split(b"\n", 1)
                if not line:
                    continue
                envelope = json.loads(line.decode())
                with open(envelopes_log, "a", encoding="utf-8") as fh:
                    fh.write(json.dumps(envelope) + "\n")
                command = envelope.get("command", {})
                command_type = command.get("type")
                if command_type == "ack_result":
                    continue
                if command_type == "list":
                    payload = {"sessions": []}
                elif command_type == "create":
                    with open(command["sessionPath"], "r", encoding="utf-8") as fh:
                        header = json.loads(fh.read().splitlines()[0])
                    payload = {
                        "activeSessionId": args.route,
                        "sessionId": header["id"],
                        "sessionFile": command["sessionPath"],
                        "sessionName": command["name"],
                        "cwd": command["config"]["cwd"],
                        "isSessionActive": True,
                    }
                    created.update(payload)
                elif command_type == "get_state":
                    payload = {
                        "activeSessionId": args.route,
                        "sessionId": created.get("sessionId"),
                        "sessionFile": created.get("sessionFile"),
                        "sessionName": created.get("sessionName"),
                        "cwd": created.get("cwd"),
                    }
                elif command_type == "get_messages":
                    payload = {"messages": [{
                        "role": "toolResult", "toolCallId": "call-real",
                    }]}
                elif command_type in {"prompt", "kill"}:
                    payload = {"ok": True}
                else:
                    payload = {}
                with open(responses_log, "a", encoding="utf-8") as fh:
                    fh.write(json.dumps({"id": envelope["id"], "data": payload}) + "\n")
                conn.sendall((json.dumps({
                    "type": "response", "id": envelope["id"],
                    "success": True, "data": payload,
                }) + "\n").encode())

    while True:
        try:
            conn, _ = server.accept()
        except OSError:
            return
        with conn:
            handle(conn)


if __name__ == "__main__":
    sys.exit(main())
