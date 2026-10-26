import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MetadataStandardization } from './MetadataStandardization';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';

type Job = { state: string; error: string | null; attempts: number };
type Asset = { id: string; title: string; slug: string; catalog_code: string; owner_email: string; evaluation_health: string;
  missing_repository: boolean; invalid_cloud_tags: boolean; storage_files_to_finalize: number; storage_error?: string | null; evaluation_job: Job | null; storage_job: Job | null };
type Person = { id: string; name: string; email: string };
type Item = { id: string; asset_id: string | null; asset_title: string; category: string; title: string; action: string;
  state: string; severity: string; assignee_id: string | null; due_at: string | null; evidence: string | null; reviewer_id: string | null; reviewed_at: string | null };
type Plan = { asset_id: string; asset_title: string; fingerprint: string; notice: string; files: { source: string; destination: string; name: string }[] };
const BASE = '/admin/platform-operations';
const button = 'cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const input = 'w-full rounded-lg border border-slate-200 bg-white p-2 text-sm';
const STATES = ['Open','In Progress','Blocked','Ready for Review','Closed'];
function errorMessage(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
  return typeof detail === 'string' ? detail : 'Operation could not be completed. Check migration 036 and backend availability, then retry.';
}

export function PlatformOperations() {
  const { user } = useAuth();
  const editorRef=useRef<HTMLDivElement>(null),planRef=useRef<HTMLDivElement>(null);
  const admin = user?.role === 'Aimplify.Owner' || user?.role === 'Aimplify.Admin';
  const [view,setView] = useState<'inventory'|'remediations'|'metadata'>(admin ? 'inventory':'remediations');
  const [assets,setAssets] = useState<Asset[]>([]), [items,setItems] = useState<Item[]>([]), [people,setPeople] = useState<Person[]>([]);
  const [selected,setSelected] = useState<string[]>([]), [search,setSearch] = useState(''), [filter,setFilter] = useState('');
  const [loading,setLoading] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [plan,setPlan] = useState<Plan | null>(null), [renames,setRenames] = useState<Record<string,string>>({}), [confirmed,setConfirmed] = useState(false);
  const [edit,setEdit] = useState<Item | null>(null), [state,setState] = useState('Open'), [evidence,setEvidence] = useState(''), [assignee,setAssignee] = useState(''), [due,setDue] = useState(''), [severity,setSeverity] = useState('Medium');
  const [creating,setCreating] = useState(false), [newAsset,setNewAsset] = useState('platform'), [title,setTitle] = useState(''), [action,setAction] = useState('');
  useEffect(()=>{ if(edit) editorRef.current?.scrollIntoView({behavior:'smooth',block:'center'}); },[edit]);
  useEffect(()=>{ if(plan) planRef.current?.scrollIntoView({behavior:'smooth',block:'start'}); },[plan]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const first = await apiClient.get<{items: Item[];total:number}>(BASE+'/remediations',{params:{limit:500}});
      const all=[...first.data.items];
      for(let skip=500;skip<first.data.total;skip+=500) all.push(...(await apiClient.get<{items:Item[]}>(BASE+'/remediations',{params:{skip,limit:500}})).data.items);
      setItems(all);
      if(admin) {
        const [inventory,users] = await Promise.all([apiClient.get<{assets:Asset[];worker_enabled:boolean}>(BASE+'/inventory'),apiClient.get<Person[]>(BASE+'/assignees')]);
        setAssets(inventory.data.assets);setPeople(users.data);
        if(!inventory.data.worker_enabled) setNotice('Evaluation worker is disabled. Queued operations will wait until it is enabled.');
      }
    } catch(e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  },[admin]);
  useEffect(()=>{ void load(); },[load]);
  const perform = async (operation:()=>Promise<unknown>,message:string) => {
    setBusy(true);setError('');setNotice('');
    try { await operation();setNotice(message);await load(); } catch(e){setError(errorMessage(e));} finally{setBusy(false);}
  };
  const queue = (ids:string[],force=false) => perform(async()=>{
    await apiClient.post(BASE+'/evaluations',{asset_ids:ids,force});setSelected([]);
  },'Evaluation queued. Refresh to see progress; publishing status is preserved.');
  const exportItems = () => perform(async()=>{
    const {data}=await apiClient.get<Blob>(BASE+'/remediations',{params:{format:'csv'},responseType:'blob'});
    const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download='AIMPLIFY_Remediations.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },'Remediation export downloaded.');
  const openEdit=(item:Item)=>{setEdit(item);setState(item.state);setEvidence(item.evidence||'');setAssignee(item.assignee_id||'');setDue(item.due_at?.slice(0,10)||'');setSeverity(item.severity);};
  const save = () => perform(async()=>{
    if(!edit)return;
    await apiClient.patch(BASE+'/remediations/'+edit.id,{state,evidence,...(admin?{assignee_id:assignee||null,due_at:due?due+'T23:59:59Z':null,severity}:{})});setEdit(null);
  },'Remediation updated and audit history recorded.');
  const visibleAssets=assets.filter(a=>`${a.title} ${a.catalog_code} ${a.owner_email}`.toLowerCase().includes(search.toLowerCase()) &&
    (!filter || (filter==='repository'?a.missing_repository:filter==='cloud'?a.invalid_cloud_tags:filter==='storage'?a.storage_files_to_finalize>0:a.evaluation_health!=='Complete')));
  const visibleItems=items.filter(i=>`${i.title} ${i.asset_title} ${i.category}`.toLowerCase().includes(search.toLowerCase())&&(!filter||i.state===filter));
  const activeJob=(a:Asset)=>['Queued','Running'].includes(a.evaluation_job?.state||'');
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{admin?'Asset operations':'My remediation tasks'}</h2><p className="text-xs text-slate-500">Evaluation recovery, evidence-based corrections and tracked owner actions.</p></div><button className={button} onClick={()=>void load()} disabled={loading||busy}>{loading?'Loading…':'Refresh'}</button></div>
    {error&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {notice&&<p role="status" className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-700">{notice}</p>}
    <div className="flex flex-wrap gap-2">{admin&&<button className={button} aria-pressed={view==='inventory'} onClick={()=>{setView('inventory');setFilter('');}}>Asset inventory ({assets.length})</button>}<button className={button} aria-pressed={view==='remediations'} onClick={()=>{setView('remediations');setFilter('');}}>Remediations ({items.length})</button>{admin&&<button className={button} aria-pressed={view==='metadata'} onClick={()=>{setView('metadata');setFilter('');}}>Metadata standardization</button>}</div>
    {view==='metadata'&&admin?<MetadataStandardization/>:<>
    <div className="flex flex-wrap gap-2"><input className={input+' min-w-48 flex-1'} aria-label="Search asset operations" placeholder="Search asset, issue or owner" value={search} onChange={e=>setSearch(e.target.value)}/><select className={input+' !w-auto'} aria-label="Filter operations" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All records</option>{(view==='inventory'?['evaluation','repository','cloud','storage']:STATES).map(v=><option key={v} value={v}>{v==='evaluation'?'Missing / failed / stale evaluation':v==='repository'?'Missing / invalid repository':v==='cloud'?'Missing / invalid cloud tags':v==='storage'?'Storage finalization needed':v}</option>)}</select></div>
    {view==='inventory'&&admin?<>
      <div className="flex flex-wrap items-center gap-2"><button className={button} disabled={busy||!selected.length} onClick={()=>void queue(selected)}>Queue selected evaluations ({selected.length})</button><button className={button} onClick={()=>setSelected(visibleAssets.filter(a=>a.evaluation_health!=='Complete'&&!activeJob(a)).slice(0,100).map(a=>a.id))}>Select up to 100 incomplete evaluations</button><button className={button} onClick={()=>setSelected([])}>Clear selection</button></div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['','Asset / owner','Evaluation','Metadata gaps','Storage / actions'].map((t,i)=><th key={i} className="p-3">{t}</th>)}</tr></thead><tbody>{visibleAssets.map(a=><tr key={a.id} className="border-t border-slate-100"><td className="p-3"><input type="checkbox" aria-label={'Select '+a.title} checked={selected.includes(a.id)} disabled={a.evaluation_health==='Complete'||activeJob(a)||busy} onChange={e=>setSelected(prev=>e.target.checked?[...prev,a.id].slice(0,100):prev.filter(id=>id!==a.id))}/></td><td className="p-3"><Link className="font-semibold text-indigo-700 underline" to={'/catalog/'+a.slug}>{a.title}</Link><p className="text-slate-400">{a.catalog_code} · {a.owner_email||'Owner missing'}</p></td><td className="p-3">{a.evaluation_health}<p className="text-slate-400">{a.evaluation_job?.state||'No queued job'}</p>{a.evaluation_job?.error&&<p className="mt-1 max-w-60 text-rose-600">{a.evaluation_job.error}</p>}<button className={button+' mt-2'} disabled={busy||activeJob(a)} onClick={()=>{if(a.evaluation_health!=='Complete'||confirm('Refresh this complete evaluation? The existing approval/publication state will be preserved.'))void queue([a.id],a.evaluation_health==='Complete');}}>{a.evaluation_health==='Complete'?'Refresh evaluation':'Queue evaluation'}</button></td><td className="p-3">{a.missing_repository&&<p>Repository missing / invalid</p>}{a.invalid_cloud_tags&&<p>Cloud tags missing / invalid</p>}{!a.missing_repository&&!a.invalid_cloud_tags&&<p className="text-slate-400">No repository / cloud gaps</p>}</td><td className="p-3"><p>{a.storage_files_to_finalize} file(s) to finalize</p>{a.storage_error&&<p className="text-rose-600">{a.storage_error}</p>}<p className="text-slate-400">{a.storage_job?.state||'No storage job'}</p>{a.storage_job?.error&&<p className="mt-1 max-w-60 text-rose-600">{a.storage_job.error}</p>}<button className={button+' mt-2'} disabled={busy||!a.storage_files_to_finalize||['Queued','Running'].includes(a.storage_job?.state||'')} onClick={()=>void perform(async()=>{const {data}=await apiClient.get<Plan>(BASE+'/assets/'+a.id+'/storage-plan');setPlan(data);setRenames({});setConfirmed(false);},'Storage plan prepared. No files have been changed.')}>Review storage plan</button></td></tr>)}</tbody></table>{!visibleAssets.length&&<p className="p-5 text-sm text-slate-400">No matching assets.</p>}</div>
    </>:<>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={()=>void exportItems()}>Export remediation CSV</button>{admin&&<><button className={button} disabled={busy} onClick={()=>{if(confirm('Create owner-assigned remediation tasks from current documentation and metadata gaps? Existing items are retained; default deadline is 14 days.'))void perform(()=>apiClient.post(BASE+'/remediations/from-audit'),'Audit findings converted into tracked tasks. Existing items were not duplicated.');}}>Create tasks from current audit</button><button className={button} onClick={()=>{setCreating(!creating);setAssignee('');setDue('');}}>Add remediation</button></>}</div>
      {creating&&admin&&<div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-semibold">New remediation</h3><select className={input} aria-label="Remediation asset" value={newAsset} onChange={e=>setNewAsset(e.target.value)}><option value="platform">AImplify platform (all assets / shared issue)</option>{assets.map(a=><option key={a.id} value={a.id}>{a.title} ({a.catalog_code})</option>)}</select><input className={input} placeholder="Issue title" aria-label="Issue title" value={title} onChange={e=>setTitle(e.target.value)}/><textarea className={input} placeholder="Required owner action" aria-label="Required owner action" value={action} onChange={e=>setAction(e.target.value)}/><select className={input} aria-label="New remediation assignee" value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="">Unassigned</option>{people.map(p=><option key={p.id} value={p.id}>{p.name} — {p.email}</option>)}</select><label className="block text-xs text-slate-500">Due date (UTC)<input type="date" className={input} value={due} onChange={e=>setDue(e.target.value)}/></label><button className={button} disabled={busy||!newAsset||title.trim().length<3||action.trim().length<5} onClick={()=>void perform(async()=>{await apiClient.post(BASE+'/remediations',{asset_id:newAsset==='platform'?null:newAsset,category:'Manual review',title,action,assignee_id:assignee||null,due_at:due?due+'T23:59:59Z':null});setCreating(false);setTitle('');setAction('');},'Remediation created.')}>Create task</button></div>}
      <div className="space-y-3">{visibleItems.map(item=><article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-slate-900">{item.title}</h3><p className="text-xs text-slate-400">{item.asset_title} · {item.category} · {item.severity}</p></div><span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{item.state}</span></div><p className="my-3 text-sm text-slate-600">{item.action}</p><p className="text-xs text-slate-400">Assignee: {people.find(p=>p.id===item.assignee_id)?.email || (item.assignee_id===user?.id?'You':item.assignee_id||'Unassigned')} · Due: {item.due_at?new Date(item.due_at).toLocaleDateString():'Not set'}</p>{item.evidence&&<p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{item.evidence}</p>}{item.reviewed_at&&<p className="mt-2 text-xs text-slate-400">Reviewed by {people.find(p=>p.id===item.reviewer_id)?.email||item.reviewer_id} · {new Date(item.reviewed_at).toLocaleString()}</p>}<button className={button+' mt-3'} disabled={!admin&&item.state==='Closed'} onClick={()=>openEdit(item)}>Update / submit evidence</button></article>)}{!visibleItems.length&&<p className="p-4 text-sm text-slate-400">No remediation tasks match the current filters.</p>}</div>
    </>}
    {edit&&<div ref={editorRef} className="rounded-xl border border-indigo-200 bg-indigo-50 p-4" role="region" aria-label="Update remediation"><h3 className="mb-3 font-semibold">Update: {edit.title}</h3><div className="space-y-3"><select className={input} aria-label="Remediation state" value={state} onChange={e=>setState(e.target.value)}>{STATES.filter(s=>admin||s!=='Closed').map(s=><option key={s}>{s}</option>)}</select>{admin&&<><select className={input} aria-label="Remediation assignee" value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="">Unassigned</option>{people.map(p=><option key={p.id} value={p.id}>{p.name} — {p.email}</option>)}</select><label className="block text-xs">Due date (UTC)<input className={input} type="date" value={due} onChange={e=>setDue(e.target.value)}/></label><select className={input} aria-label="Severity" value={severity} onChange={e=>setSeverity(e.target.value)}>{['Low','Medium','High','Critical'].map(s=><option key={s}>{s}</option>)}</select></>}<textarea className={input} rows={4} placeholder="Resolution evidence / verification notes" aria-label="Resolution evidence" value={evidence} onChange={e=>setEvidence(e.target.value)}/><p className="text-xs text-slate-500">Ready for Review and Closed require evidence. Closure requires a reviewer other than the assignee.</p><button className={button} disabled={busy} onClick={()=>void save()}>Save changes</button><button className={button+' ml-2'} disabled={busy} onClick={()=>setEdit(null)}>Cancel</button></div></div>}
    {plan&&<div ref={planRef} className="space-y-3 rounded-xl border border-indigo-200 bg-white p-4"><h3 className="font-semibold">Storage plan — {plan.asset_title}</h3><p className="text-xs text-slate-500">{plan.notice}</p>{plan.files.map(f=><div key={f.source} className="rounded-lg bg-slate-50 p-3 text-xs"><p className="break-all">From: {f.source}</p><p className="break-all">To: {f.destination}</p><label className="mt-2 block">Destination filename (optional correction)<input className={input+' mt-1'} value={renames[f.source]??f.destination.split('/').pop()??''} onChange={e=>setRenames(prev=>({...prev,[f.source]:e.target.value}))}/></label></div>)}<label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I have confirmed that these files belong to this asset.</label><button className={button} disabled={busy||!confirmed||!plan.files.length} onClick={()=>void perform(async()=>{await apiClient.post(BASE+'/assets/'+plan.asset_id+'/finalize-storage',{fingerprint:plan.fingerprint,renames,confirmed_asset_association:confirmed});setPlan(null);},'Storage finalization queued. Original blobs are retained; verify playback when the job completes.')}>Queue verified copy</button><button className={button+' ml-2'} disabled={busy} onClick={()=>setPlan(null)}>Cancel</button></div>}
    </>}
  </section>;
}
