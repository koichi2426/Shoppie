from dataclasses import dataclass

from domain.value_objects.affiliate_url import AffiliateUrl, new_affiliate_url
from domain.value_objects.image_url import ImageUrl, new_image_url
from domain.value_objects.marketplace import Marketplace
from domain.value_objects.price import Price, new_price
from domain.value_objects.product_title import ProductTitle, new_product_title


@dataclass(frozen=True, slots=True)
class Product:
    title: ProductTitle
    price: Price
    image_urls: tuple[ImageUrl, ...]
    affiliate_url: AffiliateUrl
    description: str | None
    marketplace: Marketplace | None

    def to_dict(self) -> dict:
        return {
            "title": self.title.value,
            "price": self.price.yen,
            "image_urls": [image.value for image in self.image_urls],
            "affiliate_url": self.affiliate_url.value,
            "description": self.description,
            "marketplace": self.marketplace.label if self.marketplace else None,
        }


def new_product(
    title: str,
    price: object,
    image_urls: list[str] | None,
    affiliate_url: str,
    description: str | None = None,
    marketplace: Marketplace | None = None,
    *,
    allow_empty_url: bool = False,
) -> Product:
    title_vo = new_product_title(title)
    price_vo = new_price(price)
    url_vo = new_affiliate_url(affiliate_url, allow_empty=allow_empty_url)

    images: list[ImageUrl] = []
    for raw_url in image_urls or []:
        try:
            images.append(new_image_url(raw_url))
        except ValueError:
            continue

    normalized_description = description.strip() if isinstance(description, str) and description.strip() else None

    return Product(
        title=title_vo,
        price=price_vo,
        image_urls=tuple(images),
        affiliate_url=url_vo,
        description=normalized_description,
        marketplace=marketplace,
    )
