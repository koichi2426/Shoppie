-- The admin UI connects through a dedicated read-only role.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='shoppie_admin_reader') THEN
    CREATE ROLE shoppie_admin_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA shoppie_analytics TO shoppie_admin_reader;
GRANT SELECT ON shoppie_analytics.conversation_turns, shoppie_analytics.interaction_events TO shoppie_admin_reader;
DROP POLICY IF EXISTS admin_read_turns ON shoppie_analytics.conversation_turns;
CREATE POLICY admin_read_turns ON shoppie_analytics.conversation_turns FOR SELECT TO shoppie_admin_reader USING (true);
DROP POLICY IF EXISTS admin_read_events ON shoppie_analytics.interaction_events;
CREATE POLICY admin_read_events ON shoppie_analytics.interaction_events FOR SELECT TO shoppie_admin_reader USING (true);
