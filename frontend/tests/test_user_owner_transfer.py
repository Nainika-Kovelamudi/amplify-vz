import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from app.routers.users import delete_user


def row(value):
    return MagicMock(scalars=lambda: MagicMock(first=lambda: value))


class UserTransferTests(unittest.IsolatedAsyncioTestCase):
    async def test_transfer_and_delete(self):
        old, new, actor = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        db = MagicMock(execute=AsyncMock(side_effect=[
            row(SimpleNamespace(id=old, email='old@example.com')),
            row(SimpleNamespace(id=new, email='new@example.com', display_name='New')),
            MagicMock(scalar_one=lambda: 2), MagicMock(scalar_one=lambda: 0), MagicMock(), MagicMock()
        ]), delete=AsyncMock(), commit=AsyncMock(), rollback=AsyncMock())
        await delete_user(old, new, db, SimpleNamespace(id=actor, email='owner@example.com'))
        self.assertEqual(db.execute.await_args_list[-2].args[1]['new_id'], new)
        self.assertEqual(db.add.call_args.args[0].log_metadata['transferred_asset_count'], 2)
        db.commit.assert_awaited_once()

    async def test_linked_history_rolls_back(self):
        old, new = uuid.uuid4(), uuid.uuid4()
        db = MagicMock(execute=AsyncMock(side_effect=[
            row(SimpleNamespace(id=old, email='old@example.com')),
            row(SimpleNamespace(id=new, email='new@example.com', display_name='New')),
            MagicMock(scalar_one=lambda: 1), MagicMock(scalar_one=lambda: 0), MagicMock(), MagicMock()
        ]), delete=AsyncMock(), commit=AsyncMock(side_effect=IntegrityError('delete', {}, Exception())), rollback=AsyncMock())
        with self.assertRaises(HTTPException) as caught:
            await delete_user(old, new, db, SimpleNamespace(id=uuid.uuid4(), email='owner@example.com'))
        self.assertEqual(caught.exception.status_code, 409)
        db.rollback.assert_awaited_once()

    async def test_cannot_delete_self(self):
        uid = uuid.uuid4()
        db = MagicMock(execute=AsyncMock(), rollback=AsyncMock())
        with self.assertRaises(HTTPException) as caught:
            await delete_user(uid, None, db, SimpleNamespace(id=uid))
        self.assertEqual(caught.exception.status_code, 403)
        db.execute.assert_not_awaited()
