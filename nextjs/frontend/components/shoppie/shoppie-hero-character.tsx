'use client';

import { useRef } from 'react';
import { AgentSpeechBubble } from '@/components/shoppie/agent-speech-bubble';
import { ShoppieMascot, ShoppieSpeechBubble } from '@/components/shoppie/shoppie-mascot';
import { useCharacterHints } from '@/hooks/use-character-hints';
import { useShoppieBlink } from '@/hooks/use-shoppie-blink';
import { useShoppieExpression } from '@/hooks/use-shoppie-expression';
import { getShoppieActionClass } from '@/lib/shoppie-action';
import { getSearchingMotionClass } from '@/lib/searching-motion';
import { useSearchingMotion } from '@/hooks/use-searching-motion';
import { useShoppieAction } from '@/hooks/use-shoppie-action';
import { createShoppieTapHandler, markTouchTapHandled, shouldIgnoreSyntheticClick, type ShoppieTouchStart } from '@/lib/shoppie-tap';

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
  const { action, isActive } = useShoppieAction({
    enabled: !disabled && !isListening && !loading,
  });
  const isBlinking = useShoppieBlink(!disabled && !isListening && !loading && !action);
  const expression = useShoppieExpression({
    isListening,
    loading,
    activeAction: action,
    isBlinking,
    enabled: !disabled,
  });
  const isBreathing = !disabled && !isListening && !loading && !action && !isActive;
  const searchingMotion = useSearchingMotion();
  const motionClass = loading
    ? getSearchingMotionClass(searchingMotion, 'hero')
    : getShoppieActionClass(action, 'hero');
  const onTapRef = useRef(onTap);
  const disabledRef = useRef(disabled);
  const touchStartRef = useRef<ShoppieTouchStart | null>(null);
  const tapHandlerRef = useRef(createShoppieTapHandler(() => onTapRef.current()));

  onTapRef.current = onTap;
  disabledRef.current = disabled;

  const handleClick = () => {
    if (disabledRef.current) return;
    if (shouldIgnoreSyntheticClick()) return;
    tapHandlerRef.current.fireTap();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (disabledRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      t: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || disabledRef.current) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    if (tapHandlerRef.current.isQuickTap(start, touch.clientX, touch.clientY)) {
      markTouchTapHandled();
      e.preventDefault();
      tapHandlerRef.current.fireTap();
    }
  };

  return (
    <div className="flex flex-col items-center shoppie-no-select">
      {loading ? (
        <div className="mb-4 flex justify-center w-full drop-shadow-[0_10px_28px_rgba(0,0,0,0.55)]">
          <AgentSpeechBubble text="" mode="loading" layout="stacked" showTail={false} />
        </div>
      ) : (
        showBubble && <ShoppieSpeechBubble text={text} />
      )}
      <button
        type="button"
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        disabled={disabled}
        aria-label={isListening ? '音声入力を停止' : 'Shoppieに話しかける'}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'manipulation' }}
        className={`group relative rounded-full transition-transform duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/40 shoppie-no-select ${motionClass} ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : isActive
              ? 'cursor-pointer'
              : 'hover:scale-105 active:scale-95 cursor-pointer'
        }`}
      >
        <ShoppieMascot
          size="hero"
          expression={expression}
          isListening={isListening}
          isLoading={loading}
          breathing={isBreathing}
        />
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
