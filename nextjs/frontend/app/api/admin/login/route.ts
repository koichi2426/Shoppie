import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, COOKIE_NAME, cookieOptions, issueSession, sameOrigin, validCredentials } from '@/lib/admin/auth';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'アクセスできません。' }, { status: 403 });
  if (!authConfigured()) return NextResponse.json({ error: '管理者ログインはまだ設定されていません。' }, { status: 503 });
  if (Number(request.headers.get('content-length')) > 2048) return NextResponse.json({ error: '入力が長すぎます。' }, { status: 413 });
  let input;
  try { const text = await request.text(); if (text.length > 2048) throw new Error(); input = JSON.parse(text); }
  catch { return NextResponse.json({ error: '入力を確認してください。' }, { status: 400 }); }
  if (typeof input?.username !== 'string' || typeof input?.password !== 'string' || !validCredentials(input.username, input.password)) {
    await new Promise(resolve => setTimeout(resolve, 400));
    return NextResponse.json({ error: 'ユーザー名またはパスワードが違います。' }, { status: 401 });
  }
  (await cookies()).set(COOKIE_NAME, issueSession(), cookieOptions);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
