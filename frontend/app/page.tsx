"use client";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import Cookies from 'js-cookie';

interface Product {
  title: string;
  price: number;
  image_urls: string[];
  affiliate_url: string;
  description: string;
}

interface AgentResponse {
  message: string;
  products: Product[];
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isRecognitionSupported, setIsRecognitionSupported] = useState(false);
  const [textInput, setTextInput] = useState("");
  const recognitionRef = useRef<any>(null);
  const submitSearchRef = useRef<(text: string) => Promise<void>>(async () => {});
  const loadingRef = useRef(false);
  const lastVoiceInputRef = useRef("");
  // ユーザーごとのセッションID（context ID）を取得・生成する関数
  const getContextId = () => {
    const savedContextId = Cookies.get('shoppie_context_id');
    if (savedContextId) {
      console.log('既存のセッションID:', savedContextId);
      return savedContextId;
    }
    const newContextId = "demo-session-" + Date.now();
    Cookies.set('shoppie_context_id', newContextId, { expires: 7 }); // 7日間有効
    console.log('新しいセッションIDを作成:', newContextId);
    return newContextId;
  };

  // context ID を useRef で保持（初回のみ生成し、再レンダリング間で値を固定）
  const contextIdRef = useRef<string>(getContextId());

  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const submitSearch = async (text: string) => {
    if (!text.trim() || loadingRef.current) return;

    const trimmed = text.trim();
    loadingRef.current = true;
    setLoading(true);
    setTranscript("");
    stopRecognition();

    try {
      const res = await fetch("/api/request-assistance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          context_id: contextIdRef.current,
        }),
      });
      const data: { response: AgentResponse } = await res.json();
      if (data.response.products && data.response.products.length > 0) {
        setProducts(data.response.products);
      }
      setMessage(data.response.message);
    } catch (error) {
      console.error("検索エラー:", error);
      setMessage("申し訳ありません、現在商品をご案内できませんでした。");
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
    // 音声認識の初期化（自動開始はしない）
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

          // 最終的な発言が確定したらAPIに送信
          if (finalTranscript.trim() && finalTranscript !== lastVoiceInputRef.current) {
            lastVoiceInputRef.current = finalTranscript;
            submitSearchRef.current(finalTranscript);
            
            // 発言後少し待ってからトランスクリプトをクリア
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }
            silenceTimerRef.current = setTimeout(() => {
              setTranscript('');
            }, 2000);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('音声認識エラー:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    // クリーンアップ
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4 sm:p-8 md:p-16 font-sans flex flex-col items-center justify-center gap-8 sm:gap-16 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-400/20 to-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-emerald-400/10 to-teal-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px'
      }}></div>

      <header className="text-center flex flex-col items-center gap-6 relative z-10">
        <div className="relative">
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
            Shoppie
          </h1>
          {/* Holographic glow effect */}
          <div className="absolute inset-0 text-4xl sm:text-6xl md:text-8xl font-black tracking-tight bg-gradient-to-r from-cyan-400/30 via-purple-400/30 to-pink-400/30 bg-clip-text text-transparent blur-lg -z-10"></div>
        </div>
        <div className="relative backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 max-w-2xl">
          <p className="text-base sm:text-lg md:text-xl text-gray-200 leading-relaxed mb-4 sm:mb-6">
            話すだけで、買い物が進む ─ まるで店員と話すように商品を探せる
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent font-semibold"> 未来のショッピング体験</span>
          </p>
          
          {/* 音声認識（タップで起動） */}
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
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2s-2-.9-2-2V4c0-1.1.9-2 2-2zm6 6c0 3.53-2.61 6.43-6 6.92V21h-4v-6.08c-3.39-.49-6-3.39-6-6.92h2c0 2.76 2.24 5 5 5s5-2.24 5-5h2z" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gray-600 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2s-2-.9-2-2V4c0-1.1.9-2 2-2zm6 6c0 3.53-2.61 6.43-6 6.92V21h-4v-6.08c-3.39-.49-6-3.39-6-6.92h2c0 2.76 2.24 5 5 5s5-2.24 5-5h2z" />
                </svg>
              </div>
              <p className="text-center text-yellow-400 text-sm">
                お使いのブラウザは音声認識に対応していません
              </p>
            </div>
          )}
          
          {/* リアルタイム音声表示 */}
          {transcript && (
            <div className="mt-6 p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-400/30 rounded-xl backdrop-blur-sm animate-pulse">
              <p className="text-white text-center font-medium">
                💬 &quot;{transcript}&quot;
              </p>
            </div>
          )}

          {/* キーボード入力 */}
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
      </header>

      <section className="relative w-full max-w-6xl z-10">
        {products.length > 0 ? (
          /* Glass morphism container */
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
            {/* Header with animated gradient */}
            <div className="bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 p-8 border-b border-white/10">
              <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                {loading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <span className="ml-3">商品を検索中...</span>
                  </div>
                ) : (
                  message || "おすすめ商品"
                )}
              </h2>
            </div>

            {/* Products grid */}
            <div className="p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                {products.map((product, index) => (
                  <div
                    key={index}
                    className="group relative backdrop-blur-lg bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-500 hover:scale-105 hover:shadow-2xl"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {/* Holographic border effect */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-400/20 via-purple-400/20 to-pink-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm -z-10"></div>
                    
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
                      {/* Image overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl"></div>
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
                        className="w-full sm:w-auto relative px-4 sm:px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full text-white font-semibold text-sm hover:from-cyan-400 hover:to-purple-400 transition-all duration-300 hover:scale-105 hover:shadow-lg overflow-hidden group text-center"
                      >
                        <span className="relative z-10">商品を見る</span>
                        {/* Button glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/50 to-purple-400/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md"></div>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Welcome/Prompt UI */
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-12 text-center">
              {loading ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce"></div>
                    <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-3 h-3 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                    商品を検索中...
                  </h2>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-8">
                  {/* Shopping icon */}
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center animate-pulse">
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                    <div className="absolute inset-0 w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-r from-cyan-400/30 to-purple-400/30 rounded-full animate-ping"></div>
                  </div>

                  {/* Welcome message */}
                  <div className="space-y-4">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                      何かお探しですか？
                    </h2>
                    <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl leading-relaxed">
                      話しかけるか、キーワードを入力して商品を探せます。
                      <br className="hidden sm:block" />
                      <span className="text-cyan-400 font-semibold">ぴったりの商品をご提案</span>いたします。
                    </p>
                  </div>

                  {/* Example prompts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-8 max-w-4xl">
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
              )}
            </div>
          </div>
        )}
      </section>

      <footer className="text-sm text-gray-400 text-center relative z-10 backdrop-blur-sm bg-white/5 rounded-full px-6 py-3 border border-white/10">
        <p>© {new Date().getFullYear()} Shoppie Inc. All rights reserved.</p>
      </footer>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
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