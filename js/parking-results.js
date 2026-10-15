import {timestamp} from './parking-data.js';
const labels={available:'자리 있음',busy:'자리 적음',full:'만차',stale:'현재 잔여면 확인 불가',unknown:'정보 확인 필요'};
const rowGroups=new Map();
const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
function current(item,result){const t=timestamp(item.updatedAt);return !result.degraded&&['available','busy','full'].includes(item.status)&&Number.isFinite(t)&&Date.now()-t<=900000&&t-Date.now()<=300000&&Number.isInteger(item.available)&&item.available>=0;}
function refreshFreshness(){for(const rows of rowGroups.values())for(const {item,result,value,badge} of rows){const fresh=current(item,result);value.textContent=item.liveProvided===false?'실시간 미제공':fresh?item.available.toLocaleString('ko-KR')+'면':'확인 필요';badge.textContent=item.liveProvided===false?'잔여면 정보 없음':fresh?labels[item.status]:labels[item.status==='unknown'?'unknown':'stale'];}}
export function renderParkingResult(result,results){
 results.replaceChildren();const rows=[];rowGroups.set(results,rows);
 if(!result)return;
 const note=make('p','ai-result-note',(result.degraded?'최근 보관 정보입니다. 현재 빈자리로 판단하지 마세요. ':'')+(result.station?'부산광역시 공영주차장 기본정보 기준 · 약 '+result.coordinateCount+'곳의 좌표로 검색합니다. 원본 좌표는 오래되거나 반올림됐을 수 있습니다.':'부산시설공단 실시간 제공 목록 기준 · 주소·요금은 참고정보입니다.'));results.append(note);
 if(result.priceComparison)results.append(make('p','ai-result-note',result.priceComparison.basis+' · '+result.priceComparison.warning));
 for(const item of result.items){
  const card=make('article','ai-card'),head=make('div','ai-card-head'),name=make('h4','',item.name),badge=make('span','ai-badge');head.append(name,badge);
  const value=make('strong','ai-value');
  const address=make('p','',item.address||'상세 주소 미제공');
  card.append(head);
  if(Number.isFinite(item.distanceMeters))card.append(make('p','nearby-distance','직선 약 '+(item.distanceMeters>=1000?(item.distanceMeters/1000).toFixed(2)+'km':Math.round(item.distanceMeters/10)*10+'m')));
  card.append(value,address);
  const time=timestamp(item.updatedAt);
  card.append(make('p','ai-time',(item.liveProvided===false?'실시간 미제공 · 만차를 뜻하지 않습니다.':'데이터 갱신 '+(Number.isFinite(time)?new Date(time).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'시각 미제공'))));
  if(item.basic){
   const b=item.basic,known=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&v!=='-';
   if(item.feeComparison){card.append(make('p','','기본요금 '+item.feeComparison.minutes+'분 / '+item.feeComparison.won.toLocaleString('ko-KR')+'원'));if(result.priceComparison)card.append(make('p','','10분 환산 '+item.feeComparison.per10Minutes.toLocaleString('ko-KR',{maximumFractionDigits:1})+'원 · 비교용'));}else card.append(make('p','','기본요금 미제공 · 현장 확인 필요'));
   if(known(b.weekdayStart)&&known(b.weekdayEnd))card.append(make('p','','평일 '+b.weekdayStart+' ~ '+b.weekdayEnd));
   if(known(b.saturdayStart)&&known(b.saturdayEnd))card.append(make('p','','토요일 '+b.saturdayStart+' ~ '+b.saturdayEnd));
   if(known(b.holidayStart)&&known(b.holidayEnd))card.append(make('p','','공휴일 '+b.holidayStart+' ~ '+b.holidayEnd));
   if(known(b.sourceDate))card.append(make('p','ai-time','요금·운영정보 원본 기준일 '+b.sourceDate));
  }else card.append(make('p','','요금·운영정보 미제공'));
  // Construct the URL from the data name, never from model-generated links.
  const link=make('a','','카카오맵에서 검색 ↗');link.href='https://map.kakao.com/link/search/'+encodeURIComponent('부산 '+item.name);link.target='_blank';link.rel='noopener noreferrer';card.append(link);
  results.append(card);rows.push({item,result,value,badge});
 }
 refreshFreshness();
}

setInterval(()=>{if(!document.hidden)refreshFreshness();},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshFreshness();});
