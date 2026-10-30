import asyncio
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.db.models import UserRole
from app.routers.admin import reject_submission
from app.schemas.admin import ApprovalActionRequest


class AdminDecisionTests(unittest.TestCase):
    def test_request_changes_does_not_wait_for_email(self):
        async def run():
            events = []
            submission = SimpleNamespace(
                id=uuid.uuid4(), submitter_id=uuid.uuid4(), title='Test asset',
                assigned_reviewer_id=None,
            )
            submitter = SimpleNamespace(email='submitter@example.com')
            db = MagicMock()
            db.execute = AsyncMock(side_effect=[
                MagicMock(scalars=lambda: MagicMock(first=lambda: submission)),
                MagicMock(scalars=lambda: MagicMock(first=lambda: submitter)),
            ])
            db.commit = AsyncMock(side_effect=lambda: events.append('commit'))
            db.refresh = AsyncMock()
            background = MagicMock()
            background.add_task.side_effect = lambda *args: events.append('schedule-email')
            user = SimpleNamespace(id=uuid.uuid4(), role=UserRole.admin)

            with patch('app.routers.admin.push_notification', new=AsyncMock()), \
                 patch('app.routers.admin._sub_to_response', return_value='updated'), \
                 patch('app.services.email_service.send_rejection_email', new=AsyncMock()) as send_email:
                result = await reject_submission(
                    str(submission.id), ApprovalActionRequest(notes='Needs work'),
                    background, db, user,
                )
                self.assertEqual(result, 'updated')
                self.assertEqual(events, ['commit', 'commit', 'schedule-email'])
                send_email.assert_not_awaited()
                self.assertEqual(submission.status.value, 'Needs_Changes')

        asyncio.run(run())


if __name__ == '__main__':
    unittest.main()
