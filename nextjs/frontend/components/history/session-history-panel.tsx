import type { SessionTurn } from '@/types/api';

function formatDate(value: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface SessionHistoryPanelProps {
  turns: SessionTurn[];
  loading: boolean;
}

export function SessionHistoryPanel({ turns, loading }: SessionHistoryPanelProps) {
  if (loading && turns.length === 0) {
    return (
      <section className="relative w-full max-w-6xl z-10 mt-8">
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 text-center text-gray-400 text-sm">
          会話履歴を読み込み中...
        </div>
      </section>
    );
  }

  if (turns.length === 0) return null;

  return (
    <section className="relative w-full max-w-6xl z-10 mt-8">
      <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-center text-white">会話履歴</h2>
          <p className="text-xs text-gray-400 text-center mt-1">
            このセッションの過去のやりとり（{turns.length}件）
          </p>
        </div>
        <div className="p-6 space-y-4 max-h-[480px] overflow-y-auto">
          {turns.map((turn, index) => (
            <div
              key={`${turn.timestamp}-${index}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-sm font-semibold text-cyan-300">
                  「{turn.user_message}」
                </p>
                <span className="text-xs text-gray-500 shrink-0">
                  {formatDate(turn.timestamp)}
                </span>
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed mb-3">
                {turn.assistant_message || '（応答なし）'}
              </p>
              {turn.product_count > 0 && (
                <div className="text-xs text-gray-400">
                  商品 {turn.product_count} 件
                  {(turn.products_preview ?? []).length > 0 && (
                    <ul className="mt-2 space-y-1 text-gray-300">
                      {(turn.products_preview ?? []).map((product, productIndex) => (
                        <li key={`${product.title}-${productIndex}`}>
                          ・{product.title}
                          {product.price ? `（¥${product.price}）` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
