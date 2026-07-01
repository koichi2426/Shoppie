import { useEffect, useMemo, useState } from 'react';
import { SHOPPIE_ACTION_CONFIG, type ShoppieAction } from '@/types/shoppie-action';
import type { ShoppieExpression } from '@/types/shoppie-expression';

const IDLE_EXPRESSIONS: ShoppieExpression[] = [
  'happy',
  'cheerful',
  'wink',
  'curious',
  'shy',
  'excited',
  'sleepy',
  'lookLeft',
  'lookRight',
];

const IDLE_ROTATE_MS = 5_000;

interface UseShoppieExpressionOptions {
  isListening: boolean;
  loading: boolean;
  activeAction?: ShoppieAction | null;
  isBlinking?: boolean;
  isRolling?: boolean;
  isDragging?: boolean;
  isDragReady?: boolean;
  enabled?: boolean;
}

export function useShoppieExpression({
  isListening,
  loading,
  activeAction = null,
  isBlinking = false,
  isRolling = false,
  isDragging = false,
  isDragReady = false,
  enabled = true,
}: UseShoppieExpressionOptions): ShoppieExpression {
  const [idleIndex, setIdleIndex] = useState(0);

  const isIdle =
    enabled &&
    !loading &&
    !isListening &&
    !activeAction &&
    !isRolling &&
    !isDragging &&
    !isBlinking;

  useEffect(() => {
    if (!isIdle) return;

    const timer = window.setInterval(() => {
      setIdleIndex((current) => (current + 1) % IDLE_EXPRESSIONS.length);
    }, IDLE_ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [isIdle]);

  return useMemo(() => {
    if (!enabled) return 'happy';
    if (loading) return 'loading';
    if (isListening) return 'listening';
    if (isBlinking) return 'blink';
    if (isRolling) return 'cheerful';
    if (activeAction) return SHOPPIE_ACTION_CONFIG[activeAction].expression;
    if (isDragReady) return 'curious';
    if (isDragging) return 'shy';
    if (isIdle) return IDLE_EXPRESSIONS[idleIndex];
    return 'happy';
  }, [
    enabled,
    loading,
    isListening,
    isBlinking,
    isRolling,
    activeAction,
    isDragReady,
    isDragging,
    isIdle,
    idleIndex,
  ]);
}
