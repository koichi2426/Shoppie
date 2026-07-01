interface ChatInputBarProps {
  textInput: string;
  loading: boolean;
  isListening: boolean;
  isRecognitionSupported: boolean;
  transcript: string;
  onTextChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onMicTap: () => void;
}

export function ChatInputBar({
  textInput,
  loading,
  isListening,
  isRecognitionSupported,
  transcript,
  onTextChange,
  onSubmit,
  onMicTap,
}: ChatInputBarProps) {
  return (
    <div className="shrink-0 border-t border-white/10 bg-slate-900/80 backdrop-blur-xl px-4 py-3 sm:px-6 safe-area-pb">
      {transcript && (
        <p className="text-xs text-cyan-300/90 text-center mb-2 truncate px-2">
          🎤 {transcript}
        </p>
      )}
      <form onSubmit={onSubmit} className="flex items-center gap-2 max-w-3xl mx-auto">
        {isRecognitionSupported && (
          <button
            type="button"
            onClick={onMicTap}
            disabled={loading}
            aria-label={isListening ? '音声入力を停止' : '音声入力を開始'}
            className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              loading
                ? 'opacity-40 cursor-not-allowed bg-gray-600'
                : isListening
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/20'
                  : 'bg-white/10 hover:bg-white/15 border border-white/15'
            }`}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </button>
        )}
        <div className="flex-1 flex gap-2 items-center backdrop-blur-md bg-white/5 border border-white/20 rounded-2xl px-3 py-2 focus-within:border-cyan-400/40 transition-colors">
          <input
            type="text"
            value={textInput}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="メッセージを入力..."
            disabled={loading}
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none disabled:opacity-50 min-w-0"
          />
          <button
            type="submit"
            disabled={loading || !textInput.trim()}
            className="shrink-0 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold text-sm hover:from-cyan-400 hover:to-purple-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            送信
          </button>
        </div>
      </form>
    </div>
  );
}
