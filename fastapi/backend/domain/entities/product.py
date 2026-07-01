from dataclasses import dataclass


@dataclass
class Product:
    title: str
    price: int
    image_urls: list[str]
    affiliate_url: str
    description: str | None = None
    marketplace: str | None = None

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "price": self.price,
            "image_urls": self.image_urls,
            "affiliate_url": self.affiliate_url,
            "description": self.description,
            "marketplace": self.marketplace,
        }
