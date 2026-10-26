# Chatbot integration

Only the knowledge bot was imported from the knowledge-bot project: the floating
authenticated chat widget, `/assistant/chat`, retrieval and ingestion services,
and explicit index/backfill utilities. Existing authentication, catalog models,
pages and workflows remain the integration's source of truth.

The widget uses the existing authenticated API client. Vite proxies `/assistant`
locally. Publishing, editing or archiving an asset queues a knowledge refresh
after the database commit. Indexing failures are logged without failing the
catalog operation. Platform documentation is indexed in the background at startup
when the required settings exist.

## Configuration

Use backend environment settings; no credentials were copied from the source.

- `AIV_MONGODB_URL` and `AIV_MONGODB_DB_NAME`: MongoDB with write access to the
  dedicated knowledge collection and Atlas Search support.
- `GEMINI_API_KEY`: required for embeddings.
- `GEMINI_MODEL` (or the existing Groq fallback configuration): reply generation.
- Optional `AIMPLIFY_KNOWLEDGE_COLLECTION`, `AIMPLIFY_VECTOR_INDEX_NAME`,
  `AIMPLIFY_SEARCH_INDEX_NAME`, `GEMINI_EMBEDDING_MODEL` and
  `GEMINI_EMBEDDING_DIMENSIONS`: defaults are declared in `app/config.py`.
- `CHATBOT_ENABLED=false` hides the floating chat icon and disables `/assistant/chat`.
  It defaults to `true`; update the backend App Service setting and restart to change it.

From the repository root, explicitly run `python create_knowledge_indexes.py`,
wait for the Atlas indexes to become queryable, then run
`python backfill_knowledge_base.py` to index existing published assets.
These commands modify the configured knowledge collection and were not run as
part of the code merge. Existing indexes must match the configured embedding
dimensions and include the namespace mapping.

## Backend packaging

`build_backend_zip.py` still uses its existing active-backend sources. It adds the
local chatbot files and applies only the chatbot hooks through
`scripts/knowledge_bot_packaging.py`, preserving other backend changes.
The separate active-backend checkout is not modified by this integration.

Run `python -m unittest discover -s tests -p test_knowledge_integration.py` for
the isolated API/authentication and packaging checks. Live answers additionally
require the configured PostgreSQL, MongoDB and model services.
