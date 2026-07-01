import { ShoppieFace } from '@/components/shoppie/shoppie-face';
import type { ShoppieExpression } from '@/types/shoppie-expression';

interface ShoppieMascotProps {
  size?: 'hero' | 'fab' | 'fab-lg' | 'dock' | 'chat';
  expression?: ShoppieExpression;
  isListening?: boolean;
  isLoading?: boolean;
}

export function ShoppieMascot({
  size = 'hero',
  expression = 'happy',
  isListening = false,
  isLoading = false,
}: ShoppieMascotProps) {
  const isHero = size === 'hero';
  const isLargeFab = size === 'fab-lg';
  const isDock = size === 'dock';
  const isChat = size === 'chat';

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 shoppie-no-select ${
        isHero
          ? 'w-40 h-40 sm:w-44 sm:h-44'
          : isLargeFab || isDock
            ? 'w-full h-full'
            : isChat
              ? 'w-10 h-10 sm:w-11 sm:h-11'
              : 'w-14 h-14'
      }`}
    >
      {(isListening || isLoading) && (
        <span
          className={`absolute inset-0 rounded-full ${
            isListening
              ? 'bg-green-400/20 animate-ping'
              : 'bg-cyan-400/15 animate-pulse'
          }`}
          aria-hidden="true"
        />
      )}
      <div
        className={`relative rounded-full bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 shadow-lg ${
          isHero
            ? 'w-full h-full shadow-cyan-500/30'
            : isLargeFab || isDock
              ? 'w-full h-full shadow-purple-500/50'
              : isChat
                ? 'w-10 h-10 sm:w-11 sm:h-11 shadow-purple-500/30'
                : 'w-14 h-14 shadow-purple-500/40'
        } ${!isListening && !isLoading && (isHero || isLargeFab || isDock) ? 'animate-float' : ''}`}
      >
        <div className="absolute inset-[12%] rounded-full bg-gradient-to-b from-white/25 to-transparent" />
        <ShoppieFace expression={expression} />
        {isHero && (
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-5 rounded-b-lg bg-violet-900/40 border border-white/10"
            aria-hidden="true"
          />
        )}
      </div>
      <span className="sr-only">Shoppie</span>
    </div>
  );
}

export function ShoppieSpeechBubble({
  text,
  size = 'hero',
}: {
  text: string;
  size?: 'hero' | 'fab' | 'fab-lg';
}) {
  if (size === 'fab' || size === 'fab-lg') {
    return (
      <div className="absolute -top-11 sm:-top-12 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none shoppie-no-select max-w-[min(100vw,280px)]">
        <div
          key={text}
          className={`bg-slate-900/95 backdrop-blur border border-white/20 rounded-full text-white/95 shadow-lg animate-hint-pop shoppie-no-select text-center truncate ${
            size === 'fab-lg' ? 'px-4 py-1.5 text-xs sm:text-sm font-medium' : 'px-2.5 py-1 text-[10px]'
          }`}
        >
          {text}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative mb-4 animate-bubble shoppie-no-select ${size === 'hero' ? 'min-h-[44px]' : ''}`}
    >
      <div
        key={text}
        className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-2.5 text-sm sm:text-base font-medium text-white/95 shadow-lg tracking-wide animate-hint-pop shoppie-no-select"
      >
        {text}
      </div>
      <div
        className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-white/10"
        aria-hidden="true"
      />
    </div>
  );
}
