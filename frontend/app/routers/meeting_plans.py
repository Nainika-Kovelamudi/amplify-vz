import asyncio
import hashlib
import json
import uuid
from datetime import datetime,timezone
from fastapi import APIRouter,BackgroundTasks,Depends,HTTPException,Query,Response
from sqlalchemy import and_,delete,func,or_,select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.db.models import ActivityLog,AssetStatus,CatalogAsset,DemoRequest,DemoRequestBatch,UserProfile
from app.db.operations_models import MeetingPlan,MeetingPlanAsset
from app.deps.rbac import get_current_user
from app.schemas.meeting_plan import MeetingInput,MeetingUpdate,MeetingAction,MeetingScheduleUpdate,StandaloneMeetingInput,PlannerChatRequest
from app.services.asset_lifecycle import privileged
from app.services.meeting_planning import requirements_hash,recommend_assets,validate_finalization,validate_schedule,calendar_invite,planner_reply

router=APIRouter(prefix='/meeting-plans',tags=['Meeting and demo planning'])


async def load_plan(db,pid,user,lock=False):
    stmt=select(MeetingPlan).where(MeetingPlan.id==pid).execution_options(populate_existing=True)
    if lock:stmt=stmt.with_for_update()
    plan=(await db.execute(stmt)).scalars().first()
    if not plan:raise HTTPException(404,'Meeting/demo request not found.')
    if plan.requester_id!=user.id and not privileged(user):raise HTTPException(403,'Only the requester or platform administrators can manage this request.')
    return plan


def editable(plan,revision):
    if plan.state!='Draft':raise HTTPException(409,'Only draft requests can be edited. Finalized asset selections are retained for audit.')
    if plan.revision!=revision:raise HTTPException(409,'This draft changed. Refresh it before continuing.')


def recommendable(plan,revision):
    if plan.state=='Scheduled' and plan.content.get('plan_kind')=='meeting':
        if plan.revision!=revision:raise HTTPException(409,'This meeting changed. Refresh it before continuing.')
    else:editable(plan,revision)


def audit(db,plan,user,action,metadata):
    db.add(ActivityLog(actor_id=user.id,action='meeting_plan_'+action,entity_type='meeting_plan',entity_id=plan.id,log_metadata=metadata))


async def tags(db,plan):
    return (await db.execute(select(MeetingPlanAsset).where(MeetingPlanAsset.plan_id==plan.id).order_by(MeetingPlanAsset.asset_title))).scalars().all()


async def assets_for_selection(db,ids):
    ids=list(dict.fromkeys(ids))
    if not ids:return []
    rows=(await db.execute(select(CatalogAsset).where(CatalogAsset.id.in_(ids)).order_by(CatalogAsset.id).with_for_update())).scalars().all()
    if len(rows)!=len(ids) or any(a.status!=AssetStatus.Published for a in rows):raise HTTPException(409,'One or more selected accelerators are no longer active. Review and remove unavailable selections.')
    return rows


async def recipients(db,plan,assets):
    requester=(await db.execute(select(UserProfile).where(UserProfile.id==plan.requester_id))).scalars().first()
    if not requester:raise HTTPException(409,'Requester account is no longer available.')
    # Asset tagging in a standalone meeting is context, not an owner request/invitation.
    assets=[] if plan.content.get('plan_kind')=='meeting' else assets
    ids=list({a.owner_id for a in assets if a.owner_id})
    owners=(await db.execute(select(UserProfile).where(UserProfile.id.in_(ids)))).scalars().all() if ids else []
    emails=[requester.email,*plan.content.get('attendees',[]),*(p.email for p in owners),*(a.owner_email for a in assets if a.owner_email)]
    if plan.content.get('platform_demo'):
        platform=(await db.execute(select(UserProfile).where(UserProfile.role=='Aimplify.Owner'))).scalars().all()
        emails.extend(p.email for p in platform)
    emails=sorted({e.strip().lower() for e in emails if e})
    digest=hashlib.sha256(json.dumps(emails).encode()).hexdigest()
    return requester,emails,digest


