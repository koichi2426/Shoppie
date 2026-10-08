from scripts.aggregate_interaction_events import parse_events, summarize, to_markdown


def _line(event: str) -> str:
    return f"2026-10-08 10:00:00,000 INFO [shoppie.events] interaction_event {event}"


LOG_LINES = [
    "2026-10-08 10:00:00,000 INFO [shoppie.api] HTTP POST /request-assistance status=200",
    # 会話 a: 1往復目は押さずに次の発話、2往復目で2件押した
    _line('{"ts":"2026-10-08T01:00:00Z","type":"turn_completed","context_id":"a","turn_id":"t1","config_version":"v1","product_count":5}'),
    _line('{"ts":"2026-10-08T01:01:00Z","type":"turn_completed","context_id":"a","turn_id":"t2","config_version":"v1","product_count":5}'),
    _line('{"ts":"2026-10-08T01:01:10Z","type":"product_click","context_id":"a","turn_id":"t2","rank":1}'),
    _line('{"ts":"2026-10-08T01:01:20Z","type":"product_click","context_id":"a","turn_id":"t2","rank":3}'),
    # 会話 b: 押さずに終わった
    _line('{"ts":"2026-10-08T02:00:00Z","type":"turn_completed","context_id":"b","turn_id":"t3","config_version":"v1","product_count":4}'),
    # 会話 c: 0件のあとリセット
    _line('{"ts":"2026-10-08T03:00:00Z","type":"turn_completed","context_id":"c","turn_id":"t4","config_version":"v1","product_count":0}'),
    _line('{"ts":"2026-10-08T03:00:30Z","type":"conversation_reset","context_id":"c","turn_id":"t4"}'),
    # 別の構成の失敗
    _line('{"ts":"2026-10-08T04:00:00Z","type":"turn_failed","context_id":"d","turn_id":"t5","config_version":"v2"}'),
    _line("interaction_event {broken json"),
]


def test_parse_events_skips_other_lines_and_broken_json():
    assert len(parse_events(LOG_LINES)) == 8


def test_summarize_by_config_version():
    results = {item.config_version: item for item in summarize(parse_events(LOG_LINES))}

    v1 = results["v1"]
    assert (v1.turns, v1.with_products, v1.zero_results) == (4, 3, 1)
    assert (v1.clicked, v1.followup_without_click, v1.ended_without_click) == (1, 1, 1)
    assert (v1.reset_after, v1.clicks) == (1, 2)
    rates = v1.rates()
    assert rates["click_through_rate"] == round(1 / 3, 4)
    assert rates["mean_click_rank"] == 2.0

    v2 = results["v2"]
    assert (v2.turns, v2.failed, v2.with_products) == (1, 1, 0)
    assert v2.rates()["click_through_rate"] is None


def test_to_markdown_shows_dash_for_missing_rates():
    table = to_markdown(summarize(parse_events(LOG_LINES)))
    assert "| `v2` | 1 | 0 | — |" in table
