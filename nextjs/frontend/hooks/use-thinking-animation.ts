'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_THINKING_ANIMATION,
  THINKING_ANIMATION_VARIANTS,
  type ThinkingAnimationVariant,
} from '@/types/thinking-animation';

const STORAGE_KEY = 'shoppie-thinking-animation';

export function useThinkingAnimation(override?: ThinkingAnimationVariant) {
  const [variant, setVariant] = useState<ThinkingAnimationVariant>(
    override ?? DEFAULT_THINKING_ANIMATION
  );

  useEffect(() => {
    if (override) {
      setVariant(override);
      return;
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (
      saved &&
      THINKING_ANIMATION_VARIANTS.includes(saved as ThinkingAnimationVariant)
    ) {
      setVariant(saved as ThinkingAnimationVariant);
    }
  }, [override]);

  return variant;
}
