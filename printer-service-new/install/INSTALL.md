# Michotbet PrinterBridge — Cashier Install Guide

Install only two things on each cashier PC:

1. **POS80Setup_20200118.exe** — official thermal printer driver
2. **PrinterBridge** — local print bridge (no Node.js required)

After setup, open **https://admin.michot.bet** and tickets print silently. The admin app talks to **https://api.michot.bet** for tickets/wallet; printing stays on `localhost`.

---

## Quick install (automated)

1. Install **POS80Setup_20200118.exe** and connect the printer via USB
2. Verify the Windows queue name is **POS80** (Settings → Printers)
3. Copy the entire **`dist/`** folder to the cashier PC (USB stick, zip, etc.)
4. Double-click **`Install-PrinterBridge.bat`** in that folder

The installer will:

- Copy files to `C:\Michotbet\PrinterBridge\`
- Write `config.json` with queue name **POS80** and API key `michotbet-local-print-v1`
- Add a hidden auto-start shortcut on Windows login
- Start PrinterBridge and run a health check

**Optional:** set a different queue name from PowerShell:

```powershell
cd install
powershell -ExecutionPolicy Bypass -File install.ps1 -PrinterName POS80
```

---

## Manual install

### Step 1: Install POS80 driver

1. Run `POS80Setup_20200118.exe`
2. Connect the thermal printer via USB
3. Confirm the queue name is **POS80** in Windows Settings → Printers

---

## Step 2: Install PrinterBridge (manual)

1. Create folder: `C:\Michotbet\PrinterBridge\`
2. Copy the **entire contents** of the build `dist/` folder into that directory:
   - `PrinterBridge.exe`
   - `node_modules/` (required — native printer module for optional native RAW path)
   - `config.json`
   - `install/` (optional)
3. Edit `config.json` if needed:

```json
{
  "comPort": "",
  "baudRate": 115200,
  "printerName": "POS80",
  "apiKey": "michotbet-local-print-v1"
}
```

---

## Step 3: Auto-start on login (manual)

### Option A — Hidden startup (no window)

1. Copy `PrinterBridge-hidden.vbs` to `C:\Michotbet\PrinterBridge\`
2. Press `Win + R`, type `shell:startup`, press Enter
3. Create a shortcut to `PrinterBridge-hidden.vbs` in the Startup folder

### Option B — Minimized window

1. Press `Win + R`, type `shell:startup`, press Enter
2. Create a shortcut to `C:\Michotbet\PrinterBridge\PrinterBridge.exe`
3. Right-click shortcut → **Properties** → **Run: Minimized**

---

## Step 4: Verify

```powershell
curl.exe http://127.0.0.1:3005/health
curl.exe -H "X-Printer-Key: michotbet-local-print-v1" http://127.0.0.1:3005/status
```

Then:

1. Log in to Windows (PrinterBridge starts automatically)
2. Open **https://admin.michot.bet** in Chrome or Edge
3. Printer bar should show **Printer Connected (POS80)** or **Printer Offline** if the queue is missing
4. Click **Test Print**, then sell and print a test ticket

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Printer Offline | Install POS80 driver; confirm queue name is **POS80** in `config.json` |
| Local print service unreachable | Ensure `PrinterBridge.exe` is running (Task Manager); try ports 3005–3010 |
| Auth failed | `apiKey` in `config.json` must match admin build `VITE_PRINTER_API_KEY` |
| Wrong printer used | Bridge uses strict queue name match — never falls back to another printer |

---

## Security notes

- PrinterBridge listens on **127.0.0.1:3005–3010 only** — not accessible from other PCs on the network
- API key header `X-Printer-Key` is required for print/status requests
- Default key: `michotbet-local-print-v1` (change only if you rebuild the admin app with matching `VITE_PRINTER_API_KEY`)

---

## For IT / developers

Build the exe from source:

```bash
cd printer-service-new
npm install
npm run build:exe
```

Output: `dist/PrinterBridge.exe` + `dist/config.json` + `dist/install/`

Cashier admin app env (production build):

```
VITE_PRINTER_API_KEY=michotbet-local-print-v1
# optional: VITE_PRINT_SERVICE_URL=http://localhost:3005
```

Remote API (already configured in admin): `https://api.michot.bet/api`
