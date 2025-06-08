"use client";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";

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
  const [isListening, setIsListening] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [lastVoiceInput, setLastVoiceInput] = useState("");
  const [isRecognitionSupported, setIsRecognitionSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const contextIdRef = useRef("demo-session-" + Date.now());
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    // 音声認識の初期化と自動開始
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsRecognitionSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ja-JP';

        recognition.onresult = (event: any) => {
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
          if (finalTranscript.trim() && finalTranscript !== lastVoiceInput) {
            setLastVoiceInput(finalTranscript);
            handleVoiceInput(finalTranscript);
            
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
          // エラーが発生しても再開を試みる
          setTimeout(() => {
            if (recognitionRef.current && isRecognitionSupported) {
              try {
                recognition.start();
              } catch (e) {
                console.log('音声認識再開に失敗');
              }
            }
          }, 1000);
        };

        recognition.onend = () => {
          // 音声認識が終了したら自動的に再開
          if (isRecognitionSupported) {
            setTimeout(() => {
              try {
                recognition.start();
              } catch (e) {
                console.log('音声認識再開に失敗');
              }
            }, 100);
          }
        };

        recognitionRef.current = recognition;
        
        // 自動で音声認識を開始
        try {
          recognition.start();
        } catch (e) {
          console.log('音声認識の開始に失敗');
        }
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

  // 音声合成の初期化
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthesisRef.current = window.speechSynthesis;
    }
  }, []);

  // メッセージを読み上げる関数
  const speakMessage = (text: string) => {
    if (!synthesisRef.current) return;
    
    // 既存の読み上げを停止
    synthesisRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    synthesisRef.current.speak(utterance);
  };

  // 音声入力をAPIに送信する関数
  const handleVoiceInput = async (voiceText: string) => {
    if (!voiceText.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/request-assistance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: voiceText,
          context_id: contextIdRef.current
        })
      });
      const data: { response: AgentResponse } = await res.json();
      setProducts(data.response.products);
      setMessage(data.response.message);
      
      // メッセージを読み上げる
      if (data.response.message) {
        speakMessage(data.response.message);
      }
    } catch (error) {
      console.error("音声検索エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-8 sm:p-16 font-sans flex flex-col items-center justify-center gap-16 relative overflow-hidden">
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
          <h1 className="text-6xl sm:text-8xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
            Shoppie
          </h1>
          {/* Holographic glow effect */}
          <div className="absolute inset-0 text-6xl sm:text-8xl font-black tracking-tight bg-gradient-to-r from-cyan-400/30 via-purple-400/30 to-pink-400/30 bg-clip-text text-transparent blur-lg -z-10"></div>
        </div>
        <div className="relative backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 max-w-2xl">
          <p className="text-lg sm:text-xl text-gray-200 leading-relaxed mb-4">
            話すだけで、買い物が進む ─ まるで店員と話すように商品を探せる
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent font-semibold"> 未来のショッピング体験</span>
          </p>
          
          {/* 音声認識ステータス表示 */}
          {isRecognitionSupported ? (
            <div className="flex items-center justify-center gap-4">
              {/* 音声波形アニメーション */}
              <div className="flex items-center gap-1">
                <div className={`w-1 bg-gradient-to-t from-cyan-400 to-purple-400 rounded-full transition-all duration-300 ${transcript ? 'h-8 animate-pulse' : 'h-4'}`}></div>
                <div className={`w-1 bg-gradient-to-t from-purple-400 to-pink-400 rounded-full transition-all duration-300 ${transcript ? 'h-12 animate-pulse' : 'h-6'}`} style={{ animationDelay: '0.1s' }}></div>
                <div className={`w-1 bg-gradient-to-t from-pink-400 to-red-400 rounded-full transition-all duration-300 ${transcript ? 'h-6 animate-pulse' : 'h-8'}`} style={{ animationDelay: '0.2s' }}></div>
                <div className={`w-1 bg-gradient-to-t from-red-400 to-orange-400 rounded-full transition-all duration-300 ${transcript ? 'h-10 animate-pulse' : 'h-4'}`} style={{ animationDelay: '0.3s' }}></div>
                <div className={`w-1 bg-gradient-to-t from-orange-400 to-yellow-400 rounded-full transition-all duration-300 ${transcript ? 'h-4 animate-pulse' : 'h-6'}`} style={{ animationDelay: '0.4s' }}></div>
              </div>
              
              <div className="text-center">
                <p className="text-sm font-semibold text-cyan-400 mb-1">
                  常時待機中
                </p>
                <p className="text-xs text-gray-400">
                  話しかけてください
                </p>
              </div>
            </div>
          ) : (
            <p className="text-center text-yellow-400 text-sm">
              お使いのブラウザは音声認識に対応していません
            </p>
          )}
          
          {/* リアルタイム音声表示 */}
          {transcript && (
            <div className="mt-4 p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-400/30 rounded-xl backdrop-blur-sm animate-pulse">
              <p className="text-white text-center font-medium">
                💬 "{transcript}"
              </p>
            </div>
          )}
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
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {products.map((product, index) => (
                  <div
                    key={index}
                    className="group relative backdrop-blur-lg bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-500 hover:scale-105 hover:shadow-2xl"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {/* Holographic border effect */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-400/20 via-purple-400/20 to-pink-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm -z-10"></div>
                    
                    <div className="relative overflow-hidden rounded-xl mb-4">
                      <Image
                        src={product.image_urls[0] || "/placeholder.jpg"}
                        alt={product.title}
                        width={300}
                        height={200}
                        className="rounded-xl w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      {/* Image overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl"></div>
                    </div>

                    <h3 className="font-bold text-xl mb-2 text-white group-hover:text-cyan-300 transition-colors duration-300">
                      {product.title}
                    </h3>
                    
                    <p className="text-sm text-gray-300 mb-4 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        ¥{product.price.toLocaleString()}
                      </p>
                      
                      <a
                        href={product.affiliate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full text-white font-semibold text-sm hover:from-cyan-400 hover:to-purple-400 transition-all duration-300 hover:scale-105 hover:shadow-lg overflow-hidden group"
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
                    <div className="w-24 h-24 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center animate-pulse">
                      <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                    <div className="absolute inset-0 w-24 h-24 bg-gradient-to-r from-cyan-400/30 to-purple-400/30 rounded-full animate-ping"></div>
                  </div>

                  {/* Welcome message */}
                  <div className="space-y-4">
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                      何かお探しですか？
                    </h2>
                    <p className="text-xl text-gray-300 max-w-2xl leading-relaxed">
                      お気軽に話しかけてください。欲しい商品について詳しく教えていただければ、
                      <br />
                      <span className="text-cyan-400 font-semibold">ぴったりの商品をご提案</span>いたします。
                    </p>
                  </div>

                  {/* Example prompts */}
                  <div className="grid md:grid-cols-3 gap-4 mt-8 max-w-4xl">
                    <div className="backdrop-blur-sm bg-white/5 p-4 rounded-xl border border-white/10">
                      <div className="text-cyan-400 text-sm font-semibold mb-2">💻 家電・ガジェット</div>
                      <p className="text-gray-300 text-sm">「ワイヤレスイヤホンを探してる」</p>
                    </div>
                    <div className="backdrop-blur-sm bg-white/5 p-4 rounded-xl border border-white/10">
                      <div className="text-purple-400 text-sm font-semibold mb-2">👕 ファッション</div>
                      <p className="text-gray-300 text-sm">「洗えるスニーカーってある？」</p>
                    </div>
                    <div className="backdrop-blur-sm bg-white/5 p-4 rounded-xl border border-white/10">
                      <div className="text-pink-400 text-sm font-semibold mb-2">🎁 ギフト</div>
                      <p className="text-gray-300 text-sm">「プレゼント用の時計を見せて」</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <footer className="text-sm text-gray-400 text-center relative z-10 backdrop-blur-sm bg-white/5 rounded-full px-6 py-3 border border-white/10">
        <p>© 2025 Shoppie Inc. All rights reserved.</p>
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