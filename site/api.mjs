import { SUPABASE_URL, SUPABASE_KEY, CAFETERIA } from './config.mjs';
import { parseDate } from './lib.mjs';

export async function fetchMeals(start, end, { url = SUPABASE_URL, key = SUPABASE_KEY, pageSize = 1000, signal, timeoutMs = 15000 } = {}) {
  parseDate(start); parseDate(end);
  if (start > end) throw new Error('날짜 범위를 확인하세요.');
  const all = [];
  for (let page = 0; page < 20; page++) {
    const endpoint = new URL(`${url}/rest/v1/meals`);
    endpoint.search = new URLSearchParams({ select: 'meal_date,meal_type,corner,menus,updated_at', cafeteria: `eq.${CAFETERIA}`, meal_type: 'eq.lunch', order: 'meal_date.asc,meal_type.asc,corner.asc', limit: String(pageSize), offset: String(page * pageSize) });
    endpoint.searchParams.append('meal_date', `gte.${start}`);
    endpoint.searchParams.append('meal_date', `lte.${end}`);
    let response;
    try { response = await fetch(endpoint, { headers: { apikey: key }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs), cache: 'no-store' }); }
    catch (error) { if (signal?.aborted) throw error; throw new Error('식단 서버에 연결할 수 없습니다. 네트워크를 확인하고 다시 시도해 주세요.'); }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      if (body?.code === 'PGRST205' || body?.code === '42P01') throw new Error('식단 데이터베이스 설정이 아직 완료되지 않았습니다. 운영자가 초기 SQL을 실행해야 합니다.');
      throw new Error('식단 서버 연결 또는 읽기 권한을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    }
    if (!Array.isArray(body)) throw new Error('식단 서버 응답 형식이 올바르지 않습니다.');
    all.push(...body);
    if (body.length < pageSize) return all;
  }
  throw new Error('식단 응답이 너무 커 전체를 확인하지 못했습니다. 운영자에게 문의해 주세요.');
}
