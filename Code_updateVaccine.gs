/**
 * ------------------------------------------------------------------------
 * Code.gs: Master Backend (V.5 - Batch Processing & Performance Optimized)
 * ------------------------------------------------------------------------
 */

const CONFIG = {
  TEMPLATE_ID: '19YlR5uMM-tQq1Q_6Kd59UYrXHrxLgQObqI_Al0t50zI', 
  ROOT_FOLDER_ID: '17XyZwtwqTyYcihk1SMN7PVH0JEh3AYhv',
  PETS_SHEET: 'Pets_Individual',
  HOUSEHOLD_SHEET: 'Household_Data'
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🐶 ระบบจัดการสัตว์เลี้ยง')
    .addItem('เปิดแผงควบคุม (Sidebar)', 'showSidebar')
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('ระบบจัดการสัตว์เลี้ยง 2026').setWidth(350);
  SpreadsheetApp.getUi().showSidebar(html);
}

function normalizeNeuterStatus(value) {
  const val = String(value || '').trim();
  if (val === 'ทำหมันแล้ว' || val === 'ทำแล้ว') return 'ทำหมันแล้ว';
  if (val === 'ยังไม่ทำหมัน' || val === 'ยังไม่ทำ' || val === 'ไม่ทราบ' || val === '') return 'ยังไม่ทำหมัน';
  return 'ยังไม่ทำหมัน';
}

function normalizeVaccineStatus(value) {
  const val = String(value || '').trim();
  return val === 'เคยฉีด' ? 'เคยฉีด' : 'ไม่เคยฉีด';
}

function normalizeSex(value) {
  const val = String(value || '').trim();
  if (val === 'ผู้' || val === 'เพศผู้') return 'ผู้';
  if (val === 'เมีย' || val === 'เพศเมีย') return 'เมีย';
  return val;
}

function parseAgeString(ageStr) {
  const yearMatch = ageStr.match(/(\d+)\s*ปี/);
  const monthMatch = ageStr.match(/(\d+)\s*เดือน/);
  let years = 0;
  let months = 0;
  if (yearMatch) years = parseInt(yearMatch[1]) || 0;
  if (monthMatch) months = parseInt(monthMatch[1]) || 0;
  if (!yearMatch && !monthMatch) {
    const numMatch = ageStr.match(/(\d+)/);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      if (ageStr.includes('เดือน')) months = num;
      else years = num;
    }
  }
  return { years, months };
}

// ==========================================
// ส่วนที่ 1: ระบบค้นหาอัจฉริยะ (Smart Search)
// ==========================================
function fetchHouseholdData(rawKey) {
  const cleanKey = String(rawKey).replace(/\s+/g, '');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hhSheet = ss.getSheetByName(CONFIG.HOUSEHOLD_SHEET);
  const petSheet = ss.getSheetByName(CONFIG.PETS_SHEET);

  let result = { found: false, key: rawKey, owner: '', phone: '', pets: [] };

  const hhData = hhSheet.getDataRange().getValues();
  for (let i = 1; i < hhData.length; i++) {
    if (String(hhData[i][0]).replace(/\s+/g, '') === cleanKey) {
      result.found = true;
      result.owner = hhData[i][3];
      result.phone = hhData[i][5];
      result.key = hhData[i][0];
      break;
    }
  }

  const petData = petSheet.getDataRange().getValues();
  for (let i = 1; i < petData.length; i++) {
    let isMatch = String(petData[i][1]).replace(/\s+/g, '') === cleanKey;
    let isNotDeleted = petData[i][21] !== 'ตาย/ย้าย/หาย'; // มองข้ามตัวที่ลบแล้ว

    if (isMatch && isNotDeleted) {
      result.pets.push({
        row: i + 1,        
        name: petData[i][2],  
        type: petData[i][3],  
        sex: normalizeSex(petData[i][4]),   
        status: normalizeVaccineStatus(petData[i][9]), 
        year: petData[i][10],
        neuter: normalizeNeuterStatus(petData[i][11])
      });
    }
  }

  return result;
}

