'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
export function useAdminLogin() {
  const router = useRouter(); const [username, setUsername] = useState('admin'); const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setPassword(''); router.replace('/admin'); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'ログインできませんでした。'); }
    finally { setLoading(false); }
  };
  return { username, setUsername, password, setPassword, loading, error, submit };
}
