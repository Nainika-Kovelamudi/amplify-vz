-- ================================================================
-- AIMPLIFY Tags → Supabase: Complete Field Mapping Verification Fix
-- Source of truth: AIMPLIFY Tags(Sheet1).csv
--
-- What this fixes
-- ───────────────
-- 1. PUBLISH all 18 submissions (status='Manual Approval' → 'Published')
--    → Nothing appears in the catalog until status='Published'
-- 2. FIX architectures to newline-separated steps
--    → detailToList() in catalog.ts splits by \n or comma;
--      "Step A --> Step B" was rendering as a single architecture box
-- 3. FIX prerequisites/dependencies swap for ATL-001 and ATL-002
--    → CSV col 23 = Prerequisites, col 24 = Dependencies — were merged
-- 4. FIX NXS-001 prerequisites truncated from 7 items to 5
-- 5. UPDATE descriptions to full CSV long descriptions (col 8)
--    → Both the card excerpt and detail-page About section use this field
-- 6. UPDATE assets table: tags + architecture + about for all assets
--    → Assets table not used by catalog but kept in sync
--
-- Known schema gap (not fixable via SQL alone)
-- ─────────────────────────────────────────────
-- • CSV "Asset Tags" (col 13) → no tags column in submissions table;
--   catalog derives tags from category + solution + clouds only.
-- • effort → hardcoded to 'medium' in catalog.ts submissionToAsset();
--   the DB value has no effect on the UI.
-- • stats.deployments / stats.projects → hardcoded to 1 / 0 in catalog.ts.
--
-- Run in Supabase SQL Editor.
-- ================================================================


-- ----------------------------------------------------------------
-- 1.  PUBLISH ALL ASSETS
-- ----------------------------------------------------------------
UPDATE submissions
SET
  status       = 'Published',
  gov_reviewer = 'AIMPLIFY Registry Import',
  approved_at  = '2026-05-12',
  published_at = '2026-05-12'
WHERE id IN (
  '6c5bb5f8-439c-50bb-8be6-ae4ea92a5668',  -- ATL-001  DataSmith - Tableau to Looker Migration
  '0012d719-db4b-5c48-9cb2-2a8ac83758a9',  -- ATL-002  DataSmith - Synthetic Data Generator
  '229d5470-2db0-531b-9eb6-c24834b7633c',  -- ATL-003  Data Policy Anomaly Bot
  '887a2989-ea08-50a1-8270-6e3aacf7ad39',  -- FRG-001  Sprinter
  '537c3167-7cde-5dbe-85f0-8524e2b0bf96',  -- FRG-002  Code Migration Frameworks
  'e1811f0f-d338-5d5b-8a89-4b9ad4268c03',  -- FRG-003  AI Code Reviewer
  'd74ff1d2-504e-56b2-a3df-eb2dcea45d35',  -- FRG-004  ADLC Unified Framework
  '00c68f93-df98-59b1-9a0d-961654c36ae2',  -- FRG-005  Autonomous SDLC Framework
  'f0727cda-d8b0-515c-a481-78296257d3b5',  -- RLY-001  Multiagent Call Center Automation
  'a05be217-efce-5b2a-acb3-78211cf240af',  -- RLY-002  Healthcare Bot
  '5bab82c6-927e-5e37-a779-b53da072a2bd',  -- RLY-003  Contextual Intelligence – Speech Diarization
  '475b6748-b54f-50bb-8c05-a3003576ad57',  -- RLY-004  AIOps
  '8476e331-2337-5b6f-92ff-2e5c49c475d1',  -- SNT-001  Sentiment Analysis on Call Recordings
  '8d00f0f6-5a8e-581a-b1d7-51f322eae55d',  -- SNT-002  Responsible AI Automation
  '2a7ec926-7f7a-561c-9932-e02286224259',  -- NXS-001  SLM vs LLM Decision Playbook
  '13f9744a-f272-5864-86cc-f2238e56c069',  -- NXS-002  PromptEval
  'a8dd5762-0cda-594a-9e2f-8a1119ac19f8',  -- NXS-003  LIE – LLM Insight Engine
  'bf33075e-f7ef-5040-bd10-21ceb93a69e7'   -- NXS-004  Video Intelligence Platform (VIP)
);


-- ----------------------------------------------------------------
-- 2.  FIX ARCHITECTURES — newline-separated steps
--     catalog.ts detailToList() splits by \n or comma, so each step
--     needs to be on its own line to render as individual flow nodes.
-- ----------------------------------------------------------------

