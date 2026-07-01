'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AgentSpeechBubble,
  type AgentSpeechMode,
} from '@/components/shoppie/agent-speech-bubble';
import { ShoppieMascot } from '@/components/shoppie/shoppie-mascot';
import { useCharacterHints } from '@/hooks/use-character-hints';
import { clampShoppiePosition, useShoppieDrag } from '@/hooks/use-shoppie-drag';
import { DRIFT_MS, useShoppieDrift } from '@/hooks/use-shoppie-drift';
import { useShoppieExpression } from '@/hooks/use-shoppie-expression';
import { getShoppieActionClass } from '@/lib/shoppie-action';
import { useShoppieAction } from '@/hooks/use-shoppie-action';
import { useShoppieBlink } from '@/hooks/use-shoppie-blink';
import { useShoppieLifeReact } from '@/hooks/use-shoppie-life-react';
import { ROLL_AROUND_MS, useShoppieRollAround } from '@/hooks/use-shoppie-roll-around';

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
  speechText?: string | null;
  speechMode?: AgentSpeechMode;
  speechKey?: string;
}

export function ShoppieChatDock({
  isListening,
  loading,
  disabled = false,
  onTap,
  speechText = null,
  speechMode = 'hint',
  speechKey = 'idle',
}: ShoppieChatDockProps) {
  const [entered, setEntered] = useState(false);
  const {
    position,
    isDragging,
    isDragReady,
    moveTo,
    releaseManualPosition,
    markManualPosition,
    handleRef,
    handlePointerDown,
  } = useShoppieDrag({
    size: DOCK_SIZE,
    defaultPosition,
    disabled,
    onTap,
  });

  const isIdleLife =
    !disabled && !loading && !isListening && !isDragging && !isDragReady;

  const hasAgentSpeech = Boolean(speechText) && speechMode !== 'hint';

  const lifeReact = useShoppieLifeReact({
    anchorKey: speechKey,
    enabled: isIdleLife || loading || hasAgentSpeech,
  });

  const isBlinking = useShoppieBlink(isIdleLife && !lifeReact && !hasAgentSpeech);

  const { isRolling } = useShoppieRollAround({
    enabled: isIdleLife && !lifeReact && !hasAgentSpeech,
    size: DOCK_SIZE,
    bottomClearance: INPUT_BAR_CLEARANCE,
    position,
    moveTo,
    markManualPosition,
  });

  const { isDrifting } = useShoppieDrift({
    enabled: isIdleLife && !lifeReact && !isRolling && !hasAgentSpeech,
    size: DOCK_SIZE,
    bottomClearance: INPUT_BAR_CLEARANCE,
    position,
    moveTo,
  });

  const displayAction = lifeReact;

  const { text: hintText, showBubble: showHint, isHint } = useCharacterHints({
    isListening,
    loading,
    isDragging,
    isDragReady,
    enabled: !disabled && !isRolling && !lifeReact && !hasAgentSpeech,
  });

  const { action, isActive } = useShoppieAction({
    enabled: isIdleLife && !isRolling && !isDrifting && !lifeReact && !hasAgentSpeech,
  });

  const activeMotion = displayAction ?? action;

  const expression = useShoppieExpression({
    isListening,
    loading,
    activeAction: activeMotion,
    isBlinking,
    isRolling,
    isDragging,
    isDragReady,
    enabled: !disabled,
  });

  const isBreathing =
    isIdleLife && !activeMotion && !isRolling && !isDrifting && !lifeReact && !hasAgentSpeech;

  const prevSpeechKeyRef = useRef(speechKey);

  useEffect(() => {
    if (speechKey && speechKey !== prevSpeechKeyRef.current) {
      releaseManualPosition();
      prevSpeechKeyRef.current = speechKey;
    }
  }, [speechKey, releaseManualPosition]);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const motionClass = isRolling
    ? 'animate-shoppie-goro'
    : getShoppieActionClass(activeMotion);

  const positionTransition = isDragging
    ? 'none'
    : isRolling
      ? `left ${ROLL_AROUND_MS}ms cubic-bezier(0.45, 0.05, 0.25, 1), top ${ROLL_AROUND_MS}ms cubic-bezier(0.45, 0.05, 0.25, 1)`
      : isDrifting
        ? `left ${DRIFT_MS}ms ease-in-out, top ${DRIFT_MS}ms ease-in-out`
        : 'left 0.3s ease-out, top 0.3s ease-out';

  const showAgentBubble = hasAgentSpeech && speechText;
  const showHintBubble = !showAgentBubble && showHint && hintText;

  return (
    <div
      className={`fixed z-50 shoppie-no-select ${entered ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
      style={{
        left: position.x,
        top: position.y,
        width: DOCK_SIZE,
        height: DOCK_SIZE,
        touchAction: 'none',
        transition: positionTransition,
        filter: isListening ? 'drop-shadow(0 0 20px rgba(34, 211, 238, 0.4))' : undefined,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {showAgentBubble && (
        <AgentSpeechBubble text={speechText} mode={speechMode} />
      )}
      {showHintBubble && (
        <AgentSpeechBubble text={hintText} mode="hint" />
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
                : showAgentBubble
                  ? `Shoppie: ${speechText}`
                  : 'Shoppieに話しかける（長押しで移動）'
        }
        onContextMenu={(e) => e.preventDefault()}
        className={`relative w-full h-full rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/50 shadow-xl shadow-purple-500/30 shoppie-no-select ${motionClass} ${
          entered && !isDragging && !isActive && !isRolling && !activeMotion
            ? 'transition-[transform,box-shadow]'
            : ''
        } ${entered ? 'scale-100' : 'scale-50'} ${
          isDragging
            ? 'scale-110 cursor-grabbing shadow-2xl shadow-purple-500/50'
            : isDragReady
              ? 'scale-105 cursor-grab ring-2 ring-cyan-400/60'
              : isRolling
                ? 'cursor-default ring-2 ring-pink-300/35'
                : isListening
                  ? 'ring-4 ring-cyan-400/50 scale-105 animate-pulse'
                  : showAgentBubble
                    ? 'ring-2 ring-purple-400/40'
                    : activeMotion
                      ? 'cursor-pointer ring-4 ring-violet-300/35'
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
          breathing={isBreathing}
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
