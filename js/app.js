import {timestamp,statusOf,usable,selectItems,summary,hasLocation,links} from './parking-data.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n.toLocaleString('ko-KR');
const clean=v=>v===undefined||v===null||String(v).trim()==='-'?'':String(v).trim();
const dateText=v=>{const t=timestamp(v);return Number.isFinite(t)?new Date(t).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'시각 미제공';};
const labels={available:'자리 있음',busy:'자리 적음',full:'만차',stale:'현재 잔여면 확인 불가',unknown:'정보 확인 필요'};
const opened=new Set(), cards=new Map();
let data=null, busy=false, lastAttempt=0, map=null, layer=null, mapLoading=null, lastMapFilter='';
const options=()=>({query:$('query').value,district:$('district').value,filter:$('filter').value,sort:$('sort').value});
const visible=()=>selectItems(data,options());

function details(p){
 const b=p.basic;
 if(!b)return '<p class="meta">주소·요금 정보 확인 중</p>';
 const time=(start,end)=>clean(start)&&clean(end)?esc(start)+' ~ '+esc(end):'정보 없음';
 const fee=clean(b.tenMin)&&Number(b.tenMin)>=0&&clean(b.pkBascTime)&&Number(b.pkBascTime)>0?esc(b.pkBascTime)+'분 / '+fmt(Number(b.tenMin))+'원':'정보 없음';
 const pairs=[['주소',esc(p.address||'상세 주소 미제공')],['평일',time(b.svcSrtTe,b.svcEndTe)],['토요일',time(b.satSrtTe,b.satEndTe)],['공휴일',time(b.hldSrtTe,b.hldEndTe)],['기본요금',fee],['원본 기준일',esc(clean(b.fnlDt)||'미제공')]];
 const phone=clean(b.tponNum);if(phone)pairs.push(['전화',/^[0-9+() -]+$/.test(phone)?'<a data-focus="phone" href="tel:'+phone.replace(/[^0-9+]/g,'')+'">'+esc(phone)+'</a>':esc(phone)]);
 return '<details'+(opened.has(p.parkgcd)?' open':'')+'><summary data-focus="details">주소·요금·운영시간</summary><dl>'+pairs.map(([k,v])=>'<dt>'+k+'</dt><dd>'+v+'</dd>').join('')+'</dl><p class="meta">'+(p.basicSource==='api'?'공공데이터 기본정보':'원본 대조 후 보관한 기본정보')+' · 요금과 운영시간은 현장 안내를 함께 확인하세요.</p></details>';
}
function cardMarkup(p){
 const status=statusOf(p,data), current=usable(p,data), url=links(p);
 const last=p.valid&&!current?'최근 확인된 잔여 '+fmt(p.curravacnt)+'면 · 현재 수치 아님':!p.valid?'수치가 없거나 총면수와 일치하지 않습니다.':'주차 중 '+fmt(p.parkingcnt)+'대';
 return '<div class="row"><span class="district">'+esc(p.district||'지역 정보 없음')+'</span><span class="pill '+status+'">'+labels[status]+'</span></div><h2>'+esc(p.parknm)+'</h2><p class="address">'+esc(p.address||'상세 주소 미제공')+'</p><div class="availability">'+(current?fmt(p.curravacnt):'—')+' <small>/ '+(p.maxcnt>0?fmt(p.maxcnt):'—')+'면</small></div><div class="track" aria-hidden="true"><i style="width:'+(current?p.curravacnt/p.maxcnt*100:0)+'%"></i></div><p class="meta">'+last+'</p>'+details(p)+'<div class="bottom"><span class="meta">데이터 갱신 '+esc(dateText(p.lastupdatetime))+'<br>코드 '+esc(p.parkgcd)+'</span><div class="actions"><a data-focus="map" target="_blank" rel="noopener noreferrer" href="'+esc(url.map)+'">'+(hasLocation(p)?'위치 보기':'지도 검색')+' ↗</a>'+(url.route?'<a data-focus="route" target="_blank" rel="noopener noreferrer" href="'+esc(url.route)+'">길찾기 ↗</a>':'')+'</div></div>';
}
function updateDistricts(){
 const selected=$('district').value;
 const names=[...new Set(data.items.map(p=>p.district).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
 const signature=names.join('|');
 if($('district').dataset.signature===signature)return;
 $('district').innerHTML='<option value="all">모든 지역</option>'+names.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('')+'<option value="unknown">지역 정보 없음</option>';
 $('district').dataset.signature=signature;
 $('district').value=names.includes(selected)||['all','unknown'].includes(selected)?selected:'all';
}
function renderNotice(){
 if(!data)return;
 const totals=summary(data.items,data), delayed=data.items.filter(p=>statusOf(p,data)==='stale').length;
 const green=data.live&&!data.degraded&&delayed===0;
 $('notice').className='notice'+(green?' live-notice':'');
 const title=data.degraded?'최근 조회 정보':delayed?'일부 데이터 갱신 지연':data.live?'실시간 조회 정상':'조회 대기';
 $('notice').innerHTML='<strong>'+title+'</strong><span>'+esc(data.message||'')+(data.items.length?' · 지연 '+fmt(delayed)+'곳 / 확인 필요 '+fmt(totals.uncertain-delayed)+'곳':'')+'</span>';
}
function render(){
 if(!data)return;
 updateDistricts();renderNotice();const items=visible(), totals=summary(items,data);
 $('scope').textContent='부산시설공단 실시간 제공 '+fmt(data.items.length)+'곳 · 부산 전체 공영주차장 목록이 아닙니다.';
 for(const k of ['count','spaces','full','uncertain'])$(k).textContent=fmt(totals[k]);
 if(!items.some(p=>usable(p,data))){$('spaces').textContent='—';$('full').textContent='—';}
 $('resultCount').textContent='전체 '+fmt(data.items.length)+'곳 중 '+fmt(items.length)+'곳 · 통계는 현재 검색 결과 기준';
 const times=data.items.map(p=>timestamp(p.lastupdatetime)).filter(Number.isFinite);
 const oldest=times.length?Math.min(...times):NaN,newest=times.length?Math.max(...times):NaN;
 $('checked').textContent='데이터 갱신 '+(Number.isFinite(newest)?dateText(new Date(oldest).toISOString())+(oldest!==newest?' ~ '+dateText(new Date(newest).toISOString()):''):'미제공')+' · 서버 정상 조회 '+dateText(data.fetchedAt)+' · 5분 간격 확인';
 $('basicStatus').textContent='주소·요금 연결 '+fmt(data.items.filter(p=>p.basic).length)+'곳 · 원본 좌표 '+fmt(data.items.filter(hasLocation).length)+'곳. '+(data.basicOk?'기본정보 API 조회 정상.':'기본정보 조회가 지연되어 원본을 대조한 보관 정보를 사용합니다.');
 const active=document.activeElement;
 const focusCode=active?.closest('[data-code]')?.dataset.code, focusName=active?.dataset.focus;
 const wanted=new Set(items.map(p=>p.parkgcd));
 for(const [code,node] of cards)if(!wanted.has(code))node.remove();
 $('cards').querySelector('.empty')?.remove();
 for(const p of items){
   let node=cards.get(p.parkgcd);if(!node){node=document.createElement('article');node.className='card';node.dataset.code=p.parkgcd;cards.set(p.parkgcd,node);}
   const signature=JSON.stringify([p,statusOf(p,data),opened.has(p.parkgcd)]);
   if(node.dataset.signature!==signature){node.innerHTML=cardMarkup(p);node.dataset.signature=signature;}
   $('cards').append(node);
 }
 if(!items.length){const empty=document.createElement('p');empty.className='empty';empty.textContent=data.items.length?'검색 조건에 맞는 주차장이 없습니다.':'현재 조회 정보를 가져오지 못했습니다. 잠시 후 다시 확인해주세요.';$('cards').append(empty);}
 if(focusCode&&focusName){const node=cards.get(focusCode);const target=node?.querySelector('[data-focus="'+focusName+'"]');if(target?.isConnected)target.focus({preventScroll:true});else {$('resultCount').setAttribute('tabindex','-1');$('resultCount').focus({preventScroll:true});}}
 if(!$('mapPanel').hidden)updateMap();
}
$('cards').addEventListener('toggle',event=>{if(event.target.tagName!=='DETAILS')return;const code=event.target.closest('[data-code]').dataset.code;if(event.target.open)opened.add(code);else opened.delete(code);},true);
function remember(){if(data?.items.length&&!data.degraded)try{sessionStorage.setItem('busan-parking-last-success',JSON.stringify(data));}catch{}}
async function load(){
 if(busy)return;busy=true;lastAttempt=Date.now();$('refresh').disabled=true;$('refresh').textContent='확인 중…';
 try{
   const r=await fetch('/api/parking',{signal:AbortSignal.timeout(35000)});if(!r.ok)throw Error('network');
   const next=await r.json();if(!Array.isArray(next.items))throw Error('response');
   if(!next.items.length&&data?.items.length){data={...data,live:false,degraded:true,message:(next.message||'조회 실패')+' · 마지막 정상 조회 정보를 유지합니다'};}
   else data=next;
   remember();render();
 }catch{
   if(data?.items.length){data={...data,live:false,degraded:true,message:'새로고침에 실패했습니다. 마지막 정상 조회 정보를 유지합니다.'};render();}
   else{$('notice').textContent='주차 정보를 불러오지 못했습니다. 잠시 후 새로고침해주세요.';$('cards').innerHTML='<p class="empty">조회할 정보가 없습니다.</p>';}
 }finally{busy=false;$('refresh').disabled=false;$('refresh').textContent='↻ 새로고침';}
}
async function leaflet(){
 if(window.L)return window.L;
 if(!mapLoading)mapLoading=new Promise((resolve,reject)=>{
   const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';css.crossOrigin='anonymous';document.head.append(css);
   const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';script.crossOrigin='anonymous';script.onload=()=>resolve(window.L);script.onerror=()=>reject(Error('map'));document.head.append(script);
 });
 return mapLoading;
}
async function updateMap(){
 const points=visible().filter(hasLocation);
 $('mapMessage').textContent='검색 결과 '+fmt(visible().length)+'곳 중 원본 좌표가 있는 '+fmt(points.length)+'곳 표시 · 원본 좌표는 반올림되어 있을 수 있습니다.';
 try{
  const L=await leaflet();if($('mapPanel').hidden)return;
  if(!map){map=L.map('map',{scrollWheelZoom:false}).setView([35.18,129.06],11);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);layer=L.layerGroup().addTo(map);}
  layer.clearLayers();
  for(const p of points){const state=statusOf(p,data),u=links(p);L.marker([p.location.lat,p.location.lng],{icon:L.divIcon({className:'map-pin '+state,html:esc(usable(p,data)?fmt(p.curravacnt):'?'),iconSize:[36,30],iconAnchor:[18,15]}),title:p.parknm,alt:p.parknm}).bindPopup('<b>'+esc(p.parknm)+'</b><br>'+esc(labels[state])+'<br>'+esc(p.address||'상세 주소 미제공')+'<br><a target="_blank" rel="noopener noreferrer" href="'+esc(u.route)+'">길찾기 ↗</a>').addTo(layer);}
  map.invalidateSize();const filter=JSON.stringify(options());if(points.length&&lastMapFilter!==filter){map.fitBounds(points.map(p=>[p.location.lat,p.location.lng]),{padding:[30,30],maxZoom:14});lastMapFilter=filter;}
 }catch{$('mapMessage').textContent='지도를 불러오지 못했습니다. 주차장 카드의 위치 보기·길찾기를 이용하세요.';}
}
$('mapToggle').addEventListener('click',()=>{const open=$('mapPanel').hidden;$('mapPanel').hidden=!open;$('mapToggle').setAttribute('aria-expanded',String(open));$('mapToggle').textContent=open?'지도 닫기':'지도 보기';if(open)updateMap();});
$('searchForm').addEventListener('submit',e=>e.preventDefault());
for(const id of ['query','district','filter','sort'])$(id).addEventListener(id==='query'?'input':'change',render);
$('refresh').addEventListener('click',load);
try{const saved=JSON.parse(sessionStorage.getItem('busan-parking-last-success'));if(Array.isArray(saved?.items)&&saved.items.length){data={...saved,live:false,degraded:true,message:'최근 조회 정보를 표시하며 최신 데이터를 확인 중입니다.'};render();}}catch{}
load();
setInterval(()=>{if(!document.hidden)load();},300000);
setInterval(()=>{if(!document.hidden&&data)render();},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();if(Date.now()-lastAttempt>=60000)load();}});
if(document.modelContext?.registerTool){const lifecycle=new AbortController();try{Promise.resolve(document.modelContext.registerTool({name:'search_parking',description:'이름·주소·코드 및 지역으로 주차장을 검색하고 현재 확인 가능한 잔여면을 반환합니다.',inputSchema:{type:'object',properties:{query:{type:'string',maxLength:100},district:{type:'string',maxLength:20}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!input||typeof input.query!=='string'||input.query.length>100||input.district!==undefined&&typeof input.district!=='string')throw Error('Invalid input');if(!data)throw Error('Data unavailable');if(input.district&&!Array.from($('district').options).some(o=>o.value===input.district))throw Error('Unknown district');$('query').value=input.query;if(input.district)$('district').value=input.district;render();return {degraded:data.degraded,items:visible().map(p=>({name:p.parknm,code:p.parkgcd,status:statusOf(p,data),available:usable(p,data)?p.curravacnt:null,address:p.address,updated:p.lastupdatetime}))};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
