export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

export async function deleteContext(
  contextId: string,
): Promise<{ deleted: boolean }> {
  const res = await fetch(`${getApiUrl()}/context/${encodeURIComponent(contextId)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error('Failed to reset conversation context');
  }
  if (res.status === 404) {
    return { deleted: false };
  }
  const data = (await res.json()) as { deleted?: boolean };
  return { deleted: Boolean(data.deleted) };
}
