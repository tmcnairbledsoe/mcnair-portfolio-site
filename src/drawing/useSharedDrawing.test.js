import {act,renderHook} from '@testing-library/react';
import {useSharedDrawing} from './useSharedDrawing';
const generation='aaaaaaaa-1111-4111-8111-111111111111';
const id='bbbbbbbb-1111-4111-8111-111111111111';
const stroke={id,color:'#245c49',width:5,points:[{x:10,y:20}]};
let hidden,remote,fail;
beforeEach(()=>{
 jest.useFakeTimers();localStorage.clear();hidden=false;remote=[];fail=false;
 global.crypto={getRandomValues:values=>values.fill(1)};
 Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
 global.fetch=jest.fn(async(url,options)=>{
  if(options?.method==='POST') {
   if(fail) throw new Error('Offline');
   const command=JSON.parse(options.body);
   const saved={...command,order:1,mine:true};remote=[saved];
   return {ok:true,json:async()=>saved};
  }
  return {ok:true,json:async()=>({generation,reset:!url.includes('generation='),cursor:remote.length,more:false,items:remote})};
 });
});
afterEach(()=>{jest.useRealTimers();delete global.fetch;});
async function advance(ms) {await act(async()=>{jest.advanceTimersByTime(ms);});}
test('loads persisted remote strokes, saves during drawing, and resumes failed marks after remount',async()=>{
 remote=[{id:'remote',version:1,order:0,mine:false,deleted:false,stroke:{color:'#ff0000',width:2,points:[{x:40,y:50}]}}];
 let hook=renderHook(()=>useSharedDrawing());await advance(0);
 expect(hook.result.current.ready).toBe(true);expect(hook.result.current.strokes[0].id).toBe('remote');
 fail=true;act(()=>hook.result.current.save(stroke));await advance(500);
 expect(hook.result.current.pending).toBe(1);expect(hook.result.current.message).toMatch(/Unsaved marks/);
 const failedBody=JSON.parse(fetch.mock.calls.find(([,options])=>options.method==='POST')[1].body);
 hook.unmount();fail=false;
 hook=renderHook(()=>useSharedDrawing());await advance(0);
 expect(hook.result.current.pending).toBe(0);
 const posts=fetch.mock.calls.filter(([,options])=>options.method==='POST');
 expect(JSON.parse(posts[posts.length-1][1].body)).toEqual(failedBody);
 expect(hook.result.current.strokes.some(p=>p.id===id)).toBe(true);hook.unmount();
});
test('stops requests in hidden tabs and after leaving the page; catches up when visible',async()=>{
 const hook=renderHook(()=>useSharedDrawing());await advance(0);
 const before=fetch.mock.calls.length;
 act(()=>{hidden=true;document.dispatchEvent(new Event('visibilitychange'));});
 await advance(10000);expect(fetch).toHaveBeenCalledTimes(before);
 remote=[{id,version:1,order:1,mine:false,stroke,deleted:false}];
 act(()=>{hidden=false;document.dispatchEvent(new Event('visibilitychange'));});await advance(0);
 expect(hook.result.current.strokes[0].id).toBe(id);
 hook.unmount();const after=fetch.mock.calls.length;await advance(10000);expect(fetch).toHaveBeenCalledTimes(after);
});
test('batches movement into the latest version and treats a clear as a new generation',async()=>{
 const hook=renderHook(()=>useSharedDrawing());await advance(0);
 act(()=>{hook.result.current.save(stroke);hook.result.current.save({...stroke,points:[...stroke.points,{x:30,y:40}]});});
 await advance(500);
 const posts=fetch.mock.calls.filter(([,options])=>options.method==='POST');expect(posts.length).toBe(1);
 expect(JSON.parse(posts[0][1].body).stroke.points.length).toBe(2);
 const next='cccccccc-1111-4111-8111-111111111111';
 fetch.mockImplementation(async()=>({ok:true,json:async()=>({generation:next,reset:true,cursor:0,more:false,items:[]})}));
 await advance(1000);expect(hook.result.current.strokes).toEqual([]);expect(hook.result.current.generation).toBe(next);hook.unmount();
});
