import { NextResponse } from 'next/server';

import { deleteBackendAdmin, fetchBackendAdmin } from '@/lib/admin-api';
import { logger } from '@/lib/logger';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;

  try {
    const data = await fetchBackendAdmin(`/admin/sessions/${encodeURIComponent(threadId)}`);
    logger.info('admin.session', 'fetched session', { threadId });
    return NextResponse.json(data);
  } catch (error: any) {
    const status = error?.response?.status;
    logger.error('admin.session', 'failed to fetch session', {
      threadId,
      status,
      error: error instanceof Error ? error.message : String(error),
    });

    if (status === 404) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;

  try {
    const data = await deleteBackendAdmin(`/admin/sessions/${encodeURIComponent(threadId)}`);
    logger.info('admin.session', 'deleted session', { threadId, data });
    return NextResponse.json(data);
  } catch (error: any) {
    const status = error?.response?.status;
    logger.error('admin.session', 'failed to delete session', {
      threadId,
      status,
      error: error instanceof Error ? error.message : String(error),
    });

    if (status === 404) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
