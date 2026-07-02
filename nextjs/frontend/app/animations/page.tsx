'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ThinkingIndicator } from '@/components/shoppie/thinking-indicator';
import {
  DEFAULT_THINKING_ANIMATION,
  THINKING_ANIMATION_LABELS,
  THINKING_ANIMATION_VARIANTS,
  type ThinkingAnimationVariant,
} from '@/types/thinking-animation';

const STORAGE_KEY = 'shoppie-thinking-animation';

export default function AnimationsPage() {
  const [selected, setSelected] = useState<ThinkingAnimationVariant>(
    DEFAULT_THINKING_ANIMATION
  );

  const applyVariant = (variant: ThinkingAnimationVariant) => {
    setSelected(variant);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, variant);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="space-y-3">
          <Link
            href="/"
            className="text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            ← トップへ戻る
          </Link>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 via-violet-300 to-pink-300 bg-clip-text text-transparent">
            考え中アニメーション
          </h1>
          <p className="text-sm text-white/60 leading-relaxed">
            タップして試してみてください。選んだものはブラウザに保存されます（本番反映は別途設定が必要です）。
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 flex flex-col items-center gap-4">
          <p className="text-xs text-white/45">プレビュー（エージェント上）</p>
          <div className="bg-slate-950/96 border border-white/25 rounded-full px-4 py-2.5 ring-1 ring-white/10 flex justify-center shadow-2xl">
            <ThinkingIndicator variant={selected} size="md" />
          </div>
          <p className="text-sm font-medium text-white/90">
            {THINKING_ANIMATION_LABELS[selected]}
          </p>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {THINKING_ANIMATION_VARIANTS.map((variant) => {
            const isActive = variant === selected;
            return (
              <button
                key={variant}
                type="button"
                onClick={() => applyVariant(variant)}
                className={`rounded-2xl border p-4 flex flex-col items-center gap-3 transition-all ${
                  isActive
                    ? 'border-cyan-400/60 bg-cyan-400/10 ring-1 ring-cyan-400/30'
                    : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/8'
                }`}
              >
                <div className="h-8 flex items-center justify-center">
                  <ThinkingIndicator variant={variant} size="md" />
                </div>
                <span className="text-xs text-white/80">{THINKING_ANIMATION_LABELS[variant]}</span>
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
}
