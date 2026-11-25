import test from 'node:test';
import assert from 'node:assert/strict';

// 이 파일의 값은 검증용 합성 fixture이며 실제 식단으로 배포·가져오기하지 않는다.
const entry = () => ({ meal_date: '2026-11-25', weekday: '수', date_confirmed: true, meal_type: 'lunch', corner: '테스트 코너', menus: ['테스트 항목'] });
test('가져오기: 확정 날짜·요일·끼니·메뉴를 검증하고 DB 열만 반환한다', async () => {
  const { validateImport } = await import('../scripts/import.mjs');
  assert.deepEqual(validateImport({ meals: [entry()] }), [{ cafeteria: 'stxw 타워 구내식당', meal_date: '2026-11-25', meal_type: 'lunch', corner: '테스트 코너', menus: ['테스트 항목'] }]);
  for (const patch of [{date:'2026-02-30'}, {weekday:'목'}, {weekday:undefined}, {date_confirmed:false}, {date_confirmed:undefined}, {meal_type:'unknown'}, {meal_type:'breakfast'}, {meal_type:'dinner'}, {meal_date:'2026-02-30'}, {meal_date:'11/25'}, {menus:[]}, {menus:['']}, {corner:' '}, {date:'11/25'}, {uncertain:true}, {menus:['메뉴?']}]) {
    assert.throws(() => validateImport({meals:[{...entry(), ...patch}]}), JSON.stringify(patch));
  }
  assert.throws(() => validateImport({meals: [entry(), entry()]}), /중복/);
  assert.throws(() => validateImport({meals: []}));
});
