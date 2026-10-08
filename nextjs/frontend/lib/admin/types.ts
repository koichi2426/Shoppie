export type AdminTab = 'overview' | 'conversations' | 'events';
export interface AdminFilters { from: string; to: string; config: string; page: number }
export interface Metrics { conversations: number; turns: number; with_products: number; clicked: number; zero_results: number; failed: number; avg_duration_ms: number | null; p95_duration_ms: number | null }
export interface ConfigMetrics extends Metrics { config_version: string }
export interface ConversationSummary { context_id: string; last_at: string; turns: number; preview: string; failed: number; clicks: number }
export interface AdminEvent { event_id: string; occurred_at: string; event_type: string; context_id: string; turn_id: string | null; config_version: string | null; payload: { rank?: number; marketplace?: string; price_yen?: number; product_count?: number; duration_ms?: number; commit?: string } }
export interface ArchivedProduct { title: string; price: number; marketplace?: string; affiliate_url?: string; url?: string }
export interface ArchivedTurn { turn_id: string; occurred_at: string; config_version: string; user_text: string; assistant_text: string; products: ArchivedProduct[]; status: 'completed' | 'failed'; clicks: number }
export interface AdminData { metrics: Metrics; configs: ConfigMetrics[]; config_options: string[]; daily: { day: string; turns: number; clicked: number }[]; conversations: ConversationSummary[]; conversation_count: number; events: AdminEvent[]; event_count: number; generated_at: string }
