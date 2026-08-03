"""Generate a synthetic knowledge corpus for retrieval development.

Real usage data is ~3 entries, which is far too small to say anything about
retrieval quality. This builds a corpus with enough size and internal structure
that Recall@k and MRR mean something.

Entries are generated from structured templates rather than an LLM: it is
deterministic under a fixed seed, fast, and -- importantly -- the eval questions
in phase 2 are written from a *different* angle than the entry text, so the
harness is not just measuring one generator agreeing with itself.

Everything written here is tagged `synthetic: true` so it can be removed
cleanly with --reset.

Usage (inside the ai-service container):
    python -m scripts.generate_corpus --count 5000
    python -m scripts.generate_corpus --reset
"""

import argparse
import os
import random
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from pymongo import MongoClient

from . import golden, vocab

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://mongodb:27017")
ENTRIES_DB = os.environ.get("ENTRIES_DB", "tt-entries")
ORGS_DB = os.environ.get("ORGS_DB", "tt-orgs")
AUTH_DB = os.environ.get("AUTH_DB", "tt-auth")

ORG_NAME = "Northwind Systems"
ORG_SLUG = "northwind-systems"

SEED = 20260729


def _alias(rng, service_id, fallback):
    """Sometimes refer to a system by an alternative name."""
    options = vocab.ALIASES.get(service_id)
    if options and rng.random() < 0.35:
        return rng.choice(options)
    return fallback


def _incident(rng, cluster):
    svc_id, svc_desc, svc_tags = cluster["service"]
    failure, symptom, fail_tags = cluster["failure"]
    store, store_tags = cluster["store"]
    env = rng.choice(vocab.ENVIRONMENTS)
    severity = rng.choice(vocab.SEVERITIES)
    minutes = rng.choice([12, 23, 40, 55, 90, 140])
    name = _alias(rng, svc_id, svc_id)

    return {
        "title": f"{severity}: {failure} in {name} ({store})",
        "type": "incident",
        "what": (
            f"{name} degraded in {env} for {minutes} minutes after {failure}. "
            f"{symptom.capitalize()}. Error rates on {svc_desc} rose sharply and "
            f"p99 latency exceeded the alerting threshold before the on-call "
            f"engineer rolled back the preceding deploy."
        ),
        "why": (
            f"The underlying cause was that {svc_desc} shares a {store} client "
            f"whose limits were tuned for the traffic profile from two quarters "
            f"ago. Nothing alerted on the saturation itself, only on its "
            f"downstream symptoms, so diagnosis took longer than remediation."
        ),
        "dos": [
            f"Alert on {store} saturation directly, not only on request latency",
            "Capture a heap and connection snapshot before restarting anything",
            "Record the rollback decision in the incident channel as it happens",
        ],
        "donts": [
            "Do not restart instances one by one before capturing diagnostics",
            f"Do not raise {store} limits without checking the downstream ceiling",
        ],
        "context": f"Discovered during {env} traffic peak. Severity {severity}.",
        "tags": list({*svc_tags, *fail_tags, *store_tags, "incident"}),
        # Ground truth for evaluation: every entry covering this (failure,
        # service) pair is a correct answer to the matching golden question.
        "evalKey": f"failure:{failure}|svc:{svc_id}",
    }


def _debugging(rng, cluster):
    svc_id, svc_desc, svc_tags = cluster["service"]
    failure, symptom, fail_tags = cluster["failure"]
    store, store_tags = cluster["store"]
    name = _alias(rng, svc_id, svc_id)

    return {
        "title": f"Debugging {failure} in {name} behind {store}",
        "type": "debugging",
        "what": (
            f"A playbook for diagnosing {failure} affecting {svc_desc}. The "
            f"symptom is usually indirect: {symptom}, while the actual "
            f"bottleneck sits one layer down in {store}. Start from saturation "
            f"metrics rather than from application logs."
        ),
        "why": (
            f"Engineers repeatedly start debugging this from the {svc_desc} "
            f"error logs, which show timeouts rather than the cause. Beginning "
            f"at the {store} layer cuts diagnosis from hours to minutes."
        ),
        "dos": [
            f"Check {store} connection and saturation metrics first",
            "Correlate by trace id across services before forming a hypothesis",
            "Reproduce against a replica before changing production settings",
        ],
        "donts": [
            "Do not trust average latency; use p95 and p99",
            "Do not change two variables at once while narrowing down the cause",
        ],
        "context": f"Applies to {svc_desc} and anything sharing its {store} client.",
        "tags": list({*svc_tags, *fail_tags, *store_tags, "playbook"}),
        "evalKey": f"failure:{failure}|svc:{svc_id}",
    }


