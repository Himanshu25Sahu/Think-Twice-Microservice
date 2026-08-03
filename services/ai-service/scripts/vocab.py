"""Vocabulary for synthetic corpus generation.

The corpus needs three properties the eval harness depends on:

1. **Variety** -- enough combinatorial space that 5k entries are genuinely
   distinct, not 5k renamings of the same paragraph.
2. **Clusters** -- groups of entries about the same subject from different
   angles, so duplicate detection and relation suggestion have real signal.
3. **Vocabulary drift** -- the same concept referred to differently across
   entries ("the ingestion pipeline" / "the nightly ETL job"), which is exactly
   what keyword search fails at and semantic search should catch.
"""

SERVICES = [
    ("checkout-api", "checkout flow", ["payments", "orders"]),
    ("auth-service", "authentication", ["identity", "sessions"]),
    ("search-indexer", "search indexing", ["search", "indexing"]),
    ("notification-worker", "notification delivery", ["notifications", "async"]),
    ("billing-engine", "billing and invoicing", ["billing", "finance"]),
    ("media-transcoder", "media transcoding", ["media", "batch"]),
    ("recommendation-api", "recommendations", ["ml", "ranking"]),
    ("inventory-sync", "inventory synchronisation", ["inventory", "sync"]),
    ("audit-log", "audit logging", ["compliance", "logging"]),
    ("webhook-dispatcher", "outbound webhooks", ["webhooks", "integrations"]),
    ("report-generator", "scheduled reporting", ["reporting", "batch"]),
    ("session-store", "session storage", ["sessions", "cache"]),
    ("feature-flag-service", "feature flagging", ["config", "rollout"]),
    ("image-uploader", "image upload pipeline", ["media", "storage"]),
    ("email-relay", "transactional email", ["email", "delivery"]),
    ("rate-limiter", "API rate limiting", ["traffic", "protection"]),
    ("data-warehouse-etl", "the nightly ETL job", ["analytics", "etl"]),
    ("customer-portal", "the customer portal", ["frontend", "portal"]),
    ("pricing-service", "price calculation", ["pricing", "catalog"]),
    ("fraud-detector", "fraud screening", ["risk", "ml"]),
]

# Alternative phrasings for the same system. Used to introduce the vocabulary
# drift that makes lexical-only search insufficient.
ALIASES = {
    "data-warehouse-etl": ["the ingestion pipeline", "the nightly batch load"],
    "search-indexer": ["the indexing pipeline", "the document indexer"],
    "notification-worker": ["the push worker", "the notification fan-out"],
    "checkout-api": ["the purchase flow", "the order submission path"],
    "auth-service": ["the login service", "the identity provider integration"],
}

DATASTORES = [
    ("PostgreSQL", ["postgres", "sql"]),
    ("Redis", ["redis", "cache"]),
    ("MongoDB", ["mongodb", "nosql"]),
    ("Kafka", ["kafka", "streaming"]),
    ("Elasticsearch", ["elasticsearch", "search"]),
    ("S3", ["s3", "object-storage"]),
    ("DynamoDB", ["dynamodb", "nosql"]),
    ("RabbitMQ", ["rabbitmq", "queue"]),
    ("ClickHouse", ["clickhouse", "olap"]),
    ("Cassandra", ["cassandra", "wide-column"]),
]

PLATFORMS = [
    ("Kubernetes", ["k8s", "orchestration"]),
    ("AWS Lambda", ["serverless", "aws"]),
    ("ECS Fargate", ["ecs", "aws"]),
    ("Nomad", ["nomad", "orchestration"]),
    ("bare EC2", ["ec2", "aws"]),
]

FAILURES = [
    ("connection pool exhaustion", "requests queued until the pool timed out",
     ["pooling", "latency"]),
    ("a cache stampede", "every miss hit the database simultaneously",
     ["cache", "thundering-herd"]),
    ("N+1 query amplification", "one request fanned out into hundreds of queries",
     ["queries", "performance"]),
    ("a memory leak", "RSS grew until the OOM killer intervened",
     ["memory", "leak"]),
    ("clock skew between nodes", "token validation failed intermittently",
     ["time", "distributed"]),
    ("a hot partition", "one shard absorbed most of the write traffic",
     ["sharding", "hotspot"]),
    ("unbounded retry amplification", "retries multiplied load during a partial outage",
     ["retries", "resilience"]),
    ("a deadlock under concurrent writes", "two transactions waited on each other",
     ["locking", "concurrency"]),
    ("disk saturation", "IOPS hit the volume ceiling and everything stalled",
     ["disk", "io"]),
    ("DNS resolution failures", "stale records pointed at terminated instances",
     ["dns", "networking"]),
    ("a slow consumer", "lag grew faster than the consumer could drain it",
     ["consumers", "lag"]),
    ("schema drift", "a nullable column broke downstream assumptions",
     ["schema", "migrations"]),
    ("thread pool starvation", "blocking calls consumed every worker",
     ["threads", "blocking"]),
    ("certificate expiry", "TLS handshakes began failing without warning",
     ["tls", "certificates"]),
    ("a poison message", "one malformed payload blocked the whole partition",
     ["queue", "poison-pill"]),
]

