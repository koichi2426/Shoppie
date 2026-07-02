from domain.entities.conversation_thread import ConversationRepository
from domain.value_objects.context_id import ContextId
from infrastructure.gateways.langgraph.langgraph_agent import delete_thread_memory


class LangGraphConversationRepository:
    def delete(self, thread_id: ContextId) -> bool:
        return delete_thread_memory(thread_id.value)
