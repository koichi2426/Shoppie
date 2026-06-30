"use client";

import { useEffect, useState } from 'react';
import { AppBackground } from '@/components/layout/app-background';
import { ChatHeader } from '@/components/chat/chat-header';
import { WelcomePrompts } from '@/components/chat/welcome-prompts';
import { ConversationTurnView } from '@/components/chat/conversation-turn-view';
import { ChatLoadingIndicator } from '@/components/chat/chat-loading-indicator';
import { ChatInputBar } from '@/components/chat/chat-input-bar';
import { useContextId } from '@/hooks/use-context-id';
import { useConversation } from '@/hooks/use-conversation';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';

export default function Home() {
  const [textInput, setTextInput] = useState('');
  const { ensureContextId, resetContextId } = useContextId();
  const {
    historyTurns,
    loading,
    loadingRef,
    chatEndRef,
    submitSearch,
    startNewConversation,
  } = useConversation({ ensureContextId, resetContextId });

  const {
    isListening,
    transcript,
    isSupported: isRecognitionSupported,
    toggleRecognition,
    stopRecognition,
    clearTranscript,
  } = useSpeechRecognition({
    onFinalTranscript: submitSearch,
    loadingRef,
    disabled: loading,
  });

  useEffect(() => {
    ensureContextId();
  }, [ensureContextId]);

  useEffect(() => {
    if (loading) {
      stopRecognition();
      clearTranscript();
    }
  }, [loading, stopRecognition, clearTranscript]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || loading) return;
    const text = textInput;
    setTextInput('');
    submitSearch(text);
  };

  const hasHistory = historyTurns.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white font-sans flex flex-col relative overflow-hidden">
      <AppBackground />

      <ChatHeader
        hasHistory={hasHistory}
        loading={loading}
        onNewConversation={startNewConversation}
      />

      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
          {!hasHistory && !loading && (
            <WelcomePrompts loading={loading} onExampleClick={submitSearch} />
          )}

          {historyTurns.map((turn) => (
            <ConversationTurnView key={turn.id} turn={turn} />
          ))}

          {loading && <ChatLoadingIndicator />}

          <div ref={chatEndRef} />
        </div>
      </main>

      <ChatInputBar
        loading={loading}
        textInput={textInput}
        transcript={transcript}
        isListening={isListening}
        isRecognitionSupported={isRecognitionSupported}
        onTextInputChange={setTextInput}
        onSubmit={handleTextSubmit}
        onMicToggle={toggleRecognition}
      />
    </div>
  );
}
