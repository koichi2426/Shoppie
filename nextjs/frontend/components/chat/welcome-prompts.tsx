const EXAMPLES = [
  { label: '💻 家電', text: 'ワイヤレスイヤホンを探してる' },
  { label: '👕 ファッション', text: '洗えるスニーカーってある？' },
  { label: '🎁 ギフト', text: 'プレゼント用の時計を見せて' },
] as const;

interface WelcomePromptsProps {
  loading: boolean;
  onExampleClick: (text: string) => void;
}

export function WelcomePrompts({ loading, onExampleClick }: WelcomePromptsProps) {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">何かお探しですか？</h2>
      <p className="text-sm text-gray-400 mb-6">話しかけるか、キーワードを入力して商品を探せます</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
        {EXAMPLES.map((example) => (
          <button
            key={example.text}
            type="button"
            onClick={() => onExampleClick(example.text)}
            disabled={loading}
            className="backdrop-blur-sm bg-white/5 p-3 rounded-xl border border-white/10 hover:bg-white/10 text-left disabled:opacity-50"
          >
            <div className="text-cyan-400 text-xs font-semibold mb-1">{example.label}</div>
            <p className="text-gray-300 text-xs">「{example.text}」</p>
          </button>
        ))}
      </div>
    </div>
  );
}
