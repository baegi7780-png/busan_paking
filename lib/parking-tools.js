import {dataset} from '../functions/api/parking.js';
import {selectItems,statusOf,usable,links} from '../js/parking-data.js';

const searchProperties = {
  query:{type:'string',description:'주차장 이름·주소·동 이름 또는 코드. 지역 조건은 district에 넣고 나머지 검색어가 없으면 빈 문자열.'},
  district:{type:'string',description:'구·군 이름. 예: 해운대구, 북구. 제한 없으면 all.'},
  filter:{type:'string',enum:['all','available','full','stale','unknown'],description:'자리 있는 곳은 available. 제한 없으면 all.'},
  sort:{type:'string',enum:['spaces','name','code','fee'],description:'빈자리 많은 순은 spaces, 기본요금이 저렴한 순은 fee. fee는 기본요금을 10분으로 환산한 비교이며 실제 총요금이 아니다.'},
  freeOnly:{type:'boolean',description:'공공데이터 기본요금이 0원인 항목만 조회. 현재 전면 무료 주차를 보장하지 않는다.'},
  limit:{type:'integer',minimum:1,maximum:10},
  minAvailable:{type:'integer',minimum:0,maximum:100000,description:'현재 확인 가능한 최소 잔여면. 해당 조건을 질문한 경우에만 지정.'}
};
export const TOOLS = [
 {name:'find_parking_by_district',description:'구·군별 주차장을 검색하고 빈자리 순으로 비교합니다. 실시간 제공 주차장만 포함하며 최신성도 반환합니다.',inputSchema:{type:'object',properties:searchProperties,required:['district'],additionalProperties:false}},
 {name:'get_parking_detail',description:'주차장 코드로 현재 잔여면, 주소, 요금, 운영시간, 데이터 기준일을 조회합니다.',inputSchema:{type:'object',properties:{code:{type:'string',description:'목록의 주차장 코드. 예: A01'}},required:['code'],additionalProperties:false}},
 {name:'search_parking',description:'부산시설공단 실시간 제공 주차장을 이름·동·주소·코드로 검색합니다. 빈자리 많은 순으로 정렬할 수 있습니다.',inputSchema:{type:'object',properties:searchProperties,additionalProperties:false}}
];
export function validateArgs(name,args){
 const tool=TOOLS.find(t=>t.name===name);
 if(!tool)throw Error('unknown_tool');
 if(!args||typeof args!=='object'||Array.isArray(args))throw Error('invalid_arguments');
 for(const key of Object.keys(args)){
  const rule=tool.inputSchema.properties[key],value=args[key];
  if(!Object.hasOwn(tool.inputSchema.properties,key))throw Error('invalid_arguments');
  if(rule.type==='string'&&(typeof value!=='string'||value.length>100))throw Error('invalid_arguments');
  if(rule.type==='integer'&&(!Number.isInteger(value)||value<rule.minimum||value>rule.maximum))throw Error('invalid_arguments');
  if(rule.type==='boolean'&&typeof value!=='boolean')throw Error('invalid_arguments');
  if(rule.enum&&!rule.enum.includes(value))throw Error('invalid_arguments');
 }
 for(const key of tool.inputSchema.required||[])if(typeof args[key]!=='string'||!args[key].trim())throw Error('invalid_arguments');
 return tool;
}
export function baseFee(item){
 const minutes=String(item.basic?.pkBascTime??'').trim(),won=String(item.basic?.tenMin??'').trim();
 if(!/^\d+(?:\.\d+)?$/.test(minutes)||!/^\d+(?:\.\d+)?$/.test(won))return null;
 const m=Number(minutes),w=Number(won);return m>0&&Number.isFinite(w/m)?{minutes:m,won:w,per10Minutes:w/m*10}:null;
}
function publicItem(item,data){
 const b=item.basic;
 return {code:item.parkgcd,name:item.parknm,district:item.district||null,address:item.address||null,
  status:statusOf(item,data),available:usable(item,data)?item.curravacnt:null,capacity:item.maxcnt>0?item.maxcnt:null,
  updatedAt:item.lastupdatetime||null,mapUrl:links(item).map,
  feeComparison:baseFee(item),basic:b?{weekdayStart:b.svcSrtTe,weekdayEnd:b.svcEndTe,saturdayStart:b.satSrtTe,saturdayEnd:b.satEndTe,holidayStart:b.hldSrtTe,holidayEnd:b.hldEndTe,
   feeMinutes:b.pkBascTime,feeWon:b.tenMin,phone:b.tponNum,sourceDate:b.fnlDt}:null};
}
export async function callParkingTool(name,args,env,existing){
 validateArgs(name,args);
 const data=existing||await dataset(env);
 let items,total,opts,priceComparison=null;
 if(name==='get_parking_detail'){
  items=data.items.filter(p=>p.parkgcd.toUpperCase()===args.code.trim().toUpperCase());total=items.length;
 }else{
  const district=(args.district||'all').replace(/^부산(?:광역시)?\s*/,'').trim()||'all';
  opts={query:args.query||'',district,filter:args.filter||'all',sort:args.sort==='fee'?'name':args.sort||'spaces'};
  items=selectItems(data,opts);
  if(args.minAvailable!==undefined)items=items.filter(p=>usable(p,data)&&p.curravacnt>=args.minAvailable);
  if(args.sort==='fee'||args.freeOnly){
   const matchedCount=items.length,known=items.filter(p=>baseFee(p)!==null);
   priceComparison={matchedCount,missingFeeCount:matchedCount-known.length,basis:'공공데이터 기본요금의 10분 환산값',warning:'실제 이용시간의 총요금 비교가 아닙니다. 추가요금·할인·시간대는 반영하지 않으며 원본 기준일이 오래됐을 수 있습니다. 현재 최저가/무료를 보장하지 않습니다.'};
   items=known.filter(p=>!args.freeOnly||baseFee(p).won===0).sort((a,b)=>baseFee(a).per10Minutes-baseFee(b).per10Minutes||a.parknm.localeCompare(b.parknm,'ko'));
  }
  total=items.length;items=items.slice(0,args.limit||5);
 }
 return {scope:'부산시설공단 실시간 제공 주차장만 포함. 부산 전체 공영주차장 목록이 아닙니다.',
  priceComparison,query:opts?.query||'',district:opts?.district||'all',degraded:Boolean(data.degraded),unavailable:!data.items.length,sourceMessage:data.message,
  fetchedAt:data.fetchedAt,checkedAt:new Date().toISOString(),total,items:items.map(p=>publicItem(p,data)),
  note:'available=null은 현재 잔여면 확인 불가입니다. 15분 경과·비정상 값·조회 실패 정보는 추천 근거로 쓰지 않습니다. 주소·요금은 공공데이터 참고정보이며 지도 검색 결과와 현장을 확인하세요.'};
}
