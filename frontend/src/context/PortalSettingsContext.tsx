import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getPortalSettings, type PortalContent } from '../lib/portalSettingsService';

const DEFAULT_BANNERS: PortalContent['banners'] = {
  home: { title: 'AIMPLIFY', subtitle: 'One platform for discovering, reusing, and deploying proven AI accelerators.' },
  login: { title: 'AIMPLIFY', subtitle: 'AI Management for Process Lifecycle, Intelligence, Flow & Yield' },
  catalog: { title: 'Asset Catalog', subtitle: 'Discover reusable, approved AI assets across the FAST platform families.' },
  pipeline: { title: 'Assets Pipeline', subtitle: 'Track submissions, reviews, requests, and publishing activity.' },
  submit: { title: 'Submit a New Asset', subtitle: 'Share a reusable AI capability for evaluation and publication.' },
  why: { title: 'Why AIMPLIFY?', subtitle: 'The platform that turns collective intelligence into company advantage.' },
  observability: { title: 'Observability Dashboard', subtitle: 'Monitor platform activity, governance, adoption, and engagement.' },
  executive: { title: 'Asset Governance & Adoption', subtitle: 'Executive reporting across AIMPLIFY performance and outcomes.' },
};

const PortalSettingsContext = createContext({ banners: DEFAULT_BANNERS });

export function PortalSettingsProvider({ children }: { children: ReactNode }) {
  const [banners, setBanners] = useState(DEFAULT_BANNERS);
  useEffect(() => {
    let active = true;
    const load = () => void getPortalSettings().then((content) => { if (active) setBanners({ ...DEFAULT_BANNERS, ...content.banners }); }).catch(() => undefined);
    load();
    window.addEventListener('portal-settings-updated', load);
    return () => { active = false; window.removeEventListener('portal-settings-updated', load); };
  }, []);
  const value = useMemo(() => ({ banners }), [banners]);
  return <PortalSettingsContext.Provider value={value}>{children}</PortalSettingsContext.Provider>;
}

export const usePortalSettings = () => useContext(PortalSettingsContext);
