import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_NAME, cookieOptions, sameOrigin } from '@/lib/admin/auth';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  (await cookies()).set(COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
