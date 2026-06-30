import { NextRequest, NextResponse } from 'next/server';

import { RequestAssistanceController } from '@/app/backend/adapter/controller/request_assistance_controller';
import { NewRequestAssistanceInteractor } from '@/app/backend/usecase/request_assistance_usecase';
import { DefaultRequestAssistancePresenter } from '@/app/backend/adapter/presenter/default_request_assistance_presenter';
import { DefaultUser } from '@/app/backend/infrastructure/domain/default_user';
import { DefaultAigent } from '@/app/backend/infrastructure/domain/default_aigent';
import { logger } from '@/app/backend/lib/logger';

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

    const user = new DefaultUser();
    const aigent = new DefaultAigent();
    const presenter = new DefaultRequestAssistancePresenter();
    const usecase = NewRequestAssistanceInteractor(user, aigent, presenter);
    const controller = new RequestAssistanceController(usecase);

    const result = await controller.execute({
      utterance: {
        text: body.text,
        context_id: body.context_id
      }
    });

    const response = 'response' in result.data ? result.data.response : undefined;
    logger.info('api.request-assistance', 'request completed', {
      status: result.status,
      durationMs: Date.now() - startedAt,
      productCount: response?.products?.length ?? 0,
      messagePreview: response?.message ? logger.truncate(response.message) : undefined,
    });

    return NextResponse.json(result.data, { status: result.status });
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
