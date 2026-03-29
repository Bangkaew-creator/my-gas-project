/**
 * ฟังก์ชันดึงข้อมูลสำหรับ Volunteer (เห็นเฉพาะหมู่ตัวเอง + ปิดเลขบัตร)
 */
function getVolunteerDashboardData(householdKey) {
  try {
    const householdSheet = getHouseholdSheet();
    const data = householdSheet.getDataRange().getValues();
    
    // 1. หาข้อมูลของตัว Volunteer เองก่อน (เพื่อดูว่าอยู่หมู่ไหน)
    let volunteerMoo = "";
    let isVolunteer = false;

    // ค้นหาแถวของผู้เรียกใช้ (householdKey)
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(householdKey)) {
        // เช็ค Role (สมมติ Role อยู่คอลัมน์ AG index 32)
        // เช็ค Moo (สมมติ Moo อยู่คอลัมน์ B index 1)
        if (data[i][32] === 'Volunteer') { 
           isVolunteer = true;
           volunteerMoo = String(data[i][1]).replace(/'/g, ''); 
        }
        break;
      }
    }

    if (!isVolunteer) {
      return { error: "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ (สำหรับอาสาสมัครเท่านั้น)" };
    }

    // 2. รวบรวมข้อมูลในหมู่เดียวกัน
    let householdsInMoo = [];
    let stats = { dogs: 0, cats: 0, total: 0, households: 0 };

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const currentMoo = String(row[1]).replace(/'/g, '');

      // กรองเฉพาะหมู่เดียวกัน
      if (currentMoo === volunteerMoo) {
        // --- ส่วนสำคัญ: ปิดบังเลขบัตรประชาชน ---
        let rawId = String(row[4]).replace(/'/g, ''); // สมมติ ID อยู่คอลัมน์ E (index 4)
        let maskedId = rawId.length > 4 
                       ? "XXX-XXX-" + rawId.slice(-4) 
                       : (rawId || "-");

        // เก็บข้อมูลเท่าที่จำเป็น
        householdsInMoo.push({
          key: row[0],
          houseNo: row[2],
          ownerName: row[3],
          idCard: maskedId, // ✅ ส่งเฉพาะเลขที่ปิดบังแล้ว
          phone: row[5],
          dogCount: (Number(row[19]) || 0) + (Number(row[22]) || 0), // (T+W) สุนัข ช+ญ
          catCount: (Number(row[25]) || 0) + (Number(row[28]) || 0)  // (Z+AC) แมว ช+ญ
        });
        
        // นับยอดรวม
        stats.households++;
        stats.dogs += ((Number(row[19]) || 0) + (Number(row[22]) || 0));
        stats.cats += ((Number(row[25]) || 0) + (Number(row[28]) || 0));
      }
    }
    
    stats.total = stats.dogs + stats.cats;

    return { 
      success: true, 
      volunteerMoo: volunteerMoo,
      stats: stats,
      list: householdsInMoo 
    };

  } catch (e) {
    return { error: e.message };
  }
}