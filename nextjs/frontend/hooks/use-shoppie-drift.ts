import { useEffect, useRef, useState } from 'react';
import { clampShoppiePosition } from '@/hooks/use-shoppie-drag';

export const DRIFT_MS = 2_200;
const MIN_INTERVAL_MS = 16_000;
const MAX_INTERVAL_MS = 34_000;

interface UseShoppieDriftOptions {
  enabled?: boolean;
  size: number;
  bottomClearance?: number;
  position: { x: number; y: number };
  moveTo: (x: number, y: number) => void;
}

export function useShoppieDrift({
  enabled = true,
  size,
  bottomClearance = 112,
  position,
  moveTo,
}: UseShoppieDriftOptions) {
  const [isDrifting, setIsDrifting] = useState(false);
  const timersRef = useRef<number[]>([]);
  const positionRef = useRef(position);
  const moveToRef = useRef(moveTo);

  positionRef.current = position;
  moveToRef.current = moveTo;

  useEffect(() => {
    if (!enabled) {
      setIsDrifting(false);
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
        const current = positionRef.current;
        const angle = Math.random() * Math.PI * 2;
        const distance = 24 + Math.random() * 48;
        const target = clampShoppiePosition(
          current.x + Math.cos(angle) * distance,
          current.y + Math.sin(angle) * distance,
          size,
        );

        setIsDrifting(true);
        moveToRef.current(target.x, target.y);

        const driftId = window.setTimeout(() => {
          setIsDrifting(false);
          scheduleNext();
        }, DRIFT_MS);
        timersRef.current.push(driftId);
      }, wait);
      timersRef.current.push(waitId);
    };

    scheduleNext();
    return clearTimers;
  }, [enabled, size, bottomClearance]);

  return { isDrifting };
}
