import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { apiErrorMessage } from '../../lib/apiError';
import { invalidateCatalogCache } from '../../lib/catalogService';
import { FALLBACK_FAMILIES, familyAction, useFamilies } from '../../context/FamiliesContext';

type Person = { id: string; name: string; email: string };
type Values = Record<string, string | string[] | null>;
type Asset = { id: string; catalog_code: string; slug: string; status: string; values: Values; fingerprint: string;
  suggested_cloud: string | null; cloud_error: string | null; missing_fields: string[]; linked_owner: Person | null;
  owner_mismatch: boolean; repository_valid: boolean; last_review: {reviewer:string; reviewed_at:string; current:boolean} | null };
const BASE = '/admin/platform-operations';
const CLOUDS = ['Azure','AWS','GCP','On-Premise','Hybrid','Multi-Cloud'];
const input = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm';
const button = 'cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const LABELS: Record<string,string> = {title:'Asset title',description:'Description',family:'Platform family',cloud_provider:'Cloud tags',
  owner_id:'Owner account',manager_name:'Manager name',manager_email:'Manager email',department:'Department',designation:'Designation',category:'Category',tech_stack:'Technology stack',repo_url:'Corporate repository URL',maturity:'Maturity'};
const EDITABLE = Object.keys(LABELS);
const text = (value: string | string[] | null | undefined) => Array.isArray(value) ? value.join(', ') : value || '';

