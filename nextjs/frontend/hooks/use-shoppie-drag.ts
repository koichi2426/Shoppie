import { useCallback, useEffect, useRef, useState } from 'react';

const LONG_PRESS_MS = 220;
const TAP_THRESHOLD_PX = 12;
const JITTER_THRESHOLD_PX = 24;

export type ShoppieDragSession = {
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

export function clearShoppieTextSelection() {
  if (typeof window === 'undefined') return;
  window.getSelection()?.removeAllRanges();
}

export function clampShoppiePosition(
  x: number,
  y: number,
  size: number,
  margin = 12,
): { x: number; y: number } {
  if (typeof window === 'undefined') return { x, y };
  const maxX = window.innerWidth - size - margin;
  const maxY = window.innerHeight - size - margin;
  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  };
}

export function positionBesideBubble(
  rect: DOMRect,
  size: number,
  gap = 10,
): { x: number; y: number } {
  const preferredX = rect.left - size - gap;
  const x =
    preferredX < 12
      ? Math.min(rect.right + gap, window.innerWidth - size - 12)
      : preferredX;
  const y = rect.top + rect.height / 2 - size / 2;
  return clampShoppiePosition(x, y, size);
}

interface UseShoppieDragOptions {
  size: number;
  defaultPosition: () => { x: number; y: number };
  disabled?: boolean;
  onTap: () => void;
}

export function useShoppieDrag({
  size,
  defaultPosition,
  disabled = false,
  onTap,
}: UseShoppieDragOptions) {
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragReady, setIsDragReady] = useState(false);
  const [isManualPosition, setIsManualPosition] = useState(false);
  const positionRef = useRef(position);
  const sessionRef = useRef<ShoppieDragSession | null>(null);
  const onTapRef = useRef(onTap);
  const handleRef = useRef<HTMLButtonElement>(null);

  positionRef.current = position;
  onTapRef.current = onTap;

  const moveTo = useCallback(
    (x: number, y: number) => {
      setPosition(clampShoppiePosition(x, y, size));
    },
    [size],
  );

  const releaseManualPosition = useCallback(() => {
    setIsManualPosition(false);
  }, []);

  const markManualPosition = useCallback(() => {
    setIsManualPosition(true);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setPosition((current) => clampShoppiePosition(current.x, current.y, size));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [size]);

  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      clearShoppieTextSelection();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    return () => el.removeEventListener('touchstart', onTouchStart);
  }, [disabled]);

  const clearLongPress = useCallback((session: ShoppieDragSession) => {
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
      clearShoppieTextSelection();

      const dx = clientX - session.startX;
      const dy = clientY - session.startY;
      const wasTap =
        !session.dragging &&
        !session.dragReady &&
        !session.moved &&
        Math.hypot(dx, dy) < TAP_THRESHOLD_PX;

      if (session.dragging || session.dragReady) {
        if (session.dragging) {
          setIsManualPosition(true);
        }
        session.dragging = false;
        setIsDragging(false);
        setIsDragReady(false);
      } else if (wasTap) {
        onTapRef.current();
      }

      sessionRef.current = null;
    },
    [clearLongPress],
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

      e.preventDefault();
      clearShoppieTextSelection();
      session.moved = true;
      if (!session.dragging) {
        session.dragging = true;
        setIsDragging(true);
        setIsDragReady(false);
      }

      setPosition(
        clampShoppiePosition(session.originX + dx, session.originY + dy, size),
      );
    },
    [clearLongPress, size],
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
    [endSession, handleWindowPointerMove],
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
    clearShoppieTextSelection();
    e.currentTarget.setPointerCapture(e.pointerId);

    const origin = positionRef.current;
    const session: ShoppieDragSession = {
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
      clearShoppieTextSelection();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
    }, LONG_PRESS_MS);

    sessionRef.current = session;

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
  };

  return {
    position,
    isDragging,
    isDragReady,
    isManualPosition,
    moveTo,
    releaseManualPosition,
    markManualPosition,
    handleRef,
    handlePointerDown,
  };
}
