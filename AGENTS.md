# 🤖 AGENTS.md – Operational Guide & AI Agent Knowledge Base
## Repository: `DB-Stock-Bot-Reminder` (DStock Dashboard & Management System)

---

## 1. Project Overview & Mission

This repository powers **DStock**, an enterprise-grade inventory monitoring, tofu frying batch tracker, automated WhatsApp reporting bot, and operational logging system for **Tahunya Krispi-ya!** (`tahunyakrispiya.my.id`).

### Primary Endpoints & Environments:
- **Production URL**: `https://dstock.tahunyakrispiya.my.id/`
- **Main Website**: `https://tahunyakrispiya.my.id/`
- **Cloudflare Worker Service**: `dstock-dashboard`
- **Custom Domain Routing**: `dstock.tahunyakrispiya.my.id` (Managed via Cloudflare Zone)
- **Backend Data Provider**: Google Apps Script (GAS) Web App connected to Google Sheets.

---

## 2. Directory Structure & File Map

```
c:\DB-Stock-Bot-Reminder\
├── .wrangler/                  # Wrangler cache and local runtime artifacts
├── Data/                       # Local cached/sample data (Data.json)
├── Images/                     # Product catalog imagery for inventory items
├── scripts/
│   └── build-worker-assets.ps1 # PowerShell build script copying static assets to dist/public
├── src/
│   └── index.js                # Cloudflare Worker router, proxy, WhatsApp bot, Gemini AI logic
├── dist/                       # Build output directory (generated on build)
│   └── public/                 # Static assets directory served by Cloudflare Workers
│       ├── index.html
│       └── Images/
├── Database Stock.xlsx         # Master Excel reference template for spreadsheet structure
├── index.html                  # Core single-page application (SPA) dashboard
├── kode.gs                     # Google Apps Script source code for Google Sheets integration
├── package.json                # NPM configuration, scripts, and dev dependencies (wrangler)
├── package-lock.json           # NPM dependency lockfile
├── PRD.md                      # Comprehensive Product Requirements Document
├── AGENTS.md                   # AI Agent guidance, contracts, formulas, and operational rules
├── README.md                   # Human-facing onboarding and quick setup documentation
└── wrangler.jsonc              # Cloudflare Workers configuration file
```

---

## 3. Technology Stack Breakdown

| Layer | Technologies / Libraries |
|---|---|
| **Client Frontend** | Vanilla HTML5, Vanilla JavaScript (ES6+), Tailwind CSS (CDN), jQuery 3.7.1, DataTables 2.0.8, Chart.js 4.4.1, Day.js 1.x |
| **Edge Compute** | Cloudflare Workers (ES Modules format), Cloudflare Worker Static Assets (`ASSETS` binding) |
| **Storage & Database** | Google Sheets (`Sheet2`, `Main`, `Log_Sisa_Tahu`), Cloudflare R2 (`dstock-logs` bucket) |
| **Integration Middleware** | Google Apps Script (V8 Engine), Fonnte WhatsApp API Gateway, Google Gemini Flash API |
| **Tooling & Build** | Wrangler CLI v4+, PowerShell v5.1+ (`build-worker-assets.ps1`) |

---

## 4. Core Domain Constants & Mathematical Formulas

> [!IMPORTANT]
> **NEVER MODIFY OR DEVIATE FROM THESE CORE BUSINESS FORMULAS WITHOUT EXPLICIT USER INSTRUCTION.**

### 4.1 Tofu Volume & Batch Calculation
- **Papan Constant**:
  $$1\text{ Papan Tahu Mentah} = 121\text{ pcs}$$
- **Total Tahu Awal Hari Ini**:
  $$\text{Total Awal (pcs)} = (\text{Tahu Mentah (Papan)} \times 121) + \text{Tahu Tambahan (Pcs)}$$
- **Tahu Terjual (Gorengan)**:
  - Mode A (Manual sisa terisi di Sheet/Input):
    $$\text{Tahu Terjual} = \text{Total Awal} - \text{Sisa Tahu}$$
  - Mode B (Dihitung dari pola gorengan):
    $$\text{Tahu Terjual} = \sum_{i=1}^{\text{Gorengan Selesai}} \text{PolaGoreng}[i]$$
