create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  role text not null default 'viewer',
  created_at timestamptz not null default now()
);

create table if not exists platform_families (
  id text primary key,
  name text not null,
  tagline text not null,
  description text not null,
  color text not null,
  when_to_sell jsonb not null default '[]',
  depends_on jsonb not null default '[]',
  enables jsonb not null default '[]'
);

create table if not exists signature_solutions (
  id uuid primary key default gen_random_uuid(),
  family_id text not null references platform_families(id),
  name text not null,
  description text not null,
  sort_order int not null default 0
);

create table if not exists assets (
  id text primary key,
  name text not null,
  family_id text not null references platform_families(id),
  category text not null,
  solution text not null,
  description text not null,
  about text not null,
  owner text not null,
  owner_initials text not null,
  maturity text not null,
  effort text not null,
  clouds jsonb not null default '[]',
  tags jsonb not null default '[]',
  demo_url text,
  video_url text,
  repo_url text,
  users_count int not null default 0,
  deployments_count int not null default 0,
  pipelines_count int not null default 0,
  score int not null default 0,
  architecture jsonb not null default '[]',
  quick_start jsonb not null default '[]',
  prerequisites jsonb not null default '[]',
  dependencies jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists asset_changelog (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null references assets(id) on delete cascade,
  version text not null,
  changed_on date not null,
  note text not null
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  asset_name text not null,
  family_id text not null references platform_families(id),
  category text not null default 'Process Automation',
  solution text not null default 'Agent Orchestration',
  author text not null,
  author_initials text not null,
  status text not null default 'AI Review',
  score int not null default 0,
  description text not null,
  owner_email text,
  repo_url text,
  demo_url text,
  video_url text,
  clouds jsonb not null default '["AWS"]',
  maturity text not null default 'Demo-ready',
  dependencies text not null default 'Not applicable',
  prerequisites text not null default 'Not applicable',
  commands text not null default 'Not applicable',
  architecture text not null default 'Not applicable',
  architectures text not null default 'Not applicable',
  attachments jsonb not null default '[]',
  gov_reviewer text,
  gov_notes text,
  approved_at date,
  published_at date,
  submitted_at date not null default current_date
);

alter table submissions add column if not exists category text not null default 'Process Automation';
alter table submissions add column if not exists solution text not null default 'Agent Orchestration';
alter table submissions add column if not exists owner_email text;
alter table submissions add column if not exists repo_url text;
alter table submissions add column if not exists demo_url text;
alter table submissions add column if not exists video_url text;
alter table submissions add column if not exists clouds jsonb not null default '["AWS"]';
alter table submissions add column if not exists maturity text not null default 'Demo-ready';
alter table submissions add column if not exists dependencies text not null default 'Not applicable';
alter table submissions add column if not exists prerequisites text not null default 'Not applicable';
alter table submissions add column if not exists commands text not null default 'Not applicable';
alter table submissions add column if not exists architecture text not null default 'Not applicable';
alter table submissions add column if not exists architectures text not null default 'Not applicable';
alter table submissions add column if not exists attachments jsonb not null default '[]';
alter table submissions add column if not exists gov_reviewer text;
alter table submissions add column if not exists gov_notes text;
alter table submissions add column if not exists approved_at date;
alter table submissions add column if not exists published_at date;

alter table assets add column if not exists video_url text;

-- Legacy cleanup: older UI builds stored the video link in demo_url and
-- the launch/demo link in attachments[0].url. Keep video_url explicit and
-- move the attachment URL into demo_url when present.
update submissions
set video_url = demo_url
where video_url is null
  and demo_url is not null;

update submissions
set demo_url = attachments -> 0 ->> 'url'
where jsonb_typeof(attachments) = 'array'
  and attachments -> 0 ->> 'url' is not null;

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  person text not null,
  action text not null,
  target text not null,
  family_id text references platform_families(id),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table platform_families enable row level security;
alter table signature_solutions enable row level security;
alter table assets enable row level security;
alter table asset_changelog enable row level security;
alter table submissions enable row level security;
alter table activity_log enable row level security;

-- The app uses local demo auth (no supabase.auth.signIn), so requests reach
-- Supabase as the anon role. Grant policies to both anon and authenticated.

drop policy if exists "authenticated read profiles" on profiles;
drop policy if exists "authenticated read families" on platform_families;
drop policy if exists "authenticated read solutions" on signature_solutions;
drop policy if exists "authenticated read assets" on assets;
drop policy if exists "authenticated read changelog" on asset_changelog;
drop policy if exists "authenticated read submissions" on submissions;
drop policy if exists "authenticated insert submissions" on submissions;
drop policy if exists "authenticated update submissions" on submissions;
drop policy if exists "authenticated insert assets" on assets;
drop policy if exists "authenticated insert changelog" on asset_changelog;
drop policy if exists "authenticated read activity" on activity_log;

drop policy if exists "public read profiles" on profiles;
drop policy if exists "public read families" on platform_families;
drop policy if exists "public read solutions" on signature_solutions;
drop policy if exists "public read assets" on assets;
drop policy if exists "public read changelog" on asset_changelog;
drop policy if exists "public read submissions" on submissions;
drop policy if exists "public insert submissions" on submissions;
drop policy if exists "public update submissions" on submissions;
drop policy if exists "public insert assets" on assets;
drop policy if exists "public update assets" on assets;
drop policy if exists "public delete assets" on assets;
drop policy if exists "public delete submissions" on submissions;
drop policy if exists "public insert changelog" on asset_changelog;
drop policy if exists "public read activity" on activity_log;

create policy "public read profiles" on profiles for select to anon, authenticated using (true);
create policy "public read families" on platform_families for select to anon, authenticated using (true);
create policy "public read solutions" on signature_solutions for select to anon, authenticated using (true);
create policy "public read assets" on assets for select to anon, authenticated using (true);
create policy "public read changelog" on asset_changelog for select to anon, authenticated using (true);
create policy "public read submissions" on submissions for select to anon, authenticated using (true);
create policy "public insert submissions" on submissions for insert to anon, authenticated with check (true);
create policy "public update submissions" on submissions for update to anon, authenticated using (true) with check (true);
create policy "public insert assets" on assets for insert to anon, authenticated with check (true);
create policy "public update assets" on assets for update to anon, authenticated using (true) with check (true);
create policy "public delete assets" on assets for delete to anon, authenticated using (true);
create policy "public delete submissions" on submissions for delete to anon, authenticated using (true);
create policy "public insert changelog" on asset_changelog for insert to anon, authenticated with check (true);
create policy "public read activity" on activity_log for select to anon, authenticated using (true);

-- Seed platform_families. submissions.family_id and assets.family_id both
-- reference platform_families(id), so these rows must exist before any
-- insert from the app. Idempotent — safe to re-run.
insert into platform_families (id, name, tagline, description, color) values
  ('atlas',    'Atlas',    'Data & Context Platform',           'The data foundation that gives every platform family credibility: AI readiness, semantic context, master data management, and migration patterns.', '#16a8b7'),
  ('forge',    'Forge',    'AI-Native Engineering Platform',    'Reusable engineering accelerators for AI-assisted SDLC, quality automation, code migration, and evaluation workflows.',                              '#d49b1f'),
  ('relay',    'Relay',    'Workflow & Agent Platform',         'Composable agents and workflow automation assets for support, operations, document processing, and business process acceleration.',               '#7c4dff'),
  ('sentinel', 'Sentinel', 'Governed Runtime & Managed AI Ops', 'Guardrails, observability, compliance, and runtime patterns for operating AI safely across delivery teams.',                                     '#c63c71'),
  ('nexus',    'Nexus',    'Shared Platform Infrastructure',    'Cross-cutting infrastructure, templates, deployment blueprints, and shared platform patterns for accelerators.',                                  '#60646c')
on conflict (id) do nothing;

-- Family detail page: when to sell / depends on / enables (JSON arrays on platform_families)
update platform_families set
  when_to_sell = '[
    "The customer needs a governed data layer before scaling GenAI, analytics, or agentic workflows.",
    "Stakeholders ask for semantic search, policy-aware retrieval, MDM, or migration off legacy catalogs.",
    "Programs require provable data quality, lineage, and context so AI outputs stay auditable."
  ]'::jsonb,
  depends_on = '[
    "Connectivity to source systems (ERP, CRM, lakes, files) and batch or streaming ingestion",
    "Identity and access patterns for row-level and document-level security",
    "Cloud storage and compute for indexing, embeddings, validation, and migration runs"
  ]'::jsonb,
  enables = '[
    "Credible RAG and agents grounded in approved enterprise definitions and documents",
    "Shared semantic context so every accelerator family can reference the same truth",
    "Faster, safer replatforming because context, policies, and master data are unified"
  ]'::jsonb
