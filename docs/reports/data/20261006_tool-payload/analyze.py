"""凍結した主結果の集計、属性注釈の感度分析、比較図をオフラインで作る。"""

import argparse
from collections import Counter
import csv
from datetime import datetime
import hashlib
import json
from pathlib import Path


VARIANTS = ("full", "current", "enriched", "title_only")
RECLASSIFIED_IDS = ("q1-14", "q3-04", "q4-11", "q4-16")
INPUT_USD_PER_MILLION = 1.1
OUTPUT_USD_PER_MILLION = 5.5
# 主実験とは別に行われた接続確認の使用量を、別項目として集計する。
CONNECTION_USAGE = {"inputTokens": 26, "outputTokens": 4}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def csv_bool(value):
    if value not in ("True", "False"):
        raise ValueError(f"CSV の真偽値を解釈できない: {value!r}")
    return value == "True"


def price(product):
    value = product.get("price_yen", product.get("price"))
    return int(value) if value is not None and str(value).isdigit() and int(value) > 0 else None


def eligible(product, task, attributes):
    value = price(product)
    if value is None or value > task["budget_yen"]:
        return False
    kind = task["kind"]
    if kind == "review":
        return float(product.get("review_rate") or 0) >= 4 and int(product.get("review_count") or 0) >= 10
    if kind == "shipping":
        return product.get("shipping") == "送料無料"
    if kind == "attribute":
        return attributes[product["product_id"]]["supported"]
    if kind == "price":
        return True
    raise ValueError(f"未知のタスク種別: {kind}")


def oracle(products, task, attributes):
    candidates = [product for product in products if eligible(product, task, attributes)]
    minimum = min((price(product) for product in candidates), default=None)
    return [product["product_id"] for product in candidates if price(product) == minimum]


def usage_totals(rows):
    billable = [row for row in rows if isinstance(row.get("usage"), dict)]
    input_tokens = sum(row["usage"]["inputTokens"] for row in billable)
    output_tokens = sum(row["usage"]["outputTokens"] for row in billable)
    if any(row["usage"].get("cacheReadInputTokens", 0) or row["usage"].get("cacheWriteInputTokens", 0) for row in billable):
        raise ValueError("キャッシュ使用量には別の単価が必要")
    return {
        "logged_calls": len(rows), "calls_with_usage": len(billable),
        "usage_unavailable_calls": len(rows) - len(billable),
        "input_tokens": input_tokens, "output_tokens": output_tokens,
        "cost_usd_estimate": (input_tokens * INPUT_USD_PER_MILLION + output_tokens * OUTPUT_USD_PER_MILLION) / 1_000_000,
    }


def make_figure(path, main_groups):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import PercentFormatter

    labels = ["Full", "Current", "Enriched", "Title only"]
    colors = ["#e8a838", "#2a9d8f", "#457b9d", "#87919a"]
    inputs = [main_groups[variant]["mean_input_tokens"] for variant in VARIANTS]
    successes = [main_groups[variant]["correct_selection"] for variant in VARIANTS]
    denominators = [main_groups[variant]["answerable_from_full"] for variant in VARIANTS]
    rates = [success / denominator if denominator else 0 for success, denominator in zip(successes, denominators)]
    figure, axes = plt.subplots(1, 2, figsize=(10.8, 4.5), layout="constrained")
    for axis in axes:
        axis.spines[["top", "right"]].set_visible(False)
        axis.set_axisbelow(True)
        axis.grid(axis="y", alpha=0.18)
    bars = axes[0].bar(labels, inputs, color=colors, width=0.65)
    axes[0].bar_label(bars, labels=[f"{value:,.1f}" for value in inputs], padding=4)
    axes[0].set_title("Mean input tokens per call")
    axes[0].set_ylabel("Tokens")
    axes[0].set_ylim(0, max(inputs) * 1.17)
    bars = axes[1].bar(labels, rates, color=colors, width=0.65)
    axes[1].bar_label(bars, labels=[f"{success}/{denominator}" for success, denominator in zip(successes, denominators)], padding=4)
    axes[1].set_title("Selection success on matched tasks")
    axes[1].set_ylabel("Correct selections / answerable calls")
    axes[1].yaxis.set_major_formatter(PercentFormatter(1))
    axes[1].set_ylim(0, 1.15)
    figure.suptitle("Tool-result field reduction: frozen main experiment", fontsize=13)
    figure.supxlabel("Frozen attribute labels; 20 tasks × 2 repeats per variant. One unmatched task is excluded from selection rates.", fontsize=9)
    figure.savefig(path, dpi=180, facecolor="white")
    plt.close(figure)


