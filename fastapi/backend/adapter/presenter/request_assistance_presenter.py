from domain.value_objects.agent_response import AgentResponse


class RequestAssistancePresenter:
    @staticmethod
    def output(response: AgentResponse) -> dict:
        return {"response": response.to_dict()}
