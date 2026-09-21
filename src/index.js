// DStock – Cloudflare Worker Proxy + WhatsApp Bot (Fonnte)
// Secrets yang dibutuhkan (set via: wrangler secret put <NAMA>):
//   GAS_URL          – URL Google Apps Script Web App (sudah ada)
//   FONNTE_TOKEN     – Token device dari fonnte.com
//   WA_ADMIN_NUMBERS – Nomor WA yang boleh /bot update, pisah koma (contoh: 6281234,6285678)
//                      Isi "*" agar semua nomor bisa update
//   WEBHOOK_SECRET   – String rahasia bebas, ditambahkan ke URL webhook Fonnte

const NOTICE_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>403 – Akses Ditolak | DStock API</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      min-height:100vh;display:flex;align-items:center;justify-content:center;
      font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;
      background:linear-gradient(135deg,#f8fafc 0%,#eef7f4 48%,#fff8ea 100%);
      padding:24px;
    }
    .card{
      background:#fff;border:1px solid #e2e8f0;border-radius:16px;
      box-shadow:0 20px 60px rgba(15,23,42,.1);
      padding:40px 36px;max-width:480px;width:100%;text-align:center;
    }
    .icon{font-size:3rem;margin-bottom:16px}
    .badge{
      display:inline-block;background:#fef3c7;color:#92400e;
      font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
      padding:4px 12px;border-radius:999px;margin-bottom:14px;
    }
    h1{font-size:1.4rem;font-weight:900;color:#0f172a;margin-bottom:10px}
    p{font-size:.9rem;color:#64748b;line-height:1.7;margin-bottom:20px}
    .divider{border:0;border-top:1px solid #f1f5f9;margin:20px 0}
    .contact{
      display:inline-flex;align-items:center;gap:8px;
      background:#0f766e;color:#fff;text-decoration:none;
      font-weight:700;font-size:.88rem;padding:10px 20px;
      border-radius:8px;transition:background .15s;
    }
    .contact:hover{background:#115e59}
    .footer{margin-top:20px;font-size:.72rem;color:#94a3b8}
    .footer a{color:#0f766e;text-decoration:none;font-weight:600}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    </div>
    <div class="badge">403 Akses Ditolak</div>
    <h1>Data Tersimpan di Server Kami</h1>
    <p>
      Endpoint ini bersifat <strong>privat</strong> dan hanya dapat diakses
      melalui aplikasi resmi DStock Dashboard.<br/>
      Jika Anda membutuhkan akses data, silakan hubungi admin.
    </p>
    <hr class="divider"/>
    <a href="mailto:admin@tahunyakrispiya.my.id" class="contact">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
      <span>Hubungi Admin</span>
    </a>
    <div class="footer">
      <p id="countdownText" style="margin-bottom:8px; color:#f59e0b; font-weight:700;">Dialihkan dalam 5 detik...</p>
      DStock Dashboard &middot;
      <a href="https://tahunyakrispiya.my.id/">tahunyakrispiya.my.id</a>
    </div>
  </div>

  <script>
    let timeLeft = 5;
    const el = document.getElementById("countdownText");
    const timer = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(timer);
        window.location.href = "/";
      } else {
        el.innerText = "Dialihkan dalam " + timeLeft + " detik...";
      }
    }, 1000);
  </script>
</body>
</html>`;


// ═══════════════════════════════════════════════════════════════════
//  WHATSAPP BOT – Helper Functions
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse pesan masuk. Hanya proses jika diawali "/bot".
 * Contoh: "/bot update KNT1 5 Kantong" → { cmd: "update", args: ["KNT1","5","Kantong"] }
 */
function parseBotCommand(message) {
  // Hilangkan mention "@628xxx" jika ada di awal (pesan dari grup)
  const cleaned = message.trim().replace(/^@\d+\s*/, '').trim();
  if (!cleaned.toLowerCase().startsWith('/bot')) return null;

  const parts = cleaned.slice(4).trim().split(/\s+/);
  const cmd   = (parts[0] || 'help').toLowerCase();
  const args  = parts.slice(1);
  return { cmd, args };
}

/** Ambil data dari GAS (doGet) */
async function fetchGasData(gasUrl) {
  const res = await fetch(gasUrl, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    cf: { cacheTtl: 0 },
  });
  if (!res.ok) throw new Error(`GAS error: ${res.status}`);
  return res.json();
}

/** Kirim update stok ke GAS (doPost) */
async function postGasUpdate(gasUrl, nama, jumlah) {
  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update_stock', nama, jumlah }),
  });
  if (!res.ok) throw new Error(`GAS POST error: ${res.status}`);
  return res.json();
}

/** Kirim pesan via Fonnte API (form-encoded lebih stabil) */
async function sendWA(token, target, message) {
  const params = new URLSearchParams();
  params.append('target', target);
  params.append('message', message);

  const res = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  return res.json();
}

// ── Format Pesan ─────────────────────────────────────────────────────────────

function formatHelp() {
  return [
    '🤖 *DStock Bot – Daftar Command*',
    '━━━━━━━━━━━━━━━━━━━',
    '',
    '📦 */bot stok*',
    'Lihat semua stok barang',
    '',
    '🔍 */bot stok [nama atau ID]*',
    'Cari stok barang tertentu',
    '_Contoh: /bot stok tahu_',
    '_Contoh: /bot stok KNT1_',
    '',
    '🍟 */bot ringkasan*',
    'Info gorengan hari ini',
    '',
    '📢 */bot laporan*',
    'Generate laporan stok lengkap (Aman/Waspada/Bahaya)',
    '',
    '💾 */bot catatsisa [sisa_pcs] [catatan]*',
    'Simpan sisa tahu hari ini ke Cloudflare R2 _(admin only)_',
    '_Contoh: /bot catatsisa 45 Hujan sore_',
    '_Contoh: /bot catatsisa (auto dari sheet)_',
    '',
    '📅 */bot logsisa [jumlah_hari]*',
    'Lihat riwayat log sisa tahu dari Cloudflare R2',
    '_Contoh: /bot logsisa 5_',
    '',
    '🧠 */bot ai [pertanyaan]*',
    'Tanya AI tentang stok saat ini (butuh GEMINI_API_KEY)',
    '',
    '✏️ */bot update [ID/nama] [jumlah]*',
    'Update stok barang _(admin only)_',
    '_Contoh: /bot update KNT1 5 Kantong_',
    '_Contoh: /bot update plastik dom 3 Kantong_',
    '',
    '━━━━━━━━━━━━━━━━━━━',
    '_DStock by tahunyakrispiya.my.id_',
  ].join('\n');
}

function formatStok(data, filter) {
  let items = data.data || [];

  if (filter) {
    const f = filter.toLowerCase();
    items = items.filter(item =>
      (item['Barang'] || '').toString().toLowerCase().includes(f) ||
      (item['ID']     || '').toString().toLowerCase() === f
    );
  }

  if (items.length === 0) {
    return `❌ Item *"${filter}"* tidak ditemukan.\n\nKetik */bot stok* untuk lihat semua barang.`;
  }

  const tgl = new Date(data.lastUpdated).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const lines = [
    `📦 *STOK ${filter ? filter.toUpperCase() : 'SEMUA BARANG'}*`,
    `🕐 Update: ${tgl} WIB`,
    '━━━━━━━━━━━━━━━━━━━',
  ];

  for (const item of items) {
    const tersedia = (item['Tersedia'] || '0').toString();
    const angka    = parseInt(tersedia) || 0;
    const emoji    = angka <= 0 ? '🔴' : angka <= 3 ? '🟡' : '🟢';
    lines.push(`${emoji} *${item['Barang']}* _(${item['ID']})_`);
    lines.push(`   Stok: ${tersedia}`);
  }

  return lines.join('\n');
}

function formatRingkasan(data) {
  const g = data.gorengan || {};
  return [
    '🍟 *RINGKASAN GORENGAN HARI INI*',
    '━━━━━━━━━━━━━━━━━━━',
    `🍢 Gorengan Tahu    : *${g['Gorengan Tahu Ini']       ?? '-'}*`,
    `🎯 Target Goreng    : ${g['Target Goreng']            ?? '-'}`,
    `📊 Pola Goreng      : ${g['Pola Goreng']              ?? '-'}`,
    '━━━━━━━━━━━━━━━━━━━',
    `🧊 Tahu Mentah      : *${g['Tahu Mentah (Papan)']     ?? 0} papan*`,
    `➕ Tahu Tambahan    : ${g['Tahu Tambahan (Pcs)']      ?? 0} pcs`,
    `📉 Sisa Hari Ini    : ${g['Sisa Tahu Hari Ini (Pcs)'] ?? 0} pcs`,
    `🌅 Tahu Besok       : *${g['Tahu Besok (Papan)']      ?? 0} papan*`,
  ].join('\n');
}

function formatLaporan(data) {
  const g = data.gorengan || {};
  const items = data.data || [];

  const tahuMentahPapan = parseFloat(g['Tahu Mentah (Papan)']) || 0;
  const tahuTambahanPcs = parseFloat(g['Tahu Tambahan (Pcs)']) || 0;
  const sisaHariIni = parseFloat(g['Sisa Tahu Hari Ini (Pcs)']) || 0;
  const tahuBesokPapan = parseFloat(g['Tahu Besok (Papan)']) || 0;

  const totalAwal = (tahuMentahPapan * 121) + tahuTambahanPcs;
  const terjual = totalAwal - sisaHariIni;
  const sisaStatus = sisaHariIni > 121 ? 'Bahaya' : (sisaHariIni > 50 ? 'Waspada' : 'Aman');
  const totalBesok = (tahuBesokPapan * 121) + sisaHariIni;

  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  // Waktu Jakarta
  const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
  const tglStr = `${hari[now.getDay()]} - ${now.getDate()} ${bulan[now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;

  let report = `📢 ${tglStr}\nLaporan Stok Kali Ini:\n\n`;
  report += `--- Status Tambahan ---\n`;
  report += `Status Target Tahu: ${g['Gorengan Tahu Ini'] || 0} / ${g['Target Goreng'] || 0} Goreng (Pola: ${g['Pola Goreng'] || '-'}) \n`;
  report += `📅 TAHU HARI INI: Beli ${tahuMentahPapan} Papan + Tambahan (${tahuTambahanPcs} pcs)\n`;
  report += `📦 Total Awal: ${totalAwal} pcs\n`;
  report += `🔥 Terjual: ${terjual} pcs\n`;
  const sisaIcon = sisaStatus === 'Bahaya' ? '🔴' : sisaStatus === 'Waspada' ? '🟡' : '🟢';
  report += `${sisaIcon} SISA TAHU: ${sisaHariIni} pcs (${sisaStatus})\n\n`;
  report += `🌅 TAHU BESOK: Beli ${tahuBesokPapan} Papan + Sisa Hari Ini (${sisaHariIni})\n`;
  report += `📦 Total Besok: ${totalBesok} pcs\n\n`;

  const mappedItems = items.map(item => {
    const qtyStr = (item['Tersedia'] || '0').toString();
    const val = parseFloat(qtyStr) || 0;
    const unit = qtyStr.replace(/[0-9.]/g, '').trim().toLowerCase();

    let level = 2;
    let label = '🟢 Aman';

    // Heuristics
    if (val <= 0) {
      level = 0; label = '🔴 Bahaya';
    } else if (unit === 'pcs' || unit === 'ml' || unit === 'sheets') {
      if (val <= 10 || (unit === 'ml' && val <= 50)) { level = 0; label = '🔴 Bahaya'; }
      else if (val <= 20 || (unit === 'ml' && val <= 100) || (unit === 'sheets' && val <= 50)) { level = 1; label = '🟡 Waspada'; }
    } else if (unit === 'pack' || unit === 'kantong' || unit === 'roll') {
      if (val <= 1) { level = 1; label = '🟡 Waspada'; }
    } else {
      if (val <= 2) { level = 1; label = '🟡 Waspada'; }
    }

    // Overrides untuk kemiripan dengan template manual
    if (item['Barang'].includes('Kardus Size L') && val <= 6) { level = 0; label = '🔴 Bahaya'; }
    if (item['Barang'].includes('Thinwall') && val > 0 && val <= 4) { level = 1; label = '🟡 Waspada'; }
    if (item['Barang'].includes('Kardus Size M') && val > 0 && val <= 12) { level = 1; label = '🟡 Waspada'; }
    if (item['Barang'].includes('Plastik Sampah') && val <= 1) { level = 1; label = '🟡 Waspada'; }
    if (item['Barang'].includes('Plastik Pagoda') && val <= 1) { level = 1; label = '🟡 Waspada'; }
    if (val === 0) { level = 0; label = '🔴 Bahaya'; }

    return { text: `${item['Barang']} => ${qtyStr} | ${label}`, level };
  });

  mappedItems.sort((a, b) => a.level - b.level);
  mappedItems.forEach((m, idx) => {
    report += `${idx + 1}. ${m.text}\n`;
  });

  report += `\n⚠️ Mohon cek stok yang menipis.\nInfo: https://dstock.tahunyakrispiya.my.id/`;
  return report;
}

// ═══════════════════════════════════════════════════════════════════
//  R2 STORAGE HELPERS (Sisa Tahu History)
// ═══════════════════════════════════════════════════════════════════

/**
 * Menyimpan snapshot log sisa tahu ke Cloudflare R2
 * Key format: sisa-tahu/YYYY-MM-DD.json
 */
async function saveSisaLogToR2(env, logData) {
  if (!env.LOGS_BUCKET) {
    throw new Error("R2 Bucket LOGS_BUCKET belum di-binding di Cloudflare Worker.");
  }
  const dateStr = logData.date || new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })).toISOString().split("T")[0];
  const key = `sisa-tahu/${dateStr}.json`;

  const payload = {
    id: logData.id || `LOG-${dateStr.replace(/-/g, '')}`,
    date: dateStr,
    timestamp: logData.timestamp || new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })).toISOString(),
    input_source: logData.input_source || "manual_dashboard",
    recorded_by: logData.recorded_by || "Admin",
    papan_awal: Number(logData.papan_awal) || 0,
    tahu_tambahan: Number(logData.tahu_tambahan) || 0,
    total_awal: Number(logData.total_awal) || 0,
    target_goreng: Number(logData.target_goreng) || 0,
    gorengan_selesai: Number(logData.gorengan_selesai) || 0,
    pola_goreng: logData.pola_goreng || "",
    tahu_terjual: Number(logData.tahu_terjual) || 0,
    sisa_tahu: Number(logData.sisa_tahu) || 0,
    sisa_status: logData.sisa_status || (logData.sisa_tahu > 121 ? 'Bahaya' : logData.sisa_tahu > 50 ? 'Waspada' : 'Aman'),
    papan_besok: Number(logData.papan_besok) || 0,
    total_besok: Number(logData.total_besok) || 0,
    notes: logData.notes || ""
  };

  await env.LOGS_BUCKET.put(key, JSON.stringify(payload, null, 2), {
    httpMetadata: { contentType: "application/json;charset=UTF-8" },
    customMetadata: {
      date: dateStr,
      recorded_by: payload.recorded_by,
      sisa_tahu: String(payload.sisa_tahu)
    }
  });

  return payload;
}

