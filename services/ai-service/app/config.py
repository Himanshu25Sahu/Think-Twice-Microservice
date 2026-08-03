from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 5005

    # ai-service owns AI_DB. ENTRIES_DB is read-only: entry events carry ids
    # only, so entry content has to be hydrated from the source of truth.
    mongodb_uri: str = "mongodb://mongodb:27017"
    ai_db: str = "tt-ai"
    entries_db: str = "tt-entries"

    redis_url: str = "redis://redis:6379"
    consumer_group: str = "ai-indexer"
    consumer_name: str = "ai-1"

    # BGE-small: 384 dims, ONNX via fastembed, so no torch in the image.
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dim: int = 384

    # Batch size for embedding during backfill / bulk reindex.
    embed_batch_size: int = 64

    # How long xreadgroup blocks before looping, in ms. Bounds shutdown latency.
    stream_block_ms: int = 5000

    # --- retrieval ---
    # Candidates pulled from each retriever before fusion. Larger widens recall
    # at the cost of reranking more pairs.
    candidate_k: int = 50
    # RRF constant. 60 is the value from the original paper; it damps the
    # influence of a single retriever's top rank.
    rrf_k: int = 60
    rerank_model: str = "Xenova/ms-marco-MiniLM-L-6-v2"
    rerank_enabled: bool = True
    # A cross-encoder costs one forward pass per (query, document) pair, so
    # latency scales linearly with this. Reranking the full 50-candidate pool
    # measured 1.7s p50 on CPU; 20 keeps most of the quality at a fraction of
    # the cost. See docs/AI_SERVICE.md for the measured tradeoff.
    rerank_top_n: int = 20

    # --- generation (phase 3) ---
    llm_provider: str = "ollama"  # ollama | groq | none
    ollama_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3.2:3b"
    # Groq: hosted inference, free tier, no local RAM or VRAM cost. The
    # deployable alternative to Ollama -- no free host can run a local model.
    groq_api_key: str = ""
    groq_url: str = "https://api.groq.com/openai/v1/chat/completions"
    groq_model: str = "llama-3.3-70b-versatile"
    llm_timeout_s: float = 60.0
    # Circuit breaker: consecutive failures before opening, and how long the
    # circuit stays open before a trial request is allowed through.
    breaker_threshold: int = 3
    breaker_cooldown_s: float = 30.0

    # --- semantic cache ---
    cache_enabled: bool = True
    cache_similarity: float = 0.97
    cache_max_entries: int = 512

    # --- observability ---
    otel_enabled: bool = False
    otel_endpoint: str = "http://jaeger:4318/v1/traces"
    otel_service_name: str = "ai-service"

    log_level: str = "INFO"

    class Config:
        env_prefix = ""
        case_sensitive = False


settings = Settings()

# Streams emitted by entry-service. ai-service joins as its own consumer group,
# so entry-service needs no changes and analytics-service is unaffected.
ENTRY_STREAMS = ["entry:created", "entry:updated", "entry:deleted"]
