"""Focused isolation regression for real Docker network-list framing."""
from __future__ import annotations

import unittest

from scripts.testing import bounded


class TestNetworkListPolicy(unittest.TestCase):
    def result(self, stdout: bytes) -> bounded.BoundedResult:
        return bounded.BoundedResult(
            ["docker", "inspect"], 0, stdout, b"", "exited", None)

    def test_accepts_docker_template_plus_cli_trailing_newline(self):
        filtered = bounded._policy_output(
            "network-list", self.result(b"bridge\nowned.network\n\n"))
        self.assertEqual(filtered, b"bridge\nowned.network\n")

    def test_empty_network_set_with_cli_newline_is_empty(self):
        self.assertEqual(
            bounded._policy_output("network-list", self.result(b"\n")), b"")

    def test_internal_empty_or_unsafe_name_remains_rejected(self):
        for output in (b"bridge\n\nowned\n", b"bridge\nprivate endpoint\n"):
            with self.subTest(output=output), self.assertRaises(ValueError):
                bounded._policy_output("network-list", self.result(output))


if __name__ == "__main__":
    unittest.main()