// ==========================================
// ส่วนที่ 2: ระบบบันทึกแบบรวมศูนย์ (Unified Save / Batch Process)
// ==========================================
function processHouseholdData(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const petSheet = ss.getSheetByName(CONFIG.PETS_SHEET);
    const hhSheet = ss.getSheetByName(CONFIG.HOUSEHOLD_SHEET);
    
    const hhKey = payload.hhKey;
    if (!hhKey) throw new Error("ไม่มีข้อมูล HouseholdKey");

    // 1. จัดการข้อมูลบ้านใหม่ (ถ้ามี)
    if (payload.isNewHousehold) {
      if (!payload.household || !payload.household.moo || !payload.household.houseNo || !payload.household.owner) {
        throw new Error("ข้อมูลบ้านไม่ครบถ้วน (moo, houseNo, owner)");
      }
      let hhRow = Array(33).fill("");
      hhRow[0] = hhKey;              
      hhRow[1] = payload.household.moo;      
      hhRow[2] = payload.household.houseNo;  
      hhRow[3] = payload.household.owner;    
      hhRow[5] = "'" + payload.household.phone; 
      hhRow[6] = "บริเวณบ้าน";         
      hhRow[32] = "Member";   
      hhSheet.appendRow(hhRow);
    }

  // 2. ลบข้อมูลสัตว์ (Soft Delete Batch) **เพิ่มใหม่ตาม Requirement**
  if (payload.deletedRows && Array.isArray(payload.deletedRows) && payload.deletedRows.length > 0) {
    payload.deletedRows.forEach(r => {
      petSheet.getRange(parseInt(r, 10), 22).setValue('ตาย/ย้าย/หาย');
    });
  }

  // 3. อัปเดตวัคซีนสัตว์ตัวเดิม
  if (payload.updateRows && payload.updateRows.length > 0) {
    payload.updateRows.forEach(r => { 
      // ป้องกันการอัปเดตวัคซีนให้กับตัวที่ถูกสั่งลบพร้อมกัน
      const deletedRowsArr = (Array.isArray(payload.deletedRows)) ? payload.deletedRows : [];
      if (!deletedRowsArr.includes(String(r))) {
        petSheet.getRange(parseInt(r, 10), 10, 1, 2).setValues([['เคยฉีด', 2569]]); 
      }
    });
  }

  // 4. เพิ่มสัตว์ตัวใหม่หน้างาน
  if (payload.newPets && payload.newPets.length > 0) {
    let newRows = [];
    payload.newPets.forEach(p => {
      const petId = "PET" + Date.now().toString().slice(-6) + Math.floor(Math.random()*10);
      let petRow = [];  // ใช้ array โดยตรง ไม่ต้อง Array(22).fill("")
      const parsedAge = parseAgeString(String(p.age || ""));
      petRow[0] = petId; petRow[1] = hhKey; petRow[2] = p.name; petRow[3] = p.type; 
      petRow[4] = p.sex; petRow[5] = p.breed; petRow[6] = p.color; 
      petRow[7] = parsedAge.years; petRow[8] = parsedAge.months; 
      petRow[9] = "เคยฉีด"; petRow[10] = 2569; petRow[11] = normalizeNeuterStatus(p.neuter); 
      petRow[12] = p.rearing; petRow[13] = "บริเวณบ้าน";
      petRow[20] = "ปกติ";  // PetStatus = ปกติ เป็น default
      newRows.push(petRow);
    });
    
    if(newRows.length > 0){
      const lr = petSheet.getLastRow();
      // newRows มี 21 columns (indices 0-20): PetID ถึง PetStatus
      petSheet.getRange(lr + 1, 1, newRows.length, 21).setValues(newRows);
    }
  }

  // 5. สั่งคำนวณยอดใหม่ "ครั้งเดียว" ช่วยลดการทำงานเซิร์ฟเวอร์
  recalculateHouseholdSummary(hhKey);

  return "บันทึกและอัปเดตระบบเรียบร้อยแล้ว";
  } catch(e) {
    Logger.log("ProcessHouseholdData Error: " + e.message);
    // ยังคงคำนวณยอดใหม่แม้จะเกิดข้อผิดพลาด เพื่อป้องกันการนับผิด
    try {
      recalculateHouseholdSummary(payload.hhKey);
    } catch(recalcError) {
      Logger.log("Recalculate Error: " + recalcError.message);
    }
    throw new Error("บันทึกไม่สำเร็จ: " + e.message);
  }
}

