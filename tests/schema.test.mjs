import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('실제 PostgreSQL 엔진: 스키마, 고유 업서트, 점심 제약, RLS 읽기와 쓰기 차단', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
    await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
    await db.exec("SET ROLE service_role; INSERT INTO public.meals (meal_date,corner,menus) VALUES ('2026-11-25','검증 전용',ARRAY['테스트'])");
    await db.exec("INSERT INTO public.meals (cafeteria,meal_date,meal_type,corner,menus) VALUES ('stxw 타워 구내식당','2026-11-25','lunch','검증 전용',ARRAY['수정 테스트']) ON CONFLICT (cafeteria,meal_date,meal_type,corner) DO UPDATE SET menus=excluded.menus,updated_at='1970-01-01';");
    const rows = (await db.query('SELECT * FROM public.meals')).rows;
    assert.equal(rows.length,1); assert.deepEqual(rows[0].menus,['수정 테스트']);
    assert.notEqual(new Date(rows[0].updated_at).getUTCFullYear(),1970);
    for (const type of ['breakfast','dinner']) await assert.rejects(db.exec(`INSERT INTO public.meals(meal_date,meal_type,menus) VALUES('2026-11-25','${type}',ARRAY['테스트'])`), /meals_lunch_only/);
    await assert.rejects(db.exec("INSERT INTO public.meals(meal_date,menus) VALUES('2026-11-25',ARRAY[]::text[])"), /check constraint/);
    await db.exec('RESET ROLE');
    assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.meals'::regclass")).rows[0].relrowsecurity,true);
    for (const role of ['anon','authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      assert.equal((await db.query('SELECT * FROM public.meals')).rows.length,1);
      for (const sql of ["INSERT INTO public.meals(meal_date,menus) VALUES('2026-11-26',ARRAY['금지'])", "UPDATE public.meals SET menus=ARRAY['금지']", 'DELETE FROM public.meals', 'TRUNCATE public.meals', "SELECT nextval('public.meals_id_seq')"]) await assert.rejects(db.exec(sql), /permission denied/);
      await db.exec('RESET ROLE');
    }
  } finally { await db.close(); }
});
