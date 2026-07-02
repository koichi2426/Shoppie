export const THINKING_ANIMATION_VARIANTS = [
  'bounce',
  'wave',
  'pulse',
  'blink',
  'sparkle',
  'orbit',
  'equalizer',
  'ripple',
  'morph',
  'shuffle',
] as const;

export type ThinkingAnimationVariant = (typeof THINKING_ANIMATION_VARIANTS)[number];

export const THINKING_ANIMATION_LABELS: Record<ThinkingAnimationVariant, string> = {
  bounce: 'バウンス',
  wave: 'ウェーブ',
  pulse: 'パルス',
  blink: 'ブリンク',
  sparkle: 'スパークル',
  orbit: 'オービット',
  equalizer: 'イコライザー',
  ripple: 'リップル',
  morph: 'モーフ',
  shuffle: 'シャッフル',
};

export const DEFAULT_THINKING_ANIMATION: ThinkingAnimationVariant = 'bounce';
