import type { SessionDetail } from '@/types/api';

export async function fetchSession(contextId: string): Promise<SessionDetail | null> {
  const res = await fetch(`/api/admin/sessions/${encodeURIComponent(contextId)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error('Failed to fetch session');
  }
  return res.json();
}
