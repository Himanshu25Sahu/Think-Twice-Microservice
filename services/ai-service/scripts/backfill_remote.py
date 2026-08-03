"""Build the vector index offline, against any MongoDB.

Embedding is CPU-bound. On a small hosted instance it saturates the available
fraction of a core, the platform's health check times out, and the container is
restarted mid-run -- so the index never finishes building.

Indexing is a batch job, not a request, and nothing requires it to happen on the
serving box. This runs the same pipeline on whatever machine you point it from
and writes the vectors straight to the target database. The service then only
has to load them (POST /ai/warm), which is cheap.

Usage:
    MONGODB_URI=<target> python -m scripts.backfill_remote [--limit N]
"""

import argparse
import asyncio
import time

from app.config import settings
from app.embedding import embedder
from app.indexer import index_entries
from app.store import store

BATCH = 100


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="stop after N entries")
    parser.add_argument("--batch", type=int, default=BATCH)
    args = parser.parse_args()

    print(f"target: {settings.mongodb_uri.split('@')[-1]}")
    print(f"databases: entries={settings.entries_db} vectors={settings.ai_db}")

    await asyncio.to_thread(embedder.load)
    await store.connect()

    total = await store.source_entries.count_documents({"status": {"$ne": "archived"}})
    print(f"entries to consider: {total}")

    known = await store.existing_hashes()
    print(f"already indexed: {len(known)}")

    started = time.perf_counter()
    processed = indexed = skipped = 0
    batch: list[dict] = []

    async for entry in store.iter_entries():
        batch.append(entry)
        if len(batch) >= args.batch:
            result = await index_entries(batch, known)
            indexed += result["indexed"]
            skipped += result["skipped"]
            processed += len(batch)
            batch = []
            rate = processed / max(time.perf_counter() - started, 0.001)
            print(f"  {processed}/{total}  indexed={indexed} skipped={skipped}  {rate:.1f}/s", flush=True)
        if args.limit and processed >= args.limit:
            break

    if batch and not (args.limit and processed >= args.limit):
        result = await index_entries(batch, known)
        indexed += result["indexed"]
        skipped += result["skipped"]
        processed += len(batch)

    elapsed = time.perf_counter() - started
    stored = await store.vectors.count_documents({})
    print(f"\ndone in {elapsed:.0f}s — indexed={indexed} skipped={skipped}")
    print(f"vectors now stored: {stored}")
    print("next: POST /ai/warm on the service so it loads them into memory")

    await store.close()


if __name__ == "__main__":
    asyncio.run(main())
