from dataclasses import dataclass

MAX_UTTERANCE_LENGTH = 2000


@dataclass(frozen=True, slots=True)
class UtteranceText:
    value: str


def new_utterance_text(value: object) -> UtteranceText:
    if not isinstance(value, str):
        raise ValueError("utterance text must be a string")

    normalized = value.strip()
    if not normalized:
        raise ValueError("utterance text must not be empty")
    if len(normalized) > MAX_UTTERANCE_LENGTH:
        raise ValueError(f"utterance text must be at most {MAX_UTTERANCE_LENGTH} chars")

    return UtteranceText(normalized)
