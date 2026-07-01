export type AgentSpeechMode = 'message' | 'loading' | 'listening' | 'hint' | 'status';

interface AgentSpeechBubbleProps {
  text: string;
  mode?: AgentSpeechMode;
}

export function AgentSpeechBubble({
  text,
  mode = 'message',
}: AgentSpeechBubbleProps) {
  const isMessage = mode === 'message';
  const isLoading = mode === 'loading';

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 w-max max-w-[min(88vw,340px)] pointer-events-none shoppie-no-select">
      <div
        key={`${mode}-${text.slice(0, 48)}`}
        className={`relative backdrop-blur-md border shadow-xl animate-hint-pop ${
          isMessage
            ? 'bg-gradient-to-br from-purple-500/25 via-violet-500/20 to-cyan-500/15 border-purple-400/30 rounded-2xl px-4 py-3'
            : mode === 'hint'
              ? 'bg-slate-900/90 border-white/20 rounded-full px-4 py-1.5'
              : 'bg-slate-900/95 border-white/20 rounded-2xl px-4 py-2.5'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" />
              <div
                className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                style={{ animationDelay: '0.1s' }}
              />
              <div
                className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce"
                style={{ animationDelay: '0.2s' }}
              />
            </div>
            <span className="text-xs sm:text-sm text-white/80">{text}</span>
          </div>
        ) : (
          <p
            className={`leading-relaxed whitespace-pre-wrap break-words ${
              isMessage
                ? 'text-sm sm:text-base text-white/95'
                : mode === 'hint'
                  ? 'text-xs sm:text-sm text-white/90 text-center'
                  : 'text-xs sm:text-sm text-white/90 text-center'
            }`}
          >
            {text}
          </p>
        )}
        <div
          className={`absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[9px] border-r-[9px] border-t-[9px] border-l-transparent border-r-transparent ${
            isMessage ? 'border-t-purple-500/30' : 'border-t-white/20'
          }`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