export function MetadataStandardization() {
  const { families } = useFamilies();
  const [assets,setAssets] = useState<Asset[]>([]), [people,setPeople] = useState<Person[]>([]);
  const [loading,setLoading] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [search,setSearch] = useState(''), [filter,setFilter] = useState('');
  const [edit,setEdit] = useState<Asset | null>(null), [form,setForm] = useState<Record<string,string>>({});
  const [alignOwner,setAlignOwner] = useState(false), [confirmed,setConfirmed] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    setLoading(true);setError('');
    try {
      const [inventory,users] = await Promise.all([apiClient.get<{assets:Asset[]}>(BASE+'/metadata'),apiClient.get<Person[]>(BASE+'/assignees')]);
      setAssets(inventory.data.assets);setPeople(users.data);
    } catch(e) {setError(apiErrorMessage(e,'Metadata inventory could not be loaded.'));}
    finally {setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{if(edit)editor.current?.scrollIntoView({behavior:'smooth',block:'start'});},[edit]);
  const open = (asset:Asset) => {
    setEdit(asset);setForm(Object.fromEntries(EDITABLE.map(k=>[k,text(asset.values[k])])));
    setAlignOwner(false);setConfirmed(false);setNotice('');setError('');
  };
  const set = (key:string,value:string) => {setForm(previous=>({...previous,[key]:value}));setConfirmed(false);};
  const changes: Record<string,unknown> = {};
  if(edit) for(const key of EDITABLE) {
    if(form[key]!==text(edit.values[key])) changes[key]=key==='tech_stack'?form[key].split(',').map(s=>s.trim()).filter(Boolean):form[key];
  }
  if(alignOwner&&form.owner_id) changes.owner_id=form.owner_id;
  const selectedOwner=people.find(p=>p.id===form.owner_id);
  const cloudGap=(a:Asset)=>!!a.cloud_error||!a.values.cloud_provider||a.suggested_cloud!==a.values.cloud_provider;
  const ownerGap=(a:Asset)=>!a.linked_owner||a.owner_mismatch||!a.values.owner_name||!a.values.owner_email;
  const visible=assets.filter(a=>`${a.values.title} ${a.catalog_code} ${a.linked_owner?.name} ${a.linked_owner?.email}`.toLowerCase().includes(search.toLowerCase())&&
    (!filter||(filter==='cloud'?cloudGap(a):filter==='owner'?ownerGap(a):filter==='missing'?a.missing_fields.length>0:!a.last_review?.current)));
  const save=async()=>{
    if(!edit||!confirmed)return;
    setBusy(true);setError('');
    try {
      await apiClient.patch(BASE+'/assets/'+edit.id+'/metadata',{fingerprint:edit.fingerprint,confirmed,changes});
      invalidateCatalogCache();setEdit(null);setNotice('Metadata saved. Reviewer, date and changes were recorded. Remaining gaps stay visible.');await load();
    } catch(e) {setError(apiErrorMessage(e,'Metadata could not be saved.'));}
    finally {setBusy(false);}
  };
  return <section className="space-y-4" aria-label="Metadata standardization">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">Metadata standardization</h3><p className="mt-1 text-xs text-slate-500">Review existing cloud tags, classification and ownership. Only confirmed changes are saved.</p></div><button className={button} disabled={loading||busy} onClick={()=>{setEdit(null);void load();}}>{loading?'Loading…':'Refresh metadata'}</button></div>
    {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    <div className="flex flex-wrap gap-3"><input className={input+' flex-1'} aria-label="Search metadata" placeholder="Search asset or linked owner" value={search} onChange={e=>setSearch(e.target.value)}/><select className={input+' sm:!w-auto'} aria-label="Metadata filter" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All assets ({assets.length})</option><option value="cloud">Cloud tags need review</option><option value="owner">Owner details need review</option><option value="missing">Missing metadata</option><option value="review">Not reviewed / changed since review</option></select></div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['Asset','Cloud tags','Linked owner','Findings / review',''].map((label,i)=><th key={i} className="p-3">{label}</th>)}</tr></thead><tbody>{visible.map(a=><tr key={a.id} className="border-t border-slate-100 align-top">
      <td className="p-3"><Link to={'/catalog/'+a.slug} className="font-semibold text-indigo-700 underline">{text(a.values.title)}</Link><p className="mt-1 text-slate-500">{a.catalog_code} · {text(a.values.family)} · {a.status}</p></td>
      <td className="p-3"><p>{text(a.values.cloud_provider)||'Not supplied'}</p>{a.suggested_cloud&&a.suggested_cloud!==a.values.cloud_provider&&<p className="mt-1 text-indigo-700">Suggested: {a.suggested_cloud}</p>}{a.cloud_error&&<p className="mt-1 text-amber-700">{a.cloud_error}</p>}</td>
      <td className="p-3"><p>{a.linked_owner?.name||'Linked account missing'}</p><p className="text-slate-500">{a.linked_owner?.email}</p>{a.owner_mismatch&&<p className="mt-1 text-amber-700">Nominated email differs</p>}</td>
      <td className="p-3"><p>{a.missing_fields.length?`${a.missing_fields.length} fields missing`:'Required fields present'}</p>{!a.repository_valid&&<p className="text-amber-700">Repository needs review</p>}{a.last_review&&<p className="mt-1 text-slate-500">{a.last_review.current?'Reviewed':'Changed since review'}: {a.last_review.reviewer} · {new Date(a.last_review.reviewed_at).toLocaleString()}</p>}</td>
      <td className="p-3"><button className={button} disabled={busy} onClick={()=>open(a)}>Review metadata</button></td>
    </tr>)}</tbody></table>{!loading&&!visible.length&&<p className="p-4 text-sm text-slate-500">No matching assets.</p>}</div>
    {edit&&<div ref={editor} className="space-y-4 rounded-xl border border-indigo-200 bg-white p-5" role="region" aria-label="Review asset metadata">
      <h3 className="font-semibold">Review — {text(edit.values.title)} ({edit.catalog_code})</h3>
      {edit.missing_fields.length>0&&<p className="text-xs text-amber-700">Missing: {edit.missing_fields.map(k=>LABELS[k]||k.replaceAll('_',' ')).join(', ')}. A recorded review does not certify completeness.</p>}
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <div className="text-xs font-semibold sm:col-span-2"><label>Cloud tags<input className={input} value={form.cloud_provider} onChange={e=>set('cloud_provider',e.target.value)} aria-label="Cloud tags"/></label><span className="mt-2 flex flex-wrap gap-3">{CLOUDS.map(cloud=><label key={cloud} className="flex items-center gap-1 font-normal"><input type="checkbox" checked={form.cloud_provider.split(',').map(s=>s.trim()).includes(cloud)} onChange={e=>{const tags=form.cloud_provider.split(',').map(s=>s.trim()).filter(Boolean);set('cloud_provider',(e.target.checked?[...tags,cloud]:tags.filter(t=>t!==cloud)).join(', '));}}/>{cloud}</label>)}</span>
          {edit.suggested_cloud&&<button type="button" className={button+' mt-2'} onClick={()=>set('cloud_provider',edit.suggested_cloud!)}>Use suggested tags: {edit.suggested_cloud}</button>}
          {edit.cloud_error&&<span className="mt-2 block font-normal text-amber-700">{edit.cloud_error}</span>}
        </div>
        <div className="text-xs font-semibold"><label>Owner account<select className={input} value={form.owner_id} onChange={e=>{set('owner_id',e.target.value);setAlignOwner(true);}}><option value="">Select owner</option>{people.map(p=><option key={p.id} value={p.id}>{p.name} — {p.email}</option>)}</select></label><span className="mt-2 block font-normal text-slate-500">Stored name/email: {text(edit.values.owner_name)||'Not supplied'} · {text(edit.values.owner_email)||'Not supplied'}</span>
          <label className="mt-2 flex gap-2 font-normal"><input type="checkbox" checked={alignOwner} onChange={e=>{setAlignOwner(e.target.checked);setConfirmed(false);}}/>Use selected account name/email for this asset</label>
          {(alignOwner||'owner_id' in changes)&&selectedOwner&&<span className="mt-1 block text-indigo-700">Will save: {selectedOwner.name} · {selectedOwner.email}</span>}
        </div>
        <label className="text-xs font-semibold">Platform family<select className={input} value={form.family} onChange={e=>set('family',e.target.value)}>{!FALLBACK_FAMILIES[form.family]&&<option value={form.family}>{form.family||'Select family'}</option>}{Object.entries(FALLBACK_FAMILIES).map(([key,fallback])=>{const f=families[key]||fallback;return <option key={key} value={key}>{f.name} — {familyAction(key)} {f.tagline}</option>;})}</select></label>
        {['title','manager_name','manager_email','department','designation','category','repo_url','tech_stack'].map(key=><label key={key} className="text-xs font-semibold">{LABELS[key]}{key==='tech_stack'?' (comma-separated)':''}<input type={key==='manager_email'?'email':'text'} className={input} value={form[key]} onChange={e=>set(key,e.target.value)}/></label>)}
        <label className="text-xs font-semibold">Maturity<select className={input} value={form.maturity} onChange={e=>set('maturity',e.target.value)}>{!['Experimental','Battle-Tested','Production'].includes(form.maturity)&&<option value={form.maturity}>{form.maturity||'Select maturity'}</option>}{['Experimental','Battle-Tested','Production'].map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="text-xs font-semibold sm:col-span-2">Description<textarea rows={4} className={input} value={form.description} onChange={e=>set('description',e.target.value)}/></label>
      </fieldset>
      <div className="rounded-lg bg-slate-50 p-3"><h4 className="text-xs font-semibold">Proposed changes</h4>{Object.keys(changes).length?<dl className="mt-2 space-y-2 text-xs">{Object.entries(changes).map(([key,val])=><div key={key}><dt className="font-semibold">{LABELS[key]}</dt><dd className="break-words text-slate-600">{key==='owner_id'?edit.linked_owner?.email||'No linked owner':text(edit.values[key])||'Not supplied'} → {key==='owner_id'?selectedOwner?.email||String(val):text(val as string|string[]|null)||'Not supplied'}</dd></div>)}</dl>:<p className="mt-1 text-xs text-slate-500">No field changes. Confirmation will record a review of the current values.</p>}</div>
      <p className="text-xs text-slate-500">Family changes retain existing asset codes and links. Updated scoring inputs may require AI re-evaluation. Existing submissions retain their author and history.</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I have reviewed the current values and proposed changes.</label>
      <button className={button} disabled={!confirmed||busy} onClick={()=>void save()}>{busy?'Saving…':'Confirm and save metadata'}</button><button className={button+' ml-2'} disabled={busy} onClick={()=>setEdit(null)}>Cancel</button>
    </div>}
  </section>;
}
