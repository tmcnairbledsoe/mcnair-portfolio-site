import { useEffect, useRef, useState } from 'react';

const STORAGE = 'portfolio-shared-drawing-v1';
function identity() {
  let saved;
  try { saved=JSON.parse(localStorage.getItem(STORAGE)); } catch { /* Storage may be disabled. */ }
  const key=/^[a-f0-9]{64}$/.test(saved?.key||'') ? saved.key : Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
  return {key,pending:new Map((Array.isArray(saved?.pending)?saved.pending:[]).filter(p=>p?.id&&p?.generation).slice(0,100).map(p=>[p.id,p]))};
}
export function useSharedDrawing() {
  const state=useRef(null);
  if(!state.current) state.current={...identity(),remote:new Map(),generation:null,cursor:0,ready:false};
  const [view,setView]=useState({strokes:[],ready:false,pending:0,generation:null});
  const [message,setMessage]=useState('Loading shared canvas…');
  const wake=useRef(()=>{});
  function persist() {
    const s=state.current;
    try {localStorage.setItem(STORAGE,JSON.stringify({key:s.key,pending:Array.from(s.pending.values())}));} catch { /* Retry in this tab if storage is unavailable. */ }
  }
  function publish() {
    const s=state.current,merged=new Map(s.remote);
    for(const p of s.pending.values()) merged.set(p.id,{...p,mine:true,order:merged.get(p.id)?.order??Number.MAX_SAFE_INTEGER});
    setView({strokes:Array.from(merged.values()).filter(p=>!p.deleted).sort((a,b)=>a.order-b.order),ready:s.ready,pending:s.pending.size,generation:s.generation});
  }
  async function request(path,options={},signal) {
    const response=await fetch(`/api/drawing${path}`,{...options,signal,cache:'no-store',headers:{'X-Drawing-Writer':state.current.key,...options.headers}});
    const body=await response.json();
    if(!response.ok) {const error=new Error(body.error||'Could not sync the canvas.');error.status=response.status;throw error;}
    return body;
  }
  useEffect(()=>{
    const s=state.current;
    let live=true,timer,running=false,controller,lastRead=0;
    const schedule=(delay=500)=>{clearTimeout(timer);if(live&&!document.hidden) timer=setTimeout(tick,delay);};
    async function tick() {
      if(!live||document.hidden||running) return;
      running=true;controller=new AbortController();
      try {
        if(!s.ready||Date.now()-lastRead>=1000) {
          const data=await request(`?after=${s.cursor}${s.generation?`&generation=${s.generation}`:''}`,{},controller.signal);
          if(!live||controller.signal.aborted) return;
          if(data.reset) {
            s.remote.clear();
            for(const [id,p] of s.pending) if(p.generation!==data.generation) s.pending.delete(id);
            persist();
          }
          s.generation=data.generation;s.cursor=data.cursor;s.ready=true;
          for(const p of data.items) s.remote.set(p.id,p);
          lastRead=data.more?0:Date.now();publish();
        }
        // Send the latest version of each stroke; retries use the same ID/version.
        for(const id of Array.from(s.pending.keys()).slice(0,5)) {
          const command=s.pending.get(id);
          if(!command) continue;
          const saved=await request('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command)},controller.signal);
          if(!live||controller.signal.aborted) return;
          if(s.pending.get(saved.id)?.version===command.version) s.pending.delete(saved.id);
          const previous=s.remote.get(saved.id);
          if(!previous||saved.version>=previous.version) s.remote.set(saved.id,saved);
          persist();publish();
        }
        setMessage(s.pending.size?'Saving your marks…':'Shared canvas up to date.');
      } catch(error) {
        if(live&&error.name!=='AbortError') {
          if(error.status===409) {s.ready=false;s.generation=null;s.cursor=0;}
          setMessage(`${error.message} ${s.pending.size?'Unsaved marks are kept in this browser for retry.':''}`);
        }
      } finally {running=false;schedule();}
    }
    function visibility() {
      clearTimeout(timer);
      if(document.hidden) controller?.abort();
      else {lastRead=0;schedule(0);}
    }
    wake.current=()=>{if(!running) schedule(0);};
    document.addEventListener('visibilitychange',visibility);schedule(0);
    return ()=>{live=false;clearTimeout(timer);controller?.abort();wake.current=()=>{};document.removeEventListener('visibilitychange',visibility);};
    // The loop owns stable refs; it exists only while Drawing is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  function save(stroke,deleted=false) {
    const s=state.current;
    if(!s.ready) return;
    if(!s.pending.has(stroke.id)&&s.pending.size>=100) {setMessage('Too many unsaved marks. Wait for the canvas to reconnect.');return;}
    const previous=s.pending.get(stroke.id)||s.remote.get(stroke.id);
    s.pending.set(stroke.id,{id:stroke.id,version:(previous?.version||0)+1,generation:s.generation,deleted,stroke:{color:stroke.color,width:stroke.width,points:stroke.points.map(p=>({...p}))}});
    persist();publish();setMessage('Saving your marks…');
  }
  async function clear(token) {
    try {
      await request('',{method:'DELETE',headers:{'Content-Type':'application/json','X-Portfolio-Authorization':`Bearer ${await token()}`},body:JSON.stringify({generation:state.current.generation})});
      state.current.ready=false;state.current.cursor=0;wake.current();
    } catch(error) {setMessage(error.message);}
  }
  return {...view,message,save,clear};
}
