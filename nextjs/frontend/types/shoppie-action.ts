import type { ShoppieExpression } from '@/types/shoppie-expression';

export type ShoppieAction =
  | 'jump'
  | 'wiggle'
  | 'bounce'
  | 'nod'
  | 'sway'
  | 'peek'
  | 'spin'
  | 'stretch'
  | 'yawn'
  | 'startle'
  | 'hop'
  | 'lean'
  | 'glance';

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
  'stretch',
  'yawn',
  'startle',
  'hop',
  'lean',
  'glance',
];

export const SHOPPIE_ACTION_CONFIG: Record<ShoppieAction, ShoppieActionConfig> = {
  jump: { durationMs: 580, expression: 'excited' },
  wiggle: { durationMs: 520, expression: 'cheerful' },
  bounce: { durationMs: 480, expression: 'excited' },
  nod: { durationMs: 420, expression: 'curious' },
  sway: { durationMs: 720, expression: 'happy' },
  peek: { durationMs: 500, expression: 'shy' },
  spin: { durationMs: 560, expression: 'cheerful' },
  stretch: { durationMs: 900, expression: 'sleepy' },
  yawn: { durationMs: 1_100, expression: 'sleepy' },
  startle: { durationMs: 380, expression: 'surprised' },
  hop: { durationMs: 420, expression: 'excited' },
  lean: { durationMs: 640, expression: 'lookLeft' },
  glance: { durationMs: 600, expression: 'lookRight' },
};
