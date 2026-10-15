import {TOOLS,callParkingTool,validateArgs} from './parking-tools.js';
import {json,readJson,validOrigin,permit} from './http.js';
export const PROTOCOL='2025-11-25';
const SUPPORTED=['2025-03-26','2025-06-18',PROTOCOL];
const info={name:'busan-parking',version:'1.0.0'};
export async function dispatchMcp(message,env,existing){
 const {method,params={},id}=message;
 const result=value=>({jsonrpc:'2.0',id,result:value});
 const error=(code,text)=>({jsonrpc:'2.0',id,error:{code,message:text}});
 if(method==='initialize'){
  if(!params||typeof params.protocolVersion!=='string'||!params.clientInfo||typeof params.capabilities!=='object')return error(-32602,'Invalid initialize parameters');
  return result({protocolVersion:SUPPORTED.includes(params.protocolVersion)?params.protocolVersion:PROTOCOL,capabilities:{tools:{listChanged:false}},serverInfo:info,instructions:'Read-only Busan parking data. Inspect freshness, scope and note. Do not treat unknown or stale availability as current.'});
 }
 if(method==='ping')return result({});
 if(method==='tools/list')return result({tools:TOOLS.map(t=>({...t,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}}))});
 if(method==='tools/call'){
  if(!params||typeof params.name!=='string')return error(-32602,'Invalid tool parameters');
  try{validateArgs(params.name,params.arguments||{});}catch{return error(-32602,'Unknown tool or invalid arguments');}
  try{const value=await callParkingTool(params.name,params.arguments||{},env,existing);return result({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value,isError:false});}
  catch{return result({content:[{type:'text',text:'주차정보 조회에 실패했습니다. 잠시 후 다시 확인하세요.'}],isError:true});}
 }
 return error(-32601,'Method not found');
}
export async function handleMcp(request,env){
 if(!validOrigin(request))return json({error:'Origin not allowed'},403);
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
 const accept=request.headers.get('Accept')||'';
 if(!accept.includes('application/json')||!accept.includes('text/event-stream'))return json({error:'Accept application/json and text/event-stream'},406);
 const version=request.headers.get('MCP-Protocol-Version');
 if(version&&!SUPPORTED.includes(version))return json({error:'Unsupported MCP protocol version; supported: '+SUPPORTED.join(', ')},400);
 let message;try{message=await readJson(request,16384);}catch{return json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON request'}},400);}
 if(!message||Array.isArray(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string'||message.params!==undefined&&(!message.params||typeof message.params!=='object'||Array.isArray(message.params)))return json({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid Request'}},400);
 if(!Object.hasOwn(message,'id')){
  return message.method.startsWith('notifications/')?new Response(null,{status:202,headers:{'Cache-Control':'no-store'}}):json({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Request id required'}},400);
 }
 if(typeof message.id!=='number'&&typeof message.id!=='string')return json({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid id'}},400);
 if(message.method==='tools/call'&&!permit(request,'mcp',20,100))return json({error:'Too many tool requests'},429,{'Retry-After':'60'});
 return json(await dispatchMcp(message,env));
}
