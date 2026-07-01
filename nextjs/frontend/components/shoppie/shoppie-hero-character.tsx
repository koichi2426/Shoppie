import { ShoppieMascot, ShoppieSpeechBubble } from '@/components/shoppie/shoppie-mascot';

interface ShoppieHeroCharacterProps {
  isListening: boolean;
  loading: boolean;
  disabled?: boolean;
  onTap: () => void;
}

function speechText(isListening: boolean, loading: boolean): string {
  if (loading) return '探してるよ…';
  if (isListening) return '聞いてるよ！';
  return 'Touch me!';
}

export function ShoppieHeroCharacter({
  isListening,
  loading,
  disabled = false,
  onTap,
}: ShoppieHeroCharacterProps) {
  return (
    <div className="flex flex-col items-center">
      <ShoppieSpeechBubble text={speechText(isListening, loading)} />
      <button
        type="button"
        onClick={onTap}
        disabled={disabled}
        aria-label={isListening ? '音声入力を停止' : 'タップして話しかける'}
        className={`group relative rounded-full transition-transform duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/40 ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:scale-105 active:scale-95 cursor-pointer'
        }`}
      >
        <ShoppieMascot size="hero" isListening={isListening} isLoading={loading} />
        {!disabled && !isListening && !loading && (
          <span
            className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-cyan-300/40 transition-all"
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  );
}
