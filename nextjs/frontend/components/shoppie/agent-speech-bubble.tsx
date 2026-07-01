import { ThinkingIndicator } from '@/components/shoppie/thinking-indicator';

export type AgentSpeechMode = 'message' | 'loading' | 'listening' | 'hint' | 'status';

interface AgentSpeechBubbleProps {
  text: string;
  mode?: AgentSpeechMode;
  layout?: 'floating' | 'stacked';
  showTail?: boolean;
}

export function AgentSpeechBubble({
  text,
  mode = 'message',
  layout = 'floating',
  showTail = true,
}: AgentSpeechBubbleProps) {
  const isMessage = mode === 'message';
  const isLoading = mode === 'loading';
  const shouldPop = mode === 'hint';

  const bubble = (
    <div
      key={`${mode}-${text.slice(0, 48)}`}
      className={`relative backdrop-blur-xl border shadow-2xl ${shouldPop ? 'animate-hint-pop' : ''} ${
        isMessage
          ? 'bg-slate-950/96 border-purple-300/35 rounded-2xl px-4 py-3 ring-1 ring-white/10'
          : mode === 'hint'
            ? 'bg-slate-950/94 border-cyan-300/30 rounded-full px-4 py-1.5 ring-1 ring-cyan-400/15'
            : 'bg-slate-950/96 border-white/25 rounded-2xl px-4 py-2.5 ring-1 ring-white/10'
      }`}
    >
        {isLoading ? (
          <ThinkingIndicator />
        ) : (
          <p
            className={`leading-relaxed whitespace-pre-wrap break-words ${
              isMessage
                ? 'text-sm sm:text-base text-white'
                : mode === 'hint'
                  ? 'text-xs sm:text-sm text-white text-center'
                  : 'text-xs sm:text-sm text-white text-center'
            }`}
          >
            {text}
          </p>
        )}
      {showTail && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[9px] border-r-[9px] border-t-[9px] border-l-transparent border-r-transparent border-t-slate-950"
          aria-hidden="true"
        />
      )}
    </div>
  );

  if (layout === 'stacked') {
    return bubble;
  }

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 w-max max-w-[min(88vw,340px)] pointer-events-none shoppie-no-select drop-shadow-[0_10px_28px_rgba(0,0,0,0.55)]">
      {bubble}
    </div>
  );
}
