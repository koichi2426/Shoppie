from dataclasses import dataclass
from urllib.parse import urlparse

MARKETPLACE_LABELS = {
    "yahoo": "Yahoo",
    "rakuten": "楽天",
    "amazon": "Amazon",
}


@dataclass(frozen=True, slots=True)
class Marketplace:
    code: str
    label: str


def new_marketplace(value: object) -> Marketplace:
    if not isinstance(value, str):
        raise ValueError("marketplace must be a string")

    normalized = value.strip().lower()
    if not normalized:
        raise ValueError("marketplace must not be empty")

    label = MARKETPLACE_LABELS.get(normalized)
    if label is None:
        raise ValueError(f"unsupported marketplace: {value}")

    return Marketplace(code=normalized, label=label)


def marketplace_from_item(item: dict) -> Marketplace | None:
    explicit = item.get("marketplace")
    if isinstance(explicit, str) and explicit.strip():
        try:
            return new_marketplace(explicit)
        except ValueError:
            label = explicit.strip()
            for code, known_label in MARKETPLACE_LABELS.items():
                if label.lower() == code or label == known_label:
                    return Marketplace(code=code, label=known_label)
            return None

    if item.get("is_amazon_search_link"):
        return Marketplace(code="amazon", label=MARKETPLACE_LABELS["amazon"])

    url = (item.get("url") or item.get("affiliate_url") or "").lower()
    if not url:
        return None

    host = urlparse(url).netloc
    if "amazon.co.jp" in host or host.endswith("amazon.co.jp"):
        return new_marketplace("amazon")
    if "rakuten.co.jp" in host:
        return new_marketplace("rakuten")
    if "yahoo" in host or "valuecommerce.com" in host:
        return new_marketplace("yahoo")

    return None
