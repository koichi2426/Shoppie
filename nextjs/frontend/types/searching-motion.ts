export const SEARCHING_MOTION_VARIANTS = [
  'scan',
  'bounce',
  'spin',
  'wiggle',
  'sway',
  'pulse',
  'peek',
  'hop',
  'radar',
  'drift',
] as const;

export type SearchingMotionVariant = (typeof SEARCHING_MOTION_VARIANTS)[number];

export const SEARCHING_MOTION_LABELS: Record<SearchingMotionVariant, string> = {
  scan: 'きょろきょろ',
  bounce: 'ぴょんぴょん',
  spin: 'ぐるぐる',
  wiggle: 'ぷるぷる',
  sway: 'ゆらゆら',
  pulse: 'ぽかぽか',
  peek: 'のぞき',
  hop: 'ホッピング',
  radar: 'レーダー',
  drift: 'ふわふわ',
};

export const DEFAULT_SEARCHING_MOTION: SearchingMotionVariant = 'scan';
