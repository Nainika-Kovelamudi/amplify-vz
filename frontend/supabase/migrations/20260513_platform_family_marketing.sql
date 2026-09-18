-- Populate family detail columns (when to sell / depends on / enables) for all platform families.
-- These power `FamilyDetail` via `loadFamiliesRecord` → `platform_families` JSON arrays.

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
