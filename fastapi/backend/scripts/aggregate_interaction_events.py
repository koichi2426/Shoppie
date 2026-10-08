"""ログに出したユーザーの反応を、エージェント構成ごとの指標に集計する。

使い方:
    PYTHONPATH=. python scripts/aggregate_interaction_events.py render-logs.txt [...]
    PYTHONPATH=. python scripts/aggregate_interaction_events.py --json < render-logs.txt

指標(分母は「商品を出した往復」。ただし失敗・0件・リセットは全往復が分母):
    クリック率          商品を 1 件以上押された往復の割合
    押さずに次の発話    商品を押さずに同じ会話で次の発話が来た割合(言い直し・絞り込みの候補)
    押さずに終了        商品を押さず、その後の発話もリセットもない割合(離脱の候補)
    0件率 / 失敗率      商品が 0 件だった / エラーになった往復の割合
    リセット率          その往復のあとに会話をリセットされた割合

発話の本文はイベントに含めていないため、言い直しか正当な絞り込みかはここでは区別できない。
"""

import argparse
import json
import sys
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable

EVENT_LOG_PREFIX = "interaction_event "
TURN_TYPES = ("turn_completed", "turn_failed")


def parse_events(lines: Iterable[str]) -> list[dict]:
    events = []
    for line in lines:
        index = line.find(EVENT_LOG_PREFIX)
        if index < 0:
            continue
        try:
            event = json.loads(line[index + len(EVENT_LOG_PREFIX):].strip())
        except json.JSONDecodeError:
            continue
        if isinstance(event, dict) and "type" in event and "ts" in event:
            events.append(event)
    return events


@dataclass
class ConfigMetrics:
    config_version: str
    turns: int = 0
    failed: int = 0
    zero_results: int = 0
    with_products: int = 0
    clicked: int = 0
    followup_without_click: int = 0
    ended_without_click: int = 0
    reset_after: int = 0
    clicks: int = 0
    click_ranks: list[int] = field(default_factory=list)

    def rates(self) -> dict:
        def ratio(numerator: int, denominator: int) -> float | None:
            return round(numerator / denominator, 4) if denominator else None

        return {
            "click_through_rate": ratio(self.clicked, self.with_products),
            "followup_without_click_rate": ratio(self.followup_without_click, self.with_products),
            "ended_without_click_rate": ratio(self.ended_without_click, self.with_products),
            "zero_result_rate": ratio(self.zero_results, self.turns),
            "failure_rate": ratio(self.failed, self.turns),
            "reset_rate": ratio(self.reset_after, self.turns),
            "mean_click_rank": (
                round(sum(self.click_ranks) / len(self.click_ranks), 2) if self.click_ranks else None
            ),
        }


def summarize(events: list[dict]) -> list[ConfigMetrics]:
    turns = [event for event in events if event["type"] in TURN_TYPES and event.get("turn_id")]
    clicks_by_turn: dict[str, list[dict]] = defaultdict(list)
    reset_turn_ids: set[str] = set()
    for event in events:
        if event["type"] == "product_click" and event.get("turn_id"):
            clicks_by_turn[event["turn_id"]].append(event)
        elif event["type"] == "conversation_reset" and event.get("turn_id"):
            reset_turn_ids.add(event["turn_id"])

    turns_by_context: dict[str, list[dict]] = defaultdict(list)
    for turn in turns:
        turns_by_context[turn["context_id"]].append(turn)
    has_next_turn: set[str] = set()
    for context_turns in turns_by_context.values():
        context_turns.sort(key=lambda turn: turn["ts"])
        for turn in context_turns[:-1]:
            has_next_turn.add(turn["turn_id"])

    metrics: dict[str, ConfigMetrics] = {}
    for turn in turns:
        version = turn.get("config_version") or "unknown"
        current = metrics.setdefault(version, ConfigMetrics(config_version=version))
        turn_id = turn["turn_id"]
        current.turns += 1
        if turn_id in reset_turn_ids:
            current.reset_after += 1
        if turn["type"] == "turn_failed":
            current.failed += 1
            continue
        if not turn.get("product_count"):
            current.zero_results += 1
            continue

        current.with_products += 1
        turn_clicks = clicks_by_turn.get(turn_id, [])
        current.clicks += len(turn_clicks)
        current.click_ranks.extend(click["rank"] for click in turn_clicks if isinstance(click.get("rank"), int))
        if turn_clicks:
            current.clicked += 1
        elif turn_id in has_next_turn:
            current.followup_without_click += 1
        elif turn_id not in reset_turn_ids:
            current.ended_without_click += 1

    return sorted(metrics.values(), key=lambda item: item.turns, reverse=True)


def _percent(value: float | None) -> str:
    return "—" if value is None else f"{value * 100:.1f}%"


def to_markdown(results: list[ConfigMetrics]) -> str:
    header = (
        "| 構成 | 往復 | 商品あり | クリック率 | 押さずに次の発話 | 押さずに終了 "
        "| 0件率 | 失敗率 | リセット率 | 平均クリック順位 |\n"
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n"
    )
    rows = []
    for item in results:
        rates = item.rates()
        rank = rates["mean_click_rank"]
        rows.append(
            f"| `{item.config_version}` | {item.turns} | {item.with_products} "
            f"| {_percent(rates['click_through_rate'])} "
            f"| {_percent(rates['followup_without_click_rate'])} "
            f"| {_percent(rates['ended_without_click_rate'])} "
            f"| {_percent(rates['zero_result_rate'])} "
            f"| {_percent(rates['failure_rate'])} "
            f"| {_percent(rates['reset_rate'])} "
            f"| {'—' if rank is None else rank} |"
        )
    return header + "\n".join(rows) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("paths", nargs="*", type=Path, help="ログのファイル。省略すると標準入力から読む")
    parser.add_argument("--json", action="store_true", help="JSON で出力する")
    args = parser.parse_args()

    if args.paths:
        lines: list[str] = []
        for path in args.paths:
            lines.extend(path.read_text(encoding="utf-8").splitlines())
    else:
        lines = sys.stdin.read().splitlines()

    results = summarize(parse_events(lines))
    if args.json:
        payload = [{**asdict(item), **item.rates()} for item in results]
        for item in payload:
            item.pop("click_ranks", None)
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(to_markdown(results), end="")


if __name__ == "__main__":
    main()
