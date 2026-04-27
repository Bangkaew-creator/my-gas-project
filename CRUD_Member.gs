/**
 * File: CRUD_Member.gs
 * อัปเดตล่าสุด: Auto-Expand Columns (สร้างคอลัมน์เพิ่มอัตโนมัติถ้าไม่พอ)
 */

// 🟢 ใส่ Folder ID สำหรับเก็บรูปสัตว์เลี้ยงมีเจ้าของ
const BATCH_IMAGE_FOLDER_ID = '1zhIeIWoT2HmIlXDztHD69KmQsbW3UD7S'; 

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

function normalizePetType(value) {
  const val = String(value || '').trim();
  if (val === 'สุนัข') return 'สุนัข';
  if (val === 'แมว') return 'แมว';
  return val;
}

// --- 1. คำนวณยอด (Robust Version) ---
function recalculateAndUpdateCounts(householdKey) {
  if (!householdKey) return;
  try {
    const petsSheet = getPetsSheet();
    const householdSheet = getHouseholdSheet();
    
    // ค้นหาข้อมูลสัตว์เลี้ยง
    const lastRow = petsSheet.getLastRow();
    if (lastRow < 2) return;
    
    const maxCol = petsSheet.getLastColumn();
    // อ่านข้อมูลมาเช็ค (ฺCol B คือ HouseholdKey)
    const data = petsSheet.getRange(2, 1, lastRow - 1, maxCol).getValues();
    
    let counters = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const targetKey = String(householdKey);

    for (let i = 0; i < data.length; i++) {
      if (String(data[i][1]) === targetKey) {
        // Map Index (ระวัง: ต้องเช็คว่ามี index นี้จริงไหม)
        const type = data[i][3] || ""; 
        const sex = data[i][4] || "";
        const vax = normalizeVaccineStatus(data[i][9] || ""); 
        const neuter = normalizeNeuterStatus(data[i][11] || "");

        const normalizedType = normalizePetType(type);
        const normalizedSex = normalizeSex(sex);
        if (normalizedType === 'สุนัข' && normalizedSex === 'ผู้') { counters[0]++; if(vax==='เคยฉีด')counters[1]++; if(neuter==='ทำหมันแล้ว')counters[2]++; }
        else if (normalizedType === 'สุนัข' && normalizedSex === 'เมีย') { counters[3]++; if(vax==='เคยฉีด')counters[4]++; if(neuter==='ทำหมันแล้ว')counters[5]++; }
        else if (normalizedType === 'แมว' && normalizedSex === 'ผู้') { counters[6]++; if(vax==='เคยฉีด')counters[7]++; if(neuter==='ทำหมันแล้ว')counters[8]++; }
        else if (normalizedType === 'แมว' && normalizedSex === 'เมีย') { counters[9]++; if(vax==='เคยฉีด')counters[10]++; if(neuter==='ทำหมันแล้ว')counters[11]++; }
      }
    }

    // อัปเดตลง Household Sheet
    const hhData = householdSheet.getRange("A:A").getValues();
    let targetRowIndex = -1;
    
    for(let i=0; i<hhData.length; i++) {
        if(String(hhData[i][0]) === targetKey) {
            targetRowIndex = i + 1;
            break;
        }
    }
    
    // Fallback search
    if (targetRowIndex === -1) {
      const parts = targetKey.split('-');
      if(parts.length >= 2) {
        const moo = parts.pop();
        const house = parts.join('-');
        const allData = householdSheet.getDataRange().getValues();
        for(let i=1; i<allData.length; i++) {
          if(String(allData[i][1]).replace(/'/g,'') == moo && String(allData[i][2]).replace(/'/g,'') == house) {
            targetRowIndex = i + 1;
            householdSheet.getRange(targetRowIndex, 1).setValue(householdKey);
            break;
          }
        }
      }
    }
    
    // Auto-expand Household Sheet if needed
    if (targetRowIndex > -1) {
       if (householdSheet.getMaxColumns() < 31) {
          householdSheet.insertColumnsAfter(householdSheet.getMaxColumns(), 31 - householdSheet.getMaxColumns());
       }
       householdSheet.getRange(targetRowIndex, 20, 1, 12).setValues([counters]);
    }
  } catch(e) {
    Logger.log("Recalc Error: " + e.message);
  }
}

