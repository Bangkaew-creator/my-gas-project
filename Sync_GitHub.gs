/**
 * ===============================================================
 *  Sync_GitHub.gs - ดึงโค้ดจาก GitHub มาอัปเดต GAS Project ตัวเอง
 * ===============================================================
 *  วิธีใช้:
 *  1) ตั้งค่า Script Property:
 *       GITHUB_REPO   = "Bangkaew-creator/my-gas-project"
 *       GITHUB_BRANCH = "main"  (ถ้าไม่ตั้ง จะใช้ main)
 *       GITHUB_TOKEN  = "ghp_xxx"  (เฉพาะ private repo)
 *  2) เปิด Apps Script API ที่ https://script.google.com/home/usersettings
 *  3) Authorize Script ใหม่ (เพราะมี OAuth scope เพิ่ม)
 *  4) ผู้ใช้ Admin คลิกปุ่ม "Sync จาก GitHub" ในหน้า Dashboard
 * ===============================================================
 */

var SYNC_FILE_TYPES_ = {
  gs:   'SERVER_JS',
  html: 'HTML',
  json: 'JSON'
};

/** อ่าน Script Properties */
function getSyncConfig_() {
  var p = PropertiesService.getScriptProperties();
  return {
    repo:   p.getProperty('GITHUB_REPO')   || 'Bangkaew-creator/my-gas-project',
    branch: p.getProperty('GITHUB_BRANCH') || 'main',
    token:  p.getProperty('GITHUB_TOKEN')  || ''
  };
}

/** ตรวจสอบสิทธิ์ Admin โดยใช้ session token จาก client (Auth.gs#checkSession) */
function requireAdmin_(sessionToken) {
  if (typeof checkSession !== 'function') {
    throw new Error('AUTH_NOT_AVAILABLE');
  }
  var user = checkSession(sessionToken);
  if (!user || user.role !== 'Admin') {
    throw new Error('NOT_ADMIN');
  }
  return user;
}

/** บันทึก log แล้วคืน error message ที่ปลอดภัย (ไม่รวม stack/HTTP body) */
function safeError_(e) {
  try { console.error('[Sync] ' + (e && e.stack || e)); } catch (_) {}
  var msg = (e && e.message) ? String(e.message) : String(e);
  if (msg === 'NOT_ADMIN') return 'ต้องเป็น Admin เท่านั้นจึงจะใช้งานได้';
  if (msg === 'AUTH_NOT_AVAILABLE') return 'ระบบ session ยังไม่พร้อม';
  // ตัด stack trace, เนื้อหา HTTP body ที่อาจหลุดมา
  return msg.split('\n')[0].substring(0, 200);
}

/** เรียกจากหน้าเว็บเพื่อแสดงค่าปัจจุบัน (ต้องเป็น Admin) */
function getSyncStatus(sessionToken) {
  try {
    requireAdmin_(sessionToken);
    var cfg = getSyncConfig_();
    var lastSync = PropertiesService.getScriptProperties().getProperty('LAST_SYNC_AT') || '';
    return {
      success: true,
      repo: cfg.repo,
      branch: cfg.branch,
      hasToken: !!cfg.token,
      lastSyncAt: lastSync,
      scriptId: ScriptApp.getScriptId()
    };
  } catch (e) {
    return { success: false, message: safeError_(e) };
  }
}

/** บันทึกการตั้งค่าจากหน้าเว็บ (เฉพาะ Admin) */
function saveSyncConfig(sessionToken, repo, branch, token) {
  try {
    requireAdmin_(sessionToken);
    var p = PropertiesService.getScriptProperties();
    if (repo)   p.setProperty('GITHUB_REPO', String(repo).trim());
    if (branch) p.setProperty('GITHUB_BRANCH', String(branch).trim());
    if (token !== undefined && token !== null) {
      if (token === '') p.deleteProperty('GITHUB_TOKEN');
      else p.setProperty('GITHUB_TOKEN', String(token).trim());
    }
    return { success: true, message: 'บันทึกการตั้งค่าเรียบร้อย' };
  } catch (e) {
    return { success: false, message: safeError_(e) };
  }
}

/** ทดสอบการเชื่อมต่อ GitHub (เฉพาะ Admin) */
function testGitHubConnection(sessionToken) {
  try {
    requireAdmin_(sessionToken);
    var files = listGitHubFiles_();
    return {
      success: true,
      message: 'เชื่อมต่อ GitHub ได้ ✓',
      fileCount: files.length,
      files: files.map(function(f) { return f.name; })
    };
  } catch (e) {
    return { success: false, message: safeError_(e) };
  }
}

/**
 * ฟังก์ชันหลัก - ดึงโค้ดจาก GitHub แล้วอัปเดต GAS ตัวเอง (เฉพาะ Admin)
 * เรียกจากปุ่มในหน้า Admin Dashboard
 */
