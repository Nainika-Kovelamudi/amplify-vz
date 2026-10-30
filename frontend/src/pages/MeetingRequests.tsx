import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, Plus, RefreshCw, X } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { apiErrorMessage } from '../lib/apiError';
import { getCatalog, type CatalogAsset } from '../lib/catalogService';
import { StandaloneMeetings } from '../components/demo/StandaloneMeetings';
import { PlannerConversation, type PlannerTurn } from '../components/demo/PlannerConversation';

type Content={title:string;customer_name:string;project_name:string;vertical:string;requirements:string;agenda:string;
  starts_at:string|null;duration_minutes:number;timezone:string;attendees:string[];location:string;meeting_url:string;platform_demo:boolean};
type Form=Omit<Content,'starts_at'|'attendees'> & {starts_at:string;attendees:string};
type Plan={id:string;state:string;revision:number;content:Content;assets:{asset_id:string|null;title:string;selected_via:string;available:boolean}[];
  recommendations:{asset_id:string;title:string;reason:string}[];recommendations_current:boolean;conversation?:PlannerTurn[];invite_attendees:string[];attendees_fingerprint:string;
  batch_id:string|null;requests:{id:string;asset_id:string|null;type:string;status:string}[]};
type Summary={id:string;title:string;customer_name:string;state:string;starts_at:string|null;updated_at:string};
const BASE='/meeting-plans';
const VERTICALS=['TMT','RCL','BFSI','AMI','HLM','PLATINUM'];
const field='mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50';
const button='inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const primary=button+' !border-sky-600 !bg-sky-600 !text-white hover:!bg-sky-700';
const zone=Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
function blank():Form{return {title:'',customer_name:'',project_name:'',vertical:'',requirements:'',agenda:'',starts_at:'',duration_minutes:60,timezone:zone,attendees:'',location:'',meeting_url:'',platform_demo:false};}
function localTime(iso:string|null){if(!iso)return '';const d=new Date(iso);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
function Label({title,children,wide=false}:{title:string;children:ReactNode;wide?:boolean}){return <label className={`block text-xs font-semibold text-slate-600 ${wide?'sm:col-span-2':''}`}>{title}{children}</label>;}

export function MeetingRequests(){
  const {planId}=useParams();const [params]=useSearchParams();
  const [plans,setPlans]=useState<Summary[]>([]),[total,setTotal]=useState(0),[assets,setAssets]=useState<CatalogAsset[]>([]);
  const [plan,setPlan]=useState<Plan|null>(null),[form,setForm]=useState<Form>(()=>({...blank(),requirements:(params.get('requirements')||'').slice(0,5000)}));
  const [selected,setSelected]=useState<string[]>(()=>params.get('asset')?[params.get('asset')!]:[]);
  const [search,setSearch]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [dirty,setDirty]=useState(false),[review,setReview]=useState(false),[confirmed,setConfirmed]=useState(false);
  const [listFilter,setListFilter]=useState('All');
  const [section,setSection]=useState<'request'|'schedule'>('request');
  const loadList=useCallback(async()=>{const {data}=await apiClient.get<{items:Summary[];total:number}>(BASE,{params:{limit:200}});setPlans(data.items);setTotal(data.total);},[]);
  const apply=(p:Plan)=>{setPlan(p);setForm({...p.content,starts_at:localTime(p.content.starts_at),timezone:zone,attendees:p.content.attendees.join(', ')});setSelected(p.assets.flatMap(a=>a.asset_id?[a.asset_id]:[]));setDirty(false);setReview(false);setConfirmed(false);};
  const open=async(id:string)=>{
    if(dirty&&!window.confirm('Discard unsaved changes and open this request?'))return;
    setBusy(true);setError('');setNotice('');
    try{const {data}=await apiClient.get<Plan>(BASE+'/'+id);apply(data);}catch(e){setError(apiErrorMessage(e,'Request could not be loaded.'));}finally{setBusy(false);}
  };
  useEffect(()=>{let active=true;setLoading(true);Promise.all([loadList(),getCatalog({limit:500})]).then(([,data])=>{if(active)setAssets(data.items.filter(a=>a.status==='Published'));}).catch(e=>{if(active)setError(apiErrorMessage(e,'Meeting requests could not be loaded.'));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[loadList]);
  useEffect(()=>{if(planId&&planId!=='new')void open(planId);},[planId]); // deep links are loaded once per route
  const suggestionsCurrent=Boolean(plan?.recommendations_current && ['title','requirements','vertical','agenda'].every(key=>form[key as keyof Form]===plan.content[key as keyof Content]));
  const editable=!plan||plan.state==='Draft';
  const disabled=busy||!editable||review;
  const set=<K extends keyof Form>(key:K,value:Form[K])=>{setForm(previous=>({...previous,[key]:value}));setDirty(true);setConfirmed(false);};
  const choose=(id:string,checked:boolean)=>{setSelected(previous=>checked?[...new Set([...previous,id])]:previous.filter(v=>v!==id));setDirty(true);setConfirmed(false);};
  const payload=()=>({...form,starts_at:form.starts_at?new Date(form.starts_at).toISOString():null,attendees:form.attendees.split(/[,;\n]/).map(v=>v.trim()).filter(Boolean),asset_ids:selected});
  const persist=async()=>{
    const body=payload();const {data}=plan?await apiClient.patch<Plan>(BASE+'/'+plan.id,{...body,expected_revision:plan.revision}):await apiClient.post<Plan>(BASE,body);
    apply(data);await loadList();return data;
  };
  const perform=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(apiErrorMessage(e,'This action could not be completed.'));}finally{setBusy(false);}};
  const save=()=>perform(async()=>{await persist();setNotice('Draft saved. No demo requests or invitations have been sent.');});
  const converse=async(message:string,requestId:string)=>{
    setBusy(true);setError('');setNotice('');
    try{const saved=plan&&!dirty?plan:await persist();const {data}=await apiClient.post<Plan>(BASE+'/'+saved.id+'/planner-chat',{message,request_id:requestId,expected_revision:saved.revision},{timeout:75000});apply(data);return true;}
    catch(error){setError(apiErrorMessage(error,'The planner could not reply. Your question is retained so you can retry.'));return false;}
    finally{setBusy(false);}
  };
  const prepare=()=>perform(async()=>{await persist();setReview(true);setConfirmed(false);});
  const finalize=()=>perform(async()=>{if(!plan||!confirmed)return;const {data}=await apiClient.post<Plan>(BASE+'/'+plan.id+'/finalize',{expected_revision:plan.revision,confirmed:true,attendees_fingerprint:plan.attendees_fingerprint});apply(data);await loadList();setNotice('Demo request submitted to the corresponding owners. Meetings can be created independently in the Schedule meeting subtab.');});
  const cancel=()=>perform(async()=>{if(!plan||!window.confirm('Cancel this draft?'))return;const {data}=await apiClient.post<Plan>(BASE+'/'+plan.id+'/cancel',{expected_revision:plan.revision,confirmed:true});apply(data);await loadList();setNotice('Draft cancelled.');});
  const reset=()=>{if(dirty&&!window.confirm('Discard unsaved changes?'))return;setPlan(null);setForm(blank());setSelected([]);setDirty(false);setReview(false);setConfirmed(false);setError('');setNotice('');setSection('request');};
  const name=(id:string)=>assets.find(a=>a.id===id)?.title||plan?.assets.find(a=>a.asset_id===id)?.title||plan?.recommendations.find(a=>a.asset_id===id)?.title||id;
  const visible=assets.filter(a=>`${a.title} ${a.family} ${a.description}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-900">Meeting / Demo Requests</h1><p className="mt-1 text-sm text-slate-500">Raise demo requests to owners or create a meeting independently.</p></div><div id="meeting-console-actions"><button className={primary} hidden={section!=='request'} disabled={busy} onClick={reset}><Plus className="h-4 w-4"/>New request</button></div></div>
        <div role="tablist" aria-label="Demo request console" className="mb-5 flex flex-wrap border-b border-slate-200" onKeyDown={event=>{
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
          event.preventDefault();const next=event.key==='Home'?'request':event.key==='End'?'schedule':section==='request'?'schedule':'request';
          setSection(next);document.getElementById('demo-tab-'+next)?.focus();
        }}>
          {(['request','schedule'] as const).map(tab=><button key={tab} id={'demo-tab-'+tab} type="button" role="tab" aria-selected={section===tab} aria-controls={'demo-panel-'+tab} tabIndex={section===tab?0:-1} onClick={()=>setSection(tab)}
            className={`cursor-pointer border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${section===tab?'border-sky-600 text-sky-700':'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}>
            {tab==='request'?'Raise demo request':'Schedule meeting'}
          </button>)}
        </div>
    <div className={section==='request'?"grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]":"space-y-5"}>
      <aside hidden={section!=='request'} className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Requests ({total})</h2><button className={button} disabled={busy} onClick={()=>void perform(loadList)} aria-label="Refresh meeting requests"><RefreshCw className="h-4 w-4"/></button></div><select aria-label="Request status" className={field} value={listFilter} onChange={e=>setListFilter(e.target.value)}>{['All','Draft','Finalized','Cancelled'].map(s=><option key={s}>{s}</option>)}</select>
        {loading&&<p className="py-4 text-sm text-slate-500">Loading requests…</p>}<div className="mt-3 max-h-[36rem] space-y-2 overflow-y-auto">{plans.filter(p=>listFilter==='All'||p.state===listFilter).map(p=><button key={p.id} disabled={busy} onClick={()=>void open(p.id)} className={`w-full cursor-pointer rounded-lg border p-3 text-left ${p.id===plan?.id?'border-sky-300 bg-sky-50':'border-slate-100 hover:bg-slate-50'}`}><p className="text-sm font-semibold">{p.title}</p><p className="mt-1 text-xs text-slate-500">{p.customer_name||'Customer not supplied'} · {p.state}</p>{p.starts_at&&<p className="mt-1 text-xs text-slate-500">{new Date(p.starts_at).toLocaleString()}</p>}</button>)}</div>
        {total>plans.length&&<button className={button+' mt-3 w-full'} disabled={busy} onClick={()=>void perform(async()=>{const {data}=await apiClient.get<{items:Summary[];total:number}>(BASE,{params:{skip:plans.length,limit:200}});setPlans(previous=>[...previous,...data.items]);setTotal(data.total);})}>Load more requests</button>}
      </aside>
      <main className="min-w-0 space-y-5">
    {section==='request'&&error&&<p role="alert" className="mb-4 whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {section==='request'&&notice&&<p role="status" className="mb-4 rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-800">{notice}</p>}
        <div id="demo-panel-request" role="tabpanel" aria-labelledby="demo-tab-request" hidden={section!=='request'} className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Demo request details</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{plan?.state||'New draft'}{dirty?' · Unsaved changes':''}</span></div>
          <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
            <Label title="Demo request title *" wide><input className={field} maxLength={200} value={form.title} onChange={e=>set('title',e.target.value)}/></Label>
            <Label title="Customer *"><input className={field} maxLength={200} value={form.customer_name} onChange={e=>set('customer_name',e.target.value)}/></Label>
            <Label title="Project *"><input className={field} maxLength={200} value={form.project_name} onChange={e=>set('project_name',e.target.value)}/></Label>
            <Label title="Vertical / Industry"><select className={field} value={form.vertical} onChange={e=>set('vertical',e.target.value)}>
              <option value="">Select a vertical…</option>
              {form.vertical&&!VERTICALS.includes(form.vertical)&&<option value={form.vertical}>{form.vertical}</option>}
              {VERTICALS.map(vertical=><option key={vertical} value={vertical}>{vertical}</option>)}
            </select></Label>
            <Label title="Demo requirements / customer need *" wide><textarea className={field} rows={4} maxLength={5000} value={form.requirements} onChange={e=>set('requirements',e.target.value)} placeholder="Describe the customer's use case and what the demo should demonstrate…"/></Label>
          </fieldset><p className="mt-3 text-xs text-slate-500">Submit this section to request a demo from the selected owners. A meeting date, time and attendees are not required.</p>
        </section>
        <PlannerConversation contextId={plan?.id} turns={plan?.conversation||[]} suggestions={plan?.recommendations||[]} selected={selected} requirements={form.requirements} current={suggestionsCurrent} disabled={!editable||review} busy={busy} canSend={true} onSend={converse} onChoose={choose}/>
        <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Selected accelerators ({selected.length})</h2><div className="mt-3 flex flex-wrap gap-2">{selected.map(id=><span key={id} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800"><span className="break-words">{name(id)}{plan?.assets.find(a=>a.asset_id===id)?.available===false?' — no longer active':''}</span>{!disabled&&<button aria-label={'Remove '+name(id)} onClick={()=>choose(id,false)}><X className="h-3.5 w-3.5"/></button>}</span>)}</div>
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={form.platform_demo} onChange={e=>set('platform_demo',e.target.checked)}/>AImplify Platform Demo (routes to platform Owners)</label>
          {editable&&<><input className={field+' mt-4'} aria-label="Search accelerators" placeholder="Search active accelerators…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{visible.map(a=><label key={a.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3"><input type="checkbox" disabled={disabled||(!selected.includes(a.id)&&selected.length>=100)} checked={selected.includes(a.id)} onChange={e=>choose(a.id,e.target.checked)}/><span className="min-w-0"><span className="block text-sm font-medium">{a.title}</span><span className="block text-xs text-slate-500">{a.family}</span></span></label>)}</div><p className="mt-2 text-xs text-slate-500">Only active published accelerators can be requested. Deprecated and Decommissioned assets are excluded.</p></>}
        </section>
        {review&&plan&&<section className="rounded-xl border border-sky-200 bg-sky-50 p-5"><h2 className="font-semibold">Review and finalize</h2><p className="mt-2 text-sm">{form.title} · {form.customer_name} · {form.project_name}</p><p className="mt-3 text-xs font-semibold">Request recipients</p><p className="mt-1 break-words text-sm">{plan.invite_attendees.join(', ')}</p><p className="mt-3 text-xs text-slate-600">Submitting routes the demo requests to the selected asset owners or platform owners. Meeting scheduling is an independent workflow in the other subtab.</p><label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed the demo requirements, selected accelerators and recipients.</label><div className="mt-4 flex gap-3"><button className={primary} disabled={busy||!confirmed} onClick={()=>void finalize()}>Submit demo request</button><button className={button} disabled={busy} onClick={()=>{setReview(false);setConfirmed(false);}}>Back to editing</button></div></section>}
        {editable&&!review&&<div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={()=>void save()}>Save draft</button><button className={primary} disabled={busy} onClick={()=>void prepare()}><CalendarDays className="h-4 w-4"/>Review request</button>{plan&&<button className={button} disabled={busy} onClick={()=>void cancel()}>Cancel draft</button>}</div>}
        {plan?.state==='Finalized'&&<section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-semibold">Demo request submitted</h2><p className="mt-2 text-sm">Each selected asset follows its owner's approval flow. You can track decisions in Pipeline → My Demo Requests.</p><div className="mt-3 space-y-1 text-xs">{plan.requests.map(r=><p key={r.id}>{r.type==='platform'?'AImplify Platform Demo':name(r.asset_id||'')} — {r.status}</p>)}</div></section>}
        </div>
        <div id="demo-panel-schedule" role="tabpanel" aria-labelledby="demo-tab-schedule" hidden={section!=='schedule'}><StandaloneMeetings active={section==='schedule'}/></div>
      </main>
    </div>
  </div>;
}
