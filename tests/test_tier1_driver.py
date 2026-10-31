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
def _cmd(name, path, source="extension"):
    return {"name": name, "source": source, "sourceInfo": {"path": path}}

ENTRY_SKILLS = ("plan", "plan-spec", "implement-task", "implement-spec", "handoff")
GOOD_COMMANDS = [
    _cmd("skill:" + name, "/root/.prime/agent/skills/" + name + "/SKILL.md", "skill")
    for name in ENTRY_SKILLS
]
GOOD_TOOLS = [
    "plan_task", "plan_spec", "implement_task", "implement_spec", "ralph_handoff",
    "create_task_episode", "handoff_task_episode", "finalize_task_episode",
    "create_spec_episode", "handoff_spec_episode", "finalize_spec_episode",
    "restore_blocked_spec_episode", "transition_spec_episode_to_task",
]
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
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.tmp = Path(self.td.name)
        self.validator = self.tmp / "validate.py"
        self.validator.write_text(_validator_source())

    def tearDown(self):
        self.td.cleanup()

    def check(self, text, tools=None):
        reply = self.tmp / "reply.jsonl"
        reply.write_text(text)
        snapshot = self.tmp / "tools.json"
        snapshot.write_text(json.dumps(GOOD_TOOLS if tools is None else tools))
        return subprocess.run(
            [sys.executable, str(self.validator), str(reply), str(snapshot)],
            capture_output=True, text=True,
        )

    def test_valid_native_skill_and_tool_discovery(self):
        result = self.check(_reply() + "\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("five custom commands absent", result.stdout)
        self.assertIn("no built-in shadowing", result.stdout)

    def test_invalid_replies(self):
        cases = (
            "", "not-json\n", _reply() + "\n" + _reply() + "\n",
            _reply([_cmd("skill:plan", "/host/SKILL.md", "skill")] + GOOD_COMMANDS[1:]) + "\n",
            _reply([], success=True) + "\n", _reply(success=False) + "\n",
        )
        for case in cases:
            with self.subTest(case=case):
                self.assertNotEqual(self.check(case).returncode, 0)

    def test_each_removed_command_and_missing_entry_is_rejected(self):
        for index, name in enumerate(ENTRY_SKILLS):
            with self.subTest(command=name):
                commands = GOOD_COMMANDS + [_cmd(name, EXT + "/reviewed-plan.ts")]
                self.assertNotEqual(self.check(_reply(commands)).returncode, 0)
                commands = GOOD_COMMANDS[:index] + GOOD_COMMANDS[index + 1:]
                self.assertNotEqual(self.check(_reply(commands)).returncode, 0)

    def test_missing_or_duplicate_replacement_and_lifecycle_tools_are_rejected(self):
        for name in GOOD_TOOLS:
            with self.subTest(tool=name):
                tools = [tool for tool in GOOD_TOOLS if tool != name]
                self.assertNotEqual(self.check(_reply(), tools).returncode, 0)
                self.assertNotEqual(self.check(_reply(), GOOD_TOOLS + [name]).returncode, 0)
        self.assertNotEqual(self.check(_reply(), {"tools": GOOD_TOOLS}).returncode, 0)

    def test_async_events_are_ignored_but_cannot_satisfy_probe(self):
        event = '{"type":"event","name":"session_start"}\n'
        self.assertEqual(self.check(event + _reply() + "\n").returncode, 0)
        self.assertNotEqual(self.check(event).returncode, 0)

    def test_duplicate_required_skill_is_rejected(self):
        commands = GOOD_COMMANDS + [GOOD_COMMANDS[0]]
        self.assertNotEqual(self.check(_reply(commands) + "\n").returncode, 0)

    def test_native_skill_source_and_builtin_nonshadowing_controls(self):
        # get_commands does not enumerate built-ins. Do not invent such a reply.
        # Preserve an unrelated native skill and prompt while refusing extension
        # names that would shadow representative built-ins.
        controls = [_cmd("skill:control", "/tmp/control/SKILL.md", "skill"),
                    _cmd("control-prompt", "/tmp/control.md", "prompt")]
        self.assertEqual(self.check(_reply(GOOD_COMMANDS + controls)).returncode, 0)
        for name in ("compact", "goal", "refine", "reload", "settings"):
            with self.subTest(builtin=name):
                commands = GOOD_COMMANDS + [_cmd(name, EXT + "/shadow.ts")]
                self.assertNotEqual(self.check(_reply(commands)).returncode, 0)

    def test_probe_uses_supported_isolated_discovery_interfaces(self):
        source = DRIVER.read_text()
        self.assertIn("pi.getAllTools()", source)
        self.assertIn("/workspace/scripts/run-prime-agent-probe.sh prime-agent", source)
        for name in ENTRY_SKILLS:
            self.assertIn("--skill /root/.prime/agent/skills/" + name + "/SKILL.md", source)
        self.assertIn("NOT Prime Agent built-ins", source)
