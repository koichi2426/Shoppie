import { useEffect, useRef } from 'react';
import type { SessionTurn } from '@/types/api';

function formatTime(value: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface SessionHistoryDrawerProps {
  turns: SessionTurn[];
  loading: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export function SessionHistoryDrawer({
  turns,
  loading,
  open,
  onOpen,
  onClose,
}: SessionHistoryDrawerProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, turns]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? onClose() : onOpen())}
        aria-label={open ? '会話履歴を閉じる' : '会話履歴を開く'}
        className={`fixed right-0 top-1/2 z-40 -translate-y-1/2 flex flex-col items-center gap-1 rounded-l-2xl border border-white/20 border-r-0 px-2.5 py-4 shadow-lg backdrop-blur-md transition-all ${
          open
            ? 'bg-purple-900/90 text-white'
            : 'bg-black/40 text-gray-200 hover:bg-black/60 hover:text-white'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span className="text-[10px] font-semibold tracking-wide [writing-mode:vertical-rl]">
          履歴
        </span>
        {turns.length > 0 && (
          <span className="mt-1 min-w-[1.25rem] rounded-full bg-cyan-500 px-1.5 py-0.5 text-[10px] font-bold text-white [writing-mode:horizontal-tb]">
            {turns.length}
          </span>
        )}
      </button>

      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          aria-label="会話履歴を閉じる"
        />

        <aside
          className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="会話履歴"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-white">会話履歴</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {loading ? '読み込み中...' : `${turns.length}件のやりとり`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 p-2 text-gray-400 hover:bg-white/5 hover:text-white"
              aria-label="閉じる"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
            {loading && turns.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-12">会話履歴を読み込み中...</p>
            ) : turns.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-12">
                まだ会話履歴がありません。
                <br />
                検索するとここに表示されます。
              </p>
            ) : (
              turns.map((turn, index) => (
                <div key={`${turn.timestamp}-${index}`} className="space-y-3">
                  <div className="flex justify-end">
                    <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-cyan-600/50 to-purple-600/50 border border-cyan-400/20 px-3.5 py-2.5">
                      <p className="text-sm text-white whitespace-pre-wrap">{turn.user_message}</p>
                      <p className="text-[10px] text-gray-400 mt-1 text-right">
                        {formatTime(turn.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-white/10 border border-white/10 px-3.5 py-2.5">
                      <p className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">
                        {turn.assistant_message || '（応答なし）'}
                      </p>
                      {turn.product_count > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-xs text-gray-400 mb-2">商品 {turn.product_count} 件</p>
                          <ul className="space-y-1.5">
                            {(turn.products_preview ?? []).map((product, productIndex) => (
                              <li
                                key={`${product.title}-${productIndex}`}
                                className="text-xs text-gray-300 rounded-lg bg-black/20 px-2.5 py-1.5"
                              >
                                {product.title}
                                {product.price ? (
                                  <span className="text-emerald-400 ml-1">¥{product.price}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
        </aside>
      </div>
    </>
  );
}
