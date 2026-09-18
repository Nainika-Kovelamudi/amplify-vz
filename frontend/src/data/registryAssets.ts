/**
 * Canonical accelerator catalog — synced from AIMPLIFY asset registry (AIMPLIFY Tags CSV).
 * Fields map to catalog cards, family pages, and asset detail views.
 */

const C = ["blue", "purple", "orange", "green"] as const;

function normalizeArchColor(token: string, index: number): string {
  const t = token.replace(/and repeat/gi, "").trim().toLowerCase();
  if (!t) return C[index % 4];
  if (t.includes("violet")) return "purple";
  if (t.includes("blue")) return "blue";
  if (t.includes("purple")) return "purple";
  if (t.includes("orange")) return "orange";
  if (t.includes("green")) return "green";
  return C[index % 4];
}

function archFromFlow(flow: string, colorCsv?: string) {
  const steps = flow
    .split(/\s*(?:-->|\u2192|\?)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!steps.length) return { architecture: ["Not applicable"] as string[], archColors: ["blue"] as string[] };
  const colorTokens = colorCsv
    ? colorCsv.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
    : [];
  const archColors = steps.map((_, i) => normalizeArchColor(colorTokens[i] ?? "", i));
  return { architecture: steps, archColors };
}

function preqs(csv: string) {
  const parts = csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return [{ name: "See asset documentation", done: true }];
  return parts.map((name) => ({ name, done: true }));
}

