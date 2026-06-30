import type { SessionTurn } from '@/types/api';
import { cleanAgentMessage } from '@/lib/clean-agent-message';

function turnKey(turn: SessionTurn) {
  return `${turn.timestamp}:${turn.user_message}`;
}

export function mergeSessionTurns(
  existing: SessionTurn[],
  incoming: SessionTurn[]
): SessionTurn[] {
  const merged = new Map<string, SessionTurn>();

  for (const turn of [...existing, ...incoming]) {
    const key = turnKey(turn);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, turn);
      continue;
    }
    const currentPreview = current.products_preview?.length ?? 0;
    const incomingPreview = turn.products_preview?.length ?? 0;
    if (
      incomingPreview > currentPreview ||
      (turn.assistant_message?.length ?? 0) > (current.assistant_message?.length ?? 0)
    ) {
      merged.set(key, turn);
    }
  }

  return Array.from(merged.values()).sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );
}

export function buildSessionTurn(
  userMessage: string,
  assistantMessage: string,
  products: Array<{ title: string; price: number }>
): SessionTurn {
  return {
    timestamp: new Date().toISOString(),
    user_message: userMessage,
    assistant_message: cleanAgentMessage(assistantMessage),
    product_count: products.length,
    products_preview: products.slice(0, 5).map((product) => ({
      title: product.title,
      price: String(product.price),
    })),
  };
}
