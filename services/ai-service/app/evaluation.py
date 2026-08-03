"""Retrieval evaluation.

Automated tests for a non-deterministic system: without this, "did that change
help?" is a vibe. With it, every retrieval change produces a number against a
fixed golden set, and a regression is visible instead of silent.
"""

import logging
import math
import time

from .config import settings
from .index import index
from .retrieval import retrieve
from .store import store

log = logging.getLogger("ai.eval")

K_VALUES = (1, 3, 5, 10)


def recall_at_k(ranked: list[str], relevant: set[str], k: int) -> float:
    """Did any correct answer make the top k?

    Set-hit rather than proportion-of-relevant-found: a user asking a question
    needs one good answer, not all of them.
    """
    return 1.0 if any(entry_id in relevant for entry_id in ranked[:k]) else 0.0


def reciprocal_rank(ranked: list[str], relevant: set[str]) -> float:
    """1/rank of the first correct answer. Rewards ranking it first, not fifth."""
    for rank, entry_id in enumerate(ranked, start=1):
        if entry_id in relevant:
            return 1.0 / rank
    return 0.0


def ndcg_at_k(ranked: list[str], relevant: set[str], k: int) -> float:
    """Position-discounted gain, normalized by the best achievable ordering.

    Binary relevance here, so ideal DCG is the first min(|relevant|, k) slots
    all filled with correct answers.
    """
    dcg = 0.0
    for rank, entry_id in enumerate(ranked[:k], start=1):
        if entry_id in relevant:
            dcg += 1.0 / math.log2(rank + 1)
    ideal_hits = min(len(relevant), k)
    if ideal_hits == 0:
        return 0.0
    idcg = sum(1.0 / math.log2(rank + 1) for rank in range(1, ideal_hits + 1))
    return dcg / idcg if idcg else 0.0


async def load_golden(org_id: str | None = None, limit: int | None = None) -> list[dict]:
    query = {"orgId": org_id} if org_id else {}
    cursor = store.golden.find(query)
    if limit:
        cursor = cursor.limit(limit)
    return [doc async for doc in cursor]


async def run_config(
    golden: list[dict], mode: str, rerank: bool, limit: int = 10, rerank_top_n: int | None = None
) -> dict:
    """Score one retrieval configuration over the whole golden set."""
    totals = {f"recall@{k}": 0.0 for k in K_VALUES}
    totals["mrr"] = 0.0
    totals["ndcg@10"] = 0.0
    latencies: list[float] = []

    for item in golden:
        relevant = set(item["relevant"])
        started = time.perf_counter()
        result = await retrieve(
            org_id=item["orgId"],
            query=item["question"],
            limit=limit,
            mode=mode,
            rerank=rerank,
            rerank_top_n=rerank_top_n,
        )
        latencies.append((time.perf_counter() - started) * 1000)

        ranked = [c.entry_id for c in result.candidates]
        for k in K_VALUES:
            totals[f"recall@{k}"] += recall_at_k(ranked, relevant, k)
        totals["mrr"] += reciprocal_rank(ranked, relevant)
        totals["ndcg@10"] += ndcg_at_k(ranked, relevant, 10)

    n = max(len(golden), 1)
    metrics = {name: round(value / n, 4) for name, value in totals.items()}
    latencies.sort()
    metrics["p50_ms"] = round(latencies[len(latencies) // 2], 1) if latencies else 0.0
    metrics["p95_ms"] = (
        round(latencies[min(len(latencies) - 1, int(len(latencies) * 0.95))], 1)
        if latencies
        else 0.0
    )
    metrics["questions"] = len(golden)
    return metrics


# The ablation: each row adds one stage to the previous, so the delta between
# consecutive rows is that stage's contribution -- not a claim, a measurement.
ABLATION = [
    ("lexical only (BM25)", "lexical", False, None),
    ("dense only (vector)", "dense", False, None),
    ("hybrid (RRF fusion)", "hybrid", False, None),
    ("hybrid + rerank top-10", "hybrid", True, 10),
    ("hybrid + rerank top-20", "hybrid", True, 20),
    ("hybrid + rerank top-50", "hybrid", True, 50),
]


async def run_ablation(org_id: str | None = None, limit: int | None = None) -> dict:
    golden = await load_golden(org_id, limit)
    if not golden:
        return {"error": "no golden questions found; regenerate the corpus"}

    log.info("running ablation over %d questions", len(golden))
    rows = []
    for label, mode, rerank, top_n in ABLATION:
        started = time.perf_counter()
        metrics = await run_config(golden, mode, rerank, rerank_top_n=top_n)
        metrics["config"] = label
        metrics["took_s"] = round(time.perf_counter() - started, 1)
        rows.append(metrics)
        log.info(
            "%s -> recall@5=%.3f mrr=%.3f p50=%.1fms",
            label,
            metrics["recall@5"],
            metrics["mrr"],
            metrics["p50_ms"],
        )

    return {
        "questions": len(golden),
        "corpus_vectors": index.stats()["vectors"],
        "candidate_k": settings.candidate_k,
        "rrf_k": settings.rrf_k,
        "embedding_model": settings.embedding_model,
        "rerank_model": settings.rerank_model,
        "results": rows,
    }
