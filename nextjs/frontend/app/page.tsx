"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatScreen } from '@/components/chat/chat-screen';
import { ShoppieCharacterFab } from '@/components/shoppie/shoppie-character-fab';
import { ShoppieHeroCharacter } from '@/components/shoppie/shoppie-hero-character';
import { useContextId } from '@/hooks/use-context-id';
import { useSearch } from '@/hooks/use-search';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';

function PageBackground() {
  return (
    <>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-400/20 to-blue-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-emerald-400/10 to-teal-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />
      </div>
      <div
        className="absolute inset-0 opacity-5"
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
  const { ensureContextId } = useContextId();
  const {
    turns,
    pendingUserMessage,
    message,
    products,
    loading,
    loadingRef,
    chatEndRef,
    inChatMode,
    submitSearch: runSearch,
  } = useSearch({ ensureContextId });

  const submitSearchRef = useRef<(text: string) => Promise<void>>(async () => {});

  const {
    isListening,
    transcript,
    isSupported: isRecognitionSupported,
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

  const shellClass =
    "min-h-[100dvh] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white font-sans relative overflow-hidden";

  const showFirstResult = !inChatMode && (loading || message || products.length > 0);
  const landingLayerClass = inChatMode ? 'view-layer-exit' : 'view-layer-enter';
  const chatLayerClass = inChatMode ? 'view-layer-enter' : 'view-layer-hidden';

  return (
    <div className={shellClass}>
      <PageBackground />

      {/* Landing */}
      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center px-4 py-8 sm:px-8 ${landingLayerClass}`}
        aria-hidden={inChatMode}
      >
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-8 sm:mb-10 relative z-10">
          Shoppie
        </h1>

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

          <form onSubmit={handleTextSubmit} className="mt-8 w-full">
            <div className="flex items-center gap-3 border-b border-white/20 focus-within:border-cyan-400/50 transition-colors pb-1">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="キーワードを入力"
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
                {loading ? (
                  <div className="flex items-center justify-center gap-3 text-sm text-gray-200">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <span>検索中…</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-300 text-center leading-relaxed line-clamp-4">
                    {message}
                  </p>
                )}
              </div>
              {!loading && products.length > 0 && (
                <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[40vh] overflow-y-auto">
                  {products.map((product, index) => (
                    <LandingProductCard key={index} product={product} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Chat */}
      <div className={`absolute inset-0 z-20 ${chatLayerClass}`} aria-hidden={!inChatMode}>
        <ChatScreen
          turns={turns}
          pendingUserMessage={pendingUserMessage}
          loading={loading}
          chatEndRef={chatEndRef}
          textInput={textInput}
          isListening={isListening}
          isRecognitionSupported={isRecognitionSupported}
          transcript={transcript}
          onTextChange={setTextInput}
          onSubmit={handleTextSubmit}
          onMicTap={handleMicTap}
        />
      </div>

      {inChatMode && isRecognitionSupported && (
        <ShoppieCharacterFab
          isListening={isListening}
          loading={loading}
          disabled={loading}
          onTap={handleMicTap}
        />
      )}
    </div>
  );
}

function LandingProductCard({
  product,
}: {
  product: {
    title: string;
    price: number;
    image_urls: string[];
    affiliate_url: string;
    description?: string | null;
  };
}) {
  return (
    <a
      href={product.affiliate_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all"
    >
      <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-white/5">
        <Image
          src={product.image_urls[0] ? encodeURI(product.image_urls[0]) : '/placeholder.jpg'}
          alt={product.title}
          fill
          className="object-cover"
          sizes="64px"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder.jpg';
          }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white line-clamp-2 leading-snug">{product.title}</p>
        <p className="text-xs text-cyan-300 mt-1 font-semibold">
          {product.price > 0 ? `¥${product.price.toLocaleString()}` : 'Amazonで確認'}
        </p>
      </div>
    </a>
  );
}
