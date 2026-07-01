"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatScreen } from '@/components/chat/chat-screen';
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

  const handleExampleClick = (example: string) => {
    if (loading) return;
    submitSearch(example);
  };

  const shellClass =
    "min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white font-sans relative overflow-hidden";

  if (inChatMode) {
    return (
      <div className={shellClass}>
        <PageBackground />
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
    );
  }

  const showFirstResult = loading || message || products.length > 0;

  return (
    <div className={`${shellClass} p-4 sm:p-8 md:p-16 flex flex-col items-center justify-center gap-8 sm:gap-16`}>
      <PageBackground />

      <header className="text-center flex flex-col items-center gap-6 relative z-10 w-full max-w-2xl">
        <div className="relative">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white">
            Shoppie
          </h1>
          <div className="absolute -inset-x-4 -inset-y-2 -z-10 rounded-full bg-cyan-500/10 blur-2xl" aria-hidden="true" />
        </div>
        <div className="relative backdrop-blur-md bg-white/[0.04] border border-white/[0.08] rounded-2xl px-6 py-7 sm:px-8 sm:py-8 w-full">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-xl sm:text-2xl font-medium text-white/95 leading-snug tracking-tight">
              話すだけで、買い物が進む
            </p>
            <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
              まるで店員と話すように、商品を探せる
            </p>
          </div>

          <div className="mt-6 sm:mt-7 border-t border-white/[0.06] pt-6 sm:pt-7">
            {isRecognitionSupported ? (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center">
                  <p className={`text-sm font-semibold mb-1 transition-colors duration-300 ${
                    loading ? 'text-yellow-400' : isListening ? 'text-green-400' : 'text-gray-300'
                  }`}>
                    {loading ? '検索中...' : isListening ? '聞いています 🎧' : 'マイクボタンをタップして話しかけてください'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {loading ? '検索が完了するまでお待ちください' : isListening ? '話し終わると自動で検索します' : 'タップで音声入力を開始'}
                  </p>
                </div>

                {isListening && (
                  <div className="flex items-center gap-1">
                    <div className={`w-1 bg-gradient-to-t from-cyan-400 to-purple-400 rounded-full transition-all duration-300 ${transcript ? 'h-8 animate-pulse' : 'h-4'}`} />
                    <div className={`w-1 bg-gradient-to-t from-purple-400 to-pink-400 rounded-full transition-all duration-300 ${transcript ? 'h-12 animate-pulse' : 'h-6'}`} style={{ animationDelay: '0.1s' }} />
                    <div className={`w-1 bg-gradient-to-t from-pink-400 to-red-400 rounded-full transition-all duration-300 ${transcript ? 'h-6 animate-pulse' : 'h-8'}`} style={{ animationDelay: '0.2s' }} />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleMicTap}
                  disabled={loading}
                  aria-label={isListening ? '音声入力を停止' : '音声入力を開始'}
                  className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white/20 shadow-lg ${
                    loading
                      ? 'opacity-50 cursor-not-allowed bg-gray-600'
                      : isListening
                        ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 shadow-red-500/30'
                        : 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 shadow-cyan-500/30'
                  }`}
                >
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>
            ) : (
              <p className="text-center text-yellow-400 text-sm">
                お使いのブラウザは音声認識に対応していません
              </p>
            )}

            {transcript && (
              <div className="mt-6 p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-400/30 rounded-xl backdrop-blur-sm">
                <p className="text-white text-center font-medium">💬 &quot;{transcript}&quot;</p>
              </div>
            )}

            <form onSubmit={handleTextSubmit} className="mt-6 w-full">
              <div className="flex gap-2 items-center backdrop-blur-md bg-white/5 border border-white/20 rounded-2xl p-2 focus-within:border-cyan-400/50 transition-colors">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="キーワードを入力（例：洗えるスニーカーある？）"
                  disabled={loading}
                  className="flex-1 bg-transparent text-white placeholder-gray-400 px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || !textInput.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold text-sm hover:from-cyan-400 hover:to-purple-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  検索
                </button>
              </div>
            </form>
          </div>
        </div>
      </header>

      <section className="relative w-full max-w-6xl z-10">
        {showFirstResult ? (
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 px-6 py-6 sm:px-8 sm:py-7 border-b border-white/10">
              {loading ? (
                <div className="flex items-center justify-center gap-3 text-lg text-gray-200">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span>商品を検索中...</span>
                </div>
              ) : (
                <p className="text-sm sm:text-base text-gray-300 text-center leading-relaxed max-w-3xl mx-auto">
                  {message}
                </p>
              )}
            </div>
            {!loading && products.length > 0 && (
              <div className="p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                  {products.map((product, index) => (
                    <LandingProductCard key={index} product={product} index={index} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden p-12 text-center">
            <div className="flex flex-col items-center gap-8">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                何かお探しですか？
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-4xl">
                {[
                  { label: '💻 家電・ガジェット', text: 'ワイヤレスイヤホンを探してる', border: 'cyan' },
                  { label: '👕 ファッション', text: '洗えるスニーカーってある？', border: 'purple' },
                  { label: '🎁 ギフト', text: 'プレゼント用の時計を見せて', border: 'pink' },
                ].map((item) => (
                  <button
                    key={item.text}
                    type="button"
                    onClick={() => handleExampleClick(item.text)}
                    disabled={loading}
                    className={`backdrop-blur-sm bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/10 hover:border-${item.border}-400/30 transition-all text-left disabled:opacity-50`}
                  >
                    <div className={`text-${item.border}-400 text-sm font-semibold mb-2`}>{item.label}</div>
                    <p className="text-gray-300 text-sm">「{item.text}」</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="text-sm text-gray-400 text-center relative z-10 backdrop-blur-sm bg-white/5 rounded-full px-6 py-3 border border-white/10">
        <p>© {new Date().getFullYear()} Shoppie Inc. All rights reserved.</p>
      </footer>

      <style jsx>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}

function LandingProductCard({
  product,
  index,
}: {
  product: {
    title: string;
    price: number;
    image_urls: string[];
    affiliate_url: string;
    description?: string | null;
  };
  index: number;
}) {
  return (
    <div
      className="group relative backdrop-blur-lg bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="relative overflow-hidden rounded-xl mb-3">
        <Image
          src={product.image_urls[0] ? encodeURI(product.image_urls[0]) : '/placeholder.jpg'}
          alt={product.title}
          width={300}
          height={200}
          className="rounded-xl w-full h-40 object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder.jpg';
          }}
        />
      </div>
      <h3 className="font-bold text-lg mb-2 text-white">{product.title}</h3>
      <p className="text-xs text-gray-300 mb-3 line-clamp-2">{product.description}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-xl text-cyan-300">
          {Number.isFinite(product.price) ? `¥${product.price.toLocaleString()}` : '価格情報なし'}
        </p>
        <a
          href={product.affiliate_url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-semibold"
        >
          商品を見る
        </a>
      </div>
    </div>
  );
}
