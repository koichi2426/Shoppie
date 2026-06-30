import { AIgent } from '@/app/backend/domain/aigent';
import { AgentResponse } from '@/app/backend/domain/agent_response';
import { UserUtterance } from '@/app/backend/domain/user_utterance';
import { Product } from '@/app/backend/domain/product';
import axios from 'axios';
import { logger } from '@/app/backend/lib/logger';

interface RawProduct {
  title: string;
  url: string;
  image: string;
  price: string;
  description: string;
}

interface ChatApiResponse {
  response: {
    complete_raw_events?: Array<{
      llm_agent?: {
        messages?: {
          content?: string;
        };
      };
    }>;
    parsed_tool_content?: RawProduct[];
    error?: string;
  };
}

export class DefaultAigent implements AIgent {
  name = 'LangGraphAigent';

  async respond(utterance: UserUtterance): Promise<AgentResponse> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const startedAt = Date.now();

    logger.info('infra.aigent', 'backend request start', {
      apiUrl,
      threadId: utterance.context_id || 'default',
      text: logger.truncate(utterance.text),
    });

    try {
      const response = await axios.post<ChatApiResponse>(
        `${apiUrl}/chat`,
        {
          message: utterance.text,
          thread_id: utterance.context_id || 'default'
        }
      );

      const raw = response.data.response;
      const durationMs = Date.now() - startedAt;

      if (raw.error) {
        logger.error('infra.aigent', 'backend returned error', {
          durationMs,
          error: raw.error,
        });
        return {
          message: '申し訳ありません、現在商品をご案内できませんでした。',
          products: []
        };
      }

      const message =
        raw.complete_raw_events?.[0]?.llm_agent?.messages?.content ??
        `「${utterance.text}」へのおすすめ商品をご紹介します。`;

      const products: Product[] = Array.isArray(raw.parsed_tool_content)
        ? raw.parsed_tool_content.map((item) => ({
            title: item.title,
            price: Number(item.price),
            image_urls: [item.image],
            affiliate_url: item.url,
            description: item.description
          }))
        : [];

      logger.info('infra.aigent', 'backend request completed', {
        durationMs,
        status: response.status,
        eventCount: raw.complete_raw_events?.length ?? 0,
        productCount: products.length,
        messagePreview: logger.truncate(message),
      });

      return {
        message,
        products
      };
    } catch (error: any) {
      logger.error('infra.aigent', 'backend request failed', {
        durationMs: Date.now() - startedAt,
        message: error?.message,
        status: error?.response?.status,
        code: error?.code,
        responseData: error?.response?.data,
      });
      return {
        message: '申し訳ありません、現在商品をご案内できませんでした。',
        products: []
      };
    }
  }
}