function tags(csv: string) {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function deps(csv: string): string[] {
  const parts = tags(csv);
  if (!parts.length || (parts.length === 1 && /^tbd$/i.test(parts[0]))) return ["Not applicable"];
  return parts;
}

export const REGISTRY_ASSETS = [
  {
    id: "ATL-001",
    name: "DataSmith - Tableau to Looker Migration",
    family: "atlas" as const,
    category: "BI Migration",
    clouds: ["azure"] as ("aws" | "gcp" | "azure")[],
    maturity: "Experimental" as const,
    effort: "low" as const,
    demoReady: true,
    solution: "Migraton Factory",
    owner: "Manikandan Loganathan",
    ownerInit: "ML",
    desc: "Discovery, Migration and Validation of Tableau dashboards to Looker",
    longDesc:
      "Discovery — Lineage analysis, schema analysis, cluster analysis.\n\nDataSmith accelerates Tableau-to-Looker migration with agentic discovery and validation workflows. Hosted on Azure (cloud agnostic).",
    ...archFromFlow("TBD", "TBD"),
    quickStart: "GUI based",
    prerequisites: preqs("Hosted service, Need Tableau as .twbx files"),
    dependencies: ["Not applicable"],
    stats: { deployments: 0, demos: 2, projects: 0, satisfaction: 0 },
    changelog: [{ ver: "registry", date: "2026-05-08", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags("Tableau, Looker, DataSmith, Migration, Agentic AI"),
    demoUrl: "https://datasmith.infovision.io",
  },
  {
    id: "ATL-002",
    name: "DataSmith - Synthetic Data Generator",
    family: "atlas" as const,
    category: "Data Generation",
    clouds: ["aws", "gcp", "azure"] as ("aws" | "gcp" | "azure")[],
    maturity: "Production" as const,
    effort: "low" as const,
    demoReady: true,
    solution: "Master Data & Domain Context",
    owner: "Manikandan Loganathan",
    ownerInit: "ML",
    desc: "Synthetic Data Generator",
    longDesc:
      "Generates tens to millions of rows of synthetic data statistically modeled on a given input dataset.\n\nHosted DataSmith capability for safe sharing and testing without exposing production rows.",
    ...archFromFlow("TBD", "TBD"),
    quickStart: "GUI based",
    prerequisites: preqs("Hosted service, None"),
    dependencies: ["Not applicable"],
    stats: { deployments: 0, demos: 4, projects: 1, satisfaction: 50 },
    changelog: [{ ver: "registry", date: "2026-05-08", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags("Data Generator, Data Generation, DataSmith"),
  },
  {
    id: "ATL-003",
    name: "Data Policy Anomaly Bot",
    family: "atlas" as const,
    category: "Compliance Validation, Policy Governance",
    clouds: ["azure", "gcp"] as ("aws" | "gcp" | "azure")[],
    maturity: "Production" as const,
    effort: "medium" as const,
    demoReady: false,
    solution: "Master Data & Domain Context",
    owner: "Abhiram Kalidindi",
    ownerInit: "AK",
    desc: "Natural language compliance bot that validates organizational policies against live BigQuery datasets and flags anomalies by risk severity.",
    longDesc:
      "The Data Policy Anomaly Bot is an AI-powered compliance accelerator that enables non-technical users to query organizational policies in plain English and validate them against live datasets in real time. Built on Azure GPT-4 + LangChain + BigQuery, the bot retrieves relevant policy documents via vector embeddings, generates structured validation queries, and runs them against live data to detect schema-level and data-level violations.\n\nAnomaly detection results are classified by risk severity and surfaced as clear, actionable bullet-point summaries — no SQL expertise required.\n\nKnown limitations: token limits can constrain validation on very large BigQuery datasets; complex edge-case queries may need refinement.",
    ...archFromFlow(
      "Natural Language Query --> Policy Document Retrieval (Vector Embeddings / FAISS) --> Query Structuring (GPT-4) --> BigQuery Validation (Schema + Data Level) --> Anomaly Detection --> Risk Severity Classification --> Actionable Summary Output",
      "Blue, Violet, Orange, Green and repeat",
    ),
    quickStart: "Gui Based",
    prerequisites: preqs("Python 3.x, Streamlit, Google BigQuery, Azure OpenAI"),
    dependencies: ["Not applicable"],
    stats: { deployments: 0, demos: 0, projects: 0, satisfaction: 0 },
    changelog: [{ ver: "registry", date: "2026-05-01", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags(
      "Compliance, Policy Governance, Anomaly Detection, BigQuery, GDPR, CCPA, LangChain, GPT-4, Vector Embeddings, Risk Classification",
    ),
  },
  {
    id: "FRG-001",
    name: "Sprinter",
    family: "forge" as const,
    category: "SDLC Automation & Acceleration",
    clouds: ["azure"] as ("aws" | "gcp" | "azure")[],
    maturity: "Production" as const,
    effort: "medium" as const,
    demoReady: true,
    solution: "Engineering Productivity Office",
    owner: "Noumika Balaji",
    ownerInit: "NB",
    desc: "AI-powered SDLC bot that expands user stories, generates tasks, test cases, code snippets, and release notes via a Kanban board.",
    longDesc:
      "Sprinter is a web application integrated with GPT-3.5-turbo that streamlines the entire software development lifecycle. It automates repetitive SDLC tasks including user story expansion with personas, goals and acceptance criteria, task and subtask generation, code snippet generation across multiple languages, test case creation, test code generation, release notes compilation, and weekly/monthly status reports.\n\nThe interface mirrors a JIRA-style Kanban board with four columns: To-Do, In Progress, QA, and Done — each unlocking relevant AI-powered actions at that stage.\n\nKey challenges solved: manual test case/story creation is error-prone and slow; no tooling existed to leverage historical data for risk prediction and story point estimation. Sprinter addresses both by combining LLM intelligence with structured project context.",
    ...archFromFlow(
      "User Story Input --> LLM Prompt Construction --> GPT-3.5-turbo --> Task / Code / Test Case Generation --> Kanban Board Display --> Release Notes / Reports",
      "Blue, Violet, Orange, Green and repeat",
    ),
    quickStart: "GUI based",
    prerequisites: preqs("Python 3.x, Node.js, React"),
    dependencies: ["WIP"],
    stats: { deployments: 0, demos: 8, projects: 0, satisfaction: 0 },
    changelog: [{ ver: "registry", date: "2026-05-12", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags("SDLC, Agile, User Stories, Test Cases, Code Generation, Kanban, Release Notes, GPT, JIRA"),
  },
  {
    id: "FRG-002",
    name: "Code Migration Frameworks",
    family: "forge" as const,
    category: "Code Modernization, Legacy Migration",
    clouds: ["azure", "gcp"] as ("aws" | "gcp" | "azure")[],
    maturity: "Production" as const,
    effort: "high" as const,
    demoReady: true,
    solution: "Modernization Factory",
    owner: "Blesson Roy",
    ownerInit: "BR",
    desc: "AI-assisted COBOL-to-Java and .NET-to-Node.js code migration with real-time developer Q&A and context-aware conversion.",
    longDesc:
      "Code Migration Frameworks is a multi-language modernization accelerator that uses GitHub Copilot and Gemini code assist plugins to convert legacy codebases to modern tech stacks. Currently proven for COBOL + C (with Python Flask API) to Java Springboot, and .NET C# to Node.js migrations.\n\nThe solution analyzes the source project's full file structure and codebase context, then assists developers through automated code conversion while answering real-time contextual queries.\n\nArchitecture: Legacy Source (COBOL/C/.NET) --> GitHub Copilot / Gemini Plugin (VSCode) --> Context Discovery --> Automated Conversion --> Java Springboot / Node.js Output --> QA & Test Case Generation.",
    ...archFromFlow(
      "Source Code Ingestion --> Context Discovery (File Structure Analysis) --> AI-Assisted Conversion (Copilot / Gemini) --> Output Generation (Java / Node.js) --> Test Case Generation --> QA Validation",
      "Blue, Violet, Orange, Green and repeat",
    ),
    quickStart: "Console / Gui based",
    prerequisites: preqs("Python 3.x, Java 17+, Node.js 18+, COBOL runtime"),
    dependencies: ["WIP"],
    stats: { deployments: 0, demos: 0, projects: 0, satisfaction: 0 },
    changelog: [{ ver: "registry", date: "2026-05-01", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags("COBOL, Java, Springboot, Code Migration, Legacy Modernization, .NET, Node.js, GitHub Copilot, Gemini"),
  },
  {
    id: "FRG-003",
    name: "AI Code Reviewer",
    family: "forge" as const,
    category: "SDLC Automation & Acceleration",
    clouds: ["azure"] as ("aws" | "gcp" | "azure")[],
    maturity: "Production" as const,
    effort: "medium" as const,
    demoReady: true,
    solution: "Release Acceleration",
    owner: "Pratyoosh Patel",
    ownerInit: "PP",
    desc: "Webhook-triggered AI code reviewer that delivers line-by-line analysis, best practice feedback, and Slack notifications on every PR.",
    longDesc:
      "The ADLC Unified Framework (Senior Dev GPT) is a webhook-driven SDLC optimization bot that automates code review on every pull or merge request. When a developer submits a PR in GitLab, the bot is triggered automatically via webhook, receives the committed code, and acts as a senior developer performing detailed line-by-line analysis.\n\nFeedback is delivered through a Slack app called Senior Dev in a conversational format, providing best practice recommendations, security vulnerability detection, and performance optimization suggestions in real time.\n\nIntegrates with: GitLab, GitHub, Bitbucket (via webhooks), Slack (notifications), GitLab CI/CD pipeline.",
    ...archFromFlow(
      "PR / MR Submitted --> Webhook Trigger (GitLab) --> Code Ingestion --> GPT-4 Line-by-Line Analysis --> Best Practice Scoring --> Slack Notification (Senior Dev) --> Developer Iterates",
      "Blue, Violet, Orange, Green and repeat",
    ),
    quickStart: "Integrated with Slack and Jira",
    prerequisites: preqs("Python 3.x, GitLab CI/CD, Slack SDK"),
    dependencies: ["WIP"],
    stats: { deployments: 0, demos: 0, projects: 0, satisfaction: 0 },
    changelog: [{ ver: "registry", date: "2026-04-01", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags("Code Review, Webhook, GitLab, Slack, CI/CD, GPT-4, SDLC, Automated Review, Pull Request"),
  },
  {
    id: "FRG-004",
    name: "ADLC Unified Framework",
    family: "forge" as const,
    category: "SDLC Automation & Acceleration",
    clouds: ["aws", "gcp", "azure"] as ("aws" | "gcp" | "azure")[],
    maturity: "Battle-Tested" as const,
    effort: "medium" as const,
    demoReady: true,
    solution: "Engineering Productivity Office",
    owner: "Priyanka Fulewale",
    ownerInit: "PF",
    desc: "Unified AI Enabler Framework for AIDLC",
    longDesc:
      "AI Enabler Framework in a coding IDE to analyze, design, build, test and audit components for different roles — BA, Front End Dev, Back End Dev, DBA and QA — for any application SDLC.",
    ...archFromFlow("TBD", "TBD"),
    quickStart: "IDE",
    prerequisites: preqs("IDE deployment - autosetup"),
    dependencies: deps("Application Standards, References and Guides"),
    stats: { deployments: 1, demos: 1, projects: 1, satisfaction: 85 },
    changelog: [{ ver: "registry", date: "2026-05-08", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags(
      "AI SDLC, AI enabled development, AI framework for SDLC, front end development, back end development, BA Analysis, Reverse Analysis",
    ),
  },
  {
    id: "FRG-005",
    name: "Autonomous SDLC Framework",
    family: "forge" as const,
    category: "SDLC Automation & Acceleration",
    clouds: ["aws", "gcp", "azure"] as ("aws" | "gcp" | "azure")[],
    maturity: "Experimental" as const,
    effort: "medium" as const,
    demoReady: true,
    solution: "Engineering Productivity Office",
    owner: "Nainik K",
    ownerInit: "NK",
    desc: "AI Enabler to perform autonomous AIDLC",
    longDesc:
      "AI Enabler Framework to do an Autonomous SDLC from ADO entry to feature rollout through complete SDLC.",
    ...archFromFlow("TBD", "TBD"),
    quickStart: "IDE",
    prerequisites: preqs("ADO, Github, IDE deployment (VSCode)"),
    dependencies: deps("Application Standards, References and Guides"),
    stats: { deployments: 0, demos: 2, projects: 0, satisfaction: 0 },
    changelog: [{ ver: "registry", date: "2026-05-08", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags("Autonomous SDLC, AI SDLC, AI enabled development, AI framework for SDLC"),
  },
  {
    id: "TIT-001",
    name: "Multiagent Call Center Automation",
    family: "titan" as const,
    category: "Multi-Agent Orchestration, Call Center Automation",
    clouds: ["gcp"] as ("aws" | "gcp" | "azure")[],
    maturity: "Production" as const,
    effort: "high" as const,
    demoReady: true,
    solution: "Customer Care Studio",
    owner: "Noumika Balaji",
    ownerInit: "NB",
    desc: "LangGraph multi-agent system with 6 specialized agents automating sentiment analysis, ticketing, recommendations, and resolution.",
    longDesc:
      "The Multiagent Call Center Automation System is an AI-driven solution built on a LangGraph-based multi-agent framework that optimizes call center operations through specialized autonomous agents. Six agents work in concert: Sentiment Analysis, Customer Profile Update, Call Avoidance, Support Ticket Management (JIRA), Recommendation, and Resolution.\n\nAgents integrate with PostgreSQL, JIRA, and email platforms. Owner: Gokulram | Repo: https://github.com/by-Gokulram/multiagent_callcenter_automation.git",
    ...archFromFlow(
      "Incoming Call / Trigger --> Sentiment Analysis Agent --> Customer Profile Agent --> Call Avoidance Agent --> Ticket Management Agent (JIRA) --> Recommendation Agent --> Resolution Agent --> Post-Call Summary",
      "Blue, Violet, Orange, Green and repeat",
    ),
    quickStart: "Embedded into IVR system",
    prerequisites: preqs("Python 3.x, LangGraph, PostgreSQL"),
    dependencies: ["WIP"],
    stats: { deployments: 1, demos: 5, projects: 1, satisfaction: 75 },
    changelog: [{ ver: "registry", date: "2026-04-01", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags("Multi-Agent, LangGraph, Call Center, Sentiment Analysis, JIRA, Automation, Agentic AI, Orchestration, Gemini"),
    repoUrl: "https://github.com/by-Gokulram/multiagent_callcenter_automation.git",
  },
  {
    id: "TIT-002",
    name: "Healthcare Bot",
    family: "titan" as const,
    category: "Domain Agent, Knowledge Retrieval",
    clouds: ["azure", "gcp"] as ("aws" | "gcp" | "azure")[],
    maturity: "Production" as const,
    effort: "medium" as const,
    demoReady: true,
    solution: "Enterprise Knowledge Assistant",
    owner: "Abhiram Kalidindi",
    ownerInit: "AK",
    desc: "Dual-persona RAG chatbot for hospital environments serving both patients and staff with role-tailored, policy-aware responses.",
    longDesc:
      "The Healthcare Bot is a dual-persona RAG-powered conversational agent designed for hospital environments. It serves Patients and Staff with persona-customized responses from role-specific data sources.\n\nSemantic search powered by Chroma vector store and Redis caching (40% response time reduction). Documented 85% query accuracy on complex semantic queries.",
    ...archFromFlow(
      "User Query (Patient / Staff Portal) --> Persona Selection --> Document Retrieval (Chroma Vector Store) --> Redis Cache Check --> Gemini 1.5 Flash LLM --> Role-Tailored Response --> Feedback Logging",
      "Blue, Violet, Orange, Green and repeat",
    ),
    quickStart: "Gui Based",
    prerequisites: preqs("Python 3.x, FastAPI, Redis, Chroma"),
    dependencies: ["WIP"],
    stats: { deployments: 1, demos: 4, projects: 1, satisfaction: 50 },
    changelog: [{ ver: "registry", date: "2026-04-01", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags("RAG, Healthcare, Dual Persona, Chroma, Redis, Embeddings, Knowledge Retrieval, Gemini, FastAPI"),
  },
  {
    id: "TIT-003",
    name: "Contextual Intelligence — Speech Diarization",
    family: "titan" as const,
    category: "Conversational AI, Real-Time Intelligence",
    clouds: ["gcp", "azure"] as ("aws" | "gcp" | "azure")[],
    maturity: "Battle-Tested" as const,
    effort: "high" as const,
    demoReady: true,
    solution: "Customer Care Studio",
    owner: "Pratyoosh Patel",
    ownerInit: "PP",
    desc: "Real-time speech diarization that structures live customer conversations and serves contextual product data and trade-in options instantly.",
    longDesc:
      "The Contextual Intelligence Speech Diarization System is a real-time conversational intelligence accelerator built for high-engagement customer interactions (retail, telecom). It listens to live audio between a CSR and customer, converts speech to text, attributes each utterance to the correct speaker (90% accuracy with clean audio), and extracts structured insights.\n\nDynamic web scraping via Selenium and LangChain; Redis caching (40% latency improvement); interactive iPad UI with cart integration.\n\nClassification: Accelerator (100% reusable) | Team: Veerasekhar, Abhiram, Blesson, Padma Priya, Satish, Rahul",
    ...archFromFlow(
      "Live Audio Input --> Speech-to-Text (Gemini Flash) --> Speaker Attribution (Diarization) --> Insight Extraction & Categorization --> Dynamic Product Retrieval (Selenium / Web Scraping) --> Redis Cache --> Interactive UI Display (iPad) --> Cart Integration",
      "Blue, Violet, Orange, Green and repeat",
    ),
    quickStart: "Mobile device based Gui",
    prerequisites: preqs("Python 3.x, React.js, FastAPI, Redis, LangChain"),
    dependencies: ["WIP"],
    stats: { deployments: 1, demos: 7, projects: 1, satisfaction: 75 },
    changelog: [{ ver: "registry", date: "2026-05-01", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags(
      "Speech Diarization, Real-Time, Conversational AI, Web Scraping, Redis, LangChain, Gemini, Speaker Attribution, Cart Integration",
    ),
  },
  {
    id: "TIT-004",
    name: "AIOps",
    family: "titan" as const,
    category: "Automated Support, SRE",
    clouds: ["azure"] as ("aws" | "gcp" | "azure")[],
    maturity: "Experimental" as const,
    effort: "high" as const,
    demoReady: true,
    solution: "Service & Order Operations AI",
    owner: "Balasubramani Murugesan",
    ownerInit: "BM",
    desc: "Agentic AI Platform to monitor, triage and resolve production incidents",
    longDesc:
      "Agentic AI Platform for AI Operations in a Multi-Agent setup to monitor, triage and resolve production incidents in a guided autonomy mode.",
    ...archFromFlow("TBD", "TBD"),
    quickStart: "GUI based",
    prerequisites: preqs("Hosted service"),
    dependencies: ["None"],
    stats: { deployments: 1, demos: 3, projects: 1, satisfaction: 70 },
    changelog: [{ ver: "registry", date: "2026-05-08", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags("AIOps, Production Support, Incident monitoring, Incident resolution, Agentic AI for Ops"),
    demoUrl: "http://74.249.248.133:8887/",
  },
  {
    id: "SNT-001",
    name: "Sentiment Analysis on Call Recordings",
    family: "titan" as const,
    category: "Call Quality Monitoring, Compliance Analytics",
    clouds: ["gcp"] as ("aws" | "gcp" | "azure")[],
    maturity: "Production" as const,
    effort: "medium" as const,
    demoReady: true,
    solution: "Customer Care Studio",
    owner: "Pratyoosh Patel",
    ownerInit: "PP",
    desc: "Gemini 1.5 Pro multimodal call analyzer that detects sentiment, tone sarcasm, and compliance violations directly from audio — no transcription needed.",
    longDesc:
      "The Sentiment Analysis on Call Recordings system uses Google Gemini 1.5 Pro's native multimodal audio processing to analyze customer service calls end-to-end without requiring a separate transcription step.\n\nValidated on Verizon call center data. Owner: Gokulram | Repo: https://github.com/by-Gokulram/tone_sentiment_analysis.git",
    ...archFromFlow(
      "Audio Input (Call Recording) --> Gemini 1.5 Pro Direct Audio Analysis --> Sentiment Scoring (Tone Intensity / Sarcasm / Emotion) --> Compliance Keyword Detection --> Risk Flagging --> Customizable Report Generation",
      "Blue, Violet, Orange, Green and repeat",
    ),
    quickStart: "Embedded into IVR system",
    prerequisites: preqs("Python 3.x, LangChain, Streamlit, Gemini 1.5 Pro"),
    dependencies: ["WIP"],
    stats: { deployments: 1, demos: 3, projects: 1, satisfaction: 65 },
    changelog: [{ ver: "registry", date: "2026-05-01", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags(
      "Sentiment Analysis, Call Recordings, Compliance, Tone Detection, Gemini, Multimodal, Audio Processing, Call Center, QA Monitoring",
    ),
    repoUrl: "https://github.com/by-Gokulram/tone_sentiment_analysis.git",
  },
  {
    id: "SNT-002",
    name: "Responsible AI Automation",
    family: "sentinel" as const,
    category: "Decisoin automation, Responsible AI",
    clouds: ["azure", "gcp", "aws"] as ("aws" | "gcp" | "azure")[],
    maturity: "Production" as const,
    effort: "high" as const,
    demoReady: true,
    solution: "AI Run Office",
    owner: "Hasham Ul Haq",
    ownerInit: "HH",
    desc: "Agent based decisoin automation for Responsible AI",
    longDesc:
      "RAIE is an enterprise-grade Responsible AI governance platform, designed with agentic architecture to transform manual, multi-stakeholder approval workflows into an intelligent, autonomous system. Purpose-built AI agents automatically enrich submissions from enterprise systems; multi-agent orchestration enables approximately 80% of use cases to be auto-approved against preset policy thresholds while flagging high-risk initiatives for human-in-the-loop review. The platform maintains full auditability, explainability, and fail-safe guardrails.",
    ...archFromFlow(
      "Discovery --> Enrichment --> Orchestration --> Integration --> Shadow Mode --> Assisted Review --> Scale",
      "Blue, Violet, Orange, Green and repeat",
    ),
    quickStart: "GUI based",
    prerequisites: preqs("Hosted service"),
    dependencies: [
      "Knowledge base / policy repository (for agent reasoning)",
      "Enterprise data connectors (Data team systems, infra APIs, budget systems)",
      "Model registry & library (approved algorithms)",
      "HITL review platform / dashboard (for flagged submissions)",
      "Audit logging infrastructure",
      "Stakeholder review notification system",
      "Approval authority access controls / RBAC system",
      "Real-time monitoring & observability stack (agent telemetry)",
    ],
    stats: { deployments: 1, demos: 5, projects: 1, satisfaction: 75 },
    changelog: [{ ver: "registry", date: "2026-05-08", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags("AI Governance, Responsible AI, Enterprise Compliance, Risk Management, Regulatory Compliance"),
  },
  {
    id: "TIT-005",
    name: "SLM vs LLM Decision Playbook",
    family: "sentinel" as const,
    category: "Model Selection, Cost Benchmarking",
    clouds: ["aws", "gcp", "azure"] as ("aws" | "gcp" | "azure")[],
    maturity: "Production" as const,
    effort: "low" as const,
    demoReady: true,
    solution: "Model & Agent Operations",
    owner: "Dhanuvanth Senthilkumar",
    ownerInit: "DS",
    desc: "A systematic framework for choosing between Small Language Models (SLM) and Large Language Models (LLM) based on deployment constraints, operational readiness, and business requirements.",
    longDesc:
      "The SLM vs LLM Decision Playbook is a cost-analysis and benchmarking tool that helps engineering teams make informed model selection decisions before committing to a tech stack. Built with LangChain, LlamaIndex, and Tiktoken; outputs include bar chart visualizations and word clouds of semantically relevant terms.\n\nOwner: Noumika | Contributors: Pravallika Hazarath, Noumika Balaji",
    ...archFromFlow(
      "User assessment form --> Decision engine (gatekeepers + weighted score) --> Recommendation result --> Gemini narrative --> Persist submissions (optional Supabase)",
      "Blue, Violet, Orange, Green and repeat",
    ),
    quickStart: "GUI based",
    prerequisites: preqs(
      "React and React DOM, TypeScript and type definitions, Vite and plugins, Tailwind CSS and PostCSS, Google Generative AI SDK, Supabase client, Lucide icons",
    ),
    dependencies: ["WIP"],
    stats: { deployments: 0, demos: 3, projects: 0, satisfaction: 0 },
    changelog: [{ ver: "registry", date: "2026-05-01", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags("LLM Benchmarking, Cost Analysis, Token Cost, Model Selection, SLM, Embeddings, LangChain, LlamaIndex, GPT"),
    demoUrl: "https://arch-eval-wx7y.vercel.app/",
  },
  {
    id: "TIT-006",
    name: "PromptEval",
    family: "titan" as const,
    category: "Prompt Engineering, Quality Evaluation",
    clouds: ["azure", "gcp"] as ("aws" | "gcp" | "azure")[],
    maturity: "Experimental" as const,
    effort: "low" as const,
    demoReady: true,
    solution: "Common Infrastructure",
    owner: "Kishore Bodelu",
    ownerInit: "KB",
    desc: "Shared prompt evaluation framework for testing, scoring, and iterating on prompts across all platform families and LLM providers.",
    longDesc:
      "PromptEval is a cross-platform prompt quality evaluation framework for testing, scoring, and iterating on prompts before production deployment. Derived from the LIE platform (LLM Insights Engine) prompt benchmarking capabilities and the broader Titan prompt management pattern.",
    ...archFromFlow(
      "Prompt Variants Input --> Dataset Selection --> Multi-Model Execution --> Response Scoring (Accuracy / Relevance / Tone) --> Side-by-Side Comparison --> Regression Detection --> Evaluation Report Export",
      "Blue, Violet, Orange, Green and repeat",
    ),
    quickStart: "Console / Chat interface / Gui based",
    prerequisites: preqs("Python 3.x, LangChain, Azure OpenAI"),
    dependencies: ["WIP"],
    stats: { deployments: 1, demos: 2, projects: 1, satisfaction: 80 },
    changelog: [{ ver: "draft", date: "2026-05-01", desc: "Registry status: draft (per AIMPLIFY Tags)." }],
    tags: tags("Prompt Engineering, Evaluation, Benchmarking, Quality, LLM Testing, Regression, Prompt Management"),
  },
  {
    id: "TIT-007",
    name: "LIE — LLM Insight Engine",
    family: "sentinel" as const,
    category: "Model Selection, Cost Benchmarking",
    clouds: ["azure", "gcp"] as ("aws" | "gcp" | "azure")[],
    maturity: "Battle-Tested" as const,
    effort: "high" as const,
    demoReady: true,
    solution: "Model & Agent Operations",
    owner: "Noumika Balaji",
    ownerInit: "NB",
    desc: "Unified multi-LLM benchmarking platform that runs concurrent queries across GPT, Mistral, Llama, Gemini and compares responses side by side.",
    longDesc:
      "The LLM Insight Engine (LIE) is a single unified platform that enables development teams to benchmark any combination of LLMs and embedding models against the same training document and query set — delivering fair, reproducible, apples-to-apples comparisons.\n\nKey technical achievement: moving model execution from CPU to GPU layers (CUDA) reduced concurrent execution times significantly.\n\nClassification: Accelerator (100%) | Owner: Noumika | Contributors: Abhiram, Pravallika, Veerashekar, Blesson, Hebin",
    ...archFromFlow(
      "Document Upload --> Model & Embedding Selection --> Viable Combination Computation --> Concurrent Query Execution (GPU/CUDA) --> Response + Latency Capture --> Side-by-Side Display --> Excel Export / Email",
      "Blue, Violet, Orange, Green and repeat",
    ),
    quickStart: "GUI based",
    prerequisites: preqs("Python 3.x, React, LangChain, LlamaIndex, PyTorch, CUDA, FAISS"),
    dependencies: ["WIP"],
    stats: { deployments: 1, demos: 7, projects: 1, satisfaction: 70 },
    changelog: [{ ver: "registry", date: "2026-04-01", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags(
      "LLM Benchmarking, Multi-LLM, GPT, Mistral, Llama, Gemini, Embeddings, Model Comparison, FAISS, LangChain, LlamaIndex",
    ),
  },
  {
    id: "TIT-008",
    name: "Video Intelligence Platform (VIP)",
    family: "titan" as const,
    category: "Video processing using LLM and text annotation",
    clouds: ["aws", "gcp", "azure"] as ("aws" | "gcp" | "azure")[],
    maturity: "Experimental" as const,
    effort: "high" as const,
    demoReady: true,
    solution: "Multi-Agent Orchestration",
    owner: "Pratyoosh Patel",
    ownerInit: "PP",
    desc: "Non realtime processing of videos and video to text interface for video analysis",
    longDesc:
      "Using CPUs to run video-based large language models and converting video description to text efficiently — emphasizing Intel Sapphire Rapids CPU-only instances so vLLM can process long CCTV / in-store / inventory camera footage on CPUs and create text summaries for rundown and anomaly detection. Text is then tagged for event tracking.\n\nInfoVision in collaboration with Intel and VMware. Credits: Abhiram Kalidindi, Noumika Balaji, Ria Ghosh, Pratyoosh Patel.",
    ...archFromFlow(
      "Data Ingestion --> Embedding Generation --> Vector Database Storage --> Retriever Subsystem --> Model Server Subsystem --> Serving Subsystem/User Interface",
      "TBD",
    ),
    quickStart: "Multi step process including hosting an on-prem server",
    prerequisites: preqs(
      "Intel Xeon Servers, VMware Virtualization Services, VideoLlama Model, Vector Database, Edge Devices/Cameras, Generative AI Infrastructure",
    ),
    dependencies: deps(
      "Intel, VMware, VideoLlama, Vector Database, REST APIs, SDKs, Edge Computing, Cloud/On-Prem Infrastructure",
    ),
    stats: { deployments: 1, demos: 10, projects: 0, satisfaction: 70 },
    changelog: [{ ver: "registry", date: "2024-10-23", desc: "AIMPLIFY Tags sheet sync." }],
    tags: tags("AI video processing, tet annotation, text summary, chat interface"),
  },
];

export type RegistryAsset = (typeof REGISTRY_ASSETS)[number];
