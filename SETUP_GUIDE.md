# AI Helper — Chromebook Setup Guide

## What you need
- A Chromebook with **Linux (Crostini)** enabled
- Shizuku installed on the Android side (for ADB project)
- ~10 minutes

---

## Part 1 — Enable Linux on ChromeOS (if not already on)

1. Open **Settings** (gear icon, bottom right)
2. Scroll all the way down → click **Advanced**
3. Find **Developers** → **Linux development environment**
4. Click **Turn On** → follow the wizard
5. When done, you'll have a **Terminal** app in your launcher

---

## Part 2 — Run the one-line installer

Open your Linux **Terminal** and paste this entire block, then press Enter:

```bash
cd ~ && curl -fsSL https://YOUR_HOSTED_URL/INSTALL.sh | bash
```

**OR** if you downloaded/transferred the project folder to your Chromebook:

```bash
cd ~/path/to/ai-helper-project
bash INSTALL.sh
```

The installer will:
- Install Node.js 20 (via nvm)
- Install pnpm
- Install ADB
- Create `~/ai-helper/` (runtime: scripts, logs, config)
- Install all 4 automation scripts
- Set up cron jobs (daily maintenance at 3am, watchdog every 15min)
- Set up systemd auto-start service

---

## Part 3 — First run

After the installer finishes:

```bash
# Open a NEW terminal tab (important — so nvm loads)
# Then:
cd ~/ai-helper-app
pnpm build
pnpm start
```

Open **Chrome** → go to `http://localhost:13000`

You should see the AI Helper terminal UI.

---

## Part 4 — Auto-start at boot (optional)

To have AI Helper start automatically every time your Linux container boots:

```bash
systemctl --user enable ai-helper.service
systemctl --user start ai-helper.service

# Check it's running:
systemctl --user status ai-helper.service
```

---

## Part 5 — ADB / Shizuku setup

### On your Chromebook (Android side):
1. Go to **Settings** → **About device** → tap **Build number** 7 times
2. Go to **Developer options** → enable **USB debugging**
3. Install **Shizuku** from Play Store
4. Open Shizuku → tap **Start via ADB** → note the `adb shell` command it shows

### In your Linux Terminal:
```bash
# Check ADB is working
adb devices

# If no device shows:
adb connect localhost:5555
# or connect via the ADB command Shizuku shows you

# Once a device appears, Shizuku project will work
```

---

## Part 6 — Manual install (if curl doesn't work)

If you prefer to install manually step by step:

### Install Node.js
```bash
sudo apt-get update
sudo apt-get install -y curl git wget adb

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

nvm install 20
nvm use 20
nvm alias default 20
node --version   # should say v20.x.x
```

### Install pnpm
```bash
npm install -g pnpm
pnpm --version
```

### Install project dependencies
```bash
cd ~/ai-helper-app   # or wherever you put the project
pnpm install
```

### Initialize runtime directory
```bash
mkdir -p ~/ai-helper/scripts ~/ai-helper/logs ~/ai-helper/tmp ~/ai-helper/logs/archive

# Copy scripts
cp public/scripts/boot_dispatcher.sh ~/ai-helper/scripts/
cp public/scripts/maintenance_daily.sh ~/ai-helper/scripts/
cp public/scripts/watchdog_lite.sh ~/ai-helper/scripts/
cp public/scripts/shizuku_runner.sh ~/ai-helper/scripts/

# Make executable
chmod +x ~/ai-helper/scripts/*.sh
```

### Set up cron
```bash
crontab -e
# Add these two lines:
0 3 * * * bash ~/ai-helper/scripts/maintenance_daily.sh >> ~/ai-helper/logs/maintenance.log 2>&1
*/15 * * * * bash ~/ai-helper/scripts/watchdog_lite.sh >> ~/ai-helper/logs/watchdog.log 2>&1
```

### Start the app
```bash
cd ~/ai-helper-app
pnpm build && pnpm start
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `pnpm: command not found` | Run `source ~/.bashrc` or open a new terminal |
| `node: command not found` | Run `source ~/.bashrc` then `nvm use 20` |
| `adb: command not found` | Run `sudo apt-get install -y adb` |
| Port 13000 already in use | Kill it: `kill $(lsof -t -i:13000)` then restart |
| App won't load after reboot | Run `cd ~/ai-helper-app && pnpm start` or enable systemd service |
| ADB devices shows empty | Enable USB debugging on Android, or run `adb connect localhost:5555` |
| Shizuku project fails | Open Shizuku app → make sure service is started |

---

## File locations

```
~/ai-helper-app/          ← The Next.js app (source + server)
~/ai-helper/              ← Runtime data
  scripts/                ← Your 4 automation bash scripts (edit these!)
  logs/                   ← All run logs (JSON + text)
  tmp/                    ← Safe temp zone (Mode B deletes only here)
  config.json             ← App config (also editable in UI)
~/.config/systemd/user/
  ai-helper.service       ← Auto-start service
```

---

## Expanding your automation

All 4 bash scripts are in `~/ai-helper/scripts/` — open them in any text editor and add your real commands. The app will run whatever is in those scripts via the runner UI.

```bash
# Example: edit the Shizuku script
nano ~/ai-helper/scripts/shizuku_runner.sh
```

The scripts are commented with placeholder sections showing exactly where to add your commands.
