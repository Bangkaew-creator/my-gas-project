/**
 * File: Auth.gs (Refactored)
 * (โค้ดทั้งหมดที่ถูกต้อง ณ สิ้นสุด Step 23.2 - STABLE)
 */

/**
 * ฟังก์ชันสำหรับล็อกอิน (อัปเดต Step 21 - Hashing)
 */
function doLogin(householdKey, password) {
  try {
    const sheet = getHouseholdSheet();
    if (!householdKey || !password) {
      return { success: false, message: "กรุณากรอกข้อมูลบ้านเลขที่, หมู่, และรหัสผ่าน" };
    }
    
    // ดึงข้อมูลทั้งหมด รวมถึงคอลัมน์ AF (Pass) และ AH (Salt)
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: "ไม่พบข้อมูลในระบบ" };

    const data = sheet.getRange("A2:AH" + lastRow).getValues();

    const keyParts = householdKey.split('-');
    if (keyParts.length < 2) return { success: false, message: "Key ไม่ถูกต้อง" };
    const moo = keyParts.pop(); // เอาตัวสุดท้าย (หมู่)
    const houseNo = keyParts.join('-'); // เอาที่เหลือ (บ้านเลขที่)


    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      // ค้นหาด้วย B (Moo) และ C (HouseNo)
      if (String(row[1]) === String(moo) && String(row[2]) === String(houseNo)) {
        
        const storedHash = row[31]; // AF (Password)
        const salt = row[33];       // AH (Salt)
        
        if (!salt || !storedHash) {
          return { success: false, message: "บัญชียังไม่ได้เปิดใช้งาน กรุณา'สมัครสมาชิก'ก่อน" };
        }
        
        // (ใหม่ Step 21) Hash รหัสที่กรอกเข้ามา โดยใช้ Salt เดิม
        const inputHash = hashPassword(password, salt);
        
        if (storedHash === inputHash) {
          // ล็อกอินสำเร็จ
          const userData = {
            householdKey: row[0] || householdKey, // A
            role: row[32], // AG
            name: row[3] // D
          };
          
          if (!row[0]) {
             return { success: false, message: "บัญชียังไม่ได้เปิดใช้งาน (ไม่มี Key) กรุณาติดต่อ Admin" };
          }
          
          const token = Utilities.getUuid(); 
          const cache = CacheService.getUserCache(); 
          cache.put(token, JSON.stringify(userData), 1800); 

          return {
            success: true,
            token: token, 
            userData: userData 
          };
        } else {
          return { success: false, message: "รหัสผ่านไม่ถูกต้อง" };
        }
      }
    }
    
    return { success: false, message: "ไม่พบข้อมูลบ้านเลขที่-หมู่นี้ในระบบ" };

  } catch (error) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + error.message };
  }
}

/**
 * ฟังก์ชันสำหรับสมัครสมาชิก (อัปเดต Step 21 - Hashing)
 */
