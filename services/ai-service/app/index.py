import logging

import numpy as np

from .lexical import LexicalIndex

log = logging.getLogger("ai.index")


class Partition:
    """One organization's searchable content.

    Partitioning by orgId is the tenant boundary: a query can only ever touch
    the structures belonging to its own org, so cross-tenant leakage is
    structurally impossible rather than dependent on remembering a filter.
    """

    def __init__(self) -> None:
        self._vectors: dict[str, np.ndarray] = {}
        self._meta: dict[str, dict] = {}
        self._texts: dict[str, str] = {}
        self._ids: list[str] = []
        self._matrix: np.ndarray | None = None
        self._projects: np.ndarray | None = None
        self._lexical = LexicalIndex()
        self._dirty = True

    def upsert(self, entry_id: str, vector: np.ndarray, meta: dict, text: str = "") -> None:
        self._vectors[entry_id] = vector
        self._meta[entry_id] = meta
        self._texts[entry_id] = text
        self._dirty = True

    def remove(self, entry_id: str) -> bool:
        existed = self._vectors.pop(entry_id, None) is not None
        self._meta.pop(entry_id, None)
        self._texts.pop(entry_id, None)
        if existed:
            self._dirty = True
        return existed

    def __len__(self) -> int:
        return len(self._vectors)

    def meta(self, entry_id: str) -> dict:
        return self._meta.get(entry_id, {})

    def text(self, entry_id: str) -> str:
        return self._texts.get(entry_id, "")

    def _rebuild(self) -> None:
        # Runs synchronously, so it cannot interleave with a search on the
        # event loop -- no lock required.
        self._ids = list(self._vectors.keys())
        if self._ids:
            self._matrix = np.vstack([self._vectors[i] for i in self._ids])
            self._projects = np.array(
                [self._meta[i].get("projectId", "") for i in self._ids], dtype=object
            )
            self._lexical.build(self._ids, [self._texts.get(i, "") for i in self._ids])
        else:
            self._matrix = None
            self._projects = None
            self._lexical.build([], [])
        self._dirty = False

    def _ensure(self) -> None:
        if self._dirty:
            self._rebuild()

    def search_dense(
        self,
        query: np.ndarray,
        k: int,
        project_id: str | None = None,
        exclude: set[str] | None = None,
        min_score: float = 0.0,
    ) -> list[tuple[str, float]]:
        self._ensure()
        if self._matrix is None:
            return []

        # Vectors are L2-normalized at write time, so this dot product is exactly
        # cosine similarity. Exact search: at this corpus size an ANN index adds
        # operational cost and recall loss for no measurable latency win.
        scores = self._matrix @ query

        if project_id:
            scores = np.where(self._projects == project_id, scores, -np.inf)
        if exclude:
            for idx, entry_id in enumerate(self._ids):
                if entry_id in exclude:
                    scores[idx] = -np.inf

        k = min(k, len(self._ids))
        if k <= 0:
            return []

        # argpartition finds the top-k without fully sorting n elements.
        top = np.argpartition(-scores, k - 1)[:k]
        top = top[np.argsort(-scores[top])]

        out = []
        for idx in top:
            score = float(scores[idx])
            if score == -np.inf or score < min_score:
                continue
            out.append((self._ids[idx], score))
        return out

    def search_lexical(
        self,
        query: str,
        k: int,
        project_id: str | None = None,
        exclude: set[str] | None = None,
    ) -> list[tuple[str, float]]:
        self._ensure()
        # Over-fetch when filtering, since filters are applied after scoring and
        # would otherwise silently shrink the candidate list.
        fetch = k * 5 if (project_id or exclude) else k
        results = self._lexical.search(query, fetch)

        out = []
        for entry_id, score in results:
            if exclude and entry_id in exclude:
                continue
            if project_id and self._meta.get(entry_id, {}).get("projectId") != project_id:
                continue
            out.append((entry_id, score))
            if len(out) >= k:
                break
        return out


class VectorIndex:
    def __init__(self) -> None:
        self._partitions: dict[str, Partition] = {}

    def upsert(self, entry_id: str, org_id: str, vector: np.ndarray, meta: dict, text: str = "") -> None:
        # An entry can move between projects but never between orgs; drop any
        # stale copy so a moved entry cannot be found under two partitions.
        for org, partition in self._partitions.items():
            if org != org_id:
                partition.remove(entry_id)
        self._partitions.setdefault(org_id, Partition()).upsert(entry_id, vector, meta, text)

    def remove(self, entry_id: str) -> bool:
        removed = any(p.remove(entry_id) for p in self._partitions.values())
        # Drop partitions that no longer hold anything, so an emptied org does
        # not linger in /ai/stats.
        for org in [o for o, p in self._partitions.items() if len(p) == 0]:
            del self._partitions[org]
        return removed

    def partition(self, org_id: str) -> Partition | None:
        return self._partitions.get(org_id)

    def stats(self) -> dict:
        return {
            "organizations": len(self._partitions),
            "vectors": sum(len(p) for p in self._partitions.values()),
            "per_org": {org: len(p) for org, p in self._partitions.items()},
        }

    def clear(self) -> None:
        self._partitions.clear()


index = VectorIndex()