-- ATL-003
UPDATE submissions SET architectures =
  'Natural Language Query'                             || E'\n' ||
  'Policy Document Retrieval (Vector Embeddings / FAISS)' || E'\n' ||
  'Query Structuring (GPT-4)'                          || E'\n' ||
  'BigQuery Validation (Schema + Data Level)'          || E'\n' ||
  'Anomaly Detection'                                  || E'\n' ||
  'Risk Severity Classification'                       || E'\n' ||
  'Actionable Summary Output'
WHERE id = '229d5470-2db0-531b-9eb6-c24834b7633c';

-- FRG-001 Sprinter
UPDATE submissions SET architectures =
  'User Story Input'                       || E'\n' ||
  'LLM Prompt Construction'                || E'\n' ||
  'GPT-3.5-turbo'                          || E'\n' ||
  'Task / Code / Test Case Generation'     || E'\n' ||
  'Kanban Board Display'                   || E'\n' ||
  'Release Notes / Reports'
WHERE id = '887a2989-ea08-50a1-8270-6e3aacf7ad39';

-- FRG-002 Code Migration Frameworks
UPDATE submissions SET architectures =
  'Source Code Ingestion'                            || E'\n' ||
  'Context Discovery (File Structure Analysis)'      || E'\n' ||
  'AI-Assisted Conversion (Copilot / Gemini)'        || E'\n' ||
  'Output Generation (Java / Node.js)'               || E'\n' ||
  'Test Case Generation'                             || E'\n' ||
  'QA Validation'
WHERE id = '537c3167-7cde-5dbe-85f0-8524e2b0bf96';

-- FRG-003 AI Code Reviewer
UPDATE submissions SET architectures =
  'PR / MR Submitted'                    || E'\n' ||
  'Webhook Trigger (GitLab)'             || E'\n' ||
  'Code Ingestion'                       || E'\n' ||
  'GPT-4 Line-by-Line Analysis'          || E'\n' ||
  'Best Practice Scoring'                || E'\n' ||
  'Slack Notification (Senior Dev)'      || E'\n' ||
  'Developer Iterates'
WHERE id = 'e1811f0f-d338-5d5b-8a89-4b9ad4268c03';

-- RLY-001 Multiagent Call Center Automation
UPDATE submissions SET architectures =
  'Incoming Call / Trigger'              || E'\n' ||
  'Sentiment Analysis Agent'             || E'\n' ||
  'Customer Profile Agent'               || E'\n' ||
  'Call Avoidance Agent'                 || E'\n' ||
  'Ticket Management Agent (JIRA)'       || E'\n' ||
  'Recommendation Agent'                 || E'\n' ||
  'Resolution Agent'                     || E'\n' ||
  'Post-Call Summary'
WHERE id = 'f0727cda-d8b0-515c-a481-78296257d3b5';

-- RLY-002 Healthcare Bot
UPDATE submissions SET architectures =
  'User Query (Patient / Staff Portal)'     || E'\n' ||
  'Persona Selection'                       || E'\n' ||
  'Document Retrieval (Chroma Vector Store)' || E'\n' ||
  'Redis Cache Check'                       || E'\n' ||
  'Gemini 1.5 Flash LLM'                    || E'\n' ||
  'Role-Tailored Response'                  || E'\n' ||
  'Feedback Logging'
WHERE id = 'a05be217-efce-5b2a-acb3-78211cf240af';

-- RLY-003 Speech Diarization
UPDATE submissions SET architectures =
  'Live Audio Input'                                         || E'\n' ||
  'Speech-to-Text (Gemini Flash)'                            || E'\n' ||
  'Speaker Attribution (Diarization)'                        || E'\n' ||
  'Insight Extraction & Categorization'                      || E'\n' ||
  'Dynamic Product Retrieval (Selenium / Web Scraping)'      || E'\n' ||
  'Redis Cache'                                              || E'\n' ||
  'Interactive UI Display (iPad)'                            || E'\n' ||
  'Cart Integration'
WHERE id = '5bab82c6-927e-5e37-a779-b53da072a2bd';

-- SNT-001 Sentiment Analysis on Call Recordings
UPDATE submissions SET architectures =
  'Audio Input (Call Recording)'                             || E'\n' ||
  'Gemini 1.5 Pro Direct Audio Analysis'                     || E'\n' ||
  'Sentiment Scoring (Tone Intensity / Sarcasm / Emotion)'   || E'\n' ||
  'Compliance Keyword Detection'                             || E'\n' ||
  'Risk Flagging'                                            || E'\n' ||
  'Customizable Report Generation'
WHERE id = '8476e331-2337-5b6f-92ff-2e5c49c475d1';

-- SNT-002 Responsible AI Automation
UPDATE submissions SET architectures =
  'Discovery'       || E'\n' ||
  'Enrichment'      || E'\n' ||
  'Orchestration'   || E'\n' ||
  'Integration'     || E'\n' ||
  'Shadow Mode'     || E'\n' ||
  'Assisted Review' || E'\n' ||
  'Scale'
