interface ConversationResetButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function ConversationResetButton({
  onClick,
  disabled = false,
  className = '',
}: ConversationResetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="新しい会話を始める"
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/75 hover:bg-white/10 hover:text-white hover:border-white/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      新しい会話
    </button>
  );
}
