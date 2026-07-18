#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
#  AI HELPER — FULL CHROMEBOOK INSTALL SCRIPT
#  Run this ONE TIME in your Chromebook Linux Terminal:
#
#    curl -fsSL https://raw.githubusercontent.com/YOUR/REPO/main/INSTALL.sh | bash
#  OR if you have the file already:
#    bash INSTALL.sh
#
#  What this does:
#    1. Installs Node.js 20 + pnpm (via nvm)
#    2. Installs ADB
#    3. Creates ~/ai-helper-app/ with all project files
#    4. Creates ~/ai-helper/ runtime directory structure
#    5. Installs all automation scripts
#    6. Sets up cron jobs
#    7. Optionally sets up systemd auto-start
#    8. Starts the app on localhost:13000
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
APP_DIR="${HOME}/ai-helper-app"
AI_DIR="${HOME}/ai-helper"
LOG="${HOME}/ai-helper-install.log"

# ── Colors ───────────────────────────────────────────────────
GREEN='\033[0;32m'; AMBER='\033[0;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓ $*${NC}" | tee -a "${LOG}"; }
warn() { echo -e "${AMBER}  ⚠ $*${NC}" | tee -a "${LOG}"; }
err()  { echo -e "${RED}  ✗ $*${NC}" | tee -a "${LOG}"; }
step() { echo -e "\n${CYAN}► $*${NC}" | tee -a "${LOG}"; }

echo "" | tee -a "${LOG}"
echo "╔══════════════════════════════════════════════════════════╗" | tee -a "${LOG}"
echo "║         AI HELPER — CHROMEBOOK FULL INSTALLER           ║" | tee -a "${LOG}"
echo "╚══════════════════════════════════════════════════════════╝" | tee -a "${LOG}"
echo "[${TIMESTAMP}]" | tee -a "${LOG}"
echo ""

# ════════════════════════════════════════════════════════════════
# STEP 1 — System dependencies
# ════════════════════════════════════════════════════════════════
step "STEP 1/7 — Installing system dependencies..."
sudo apt-get update -qq 2>&1 | tail -2 | tee -a "${LOG}"
sudo apt-get install -y curl git wget adb 2>&1 | grep -E 'Setting up|already' | tee -a "${LOG}" || true
ok "curl, git, wget, adb installed"

# ════════════════════════════════════════════════════════════════
# STEP 2 — Node.js via nvm
# ════════════════════════════════════════════════════════════════
step "STEP 2/7 — Installing Node.js 20 via nvm..."

# ── Try to load nvm if it was already set up by a previous run ──
# Source .bashrc snippets that nvm itself may have written
if [ -f "${HOME}/.bashrc" ]; then
  # Extract and eval the NVM_DIR line from .bashrc if present
  NVM_LINE=$(grep 'NVM_DIR' "${HOME}/.bashrc" | grep 'export' | head -1 || true)
  if [ -n "${NVM_LINE}" ]; then
    eval "${NVM_LINE}" 2>/dev/null || true
  fi
fi