where id = 'atlas';

update platform_families set
  when_to_sell = '[
    "Teams are standardizing AI-assisted SDLC, quality automation, or large-scale code migration.",
    "Engineering leadership wants repeatable eval harnesses, migration playbooks, or review bots.",
    "Delivery needs faster onboarding to new stacks without sacrificing safety or traceability."
  ]'::jsonb,
  depends_on = '[
    "Source control, CI/CD, and artifact registries for build and release automation",
    "Model or gateway access for code assistants, eval runners, and static analysis integrations",
    "Baseline engineering standards (branching, testing, security scanning) the org already enforces"
  ]'::jsonb,
  enables = '[
    "Accelerated delivery through reusable templates, agents, and migration accelerators",
    "Consistent quality gates and measurable improvement loops across squads",
    "Lower risk when changing languages, frameworks, or platforms at scale"
  ]'::jsonb
where id = 'forge';

update platform_families set
  when_to_sell = '[
    "Operations or support must deflect repetitive work with human-in-the-loop automations.",
    "Business wants multi-step agents that hand off across tools, queues, and messaging channels.",
    "Document-heavy processes (intake, claims, contracts) need structured extraction and routing."
  ]'::jsonb,
  depends_on = '[
    "LLM or rules engines plus enterprise APIs (ticketing, email, CRM, storage)",
    "Durable execution, queues, or workflow engines for retries, SLAs, and approvals",
    "Clear data classification for what agents may read, write, or escalate"
  ]'::jsonb,
  enables = '[
    "End-to-end process automation with transparent handoffs and operator overrides",
    "Composable agents that plug into existing systems instead of rip-and-replace",
    "Faster cycle time on service requests, back-office tasks, and document pipelines"
  ]'::jsonb