def _architecture(rng, cluster):
    svc_id, svc_desc, svc_tags = cluster["service"]
    store, store_tags = cluster["store"]
    platform, platform_tags = cluster["platform"]
    template, _kind, dec_tags = cluster["decision"]
    name = _alias(rng, svc_id, svc_id)
    title = template.format(svc=name, store=store, platform=platform, area=svc_desc)

    return {
        "title": f"Decision: {title}",
        "type": "architecture",
        "what": (
            f"We decided to {title}. The change affects {svc_desc} and anything "
            f"reading from it. Rollout is staged behind a flag, with the previous "
            f"path kept available for one release cycle."
        ),
        "why": (
            f"The existing arrangement coupled {svc_desc} to {store} in a way that "
            f"made independent scaling impossible, and every load increase forced a "
            f"simultaneous capacity decision. Running on {platform} lets the two "
            f"scale on their own schedules. We accepted higher operational surface "
            f"in exchange for that independence."
        ),
        "dos": [
            "Keep the previous path available for one full release cycle",
            "Migrate read traffic before write traffic",
            f"Document the new {store} ownership boundary",
        ],
        "donts": [
            "Do not migrate during a change freeze",
            "Do not let both paths write simultaneously without idempotency keys",
        ],
        "context": f"Supersedes the previous {svc_desc} arrangement.",
        "tags": list({*svc_tags, *store_tags, *platform_tags, *dec_tags}),
    }


def _practice(rng, cluster):
    title, principle, tags = cluster["practice"]
    svc_id, svc_desc, svc_tags = cluster["service"]

    return {
        "title": title,
        "type": "best-practice",
        "what": (
            f"{title}: {principle}. This is the convention the team follows, "
            f"originally written after repeated friction around {svc_desc}. It "
            f"applies to every service unless a decision entry says otherwise."
        ),
        "why": (
            f"Consistency matters more than the specific choice here. When "
            f"conventions differ per service, on-call engineers have to hold "
            f"several models in their head at 3am, and that is where mistakes "
            f"happen."
        ),
        "dos": [
            "Follow this by default and document any deliberate deviation",
            "Raise a decision entry if the convention no longer fits",
        ],
        "donts": [
            "Do not vary this per service without recording why",
        ],
        "context": f"Team-wide convention. Originated from {svc_desc} work.",
        "tags": list({*tags, *svc_tags, "convention"}),
        "evalKey": f"practice:{title}",
    }


def _feature(rng, cluster):
    svc_id, svc_desc, svc_tags = cluster["service"]
    store, store_tags = cluster["store"]
    capability, cap_tags = cluster["capability"]
    name = _alias(rng, svc_id, svc_id)

    return {
        "title": f"Adding {capability} to {name}",
        "type": "feature",
        "what": (
            f"Implementation notes for adding {capability} to {name}, which owns "
            f"{svc_desc}. State is persisted in {store}; the write path is "
            f"idempotent so a retried request cannot double-apply."
        ),
        "why": (
            f"The previous implementation of {svc_desc} assumed a single caller. "
            f"Supporting {capability} across concurrent clients required making "
            f"the operation explicitly ordered rather than relying on arrival time."
        ),
        "dos": [
            "Send an idempotency key on every write",
            f"Paginate reads from {store}; the result set is unbounded",
        ],
        "donts": [
            "Do not assume ordering without an explicit sequence number",
        ],
        "context": f"Extends {name} with {capability}.",
        "tags": list({*svc_tags, *store_tags, *cap_tags, "implementation"}),
        "evalKey": f"capability:{capability}|svc:{svc_id}",
    }


# Best-practice entries are deliberately excluded here: a team-wide convention
# exists once, not once per cluster. Generating them from the same weighted pool
# produced byte-identical duplicates, which would make "the correct answer"
# ambiguous and silently inflate Recall@k in phase 2.
BUILDERS = [
    (_incident, 0.26),
    (_debugging, 0.27),
    (_architecture, 0.29),
    (_feature, 0.18),
]


def build_cluster(rng):
    return {
        "service": rng.choice(vocab.SERVICES),
        "failure": rng.choice(vocab.FAILURES),
        "store": rng.choice(vocab.DATASTORES),
        "platform": rng.choice(vocab.PLATFORMS),
        "decision": rng.choice(vocab.DECISIONS),
        "practice": rng.choice(vocab.PRACTICES),
        "capability": rng.choice(vocab.CAPABILITIES),
    }


