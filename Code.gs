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
  return getSpreadsheet().getSheetByName(PETS_SHEET_NAME);
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

// --- SECURITY FUNCTIONS ---
function createSalt() {
  return Utilities.getUuid();
}

function hashPassword(password, salt) {
  const text = password + salt;
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}