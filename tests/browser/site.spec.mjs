import {test, expect} from '@playwright/test';

test('오늘·날짜·주간 읽기 전용 탐색과 빈 상태, 모바일 폭', async ({page}) => {
  await page.clock.install({time:new Date('2026-11-24T15:05:00Z')});
  const methods = [];
  await page.route('https://xyjkxyyvslrhksiwzkph.supabase.co/rest/v1/meals?*', async route => {
    methods.push(route.request().method());
    await route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'stxw 타워 구내식당',exact:true})).toBeVisible();
  await expect(page.getByLabel('기준 날짜')).toHaveValue('2026-11-25');
  await expect(page.getByText('등록된 식단이 없습니다.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'주간',exact:true}).click();
  await expect(page.locator('thead th[scope=col]')).toHaveCount(5);
  await expect(page.locator('#period')).toContainText('11.23');
  await page.getByLabel('기준 날짜').fill('2026-12-31');
  await expect(page.locator('#period')).toContainText('2027');
  await page.getByRole('button',{name:'날짜별',exact:true}).click();
  await expect(page.locator('.day-card')).toHaveCount(1);
  await page.getByRole('button',{name:'오늘',exact:true}).click();
  await expect(page.getByLabel('기준 날짜')).toHaveValue('2026-11-25');
  await expect(page.getByText('등록된 식단이 없습니다.',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'오늘',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('등록된 식단이 없습니다.',{exact:true})).toBeVisible();
  expect(methods.every(x => x === 'GET')).toBe(true);
  expect(await page.locator('input[type=file]').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath('empty.png'),fullPage:true});
});

test('확인된 점심 코너 표시, HTML 문자열은 실행하지 않는다', async ({page}) => {
  await page.route('https://xyjkxyyvslrhksiwzkph.supabase.co/rest/v1/meals?*', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{meal_date:'2026-11-25',meal_type:'lunch',corner:'검증용 코너',menus:['<img src=x onerror=alert(1)>','검증 전용 메뉴'],updated_at:'2026-11-25T01:00:00Z'}])}));
  await page.goto('/?date=2026-11-25&view=date');
  await expect(page.getByText('검증용 코너',{exact:true})).toBeVisible();
  await expect(page.locator('.corner li').first()).toHaveText('<img src=x onerror=alert(1)>');
  expect(await page.locator('.corner img').count()).toBe(0);
  await expect(page.locator('.updated')).toContainText('10:00');
  await expect(page.getByText('등록된 식단이 없습니다.',{exact:true})).toHaveCount(0);
});

test('DB 미설정·오프라인은 명확한 오류, 새로고침으로 복구한다', async ({page}) => {
  await page.clock.install({time:new Date('2026-11-24T15:05:00Z')});
  let state = 'setup';
  await page.route('https://xyjkxyyvslrhksiwzkph.supabase.co/rest/v1/meals?*', async route => {
    if (state === 'offline') return route.abort('failed');
    await route.fulfill({status:state==='setup'?404:200,contentType:'application/json',body:state==='setup'?'{"code":"PGRST205"}':'[]'});
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('데이터베이스 설정');
  expect(await page.locator('.day-card').count()).toBe(0);
  state='offline'; await page.getByRole('button',{name:'새로고침 ↻'}).click();
  await expect(page.getByRole('alert')).toContainText('네트워크');
  state='ok'; await page.getByRole('button',{name:'새로고침 ↻'}).click();
  await expect(page.getByText('등록된 식단이 없습니다.',{exact:true})).toBeVisible();
});

test('범위 밖 URL 날짜는 안전한 기본 날짜로 돌아간다', async ({page}) => {
  await page.clock.install({time:new Date('2026-11-24T15:05:00Z')});
  const errors=[]; page.on('pageerror', e => errors.push(e.message));
  await page.route('https://xyjkxyyvslrhksiwzkph.supabase.co/rest/v1/meals?*', route => route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await page.goto('/?date=2000-01-01&view=week');
  await expect(page.getByLabel('기준 날짜')).toHaveValue('2026-11-25');
  await expect(page.locator('thead th[scope=col]')).toHaveCount(5);
  expect(errors).toEqual([]);
});

// Synthetic browser responses only: no production meal fixtures or writes.
test('주간은 정확히 월~금 다섯 열이며 밥·국 원본 순서가 가로로 정렬된다', async ({page}, testInfo) => {
  await page.clock.install({time:new Date('2026-11-25T03:00:00Z')});
  const days = ['23','24','25','26','27'];
  const rows = days.map(day=>({meal_date:`2026-11-${day}`,meal_type:'lunch',corner:'점심',menus:[`밥${day}`,`국${day}`,`찬${day}`]}));
  await page.route('https://xyjkxyyvslrhksiwzkph.supabase.co/rest/v1/meals?*', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)}));
  await page.goto('/?date=2026-11-29&view=week');
  const table = page.getByRole('table');
  await expect(table).toHaveAccessibleName('2026.11.23 — 2026.11.27 주간 점심 식단');
  await expect(table.locator('thead th[scope=col]')).toHaveCount(5);
  expect((await table.locator('thead th').allTextContents()).map(title=>title.match(/[월화수목금토일](?=\))/)?.[0])).toEqual(['월','화','수','목','금']);
  await expect(table.locator('tbody th')).toHaveCount(0);
  await expect(table.getByText(/^(구분|밥|국\/찌개|반찬\d+)$/)).toHaveCount(0);
  for (const [i,prefix] of ['밥','국','찬'].entries()) {
    const cells = table.locator('tbody tr').nth(i).locator('td');
    await expect(cells).toHaveText(days.map(day=>`${prefix}${day}`));
    const boxes = await cells.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y};}));
    for(let j=1;j<boxes.length;j++) { expect(boxes[j].y).toBeCloseTo(boxes[0].y,0); expect(boxes[j].x).toBeGreaterThan(boxes[j-1].x); }
  }
  await expect(table.locator('thead th.today')).toContainText('TODAY');
  await expect(table.locator('tbody td.today')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(testInfo.project.name==='mobile') {
    expect(await page.locator('.week-scroll').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
    await page.locator('.week-scroll').evaluate(el=>el.scrollLeft=el.scrollWidth);
    await expect(table.getByText('밥27',{exact:true})).toBeInViewport();
  }
  await page.screenshot({path:testInfo.outputPath('weekly-table.png'),fullPage:true});
});

