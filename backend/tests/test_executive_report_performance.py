import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace as Row
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.dialects import postgresql
from app.db.models import SubmissionStatus as Status
from app.services import executive_report_data as service
from scripts.executive_report_packaging import patch_executive_report_router

NOW = datetime(2026, 10, 22, 12, tzinfo=timezone.utc)


class FrozenDateTime(datetime):
    @classmethod
    def now(cls, tz=None):
        return NOW


def database():
    import uuid
    user1, user2, asset1, asset2 = [uuid.uuid4() for _ in range(4)]
    submissions = [Row(status=state, department=department, family='forge', ai_score=score,
                       created_at=NOW-timedelta(days=2), reviewed_at=reviewed)
                   for state, department, score, reviewed in [
                       (Status.Published,'A',85,NOW-timedelta(days=1)),
                       (Status.Approved,'A',65,NOW-timedelta(days=1,hours=12)),
                       (Status.On_Hold,'A',None,None),
                       (Status.Needs_Changes,'B',45,None),
                       (Status.Submitted,'B',0,None)]]
    statuses=[Row(status=state,total=count,oldest=NOW-timedelta(days=2)) for state,count in
              [(Status.Published,2),(Status.Approved,2),(Status.Manual_Approval,1),
               (Status.On_Hold,1),(Status.Submitted,2),(Status.Needs_Changes,1)]]
    assets=[Row(id=uid,slug=slug,title=slug,family=family,view_count=views,
                artifact_download_count=downloads,demo_view_count=1)
            for uid,slug,family,views,downloads in [(asset1,'first','forge',10,2),(asset2,'second','atlas',5,0)]]
    events=[Row(action=action,actor_id=uid,event_date=NOW.date(),event_count=count,created_at=NOW)
            for action,uid,count in [('asset_viewed',user1,1000),('submission_approved',user1,2),
                                     ('submission_published',user1,1),('asset_viewed',user2,50),('asset_published',user2,1)]]
    profiles=[Row(id=uid,display_name=name,email=name+'@example.com') for uid,name in [(user1,'Alice'),(user2,'Bob')]]
    results=[MagicMock(all=lambda values=values:values) for values in
             [submissions,statuses,assets,events]]
    results += [MagicMock(scalar_one=lambda:2),MagicMock(all=lambda:[(asset1,3)]),
                MagicMock(all=lambda:[(asset1,2),(None,1)]),MagicMock(all=lambda:profiles)]
    return MagicMock(execute=AsyncMock(side_effect=results))


def test_thin_queries_preserve_report_totals_and_weighted_event_counts():
    async def run():
        service.clear_report_cache()
        db=database()
        with patch.object(service,'datetime',FrozenDateTime):
            report=await service.build_executive_report(30,db,Row(id='owner'))
        assert report.summary.total_assets==9
        assert report.summary.new_submissions==5
        assert report.summary.ai_passed==2 and report.summary.ai_failures==1
        assert report.summary.average_ai_score==65
        assert report.summary.average_review_hours==18
        assert report.summary.oldest_pending_hours==48
        assert report.summary.approved==2 and report.summary.published==2
        assert report.engagement.clone_requests==3 and report.engagement.demo_requests==3
        assert report.engagement.catalog_views==15
        assert report.departments[0].name=='A' and report.departments[0].submitted==3
        assert report.departments[0].approved==2 and report.departments[0].published==1
        assert report.departments[0].average_ai_score==75
        assert report.departments[1].average_ai_score==45  # Zero stays excluded, as before.
        assert report.active_users[0].events==1003
        assert report.active_users[1].events==51
        assert report.trending_assets[0].engagement_score==34
        assert next(e.count for e in report.top_events if e.key=='asset_viewed')==1050
        assert sum(p.approved for p in report.daily_trend)==2
        assert sum(p.published for p in report.daily_trend)==2
        assert db.execute.await_count==8
        sql=[str(call.args[0].compile(dialect=postgresql.dialect())) for call in db.execute.await_args_list]
        assert all('ai_feedback' not in query and 'architecture_file_url' not in query and 'metadata' not in query for query in sql)
        assert 'GROUP BY activity_logs.action' in sql[3] and 'count(' in sql[3]
    asyncio.run(run())


def test_cache_is_bounded_user_scoped_expires_and_refresh_bypasses_it():
    async def run():
        service.clear_report_cache()
        with patch.object(service,'datetime',FrozenDateTime),patch.object(service.time,'monotonic',return_value=100):
            db=database();report=await service.build_executive_report(30,db,Row(id='owner'))
            report.summary.new_submissions=-1
            unused=MagicMock(execute=AsyncMock())
            again=await service.build_executive_report(30,unused,Row(id='owner'))
            assert again.summary.new_submissions==5
            unused.execute.assert_not_awaited()
            fresh=database();await service.build_executive_report(30,fresh,Row(id='owner'),refresh=True)
            assert fresh.execute.await_count==8
            other=database();await service.build_executive_report(30,other,Row(id='other-owner'))
            assert other.execute.await_count==8
        with patch.object(service,'datetime',FrozenDateTime),patch.object(service.time,'monotonic',return_value=131):
            expired=database();await service.build_executive_report(30,expired,Row(id='owner'))
            assert expired.execute.await_count==8
            with patch.object(service,'CACHE_LIMIT',2):
                await service.build_executive_report(90,database(),Row(id='owner'))
                assert len(service._CACHE)==2
    asyncio.run(run())


def test_legacy_zip_patch_preserves_other_admin_handlers():
    source='''async def keep_before():
    return "unchanged"

@router.get('/executive-report')
async def get_executive_report():
    return "old slow implementation"

async def download_executive_report():
    return "old synchronous export"

async def keep_after():
    return "unchanged too"
'''
    patched=patch_executive_report_router(source,Path(__file__).resolve().parents[1])
    assert 'return "unchanged"' in patched and 'return "unchanged too"' in patched
    assert 'old slow implementation' not in patched
    assert 'old synchronous export' not in patched
    assert 'await run_in_threadpool(builder, report)' in patched
    assert 'build_executive_report(days, db, user, refresh)' in patched


def test_export_builder_runs_off_the_api_event_loop():
    from app.routers.admin import download_executive_report
    async def run():
        report=Row(period_end=NOW)
        with patch('app.routers.admin.get_executive_report',new=AsyncMock(return_value=report)), \
             patch('starlette.concurrency.run_in_threadpool',new=AsyncMock(return_value=b'file')) as thread, \
             patch('app.services.executive_report_service.build_executive_report_docx') as builder:
            response=await download_executive_report(days=30,format='docx',db=MagicMock(),user=Row(id='owner'))
            thread.assert_awaited_once_with(builder,report)
            assert response.headers['content-disposition'].endswith('.docx"')
    asyncio.run(run())
