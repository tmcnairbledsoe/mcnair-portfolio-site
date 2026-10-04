const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const tid = '11111111-1111-4111-8111-111111111111', a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const postId = 'aaaaaaaa-1111-4111-8111-111111111111', assetId = 'aaaaaaaa-2222-4222-8222-222222222222';

test('actual PostgreSQL migration is idempotent, RLS denies clients, RPC checks assets/account and atomic versions', async () => {
  const db = new PGlite();
  try {
    // Emulate only Supabase's preexisting roles and Storage schema. The content
    // tables, checks, RLS, bucket configuration and RPC are the actual migration.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema storage; grant usage on schema public, storage to anon, authenticated, service_role;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key,bucket_id text);
      alter table storage.objects enable row level security;
      grant all on storage.buckets, storage.objects to service_role;
      grant select,insert,update,delete on storage.objects to anon, authenticated;
      create policy existing_other_bucket_policy on storage.objects for all to anon,authenticated using(true) with check(true);`);
    const migration = fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/001_portfolio_content.sql'),'utf8');
    await db.exec(migration); await db.exec(migration);
    const bucket = (await db.query('select * from storage.buckets')).rows[0];
    assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),5242880);assert.deepEqual(bucket.allowed_mime_types,['image/jpeg','image/png','image/webp']);
    const ns = `journal:${tid}:${a}`;
    await db.query('insert into public.assets(id,namespace,kind,owner_tid,owner_oid,storage_path,mime,size) values($1,$2,$3,$4,$5,$6,$7,$8)', [assetId,ns,'journal',tid,a,`${ns}/${assetId}`,'image/png',100]);
    const document = {type:'doc',content:[{type:'paragraph',content:[{type:'image',attrs:{assetId,alt:'Photo'}}]}]};
    const post = {id:postId,namespace:ns,kind:'journal',owner_tid:tid,owner_oid:a,title:'Notes',document,status:'private',asset_ids:[assetId]};
    await db.exec('set role service_role');
    const save = async (value, version) => (await db.query('select public.save_content_post($1::jsonb,$2::integer) as result',[JSON.stringify(value),version])).rows[0].result;
    assert.equal((await save(post,null)).version,1);
    assert.equal((await save({...post,title:'New'},1)).version,2);
    await assert.rejects(save({...post,title:'Lost'},1), e=>e.code==='P0002');
    assert.equal((await db.query('select title,version from posts where id=$1',[postId])).rows[0].title,'New');
    await assert.rejects(save({...post,namespace:`journal:${tid}:${b}`,owner_oid:b},2), e=>e.code==='22023'); // Foreign asset rejected.
    await assert.rejects(save({...post,namespace:`journal:${tid}:${b}`,owner_oid:b,asset_ids:[]},2), e=>e.code==='P0002'); // Foreign post rejected.
    await assert.rejects(save({...post,id:assetId,namespace:'blog',kind:'blog',status:'published'},null), e=>e.code==='22023');
    await assert.rejects(save({...post,id:assetId,status:'published'},null), e=>e.code==='23514');
    await assert.rejects(save({...post,id:assetId,document:{}},null), e=>e.code==='23514');
    await db.exec('reset role');
    await db.query('insert into storage.objects(id,bucket_id) values($1,$2)',[assetId,'portfolio-images']);
    for (const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from public.posts'),e=>e.code==='42501');
      await assert.rejects(db.query('select * from public.assets'),e=>e.code==='42501');
      await assert.rejects(save(post,null),e=>e.code==='42501');
      assert.equal((await db.query('select * from storage.objects')).rows.length,0);
      await assert.rejects(db.query('insert into storage.objects(id,bucket_id) values($1,$2)',[postId,'portfolio-images']),e=>e.code==='42501');
      await db.exec('reset role');
    }
  } finally { await db.close(); }
});
