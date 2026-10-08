-- Apply once using the Supabase SQL Editor (or psql as the database owner).
-- This schema is deliberately separate from the Data API's public schema.
CREATE SCHEMA IF NOT EXISTS shoppie_analytics;
REVOKE ALL ON SCHEMA shoppie_analytics FROM PUBLIC;

CREATE TABLE IF NOT EXISTS shoppie_analytics.interaction_events (
    event_id uuid PRIMARY KEY,
    occurred_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    event_type text NOT NULL CHECK (event_type IN
        ('turn_completed', 'turn_failed', 'product_click', 'conversation_reset')),
    context_id text NOT NULL,
    turn_id uuid,
    config_version text,
    payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS interaction_events_occurred_at_idx
    ON shoppie_analytics.interaction_events (occurred_at);
CREATE INDEX IF NOT EXISTS interaction_events_turn_id_idx
    ON shoppie_analytics.interaction_events (turn_id);
CREATE INDEX IF NOT EXISTS interaction_events_config_version_idx
    ON shoppie_analytics.interaction_events (config_version, occurred_at);

ALTER TABLE shoppie_analytics.interaction_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shoppie_analytics.interaction_events FROM PUBLIC;
DO $$
DECLARE api_role text;
BEGIN
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
            EXECUTE format('REVOKE ALL ON SCHEMA shoppie_analytics FROM %I', api_role);
            EXECUTE format('REVOKE ALL ON shoppie_analytics.interaction_events FROM %I', api_role);
        END IF;
    END LOOP;
END $$;
-- No browser policies: only the backend's owner connection writes/reads events.