WHERE id = '8d00f0f6-5a8e-581a-b1d7-51f322eae55d';

-- NXS-001 SLM vs LLM Decision Playbook
UPDATE submissions SET architectures =
  'User assessment form'                          || E'\n' ||
  'Decision engine (gatekeepers + weighted score)' || E'\n' ||
  'Recommendation result'                          || E'\n' ||
  'Gemini narrative'                               || E'\n' ||
  'Persist submissions (optional Supabase)'
WHERE id = '2a7ec926-7f7a-561c-9932-e02286224259';

-- NXS-002 PromptEval
UPDATE submissions SET architectures =
  'Prompt Variants Input'                             || E'\n' ||
  'Dataset Selection'                                 || E'\n' ||
  'Multi-Model Execution'                             || E'\n' ||
  'Response Scoring (Accuracy / Relevance / Tone)'    || E'\n' ||
  'Side-by-Side Comparison'                           || E'\n' ||
  'Regression Detection'                              || E'\n' ||
  'Evaluation Report Export'
WHERE id = '13f9744a-f272-5864-86cc-f2238e56c069';

-- NXS-003 LIE – LLM Insight Engine
UPDATE submissions SET architectures =
  'Document Upload'                           || E'\n' ||
  'Model & Embedding Selection'               || E'\n' ||
  'Viable Combination Computation'            || E'\n' ||
  'Concurrent Query Execution (GPU/CUDA)'     || E'\n' ||
  'Response + Latency Capture'                || E'\n' ||
  'Side-by-Side Display'                      || E'\n' ||
  'Excel Export / Email'
WHERE id = 'a8dd5762-0cda-594a-9e2f-8a1119ac19f8';

-- NXS-004 Video Intelligence Platform (VIP)
UPDATE submissions SET architectures =
  'Data Ingestion'                   || E'\n' ||
  'Embedding Generation'             || E'\n' ||
  'Vector Database Storage'          || E'\n' ||
  'Retriever Subsystem'              || E'\n' ||
  'Model Server Subsystem'           || E'\n' ||
  'Serving Subsystem/User Interface'
WHERE id = 'bf33075e-f7ef-5040-bd10-21ceb93a69e7';


-- ----------------------------------------------------------------
-- 3.  FIX PREREQUISITES / DEPENDENCIES
--     CSV col 23 = Prerequisites List, col 24 = Dependencies List.
--     ATL-001 and ATL-002 had both fields merged into prerequisites.
-- ----------------------------------------------------------------

-- ATL-001: prerequisites = "Hosted service"  |  dependencies = "Need Tableau as .twbx files"
UPDATE submissions SET
  prerequisites = 'Hosted service',
  dependencies  = 'Need Tableau as .twbx files'
WHERE id = '6c5bb5f8-439c-50bb-8be6-ae4ea92a5668';

-- ATL-002: prerequisites = "Hosted service"  |  dependencies = "None"
UPDATE submissions SET
  prerequisites = 'Hosted service',
  dependencies  = 'None'
WHERE id = '0012d719-db4b-5c48-9cb2-2a8ac83758a9';

-- NXS-001: prerequisites were shortened to 5 items; restore all 7 from CSV col 23
UPDATE submissions SET
  prerequisites =
    'React and React DOM'            || E'\n' ||
    'TypeScript and type definitions' || E'\n' ||
    'Vite and plugins'               || E'\n' ||
    'Tailwind CSS and PostCSS'       || E'\n' ||
    'Google Generative AI SDK'       || E'\n' ||
    'Supabase client'                || E'\n' ||
    'Lucide icons'
WHERE id = '2a7ec926-7f7a-561c-9932-e02286224259';


-- ----------------------------------------------------------------
-- 4.  UPDATE DESCRIPTIONS — full CSV long descriptions (col 8)
--     submissions.description drives BOTH the catalog card excerpt
--     (3-line clamp) and the asset detail About section (full text).
-- ----------------------------------------------------------------

-- ATL-001
UPDATE submissions SET description =
$$Discovery — Lineage analysis, schema analysis, cluster analysis.

DataSmith accelerates Tableau-to-Looker migration using agentic discovery and automated validation workflows. Hosted on Azure, cloud agnostic.$$
WHERE id = '6c5bb5f8-439c-50bb-8be6-ae4ea92a5668';

-- ATL-002
UPDATE submissions SET description =
$$Generates tens to millions of rows of synthetic data statistically modeled on a given input dataset.

A hosted DataSmith capability for safe data sharing and testing without exposing production rows. Validated maturity; no cloud prerequisites required.$$
WHERE id = '0012d719-db4b-5c48-9cb2-2a8ac83758a9';

