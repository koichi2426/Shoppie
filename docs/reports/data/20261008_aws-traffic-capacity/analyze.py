"""Aggregate the saved one/two-task measurements and draw their latency chart."""
import json
import math
import statistics
from collections import Counter
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

DATA = Path(__file__).resolve().parent
summary = []
for variant in ('one-task', 'two-tasks'):
    rows = json.loads((DATA / f'{variant}.json').read_text())
    for concurrency in sorted({r['concurrency'] for r in rows}):
        requests = [request for row in rows if row['concurrency'] == concurrency for request in row['requests']]
        latencies = sorted(r['latency_s'] for r in requests)
        summary.append({'variant': variant, 'concurrency': concurrency, 'requests': len(requests),
                        'successes': sum(r['ok'] for r in requests),
                        'instance_requests': dict(Counter(r['instance'] for r in requests)),
                        'median_s': round(statistics.median(latencies), 3),
                        'p95_s': round(latencies[math.ceil(len(latencies)*.95)-1], 3),
                        'max_s': round(max(latencies), 3)})
(DATA / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
fig, ax = plt.subplots(figsize=(7, 4))
for variant, label, offset, color in [('one-task', '1 Fargate task', -.18, '#607d8b'),
                                       ('two-tasks', '2 Fargate taskes', .18, '#137d75')]:
    rows = [r for r in summary if r['variant'] == variant]
    ax.bar([i + offset for i in range(len(rows))], [r['max_s'] for r in rows], width=.36, label=label, color=color)
ax.set_xticks(range(5), ['1', '3', '10', '30', '60'])
ax.set_xlabel('Concurrent requests')
ax.set_ylabel('Maximum response time (seconds)')
ax.set_ylim(bottom=0)
ax.legend()
ax.grid(axis='y', alpha=.2)
ax.set_axisbelow(True)
fig.tight_layout()
fig.savefig(DATA / 'figure.png', dpi=160)
print(json.dumps(summary, indent=2))
