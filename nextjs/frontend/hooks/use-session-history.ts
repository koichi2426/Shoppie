import { useCallback, useEffect, useState } from 'react';
import type { SessionTurn } from '@/types/api';
import { fetchSession } from '@/lib/session-api';

export function useSessionHistory(contextId: string) {
  const [turns, setTurns] = useState<SessionTurn[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!contextId) return;
    setLoading(true);
    try {
      const session = await fetchSession(contextId);
      setTurns(session?.turns ?? []);
    } catch {
      setTurns([]);
    } finally {
      setLoading(false);
    }
  }, [contextId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { turns, loading, refresh };
}
