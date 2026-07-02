from domain.services.product_assembly import ProductAssemblyService
from domain.value_objects.agent_response import AgentResponse, new_agent_response


class AgentResponseAssemblyService:
    def __init__(self, product_assembly: ProductAssemblyService | None = None) -> None:
        self._product_assembly = product_assembly or ProductAssemblyService()

    def build(self, message: str, curated_items: list[dict]) -> AgentResponse:
        products = []
        for item in curated_items:
            product = self._product_assembly.from_tool_item(item)
            if product is not None:
                products.append(product)

        return new_agent_response(message, products)