-- ATL-003
UPDATE submissions SET description =
$$The Data Policy Anomaly Bot is an AI-powered compliance accelerator that enables non-technical users to query organizational policies in plain English and validate them against live datasets in real time. Built on Azure GPT-4 + LangChain + BigQuery, the bot retrieves relevant policy documents via vector embeddings, generates structured validation queries, and runs them against live data to detect schema-level and data-level violations.

Anomaly detection results are classified by risk severity and surfaced as clear, actionable bullet-point summaries — no SQL expertise required. The system is designed for compliance teams operating under GDPR, CCPA, or internal data governance frameworks who need to dramatically reduce manual review cycles.

Key challenges solved: manual compliance checks against large datasets are error-prone and IT-dependent. This bot eliminates the bottleneck by automating policy retrieval, validation, and risk classification end-to-end, reducing dependency on technical teams and lowering non-compliance exposure.

Known limitations: token limits can constrain validation on very large BigQuery datasets; complex edge-case queries may need refinement. Processing time for large dataset validation averages 5–10 minutes per query.

Team: Abhiram, Veerasekar, Renju | Owner: Veera$$
WHERE id = '229d5470-2db0-531b-9eb6-c24834b7633c';

-- FRG-001 Sprinter
UPDATE submissions SET description =
$$Sprinter is a web application integrated with GPT-3.5-turbo that streamlines the entire software development lifecycle. It automates repetitive SDLC tasks including user story expansion with personas, goals and acceptance criteria, task and subtask generation, code snippet generation across multiple languages, test case creation, test code generation, release notes compilation, and weekly/monthly status reports.

The interface mirrors a JIRA-style Kanban board with four columns: To-Do, In Progress, QA, and Done — each unlocking relevant AI-powered actions at that stage. Project Managers, Developers, and QA Engineers each benefit from role-specific automation that reduces manual effort, improves consistency, and accelerates delivery timelines.

Key challenges solved: manual test case/story creation is error-prone and slow; no tooling existed to leverage historical data for risk prediction and story point estimation. Sprinter addresses both by combining LLM intelligence with structured project context.$$
WHERE id = '887a2989-ea08-50a1-8270-6e3aacf7ad39';

-- FRG-002 Code Migration Frameworks
UPDATE submissions SET description =
$$Code Migration Frameworks is a multi-language modernization accelerator that uses GitHub Copilot and Gemini code assist plugins to convert legacy codebases to modern tech stacks. Currently proven for COBOL + C (with Python Flask API) to Java Springboot, and .NET C# to Node.js migrations.

The solution analyzes the source project's full file structure and codebase context, then assists developers through automated code conversion while answering real-time contextual queries. Additional capabilities include logging, test case generation, and SQL injection anomaly detection baked into the converted output.

Key challenges solved: manual code migration from legacy systems takes months, creates bottlenecks, and requires senior developer expertise for navigation. This accelerator reduces conversion time dramatically while keeping developers in the loop through a conversational AI interface.$$
WHERE id = '537c3167-7cde-5dbe-85f0-8524e2b0bf96';

-- FRG-003 AI Code Reviewer
UPDATE submissions SET description =
$$The ADLC Unified Framework (Senior Dev GPT) is a webhook-driven SDLC optimization bot that automates code review on every pull or merge request. When a developer submits a PR in GitLab, the bot is triggered automatically via webhook, receives the committed code, and acts as a senior developer performing detailed line-by-line analysis.

Feedback is delivered through a Slack app called Senior Dev in a conversational format, providing best practice recommendations, security vulnerability detection, and performance optimization suggestions in real time. The entire loop — from PR submission to feedback delivery — completes in minutes rather than hours.

Key challenges solved: lead developer bandwidth is the primary bottleneck in high-velocity agile teams. Code reviews get rushed or skipped entirely, introducing bugs and technical debt. This accelerator removes the human bottleneck by providing always-on, consistent, high-quality automated review.

Integrates with: GitLab, GitHub, Bitbucket (via webhooks), Slack (notifications), GitLab CI/CD pipeline.$$
WHERE id = 'e1811f0f-d338-5d5b-8a89-4b9ad4268c03';

-- FRG-004 ADLC Unified Framework
UPDATE submissions SET description =
$$AI Enabler Framework in a coding IDE to analyze, design, build, test and audit components for different roles — BA, Front End Dev, Back End Dev, DBA and QA — for any application SDLC.$$
WHERE id = 'd74ff1d2-504e-56b2-a3df-eb2dcea45d35';

-- FRG-005 Autonomous SDLC Framework
UPDATE submissions SET description =
$$AI Enabler Framework to do an Autonomous SDLC from ADO entry to feature rollout through complete SDLC.$$
WHERE id = '00c68f93-df98-59b1-9a0d-961654c36ae2';

