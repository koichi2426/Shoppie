import { ShoppieMascot } from '@/components/shoppie/shoppie-mascot';
import type { ShoppieExpression } from '@/types/shoppie-expression';

interface AssistantMessageProps {
  message: string;
  expression?: ShoppieExpression;
  isLoading?: boolean;
  isLatest?: boolean;
  showAvatar?: boolean;
}

export function AssistantMessage({
  message,
  expression = 'happy',
  isLoading = false,
  isLatest = false,
  showAvatar = true,
}: AssistantMessageProps) {
  return (
    <div
      className={`flex items-end gap-2 sm:gap-2.5 max-w-[95%] sm:max-w-[90%] ${
        isLatest ? 'animate-hint-pop' : ''
      }`}
    >
      {showAvatar ? (
        <div className="shrink-0 flex flex-col items-center gap-0.5 w-11 sm:w-12">
          <ShoppieMascot
            size="chat"
            expression={expression}
            isLoading={isLoading}
          />
          <span className="text-[9px] sm:text-[10px] font-medium text-violet-300/80 tracking-tight">
            しょっぴー
          </span>
        </div>
      ) : (
        <div className="w-11 sm:w-12 shrink-0" aria-hidden="true" />
      )}
      <div className="relative min-w-0 flex-1">
        <div
          className={`rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-gray-100 leading-relaxed whitespace-pre-wrap break-words border shadow-lg ${
            isLatest
              ? 'bg-gradient-to-br from-purple-500/20 via-violet-500/15 to-cyan-500/10 border-purple-400/25 shadow-purple-500/10'
              : 'bg-white/5 border-white/10'
          }`}
        >
          {message}
        </div>
        <div
          className={`absolute -left-1.5 bottom-3 w-2 h-2 rotate-45 border-l border-b ${
            isLatest
              ? 'bg-gradient-to-br from-purple-500/20 to-violet-500/15 border-purple-400/20'
              : 'bg-white/5 border-white/10'
          }`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export function AssistantTypingIndicator({
  expression = 'loading',
}: {
  expression?: ShoppieExpression;
}) {
  return (
    <div className="flex items-end gap-2 sm:gap-2.5 max-w-[95%] animate-hint-pop">
      <div className="shrink-0 flex flex-col items-center gap-0.5 w-11 sm:w-12">
        <ShoppieMascot size="chat" expression={expression} isLoading />
        <span className="text-[9px] sm:text-[10px] font-medium text-violet-300/80">
          しょっぴー
        </span>
      </div>
      <div className="relative">
        <div className="rounded-2xl rounded-bl-md bg-gradient-to-br from-purple-500/20 via-violet-500/15 to-cyan-500/10 border border-purple-400/25 px-4 py-3 flex items-center gap-2 shadow-lg shadow-purple-500/10">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
          <div
            className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
            style={{ animationDelay: '0.1s' }}
          />
          <div
            className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"
            style={{ animationDelay: '0.2s' }}
          />
          <span className="text-xs text-white/50 ml-1">考えてるね…</span>
        </div>
        <div
          className="absolute -left-1.5 bottom-3 w-2 h-2 rotate-45 bg-purple-500/20 border-l border-b border-purple-400/25"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
