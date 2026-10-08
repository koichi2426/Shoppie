import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/admin/auth';
import { dashboardData, parseFilters } from '@/lib/admin/database';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  if (!await authenticated()) return NextResponse.json({ error: 'ログインしてください。' }, { status: 401, headers });
  let filters;
  try { filters = parseFilters(new URL(request.url).searchParams); }
  catch { return NextResponse.json({ error: '期間と構成の指定を確認してください。' }, { status: 400, headers }); }
  try { return NextResponse.json(await dashboardData(filters), { headers }); }
  catch (error) { console.error('Admin dashboard query failed', (error as { code?: string })?.code ?? ''); return NextResponse.json({ error: 'データを読み込めませんでした。しばらく待って再読み込みしてください。' }, { status: 503, headers }); }
}
