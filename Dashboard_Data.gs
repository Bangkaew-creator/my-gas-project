/**
 * File: Dashboard_Data.gs (Lite Version)
 * เน้นความเร็วสูงสุด:
 * 1. ไม่ดึงข้อมูลจาก sheet Pets_Individual มานับใหม่ (ใช้ยอดสะสมใน Household_Data คอลัมน์ T-AE แทน)
 * 2. ไม่ดึงคอลัมน์เป้าหมาย (Target) H-S
 */

/**
 * 1. Public Dashboard: ดึงยอดรวมทั้งหมด (เร็วมาก)
 */
function getPublicDashboardData() {
  try {
    const householdSheet = getHouseholdSheet();
    const lastRow = householdSheet.getLastRow();
    
    if (lastRow < 2) return { households: 0, dogActual: 0, catActual: 0, totalActual: 0, vaccinated: 0, neutered: 0 };

    // นับจำนวนจาก Pets_Individual โดยตรงเพื่อความถูกต้อง
    const petSheet = getSpreadsheet().getSheetByName('Pets_Individual');
    const petData = petSheet.getDataRange().getValues();
    
    let stats = {
      households: lastRow - 1,
      dogActual: 0,
      catActual: 0,
      vaccinated: 0,
      neutered: 0
    };

    for (let i = 1; i < petData.length; i++) {
      const petType = String(petData[i][3] || '').trim(); // Column D
      const petSex = String(petData[i][4] || '').trim(); // Column E
      const vaxStatus = String(petData[i][9] || '').trim(); // Column J
      const vaxYear = String(petData[i][10] || '').trim(); // Column K
      const neuterStatus = String(petData[i][11] || '').trim(); // Column L
      const petStatus = String(petData[i][20] || '').trim(); // Column U (PetStatus)

      // นับเฉพาะสัตว์ที่ยังมีชีวิต (ไม่ใช่ ตาย/ย้าย/หาย)
      if (petStatus !== 'ตาย/ย้าย/หาย') {
        if (petType === 'สุนัข') {
          if (petSex === 'ผู้' || petSex === 'เพศผู้' || petSex === 'เมีย' || petSex === 'เพศเมีย') stats.dogActual++;
        } else if (petType === 'แมว') {
          if (petSex === 'ผู้' || petSex === 'เพศผู้' || petSex === 'เมีย' || petSex === 'เพศเมีย') stats.catActual++;
        }

        if (vaxStatus === 'เคยฉีด' && vaxYear === '2569') stats.vaccinated++;
        if (neuterStatus === 'ทำหมันแล้ว') stats.neutered++;
      }
    }

    stats.totalActual = stats.dogActual + stats.catActual;

    // คำนวณอัตราเพิ่มเติมสำหรับกราฟ
    stats.vaccinationRate = stats.totalActual > 0 ? (stats.vaccinated / stats.totalActual) * 100 : 0;
    stats.neuterRate = stats.totalActual > 0 ? (stats.neutered / stats.totalActual) * 100 : 0;
    stats.dogPercentage = stats.totalActual > 0 ? (stats.dogActual / stats.totalActual) * 100 : 0;
    stats.catPercentage = stats.totalActual > 0 ? (stats.catActual / stats.totalActual) * 100 : 0;
    stats.unvaccinatedPercentage = 100 - stats.vaccinationRate;
    
    // ส่ง target เป็น 0 ไปเลย เพื่อลดภาระ
    return {
      ...stats,
      dogTarget: 0, catTarget: 0, totalTarget: 0
    };

  } catch (error) {
    Logger.log(error);
    return { error: error.message };
  }
}

/**
 * 2. Member Dashboard: ดึงข้อมูลสมาชิก (เร็วขึ้น)
 */