// --- 2. ดึงข้อมูลสัตว์เลี้ยง ---
function getMemberPets(householdKey) {
  if (!householdKey) return { error: "ไม่พบผู้ใช้งาน" };
  try {
    const petsSheet = getPetsSheet();
    const lastRow = petsSheet.getLastRow();
    if (lastRow < 2) return { success: true, pets: [] };

    const maxCol = petsSheet.getLastColumn();
    // อ่านข้อมูลทั้งหมดที่มี
    const data = petsSheet.getRange(2, 1, lastRow - 1, maxCol).getValues();
    
    let pets = [];
    const targetKey = String(householdKey);

    for (let i = 0; i < data.length; i++) {
      // เทียบ Col B (Index 1)
      if (String(data[i][1]) === targetKey) {
        const rowData = data[i];
        const v = (idx) => (idx < rowData.length && rowData[idx] != null ? String(rowData[idx]) : "");

        const ageYear = parseInt(v(7)) || 0;
        const ageMonth = parseInt(v(8)) || 0;
        const ageString = formatAgeString(ageYear, ageMonth);

        pets.push({
          PetID: v(0),
          HouseholdKey: v(1),
          PetName: v(2),
          PetType: v(3),
          Sex: v(4),
          Breed: v(5),
          ColorMark: v(6),
          Age: ageString,  // รวมปีและเดือนเป็น string
          AgeYear: ageYear,
          AgeMonth: ageMonth,
          VaccineStatus: normalizeVaccineStatus(v(9)),
          VaccineYear: v(10),
          NeuteredStatus: normalizeNeuterStatus(v(11)),
          RearingStyle: v(12),
          Location: v(13),
          PetImage: v(19),       // S
          PetStatus: v(20),      // T
          MissingLocation: v(21) // U
        });
      }
    }
    return { success: true, pets: pets };
  } catch (e) { return { error: e.message }; }
}

// --- 3. บันทึกแบบ Batch (✅ แก้ไข: เพิ่มการเช็คและขยายคอลัมน์) ---
function saveMemberPetsBatch(petsList, householdKey) {
  try {
    const householdSheet = getHouseholdSheet();
    // Logic หา Household Row
    let foundRow = -1;
    const targetKey = String(householdKey);
    const hhData = householdSheet.getRange("A:A").getValues();
    for(let i=0; i<hhData.length; i++) {
        if(String(hhData[i][0]) === targetKey) { foundRow = i + 1; break; }
    }
    if (foundRow === -1) {
      const keyParts = targetKey.split('-');
      if (keyParts.length >= 2) {
         const moo = keyParts.pop(); const houseNo = keyParts.join('-');
         const data = householdSheet.getDataRange().getValues();
         for(let i=1; i<data.length; i++) {
           if(String(data[i][1]).replace(/'/g,'') == moo && String(data[i][2]).replace(/'/g,'') == houseNo) {
             foundRow = i + 1; householdSheet.getRange(foundRow, 1).setValue(householdKey); break;
           }
         }
      }
    }
    if(foundRow === -1) return { error: "ไม่พบข้อมูลครัวเรือน" };

    const petsSheet = getPetsSheet();
    let nextRow = petsSheet.getLastRow() + 1;
    const newRows = [];

    petsList.forEach(pet => {
      const newPetId = Utilities.getUuid();
      const petType = normalizePetType(pet.PetType);
      const petSex = normalizeSex(pet.Sex);
      
      let imageUrl = "";
      if (pet.PetImageBase64 && pet.PetImageBase64.length > 100) { 
         imageUrl = uploadImageToDrive(pet.PetImageBase64, newPetId);
      }

      newRows.push([
        newPetId, householdKey, pet.PetName, petType, petSex, 
        pet.Breed, pet.ColorMark, 
        pet.AgeYear || 0, pet.AgeMonth || 0,  // แยกอายุเป็นปีและเดือน
        normalizeVaccineStatus(pet.VaccineStatus), pet.VaccineYear, 
        normalizeNeuterStatus(pet.NeuteredStatus), pet.RearingStyle, pet.Location, 
        "", "", "", "", "", 
        imageUrl, // Col S (19)
        "ปกติ",    // Col T (20)
        ""        // Col U (21)
      ]);
    });

    if (newRows.length > 0) {
      // ✅ Auto-Expand: ตรวจสอบจำนวนคอลัมน์ก่อนบันทึก
      const requiredCols = newRows[0].length; // ควรเป็น 21
      const currentCols = petsSheet.getMaxColumns();
      
      if (currentCols < requiredCols) {
         // สร้างคอลัมน์เพิ่มให้พอดี
         petsSheet.insertColumnsAfter(currentCols, requiredCols - currentCols);
         // (Optional) เติม Header ให้ด้วยถ้าเป็นแถวแรกๆ แต่ละไว้ก่อนเพื่อความเร็ว
      }

      // บันทึกข้อมูล
      petsSheet.getRange(nextRow, 1, newRows.length, requiredCols).setValues(newRows);
      
      recalculateAndUpdateCounts(householdKey);
    }
    return { success: true, count: newRows.length };
  } catch (e) { return { success: false, error: e.message }; }
}

