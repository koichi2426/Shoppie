"""Apply the versioned interaction-event schema to INTERACTION_DATABASE_URL."""

import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv


def main() -> None:
    load_dotenv()
    url = os.getenv("INTERACTION_DATABASE_URL", "").strip()
    if not url:
        sys.exit("Set INTERACTION_DATABASE_URL in the environment or .env")
    migration = Path(__file__).resolve().parents[3] / "infra/supabase/migrations/202610080001_interaction_events.sql"
    try:
        with psycopg.connect(url, connect_timeout=5, prepare_threshold=None) as connection:
            connection.execute(migration.read_text())
    except Exception as error:
        sys.exit(f"Event migration failed ({type(error).__name__}); check connection and permissions")
    print("Interaction event migration applied")


if __name__ == "__main__":
    main()