/**
 * Mengambil daftar seluruh riwayat log sisa tahu dari Cloudflare R2
 */
async function getSisaLogsFromR2(env, limit = 30) {
  if (!env.LOGS_BUCKET) return [];
  const listed = await env.LOGS_BUCKET.list({ prefix: "sisa-tahu/", limit: 100 });
  const objects = (listed.objects || [])
    .filter(obj => obj.key.endsWith('.json'))
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, limit);

  const results = [];
  for (const obj of objects) {
    const item = await env.LOGS_BUCKET.get(obj.key);
    if (item) {
      try {
        const json = await item.json();
        if (json) {
          const sisa = Number(json.sisa_tahu) || 0;
          json.sisa_status = sisa > 121 ? 'Bahaya' : sisa > 50 ? 'Waspada' : 'Aman';
          results.push(json);
        }
      } catch (e) {
        console.error("Error parsing R2 log JSON:", obj.key, e);
      }
    }
  }
  return results;
}

/**
 * Mengambil 1 log sisa tahu berdasarkan tanggal (YYYY-MM-DD)
 */
async function getSisaLogByDate(env, dateStr) {
  if (!env.LOGS_BUCKET) return null;
  const key = `sisa-tahu/${dateStr}.json`;
  const item = await env.LOGS_BUCKET.get(key);
  if (!item) return null;
  const json = await item.json();
  if (json) {
    const sisa = Number(json.sisa_tahu) || 0;
    json.sisa_status = sisa > 121 ? 'Bahaya' : sisa > 50 ? 'Waspada' : 'Aman';
  }
  return json;
}

