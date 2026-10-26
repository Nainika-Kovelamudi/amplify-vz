import { scoreExplanation } from '../../lib/evaluationDisplay';

const PARAMETERS = [
  ['ownership', 'Ownership', 'Owner and manager names/emails, designation, department, and a descriptive asset title.'],
  ['security', 'Security', 'Authentication, authorization, input sanitization, secrets management, and production hardening.'],
  ['documentation', 'Documentation', 'Purpose, use cases, architecture, prerequisites, and setup instructions.'],
  ['testing', 'Testing', 'Test results or coverage, demo readiness, and supporting demo evidence.'],
  ['cloud', 'Cloud', 'Declared deployment platform and compatibility with the proposed architecture.'],
  ['compliance', 'Repository & compliance', 'Repository legitimacy, audit logging, data/IP ownership, and applicable regulatory considerations.'],
] as const;

export function ScoreCapDetails({ feedback }: { feedback: Record<string, unknown> | null }) {
  const explanation = scoreExplanation(feedback);
  if (!explanation) return null;
  const checklist = feedback?.checklist as Record<string, { status?: string; note?: string }> | undefined;
  const failed = Array.isArray(feedback?.checklist_fails) ? feedback.checklist_fails : [];
  const warned = Array.isArray(feedback?.checklist_warns) ? feedback.checklist_warns : [];
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
    <p className="text-amber-800">{explanation}</p>
    <details className="mt-3">
      <summary className="cursor-pointer font-semibold">Pre-approval parameters and findings</summary>
      <p className="mt-2 text-xs text-slate-600">These checks assess the information supplied to the evaluation. Missing documentation does not prove a security control is absent. Findings require owner/reviewer verification.</p>
      <dl className="mt-3 space-y-3">
        {PARAMETERS.map(([key, label, description]) => {
          const item = checklist?.[key];
          const status = item?.status ?? (failed.includes(key) ? 'fail' : warned.includes(key) ? 'warn' : 'not evaluated');
          const statusLabel = ({ pass: 'Passed', fail: 'Needs correction', warn: 'Needs verification' } as Record<string, string>)[status] ?? 'Not evaluated';
          return <div key={key} className="rounded-lg border border-amber-100 bg-white p-3">
            <dt className="flex flex-wrap justify-between gap-2 font-semibold"><span>{label}</span><span className="text-xs text-slate-600">{statusLabel}</span></dt>
            <dd className="mt-1 text-xs leading-relaxed text-slate-600">{description}</dd>
            {item?.note && <dd className="mt-2 text-xs leading-relaxed"><strong>Evaluation finding:</strong> {item.note}</dd>}
          </div>;
        })}
      </dl>
    </details>
  </div>;
}
