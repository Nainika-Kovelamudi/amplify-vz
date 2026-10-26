import { useEffect, useState } from 'react';
import { Calendar, User } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
type Review = {name:string|null;at:string|null};
type History = {asset_id:string;l1:Review;l2:Review};

export function AssetReviewHistory({ assetId }: { assetId:string }) {
  const [history,setHistory]=useState<History|null>(null),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;setLoading(true);setFailed(false);setHistory(null);
    apiClient.get<History>(`/catalog/${assetId}/review-history`).then(({data})=>{if(active)setHistory(data);})
      .catch(()=>{if(active)setFailed(true);}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[assetId,attempt]);
  if(loading)return <p role="status" className="border-t border-gray-50 py-3 text-xs text-gray-400">Loading review history…</p>;
  if(failed)return <div className="border-t border-gray-50 py-3 text-xs text-gray-500">Review history unavailable. <button type="button" className="cursor-pointer text-indigo-600 underline" onClick={()=>setAttempt(v=>v+1)}>Retry</button></div>;
  const rows=[{label:'Approved by (L1)',value:history?.l1.name,icon:User},{label:'Approved at',value:history?.l1.at?new Date(history.l1.at).toLocaleString():null,icon:Calendar},
    {label:'Published by (L2)',value:history?.l2.name,icon:User},{label:'Published at',value:history?.l2.at?new Date(history.l2.at).toLocaleString():null,icon:Calendar}];
  return <dl className="mt-3">{rows.map(({label,value,icon:Icon})=><div key={label} className="flex gap-3 border-t border-gray-50 py-3"><Icon aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-gray-400"/><div className="min-w-0"><dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</dt><dd className="mt-1 break-words text-sm text-gray-800">{value||'Not recorded'}</dd></div></div>)}</dl>;
}
