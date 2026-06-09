import { User } from '@/app/backend/domain/user';
import { UserUtterance } from '@/app/backend/domain/user_utterance';

export class DefaultUser implements User {
  utter(text: string, context_id: string): UserUtterance {
    return { text, context_id };
  }
}
