import { useEffect, useRef, useState } from 'react';
import { pickRandomShoppieAction } from '@/lib/shoppie-action';
import {
  SHOPPIE_ACTION_CONFIG,
  type ShoppieAction,
} from '@/types/shoppie-action';

const MIN_INTERVAL_MS = 8_000;
const MAX_INTERVAL_MS = 20_000;

interface UseShoppieActionOptions {
  enabled?: boolean;
}

export function useShoppieAction({ enabled = true }: UseShoppieActionOptions = {}) {
  const [activeAction, setActiveAction] = useState<ShoppieAction | null>(null);
  const timersRef = useRef<number[]>([]);
  const lastActionRef = useRef<ShoppieAction | null>(null);

  useEffect(() => {
    if (!enabled) {
      setActiveAction(null);
      return;
    }

    const clearTimers = () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };

    const scheduleNext = () => {
      const wait =
        MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
      const waitId = window.setTimeout(() => {
        const action = pickRandomShoppieAction(lastActionRef.current ?? undefined);
        lastActionRef.current = action;
        setActiveAction(action);

        const actionId = window.setTimeout(() => {
          setActiveAction(null);
          scheduleNext();
        }, SHOPPIE_ACTION_CONFIG[action].durationMs);
        timersRef.current.push(actionId);
      }, wait);
      timersRef.current.push(waitId);
    };

    scheduleNext();
    return clearTimers;
  }, [enabled]);

  return {
    action: activeAction,
    isActive: activeAction !== null,
  };
}
