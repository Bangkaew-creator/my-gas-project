/**
 * File: Stray_Func.gs
 * อัปเดตล่าสุด: แก้ไขชื่อตัวแปรซ้ำ (Fix Syntax Error)
 */

// 🟢 ใส่ Folder ID สำหรับเก็บรูปสัตว์จรจัดที่นี่
var STRAY_IMAGE_FOLDER_ID_V2 = '16pyIQLh8Gcovy1XsSHMTbL2MeI23B-0Z'; 
var SHEET_NAME_STRAY_DATA = "Stray_Data"; // เปลี่ยนชื่อตัวแปรหลบ Error

// ฟังก์ชันสร้าง/เรียกชีท
function getStraySheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_STRAY_DATA);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME_STRAY_DATA);
    // สร้าง Header 19 คอลัมน์
    sheet.appendRow([
      "ReportID",       // 0
      "Timestamp",      // 1
      "FeederName",     // 2
      "FeederPhone",    // 3
      "LocationDesc",   // 4
      "MapLink",        // 5
      "Lat",            // 6
      "Lng",            // 7
      "DogID",          // 8
      "AnimalType",     // 9 
      "ColorMark",      // 10
      "Gender",         // 11
      "Breed",          // 12
      "Behavior",       // 13
      "VaccineStatus",  // 14
      "VaccineYear",    // 15
      "NeuterStatus",   // 16
      "Note",           // 17
      "ImageURL"        // 18 (✅ คอลัมน์เก็บรูป)
    ]);
  }
  return sheet;
}

/**
 * บันทึกข้อมูลสัตว์จรจัด พร้อมรูปภาพ
 */
function saveStrayReport(feederInfo, locationInfo, animalsList) {
  try {
    var sheet = getStraySheet();
    var timestamp = new Date();
    var reportId = Utilities.getUuid().slice(0, 8); 
    
    if (!animalsList || animalsList.length === 0) return { success: false, message: "No Data" };

    var rows = animalsList.map(function(animal) {
      var animalId = Utilities.getUuid();
      
      // ✅ จัดการอัปโหลดรูปภาพ (ถ้ามี)
      var imageUrl = "";
      if (animal.image && animal.image.length > 100) {
         imageUrl = uploadStrayImage(animal.image, animalId);
      }

      // เรียงลำดับ Array ให้ตรงกับ Header (19 ค่า)
      return [
        "R-" + reportId,                // 0
        timestamp,                      // 1
        feederInfo.name,                // 2
        "'" + feederInfo.phone,         // 3
        locationInfo.desc,              // 4
        locationInfo.mapLink,           // 5
        locationInfo.lat,               // 6
        locationInfo.lng,               // 7
        animalId,                       // 8
        animal.type,                    // 9
        animal.color,                   // 10
        animal.gender,                  // 11
        animal.breed || "-",            // 12
        animal.behavior,                // 13
        animal.vaccine,                 // 14
        animal.vaccineYear || "-",      // 15
        animal.neuter,                  // 16
        animal.note || "",              // 17
        imageUrl                        // 18
      ];
    });

    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return { success: true, count: rows.length };

  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * ฟังก์ชันช่วยอัปโหลดรูป
 */
function uploadStrayImage(base64Data, fileName) {
  try {
    if (!STRAY_IMAGE_FOLDER_ID_V2 || STRAY_IMAGE_FOLDER_ID_V2.includes('นำ_FOLDER_ID')) return "";
    
    var folder = DriveApp.getFolderById(STRAY_IMAGE_FOLDER_ID_V2);
    var contentType = base64Data.substring(5, base64Data.indexOf(';'));
    var decoded = Utilities.base64Decode(base64Data.substring(base64Data.indexOf(',') + 1));
    var blob = Utilities.newBlob(decoded, contentType, "stray_" + fileName + ".jpg");
    
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return "https://lh3.googleusercontent.com/d/" + file.getId();
  } catch (e) {
    Logger.log("Stray Upload Error: " + e.message);
    return "";
  }
}

/**
 * ดึงข้อมูลสำหรับหน้า Public
 */
function getPublicStrayData() {
  try {
    var sheet = getStraySheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, data: [] };
    
    // อ่านข้อมูล 19 คอลัมน์
    var maxCols = sheet.getLastColumn();
    var numCols = Math.max(maxCols, 19); 
    var data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
    
    var publicData = data.map(function(row) {
      var timeStr = "-";
      try {
        if (row[1]) timeStr = Utilities.formatDate(new Date(row[1]), "GMT+7", "d MMM yy HH:mm");
      } catch (e) {}

      var v = function(i) { return (row[i] ? String(row[i]) : ""); };

      return {
        id: v(0),
        timestampStr: timeStr,
        feederName: v(2),
        feederPhone: v(3),
        location: v(4),
        mapLink: v(5),
        lat: v(6),
        lng: v(7),
        dogId: v(8),
        type: v(9),       
        color: v(10),
        gender: v(11),
        breed: v(12),
        behavior: v(13),
        vaccine: v(14),
        vaccineYear: v(15), 
        neuter: v(16),
        note: v(17),
        image: v(18) // ลิงก์รูปภาพ
      };
    });
    
    publicData.reverse(); 
    return { success: true, data: publicData };

  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * ฟังก์ชันสำหรับ Admin แก้ไขข้อมูล
 */
function adminUpdateStrayDog(dogId, updateData) {
  try {
    var sheet = getStraySheet();
    var lastRow = sheet.getLastRow();
    var finder = sheet.getRange(2, 9, lastRow - 1, 1).createTextFinder(dogId).matchEntireCell(true).findNext();
    
    if (!finder) return { success: false, message: "ไม่พบข้อมูล" };
    
    var row = finder.getRow();
    if (updateData.behavior) sheet.getRange(row, 14).setValue(updateData.behavior);
    if (updateData.vaccine) sheet.getRange(row, 15).setValue(updateData.vaccine);
    if (updateData.vaccineYear !== undefined) sheet.getRange(row, 16).setValue(updateData.vaccineYear);
    if (updateData.neuter) sheet.getRange(row, 17).setValue(updateData.neuter);
    
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}