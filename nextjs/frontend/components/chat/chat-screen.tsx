import { ShoppieMascot } from '@/components/shoppie/shoppie-mascot';
import type { ConversationTurn } from '@/hooks/use-search';
import { AssistantMessage, AssistantTypingIndicator } from '@/components/chat/assistant-message';
import { ChatInputBar } from '@/components/chat/chat-input-bar';
import { ProductGrid } from '@/components/chat/chat-product-card';
import { ConversationResetButton } from '@/components/chat/conversation-reset-button';
import { ShoppieChatDock } from '@/components/chat/shoppie-chat-dock';

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
  onResetConversation,
  resetDisabled = false,
}: ChatScreenProps) {
  const lastTurnIndex = turns.length - 1;

  return (
    <div className="relative z-10 flex flex-col h-[100dvh] w-full max-w-5xl mx-auto">
      <header className="shrink-0 px-4 py-3 border-b border-white/10 relative flex items-center justify-center gap-2">
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <ShoppieMascot size="chat" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-white">しょっぴー</h1>
        {onResetConversation && (
          <ConversationResetButton
            onClick={onResetConversation}
            disabled={resetDisabled}
            className="absolute right-4 top-1/2 -translate-y-1/2"
          />
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 pb-4 space-y-5">
        {turns.length === 0 && !pendingUserMessage && (
          <div className="flex items-end gap-2 sm:gap-2.5 max-w-[95%] animate-hint-pop">
            <div className="shrink-0 w-11 sm:w-12" aria-hidden="true" />
            <p className="text-sm text-white/45 leading-relaxed">
              下のしょっぴーをタップして、声で話しかけてみてね♪
            </p>
          </div>
        )}

        {turns.map((turn, index) => (
          <div key={`${turn.userMessage}-${index}`} className="space-y-3">
            <div className="flex justify-end pl-12 sm:pl-14">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-cyan-500/20 border border-cyan-400/20 px-4 py-2.5 text-sm text-white/95 whitespace-pre-wrap break-words">
                {turn.userMessage}
              </p>
            </div>
            <AssistantMessage
              message={turn.assistantMessage}
              isLatest={index === lastTurnIndex && !pendingUserMessage}
            />
            {turn.products.length > 0 && (
              <div className="pl-12 sm:pl-14">
                <ProductGrid products={turn.products} />
              </div>
            )}
          </div>
        ))}

        {pendingUserMessage && (
          <div className="space-y-3">
            <div className="flex justify-end pl-12 sm:pl-14">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-cyan-500/20 border border-cyan-400/20 px-4 py-2.5 text-sm text-white/95 whitespace-pre-wrap break-words">
                {pendingUserMessage}
              </p>
            </div>
            {loading && <AssistantTypingIndicator />}
          </div>
        )}

        <div ref={chatEndRef} className="h-1" aria-hidden="true" />
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-gradient-to-t from-slate-900/95 via-slate-900/80 to-slate-900/60">
        <div className="flex items-end gap-2 sm:gap-3 px-3 sm:px-4 pt-3 pb-3 safe-area-pb">
          {isRecognitionSupported && (
            <ShoppieChatDock
              isListening={isListening}
              loading={loading}
              disabled={loading}
              onTap={onMicTap}
            />
          )}
          <div className="flex-1 min-w-0 pb-0.5">
            <ChatInputBar
              textInput={textInput}
              loading={loading}
              isListening={isListening}
              isRecognitionSupported={isRecognitionSupported}
              transcript={transcript}
              onTextChange={onTextChange}
              onSubmit={onSubmit}
              docked
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
