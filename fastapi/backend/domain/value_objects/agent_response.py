from dataclasses import dataclass

from domain.value_objects.agent_message import AgentMessage, new_agent_message
from domain.value_objects.product import Product


@dataclass(frozen=True, slots=True)
class AgentResponse:
    message: AgentMessage
    products: tuple[Product, ...]

    def to_dict(self) -> dict:
        return {
            "message": self.message.value,
            "products": [product.to_dict() for product in self.products],
        }


def new_agent_response(message: str, products: list[Product]) -> AgentResponse:
    return AgentResponse(
        message=new_agent_message(message),
        products=tuple(products),
    )
