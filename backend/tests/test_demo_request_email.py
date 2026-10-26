import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.routers.demo_requests import _notify_demo_request, _notify_demo_decision, _platform_owner_emails


class DemoEmailTests(unittest.TestCase):
    def test_creation_emails_requester_asset_owner_and_platform_owners_once(self):
        async def run():
            with patch('app.services.email_service._send', new=AsyncMock()) as send, \
                 patch('app.config.get_settings', return_value=SimpleNamespace(frontend_url='https://example.com')):
                await _notify_demo_request('Asset <script>', 'asset', 'Requestor', 'requestor@example.com',
                    'Customer', 'Project', 'owner@example.com', ['platform@example.com', 'OWNER@example.com'])
                self.assertEqual([call.args[0] for call in send.await_args_list],
                    ['requestor@example.com', 'owner@example.com', 'platform@example.com'])
                self.assertIn('https://example.com/pipeline', send.await_args.args[2])
                self.assertNotIn('Asset <script>', send.await_args.args[2])
        asyncio.run(run())

    def test_decision_emails_all_parties_even_if_one_delivery_fails(self):
        async def run():
            with patch('app.services.email_service._send', new=AsyncMock(side_effect=[RuntimeError('SMTP failure'), None, None])) as send:
                await _notify_demo_decision('requestor@example.com', 'Asset', 'Approved', '<b>notes</b>',
                    'owner@example.com', ['platform@example.com'])
                self.assertEqual(send.await_count, 3)
                self.assertIn('&lt;b&gt;notes&lt;/b&gt;', send.await_args.args[2])
        asyncio.run(run())

    def test_platform_owner_distribution_list(self):
        async def run():
            with patch.dict('os.environ', {'NOTIFICATION_DL_OWNERS': 'owners@example.com; backup@example.com'}):
                self.assertEqual(await _platform_owner_emails(None), ['owners@example.com', 'backup@example.com'])
        asyncio.run(run())


if __name__ == '__main__':
    unittest.main()
