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

export async function GET(req: NextRequest) {
  const password = getPassword(req);
  if (!isValidAdminPassword(password)) {
    return unauthorized();
  }

  try {
    const data = await fetchBackendAdmin<{ sessions: unknown[] }>('/admin/sessions');
    logger.info('admin.sessions', 'listed sessions', { count: data.sessions.length });
    return NextResponse.json(data);
  } catch (error) {
    logger.error('admin.sessions', 'failed to list sessions', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const password = getPassword(req);
  if (!isValidAdminPassword(password)) {
    return unauthorized();
  }

  try {
    const data = await deleteBackendAdmin<{
      deleted_sessions: number;
      deleted_memories: number;
    }>('/admin/sessions');
    logger.info('admin.sessions', 'deleted all sessions', {
      deletedSessions: data.deleted_sessions,
      deletedMemories: data.deleted_memories,
    });
    return NextResponse.json(data);
  } catch (error) {
    logger.error('admin.sessions', 'failed to delete all sessions', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to delete sessions' }, { status: 500 });
  }
}
