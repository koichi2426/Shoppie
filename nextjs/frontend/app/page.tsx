"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useContextId } from '@/hooks/use-context-id';
import { useSearch } from '@/hooks/use-search';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { deleteContext } from '@/lib/api';

export default function Home() {
  const [textInput, setTextInput] = useState("");
  const [resettingChat, setResettingChat] = useState(false);
  const { contextId, ensureContextId, resetContextId } = useContextId();
  const {
    products,
    message,
    turns,
    loading,
    loadingRef,
    resultsRef,
    submitSearch: runSearch,
    clearResults,
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

  const handleChatReset = useCallback(async () => {
    const currentId = contextId || ensureContextId();
    setResettingChat(true);
    try {
      await deleteContext(currentId);
    } catch {
      // バックエンド削除に失敗してもローカルはリセットする
    } finally {
      resetContextId();
      clearResults();
      setTextInput('');
      clearTranscript();
      stopRecognition();
      setResettingChat(false);
    }
  }, [
    contextId,
    ensureContextId,
    resetContextId,
    clearResults,
    clearTranscript,
    stopRecognition,
  ]);

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

  const hasConversation = turns.length > 0 || loading || message || products.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4 sm:p-8 md:p-16 font-sans flex flex-col items-center justify-center gap-8 sm:gap-16 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-400/20 to-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-emerald-400/10 to-teal-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px'
      }}></div>

      <header className="text-center flex flex-col items-center gap-6 relative z-10 w-full max-w-2xl">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="w-24" />
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white">
            Shoppie
          </h1>
          {hasConversation ? (
            <button
              type="button"
              onClick={handleChatReset}
              disabled={resettingChat || loading}
              className="text-xs sm:text-sm px-3 py-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {resettingChat ? 'リセット中...' : '新しい会話'}
            </button>
          ) : (
            <div className="w-24" />
          )}
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
                  <div className={`w-1 bg-gradient-to-t from-cyan-400 to-purple-400 rounded-full transition-all duration-300 ${transcript ? 'h-8 animate-pulse' : 'h-4'}`}></div>
                  <div className={`w-1 bg-gradient-to-t from-purple-400 to-pink-400 rounded-full transition-all duration-300 ${transcript ? 'h-12 animate-pulse' : 'h-6'}`} style={{ animationDelay: '0.1s' }}></div>
                  <div className={`w-1 bg-gradient-to-t from-pink-400 to-red-400 rounded-full transition-all duration-300 ${transcript ? 'h-6 animate-pulse' : 'h-8'}`} style={{ animationDelay: '0.2s' }}></div>
                  <div className={`w-1 bg-gradient-to-t from-red-400 to-orange-400 rounded-full transition-all duration-300 ${transcript ? 'h-10 animate-pulse' : 'h-4'}`} style={{ animationDelay: '0.3s' }}></div>
                  <div className={`w-1 bg-gradient-to-t from-orange-400 to-yellow-400 rounded-full transition-all duration-300 ${transcript ? 'h-4 animate-pulse' : 'h-6'}`} style={{ animationDelay: '0.4s' }}></div>
                </div>
              )}

              <button
                type="button"
                onClick={handleMicTap}
                disabled={loading}
                aria-label={isListening ? '音声入力を停止' : '音声入力を開始'}
                className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white/20 shadow-lg ${
                  loading
                    ? 'opacity-50 cursor-not-allowed bg-gray-600'
                    : isListening
                      ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 shadow-red-500/30'
                      : 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 shadow-cyan-500/30'
                }`}
              >
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-center text-yellow-400 text-sm">
                お使いのブラウザは音声認識に対応していません
              </p>
            </div>
          )}

          {transcript && (
            <div className="mt-6 p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-400/30 rounded-xl backdrop-blur-sm animate-pulse">
              <p className="text-white text-center font-medium">
                💬 &quot;{transcript}&quot;
              </p>
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

      <section ref={resultsRef} className="relative w-full max-w-6xl z-10">
        {hasConversation ? (
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-6 sm:px-8 sm:py-7 border-b border-white/10 space-y-6">
              {turns.map((turn, index) => (
                <div key={`${turn.userMessage}-${index}`} className="space-y-3">
                  <div className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-cyan-500/20 border border-cyan-400/20 px-4 py-3 text-sm sm:text-base text-white/95">
                      {turn.userMessage}
                    </p>
                  </div>
                  <div className="flex justify-start">
                    <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-white/5 border border-white/10 px-4 py-3 text-sm sm:text-base text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {turn.assistantMessage}
                    </p>
                  </div>
                  {turn.products.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pt-2">
                      {turn.products.map((product, productIndex) => (
                        <ProductCard key={`${product.title}-${productIndex}`} product={product} index={productIndex} />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center justify-center gap-3 text-lg text-gray-200 py-4">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span>商品を検索中...</span>
                </div>
              )}

              {!loading && message && turns.length === 0 && (
                <p className="text-sm sm:text-base text-gray-300 text-center leading-relaxed">{message}</p>
              )}
            </div>

            {!loading && products.length > 0 && turns.length === 0 && (
              <div className="p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                  {products.map((product, index) => (
                    <ProductCard key={`${product.title}-${index}`} product={product} index={index} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-12 text-center">
                <div className="flex flex-col items-center gap-8">
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center animate-pulse">
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                      何かお探しですか？
                    </h2>
                    <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl leading-relaxed">
                      話しかけるか、キーワードを入力して商品を探せます。
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-8 max-w-4xl w-full">
                    <button
                      type="button"
                      onClick={() => handleExampleClick("ワイヤレスイヤホンを探してる")}
                      disabled={loading}
                      className="backdrop-blur-sm bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/10 hover:border-cyan-400/30 transition-all text-left disabled:opacity-50"
                    >
                      <div className="text-cyan-400 text-sm font-semibold mb-2">💻 家電・ガジェット</div>
                      <p className="text-gray-300 text-sm">「ワイヤレスイヤホンを探してる」</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExampleClick("洗えるスニーカーってある？")}
                      disabled={loading}
                      className="backdrop-blur-sm bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/10 hover:border-purple-400/30 transition-all text-left disabled:opacity-50"
                    >
                      <div className="text-purple-400 text-sm font-semibold mb-2">👕 ファッション</div>
                      <p className="text-gray-300 text-sm">「洗えるスニーカーってある？」</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExampleClick("プレゼント用の時計を見せて")}
                      disabled={loading}
                      className="backdrop-blur-sm bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/10 hover:border-pink-400/30 transition-all text-left disabled:opacity-50"
                    >
                      <div className="text-pink-400 text-sm font-semibold mb-2">🎁 ギフト</div>
                      <p className="text-gray-300 text-sm">「プレゼント用の時計を見せて」</p>
                    </button>
                  </div>
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

function ProductCard({
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
      className="group relative backdrop-blur-lg bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-500 hover:scale-105 hover:shadow-2xl"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="relative overflow-hidden rounded-xl mb-3 sm:mb-4">
        <Image
          src={product.image_urls[0] ? encodeURI(product.image_urls[0]) : "/placeholder.jpg"}
          alt={product.title}
          width={300}
          height={200}
          className="rounded-xl w-full h-32 sm:h-40 md:h-48 object-cover group-hover:scale-110 transition-transform duration-500"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "/placeholder.jpg";
          }}
        />
      </div>

      <h3 className="font-bold text-lg sm:text-xl mb-1 sm:mb-2 text-white group-hover:text-cyan-300 transition-colors duration-300">
        {product.title}
      </h3>

      <p className="text-xs sm:text-sm text-gray-300 mb-3 sm:mb-4 line-clamp-2 leading-relaxed">
        {product.description}
      </p>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
        <p className="font-bold text-xl sm:text-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          {Number.isFinite(product.price)
            ? `¥${product.price.toLocaleString()}`
            : "価格情報なし"}
        </p>

        <a
          href={product.affiliate_url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto relative px-4 sm:px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full text-white font-semibold text-sm hover:from-cyan-400 hover:to-purple-400 transition-all duration-300 hover:scale-105 hover:shadow-lg text-center"
        >
          商品を見る
        </a>
      </div>
    </div>
  );
}
