/**
 * @OnlyCurrentDoc
 * File: Code.gs
 */

// --- 1. GLOBAL CONSTANTS ---
const HOUSEHOLD_SHEET_NAME = "Household_Data";
const PETS_SHEET_NAME = "Pets_Individual";
const STRAY_SHEET_NAME = "Stray_Data"; 

// --- 2. MAIN WEB APP FUNCTION ---
function doGet(e) {
  const title = "ระบบลงทะเบียนสุนัขและแมว เทศบาลเมืองบางแก้ว";
  const htmlOutput = HtmlService.createTemplateFromFile("Index").evaluate();
  htmlOutput.setTitle(title);
  htmlOutput.addMetaTag("viewport", "width=device-width, initial-scale=1");
  return htmlOutput;
}

// --- 3. UTILITY FUNCTIONS ---
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getHouseholdSheet() {
  return getSpreadsheet().getSheetByName(HOUSEHOLD_SHEET_NAME);
}

function getPetsSheet() {
  let sheet = getSpreadsheet().getSheetByName(PETS_SHEET_NAME);
  if (!sheet) {
    sheet = getSpreadsheet().insertSheet(PETS_SHEET_NAME);
    // สร้าง Header สำหรับ Pets_Individual
    sheet.appendRow([
      "PetID", "HouseholdKey", "PetName", "PetType", "Sex", "Breed", "ColorMark", 
      "AgeYear", "AgeMonth", "VaccineStatus", "VaccineYear", "NeuteredStatus", 
      "RearingStyle", "Location", "", "", "", "", "", "ImageUrl", "Status", ""
    ]);
    return sheet;
  }

  ensurePetsSheetColumns(sheet);
  return sheet;
}

function ensurePetsSheetColumns(sheet) {
  const desiredHeaders = [
    "PetID", "HouseholdKey", "PetName", "PetType", "Sex", "Breed", "ColorMark",
    "AgeYear", "AgeMonth", "VaccineStatus", "VaccineYear", "NeuteredStatus",
    "RearingStyle", "Location", "", "", "", "", "", "ImageUrl", "Status", ""
  ];

  const headerRange = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), desiredHeaders.length));
  let header = headerRange.getValues()[0];
  const colorMarkIndex = header.indexOf("ColorMark");
  if (colorMarkIndex === -1) return;

  const hasAgeYear = header.indexOf("AgeYear") !== -1;
  const hasAgeMonth = header.indexOf("AgeMonth") !== -1;
  const oldAgeIndex = header.indexOf("Age");

  if (!hasAgeYear || !hasAgeMonth) {
    const insertAfter = colorMarkIndex + 1;
    const insertCols = (!hasAgeYear && !hasAgeMonth) ? 2 : 1;
    sheet.insertColumnsAfter(insertAfter, insertCols);

    const newHeaders = [];
    if (!hasAgeYear) newHeaders.push("AgeYear");
    if (!hasAgeMonth) newHeaders.push("AgeMonth");
    sheet.getRange(1, insertAfter + 1, 1, newHeaders.length).setValues([newHeaders]);
  }

  if (sheet.getLastColumn() < desiredHeaders.length) {
    sheet.insertColumnsAfter(sheet.getLastColumn(), desiredHeaders.length - sheet.getLastColumn());
  }

  header = sheet.getRange(1, 1, 1, desiredHeaders.length).getValues()[0];
  for (let i = 0; i < desiredHeaders.length; i++) {
    if ((!header[i] || header[i].toString().trim() === "") && desiredHeaders[i]) {
      header[i] = desiredHeaders[i];
    }
  }
  sheet.getRange(1, 1, 1, desiredHeaders.length).setValues([header]);

  if (oldAgeIndex !== -1) {
    migrateOldAgeColumn(sheet);
  }
}

function migrateOldAgeColumn(sheet) {
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const oldAgeIndex = header.indexOf("Age");
  const ageYearIndex = header.indexOf("AgeYear");
  const ageMonthIndex = header.indexOf("AgeMonth");
  if (oldAgeIndex === -1 || ageYearIndex === -1 || ageMonthIndex === -1) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const ageCells = sheet.getRange(2, oldAgeIndex + 1, lastRow - 1, 1).getValues();
  const ageValues = ageCells.map(function(row) {
    const parsed = parseAgeString(String(row[0] || ""));
    return [parsed.years, parsed.months];
  });

  sheet.getRange(2, ageYearIndex + 1, lastRow - 1, 2).setValues(ageValues);
  sheet.deleteColumn(oldAgeIndex + 1);
}

