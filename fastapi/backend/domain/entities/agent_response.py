from dataclasses import dataclass

from domain.entities.product import Product


@dataclass
class AgentResponse:
    message: str
    products: list[Product]

    def to_dict(self) -> dict:
        return {
            "message": self.message,
            "products": [product.to_dict() for product in self.products],
        }
