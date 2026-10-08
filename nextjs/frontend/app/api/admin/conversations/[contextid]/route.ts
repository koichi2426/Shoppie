import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/admin/auth';
import { conversationDetail } from '@/lib/admin/database';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ contextid: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  if (!await authenticated()) return NextResponse.json({ error: 'ログインしてください。' }, { status: 401, headers });
  const { contextid } = await params;
  if (!contextid || contextid.length > 128) return NextResponse.json({ error: '会話の指定を確認してください。' }, { status: 400, headers });
  try { const turns = await conversationDetail(contextid); return NextResponse.json({ turns, truncated: turns.length === 200 }, { headers }); }
  catch (error) { console.error('Admin conversation query failed', (error as { code?: string })?.code ?? ''); return NextResponse.json({ error: '会話を読み込めませんでした。' }, { status: 503, headers }); }
}
