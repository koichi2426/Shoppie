'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';
import type { AdminData, AdminTab, Metrics } from '@/lib/admin/types';
import styles from './admin.module.css';
const number = (value: number) => new Intl.NumberFormat('ja-JP').format(value);
const rate = (value: number, total: number) => total ? `${(value / total * 100).toFixed(1)}%` : '—';
const timestamp = (value: string) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const eventLabels: Record<string, string> = { turn_completed: '返答完了', turn_failed: '返答失敗', product_click: '商品クリック', conversation_reset: '会話リセット' };
const navigation: { key: AdminTab; label: string; icon: string }[] = [{ key: 'overview', label: '概要', icon: '◫' }, { key: 'conversations', label: '会話履歴', icon: '☷' }, { key: 'events', label: '反応イベント', icon: '⌁' }];
function Cards({ metrics }: { metrics: Metrics }) {
  return <div className={styles.cards}>
    <div className={styles.stat}><span>会話数</span><strong>{number(metrics.conversations)}</strong><small>{number(metrics.turns)} 往復を記録</small></div>
    <div className={styles.stat}><span>商品クリック率</span><strong className={styles.teal}>{rate(metrics.clicked, metrics.with_products)}</strong><small>商品あり {number(metrics.with_products)} 往復中 {number(metrics.clicked)} 往復</small></div>
    <div className={styles.stat}><span>商品0件率</span><strong>{rate(metrics.zero_results, metrics.turns)}</strong><small>{number(metrics.zero_results)} 往復で商品なし</small></div>
    <div className={styles.stat}><span>エラー率</span><strong>{rate(metrics.failed, metrics.turns)}</strong><small>{number(metrics.failed)} 往復が失敗</small></div>
  </div>;
}
function Activity({ data }: { data: AdminData }) {
  const max = Math.max(...data.daily.map(item => item.turns), 1);
  return <section className={styles.panel}><div className={styles.panelHeading}><div><h2>会話の推移</h2><p>1日ごとの往復数とクリックされた往復数</p></div><div className={styles.legend}><span>● 往復</span><span className={styles.teal}>● クリックあり</span></div></div>
    {data.daily.length ? <div className={styles.chart} aria-label="日別の会話数"><div className={styles.chartBars}>{data.daily.map(day => <div key={day.day} className={styles.chartDay} title={`${day.day}：${day.turns}往復 / クリック${day.clicked}往復`}>
      <div className={styles.chartTrack}><span className={styles.chartBar} style={{ height: `${day.turns / max * 100}%` }} /><span className={styles.clickBar} style={{ height: `${day.clicked / max * 100}%` }} /><span className={styles.chartValue}>{day.turns}</span></div><span>{day.day.slice(5).replace('-', '/')}</span></div>)}</div></div>
      : <div className={styles.empty}>この期間の会話はまだありません。<small>会話が記録されると、ここに推移が表示されます。</small></div>}
  </section>;
}
function ConfigurationTable({ data }: { data: AdminData }) {
  return <section className={styles.panel}><div className={styles.panelHeading}><div><h2>構成ごとの比較</h2><p>プロンプト・モデルなどの構成を、反応で比較する</p></div><span className={styles.countBadge}>{data.configs.length} 構成</span></div>
    <div className={styles.tableWrap}><table><thead><tr><th>構成</th><th>往復</th><th>クリック率</th><th>商品0件率</th><th>エラー率</th><th>応答時間 p95</th></tr></thead><tbody>{data.configs.map(config => <tr key={config.config_version}><td><code>{config.config_version}</code></td><td>{number(config.turns)}</td><td className={styles.teal}>{rate(config.clicked, config.with_products)}</td><td>{rate(config.zero_results, config.turns)}</td><td>{rate(config.failed, config.turns)}</td><td>{config.p95_duration_ms === null ? '—' : `${(config.p95_duration_ms / 1000).toFixed(1)} 秒`}</td></tr>)}</tbody></table></div>
    {!data.configs.length && <div className={styles.empty}>比較できるデータはまだありません。</div>}
    <p className={styles.tableNote}>クリック率は商品を提案した往復が分母です。クリックは購入を意味しません。</p>
  </section>;
}
function Detail({ vm }: { vm: ReturnType<typeof useAdminDashboard> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} className={styles.dialog} onCancel={event => { event.preventDefault(); vm.closeDetail(); }} aria-labelledby="conversation-title">
    <div className={styles.dialogHead}><div><span className={styles.eyebrow}>CONVERSATION</span><h2 id="conversation-title">会話の詳細</h2><code>{vm.selected}</code></div><button onClick={vm.closeDetail} aria-label="会話の詳細を閉じる" className={styles.closeButton}>×</button></div>
    <div className={styles.dialogBody}>{vm.detailLoading && <p role="status">会話を読み込み中…</p>}{vm.detailError && <p role="alert" className={styles.error}>{vm.detailError}</p>}
      {!vm.detailLoading && !vm.detailError && !vm.turns.length && <div className={styles.empty}>この会話の履歴はありません。</div>}
      {vm.turns.map((turn, index) => <article className={styles.turn} key={turn.turn_id}><div className={styles.turnMeta}><span>{String(index + 1).padStart(2, '0')} / {timestamp(turn.occurred_at)}</span><code>{turn.config_version}</code><span className={turn.status === 'failed' ? styles.failure : styles.status}>{turn.status === 'failed' ? '失敗' : '完了'}</span></div>
        <div className={styles.userMessage}><span>ユーザー</span><p>{turn.user_text}</p></div><div className={styles.assistantMessage}><span>Shoppie</span><p>{turn.assistant_text || (turn.status === 'failed' ? '返答を生成できませんでした。' : '返答なし')}</p></div>
        {!!turn.products.length && <div className={styles.products}>{turn.products.map((product, productIndex) => <div key={productIndex}><span className={styles.productRank}>{productIndex + 1}</span><div><strong>{product.title}</strong><small>{product.marketplace || 'モール不明'} · ¥{number(product.price)}</small></div></div>)}</div>}
        <div className={styles.turnFoot}>{turn.products.length} 商品を提案 · {turn.clicks} 回クリック<code>{turn.turn_id}</code></div>
      </article>)}{vm.truncated && <p className={styles.tableNote}>先頭200往復を表示しています。</p>}
    </div>
  </dialog>;
}
export function AdminDashboard() {
  const vm = useAdminDashboard(); const title = navigation.find(item => item.key === vm.tab)?.label;
  const total = vm.tab === 'events' ? vm.data?.event_count || 0 : vm.data?.conversation_count || 0;
  return <div className={styles.shell}>
    <aside className={styles.sidebar}><Link href="/admin" className={styles.brand}><span className={styles.brandMark}>s</span>shoppie<span className={styles.adminBadge}>ADMIN</span></Link><span className={styles.menuLabel}>WORKSPACE</span>
      <nav aria-label="管理者メニュー">{navigation.map(item => <button key={item.key} onClick={() => vm.setTab(item.key)} className={vm.tab === item.key ? styles.activeNav : styles.navButton} aria-current={vm.tab === item.key ? 'page' : undefined}><span aria-hidden>{item.icon}</span>{item.label}{vm.tab === item.key && <span className={styles.navDot} />}</button>)}</nav>
      <div className={styles.sidebarBottom}><Link href="/">↗ Shoppieを開く</Link><div className={styles.adminUser}><span>A</span><div><strong>管理者</strong><small>Shoppie workspace</small></div><button onClick={vm.logout} aria-label="ログアウト" title="ログアウト">↪</button></div></div>
    </aside>
    <main className={styles.main}><header className={styles.topbar}><span>Shoppie <span className={styles.separator}>/</span> 管理者画面</span><span className={styles.privateBadge}>● 管理者限定</span></header>
      <div className={styles.content}><div className={styles.pageHeading}><div><span className={styles.eyebrow}>ANALYTICS & INSIGHTS</span><h1>{title}</h1><p>{vm.tab === 'overview' ? '会話と反応から、提案の質を確かめる。' : vm.tab === 'conversations' ? 'どんな相談に、何を提案したか。' : '返答のあとに起きた反応を確認する。'}</p></div><button className={styles.secondaryButton} onClick={vm.reload} disabled={vm.loading}>{vm.loading ? '読み込み中…' : '↻ 再読み込み'}</button></div>
      <div className={styles.filters}><div className={styles.period}><label>期間<input type="date" aria-label="開始日" value={vm.filters.from} max={vm.filters.to} onChange={event => vm.setFilters(current => ({ ...current, from: event.target.value, page: 1 }))} /></label><span>—</span><label><span className={styles.srOnly}>終了日</span><input type="date" aria-label="終了日" value={vm.filters.to} min={vm.filters.from} onChange={event => vm.setFilters(current => ({ ...current, to: event.target.value, page: 1 }))} /></label><small>日本時間</small></div>
        <label className={styles.configFilter}>構成<select value={vm.filters.config} onChange={event => vm.setFilters(current => ({ ...current, config: event.target.value, page: 1 }))}><option value="">すべての構成</option>{vm.data?.config_options.map(config => <option key={config} value={config}>{config}</option>)}</select></label>
      </div>
      {vm.error && <div role="alert" className={styles.error}>{vm.error}<button onClick={vm.reload}>再試行</button></div>}
      {vm.loading && <div role="status" className={styles.loading}><span />保存されたデータを読み込んでいます…</div>}
      {!vm.loading && vm.data && <>
        {vm.tab === 'overview' && <><Cards metrics={vm.data.metrics} /><Activity data={vm.data} /><ConfigurationTable data={vm.data} /></>}
        {vm.tab === 'conversations' && <section className={styles.panel}><div className={styles.panelHeading}><div><h2>保存された会話</h2><p>会話を選ぶと、発話・返答・提案商品を確認できます</p></div><span className={styles.countBadge}>{number(total)} 件</span></div><div className={styles.tableWrap}><table><thead><tr><th>最終更新</th><th>最後の発話</th><th>往復</th><th>クリックされた往復</th><th>状態</th><th /></tr></thead><tbody>{vm.data.conversations.map(conversation => <tr key={conversation.context_id}><td>{timestamp(conversation.last_at)}</td><td className={styles.previewCell}><button onClick={() => vm.selectConversation(conversation.context_id)}>{conversation.preview}</button><code>{conversation.context_id}</code></td><td>{conversation.turns}</td><td>{conversation.clicks}</td><td><span className={conversation.failed ? styles.failure : styles.status}>{conversation.failed ? `${conversation.failed} 件失敗` : '完了'}</span></td><td><button className={styles.viewButton} onClick={() => vm.selectConversation(conversation.context_id)} aria-label={`${conversation.preview}の会話を開く`}>開く →</button></td></tr>)}</tbody></table></div>{!total && <div className={styles.empty}>この期間の会話はまだありません。</div>}</section>}
        {vm.tab === 'events' && <section className={styles.panel}><div className={styles.panelHeading}><div><h2>反応の記録</h2><p>返答・クリック・リセットを、往復の識別子で追う</p></div><span className={styles.countBadge}>{number(total)} 件</span></div><div className={styles.tableWrap}><table><thead><tr><th>日時</th><th>イベント</th><th>会話・往復</th><th>詳細</th></tr></thead><tbody>{vm.data.events.map(event => <tr key={event.event_id}><td>{timestamp(event.occurred_at)}</td><td><span className={event.event_type === 'turn_failed' ? styles.failure : styles.eventBadge}>{eventLabels[event.event_type] || event.event_type}</span></td><td className={styles.previewCell}><button onClick={() => vm.selectConversation(event.context_id)}>{event.context_id}</button><code>{event.turn_id || '—'}</code></td><td>{event.event_type === 'product_click' ? `${event.payload.marketplace || 'モール不明'} · ${event.payload.rank ?? '—'} 位 · ${event.payload.price_yen == null ? '価格なし' : '¥' + number(event.payload.price_yen)}` : event.payload.duration_ms != null ? `${(event.payload.duration_ms / 1000).toFixed(1)} 秒 · ${event.payload.product_count ?? 0} 商品` : '会話をリセット'}<small className={styles.eventCommit}>{event.config_version || event.payload.commit || ''}</small></td></tr>)}</tbody></table></div>{!total && <div className={styles.empty}>この期間のイベントはまだありません。</div>}</section>}
        {vm.tab !== 'overview' && <div className={styles.pagination}><span>{total ? `${(vm.filters.page - 1) * 25 + 1}–${Math.min(vm.filters.page * 25, total)} / ${number(total)} 件` : '0 件'}</span><div><button disabled={vm.filters.page === 1} onClick={() => vm.setFilters(current => ({ ...current, page: current.page - 1 }))}>← 前へ</button><button disabled={vm.filters.page * 25 >= total} onClick={() => vm.setFilters(current => ({ ...current, page: current.page + 1 }))}>次へ →</button></div></div>}
        <footer className={styles.footer}><span>集計対象：選択した期間に保存された会話と反応</span><span>更新 {timestamp(vm.data.generated_at)}</span></footer>
      </>}
      </div>
    </main>{vm.selected && <Detail vm={vm} />}
  </div>;
}
