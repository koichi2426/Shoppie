import { UserUtterance } from './user_utterance';

export interface User {
  utter(text: string, context_id: string): UserUtterance;
}
