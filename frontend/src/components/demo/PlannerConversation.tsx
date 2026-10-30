import { useEffect, useId, useRef, useState } from 'react';
import { Bot, Check, Loader2, MessageSquare, Plus, Send, Sparkles, X } from 'lucide-react';

export type PlannerTurn={id:string;question:string;answer:string;at:string};
export type PlannerSuggestion={asset_id:string;title:string;reason:string};
type Props={contextId?:string;turns:PlannerTurn[];suggestions:PlannerSuggestion[];selected:string[];
  requirements:string;current:boolean;disabled:boolean;busy:boolean;canSend:boolean;hint?:string;
  onSend:(message:string,requestId:string)=>Promise<boolean>;onChoose:(id:string,checked:boolean)=>void};

export function PlannerConversation({contextId,turns,suggestions,selected,requirements,current,disabled,busy,canSend,hint,onSend,onChoose}:Props){
  const [input,setInput]=useState(''),[sending,setSending]=useState(false);
  const inputId=useId();
  const pending=useRef<{message:string;id:string}|null>(null),previousContext=useRef(contextId);
  const scroll=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(previousContext.current&&previousContext.current!==contextId){setInput('');pending.current=null;}previousContext.current=contextId;},[contextId]);
  useEffect(()=>{scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'});},[turns.length,busy]);
  async function send(message:string){
    message=message.trim();if(!message||busy||sending||disabled||!canSend)return;
    if(pending.current?.message!==message)pending.current={message,id:crypto.randomUUID()};
    setSending(true);
    try{if(await onSend(message,pending.current.id)){if(input.trim()===message)setInput('');pending.current=null;}}
    finally{setSending(false);}
  }
  const working=busy||sending;
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="AI Demo Planner conversation">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="flex items-center gap-2 font-semibold text-slate-900"><Sparkles className="h-4 w-4 text-violet-600"/>AI Demo Planner</h2><p className="mt-1 text-xs text-slate-500">Discuss the customer need, refine your requirements and choose the right accelerators.</p></div>
      <button type="button" disabled={disabled||working||!canSend||requirements.trim().length<10} onClick={()=>void send('Suggest relevant accelerators based on my saved requirements.')} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"><Sparkles className="h-4 w-4"/>Ask AI for recommendations</button>
    </div>
    <div className="grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="min-w-0 border-b border-slate-100 xl:border-b-0 xl:border-r">
        <div className="flex items-center gap-2 px-5 pt-4 text-xs font-semibold text-slate-500"><MessageSquare className="h-3.5 w-3.5"/>Conversation</div>
        <div ref={scroll} className="h-80 space-y-4 overflow-y-auto px-5 py-4" role="log" aria-label="Planner conversation" aria-live="polite">
          {!turns.length&&<div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600"><Bot className="mb-2 h-5 w-5 text-violet-600"/>Describe your requirement to get matching assets from the catalog. Then refine the shortlist through conversation.<p className="mt-2 text-xs text-slate-500">For example: “Which supports Azure?” or “We also need document processing.”</p></div>}
          {turns.map(turn=><div key={turn.id} className="space-y-3"><div className="ml-6 rounded-xl rounded-tr-sm bg-sky-50 p-3"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-sky-700">Question</p><p className="whitespace-pre-wrap break-words text-sm text-slate-800">{turn.question}</p></div><div className="mr-3 rounded-xl rounded-tl-sm border border-slate-100 bg-white p-3"><p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-700"><Bot className="h-3.5 w-3.5"/>AI planner</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{turn.answer}</p></div></div>)}
          {sending&&<p role="status" className="flex items-center gap-2 text-xs text-violet-700"><Loader2 className="h-4 w-4 animate-spin"/>Reviewing requirements and catalog assets…</p>}
        </div>
        <div className="border-t border-slate-100 bg-slate-50 p-4"><label className="sr-only" htmlFor={inputId}>Follow-up question</label><textarea id={inputId} value={input} onChange={e=>setInput(e.target.value)} maxLength={2000} rows={2} disabled={disabled||working||!canSend} placeholder="Ask a follow-up or add another requirement…" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send(input);}}} className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60"/>
          <div className="mt-2 flex items-center justify-between gap-3"><p className="text-[11px] text-slate-500">{!canSend?hint:'Enter to send · Shift+Enter for a new line'}</p><button type="button" disabled={disabled||working||!canSend||!input.trim()} onClick={()=>void send(input)} className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-3.5 w-3.5"/>Send question</button></div>
          <p className="mt-2 text-[10px] text-slate-400">Saved with this record. Latest 50 exchanges shown; older exchanges remain in the audit history.</p>
        </div>
      </div>
      <div className="min-w-0 p-5"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-800">Suggested accelerators</h3><span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">{suggestions.length}</span></div><p className="mt-1 text-xs text-slate-500">Suggestions refine the shortlist. You decide which assets to include.</p>
        {!current&&suggestions.length>0&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Saved requirements changed. Ask the planner to refresh these suggestions.</p>}
        {!suggestions.length&&<p className="mt-5 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">Matching published catalog assets will appear here. If nothing matches, refine the requirement or search the catalog manually.</p>}
        <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto">{suggestions.map(item=>{const added=selected.includes(item.asset_id);return <article key={item.asset_id} className={`rounded-xl border p-4 ${added?'border-sky-200 bg-sky-50/50':'border-slate-200'}`}><h4 className="text-sm font-semibold text-slate-900">{item.title}</h4><p className="mt-2 text-xs leading-relaxed text-slate-600">{item.reason}</p><button type="button" disabled={disabled||working||!current||(!added&&selected.length>=100)} onClick={()=>onChoose(item.asset_id,!added)} className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-50">{added?<><Check className="h-3.5 w-3.5"/>Selected · <X className="h-3 w-3"/>Remove</>:<><Plus className="h-3.5 w-3.5"/>Add to selection</>}</button></article>;})}</div>
        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">Based on available catalog information. Customization feasibility requires asset-owner confirmation.</p>
      </div>
    </div>
  </section>;
}
