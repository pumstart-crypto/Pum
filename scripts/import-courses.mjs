import { readFileSync, readdirSync } from 'fs';
import { createRequire } from 'module';
import { createInterface } from 'readline';

const require = createRequire(import.meta.url);

const xlsx = require('/home/runner/workspace/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/xlsx.js');
const { Client } = require('/home/runner/workspace/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const FILES = [
  { file: '/tmp/course_2024_1.xlsx', year: 2024, sem: '1' },
  { file: '/tmp/course_2024_2.xlsx', year: 2024, sem: '2' },
  { file: '/tmp/course_2025_1.xlsx', year: 2025, sem: '1' },
  { file: '/tmp/course_2025_2.xlsx', year: 2025, sem: '2' },
  { file: '/tmp/course_2026_1.xlsx', year: 2026, sem: '1' },
];

function parseGradeYear(val) {
  if (!val || val === '' || String(val).includes('전학년') || String(val).includes('전') ) return 0;
  const n = parseInt(String(val));
  return isNaN(n) ? 0 : n;
}

function parseRows(file, year, sem) {
  const wb = xlsx.readFile(file);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    if (rows[i].some(c => String(c).includes('교과목명'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) { console.error('Header not found in', file); return []; }

  const headers = rows[headerIdx].map(h => String(h));

  const find = (...terms) => {
    for (const t of terms) {
      const idx = headers.findIndex(h => h.includes(t));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const col = {
    subjectName: (() => {
      const candidates = headers.map((h, i) => ({ h, i })).filter(x => x.h.includes('교과목명') && !x.h.includes('번호') && !x.h.includes('구분'));
      return candidates.length > 0 ? candidates[0].i : -1;
    })(),
    subjectCode: find('교과목번호', '교과목코드'),
    section: find('분반'),
    professor: find('교수명', '담당교수'),
    timeRoom: find('시간표', '강의실'),
    gradeYear: (() => {
      return headers.findIndex(h => h.includes('학년') && !h.includes('학년도'));
    })(),
    category: find('교과목구분', '이수구분', '교과구분'),
    offeringDept: (() => {
      const idx = find('주관학과명', '개설학과', '학과');
      return idx;
    })(),
    credits: find('학점'),
    isOnline: find('원격강좌여부', '원격', '온라인'),
    isForeign: find('원어강의', '원어'),
    enrollmentLimit: find('수강제한인원', '제한인원'),
  };

  console.log(`  Headers: ${headers.join(', ')}`);
  console.log(`  Columns:`, col);

  const courses = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const name = col.subjectName >= 0 ? String(row[col.subjectName] || '').trim() : '';
    if (!name) continue;

    const isOnlineVal = col.isOnline >= 0 ? String(row[col.isOnline] || '').trim() : '';
    const isForeignVal = col.isForeign >= 0 ? String(row[col.isForeign] || '').trim() : '';

    courses.push({
      subject_name: name,
      subject_code: col.subjectCode >= 0 ? String(row[col.subjectCode] || '').trim() || null : null,
      section: col.section >= 0 ? String(row[col.section] || '').trim() || null : null,
      professor: col.professor >= 0 ? String(row[col.professor] || '').trim() || null : null,
      time_room: col.timeRoom >= 0 ? String(row[col.timeRoom] || '').trim() || null : null,
      year,
      semester: sem,
      grade_year: parseGradeYear(col.gradeYear >= 0 ? row[col.gradeYear] : null),
      category: col.category >= 0 ? String(row[col.category] || '').trim() || null : null,
      offering_dept: col.offeringDept >= 0 ? String(row[col.offeringDept] || '').trim() || null : null,
      credits: col.credits >= 0 ? (parseInt(String(row[col.credits])) || null) : null,
      is_online: isOnlineVal.toUpperCase() === 'Y',
      is_foreign: isForeignVal !== '' && isForeignVal.toUpperCase() !== 'N',
      enrollment_limit: col.enrollmentLimit >= 0 ? (parseInt(String(row[col.enrollmentLimit])) || null) : null,
    });
  }

  return courses;
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('Connected to DB');

  for (const { file, year, sem } of FILES) {
    console.log(`\n=== Importing ${year}-${sem} ===`);
    const courses = parseRows(file, year, sem);
    console.log(`  Parsed: ${courses.length} courses`);

    const del = await client.query('DELETE FROM courses WHERE year = $1 AND semester = $2', [year, sem]);
    console.log(`  Deleted: ${del.rowCount} existing rows`);

    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < courses.length; i += BATCH) {
      const batch = courses.slice(i, i + BATCH);

      const values = [];
      const params = [];
      let p = 1;

      batch.forEach(c => {
        values.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
        params.push(
          c.subject_name, c.subject_code, c.section, c.professor, c.time_room,
          c.year, c.semester, c.grade_year, c.category, c.offering_dept,
          c.credits, c.is_online, c.is_foreign
        );
      });

      await client.query(
        `INSERT INTO courses (subject_name,subject_code,section,professor,time_room,year,semester,grade_year,category,offering_dept,credits,is_online,is_foreign) VALUES ${values.join(',')}`,
        params
      );
      inserted += batch.length;
    }
    console.log(`  Inserted: ${inserted} courses`);
  }

  const count = await client.query('SELECT year, semester, COUNT(*) FROM courses GROUP BY year, semester ORDER BY year, semester');
  console.log('\n=== DB Summary ===');
  count.rows.forEach(r => console.log(`  ${r.year}-${r.semester}: ${r.count} courses`));

  await client.end();
  console.log('\nDone!');
}

main().catch(e => { console.error(e.message); process.exit(1); });
