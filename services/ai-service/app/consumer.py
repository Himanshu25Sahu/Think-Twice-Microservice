import asyncio
import logging

import redis.asyncio as redis

from .config import ENTRY_STREAMS, settings
from .indexer import index_one, remove_one

log = logging.getLogger("ai.consumer")


class EntryConsumer:
    """Consumer group over entry-service's Redis Streams.

    Indexing happens off the write path, so a slow embed or a dead ai-service
    never blocks entry creation. Redis Streams gives at-least-once delivery:
    unacknowledged events survive a crash and are redelivered on restart, and
    the content-hash check in the indexer makes reprocessing a no-op.
    """

    def __init__(self) -> None:
        self._redis: redis.Redis | None = None
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()
        self.processed = 0
        self.failed = 0

    async def connect(self) -> None:
        # socket_timeout must exceed the XREADGROUP block interval, otherwise the
        # client gives up on the socket while the server is still legitimately
        # holding the blocking read open.
        self._redis = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_timeout=(settings.stream_block_ms / 1000) + 10,
        )
        await self._redis.ping()
        for stream in ENTRY_STREAMS:
            try:
                # MKSTREAM so the group can be created before entry-service has
                # ever emitted; '0' so we pick up events already in the stream.
                await self._redis.xgroup_create(
                    stream, settings.consumer_group, id="0", mkstream=True
                )
                log.info("created consumer group on %s", stream)
            except redis.ResponseError as exc:
                if "BUSYGROUP" not in str(exc):
                    raise
        log.info("redis connected: %s", settings.redis_url)

    def start(self) -> None:
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        self._stop.set()
        if self._task is not None:
            await asyncio.wait_for(self._task, timeout=15)
        if self._redis is not None:
            await self._redis.aclose()

    async def _run(self) -> None:
        # Reclaim anything this consumer left unacknowledged before a restart.
        await self._drain_pending()

        streams = {stream: ">" for stream in ENTRY_STREAMS}
        while not self._stop.is_set():
            try:
                response = await self._redis.xreadgroup(
                    settings.consumer_group,
                    settings.consumer_name,
                    streams,
                    count=32,
                    block=settings.stream_block_ms,
                )
                if not response:
                    continue
                for stream_name, messages in response:
                    for message_id, fields in messages:
                        await self._dispatch(stream_name, message_id, fields)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("consumer loop error; backing off")
                await asyncio.sleep(2)

    async def _drain_pending(self) -> None:
        for stream in ENTRY_STREAMS:
            try:
                _, messages, _ = await self._redis.xautoclaim(
                    stream, settings.consumer_group, settings.consumer_name, min_idle_time=0
                )
                for message_id, fields in messages:
                    await self._dispatch(stream, message_id, fields)
                if messages:
                    log.info("replayed %d pending from %s", len(messages), stream)
            except Exception:
                log.exception("failed draining pending on %s", stream)

    async def _dispatch(self, stream: str, message_id: str, fields: dict) -> None:
        entry_id = fields.get("entryId")
        if not entry_id:
            log.warning("%s %s has no entryId; acking", stream, message_id)
            await self._ack(stream, message_id)
            return

        try:
            if stream == "entry:deleted":
                await remove_one(entry_id)
            else:
                await index_one(entry_id)
            self.processed += 1
            await self._ack(stream, message_id)
        except Exception:
            # Deliberately not acked: the event stays pending and is retried on
            # the next restart rather than being silently dropped.
            self.failed += 1
            log.exception("failed handling %s for entry %s", stream, entry_id)

    async def _ack(self, stream: str, message_id: str) -> None:
        await self._redis.xack(stream, settings.consumer_group, message_id)

    async def lag(self) -> dict[str, int]:
        """Pending (delivered but unacknowledged) count per stream."""
        out: dict[str, int] = {}
        for stream in ENTRY_STREAMS:
            try:
                summary = await self._redis.xpending(stream, settings.consumer_group)
                out[stream] = summary["pending"] if summary else 0
            except Exception:
                out[stream] = -1
        return out


consumer = EntryConsumer()