// ==========================================
// ส่วนที่ 3: บอทสรุปยอด (Recalculate Summary)
// ==========================================
function recalculateHouseholdSummary(hhKey) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const petSheet = ss.getSheetByName(CONFIG.PETS_SHEET);
  const hhSheet = ss.getSheetByName(CONFIG.HOUSEHOLD_SHEET);
  const cleanKey = String(hhKey).replace(/\s+/g, '');

  const petData = petSheet.getDataRange().getValues();
  let c = { dm:0, dmV:0, dmN:0, df:0, dfV:0, dfN:0, cm:0, cmV:0, cmN:0, cf:0, cfV:0, cfN:0 };

  for (let i = 1; i < petData.length; i++) {
    let isMatch = String(petData[i][1]).replace(/\s+/g, '') === cleanKey;
    let isNotDeleted = petData[i][21] !== 'ตาย/ย้าย/หาย';

    if (isMatch && isNotDeleted) {
      const normalizedType = String(petData[i][3] || '').trim();
      const normalizedSex = normalizeSex(petData[i][4]);
      let isDog = (normalizedType === 'สุนัข');
      let isM = (normalizedSex === 'ผู้');
      let isVax = (normalizeVaccineStatus(petData[i][9]) === 'เคยฉีด');
      let isNeu = (normalizeNeuterStatus(petData[i][11]) === 'ทำหมันแล้ว');

      if (isDog && isM) { c.dm++; if(isVax) c.dmV++; if(isNeu) c.dmN++; }
      if (isDog && !isM) { c.df++; if(isVax) c.dfV++; if(isNeu) c.dfN++; }
      if (!isDog && isM) { c.cm++; if(isVax) c.cmV++; if(isNeu) c.cmN++; }
      if (!isDog && !isM) { c.cf++; if(isVax) c.cfV++; if(isNeu) c.cfN++; }
    }
  }

  const hhData = hhSheet.getDataRange().getValues();
  for (let i = 1; i < hhData.length; i++) {
    if (String(hhData[i][0]).replace(/\s+/g, '') === cleanKey) {
      hhSheet.getRange(i + 1, 20, 1, 12).setValues([[
        c.dm, c.dmV, c.dmN, c.df, c.dfV, c.dfN,
        c.cm, c.cmV, c.cmN, c.cf, c.cfV, c.cfN
      ]]);
      break;
    }
  }
}

