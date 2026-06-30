import { getApiUrl } from '@/lib/admin-api';
import type { SessionDetail } from '@/types/api';

export async function fetchSession(contextId: string): Promise<SessionDetail | null> {
  const res = await fetch(
    `${getApiUrl()}/admin/sessions/${encodeURIComponent(contextId)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error('Failed to fetch session');
  }
  return res.json();
}

export async function deleteSession(contextId: string): Promise<void> {
  const res = await fetch(
    `${getApiUrl()}/admin/sessions/${encodeURIComponent(contextId)}`,
    { method: 'DELETE' }
  );
  if (res.status === 404) return;
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail || data?.error || 'Failed to delete session');
  }
}
