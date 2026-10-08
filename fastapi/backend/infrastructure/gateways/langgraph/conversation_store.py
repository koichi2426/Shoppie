"""Shared checkpoints, idle expiry and per-conversation execution locks.

Postgres advisory locks cover the entire graph invocation, including its checkpoint
writes. A separate pool holds these locks so graph writes cannot exhaust it.
"""

import hashlib
import json
import os
import re
import threading
import time
from contextlib import contextmanager

from langgraph.checkpoint.memory import MemorySaver


class ConversationBusyError(RuntimeError):
    pass


class ConversationStore:
    def __init__(self, database_url=None, idle_ttl=180, database_schema=None):
        self.database_url = database_url
        if database_schema and not re.fullmatch(r"[a-z_][a-z0-9_]*", database_schema):
            raise ValueError("Invalid conversation database schema")
        self.database_schema = database_schema
        self.idle_ttl = idle_ttl
        self.checkpointer = MemorySaver()
        self.pool = None
        self.lock_pool = None
        self.ready = False
        self._access = {}
        self._locks = {}
        self._guard = threading.Lock()

    def start(self):
        if self.ready:
            return
        conninfo = self.database_url
        if not conninfo and os.getenv("DATABASE_SECRET_ARN"):
            import boto3
            self._secret_client = boto3.client("secretsmanager")
            # Read the current secret on each new physical connection, so RDS
            # password rotation does not leave the pool reconnecting with an old password.
            self._secret_connection_string()
            conninfo = self._secret_connection_string
        if not conninfo:
            self.ready = True
            return

        from langgraph.checkpoint.postgres import PostgresSaver
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool

        kwargs = {"autocommit": True, "prepare_threshold": 0,
                  "row_factory": dict_row, "connect_timeout": 10}
        if self.database_schema:
            kwargs["options"] = "-c search_path=" + self.database_schema
        self.pool = ConnectionPool(conninfo, min_size=1, max_size=8,
                                   kwargs=kwargs, open=False, timeout=10)
        self.lock_pool = ConnectionPool(conninfo, min_size=1, max_size=32,
                                        kwargs=kwargs, open=False, timeout=10)
        try:
            self.pool.open(wait=True, timeout=15)
            self.lock_pool.open(wait=True, timeout=15)
            saver = PostgresSaver(self.pool)
            # setup() runs DDL; serialize migrations across simultaneously starting tasks.
            with self.lock_pool.connection() as conn:
                # A blocking advisory-lock query would leave an active transaction:
                # CREATE INDEX CONCURRENTLY in setup() could then wait on that waiter.
                deadline = time.monotonic() + 120
                while not conn.execute("SELECT pg_try_advisory_lock(%s) AS locked",
                                       (self._key("schema"),)).fetchone()["locked"]:
                    if time.monotonic() >= deadline:
                        raise TimeoutError("Checkpoint schema initialization timed out")
                    time.sleep(0.1)
                try:
                    if self.database_schema:
                        from psycopg import sql
                        schema = sql.Identifier(self.database_schema)
                        conn.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(schema))
                        conn.execute(sql.SQL("REVOKE ALL ON SCHEMA {} FROM PUBLIC").format(schema))
                    saver.setup()
                    conn.execute("""CREATE TABLE IF NOT EXISTS shoppie_conversations (
                        thread_id TEXT PRIMARY KEY,
                        last_access TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
                    )""")
                    conn.execute("CREATE INDEX IF NOT EXISTS shoppie_conversations_access "
                                 "ON shoppie_conversations(last_access)")
                finally:
                    conn.execute("SELECT pg_advisory_unlock(%s)", (self._key("schema"),))
            self.checkpointer = saver
            self.ready = True
        except BaseException:
            self.close()
            raise

    def close(self):
        self.ready = False
        if self.pool:
            self.pool.close()
        if self.lock_pool:
            self.lock_pool.close()

    def _secret_connection_string(self):
        from psycopg.conninfo import make_conninfo

        secret = json.loads(self._secret_client.get_secret_value(
            SecretId=os.environ["DATABASE_SECRET_ARN"]
        )["SecretString"])
        return make_conninfo(host=os.environ["DATABASE_HOST"], port=5432,
                             dbname=os.getenv("DATABASE_NAME", "shoppie"),
                             user=secret["username"], password=secret["password"],
                             sslmode="require", connect_timeout=10)

    @staticmethod
    def _key(thread_id):
        return int.from_bytes(hashlib.blake2b(
            ("shoppie:" + thread_id).encode(), digest_size=8
        ).digest(), "big", signed=True)

    @contextmanager
    def conversation(self, thread_id, wait_seconds=15):
        """All writers and deletion paths must hold this lock.

        Release happens in the synchronous worker, even if its HTTP caller disconnects.
        """
        if self.lock_pool:
            with self.lock_pool.connection() as conn:
                key = self._key("conversation:" + thread_id)
                deadline = time.monotonic() + wait_seconds
                while not conn.execute("SELECT pg_try_advisory_lock(%s) AS locked",
                                       (key,)).fetchone()["locked"]:
                    if time.monotonic() >= deadline:
                        raise ConversationBusyError("この会話は処理中です。少し待って再送してください。")
                    time.sleep(0.05)
                try:
                    yield
                finally:
                    conn.execute("SELECT pg_advisory_unlock(%s)", (key,))
        else:
            with self._guard:
                entry = self._locks.setdefault(thread_id, [threading.Lock(), 0])
                entry[1] += 1
            acquired = entry[0].acquire(timeout=wait_seconds)
            try:
                if not acquired:
                    raise ConversationBusyError("この会話は処理中です。少し待って再送してください。")
                yield
            finally:
                if acquired:
                    entry[0].release()
                with self._guard:
                    entry[1] -= 1
                    if entry[1] == 0:
                        del self._locks[thread_id]

    def touch(self, thread_id):
        if self.pool:
            with self.pool.connection() as conn:
                conn.execute("INSERT INTO shoppie_conversations(thread_id) VALUES (%s) "
                             "ON CONFLICT(thread_id) DO UPDATE SET last_access=clock_timestamp()",
                             (thread_id,))
        else:
            with self._guard:
                self._access[thread_id] = time.monotonic()

    def thread_ids(self):
        if self.pool:
            with self.pool.connection() as conn:
                return [r["thread_id"] for r in conn.execute(
                    "SELECT thread_id FROM shoppie_conversations ORDER BY thread_id")]
        return list(self.checkpointer.storage)

    def _delete_locked(self, thread_id):
        existed = self.checkpointer.get({"configurable": {"thread_id": thread_id}}) is not None
        self.checkpointer.delete_thread(thread_id)
        if self.pool:
            with self.pool.connection() as conn:
                conn.execute("DELETE FROM shoppie_conversations WHERE thread_id=%s", (thread_id,))
        else:
            with self._guard:
                self._access.pop(thread_id, None)
        return existed

    def delete(self, thread_id):
        with self.conversation(thread_id):
            return self._delete_locked(thread_id)

    def _is_stale(self, thread_id):
        if self.pool:
            with self.pool.connection() as conn:
                return conn.execute("SELECT thread_id FROM shoppie_conversations "
                                    "WHERE thread_id=%s AND last_access < "
                                    "clock_timestamp() - %s * interval '1 second'",
                                    (thread_id, self.idle_ttl)).fetchone() is not None
        with self._guard:
            accessed = self._access.get(thread_id)
        return accessed is not None and time.monotonic() - accessed >= self.idle_ttl

    def cleanup(self):
        if self.idle_ttl <= 0:
            return 0
        if self.pool:
            with self.pool.connection() as conn:
                candidates = [r["thread_id"] for r in conn.execute(
                    "SELECT thread_id FROM shoppie_conversations WHERE last_access < "
                    "clock_timestamp() - %s * interval '1 second' LIMIT 100",
                    (self.idle_ttl,))]
        else:
            with self._guard:
                candidates = list(self._access)
        deleted = 0
        for thread_id in candidates:
            try:
                with self.conversation(thread_id, wait_seconds=0):
                    if self._is_stale(thread_id):
                        deleted += int(self._delete_locked(thread_id))
            except ConversationBusyError:
                pass  # Active turns are never expired by another task.
        return deleted

    def healthcheck(self):
        if not self.ready:
            raise RuntimeError("Conversation store is not ready")
        if self.pool:
            with self.pool.connection(timeout=2) as conn:
                conn.execute("SELECT 1")