// ==========================================
// ส่วนที่ 4: ระบบใบรับรอง (โค้ดเดิม)
// ==========================================
function manualGenerateCert() { const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.PETS_SHEET); const row = sheet.getActiveRange().getRow(); if (row < 2) throw new Error('เลือกแถวในชีทก่อน'); const data = sheet.getRange(row, 1, 1, 20).getValues()[0]; const info = mapPetData(data); const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID); const folder = getOrCreateFolder(root, "หมู่ที่ " + info.moo); return executeCreatePDF(info, folder); }
function batchPrintMoo(moo) { const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.PETS_SHEET); const pets = sheet.getDataRange().getValues().slice(1).filter(r => String(r[17]) == moo); if (!pets.length) throw new Error("ไม่พบข้อมูลหมู่ " + moo); pets.sort((a,b) => sortHouseNoDesc(a[1], b[1])); const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID); const name = `Print_Moo_${moo}_(${new Date().toLocaleDateString('th-TH')})`; const copy = DriveApp.getFileById(CONFIG.TEMPLATE_ID).makeCopy(name, root); const pres = SlidesApp.openById(copy.getId()); const master = pres.getSlides()[0]; pets.forEach(r => { replaceTextInSlide(master.duplicate(), mapPetData(r)); }); master.remove(); pres.saveAndClose(); root.createFile(copy.getAs(MimeType.PDF)).setName(name + ".pdf"); copy.setTrashed(true); return { success: pets.length }; }
function generateByRange(start, end) { const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.PETS_SHEET); const rangeData = sheet.getRange(start, 1, (end-start)+1, sheet.getLastColumn()).getValues(); let petsList = rangeData.filter(r => r[0] !== "").map(r => mapPetData(r)); if (petsList.length === 0) throw new Error('ไม่พบข้อมูล'); petsList.sort((a,b) => Number(a.moo) - Number(b.moo) || sortHouseNoDesc(a.hhKey, b.hhKey)); const groupedByMoo = {}; petsList.forEach(pet => { const mooStr = String(pet.moo); if (!groupedByMoo[mooStr]) groupedByMoo[mooStr] = []; groupedByMoo[mooStr].push(pet); }); const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID); const mainFolder = root.createFolder(`ชุดพิมพ์ช่วงแถว_${start}-${end}_(${Utilities.formatDate(new Date(), "GMT+7", "HH.mm")})`); const templateFile = DriveApp.getFileById(CONFIG.TEMPLATE_ID); let successCount = 0; for (const moo in groupedByMoo) { const petsInMoo = groupedByMoo[moo]; const batchFileName = `Print_Moo_${moo}_(รวม ${petsInMoo.length} ใบ)`; const batchFile = templateFile.makeCopy(batchFileName, mainFolder); const batchPres = SlidesApp.openById(batchFile.getId()); const masterSlide = batchPres.getSlides()[0]; petsInMoo.forEach(info => { replaceTextInSlide(masterSlide.duplicate(), info); successCount++; }); masterSlide.remove(); batchPres.saveAndClose(); mainFolder.createFile(batchFile.getAs(MimeType.PDF)).setName(batchFileName + ".pdf"); batchFile.setTrashed(true); } return { success: successCount }; }
function mapPetData(r) { return { id: r[0], hhKey: r[1], petName: r[2], petType: r[3], sex: r[4], breed: r[5], color: r[6], age: r[7], ownerName: r[13], address: r[14], tel: r[15], moo: r[17] }; }
function executeCreatePDF(info, folder) { const hNo = String(info.hhKey).split('-')[0]; const name = `${hNo}_${info.petName}_${info.id}`; const copy = DriveApp.getFileById(CONFIG.TEMPLATE_ID).makeCopy(name, folder); const pres = SlidesApp.openById(copy.getId()); replaceTextInSlide(pres.getSlides()[0], info); pres.saveAndClose(); folder.createFile(copy.getAs(MimeType.PDF)).setName(name + ".pdf"); copy.setTrashed(true); return { fileName: name }; }
function replaceTextInSlide(s, i) { const reps = { '{{PetName}}': i.petName, '{{PetType}}': i.petType, '{{Sex}}': i.sex, '{{Breed}}': i.breed, '{{Age}}': i.age, '{{ColorMark}}': i.color, '{{ownerName}}': i.ownerName, '{{address}}': i.address, '{{tel}}': String(i.tel).replace(/^'/, '') }; for (let k in reps) { try { s.replaceAllText(k, String(reps[k] || '-')); } catch(e) {} } }
function getOrCreateFolder(p, n) { const fs = p.getFoldersByName(n); return fs.hasNext() ? fs.next() : p.createFolder(n); }
function sortHouseNoDesc(a, b) { const getP = (s) => { const p = String(s).split('-')[0].split('/'); return { m: parseFloat(p[0]) || 0, s: p[1] ? parseFloat(p[1]) : null }; }; const hA = getP(a), hB = getP(b); if (hA.m !== hB.m) return hB.m - hA.m; if (hA.s === null && hB.s !== null) return -1; if (hA.s !== null && hB.s === null) return 1; return (hB.s || 0) - (hA.s || 0); }