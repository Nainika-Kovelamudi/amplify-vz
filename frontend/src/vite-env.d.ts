/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ── Amplify FastAPI backend ──────────────────────────────────────────────
  readonly VITE_API_URL: string;

  // ── Microsoft Entra ID (MSAL) ────────────────────────────────────────────
  readonly VITE_AZURE_TENANT_ID: string;
  readonly VITE_AZURE_CLIENT_ID: string;

  // ── ArchEval feature (separate Supabase project — unchanged) ────────────
  readonly VITE_ARCHEVAL_SUPABASE_URL?: string;
  readonly VITE_ARCHEVAL_SUPABASE_KEY?: string;
  readonly VITE_ARCHEVAL_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_ARCHEVAL_TABLE?: string;
  readonly VITE_ARCHEVAL_LEGACY_TABLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
