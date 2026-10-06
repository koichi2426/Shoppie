"""保存した実験入力と、採用した商品フィールド構成を通信なしで照合する。"""

import argparse
import ast
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
BASELINE_COMMIT = "629c2cc2dc1ad4fba5aa88ed63c84a6bec9656be"
SUMMARY_PATH = "fastapi/backend/infrastructure/gateways/langgraph/tool_result_summary.py"
EXPERIMENT_PATH = "fastapi/backend/scripts/experiment_tool_payload.py"
DATA_DIR = ROOT / "docs/reports/data/20261006_tool-payload"
VARIANTS = ("full", "current", "enriched", "title_only")

sys.path.insert(0, str(ROOT / "fastapi/backend"))
from infrastructure.gateways.langgraph.tool_result_summary import summarize_tool_payload


def digest(value):
    return hashlib.sha256(value).hexdigest()


def read_json(path):
    return json.loads(path.read_text())


def frozen_source(path, expected_hash):
    source = subprocess.check_output(["git", "show", f"{BASELINE_COMMIT}:{path}"], cwd=ROOT)
    if digest(source) != expected_hash:
        raise ValueError(f"実験当時のコードのSHA-256が一致しない: {path}")
    return source


def verify(data_dir):
    protocol = read_json(data_dir / "protocol.json")
    for filename, expected_hash in protocol["sha256"].items():
        if digest((data_dir / filename).read_bytes()) != expected_hash:
            raise ValueError(f"凍結した入力が変わった: {filename}")
    summary_source = frozen_source(SUMMARY_PATH, protocol["product_summary_sha256"])
    experiment_source = frozen_source(EXPERIMENT_PATH, protocol["script_sha256"])
    baseline = {"__name__": "_frozen_summary"}
    exec(compile(summary_source, SUMMARY_PATH, "exec"), baseline)
    # 当時の変換関数だけを使い、検索やモデル呼び出しを起動しない。
    payload_function = next(node for node in ast.parse(experiment_source).body
                            if isinstance(node, ast.FunctionDef) and node.name == "payload_for")
    baseline["TOOL"] = protocol["tool_config"]
    exec(compile(ast.Module(body=[payload_function], type_ignores=[]), EXPERIMENT_PATH, "exec"), baseline)
    payload_for = baseline["payload_for"]

    snapshots = read_json(data_dir / "snapshots.json")
    plan = read_json(data_dir / "plan.json")
    tasks = {task["id"]: task for task in plan["tasks"]}
    historical_sizes = {}
    product_count = 0
    for snapshot in snapshots:
        products = snapshot["products"]
        original = deepcopy(products)
        for variant in VARIANTS:
            content = json.dumps(payload_for(products, variant), ensure_ascii=False, separators=(",", ":"))
            historical_sizes[(snapshot["query_id"], variant)] = (len(content), len(content.encode()))
        expected = payload_for(products, "enriched")
        for product in expected["products"]:
            del product["product_id"]
        actual = summarize_tool_payload(products, protocol["tool_config"]["toolSpec"]["name"])
        if actual != expected or products != original:
            raise ValueError(f"採用構成または入力の保持が一致しない: {snapshot['query_id']}")
        product_count += len(products)

    responses = [json.loads(line) for line in (data_dir / "responses.jsonl").read_text().splitlines()]
    expected_ids = {f"{task['id']}:{variant}:{repeat}" for task in plan["tasks"]
                    for variant in VARIANTS for repeat in range(1, plan["repeats"] + 1)}
    if len(responses) != len(expected_ids) or {row["run_id"] for row in responses} != expected_ids:
        raise ValueError("保存した応答の件数・IDが実験計画と一致しない")
    for row in responses:
        key = (tasks[row["task_id"]]["query_id"], row["variant"])
        if row.get("error") or historical_sizes[key] != (row["payload_chars"], row["payload_bytes"]):
            raise ValueError(f"実験当時の入力サイズが一致しない: {row['run_id']}")
    return {
        "baseline_commit": BASELINE_COMMIT,
        "adopted_variant": "enriched",
        "queries_verified": len(snapshots),
        "products_verified": product_count,
        "historical_variants_verified": len(historical_sizes),
        "historical_response_payload_sizes_verified": len(responses),
        "production_matches_measured_enriched_without_scoring_ids": True,
        "source_products_unchanged": True,
        "historical_code_hashes_match_protocol": True,
        "frozen_input_hashes_match_protocol": True,
        "production_summary_sha256": digest((ROOT / SUMMARY_PATH).read_bytes()),
        "sha256": {name: digest((data_dir / name).read_bytes())
                   for name in ("protocol.json", "snapshots.json", "responses.jsonl")},
        "note": "変換処理と保存入力の照合。モデル呼び出し・本番の推薦品質やトークン数の再計測は行っていない。",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = json.dumps(verify(args.data_dir), ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(result)
    print(result, end="")
