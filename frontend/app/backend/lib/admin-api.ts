import axios from 'axios';

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

export async function fetchBackendAdmin<T>(path: string): Promise<T> {
  const response = await axios.get<T>(`${getApiUrl()}${path}`);
  return response.data;
}

export async function deleteBackendAdmin<T>(path: string): Promise<T> {
  const response = await axios.delete<T>(`${getApiUrl()}${path}`);
  return response.data;
}
