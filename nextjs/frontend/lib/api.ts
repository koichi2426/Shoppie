export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

export async function deleteContext(contextId: string): Promise<void> {
  const res = await fetch(`${getApiUrl()}/context/${encodeURIComponent(contextId)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error('Failed to reset conversation context');
  }
}
