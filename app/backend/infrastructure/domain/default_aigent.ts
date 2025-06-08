import { AIgent } from '@/app/backend/domain/aigent';
import { AgentResponse } from '@/app/backend/domain/agent_response';
import { UserUtterance } from '@/app/backend/domain/user_utterance';
import { Product } from '@/app/backend/domain/product';

export class DefaultAigent implements AIgent {
  name = 'DefaultAigent';

  async respond(utterance: UserUtterance): Promise<AgentResponse> {
    const dummyProducts: Product[] = [
      {
        title: 'SONY ワイヤレスイヤホン WF-1000XM5',
        price: 34800,
        image_urls: [
          'https://example.com/images/sony_wf1000xm5_1.jpg',
          'https://example.com/images/sony_wf1000xm5_2.jpg'
        ],
        affiliate_url: 'https://example.com/product/sony-wf1000xm5?ref=shoppie',
        description: '業界最高クラスのノイズキャンセリング。音質・装着感・バッテリーすべてを高次元で両立した人気モデル。'
      },
      {
        title: 'Apple AirPods Pro（第2世代）',
        price: 39800,
        image_urls: [
          'https://example.com/images/airpods_pro_2ndgen.jpg'
        ],
        affiliate_url: 'https://example.com/product/airpods-pro2?ref=shoppie',
        description: 'Apple製品とのシームレスな連携が魅力。空間オーディオ対応で音楽や映画も臨場感たっぷり。'
      },
      {
        title: 'Anker Soundcore Liberty 4',
        price: 12900,
        image_urls: [
          'https://example.com/images/anker_liberty4.jpg'
        ],
        affiliate_url: 'https://example.com/product/anker-liberty4?ref=shoppie',
        description: '高コスパながらLDAC対応。運動にも最適な装着感と、パワフルな低音が特徴のワイヤレスイヤホン。'
      }
    ];

    return {
      message: `「${utterance.text}」へのおすすめ商品をご紹介します：`,
      products: dummyProducts
    };
  }
}
