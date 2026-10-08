"""Recalculate the monthly estimate from the saved AWS price-list snapshot."""
from decimal import Decimal, ROUND_HALF_UP
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent
snapshot = json.loads((DATA / 'monthly-cost-prices.json').read_text())
rates = {p['attributes']['usagetype']: Decimal(p['prices'][0]['usd'])
         for source in snapshot['sources'] for p in source['products']}
HOURS = Decimal('730')
JPY_PER_USD = Decimal('150')  # Scenario assumption, not a current exchange-rate quote.

def yen(value):
    return str((value * JPY_PER_USD).quantize(Decimal('1'), rounding=ROUND_HALF_UP))

variants = []
for tasks in (1, 2):
    items = {
        'fargate': tasks * HOURS * (Decimal('.5') * rates['APN1-Fargate-vCPU-Hours:perCPU']
                                   + rates['APN1-Fargate-GB-Hours']),
        'alb_base': HOURS * rates['APN1-LoadBalancerUsage'],
        'rds_instance': HOURS * rates['APN1-InstanceUsage:db.t4g.micro'],
        'rds_storage': Decimal('20') * rates['APN1-RDS:GP3-Storage'],
        'public_ipv4': (2 + tasks) * HOURS * rates['APN1-PublicIPv4:InUseAddress'],
        'db_secret': rates['APN1-AWSSecretsManager-Secrets'],
    }
    base = sum(items.values())
    lcu_one = HOURS * rates['APN1-LCUUsage']
    variants.append({'tasks': tasks,
                     'items': {name: {'usd': str(value), 'jpy_rounded': yen(value)} for name, value in items.items()},
                     'base_usd': str(base), 'base_jpy_rounded': yen(base),
                     'average_one_lcu_usd': str(lcu_one), 'average_one_lcu_jpy_rounded': yen(lcu_one),
                     'low_traffic_scenario_jpy': [str(base * JPY_PER_USD + Decimal('100')),
                                                str((base + lcu_one) * JPY_PER_USD + Decimal('500'))]})
additional_task_jpy = yen(Decimal(variants[1]['base_usd']) - Decimal(variants[0]['base_usd']))
result = {'price_snapshot': 'monthly-cost-prices.json', 'hours_per_month': str(HOURS),
          'jpy_per_usd_assumption': str(JPY_PER_USD), 'tax_included': False,
          'discounts_applied': False, 'alb_public_ipv4_assumption': 2,
          'low_traffic_scenario': {'average_lcu_range': [0, 1], 'other_cost_jpy_range': [100, 500],
                                   'other_cost_is_budget_allowance_not_measured_usage': True},
          'variants': variants,
          'additional_task_base_jpy_rounded': additional_task_jpy}
(DATA / 'monthly-cost-estimate.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False, indent=2))
