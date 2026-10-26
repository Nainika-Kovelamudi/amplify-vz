import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/apiClient';
import { apiErrorMessage } from '../../lib/apiError';
import { invalidateCatalogCache } from '../../lib/catalogService';
import { FALLBACK_FAMILIES, familyAction, useFamilies } from '../../context/FamiliesContext';

const CHOICES = ['Forge', 'Atlas', 'Sentinel', 'Titan'];
export function FamilyEditor({ id, kind, currentFamily, onSaved, disabled = false, onBusyChange }: {
  id: string; kind: 'catalog' | 'submission'; currentFamily: string;
  onSaved: (family: string, slug?: string) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const { families } = useFamilies();
  const familyDetails = (name: string) => Object.entries(families).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] ?? FALLBACK_FAMILIES[name];
  const [family,setFamily] = useState('');
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [saved,setSaved] = useState(false);
  useEffect(()=>{ setFamily(CHOICES.find(f=>f.toLowerCase()===currentFamily.toLowerCase()) || currentFamily); },[currentFamily]);
  const save = async () => {
    setBusy(true);onBusyChange?.(true);setError('');setSaved(false);
    try {
      const {data} = await apiClient.patch<{family:string;slug?:string}>(
        `${kind==='catalog'?'/catalog':'/submissions'}/${id}/family`,{family});
      invalidateCatalogCache();onSaved(data.family,data.slug);setSaved(true);
    } catch(e) { setError(apiErrorMessage(e,'Platform family could not be saved.')); }
    finally { setBusy(false);onBusyChange?.(false); }
  };
  return <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-slate-900">
    <label className="block text-xs font-semibold">Platform family
      <select value={family} disabled={busy||disabled} onChange={e=>{setFamily(e.target.value);setSaved(false);}}
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
        {!CHOICES.includes(family)&&<option value={family}>{family || 'Select a family'}</option>}
        {CHOICES.map(f=>{
          const details = familyDetails(f);
          return <option key={f} value={f}>{details.name} — {familyAction(f)} {details.tagline}</option>;
        })}
      </select>
    </label>
    {familyDetails(family)?.summary && <p className="mt-2 text-xs leading-relaxed text-slate-600">{familyDetails(family).summary}</p>}
    <p className="mt-2 text-xs text-slate-500">Save the family before approving or publishing. This preserves the current workflow status and asset links.</p>
    <button type="button" disabled={busy||disabled||!CHOICES.includes(family)||family===currentFamily} onClick={()=>void save()}
      className="mt-3 cursor-pointer rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
      {busy?'Saving…':'Save platform family'}
    </button>
    {saved&&<p role="status" className="mt-2 text-xs text-emerald-700">Platform family saved.</p>}
    {error&&<p role="alert" className="mt-2 whitespace-pre-wrap text-xs text-rose-700">{error}</p>}
  </div>;
}
