import {renderParkingResult} from './parking-results.js';
const $=id=>document.getElementById(id);
const form=$('aiForm'),button=$('aiSend'),input=$('aiQuestion'),status=$('aiStatus'),results=$('aiResults');
let busy=false;
const render=value=>renderParkingResult(value,results);
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 const question=input.value.trim();if(!question){input.focus();return;}
 if(!navigator.onLine){status.textContent='오프라인에서는 AI 검색을 사용할 수 없습니다.';return;}
 busy=true;button.disabled=true;button.textContent='검색 중…';form.setAttribute('aria-busy','true');status.textContent='질문을 해석하고 실제 주차정보를 확인하고 있습니다.';render(null);
 try{
  const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question}),signal:AbortSignal.timeout(60000)});
  const value=await response.json();
  if(!response.ok||!value.ok){status.textContent=value.error||'AI 검색에 실패했습니다. 일반 검색을 이용해주세요.';return;}
  status.textContent=value.message;render(value.result);
 }catch{status.textContent='AI 연결이 지연되거나 끊어졌습니다. 잠시 후 다시 시도해주세요. 일반 검색은 계속 사용할 수 있습니다.';}
 finally{busy=false;button.disabled=false;button.textContent='AI로 찾기';form.removeAttribute('aria-busy');}
});
for(const chip of document.querySelectorAll('[data-ai-question]'))chip.addEventListener('click',()=>{input.value=chip.dataset.aiQuestion;input.focus();});



$('aiNav').addEventListener('click',()=>{$('aiDetails').open=true;input.focus({preventScroll:true});});
