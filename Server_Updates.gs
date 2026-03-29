/**
 * ฟังก์ชันสลับสถานะแจ้งหาย + บันทึกพิกัด (เวอร์ชันแก้ไขสมบูรณ์)
 */
function togglePetMissingStatus(petId, householdKey, isMissing, location) {
  try {
    const sheet = getHouseholdSheet().getParent().getSheetByName('Pets_Individual');
    const data = sheet.getDataRange().getValues();
    
    // -----------------------------------------------------------
    // ⚠️ ตั้งค่าเลขคอลัมน์ให้ตรงกับ Google Sheet จริงของคุณ
    // A=1, B=2, ..., S=19 (รูปภาพ), T=20, U=21
    // -----------------------------------------------------------
    const COL_STATUS = 20; // คอลัมน์ T (สำหรับเก็บสถานะ 'ปกติ'/'สูญหาย')
    const COL_LOCATION = 21; // คอลัมน์ U (สำหรับเก็บสถานที่หาย)

    // ตรวจสอบว่ามีข้อมูลส่งมาหรือไม่
    const locText = location ? location.toString() : "";

    for (let i = 1; i < data.length; i++) {
      // ตรวจสอบ PetID (คอลัมน์ A = index 0)
      if (String(data[i][0]) === String(petId)) {
        
        const status = isMissing ? 'สูญหาย' : 'ปกติ';
        const locationToSave = isMissing ? locText : ''; // ถ้าเจอแล้ว ให้ลบสถานที่ออก

        // บันทึกลง Sheet (ใช้ i+1 เพราะแถวใน Sheet เริ่มที่ 1 แต่ Array เริ่มที่ 0)
        sheet.getRange(i + 1, COL_STATUS).setValue(status);
        sheet.getRange(i + 1, COL_LOCATION).setValue(locationToSave);
        
        return { success: true, status: status, location: locationToSave };
      }
    }
    return { success: false, error: "ไม่พบ PetID นี้ในระบบ" };
  } catch (e) {
    Logger.log("Error in togglePetMissingStatus: " + e.toString());
    return { success: false, error: e.message };
  }
}
