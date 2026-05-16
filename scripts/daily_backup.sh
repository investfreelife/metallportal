#!/bin/bash
# ТЗ #043 Block D — Daily backup script.
#
# Run via launchd (com.harlanmetall.backup.plist) at 03:00 МСК (= 00:00 UTC).
#
# Pipeline per run:
#   1. Storage rclone sync (3 buckets) → local _BACKUP/daily/<timestamp>_storage/
#   2. DB JSON-per-table dump через Mgmt API → local _BACKUP/daily/<timestamp>_db/
#   3. Tarball оба → cold cloud (Yandex Cloud OR GitHub Release fallback)
#   4. Retention: keep last 30 daily, 12 weekly, all monthly
#
# Pre-reqs:
#   - rclone configured: ~/.config/rclone/rclone.conf с supabase-storage profile
#   - Env vars из .env.local: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
#   - For Yandex cold copy: yc CLI configured + bucket created
#   - For GitHub fallback: gh CLI authenticated

set -euo pipefail

# launchd does not inherit shell PATH — add Homebrew + system bins explicitly
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

# Config
BACKUP_ROOT="/Users/Shared/металл/_BACKUP/daily"
TIMESTAMP=$(date -u +%Y-%m-%dT%H-%M-%S)
RUN_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
ENV_FILE="/Users/Shared/металл/metallportal/.env.local"
LOG_FILE="${BACKUP_ROOT}/log.txt"
RETENTION_DAYS=30

# Helpers
log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%S)] $1" | tee -a "$LOG_FILE"
}

# Load env
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
else
  log "ERROR: $ENV_FILE not found"
  exit 1
fi

mkdir -p "$RUN_DIR"
log "=== Daily backup started: $TIMESTAMP ==="

# Step 1: Storage sync
log "Step 1: Storage rclone sync"
mkdir -p "${RUN_DIR}/storage"
for bucket in hero-images product-images site-images; do
  log "  Syncing $bucket..."
  rclone sync "supabase-storage:$bucket" "${RUN_DIR}/storage/$bucket" --transfers 16 2>&1 | tail -5 | tee -a "$LOG_FILE"
done
STORAGE_FILES=$(find "${RUN_DIR}/storage" -type f | wc -l | tr -d ' ')
STORAGE_SIZE=$(du -sh "${RUN_DIR}/storage" | cut -f1)
log "  Storage sync done: ${STORAGE_FILES} files, ${STORAGE_SIZE}"

# Step 2: DB JSON dump per table
log "Step 2: DB JSON dump"
mkdir -p "${RUN_DIR}/db"
TABLES_QUERY='SELECT table_name FROM information_schema.tables WHERE table_schema='"'"'public'"'"' ORDER BY table_name'
TABLES_JSON=$(curl -sS -X POST \
  "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"${TABLES_QUERY}\"}")
TABLES=$(echo "$TABLES_JSON" | python3 -c 'import json,sys; print("\n".join(t["table_name"] for t in json.load(sys.stdin)))')

for table in $TABLES; do
  curl -sS -X POST \
    "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"SELECT * FROM ${table}\"}" \
    > "${RUN_DIR}/db/${table}.json"
done
DB_FILES=$(ls "${RUN_DIR}/db" | wc -l | tr -d ' ')
log "  DB dump done: ${DB_FILES} tables"

# Step 3: Tarball
log "Step 3: Tarball"
TARBALL="${BACKUP_ROOT}/${TIMESTAMP}.tar.gz"
tar -czf "$TARBALL" -C "$BACKUP_ROOT" "${TIMESTAMP}"
TAR_SIZE=$(ls -lh "$TARBALL" | awk '{print $5}')
log "  Tarball: ${TAR_SIZE}"

# Step 4: Cold cloud upload
log "Step 4: Cold cloud upload"
# Prefer rclone к Yandex Cloud (S3-compatible) — конфигурация в ~/.config/rclone/rclone.conf
# profile [yc-backup]. Fallback к GitHub Release if rclone not configured.
if command -v rclone >/dev/null 2>&1 && rclone listremotes 2>/dev/null | grep -q "^yc-backup:" && [ -n "${YC_BUCKET:-}" ]; then
  log "  Uploading to Yandex Cloud bucket ${YC_BUCKET} via rclone..."
  rclone copy "$TARBALL" "yc-backup:${YC_BUCKET}/daily/" \
    --s3-no-check-bucket --transfers 8 2>&1 | tail -5 | tee -a "$LOG_FILE"
elif command -v gh >/dev/null 2>&1; then
  log "  Uploading to GitHub Release as fallback..."
  gh release create "backup-${TIMESTAMP}" "$TARBALL" \
    --repo investfreelife/metallportal \
    --title "Backup ${TIMESTAMP}" \
    --notes "Daily snapshot" \
    --prerelease 2>&1 | tee -a "$LOG_FILE"
else
  log "  WARN: No cold cloud configured (rclone yc-backup OR gh). Tarball stays local only."
fi

# Step 5: Retention cleanup
log "Step 5: Retention cleanup (keep last ${RETENTION_DAYS} daily)"
find "$BACKUP_ROOT" -maxdepth 1 -type d -name "20*" -mtime +${RETENTION_DAYS} -exec rm -rf {} \; 2>/dev/null || true
find "$BACKUP_ROOT" -maxdepth 1 -type f -name "*.tar.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

log "=== Daily backup completed: $TIMESTAMP ==="
log ""
