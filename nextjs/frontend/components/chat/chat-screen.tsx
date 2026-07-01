'use client';

import { useRef } from 'react';
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
  const latestBubbleRef = useRef<HTMLDivElement>(null);
  const typingBubbleRef = useRef<HTMLDivElement>(null);

  const followTyping = Boolean(loading && pendingUserMessage);
  const followLatest = turns.length > 0 && !pendingUserMessage;
  const bubbleAnchorRef = followTyping ? typingBubbleRef : latestBubbleRef;
  const bubbleAnchorKey = followTyping
    ? `typing-${pendingUserMessage}`
    : followLatest
      ? `turn-${lastTurnIndex}-${turns[lastTurnIndex]?.assistantMessage.slice(0, 32)}`
      : 'idle';

  return (
    <div className="relative z-10 flex flex-col h-[100dvh] w-full max-w-5xl mx-auto">
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

      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 pb-28 space-y-5">
        {turns.length === 0 && !pendingUserMessage && (
          <p className="text-sm text-white/40 text-center leading-relaxed">
            話しかけてみてね♪
          </p>
        )}

        {turns.map((turn, index) => (
          <div key={`${turn.userMessage}-${index}`} className="space-y-3">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-cyan-500/20 border border-cyan-400/20 px-4 py-2.5 text-sm text-white/95 whitespace-pre-wrap break-words">
                {turn.userMessage}
              </p>
            </div>
            <AssistantMessage
              ref={index === lastTurnIndex && !pendingUserMessage ? latestBubbleRef : null}
              message={turn.assistantMessage}
              isLatest={index === lastTurnIndex && !pendingUserMessage}
            />
            {turn.products.length > 0 && (
              <ProductGrid products={turn.products} />
            )}
          </div>
        ))}

        {pendingUserMessage && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-cyan-500/20 border border-cyan-400/20 px-4 py-2.5 text-sm text-white/95 whitespace-pre-wrap break-words">
                {pendingUserMessage}
              </p>
            </div>
            {loading && <AssistantTypingIndicator ref={typingBubbleRef} />}
          </div>
        )}

        <div ref={chatEndRef} className="h-1" aria-hidden="true" />
      </div>

      <footer className="shrink-0">
        <ChatInputBar
          textInput={textInput}
          loading={loading}
          isListening={isListening}
          isRecognitionSupported={isRecognitionSupported}
          transcript={transcript}
          onTextChange={onTextChange}
          onSubmit={onSubmit}
        />
      </footer>

      {isRecognitionSupported && (
        <ShoppieChatDock
          isListening={isListening}
          loading={loading}
          disabled={loading}
          onTap={onMicTap}
          bubbleAnchorRef={bubbleAnchorRef}
          bubbleAnchorKey={bubbleAnchorKey}
          followBubble={followTyping || followLatest}
        />
      )}
    </div>
  );
}
