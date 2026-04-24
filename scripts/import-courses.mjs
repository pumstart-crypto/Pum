/**
 * import-courses.mjs
 * 개설강좌일람표 xlsx 파일들을 DB에 import합니다.
 *
 * 사용법: node scripts/import-courses.mjs
 *
 * attached_assets/ 에서 timestamp 177702476xxxx 를 포함한 xlsx 파일을 자동 탐색합니다.
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const xlsx = require('/home/runner/workspace/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/xlsx.js');
const { Client } = require('/home/runner/workspace/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js');
const fs = require('fs');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const ASSET_DIR = '/home/runner/workspace/attached_assets/';

// Korean semester values encoded as UTF-8 byte sequences to avoid NFD/NFC mismatch issues
// when this file is loaded as ESM (which may re-normalize Unicode).
//   gyeoul    = 겨울   (U+ACA8 U+C6B8)
//   gyeoulDoyak = 겨울도약 (U+ACA8 U+C6B8 U+B3C4 U+C57D)
//   yeoreum   = 여름   (U+C5EC U+B984)
//   yeoreumDoyak = 여름도약 (U+C5EC U+B984 U+B3C4 U+C57D)
const G  = Buffer.from([0xEA,0xB2,0xA8,0xEC,0x9A,0xB8]).toString();            // 겨울
const GD = Buffer.from([0xEA,0xB2,0xA8,0xEC,0x9A,0xB8,0xEB,0x8F,0x84,0xEC,0x95,0xBD]).toString(); // 겨울도약
const Y  = Buffer.from([0xEC,0x97,0xAC,0xEB,0xA6,0x84]).toString();            // 여름
const YD = Buffer.from([0xEC,0x97,0xAC,0xEB,0xA6,0x84,0xEB,0x8F,0x84,0xEC,0x95,0xBD]).toString(); // 여름도약

/**
 * Detect (year, semester) from a filename WITHOUT using Korean string literals,
 * because on Linux the filenames may be stored in NFD Unicode form while
 * JavaScript source code literals are NFC — causing includes() to fail.
 *
 * File pattern: "{YEAR}학년도_{SEMTYPE}수업?_개설강좌일람표_{TS}.xlsx"
 * After NFD expansion:
 *   "2024" = positions 0-3
 *   학년도  = 8 NFD code units (학=3 + 년=3 + 도=2)
 *   "_"    = position 12 (first underscore)
 *   Next char at position 13:
 *     49  ('1')  → 1학기
 *     50  ('2')  → 2학기
 *     4352 (ᄀ)  → 겨울…
 *     4363 (ᄋ)  → 여름…
 *   Position 18 (after 겨울/여름 = 5 NFD chars):
 *     4355 (ᄃ) → 도약, otherwise → 계절
 */
function detectYearSem(fname) {
  const year = parseInt(fname.substring(0, 4), 10);
  if (isNaN(year)) return null;
  const us = fname.indexOf('_');        // first underscore at position 12
  if (us < 0) return null;
  const ch = fname.charCodeAt(us + 1); // semester type discriminator
  if (ch === 49) return { year, sem: '1' };
  if (ch === 50) return { year, sem: '2' };
  const ch2 = fname.charCodeAt(us + 6); // 계절(ᄀ=4352) vs 도약(ᄃ=4355)
  if (ch === 4352) return { year, sem: ch2 === 4355 ? GD : G }; // 겨울…
  if (ch === 4363) return { year, sem: ch2 === 4355 ? YD : Y }; // 여름…
  return null;
}

const FILES = fs.readdirSync(ASSET_DIR)
  .filter(f => f.includes('177702476') && f.endsWith('.xlsx'))
  .map(fname => {
    const meta = detectYearSem(fname);
    if (!meta) return null;
    return { file: ASSET_DIR + fname, year: meta.year, sem: meta.sem };
  })
  .filter(Boolean)
  .sort((a, b) => a.year - b.year || String(a.sem).localeCompare(String(b.sem)));

console.log(`Files to import (${FILES.length}):`);
FILES.forEach(f => console.log(`  ${f.year}-${f.sem}: ${f.file.split('/').pop().substring(0, 40)}`));

