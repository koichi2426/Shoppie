"""Run from the repository root with PYTHONPATH=fastapi/backend and development dependencies.

Uses the local .env; writes only synthetic records and removes them after verification.
"""
import json
import uuid
from pathlib import Path

import psycopg
from dotenv import dotenv_values

from domain.services.conversation_history import ConversationTurn
from domain.value_objects.interaction_event import new_client_interaction_event
from infrastructure.gateways.interaction_log.postgres_event_recorder import PostgresInteractionEventRecorder
from infrastructure.gateways.langgraph.conversation_store import ConversationStore
from infrastructure.gateways.langgraph.test_conversation_store import graph, turn


def main():
    url = dotenv_values('.env')['INTERACTION_DATABASE_URL']
    context = 'verification-' + uuid.uuid4().hex
    ids = [str(uuid.uuid4()) for _ in range(2)]
    recorder = PostgresInteractionEventRecorder(url)
    store = ConversationStore(url, idle_ttl=0, database_schema='shoppie_checkpoints')
    result = {'synthetic_only': True, 'supabase_region': 'ap-southeast-2', 'render_configured': False}
    try:
        recorder.initialize()
        store.start()
        turn(store, graph(store), context, '人工データの接続確認1')
        recorder.save_turn(ConversationTurn(context, ids[0], 'verification', '人工データの接続確認1', 'OK', []))
        store.close()
        store = ConversationStore(url, idle_ttl=0, database_schema='shoppie_checkpoints')
        store.start()
        state = turn(store, graph(store), context, '人工データの接続確認2')
        result['checkpoint_messages_after_restart'] = len(state['messages'])
        recorder.save_turn(ConversationTurn(context, ids[1], 'verification', '人工データの接続確認2', 'OK', []))
        result['idle_cleanup_count'] = store.cleanup()
        store.delete(context)
        recorder.record(new_client_interaction_event('conversation_reset', context))
        recorder.close()
        with psycopg.connect(url, connect_timeout=10) as connection:
            result['history_rows'] = connection.execute(
                'SELECT count(*) FROM shoppie_analytics.conversation_turns WHERE context_id=%s', (context,)
            ).fetchone()[0]
            result['postgres_version'] = connection.execute('SHOW server_version').fetchone()[0]
            result['reset_preserved_archive'] = result['history_rows'] == 2
            result['reaction_write_read_verified'] = connection.execute(
                'SELECT count(*) FROM shoppie_analytics.interaction_events WHERE context_id=%s', (context,)
            ).fetchone()[0] == 1
        assert result['checkpoint_messages_after_restart'] == 4 and result['reset_preserved_archive']
    finally:
        store.delete(context)
        store.close()
        recorder.close()
        with psycopg.connect(url, connect_timeout=10) as connection:
            connection.execute('DELETE FROM shoppie_analytics.conversation_turns WHERE context_id=%s', (context,))
            connection.execute('DELETE FROM shoppie_analytics.interaction_events WHERE context_id=%s', (context,))
    result['synthetic_rows_removed'] = True
    Path(__file__).with_name('supabase-verification.json').write_text(json.dumps(result, indent=2) + '\n')
    print('Supabase checkpoint/history verification passed; synthetic rows removed')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit('Storage verification failed: ' + type(error).__name__) from None
