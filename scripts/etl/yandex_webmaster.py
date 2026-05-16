#!/usr/bin/env python3
"""
ETL: Yandex Webmaster → marketing_metrics

ТЗ #050 (parallel). Pulls top search queries + avg position + indexing stats.

Requires host verification (verify через `/v4/user/{uid}/hosts/{host_id}/verification?verification_type=HTML_FILE`).
Gracefully skips if HOST_NOT_VERIFIED — re-runs daily until verification passes.

API: https://api.webmaster.yandex.net/v4/
Docs: https://yandex.ru/dev/webmaster/doc/dg/concepts/about.html
"""
import os
import sys
from typing import Dict, List
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import yandex_get_json, upsert_metrics, date_range, log

API_BASE = "https://api.webmaster.yandex.net/v4"
HOST_IDS = [
    "https:www.harlansteel.ru:443",
    "http:harlansteel.ru:80",
]


def get_user_id() -> int:
    data = yandex_get_json(f"{API_BASE}/user/")
    return data["user_id"]


def check_verified(user_id: int, host_id: str) -> bool:
    host_enc = quote(host_id, safe="")
    try:
        data = yandex_get_json(f"{API_BASE}/user/{user_id}/hosts/{host_enc}/verification")
        state = data.get("verification_state", "")
        if state != "VERIFIED":
            log(f"  host {host_id} state={state} — skipping ETL")
            return False
        return True
    except Exception as e:
        log(f"  host {host_id} verification check failed: {e}")
        return False


def top_queries(user_id: int, host_id: str, date_from: str, date_to: str) -> List[Dict]:
    """Top queries by total_shows for last 7d."""
    log(f"  fetching top queries for {host_id}")
    host_enc = quote(host_id, safe="")
    url = f"{API_BASE}/user/{user_id}/hosts/{host_enc}/search-queries/popular"
    params = {
        "date_from": date_from,
        "date_to": date_to,
        "order_by": "TOTAL_SHOWS",
        "query_indicator": "TOTAL_SHOWS",
        "limit": 50,
    }
    try:
        data = yandex_get_json(url, params)
    except Exception as e:
        log(f"  top_queries error: {e}")
        return []

    rows: List[Dict] = []
    for q in data.get("queries", [])[:50]:
        query_text = q.get("query_text", "")[:200]
        indicators = q.get("indicators", {})
        shows = indicators.get("TOTAL_SHOWS", 0)
        clicks = indicators.get("TOTAL_CLICKS", 0)
        position = indicators.get("AVG_SHOW_POSITION", 0)
        rows.append({
            "date": date_to,
            "source": "webmaster",
            "channel": "organic",
            "metric_name": "impressions",
            "metric_value": shows,
            "metric_meta": {"query": query_text, "host_id": host_id, "period_days": 7},
        })
        if clicks > 0:
            rows.append({
                "date": date_to,
                "source": "webmaster",
                "channel": "organic",
                "metric_name": "clicks",
                "metric_value": clicks,
                "metric_meta": {"query": query_text, "host_id": host_id, "period_days": 7},
            })
        if position > 0:
            rows.append({
                "date": date_to,
                "source": "webmaster",
                "channel": "organic",
                "metric_name": "avg_position",
                "metric_value": position,
                "metric_meta": {"query": query_text, "host_id": host_id, "period_days": 7},
            })
    return rows


def indexing_stats(user_id: int, host_id: str, date_to: str) -> List[Dict]:
    """Total indexed pages snapshot."""
    log(f"  fetching indexing stats for {host_id}")
    host_enc = quote(host_id, safe="")
    url = f"{API_BASE}/user/{user_id}/hosts/{host_enc}/summary"
    try:
        data = yandex_get_json(url)
    except Exception as e:
        log(f"  indexing_stats error: {e}")
        return []

    rows: List[Dict] = []
    searchable = data.get("searchable_pages", 0)
    if searchable:
        rows.append({
            "date": date_to,
            "source": "webmaster",
            "channel": "organic",
            "metric_name": "indexed_pages",
            "metric_value": searchable,
            "metric_meta": {"host_id": host_id},
        })
    return rows


def main():
    user_id = get_user_id()
    log(f"ETL Webmaster user_id={user_id}")
    date_from, date_to = date_range(days_back=7)

    all_rows: List[Dict] = []
    for host in HOST_IDS:
        if not check_verified(user_id, host):
            continue
        try:
            all_rows.extend(top_queries(user_id, host, date_from, date_to))
            all_rows.extend(indexing_stats(user_id, host, date_to))
        except Exception as e:
            log(f"  host {host} ETL failed: {e}")

    log(f"upserting {len(all_rows)} rows...")
    cnt = upsert_metrics(all_rows)
    log(f"done — {cnt} rows upserted")


if __name__ == "__main__":
    main()
