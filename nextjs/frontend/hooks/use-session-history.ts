import { useCallback, useEffect, useState } from 'react';
import type { SessionTurn } from '@/types/api';
import { cleanAgentMessage } from '@/lib/clean-agent-message';
import { fetchSession } from '@/lib/session-api';
import { mergeSessionTurns } from '@/lib/session-turns';

function cleanTurn(turn: SessionTurn): SessionTurn {
  return {
    ...turn,
    assistant_message: cleanAgentMessage(turn.assistant_message),
  };
}

export function useSessionHistory(contextId: string) {
  const [turns, setTurns] = useState<SessionTurn[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!contextId) return;
    setLoading(true);
    try {
      const session = await fetchSession(contextId);
      if (session?.turns) {
        const cleaned = (session.turns ?? []).map(cleanTurn);
        setTurns((current) => mergeSessionTurns(current, cleaned));
      }
    } catch {
      // 404 やワーカー不一致時も既存の表示は維持する
    } finally {
      setLoading(false);
    }
  }, [contextId]);

  useEffect(() => {
    setTurns([]);
    refresh();
  }, [contextId, refresh]);

  return { turns, loading, refresh };
}
