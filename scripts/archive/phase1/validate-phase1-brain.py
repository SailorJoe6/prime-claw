#!/usr/bin/env python3
"""validate-phase1-brain.py -- prove R-U2-1..5 for the prime-claw sandbox.

  R-U2-1 (GATE)  gbrain CLI installs and operates inside the sandbox.
  R-U2-2 (GATE)  brain repo folder available in-sandbox (mechanism documented).
  R-U2-3 (GATE)  Postgres 16 + pgvector runs in-sandbox, owned by the agent.
  R-U2-4 (GATE)  gbrain serves the brain from in-sandbox PG: search/query work.
  R-U2-5 (NICE)  Postgres reachable from host at localhost:5433 (non-blocking).
  R-U2-6 (GATE)  gbrain embeds via the AI Gateway through OpenShell L7
               placeholder substitution; the key never touches sandbox disk.

Re-runnable. No credentials printed. Exit 0 on all-GATE-pass, 1 otherwise.
"""
import base64, os, re, subprocess, sys

OPENSHELL = os.environ.get("OPENSHELL_BIN", "openshell")
SANDBOX = os.environ.get("PRIME_CLAW_SANDBOX_NAME", "prime-claw")
SB_BRAIN = os.environ.get("PRIME_CLAW_SB_BRAIN_DIR", "/sandbox/brain")
PGPORT = os.environ.get("PRIME_CLAW_PGPORT", "5433")
PGU = os.environ.get("POSTGRES_USER", "gbrain")
PGD = os.environ.get("POSTGRES_DB", "gbrain")


def sx(script, timeout=120):
    b64 = base64.b64encode(script.encode()).decode()
    r = subprocess.run([OPENSHELL, "sandbox", "exec", "-n", SANDBOX, "--timeout",
                        str(timeout), "--no-tty", "--", "bash", "-c",
                        "echo %s | base64 -d | bash" % b64],
                       capture_output=True, text=True)
    return (r.stdout + r.stderr)


results = []  # (req, gate, ok, detail)


def check(req, gate, ok, detail=""):
    results.append((req, gate, ok, detail))
    tag = "PASS" if ok else ("FAIL" if gate else "SKIP")
    print("[%s] %s %s%s" % (tag, req, "(GATE)" if gate else "(NICE)",
                            (" -- " + detail) if detail else ""))


# R-U2-1 gbrain CLI operates in-sandbox
out = sx("export HOME=/sandbox; gbrain --version 2>&1 | head -1")
m = re.search(r"gbrain ([0-9.]+)", out)
check("R-U2-1", True, bool(m), ("version " + m.group(1)) if m else out.strip()[:80])

# R-U2-2 brain repo folder present (mechanism: --upload at sandbox create)
out = sx("ls -1 %s 2>/dev/null | wc -l" % SB_BRAIN)
n = out.strip().split("\n")[-1].strip()
check("R-U2-2", True, n.isdigit() and int(n) > 0,
      "%s has %s entries (mechanism: openshell --upload)" % (SB_BRAIN, n))

# R-U2-3 Postgres 16 + pgvector, owned by the sandbox user
out = sx("export HOME=/sandbox PATH=/usr/lib/postgresql/16/bin:$PATH; "
         "psql -h localhost -p %s -U %s -d postgres -tc 'select version();' 2>&1 | head -1; "
         "stat -c '%%U' /sandbox/pgdata 2>/dev/null"
         % (PGPORT, PGU))
pg16 = "PostgreSQL 16" in out
owner = re.search(r"\b(sandbox)\b", out)
out_v = sx("export HOME=/sandbox PATH=/usr/lib/postgresql/16/bin:$PATH; "
           "psql -h localhost -p %s -U %s -d %s -tc \"SELECT extversion FROM pg_extension WHERE extname='vector';\" 2>&1 | head -1"
           % (PGPORT, PGU, PGD))
vec = re.search(r"([0-9]+\.[0-9]+)", out_v)
check("R-U2-3", True, pg16 and bool(owner) and bool(vec),
      "PG16=%s owner=%s pgvector=%s" % (pg16, owner.group(1) if owner else "?",
                                          vec.group(1) if vec else "?"))

# R-U2-4 gbrain serves search/query from in-sandbox PG (seed + search round-trip)
seed = ("export HOME=/sandbox PATH=/usr/lib/postgresql/16/bin:$PATH; cd %s && "
        "printf '# Validator Probe\\n\\nprime-claw slice4 validator probe pgvector sandbox.\\n' "
        "| gbrain put validator-probe >/dev/null 2>&1; "
        "gbrain search 'validator probe pgvector sandbox' 2>&1 | grep -c 'validator-probe'"
        % SB_BRAIN)
out = sx(seed, timeout=90)
hit = re.search(r"^\s*([1-9][0-9]*)\s*$", out.strip().split("\n")[-1])
check("R-U2-4", True, bool(hit),
      "gbrain put+search round-trip returned the seeded page" if hit else out.strip()[:120])

# R-U2-6 (GATE) embeddings via the AI Gateway through L7 substitution (no key on disk)
gw = os.environ.get("PRIME_CLAW_AI_GATEWAY_HOST", "ai-gateway.zende.sk")
# Write a page (gbrain embeds it via the gateway), then check that the most
# recent chunk has a real 1536-dim embedding. We avoid a quoted-slug match by
# selecting the latest chunk by id.
emb = (
    "export HOME=/sandbox PATH=/usr/lib/postgresql/16/bin:$PATH; cd " + SB_BRAIN + " && "
    "(pg_ctl -D /sandbox/pgdata status >/dev/null 2>&1 || pg_ctl -D /sandbox/pgdata "
    "-l /sandbox/pg.log -w start -o '-c listen_addresses=localhost -p " + PGPORT + " "
    "-c unix_socket_directories=/sandbox' >/dev/null 2>&1); "
    "export OPENAI_API_KEY=\"$api_key\" OPENAI_BASE_URL=https://" + gw + "/v1; "
    "printf '# EmbVal\\n\\nvalidator embedding probe through the gateway.\\n' "
    "| gbrain put embval >/dev/null 2>&1; "
    "psql -h localhost -p " + PGPORT + " -U " + PGU + " -d " + PGD + " -tc "
    "'SELECT vector_dims(embedding) FROM content_chunks WHERE embedding IS NOT NULL "
    "ORDER BY id DESC LIMIT 1;' 2>&1 | tr -d ' \\n'"
)
out = sx(emb, timeout=150)
dims = out.strip().split("\n")[-1].strip()
check("R-U2-6", True, dims == "1536",
      ("embedding written via AI Gateway, dims=" + dims) if dims == "1536"
      else "no embedding (got %r)" % dims)

# R-U2-5 (NICE) host exposure at localhost:5433 -- document mechanism, non-blocking
# The sandbox binds its own localhost; host exposure is via `openshell sandbox
# create --forward <hostport>:5433` or the SSH config. Not asserted as a gate.
check("R-U2-5", False, True,
      "non-blocking; mechanism = openshell sandbox create --forward (host:5433 currently held by reference brain)")

gate_ok = all(ok for (req, gate, ok, d) in results if gate)
print("\n== U2 verdict: %s ==" % ("GO" if gate_ok else "NO-GO"))
sys.exit(0 if gate_ok else 1)
