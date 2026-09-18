import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { defaultFamilyBadge, familyAction, useFamilies } from '../../context/FamiliesContext';
import { CC, CL, MC, ML } from '../../data/uiConstants';
import { CheckCircle2, Heart } from 'lucide-react';
import type { CatalogAsset } from '../../lib/catalogService';

interface AssetCardProps {
  asset: CatalogAsset;
  index: number;
}

export function AssetCard({ asset, index }: AssetCardProps) {
  const navigate = useNavigate();
  const { families } = useFamilies();
  const fm = families[asset.family] ?? defaultFamilyBadge();

  const cloudTags: string[] = asset.cloud_provider
    ? asset.cloud_provider.split(',').map(s => s.trim().toLowerCase()).filter(k => CC[k])
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: 'easeOut' }}
      whileHover={{ y: -4, boxShadow: '0 12px 30px rgba(0,0,0,0.08)' }}
      onClick={() => navigate(`/catalog/${asset.slug}`)}
      className="relative z-10 flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200 p-5 shadow-sm transition-all duration-300"
      style={{ backgroundColor: `${fm.color}12` }}
    >
      {/* Like count — top-right corner */}
      {asset.like_count > 0 && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
          <Heart className="h-3 w-3 fill-rose-400" />
          {asset.like_count}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-medium text-gray-500">
            {asset.catalog_code}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: fm.color }}>
            {fm.name} — {familyAction(asset.family)}
          </span>
        </div>
        <div className="flex gap-1.5">
          {cloudTags.map((c) => {
            const key = c.toLowerCase();
            return (
              <span
                key={c}
                className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                style={{ backgroundColor: `${CC[key]}15`, color: CC[key] }}
              >
                {CL[key]}
              </span>
            );
          })}
        </div>
      </div>

      <h3 className="mb-2 text-sm font-semibold leading-snug text-gray-900">
        {asset.title}
      </h3>

      <p className="mb-4 flex-1 text-xs leading-relaxed text-gray-500 line-clamp-3">
        {asset.description}
      </p>

      <div className="mt-auto">
        <div className="mb-3 text-[11px] font-medium text-gray-400">
          {asset.department}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2">
            {asset.demo_ready && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Demo
              </span>
            )}
          </div>
          {asset.maturity && (
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold bg-gray-50 ${MC[asset.maturity] ?? 'text-gray-500'}`}>
              {ML[asset.maturity] ?? asset.maturity}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
