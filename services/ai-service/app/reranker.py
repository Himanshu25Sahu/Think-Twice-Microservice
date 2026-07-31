import logging

from fastembed.rerank.cross_encoder import TextCrossEncoder

from .config import settings

log = logging.getLogger("ai.reranker")


class Reranker:
    """Cross-encoder reranking of retrieved candidates.

    A bi-encoder embeds query and document independently, so documents can be
    precomputed -- fast, but the two never "see" each other. A cross-encoder
    scores the pair jointly and is markedly more accurate, at the cost of one
    forward pass per pair. That is why it runs over ~50 candidates rather than
    the whole corpus.
    """

    def __init__(self) -> None:
        self._model: TextCrossEncoder | None = None

    def load(self) -> None:
        if not settings.rerank_enabled:
            log.info("reranking disabled")
            return
        log.info("loading reranker %s", settings.rerank_model)
        self._model = TextCrossEncoder(model_name=settings.rerank_model)
        list(self._model.rerank("warmup", ["warmup document"]))
        log.info("reranker ready")

    @property
    def ready(self) -> bool:
        return self._model is not None

    def rank(self, query: str, documents: list[str]) -> list[float]:
        if self._model is None or not documents:
            return []
        return list(self._model.rerank(query, documents))


reranker = Reranker()
