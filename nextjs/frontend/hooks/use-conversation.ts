import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationTurn } from '@/types/conversation';
import type { RequestAssistanceResponse } from '@/types/api';
import { clientLogger } from '@/lib/client-logger';
import {
  fetchHistoryFromBackend,
  loadHistory,
  saveHistory,
} from '@/lib/conversation-storage';

interface UseConversationOptions {
  ensureContextId: () => string;
  resetContextId: () => string;
}

export function useConversation({ ensureContextId, resetContextId }: UseConversationOptions) {
  const [historyTurns, setHistoryTurns] = useState<ConversationTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    const contextId = ensureContextId();
    const local = loadHistory(contextId);
    if (local.length > 0) {
      setHistoryTurns(local);
      return;
    }

    fetchHistoryFromBackend(contextId).then((remote) => {
      if (remote.length > 0) {
        setHistoryTurns(remote);
        saveHistory(contextId, remote);
      }
    });
  }, [ensureContextId]);

  useEffect(() => {
    if (historyTurns.length === 0) return;
    saveHistory(ensureContextId(), historyTurns);
  }, [historyTurns, ensureContextId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [historyTurns, loading]);

  const appendTurn = useCallback((turn: ConversationTurn) => {
    setHistoryTurns((current) => [...current, turn]);
  }, []);

  const submitSearch = useCallback(
    async (text: string) => {
      if (!text.trim() || loadingRef.current) return;

      const trimmed = text.trim();
      const startedAt = Date.now();
      loadingRef.current = true;
      setLoading(true);

      clientLogger.info('search start', {
        text: trimmed,
        contextId: ensureContextId(),
      });

      try {
        const res = await fetch('/api/request-assistance', {
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
          appendTurn({
            id: crypto.randomUUID(),
            userMessage: trimmed,
            assistantMessage:
              data.error || '申し訳ありません、現在商品をご案内できませんでした。',
            products: [],
            timestamp: new Date().toISOString(),
          });
          return;
        }

        const { response } = data;
        clientLogger.info('search completed', {
          durationMs,
          status: res.status,
          productCount: response.products?.length ?? 0,
          messagePreview: response.message?.slice(0, 80),
        });
        appendTurn({
          id: crypto.randomUUID(),
          userMessage: trimmed,
          assistantMessage:
            response.message || `「${trimmed}」へのおすすめ商品をご紹介します。`,
          products: response.products ?? [],
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        clientLogger.error('search error', {
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
        appendTurn({
          id: crypto.randomUUID(),
          userMessage: trimmed,
          assistantMessage:
            '申し訳ありません、現在商品をご案内できませんでした。（サーバーへの接続に失敗しました）',
          products: [],
          timestamp: new Date().toISOString(),
        });
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [appendTurn, ensureContextId]
  );

  const startNewConversation = useCallback(() => {
    if (loadingRef.current) return false;
    if (
      historyTurns.length > 0 &&
      !window.confirm('会話履歴を消して新しい会話を始めますか？')
    ) {
      return false;
    }
    const newContextId = resetContextId();
    setHistoryTurns([]);
    saveHistory(newContextId, []);
    return true;
  }, [historyTurns.length, resetContextId]);

  return {
    historyTurns,
    loading,
    loadingRef,
    chatEndRef,
    submitSearch,
    startNewConversation,
  };
}