- **Sisa Tahu Hari Ini**:
  $$\text{Sisa Tahu (pcs)} = \text{Total Awal} - \text{Tahu Terjual}$$
- **Total Prediksi Tahu Besok**:
  $$\text{Total Besok (pcs)} = (\text{Tahu Besok (Papan)} \times 121) + \text{Sisa Tahu Hari Ini}$$

### 4.2 Sisa Tahu Alert Classification Thresholds
Sebagai bahan makanan yang mudah basi dan beresiko kerugian jika tersisa banyak di akhir hari:
- $\text{Sisa Tahu} \le 50\text{ pcs} \implies \textbf{Aman (🟢)}$ *(Habis/laris terjual, minim resiko basi)*
- $50 < \text{Sisa Tahu} \le 121\text{ pcs} \implies \textbf{Waspada (🟡)}$ *(Tersisa sekitar 1 papan, perlu dioptimalkan esok)*
- $\text{Sisa Tahu} > 121\text{ pcs} \implies \textbf{Bahaya (🔴)}$ *(Tersisa banyak / 200an pcs, resiko basi & rugi operasional tinggi)*

### 4.3 General Inventory Item Stock Thresholds (`RULES`)
```javascript
const RULES = {
  PAC1:    { unit: "pack",   aman: 5,   waspada: 3,  bahaya: 1 },
  PAC2:    { unit: "pack",   aman: 10,  waspada: 5,  bahaya: 2 },
  PAC3:    { unit: "pack",   aman: 7,   waspada: 4,  bahaya: 2 },
  pack:    { unit: "pack",   aman: 2,   waspada: 1,  bahaya: 0 },
  kantong: { unit: "kantong",aman: 2,   waspada: 1,  bahaya: 0 },
  ml:      { unit: "ml",     aman: 200, waspada: 90, bahaya: 30 },
  sheets:  { unit: "sheets", aman: 80,  waspada: 40, bahaya: 30 },
  pcs:     { unit: "pcs",    aman: 30,  waspada: 20, bahaya: 10 }
};
```
*Heuristic Overrides in `formatLaporan`:*
- `Kardus Size L` with quantity $\le 6 \implies \text{Bahaya}$
- `Thinwall` with quantity $1 - 4 \implies \text{Waspada}$
- `Kardus Size M` with quantity $1 - 12 \implies \text{Waspada}$
- `Plastik Sampah` or `Plastik Pagoda` with quantity $\le 1 \implies \text{Waspada}$

---

## 5. Environment Variables & Cloudflare Secrets

The following environment variables and secrets must be configured for the Cloudflare Worker:

| Variable Name | Type | Description | How to Configure |
|---|---|---|---|
| `GAS_URL` | **Secret** | The `/exec` Web App URL from deployed Google Apps Script | `npx wrangler secret put GAS_URL` |
| `FONNTE_TOKEN` | **Secret** | API device authentication token from `fonnte.com` | `npx wrangler secret put FONNTE_TOKEN` |
| `GEMINI_API_KEY` | **Secret** | Google Generative AI API key for the Gemini model | `npx wrangler secret put GEMINI_API_KEY` |
| `WEBHOOK_SECRET` | **Secret** | Optional security token appended to `/webhook/wa?secret=...` | `npx wrangler secret put WEBHOOK_SECRET` |
| `WA_ADMIN_NUMBERS` | **Var / Secret** | Comma-separated list of admin phone numbers (e.g. `6285864917815,62812...`) or `*` for all | Defined in `wrangler.jsonc` under `vars` or via secret |
| `LOGS_BUCKET` | **R2 Binding** | Cloudflare R2 Bucket binding for saving historical JSON logs | Bound in `wrangler.jsonc` under `r2_buckets` |

---

## 6. System Contracts & API Interfaces

### 6.1 Google Apps Script (`kode.gs`) Contract