// (แก้ไข) เพิ่มคอลัมน์ AnimalType และ VaccineYear
function getStraySheet() {
  let sheet = getSpreadsheet().getSheetByName(STRAY_SHEET_NAME);
  if (!sheet) {
    sheet = getSpreadsheet().insertSheet(STRAY_SHEET_NAME);
    // สร้าง Header
    sheet.appendRow([
      "ReportID", "Timestamp", "FeederName", "FeederPhone", 
      "LocationDesc", "MapLink", "Lat", "Lng",
      "DogID", "AnimalType", "ColorMark", "Gender", "Breed", 
      "Behavior", "VaccineStatus", "VaccineYear", "NeuterStatus", "Note"
    ]);
  }
  return sheet;
}

// --- ฟังก์ชันสำหรับ Migration ข้อมูลอายุ ---
function migratePetAges() {
  const sheet = getPetsSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) return { success: true, message: "ไม่มีข้อมูลให้ migrate" };
  
  // ตรวจสอบว่ามีคอลัมน์ AgeYear และ AgeMonth แล้วหรือไม่
  const header = data[0];
  const ageYearIndex = header.indexOf("AgeYear");
  const ageMonthIndex = header.indexOf("AgeMonth");
  const oldAgeIndex = header.indexOf("Age");
  
  if (ageYearIndex === -1 || ageMonthIndex === -1) {
    return { success: false, message: "ไม่พบคอลัมน์ AgeYear หรือ AgeMonth" };
  }
  
  if (oldAgeIndex === -1) {
    return { success: true, message: "ไม่มีคอลัมน์ Age เก่า หรือ migrate แล้ว" };
  }
  
  let migratedCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const oldAge = String(row[oldAgeIndex] || "").trim();
    
    if (oldAge && oldAge !== "") {
      const { years, months } = parseAgeString(oldAge);
      
      // อัปเดตค่าใน sheet
      sheet.getRange(i + 1, ageYearIndex + 1).setValue(years);
      sheet.getRange(i + 1, ageMonthIndex + 1).setValue(months);
      
      migratedCount++;
    }
  }
  
  return { 
    success: true, 
    message: `Migrate ข้อมูลอายุสำเร็จ: ${migratedCount} รายการ`,
    migratedCount: migratedCount
  };
}

// ฟังก์ชันช่วย parse อายุจาก string เช่น "2 ปี 6 เดือน" -> {years: 2, months: 6}
function parseAgeString(ageStr) {
  let years = 0;
  let months = 0;
  
  // จัดการรูปแบบต่างๆ
  const yearMatch = ageStr.match(/(\d+)\s*ปี/);
  const monthMatch = ageStr.match(/(\d+)\s*เดือน/);
  
  if (yearMatch) {
    years = parseInt(yearMatch[1]) || 0;
  }
  
  if (monthMatch) {
    months = parseInt(monthMatch[1]) || 0;
  }
  
  // จัดการกรณีพิเศษ เช่น "1 ปี", "6 เดือน", "2"
  if (!yearMatch && !monthMatch) {
    const numMatch = ageStr.match(/(\d+)/);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      if (ageStr.includes('เดือน') || ageStr.includes('Month')) {
        months = num;
      } else {
        years = num;
      }
    }
  }
  
  return { years, months };
}

// ฟังก์ชันสำหรับรวมอายุกลับเป็น string สำหรับแสดงผล
function formatAgeString(years, months) {
  const yearStr = years > 0 ? `${years} ปี` : "";
  const monthStr = months > 0 ? `${months} เดือน` : "";
  
  if (yearStr && monthStr) {
    return `${yearStr} ${monthStr}`;
  } else if (yearStr) {
    return yearStr;
  } else if (monthStr) {
    return monthStr;
  } else {
    return "";
  }
}

function hashPassword(password, salt) {
  const text = password + salt;
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function createSalt() {
  return Utilities.getUuid();
}