/**
 * Menghapus log sisa tahu berdasarkan tanggal (YYYY-MM-DD)
 */
async function deleteSisaLogByDate(env, dateStr) {
  if (!env.LOGS_BUCKET) return false;
  const key = `sisa-tahu/${dateStr}.json`;
  await env.LOGS_BUCKET.delete(key);
  return true;
}

async function askGeminiAI(apiKey, data, pertanyaan) {
  if (!apiKey) return { text: "⚠️ Gemini API Key belum diset. Silakan set `GEMINI_API_KEY` di secrets Cloudflare. Ketik: `npx wrangler secret put GEMINI_API_KEY`" };
  
  const stokStr = data.data.map(i => `- ${i.Barang} (${i.ID}): ${i.Tersedia}`).join('\n');
  const g = data.gorengan || {};
  const gorenganStr = `Gorengan Tahu Ini: ${g['Gorengan Tahu Ini']}, Target Goreng: ${g['Target Goreng']}, Pola Goreng: ${g['Pola Goreng']}, Tahu Mentah: ${g['Tahu Mentah (Papan)']} papan, Tambahan: ${g['Tahu Tambahan (Pcs)']} pcs, Sisa: ${g['Sisa Tahu Hari Ini (Pcs)']} pcs, Tahu Besok: ${g['Tahu Besok (Papan)']}`;
  
  const prompt = `Anda adalah asisten AI DStock.
Data Stok:\n${stokStr}
Data Gorengan (Sheet Main):\n${gorenganStr}

Aturan:
1. Jawab ramah dan singkat.
2. Jika user meminta MENGUBAH / UPDATE stok (baik data gorengan maupun barang), kamu HARUS menambahkan sebuah block JSON valid di bagian paling akhir pesanmu dengan format:
\`\`\`json
{
  "ai_action": "update",
  "updates": [
    {"type": "main", "field": "Tahu Besok", "value": 3},
    {"type": "sheet2", "id": "KNT1", "value": "5 Kantong"}
  ]
}
\`\`\`
Type "main" khusus untuk kolom di Data Gorengan. Type "sheet2" untuk Data Stok (gunakan ID barangnya). Pastikan JSON valid.

User: ${pertanyaan}`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!res.ok) throw new Error(`Gemini API Error ${res.status}`);
    const json = await res.json();
    let aiText = json.candidates?.[0]?.content?.parts?.[0]?.text || "Gagal mendapatkan respon.";
    
    // Coba extract JSON block
    let aiAction = null;
    const jsonMatch = aiText.match(/\`\`\`json([\s\S]*?)\`\`\`/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        if (parsed.ai_action) aiAction = parsed;
        // Hapus block json dari text balasan ke user
        aiText = aiText.replace(jsonMatch[0], '').trim();
      } catch (e) {
        console.error("AI JSON Parse Error", e);
      }
    }
    
    return { text: "🤖 " + aiText, action: aiAction };
  } catch(e) {
    return { text: "❌ *Error AI:* " + e.message };
  }
}

// ── Main Bot Processor ───────────────────────────────────────────────────────

async function processBot(body, env) {
  // Field Fonnte: sender, message/pesan, name/pushname, isgroup, device
  const message    = (body.message || body.pesan || '').toString().trim();
  const sender     = (body.sender  || '').toString().trim();
  const isGroup    = body.isgroup === true || body.isgroup === 'true';
  const groupId    = isGroup ? sender : false;  // Fonnte: sender = group ID jika isgroup=true
  const realSender = isGroup ? (body.pengirim || body.member || sender) : sender;
  const senderName = body.name || body.pushname || realSender;

  // Target reply: group ID jika grup, nomor pengirim jika DM
  const target = groupId || realSender;

  const parsed = parseBotCommand(message);
  if (!parsed) return; // Bukan command /bot, abaikan

  const { cmd, args }  = parsed;
  const fonnteToken    = env.FONNTE_TOKEN;
  const gasUrl         = env.GAS_URL;
  const adminRaw       = env.WA_ADMIN_NUMBERS || '';
  const adminNumbers   = adminRaw.split(',').map(n => n.replace(/\D/g, '').trim()).filter(Boolean);

  let replyText = '';

  try {
    if (cmd === 'help') {
      // ── /bot help ──────────────────────────────────────────────
      replyText = formatHelp();

    } else if (cmd === 'stok') {
      // ── /bot stok [opsional: filter] ──────────────────────────
      const filter = args.length ? args.join(' ') : null;
      const data   = await fetchGasData(gasUrl);
      replyText    = formatStok(data, filter);

    } else if (cmd === 'ringkasan') {
      // ── /bot ringkasan ─────────────────────────────────────────
      const data = await fetchGasData(gasUrl);
      replyText  = formatRingkasan(data);

    } else if (cmd === 'laporan') {
      // ── /bot laporan ─────────────────────────────────────────
      const data = await fetchGasData(gasUrl);
      replyText  = formatLaporan(data);

    } else if (cmd === 'catatsisa') {
      // ── /bot catatsisa [sisa_pcs opsional] [catatan opsional] ──
      const senderClean = realSender.replace(/\D/g, '');
      const isAdmin = adminRaw.trim() === '*' || adminNumbers.some(n => n === senderClean);

      if (!isAdmin) {
        replyText = '⛔ *Akses Ditolak*\nHanya admin yang bisa mencatat sisa tahu.';
      } else {
        const data = await fetchGasData(gasUrl);
        const g = data.gorengan || {};
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
        const dateStr = now.toISOString().split("T")[0];

        const papanAwal = parseFloat(g['Tahu Mentah (Papan)']) || 0;
        const tambahan = parseFloat(g['Tahu Tambahan (Pcs)']) || 0;
        const totalAwal = (papanAwal * 121) + tambahan;
        
        let sisaTahu = parseFloat(g['Sisa Tahu Hari Ini (Pcs)']) || 0;
        let notes = '';

        if (args.length > 0) {
          const firstNum = parseFloat(args[0]);
          if (!isNaN(firstNum)) {
            sisaTahu = firstNum;
            notes = args.slice(1).join(' ');
          } else {
            notes = args.join(' ');
          }
        }

        const terjual = Math.max(0, totalAwal - sisaTahu);
        const papanBesok = parseFloat(g['Tahu Besok (Papan)']) || 0;
        const totalBesok = (papanBesok * 121) + sisaTahu;
        const status = sisaTahu > 121 ? 'Bahaya' : sisaTahu > 50 ? 'Waspada' : 'Aman';
        const sisaIcon = status === 'Bahaya' ? '🔴' : status === 'Waspada' ? '🟡' : '🟢';

        const payload = {
          id: `LOG-${dateStr.replace(/-/g, '')}`,
          date: dateStr,
          timestamp: now.toISOString(),
          input_source: "manual_bot",
          recorded_by: `${senderName} (${realSender})`,
          papan_awal: papanAwal,
          tahu_tambahan: tambahan,
          total_awal: totalAwal,
          target_goreng: g['Target Goreng'] || 0,
          gorengan_selesai: g['Gorengan Tahu Ini'] || 0,
          pola_goreng: g['Pola Goreng'] || "",
          tahu_terjual: terjual,
          sisa_tahu: sisaTahu,
          sisa_status: status,
          papan_besok: papanBesok,
          total_besok: totalBesok,
          notes: notes || "Tercatat via WhatsApp Bot"
        };

        await saveSisaLogToR2(env, payload);

        replyText = [
          '✅ *Log Sisa Tahu Berhasil Disimpan ke R2!*',
          '━━━━━━━━━━━━━━━━━━━',
          `📅 Tanggal     : *${dateStr}*`,
          `🧊 Beli Awal   : ${papanAwal} Papan + ${tambahan} pcs (${totalAwal} pcs)`,
          `🔥 Terjual     : ${terjual} pcs`,
          `📉 Sisa Tahu   : *${sisaTahu} pcs* (${sisaIcon} ${status})`,
          `🌅 Rencana Bsk : ${papanBesok} Papan (${totalBesok} pcs)`,
          `📝 Catatan     : ${payload.notes}`,
          `👤 Oleh        : ${senderName}`,
          '━━━━━━━━━━━━━━━━━━━',
          '💾 _Riwayat dapat dipantau di Web Dashboard!_'
        ].join('\n');
      }

    } else if (cmd === 'logsisa') {
      // ── /bot logsisa [jumlah_hari opsional] ───────────────────
      const days = parseInt(args[0]) || 5;
      const logs = await getSisaLogsFromR2(env, days);

      if (logs.length === 0) {
        replyText = '📂 *Belum ada riwayat log sisa tahu di Cloudflare R2.*\nSimpan sisa hari ini dengan */bot catatsisa*.';
      } else {
        const lines = [
          `📅 *RIWAYAT SISA TAHU (${logs.length} Hari Terakhir)*`,
          '━━━━━━━━━━━━━━━━━━━',
        ];

        let totalSisa = 0;
        for (const item of logs) {
          const sisa = Number(item.sisa_tahu) || 0;
          totalSisa += sisa;
          const icon = item.sisa_status === 'Aman' ? '🟢' : item.sisa_status === 'Waspada' ? '🟡' : '🔴';
          lines.push(`• *${item.date}*: Sisa *${sisa} pcs* ${icon} | Terjual: ${item.tahu_terjual || 0} pcs`);
          if (item.notes && item.notes !== '-') {
            lines.push(`  ↳ _"${item.notes}"_`);
          }
        }

        const avg = Math.round(totalSisa / logs.length);
        lines.push('━━━━━━━━━━━━━━━━━━━');
        lines.push(`📊 *Rata-rata Sisa:* ${avg} pcs / hari`);
        lines.push('🌐 https://dstock.tahunyakrispiya.my.id/');
        replyText = lines.join('\n');
      }

    } else if (cmd === 'ai') {
      // ── /bot ai [pertanyaan] ─────────────────────────────────
      if (!args.length) {
        replyText = "⚠️ Format salah! Gunakan: */bot ai [pertanyaan kamu]*\nContoh: */bot ai apa saja barang yang sudah habis?*";
      } else {
        const pertanyaan = args.join(' ');
        const senderClean = realSender.replace(/\D/g, '');
        const isAdmin = adminRaw.trim() === '*' || adminNumbers.some(n => n === senderClean);
        
        const data = await fetchGasData(gasUrl);
        const aiRes = await askGeminiAI(env.GEMINI_API_KEY, data, pertanyaan);
        
        replyText = aiRes.text;
        
        // Eksekusi jika ada action update dari AI
        if (aiRes.action && aiRes.action.ai_action === 'update') {
          if (!isAdmin) {
            replyText += "\n\n⛔ *AI mencoba mengupdate stok, tetapi Anda bukan Admin!*";
          } else {
            // Post ke GAS dengan action 'ai_update'
            const updateRes = await fetch(gasUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'ai_update', updates: aiRes.action.updates }),
            });
            const updateJson = await updateRes.json();
            if (updateJson.success) {
              replyText += "\n\n✅ *AI Berhasil Mengupdate Database!*";
            } else {
              replyText += "\n\n❌ *AI Gagal Mengupdate:* " + (updateJson.error || 'Unknown error');
            }
          }
        }
      }

    } else if (cmd === 'update') {
      // ── /bot update [nama/ID] [jumlah baru] ────────────────────
      const senderClean = realSender.replace(/\D/g, '');
      const isAdmin     = adminRaw.trim() === '*' ||
                          adminNumbers.some(n => n === senderClean);

      if (!isAdmin) {
        replyText = [
          '⛔ *Akses Ditolak*',
          'Hanya admin yang bisa menggunakan perintah update stok.',
        ].join('\n');

      } else if (args.length < 2) {
        replyText = [
          '⚠️ *Format salah!*',
          'Gunakan: */bot update [ID atau nama] [jumlah baru]*',
          '',
          '_Contoh:_',
          '/bot update KNT1 5 Kantong',
          '/bot update plastik dom 3 Kantong',
          '',
          'Lihat ID dengan: */bot stok*',
        ].join('\n');

      } else {
        // args[0] = ID/nama, args[1..] = nilai jumlah baru
        const namaOrId = args[0];
        const jumlah   = args.slice(1).join(' ');
        const result   = await postGasUpdate(gasUrl, namaOrId, jumlah);

        if (result.success) {
          replyText = [
            '✅ *Stok Berhasil Diupdate!*',
            '━━━━━━━━━━━━━━━━━━━',
            `📦 Item  : *${result.item}*`,
            `🆔 ID    : ${result.id}`,
            `📊 Stok  : *${result.jumlah}*`,
            `👤 Oleh  : ${senderName}`,
          ].join('\n');
        } else {
          replyText = [
            '❌ *Gagal Update Stok*',
            result.error || 'Unknown error',
            '',
            'Cek nama/ID barang dengan: */bot stok*',
          ].join('\n');
        }
      }

    } else {
      replyText = `❓ Command */${cmd}* tidak dikenal.\nKetik */bot help* untuk daftar command.`;
    }

  } catch (err) {
    replyText = `⚠️ *Terjadi Error*\n${err.message}`;
  }

  // Kirim balasan – bungkus dalam try/catch agar error tidak silent
  try {
    if (replyText && fonnteToken && target) {
      await sendWA(fonnteToken, target, replyText);
    }
  } catch (sendErr) {
    // Log error ke console (tampil di Cloudflare Logs)
    console.error('sendWA error:', sendErr.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  AUTHENTICATION & SECURITY HELPERS (Web Crypto HMAC-SHA256)
// ═══════════════════════════════════════════════════════════════════

function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return atob(base64);
}

async function getHmacKey(secret) {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function createAuthToken(payload, secret) {
  const enc = new TextEncoder();
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const key = await getHmacKey(secret);
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${data}.${sig}`;
}

