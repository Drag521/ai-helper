#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# AI Helper — Boot Dispatcher
# Runs at boot to verify system state and log startup status.
# Safe (Mode B): read-only checks + writes only to ~/ai-helper/
# Usage: bash boot_dispatcher.sh [action]
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

ACTION="${1:-run}"
HOME_DIR="${HOME:-/home/user}"
AI_DIR="${HOME_DIR}/ai-helper"
LOG_FILE="${AI_DIR}/logs/boot.log"
TMP_DIR="${AI_DIR}/tmp"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ── Ensure log dir exists ───────────────────────────────────
mkdir -p "${AI_DIR}/logs" "${TMP_DIR}"

log() {
  local level="$1"; shift
  echo "[${TIMESTAMP}] [${level}] $*" | tee -a "${LOG_FILE}"
}

# ── PRECHECKS ──────────────────────────────────────────────
log INFO "=== BOOT DISPATCHER START ==="
log INFO "Kernel: $(uname -r)"
log INFO "Hostname: $(hostname)"
log INFO "User: $(whoami)"
log INFO "Uptime: $(uptime -p 2>/dev/null || uptime)"

# ── Network check ───────────────────────────────────────────
if ping -c 1 -W 3 8.8.8.8 &>/dev/null; then
  log INFO "NETWORK: UP"
else
  log WARN "NETWORK: DOWN or unreachable"
fi

# ── Failed systemd units ─────────────────────────────────────
FAILED=$(systemctl --user list-units --state=failed --no-legend 2>/dev/null | wc -l || echo "0")
if [ "${FAILED}" -gt 0 ]; then
  log WARN "FAILED UNITS: ${FAILED} unit(s) in failed state"
  systemctl --user list-units --state=failed --no-legend 2>/dev/null | tee -a "${LOG_FILE}" || true
else
  log INFO "UNITS: No failed units"
fi

# ── Disk space check ─────────────────────────────────────────
DISK_USE=$(df -h / | awk 'NR==2{print $5}' | tr -d '%')
if [ "${DISK_USE}" -gt 90 ] 2>/dev/null; then
  log WARN "DISK: ${DISK_USE}% used — high usage!"
else
  log INFO "DISK: $(df -h / | awk 'NR==2{print $5}') used"
fi

# ── RAM check ────────────────────────────────────────────────
RAM_INFO=$(free -m | awk 'NR==2{printf "USED=%sMB TOTAL=%sMB PCT=%.0f%%",$3,$2,$3*100/$2}')
log INFO "RAM: ${RAM_INFO}"

# ── Custom user actions (add your boot tasks below) ──────────
# Example: log INFO "Starting custom service..."
# Example: systemctl --user start my-custom.service || true

log INFO "=== BOOT DISPATCHER COMPLETE ==="
echo "BOOT_DISPATCH_OK"
