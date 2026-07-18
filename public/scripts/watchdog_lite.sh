#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# AI Helper — Watchdog Lite
# Monitors CPU/RAM/disk/network. Self-heals ai-helper.service.
# Runs on schedule (every 15min by default via cron).
# Usage: bash watchdog_lite.sh [run|self_heal|report]
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

ACTION="${1:-run}"
HOME_DIR="${HOME:-/home/user}"
AI_DIR="${HOME_DIR}/ai-helper"
LOG_FILE="${AI_DIR}/logs/watchdog.log"
TMP_DIR="${AI_DIR}/tmp"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
SERVICE_NAME="${2:-ai-helper.service}"

# Thresholds
CPU_WARN=85
RAM_WARN=85
DISK_WARN=90

ANOMALIES=()

mkdir -p "${AI_DIR}/logs" "${TMP_DIR}"

log() {
  local level="$1"; shift
  echo "[${TIMESTAMP}] [${level}] $*" | tee -a "${LOG_FILE}"
}

# ── Self-heal ────────────────────────────────────────────────
self_heal() {
  log INFO "=== SELF-HEAL CHECK: ${SERVICE_NAME} ==="
  if systemctl --user is-active "${SERVICE_NAME}" &>/dev/null; then
    log INFO "SERVICE: ${SERVICE_NAME} is ACTIVE — no action needed"
    echo "SERVICE_HEALTHY"
  else
    STATUS=$(systemctl --user is-active "${SERVICE_NAME}" 2>/dev/null || echo "inactive")
    log WARN "SERVICE: ${SERVICE_NAME} is ${STATUS} — attempting restart"
    if systemctl --user restart "${SERVICE_NAME}" 2>&1 | tee -a "${LOG_FILE}"; then
      log INFO "SERVICE: ${SERVICE_NAME} RESTARTED successfully"
      echo "SERVICE_RESTARTED"
    else
      log ERROR "SERVICE: ${SERVICE_NAME} restart FAILED"
      echo "SERVICE_RESTART_FAILED"
    fi
  fi
}

# ── Report ───────────────────────────────────────────────────
report() {
  log INFO "=== WATCHDOG REPORT ==="
  if [ ${#ANOMALIES[@]} -eq 0 ]; then
    log INFO "STATUS: ALL SYSTEMS NORMAL"
  else
    log WARN "ANOMALIES DETECTED: ${#ANOMALIES[@]}"
    for anomaly in "${ANOMALIES[@]}"; do
      log WARN "  >> ${anomaly}"
    done
  fi
  log INFO "=== REPORT COMPLETE ==="
  echo "WATCHDOG_REPORT_OK"
}

# ── Main run ─────────────────────────────────────────────────
run_all() {
  log INFO "=== WATCHDOG LITE START ==="

  # CPU check
  CPU_IDLE=$(top -bn1 | grep 'Cpu(s)' | awk '{print $8}' | cut -d'%' -f1 2>/dev/null || echo "0")
  CPU_USE=$(echo "100 - ${CPU_IDLE}" | bc 2>/dev/null || echo "unknown")
  log INFO "CPU: ${CPU_USE}% usage"
  if echo "${CPU_USE}" | grep -qE '^[0-9]+$' && [ "${CPU_USE}" -gt "${CPU_WARN}" ] 2>/dev/null; then
    ANOMALIES+=("CPU usage ${CPU_USE}% exceeds ${CPU_WARN}% threshold")
    log WARN "CPU: HIGH — ${CPU_USE}% (threshold: ${CPU_WARN}%)"
  fi

  # RAM check
  RAM_INFO=$(free -m | awk 'NR==2{printf "USED=%sMB TOTAL=%sMB PCT=%.0f%%",$3,$2,$3*100/$2}')
  RAM_PCT=$(free -m | awk 'NR==2{printf "%.0f",$3*100/$2}')
  log INFO "RAM: ${RAM_INFO}"
  if [ "${RAM_PCT}" -gt "${RAM_WARN}" ] 2>/dev/null; then
    ANOMALIES+=("RAM usage ${RAM_PCT}% exceeds ${RAM_WARN}% threshold")
    log WARN "RAM: HIGH — ${RAM_PCT}% (threshold: ${RAM_WARN}%)"
  fi

  # Disk check
  DISK_PCT=$(df -h / | awk 'NR==2{print $5}' | tr -d '%')
  DISK_INFO=$(df -h / | awk 'NR==2{print $5" used of "$2" on "$1}')
  log INFO "DISK: ${DISK_INFO}"
  if [ "${DISK_PCT}" -gt "${DISK_WARN}" ] 2>/dev/null; then
    ANOMALIES+=("Disk usage ${DISK_PCT}% exceeds ${DISK_WARN}% threshold")
    log WARN "DISK: HIGH — ${DISK_PCT}% (threshold: ${DISK_WARN}%)"
    if [ "${DISK_PCT}" -gt 95 ]; then
      log ERROR "DISK: CRITICAL — ${DISK_PCT}% — immediate action required"
    fi
  fi

  # Network check
  if ping -c 2 -W 3 8.8.8.8 &>/dev/null; then
    LATENCY=$(ping -c 2 -W 3 8.8.8.8 2>/dev/null | tail -1 | awk -F'/' '{print $5}')
    log INFO "NETWORK: UP (avg latency: ${LATENCY}ms)"
  else
    ANOMALIES+=("Network unreachable — cannot ping 8.8.8.8")
    log WARN "NETWORK: UNREACHABLE"
  fi

  # Self-heal check
  self_heal

  report

  log INFO "=== WATCHDOG LITE COMPLETE — Anomalies: ${#ANOMALIES[@]} ==="
  echo "WATCHDOG_COMPLETE ANOMALIES=${#ANOMALIES[@]}"
}

case "${ACTION}" in
  self_heal) self_heal ;;
  report)    report ;;
  run|*)     run_all ;;
esac
