import type { ShoppieExpression } from '@/types/shoppie-expression';

export type ShoppieAction =
  | 'jump'
  | 'wiggle'
  | 'bounce'
  | 'nod'
  | 'sway'
  | 'peek'
  | 'spin';

export interface ShoppieActionConfig {
  durationMs: number;
  expression: ShoppieExpression;
}

export const SHOPPIE_ACTIONS: ShoppieAction[] = [
  'jump',
  'wiggle',
  'bounce',
  'nod',
  'sway',
  'peek',
  'spin',
];

export const SHOPPIE_ACTION_CONFIG: Record<ShoppieAction, ShoppieActionConfig> = {
  jump: { durationMs: 580, expression: 'excited' },
  wiggle: { durationMs: 520, expression: 'cheerful' },
  bounce: { durationMs: 480, expression: 'excited' },
  nod: { durationMs: 420, expression: 'curious' },
  sway: { durationMs: 720, expression: 'happy' },
  peek: { durationMs: 500, expression: 'shy' },
  spin: { durationMs: 560, expression: 'cheerful' },
};
