import type { ConversationTurn } from '@/hooks/use-search';
import { ChatInputBar } from '@/components/chat/chat-input-bar';
import { ProductGrid } from '@/components/chat/chat-product-card';
import { ConversationResetButton } from '@/components/chat/conversation-reset-button';

interface ChatScreenProps {
  turns: ConversationTurn[];
  pendingUserMessage: string | null;
  loading: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  textInput: string;
  isListening: boolean;
  isRecognitionSupported: boolean;
  transcript: string;
  onTextChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onMicTap: () => void;
  showInputMic?: boolean;
  onResetConversation?: () => void;
  resetDisabled?: boolean;
}

export function ChatScreen({
  turns,
  pendingUserMessage,
  loading,
  chatEndRef,
  textInput,
  isListening,
  isRecognitionSupported,
  transcript,
  onTextChange,
  onSubmit,
  onMicTap,
  showInputMic = false,
  onResetConversation,
  resetDisabled = false,
}: ChatScreenProps) {
  return (
    <div className="relative z-10 flex flex-col h-[100dvh] w-full max-w-3xl mx-auto">
      <header className="shrink-0 px-4 py-3 border-b border-white/10 relative flex items-center justify-center">
        <h1 className="text-lg font-semibold tracking-tight text-white">Shoppie</h1>
        {onResetConversation && (
          <ConversationResetButton
            onClick={onResetConversation}
            disabled={resetDisabled}
            className="absolute right-4 top-1/2 -translate-y-1/2"
          />
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-6">
        {turns.map((turn, index) => (
          <div key={`${turn.userMessage}-${index}`} className="space-y-3">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-cyan-500/20 border border-cyan-400/20 px-4 py-2.5 text-sm text-white/95">
                {turn.userMessage}
              </p>
            </div>
            <div className="flex justify-start">
              <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap line-clamp-6">
                {turn.assistantMessage}
              </p>
            </div>
            {turn.products.length > 0 && (
              <ProductGrid products={turn.products} />
            )}
          </div>
        ))}

        {pendingUserMessage && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-cyan-500/20 border border-cyan-400/20 px-4 py-2.5 text-sm text-white/95">
                {pendingUserMessage}
              </p>
            </div>
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={chatEndRef} className="h-1" aria-hidden="true" />
      </div>

      <ChatInputBar
        textInput={textInput}
        loading={loading}
        isListening={isListening}
        isRecognitionSupported={isRecognitionSupported}
        transcript={transcript}
        onTextChange={onTextChange}
        onSubmit={onSubmit}
        onMicTap={onMicTap}
        showMic={showInputMic}
      />
    </div>
  );
}
