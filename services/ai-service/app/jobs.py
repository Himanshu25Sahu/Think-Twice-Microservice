import asyncio
import logging
import time

from .index import index
from .indexer import index_entries
from .store import store

log = logging.getLogger("ai.jobs")

# Entries embedded per chunk. Small enough that the event loop gets control back
# frequently (so /ai/search stays responsive during a backfill), large enough
# that batching still amortises model overhead.
CHUNK = 200


class ReindexJob:
    """Background backfill with pollable progress.

    Embedding thousands of entries inside a request would block the connection
    for minutes and time out at the gateway. Running it as a task means the
    caller polls instead of waiting.
    """

    def __init__(self) -> None:
        self.state = "idle"  # idle | running | done | failed
        self.processed = 0
        self.total = 0
        self.indexed = 0
        self.skipped = 0
        self.pruned = 0
        self.error: str | None = None
        self.started_at: float | None = None
        self.finished_at: float | None = None
        self._task: asyncio.Task | None = None

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    def start(self) -> bool:
        if self.running:
            return False
        self.state = "running"
        self.processed = self.indexed = self.skipped = self.pruned = 0
        self.error = None
        self.started_at = time.time()
        self.finished_at = None
        self._task = asyncio.create_task(self._run())
        return True

    async def _run(self) -> None:
        try:
            self.total = await store.source_entries.count_documents(
                {"status": {"$ne": "archived"}}
            )
            known = await store.existing_hashes()

            seen: set[str] = set()
            batch: list[dict] = []
            async for entry in store.iter_entries():
                seen.add(str(entry["_id"]))
                batch.append(entry)
                if len(batch) >= CHUNK:
                    await self._flush(batch, known)
                    batch = []
            if batch:
                await self._flush(batch, known)

            # Drop vectors whose entry no longer exists. A missed entry:deleted
            # event, or a source wipe, would otherwise leave phantom results
            # that are unreachable but still rank in search.
            orphans = [entry_id for entry_id in known if entry_id not in seen]
            for entry_id in orphans:
                index.remove(entry_id)
            if orphans:
                await store.vectors.delete_many({"_id": {"$in": orphans}})
                self.pruned = len(orphans)

            self.state = "done"
            log.info(
                "reindex complete: %d indexed, %d skipped, %d pruned",
                self.indexed,
                self.skipped,
                self.pruned,
            )
        except Exception as exc:
            self.state = "failed"
            self.error = str(exc)
            log.exception("reindex failed")
        finally:
            self.finished_at = time.time()

    async def _flush(self, batch: list[dict], known: dict[str, str]) -> None:
        result = await index_entries(batch, known)
        self.indexed += result["indexed"]
        self.skipped += result["skipped"]
        self.processed += len(batch)
        log.info("reindex progress %d/%d", self.processed, self.total)
        # Yield so search requests and the stream consumer are not starved
        # while a long backfill runs.
        await asyncio.sleep(0)

    def status(self) -> dict:
        elapsed = None
        if self.started_at is not None:
            end = self.finished_at or time.time()
            elapsed = round(end - self.started_at, 2)
        rate = None
        if elapsed and self.processed:
            rate = round(self.processed / elapsed, 1)
        return {
            "state": self.state,
            "processed": self.processed,
            "total": self.total,
            "indexed": self.indexed,
            "skipped": self.skipped,
            "pruned": self.pruned,
            "elapsed_s": elapsed,
            "entries_per_s": rate,
            "error": self.error,
            "index": index.stats(),
        }


reindex_job = ReindexJob()
