'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShoppieMascot, ShoppieSpeechBubble } from '@/components/shoppie/shoppie-mascot';

const LONG_PRESS_MS = 450;
const TAP_THRESHOLD_PX = 10;
const FAB_SIZE = 56;
const MARGIN = 12;
const INPUT_BAR_CLEARANCE = 76;

function defaultPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') {
    return { x: 300, y: 400 };
  }
  return {
    x: (window.innerWidth - FAB_SIZE) / 2,
    y: window.innerHeight - FAB_SIZE - INPUT_BAR_CLEARANCE - 16,
  };
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

function fabSpeechText(isListening: boolean, loading: boolean, isDragging: boolean): string | null {
  if (isDragging) return null;
  if (loading) return '…';
  if (isListening) return '聞いてる';
  return 'Touch!';
}

interface ShoppieCharacterFabProps {
  isListening: boolean;
  loading: boolean;
  disabled?: boolean;
  onTap: () => void;
}

export function ShoppieCharacterFab({
  isListening,
  loading,
  disabled = false,
  onTap,
}: ShoppieCharacterFabProps) {
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [entered, setEntered] = useState(false);
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    dragging: false,
    longPressTimer: null as ReturnType<typeof setTimeout> | null,
    moved: false,
  });

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

  const clearLongPress = useCallback(() => {
    const { longPressTimer } = dragRef.current;
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      dragRef.current.longPressTimer = null;
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      ...dragRef.current,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: position.x,
      originY: position.y,
      dragging: false,
      moved: false,
    };

    clearLongPress();
    dragRef.current.longPressTimer = setTimeout(() => {
      dragRef.current.dragging = true;
      setIsDragging(true);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current;
    if (state.pointerId !== e.pointerId) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (!state.dragging && Math.hypot(dx, dy) > TAP_THRESHOLD_PX) {
      clearLongPress();
      state.moved = true;
    }

    if (state.dragging) {
      setPosition(clampPosition(state.originX + dx, state.originY + dy));
    }
  };

  const finishPointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current;
    clearLongPress();

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const wasTap =
      !state.dragging &&
      !state.moved &&
      Math.hypot(dx, dy) < TAP_THRESHOLD_PX;

    if (state.dragging) {
      state.dragging = false;
      setIsDragging(false);
    } else if (wasTap) {
      onTap();
    }

    state.pointerId = -1;
    state.moved = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const bubble = fabSpeechText(isListening, loading, isDragging);

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      disabled={disabled}
      aria-label={
        isDragging
          ? 'キャラクターを移動中'
          : isListening
            ? '音声入力を停止'
            : 'タップで音声入力、長押しで移動'
      }
      style={{
        left: position.x,
        top: position.y,
        touchAction: isDragging ? 'none' : 'manipulation',
      }}
      className={`fixed z-50 w-14 h-14 rounded-full transition-[transform,opacity,box-shadow] duration-500 ease-out focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/40 shadow-xl shadow-purple-500/25 ${
        entered ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
      } ${isDragging ? 'scale-110 cursor-grabbing shadow-2xl shadow-purple-500/40' : 'cursor-pointer'} ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
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
