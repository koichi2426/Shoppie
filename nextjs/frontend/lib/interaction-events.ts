import type { InteractionEventBody } from '@/types/api';
import { getApiUrl } from '@/lib/api';

const TEXT_PLAIN = 'text/plain;charset=UTF-8';

// 商品カードを押すと別タブでモールへ移り、アプリ内ブラウザではこのページが閉じることもある。
// 閉じても届くよう sendBeacon で送る。text/plain にして CORS のプリフライトを起こさない
// (サーバーは Content-Type に関わらず本文を JSON として読む)。
export function sendInteractionEvent(event: InteractionEventBody): void {
  const url = `${getApiUrl()}/events`;
  const body = JSON.stringify(event);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(url, new Blob([body], { type: TEXT_PLAIN }))) return;
    }
    void fetch(url, {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'Content-Type': TEXT_PLAIN },
    }).catch(() => {});
  } catch {
    // 計測の失敗で買い物の操作を止めない
  }
}
