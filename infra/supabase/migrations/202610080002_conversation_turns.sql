-- Long-term history is separate from mutable LangGraph checkpoints.
CREATE TABLE IF NOT EXISTS shoppie_analytics.conversation_turns (
    turn_id uuid PRIMARY KEY,
    context_id text NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    config_version text NOT NULL,
    user_text text NOT NULL,
    assistant_text text NOT NULL,
    products jsonb NOT NULL CHECK (jsonb_typeof(products) = 'array'),
    status text NOT NULL CHECK (status IN ('completed', 'failed'))
);
CREATE INDEX IF NOT EXISTS conversation_turns_context_idx
    ON shoppie_analytics.conversation_turns(context_id, occurred_at);
ALTER TABLE shoppie_analytics.conversation_turns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shoppie_analytics.conversation_turns FROM PUBLIC;
DO $$
DECLARE api_role text;
BEGIN
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
            EXECUTE format('REVOKE ALL ON shoppie_analytics.conversation_turns FROM %I', api_role);
        END IF;
    END LOOP;
END $$;
