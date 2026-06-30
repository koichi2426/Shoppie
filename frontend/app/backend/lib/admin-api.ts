import axios from 'axios';

function getAdminConfig(): { apiUrl: string; adminKey: string } {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    throw new Error('ADMIN_API_KEY is not configured');
  }

  return { apiUrl, adminKey };
}

function adminHeaders(): Record<string, string> {
  const { adminKey } = getAdminConfig();
  return {
    'X-Admin-Key': adminKey,
  };
}

export async function fetchBackendAdmin<T>(path: string): Promise<T> {
  const { apiUrl } = getAdminConfig();
  const response = await axios.get<T>(`${apiUrl}${path}`, {
    headers: adminHeaders(),
  });
  return response.data;
}

export async function deleteBackendAdmin<T>(path: string): Promise<T> {
  const { apiUrl } = getAdminConfig();
  const response = await axios.delete<T>(`${apiUrl}${path}`, {
    headers: adminHeaders(),
  });
  return response.data;
}

export function isValidAdminPassword(password: string | null | undefined): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected && password && password === expected);
}
