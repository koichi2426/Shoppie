import 'server-only';
import { Pool } from 'pg';
import { SUPABASE_ROOT_CA } from './supabase-ca';
import type { AdminData, AdminFilters, ArchivedTurn } from './types';

const globalPool = globalThis as typeof globalThis & { shoppieAdminPool?: Pool };
// pg は接続文字列の sslmode を ssl オプションより優先する。sslmode=require のままだと
// CA の指定が捨てられて Node の標準ストアで検証され失敗するため、URL から外して ssl で指定する。
function connectionString(url: string) {
  const parsed = new URL(url);
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) parsed.searchParams.delete(key);
  return parsed.toString();
}
function pool() {
  if (!process.env.ADMIN_DATABASE_URL) throw new Error('Admin database is not configured');
  if (!globalPool.shoppieAdminPool) {
    globalPool.shoppieAdminPool = new Pool({ connectionString: connectionString(process.env.ADMIN_DATABASE_URL), max: 2,
      ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
      idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000, statement_timeout: 10000,
      options: '-c default_transaction_read_only=on', allowExitOnIdle: true });
    globalPool.shoppieAdminPool.on('error', () => console.error('Admin database connection failed'));
  }
  return globalPool.shoppieAdminPool;
}
export function parseFilters(params: URLSearchParams): AdminFilters {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const prior = new Date(`${today}T00:00:00+09:00`); prior.setUTCDate(prior.getUTCDate() - 6);
  const from = params.get('from') || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(prior);
  const to = params.get('to') || today;
  for (const date of [from, to]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Invalid date');
  }
  if (from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) throw new Error('Invalid date range');
  const config = params.get('config') || '';
  if (config.length > 64 || !/^[a-zA-Z0-9_-]*$/.test(config)) throw new Error('Invalid configuration');
  const page = Number(params.get('page') || 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error('Invalid page');
  return { from, to, config, page };
}
function bounds(filters: AdminFilters) {
  const end = new Date(`${filters.to}T00:00:00+09:00`); end.setUTCDate(end.getUTCDate() + 1);
  return [`${filters.from}T00:00:00+09:00`, end.toISOString(), filters.config];
}
const BASE = `WITH turns AS (
  SELECT t.*, jsonb_array_length(t.products) AS product_count,
    EXISTS(SELECT 1 FROM shoppie_analytics.interaction_events e WHERE e.turn_id=t.turn_id AND e.context_id=t.context_id AND e.event_type='product_click') AS clicked,
    (SELECT (e.payload->>'duration_ms')::double precision FROM shoppie_analytics.interaction_events e
     WHERE e.turn_id=t.turn_id AND e.context_id=t.context_id AND e.event_type IN ('turn_completed','turn_failed') ORDER BY e.occurred_at LIMIT 1) AS duration_ms
  FROM shoppie_analytics.conversation_turns t
  WHERE t.occurred_at >= $1::timestamptz AND t.occurred_at < $2::timestamptz AND ($3='' OR t.config_version=$3)
)`;
const METRICS = `count(DISTINCT context_id)::int AS conversations, count(*)::int AS turns,
 count(*) FILTER (WHERE status='completed' AND product_count>0)::int AS with_products,
 count(*) FILTER (WHERE status='completed' AND product_count>0 AND clicked)::int AS clicked,
 count(*) FILTER (WHERE status='completed' AND product_count=0)::int AS zero_results,
 count(*) FILTER (WHERE status='failed')::int AS failed,
 avg(duration_ms)::double precision AS avg_duration_ms,
 percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::double precision AS p95_duration_ms`;
export async function dashboardData(filters: AdminFilters): Promise<AdminData> {
  const client = await pool().connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const args = bounds(filters);
    const metrics = await client.query(`${BASE} SELECT ${METRICS} FROM turns`, args);
    const configs = await client.query(`${BASE} SELECT config_version, ${METRICS} FROM turns GROUP BY config_version ORDER BY turns DESC`, args);
    const daily = await client.query(`${BASE} SELECT (occurred_at AT TIME ZONE 'Asia/Tokyo')::date::text AS day, count(*)::int AS turns, count(*) FILTER (WHERE clicked)::int AS clicked FROM turns GROUP BY day ORDER BY day`, args);
    const options = await client.query('SELECT DISTINCT config_version FROM shoppie_analytics.conversation_turns WHERE occurred_at >= $1::timestamptz AND occurred_at < $2::timestamptz ORDER BY config_version', args.slice(0, 2));
    const conversationCount = await client.query(`${BASE} SELECT count(DISTINCT context_id)::int AS total FROM turns`, args);
    const conversations = await client.query(`${BASE} SELECT context_id, max(occurred_at) AS last_at, count(*)::int AS turns,
      (array_agg(left(user_text,100) ORDER BY occurred_at DESC))[1] AS preview,
      count(*) FILTER (WHERE status='failed')::int AS failed, count(*) FILTER (WHERE clicked)::int AS clicks
      FROM turns GROUP BY context_id ORDER BY last_at DESC, context_id LIMIT 25 OFFSET $4`, [...args, (filters.page - 1) * 25]);
    const eventWhere = `FROM shoppie_analytics.interaction_events e WHERE e.occurred_at >= $1::timestamptz AND e.occurred_at < $2::timestamptz AND ($3='' OR COALESCE(e.config_version,(SELECT t.config_version FROM shoppie_analytics.conversation_turns t WHERE t.turn_id=e.turn_id AND t.context_id=e.context_id))=$3)`;
    const events = await client.query(`SELECT event_id,occurred_at,event_type,context_id,turn_id,config_version,payload ${eventWhere} ORDER BY occurred_at DESC,event_id LIMIT 25 OFFSET $4`, [...args, (filters.page - 1) * 25]);
    const eventCount = await client.query(`SELECT count(*)::int AS total ${eventWhere}`, args);
    await client.query('COMMIT');
    return { metrics: metrics.rows[0], configs: configs.rows, config_options: options.rows.map(row => row.config_version), daily: daily.rows,
      conversations: conversations.rows, conversation_count: conversationCount.rows[0].total, events: events.rows, event_count: eventCount.rows[0].total, generated_at: new Date().toISOString() };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
export async function conversationDetail(contextId: string): Promise<ArchivedTurn[]> {
  if (contextId.length > 128) throw new Error('Invalid context');
  const result = await pool().query(`SELECT t.turn_id,t.occurred_at,t.config_version,t.user_text,t.assistant_text,t.products,t.status,
    (SELECT count(*)::int FROM shoppie_analytics.interaction_events e WHERE e.turn_id=t.turn_id AND e.context_id=t.context_id AND e.event_type='product_click') AS clicks
    FROM shoppie_analytics.conversation_turns t WHERE t.context_id=$1 ORDER BY t.occurred_at,t.turn_id LIMIT 200`, [contextId]);
  return result.rows;
}
