import logging
from collections import defaultdict
from urllib.parse import urlparse

logger = logging.getLogger("shoppie.products")

MARKETPLACE_ORDER = ("yahoo", "rakuten", "amazon")

MARKETPLACE_LABELS = {
    "yahoo": "Yahoo",
    "rakuten": "楽天",
    "amazon": "Amazon",
}


def detect_marketplace(item: dict) -> str | None:
    explicit = item.get("marketplace")
    if isinstance(explicit, str) and explicit:
        return explicit.lower()

    if item.get("is_amazon_search_link"):
        return "amazon"

    url = (item.get("url") or item.get("affiliate_url") or "").lower()
    if not url:
        return None

    host = urlparse(url).netloc
    if "amazon.co.jp" in host or host.endswith("amazon.co.jp"):
        return "amazon"
    if "rakuten.co.jp" in host:
        return "rakuten"
    if "yahoo" in host or "valuecommerce.com" in host:
        return "yahoo"
    return None


def curate_products(items: list[dict]) -> list[dict]:
    """ツール結果を画面表示用に正規化する（件数は絞らない）。"""
    if not items:
        return []

    normalized: list[dict] = []
    by_marketplace: dict[str, int] = defaultdict(int)

    for item in items:
        if not isinstance(item, dict):
            continue
        marketplace = detect_marketplace(item)
        if marketplace:
            enriched = {**item, "marketplace": marketplace}
            by_marketplace[marketplace] += 1
        else:
            enriched = item
        normalized.append(enriched)

    active = [name for name in MARKETPLACE_ORDER if by_marketplace.get(name)]
    logger.info(
        "product curation input=%s output=%s by_marketplace=%s",
        len(items),
        len(normalized),
        {name: by_marketplace[name] for name in active},
    )
    return normalized
