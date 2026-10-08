'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminData, AdminFilters, AdminTab, ArchivedTurn } from '@/lib/admin/types';
function initialFilters(): AdminFilters {
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' });
  const today = new Date(); const before = new Date(today); before.setDate(before.getDate() - 6);
  return { from: format.format(before), to: format.format(today), config: '', page: 1 };
}
export function useAdminDashboard() {
  const router = useRouter();
  const [tab, setTabState] = useState<AdminTab>('overview');
  const [filters, setFilters] = useState<AdminFilters>(initialFilters);
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [turns, setTurns] = useState<ArchivedTurn[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [truncated, setTruncated] = useState(false);
  const detailController = useRef<AbortController | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search); const value = params.get('tab');
    if (value === 'overview' || value === 'conversations' || value === 'events') setTabState(value);
  }, []);
  const setTab = (value: AdminTab) => {
    setTabState(value); setFilters(current => ({ ...current, page: 1 }));
    const url = new URL(window.location.href); url.searchParams.set('tab', value); window.history.replaceState(null, '', url);
  };
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    const params = new URLSearchParams({ from: filters.from, to: filters.to, config: filters.config, page: String(filters.page) });
    fetch('/api/admin/data?' + params, { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (response.status === 401) { router.replace('/admin/login'); throw new Error('ログインしてください。'); } const body = await response.json(); if (!response.ok) throw new Error(body.error); return body; })
      .then(setData).catch(reason => { if (!controller.signal.aborted) { setError(reason.message || '読み込めませんでした。'); setData(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, refresh, router]);
  useEffect(() => () => detailController.current?.abort(), []);
  const selectConversation = useCallback(async (context: string) => {
    detailController.current?.abort(); const controller = new AbortController(); detailController.current = controller;
    setSelected(context); setTurns([]); setDetailError(''); setDetailLoading(true);
    try {
      const response = await fetch('/api/admin/conversations/' + encodeURIComponent(context), { cache: 'no-store', signal: controller.signal });
      if (response.status === 401) { router.replace('/admin/login'); return; }
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setTurns(body.turns); setTruncated(body.truncated);
    } catch (reason) { if (!controller.signal.aborted) setDetailError(reason instanceof Error ? reason.message : '会話を読み込めませんでした。'); }
    finally { if (!controller.signal.aborted) setDetailLoading(false); }
  }, [router]);
  const closeDetail = () => { detailController.current?.abort(); setSelected(null); };
  const logout = async () => { const response = await fetch('/api/admin/logout', { method: 'POST' }); if (response.ok) { router.replace('/admin/login'); router.refresh(); } else setError('ログアウトできませんでした。'); };
  return { tab, setTab, filters, setFilters, data, loading, error, selected, turns, detailLoading, detailError, truncated, selectConversation, closeDetail, logout, reload: () => setRefresh(value => value + 1) };
}
