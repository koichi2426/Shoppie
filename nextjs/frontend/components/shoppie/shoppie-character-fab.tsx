'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShoppieMascot, ShoppieSpeechBubble } from '@/components/shoppie/shoppie-mascot';
import { useCharacterHints } from '@/hooks/use-character-hints';

const LONG_PRESS_MS = 380;
const TAP_THRESHOLD_PX = 12;
const JITTER_THRESHOLD_PX = 20;
const FAB_SIZE = 56;
const MARGIN = 12;
const INPUT_BAR_CLEARANCE = 76;

function defaultPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') {
    return { x: 300, y: 400 };
  }
  return clampPosition(
    (window.innerWidth - FAB_SIZE) / 2,
    window.innerHeight - FAB_SIZE - INPUT_BAR_CLEARANCE - 16
  );
}

function clampPosition(x: number, y: number): { x: number; y: number } {
  if (typeof window === 'undefined') return { x, y };
  const maxX = window.innerWidth - FAB_SIZE - MARGIN;
  const maxY = window.innerHeight - FAB_SIZE - MARGIN;
  return {
    x: Math.min(Math.max(MARGIN, x), maxX),
    y: Math.min(Math.max(MARGIN, y), maxY),
  };
}

interface ShoppieCharacterFabProps {
  isListening: boolean;
  loading: boolean;
  disabled?: boolean;
  onTap: () => void;
}

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  dragging: boolean;
  dragReady: boolean;
  moved: boolean;
  longPressTimer: ReturnType<typeof setTimeout> | null;
};

export function ShoppieCharacterFab({
  isListening,
  loading,
  disabled = false,
  onTap,
}: ShoppieCharacterFabProps) {
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragReady, setIsDragReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const { text: hintText, showBubble, isHint } = useCharacterHints({
    isListening,
    loading,
    isDragging,
    isDragReady,
    enabled: !disabled,
  });
  const positionRef = useRef(position);
  const sessionRef = useRef<DragSession | null>(null);
  const onTapRef = useRef(onTap);

  positionRef.current = position;
  onTapRef.current = onTap;

  useEffect(() => {
    const timer = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setPosition((current) => clampPosition(current.x, current.y));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const clearLongPress = useCallback((session: DragSession) => {
    if (session.longPressTimer) {
      clearTimeout(session.longPressTimer);
      session.longPressTimer = null;
    }
  }, []);

  const endSession = useCallback(
    (clientX: number, clientY: number) => {
      const session = sessionRef.current;
      if (!session) return;

      clearLongPress(session);

      const dx = clientX - session.startX;
      const dy = clientY - session.startY;
      const wasTap =
        !session.dragging &&
        !session.dragReady &&
        !session.moved &&
        Math.hypot(dx, dy) < TAP_THRESHOLD_PX;

      if (session.dragging || session.dragReady) {
        session.dragging = false;
        setIsDragging(false);
        setIsDragReady(false);
      } else if (wasTap) {
        onTapRef.current();
      }

      sessionRef.current = null;
    },
    [clearLongPress]
  );

  const handleWindowPointerMove = useCallback(
    (e: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;
      const distance = Math.hypot(dx, dy);

      if (!session.dragging && !session.dragReady) {
        if (distance > JITTER_THRESHOLD_PX) {
          clearLongPress(session);
          session.moved = true;
        }
        return;
      }

      session.moved = true;
      if (!session.dragging) {
        session.dragging = true;
        setIsDragging(true);
        setIsDragReady(false);
      }

      e.preventDefault();
      setPosition(clampPosition(session.originX + dx, session.originY + dy));
    },
    [clearLongPress]
  );

  const handleWindowPointerUp = useCallback(
    (e: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      endSession(e.clientX, e.clientY);
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    },
    [endSession, handleWindowPointerMove]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
      const session = sessionRef.current;
      if (session) clearLongPress(session);
    };
  }, [clearLongPress, handleWindowPointerMove, handleWindowPointerUp]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const origin = positionRef.current;
    const session: DragSession = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: origin.x,
      originY: origin.y,
      dragging: false,
      dragReady: false,
      moved: false,
      longPressTimer: null,
    };

    session.longPressTimer = setTimeout(() => {
      if (sessionRef.current !== session) return;
      session.dragReady = true;
      setIsDragReady(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
    }, LONG_PRESS_MS);

    sessionRef.current = session;

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
  };

  const bubble = showBubble ? hintText : null;

  return (
    <button
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
              : 'タップで音声入力、長押しで移動'
      }
      style={{
        left: position.x,
        top: position.y,
        touchAction: 'none',
        transition: isDragging
          ? 'box-shadow 0.2s ease, transform 0.2s ease'
          : undefined,
      }}
      className={`fixed z-50 w-14 h-14 rounded-full duration-500 ease-out focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/40 shadow-xl shadow-purple-500/25 ${
        entered && !isDragging ? 'transition-[transform,opacity,box-shadow]' : ''
      } ${entered ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} ${
        isDragging
          ? 'scale-110 cursor-grabbing shadow-2xl shadow-purple-500/40'
          : isDragReady
            ? 'scale-105 cursor-grab ring-2 ring-cyan-400/50'
            : isHint
              ? 'ring-2 ring-cyan-300/40 animate-pulse'
              : 'cursor-pointer'
      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {bubble && <ShoppieSpeechBubble text={bubble} size="fab" />}
      <ShoppieMascot size="fab" isListening={isListening} isLoading={loading} />
      {isDragging && (
        <span
          className="absolute -inset-1 rounded-full border-2 border-dashed border-white/30 animate-pulse pointer-events-none"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
