import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const SESSION_SECONDS = 8 * 60 * 60;
export const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-shoppie_admin' : 'shoppie_admin';

function digest(value: string) { return createHash('sha256').update(value).digest(); }
export function authConfigured() { return (process.env.ADMIN_PASSWORD?.length ?? 0) >= 16 && (process.env.ADMIN_SESSION_SECRET?.length ?? 0) >= 32; }
export function validCredentials(username: string, password: string) {
  if (!authConfigured()) return false;
  const userMatches = timingSafeEqual(digest(username), digest(process.env.ADMIN_USERNAME || 'admin'));
  const passwordMatches = timingSafeEqual(digest(password), digest(process.env.ADMIN_PASSWORD!));
  return userMatches && passwordMatches;
}
function signature(value: string) {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET!).update(`${value}:${digest(process.env.ADMIN_PASSWORD!).toString('hex')}`).digest('hex');
}
export function issueSession() {
  const value = `${Math.floor(Date.now() / 1000) + SESSION_SECONDS}.${randomBytes(16).toString('hex')}`;
  return `${value}.${signature(value)}`;
}
export function validSession(value: string | undefined) {
  if (!value || !authConfigured() || !/^\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(value)) return false;
  const [expiry, nonce, signed] = value.split('.');
  const now = Math.floor(Date.now() / 1000);
  if (Number(expiry) <= now || Number(expiry) > now + SESSION_SECONDS) return false;
  return timingSafeEqual(Buffer.from(signed, 'hex'), Buffer.from(signature(`${expiry}.${nonce}`), 'hex'));
}
export async function authenticated() { return validSession((await cookies()).get(COOKIE_NAME)?.value); }
export function sameOrigin(request: Request) { return request.headers.get('origin') === new URL(request.url).origin; }
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: SESSION_SECONDS };
