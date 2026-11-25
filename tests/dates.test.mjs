import test from 'node:test';
import assert from 'node:assert/strict';

test('엄격한 날짜 검증과 월요일~금요일 주간 범위, 연도 경계', async () => {
  const { parseDate, shiftDate, weekDates } = await import('../site/lib.mjs');
  assert.equal(parseDate('2028-02-29').toISOString(), '2028-02-29T00:00:00.000Z');
  for (const bad of ['2026-02-29', '2026-2-01', '2026-11-31', '', '2026-11-25?']) assert.throws(() => parseDate(bad));
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
  assert.deepEqual(weekDates('2027-01-03'), ['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01']);
});

test('KST 오늘은 UTC 자정이 아닌 한국 자정을 따른다', async () => {
  const { todayKST } = await import('../site/lib.mjs');
  assert.equal(todayKST(new Date('2026-11-24T15:01:00Z')), '2026-11-25');
  assert.equal(todayKST(new Date('2026-12-31T15:00:00Z')), '2027-01-01');
});
