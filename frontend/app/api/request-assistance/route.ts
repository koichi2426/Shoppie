import { NextRequest, NextResponse } from 'next/server';

import { RequestAssistanceController } from '@/app/backend/adapter/controller/request_assistance_controller';
import { NewRequestAssistanceInteractor } from '@/app/backend/usecase/request_assistance_usecase';
import { DefaultRequestAssistancePresenter } from '@/app/backend/adapter/presenter/default_request_assistance_presenter';

// インフラ層の汎用実装をインポート
import { DefaultUser } from '@/app/backend/infrastructure/domain/default_user';
import { DefaultAigent } from '@/app/backend/infrastructure/domain/default_aigent';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.text || !body.context_id) {
      return NextResponse.json(
        { error: 'Missing required fields: text, context_id' },
        { status: 400 }
      );
    }

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

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid input or server error' },
      { status: 500 }
    );
  }
}
