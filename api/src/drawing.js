const { createHash } = require('node:crypto');
const { HttpError } = require('./auth');
const { readBytes } = require('./service');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
function validateStroke(stroke) {
  if (!stroke || !/^#[0-9a-f]{6}$/i.test(stroke.color) || ![2,5,10,20].includes(stroke.width)
    || !Array.isArray(stroke.points) || stroke.points.length<1 || stroke.points.length>1024
    || stroke.points.some(p=>!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x<0 || p.x>1000 || p.y<0 || p.y>600))
    throw new HttpError(400,'Invalid drawing stroke.');
  return { color:stroke.color, width:stroke.width, points:stroke.points.map(({x,y})=>({x,y})) };
}
function createDrawingService({authenticate,getClient}) {
  return async request => {
    try {
      const url=new URL(request.url);
      if(url.pathname!=='/api/drawing') throw new HttpError(404,'Drawing not found.');
      const key=request.headers.get('x-drawing-writer');
      if(key!==null && !/^[a-f0-9]{64}$/.test(key)) throw new HttpError(400,'Invalid drawing session.');
      const writer=key ? createHash('sha256').update(key).digest('hex') : '';
      let rpc,args;
      if(request.method==='GET') {
        const after=url.searchParams.get('after')||'0',generation=url.searchParams.get('generation');
        if(!/^\d{1,15}$/.test(after) || (generation && !uuid.test(generation))) throw new HttpError(400,'Invalid drawing cursor.');
        rpc='read_drawing'; args={p_after:Number(after),p_generation:generation,p_writer:writer};
      } else if(request.method==='POST' || request.method==='DELETE') {
        if(!writer) throw new HttpError(400,'A drawing session is required.');
        if(request.headers.get('content-type')!=='application/json') throw new HttpError(400,'Send drawing JSON.');
        const bytes=await readBytes(request,80000);
        let body; try {body=JSON.parse(bytes.toString());} catch {throw new HttpError(400,'Invalid drawing JSON.');}
        if(!uuid.test(body?.generation||'')) throw new HttpError(400,'Reload the shared canvas first.');
        if(request.method==='DELETE') {
          const user=await authenticate(request.headers.get('x-portfolio-authorization'));
          if(!user?.owner) throw new HttpError(403,'Only the owner can clear the shared canvas.');
          rpc='clear_drawing'; args={p_generation:body.generation};
        } else {
          if(!uuid.test(body.id||'') || !Number.isInteger(body.version) || body.version<1 || body.version>2147483646 || typeof body.deleted!=='boolean') throw new HttpError(400,'Invalid drawing stroke.');
          rpc='write_drawing'; args={p_id:body.id,p_writer:writer,p_version:body.version,p_stroke:validateStroke(body.stroke),p_deleted:body.deleted,p_generation:body.generation};
        }
      } else throw new HttpError(405,'Method not allowed.');
      const {data,error}=await getClient().rpc(rpc,args);
      if(error) {
        if(error.code==='P0002') throw new HttpError(409,'The shared canvas was cleared. Reload it before drawing.');
        if(error.code==='42501') throw new HttpError(403,'You can only undo your own marks.');
        if(error.code==='53300') throw new HttpError(429,'The canvas is busy. Retrying shortly.');
        if(error.code==='54000') throw new HttpError(507,'The shared canvas is full. Ask the owner to clear it.');
        throw new HttpError(503,'Shared drawing storage is unavailable. Your unsaved marks will retry.');
      }
      return {status:200,headers,jsonBody:request.method==='DELETE'?{cleared:true}:data};
    } catch(error) {return {status:error instanceof HttpError?error.status:503,headers,jsonBody:{error:error instanceof HttpError?error.message:'Shared drawing is unavailable. Please retry.'}};}
  };
}
module.exports={createDrawingService,validateStroke};