async function verifyAuthToken(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  try {
    const key = await getHmacKey(secret);
    const enc = new TextEncoder();
    const data = `${header}.${body}`;
    
    const binarySig = base64UrlDecode(sig);
    const sigBytes = new Uint8Array(binarySig.length);
    for (let i = 0; i < binarySig.length; i++) {
      sigBytes[i] = binarySig.charCodeAt(i);
    }

    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(data));
    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecode(body));
    if (payload.exp && Date.now() > payload.exp) return null; // expired
    return payload;
  } catch (e) {
    return null;
  }
}

async function checkAdminRequest(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  let token = "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else {
    token = request.headers.get("X-Admin-Token") || "";
  }
  if (!token) return null;
  const authSecret = env.ADMIN_SECRET || env.ADMIN_PASSWORD || env.WEBHOOK_SECRET || "dstock-secret-2026";
  return await verifyAuthToken(token, authSecret);
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN FETCH HANDLER
// ═══════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── Handle CORS Preflight ─────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret, X-Admin-Token",
        },
      });
    }

    // ── Route /pos & /kasir → Sajikan pos.html ───────────────────
    if (url.pathname === "/pos" || url.pathname === "/kasir") {
      const posUrl = new URL("/pos.html", request.url);
      return env.ASSETS.fetch(new Request(posUrl, request));
    }

    // ── Route /login → Sajikan login.html ─────────────────────────
    if (url.pathname === "/login") {
      const loginUrl = new URL("/login.html", request.url);
      return env.ASSETS.fetch(new Request(loginUrl, request));
    }

    // ── Route /logout → Redirect ke /?logout=true ──────────────────
    if (url.pathname === "/logout") {
      return Response.redirect(new URL("/?logout=true", request.url).toString(), 302);
    }

    // ── Route /api/auth/login ─────────────────────────────────────
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      try {
        let body = {};
        try { body = await request.json(); } catch {}
        const password = (body.password || "").trim();
        const username = (body.username || "admin").trim();
        const expectedPass = (env.ADMIN_PASSWORD || "admin123").trim();

        if (!password || password !== expectedPass) {
          return new Response(JSON.stringify({ success: false, error: "Username atau password salah." }), {
            status: 401,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        const authSecret = env.ADMIN_SECRET || env.ADMIN_PASSWORD || env.WEBHOOK_SECRET || "dstock-secret-2026";
        const payload = {
          user: username,
          role: "admin",
          exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 hari
        };
        const token = await createAuthToken(payload, authSecret);
        return new Response(JSON.stringify({ success: true, token, user: username }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // ── Route /api/auth/me (Cek status login) ─────────────────────
    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      const user = await checkAdminRequest(request, env);
      return new Response(JSON.stringify({
        authenticated: !!user,
        user: user ? user.user : null
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store"
        }
      });
    }

    // ── Route /api/stock/update (Update Google Sheets via GAS) ────
    if (url.pathname === "/api/stock/update" && request.method === "POST") {
      const user = await checkAdminRequest(request, env);
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: "Akses ditolak: Login admin diperlukan untuk mengubah database stok." }), {
          status: 401,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      try {
        const body = await request.json();
        const gasUrl = env.GAS_URL;
        if (!gasUrl) {
          return new Response(JSON.stringify({ success: false, error: "GAS_URL belum dikonfigurasi." }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        if (body.action === "ai_update" || body.updates) {
          const res = await fetch(gasUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "ai_update", updates: body.updates })
          });
          const json = await res.json();
          return new Response(JSON.stringify(json), {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        } else {
          const idOrNama = body.id || body.nama;
          const jumlah = body.jumlah;
          if (!idOrNama || !jumlah) {
            return new Response(JSON.stringify({ success: false, error: "Parameter id/nama dan jumlah wajib diisi." }), {
              status: 400,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
          }
          const res = await postGasUpdate(gasUrl, idOrNama, jumlah);
          return new Response(JSON.stringify(res), {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // ── Handle /webhook/wa (Fonnte WhatsApp Bot) ──────────────────
    if (url.pathname === '/webhook/wa') {
      if (request.method === 'POST') {
        const secret = url.searchParams.get('secret');
        if (env.WEBHOOK_SECRET && secret !== env.WEBHOOK_SECRET) {
          return new Response('Unauthorized', { status: 401 });
        }

        let body;
        try { body = await request.json(); }
        catch { return new Response('Bad Request', { status: 400 }); }

        try { await processBot(body, env); } catch (e) { console.error('Bot error:', e); }
        return new Response('OK', { status: 200 });
      }

      return new Response('🤖 DStock WhatsApp Bot is running!', { status: 200 });
    }

    // ── Handle /api/logs/sisa (Cloudflare R2 Leftover Tofu Logs) ───
    if (url.pathname === "/api/logs/sisa") {
      // 1. GET: Ambil daftar log riwayat atau 1 log spesifik
      if (request.method === "GET") {
        try {
          const dateParam = url.searchParams.get("date");
          if (dateParam) {
            const singleLog = await getSisaLogByDate(env, dateParam);
            if (!singleLog) {
              return new Response(JSON.stringify({ success: false, error: "Log tanggal tidak ditemukan" }), {
                status: 404,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
              });
            }
            return new Response(JSON.stringify({ success: true, data: singleLog }), {
              status: 200,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
          }

          const limit = parseInt(url.searchParams.get("limit")) || 30;
          const logs = await getSisaLogsFromR2(env, limit);
          return new Response(JSON.stringify({ success: true, count: logs.length, data: logs }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-store"
            }
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
      }

      // 2. POST: Simpan / update log manual ke R2 (Protected: Admin Only)
      if (request.method === "POST") {
        const adminUser = await checkAdminRequest(request, env);
        if (!adminUser) {
          return new Response(JSON.stringify({ success: false, error: "Akses ditolak: Login admin diperlukan untuk menyimpan log." }), {
            status: 401,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        try {
          let body = {};
          try { body = await request.json(); } catch {}

          // Jika data parsial, ambil info gorengan dari GAS
          let dataGoreng = {};
          if (env.GAS_URL && (!body.total_awal || body.papan_awal === undefined)) {
            try {
              const gasRes = await fetchGasData(env.GAS_URL);
              dataGoreng = gasRes.gorengan || {};
            } catch (errGas) {
              console.warn("GAS fetch fallback error:", errGas);
            }
          }

          const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
          const dateStr = body.date || now.toISOString().split("T")[0];

          const papanAwal = body.papan_awal !== undefined ? Number(body.papan_awal) : (parseFloat(dataGoreng['Tahu Mentah (Papan)']) || 2);
          const tambahan = body.tahu_tambahan !== undefined ? Number(body.tahu_tambahan) : (parseFloat(dataGoreng['Tahu Tambahan (Pcs)']) || 0);
          const totalAwal = body.total_awal !== undefined ? Number(body.total_awal) : ((papanAwal * 121) + tambahan);
          
          let sisaTahu = body.sisa_tahu !== undefined ? Number(body.sisa_tahu) : (parseFloat(dataGoreng['Sisa Tahu Hari Ini (Pcs)']) || 0);
          const terjual = body.tahu_terjual !== undefined ? Number(body.tahu_terjual) : Math.max(0, totalAwal - sisaTahu);
          const papanBesok = body.papan_besok !== undefined ? Number(body.papan_besok) : (parseFloat(dataGoreng['Tahu Besok (Papan)']) || 2);
          const totalBesok = body.total_besok !== undefined ? Number(body.total_besok) : ((papanBesok * 121) + sisaTahu);
          const status = sisaTahu > 121 ? 'Bahaya' : sisaTahu > 50 ? 'Waspada' : 'Aman';

          const logPayload = {
            id: body.id || `LOG-${dateStr.replace(/-/g, '')}`,
            date: dateStr,
            timestamp: now.toISOString(),
            input_source: body.input_source || "manual_dashboard",
            recorded_by: body.recorded_by || adminUser.user || "Admin Web Dashboard",
            papan_awal: papanAwal,
            tahu_tambahan: tambahan,
            total_awal: totalAwal,
            target_goreng: body.target_goreng !== undefined ? body.target_goreng : (dataGoreng['Target Goreng'] || 0),
            gorengan_selesai: body.gorengan_selesai !== undefined ? body.gorengan_selesai : (dataGoreng['Gorengan Tahu Ini'] || 0),
            pola_goreng: body.pola_goreng !== undefined ? body.pola_goreng : (dataGoreng['Pola Goreng'] || ""),
            tahu_terjual: terjual,
            sisa_tahu: sisaTahu,
            sisa_status: status,
            papan_besok: papanBesok,
            total_besok: totalBesok,
            notes: body.notes || "-"
          };

          const saved = await saveSisaLogToR2(env, logPayload);

          return new Response(JSON.stringify({ success: true, message: "Log sisa tahu berhasil disimpan di R2", data: saved }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
      }

      // 3. DELETE: Hapus log spesifik (Protected: Admin Only)
      if (request.method === "DELETE") {
        const adminUser = await checkAdminRequest(request, env);
        if (!adminUser) {
          return new Response(JSON.stringify({ success: false, error: "Akses ditolak: Login admin diperlukan untuk menghapus log." }), {
            status: 401,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        try {
          const dateParam = url.searchParams.get("date");
          if (!dateParam) {
            return new Response(JSON.stringify({ success: false, error: "Parameter date wajib disertakan" }), {
              status: 400,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
          }
          await deleteSisaLogByDate(env, dateParam);
          return new Response(JSON.stringify({ success: true, message: `Log tanggal ${dateParam} berhasil dihapus` }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
      }
    }

    // ── Handle /api/data ──────────────────────────────────────────
    if (url.pathname === "/api/data") {
      const fetchMode = request.headers.get("Sec-Fetch-Mode");
      const fetchDest = request.headers.get("Sec-Fetch-Dest");

      if (fetchMode === "navigate" || fetchDest === "document") {
        return new Response(NOTICE_HTML, {
          status: 403,
          headers: { "Content-Type": "text/html;charset=UTF-8" },
        });
      }

      try {
        const gasUrl = env.GAS_URL;
        if (!gasUrl) {
          return new Response(
            JSON.stringify({ error: "GAS_URL secret belum di-set." }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        const gasRes = await fetch(gasUrl, {
          method: "GET",
          headers: { "Accept": "application/json" },
          cf: { cacheTtl: 0 },
        });

        const body = await gasRes.text();

        return new Response(body, {
          status: gasRes.status,
          headers: {
            "Content-Type": "application/json;charset=UTF-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "Gagal menghubungi server data.", detail: err.message }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // ── Semua route lain → Static Assets ─────────────────────────
    const assetResponse = await env.ASSETS.fetch(request);

    if (assetResponse.status === 404) {
      const indexUrl = new URL("/", request.url);
      return env.ASSETS.fetch(new Request(indexUrl, request));
    }

    return assetResponse;
  },
};


