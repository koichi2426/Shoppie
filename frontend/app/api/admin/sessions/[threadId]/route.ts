import { NextRequest, NextResponse } from 'next/server';

import { deleteBackendAdmin, fetchBackendAdmin, isValidAdminPassword } from '@/app/backend/lib/admin-api';
import { logger } from '@/app/backend/lib/logger';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function getPassword(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return null;
  }
  return auth.slice('Bearer '.length);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const password = getPassword(req);
  if (!isValidAdminPassword(password)) {
    return unauthorized();
  }

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
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const password = getPassword(req);
  if (!isValidAdminPassword(password)) {
    return unauthorized();
  }

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
