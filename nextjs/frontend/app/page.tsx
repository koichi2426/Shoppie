"use client";

import { ProductGrid } from '@/components/chat/chat-product-card';
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatScreen } from '@/components/chat/chat-screen';
import { ConversationResetButton } from '@/components/chat/conversation-reset-button';
import { ShoppieHeroCharacter } from '@/components/shoppie/shoppie-hero-character';
import { useContextId } from '@/hooks/use-context-id';
import { useSearch } from '@/hooks/use-search';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { deleteContext } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';

function PageBackground() {
  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 55% 45% at 100% 0%, rgba(34, 211, 238, 0.18), transparent 70%),
            radial-gradient(ellipse 50% 40% at 0% 100%, rgba(192, 132, 252, 0.2), transparent 72%),
            radial-gradient(ellipse 45% 40% at 50% 55%, rgba(52, 211, 153, 0.08), transparent 75%)
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
    </>
  );
}

export default function Home() {
  const [textInput, setTextInput] = useState("");
  const [resetting, setResetting] = useState(false);
  const { ensureContextId, resetContextId } = useContextId();
  const {
    turns,
    pendingUserMessage,
    message,
    products,
    loading,
    loadingRef,
    inChatMode,
    submitSearch: runSearch,
    resetConversation,
  } = useSearch({ ensureContextId });

  const submitSearchRef = useRef<(text: string) => Promise<void>>(async () => {});

  const {
    isListening,
    transcript,
    isSupported: isRecognitionSupported,
    micError,
    toggleRecognition: handleMicTap,
    stopRecognition,
    clearTranscript,
  } = useSpeechRecognition({
    onFinalTranscript: (text) => submitSearchRef.current(text),
    loadingRef,
    disabled: loading,
  });

  const submitSearch = useCallback(
    async (text: string) => {
      stopRecognition();
      clearTranscript();
      await runSearch(text);
    },
    [runSearch, stopRecognition, clearTranscript]
  );

  submitSearchRef.current = submitSearch;

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
    setTextInput("");
    submitSearch(text);
  };

  const handleResetConversation = useCallback(async () => {
    if (loading || resetting) return;

    setResetting(true);
    stopRecognition();
    clearTranscript();
    setTextInput('');

    const oldContextId = ensureContextId();
    try {
      await deleteContext(oldContextId);
    } catch (error) {
      clientLogger.warn('context delete failed', {
        contextId: oldContextId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    resetContextId();
    resetConversation();
    setResetting(false);
  }, [
    loading,
    resetting,
    stopRecognition,
    clearTranscript,
    ensureContextId,
    resetContextId,
    resetConversation,
  ]);

  const shellClass =
    "min-h-[100dvh] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white font-sans relative overflow-x-hidden";

  const showFirstResult = !inChatMode && (message || products.length > 0);
  const showResetButton = inChatMode || loading || showFirstResult;
  const landingLayerClass = inChatMode ? 'view-layer-exit' : 'view-layer-enter';

  return (
    <div className={shellClass}>
      <PageBackground />

      {/* Landing */}
      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center px-4 py-8 sm:px-8 ${landingLayerClass}`}
        aria-hidden={inChatMode}
      >
        {showResetButton && !inChatMode && (
          <ConversationResetButton
            onClick={handleResetConversation}
            disabled={loading || resetting}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20"
          />
        )}

        <header className="text-center mb-6 sm:mb-8 relative z-10">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-cyan-300 via-violet-300 to-pink-300 bg-clip-text text-transparent">
            Shoppie
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-white/55 leading-relaxed">
            お買い物エージェント
          </p>
        </header>

        <div className="relative z-10 flex flex-col items-center w-full max-w-md">
          {isRecognitionSupported ? (
            <ShoppieHeroCharacter
              isListening={isListening}
              loading={loading}
              disabled={loading}
              onTap={handleMicTap}
            />
          ) : (
            <p className="text-yellow-400/90 text-sm text-center mb-6">
              音声入力はこのブラウザでは使えません
            </p>
          )}

          {isListening && transcript && (
            <p className="mt-4 text-sm text-cyan-200/90 text-center px-4 animate-pulse">
              &quot;{transcript}&quot;
            </p>
          )}

          {micError && (
            <p className="mt-3 text-xs sm:text-sm text-amber-200/90 text-center px-4 leading-relaxed">
              {micError}
            </p>
          )}

          <form onSubmit={handleTextSubmit} className="mt-8 w-full">
            <div className="flex items-center gap-3 border-b border-white/20 focus-within:border-cyan-400/50 transition-colors pb-1">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="キーボードで話しかける"
                disabled={loading}
                className="flex-1 bg-transparent text-white placeholder-gray-500 px-1 py-2.5 text-sm focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !textInput.trim()}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold text-sm hover:from-cyan-400 hover:to-purple-400 transition-all disabled:opacity-35 disabled:cursor-not-allowed shrink-0"
              >
                送信
              </button>
            </div>
          </form>
        </div>

        {showFirstResult && (
          <section className="relative w-full max-w-3xl z-10 mt-10">
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
              <div className="px-6 py-5 sm:px-8 border-b border-white/10">
                <p className="text-sm text-gray-300 text-center leading-relaxed line-clamp-4">
                  {message}
                </p>
              </div>
              {products.length > 0 && (
                <div className="p-4 sm:p-6 max-h-[50vh] overflow-y-auto">
                  <ProductGrid products={products} />
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Chat */}
      {inChatMode && (
        <div className="absolute inset-0 z-20 view-layer-enter" aria-hidden={false}>
          <ChatScreen
            turns={turns}
            pendingUserMessage={pendingUserMessage}
            loading={loading}
            textInput={textInput}
            isListening={isListening}
            isRecognitionSupported={isRecognitionSupported}
            transcript={transcript}
            micError={micError}
            onTextChange={setTextInput}
            onSubmit={handleTextSubmit}
            onMicTap={handleMicTap}
            onResetConversation={handleResetConversation}
            resetDisabled={loading || resetting}
          />
        </div>
      )}

    </div>
  );
}
