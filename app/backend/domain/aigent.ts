import { UserUtterance } from './user_utterance';
import { AgentResponse } from './agent_response';

export interface AIgent {
  name: string;
  respond(utterance: UserUtterance): Promise<AgentResponse>;
}