function parseGradeYear(val) {
  if (!val && val !== 0) return 0;
  const s = String(val).trim();
  // 전, 전학년
  if (!s || s.charCodeAt(0) === 51204) return 0;
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

// Column header search strings (from XLSX — NFC, safe to compare directly)
// Using Unicode escape sequences here so the mjs file stays ASCII-safe.
const HDR = {
  subjectName:     ['\uad50\uacfc\ubaa9\uba85'],          // 교과목명
  subjectCode:     ['\uad50\uacfc\ubaa9\ubc88\ud638', '\uad50\uacfc\ubaa9\ucf54\ub4dc'], // 교과목번호, 교과목코드
  section:         ['\ubd84\ubc18'],                       // 분반
  professor:       ['\uad50\uc218\uba85', '\ub2f4\ub2f9\uad50\uc218'], // 교수명, 담당교수
  timeRoom:        ['\uc2dc\uac04\ud45c', '\uac15\uc758\uc2e4'], // 시간표, 강의실
  gradeYear:       ['\ud559\ub144'],                       // 학년 (exclude 학년도)
  category:        ['\uad50\uacfc\ubaa9\uad6c\ubd84', '\uad50\uacfc\uad6c\ubd84', '\uc774\uc218\uad6c\ubd84'], // 교과목구분, 교과구분, 이수구분
  offeringDept:    ['\uc8fc\uad00\ud559\uacfc\uba85', '\uac1c\uc124\ud559\uacfc'], // 주관학과명, 개설학과
  credits:         ['\ud559\uc810'],                       // 학점
  isOnline:        ['\uc6d0\uaca9\uac15\uc88c\uc5ec\ubd80', '\uc6d0\uaca9\uc218\uc5c5', '\uc6d0\uaca9'], // 원격강좌여부, 원격수업, 원격
  isForeign:       ['\uc6d0\uc5b4\uac15\uc758', '\uc6d0\uc5b4'], // 원어강의, 원어
  enrollmentLimit: ['\uc218\uac15\uc81c\ud55c\uc778\uc6d0', '\uc81c\ud55c\uc778\uc6d0'], // 수강제한인원, 제한인원
};

function parseRows(file, year, sem) {
  const wb = xlsx.readFile(file);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    if (rows[i].some(c => String(c).includes(HDR.subjectName[0]))) { headerIdx = i; break; }
  }
  if (headerIdx < 0) { console.error(`  Header not found in ${file}`); return []; }

  const headers = rows[headerIdx].map(h => String(h).trim());
  const find = (...terms) => {
    for (const t of terms) {
      const idx = headers.findIndex(h => h.includes(t));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const col = {
    subjectName:     (() => {
      const c = headers.map((h, i) => ({ h, i })).filter(x =>
        x.h.includes(HDR.subjectName[0]) && !x.h.includes(HDR.subjectCode[0]) &&
        !x.h.includes(HDR.category[0]) && !x.h.includes(HDR.category[1]) && !x.h.includes(HDR.category[2])
      );
      return c.length > 0 ? c[0].i : -1;
    })(),
    subjectCode:     find(...HDR.subjectCode),
    section:         find(...HDR.section),
    professor:       find(...HDR.professor),
    timeRoom:        find(...HDR.timeRoom),
    gradeYear:       headers.findIndex(h => h.includes(HDR.gradeYear[0]) && !h.includes('\ud559\ub144\ub3c4')), // 학년도 제외
    category:        find(...HDR.category),
    offeringDept:    find(...HDR.offeringDept),
    credits:         find(...HDR.credits),
    isOnline:        find(...HDR.isOnline),
    isForeign:       find(...HDR.isForeign),
    enrollmentLimit: find(...HDR.enrollmentLimit),
  };

  const courses = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const name = col.subjectName >= 0 ? String(row[col.subjectName] || '').trim() : '';
    if (!name) continue;
    const isOnlineVal = col.isOnline >= 0 ? String(row[col.isOnline] || '').trim().toUpperCase() : '';
    const isForeignVal = col.isForeign >= 0 ? String(row[col.isForeign] || '').trim().toUpperCase() : '';
    courses.push({
      subject_name:     name,
      subject_code:     col.subjectCode >= 0 ? String(row[col.subjectCode] || '').trim() || null : null,
      section:          col.section >= 0 ? String(row[col.section] || '').trim() || null : null,
      professor:        col.professor >= 0 ? String(row[col.professor] || '').trim() || null : null,
      time_room:        col.timeRoom >= 0 ? String(row[col.timeRoom] || '').trim() || null : null,
      year,
      semester:         sem,
      grade_year:       parseGradeYear(col.gradeYear >= 0 ? row[col.gradeYear] : null),
      category:         col.category >= 0 ? String(row[col.category] || '').trim() || null : null,
      offering_dept:    col.offeringDept >= 0 ? String(row[col.offeringDept] || '').trim() || null : null,
      credits:          col.credits >= 0 ? (parseFloat(String(row[col.credits])) || null) : null,
      is_online:        isOnlineVal === 'Y' || isOnlineVal === 'O',
      is_foreign:       isForeignVal !== '' && isForeignVal !== 'N',
      enrollment_limit: col.enrollmentLimit >= 0 ? (parseInt(String(row[col.enrollmentLimit]), 10) || null) : null,
    });
  }
  return courses;
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('\nConnected to DB');

  const del = await client.query('DELETE FROM courses');
  console.log(`Deleted all existing: ${del.rowCount} rows`);

  let totalInserted = 0;

  for (const { file, year, sem } of FILES) {
    console.log(`\n=== ${year}-${sem} ===`);
    const courses = parseRows(file, year, sem);
    console.log(`  Parsed: ${courses.length} courses`);
    if (!courses.length) continue;

    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < courses.length; i += BATCH) {
      const batch = courses.slice(i, i + BATCH);
      const vals = [];
      const params = [];
      let p = 1;
      batch.forEach(c => {
        vals.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
        params.push(c.subject_name, c.subject_code, c.section, c.professor, c.time_room,
          c.year, c.semester, c.grade_year, c.category, c.offering_dept,
          c.credits, c.is_online, c.is_foreign);
      });
      await client.query(
        `INSERT INTO courses (subject_name,subject_code,section,professor,time_room,year,semester,grade_year,category,offering_dept,credits,is_online,is_foreign) VALUES ${vals.join(',')}`,
        params
      );
      inserted += batch.length;
    }
    console.log(`  Inserted: ${inserted}`);
    totalInserted += inserted;
  }

  const summary = await client.query(
    'SELECT year, semester, COUNT(*) as cnt FROM courses GROUP BY year, semester ORDER BY year, semester'
  );
  console.log('\n=== DB Summary ===');
  summary.rows.forEach(r => console.log(`  ${r.year}-${r.semester}: ${r.cnt}`));
  console.log(`\nTotal: ${totalInserted} courses`);

  await client.end();
  console.log('Done!');
}

main().catch(e => { console.error(e.message); process.exit(1); });
