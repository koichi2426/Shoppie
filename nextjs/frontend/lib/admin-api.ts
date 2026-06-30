export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data?.detail || data?.error || res.statusText), {
      status: res.status,
      data,
    });
  }
  return data as T;
}

export async function fetchBackendAdmin<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`);
  return parseJsonResponse<T>(res);
}

export async function deleteBackendAdmin<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, { method: 'DELETE' });
  return parseJsonResponse<T>(res);
}
