const $ = id => document.getElementById(id);
let promptEvent, registration, updating = false;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function connection() {
  $('connection').hidden = navigator.onLine;
  $('connection').textContent = '오프라인 · 현재 주차 현황을 확인할 수 없습니다. 마지막 조회 정보가 있다면 참고용으로만 표시합니다.';
}
connection();
window.addEventListener('offline', connection);
window.addEventListener('online', () => { connection(); document.getElementById('refresh').click(); });
if (!standalone() && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
  $('installHint').hidden = false;
  $('installHint').textContent = 'Safari 공유 메뉴에서 홈 화면에 추가하면 앱처럼 사용할 수 있습니다.';
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); promptEvent = event;
  if (!standalone()) $('install').hidden = false;
});
$('install').addEventListener('click', async () => {
  if (!promptEvent) return;
  const current = promptEvent; promptEvent = null; $('install').hidden = true;
  try { await current.prompt(); await current.userChoice; } catch {}
});
window.addEventListener('appinstalled', () => { promptEvent = null; $('install').hidden = true; $('installHint').hidden = true; });
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) location.reload(); });
  navigator.serviceWorker.register('/service-worker.js', {updateViaCache:'none'}).then(reg => {
    registration = reg;
    const show = () => { if (reg.waiting && navigator.serviceWorker.controller) $('updateApp').hidden = false; };
    show();
    reg.addEventListener('updatefound', () => { const worker = reg.installing; worker?.addEventListener('statechange', show); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && navigator.onLine) reg.update().catch(() => {}); });
  }).catch(() => {
    $('pwaStatus').hidden = false;
    $('pwaStatus').textContent = '오프라인 화면 준비에 실패했습니다. 온라인에서는 계속 이용할 수 있습니다.';
  });
}
$('updateApp').addEventListener('click', () => {
  if (!registration?.waiting) return;
  updating = true; $('updateApp').disabled = true;
  registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
});
