import logging
from collections import defaultdict

from domain.value_objects.marketplace import marketplace_from_item

logger = logging.getLogger("shoppie.products")

MARKETPLACE_ORDER = ("yahoo", "rakuten", "amazon")


class ProductCurationService:
    """ツール結果を画面表示用に正規化する（件数は絞らない）。"""

    def curate(self, items: list[dict]) -> list[dict]:
        if not items:
            return []

        normalized: list[dict] = []
        by_marketplace: dict[str, int] = defaultdict(int)

        for item in items:
            if not isinstance(item, dict):
                continue
            marketplace = marketplace_from_item(item)
            if marketplace:
                enriched = {**item, "marketplace": marketplace.code}
                by_marketplace[marketplace.code] += 1
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
