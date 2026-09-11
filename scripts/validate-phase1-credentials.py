#!/usr/bin/env python3
"""validate-phase1-credentials.py -- prove R-U1-6 for the prime-claw sandbox.

Acceptance (the GATE track, D12/D13): the sandboxed prime-agent runs on the
operator's host-instance credentials via the OpenShell provider/placeholder
model against the AI Gateway.

  (a) the sandboxed agent's env holds opaque placeholders only (no real key);
  (b) the sandboxed prime-agent makes a REAL model call through the proxy
      (default anthropic.kimi-k3 via the gateway) using an env-bridged
      placeholder -- no auth.json on disk;
  (c) no credential material exists on sandbox disk;
  (d) fail-closed: an unresolvable placeholder does NOT reach the provider
      (HTTP 5xx from the proxy, not a forwarded real key).

Re-runnable (R-X-1). No credential values are printed or written (R-X-5).
Exit 0 on all-pass, 1 on any failure.
"""
import base64, os, re, subprocess, sys

OPENSHELL = os.environ.get("OPENSHELL_BIN", "openshell")
SANDBOX = os.environ.get("PRIME_CLAW_SANDBOX_NAME", "prime-claw")
GATEWAY_HOST = os.environ.get("PRIME_CLAW_AI_GATEWAY_HOST", "ai-gateway.zende.sk")
MODEL = os.environ.get("PRIME_CLAW_MODEL", "anthropic.kimi-k3")
KEY_PREFIX = os.environ.get("PRIME_CLAW_KEY_PREFIX", "zdai_")
GW_PROVIDER = os.environ.get("PRIME_CLAW_AI_GATEWAY_PROVIDER", "prime-claw-ai-gateway")


def run(script, timeout=120):
    b64 = base64.b64encode(script.encode()).decode()
    r = subprocess.run(
        [OPENSHELL, "sandbox", "exec", "-n", SANDBOX, "--timeout", str(timeout),
         "--no-tty", "--", "bash", "-c", "echo %s | base64 -d | bash" % b64],
        capture_output=True, text=True)
    return (r.stdout + r.stderr)


def redact(s):
    s = re.sub(r"(openshell:resolve:env:v[0-9]+_)[A-Za-z0-9_]+", r"\1<ph>", s)
    s = re.sub(r"(zdai_[A-Za-z0-9_-]{4})[A-Za-z0-9_-]+", r"\1<redacted>", s)
    return s


results = []


def check(name, ok, detail=""):
    results.append(ok)
    print("[%s] %s%s" % ("PASS" if ok else "FAIL", name,
                         (" -- " + detail) if detail else ""))


# precondition: gateway provider attached
prov = subprocess.run([OPENSHELL, "sandbox", "provider", "list", SANDBOX],
                      capture_output=True, text=True).stdout
check("precondition: gateway provider attached", GW_PROVIDER in prov, GW_PROVIDER)

# (a) placeholders-only env
out = redact(run('env | grep -iE "api_key|token" || true'))
check("(a) env holds opaque placeholder", "openshell:resolve:env:" in out)
real_in_env = run('env | grep -oE "%s[A-Za-z0-9_-]+" || true' % KEY_PREFIX).strip()
check("(a) no real credential value in env", real_in_env == "")

# (b) real model call by the sandboxed prime-agent
bcall = (
    "export HOME=/sandbox PATH=/sandbox/.npm-global/bin:$PATH "
    "NODE_OPTIONS=\"--require /sandbox/.prime-claw/npm-onload.js\"\n"
    "export ANTHROPIC_API_KEY=\"$api_key\"\n"
    "prime-agent -p --no-tools --no-session \"Reply with exactly: AGENT_OK\" "
    "2>&1 | grep -viE \"undici|trace-warnings\"\n"
)
outb = run(bcall, timeout=150)
check("(b) sandboxed prime-agent real model call", "AGENT_OK" in outb,
      "model=%s via %s" % (MODEL, GATEWAY_HOST))

# (c) no credential material on sandbox disk
outc = run('grep -rIlE "%s" /sandbox 2>/dev/null || true' % KEY_PREFIX, timeout=60)
check("(c) no credential material on sandbox disk", outc.strip() == "",
      "no files" if outc.strip() == "" else "FOUND: " + outc.strip()[:80])

# (d) fail-closed on unresolvable placeholder
dcall = ('curl -sS -o /dev/null -w "%%{http_code}" --max-time 20 '
         'https://%s/anthropic/v1/models -H "x-api-key: openshell:resolve:env:definitely_not_a_real_key" 2>&1'
         % GATEWAY_HOST)
outd = run(dcall, timeout=60)
m = re.search(r"(\d{3})", outd)
code = m.group(1) if m else outd.strip()
check("(d) fail-closed on unresolvable placeholder", code.startswith("5"),
      "HTTP %s (proxy refused; real key not forwarded)" % code)

ok = all(results)
print("\n== R-U1-6 verdict: %s ==" % ("PASS" if ok else "FAIL"))
sys.exit(0 if ok else 1)