def ensure_org(client, owner_id, owner_name):
    orgs = client[ORGS_DB]["organizations"]
    projects = client[ORGS_DB]["projects"]

    org = orgs.find_one({"slug": ORG_SLUG})
    if org is None:
        org_id = ObjectId()
        orgs.insert_one(
            {
                "_id": org_id,
                "name": ORG_NAME,
                "slug": ORG_SLUG,
                "owner": owner_id,
                "members": [
                    {"userId": owner_id, "role": "owner", "joinedAt": datetime.now(timezone.utc)}
                ],
                "inviteCode": f"nw-{ObjectId()}"[:16],
                "createdAt": datetime.now(timezone.utc),
                "synthetic": True,
            }
        )
        print(f"created org {ORG_NAME} ({org_id})")
    else:
        org_id = org["_id"]
        print(f"reusing org {ORG_NAME} ({org_id})")

    # auth-service keeps its own copy of membership on the user document, and
    # it is the one that authorises an org switch. Writing only to tt-orgs
    # leaves the two services disagreeing: org-service accepts the switch, then
    # auth-service rejects it with a 403.
    users = client[AUTH_DB]["users"]
    result = users.update_one(
        {"_id": ObjectId(owner_id)},
        {"$addToSet": {"organizations": str(org_id)}},
    )
    if result.modified_count:
        print(f"added org to {owner_name}'s membership in auth-service")

    project_ids = []
    for name, description in vocab.PROJECTS:
        existing = projects.find_one({"orgId": str(org_id), "name": name})
        if existing:
            project_ids.append(str(existing["_id"]))
            continue
        pid = ObjectId()
        projects.insert_one(
            {
                "_id": pid,
                "name": name,
                "description": description,
                "orgId": str(org_id),
                "createdBy": owner_id,
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
                "synthetic": True,
            }
        )
        project_ids.append(str(pid))
    print(f"projects: {len(project_ids)}")
    return str(org_id), project_ids


def _make_doc(rng, body, org_id, project_id, owner_id, owner_name, now):
    author = rng.choice(vocab.AUTHORS + [owner_name])
    author_id = owner_id if author == owner_name else str(ObjectId())
    created = now - timedelta(days=rng.randint(1, 540), hours=rng.randint(0, 23))

    return {
        "_id": ObjectId(),
        "orgId": org_id,
        "projectId": project_id,
        "authorId": author_id,
        "authorName": author,
        "status": "published",
        "upvotes": [str(ObjectId()) for _ in range(rng.randint(0, 14))],
        "downvotes": [str(ObjectId()) for _ in range(rng.randint(0, 3))],
        "mentions": [],
        "images": [],
        "image": "",
        "relations": [],
        "createdAt": created,
        "updatedAt": created,
        "synthetic": True,
        **body,
    }


def generate_practices(org_id, project_ids, owner_id, owner_name, rng):
    """One entry per team convention, generated exactly once.

    Conventions are org-wide, so duplicating them per cluster is both
    unrealistic and harmful to evaluation.
    """
    now = datetime.now(timezone.utc)
    docs = []
    for practice in vocab.PRACTICES:
        cluster = build_cluster(rng)
        cluster["practice"] = practice
        body = _practice(rng, cluster)
        docs.append(
            _make_doc(rng, body, org_id, rng.choice(project_ids), owner_id, owner_name, now)
        )
    return docs


def generate_chunk(count, org_id, project_ids, owner_id, owner_name, rng):
    """Generate entries in clusters so related material actually clusters.

    Callers request a bounded chunk at a time so neither memory nor a single
    insert grows with total corpus size.
    """
    entries = []
    # Roughly 6 entries per cluster: enough that duplicate detection and
    # relation suggestion have genuine near-neighbours to find.
    cluster_size = 6
    now = datetime.now(timezone.utc)

    while len(entries) < count:
        cluster = build_cluster(rng)
        project_id = rng.choice(project_ids)
        cluster_entries = []

        for _ in range(min(cluster_size, count - len(entries))):
            builder = rng.choices(
                [b for b, _ in BUILDERS], weights=[w for _, w in BUILDERS], k=1
            )[0]
            body = builder(rng, cluster)
            cluster_entries.append(
                _make_doc(rng, body, org_id, project_id, owner_id, owner_name, now)
            )

        # Link entries inside a cluster. This is what phase 2 mines for
        # evaluation pairs and what the decision-graph feature renders.
        for doc in cluster_entries:
            others = [d for d in cluster_entries if d["_id"] != doc["_id"]]
            for other in rng.sample(others, min(len(others), rng.randint(0, 2))):
                doc["relations"].append(
                    {
                        "targetEntryId": other["_id"],
                        "type": rng.choice(vocab.RELATION_TYPES),
                        "createdAt": doc["createdAt"],
                    }
                )

        entries.extend(cluster_entries)

    return entries[:count]


