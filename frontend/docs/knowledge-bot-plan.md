# Aimplify Knowledge Bot — Planning Document

> **Status:** v0.16 — Phase 1 solid (four live-testing correctness fixes + a dev-workflow fix, see changelog). **Phase 2 in progress**: `get_platform_stats` (public, RBAC-free) and `get_my_submissions` (RBAC-sensitive, safe by construction — see v0.16 entry) are both live. Remaining Phase 2 work: `get_submission_status` for a single submission by id/title if `get_my_submissions` proves insufficient, and department-scoped admin queries. See §10 for the implementation log and §7a for the resolved technical assumptions.
> **Purpose:** Living planning doc for the conversational "knowledge specialist" bot. Keep this updated as requirements change instead of re-deriving context each time. Every section has a status tag: `DRAFT`, `DECIDED`, `ASSUMED (unconfirmed)`, `OUT OF SCOPE`.

## Changelog
| Date | Change |
|---|---|
| 2026-09-18 | Initial draft created from requirements conversation. |
| 2026-09-18 | v0.2 — decided widget placement (floating button, bottom-right); decided to reuse the shared AIV vector DB instead of standing up pgvector (per team lead); formalized the hybrid tags+keywords+vector retrieval pipeline. |
| 2026-09-18 | v0.3 — resolved all v1 scope decisions (§7: all-users audience, published-only for v1, global placement, ephemeral conversations, codebase mode confirmed out of scope); added recommended positions for each §7a technical unknown pending team-lead/AIV-team confirmation. |
| 2026-09-18 | v0.4 — §7a recommendations **adopted as the working assumptions for Phase 0**, so implementation can start now. Each remains individually correctable — update its row in §7a (don't re-plan the whole doc) the moment the AIV team confirms or corrects it. |
| 2026-09-18 | v0.5 — implemented Phase 0 + Phase 1 MVP in code (§11). **Correction found during implementation:** `MainLayout.tsx` already documents that the production Azure App Service plan does not support WebSockets (notifications fall back to 60s polling for the same reason) — so §4/§6/§9's plan to reuse `websocket/manager.py` for streaming chat was wrong. Built as plain REST (`POST /assistant/chat`) instead; streaming (if wanted later) would need Server-Sent Events, not WebSockets, on this hosting plan. |
| 2026-09-21 | v0.6 — local `.env` fully configured (`GEMINI_API_KEY/MODEL`, `GROQ_API_KEY/MODEL`, `MONGODB_URL`/`MONGODB_DB_NAME`); added `check_knowledge_db.py` diagnostic and ran it against the real Mongo connection. **§7a #1, #2, #5 CONFIRMED**: it is genuinely MongoDB Atlas (enterprise build, supports `list_search_indexes`), and `aimplify_knowledge` is a usable, isolated collection. **#3/#4 still pending**: the Atlas Vector Search and Atlas Search indexes themselves don't exist yet — that's the one remaining blocker, and it's an Atlas-console action, not something scriptable from here. |
| 2026-09-21 | v0.7 — **Confirmed local `.env` points at the same DB as `aimplify-backend-prod`** (hostname `clustermongo.xopxfj4.mongodb.net` + db `ai_intranetportal_test` matched on both, verified without exposing full credentials). Added `create_knowledge_indexes.py` and, with explicit approval, created both indexes directly via the driver (Atlas exposes `createSearchIndex` over a normal connection since MongoDB 7.0 — no separate Console/Admin API access needed). **§7a #3/#4 now CONFIRMED** — both indexes live. **Bug found + fixed during first backfill run:** `text-embedding-004` has been retired by Google (404) — swapped default to `gemini-embedding-001`, and had to explicitly pin `outputDimensionality: 768` (that model defaults to 3072-dim, which would've silently mismatched the Atlas index) plus add `taskType` (`RETRIEVAL_DOCUMENT` for indexing vs `RETRIEVAL_QUERY` for queries, since Gemini's embeddings are asymmetric). Backfill re-run succeeded: **7 platform docs + 26 Published catalog assets indexed, 0 failures.** |
| 2026-09-21 | v0.8 — **First real browser test surfaced a bug**: `POST /assistant/chat` returned 404 with zero corresponding log line in the backend (confirming it never reached FastAPI). Root cause: `frontend/vite.config.ts`'s dev proxy uses an explicit path-prefix allowlist and `/assistant` was missing from it — Vite's own dev server was 404ing the request before it could be proxied. Fixed by adding `/assistant` to the proxy map. **Note for local dev:** Vite does not hot-reload proxy config changes — the dev server needs a full restart (not just a browser refresh) to pick this up. |
| 2026-09-21 | v0.9 — **First working end-to-end query** ("list out all the assets currently there") returned a real, correctly-linked answer — full pipeline (Mongo hybrid search + Gemini synthesis) confirmed live. Three UX fixes from that first real test: (1) added an expand/collapse toggle to the chat panel header (`Maximize2`/`Minimize2`); (2) added `react-markdown` — replies were previously rendered as raw text, so `**bold**` and `[link](/catalog/x)` syntax showed literally instead of formatting; internal links now `navigate()` via react-router instead of a full page reload; (3) added a `small_talk` intent classification that skips the entire retrieval pipeline (no embedding/vector/tag/keyword calls) for greetings/acknowledgments and replies with a short, natural line instead of a full knowledge-base-styled answer; also added a general "match reply length to the question" rule to the main system prompt as a second line of defense. |
| 2026-09-21 | v0.10 — **Consistency audit, no functional changes.** Several sections still read as draft/unconfirmed even though the changelog had already resolved them: §2.1 didn't distinguish what's actually indexed (catalog + docs) from what's Phase 2/unbuilt (submissions) or an open question (AIV ideations, raised earlier the same day); §4.3/§4.8 still hedged on Atlas Search availability and embedding-model compatibility, both long since confirmed; §8's phase list had no progress markers; §10's intro/tables/"Verified so far" were written before the real browser test and still said things hadn't been tried yet. All reconciled with the actual current state. |
| 2026-09-22 | v0.16 — **`get_my_submissions` — the first RBAC-sensitive live tool.** "How many assets have I submitted" now gets a real answer (title, status, AI score/feedback, link per submission) instead of a redirect to Pipeline. Threaded the authenticated user through the whole call chain: `assistant.py` router → `answer_question(..., user_id=str(user.id))` → `live_tools.get_my_submissions(user_id)`. **RBAC design: safe by construction, not by a runtime permission check** — `user_id` is always the server-verified caller from the JWT (never anything client-supplied, never read from the request body), so the query `WHERE submitter_id == user_id` can only ever return that same user's own rows; there is no code path where one user's request can specify or influence whose submissions get returned. New `my_submissions` intent, disambiguated from `list_all` (whole catalog) and `platform_stats` (aggregate numbers) in the classifier prompt. Dedicated system prompt instructs the LLM to report exactly what the tool returned — never invent a submission, status, or score. |
| 2026-09-21 | v0.15 — **Phase 2 kickoff: `get_platform_stats`, the first live tool-call.** Scoped deliberately narrow first (per discussion) — just live aggregate counts (total Published, demo-ready, by-family, by-maturity), no personal/RBAC-sensitive data yet. New `app/services/knowledge/live_tools.py` — mirrors the exact same query logic the Home dashboard already uses client-side (no dedicated stats endpoint existed; confirmed via code search that Home.tsx derives these numbers itself from `GET /catalog` + `GET /catalog/families`). Wired in as a new `platform_stats` intent (disambiguated from `list_all`: stats wants a *count*, list_all wants the *items*) that bypasses Mongo entirely and queries Postgres live — this also closes the "Mongo mirror's count could be stale" gap flagged earlier. No RBAC needed for this tool specifically (these are the same numbers already shown to every authenticated user on Home) — this is the first, safest slice of Phase 2; personal submissions/admin queries (still RBAC-sensitive) remain unbuilt. |
| 2026-09-21 | v0.14 — **"How many assets have I submitted" correctly refused to fabricate a count, but pointed to `/submit` instead of `/pipeline`.** The one workflow doc conflated two distinct destinations (create a new submission vs. track existing ones) into a single `link` field, so whichever intent surfaced it, the LLM only had `/submit` to offer. Split into two docs: `workflow:submit-asset` (→ `/submit`, creating new) and `workflow:track-submissions` (→ `/pipeline`, checking status of existing ones — its text explicitly says the bot has no access to personal submission history, per §3, and that Pipeline is where the real answer lives). Also added an explicit system-prompt rule: "your own submissions" questions must point to `/pipeline`, never `/submit`, independent of which doc retrieval happens to surface. Requires a backend restart (auto-reindexes platform docs on startup per v0.13 — no separate backfill needed). |
| 2026-09-21 | v0.13 — **Closed the exact friction v0.12 exposed**: platform docs (family taxonomy, workflow explanations) are hand-authored Python, not database rows, so nothing re-indexed them when their content changed — a backend restart reloaded the *code* but the *Mongo record* stayed stale until someone remembered to separately run `backfill_knowledge_base.py`. Added `_reindex_platform_docs_on_startup()` to `main.py`'s lifespan — re-indexes the (small, cheap) platform docs automatically every time the backend starts, wrapped so a failure/missing config never blocks app startup. Catalog assets already had event-driven re-indexing (§5) and didn't need this; this closes the other half — a code edit + restart is now self-contained for platform docs too, no separate manual script needed going forward. |
| 2026-09-21 | v0.12 — **"Guide me to submit an asset" didn't link to `/submit`.** The bot answered correctly (content drawn from our `workflow:submission-pipeline` doc) but with no actionable link — that doc's `link` metadata pointed to `/pipeline` (the tracking dashboard) instead of `/submit` (the actual form), and the system prompt didn't require navigation-style questions to end with an explicit link. Fixed both: retitled the doc "Submit an Asset," changed its link to `/submit`, added `/submit` and `/pipeline` as literal paths inside the doc's own text (both destinations mentioned, correctly distinguished), and added a system-prompt rule that "guide me to X"/"where is Y" questions must end with a standalone actionable link, not just described steps. **Requires re-running `backfill_knowledge_base.py`** — this changed indexed doc content, not just code, so the already-indexed Mongo record still has the old text/link until re-indexed. |
| 2026-09-21 | v0.11 — **Two real bugs found from live conversation review, both fixed.** (1) "List all X" questions (e.g. "get me the list of current ideas present") silently returned a 6-item top-K similarity sample framed as if it were the complete list — added a `list_all` intent that bypasses ranking entirely and fetches the true complete (optionally tag-scoped) set via `aiv_vector_client.list_all()`, a new plain-query function. (2) The bot silently reinterpreted "ideas" as "assets" without disclosing that AIV ideation-pipeline data isn't part of its knowledge — added an explicit, unconditional scope-disclosure rule to the system prompt so it says so plainly before offering catalog assets as the closest alternative. Also added a general anti-overclaiming rule: ordinary (non-`list_all`) results are now explicitly framed to the LLM as "a relevant sample, not necessarily complete," closing the same failure mode for any future query shape, not just "ideas." |

---

## 1. Vision

A conversational assistant embedded in Aimplify that acts as a **knowledge specialist for the entire platform** — every catalog asset, every project/submission, the platform's own features, workflows, and taxonomy. Users ask natural-language questions and get:

1. **Direct answers** when the information exists — with a pointer/link to *where* it lives in the app if the user asks "where."
2. **Explanations**, not just facts — e.g. how a workflow works, what a family means, why something is scored a certain way.
3. **Best-effort alternatives** when there's no exact match — "there's nothing called X, but here's Y which is closely related," rather than a flat "not found."
4. A **conversational tone** — follow-up questions, clarification, multi-turn context — not a rigid FAQ/search box.

This is a new subsystem. Today Aimplify has **no memory or RAG layer at all** (confirmed during codebase analysis — AI usage today is single-shot LLM prompts per submission, no embeddings, no vector store, no chat). This bot is the first true "knowledge base" the platform will have.

---

## 2. Scope

### 2.1 In scope (knowledge domains)
| Domain | Source of truth today | Phase | Notes |
|---|---|---|---|
| Published catalog assets | `catalog_assets` table | ✅ **Built (v1)** | 26 assets indexed live; title, description, family, department, tech stack, cloud, maturity, owner, demo/video URLs, dependencies, commands, stats |
| Platform taxonomy + workflow docs | `FAMILY_META` in `catalog.py` + hand-authored workflow explanations | ✅ **Built (v1)** | 7 docs indexed live: 4 family taxonomies + submission-pipeline/clone-request/demo-request workflow explanations |
| Submissions / pipeline | `submissions` table | 🔜 **Phase 2, not built** | status, AI feedback, review state — **must be RBAC-scoped per user** via live tool-calling (§4.5), never pre-indexed, see §3 |
| Uploaded architecture documents | `architecture_file_url` + `document_reader.py` extraction | 🔜 **Not built** | Identified as a good early enhancement (§9) — architecture-file text isn't in the v1 chunk builder yet |
| Cross-system ideation links | AIV MongoDB via `aiv_ideation_service.py` (`list_approved_ideations()`, `cic_pipeline` collection) | ❓ **Open question, not built** | The read access already exists (used today only to validate/link a submission at submit-time) but the bot doesn't index or search ideation content at all. Raised in conversation 2026-09-21; confirmed as real user demand the same day (a live test asked "get me the list of current ideas present"). As of v0.11 the bot discloses this gap explicitly instead of silently answering about assets — but whether to actually build ideation ingestion is still undecided. |
| Reports (aggregate) | `executive_report_service.py`, `observability_report_service.py` | 🔜 **Not built** | summarized on demand, not embedded verbatim |

### 2.2 Explicitly out of scope for v1
- **Codebase/engineering knowledge** (source code, architecture internals, deployment). Different audience, much larger security surface (would expose implementation details, secrets-adjacent config). Candidate for a *separate*, admin/engineering-only tool later — not this bot.
- Writing/mutating data via the bot (e.g., "submit this for me") — v1 is **read-only Q&A**.
- The unrelated `archeval` mini-tool and its Supabase data — separate system, not part of Aimplify's core knowledge.

---

## 3. Non-negotiable constraint: RBAC-aware answers (DECIDED)

The bot must never surface anything a user couldn't already see through the normal UI/API. Concretely, mirroring existing rules in [`deps/rbac.py`](../backend/app/deps/rbac.py) and [`db/models.py`](../backend/app/db/models.py):

- `repo_url` is flagged in the model as "NEVER exposed in API responses" — the bot must honor that (exclude from embeddings and from tool-call outputs).
- Regular users: can only be told about **Published** catalog assets + **their own** submissions.
- Admins: department-scoped (`dept_check`) — same restriction the bot must apply to any submission/pipeline query.
- Owners: unrestricted.

**Design implication:** we cannot pre-embed submissions or restricted fields into a single shared vector index that every user's queries hit — that would leak across users/departments. See §4.2 for how retrieval is split to handle this safely.

---

## 4. Proposed architecture (DECIDED direction, details DRAFT)

### 4.1 Infra decision: reuse the shared AIV vector DB (DECIDED)
Per team lead: Aimplify will **not** stand up its own RAG database. The Aimplify knowledge base lives inside the **same vector DB already used by the AIV Intelligence Portal**, in an isolated namespace/collection/index so it never mixes with AIV's own ideation data.

**Working hypothesis to confirm** (see §7a): `aiv_ideation_service.py` today talks to plain MongoDB (via `motor`) with no vector search calls — so "the AIV vector DB" is most likely **MongoDB Atlas with Atlas Vector Search** enabled on that same cluster, not a separate product. If confirmed, this is good news for point 3 below: Atlas also has **Atlas Search** (full-text/BM25) on the same cluster, so vector search, keyword search, and metadata filtering can all run against one system instead of stitching together separate tools.

### 4.2 Knowledge item model — chunk + summary + tags + keywords + embedding
This formalizes your proposed design. Every indexed item (a catalog asset, a family description, a platform-doc section, an extracted architecture doc) becomes one record:

| Field | Description |
|---|---|
| `source_type` / `source_id` | e.g. `catalog_asset` / the asset's UUID — links back to the row of truth |
| `text` | the chunk content actually shown to the LLM at answer time |
| `summary` | short LLM-generated summary, used for quick relevance scoring and for answer synthesis without re-reading the full text |
| `tags` | **structured tags** pulled directly from existing fields — free, always accurate: `family`, `department`, `cloud_provider`, `maturity`, `tech_stack[]`, `category` |
| `keywords` | **LLM-extracted semantic tags/keywords** for fuzzier concepts, problem domains, and use-case phrasing not explicit in structured fields (e.g. "compliance," "data migration," "cost optimization") |
| `embedding` | dense vector of `text` (+ summary) for semantic similarity |
| `metadata` | jsonb: deep link (`/catalog/{slug}` etc.), `updated_at`, namespace tag (`aimplify`) |

Structured tags are essentially free (already in the DB) and should always be attached — they're the most reliable signal and require no LLM call. LLM-generated tags/keywords/summary are one combined generation call per item at ingestion time.

**Never indexed:** draft/unpublished submissions, `repo_url`, any admin-only field — see §3.

### 4.3 Query-time inference pipeline (hybrid retrieval) — DRAFT, this is the recommended design
This is your proposed flow, formalized into concrete steps:

1. **Query understanding** — one small LLM call extracts from the raw user question: candidate `tags`, `keywords`, named entities (asset/family names mentioned), and coarse intent (`lookup`, `explain`, `compare`, `navigate`, `troubleshoot`, or `small_talk` — added post-launch, see §10 v0.9, so greetings/acknowledgments skip retrieval entirely and just get a short natural reply).
2. **Parallel hybrid retrieval** — run three signals against the shared index at once (skipped entirely for `small_talk`):
   - **Vector search** — semantic similarity on the query embedding. ✅ Live on Atlas Vector Search (§7a #1/#3 confirmed).
   - **Tag match** — filter/boost records whose structured or semantic tags overlap the extracted tags.
   - **Keyword/lexical search** — exact/BM25-style match against `keywords` + `summary` + `text`. ✅ Live on Atlas Search (§7a #4 confirmed) — the lexical-fallback contingency mentioned below was never needed.
3. **Merge & rerank** — combine the three candidate lists (reciprocal rank fusion or a weighted score: vector similarity + tag overlap count + keyword match score), dedupe by `source_id`, take top-K.
4. **RBAC post-filter** — no-op today since only public data is indexed (§3); becomes load-bearing the moment Phase 2 introduces any permission-scoped content — reconfirm at that point whether it's filtered here or (preferred) simply never indexed and instead served via live tool-calling (§4.5).
5. **Answer synthesis** — final LLM call combines top-K chunks (with tags/summaries) + any live tool-call results (§4.5) into one conversational, cited answer.
6. **Fallback** — if the merged top results all score below threshold, relax the tag/keyword requirement and lower the vector threshold, then present results explicitly framed as "nothing exact, but here's something related" (§4.6).

This hybrid shape (dense + sparse + metadata, not vector-only) is specifically what makes the "similar alternative" behavior good: tag/keyword overlap surfaces related items that pure vector similarity sometimes misses, and vice versa.

### 4.4 Why tags/keywords matter even more with a shared external index
Because Aimplify's knowledge base shares infrastructure with another team's system, precise tag/namespace filtering isn't just a relevance nicety — it's how we guarantee Aimplify queries never surface AIV ideation content (or vice versa). Every record and every query must carry the `aimplify` namespace tag as a hard filter, not just a ranking signal.

### 4.5 Live tool-calling — for structured/permission-sensitive/frequently-changing data
Independent of the vector DB decision above, anything permission-sensitive or fast-changing (submission status, "my submissions," department-scoped admin queries, live counts) still goes through direct, RBAC-checked backend calls — never through the shared vector index:
- The assistant agent gets a small set of callable tools, each running through the *same* FastAPI dependency chain (`get_current_user`, `require_role`, `dept_check`) as the REST API:
  - `search_published_catalog(query, filters)`
  - `get_asset_by_id_or_slug(id)`
  - `get_family_info(name)`
  - `get_my_submissions(user)` — scoped to caller
  - `get_submission_status(id, user)` — RBAC-checked before returning anything
  - `get_platform_stats()` (counts, family breakdown — safe aggregates only)
- Mirrors the pattern already used in `orchestrator.py`'s `_fetch_existing_entries()` — live SQL, no stale cache — extended with an explicit permission check per call.

**Orchestration:** an agentic loop — the LLM decides whether to run hybrid retrieval (§4.3), call a live tool (§4.5), or both, then synthesizes one conversational answer. This is a step up from today's `BaseAgent` (single-shot, no tool use, no multi-turn) — needs a new component, not a drop-in reuse of the existing agent base class.

*(Implementation note: v1's `assistant_agent.py` only does retrieval + synthesis, since §4.5's live tools are dormant until Phase 2 per the §7 decision to ship Published-catalog-only first — see §10.)*

### 4.6 "No exact match" behavior
When neither live tools nor hybrid retrieval return a confident hit:
1. Relax thresholds (§4.3 step 6) and surface the top-N nearest candidates anyway, explicitly framed ("nothing exact, but these are close").
2. Let the LLM reason over near-miss candidates and explain *why* they're related (shared tech stack, same family, similar problem domain) — same spirit as the existing `duplicate_check_agent` rubric, reused conceptually.
3. Never silently hallucinate a nonexistent asset — if genuinely nothing relates, say so plainly and suggest where the user could look/ask a human.

### 4.7 "Where is it" behavior
Every answer about a concrete entity carries the `metadata` deep link from §4.2 (or from a tool-call result) so the frontend renders a real in-app link — e.g. `/catalog/{slug}`, `/pipeline/{submission_id}`, `/family/{name}` — not just prose describing a location.

### 4.8 LLM choice (DECIDED — implemented)
- **Gemini (primary) / Groq (fallback)**, consistent with the rest of the platform's AI usage and existing API keys/config, for query understanding, tag/summary generation, and answer synthesis.
- Embeddings: **Gemini `gemini-embedding-001`**, explicitly pinned to `outputDimensionality: 768` to match the Atlas Vector Search index, with `taskType` set per call (`RETRIEVAL_DOCUMENT` at ingestion, `RETRIEVAL_QUERY` at search time — Gemini's embeddings are asymmetric). Note: `text-embedding-004` was the original default but has been retired by Google (404) — see §10 v0.7 for the fix. Compatibility with AIV's own vectors turned out to be a non-issue once §7a #2 confirmed Aimplify has its own dedicated collection — no shared index, no dimension/model collision possible.

---

## 5. Data ingestion & freshness (DRAFT)

- **Event-driven:** hook into existing write paths so the index updates immediately. Each hook builds the full record from §4.2 (text + summary + tags + keywords + embedding) and upserts into the shared AIV vector DB under the `aimplify` namespace:
  - `POST /submissions/{id}/publish` → index the new/updated `CatalogAsset`.
  - `PATCH /catalog/{asset_id}` → re-index on change.
  - Portal settings / family content updates → re-index affected docs.
- **Scheduled full resync:** ~~a background task...~~ **Partially implemented (v0.13), narrower than originally scoped**: platform docs re-index automatically on every backend **startup** (same fire-and-forget task pattern as `run_executive_report_scheduler`) — this covers "pick up doc changes not tied to a DB write" for the hand-authored docs, since editing `_platform_docs()` + restarting is now self-contained. It is a one-shot-per-restart re-index, not a recurring interval job, and doesn't cover catalog assets (they don't need it — already event-driven, see below) or genuine drift-over-time detection.
- **Backfill job:** one-time script to index all currently-published assets + static docs when this feature ships.
- **Deletion/archival:** when a `CatalogAsset` is archived (`DELETE /catalog/{asset_id}` sets `status = Archived`), the corresponding record must be removed or flagged inactive in the shared index — otherwise the bot keeps recommending archived assets.

---

## 6. Conversational experience

- **Placement (DECIDED):** floating button, bottom-right corner, **global across all authenticated pages** (mounted once in the app shell, e.g. `MainLayout.tsx`, not per-page). Clicking it opens a compact chat panel in place — not a full-page navigation.
- **Multi-turn & persistence (DECIDED):** conversation context is maintained only within the current session (in-memory on the frontend) — no backend persistence in v1. Closing the panel keeps history for the session; a page refresh or logout clears it. Revisit in Phase 3 if personalization/audit needs emerge.
- **Tone:** proactive knowledge specialist — explains, contextualizes, offers next steps — not a terse search box. Matches the "very conversational" requirement explicitly called out.
- **Citations:** every factual claim about a specific asset/submission/family should be traceable to a tool result or retrieved chunk (for trust + easy debugging of wrong answers).
- **Streaming (CORRECTED):** the production Azure App Service plan does **not** support WebSockets — this is already documented in `MainLayout.tsx`, which is why notifications fall back to 60s polling instead of the existing `websocket/manager.py`. The original plan to reuse that infra for streaming chat was wrong. Implemented as a plain REST endpoint (non-streaming, full answer in one response) instead. If streaming is wanted later, the option on this hosting plan is Server-Sent Events (works over plain HTTP), not WebSockets.

---

## 7. v1 scope decisions (DECIDED)

| # | Decision | Resolution |
|---|---|---|
| 1 | Audience for v1 | **All authenticated users** — every role (`Aimplify.User/Admin/Owner`) gets the bot from day one. |
| 2 | Submission/pipeline visibility | **Published catalog + docs only for v1.** No submission/pipeline awareness until Phase 2 (§8). Simplest and safest — nothing RBAC-sensitive is in scope yet. |
| 3 | Placement scope | **Global** — the floating button + panel (§6) is mounted across all authenticated pages, not just Home. |
| 4 | Conversation persistence | **Session-only/ephemeral for now.** No `assistant_conversations`/`assistant_messages` tables in v1 — history lives in frontend memory for the current session and is gone on refresh/navigation away (confirm exact behavior in §6). Revisit in Phase 3 if personalization/audit trail becomes a priority. |
| 5 | Codebase/engineering mode | **Confirmed out of scope.** Not part of this bot's design at all; would be a separate future initiative (§2.2, §8 Phase 4). |

**Practical effect on §4–§9:** because v1 only ever indexes Published catalog assets + public docs, §4.3 step 4 (RBAC post-filter) and all of §4.5's live tool-calling are dormant until Phase 2 — build the interfaces now so Phase 2 is a data-source addition, not a redesign, but there's nothing permission-sensitive to worry about shipping in v1.

### 7a. Technical assumptions about the shared AIV vector DB — ADOPTED for Phase 0 (each: `ASSUMED — unconfirmed`)

None of these are confirmed by the AIV team yet. They're adopted now so Phase 0 isn't blocked, each behind an interface/config seam so correcting one later is a **localized change, not a redesign**. When you get clarity on any row, update just that row's status to `CONFIRMED` or `CORRECTED` and note the actual answer — no need to touch the rest of the doc.

| # | Question | Assumption adopted for Phase 0 | Status |
|---|---|---|---|
| 1 | What is it, concretely? | **MongoDB Atlas Vector Search** on the same cluster `aiv_ideation_service.py` already connects to. | ✅ **CONFIRMED** 2026-09-21 via `check_knowledge_db.py` against the real `MONGODB_URL`/`MONGODB_DB_NAME` (`ai_intranetportal_test`): server reports an `enterprise` build and supports the Atlas-only `list_search_indexes` command — this is genuinely Atlas. |
| 2 | Namespace/collection isolation? | Aimplify gets its **own dedicated collection/index** (`aimplify_knowledge`), not a shared collection with tag-filtering. | ✅ **CONFIRMED workable** — the `aimplify_knowledge` collection is separate from AIV's own collections in the same database; the diagnostic's write/read probe against it succeeded. |
| 3 | Metadata filtering support? | **Yes** — store `tags` (§4.2) as indexed/filterable fields from day one. | ✅ **CONFIRMED** 2026-09-21 — `aimplify_knowledge_vector_index` created via `create_knowledge_indexes.py` (with `namespace` as a filter field) and confirmed present/queryable by `check_knowledge_db.py`. |
| 4 | Keyword/lexical search support? | **Atlas Search** (Lucene full-text) on the same cluster handles the keyword leg of §4.3. | ✅ **CONFIRMED** 2026-09-21 — `aimplify_knowledge_search_index` created and confirmed present the same way. `keyword_search()` is live. |
| 5 | Embedding model compatibility? | Aimplify uses **its own embedding model (Gemini)** — safe because assumption #2 gives it a dedicated collection, so vectors never mix with AIV's. | ✅ Confirmed safe now that #2 is confirmed — no shared-index constraint. |
| 6 | Access & credentials? | New config alongside `aiv_mongodb_url`/`aiv_mongodb_db_name` in `config.py`, loaded via the same Key Vault path (`load_secrets()`); request a **distinct, scoped credential** for the new collection. | ⏳ Still using the same connection string as configured locally (`MONGODB_URL`) — whether it's the same credential as the ideation service or already scoped down is unconfirmed. Not urgent for local dev. |
| 7 | Ownership/on-call? | **Split model** — AIV team owns the cluster (capacity, upgrades, uptime); Aimplify owns its own collection's schema, indexes, and data lifecycle. | ⏳ Still unconfirmed — needs a conversation, not a technical check. |

**All seven items are now resolved.** #1/#2/#5 confirmed via `check_knowledge_db.py`; #3/#4 (the indexes themselves) created directly via the driver using `create_knowledge_indexes.py` (no Atlas Console access needed — confirmed via `list_search_indexes` afterward). #6/#7 remain informal/unconfirmed but are operational, not technical, unknowns — revisit if/when they become relevant (a real incident, or someone asking about credential scoping), not a blocker to anything built so far.

---

## 8. Phased rollout

- **Phase 0 — Foundations — ✅ DONE:** resolved §7/§7a decisions; confirmed AIV vector DB access + capabilities; built the ingestion service and hybrid retrieval service; backfilled 7 platform docs + 26 published catalog assets into the shared index under the `aimplify` namespace. Both Atlas indexes live.
- **Phase 1 — MVP — ✅ DONE, verified end-to-end in the browser:** read-only Q&A over Published catalog + platform docs/taxonomy, available to **all authenticated users**. Direct answers, deep links, "similar/alternative" suggestions, natural small-talk handling, markdown-formatted replies, expand/collapse panel. No submission/pipeline awareness yet (by design — Phase 2). Global floating button + panel, session-only conversation memory.
- **Phase 2 — Personalized & RBAC-aware — 🟡 in progress:** `get_platform_stats()` (v0.15, public aggregate data, RBAC-free) and `get_my_submissions()` (v0.16, RBAC-sensitive — caller's own submissions only, safe by construction) both live. Still to build: a single-submission lookup if needed, and department-scoped admin queries — fully permission-checked per §4.5.
- **Phase 3 — Depth & memory — not started:** persisted conversation history, proactive suggestions, richer multi-turn context, feedback loop (thumbs up/down on answers feeding back into ingestion/prompt tuning).
- **Phase 4 (separate initiative, not this doc's scope):** engineering/codebase-facing assistant for internal dev support.

---

## 9. Touch points in the existing codebase (for implementation planning)

- New: `backend/app/services/knowledge/` — `ingestion_service.py` (builds text+summary+tags+keywords+embedding per §4.2), `aiv_vector_client.py` (talks to the shared AIV vector DB — pattern-matched off `aiv_ideation_service.py`'s Motor client), `retrieval_service.py` (hybrid search + rerank per §4.3), `assistant_agent.py` (orchestrating agent).
- New: `backend/app/routers/assistant.py` — chat endpoint, **plain REST** (corrected — see the WebSocket note above; App Service on this plan doesn't support WebSockets).
- New config: entries alongside the existing `aiv_mongodb_url` / `aiv_mongodb_db_name` / `aiv_ideations_collection` in `config.py` for the AIV vector DB connection + a dedicated `aimplify` collection/index name — shape confirmed final per §7a, implemented as `aimplify_knowledge_collection`, `aimplify_vector_index_name`, `aimplify_search_index_name`, `gemini_embedding_model`, `gemini_embedding_dimensions`.
- Conversation history: not persisted in v1 (§7 decision #4) — no new Postgres tables needed for Phase 0/1.
- Extend: publish/update endpoints in `routers/submissions.py` and `routers/catalog.py` to trigger re-indexing (§5).
- New frontend: `frontend/src/lib/assistantService.ts`, a floating chat widget component (`components/assistant/ChatWidget.tsx`) mounted globally in `MainLayout.tsx` (§7 decision #3).
- Reuse: `deps/rbac.py` dependencies inside every tool-calling function (Phase 2+); `document_reader.py` for architecture-doc text (not yet wired into ingestion — architecture-file text isn't in the v1 chunk builder yet, a good early enhancement); provider-fallback pattern from `services/agents/base.py`, reused via its `_get_llm_configs` helper rather than duplicated.

**See §10 for what has actually been implemented against this plan.**

---

## 10. Implementation log (Phase 0 + Phase 1 MVP)

**Fully built, deployed against the real shared Atlas DB, and verified working end-to-end in the browser** for the decided v1 scope (§7): Published catalog + platform docs only, all authenticated users, global floating widget, session-only conversation. Real conversations have been had against real data (26 catalog assets, 7 platform docs) with markdown-formatted, correctly-linked answers.

### Backend
| File | Purpose |
|---|---|
| `app/config.py` | New settings: `aimplify_knowledge_collection`, `aimplify_vector_index_name`, `aimplify_search_index_name`, `gemini_embedding_model` — reuses existing `aiv_mongodb_url`/`aiv_mongodb_db_name` for the connection (§7a #1). |
| `app/services/knowledge/aiv_vector_client.py` | `AIVVectorClient`-equivalent — Motor client against the shared Mongo cluster. `vector_search()` / `keyword_search()` use `$vectorSearch`/`$search` — **both live and queryable** (both Atlas indexes created and confirmed, §7a #3/#4); still degrade to `[]` on `PyMongoError` rather than crashing if a future index issue arises. `tag_search()` is a plain Mongo query, always works. `list_all()` (v0.11) — a complete, non-ranked fetch (optionally tag-scoped) for genuine "list everything" questions, deliberately bypassing similarity ranking. Every record/query is scoped to `namespace="aimplify"` (§4.4). |
| `app/services/knowledge/llm_helpers.py` | `call_llm_text`/`call_llm_json` (reuses `_get_llm_configs` from `agents/base.py` for Gemini→Groq fallback) and `embed_text` (Gemini `gemini-embedding-001` via `embedContent`, pinned to `outputDimensionality: 768` with `taskType` per call — see §4.8; no Groq fallback for embeddings — Groq has no embeddings API). |
| `app/services/knowledge/ingestion_service.py` | Builds the §4.2 record (text, LLM summary+keywords, structured tags from DB fields, embedding) for a `CatalogAsset`; `index_platform_docs()` indexes the four family taxonomies + 3 workflow explanations (submission pipeline, clone requests, demo requests) as hand-authored docs; `reindex_catalog_asset_by_id()` is the background-task entry point — opens its own DB session, re-checks `status == Published` before indexing (removes from the index instead if not), never raises. |
| `app/services/knowledge/retrieval_service.py` | `hybrid_search()` — query-signal extraction now classifies `small_talk` (short-circuits, v0.9), `list_all` (short-circuits to `aiv_vector_client.list_all()`, v0.11 — wants items), and `platform_stats` (short-circuits to signal "call the live tool," v0.15 — wants a count, disambiguated from `list_all`); otherwise runs vector+tag+keyword search in parallel (`asyncio.gather`), weighted fusion (0.5/0.3/0.2), confidence threshold to flag "no exact match" results per §4.6. |
| `app/services/knowledge/assistant_agent.py` | `answer_question()` — formats retrieved context + short conversation history, one LLM call to produce the conversational, cited, markdown-formatted answer (system prompt asks for `**bold**`/lists/`[link](path)`, to match reply length to the question, to explicitly disclose when it doesn't have AIV ideation-pipeline data rather than silently answering about assets instead (v0.11), and to never imply a partial result set is complete unless `is_complete_list` says so (v0.11)). Short, dedicated prompt path for `small_talk` (no context, no citations, 1-2 sentences). Returns a clear message if the knowledge base isn't configured (missing Mongo/Gemini config) instead of a raw 500. |
| `app/routers/assistant.py` | `POST /assistant/chat` — plain REST (see the WebSocket correction above), open to all three roles per §7 decision #1. |
| `app/routers/submissions.py`, `app/routers/catalog.py` | Publish/update/archive endpoints now fire `reindex_catalog_asset_by_id` / `remove_catalog_asset` as background tasks (§5). |
| `app/main.py` | Lifespan startup now fires `index_platform_docs()` as a background task (v0.13, §5) — a code edit to `_platform_docs()` + backend restart is self-contained; no separate manual backfill needed for platform-doc changes going forward. Never blocks/fails startup. |
| `backend/backfill_knowledge_base.py` | One-time backfill script — indexes all platform docs + every currently-Published `CatalogAsset`. Safe to re-run (upsert by `namespace+source_type+source_id`). |
| `app/services/knowledge/live_tools.py` (Phase 2) | `get_platform_stats()` (v0.15) — live Postgres aggregate counts (total Published/demo-ready/by-family/by-maturity), mirrors `Home.tsx`'s client-side logic, no RBAC needed (public data). `get_my_submissions(user_id)` (v0.16) — the caller's own submissions (title, status, AI score, feedback, link); RBAC-safe by construction since `user_id` only ever comes from the verified JWT, never client input. Both open their own DB session (self-contained, same pattern as `reindex_catalog_asset_by_id`). |
| `app/routers/assistant.py` | Now threads `user_id=str(user.id)` (the server-verified caller) into `answer_question()` — required for `get_my_submissions` to work; this is the only source of truth for whose data gets returned (v0.16). |

### Frontend
| File | Purpose |
|---|---|
| `frontend/src/lib/assistantService.ts` | `sendChatMessage()` — thin wrapper over `POST /assistant/chat`, same `apiClient` convention as the rest of `lib/`. |
| `frontend/src/components/assistant/ChatWidget.tsx` | Floating button (bottom-right) + chat panel, per §6/§7 decisions. Ephemeral, in-component state only — no store, no localStorage. Answer sources render as clickable chips that `navigate()` to the deep link and close the panel. Header has an expand/collapse toggle (compact 380×560 ↔ expanded 560×80vh, added v0.9). Assistant replies render through `react-markdown` with custom component overrides (internal `/catalog/...` links intercepted to use `navigate()` instead of a full page reload; external links open in a new tab); user's own messages stay plain text. |
| `frontend/src/components/layout/MainLayout.tsx` | Mounts `<ChatWidget />` once, inside the authenticated shell — confirmed via `App.tsx` that every authenticated route nests under `MainLayout`, so this satisfies the "global" placement decision without per-page wiring. |
| `frontend/vite.config.ts` | Added `/assistant` to the dev-server proxy allowlist (v0.8 bug fix — see below). |
| `frontend/package.json` | Added `react-markdown` dependency (v0.9). |

### Verified so far
- All new/modified backend files pass `python -m py_compile`; `tsc --noEmit` shows the same 60 pre-existing errors as before any of this work (all in unrelated files) — zero new type errors introduced by any change across v0.5–v0.9.
- `check_knowledge_db.py` confirmed genuine Atlas (§7a #1 ✅), `aimplify_knowledge` as a usable isolated collection (§7a #2 ✅), and plain write/read.
- Local `.env`'s DB confirmed identical to `aimplify-backend-prod`'s (hostname + db name matched without exposing credentials).
- `create_knowledge_indexes.py` created both Atlas indexes; `check_knowledge_db.py` re-run confirmed both **present and queryable** (§7a #3/#4 ✅).
- Found and fixed a real bug during the first backfill attempt: `text-embedding-004` is retired (404) → switched to `gemini-embedding-001` with explicit `outputDimensionality: 768` and `taskType` (RETRIEVAL_DOCUMENT/RETRIEVAL_QUERY).
- `python backfill_knowledge_base.py` completed successfully: **7 platform docs + 26 Published catalog assets indexed, 0 failures.**
- **First real browser test (v0.8/v0.9) succeeded end-to-end** — asked "list out all the assets currently there" and got back a correct, real, linked answer. Found and fixed one bug along the way (Vite proxy missing `/assistant` — see changelog v0.8) and three UX rough edges (expand/collapse, markdown rendering, small-talk brevity — v0.9), all now fixed and type-checked.
- **Not yet done:** re-verifying the three v0.9 UX fixes in the browser (they're implemented and type-check clean, but haven't been re-tested visually yet since the frontend dev server needs restarting to pick up the new dependency); testing the "no exact match / alternative suggestion" path and a longer multi-turn conversation.

### New files
| File | Purpose |
|---|---|
| `backend/check_knowledge_db.py` | One-off diagnostic — Mongo connectivity, Atlas detection, index presence check, throwaway write/read/delete probe. Safe to re-run any time. |
| `backend/create_knowledge_indexes.py` | One-off — creates the vector + full-text Atlas indexes directly via the driver. Safe to re-run (skips cleanly if an index already exists). Already used successfully; shouldn't need to run again unless the indexes are ever dropped. |

### Immediate next steps
1. ~~Get real answers to §7a from the AIV team~~ — resolved directly via diagnostics, all seven items closed out.
2. ~~Create the Atlas indexes~~ — done.
3. ~~Run the backfill~~ — done, 0 failures.
4. ~~First manual browser test~~ — done; found and fixed the Vite proxy bug and the three UX issues in v0.9.
5. ~~Review real conversation transcripts for correctness issues~~ — done; found and fixed the partial-list and ideation-substitution bugs in v0.11 (backend-only change, no frontend/deploy step needed — just restart the backend to pick up `retrieval_service.py`/`assistant_agent.py`/`aiv_vector_client.py`).
6. **Next:** re-test in the browser — retry "get me the list of current ideas present" (should now disclose the ideation-data gap and, if it falls back to assets, show the complete list of 26 rather than 6) and a genuine "list all Forge assets" (should return all Forge assets, not a sample). Then continue exercising: a longer multi-turn conversation, and a question about something genuinely absent from the catalog to confirm the "closest related" framing still works correctly alongside the new "sample, not complete" wording.

## 11. Success metrics (DRAFT — refine once v1 ships)

- % of questions answered with a direct hit vs. "similar alternative" vs. "no knowledge."
- User follow-up rate (proxy for conversational usefulness vs. one-shot lookups).
- Reduction in support/Slack questions that are answerable by the bot (baseline TBD).
- RBAC audit: zero incidents of cross-user/department data exposure via the bot (tracked via the same `ActivityLog` pattern used elsewhere).
