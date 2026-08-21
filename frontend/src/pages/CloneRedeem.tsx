import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GitBranch, ExternalLink, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { redeemCloneToken, type CloneTokenResult } from '../lib/cloneService';
import { Button } from '../components/ui/Button';

export function CloneRedeem() {
  const { tokenUuid } = useParams<{ tokenUuid: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<CloneTokenResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!tokenUuid) return;
    redeemCloneToken(tokenUuid)
      .then((res) => {
        setResult(res);
        // Auto-open the repo so the user lands directly in GitHub/repo
        if (res.download_url) {
          window.open(res.download_url, '_blank', 'noopener,noreferrer');
        }
      })
      .catch((err) => setError(err?.response?.data?.detail ?? err.message ?? 'Token invalid or expired.'))
      .finally(() => setLoading(false));
  }, [tokenUuid]);

  const cloneCmd = result?.download_url ? `git clone ${result.download_url}` : '';

  const copyCmd = () => {
    navigator.clipboard.writeText(cloneCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <XCircle className="h-12 w-12 text-rose-400" />
        <h2 className="text-xl font-bold text-gray-900">Access Link Invalid</h2>
        <p className="max-w-sm text-sm text-gray-500">{error}</p>
        <Button onClick={() => navigate('/catalog')}>Back to Catalog</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Access Granted</h1>
            <p className="text-sm text-gray-500">{result?.asset_title}</p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-sky-100 bg-sky-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-600">Repository URL</p>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 shrink-0 text-sky-400" />
            <span className="flex-1 truncate font-mono text-sm text-gray-800">{result?.download_url}</span>
            <a
              href={result?.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-sky-500 hover:text-sky-700"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Clone Command</p>
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <code className="flex-1 truncate text-xs text-gray-700">{cloneCmd}</code>
            <button
              onClick={copyCmd}
              className="shrink-0 rounded px-2 py-1 text-xs font-medium text-sky-500 hover:bg-sky-50 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
          <strong>Private repo?</strong> The asset creator will add you as a collaborator on GitHub. You may need to wait for that invite before cloning.
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          The repository has been opened in a new tab.
          {result?.expires_at && (
            <> This link is valid until {new Date(result.expires_at).toLocaleString()}.</>
          )}
        </p>

        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => navigate('/catalog')}>Back to Catalog</Button>
        </div>
      </div>
    </div>
  );
}
