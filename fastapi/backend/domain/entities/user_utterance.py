from dataclasses import dataclass


@dataclass
class UserUtterance:
    text: str
    context_id: str
