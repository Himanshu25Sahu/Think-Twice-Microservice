import asyncio
import logging
import time

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .cache import cache
from .chat import answer as generate_answer
from .config import settings
from .consumer import consumer
from .embedding import embedder
from .evaluation import run_ablation
from .index import index
from .indexer import warm_index
from .jobs import reindex_job
from .llm import provider
from .reranker import reranker
from .retrieval import retrieve
from .store import store
from .text import compose_text
from .tracing import span

log = logging.getLogger("ai.routes")

router = APIRouter()


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    limit: int = Field(default=10, ge=1, le=50)
    project_id: str | None = Field(default=None, alias="projectId")
    mode: str = Field(default="hybrid", pattern="^(dense|lexical|hybrid)$")
    rerank: bool | None = None

    class Config:
        populate_by_name = True


class SimilarRequest(BaseModel):
    title: str = ""
    what: str = ""
    why: str = ""
    entry_id: str | None = Field(default=None, alias="entryId")
    limit: int = Field(default=5, ge=1, le=20)
    project_id: str | None = Field(default=None, alias="projectId")
    min_score: float = Field(default=0.45, ge=-1.0, le=1.0)

    class Config:
        populate_by_name = True


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    limit: int = Field(default=5, ge=1, le=10)
    project_id: str | None = Field(default=None, alias="projectId")

    class Config:
        populate_by_name = True


def _require_org(org_id: str | None) -> str:
    # Tenant scope comes from the gateway-verified header, never the body, so a
    # client cannot ask for another org's results.
    if not org_id:
        raise HTTPException(status_code=400, detail="x-org-id header is required")
    return org_id


def _hits(candidates) -> list[dict]:
    return [
        {
            "entry_id": c.entry_id,
            "score": round(c.score, 4),
            "title": c.meta.get("title", ""),
            "type": c.meta.get("type", ""),
            "snippet": c.meta.get("snippet", ""),
            "tags": c.meta.get("tags", []) or [],
            "author_name": c.meta.get("authorName", ""),
            "project_id": c.meta.get("projectId", ""),
            "signals": {
                "dense_rank": c.dense_rank,
                "lexical_rank": c.lexical_rank,
                "rerank_score": round(c.rerank_score, 4) if c.rerank_score is not None else None,
            },
        }
        for c in candidates
    ]


@router.post("/ai/search")
async def search(body: SearchRequest, x_org_id: str | None = Header(default=None)):
    org_id = _require_org(x_org_id)
    started = time.perf_counter()

    # Interactive search defaults to fusion only. Measured on 200 golden
    # questions, reranking buys +5.5pp Recall@1 for ~11x the latency
    # (58ms -> 665ms p50) -- not a trade worth making for search-as-you-type.
    # Callers can opt in explicitly, and /ai/chat does, since there the LLM
    # dominates the response time anyway.
    result = await retrieve(
        org_id=org_id,
        query=body.query,
        limit=body.limit,
        project_id=body.project_id,
        mode=body.mode,
        rerank=body.rerank if body.rerank is not None else False,
    )

    return {
        "success": True,
        "query": body.query,
        "mode": result.mode,
        "count": len(result.candidates),
        "took_ms": round((time.perf_counter() - started) * 1000, 2),
        "timings": {k: round(v, 2) for k, v in result.timings.items()},
        "results": _hits(result.candidates),
    }