-- RLY-001 Multiagent Call Center Automation
UPDATE submissions SET description =
$$The Multiagent Call Center Automation System is an AI-driven solution built on a LangGraph-based multi-agent framework that optimizes call center operations through specialized autonomous agents. Six agents work in concert: Sentiment Analysis (real-time tone detection), Customer Profile Update (CRM sync), Call Avoidance (proactive deflection), Support Ticket Management (JIRA integration), Recommendation (personalized suggestions), and Resolution (case closure).

Agents integrate seamlessly with PostgreSQL for data management, JIRA for ticket lifecycle, and email platforms for outbound communication. The LangGraph framework enables agents to operate both autonomously and collaboratively via a shared state memory object — allowing contextual handoffs between agents without data loss.

Key challenges solved: traditional call center workflows are siloed, requiring manual handoffs between systems. This system distributes responsibility across specialized agents, eliminating handoff delays, reducing average handle time, and improving first-call resolution rates. Latency is managed through careful agent architecture and state design.

Owner: Gokulram | Repo: https://github.com/by-Gokulram/multiagent_callcenter_automation.git$$
WHERE id = 'f0727cda-d8b0-515c-a481-78296257d3b5';

-- RLY-002 Healthcare Bot
UPDATE submissions SET description =
$$The Healthcare Bot is a dual-persona RAG-powered conversational agent designed for hospital environments. It serves two distinct user groups — Patients and Staff — each with a dedicated portal pathway and persona-customized responses drawn from role-specific data sources.

For patients, the bot handles medical history queries, appointment details, medication reminders, and general health inquiries. For staff, it provides instant access to HR policies, leave balances, compliance documentation, and operational guidelines. Semantic search powered by Chroma vector store and Redis caching (40% response time reduction) ensures fast, accurate retrieval even from large document corpora.

Key challenges solved: employees and patients both face friction accessing the right information from the right source. The Healthcare Bot eliminates this by embedding organizational knowledge directly into a conversational interface, with 85% query accuracy documented on complex semantic queries.

Cross-industry note: the dual-persona architecture is domain-agnostic — the same pattern applies to Finance (advisor + client), Retail (staff + customer), or any organization with two distinct user classes accessing different knowledge bases.$$
WHERE id = 'a05be217-efce-5b2a-acb3-78211cf240af';

-- RLY-003 Speech Diarization
UPDATE submissions SET description =
$$The Contextual Intelligence Speech Diarization System is a real-time conversational intelligence accelerator built for high-engagement customer interactions (retail, telecom). It listens to live audio between a CSR and customer, converts speech to text, attributes each utterance to the correct speaker (90% accuracy with clean audio), and extracts structured insights categorized by products, plans, and information requests — all with timestamps.

Simultaneously, the system performs dynamic web scraping via Selenium and LangChain to fetch real-time product availability, pricing, color options, and trade-in values from external sources. Results are cached in Redis (40% latency improvement) and surfaced on an interactive iPad interface showing insight bubbles and a cart integration for seamless purchase completion.

Key challenges solved: sales reps lose conversational flow while manually looking up product details, directly impacting conversion rates. This accelerator keeps reps present in the conversation while the AI handles real-time lookup, structuring, and recommendations in the background.

Classification: Accelerator (100% reusable) | Owner: Veera | Team: Veerasekhar, Abhiram, Blesson, Padma Priya, Satish, Rahul$$
WHERE id = '5bab82c6-927e-5e37-a779-b53da072a2bd';

-- RLY-004 AIOps
UPDATE submissions SET description =
$$Agentic AI Platform for AI Operations in a Multi-Agent setup to monitor, triage and resolve production incidents in a guided autonomy mode.$$
WHERE id = '475b6748-b54f-50bb-8c05-a3003576ad57';

-- SNT-001 Sentiment Analysis on Call Recordings
UPDATE submissions SET description =
$$The Sentiment Analysis on Call Recordings system uses Google Gemini 1.5 Pro's native multimodal audio processing to analyze customer service calls end-to-end without requiring a separate transcription step. Gemini directly evaluates both audio content and vocal tone to assess sentiment intensity, tone sarcasm, and linguistic compliance markers — matching the latency and accuracy of text-based analysis.

The system flags calls for compliance violations based on predefined regulatory keywords and thresholds, and generates customizable reports highlighting sentiment trends, risk areas, and agent performance metrics. This positions it as both a real-time QA layer and a post-call analytics engine for call center operations.

Key challenges solved: traditional sentiment analysis pipelines require transcription as a prerequisite, adding cost, latency, and accuracy loss (especially for accented speech or noisy environments). Gemini's direct audio processing eliminates this stage entirely, delivering faster, more nuanced results.

