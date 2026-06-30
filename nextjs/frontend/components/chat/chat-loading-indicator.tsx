export function ChatLoadingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-tl-sm backdrop-blur-lg bg-white/10 border border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
          <div
            className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
            style={{ animationDelay: '0.1s' }}
          />
          <div
            className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"
            style={{ animationDelay: '0.2s' }}
          />
          <span className="ml-1">商品を検索中...</span>
        </div>
      </div>
    </div>
  );
}
