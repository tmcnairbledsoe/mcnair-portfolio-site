const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {createDrawingService}=require('../src/drawing');
const {HttpRequest}=require('@azure/functions');
const ids=['aaaaaaaa-1111-4111-8111-111111111111','bbbbbbbb-1111-4111-8111-111111111111'];
const stroke={color:'#245c49',width:5,points:[{x:20,y:30},{x:40,y:50}]};
test('drawing persistence, independent writers, idempotent updates, private capabilities, and clear generation',async()=>{
 const db=new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
  const sql=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/002_shared_drawing.sql'),'utf8');
  await db.exec(sql);await db.exec(sql);
  const client={rpc:async(name,args)=>{try {const values=Object.values(args).map(v=>typeof v==='object'&&v!==null?JSON.stringify(v):v);const result=await db.query(`select public.${name}(${values.map((_,i)=>`$${i+1}`).join(',')}) as result`,values);return {data:result.rows[0].result};} catch(e){return {error:{code:e.code}};}}};
  const handle=createDrawingService({authenticate:async header=>header==='Bearer owner'?{owner:true}:null,getClient:()=>client});
  async function call(method='GET',body,key='a'.repeat(64),query='',owner=false) {
   return handle(new HttpRequest({method,url:`https://site.test/api/drawing${query}`,headers:{'X-Drawing-Writer':key,...(body?{'Content-Type':'application/json'}:{}),...(owner?{'X-Portfolio-Authorization':'Bearer owner'}:{})},...(body?{body:{string:JSON.stringify(body)}}:{})}));
  }
  const initial=await call();assert.equal(initial.status,200);const generation=initial.jsonBody.generation;
  const command={id:ids[0],generation,version:1,deleted:false,stroke};
  assert.equal((await call('POST',command)).status,200);
  assert.equal((await call('POST',{...command,id:ids[1]},'b'.repeat(64))).status,200);
  let feed=(await call()).jsonBody;assert.equal(feed.items.length,2);assert.equal(feed.items[0].mine,true);assert.equal(feed.items[1].mine,false);
  assert.ok(!JSON.stringify(feed).includes('writer_hash'));assert.equal(feed.cursor,2);
  assert.equal((await call('POST',{...command,version:2,stroke:{...stroke,points:[{x:80,y:90}]}})).status,200);
  assert.equal((await call('POST',command)).jsonBody.version,2); // Retried old write cannot overwrite.
  const delta=(await call('GET',null,undefined,`?after=2&generation=${generation}`)).jsonBody;
  assert.equal(delta.items.length,1);assert.equal(delta.items[0].stroke.points[0].x,80);
  assert.equal((await call('POST',{...command,version:3,deleted:true},'b'.repeat(64))).status,403);
  assert.equal((await call('POST',{...command,version:3,deleted:true})).status,200);
  assert.equal((await call('POST',{...command,version:4})).jsonBody.deleted,true); // Late movement cannot resurrect undo.
  assert.equal((await call('DELETE',{generation})).status,403);
  assert.equal((await call('DELETE',{generation},undefined,'',true)).status,200);
  feed=(await call('GET',null,undefined,`?after=3&generation=${generation}`)).jsonBody;
  assert.equal(feed.reset,true);assert.equal(feed.items.length,0);assert.notEqual(feed.generation,generation);
  assert.equal((await call('POST',command)).status,409);
  assert.equal((await call('POST',{...command,generation:feed.generation,stroke:{...stroke,points:[{x:-1,y:0}]}})).status,400);
  for(const role of ['anon','authenticated']) {
   await db.exec(`set role ${role}`);
   await assert.rejects(db.query('select * from public.drawing_strokes'),e=>e.code==='42501');
   await assert.rejects(db.query('select public.read_drawing(0,null,\'\')'),e=>e.code==='42501');
   await db.exec('reset role');
  }
 } finally {await db.close();}
});
test('drawing rejects oversized, malformed, and non-owner operations before storage',async()=>{
 let calls=0;const handle=createDrawingService({authenticate:async()=>null,getClient:()=>{calls++;throw new Error();}});
 const request=(body,headers={})=>new HttpRequest({method:'POST',url:'https://site.test/api/drawing',headers:{'X-Drawing-Writer':'a'.repeat(64),'Content-Type':'application/json',...headers},body:{string:body}});
 assert.equal((await handle(request('x'.repeat(80001)))).status,413);
 assert.equal((await handle(request('not json'))).status,400);
 assert.equal((await handle(request('{}'))).status,400);
 assert.equal((await handle(request('{}',{'X-Drawing-Writer':'bad'}))).status,400);
 assert.equal(calls,0);
});