async def detail(db,plan):
    associations=await tags(db,plan)
    ids=[t.asset_id for t in associations if t.asset_id]
    assets=(await db.execute(select(CatalogAsset).where(CatalogAsset.id.in_(ids)))).scalars().all() if ids else []
    by_id={a.id:a for a in assets}
    _,emails,digest=await recipients(db,plan,assets)
    children=(await db.execute(select(DemoRequest).where(DemoRequest.batch_id==plan.batch_id))).scalars().all() if plan.batch_id else []
    return {'id':str(plan.id),'state':plan.state,'revision':plan.revision,'content':plan.content,
        'batch_id':str(plan.batch_id) if plan.batch_id else None,'recommendations':plan.recommendations or [],
        'recommendations_current':plan.recommendation_hash==requirements_hash(plan.content),
        'assets':[{'asset_id':str(t.asset_id) if t.asset_id else None,'title':t.asset_title,'selected_via':t.selected_via,
                   'available':bool(t.asset_id in by_id and by_id[t.asset_id].status==AssetStatus.Published)} for t in associations],
        'invite_attendees':plan.content.get('final_attendees',emails),'attendees_fingerprint':digest,
        'requests':[{'id':str(c.id),'asset_id':str(c.asset_id) if c.asset_id else None,'type':c.request_type,'status':c.status} for c in children],
        'conversation':await planner_conversation(db,plan.id),
        'created_at':plan.created_at,'updated_at':plan.updated_at}


async def planner_conversation(db,plan_id):
    rows=(await db.execute(select(ActivityLog).where(ActivityLog.entity_id==plan_id,ActivityLog.entity_type=='meeting_plan',
        ActivityLog.action=='meeting_plan_planner_chat').order_by(ActivityLog.created_at.desc(),ActivityLog.id.desc()).limit(50))).scalars().all()
    return [{'id':str(row.id),'question':row.log_metadata['question'],'answer':row.log_metadata['answer'],'at':row.created_at}
            for row in reversed(rows)]


async def prior_planner_turn(db,plan_id,request_id):
    return (await db.execute(select(ActivityLog).where(ActivityLog.entity_id==plan_id,ActivityLog.entity_type=='meeting_plan',
        ActivityLog.action=='meeting_plan_planner_chat',ActivityLog.log_metadata['request_id'].as_string()==str(request_id)))).scalars().first()


