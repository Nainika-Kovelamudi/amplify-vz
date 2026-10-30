import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { defaultFamilyBadge, familyAction, useFamilies } from '../../context/FamiliesContext';
import { CC, CL, MC, ML } from '../../data/uiConstants';
import { ArrowRight } from 'lucide-react';
import type { CatalogAsset } from '../../lib/catalogService';
import { LifecycleBadge } from './AssetLifecycle';

interface AssetRowProps {
  asset: CatalogAsset;
  index: number;
}

export function AssetRow({ asset, index }: AssetRowProps) {
  const navigate = useNavigate();
  const { families } = useFamilies();
  const fm = families[asset.family] ?? defaultFamilyBadge();

  const CLOUD_KEYS = new Set(['aws', 'gcp', 'azure']);
  const cloudTags = (asset.cloud_provider || '').split(',').map(c=>c.trim()).filter(c=>CLOUD_KEYS.has(c.toLowerCase()));

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      whileHover={{ x: 4, backgroundColor: '#FAFBFC' }}
      onClick={asset.restricted ? undefined : () => navigate(`/catalog/${asset.slug}`)}
      className={`group flex items-center gap-4 rounded-lg border border-gray-200 p-3.5 shadow-sm transition-all hover:shadow-md ${asset.restricted?'cursor-default':'cursor-pointer'}`}
      style={{ backgroundColor: `${fm.color}12` }}
    >
      {(!asset.restricted||asset.catalog_preview) && <span className="min-w-[60px] rounded bg-gray-50 px-2 py-1 font-mono text-[10px] font-medium text-gray-500">
        {asset.catalog_code}
      </span>}

      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-semibold text-gray-900">{asset.title}</div>
        <div className="truncate text-xs text-gray-500 mt-0.5">{asset.description}</div>
      </div>

      {['Deprecated','Decommissioned'].includes(asset.status) && <LifecycleBadge status={asset.status}/>}

      {(!asset.restricted||asset.catalog_preview) && <>
      <span className="shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider" style={{ color: fm.color }}>
        {fm.name} — {familyAction(asset.family)}
      </span>

      <div className="shrink-0 flex gap-1 justify-end">
        {cloudTags.map((c) => {
          const key = c.toLowerCase();
          return (
            <span
              key={c}
              className="rounded px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap"
              style={{ backgroundColor: `${CC[key]}15`, color: CC[key] }}
            >
              {CL[key]}
            </span>
          );
        })}
      </div>

      <span className={`whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold bg-gray-50 w-24 text-center ${MC[asset.maturity ?? ''] ?? 'text-gray-500'}`}>
        {ML[asset.maturity ?? ''] ?? asset.maturity}
      </span>


      <div className="w-5 flex justify-center">
        {asset.demo_ready && (
          <span className="h-2 w-2 rounded-full bg-emerald-500" title="Demo Ready" />
        )}
      </div>

      {!asset.restricted&&<ArrowRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-gray-500" />}
      </>}
    </motion.div>
  );
}
