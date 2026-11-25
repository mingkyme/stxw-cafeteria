import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

export async function withServer(handler, action) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await action(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('공개 REST는 읽기 전용으로 날짜·식당 필터를 전송하고 페이지를 모두 읽는다', async () => {
  const { fetchMeals } = await import('../site/api.mjs');
  let calls = 0;
  await withServer((req, res) => {
    calls++;
    assert.equal(req.method, 'GET');
    const url = new URL(req.url, 'http://local');
    assert.equal(url.searchParams.get('cafeteria'), 'eq.stxw 타워 구내식당');
    assert.deepEqual(url.searchParams.getAll('meal_date'), ['gte.2026-11-25', 'lte.2026-11-25']);
    assert.equal(req.headers.apikey, 'public-test-key');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(calls === 1 ? [{meal_date:'2026-11-25', menus:['검증 전용']}] : []));
  }, async url => {
    const rows = await fetchMeals('2026-11-25', '2026-11-25', {url, key:'public-test-key', pageSize:1});
    assert.equal(rows.length, 1);
  });
  assert.equal(calls, 2);
});
test('화면 취소 신호가 있어도 요청 제한시간을 적용한다', async () => {
  const { fetchMeals } = await import('../site/api.mjs');
  await withServer((req,res) => { setTimeout(()=>{res.setHeader('Content-Type','application/json');res.end('[]');},100); }, async url => {
    await assert.rejects(fetchMeals('2026-11-25','2026-11-25',{url,key:'public-test-key',signal:new AbortController().signal,timeoutMs:10}), /네트워크/);
  });
});

test('누락된 DB는 설치 안내, 네트워크/권한 실패는 오류이며 빈 식단으로 위장하지 않는다', async () => {
  const { fetchMeals } = await import('../site/api.mjs');
  for (const [status, body, expected] of [[404,{code:'PGRST205'}, /설정/], [401,{}, /연결/], [200,{}, /응답/]]) {
    await withServer((req,res) => { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(body)); }, async url => {
      await assert.rejects(fetchMeals('2026-11-25','2026-11-25',{url,key:'public-test-key'}), expected);
    });
  }
});
