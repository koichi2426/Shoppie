import type { Product } from '@/types/api';

/** フロントエンドの会話ターン（localStorage 用・camelCase） */
export interface ConversationTurn {
  id: string;
  userMessage: string;
  assistantMessage: string;
  products: Product[];
  timestamp: string;
}
