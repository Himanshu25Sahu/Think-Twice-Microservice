import logging

import numpy as np
from fastembed import TextEmbedding

from .config import settings

log = logging.getLogger("ai.embedding")


class Embedder:
    """Wraps the ONNX embedding model.

    fastembed runs the model through onnxruntime, so the image needs no torch
    (~2GB saved) and inference stays on CPU, leaving the GPU free for the LLM
    added in phase 3.
    """

    def __init__(self) -> None:
        self._model: TextEmbedding | None = None

    def load(self) -> None:
        log.info("loading embedding model %s", settings.embedding_model)
        self._model = TextEmbedding(model_name=settings.embedding_model)
        # Confirm the configured dimension matches reality rather than
        # discovering a mismatch later as a shape error inside the index.
        probe = self.embed_documents(["dimension probe"])
        actual = probe.shape[1]
        if actual != settings.embedding_dim:
            raise RuntimeError(
                f"model {settings.embedding_model} returns {actual} dims, "
                f"config says {settings.embedding_dim}"
            )
        log.info("embedding model ready (%d dims)", actual)

    @property
    def ready(self) -> bool:
        return self._model is not None

    def _require(self) -> TextEmbedding:
        if self._model is None:
            raise RuntimeError("embedding model not loaded")
        return self._model

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        vectors = list(self._require().embed(texts, batch_size=settings.embed_batch_size))
        return _normalize(np.asarray(vectors, dtype=np.float32))

    def embed_query(self, text: str) -> np.ndarray:
        # BGE models are trained with an instruction prefix on the query side;
        # query_embed applies it. Skipping it measurably hurts retrieval.
        vectors = list(self._require().query_embed([text]))
        return _normalize(np.asarray(vectors, dtype=np.float32))[0]


def _normalize(matrix: np.ndarray) -> np.ndarray:
    """L2-normalize rows so a dot product is exactly cosine similarity.

    Normalizing once at write time keeps search a single matmul instead of
    recomputing norms on every query.
    """
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    np.maximum(norms, 1e-12, out=norms)
    return matrix / norms


embedder = Embedder()
