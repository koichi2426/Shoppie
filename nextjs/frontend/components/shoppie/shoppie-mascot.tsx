interface ShoppieMascotProps {
  size?: 'hero' | 'fab';
  isListening?: boolean;
  isLoading?: boolean;
}

export function ShoppieMascot({
  size = 'hero',
  isListening = false,
  isLoading = false,
}: ShoppieMascotProps) {
  const isHero = size === 'hero';

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 shoppie-no-select ${
        isHero ? 'w-40 h-40 sm:w-44 sm:h-44' : 'w-14 h-14'
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
            : 'w-14 h-14 shadow-purple-500/40'
        } ${!isListening && !isLoading && isHero ? 'animate-float' : ''}`}
      >
        <div className="absolute inset-[12%] rounded-full bg-gradient-to-b from-white/25 to-transparent" />
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          aria-hidden="true"
        >
          <ellipse cx="32" cy="42" rx="7" ry="9" fill="#1e1b4b" opacity="0.85" />
          <ellipse cx="68" cy="42" rx="7" ry="9" fill="#1e1b4b" opacity="0.85" />
          <ellipse cx="34" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
          <ellipse cx="70" cy="40" rx="2.5" ry="3" fill="white" opacity="0.9" />
          {isListening ? (
            <ellipse cx="50" cy="58" rx="6" ry="8" fill="#1e1b4b" opacity="0.7" />
          ) : (
            <path
              d="M 34 58 Q 50 72 66 58"
              fill="none"
              stroke="#1e1b4b"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.75"
            />
          )}
          <ellipse cx="22" cy="52" rx="8" ry="5" fill="#fda4af" opacity="0.35" />
          <ellipse cx="78" cy="52" rx="8" ry="5" fill="#fda4af" opacity="0.35" />
        </svg>
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
  size?: 'hero' | 'fab';
}) {
  if (size === 'fab') {
    return (
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none shoppie-no-select">
        <div
          key={text}
          className="bg-slate-900/90 backdrop-blur border border-white/15 rounded-full px-2.5 py-1 text-[10px] text-white/90 shadow-lg animate-hint-pop shoppie-no-select"
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
