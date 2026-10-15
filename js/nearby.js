import {renderParkingResult} from './parking-results.js';
const $=id=>document.getElementById(id);
let busy=false;
fetch('/api/nearby',{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
 if(!Array.isArray(data.stations))throw Error();
 const selected=$('nearbyStation').value;const nodes=data.stations.sort((a,b)=>a.name.localeCompare(b.name,'ko')).map(s=>{const option=document.createElement('option');option.value=s.name;option.textContent=s.name+' · '+s.lines.map(l=>l.replace('부산도시철도 ','')).join('/');return option;});
 $('nearbyStation').replaceChildren(...nodes);$('nearbyStation').value=selected;
}).catch(()=>{$('nearbyStatus').textContent='역 목록을 가져오지 못했습니다. 현재 선택된 덕천역 검색은 시도할 수 있습니다.';});
$('nearbyForm').addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 if(!navigator.onLine){$('nearbyStatus').textContent='주변 검색에는 인터넷 연결이 필요합니다.';return;}
 busy=true;$('nearbySend').disabled=true;$('nearbyForm').setAttribute('aria-busy','true');$('nearbyStatus').textContent='원본 좌표로 주변 주차장을 확인하고 있습니다.';renderParkingResult(null,$('nearbyResults'));
 try{
  const query=new URLSearchParams({station:$('nearbyStation').value,radius:$('nearbyRadius').value});
  const response=await fetch('/api/nearby?'+query,{signal:AbortSignal.timeout(40000)}),data=await response.json();
  if(!response.ok||!data.ok)throw Error(data.error||'주변 검색에 실패했습니다.');
  $('nearbyStatus').textContent=data.message;renderParkingResult(data.result,$('nearbyResults'));
 }catch(error){$('nearbyStatus').textContent=error.name==='TimeoutError'?'주변 검색 시간이 초과됐습니다. 잠시 후 다시 검색해주세요.':error.message||'주변 검색 연결을 확인해주세요.';}
 finally{busy=false;$('nearbySend').disabled=false;$('nearbyForm').removeAttribute('aria-busy');}
});
