interface ChatInputBarProps {
  textInput: string;
  loading: boolean;
  isListening: boolean;
  isRecognitionSupported: boolean;
  transcript: string;
  onTextChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onMicTap: () => void;
  showMic?: boolean;
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
  showMic = false,
}: ChatInputBarProps) {
  return (
    <div className="shrink-0 px-4 pt-2 pb-3 sm:px-6 safe-area-pb bg-gradient-to-t from-slate-900/70 via-slate-900/30 to-transparent">
      {transcript && (
        <p className="text-xs text-cyan-300/90 text-center mb-2 truncate px-2">
          🎤 {transcript}
        </p>
      )}
      <form onSubmit={onSubmit} className="flex items-center gap-3 max-w-3xl mx-auto">
        {showMic && isRecognitionSupported && (
          <button
            type="button"
            onClick={onMicTap}
            disabled={loading}
            aria-label={isListening ? '音声入力を停止' : '音声入力を開始'}
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              loading
                ? 'opacity-40 cursor-not-allowed bg-gray-600'
                : isListening
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/20'
                  : 'bg-white/10 hover:bg-white/15'
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
        <input
          type="text"
          value={textInput}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="メッセージを入力..."
          disabled={loading}
          className="flex-1 min-w-0 bg-transparent text-white placeholder-gray-500 text-sm py-2.5 border-b border-white/20 focus:border-cyan-400/50 focus:outline-none transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !textInput.trim()}
          className="shrink-0 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold text-sm hover:from-cyan-400 hover:to-purple-400 transition-all disabled:opacity-35 disabled:cursor-not-allowed"
        >
          送信
        </button>
      </form>
    </div>
  );
}