// ฟังก์ชันช่วยอัปโหลดรูป
function uploadImageToDrive(base64Data, fileName) {
  try {
    if (!BATCH_IMAGE_FOLDER_ID || BATCH_IMAGE_FOLDER_ID.includes('นำ_FOLDER_ID')) return "";
    const folder = DriveApp.getFolderById(BATCH_IMAGE_FOLDER_ID);
    const contentType = base64Data.substring(5, base64Data.indexOf(';'));
    const decoded = Utilities.base64Decode(base64Data.substring(base64Data.indexOf(',') + 1));
    const blob = Utilities.newBlob(decoded, contentType, fileName + ".jpg");
    
    const existing = folder.getFilesByName(fileName + ".jpg");
    while (existing.hasNext()) existing.next().setTrashed(true);

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return "https://lh3.googleusercontent.com/d/" + file.getId();
  } catch (e) { return ""; }
}

// --- Update / Delete ---
function updatePet(petInfo, householdKey) {
  try {
    const petsSheet = getPetsSheet();
    const data = petsSheet.getRange("A:A").getValues();
    let row = -1;
    for(let i=0; i<data.length; i++) {
        if(String(data[i][0]) === String(petInfo.PetID)) { row = i + 1; break; }
    }
    if (row === -1) return { error: "ไม่พบ PetID" };
    
    // Auto-expand columns if needed
    const maxCol = petsSheet.getLastColumn();
    if (maxCol < 22) {
      petsSheet.insertColumnsAfter(maxCol, 22 - maxCol);
    }
    
    const updatedRowData = [
      petInfo.PetName, normalizePetType(petInfo.PetType), normalizeSex(petInfo.Sex), petInfo.Breed, petInfo.ColorMark, 
      petInfo.AgeYear || 0, petInfo.AgeMonth || 0,  // แยกอายุเป็นปีและเดือน
      normalizeVaccineStatus(petInfo.VaccineStatus), petInfo.VaccineYear, normalizeNeuterStatus(petInfo.NeuteredStatus), 
      petInfo.RearingStyle, petInfo.Location
    ];
    petsSheet.getRange(row, 3, 1, 12).setValues([updatedRowData]);
    recalculateAndUpdateCounts(householdKey);
    return { success: true };
  } catch (e) { return { error: e.message }; }
}

function deletePet(petId, householdKey) {
  try {
    const petsSheet = getPetsSheet();
    const data = petsSheet.getRange("A:A").getValues();
    let row = -1;
    for(let i=0; i<data.length; i++) {
        if(String(data[i][0]) === String(petId)) { row = i + 1; break; }
    }
    if (row === -1) return { error: "ไม่พบ PetID" };
    petsSheet.deleteRow(row);
    recalculateAndUpdateCounts(householdKey);
    return { success: true };
  } catch (e) { return { error: e.message }; }
}