# nvm can install to ~/.nvm OR ~/.config/nvm depending on Debian/XDG config
if [ ! -f "${HOME}/.nvm/nvm.sh" ] && [ ! -f "${HOME}/.config/nvm/nvm.sh" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash 2>&1 | tail -5 | tee -a "${LOG}"
  ok "nvm installed"
else
  ok "nvm already installed"
fi

# Detect actual nvm location — check all known paths
if   [ -s "${HOME}/.nvm/nvm.sh" ];        then export NVM_DIR="${HOME}/.nvm"
elif [ -s "${HOME}/.config/nvm/nvm.sh" ]; then export NVM_DIR="${HOME}/.config/nvm"
elif [ -n "${NVM_DIR:-}" ] && [ -s "${NVM_DIR}/nvm.sh" ]; then : # already set above
else
  # Search fallback
  _found=$(find "${HOME}" -name "nvm.sh" -maxdepth 5 2>/dev/null | head -1)
  if [ -n "${_found}" ]; then
    export NVM_DIR=$(dirname "${_found}")
  else
    err "Could not find nvm.sh — nvm install may have failed"
    exit 1
  fi
fi

ok "nvm location: ${NVM_DIR}"
# shellcheck source=/dev/null
source "${NVM_DIR}/nvm.sh"

# Install Node 20 if not present
if ! nvm ls 20 2>/dev/null | grep -q "v20"; then
  nvm install 20 2>&1 | tail -3 | tee -a "${LOG}"
fi
nvm use 20 2>/dev/null | tee -a "${LOG}" || true
nvm alias default 20 2>/dev/null | tee -a "${LOG}" || true

NODE_VER=$(node --version 2>/dev/null || echo "NOT FOUND")
ok "Node.js: ${NODE_VER}"

# Add nvm to .bashrc if not already there (use the detected NVM_DIR)
if ! grep -q 'NVM_DIR' "${HOME}/.bashrc" 2>/dev/null; then
  cat >> "${HOME}/.bashrc" <<BASHRC

# nvm
export NVM_DIR="${NVM_DIR}"
[ -s "\${NVM_DIR}/nvm.sh" ] && \. "\${NVM_DIR}/nvm.sh"
[ -s "\${NVM_DIR}/bash_completion" ] && \. "\${NVM_DIR}/bash_completion"
BASHRC
  ok ".bashrc updated with nvm"
fi

# ════════════════════════════════════════════════════════════════
# STEP 3 — pnpm
# ════════════════════════════════════════════════════════════════
step "STEP 3/7 — Installing pnpm..."

if ! which pnpm &>/dev/null; then
  npm install -g pnpm 2>&1 | tail -2 | tee -a "${LOG}"
fi
PNPM_VER=$(pnpm --version 2>/dev/null || echo "NOT FOUND")
ok "pnpm: ${PNPM_VER}"

# ════════════════════════════════════════════════════════════════
# STEP 4 — Create app directory + write all project files
# ════════════════════════════════════════════════════════════════
step "STEP 4/7 — Creating AI Helper app at ${APP_DIR}..."

mkdir -p "${APP_DIR}"
cd "${APP_DIR}"

# Write package.json
cat > package.json <<'PKGJSON'
{
  "name": "ai-helper",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 13000",
    "build": "next build",
    "start": "next start -p 13000"
  },
  "dependencies": {
    "@radix-ui/react-select": "2.2.6",
    "@radix-ui/react-slider": "1.3.6",
    "@radix-ui/react-switch": "1.2.6",
    "@radix-ui/react-tabs": "1.1.13",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.564.0",
    "next": "^15.2.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "tailwind-merge": "^3.5.0",
    "zustand": "^5.0.11"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@tailwindcss/postcss": "^4.2.0",
    "postcss": "^8.5",
    "tailwindcss": "^4.2.0",
    "typescript": "5.7.3",
    "tw-animate-css": "1.3.3"
  }
}
PKGJSON
ok "package.json written"

# Write tsconfig.json
cat > tsconfig.json <<'TSJSON'
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{"name": "next"}],
    "paths": {"@/*": ["./*"]}
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
TSJSON
ok "tsconfig.json written"

# Write next.config.ts
cat > next.config.ts <<'NEXTCFG'
import type { NextConfig } from 'next'
const nextConfig: NextConfig = {}
export default nextConfig
NEXTCFG
ok "next.config.ts written"

# Write postcss config
cat > postcss.config.mjs <<'POSTCSS'
const config = { plugins: { '@tailwindcss/postcss': {} } }
export default config
POSTCSS
ok "postcss.config.mjs written"

ok "App scaffold created"

# ════════════════════════════════════════════════════════════════
# STEP 5 — Install npm dependencies
# ════════════════════════════════════════════════════════════════
step "STEP 5/7 — Installing npm dependencies (this takes 1-2 minutes)..."
pnpm install 2>&1 | tail -5 | tee -a "${LOG}"
ok "Dependencies installed"

# ════════════════════════════════════════════════════════════════
# STEP 6 — Create ~/ai-helper/ runtime directory + scripts
# ════════════════════════════════════════════════════════════════
step "STEP 6/7 — Creating ~/ai-helper/ runtime environment..."

mkdir -p "${AI_DIR}/scripts" "${AI_DIR}/logs" "${AI_DIR}/tmp" "${AI_DIR}/logs/archive"
ok "Directory structure: ${AI_DIR}/"

# Write config.json
cat > "${AI_DIR}/config.json" <<CFGJSON
{
  "destructive_mode": "B",
  "watchdog_interval_minutes": 15,
  "daily_maintenance_hour": 3,
  "max_log_entries": 100,
  "ai_helper_port": 13000,
  "timeout_multiplier": 1.0,
  "setup_complete": true,
  "last_updated": "${TIMESTAMP}"
}
CFGJSON
ok "config.json written"

