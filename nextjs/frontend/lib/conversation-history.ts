export interface Product {
  title: string;
  price: number;
  image_urls: string[];
  affiliate_url: string;
  description: string;
}

export interface ConversationTurn {
  id: string;
  userMessage: string;
  assistantMessage: string;
  products: Product[];
  timestamp: string;
}

interface BackendTurn {
  timestamp: string;
  user_message: string;
  assistant_message: string;
  product_count: number;
  products_preview: Array<{ title: string; price: string }>;
}

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

function backendTurnToConversationTurn(turn: BackendTurn): ConversationTurn {
  return {
    id: turn.timestamp,
    userMessage: turn.user_message,
    assistantMessage: turn.assistant_message,
    products: turn.products_preview.map((p) => ({
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
  const turns: BackendTurn[] = data.turns ?? [];
  return turns.map(backendTurnToConversationTurn);
}
