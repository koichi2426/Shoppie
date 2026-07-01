import type { ShoppieAction } from '@/types/shoppie-action';
import { SHOPPIE_ACTIONS } from '@/types/shoppie-action';

export type ShoppieActionVariant = 'default' | 'hero';

export function getShoppieActionClass(
  action: ShoppieAction | null,
  variant: ShoppieActionVariant = 'default',
): string {
  if (!action) return '';
  const suffix = variant === 'hero' ? '-hero' : '';
  return `animate-shoppie-${action}${suffix}`;
}

export function pickRandomShoppieAction(exclude?: ShoppieAction): ShoppieAction {
  const pool = exclude
    ? SHOPPIE_ACTIONS.filter((action) => action !== exclude)
    : SHOPPIE_ACTIONS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
