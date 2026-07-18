// AI Helper — Project definitions + TOOL_PLAN_JSON templates
export type DestructiveMode = 'A' | 'B'
export type ProjectCategory = 'system' | 'maintenance' | 'watchdog' | 'android'
export type OnFailure = 'stop_and_report' | 'continue'

export interface PrecheckStep {
  step_id: string
  type: 'precheck'
  action: string
  expected: string
  timeout_seconds?: number
}

export interface ToolStep {
  step_id: string
  type: 'tool'
  tool_name: string
  command: string
  params: Record<string, string>
  expected_result: string
  timeout_seconds: number
  destructive?: boolean
  rollback_cmd?: string
}

export type PlanStep = PrecheckStep | ToolStep

export interface ToolPlan {
  project_name: string
  goal: string
  assumptions: string[]
  default_destructive_mode: DestructiveMode
  prechecks: PrecheckStep[]
  steps: ToolStep[]
  stop_conditions: string[]
  failure_policy: {
    max_retries_per_step: number
    on_failure: OnFailure
    report_contains: string[]
  }
  idempotency_notes: string[]
}

export interface Project {
  id: string
  name: string
  description: string
  category: ProjectCategory
  script_path: string
  plan: ToolPlan
  schedule?: string
}

// Plans
const bootSetupPlan: ToolPlan = {
  project_name: 'Boot Setup',
  goal: 'Verify system boot state, check critical services, and log startup status',
  assumptions: ['Linux (Crostini) is running', 'User home directory is accessible', '~/ai-helper/ initialized via setup.sh'],
  default_destructive_mode: 'B',
  prechecks: [
    { step_id: 'pc1', type: 'precheck', action: 'uname -a', expected: 'Linux kernel info returned' },
    { step_id: 'pc2', type: 'precheck', action: 'test -d ~/ai-helper && echo "OK" || echo "MISSING"', expected: 'OK' },
    { step_id: 'pc3', type: 'precheck', action: 'test -f ~/ai-helper/scripts/boot_dispatcher.sh && echo "OK" || echo "MISSING"', expected: 'OK' },
  ],
  steps: [
    { step_id: 's1', type: 'tool', tool_name: 'network_check', command: 'ping -c 1 -W 3 8.8.8.8 && echo "NETWORK_UP" || echo "NETWORK_DOWN"', params: { target: '8.8.8.8' }, expected_result: 'NETWORK_UP', timeout_seconds: 10 },
    { step_id: 's2', type: 'tool', tool_name: 'service_status', command: 'systemctl --user list-units --state=failed --no-legend 2>/dev/null | head -20 || echo "NO_FAILED_UNITS"', params: {}, expected_result: 'NO_FAILED_UNITS or list', timeout_seconds: 10 },
    { step_id: 's3', type: 'tool', tool_name: 'boot_dispatcher', command: 'bash ~/ai-helper/scripts/boot_dispatcher.sh', params: { log_path: '~/ai-helper/logs/boot.log' }, expected_result: 'Boot dispatch complete', timeout_seconds: 30 },
    { step_id: 's4', type: 'tool', tool_name: 'log_summary', command: 'tail -20 ~/ai-helper/logs/boot.log 2>/dev/null || echo "No boot log yet"', params: {}, expected_result: 'Last 20 lines of boot log', timeout_seconds: 5 },
  ],
  stop_conditions: ['pc2 returns MISSING — run setup.sh first', 'pc3 returns MISSING — run setup.sh first'],
  failure_policy: { max_retries_per_step: 1, on_failure: 'stop_and_report', report_contains: ['step_id', 'error_summary', 'suggested_next_action'] },
  idempotency_notes: ['Boot dispatcher is idempotent — safe to run multiple times', 'Logs append with timestamp'],
}

