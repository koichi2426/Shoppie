import { useCallback, useEffect, useRef, useState } from 'react';
import { createShoppieTapHandler } from '@/lib/shoppie-tap';

const LONG_PRESS_MS = 280;
const LONG_PRESS_CANCEL_PX = 56;
const DRAG_ACTIVATE_PX = 8;

export type ShoppieDragSession = {
  kind: 'pointer' | 'touch';
  activeId: number;
  startX: number;
  startY: number;
  startTime: number;
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
  const disabledRef = useRef(disabled);
  const tapHandlerRef = useRef(createShoppieTapHandler(() => onTapRef.current()));

  positionRef.current = position;
  onTapRef.current = onTap;
  disabledRef.current = disabled;
  tapHandlerRef.current = createShoppieTapHandler(() => onTapRef.current());

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

      const wasTap =
        !session.dragging &&
        !session.dragReady &&
        tapHandlerRef.current.isQuickTap(
          { x: session.startX, y: session.startY, t: session.startTime },
          clientX,
          clientY,
        );

      if (session.dragging || session.dragReady) {
        if (session.dragging) {
          setIsManualPosition(true);
        }
        session.dragging = false;
        setIsDragging(false);
        setIsDragReady(false);
      } else if (wasTap) {
        tapHandlerRef.current.fireTap();
      }

      sessionRef.current = null;
    },
    [clearLongPress],
  );

  const updateSessionPosition = useCallback(
    (clientX: number, clientY: number) => {
      const session = sessionRef.current;
      if (!session) return;

      const dx = clientX - session.startX;
      const dy = clientY - session.startY;
      const distance = Math.hypot(dx, dy);

      if (!session.dragging && !session.dragReady) {
        if (distance > LONG_PRESS_CANCEL_PX) {
          clearLongPress(session);
          session.moved = true;
        } else if (distance > DRAG_ACTIVATE_PX) {
          session.moved = true;
        }
        return;
      }

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

  const beginSession = useCallback(
    (
      clientX: number,
      clientY: number,
      activeId: number,
      kind: ShoppieDragSession['kind'],
    ) => {
      if (disabledRef.current || sessionRef.current) return;

      clearShoppieTextSelection();
      const origin = positionRef.current;
      const session: ShoppieDragSession = {
        kind,
        activeId,
        startX: clientX,
        startY: clientY,
        startTime: Date.now(),
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
    },
    [],
  );

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      const session = sessionRef.current;
      if (!session || session.kind !== 'touch') return;

      const touch = Array.from(e.touches).find(
        (item) => item.identifier === session.activeId,
      );
      if (!touch) return;

      const distance = Math.hypot(
        touch.clientX - session.startX,
        touch.clientY - session.startY,
      );
      if (distance > DRAG_ACTIVATE_PX || session.dragReady || session.dragging) {
        e.preventDefault();
      }

      updateSessionPosition(touch.clientX, touch.clientY);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const session = sessionRef.current;
      if (!session || session.kind !== 'touch') return;

      const touch =
        Array.from(e.changedTouches).find(
          (item) => item.identifier === session.activeId,
        ) ?? e.changedTouches[0];

      if (touch) {
        endSession(touch.clientX, touch.clientY);
      } else {
        endSession(session.startX, session.startY);
      }

      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };

    const el = handleRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (disabledRef.current) return;
      if (e.touches.length !== 1) return;

      e.stopPropagation();

      const touch = e.touches[0];
      beginSession(touch.clientX, touch.clientY, touch.identifier, 'touch');

      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd);
      document.addEventListener('touchcancel', onTouchEnd);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      const session = sessionRef.current;
      if (session) clearLongPress(session);
    };
  }, [beginSession, clearLongPress, endSession, updateSessionPosition]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.pointerType === 'touch') return;

    e.preventDefault();
    clearShoppieTextSelection();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some in-app browsers reject pointer capture.
    }

    beginSession(e.clientX, e.clientY, e.pointerId, 'pointer');

    const onPointerMove = (moveEvent: PointerEvent) => {
      const session = sessionRef.current;
      if (
        !session ||
        session.kind !== 'pointer' ||
        session.activeId !== moveEvent.pointerId
      ) {
        return;
      }
      moveEvent.preventDefault();
      updateSessionPosition(moveEvent.clientX, moveEvent.clientY);
    };

    const onPointerEnd = (endEvent: PointerEvent) => {
      const session = sessionRef.current;
      if (
        !session ||
        session.kind !== 'pointer' ||
        session.activeId !== endEvent.pointerId
      ) {
        return;
      }
      endSession(endEvent.clientX, endEvent.clientY);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
  };

  const handleClick = useCallback(() => {
    if (disabledRef.current || isDragging || isDragReady) return;
    tapHandlerRef.current.fireTap();
  }, [isDragging, isDragReady]);

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
    handleClick,
  };
}
