'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_SEARCHING_MOTION,
  SEARCHING_MOTION_VARIANTS,
  type SearchingMotionVariant,
} from '@/types/searching-motion';

const STORAGE_KEY = 'shoppie-searching-motion';

export function useSearchingMotion(override?: SearchingMotionVariant) {
  const [variant, setVariant] = useState<SearchingMotionVariant>(
    override ?? DEFAULT_SEARCHING_MOTION
  );

  useEffect(() => {
    if (override) {
      setVariant(override);
      return;
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (
      saved &&
      SEARCHING_MOTION_VARIANTS.includes(saved as SearchingMotionVariant)
    ) {
      setVariant(saved as SearchingMotionVariant);
    }
  }, [override]);

  return variant;
}
