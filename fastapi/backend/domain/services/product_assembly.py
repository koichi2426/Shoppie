from domain.value_objects.marketplace import marketplace_from_item
from domain.value_objects.product import Product, new_product


class ProductAssemblyService:
    """ツール結果など外部表現から Product 値オブジェクトを組み立てる。"""

    def from_tool_item(self, item: dict) -> Product | None:
        if not isinstance(item, dict):
            return None

        title = item.get("title")
        if not isinstance(title, str) or not title.strip():
            return None

        is_search_link = bool(item.get("is_amazon_search_link"))
        marketplace = marketplace_from_item(item)

        try:
            return new_product(
                title=title,
                price=item.get("price", 0),
                image_urls=[item.get("image", "")] if item.get("image") else [],
                affiliate_url=item.get("url", ""),
                description=item.get("description"),
                marketplace=marketplace,
                allow_empty_url=is_search_link,
            )
        except ValueError:
            return None
