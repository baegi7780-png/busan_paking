import {STATIONS} from './stations.js';
import {dataset,basicInventory} from '../functions/api/parking.js';
export {STATIONS};
const normalize=s=>String(s||'').replace(/^(?:부산광역시\s*|부산\s+(?=.+역)|부산도시철도\s*|지하철\s*)/,'').replace(/[\s·ㆍ()（）]/g,'').replace(/역$/,'');
export function resolveStation(value){const key=normalize(value);return STATIONS.find(s=>normalize(s.name)===key)||null;}
export function stationInQuestion(value){
 const text=String(value).replace(/\s+/g,'');
 const matches=STATIONS.filter(s=>text.includes(s.name)||normalize(s.name).length>=2&&text.startsWith(normalize(s.name))&&/^(?:근처|주변|인근|에서|부근|가까)/.test(text.slice(normalize(s.name).length)));return matches.length===1?matches[0]:null;
}
export function meters(a,b){
 const rad=d=>d*Math.PI/180,dlat=rad(b.lat-a.lat),dlng=rad(b.lng-a.lng);
 const h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
const identity=b=>[b.guNm,b.mgntNum,b.pkNam].map(s=>String(s||'').trim()).join('|');
const clean=v=>v==null||String(v).trim()==='-'?'':String(v).trim();
export async function nearbySearch(args,env,serialize,existing){
 const station=resolveStation(args.station);
 if(!station)return {scope:'부산도시철도 1~4호선 역 기준 검색',stationNotFound:true,total:0,items:[],degraded:false,note:'공식 목록에서 역 이름을 찾지 못했습니다. 덕천역·화명역처럼 입력하세요. 동해선·김해경전철·일반 건물은 지원하지 않습니다.'};
 const [data,inventory]=await Promise.all([existing||dataset(env),existing?.basicItems?{items:existing.basicItems,degraded:false,fetchedAt:existing.fetchedAt}:basicInventory(env)]);
 const radius=args.radiusMeters||1000,liveByIdentity=new Map();
 for(const p of data.items)if(p.basic){const id=identity(p.basic);if(liveByIdentity.has(id))liveByIdentity.set(id,null);else liveByIdentity.set(id,p);}
 const seen=new Map();
 for(const b of inventory.items){
  if(clean(b.pkGubun)!=='공영')continue;
  const id=identity(b);if(!clean(b.mgntNum)||!clean(b.pkNam))continue;
  const rawLat=clean(b.xCdnt),rawLng=clean(b.yCdnt),lat=Number(rawLat),lng=Number(rawLng);
  if(!rawLat||!rawLng||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<34.8||lat>35.6||lng<128.7||lng>129.4)continue;
  if(seen.has(id)){const old=seen.get(id);if(old&&(old.location.lat!==lat||old.location.lng!==lng))seen.set(id,null);continue;}
  const addr=clean(b.doroAddr)||clean(b.jibunAddr),address=/\d/.test(addr)?(addr.startsWith('부산')?addr:'부산광역시 '+addr):'';
  const live=liveByIdentity.get(id);
  const item=live||{parkgcd:'basic:'+id,parknm:b.pkNam,valid:false,curravacnt:null,maxcnt:Number(b.pkCnt)||null,parkingcnt:null,lastupdatetime:null,basic:b,address,district:(String(b.guNm)+' '+addr).match(/(해운대구|부산진구|동래구|금정구|사상구|사하구|수영구|영도구|연제구|강서구|기장군|남구|북구|중구|서구|동구)/)?.[1]||''};
  seen.set(id,{item,location:{lat,lng},liveProvided:Boolean(live),distance:meters(station,{lat,lng})});
 }
 const usable=[...seen.values()].filter(Boolean),near=usable.filter(p=>p.distance<=radius).sort((a,b)=>a.distance-b.distance||a.item.parknm.localeCompare(b.item.parknm,'ko'));
 const limit=args.limit||5;
 return {scope:'부산광역시 공영주차장 기본정보 중 원본 위경도가 있는 주차장. 실시간 제공 범위와 다릅니다.',
  degraded:data.degraded,unavailable:!inventory.items.length,fetchedAt:data.fetchedAt,checkedAt:new Date().toISOString(),
  total:near.length,station,radiusMeters:radius,coordinateCount:usable.length,basicCount:inventory.items.length,basicDegraded:inventory.degraded,
  items:near.slice(0,limit).map(p=>({...serialize(p.item,data),liveProvided:p.liveProvided,distanceMeters:Math.round(p.distance),distanceKind:'직선거리'})),
  note:'역 기준점과 공공데이터 원본 좌표 사이의 대략적인 직선거리입니다. 도보·차량 이동거리나 출입구 기준이 아닙니다. 원본 좌표가 반올림되었거나 오래됐을 수 있으며 좌표 없는 주차장은 제외됩니다. 실시간 미제공은 만차가 아닙니다.'};
}
export function nearbyMessage(result){
 if(result.stationNotFound)return result.note;
 if(result.unavailable)return '주차장 기본정보를 가져오지 못했습니다. 잠시 후 다시 확인해주세요.';
 const radius=result.radiusMeters>=1000?(result.radiusMeters/1000)+'km':result.radiusMeters+'m';
 const prefix=result.station.name+' 기준 반경 '+radius+' · 원본 좌표가 있는 공영주차장';
 return result.total?prefix+' '+result.total+'곳 중 직선거리순 '+result.items.length+'곳입니다. 실시간 정보가 없는 곳도 포함합니다.':prefix+'을 찾지 못했습니다. 실제 주변에 주차장이 없다는 뜻은 아닙니다. 반경을 넓혀보세요.';
}
