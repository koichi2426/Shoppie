'use client';

import { ShoppieMascot, ShoppieSpeechBubble } from '@/components/shoppie/shoppie-mascot';
import { useCharacterHints } from '@/hooks/use-character-hints';
import { useShoppieExpression } from '@/hooks/use-shoppie-expression';
import { getShoppieActionClass } from '@/lib/shoppie-action';
import { useShoppieAction } from '@/hooks/use-shoppie-action';

interface ShoppieChatDockProps {
  isListening: boolean;
  loading: boolean;
  disabled?: boolean;
  onTap: () => void;
}

export function ShoppieChatDock({
  isListening,
  loading,
  disabled = false,
  onTap,
}: ShoppieChatDockProps) {
  const { text: hintText, showBubble, isHint } = useCharacterHints({
    isListening,
    loading,
    enabled: !disabled,
  });
  const { action, isActive } = useShoppieAction({
    enabled: !disabled && !loading && !isListening,
  });
  const expression = useShoppieExpression({
    isListening,
    loading,
    activeAction: action,
    enabled: !disabled,
  });

  return (
    <div className="relative shrink-0 w-[72px] sm:w-20 shoppie-no-select">
      {showBubble && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 w-max max-w-[min(52vw,200px)]">
          <ShoppieSpeechBubble text={hintText} size="fab" />
        </div>
      )}
      <button
        type="button"
        onClick={onTap}
        disabled={disabled}
        aria-label={
          isListening ? '音声入力を停止' : 'しょっぴーに話しかける'
        }
        className={`relative w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/50 shadow-xl shadow-purple-500/30 shoppie-no-select ${getShoppieActionClass(action)} ${
          isListening
            ? 'ring-4 ring-cyan-400/50 scale-105 animate-pulse'
            : isHint
              ? 'ring-2 ring-cyan-300/40 animate-pulse'
              : isActive
                ? ''
                : 'hover:scale-105 active:scale-95'
        } transition-transform duration-300 disabled:opacity-50 disabled:pointer-events-none`}
        style={{
          filter: isListening
            ? 'drop-shadow(0 0 20px rgba(34, 211, 238, 0.4))'
            : undefined,
        }}
      >
        <ShoppieMascot
          size="dock"
          expression={expression}
          isListening={isListening}
          isLoading={loading}
        />
      </button>
    </div>
  );
}