function getMemberDashboardData(householdKey) {
  if (!householdKey) return { error: "ไม่พบข้อมูลผู้ใช้งาน" };
  try {
    const householdSheet = getHouseholdSheet();
    const lastRow = householdSheet.getLastRow();
    
    // ดึง Key (A), Basic Info (D-F), และ Stats (T-AE)
    // เราจะดึงมาทั้งหมดก่อนแล้ววนหาใน memory (เร็วกว่ายิง request หลายรอบ)
    // A2:AH คือทั้งหมด แต่มันช้า เราดึงเฉพาะส่วนจำเป็นยากเพราะคอลัมน์ห่างกัน
    // ดังนั้น ดึง A2:AE ไปเลยทีเดียว (ตัด AF, AG, AH ออกนิดหน่อย)
    const data = householdSheet.getRange(2, 1, lastRow - 1, 31).getValues(); // A-AE
    
    const keyParts = householdKey.split('-');
    if (keyParts.length < 2) return { error: "Key ผิดพลาด" };
    const moo = keyParts.pop();
    const houseNo = keyParts.join('-');

    let userRow = null;
    
    // ค้นหาแถว
    for (let i = 0; i < data.length; i++) {
      // Col B=1, Col C=2
      if (String(data[i][1]) === String(moo) && String(data[i][2]) === String(houseNo)) {
        userRow = data[i];
        break;
      }
    }

    if (!userRow) return { error: "ไม่พบข้อมูลสมาชิก" };

    // คำนวณจากคอลัมน์ T-AE (Index 19-30 ใน array A-AE)
    // T คือ column 20 แต่ index array คือ 19
    const startStat = 19; 
    
    const actualDog = (Number(userRow[startStat+0])||0) + (Number(userRow[startStat+3])||0);
    const actualCat = (Number(userRow[startStat+6])||0) + (Number(userRow[startStat+9])||0);
    
    const actualVax = (Number(userRow[startStat+1])||0) + (Number(userRow[startStat+4])||0) + 
                      (Number(userRow[startStat+7])||0) + (Number(userRow[startStat+10])||0);
                      
    const actualNeu = (Number(userRow[startStat+2])||0) + (Number(userRow[startStat+5])||0) + 
                      (Number(userRow[startStat+8])||0) + (Number(userRow[startStat+11])||0);

    return {
      dogActual: actualDog, dogTarget: 0,
      catActual: actualCat, catTarget: 0,
      totalActual: actualDog + actualCat, totalTarget: 0,
      vaccinated: actualVax,
      neutered: actualNeu,
      currentTargets: [], // ไม่ส่ง Target แล้ว
      profileData: {
        fullName: userRow[3], // D
        idCard: userRow[4],   // E
        phone: userRow[5]     // F
      }
    };

  } catch (error) {
    Logger.log(error);
    return { error: error.message };
  }
}

/**
 * 3. Admin Dashboard: ดึงข้อมูลแบบ Lite (เร็วสุดยอด)
 * - ไม่โหลด Pets sheet
 * - ไม่โหลด Target columns
 */