where id = 'relay';

update platform_families set
  when_to_sell = '[
    "Regulated or high-risk environments need guardrails, observability, and audit-ready AI ops.",
    "Security and compliance teams require policy enforcement before models reach production.",
    "SRE and platform owners need runtime controls, drift detection, and incident-ready telemetry."
  ]'::jsonb,
  depends_on = '[
    "Identity providers, secrets management, and network segmentation for production workloads",
    "Central logging, tracing, and metrics stacks for evidence and alerting",
    "Published risk frameworks, model cards, or internal policy corpora to enforce against"
  ]'::jsonb,
  enables = '[
    "Safer production AI with approvals, redaction, rate limits, and traceable decisions",
    "Shared compliance posture across teams instead of one-off manual reviews",
    "Operational confidence through monitoring, evaluation hooks, and rollback patterns"
  ]'::jsonb
where id = 'sentinel';

update platform_families set
  when_to_sell = '[
    "New accelerators need landing zones, reference architectures, or shared deployment blueprints.",
    "Platform engineering wants one paved path for networking, secrets, and environment parity.",
    "Programs spanning multiple clouds or regions need repeatable infra and template libraries."
  ]'::jsonb,
  depends_on = '[
    "Provisioned cloud accounts, baseline networking, and org-level guardrails",
    "Agreed naming, tagging, and FinOps practices so templates stay maintainable",
    "CI/CD and registry services to publish and version shared components"
  ]'::jsonb,
  enables = '[
    "Consistent environments that shorten time-to-first-deploy for every family",
    "Reusable modules that reduce bespoke infra work across accelerators",
    "Clear upgrade paths when standards change because patterns are centralized"
  ]'::jsonb
where id = 'nexus';
