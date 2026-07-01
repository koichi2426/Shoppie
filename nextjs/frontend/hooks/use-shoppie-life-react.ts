import { useEffect, useRef, useState } from 'react';
import {
  SHOPPIE_ACTION_CONFIG,
  type ShoppieAction,
} from '@/types/shoppie-action';

export function useShoppieLifeReact({
  anchorKey,
  enabled = true,
}: {
  anchorKey?: string;
  enabled?: boolean;
}) {
  const [reactAction, setReactAction] = useState<ShoppieAction | null>(null);
  const prevKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !anchorKey) return;

    const prev = prevKeyRef.current;
    prevKeyRef.current = anchorKey;
    if (!prev || prev === anchorKey) return;

    let action: ShoppieAction | null = null;
    if (anchorKey.startsWith('typing')) {
      action = 'lean';
    } else if (anchorKey.startsWith('turn')) {
      action = 'hop';
    }

    if (!action) return;

    setReactAction(action);
    const timer = window.setTimeout(() => {
      setReactAction(null);
    }, SHOPPIE_ACTION_CONFIG[action].durationMs);

    return () => window.clearTimeout(timer);
  }, [anchorKey, enabled]);

  return reactAction;
}
