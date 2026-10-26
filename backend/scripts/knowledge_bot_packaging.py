"""Apply only knowledge-bot integration hooks to existing backend sources.

Used for the local app and for ZIPs assembled from the separate active backend.
Fail closed if an integration point changes, rather than silently omit the bot.
"""
from pathlib import Path


def _replace_once(source: str, old: str, new: str) -> str:
    if source.count(old) != 1:
        raise ValueError(f"Knowledge bot integration point missing or ambiguous: {old!r}")
    return source.replace(old, new, 1)


def integrate(path: str, source: str) -> str:
    if path == "app/config.py":
        if "aimplify_knowledge_collection:" not in source:
            settings = Path(__file__).with_name("knowledge_settings.txt").read_text(encoding="utf-8")
            source = _replace_once(source, "    # App\n", settings + "    # App\n")
    elif path == "app/main.py":
        if "app.include_router(assistant.router)" not in source:
            source = _replace_once(source, "    app.include_router(auth.router)",
                "    from app.routers import assistant\n    app.include_router(assistant.router)\n    app.include_router(auth.router)")
        if "knowledge_task =" not in source:
            source = _replace_once(source, "    yield\n", """    from app.services.knowledge.startup import initialize_knowledge
    knowledge_task = asyncio.create_task(initialize_knowledge())
    yield
    knowledge_task.cancel()
    try:
        await knowledge_task
    except asyncio.CancelledError:
        pass
""")
    elif path in ("app/routers/catalog.py", "app/routers/submissions.py"):
        functions = ["update_catalog_asset", "delete_catalog_asset"] if path.endswith("/catalog.py") else ["publish_submission"]
        for name in functions:
            start = source.index(f"async def {name}(")
            end = source.find("\n@router.", start)
            if end == -1:
                end = len(source)
            part = source[start:end]
            if "reindex_catalog_asset_by_id" in part:
                continue
            parameter = "    body: CatalogAssetUpdate,\n" if name == "update_catalog_asset" else f"    {'submission_id' if name == 'publish_submission' else 'asset_id'}: str,\n"
            part = _replace_once(part, parameter, parameter + "    background_tasks: BackgroundTasks,\n")
            hook = "    from app.services.knowledge.ingestion_service import reindex_catalog_asset_by_id\n    background_tasks.add_task(reindex_catalog_asset_by_id, str(asset.id))\n"
            if name == "update_catalog_asset":
                part = _replace_once(part, "    return _to_response(asset)", "    await db.commit()\n" + hook + "    return _to_response(asset)")
            else:
                part = _replace_once(part, "    await db.commit()\n", "    await db.commit()\n" + hook)
            source = source[:start] + part + source[end:]
    return source


INTEGRATION_FILES = ("app/config.py", "app/main.py", "app/routers/catalog.py", "app/routers/submissions.py")


def add_to_package(entries: dict[str, bytes], repo: str) -> None:
    root = Path(repo)
    files = [root / "app/routers/assistant.py", root / "app/schemas/assistant.py"]
    files.extend(sorted((root / "app/services/knowledge").glob("*.py")))
    files.extend(root / name for name in ("backfill_knowledge_base.py", "create_knowledge_indexes.py"))
    for file in files:
        entries[file.relative_to(root).as_posix()] = file.read_bytes()
    for path in INTEGRATION_FILES:
        entries[path] = integrate(path, entries[path].decode("utf-8").replace("\r\n", "\n")).encode("utf-8")
