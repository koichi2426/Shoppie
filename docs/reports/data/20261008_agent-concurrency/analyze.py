"""変更前後の負荷試験の結果を集計し、表の数字と比較図を作る。

実行: python3 docs/reports/data/20261008_agent-concurrency/analyze.py
"""

import json
import statistics
from pathlib import Path

HERE = Path(__file__).parent
LABELS = ("before", "after")


def load(label):
    return json.loads((HERE / f"{label}.json").read_text(encoding="utf-8"))


def summarize(rows):
    """同時接続数ごとに、全ラウンドの応答時間をまとめて中央値・最大を出す。"""
    by_level = {}
    for row in rows:
        level = by_level.setdefault(row["concurrency"], {"latencies": [], "ok": 0, "total": 0})
        level["latencies"].extend(row["latencies_s"])
        level["ok"] += row["ok"]
        level["total"] += row["concurrency"]
    summary = []
    for concurrency, level in sorted(by_level.items()):
        latencies = sorted(level["latencies"])
        summary.append(
            {
                "concurrency": concurrency,
                "requests": level["total"],
                "ok": level["ok"],
                "median_s": round(statistics.median(latencies), 2),
                "max_s": round(latencies[-1], 2),
            }
        )
    return summary


def draw(summaries, path):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    figure, axes = plt.subplots(1, 2, figsize=(10.8, 4.5), layout="constrained")
    colors = {"before": "#c2410c", "after": "#1d4ed8"}
    names = {"before": "before (sync on event loop)", "after": "after (asyncio.to_thread)"}
    for ax, key, title in (
        (axes[0], "median_s", "Median latency per request"),
        (axes[1], "max_s", "Slowest request (last in line)"),
    ):
        for label in LABELS:
            xs = [s["concurrency"] for s in summaries[label]]
            ys = [s[key] for s in summaries[label]]
            ax.plot(xs, ys, marker="o", color=colors[label], label=names[label])
            for x, y in zip(xs, ys):
                ax.annotate(f"{y:.1f}s", (x, y), textcoords="offset points", xytext=(0, 6),
                            ha="center", fontsize=8, color=colors[label])
        ax.set_xscale("log")
        ax.set_xticks([1, 3, 10, 30], labels=["1", "3", "10", "30"])
        ax.set_xlabel("Concurrent users")
        ax.set_ylabel("Seconds")
        ax.set_title(title)
        ax.grid(alpha=0.3)
        ax.legend(fontsize=8)
    figure.suptitle("API latency under concurrent requests (fake Bedrock 1.0s x2, fake malls 1.5s)", fontsize=12)
    figure.savefig(path, dpi=180, facecolor="white")
    plt.close(figure)


def main():
    summaries = {label: summarize(load(label)) for label in LABELS}
    (HERE / "summary.json").write_text(
        json.dumps(summaries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    for label in LABELS:
        for s in summaries[label]:
            print(label, s)
    draw(summaries, HERE / "figure.png")


if __name__ == "__main__":
    main()