#### `doGet()` Response:
```json
{
  "lastUpdated": "2026-09-02T15:30:00.000Z",
  "data": [
    {
      "Gambar": "Images/cup_thinwall.jpg",
      "ID": "PAC1",
      "Barang": "Cup Thinwall 25ml",
      "Tersedia": "5 Pack"
    }
  ],
  "gorengan": {
    "Gorengan Tahu Ini": "8 Goreng",
    "Target Goreng": "10 Goreng",
    "Pola Goreng": "40, 40, 40, 40, 35, 35, 35, 35",
    "Tahu Mentah (Papan)": 3,
    "Tahu Tambahan (Pcs)": 20,
    "Sisa Tahu Hari Ini (Pcs)": 83,
    "Tahu Besok (Papan)": 2
  }
}
```

#### `doPost(e)` Actions Supported:
1. `action: "update_stock"`: Updates stock quantity for a single item in `Sheet2`.
   - Body: `{ "action": "update_stock", "nama": "KNT1", "jumlah": "5 Kantong" }`
   - Returns: `{ "success": true, "item": "Plastik Kantong", "id": "KNT1", "jumlah": "5 Kantong" }`
2. `action: "ai_update"`: Batch updates across both `Sheet2` (inventory items) and `Main` (frying parameters).
   - Body: `{ "action": "ai_update", "updates": [{ "type": "main", "field": "Tahu Besok", "value": 3 }] }`
   - Returns: `{ "success": true, "results": [...] }`
3. `action: "log_sisa_tahu"` *(New Feature for Leftover Logging)*: Appends a historical record row to sheet `Log_Sisa_Tahu`.
   - Body:
     ```json
     {
       "action": "log_sisa_tahu",
       "log": {
         "timestamp": "2026-09-02T22:00:00+07:00",
         "date": "2026-09-02",
         "papan_awal": 3,
         "tahu_tambahan": 20,
         "total_awal": 383,
         "target_goreng": 10,
         "gorengan_selesai": 8,
         "pola_goreng": "40, 40, 40, 40, 35, 35, 35, 35",
         "tahu_terjual": 300,
         "sisa_tahu": 83,
         "sisa_status": "Waspada",
         "papan_besok": 2,
         "total_besok": 325,
         "recorded_by": "6285864917815",
         "notes": "Penjualan ramai"
       }
     }
     ```
   - Returns: `{ "success": true, "row_number": 42 }`
4. `action: "get_sisa_history"` *(New Feature)*: Reads last $N$ records from `Log_Sisa_Tahu`.

---

### 6.2 Cloudflare Worker (`src/index.js`) Routing Contract

| Route | HTTP Method | Handling Logic |
|---|---|---|
| `/` | `GET` | Serves `dist/public/index.html` from `ASSETS` binding. |
| `/pos`, `/kasir` | `GET` | Serves `dist/public/pos.html` Web POS Kasir from `ASSETS` binding. |
| `/login` | `GET` | Serves `dist/public/login.html` from `ASSETS` binding. |
| `/Images/*` | `GET` | Serves static image assets from `dist/public/Images/`. |
| `/api/data` | `GET` | Checks `Sec-Fetch-Mode`. If direct browser navigation $\to$ Returns 403 HTML with countdown redirect. If AJAX/fetch $\to$ Proxies to `GAS_URL`. |
| `/webhook/wa` | `POST` | Validates `?secret=...`, parses Fonnte body, triggers `processBot()`, replies via Fonnte. |
| `/webhook/wa` | `GET` | Health check endpoint, returns `200 OK`. |
| `/api/logs/sisa` | `POST` | Saves daily leftover log to Cloudflare R2 bucket (`dstock-logs`) and calls GAS `log_sisa_tahu`. |
| `/api/logs/sisa` | `GET` | Queries historical leftover logs from R2 bucket or GAS fallback for frontend visualization. |

---

### 6.3 WhatsApp Bot (`/bot`) Command Flow & Parsing

