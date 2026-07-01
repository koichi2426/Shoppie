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
const BUBBLE_STACK_RESERVE = 220;
const HIT_WIDTH_PX = 340;

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
    handleClick,
  } = useShoppieDrag({
    size: DOCK_SIZE,
    defaultPosition,
    disabled,
    onTap,
  });

  const isIdleLife =
    !disabled && !loading && !isListening && !isDragging && !isDragReady;

  const showAgentBubble =
    Boolean(speechText) && speechMode !== 'hint' && speechMode !== 'status';
  const isActiveSpeech =
    speechMode === 'loading' || speechMode === 'listening';
  const hasPersistentMessage = showAgentBubble && speechMode === 'message';

  const lifeReact = useShoppieLifeReact({
    anchorKey: speechKey,
    enabled: isIdleLife || loading,
  });

  const isBlinking = useShoppieBlink(isIdleLife && !lifeReact && !isActiveSpeech);

  const { isRolling } = useShoppieRollAround({
    enabled: isIdleLife && !lifeReact && !isActiveSpeech,
    size: DOCK_SIZE,
    bottomClearance: INPUT_BAR_CLEARANCE,
    position,
    moveTo,
    markManualPosition,
  });

  const { isDrifting } = useShoppieDrift({
    enabled: isIdleLife && !lifeReact && !isRolling && !isActiveSpeech,
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
    enabled: !disabled && !isRolling && !lifeReact && !isActiveSpeech,
    hasPersistentMessage,
  });

  const { action, isActive } = useShoppieAction({
    enabled: isIdleLife && !isRolling && !isDrifting && !lifeReact && !isActiveSpeech,
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
    isIdleLife && !activeMotion && !isRolling && !isDrifting && !lifeReact && !isActiveSpeech;

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

  const showHintBubble = showHint && hintText && !isActiveSpeech;
  const hitWidth = `min(${HIT_WIDTH_PX}px, 88vw)`;
  const hitWidthNumeric =
    typeof window !== 'undefined'
      ? Math.min(HIT_WIDTH_PX, window.innerWidth * 0.88)
      : HIT_WIDTH_PX;
  const hitLeft = position.x - (hitWidthNumeric - DOCK_SIZE) / 2;

  return (
    <button
      ref={handleRef}
      type="button"
      onPointerDown={handlePointerDown}
      onClick={handleClick}
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
      className={`fixed z-50 flex flex-col items-center justify-end shoppie-no-select cursor-pointer bg-transparent border-0 p-0 ${
        entered ? 'opacity-100' : 'opacity-0'
      } transition-opacity duration-500 ${motionClass} ${
        entered && !isDragging && !isActive && !isRolling && !activeMotion
          ? 'transition-[transform,box-shadow,opacity]'
          : ''
      } ${
        isDragging
          ? 'scale-110'
          : isDragReady
            ? 'scale-105'
            : isListening
              ? 'scale-105'
              : ''
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      style={{
        left: hitLeft,
        top: position.y - BUBBLE_STACK_RESERVE,
        width: hitWidth,
        height: DOCK_SIZE + BUBBLE_STACK_RESERVE,
        touchAction: 'manipulation',
        transition: positionTransition,
        filter: isListening ? 'drop-shadow(0 0 20px rgba(34, 211, 238, 0.4))' : undefined,
      }}
    >
      {((showAgentBubble && speechText) || showHintBubble) && (
        <div className="mb-2 z-10 flex flex-col items-center gap-1.5 w-full max-w-full pointer-events-none drop-shadow-[0_10px_28px_rgba(0,0,0,0.55)]">
          {showAgentBubble && speechText && (
            <AgentSpeechBubble
              text={speechText}
              mode={speechMode}
              layout="stacked"
              showTail={!showHintBubble}
            />
          )}
          {showHintBubble && (
            <AgentSpeechBubble
              text={hintText}
              mode="hint"
              layout="stacked"
              showTail
            />
          )}
        </div>
      )}

      <span
        className={`relative shrink-0 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/50 shadow-xl shadow-purple-500/30 ${
          entered ? 'scale-100' : 'scale-50'
        } ${
          isDragging
            ? 'shadow-2xl shadow-purple-500/50 ring-0'
            : isDragReady
              ? 'ring-2 ring-cyan-400/60'
              : isRolling
                ? 'ring-2 ring-pink-300/35'
                : isListening
                  ? 'ring-4 ring-cyan-400/50 animate-pulse'
                  : showAgentBubble
                    ? isHint
                      ? 'ring-2 ring-cyan-300/40 animate-pulse'
                      : 'ring-2 ring-purple-400/40'
                    : activeMotion
                      ? 'ring-4 ring-violet-300/35'
                      : isHint
                        ? 'ring-2 ring-cyan-300/40 animate-pulse'
                        : 'ring-2 ring-white/10'
        }`}
        style={{ width: DOCK_SIZE, height: DOCK_SIZE }}
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
      </span>
    </button>
  );
}
