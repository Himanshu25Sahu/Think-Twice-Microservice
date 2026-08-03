import logging
import time

import numpy as np

from .config import settings

log = logging.getLogger("ai.cache")


class SemanticCache:
    """Cache keyed by meaning rather than exact string.

    "how do we do migrations" and "what's our migration process" are different
    strings but the same question. An exact-match cache never hits on them; a
    similarity threshold over the query embedding does.

    The threshold is deliberately high (0.97). A loose threshold serves the
    wrong answer to a subtly different question, which is far worse than a miss.
    """

    def __init__(self) -> None:
        self._vectors: list[np.ndarray] = []
        self._keys: list[tuple[str, str | None]] = []  # (org_id, project_id)
        self._values: list[dict] = []
        self._created: list[float] = []
        self.hits = 0
        self.misses = 0

    def _matrix(self) -> np.ndarray | None:
        if not self._vectors:
            return None
        return np.vstack(self._vectors)

    def get(self, org_id: str, project_id: str | None, query_vector: np.ndarray) -> dict | None:
        if not settings.cache_enabled:
            return None
        matrix = self._matrix()
        if matrix is None:
            self.misses += 1
            return None

        scores = matrix @ query_vector
        # Never serve across a tenant boundary, however similar the question.
        for idx in np.argsort(-scores):
            if scores[idx] < settings.cache_similarity:
                break
            if self._keys[idx] == (org_id, project_id):
                self.hits += 1
                return self._values[idx]
        self.misses += 1
        return None

    def put(self, org_id: str, project_id: str | None, query_vector: np.ndarray, value: dict) -> None:
        if not settings.cache_enabled:
            return
        self._vectors.append(query_vector)
        self._keys.append((org_id, project_id))
        self._values.append(value)
        self._created.append(time.time())
        if len(self._vectors) > settings.cache_max_entries:
            # FIFO eviction: simple, and the working set of questions in a
            # session is small enough that recency approximates usefulness.
            self._vectors.pop(0)
            self._keys.pop(0)
            self._values.pop(0)
            self._created.pop(0)

    def invalidate(self, org_id: str | None = None) -> int:
        """Drop cached answers. Called when the index changes underneath them."""
        if org_id is None:
            dropped = len(self._vectors)
            self._vectors.clear()
            self._keys.clear()
            self._values.clear()
            self._created.clear()
            return dropped

        keep = [i for i, key in enumerate(self._keys) if key[0] != org_id]
        dropped = len(self._vectors) - len(keep)
        self._vectors = [self._vectors[i] for i in keep]
        self._keys = [self._keys[i] for i in keep]
        self._values = [self._values[i] for i in keep]
        self._created = [self._created[i] for i in keep]
        return dropped

    def stats(self) -> dict:
        total = self.hits + self.misses
        return {
            "enabled": settings.cache_enabled,
            "entries": len(self._vectors),
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": round(self.hits / total, 3) if total else 0.0,
            "similarity_threshold": settings.cache_similarity,
        }


cache = SemanticCache()
