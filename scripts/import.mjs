import { parseDate } from '../site/lib.mjs';
import { SUPABASE_URL } from '../site/config.mjs';
import { fetchMeals } from '../site/api.mjs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, relative, isAbsolute, resolve, join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function readSecret(filename) {
  const actual = await realpath(filename);
  const rel = relative(await realpath(ROOT), actual);
  if (rel === '' || (!rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(rel))) throw new Error('비밀 키 파일은 저장소 외부에 두세요.');
  const info = await stat(actual);
  if (!info.isFile() || (process.platform !== 'win32' && (info.mode & 0o777) !== 0o600)) throw new Error('비밀 키 파일의 권한을 0600으로 설정하세요.');
  const key = (await readFile(actual, 'utf8')).trim();
  let legacy = false;
  try { legacy = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role'; } catch { /* not a legacy JWT */ }
  if ((!key.startsWith('sb_secret_') && !legacy) || /\s/.test(key)) throw new Error('Supabase secret 또는 legacy service_role 키가 필요합니다.');
  return key;
}
export async function upsertMeals(rows, { url = SUPABASE_URL, key } = {}) {
  if (!rows.length || !key) throw new Error('검증된 식단과 비밀 키가 필요합니다.');
  const endpoint = new URL(`${url}/rest/v1/meals`);
  endpoint.searchParams.set('on_conflict', 'cafeteria,meal_date,meal_type,corner');
  const headers = { apikey: key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  let response;
  try { response = await fetch(endpoint, {method:'POST', headers, body:JSON.stringify(rows), signal:AbortSignal.timeout(20000)}); }
  catch { throw new Error('가져오기 요청 실패. 결과가 불확실하므로 확인 후 같은 파일로 재시도하세요.'); }
  if (!response.ok) throw new Error(`가져오기 실패 (HTTP ${response.status}). SQL 설정 및 비밀 키 권한을 확인하세요.`);
  const dates = rows.map(row => row.meal_date).sort();
  // 별도 GET으로 실제 저장 상태 확인. POST 성공만으로 완료 처리하지 않는다.
  const actual = await fetchMeals(dates[0], dates.at(-1), {url,key}).catch(() => { throw new Error('쓰기 후 재조회에 실패했습니다. 저장 여부를 확인 후 재시도하세요.'); });
  for (const row of rows) {
    const saved = actual.find(x => x.meal_date === row.meal_date && x.meal_type === row.meal_type && x.corner === row.corner);
    if (!saved || JSON.stringify(saved.menus) !== JSON.stringify(row.menus)) throw new Error('쓰기 후 재조회 결과가 다릅니다. 완료로 처리하지 않았습니다.');
  }
  return rows.length;
}
export async function main(args = process.argv.slice(2)) {
  const filename = args[0];
  if (!filename || args.slice(1).some(x => !['--apply','--dry-run'].includes(x)) || (args.includes('--apply') && args.includes('--dry-run'))) throw new Error('사용법: node scripts/import.mjs <확인된.json> [--dry-run | --apply]');
  const rows = validateImport(JSON.parse(await readFile(filename, 'utf8')));
  if (!args.includes('--apply')) {
    console.log(`검증 통과: ${rows.length}건. dry-run: 네트워크 쓰기를 수행하지 않았습니다.`);
    return;
  }
  const secretFile = process.env.STXW_SECRET_FILE || join(homedir(), '.config/stxw-cafeteria/supabase-secret');
  const key = await readSecret(secretFile);
  const count = await upsertMeals(rows, {key});
  console.log(`가져오기 및 재조회 검증 완료: ${count}건.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}


export const CAFETERIA = 'stxw 타워 구내식당';
export function validateImport(input) {
  if (!input || Object.keys(input).some(k => k !== 'meals') || !Array.isArray(input.meals) || !input.meals.length || input.meals.length > 500) throw new Error('meals 배열(1~500건)이 필요합니다.');
  const seen = new Set();
  return input.meals.map((row, index) => {
    const fail = message => { throw new Error(`${index + 1}행: ${message}`); };
    if (!row || typeof row !== 'object') fail('식단 객체가 필요합니다.');
    const allowed = ['meal_date','weekday','date_confirmed','meal_type','corner','menus'];
    if (Object.keys(row).some(k => !allowed.includes(k))) fail('지원하지 않는 필드가 있습니다. 불확실한 정보는 먼저 확인하세요.');
    const date = parseDate(row.meal_date);
    if ([0,6].includes(date.getUTCDay())) fail('주말 휴무이므로 토요일·일요일 식단은 등록하지 않습니다.');
    if (row.date_confirmed !== true) fail('사진의 연·월·일을 확인하고 date_confirmed=true로 표시하세요.');
    if (row.weekday !== '일월화수목금토'[date.getUTCDay()]) fail('날짜와 요일이 다르거나 요일이 없습니다. 추측하지 마세요.');
    if (row.meal_type !== 'lunch') fail('점심만 운영합니다. meal_type은 lunch여야 합니다.');
    const validText = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && !/[?？\u0000-\u001f]/u.test(value);
    if (!validText(row.corner)) fail('확정된 코너 이름이 필요합니다.');
    if (!Array.isArray(row.menus) || row.menus.length < 1 || row.menus.length > 50 || !row.menus.every(validText)) fail('확정된 메뉴 목록(1~50개)이 필요합니다.');
    const corner = row.corner.trim();
    const key = JSON.stringify([row.meal_date, row.meal_type, corner]);
    if (seen.has(key)) fail('날짜·끼니·코너 중복입니다.');
    seen.add(key);
    return { cafeteria: CAFETERIA, meal_date: row.meal_date, meal_type: row.meal_type, corner, menus: row.menus.map(x => x.trim()) };
  });
}
