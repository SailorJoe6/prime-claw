"""Offline versioned root-link bootstrap safety and rerun tests."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[1] / "scripts" / "bootstrap-v2-root-links.py"
spec = importlib.util.spec_from_file_location("bootstrap_v2_root_links", MODULE)
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)


class RootLinksTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "sandbox"
        home = self.root / "home-root"
        home.mkdir(parents=True)
        for name in bootstrap.STATE_NAMES:
            path = home / name
            if name in ("AGENTS.md", ".pc-ver.sh", "pg.log"):
                path.write_text("retained\n")
            else:
                path.mkdir()
                (path / "content").write_text("retained\n")
        for name in bootstrap.RETAINED_IMAGE_DIRS:
            (home / name).mkdir()
            (home / name / "original").write_text("v1\n")
            (self.root / name).mkdir()
            (self.root / name / "new").write_text("v2\n")

    def test_links_mounted_state_without_replacing_image_dirs(self):
        self.assertEqual(bootstrap.bootstrap(self.root), len(bootstrap.STATE_NAMES))
        for name in bootstrap.STATE_NAMES:
            self.assertTrue((self.root / name).is_symlink())
            self.assertEqual((self.root / name).readlink(), Path("home-root") / name)
        for name in bootstrap.RETAINED_IMAGE_DIRS:
            self.assertFalse((self.root / name).is_symlink())
            self.assertTrue((self.root / name / "new").is_file())
            self.assertTrue((self.root / "home-root" / name / "original").is_file())
        self.assertEqual(bootstrap.bootstrap(self.root), 0)

    def test_wrong_link_fails_before_any_other_link(self):
        (self.root / "AGENTS.md").symlink_to("wrong")
        with self.assertRaisesRegex(ValueError, "wrong existing link"):
            bootstrap.bootstrap(self.root)
        self.assertFalse((self.root / ".prime").is_symlink())

    def test_changed_image_directory_remains_active(self):
        (self.root / ".uv" / "extra").write_text("v2 write")
        self.assertEqual(bootstrap.bootstrap(self.root), len(bootstrap.STATE_NAMES))
        self.assertTrue((self.root / ".uv" / "extra").is_file())

    def test_root_collision_fails_closed(self):
        (self.root / ".prime").mkdir()
        with self.assertRaisesRegex(ValueError, "unexpected root collision"):
            bootstrap.bootstrap(self.root)
        self.assertFalse((self.root / "AGENTS.md").is_symlink())

    def test_missing_state_or_image_copy_fails_before_mutation(self):
        (self.root / "home-root" / "AGENTS.md").unlink()
        with self.assertRaisesRegex(ValueError, "required mounted state missing"):
            bootstrap.bootstrap(self.root)
        (self.root / "home-root" / "AGENTS.md").write_text("retained")
        (self.root / "home-root" / ".venv").rename(self.root / "home-root" / ".venv-missing")
        with self.assertRaisesRegex(ValueError, "image environment or retained copy missing"):
            bootstrap.bootstrap(self.root)
        self.assertFalse((self.root / ".prime").is_symlink())


if __name__ == "__main__":
    unittest.main()
