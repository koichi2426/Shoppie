import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const body = await req.json();

    if (!body.text || !body.context_id) {
      logger.warn('api.request-assistance', 'validation failed', {
        hasText: Boolean(body.text),
        hasContextId: Boolean(body.context_id),
      });
      return NextResponse.json(
        { error: 'Missing required fields: text, context_id' },
        { status: 400 }
      );
    }

    logger.info('api.request-assistance', 'request received', {
      contextId: body.context_id,
      text: logger.truncate(body.text),
    });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const backendResponse = await fetch(`${apiUrl}/request-assistance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body.text, context_id: body.context_id }),
    });
    const resultData = await backendResponse.json();
    const response = resultData?.response;
    logger.info('api.request-assistance', 'request completed', {
      status: backendResponse.status,
      durationMs: Date.now() - startedAt,
      productCount: response?.products?.length ?? 0,
      messagePreview: response?.message ? logger.truncate(response.message) : undefined,
    });

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: resultData?.detail || 'Failed to process request assistance' },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json(resultData, { status: backendResponse.status });
  } catch (error) {
    logger.error('api.request-assistance', 'request failed', {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Invalid input or server error' },
      { status: 500 }
    );
  }
}
