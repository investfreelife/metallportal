#!/usr/bin/env python3
"""
ETL: Voximplant call history → marketing_metrics

ТЗ #050 (parallel). Pulls daily call_count + avg_duration + missed calls.

Auth: JWT signed with Service Account RS256 key.
SA JSON содержит account_id / key_id / private_key (RSA).

API: https://api.voximplant.com/platform_api/
Docs: https://voximplant.com/docs/references/httpapi/auth_parameters

Env required:
  VOXIMPLANT_SERVICE_ACCOUNT_BASE64 (json {account_id, key_id, private_key, account_email})
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
import os
import sys
import json
import time
import base64
from datetime import datetime, timedelta, timezone
from typing import Dict, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import upsert_metrics, date_range, log

try:
    import jwt as pyjwt  # PyJWT — for RS256 signing
    HAS_JWT = True
except ImportError:
    HAS_JWT = False


def make_jwt() -> str:
    """Build RS256 JWT from VOXIMPLANT_SERVICE_ACCOUNT_BASE64."""
    if not HAS_JWT:
        raise RuntimeError("PyJWT not installed — add to requirements.txt")
    sa_b64 = os.environ["VOXIMPLANT_SERVICE_ACCOUNT_BASE64"]
    sa = json.loads(base64.b64decode(sa_b64).decode())

    now = int(time.time())
    payload = {
        "iss": str(sa["account_id"]),
        "iat": now,
        "exp": now + 3600,
    }
    headers = {"kid": sa["key_id"]}
    token = pyjwt.encode(
        payload,
        sa["private_key"],
        algorithm="RS256",
        headers=headers,
    )
    return token


def voxapi(method: str, params: Dict) -> Dict:
    """Voximplant Mgmt API call with JWT auth."""
    import requests
    token = make_jwt()
    url = f"https://api.voximplant.com/platform_api/{method}/"
    r = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}"},
        data=params,
        timeout=60,
    )
    r.raise_for_status()
    return r.json()


def get_call_history(date_from: str, date_to: str) -> List[Dict]:
    """
    GetCallHistory returns calls в data array. Aggregates by day.
    Date format: YYYY-MM-DD HH:MM:SS.
    """
    log(f"  fetching call history {date_from}..{date_to}")
    try:
        data = voxapi("GetCallHistory", {
            "from_date": f"{date_from} 00:00:00",
            "to_date": f"{date_to} 23:59:59",
            "count": 1000,
            "with_records": False,
            "with_other_resources": True,
        })
    except Exception as e:
        log(f"  GetCallHistory failed: {e}")
        return []

    calls = data.get("result", [])
    # Aggregate by date
    by_date: Dict[str, Dict] = {}
    for c in calls:
        start = c.get("start_date", "")  # "2026-05-15 14:30:22"
        if not start:
            continue
        d = start.split(" ")[0]
        agg = by_date.setdefault(d, {"count": 0, "duration_sum": 0, "missed": 0})
        agg["count"] += 1
        dur = c.get("duration", 0) or 0
        agg["duration_sum"] += dur
        if dur == 0:
            agg["missed"] += 1

    rows: List[Dict] = []
    for d, agg in by_date.items():
        rows.append({
            "date": d, "source": "voximplant", "channel": "phone",
            "metric_name": "call_count", "metric_value": agg["count"], "metric_meta": {},
        })
        avg_dur = (agg["duration_sum"] / agg["count"]) if agg["count"] else 0
        rows.append({
            "date": d, "source": "voximplant", "channel": "phone",
            "metric_name": "call_duration_avg", "metric_value": round(avg_dur, 2), "metric_meta": {},
        })
        if agg["missed"]:
            rows.append({
                "date": d, "source": "voximplant", "channel": "phone",
                "metric_name": "call_missed", "metric_value": agg["missed"], "metric_meta": {},
            })
    return rows


def main():
    if not HAS_JWT:
        log("PyJWT not installed — install via pip install PyJWT[crypto]")
        sys.exit(1)
    log("ETL Voximplant")
    date_from, date_to = date_range(days_back=7)
    rows = get_call_history(date_from, date_to)
    log(f"upserting {len(rows)} rows...")
    cnt = upsert_metrics(rows)
    log(f"done — {cnt} rows upserted")


if __name__ == "__main__":
    main()
