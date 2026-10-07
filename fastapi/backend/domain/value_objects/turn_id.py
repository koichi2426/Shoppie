import uuid
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TurnId:
    """会話の1往復の識別子。クリックなどの反応を、どの返答に対するものか結び付ける。"""

    value: str


def new_turn_id(value: object) -> TurnId:
    if not isinstance(value, str):
        raise ValueError("turn_id must be a string")

    normalized = value.strip().lower()
    try:
        parsed = uuid.UUID(normalized)
    except ValueError:
        raise ValueError("turn_id must be a UUID") from None

    return TurnId(str(parsed))


def issue_turn_id() -> TurnId:
    return new_turn_id(str(uuid.uuid4()))
