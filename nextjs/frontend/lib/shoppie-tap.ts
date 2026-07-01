const TAP_DEBOUNCE_MS = 450;
const TAP_MAX_DURATION_MS = 320;
const TAP_MAX_DISTANCE_PX = 28;
const SYNTHETIC_CLICK_GUARD_MS = 500;

let lastTapAt = 0;
let lastTouchTapAt = 0;

export type ShoppieTouchStart = {
  x: number;
  y: number;
  t: number;
};

export function markTouchTapHandled() {
  lastTouchTapAt = Date.now();
}

export function shouldIgnoreSyntheticClick() {
  return Date.now() - lastTouchTapAt < SYNTHETIC_CLICK_GUARD_MS;
}

export function createShoppieTapHandler(onTap: () => void) {
  const fireTap = () => {
    const now = Date.now();
    if (now - lastTapAt < TAP_DEBOUNCE_MS) return;
    lastTapAt = now;
    onTap();
  };

  const isQuickTap = (
    start: ShoppieTouchStart,
    endX: number,
    endY: number,
    endTime = Date.now(),
  ) => {
    const duration = endTime - start.t;
    const distance = Math.hypot(endX - start.x, endY - start.y);
    return duration < TAP_MAX_DURATION_MS && distance < TAP_MAX_DISTANCE_PX;
  };

  return { fireTap, isQuickTap, TAP_MAX_DURATION_MS, TAP_MAX_DISTANCE_PX };
}
