import re

from rank_bm25 import BM25Okapi

_TOKEN = re.compile(r"[a-z0-9]+")

# Terms that carry no discriminating signal in this corpus. Kept deliberately
# tiny -- an aggressive stoplist removes tokens like "not" that change meaning.
_STOP = frozenset(
    """a an and are as at be by for from has have in into is it its of on or
    that the their then there these this to was were will with we our you your""".split()
)


def tokenize(text: str) -> list[str]:
    """Lowercase alphanumeric tokens.

    Deliberately simple and shared by both indexing and querying -- any
    asymmetry between the two silently destroys lexical recall.
    """
    return [t for t in _TOKEN.findall(text.lower()) if t not in _STOP and len(t) > 1]


class LexicalIndex:
    """BM25 over one organization's entries.

    Dense retrieval handles paraphrase but is weak on rare exact tokens --
    service names, error codes, `SEV-1`. BM25 is the opposite. Running both and
    fusing is why hybrid beats either alone.
    """

    def __init__(self) -> None:
        self._bm25: BM25Okapi | None = None
        self._ids: list[str] = []

    def build(self, ids: list[str], texts: list[str]) -> None:
        self._ids = ids
        if not ids:
            self._bm25 = None
            return
        self._bm25 = BM25Okapi([tokenize(t) for t in texts])

    def search(self, query: str, k: int) -> list[tuple[str, float]]:
        if self._bm25 is None:
            return []
        tokens = tokenize(query)
        if not tokens:
            return []
        scores = self._bm25.get_scores(tokens)
        ranked = sorted(
            zip(self._ids, scores), key=lambda pair: pair[1], reverse=True
        )
        # BM25 assigns 0 to documents sharing no query term; keeping them would
        # pad the candidate list with noise that still consumes rerank budget.
        return [(entry_id, float(score)) for entry_id, score in ranked[:k] if score > 0]
