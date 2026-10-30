import { useEffect, useId, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { connectAttendeeDirectory, searchDirectoryAttendees, searchPlatformAttendees, type DirectoryAttendee } from '../../lib/directoryAttendeeService';

type Props = { value: string; onChange: (value: string) => void; disabled?: boolean; includeOwners?: boolean };
const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50';
const split = (value: string) => [...new Set(value.split(/[,;\n]/).map(s => s.trim().toLowerCase()).filter(Boolean))];

export function DirectoryAttendeePicker({ value, onChange, disabled = false, includeOwners = true }: Props) {
  const id = useId();
  const [query, setQuery] = useState(''), [results, setResults] = useState<DirectoryAttendee[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false), [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState(''), [connected, setConnected] = useState(0);
  const emails = split(value);

  useEffect(() => {
    setResults([]); setMessage('');
    if (disabled || query.trim().length < 2) { setLoading(false); return; }
    const controller = new AbortController(); let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        let platform:DirectoryAttendee[]=[];let platformFailed=false;
        try { platform=await searchPlatformAttendees(query,controller.signal);if(active)setResults(platform); }
        catch { platformFailed=true; }
        if(!active)return;
        if(connected===0){setMessage(platform.length?'Suggestions from AIMPLIFY user profiles.':platformFailed?'AIMPLIFY profiles could not be searched. You can enter emails manually.':'No matching AIMPLIFY profiles. Try another name, connect Microsoft directory, or enter emails manually.');return;}
        try {
          const directory=await searchDirectoryAttendees(query,controller.signal);
          const seen=new Set(platform.map(person=>person.email.toLowerCase()));
          const rows=[...platform,...directory.filter(person=>!seen.has(person.email.toLowerCase())).map(person=>({...person,source:'Microsoft' as const}))];
          if(active){setResults(rows);setMessage(rows.length?'Suggestions from AIMPLIFY and Microsoft directory.':'No matching people found. Try another name or email.');}
        }catch{
          if(active)setMessage(platform.length?'Showing AIMPLIFY profiles; Microsoft directory is unavailable.':'No directory suggestions available. You can enter emails manually.');
        }
      } catch (error) {
        if (active) setMessage(controller.signal.aborted ? 'Directory search timed out. Try again or enter emails manually.' : error instanceof Error ? error.message : 'Directory search unavailable. Enter emails manually.');
      } finally { clearTimeout(timeout); if (active) setLoading(false); }
    }, 350);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [query, disabled, connected]);

  async function connect() {
    setConnecting(true); setMessage('');
    try { await connectAttendeeDirectory(); setConnected(n => n + 1); setMessage('Directory connected. Type a name or email to find attendees.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not connect. Enter emails manually.'); }
    finally { setConnecting(false); }
  }

  function select(person: DirectoryAttendee) {
    setNames(previous => ({ ...previous, [person.email]: person.name }));
    onChange([...new Set([...emails, person.email])].join(', ')); setQuery(''); setResults([]);
  }

  return <div className="sm:col-span-2 min-w-0 space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={id} className="text-xs font-semibold text-slate-600">Find attendees</label>
      <button type="button" disabled={disabled || connecting} onClick={() => void connect()} className="cursor-pointer text-xs font-semibold text-sky-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50">
                {connecting ? 'Connecting…' : 'Connect Microsoft directory'}
      </button>
    </div>
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400"/>
      <input id={id} type="search" value={query} disabled={disabled || connecting} maxLength={100} autoComplete="off"
        placeholder="Type at least 2 characters of a name or email…" className={inputClass+' !pl-9'}
        onChange={event => setQuery(event.target.value)} aria-describedby={id+'-help'}/>
    </div>
    {loading && <p role="status" className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin"/>Searching directory…</p>}
    {message && <p role="status" className="text-xs text-slate-600">{message}</p>}
    {!disabled && results.length > 0 && <ul aria-label="Directory attendee suggestions" className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
      {results.map(person => <li key={person.id}><button type="button" disabled={emails.includes(person.email) || emails.length >= 100}
        onClick={() => select(person)} className="w-full cursor-pointer px-3 py-2 text-left hover:bg-sky-50 focus:bg-sky-50 disabled:opacity-50">
        <span className="block text-sm font-medium text-slate-800">{person.name}{emails.includes(person.email) ? ' · Added' : ''}</span>
        <span className="block break-all text-xs text-slate-500">{person.email}{person.source?' · '+person.source:''}</span>
      </button></li>)}
    </ul>}
    {emails.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Additional attendees">{emails.map(email => <span key={email} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-sky-50 px-2 py-1 text-xs text-sky-800">
      <span className="min-w-0 break-all">{names[email] ? `${names[email]} (${email})` : email}</span>
      {!disabled && <button type="button" aria-label={'Remove attendee '+email} onClick={() => onChange(emails.filter(e => e !== email).join(', '))} className="shrink-0 cursor-pointer"><X className="h-3.5 w-3.5"/></button>}
    </span>)}</div>}
    <div><label htmlFor={id+'-emails'} className="block text-xs font-semibold text-slate-600">Additional attendee emails (comma-separated)</label>
      <textarea id={id+'-emails'} className={inputClass} rows={2} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}/>
    </div>
    <p id={id+'-help'} className="text-xs font-normal text-slate-500">Choose people from suggestions or enter emails manually. {includeOwners?'The requester and selected asset owners are included automatically when you review the request.':'The meeting creator is included automatically; add everyone else you want to invite.'}</p>
  </div>;
}
