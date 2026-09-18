-- Generated from AIMPLIFY Tags.xlsx (Sheet1) — 2026-05-12T17:09:35.924Z
-- Idempotent upserts: updates existing rows by assets.id / submissions.id.
-- Submission description = card summary + '\n---AIMPLIFY---\n' + long "About" (see src/lib/catalog.ts).
-- Status: Published (catalog UI lists Published only).

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('ATL-001', 'DataSmith - Tableau to Looker Migration', 'atlas', 'BI Migration', 'Migraton Factory', 'Discovery, Migration and Validation of Tableau dashboards to Looker', 'Discovery - Lineage analysis, schema analysis, cluster analysis', 'Manikandan Loganathan', 'ML', 'experimental', 'low', '["aws","gcp","azure"]'::jsonb, '["Tableau","Looker","DataSmith","Migration","Agentic AI"]'::jsonb, 'https://datasmith.infovision.io', null, null, 0, 0, 2, 0, '["TBD"]'::jsonb, '["GUI based"]'::jsonb, '["Hosted service"]'::jsonb, '["Need Tableau as .twbx files"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('6c5bb5f8-439c-50bb-8be6-ae4ea92a5668', 'DataSmith - Tableau to Looker Migration', 'atlas', 'BI Migration', 'Migraton Factory', 'Manikandan Loganathan', 'ML', 'Published', 0, 'Discovery, Migration and Validation of Tableau dashboards to Looker
---AIMPLIFY---
Discovery - Lineage analysis, schema analysis, cluster analysis', 'Manikandan.Loganathan@infovision.com', null, 'https://datasmith.infovision.io', null, '["aws","gcp","azure"]'::jsonb, 'experimental', 'Need Tableau as .twbx files', 'Hosted service', 'GUI based', 'TBD', 'TBD', '[]'::jsonb, '2026-05-08', 'Catalog id ATL-001. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["Tableau","Looker","DataSmith","Migration","Agentic AI"]
AIMPLIFY_EFFORT:low
AIMPLIFY_STATS_JSON:{"deployments":0,"demos":2,"projects":0,"satisfaction":0}
AIMPLIFY_DEMO_READY:yes
Video file: DataSmith.mp4', '2026-05-08', '2026-05-08')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('ATL-002', 'DataSmith - Synthetic Data Generator', 'atlas', 'Data Generation', 'Master Data & Domain Context', 'Synthetic Data Generator', 'Generates tens to millions of rows synthetic data statistically modeled on given input dataset', 'Manikandan Loganathan', 'ML', 'validated', 'low', '["aws","gcp","azure"]'::jsonb, '["Data Generator","Data Generation","DataSmith"]'::jsonb, null, null, null, 1, 0, 4, 50, '["TBD"]'::jsonb, '["GUI based"]'::jsonb, '["Hosted service"]'::jsonb, '["None"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('0012d719-db4b-5c48-9cb2-2a8ac83758a9', 'DataSmith - Synthetic Data Generator', 'atlas', 'Data Generation', 'Master Data & Domain Context', 'Manikandan Loganathan', 'ML', 'Published', 50, 'Synthetic Data Generator
---AIMPLIFY---
Generates tens to millions of rows synthetic data statistically modeled on given input dataset', 'Manikandan.Loganathan@infovision.com', null, null, null, '["aws","gcp","azure"]'::jsonb, 'validated', 'None', 'Hosted service', 'GUI based', 'TBD', 'TBD', '[]'::jsonb, '2026-05-08', 'Catalog id ATL-002. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["Data Generator","Data Generation","DataSmith"]
AIMPLIFY_EFFORT:low
AIMPLIFY_STATS_JSON:{"deployments":0,"demos":4,"projects":1,"satisfaction":50}
AIMPLIFY_DEMO_READY:yes
Video file: SyntheticDataGenerator.mp4', '2026-05-08', '2026-05-08')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('FRG-001', 'Sprinter', 'forge', 'SDLC Automation & Acceleration', 'Engineering Productivity Office', 'AI-powered SDLC bot that expands user stories, generates tasks, test cases, code snippets, and release notes via a Kanban board.', 'Sprinter is a web application integrated with GPT-3.5-turbo that streamlines the entire software development lifecycle. It automates repetitive SDLC tasks including user story expansion with personas, goals and acceptance criteria, task and subtask generation, code snippet generation across multiple languages, test case creation, test code generation, release notes compilation, and weekly/monthly status reports.

The interface mirrors a JIRA-style Kanban board with four columns: To-Do, In Progress, QA, and Done — each unlocking relevant AI-powered actions at that stage. Project Managers, Developers, and QA Engineers each benefit from role-specific automation that reduces manual effort, improves consistency, and accelerates delivery timelines.

Key challenges solved: manual test case/story creation is error-prone and slow; no tooling existed to leverage historical data for risk prediction and story point estimation. Sprinter addresses both by combining LLM intelligence with structured project context.', 'Noumika Balaji', 'NB', 'validated', 'medium', '["azure"]'::jsonb, '["SDLC","Agile","User Stories","Test Cases","Code Generation","Kanban","Release Notes","GPT","JIRA"]'::jsonb, null, null, null, 0, 0, 8, 0, '["User Story Input","LLM Prompt Construction","GPT-3.5-turbo","Task / Code / Test Case Generation","Kanban Board Display","Release Notes / Reports"]'::jsonb, '["GUI based"]'::jsonb, '["Python 3.x","Node.js","React"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('887a2989-ea08-50a1-8270-6e3aacf7ad39', 'Sprinter', 'forge', 'SDLC Automation & Acceleration', 'Engineering Productivity Office', 'Noumika Balaji', 'NB', 'Published', 0, 'AI-powered SDLC bot that expands user stories, generates tasks, test cases, code snippets, and release notes via a Kanban board.
---AIMPLIFY---
Sprinter is a web application integrated with GPT-3.5-turbo that streamlines the entire software development lifecycle. It automates repetitive SDLC tasks including user story expansion with personas, goals and acceptance criteria, task and subtask generation, code snippet generation across multiple languages, test case creation, test code generation, release notes compilation, and weekly/monthly status reports.

The interface mirrors a JIRA-style Kanban board with four columns: To-Do, In Progress, QA, and Done — each unlocking relevant AI-powered actions at that stage. Project Managers, Developers, and QA Engineers each benefit from role-specific automation that reduces manual effort, improves consistency, and accelerates delivery timelines.

Key challenges solved: manual test case/story creation is error-prone and slow; no tooling existed to leverage historical data for risk prediction and story point estimation. Sprinter addresses both by combining LLM intelligence with structured project context.', 'Noumika.Balaji@infovision.com', null, null, null, '["azure"]'::jsonb, 'validated', 'WIP', 'Python 3.x
Node.js
React', 'GUI based', 'User Story Input --> LLM Prompt Construction --> GPT-3.5-turbo --> Task / Code / Test Case Generation --> Kanban Board Display --> Release Notes / Reports', 'User Story Input --> LLM Prompt Construction --> GPT-3.5-turbo --> Task / Code / Test Case Generation --> Kanban Board Display --> Release Notes / Reports', '[]'::jsonb, '2023-02-01', 'Catalog id FRG-001. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["SDLC","Agile","User Stories","Test Cases","Code Generation","Kanban","Release Notes","GPT","JIRA"]
AIMPLIFY_EFFORT:medium
AIMPLIFY_STATS_JSON:{"deployments":0,"demos":8,"projects":0,"satisfaction":0}
AIMPLIFY_DEMO_READY:yes
Video file: Sprinter.mp4', '2026-05-12', '2026-05-12')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('FRG-002', 'Code Migration Frameworks', 'forge', 'Code Modernization, Legacy Migration', 'Modernization Factory', 'AI-assisted COBOL-to-Java and .NET-to-Node.js code migration with real-time developer Q&A and context-aware conversion.', 'Code Migration Frameworks is a multi-language modernization accelerator that uses GitHub Copilot and Gemini code assist plugins to convert legacy codebases to modern tech stacks. Currently proven for COBOL + C (with Python Flask API) to Java Springboot, and .NET C# to Node.js migrations.

The solution analyzes the source project’s full file structure and codebase context, then assists developers through automated code conversion while answering real-time contextual queries. Additional capabilities include logging, test case generation, and SQL injection anomaly detection baked into the converted output.

Key challenges solved: manual code migration from legacy systems takes months, creates bottlenecks, and requires senior developer expertise for navigation. This accelerator reduces conversion time dramatically while keeping developers in the loop through a conversational AI interface.

Architecture: Legacy Source (COBOL/C/.NET) --> GitHub Copilot / Gemini Plugin (VSCode) --> Context Discovery --> Automated Conversion --> Java Springboot / Node.js Output --> QA & Test Case Generation.', 'Blesson Roy', 'BR', 'validated', 'high', '["gcp","azure"]'::jsonb, '["COBOL","Java","Springboot","Code Migration","Legacy Modernization",".NET","Node.js","GitHub Copilot","Gemini"]'::jsonb, null, null, null, 0, 0, 0, 0, '["Source Code Ingestion","Context Discovery (File Structure Analysis)","AI-Assisted Conversion (Copilot / Gemini)","Output Generation (Java / Node.js)","Test Case Generation","QA Validation"]'::jsonb, '["Console / Gui based"]'::jsonb, '["Python 3.x","Java 17+","Node.js 18+","COBOL runtime"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('537c3167-7cde-5dbe-85f0-8524e2b0bf96', 'Code Migration Frameworks', 'forge', 'Code Modernization, Legacy Migration', 'Modernization Factory', 'Blesson Roy', 'BR', 'Published', 0, 'AI-assisted COBOL-to-Java and .NET-to-Node.js code migration with real-time developer Q&A and context-aware conversion.
---AIMPLIFY---
Code Migration Frameworks is a multi-language modernization accelerator that uses GitHub Copilot and Gemini code assist plugins to convert legacy codebases to modern tech stacks. Currently proven for COBOL + C (with Python Flask API) to Java Springboot, and .NET C# to Node.js migrations.

The solution analyzes the source project’s full file structure and codebase context, then assists developers through automated code conversion while answering real-time contextual queries. Additional capabilities include logging, test case generation, and SQL injection anomaly detection baked into the converted output.

Key challenges solved: manual code migration from legacy systems takes months, creates bottlenecks, and requires senior developer expertise for navigation. This accelerator reduces conversion time dramatically while keeping developers in the loop through a conversational AI interface.

Architecture: Legacy Source (COBOL/C/.NET) --> GitHub Copilot / Gemini Plugin (VSCode) --> Context Discovery --> Automated Conversion --> Java Springboot / Node.js Output --> QA & Test Case Generation.', 'Blesson.Roy@infovision.com', null, null, null, '["gcp","azure"]'::jsonb, 'validated', 'WIP', 'Python 3.x
Java 17+
Node.js 18+
COBOL runtime', 'Console / Gui based', 'Source Code Ingestion --> Context Discovery (File Structure Analysis) --> AI-Assisted Conversion (Copilot / Gemini) --> Output Generation (Java / Node.js) --> Test Case Generation --> QA Validation', 'Source Code Ingestion --> Context Discovery (File Structure Analysis) --> AI-Assisted Conversion (Copilot / Gemini) --> Output Generation (Java / Node.js) --> Test Case Generation --> QA Validation', '[]'::jsonb, '2023-08-10', 'Catalog id FRG-002. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["COBOL","Java","Springboot","Code Migration","Legacy Modernization",".NET","Node.js","GitHub Copilot","Gemini"]
AIMPLIFY_EFFORT:high
AIMPLIFY_STATS_JSON:{"deployments":0,"demos":0,"projects":0,"satisfaction":0}
AIMPLIFY_DEMO_READY:yes
Video file: Not available', '2026-05-01', '2026-05-01')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('FRG-003', 'AI Code Reviewer', 'forge', 'SDLC Automation & Acceleration', 'Release Acceleration', 'Webhook-triggered AI code reviewer that delivers line-by-line analysis, best practice feedback, and Slack notifications on every PR.', 'The ADLC Unified Framework (Senior Dev GPT) is a webhook-driven SDLC optimization bot that automates code review on every pull or merge request. When a developer submits a PR in GitLab, the bot is triggered automatically via webhook, receives the committed code, and acts as a senior developer performing detailed line-by-line analysis.

Feedback is delivered through a Slack app called Senior Dev in a conversational format, providing best practice recommendations, security vulnerability detection, and performance optimization suggestions in real time. The entire loop — from PR submission to feedback delivery — completes in minutes rather than hours.

Key challenges solved: lead developer bandwidth is the primary bottleneck in high-velocity agile teams. Code reviews get rushed or skipped entirely, introducing bugs and technical debt. This accelerator removes the human bottleneck by providing always-on, consistent, high-quality automated review.

Integrates with: GitLab, GitHub, Bitbucket (via webhooks), Slack (notifications), GitLab CI/CD pipeline.', 'Pratyoosh Patel', 'PP', 'validated', 'medium', '["azure"]'::jsonb, '["Code Review","Webhook","GitLab","Slack","CI/CD","GPT-4","SDLC","Automated Review","Pull Request"]'::jsonb, null, null, null, 0, 0, 0, 0, '["PR / MR Submitted","Webhook Trigger (GitLab)","Code Ingestion","GPT-4 Line-by-Line Analysis","Best Practice Scoring","Slack Notification (Senior Dev)","Developer Iterates"]'::jsonb, '["Integrated with Slack and Jira"]'::jsonb, '["Python 3.x","GitLab CI/CD","Slack SDK"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('e1811f0f-d338-5d5b-8a89-4b9ad4268c03', 'AI Code Reviewer', 'forge', 'SDLC Automation & Acceleration', 'Release Acceleration', 'Pratyoosh Patel', 'PP', 'Published', 0, 'Webhook-triggered AI code reviewer that delivers line-by-line analysis, best practice feedback, and Slack notifications on every PR.
---AIMPLIFY---
The ADLC Unified Framework (Senior Dev GPT) is a webhook-driven SDLC optimization bot that automates code review on every pull or merge request. When a developer submits a PR in GitLab, the bot is triggered automatically via webhook, receives the committed code, and acts as a senior developer performing detailed line-by-line analysis.

Feedback is delivered through a Slack app called Senior Dev in a conversational format, providing best practice recommendations, security vulnerability detection, and performance optimization suggestions in real time. The entire loop — from PR submission to feedback delivery — completes in minutes rather than hours.

Key challenges solved: lead developer bandwidth is the primary bottleneck in high-velocity agile teams. Code reviews get rushed or skipped entirely, introducing bugs and technical debt. This accelerator removes the human bottleneck by providing always-on, consistent, high-quality automated review.

Integrates with: GitLab, GitHub, Bitbucket (via webhooks), Slack (notifications), GitLab CI/CD pipeline.', 'Pratyoosh.Patel@infovision.com', null, null, null, '["azure"]'::jsonb, 'validated', 'WIP', 'Python 3.x
GitLab CI/CD
Slack SDK', 'Integrated with Slack and Jira', 'PR / MR Submitted --> Webhook Trigger (GitLab) --> Code Ingestion --> GPT-4 Line-by-Line Analysis --> Best Practice Scoring --> Slack Notification (Senior Dev) --> Developer Iterates', 'PR / MR Submitted --> Webhook Trigger (GitLab) --> Code Ingestion --> GPT-4 Line-by-Line Analysis --> Best Practice Scoring --> Slack Notification (Senior Dev) --> Developer Iterates', '[]'::jsonb, '2026-03-01', 'Catalog id FRG-003. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["Code Review","Webhook","GitLab","Slack","CI/CD","GPT-4","SDLC","Automated Review","Pull Request"]
AIMPLIFY_EFFORT:medium
AIMPLIFY_STATS_JSON:{"deployments":0,"demos":0,"projects":0,"satisfaction":0}
AIMPLIFY_DEMO_READY:yes
Video file: AutomatedCodeReviews.mp4', '2026-04-01', '2026-04-01')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('RLY-001', 'Multiagent Orchestration Engine', 'relay', 'Multi-Agent Orchestration, Call Center Automation', 'Customer Care Studio', 'LangGraph multi-agent system with 6 specialized agents automating sentiment analysis, ticketing, recommendations, and resolution.', 'The Multiagent Call Center Automation System is an AI-driven solution built on a LangGraph-based multi-agent framework that optimizes call center operations through specialized autonomous agents. Six agents work in concert: Sentiment Analysis (real-time tone detection), Customer Profile Update (CRM sync), Call Avoidance (proactive deflection), Support Ticket Management (JIRA integration), Recommendation (personalized suggestions), and Resolution (case closure).

Agents integrate seamlessly with PostgreSQL for data management, JIRA for ticket lifecycle, and email platforms for outbound communication. The LangGraph framework enables agents to operate both autonomously and collaboratively via a shared state memory object — allowing contextual handoffs between agents without data loss.

Key challenges solved: traditional call center workflows are siloed, requiring manual handoffs between systems. This system distributes responsibility across specialized agents, eliminating handoff delays, reducing average handle time, and improving first-call resolution rates. Latency is managed through careful agent architecture and state design.

Owner: Gokulram | Repo: https://github.com/by-Gokulram/multiagent_callcenter_automation.git', 'Noumika Balaji', 'NB', 'validated', 'high', '["gcp"]'::jsonb, '["Multi-Agent","LangGraph","Call Center","Sentiment Analysis","JIRA","Automation","Agentic AI","Orchestration","Gemini"]'::jsonb, null, null, 'https://github.com/by-Gokulram/multiagent_callcenter_automation.git', 1, 1, 5, 75, '["Incoming Call / Trigger","Sentiment Analysis Agent","Customer Profile Agent","Call Avoidance Agent","Ticket Management Agent (JIRA)","Recommendation Agent","Resolution Agent","Post-Call Summary"]'::jsonb, '["Embedded into IVR system"]'::jsonb, '["Python 3.x","LangGraph","PostgreSQL"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('f0727cda-d8b0-515c-a481-78296257d3b5', 'Multiagent Orchestration Engine', 'relay', 'Multi-Agent Orchestration, Call Center Automation', 'Customer Care Studio', 'Noumika Balaji', 'NB', 'Published', 75, 'LangGraph multi-agent system with 6 specialized agents automating sentiment analysis, ticketing, recommendations, and resolution.
---AIMPLIFY---
The Multiagent Call Center Automation System is an AI-driven solution built on a LangGraph-based multi-agent framework that optimizes call center operations through specialized autonomous agents. Six agents work in concert: Sentiment Analysis (real-time tone detection), Customer Profile Update (CRM sync), Call Avoidance (proactive deflection), Support Ticket Management (JIRA integration), Recommendation (personalized suggestions), and Resolution (case closure).

Agents integrate seamlessly with PostgreSQL for data management, JIRA for ticket lifecycle, and email platforms for outbound communication. The LangGraph framework enables agents to operate both autonomously and collaboratively via a shared state memory object — allowing contextual handoffs between agents without data loss.

Key challenges solved: traditional call center workflows are siloed, requiring manual handoffs between systems. This system distributes responsibility across specialized agents, eliminating handoff delays, reducing average handle time, and improving first-call resolution rates. Latency is managed through careful agent architecture and state design.

Owner: Gokulram | Repo: https://github.com/by-Gokulram/multiagent_callcenter_automation.git', 'Noumika.Balaji@infovision.com', 'https://github.com/by-Gokulram/multiagent_callcenter_automation.git', null, null, '["gcp"]'::jsonb, 'validated', 'WIP', 'Python 3.x
LangGraph
PostgreSQL', 'Embedded into IVR system', 'Incoming Call / Trigger --> Sentiment Analysis Agent --> Customer Profile Agent --> Call Avoidance Agent --> Ticket Management Agent (JIRA) --> Recommendation Agent --> Resolution Agent --> Post-Call Summary', 'Incoming Call / Trigger --> Sentiment Analysis Agent --> Customer Profile Agent --> Call Avoidance Agent --> Ticket Management Agent (JIRA) --> Recommendation Agent --> Resolution Agent --> Post-Call Summary', '[]'::jsonb, '2025-04-01', 'Catalog id RLY-001. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["Multi-Agent","LangGraph","Call Center","Sentiment Analysis","JIRA","Automation","Agentic AI","Orchestration","Gemini"]
AIMPLIFY_EFFORT:high
AIMPLIFY_STATS_JSON:{"deployments":1,"demos":5,"projects":1,"satisfaction":75}
AIMPLIFY_DEMO_READY:yes
Video file: MultiagentDemo.mp4', '2026-04-01', '2026-04-01')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('RLY-002', 'Healthcare Bot', 'relay', 'Domain Agent, Knowledge Retrieval', 'Enterprise Knowledge Assistant', 'Dual-persona RAG chatbot for hospital environments serving both patients and staff with role-tailored, policy-aware responses.', 'The Healthcare Bot is a dual-persona RAG-powered conversational agent designed for hospital environments. It serves two distinct user groups — Patients and Staff — each with a dedicated portal pathway and persona-customized responses drawn from role-specific data sources.

For patients, the bot handles medical history queries, appointment details, medication reminders, and general health inquiries. For staff, it provides instant access to HR policies, leave balances, compliance documentation, and operational guidelines. Semantic search powered by Chroma vector store and Redis caching (40% response time reduction) ensures fast, accurate retrieval even from large document corpora.

Key challenges solved: employees and patients both face friction accessing the right information from the right source. Manual HR intervention for routine queries is costly and inconsistent. The Healthcare Bot eliminates this by embedding organizational knowledge directly into a conversational interface, with 85% query accuracy documented on complex semantic queries.

Cross-industry note: the dual-persona architecture is domain-agnostic — the same pattern applies to Finance (advisor + client), Retail (staff + customer), or any organization with two distinct user classes accessing different knowledge bases.', 'Abhiram Kalidindi', 'AK', 'validated', 'medium', '["gcp","azure"]'::jsonb, '["RAG","Healthcare","Dual Persona","Chroma","Redis","Embeddings","Knowledge Retrieval","Gemini","FastAPI"]'::jsonb, null, null, null, 1, 1, 4, 50, '["User Query (Patient / Staff Portal)","Persona Selection","Document Retrieval (Chroma Vector Store)","Redis Cache Check","Gemini 1.5 Flash LLM","Role-Tailored Response","Feedback Logging"]'::jsonb, '["Gui Based"]'::jsonb, '["Python 3.x","FastAPI","Redis","Chroma"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('a05be217-efce-5b2a-acb3-78211cf240af', 'Healthcare Bot', 'relay', 'Domain Agent, Knowledge Retrieval', 'Enterprise Knowledge Assistant', 'Abhiram Kalidindi', 'AK', 'Published', 50, 'Dual-persona RAG chatbot for hospital environments serving both patients and staff with role-tailored, policy-aware responses.
---AIMPLIFY---
The Healthcare Bot is a dual-persona RAG-powered conversational agent designed for hospital environments. It serves two distinct user groups — Patients and Staff — each with a dedicated portal pathway and persona-customized responses drawn from role-specific data sources.

For patients, the bot handles medical history queries, appointment details, medication reminders, and general health inquiries. For staff, it provides instant access to HR policies, leave balances, compliance documentation, and operational guidelines. Semantic search powered by Chroma vector store and Redis caching (40% response time reduction) ensures fast, accurate retrieval even from large document corpora.

Key challenges solved: employees and patients both face friction accessing the right information from the right source. Manual HR intervention for routine queries is costly and inconsistent. The Healthcare Bot eliminates this by embedding organizational knowledge directly into a conversational interface, with 85% query accuracy documented on complex semantic queries.

Cross-industry note: the dual-persona architecture is domain-agnostic — the same pattern applies to Finance (advisor + client), Retail (staff + customer), or any organization with two distinct user classes accessing different knowledge bases.', 'Abhiram.Kalidindi@infovision.com', null, null, null, '["gcp","azure"]'::jsonb, 'validated', 'WIP', 'Python 3.x
FastAPI
Redis
Chroma', 'Gui Based', 'User Query (Patient / Staff Portal) --> Persona Selection --> Document Retrieval (Chroma Vector Store) --> Redis Cache Check --> Gemini 1.5 Flash LLM --> Role-Tailored Response --> Feedback Logging', 'User Query (Patient / Staff Portal) --> Persona Selection --> Document Retrieval (Chroma Vector Store) --> Redis Cache Check --> Gemini 1.5 Flash LLM --> Role-Tailored Response --> Feedback Logging', '[]'::jsonb, '2025-04-01', 'Catalog id RLY-002. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["RAG","Healthcare","Dual Persona","Chroma","Redis","Embeddings","Knowledge Retrieval","Gemini","FastAPI"]
AIMPLIFY_EFFORT:medium
AIMPLIFY_STATS_JSON:{"deployments":1,"demos":4,"projects":1,"satisfaction":50}
AIMPLIFY_DEMO_READY:yes
Video file: HealthcareBot.mp4', '2026-04-01', '2026-04-01')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('RLY-003', 'Contextual Intelligence – Speech Diarization', 'relay', 'Conversational AI, Real-Time Intelligence', 'Customer Care Studio', 'Real-time speech diarization that structures live customer conversations and serves contextual product data and trade-in options instantly.', 'The Contextual Intelligence Speech Diarization System is a real-time conversational intelligence accelerator built for high-engagement customer interactions (retail, telecom). It listens to live audio between a CSR and customer, converts speech to text, attributes each utterance to the correct speaker (90% accuracy with clean audio), and extracts structured insights categorized by products, plans, and information requests — all with timestamps.

Simultaneously, the system performs dynamic web scraping via Selenium and LangChain to fetch real-time product availability, pricing, color options, and trade-in values from external sources. Results are cached in Redis (40% latency improvement) and surfaced on an interactive iPad interface showing insight bubbles and a cart integration for seamless purchase completion.

Key challenges solved: sales reps lose conversational flow while manually looking up product details, directly impacting conversion rates. This accelerator keeps reps present in the conversation while the AI handles real-time lookup, structuring, and recommendations in the background.

Classification: Accelerator (100% reusable) | Owner: Veera | Team: Veerasekhar, Abhiram, Blesson, Padma Priya, Satish, Rahul', 'Pratyoosh Patel', 'PP', 'battle-tested', 'high', '["gcp","azure"]'::jsonb, '["Speech Diarization","Real-Time","Conversational AI","Web Scraping","Redis","LangChain","Gemini","Speaker Attribution","Cart Integration"]'::jsonb, null, null, null, 1, 1, 7, 75, '["Live Audio Input","Speech-to-Text (Gemini Flash)","Speaker Attribution (Diarization)","Insight Extraction & Categorization","Dynamic Product Retrieval (Selenium / Web Scraping)","Redis Cache","Interactive UI Display (iPad)","Cart Integration"]'::jsonb, '["Mobile device based Gui"]'::jsonb, '["Python 3.x","React.js","FastAPI","Redis","LangChain"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('5bab82c6-927e-5e37-a779-b53da072a2bd', 'Contextual Intelligence – Speech Diarization', 'relay', 'Conversational AI, Real-Time Intelligence', 'Customer Care Studio', 'Pratyoosh Patel', 'PP', 'Published', 75, 'Real-time speech diarization that structures live customer conversations and serves contextual product data and trade-in options instantly.
---AIMPLIFY---
The Contextual Intelligence Speech Diarization System is a real-time conversational intelligence accelerator built for high-engagement customer interactions (retail, telecom). It listens to live audio between a CSR and customer, converts speech to text, attributes each utterance to the correct speaker (90% accuracy with clean audio), and extracts structured insights categorized by products, plans, and information requests — all with timestamps.

Simultaneously, the system performs dynamic web scraping via Selenium and LangChain to fetch real-time product availability, pricing, color options, and trade-in values from external sources. Results are cached in Redis (40% latency improvement) and surfaced on an interactive iPad interface showing insight bubbles and a cart integration for seamless purchase completion.

Key challenges solved: sales reps lose conversational flow while manually looking up product details, directly impacting conversion rates. This accelerator keeps reps present in the conversation while the AI handles real-time lookup, structuring, and recommendations in the background.

Classification: Accelerator (100% reusable) | Owner: Veera | Team: Veerasekhar, Abhiram, Blesson, Padma Priya, Satish, Rahul', 'Pratyoosh.Patel@infovision.com', null, null, null, '["gcp","azure"]'::jsonb, 'battle-tested', 'WIP', 'Python 3.x
React.js
FastAPI
Redis
LangChain', 'Mobile device based Gui', 'Live Audio Input --> Speech-to-Text (Gemini Flash) --> Speaker Attribution (Diarization) --> Insight Extraction & Categorization --> Dynamic Product Retrieval (Selenium / Web Scraping) --> Redis Cache --> Interactive UI Display (iPad) --> Cart Integration', 'Live Audio Input --> Speech-to-Text (Gemini Flash) --> Speaker Attribution (Diarization) --> Insight Extraction & Categorization --> Dynamic Product Retrieval (Selenium / Web Scraping) --> Redis Cache --> Interactive UI Display (iPad) --> Cart Integration', '[]'::jsonb, '2025-04-01', 'Catalog id RLY-003. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["Speech Diarization","Real-Time","Conversational AI","Web Scraping","Redis","LangChain","Gemini","Speaker Attribution","Cart Integration"]
AIMPLIFY_EFFORT:high
AIMPLIFY_STATS_JSON:{"deployments":1,"demos":7,"projects":1,"satisfaction":75}
AIMPLIFY_DEMO_READY:yes
Video file: SpeechDiarization.mp4', '2026-05-01', '2026-05-01')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('ATL-003', 'Data Policy Anomaly Bot', 'atlas', 'Compliance Validation, Policy Governance', 'Master Data & Domain Context', 'Natural language compliance bot that validates organizational policies against live BigQuery datasets and flags anomalies by risk severity.', 'The Data Policy Anomaly Bot is an AI-powered compliance accelerator that enables non-technical users to query organizational policies in plain English and validate them against live datasets in real time. Built on Azure GPT-4 + LangChain + BigQuery, the bot retrieves relevant policy documents via vector embeddings, generates structured validation queries, and runs them against live data to detect schema-level and data-level violations.

Anomaly detection results are classified by risk severity and surfaced as clear, actionable bullet-point summaries — no SQL expertise required. The system is designed for compliance teams operating under GDPR, CCPA, or internal data governance frameworks who need to dramatically reduce manual review cycles.

Key challenges solved: manual compliance checks against large datasets are error-prone and IT-dependent. This bot eliminates the bottleneck by automating policy retrieval, validation, and risk classification end-to-end, reducing dependency on technical teams and lowering non-compliance exposure.

Known limitations: token limits can constrain validation on very large BigQuery datasets; complex edge-case queries may need refinement. Processing time for large dataset validation averages 5–10 minutes per query.

Team: Abhiram, Veerasekar, Renju | Owner: Veera', 'Abhiram Kalidindi', 'AK', 'validated', 'medium', '["gcp","azure"]'::jsonb, '["Compliance","Policy Governance","Anomaly Detection","BigQuery","GDPR","CCPA","LangChain","GPT-4","Vector Embeddings","Risk Classification"]'::jsonb, null, null, null, 0, 0, 0, 0, '["Natural Language Query","Policy Document Retrieval (Vector Embeddings / FAISS)","Query Structuring (GPT-4)","BigQuery Validation (Schema + Data Level)","Anomaly Detection","Risk Severity Classification","Actionable Summary Output"]'::jsonb, '["Gui Based"]'::jsonb, '["Python 3.x","Streamlit","Google BigQuery","Azure OpenAI"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('229d5470-2db0-531b-9eb6-c24834b7633c', 'Data Policy Anomaly Bot', 'atlas', 'Compliance Validation, Policy Governance', 'Master Data & Domain Context', 'Abhiram Kalidindi', 'AK', 'Published', 0, 'Natural language compliance bot that validates organizational policies against live BigQuery datasets and flags anomalies by risk severity.
---AIMPLIFY---
The Data Policy Anomaly Bot is an AI-powered compliance accelerator that enables non-technical users to query organizational policies in plain English and validate them against live datasets in real time. Built on Azure GPT-4 + LangChain + BigQuery, the bot retrieves relevant policy documents via vector embeddings, generates structured validation queries, and runs them against live data to detect schema-level and data-level violations.

Anomaly detection results are classified by risk severity and surfaced as clear, actionable bullet-point summaries — no SQL expertise required. The system is designed for compliance teams operating under GDPR, CCPA, or internal data governance frameworks who need to dramatically reduce manual review cycles.

Key challenges solved: manual compliance checks against large datasets are error-prone and IT-dependent. This bot eliminates the bottleneck by automating policy retrieval, validation, and risk classification end-to-end, reducing dependency on technical teams and lowering non-compliance exposure.

Known limitations: token limits can constrain validation on very large BigQuery datasets; complex edge-case queries may need refinement. Processing time for large dataset validation averages 5–10 minutes per query.

Team: Abhiram, Veerasekar, Renju | Owner: Veera', 'Abhiram.Kalidindi@infovision.com', null, null, null, '["gcp","azure"]'::jsonb, 'validated', 'WIP', 'Python 3.x
Streamlit
Google BigQuery
Azure OpenAI', 'Gui Based', 'Natural Language Query --> Policy Document Retrieval (Vector Embeddings / FAISS) --> Query Structuring (GPT-4) --> BigQuery Validation (Schema + Data Level) --> Anomaly Detection --> Risk Severity Classification --> Actionable Summary Output', 'Natural Language Query --> Policy Document Retrieval (Vector Embeddings / FAISS) --> Query Structuring (GPT-4) --> BigQuery Validation (Schema + Data Level) --> Anomaly Detection --> Risk Severity Classification --> Actionable Summary Output', '[]'::jsonb, '2025-12-01', 'Catalog id ATL-003. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["Compliance","Policy Governance","Anomaly Detection","BigQuery","GDPR","CCPA","LangChain","GPT-4","Vector Embeddings","Risk Classification"]
AIMPLIFY_EFFORT:medium
AIMPLIFY_STATS_JSON:{"deployments":0,"demos":0,"projects":0,"satisfaction":0}
AIMPLIFY_DEMO_READY:yes
Video file: PolicyAnomalyBot.mp4', '2026-05-01', '2026-05-01')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('SNT-001', 'Sentiment Analysis', 'relay', 'Call Quality Monitoring, Compliance Analytics', 'Customer Care Studio', 'Gemini 1.5 Pro multimodal call analyzer that detects sentiment, tone sarcasm, and compliance violations directly from audio — no transcription needed.', 'The Sentiment Analysis on Call Recordings system uses Google Gemini 1.5 Pro''s native multimodal audio processing to analyze customer service calls end-to-end without requiring a separate transcription step. Gemini directly evaluates both audio content and vocal tone to assess sentiment intensity, tone sarcasm, and linguistic compliance markers — matching the latency and accuracy of text-based analysis.

The system flags calls for compliance violations based on predefined regulatory keywords and thresholds, and generates customizable reports highlighting sentiment trends, risk areas, and agent performance metrics. This positions it as both a real-time QA layer and a post-call analytics engine for call center operations.

Key challenges solved: traditional sentiment analysis pipelines require transcription as a prerequisite, adding cost, latency, and accuracy loss (especially for accented speech or noisy environments). Gemini’s direct audio processing eliminates this stage entirely, delivering faster, more nuanced results.

Validated on Verizon call center data. Repo available.

Owner: Gokulram | Repo: https://github.com/by-Gokulram/tone_sentiment_analysis.git', 'Pratyoosh Patel', 'PP', 'validated', 'medium', '["gcp"]'::jsonb, '["Sentiment Analysis","Call Recordings","Compliance","Tone Detection","Gemini","Multimodal","Audio Processing","Call Center","QA Monitoring"]'::jsonb, null, null, 'https://github.com/by-Gokulram/tone_sentiment_analysis.git', 1, 1, 3, 65, '["Audio Input (Call Recording)","Gemini 1.5 Pro Direct Audio Analysis","Sentiment Scoring (Tone Intensity / Sarcasm / Emotion)","Compliance Keyword Detection","Risk Flagging","Customizable Report Generation"]'::jsonb, '["Embedded into IVR system"]'::jsonb, '["Python 3.x","LangChain","Streamlit","Gemini 1.5 Pro"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('8476e331-2337-5b6f-92ff-2e5c49c475d1', 'Sentiment Analysis', 'relay', 'Call Quality Monitoring, Compliance Analytics', 'Customer Care Studio', 'Pratyoosh Patel', 'PP', 'Published', 65, 'Gemini 1.5 Pro multimodal call analyzer that detects sentiment, tone sarcasm, and compliance violations directly from audio — no transcription needed.
---AIMPLIFY---
The Sentiment Analysis on Call Recordings system uses Google Gemini 1.5 Pro''s native multimodal audio processing to analyze customer service calls end-to-end without requiring a separate transcription step. Gemini directly evaluates both audio content and vocal tone to assess sentiment intensity, tone sarcasm, and linguistic compliance markers — matching the latency and accuracy of text-based analysis.

The system flags calls for compliance violations based on predefined regulatory keywords and thresholds, and generates customizable reports highlighting sentiment trends, risk areas, and agent performance metrics. This positions it as both a real-time QA layer and a post-call analytics engine for call center operations.

Key challenges solved: traditional sentiment analysis pipelines require transcription as a prerequisite, adding cost, latency, and accuracy loss (especially for accented speech or noisy environments). Gemini’s direct audio processing eliminates this stage entirely, delivering faster, more nuanced results.

Validated on Verizon call center data. Repo available.

Owner: Gokulram | Repo: https://github.com/by-Gokulram/tone_sentiment_analysis.git', 'Pratyoosh.Patel@infovision.com', 'https://github.com/by-Gokulram/tone_sentiment_analysis.git', null, null, '["gcp"]'::jsonb, 'validated', 'WIP', 'Python 3.x
LangChain
Streamlit
Gemini 1.5 Pro', 'Embedded into IVR system', 'Audio Input (Call Recording) --> Gemini 1.5 Pro Direct Audio Analysis --> Sentiment Scoring (Tone Intensity / Sarcasm / Emotion) --> Compliance Keyword Detection --> Risk Flagging --> Customizable Report Generation', 'Audio Input (Call Recording) --> Gemini 1.5 Pro Direct Audio Analysis --> Sentiment Scoring (Tone Intensity / Sarcasm / Emotion) --> Compliance Keyword Detection --> Risk Flagging --> Customizable Report Generation', '[]'::jsonb, '2025-04-01', 'Catalog id SNT-001. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["Sentiment Analysis","Call Recordings","Compliance","Tone Detection","Gemini","Multimodal","Audio Processing","Call Center","QA Monitoring"]
AIMPLIFY_EFFORT:medium
AIMPLIFY_STATS_JSON:{"deployments":1,"demos":3,"projects":1,"satisfaction":65}
AIMPLIFY_DEMO_READY:yes
Video file: SentimentAnalysisDemo.mp4', '2026-05-01', '2026-05-01')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('NXS-001', 'SLM vs LLM Decision Playbook', 'sentinel', 'Model Selection, Cost Benchmarking', 'Model & Agent Operations', 'A systematic framework for choosing between Small Language Models (SLM) and Large Language Models (LLM) based on deployment constraints, operational readiness, and business requirements.', 'The SLM vs LLM Decision Playbook is a cost-analysis and benchmarking tool that helps engineering teams make informed model selection decisions before committing to a tech stack. Built with LangChain, LlamaIndex, and Tiktoken, the tool lets users select from multiple LLMs (GPT-3.5-turbo, GPT-3.5-turbo-16k, text-davinci-002/003) and embedding models (text-embedding-ada-002), run queries against a shared dataset, and compare cost per 1K tokens, input/output/embedding token counts, and total query cost side by side.

Outputs include bar chart visualizations of cost breakdowns per model combination and a word cloud of the most semantically relevant terms in the retrieved data. The tool embeds the data source once at initialization and reuses those vectors across all queries, eliminating redundant embedding costs.

Key value for Nexus: every platform family (Forge, Relay, Sentinel, Atlas) faces the same model selection question at project kickoff. This playbook gives teams a structured, data-driven answer rather than a gut-feel choice — directly reducing LLM spend on production deployments.

Owner: Noumika | Contributors: Pravallika Hazarath, Noumika Balaji', 'Dhanuvanth Senthilkumar', 'DS', 'validated', 'low', '["aws","gcp","azure"]'::jsonb, '["LLM Benchmarking","Cost Analysis","Token Cost","Model Selection","SLM","Embeddings","LangChain","LlamaIndex","GPT"]'::jsonb, 'https://arch-eval-wx7y.vercel.app/', null, null, 0, 0, 3, 0, '["User assessment form","Decision engine (gatekeepers + weighted score)","Recommendation result","Gemini narrative","Persist submissions (optional Supabase)"]'::jsonb, '["GUI based"]'::jsonb, '["React and React DOM","TypeScript and type definitions","Vite and plugins","Tailwind CSS and PostCSS","Google Generative AI SDK","Supabase client","Lucide icons"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('2a7ec926-7f7a-561c-9932-e02286224259', 'SLM vs LLM Decision Playbook', 'sentinel', 'Model Selection, Cost Benchmarking', 'Model & Agent Operations', 'Dhanuvanth Senthilkumar', 'DS', 'Published', 0, 'A systematic framework for choosing between Small Language Models (SLM) and Large Language Models (LLM) based on deployment constraints, operational readiness, and business requirements.
---AIMPLIFY---
The SLM vs LLM Decision Playbook is a cost-analysis and benchmarking tool that helps engineering teams make informed model selection decisions before committing to a tech stack. Built with LangChain, LlamaIndex, and Tiktoken, the tool lets users select from multiple LLMs (GPT-3.5-turbo, GPT-3.5-turbo-16k, text-davinci-002/003) and embedding models (text-embedding-ada-002), run queries against a shared dataset, and compare cost per 1K tokens, input/output/embedding token counts, and total query cost side by side.

Outputs include bar chart visualizations of cost breakdowns per model combination and a word cloud of the most semantically relevant terms in the retrieved data. The tool embeds the data source once at initialization and reuses those vectors across all queries, eliminating redundant embedding costs.

Key value for Nexus: every platform family (Forge, Relay, Sentinel, Atlas) faces the same model selection question at project kickoff. This playbook gives teams a structured, data-driven answer rather than a gut-feel choice — directly reducing LLM spend on production deployments.

Owner: Noumika | Contributors: Pravallika Hazarath, Noumika Balaji', 'Dhanuvanth.SenthilKumar@infovision.com', null, 'https://arch-eval-wx7y.vercel.app/', null, '["aws","gcp","azure"]'::jsonb, 'validated', 'WIP', 'React and React DOM
TypeScript and type definitions
Vite and plugins
Tailwind CSS and PostCSS
Google Generative AI SDK
Supabase client
Lucide icons', 'GUI based', 'User assessment form --> Decision engine (gatekeepers + weighted score) --> Recommendation result --> Gemini narrative --> Persist submissions (optional Supabase)', 'User assessment form --> Decision engine (gatekeepers + weighted score) --> Recommendation result --> Gemini narrative --> Persist submissions (optional Supabase)', '[]'::jsonb, '2026-01-01', 'Catalog id NXS-001. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["LLM Benchmarking","Cost Analysis","Token Cost","Model Selection","SLM","Embeddings","LangChain","LlamaIndex","GPT"]
AIMPLIFY_EFFORT:low
AIMPLIFY_STATS_JSON:{"deployments":0,"demos":3,"projects":0,"satisfaction":0}
AIMPLIFY_DEMO_READY:yes
Video file: slm_vs_llm.mp4', '2026-05-01', '2026-05-01')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('NXS-002', 'PromptEval', 'nexus', 'Prompt Engineering, Quality Evaluation', 'Common Infrastructure', 'Shared prompt evaluation framework for testing, scoring, and iterating on prompts across all platform families and LLM providers.', 'PromptEval is a cross-platform prompt quality evaluation framework that provides a structured methodology for testing, scoring, and iterating on prompts before they are deployed in production accelerators. As a Nexus shared utility, it serves all platform families — Forge engineers validating code review prompts, Relay teams testing conversational agent personas, Sentinel teams assessing compliance query accuracy, and Atlas teams evaluating data insight prompts.

Core capabilities include: multi-prompt variant testing against the same input dataset, response scoring across dimensions (accuracy, relevance, completeness, tone adherence), side-by-side comparison of prompt outputs, regression detection when prompts are modified, and exportable evaluation reports.

Key value for Nexus: prompt quality is the single most variable factor in LLM output quality across all accelerators. Without a shared evaluation layer, every team re-invents ad hoc testing. PromptEval standardizes this into a reusable workflow that can be plugged into any accelerator’s development cycle.

Note: Sheet2 documentation for PromptEval as a standalone entry is limited — this entry is derived from the LIE platform (LLM Insights Engine) prompt benchmarking capabilities and the broader Nexus prompt management pattern established across multiple projects.', 'Kishore Bodelu', 'KB', 'experimental', 'low', '["gcp","azure"]'::jsonb, '["Prompt Engineering","Evaluation","Benchmarking","Quality","LLM Testing","Regression","Prompt Management"]'::jsonb, null, null, null, 1, 1, 2, 80, '["Prompt Variants Input","Dataset Selection","Multi-Model Execution","Response Scoring (Accuracy / Relevance / Tone)","Side-by-Side Comparison","Regression Detection","Evaluation Report Export"]'::jsonb, '["Console / Chat interface / Gui based"]'::jsonb, '["Python 3.x","LangChain","Azure OpenAI"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('13f9744a-f272-5864-86cc-f2238e56c069', 'PromptEval', 'nexus', 'Prompt Engineering, Quality Evaluation', 'Common Infrastructure', 'Kishore Bodelu', 'KB', 'Published', 80, 'Shared prompt evaluation framework for testing, scoring, and iterating on prompts across all platform families and LLM providers.
---AIMPLIFY---
PromptEval is a cross-platform prompt quality evaluation framework that provides a structured methodology for testing, scoring, and iterating on prompts before they are deployed in production accelerators. As a Nexus shared utility, it serves all platform families — Forge engineers validating code review prompts, Relay teams testing conversational agent personas, Sentinel teams assessing compliance query accuracy, and Atlas teams evaluating data insight prompts.

Core capabilities include: multi-prompt variant testing against the same input dataset, response scoring across dimensions (accuracy, relevance, completeness, tone adherence), side-by-side comparison of prompt outputs, regression detection when prompts are modified, and exportable evaluation reports.

Key value for Nexus: prompt quality is the single most variable factor in LLM output quality across all accelerators. Without a shared evaluation layer, every team re-invents ad hoc testing. PromptEval standardizes this into a reusable workflow that can be plugged into any accelerator’s development cycle.

Note: Sheet2 documentation for PromptEval as a standalone entry is limited — this entry is derived from the LIE platform (LLM Insights Engine) prompt benchmarking capabilities and the broader Nexus prompt management pattern established across multiple projects.', 'Kishore.Bodelu@infovision.com', null, null, null, '["gcp","azure"]'::jsonb, 'experimental', 'WIP', 'Python 3.x
LangChain
Azure OpenAI', 'Console / Chat interface / Gui based', 'Prompt Variants Input --> Dataset Selection --> Multi-Model Execution --> Response Scoring (Accuracy / Relevance / Tone) --> Side-by-Side Comparison --> Regression Detection --> Evaluation Report Export', 'Prompt Variants Input --> Dataset Selection --> Multi-Model Execution --> Response Scoring (Accuracy / Relevance / Tone) --> Side-by-Side Comparison --> Regression Detection --> Evaluation Report Export', '[]'::jsonb, '2026-05-01', 'Catalog id NXS-002. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["Prompt Engineering","Evaluation","Benchmarking","Quality","LLM Testing","Regression","Prompt Management"]
AIMPLIFY_EFFORT:low
AIMPLIFY_STATS_JSON:{"deployments":1,"demos":2,"projects":1,"satisfaction":80}
AIMPLIFY_DEMO_READY:yes
Video file: prompteval.mp4', '2026-05-01', '2026-05-01')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('NXS-003', 'LIE – LLM Insight Engine', 'sentinel', 'Model Selection, Cost Benchmarking', 'Model & Agent Operations', 'Unified multi-LLM benchmarking platform that runs concurrent queries across GPT, Mistral, Llama, Gemini and compares responses side by side.', 'The LLM Insight Engine (LIE) is a single unified platform that enables development teams to benchmark any combination of LLMs and embedding models against the same training document and query set — delivering fair, reproducible, apples-to-apples comparisons.

Users upload a source document, select from an extensive list of LLMs (GPT-3.5/4/4-32k, PaLM 2, Stable LM 3B, Mistral 7B, Llama, Claude, Cohere, Falcon 40B and more) and embedding models (text-embedding-ada-002, MiniLM-L6-v2, gte-large, GooglePalmEmbeddings), and the engine computes all viable LLM-embedding combinations. Queries are executed concurrently across all combinations with response times tracked. Results are displayed side by side on screen and exportable as Excel or via email.

Key technical achievement: moving model execution from CPU to GPU layers (CUDA) reduced concurrent execution times significantly. Parameters are held constant across all runs (Temperature=0.2, Similarity Top K=2, Chunk Size=1000, Chunk Overlap=10) ensuring benchmarking integrity.

Classification: Accelerator (100%) | Owner: Noumika | Contributors: Abhiram, Pravallika, Veerashekar, Blesson, Hebin', 'Noumika Balaji', 'NB', 'battle-tested', 'high', '["gcp","azure"]'::jsonb, '["LLM Benchmarking","Multi-LLM","GPT","Mistral","Llama","Gemini","Embeddings","Model Comparison","FAISS","LangChain","LlamaIndex"]'::jsonb, null, null, null, 1, 1, 7, 70, '["Document Upload","Model & Embedding Selection","Viable Combination Computation","Concurrent Query Execution (GPU/CUDA)","Response + Latency Capture","Side-by-Side Display","Excel Export / Email"]'::jsonb, '["GUI based"]'::jsonb, '["Python 3.x","React","LangChain","LlamaIndex","PyTorch","CUDA","FAISS"]'::jsonb, '["WIP"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('a8dd5762-0cda-594a-9e2f-8a1119ac19f8', 'LIE – LLM Insight Engine', 'sentinel', 'Model Selection, Cost Benchmarking', 'Model & Agent Operations', 'Noumika Balaji', 'NB', 'Published', 70, 'Unified multi-LLM benchmarking platform that runs concurrent queries across GPT, Mistral, Llama, Gemini and compares responses side by side.
---AIMPLIFY---
The LLM Insight Engine (LIE) is a single unified platform that enables development teams to benchmark any combination of LLMs and embedding models against the same training document and query set — delivering fair, reproducible, apples-to-apples comparisons.

Users upload a source document, select from an extensive list of LLMs (GPT-3.5/4/4-32k, PaLM 2, Stable LM 3B, Mistral 7B, Llama, Claude, Cohere, Falcon 40B and more) and embedding models (text-embedding-ada-002, MiniLM-L6-v2, gte-large, GooglePalmEmbeddings), and the engine computes all viable LLM-embedding combinations. Queries are executed concurrently across all combinations with response times tracked. Results are displayed side by side on screen and exportable as Excel or via email.

Key technical achievement: moving model execution from CPU to GPU layers (CUDA) reduced concurrent execution times significantly. Parameters are held constant across all runs (Temperature=0.2, Similarity Top K=2, Chunk Size=1000, Chunk Overlap=10) ensuring benchmarking integrity.

Classification: Accelerator (100%) | Owner: Noumika | Contributors: Abhiram, Pravallika, Veerashekar, Blesson, Hebin', 'Noumika.Balaji@infovision.com', null, null, null, '["gcp","azure"]'::jsonb, 'battle-tested', 'WIP', 'Python 3.x
React
LangChain
LlamaIndex
PyTorch
CUDA
FAISS', 'GUI based', 'Document Upload --> Model & Embedding Selection --> Viable Combination Computation --> Concurrent Query Execution (GPU/CUDA) --> Response + Latency Capture --> Side-by-Side Display --> Excel Export / Email', 'Document Upload --> Model & Embedding Selection --> Viable Combination Computation --> Concurrent Query Execution (GPU/CUDA) --> Response + Latency Capture --> Side-by-Side Display --> Excel Export / Email', '[]'::jsonb, '2024-04-01', 'Catalog id NXS-003. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["LLM Benchmarking","Multi-LLM","GPT","Mistral","Llama","Gemini","Embeddings","Model Comparison","FAISS","LangChain","LlamaIndex"]
AIMPLIFY_EFFORT:high
AIMPLIFY_STATS_JSON:{"deployments":1,"demos":7,"projects":1,"satisfaction":70}
AIMPLIFY_DEMO_READY:yes
Video file: LLMInsightEngine.mp4', '2026-04-01', '2026-04-01')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('RLY-004', 'AIOps', 'relay', 'Automated Support, SRE', 'Service & Order Operations AI', 'Agentic AI Platform to monitor, triage and resolve production incidents', 'Agentic AI Platform for AI Operations in a Multi-Agent setup to monitor, triage and resolve production incidents in a guided autonomy mode', 'Balasubramani Murugesan', 'BM', 'experimental', 'high', '["azure"]'::jsonb, '["AIOps","Production Support","Incident monitoring","Incident resolution","Agentic AI for Ops"]'::jsonb, 'http://74.249.248.133:8887/', null, null, 1, 1, 3, 70, '["TBD"]'::jsonb, '["GUI based"]'::jsonb, '["Hosted service"]'::jsonb, '["None"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('475b6748-b54f-50bb-8c05-a3003576ad57', 'AIOps', 'relay', 'Automated Support, SRE', 'Service & Order Operations AI', 'Balasubramani Murugesan', 'BM', 'Published', 70, 'Agentic AI Platform to monitor, triage and resolve production incidents
---AIMPLIFY---
Agentic AI Platform for AI Operations in a Multi-Agent setup to monitor, triage and resolve production incidents in a guided autonomy mode', 'Balasubramani.Murugesan@infovision.com', null, 'http://74.249.248.133:8887/', null, '["azure"]'::jsonb, 'experimental', 'None', 'Hosted service', 'GUI based', 'TBD', 'TBD', '[]'::jsonb, '2026-04-15', 'Catalog id RLY-004. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["AIOps","Production Support","Incident monitoring","Incident resolution","Agentic AI for Ops"]
AIMPLIFY_EFFORT:high
AIMPLIFY_STATS_JSON:{"deployments":1,"demos":3,"projects":1,"satisfaction":70}
AIMPLIFY_DEMO_READY:yes
Video file: Yet to created', '2026-05-08', '2026-05-08')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('FRG-004', 'ADLC Unified Framework', 'forge', 'SDLC Automation & Acceleration', 'Engineering Productivity Office', 'Unified AI Enabler Framework for AIDLC', 'AI Enabler Framework in a coding IDE to analyze, design, build, test and audit components for different roles - BA, Front End Dev, Back End Dev, DBA and QA for any application SDLC', 'Priyanka Fulewale', 'PF', 'battle-tested', 'medium', '["aws","gcp","azure"]'::jsonb, '["AI SDLC","AI enabled development","AI framework for SDLC","front end development","back end development","BA Analysis","Reverse Analysis"]'::jsonb, null, null, null, 1, 1, 1, 85, '["TBD"]'::jsonb, '["IDE"]'::jsonb, '["IDE deployment - autosetup"]'::jsonb, '["Application Standards","References and Guides"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('d74ff1d2-504e-56b2-a3df-eb2dcea45d35', 'ADLC Unified Framework', 'forge', 'SDLC Automation & Acceleration', 'Engineering Productivity Office', 'Priyanka Fulewale', 'PF', 'Published', 85, 'Unified AI Enabler Framework for AIDLC
---AIMPLIFY---
AI Enabler Framework in a coding IDE to analyze, design, build, test and audit components for different roles - BA, Front End Dev, Back End Dev, DBA and QA for any application SDLC', 'Priyanka.Fulewale@infovision.com', null, null, null, '["aws","gcp","azure"]'::jsonb, 'battle-tested', 'Application Standards
References and Guides', 'IDE deployment - autosetup', 'IDE', 'TBD', 'TBD', '[]'::jsonb, '2026-03-30', 'Catalog id FRG-004. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["AI SDLC","AI enabled development","AI framework for SDLC","front end development","back end development","BA Analysis","Reverse Analysis"]
AIMPLIFY_EFFORT:medium
AIMPLIFY_STATS_JSON:{"deployments":1,"demos":1,"projects":1,"satisfaction":85}
AIMPLIFY_DEMO_READY:yes
Video file: ADLCUnifiedFramework-Screenshot.png', '2026-05-08', '2026-05-08')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('FRG-005', 'Autonomous SDLC Framework', 'forge', 'SDLC Automation & Acceleration', 'Engineering Productivity Office', 'AI Enabler to perform autonomous AIDLC', 'AI Enabler Framework to do an Autonomous SDLC from ADO entry to feature rollout through complete SDLC', 'Nainik K', 'NK', 'experimental', 'medium', '["aws","gcp","azure"]'::jsonb, '["Autonomous SDLC","AI SDLC","AI enabled development","AI framework for SDLC"]'::jsonb, null, null, null, 0, 0, 2, 0, '["TBD"]'::jsonb, '["IDE"]'::jsonb, '["ADO","Github","IDE deployment (VSCode)"]'::jsonb, '["Application Standards","References and Guides"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('00c68f93-df98-59b1-9a0d-961654c36ae2', 'Autonomous SDLC Framework', 'forge', 'SDLC Automation & Acceleration', 'Engineering Productivity Office', 'Nainik K', 'NK', 'Published', 0, 'AI Enabler to perform autonomous AIDLC
---AIMPLIFY---
AI Enabler Framework to do an Autonomous SDLC from ADO entry to feature rollout through complete SDLC', 'Nainik.K@infovision.com', null, null, null, '["aws","gcp","azure"]'::jsonb, 'experimental', 'Application Standards
References and Guides', 'ADO
Github
IDE deployment (VSCode)', 'IDE', 'TBD', 'TBD', '[]'::jsonb, '2026-04-30', 'Catalog id FRG-005. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["Autonomous SDLC","AI SDLC","AI enabled development","AI framework for SDLC"]
AIMPLIFY_EFFORT:medium
AIMPLIFY_STATS_JSON:{"deployments":0,"demos":2,"projects":0,"satisfaction":0}
AIMPLIFY_DEMO_READY:yes
Video file: AutonomousSDLC.mp4', '2026-05-08', '2026-05-08')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('NXS-004', 'Video Intelligence Platform (VIP)', 'nexus', 'Video processing using LLM and text annotation', 'Multi-Agent Orchestration', 'Non realtime processing of videos and video to text interface for video analysis', 'Using only CPUs to run video based large language models and converting video description to texts efficiently. This approach emphasizes on running video based large language model to run on intel''s cpu only sapphire rapids instance. This enables the vLLM to process the long length videos like cctv videos, instore cameras, inventory cameras etc all on cpus and create text based summaries for easy rundown and anomany detection. This text is then tagged and processed for certain event tracking.', 'Pratyoosh Patel', 'PP', 'experimental', 'high', '["aws","gcp","azure"]'::jsonb, '["AI video processing","tet annotation","text summary","chat interface"]'::jsonb, null, null, null, 0, 1, 0, 70, '["Data Ingestion","Embedding Generation","Vector Database Storage","Retriever Subsystem","Model Server Subsystem","Serving Subsystem/User Interface"]'::jsonb, '["Multi step process including hosting an on-prem server"]'::jsonb, '["Intel Xeon Servers","VMware Virtualization Services","VideoLlama Model","Vector Database","Edge Devices/Cameras","Generative AI Infrastructure"]'::jsonb, '["Intel","VMware","VideoLlama","Vector Database","REST APIs","SDKs","Edge Computing","Cloud/On-Prem Infrastructure"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('bf33075e-f7ef-5040-bd10-21ceb93a69e7', 'Video Intelligence Platform (VIP)', 'nexus', 'Video processing using LLM and text annotation', 'Multi-Agent Orchestration', 'Pratyoosh Patel', 'PP', 'Published', 70, 'Non realtime processing of videos and video to text interface for video analysis
---AIMPLIFY---
Using only CPUs to run video based large language models and converting video description to texts efficiently. This approach emphasizes on running video based large language model to run on intel''s cpu only sapphire rapids instance. This enables the vLLM to process the long length videos like cctv videos, instore cameras, inventory cameras etc all on cpus and create text based summaries for easy rundown and anomany detection. This text is then tagged and processed for certain event tracking.', 'InfoVision in collaboration with Intel and VMware. Credits: Abhiram Kalidindi, Noumika Balaji, Ria Ghosh, Pratyoosh Patel', null, null, null, '["aws","gcp","azure"]'::jsonb, 'experimental', 'Intel
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
Generative AI Infrastructure', 'Multi step process including hosting an on-prem server', 'Data Ingestion --> Embedding Generation --> Vector Database Storage --> Retriever Subsystem --> Model Server Subsystem --> Serving Subsystem/User Interface', 'Data Ingestion --> Embedding Generation --> Vector Database Storage --> Retriever Subsystem --> Model Server Subsystem --> Serving Subsystem/User Interface', '[]'::jsonb, '2024-07-08', 'Catalog id NXS-004. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["AI video processing","tet annotation","text summary","chat interface"]
AIMPLIFY_EFFORT:high
AIMPLIFY_STATS_JSON:{"deployments":1,"demos":0,"projects":0,"satisfaction":70}
AIMPLIFY_DEMO_READY:yes
Video file: VIPDemo.mp4', '2024-10-23', '2024-10-23')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values ('SNT-002', 'Responsible AI Automation', 'sentinel', 'Decisoin automation, Responsible AI', 'AI Run Office', 'Agent based decisoin automation for Responsible AI', 'RAIE is an enterprise-grade Responsible AI governance platform, designed with agentic architecture to transform manual, multi-stakeholder approval workflows into an intelligent, autonomous system. Purpose-built AI agents automatically enrich submissions by gathering data requirements, infrastructure specs, risk assessments, budget availability, and compliance inputs from enterprise systems — eliminating the manual back-and-forth that typically drives approval cycles to 45+ days. A multi-agent orchestration layer routes requests through parallel enrichment and compliance checks, enabling approximately 80% of use cases to be auto-approved against preset policy thresholds while flagging high-risk initiatives for streamlined human-in-the-loop review with pre-populated context. The platform maintains full auditability, explainability, and fail-safe guardrails — ensuring nothing that requires human oversight is ever auto-approved. RAIE reduces total cost of approvals by up to 71% while accelerating AI adoption at enterprise scale.', 'Hasham Ul Haq', 'HH', 'experimental', 'high', '["aws","gcp","azure"]'::jsonb, '["AI Governance","Responsible AI","Enterprise Compliance","Risk Management","Regulatory Compliance"]'::jsonb, null, null, null, 1, 1, 5, 75, '["Discovery","Enrichment","Orchestration","Integration","Shadow Mode","Assisted Review","Scale"]'::jsonb, '["GUI based"]'::jsonb, '["Hosted service"]'::jsonb, '["Knowledge base / policy repository (for agent reasoning)","Enterprise data connectors (Data team systems","infra APIs","budget systems)","Model registry & library (approved algorithms)","HITL review platform / dashboard (for flagged submissions)","Audit logging infrastructure","Stakeholder review notification system","Approval authority access controls / RBAC system","Real-time monitoring & observability stack (agent telemetry)"]'::jsonb, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values ('8d00f0f6-5a8e-581a-b1d7-51f322eae55d', 'Responsible AI Automation', 'sentinel', 'Decisoin automation, Responsible AI', 'AI Run Office', 'Hasham Ul Haq', 'HH', 'Published', 75, 'Agent based decisoin automation for Responsible AI
---AIMPLIFY---
RAIE is an enterprise-grade Responsible AI governance platform, designed with agentic architecture to transform manual, multi-stakeholder approval workflows into an intelligent, autonomous system. Purpose-built AI agents automatically enrich submissions by gathering data requirements, infrastructure specs, risk assessments, budget availability, and compliance inputs from enterprise systems — eliminating the manual back-and-forth that typically drives approval cycles to 45+ days. A multi-agent orchestration layer routes requests through parallel enrichment and compliance checks, enabling approximately 80% of use cases to be auto-approved against preset policy thresholds while flagging high-risk initiatives for streamlined human-in-the-loop review with pre-populated context. The platform maintains full auditability, explainability, and fail-safe guardrails — ensuring nothing that requires human oversight is ever auto-approved. RAIE reduces total cost of approvals by up to 71% while accelerating AI adoption at enterprise scale.', 'Hasham.UlHaq@infovision.com', null, null, null, '["aws","gcp","azure"]'::jsonb, 'experimental', 'Knowledge base / policy repository (for agent reasoning)
Enterprise data connectors (Data team systems
infra APIs
budget systems)
Model registry & library (approved algorithms)
HITL review platform / dashboard (for flagged submissions)
Audit logging infrastructure
Stakeholder review notification system
Approval authority access controls / RBAC system
Real-time monitoring & observability stack (agent telemetry)', 'Hosted service', 'GUI based', 'Discovery --> Enrichment --> Orchestration --> Integration --> Shadow Mode --> Assisted Review --> Scale', 'Discovery --> Enrichment --> Orchestration --> Integration --> Shadow Mode --> Assisted Review --> Scale', '[]'::jsonb, '2025-04-01', 'Catalog id SNT-002. AIMPLIFY Excel import 2026-05-12.
AIMPLIFY_TAGS_JSON:["AI Governance","Responsible AI","Enterprise Compliance","Risk Management","Regulatory Compliance"]
AIMPLIFY_EFFORT:high
AIMPLIFY_STATS_JSON:{"deployments":1,"demos":5,"projects":1,"satisfaction":75}
AIMPLIFY_DEMO_READY:yes
Video file: ResponsibleAIAgentic.mp4', '2026-05-08', '2026-05-08')
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;


-- Verification: compare sheet ids to DB
-- select id, name, family_id, left(description, 80) from submissions where gov_notes ilike '%AIMPLIFY Excel import%' order by asset_name;