const dailyMaintenancePlan: ToolPlan = {
  project_name: 'Daily Maintenance',
  goal: 'Clean temp files, check for system updates, rotate logs, report disk health',
  assumptions: ['apt available (Debian/Ubuntu Crostini)', 'Mode B — only ~/ai-helper/tmp/ purged', 'Log rotation keeps 30 days'],
  default_destructive_mode: 'B',
  prechecks: [
    { step_id: 'pc1', type: 'precheck', action: 'df -h / | tail -1', expected: 'Disk usage returned' },
    { step_id: 'pc2', type: 'precheck', action: 'which apt-get && echo "APT_OK" || echo "APT_MISSING"', expected: 'APT_OK' },
  ],
  steps: [
    { step_id: 's1', type: 'tool', tool_name: 'disk_report', command: 'df -h', params: {}, expected_result: 'All mounted filesystems', timeout_seconds: 5 },
    { step_id: 's2', type: 'tool', tool_name: 'apt_update_check', command: 'apt-get update -qq 2>&1 | tail -5 && apt list --upgradable 2>/dev/null | head -20', params: {}, expected_result: 'Update index + upgradable packages', timeout_seconds: 60 },
    { step_id: 's3', type: 'tool', tool_name: 'temp_purge', command: 'rm -rf ~/ai-helper/tmp/* 2>/dev/null; echo "TEMP_PURGE_DONE"', params: { target: '~/ai-helper/tmp/', safe_mode: 'B' }, expected_result: 'TEMP_PURGE_DONE', timeout_seconds: 15, destructive: true, rollback_cmd: 'echo "Temp purge only — no rollback"' },
    { step_id: 's4', type: 'tool', tool_name: 'log_rotation', command: 'bash ~/ai-helper/scripts/maintenance_daily.sh rotate_logs', params: { keep_days: '30' }, expected_result: 'Old logs archived', timeout_seconds: 20 },
    { step_id: 's5', type: 'tool', tool_name: 'maintenance_report', command: 'bash ~/ai-helper/scripts/maintenance_daily.sh report', params: {}, expected_result: 'Report written', timeout_seconds: 15 },
  ],
  stop_conditions: ['Disk > 95% — alert, do not delete', 'apt-get update fails 2x — skip s2'],
  failure_policy: { max_retries_per_step: 1, on_failure: 'stop_and_report', report_contains: ['step_id', 'error_summary', 'suggested_next_action'] },
  idempotency_notes: ['apt-get update idempotent', 'temp purge on empty dir is safe', 'log rotation checks dates first'],
}

const watchdogLitePlan: ToolPlan = {
  project_name: 'Watchdog Lite',
  goal: 'Monitor CPU/RAM/disk/network, detect anomalies, auto-heal AI Helper service if down',
  assumptions: ['systemd --user available', 'ping available', 'ai-helper.service installed'],
  default_destructive_mode: 'B',
  prechecks: [
    { step_id: 'pc1', type: 'precheck', action: 'systemctl --user is-active ai-helper.service 2>/dev/null || echo "NOT_MANAGED"', expected: 'active or NOT_MANAGED' },
  ],
  steps: [
    { step_id: 's1', type: 'tool', tool_name: 'cpu_check', command: "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1 || uptime", params: { threshold: '85' }, expected_result: 'CPU usage', timeout_seconds: 10 },
    { step_id: 's2', type: 'tool', tool_name: 'ram_check', command: "free -m | awk 'NR==2{printf \"USED=%s TOTAL=%s PCT=%.1f%%\\n\",$3,$2,$3*100/$2}'", params: { warn_pct: '85' }, expected_result: 'RAM stats', timeout_seconds: 5 },
    { step_id: 's3', type: 'tool', tool_name: 'disk_check', command: "df -h / | awk 'NR==2{print $5\" used of \"$2\" on \"$1}'", params: { warn_pct: '90' }, expected_result: 'Root disk usage', timeout_seconds: 5 },
    { step_id: 's4', type: 'tool', tool_name: 'network_check', command: 'ping -c 2 -W 3 8.8.8.8 2>&1 | tail -3', params: { host: '8.8.8.8' }, expected_result: 'Packet loss + latency', timeout_seconds: 15 },
    { step_id: 's5', type: 'tool', tool_name: 'service_self_heal', command: 'bash ~/ai-helper/scripts/watchdog_lite.sh self_heal', params: { service: 'ai-helper.service' }, expected_result: 'Service healthy or restarted', timeout_seconds: 20 },
    { step_id: 's6', type: 'tool', tool_name: 'anomaly_report', command: 'bash ~/ai-helper/scripts/watchdog_lite.sh report', params: { log_path: '~/ai-helper/logs/watchdog.log' }, expected_result: 'Report appended', timeout_seconds: 10 },
  ],
  stop_conditions: ['Disk > 95% — immediate alert', 'RAM > 95% — skip non-critical', 'Network unreachable — log and continue'],
  failure_policy: { max_retries_per_step: 1, on_failure: 'continue', report_contains: ['step_id', 'error_summary', 'suggested_next_action'] },
  idempotency_notes: ['All health checks are read-only', 'Self-heal only restarts if actually down', 'Report appends with timestamp'],
}

