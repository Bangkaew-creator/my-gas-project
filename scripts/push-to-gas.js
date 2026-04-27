#!/usr/bin/env node
/**
 * push-to-gas.js — Push GAS project to Google Apps Script via clasp
 *
 * รองรับการตั้งค่า credential แบบ ไม่ต้อง shell:
 *   - ไฟล์ clasprc.json ใน workspace root (ลากใส่ผ่าน Replit Files)
 *   - หรือ Secret ชื่อ CLASPRC_JSON (วางเนื้อหาใน Replit Secrets UI)
 *
 * ตั้ง Script ID ได้สองทาง:
 *   - แก้ไฟล์ .clasp.json โดยตรง
 *   - หรือ Secret ชื่อ GAS_SCRIPT_ID
 *
 * ใช้งาน: คลิกปุ่ม Run ของ workflow "Push to GAS"
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TMP_AUTH = path.join(os.tmpdir(), '.clasprc.gas-push.json');
const PROJECT_FILE = path.join(ROOT, '.clasp.json');

function die(msg, hint) {
  console.error('\n❌ ' + msg);
  if (hint) console.error('   💡 ' + hint);
  process.exit(1);
}

function ok(msg) { console.log('✅ ' + msg); }
function info(msg) { console.log('   ' + msg); }

// 1) หา credential
let claspRc = null;
const localCreds = path.join(ROOT, 'clasprc.json');
if (process.env.CLASPRC_JSON) {
  console.log('🔑 ใช้ credential จาก Secret CLASPRC_JSON');
  claspRc = process.env.CLASPRC_JSON;
} else if (fs.existsSync(localCreds)) {
  console.log('🔑 ใช้ credential จากไฟล์ ./clasprc.json');
  claspRc = fs.readFileSync(localCreds, 'utf8');
} else {
  die(
    'ไม่พบ credential ของ clasp',
    'วาง Secret ชื่อ CLASPRC_JSON ใน Replit Secrets\n' +
    '      หรือลากไฟล์ clasprc.json (จาก ~/.clasprc.json บนเครื่องคุณ) เข้า workspace'
  );
}

// ตรวจสอบ format
try {
  const obj = JSON.parse(claspRc);
  if (!obj.token && !obj.tokens && !obj.default) {
    die('Credential format ไม่ถูกต้อง (ต้องมี field token/tokens/default)',
        'ตรวจว่าได้คัดลอก ~/.clasprc.json ทั้งไฟล์มา');
  }
} catch (e) {
  die('CLASPRC_JSON parse ไม่ได้: ' + e.message);
}

fs.writeFileSync(TMP_AUTH, claspRc, { mode: 0o600 });

// 2) หา/สร้าง .clasp.json
let scriptId = process.env.GAS_SCRIPT_ID || '';
if (fs.existsSync(PROJECT_FILE)) {
  try {
    const cur = JSON.parse(fs.readFileSync(PROJECT_FILE, 'utf8'));
    if (cur.scriptId) scriptId = cur.scriptId;
  } catch (_) {}
}

if (!scriptId) {
  die(
    'ไม่พบ Script ID',
    'วาง Secret ชื่อ GAS_SCRIPT_ID หรือสร้าง .clasp.json ที่ root\n' +
    '      หา Script ID ได้จาก GAS editor → ⚙️ Project Settings'
  );
}

const projectConfig = { scriptId: scriptId, rootDir: ROOT };
fs.writeFileSync(PROJECT_FILE, JSON.stringify(projectConfig, null, 2));
ok('Script ID: ' + scriptId);

// 3) สร้าง .claspignore เพื่อข้ามไฟล์ที่ไม่ใช่ของ GAS
const ignoreFile = path.join(ROOT, '.claspignore');
if (!fs.existsSync(ignoreFile)) {
  const ignore = [
    '**/**',
    '!*.gs',
    '!*.html',
    '!appsscript.json'
  ].join('\n');
  fs.writeFileSync(ignoreFile, ignore);
  info('สร้าง .claspignore แล้ว');
}

// 4) Push!
console.log('\n🚀 กำลัง push ไป GAS...\n');
const result = spawnSync(
  'clasp',
  ['push', '--force', '-A', TMP_AUTH, '-P', PROJECT_FILE],
  { stdio: 'inherit', cwd: ROOT }
);

// ลบไฟล์ credential ชั่วคราว
try { fs.unlinkSync(TMP_AUTH); } catch (_) {}

if (result.status !== 0) {
  die('clasp push ล้มเหลว (exit ' + result.status + ')',
      'อ่าน error ด้านบน — ส่วนใหญ่มาจาก credential หมดอายุ → login ใหม่บนคอม แล้วอัปโหลด clasprc.json อีกครั้ง');
}

ok('\nPush สำเร็จ! 🎉  เปิด GAS editor ดูได้เลย');
