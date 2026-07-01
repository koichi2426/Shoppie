import { useEffect, useRef } from 'react';

interface UseChatAutoScrollOptions {
  turnCount: number;
  pendingMessage: string | null;
  loading: boolean;
  lastProductCount: number;
}

export function useChatAutoScroll({
  turnCount,
  pendingMessage,
  loading,
  lastProductCount,
}: UseChatAutoScrollOptions) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area) return;

    const scrollToLatest = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          area.scrollTo({
            top: area.scrollHeight,
            behavior: 'smooth',
          });
        });
      });
    };

    scrollToLatest();

    const content = contentRef.current;
    if (!content) return;

    const observer = new ResizeObserver(scrollToLatest);
    observer.observe(content);

    return () => observer.disconnect();
  }, [turnCount, pendingMessage, loading, lastProductCount]);

  return { scrollAreaRef, contentRef };
}
