import { useEffect, useRef, type RefObject } from 'react';

interface UseChatAutoScrollOptions {
  turnCount: number;
  pendingMessage: string | null;
  loading: boolean;
  lastProductCount: number;
  scrollTargetRef: RefObject<HTMLElement | null>;
}

function scrollTargetToTop(area: HTMLElement, target: HTMLElement) {
  const areaRect = area.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const nextTop = area.scrollTop + (targetRect.top - areaRect.top);
  area.scrollTo({
    top: Math.max(0, nextTop),
    behavior: 'smooth',
  });
}

export function useChatAutoScroll({
  turnCount,
  pendingMessage,
  loading,
  lastProductCount,
  scrollTargetRef,
}: UseChatAutoScrollOptions) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area) return;

    const scrollToLatestTurn = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const target = scrollTargetRef.current;
          if (target) {
            scrollTargetToTop(area, target);
            return;
          }
          area.scrollTo({
            top: area.scrollHeight,
            behavior: 'smooth',
          });
        });
      });
    };

    scrollToLatestTurn();

    const content = contentRef.current;
    if (!content) return;

    const observer = new ResizeObserver(scrollToLatestTurn);
    observer.observe(content);

    return () => observer.disconnect();
  }, [turnCount, pendingMessage, loading, lastProductCount, scrollTargetRef]);

  return { scrollAreaRef, contentRef };
}
