import asyncio
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import BackgroundTasks, HTTPException
from pydantic import ValidationError

from app.db.models import AssetStatus, DemoRequest, DemoRequestBatch, PlatformFeedback, UserRole
from app.routers.demo_requests import create_multiple_demo_requests, submit_platform_feedback, list_platform_feedback, _owns_asset, _asset_owner_profile
from app.schemas.demo_request import MultiDemoRequestCreate, PlatformFeedbackCreate
from app.schemas.demo_request import DemoRequestDecision
from app.routers.demo_requests import _decide_demo_request


def session_for(db):
    return MagicMock(__aenter__=AsyncMock(return_value=db), __aexit__=AsyncMock(return_value=False))


def result(rows):
    return MagicMock(scalars=lambda: MagicMock(all=lambda: rows, first=lambda: rows[0] if rows else None))


class MultiDemoTests(unittest.TestCase):
    def test_admin_cannot_decide_platform_request(self):
        async def run():
            request = SimpleNamespace(id=uuid.uuid4(), asset_id=None, requester_id=uuid.uuid4(), request_type='platform', status='Pending')
            db = MagicMock(execute=AsyncMock(side_effect=[result([request]), result([]), result([])]), commit=AsyncMock())
            user = SimpleNamespace(id=uuid.uuid4(), role=UserRole.admin, email='admin@example.com')
            with self.assertRaises(HTTPException) as caught:
                await _decide_demo_request(request.id, 'Approved', DemoRequestDecision(), BackgroundTasks(), db, user)
            self.assertEqual(caught.exception.status_code, 403)
            db.commit.assert_not_awaited()
        asyncio.run(run())

    def test_platform_only_selection_is_saved_and_routed_only_to_platform_owners(self):
        async def run():
            db = MagicMock(execute=AsyncMock(side_effect=[result([]), result(['platform@example.com'])]),
                           commit=AsyncMock(), flush=AsyncMock())
            user = SimpleNamespace(id=uuid.uuid4(), display_name='Requestor', email='requestor@example.com')
            background = BackgroundTasks()
            body = MultiDemoRequestCreate(platform_demo=True, customer_name='Customer', project_name='Project')
            with patch('app.routers.demo_requests.push_notifications_to_roles', new=AsyncMock()) as notify, \
                 patch('app.routers.demo_requests._notify_demo_request', new=AsyncMock()) as send, \
                 patch('app.db.base.get_session_factory', return_value=lambda: session_for(db)):
                response = await create_multiple_demo_requests(body, background, db, user)
                notify.assert_not_awaited()
                await background()
            self.assertTrue(response['platform_demo'])
            request = next(call.args[0] for call in db.add.call_args_list if isinstance(call.args[0], DemoRequest))
            self.assertEqual(request.request_type, 'platform')
            self.assertIsNone(request.asset_id)
            self.assertEqual(str(request.batch_id), response['request_id'])
            self.assertEqual(notify.await_args.args[1], [UserRole.owner])
            self.assertEqual(send.await_args.kwargs['asset_title'], 'AImplify Platform Demo')
            self.assertEqual(send.await_args.kwargs['platform_owner_emails'], ['platform@example.com'])
        asyncio.run(run())

    def test_nominated_owner_can_review_but_unrelated_user_cannot(self):
        asset = SimpleNamespace(owner_id=uuid.uuid4(), owner_email=' Owner@Example.com ')
        user = SimpleNamespace(id=uuid.uuid4(), email='owner@example.com')
        self.assertTrue(_owns_asset(asset, user))
        self.assertFalse(_owns_asset(asset, SimpleNamespace(id=uuid.uuid4(), email='other@example.com')))
        self.assertTrue(_owns_asset(asset, SimpleNamespace(id=asset.owner_id, email='submitter@example.com')))

    def test_notification_uses_nominated_owner_profile(self):
        async def run():
            owner = SimpleNamespace(id=uuid.uuid4(), email='owner@example.com')
            db = MagicMock(execute=AsyncMock(return_value=result([owner])))
            asset = SimpleNamespace(owner_id=uuid.uuid4(), owner_email='OWNER@example.com')
            self.assertIs(await _asset_owner_profile(db, asset), owner)
            self.assertIn('lower(trim(user_profiles.email))', str(db.execute.call_args.args[0]))
        asyncio.run(run())

    def test_selected_assets_are_created_once_and_routed_to_their_owners(self):
        async def run():
            owners = [SimpleNamespace(id=uuid.uuid4(), email=f'owner{i}@example.com', role=UserRole.user) for i in range(2)]
            assets = [SimpleNamespace(id=uuid.uuid4(), title=f'Asset {i}', slug=f'asset-{i}',
                status=AssetStatus.Published, owner_id=owner.id, owner_email=None, demo_request_count=0)
                for i, owner in enumerate(owners)]
            db = MagicMock()
            db.execute = AsyncMock(side_effect=[result(assets), result([]), *[result([owner]) for owner in owners]])
            db.commit = AsyncMock()
            db.flush = AsyncMock()
            user = SimpleNamespace(id=uuid.uuid4(), display_name='Requestor', email='requestor@example.com')
            background = BackgroundTasks()
            body = MultiDemoRequestCreate(asset_ids=[assets[0].id, assets[1].id, assets[0].id],
                customer_name=' Customer ', project_name=' Project ')
            with patch('app.routers.demo_requests.push_notification', new=AsyncMock()) as notify, \
                 patch('app.routers.demo_requests.push_notifications_to_roles', new=AsyncMock()), \
                 patch('app.routers.demo_requests._notify_demo_request', new=AsyncMock()) as send, \
                 patch('app.db.base.get_session_factory', return_value=lambda: session_for(db)):
                response = await create_multiple_demo_requests(body, background, db, user)
                self.assertEqual(db.execute.await_count, 1)
                notify.assert_not_awaited()
                await background()
                self.assertEqual(response['asset_count'], 2)
                records = [call.args[0] for call in db.add.call_args_list if isinstance(call.args[0], DemoRequest)]
                self.assertEqual({row.asset_id for row in records}, {asset.id for asset in assets})
                self.assertEqual([call.args[1] for call in notify.await_args_list], [str(owner.id) for owner in owners])
                self.assertEqual([call.kwargs['asset_owner_email'] for call in send.await_args_list], [owner.email for owner in owners])
                self.assertTrue(all(asset.demo_request_count == 1 for asset in assets))
                audit = db.add.call_args_list[-1].args[0]
                self.assertEqual(len(audit.log_metadata['demo_request_ids']), 2)
                self.assertEqual(records[0].customer_name, 'Customer')
                parent = next(call.args[0] for call in db.add.call_args_list if isinstance(call.args[0], DemoRequestBatch))
                self.assertEqual(str(parent.id), response['request_id'])
                self.assertTrue(all(row.batch_id == parent.id for row in records))
        asyncio.run(run())

    def test_notification_session_failure_does_not_fail_saved_request(self):
        async def run():
            db = MagicMock(execute=AsyncMock(return_value=result([])), commit=AsyncMock(), flush=AsyncMock())
            user = SimpleNamespace(id=uuid.uuid4(), display_name='User', email='user@example.com')
            background = BackgroundTasks()
            body = MultiDemoRequestCreate(platform_demo=True, customer_name='Customer', project_name='Project')
            response = await create_multiple_demo_requests(body, background, db, user)
            self.assertTrue(response['request_id'])
            db.commit.assert_awaited_once()
            with patch('app.db.base.get_session_factory', side_effect=RuntimeError('Notification session unavailable')), \
                 self.assertLogs('app.routers.demo_requests', level='ERROR') as logs:
                await background()
            self.assertIn(response['request_id'], logs.output[0])
            self.assertIn('saved requests are retained', logs.output[0])
        asyncio.run(run())

    def test_bell_commit_failure_still_sends_email_after_rollback(self):
        from app.routers.demo_requests import _dispatch_multiple_demo_notifications
        async def run():
            db=MagicMock(commit=AsyncMock(side_effect=RuntimeError('bell commit failed')),rollback=AsyncMock())
            class Owner:
                id=uuid.uuid4()
                role=UserRole.user
                @property
                def email(self):
                    if db.rollback.await_count: raise RuntimeError('ORM fields expired after rollback')
                    return 'owner@example.com'
            target=dict(request_id=str(uuid.uuid4()),request_type='asset',title='Asset',slug='asset',owner_id=Owner.id,owner_email=None)
            with patch('app.db.base.get_session_factory',return_value=lambda:session_for(db)), \
                 patch('app.routers.demo_requests._platform_owner_emails',new=AsyncMock(return_value=[])), \
                 patch('app.routers.demo_requests._asset_owner_profile',new=AsyncMock(return_value=Owner())), \
                 patch('app.routers.demo_requests.push_notifications_to_roles',new=AsyncMock()), \
                 patch('app.routers.demo_requests.push_notification',new=AsyncMock()), \
                 patch('app.routers.demo_requests._notify_demo_request',new=AsyncMock()) as send, \
                 self.assertLogs('app.routers.demo_requests',level='ERROR'):
                await _dispatch_multiple_demo_notifications(str(uuid.uuid4()),
                    {'id':str(uuid.uuid4()),'name':'Requester','email':'requester@example.com'},'Customer','Project',[target])
            db.rollback.assert_awaited_once()
            self.assertEqual(send.await_args.kwargs['asset_owner_email'],'owner@example.com')
        asyncio.run(run())

    def test_missing_schema_rolls_back_and_logs_reference(self):
        from sqlalchemy.exc import ProgrammingError
        async def run():
            cause = Exception('missing table'); cause.sqlstate='42P01'
            db = MagicMock(execute=AsyncMock(return_value=result([])),
                           flush=AsyncMock(side_effect=ProgrammingError('INSERT',{},cause)),rollback=AsyncMock(),commit=AsyncMock())
            user = SimpleNamespace(id=uuid.uuid4(), display_name='User', email='user@example.com')
            background = BackgroundTasks()
            with self.assertLogs('app.routers.demo_requests', level='ERROR') as logs, self.assertRaises(HTTPException) as caught:
                await create_multiple_demo_requests(MultiDemoRequestCreate(platform_demo=True, customer_name='C', project_name='P'),background,db,user)
            self.assertEqual(caught.exception.status_code,503)
            self.assertIn('034 and 035',caught.exception.detail)
            self.assertIn('MULTI_DEMO_CREATE_FAILED',logs.output[0])
            db.rollback.assert_awaited_once();db.commit.assert_not_awaited()
            self.assertFalse(background.tasks)
        asyncio.run(run())

    def test_unavailable_selection_creates_no_partial_requests(self):
        async def run():
            asset = SimpleNamespace(id=uuid.uuid4(), status=AssetStatus.Published)
            db = MagicMock(execute=AsyncMock(return_value=result([asset])), commit=AsyncMock())
            body = MultiDemoRequestCreate(asset_ids=[asset.id, uuid.uuid4()], customer_name='Customer', project_name='Project')
            with self.assertRaises(HTTPException):
                await create_multiple_demo_requests(body, BackgroundTasks(), db, SimpleNamespace())
            db.add.assert_not_called()
            db.commit.assert_not_awaited()
        asyncio.run(run())

    def test_blank_fields_and_empty_selection_are_rejected(self):
        for fields in [dict(asset_ids=[], customer_name='Customer', project_name='Project'),
                       dict(asset_ids=[uuid.uuid4()], customer_name=' ', project_name='Project')]:
            with self.assertRaises(ValidationError):
                MultiDemoRequestCreate(**fields)
        with self.assertRaises(ValidationError):
            PlatformFeedbackCreate(comment=' ')

    def test_platform_feedback_is_persisted_and_notifies_governance(self):
        async def run():
            db = MagicMock(commit=AsyncMock())
            user = SimpleNamespace(id=uuid.uuid4(), display_name='User', email='user@example.com')
            with patch('app.routers.demo_requests.push_notifications_to_roles', new=AsyncMock()) as notify:
                response = await submit_platform_feedback(PlatformFeedbackCreate(comment='Improve search'), db, user)
                log = db.add.call_args.args[0]
                self.assertEqual(log.log_metadata['comment'], 'Improve search')
                self.assertEqual(response['id'], str(log.entity_id))
                feedback = db.add.call_args_list[0].args[0]
                self.assertIsInstance(feedback, PlatformFeedback)
                self.assertEqual(feedback.id, log.entity_id)
                self.assertEqual(feedback.comment, 'Improve search')
                self.assertEqual(feedback.submitter_id, user.id)
                self.assertEqual(notify.await_args.args[1], [UserRole.admin, UserRole.owner])
                db.commit.assert_awaited_once()
        asyncio.run(run())

    def test_asset_feedback_persists_subject_and_audit_target(self):
        async def run():
            asset=SimpleNamespace(id=uuid.uuid4(),title='Ticket Triage',status=AssetStatus.Published)
            db=MagicMock(execute=AsyncMock(return_value=result([asset])),commit=AsyncMock())
            user=SimpleNamespace(id=uuid.uuid4(),display_name='User',email='user@example.com')
            with patch('app.routers.demo_requests.push_notifications_to_roles',new=AsyncMock()) as notify:
                await submit_platform_feedback(PlatformFeedbackCreate(comment='Useful accelerator',asset_id=asset.id),db,user)
            row=db.add.call_args_list[0].args[0]
            self.assertEqual(row.asset_id,asset.id)
            self.assertEqual(row.asset_title,asset.title)
            self.assertEqual(db.add.call_args_list[1].args[0].log_metadata['asset_id'],str(asset.id))
            self.assertIn(asset.title,notify.await_args.args[3])
            db.commit.assert_awaited_once()
        asyncio.run(run())

    def test_asset_feedback_rejects_missing_or_unpublished_targets(self):
        async def run():
            for assets in ([],[SimpleNamespace(id=uuid.uuid4(),status=AssetStatus.Draft)]):
                db=MagicMock(execute=AsyncMock(return_value=result(assets)),commit=AsyncMock())
                with self.assertRaises(HTTPException) as caught:
                    await submit_platform_feedback(PlatformFeedbackCreate(comment='Feedback',asset_id=uuid.uuid4()),db,SimpleNamespace())
                self.assertEqual(caught.exception.status_code,400)
                db.add.assert_not_called();db.commit.assert_not_awaited()
            with self.assertRaises(ValidationError):
                PlatformFeedbackCreate(comment='Feedback',asset_id='not-a-uuid')
        asyncio.run(run())

    def test_feedback_list_retains_asset_subject_after_asset_deletion(self):
        async def run():
            row=SimpleNamespace(id=uuid.uuid4(),name='User',email='user@example.com',comment='Feedback',
                                created_at='2026-10-22',asset_id=None,asset_title='Retired asset')
            db=MagicMock(execute=AsyncMock(return_value=result([row])))
            response=await list_platform_feedback(db,SimpleNamespace(role=UserRole.owner))
            self.assertEqual(response[0]['asset_title'],'Retired asset')
        asyncio.run(run())

    def test_feedback_list_reads_dedicated_table(self):
        async def run():
            row = SimpleNamespace(id=uuid.uuid4(), name='User', email='user@example.com', comment='Feedback', created_at='2026-10-07')
            db = MagicMock(execute=AsyncMock(return_value=result([row])))
            response = await list_platform_feedback(db, SimpleNamespace(role=UserRole.admin))
            self.assertEqual(response[0]['comment'], 'Feedback')
            self.assertIn('FROM platform_feedback', str(db.execute.call_args.args[0]))
        asyncio.run(run())


if __name__ == '__main__':
    unittest.main()
