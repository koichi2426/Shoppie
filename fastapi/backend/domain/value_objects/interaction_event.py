from dataclasses import dataclass
from enum import Enum

from domain.value_objects.context_id import ContextId, new_context_id
from domain.value_objects.marketplace import MARKETPLACE_LABELS, new_marketplace
from domain.value_objects.turn_id import TurnId, new_turn_id

MAX_PRODUCT_RANK = 1000
MAX_CONFIG_VERSION_LENGTH = 64
MAX_DURATION_MS = 10 * 60 * 1000


class InteractionEventType(str, Enum):
    # サーバーが返答を返したときに記録する
    TURN_COMPLETED = "turn_completed"
    TURN_FAILED = "turn_failed"
    # ブラウザから送られてくる
    PRODUCT_CLICK = "product_click"
    CONVERSATION_RESET = "conversation_reset"


CLIENT_EVENT_TYPES = frozenset(
    {InteractionEventType.PRODUCT_CLICK, InteractionEventType.CONVERSATION_RESET}
)


@dataclass(frozen=True, slots=True)
class InteractionEvent:
    """ユーザーの反応と、それを引き出した返答の記録。発話の本文は持たない。"""

    type: InteractionEventType
    context_id: ContextId
    turn_id: TurnId | None = None
    config_version: str | None = None
    product_count: int | None = None
    marketplace_counts: tuple[tuple[str, int], ...] | None = None
    duration_ms: int | None = None
    rank: int | None = None
    marketplace: str | None = None
    price_yen: int | None = None

    def to_dict(self) -> dict:
        data: dict = {
            "type": self.type.value,
            "context_id": self.context_id.value,
        }
        if self.turn_id is not None:
            data["turn_id"] = self.turn_id.value
        if self.config_version is not None:
            data["config_version"] = self.config_version
        if self.product_count is not None:
            data["product_count"] = self.product_count
        if self.marketplace_counts is not None:
            data["marketplace_counts"] = dict(self.marketplace_counts)
        if self.duration_ms is not None:
            data["duration_ms"] = self.duration_ms
        if self.rank is not None:
            data["rank"] = self.rank
        if self.marketplace is not None:
            data["marketplace"] = self.marketplace
        if self.price_yen is not None:
            data["price_yen"] = self.price_yen
        return data


def _non_negative_int(name: str, value: object, upper: int | None = None) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{name} must be an integer")
    if value < 0:
        raise ValueError(f"{name} must be non-negative")
    if upper is not None and value > upper:
        raise ValueError(f"{name} must be at most {upper}")
    return value


def _marketplace_code(value: object) -> str:
    # 画面のバッジは表示名(「楽天」など)なので、集計しやすいようにコードへそろえる
    if isinstance(value, str):
        for code, label in MARKETPLACE_LABELS.items():
            if value.strip() == label:
                return code
    return new_marketplace(value).code


def _config_version(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("config_version must not be empty")
    normalized = value.strip()
    if len(normalized) > MAX_CONFIG_VERSION_LENGTH:
        raise ValueError(f"config_version must be at most {MAX_CONFIG_VERSION_LENGTH} chars")
    return normalized


def new_turn_completed_event(
    context_id: object,
    turn_id: TurnId,
    config_version: object,
    marketplaces: list[str | None],
    duration_ms: object,
) -> InteractionEvent:
    counts: dict[str, int] = {}
    for marketplace in marketplaces:
        key = marketplace or "unknown"
        counts[key] = counts.get(key, 0) + 1

    return InteractionEvent(
        type=InteractionEventType.TURN_COMPLETED,
        context_id=new_context_id(context_id),
        turn_id=turn_id,
        config_version=_config_version(config_version),
        product_count=len(marketplaces),
        marketplace_counts=tuple(sorted(counts.items())),
        duration_ms=_non_negative_int("duration_ms", duration_ms, MAX_DURATION_MS),
    )


def new_turn_failed_event(
    context_id: object,
    turn_id: TurnId,
    config_version: object,
    duration_ms: object,
) -> InteractionEvent:
    return InteractionEvent(
        type=InteractionEventType.TURN_FAILED,
        context_id=new_context_id(context_id),
        turn_id=turn_id,
        config_version=_config_version(config_version),
        duration_ms=_non_negative_int("duration_ms", duration_ms, MAX_DURATION_MS),
    )


def new_client_interaction_event(
    event_type: object,
    context_id: object,
    turn_id: object = None,
    rank: object = None,
    marketplace: object = None,
    price_yen: object = None,
) -> InteractionEvent:
    """ブラウザから届いた反応を検証する。サーバーが記録する種類は受け付けない。"""
    try:
        parsed_type = InteractionEventType(event_type)
    except ValueError:
        raise ValueError(f"unsupported event type: {event_type}") from None
    if parsed_type not in CLIENT_EVENT_TYPES:
        raise ValueError(f"event type is not accepted from clients: {event_type}")

    parsed_turn_id = new_turn_id(turn_id) if turn_id is not None else None

    if parsed_type is InteractionEventType.PRODUCT_CLICK:
        if parsed_turn_id is None:
            raise ValueError("product_click requires turn_id")
        if rank is None:
            raise ValueError("product_click requires rank")
        parsed_rank = _non_negative_int("rank", rank, MAX_PRODUCT_RANK)
        if parsed_rank < 1:
            raise ValueError("rank must be at least 1")
        return InteractionEvent(
            type=parsed_type,
            context_id=new_context_id(context_id),
            turn_id=parsed_turn_id,
            rank=parsed_rank,
            marketplace=_marketplace_code(marketplace) if marketplace is not None else None,
            price_yen=_non_negative_int("price_yen", price_yen) if price_yen is not None else None,
        )

    return InteractionEvent(
        type=parsed_type,
        context_id=new_context_id(context_id),
        turn_id=parsed_turn_id,
    )
