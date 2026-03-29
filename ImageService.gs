// ------------------------------------------------------------------------
// 🔴 นำ ID โฟลเดอร์มาใส่ตรงนี้เหมือนเดิมครับ
const IMAGE_FOLDER_ID = '1zhIeIWoT2HmIlXDztHD69KmQsbW3UD7S'; 
// ------------------------------------------------------------------------

function savePetImage(base64Data, petId, householdKey) {
  try {
    // 1. ตรวจสอบ ID
    if (!IMAGE_FOLDER_ID || IMAGE_FOLDER_ID.includes('นำ_FOLDER_ID_มาใส่ตรงนี้')) {
      throw new Error("กรุณาระบุ IMAGE_FOLDER_ID ให้ถูกต้องครับ");
    }

    const folder = DriveApp.getFolderById(IMAGE_FOLDER_ID);
    
    // 2. แปลง Base64
    const contentType = base64Data.substring(5, base64Data.indexOf(';'));
    const decoded = Utilities.base64Decode(base64Data.substring(base64Data.indexOf(',') + 1));
    const blob = Utilities.newBlob(decoded, contentType, petId + ".jpg"); 
    
    // 3. ลบรูปเดิม (ถ้ามี)
    const existingFiles = folder.getFilesByName(petId + ".jpg");
    while (existingFiles.hasNext()) {
      existingFiles.next().setTrashed(true);
    }
    
    // 4. สร้างไฟล์ใหม่
    const file = folder.createFile(blob);
    
    // 5. ตั้งค่าแชร์ (สำคัญ)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // 6. ✅✅✅ แก้ไขจุดนี้: เปลี่ยนรูปแบบ URL เป็นแบบ lh3 (Direct Link)
    // รูปแบบนี้จะแสดงผลในเว็บได้เสถียรกว่าแบบ uc?export=view
    const imageUrl = "https://lh3.googleusercontent.com/d/" + file.getId();

    // 7. บันทึก URL ลง Sheet
    updateImageUrlInSheet(petId, householdKey, imageUrl);
    
    return { success: true, url: imageUrl };
    
  } catch (e) {
    Logger.log("Error: " + e.message);
    return { success: false, error: e.message };
  }
}

function updateImageUrlInSheet(petId, householdKey, url) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pets_Individual'); 
  if (!sheet) throw new Error("ไม่พบ Sheet Pets_Individual");

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(petId)) {
      // บันทึกลง Col S (Index 18)
      sheet.getRange(i + 1, 19).setValue(url); 
      break;
    }
  }
}