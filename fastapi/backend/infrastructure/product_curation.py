import logging
import math
from collections import defaultdict
from urllib.parse import urlparse

logger = logging.getLogger("shoppie.products")

MAX_DISPLAY_PRODUCTS = 20

MARKETPLACE_ORDER = ("yahoo", "rakuten", "amazon")

MARKETPLACE_LABELS = {
    "yahoo": "Yahoo",
    "rakuten": "楽天",
    "amazon": "Amazon",
}


def _parse_price(price_raw) -> int:
    if isinstance(price_raw, int):
        return price_raw
    digits = "".join(char for char in str(price_raw) if char.isdigit())
    return int(digits) if digits else 0


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


def _score_product(item: dict, original_index: int) -> float:
    if item.get("is_amazon_search_link"):
        return -1000 + original_index * 0.001

    score = 1000 - original_index

    price = _parse_price(item.get("price", 0))
    if price > 0:
        score += 50

    review_rate = item.get("review_rate")
    if review_rate is not None:
        try:
            score += float(review_rate) * 20
        except (TypeError, ValueError):
            pass

    review_count = item.get("review_count")
    if review_count is not None:
        try:
            score += min(math.log10(max(int(review_count), 1) + 1) * 15, 45)
        except (TypeError, ValueError):
            pass

    image = item.get("image") or (item.get("image_urls") or [None])[0]
    if image and image not in ("画像なし", ""):
        score += 5

    return score


def curate_products(items: list[dict], max_total: int = MAX_DISPLAY_PRODUCTS) -> list[dict]:
    """各モールからバランスよく厳選し、表示件数を抑える。"""
    if not items:
        return []

    grouped: dict[str, list[tuple[int, dict]]] = defaultdict(list)
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        marketplace = detect_marketplace(item)
        if not marketplace:
            continue
        enriched = {**item, "marketplace": marketplace}
        grouped[marketplace].append((index, enriched))

    active = [name for name in MARKETPLACE_ORDER if grouped.get(name)]
    if not active:
        return items[:max_total]

    base_quota = max_total // len(active)
    remainder = max_total % len(active)

    curated: list[dict] = []
    for marketplace in active:
        quota = base_quota + (1 if remainder > 0 else 0)
        if remainder > 0:
            remainder -= 1

        pool = grouped[marketplace]
        pool.sort(key=lambda entry: -_score_product(entry[1], entry[0]))
        curated.extend(item for _, item in pool[:quota])

    logger.info(
        "product curation input=%s output=%s by_marketplace=%s",
        len(items),
        len(curated),
        {name: sum(1 for p in curated if p.get("marketplace") == name) for name in active},
    )
    return curated[:max_total]
