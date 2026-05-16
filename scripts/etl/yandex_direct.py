#!/usr/bin/env python3
"""
ETL: Yandex Direct → marketing_metrics

ТЗ #050 F3.2. Pulls campaigns + daily spend + clicks/impressions/conversions.

BLOCKED (2026-05-16): Yandex Direct API возвращает error_code=58 «Незавершённая
регистрация — необходимо заполнить для приложения заявку на доступ в интерфейсе
Директа и дождаться её подтверждения».

Resolution: Sergey должен через Direct UI (https://direct.yandex.ru) подать
заявку «Доступ к API» для OAuth app `2e11e8209ebe4311a653d061d9dcbc5d`. После
approve (~ 1 рабочий день) этот script begin работать.

Скрипт идempotent — re-run после approve без code changes.

API: https://api.direct.yandex.com/json/v5/
Docs: https://yandex.ru/dev/direct/doc/start/intro.html
"""
import os
import sys
import requests
from typing import Dict, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import upsert_metrics, date_range, log

API_BASE = "https://api.direct.yandex.com/json/v5"
TOKEN = os.environ.get("YANDEX_OAUTH_TOKEN", "")


def direct_post(endpoint: str, body: Dict) -> Dict:
    url = f"{API_BASE}/{endpoint}"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept-Language": "ru",
        "Content-Type": "application/json; charset=utf-8",
    }
    r = requests.post(url, headers=headers, json=body, timeout=60)
    r.raise_for_status()
    return r.json()


def check_access() -> bool:
    """Quick access check — returns False если регистрация не одобрена."""
    try:
        data = direct_post("campaigns", {
            "method": "get",
            "params": {"SelectionCriteria": {}, "FieldNames": ["Id"]}
        })
        if "error" in data:
            err = data["error"]
            log(f"  Direct API error_code={err.get('error_code')} {err.get('error_string')}")
            return False
        return True
    except Exception as e:
        log(f"  Direct API check failed: {e}")
        return False


def fetch_campaigns() -> List[Dict]:
    log("  fetching campaigns list")
    data = direct_post("campaigns", {
        "method": "get",
        "params": {
            "SelectionCriteria": {},
            "FieldNames": ["Id", "Name", "State", "Status", "Type", "StartDate", "DailyBudget"]
        }
    })
    return data.get("result", {}).get("Campaigns", [])


def fetch_report(date_from: str, date_to: str) -> List[Dict]:
    """
    Reports API — daily campaign stats.
    Returns CSV string, parse into rows.
    """
    log(f"  fetching report {date_from}..{date_to}")
    body = {
        "params": {
            "SelectionCriteria": {"DateFrom": date_from, "DateTo": date_to},
            "FieldNames": ["Date", "CampaignId", "CampaignName", "Impressions", "Clicks", "Cost", "Conversions"],
            "ReportName": f"ETL_daily_{date_from}_{date_to}",
            "ReportType": "CAMPAIGN_PERFORMANCE_REPORT",
            "DateRangeType": "CUSTOM_DATE",
            "Format": "TSV",
            "IncludeVAT": "YES",
        }
    }
    url = f"{API_BASE}/reports"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept-Language": "ru",
        "Content-Type": "application/json; charset=utf-8",
        "processingMode": "auto",
        "returnMoneyInMicros": "false",
    }
    r = requests.post(url, headers=headers, json=body, timeout=120)
    if r.status_code != 200:
        log(f"  reports API {r.status_code}: {r.text[:200]}")
        return []

    rows: List[Dict] = []
    lines = r.text.strip().split("\n")
    if len(lines) < 3:
        return []
    headers_csv = lines[1].split("\t")
    for line in lines[2:]:
        cols = line.split("\t")
        if len(cols) != len(headers_csv):
            continue
        row = dict(zip(headers_csv, cols))
        date_str = row.get("Date", "")
        campaign_id = row.get("CampaignId", "")
        campaign_name = row.get("CampaignName", "")[:100]
        impressions = int(row.get("Impressions", 0) or 0)
        clicks = int(row.get("Clicks", 0) or 0)
        cost = float(row.get("Cost", 0) or 0)
        conversions = int(row.get("Conversions", 0) or 0)
        meta = {"campaign_id": campaign_id, "campaign_name": campaign_name}
        if impressions:
            rows.append({"date": date_str, "source": "yandex_direct", "channel": "paid",
                         "metric_name": "impressions", "metric_value": impressions, "metric_meta": meta})
        if clicks:
            rows.append({"date": date_str, "source": "yandex_direct", "channel": "paid",
                         "metric_name": "clicks", "metric_value": clicks, "metric_meta": meta})
        if cost:
            rows.append({"date": date_str, "source": "yandex_direct", "channel": "paid",
                         "metric_name": "spend", "metric_value": cost, "metric_meta": meta})
        if conversions:
            rows.append({"date": date_str, "source": "yandex_direct", "channel": "paid",
                         "metric_name": "leads", "metric_value": conversions, "metric_meta": meta})
    return rows


def main():
    log("ETL Yandex Direct")
    if not check_access():
        log("  Direct API access not granted — skip ETL (BLOCKED until Sergey submits app to Direct UI)")
        return

    date_from, date_to = date_range(days_back=7)
    campaigns = fetch_campaigns()
    log(f"  found {len(campaigns)} campaigns")

    all_rows = fetch_report(date_from, date_to)
    log(f"upserting {len(all_rows)} rows...")
    cnt = upsert_metrics(all_rows)
    log(f"done — {cnt} rows upserted")


if __name__ == "__main__":
    main()