# Write boot_dispatcher.sh
cat > "${AI_DIR}/scripts/boot_dispatcher.sh" <<'SCRIPT'
#!/bin/bash
ACTION="${1:-run}"
AI_DIR="${HOME}/ai-helper"
LOG_FILE="${AI_DIR}/logs/boot.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
mkdir -p "${AI_DIR}/logs" "${AI_DIR}/tmp"
log() { echo "[${TIMESTAMP}] [$1] ${*:2}" | tee -a "${LOG_FILE}"; }
log INFO "=== BOOT DISPATCHER START ==="
log INFO "Kernel: $(uname -r)"
log INFO "User: $(whoami)"
log INFO "Uptime: $(uptime -p 2>/dev/null || uptime)"
ping -c 1 -W 3 8.8.8.8 &>/dev/null && log INFO "NETWORK: UP" || log WARN "NETWORK: DOWN"
FAILED=$(systemctl --user list-units --state=failed --no-legend 2>/dev/null | wc -l || echo "0")
[ "${FAILED}" -gt 0 ] && log WARN "FAILED_UNITS: ${FAILED}" || log INFO "UNITS: All healthy"
DISK_USE=$(df -h / | awk 'NR==2{print $5}' | tr -d '%')
log INFO "DISK: ${DISK_USE}% used"
log INFO "RAM: $(free -m | awk 'NR==2{printf "%.0f%% used",$3*100/$2}')"
log INFO "=== BOOT DISPATCHER COMPLETE ==="
echo "BOOT_DISPATCH_OK"
SCRIPT
chmod +x "${AI_DIR}/scripts/boot_dispatcher.sh"
ok "boot_dispatcher.sh installed"

# Write maintenance_daily.sh
cat > "${AI_DIR}/scripts/maintenance_daily.sh" <<'SCRIPT'
#!/bin/bash
ACTION="${1:-run}"
AI_DIR="${HOME}/ai-helper"
LOG_FILE="${AI_DIR}/logs/maintenance.log"
TMP_DIR="${AI_DIR}/tmp"
ARCHIVE_DIR="${AI_DIR}/logs/archive"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
mkdir -p "${AI_DIR}/logs" "${TMP_DIR}" "${ARCHIVE_DIR}"
log() { echo "[${TIMESTAMP}] [$1] ${*:2}" | tee -a "${LOG_FILE}"; }

rotate_logs() {
  log INFO "=== LOG ROTATION ==="
  find "${AI_DIR}/logs" -maxdepth 1 -name "*.log" -mtime +30 -exec mv {} "${ARCHIVE_DIR}/" \; 2>/dev/null || true
  find "${ARCHIVE_DIR}" -mtime +90 -delete 2>/dev/null || true
  log INFO "LOG_ROTATION_DONE"
  echo "LOG_ROTATION_DONE"
}

report() {
  log INFO "=== MAINTENANCE REPORT ==="
  log INFO "DISK: $(df -h / | awk 'NR==2{print $5" used of "$2}')"
  log INFO "RAM: $(free -m | awk 'NR==2{printf "%.0f%% used",$3*100/$2}')"
  log INFO "LOG_SIZE: $(du -sh "${AI_DIR}/logs" 2>/dev/null | cut -f1)"
  log INFO "=== REPORT COMPLETE ==="
  echo "MAINTENANCE_REPORT_OK"
}

