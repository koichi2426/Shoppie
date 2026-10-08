"""Export PostgreSQL events as stdout-compatible JSON lines for the existing aggregator.

PYTHONPATH=. python scripts/export_interaction_events.py > events.log
PYTHONPATH=. python scripts/aggregate_interaction_events.py events.log --json
"""

import argparse
import json
import os
import sys
from datetime import datetime

import psycopg
from dotenv import load_dotenv


def export_events(database_url: str, output, since: datetime | None = None) -> int:
    count = 0
    with psycopg.connect(database_url, connect_timeout=5, prepare_threshold=None) as connection:
        with connection.cursor(name="interaction_export") as cursor:
            cursor.execute(
                "SELECT payload FROM shoppie_analytics.interaction_events "
                "WHERE (%s::timestamptz IS NULL OR occurred_at >= %s) "
                "ORDER BY occurred_at, event_id", (since, since),
            )
            for (payload,) in cursor:
                output.write("interaction_event " + json.dumps(payload, ensure_ascii=False) + "\n")
                count += 1
    return count


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--since", type=datetime.fromisoformat, help="ISO8601 timestamp with timezone")
    args = parser.parse_args()
    if args.since and args.since.tzinfo is None:
        parser.error("--since requires a timezone")
    url = os.getenv("INTERACTION_DATABASE_URL", "").strip()
    if not url:
        parser.error("Set INTERACTION_DATABASE_URL in the environment or .env")
    try:
        export_events(url, sys.stdout, args.since)
    except Exception as error:
        parser.exit(1, f"Event export failed ({type(error).__name__}); check connection and migration\n")


if __name__ == "__main__":
    main()
