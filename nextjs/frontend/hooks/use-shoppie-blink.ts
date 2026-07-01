import { useEffect, useRef, useState } from 'react';

const MIN_BLINK_INTERVAL_MS = 2_800;
const MAX_BLINK_INTERVAL_MS = 6_500;
const BLINK_MS = 160;

export function useShoppieBlink(enabled = true) {
  const [isBlinking, setIsBlinking] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) {
      setIsBlinking(false);
      return;
    }

    const clearTimers = () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };

    const scheduleNext = () => {
      const wait =
        MIN_BLINK_INTERVAL_MS +
        Math.random() * (MAX_BLINK_INTERVAL_MS - MIN_BLINK_INTERVAL_MS);
      const waitId = window.setTimeout(() => {
        setIsBlinking(true);
        const blinkId = window.setTimeout(() => {
          setIsBlinking(false);
          scheduleNext();
        }, BLINK_MS);
        timersRef.current.push(blinkId);
      }, wait);
      timersRef.current.push(waitId);
    };

    scheduleNext();
    return clearTimers;
  }, [enabled]);

  return isBlinking;
}