@router.post("/ai/similar")
async def similar(body: SimilarRequest, x_org_id: str | None = Header(default=None)):
    org_id = _require_org(x_org_id)
    started = time.perf_counter()

    if body.entry_id:
        entry = await store.fetch_entry(body.entry_id)
        if entry is None or str(entry.get("orgId", "")) != org_id:
            # Do not confirm existence across a tenant boundary.
            raise HTTPException(status_code=404, detail="entry not found")
        text = compose_text(entry)
    else:
        text = compose_text({"title": body.title, "what": body.what, "why": body.why})

    if not text.strip():
        return {"success": True, "count": 0, "took_ms": 0.0, "results": []}

    # Duplicate detection compares a draft against existing entries, which is a
    # document-to-document match: dense similarity is the right signal, and the
    # score is directly interpretable as a threshold in the UI.
    vector = await asyncio.to_thread(embedder.embed_query, text)
    partition = index.partition(org_id)
    raw = (
        partition.search_dense(
            vector,
            body.limit,
            body.project_id,
            {body.entry_id} if body.entry_id else None,
            body.min_score,
        )
        if partition
        else []
    )

    results = [
        {
            "entry_id": entry_id,
            "score": round(score, 4),
            **{
                key: partition.meta(entry_id).get(src, default)
                for key, src, default in (
                    ("title", "title", ""),
                    ("type", "type", ""),
                    ("snippet", "snippet", ""),
                    ("author_name", "authorName", ""),
                    ("project_id", "projectId", ""),
                )
            },
            "tags": partition.meta(entry_id).get("tags", []) or [],
        }
        for entry_id, score in raw
    ]

    return {
        "success": True,
        "count": len(results),
        "took_ms": round((time.perf_counter() - started) * 1000, 2),
        "results": results,
    }


@router.post("/ai/chat")
async def chat(body: ChatRequest, x_org_id: str | None = Header(default=None)):
    org_id = _require_org(x_org_id)
    started = time.perf_counter()

    with span("embed.query"):
        query_vector = await asyncio.to_thread(embedder.embed_query, body.question)

    cached = cache.get(org_id, body.project_id, query_vector)
    if cached is not None:
        return {
            **cached,
            "cached": True,
            "took_ms": round((time.perf_counter() - started) * 1000, 2),
        }

    result = await retrieve(
        org_id=org_id,
        query=body.question,
        limit=body.limit,
        project_id=body.project_id,
        mode="hybrid",
        rerank=True,
        query_vector=query_vector,
    )
    payload = await generate_answer(body.question, result.candidates)
    payload["success"] = True
    payload["retrieval_ms"] = {k: round(v, 2) for k, v in result.timings.items()}

    # Only cache real generations. Caching a degraded answer would keep serving
    # it after the model comes back.
    if payload.get("generated"):
        cache.put(org_id, body.project_id, query_vector, payload)

    return {
        **payload,
        "cached": False,
        "took_ms": round((time.perf_counter() - started) * 1000, 2),
    }


@router.post("/ai/reindex")
async def reindex():
    """Start a backfill of every entry. Poll GET /ai/reindex for progress."""
    if not reindex_job.start():
        return {
            "success": False,
            "message": "reindex already running",
            "status": reindex_job.status(),
        }
    return {"success": True, "message": "reindex started", "status": reindex_job.status()}


@router.get("/ai/reindex")
async def reindex_status():
    return {"success": True, "status": reindex_job.status()}


@router.post("/ai/warm")
async def warm():
    count = await warm_index()
    cache.invalidate()
    return {"success": True, "loaded": count, "index": index.stats()}


@router.post("/ai/evaluate")
async def evaluate(limit: int | None = None, org_id: str | None = None):
    """Run the retrieval ablation over the golden set.

    Synchronous on purpose: it is an operator/CI action, and the caller wants
    the table back.
    """
    return {"success": True, **await run_ablation(org_id, limit)}


@router.get("/ai/stats")
async def stats():
    return {
        "success": True,
        "index": index.stats(),
        "consumer": {
            "processed": consumer.processed,
            "failed": consumer.failed,
            "pending": await consumer.lag(),
        },
        "cache": cache.stats(),
        "llm": {
            "provider": provider.name,
            "model": settings.ollama_model if provider.name == "ollama" else None,
            "reachable": await provider.available(),
            "circuit": provider.breaker.status(),
        },
        "rerank": {"enabled": settings.rerank_enabled, "loaded": reranker.ready},
    }


@router.get("/health")
async def health():
    return {
        "success": True,
        "status": "ok",
        "service": "ai-service",
        "model_loaded": embedder.ready,
        "reranker_loaded": reranker.ready,
        "vectors": index.stats()["vectors"],
    }
