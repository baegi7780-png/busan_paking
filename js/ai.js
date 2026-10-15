import {timestamp} from './parking-data.js';
const $=id=>document.getElementById(id);
const form=$('aiForm'),button=$('aiSend'),input=$('aiQuestion'),status=$('aiStatus'),results=$('aiResults');
const labels={available:'자리 있음',busy:'자리 적음',full:'만차',stale:'현재 잔여면 확인 불가',unknown:'정보 확인 필요'};
let busy=false,rows=[];
const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
function current(item,result){const t=timestamp(item.updatedAt);return !result.degraded&&['available','busy','full'].includes(item.status)&&Number.isFinite(t)&&Date.now()-t<=900000&&t-Date.now()<=300000&&Number.isInteger(item.available)&&item.available>=0;}
function refreshFreshness(){for(const {item,result,value,badge} of rows){const fresh=current(item,result);value.textContent=fresh?item.available.toLocaleString('ko-KR')+'면':'확인 필요';badge.textContent=fresh?labels[item.status]:labels[item.status==='unknown'?'unknown':'stale'];}}
function render(result){
 results.replaceChildren();rows=[];
 if(!result)return;
 const note=make('p','ai-result-note',(result.degraded?'최근 보관 정보입니다. 현재 빈자리로 판단하지 마세요. ':'')+'부산시설공단 실시간 제공 목록 기준 · 주소·요금은 참고정보입니다.');results.append(note);
 for(const item of result.items){
  const card=make('article','ai-card'),head=make('div','ai-card-head'),name=make('h4','',item.name),badge=make('span','ai-badge');head.append(name,badge);
  const value=make('strong','ai-value');
  const address=make('p','',item.address||'상세 주소 미제공');
  card.append(head,value,address);
  const time=timestamp(item.updatedAt);
  card.append(make('p','ai-time','데이터 갱신 '+(Number.isFinite(time)?new Date(time).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'시각 미제공')));
  if(item.basic){
   const b=item.basic,known=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&v!=='-';
   if(known(b.feeMinutes)&&known(b.feeWon)&&Number(b.feeMinutes)>0&&Number(b.feeWon)>=0)card.append(make('p','','기본요금 '+b.feeMinutes+'분 / '+Number(b.feeWon).toLocaleString('ko-KR')+'원'));
   if(known(b.weekdayStart)&&known(b.weekdayEnd))card.append(make('p','','평일 '+b.weekdayStart+' ~ '+b.weekdayEnd));
   if(known(b.sourceDate))card.append(make('p','ai-time','요금·운영정보 원본 기준일 '+b.sourceDate));
  }
  // Construct the URL from the data name, never from model-generated links.
  const link=make('a','','카카오맵에서 검색 ↗');link.href='https://map.kakao.com/link/search/'+encodeURIComponent('부산 '+item.name);link.target='_blank';link.rel='noopener noreferrer';card.append(link);
  results.append(card);rows.push({item,result,value,badge});
 }
 refreshFreshness();
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 const question=input.value.trim();if(!question){input.focus();return;}
 if(!navigator.onLine){status.textContent='오프라인에서는 AI 검색을 사용할 수 없습니다.';return;}
 busy=true;button.disabled=true;button.textContent='검색 중…';form.setAttribute('aria-busy','true');status.textContent='질문을 해석하고 실제 주차정보를 확인하고 있습니다.';results.replaceChildren();rows=[];
 try{
  const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question}),signal:AbortSignal.timeout(60000)});
  const value=await response.json();
  if(!response.ok||!value.ok){status.textContent=value.error||'AI 검색에 실패했습니다. 일반 검색을 이용해주세요.';return;}
  status.textContent=value.message;render(value.result);
 }catch{status.textContent='AI 연결이 지연되거나 끊어졌습니다. 잠시 후 다시 시도해주세요. 일반 검색은 계속 사용할 수 있습니다.';}
 finally{busy=false;button.disabled=false;button.textContent='AI로 찾기';form.removeAttribute('aria-busy');}
});
for(const chip of document.querySelectorAll('[data-ai-question]'))chip.addEventListener('click',()=>{input.value=chip.dataset.aiQuestion;input.focus();});
setInterval(()=>{if(!document.hidden)refreshFreshness();},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshFreshness();});

$('aiNav').addEventListener('click',()=>{$('aiDetails').open=true;input.focus({preventScroll:true});});
