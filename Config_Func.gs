/**
 * File: Config_Func.gs
 * จัดการบันทึกและดึงค่าการตั้งค่า UI (Server-side)
 */

function saveUiConfig(config) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('UI_CONFIG', JSON.stringify(config));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getUiConfig() {
  // ค่าเริ่มต้น (Vintage Theme) - ย้ายออกมาไว้นอก try เพื่อให้เรียกใช้ได้เสมอ
  const defaultConfig = {
    fontFamily: 'Sarabun',
    colHawthorne: '#283D3B', 
    colRoyal: '#795663',     
    colDusky: '#D9BCAF',     
    colBg: '#F9F7F5',        
    borderRadius: '12px',
    useGradient: 'true'      
  };

  try {
    const props = PropertiesService.getScriptProperties();
    const json = props.getProperty('UI_CONFIG');
    
    if (json) {
      return { ...defaultConfig, ...JSON.parse(json) };
    }
    return defaultConfig;
  } catch (e) {
    // ⚠️ แก้ไข: ถ้า Error ให้ส่งค่า Default กลับไป ห้ามส่งค่าว่าง {}
    return defaultConfig; 
  }
}

function resetUiConfig() {
  PropertiesService.getScriptProperties().deleteProperty('UI_CONFIG');
  return { success: true };
}