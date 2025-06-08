import { User } from '@/app/backend/domain/user';
import { UserUtterance } from '@/app/backend/domain/user_utterance';
import { AIgent } from '@/app/backend/domain/aigent';
import { AgentResponse } from '@/app/backend/domain/agent_response';

export interface RequestAssistanceInput {
  utterance: UserUtterance;
}

export interface RequestAssistanceOutput {
  response: AgentResponse;
}

export interface RequestAssistancePresenter {
  output(response: AgentResponse): RequestAssistanceOutput;
}

export interface RequestAssistanceUseCase {
  execute(input: RequestAssistanceInput): Promise<RequestAssistanceOutput>;
}

export function NewRequestAssistanceInteractor(
    user: User,
    aigent: AIgent,
    presenter: RequestAssistancePresenter
  ): RequestAssistanceUseCase {
    return new RequestAssistanceInteractor(user, aigent, presenter);
  }
  

export class RequestAssistanceInteractor implements RequestAssistanceUseCase {
    constructor(
      private readonly user: User,
      private readonly aigent: AIgent,
      private readonly presenter: RequestAssistancePresenter
    ) {}
  
    async execute(input: RequestAssistanceInput): Promise<RequestAssistanceOutput> {
      const utterance: UserUtterance = this.user.utter(
        input.utterance.text,
        input.utterance.context_id
      );

      const response: AgentResponse = await this.aigent.respond(utterance);

      return this.presenter.output(response);
    }
  }