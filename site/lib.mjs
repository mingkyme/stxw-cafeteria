export function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2000-01-01' || value > '2100-12-31') throw new Error('날짜는 2000~2100년의 YYYY-MM-DD로 확정해야 합니다.');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('존재하지 않는 날짜입니다.');
  return date;
}
export function shiftDate(value, days) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function weekDates(value) {
  const offset = (parseDate(value).getUTCDay() + 6) % 7;
  return Array.from({ length: 5 }, (_, i) => shiftDate(value, i - offset));
}
export function todayKST(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
