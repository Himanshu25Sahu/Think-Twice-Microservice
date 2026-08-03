# AI Service

Semantic search, duplicate detection, and (later) grounded Q&A over knowledge entries.

Runs as `ai-service` on port 5005. Python/FastAPI — the retrieval ecosystem is Python-only; every other service stays Node.

## Architecture

```
entry-service ──emits──> Redis Streams ──consumer group "ai-indexer"──> ai-service
                         entry:created                                       │
                         entry:updated                              hydrate from tt-entries
                         entry:deleted                                       │
                                                                    embed -> tt-ai.entry_vectors
                                                                             │
client ──> gateway /api/ai/* ─────────────────────────────────────> in-memory numpy index
```

Indexing happens **off the write path**. A slow embed or a dead ai-service never
blocks entry creation — events queue in Redis and are replayed on restart.

## Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Embedding model | `BAAI/bge-small-en-v1.5`, 384-dim, ONNX via fastembed | No torch in the image (~2GB saved). CPU-only, leaving the GPU free for the phase-3 LLM |
| Vector storage | float32 `BSON.Binary` in `tt-ai.entry_vectors` | 4× smaller than an array of BSON doubles, and the layout `$vectorSearch` expects if we later move to ANN |
| Search | Exact brute-force cosine, numpy matmul | At n≈5k × 384 dims the matrix is ~7.5MB and search is ~5ms. An ANN index adds operational cost and recall loss for no measurable latency win. Revisit around n≈100k |
| Tenant isolation | One numpy partition per `orgId` | A query can only touch its own org's matrix — cross-tenant leakage is structurally impossible, not dependent on remembering a filter |
| Ingestion | Redis Streams consumer group | Reuses existing infrastructure; entry-service needed zero changes |
| Idempotency | SHA-256 of (composed text + model name) | Redis Streams is at-least-once. Reprocessing an unchanged entry is a no-op. Including the model name means a model upgrade invalidates every vector — that's the migration path |

### Event notification vs. event-carried state transfer

Entry events carry only `entryId`/`orgId`/`projectId` — not entry text. So the
indexer hydrates content by reading `tt-entries` directly.

