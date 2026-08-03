import asyncio
import logging

from .cache import cache
from .config import settings
from .embedding import embedder
from .index import index
from .store import pack, store, unpack
from .text import compose_text, content_hash, snippet

log = logging.getLogger("ai.indexer")


def _meta(entry: dict) -> dict:
    return {
        "title": entry.get("title", ""),
        "type": entry.get("type", ""),
        "projectId": str(entry.get("projectId", "")),
        "orgId": str(entry.get("orgId", "")),
        "authorName": entry.get("authorName", ""),
        "tags": entry.get("tags", []) or [],
        "snippet": snippet(entry),
        "createdAt": entry.get("createdAt"),
    }


async def index_entries(entries: list[dict], known_hashes: dict[str, str] | None = None) -> dict:
    """Embed and store a batch of entries.

    Entries whose composed text is unchanged are skipped without re-embedding,
    which is what makes replaying a stream or re-running backfill cheap.
    """
    known_hashes = known_hashes if known_hashes is not None else {}
    pending: list[tuple[dict, str, str]] = []
    skipped = 0

    for entry in entries:
        entry_id = str(entry["_id"])
        text = compose_text(entry)
        if not text.strip():
            log.warning("entry %s has no indexable text", entry_id)
            continue
        digest = content_hash(text, settings.embedding_model)
        if known_hashes.get(entry_id) == digest:
            skipped += 1
            continue
        pending.append((entry, text, digest))

    if not pending:
        return {"indexed": 0, "skipped": skipped}

    # Batch embedding is the slow part; keep it off the event loop so the API
    # stays responsive while a backfill runs.
    vectors = await asyncio.to_thread(
        embedder.embed_documents, [text for _, text, _ in pending]
    )

    records = []
    for (entry, text, digest), vector in zip(pending, vectors):
        entry_id = str(entry["_id"])
        meta = _meta(entry)
        records.append(
            {
                "_id": entry_id,
                "orgId": meta["orgId"],
                "projectId": meta["projectId"],
                "title": meta["title"],
                "type": meta["type"],
                "tags": meta["tags"],
                "authorName": meta["authorName"],
                "snippet": meta["snippet"],
                # Stored so BM25 and RAG context can be rebuilt at boot without
                # reaching back into entry-service's collection.
                "text": text,
                "model": settings.embedding_model,
                "dim": int(vector.shape[0]),
                "hash": digest,
                "vector": pack(vector),
            }
        )
        index.upsert(entry_id, meta["orgId"], vector, meta, text)

    await store.upsert_many(records)

    # Cached answers were grounded in an index that has now changed; keeping
    # them would serve stale citations for content that has since moved.
    for org_id in {r["orgId"] for r in records}:
        cache.invalidate(org_id)

    return {"indexed": len(records), "skipped": skipped}


async def index_one(entry_id: str) -> bool:
    entry = await store.fetch_entry(entry_id)
    if entry is None:
        # The entry was deleted between the event being emitted and consumed.
        # Drop any stale vector rather than leaving a phantom search result.
        await remove_one(entry_id)
        return False
    existing = await store.vectors.find_one({"_id": entry_id}, {"hash": 1})
    known = {entry_id: existing["hash"]} if existing and "hash" in existing else {}
    result = await index_entries([entry], known)
    return result["indexed"] > 0


async def remove_one(entry_id: str) -> bool:
    index.remove(entry_id)
    cache.invalidate()
    return await store.delete(entry_id)


async def warm_index() -> int:
    """Rebuild the in-memory index from stored vectors at startup."""
    index.clear()
    docs = await store.load_all()
    for doc in docs:
        vector = unpack(doc["vector"])
        meta = {
            "title": doc.get("title", ""),
            "type": doc.get("type", ""),
            "projectId": doc.get("projectId", ""),
            "orgId": doc.get("orgId", ""),
            "authorName": doc.get("authorName", ""),
            "tags": doc.get("tags", []),
            "snippet": doc.get("snippet", ""),
        }
        index.upsert(doc["_id"], doc.get("orgId", ""), vector, meta, doc.get("text", ""))
    log.info("index warmed with %d vectors", len(docs))
    return len(docs)
