import logging
from datetime import datetime, timezone

from bson import ObjectId

from .store import store

log = logging.getLogger("ai.conversations")

# Turns of prior conversation fed back to the model. Long histories cost latency
# and push retrieved entries toward the middle of the prompt, where models
# attend to them least.
HISTORY_TURNS = 6

# Conversations are scoped to (org, user): a chat is personal, and a title
# generated from someone's question should never surface for a colleague.


def _title_from(question: str) -> str:
    title = " ".join(question.strip().split())
    return title[:60] + ("…" if len(title) > 60 else "")


async def create(org_id: str, user_id: str, project_id: str | None, question: str) -> dict:
    now = datetime.now(timezone.utc)
    doc = {
        "_id": ObjectId(),
        "orgId": org_id,
        "userId": user_id,
        "projectId": project_id,
        "title": _title_from(question),
        "messages": [],
        "createdAt": now,
        "updatedAt": now,
    }
    await store.conversations.insert_one(doc)
    return doc


async def get(conversation_id: str, org_id: str, user_id: str) -> dict | None:
    try:
        oid = ObjectId(conversation_id)
    except Exception:
        return None
    # org and user are part of the query, not checked afterwards, so a mismatch
    # is indistinguishable from "does not exist".
    return await store.conversations.find_one(
        {"_id": oid, "orgId": org_id, "userId": user_id}
    )


async def list_for(org_id: str, user_id: str, limit: int = 100) -> list[dict]:
    # $size on the server rather than projecting messages and counting here:
    # the sidebar needs a number, not the transcripts.
    pipeline = [
        {"$match": {"orgId": org_id, "userId": user_id}},
        {"$sort": {"updatedAt": -1}},
        {"$limit": limit},
        {
            "$project": {
                "title": 1,
                "createdAt": 1,
                "updatedAt": 1,
                "messageCount": {"$size": {"$ifNull": ["$messages", []]}},
            }
        },
    ]
    out = []
    # The async driver returns a coroutine resolving to the cursor, unlike
    # find() which returns the cursor directly.
    cursor = await store.conversations.aggregate(pipeline)
    async for doc in cursor:
        out.append(
            {
                "id": str(doc["_id"]),
                "title": doc.get("title", "Untitled"),
                "created_at": doc.get("createdAt"),
                "updated_at": doc.get("updatedAt"),
                "message_count": doc.get("messageCount", 0),
            }
        )
    return out


async def append(conversation_id: ObjectId, role: str, content: str, sources=None, meta=None) -> None:
    message = {
        "role": role,
        "content": content,
        "createdAt": datetime.now(timezone.utc),
    }
    if sources is not None:
        message["sources"] = sources
    if meta:
        message.update(meta)

    await store.conversations.update_one(
        {"_id": conversation_id},
        {
            "$push": {"messages": message},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )


async def delete(conversation_id: str, org_id: str, user_id: str) -> bool:
    try:
        oid = ObjectId(conversation_id)
    except Exception:
        return False
    result = await store.conversations.delete_one(
        {"_id": oid, "orgId": org_id, "userId": user_id}
    )
    return result.deleted_count > 0


def serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", "Untitled"),
        "created_at": doc.get("createdAt"),
        "updated_at": doc.get("updatedAt"),
        "messages": [
            {
                "role": m.get("role"),
                "content": m.get("content", ""),
                "sources": m.get("sources", []),
                "generated": m.get("generated"),
                "degraded": m.get("degraded"),
                "cached": m.get("cached"),
                "took_ms": m.get("took_ms"),
                "created_at": m.get("createdAt"),
            }
            for m in doc.get("messages", [])
        ],
    }


def recent_turns(doc: dict | None) -> list[dict]:
    if not doc:
        return []
    return [
        {"role": m["role"], "content": m.get("content", "")}
        for m in doc.get("messages", [])[-HISTORY_TURNS:]
    ]


def retrieval_query(question: str, history: list[dict]) -> str:
    """Expand a follow-up into something retrievable on its own.

    "why?" or "what about staging?" carries almost no signal in isolation, so
    searching it directly returns noise. Prepending the last user question
    restores enough context without the cost and failure modes of an extra LLM
    call to rewrite it.
    """
    previous = [m["content"] for m in history if m["role"] == "user"]
    if not previous:
        return question
    return f"{previous[-1]} {question}"
