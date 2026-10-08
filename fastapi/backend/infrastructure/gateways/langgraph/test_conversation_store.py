import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Annotated, TypedDict

import pytest
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import START, END, StateGraph
from langgraph.graph.message import add_messages

from infrastructure.gateways.langgraph.conversation_store import ConversationStore, ConversationBusyError


class State(TypedDict):
    messages: Annotated[list, add_messages]


def graph(store):
    builder = StateGraph(State)
    builder.add_node("reply", lambda state: {"messages": [AIMessage(content="OK")]})
    builder.add_edge(START, "reply")
    builder.add_edge("reply", END)
    return builder.compile(checkpointer=store.checkpointer)


def turn(store, app, thread, text):
    with store.conversation(thread):
        store.touch(thread)
        result = app.invoke({"messages": [HumanMessage(content=text)]},
                            {"configurable": {"thread_id": thread}})
        store.touch(thread)
        return result


def test_memory_cleanup_does_not_delete_active_turn():
    store = ConversationStore(idle_ttl=0.001)
    store.start()
    thread = str(uuid.uuid4())
    turn(store, graph(store), thread, "first")
    time.sleep(0.01)
    with store.conversation(thread):
        with ThreadPoolExecutor() as workers:
            assert workers.submit(store.cleanup).result() == 0
    assert store.cleanup() == 1
    assert store.thread_ids() == []
    assert store._locks == {}


def test_memory_busy_lock_does_not_leak_entries():
    store = ConversationStore()
    with store.conversation("same"):
        with ThreadPoolExecutor() as workers:
            def attempt():
                with pytest.raises(ConversationBusyError):
                    with store.conversation("same", wait_seconds=0):
                        pass
            workers.submit(attempt).result()
    assert store._locks == {}


def test_secret_is_refetched_for_new_connections(monkeypatch):
    from psycopg.conninfo import conninfo_to_dict
    import json

    monkeypatch.setenv("DATABASE_SECRET_ARN", "test-secret")
    monkeypatch.setenv("DATABASE_HOST", "db.example.test")
    class RotatingSecret:
        def __init__(self):
            self.version = 0

        def get_secret_value(self, **kwargs):
            self.version += 1
            return {"SecretString": json.dumps({"username": "shoppie", "password": str(self.version)})}

    store = ConversationStore()
    store._secret_client = RotatingSecret()
    old = conninfo_to_dict(store._secret_connection_string())
    new = conninfo_to_dict(store._secret_connection_string())
    assert old["password"] != new["password"]
    assert new["sslmode"] == "require"


@pytest.fixture
def stores():
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to a disposable PostgreSQL database")
    from psycopg import connect, sql
    from psycopg.conninfo import make_conninfo

    # Cleanup scans all expired rows. Isolate each test from running API traffic
    # and from other tests, instead of asserting counts in a shared database.
    name = "shoppie_test_" + uuid.uuid4().hex
    with connect(url, autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        pair = [ConversationStore(make_conninfo(url, dbname=name), idle_ttl=180) for _ in range(2)]
        try:
            with ThreadPoolExecutor() as workers:
                list(workers.map(lambda store: store.start(), pair))
            yield pair
        finally:
            for store in pair:
                store.close()
            admin.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name)))


def test_postgres_shares_history_and_survives_restart(stores):
    first, second = stores
    thread = str(uuid.uuid4())
    try:
        turn(first, graph(first), thread, "first")
        state = turn(second, graph(second), thread, "second")
        assert [m.content for m in state["messages"] if isinstance(m, HumanMessage)] == ["first", "second"]
        restarted = ConversationStore(first.database_url)
        restarted.start()
        try:
            assert restarted.checkpointer.get({"configurable": {"thread_id": thread}}) is not None
            assert restarted.delete(thread)
            assert second.checkpointer.get({"configurable": {"thread_id": thread}}) is None
            assert thread not in second.thread_ids()
        finally:
            restarted.close()
    finally:
        first.delete(thread)


def test_postgres_simultaneous_turns_preserve_both_inputs(stores):
    first, second = stores
    thread = str(uuid.uuid4())
    barrier = threading.Barrier(2)
    try:
        def invoke(args):
            store, text = args
            barrier.wait()
            return turn(store, graph(store), thread, text)
        with ThreadPoolExecutor() as workers:
            list(workers.map(invoke, [(first, "A"), (second, "B")]))
        state = second.checkpointer.get({"configurable": {"thread_id": thread}})
        assert sorted(m.content for m in state["channel_values"]["messages"]
                      if isinstance(m, HumanMessage)) == ["A", "B"]
    finally:
        first.delete(thread)


def test_postgres_cleanup_rechecks_expiry_and_skips_active_turn(stores):
    first, second = stores
    thread = str(uuid.uuid4())
    try:
        turn(first, graph(first), thread, "keep")
        # Age only our own test row; never expire other conversations in this database.
        with first.pool.connection() as conn:
            conn.execute("UPDATE shoppie_conversations SET last_access=clock_timestamp() "
                         "- interval '1 hour' WHERE thread_id=%s", (thread,))
        with first.conversation(thread):
            assert second.cleanup() == 0
            first.touch(thread)
        assert second.cleanup() == 0
        assert first.checkpointer.get({"configurable": {"thread_id": thread}}) is not None
        with first.pool.connection() as conn:
            conn.execute("UPDATE shoppie_conversations SET last_access=clock_timestamp() "
                         "- interval '1 hour' WHERE thread_id=%s", (thread,))
        assert second.cleanup() == 1
        assert first.checkpointer.get({"configurable": {"thread_id": thread}}) is None
    finally:
        first.delete(thread)


def test_postgres_reset_waits_for_running_turn(stores):
    first, second = stores
    thread = str(uuid.uuid4())
    started = threading.Event()
    try:
        with ThreadPoolExecutor() as workers:
            def reset():
                started.set()
                return second.delete(thread)
            with first.conversation(thread):
                future = workers.submit(reset)
                assert started.wait(2)
                time.sleep(0.1)
                assert not future.done()
                first.touch(thread)
                graph(first).invoke({"messages": [HumanMessage(content="in flight")]},
                                    {"configurable": {"thread_id": thread}})
            assert future.result(timeout=5)
        assert first.checkpointer.get({"configurable": {"thread_id": thread}}) is None
    finally:
        first.delete(thread)


def test_postgres_concurrent_startup_on_empty_database():
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL with CREATEDB permission")
    from psycopg import connect, sql
    from psycopg.conninfo import make_conninfo

    name = "shoppie_test_" + uuid.uuid4().hex
    with connect(url, autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        pair = [ConversationStore(make_conninfo(url, dbname=name)) for _ in range(2)]
        try:
            with ThreadPoolExecutor() as workers:
                futures = [workers.submit(store.start) for store in pair]
                for future in futures:
                    future.result(timeout=15)
            for store in pair:
                store.healthcheck()
        finally:
            for store in pair:
                store.close()
            admin.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name)))
