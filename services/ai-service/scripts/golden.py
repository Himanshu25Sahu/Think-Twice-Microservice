"""Golden question set for retrieval evaluation.

The critical property is that questions are phrased *unlike* the entries they
should retrieve. If the same templates produced both, the harness would measure
a generator agreeing with itself and every retriever would look excellent.

Entry text says "connection pool exhaustion ... requests queued until the pool
timed out"; the question says "checkout-api keeps timing out when traffic
spikes". The failure is described in disjoint vocabulary -- which only dense
retrieval can bridge -- while the service name is an exact rare token, which is
what BM25 is good at. A question therefore needs *both* signals to rank well,
which is precisely the hybrid hypothesis under test.

Relevance is keyed on (failure, service) rather than a single entry id, so a
question is scored against every entry genuinely covering that subject. Typical
relevant set is ~6-10 entries out of 5,000.
"""

# Every template names the service: without it the relevant set would have to
# widen to "any entry about this failure" (~90 docs), which saturates Recall@5
# and stops discriminating between retrieval strategies.
FAILURE_QUESTIONS = {
    "connection pool exhaustion": [
        "{svc} keeps timing out when traffic spikes",
        "{svc} ran out of database handles again",
    ],
    "a cache stampede": [
        "{svc} hammers the database every time the cache clears",
        "load on {svc} spikes right after a cache flush",
    ],
    "N+1 query amplification": [
        "one {svc} page load fires hundreds of queries",
        "why is a single {svc} request so chatty with the database",
    ],
    "a memory leak": [
        "{svc} memory climbs until it gets killed",
        "{svc} keeps getting OOM killed overnight",
    ],
    "clock skew between nodes": [
        "{svc} tokens randomly rejected on some machines",
        "{svc} works on one node and fails on another",
    ],
    "a hot partition": [
        "one {svc} shard is taking all the writes",
        "{svc} traffic is unevenly distributed across shards",
    ],
    "unbounded retry amplification": [
        "retries made the {svc} outage worse",
        "a small {svc} failure snowballed into a big one",
    ],
    "a deadlock under concurrent writes": [
        "two {svc} transactions are stuck waiting on each other",
        "{svc} writes hang when several run at once",
    ],
    "disk saturation": [
        "{svc} stalled when the volume hit its IOPS limit",
        "why did {svc} freeze when the disk was busy",
    ],
    "DNS resolution failures": [
        "{svc} was routing to machines that no longer exist",
        "stale hostnames broke {svc} service discovery",
    ],
    "a slow consumer": [
        "the {svc} queue is backing up faster than we drain it",
        "{svc} consumer lag keeps growing",
    ],
    "schema drift": [
        "a nullable column broke {svc} downstream",
        "an unexpected null crashed the {svc} consumer",
    ],
    "thread pool starvation": [
        "all {svc} workers are blocked and nothing progresses",
        "blocking calls used up every {svc} worker thread",
    ],
    "certificate expiry": [
        "{svc} TLS handshakes started failing out of nowhere",
        "{svc} connections rejected after a certificate lapsed",
    ],
    "a poison message": [
        "one bad message blocked the whole {svc} queue",
        "a single malformed payload stopped the {svc} partition",
    ],
}

# Conventions exist once org-wide, so the relevant set is a single entry --
# a precise, unambiguous retrieval task.
PRACTICE_QUESTIONS = {
    "How we handle database migrations": [
        "what is our process for changing a table safely",
        "how do we avoid downtime when altering schemas",
    ],
    "Writing runbooks that survive an incident": [
        "how should I write a runbook",
        "what makes documentation useful at 3am",
    ],
    "Structured logging conventions": [
        "what format should logs be in",
        "how do we make logs searchable across services",
    ],
    "Our approach to feature flags": [
        "how long should a feature toggle live",
        "what is our policy on flags",
    ],
    "Pull request review expectations": [
        "how big should a change be for review",
        "what do reviewers expect from a PR",
    ],
    "Timeout and retry defaults": [
        "what timeout should I use for a network call",
        "how many times should we retry a failed request",
    ],
    "Secrets handling": [
        "where should credentials live",
        "how do we keep keys out of the repository",
    ],
    "Backfill jobs that can be re-run": [
        "how do I make a backfill safe to run twice",
        "what makes a data job re-runnable",
    ],
    "Choosing between a queue and a stream": [
        "should I use a queue or a stream here",
        "when do we need to replay messages",
    ],
    "On-call escalation policy": [
        "when should an alert page someone",
        "what is our escalation process",
    ],
}

CAPABILITY_QUESTIONS = {
    "bulk import": ["how does {svc} load records in bulk"],
    "soft deletes": ["how does {svc} handle deletion without losing data"],
    "partial refunds": ["can {svc} refund only part of an order"],
    "multi-region failover": ["what happens to {svc} when a region goes down"],
    "audit trails": ["how does {svc} track who changed what"],
    "scheduled exports": ["how do recurring {svc} data exports work"],
    "webhook replay": ["can {svc} resend a failed webhook"],
    "per-tenant quotas": ["how does {svc} limit usage per customer"],
    "saved filters": ["can {svc} users store their own filters"],
    "attachment previews": ["how does {svc} generate file previews"],
    "delegated access": ["how does one {svc} user act for another"],
    "draft autosave": ["does {svc} preserve unsaved drafts"],
}