function syncFromGitHub(sessionToken) {
  try {
    requireAdmin_(sessionToken);

    var cfg = getSyncConfig_();
    var scriptId = ScriptApp.getScriptId();
    var token = ScriptApp.getOAuthToken();

    // 1) ดาวน์โหลดรายการไฟล์ + เนื้อหาจาก GitHub
    var ghFiles = listGitHubFiles_();
    if (!ghFiles.length) {
      return { success: false, message: 'ไม่พบไฟล์ใน GitHub repo ' + cfg.repo + '@' + cfg.branch };
    }

    var files = [];
    var skipped = [];
    for (var i = 0; i < ghFiles.length; i++) {
      var f = ghFiles[i];
      var ext = (f.name.split('.').pop() || '').toLowerCase();
      var type = SYNC_FILE_TYPES_[ext];
      if (!type) { skipped.push(f.name); continue; }

      var source = fetchGitHubRaw_(f.download_url);
      var name = f.name.replace(/\.(gs|html|json)$/i, '');
      // GAS เก็บ manifest เป็นชื่อ "appsscript" type JSON
      files.push({ name: name, type: type, source: source });
    }

    // 2) อ่านไฟล์เดิม เพื่อกัน manifest หาย และเก็บไฟล์ที่ไม่ได้อยู่ใน GitHub
    var current = getCurrentScriptContent_(scriptId, token);
    var ghNameSet = {};
    files.forEach(function(f) { ghNameSet[f.name + '|' + f.type] = true; });

    // เก็บไฟล์เดิมที่ไม่อยู่ใน GitHub ไว้ (ป้องกันการลบโดยไม่ตั้งใจ)
    var preserved = [];
    if (current && current.files) {
      current.files.forEach(function(f) {
        if (!ghNameSet[f.name + '|' + f.type]) {
          preserved.push(f.name);
          files.push(f);
        }
      });
    }

    // 3) PUT updateContent
    var resp = UrlFetchApp.fetch(
      'https://script.googleapis.com/v1/projects/' + scriptId + '/content',
      {
        method: 'put',
        contentType: 'application/json',
        muteHttpExceptions: true,
        headers: { 'Authorization': 'Bearer ' + token },
        payload: JSON.stringify({ files: files })
      }
    );

    var code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      try { console.error('[Sync] updateContent HTTP ' + code + ': ' + resp.getContentText().substring(0, 500)); } catch (_) {}
      return {
        success: false,
        message: 'อัปเดตไม่สำเร็จ (HTTP ' + code + ')',
        hint: code === 403
          ? 'กรุณาเปิด Apps Script API ที่ https://script.google.com/home/usersettings'
          : (code === 401 ? 'Authorize Script ใหม่ (Run ฟังก์ชันใดๆ จาก Editor 1 ครั้ง)' : '')
      };
    }

    PropertiesService.getScriptProperties().setProperty(
      'LAST_SYNC_AT',
      Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss')
    );

    var updatedCount = files.length - preserved.length;
    return {
      success: true,
      message: 'Sync สำเร็จ ✓ อัปเดต ' + updatedCount + ' ไฟล์ (คงเดิม ' + preserved.length + ')',
      updated: updatedCount,
      total: files.length,
      preserved: preserved,
      skipped: skipped
    };
  } catch (e) {
    return { success: false, message: safeError_(e) };
  }
}

/** ดึงรายชื่อไฟล์ใน root ของ repo ผ่าน GitHub Contents API */
function listGitHubFiles_() {
  var cfg = getSyncConfig_();
  var url = 'https://api.github.com/repos/' + cfg.repo + '/contents/?ref=' + encodeURIComponent(cfg.branch);
  var headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'GAS-Sync' };
  if (cfg.token) headers['Authorization'] = 'token ' + cfg.token;

  var resp = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true, headers: headers });
  var code = resp.getResponseCode();
  if (code !== 200) {
    throw new Error('GitHub API HTTP ' + code + ': ' + resp.getContentText().substring(0, 300));
  }
  var arr = JSON.parse(resp.getContentText());
  if (!Array.isArray(arr)) throw new Error('GitHub API ส่งข้อมูลผิดรูปแบบ');

  // เก็บเฉพาะไฟล์ (type=file) นามสกุล .gs / .html / .json
  return arr.filter(function(f) {
    if (f.type !== 'file') return false;
    var ext = (f.name.split('.').pop() || '').toLowerCase();
    return SYNC_FILE_TYPES_.hasOwnProperty(ext);
  });
}

/** ดึงเนื้อหาดิบของไฟล์ */
function fetchGitHubRaw_(rawUrl) {
  var cfg = getSyncConfig_();
  var headers = { 'User-Agent': 'GAS-Sync' };
  if (cfg.token) headers['Authorization'] = 'token ' + cfg.token;

  var resp = UrlFetchApp.fetch(rawUrl, { method: 'get', muteHttpExceptions: true, headers: headers });
  if (resp.getResponseCode() !== 200) {
    throw new Error('โหลดไฟล์ไม่ได้: ' + rawUrl + ' (HTTP ' + resp.getResponseCode() + ')');
  }
  return resp.getContentText();
}

/** อ่านเนื้อหา script ปัจจุบันผ่าน Apps Script API */
function getCurrentScriptContent_(scriptId, token) {
  try {
    var resp = UrlFetchApp.fetch(
      'https://script.googleapis.com/v1/projects/' + scriptId + '/content',
      {
        method: 'get',
        muteHttpExceptions: true,
        headers: { 'Authorization': 'Bearer ' + token }
      }
    );
    if (resp.getResponseCode() !== 200) return null;
    return JSON.parse(resp.getContentText());
  } catch (e) {
    return null;
  }
}
