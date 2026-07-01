import { useCallback, useRef, useState } from 'react';
import type { Product, RequestAssistanceResponse } from '@/types/api';
import { getApiUrl } from '@/lib/api';
import { cleanAgentMessage } from '@/lib/clean-agent-message';
import { clientLogger } from '@/lib/client-logger';

export interface ConversationTurn {
  userMessage: string;
  assistantMessage: string;
  products: Product[];
}

interface UseSearchOptions {
  ensureContextId: () => string;
}

export function useSearch({ ensureContextId }: UseSearchOptions) {
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const submitSearch = useCallback(
    async (text: string) => {
      if (!text.trim() || loadingRef.current) return;

      const trimmed = text.trim();
      const startedAt = Date.now();
      loadingRef.current = true;
      setLoading(true);
      setPendingUserMessage(trimmed);
      setMessage('');
      setProducts([]);

      clientLogger.info('search start', {
        text: trimmed,
        contextId: ensureContextId(),
      });

      try {
        const res = await fetch(`${getApiUrl()}/request-assistance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: trimmed,
            context_id: ensureContextId(),
          }),
        });
        const data = (await res.json()) as RequestAssistanceResponse & { error?: string };
        const durationMs = Date.now() - startedAt;

        let assistantMessage: string;
        let nextProducts: Product[] = [];

        if (!res.ok || !data.response) {
          clientLogger.warn('search failed', {
            durationMs,
            status: res.status,
            error: data.error,
          });
          assistantMessage =
            data.error || 'ごめんね、今うまく探せなかった…もう一度試してみて？';
        } else {
          const { response } = data;
          assistantMessage = cleanAgentMessage(
            response.message || `「${trimmed}」、探してみるね！`
          );
          nextProducts = response.products ?? [];
          clientLogger.info('search completed', {
            durationMs,
            status: res.status,
            productCount: nextProducts.length,
            messagePreview: assistantMessage.slice(0, 80),
          });
        }

        setMessage(assistantMessage);
        setProducts(nextProducts);
        setTurns((current) => [
          ...current,
          {
            userMessage: trimmed,
            assistantMessage,
            products: nextProducts,
          },
        ]);
      } catch (error) {
        const assistantMessage =
          'ごめんね、つながらなかった…もう一度試してみて？';
        clientLogger.error('search error', {
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
        setMessage(assistantMessage);
        setTurns((current) => [
          ...current,
          {
            userMessage: trimmed,
            assistantMessage,
            products: [],
          },
        ]);
      } finally {
        setPendingUserMessage(null);
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [ensureContextId]
  );

  const inChatMode = turns.length > 0;

  const resetConversation = useCallback(() => {
    setTurns([]);
    setPendingUserMessage(null);
    setMessage('');
    setProducts([]);
    setLoading(false);
    loadingRef.current = false;
  }, []);

  return {
    turns,
    pendingUserMessage,
    message,
    products,
    loading,
    loadingRef,
    inChatMode,
    submitSearch,
    resetConversation,
  };
}