@router.post('/{plan_id}/planner-chat')
async def planner_chat(plan_id:uuid.UUID,body:PlannerChatRequest,db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    plan=await load_plan(db,plan_id,user)
    prior=await prior_planner_turn(db,plan_id,body.request_id)
    if prior:
        if prior.log_metadata['question']!=body.message:raise HTTPException(409,'Use a new request ID for a different question.')
        return await detail(db,plan)
    recommendable(plan,body.expected_revision)
    content=dict(plan.content)
    turns=await planner_conversation(db,plan.id)
    history=[message for turn in turns[-8:] for message in (
        {'role':'user','content':turn['question']},{'role':'assistant','content':turn['answer'][:2000]})]
    selected_ids=[str(tag.asset_id) for tag in await tags(db,plan) if tag.asset_id]
    assets=(await db.execute(select(CatalogAsset).where(CatalogAsset.status==AssetStatus.Published).order_by(CatalogAsset.title).limit(200))).scalars().all()
    try:reply=await asyncio.wait_for(planner_reply(content,assets,history,body.message,selected_ids),timeout=60)
    except Exception as exc:
        audit(db,plan,user,'planner_chat_failed',{'request_id':str(body.request_id),'question':body.message,'reason':'AI provider unavailable'})
        await db.commit()
        raise HTTPException(503,'The AI planner is temporarily unavailable. Your saved details and selections are retained; retry or choose assets manually.') from exc
    plan=await load_plan(db,plan_id,user,lock=True)
    prior=await prior_planner_turn(db,plan_id,body.request_id)
    if prior:
        if prior.log_metadata['question']!=body.message:raise HTTPException(409,'Use a new request ID for a different question.')
        return await detail(db,plan)
    recommendable(plan,body.expected_revision)
    update_suggestions=reply.get('update_recommendations',True)
    proposed=reply['recommendations'] if update_suggestions else (plan.recommendations or [])
    ids=[uuid.UUID(item['asset_id']) for item in proposed]
    live=(await db.execute(select(CatalogAsset.id).where(CatalogAsset.id.in_(ids),CatalogAsset.status==AssetStatus.Published))).scalars().all() if ids else []
    suggestions=[item for item in proposed if uuid.UUID(item['asset_id']) in live]
    plan.recommendations=suggestions
    if update_suggestions:plan.recommendation_hash=requirements_hash(content)
    plan.revision+=1;plan.updated_at=datetime.now(timezone.utc)
    audit(db,plan,user,'planner_chat',{'request_id':str(body.request_id),'question':body.message,'answer':reply['answer'],
        'recommendations':suggestions,'recommendations_updated':update_suggestions,'intent':reply.get('intent','recommend'),'requirements_hash':plan.recommendation_hash,
        'context':{key:content.get(key,'') for key in ('title','requirements','vertical','agenda')},'revision':plan.revision})
    await db.commit()
    return await detail(db,plan)


async def replace_tags(db,plan,assets):
    await db.execute(delete(MeetingPlanAsset).where(MeetingPlanAsset.plan_id==plan.id))
    suggested={r['asset_id'] for r in plan.recommendations or []} if plan.recommendation_hash==requirements_hash(plan.content) else set()
    for a in assets:db.add(MeetingPlanAsset(plan_id=plan.id,asset_id=a.id,asset_title=a.title,
        selected_via='AI suggestion' if str(a.id) in suggested else 'Manual'))


@router.get('/attendees')
async def attendee_suggestions(search:str=Query(...,min_length=2,max_length=100),db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    """Authenticated people picker; intentionally excludes administrative profile fields."""
    term=search.strip().lower()
    if len(term)<2:return {'items':[]}
    stmt=select(UserProfile.id,UserProfile.display_name,UserProfile.email).where(
        or_(func.lower(UserProfile.display_name).contains(term,autoescape=True),
            func.lower(UserProfile.email).contains(term,autoescape=True)),
        UserProfile.email.is_not(None),UserProfile.email!='').order_by(
            func.lower(UserProfile.display_name),func.lower(UserProfile.email),UserProfile.id).limit(10)
    rows=(await db.execute(stmt)).all()
    return {'items':[{'id':str(row.id),'name':row.display_name or row.email,'email':row.email} for row in rows]}


@router.get('')
async def list_plans(skip:int=Query(0,ge=0),limit:int=Query(100,ge=1,le=200),db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    stmt=select(MeetingPlan).where(MeetingPlan.state!='Scheduled')
    if not privileged(user):stmt=stmt.where(MeetingPlan.requester_id==user.id)
    total=(await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    plans=(await db.execute(stmt.order_by(MeetingPlan.updated_at.desc(),MeetingPlan.id.desc()).offset(skip).limit(limit))).scalars().all()
    return {'items':[{'id':str(p.id),'title':p.content.get('title') or 'Untitled meeting/demo','customer_name':p.content.get('customer_name',''),
        'state':p.state,'starts_at':p.content.get('starts_at'),'updated_at':p.updated_at} for p in plans],'total':total}


@router.get('/standalone')
async def list_standalone_meetings(skip:int=Query(0,ge=0),limit:int=Query(100,ge=1,le=200),db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    # Keep previously saved demo-linked calendars accessible without converting history.
    stmt=select(MeetingPlan).where(or_(MeetingPlan.state=='Scheduled',and_(MeetingPlan.state=='Finalized',MeetingPlan.content['starts_at'].as_string().is_not(None))))
    if not privileged(user):stmt=stmt.where(MeetingPlan.requester_id==user.id)
    total=(await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    plans=(await db.execute(stmt.order_by(MeetingPlan.updated_at.desc(),MeetingPlan.id.desc()).offset(skip).limit(limit))).scalars().all()
    return {'items':[{'id':str(p.id),'title':p.content.get('title') or 'Meeting','starts_at':p.content.get('starts_at'),
                     'state':p.state,'updated_at':p.updated_at} for p in plans],'total':total}


@router.post('/standalone',status_code=201)
async def create_standalone_meeting(body:StandaloneMeetingInput,db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    content=body.model_dump(mode='json',exclude={'asset_ids'})
    if not content['title'].strip():raise HTTPException(422,'Meeting title is required.')
    try:validate_schedule(content)
    except ValueError as exc:raise HTTPException(422,str(exc)) from exc
    selected=await assets_for_selection(db,body.asset_ids)
    # An independent meeting never creates a demo batch, owner request or notification.
    content['plan_kind']='meeting';content['platform_demo']=False
    plan=MeetingPlan(id=uuid.uuid4(),requester_id=user.id,state='Scheduled',revision=1,content=content,recommendations=[])
    requester,emails,_=await recipients(db,plan,selected)
    plan.content={**content,'final_attendees':emails,'organizer_email':requester.email,'schedule_saved_at':datetime.now(timezone.utc).isoformat()}
    db.add(plan);await db.flush();await replace_tags(db,plan,selected)
    audit(db,plan,user,'meeting_created',{'content':plan.content,'asset_ids':[str(a.id) for a in selected],'revision':1})
    await db.commit();await db.refresh(plan)
    return await detail(db,plan)


@router.post('',status_code=201)
async def create_plan(body:MeetingInput,db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    selected=await assets_for_selection(db,body.asset_ids)
    content=body.model_dump(mode='json',exclude={'asset_ids'})
    plan=MeetingPlan(id=uuid.uuid4(),requester_id=user.id,state='Draft',revision=1,content=content,recommendations=[])
    db.add(plan);await db.flush();await replace_tags(db,plan,selected)
    audit(db,plan,user,'created',{'content':content,'asset_ids':[str(a.id) for a in selected],'revision':1})
    await db.commit();await db.refresh(plan)
    return await detail(db,plan)


@router.get('/{plan_id}')
async def get_plan(plan_id:uuid.UUID,db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    return await detail(db,await load_plan(db,plan_id,user))


@router.patch('/{plan_id}')
async def update_plan(plan_id:uuid.UUID,body:MeetingUpdate,db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    plan=await load_plan(db,plan_id,user,lock=True);editable(plan,body.expected_revision)
    previous=plan.content;old_ids={str(t.asset_id) for t in await tags(db,plan) if t.asset_id}
    selected=await assets_for_selection(db,body.asset_ids)
    content=body.model_dump(mode='json',exclude={'asset_ids','expected_revision'})
    plan.content=content;plan.revision+=1;plan.updated_at=datetime.now(timezone.utc)
    await replace_tags(db,plan,selected);new_ids={str(a.id) for a in selected}
    audit(db,plan,user,'updated',{'changes':{k:{'before':previous.get(k),'after':v} for k,v in content.items() if previous.get(k)!=v},
        'assets_added':sorted(new_ids-old_ids),'assets_removed':sorted(old_ids-new_ids),
        'suggestions_not_selected':[r['asset_id'] for r in plan.recommendations or [] if r['asset_id'] not in new_ids], 'revision':plan.revision})
    await db.commit();return await detail(db,plan)


@router.post('/{plan_id}/recommend')
async def recommend(plan_id:uuid.UUID,body:MeetingAction,db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    plan=await load_plan(db,plan_id,user);recommendable(plan,body.expected_revision)
    if len(plan.content.get('requirements','').strip())<10:raise HTTPException(422,'Describe the meeting requirements in at least ten characters.')
    content=dict(plan.content)
    assets=(await db.execute(select(CatalogAsset).where(CatalogAsset.status==AssetStatus.Published).order_by(CatalogAsset.title).limit(200))).scalars().all()
    try:items=await asyncio.wait_for(recommend_assets(content,assets),timeout=60)
    except Exception as exc:raise HTTPException(503,'AI recommendations are temporarily unavailable. You can still choose accelerators manually.') from exc
    plan=await load_plan(db,plan_id,user,lock=True);recommendable(plan,body.expected_revision)
    ids=[uuid.UUID(r['asset_id']) for r in items]
    current=(await db.execute(select(CatalogAsset.id).where(CatalogAsset.id.in_(ids),CatalogAsset.status==AssetStatus.Published))).scalars().all() if ids else []
    items=[r for r in items if uuid.UUID(r['asset_id']) in current]
    plan.recommendations=items;plan.recommendation_hash=requirements_hash(content);plan.revision+=1;plan.updated_at=datetime.now(timezone.utc)
    audit(db,plan,user,'recommendations_generated',{'recommendations':items,'requirements_hash':plan.recommendation_hash,'revision':plan.revision})
    await db.commit();return await detail(db,plan)


@router.post('/{plan_id}/finalize')
async def finalize(plan_id:uuid.UUID,body:MeetingAction,background_tasks:BackgroundTasks,db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    if not body.confirmed:raise HTTPException(422,'Review and confirm the request before finalizing.')
    plan=await load_plan(db,plan_id,user,lock=True)
    if plan.state=='Finalized':return await detail(db,plan)  # retry-safe: no duplicate requests or notifications
    editable(plan,body.expected_revision)
    associations=await tags(db,plan)
    if any(not t.asset_id for t in associations):raise HTTPException(409,'Remove unavailable accelerators before finalizing.')
    selected=await assets_for_selection(db,[t.asset_id for t in associations])
    try:validate_finalization(plan.content,selected)
    except ValueError as exc:raise HTTPException(422,str(exc)) from exc
    requester,emails,digest=await recipients(db,plan,selected)
    if digest!=body.attendees_fingerprint:raise HTTPException(409,'Meeting recipients changed. Refresh and review them again.')
    c=dict(plan.content);batch_id=uuid.uuid4();now=datetime.now(timezone.utc)
    db.add(DemoRequestBatch(id=batch_id,requester_id=plan.requester_id,customer_name=c['customer_name'],project_name=c['project_name'],vertical=c['vertical'] or None))
    await db.flush();targets=[]
    notes=f"Demo request: {c['title']}\nRequirements: {c['requirements']}"
    for a in [*selected,*([None] if c['platform_demo'] else [])]:
        rid=uuid.uuid4();kind='asset' if a else 'platform';title=a.title if a else 'AImplify Platform Demo'
        dr=DemoRequest(id=rid,batch_id=batch_id,asset_id=a.id if a else None,request_type=kind,requester_id=plan.requester_id,
            customer_name=c['customer_name'],project_name=c['project_name'],vertical=c['vertical'] or None,additional_details=notes,
            requester_email=requester.email,requester_name=requester.display_name or requester.email,status='Pending',requested_at=now)
        db.add(dr)
        if a:a.demo_request_count=(a.demo_request_count or 0)+1
        targets.append({'request_id':str(rid),'request_type':kind,'title':title,'slug':a.slug if a else '',
                        'owner_id':a.owner_id if a else None,'owner_email':a.owner_email if a else None})
    plan.state='Finalized';plan.batch_id=batch_id;plan.revision+=1;plan.updated_at=now
    c['final_attendees']=emails;c['organizer_email']=requester.email;plan.content=c
    audit(db,plan,user,'finalized',{'batch_id':str(batch_id),'asset_ids':[str(a.id) for a in selected],
        'request_ids':[t['request_id'] for t in targets],'attendees':emails,'starts_at':c['starts_at'],'revision':plan.revision})
    await db.commit()
    from app.routers.demo_requests import _dispatch_multiple_demo_notifications
    background_tasks.add_task(_dispatch_multiple_demo_notifications,str(batch_id),
        {'id':str(requester.id),'name':requester.display_name or requester.email,'email':requester.email},c['customer_name'],c['project_name'],targets)
    return await detail(db,plan)


@router.post('/{plan_id}/cancel')
async def cancel(plan_id:uuid.UUID,body:MeetingAction,db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    plan=await load_plan(db,plan_id,user,lock=True);editable(plan,body.expected_revision)
    if not body.confirmed:raise HTTPException(422,'Confirm cancellation.')
    plan.state='Cancelled';plan.revision+=1;plan.updated_at=datetime.now(timezone.utc)
    audit(db,plan,user,'cancelled',{'revision':plan.revision});await db.commit();return await detail(db,plan)


@router.get('/{plan_id}/history')
async def history(plan_id:uuid.UUID,db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    await load_plan(db,plan_id,user)
    rows=(await db.execute(select(ActivityLog).where(ActivityLog.entity_id==plan_id,ActivityLog.entity_type=='meeting_plan')
                          .order_by(ActivityLog.created_at,ActivityLog.id))).scalars().all()
    ids=[r.actor_id for r in rows if r.actor_id]
    people=(await db.execute(select(UserProfile).where(UserProfile.id.in_(ids)))).scalars().all() if ids else []
    by_id={p.id:p.display_name or p.email for p in people}
    return {'items':[{'id':str(r.id),'action':r.action,'actor':by_id.get(r.actor_id,'Former user'),
                      'at':r.created_at,'details':r.log_metadata} for r in rows]}


@router.get('/{plan_id}/invite')
async def invite(plan_id:uuid.UUID,db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    plan=await load_plan(db,plan_id,user)
    if plan.state not in ('Finalized','Scheduled'):raise HTTPException(409,'Save the meeting details before downloading its calendar invite.')
    if not plan.content.get('starts_at'):raise HTTPException(409,'Save meeting details in Schedule meeting before downloading a calendar invite.')
    associations=await tags(db,plan)
    try:data=calendar_invite(plan,[t.asset_title for t in associations],plan.content['organizer_email'],plan.content['final_attendees'])
    except ValueError as exc:raise HTTPException(409,str(exc)) from exc
    audit(db,plan,user,'invite_downloaded',{'revision':plan.revision});await db.commit()
    return Response(data,media_type='text/calendar; charset=utf-8',headers={'Content-Disposition':f'attachment; filename="aimplify-meeting-{plan.id}.ics"'})


@router.patch('/{plan_id}/schedule')
async def update_schedule(plan_id:uuid.UUID,body:MeetingScheduleUpdate,db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    plan=await load_plan(db,plan_id,user,lock=True)
    if plan.state not in ('Finalized','Scheduled'):raise HTTPException(409,'Use Schedule meeting to create an independent meeting, or open a saved meeting.')
    if plan.revision!=body.expected_revision:raise HTTPException(409,'This request changed. Refresh it before saving meeting details.')
    schedule=body.model_dump(mode='json',exclude={'expected_revision','title','requirements','asset_ids'})
    if (body.requirements is not None or body.asset_ids is not None) and plan.state!='Scheduled':
        raise HTTPException(422,'Submitted demo request requirements and assets cannot be changed by scheduling.')
    if body.requirements is not None:schedule['requirements']=body.requirements.strip()
    if body.title is not None:
        if plan.state!='Scheduled':raise HTTPException(422,'Submitted demo request titles cannot be changed by scheduling.')
        if not body.title.strip():raise HTTPException(422,'Meeting title is required.')
        schedule['title']=body.title.strip()
    try:validate_schedule(schedule)
    except ValueError as exc:raise HTTPException(422,str(exc)) from exc
    previous=plan.content
    plan.content={**previous,**schedule}
    associations=await tags(db,plan)
    ids=[t.asset_id for t in associations if t.asset_id]
    if body.asset_ids is not None:
        assets=await assets_for_selection(db,body.asset_ids)
        await replace_tags(db,plan,assets)
    else:
        assets=(await db.execute(select(CatalogAsset).where(CatalogAsset.id.in_(ids)))).scalars().all() if ids else []
    requester,emails,_=await recipients(db,plan,assets)
    now=datetime.now(timezone.utc)
    plan.content={**plan.content,'final_attendees':emails,'organizer_email':requester.email,'schedule_saved_at':now.isoformat()}
    plan.revision+=1;plan.updated_at=now
    audit(db,plan,user,'schedule_updated' if previous.get('starts_at') else 'meeting_scheduled',
        {'changes':{k:{'before':previous.get(k),'after':v} for k,v in schedule.items() if previous.get(k)!=v},
         'assets_added':sorted(str(a.id) for a in assets if a.id not in ids),
         'assets_removed':sorted(str(i) for i in ids if i not in {a.id for a in assets}),
         'attendees':emails,'revision':plan.revision})
    await db.commit()
    return await detail(db,plan)
