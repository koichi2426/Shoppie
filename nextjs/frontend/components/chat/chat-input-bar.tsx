interface ChatInputBarProps {
  loading: boolean;
  textInput: string;
  transcript: string;
  isListening: boolean;
  isRecognitionSupported: boolean;
  onTextInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onMicToggle: () => void;
}

export function ChatInputBar({
  loading,
  textInput,
  transcript,
  isListening,
  isRecognitionSupported,
  onTextInputChange,
  onSubmit,
  onMicToggle,
}: ChatInputBarProps) {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-black/30 backdrop-blur-md">
      <div className="mx-auto max-w-4xl px-4 py-4 space-y-3">
        {transcript && (
          <div className="px-3 py-2 bg-cyan-500/10 border border-cyan-400/30 rounded-xl text-sm text-center">
            💬 &quot;{transcript}&quot;
          </div>
        )}

        <div className="flex items-center gap-3">
          {isRecognitionSupported && (
            <button
              type="button"
              onClick={onMicToggle}
              disabled={loading}
              aria-label={isListening ? '音声入力を停止' : '音声入力を開始'}
              className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                loading
                  ? 'opacity-50 cursor-not-allowed bg-gray-600'
                  : isListening
                    ? 'bg-gradient-to-r from-red-500 to-pink-500'
                    : 'bg-gradient-to-r from-cyan-500 to-purple-500'
              }`}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </button>
          )}

          <form onSubmit={onSubmit} className="flex-1">
            <div className="flex gap-2 items-center backdrop-blur-md bg-white/5 border border-white/20 rounded-2xl p-2 focus-within:border-cyan-400/50">
              <input
                type="text"
                value={textInput}
                onChange={(e) => onTextInputChange(e.target.value)}
                placeholder="キーワードを入力（例：ヒレ肉）"
                disabled={loading}
                className="flex-1 bg-transparent text-white placeholder-gray-400 px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !textInput.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                送信
              </button>
            </div>
          </form>
        </div>

        {isRecognitionSupported && (
          <p className="text-center text-xs text-gray-500">
            {loading
              ? '検索中...'
              : isListening
                ? '聞いています — 話し終わると自動で検索します'
                : 'マイクボタンで音声入力'}
          </p>
        )}
      </div>
    </footer>
  );
}
