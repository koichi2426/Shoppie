import { useCallback, useEffect, useState } from 'react';
import type { SessionTurn } from '@/types/api';
import { fetchSession } from '@/lib/session-api';
import { mergeSessionTurns } from '@/lib/session-turns';

export function useSessionHistory(contextId: string) {
  const [turns, setTurns] = useState<SessionTurn[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!contextId) return;
    setLoading(true);
    try {
      const session = await fetchSession(contextId);
      if (session?.turns) {
        setTurns((current) => mergeSessionTurns(current, session.turns ?? []));
      }
    } catch {
      // 404 やワーカー不一致時も既存の表示は維持する
    } finally {
      setLoading(false);
    }
  }, [contextId]);

  const appendTurn = useCallback((turn: SessionTurn) => {
    setTurns((current) => mergeSessionTurns(current, [turn]));
  }, []);

  useEffect(() => {
    setTurns([]);
    refresh();
  }, [contextId, refresh]);

  return { turns, loading, refresh, appendTurn };
}
