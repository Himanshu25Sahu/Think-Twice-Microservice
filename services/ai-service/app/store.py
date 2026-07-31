import logging

import numpy as np
from bson import Binary, ObjectId
from pymongo import AsyncMongoClient, UpdateOne

from .config import settings

log = logging.getLogger("ai.store")

VECTORS = "entry_vectors"
ENTRIES = "entries"


def pack(vector: np.ndarray) -> Binary:
    """float32 bytes rather than a BSON array of doubles: 4x smaller on disk
    and the layout $vectorSearch expects if we ever move to an ANN index."""
    return Binary(np.asarray(vector, dtype=np.float32).tobytes())


def unpack(blob: bytes) -> np.ndarray:
    return np.frombuffer(blob, dtype=np.float32)


class Store:
    def __init__(self) -> None:
        self._client: AsyncMongoClient | None = None

    async def connect(self) -> None:
        self._client = AsyncMongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=10000)
        await self._client.admin.command("ping")
        await self.vectors.create_index([("orgId", 1), ("projectId", 1)])
        log.info("mongo connected: %s", settings.mongodb_uri)

    async def close(self) -> None:
        if self._client is not None:
            await self._client.close()

    @property
    def vectors(self):
        return self._client[settings.ai_db][VECTORS]

    @property
    def golden(self):
        """Evaluation questions with their ground-truth relevant entry ids."""
        return self._client[settings.ai_db]["eval_golden"]

    @property
    def source_entries(self):
        """Read-only view of entry-service's collection.

        Entry events are notifications (ids only), not state transfer, so the
        indexer hydrates content here. The alternative -- a fatter event payload
        or an internal read API on entry-service -- avoids reaching across a
        service boundary but is more moving parts than this phase needs.
        """
        return self._client[settings.entries_db][ENTRIES]

    async def fetch_entry(self, entry_id: str) -> dict | None:
        try:
            oid = ObjectId(entry_id)
        except Exception:
            log.warning("malformed entry id: %s", entry_id)
            return None
        return await self.source_entries.find_one({"_id": oid})

    async def iter_entries(self, batch_size: int = 200):
        """Stream published entries for backfill without loading them all."""
        cursor = self.source_entries.find({"status": {"$ne": "archived"}}).batch_size(batch_size)
        async for doc in cursor:
            yield doc

    async def existing_hashes(self) -> dict[str, str]:
        """entryId -> content hash, so backfill can skip unchanged entries."""
        out: dict[str, str] = {}
        async for doc in self.vectors.find({}, {"hash": 1}):
            out[doc["_id"]] = doc.get("hash", "")
        return out

    async def upsert_many(self, records: list[dict]) -> int:
        if not records:
            return 0
        ops = [UpdateOne({"_id": r["_id"]}, {"$set": r}, upsert=True) for r in records]
        result = await self.vectors.bulk_write(ops, ordered=False)
        return result.upserted_count + result.modified_count

    async def delete(self, entry_id: str) -> bool:
        result = await self.vectors.delete_one({"_id": entry_id})
        return result.deleted_count > 0

    async def load_all(self) -> list[dict]:
        """Read every stored vector so the in-memory index can be rebuilt.

        The index is a cache, not the source of truth -- it is reconstructed
        from Mongo on every boot.
        """
        return [doc async for doc in self.vectors.find({})]


store = Store()
