"""同時に N 人が 1 回ずつ話しかけたときの、1 人ごとの応答時間を測る。

実行: python scripts/load_test_client.py --url http://127.0.0.1:8765 \
        --concurrency 1 3 10 30 --rounds 3 --label before --out result.json
"""

import argparse
import json
import statistics
import threading
import time
import urllib.request
import uuid


def request_once(url: str) -> dict:
    body = json.dumps({"text": "1万円以内のイヤホン", "context_id": str(uuid.uuid4())}).encode()
    req = urllib.request.Request(
        f"{url}/request-assistance",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=300) as res:
            payload = json.loads(res.read())
            ok = res.status == 200 and "error" not in payload
    except Exception:
        ok = False
    return {"latency_s": time.perf_counter() - start, "ok": ok}


def run_level(url: str, concurrency: int) -> list[dict]:
    results: list[dict] = [{}] * concurrency
    barrier = threading.Barrier(concurrency)

    def worker(i: int) -> None:
        # 全員がそろってから一斉に送り、同時に来た状況を作る。
        barrier.wait()
        results[i] = request_once(url)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(concurrency)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8765")
    parser.add_argument("--concurrency", type=int, nargs="+", default=[1, 3, 10, 30])
    parser.add_argument("--rounds", type=int, default=3)
    parser.add_argument("--label", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    # 初回の import や接続確立の分を計測から外す。
    request_once(args.url)

    rows = []
    for concurrency in args.concurrency:
        for round_index in range(1, args.rounds + 1):
            results = run_level(args.url, concurrency)
            latencies = sorted(r["latency_s"] for r in results)
            row = {
                "label": args.label,
                "concurrency": concurrency,
                "round": round_index,
                "ok": sum(r["ok"] for r in results),
                "median_s": round(statistics.median(latencies), 2),
                "max_s": round(latencies[-1], 2),
                "latencies_s": [round(x, 3) for x in latencies],
            }
            rows.append(row)
            print(
                f"{args.label} N={concurrency} round={round_index} ok={row['ok']}/{concurrency} "
                f"median={row['median_s']}s max={row['max_s']}s"
            )

    with open(args.out, "w") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