def analyze(data_dir):
    plan = read_json(data_dir / "plan.json")
    protocol = read_json(data_dir / "protocol.json")
    snapshots = read_json(data_dir / "snapshots.json")
    attributes = read_json(data_dir / "attributes.json")
    expected_rows = read_json(data_dir / "expected.json")
    summary = read_json(data_dir / "summary.json")
    with (data_dir / "scores.csv").open(encoding="utf-8", newline="") as source:
        scores = list(csv.DictReader(source))
    responses = read_jsonl(data_dir / "responses.jsonl")
    pilot = read_jsonl(data_dir / "pilot_responses.jsonl")
    successful = {row["run_id"]: row for row in responses if not row.get("error")}
    score_by_id = {row["run_id"]: row for row in scores}
    tasks = {task["id"]: task for task in plan["tasks"]}
    products = {snapshot["query_id"]: snapshot["products"] for snapshot in snapshots}
    expected = {row["task_id"]: row["expected_product_ids"] for row in expected_rows}
    expected_ids = {f"{task_id}:{variant}:{repeat}" for task_id in tasks for variant in VARIANTS
                    for repeat in range(1, plan["repeats"] + 1)}
    # 計測途中のログや古い集計を、完成した主結果として扱わない。
    if len(scores) != len(score_by_id) or set(successful) != expected_ids or set(score_by_id) != expected_ids:
        raise ValueError("主実験または scores.csv が完成していない")
    if summary["unique_successes"] != len(expected_ids) or summary["expected_calls"] != len(expected_ids):
        raise ValueError("summary.json の件数が主実験と一致しない")
    if protocol["pricing"]["input_usd_per_million"] != INPUT_USD_PER_MILLION or protocol["pricing"]["output_usd_per_million"] != OUTPUT_USD_PER_MILLION:
        raise ValueError("凍結した単価が分析の単価と一致しない")
    for filename, frozen_hash in protocol["sha256"].items():
        if digest(data_dir / filename) != frozen_hash:
            raise ValueError(f"凍結した入力が変わった: {filename}")

    recalculated = {task_id: oracle(products[task["query_id"]], task, attributes) for task_id, task in tasks.items()}
    if recalculated != expected:
        raise ValueError("独立再計算した主実験の正解候補が一致しない")
    main_groups = {group["variant"]: group for group in summary["groups"] if group["kind"] == "all"}
    condition_satisfying = {}
    for variant in VARIANTS:
        subset = [score for score in scores if score["variant"] == variant]
        for name in ("answerable_from_full", "correct_selection", "valid_answer", "unsupported_selection", "deferral"):
            if sum(csv_bool(score[name]) for score in subset) != main_groups[variant][name]:
                raise ValueError(f"scores.csv と summary.json が一致しない: {variant}/{name}")
        satisfying = 0
        for score in subset:
            row = successful[score["run_id"]]
            answer = row.get("answer") if isinstance(row.get("answer"), dict) else {}
            correct = csv_bool(score["valid_answer"]) and answer.get("status") == "selected" and answer.get("product_id") in expected[score["task_id"]]
            if bool(correct) != csv_bool(score["correct_selection"]):
                raise ValueError(f"主結果の選択採点が一致しない: {score['run_id']}")
            task = tasks[score["task_id"]]
            chosen = next((product for product in products[task["query_id"]]
                           if product["product_id"] == answer.get("product_id")), None)
            satisfying += bool(csv_bool(score["valid_answer"]) and answer.get("status") == "selected"
                               and chosen and eligible(chosen, task, attributes))
        condition_satisfying[variant] = satisfying

    # 主結果の注釈は変更せず、関連語のみの支持を除く別の正解候補を作る。
    alternative_attributes = {product_id: dict(label) for product_id, label in attributes.items()}
    for product_id in RECLASSIFIED_IDS:
        if product_id not in alternative_attributes or not alternative_attributes[product_id]["supported"]:
            raise ValueError(f"感度分析の対象注釈がない: {product_id}")
        alternative_attributes[product_id]["supported"] = False
    alternative_expected = {task_id: oracle(products[task["query_id"]], task, alternative_attributes)
                            for task_id, task in tasks.items()}
    sensitivity_groups = []
    for variant in VARIANTS:
        subset = [score for score in scores if score["variant"] == variant]
        correct = 0
        reclassified_selections = 0
        for score in subset:
            answer = successful[score["run_id"]].get("answer")
            answer = answer if isinstance(answer, dict) else {}
            selected = answer.get("status") == "selected"
            correct += bool(csv_bool(score["valid_answer"]) and selected and answer.get("product_id") in alternative_expected[score["task_id"]])
            reclassified_selections += bool(selected and answer.get("product_id") in RECLASSIFIED_IDS)
        denominator = sum(bool(alternative_expected[score["task_id"]]) for score in subset)
        sensitivity_groups.append({
            "variant": variant, "calls": len(subset), "answerable_calls": denominator,
            "correct_selection": correct,
            "selection_success_rate": correct / denominator if denominator else None,
            "selections_of_reclassified_products": reclassified_selections,
        })
    changed_tasks = [{"task_id": task_id, "frozen_expected_product_ids": expected[task_id],
                      "alternative_expected_product_ids": alternative_expected[task_id]}
                     for task_id in tasks if expected[task_id] != alternative_expected[task_id]]
    sensitivity = {
        "analysis_type": "post_hoc_attribute_label_sensitivity",
        "policy": "関連キーワードだけの4商品を属性の支持なしとした。主実験の注釈・正解・回答は変更していない。",
        "reclassified_product_ids": list(RECLASSIFIED_IDS),
        "changed_tasks": changed_tasks, "changed_task_count": len(changed_tasks),
        "groups": sensitivity_groups,
    }

    main_usage = usage_totals(responses)
    pilot_usage = usage_totals(pilot)
    connection_usage = usage_totals([{"usage": CONNECTION_USAGE}])
    connection_usage["source"] = "主実験前に別途実施した接続確認の記録: inputTokens=26, outputTokens=4"
    reasons = {variant: [row["answer"]["reason"] for row in successful.values()
                         if row["variant"] == variant and isinstance(row.get("answer"), dict)
                         and isinstance(row["answer"].get("reason"), str)]
               for variant in VARIANTS}
    reason_lengths = {variant: {"answers_with_reason": len(texts), "over_60_chars": sum(len(text) > 60 for text in texts),
                               "maximum_chars": max(map(len, texts), default=0)}
                      for variant, texts in reasons.items()}
    main_script = data_dir.parents[3] / "fastapi/backend/scripts/experiment_tool_payload.py"
    product_summary = data_dir.parents[3] / "fastapi/backend/infrastructure/gateways/langgraph/tool_result_summary.py"
    input_time = datetime.fromisoformat(protocol["prepared_at_utc"])
    source_names = ("plan.json", "snapshots.json", "attributes.json", "expected.json", "protocol.json",
                    "responses.jsonl", "scores.csv", "summary.json", "pilot_protocol.json", "pilot_responses.jsonl", "analyze.py")
    analysis = {
        "main": {
            "expected_calls": len(expected_ids), "unique_successes": len(successful), "logged_rows": len(responses),
            "api_error_rows": sum(bool(row.get("error")) for row in responses),
            "unique_tasks": len(tasks), "queries": len(snapshots),
            "answerable_tasks": sum(bool(ids) for ids in expected.values()),
            "selection_denominator_per_variant": sum(bool(ids) for ids in expected.values()) * plan["repeats"],
            "unmatched_tasks": [task_id for task_id, ids in expected.items() if not ids],
            "stop_reasons": dict(sorted(Counter(row.get("stop_reason", "unknown") for row in successful.values()).items())),
            "retry_count": sum(row.get("retry_count", 0) for row in responses),
            "calls_with_retry": sum(row.get("retry_count", 0) > 0 for row in responses),
            "reason_lengths": reason_lengths,
            "reason_over_60_chars_total": sum(row["over_60_chars"] for row in reason_lengths.values()),
            "selection_structure_note": "valid_answer は理由の文字列型を確認するが、60字制限への準拠は含まない。",
            "condition_satisfying_selection_note": "凍結したフルデータの価格上限・レビュー・送料・属性条件を満たす選択。最安条件と、モデルへ実際に渡された根拠の有無は判定しない。",
            "groups": [dict(main_groups[variant],
                            selection_success_rate=main_groups[variant]["correct_selection"] / main_groups[variant]["answerable_from_full"]
                            if main_groups[variant]["answerable_from_full"] else None,
                            condition_satisfying_selection_from_full=condition_satisfying[variant],
                            condition_satisfying_selection_rate=condition_satisfying[variant] / main_groups[variant]["answerable_from_full"]
                            if main_groups[variant]["answerable_from_full"] else None) for variant in VARIANTS],
        },
        "pilot": {
            "calls": len(pilot), "answers_as_json_object": sum(isinstance(row.get("answer"), dict) for row in pilot),
            "stop_reasons": dict(sorted(Counter(row.get("stop_reason", "unknown") for row in pilot).items())),
            "api_errors": sum(bool(row.get("error")) for row in pilot),
            "retry_count": sum(row.get("retry_count", 0) for row in pilot),
        },
        "cost": {
            "input_usd_per_million": INPUT_USD_PER_MILLION, "output_usd_per_million": OUTPUT_USD_PER_MILLION,
            "source": protocol["pricing"]["source"], "main": main_usage, "pilot": pilot_usage,
            "connection_check": connection_usage,
            "total_input_tokens": main_usage["input_tokens"] + pilot_usage["input_tokens"] + connection_usage["input_tokens"],
            "total_output_tokens": main_usage["output_tokens"] + pilot_usage["output_tokens"] + connection_usage["output_tokens"],
            "total_cost_usd_estimate": main_usage["cost_usd_estimate"] + pilot_usage["cost_usd_estimate"] + connection_usage["cost_usd_estimate"],
            "note": "公開単価と応答の使用量から算出した推定。請求額は取得していない。使用量がないエラー応答は金額に加えていない。",
        },
        "freeze_audit": {
            "dataset_hashes_match": True, "independent_frozen_oracles_match": True,
            "main_script_matches_protocol": digest(main_script) == protocol["script_sha256"],
            "product_summary_matches_protocol": digest(product_summary) == protocol["product_summary_sha256"],
            "all_captures_before_prepare": all(datetime.fromisoformat(row["captured_at_utc"]) < input_time for row in snapshots),
            "all_main_calls_after_prepare": all(datetime.fromisoformat(row["started_at_utc"]) > input_time for row in responses),
        },
        "sha256": {name: digest(data_dir / name) for name in source_names},
        "figure": {"file": "figure.png", "labels": "frozen_main_annotations", "excludes": "pilot_and_sensitivity"},
    }
    make_figure(data_dir / "figure.png", main_groups)
    write_json(data_dir / "sensitivity.json", sensitivity)
    write_json(data_dir / "analysis.json", analysis)
    print(json.dumps({"main_calls": len(successful), "changed_tasks": len(changed_tasks),
                      "total_cost_usd_estimate": analysis["cost"]["total_cost_usd_estimate"]}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parent)
    analyze(parser.parse_args().data_dir.resolve())