# Each template references at least two dimensions so titles spread across the
# combinatorial space instead of collapsing onto the service name. With one
# variable, 10 templates x 20 services gave only 200 distinct titles for ~1500
# architecture entries -- the same title appeared up to 19 times.
DECISIONS = [
    ("adopt {store} for {area}", "storage-choice", ["architecture", "storage"]),
    ("split {svc} into a separate service backed by {store}", "service-boundary",
     ["architecture", "boundaries"]),
    ("move {svc} onto {platform}", "platform-migration", ["infrastructure", "migration"]),
    ("introduce a {store} read replica for {svc}", "scaling", ["scaling", "replication"]),
    ("replace synchronous calls in {svc} with events via {store}", "async-migration",
     ["events", "async"]),
    ("add a circuit breaker around {svc} calls to {store}", "resilience",
     ["resilience", "circuit-breaker"]),
    ("cache {area} responses in {store}", "caching", ["cache", "performance"]),
    ("version the {svc} public API behind {platform}", "api-design", ["api", "versioning"]),
    ("consolidate {svc} configuration in {store}", "configuration", ["config", "ops"]),
    ("adopt idempotency keys for {svc} writes to {store}", "correctness",
     ["idempotency", "api"]),
]

PRACTICES = [
    ("How we handle database migrations", "expand/contract, never in one deploy",
     ["migrations", "database"]),
    ("Writing runbooks that survive an incident", "assume the author is asleep",
     ["runbooks", "oncall"]),
    ("Structured logging conventions", "one event per line, always with a trace id",
     ["logging", "observability"]),
    ("Our approach to feature flags", "flags are temporary or they are technical debt",
     ["flags", "rollout"]),
    ("Pull request review expectations", "small diffs, explicit intent",
     ["process", "review"]),
    ("Timeout and retry defaults", "every network call gets a budget",
     ["timeouts", "resilience"]),
    ("Secrets handling", "never in env files committed to the repo",
     ["security", "secrets"]),
    ("Backfill jobs that can be re-run", "idempotent by construction",
     ["backfill", "idempotency"]),
    ("Choosing between a queue and a stream", "replayability is the deciding factor",
     ["queues", "streams"]),
    ("On-call escalation policy", "page a human only when a human can act",
     ["oncall", "process"]),
]

# Capabilities a service can gain. Kept separate from a service's own
# description so feature entries do not describe a system in terms of itself.
CAPABILITIES = [
    ("bulk import", ["import", "batch"]),
    ("soft deletes", ["deletes", "retention"]),
    ("partial refunds", ["refunds", "payments"]),
    ("multi-region failover", ["failover", "regions"]),
    ("audit trails", ["audit", "compliance"]),
    ("scheduled exports", ["exports", "scheduling"]),
    ("webhook replay", ["webhooks", "replay"]),
    ("per-tenant quotas", ["quotas", "multi-tenancy"]),
    ("saved filters", ["filters", "ux"]),
    ("attachment previews", ["attachments", "media"]),
    ("delegated access", ["permissions", "access"]),
    ("draft autosave", ["drafts", "ux"]),
]

ENVIRONMENTS = ["production", "staging", "the EU region", "the primary cluster"]

SEVERITIES = ["SEV-1", "SEV-2", "SEV-3"]

AUTHORS = [
    "Priya Raman", "Arjun Mehta", "Sofia Lindqvist", "Daniel Okonkwo",
    "Wei Zhang", "Fatima Al-Rashid", "Tomas Novak", "Grace Whitfield",
    "Kenji Watanabe", "Lucia Ferreira", "Omar Haddad", "Nina Petrova",
]

PROJECTS = [
    ("Platform", "Core services, infrastructure, and shared libraries"),
    ("Payments", "Checkout, billing, and reconciliation"),
    ("Data", "Pipelines, warehousing, and analytics"),
    ("Growth", "Onboarding, notifications, and experimentation"),
    ("Reliability", "Incidents, on-call, and observability"),
]

RELATION_TYPES = ["related_to", "depends_on", "impacts", "replaces", "blocks"]