This crosses a service boundary. The alternatives were a fatter event payload
(couples entry-service's schema to every consumer) or an internal read API on
entry-service (needs a service-to-service auth story). Reading the source
collection read-only is the smallest thing that works, and it's the conventional
shape for a search projection. Worth revisiting if a second consumer needs the
same hydration.

### Why the in-memory index is a cache, not a source of truth

Vectors live in Mongo. The numpy index is rebuilt from them at every boot
(`warm_index`). The service can therefore be killed at any point without losing
work, and a corrupted index is fixed by a restart rather than a re-embed.

## API

All routes require `x-org-id`, injected by the gateway after JWT verification —
never read from the request body.

| Route | Purpose |
|---|---|
| `POST /ai/search` | Semantic search. `{query, limit, projectId?, min_score?}` |
| `POST /ai/similar` | Duplicate detection. Accepts a draft (`title`/`what`/`why`) or an existing `entryId` |
| `POST /ai/reindex` | Idempotent backfill of all entries |
| `POST /ai/warm` | Rebuild the in-memory index from stored vectors |
| `GET /ai/stats` | Index size, events processed/failed, stream lag |
| `GET /health` | Liveness + model-loaded flag |

## Synthetic corpus

5,000 entries across 5 projects in a dedicated `Northwind Systems` org, generated
from structured templates (`scripts/generate_corpus.py`). Everything is tagged
`synthetic: true` and removable with `--reset`.

Generated in clusters of ~6 entries sharing a subject, cross-linked via
`relations`, so duplicate detection and the decision graph have real signal.
Deliberate vocabulary drift (`data-warehouse-etl` also appears as "the nightly
ETL job" / "the ingestion pipeline") creates queries that lexical search cannot
answer.

Two generator bugs found by inspecting output, both of which would have
corrupted phase-2 metrics:

- **Byte-identical entries.** Team conventions were generated per cluster,
  producing the same entry hundreds of times. A question would then have many
  equally-correct answers, silently inflating Recall@k. Conventions are now
  generated exactly once (10 entries).
- **Titles collapsing onto one variable.** Decision templates referenced only
  the service name — 10 templates × 20 services = 200 titles for ~1,500 entries,
  with one title repeated 19×. Templates now reference at least two dimensions:
  2,693 distinct titles across 5,010 entries, max repetition 15×.

## Measurements

Corpus of 5,010 entries, CPU-only, inside Docker:

| Operation | Result |
|---|---|
| Full backfill (5,013 entries) | 275 s @ ~18 entries/s |
| Orphan pruning | 5,010 stale vectors removed |
| `/ai/search` (idle) | 42–69 ms |
| `/ai/search` (during backfill) | 62 ms — responsive, not blocked |
| `/ai/similar` | 50 ms |
| Reprocess unchanged entry via stream | 0 re-embeds (hash hit) |
| Cross-org query | 0 results |
| Missing `x-org-id` | 400 |

Latency is dominated by **query embedding (~40 ms)**, not search — the 5,010 ×
384 matmul is well under a millisecond. Any future latency work belongs at the
embedding step, not in an index.

Throughput of ~18 entries/s is CPU-bound ONNX inference in a container. Fine for
backfill; would be the first thing to optimise if the corpus grew 10×.

### Retrieval quality, eyeballed

Working, on queries sharing no keywords with the answer:

| Query | Top result |
|---|---|
| "TLS handshake errors started suddenly" | certificate expiry incidents |
| "we keep running out of database connections" | connection pool exhaustion playbook |
| "how should I write a runbook" | *Writing runbooks that survive an incident* (0.73) |
| "the nightly ETL job keeps failing" | `data-warehouse-etl` entries (alias resolved) |

Failing:

| Query | Expected | Got |
|---|---|---|
| "one bad message blocked the whole queue" | poison-message entries | DNS resolution failures |

The corpus contains a *poison message* failure mode described as "one malformed
payload blocked the whole partition". Dense retrieval alone misses it. This is
the canonical case for hybrid retrieval plus reranking — and the reason phase 2
needs a real harness rather than spot checks.

### Known nits

- An org whose entries are all deleted leaves an empty partition in
  `/ai/stats` (`"<org>": 0`). Cosmetic; the vectors are gone.

## Gotchas hit while building

- **`socket_timeout` must exceed the `XREADGROUP` block interval.** redis-py
  otherwise abandons the socket while the server is still legitimately holding
  the blocking read open, and the consumer loop dies every 5s.
- **Docker's build cache did not invalidate `COPY app ./app`** when files changed
  on the `D:` drive. `--no-cache` was needed. Verify deployed code with
  `docker exec` rather than trusting a rebuild.

## Client integration

`client/services/aiService.js` calls through the existing axios instance, so
`x-org-id` / `x-project-id` come from the active workspace automatically.

**Dashboard** — a Keyword | Semantic toggle beside the search box. Keyword search
is left intact rather than replaced: the two fail in different ways, and being
able to flip between them on the same query is the clearest demonstration of
what semantic retrieval adds. Semantic mode shows the cosine score per result
and the round-trip time. In-flight requests are aborted on each keystroke so a
slow earlier response cannot overwrite a newer one.

**New entry form** — a similar-entries panel that appears once the draft has
enough text to embed (title + body ≥ 25 chars, debounced 600 ms). Dismissible,
and advisory only: if ai-service is unavailable the panel stays hidden rather
than blocking the author.

---

# Phase 2 — retrieval quality

## The pipeline

```
query ──> embed ──> dense (cosine over numpy)   ─┐
      └──────────> lexical (BM25)                ├─> RRF fusion ──> cross-encoder rerank ──> top-k
                                                 ┘
```

**Why hybrid.** Dense retrieval bridges paraphrase but is weak on rare exact
tokens (service names, `SEV-1`, error codes). BM25 is the mirror image. Real
queries need both, which the ablation below confirms rather than assumes.

**Why RRF rather than score normalization.** Cosine similarity and BM25 produce
scores on unrelated, unnormalizable scales whose ranges shift per query.
Reciprocal Rank Fusion reads only ordinal position — `score = Σ 1/(k + rank)`,
k=60 — so the scales never have to be reconciled.

**Bi-encoder vs cross-encoder.** The embedding model encodes query and document
independently, so documents are precomputed and search is one matmul. The
cross-encoder scores the pair jointly and is more accurate, but costs a forward
pass per pair — hence retrieve-then-rerank over ~20 candidates rather than 5,000.

## Evaluation

An automated test suite for a non-deterministic system. Without it, "did that
change help?" is a vibe.

**Golden set: 807 questions**, generated from the corpus's own ground truth. Each
generated entry carries an `evalKey` such as `failure:a poison message|svc:email-relay`,
and a question is scored against *every* entry covering that subject (mean 7.7
relevant out of 5,028).

The questions are deliberately phrased **unlike** the entries. Entry text says
"one malformed payload blocked the whole partition"; the question says "one bad
message blocked the whole email-relay queue". No shared content words for the
failure, but the service name is an exact rare token — so a question needs the
dense *and* lexical signal to rank well. Had one template generated both sides,
the harness would measure a generator agreeing with itself.

**Metrics.** Recall@k (did any correct answer reach the top k — a user needs one
good answer, not all of them), MRR (reciprocal rank of the first hit, rewarding
rank 1 over rank 5), nDCG@10 (position-discounted, normalized against the best
achievable ordering).

## Ablation — 200 questions, 5,028 entries, CPU only

| Config | R@1 | R@5 | R@10 | MRR | nDCG@10 | p50 | p95 |
|---|---|---|---|---|---|---|---|
| lexical only (BM25) | 0.530 | 0.625 | 0.685 | 0.573 | 0.569 | 14 ms | 19 ms |
| dense only (vector) | 0.600 | 0.735 | 0.830 | 0.658 | 0.590 | 39 ms | 73 ms |
| **hybrid (RRF)** | **0.690** | **0.795** | 0.820 | **0.733** | **0.677** | 58 ms | 103 ms |
| hybrid + rerank top-10 | 0.740 | 0.785 | 0.820 | 0.760 | 0.689 | 432 ms | 562 ms |
| hybrid + rerank top-20 | 0.745 | 0.785 | 0.835 | 0.765 | 0.707 | 665 ms | 850 ms |
| hybrid + rerank top-50 | 0.765 | 0.805 | 0.825 | 0.781 | 0.717 | 1451 ms | 1652 ms |

**Reading it:**

- **Fusion is the big win.** MRR 0.658 → 0.733 (+11%) for +19 ms. Best
  quality-per-millisecond in the table by a wide margin.
- **Reranking is expensive.** top-20 buys +4.4 pp Recall@1 and +4.4% MRR for
  **11× the latency**. Latency scales linearly with the candidate count, exactly
  as a per-pair forward pass predicts (10→20→50 gives 432→665→1451 ms).
- **Reranking slightly *lowers* Recall@5** (0.795 → 0.785) while raising
  Recall@1. It sharpens the top of the list but occasionally pushes a correct
  answer from rank 4 to rank 6. Worth stating rather than hiding — it is why
  MRR and Recall@k are reported together.

**Product decision from the numbers:** interactive search defaults to
**fusion only** (58 ms), and `/ai/chat` opts into reranking, where an LLM
dominates the response time anyway. That split is a measurement, not a guess.

### The Phase 1 failure, resolved

The query documented as failing in Phase 1, now across all modes:

| Mode | Top result |
|---|---|
| dense | ✗ *DNS resolution failures in email-relay* |
| lexical | ✓ *a poison message in email-relay* |
| hybrid | ✓ *a poison message in email-relay* |

Dense retrieval alone still gets it wrong. BM25 catches the rare tokens, fusion
combines both. This is the hybrid hypothesis validated on the exact case that
motivated it.

---

# Phase 3 — assistant and resilience

## RAG chat

`POST /ai/chat` retrieves with hybrid + rerank, assembles numbered context under
a 6,000-character budget, and asks the model to answer using only those entries,
citing them as `[n]`. Context is bounded deliberately: models attend poorly to
the middle of long prompts, and every extra token costs latency.

## Graceful degradation

The LLM sits behind a provider interface and a circuit breaker. After 3
consecutive failures the circuit opens and calls fail instantly rather than
burning a 60 s timeout each; after a 30 s cooldown one trial request is allowed
through, and success closes it.

When generation is unavailable, chat returns an **extractive answer** — the top
entries with their snippets — rather than an error. The retrieved entries are
the valuable part; a user holding the right three entries is served even without
prose. Degraded answers are deliberately **not cached**, so recovery is immediate
once the model returns.

Verified with Ollama stopped:

```
req 1: 899 ms  reason=llm_unavailable     <- breaker still closed, call attempted
req 2: 739 ms  reason=llm_circuit_open    <- breaker open, no call attempted
req 3: 743 ms  reason=llm_circuit_open
circuit: {state: open, consecutive_failures: 3, trips: 1}
```

Honest caveat: the latency saving here is modest because a refused connection
already fails fast. The breaker's real value is when the dependency *hangs* —
then it saves the full 60 s timeout per request.

## Generation, verified

Running `llama3.2:3b` locally on an RTX 3050 (6 GB):

| | |
|---|---|
| Cold model load (disk → VRAM) | 80 s, once |
| Chat, warm | **4.6 s** |
| Chat, semantic cache hit | **18 ms** (258×) |

Sample answer to *"how do we handle database migrations safely"*:

> According to entry [1], our team follows a convention of expanding and
> contracting databases in separate deployments, never doing so in one deploy…
> **There is no further information provided** on how to handle database
> migrations safely in the given entries.

The refusal at the end is the grounding working: it declined to pad the answer
with knowledge it had but the entries did not contain.

**Observed flaw:** the 3B model mis-attributed a claim to entry [2] that
actually came from entry [1]. Citations are approximately right but not
reliable at this model size — worth knowing before trusting them. A larger
model would likely fix it, at the cost of not fitting in 6 GB VRAM.

**Host RAM, not VRAM, is the binding constraint.** The first attempt crashed
with `ggml_cuda_host_malloc: failed to allocate 308.23 MiB of pinned memory`
while the GPU sat idle with 5.8 GB free — Ollama needs pinned *host* memory to
stage weights into VRAM, and only 0.6 GB was available with Docker, Chrome and
VS Code running. Closing the browser freed 2 GB and it loaded immediately.

## Semantic cache

Keyed by query embedding rather than exact string, so "how do we do migrations"
and "what's our migration process" share a cache entry. Threshold is a
deliberately strict **0.97**: serving a confidently wrong answer to a subtly
different question is far worse than a miss. Scoped per (org, project) so it can
never serve across a tenant boundary, and invalidated whenever the index changes
underneath it.

Verified live: 4,649 ms → 18 ms on a repeat, and a punctuation-only paraphrase
also hit. Degraded answers are never cached, so recovery is immediate once the
model returns.

## Tracing

Per-stage spans exported to the existing Jaeger instance. A real `/ai/chat`
trace:

```
POST /ai/chat  (521 ms)
├─ embed.query
├─ retrieve.dense
├─ retrieve.lexical
├─ rerank
└─ llm.generate
```

This puts the AI pipeline on the same timeline as gateway and entry-service
spans, which is what makes "where did the time actually go" answerable.

## Test suite

`python -m scripts.test_guarantees` — **16/16 passing**:

- Tenant isolation: missing `x-org-id` rejected; unknown org returns nothing;
  no entry id overlap between orgs; cross-org entry lookup returns **404 not
  403**, since a 403 would confirm the id exists
- All three retrieval modes return ranked results
- Reindex is idempotent — 5,028 vectors before and after, 0 re-embeds
- Prompt injection ("ignore all previous instructions…") does not hijack the
  answer; chat always cites sources
- Chat answers even when generation is unavailable
- Cache: misses on unrelated queries, hits on paraphrase, never crosses tenants,
  invalidates per org

### On prompt injection

Entry bodies are user-authored text flowing into a prompt, which makes them an
injection vector. Three layers: common override phrasings are neutralised by
regex; the system prompt states that entry content is data, not instructions;
and the model has no tools it could be redirected toward. None of these is
individually sufficient — the third is what actually bounds the blast radius.

---

## Status

- [x] Phase 1 — indexing + semantic search
- [x] Phase 2 — hybrid retrieval, reranking, eval harness
- [x] Phase 3 — RAG chat, circuit breaker, semantic cache, tracing

## Deploying on a free tier

Two things that only surfaced in production:

**Never embed on the serving box.** Triggering `/ai/reindex` on a Render free
instance repeatedly killed the container: embedding saturates the small CPU
share, the platform's health check times out, and the process is restarted
mid-run. Each attempt persisted its completed batches to Mongo, so the work
wasn't lost — but the job never finished and the in-memory index stayed empty.

Indexing is a batch job and doesn't belong on a request-serving instance.
`scripts/backfill_remote.py` runs the same pipeline from any machine against any
target database — 1,541 entries in **17 s** from a laptop versus never
completing on the free tier. The service then only needs `POST /ai/warm` to load
the vectors, which is cheap.

**Disable reranking.** `RERANK_ENABLED=false` drops ~150 MB, which is what keeps
the service inside a 512 MB instance. The ablation justifies it: reranking buys
+4.4pp Recall@1 for 11× the latency, and interactive search already skipped it.

Memory measured locally: **371 MB with 5,028 vectors and the reranker loaded**.

### Known limitations

- The ablation ran on 200 of 807 golden questions to keep the run under
  20 minutes. Full-set numbers may shift slightly.
- Citations from a 3B model are approximately, not reliably, correct.
- Retrieval can return near-duplicate entries in the same result set (the
  corpus contains genuine near-duplicates by design). Deduplicating by title
  or similarity before display would improve both chat context and search.
- Running the model locally requires ~1 GB of free host RAM to stage weights.
  On a 16 GB machine also running Docker and a browser, that is not always
  available. The provider interface exists so a hosted API can be swapped in
  by config when it is not.