function doRegister(formData) {
  try {
    if (!formData.houseNo || !formData.moo || !formData.password || !formData.fullName || !formData.phone) {
      return { success: false, message: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (ยกเว้นหมายเลขบัตรประชาชน)" };
    }

    const sheet = getHouseholdSheet();
    const householdKey = formData.houseNo + "-" + formData.moo; 

    // (ใหม่ Step 21) สร้าง Salt และ Hash
    const salt = createSalt();
    const hashedPassword = hashPassword(formData.password, salt);

    const lastRow = sheet.getLastRow();
    let data = [];
    if (lastRow >= 2) {
      const range = sheet.getRange("A2:AH" + lastRow); // (แก้ไข) ต้องดึงถึง AH
      data = range.getValues();
    }

    let rowFoundIndex = -1; 

    for (let i = 0; i < data.length; i++) {
      if (String(data[i][1]) === String(formData.moo) && String(data[i][2]) === String(formData.houseNo)) {
        rowFoundIndex = i;
        break;
      }
    }

    if (rowFoundIndex === -1) {
      // สถานการณ์ A: ไม่พบบ้าน (สร้างใหม่)
      const newRow = [
        householdKey,            // A
        formData.moo,            // B
        formData.houseNo,        // C
        formData.fullName,       // D
        "'" + (formData.idCard || ""),   // E
        "'" + (formData.phone || ""),    // F
        "บริเวณบ้าน",            // G
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // H-S
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // T-AE
        hashedPassword,          // AF: Hashed Password
        "Member",                // AG: Role
        salt                     // AH: Salt
      ];
      sheet.appendRow(newRow);
      return { success: true, householdKey: householdKey, action: "created" };
    }
    else {
      // สถานการณ์ B: พบบ้านเดิม
      const existingPassword = data[rowFoundIndex][31]; // AF

      if (existingPassword) {
        return { success: false, message: "บ้านเลขที่และหมู่นี้ ถูกลงทะเบียนเปิดใช้งานบัญชีแล้ว" };
      }

      // เปิดใช้งานบัญชี
      const targetRowIndex = rowFoundIndex + 2; 
      
      sheet.getRange(targetRowIndex, 1).setValue(householdKey); // A
      sheet.getRange(targetRowIndex, 4).setValue(formData.fullName); // D
      sheet.getRange(targetRowIndex, 5).setValue("'" + (formData.idCard || "")); // E
      sheet.getRange(targetRowIndex, 6).setValue("'" + (formData.phone || "")); // F
      sheet.getRange(targetRowIndex, 32).setValue(hashedPassword); // AF: Hashed Password
      sheet.getRange(targetRowIndex, 33).setValue("Member"); // AG: Role
      sheet.getRange(targetRowIndex, 34).setValue(salt); // AH: Salt
      
      return { success: true, householdKey: householdKey, action: "updated" };
    }

  } catch (error) {
    Logger.log(error);
    return { success: false, message: "เกิดข้อผิดพลาด: " + error.message };
  }
}

/**
 * ตรวจสอบ Session Token
 */
function checkSession(token) {
  try {
    if (!token) return null;
    const cache = CacheService.getUserCache();
    const data = cache.get(token); 
    if (data) {
      return JSON.parse(data); 
    }
    return null; 
  } catch (error) {
    return null;
  }
}

/**
 * ออกจากระบบ
 */
function doLogout(token) {
  try {
    if (!token) return;
    const cache = CacheService.getUserCache();
    cache.remove(token); 
  } catch (error) {
    // ไม่ต้องทำอะไร
  }
}

/**
 * (อัปเดต Step 21) สมาชิกเปลี่ยนรหัสผ่านด้วยตนเอง
 */
function changeMyPassword(householdKey, oldPass, newPass) {
  if (!householdKey || !oldPass || !newPass) {
    return { success: false, message: "ข้อมูลไม่ถูกต้อง" };
  }
  
  try {
    const sheet = getHouseholdSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: "ไม่พบข้อมูลผู้ใช้งาน" };

    const householdRange = sheet.getRange("A2:AH" + lastRow); // (แก้ไข) ดึงถึง AH
    const householdData = householdRange.getValues();

    // ค้นหาด้วย Key (คอลัมน์ A)
    let targetRowIndex = -1;
    let currentRow = null;
    
    for (let i = 0; i < householdData.length; i++) {
      if (householdData[i][0] === householdKey) {
        targetRowIndex = i + 2; // +2 เพราะ data เริ่มที่แถว 2
        currentRow = householdData[i];
        break;
      }
    }

    if (targetRowIndex === -1) {
      return { success: false, message: "ไม่พบข้อมูลผู้ใช้งาน" };
    }
    
    // ตรวจสอบรหัสผ่านเก่า
    const storedHash = currentRow[31]; // AF
    const salt = currentRow[33]; // AH
    
    if (!salt) return { success: false, message: "บัญชีเกิดข้อผิดพลาด (ไม่มี Salt)"};
    
    const oldHash = hashPassword(oldPass, salt);
    
    if (storedHash !== oldHash) {
      return { success: false, message: "รหัสผ่านเดิมไม่ถูกต้อง" };
    }
    
    // (ใหม่ Step 21) สร้าง Hash + Salt ใหม่
    const newSalt = createSalt();
    const newHashedPassword = hashPassword(newPass, newSalt);
    
    // อัปเดตรหัสผ่านใหม่
    sheet.getRange(targetRowIndex, 32).setValue(newHashedPassword); // AF: Password
    sheet.getRange(targetRowIndex, 34).setValue(newSalt); // AH: Salt
    
    return { success: true };

  } catch (error) {
    Logger.log(error);
    return { success: false, message: error.message };
  }
}