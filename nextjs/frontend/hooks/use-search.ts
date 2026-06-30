import { useCallback, useRef, useState } from 'react';
import type { Product, RequestAssistanceResponse } from '@/types/api';
import { getApiUrl } from '@/lib/admin-api';
import { cleanAgentMessage } from '@/lib/clean-agent-message';
import { clientLogger } from '@/lib/client-logger';

interface CompletedSearch {
  userMessage: string;
  assistantMessage: string;
  products: Product[];
}

interface UseSearchOptions {
  ensureContextId: () => string;
  onSearchComplete?: (result: CompletedSearch) => void;
}

export function useSearch({ ensureContextId, onSearchComplete }: UseSearchOptions) {
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const resultsRef = useRef<HTMLElement>(null);

  const submitSearch = useCallback(
    async (text: string) => {
      if (!text.trim() || loadingRef.current) return;

      const trimmed = text.trim();
      const startedAt = Date.now();
      loadingRef.current = true;
      setLoading(true);
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

        if (!res.ok || !data.response) {
          clientLogger.warn('search failed', {
            durationMs,
            status: res.status,
            error: data.error,
          });
          setMessage(data.error || '申し訳ありません、現在商品をご案内できませんでした。');
          return;
        }

        const { response } = data;
        const assistantMessage = cleanAgentMessage(
          response.message || `「${trimmed}」へのおすすめ商品をご紹介します。`
        );
        clientLogger.info('search completed', {
          durationMs,
          status: res.status,
          productCount: response.products?.length ?? 0,
          messagePreview: assistantMessage.slice(0, 80),
        });
        setMessage(assistantMessage);
        setProducts(response.products ?? []);
        onSearchComplete?.({
          userMessage: trimmed,
          assistantMessage,
          products: response.products ?? [],
        });
      } catch (error) {
        clientLogger.error('search error', {
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
        setMessage(
          '申し訳ありません、現在商品をご案内できませんでした。（サーバーへの接続に失敗しました）'
        );
      } finally {
        loadingRef.current = false;
        setLoading(false);
        requestAnimationFrame(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    },
    [ensureContextId, onSearchComplete]
  );

  const clearResults = useCallback(() => {
    setProducts([]);
    setMessage('');
  }, []);

  return {
    products,
    message,
    loading,
    loadingRef,
    resultsRef,
    submitSearch,
    clearResults,
  };
}
