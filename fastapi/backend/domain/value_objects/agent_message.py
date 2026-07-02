from dataclasses import dataclass

MAX_AGENT_MESSAGE_LENGTH = 5000


@dataclass(frozen=True, slots=True)
class AgentMessage:
    value: str


def new_agent_message(value: object) -> AgentMessage:
    if not isinstance(value, str):
        raise ValueError("agent message must be a string")

    normalized = value.strip()
    if not normalized:
        raise ValueError("agent message must not be empty")
    if len(normalized) > MAX_AGENT_MESSAGE_LENGTH:
        raise ValueError(f"agent message must be at most {MAX_AGENT_MESSAGE_LENGTH} chars")

    return AgentMessage(normalized)
