import {RequestAssistancePresenter,RequestAssistanceOutput} from '@/app/backend/usecase/request_assistance_usecase';
import { AgentResponse } from '@/app/backend/domain/agent_response';
  
export class DefaultRequestAssistancePresenter implements RequestAssistancePresenter {
    output(response: AgentResponse): RequestAssistanceOutput {
        return {
            response
        };
    }
}