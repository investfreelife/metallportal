#!/usr/bin/env python3
"""
ETL: Yandex Metrika → marketing_metrics

ТЗ #050 F3.3. Runs каждые 30 мин через GH Actions cron.
Pulls last 7 days backfill (idempotent upsert).

Metrics:
  - visits per day per traffic source (organic/direct/paid/referral/social/email)
  - conversions per goal (5 goals: phone_click / lead_get_price / lead_navesy_order / supplier_register / cart_checkout)
  - top pages by visits

API: https://api-metrika.yandex.net/stat/v1/data
Docs: https://yandex.ru/dev/metrika/doc/api2/api_v1/data.html

Env required:
  YANDEX_OAUTH_TOKEN, YANDEX_METRIKA_COUNTER_ID
  YANDEX_METRIKA_GOAL_PHONE_CLICK / _LEAD_GET_PRICE / _LEAD_NAVESY_ORDER / _SUPPLIER_REGISTER / _CART_CHECKOUT
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
import os
import sys
from typing import Dict, List, Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import yandex_get_json, upsert_metrics, date_range, log

COUNTER = os.environ["YANDEX_METRIKA_COUNTER_ID"]
API = "https://api-metrika.yandex.net/stat/v1/data"

# Map Metrika lastTrafficSource → our channel taxonomy
CHANNEL_MAP = {
    "organic": "organic",
    "direct": "direct",
    "ad": "paid",
    "internal": "direct",
    "referral": "referral",
    "social": "social",
    "email": "email",
    "saved": "direct",
    "messenger": "social",
    "recommend": "referral",
    "qrcode": "direct",
    "undefined": "direct",
}

GOAL_ENVS = {
    "phone_click": "YANDEX_METRIKA_GOAL_PHONE_CLICK",
    "lead_get_price": "YANDEX_METRIKA_GOAL_LEAD_GET_PRICE",
    "lead_navesy_order": "YANDEX_METRIKA_GOAL_LEAD_NAVESY_ORDER",
    "supplier_register": "YANDEX_METRIKA_GOAL_SUPPLIER_REGISTER",
    "cart_checkout": "YANDEX_METRIKA_GOAL_CART_CHECKOUT",
}


def fetch_table(metrics: str, dimensions: str, date1: str, date2: str, filters: str = "") -> Dict:
    params = {
        "ids": COUNTER,
        "metrics": metrics,
        "dimensions": dimensions,
        "date1": date1,
        "date2": date2,
        "accuracy": "full",
        "limit": 1000,
    }
    if filters:
        params["filters"] = filters
    return yandex_get_json(API, params)


def visits_by_source(date1: str, date2: str) -> List[Dict]:
    log(f"  fetching visits by source {date1}..{date2}")
    data = fetch_table("ym:s:visits", "ym:s:date,ym:s:lastTrafficSource", date1, date2)
    rows: List[Dict] = []
    for d in data.get("data", []):
        date_str = d["dimensions"][0]["name"]
        source_raw = d["dimensions"][1]["id"] or "undefined"
        channel = CHANNEL_MAP.get(source_raw, source_raw)
        visits = d["metrics"][0]
        rows.append({
            "date": date_str,
            "source": "metrika",
            "channel": channel,
            "metric_name": "visits",
            "metric_value": visits,
            "metric_meta": {"source_raw": source_raw},
        })
    return rows


def conversions_per_goal(date1: str, date2: str) -> List[Dict]:
    log(f"  fetching conversions per goal {date1}..{date2}")
    rows: List[Dict] = []
    for goal_name, env_var in GOAL_ENVS.items():
        goal_id = os.environ.get(env_var)
        if not goal_id:
            log(f"  skip {goal_name} (env {env_var} not set)")
            continue
        try:
            data = fetch_table(
                f"ym:s:goal{goal_id}reaches",
                "ym:s:date",
                date1, date2,
            )
            for d in data.get("data", []):
                date_str = d["dimensions"][0]["name"]
                count = d["metrics"][0]
                if count > 0:
                    rows.append({
                        "date": date_str,
                        "source": "metrika",
                        "channel": None,
                        "metric_name": "leads",
                        "metric_value": count,
                        "metric_meta": {"goal_name": goal_name, "goal_id": str(goal_id)},
                    })
        except Exception as e:
            log(f"  goal {goal_name} fetch failed: {e}")
    return rows


def top_cities(date1: str, date2: str) -> List[Dict]:
    """URGENT 2026-05-17 DASHBOARD_HUMAN_LANGUAGE Phase B Section 3.

    Sergey wanted to see «откуда заходят люди». Pull top 30 cities + visits +
    goal_reaches per city → store в marketing_metrics с metric_name='city_visits'.
    Dashboard server component читает + рендерит таблицу + потенциальный heatmap.
    """
    log(f"  fetching top cities {date1}..{date2}")
    params = {
        "ids": COUNTER,
        "metrics": "ym:s:visits,ym:s:users,ym:s:bounceRate,ym:s:avgVisitDurationSeconds",
        "dimensions": "ym:s:regionCityName,ym:s:regionCountry",
        "date1": date1, "date2": date2,
        "accuracy": "full",
        "limit": 30,
        "sort": "-ym:s:visits",
    }
    data = yandex_get_json(API, params)
    rows: List[Dict] = []
    for d in data.get("data", [])[:30]:
        city = d["dimensions"][0]["name"] or "Неизвестно"
        country = d["dimensions"][1]["name"] or "Неизвестно"
        visits = d["metrics"][0]
        users = d["metrics"][1]
        bounce_rate = d["metrics"][2]
        avg_duration = d["metrics"][3]
        rows.append({
            "date": date2,  # snapshot date
            "source": "metrika",
            "channel": None,
            "metric_name": "city_visits",
            "metric_value": visits,
            "metric_meta": {
                "city": city[:120],
                "country": country[:80],
                "users": users,
                "bounce_rate": round(float(bounce_rate or 0), 1),
                "avg_duration_sec": round(float(avg_duration or 0), 0),
                "period_days": 7,
            },
        })
    return rows


def top_pages(date1: str, date2: str) -> List[Dict]:
    log(f"  fetching top pages {date1}..{date2}")
    # Aggregate by URL для всего periodа — не per-day (слишком много данных)
    params = {
        "ids": COUNTER,
        "metrics": "ym:pv:pageviews,ym:pv:users",
        "dimensions": "ym:pv:URL",
        "date1": date1, "date2": date2,
        "accuracy": "full",
        "limit": 50,
        "sort": "-ym:pv:pageviews",
    }
    data = yandex_get_json(API, params)
    rows: List[Dict] = []
    for d in data.get("data", [])[:50]:
        url = d["dimensions"][0]["name"]
        pageviews = d["metrics"][0]
        users = d["metrics"][1]
        rows.append({
            "date": date2,  # snapshot date — top pages over period
            "source": "metrika",
            "channel": None,
            "metric_name": "pageviews",
            "metric_value": pageviews,
            "metric_meta": {"page_url": url[:500], "users": users, "period_days": 7},
        })
    return rows


def main():
    date1, date2 = date_range(days_back=7)
    log(f"ETL Metrika counter={COUNTER} period {date1}..{date2}")

    all_rows: List[Dict] = []
    try:
        all_rows.extend(visits_by_source(date1, date2))
    except Exception as e:
        log(f"visits_by_source failed: {e}")
    try:
        all_rows.extend(conversions_per_goal(date1, date2))
    except Exception as e:
        log(f"conversions_per_goal failed: {e}")
    try:
        all_rows.extend(top_pages(date1, date2))
    except Exception as e:
        log(f"top_pages failed: {e}")
    try:
        all_rows.extend(top_cities(date1, date2))
    except Exception as e:
        log(f"top_cities failed: {e}")

    log(f"upserting {len(all_rows)} rows...")
    cnt = upsert_metrics(all_rows)
    log(f"done — {cnt} rows upserted")


if __name__ == "__main__":
    main()