def build_golden(client, org_id):
    """Derive golden questions from what was actually generated.

    Questions are only emitted for evalKeys the corpus really contains, so the
    harness can never score against an answer that does not exist.
    """
    entries = client[ENTRIES_DB]["entries"]
    keys: dict[str, list[str]] = {}
    for doc in entries.find({"orgId": org_id, "synthetic": True}, {"evalKey": 1}):
        key = doc.get("evalKey")
        if key:
            keys.setdefault(key, []).append(str(doc["_id"]))

    svc_label = {svc_id: svc_id for svc_id, _, _ in vocab.SERVICES}

    questions = []
    for key, ids in keys.items():
        if key.startswith("failure:"):
            failure, svc = key[len("failure:"):].split("|svc:")
            templates = golden.FAILURE_QUESTIONS.get(failure, [])
            subject = svc_label.get(svc, svc)
        elif key.startswith("capability:"):
            capability, svc = key[len("capability:"):].split("|svc:")
            templates = golden.CAPABILITY_QUESTIONS.get(capability, [])
            subject = svc_label.get(svc, svc)
        elif key.startswith("practice:"):
            templates = golden.PRACTICE_QUESTIONS.get(key[len("practice:"):], [])
            subject = None
        else:
            continue

        for template in templates:
            questions.append(
                {
                    "question": template.format(svc=subject) if subject else template,
                    "evalKey": key,
                    "relevant": ids,
                    "orgId": org_id,
                }
            )

    collection = client[os.environ.get("AI_DB", "tt-ai")]["eval_golden"]
    collection.delete_many({"orgId": org_id})
    if questions:
        collection.insert_many(questions)

    sizes = [len(q["relevant"]) for q in questions]
    print(
        f"golden set: {len(questions)} questions, "
        f"relevant per question min={min(sizes)} max={max(sizes)} "
        f"mean={sum(sizes)/len(sizes):.1f}"
    )
    return len(questions)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=5000)
    parser.add_argument("--chunk", type=int, default=500, help="entries generated+inserted per batch")
    parser.add_argument("--reset", action="store_true", help="remove synthetic data and exit")
    parser.add_argument("--seed", type=int, default=SEED)
    args = parser.parse_args()

    client = MongoClient(MONGODB_URI)
    entries = client[ENTRIES_DB]["entries"]

    if args.reset:
        # Collect ids before deleting so membership can be revoked too --
        # otherwise users keep pointing at organizations that no longer exist.
        stale = [
            str(o["_id"])
            for o in client[ORGS_DB]["organizations"].find({"synthetic": True}, {"_id": 1})
        ]
        removed = entries.delete_many({"synthetic": True}).deleted_count
        orgs = client[ORGS_DB]["organizations"].delete_many({"synthetic": True}).deleted_count
        projects = client[ORGS_DB]["projects"].delete_many({"synthetic": True}).deleted_count

        users = client[AUTH_DB]["users"]
        users.update_many({}, {"$pull": {"organizations": {"$in": stale}}})
        # A user left pointing at a deleted org cannot load the dashboard.
        users.update_many({"activeOrg": {"$in": stale}}, {"$set": {"activeOrg": None, "activeProject": None}})

        client[os.environ.get("AI_DB", "tt-ai")]["eval_golden"].delete_many({})
        print(f"removed {removed} entries, {projects} projects, {orgs} orgs")
        return

    user = client[AUTH_DB]["users"].find_one({})
    if user is None:
        raise SystemExit("no user in tt-auth; sign up in the app first")
    owner_id = str(user["_id"])
    owner_name = user.get("name", "Owner")
    print(f"owner: {owner_name} ({owner_id})")

    rng = random.Random(args.seed)
    org_id, project_ids = ensure_org(client, owner_id, owner_name)

    existing = entries.count_documents({"orgId": org_id, "synthetic": True})
    if existing:
        print(f"{existing} synthetic entries already present; run --reset first")
        return

    practices = generate_practices(org_id, project_ids, owner_id, owner_name, rng)
    entries.insert_many(practices)
    print(f"inserted {len(practices)} team conventions")

    # Generate and insert one chunk at a time: memory stays flat regardless of
    # --count, and progress is visible rather than appearing to stall.
    written = 0
    while written < args.count:
        size = min(args.chunk, args.count - written)
        docs = generate_chunk(size, org_id, project_ids, owner_id, owner_name, rng)
        entries.insert_many(docs)
        written += len(docs)
        print(f"inserted {written}/{args.count}", flush=True)

    build_golden(client, org_id)

    print(f"\ndone: {written} entries in org {org_id}")
    print("next: curl -X POST http://localhost:5005/ai/reindex")


if __name__ == "__main__":
    main()