Validated on Verizon call center data. Owner: Gokulram | Repo: https://github.com/by-Gokulram/tone_sentiment_analysis.git$$
WHERE id = '8476e331-2337-5b6f-92ff-2e5c49c475d1';

-- SNT-002 Responsible AI Automation
UPDATE submissions SET description =
$$RAIE is an enterprise-grade Responsible AI governance platform, designed with agentic architecture to transform manual, multi-stakeholder approval workflows into an intelligent, autonomous system. Purpose-built AI agents automatically enrich submissions by gathering data requirements, infrastructure specs, risk assessments, budget availability, and compliance inputs from enterprise systems — eliminating the manual back-and-forth that typically drives approval cycles to 45+ days.

A multi-agent orchestration layer routes requests through parallel enrichment and compliance checks, enabling approximately 80% of use cases to be auto-approved against preset policy thresholds while flagging high-risk initiatives for streamlined human-in-the-loop review with pre-populated context. The platform maintains full auditability, explainability, and fail-safe guardrails — ensuring nothing that requires human oversight is ever auto-approved. RAIE reduces total cost of approvals by up to 71% while accelerating AI adoption at enterprise scale.$$
WHERE id = '8d00f0f6-5a8e-581a-b1d7-51f322eae55d';

-- NXS-001 SLM vs LLM Decision Playbook
UPDATE submissions SET description =
$$The SLM vs LLM Decision Playbook is a cost-analysis and benchmarking tool that helps engineering teams make informed model selection decisions before committing to a tech stack. Built with LangChain, LlamaIndex, and Tiktoken, the tool lets users select from multiple LLMs (GPT-3.5-turbo, GPT-3.5-turbo-16k, text-davinci-002/003) and embedding models (text-embedding-ada-002), run queries against a shared dataset, and compare cost per 1K tokens, input/output/embedding token counts, and total query cost side by side.

Outputs include bar chart visualizations of cost breakdowns per model combination and a word cloud of the most semantically relevant terms in the retrieved data. The tool embeds the data source once at initialization and reuses those vectors across all queries, eliminating redundant embedding costs.

Key value for Nexus: every platform family (Forge, Relay, Sentinel, Atlas) faces the same model selection question at project kickoff. This playbook gives teams a structured, data-driven answer rather than a gut-feel choice — directly reducing LLM spend on production deployments.

Owner: Noumika | Contributors: Pravallika Hazarath, Noumika Balaji$$
WHERE id = '2a7ec926-7f7a-561c-9932-e02286224259';

-- NXS-002 PromptEval
UPDATE submissions SET description =
$$PromptEval is a cross-platform prompt quality evaluation framework that provides a structured methodology for testing, scoring, and iterating on prompts before they are deployed in production accelerators. As a Nexus shared utility, it serves all platform families — Forge engineers validating code review prompts, Relay teams testing conversational agent personas, Sentinel teams assessing compliance query accuracy, and Atlas teams evaluating data insight prompts.

Core capabilities include: multi-prompt variant testing against the same input dataset, response scoring across dimensions (accuracy, relevance, completeness, tone adherence), side-by-side comparison of prompt outputs, regression detection when prompts are modified, and exportable evaluation reports.

Key value for Nexus: prompt quality is the single most variable factor in LLM output quality across all accelerators. Without a shared evaluation layer, every team re-invents ad hoc testing. PromptEval standardizes this into a reusable workflow that can be plugged into any accelerator's development cycle.$$
WHERE id = '13f9744a-f272-5864-86cc-f2238e56c069';

-- NXS-003 LIE – LLM Insight Engine
UPDATE submissions SET description =
$$The LLM Insight Engine (LIE) is a single unified platform that enables development teams to benchmark any combination of LLMs and embedding models against the same training document and query set — delivering fair, reproducible, apples-to-apples comparisons.

Users upload a source document, select from an extensive list of LLMs (GPT-3.5/4/4-32k, PaLM 2, Stable LM 3B, Mistral 7B, Llama, Claude, Cohere, Falcon 40B and more) and embedding models (text-embedding-ada-002, MiniLM-L6-v2, gte-large, GooglePalmEmbeddings), and the engine computes all viable LLM-embedding combinations. Queries are executed concurrently across all combinations with response times tracked. Results are displayed side by side on screen and exportable as Excel or via email.

Key technical achievement: moving model execution from CPU to GPU layers (CUDA) reduced concurrent execution times significantly. Parameters are held constant across all runs (Temperature=0.2, Similarity Top K=2, Chunk Size=1000, Chunk Overlap=10) ensuring benchmarking integrity.

Classification: Accelerator (100%) | Owner: Noumika | Contributors: Abhiram, Pravallika, Veerashekar, Blesson, Hebin$$
WHERE id = 'a8dd5762-0cda-594a-9e2f-8a1119ac19f8';

