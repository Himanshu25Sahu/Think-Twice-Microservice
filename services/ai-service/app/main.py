import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .config import settings
from .consumer import consumer
from .embedding import embedder
from .indexer import warm_index
from .reranker import reranker
from .routes import router
from .tracing import instrument_app, setup as setup_tracing

logging.basicConfig(
    level=settings.log_level,
    format="[AI] %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("ai.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from .store import store

    setup_tracing()

    # Model loads are CPU-bound and take seconds; keep them off the loop so the
    # health endpoint can answer during startup.
    await asyncio.to_thread(embedder.load)
    await asyncio.to_thread(reranker.load)

    await store.connect()
    await warm_index()

    await consumer.connect()
    consumer.start()
    log.info("ai-service ready on port %s", settings.port)

    yield

    log.info("shutting down")
    await consumer.stop()
    await store.close()


app = FastAPI(
    title="Think Twice AI Service",
    version="0.2.0",
    lifespan=lifespan,
)
app.include_router(router)
instrument_app(app)
