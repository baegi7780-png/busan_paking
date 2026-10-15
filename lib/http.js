export function json(value,status=200,extra={}){
 return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
}
export function validOrigin(request){
 const origin=request.headers.get('Origin');
 return !origin||origin===new URL(request.url).origin;
}
export async function readJson(request,maxBytes=4096){
 if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))throw Error('content_type');
 const length=Number(request.headers.get('Content-Length'));
 if(length>maxBytes)throw Error('too_large');
 if(!request.body)throw Error('bad_json');
 const reader=request.body.getReader();let bytes=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>maxBytes){await reader.cancel();throw Error('too_large');}chunks.push(value);}}finally{reader.releaseLock();}
 const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(buffer));}catch{throw Error('bad_json');}
}
const limits=new Map();
export function permit(request,group,max=4,globalMax=20){
 const now=Date.now(),slot=Math.floor(now/60000),ip=request.headers.get('CF-Connecting-IP')||'local';
 for(const [key,record] of limits)if(record.slot!==slot)limits.delete(key);
 const key=group+':'+ip,globalKey=group+':all';
 const mine=limits.get(key)?.count||0,all=limits.get(globalKey)?.count||0;
 if(mine>=max||all>=globalMax)return false;
 limits.set(key,{slot,count:mine+1});limits.set(globalKey,{slot,count:all+1});return true;
}
