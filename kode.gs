function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var jsonData = {};

  // =========================================================
  // === MENGAMBIL TIMESTAMP TERLEBIH DAHULU ===
  var fileId = ss.getId();
  var lastUpdated = DriveApp.getFileById(fileId).getLastUpdated();
  
  jsonData['lastUpdated'] = lastUpdated.toISOString();
  // =========================================================

  // 1. MEMUAT DATA DARI SHEET "Sheet2" (Data Stok Utama)
  var sheet1 = ss.getSheetByName("Sheet2");
  var data1 = sheet1.getDataRange().getValues();
  var headers1 = data1[0];
  var rows1 = [];

  for (var i = 1; i < data1.length; i++) {
    var row = {};
    for (var j = 0; j < headers1.length; j++) {
      row[headers1[j]] = data1[i][j];
    }
    rows1.push(row);
  }
  jsonData['data'] = rows1;
  
  // ------------------------------------------------------------------

  // 2. MEMUAT DATA DARI SHEET "Main" (Data Gorengan)
  var sheetMain = ss.getSheetByName("Main");
  
  // Ambil Header dan Data (Baris 1 dan 2) secara dinamis agar bisa tambah kolom
  var lastCol = sheetMain.getLastColumn();
  if (lastCol < 3) lastCol = 3; // minimal 3 kolom (A, B, C)
  var rangeMain = sheetMain.getRange(1, 1, 2, lastCol).getValues(); 
  
  var headersMain = rangeMain[0];
  var dataGoreng = {};
  
  // Loop untuk membuat objek dari baris data (Baris 2 atau indeks 1)
  for (var j = 0; j < headersMain.length; j++) {
    dataGoreng[headersMain[j].trim()] = rangeMain[1][j];
  }
  
  // Tambahkan data gorengan di bawah key baru 'gorengan'
  jsonData['gorengan'] = dataGoreng;
  
  // ------------------------------------------------------------------
  
  return ContentService.createTextOutput(JSON.stringify(jsonData))
    .setMimeType(ContentService.MimeType.JSON);
}

// =========================================================
// === HANDLER POST – untuk update stok via WhatsApp Bot ===
// =========================================================
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    
    if (action === 'update_stock') {
      var result = updateStockItem(payload.nama, payload.jumlah);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'ai_update') {
      var updates = payload.updates || [];
      var results = [];
      for (var i = 0; i < updates.length; i++) {
        var u = updates[i];
        if (u.type === 'sheet2') {
          results.push(updateStockItem(u.id, u.value));
        } else if (u.type === 'main') {
          results.push(updateMainField(u.field, u.value));
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, results: results }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ error: 'Aksi tidak dikenal.' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Mencari barang di Sheet2 berdasarkan ID (exact) atau nama barang (partial),
 * lalu mengupdate kolom "Tersedia" (kolom D).
 * 
 * Sheet2 struktur:
 *   Col A (idx 0) = Gambar (URL)
 *   Col B (idx 1) = ID     (PAC1, KNT1, ...)
 *   Col C (idx 2) = Barang (Cup Thinwall 25ml, ...)
 *   Col D (idx 3) = Tersedia
 */
function updateStockItem(namaOrId, jumlahBaru) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Sheet2');
  var data  = sheet.getDataRange().getValues();
  
  var keyword = (namaOrId || '').toString().toLowerCase().trim();
  
  for (var i = 1; i < data.length; i++) {
    var id   = (data[i][1] || '').toString().toLowerCase().trim(); // Kolom B = ID
    var nama = (data[i][2] || '').toString().toLowerCase().trim(); // Kolom C = Barang
    
    // Cocokkan ID persis ATAU nama mengandung keyword
    if (id === keyword || nama.includes(keyword)) {
      sheet.getRange(i + 1, 4).setValue(jumlahBaru); // Kolom D = Tersedia (1-indexed = 4)
      return {
        success : true,
        item    : data[i][2].toString(),
        id      : data[i][1].toString(),
        jumlah  : jumlahBaru
      };
    }
  }
  
  return {
    success : false,
    error   : 'Item \'' + namaOrId + '\' tidak ditemukan di stok.'
  };
}

/**
 * Mengupdate data di sheet "Main" berdasarkan nama header/kolom di baris 1.
 * Data diupdate pada baris 2.
 */
function updateMainField(fieldName, newValue) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Main');
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) lastCol = 1;
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var keyword = (fieldName || '').toString().toLowerCase().trim();
  
  for (var j = 0; j < headers.length; j++) {
    var h = (headers[j] || '').toString().toLowerCase().trim();
    if (h === keyword || h.includes(keyword)) {
      sheet.getRange(2, j + 1).setValue(newValue);
      return {
        success : true,
        type    : 'main',
        field   : headers[j].toString(),
        value   : newValue
      };
    }
  }
  
  return {
    success : false,
    type    : 'main',
    error   : 'Kolom \'' + fieldName + '\' tidak ditemukan di Main sheet.'
  };
}