const shizukuAdbPlan: ToolPlan = {
  project_name: 'Shizuku / ADB Automation',
  goal: 'Verify ADB + Shizuku, pull device/battery/screen info, run automation stubs',
  assumptions: ['adb installed in Linux container', 'Shizuku app running on Android side', 'ADB debugging enabled'],
  default_destructive_mode: 'B',
  prechecks: [
    { step_id: 'pc1', type: 'precheck', action: 'which adb && echo "ADB_OK" || echo "ADB_MISSING"', expected: 'ADB_OK' },
    { step_id: 'pc2', type: 'precheck', action: 'adb devices 2>&1 | head -5', expected: 'At least one device' },
  ],
  steps: [
    { step_id: 's1', type: 'tool', tool_name: 'adb_device_info', command: 'adb shell getprop ro.build.version.release && adb shell getprop ro.product.model', params: {}, expected_result: 'Android version + model', timeout_seconds: 10 },
    { step_id: 's2', type: 'tool', tool_name: 'battery_status', command: "adb shell dumpsys battery | grep -E 'level|status|health|voltage'", params: {}, expected_result: 'Battery stats', timeout_seconds: 10 },
    { step_id: 's3', type: 'tool', tool_name: 'screen_state', command: "adb shell dumpsys power | grep -E 'mWakefulness|mScreenOn|Display Power'", params: {}, expected_result: 'Screen power state', timeout_seconds: 10 },
    { step_id: 's4', type: 'tool', tool_name: 'shizuku_check', command: 'adb shell pm list packages | grep -i shizuku | head -5', params: {}, expected_result: 'Shizuku package', timeout_seconds: 10 },
    { step_id: 's5', type: 'tool', tool_name: 'shizuku_binder', command: "adb shell service list 2>/dev/null | grep -i shizuku | head -5 || echo 'SHIZUKU_NOT_LISTED'", params: {}, expected_result: 'Binder service or NOT_LISTED', timeout_seconds: 15 },
    { step_id: 's6', type: 'tool', tool_name: 'shizuku_automation_stub', command: 'bash ~/ai-helper/scripts/shizuku_runner.sh run_automation', params: { mode: 'stub', task: 'health_check' }, expected_result: 'Automation stub executed', timeout_seconds: 30 },
  ],
  stop_conditions: ['pc1 ADB_MISSING — sudo apt-get install -y adb', 'pc2 no devices — enable ADB or adb connect <ip>', 'Shizuku not running — open app and start service'],
  failure_policy: { max_retries_per_step: 1, on_failure: 'stop_and_report', report_contains: ['step_id', 'error_summary', 'suggested_next_action'] },
  idempotency_notes: ['All adb commands read-only', 'Shizuku stub safe to run repeatedly'],
}

export const PROJECTS: Project[] = [
  { id: 'boot-setup', name: 'Boot Setup', description: 'Boot dispatcher run + status log. Verifies network, checks failed services, dispatches startup tasks.', category: 'system', script_path: '~/ai-helper/scripts/boot_dispatcher.sh', plan: bootSetupPlan },
  { id: 'daily-maintenance', name: 'Daily Maintenance', description: 'Run maintenance_daily + log summary. Disk report, apt update check, temp purge, log rotation.', category: 'maintenance', script_path: '~/ai-helper/scripts/maintenance_daily.sh', plan: dailyMaintenancePlan, schedule: '0 3 * * *' },
  { id: 'watchdog-lite', name: 'Watchdog Lite', description: 'Run watchdog_lite on schedule + log summary. CPU/RAM/disk/network health + self-heal.', category: 'watchdog', script_path: '~/ai-helper/scripts/watchdog_lite.sh', plan: watchdogLitePlan, schedule: '*/15 * * * *' },
  { id: 'shizuku-adb', name: 'Shizuku / ADB', description: 'Full Shizuku + ADB automation. Device info, battery, screen state, Shizuku binder + automation stubs.', category: 'android', script_path: '~/ai-helper/scripts/shizuku_runner.sh', plan: shizukuAdbPlan },
]

export function getProject(id: string): Project | undefined {
  return PROJECTS.find(p => p.id === id)
}

export const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  system: 'SYSTEM', maintenance: 'MAINT', watchdog: 'WATCH', android: 'ANDROID',
}

export const CATEGORY_COLORS: Record<ProjectCategory, string> = {
  system: '#33FF33', maintenance: '#FFB000', watchdog: '#00BFFF', android: '#FF6B6B',
}
