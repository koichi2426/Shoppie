import type { ConversationTurn } from '@/hooks/use-search';
import { ChatInputBar } from '@/components/chat/chat-input-bar';
import { ChatProductCard } from '@/components/chat/chat-product-card';

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
}: ChatScreenProps) {
  return (
    <div className="relative z-10 flex flex-col h-[100dvh] w-full max-w-3xl mx-auto">
      <header className="shrink-0 px-4 py-4 border-b border-white/10 text-center">
        <h1 className="text-lg font-semibold tracking-tight text-white">Shoppie</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {turns.map((turn, index) => (
          <div key={`${turn.userMessage}-${index}`} className="space-y-3">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-cyan-500/20 border border-cyan-400/20 px-4 py-2.5 text-sm text-white/95">
                {turn.userMessage}
              </p>
            </div>
            <div className="flex justify-start">
              <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                {turn.assistantMessage}
              </p>
            </div>
            {turn.products.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
                {turn.products.map((product, productIndex) => (
                  <ChatProductCard
                    key={`${product.title}-${productIndex}`}
                    product={product}
                  />
                ))}
              </div>
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
