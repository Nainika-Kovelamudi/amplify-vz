from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
import pytest
from app.routers.meeting_plans import attendee_suggestions


@pytest.mark.asyncio
async def test_attendee_search_uses_minimal_profile_fields_and_literal_bounded_query():
    row=SimpleNamespace(id='test-id',display_name='Example Person',email='person@example.com')
    db=MagicMock(execute=AsyncMock(return_value=MagicMock(all=lambda:[row])))
    response=await attendee_suggestions('%_',db,SimpleNamespace(role='Aimplify.User'))
    stmt=db.execute.call_args.args[0]
    assert list(stmt.selected_columns.keys())==['id','display_name','email']
    assert stmt._limit_clause.value==10
    assert '/%/_' in stmt.compile().params.values()
    assert response=={'items':[{'id':'test-id','name':'Example Person','email':'person@example.com'}]}


@pytest.mark.asyncio
async def test_attendee_search_does_not_enumerate_directory_for_blank_query():
    db=MagicMock(execute=AsyncMock())
    assert await attendee_suggestions('  ',db,SimpleNamespace(role='Aimplify.User'))=={'items':[]}
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_attendee_search_falls_back_to_email_if_display_name_missing():
    row=SimpleNamespace(id='test-id',display_name=None,email='person@example.com')
    db=MagicMock(execute=AsyncMock(return_value=MagicMock(all=lambda:[row])))
    assert (await attendee_suggestions('person',db,SimpleNamespace(role='Aimplify.User')))['items'][0]['name']==row.email
