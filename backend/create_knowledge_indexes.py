"""Create the chatbot Atlas indexes using the configured MongoDB settings.
Run from the repository root after configuring the backend environment.
Index creation is explicit and is never performed during app startup.
"""

import asyncio
import sys


async def main() -> None:
    from app.config import get_settings, load_secrets
    from motor.motor_asyncio import AsyncIOMotorClient
    from pymongo.operations import SearchIndexModel
    from pymongo.errors import OperationFailure

    settings = get_settings()
    await load_secrets(settings)
    if not settings.aiv_mongodb_url or not settings.aiv_mongodb_db_name:
        print("FAIL: AIV_MONGODB_URL / AIV_MONGODB_DB_NAME (or MONGODB_URL / MONGODB_DB_NAME) not set.")
        sys.exit(1)

    client = AsyncIOMotorClient(settings.aiv_mongodb_url, serverSelectionTimeoutMS=10000)
    collection = client[settings.aiv_mongodb_db_name][settings.aimplify_knowledge_collection]

    print("=" * 70)
    print("Creating Aimplify Knowledge Bot search indexes")
    print(f"DB: {settings.aiv_mongodb_db_name}  Collection: {settings.aimplify_knowledge_collection}")
    print("=" * 70)

    vector_index = SearchIndexModel(
        name=settings.aimplify_vector_index_name,
        type="vectorSearch",
        definition={
            "fields": [
                {
                    "type": "vector",
                    "path": "embedding",
                    "numDimensions": settings.gemini_embedding_dimensions,
                    "similarity": "cosine",
                },
                # Filterable so every query can be hard-scoped to namespace="aimplify",
                # keeping this fully separate from AIV's own ideation data.
                {"type": "filter", "path": "namespace"},
            ]
        },
    )

    search_index = SearchIndexModel(
        name=settings.aimplify_search_index_name,
        type="search",
        definition={
            "mappings": {
                "dynamic": False,
                "fields": {
                    "namespace": {"type": "token"},
                    "text": {"type": "string"},
                    "summary": {"type": "string"},
                    "keywords": {"type": "string"},
                    "title": {"type": "string"},
                },
            }
        },
    )

    for label, model in (("vector search", vector_index), ("full-text search", search_index)):
        try:
            name = await collection.create_search_index(model)
            print(f"[OK]   Created {label} index '{name}'. Build is async — not queryable immediately.")
        except OperationFailure as exc:
            if "already exists" in str(exc).lower() or "IndexAlreadyExists" in str(exc):
                print(f"[SKIP] {label} index '{model.document['name']}' already exists — nothing to do.")
            else:
                print(f"[FAIL] Could not create {label} index: {exc}")
        except Exception as exc:  # noqa: BLE001
            print(f"[FAIL] Unexpected error creating {label} index: {exc}")

    print()
    print("Done. Index builds run asynchronously on Atlas — wait a minute or two, then run:")
    print("    Check index readiness in Atlas before running backfill_knowledge_base.py")
    print("to confirm both indexes report as present and queryable.")


if __name__ == "__main__":
    asyncio.run(main())
