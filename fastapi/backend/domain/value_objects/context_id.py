from dataclasses import dataclass

MAX_CONTEXT_ID_LENGTH = 128


@dataclass(frozen=True, slots=True)
class ContextId:
    value: str


def new_context_id(value: object) -> ContextId:
    if not isinstance(value, str):
        raise ValueError("context_id must be a string")

    normalized = value.strip()
    if not normalized:
        raise ValueError("context_id must not be empty")
    if len(normalized) > MAX_CONTEXT_ID_LENGTH:
        raise ValueError(f"context_id must be at most {MAX_CONTEXT_ID_LENGTH} chars")

    return ContextId(normalized)
