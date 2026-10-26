import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException
from pydantic import ValidationError
from app.db.models import SubmissionStatus
from app.services.family_assignment import FamilyUpdate, change_family


def result(item=None, items=None):
    return MagicMock(scalars=lambda: MagicMock(first=lambda: item, all=lambda: items or []))


class FamilyTests(unittest.IsolatedAsyncioTestCase):
    def test_narrow_payload_and_canonical_case(self):
        self.assertEqual(FamilyUpdate(family=' sEnTiNeL ').family, 'Sentinel')
        for payload in ({'family':'invalid'}, {'family':'Titan','title':'Extra'}):
            with self.assertRaises(ValidationError):
                FamilyUpdate(**payload)

    async def test_review_preserves_status_score_and_identity(self):
        for status in (SubmissionStatus.Manual_Approval, SubmissionStatus.Approved, SubmissionStatus.On_Hold):
            item=SimpleNamespace(id=uuid.uuid4(),family='Titan',status=status,ai_score=85,catalog_code='TTN-010')
            db=MagicMock(execute=AsyncMock(return_value=result(item)))
            await change_family(db,item.id,'Sentinel',uuid.uuid4())
            self.assertEqual((item.family,item.status,item.ai_score,item.catalog_code),('Sentinel',status,85,'TTN-010'))
            self.assertEqual(db.add.call_args.args[0].log_metadata['previous_family'],'Titan')

    async def test_catalog_syncs_linked_revisions_without_renaming(self):
        item=SimpleNamespace(id=uuid.uuid4(),family='Titan',catalog_code='TTN-010',slug='guard-ai')
        linked=SimpleNamespace(id=uuid.uuid4(),family='Titan')
        db=MagicMock(execute=AsyncMock(side_effect=[result(item),result(items=[linked])]))
        await change_family(db,item.id,'Sentinel',uuid.uuid4(),catalog=True)
        self.assertEqual((item.family,linked.family,item.catalog_code,item.slug),('Sentinel','Sentinel','TTN-010','guard-ai'))
        query=db.execute.await_args_list[1].args[0]
        self.assertIn(str(item.id),str(query.compile().params))
        self.assertIn('TTN-010',str(query.compile().params))
        self.assertEqual(len(db.add.call_args.args[0].log_metadata['linked_submissions']),1)

    async def test_missing_or_outside_review_rejected(self):
        for item,code in ((None,404),(SimpleNamespace(status=SubmissionStatus.Published),409)):
            db=MagicMock(execute=AsyncMock(return_value=result(item)))
            with self.assertRaises(HTTPException) as error:
                await change_family(db,uuid.uuid4(),'Sentinel',uuid.uuid4())
            self.assertEqual(error.exception.status_code,code)
            db.add.assert_not_called()

    async def test_no_change_does_not_create_audit(self):
        item=SimpleNamespace(id=uuid.uuid4(),family='Sentinel',status=SubmissionStatus.Approved)
        db=MagicMock(execute=AsyncMock(return_value=result(item)))
        await change_family(db,item.id,'Sentinel',uuid.uuid4())
        db.add.assert_not_called()
