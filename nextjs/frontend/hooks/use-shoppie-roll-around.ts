import { useEffect, useRef, useState } from 'react';
import { clampShoppiePosition } from '@/hooks/use-shoppie-drag';

export const ROLL_AROUND_MS = 1_100;
const MIN_INTERVAL_MS = 14_000;
const MAX_INTERVAL_MS = 32_000;
const MIN_TRAVEL_PX = 80;

export function pickRandomShoppiePosition(
  size: number,
  bottomClearance = 112,
): { x: number; y: number } {
  if (typeof window === 'undefined') {
    return { x: 100, y: 100 };
  }

  const margin = 12;
  const minX = margin;
  const maxX = window.innerWidth - size - margin;
  const minY = margin + 56;
  const maxY = window.innerHeight - size - margin - bottomClearance;

  if (maxX <= minX || maxY <= minY) {
    return clampShoppiePosition(window.innerWidth / 2, window.innerHeight / 2, size);
  }

  return {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY),
  };
}

function pickRollTarget(
  current: { x: number; y: number },
  size: number,
  bottomClearance: number,
): { x: number; y: number } {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = pickRandomShoppiePosition(size, bottomClearance);
    if (Math.hypot(candidate.x - current.x, candidate.y - current.y) >= MIN_TRAVEL_PX) {
      return candidate;
    }
  }
  return pickRandomShoppiePosition(size, bottomClearance);
}

interface UseShoppieRollAroundOptions {
  enabled?: boolean;
  size: number;
  bottomClearance?: number;
  position: { x: number; y: number };
  moveTo: (x: number, y: number) => void;
  markManualPosition: () => void;
}

export function useShoppieRollAround({
  enabled = true,
  size,
  bottomClearance = 112,
  position,
  moveTo,
  markManualPosition,
}: UseShoppieRollAroundOptions) {
  const [isRolling, setIsRolling] = useState(false);
  const timersRef = useRef<number[]>([]);
  const positionRef = useRef(position);
  const moveToRef = useRef(moveTo);
  const markManualRef = useRef(markManualPosition);

  positionRef.current = position;
  moveToRef.current = moveTo;
  markManualRef.current = markManualPosition;

  useEffect(() => {
    if (!enabled) {
      setIsRolling(false);
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
        const target = pickRollTarget(current, size, bottomClearance);

        markManualRef.current();
        setIsRolling(true);
        moveToRef.current(target.x, target.y);

        const rollId = window.setTimeout(() => {
          setIsRolling(false);
          scheduleNext();
        }, ROLL_AROUND_MS);
        timersRef.current.push(rollId);
      }, wait);
      timersRef.current.push(waitId);
    };

    scheduleNext();
    return clearTimers;
  }, [enabled, size, bottomClearance]);

  return { isRolling };
}
