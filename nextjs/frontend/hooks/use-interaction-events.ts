import { useCallback } from 'react';
import type { Product } from '@/types/api';
import { sendInteractionEvent } from '@/lib/interaction-events';

interface UseInteractionEventsOptions {
  ensureContextId: () => string;
}

// 提案した商品が押されたか、会話をやり直されたかを、返答の turn_id に結び付けて記録する。
// 発話の本文は送らない。
export function useInteractionEvents({ ensureContextId }: UseInteractionEventsOptions) {
  const recordProductClick = useCallback(
    (turnId: string | null, product: Product, rank: number) => {
      if (!turnId) return;
      sendInteractionEvent({
        type: 'product_click',
        context_id: ensureContextId(),
        turn_id: turnId,
        rank,
        marketplace: product.marketplace ?? null,
        // Amazon の検索リンクは価格を持たない(0)ので送らない
        price_yen: product.price > 0 ? product.price : null,
      });
    },
    [ensureContextId]
  );

  const recordConversationReset = useCallback(
    (contextId: string, lastTurnId: string | null) => {
      sendInteractionEvent({
        type: 'conversation_reset',
        context_id: contextId,
        turn_id: lastTurnId,
      });
    },
    []
  );

  return { recordProductClick, recordConversationReset };
}