-- NXS-004 Video Intelligence Platform (VIP)
UPDATE submissions SET description =
$$Using only CPUs to run video-based large language models and converting video description to texts efficiently. This approach emphasizes running VideoLlama on Intel's CPU-only Sapphire Rapids instance — enabling the vLLM to process long-length videos like CCTV, in-store, and inventory camera footage entirely on CPUs and create text-based summaries for easy rundown and anomaly detection. This text is then tagged and processed for certain event tracking.

InfoVision in collaboration with Intel and VMware. Credits: Abhiram Kalidindi, Noumika Balaji, Ria Ghosh, Pratyoosh Patel$$
WHERE id = 'bf33075e-f7ef-5040-bd10-21ceb93a69e7';


-- ================================================================
-- 5.  UPDATE ASSETS TABLE — tags + architecture + about
--     The assets table is not queried by the catalog frontend but is
--     kept in sync for admin / API consumers.
-- ================================================================

-- ATL-001
UPDATE assets SET
  prerequisites = '["Hosted service"]'::jsonb,
  dependencies  = '["Need Tableau as .twbx files"]'::jsonb,
  about = 'Discovery — Lineage analysis, schema analysis, cluster analysis. DataSmith accelerates Tableau-to-Looker migration with agentic discovery and validation workflows. Hosted on Azure, cloud agnostic.'
WHERE id = 'ATL-001';

-- ATL-002
UPDATE assets SET
  prerequisites = '["Hosted service"]'::jsonb,
  dependencies  = '["None"]'::jsonb,
  clouds        = '[]'::jsonb
WHERE id = 'ATL-002';

-- ATL-003
UPDATE assets SET
  tags = '["Compliance","Policy Governance","Anomaly Detection","BigQuery","GDPR","CCPA","LangChain","GPT-4","Vector Embeddings","Risk Classification"]'::jsonb,
  architecture = '["Natural Language Query","Policy Document Retrieval (Vector Embeddings / FAISS)","Query Structuring (GPT-4)","BigQuery Validation (Schema + Data Level)","Anomaly Detection","Risk Severity Classification","Actionable Summary Output"]'::jsonb,
  about = 'The Data Policy Anomaly Bot is an AI-powered compliance accelerator that enables non-technical users to query organizational policies in plain English and validate them against live datasets in real time. Built on Azure GPT-4 + LangChain + BigQuery. Anomaly detection results are classified by risk severity and surfaced as clear, actionable bullet-point summaries. Team: Abhiram, Veerasekar, Renju | Owner: Veera'
WHERE id = 'ATL-003';

-- FRG-001 Sprinter
UPDATE assets SET
  tags = '["SDLC","Agile","User Stories","Test Cases","Code Generation","Kanban","Release Notes","GPT","JIRA"]'::jsonb,
  architecture = '["User Story Input","LLM Prompt Construction","GPT-3.5-turbo","Task / Code / Test Case Generation","Kanban Board Display","Release Notes / Reports"]'::jsonb
WHERE id = 'FRG-001';

-- FRG-002 Code Migration Frameworks
UPDATE assets SET
  tags = '["COBOL","Java","Springboot","Code Migration","Legacy Modernization",".NET","Node.js","GitHub Copilot","Gemini"]'::jsonb
WHERE id = 'FRG-002';

-- FRG-003 AI Code Reviewer
UPDATE assets SET
  tags = '["Code Review","Webhook","GitLab","Slack","CI/CD","GPT-4","SDLC","Automated Review","Pull Request"]'::jsonb,
  architecture = '["PR / MR Submitted","Webhook Trigger (GitLab)","Code Ingestion","GPT-4 Line-by-Line Analysis","Best Practice Scoring","Slack Notification (Senior Dev)","Developer Iterates"]'::jsonb
WHERE id = 'FRG-003';

-- FRG-004 ADLC Unified Framework
UPDATE assets SET
  tags = '["AI SDLC","AI enabled development","AI framework for SDLC","front end development","back end development","BA Analysis","Reverse Analysis"]'::jsonb,
  clouds = '[]'::jsonb
WHERE id = 'FRG-004';

-- FRG-005 Autonomous SDLC Framework
UPDATE assets SET
  tags = '["Autonomous SDLC","AI SDLC","AI enabled development","AI framework for SDLC"]'::jsonb,
  clouds = '[]'::jsonb
WHERE id = 'FRG-005';

-- RLY-001 Multiagent Call Center Automation
UPDATE assets SET
  tags = '["Multi-Agent","LangGraph","Call Center","Sentiment Analysis","JIRA","Automation","Agentic AI","Orchestration","Gemini"]'::jsonb,
  architecture = '["Incoming Call / Trigger","Sentiment Analysis Agent","Customer Profile Agent","Call Avoidance Agent","Ticket Management Agent (JIRA)","Recommendation Agent","Resolution Agent","Post-Call Summary"]'::jsonb
