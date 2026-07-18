#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# AI Helper — Shizuku / ADB Automation Runner
# Full stub with real ADB commands + Shizuku binder integration.
# Expand the AUTOMATION section with your real tasks.
# Usage: bash shizuku_runner.sh [run_automation|check|device_info]
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

ACTION="${1:-run_automation}"
MODE="${2:-stub}"
TASK="${3:-health_check}"
HOME_DIR="${HOME:-/home/user}"
AI_DIR="${HOME_DIR}/ai-helper"
LOG_FILE="${AI_DIR}/logs/shizuku.log"
TMP_DIR="${AI_DIR}/tmp"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

mkdir -p "${AI_DIR}/logs" "${TMP_DIR}"

log() {
  local level="$1"; shift
  echo "[${TIMESTAMP}] [${level}] $*" | tee -a "${LOG_FILE}"
}

# ── ADB helper ───────────────────────────────────────────────
adb_check() {
  if ! which adb &>/dev/null; then
    log ERROR "adb not found — install with: sudo apt-get install -y adb"
    echo "ADB_MISSING"
    return 1
  fi
  DEVICES=$(adb devices 2>/dev/null | tail -n +2 | grep -v '^$' | grep -v 'offline')
  if [ -z "${DEVICES}" ]; then
    log WARN "No ADB devices found — connect device or run: adb connect 100.115.90.2:5555"
    echo "NO_DEVICES"
    return 1
  fi
  echo "ADB_OK"
}

# ── Device info ─────────────────────────────────────────────
device_info() {
  log INFO "=== DEVICE INFO ==="
  ADB_STATUS=$(adb_check || true)
  if [ "${ADB_STATUS}" != "ADB_OK" ]; then
    log WARN "ADB not available: ${ADB_STATUS}"
    echo "DEVICE_INFO_SKIPPED"
    return
  fi
  ANDROID_VER=$(adb shell getprop ro.build.version.release 2>/dev/null || echo "unknown")
  MODEL=$(adb shell getprop ro.product.model 2>/dev/null || echo "unknown")
  SERIAL=$(adb shell getprop ro.serialno 2>/dev/null || echo "unknown")
  log INFO "ANDROID_VERSION: ${ANDROID_VER}"
  log INFO "MODEL: ${MODEL}"
  log INFO "SERIAL: ${SERIAL}"

  # Battery
  BATTERY=$(adb shell dumpsys battery 2>/dev/null | grep -E 'level|status|health' | head -5 || echo "unavailable")
  log INFO "BATTERY: ${BATTERY}"

  # Screen state
  SCREEN=$(adb shell dumpsys power 2>/dev/null | grep -E 'mWakefulness|mScreenOn' | head -3 || echo "unavailable")
  log INFO "SCREEN_STATE: ${SCREEN}"

  echo "DEVICE_INFO_OK"
}

# ── Shizuku check ────────────────────────────────────────────
shizuku_check() {
  log INFO "=== SHIZUKU CHECK ==="
  ADB_STATUS=$(adb_check || true)
  if [ "${ADB_STATUS}" != "ADB_OK" ]; then
    log WARN "ADB not available — skipping Shizuku check"
    echo "SHIZUKU_CHECK_SKIPPED"
    return
  fi

  # Check Shizuku package
  SHIZUKU_PKG=$(adb shell pm list packages 2>/dev/null | grep -i shizuku | head -3 || echo "")
  if [ -z "${SHIZUKU_PKG}" ]; then
    log WARN "Shizuku package not found — install from Play Store"
    echo "SHIZUKU_NOT_INSTALLED"
  else
    log INFO "SHIZUKU_PACKAGE: ${SHIZUKU_PKG}"

    # Check Shizuku binder service
    BINDER=$(adb shell service list 2>/dev/null | grep -i shizuku | head -5 || echo "")
    if [ -n "${BINDER}" ]; then
      log INFO "SHIZUKU_BINDER: ACTIVE — ${BINDER}"
      echo "SHIZUKU_OK"
    else
      log WARN "Shizuku binder not in service list — open Shizuku app and start service"
      echo "SHIZUKU_NOT_RUNNING"
    fi
  fi
}

# ── Automation stubs (expand with your real tasks) ───────────
run_automation() {
  log INFO "=== SHIZUKU AUTOMATION START (task: ${TASK}, mode: ${MODE}) ==="

  # ── Health check stub ──────────────────────────────────────
  if [ "${TASK}" = "health_check" ]; then
    device_info
    shizuku_check

    # ── Example automation tasks (uncomment to activate) ─────
    # ── Clear app cache (requires Shizuku) ───────────────────
    # adb shell cmd package trim-caches 1000G
    # log INFO "App cache cleared"

    # ── Force-stop a background app ──────────────────────────
    # adb shell am force-stop com.example.app
    # log INFO "Force-stopped com.example.app"

    # ── Set screen brightness ─────────────────────────────────
    # adb shell settings put system screen_brightness 128
    # log INFO "Screen brightness set to 128"

    # ── Take a screenshot ─────────────────────────────────────
    # adb shell screencap -p /sdcard/screenshot.png
    # adb pull /sdcard/screenshot.png "${TMP_DIR}/screenshot_$(date +%Y%m%d_%H%M%S).png"
    # log INFO "Screenshot saved to TMP_DIR"

    # ── Shizuku shell command (requires Shizuku running) ──────
    # This uses adb to invoke a shell command with Shizuku privileges
    # adb shell sh /sdcard/Android/data/moe.shizuku.privileged.api/starter
    # log INFO "Shizuku privileged command executed"

    log INFO "Health check complete — add your automation tasks above"
    echo "AUTOMATION_HEALTH_CHECK_OK"
  else
    log WARN "Unknown task: ${TASK} — add handling in shizuku_runner.sh"
    echo "UNKNOWN_TASK_${TASK}"
  fi

  log INFO "=== SHIZUKU AUTOMATION COMPLETE ==="
}

case "${ACTION}" in
  run_automation) run_automation ;;
  device_info)    device_info ;;
  check)          shizuku_check ;;
  *)              run_automation ;;
esac
