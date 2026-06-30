import { NextResponse } from 'next/server';

import { deleteBackendAdmin, fetchBackendAdmin } from '@/lib/admin-api';
import { logger } from '@/lib/logger';

export async function GET() {
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

export async function DELETE() {
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
