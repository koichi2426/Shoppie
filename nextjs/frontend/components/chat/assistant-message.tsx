interface AssistantMessageProps {
  message: string;
  isLatest?: boolean;
}

export function AssistantMessage({
  message,
  isLatest = false,
}: AssistantMessageProps) {
  return (
    <div
      className={`flex justify-start max-w-[90%] ${isLatest ? 'animate-hint-pop' : ''}`}
    >
      <p
        className={`rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words border ${
          isLatest
            ? 'bg-gradient-to-br from-purple-500/15 via-violet-500/10 to-cyan-500/5 border-purple-400/20'
            : 'bg-white/5 border-white/10'
        }`}
      >
        {message}
      </p>
    </div>
  );
}

export function AssistantTypingIndicator() {
  return (
    <div className="flex justify-start animate-hint-pop">
      <div className="rounded-2xl rounded-bl-md bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-2">
        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
        <div
          className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
          style={{ animationDelay: '0.1s' }}
        />
        <div
          className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"
          style={{ animationDelay: '0.2s' }}
        />
      </div>
    </div>
  );
}
