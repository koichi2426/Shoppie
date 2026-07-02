'use client';

import {
  type ThinkingAnimationVariant,
} from '@/types/thinking-animation';
import { useThinkingAnimation } from '@/hooks/use-thinking-animation';

const DOT_COLORS = ['bg-cyan-400', 'bg-purple-400', 'bg-pink-400'] as const;

interface ThinkingIndicatorProps {
  size?: 'sm' | 'md';
  variant?: ThinkingAnimationVariant;
}

export function ThinkingIndicator({
  size = 'sm',
  variant: variantProp,
}: ThinkingIndicatorProps) {
  const variant = useThinkingAnimation(variantProp);
  const dotRadius = size === 'md' ? 4 : 3;
  const orbitRadius = size === 'md' ? 10 : 8;
  const dotSize = size === 'md' ? 'w-2 h-2' : 'w-1.5 h-1.5';
  const barWidth = size === 'md' ? 'w-1' : 'w-0.5';
  const barHeight = size === 'md' ? 'h-4' : 'h-3';

  if (variant === 'orbit') {
    return (
      <div
        className={`relative flex items-center justify-center ${size === 'md' ? 'w-8 h-8' : 'w-6 h-6'}`}
        role="status"
        aria-label="考え中"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="absolute inset-0 animate-thinking-orbit-spin" aria-hidden="true">
          {DOT_COLORS.map((color, index) => (
            <div
              key={color}
              className={`absolute left-1/2 top-1/2 ${dotSize} rounded-full ${color}`}
              style={{
                marginLeft: -dotRadius,
                marginTop: -dotRadius,
                transform: `rotate(${index * 120}deg) translateY(-${orbitRadius}px)`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'equalizer') {
    return (
      <div
        className="flex items-end justify-center gap-1"
        role="status"
        aria-label="考え中"
        aria-live="polite"
        aria-busy="true"
      >
        {DOT_COLORS.map((color, index) => (
          <div
            key={color}
            className={`${barWidth} ${barHeight} rounded-full ${color} animate-thinking-eq`}
            style={{ animationDelay: `${index * 0.15}s` }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (variant === 'ripple') {
    return (
      <div
        className={`relative flex items-center justify-center ${size === 'md' ? 'w-10 h-6' : 'w-8 h-5'}`}
        role="status"
        aria-label="考え中"
        aria-live="polite"
        aria-busy="true"
      >
        {DOT_COLORS.map((color, index) => (
          <div
            key={color}
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${dotSize} rounded-full ${color} animate-thinking-ripple`}
            style={{ animationDelay: `${index * 0.35}s` }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (variant === 'morph') {
    return (
      <div
        className="flex items-center justify-center"
        role="status"
        aria-label="考え中"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className={`${size === 'md' ? 'h-2' : 'h-1.5'} rounded-full bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 animate-thinking-morph`}
          aria-hidden="true"
        />
      </div>
    );
  }

  const dotClassByVariant: Record<
    Exclude<ThinkingAnimationVariant, 'orbit' | 'equalizer' | 'ripple' | 'morph'>,
    string
  > = {
    bounce: 'animate-thinking-bounce',
    wave: 'animate-thinking-wave',
    pulse: 'animate-thinking-pulse',
    blink: 'animate-thinking-blink',
    sparkle: 'animate-thinking-sparkle',
    shuffle: 'animate-thinking-shuffle',
  };

  const delayStepByVariant: Partial<Record<ThinkingAnimationVariant, number>> = {
    bounce: 0.18,
    wave: 0.14,
    pulse: 0.22,
    blink: 0.25,
    sparkle: 0.16,
    shuffle: 0.2,
  };

  const animationClass = dotClassByVariant[variant as keyof typeof dotClassByVariant];
  const delayStep = delayStepByVariant[variant] ?? 0.18;

  return (
    <div
      className="flex items-center justify-center gap-1.5"
      role="status"
      aria-label="考え中"
      aria-live="polite"
      aria-busy="true"
    >
      {DOT_COLORS.map((color, delayIndex) => (
        <div
          key={color}
          className={`${dotSize} rounded-full ${color} ${animationClass}`}
          style={{ animationDelay: `${delayIndex * delayStep}s` }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
