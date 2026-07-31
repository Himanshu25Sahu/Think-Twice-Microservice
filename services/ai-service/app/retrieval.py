import asyncio
import logging
import time
from dataclasses import dataclass, field

from .config import settings
from .embedding import embedder
from .index import index
from .reranker import reranker
from .tracing import span

log = logging.getLogger("ai.retrieval")


@dataclass
class Candidate:
    entry_id: str
    meta: dict
    text: str
    dense_rank: int | None = None
    dense_score: float | None = None
    lexical_rank: int | None = None
    lexical_score: float | None = None
    fused_score: float = 0.0
    rerank_score: float | None = None

    @property
    def score(self) -> float:
        """Final ranking score: reranker output when present, else fusion."""
        return self.rerank_score if self.rerank_score is not None else self.fused_score


@dataclass
class RetrievalResult:
    candidates: list[Candidate]
    timings: dict[str, float] = field(default_factory=dict)
    mode: str = ""


def reciprocal_rank_fusion(
    ranked_lists: list[list[str]], k: int
) -> dict[str, float]:
    """Combine rankings by rank position rather than by score.

    Dense cosine similarity and BM25 produce scores on entirely different,
    unnormalizable scales -- min-max normalizing them is fragile because the
    ranges shift per query. RRF only reads ordinal position, so it sidesteps
    the problem: score = sum over lists of 1 / (k + rank).
    """
    scores: dict[str, float] = {}
    for ranked in ranked_lists:
        for rank, entry_id in enumerate(ranked, start=1):
            scores[entry_id] = scores.get(entry_id, 0.0) + 1.0 / (k + rank)
    return scores


async def retrieve(
    org_id: str,
    query: str,
    limit: int = 10,
    project_id: str | None = None,
    exclude: set[str] | None = None,
    mode: str = "hybrid",
    rerank: bool | None = None,
    rerank_top_n: int | None = None,
    query_vector=None,
) -> RetrievalResult:
    """Run the retrieval pipeline.

    mode: 'dense' | 'lexical' | 'hybrid'. Exposed so the eval harness can
    ablate each stage against the same golden set rather than trusting that
    each addition helped.
    """
    partition = index.partition(org_id)
    if partition is None:
        return RetrievalResult(candidates=[], mode=mode)

    do_rerank = settings.rerank_enabled if rerank is None else rerank
    do_rerank = do_rerank and reranker.ready
    timings: dict[str, float] = {}

    dense_hits: list[tuple[str, float]] = []
    lexical_hits: list[tuple[str, float]] = []

    if mode in ("dense", "hybrid"):
        t0 = time.perf_counter()
        if query_vector is None:
            with span("embed.query"):
                query_vector = await asyncio.to_thread(embedder.embed_query, query)
        timings["embed_ms"] = (time.perf_counter() - t0) * 1000

        t0 = time.perf_counter()
        with span("retrieve.dense"):
            dense_hits = partition.search_dense(
                query_vector, settings.candidate_k, project_id, exclude
            )
        timings["dense_ms"] = (time.perf_counter() - t0) * 1000

    if mode in ("lexical", "hybrid"):
        t0 = time.perf_counter()
        with span("retrieve.lexical"):
            lexical_hits = await asyncio.to_thread(
                partition.search_lexical, query, settings.candidate_k, project_id, exclude
            )
        timings["lexical_ms"] = (time.perf_counter() - t0) * 1000

    # Assemble the candidate pool
    pool: dict[str, Candidate] = {}
    for rank, (entry_id, score) in enumerate(dense_hits, start=1):
        pool[entry_id] = Candidate(
            entry_id=entry_id,
            meta=partition.meta(entry_id),
            text=partition.text(entry_id),
            dense_rank=rank,
            dense_score=score,
        )
    for rank, (entry_id, score) in enumerate(lexical_hits, start=1):
        cand = pool.get(entry_id)
        if cand is None:
            cand = Candidate(
                entry_id=entry_id,
                meta=partition.meta(entry_id),
                text=partition.text(entry_id),
            )
            pool[entry_id] = cand
        cand.lexical_rank = rank
        cand.lexical_score = score

    if not pool:
        return RetrievalResult(candidates=[], timings=timings, mode=mode)

    # Fuse
    t0 = time.perf_counter()
    if mode == "hybrid":
        fused = reciprocal_rank_fusion(
            [[e for e, _ in dense_hits], [e for e, _ in lexical_hits]], settings.rrf_k
        )
    elif mode == "dense":
        fused = {e: 1.0 / (settings.rrf_k + r) for r, (e, _) in enumerate(dense_hits, 1)}
    else:
        fused = {e: 1.0 / (settings.rrf_k + r) for r, (e, _) in enumerate(lexical_hits, 1)}
    for entry_id, value in fused.items():
        pool[entry_id].fused_score = value
    timings["fuse_ms"] = (time.perf_counter() - t0) * 1000

    ordered = sorted(pool.values(), key=lambda c: c.fused_score, reverse=True)

    # Rerank the fused shortlist
    if do_rerank and ordered:
        t0 = time.perf_counter()
        top_n = rerank_top_n or settings.rerank_top_n
        shortlist = ordered[:top_n]
        tail = ordered[top_n:]
        with span("rerank", count=len(shortlist)):
            scores = await asyncio.to_thread(
                reranker.rank, query, [c.text or c.meta.get("title", "") for c in shortlist]
            )
        if scores:
            for cand, score in zip(shortlist, scores):
                cand.rerank_score = float(score)
            # Reranked candidates keep their new order and sit above the
            # un-reranked tail, which stays in fusion order. Dropping the tail
            # instead would cap recall at rerank_top_n.
            ordered = sorted(
                shortlist, key=lambda c: c.rerank_score or 0.0, reverse=True
            ) + tail
        timings["rerank_ms"] = (time.perf_counter() - t0) * 1000

    return RetrievalResult(candidates=ordered[:limit], timings=timings, mode=mode)
