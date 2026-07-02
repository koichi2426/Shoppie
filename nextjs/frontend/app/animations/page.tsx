'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ShoppieMascot } from '@/components/shoppie/shoppie-mascot';
import { ThinkingIndicator } from '@/components/shoppie/thinking-indicator';
import { getSearchingMotionClass } from '@/lib/searching-motion';
import {
  DEFAULT_SEARCHING_MOTION,
  SEARCHING_MOTION_LABELS,
  SEARCHING_MOTION_VARIANTS,
  type SearchingMotionVariant,
} from '@/types/searching-motion';
import {
  DEFAULT_THINKING_ANIMATION,
  THINKING_ANIMATION_LABELS,
  THINKING_ANIMATION_VARIANTS,
  type ThinkingAnimationVariant,
} from '@/types/thinking-animation';

const THINKING_STORAGE_KEY = 'shoppie-thinking-animation';
const SEARCHING_STORAGE_KEY = 'shoppie-searching-motion';

export default function AnimationsPage() {
  const [thinking, setThinking] = useState<ThinkingAnimationVariant>(DEFAULT_THINKING_ANIMATION);
  const [searching, setSearching] = useState<SearchingMotionVariant>(DEFAULT_SEARCHING_MOTION);

  const applyThinking = (variant: ThinkingAnimationVariant) => {
    setThinking(variant);
    window.localStorage.setItem(THINKING_STORAGE_KEY, variant);
  };

  const applySearching = (variant: SearchingMotionVariant) => {
    setSearching(variant);
    window.localStorage.setItem(SEARCHING_STORAGE_KEY, variant);
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-10">
        <header className="space-y-3">
          <Link
            href="/"
            className="text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            ← トップへ戻る
          </Link>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 via-violet-300 to-pink-300 bg-clip-text text-transparent">
            ローディングアニメーション
          </h1>
          <p className="text-sm text-white/60 leading-relaxed">
            タップして試してみてください。選んだものはブラウザに保存され、本番の「探してる」表示に反映されます。
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white/90">考え中（吹き出し）</h2>
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 flex flex-col items-center gap-4">
            <div className="bg-slate-950/96 border border-white/25 rounded-full px-4 py-2.5 ring-1 ring-white/10 flex justify-center shadow-2xl">
              <ThinkingIndicator variant={thinking} size="md" />
            </div>
            <p className="text-sm font-medium text-white/90">
              {THINKING_ANIMATION_LABELS[thinking]}
            </p>
          </div>
          <VariantGrid
            items={THINKING_ANIMATION_VARIANTS}
            labels={THINKING_ANIMATION_LABELS}
            selected={thinking}
            onSelect={applyThinking}
            renderPreview={(variant) => <ThinkingIndicator variant={variant} size="md" />}
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white/90">探してる（キャラクター）</h2>
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 flex flex-col items-center gap-4">
            <div className={`rounded-full ${getSearchingMotionClass(searching, 'hero')}`}>
              <ShoppieMascot size="hero" expression="loading" isLoading />
            </div>
            <p className="text-sm font-medium text-white/90">
              {SEARCHING_MOTION_LABELS[searching]}
            </p>
          </div>
          <VariantGrid
            items={SEARCHING_MOTION_VARIANTS}
            labels={SEARCHING_MOTION_LABELS}
            selected={searching}
            onSelect={applySearching}
            renderPreview={(variant) => (
              <div className={`w-14 h-14 rounded-full ${getSearchingMotionClass(variant)}`}>
                <ShoppieMascot size="dock" expression="loading" isLoading />
              </div>
            )}
          />
        </section>
      </div>
    </div>
  );
}

function VariantGrid<T extends string>({
  items,
  labels,
  selected,
  onSelect,
  renderPreview,
}: {
  items: readonly T[];
  labels: Record<T, string>;
  selected: T;
  onSelect: (variant: T) => void;
  renderPreview: (variant: T) => ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((variant) => {
        const isActive = variant === selected;
        return (
          <button
            key={variant}
            type="button"
            onClick={() => onSelect(variant)}
            className={`rounded-2xl border p-4 flex flex-col items-center gap-3 transition-all ${
              isActive
                ? 'border-cyan-400/60 bg-cyan-400/10 ring-1 ring-cyan-400/30'
                : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/8'
            }`}
          >
            <div className="h-12 flex items-center justify-center">{renderPreview(variant)}</div>
            <span className="text-xs text-white/80">{labels[variant]}</span>
          </button>
        );
      })}
    </div>
  );
}
