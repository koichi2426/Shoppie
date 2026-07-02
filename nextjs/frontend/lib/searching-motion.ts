import type { SearchingMotionVariant } from '@/types/searching-motion';

export type SearchingMotionSize = 'default' | 'hero';

export function getSearchingMotionClass(
  variant: SearchingMotionVariant,
  size: SearchingMotionSize = 'default',
): string {
  const suffix = size === 'hero' ? '-hero' : '';
  return `animate-search-${variant}${suffix}`;
}
