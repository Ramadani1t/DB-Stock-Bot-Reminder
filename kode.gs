function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var jsonData = {};

  // =========================================================
  // === MENGAMBIL TIMESTAMP TERLEBIH DAHULU ===
  var fileId = ss.getId();
  var lastUpdated = DriveApp.getFileById(fileId).getLastUpdated();
  
  jsonData['lastUpdated'] = lastUpdated.toISOString();
  // =========================================================

  // 1. MEMUAT DATA DARI SHEET "Sheet1" (Data Stok Utama)
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

  // 2. MEMUAT DATA DARI SHEET "Main" (Diasumsikan ini berisi Gorengan)
  // Berdasarkan screenshot, kita hanya perlu 1 baris data (Header: Sorengan Tahu Ini, Target Goreng, Pola Goreng)
  var sheetMain = ss.getSheetByName("Main");
  
  // Ambil Header (A1, B1, C1) dan Data (A2, B2, C2)
  var rangeMain = sheetMain.getRange("A1:C2").getValues(); 
  
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