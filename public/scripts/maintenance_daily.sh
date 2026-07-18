#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# AI Helper — Daily Maintenance
# Disk cleanup, apt update check, temp purge, log rotation.
# Mode B: only ~/ai-helper/tmp/ is deleted. No user data touched.
# Usage: bash maintenance_daily.sh [run|rotate_logs|report]
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

ACTION="${1:-run}"
HOME_DIR="${HOME:-/home/user}"
AI_DIR="${HOME_DIR}/ai-helper"
LOG_FILE="${AI_DIR}/logs/maintenance.log"
TMP_DIR="${AI_DIR}/tmp"
ARCHIVE_DIR="${AI_DIR}/logs/archive"
KEEP_DAYS="${2:-30}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

mkdir -p "${AI_DIR}/logs" "${TMP_DIR}" "${ARCHIVE_DIR}"

log() {
  local level="$1"; shift
  echo "[${TIMESTAMP}] [${level}] $*" | tee -a "${LOG_FILE}"
}

# ── Action: rotate_logs ─────────────────────────────────────
rotate_logs() {
  log INFO "=== LOG ROTATION START (keep ${KEEP_DAYS} days) ==="
  local count=0
  while IFS= read -r -d '' f; do
    local age_days
    age_days=$(( ( $(date +%s) - $(date +%s -r "${f}") ) / 86400 ))
    if [ "${age_days}" -gt "${KEEP_DAYS}" ]; then
      local dest="${ARCHIVE_DIR}/$(basename "${f}").$(date +%Y%m%d)"
      mv "${f}" "${dest}" && log INFO "ROTATED: $(basename "${f}") (age ${age_days}d)" && ((count++)) || true
    fi
  done < <(find "${AI_DIR}/logs" -maxdepth 1 -name "*.log" -print0 2>/dev/null)
  log INFO "ROTATED: ${count} log file(s)"
  # Remove archives older than 90 days
  find "${ARCHIVE_DIR}" -mtime +90 -delete 2>/dev/null || true
  log INFO "=== LOG ROTATION COMPLETE ==="
  echo "LOG_ROTATION_DONE"
}

# ── Action: report ──────────────────────────────────────────
report() {
  log INFO "=== MAINTENANCE REPORT ==="
  log INFO "DISK: $(df -h / | awk 'NR==2{print $5" used of "$2}')"
  log INFO "RAM: $(free -m | awk 'NR==2{printf "%.0f%% used (%sMB/%sMB)",$3*100/$2,$3,$2}')"
  log INFO "LOG_DIR_SIZE: $(du -sh "${AI_DIR}/logs" 2>/dev/null | cut -f1)"
  log INFO "TMP_DIR_SIZE: $(du -sh "${TMP_DIR}" 2>/dev/null | cut -f1 || echo "0")"
  log INFO "=== REPORT COMPLETE ==="
  echo "MAINTENANCE_REPORT_OK"
}

# ── Action: run (default — full maintenance) ─────────────────
run_all() {
  log INFO "=== DAILY MAINTENANCE START ==="

  # Disk report
  log INFO "DISK USAGE:"
  df -h | tee -a "${LOG_FILE}" || true

  # apt update (no install — just refresh index)
  log INFO "APT UPDATE CHECK:"
  if which apt-get &>/dev/null; then
    apt-get update -qq 2>&1 | tail -3 | tee -a "${LOG_FILE}" || log WARN "apt-get update failed"
    UPGRADABLE=$(apt list --upgradable 2>/dev/null | grep -c upgradable || echo "0")
    log INFO "UPGRADABLE_PACKAGES: ${UPGRADABLE}"
  else
    log WARN "apt-get not found — skipping update check"
  fi

  # Temp purge (Mode B: only ~/ai-helper/tmp/)
  log INFO "TEMP PURGE: ${TMP_DIR}"
  rm -rf "${TMP_DIR:?}"/* 2>/dev/null || true
  log INFO "TEMP_PURGE_DONE"

  rotate_logs
  report

  log INFO "=== DAILY MAINTENANCE COMPLETE ==="
  echo "MAINTENANCE_COMPLETE"
}

case "${ACTION}" in
  rotate_logs) rotate_logs ;;
  report)      report ;;
  run|*)       run_all ;;
esac
