'use client';

import { useEffect, useState } from 'react';
import { ShoppieMascot, ShoppieSpeechBubble } from '@/components/shoppie/shoppie-mascot';
import { useCharacterHints } from '@/hooks/use-character-hints';
import { clampShoppiePosition, useShoppieDrag } from '@/hooks/use-shoppie-drag';
import { useShoppieExpression } from '@/hooks/use-shoppie-expression';
import { getShoppieActionClass } from '@/lib/shoppie-action';
import { useShoppieAction } from '@/hooks/use-shoppie-action';

const DOCK_SIZE = 80;
const INPUT_BAR_CLEARANCE = 112;

function defaultPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') {
    return { x: 300, y: 400 };
  }
  return clampShoppiePosition(
    (window.innerWidth - DOCK_SIZE) / 2,
    window.innerHeight - DOCK_SIZE - INPUT_BAR_CLEARANCE,
    DOCK_SIZE,
  );
}

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
  const [entered, setEntered] = useState(false);
  const {
    position,
    isDragging,
    isDragReady,
    handleRef,
    handlePointerDown,
  } = useShoppieDrag({
    size: DOCK_SIZE,
    defaultPosition,
    disabled,
    onTap,
  });

  const { text: hintText, showBubble, isHint } = useCharacterHints({
    isListening,
    loading,
    isDragging,
    isDragReady,
    enabled: !disabled,
  });
  const { action, isActive } = useShoppieAction({
    enabled: !disabled && !loading && !isListening && !isDragging && !isDragReady,
  });
  const expression = useShoppieExpression({
    isListening,
    loading,
    activeAction: action,
    isDragging,
    isDragReady,
    enabled: !disabled,
  });

  useEffect(() => {
    const timer = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  return (
    <div
      className={`fixed z-50 shoppie-no-select ${entered ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
      style={{
        left: position.x,
        top: position.y,
        width: DOCK_SIZE,
        height: DOCK_SIZE,
        touchAction: 'none',
        filter: isListening ? 'drop-shadow(0 0 20px rgba(34, 211, 238, 0.4))' : undefined,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {showBubble && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 w-max max-w-[min(52vw,200px)]">
          <ShoppieSpeechBubble text={hintText} size="fab" />
        </div>
      )}
      <button
        ref={handleRef}
        type="button"
        onPointerDown={handlePointerDown}
        disabled={disabled}
        aria-label={
          isDragging
            ? 'キャラクターを移動中'
            : isDragReady
              ? '指を動かして移動'
              : isListening
                ? '音声入力を停止'
                : 'Shoppieに話しかける（長押しで移動）'
        }
        onContextMenu={(e) => e.preventDefault()}
        className={`relative w-full h-full rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/50 shadow-xl shadow-purple-500/30 shoppie-no-select ${getShoppieActionClass(action)} ${
          entered && !isDragging && !isActive ? 'transition-[transform,box-shadow]' : ''
        } ${entered ? 'scale-100' : 'scale-50'} ${
          isDragging
            ? 'scale-110 cursor-grabbing shadow-2xl shadow-purple-500/50'
            : isDragReady
              ? 'scale-105 cursor-grab ring-2 ring-cyan-400/60'
              : isListening
                ? 'ring-4 ring-cyan-400/50 scale-105 animate-pulse'
                : isActive
                  ? 'cursor-pointer ring-4 ring-pink-300/40'
                  : isHint
                    ? 'ring-2 ring-cyan-300/40 animate-pulse'
                    : 'cursor-pointer hover:scale-105 active:scale-95'
        } disabled:opacity-50 disabled:pointer-events-none`}
      >
        <ShoppieMascot
          size="dock"
          expression={expression}
          isListening={isListening}
          isLoading={loading}
        />
        {isDragging && (
          <span
            className="absolute -inset-1 rounded-full border-2 border-dashed border-white/30 animate-pulse pointer-events-none"
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  );
}
