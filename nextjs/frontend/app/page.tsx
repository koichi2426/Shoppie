"use client";
import Image from "next/image";
import { useEffect, useState, useRef, useCallback } from "react";
import Cookies from 'js-cookie';
import { clientLogger } from '@/lib/client-logger';
import {
  type ConversationTurn,
  type Product,
  loadHistory,
  saveHistory,
  fetchHistoryFromBackend,
} from '@/lib/conversation-history';

interface AgentResponse {
  message: string;
  products: Product[];
}

function formatTime(value: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {products.map((product, index) => (
        <div
          key={`${product.title}-${index}`}
          className="rounded-xl border border-white/10 bg-white/5 p-3"
        >
          {product.image_urls[0] && (
            <div className="relative overflow-hidden rounded-lg mb-2">
              <Image
                src={encodeURI(product.image_urls[0])}
                alt={product.title}
                width={280}
                height={140}
                className="w-full h-28 object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          )}
          <h4 className="font-semibold text-sm text-white line-clamp-2 mb-1">
            {product.title}
          </h4>
          {product.description && (
            <p className="text-xs text-gray-400 line-clamp-2 mb-2">{product.description}</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-emerald-400">
              {Number.isFinite(product.price) && product.price > 0
                ? `¥${product.price.toLocaleString()}`
                : '価格情報なし'}
            </p>
            {product.affiliate_url && (
              <a
                href={product.affiliate_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white shrink-0"
              >
                見る
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [historyTurns, setHistoryTurns] = useState<ConversationTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isRecognitionSupported, setIsRecognitionSupported] = useState(false);
  const [textInput, setTextInput] = useState("");
  const recognitionRef = useRef<any>(null);
  const submitSearchRef = useRef<(text: string) => Promise<void>>(async () => {});
  const loadingRef = useRef(false);
  const lastVoiceInputRef = useRef("");
  const contextIdRef = useRef<string>("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const ensureContextId = useCallback(() => {
    if (contextIdRef.current) {
      return contextIdRef.current;
    }

    const savedContextId = Cookies.get("shoppie_context_id");
    if (savedContextId) {
      contextIdRef.current = savedContextId;
      clientLogger.info("session reuse", { contextId: savedContextId });
      return savedContextId;
    }

    const newContextId = crypto.randomUUID();
    Cookies.set("shoppie_context_id", newContextId, { expires: 7 });
    contextIdRef.current = newContextId;
    clientLogger.info("session created", { contextId: newContextId });
    return newContextId;
  }, []);

  useEffect(() => {
    const contextId = ensureContextId();
    const local = loadHistory(contextId);
    if (local.length > 0) {
      setHistoryTurns(local);
      return;
    }

    fetchHistoryFromBackend(contextId).then((remote) => {
      if (remote.length > 0) {
        setHistoryTurns(remote);
        saveHistory(contextId, remote);
      }
    });
  }, [ensureContextId]);

  useEffect(() => {
    if (historyTurns.length === 0) return;
    saveHistory(ensureContextId(), historyTurns);
  }, [historyTurns, ensureContextId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [historyTurns, loading]);

  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const appendTurn = (turn: ConversationTurn) => {
    setHistoryTurns((current) => [...current, turn]);
  };

  const submitSearch = async (text: string) => {
    if (!text.trim() || loadingRef.current) return;

    const trimmed = text.trim();
    const startedAt = Date.now();
    loadingRef.current = true;
    setLoading(true);
    setTranscript("");
    stopRecognition();

    clientLogger.info('search start', {
      text: trimmed,
      contextId: ensureContextId(),
    });

    try {
      const res = await fetch("/api/request-assistance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          context_id: ensureContextId(),
        }),
      });
      const data = await res.json();
      const durationMs = Date.now() - startedAt;

      if (!res.ok || !data.response) {
        clientLogger.warn('search failed', {
          durationMs,
          status: res.status,
          error: data.error,
        });
        appendTurn({
          id: crypto.randomUUID(),
          userMessage: trimmed,
          assistantMessage: data.error || "申し訳ありません、現在商品をご案内できませんでした。",
          products: [],
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const response = data.response as AgentResponse;
      clientLogger.info('search completed', {
        durationMs,
        status: res.status,
        productCount: response.products?.length ?? 0,
        messagePreview: response.message?.slice(0, 80),
      });
      appendTurn({
        id: crypto.randomUUID(),
        userMessage: trimmed,
        assistantMessage: response.message || `「${trimmed}」へのおすすめ商品をご紹介します。`,
        products: response.products ?? [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      clientLogger.error('search error', {
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      appendTurn({
        id: crypto.randomUUID(),
        userMessage: trimmed,
        assistantMessage: "申し訳ありません、現在商品をご案内できませんでした。（サーバーへの接続に失敗しました）",
        products: [],
        timestamp: new Date().toISOString(),
      });
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  submitSearchRef.current = submitSearch;

  const stopRecognition = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // already stopped
    }
    setIsListening(false);
  };

  const startRecognition = () => {
    if (!recognitionRef.current || loadingRef.current) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // already running
    }
  };

  useEffect(() => {
    if (loading) {
      stopRecognition();
      setTranscript("");
    }
  }, [loading]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsRecognitionSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ja-JP';

        recognition.onresult = (event: any) => {
          if (loadingRef.current) return;

          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          setTranscript(finalTranscript || interimTranscript);

          if (finalTranscript.trim() && finalTranscript !== lastVoiceInputRef.current) {
            lastVoiceInputRef.current = finalTranscript;
            submitSearchRef.current(finalTranscript);

            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }
            silenceTimerRef.current = setTimeout(() => {
              setTranscript('');
            }, 2000);
          }
        };

        recognition.onerror = (event: any) => {
          clientLogger.error('voice recognition error', { error: event.error });
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleMicTap = () => {
    if (loading) return;
    if (isListening) {
      stopRecognition();
      setTranscript("");
    } else {
      setTranscript("");
      startRecognition();
    }
  };

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

  const handleNewConversation = () => {
    if (loading) return;
    if (historyTurns.length > 0 && !window.confirm('会話履歴を消して新しい会話を始めますか？')) {
      return;
    }
    const newContextId = crypto.randomUUID();
    Cookies.set("shoppie_context_id", newContextId, { expires: 7 });
    contextIdRef.current = newContextId;
    setHistoryTurns([]);
    saveHistory(newContextId, []);
    clientLogger.info("session created", { contextId: newContextId });
  };

  const hasHistory = historyTurns.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white font-sans flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-400/20 to-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px'
      }}></div>

      <header className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Shoppie
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">話すだけで、買い物が進む</p>
          </div>
          {hasHistory && (
            <button
              type="button"
              onClick={handleNewConversation}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/5 disabled:opacity-50 shrink-0"
            >
              新しい会話
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
          {!hasHistory && !loading && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">何かお探しですか？</h2>
              <p className="text-sm text-gray-400 mb-6">話しかけるか、キーワードを入力して商品を探せます</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
                {[
                  { label: '💻 家電', text: 'ワイヤレスイヤホンを探してる' },
                  { label: '👕 ファッション', text: '洗えるスニーカーってある？' },
                  { label: '🎁 ギフト', text: 'プレゼント用の時計を見せて' },
                ].map((example) => (
                  <button
                    key={example.text}
                    type="button"
                    onClick={() => handleExampleClick(example.text)}
                    disabled={loading}
                    className="backdrop-blur-sm bg-white/5 p-3 rounded-xl border border-white/10 hover:bg-white/10 text-left disabled:opacity-50"
                  >
                    <div className="text-cyan-400 text-xs font-semibold mb-1">{example.label}</div>
                    <p className="text-gray-300 text-xs">「{example.text}」</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {historyTurns.map((turn) => (
            <div key={turn.id} className="space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-cyan-600/40 to-purple-600/40 border border-cyan-400/20 px-4 py-3">
                  <p className="text-sm text-white whitespace-pre-wrap">{turn.userMessage}</p>
                  <p className="text-[10px] text-gray-400 mt-1 text-right">{formatTime(turn.timestamp)}</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[95%] rounded-2xl rounded-tl-sm backdrop-blur-lg bg-white/10 border border-white/10 px-4 py-3">
                  <p className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">
                    {turn.assistantMessage}
                  </p>
                  <ProductGrid products={turn.products} />
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-tl-sm backdrop-blur-lg bg-white/10 border border-white/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <span className="ml-1">商品を検索中...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-black/30 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 py-4 space-y-3">
          {transcript && (
            <div className="px-3 py-2 bg-cyan-500/10 border border-cyan-400/30 rounded-xl text-sm text-center">
              💬 &quot;{transcript}&quot;
            </div>
          )}

          <div className="flex items-center gap-3">
            {isRecognitionSupported && (
              <button
                type="button"
                onClick={handleMicTap}
                disabled={loading}
                aria-label={isListening ? '音声入力を停止' : '音声入力を開始'}
                className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  loading
                    ? 'opacity-50 cursor-not-allowed bg-gray-600'
                    : isListening
                      ? 'bg-gradient-to-r from-red-500 to-pink-500'
                      : 'bg-gradient-to-r from-cyan-500 to-purple-500'
                }`}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            )}

            <form onSubmit={handleTextSubmit} className="flex-1">
              <div className="flex gap-2 items-center backdrop-blur-md bg-white/5 border border-white/20 rounded-2xl p-2 focus-within:border-cyan-400/50">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="キーワードを入力（例：ヒレ肉）"
                  disabled={loading}
                  className="flex-1 bg-transparent text-white placeholder-gray-400 px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || !textInput.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  送信
                </button>
              </div>
            </form>
          </div>

          {isRecognitionSupported && (
            <p className="text-center text-xs text-gray-500">
              {loading ? '検索中...' : isListening ? '聞いています — 話し終わると自動で検索します' : 'マイクボタンで音声入力'}
            </p>
          )}
        </div>
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
