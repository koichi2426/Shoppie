import { useEffect, useMemo, useState } from 'react';

const IDLE_HINTS = [
  'Touch me!',
  'ここをタップして話してね♪',
  '声を出して話しかけて！',
  '一緒にお買い物しよう♪',
] as const;

const TAP_HINTS = [
  'タップして話しかけてね♪',
  'ここをタップしてね♪',
  'Touch me!',
  'もっと探すならタップしてね♪',
] as const;

const HINT_ROTATE_MS = 5000;

interface UseCharacterHintsOptions {
  isListening: boolean;
  loading: boolean;
  isDragging?: boolean;
  isDragReady?: boolean;
  enabled?: boolean;
  hasPersistentMessage?: boolean;
}

export function useCharacterHints({
  isListening,
  loading,
  isDragging = false,
  isDragReady = false,
  enabled = true,
  hasPersistentMessage = false,
}: UseCharacterHintsOptions) {
  const [hintIndex, setHintIndex] = useState(0);

  const hints = hasPersistentMessage ? TAP_HINTS : IDLE_HINTS;

  const statusText = useMemo(() => {
    if (isDragging) return null;
    if (isDragReady) return '移動OK！';
    if (loading) return '探してるね…';
    if (isListening) return '聞いてるよ！';
    return null;
  }, [isDragging, isDragReady, loading, isListening]);

  const isIdle = enabled && !statusText;

  useEffect(() => {
    if (!isIdle) return;

    const timer = window.setInterval(() => {
      setHintIndex((current) => (current + 1) % hints.length);
    }, HINT_ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [isIdle, hints.length]);

  const text = statusText ?? (isIdle ? hints[hintIndex] : null);
  const showBubble = Boolean(text);

  return {
    text: text ?? '',
    showBubble,
    isHint: isIdle,
  };
}
