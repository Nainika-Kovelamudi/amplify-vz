import { createPortal } from 'react-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { Download, Plus, RefreshCw, X } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { apiErrorMessage } from '../../lib/apiError';
import { PlannerConversation, type PlannerTurn } from './PlannerConversation';
import { DirectoryAttendeePicker } from './DirectoryAttendeePicker';
import { getCatalog, type CatalogAsset } from '../../lib/catalogService';

const BASE='/meeting-plans';
const zone=Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const field='mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50';
const button='inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const primary=button+' !border-sky-600 !bg-sky-600 !text-white';
type MeetingForm={title:string;starts_at:string;duration_minutes:number;timezone:string;attendees:string;agenda:string;location:string;meeting_url:string;requirements:string};
type Meeting={id:string;revision:number;state:string;invite_attendees:string[];assets?:{asset_id:string|null;title:string;available:boolean}[];recommendations?:{asset_id:string;title:string;reason:string}[];recommendations_current?:boolean;conversation?:PlannerTurn[];content:Omit<MeetingForm,'attendees'> & {attendees:string[]}};
type Summary={id:string;title:string;starts_at:string;state:string};
type History={id:string;action:string;actor:string;at:string;details:Record<string,unknown>};
function blank():MeetingForm{return {title:'',starts_at:'',duration_minutes:60,timezone:zone,attendees:'',agenda:'',location:'',meeting_url:'',requirements:''};}
function localTime(value:string){const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
function Label({title,children,wide=false}:{title:string;children:ReactNode;wide?:boolean}){return <label className={`block text-xs font-semibold text-slate-600 ${wide?'sm:col-span-2':''}`}>{title}{children}</label>;}

/** Independent calendar planning: no demo request ID or selected request is required. */
export function StandaloneMeetings({active=false}:{active?:boolean}){
  const [actionHost,setActionHost]=useState<HTMLElement|null>(null);
  useEffect(()=>{setActionHost(document.getElementById('meeting-console-actions'));},[]);
  const [items,setItems]=useState<Summary[]>([]),[total,setTotal]=useState(0);
  const [meeting,setMeeting]=useState<Meeting|null>(null),[form,setForm]=useState(blank);
  const [history,setHistory]=useState<History[]>([]),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false);
  const [assets,setAssets]=useState<CatalogAsset[]>([]),[selected,setSelected]=useState<string[]>([]),[search,setSearch]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const loadList=async()=>{const {data}=await apiClient.get<{items:Summary[];total:number}>(BASE+'/standalone',{params:{limit:200}});setItems(data.items);setTotal(data.total);};
  const loadHistory=async(id:string)=>{const {data}=await apiClient.get<{items:History[]}>(BASE+'/'+id+'/history');setHistory(data.items);};
  useEffect(()=>{void getCatalog({limit:500}).then(data=>setAssets(data.items.filter(asset=>asset.status==='Published'))).catch(()=>setError('Accelerators could not be loaded. You can still save the meeting.'));void loadList().catch(e=>setError(apiErrorMessage(e,'Meetings could not be loaded.')));},[]);
  const apply=(data:Meeting)=>{setMeeting(data);setForm({title:data.content.title,starts_at:localTime(data.content.starts_at),duration_minutes:data.content.duration_minutes,timezone:zone,attendees:data.content.attendees.join(', '),agenda:data.content.agenda,location:data.content.location,meeting_url:data.content.meeting_url,requirements:data.content.requirements||''});setSelected((data.assets||[]).flatMap(asset=>asset.asset_id?[asset.asset_id]:[]));setDirty(false);};
  const perform=async(action:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await action();}catch(e){setError(apiErrorMessage(e,'Meeting action could not be completed.'));}finally{setBusy(false);}};
  const set=<K extends keyof MeetingForm>(key:K,value:MeetingForm[K])=>{setForm(previous=>({...previous,[key]:value}));setDirty(true);};
  const open=(id:string)=>perform(async()=>{if(dirty&&!window.confirm('Discard unsaved meeting changes?'))return;const {data}=await apiClient.get<Meeting>(BASE+'/'+id);apply(data);await loadHistory(id);});
  const reset=()=>{if(dirty&&!window.confirm('Discard unsaved meeting changes?'))return;setMeeting(null);setForm(blank());setSelected([]);setSearch('');setDirty(false);setHistory([]);setError('');setNotice('');};
  const persist=async()=>{
    const payload={...form,asset_ids:selected,starts_at:new Date(form.starts_at).toISOString(),attendees:form.attendees.split(/[,;\n]/).map(s=>s.trim()).filter(Boolean)};
    const {title,requirements,asset_ids,...details}=payload;
    const {data}=meeting?await apiClient.patch<Meeting>(BASE+'/'+meeting.id+'/schedule',{...details,...(meeting.state==='Scheduled'?{title,requirements,asset_ids}:{}),expected_revision:meeting.revision}):await apiClient.post<Meeting>(BASE+'/standalone',payload);
    apply(data);await loadList();await loadHistory(data.id);return data;
  };
  const save=()=>perform(async()=>{await persist();setNotice(meeting?.state==='Finalized'?'Existing meeting updated. No additional owner request was created.':'Meeting saved independently with its selected assets. No demo request or owner notification was created. Review recipients and download the calendar file.');});
  const converse=async(message:string,requestId:string)=>{
    setBusy(true);setError('');setNotice('');
    try{const saved=meeting&&!dirty?meeting:await persist();const {data}=await apiClient.post<Meeting>(BASE+'/'+saved.id+'/planner-chat',{message,request_id:requestId,expected_revision:saved.revision},{timeout:75000});apply(data);await loadHistory(data.id);return true;}
    catch(error){setError(apiErrorMessage(error,'The planner could not reply. Your question is retained so you can retry.'));return false;}
    finally{setBusy(false);}
  };
  const assetEditing=!meeting||meeting.state==='Scheduled';
  const suggestionsCurrent=Boolean(meeting?.recommendations_current&&['title','requirements','agenda'].every(key=>form[key as keyof MeetingForm]===meeting.content[key as keyof MeetingForm]));
  const choose=(id:string,checked:boolean)=>{setSelected(previous=>checked?[...new Set([...previous,id])]:previous.filter(value=>value!==id));setDirty(true);};
  const name=(id:string)=>assets.find(asset=>asset.id===id)?.title||meeting?.assets?.find(asset=>asset.asset_id===id)?.title||id;
  const visible=assets.filter(asset=>`${asset.title} ${asset.family} ${asset.description}`.toLowerCase().includes(search.toLowerCase()));
  const download=()=>perform(async()=>{if(!meeting)return;const {data}=await apiClient.get<Blob>(BASE+'/'+meeting.id+'/invite',{responseType:'blob'});const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download='aimplify-meeting.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);await loadHistory(meeting.id);setNotice('Calendar file downloaded. Open it in Outlook to review and arrange the meeting.');});
  return <div className="space-y-4">
    {active&&actionHost&&createPortal(<button className={primary} disabled={busy} onClick={reset}><Plus className="h-4 w-4"/>New meeting</button>,actionHost)}
    <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Meetings ({total})</h3><button className={button} aria-label="Refresh independent meetings" disabled={busy} onClick={()=>void perform(loadList)}><RefreshCw className="h-4 w-4"/></button></div><div className="mt-3 max-h-96 space-y-2 overflow-y-auto">{items.map(item=><button key={item.id} disabled={busy} onClick={()=>void open(item.id)} className={`w-full cursor-pointer rounded-lg border p-3 text-left ${meeting?.id===item.id?'border-sky-300 bg-sky-50':'border-slate-100 hover:bg-slate-50'}`}><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block text-xs text-slate-500">{new Date(item.starts_at).toLocaleString()}</span></button>)}</div>
        {items.length<total&&<button className={button+' mt-3'} disabled={busy} onClick={()=>void perform(async()=>{const {data}=await apiClient.get<{items:Summary[];total:number}>(BASE+'/standalone',{params:{skip:items.length,limit:200}});setItems(previous=>[...previous,...data.items]);setTotal(data.total);})}>Load more meetings</button>}
      </aside>
      <div className="min-w-0 space-y-5">
        {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {notice&&<p role="status" className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{notice}</p>}
        <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="mb-4 font-semibold">Schedule a meeting</h3>
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <Label title="Meeting title *" wide><input className={field} disabled={meeting?.state==='Finalized'} maxLength={200} value={form.title} onChange={e=>set('title',e.target.value)}/></Label>
            <Label title={`Meeting date/time (${zone}) *`}><input type="datetime-local" className={field} value={form.starts_at} onChange={e=>set('starts_at',e.target.value)}/></Label>
            <Label title="Duration (minutes)"><input type="number" min={15} max={480} className={field} value={form.duration_minutes} onChange={e=>set('duration_minutes',Number(e.target.value))}/></Label>
            <Label title="Location"><input className={field} maxLength={300} value={form.location} onChange={e=>set('location',e.target.value)}/></Label>
            <Label title="Existing Teams / meeting link (optional)"><input type="url" className={field} maxLength={1000} value={form.meeting_url} onChange={e=>set('meeting_url',e.target.value)} placeholder="https://…"/></Label>
            <DirectoryAttendeePicker value={form.attendees} onChange={value=>set('attendees',value)} disabled={busy} includeOwners={false}/>
            <Label title="Meeting requirements / customer need" wide><textarea className={field} disabled={!assetEditing} rows={3} maxLength={5000} value={form.requirements} onChange={e=>set('requirements',e.target.value)} placeholder="Describe the use case to get AI accelerator suggestions…"/></Label>
            <Label title="Meeting agenda" wide><textarea className={field} rows={4} maxLength={5000} value={form.agenda} onChange={e=>set('agenda',e.target.value)}/></Label>
          </fieldset><p className="mt-4 text-xs text-slate-500">Saving prepares an .ics calendar file. It does not send invitations, book calendars or create a Teams link.</p>

        </section>
        <PlannerConversation contextId={meeting?.id} turns={meeting?.conversation||[]} suggestions={meeting?.recommendations||[]} selected={selected} requirements={form.requirements} current={suggestionsCurrent} disabled={!assetEditing} busy={busy} canSend={Boolean(form.title.trim()&&form.starts_at)} hint="Enter a meeting title and date/time to start the planner." onSend={converse} onChoose={choose}/>
        <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">Meeting accelerators ({selected.length})</h3><p className="mt-1 text-xs text-slate-500">Selected assets are saved with this meeting and listed in the calendar file. Tagging an asset does not raise a demo request or invite its owner.</p>
          <div className="mt-3 flex flex-wrap gap-2">{selected.map(id=><span key={id} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800"><span className="break-words">{name(id)}{meeting?.assets?.find(asset=>asset.asset_id===id)?.available===false?' — no longer active':''}</span>{assetEditing&&<button type="button" disabled={busy} aria-label={'Remove meeting asset '+name(id)} onClick={()=>choose(id,false)}><X className="h-3.5 w-3.5"/></button>}</span>)}</div>
          {assetEditing&&<><input aria-label="Search meeting accelerators" className={field+' mt-4'} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search published accelerators…"/><div className="mt-3 max-h-60 space-y-2 overflow-y-auto">{visible.map(asset=><label key={asset.id} className="flex gap-3 rounded-lg border border-slate-100 p-3"><input type="checkbox" disabled={busy||(!selected.includes(asset.id)&&selected.length>=100)} checked={selected.includes(asset.id)} onChange={e=>choose(asset.id,e.target.checked)}/><span><span className="block text-sm font-medium">{asset.title}</span><span className="block text-xs text-slate-500">{asset.family}</span></span></label>)}</div></>}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <button className={primary+' mt-4'} disabled={busy||!form.title.trim()||!form.starts_at} onClick={()=>void save()}>Save meeting details</button>
          {meeting&&<div className="mt-5 rounded-lg border border-sky-100 bg-sky-50 p-4"><p className="text-xs font-semibold">Calendar recipients</p><p className="mt-1 break-words text-sm">{meeting.invite_attendees.join(', ')}</p>{dirty&&<p className="mt-2 text-xs text-amber-700">Save changes before downloading.</p>}<button className={button+' mt-4'} disabled={busy||dirty} onClick={()=>void download()}><Download className="h-4 w-4"/>Download Outlook calendar invite (.ics)</button></div>}
        </section>
        {meeting&&<section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">Meeting history</h3><div className="mt-3 space-y-2">{history.map(item=><details key={item.id} className="rounded-lg border border-slate-100 p-3"><summary className="cursor-pointer text-sm capitalize">{item.action.replace('meeting_plan_','').replaceAll('_',' ')}<span className="mt-1 block text-xs text-slate-500">{item.actor} · {new Date(item.at).toLocaleString()}</span></summary><pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(item.details,null,2)}</pre></details>)}</div></section>}
      </div>
    </div>
  </div>;
}