WHERE id = 'RLY-001';

-- RLY-002 Healthcare Bot
UPDATE assets SET
  tags = '["RAG","Healthcare","Dual Persona","Chroma","Redis","Embeddings","Knowledge Retrieval","Gemini","FastAPI"]'::jsonb,
  architecture = '["User Query (Patient / Staff Portal)","Persona Selection","Document Retrieval (Chroma Vector Store)","Redis Cache Check","Gemini 1.5 Flash LLM","Role-Tailored Response","Feedback Logging"]'::jsonb
WHERE id = 'RLY-002';

-- RLY-003 Speech Diarization
UPDATE assets SET
  tags = '["Speech Diarization","Real-Time","Conversational AI","Web Scraping","Redis","LangChain","Gemini","Speaker Attribution","Cart Integration"]'::jsonb,
  architecture = '["Live Audio Input","Speech-to-Text (Gemini Flash)","Speaker Attribution (Diarization)","Insight Extraction & Categorization","Dynamic Product Retrieval (Selenium / Web Scraping)","Redis Cache","Interactive UI Display (iPad)","Cart Integration"]'::jsonb
WHERE id = 'RLY-003';

-- RLY-004 AIOps
UPDATE assets SET
  tags = '["AIOps","Production Support","Incident monitoring","Incident resolution","Agentic AI for Ops"]'::jsonb
WHERE id = 'RLY-004';

-- SNT-001 Sentiment Analysis on Call Recordings
UPDATE assets SET
  tags = '["Sentiment Analysis","Call Recordings","Compliance","Tone Detection","Gemini","Multimodal","Audio Processing","Call Center","QA Monitoring"]'::jsonb,
  architecture = '["Audio Input (Call Recording)","Gemini 1.5 Pro Direct Audio Analysis","Sentiment Scoring (Tone Intensity / Sarcasm / Emotion)","Compliance Keyword Detection","Risk Flagging","Customizable Report Generation"]'::jsonb
WHERE id = 'SNT-001';

-- SNT-002 Responsible AI Automation
UPDATE assets SET
  tags = '["AI Governance","Responsible AI","Enterprise Compliance","Risk Management","Regulatory Compliance"]'::jsonb,
  architecture = '["Discovery","Enrichment","Orchestration","Integration","Shadow Mode","Assisted Review","Scale"]'::jsonb
WHERE id = 'SNT-002';

-- NXS-001 SLM vs LLM Decision Playbook
UPDATE assets SET
  tags = '["LLM Benchmarking","Cost Analysis","Token Cost","Model Selection","SLM","Embeddings","LangChain","LlamaIndex","GPT"]'::jsonb,
  prerequisites = '["React and React DOM","TypeScript and type definitions","Vite and plugins","Tailwind CSS and PostCSS","Google Generative AI SDK","Supabase client","Lucide icons"]'::jsonb,
  architecture = '["User assessment form","Decision engine (gatekeepers + weighted score)","Recommendation result","Gemini narrative","Persist submissions (optional Supabase)"]'::jsonb
WHERE id = 'NXS-001';

-- NXS-002 PromptEval
UPDATE assets SET
  tags = '["Prompt Engineering","Evaluation","Benchmarking","Quality","LLM Testing","Regression","Prompt Management"]'::jsonb,
  architecture = '["Prompt Variants Input","Dataset Selection","Multi-Model Execution","Response Scoring (Accuracy / Relevance / Tone)","Side-by-Side Comparison","Regression Detection","Evaluation Report Export"]'::jsonb
WHERE id = 'NXS-002';

-- NXS-003 LIE – LLM Insight Engine
UPDATE assets SET
  tags = '["LLM Benchmarking","Multi-LLM","GPT","Mistral","Llama","Gemini","Embeddings","Model Comparison","FAISS","LangChain","LlamaIndex"]'::jsonb,
  architecture = '["Document Upload","Model & Embedding Selection","Viable Combination Computation","Concurrent Query Execution (GPU/CUDA)","Response + Latency Capture","Side-by-Side Display","Excel Export / Email"]'::jsonb
WHERE id = 'NXS-003';

-- NXS-004 Video Intelligence Platform (VIP)
UPDATE assets SET
  tags = '["AI video processing","tet annotation","text summary","chat interface"]'::jsonb,
  architecture = '["Data Ingestion","Embedding Generation","Vector Database Storage","Retriever Subsystem","Model Server Subsystem","Serving Subsystem/User Interface"]'::jsonb,
  clouds = '[]'::jsonb
WHERE id = 'NXS-004';
