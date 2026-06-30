import type { ConversationTurn } from '@/types/conversation';
import { ProductGrid } from './product-grid';

function formatTime(value: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ConversationTurnViewProps {
  turn: ConversationTurn;
}

export function ConversationTurnView({ turn }: ConversationTurnViewProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-cyan-600/40 to-purple-600/40 border border-cyan-400/20 px-4 py-3">
          <p className="text-sm text-white whitespace-pre-wrap">{turn.userMessage}</p>
          <p className="text-[10px] text-gray-400 mt-1 text-right">{formatTime(turn.timestamp)}</p>
        </div>
      </div>
      <div className="flex justify-start">
        <div className="max-w-[95%] rounded-2xl rounded-tl-sm backdrop-blur-lg bg-white/10 border border-white/10 px-4 py-3">
          <p className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">
            {turn.assistantMessage}
          </p>
          <ProductGrid products={turn.products} />
        </div>
      </div>
    </div>
  );
}
