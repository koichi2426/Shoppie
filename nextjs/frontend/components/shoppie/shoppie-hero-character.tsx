'use client';

import { ShoppieMascot, ShoppieSpeechBubble } from '@/components/shoppie/shoppie-mascot';
import { useCharacterHints } from '@/hooks/use-character-hints';

interface ShoppieHeroCharacterProps {
  isListening: boolean;
  loading: boolean;
  disabled?: boolean;
  onTap: () => void;
}

export function ShoppieHeroCharacter({
  isListening,
  loading,
  disabled = false,
  onTap,
}: ShoppieHeroCharacterProps) {
  const { text, showBubble, isHint } = useCharacterHints({
    isListening,
    loading,
    enabled: !disabled,
  });

  return (
    <div className="flex flex-col items-center shoppie-no-select">
      {showBubble && <ShoppieSpeechBubble text={text} />}
      <button
        type="button"
        onClick={onTap}
        disabled={disabled}
        aria-label={isListening ? '音声入力を停止' : 'Shoppieに話しかける'}
        onContextMenu={(e) => e.preventDefault()}
        className={`group relative rounded-full transition-transform duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/40 shoppie-no-select ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:scale-105 active:scale-95 cursor-pointer'
        }`}
      >
        <ShoppieMascot size="hero" isListening={isListening} isLoading={loading} />
        {!disabled && !isListening && !loading && (
          <span
            className={`absolute inset-0 rounded-full transition-all ${
              isHint
                ? 'ring-2 ring-cyan-300/50 animate-pulse'
                : 'ring-2 ring-white/20 group-hover:ring-cyan-300/40'
            }`}
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  );
}
