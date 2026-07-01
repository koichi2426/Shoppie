'use client';

import { useEffect, useState } from 'react';

const THINKING_PHRASES = ['考え中', 'うーん…', 'ちょっと待ってね'] as const;
const ROTATE_MS = 2600;

interface ThinkingIndicatorProps {
  size?: 'sm' | 'md';
}

export function ThinkingIndicator({ size = 'sm' }: ThinkingIndicatorProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % THINKING_PHRASES.length);
    }, ROTATE_MS);

    return () => window.clearInterval(timer);
  }, []);

  const dotSize = size === 'md' ? 'w-2 h-2' : 'w-1.5 h-1.5';
  const textSize = size === 'md' ? 'text-sm' : 'text-xs sm:text-sm';

  return (
    <div className="flex items-center gap-2.5" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((delayIndex) => (
          <div
            key={delayIndex}
            className={`${dotSize} rounded-full animate-thinking-dot ${
              delayIndex === 0
                ? 'bg-cyan-400'
                : delayIndex === 1
                  ? 'bg-purple-400'
                  : 'bg-pink-400'
            }`}
            style={{ animationDelay: `${delayIndex * 0.18}s` }}
          />
        ))}
      </div>
      <span
        key={THINKING_PHRASES[index]}
        className={`${textSize} text-white/90 animate-thinking-label min-w-[7rem]`}
      >
        {THINKING_PHRASES[index]}
      </span>
    </div>
  );
}
