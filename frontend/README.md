# Amplify - Asset Catalog and Submission Pipeline

## Content

- [Context](#context)
- [What This Solution Does](#what-this-solution-does)
- [Amplify Problem Solution](#amplify-problem-solution)
- [Use Case](#use-case)
- [Pros and Cons](#pros-and-cons)
- [Prerequisites and Dependencies](#prerequisites-and-dependencies)
- [How to Start](#how-to-start)
- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Context

Amplify is a frontend application to manage reusable AI and engineering assets across platform families.  
It combines:

- A catalog experience for discovery and reuse
- A submission workflow for new assets
- A review pipeline with governance statuses
- Supabase-backed persistence for submissions and metadata

The goal is to help teams submit, review, approve, and publish reusable assets in an organized, auditable flow.

## What This Solution Does

Amplify provides:

- **Catalog browsing** by family, maturity, and metadata
- **Asset detail views** with architecture, prerequisites, quick-start, and action links
- **Submission forms** to capture rich metadata (owner, cloud compatibility, links, dependencies, commands)
- **Pipeline tracking** across stages such as Submitted, AI Review, Manual Approval, Approved, and Published
- **Supabase integration** for storing and retrieving submissions

## Amplify Problem Solution

Many teams struggle with asset sprawl: reusable solutions exist, but are scattered across repos, docs, and people.  
Amplify addresses this by:

- Standardizing intake with a structured submission form
- Creating a review lifecycle before publication
- Preserving operational context (dependencies, prerequisites, commands, architecture)
- Improving discoverability via a catalog-first UX
- Making governance and readiness visible through status and maturity metadata

## Use Case

Use Amplify when you need to:

- Publish internal reusable accelerators for delivery teams
- Track a new asset from submission to approval and publication
- Quickly evaluate whether an asset is demo-ready and production-usable
- Centralize technical onboarding data for each accelerator

Typical users:

- Platform and enablement teams
- Architects and technical leads
- Delivery engineers looking for reusable assets
- Governance/review stakeholders

## Pros and Cons

### Pros

- Clear submission-to-publication workflow
- Structured metadata improves searchability and handoff quality
- Supports both local fallback and Supabase persistence
- Simple React + TypeScript stack with fast local iteration

### Cons

- Current UX depends on quality/completeness of submitted metadata
- Requires environment setup for full Supabase-backed behavior
- Large bundles may trigger size warnings in production builds

## Prerequisites and Dependencies

### Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended
- Supabase project (optional for local-only mode, required for shared persistence)

### Core dependencies

- `react`
- `react-dom`
- `react-router-dom`
- `@supabase/supabase-js`
- `framer-motion`
- `lucide-react`
- `tailwind-merge`
- `clsx`

### Dev dependencies

- `vite`
- `typescript`
- `eslint`
- `@vitejs/plugin-react`

## How to Start

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables (see [Environment Variables](#environment-variables)).

3. Run development server:

```bash
npm run dev
```

4. Open the local URL shown by Vite (typically `http://localhost:5173`).

## Quick Start

```bash
# 1) Install
npm install

# 2) Start dev server
npm run dev

# 3) Validate build
npm run build
```

## Architecture Overview

- **Frontend**: React + TypeScript + Vite
- **State/Data flow**:
  - UI pages load and submit data via `src/lib/*`
  - `src/lib/pipeline.ts` handles submission lifecycle and Supabase CRUD for pipeline records
  - `src/lib/catalog.ts` builds catalog-ready assets from published submissions
- **Persistence**:
  - Supabase table `submissions` for pipeline data
  - Local storage fallback when Supabase is unavailable

## Environment Variables

Create a `.env` file in the project root with:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_or_anon_key
```

Notes:

- The app also supports `VITE_SUPABASE_ANON_KEY` as fallback key name.
- If env vars are missing, the app can still run using local-storage fallback paths for some flows.

## Troubleshooting

- **Only local data appears**  
  Check that `VITE_SUPABASE_URL` and key are set correctly and server restarted after `.env` changes.

- **Form updates appear partial**  
  Verify schema alignment in `supabase-schema.sql` and payload fields in `src/lib/pipeline.ts`.

- **Buttons should not open missing links**  
  Asset action buttons are disabled automatically when demo/repo/video URLs are not available.

- **Build warnings about chunk size**  
  Consider route-level code splitting or adjusting Vite chunk size warning threshold.
