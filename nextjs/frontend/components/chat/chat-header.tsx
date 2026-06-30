interface ChatHeaderProps {
  hasHistory: boolean;
  loading: boolean;
  onNewConversation: () => void;
}

export function ChatHeader({ hasHistory, loading, onNewConversation }: ChatHeaderProps) {
  return (
    <header className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur-md">
      <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Shoppie
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">話すだけで、買い物が進む</p>
        </div>
        {hasHistory && (
          <button
            type="button"
            onClick={onNewConversation}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/5 disabled:opacity-50 shrink-0"
          >
            新しい会話
          </button>
        )}
      </div>
    </header>
  );
}
