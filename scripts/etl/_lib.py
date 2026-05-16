"""
ETL helpers — Supabase client + safe upsert + date helpers + Voximplant JWT.

ТЗ #050 — Marketing Dashboard. Каждый ETL script importит этот модуль чтобы
не дублировать boilerplate (auth / upsert / logging).
"""
import os
import sys
import json
import time
import base64
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import requests
from supabase import create_client, Client


def get_supabase() -> Client:
    """Lazy supabase client с service_role (для RLS bypass на ETL upsert)."""
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def upsert_metrics(rows: List[Dict[str, Any]]) -> int:
    """
    Upsert into marketing_metrics с UNIQUE constraint (date, source, channel, metric_name, metric_meta).
    Returns count of rows upserted. Safe for re-runs.
    """
    if not rows:
        return 0
    supa = get_supabase()
    # Supabase Python SDK upsert уважает UNIQUE constraint, но не передаёт on_conflict явно.
    # Используем on_conflict через client.table().upsert(..., on_conflict='date,source,...').
    # Однако metric_meta JSONB не индексирован uniquely, поэтому используем raw upsert.
    cnt = 0
    BATCH = 500
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i+BATCH]
        # serialize metric_meta JSONB to dict (supabase-py expects it)
        for r in batch:
            if "metric_meta" not in r:
                r["metric_meta"] = {}
            # ensure numeric serializable
            r["metric_value"] = float(r["metric_value"])
        res = supa.table("marketing_metrics").upsert(
            batch,
            on_conflict="date,source,channel,metric_name,metric_meta"
        ).execute()
        cnt += len(res.data) if hasattr(res, "data") and res.data else len(batch)
    return cnt


def yesterday_str() -> str:
    return (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")


def days_ago_str(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")


def date_range(days_back: int = 7) -> tuple[str, str]:
    """(date_from, date_to) covering last `days_back` дней + сегодня."""
    return days_ago_str(days_back), yesterday_str()


def log(msg: str) -> None:
    """Stderr logger с timestamp — GH Actions ловит как run output."""
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", file=sys.stderr, flush=True)


# ─── Yandex API helpers ─────────────────────────────────────────────────────

def yandex_oauth_headers() -> Dict[str, str]:
    token = os.environ["YANDEX_OAUTH_TOKEN"]
    return {"Authorization": f"OAuth {token}"}


def yandex_get_json(url: str, params: Optional[Dict] = None, max_retries: int = 3) -> Dict:
    """GET с retry для Yandex API rate limits (429) и transient errors (5xx)."""
    for attempt in range(max_retries):
        try:
            r = requests.get(url, headers=yandex_oauth_headers(), params=params, timeout=30)
            if r.status_code in (429, 502, 503, 504):
                wait = 2 ** attempt
                log(f"  retry {attempt+1}/{max_retries} after {wait}s (status {r.status_code})")
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            if attempt == max_retries - 1:
                raise
            log(f"  retry {attempt+1}/{max_retries} after error: {e}")
            time.sleep(2 ** attempt)
    raise RuntimeError("yandex_get_json exhausted retries")


def yandex_post_json(url: str, body: Dict, headers_extra: Optional[Dict] = None) -> Dict:
    headers = {**yandex_oauth_headers(), "Content-Type": "application/json"}
    if headers_extra:
        headers.update(headers_extra)
    r = requests.post(url, headers=headers, json=body, timeout=60)
    r.raise_for_status()
    return r.json()


# ─── Voximplant JWT helpers ─────────────────────────────────────────────────

def voximplant_jwt() -> str:
    """
    Build JWT-style auth header для Voximplant Mgmt API
    (per https://voximplant.com/docs/references/httpapi/auth_parameters).

    SA Base64 contains JSON с {account_id, key_id, private_key}.
    Sign payload RS256.
    """
    sa_b64 = os.environ["VOXIMPLANT_SERVICE_ACCOUNT_BASE64"]
    sa = json.loads(base64.b64decode(sa_b64).decode())

    header = {"typ": "JWT", "alg": "RS256", "kid": sa["key_id"]}
    payload = {
        "iss": sa["account_id"],
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }

    h_b64 = base64.urlsafe_b64encode(json.dumps(header, separators=(",", ":")).encode()).rstrip(b"=").decode()
    p_b64 = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).rstrip(b"=").decode()

    # RS256 signing requires cryptography lib — для simplicity используем HTTPApi static key path
    # Альтернатива: Voximplant также поддерживает Service Account static API token
    raise NotImplementedError("Use VOXIMPLANT_API_KEY directly — JWT signing requires RSA lib")
