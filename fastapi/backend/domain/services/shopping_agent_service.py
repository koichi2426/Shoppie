from typing import Protocol

from domain.value_objects.shopping_agent_result import ShoppingAgentResult


class ShoppingAgentService(Protocol):
    """商品検索エージェントへの問い合わせ（実装はインフラ層）。"""

    async def run(self, user_text: str, thread_id: str) -> ShoppingAgentResult:
        ...
