import hashlib
import io
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
import warnings
from zipfile import ZipFile, ZipInfo

from ops import deploy_receiver as receiver


COMMIT = "a" * 40


def package_bytes(files, *, commit=COMMIT, hashes=None, symlinks=()):
    """Build a release ZIP with a manifest describing the supplied files."""
    hashes = hashes or {name: hashlib.sha256(data).hexdigest()
                        for name, data in files.items()}
    payload = io.BytesIO()
    with ZipFile(payload, "w") as archive:
        for name, data in files.items():
            info = ZipInfo(name)
            if name in symlinks:
                info.create_system = 3
                info.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(info, data)
        archive.writestr(receiver.MANIFEST, json.dumps({
            "commit": commit, "files": hashes,
        }))
    return payload.getvalue()


class ReadPackageTests(unittest.TestCase):
    def assert_rejected(self, payload):
        with self.assertRaises((ValueError, OSError)):
            receiver.read_package(payload)

    def test_rejects_protected_paths_case_insensitively(self):
        for name in (
            "WP old website/index.html",
            "wp OLD WEBSITE/index.html",
            "Wp Old Website/assets/site.css",
            ".well-known/security.txt",
            ".WELL-KNOWN/security.txt",
        ):
            with self.subTest(name=name):
                self.assert_rejected(package_bytes({"index.html": b"home", name: b"x"}))

    def test_rejects_traversal_paths(self):
        for name in ("../index.html", "assets/../index.html", "assets/./index.html"):
            with self.subTest(name=name):
                self.assert_rejected(package_bytes({"index.html": b"home", name: b"x"}))

    def test_rejects_symlink_archive_entries(self):
        self.assert_rejected(package_bytes(
            {"index.html": b"home", "assets/link.css": b"target"},
            symlinks={"assets/link.css"},
        ))

    def test_rejects_duplicate_archive_entries(self):
        payload = io.BytesIO()
        manifest = json.dumps({
            "commit": COMMIT,
            "files": {"index.html": hashlib.sha256(b"home").hexdigest()},
        })
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with ZipFile(payload, "w") as archive:
                archive.writestr("index.html", b"home")
                archive.writestr("index.html", b"other")
                archive.writestr(receiver.MANIFEST, manifest)
        self.assert_rejected(payload.getvalue())

    def test_rejects_manifest_checksum_mismatch(self):
        self.assert_rejected(package_bytes(
            {"index.html": b"home"},
            hashes={"index.html": "0" * 64},
        ))


class SafeTargetTests(unittest.TestCase):
    def test_refuses_destination_symlink(self):
        with tempfile.TemporaryDirectory(dir=Path.cwd()) as temp:
            root = Path(temp)
            outside = root / "outside.css"
            outside.write_text("untouched")
            (root / "assets").mkdir()
            link = root / "assets" / "site.css"
            try:
                link.symlink_to(outside)
            except (OSError, NotImplementedError) as error:
                self.skipTest("symlinks are unavailable: " + str(error))
            with self.assertRaises(ValueError):
                receiver.safe_target(root, "assets/site.css")


@unittest.skipUnless(os.name == "posix", "publish integration requires POSIX flock")
class PublishIntegrationTests(unittest.TestCase):
    def test_publish_preserves_protected_and_unknown_files_and_is_repeatable(self):
        with tempfile.TemporaryDirectory(dir=Path.cwd()) as temp:
            base = Path(temp)
            root, state = base / "public_html", base / "state"
            root.mkdir()
            for protected in receiver.PROTECTED:
                directory = root / protected
                directory.mkdir()
                (directory / "sentinel.txt").write_text(protected + " sentinel")
            (root / "unmanaged.txt").write_text("keep me")
            (root / "assets").mkdir()
            (root / "assets" / "old-hash.css").write_text("old cached asset")

            files = {
                "index.html": b"<!doctype html><h1>new homepage</h1>",
                "assets/site-123.css": b"body{color:navy}",
                "assets/app-456.js": b"document.body.dataset.ready='yes';",
            }
            meta = {"commit": COMMIT}
            protected_before = receiver.protected_snapshot(root)

            first = receiver.publish(meta, files, root=root, state=state)
            second = receiver.publish(meta, files, root=root, state=state)

            self.assertTrue(first["protected_unchanged"])
            self.assertTrue(second["protected_unchanged"])
            self.assertEqual(first["protected_before"], first["protected_after"])
            self.assertEqual(second["protected_before"], second["protected_after"])
            self.assertEqual(receiver.protected_snapshot(root), protected_before)
            for protected in receiver.PROTECTED:
                self.assertEqual((root / protected / "sentinel.txt").read_text(),
                                 protected + " sentinel")
            self.assertEqual((root / "unmanaged.txt").read_text(), "keep me")
            self.assertEqual((root / "assets" / "old-hash.css").read_text(),
                             "old cached asset")
            for name, content in files.items():
                self.assertEqual((root / name).read_bytes(), content)


if __name__ == "__main__":
    unittest.main()