Messages are inspected via `parseBotCommand(message)`:
1. Strips leading `@phone_number` mentions (group chat support).
2. Requires lowercase prefix `/bot`.
3. Commands supported:
   - `/bot help`: Formats complete command menu.
   - `/bot stok [query]`: Searches `Sheet2` inventory by Name or ID.
   - `/bot ringkasan`: Displays frying status summary from `Main`.
   - `/bot laporan`: Generates full formatted daily inventory report.
   - `/bot ai [query]`: Prompts Gemini AI with active stock context; parses optional `ai_action: "update"` JSON code block to execute database changes if caller is admin.
   - `/bot update [id/nama] [qty]`: Verifies admin phone number, updates `Sheet2` item stock.
   - `/bot catatsisa [sisa_pcs] [catatan]`: *(New)* Admin records daily leftover tahu, saving to R2 and Google Sheets.
   - `/bot logsisa [days]`: *(New)* Displays summary of last $N$ days of leftover tahu logs.

---

## 7. Step-by-Step Implementation Guide for Leftover Tofu Logging (R2 + Sheets)

When implementing the leftover logging subsystem, follow this exact sequence:

### Step 1: Configure Cloudflare R2 in `wrangler.jsonc`
Add the `r2_buckets` binding:
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "dstock-dashboard",
  "main": "src/index.js",
  "compatibility_date": "2026-07-20",
  "assets": {
    "directory": "./dist/public",
    "binding": "ASSETS"
  },
  "r2_buckets": [
    {
      "binding": "LOGS_BUCKET",
      "bucket_name": "dstock-logs"
    }
  ],
  "triggers": {
    "crons": ["0 15 * * *"] // 15:00 UTC = 22:00 WIB (Closing time auto-snapshot)
  },
  "routes": [
    {
      "pattern": "dstock.tahunyakrispiya.my.id",
      "custom_domain": true
    }
  ],
  "vars": {
    "WA_ADMIN_NUMBERS": "6285864917815,6281250502920,6281288362512,6289518007805"
  }
}
```

### Step 2: Implement Google Apps Script Handler in `kode.gs`
In `kode.gs`, handle `action === 'log_sisa_tahu'`:
```javascript
if (action === 'log_sisa_tahu') {
  var log = payload.log;
  var sheetLog = ss.getSheetByName("Log_Sisa_Tahu");
  if (!sheetLog) {
    sheetLog = ss.insertSheet("Log_Sisa_Tahu");
    sheetLog.appendRow([
      "Timestamp", "Tanggal", "Papan Awal", "Tahu Tambahan (Pcs)",
      "Total Awal (Pcs)", "Target Goreng", "Gorengan Selesai",
      "Pola Goreng", "Tahu Terjual (Pcs)", "Sisa Tahu (Pcs)",
      "Status Sisa", "Papan Besok", "Total Besok (Pcs)",
      "Pencatat", "Catatan"
    ]);
  }
  sheetLog.appendRow([
    log.timestamp, log.date, log.papan_awal, log.tahu_tambahan,
    log.total_awal, log.target_goreng, log.gorengan_selesai,
    log.pola_goreng, log.tahu_terjual, log.sisa_tahu,
    log.sisa_status, log.papan_besok, log.total_besok,
    log.recorded_by, log.notes || "-"
  ]);
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Step 3: Implement R2 Storage Helpers in `src/index.js`
```javascript
async function saveLogToR2(env, logData) {
  if (!env.LOGS_BUCKET) return false;
  const key = `sisa-tahu/${logData.date}.json`;
  await env.LOGS_BUCKET.put(key, JSON.stringify(logData, null, 2), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { recorded_by: logData.recorded_by, date: logData.date }
  });
  return true;
}

async function getRecentLogsFromR2(env, limit = 7) {
  if (!env.LOGS_BUCKET) return [];
  const list = await env.LOGS_BUCKET.list({ prefix: "sisa-tahu/", limit: 100 });
  // Sort descending by date
  const sortedObjects = list.objects.sort((a, b) => b.key.localeCompare(a.key)).slice(0, limit);
  const results = [];
  for (const obj of sortedObjects) {
    const item = await env.LOGS_BUCKET.get(obj.key);
    if (item) {
      const data = await item.json();
      results.push(data);
    }
  }
  return results;
}
```

### Step 4: Add Scheduled Handler in Worker
```javascript
export default {
  async fetch(request, env, ctx) { ... },
  
  async scheduled(event, env, ctx) {
    // Auto snapshot at 22:00 WIB
    try {
      const data = await fetchGasData(env.GAS_URL);
      const g = data.gorengan || {};
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
      const dateStr = now.toISOString().split("T")[0];
      
      const papanAwal = parseFloat(g['Tahu Mentah (Papan)']) || 0;
      const tambahan = parseFloat(g['Tahu Tambahan (Pcs)']) || 0;
      const sisa = parseFloat(g['Sisa Tahu Hari Ini (Pcs)']) || 0;
      const totalAwal = (papanAwal * 121) + tambahan;
      const terjual = totalAwal - sisa;
      const papanBesok = parseFloat(g['Tahu Besok (Papan)']) || 0;
      const totalBesok = (papanBesok * 121) + sisa;
      const status = sisa > 121 ? 'Bahaya' : sisa > 50 ? 'Waspada' : 'Aman';

      const logPayload = {
        id: `LOG-${dateStr.replace(/-/g, "")}`,
        date: dateStr,
        timestamp: now.toISOString(),
        input_source: "cron_auto",
        recorded_by: "System Cron Scheduler",
        papan_awal: papanAwal,
        tahu_tambahan: tambahan,
        total_awal: totalAwal,
        target_goreng: g['Target Goreng'] || 0,
        gorengan_selesai: g['Gorengan Tahu Ini'] || 0,
        pola_goreng: g['Pola Goreng'] || "",
        tahu_terjual: terjual,
        sisa_tahu: sisa,
        sisa_status: status,
        papan_besok: papanBesok,
        total_besok: totalBesok,
        notes: "Auto-archived at closing time"
      };

      await saveLogToR2(env, logPayload);
      await fetch(env.GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "log_sisa_tahu", log: logPayload })
      });
      console.log(`Successfully auto-archived leftover log for ${dateStr}`);
    } catch (e) {
      console.error("Scheduled cron error:", e);
    }
  }
};
```

---

## 8. Build, Test & Deployment Workflows

### 8.1 Build Static Assets
Static assets must be built into `dist/public` before running or deploying the worker:
```powershell
npm run build
```
*Behind the scenes:* Executes `scripts/build-worker-assets.ps1`, which cleans `dist/`, recreates `dist/public/`, copies `index.html`, and recursively copies `Images/`.

### 8.2 Local Development Server
```powershell
npm run dev
```
Runs `npm run build` and launches `wrangler dev` locally (accessible at `http://localhost:8787`).

### 8.3 Production Deployment
```powershell
npm run deploy
```
Builds assets and deploys to Cloudflare Workers and the custom domain `dstock.tahunyakrispiya.my.id`.

### 8.4 Testing Webhooks & APIs via PowerShell
```powershell
# Test health check
Invoke-RestMethod -Uri "https://dstock.tahunyakrispiya.my.id/webhook/wa" -Method GET

# Simulate WhatsApp Bot command
$body = @{
    sender = "6285864917815"
    message = "/bot ringkasan"
    name = "Tester Rama"
    isgroup = $false
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://dstock.tahunyakrispiya.my.id/webhook/wa" -Method POST -Body $body -ContentType "application/json"
```

---

## 9. Critical Safety Rules & Guidelines for AI Agents

1. **Do Not Expose Private GAS URLs in Frontend**: Never place `GAS_URL` directly in `index.html`. All communication MUST route through `/api/data` or `/api/logs/sisa` via the Cloudflare Worker proxy.
2. **Preserve `Sec-Fetch-Mode` Protection**: Keep the 403 anti-scraping gateway intact so direct browser visits to `/api/data` render the branded alert page rather than exposing raw JSON.
3. **Preserve Papan Formula**: Always remember $1\text{ Papan} = 121\text{ pcs}$. Never change this constant unless explicitly instructed by the business owner.
4. **Admin Whitelist Strictness**: Only numbers in `WA_ADMIN_NUMBERS` (or `*`) are allowed to perform write actions (`/bot update`, `/bot catatsisa`, AI execution).
5. **No Regressions in WhatsApp Generator**: Ensure newline formatting, emoji symbols, and layout of `/bot laporan` and the UI `waPreview` match business standard formatting.
