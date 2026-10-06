"""Tier-0 static contracts for the tier-1 driver."""
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DRIVER = REPO / "scripts/test-tier1.sh"
ENV_EXAMPLE = REPO / ".env.example"

IMAGE_ID="sha256:"+"a"*64; CID="c"*64; EXT="/root/.prime/agent/extensions"

def _validator_source():
    match=re.search(r"<<'PYEOF' \|\| true\n(.*?)\nPYEOF",DRIVER.read_text(),re.S)
    if not match: raise AssertionError("probe validator heredoc not found")
    return match.group(1)
def _cmd(name,path): return {"name":name,"sourceInfo":{"path":path}}
GOOD_COMMANDS=[_cmd("handoff",EXT+"/handoff.ts"),_cmd("plan",EXT+"/plan.ts"),_cmd("implement-spec",EXT+"/plan.ts")]
def _reply(commands=None,success=True):
    return json.dumps({"id":"loader","type":"response","command":"get_commands","success":success,"data":{"commands":GOOD_COMMANDS if commands is None else commands}})

class TestDriverStatics(unittest.TestCase):
    def test_contract_is_exact_image_offline_and_no_host_source_mutation(self):
        text=DRIVER.read_text(); self.assertIn('--iidfile "$IIDFILE"',text); self.assertIn('--cidfile "$CIDFILE"',text); self.assertIn('"$IMAGE_ID" sleep infinity',text)
        self.assertNotIn("npm run build",text); self.assertNotIn("pack-prime-agent-release.mjs",text); self.assertNotIn("docker run --rm",text); self.assertNotIn("-e HOME=",text)
        self.assertGreaterEqual(text.count("PRIME_AGENT_PLUGIN_ROOT=$CONTAINER_PLUGIN_ROOT"),2)
        logical_text=text.replace("\\\n", " ")
        for command in ("docker build", "docker image inspect", "docker run -d",
                        "docker network disconnect", "docker exec"):
            self.assertRegex(logical_text,
                             rf"bounded [^\n]{{0,240}}{re.escape(command)}")
        self.assertRegex(logical_text, r'bounded "\$REMOVE_TIMEOUT"[ ]+docker rm -f "\$CONTAINER_ID"')
        self.assertRegex(logical_text, r'bounded "\$FINAL_INSPECT_TIMEOUT"[ ]+docker inspect "\$CONTAINER_ID"')
        self.assertNotIn('> "$TIER_DIR/network.json"', text)
        self.assertRegex(
            logical_text,
            r'write-json[ ]+"\$TIER_DIR"[ ]+"\$TIER_BINDING"[ ]+network\.json')
    def test_env_example_has_both_selectors(self):
        text=ENV_EXAMPLE.read_text(); self.assertIn("PRIME_AGENT_PINNED",text); self.assertIn("PRIME_AGENT_SOURCE",text)


class TestInformationalStatic(unittest.TestCase):
    def test_env_is_gitignored_and_documents_exactly_one(self):
        self.assertIn(".env",[x.strip() for x in (REPO/".gitignore").read_text().splitlines()])
        self.assertRegex(ENV_EXAMPLE.read_text(),re.compile(r"exactly one",re.I))

class TestProbeValidator(unittest.TestCase):
    def setUp(self): self.td=tempfile.TemporaryDirectory(); self.tmp=Path(self.td.name); self.validator=self.tmp/"validate.py"; self.validator.write_text(_validator_source())
    def tearDown(self): self.td.cleanup()
    def check(self,text):
        f=self.tmp/"reply.jsonl"; f.write_text(text); return subprocess.run([sys.executable,str(self.validator),str(f)],capture_output=True,text=True)
    def test_valid_reply(self): self.assertEqual(self.check(_reply()+"\n").returncode,0)
    def test_invalid_replies(self):
        cases=("", "not-json\n", _reply()+"\n"+_reply()+"\n",
               _reply([_cmd("handoff","/host/x.ts")]+GOOD_COMMANDS[1:])+"\n",
               _reply([],success=True)+"\n", _reply(success=False)+"\n")
        for case in cases: self.assertNotEqual(self.check(case).returncode,0)
    def test_async_events_are_ignored_but_cannot_satisfy_probe(self):
        event='{"type":"event","name":"session_start"}\n'
        self.assertEqual(self.check(event+_reply()+"\n").returncode,0)
        self.assertNotEqual(self.check(event).returncode,0)
    def test_duplicate_required_command_rejected(self):
        self.assertNotEqual(self.check(_reply(GOOD_COMMANDS+[GOOD_COMMANDS[0]])+"\n").returncode,0)
