import hashlib

# Entries are structured (what / why / dos / donts), so the indexed text is
# assembled field-aware rather than by dumping the raw document. Labels are
# included because they give the embedding model a bit of context about which
# part of the entry it is reading.
_LIST_FIELDS = ("dos", "donts")


def compose_text(entry: dict) -> str:
    parts: list[str] = []

    title = (entry.get("title") or "").strip()
    if title:
        parts.append(title)

    entry_type = (entry.get("type") or "").strip()
    if entry_type:
        parts.append(f"Type: {entry_type}")

    for field, label in (("what", "What"), ("why", "Why"), ("context", "Context")):
        value = (entry.get(field) or "").strip()
        if value:
            parts.append(f"{label}: {value}")

    for field in _LIST_FIELDS:
        values = [str(v).strip() for v in (entry.get(field) or []) if str(v).strip()]
        if values:
            parts.append(f"{field.capitalize()}: " + "; ".join(values))

    tags = [str(t).strip() for t in (entry.get("tags") or []) if str(t).strip()]
    if tags:
        parts.append("Tags: " + ", ".join(tags))

    return "\n".join(parts)


# Bumped when the stored vector record's shape changes. Because it feeds the
# content hash, incrementing it invalidates every vector and forces a re-embed
# on the next reindex -- this is the migration mechanism for index schema
# changes. v2 added the full `text` field, needed for BM25 and RAG context.
INDEX_SCHEMA_VERSION = 2


def content_hash(text: str, model: str) -> str:
    """Identify an embedding by its inputs.

    Reprocessing the same event (Redis Streams is at-least-once) or replaying
    after a crash then becomes a no-op instead of a redundant embed. Including
    the model name means a model change invalidates every vector, which is what
    makes a version migration safe.
    """
    return hashlib.sha256(
        f"v{INDEX_SCHEMA_VERSION}\x00{model}\x00{text}".encode("utf-8")
    ).hexdigest()


def snippet(entry: dict, limit: int = 220) -> str:
    body = (entry.get("what") or entry.get("why") or "").strip()
    if len(body) <= limit:
        return body
    return body[: limit - 1].rstrip() + "…"
