'use client';

import { useState } from 'react';

interface ChatInputBarProps {
  textInput: string;
  loading: boolean;
  isListening: boolean;
  isRecognitionSupported: boolean;
  micError?: string | null;
  onTextChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ChatInputBar({
  textInput,
  loading,
  isListening,
  isRecognitionSupported,
  micError,
  onTextChange,
  onSubmit,
}: ChatInputBarProps) {
  const [showKeyboard, setShowKeyboard] = useState(false);

  return (
    <div className="shrink-0 px-4 pt-1 pb-3 sm:px-6 safe-area-pb pointer-events-none">
      <div className="max-w-5xl mx-auto pointer-events-auto">
        {micError && (
          <p className="text-xs sm:text-sm text-amber-200/90 text-center mb-2 px-2 leading-relaxed">
            {micError}
          </p>
        )}

        {!showKeyboard ? (
          <div className="flex flex-col items-center gap-1 pt-1 pb-1">
            {isRecognitionSupported && (
              <p className="text-xs sm:text-sm text-white/50 text-center">
                {isListening ? '聞いてるよ…' : 'タップして話しかけてね（長押しで移動）'}
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowKeyboard(true)}
              disabled={loading}
              className="text-[11px] sm:text-xs text-white/35 hover:text-white/55 underline-offset-2 hover:underline transition-colors disabled:opacity-40"
            >
              キーボードで入力
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={textInput}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="メッセージを入力..."
              disabled={loading}
              autoFocus
              className="flex-1 min-w-0 bg-white/5 rounded-full px-4 text-white placeholder-gray-500 text-sm py-2 border border-white/10 focus:border-cyan-400/40 focus:outline-none transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !textInput.trim()}
              className="shrink-0 px-3 py-2 rounded-full bg-white/10 text-white/80 text-xs hover:bg-white/15 transition-all disabled:opacity-35 disabled:cursor-not-allowed"
            >
              送信
            </button>
            <button
              type="button"
              onClick={() => setShowKeyboard(false)}
              className="shrink-0 p-2 text-white/40 hover:text-white/70 text-xs"
              aria-label="キーボード入力を閉じる"
            >
              ✕
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