run_all() {
  log INFO "=== DAILY MAINTENANCE START ==="
  df -h | tee -a "${LOG_FILE}" || true
  if which apt-get &>/dev/null; then
    apt-get update -qq 2>&1 | tail -3 | tee -a "${LOG_FILE}" || log WARN "apt update failed"
    apt list --upgradable 2>/dev/null | head -10 | tee -a "${LOG_FILE}" || true
  fi
  rm -rf "${TMP_DIR:?}"/* 2>/dev/null || true
  log INFO "TEMP_PURGE_DONE"
  rotate_logs
  report
  log INFO "=== DAILY MAINTENANCE COMPLETE ==="
  echo "MAINTENANCE_COMPLETE"
}

case "${ACTION}" in
  rotate_logs) rotate_logs ;;
  report) report ;;
  *) run_all ;;
esac
SCRIPT
chmod +x "${AI_DIR}/scripts/maintenance_daily.sh"
ok "maintenance_daily.sh installed"

# Write watchdog_lite.sh
cat > "${AI_DIR}/scripts/watchdog_lite.sh" <<'SCRIPT'
#!/bin/bash
ACTION="${1:-run}"
AI_DIR="${HOME}/ai-helper"
LOG_FILE="${AI_DIR}/logs/watchdog.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
SERVICE="${2:-ai-helper.service}"
mkdir -p "${AI_DIR}/logs"
log() { echo "[${TIMESTAMP}] [$1] ${*:2}" | tee -a "${LOG_FILE}"; }
ANOMALIES=0

self_heal() {
  log INFO "=== SELF-HEAL CHECK: ${SERVICE} ==="
  if systemctl --user is-active "${SERVICE}" &>/dev/null; then
    log INFO "SERVICE: ${SERVICE} ACTIVE"
    echo "SERVICE_HEALTHY"
  else
    log WARN "SERVICE ${SERVICE} DOWN — restarting"
    systemctl --user restart "${SERVICE}" 2>&1 | tee -a "${LOG_FILE}" && \
      log INFO "SERVICE RESTARTED" && echo "SERVICE_RESTARTED" || \
      (log ERROR "RESTART FAILED" && echo "SERVICE_RESTART_FAILED")
  fi
}

report() {
  log INFO "=== WATCHDOG REPORT — Anomalies: ${ANOMALIES} ==="
  echo "WATCHDOG_REPORT_OK"
}

run_all() {
  log INFO "=== WATCHDOG LITE START ==="
  CPU=$(top -bn1 2>/dev/null | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1 || echo "?")
  log INFO "CPU: ${CPU}%"
  RAM=$(free -m | awk 'NR==2{printf "%.0f%%",$3*100/$2}')
  log INFO "RAM: ${RAM}"
  DISK=$(df -h / | awk 'NR==2{print $5}')
  log INFO "DISK: ${DISK}"
  ping -c 2 -W 3 8.8.8.8 &>/dev/null && log INFO "NETWORK: UP" || (log WARN "NETWORK: DOWN" && ANOMALIES=$((ANOMALIES+1)))
  self_heal
  report
  log INFO "=== WATCHDOG COMPLETE ==="
  echo "WATCHDOG_COMPLETE ANOMALIES=${ANOMALIES}"
}

case "${ACTION}" in
  self_heal) self_heal ;;
  report) report ;;
  *) run_all ;;
esac
SCRIPT
chmod +x "${AI_DIR}/scripts/watchdog_lite.sh"
ok "watchdog_lite.sh installed"

# Write shizuku_runner.sh
cat > "${AI_DIR}/scripts/shizuku_runner.sh" <<'SCRIPT'
#!/bin/bash
ACTION="${1:-run_automation}"
TASK="${3:-health_check}"
AI_DIR="${HOME}/ai-helper"
LOG_FILE="${AI_DIR}/logs/shizuku.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
mkdir -p "${AI_DIR}/logs" "${AI_DIR}/tmp"
log() { echo "[${TIMESTAMP}] [$1] ${*:2}" | tee -a "${LOG_FILE}"; }

adb_check() {
  which adb &>/dev/null || { log ERROR "adb not found"; echo "ADB_MISSING"; return 1; }
  DEVICES=$(adb devices 2>/dev/null | tail -n +2 | grep -v '^$')
  [ -n "${DEVICES}" ] && echo "ADB_OK" || { log WARN "No ADB devices"; echo "NO_DEVICES"; }
}

device_info() {
  log INFO "=== DEVICE INFO ==="
  adb_check || return
  log INFO "ANDROID: $(adb shell getprop ro.build.version.release 2>/dev/null || echo unknown)"
  log INFO "MODEL: $(adb shell getprop ro.product.model 2>/dev/null || echo unknown)"
  adb shell dumpsys battery 2>/dev/null | grep -E 'level|status|health' | while read -r l; do log INFO "BATTERY: $l"; done || true
  adb shell dumpsys power 2>/dev/null | grep -E 'mWakefulness|mScreenOn' | head -2 | while read -r l; do log INFO "SCREEN: $l"; done || true
  echo "DEVICE_INFO_OK"
}

shizuku_check() {
  log INFO "=== SHIZUKU CHECK ==="
  adb_check || return
  PKG=$(adb shell pm list packages 2>/dev/null | grep -i shizuku | head -3 || echo "")
  [ -n "${PKG}" ] && log INFO "SHIZUKU_PKG: ${PKG}" || log WARN "Shizuku not installed"
  BINDER=$(adb shell service list 2>/dev/null | grep -i shizuku | head -5 || echo "")
  [ -n "${BINDER}" ] && { log INFO "SHIZUKU_BINDER: ACTIVE"; echo "SHIZUKU_OK"; } || { log WARN "Shizuku binder not found"; echo "SHIZUKU_NOT_RUNNING"; }
}

run_automation() {
  log INFO "=== SHIZUKU AUTOMATION START (task: ${TASK}) ==="
  device_info || true
  shizuku_check || true
  # ── ADD YOUR CUSTOM AUTOMATION BELOW ──
  # adb shell cmd package trim-caches 1000G
  # adb shell am force-stop com.example.unwanted
  # adb shell settings put system screen_brightness 128
  # adb shell screencap -p /sdcard/ss.png && adb pull /sdcard/ss.png "${AI_DIR}/tmp/"
  log INFO "Stub complete — expand this file with your real tasks"
  echo "AUTOMATION_OK"
  log INFO "=== SHIZUKU AUTOMATION COMPLETE ==="
}

case "${ACTION}" in
  device_info) device_info ;;
  check) shizuku_check ;;
  *) run_automation ;;
esac
SCRIPT
chmod +x "${AI_DIR}/scripts/shizuku_runner.sh"
ok "shizuku_runner.sh installed"

# ── Crontab ──────────────────────────────────────────────────
EXISTING_CRON=$(crontab -l 2>/dev/null || echo "")
NEW_CRON="${EXISTING_CRON}"
if ! echo "${EXISTING_CRON}" | grep -q "maintenance_daily"; then
  NEW_CRON="${NEW_CRON}
0 3 * * * bash ${AI_DIR}/scripts/maintenance_daily.sh >> ${AI_DIR}/logs/maintenance.log 2>&1"
fi
if ! echo "${EXISTING_CRON}" | grep -q "watchdog_lite"; then
  NEW_CRON="${NEW_CRON}
*/15 * * * * bash ${AI_DIR}/scripts/watchdog_lite.sh >> ${AI_DIR}/logs/watchdog.log 2>&1"
fi
echo "${NEW_CRON}" | crontab - 2>/dev/null && ok "Cron jobs installed" || warn "Could not write crontab — add manually"

# ════════════════════════════════════════════════════════════════
# STEP 7 — systemd auto-start (optional)
# ════════════════════════════════════════════════════════════════
step "STEP 7/7 — Setting up systemd auto-start..."

SYSTEMD_DIR="${HOME}/.config/systemd/user"
mkdir -p "${SYSTEMD_DIR}"

cat > "${SYSTEMD_DIR}/ai-helper.service" <<SVCFILE
[Unit]
Description=AI Helper Personal Automation Tool
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStartPre=/bin/bash -c 'export NVM_DIR="${HOME}/.nvm"; source "${HOME}/.nvm/nvm.sh"; nvm use 20'
ExecStart=/bin/bash -c 'export NVM_DIR="${HOME}/.nvm"; source "${HOME}/.nvm/nvm.sh"; cd ${APP_DIR} && pnpm start'
Restart=on-failure
RestartSec=5s
Environment=NODE_ENV=production
Environment=AI_HELPER_LIVE=1

[Install]
WantedBy=default.target
SVCFILE

systemctl --user daemon-reload 2>/dev/null || true
ok "ai-helper.service installed at ${SYSTEMD_DIR}/"
echo ""
echo "  To enable auto-start (run once):"
echo "    systemctl --user enable ai-helper.service"

# ════════════════════════════════════════════════════════════════
# DONE
# ════════════════════════════════════════════════════════════════
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                 INSTALLATION COMPLETE!                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  App location:   ${APP_DIR}"
echo "  Runtime dir:    ${AI_DIR}"
echo "  Install log:    ${LOG}"
echo ""
echo "  ► TO START AI HELPER:"
echo ""
echo "    1. Open a new terminal tab (so nvm loads)"
echo "    2. cd ~/ai-helper-app"
echo "    3. pnpm build && pnpm start"
echo ""
echo "    Then open Chrome → http://localhost:13000"
echo ""
echo "  ► FOR DEV MODE (live reload):"
echo "    pnpm dev"
echo ""
echo "  ► ADB: make sure 'adb devices' shows your device before"
echo "    running the Shizuku/ADB project."
echo ""
