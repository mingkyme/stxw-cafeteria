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
  await expect(page.locator('.day-card')).toHaveCount(5);
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
  await expect(page.locator('.day-card')).toHaveCount(5);
  expect(errors).toEqual([]);
});

// Synthetic empty response only: no production meal fixtures or writes.
test('일요일 기준 주간은 월~금 다섯 카드를 한 열로 세로 배치한다', async ({page}) => {
  await page.route('https://xyjkxyyvslrhksiwzkph.supabase.co/rest/v1/meals?*', route => route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await page.goto('/?date=2026-11-29&view=week');
  await expect(page.locator('.day-card')).toHaveCount(5);
  await expect(page.locator('#period')).toHaveText('2026.11.23 — 2026.11.27');
  const titles = await page.locator('.day-title').allTextContents();
  expect(titles.map(title=>title.match(/[월화수목금토일](?=\))/)?.[0])).toEqual(['월','화','수','목','금']);
  const boxes = await page.locator('.day-card').evaluateAll(cards=>cards.map(card=>{const r=card.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,bottom:r.bottom};}));
  for (let i=1;i<boxes.length;i++) {
    expect(boxes[i].x).toBeCloseTo(boxes[0].x,0);
    expect(boxes[i].width).toBeCloseTo(boxes[0].width,0);
    expect(boxes[i].y).toBeGreaterThan(boxes[i-1].bottom);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
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