function getAdminDashboardData(filterMoo, filterHouse) {
  let defaultCardData = {
    households: 0,
    dogActual: 0, dogTarget: 0,
    catActual: 0, catTarget: 0,
    totalActual: 0, totalTarget: 0,
    vaccinated: 0, neutered: 0
  };

  try {
    const householdSheet = getHouseholdSheet();
    const lastRow = householdSheet.getLastRow();
    
    if (lastRow < 2) return { success: true, cardData: defaultCardData, tableData: [] };

    // เทคนิค Split Load: โหลดเฉพาะส่วนที่ใช้
    // 1. Basic Info (A-F) เพื่อทำตารางและ Filter
    const basicInfo = householdSheet.getRange(2, 1, lastRow - 1, 6).getValues(); // A-F
    
    // 2. Actual Stats (T-AE) เพื่อทำ Card
    const statsInfo = householdSheet.getRange(2, 20, lastRow - 1, 12).getValues(); // T-AE

    let tableData = [];
    let stats = JSON.parse(JSON.stringify(defaultCardData));

    const searchMoo = filterMoo ? String(filterMoo) : "";
    const searchHouse = filterHouse ? String(filterHouse).toLowerCase() : "";

    for (let i = 0; i < basicInfo.length; i++) {
      const rowBasic = basicInfo[i];
      
      // กรองข้อมูล
      const rawMoo = String(rowBasic[1] || "").replace(/'/g, "");
      const rawHouse = String(rowBasic[2] || "").replace(/'/g, "").toLowerCase();

      let isMatch = true;
      if (searchMoo && rawMoo !== searchMoo) isMatch = false;
      if (searchHouse && !rawHouse.includes(searchHouse)) isMatch = false;

      if (isMatch) {
        // เพิ่มลงตาราง
        tableData.push([
          String(rowBasic[0] || ""), // Key
          String(rowBasic[1] || ""), // Moo
          String(rowBasic[2] || ""), // House
          String(rowBasic[3] || ""), // Name
          String(rowBasic[4] || ""), // ID
          String(rowBasic[5] || "")  // Phone
        ]);

        // คำนวณสถิติจากการ์ด (ใช้ข้อมูลจาก statsInfo แถวเดียวกัน)
        const rowStats = statsInfo[i];
        stats.households++;
        
        // Dog = M+F (Index 0 + 3)
        stats.dogActual += (Number(rowStats[0])||0) + (Number(rowStats[3])||0);
        
        // Cat = M+F (Index 6 + 9)
        stats.catActual += (Number(rowStats[6])||0) + (Number(rowStats[9])||0);

        // Vax (1, 4, 7, 10)
        stats.vaccinated += (Number(rowStats[1])||0) + (Number(rowStats[4])||0) + (Number(rowStats[7])||0) + (Number(rowStats[10])||0);
        
        // Neuter (2, 5, 8, 11)
        stats.neutered += (Number(rowStats[2])||0) + (Number(rowStats[5])||0) + (Number(rowStats[8])||0) + (Number(rowStats[11])||0);
      }
    }
    
    stats.totalActual = stats.dogActual + stats.catActual;

    return { success: true, cardData: stats, tableData: tableData };

  } catch (e) {
    Logger.log("Error: " + e.toString());
    return { success: false, error: e.message };
  }
}

/**
 * 4. Helper: ดึงข้อมูลสมาชิกสั้นๆ (สำหรับ Modal แก้ไข)
 */
function getMemberDetailsForKey(householdKey) {
  // ฟังก์ชันนี้เร็วอยู่แล้ว เพราะค้นหาแค่แถวเดียวและคืนค่าเลย
  if (!householdKey) return { success: false, message: "No Key" };
  try {
    const householdSheet = getHouseholdSheet();
    const data = householdSheet.getDataRange().getValues(); // จำเป็นต้องดึงมาหา Key
    
    const keyParts = householdKey.split('-');
    if (keyParts.length < 2) return { success: false, message: "Invalid Key" };
    const moo = keyParts.pop();
    const houseNo = keyParts.join('-');

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(moo) && String(data[i][2]) === String(houseNo)) {
        return {
          success: true,
          data: {
            fullName: data[i][3],
            idCard: data[i][4],
            phone: data[i][5]
          }
        };
      }
    }
    return { success: false, message: "Not found" };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * 5. Helper: ดึงข้อมูลสัตว์สั้นๆ (สำหรับ Check logic)
 */
function getPublicPetData(moo, houseNo) {
  // ปรับให้ใช้ข้อมูลจาก Household_Data แทนการนับใหม่
  try {
    const householdSheet = getHouseholdSheet();
    // ดึง A-C (Check House) และ T-AE (Stats)
    const lastRow = householdSheet.getLastRow();
    const basic = householdSheet.getRange(2, 1, lastRow-1, 3).getValues(); // A-C
    const stats = householdSheet.getRange(2, 20, lastRow-1, 12).getValues(); // T-AE

    for (let i = 0; i < basic.length; i++) {
      if (String(basic[i][1]) === String(moo) && String(basic[i][2]) === String(houseNo)) {
        const rowStats = stats[i];
        const actualDog = (Number(rowStats[0])||0) + (Number(rowStats[3])||0);
        const actualCat = (Number(rowStats[6])||0) + (Number(rowStats[9])||0);
        
        return { success: true, actualDog: actualDog, targetDog: 0, actualCat: actualCat, targetCat: 0 };
      }
    }
    return { success: true, actualDog: 0, targetDog: 0, actualCat: 0, targetCat: 0 };
  } catch (e) {
    return { error: e.message };
  }
}

// นำไปวางในไฟล์ .gs ไฟล์ไหนก็ได้ (เช่น Dashboard_Data.gs)
function getLostPetsPublic() {
  const sheet = getHouseholdSheet().getParent().getSheetByName('Pets_Individual');
  const data = sheet.getDataRange().getValues();
  const lostPets = [];

  // วนลูปเช็คทีละแถว (เริ่มแถวที่ 2 ข้ามหัวตาราง)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // ⚠️ จุดสำคัญ: ต้องแก้เลข Index ให้ตรงกับคอลัมน์จริงใน Google Sheet
    // สมมติ:
    // Col S (Index 18) = รูปภาพ
    // Col T (Index 19) = สถานะ (PetStatus) <-- ต้องเช็คว่าชีทจริงคุณอยู่คอลัมน์นี้ไหม
    // Col U (Index 20) = สถานที่หาย (MissingLocation)
    
    const status = row[19]; // แก้เลขนี้ให้ตรงคอลัมน์ PetStatus

    if (status === 'สูญหาย') {
      lostPets.push({
        PetName: row[2],       // Col C
        PetType: row[3],       // Col D
        Sex: row[4],           // Col E
        Breed: row[5],         // Col F
        ColorMark: row[6],     // Col G
        OwnerPhone: row[15],   // Col P (เบอร์โทร)
        PetImage: row[18],     // Col S (รูปภาพ)
        MissingLocation: row[20] // Col U (สถานที่หาย)
      });
    }
  }
  return { success: true, pets: lostPets };
}