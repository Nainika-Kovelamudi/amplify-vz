-- AIMPLIFY Tags sheet → assets + pipeline submissions (Manual Approval).
-- video_url left null (set manually in Table Editor or Pipeline). Idempotent upserts.

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('ATL-001', 'DataSmith - Tableau to Looker Migration', 'atlas', 'BI Migration', 'Migraton Factory', 'Discovery, Migration and Validation of Tableau dashboards to Looker', 'Discovery — Lineage analysis, schema analysis, cluster analysis. Hosted on Azure (cloud agnostic).', 'Manikandan Loganathan', 'ML', 'experimental', 'low', '["azure"]'::jsonb, '["Tableau","Looker","DataSmith","Migration","Agentic AI"]'::jsonb, 'https://datasmith.infovision.io', null, null, 0, 0, 2, 0, '["TBD"]'::jsonb, '["GUI based"]'::jsonb, '["Hosted service","Need Tableau as .twbx files"]'::jsonb, '["Not applicable"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('6c5bb5f8-439c-50bb-8be6-ae4ea92a5668', 'DataSmith - Tableau to Looker Migration', 'atlas', 'BI Migration', 'Migraton Factory', 'Manikandan Loganathan', 'ML', 'Manual Approval', 0, 'Discovery — Lineage analysis, schema analysis, cluster analysis. Hosted on Azure (cloud agnostic).', 'Manikandan.Loganathan@infovision.com', null, 'https://datasmith.infovision.io', null, '["azure"]'::jsonb, 'experimental', 'Not applicable', 'Hosted service
Need Tableau as .twbx files', 'GUI based', 'TBD', 'TBD', '[]'::jsonb, '2026-05-12', 'Catalog id ATL-001. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('ATL-002', 'DataSmith - Synthetic Data Generator', 'atlas', 'Data Generation', 'Master Data & Domain Context', 'Synthetic Data Generator', 'Generates tens to millions of rows of synthetic data statistically modeled on a given input dataset.', 'Manikandan Loganathan', 'ML', 'validated', 'low', '["aws","gcp","azure"]'::jsonb, '["Data Generator","Data Generation","DataSmith"]'::jsonb, null, null, null, 1, 0, 4, 50, '["TBD"]'::jsonb, '["GUI based"]'::jsonb, '["Hosted service","None"]'::jsonb, '["Not applicable"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('0012d719-db4b-5c48-9cb2-2a8ac83758a9', 'DataSmith - Synthetic Data Generator', 'atlas', 'Data Generation', 'Master Data & Domain Context', 'Manikandan Loganathan', 'ML', 'Manual Approval', 50, 'Generates tens to millions of rows of synthetic data statistically modeled on a given input dataset.', 'Manikandan.Loganathan@infovision.com', null, null, null, '["aws","gcp","azure"]'::jsonb, 'validated', 'Not applicable', 'Hosted service
None', 'GUI based', 'TBD', 'TBD', '[]'::jsonb, '2026-05-12', 'Catalog id ATL-002. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('ATL-003', 'Data Policy Anomaly Bot', 'atlas', 'Compliance Validation, Policy Governance', 'Master Data & Domain Context', 'Natural language compliance bot that validates organizational policies against live BigQuery datasets and flags anomalies by risk severity.', 'AI-powered compliance accelerator with Azure GPT-4 + LangChain + BigQuery.', 'Abhiram Kalidindi', 'AK', 'validated', 'medium', '["azure","gcp"]'::jsonb, '["Compliance","Policy Governance","BigQuery","GDPR","CCPA"]'::jsonb, null, null, null, 0, 0, 0, 0, '["Natural Language Query","Policy Document Retrieval","BigQuery Validation","Anomaly Detection","Risk Severity Classification"]'::jsonb, '["Gui Based"]'::jsonb, '["Python 3.x","Streamlit","Google BigQuery","Azure OpenAI"]'::jsonb, '["Not applicable"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('229d5470-2db0-531b-9eb6-c24834b7633c', 'Data Policy Anomaly Bot', 'atlas', 'Compliance Validation, Policy Governance', 'Master Data & Domain Context', 'Abhiram Kalidindi', 'AK', 'Manual Approval', 0, 'AI-powered compliance accelerator with Azure GPT-4 + LangChain + BigQuery.', 'Abhiram.Kalidindi@infovision.com', null, null, null, '["azure","gcp"]'::jsonb, 'validated', 'Not applicable', 'Python 3.x
Streamlit
Google BigQuery
Azure OpenAI', 'Gui Based', 'Natural Language Query --> Policy Document Retrieval --> BigQuery Validation --> Anomaly Detection --> Risk Severity Classification', 'Natural Language Query --> Policy Document Retrieval --> BigQuery Validation --> Anomaly Detection --> Risk Severity Classification', '[]'::jsonb, '2026-05-12', 'Catalog id ATL-003. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('FRG-001', 'Sprinter', 'forge', 'SDLC Automation & Acceleration', 'Engineering Productivity Office', 'AI-powered SDLC bot that expands user stories, generates tasks, test cases, code snippets, and release notes via a Kanban board.', 'Sprinter streamlines SDLC with GPT-3.5-turbo and a JIRA-style Kanban board.', 'Noumika Balaji', 'NB', 'validated', 'medium', '["azure"]'::jsonb, '["SDLC","Agile","Kanban","GPT"]'::jsonb, null, null, null, 0, 0, 8, 0, '["User Story Input","LLM Prompt Construction","GPT-3.5-turbo","Kanban Board Display","Release Notes / Reports"]'::jsonb, '["GUI based"]'::jsonb, '["Python 3.x","Node.js","React"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('887a2989-ea08-50a1-8270-6e3aacf7ad39', 'Sprinter', 'forge', 'SDLC Automation & Acceleration', 'Engineering Productivity Office', 'Noumika Balaji', 'NB', 'Manual Approval', 0, 'Sprinter streamlines SDLC with GPT-3.5-turbo and a JIRA-style Kanban board.', 'Noumika.Balaji@infovision.com', null, null, null, '["azure"]'::jsonb, 'validated', 'WIP', 'Python 3.x
Node.js
React', 'GUI based', 'User Story Input --> LLM Prompt Construction --> GPT-3.5-turbo --> Kanban Board Display --> Release Notes / Reports', 'User Story Input --> LLM Prompt Construction --> GPT-3.5-turbo --> Kanban Board Display --> Release Notes / Reports', '[]'::jsonb, '2026-05-12', 'Catalog id FRG-001. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('FRG-002', 'Code Migration Frameworks', 'forge', 'Code Modernization, Legacy Migration', 'Modernization Factory', 'AI-assisted COBOL-to-Java and .NET-to-Node.js code migration with real-time developer Q&A.', 'Multi-language modernization using GitHub Copilot and Gemini plugins.', 'Blesson Roy', 'BR', 'validated', 'high', '["azure","gcp"]'::jsonb, '["COBOL","Java","Node.js","GitHub Copilot"]'::jsonb, null, null, null, 0, 0, 0, 0, '["Source Code Ingestion","AI-Assisted Conversion","Output Generation","QA Validation"]'::jsonb, '["Console / Gui based"]'::jsonb, '["Python 3.x","Java 17+","Node.js 18+","COBOL runtime"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('537c3167-7cde-5dbe-85f0-8524e2b0bf96', 'Code Migration Frameworks', 'forge', 'Code Modernization, Legacy Migration', 'Modernization Factory', 'Blesson Roy', 'BR', 'Manual Approval', 0, 'Multi-language modernization using GitHub Copilot and Gemini plugins.', 'Blesson.Roy@infovision.com', null, null, null, '["azure","gcp"]'::jsonb, 'validated', 'WIP', 'Python 3.x
Java 17+
Node.js 18+
COBOL runtime', 'Console / Gui based', 'Source Code Ingestion --> AI-Assisted Conversion --> Output Generation --> QA Validation', 'Source Code Ingestion --> AI-Assisted Conversion --> Output Generation --> QA Validation', '[]'::jsonb, '2026-05-12', 'Catalog id FRG-002. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('FRG-003', 'AI Code Reviewer', 'forge', 'SDLC Automation & Acceleration', 'Release Acceleration', 'Webhook-triggered AI code reviewer with Slack notifications on every PR.', 'Senior Dev GPT — webhook-driven code review for GitLab/GitHub/Bitbucket.', 'Pratyoosh Patel', 'PP', 'validated', 'medium', '["azure"]'::jsonb, '["Code Review","Webhook","Slack","GPT-4"]'::jsonb, null, null, null, 0, 0, 0, 0, '["PR Submitted","Webhook Trigger","GPT-4 Analysis","Slack Notification"]'::jsonb, '["Integrated with Slack and Jira"]'::jsonb, '["Python 3.x","GitLab CI/CD","Slack SDK"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('e1811f0f-d338-5d5b-8a89-4b9ad4268c03', 'AI Code Reviewer', 'forge', 'SDLC Automation & Acceleration', 'Release Acceleration', 'Pratyoosh Patel', 'PP', 'Manual Approval', 0, 'Senior Dev GPT — webhook-driven code review for GitLab/GitHub/Bitbucket.', 'Pratyoosh.Patel@infovision.com', null, null, null, '["azure"]'::jsonb, 'validated', 'WIP', 'Python 3.x
GitLab CI/CD
Slack SDK', 'Integrated with Slack and Jira', 'PR Submitted --> Webhook Trigger --> GPT-4 Analysis --> Slack Notification', 'PR Submitted --> Webhook Trigger --> GPT-4 Analysis --> Slack Notification', '[]'::jsonb, '2026-05-12', 'Catalog id FRG-003. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('FRG-004', 'ADLC Unified Framework', 'forge', 'SDLC Automation & Acceleration', 'Engineering Productivity Office', 'Unified AI Enabler Framework for AIDLC', 'IDE framework for BA, FE, BE, DBA, QA across SDLC.', 'Priyanka Fulewale', 'PF', 'battle-tested', 'medium', '["aws","gcp","azure"]'::jsonb, '["AI SDLC","IDE"]'::jsonb, null, null, null, 1, 1, 1, 85, '["TBD"]'::jsonb, '["IDE"]'::jsonb, '["IDE deployment - autosetup"]'::jsonb, '["Application Standards","References and Guides"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('d74ff1d2-504e-56b2-a3df-eb2dcea45d35', 'ADLC Unified Framework', 'forge', 'SDLC Automation & Acceleration', 'Engineering Productivity Office', 'Priyanka Fulewale', 'PF', 'Manual Approval', 85, 'IDE framework for BA, FE, BE, DBA, QA across SDLC.', 'Priyanka.Fulewale@infovision.com', null, null, null, '["aws","gcp","azure"]'::jsonb, 'battle-tested', 'Application Standards
References and Guides', 'IDE deployment - autosetup', 'IDE', 'TBD', 'TBD', '[]'::jsonb, '2026-05-12', 'Catalog id FRG-004. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('FRG-005', 'Autonomous SDLC Framework', 'forge', 'SDLC Automation & Acceleration', 'Engineering Productivity Office', 'AI Enabler to perform autonomous AIDLC', 'Autonomous SDLC from ADO entry to feature rollout.', 'Nainik K', 'NK', 'experimental', 'medium', '["aws","gcp","azure"]'::jsonb, '["Autonomous SDLC","AI SDLC"]'::jsonb, null, null, null, 0, 0, 2, 0, '["TBD"]'::jsonb, '["IDE"]'::jsonb, '["ADO","Github","IDE deployment (VSCode)"]'::jsonb, '["Application Standards","References and Guides"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('00c68f93-df98-59b1-9a0d-961654c36ae2', 'Autonomous SDLC Framework', 'forge', 'SDLC Automation & Acceleration', 'Engineering Productivity Office', 'Nainik K', 'NK', 'Manual Approval', 0, 'Autonomous SDLC from ADO entry to feature rollout.', 'Nainik.K@infovision.com', null, null, null, '["aws","gcp","azure"]'::jsonb, 'experimental', 'Application Standards
References and Guides', 'ADO
Github
IDE deployment (VSCode)', 'IDE', 'TBD', 'TBD', '[]'::jsonb, '2026-05-12', 'Catalog id FRG-005. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('RLY-001', 'Multiagent Call Center Automation', 'relay', 'Multi-Agent Orchestration, Call Center Automation', 'Customer Care Studio', 'LangGraph multi-agent system for call center automation.', 'Six specialized agents with PostgreSQL and JIRA.', 'Noumika Balaji', 'NB', 'validated', 'high', '["gcp"]'::jsonb, '["LangGraph","Call Center","JIRA"]'::jsonb, null, null, 'https://github.com/by-Gokulram/multiagent_callcenter_automation.git', 1, 1, 5, 75, '["Incoming Call / Trigger","Sentiment Analysis Agent","Ticket Management Agent (JIRA)","Resolution Agent","Post-Call Summary"]'::jsonb, '["Embedded into IVR system"]'::jsonb, '["Python 3.x","LangGraph","PostgreSQL"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('f0727cda-d8b0-515c-a481-78296257d3b5', 'Multiagent Call Center Automation', 'relay', 'Multi-Agent Orchestration, Call Center Automation', 'Customer Care Studio', 'Noumika Balaji', 'NB', 'Manual Approval', 75, 'Six specialized agents with PostgreSQL and JIRA.', 'Noumika.Balaji@infovision.com', 'https://github.com/by-Gokulram/multiagent_callcenter_automation.git', null, null, '["gcp"]'::jsonb, 'validated', 'WIP', 'Python 3.x
LangGraph
PostgreSQL', 'Embedded into IVR system', 'Incoming Call / Trigger --> Sentiment Analysis Agent --> Ticket Management Agent (JIRA) --> Resolution Agent --> Post-Call Summary', 'Incoming Call / Trigger --> Sentiment Analysis Agent --> Ticket Management Agent (JIRA) --> Resolution Agent --> Post-Call Summary', '[]'::jsonb, '2026-05-12', 'Catalog id RLY-001. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('RLY-002', 'Healthcare Bot', 'relay', 'Domain Agent, Knowledge Retrieval', 'Enterprise Knowledge Assistant', 'Dual-persona RAG chatbot for hospital environments.', 'Chroma + Redis + Gemini 1.5 Flash.', 'Abhiram Kalidindi', 'AK', 'validated', 'medium', '["azure","gcp"]'::jsonb, '["RAG","Healthcare","Chroma"]'::jsonb, null, null, null, 1, 1, 4, 50, '["Persona Selection","Document Retrieval","Redis Cache","Role-Tailored Response"]'::jsonb, '["Gui Based"]'::jsonb, '["Python 3.x","FastAPI","Redis","Chroma"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('a05be217-efce-5b2a-acb3-78211cf240af', 'Healthcare Bot', 'relay', 'Domain Agent, Knowledge Retrieval', 'Enterprise Knowledge Assistant', 'Abhiram Kalidindi', 'AK', 'Manual Approval', 50, 'Chroma + Redis + Gemini 1.5 Flash.', 'Abhiram.Kalidindi@infovision.com', null, null, null, '["azure","gcp"]'::jsonb, 'validated', 'WIP', 'Python 3.x
FastAPI
Redis
Chroma', 'Gui Based', 'Persona Selection --> Document Retrieval --> Redis Cache --> Role-Tailored Response', 'Persona Selection --> Document Retrieval --> Redis Cache --> Role-Tailored Response', '[]'::jsonb, '2026-05-12', 'Catalog id RLY-002. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('RLY-003', 'Contextual Intelligence — Speech Diarization', 'relay', 'Conversational AI, Real-Time Intelligence', 'Customer Care Studio', 'Real-time speech diarization and contextual product data.', 'Selenium + LangChain + Redis + iPad UI.', 'Pratyoosh Patel', 'PP', 'battle-tested', 'high', '["gcp","azure"]'::jsonb, '["Speech Diarization","Gemini","Redis"]'::jsonb, null, null, null, 1, 1, 7, 75, '["Live Audio Input","Speech-to-Text (Gemini Flash)","Diarization","Redis Cache","Cart Integration"]'::jsonb, '["Mobile device based Gui"]'::jsonb, '["Python 3.x","React.js","FastAPI","Redis","LangChain"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('5bab82c6-927e-5e37-a779-b53da072a2bd', 'Contextual Intelligence — Speech Diarization', 'relay', 'Conversational AI, Real-Time Intelligence', 'Customer Care Studio', 'Pratyoosh Patel', 'PP', 'Manual Approval', 75, 'Selenium + LangChain + Redis + iPad UI.', 'Pratyoosh.Patel@infovision.com', null, null, null, '["gcp","azure"]'::jsonb, 'battle-tested', 'WIP', 'Python 3.x
React.js
FastAPI
Redis
LangChain', 'Mobile device based Gui', 'Live Audio Input --> Speech-to-Text (Gemini Flash) --> Diarization --> Redis Cache --> Cart Integration', 'Live Audio Input --> Speech-to-Text (Gemini Flash) --> Diarization --> Redis Cache --> Cart Integration', '[]'::jsonb, '2026-05-12', 'Catalog id RLY-003. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('RLY-004', 'AIOps', 'relay', 'Automated Support, SRE', 'Service & Order Operations AI', 'Agentic AI Platform to monitor, triage and resolve production incidents', 'Multi-agent AIOps with guided autonomy.', 'Balasubramani Murugesan', 'BM', 'experimental', 'high', '["azure"]'::jsonb, '["AIOps","Incident monitoring"]'::jsonb, 'http://74.249.248.133:8887/', null, null, 1, 1, 3, 70, '["TBD"]'::jsonb, '["GUI based"]'::jsonb, '["Hosted service"]'::jsonb, '["None"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('475b6748-b54f-50bb-8c05-a3003576ad57', 'AIOps', 'relay', 'Automated Support, SRE', 'Service & Order Operations AI', 'Balasubramani Murugesan', 'BM', 'Manual Approval', 70, 'Multi-agent AIOps with guided autonomy.', 'Balasubramani.Murugesan@infovision.com', null, 'http://74.249.248.133:8887/', null, '["azure"]'::jsonb, 'experimental', 'None', 'Hosted service', 'GUI based', 'TBD', 'TBD', '[]'::jsonb, '2026-05-12', 'Catalog id RLY-004. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('SNT-001', 'Sentiment Analysis on Call Recordings', 'relay', 'Call Quality Monitoring, Compliance Analytics', 'Customer Care Studio', 'Gemini 1.5 Pro multimodal call analyzer.', 'Direct audio analysis without separate transcription.', 'Pratyoosh Patel', 'PP', 'validated', 'medium', '["gcp"]'::jsonb, '["Sentiment","Gemini","Compliance"]'::jsonb, null, null, 'https://github.com/by-Gokulram/tone_sentiment_analysis.git', 1, 1, 3, 65, '["Audio Input","Gemini Analysis","Compliance Detection","Report Generation"]'::jsonb, '["Embedded into IVR system"]'::jsonb, '["Python 3.x","LangChain","Streamlit","Gemini 1.5 Pro"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('8476e331-2337-5b6f-92ff-2e5c49c475d1', 'Sentiment Analysis on Call Recordings', 'relay', 'Call Quality Monitoring, Compliance Analytics', 'Customer Care Studio', 'Pratyoosh Patel', 'PP', 'Manual Approval', 65, 'Direct audio analysis without separate transcription.', 'Pratyoosh.Patel@infovision.com', 'https://github.com/by-Gokulram/tone_sentiment_analysis.git', null, null, '["gcp"]'::jsonb, 'validated', 'WIP', 'Python 3.x
LangChain
Streamlit
Gemini 1.5 Pro', 'Embedded into IVR system', 'Audio Input --> Gemini Analysis --> Compliance Detection --> Report Generation', 'Audio Input --> Gemini Analysis --> Compliance Detection --> Report Generation', '[]'::jsonb, '2026-05-12', 'Catalog id SNT-001. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('SNT-002', 'Responsible AI Automation', 'sentinel', 'Decision automation, Responsible AI', 'AI Run Office', 'Agent based decision automation for Responsible AI', 'RAIE — enterprise Responsible AI governance with agentic architecture.', 'Hasham Ul Haq', 'HH', 'validated', 'high', '["aws","gcp","azure"]'::jsonb, '["AI Governance","Responsible AI"]'::jsonb, null, null, null, 1, 1, 5, 75, '["Discovery","Enrichment","Orchestration","Integration","Shadow Mode","Assisted Review","Scale"]'::jsonb, '["GUI based"]'::jsonb, '["Hosted service"]'::jsonb, '["Knowledge base / policy repository","Enterprise data connectors","Model registry & library","HITL review platform / dashboard","Audit logging infrastructure","Stakeholder review notification system","Approval authority access controls / RBAC","Real-time monitoring & observability stack"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('8d00f0f6-5a8e-581a-b1d7-51f322eae55d', 'Responsible AI Automation', 'sentinel', 'Decision automation, Responsible AI', 'AI Run Office', 'Hasham Ul Haq', 'HH', 'Manual Approval', 75, 'RAIE — enterprise Responsible AI governance with agentic architecture.', 'Hasham.UlHaq@infovision.com', null, null, null, '["aws","gcp","azure"]'::jsonb, 'validated', 'Knowledge base / policy repository
Enterprise data connectors
Model registry & library
HITL review platform / dashboard
Audit logging infrastructure
Stakeholder review notification system
Approval authority access controls / RBAC
Real-time monitoring & observability stack', 'Hosted service', 'GUI based', 'Discovery --> Enrichment --> Orchestration --> Integration --> Shadow Mode --> Assisted Review --> Scale', 'Discovery --> Enrichment --> Orchestration --> Integration --> Shadow Mode --> Assisted Review --> Scale', '[]'::jsonb, '2026-05-12', 'Catalog id SNT-002. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('NXS-001', 'SLM vs LLM Decision Playbook', 'sentinel', 'Model Selection, Cost Benchmarking', 'Model & Agent Operations', 'SLM vs LLM decision framework and cost benchmarking.', 'LangChain, LlamaIndex, Tiktoken; hosted on Vercel.', 'Dhanuvanth Senthilkumar', 'DS', 'validated', 'low', '["aws","gcp","azure"]'::jsonb, '["LLM Benchmarking","Cost Analysis"]'::jsonb, 'https://arch-eval-wx7y.vercel.app/', null, null, 0, 0, 3, 0, '["User assessment form","Decision engine","Gemini narrative","Persist submissions (optional Supabase)"]'::jsonb, '["GUI based"]'::jsonb, '["Node.js","Vite","Tailwind","Google AI SDK","Supabase"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('2a7ec926-7f7a-561c-9932-e02286224259', 'SLM vs LLM Decision Playbook', 'sentinel', 'Model Selection, Cost Benchmarking', 'Model & Agent Operations', 'Dhanuvanth Senthilkumar', 'DS', 'Manual Approval', 0, 'LangChain, LlamaIndex, Tiktoken; hosted on Vercel.', 'Dhanuvanth.SenthilKumar@infovision.com', null, 'https://arch-eval-wx7y.vercel.app/', null, '["aws","gcp","azure"]'::jsonb, 'validated', 'WIP', 'Node.js
Vite
Tailwind
Google AI SDK
Supabase', 'GUI based', 'User assessment form --> Decision engine --> Gemini narrative --> Persist submissions (optional Supabase)', 'User assessment form --> Decision engine --> Gemini narrative --> Persist submissions (optional Supabase)', '[]'::jsonb, '2026-05-12', 'Catalog id NXS-001. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('NXS-002', 'PromptEval', 'nexus', 'Prompt Engineering, Quality Evaluation', 'Common Infrastructure', 'Shared prompt evaluation framework across platform families.', 'Draft — derived from LIE prompt benchmarking patterns.', 'Kishore Bodelu', 'KB', 'experimental', 'low', '["azure","gcp"]'::jsonb, '["Prompt Engineering","Evaluation"]'::jsonb, null, null, null, 1, 1, 2, 80, '["Prompt Variants Input","Multi-Model Execution","Regression Detection","Evaluation Report Export"]'::jsonb, '["Console / Chat interface / Gui based"]'::jsonb, '["Python 3.x","LangChain","Azure OpenAI"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('13f9744a-f272-5864-86cc-f2238e56c069', 'PromptEval', 'nexus', 'Prompt Engineering, Quality Evaluation', 'Common Infrastructure', 'Kishore Bodelu', 'KB', 'Manual Approval', 80, 'Draft — derived from LIE prompt benchmarking patterns.', 'Kishore.Bodelu@infovision.com', null, null, null, '["azure","gcp"]'::jsonb, 'experimental', 'WIP', 'Python 3.x
LangChain
Azure OpenAI', 'Console / Chat interface / Gui based', 'Prompt Variants Input --> Multi-Model Execution --> Regression Detection --> Evaluation Report Export', 'Prompt Variants Input --> Multi-Model Execution --> Regression Detection --> Evaluation Report Export', '[]'::jsonb, '2026-05-12', 'Catalog id NXS-002. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('NXS-003', 'LIE — LLM Insight Engine', 'sentinel', 'Model Selection, Cost Benchmarking', 'Model & Agent Operations', 'Unified multi-LLM benchmarking platform.', 'LIE — concurrent queries across GPT, Mistral, Llama, Gemini.', 'Noumika Balaji', 'NB', 'battle-tested', 'high', '["azure","gcp"]'::jsonb, '["LLM Benchmarking","CUDA","FAISS"]'::jsonb, null, null, null, 1, 1, 7, 70, '["Document Upload","Concurrent Query Execution (GPU/CUDA)","Side-by-Side Display","Excel Export / Email"]'::jsonb, '["GUI based"]'::jsonb, '["Python 3.x","React","LangChain","LlamaIndex","PyTorch","CUDA","FAISS"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('a8dd5762-0cda-594a-9e2f-8a1119ac19f8', 'LIE — LLM Insight Engine', 'sentinel', 'Model Selection, Cost Benchmarking', 'Model & Agent Operations', 'Noumika Balaji', 'NB', 'Manual Approval', 70, 'LIE — concurrent queries across GPT, Mistral, Llama, Gemini.', 'Noumika.Balaji@infovision.com', null, null, null, '["azure","gcp"]'::jsonb, 'battle-tested', 'WIP', 'Python 3.x
React
LangChain
LlamaIndex
PyTorch
CUDA
FAISS', 'GUI based', 'Document Upload --> Concurrent Query Execution (GPU/CUDA) --> Side-by-Side Display --> Excel Export / Email', 'Document Upload --> Concurrent Query Execution (GPU/CUDA) --> Side-by-Side Display --> Excel Export / Email', '[]'::jsonb, '2026-05-12', 'Catalog id NXS-003. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('NXS-004', 'Video Intelligence Platform (VIP)', 'nexus', 'Video processing using LLM and text annotation', 'Multi-Agent Orchestration', 'Video to text interface for video analysis on Intel CPUs.', 'VIP — VideoLlama on Sapphire Rapids; Intel & VMware collaboration.', 'Pratyoosh Patel', 'PP', 'experimental', 'high', '["aws","gcp","azure"]'::jsonb, '["AI video processing","VideoLlama"]'::jsonb, null, null, null, 0, 1, 10, 70, '["Data Ingestion","Embedding Generation","Vector Database Storage","Retriever Subsystem","Model Server Subsystem","Serving Subsystem/User Interface"]'::jsonb, '["Multi step process including hosting an on-prem server"]'::jsonb, '["Intel Xeon Servers","VMware Virtualization Services","VideoLlama Model","Vector Database","Edge Devices/Cameras","Generative AI Infrastructure"]'::jsonb, '["Intel","VMware","VideoLlama","Vector Database","REST APIs","SDKs","Edge Computing","Cloud/On-Prem Infrastructure"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes)
values ('bf33075e-f7ef-5040-bd10-21ceb93a69e7', 'Video Intelligence Platform (VIP)', 'nexus', 'Video processing using LLM and text annotation', 'Multi-Agent Orchestration', 'Pratyoosh Patel', 'PP', 'Manual Approval', 70, 'VIP — VideoLlama on Sapphire Rapids; Intel & VMware collaboration.', 'Pratyoosh.Patel@infovision.com', null, null, null, '["aws","gcp","azure"]'::jsonb, 'experimental', 'Intel
VMware
VideoLlama
Vector Database
REST APIs
SDKs
Edge Computing
Cloud/On-Prem Infrastructure', 'Intel Xeon Servers
VMware Virtualization Services
VideoLlama Model
Vector Database
Edge Devices/Cameras
Generative AI Infrastructure', 'Multi step process including hosting an on-prem server', 'Data Ingestion --> Embedding Generation --> Vector Database Storage --> Retriever Subsystem --> Model Server Subsystem --> Serving Subsystem/User Interface', 'Data Ingestion --> Embedding Generation --> Vector Database Storage --> Retriever Subsystem --> Model Server Subsystem --> Serving Subsystem/User Interface', '[]'::jsonb, '2026-05-12', 'Catalog id NXS-004. AIMPLIFY Tags import 2026-05-12. Edit in Pipeline; add video URLs manually.')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, gov_notes = excluded.gov_notes;