// savePetImage is defined in ImageService.gs — removed duplicate here

// --- Admin Functions ---
function adminUpdateMemberDetails(householdKey, d) {
  try {
    const sheet = getHouseholdSheet();
    let row = -1;
    const data = sheet.getRange("A:A").getValues();
    const targetKey = String(householdKey);
    for(let i=0; i<data.length; i++) { if(String(data[i][0]) === targetKey) { row = i + 1; break; } }
    
    if(row === -1) {
       const parts = householdKey.split('-'); const moo = parts.pop(); const house = parts.join('-');
       const allData = sheet.getDataRange().getValues();
       for(let i=1; i<allData.length; i++) {
         if(String(allData[i][1]).replace(/'/g,'')==moo && String(allData[i][2]).replace(/'/g,'')==house) {
           row = i+1; sheet.getRange(row,1).setValue(householdKey); break;
         }
       }
    }
    if(row === -1) return {success:false, message:"ไม่พบ"};
    sheet.getRange(row, 4, 1, 3).setValues([[d.fullName, "'"+d.idCard, "'"+d.phone]]);
    return {success:true};
  } catch(e) { return {success:false, message:e.message}; }
}

function adminDeleteHousehold(key) {
  try {
    const hSheet = getHouseholdSheet(); const pSheet = getPetsSheet();
    let row = -1;
    const hData = hSheet.getRange("A:A").getValues();
    const targetKey = String(key);
    for(let i=0; i<hData.length; i++) { if(String(hData[i][0]) === targetKey) { row = i+1; break; } }
    if(row === -1) return {success:false, message:"ไม่พบ"};
    hSheet.deleteRow(row);
    const pData = pSheet.getRange("B:B").getValues();
    for(let i=pData.length-1; i>=0; i--) {
        if(String(pData[i][0]) === targetKey) pSheet.deleteRow(i+1);
    }
    return {success:true};
  } catch(e) { return {success:false, message:e.message}; }
}

function adminResetPassword(key, newPass) {
  try {
    const sheet = getHouseholdSheet();
    let row = -1;
    const data = sheet.getRange("A:A").getValues();
    const targetKey = String(key);
    for(let i=0; i<data.length; i++) { if(String(data[i][0]) === targetKey) { row = i+1; break; } }
    if(row === -1) return {success:false, message:"ไม่พบ"};
    const salt = createSalt();
    const hashed = hashPassword(newPass, salt);
    const role = sheet.getRange(row, 33).getValue();
    sheet.getRange(row, 32, 1, 3).setValues([[hashed, role, salt]]);
    return {success:true};
  } catch(e) { return {success:false, message:e.message}; }
}

function adminCreateHousehold(house, moo, road) {
  try {
    const sheet = getHouseholdSheet();
    const key = house + "-" + moo;
    sheet.appendRow([key, "'"+moo, "'"+house, "","","", road||"", 0,0,0,0,0,0,0,0,0,0,0,0, "", "", "", "", "", "", "", "", "", "", "", "", "", "Member", ""]);
    return {success:true};
  } catch(e) { return {success:false, message:e.message}; }
}

function adminSearchHousehold(house, moo) {
  try {
    const sheet = getHouseholdSheet();
    const data = sheet.getDataRange().getValues();
    const tm = String(moo).trim(); const th = String(house).trim();
    for(let i=1; i<data.length; i++) {
      if(String(data[i][1]).replace(/'/g,'')===tm && String(data[i][2]).replace(/'/g,'')===th) {
        return {found:true, key:data[i][0], name:data[i][3], message:"พบข้อมูล"};
      }
    }
    return {found:false, message:"ไม่พบ"};
  } catch(e) { return {error:e.message}; }
}

function updateMemberTargets(k,t) { return {success:true}; }