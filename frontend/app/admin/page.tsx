"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

interface SessionSummary {
  thread_id: string;
  created_at: string;
  last_active_at: string;
  turn_count: number;
  last_user_message: string;
  memory_only?: boolean;
}

interface SessionTurn {
  timestamp: string;
  user_message: string;
  assistant_message: string;
  product_count: number;
  products_preview: Array<{ title: string; price: string }>;
}

interface SessionDetail extends SessionSummary {
  turns: SessionTurn[];
  memory_messages: Array<{ role: string; content: string }>;
}

const AUTH_STORAGE_KEY = "shoppie_admin_password";

function formatDate(value: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ja-JP");
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authPassword, setAuthPassword] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) {
      setAuthPassword(saved);
    }
  }, []);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${authPassword ?? ""}`,
    }),
    [authPassword]
  );

  const loadSessions = useCallback(async () => {
    if (!authPassword) return;

    setLoadingSessions(true);
    setError("");

    try {
      const res = await fetch("/api/admin/sessions", { headers: authHeaders });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthPassword(null);
        }
        throw new Error(data.error || "セッション一覧の取得に失敗しました");
      }

      setSessions(data.sessions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "セッション一覧の取得に失敗しました");
    } finally {
      setLoadingSessions(false);
    }
  }, [authPassword, authHeaders]);

  const loadSessionDetail = useCallback(
    async (threadId: string) => {
      if (!authPassword) return;

      setSelectedThreadId(threadId);
      setLoadingDetail(true);
      setError("");

      try {
        const res = await fetch(`/api/admin/sessions/${encodeURIComponent(threadId)}`, {
          headers: authHeaders,
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "セッション詳細の取得に失敗しました");
        }

        setSessionDetail(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "セッション詳細の取得に失敗しました");
        setSessionDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    },
    [authPassword, authHeaders]
  );

  const deleteSession = useCallback(
    async (threadId: string) => {
      if (!authPassword) return;
      if (!window.confirm(`セッション「${threadId}」を削除しますか？`)) return;

      setDeletingThreadId(threadId);
      setError("");

      try {
        const res = await fetch(`/api/admin/sessions/${encodeURIComponent(threadId)}`, {
          method: "DELETE",
          headers: authHeaders,
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "セッションの削除に失敗しました");
        }

        setSessions((current) => current.filter((session) => session.thread_id !== threadId));
        if (selectedThreadId === threadId) {
          setSelectedThreadId(null);
          setSessionDetail(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "セッションの削除に失敗しました");
      } finally {
        setDeletingThreadId(null);
      }
    },
    [authPassword, authHeaders, selectedThreadId]
  );

  const deleteAllSessions = useCallback(async () => {
    if (!authPassword) return;
    if (!window.confirm("全セッションを削除しますか？この操作は取り消せません。")) return;

    setDeletingAll(true);
    setError("");

    try {
      const res = await fetch("/api/admin/sessions", {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "全セッションの削除に失敗しました");
      }

      setSessions([]);
      setSelectedThreadId(null);
      setSessionDetail(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "全セッションの削除に失敗しました");
    } finally {
      setDeletingAll(false);
    }
  }, [authPassword, authHeaders]);

  useEffect(() => {
    if (authPassword) {
      loadSessions();
    }
  }, [authPassword, loadSessions]);

  const handleLogin = (event: FormEvent) => {
    event.preventDefault();
    if (!password.trim()) return;
    sessionStorage.setItem(AUTH_STORAGE_KEY, password);
    setAuthPassword(password);
    setPassword("");
  };

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthPassword(null);
    setSessions([]);
    setSessionDetail(null);
    setSelectedThreadId(null);
  };

  if (!authPassword) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md"
        >
          <h1 className="text-2xl font-bold mb-2">Shoppie Admin</h1>
          <p className="text-sm text-gray-400 mb-6">管理用パスワードを入力してください</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 mb-4 focus:outline-none focus:border-cyan-400/50"
            placeholder="ADMIN_PASSWORD"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 py-3 font-semibold hover:from-cyan-400 hover:to-purple-400"
          >
            ログイン
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">Shoppie Admin</h1>
            <p className="text-sm text-gray-400">全セッションの閲覧・削除</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadSessions}
              disabled={loadingSessions || deletingAll}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
            >
              更新
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="text-sm text-gray-300">セッション一覧 ({sessions.length})</div>
            <button
              type="button"
              onClick={deleteAllSessions}
              disabled={sessions.length === 0 || deletingAll}
              className="rounded-lg border border-red-400/30 px-3 py-1 text-xs text-red-200 hover:bg-red-500/10 disabled:opacity-50"
            >
              {deletingAll ? "削除中..." : "全削除"}
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {loadingSessions && sessions.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">読み込み中...</p>
            ) : sessions.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">まだセッションがありません</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.thread_id}
                  className={`border-b border-white/5 ${
                    selectedThreadId === session.thread_id ? "bg-white/10" : ""
                  }`}
                >
                  <div className="flex items-start gap-2 px-4 py-4">
                    <button
                      type="button"
                      onClick={() => loadSessionDetail(session.thread_id)}
                      className="min-w-0 flex-1 text-left hover:opacity-90"
                    >
                      <div className="font-mono text-xs text-cyan-300 break-all">{session.thread_id}</div>
                      {session.memory_only && (
                        <div className="mt-1 inline-block rounded-full border border-yellow-400/30 px-2 py-0.5 text-[10px] text-yellow-200">
                          メモリのみ
                        </div>
                      )}
                      <div className="mt-2 text-sm text-white line-clamp-2">
                        {session.last_user_message || "（発言なし）"}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                        <span>{session.turn_count} ターン</span>
                        <span>{formatDate(session.last_active_at)}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSession(session.thread_id)}
                      disabled={deletingThreadId === session.thread_id || deletingAll}
                      className="shrink-0 rounded-lg border border-red-400/30 px-2 py-1 text-xs text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {deletingThreadId === session.thread_id ? "..." : "削除"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 min-h-[70vh]">
          {!selectedThreadId ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              左のセッションを選択してください
            </div>
          ) : loadingDetail ? (
            <div className="text-gray-400">詳細を読み込み中...</div>
          ) : sessionDetail ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold mb-2">セッション詳細</h2>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm space-y-2">
                    <div>
                      <span className="text-gray-400">ID: </span>
                      <span className="font-mono break-all">{sessionDetail.thread_id}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">作成: </span>
                      {formatDate(sessionDetail.created_at)}
                    </div>
                    <div>
                      <span className="text-gray-400">最終アクセス: </span>
                      {formatDate(sessionDetail.last_active_at)}
                    </div>
                    {sessionDetail.memory_only && (
                      <div className="text-yellow-200">LangGraphメモリのみ存在するセッションです</div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteSession(sessionDetail.thread_id)}
                  disabled={deletingThreadId === sessionDetail.thread_id || deletingAll}
                  className="rounded-lg border border-red-400/30 px-4 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {deletingThreadId === sessionDetail.thread_id ? "削除中..." : "このセッションを削除"}
                </button>
              </div>

              <div>
                <h3 className="text-base font-semibold mb-3">会話ターン</h3>
                {sessionDetail.turns.length === 0 ? (
                  <p className="text-sm text-gray-400">会話ターンはありません</p>
                ) : (
                  <div className="space-y-4">
                    {sessionDetail.turns.map((turn, index) => (
                      <div key={`${turn.timestamp}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs text-gray-400 mb-3">{formatDate(turn.timestamp)}</div>
                        <div className="mb-3">
                          <div className="text-xs text-cyan-300 mb-1">ユーザー</div>
                          <p className="text-sm whitespace-pre-wrap">{turn.user_message}</p>
                        </div>
                        <div className="mb-3">
                          <div className="text-xs text-purple-300 mb-1">アシスタント</div>
                          <p className="text-sm whitespace-pre-wrap">
                            {turn.assistant_message || "（応答なし）"}
                          </p>
                        </div>
                        <div className="text-xs text-gray-400">
                          商品 {turn.product_count} 件
                          {turn.products_preview.length > 0 && (
                            <ul className="mt-2 space-y-1 text-gray-300">
                              {turn.products_preview.map((product, productIndex) => (
                                <li key={`${product.title}-${productIndex}`}>
                                  ・{product.title}（¥{product.price}）
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-base font-semibold mb-3">LangGraph メモリ</h3>
                <div className="space-y-2">
                  {sessionDetail.memory_messages.length === 0 ? (
                    <p className="text-sm text-gray-400">メモリに保存されたメッセージはありません</p>
                  ) : (
                    sessionDetail.memory_messages.map((message, index) => (
                      <div key={`${message.role}-${index}`} className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <div className="text-xs text-gray-400 mb-1">{message.role}</div>
                        <pre className="text-xs whitespace-pre-wrap break-words text-gray-200">
                          {message.content}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400">セッション詳細を取得できませんでした</div>
          )}
        </section>
      </main>
    </div>
  );
}
