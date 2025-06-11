import { AIgent } from '@/app/backend/domain/aigent';
import { AgentResponse } from '@/app/backend/domain/agent_response';
import { UserUtterance } from '@/app/backend/domain/user_utterance';
import { Product } from '@/app/backend/domain/product';
import axios from 'axios';

interface RawProduct {
  title: string;
  url: string;
  image: string;
  price: string;
  description: string;
}

interface ChatApiResponse {
  response: {
    complete_raw_events?: {
      llm_agent?: {
        messages?: {
          content?: string;
        }[];
      };
    };
    parsed_tool_content?: RawProduct[];
  };
}

export class DefaultAigent implements AIgent {
  name = 'LangGraphAigent';

  async respond(utterance: UserUtterance): Promise<AgentResponse> {
    try {
      const response = await axios.post<ChatApiResponse>(
        'https://shoppie-agent.onrender.com/chat',
        {
          message: utterance.text,
          thread_id: utterance.context_id || 'default'
        }
      );

      const raw = response.data.response;

      const message =
        raw.complete_raw_events?.llm_agent?.messages?.[0]?.content ??
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

      return {
        message,
        products
      };
    } catch (error: any) {
      console.error('エージェント通信エラー:', error?.message || error);
      return {
        message: '申し訳ありません、現在商品をご案内できませんでした。',
        products: []
      };
    }
  }
}
