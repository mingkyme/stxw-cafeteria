import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('업서트는 unique key로 쓰고 GET 재조회 검증, 불일치 시 실패한다', async () => {
  const { upsertMeals } = await import('../scripts/import.mjs');
  const row = {cafeteria:'stxw 타워 구내식당',meal_date:'2026-11-25',meal_type:'lunch',corner:'검증 전용',menus:['테스트']};
  let stored = [], reads = 0, writes = 0, mismatch = false;
  const server = createServer(async (req,res) => {
    assert.equal(req.headers.apikey,'sb_secret_TEST_ONLY');
    if (req.method === 'POST') {
      writes++;
      assert.equal(new URL(req.url,'http://local').searchParams.get('on_conflict'), 'cafeteria,meal_date,meal_type,corner');
      assert.equal(req.headers.prefer,'resolution=merge-duplicates,return=minimal');
      let body = ''; for await (const chunk of req) body += chunk;
      stored = JSON.parse(body);
      res.writeHead(204).end();
    } else {
      reads++;
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify(mismatch ? [] : stored));
    }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    const options = {url:`http://127.0.0.1:${server.address().port}`,key:'sb_secret_TEST_ONLY'};
    assert.equal(await upsertMeals([row], options), 1);
    assert.equal(reads,1); assert.equal(writes,1);
    mismatch = true;
    await assert.rejects(upsertMeals([row], options), /재조회/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('비밀 키 파일은 저장소 외부·0600만 허용하며 공개 키는 거부한다', async () => {
  const { readSecret } = await import('../scripts/import.mjs');
  const dir = await mkdtemp(join(tmpdir(),'stxw-secret-test-'));
  const file = join(dir,'key');
  try {
    await writeFile(file,'sb_secret_TEST_ONLY',{mode:0o600});
    assert.equal(await readSecret(file), 'sb_secret_TEST_ONLY');
    await chmod(file,0o644);
    await assert.rejects(readSecret(file), /0600/);
    await chmod(file,0o600);
    await writeFile(file,'sb_publishable_NOT_A_SECRET');
    await assert.rejects(readSecret(file), /secret/);
    await assert.rejects(readSecret(new URL('../package.json',import.meta.url).pathname), /외부/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
