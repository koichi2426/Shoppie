'use client';

import { useMemo } from 'react';
import type { ConversationTurn } from '@/hooks/use-search';
import { ChatInputBar } from '@/components/chat/chat-input-bar';
import { ProductGrid } from '@/components/chat/chat-product-card';
import { ConversationResetButton } from '@/components/chat/conversation-reset-button';
import { ShoppieChatDock } from '@/components/chat/shoppie-chat-dock';
import type { AgentSpeechMode } from '@/components/shoppie/agent-speech-bubble';

interface ChatScreenProps {
  turns: ConversationTurn[];
  pendingUserMessage: string | null;
  loading: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  textInput: string;
  isListening: boolean;
  isRecognitionSupported: boolean;
  transcript: string;
  micError?: string | null;
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
  micError,
  onTextChange,
  onSubmit,
  onMicTap,
  onResetConversation,
  resetDisabled = false,
}: ChatScreenProps) {
  const lastTurnIndex = turns.length - 1;
  const latestTurn = !pendingUserMessage && turns.length > 0 ? turns[lastTurnIndex] : null;

  const { speechText, speechMode, speechKey } = useMemo(() => {
    if (loading && pendingUserMessage) {
      return {
        speechText: '探してるね…',
        speechMode: 'loading' as AgentSpeechMode,
        speechKey: `loading-${pendingUserMessage}`,
      };
    }
    if (isListening) {
      return {
        speechText: transcript ? `「${transcript}」` : '聞いてるよ！',
        speechMode: 'listening' as AgentSpeechMode,
        speechKey: `listening-${transcript}`,
      };
    }
    if (latestTurn) {
      return {
        speechText: latestTurn.assistantMessage,
        speechMode: 'message' as AgentSpeechMode,
        speechKey: `turn-${lastTurnIndex}-${latestTurn.assistantMessage.slice(0, 40)}`,
      };
    }
    return {
      speechText: null,
      speechMode: 'hint' as AgentSpeechMode,
      speechKey: 'idle',
    };
  }, [
    loading,
    pendingUserMessage,
    isListening,
    transcript,
    latestTurn,
    lastTurnIndex,
  ]);

  return (
    <div className="relative z-10 flex flex-col h-[100dvh] w-full max-w-5xl mx-auto">
      <header className="shrink-0 px-4 py-3 border-b border-white/10 relative flex items-center justify-center">
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-cyan-300 via-violet-300 to-pink-300 bg-clip-text text-transparent">
          Shoppie
        </h1>
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
          <p className="text-sm text-white/35 text-center leading-relaxed pt-8">
            Shoppie に話しかけてね♪
          </p>
        )}

        {turns.map((turn, index) => (
          <section
            key={`turn-${index}-${turn.userMessage}`}
            className="space-y-3 pb-4 border-b border-white/[0.07] last:border-b-0 last:pb-0"
            aria-label={`あなたの発言と検索結果 ${index + 1}`}
          >
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-cyan-500/15 border border-cyan-400/15 px-3.5 py-2 text-sm text-white/80 whitespace-pre-wrap break-words">
                {turn.userMessage}
              </p>
            </div>
            {turn.products.length > 0 && (
              <ProductGrid products={turn.products} />
            )}
          </section>
        ))}

        {pendingUserMessage && (
          <section className="space-y-3" aria-label="送信中の発言">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-cyan-500/20 border border-cyan-400/20 px-4 py-2.5 text-sm text-white/95 whitespace-pre-wrap break-words">
                {pendingUserMessage}
              </p>
            </div>
          </section>
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
          micError={micError}
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
          speechText={speechText}
          speechMode={speechMode}
          speechKey={speechKey}
        />
      )}
    </div>
  );
}
