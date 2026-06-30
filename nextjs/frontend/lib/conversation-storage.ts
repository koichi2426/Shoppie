import type { ConversationTurn } from '@/types/conversation';
import type { SessionTurn } from '@/types/api';

function storageKey(contextId: string) {
  return `shoppie_history_${contextId}`;
}

export function loadHistory(contextId: string): ConversationTurn[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(contextId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(contextId: string, turns: ConversationTurn[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(contextId), JSON.stringify(turns));
  } catch {
    // quota exceeded などは無視
  }
}

function backendTurnToConversationTurn(turn: SessionTurn): ConversationTurn {
  return {
    id: turn.timestamp,
    userMessage: turn.user_message,
    assistantMessage: turn.assistant_message,
    products: (turn.products_preview ?? []).map((p) => ({
      title: p.title,
      price: Number(p.price) || 0,
      image_urls: [],
      affiliate_url: '',
      description: '',
    })),
    timestamp: turn.timestamp,
  };
}

export async function fetchHistoryFromBackend(
  contextId: string
): Promise<ConversationTurn[]> {
  const res = await fetch(`/api/admin/sessions/${encodeURIComponent(contextId)}`);
  if (!res.ok) return [];

  const data = await res.json();
  const turns: SessionTurn[] = data.turns ?? [];
  return turns.map(backendTurnToConversationTurn);
}
