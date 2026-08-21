import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronRight, CheckCircle2, Layers, Zap, Link2, Plus, SearchX } from 'lucide-react';
import { useFamilies } from '../context/FamiliesContext';
import { AssetCard } from '../components/catalog/AssetCard';
import { Button } from '../components/ui/Button';
import { getCatalog, type CatalogAsset } from '../lib/catalogService';

export function FamilyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { families, loading: familiesLoading } = useFamilies();
  const [assets, setAssets] = useState<CatalogAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const { items } = await getCatalog({ family: id, limit: 500 });
      if (!cancelled) { setAssets(items); setIsLoading(false); }
    }
    void hydrate();
    return () => { cancelled = true; };
  }, [id]);

  if (familiesLoading) {
    return <div className="py-24 text-center text-sm font-medium text-gray-500">Loading platform family…</div>;
  }

  if (!id || !families[id]) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h2 className="text-xl font-bold text-gray-900">Family not found</h2>
        <p className="mt-2 max-w-md text-center text-sm text-gray-500">
          This family is not configured or data failed to load.
        </p>
        <Button className="mt-4" onClick={() => navigate('/')}>Back to Home</Button>
      </div>
    );
  }

  const f = families[id];
  const production = assets.filter((a) => a.maturity === 'Production').length;
  const demoReady  = assets.filter((a) => a.demo_ready).length;
  const depArr     = f.dependsOn.length ? f.dependsOn : [];

  return (
    <div className="animate-in fade-in duration-500 pb-16">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-4 py-4 text-sm md:px-10">
        <button onClick={() => navigate('/')} className="font-medium text-sky-500 hover:text-sky-600 transition-colors">Home</button>
        <span className="text-gray-300">/</span>
        <span className="font-medium" style={{ color: f.color }}>{f.name}</span>
      </div>

      {/* ── TOP: Horizontal hero banner ── */}
      <div className="px-4 md:px-10">
        <div
          className="rounded-2xl border bg-white overflow-hidden"
          style={{ borderColor: `${f.color}25`, borderTopWidth: '4px', borderTopColor: f.color }}
        >
          <div className="flex flex-col gap-6 p-7 md:flex-row md:items-center md:justify-between">

            {/* Left — name + description */}
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: f.color }}>
                {f.tagline}
              </div>
              <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-gray-900 leading-tight">
                {f.name}
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-gray-500 text-justify">
                {f.longDesc}
              </p>
            </div>

            {/* Right — stats + action */}
            <div className="flex shrink-0 flex-col items-end gap-4">
              <div className="flex gap-3">
                {[
                  { n: assets.length,  label: 'Assets',      accent: f.color   },
                  { n: production,     label: 'Production',  accent: '#22c55e' },
                  { n: demoReady,      label: 'Demo-Ready',  accent: '#0ea5e9' },
                  { n: assets.filter(a => a.maturity === 'Battle-Tested').length, label: 'Battle-Tested', accent: '#6366f1' },
  { n: assets.filter(a => a.maturity === 'Experimental').length, label: 'Experimental', accent: '#F59E0B' },
                ].map(({ n, label, accent }) => (
                  <div key={label} className="min-w-[68px] rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-center">
                    <div className="text-xl font-extrabold" style={{ color: accent }}>
                      {isLoading ? '—' : n}
                    </div>
                    <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/submit')}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm"
                style={{ backgroundColor: f.color }}
              >
                <Plus className="h-4 w-4" />Submit to {f.name}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Assets grid ── */}
      <div className="mt-8 px-4 md:px-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">
            Assets
            <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: f.color }}>
              {isLoading ? '…' : assets.length}
            </span>
          </h2>
          <button
            onClick={() => navigate(`/catalog?family=${id}`)}
            className="flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: f.color }}
          >
            View in Catalog <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-sm font-medium text-gray-400 shadow-sm">
            Loading assets…
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-20 text-center">
            <SearchX className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">No assets yet in this family.</p>
            <button onClick={() => navigate('/submit')} className="mt-2 text-sm font-medium text-sky-500 hover:text-sky-600">
              Be the first to contribute
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assets.map((a, i) => (
              <AssetCard key={a.id} asset={a} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM: theory strip ── */}
      <div className="mt-10 px-4 md:px-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

          {/* When to Sell */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${f.color}15` }}>
                <Zap className="h-3.5 w-3.5" style={{ color: f.color }} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: f.color }}>When to Sell</h3>
            </div>
            <div className="space-y-3">
              {(f.useCases.length ? f.useCases : ['No use cases listed.']).map((u: string, i: number) => (
                <div key={i} className="flex gap-2.5 text-sm text-gray-600 leading-relaxed">
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" style={{ color: f.color }} />
                  <span>{u}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Depends On */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
                <Link2 className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Depends On</h3>
            </div>
            <div className="space-y-3">
              {(depArr.length ? depArr : ['No dependencies listed.']).map((d: string, i: number) => (
                <div key={i} className="flex gap-2.5 text-sm text-gray-600 leading-relaxed">
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Enables */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-600">Enables</h3>
            </div>
            <div className="space-y-3">
              {(f.enables.length ? f.enables : ['No enablements listed.']).map((e: string, i: number) => (
                <div key={i} className="flex gap-2.5 text-sm text-gray-600 leading-relaxed">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Signature Solutions ── */}
      {f.solutions.length > 0 && (
        <div className="mt-8 px-4 md:px-10">
          <div className="mb-4 flex items-center gap-2">
            <Layers className="h-4 w-4" style={{ color: f.color }} />
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Signature Solutions</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {f.solutions.map((s: string, i: number) => {
              const [title, ...rest] = s.split(' — ');
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.04 }}
                  className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
                  style={{ borderLeftWidth: '3px', borderLeftColor: f.color }}
                >
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: f.color }} />
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: f.color }}>{title}</h3>
                    {rest.length > 0 && (
                      <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{rest.join(' — ')}</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
