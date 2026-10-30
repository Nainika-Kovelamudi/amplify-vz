import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { apiErrorMessage } from '../../lib/apiError';
import { invalidateCatalogCache } from '../../lib/catalogService';
type Item={id:string;title:string;status:string;restricted:boolean;can_change:boolean;can_restore:boolean};
const button='cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const input='w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm';
export function LifecycleBadge({status}:{status:string}) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status==='Decommissioned'?'bg-rose-100 text-rose-800':status==='Deprecated'?'bg-amber-100 text-amber-800':'bg-emerald-100 text-emerald-800'}`}>{status==='Published'?'Active':status}</span>;
}
function LifecycleEditor({item,onSaved}:{item:Item;onSaved:()=>Promise<void>}) {
  const [open,setOpen]=useState(false),[status,setStatus]=useState(''),[reason,setReason]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  if(!item.can_change)return null;
  const options=['Deprecated','Decommissioned',...(item.can_restore?['Published']:[])].filter(v=>v!==item.status);
  const save=async()=>{
    setBusy(true);setError('');
    try {await apiClient.patch('/asset-lifecycle/'+item.id,{status,expected_status:item.status,reason});invalidateCatalogCache();await onSaved();setOpen(false);setReason('');}
    catch(e){setError(apiErrorMessage(e,'Lifecycle status could not be changed.'));}finally{setBusy(false);}
  };
  return <div className="mt-3"><button className={button} onClick={()=>{setOpen(!open);setStatus(options[0]||'');}}>Change lifecycle status</button>
    {open&&<div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="block text-xs font-semibold">New lifecycle status<select className={input+' mt-1'} value={status} disabled={busy} onChange={e=>setStatus(e.target.value)}>{options.map(v=><option key={v} value={v}>{v==='Published'?'Restore to Active':v}</option>)}</select></label>
      <label className="block text-xs font-semibold">Reason<textarea className={input+' mt-1'} rows={3} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
      <p className="text-xs text-slate-600">Deprecated and decommissioned assets show only their name and status to users outside Admin/platform Owner roles.</p>
      <button className={button} disabled={busy||reason.trim().length<5||!status} onClick={()=>void save()}>{busy?'Saving…':'Confirm status change'}</button>
      {error&&<p role="alert" className="text-xs text-rose-700">{error}</p>}
    </div>}
  </div>;
}
export function AssetLifecyclePanel({initialStatus='All'}:{initialStatus?:string}) {
  const [status,setStatus]=useState(initialStatus),[search,setSearch]=useState(''),[items,setItems]=useState<Item[]>([]);
  const [error,setError]=useState(''),[loading,setLoading]=useState(false);
  const load=useCallback(async()=>{setLoading(true);setError('');try{const {data}=await apiClient.get<{items:Item[]}>('/asset-lifecycle',{params:{status}});setItems(data.items);}catch(e){setError(apiErrorMessage(e,'Asset lifecycle list could not be loaded.'));}finally{setLoading(false);}},[status]);
  useEffect(()=>{void load();},[load]);
  const visible=items.filter(i=>i.title.toLowerCase().includes(search.toLowerCase()));
  return <section className="space-y-4" aria-label="Asset lifecycle">
    <div className="flex flex-wrap items-center gap-3"><label className="text-xs font-semibold">Lifecycle status<select className={input+' mt-1'} value={status} onChange={e=>setStatus(e.target.value)}>{['Active','Deprecated','Decommissioned','All'].map(s=><option key={s}>{s}</option>)}</select></label><input className={input+' min-w-40 flex-1'} placeholder="Search asset name" aria-label="Search lifecycle assets" value={search} onChange={e=>setSearch(e.target.value)}/><button className={button} disabled={loading} onClick={()=>void load()}>Refresh</button></div>
    {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}{loading&&<p role="status" className="text-sm text-slate-500">Loading assets…</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map(item=><article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3">{item.restricted?<h3 className="text-sm font-semibold">{item.title}</h3>:<Link to={'/catalog/'+item.id} className="text-sm font-semibold text-indigo-700 underline">{item.title}</Link>}<LifecycleBadge status={item.status}/></div><LifecycleEditor key={item.status} item={item} onSaved={load}/></article>)}</div>
    {!loading&&!visible.length&&!error&&<p className="text-sm text-slate-500">No assets match this status.</p>}
  </section>;
}
export function AssetLifecycleControl({assetId,onSaved}:{assetId:string;onSaved:()=>Promise<void>}) {
  const [item,setItem]=useState<Item|null>(null);
  const load=useCallback(async()=>{const {data}=await apiClient.get<{items:Item[]}>('/asset-lifecycle',{params:{status:'All'}});setItem(data.items.find(v=>v.id===assetId)||null);},[assetId]);
  useEffect(()=>{void load().catch(()=>setItem(null));},[load]);
  if(!item)return null;
  return <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4"><LifecycleBadge status={item.status}/><LifecycleEditor key={item.status} item={item} onSaved={async()=>{await load();await onSaved();}}/></div>;
}
