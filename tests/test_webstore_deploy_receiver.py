import os
from pathlib import Path
import tempfile
import unittest

import test_deploy_receiver as shared
from ops import deploy_webstore_receiver as receiver


class WebstoreReadPackageTests(shared.ReadPackageTests):
    receiver = receiver


class WebstoreSafeTargetTests(shared.SafeTargetTests):
    receiver = receiver


class WebstorePublishTests(shared.PublishIntegrationTests):
    receiver = receiver

    @unittest.skipUnless(os.name == 'posix', 'publish integration requires POSIX flock')
    def test_publish_preserves_placeholder_and_absent_backup(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / 'public_html'
            root.mkdir()
            (root / '.well-known').mkdir()
            (root / '.well-known' / 'validation.txt').write_text('keep validation')
            (root / 'Default.html').write_text('keep placeholder')
            before = receiver.protected_snapshot(root)
            receipt = receiver.publish({'commit': shared.COMMIT},
                {'index.html': b'new homepage'}, root, Path(temp) / 'state')
            self.assertEqual(before, receipt['protected_after'])
            self.assertFalse((root / 'WP old website').exists())
            self.assertEqual((root / 'Default.html').read_text(), 'keep placeholder')


class WebstoreDestinationTests(unittest.TestCase):
    def test_destination_is_separate_from_ictmates(self):
        self.assertEqual(receiver.ROOT.as_posix(), '/home/customer/www/webstore.pk/public_html')
        self.assertEqual(receiver.STATE.as_posix(), '/home/customer/.webstore-deploy')

    def test_absent_protected_directory_is_recorded(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            before = receiver.protected_snapshot(root)
            self.assertEqual(before['WP old website'], {'absent': True})
            (root / 'WP old website').mkdir()
            self.assertNotEqual(before, receiver.protected_snapshot(root))
