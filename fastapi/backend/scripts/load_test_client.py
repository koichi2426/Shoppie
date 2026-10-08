"""同時に N 人が 1 回ずつ話しかけたときの、1 人ごとの応答時間を測る。

実行: python scripts/load_test_client.py --url http://127.0.0.1:8765 \
        --concurrency 1 3 10 30 --rounds 3 --label before --out result.json
"""

import argparse
import json
import math
import statistics
import threading
import time
import urllib.request
import urllib.error
import uuid


def request_once(url: str, context_id=None, timeout=180) -> dict:
    body = json.dumps({"text": "1万円以内のイヤホン", "context_id": context_id or str(uuid.uuid4())}).encode()
    req = urllib.request.Request(
        f"{url}/request-assistance",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    start = time.perf_counter()
    status = None
    error = None
    instance = None
    message = None
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            status = res.status
            instance = res.headers.get("X-Shoppie-Instance")
            payload = json.loads(res.read())
            ok = status == 200 and "response" in payload and "error" not in payload
            message = payload.get("response", {}).get("message")
    except urllib.error.HTTPError as exc:
        status = exc.code
        error = exc.read(2048).decode(errors="replace")
        ok = False
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        ok = False
    return {"latency_s": time.perf_counter() - start, "ok": ok,
            "status": status, "error": error, "instance": instance, "message": message}


def run_level(urls: list[str], concurrency: int, timeout=180) -> list[dict]:
    results: list[dict] = [{}] * concurrency
    barrier = threading.Barrier(concurrency)

    def worker(i: int) -> None:
        # 全員がそろってから一斉に送り、同時に来た状況を作る。
        barrier.wait()
        results[i] = request_once(urls[i % len(urls)], timeout=timeout)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(concurrency)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8765")
    parser.add_argument("--urls", nargs="+", help="Explicit replica URLs for local comparison; AWS uses --url ALB_URL")
    parser.add_argument("--timeout", type=float, default=180)
    parser.add_argument("--session-check", action="store_true", help="Check shared history using the fake server's turn counter")
    parser.add_argument("--min-instances", type=int, default=1)
    parser.add_argument("--concurrency", type=int, nargs="+", default=[1, 3, 10, 30])
    parser.add_argument("--rounds", type=int, default=3)
    parser.add_argument("--label", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    urls = args.urls or [args.url]
    if args.session_check:
        context_id = str(uuid.uuid4())
        rows = []
        instances = set()
        try:
            for turn in range(1, 11):
                row = request_once(urls[(turn - 1) % len(urls)], context_id, args.timeout)
                row["turn"] = turn
                rows.append(row)
                if not row["ok"] or f"会話の往復: {turn}" not in (row["message"] or ""):
                    raise RuntimeError(f"Shared history check failed on turn {turn}")
                if row["instance"]:
                    instances.add(row["instance"])
                if turn >= 2 and len(instances) >= args.min_instances:
                    print(f"Shared history OK: {turn} turns, {len(instances)} instances")
                    break
            else:
                raise RuntimeError("Not enough distinct instances received the test conversation")
        finally:
            with open(args.out, "w") as f:
                json.dump(rows, f, ensure_ascii=False, indent=2)
            req = urllib.request.Request(f"{urls[0]}/context/{context_id}", method="DELETE")
            try:
                with urllib.request.urlopen(req, timeout=args.timeout):
                    pass
            except Exception as exc:
                print(f"Test conversation cleanup failed: {type(exc).__name__}")
        return

    # 初回の import や接続確立の分を計測から外す。
    for url in urls:
        warmup = request_once(url, timeout=args.timeout)
        if not warmup["ok"]:
            raise RuntimeError(f"Warmup failed: status={warmup['status']}, error={warmup['error']}")

    rows = []
    for concurrency in args.concurrency:
        for round_index in range(1, args.rounds + 1):
            results = run_level(urls, concurrency, args.timeout)
            latencies = sorted(r["latency_s"] for r in results)
            row = {
                "label": args.label,
                "concurrency": concurrency,
                "round": round_index,
                "ok": sum(r["ok"] for r in results),
                "median_s": round(statistics.median(latencies), 2),
                "max_s": round(latencies[-1], 2),
                "latencies_s": [round(x, 3) for x in latencies],
                "requests": results,
                "error_rate": sum(not r["ok"] for r in results) / concurrency,
                "throughput_rps": round(concurrency / latencies[-1], 3),
                "p95_s": round(latencies[max(0, math.ceil(len(latencies) * .95) - 1)], 3),
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