test('6·9개 메뉴 원본을 모두 보존하고 휴무·미등록은 음식 행과 구별한다', async ({page}, testInfo) => {
  const six = ['월 밥','월 국','월 찬1','월 찬2','월 찬3','월 찬4'];
  const nine = ['수 볶음밥','수 국','수 찬1','수 찬2','수 찬3','수 찬4','수 찬5','수 찬6','<img src=x onerror=alert(1)>'];
  const rows = [['23',six],['24',['휴무']],['25',nine],['27',six.map(x=>x.replace('월','금'))]].map(([day,menus])=>({meal_date:`2026-11-${day}`,meal_type:'lunch',corner:'합성 코너',menus}));
  const methods=[];
  await page.route('https://xyjkxyyvslrhksiwzkph.supabase.co/rest/v1/meals?*', route=>{
    methods.push(route.request().method());
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});
  });
  await page.goto('/?date=2026-11-25&view=week');
  const table = page.getByRole('table');
  await expect(table.locator('tbody tr')).toHaveCount(9);
  for (const [column,menus] of [[0,six],[2,nine],[4,rows[3].menus]]) {
    const values = await table.locator(`tbody td[headers="day-2026-11-${['23','24','25','26','27'][column]}"]`).allTextContents();
    expect(values).toEqual([...menus,...Array(9-menus.length).fill('')]);
  }
  const closure = table.locator('td.closed');
  await expect(closure).toHaveText('휴무');
  await expect(closure).toHaveAttribute('rowspan','9');
  await expect(closure).toHaveAttribute('aria-label','11월 24일 (화) 휴무');
  const missing = table.locator('td.unregistered');
  await expect(missing).toHaveText('미등록');
  await expect(missing).toHaveAttribute('rowspan','9');
  await expect(table.locator('img')).toHaveCount(0);
  expect(methods).toEqual(['GET']);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('mixed-week.png'),fullPage:true});
});

for (const date of ['2026-11-28','2026-11-29']) {
  test(`${date} 주말 날짜·오늘은 데이터와 네트워크 없이 휴무를 표시한다`, async ({page}) => {
    await page.clock.install({time:new Date(`${date}T03:00:00Z`)});
    const requests=[];
    await page.route('https://xyjkxyyvslrhksiwzkph.supabase.co/rest/v1/meals?*', route=>{
      requests.push(route.request().method());
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{meal_date:date,meal_type:'lunch',corner:'합성 주말 코너',menus:['합성 주말 메뉴']}])});
    });
    await page.goto(`/?date=${date}&view=date`);
    await expect(page.getByText('주말 휴무',{exact:true})).toBeVisible();
    await expect(page.getByText('등록된 식단이 없습니다.',{exact:true})).toHaveCount(0);
    await expect(page.locator('.corner')).toHaveCount(0);
    await page.getByRole('button',{name:'오늘',exact:true}).click();
    await expect(page.getByText('주말 휴무',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'오늘',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.route('https://xyjkxyyvslrhksiwzkph.supabase.co/rest/v1/meals?*', route=>route.abort('failed'));
    await page.reload();
    await expect(page.getByText('주말 휴무',{exact:true})).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(requests).toEqual([]);
    await page.getByRole('button',{name:'다음 날짜',exact:true}).click();
    await expect(page.getByLabel('기준 날짜')).toHaveValue(date==='2026-11-28'?'2026-11-29':'2026-11-30');
    if (date==='2026-11-28') await expect(page.getByText('주말 휴무',{exact:true})).toBeVisible();
    else await expect(page.getByRole('alert')).toContainText('네트워크');
  });
}
